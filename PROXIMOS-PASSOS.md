# Próximos passos — situação em 19/10/2026

## Situação

| O quê | Onde | Estado |
|---|---|---|
| App v1.15 (Painel: semana do calendário e mês inteiro; espeto desligado por enquanto) | branch `claude/stoic-bardeen-kpp2gw` | **em revisão** (não muda o `schema.sql`) |
| App v1.14 (busca nos lotes de carne, excluir compra e excluir venda, Lixeira para restaurar) | `main` | **publicado** (não muda o `schema.sql`) |
| App v1.13 (Fechar caixa: dinheiro da gaveta, Pix e maquininha conferidos com as vendas, o fiado recebido e o que saiu) | `main` → https://restaurante-app.github.io/ | **publicado** (não muda o `schema.sql`: fica na tabela `config`) |
| App v1.12 (Folha da cozinha: pratos do dia e fixos com o que leva, imprimir em A4; criar insumo na hora de lançar a compra) | `main` | **publicado** (não muda o `schema.sql`) |
| App v1.11 (visual da marca Maria Simone, navegação com voltar no topo, Mais em listas com busca, Fichas fora da barra de baixo) | branch `claude/tool-navigation-design-yjz1he` | **em revisão** (não muda dados nem o `schema.sql`) |
| App v1.10 (decimais no celular, Dia e período, Rendimento por lote) | `main` | **publicado** (rodar o `schema.sql` — tabela nova `lotes`) |
| App v1.10.1 (Importar com lotes de carne; frango ao molho conta na coxa) | `main` | **publicado** |
| Lançamentos de 09/10 a 12/10 (sexta, sábado, retirada de domingo e segunda), com lotes de costela e coxa e Belo Boi = Açougue Antigo | pacote `.json` no computador do dono (fora do Git) | **esperando importar** (precisa da v1.10.1) |
| App v1.8 (cardápio do dia, controle do gás) sobre a v1.7 (equipe, pendências, capital e caixa, importar lançamentos, cartão de crédito, pagamento em partes, pró-labore, investimento, custo estimado de prato sem ficha) | `main` → https://restaurante-app.github.io/ | **publicado** |
| Nuvem (Supabase) | projeto `restaurante` | **rodar o `schema.sql` de novo** (tabela nova `botijoes`) |
| Relatório de 28/09 a 05/10 | pacote `.json` no computador do dono (fora do Git) | **importado** |
| Lançamentos de 05/10 | pacote `.json` no computador do dono (fora do Git) | **importado** |
| Lançamentos de 05/10 (restante) e 06/10, com o cardápio de segunda e terça | pacote `.json` no computador do dono (fora do Git) | **importado** |
| Lançamentos de 07/10 (com bebidas de 02/10, correções de fornecedor e do gás, cardápio de quarta) | pacote `.json` no computador do dono (fora do Git) | **esperando importar** (precisa da v1.9.1) |

Ordem: 1) rodar o `schema.sql` no Supabase, se ainda não rodou depois da v1.8 (no aviso
"Potential issues detected", escolher **Run without RLS** — o arquivo já liga o RLS); 2) abrir o
app no computador e conferir que o rodapé de Mais mostra **v1.8.1**; 3) Mais → Importar
lançamentos → arquivo de 06/10 → conferir → Lançar; 4) montar a quarta em Mais → Cardápio do dia
e resolver as pendências.

Sem o passo 1 nada se perde: os botijões ficam no aparelho até o SQL ser rodado.

## O que entrou na v1.15 (pedido de 19/10)

| Pedido | No app |
|---|---|
| Por que trocar o dia muda a semana? Mudar para a semana do calendário | Painel: a semana agora é de segunda a sábado do dia escolhido ("12 a 17/10 · 3/6 dias"); o mês é o mês inteiro até hoje. Trocar o dia nas setas não muda mais a semana nem o mês, só o card do dia |
| Tirar tudo do espeto por enquanto, sem afetar o resto | chave **Turno do espeto** (Ajustes → Salão e turnos), desligada: espetos, combo com espeto e acompanhamento do espeto saem da comanda, do cardápio, das fichas, da análise, do painel e de Ajustes; comanda nova não vira "Espeto" pelo horário. Nada é apagado; venda antiga no canal Espeto continua contando. Ligar a chave traz tudo de volta |

