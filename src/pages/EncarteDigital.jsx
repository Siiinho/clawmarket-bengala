import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Icon, Logo, PrecoVarejo } from '../components/ui'
import { SETORES, setorById, formatBRL, formatData } from '../lib/utils'
import { carregarEncartePublicado, assinarEncarte, linkDoEncarte } from '../lib/encartePublico'
import { temaCampanhaById } from '../lib/temasCampanha'
import SeloArte from '../components/SeloArte'
import { SimboloClawMarket } from '../components/MarcaClawMarket'
import PaginaTemplate, { Escalado, paginarTemplate } from '../components/PaginaTemplate'
import { LOJAS } from '../data/seed'

// Encarte digital público: a página que a tag NFC abre.
// Feita para celular primeiro, com alto contraste e letras grandes.
// Atualiza sozinha quando uma nova versão é publicada no Jornal (o servidor avisa na hora).
// Motion design: as páginas do encarte se montam ao aparecer na tela, o preço pulsa e o
// selo balança. Cada produto abre uma prévia própria (deslize para o lado para ver o próximo),
// com link direto (#/encarte?p=<id>) para compartilhar.

const horaCurta = (iso) =>
  iso ? new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : ''

function TagSelo({ produto, grande = false }) {
  return <SeloArte produto={produto} largura={grande ? 150 : 96} />
}

function FotoProduto({ produto, className = '' }) {
  const setor = setorById(produto.setor)
  if (produto.imagem) {
    return <img src={produto.imagem} alt={produto.nome} loading="lazy" decoding="async" className={`h-full w-full object-contain ${className}`} />
  }
  return (
    <div className={`flex h-full w-full items-center justify-center ${className}`} style={{ color: setor.cor }}>
      <Icon name={setor.icone} size={48} />
    </div>
  )
}

function SeloPreco({ valor, tema, grande = false }) {
  return (
    <span
      className={`inline-flex items-center justify-center rounded-[50%] ${grande ? 'px-7 py-3' : 'px-4 py-1.5'}`}
      style={{ background: tema.precoFundo, boxShadow: `3px 4px 0 ${tema.precoSombra}`, transform: 'rotate(-3deg)' }}
    >
      <PrecoVarejo valor={valor} className={grande ? 'text-[44px] leading-none' : 'text-[26px] leading-none'} cor={tema.precoCor} />
    </span>
  )
}

function CartaoProduto({ produto, onAbrir, tema, indice = 0 }) {
  const desconto = Number(produto.descontoJornal) || 0
  const temDe = desconto > 0 && Number(produto.precoNormal) > Number(produto.precoJornal)
  return (
    <button
      type="button"
      onClick={() => onAbrir(produto)}
      className="cm-cartao group relative flex flex-col overflow-hidden rounded-2xl border-2 border-navy/15 bg-white text-left shadow-sm focus:outline-none focus-visible:ring-4 focus-visible:ring-offer"
      style={{ '--cm-i': Math.min(indice, 12) }}
      aria-label={`Ver oferta: ${produto.nome}`}
    >
      <div className="relative aspect-square w-full bg-white p-3">
        <FotoProduto produto={produto} />
        <div className="absolute left-2 top-2"><TagSelo produto={produto} /></div>
        {desconto > 0 && (
          <span className="absolute right-2 top-2 flex h-12 w-12 items-center justify-center rounded-full bg-bengala text-sm font-black text-white shadow">
            -{desconto}%
          </span>
        )}
      </div>
      <div className="flex flex-1 flex-col gap-1 border-t-2 border-navy/10 p-3">
        <div className="line-clamp-3 text-[15px] font-extrabold uppercase leading-tight text-navy">{produto.nome}</div>
        {produto.gramagem && <div className="text-xs font-semibold text-ink-soft">{produto.gramagem}</div>}
        <div className="mt-auto pt-1">
          {temDe && (
            <div className="text-sm font-bold text-ink-soft">
              De <span className="line-through">{formatBRL(produto.precoNormal)}</span>
            </div>
          )}
          <div className="mt-1"><span className="cm-preco-lista"><SeloPreco valor={produto.precoJornal} tema={tema} /></span></div>
        </div>
      </div>
    </button>
  )
}

const soDigitos = (v) => String(v || '').replace(/\D/g, '')

