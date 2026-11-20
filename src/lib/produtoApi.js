// Integração de catálogo de produtos do mercado brasileiro (por código de barras / GTIN-EAN).
// Fonte: Open Food Facts (grátis, sem chave, muitos produtos BR, permite uso no frontend).
// Simula o efeito de "puxar do PDV": digita/escaneia o código e o produto vem preenchido.
import imagensAprovadas from '../data/imagensProdutosAprovadas.json'

const CATALOGOS_PUBLICOS = [
  { id: 'open-food-facts', dominio: 'world.openfoodfacts.org', nome: 'Open Food Facts' },
  { id: 'open-beauty-facts', dominio: 'world.openbeautyfacts.org', nome: 'Open Beauty Facts' },
  { id: 'open-products-facts', dominio: 'world.openproductsfacts.org', nome: 'Open Products Facts' },
  { id: 'open-pet-food-facts', dominio: 'world.openpetfoodfacts.org', nome: 'Open Pet Food Facts' },
]
const CAMPOS_CATALOGO = [
  'code',
  'product_name',
  'product_name_pt',
  'generic_name_pt',
  'brands',
  'brand_owner',
  'quantity',
  'categories',
  'categories_tags',
  'image_front_url',
  'image_url',
  'selected_images',
].join(',')
const CACHE_CATALOGO = new Map()
const BANCO_IMAGENS = 'clawmarket-imagens-produtos'
const LOJA_IMAGENS = 'imagens'
const REVALIDAR_EMBALAGEM_MS = 30 * 24 * 60 * 60 * 1000
const TRATAMENTO_PACKSHOT = 'packshot-estudio-v8-transparente-hd'
const TRATAMENTO_MANUAL = 'imagem-manual-livre-v1'
const MINIMO_MAIOR_LADO_FONTE = 700
let promessaBancoImagens
const IMAGENS_LOCAIS = import.meta.glob([
  '../assets/produtos/*.jpg',
  '../assets/produtos/*.jpeg',
  '../assets/produtos/*.png',
  '../assets/produtos/*.webp',
], {
  eager: true,
  query: '?url',
  import: 'default',
})

async function fetchComTimeout(url, opcoes = {}, tempo = 10000) {
  if (typeof AbortController === 'undefined') return fetch(url, opcoes)
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), tempo)
  try {
    return await fetch(url, { ...opcoes, signal: controller.signal })
  } finally {
    clearTimeout(timer)
  }
}

async function abrirImagemDoBlob(blob) {
  if (typeof createImageBitmap === 'function') {
    const bitmap = await createImageBitmap(blob)
    return {
      fonte: bitmap,
      largura: bitmap.width,
      altura: bitmap.height,
      liberar: () => bitmap.close?.(),
    }
  }

  const urlLocal = URL.createObjectURL(blob)
  const img = new Image()
  img.decoding = 'async'
  await new Promise((resolve, reject) => {
    img.onload = resolve
    img.onerror = () => reject(new Error('Formato de imagem não suportado neste aparelho.'))
    img.src = urlLocal
  })
  return {
    fonte: img,
    largura: img.naturalWidth,
    altura: img.naturalHeight,
    liberar: () => URL.revokeObjectURL(urlLocal),
  }
}

// heurística: mapeia o produto para um dos 9 setores do app
const SETOR_REGRAS = [
  { re: /bebida|refrigerante|suco|água|agua|cerveja|drink|beverage|refresco|energ|chá|cha\b|isoton/, setor: 'bebidas' },
  { re: /congelad|frozen|sorvete|pizza|lasanha|nugget|hamb[uú]rg/, setor: 'congelados' },
  { re: /queijo|presunto|mortadela|salame|frios|embutido|lingu[ií]ça|salsicha|sausage|bacon|\bham\b|peito de peru/, setor: 'frios' },
  { re: /leite|iogurte|yogurt|requeij|dairy|latic[ií]n|manteiga|creme de leite|condensado|nata/, setor: 'laticinios' },
  { re: /p[ãa]o|bread|padaria|bolo|biscoito|torrada|bisnaga|bakery|rosca|croissant/, setor: 'padaria' },
  { re: /fruta|verdura|legume|hortifr|fruit|vegetable|salada|tomate|banana|maçã|maca\b/, setor: 'hortifruti' },
  { re: /limpeza|detergente|sab[ãa]o|amaciante|desinfet|cleaning|sanit[áa]ria|alvejante|multiuso|esponja/, setor: 'limpeza' },
  { re: /\bpet\b|ra[çc][ãa]o|cachorro|gato|\bdog\b|cat food|petisco animal/, setor: 'petshop' },
]

