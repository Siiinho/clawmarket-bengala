import { useState, useRef, useEffect, forwardRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStore } from '../store/StoreContext'
import { Icon, ProdutoThumb, EmptyState, Botao, PrecoVarejo, Campo, inputCls, Pill, Logo, SeloDesconto, Modal } from '../components/ui'
import ScannerJornal from '../components/ScannerJornal'
import {
  SETORES, setorById, statusValidade, diasParaVencer, formatBRL, formatData,
  percentDesc, dataISOmaisDias, diaSemana, labelDias,
} from '../lib/utils'
import { abrirJanelaPrevisualizacao, previsualizarImpressaoPaginas } from '../lib/exportar'
import { imagemProdutoPrecisaTratamento, prepararProdutoParaJornal } from '../lib/produtoApi'

const PRODUTOS_POR_PAGINA = 4
const CORES_BENGALA = { primaria: '#e4232e', secundaria: '#082b4f', destaque: '#ffc928' }
const assetPublico = (caminho) => `${import.meta.env.BASE_URL || '/'}${String(caminho).replace(/^\/+/, '')}`
const CABECALHO_INTERNO = assetPublico('templates/cabecalho-ofertas-internas-bengala-v2.png')
const RODAPE_OFICIAL = assetPublico('templates/rodape-oficial-bengala.png')
const TEMPLATE_GERAL = assetPublico('templates/setores/oportunidades-bengala-geral.png')

function imagemCompativelComPDF(src) {
  if (!src || typeof src !== 'string') return false
  if (src.startsWith('data:') || src.startsWith('blob:')) return true
  try {
    return new URL(src, window.location.href).origin === window.location.origin
  } catch {
    return false
  }
}

function paginar(itens, tamanho = PRODUTOS_POR_PAGINA) {
  const paginas = []
  for (let i = 0; i < itens.length; i += tamanho) paginas.push(itens.slice(i, i + tamanho))
  return paginas.length ? paginas : [[]]
}

function estiloNomeCompleto(nome, tamanhoBase = 7, tamanhoMinimo = 4.8) {
  const excesso = Math.max(0, String(nome || '').length - 28)
  return {
    fontSize: `${Math.max(tamanhoMinimo, tamanhoBase - excesso * 0.055)}px`,
    lineHeight: 1.08,
    overflowWrap: 'anywhere',
    wordBreak: 'break-word',
  }
}

function nomeLado(indice) {
  const folha = Math.floor(indice / 2) + 1
  const lado = indice % 2 === 0 ? 'Frente' : 'Verso'
  return `Folha ${folha} · ${lado}`
}

function slugArquivo(texto) {
  return String(texto || 'mercado').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}

const TEMAS = {
  diaB: { nome: 'Dia B', cor: '#e23a2e', selo: 'ESPECIAL · DIA B', sub: 'Válido AMANHÃ', acento: '#f47b36' },
  copa: { nome: 'Copa', cor: '#1c6e48', selo: 'ESQUENTA DA COPA', sub: 'Ofertas da seleção', acento: '#ffd23f' },
  feijoada: { nome: 'Festival da Feijoada', cor: '#7c2230', selo: 'FESTIVAL DA FEIJOADA', sub: 'Sabor de casa', acento: '#f2a93b' },
  junina: { nome: 'Festa Junina', cor: '#d9641f', selo: 'ARRAIÁ BENGALA', sub: 'É chegada a quadrilha', acento: '#ffd23f' },
}

const TEMPLATE_SETOR = {
  padaria: assetPublico('templates/setores/oportunidades-bengala-padaria.png'),
  laticinios: assetPublico('templates/setores/oportunidades-bengala-laticinios.png'),
  frios: assetPublico('templates/setores/oportunidades-bengala-frios.png'),
  hortifruti: assetPublico('templates/setores/oportunidades-bengala-hortifruti.png'),
  bebidas: assetPublico('templates/setores/oportunidades-bengala-bebidas.png'),
  mercearia: assetPublico('templates/setores/oportunidades-bengala-mercearia.png'),
  limpeza: assetPublico('templates/setores/oportunidades-bengala-limpeza.png'),
  congelados: assetPublico('templates/setores/oportunidades-bengala-congelados.png'),
  petshop: assetPublico('templates/setores/oportunidades-bengala-pet-shop.png'),
}

