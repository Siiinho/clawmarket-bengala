// Encarte digital publicado — o que a tag NFC abre.
//
// O app publica em dois lugares:
//   1. no servidor do PC do mercado (/api/encarte, ver server/encarteServidor.js),
//      que é o que os celulares dos clientes abrem pela tag NFC; e
//   2. neste aparelho (localStorage), como cópia de segurança se o servidor cair.
// A página pública lê do servidor e ouve /api/encarte/eventos: quando sai uma
// versão nova, ela troca sozinha, sem o cliente recarregar.
// Quando o Supabase for ligado, só este arquivo muda. A página pública não precisa mudar.
//
// Regra de negócio: a validade do produto NUNCA sai daqui. Só passam os campos
// que o cliente pode ver.
import { restaurarImagensSalvas } from './produtoApi'

const CHAVE = 'clawmarket:encarte-publicado:v1'
const CANAL = 'clawmarket-encarte'

const CAMPOS_PUBLICOS = [
  'id', 'nome', 'marca', 'gramagem', 'setor', 'codigoBarras', 'seloOferta',
  'unidade', 'precoNormal', 'precoJornal', 'descontoJornal', 'origemFila',
  'imagem', 'imagemCachePermanente', 'imagemTratamento',
]

const soPublico = (item) => {
  const limpo = {}
  for (const campo of CAMPOS_PUBLICOS) if (item[campo] !== undefined) limpo[campo] = item[campo]
  // fotos grandes em data: ficam no banco de imagens do aparelho; a página as restaura pelo código
  if (limpo.imagemCachePermanente && String(limpo.imagem || '').startsWith('data:')) limpo.imagem = null
  return limpo
}

export function publicarEncarte({ titulo, mercado, periodoDe, periodoAte, tema, layout, fundo, loja, itens }) {
  const encarte = {
    versao: Date.now(),
    publicadoEm: new Date().toISOString(),
    titulo,
    mercado,
    periodoDe,
    periodoAte,
    tema: tema || null,
    layout: layout || 'grade',
    fundo: fundo || null,
    loja: loja ? { nome: loja.nome, endereco: loja.endereco, cidade: loja.cidade, whatsapp: loja.whatsapp } : null,
    itens: (itens || []).map(soPublico),
  }
  try {
    localStorage.setItem(CHAVE, JSON.stringify(encarte))
  } catch (_) {
    // sem espaço: publica sem as fotos embutidas
    encarte.itens = encarte.itens.map((i) => (String(i.imagem || '').startsWith('data:') ? { ...i, imagem: null } : i))
    localStorage.setItem(CHAVE, JSON.stringify(encarte))
  }
  try {
    const canal = new BroadcastChannel(CANAL)
    canal.postMessage(encarte.versao)
    canal.close()
  } catch (_) {}
  return encarte
}

// ---------- servidor do encarte (o site da tag NFC) ----------
const API = '/api/encarte'
const CHAVE_SENHA = 'clawmarket:senha-publicacao'

export function lerSenhaPublicacao() {
  try { return localStorage.getItem(CHAVE_SENHA) || '' } catch (_) { return '' }
}
export function salvarSenhaPublicacao(senha) {
  try { senha ? localStorage.setItem(CHAVE_SENHA, senha) : localStorage.removeItem(CHAVE_SENHA) } catch (_) {}
}

const ehJson = (r) => (r.headers.get('content-type') || '').includes('application/json')

// { online, protegido } — se o servidor do encarte está no ar e se pede senha para publicar.
export async function statusSiteEncarte() {
  try {
    const r = await fetch(`${API}?status=1`, { cache: 'no-store' })
    if (!r.ok || !ehJson(r)) return { online: false, protegido: false }
    const j = await r.json()
    return { online: true, protegido: !!j.protegido, enderecos: Array.isArray(j.enderecos) ? j.enderecos : [] }
  } catch (_) {
    return { online: false, protegido: false }
  }
}

// Link que vai gravado na tag NFC. Aberto no próprio PC (localhost), troca pelo IP do PC na
// rede da loja, que é o endereço que o celular do cliente consegue abrir.
export function linkDoEncarte(enderecos = []) {
  const { protocol, hostname, port, pathname } = window.location
  const local = ['localhost', '127.0.0.1', '::1', '[::1]'].includes(hostname)
  const host = local && enderecos[0] ? `${enderecos[0]}${port ? `:${port}` : ''}` : window.location.host
  return `${protocol}//${host}${pathname}#/encarte`
}

