# Pátio do Pari · Restaurante

App de gestão do restaurante: **mesas e comandas ao vivo**, **compras com lucro em
tempo real**, **contador de fluxo**, **fichas técnicas com preço vivo** e **painel do
dono**. Programa novo, independente do ERP da Agro Bras (não usa nada dele).

Navegação (barra de baixo) — dono: Painel · Mesas · Compras · Fichas · Mais.
Operador: Mesas · Compras · Fluxo · Mais. Em **Mais** fica tudo o resto, com um número
ao vivo em cada atalho (fiado, a pagar, despesas, preços desatualizados…).

- Funciona **offline**: tudo é gravado no celular na hora; sincroniza quando há rede.
- Tema escuro, botões grandes (mínimo 56 px), uso com uma mão.
- Dia operacional começa **às 03:00** (domingo conta como segunda).
- HTML + JavaScript puro, sem instalação. Para publicar é só subir a pasta.

## Acesso (PIN)

No primeiro uso o app pede para criar o **PIN do DONO** (4 dígitos).
Em **Ajustes → Pessoas e PINs** o dono cadastra os operadores.

| | Dono | Operador |
|---|---|---|
| Mesas, venda rápida, marmita, fechar conta, fiado, despesas, totais do dia | ✓ | ✓ |
| Lançar compras, marcar compra a prazo como paga | ✓ | ✓ |
| Resultado ao vivo, custos (comprado × usado), excluir compra | ✓ | — |
| Contador de fluxo (passou) | ✓ | ✓ |
| Atualizar preço de compra | ✓ | ✓ |
| Painel, relatório, análise do fluxo, fichas, simulação, cadastro | ✓ | — |
| Reabrir conta fechada | ✓ | — |

A sessão do dono trava sozinha depois de 10 minutos com o app em segundo plano.

## Módulos

**Mesas** — toque na mesa, digite o nome do cliente, e vá tocando nos itens conforme
saem. Cada item fica com o horário. O total é automático. Em *Fechar conta* escolha a
forma (Dinheiro, Pix, Débito, Crédito, Fiado); dá para dividir e calcular troco.
*Venda rápida* é para o balcão (sem mesa). *Marmita* abre comanda no canal marmita.
Abas: **Fechadas** (contas do dia), **Totais do dia** (automático: itens e valores
somados das comandas, nada é digitado), **Despesas** (gás, carvão, embalagem, limpeza),
**Fiado** (quem deve, com "Recebi em…").
Item tirado de uma comanda e conta cancelada ficam registrados com quem fez.
O dono vê no topo das Mesas: vendido hoje, em aberto nas mesas e o lucro do dia.

**Compras** — *Lançar compra*: de quem comprou, os itens (quantidade + preço por kg, ou
o total pago) e como pagou (Dinheiro, Pix, Cartão ou **A prazo**). Cada item de insumo
**atualiza o preço da ficha técnica** e o app mostra na hora o efeito nos pratos
("Filé de frango saiu de 37% para 39%"). Item sem ficha (gelo, sacola) entra só no gasto.
Ao editar uma compra antiga, o preço não passa por cima de uma compra mais nova.
**A pagar**: compras a prazo por fornecedor, com "Paguei em…".
**Resultado do dia ao vivo** (dono):

    resultado = vendas − custo do que foi vendido (fichas) − despesas − custo fixo do dia
    caixa     = recebido (sem fiado) − compras pagas − despesas

**Custos** (dono): por insumo, quanto foi comprado × quanto as vendas usaram pela ficha
(peso bruto, com fator de correção e perda). Sobra grande que se repete = desperdício,
porção maior que a ficha ou venda sem comanda. Mostra também os preços que mudaram.

**Fluxo** — só a passagem é contada à mão: botão +1 gigante para **PASSOU**, faixa de
hora automática, fecha sozinho na virada da hora, retoma se o app fechar.
**COMPROU é automático**: cada comanda com item conta como uma compra, na hora em que
foi aberta. A tela mostra a conversão (comprou ÷ passou) ao vivo. Análise (dono): média
por faixa, conversão, filtro por dia da semana, 3 maiores e 3 menores, exportar CSV.

**Fichas** — painel de margem (semáforo 35% / 40%), ficha detalhada, atualização de
preço um por vez ("Contra filé grelhado saiu de 38% para 42%"), simulação de porção e
preço, cadastro de insumos e itens (item pode conter outro item).

**Painel** — três cards (dia, semana, mês) que cabem na tela, atualizando ao vivo:
lucro ou prejuízo do dia com semáforo e caixa (entrou × saiu), prime cost, food cost
ficha × real (compras ÷ vendas), bebida junto por canal, projeção do mês e a escada de
espetos/dia. **Relatório detalhado**: resultado, caixa por forma de pagamento, compras
por insumo, por canal, por hora, o que foi vendido, contas, despesas, controle de
cancelamentos; exporta CSV (itens vendidos, contas, compras e gastos) e imprime.