export function inferirSetor(texto = '') {
  const t = texto.toLowerCase()
  for (const r of SETOR_REGRAS) if (r.re.test(t)) return r.setor
  return 'mercearia'
}

function codigoComparavel(codigo) {
  return String(codigo || '').replace(/\D/g, '').replace(/^0+/, '') || '0'
}

function catalogosPorSetor(setor) {
  if (setor === 'petshop') {
    return [CATALOGOS_PUBLICOS[3], CATALOGOS_PUBLICOS[2], CATALOGOS_PUBLICOS[0], CATALOGOS_PUBLICOS[1]]
  }
  if (setor === 'limpeza') {
    return [CATALOGOS_PUBLICOS[2], CATALOGOS_PUBLICOS[1], CATALOGOS_PUBLICOS[0], CATALOGOS_PUBLICOS[3]]
  }
  return CATALOGOS_PUBLICOS
}

function imagemFrontalAlta(p = {}) {
  const frontal = p.selected_images?.front
  const display = frontal?.display || {}
  const idioma =
    display.pt ||
    display['pt-br'] ||
    display.en ||
    display.es ||
    Object.values(display)[0]
  const url = idioma || p.image_front_url || p.image_url || null
  if (!url) return null
  // A base publica oferece a mesma fotografia selecionada em tamanho completo.
  return url.replace(/\.(?:100|200|400)\.jpg(?:\?.*)?$/i, '.full.jpg')
}

function distanciaCor(r, g, b, cor) {
  const dr = r - cor[0]
  const dg = g - cor[1]
  const db = b - cor[2]
  return Math.sqrt(dr * dr + dg * dg + db * db)
}

function corMedia(imageData, largura, altura, cx, cy) {
  const raio = Math.max(2, Math.round(Math.min(largura, altura) * 0.012))
  let r = 0, g = 0, b = 0, n = 0
  for (let y = Math.max(0, cy - raio); y <= Math.min(altura - 1, cy + raio); y++) {
    for (let x = Math.max(0, cx - raio); x <= Math.min(largura - 1, cx + raio); x++) {
      const i = (y * largura + x) * 4
      r += imageData[i]
      g += imageData[i + 1]
      b += imageData[i + 2]
      n++
    }
  }
  return [r / n, g / n, b / n]
}