export default function Jornal() {
  const navigate = useNavigate()
  const store = useStore()
  const { fila, config, jornais, jornalOficial, ofertaDoProduto, salvarProduto, salvarJornal, excluirJornal, removerDaFila, atualizarJornalOficial, toast } = store
  const [aba, setAba] = useState('gerar')

  // ---- config de geração ----
  const [tipo, setTipo] = useState('geral') // setor | geral | sazonal
  const [setorSel, setSetorSel] = useState('frios')
  const [temaSel, setTemaSel] = useState('diaB')
  const [titulo, setTitulo] = useState('Jornal de Ofertas - Bengala Supermercado')
  const [excluidos, setExcluidos] = useState(() => new Set())
  const [exportando, setExportando] = useState(false)
  const [pdfPronto, setPdfPronto] = useState(null)
  const [mostrarRevisao, setMostrarRevisao] = useState(false)
  const pageRefs = useRef([])
  const historicoRefs = useRef([])
  const revisaoRef = useRef(null)
  const ref = useRef(null)
  const [historicoParaAbrir, setHistoricoParaAbrir] = useState(null)
  const [produtoEditandoGerador, setProdutoEditandoGerador] = useState(null)

  const tema = TEMAS[temaSel]

  // Garante que nenhuma fotografia crua de celular chegue à arte final.
  useEffect(() => {
    let ativo = true
    const pendentes = fila.filter(imagemProdutoPrecisaTratamento)
    if (!pendentes.length) return () => { ativo = false }
    ;(async () => {
      for (const produto of pendentes) {
        const preparado = await prepararProdutoParaJornal(produto)
        if (!ativo) return
        if (preparado.imagemTratada) salvarProduto(preparado)
      }
    })()
    return () => { ativo = false }
  }, [fila, salvarProduto])

  useEffect(() => {
    if (!historicoParaAbrir) return
    let ativo = true
    const timer = requestAnimationFrame(async () => {
      try {
        const paginas = historicoRefs.current.slice(0, paginar(historicoParaAbrir.jornal.produtos || []).length)
        await previsualizarImpressaoPaginas(paginas, historicoParaAbrir.jornal.titulo, historicoParaAbrir.janela)
      } catch (erro) {
        if (ativo) toast(erro?.message || 'Não foi possível abrir o jornal salvo.', 'erro')
      } finally {
        if (ativo) setHistoricoParaAbrir(null)
      }
    })
    return () => { ativo = false; cancelAnimationFrame(timer) }
  }, [historicoParaAbrir, toast])

  // ---- preço para o jornal ----
  const precoJornal = (p) => {
    const o = ofertaDoProduto(p.id)
    if (o) return p.precoNormal * (1 - o.desconto / 100)
    if (p.precoPromo) return p.precoPromo
    if (p.origemFila === 'vencimento') return p.precoNormal * (1 - (config.descontoPadrao || 30) / 100)
    return p.precoNormal
  }
  const descJornal = (p) => percentDesc(p.precoNormal, precoJornal(p))

  const incluir = (id) => !excluidos.has(id)
  const toggleIncluir = (id) =>
    setExcluidos((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n })

  // ---- montagem do conteúdo ----
  const ativos = fila.filter((p) => incluir(p.id))
  const ativosDoModelo = tipo === 'setor' ? ativos.filter((p) => p.setor === setorSel) : ativos
  const vencimento = ativosDoModelo.filter((p) => p.origemFila === 'vencimento')
  const regulares = ativosDoModelo.filter((p) => p.origemFila !== 'vencimento')
  const selo = tipo === 'sazonal' ? tema.selo : tipo === 'setor' ? setorById(setorSel).nome.toUpperCase() : 'PRODUTOS VARIADOS'

  // validade AUTOMÁTICA: do hoje até a última validade dos produtos do jornal
  const itensJornal = [...vencimento, ...regulares].sort(
    (a, b) => diasParaVencer(a.validade) - diasParaVencer(b.validade)
  )
  const paginasJornal = paginar(itensJornal)
  const bandas = []
  const validadeDe = dataISOmaisDias(0)
  const validadesPublicaveis = itensJornal
    .map((p) => p.validade)
    .filter((validade) => validade && diasParaVencer(validade) >= 0)
    .sort()
  const validadeAte = validadesPublicaveis.length
    ? validadesPublicaveis[validadesPublicaveis.length - 1]
    : validadeDe
  const codigosRepetidos = new Set(
    itensJornal
      .map((p) => p.codigoBarras)
      .filter((codigo, indice, lista) => codigo && lista.indexOf(codigo) !== indice)
  )
  const problemasPDF = [
    ...itensJornal.filter((p) => !p.nome?.trim()).map(() => ({ nivel: 'erro', texto: 'Existe um produto sem nome.' })),
    ...itensJornal.filter((p) => !(Number(p.precoNormal) > 0)).map((p) => ({ nivel: 'erro', texto: `${p.nome}: informe um preço válido.` })),
    ...itensJornal.filter((p) => !p.validade).map((p) => ({ nivel: 'aviso', texto: `${p.nome}: validade não informada.` })),
    ...itensJornal.filter((p) => p.validade && diasParaVencer(p.validade) < 0).map((p) => ({ nivel: 'aviso', texto: `${p.nome}: a validade informada já passou.` })),
    ...itensJornal.filter((p) => !p.imagem).map((p) => ({ nivel: 'aviso', texto: `${p.nome}: será publicado sem imagem.` })),
    ...itensJornal.filter((p) => p.imagem && !imagemCompativelComPDF(p.imagem)).map((p) => ({ nivel: 'aviso', texto: `${p.nome}: a imagem pode não aparecer na impressão.` })),
    ...itensJornal.filter((p) => p.imagem && imagemProdutoPrecisaTratamento(p)).map((p) => ({ nivel: 'aviso', texto: `${p.nome}: imagem ainda não foi padronizada; a exportação está liberada.` })),
    ...itensJornal.filter((p) => p.imagem && p.imagemAltaResolucao === false).map((p) => ({ nivel: 'aviso', texto: `${p.nome}: imagem com resolução baixa; a exportação está liberada.` })),
    ...[...codigosRepetidos].map((codigo) => ({ nivel: 'aviso', texto: `Código ${codigo} aparece mais de uma vez no jornal.` })),
  ]
  const bloqueiosPDF = problemasPDF.filter((p) => p.nivel === 'erro')

  const aplicarDiaB = () => {
    setTipo('sazonal'); setTemaSel('diaB')
    setTitulo('Jornal de Ofertas — DIA B')
    toast('Modelo Dia B aplicado.')
  }

  const criarSnapshot = () => ({
    titulo,
    tipo,
    tema: tipo === 'sazonal' ? temaSel : null,
    setor: tipo === 'setor' ? setorSel : null,
    validadeDe,
    validadeAte,
    totalItens: itensJornal.length,
    totalPaginas: paginasJornal.length,
    produtos: itensJornal.map((produto) => ({
      ...produto,
      precoJornalCalculado: precoJornal(produto),
      descontoJornalCalculado: descJornal(produto),
    })),
  })

  const exportar = async () => {
    setMostrarRevisao(true)
    if (bloqueiosPDF.length) {
      requestAnimationFrame(() => revisaoRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }))
      const primeiraPendencia = bloqueiosPDF[0].texto
      toast(`PDF não gerado: ${primeiraPendencia} Corrija ou retire o produto da fila.`, 'erro')
      return
    }
    setExportando(true)
    setPdfPronto(null)
    let janela
    try {
      janela = abrirJanelaPrevisualizacao(titulo)
      salvarJornal(criarSnapshot())
      await previsualizarImpressaoPaginas(pageRefs.current.slice(0, paginasJornal.length), titulo, janela)
      setPdfPronto({ titulo, paginas: paginasJornal.length })
      toast('Pré-visualização aberta. Use Imprimir ou Salvar como PDF.')
    } catch (e) {
      console.error('Erro ao exportar o jornal:', e)
      toast(e?.message || 'Não foi possível exportar o PDF. Recarregue a página e tente novamente.', 'erro')
    } finally {
      setExportando(false)
    }
  }

  const salvar = () => {
    if (!itensJornal.length) return toast('Adicione ao menos um produto ao jornal.', 'erro')
    salvarJornal(criarSnapshot())
    toast('Jornal salvo no histórico!')
  }

  const abrirJornalSalvo = (jornal) => {
    const janela = abrirJanelaPrevisualizacao(jornal.titulo)
    setHistoricoParaAbrir({ jornal, janela })
  }

  const salvarProdutoGerador = () => {
    if (!produtoEditandoGerador?.nome?.trim()) return toast('Informe o nome do produto.', 'erro')
    if (!(Number(produtoEditandoGerador.precoNormal) > 0)) return toast('Informe um preço válido.', 'erro')
    salvarProduto({
      ...produtoEditandoGerador,
      estoque: Math.max(0, Number(produtoEditandoGerador.estoque) || 0),
      precoNormal: Number(produtoEditandoGerador.precoNormal),
      precoPromo: produtoEditandoGerador.precoPromo ? Number(produtoEditandoGerador.precoPromo) : null,
      naFila: true,
    })
    setProdutoEditandoGerador(null)
    toast('Produto atualizado no jornal!')
  }

  const trocarImagemProdutoGerador = (arquivo) => {
    if (!arquivo) return
    const leitor = new FileReader()
    leitor.onload = () => setProdutoEditandoGerador((produto) => ({
      ...produto,
      imagem: String(leitor.result || ''),
      imagemManual: true,
      imagemTratada: true,
      imagemTratamento: 'imagem-manual-livre-v1',
      imagemAltaResolucao: null,
      imagemOrigem: 'upload-manual',
    }))
    leitor.onerror = () => toast('Não foi possível ler a imagem.', 'erro')
    leitor.readAsDataURL(arquivo)
  }

  const Tab = ({ id, icone, children, badge }) => (
    <button onClick={() => setAba(id)} className={`flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-medium transition ${aba === id ? 'border-bengala text-bengala' : 'border-transparent text-ink-soft hover:text-ink'}`}>
      <Icon name={icone} size={16} /> {children}
      {badge > 0 && <span className="rounded-full bg-coral px-1.5 text-xs font-bold text-white">{badge}</span>}
    </button>
  )
  const PaginaModelo = PaginaJornalModeloAprovado

  return (
    <div className="space-y-5">
      <div className="overflow-hidden rounded-2xl bg-white shadow-sm">
        <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-bengala text-white">
            <Icon name="Newspaper" size={24} />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="text-xl font-bold text-ink">Monte o jornal em 3 passos</h2>
            <p className="mt-0.5 text-sm text-ink-soft">Escolha o modelo, bipe os produtos e baixe o jornal pronto.</p>
          </div>
          <Botao onClick={() => document.getElementById('scanner-jornal')?.scrollIntoView({ behavior: 'smooth', block: 'start' })} className="shrink-0">
            <Icon name="ScanLine" size={17} /> Começar a escanear
          </Botao>
        </div>
        <div className="grid border-t border-ink-soft/10 sm:grid-cols-3">
          {[
            ['1', 'Escolha o modelo', tipo === 'setor' ? setorById(setorSel).nome : tipo === 'sazonal' ? tema.nome : 'Produtos variados', 'LayoutTemplate'],
            ['2', 'Escaneie os produtos', `${fila.length} ${fila.length === 1 ? 'produto na fila' : 'produtos na fila'}`, 'ScanBarcode'],
            ['3', 'Gere e imprima', itensJornal.length ? `${itensJornal.length} ${itensJornal.length === 1 ? 'produto pronto' : 'produtos prontos'} para o jornal` : 'Aguardando produtos', 'FileDown'],
          ].map(([n, t, sub, ic], i) => (
            <div key={n} className={`flex items-center gap-3 px-5 py-3 ${i < 2 ? 'border-b border-ink-soft/10 sm:border-b-0 sm:border-r' : ''}`}>
              <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold ${i === 0 || (i === 1 && fila.length) || (i === 2 && itensJornal.length) ? 'bg-bengala text-white' : 'bg-cream-200 text-ink-soft'}`}>{n}</span>
              <Icon name={ic} size={18} className="text-ink-soft" />
              <div className="min-w-0">
                <div className="text-sm font-bold text-ink">{t}</div>
                <div className="truncate text-xs text-ink-soft">{sub}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <ScannerJornal />

      <div className="flex gap-1 border-b border-ink-soft/10">
        <Tab id="gerar" icone="LayoutTemplate">Montar jornal</Tab>
        <Tab id="fila" icone="ListChecks" badge={fila.length}>Produtos escaneados</Tab>
        <Tab id="historico" icone="History" badge={jornais.length}>Histórico</Tab>
        <Tab id="oficial" icone="Globe">Modelo oficial</Tab>
      </div>

      {/* ============ GERAR ============ */}
      {aba === 'gerar' && (
        <div className="grid gap-5 lg:grid-cols-[330px_1fr]">
          {/* controles */}
          <div className="space-y-4">
            <div className="card-bengala space-y-3 p-4">
              <div>
                <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-ink-soft">1. Escolha o modelo</p>
                <div className="grid grid-cols-3 gap-1.5">
                  {[['geral', 'Geral', 'Store'], ['setor', 'Por setor', 'Grid3x3'], ['sazonal', 'Sazonal', 'PartyPopper']].map(([id, l, ic]) => (
                    <button key={id} onClick={() => setTipo(id)} className={`flex flex-col items-center gap-1 rounded-lg border-2 py-2 text-xs font-medium ${tipo === id ? 'border-bengala text-bengala' : 'border-ink-soft/15 text-ink-soft hover:border-ink-soft/30'}`}>
                      <Icon name={ic} size={18} /> {l}
                    </button>
                  ))}
                </div>
              </div>

              {tipo === 'geral' && (
                <div>
                  <p className="mb-1.5 text-xs font-medium text-ink-soft">Produtos de vários setores no mesmo jornal</p>
                  <div className="overflow-hidden rounded-xl border border-navy/10" style={{ background: CORES_BENGALA.secundaria }}>
                    <div className="flex items-center justify-between px-3 py-2 text-white">
                      <span className="text-[10px] font-bold uppercase tracking-[0.1em]">Prévia do modelo</span>
                      <span className="rounded-full px-2 py-0.5 text-[9px] font-extrabold" style={{ background: CORES_BENGALA.destaque, color: CORES_BENGALA.secundaria }}>A4 proporcional</span>
                    </div>
                    <div className="flex h-40 items-center gap-3 bg-white p-4">
                      <Logo h={54} chip />
                      <div>
                        <div className="display-bengala text-2xl uppercase leading-none" style={{ color: CORES_BENGALA.secundaria }}>Ofertas internas</div>
                        <div className="mt-1 text-xs font-bold" style={{ color: CORES_BENGALA.primaria }}>Bengala Supermercado</div>
                        <div className="mt-3 h-2 w-36 rounded-full" style={{ background: CORES_BENGALA.destaque }} />
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {tipo === 'setor' && (
                <div>
                  <p className="mb-1.5 text-xs font-medium text-ink-soft">Qual setor você vai trabalhar?</p>
                  <div className="grid grid-cols-2 gap-1.5">
                    {SETORES.map((s) => (
                      <button key={s.id} onClick={() => setSetorSel(s.id)} className={`flex items-center gap-2 rounded-lg border-2 px-2.5 py-2 text-left text-xs font-medium ${setorSel === s.id ? 'border-bengala bg-bengala/5 text-bengala' : 'border-ink-soft/15 text-ink-soft'}`}>
                        <span className="h-3 w-3 rounded-full" style={{ background: s.cor }} />
                        {s.nome}
                      </button>
                    ))}
                  </div>
                  <div className="mt-2.5 overflow-hidden rounded-xl border border-navy/10" style={{ background: CORES_BENGALA.secundaria }}>
                    <div className="flex items-center justify-between px-3 py-2 text-white">
                      <span className="text-[10px] font-bold uppercase tracking-[0.1em]">Prévia do modelo</span>
                      <span className="rounded-full bg-offer px-2 py-0.5 text-[9px] font-extrabold text-navy">
                        {setorById(setorSel).nome}
                      </span>
                    </div>
                    <div className="flex h-40 items-center justify-center bg-white p-4 text-center">
                      <div>
                        <Logo h={48} chip />
                        <div className="display-bengala mt-2 text-xl uppercase" style={{ color: CORES_BENGALA.secundaria }}>{setorById(setorSel).nome}</div>
                        <div className="mx-auto mt-2 h-2 w-28 rounded-full" style={{ background: CORES_BENGALA.primaria }} />
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {tipo === 'sazonal' && (
                <div>
                  <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-ink-soft">Tema</p>
                  <div className="grid grid-cols-2 gap-1.5">
                    {Object.entries(TEMAS).map(([id, t]) => (
                      <button key={id} onClick={() => setTemaSel(id)} className={`rounded-lg border-2 px-2 py-1.5 text-left text-xs font-medium ${temaSel === id ? 'border-bengala' : 'border-ink-soft/15'}`}>
                        <span className="mr-1 inline-block h-2.5 w-2.5 rounded-full align-middle" style={{ background: t.cor }} /> {t.nome}
                      </button>
                    ))}
                  </div>
                  <button onClick={aplicarDiaB} className="mt-2 w-full rounded-lg bg-bengala/10 px-3 py-1.5 text-xs font-medium text-bengala hover:bg-bengala/15">
                    <Icon name="Zap" size={13} className="mr-1 inline" /> Aplicar modelo Dia B (amanhã)
                  </button>
                </div>
              )}

              <Campo label="Título"><input className={inputCls} value={titulo} onChange={(e) => setTitulo(e.target.value)} /></Campo>
              <div className="flex items-center gap-2 rounded-lg bg-cream-200 px-3 py-2 text-sm">
                <Icon name="CalendarClock" size={15} className="text-bengala" />
                <span className="text-ink-soft">Validade automática:</span>
                <span className="font-medium text-ink">{formatData(validadeDe)} → {formatData(validadeAte)}</span>
              </div>
              <p className="px-1 text-xs text-ink-soft">Calculada do hoje até a última validade dos produtos da fila.</p>
            </div>

            {/* seleção da fila */}
            <div className="card-bengala p-3">
              <div className="mb-2 flex items-center justify-between gap-2 px-1">
                <p className="text-xs font-medium uppercase tracking-wide text-ink-soft">2. Produtos do jornal ({ativos.length})</p>
                <button onClick={() => document.getElementById('scanner-jornal')?.scrollIntoView({ behavior: 'smooth' })} className="flex items-center gap-1 text-xs font-bold text-bengala hover:underline">
                  <Icon name="ScanLine" size={13} /> Escanear
                </button>
              </div>
              {fila.length === 0 ? (
                <p className="px-1 py-3 text-sm text-ink-soft">Fila vazia. Adicione produtos em Produtos ou Ofertas.</p>
              ) : (
                <div className="max-h-64 space-y-1 overflow-y-auto">
                  {fila.map((p) => (
                    <div key={p.id} className="flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-cream-200">
                      <input type="checkbox" checked={incluir(p.id)} onChange={() => toggleIncluir(p.id)} className="h-4 w-4 accent-bengala" />
                      <ProdutoThumb produto={p} size={28} />
                      <span className="min-w-0 flex-1 whitespace-normal break-words text-sm leading-snug text-ink">{p.nome}</span>
                      {p.origemFila === 'vencimento' && <Pill cor="#d9641f" bg="#f47b361a">interna</Pill>}
                      <button onClick={() => setProdutoEditandoGerador({ ...p })} aria-label={`Editar ${p.nome}`} className="rounded p-1 text-info hover:bg-info/10"><Icon name="Pencil" size={14} /></button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {itensJornal.length > 0 && (
              <div className="rounded-xl border border-info/20 bg-info/5 p-3 text-sm">
                <div className="flex items-center gap-2 font-bold text-ink">
                  <Icon name="Files" size={16} className="text-info" />
                  {paginasJornal.length} {paginasJornal.length === 1 ? 'página A4' : 'páginas A4'}
                </div>
                <p className="mt-1 text-xs leading-relaxed text-ink-soft">
                  {paginasJornal.length === 1
                    ? itensJornal.length === 1
                      ? 'O produto cabe em uma única frente.'
                      : `Os ${itensJornal.length} produtos cabem em uma única frente.`
                    : paginasJornal.length === 2
                      ? `${itensJornal.length} produtos distribuídos automaticamente em frente e verso.`
                      : `${itensJornal.length} produtos distribuídos em ${Math.ceil(paginasJornal.length / 2)} folhas, usando frente e verso.`}
                </p>
              </div>
            )}

            {itensJornal.length > 0 && (
              <div ref={revisaoRef} className={`scroll-mt-4 rounded-xl border p-3 text-sm ${bloqueiosPDF.length ? 'border-critical/30 bg-critical/5' : problemasPDF.length ? 'border-warning/30 bg-warning/5' : 'border-success/30 bg-success/5'}`}>
                <button onClick={() => setMostrarRevisao((v) => !v)} className="flex w-full items-center gap-2 text-left font-bold text-ink">
                  <Icon name={bloqueiosPDF.length ? 'TriangleAlert' : problemasPDF.length ? 'Info' : 'BadgeCheck'} size={17} className={bloqueiosPDF.length ? 'text-critical' : problemasPDF.length ? 'text-warning' : 'text-success'} />
                  <span className="flex-1">Revisão antes do PDF</span>
                  <span className="text-xs font-medium text-ink-soft">
                    {bloqueiosPDF.length ? `${bloqueiosPDF.length} bloqueio(s)` : problemasPDF.length ? `${problemasPDF.length} aviso(s), impressão liberada` : 'Tudo pronto'}
                  </span>
                  <Icon name={mostrarRevisao ? 'ChevronUp' : 'ChevronDown'} size={15} />
                </button>
                {mostrarRevisao && (
                  <div className="mt-2 space-y-1.5 border-t border-ink-soft/10 pt-2">
                    {problemasPDF.length === 0 ? (
                      <div className="flex items-center gap-2 text-xs text-success">
                        <Icon name="Check" size={14} /> Preços, validades, imagens e repetições verificados.
                      </div>
                    ) : problemasPDF.map((problema, indice) => (
                      <div key={`${problema.texto}-${indice}`} className={`flex items-start gap-2 text-xs ${problema.nivel === 'erro' ? 'text-critical' : 'text-warning'}`}>
                        <Icon name={problema.nivel === 'erro' ? 'CircleX' : 'ImageOff'} size={13} className="mt-0.5 shrink-0" />
                        <span>{problema.texto}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            <div className="flex gap-2">
              <Botao variante="contorno" className="flex-1" onClick={salvar}><Icon name="Save" size={16} /> Salvar</Botao>
              <Botao className="flex-1" onClick={exportar} disabled={exportando || !itensJornal.length}><Icon name="Printer" size={16} /> {exportando ? 'Preparando...' : 'Pré-visualizar / imprimir'}</Botao>
            </div>
            {pdfPronto && (
              <div className="rounded-xl border border-success/30 bg-success/5 p-3">
                <div className="flex items-start gap-2 text-sm text-success">
                  <Icon name="BadgeCheck" size={18} className="mt-0.5 shrink-0" />
                  <div className="min-w-0 flex-1">
                    <div className="font-bold">Pré-visualização aberta</div>
                    <div className="mt-0.5 text-xs text-ink-soft">O navegador permite escolher papel, escala, impressora ou Salvar como PDF.</div>
                  </div>
                </div>
                <div className="mt-2 flex flex-wrap gap-2">
                  <button onClick={exportar} className="inline-flex min-h-10 flex-1 items-center justify-center gap-2 rounded-lg bg-success px-3 py-2 text-sm font-bold text-white">
                    <Icon name="Printer" size={16} /> Abrir novamente
                  </button>
                </div>
              </div>
            )}
            {itensJornal.length > 0 && itensJornal.length < 3 && (
              <button onClick={() => navigate('/cartazes')} className="flex w-full items-center justify-center gap-2 rounded-xl border border-coral/30 bg-coral/10 px-3 py-2.5 text-sm font-medium text-coral-dark hover:bg-coral/15">
                <Icon name="Image" size={16} /> Poucos produtos? Criar cartaz individual
              </button>
            )}
          </div>

          {/* preview A4 adaptável */}
          <div className="space-y-5 overflow-x-auto pb-2">
            {paginasJornal.map((itens, indice) => (
              <div key={indice} className="space-y-1.5">
                <div className="flex items-center justify-between px-1 text-xs text-ink-soft">
                  <span className="font-bold text-ink">{nomeLado(indice)}</span>
                  <span>{itens.length} {itens.length === 1 ? 'produto' : 'produtos'}</span>
                </div>
                <PaginaModelo
                  ref={(el) => { pageRefs.current[indice] = el }}
                  itens={itens}
                  precoJornal={precoJornal}
                  descJornal={descJornal}
                   selo={selo}
                   tipo={tipo}
                   temaSel={temaSel}
                   setorSel={setorSel}
                   validadeDe={validadeDe}
                  validadeAte={validadeAte}
                  numero={indice + 1}
                  total={paginasJornal.length}
                  config={config}
                />
              </div>
            ))}
          </div>

          {/* preview legado mantido oculto durante a migração visual */}
          <div className="hidden">
            <div ref={ref} className="w-[440px] shrink-0 overflow-hidden rounded-xl" style={{ background: '#141414', border: '1.5px solid #d4a94e' }}>
              {/* cabeçalho estilo encarte oficial (preto + dourado) */}
              <div className="px-4 pb-3 pt-4">
                <div className="flex items-start justify-between gap-2">
                  <Logo h={46} chip />
                  <div className="rounded-xl px-3 py-1.5 text-center" style={{ background: '#000', border: '1.5px solid #d4a94e' }}>
                    <div className="text-[8px] font-bold tracking-[2px]" style={{ color: '#ffd23f' }}>ESPECIAL</div>
                    <div className="text-[13px] font-extrabold italic leading-none" style={{ color: '#ff4436' }}>{selo}</div>
                    <div className="mt-1 text-[8px]" style={{ color: '#cfc3ba' }}>
                      Válido {formatData(validadeDe)} a {formatData(validadeAte)}
                    </div>
                  </div>
                </div>
                <div className="mt-1.5 text-center">
                  <div className="text-[12px] italic text-white">A semana mais barata do mês chegou cheia de...</div>
                  <div className="text-[31px] font-extrabold italic leading-none tracking-tight" style={{ color: '#ffd23f', textShadow: '2.5px 2.5px 0 #c42b2b' }}>
                    SUPER OFERTAS!
                  </div>
                </div>
              </div>

              {/* faixa temática (sazonal) */}
              {tipo === 'sazonal' && <BandaTema temaId={temaSel} />}

              {/* GRANDE IDEIA · vencimento (painel com moldura dourada) */}
              {vencimento.length > 0 && (
                <div className="mx-3 mb-3 overflow-hidden rounded-xl" style={{ border: '2px solid #d4a94e', background: '#1b1712' }}>
                  <div className="px-3 py-1.5 text-center" style={{ background: 'linear-gradient(90deg, #9e1f14, #e23a2e, #9e1f14)' }}>
                    <span className="text-[12px] font-extrabold tracking-wide text-white">GRANDE IDEIA · OFERTAS DE VENCIMENTO</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 p-2.5">
                    {vencimento.map((p) => (
                      <CelulaVenc key={p.id} p={p} preco={precoJornal(p)} desc={descJornal(p)} />
                    ))}
                  </div>
                </div>
              )}

              {/* painéis por setor */}
              {bandas.map((b) => (
                <div key={b.setor.id} className="mx-3 mb-3 overflow-hidden rounded-xl" style={{ border: '1.5px solid #d4a94e', background: '#1b1712' }}>
                  <div className="flex items-center justify-center gap-2 px-3 py-1.5" style={{ background: b.setor.cor }}>
                    <Icon name={b.setor.icone} size={14} className="text-white" />
                    <span className="text-[12px] font-extrabold tracking-wide text-white">{b.setor.nome.toUpperCase()}</span>
                  </div>
                  <div className="grid grid-cols-3 gap-2 p-2.5">
                    {b.itens.map((p) => (
                      <CelulaSetor key={p.id} p={p} preco={precoJornal(p)} desc={descJornal(p)} />
                    ))}
                  </div>
                </div>
              ))}

              {vencimento.length === 0 && bandas.length === 0 && (
                <div className="p-8 text-center text-sm" style={{ color: '#b8a99f' }}>
                  Marque produtos na fila para montar o jornal.<br />Os de vencimento entram como “grande ideia”.
                </div>
              )}

              {/* rodapé */}
              <div className="flex items-center justify-between px-4 py-2.5" style={{ background: '#000', borderTop: '1px solid #d4a94e' }}>
                <div className="text-[8px] leading-tight" style={{ color: '#b8a99f' }}>
                  Ofertas válidas enquanto durar o estoque.<br />Reservamo-nos o direito de limitar 3 un/cliente.
                </div>
                <div className="flex h-8 w-8 items-center justify-center rounded bg-white" style={{ color: '#141414' }}><Icon name="QrCode" size={20} /></div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ============ FILA ============ */}
      {aba === 'fila' && <FilaView fila={fila} vencimento={fila.filter((p) => p.origemFila === 'vencimento')} remover={removerDaFila} salvarProduto={salvarProduto} toast={toast} />}

      {aba === 'historico' && (
        <div className="card-bengala p-4">
          <h3 className="mb-1 font-bold text-ink">Jornais gerados</h3>
          <p className="mb-3 text-xs text-ink-soft">Cada item guarda os produtos, preços e imagens usados naquele momento.</p>
          {jornais.length === 0 ? (
            <EmptyState icon="History" titulo="Nenhum jornal salvo" descricao="Ao pré-visualizar ou salvar um jornal, ele aparecerá aqui." />
          ) : (
            <div className="space-y-2">
              {jornais.map((jornal) => (
                <div key={jornal.id} className="flex flex-wrap items-center gap-2 rounded-xl border border-ink-soft/10 bg-white p-3">
                  <button onClick={() => abrirJornalSalvo(jornal)} className="flex min-w-0 flex-1 items-center gap-3 text-left">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-bengala/10 text-bengala"><Icon name="Newspaper" size={19} /></span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-bold text-ink">{jornal.titulo}</span>
                      <span className="block text-xs text-ink-soft">{jornal.totalItens} produtos · {jornal.totalPaginas || 1} pág. · {new Date(jornal.criadoEm).toLocaleString('pt-BR')}</span>
                    </span>
                  </button>
                  <button onClick={() => abrirJornalSalvo(jornal)} className="inline-flex items-center gap-1 rounded-lg bg-bengala px-3 py-2 text-xs font-bold text-white"><Icon name="Eye" size={14} /> Visualizar</button>
                  <button onClick={() => excluirJornal(jornal.id)} aria-label={`Excluir ${jornal.titulo}`} className="rounded-lg p-2 text-critical hover:bg-critical/10"><Icon name="Trash2" size={15} /></button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ============ OFICIAL ============ */}
      {aba === 'oficial' && <OficialView jornal={jornalOficial} atualizar={atualizarJornalOficial} url={config.jornalUrl} toast={toast} />}

      {historicoParaAbrir ? (
        <div className="pointer-events-none fixed left-[-12000px] top-0 opacity-0" aria-hidden="true">
          {paginar(historicoParaAbrir.jornal.produtos || []).map((itens, indice) => (
            <PaginaModelo
              key={`${historicoParaAbrir.jornal.id}-${indice}`}
              ref={(elemento) => { historicoRefs.current[indice] = elemento }}
              itens={itens}
              precoJornal={(produto) => produto.precoJornalCalculado ?? produto.precoPromo ?? produto.precoNormal}
              descJornal={(produto) => produto.descontoJornalCalculado ?? 0}
              validadeDe={historicoParaAbrir.jornal.validadeDe}
              validadeAte={historicoParaAbrir.jornal.validadeAte}
              numero={indice + 1}
              total={paginar(historicoParaAbrir.jornal.produtos || []).length}
            />
          ))}
        </div>
      ) : null}

      <Modal
        open={Boolean(produtoEditandoGerador)}
        onClose={() => setProdutoEditandoGerador(null)}
        titulo="Editar produto do jornal"
        footer={<><Botao variante="contorno" onClick={() => setProdutoEditandoGerador(null)}>Cancelar</Botao><Botao onClick={salvarProdutoGerador}>Salvar correção</Botao></>}
      >
        {produtoEditandoGerador ? (
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2 flex items-center gap-3">
              <ProdutoThumb produto={produtoEditandoGerador} size={58} />
              <label className="cursor-pointer rounded-lg border border-ink-soft/20 bg-white px-3 py-2 text-sm font-bold text-ink">
                <Icon name="ImagePlus" size={14} className="mr-1 inline" /> Trocar imagem
                <input
                  type="file"
                  accept="image/*"
                  className="sr-only"
                  onChange={(evento) => trocarImagemProdutoGerador(evento.target.files?.[0])}
                />
              </label>
            </div>
            <div className="col-span-2"><Campo label="Nome"><input className={inputCls} value={produtoEditandoGerador.nome || ''} onChange={(e) => setProdutoEditandoGerador((p) => ({ ...p, nome: e.target.value }))} /></Campo></div>
            <Campo label="Marca"><input className={inputCls} value={produtoEditandoGerador.marca || ''} onChange={(e) => setProdutoEditandoGerador((p) => ({ ...p, marca: e.target.value }))} /></Campo>
            <Campo label="Gramagem"><input className={inputCls} value={produtoEditandoGerador.gramagem || ''} onChange={(e) => setProdutoEditandoGerador((p) => ({ ...p, gramagem: e.target.value }))} /></Campo>
            <Campo label="Validade"><input type="date" className={inputCls} value={produtoEditandoGerador.validade || ''} onChange={(e) => setProdutoEditandoGerador((p) => ({ ...p, validade: e.target.value }))} /></Campo>
            <Campo label="Quantidade"><input type="number" min="0" className={inputCls} value={produtoEditandoGerador.estoque ?? ''} onChange={(e) => setProdutoEditandoGerador((p) => ({ ...p, estoque: e.target.value }))} /></Campo>
            <Campo label="Preço normal"><input type="number" min="0.01" step="0.01" className={inputCls} value={produtoEditandoGerador.precoNormal ?? ''} onChange={(e) => setProdutoEditandoGerador((p) => ({ ...p, precoNormal: e.target.value }))} /></Campo>
            <Campo label="Preço promocional"><input type="number" min="0.01" step="0.01" className={inputCls} value={produtoEditandoGerador.precoPromo ?? ''} onChange={(e) => setProdutoEditandoGerador((p) => ({ ...p, precoPromo: e.target.value }))} /></Campo>
          </div>
        ) : null}
      </Modal>
    </div>
  )
}

// ---- célula de vencimento (grande ideia) — estilo encarte escuro ----
function FotoEncarte({ produto, className = '' }) {
  if (!produto?.imagem) return null
  return (
    <img
      src={produto.imagem}
      alt={produto.nome}
      className={`absolute object-contain ${className}`}
      style={{ filter: 'drop-shadow(0 5px 5px rgba(8,43,79,.18))' }}
    />
  )
}

function CirculoPreco({ valor, pequeno = false, cores }) {
  return (
    <div
      className="absolute inset-0 flex items-center justify-center rounded-full text-center"
      style={{
        background: cores.primaria,
        border: `${pequeno ? 2 : 3}px solid ${cores.destaque}`,
        boxShadow: '0 5px 12px rgba(89,0,7,.22)',
      }}
    >
      <div>
        <div className={`${pequeno ? 'text-[6px]' : 'text-[8px]'} font-black uppercase leading-none text-white`}>POR:</div>
        <PrecoVarejo valor={valor} className={pequeno ? 'text-[22px]' : 'text-[40px]'} cor="#ffffff" />
      </div>
    </div>
  )
}

function OfertaDestaqueModelo({ produto, preco, cores }) {
  const dias = statusValidade(produto.validade).dias
  return (
    <div className="absolute left-[14px] top-[120px] h-[160px] w-[412px] overflow-hidden rounded-[10px] bg-white shadow-sm">
      <FotoEncarte produto={produto} className="left-[16px] top-[6px] h-[128px] w-[120px]" />
      <div className="display-bengala absolute left-[145px] top-[16px] w-[137px] uppercase leading-[1.04]" style={{ ...estiloNomeCompleto(produto.nome, 14, 9.5), color: cores.secundaria }}>
        {produto.nome}
      </div>
      <div className="absolute left-[145px] top-[83px] text-[8px] font-black uppercase" style={{ color: 'rgba(8,43,79,.85)' }}>
        DE: <span className="text-[12px] text-[#777] line-through decoration-critical decoration-2">{formatBRL(produto.precoNormal)}</span>
      </div>
      <div className="absolute left-[286px] top-[8px] h-[112px] w-[112px]">
        <CirculoPreco valor={preco} cores={cores} />
      </div>
      <div className="display-bengala absolute bottom-[6px] left-[145px] flex h-[25px] w-[137px] items-center justify-center rounded-md px-2 text-[10px] uppercase text-white" style={{ background: cores.primaria }}>
        {dias < 0 ? 'VENCIDO' : dias === 0 ? 'VENCE HOJE' : `VENCE EM ${dias} ${dias === 1 ? 'DIA' : 'DIAS'}`}
      </div>
      <div className="display-bengala absolute bottom-[6px] right-[14px] flex h-[25px] w-[112px] items-center justify-center rounded-md px-2 text-[10px] uppercase text-white" style={{ background: cores.secundaria }}>
        {Number(produto.estoque || 0)} UNIDADES
      </div>
    </div>
  )
}

function OfertaMenorModelo({ produto, preco, indice, cores }) {
  const dias = statusValidade(produto.validade).dias
  const posicoes = [14, 153, 289]
  const larguras = [133, 132, 137]
  return (
    <div
      className="absolute top-[290px] h-[188px] overflow-hidden rounded-[9px] bg-white shadow-sm"
      style={{ left: posicoes[indice], width: larguras[indice] }}
    >
      <FotoEncarte produto={produto} className="left-[5px] top-[10px] h-[120px] w-[61px]" />
      <div className="display-bengala absolute left-[65px] top-[12px] w-[63px] uppercase leading-[1.04]" style={{ ...estiloNomeCompleto(produto.nome, 8.2, 5.4), color: cores.secundaria }}>
        {produto.nome}
      </div>
      <div className="absolute left-[65px] top-[60px] text-[5.5px] font-black uppercase" style={{ color: 'rgba(8,43,79,.8)' }}>
        DE: <span className="text-[7.5px] text-[#777] line-through decoration-critical">{formatBRL(produto.precoNormal)}</span>
      </div>
      <div className="absolute left-[68px] top-[75px] h-[58px] w-[58px]">
        <CirculoPreco valor={preco} pequeno cores={cores} />
      </div>
      <div className="display-bengala absolute bottom-[6px] left-[5px] flex h-[17px] w-[61px] items-center justify-center rounded px-1 text-center text-[5.5px] uppercase leading-none text-white" style={{ background: cores.primaria }}>
        {dias < 0 ? 'VENCIDO' : dias === 0 ? 'VENCE HOJE' : `VENCE EM ${dias}D`}
      </div>
      <div className="display-bengala absolute bottom-[6px] right-[5px] flex h-[17px] w-[60px] items-center justify-center rounded px-1 text-center text-[5.5px] uppercase leading-none text-white" style={{ background: cores.secundaria }}>
        {Number(produto.estoque || 0)} UNIDADES
      </div>
    </div>
  )
}

const PaginaJornalModeloAprovado = forwardRef(function PaginaJornalModeloAprovado(
  { itens, precoJornal, validadeDe, validadeAte, numero, total },
  ref
) {
  const hero = itens[0]
  const menores = itens.slice(1, 4)
  const cores = CORES_BENGALA
  return (
    <div
      ref={ref}
      data-pdf-page="a4"
      className="relative mx-auto h-[622px] w-[440px] shrink-0 overflow-hidden rounded-xl bg-white"
      style={{ boxShadow: '0 14px 34px rgba(8,43,79,.16)' }}
    >
      <div className="absolute inset-0 bg-[#f3f6f8]" />
      <div className="absolute inset-x-0 top-0 h-[108px] overflow-hidden text-white" style={{ background: cores.secundaria }}>
        <span className="absolute -right-10 -top-16 h-40 w-40 rounded-full border-[22px] opacity-20" style={{ borderColor: cores.destaque }} />
        <span className="absolute inset-x-0 bottom-0 h-[7px]" style={{ background: cores.primaria }} />
        <div className="absolute left-[15px] top-[14px] flex items-center gap-3">
          <Logo h={52} chip />
          <div className="max-w-[205px]">
            <div className="display-bengala text-[28px] uppercase leading-[.86]">OFERTAS<br /><span style={{ color: cores.destaque }}>INTERNAS</span></div>
            <div className="mt-2 truncate text-[8px] font-bold uppercase tracking-[.14em] opacity-90">Bengala Supermercado</div>
          </div>
        </div>
        <div className="absolute right-[18px] top-[18px] w-[115px] rounded-lg border border-white/25 bg-black/15 px-3 py-2 text-center">
          <div className="text-[7px] font-black uppercase tracking-[.12em]" style={{ color: cores.destaque }}>Ofertas válidas</div>
          <div className="mt-1 text-[8px] font-bold">{formatData(validadeDe)} a {formatData(validadeAte)}</div>
        </div>
      </div>
      {hero && <OfertaDestaqueModelo produto={hero} preco={precoJornal(hero)} cores={cores} />}
      {menores.map((produto, indice) => (
        <OfertaMenorModelo key={produto.id} produto={produto} preco={precoJornal(produto)} indice={indice} cores={cores} />
      ))}
      <div className="absolute inset-x-0 bottom-0 h-[132px] border-t-[6px] bg-white px-4 py-3" style={{ borderColor: cores.primaria }}>
        <div className="flex items-center gap-3">
          <Logo h={35} />
          <div className="min-w-0 flex-1">
            <div className="truncate text-[9px] font-black uppercase" style={{ color: cores.secundaria }}>Bengala Supermercado</div>
            <div className="mt-0.5 truncate text-[7px] font-bold" style={{ color: cores.primaria }}>Ofertas internas · Loja 3</div>
          </div>
          <div className="rounded px-2 py-1 text-[7px] font-black text-white" style={{ background: cores.secundaria }}>Página {numero}/{total}</div>
        </div>
        <div className="mt-3 grid grid-cols-3 gap-2 text-[6px] leading-[1.35] text-[#59636d]">
          <div><strong style={{ color: cores.secundaria }}>OFERTA RESPONSÁVEL</strong><br />Produtos identificados por código e vinculados ao estoque.</div>
          <div><strong style={{ color: cores.secundaria }}>CONSULTE A LOJA</strong><br />Ofertas válidas enquanto durarem os estoques.</div>
          <div><strong style={{ color: cores.secundaria }}>ECONOMIA E CONSUMO</strong><br />Compre apenas o necessário e evite desperdícios.</div>
        </div>
      </div>
    </div>
  )
})

const PaginaJornalAdaptavel = forwardRef(function PaginaJornalAdaptavel(
  { itens, precoJornal, descJornal, selo, tipo, temaSel, setorSel, validadeDe, validadeAte, numero, total },
  ref
) {
  const hero = itens[0]
  const demais = itens.slice(1)
  const poucos = itens.length <= 3
  const colunas = demais.length <= 2 ? Math.max(demais.length, 1) : 3
  const template = `url('${TEMPLATE_GERAL}')`
  const setorConfig = setorById(setorSel)
  const temaConfig = TEMAS[temaSel] || TEMAS.diaB
  const acento = tipo === 'sazonal' ? temaConfig.acento : tipo === 'setor' ? setorConfig.cor : '#ffc928'
  const campanha = tipo === 'sazonal' ? temaConfig.nome : tipo === 'setor' ? setorConfig.nome : 'Produtos variados'
  const heroSetor = hero ? setorById(hero.setor) : setorConfig
  const alturaHero = demais.length === 0 ? 'flex-1' : poucos ? 'h-[142px]' : 'h-[118px]'

  return (
    <div
      ref={ref}
      className="relative mx-auto h-[622px] w-[440px] shrink-0 overflow-hidden rounded-xl"
      style={{ background: '#fff8ed', border: '1.5px solid #ffc928', boxShadow: '0 14px 34px rgba(8,43,79,.16)' }}
    >
      <div
        className="relative h-[96px]"
        style={{ backgroundImage: template, backgroundSize: '440px 660px', backgroundPosition: 'top center' }}
      >
        <div className="absolute right-[28px] top-[45px] text-center text-[7px] font-bold leading-tight" style={{ color: '#ffffff' }}>
          {formatData(validadeDe)}<br />a {formatData(validadeAte)}
        </div>
      </div>

      <div
        className="relative flex h-[336px] flex-col gap-2 overflow-hidden p-2.5"
        style={{
          background:
            'radial-gradient(circle at 96% 3%, rgba(255,201,40,.22) 0 3px, transparent 4px), linear-gradient(180deg,#fff8ed 0%,#ffffff 100%)',
        }}
      >
        <div className="pointer-events-none absolute -right-12 -top-14 h-36 w-36 rounded-full border-[22px] border-bengala/5" />
        <div
          className="relative z-10 flex h-[46px] shrink-0 items-center justify-between overflow-hidden rounded-xl px-3 text-white"
          style={{
            background: `linear-gradient(118deg,#082b4f 0 57%,#123f6b 57% 66%,${tipo === 'setor' ? acento : '#e4232e'} 66% 100%)`,
            boxShadow: '0 5px 13px rgba(8,43,79,.16)',
          }}
        >
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="rounded-full px-2 py-0.5 text-[6.5px] font-black uppercase tracking-[.12em]" style={{ background: '#ffc928', color: '#082b4f' }}>
                {tipo === 'sazonal' ? 'Oferta especial' : 'Oferta de vencimento'}
              </span>
              <span className="truncate text-[7px] font-bold text-white/70">{campanha}</span>
            </div>
            <div className="display-bengala mt-0.5 truncate text-[17px] uppercase leading-none">{selo}</div>
          </div>
          <div className="ml-2 shrink-0 text-right">
            <div className="text-[6.5px] font-bold uppercase tracking-[.08em]" style={{ color: '#ffc928' }}>Economize hoje</div>
            <div className="text-[7px] font-semibold text-white/85">e evite desperdício</div>
          </div>
        </div>

        {!hero ? (
          <div className="relative z-10 flex flex-1 flex-col items-center justify-center rounded-xl text-center" style={{ border: '1.5px dashed #ffc928', background: '#ffffff', color: '#6b5a54' }}>
            <Icon name="ScanBarcode" size={26} style={{ color: '#e4232e' }} />
            <div className="display-bengala mt-2 text-base text-navy">ESCANEIE PARA COMEÇAR</div>
            <div className="mt-1 text-[8px]">Os produtos preencherão o jornal automaticamente.</div>
          </div>
        ) : (
          <>
            <div className={`relative z-10 flex overflow-hidden rounded-xl ${alturaHero}`} style={{ border: '2px solid #e4232e', background: '#ffffff', boxShadow: '0 7px 16px rgba(8,43,79,.12)' }}>
              <div
                className="relative flex w-[82px] shrink-0 flex-col items-center justify-center overflow-hidden px-2 text-center text-white"
                style={{ background: 'linear-gradient(150deg,#e4232e,#bf1721)' }}
              >
                <div className="absolute -bottom-6 -left-5 h-16 w-16 rounded-full border-[10px] border-offer/20" />
                <span className="rounded-full bg-offer px-2 py-0.5 text-[6px] font-black uppercase tracking-wide text-navy">Destaque</span>
                <Icon name={heroSetor.icone} size={19} className="mt-2" />
                <div className="display-bengala mt-1 text-[11px] uppercase leading-none">{heroSetor.nome}</div>
                <div className="mt-1 text-[6.5px] font-bold text-offer">ÚLTIMAS UNIDADES</div>
              </div>
              <div className="flex min-w-0 flex-1 items-center gap-2 p-2">
                <div className={`flex shrink-0 items-center justify-center rounded-xl ${poucos ? 'h-[102px] w-[102px]' : 'h-[78px] w-[78px]'}`} style={{ background: 'linear-gradient(145deg,#ffffff,#fff5df)', border: '1px solid rgba(255,201,40,.45)' }}>
                  <ProdutoThumb produto={hero} size={poucos ? 94 : 72} />
                </div>
                <div className="relative min-w-0 flex-1">
                  {descJornal(hero) > 0 && <SeloDesconto texto={`-${descJornal(hero)}%`} size={36} className="absolute -right-1 -top-2 z-10" />}
                  <div className={`${poucos ? 'text-[13px]' : 'text-[10.5px]'} display-bengala pr-7 uppercase leading-tight`} style={{ color: '#082b4f' }}>{hero.nome}</div>
                  <div className="mt-1 text-[7px] font-bold uppercase" style={{ color: '#6b5a54' }}>De <span className="line-through">{formatBRL(hero.precoNormal)}</span></div>
                  <div className="mt-1 inline-block rounded-lg px-3 py-1.5" style={{ background: '#ffc928', color: '#bf1721', boxShadow: '3px 3px 0 #e4232e' }}>
                    <span className="mr-1 align-middle text-[6px] font-black uppercase">Por</span>
                    <PrecoVarejo valor={precoJornal(hero)} className={poucos ? 'text-[27px]' : 'text-[22px]'} cor="#bf1721" />
                  </div>
                </div>
              </div>
            </div>

            {demais.length > 0 && (
              <div className="relative z-10 grid flex-1 gap-2" style={{ gridTemplateColumns: `repeat(${colunas}, minmax(0, 1fr))` }}>
                {demais.map((p) => (
                  <ProdutoJornalCard
                    key={p.id}
                    produto={p}
                    preco={precoJornal(p)}
                    desconto={descJornal(p)}
                    expandido={poucos}
                  />
                ))}
              </div>
            )}
          </>
        )}
      </div>

      <div
        className="absolute bottom-0 left-0 h-[190px] w-full"
        style={{ backgroundImage: template, backgroundSize: '440px 660px', backgroundPosition: 'bottom center' }}
      />
      <div className="absolute bottom-1 right-2 rounded px-1.5 py-0.5 text-[6px] font-bold" style={{ background: '#101b3f', color: '#ffffff' }}>
        Página {numero}/{total}
      </div>
    </div>
  )
})