## Dados iniciais

Os insumos, espetos, pratos e bebidas do documento já vêm cadastrados.
Conferência do CMV calculado × esperado: **28 de 29 batem no centavo**.
A diferença: *Espeto de frango com bacon* dá R$ 3,02 (esperado R$ 3,00) com
70 g de frango + 20 g de bacon.

Para bater os valores do documento foram **inferidos** (confira e ajuste em Fichas → Cadastro):

- Insumo **"Tempero, sal e gás/carvão"** R$ 0,20 por porção (base do PF, baião, espetos).
- Insumo **"Palito de espeto"** R$ 0,053 por unidade.
- Acompanhamento do espeto (R$ 0,51): farinha 22 g, tomate 20 g, cebola 12 g, maionese 8 g, óleo 1 g.
- Guarnição do dia (R$ 0,92): batata 150 g + óleo 9 g (referência de média).
- Extras de preparo: acebolados (cebola 40–45 g), passarinho (óleo 35 g, alho 1 g),
  milanesa/parmegiana (ovo, farinha 25 g, óleo 30 g; parmegiana + molho 90 g),
  picadinho e carne de panela (molho, cebola, alho), contra filé (alho 3 g, óleo 9 g).
- Suco natural: laranja 214 g (dá R$ 1,35).

Regra usada: item que entra dentro de outro (base do PF, baião, acompanhamento) entra
pelo custo sem perda; a perda operacional é aplicada uma vez, no item vendido.

## Sincronizar vários celulares (Supabase) — opcional

Sem configurar, tudo fica só no aparelho (a pílula no topo mostra "no aparelho").
Para o painel do dono enxergar o que a equipe registra em outros celulares:

1. Crie um **projeto novo** no Supabase (separado do ERP).
2. SQL Editor → cole e rode o arquivo `schema.sql`.
3. Authentication → Users → **Add user → Create new user**: e-mail e senha da nuvem,
   marcando **Auto Confirm User**. Essa senha é só sua; não vai para o código.
4. Authentication → Sign In / Providers → **desligue "Allow new users to sign up"**
   (ninguém mais consegue criar conta).
5. Project Settings → API → copie a URL e a chave pública (publishable/anon) e cole em
   `js/config.js`. Aumente a versão em `sw.js` e publique de novo.
6. Em cada aparelho, uma vez: **Conectar à nuvem** (no topo, em Mais → Nuvem ou em
   Ajustes) com o e-mail e a senha do passo 3. Aparelho novo: na tela do PIN, toque em
   "Já uso em outro aparelho — conectar à nuvem" **antes** de criar PIN.

Segurança: os dados só abrem para quem fez login (as tabelas recusam a chave pública
sozinha). A pílula no topo mostra **conectar nuvem / online / offline / N pendentes**.
Conflito entre aparelhos: vence a alteração mais recente. Sincroniza a cada 30 s com o
app aberto, logo depois de cada lançamento e ao voltar para o app.

## Backup

Ajustes → Backup → **Exportar** gera um arquivo `.json` com tudo; **Importar** restaura.
Faça isso de vez em quando se não estiver usando o Supabase.

## Publicado e instalar no celular

**Link: https://restaurante-app.github.io/**
(organização `restaurante-app`, repositório `restaurante-app.github.io`, GitHub Pages a partir do `main`).

Abra o link no Chrome do celular → menu → **Instalar app / Adicionar à tela inicial**.
Abre em tela cheia e funciona sem internet depois da primeira abertura.

Para atualizar: altere os arquivos, aumente a versão em `sw.js` (ex.: `pari-v3` → `pari-v4`)
e faça `git push`. Sem aumentar a versão o celular continua abrindo a versão guardada.
A fonte (Inter) vem do Google Fonts e fica guardada no celular na primeira abertura
com internet; sem ela, o app usa a fonte do sistema.

O app tem endereço próprio (organização separada), então não divide o armazenamento
do navegador com o ERP nem com a contagem, que ficam em `agrobras123-lab.github.io`.
Por garantia, ele só mexe nos próprios dados (prefixo `pari`).

## Limitações conhecidas

- Os PINs são verificados no aparelho; protegem contra uso casual, não contra
  alguém técnico com o código na mão.
- Sem o Supabase, cada celular tem os seus dados (use o backup para juntar).
- Módulos Espetos (saída/sobra/perda), Bebidas (pergunta a cada venda) e Rota da
  marmita não foram feitos (fora do pedido). Anexação de bebida é medida pelas
  comandas (conta com bebida ÷ total de contas).
