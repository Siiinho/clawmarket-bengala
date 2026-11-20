import { useMemo, useRef, useState } from 'react'
import { Icon, Botao, EmptyState } from './ui'
import PaginaTemplate, { Escalado, FORMATOS, paginarTemplate } from './PaginaTemplate'
import { FolhaCartazes, FOLHA_A4, TAMANHOS_CARTAZ, paginarCartazes } from './Cartaz'
import { temaCampanhaById } from '../lib/temasCampanha'
import SeletorTema from './SeletorTema'
import { exportarPNG, exportarPDFPaginas, gerarPNG } from '../lib/exportar'

// Central de artes: a mesma lista de ofertas vira Feed, Stories, TV, post por oferta,
// cartazes A4 a A7 e etiquetas de gôndola. Cada arte baixa em PNG (ou PDF para imprimir)
// e, no celular, pode ser compartilhada direto no WhatsApp ou Instagram.

const SAIDAS = [
  ...Object.values(FORMATOS).map((f) => ({ id: f.id, nome: f.nome, sub: `${f.proporcao} · ${f.uso}`, icone: f.icone })),
  { id: 'cartaz', nome: 'Cartaz', sub: 'A4, A5, A6 ou A7 para imprimir', icone: 'FileText' },
  { id: 'etiqueta', nome: 'Etiquetas', sub: 'Preço de gôndola, 24 por folha', icone: 'Tags' },
]

const slug = (t) => String(t || 'arte').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 50) || 'arte'
const esperar = (ms) => new Promise((r) => setTimeout(r, ms))