// Remove somente o fundo conectado às bordas da fotografia.
// Isso evita apagar detalhes escuros ou brancos que pertencem à embalagem.
function recortarProdutoDaFoto(canvas) {
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  const largura = canvas.width
  const altura = canvas.height
  const pixels = ctx.getImageData(0, 0, largura, altura)
  const d = pixels.data
  const margemX = Math.max(1, Math.round(largura * 0.02))
  const margemY = Math.max(1, Math.round(altura * 0.02))
  const paleta = [
    corMedia(d, largura, altura, margemX, margemY),
    corMedia(d, largura, altura, largura - 1 - margemX, margemY),
    corMedia(d, largura, altura, margemX, altura - 1 - margemY),
    corMedia(d, largura, altura, largura - 1 - margemX, altura - 1 - margemY),
  ]
  const total = largura * altura
  const fundo = new Uint8Array(total)
  const fila = new Int32Array(total)
  let inicio = 0
  let fim = 0
  const limite = 58

  const distanciaPaleta = (indicePixel) => {
    const i = indicePixel * 4
    let menor = Infinity
    for (const cor of paleta) {
      menor = Math.min(menor, distanciaCor(d[i], d[i + 1], d[i + 2], cor))
    }
    return menor
  }
  const adicionarBorda = (indice) => {
    if (!fundo[indice] && distanciaPaleta(indice) <= limite + 20) {
      fundo[indice] = 1
      fila[fim++] = indice
    }
  }

  for (let x = 0; x < largura; x++) {
    adicionarBorda(x)
    adicionarBorda((altura - 1) * largura + x)
  }
  for (let y = 1; y < altura - 1; y++) {
    adicionarBorda(y * largura)
    adicionarBorda(y * largura + largura - 1)
  }

  const tentar = (atual, proximo) => {
    if (proximo < 0 || proximo >= total || fundo[proximo]) return
    const global = distanciaPaleta(proximo)
    // A cor também precisa continuar próxima ao fundo original.
    // Não propagamos apenas pela semelhança com o pixel vizinho, pois isso pode
    // atravessar gradualmente o rótulo e apagar partes da embalagem.
    if (global <= limite + 18) {
      fundo[proximo] = 1
      fila[fim++] = proximo
    }
  }

  while (inicio < fim) {
    const atual = fila[inicio++]
    const x = atual % largura
    if (x > 0) tentar(atual, atual - 1)
    if (x < largura - 1) tentar(atual, atual + 1)
    if (atual >= largura) tentar(atual, atual - largura)
    if (atual < total - largura) tentar(atual, atual + largura)
  }

  const proporcaoRemovida = fim / total
  if (proporcaoRemovida < 0.02 || proporcaoRemovida > 0.96) {
    return { canvas, x: 0, y: 0, largura, altura }
  }

  // Embalagens plásticas e brilhantes podem refletir a mesma cor do fundo.
  // Preservamos todo o conteúdo entre as bordas esquerda/direita da silhueta
  // para não criar buracos dentro do rótulo.
  const esquerda = new Int32Array(altura)
  const direita = new Int32Array(altura)
  esquerda.fill(largura)
  direita.fill(-1)
  for (let p = 0; p < total; p++) {
    if (fundo[p]) continue
    const x = p % largura
    const y = Math.floor(p / largura)
    if (x < esquerda[y]) esquerda[y] = x
    if (x > direita[y]) direita[y] = x
  }
  for (let y = 0; y < altura; y++) {
    if (direita[y] < esquerda[y]) continue
    const folgaLinha = Math.max(1, Math.round((direita[y] - esquerda[y]) * 0.01))
    const de = Math.max(0, esquerda[y] - folgaLinha)
    const ate = Math.min(largura - 1, direita[y] + folgaLinha)
    for (let x = de; x <= ate; x++) fundo[y * largura + x] = 0
  }

  let minX = largura, minY = altura, maxX = 0, maxY = 0
  for (let p = 0; p < total; p++) {
    const i = p * 4
    if (fundo[p]) {
      d[i + 3] = 0
      continue
    }
    const x = p % largura
    const y = Math.floor(p / largura)
    if (x < minX) minX = x
    if (x > maxX) maxX = x
    if (y < minY) minY = y
    if (y > maxY) maxY = y

    // Suaviza um pixel da borda para o recorte não ficar serrilhado na impressão.
    const tocaFundo =
      (x > 0 && fundo[p - 1]) ||
      (x < largura - 1 && fundo[p + 1]) ||
      (y > 0 && fundo[p - largura]) ||
      (y < altura - 1 && fundo[p + largura])
    if (tocaFundo) d[i + 3] = 185
  }
  ctx.putImageData(pixels, 0, 0)
  const folga = Math.round(Math.max(maxX - minX, maxY - minY) * 0.025)
  return {
    canvas,
    x: Math.max(0, minX - folga),
    y: Math.max(0, minY - folga),
    largura: Math.min(largura, maxX + folga) - Math.max(0, minX - folga) + 1,
    altura: Math.min(altura, maxY + folga) - Math.max(0, minY - folga) + 1,
  }
}

