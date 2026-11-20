import { forwardRef } from 'react'
import { Logo } from './ui'
import { formatBRL, formatData, partesPreco, seloDoProduto } from '../lib/utils'
import { unidadeDe } from './PaginaTemplate'
import SeloArte from './SeloArte'

// Cartazes de oferta para impressão: folha A4 com 1 cartaz A4, 2 A5, 4 A6 ou 8 A7,
// e folha de etiquetas de gôndola (24 por A4). Fundo branco para gastar pouca tinta,
// selo ilustrado da oferta no topo e preço grande em vermelho.
// A validade do produto nunca aparece: só o período da campanha.

export const FOLHA_A4 = { largura: 794, altura: 1123 } // A4 a 96 dpi; exportado em alta resolução

export const TAMANHOS_CARTAZ = {
  A4: { id: 'A4', nome: 'A4', desc: '1 por folha', cols: 1, lins: 1 },
  A5: { id: 'A5', nome: 'A5', desc: '2 por folha', cols: 1, lins: 2 },
  A6: { id: 'A6', nome: 'A6', desc: '4 por folha', cols: 2, lins: 2 },
  A7: { id: 'A7', nome: 'A7', desc: '8 por folha', cols: 2, lins: 4 },
  etiqueta: { id: 'etiqueta', nome: 'Etiqueta', desc: 'gôndola, 24 por folha', cols: 3, lins: 8 },
}

export const porFolha = (tamanho) => {
  const t = TAMANHOS_CARTAZ[tamanho] || TAMANHOS_CARTAZ.A4
  return t.cols * t.lins
}

export function paginarCartazes(itens, tamanho) {
  const n = porFolha(tamanho)
  const folhas = []
  for (let i = 0; i < itens.length; i += n) folhas.push(itens.slice(i, i + n))
  return folhas.length ? folhas : [[]]
}

const VERMELHO = '#d90429'

function PrecoCartaz({ valor, unidade, w, h }) {
  const { reais, centavos } = partesPreco(valor)
  // Altura do número limitada pela altura do bloco e pela largura disponível.
  const fonte = Math.min(h, (w * 0.88) / (reais.length * 0.6 + 1.4))
  return (
    <div className="flex items-start justify-center font-black leading-none" style={{ color: VERMELHO, fontVariantNumeric: 'tabular-nums' }}>
      <span style={{ fontSize: fonte * 0.26, marginTop: fonte * 0.12, marginRight: fonte * 0.04 }}>R$</span>
      <span style={{ fontSize: fonte, letterSpacing: '-0.04em' }}>{reais}</span>
      <span className="flex flex-col items-start" style={{ marginLeft: fonte * 0.03 }}>
        <span style={{ fontSize: fonte * 0.46, marginTop: fonte * 0.04 }}>,{centavos}</span>
        <span className="rounded font-black text-white" style={{ fontSize: fonte * 0.15, background: VERMELHO, padding: `${fonte * 0.02}px ${fonte * 0.05}px`, marginTop: fonte * 0.06, marginLeft: fonte * 0.13 }}>{unidade}</span>
      </span>
    </div>
  )
}

export function Cartaz({ produto, encarte, w, h }) {
  const selo = seloDoProduto(produto)
  const nome = String(produto.nome || '').toUpperCase()
  const linhas = nome.length <= 14 ? 1 : nome.length <= 30 ? 2 : 3
  const fonteNome = Math.min(h * (linhas === 1 ? 0.1 : 0.075), (w * 0.9) / (Math.ceil(nome.length / linhas) * 0.6))
  const desconto = Number(produto.precoNormal) > Number(produto.precoJornal) + 0.009
  const faixa = h * 0.2
  const detalhe = [produto.marca, produto.gramagem].filter(Boolean).join(' · ')
  return (
    <div className="flex h-full w-full flex-col overflow-hidden bg-white text-center" style={{ fontFamily: 'var(--font-sans)' }}>
      <div className="flex shrink-0 items-center justify-center" style={{ height: faixa, paddingTop: faixa * 0.06 }}>
        <SeloArte selo={selo} largura={w * 0.76} altura={faixa * 0.92} girar={-3} />
      </div>
      <div className="flex min-h-0 flex-1 flex-col items-center justify-center" style={{ padding: `${h * 0.02}px ${w * 0.05}px` }}>
        <div className="font-black uppercase leading-[1.02] text-[#111]" style={{ fontSize: fonteNome }}>{nome}</div>
        {detalhe && <div className="font-bold uppercase text-[#555]" style={{ fontSize: Math.max(7, h * 0.032), marginTop: h * 0.008 }}>{detalhe}</div>}
        {desconto && (
          <div className="font-black text-[#222]" style={{ fontSize: Math.max(7, h * 0.042), marginTop: h * 0.015 }}>
            De <span style={{ textDecoration: 'line-through' }}>{formatBRL(produto.precoNormal)}</span> por
          </div>
        )}
        <div style={{ marginTop: h * 0.01 }}>
          <PrecoCartaz valor={produto.precoJornal} unidade={unidadeDe(produto)} w={w} h={h * (desconto ? 0.3 : 0.34)} />
        </div>
      </div>
      <div className="flex shrink-0 items-center justify-between gap-2 border-t-2 border-[#111]" style={{ padding: `${h * 0.012}px ${w * 0.04}px`, minHeight: h * 0.07 }}>
        <Logo h={Math.max(16, h * 0.065)} />
        {encarte?.periodoDe && (
          <div className="text-right font-bold uppercase leading-tight text-[#333]" style={{ fontSize: Math.max(6, h * 0.019) }}>
            Válido de {formatData(encarte.periodoDe)} a {formatData(encarte.periodoAte)}
            <br />ou enquanto durarem os estoques
          </div>
        )}
      </div>
    </div>
  )
}

