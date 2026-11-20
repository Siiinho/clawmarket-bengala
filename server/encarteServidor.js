// Servidor do encarte digital (o site que a tag NFC abre), rodando no PC do mercado
// junto com o app (Vite dev/preview). Guarda a última versão publicada em disco e avisa
// na hora todos os celulares com o link aberto (Server-Sent Events).
//
//   GET  /api/encarte                → encarte publicado (JSON) ou 404
//   GET  /api/encarte?status=1       → { protegido, enderecos? } — se pede senha e (só para o PC/rede
//                                      da loja) os IPs do PC na rede, para gravar na tag NFC
//   POST /api/encarte                → publica (só o app do mercado; ver "Quem pode publicar")
//   GET  /api/encarte/eventos        → fluxo SSE: manda a versão nova a cada publicação
//   GET  /api/encarte/img/<arquivo>  → fotos dos produtos e fundo do template
//
// Quem pode publicar: com ENCARTE_TOKEN no .env, só quem manda o cabeçalho
// x-encarte-token igual. Sem ENCARTE_TOKEN, só o próprio PC ou a rede local (e nunca
// pedidos que chegam por túnel/proxy, que trazem X-Forwarded-For).
//
// Regra de negócio: a validade do produto nunca é gravada aqui. O servidor também
// filtra os campos, para não depender só do app.
import { createHash, timingSafeEqual } from 'node:crypto'
import { promises as fs, createReadStream, existsSync } from 'node:fs'
import path from 'node:path'
import { networkInterfaces } from 'node:os'

const DIR = () => process.env.ENCARTE_DIR || path.join(process.cwd(), 'dados', 'encarte')
const ARQ = () => path.join(DIR(), 'encarte.json')
const DIR_IMG = () => path.join(DIR(), 'img')
const LIMITE_CORPO = 40 * 1024 * 1024

const CAMPOS_ITEM = ['id', 'nome', 'marca', 'gramagem', 'setor', 'codigoBarras', 'seloOferta', 'unidade', 'precoNormal', 'precoJornal', 'descontoJornal', 'origemFila', 'imagem']
const CAMPOS_LOJA = ['nome', 'endereco', 'cidade', 'whatsapp']
const TIPOS = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' }
const MIME = { jpg: 'image/jpeg', png: 'image/png', webp: 'image/webp' }

const ouvintes = new Set()
let cache = null

const texto = (v, max = 300) => (v === undefined || v === null ? undefined : String(v).slice(0, max))
const numero = (v) => (Number.isFinite(Number(v)) ? Number(v) : undefined)