// Baixa a fotografia e transforma em packshot de estúdio, pronto para o jornal.
async function imagemParaDataURL(url, { fundoBranco = true } = {}) {
  let imagemAberta
  try {
    const r = await fetchComTimeout(url, {}, 15000)
    if (!r.ok) return null
    const blob = await r.blob()
    imagemAberta = await abrirImagemDoBlob(blob)
    const { fonte, largura: larguraFonte, altura: alturaFonte } = imagemAberta
    if (Math.max(larguraFonte, alturaFonte) < MINIMO_MAIOR_LADO_FONTE) return null
    // A nitidez vem da fonte original. Imagens pequenas não são ampliadas
    // agressivamente, pois isso só aumenta o desfoque na impressão.
    const maximoPackshot = 1800
    const maiorLado = Math.max(larguraFonte, alturaFonte)
    const escala = Math.min(1, maximoPackshot / Math.max(1, maiorLado))
    const largura = Math.max(1, Math.round(larguraFonte * escala))
    const altura = Math.max(1, Math.round(alturaFonte * escala))
    const origem = document.createElement('canvas')
    origem.width = largura
    origem.height = altura
    const origemCtx = origem.getContext('2d')
    origemCtx.imageSmoothingEnabled = true
    origemCtx.imageSmoothingQuality = 'high'
    origemCtx.drawImage(fonte, 0, 0, largura, altura)

    const recorte = recortarProdutoDaFoto(origem)
    const lado = 1000
    const canvas = document.createElement('canvas')
    canvas.width = lado
    canvas.height = lado
    const ctx = canvas.getContext('2d')
    ctx.imageSmoothingEnabled = true
    ctx.imageSmoothingQuality = 'high'
    ctx.clearRect(0, 0, lado, lado)

    const limiteProduto = lado * 0.82
    const escalaProduto = Math.min(
      limiteProduto / recorte.largura,
      limiteProduto / recorte.altura,
      1.15
    )
    const destinoW = Math.max(1, Math.round(recorte.largura * escalaProduto))
    const destinoH = Math.max(1, Math.round(recorte.altura * escalaProduto))
    const destinoX = Math.round((lado - destinoW) / 2)
    const destinoY = Math.round((lado - destinoH) / 2 - lado * 0.015)

    ctx.save()
    ctx.shadowColor = 'rgba(8,43,79,.18)'
    ctx.shadowBlur = 24
    ctx.shadowOffsetY = 14
    ctx.drawImage(
      recorte.canvas,
      recorte.x, recorte.y, recorte.largura, recorte.altura,
      destinoX, destinoY, destinoW, destinoH
    )
    ctx.restore()
    ctx.drawImage(
      recorte.canvas,
      recorte.x, recorte.y, recorte.largura, recorte.altura,
      destinoX, destinoY, destinoW, destinoH
    )

    // Uma embalagem pronta para encarte precisa conservar área transparente.
    // Se a remoção automática não separou o fundo, rejeitamos a foto em vez de
    // publicar um quadrado branco ou uma imagem de baixa qualidade no jornal.
    const pixelsFinais = ctx.getImageData(0, 0, lado, lado).data
    let transparentes = 0
    for (let i = 3; i < pixelsFinais.length; i += 4) {
      if (pixelsFinais[i] < 245) transparentes += 1
    }
    if (transparentes / (lado * lado) < 0.04) return null
    if (fundoBranco) {
      ctx.save()
      ctx.globalCompositeOperation = 'destination-over'
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(0, 0, lado, lado)
      ctx.restore()
    }
    return canvas.toDataURL('image/png')
  } catch (_) {
    return null
  } finally {
    imagemAberta?.liberar?.()
  }
}

function abrirBancoImagens() {
  if (!globalThis.indexedDB) return Promise.resolve(null)
  if (promessaBancoImagens) return promessaBancoImagens
  promessaBancoImagens = new Promise((resolve) => {
    const req = globalThis.indexedDB.open(BANCO_IMAGENS, 1)
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(LOJA_IMAGENS)) {
        req.result.createObjectStore(LOJA_IMAGENS, { keyPath: 'codigoBarras' })
      }
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => resolve(null)
  })
  return promessaBancoImagens
}

async function lerImagemSalva(codigo) {
  const db = await abrirBancoImagens()
  if (!db) return null
  return new Promise((resolve) => {
    const req = db.transaction(LOJA_IMAGENS, 'readonly').objectStore(LOJA_IMAGENS).get(codigo)
    req.onsuccess = () => resolve(req.result || null)
    req.onerror = () => resolve(null)
  })
}

async function gravarImagemSalva(registro) {
  const db = await abrirBancoImagens()
  if (!db) return false
  return new Promise((resolve) => {
    const tx = db.transaction(LOJA_IMAGENS, 'readwrite')
    tx.objectStore(LOJA_IMAGENS).put(registro)
    tx.oncomplete = () => resolve(true)
    tx.onerror = () => resolve(false)
  })
}