export function Etiqueta({ produto, w, h }) {
  const selo = seloDoProduto(produto)
  const { reais, centavos } = partesPreco(produto.precoJornal)
  const fontePreco = Math.min(h * 0.5, (w * 0.5) / ((reais.length + 1.2) * 0.6))
  return (
    <div className="flex h-full w-full flex-col overflow-hidden" style={{ background: '#ffe14d', fontFamily: 'var(--font-sans)', padding: '6px 8px' }}>
      <div className="flex items-start justify-between gap-1">
        <div className="min-w-0 flex-1 font-black uppercase leading-[1.05] text-[#111]" style={{ fontSize: 12, maxHeight: 38, overflow: 'hidden' }}>{produto.nome}</div>
        <span className="shrink-0 rounded px-1 py-0.5 font-black uppercase leading-none" style={{ fontSize: 8, background: selo.fundo, color: selo.cor }}>{selo.texto}</span>
      </div>
      <div className="mt-auto flex items-end justify-between gap-1">
        <div className="min-w-0 font-bold leading-tight text-[#333]" style={{ fontSize: 8 }}>
          {produto.gramagem && <div className="truncate">{produto.gramagem}</div>}
          {produto.codigoBarras && <div className="truncate">{produto.codigoBarras}</div>}
          {Number(produto.precoNormal) > Number(produto.precoJornal) + 0.009 && (
            <div>De <span style={{ textDecoration: 'line-through' }}>{formatBRL(produto.precoNormal)}</span></div>
          )}
        </div>
        <div className="flex items-start font-black leading-none" style={{ color: VERMELHO }}>
          <span style={{ fontSize: fontePreco * 0.3, marginTop: fontePreco * 0.1 }}>R$</span>
          <span style={{ fontSize: fontePreco, letterSpacing: '-0.03em' }}>{reais}</span>
          <span className="flex flex-col">
            <span style={{ fontSize: fontePreco * 0.5 }}>,{centavos}</span>
            <span style={{ fontSize: fontePreco * 0.2, color: '#111', marginLeft: fontePreco * 0.13 }}>{unidadeDe(produto)}</span>
          </span>
        </div>
      </div>
    </div>
  )
}

// Folha A4 com os cartazes (ou etiquetas) e linhas pontilhadas de corte.
export const FolhaCartazes = forwardRef(function FolhaCartazes({ itens, tamanho = 'A4', encarte }, ref) {
  const t = TAMANHOS_CARTAZ[tamanho] || TAMANHOS_CARTAZ.A4
  const etiqueta = t.id === 'etiqueta'
  const margem = etiqueta ? 18 : 16
  const w = (FOLHA_A4.largura - margem * 2) / t.cols
  const h = (FOLHA_A4.altura - margem * 2) / t.lins
  return (
    <div ref={ref} className="relative bg-white" style={{ width: FOLHA_A4.largura, height: FOLHA_A4.altura }}>
      {itens.map((p, i) => (
        <div
          key={p.id || i}
          className="absolute"
          style={{
            left: margem + (i % t.cols) * w, top: margem + Math.floor(i / t.cols) * h, width: w, height: h,
            // linha de corte: borda (o contorno CSS não aparece no PNG/PDF)
            border: t.cols * t.lins > 1 ? '1px dashed #9a9a9a' : 'none', boxSizing: 'border-box',
            padding: etiqueta ? 3 : 0,
          }}
        >
          {etiqueta ? <Etiqueta produto={p} w={w - 6} h={h - 6} /> : <Cartaz produto={p} encarte={encarte} w={w} h={h} />}
        </div>
      ))}
    </div>
  )
})
