import { useState, useMemo } from 'react'
import { useOutletContext } from 'react-router-dom'
import { useStore, podeEditar } from '../store/StoreContext'
import { Icon, PrecoVarejo, StatusBadge, ProdutoThumb, EmptyState, Botao, Modal, Campo, inputCls, Pill } from '../components/ui'
import { SETORES, setorById, statusValidade, formatBRL, arquivoParaDataURL, dataISOmaisDias } from '../lib/utils'
import {
  buscarImagemProduto,
  buscarProdutoCatalogo,
  prepararImagemGoogleConfirmada,
  urlBuscaGoogleImagens,
} from '../lib/produtoApi'
import { importarPlanilha } from '../lib/importarCatalogo'

const vazio = {
  nome: '', marca: '', gramagem: '', setor: 'mercearia', estoque: 0, validade: '',
  precoNormal: '', precoPromo: '', codigoBarras: '', imagem: null,
}

export default function Produtos() {
  const { produtos, usuario, lojas, lojaAtiva, salvarProduto, excluirProduto, toggleFila, toast } = useStore()
  const lojaNome = (id) => lojas.find((l) => l.id === id)?.nome || '—'
  const { busca } = useOutletContext()
  const editavel = podeEditar(usuario.papel)

  const [fSetor, setFSetor] = useState('')
  const [fStatus, setFStatus] = useState('')
  const [form, setForm] = useState(null)
  const [excluindo, setExcluindo] = useState(null)
  const [buscandoCatalogo, setBuscandoCatalogo] = useState(false)
  const [importacao, setImportacao] = useState(null) // { texto, res, comImagens, rodando, progresso }

  const abrirImport = () => setImportacao({ texto: '', res: null, comImagens: false, rodando: false, progresso: 0 })

  const lerArquivoImport = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    const fr = new FileReader()
    fr.onload = () => analisarImport(String(fr.result))
    fr.readAsText(file, 'utf-8')
  }

  const analisarImport = (texto) => {
    const res = importarPlanilha(texto)
    setImportacao((s) => ({ ...s, texto, res }))
  }

  const confirmarImport = async () => {
    const prods = importacao?.res?.produtos || []
    if (!prods.length) return
    const lojaPadrao = lojaAtiva !== 'todas' ? lojaAtiva : lojas[0].id
    setImportacao((s) => ({ ...s, rodando: true, progresso: 0 }))
    let imgN = 0
    for (let i = 0; i < prods.length; i++) {
      const p = { ...prods[i] }
      if (!p.validade) p.validade = dataISOmaisDias(30)
      if (importacao.comImagens && p.codigoBarras && imgN < 40) {
        imgN++
        try { const cat = await buscarProdutoCatalogo(p.codigoBarras); if (cat?.encontrado && cat.imagem) p.imagem = cat.imagem } catch (_) {}
      }
      salvarProduto({ ...p, loja: lojaPadrao })
      if (i % 10 === 0) setImportacao((s) => ({ ...s, progresso: i + 1 }))
    }
    toast(`${prods.length === 1 ? '1 produto importado' : `${prods.length} produtos importados`} do catálogo!`)
    setImportacao(null)
  }

  const buscarCatalogo = async () => {
    if (!form.codigoBarras) return toast('Digite o código de barras.', 'erro')
    setBuscandoCatalogo(true)
    const res = await buscarProdutoCatalogo(form.codigoBarras)
    setBuscandoCatalogo(false)
    if (!res) return toast('Catálogo indisponível agora.', 'erro')
    if (!res.encontrado) return toast('Produto não encontrado no catálogo.', 'info')
    setForm((f) => ({
      ...f,
      nome: res.nome || f.nome,
      marca: res.marca || f.marca,
      setor: res.setor || f.setor,
      imagem: res.imagem || f.imagem,
      imagemOrigem: res.origem || null,
      imagemOrigemNome: res.origemNome || null,
      imagemOriginal: res.imagemOriginal || null,
      imagemFonteUrl: res.imagemFonteUrl || null,
      imagemPaginaUrl: res.imagemPaginaUrl || null,
      imagemCorrespondencia: res.correspondencia || null,
      imagemAltaResolucao: Boolean(res.imagemAltaResolucao),
      codigoBarras: res.codigoBarras,
    }))
    toast('Produto importado do catálogo!')
  }

  const atualizarEmbalagem = async () => {
    if (!form.codigoBarras) return toast('Informe o código de barras do produto.', 'erro')
    setBuscandoCatalogo(true)
    const foto = await buscarImagemProduto(form, { forcarAtualizacao: true })
    setBuscandoCatalogo(false)
    if (!foto?.imagem) return toast('Nenhuma embalagem exata foi localizada para este código.', 'info')
    setForm((f) => ({
      ...f,
      imagem: foto.imagem,
      imagemOrigem: foto.origem,
      imagemOrigemNome: foto.origemNome,
      imagemOriginal: foto.imagemOriginal,
      imagemFonteUrl: foto.imagemFonteUrl,
      imagemPaginaUrl: foto.imagemPaginaUrl,
      imagemLargura: foto.imagemLargura,
      imagemAltura: foto.imagemAltura,
      imagemAprovada: Boolean(foto.imagemAprovada),
      imagemCorrespondencia: foto.correspondencia,
      imagemAltaResolucao: Boolean(foto.imagemAltaResolucao),
      imagemIlustrativa: false,
      imagemCachePermanente: Boolean(foto.imagemCachePermanente),
      imagemTratada: Boolean(foto.imagemTratada),
      imagemTratamento: foto.imagemTratamento || null,
      imagemSalvaEm: foto.imagemSalvaEm,
    }))
    toast('Nova embalagem conferida e gravada!')
  }

  const prepararUrlImagem = async () => {
    if (!form.nome) return toast('Informe primeiro o nome do produto.', 'erro')
    if (!/^https:\/\//i.test(String(form.imagem || ''))) return toast('Cole o endereço HTTPS da imagem escolhida.', 'erro')
    setBuscandoCatalogo(true)
    try {
      const foto = await prepararImagemGoogleConfirmada(form, form.imagem)
      setForm((f) => ({
        ...f,
        imagem: foto.imagem,
        imagemOrigem: foto.origem,
        imagemOrigemNome: foto.origemNome,
        imagemOriginal: foto.imagemOriginal,
        imagemFonteUrl: foto.imagemFonteUrl,
        imagemPaginaUrl: foto.imagemPaginaUrl,
        imagemAprovada: true,
        imagemManual: true,
        imagemCorrespondencia: foto.correspondencia,
        imagemAltaResolucao: null,
        imagemIlustrativa: false,
        imagemCachePermanente: true,
        imagemTratada: true,
        imagemTratamento: foto.imagemTratamento,
        imagemSalvaEm: foto.imagemSalvaEm,
      }))
      toast('Imagem manual adicionada ao produto!')
    } catch (erro) {
      toast(erro?.message || 'Não foi possível preparar essa imagem.', 'erro')
    } finally {
      setBuscandoCatalogo(false)
    }
  }

  const lista = useMemo(() => {
    const b = (busca || '').toLowerCase().trim()
    return produtos.filter((p) => {
      if (fSetor && p.setor !== fSetor) return false
      if (fStatus && statusValidade(p.validade).id !== fStatus) return false
      if (b && !`${p.nome} ${p.marca}`.toLowerCase().includes(b)) return false
      return true
    })
  }, [produtos, fSetor, fStatus, busca])

  const abrirNovo = () => setForm({ ...vazio, loja: lojaAtiva !== 'todas' ? lojaAtiva : lojas[0].id })
  const abrirEditar = (p) =>
    setForm({ ...p, precoNormal: p.precoNormal ?? '', precoPromo: p.precoPromo ?? '' })

  const salvar = (e) => {
    e.preventDefault()
    if (!form.nome || !form.setor || !form.validade || !form.precoNormal) {
      toast('Preencha nome, setor, validade e preço.', 'erro')
      return
    }
    salvarProduto({
      ...form,
      estoque: Number(form.estoque) || 0,
      precoNormal: Number(form.precoNormal),
      precoPromo: form.precoPromo ? Number(form.precoPromo) : null,
    })
    toast(form.id ? 'Produto atualizado!' : 'Produto cadastrado!')
    setForm(null)
  }

  const confirmarExcluir = () => {
    excluirProduto(excluindo.id)
    toast('Produto excluído.', 'info')
    setExcluindo(null)
  }

  const aoEnviarFoto = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      const dataUrl = await arquivoParaDataURL(file)
      setForm((f) => ({
        ...f,
        imagem: dataUrl,
        imagemManual: true,
        imagemAprovada: true,
        imagemTratada: true,
        imagemTratamento: 'imagem-manual-livre-v1',
        imagemAltaResolucao: null,
        imagemOrigem: 'upload-manual',
        imagemOrigemNome: 'Imagem adicionada manualmente',
      }))
    } catch {
      toast('Não foi possível ler a imagem.', 'erro')
    }
  }

  const adicionarFila = (p) => {
    const origem = ['critico', 'atencao', 'vencido'].includes(statusValidade(p.validade).id) ? 'vencimento' : 'manual'
    toggleFila(p.id, origem)
    toast(p.naFila ? 'Removido da fila do jornal.' : 'Adicionado à fila do jornal!', p.naFila ? 'info' : 'sucesso')
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <select value={fSetor} onChange={(e) => setFSetor(e.target.value)} className={`${inputCls.replace('w-full ', '')} w-full sm:w-auto`}>
          <option value="">Todos os setores</option>
          {SETORES.map((s) => <option key={s.id} value={s.id}>{s.nome}</option>)}
        </select>
        <select value={fStatus} onChange={(e) => setFStatus(e.target.value)} className={`${inputCls.replace('w-full ', '')} w-full sm:w-auto`}>
          <option value="">Todos os status</option>
          <option value="critico">Crítico (até 2 dias)</option>
          <option value="atencao">Atenção (até 7 dias)</option>
          <option value="normal">Normal</option>
          <option value="vencido">Vencido</option>
        </select>
        <span className="num-tab text-sm text-ink-soft">{lista.length === 1 ? '1 resultado' : `${lista.length} resultados`}</span>
        {editavel && (
          <div className="ml-auto flex gap-2">
            <Botao variante="contorno" onClick={abrirImport}><Icon name="Upload" size={16} /> Importar planilha</Botao>
            <Botao onClick={abrirNovo}><Icon name="Plus" size={16} /> Novo Produto</Botao>
          </div>
        )}
      </div>

      <div className="card-bengala overflow-hidden">
        {lista.length === 0 ? (
          <div className="p-6">
            <EmptyState
              titulo="Nenhum produto encontrado"
              descricao="Ajuste os filtros ou cadastre um novo produto."
              acao={editavel && <Botao onClick={abrirNovo}><Icon name="Plus" size={16} /> Novo Produto</Botao>}
            />
          </div>
        ) : (
          <>
            {/* tabela desktop */}
            <table className="hidden w-full text-sm md:table">
              <thead>
                <tr className="border-b border-ink-soft/10 text-left text-xs uppercase tracking-wide text-ink-soft">
                  <th className="px-4 py-3 font-medium">Produto</th>
                  <th className="px-4 py-3 font-medium">Setor</th>
                  <th className="px-4 py-3 font-medium">Estoque</th>
                  <th className="px-4 py-3 font-medium">Validade</th>
                  <th className="px-4 py-3 text-right font-medium">Normal</th>
                  <th className="px-4 py-3 text-right font-medium">Promo</th>
                  <th className="px-4 py-3 text-right font-medium">Ações</th>
                </tr>
              </thead>
              <tbody className="stagger divide-y divide-ink-soft/8">
                {lista.map((p) => (
                  <tr key={p.id} className="hover:bg-cream-200/50">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <ProdutoThumb produto={p} size={40} />
                        <div className="min-w-0">
                          <div className="font-medium text-ink">{p.nome}</div>
                          <div className="text-xs text-ink-soft">{p.marca}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-ink-soft">
                      <div>{setorById(p.setor).nome}</div>
                      <div className="text-xs text-ink-soft/70">{lojaNome(p.loja)}</div>
                    </td>
                    <td className="px-4 py-3">{p.estoque}</td>
                    <td className="px-4 py-3"><StatusBadge validade={p.validade} /></td>
                    <td className="px-4 py-3 text-right">{formatBRL(p.precoNormal)}</td>
                    <td className="px-4 py-3 text-right text-success">{p.precoPromo ? formatBRL(p.precoPromo) : '—'}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => adicionarFila(p)}
                          title={p.naFila ? 'Na fila do jornal' : 'Adicionar à fila do jornal'}
                          className={`rounded-lg p-1.5 ${p.naFila ? 'bg-coral/15 text-coral' : 'text-ink-soft hover:bg-cream-200'}`}
                        >
                          <Icon name={p.naFila ? 'Check' : 'Newspaper'} size={16} />
                        </button>
                        {editavel && (
                          <>
                            <button onClick={() => abrirEditar(p)} className="rounded-lg p-1.5 text-ink-soft hover:bg-cream-200" title="Editar">
                              <Icon name="Pencil" size={16} />
                            </button>
                            <button onClick={() => setExcluindo(p)} className="rounded-lg p-1.5 text-critical hover:bg-critical/10" title="Excluir">
                              <Icon name="Trash2" size={16} />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* cards mobile */}
            <div className="stagger divide-y divide-ink-soft/8 md:hidden">
              {lista.map((p) => (
                <div key={p.id} className="flex items-center gap-3 p-3">
                  <ProdutoThumb produto={p} />
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-medium text-ink">{p.nome}</div>
                    <div className="text-xs text-ink-soft">{p.marca} · {setorById(p.setor).nome} · {p.estoque}un</div>
                    <div className="mt-1 flex items-center gap-2">
                      <StatusBadge validade={p.validade} />
                      <span className="text-sm font-medium">{formatBRL(p.precoPromo || p.precoNormal)}</span>
                    </div>
                  </div>
                  <div className="flex flex-col gap-1">
                    <button onClick={() => adicionarFila(p)} className={`rounded-lg p-1.5 ${p.naFila ? 'bg-coral/15 text-coral' : 'text-ink-soft'}`}>
                      <Icon name="Newspaper" size={16} />
                    </button>
                    {editavel && (
                      <button onClick={() => abrirEditar(p)} className="rounded-lg p-1.5 text-ink-soft">
                        <Icon name="Pencil" size={16} />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* modal novo/editar */}
      <Modal
        open={!!form}
        onClose={() => setForm(null)}
        titulo={form?.id ? 'Editar produto' : 'Novo produto'}
        footer={
          <>
            <Botao variante="contorno" onClick={() => setForm(null)}>Cancelar</Botao>
            <Botao onClick={salvar}>Salvar</Botao>
          </>
        }
      >
        {form && (
          <form onSubmit={salvar} className="grid grid-cols-2 gap-3">
            <div className="col-span-2 flex items-center gap-3">
              {form.imagem
                ? <img src={form.imagem} alt="" className="h-16 w-16 shrink-0 rounded-lg object-cover" />
                : <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-lg bg-cream-200 text-ink-soft"><Icon name="ImagePlus" size={22} /></div>}
              <div className="min-w-0 flex-1 space-y-1.5">
                <div className="flex gap-2">
                  <label className="cursor-pointer rounded-lg border border-ink-soft/25 bg-white px-3 py-1.5 text-sm hover:bg-cream-200">
                    <Icon name="Upload" size={14} className="mr-1 inline" /> Enviar foto
                    <input type="file" accept="image/*" className="hidden" onChange={aoEnviarFoto} />
                  </label>
                  {form.nome && (
                    <button
                      type="button"
                      onClick={atualizarEmbalagem}
                      disabled={buscandoCatalogo}
                      className="rounded-lg border border-bengala/25 bg-bengala/5 px-3 py-1.5 text-sm font-medium text-bengala hover:bg-bengala/10 disabled:opacity-50"
                      title="Use somente quando a embalagem do produto tiver mudado"
                    >
                      <Icon name={buscandoCatalogo ? 'LoaderCircle' : 'RefreshCw'} size={14} className={`mr-1 inline ${buscandoCatalogo ? 'animate-spin' : ''}`} />
                      Embalagem mudou
                    </button>
                  )}
                  {form.imagem && <button type="button" onClick={() => setForm({ ...form, imagem: null })} className="rounded-lg px-2 py-1.5 text-sm text-critical hover:bg-critical/10">Remover</button>}
                </div>
                <input className={inputCls} placeholder="cole aqui o endereço da imagem escolhida" value={form.imagem && !String(form.imagem).startsWith('data:') ? form.imagem : ''} onChange={(e) => setForm({ ...form, imagem: e.target.value || null })} />
                <div className="flex flex-wrap gap-2">
                  {form.codigoBarras && (
                    <a
                      href={urlBuscaGoogleImagens(form)}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1.5 rounded-lg border border-info/25 bg-info/5 px-3 py-1.5 text-xs font-bold text-info hover:bg-info/10"
                    >
                      <Icon name="Search" size={13} /> Buscar pelo nome no Google Imagens
                    </a>
                  )}
                  {/^https:\/\//i.test(String(form.imagem || '')) && (
                    <button
                      type="button"
                      onClick={prepararUrlImagem}
                      disabled={buscandoCatalogo}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-bengala px-3 py-1.5 text-xs font-bold text-white disabled:opacity-50"
                    >
                      <Icon name={buscandoCatalogo ? 'LoaderCircle' : 'WandSparkles'} size={13} className={buscandoCatalogo ? 'animate-spin' : ''} />
                      Preparar imagem para o jornal
                    </button>
                  )}
                </div>
                <p className="text-[11px] leading-relaxed text-ink-soft">A pesquisa usa somente nome, marca e gramagem. Confira visualmente a embalagem; imagens adicionadas manualmente são aceitas como estiverem.</p>
                {(form.imagemPaginaUrl || form.imagemFonteUrl) && (
                  <a
                    href={form.imagemPaginaUrl || form.imagemFonteUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-xs font-medium text-info underline underline-offset-2"
                  >
                    <Icon name="ExternalLink" size={12} /> Ver origem da imagem
                  </a>
                )}
              </div>
            </div>
            <div className="col-span-2"><Campo label="Nome" obrigatorio><input className={inputCls} value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} /></Campo></div>
            <Campo label="Marca"><input className={inputCls} value={form.marca} onChange={(e) => setForm({ ...form, marca: e.target.value })} /></Campo>
            <Campo label="Gramagem"><input className={inputCls} value={form.gramagem || ''} onChange={(e) => setForm({ ...form, gramagem: e.target.value })} placeholder="Ex.: 350 g" /></Campo>
            <div className="col-span-2"><Campo label="Setor" obrigatorio>
              <select className={inputCls} value={form.setor} onChange={(e) => setForm({ ...form, setor: e.target.value })}>
                {SETORES.map((s) => <option key={s.id} value={s.id}>{s.nome}</option>)}
              </select>
            </Campo></div>
            <div className="col-span-2">
              <Campo label="Loja" obrigatorio>
                <select className={inputCls} value={form.loja || lojas[0].id} onChange={(e) => setForm({ ...form, loja: e.target.value })}>
                  {lojas.map((l) => <option key={l.id} value={l.id}>{l.nome}</option>)}
                </select>
              </Campo>
            </div>
            <Campo label="Estoque"><input type="number" className={inputCls} value={form.estoque} onChange={(e) => setForm({ ...form, estoque: e.target.value })} /></Campo>
            <Campo label="Validade" obrigatorio><input type="date" className={inputCls} value={form.validade} onChange={(e) => setForm({ ...form, validade: e.target.value })} /></Campo>
            <Campo label="Preço normal (R$)" obrigatorio><input type="number" step="0.01" className={inputCls} value={form.precoNormal} onChange={(e) => setForm({ ...form, precoNormal: e.target.value })} /></Campo>
            <Campo label="Preço promocional (R$)"><input type="number" step="0.01" className={inputCls} value={form.precoPromo} onChange={(e) => setForm({ ...form, precoPromo: e.target.value })} /></Campo>
            <div className="col-span-2 rounded-lg border border-info/25 bg-info/5 p-2.5">
              <div className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-info">
                <Icon name="PackageSearch" size={14} /> Importar do catálogo (mercado BR) por código de barras
              </div>
              <div className="flex gap-2">
                <input
                  className={inputCls}
                  value={form.codigoBarras}
                  onChange={(e) => setForm({ ...form, codigoBarras: e.target.value })}
                  placeholder="Ex.: 7894900011517"
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); buscarCatalogo() } }}
                />
                <Botao variante="contorno" type="button" onClick={buscarCatalogo} disabled={buscandoCatalogo} className="shrink-0">
                  <Icon name={buscandoCatalogo ? 'Loader' : 'Search'} size={15} className={buscandoCatalogo ? 'animate-spin' : ''} />
                  {buscandoCatalogo ? '...' : 'Buscar'}
                </Botao>
              </div>
            </div>
          </form>
        )}
      </Modal>

      {/* modal excluir */}
      <Modal
        open={!!excluindo}
        onClose={() => setExcluindo(null)}
        titulo="Excluir produto"
        footer={
          <>
            <Botao variante="contorno" onClick={() => setExcluindo(null)}>Cancelar</Botao>
            <Botao variante="perigo" onClick={confirmarExcluir}>Excluir</Botao>
          </>
        }
      >
        <p className="text-sm text-ink">
          Excluir <span className="font-medium">{excluindo?.nome}</span>? Esta ação não pode ser desfeita.
        </p>
      </Modal>

      {/* modal importar planilha (Cartaz Fácil / ERP) */}
      <Modal
        open={!!importacao}
        onClose={() => importacao && !importacao.rodando && setImportacao(null)}
        titulo="Importar catálogo (planilha)"
        largura="max-w-xl"
        footer={importacao && (
          <>
            <Botao variante="contorno" onClick={() => setImportacao(null)} disabled={importacao.rodando}>Cancelar</Botao>
            <Botao onClick={confirmarImport} disabled={importacao.rodando || !importacao.res?.produtos?.length}>
              {importacao.rodando ? 'Importando...' : `Importar ${importacao.res?.produtos?.length || 0}`}
            </Botao>
          </>
        )}
      >
        {importacao && (
          <div className="space-y-3">
            <p className="text-sm text-ink-soft">
              Exporte os produtos do <strong>Cartaz Fácil</strong> ou do ERP (CSV, Excel ou TXT), envie o arquivo
              ou cole o conteúdo. O sistema detecta as colunas (nome, código de barras, preço, setor…).
            </p>
            <div className="flex items-center gap-2">
              <label className="cursor-pointer rounded-lg border border-ink-soft/25 bg-white px-3 py-1.5 text-sm hover:bg-cream-200">
                <Icon name="Upload" size={14} className="mr-1 inline" /> Enviar arquivo (.csv/.txt)
                <input type="file" accept=".csv,.txt,text/csv,text/plain" className="hidden" onChange={lerArquivoImport} />
              </label>
              <span className="text-xs text-ink-soft">ou cole abaixo</span>
            </div>
            <textarea
              value={importacao.texto}
              onChange={(e) => analisarImport(e.target.value)}
              placeholder={'nome;codigo de barras;preco;setor\nLeite Integral 1L;7898215151708;5,49;laticinios'}
              className={`${inputCls} h-28 font-mono text-xs`}
            />
            {importacao.res?.erro && <p className="text-sm text-critical">{importacao.res.erro}</p>}
            {importacao.res?.produtos?.length > 0 && (
              <div className="rounded-lg border border-success/25 bg-success/5 p-3">
                <p className="text-sm font-medium text-success">{importacao.res.produtos.length === 1 ? '1 produto detectado' : `${importacao.res.produtos.length} produtos detectados`}</p>
                <ul className="mt-1 max-h-28 overflow-y-auto text-xs text-ink-soft">
                  {importacao.res.produtos.slice(0, 8).map((p, i) => (
                    <li key={i} className="truncate">• {p.nome} — {setorById(p.setor).nome} — {formatBRL(p.precoNormal)}</li>
                  ))}
                  {importacao.res.produtos.length > 8 && <li>…e mais {importacao.res.produtos.length - 8}</li>}
                </ul>
                <label className="mt-2 flex items-center gap-2 text-xs text-ink">
                  <input type="checkbox" checked={importacao.comImagens} onChange={(e) => setImportacao((s) => ({ ...s, comImagens: e.target.checked }))} className="h-4 w-4 accent-bengala" />
                  Buscar imagens pelo código de barras (mais lento, até 40)
                </label>
              </div>
            )}
            {importacao.rodando && <p className="text-sm text-ink-soft">Importando… {importacao.progresso}</p>}
          </div>
        )}
      </Modal>
    </div>
  )
}