export default function CentralArtes({ itens, titulo, encarte, loja, temaId, setTemaId, layout, setLayout, fundo, toast }) {
  const [saida, setSaida] = useState('feed')
  const [tamanho, setTamanho] = useState('A5')
  const [excluidos, setExcluidos] = useState(() => new Set())
  const [ocupado, setOcupado] = useState(null)
  const refs = useRef([])
  const tema = temaCampanhaById(temaId)

  const impressao = saida === 'cartaz' || saida === 'etiqueta'
  const tamanhoAtual = saida === 'etiqueta' ? 'etiqueta' : tamanho
  const dim = impressao ? FOLHA_A4 : FORMATOS[saida]
  const selecionados = itens.filter((p) => !excluidos.has(p.id))
  const paginas = useMemo(
    () => (impressao ? paginarCartazes(selecionados, tamanhoAtual) : paginarTemplate(selecionados, layout, saida)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [impressao, tamanhoAtual, layout, saida, selecionados.map((p) => `${p.id}:${p.precoJornal}:${p.seloOferta}:${p.unidade}:${p.imagem?.length || 0}`).join('|')],
  )
  const temConteudo = selecionados.length > 0
  const podeCompartilhar = typeof navigator !== 'undefined' && typeof navigator.canShare === 'function'

  const nomeArquivo = (i) => {
    if (saida === 'post') return `oferta-${slug(paginas[i]?.[0]?.nome)}`
    const base = `${slug(titulo)}-${impressao ? (saida === 'etiqueta' ? 'etiquetas' : `cartaz-${tamanho.toLowerCase()}`) : saida}`
    return paginas.length > 1 ? `${base}-${i + 1}` : base
  }
  // Redes sociais: tamanho exato do formato. Impressão: alta resolução.
  const opcoesPNG = impressao ? undefined : { escala: 1 }

  const executar = async (rotulo, fn) => {
    if (ocupado) return
    setOcupado(rotulo)
    try {
      await fn()
    } catch (erro) {
      if (erro?.name !== 'AbortError') toast(erro?.message || 'Não foi possível gerar a arte.', 'erro')
    } finally {
      setOcupado(null)
    }
  }

  const baixar = (i) => executar(`png-${i}`, async () => {
    const r = await exportarPNG(refs.current[i], nomeArquivo(i), opcoesPNG)
    setTimeout(() => URL.revokeObjectURL(r.url), 60000)
  })

  const baixarTodas = () => executar('todas', async () => {
    // Guarda as páginas e os nomes do momento do clique.
    const els = refs.current.slice(0, paginas.length)
    const nomes = paginas.map((_, i) => nomeArquivo(i))
    for (let i = 0; i < els.length; i += 1) {
      const r = await exportarPNG(els[i], nomes[i], opcoesPNG)
      setTimeout(() => URL.revokeObjectURL(r.url), 60000)
      await esperar(400)
    }
    toast(`${paginas.length} ${paginas.length === 1 ? 'arte baixada' : 'artes baixadas'}.`)
  })

  const compartilhar = (indices) => executar('compartilhar', async () => {
    const arquivos = []
    for (const i of indices) {
      const blob = await gerarPNG(refs.current[i], opcoesPNG)
      arquivos.push(new File([blob], `${nomeArquivo(i)}.png`, { type: 'image/png' }))
    }
    if (!navigator.canShare?.({ files: arquivos })) throw new Error('Este aparelho não permite compartilhar imagens. Use Baixar PNG.')
    await navigator.share({ files: arquivos, title: titulo })
  })

  const baixarPDF = () => executar('pdf', async () => {
    const r = await exportarPDFPaginas(refs.current.slice(0, paginas.length), impressao ? nomeArquivo(0).replace(/-\d+$/, '') : `${slug(titulo)}-${saida}`)
    setTimeout(() => URL.revokeObjectURL(r.url), 60000)
  })

  const alternar = (id) => setExcluidos((s) => {
    const n = new Set(s)
    if (n.has(id)) n.delete(id)
    else n.add(id)
    return n
  })

  const renderPagina = (pagina, i, comRef) => (impressao ? (
    <FolhaCartazes ref={comRef ? (el) => { refs.current[i] = el } : undefined} itens={pagina} tamanho={tamanhoAtual} encarte={encarte} />
  ) : (
    <div ref={comRef ? (el) => { refs.current[i] = el } : undefined} style={{ width: dim.largura, height: dim.altura }}>
      <PaginaTemplate tema={tema} itens={pagina} encarte={encarte} loja={loja} fundo={fundo} layout={layout} formato={saida} numero={saida === 'post' ? null : i + 1} total={paginas.length} />
    </div>
  ))

  const colunasPrevia = saida === 'tv' ? 'lg:grid-cols-2' : saida === 'stories' ? 'sm:grid-cols-2 xl:grid-cols-4' : 'sm:grid-cols-2 xl:grid-cols-3'

  return (
    <div className="space-y-5">
      {/* 1. formato */}
      <div className="card-bengala p-4">
        <p className="mb-2 text-sm font-black uppercase tracking-wide text-ink">1. O que você quer gerar?</p>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
          {SAIDAS.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => setSaida(s.id)}
              disabled={!!ocupado}
              aria-pressed={saida === s.id}
              className={`flex flex-col items-start gap-1 rounded-xl border-2 p-3 text-left transition ${saida === s.id ? 'border-bengala bg-bengala/5' : 'border-ink-soft/15 bg-white hover:border-ink-soft/35'}`}
            >
              <Icon name={s.icone} size={22} className={saida === s.id ? 'text-bengala' : 'text-ink-soft'} />
              <span className="text-sm font-black text-ink">{s.nome}</span>
              <span className="text-xs leading-snug text-ink-soft">{s.sub}</span>
            </button>
          ))}
        </div>

        {saida === 'cartaz' && (
          <div className="mt-4">
            <p className="mb-1.5 text-xs font-bold uppercase tracking-wide text-ink-soft">Tamanho do cartaz</p>
            <div className="flex flex-wrap gap-2">
              {['A4', 'A5', 'A6', 'A7'].map((id) => (
                <button key={id} type="button" onClick={() => setTamanho(id)} disabled={!!ocupado} aria-pressed={tamanho === id}
                  className={`rounded-lg border-2 px-4 py-2 text-sm font-black ${tamanho === id ? 'border-navy bg-navy text-white' : 'border-navy/20 bg-white text-navy'}`}>
                  {id} <span className="font-medium opacity-80">· {TAMANHOS_CARTAZ[id].desc}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {!impressao && (
          <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-[minmax(0,1fr)_auto]">
            <div>
              <p className="mb-1.5 text-xs font-bold uppercase tracking-wide text-ink-soft">Campanha</p>
              <SeletorTema value={temaId} onChange={setTemaId} />
            </div>
            {saida !== 'post' && (
              <div>
                <p className="mb-1.5 text-xs font-bold uppercase tracking-wide text-ink-soft">Arrumação</p>
                <div className="grid grid-cols-2 gap-1.5 md:grid-cols-1">
                  {[['grade', 'Todos iguais'], ['destaque', '1 em destaque']].map(([id, l]) => (
                    <button key={id} type="button" onClick={() => setLayout(id)} aria-pressed={layout === id}
                      className={`rounded-lg border-2 px-3 py-2 text-xs font-black ${layout === id ? 'border-navy bg-navy text-white' : 'border-navy/20 bg-white text-navy'}`}>
                      {l}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* 2. produtos */}
      <div className="card-bengala p-4">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm font-black uppercase tracking-wide text-ink">2. Quais ofertas entram? <span className="font-medium normal-case text-ink-soft">({selecionados.length} de {itens.length})</span></p>
          <div className="flex gap-2 text-xs font-bold">
            <button type="button" className="text-bengala" onClick={() => setExcluidos(new Set())}>Marcar todas</button>
            <button type="button" className="text-ink-soft" onClick={() => setExcluidos(new Set(itens.map((p) => p.id)))}>Desmarcar</button>
          </div>
        </div>
        {itens.length === 0 ? (
          <EmptyState icon="ScanBarcode" titulo="Nenhuma oferta na lista" descricao="Bipe os produtos no topo da página. Eles aparecem aqui para virar arte." />
        ) : (
          <div className="flex max-h-44 flex-wrap gap-1.5 overflow-y-auto">
            {itens.map((p) => {
              const ativo = !excluidos.has(p.id)
              return (
                <button key={p.id} type="button" onClick={() => alternar(p.id)} disabled={!!ocupado} aria-pressed={ativo}
                  className={`inline-flex max-w-full items-center gap-1.5 rounded-full border-2 px-3 py-1.5 text-xs font-bold ${ativo ? 'border-bengala bg-bengala text-white' : 'border-ink-soft/20 bg-white text-ink-soft line-through'}`}>
                  <Icon name={ativo ? 'Check' : 'Plus'} size={13} />
                  <span className="truncate">{p.nome}</span>
                </button>
              )
            })}
          </div>
        )}
      </div>

      {/* 3. prévia e download */}
      <div className="card-bengala p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm font-black uppercase tracking-wide text-ink">
            3. Baixe ou compartilhe <span className="font-medium normal-case text-ink-soft">({temConteudo ? paginas.length : 0} {paginas.length === 1 ? 'arte' : 'artes'})</span>
          </p>
          <div className="flex flex-wrap gap-2">
            {impressao ? (
              <Botao onClick={baixarPDF} disabled={!temConteudo || !!ocupado}>
                <Icon name={ocupado === 'pdf' ? 'Loader2' : 'Printer'} size={17} className={ocupado === 'pdf' ? 'animate-spin' : ''} /> Baixar PDF para imprimir
              </Botao>
            ) : (
              <>
                {podeCompartilhar && (
                  <Botao variante="contorno" onClick={() => compartilhar(paginas.map((_, i) => i))} disabled={!temConteudo || !!ocupado}>
                    <Icon name={ocupado === 'compartilhar' ? 'Loader2' : 'Share2'} size={17} className={ocupado === 'compartilhar' ? 'animate-spin' : ''} /> Compartilhar todas
                  </Botao>
                )}
                <Botao onClick={baixarTodas} disabled={!temConteudo || !!ocupado}>
                  <Icon name={ocupado === 'todas' ? 'Loader2' : 'Download'} size={17} className={ocupado === 'todas' ? 'animate-spin' : ''} /> Baixar todas (PNG)
                </Botao>
              </>
            )}
          </div>
        </div>

        {!temConteudo ? (
          <p className="rounded-xl bg-cream-200 p-6 text-center text-sm font-medium text-ink-soft">Marque ao menos uma oferta para ver as artes.</p>
        ) : (
          <div className={`grid gap-5 ${colunasPrevia}`}>
            {paginas.map((pagina, i) => (
              <div key={i} className="min-w-0 overflow-hidden rounded-xl border border-ink-soft/10 bg-cream-200/60 p-2">
                <Escalado largura={dim.largura} altura={dim.altura}>{renderPagina(pagina, i, false)}</Escalado>
                <div className="mt-2 flex flex-wrap items-center justify-between gap-2 px-1">
                  <span className="min-w-0 truncate text-xs font-bold text-ink-soft">
                    {saida === 'post' ? pagina[0]?.nome : `${impressao ? 'Folha' : 'Arte'} ${i + 1} de ${paginas.length}`}
                  </span>
                  <div className="flex gap-1.5">
                    {podeCompartilhar && !impressao && (
                      <button type="button" onClick={() => compartilhar([i])} disabled={!!ocupado} aria-label="Compartilhar esta arte"
                        className="rounded-lg border border-ink-soft/20 bg-white p-2 text-ink disabled:opacity-50">
                        <Icon name="Share2" size={16} />
                      </button>
                    )}
                    <button type="button" onClick={() => baixar(i)} disabled={!!ocupado}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-navy px-3 py-2 text-xs font-black text-white disabled:opacity-50">
                      <Icon name={ocupado === `png-${i}` ? 'Loader2' : 'Download'} size={15} className={ocupado === `png-${i}` ? 'animate-spin' : ''} /> PNG
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
        <p className="mt-3 text-xs text-ink-soft">
          {impressao
            ? 'O PDF sai em folha A4 com linhas pontilhadas para recortar. A validade dos produtos não aparece, só o período da campanha.'
            : `As artes saem no tamanho certo (${dim.largura} × ${dim.altura} px). No celular, use Compartilhar para mandar direto no WhatsApp ou Instagram.`}
        </p>
      </div>

      {/* cópias em tamanho real, fora da tela, usadas para gerar os arquivos */}
      {temConteudo && (
        <div className="pointer-events-none fixed top-0" style={{ left: -20000 }} aria-hidden="true">
          {paginas.map((pagina, i) => <div key={i}>{renderPagina(pagina, i, true)}</div>)}
        </div>
      )}
    </div>
  )
}
