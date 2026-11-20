// Marca da dona do sistema: ClawMarket.
// Símbolo: etiqueta de preço com três marcas de garra ("claw").
// A logo do mercado cliente continua no encarte dele; esta marca identifica o sistema.

export function SimboloClawMarket({ tamanho = 40, className = '' }) {
  return (
    <svg viewBox="0 0 64 64" width={tamanho} height={tamanho} className={className} role="img" aria-label="ClawMarket">
      <rect width="64" height="64" rx="16" fill="#0b1f3a" />
      <path d="M14 30.5 30.5 14H48a2 2 0 0 1 2 2v17.5L33.5 50a3 3 0 0 1-4.2 0L14 34.7a3 3 0 0 1 0-4.2Z" fill="#ffc928" />
      <circle cx="42" cy="22" r="3.6" fill="#0b1f3a" />
      <path d="M24.5 35.5 33 27M28.8 39.8 37.3 31.3M33.1 44.1 41.6 35.6" stroke="#e4232e" strokeWidth="4.2" strokeLinecap="round" />
    </svg>
  )
}

export default function MarcaClawMarket({ tamanho = 40, subtitulo, claro = true, className = '' }) {
  return (
    <div className={`flex items-center gap-2.5 ${className}`}>
      <SimboloClawMarket tamanho={tamanho} />
      <div className="leading-none">
        <div className="font-black tracking-tight" style={{ fontSize: Math.round(tamanho * 0.45), color: claro ? '#ffffff' : '#0b1f3a' }}>
          Claw<span style={{ color: claro ? '#ffc928' : '#e4232e' }}>Market</span>
        </div>
        {subtitulo && (
          <div className="mt-1 text-[10px] font-bold uppercase tracking-[0.12em]" style={{ color: claro ? '#ffc928' : '#6b5a54' }}>
            {subtitulo}
          </div>
        )}
      </div>
    </div>
  )
}
