// Lado do app da integração EAN Images.
// O app NÃO conhece a chave: ele só chama o servidor do próprio ClawMarket
// (/api/eanimages), que lê EANIMAGES_API_KEY do arquivo .env e fala com a EAN Images.

// Devolve { encontrado, nome, descricao, imagem (data URL), creditosCobrados, saldo } ou null.
export async function buscarNaEanImages(codigo) {
  if (typeof fetch !== 'function' || globalThis.location?.protocol === 'file:') return null
  const c = String(codigo || '').replace(/\D/g, '')
  if (!c) return null
  try {
    const r = await fetch(`/api/eanimages?ean=${encodeURIComponent(c)}`, { headers: { Accept: 'application/json' } })
    if (!(r.headers.get('content-type') || '').includes('application/json')) return null
    const json = await r.json()
    if (!r.ok) return { encontrado: false, erro: json?.erro, codigo: json?.codigo }
    return json
  } catch (_) {
    return null
  }
}
