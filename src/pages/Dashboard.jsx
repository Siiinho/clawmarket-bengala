import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStore } from '../store/StoreContext'
import { Icon, StatusBadge, ProdutoThumb, EmptyState } from '../components/ui'
import { setorById, diasParaVencer, plural } from '../lib/utils'

export default function Dashboard() {
  const { produtos, ofertas, fila } = useStore()
  const navigate = useNavigate()

  const stats = useMemo(() => {
    const vencendo7 = produtos.filter((p) => {
      const d = diasParaVencer(p.validade)
      return d != null && d >= 0 && d <= 7
    }).length
    const ofertasAtivas = ofertas.filter((o) => o.ativa).length
    return { vencendo7, ofertasAtivas }
  }, [produtos, ofertas])

  const proximos = useMemo(
    () =>
      produtos
        .map((p) => ({ p, dias: diasParaVencer(p.validade) }))
        .filter((x) => x.dias != null && x.dias >= 0 && x.dias <= 7)
        .sort((a, b) => a.dias - b.dias),
    [produtos]
  )

  const criticos3 = proximos.filter((x) => x.dias <= 3).length

  return (
    <div className="mx-auto max-w-6xl space-y-4">
      <section className="card-bengala p-5 md:p-6">
        <h2 className="mb-4 text-xl font-bold text-navy">O que você precisa fazer agora?</h2>
        <div className="grid gap-2 md:grid-cols-3">
          {[
            ['1', 'Escanear produto', 'Leia o código de barras', 'ScanLine', '/scanner'],
            ['2', 'Conferir vencimentos', stats.vencendo7 === 0 ? 'Nada vencendo esta semana' : `${plural(stats.vencendo7, 'produto pede', 'produtos pedem')} atenção`, 'CalendarClock', '/produtos'],
            ['3', 'Gerar jornal', fila.length === 0 ? 'Fila vazia' : `${plural(fila.length, 'produto', 'produtos')} na fila`, 'Newspaper', '/jornal'],
          ].map(([numero, titulo, descricao, icone, rota], indice) => (
            <button
              key={numero}
              onClick={() => navigate(rota)}
              className={`flex min-h-16 items-center gap-3 rounded-xl border p-3 text-left ${
                indice === 0
                  ? 'border-bengala bg-bengala text-white hover:bg-bengala-dark'
                  : 'border-navy/10 bg-white hover:border-bengala/35 hover:bg-cream'
              }`}
            >
              <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-black ${
                indice === 0 ? 'bg-offer text-navy' : 'bg-cream-200 text-bengala'
              }`}>{numero}</span>
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-1.5 font-semibold"><Icon name={icone} size={16} /> {titulo}</span>
                <span className={`mt-0.5 block text-xs ${indice === 0 ? 'text-white/75' : 'text-ink-soft'}`}>{descricao}</span>
              </span>
              <Icon name="ChevronRight" size={17} className="shrink-0 opacity-60" />
            </button>
          ))}
        </div>
      </section>

      {criticos3 > 0 && (
        <div className="flex items-center gap-3 rounded-xl border border-warning/40 bg-warning/15 px-4 py-3">
          <Icon name="AlertTriangle" size={20} className="pulse-soft text-warning shrink-0" />
          <p className="min-w-0 flex-1 text-sm text-ink">
            <span className="font-semibold">{plural(criticos3, 'produto', 'produtos')}</span> vencendo em até 3 dias.
          </p>
          <button
            onClick={() => navigate('/ofertas')}
            className="ml-auto shrink-0 text-sm font-medium text-bengala hover:underline"
          >
            Ver ofertas →
          </button>
        </div>
      )}

      <div className="grid grid-cols-[minmax(0,1fr)] gap-4 lg:grid-cols-[minmax(0,1fr)_250px]">
        <div className="card-bengala min-w-0 overflow-hidden">
          <div className="flex min-w-0 items-center justify-between gap-3 border-b border-ink-soft/10 px-4 py-3.5 sm:px-5">
            <h2 className="accent min-w-0 truncate text-sm font-bold text-ink sm:text-base">Produtos próximos ao vencimento</h2>
            <button onClick={() => navigate('/produtos')} className="shrink-0 text-xs text-bengala hover:underline sm:text-sm">
              Ver todos
            </button>
          </div>
          <div className="stagger divide-y divide-ink-soft/8">
            {proximos.length === 0 ? (
              <div className="p-6">
                <EmptyState icon="PartyPopper" titulo="Nada vencendo nos próximos 7 dias" descricao="Seu estoque está sob controle." />
              </div>
            ) : (
              proximos.slice(0, 5).map(({ p }) => (
                <div key={p.id} className="flex min-w-0 items-center gap-3 px-4 py-3 sm:px-5">
                  <ProdutoThumb produto={p} />
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-medium text-ink">{p.nome}</div>
                    <div className="text-xs text-ink-soft">
                      {setorById(p.setor).nome} · {p.estoque} un
                    </div>
                  </div>
                  <span className="shrink-0">
                    <StatusBadge validade={p.validade} />
                  </span>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="card-bengala h-fit min-w-0 overflow-hidden">
          <div className="border-b border-ink-soft/10 px-5 py-3.5">
            <h2 className="font-bold text-ink">Resumo de hoje</h2>
          </div>
          <div className="divide-y divide-ink-soft/10 px-4">
            {[
              ['CalendarClock', 'Vencendo em 7 dias', stats.vencendo7, '#d9641f'],
              ['ListChecks', 'Na fila do jornal', fila.length, '#d81e29'],
              ['Tag', 'Ofertas ativas', stats.ofertasAtivas, '#2e9e6b'],
            ].map(([icone, label, valor, cor]) => (
              <div key={label} className="flex items-center gap-3 py-3">
                <span className="flex h-9 w-9 items-center justify-center rounded-lg" style={{ background: `${cor}14`, color: cor }}>
                  <Icon name={icone} size={17} />
                </span>
                <span className="flex-1 text-xs text-ink-soft">{label}</span>
                <strong className="num-tab text-lg text-ink">{valor}</strong>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
