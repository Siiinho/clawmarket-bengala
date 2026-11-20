import { useState } from 'react'
import { GRUPOS_TEMA, TEMAS_CAMPANHA, caminhoArte } from '../lib/temasCampanha'

// Escolha do tema da campanha com miniatura da arte, separada por seção/ocasião.
export default function SeletorTema({ value, onChange, compacto = false }) {
  const atual = TEMAS_CAMPANHA.find((t) => t.id === value)
  const [grupo, setGrupo] = useState(atual?.grupo || 'Todos')
  const lista = grupo === 'Todos' ? TEMAS_CAMPANHA : TEMAS_CAMPANHA.filter((t) => t.grupo === grupo)
  return (
    <div className="min-w-0">
      <div className="-mx-1 mb-2 flex gap-1 overflow-x-auto px-1 pb-1">
        {['Todos', ...GRUPOS_TEMA].map((g) => (
          <button key={g} type="button" onClick={() => setGrupo(g)} aria-pressed={grupo === g}
            className={`shrink-0 whitespace-nowrap rounded-full border-2 px-3 py-1 text-xs font-black ${grupo === g ? 'border-navy bg-navy text-white' : 'border-navy/15 bg-white text-navy'}`}>
            {g}
          </button>
        ))}
      </div>
      <div className={`grid gap-1.5 ${compacto ? 'max-h-72 grid-cols-2 overflow-y-auto pr-1' : 'grid-cols-2 sm:grid-cols-4 lg:grid-cols-6'}`}>
        {lista.map((t) => {
          const mini = caminhoArte(t, 'miniatura')
          const ativo = value === t.id
          return (
            <button key={t.id} type="button" onClick={() => onChange(t.id)} aria-pressed={ativo} title={t.nome}
              className={`group relative flex aspect-[4/3] flex-col overflow-hidden rounded-lg text-left ${ativo ? 'ring-4 ring-offer ring-offset-1' : 'ring-1 ring-black/10'}`}
              style={{ background: t.fundo }}>
              {mini ? (
                <img src={mini} alt="" loading="lazy" className="absolute inset-0 h-full w-full object-contain p-1" />
              ) : (
                <span className="m-auto px-1 text-center text-sm font-black uppercase italic leading-none text-white" style={{ textShadow: '0 2px 0 rgba(0,0,0,.4)' }}>
                  {t.titulo}<br /><span style={{ color: t.corDestaque }}>{t.destaque}</span>
                </span>
              )}
              <span className="relative mt-auto truncate bg-black/55 px-1.5 py-0.5 text-[11px] font-bold text-white">{t.nome}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