function respostaImagemSalva(registro) {
  if (!registro?.imagem) return null
  return {
    imagem: registro.imagem,
    marca: registro.marca,
    setor: registro.setor,
    origem: registro.origem,
    origemNome: registro.origemNome,
    imagemOriginal: registro.imagemOriginal,
    imagemFonteUrl: registro.imagemFonteUrl || registro.imagemOriginal,
    imagemPaginaUrl: registro.imagemPaginaUrl || null,
    imagemLargura: registro.imagemLargura || null,
    imagemAltura: registro.imagemAltura || null,
    imagemAprovada: Boolean(registro.imagemAprovada),
    imagemManual: Boolean(registro.imagemManual),
    correspondencia: registro.correspondencia || 'codigo-exato',
    imagemAltaResolucao: registro.imagemAltaResolucao,
    imagemIlustrativa: false,
    imagemCachePermanente: true,
    imagemTratada: registro.tratamento === TRATAMENTO_PACKSHOT || registro.tratamento === TRATAMENTO_MANUAL,
    imagemTratamento: registro.tratamento,
    imagemSalvaEm: registro.salvoEm,
  }
}

export async function restaurarImagensSalvas(produtos = []) {
  return Promise.all(
    produtos.map(async (produto) => {
      if (
        produto.imagem &&
        produto.imagemTratamento === TRATAMENTO_PACKSHOT
      ) return produto
      if (!produto.imagemCachePermanente || !produto.codigoBarras) return produto
      const salvo = await lerImagemSalva(String(produto.codigoBarras).replace(/\D/g, ''))
      const foto = respostaImagemSalva(salvo)
      return foto ? { ...produto, ...foto } : produto
    })
  )
}

async function consultarCatalogoExato(codigo, setor = '', opcoes = {}) {
  const c = String(codigo || '').replace(/\D/g, '').trim()
  if (!c) return null
  const chaveCache = `${c}:${setor}`
  if (!opcoes.ignorarCache && CACHE_CATALOGO.has(chaveCache)) return CACHE_CATALOGO.get(chaveCache)

  for (const catalogo of catalogosPorSetor(setor)) {
    try {
      const endpoint =
        `https://${catalogo.dominio}/api/v2/product/${encodeURIComponent(c)}.json` +
        `?fields=${encodeURIComponent(CAMPOS_CATALOGO)}&lc=pt&cc=br`
      const r = await fetchComTimeout(endpoint, {}, 8000)
      if (!r.ok) continue
      const j = await r.json()
      if (j.status !== 1 || !j.product) continue

      const p = j.product
      // Não aceita resultado aproximado: o GTIN/EAN precisa ser exatamente o mesmo.
      if (codigoComparavel(p.code || c) !== codigoComparavel(c)) continue

      const baseNome = p.product_name_pt || p.product_name || p.generic_name_pt || ''
      const nome = [baseNome, p.quantity].filter(Boolean).join(' ').trim()
      const textoSetor = `${baseNome} ${p.categories || ''} ${(p.categories_tags || []).join(' ')}`
      const imagemOriginal = imagemFrontalAlta(p)
      const resultado = {
        encontrado: true,
        nome: nome || `Produto ${c}`,
        marca: (p.brands || p.brand_owner || '').split(',')[0].trim(),
        setor: inferirSetor(textoSetor),
        imagem: imagemOriginal && opcoes.baixarImagem !== false ? await imagemParaDataURL(imagemOriginal, { fundoBranco: true }) : null,
        imagemOriginal,
        imagemFonteUrl: imagemOriginal,
        imagemPaginaUrl: `https://${catalogo.dominio}/product/${encodeURIComponent(c)}`,
        imagemAltaResolucao: Boolean(imagemOriginal),
        imagemIlustrativa: false,
        correspondencia: 'codigo-exato',
        codigoBarras: c,
        origem: catalogo.id,
        origemNome: catalogo.nome,
      }
      if (opcoes.baixarImagem !== false) CACHE_CATALOGO.set(chaveCache, resultado)
      return resultado
    } catch (_) {
      // Segue para o próximo banco público.
    }
  }
  const ausente = { encontrado: false, codigoBarras: c }
  if (!opcoes.ignorarCache) CACHE_CATALOGO.set(chaveCache, ausente)
  return ausente
}

