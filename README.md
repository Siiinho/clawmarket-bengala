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

---

## 🖼️ Imagens por código de barras (EAN Images)

A chave fica **só no servidor**, nunca no navegador. No PC onde o app roda, crie o
arquivo `.env` na pasta do projeto (ele já está no `.gitignore`) com:

```
EANIMAGES_API_KEY=sua_chave_aqui
EANIMAGES_COM_DADOS=1
```

Depois rode `npm run dev` (ou `npm run build` + `npm run preview`). O app chama
`/api/eanimages?ean=...` e o servidor fala com a EAN Images. Na Vercel, cadastre a
mesma variável em *Environment Variables*. Nunca use o prefixo `VITE_` nessa chave.

## 📰 Encarte digital (link da tag NFC)

- Página pública: `#/encarte` (sem login), no formato de post de supermercado
  (topo da campanha + grade 3×3 ou 1 destaque + 7), responsiva no celular e no PC.
- No Jornal: escolha tema, layout e, se quiser, envie o **fundo do template**
  (arte 1080 × 1350 exportada sem produtos, logo e validade). Clique **Publicar agora**.
- A validade dos produtos nunca aparece no encarte.

### Como o site fica no ar pelo PC do mercado

1. No PC da loja rode `npm run dev` (ou `npm run build && npm run preview`). O servidor
   já escuta na rede (`host: true`), então o terminal mostra um endereço `Network`.
2. Em **Jornal › Encarte digital** aparece "Site no ar" com o link para gravar na tag NFC
   (ex.: `http://192.168.0.10:5173/#/encarte`) e o botão **Copiar**. Use um IP fixo no PC
   (reserva de DHCP no roteador) para a tag não perder o endereço.
3. **Publicar agora** manda o encarte para `server/encarteServidor.js`, que guarda a versão
   em `dados/encarte/encarte.json` e as fotos em `dados/encarte/img/` (fora do Git).
4. Todo celular com o link aberto recebe a versão nova na hora (Server-Sent Events em
   `/api/encarte/eventos`), mostra a faixa "Ofertas atualizadas agora!" e remonta o encarte.

Quem pode publicar: sem `ENCARTE_TOKEN` no `.env`, só o próprio PC e a rede local (pedidos
vindos de túnel/proxy são recusados). Para publicar de fora, defina `ENCARTE_TOKEN` no `.env`
do PC; o app pede a "Senha de publicação" e a guarda só naquele aparelho.

### Motion design e prévia de cada produto

- As páginas se montam ao aparecer na tela: topo desce, produtos entram em sequência, selos
  "carimbam" e balançam, o preço pulsa com um brilho e o fundo faz um zoom lento.
  A animação só roda na página pública (`<PaginaTemplate animado>`); PNG e PDF saem parados.
  Quem pede menos movimento no celular (`prefers-reduced-motion`) vê tudo parado.
- Tocar num produto abre a prévia: foto, selo, De/Por, "Você economiza", **Compartilhar**
  (menu do celular ou copia o link) e **WhatsApp** da loja. Deslize para o lado (ou use as
  setas) para ver a próxima oferta. Cada produto tem link próprio: `#/encarte?p=<id>`.

## Baixar artes (várias saídas da mesma lista)

Em **Jornal › Baixar artes**, a mesma lista de ofertas bipadas vira:

| Saída | Tamanho | Uso |
| --- | --- | --- |
| Feed | 1080 × 1350 (4:5) | Instagram e Facebook |
| Stories | 1080 × 1920 (9:16) | Status do WhatsApp e Stories |
| TV | 1920 × 1080 (16:9) | TV da loja e telão |
| Post por oferta | 1080 × 1080 (1:1) | uma arte para cada produto |
| Cartaz | folha A4 com 1 A4, 2 A5, 4 A6 ou 8 A7 | impressão, com linha de corte |
| Etiquetas | 24 por folha A4 | preço de gôndola |

As artes de rede social saem em PNG no tamanho exato; no celular o botão
**Compartilhar** manda direto para WhatsApp ou Instagram. Cartazes e etiquetas
saem em PDF A4 de alta resolução. A validade dos produtos nunca aparece, só o
período da campanha.

## Temas com arte e selos ilustrados

- `public/temas/<tema>/` guarda os fundos de cada tema (Feed, Stories, TV, Post e a
  miniatura do seletor). Foram gerados a partir dos templates enviados pelo mercado: o
  template é desfocado (somem os produtos e textos de exemplo) e a arte do título fica
  nítida. Logo, chamada, validade, endereço e produtos são colocados pelo sistema.
  **Antes de vender o ClawMarket para outros mercados, confirme que a licença desses
  templates permite esse uso, ou troque por artes próprias.**
- Os temas ficam em `src/lib/temasCampanha.js`, separados por seção (Açougue, Hortifruti,
  Semana, Fim de semana, Fim de mês, Datas, Geral).
- Os selos (Oferta, Imperdível, Queima de estoque, Super oferta, Preço baixo, Leve mais,
  Só hoje, Exclusivo) são desenhados em `src/components/SeloArte.jsx` com a fonte livre
  Bangers (OFL, pacote `@fontsource/bangers`).

### Testar a EAN Images no PC

Coloque a chave no `.env` (`EANIMAGES_API_KEY=...`) e rode:

```bash
npm run testar:eanimages                    # confere a chave e o saldo, sem gastar crédito
npm run testar:eanimages -- 7891000100103   # busca um produto (pode gastar créditos na 1ª vez)
```
