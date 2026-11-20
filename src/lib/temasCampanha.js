// Temas de campanha do encarte digital.
// Os temas com `arte` usam os fundos gerados a partir dos templates enviados pelo mercado
// (public/temas/<id>/feed|stories|tv|post.webp): o template desfocado some com os produtos e
// textos de exemplo, e a arte do título fica nítida. O sistema posiciona por cima logo,
// validade, endereço e produtos. O tema "Cores do mercado" é todo em CSS.
// Cada tema também define as cores do selo de preço e da faixa de validade.

const base = (typeof import.meta !== 'undefined' && import.meta.env?.BASE_URL) || '/'
export const caminhoArte = (tema, arquivo) => (tema?.arte ? `${base}temas/${tema.arte}/${arquivo}.webp` : null)

const P = {
  vermelho: { fundo: 'linear-gradient(160deg,#5c0a0a 0%,#c1121f 50%,#fb5607 100%)', contorno: '#5c0a0a', precoFundo: '#ffd60a', precoCor: '#c1121f', precoSombra: '#5c0a0a', faixa: '#ffd60a', faixaTexto: '#5c0a0a', corTitulo: '#ffffff', corDestaque: '#ffd60a' },
  laranja: { fundo: 'linear-gradient(160deg,#7c1d06 0%,#e85d04 50%,#ffba08 100%)', contorno: '#7c1d06', precoFundo: '#ffe14d', precoCor: '#b3170f', precoSombra: '#7c1d06', faixa: '#7c1d06', faixaTexto: '#ffffff', corTitulo: '#ffffff', corDestaque: '#ffe14d' },
  dourado: { fundo: 'linear-gradient(160deg,#5a2a00 0%,#c77d00 50%,#ffd23f 100%)', contorno: '#3d1d00', precoFundo: '#ffd84d', precoCor: '#b3170f', precoSombra: '#3d1d00', faixa: '#b3170f', faixaTexto: '#ffffff', corTitulo: '#fff6d6', corDestaque: '#ffd84d' },
  verde: { fundo: 'linear-gradient(160deg,#0a4a20 0%,#2e9e3f 50%,#f2c200 100%)', contorno: '#0a4a20', precoFundo: '#ffe14d', precoCor: '#0f6b2f', precoSombra: '#0a4a20', faixa: '#0f6b2f', faixaTexto: '#ffffff', corTitulo: '#ffffff', corDestaque: '#ffe14d' },
  azul: { fundo: 'linear-gradient(160deg,#06245a 0%,#1565d8 50%,#38b6ff 100%)', contorno: '#06245a', precoFundo: '#ffc928', precoCor: '#0a3d91', precoSombra: '#06245a', faixa: '#ffc928', faixaTexto: '#06245a', corTitulo: '#ffffff', corDestaque: '#ffc928' },
  rosa: { fundo: 'linear-gradient(160deg,#5c0636 0%,#e5157a 55%,#ffb703 100%)', contorno: '#5c0636', precoFundo: '#ffe14d', precoCor: '#c2185b', precoSombra: '#5c0636', faixa: '#ffe14d', faixaTexto: '#5c0636', corTitulo: '#ffffff', corDestaque: '#ffe14d' },
  chocolate: { fundo: 'linear-gradient(160deg,#2b0f05 0%,#7a2e0e 50%,#f2a93b 100%)', contorno: '#2b0f05', precoFundo: '#ffd84d', precoCor: '#7a2e0e', precoSombra: '#2b0f05', faixa: '#ffd84d', faixaTexto: '#2b0f05', corTitulo: '#fff6d6', corDestaque: '#ffd84d' },
}

// Faixa horizontal (px no Feed 1080) ocupada pela arte do título em cada template:
// logo, chamada, validade e endereço vão na coluna do outro lado, como nos templates.
const ARTE_X = {
  'acougue': [440, 1000],
  'hortifruti-nota10': [450, 1080],
  'fecha-mes': [415, 1070],
  'fim-de-semana': [20, 600],
  'ofertao': [455, 1020],
  'explosao': [0, 610],
  'ofertas-nota10': [0, 560],
  'rasga-preco': [0, 630],
  'deu-a-louca': [0, 615],
  'segunda-fire': [450, 1080],
  'ofertas-hortifruti': [0, 700],
  'fecha-mes-azul': [0, 635],
  'sexta-fire': [0, 615],
  'semana-maluca': [0, 660],
  'fim-de-mes': [0, 700],
  'nota10-verde': [320, 1080],
  'acougue-fds': [400, 1060],
  'pascoa': [360, 1080],
  'hortifruti': [470, 1060],
  'so-aqui': [440, 1070],
  'economia-verdade': [0, 645],
  'fire': [0, 500],
  'abril': [505, 1080],
}

const t = (id, nome, grupo, paleta, logo, titulo, destaque, chamada) => ({
  id, nome, grupo, arte: id, arteX: ARTE_X[id], logo, titulo, destaque, chamada, ...P[paleta],
})