function PreviewProduto({ produto, lista, onTrocar, onFechar, tema, encarte, loja }) {
  const indice = produto ? lista.findIndex((p) => p.id === produto.id) : -1
  const anterior = indice > 0 ? lista[indice - 1] : null
  const proximo = indice >= 0 && indice < lista.length - 1 ? lista[indice + 1] : null
  const toque = useRef(null)
  const [copiado, setCopiado] = useState(false)
  const [direcao, setDirecao] = useState(0)

  const ir = useCallback((alvo, lado) => { if (alvo) { setDirecao(lado); onTrocar(alvo) } }, [onTrocar])

  useEffect(() => {
    if (!produto) return undefined
    const teclas = (e) => {
      if (e.key === 'Escape') onFechar()
      else if (e.key === 'ArrowRight') ir(proximo, 1)
      else if (e.key === 'ArrowLeft') ir(anterior, -1)
    }
    window.addEventListener('keydown', teclas)
    const overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { window.removeEventListener('keydown', teclas); document.body.style.overflow = overflow }
  }, [produto, onFechar, ir, proximo, anterior])

  useEffect(() => { setCopiado(false) }, [produto?.id])

  if (!produto) return null
  const setor = setorById(produto.setor)
  const desconto = Number(produto.descontoJornal) || 0
  const economia = Number(produto.precoNormal) - Number(produto.precoJornal)
  const linkProduto = `${linkDoEncarte()}?p=${encodeURIComponent(produto.id)}`
  const textoOferta = `${produto.nome}${produto.gramagem ? ` ${produto.gramagem}` : ''} por ${formatBRL(produto.precoJornal)}${encarte?.mercado ? ` no ${encarte.mercado}` : ''}`
  const whats = soDigitos(loja?.whatsapp)
  const linkWhats = whats ? `https://wa.me/${whats.length <= 11 ? `55${whats}` : whats}?text=${encodeURIComponent(`Olá! Vi no encarte: ${textoOferta}.`)}` : null

  const compartilhar = async () => {
    try {
      if (navigator.share) {
        await navigator.share({ title: produto.nome, text: textoOferta, url: linkProduto })
        return
      }
    } catch (erro) {
      if (erro?.name === 'AbortError') return
    }
    try {
      await navigator.clipboard.writeText(`${textoOferta}\n${linkProduto}`)
      setCopiado(true)
    } catch (_) {
      window.prompt('Copie o link da oferta:', linkProduto)
    }
  }

  const inicioToque = (e) => { const t = e.touches[0]; toque.current = { x: t.clientX, y: t.clientY } }
  const fimToque = (e) => {
    if (!toque.current) return
    const t = e.changedTouches[0]
    const dx = t.clientX - toque.current.x
    const dy = t.clientY - toque.current.y
    toque.current = null
    if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.4) ir(dx < 0 ? proximo : anterior, dx < 0 ? 1 : -1)
  }

  const botaoSeta = (alvo, lado) => (
    <button
      type="button"
      onClick={() => ir(alvo, lado)}
      disabled={!alvo}
      aria-label={lado > 0 ? 'Próxima oferta' : 'Oferta anterior'}
      className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-navy text-white disabled:opacity-25"
    >
      <Icon name={lado > 0 ? 'ChevronRight' : 'ChevronLeft'} size={26} />
    </button>
  )

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 backdrop-blur-sm sm:items-center sm:p-6" onClick={onFechar} role="dialog" aria-modal="true" aria-label={produto.nome}>
      <div
        className="cm-folha max-h-[94vh] w-full overflow-y-auto rounded-t-3xl bg-white pb-[max(1rem,env(safe-area-inset-bottom))] sm:max-w-lg sm:rounded-3xl"
        onClick={(e) => e.stopPropagation()}
        onTouchStart={inicioToque}
        onTouchEnd={fimToque}
      >
        <div className="sticky top-0 z-10 flex items-center justify-between gap-2 bg-white px-4 pb-2 pt-3">
          <div className="mx-auto mb-1 h-1.5 w-12 rounded-full bg-navy/15 sm:hidden" aria-hidden="true" style={{ position: 'absolute', left: 0, right: 0, top: 6 }} />
          <span className="mt-2 rounded-full px-3 py-1 text-xs font-black uppercase text-white" style={{ background: setor.cor }}>{setor.nome}</span>
          {lista.length > 1 && <span className="mt-2 text-sm font-black text-navy" aria-live="polite">{indice + 1} de {lista.length}</span>}
          <button type="button" onClick={onFechar} className="mt-2 flex h-11 w-11 items-center justify-center rounded-full bg-navy text-white" aria-label="Fechar">
            <Icon name="X" size={22} />
          </button>
        </div>

        <div key={produto.id} className="cm-troca-produto" style={{ '--cm-lado': direcao }}>
          <div className="relative mx-4 h-[36vh] min-h-56 overflow-hidden rounded-2xl sm:aspect-square sm:h-auto border-2 border-navy/10 bg-white p-4" style={{ background: `radial-gradient(circle at 50% 45%, #fff 0 45%, ${setor.cor}1f 100%)` }}>
            <div className="cm-foto-preview h-full w-full"><FotoProduto produto={produto} /></div>
            {desconto > 0 && (
              <span className="cm-preco-preview absolute right-3 top-3 flex h-16 w-16 items-center justify-center rounded-full bg-bengala text-lg font-black text-white shadow-lg">
                -{desconto}%
              </span>
            )}
            <div className="absolute left-2 top-2"><TagSelo produto={produto} /></div>
          </div>
          <div className="space-y-3 px-5 pt-4">
            <h2 className="text-2xl font-black uppercase leading-tight text-navy">{produto.nome}</h2>
            {(produto.marca || produto.gramagem) && (
              <p className="text-base font-semibold text-ink-soft">{[produto.marca, produto.gramagem].filter(Boolean).join(' · ')}</p>
            )}
            <div className="relative overflow-hidden rounded-2xl p-4 text-white" style={{ background: tema.fundo }}>
              {desconto > 0 && (
                <div className="text-base font-bold text-white/85">
                  De <span className="line-through">{formatBRL(produto.precoNormal)}</span> por
                </div>
              )}
              <div className="mt-1"><span className="cm-preco-preview inline-block"><SeloPreco valor={produto.precoJornal} tema={tema} grande /></span></div>
              {economia > 0.009 && (
                <div className="mt-3 text-base font-black" style={{ color: tema.corDestaque }}>Você economiza {formatBRL(economia)}</div>
              )}
            </div>
          </div>
        </div>

        <div className="space-y-3 px-5 pt-4">
          <div className="grid grid-cols-2 gap-2">
            <button type="button" onClick={compartilhar} className="flex items-center justify-center gap-2 rounded-xl border-2 border-navy px-3 py-3 text-base font-black text-navy">
              <Icon name={copiado ? 'Check' : 'Share2'} size={20} /> {copiado ? 'Link copiado' : 'Compartilhar'}
            </button>
            {linkWhats ? (
              <a href={linkWhats} target="_blank" rel="noreferrer" className="flex items-center justify-center gap-2 rounded-xl bg-[#128c4a] px-3 py-3 text-base font-black text-white">
                <Icon name="MessageCircle" size={20} /> WhatsApp
              </a>
            ) : <span />}
          </div>
          {lista.length > 1 && (
            <div className="flex items-center justify-between gap-3">
              {botaoSeta(anterior, -1)}
              <span className="text-center text-xs font-bold text-ink-soft">Deslize para o lado para ver outras ofertas</span>
              {botaoSeta(proximo, 1)}
            </div>
          )}
          <p className="text-sm text-ink-soft">Oferta válida enquanto durar o estoque. Imagem ilustrativa.</p>
        </div>
      </div>
    </div>
  )
}

