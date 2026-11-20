import html2canvas from 'html2canvas-pro'
import jsPDF from 'jspdf'

const proximoFrame = () => new Promise((resolve) => requestAnimationFrame(resolve))
const LIMITE_PIXELS_CANVAS = 24_000_000
const ESCALA_IMPRESSAO = 5

async function aguardarImagem(img) {
  if (img.complete && img.naturalWidth > 0) return

  try {
    if (typeof img.decode === 'function') {
      await Promise.race([
        img.decode(),
        new Promise((resolve) => setTimeout(resolve, 8000)),
      ])
      return
    }
  } catch {
    // O evento load/error abaixo ainda permite que a exportação continue.
  }

  await Promise.race([
    new Promise((resolve) => {
      img.addEventListener('load', resolve, { once: true })
      img.addEventListener('error', resolve, { once: true })
    }),
    new Promise((resolve) => setTimeout(resolve, 8000)),
  ])
}

async function aguardarRecursos(el) {
  if (document.fonts?.ready) await document.fonts.ready
  await Promise.all([...el.querySelectorAll('img')].map(aguardarImagem))
  const imagemComFalha = [...el.querySelectorAll('img')].find((img) => !img.complete || img.naturalWidth <= 0)
  if (imagemComFalha) {
    throw new Error(`A imagem "${imagemComFalha.alt || 'do produto'}" não terminou de carregar.`)
  }
  await proximoFrame()
  await proximoFrame()
}

async function captura(el, { escala } = {}) {
  if (!el || !el.isConnected) {
    throw new Error('A página do jornal ainda não está pronta. Aguarde a prévia aparecer e tente novamente.')
  }

  if (!el.offsetWidth || !el.offsetHeight) {
    throw new Error('A prévia do jornal está vazia. Adicione um produto antes de exportar.')
  }

  await aguardarRecursos(el)

  let ultimoErro
  // Usa as dimensões reais do modelo. scrollWidth/scrollHeight podem incluir
  // conteúdo responsivo e alterar a proporção da página durante a captura.
  const retangulo = el.getBoundingClientRect()
  const largura = Math.max(1, Math.round(retangulo.width || el.offsetWidth))
  const altura = Math.max(1, Math.round(retangulo.height || el.offsetHeight))
  const escalaSegura = Math.sqrt(LIMITE_PIXELS_CANVAS / Math.max(largura * altura, 1))
  const escalas = escala ? [escala, Math.min(escala, 2), 1].filter((v, i, l) => l.indexOf(v) === i) : [...new Set([
    Math.min(ESCALA_IMPRESSAO, escalaSegura),
    Math.min(4, escalaSegura),
    Math.min(3, escalaSegura),
    Math.min(2, escalaSegura),
  ])]
    .filter((scale) => Number.isFinite(scale) && scale >= 1)
  // `escala` fixa: artes de rede social saem no tamanho exato do formato (1080 px etc.).

  // A segunda tentativa, mais leve, permite exportar também em coletores e
  // celulares com pouca memória sem reduzir a qualidade nos aparelhos comuns.
  for (const scale of escalas.length ? escalas : [1]) {
    try {
      return await html2canvas(el, {
        scale,
        width: largura,
        height: altura,
        windowWidth: Math.max(document.documentElement.clientWidth, largura),
        windowHeight: Math.max(document.documentElement.clientHeight, altura),
        useCORS: true,
        allowTaint: false,
        backgroundColor: '#ffffff',
        imageTimeout: 15000,
        logging: false,
        removeContainer: true,
      })
    } catch (erro) {
      ultimoErro = erro
    }
  }

  console.error('Falha ao capturar a página do jornal:', ultimoErro)
  const detalhe = String(ultimoErro?.message || '')
  if (/unsupported color function/i.test(detalhe)) {
    throw new Error('O modelo usa uma cor incompatível com o gerador de PDF. Atualize a página e tente novamente.')
  }
  throw new Error('Não foi possível preparar o jornal. Feche outros aplicativos e tente novamente.')
}