// Manda o encarte (com as fotos) para o servidor. Devolve { versao, publicadoEm, itens }.
export async function enviarEncarteAoSite({ titulo, mercado, periodoDe, periodoAte, tema, layout, fundo, loja, itens }) {
  const comFotos = await restaurarImagensSalvas(itens || [])
  const corpo = {
    titulo, mercado, periodoDe, periodoAte, tema, layout, fundo: fundo || null,
    loja: loja ? { nome: loja.nome, endereco: loja.endereco, cidade: loja.cidade, whatsapp: loja.whatsapp } : null,
    itens: comFotos.map((item) => {
      const limpo = soPublico({ ...item, imagemCachePermanente: false })
      delete limpo.imagemCachePermanente
      delete limpo.imagemTratamento
      return limpo
    }),
  }
  const senha = lerSenhaPublicacao()
  let r
  try {
    r = await fetch(API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(senha ? { 'x-encarte-token': senha } : {}) },
      body: JSON.stringify(corpo),
    })
  } catch (_) {
    throw Object.assign(new Error('Servidor do encarte fora do ar. Abra o app pelo PC do mercado (npm run dev ou npm run preview).'), { codigo: 'offline' })
  }
  if (!ehJson(r)) throw Object.assign(new Error('Este endereço não tem o servidor do encarte. Abra o app pelo PC do mercado.'), { codigo: 'offline' })
  const j = await r.json()
  if (!r.ok) throw Object.assign(new Error(j.erro || 'Não foi possível publicar no site.'), { codigo: r.status === 401 ? 'senha' : 'erro' })
  return j
}

async function lerDoSite() {
  try {
    const r = await fetch(API, { cache: 'no-store' })
    if (!ehJson(r)) return undefined
    if (r.status === 404) return null
    if (!r.ok) return undefined
    return { ...(await r.json()), origem: 'site' }
  } catch (_) {
    return undefined // sem servidor (ex.: app aberto direto do arquivo)
  }
}

export function lerEncartePublicado() {
  try {
    return JSON.parse(localStorage.getItem(CHAVE) || 'null')
  } catch (_) {
    return null
  }
}

// Lê do servidor; se ele não responder (ou ainda não tiver nada), usa a cópia deste aparelho.
export async function carregarEncartePublicado() {
  const doSite = await lerDoSite()
  if (doSite) return doSite
  const encarte = lerEncartePublicado()
  if (!encarte) return null
  const itens = await restaurarImagensSalvas(encarte.itens || [])
  return { ...encarte, itens }
}

// Chama `aoMudar(versao?)` sempre que uma nova versão for publicada. Devolve a função de cancelar.
// No celular do cliente o aviso vem do servidor (Server-Sent Events). Se a conexão
// cair de vez, confere a cada 30 s. Neste aparelho também ouve o localStorage.
export function assinarEncarte(aoMudar) {
  const naChave = (evento) => { if (evento.key === CHAVE) aoMudar() }
  const aoVoltar = () => { if (document.visibilityState === 'visible') aoMudar() }
  window.addEventListener('storage', naChave)
  document.addEventListener('visibilitychange', aoVoltar)
  let canal = null
  try {
    canal = new BroadcastChannel(CANAL)
    canal.onmessage = () => aoMudar()
  } catch (_) {}
  let fonte = null
  try {
    fonte = new EventSource(`${API}/eventos`)
    fonte.addEventListener('versao', (e) => aoMudar(Number(e.data) || undefined))
  } catch (_) {}
  const reserva = setInterval(() => {
    if ((!fonte || fonte.readyState === 2) && document.visibilityState === 'visible') aoMudar()
  }, 30000)
  return () => {
    window.removeEventListener('storage', naChave)
    document.removeEventListener('visibilitychange', aoVoltar)
    canal?.close()
    fonte?.close()
    clearInterval(reserva)
  }
}

// Fundo do template por tema (imagem exportada do template SEM os produtos).
const chaveFundo = (temaId) => `clawmarket:fundo-template:${temaId}`
export function lerFundoTemplate(temaId) {
  try { return localStorage.getItem(chaveFundo(temaId)) || null } catch (_) { return null }
}
export function salvarFundoTemplate(temaId, dataUrl) {
  try {
    if (dataUrl) localStorage.setItem(chaveFundo(temaId), dataUrl)
    else localStorage.removeItem(chaveFundo(temaId))
    return true
  } catch (_) {
    return false
  }
}
// Reduz a imagem para 1080 × 1350 (formato do post) em JPEG, para caber no aparelho.
export function prepararFundoTemplate(arquivo) {
  return new Promise((resolve, reject) => {
    const leitor = new FileReader()
    leitor.onerror = () => reject(new Error('Não foi possível ler a imagem.'))
    leitor.onload = () => {
      const img = new Image()
      img.onerror = () => reject(new Error('Arquivo de imagem inválido.'))
      img.onload = () => {
        const canvas = document.createElement('canvas')
        canvas.width = 1080
        canvas.height = 1350
        const ctx = canvas.getContext('2d')
        const escala = Math.max(1080 / img.width, 1350 / img.height)
        const w = img.width * escala
        const h = img.height * escala
        ctx.drawImage(img, (1080 - w) / 2, (1350 - h) / 2, w, h)
        resolve(canvas.toDataURL('image/jpeg', 0.85))
      }
      img.src = leitor.result
    }
    leitor.readAsDataURL(arquivo)
  })
}