function ProdutoJornalCard({ produto, preco, desconto, expandido }) {
  const setor = setorById(produto.setor)
  const validade = statusValidade(produto.validade)

  return (
    <div
      className="relative flex min-h-0 flex-col items-center justify-center overflow-hidden rounded-lg px-1.5 pb-1.5 pt-2 text-center"
      style={{ background: '#ffffff', border: '1px solid rgba(8,43,79,.13)', boxShadow: '0 3px 9px rgba(8,43,79,.08)' }}
    >
      <div className="absolute left-0 top-0 h-1 w-full" style={{ background: setor.cor }} />
      <span className="absolute left-1 top-1.5 rounded-full px-1.5 py-0.5 text-[5.5px] font-black uppercase text-white" style={{ background: setor.cor }}>
        {setor.nome}
      </span>
      {desconto > 0 && <SeloDesconto texto={`-${desconto}%`} size={26} className="absolute right-0.5 top-1 z-10" />}
      <ProdutoThumb produto={produto} size={expandido ? 64 : 42} />
      <div className="mt-0.5 w-full font-black uppercase" style={{ color: '#082b4f', ...estiloNomeCompleto(produto.nome, 6.5, 4.7) }}>{produto.nome}</div>
      <div className="mt-0.5 text-[5.5px] font-bold uppercase" style={{ color: validade.cor }}>{labelDias(validade.dias)}</div>
      <div className="mt-0.5 rounded-md px-2 py-0.5" style={{ background: '#ffc928', color: '#bf1721', boxShadow: '2px 2px 0 #e4232e' }}>
        <PrecoVarejo valor={preco} className={expandido ? 'text-[18px]' : 'text-[14px]'} cor="#bf1721" />
      </div>
    </div>
  )
}