function canvasParaBlob(canvas, tipo, qualidade) {
  if (typeof canvas.toBlob !== 'function') {
    const dataUrl = canvas.toDataURL(tipo, qualidade)
    const [cabecalho, base64] = dataUrl.split(',')
    const mime = cabecalho.match(/data:([^;]+)/)?.[1] || tipo
    const binario = atob(base64)
    const bytes = new Uint8Array(binario.length)
    for (let i = 0; i < binario.length; i += 1) bytes[i] = binario.charCodeAt(i)
    return Promise.resolve(new Blob([bytes], { type: mime }))
  }
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => blob ? resolve(blob) : reject(new Error('Não foi possível criar o arquivo.')),
      tipo,
      qualidade
    )
  })
}

function blobParaBytes(blob) {
  if (typeof blob.arrayBuffer === 'function') {
    return blob.arrayBuffer().then((buffer) => new Uint8Array(buffer))
  }
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(new Uint8Array(reader.result))
    reader.onerror = () => reject(reader.error || new Error('Não foi possível ler a página do PDF.'))
    reader.readAsArrayBuffer(blob)
  })
}

function oferecerArquivo(blob, nome) {
  if (!(blob instanceof Blob) || blob.size < 100 || blob.type !== 'application/pdf' && !nome.endsWith('.png')) {
    throw new Error('O arquivo gerado ficou inválido. Atualize a página e tente novamente.')
  }

  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = nome
  link.target = '_blank'
  link.rel = 'noopener'
  link.style.display = 'none'
  document.body.appendChild(link)
  link.click()
  link.remove()

  // A URL continua ativa para o botão manual "Abrir/baixar". Quem chama
  // esta função deve revogá-la quando gerar outro arquivo ou sair da tela.
  return { blob, url, nome }
}

export async function exportarPNG(el, nome = 'cartaz', opcoes) {
  const blob = await gerarPNG(el, opcoes)
  return oferecerArquivo(blob, `${nome}.png`)
}

// Gera o PNG sem baixar (para compartilhar pelo celular no WhatsApp/Instagram).
export async function gerarPNG(el, opcoes) {
  const canvas = await captura(el, opcoes)
  try {
    return await canvasParaBlob(canvas, 'image/png')
  } finally {
    canvas.width = 1
    canvas.height = 1
  }
}

export async function exportarPDF(el, nome = 'jornal') {
  const canvas = await captura(el)
  try {
    const blobPagina = await canvasParaBlob(canvas, 'image/png')
    const bytesPagina = await blobParaBytes(blobPagina)
    const orientacao = canvas.width > canvas.height ? 'l' : 'p'
    const pdf = new jsPDF({ orientation: orientacao, unit: 'mm', format: 'a4', compress: true })
    const larguraA4 = orientacao === 'l' ? 297 : 210
    const alturaA4 = orientacao === 'l' ? 210 : 297
    const escala = Math.min(larguraA4 / canvas.width, alturaA4 / canvas.height)
    const largura = canvas.width * escala
    const altura = canvas.height * escala
    pdf.addImage(bytesPagina, 'PNG', (larguraA4 - largura) / 2, (alturaA4 - altura) / 2, largura, altura, undefined, 'SLOW')
    return oferecerArquivo(pdf.output('blob'), `${nome}.pdf`)
  } finally {
    canvas.width = 1
    canvas.height = 1
  }
}

export async function exportarPDFPaginas(elementos, nome = 'jornal') {
  const paginas = elementos.filter(Boolean)
  if (!paginas.length) throw new Error('Nenhuma página pronta para exportar.')

  let pdf
  for (let i = 0; i < paginas.length; i += 1) {
    const canvas = await captura(paginas[i])
    try {
      const larguraCanvas = canvas.width
      const alturaCanvas = canvas.height
      const orientacao = larguraCanvas > alturaCanvas ? 'l' : 'p'
      const larguraA4 = orientacao === 'l' ? 297 : 210
      const alturaA4 = orientacao === 'l' ? 210 : 297
      // PNG evita os artefatos e o texto borrado introduzidos pela compressão
      // JPEG. A captura em alta resolução permanece nítida na impressão A4.
      const blobPagina = await canvasParaBlob(canvas, 'image/png')
      const bytesPagina = await blobParaBytes(blobPagina)
      const escalaA4 = Math.min(larguraA4 / larguraCanvas, alturaA4 / alturaCanvas)
      const largura = larguraCanvas * escalaA4
      const altura = alturaCanvas * escalaA4
      const x = (larguraA4 - largura) / 2
      const y = (alturaA4 - altura) / 2

      if (!pdf) pdf = new jsPDF({ orientation: orientacao, unit: 'mm', format: 'a4', compress: true })
      else pdf.addPage('a4', orientacao)
      pdf.addImage(bytesPagina, 'PNG', x, y, largura, altura, undefined, 'SLOW')
    } finally {
      // Libera os pixels mesmo quando uma página falha no meio da exportação.
      canvas.width = 1
      canvas.height = 1
    }
  }
  return oferecerArquivo(pdf.output('blob'), `${nome}.pdf`)
}

