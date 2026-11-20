import { useState } from 'react'
import { useStore } from '../store/StoreContext'
import { Icon, Botao, Campo, inputCls } from '../components/ui'

export default function Config() {
  const { config, salvarConfig, resetar, toast } = useStore()
  const [f, setF] = useState({ ...config })

  const salvar = () => {
    salvarConfig(f)
    toast('Configurações salvas!')
  }

  const confirmarReset = () => {
    const confirmacao = window.prompt('Zona de perigo. Digite RESTAURAR para apagar os dados locais deste aparelho.')
    if (confirmacao !== 'RESTAURAR') {
      if (confirmacao !== null) toast('Restauração cancelada: confirmação incorreta.', 'info')
      return
    }
    resetar()
  }

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <div className="card-bengala p-5">
        <div className="mb-4 flex items-center gap-2">
          <Icon name="Store" size={18} className="text-bengala" />
          <h2 className="font-bold text-ink">Informações do estabelecimento</h2>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Campo label="Nome do mercado"><input className={inputCls} value={f.nomeMercado} onChange={(e) => setF({ ...f, nomeMercado: e.target.value })} /></Campo>
          <Campo label="Moeda">
            <select className={inputCls} value={f.moeda} onChange={(e) => setF({ ...f, moeda: e.target.value })}>
              <option value="BRL">Real (BRL)</option>
              <option value="USD">Dólar (USD)</option>
            </select>
          </Campo>
          <div className="sm:col-span-2"><Campo label="Link do jornal oficial"><input className={inputCls} value={f.jornalUrl} onChange={(e) => setF({ ...f, jornalUrl: e.target.value })} /></Campo></div>
        </div>
      </div>

      <div className="card-bengala p-5">
        <div className="mb-4 flex items-center gap-2">
          <Icon name="BellRing" size={18} className="text-bengala" />
          <h2 className="font-bold text-ink">Alertas e automação</h2>
        </div>
        <div className="space-y-5">
          <div>
            <div className="mb-1 flex justify-between text-sm font-medium"><span>Dias de alerta de validade</span><span className="text-bengala">{f.diasAlerta} dias</span></div>
            <input type="range" min="1" max="30" value={f.diasAlerta} onChange={(e) => setF({ ...f, diasAlerta: Number(e.target.value) })} className="w-full accent-bengala" />
          </div>
          <div>
            <div className="mb-1 flex justify-between text-sm font-medium"><span>Desconto padrão (ofertas automáticas)</span><span className="text-bengala">{f.descontoPadrao}%</span></div>
            <input type="range" min="5" max="80" step="5" value={f.descontoPadrao} onChange={(e) => setF({ ...f, descontoPadrao: Number(e.target.value) })} className="w-full accent-bengala" />
          </div>
          <label className="flex items-center gap-2.5">
            <input type="checkbox" checked={f.sugestoesAuto} onChange={(e) => setF({ ...f, sugestoesAuto: e.target.checked })} className="h-4 w-4 accent-bengala" />
            <span className="text-sm font-medium">Ativar sugestões automáticas de oferta</span>
          </label>
        </div>
      </div>

      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
        <button onClick={confirmarReset} className="rounded-lg border border-critical/25 bg-critical/5 px-3 py-2 text-sm font-medium text-critical hover:bg-critical/10">
          <Icon name="TriangleAlert" size={14} className="mr-1 inline" /> Apagar dados locais deste aparelho
        </button>
        <Botao onClick={salvar}><Icon name="Save" size={16} /> Salvar configurações</Botao>
      </div>
    </div>
  )
}
