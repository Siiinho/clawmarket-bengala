// Função serverless (estilo Vercel): /api/eanimages
// Em produção, configure a variável de ambiente EANIMAGES_API_KEY na hospedagem.
import { responderEanImages } from '../server/eanImages.js'

export default async function handler(req, res) {
  const { status, corpo } = await responderEanImages(req.url)
  res.setHeader('Cache-Control', 'no-store')
  res.status(status).json(corpo)
}