export function abrirJanelaPrevisualizacao(titulo = 'Pré-visualização do jornal') {
  const janela = window.open('', '_blank')
  if (!janela) throw new Error('O navegador bloqueou a pré-visualização. Permita pop-ups para este site.')
  janela.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${String(titulo).replace(/[<>&"]/g, '')}</title></head><body style="font-family:Arial,sans-serif;padding:32px;text-align:center">Preparando pré-visualização…</body></html>`)
  janela.document.close()
  return janela
}

// Abre páginas já renderizadas em uma aba limpa e aciona a impressão nativa.
// O navegador oferece tamanho do papel, margens, escala e "Salvar como PDF".
export async function previsualizarImpressaoPaginas(elementos, titulo = 'Jornal de ofertas', janelaExistente = null) {
  const paginas = elementos.filter(Boolean)
  if (!paginas.length) throw new Error('Nenhuma página pronta para visualizar.')
  const janela = janelaExistente || abrirJanelaPrevisualizacao(titulo)
  const imagens = []

  try {
    for (const pagina of paginas) {
      const canvas = await captura(pagina)
      try {
        imagens.push(canvas.toDataURL('image/png'))
      } finally {
        canvas.width = 1
        canvas.height = 1
      }
    }

    const tituloSeguro = String(titulo).replace(/[<>&"]/g, '')
    janela.document.open()
    janela.document.write(`<!doctype html>
      <html lang="pt-BR">
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width,initial-scale=1">
          <title>${tituloSeguro}</title>
          <style>
            @page { size: A4 portrait; margin: 0; }
            * { box-sizing: border-box; }
            html, body { margin: 0; background: #e8eaed; font-family: Arial, sans-serif; }
            .toolbar { position: sticky; top: 0; z-index: 2; display: flex; align-items: center; justify-content: center; gap: 12px; padding: 12px; color: #fff; background: #082b4f; box-shadow: 0 2px 10px #0003; }
            .toolbar button { cursor: pointer; border: 0; border-radius: 8px; padding: 10px 16px; color: #fff; background: #e4232e; font-weight: 700; }
            .paginas { display: grid; gap: 20px; justify-content: center; padding: 24px; }
            .pagina { display: block; width: 210mm; height: 297mm; object-fit: contain; background: #fff; box-shadow: 0 8px 28px #0003; }
            @media print {
              html, body { background: #fff; }
              .toolbar { display: none !important; }
              .paginas { display: block; padding: 0; }
              .pagina { width: 210mm; height: 297mm; box-shadow: none; break-after: page; page-break-after: always; }
              .pagina:last-child { break-after: auto; page-break-after: auto; }
            }
          </style>
        </head>
        <body>
          <div class="toolbar"><strong>${tituloSeguro}</strong><button type="button" onclick="window.print()">Imprimir / Salvar como PDF</button></div>
          <main class="paginas">${imagens.map((src, indice) => `<img class="pagina" src="${src}" alt="Página ${indice + 1}">`).join('')}</main>
          <script>
            Promise.all(Array.from(document.images).map((img) => img.complete ? Promise.resolve() : new Promise((ok) => { img.onload = img.onerror = ok })))
              .then(() => setTimeout(() => { window.focus(); window.print(); }, 250));
          <\/script>
        </body>
      </html>`)
    janela.document.close()
    return janela
  } catch (erro) {
    try { janela.close() } catch (_) {}
    throw erro
  }
}
