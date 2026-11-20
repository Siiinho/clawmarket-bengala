import MarcaClawMarket, { SimboloClawMarket } from './MarcaClawMarket'
import { useEffect, useState } from 'react'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useStore, NAV, podeVer } from '../store/StoreContext'
import { Icon } from './ui'
import { InstallButton, OfflineBadge } from './Pwa'

const SUBTITULOS = {
  dashboard: 'O que precisa de atenção hoje',
  produtos: 'Cadastro e gestão de estoque',
  ofertas: 'Descontos e promoções',
  precificacao: 'Regras de desconto automático por validade',
  cartazes: 'Gerador de cartaz promocional',
  jornal: 'Encarte e jornal de ofertas internas',
  relatorios: 'Indicadores e perdas',
  esg: 'Impacto ambiental e desperdício evitado',
  scanner: 'Consulta rápida por código de barras',
  usuarios: 'Equipe e permissões',
  config: 'Estabelecimento e automação',
}

const MENU_PRINCIPAL = ['dashboard', 'scanner', 'produtos', 'ofertas', 'jornal']
const MENU_MOBILE = [
  { key: 'dashboard', label: 'Início', path: '/', icone: 'Home', end: true },
  { key: 'scanner', label: 'Bipar', path: '/scanner', icone: 'ScanLine' },
  { key: 'produtos', label: 'Produtos', path: '/produtos', icone: 'Package' },
  { key: 'jornal', label: 'Jornal', path: '/jornal', icone: 'Newspaper' },
]

function Marca({ colapsado }) {
  return (
    <div className="relative flex items-center gap-2.5 overflow-hidden border-b border-white/10 px-3 py-4">
      <span className="pointer-events-none absolute -right-5 -top-7 h-20 w-20 rounded-full border-[14px] border-offer/15" />
      {colapsado
        ? <SimboloClawMarket tamanho={36} />
        : <MarcaClawMarket tamanho={38} subtitulo="Supermercado Bengala" className="relative" />}
    </div>
  )
}