const PaginaJornalInterno = forwardRef(function PaginaJornalInterno(
  { itens, precoJornal, descJornal, selo, tipo, temaSel, setorSel, validadeDe, validadeAte, numero, total },
  ref
) {
  const setorConfig = setorById(setorSel)
  const temaConfig = TEMAS[temaSel] || TEMAS.diaB
  const campanha = tipo === 'sazonal' ? temaConfig.nome : tipo === 'setor' ? setorConfig.nome : 'Produtos variados'
  const destaques = itens.slice(0, 4)
  const grade = itens.slice(4)
  const poucos = itens.length <= 4

  return (
    <div
      ref={ref}
      className="relative mx-auto h-[622px] w-[440px] shrink-0 overflow-hidden rounded-xl bg-white"
      style={{ border: '2px solid #e4232e', boxShadow: '0 14px 34px rgba(8,43,79,.16)' }}
    >
      <img
        src={CABECALHO_INTERNO}
        alt="Ofertas internas do estabelecimento"
        className="block h-[130px] w-full object-cover"
      />

      <div className="flex h-[24px] items-center justify-between px-3 text-[7px] font-black uppercase tracking-[.08em] text-white" style={{ background: '#082b4f' }}>
        <span className="truncate">{selo} · {campanha}</span>
        <span className="ml-3 shrink-0" style={{ color: '#ffc928' }}>
          Válidas de {formatData(validadeDe)} a {formatData(validadeAte)}
        </span>
      </div>

      <div className="h-[388px] overflow-hidden bg-white p-2">
        {!itens.length ? (
          <div className="flex h-full flex-col items-center justify-center rounded-xl text-center" style={{ border: '1.5px dashed #e4232e', color: '#6b5a54' }}>
            <Icon name="ScanBarcode" size={26} style={{ color: '#e4232e' }} />
            <div className="display-bengala mt-2 text-base text-navy">ESCANEIE PARA COMEÇAR</div>
            <div className="mt-1 text-[8px]">Os produtos preencherão o jornal automaticamente.</div>
          </div>
        ) : poucos ? (
          <div className="grid h-full grid-cols-2 gap-2">
            {itens.map((p) => (
              <ProdutoOfertaInterna
                key={p.id}
                produto={p}
                preco={precoJornal(p)}
                desconto={descJornal(p)}
                amplo
              />
            ))}
          </div>
        ) : (
          <div className="grid h-full grid-cols-[128px_1fr] gap-2">
            <div
              className="grid min-h-0 gap-1.5 overflow-hidden rounded-xl p-1.5"
              style={{ background: '#e4232e', gridTemplateRows: `repeat(${destaques.length}, minmax(0, 1fr))` }}
            >
              {destaques.map((p) => (
                <ProdutoDestaqueInterno key={p.id} produto={p} preco={precoJornal(p)} />
              ))}
            </div>
            <div
              className="grid min-h-0 grid-cols-2 gap-1.5"
              style={{ gridTemplateRows: `repeat(${Math.ceil(grade.length / 2)}, minmax(0, 1fr))` }}
            >
              {grade.map((p) => (
                <ProdutoOfertaInterna
                  key={p.id}
                  produto={p}
                  preco={precoJornal(p)}
                  desconto={descJornal(p)}
                />
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="h-[80px] border-t-2 border-bengala bg-white">
        <img src={RODAPE_OFICIAL} alt="Informações oficiais do estabelecimento" className="h-full w-full object-contain" />
      </div>

      <div className="absolute bottom-[82px] right-2 rounded px-1.5 py-0.5 text-[6px] font-bold text-white" style={{ background: '#082b4f' }}>
        Página {numero}/{total}
      </div>
    </div>
  )
})

function ProdutoDestaqueInterno({ produto, preco }) {
  const validade = statusValidade(produto.validade)

  return (
    <div className="relative flex min-h-0 items-center gap-1 overflow-hidden rounded-lg border border-white/35 px-1.5 py-1 text-white">
      <span className="absolute right-1 top-1 rounded px-1 py-0.5 text-[4.5px] font-black uppercase leading-none text-white" style={{ background: '#082b4f' }}>
        Próximo ao vencimento
      </span>
      <div className="flex h-full w-[48px] shrink-0 items-center justify-center rounded-md bg-white">
        <ProdutoThumb produto={produto} size={44} />
      </div>
      <div className="min-w-0 flex-1 self-end pb-0.5">
        <div className="font-black uppercase" style={estiloNomeCompleto(produto.nome, 6.5, 4.6)}>
          {produto.nome}
        </div>
        <div className="mt-0.5 text-[5px] font-bold" style={{ color: '#ffc928' }}>{labelDias(validade.dias)}</div>
        <div className="mt-0.5 inline-block rounded-md px-1.5 py-0.5" style={{ background: '#ffc928', color: '#bf1721' }}>
          <PrecoVarejo valor={preco} className="text-[13px]" cor="#bf1721" />
        </div>
      </div>
    </div>
  )
}

function ProdutoOfertaInterna({ produto, preco, desconto, amplo = false }) {
  const validade = statusValidade(produto.validade)

  return (
    <div className="relative flex min-h-0 items-center overflow-hidden rounded-lg bg-white px-1.5 pb-1 pt-4" style={{ border: '1px solid rgba(8,43,79,.18)' }}>
      <span className="absolute right-1 top-1 rounded px-1 py-0.5 text-[4.5px] font-black uppercase leading-none text-white" style={{ background: '#082b4f' }}>
        Próximo ao vencimento
      </span>
      <div className={`flex shrink-0 items-center justify-center ${amplo ? 'h-[96px] w-[88px]' : 'h-[58px] w-[58px]'}`}>
        <ProdutoThumb produto={produto} size={amplo ? 84 : 54} />
      </div>
      <div className="min-w-0 flex-1 text-left">
        <div
          className="font-black uppercase"
          style={{ color: '#111111', ...estiloNomeCompleto(produto.nome, amplo ? 10 : 7, amplo ? 6.2 : 4.8) }}
        >
          {produto.nome}
        </div>
        <div className="mt-0.5 text-[5.5px] font-bold uppercase" style={{ color: validade.cor }}>{labelDias(validade.dias)}</div>
        {desconto > 0 && <div className="mt-0.5 text-[5px] font-bold text-ink-soft">De <span className="line-through">{formatBRL(produto.precoNormal)}</span></div>}
        <div className="mt-1 inline-block rounded-md px-2 py-1" style={{ background: '#bf1721', color: '#ffc928' }}>
          <PrecoVarejo valor={preco} className={amplo ? 'text-[23px]' : 'text-[17px]'} cor="#ffc928" />
        </div>
      </div>
    </div>
  )
}

function CelulaVenc({ p, preco, desc }) {
  const s = statusValidade(p.validade)
  return (
    <div className="relative rounded-lg px-2 pb-2.5 pt-3 text-center" style={{ background: '#211c15', border: '1px solid #4a3f2c' }}>
      <span className="absolute -left-1 -top-1.5 z-10 rotate-[-8deg] rounded-full px-2 py-0.5 text-[7px] font-extrabold" style={{ background: '#000', border: '1px solid #d4a94e', color: '#ffd23f' }}>OFERTA INTERNA</span>
      {desc > 0 && <SeloDesconto texto={`-${desc}%`} size={46} className="absolute -right-2 -top-2.5 z-10" />}
      <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-lg bg-white p-1">
        <ProdutoThumb produto={p} size={56} />
      </div>
      <div className="mt-1 min-h-[22px] text-[8.5px] font-semibold uppercase leading-tight text-white">{p.nome}</div>
      <div className="text-[9px] line-through" style={{ color: '#9b8b83' }}>{formatBRL(p.precoNormal)}</div>
      <div className="mt-0.5 inline-block rotate-[-2deg] rounded-md bg-white px-2.5 py-0.5" style={{ boxShadow: '2px 2px 0 #c42b2b' }}>
        <PrecoVarejo valor={preco} className="text-2xl" cor="#c42b2b" />
      </div>
      <div className="mt-1 text-[7.5px] font-bold" style={{ color: '#ffd23f' }}>{labelDias(s.dias)}</div>
    </div>
  )
}

// ---- célula normal por setor — estilo encarte escuro ----
function CelulaSetor({ p, preco, desc }) {
  return (
    <div className="relative rounded-lg px-1.5 pb-2 pt-2.5 text-center" style={{ background: '#1d1a15', border: '1px solid #3a332a' }}>
      {desc > 0 && <SeloDesconto texto={`-${desc}%`} size={32} className="absolute -right-1.5 -top-2 z-10" />}
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-md bg-white p-0.5">
        <ProdutoThumb produto={p} size={44} />
      </div>
      <div className="mt-1 min-h-[18px] text-[7.5px] font-semibold uppercase leading-tight text-white">{p.nome}</div>
      <div className="mt-0.5 inline-block rotate-[-2deg] rounded bg-white px-1.5 py-0.5">
        <PrecoVarejo valor={preco} className="text-base" cor="#c42b2b" />
      </div>
    </div>
  )
}

// ---- bandeirinhas de festa junina (SVG, export-safe) ----
function Bandeirinhas() {
  const cores = ['#e23a2e', '#f2a93b', '#2e9e6b', '#2e6fb0', '#f47b36']
  const n = 16
  return (
    <svg viewBox={`0 0 ${n * 20} 20`} preserveAspectRatio="none" style={{ display: 'block', width: '100%', height: '16px', background: '#141414' }}>
      <line x1="0" y1="1" x2={n * 20} y2="1" stroke="#fbf6ee" strokeWidth="1" />
      {Array.from({ length: n }).map((_, i) => (
        <polygon key={i} points={`${i * 20},1 ${i * 20 + 20},1 ${i * 20 + 10},15`} fill={cores[i % cores.length]} />
      ))}
    </svg>
  )
}

// ---- faixa temática por evento sazonal ----
function BandaTema({ temaId }) {
  if (temaId === 'junina') {
    return (
      <div>
        <Bandeirinhas />
        <div className="flex items-center justify-center gap-2 px-4 py-1.5" style={{ background: '#d9641f' }}>
          <Icon name="Flame" size={14} className="text-cream" />
          <span className="text-[12px] font-bold tracking-wide text-cream">ARRAIÁ BENGALA · É CHEGADA A QUADRILHA</span>
          <Icon name="Wheat" size={14} className="text-cream" />
        </div>
      </div>
    )
  }
  const cfg = {
    copa: { bg: '#1c6e48', ic: ['Trophy', 'Star'], txt: 'ESQUENTA DA COPA · VAI, BRASIL!' },
    feijoada: { bg: '#7c2230', ic: ['Soup', 'Flame'], txt: 'FESTIVAL DA FEIJOADA · SABOR DE CASA' },
    diaB: { bg: '#e23a2e', ic: ['Zap', 'Star'], txt: 'DIA B · A SEXTA MAIS BARATA DO MÊS' },
  }[temaId]
  if (!cfg) return null
  return (
    <div className="flex items-center justify-center gap-2 px-4 py-1.5" style={{ background: cfg.bg }}>
      <Icon name={cfg.ic[0]} size={14} className="text-cream" />
      <span className="text-[12px] font-bold tracking-wide text-cream">{cfg.txt}</span>
      <Icon name={cfg.ic[1]} size={14} className="text-cream" />
    </div>
  )
}

// ---- sub-aba fila ----
function FilaView({ fila, vencimento, remover, salvarProduto, toast }) {
  const [editando, setEditando] = useState(null)
  if (fila.length === 0) {
    return <EmptyState icon="ListChecks" titulo="Fila vazia" descricao="Em Produtos ou Ofertas, use o botão de jornal para adicionar produtos aqui." />
  }
  const grupos = SETORES.map((s) => ({ setor: s, itens: fila.filter((p) => p.setor === s.id) })).filter((g) => g.itens.length)
  const salvarEdicao = () => {
    if (!editando?.nome?.trim()) return toast('Informe o nome do produto.', 'erro')
    if (!(Number(editando.precoNormal) > 0)) return toast('Informe um preço válido.', 'erro')
    salvarProduto({
      ...editando,
      estoque: Math.max(0, Number(editando.estoque) || 0),
      precoNormal: Number(editando.precoNormal),
      precoPromo: editando.precoPromo ? Number(editando.precoPromo) : null,
      naFila: true,
    })
    setEditando(null)
    toast('Produto corrigido na fila do jornal!')
  }

  const trocarImagem = (arquivo) => {
    if (!arquivo) return
    const leitor = new FileReader()
    leitor.onload = () => setEditando((produto) => ({
      ...produto,
      imagem: String(leitor.result || ''),
      imagemManual: true,
      imagemTratada: true,
      imagemTratamento: 'imagem-manual-livre-v1',
      imagemAltaResolucao: null,
      imagemOrigem: 'upload-manual',
    }))
    leitor.onerror = () => toast('Não foi possível ler a imagem.', 'erro')
    leitor.readAsDataURL(arquivo)
  }
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <div className="card-bengala p-3"><div className="text-xs text-ink-soft">Na fila</div><div className="text-xl font-bold text-ink">{fila.length}</div></div>
        <div className="card-bengala p-3"><div className="text-xs text-ink-soft">De vencimento</div><div className="text-xl font-bold text-critical">{vencimento.length}</div></div>
        <div className="card-bengala p-3"><div className="text-xs text-ink-soft">Setores</div><div className="text-xl font-bold text-ink">{grupos.length}</div></div>
      </div>
      {grupos.map((g) => (
        <div key={g.setor.id} className="card-bengala overflow-hidden">
          <div className="flex items-center gap-2 px-4 py-2" style={{ background: `${g.setor.cor}14`, color: g.setor.cor }}>
            <Icon name={g.setor.icone} size={16} /> <span className="font-bold">{g.setor.nome}</span>
            <span className="text-xs opacity-70">({g.itens.length})</span>
          </div>
          <div className="divide-y divide-ink-soft/8">
            {g.itens.map((p) => (
              <div key={p.id} className="flex items-center gap-3 px-4 py-2.5">
                <ProdutoThumb produto={p} size={36} />
                <div className="min-w-0 flex-1">
                  <div className="whitespace-normal break-words text-sm font-medium leading-snug text-ink">{p.nome}</div>
                  <div className="text-xs text-ink-soft">{p.marca}</div>
                </div>
                {p.origemFila === 'vencimento'
                  ? <Pill cor="#c42b2b" bg="#fbe5e5">Vencimento</Pill>
                  : p.origemFila === 'scanner'
                    ? <Pill cor="#1c6e48" bg="#e2f3ea">Confirmado no scanner</Pill>
                    : p.origemFila === 'oferta'
                      ? <Pill cor="#2e6fb0" bg="#e6f1fb">Oferta confirmada</Pill>
                    : <Pill>Manual</Pill>}
                <span className="text-sm font-medium">{formatBRL(p.precoPromo || p.precoNormal)}</span>
                <button onClick={() => setEditando({ ...p })} aria-label={`Editar ${p.nome}`} className="rounded p-1.5 text-info hover:bg-info/10"><Icon name="Pencil" size={15} /></button>
                <button onClick={() => { remover(p.id); toast('Removido da fila.', 'info') }} className="rounded p-1 text-critical hover:bg-critical/10"><Icon name="X" size={15} /></button>
              </div>
            ))}
          </div>
        </div>
      ))}
      <Modal
        open={Boolean(editando)}
        onClose={() => setEditando(null)}
        titulo="Editar produto da fila"
        footer={<><Botao variante="contorno" onClick={() => setEditando(null)}>Cancelar</Botao><Botao onClick={salvarEdicao}>Salvar correção</Botao></>}
      >
        {editando ? (
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2 flex items-center gap-3">
              <ProdutoThumb produto={editando} size={58} />
              <label className="cursor-pointer rounded-lg border border-ink-soft/20 bg-white px-3 py-2 text-sm font-bold text-ink">
                <Icon name="ImagePlus" size={14} className="mr-1 inline" /> Trocar imagem
                <input type="file" accept="image/*" className="sr-only" onChange={(evento) => trocarImagem(evento.target.files?.[0])} />
              </label>
            </div>
            <div className="col-span-2"><Campo label="Nome"><input className={inputCls} value={editando.nome || ''} onChange={(e) => setEditando((p) => ({ ...p, nome: e.target.value }))} /></Campo></div>
            <Campo label="Marca"><input className={inputCls} value={editando.marca || ''} onChange={(e) => setEditando((p) => ({ ...p, marca: e.target.value }))} /></Campo>
            <Campo label="Gramagem"><input className={inputCls} value={editando.gramagem || ''} onChange={(e) => setEditando((p) => ({ ...p, gramagem: e.target.value }))} /></Campo>
            <Campo label="Validade"><input type="date" className={inputCls} value={editando.validade || ''} onChange={(e) => setEditando((p) => ({ ...p, validade: e.target.value }))} /></Campo>
            <Campo label="Quantidade"><input type="number" min="0" className={inputCls} value={editando.estoque ?? ''} onChange={(e) => setEditando((p) => ({ ...p, estoque: e.target.value }))} /></Campo>
            <Campo label="Preço normal"><input type="number" min="0.01" step="0.01" className={inputCls} value={editando.precoNormal ?? ''} onChange={(e) => setEditando((p) => ({ ...p, precoNormal: e.target.value }))} /></Campo>
            <Campo label="Preço promocional"><input type="number" min="0.01" step="0.01" className={inputCls} value={editando.precoPromo ?? ''} onChange={(e) => setEditando((p) => ({ ...p, precoPromo: e.target.value }))} /></Campo>
          </div>
        ) : null}
      </Modal>
    </div>
  )
}

// ---- sub-aba jornal oficial ----
function OficialView({ jornal, atualizar, url, toast }) {
  const [edicao, setEdicao] = useState('')
  const [capa, setCapa] = useState('')
  const [contracapa, setContracapa] = useState('')
  const [syncing, setSyncing] = useState(false)
  const [statusAuto, setStatusAuto] = useState('idle') // idle | ok | erro | indisponivel

  // busca a edição mais recente no backend (/api/jornal-oficial)
  const sincronizarAuto = async (silencioso = false) => {
    setSyncing(true)
    try {
      const r = await fetch('/api/jornal-oficial', { headers: { Accept: 'application/json' } })
      if (!r.ok) throw new Error('http ' + r.status)
      const d = await r.json()
      if (d.error || !d.capa) throw new Error(d.error || 'sem capa')
      // só troca quando a edição encontrada é ESTRITAMENTE mais nova (ano+mês).
      // sem ym salvo, tratamos como igual — nunca sobrescreve o seed à toa.
      const conhecido = jornal.ym ?? d.ym
      const novaEdicao = d.ym && d.ym > conhecido
      if (novaEdicao) {
        atualizar({ edicao: d.edicao, titulo: d.titulo, data: d.data, ym: d.ym, capa: d.capa, contracapa: d.contracapa, pdf: d.pdf, atualizadoEm: d.atualizadoEm })
        toast(`Nova edição encontrada: ${d.edicao}`)
      } else {
        atualizar({ atualizadoEm: d.atualizadoEm, ym: jornal.ym || d.ym })
        if (!silencioso) toast('Já está na edição mais recente.', 'info')
      }
      setStatusAuto('ok')
    } catch (e) {
      // em build estático sem /api o fetch falha — modo manual continua valendo
      setStatusAuto(silencioso ? 'indisponivel' : 'erro')
      if (!silencioso) toast('Não consegui buscar automático. Use o modo manual.', 'erro')
    } finally {
      setSyncing(false)
    }
  }

  // tentativa automática e silenciosa ao abrir a aba
  useEffect(() => { sincronizarAuto(true) }, [])

  const sincronizarManual = () => {
    if (!capa) return toast('Informe ao menos a URL da capa.', 'erro')
    atualizar({ edicao: edicao || jornal.edicao, capa, contracapa, data: dataISOmaisDias(0), titulo: 'Jornal de Ofertas SEMANA B!' })
    toast('Jornal oficial atualizado!')
  }

  const Img = ({ src, label }) =>
    src ? (
      <a href={src} target="_blank" rel="noreferrer" className="group block overflow-hidden rounded-xl border border-ink-soft/15 bg-white">
        <img src={src} alt={label} className="h-64 w-full object-cover object-top transition group-hover:scale-[1.02]" onError={(e) => (e.currentTarget.style.display = 'none')} />
        <div className="px-3 py-2 text-center text-sm font-medium text-ink">{label} <Icon name="ExternalLink" size={12} className="ml-1 inline text-ink-soft" /></div>
      </a>
    ) : null

  return (
    <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-bold text-ink">{jornal.titulo}</h2>
            <p className="text-sm text-ink-soft">Edição {jornal.edicao} · {formatData(jornal.data)}</p>
          </div>
          <div className="flex items-center gap-2">
            {jornal.pdf && (
              <a href={jornal.pdf} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 rounded-lg border border-ink-soft/20 bg-white px-3 py-1.5 text-sm font-medium text-info hover:bg-cream-200">
                <Icon name="FileText" size={15} /> Ver PDF completo
              </a>
            )}
            {jornal.novo && <Pill cor="#2e9e6b" bg="#e2f3ea">NOVO</Pill>}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Img src={jornal.capa} label="Capa" />
          <Img src={jornal.contracapa} label="Contracapa" />
        </div>
        {jornal.historico?.length > 0 && (
          <div className="card-bengala p-3">
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-ink-soft">Edições anteriores</p>
            <div className="flex flex-wrap gap-2">
              {jornal.historico.map((h, i) => (
                <a key={i} href={h.capa} target="_blank" rel="noreferrer" className="rounded-lg bg-cream-200 px-2.5 py-1 text-xs text-ink hover:bg-coral/15">Edição {h.edicao}</a>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="card-bengala h-fit space-y-3 p-4">
        <div className="flex items-center gap-2"><Icon name="RefreshCw" size={16} className="text-bengala" /><h3 className="font-bold text-ink">Sincronizar jornal oficial</h3></div>

        <Botao className="w-full" onClick={() => sincronizarAuto(false)} disabled={syncing}>
          <Icon name={syncing ? 'Loader' : 'RefreshCw'} size={15} className={syncing ? 'animate-spin' : ''} />
          {syncing ? 'Buscando no site...' : 'Buscar edição mais recente'}
        </Botao>

        {statusAuto === 'ok' && jornal.atualizadoEm && (
          <p className="flex items-center gap-1 text-[11px] text-success"><Icon name="CheckCircle2" size={12} /> Sincronizado {new Date(jornal.atualizadoEm).toLocaleString('pt-BR')}</p>
        )}
        {statusAuto === 'erro' && <p className="text-[11px] text-critical">Não consegui buscar agora. Use o modo manual abaixo.</p>}
        {statusAuto === 'indisponivel' && (
          <p className="rounded-lg bg-cream-200 p-2 text-[11px] leading-snug text-ink-soft">
            <Icon name="Info" size={12} className="mr-1 inline" /> Auto disponível ao rodar o app com servidor (<code>npm run dev</code>) ou hospedado com a função <code>/api</code>. Sem servidor, use o modo manual.
          </p>
        )}

        <div className="space-y-2.5 border-t border-ink-soft/10 pt-3">
          <p className="text-xs text-ink-soft">
            Ou informe manualmente (de <a href={url} target="_blank" rel="noreferrer" className="text-info underline">{url}</a>):
          </p>
          <Campo label="Edição"><input className={inputCls} value={edicao} onChange={(e) => setEdicao(e.target.value)} placeholder="B · 02.07–08.07" /></Campo>
          <Campo label="URL da capa"><input className={inputCls} value={capa} onChange={(e) => setCapa(e.target.value)} placeholder="https://...capa-scaled.jpg" /></Campo>
          <Campo label="URL da contracapa"><input className={inputCls} value={contracapa} onChange={(e) => setContracapa(e.target.value)} placeholder="https://...contra-scaled.jpg" /></Campo>
          <Botao variante="contorno" className="w-full" onClick={sincronizarManual}><Icon name="Save" size={15} /> Salvar manual</Botao>
        </div>
      </div>
    </div>
  )
}
