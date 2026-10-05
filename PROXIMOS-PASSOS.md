# Próximos passos — situação em 05/10/2026

## Situação

| O quê | Onde | Estado |
|---|---|---|
| App v1.7 (equipe, pendências, capital e caixa, importar lançamentos, cartão de crédito com fatura, pagamento em partes, pró-labore, investimento, custo estimado de prato sem ficha) | `main` → https://restaurante-app.github.io/ | **publicado** |
| Nuvem (Supabase) | projeto `restaurante` | **precisa rodar o `schema.sql` de novo** (colunas e tabelas novas) |
| Lançamentos do relatório de 28/09 a 05/10 | arquivo `.json` no computador do dono (fora do Git: tem dados do restaurante) | **esperando importar** (Mais → Importar lançamentos) |

Ordem: 1) rodar o `schema.sql` no Supabase; 2) abrir o app no computador (ele se atualiza
sozinho); 3) Mais → Importar lançamentos → escolher o arquivo → conferir → Lançar;
4) resolver as pendências (Mais → Pendências).

Sem o passo 1 nada se perde: o que a nuvem ainda não aceita fica no aparelho até o SQL ser rodado.

## O que entrou na v1.7 (onde cada coisa do relatório foi parar)

| Do relatório | No app |
|---|---|
| Compras por data e fornecedor, com itens | Compras (cada linha ligada ao insumo quando dá; o preço dos insumos segue as compras) |
| Contas a prazo e pagas depois | Compras → A pagar (vencimento; pagar escolhendo o dia) |
| Cartão de crédito com fatura | Compra no **Crédito** (fatura com vencimento) e pagamento **dividido** |
| Vendas por cliente (entregas e mesa) | Contas fechadas "lançadas depois" (sem horário), canal Marmita/Salão, Pix/dinheiro/fiado |
| Dia sem detalhe (só totais) | Conta-resumo do dia (itens "Marmita (prato não anotado)" e "Venda do dia sem detalhe", inativos) |
| Fiado | Mesas → Fiado |
| Preços praticados | Cardápio (pratos e bebidas novos; preços atualizados); pratos do plano antigo desativados |
| Equipe (salário, vales, condução, semana) | Mais → Equipe + despesas de Funcionários com pessoa e tipo |
| Retiradas do pró-labore | Despesa **Pró-labore (retirada)** + Equipe (quanto ainda pode retirar) |
| Gás, despesas diversas | Despesas |
| Investimento (montagem) | Despesa **Investimento** (fora do lucro) |
| Caixa desde a abertura / capital antes da abertura | Mais → Capital e caixa (data de abertura em Ajustes) |
| Pendências e observações | Mais → Pendências |

## Plano — funções que ainda faltam

1. **Contagem de estoque** (bebidas por unidade, carnes e secos por kg): custo do vendido de
   verdade = estoque inicial + compras − estoque final. Hoje boa parte das compras é estoque e o
   "food cost real" da semana fica distorcido.
2. **Fichas dos pratos do cardápio novo** (feijoada, tilápia, bacalhau, costela, rabada…):
   enquanto não houver, usar o custo estimado por prato (Fichas → Cadastro) ou o % geral.
3. **Clientes** (rota da marmita, etapa 5): as contas já têm o nome do cliente; falta a tela de
   clientes (quem compra, frequência, última compra, sumidos há mais de 5 dias, fiado).
4. **Corrigir a forma de pagamento de um dia em lote** (ex.: "R$ X das vendas de sábado foram
   Pix"), sem precisar reabrir conta por conta.
5. **Grupo das compras** (bebida para revenda, carnes, hortifruti, mercearia, embalagem,
   limpeza, utensílios) para ver o gasto do mês por grupo.
6. **Lembretes de vencimento** no Painel: fatura do cartão, fornecedores, salário, semana da
   entregadora.
7. **Gás**: data de troca e de fim de cada botijão (quanto dura, custo por dia).
8. **Custos fixos base** (Ajustes) com a equipe de hoje e a **reserva do passivo trabalhista**
   (custo previsto por mês, fora do caixa).
9. **Espetos** (etapa 3) e **Bebidas** (etapa 4) quando abrir o turno da madrugada.

## Como testar localmente

`.claude/launch.json` sobe um servidor PowerShell na porta 5611 (preview `restaurante-pari`).
Em localhost o service worker e a **nuvem** ficam desligados (`localStorage.setItem('pari.nuvemLocal','1')`
liga a nuvem; `localStorage.setItem('pari.sw','1')` liga o service worker).
Publicar: subir `CACHE` em `sw.js` + `git push` no `main` (GitHub Pages publica em ~1 min).