export async function buscarProdutoCatalogo(codigo, opcoes = {}) {
  return consultarCatalogoExato(codigo, opcoes.setor || '', opcoes)
}

function imagemLocalPorCodigo(codigo) {
  const codigos = [String(codigo), String(codigo).padStart(13, '0')]
  const entrada = Object.entries(IMAGENS_LOCAIS).find(([caminho]) => {
    const nome = caminho.split('/').pop()?.replace(/\.(jpg|jpeg|png|webp)$/i, '')
    return codigos.includes(nome)
  })
  return entrada?.[1] || null
}

// Retorna somente fotografia associada ao código exato.
// Primeiro usa os arquivos locais e depois quatro bancos públicos especializados.
async function prepararImagemLocal(codigo, dados, local, aprovada = null) {
  const imagem = await imagemParaDataURL(local, { fundoBranco: true })
  const maiorLado = Math.max(aprovada?.largura || 0, aprovada?.altura || 0)
  const registro = {
    codigoBarras: codigo,
    imagem,
    marca: dados.marca || '',
    setor: dados.setor || '',
    origem: aprovada ? 'catalogo-local-aprovado' : 'catalogo-local-legado',
    origemNome: aprovada?.origemNome || 'Catálogo local configurado',
    imagemOriginal: `catalogo-local:${codigo}`,
    imagemFonteUrl: aprovada?.imagemFonteUrl || null,
    imagemPaginaUrl: aprovada?.imagemPaginaUrl || null,
    imagemLargura: aprovada?.largura || null,
    imagemAltura: aprovada?.altura || null,
    imagemAprovada: Boolean(aprovada),
    correspondencia: 'codigo-exato',
    imagemAltaResolucao: maiorLado >= 1000,
    imagemIlustrativa: false,
    tratamento: TRATAMENTO_PACKSHOT,
    salvoEm: new Date().toISOString(),
    verificadoEm: new Date().toISOString(),
  }
  if (String(imagem).startsWith('data:')) await gravarImagemSalva(registro)
  return respostaImagemSalva(registro)
}

// Consulta a função Python em produção. Ela mantém a mercadologia configurada como
// fonte de verdade e usa a busca de imagens apenas para completar a embalagem.
export async function buscarProdutoAutomatizado(codigo, produtoBase = null) {
  const c = String(codigo || '').replace(/\D/g, '').trim()
  if (!c || typeof fetch !== 'function' || globalThis.location?.protocol === 'file:') return null

  try {
    const resposta = await fetch(`/api/produto?codigo=${encodeURIComponent(c)}`, {
      headers: { Accept: 'application/json' },
    })
    if (!resposta.ok && resposta.status !== 404) return null
    const dados = await resposta.json()
    const produto = dados?.produto || produtoBase
    const fonte = dados?.imagem
    let foto = null

    if (fonte?.dataUrl) {
      const imagem = await imagemParaDataURL(fonte.dataUrl, { fundoBranco: true })
      if (String(imagem).startsWith('data:')) {
        const registro = {
          codigoBarras: c,
          imagem,
          marca: fonte.marca || produto?.marca || '',
          setor: produto?.setor || '',
          origem: fonte.origem || 'automacao-python',
          origemNome: fonte.origemNome || 'Automação de produtos',
          imagemOriginal: fonte.url,
          imagemFonteUrl: fonte.url,
          imagemPaginaUrl: fonte.paginaUrl || null,
          imagemLargura: null,
          imagemAltura: null,
          imagemAprovada: fonte.correspondencia === 'codigo-exato',
          correspondencia: fonte.correspondencia || 'busca-por-codigo-e-nome',
          imagemAltaResolucao: true,
          imagemIlustrativa: fonte.correspondencia !== 'codigo-exato',
          tratamento: TRATAMENTO_PACKSHOT,
          salvoEm: new Date().toISOString(),
          verificadoEm: new Date().toISOString(),
        }
        await gravarImagemSalva(registro)
        foto = respostaImagemSalva(registro)
      }
    }

    return {
      encontrado: Boolean(dados?.encontrado),
      produto,
      foto,
      googleConfigurado: Boolean(dados?.googleConfigurado),
      fonteMercadologia: dados?.fonteMercadologia || null,
    }
  } catch (_) {
    // O app continua operacional fora da Vercel usando os catálogos do cliente.
    return null
  }
}