export default function Layout() {
  const { usuario, logout, lojas, lojaAtiva, setLojaAtiva } = useStore()
  const location = useLocation()
  const navigate = useNavigate()
  const [colapsado, setColapsado] = useState(false)
  const [drawerAberto, setDrawerAberto] = useState(false)
  const [busca, setBusca] = useState('')
  const [maisAberto, setMaisAberto] = useState(false)

  const atual = NAV.find((n) => n.path === location.pathname) || NAV[0]
  const itensVisiveis = NAV.filter((n) => podeVer(usuario.papel, n.key))
  const itensMobile = MENU_MOBILE.filter((n) => podeVer(usuario.papel, n.key))
  const itensPrincipais = MENU_PRINCIPAL
    .map((key) => itensVisiveis.find((n) => n.key === key))
    .filter(Boolean)
  const itensSecundarios = itensVisiveis.filter((n) => !MENU_PRINCIPAL.includes(n.key))
  const inicial = (usuario.nome || '?').charAt(0).toUpperCase()

  useEffect(() => {
    if (itensSecundarios.some((n) => n.key === atual.key)) setMaisAberto(true)
  }, [atual.key])

  const sair = () => {
    logout()
    navigate('/login')
  }

  const ItemMenu = ({ n, mobile }) => (
    <NavLink
      key={n.key}
      to={n.path}
      end={n.path === '/'}
      onClick={() => setDrawerAberto(false)}
      className={({ isActive }) =>
        `relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm ${
          isActive ? 'bg-bengala font-semibold text-white' : 'text-white/72 hover:bg-white/8 hover:text-white'
        }`
      }
    >
      {({ isActive }) => (
        <>
          {isActive && <span className="absolute left-0 top-2 bottom-2 w-1 rounded-r bg-offer" />}
          <Icon name={n.icone} size={18} className="shrink-0" />
          {(mobile || !colapsado) && <span className="truncate">{n.label}</span>}
        </>
      )}
    </NavLink>
  )

  const Sidebar = ({ mobile }) => (
    <aside
      className="flex h-full flex-col bg-brick text-cream transition-all"
      style={{ width: mobile ? 248 : colapsado ? 64 : 240 }}
    >
      <Marca colapsado={!mobile && colapsado} />
      <nav className="flex-1 overflow-y-auto px-2 py-3">
        {(mobile || !colapsado) && <p className="mb-1 px-3 text-[9px] font-bold uppercase tracking-[.14em] text-white/35">Principal</p>}
        <div className="space-y-1">
          {itensPrincipais.map((n) => <ItemMenu key={n.key} n={n} mobile={mobile} />)}
        </div>

        {itensSecundarios.length > 0 && (
          <div className="mt-3 border-t border-white/10 pt-2">
            <button
              onClick={() => setMaisAberto((aberto) => !aberto)}
              className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-white/60 hover:bg-white/8 hover:text-white"
              title="Mais opções"
            >
              <Icon name="MoreHorizontal" size={18} className="shrink-0" />
              {(mobile || !colapsado) && (
                <>
                  <span className="flex-1 text-left">Mais opções</span>
                  <Icon name={maisAberto ? 'ChevronUp' : 'ChevronDown'} size={15} />
                </>
              )}
            </button>
            {maisAberto && (
              <div className="mt-1 space-y-1">
                {itensSecundarios.map((n) => <ItemMenu key={n.key} n={n} mobile={mobile} />)}
              </div>
            )}
          </div>
        )}
      </nav>
      <div className="border-t border-cream/10 p-3">
        {(mobile || !colapsado) && (
          <div className="mb-3">
            <InstallButton />
          </div>
        )}
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-coral font-medium text-white">
            {inicial}
          </div>
          {(mobile || !colapsado) && (
            <div className="min-w-0 flex-1 leading-tight">
              <div className="truncate text-sm font-medium text-cream">{usuario.nome}</div>
              <div className="truncate text-[11px] text-cream/60">{usuario.cargo}</div>
            </div>
          )}
          {(mobile || !colapsado) && (
            <button onClick={sair} title="Sair" className="rounded-lg p-1.5 text-cream/70 hover:bg-brick-light">
              <Icon name="LogOut" size={17} />
            </button>
          )}
        </div>
      </div>
    </aside>
  )

  return (
    <div className="flex h-screen h-dvh overflow-hidden bg-cream">
      {/* sidebar desktop */}
      <div className="hidden md:block">
        <Sidebar mobile={false} />
      </div>

      {/* drawer mobile */}
      {drawerAberto && (
        <div className="fixed inset-0 z-40 md:hidden">
          <div className="absolute inset-0 bg-ink/40" onClick={() => setDrawerAberto(false)} />
          <div className="absolute left-0 top-0 h-full">
            <Sidebar mobile />
          </div>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        {/* header */}
        <header
          className="z-10 flex min-h-[64px] items-center gap-3 border-b border-navy/8 bg-white px-4 pb-2.5 shadow-sm"
          style={{ paddingTop: 'max(.625rem, env(safe-area-inset-top))' }}
        >
          <button
            onClick={() => setDrawerAberto(true)}
            aria-label="Abrir menu"
            className="rounded-lg p-1.5 text-ink-soft hover:bg-cream-200 md:hidden"
          >
            <Icon name="Menu" size={20} />
          </button>
          <button
            onClick={() => setColapsado((c) => !c)}
            aria-label={colapsado ? 'Expandir menu lateral' : 'Recolher menu lateral'}
            className="hidden rounded-lg p-1.5 text-ink-soft hover:bg-cream-200 md:block"
          >
            <Icon name="PanelLeft" size={20} />
          </button>
          <div className="min-w-0 flex-1">
            <h1 className="display-bengala truncate text-xl leading-tight text-navy">{atual.label}</h1>
            <p className="truncate text-xs text-ink-soft">{SUBTITULOS[atual.key]}</p>
          </div>
          <span className="hidden max-w-40 truncate rounded-full bg-offer px-2.5 py-1 text-xs font-black text-navy sm:inline-flex lg:hidden">
            Piloto · Loja 3
          </span>
          <OfflineBadge />
          <div className="relative hidden lg:block">
            <Icon name="Store" size={15} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-soft" />
            <select
              value={lojaAtiva}
              onChange={(e) => setLojaAtiva(e.target.value)}
              className="appearance-none rounded-lg border border-ink-soft/20 bg-white py-2 pl-8 pr-7 text-sm font-medium outline-none focus:border-bengala focus:ring-2 focus:ring-bengala/20"
            >
              <option value="todas">Todas as lojas</option>
              {lojas.map((l) => <option key={l.id} value={l.id}>{l.nome}</option>)}
            </select>
            <Icon name="ChevronDown" size={14} className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-ink-soft" />
          </div>
          {atual.key === 'produtos' && (
          <div className="relative hidden sm:block">
            <Icon name="Search" size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-soft" />
            <input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar produto..."
              className="w-44 rounded-lg border border-ink-soft/20 bg-white py-2 pl-9 pr-3 text-sm outline-none focus:w-56 focus:border-bengala focus:ring-2 focus:ring-bengala/20 lg:w-56"
            />
          </div>
          )}
          {atual.key !== 'scanner' && (
            <button
              onClick={() => navigate('/scanner')}
              className="inline-flex shrink-0 items-center gap-2 rounded-lg bg-bengala px-3 py-2 text-sm font-semibold text-white hover:bg-bengala-dark"
            >
              <Icon name="ScanLine" size={17} />
              <span className="hidden sm:inline">Escanear</span>
            </button>
          )}
        </header>

        <main className="flex-1 overflow-x-hidden overflow-y-auto p-4 pb-24 md:p-5">
          <Outlet context={{ busca, setBusca }} />
        </main>

        <nav
          className="fixed bottom-0 left-0 right-0 z-30 grid border-t border-navy/10 bg-white/95 px-2 pb-[max(.5rem,env(safe-area-inset-bottom))] pt-2 shadow-[0_-8px_24px_rgba(8,43,79,.08)] backdrop-blur md:hidden"
          style={{ gridTemplateColumns: `repeat(${itensMobile.length}, minmax(0, 1fr))` }}
          aria-label="Navegação principal"
        >
          {itensMobile.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.end}
              className={({ isActive }) =>
                `flex min-h-12 flex-col items-center justify-center gap-0.5 rounded-xl text-[11px] font-bold transition ${
                  isActive ? 'bg-bengala/10 text-bengala' : 'text-ink-soft'
                }`
              }
            >
              <Icon name={item.icone} size={20} />
              {item.label}
            </NavLink>
          ))}
        </nav>
      </div>
    </div>
  )
}
