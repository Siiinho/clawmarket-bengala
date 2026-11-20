import { seloDoProduto, seloOfertaById, SELOS_OFERTA } from '../lib/utils'

// Selos ilustrados no estilo dos cartazes pintados à mão de supermercado:
// estrela de explosão, faixa, etiqueta, carimbo e chama. A forma é um SVG simples e o
// texto fica por cima em HTML, com a fonte Bangers (livre, OFL), para sair igual na tela,
// no PNG e no PDF.

const ESTILOS = {
  oferta: { forma: 'estrela', fundo: '#ffe600', borda: '#e30613', cor: '#1438c8', sombra: '#e30613' },
  imperdivel: { forma: 'faixa', fundo: '#e30613', borda: '#7a0000', cor: '#ffe600', sombra: '#7a0000' },
  queima: { forma: 'chama', fundo: '#ff5a00', borda: '#b80000', cor: '#fff200', sombra: '#b80000' },
  super: { forma: 'estrela', fundo: '#1438c8', borda: '#ffe600', cor: '#ffe600', sombra: '#0a1f6e' },
  precobaixo: { forma: 'etiqueta', fundo: '#ffe600', borda: '#e30613', cor: '#e30613', sombra: '#ffffff' },
  'leve-mais': { forma: 'circulo', fundo: '#1c8a3c', borda: '#ffe600', cor: '#ffffff', sombra: '#0a4a20' },
  'so-hoje': { forma: 'carimbo', fundo: '#ffffff', borda: '#e30613', cor: '#e30613', sombra: '#ffd0d0' },
  exclusivo: { forma: 'faixa', fundo: '#1d6fd1', borda: '#0a3a7a', cor: '#ffffff', sombra: '#0a3a7a' },
}

const estiloDe = (id) => ESTILOS[id] || ESTILOS.oferta

function pontosEstrela(w, h, n = 18, irregular = false) {
  const cx = w / 2
  const cy = h / 2
  const pts = []
  for (let i = 0; i < n * 2; i += 1) {
    const a = (Math.PI * i) / n - Math.PI / 2
    // "chama": raios externos irregulares, como labaredas
    const fator = i % 2 === 0 ? (irregular ? 0.86 + 0.14 * Math.abs(Math.sin(i * 1.7)) : 1) : irregular ? 0.7 : 0.8
    pts.push(`${(cx + Math.cos(a) * (w / 2) * fator).toFixed(1)},${(cy + Math.sin(a) * (h / 2) * fator).toFixed(1)}`)
  }
  return pts.join(' ')
}

function Forma({ forma, w, h, e }) {
  const b = Math.max(2, Math.min(w, h) * 0.06)
  const comum = { fill: e.fundo, stroke: e.borda, strokeWidth: b, strokeLinejoin: 'round' }
  if (forma === 'estrela' || forma === 'chama') {
    return <polygon points={pontosEstrela(w - b, h - b, forma === 'chama' ? 14 : 18, forma === 'chama')} transform={`translate(${b / 2} ${b / 2})`} {...comum} />
  }
  if (forma === 'faixa') {
    const p = h * 0.28
    const pts = [[b, b], [w - b, b], [w - b - p, h / 2], [w - b, h - b], [b, h - b], [b + p, h / 2]]
    return <polygon points={pts.map((q) => q.join(',')).join(' ')} {...comum} />
  }
  if (forma === 'etiqueta') {
    const p = h * 0.42
    const pts = [[b + p, b], [w - b, b], [w - b, h - b], [b + p, h - b], [b, h / 2]]
    return (
      <>
        <polygon points={pts.map((q) => q.join(',')).join(' ')} {...comum} />
        <circle cx={b + p * 0.72} cy={h / 2} r={h * 0.08} fill="#ffffff" stroke={e.borda} strokeWidth={b * 0.6} />
      </>
    )
  }
  if (forma === 'circulo') {
    return (
      <>
        <ellipse cx={w / 2} cy={h / 2} rx={w / 2 - b} ry={h / 2 - b} {...comum} />
        <ellipse cx={w / 2} cy={h / 2} rx={w / 2 - b * 2.6} ry={h / 2 - b * 2.6} fill="none" stroke={e.borda} strokeWidth={b * 0.5} strokeDasharray={`${b * 1.6} ${b}`} />
      </>
    )
  }
  // carimbo
  return (
    <>
      <rect x={b} y={b} width={w - b * 2} height={h - b * 2} rx={h * 0.16} {...comum} />
      <rect x={b * 2.6} y={b * 2.6} width={w - b * 5.2} height={h - b * 5.2} rx={h * 0.1} fill="none" stroke={e.borda} strokeWidth={b * 0.5} />
    </>
  )
}

const AREA_TEXTO = { estrela: 0.62, chama: 0.56, faixa: 0.7, etiqueta: 0.66, circulo: 0.7, carimbo: 0.8 }

function linhasDo(texto) {
  const t = String(texto || '').toUpperCase()
  if (t.length <= 11 || !t.includes(' ')) return [t]
  const meio = t.length / 2
  let corte = -1
  for (let i = 0; i < t.length; i += 1) if (t[i] === ' ' && (corte < 0 || Math.abs(i - meio) < Math.abs(corte - meio))) corte = i
  return [t.slice(0, corte).replace(/,$/, ''), t.slice(corte + 1)]
}

// selo: objeto de SELOS_OFERTA (ou use `produto`, ou `id`).
export default function SeloArte({ selo, produto, id, largura = 160, altura, girar = -6, className = '', style }) {
  const s = selo || (produto ? seloDoProduto(produto) : seloOfertaById(id)) || SELOS_OFERTA[0]
  const e = estiloDe(s.id)
  const w = largura
  const h = altura || Math.round(largura * (e.forma === 'circulo' ? 0.62 : e.forma === 'estrela' || e.forma === 'chama' ? 0.62 : 0.42))
  const linhas = linhasDo(s.texto)
  const maior = Math.max(...linhas.map((l) => l.length))
  const area = AREA_TEXTO[e.forma]
  const fonte = Math.min(h * (linhas.length === 1 ? 0.5 : 0.33), (w * area) / (maior * 0.47))
  const deslocaX = e.forma === 'etiqueta' ? h * 0.18 : 0
  return (
    <span className={`relative inline-block shrink-0 ${className}`} style={{ width: w, height: h, transform: girar ? `rotate(${girar}deg)` : undefined, ...style }} aria-label={s.texto}>
      <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} className="absolute inset-0" aria-hidden="true">
        <Forma forma={e.forma} w={w} h={h} e={e} />
      </svg>
      <span
        className="absolute inset-0 flex flex-col items-center justify-center text-center uppercase"
        style={{
          fontFamily: 'Bangers, var(--font-sans)', fontSize: fonte, lineHeight: 0.92, letterSpacing: '0.02em', color: e.cor,
          textShadow: `${Math.max(1, fonte * 0.06)}px ${Math.max(1, fonte * 0.06)}px 0 ${e.sombra}`, paddingLeft: deslocaX,
        }}
      >
        {linhas.map((l) => <span key={l} className="block whitespace-nowrap">{l}</span>)}
      </span>
    </span>
  )
}