export function urlBuscaGoogleImagens(produto = {}) {
  const consulta = [produto.nome, produto.marca, produto.gramagem]
    .filter(Boolean)
    .join(' ')
  const url = new URL('https://www.google.com/search')
  url.searchParams.set('tbm', 'isch')
  url.searchParams.set('safe', 'active')
  url.searchParams.set('hl', 'pt-BR')
  url.searchParams.set('gl', 'br')
  url.searchParams.set('tbs', 'isz:l')
  url.searchParams.set('q', consulta)
  return url.toString()
}

export async function prepararImagemGoogleConfirmada(produto, imagemUrl) {
  const chave = String(produto?.codigoBarras || produto?.id || produto?.nome || '').trim()
  let url
  try {
    url = new URL(String(imagemUrl || '').trim())
  } catch (_) {
    throw new Error('Cole um endereço válido da imagem.')
  }
  if (!chave || url.protocol !== 'https:') throw new Error('Informe o nome do produto e uma imagem HTTPS válida.')

  const resposta = await fetch(`/api/produto?nome=${encodeURIComponent(produto.nome || chave)}&imagemUrl=${encodeURIComponent(url.toString())}`, {
    headers: { Accept: 'application/json' },
  })
  const dados = await resposta.json().catch(() => ({}))
  if (!resposta.ok || !dados?.imagem?.dataUrl) {
    throw new Error(dados?.error || 'Não foi possível baixar essa imagem.')
  }
  const registro = {
    codigoBarras: chave,
    imagem: dados.imagem.dataUrl,
    marca: produto.marca || '',
    setor: produto.setor || '',
    origem: 'google-imagens-confirmado',
    origemNome: 'Google Imagens (seleção confirmada)',
    imagemOriginal: url.toString(),
    imagemFonteUrl: url.toString(),
    imagemPaginaUrl: urlBuscaGoogleImagens(produto),
    imagemLargura: null,
    imagemAltura: null,
    imagemAprovada: true,
    imagemManual: true,
    correspondencia: 'confirmado-manualmente',
    imagemAltaResolucao: null,
    imagemIlustrativa: false,
    tratamento: TRATAMENTO_MANUAL,
    salvoEm: new Date().toISOString(),
    verificadoEm: new Date().toISOString(),
  }
  await gravarImagemSalva(registro)
  return respostaImagemSalva(registro)
}

export async function buscarImagemProduto(produtoOuCodigo, opcoes = {}) {
  const dados = typeof produtoOuCodigo === 'object' ? produtoOuCodigo : { codigoBarras: produtoOuCodigo }
  const c = String(dados.codigoBarras || '').replace(/\D/g, '').trim()
  if (!c) return null

  const salva = await lerImagemSalva(c)
  const aprovada = imagensAprovadas[c] || null
  const agora = Date.now()
  const cacheAtual =
    salva &&
    salva.tratamento === TRATAMENTO_PACKSHOT &&
    agora - new Date(salva.verificadoEm || salva.salvoEm || 0).getTime() < REVALIDAR_EMBALAGEM_MS

  if (salva && cacheAtual && !opcoes.forcarAtualizacao) return respostaImagemSalva(salva)

  const local = imagemLocalPorCodigo(c)
  if (local && aprovada && !opcoes.forcarAtualizacao) {
    const preparada = await prepararImagemLocal(c, dados, local, aprovada)
    if (preparada) return preparada
  }

  if (!opcoes.ignorarBackend) {
    const automatizado = await buscarProdutoAutomatizado(c, dados)
    if (automatizado?.foto) return automatizado.foto
  }

  const catalogo = await buscarProdutoCatalogo(c, {
    setor: dados.setor,
    baixarImagem: false,
    ignorarCache: true,
  })

  if (!catalogo?.imagemOriginal) {
    if (local) return prepararImagemLocal(c, dados, local, aprovada)
    return respostaImagemSalva(salva)
  }

  if (salva && salva.imagemOriginal === catalogo.imagemOriginal && !opcoes.forcarAtualizacao) {
    const confirmado = { ...salva, verificadoEm: new Date().toISOString() }
    await gravarImagemSalva(confirmado)
    return respostaImagemSalva(confirmado)
  }

  const imagem = await imagemParaDataURL(catalogo.imagemOriginal, { fundoBranco: true })
  if (!imagem) return respostaImagemSalva(salva)
  const permanente = String(imagem).startsWith('data:')
  const registro = {
    codigoBarras: c,
    imagem,
    marca: catalogo.marca,
    setor: catalogo.setor,
    origem: catalogo.origem,
    origemNome: catalogo.origemNome,
    imagemOriginal: catalogo.imagemOriginal,
    imagemFonteUrl: catalogo.imagemFonteUrl || catalogo.imagemOriginal,
    imagemPaginaUrl: catalogo.imagemPaginaUrl || null,
    imagemLargura: null,
    imagemAltura: null,
    imagemAprovada: false,
    correspondencia: catalogo.correspondencia,
    imagemAltaResolucao: catalogo.imagemAltaResolucao,
    imagemIlustrativa: false,
    tratamento: TRATAMENTO_PACKSHOT,
    salvoEm: new Date().toISOString(),
    verificadoEm: new Date().toISOString(),
  }
  if (permanente) await gravarImagemSalva(registro)
  return {
    ...respostaImagemSalva(registro),
    imagemCachePermanente: permanente,
  }
}

