# ClawMarket — Bengala Supermercado

SaaS de **gestão de validade e ofertas** para supermercados, em português (pt-BR).
Reduz perdas com produtos perto do vencimento automatizando ofertas, cartazes e o
**jornal de ofertas internas** no layout do encarte Bengala.

> Cliente piloto: **Bengala Supermercado — Loja 3**. Interface e identidade visual exclusivas, derivadas da logo oficial.

## Estado desta entrega

Esta versão está pronta para validação operacional controlada na Loja 3:

- fluxo **bipar → validade/lote/quantidade → confirmar → fila do jornal**;
- confirmação idempotente, com som, vibração e opção de desfazer;
- ofertas criadas também entram na fila;
- navegação mobile inferior e PWA instalável;
- nomes completos no jornal, sem reticências;
- checagem de preço, validade, repetição e imagem antes do PDF;
- paginação A4 automática, incluindo frente e verso;
- dados oficiais da Loja 3 centralizados.

O armazenamento ainda é local para o piloto. Antes de disponibilizar o sistema
publicamente, conclua autenticação, banco, auditoria e sincronização conforme
[`SECURITY.md`](SECURITY.md). Para continuar no Google AI Studio, consulte
[`docs/GOOGLE-AI-STUDIO.md`](docs/GOOGLE-AI-STUDIO.md).

---

## 🚀 Como rodar

Pré-requisitos: **Node.js 18+** (testado no Node 24) e npm.

```bash
cd clawmarket
npm install      # só na primeira vez
npm run dev      # abre em http://localhost:5173
```

**Login:** clique numa das 3 contas de demonstração na tela de login. Senha de todas: `demo123`.

| Conta | Papel | Acesso |
|---|---|---|
| Carlos Mendes | Administrador | Tudo (inclui **Precificação** — envolve custo) |
| Ana Paula Silva | Gerente | Produtos, Ofertas, Cartazes, Jornal, Scanner (sem Precificação/Relatórios/Config) |
| Juliana Costa | Repositora | Dashboard e Scanner |

Clique numa conta demo para entrar direto, ou use **Criar conta** (nome, função, senha). Login aceita **nome ou e-mail**.

Os dados ficam salvos no **navegador** (localStorage). A exclusão local fica em
uma zona de perigo nas Configurações e exige digitar `RESTAURAR`.

### Gerar versão para distribuir / hospedar

```bash
npm run build    # gera a pasta dist/
npm run preview  # testa o build localmente
```

O build usa `base: './'`, então o `dist/index.html` funciona tanto hospedado (Hostinger,
Vercel, Netlify…) quanto aberto direto do disco.

---

## ✨ Funcionalidades (telas)

1. **Login** — split-screen com identidade Bengala e contas demo.
2. **Dashboard** — banner de alerta, 4 indicadores (estoque, vencendo em 7 dias, ofertas ativas, perda potencial), lista de produtos próximos ao vencimento e resumo por setor.

> **Piloto:** a Loja 3 é selecionada inicialmente e identificada no celular. A
> estrutura continua preparada para expansão futura, mas não inventa dados das
> demais lojas.
3. **Produtos** — CRUD completo, filtros por setor e status, busca por nome/marca, botão **“Adicionar à fila do jornal”**, **importação por código de barras** (catálogo Open Food Facts) e **importação de planilha** (Cartaz Fácil/ERP — CSV/Excel/TXT, com mapeamento de colunas; ver [docs/IMPORTAR-CATALOGO.md](docs/IMPORTAR-CATALOGO.md)).
4. **Ofertas** — sugestões automáticas (produtos vencendo sem oferta), grade de ofertas e modal com slider de desconto e preview de preço.
5. **Precificação** — motor de regras de desconto por validade (ex.: ≤2 dias → −50%, ≤5 → −30%, ≤7 → −15%): faixas editáveis, prévia do preço sugerido por produto, e aplicação de ofertas em massa. As sugestões automáticas de Ofertas usam essas regras.
5. **Cartazes** — gerador de cartaz com 4 modelos e **export PNG**.
6. **Jornal de Ofertas** — a peça central (veja [docs/JORNAL.md](docs/JORNAL.md)):
   - **Fila de produtos** por setor (alimentada em Produtos/Ofertas);
   - **Gerar jornal** nos tipos **Geral**, **Por setor** e **Sazonal** (Dia B, Copa, Feijoada, Festa Junina);
   - produtos de vencimento entram **sempre no topo como “GRANDE IDEIA · oferta interna”**;
   - preview ao vivo no layout do encarte Bengala e **export PDF**;
   - **Jornal Oficial** sincronizado do site da Bengala.
7. **Relatórios** — valor por setor, status de validade, top setores em alerta.
8. **Sustentabilidade (ESG)** — desperdício evitado (kg), CO₂ evitado, refeições equivalentes, taxa de aproveitamento, impacto por setor e “em risco agora”, com relatório PDF. Peso estimado pelo nome do produto; fatores em `src/lib/utils.js`.
8. **Scanner (modo gôndola)** — o repositor bipa o código, confere o produto,
informa validade, lote opcional e quantidade e confirma. O produto entra uma
única vez na fila da Loja 3. Quando existe regra de desconto, a oferta é criada
automaticamente. O operador pode desfazer ou iniciar imediatamente o próximo bip.
9. **Usuários** — lista da equipe + matriz de permissões (só Admin).
10. **Configurações** — dados do mercado, alertas e automação (só Admin).

---

## 🎨 Design System Bengala

Cores derivadas da logo (definidas em [`src/index.css`](src/index.css)):