// Liga a animação de uma página do encarte só quando ela aparece na tela.
function PaginaViva({ children }) {
  const ref = useRef(null)
  const [visivel, setVisivel] = useState(false)
  useEffect(() => {
    const el = ref.current
    if (!el || typeof IntersectionObserver === 'undefined') { setVisivel(true); return undefined }
    const io = new IntersectionObserver(([e]) => setVisivel(e.isIntersecting), { threshold: 0.15 })
    io.observe(el)
    return () => io.disconnect()
  }, [])
  return <div ref={ref} className={visivel ? '' : 'cm-pausado'}>{children}</div>
}

export default function EncarteDigital() {
  const [encarte, setEncarte] = useState(null)
  const [carregando, setCarregando] = useState(true)
  const [setorFiltro, setSetorFiltro] = useState('todos')
  const [params, setParams] = useSearchParams()
  const [acabouDeAtualizar, setAcabouDeAtualizar] = useState(false)
  const [modo, setModo] = useState('encarte')

  useEffect(() => {
    let ativo = true
    let versaoAtual = null
    const recarregar = async (versaoAvisada) => {
      if (versaoAvisada && versaoAvisada === versaoAtual) return
      const novo = await carregarEncartePublicado()
      if (!ativo) return
      setCarregando(false)
      if (novo?.versao === versaoAtual) return
      if (versaoAtual !== null) {
        setAcabouDeAtualizar(true)
        setTimeout(() => ativo && setAcabouDeAtualizar(false), 6000)
      }
      versaoAtual = novo?.versao ?? null
      setEncarte(novo)
    }
    recarregar()
    const cancelar = assinarEncarte(recarregar)
    return () => { ativo = false; cancelar() }
  }, [])

  const itens = encarte?.itens || []
  const tema = temaCampanhaById(encarte?.tema)
  const setoresPresentes = useMemo(
    () => SETORES.filter((s) => itens.some((p) => p.setor === s.id)),
    [itens]
  )
  const visiveis = setorFiltro === 'todos' ? itens : itens.filter((p) => p.setor === setorFiltro)
  const grupos = setorFiltro === 'todos'
    ? setoresPresentes.map((s) => ({ setor: s, itens: itens.filter((p) => p.setor === s.id) }))
    : [{ setor: setorById(setorFiltro), itens: visiveis }]
  const layout = encarte?.layout || 'grade'
  const paginas = paginarTemplate(visiveis, layout)
  const loja = encarte?.loja || LOJAS[0]

  // produto aberto fica no endereço (#/encarte?p=<id>): dá para compartilhar e o botão voltar fecha
  const idAberto = params.get('p')
  const aberto = idAberto ? itens.find((p) => String(p.id) === idAberto) || null : null
  const abrir = useCallback((produto) => {
    setParams((atual) => {
      const novo = new URLSearchParams(atual)
      novo.set('p', String(produto.id))
      return novo
    }, { replace: params.has('p') })
  }, [setParams, params])
  const fechar = useCallback(() => {
    setParams((atual) => {
      const novo = new URLSearchParams(atual)
      novo.delete('p')
      return novo
    }, { replace: true })
  }, [setParams])
  const listaPreview = aberto && !visiveis.some((p) => p.id === aberto.id) ? itens : visiveis

  return (
    <div className="min-h-screen" style={{ background: tema.fundo, backgroundAttachment: 'fixed' }}>
      <header className="bg-black/30 text-white backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 pb-3 pt-[max(.75rem,env(safe-area-inset-top))]">
          <div className="flex min-w-0 items-center gap-3">
            <Logo h={40} chip />
            <div className="min-w-0">
              <div className="truncate text-base font-black uppercase sm:text-lg">{tema.titulo} {tema.destaque}</div>
              {encarte?.periodoDe && <div className="text-xs font-bold text-white/85 sm:text-sm">Válido de {formatData(encarte.periodoDe)} a {formatData(encarte.periodoAte)}</div>}
            </div>
          </div>
          {encarte?.publicadoEm && (
            <span className="flex shrink-0 items-center gap-2 rounded-full bg-black/35 px-3 py-1.5 text-xs font-bold">
              <span className="relative flex h-2.5 w-2.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white opacity-75" />
                <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-white" />
              </span>
              <span className="hidden sm:inline">{acabouDeAtualizar ? 'Atualizado agora' : `Atualizado às ${horaCurta(encarte.publicadoEm)}`}</span>
              <span className="sm:hidden">{acabouDeAtualizar ? 'Agora' : horaCurta(encarte.publicadoEm)}</span>
            </span>
          )}
        </div>
      </header>

      {itens.length > 0 && (
        <nav className="sticky top-0 z-20 border-b-2 border-navy/10 bg-white/95 backdrop-blur" aria-label="Seções do mercado">
          <div className="mx-auto flex max-w-6xl gap-2 overflow-x-auto px-4 py-3">
            <div className="flex shrink-0 overflow-hidden rounded-full border-2 border-navy" role="group" aria-label="Modo de visualização">
              {[['encarte', 'Encarte'], ['lista', 'Lista']].map(([id, rotulo]) => (
                <button key={id} type="button" onClick={() => setModo(id)} aria-pressed={modo === id} className={`px-4 py-2 text-sm font-black ${modo === id ? 'bg-navy text-white' : 'bg-white text-navy'}`}>
                  {rotulo}
                </button>
              ))}
            </div>
            <span className="w-px shrink-0 bg-navy/15" />
            <button
              type="button"
              onClick={() => setSetorFiltro('todos')}
              className={`shrink-0 rounded-full border-2 px-4 py-2 text-sm font-black ${setorFiltro === 'todos' ? 'border-navy bg-navy text-white' : 'border-navy/20 bg-white text-navy'}`}
            >
              Todas ({itens.length})
            </button>
            {setoresPresentes.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => setSetorFiltro(s.id)}
                className="shrink-0 rounded-full border-2 px-4 py-2 text-sm font-black"
                style={setorFiltro === s.id ? { background: s.cor, borderColor: s.cor, color: '#fff' } : { borderColor: `${s.cor}66`, color: s.corTag, background: '#fff' }}
              >
                {s.nome}
              </button>
            ))}
          </div>
        </nav>
      )}

      <main className="mx-auto max-w-6xl px-3 py-5 sm:px-4">
        {carregando ? (
          <p className="py-20 text-center text-lg font-bold text-white">Carregando ofertas…</p>
        ) : !itens.length ? (
          <div className="rounded-3xl bg-white px-4 py-16 text-center">
            <Icon name="Newspaper" size={48} className="mx-auto text-navy" />
            <p className="mt-3 text-xl font-black text-navy">Nenhuma oferta publicada ainda.</p>
            <p className="mt-1 text-base text-ink-soft">Assim que o mercado publicar, as ofertas aparecem aqui.</p>
          </div>
        ) : modo === 'encarte' ? (
          <div className="grid gap-6 lg:grid-cols-2">
            {paginas.map((pagina, i) => (
              <div key={`${encarte.versao}-${setorFiltro}-${i}`} className="min-w-0 overflow-hidden rounded-2xl shadow-2xl ring-1 ring-black/10">
                <PaginaViva>
                  <Escalado>
                    <PaginaTemplate animado tema={tema} itens={pagina} encarte={encarte} loja={loja} fundo={encarte?.fundo} layout={layout} numero={i + 1} total={paginas.length} onAbrir={abrir} />
                  </Escalado>
                </PaginaViva>
              </div>
            ))}
          </div>
        ) : (
          <div key={encarte.versao} className="space-y-8">
            {grupos.map((g) => (
              <section key={g.setor.id} aria-labelledby={`sec-${g.setor.id}`}>
                <h2 id={`sec-${g.setor.id}`} className="mb-3 flex items-center gap-2 rounded-xl px-4 py-2.5 text-lg font-black uppercase tracking-wide text-white" style={{ background: g.setor.cor }}>
                  <Icon name={g.setor.icone} size={22} /> {g.setor.nome}
                </h2>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                  {g.itens.map((p, i) => <CartaoProduto key={p.id} produto={p} indice={i} onAbrir={abrir} tema={tema} />)}
                </div>
              </section>
            ))}
          </div>
        )}
      </main>

      <footer className="mx-auto max-w-6xl px-4 pb-10 pt-2 text-center text-sm font-semibold text-white" style={{ textShadow: '0 1px 2px rgba(0,0,0,.5)' }}>
        Ofertas válidas enquanto durar o estoque. Imagens ilustrativas.
        <div className="mt-4 flex items-center justify-center gap-1.5 text-xs font-bold text-white/90">
          <SimboloClawMarket tamanho={18} /> Encarte digital por ClawMarket
        </div>
      </footer>

      {acabouDeAtualizar && (
        <div className="pointer-events-none fixed inset-x-0 bottom-0 z-40 flex justify-center px-4 pb-[max(1rem,env(safe-area-inset-bottom))]" role="status">
          <div className="cm-faixa-nova flex items-center gap-2 rounded-full bg-offer px-5 py-3 text-base font-black uppercase text-navy shadow-2xl ring-4 ring-white">
            <Icon name="Sparkles" size={20} /> Ofertas atualizadas agora!
          </div>
        </div>
      )}

      <PreviewProduto produto={aberto} lista={listaPreview} onTrocar={abrir} onFechar={fechar} tema={tema} encarte={encarte} loja={loja} />
    </div>
  )
}
