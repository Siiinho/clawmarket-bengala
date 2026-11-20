import { lazy, Suspense } from 'react'
import { Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { useStore, podeVer } from './store/StoreContext'
import { Icon, Toasts } from './components/ui'
import Layout from './components/Layout'
import Login from './pages/Login'

const Dashboard = lazy(() => import('./pages/Dashboard'))
const Produtos = lazy(() => import('./pages/Produtos'))
const Ofertas = lazy(() => import('./pages/Ofertas'))
const Precificacao = lazy(() => import('./pages/Precificacao'))
const Cartazes = lazy(() => import('./pages/Cartazes'))
const Jornal = lazy(() => import('./pages/Jornal'))
const Relatorios = lazy(() => import('./pages/Relatorios'))
const Sustentabilidade = lazy(() => import('./pages/Sustentabilidade'))
const Scanner = lazy(() => import('./pages/Scanner'))
const Usuarios = lazy(() => import('./pages/Usuarios'))
const Config = lazy(() => import('./pages/Config'))

function Carregando() {
  return (
    <div className="flex min-h-48 items-center justify-center gap-2 text-sm font-medium text-bengala">
      <Icon name="LoaderCircle" size={20} className="animate-spin" /> Carregando…
    </div>
  )
}

function Protegida({ chave, children }) {
  const { usuario } = useStore()
  const location = useLocation()
  if (!usuario) return <Navigate to="/login" replace state={{ from: location }} />
  if (chave && !podeVer(usuario.papel, chave)) return <Navigate to="/" replace />
  return children
}

export default function App() {
  const { usuario } = useStore()
  return (
    <>
      <Suspense fallback={<Carregando />}>
        <Routes>
          <Route path="/login" element={usuario ? <Navigate to="/" replace /> : <Login />} />
          <Route element={<Protegida><Layout /></Protegida>}>
            <Route index element={<Dashboard />} />
            <Route path="produtos" element={<Protegida chave="produtos"><Produtos /></Protegida>} />
            <Route path="ofertas" element={<Protegida chave="ofertas"><Ofertas /></Protegida>} />
            <Route path="precificacao" element={<Protegida chave="precificacao"><Precificacao /></Protegida>} />
            <Route path="cartazes" element={<Protegida chave="cartazes"><Cartazes /></Protegida>} />
            <Route path="jornal" element={<Protegida chave="jornal"><Jornal /></Protegida>} />
            <Route path="relatorios" element={<Protegida chave="relatorios"><Relatorios /></Protegida>} />
            <Route path="sustentabilidade" element={<Protegida chave="esg"><Sustentabilidade /></Protegida>} />
            <Route path="scanner" element={<Protegida chave="scanner"><Scanner /></Protegida>} />
            <Route path="usuarios" element={<Protegida chave="usuarios"><Usuarios /></Protegida>} />
            <Route path="config" element={<Protegida chave="config"><Config /></Protegida>} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
      <Toasts />
    </>
  )
}