export const GRUPOS_TEMA = ['Açougue', 'Hortifruti', 'Semana', 'Fim de semana', 'Fim de mês', 'Datas', 'Geral']

export const TEMAS_CAMPANHA = [
  t('acougue', 'Açougue Nota 10', 'Açougue', 'vermelho', 'e', 'Açougue', 'Nota 10', 'Carnes selecionadas'),
  t('acougue-fds', 'Final de Semana do Açougue', 'Açougue', 'vermelho', 'e', 'Açougue', 'Nota 10', 'Cortes mais que especiais'),
  t('hortifruti', 'Hortifruti Imbatível', 'Hortifruti', 'verde', 'e', 'Hortifruti', 'Imbatível', 'Hoje é dia de feira!'),
  t('hortifruti-nota10', 'Hortifruti Nota 10', 'Hortifruti', 'verde', 'e', 'Hortifruti', 'Nota 10', 'Direto do campo'),
  t('ofertas-hortifruti', 'Ofertas do Hortifruti', 'Hortifruti', 'verde', 'd', 'Ofertas do', 'Hortifruti', 'Sabor e saúde com economia'),
  t('ofertao', 'Ofertão da Semana', 'Semana', 'azul', 'e', 'Ofertão', 'da Semana', 'Preço baixo todo dia!'),
  t('semana-maluca', 'Semana Maluca', 'Semana', 'rosa', 'd', 'Semana', 'Maluca', 'Abaixou tudo!'),
  t('segunda-fire', 'Segunda Fire', 'Semana', 'laranja', 'e', 'Segunda', 'Fire!', 'Comece a semana economizando!'),
  t('sexta-fire', 'Sexta Fire', 'Semana', 'vermelho', 'd', 'Sexta', 'Fire!', 'Qualidade e preço baixo!'),
  t('fim-de-semana', 'FDS com Economia', 'Fim de semana', 'dourado', 'd', 'FDS', 'com Economia', 'Para encher a despensa!'),
  t('fecha-mes', 'Fecha Mês', 'Fim de mês', 'dourado', 'e', 'Fecha', 'Mês', 'Descontos imperdíveis'),
  t('fecha-mes-azul', 'Fecha Mês Azul', 'Fim de mês', 'azul', 'd', 'Fecha', 'Mês', 'Fechando o mês com chave de ouro!'),
  t('fim-de-mes', 'Fim de Mês com Economia', 'Fim de mês', 'vermelho', 'd', 'Fim de Mês', 'com Economia', 'Ainda dá tempo de economizar!'),
  t('pascoa', 'Ofertas de Páscoa', 'Datas', 'chocolate', 'e', 'Ofertas de', 'Páscoa', 'Sua Páscoa ainda mais doce'),
  t('abril', 'Abril da Economia', 'Datas', 'vermelho', 'e', 'Abril da', 'Economia', 'Um mês mais que especial!'),
  t('explosao', 'Explosão de Ofertas', 'Geral', 'vermelho', 'd', 'Explosão de', 'Ofertas!', 'Os preços explodiram!'),
  t('ofertas-nota10', 'Ofertas Nota 10', 'Geral', 'vermelho', 'd', 'Ofertas', 'Nota 10!', 'Os descontos mais esperados'),
  t('nota10-verde', 'Ofertas Nota 10 Verde', 'Geral', 'verde', 'e', 'Ofertas', 'Nota 10!', 'Aqui você economiza de verdade!'),
  t('rasga-preco', 'Rasga Preço', 'Geral', 'vermelho', 'd', 'Rasga', 'Preço!', 'Seu mercado ainda mais barato!'),
  t('deu-a-louca', 'Deu a Louca no Patrão', 'Geral', 'azul', 'd', 'Deu a louca', 'no Patrão!', 'Corre que abaixou tudo!'),
  t('fire', 'Ofertas Fire', 'Geral', 'laranja', 'd', 'Ofertas', 'Fire!', 'Tá barato!'),
  t('so-aqui', 'Só Aqui Tem Economia', 'Geral', 'azul', 'e', 'Só aqui tem', 'Economia', 'Preço baixo de verdade'),
  t('economia-verdade', 'Economia de Verdade', 'Geral', 'laranja', 'd', 'Economia', 'de Verdade', 'Descontos nunca vistos!'),
  {
    id: 'mercado', nome: 'Cores do mercado', grupo: 'Geral', titulo: 'Ofertas', destaque: 'da Semana', chamada: 'Economia de verdade!',
    fundo: 'linear-gradient(160deg,#082b4f 0%,#123f6b 60%,#e4232e 100%)', corTitulo: '#ffffff', corDestaque: '#ffc928', contorno: '#041a30',
    precoFundo: '#ffc928', precoCor: '#bf1721', precoSombra: '#e4232e', faixa: '#e4232e', faixaTexto: '#ffffff',
  },
]

export const temaCampanhaById = (id) => TEMAS_CAMPANHA.find((tema) => tema.id === id) || TEMAS_CAMPANHA[TEMAS_CAMPANHA.length - 1]
