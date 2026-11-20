import * as Lucide from 'lucide-react'
import { useEffect } from 'react'
import { useStore } from '../store/StoreContext'
import { partesPreco, statusValidade, labelDias, setorById } from '../lib/utils'
import logoBengala from '../assets/logo.png'

// ---- ícone dinâmico (lucide) — traço 1.75 p/ um visual mais fino e elegante ----
export function Icon({ name, strokeWidth = 1.75, ...props }) {
  const Cmp = Lucide[name] || Lucide.Circle
  return <Cmp strokeWidth={strokeWidth} {...props} />
}

export function Logo({ h = 36, chip = false, className = '' }) {
  const img = <img src={logoBengala} alt="Bengala Supermercado" style={{ height: h }} className={`block w-auto object-contain ${className}`} />
  return chip ? <span className="inline-flex items-center justify-center rounded-xl bg-white p-1">{img}</span> : img
}

// ---- preço estilo varejo ----
export function PrecoVarejo({ valor, className = '', cor }) {
  const { reais, centavos } = partesPreco(valor)
  return (
    <span className={`preco-varejo ${className}`} style={cor ? { color: cor } : undefined}>
      <span className="moeda">R$ </span>
      {reais}
      <span className="centavos">,{centavos}</span>
    </span>
  )
}

// ---- badge de status de validade ----
export function StatusBadge({ validade, mostrarDias = true }) {
  const s = statusValidade(validade)
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium"
      style={{ background: s.bg, color: s.cor }}
    >
      <Lucide.Clock size={12} />
      {mostrarDias ? labelDias(s.dias) : s.label}
    </span>
  )
}

// ---- thumbnail do produto (foto ou ícone do setor) ----
export function ProdutoThumb({ produto, size = 44 }) {
  const setor = setorById(produto.setor)
  if (produto.imagem) {
    return (
      <img
        src={produto.imagem}
        alt={produto.nome}
        loading="lazy"
        decoding="async"
        className="shrink-0 rounded-xl border border-black/5 bg-white object-contain"
        style={{
          width: size,
          height: size,
          padding: Math.max(2, Math.round(size * 0.055)),
          boxShadow: size >= 56 ? '0 4px 14px rgba(26, 32, 44, 0.10)' : 'none',
        }}
      />
    )
  }
  return (
    <div
      className="flex items-center justify-center rounded-lg shrink-0"
      style={{ width: size, height: size, background: `${setor.cor}1a`, color: setor.cor }}
    >
      <Icon name={setor.icone} size={size * 0.5} />
    </div>
  )
}

// ---- selo estrela de desconto (estilo encarte; SVG = export-safe) ----
const STAR_POINTS = (() => {
  const pts = []
  const spikes = 14, cx = 50, cy = 50, outer = 48, inner = 39
  for (let i = 0; i < spikes * 2; i++) {
    const r = i % 2 === 0 ? outer : inner
    const a = (Math.PI / spikes) * i - Math.PI / 2
    pts.push(`${(cx + r * Math.cos(a)).toFixed(1)},${(cy + r * Math.sin(a)).toFixed(1)}`)
  }
  return pts.join(' ')
})()

export function SeloDesconto({ texto, size = 44, className = '', style }) {
  // texto em HTML sobreposto (não <text> no SVG) — evita travar o html2canvas no export
  return (
    <span className={`inline-flex items-center justify-center ${className}`} style={{ width: size, height: size, position: className.includes('absolute') ? undefined : 'relative', ...style }}>
      <svg width={size} height={size} viewBox="0 0 100 100" style={{ position: 'absolute', inset: 0 }}>
        <polygon points={STAR_POINTS} fill="#ffd23f" stroke="#c42b2b" strokeWidth="4" strokeLinejoin="round" />
      </svg>
      <span style={{ position: 'relative', fontSize: size * 0.26, fontWeight: 800, color: '#c42b2b', lineHeight: 1 }}>{texto}</span>
    </span>
  )
}

