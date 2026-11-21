import { useState, useMemo } from 'react'
import { useStore } from '../store/StoreContext'
import { Icon, Botao, PrecoVarejo, StatusBadge, ProdutoThumb, EmptyState, inputCls } from '../components/ui'
import {
  setorById, diasParaVencer, formatBRL, regraDoProduto, precoComRegra, uid,
} from '../lib/utils'

export default function Precificacao() {
  const { produtos, config, ofertaDoProduto, criarOferta, salvarConfig, toast } = useStore()
  const [regras, setRegras] = useState(() => [...(config.regrasPreco || [])].sort((a, b) => a.diasMax - b.diasMax))
  const [usarNasSugestoes, setUsarNasSugestoes] = useState(config.usarRegrasNasSugestoes ?? true)

  const candidatos = useMemo(
    () =>
      produtos
        .map((p) => ({ p, dias: diasParaVencer(p.validade), regra: regraDoProduto(diasParaVencer(p.validade), regras) }))
        .filter((x) => x.regra)
        .sort((a, b) => a.dias - b.dias),
    [produtos, regras]
  )

  const semOferta = candidatos.filter((c) => !ofertaDoProduto(c.p.id))

  const salvarRegras = () => {
    const limpas = regras
      .map((r) => ({ ...r, diasMax: Math.max(0, Number(r.diasMax) || 0), desconto: Math.min(90, Math.max(1, Number(r.desconto) || 1)) }))
      .sort((a, b) => a.diasMax - b.diasMax)
    setRegras(limpas)
    salvarConfig({ regrasPreco: limpas, usarRegrasNasSugestoes: usarNasSugestoes })
    toast('Regras de precificação salvas!')
  }

  const addFaixa = () => {
    const maxMax = Math.max(0, ...regras.map((r) => r.diasMax))
    setRegras([...regras, { id: uid(), diasMax: maxMax + 3, desconto: 10 }])
  }
  const removeFaixa = (id) => setRegras(regras.filter((r) => r.id !== id))
  const editFaixa = (id, campo, val) => setRegras(regras.map((r) => (r.id === id ? { ...r, [campo]: val } : r)))

  const aplicarUm = (p, regra) => {
    criarOferta(p.id, `Regra de validade · −${regra.desconto}%`, regra.desconto, p.validade)
    toast(`Oferta de ${regra.desconto}% aplicada em ${p.nome}.`)
  }

  const aplicarTodas = () => {
    let n = 0
    semOferta.forEach(({ p, regra }) => {
      criarOferta(p.id, `Regra de validade · −${regra.desconto}%`, regra.desconto, p.validade)
      n++
    })
    toast(n ? `${n === 1 ? '1 oferta aplicada' : `${n} ofertas aplicadas`} pelas regras!` : 'Nenhuma nova oferta a aplicar.', n ? 'sucesso' : 'info')
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-xl text-sm text-ink-soft">
          Defina faixas de desconto por proximidade do vencimento. O motor calcula o preço sugerido e
          pode aplicar ofertas em massa — base para, no futuro, empurrar o preço direto no PDV.
        </p>
        <Botao onClick={aplicarTodas} disabled={semOferta.length === 0}>
          <Icon name="Wand2" size={16} /> Aplicar regras ({semOferta.length})
        </Botao>
      </div>

      <div className="grid gap-5 lg:grid-cols-[360px_1fr]">
        {/* editor de regras */}
        <div className="card-bengala h-fit p-5">
          <h2 className="mb-1 font-bold text-ink">Faixas de desconto</h2>
          <p className="mb-3 text-xs text-ink-soft">Da mais próxima (maior desconto) para a mais distante.</p>
          <div className="space-y-2">
            {[...regras].sort((a, b) => a.diasMax - b.diasMax).map((r) => (
              <div key={r.id} className="flex items-center gap-2 rounded-lg bg-cream-200 p-2">
                <span className="text-sm text-ink-soft">≤</span>
                <input type="number" min="0" value={r.diasMax} onChange={(e) => editFaixa(r.id, 'diasMax', e.target.value)} className={`${inputCls} px-2 py-1.5`} style={{ width: '4rem', flex: 'none' }} />
                <span className="text-sm text-ink-soft">dias →</span>
                <input type="number" min="1" max="90" value={r.desconto} onChange={(e) => editFaixa(r.id, 'desconto', e.target.value)} className={`${inputCls} px-2 py-1.5`} style={{ width: '4rem', flex: 'none' }} />
                <span className="text-sm font-medium text-bengala">% off</span>
                <button onClick={() => removeFaixa(r.id)} className="ml-auto rounded p-1 text-critical hover:bg-critical/10"><Icon name="Trash2" size={15} /></button>
              </div>
            ))}
          </div>
          <button onClick={addFaixa} className="mt-2 flex items-center gap-1 text-sm font-medium text-info hover:underline">
            <Icon name="Plus" size={15} /> Adicionar faixa
          </button>

          <label className="mt-4 flex items-start gap-2.5 border-t border-ink-soft/10 pt-4">
            <input type="checkbox" checked={usarNasSugestoes} onChange={(e) => setUsarNasSugestoes(e.target.checked)} className="mt-0.5 h-4 w-4 accent-bengala" />
            <span className="text-sm text-ink">Usar estas regras nas <strong>sugestões automáticas</strong> de oferta (em vez do desconto fixo).</span>
          </label>

          <Botao className="mt-4 w-full" onClick={salvarRegras}><Icon name="Save" size={16} /> Salvar regras</Botao>
        </div>

        {/* prévia de preços */}
        <div className="card-bengala overflow-hidden">
          <div className="flex items-center justify-between border-b border-ink-soft/10 px-5 py-3.5">
            <h2 className="font-bold text-ink">Prévia de preços</h2>
            <span className="text-sm text-ink-soft">{candidatos.length} na regra</span>
          </div>
          {candidatos.length === 0 ? (
            <div className="p-6"><EmptyState icon="Percent" titulo="Nenhum produto nas faixas" descricao="Ajuste as faixas ou aguarde produtos se aproximarem do vencimento." /></div>
          ) : (
            <div className="divide-y divide-ink-soft/8">
              {candidatos.map(({ p, dias, regra }) => {
                const novo = precoComRegra(p.precoNormal, regra)
                const temOferta = ofertaDoProduto(p.id)
                return (
                  <div key={p.id} className="flex items-center gap-3 px-5 py-3">
                    <ProdutoThumb produto={p} size={40} />
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-medium text-ink">{p.nome}</div>
                      <div className="flex items-center gap-2 text-xs text-ink-soft">
                        <StatusBadge validade={p.validade} />
                        <span className="rounded bg-cream-200 px-1.5 py-0.5">≤{regra.diasMax}d → −{regra.desconto}%</span>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-xs text-ink-soft line-through">{formatBRL(p.precoNormal)}</div>
                      <PrecoVarejo valor={novo} className="text-lg text-bengala" />
                    </div>
                    {temOferta ? (
                      <span className="ml-2 w-20 shrink-0 text-center text-xs font-medium text-success">aplicada ✓</span>
                    ) : (
                      <Botao variante="contorno" className="ml-2 shrink-0 px-3 py-1.5" onClick={() => aplicarUm(p, regra)}>Aplicar</Botao>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