// Fotos em data: viram arquivos (nome = hash do conteúdo), e o JSON guarda só o endereço.
async function guardarImagem(valor) {
  const s = String(valor || '')
  if (/^\/api\/encarte\/img\/[a-f0-9]{32}\.(jpg|png|webp)$/.test(s) || /^https?:\/\/[^\s"'<>]+$/.test(s)) return s
  // arquivos do próprio app (pasta public), sem subir de pasta
  if (/^(\.\/)?[\w-]+(\/[\w.-]+)*\.(png|jpe?g|webp|svg)$/i.test(s) && !s.includes('..')) return s
  const m = s.match(/^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/)
  if (!m) return null
  const bytes = Buffer.from(m[2], 'base64')
  if (!bytes.length || bytes.length > 8 * 1024 * 1024) return null
  const nome = `${createHash('sha256').update(bytes).digest('hex').slice(0, 32)}.${TIPOS[m[1]]}`
  const destino = path.join(DIR_IMG(), nome)
  if (!existsSync(destino)) await fs.writeFile(destino, bytes)
  return `/api/encarte/img/${nome}`
}

async function limparEncarte(corpo) {
  const itens = Array.isArray(corpo?.itens) ? corpo.itens.slice(0, 600) : []
  const limpos = []
  for (const item of itens) {
    const novo = {}
    for (const campo of CAMPOS_ITEM) {
      if (item?.[campo] === undefined) continue
      novo[campo] = ['precoNormal', 'precoJornal', 'descontoJornal'].includes(campo) ? numero(item[campo]) : texto(item[campo], campo === 'imagem' ? 12_000_000 : 300)
    }
    novo.imagem = item?.imagem ? await guardarImagem(item.imagem) : null
    limpos.push(novo)
  }
  const loja = corpo?.loja ? Object.fromEntries(CAMPOS_LOJA.map((c) => [c, texto(corpo.loja[c], 200)]).filter(([, v]) => v)) : null
  return {
    versao: Date.now(),
    publicadoEm: new Date().toISOString(),
    titulo: texto(corpo?.titulo, 200),
    mercado: texto(corpo?.mercado, 200),
    periodoDe: texto(corpo?.periodoDe, 10),
    periodoAte: texto(corpo?.periodoAte, 10),
    tema: texto(corpo?.tema, 60),
    layout: corpo?.layout === 'destaque' ? 'destaque' : 'grade',
    fundo: corpo?.fundo ? await guardarImagem(corpo.fundo) : null,
    loja,
    itens: limpos,
  }
}

export async function lerEncarteSalvo() {
  if (cache) return cache
  try {
    cache = JSON.parse(await fs.readFile(ARQ(), 'utf8'))
  } catch {
    cache = null
  }
  return cache
}

async function salvarEncarte(corpo) {
  await fs.mkdir(DIR_IMG(), { recursive: true })
  const encarte = await limparEncarte(corpo)
  const tmp = `${ARQ()}.${process.pid}.tmp`
  await fs.writeFile(tmp, JSON.stringify(encarte))
  await fs.rename(tmp, ARQ())
  cache = encarte
  for (const res of ouvintes) res.write(`event: versao\ndata: ${encarte.versao}\n\n`)
  return encarte
}

const ehRedeLocal = (ip) => {
  const a = String(ip || '').replace(/^::ffff:/, '')
  return a === '::1' || /^127\./.test(a) || /^10\./.test(a) || /^192\.168\./.test(a) || /^172\.(1[6-9]|2\d|3[01])\./.test(a) || /^f[cd][0-9a-f]{2}:/i.test(a) || /^fe80:/i.test(a)
}

// IPv4 do PC na rede da loja (Wi-Fi/cabo), para montar o link que vai na tag NFC.
const ipsDaRede = () => Object.values(networkInterfaces()).flat()
  .filter((i) => i && i.family === 'IPv4' && !i.internal && ehRedeLocal(i.address))
  .map((i) => i.address)

function podePublicar(req) {
  const token = process.env.ENCARTE_TOKEN
  if (token) {
    const enviado = Buffer.from(String(req.headers['x-encarte-token'] || ''))
    const certo = Buffer.from(token)
    return enviado.length === certo.length && timingSafeEqual(enviado, certo)
  }
  const veioDeProxy = req.headers['x-forwarded-for'] || req.headers['cf-connecting-ip'] || req.headers['x-real-ip'] || req.headers.forwarded
  return !veioDeProxy && ehRedeLocal(req.socket?.remoteAddress)
}

function lerCorpo(req) {
  return new Promise((resolve, reject) => {
    let tamanho = 0
    const partes = []
    req.on('data', (p) => {
      tamanho += p.length
      if (tamanho > LIMITE_CORPO) { reject(Object.assign(new Error('Encarte grande demais.'), { status: 413 })); req.destroy() } else partes.push(p)
    })
    req.on('end', () => {
      try { resolve(JSON.parse(Buffer.concat(partes).toString('utf8') || '{}')) } catch { reject(Object.assign(new Error('JSON inválido.'), { status: 400 })) }
    })
    req.on('error', reject)
  })
}

const json = (res, status, corpo) => {
  res.statusCode = status
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.setHeader('Cache-Control', 'no-store')
  res.end(JSON.stringify(corpo))
}

// Middleware no formato connect (Vite). `req.url` chega sem o prefixo /api/encarte.
export async function middlewareEncarte(req, res) {
  const url = new URL(req.url || '/', 'http://local')
  const rota = url.pathname.replace(/\/+$/, '') || '/'
  try {
    if (rota === '/eventos' && req.method === 'GET') {
      res.writeHead(200, { 'Content-Type': 'text/event-stream; charset=utf-8', 'Cache-Control': 'no-store', Connection: 'keep-alive', 'X-Accel-Buffering': 'no' })
      const atual = await lerEncarteSalvo()
      res.write(`retry: 5000\nevent: versao\ndata: ${atual?.versao || 0}\n\n`)
      ouvintes.add(res)
      const pulso = setInterval(() => res.write(': ok\n\n'), 25000)
      req.on('close', () => { clearInterval(pulso); ouvintes.delete(res) })
      return
    }
    if (rota.startsWith('/img/') && req.method === 'GET') {
      const nome = rota.slice(5)
      if (!/^[a-f0-9]{32}\.(jpg|png|webp)$/.test(nome)) return json(res, 404, { erro: 'Imagem não encontrada.' })
      const arquivo = path.join(DIR_IMG(), nome)
      if (!existsSync(arquivo)) return json(res, 404, { erro: 'Imagem não encontrada.' })
      res.writeHead(200, { 'Content-Type': MIME[nome.split('.').pop()], 'Cache-Control': 'public, max-age=31536000, immutable' })
      createReadStream(arquivo).pipe(res)
      return
    }
    if (rota === '/') {
      if (req.method === 'GET') {
        if (url.searchParams.get('status')) {
          const local = !req.headers['x-forwarded-for'] && ehRedeLocal(req.socket?.remoteAddress)
          return json(res, 200, { protegido: !!process.env.ENCARTE_TOKEN, ...(local ? { enderecos: ipsDaRede() } : {}) })
        }
        const encarte = await lerEncarteSalvo()
        return encarte ? json(res, 200, encarte) : json(res, 404, { vazio: true })
      }
      if (req.method === 'POST') {
        if (!podePublicar(req)) return json(res, 401, { erro: process.env.ENCARTE_TOKEN ? 'Senha de publicação inválida.' : 'Só o computador do mercado pode publicar.' })
        const encarte = await salvarEncarte(await lerCorpo(req))
        return json(res, 200, { ok: true, versao: encarte.versao, publicadoEm: encarte.publicadoEm, itens: encarte.itens.length })
      }
    }
    return json(res, 404, { erro: 'Rota não encontrada.' })
  } catch (erro) {
    return json(res, erro.status || 500, { erro: erro.status ? erro.message : 'Não foi possível salvar o encarte.' })
  }
}