// ---- pílula genérica ----
export function Pill({ children, cor = '#6b5a54', bg = '#f3ead9', className = '' }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${className}`}
      style={{ background: bg, color: cor }}
    >
      {children}
    </span>
  )
}

// ---- estado vazio ----
export function EmptyState({ icon = 'Inbox', titulo, descricao, acao }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-ink-soft/25 py-12 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-cream-200 text-ink-soft">
        <Icon name={icon} size={26} />
      </div>
      <p className="font-medium text-ink">{titulo}</p>
      {descricao && <p className="max-w-xs text-sm text-ink-soft">{descricao}</p>}
      {acao && <div className="mt-2">{acao}</div>}
    </div>
  )
}

// ---- botão padrão ----
export function Botao({ children, variante = 'primario', className = '', ...props }) {
  const base =
    'inline-flex cursor-pointer items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition hover:-translate-y-[1px] hover:shadow-md active:translate-y-0 active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-50 disabled:translate-y-0 disabled:shadow-none disabled:active:scale-100'
  const v = {
    primario: 'bg-bengala text-cream hover:bg-bengala-dark',
    coral: 'bg-coral text-white hover:bg-coral-dark',
    contorno: 'border border-ink-soft/25 bg-white text-ink hover:bg-cream-200',
    perigo: 'bg-critical text-white hover:brightness-90',
    fantasma: 'text-ink-soft hover:bg-cream-200',
  }[variante]
  return (
    <button className={`${base} ${v} ${className}`} {...props}>
      {children}
    </button>
  )
}

// ---- modal ----
export function Modal({ open, onClose, titulo, children, footer, largura = 'max-w-lg' }) {
  useEffect(() => {
    if (!open) return
    const onEsc = (e) => e.key === 'Escape' && onClose?.()
    window.addEventListener('keydown', onEsc)
    return () => window.removeEventListener('keydown', onEsc)
  }, [open, onClose])

  if (!open) return null
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4"
      onMouseDown={(e) => e.target === e.currentTarget && onClose?.()}
    >
      <div className={`w-full ${largura} max-h-[90vh] overflow-y-auto rounded-2xl bg-white shadow-xl`}>
        <div className="flex items-center justify-between border-b border-ink-soft/10 px-5 py-3.5">
          <h3 className="text-base font-medium">{titulo}</h3>
          <button onClick={onClose} className="rounded-lg p-1 text-ink-soft hover:bg-cream-200">
            <Lucide.X size={18} />
          </button>
        </div>
        <div className="px-5 py-4">{children}</div>
        {footer && (
          <div className="flex justify-end gap-2 border-t border-ink-soft/10 px-5 py-3">{footer}</div>
        )}
      </div>
    </div>
  )
}

// ---- container de toasts ----
export function Toasts() {
  const { toasts } = useStore()
  const cor = { sucesso: '#2e9e6b', erro: '#c42b2b', info: '#2e6fb0' }
  const ic = { sucesso: 'CheckCircle2', erro: 'AlertCircle', info: 'Info' }
  return (
    <div className="fixed bottom-5 right-5 z-[60] flex flex-col gap-2">
      {toasts.map((t) => (
        <div
          key={t.id}
          className="toast-in flex items-center gap-2 rounded-xl bg-white px-4 py-3 text-sm font-medium shadow-lg"
          style={{ borderLeft: `4px solid ${cor[t.tipo]}` }}
        >
          <Icon name={ic[t.tipo]} size={18} style={{ color: cor[t.tipo] }} />
          {t.msg}
        </div>
      ))}
    </div>
  )
}

// ---- input/select rotulado ----
export function Campo({ label, children, obrigatorio }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-ink">
        {label} {obrigatorio && <span className="text-bengala">*</span>}
      </span>
      {children}
    </label>
  )
}

export const inputCls =
  'w-full rounded-lg border border-ink-soft/20 bg-white px-3 py-2 text-sm outline-none focus:border-bengala focus:ring-2 focus:ring-bengala/20'