export function imagemProdutoPrecisaTratamento(produto) {
  if (!produto?.imagem) return false
  if (produto.imagemManual || produto.imagemTratamento === TRATAMENTO_MANUAL) return false
  const chave = String(produto.codigoBarras || produto.id || '').replace(/\s/g, '')
  const aprovada = imagensAprovadas[chave]
  if (aprovada && produto.imagemFonteUrl !== aprovada.imagemFonteUrl) return true
  return produto.imagemTratamento !== TRATAMENTO_PACKSHOT
}

export async function prepararProdutoParaJornal(produto) {
  const chave = String(produto.codigoBarras || produto.id || '').replace(/\s/g, '')
  if (!chave) return produto
  if (!imagemProdutoPrecisaTratamento(produto)) return produto

  const local = imagemLocalPorCodigo(chave)
  const aprovada = imagensAprovadas[chave] || null
  if (local && aprovada) {
    const preparada = await prepararImagemLocal(chave, produto, local, aprovada)
    if (preparada) return { ...produto, ...preparada }
  }

  const salva = await lerImagemSalva(chave)
  if (salva?.tratamento === TRATAMENTO_PACKSHOT) {
    return { ...produto, ...respostaImagemSalva(salva) }
  }

  const automatizado = await buscarProdutoAutomatizado(chave, produto)
  if (automatizado?.foto) return { ...produto, ...automatizado.foto }

  const fonteOriginal =
    local ||
    (String(produto.imagemOriginal || '').startsWith('http') ? produto.imagemOriginal : null) ||
    produto.imagem
  const imagem = await imagemParaDataURL(fonteOriginal, { fundoBranco: true })
  if (!String(imagem).startsWith('data:')) return produto
  const registro = {
    codigoBarras: chave,
    imagem,
    marca: produto.marca || '',
    setor: produto.setor || '',
    origem: produto.imagemOrigem || 'imagem-do-produto',
    origemNome: produto.imagemOrigemNome || 'Imagem cadastrada',
    imagemOriginal: produto.imagemOriginal || `cadastro:${chave}`,
    imagemFonteUrl: produto.imagemFonteUrl || produto.imagemOriginal || null,
    imagemPaginaUrl: produto.imagemPaginaUrl || null,
    imagemLargura: produto.imagemLargura || null,
    imagemAltura: produto.imagemAltura || null,
    imagemAprovada: Boolean(produto.imagemAprovada),
    correspondencia: produto.imagemCorrespondencia || 'codigo-exato',
    imagemAltaResolucao: true,
    imagemIlustrativa: false,
    tratamento: TRATAMENTO_PACKSHOT,
    salvoEm: new Date().toISOString(),
    verificadoEm: new Date().toISOString(),
  }
  await gravarImagemSalva(registro)
  return { ...produto, ...respostaImagemSalva(registro) }
}