| Token | Hex | Uso |
|---|---|---|
| `cream` | `#FBF6EE` | fundo do app |
| `bengala` | `#E23A2E` | primária — botões, menu ativo, marca |
| `coral` | `#F47B36` | destaque — selos de oferta, CTA |
| `brick` | `#7A241B` | sidebar e cabeçalhos de pôster |
| `info` | `#2E6FB0` | links/informação (do ponto azul da logo) |
| `success` | `#2E9E6B` | status normal, economia |
| `warning` | `#F2A93B` | validade ≤ 7 dias |
| `critical` | `#C42B2B` | validade ≤ 2 dias / perigo (vermelho **escuro**, distinto da marca) |

**Regra de ouro:** vermelho **vivo** = marca; vermelho **escuro** = perigo/urgência.

Faixas dos 9 setores (jornal): Padaria `#C77E1A` · Laticínios `#3E86C9` · Frios `#B23A48` ·
Hortifruti `#2E9E6B` · Bebidas `#E23A2E` · Mercearia `#D9641F` · Limpeza `#178F86` ·
Congelados `#2C84B0` · Pet Shop `#8A4FA0`.

---

## 🧱 Estrutura do projeto

```
clawmarket/
├── index.html
├── vite.config.js          # base:'./', plugins react + tailwind
├── public/favicon.svg
├── src/
│   ├── main.jsx            # entrada — HashRouter + StoreProvider
│   ├── App.jsx            # rotas + proteção por papel
│   ├── index.css         # design system Bengala (Tailwind v4 @theme)
│   ├── store/StoreContext.jsx   # store central + localStorage + ações
│   ├── data/seed.js     # usuários, produtos, config de exemplo
│   ├── lib/
│   │   ├── utils.js     # setores, datas, statusValidade, formatBRL...
│   │   └── exportar.js  # export PNG/PDF (html2canvas + jsPDF)
│   ├── components/
│   │   ├── Layout.jsx   # sidebar + header
│   │   └── ui.jsx       # botão, modal, badges, preço varejo, toasts...
│   └── pages/           # Login, Dashboard, Produtos, Ofertas,
│                        # Cartazes, Jornal, Relatorios, Scanner,
│                        # Usuarios, Config
└── docs/                # documentação detalhada
```

Detalhes técnicos em [docs/ARQUITETURA.md](docs/ARQUITETURA.md).
Guia de operação do dia a dia em [docs/GUIA-DE-USO.md](docs/GUIA-DE-USO.md).

---

## 📌 Regras de negócio

- Validade **≤ 2 dias** → status **Crítico** (vermelho escuro)
- Validade **≤ 7 dias** → status **Atenção** (âmbar)
- Validade **> 7 dias** → **Normal** (verde)
- Vencidos contam como **perda potencial** nos relatórios
- O sistema **sugere** ofertas automáticas para produtos perto do vencimento
- Toda essa lógica está centralizada em `statusValidade()` (`src/lib/utils.js`)

---

## 🏆 Destaques técnicos (portfólio)

- **Identidade visual própria** derivada da logo do cliente (paleta vermelha/coral em oklch).
- **Gerador de encarte** que replica o layout do jornal oficial da Bengala, com export PDF
  (html2canvas + jsPDF) e cuidado com cores `color-mix`/oklch.
- **Integração com catálogo real** do mercado brasileiro por código de barras (Open Food Facts):
  importa nome, marca, **foto** e infere o setor — substituto pragmático de integração de PDV.
- **Multi-filial** com visão consolidada e **benchmark entre lojas**.
- **Motor de precificação por regras** (desconto por dias até vencer) com aplicação em massa.
- **Módulo ESG**: desperdício evitado, CO₂ e refeições, a partir do peso estimado pelo nome.
- **PWA offline-first** instalável + **leitura de código de barras pela câmera** (@zxing).
- **Controle de acesso por papel** (Admin/Gerente/Repositor) — ex.: precificação só p/ Admin.
- **Backend preparado** (Supabase multi-tenant + RLS, deploy Vercel) — ver [docs/FASE2-SUPABASE.md](docs/FASE2-SUPABASE.md).

## 🔧 Pendências / próximos passos

- [x] **Logo oficial Bengala** no login, sidebar e encarte (`src/assets/logo.png`)
- [x] **Fotos de produto** — upload com redimensionamento ou URL (cadastro de Produtos)
- [x] **Auto-sync do jornal oficial** — backend `/api/jornal-oficial` lê a REST API do
  WordPress da Bengala e detecta a edição mais recente (dev: middleware do Vite;
  produção: função serverless em `api/`). Sai do ar só em build estático puro (aí o
  modo manual continua).
- [x] **PWA offline-first** — instalável no celular (manifest + service worker via
  `vite-plugin-pwa`), funciona offline (dados em localStorage), botão “Instalar app”,
  selo de offline e **leitura de código de barras pela câmera** no Scanner (@zxing).
- [x] Templates sazonais detalhados (Dia B, Copa, Feijoada, Festa Junina — motivos visuais no encarte)
- [◑] **Fase 2 — terreno pronto** (schema, cliente dormente, Vercel config). Migração ainda
  não feita. Guia: [docs/FASE2-SUPABASE.md](docs/FASE2-SUPABASE.md).
- [ ] Otimização: code-split de html2canvas/jspdf (reduzir o bundle principal)

---

## ⚠️ Notas técnicas importantes

- **Export PDF/PNG:** `html2canvas` 1.4.1 **não** entende cores `color-mix()`/`oklch`. Por isso, dentro de qualquer pôster/cartaz exportável usamos **cores sólidas** (hex/rgba inline) e evitamos classes Tailwind com opacidade (ex.: `text-cream/80`). Manter esse cuidado ao editar o Jornal e os Cartazes.
- **Jornal oficial / CORS:** o navegador bloqueia ler o site da Bengala direto. Hoje o admin cola a edição/URLs novas. Detecção automática exige backend/proxy.
