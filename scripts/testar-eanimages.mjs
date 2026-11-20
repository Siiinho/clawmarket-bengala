// Teste rápido da EAN Images com a chave do arquivo .env (rode no PC do mercado):
//   npm run testar:eanimages                  -> só confere a chave e o saldo (não gasta crédito)
//   npm run testar:eanimages -- 7891000100103 -> busca o produto (pode gastar até 2 créditos na 1ª vez)
import { readFileSync, existsSync } from 'node:fs'
import { consultarContaEanImages, buscarProdutoEanImages } from '../server/eanImages.js'

if (existsSync('.env')) {
  for (const linha of readFileSync('.env', 'utf8').split(/\r?\n/)) {
    const m = linha.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, '')
  }
}
const chave = process.env.EANIMAGES_API_KEY
if (!chave) {
  console.error('Falta EANIMAGES_API_KEY no arquivo .env (veja .env.example).')
  process.exit(1)
}
try {
  const conta = await consultarContaEanImages(chave)
  console.log('Chave OK. Conta:', JSON.stringify(conta))
  const ean = process.argv[2]
  if (ean) {
    const r = await buscarProdutoEanImages(ean, chave, { comDados: process.env.EANIMAGES_COM_DADOS !== '0' })
    console.log(JSON.stringify({ ...r, imagem: r?.imagem ? `${r.imagem.slice(0, 40)}… (${r.imagem.length} caracteres)` : null }, null, 2))
  }
} catch (erro) {
  console.error('Falhou:', erro.status || '', erro.codigo || '', erro.message)
  process.exit(1)
}
