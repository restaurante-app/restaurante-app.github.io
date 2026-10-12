# Plano para 13/10/2026

Tudo o que foi combinado em 12/10, na ordem em que vai ser feito. Sai numa versão só
(**v1.10.0**, `sw.js` → `pari-v31`), publicada no `main` só depois de testada.

| # | O quê | Quem vê | Mexe no que já existe? |
|---|---|---|---|
| 1 | Decimais no celular | todos | sim, só a correção |
| 2 | Dia: tocar num dia e ver tudo dele | só o dono | não, tela nova |
| 3 | Período, com comparação | só o dono | não, tela nova |
| 4 | Rendimento por lote (carnes e peixes) | só o dono | não, tela e lógica novas, só leem os dados |

Fica **fora**: mandar resumo pelo WhatsApp (o dono disse que não precisa).

---

## 1. Decimais no celular (primeiro)

**O que se sabe:** acontece **só no celular**. Pelo código não apareceu o motivo: o teclado
numérico é do próprio app (`P.UI.numpad`, `js/ui.js`), com a tecla `,`, e não usa o teclado do
celular.

**Para fazer:**
1. Abrir o app no Chromium em tamanho de celular (Playwright, 360×740 e 390×844, com toque).
2. Lançar uma compra e digitar com vírgula nos quatro campos: quantidade (`1,79` kg), preço
   por kg (`44,90`), total pago (`80,37`) e valor pago das partes (`R$ 120,50`).
3. Repetir onde mais se digita número com vírgula: despesa, pagamento em partes, fiado, gás,
   ficha técnica (gramas).
4. Suspeitas a conferir primeiro:
   - a tecla `,` fica escondida ou fora da tela em celular pequeno (grade do `.numpad`, folha
     `sheet-np` alta demais);
   - o toque duplo na `,` dá zoom em vez de digitar (falta `touch-action: manipulation`);
   - campo que pede número com `decimais: 0` onde devia aceitar vírgula (ex.: `stepper` com
     `pedir`, quantidade na comanda);
   - o limite de casas (`decimais: 3` na quantidade, 2 no valor) apagando o que foi digitado.
5. Corrigir só o que travar, sem mudar o jeito de lançar.

**Ajuda do dono (se puder):** dizer em qual campo trava, ou mandar um print da tela na hora em
que não aceitar a vírgula. Se não reproduzir no teste, a correção fica para quando houver o print.

---

## 2. Dia — tocar num dia e ver tudo dele (só o dono)

**Onde:** tela nova `#/dia` (arquivo novo `js/dia.js`). Abre por um calendário do mês: cada dia
mostra o total vendido; tocar abre o dia. Mais → grupo Dono ganha o atalho **Dia e período**.
O atalho "Calendário" de hoje (compras e despesas do dia) continua igual para a equipe.

**O que aparece no dia** (tudo lido do que já está lançado, com `P.Relatorio.montar([dia])`):

| Bloco | Conteúdo |
|---|---|
| Vendas | total, nº de contas, ticket médio, por canal (salão, marmita) e por forma de pagamento |
| Pratos e bebidas | quantidade e valor de **cada** prato e de **cada** bebida, separados |
| Compras | cada compra (fornecedor, forma, total) com **os itens** (quantidade, unidade, preço, valor) |
| Despesas | cada despesa com categoria e valor |
| Equipe | pagamentos do dia (vale, condução, salário, semana, pró-labore) por pessoa |
| Caixa | entrou, saiu e saldo do dia |
| Fiado | fiado dado no dia e fiado recebido no dia |
| Gás | botijão em uso (há quantos dias), botijão ligado ou que acabou neste dia |

Setas para o dia anterior e o seguinte, como nas outras telas. Funciona no celular.

---

## 3. Período, com comparação (só o dono)

**Onde:** mesma tela, aba **Período** (`#/dia/periodo`).

- Escolher **de um dia até outro** (atalhos: esta semana, semana passada, este mês, mês passado).
- Mostra os mesmos blocos do Dia, somados: vendas, quantidades de cada prato e bebida, compras
  (por item), despesas, equipe, caixa (entrou, saiu, saldo), fiado e gás.