## O que entrou na v1.14 (pedido de 19/10)

| Pedido | No app |
|---|---|
| Busca nos lotes de carne | Rendimento → Lotes: busca no topo por carne, fornecedor, dia ou valor, nos lotes abertos e fechados |
| Excluir compras | detalhe da compra → **Excluir compra** (dono): sai do gasto e do caixa, junto com o lote de carne aberto por ela; Desfazer no aviso |
| Excluir vendas | Mesas → Fechadas → toque na conta → **Excluir venda** (dono): sai das vendas, do caixa, do fiado e dos lotes; Desfazer no aviso |
| Cuidado para não apagar as coisas | tudo pergunta antes de excluir; a lista de Fechadas não tem lixeira; **Mais → Lixeira** (dono) guarda por 90 dias tudo o que foi excluído (vendas, compras, despesas, lotes) com **Restaurar** |

## O que entrou na v1.13 (pedido de 17/10)

| Pedido | No app |
|---|---|
| Fechar caixa: informar o total de dinheiro, Pix e cartão do dia e ver se bateu com os recebimentos, as entradas e as saídas | Mesas → **Fechar caixa** (e Mais): dinheiro contado na gaveta × troco do início + recebido em dinheiro − pago em dinheiro; Pix que entrou × vendas e fiado no Pix; maquininha × débito + crédito. Bateu / sobrou / faltou em cada um e no total, aviso de conta aberta e de despesa sem forma, fechamento guardado com quem fechou e a hora |

## O que entrou na v1.12 (pedido de 16/10)

| Pedido | No app |
|---|---|
| Criar rápido o cardápio que fica impresso na cozinha (muda de vez em quando) | Mais → **Folha da cozinha**: pratos do dia de cada dia da semana e fixos da chapa, cada um com o que leva (guardado no prato); adicionar buscando ou escrevendo, trazer do Cardápio do dia, copiar de outro dia, subir e tirar com Desfazer |
| Imprimir para deixar na cozinha | botão **Imprimir**: folha A4 no visual aprovado (faixa Maria Simone, creme, cartões), com a data ou só o dia da semana; a letra encolhe sozinha quando há muito prato |
| Criar itens na hora de lançar a compra, como na marmita | Lançar compra → *Adicionar item*: busca pelo nome; o que não existe vira **Criar o insumo "…"** (unidade e preço desta compra, entra nas fichas) ou **"…" sem ficha**; no item da nota "ligar à ficha" também dá para criar o insumo com o nome da nota |

Já vem com a folha de sexta (baião completo, jabá com mandioca frita, filé e posta de tilápia; fixos: contra
filé, calabresa acebolada, filé de frango e omelete). As fontes da folha (Bagel Fat One e Atkinson Hyperlegible)
são baixadas na primeira vez que a tela abre com internet e ficam guardadas no aparelho.

## O que entrou na v1.11 (pedido de 15/10)

| Pedido | No app |
|---|---|
| Navegação travada, difícil de entender | botão **voltar** no topo das telas de dentro (volta para onde você estava); abas de cima trocam sem empilhar; troca de tela em 0,2 s, da direita ao avançar e da esquerda ao voltar; tirados o desfoque e a textura por cima da tela, que pesavam na rolagem do celular |
| Layout cru | Mais em listas por grupo com busca; cartões, botões, abas e folhas redesenhados; títulos e números grandes na fonte condensada da marca |
| Cores e logo da marca | vermelho `#B23A43` e creme `#F6EFDF` do logo; tela do PIN vermelha com o logo; selo (a baiana do "O") no topo; ícone do app com o selo redondo; tema claro (creme) por padrão e escuro (vinho) em Mais → Tema |
| Tirar Fichas dos atalhos fixos de baixo | barra do dono: Painel · Mesas · Compras · Mais; Fichas técnicas em Mais → Gestão |

## O que entrou na v1.10

