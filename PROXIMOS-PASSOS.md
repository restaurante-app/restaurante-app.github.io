# Próximos passos — situação em 07/10/2026

## Situação

| O quê | Onde | Estado |
|---|---|---|
| App v1.8 (cardápio do dia, controle do gás) sobre a v1.7 (equipe, pendências, capital e caixa, importar lançamentos, cartão de crédito, pagamento em partes, pró-labore, investimento, custo estimado de prato sem ficha) | `main` → https://restaurante-app.github.io/ | **publicado** |
| Nuvem (Supabase) | projeto `restaurante` | **rodar o `schema.sql` de novo** (tabela nova `botijoes`) |
| Relatório de 28/09 a 05/10 | pacote `.json` no computador do dono (fora do Git) | **importado** |
| Lançamentos de 05/10 | pacote `.json` no computador do dono (fora do Git) | **importado** |
| Lançamentos de 05/10 (restante) e 06/10, com o cardápio de segunda e terça | pacote `.json` no computador do dono (fora do Git) | **esperando importar** (precisa da v1.8.1) |

Ordem: 1) rodar o `schema.sql` no Supabase, se ainda não rodou depois da v1.8 (no aviso
"Potential issues detected", escolher **Run without RLS** — o arquivo já liga o RLS); 2) abrir o
app no computador e conferir que o rodapé de Mais mostra **v1.8.1**; 3) Mais → Importar
lançamentos → arquivo de 06/10 → conferir → Lançar; 4) montar a quarta em Mais → Cardápio do dia
e resolver as pendências.

Sem o passo 1 nada se perde: os botijões ficam no aparelho até o SQL ser rodado.

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