- **Comparar (opcional):** o dono escolhe um **segundo período qualquer** ("esta semana × semana
  passada", "outubro × setembro"). Os dois ficam lado a lado, com a **diferença em R$ e em %**
  para vendas, quantidades, compras, despesas e saldo. No celular, as colunas viram linhas
  (valor 1, valor 2, diferença).
- Exportar planilha (CSV) do período, como já existe no Relatório.

---

## 4. Rendimento por lote de carnes e peixes (só o dono)

Não mexe em vendas, compras, caixa nem relatórios. É uma tela e uma lógica a mais, que só leem
o que já está lançado. Arquivo novo `js/rendimento.js`, rota `#/rendimento`, atalho em Mais →
Gestão.

### 4.1 Dados novos

- Tabela nova **`lotes`** (no `schema.sql`, no `js/db.js` com `DB_VERSION = 4`, e no `importar`):
  `id, carne, dia (compra), fornecedor, kg, valor, rs_kg, compra_id, compra_item_id,
  fim (dia em que acabou), sobra_kg, sobra_dia, pratos_base, venda_base, conta_desde, obs,
  criado_em, usuario_id`.
  - `pratos_base` / `venda_base` / `conta_desde`: para os lotes importados como estão (até 08/10);
    a contagem sozinha soma a partir de `conta_desde` (09/10).
- Configuração **`rendimento`** (tabela `config`, já sincroniza):
  - carnes e as palavras do nome da compra que batem com cada uma;
  - **qual prato usa qual carne** (editável);
  - **meta de gramas por prato** (editável);
  - **pratos movidos de lote**: `{ dia, item_id, lote_id }` (ex.: panquecas de 08/10 → lote
    antigo de frango).

**Rodar o `schema.sql` de novo no Supabase** depois de publicar (tabela nova `lotes`). Sem isso
nada se perde: os lotes ficam no aparelho até o SQL ser rodado.

### 4.2 Quais itens viram lote

Só a carne principal: contra filé, capa de filé, costela, rabada, filé de frango/peito, coxa de
frango, galinha, filé de tilápia, posta de tilápia, carne seca/jabá, bisteca, fígado, bucho
(dobradinha), costelinha, bacalhau.

**Não** viram lote: calabresa, bacon, linguiça, costela salgada, charque, pé e rabo de porco,
e tudo o que vai em feijão, feijoada ou baião. Cuidado nas palavras: "costela" não pode pegar
"costelinha" nem "costela salgada"; "carne seca" não pega "charque".

**Ao salvar uma compra** com um item que bate com uma carne (sem mudar a compra em nada):
1. "Abrir um lote novo de [carne]? 7,85 kg · R$ 439,60 · R$ 56,00/kg" → Sim / Não.
2. Se já houver lote aberto dessa carne: "O lote anterior de [carne] acabou?" → Sim fecha na data
   de hoje; Não deixa os dois abertos (as vendas continuam no mais antigo).

### 4.3 Qual prato usa qual carne (tabela editável)

| Prato | Carne |
|---|---|
| Contra filé, contra filé com ovo, contra filé acebolado, contra filé à parmegiana / parmegiana de carne | contra filé |
| Picadinho, bife de panela | capa de filé |
| Filé de frango, filé de frango à parmegiana / parmegiana de frango, panqueca (1 e 2 no prato) | filé de frango |
| Frango assado, frango com creme | coxa de frango |
| Galinha com baião | galinha |
| Rabada (normal e porção grande) | rabada |
| Costela | costela |
| Jabá, carne seca | carne seca |
| Filé de tilápia / filé de peixe | filé de tilápia |
| Posta de tilápia | posta de tilápia |
| Fígado | fígado |
| Dobradinha | bucho |
| Bisteca | bisteca |
| Costelinha | costelinha |
| Bacalhau | bacalhau |

Prato fora da tabela (feijoada, virado, calabresa, omelete) não conta em lote nenhum.
**Perguntar ao dono:** "Porção de peixe pequena" entra no filé de tilápia ou fica fora?

Contagem: cada linha de prato da conta conta a quantidade dela ("3 rabadas" = 3 pratos). Pedido
com vários pratos ("contra 40 + jabá 40 + filé de frango 25") conta 1 em cada lote.
Venda dos pratos = preço do prato × quantidade (só a comida, sem bebida, sem rateio de desconto).

### 4.4 Em qual lote cada venda entra

- A venda entra no lote **aberto mais antigo** daquela carne no dia da venda.
- Comprar de novo **não** fecha o anterior (só fecha se o dono disser que acabou).
- **Mover pratos de um dia** de um lote para outro: no lote, lista dos dias com os pratos;
  tocar no dia → "Mover para o lote de [data]".

### 4.5 Botão "Acabou" e as contas

Fecha o lote na data de hoje (dá para trocar a data) e calcula:

- Pratos = total de pratos do lote
- Venda dos pratos = soma do valor só da comida desses pratos
- Gramas por prato = kg × 1000 ÷ pratos
- Carne por prato = valor do lote ÷ pratos
- Carne / venda (%) = valor do lote ÷ venda dos pratos
- Sobra depois da carne = venda dos pratos − valor do lote

Campo opcional **"peso que sobrou (kg)"**: no lote aberto, mostra a estimativa de pratos que ainda
faltam = sobra × 1000 ÷ gramas por prato até agora.

### 4.6 Tela "Rendimento"

- **Abertos:** carne, data, kg, valor, pratos até agora, venda até agora e **"já se pagou?"**
  (venda − valor; verde quando passar de zero). Botões "Acabou" e "Peso que sobrou".
- **Fechados:** todas as métricas do 4.5.
- **Cor pela carne / venda:** até 35% verde, de 35% a 45% amarelo, acima de 45% vermelho.
- **Meta de gramas por prato** (editável): contra filé 250, rabada 400, costela 500, capa de filé
  200, filé de frango 200, coxa 400, galinha 400, filé de tilápia 200, posta 250, carne seca 150,
  fígado 200. Aviso quando o lote passar da meta. (Sem meta ainda: bisteca, bucho, costelinha,
  bacalhau — o dono preenche quando quiser.)
- **Comparar lotes da mesma carne:** fornecedor, R$/kg, gramas por prato e carne / venda.
- **Configuração:** tabela prato → carne, palavras de cada carne e metas.
- Funciona no celular (cartões um embaixo do outro).

### 4.7 Dados que já existem (importar como estão)

Por um pacote do Importar (`lotes: [...]`), com conferência antes de lançar.

**Fechados:**

| Carne | Dia | Fornecedor | kg | Valor | Pratos | Venda |
|---|---|---|---|---|---|---|
| Rabada | 07/10 | Açougue Antigo | 8,34 | R$ 333,52 | 14 | R$ 495 |
| Costela | 02/10 | diverso | 20,935 | R$ 479,41 | 33 | R$ 1.132 |
| Frango (filé) | 01/10 | Açougue Antigo | 6,436 | R$ 160,84 | 22 (inclui 6 panquecas de 08/10) | R$ 666 |

**Abertos** (a partir de 09/10 as vendas entram sozinhas):

| Carne | Dia | Fornecedor | kg | Valor | Pratos até 08/10 |
|---|---|---|---|---|---|
| Contra filé | 01/10 | — | 27,34 | R$ 1.227,57 | 45 (inclui 6 parmegianas de carne) |
| Coxa de frango | 05/10 | — | 10,58 | R$ 126,85 | 27 (14 em 05/10, 13 em 06/10) |
| Filé de peito | 08/10 | — | 15 | R$ 235,20 | 12 em 08/10 (7 filés + 5 parmegianas) |
| Capa de filé | 08/10 | — | 27,07 | R$ 771,50 | 0 |
| Filé de tilápia | 08/10 | Peixeiro | 7,85 | R$ 439,60 | 0 |
| Posta de tilápia | 08/10 | Peixeiro | 10,70 | R$ 224,70 | 0 |

A venda até 08/10 dos lotes abertos não veio na lista: sai das vendas já lançadas no app para
esses pratos; se a contagem do app não bater com os pratos acima, vale o número do dono e a
diferença aparece como aviso.

### 4.8 Teste antes de terminar

| Lote | Pratos | g/prato | Carne/prato | Carne/venda | Sobra |
|---|---|---|---|---|---|
| Rabada 07/10 | **14** | **~596 g** | **R$ 23,82** | **67%** (vermelho; meta 400 g passou) | R$ 161,48 |
| Costela 02/10 | 33 | ~634 g | R$ 14,53 | 42% (amarelo) | R$ 652,59 |
| Frango 01/10 | 22 | ~293 g | R$ 7,31 | 24% (verde) | R$ 505,16 |

Também testar: venda nova de 09/10 entra no lote aberto mais antigo; compra nova de contra filé
pergunta "acabou?" e, com "não", as vendas seguem no lote de 01/10; mover as panquecas de um dia
de lote; "peso que sobrou" mostra os pratos que faltam; tela no celular (360 px).

---

## Ordem do dia e entrega

1. Decimais (teste em tela de celular, correção).
2. `js/dia.js`: Dia e Período com comparação.
3. `js/rendimento.js` + tabela `lotes` + pergunta ao salvar compra + importar os lotes.
4. Testes (números do 4.8, celular), `sw.js` → `pari-v31`, `P.VERSAO = '1.10.0'`, `index.html`
   e lista do `sw.js` com os arquivos novos, LEIAME e PROXIMOS-PASSOS atualizados.
5. Publicar. **Depois:** rodar o `schema.sql` no Supabase (tabela `lotes`) e importar o pacote dos
   lotes em Mais → Importar.