| Pedido | No app |
|---|---|
| Decimais no celular | na folha de quantidade e preço da compra, a vírgula agora aparece na hora ("1," · "44,0"); antes o número mostrado não mudava e parecia travado. O teclado do celular fecha quando o teclado de números do app abre |
| Tocar num dia e ver tudo dele (só o dono) | Mais → Dia e período → Dia: calendário com o vendido; vendas, cada prato e bebida, compras com itens, despesas, equipe, caixa, fiado e gás |
| Período com comparação (só o dono) | Mais → Dia e período → Período: de um dia até outro e, se quiser, um segundo período lado a lado (diferença em R$ e %); planilha CSV |
| Rendimento por lote | Mais → Rendimento: lotes de carne e peixe, pergunta ao salvar a compra, "Acabou", peso que sobrou, metas, comparar lotes, ajustes; lotes de 01 a 08/10 já dentro |

Depois de publicar: rodar o `schema.sql` no Supabase (tabela `lotes`). Sem isso nada se perde: os
lotes ficam no aparelho até o SQL ser rodado. Os lotes importados entram sozinhos em cada aparelho
(ids fixos, não duplicam). Se a venda até 08/10 de contra filé, coxa ou filé de peito não estiver
no app, o lote mostra um aviso e a venda fica sem ela.

## O que entrou na v1.8

| Pedido | No app |
|---|---|
| Controle do gás, anotando o dia, para ter a média | Mais → Gás: botijão em uso (dia em que foi ligado), "Acabou o gás" (fecha e registra o novo, lança a despesa), média de dias e de dias com venda, custo por dia aberto e por mês, previsão e aviso no Painel |
| Cardápio de cada dia | Mais → Cardápio do dia: pratos de segunda a sábado; na comanda, os do dia primeiro e os outros em "Outros pratos"; copiar ou mandar no WhatsApp |
| Lançamentos de 05/10 | pacote (fora do Git) com as vendas de segunda, as compras do dia e o estoque inicial, a equipe, pratos novos, o botijão e o cardápio da semana |

Cardápio montado pelo que saiu: segunda (05/10), terça (06/10), quinta (01/10), sexta (02/10) e
sábado (03/10). Quarta ainda sem cardápio (aparecem todos os pratos).

## Plano — funções que ainda faltam

1. **Contagem de estoque** (bebidas por unidade, carnes e secos por kg): custo do vendido de
   verdade = estoque inicial + compras − estoque final. O estoque inicial pago em 05/10 já está
   nas compras; falta a contagem.
2. **Fichas dos pratos do cardápio novo** (virado à paulista, feijoada, frango com creme,
   costela, calabresa, tilápia, bacalhau, rabada…): enquanto não houver, usar o custo estimado por
   prato (Fichas → Cadastro) ou o % geral.
3. **Clientes** (rota da marmita): as contas já têm o nome do cliente; falta a tela de clientes
   (quem compra, frequência, última compra, sumidos há mais de 5 dias, fiado).
4. **Corrigir a forma de pagamento de um dia em lote** (o Pix de 03/10 e de 05/10 não foi
   informado), sem reabrir conta por conta.
5. **Grupo das compras** (bebida para revenda, carnes, hortifruti, mercearia, embalagem,
   limpeza, utensílios) para ver o gasto do mês por grupo.
6. **Lembretes de vencimento** no Painel: fatura do cartão, fornecedores, salário, semana da
   entregadora.
7. **Custos fixos base** (Ajustes) com a equipe de hoje e a
   **reserva do passivo trabalhista** (custo previsto por mês, fora do caixa).
8. **Espetos** (etapa 3) e **Bebidas** (etapa 4) quando abrir o turno da madrugada; o controle do
   gás pode ganhar o carvão.

## Como testar localmente

`.claude/launch.json` sobe um servidor PowerShell na porta 5611 (preview `restaurante-pari`).
Em localhost o service worker e a **nuvem** ficam desligados (`localStorage.setItem('pari.nuvemLocal','1')`
liga a nuvem; `localStorage.setItem('pari.sw','1')` liga o service worker).
Publicar: subir `CACHE` em `sw.js` + `git push` no `main` (GitHub Pages publica em ~1 min).
