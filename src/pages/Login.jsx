import MarcaClawMarket from '../components/MarcaClawMarket'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStore } from '../store/StoreContext'
import { Icon, Botao } from '../components/ui'

const DESTAQUES = [
  { icone: 'TrendingDown', titulo: '38% menos perdas', desc: 'no primeiro mês de uso' },
  { icone: 'MousePointerClick', titulo: '1 clique', desc: 'para gerar cartazes e jornal' },
  { icone: 'BellRing', titulo: 'Tempo real', desc: 'alertas de validade por setor' },
]

export default function Login() {
  const { login, registrar, toast } = useStore()
  const navigate = useNavigate()
  const [modo, setModo] = useState('entrar') // entrar | criar
  const [identificador, setIdentificador] = useState('')
  const [senha, setSenha] = useState('')
  const [nome, setNome] = useState('')
  const [papel, setPapel] = useState('repositor')
  const [erro, setErro] = useState('')

  const CLS = 'w-full rounded-lg border border-ink-soft/20 bg-white px-3 py-2.5 text-sm outline-none focus:border-bengala focus:ring-2 focus:ring-bengala/20'

  const entrar = (e) => {
    e.preventDefault()
    if (login(identificador, senha)) {
      toast(`Bem-vindo, ${identificador.split('@')[0]}!`)
      navigate('/')
    } else setErro('Nome de usuário ou senha incorretos.')
  }

  const criar = (e) => {
    e.preventDefault()
    const r = registrar({ nome, papel, senha })
    if (r.ok) {
      toast(`Conta criada. Bem-vindo, ${nome}!`)
      navigate('/')
    } else setErro(r.erro)
  }

  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      {/* lado esquerdo */}
      <div className="relative flex flex-col justify-between bg-brick p-8 text-cream md:w-1/2 md:p-12">
        <div
          className="pointer-events-none absolute inset-0 opacity-90"
          style={{ background: 'linear-gradient(135deg, #7a241b 0%, #b23320 60%, #e23a2e 100%)' }}
        />
        <div className="relative z-10 flex items-center gap-3">
          <MarcaClawMarket tamanho={52} subtitulo="Encartes digitais para supermercados" />
        </div>

        <div className="relative z-10 my-10">
          <h1 className="max-w-md text-3xl font-bold leading-tight md:text-4xl">
            Chega de perder dinheiro com vencimentos
          </h1>
          <p className="mt-3 max-w-md text-cream/80">
            Controle a validade, gere ofertas e monte o jornal de ofertas internas em minutos.
          </p>
          <div className="mt-8 space-y-4">
            {DESTAQUES.map((d) => (
              <div key={d.titulo} className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-cream/15 text-coral">
                  <Icon name={d.icone} size={20} />
                </div>
                <div>
                  <div className="font-medium">{d.titulo}</div>
                  <div className="text-sm text-cream/70">{d.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="relative z-10 text-xs text-cream/50">© 2026 ClawMarket · cliente piloto: Bengala Supermercado</div>
      </div>

      {/* lado direito */}
      <div className="flex flex-1 items-center justify-center bg-cream p-6 md:p-12">
        <div className="w-full max-w-sm">
          <div className="mb-5 flex gap-1 rounded-lg bg-cream-200 p-1">
            {[['entrar', 'Entrar'], ['criar', 'Criar conta']].map(([id, l]) => (
              <button
                key={id}
                onClick={() => { setModo(id); setErro('') }}
                className={`flex-1 rounded-md py-1.5 text-sm font-medium transition ${modo === id ? 'bg-white text-ink shadow-sm' : 'text-ink-soft'}`}
              >
                {l}
              </button>
            ))}
          </div>

          {modo === 'entrar' ? (
            <form onSubmit={entrar} className="space-y-4">
              <div>
                <label htmlFor="login-usuario" className="mb-1 block text-sm font-medium">Nome de usuário</label>
                <input id="login-usuario" value={identificador} onChange={(e) => setIdentificador(e.target.value)} placeholder="Seu nome de usuário" autoComplete="username" className={CLS} />
              </div>
              <div>
                <label htmlFor="login-senha" className="mb-1 block text-sm font-medium">Senha</label>
                <input id="login-senha" type="password" value={senha} onChange={(e) => setSenha(e.target.value)} placeholder="••••••" autoComplete="current-password" className={CLS} />
              </div>
              {erro && <p className="text-sm text-critical">{erro}</p>}
              <Botao type="submit" className="w-full py-2.5">Entrar</Botao>
            </form>
          ) : (
            <form onSubmit={criar} className="space-y-4">
              <div>
                <label htmlFor="criar-usuario" className="mb-1 block text-sm font-medium">Nome de usuário</label>
                <input id="criar-usuario" value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Crie seu nome de usuário" autoComplete="username" className={CLS} />
              </div>
              <div>
                <label htmlFor="criar-funcao" className="mb-1 block text-sm font-medium">Função</label>
                <select id="criar-funcao" value={papel} onChange={(e) => setPapel(e.target.value)} className={CLS}>
                  <option value="admin">Administrador — acesso total</option>
                  <option value="gerente">Gerente — ofertas, jornal e fila</option>
                  <option value="repositor">Repositor — chão de loja</option>
                </select>
              </div>
              <div>
                <label htmlFor="criar-senha" className="mb-1 block text-sm font-medium">Senha</label>
                <input id="criar-senha" type="password" value={senha} onChange={(e) => setSenha(e.target.value)} placeholder="••••••" autoComplete="new-password" className={CLS} />
              </div>
              {erro && <p className="text-sm text-critical">{erro}</p>}
              <Botao type="submit" className="w-full py-2.5">Criar conta e entrar</Botao>
            </form>
          )}
          <p className="mt-6 text-center text-xs text-ink-soft">Cada conta mantém seus próprios produtos, bipagens, ofertas e jornais.</p>
        </div>
      </div>
    </div>
  )
}
