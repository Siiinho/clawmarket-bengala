// Integração com a EAN Images (https://developers.eanimages.com.br/docs).
// Roda no SERVIDOR (middleware do Vite no PC da loja ou função serverless):
// a chave nunca é enviada do navegador direto para a EAN Images.
//
// Fluxo por código de barras:
//  1. GET /v1/products/{ean}: grátis, devolve o que a conta já liberou.
//  2. Se a imagem (ou os dados) ainda não foram liberados: POST /v1/products/unlock.
//     Isso consome créditos (1 pela imagem, 1 por nome e descrição). Liberar de novo é grátis.
//  3. Baixa a imagem do link temporário (downloadUrl) e devolve como data URL,
//     para o app guardar no aparelho antes de o link expirar.

const BASE = 'https://api.eanimages.com.br/v1'

const MENSAGENS = {
  UNAUTHORIZED: 'Chave da EAN Images inválida ou revogada.',
  INSUFFICIENT_CREDITS: 'Sem créditos suficientes na EAN Images. Nada foi cobrado.',
  PLAN_QUOTA_EXCEEDED: 'A cota do plano da EAN Images acabou. Nada foi cobrado.',
  NOT_UNLOCKED: 'A imagem ainda não foi liberada nesta conta.',
  FORBIDDEN: 'Conta da EAN Images suspensa.',
  PRODUCT_NOT_FOUND: 'Produto não encontrado na EAN Images.',
  RATE_LIMITED: 'Muitas consultas seguidas na EAN Images. Tente de novo em instantes.',
  DAILY_QUOTA_EXCEEDED: 'Limite diário de consultas da EAN Images atingido.',
  INVALID_EAN: 'Código de barras inválido.',
}

export class ErroEanImages extends Error {
  constructor(status, codigo, mensagem) {
    super(MENSAGENS[codigo] || mensagem || `Erro ${status} na EAN Images.`)
    this.status = status
    this.codigo = codigo || 'ERRO'
  }
}

async function chamar(caminho, chave, opcoes = {}, ms = 15000) {
  const ctrl = new AbortController()
  const t = setTimeout(() => ctrl.abort(), ms)
  try {
    const r = await fetch(`${BASE}${caminho}`, {
      ...opcoes,
      signal: ctrl.signal,
      headers: {
        Accept: 'application/json',
        ...(opcoes.body ? { 'Content-Type': 'application/json' } : {}),
        ...(chave ? { Authorization: `Bearer ${chave}` } : {}),
      },
    })
    const corpo = await r.json().catch(() => null)
    if (!r.ok) throw new ErroEanImages(r.status, corpo?.error?.code, corpo?.error?.message)
    return corpo
  } catch (erro) {
    if (erro instanceof ErroEanImages) throw erro
    throw new ErroEanImages(502, 'SEM_CONEXAO', 'Não foi possível conectar à EAN Images. Verifique a internet deste computador e tente de novo.')
  } finally {
    clearTimeout(t)
  }
}

async function baixarComoDataUrl(url) {
  const r = await fetch(url)
  if (!r.ok) throw new ErroEanImages(r.status, 'DOWNLOAD', 'Não foi possível baixar a imagem liberada.')
  const tipo = r.headers.get('content-type') || 'image/jpeg'
  const bytes = Buffer.from(await r.arrayBuffer())
  return `data:${tipo};base64,${bytes.toString('base64')}`
}

export const codigoValido = (ean) => /^\d{8,14}$/.test(String(ean || ''))

export async function buscarProdutoEanImages(ean, chave, { comDados = true } = {}) {
  if (!chave) throw new ErroEanImages(401, 'SEM_CHAVE', 'Chave da EAN Images não configurada no servidor (EANIMAGES_API_KEY no .env).')
  const c = String(ean || '').replace(/\D/g, '')
  if (!codigoValido(c)) throw new ErroEanImages(400, 'INVALID_EAN')

  let produto = null
  try {
    produto = await chamar(`/products/${c}`, chave)
  } catch (erro) {
    if (erro.status !== 404 && erro.status !== 403) throw erro
  }

  const faltaImagem = !(produto?.image?.unlocked && produto?.image?.downloadUrl)
  const faltaDados = comDados && !produto?.data?.unlocked
  let creditosCobrados = 0
  let saldo = null
  let teste = false

  if (faltaImagem || faltaDados) {
    const include = [faltaImagem ? 'image' : null, faltaDados ? 'data' : null].filter(Boolean)
    const liberado = await chamar('/products/unlock', chave, {
      method: 'POST',
      body: JSON.stringify({ eans: [c], include }),
    })
    const item = (liberado?.items || []).find((i) => String(i.ean).replace(/^0+/, '') === c.replace(/^0+/, '')) || liberado?.items?.[0]
    creditosCobrados = Number(liberado?.creditsCharged) || 0
    saldo = liberado?.balance ?? null
    teste = Boolean(liberado?.test)
    if (item) {
      produto = {
        ...(produto || {}),
        ...item,
        image: item.image?.downloadUrl ? item.image : (produto?.image || item.image),
        data: item.data?.unlocked ? item.data : (produto?.data || item.data),
      }
    }
  }

  if (!produto || produto.found === false) {
    return { encontrado: false, codigoBarras: c, creditosCobrados, saldo, teste }
  }

  const imagem = produto.image?.downloadUrl ? await baixarComoDataUrl(produto.image.downloadUrl) : null
  return {
    encontrado: Boolean(imagem || produto.data?.name),
    codigoBarras: c,
    nome: produto.data?.name || null,
    descricao: produto.data?.descriptionText || null,
    imagem,
    creditosCobrados,
    saldo,
    teste,
  }
}

export async function consultarContaEanImages(chave) {
  if (!chave) throw new ErroEanImages(401, 'SEM_CHAVE', 'Informe a chave da EAN Images.')
  return chamar('/account', chave)
}

// Invólucro HTTP compartilhado pelo Vite (dev/preview) e pela função serverless.
// GET /api/eanimages?ean=789...   → { encontrado, nome, descricao, imagem }
// GET /api/eanimages?status=1     → { configurada } (só diz se há chave; nunca a mostra)
// A chave vem SOMENTE da variável de ambiente EANIMAGES_API_KEY (arquivo .env no PC
// ou variável da hospedagem). O navegador nunca recebe nem envia a chave.
// EANIMAGES_COM_DADOS=0 desliga nome/descrição (economiza 1 crédito por produto novo).
export async function responderEanImages(url) {
  const chave = process.env.EANIMAGES_API_KEY || ''
  const params = new URL(url, 'http://localhost').searchParams
  try {
    if (params.get('status')) return { status: 200, corpo: { configurada: Boolean(chave) } }
    const dados = await buscarProdutoEanImages(params.get('ean'), chave, { comDados: process.env.EANIMAGES_COM_DADOS !== '0' })
    const { saldo: _saldo, ...publico } = dados
    return { status: dados.encontrado ? 200 : 404, corpo: publico }
  } catch (erro) {
    return { status: erro.status || 502, corpo: { erro: erro.message, codigo: erro.codigo || 'ERRO' } }
  }
}
