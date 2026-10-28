# Próximos passos — situação em 28/10/2026

## Situação

| O quê | Onde | Estado |
|---|---|---|
| App v1.22 (Pratos repetidos: preço antes e depois, juntar de uma vez os que não mudam o preço, criar os extras, deixar separado) | branch `claude/stoic-bardeen-kpp2gw` | **em revisão** (não muda o `schema.sql`) |
| App v1.21.1 (avisos com Desfazer no topo da tela, um por vez — não cobrem mais os botões de baixo) | branch `claude/stoic-bardeen-kpp2gw` | **em revisão** (não muda o `schema.sql`) |
| App v1.21 (Fiado: o que cada cliente consumiu na lista e na tela do cliente; Cobrar com a chave Pix) | `main` | **publicado** (não muda o `schema.sql`) |
| App v1.20 (Painel: compras da semana e do mês em R$; Consultar período com os totais e o dia a dia) | `main` | **publicado** (não muda o `schema.sql`) |
| App v1.19 (mesa: ir abatendo o que pagam; fiado mostra o que consumiu; extrato para cobrar em imagem, PDF ou texto) | `main` | **publicado** (não muda o `schema.sql`) |
| App v1.18.3 (contador de pessoas — Fluxo — fora das telas) | `main` | **publicado** (não muda o `schema.sql`) |
| App v1.18.2 (compras: parecidos, trocar insumo, insumo novo ao salvar, rascunho; comanda: Extra ou Troca, criar extra) | `main` | **publicado** (não muda o `schema.sql`) |
| App v1.18.1 (fechar conta com mais de uma forma de pagamento: a segunda forma pergunta quanto) | `main` | **publicado** (não muda o `schema.sql`) |
| App v1.18 (Acompanhamentos; Pratos repetidos; sobra do caixa como venda; "ficou no bolso" vira o troco) | `main` | **publicado** (não muda o `schema.sql`) |
| App v1.17 (Fiado: o cliente paga uma parte e o resto continua devendo) | `main` | **publicado** (não muda o `schema.sql`) |
| App v1.16 (Painel: escolher o dia no calendário e calendário do mês) | `main` | **publicado** (não muda o `schema.sql`) |
| App v1.15 (Painel: semana do calendário e mês inteiro; espeto desligado por enquanto) | `main` | **publicado** (não muda o `schema.sql`) |
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

## O que entrou na v1.17 (pedido de 21/10)

| Pedido | No app |
|---|---|
| Dar baixa na conta dos clientes: pagam um pouco, o resto fica e vou abatendo | Mesas → **Fiado** → toque no cliente → toque no valor e ponha quanto pagou → forma (Dinheiro, Pix, Débito, Crédito). Abate das contas mais antigas; a conta paga em parte fica com o que resta ("já pagou R$ 10 de R$ 35") e o cliente mostra o que já pagou e quando. O recebido entra no caixa e no Fechar caixa do dia em que foi pago; a venda continua no dia dela. Aviso com Desfazer; valor maior que a dívida não passa. Reabrir uma conta com fiado já pago avisa antes |

Como funciona por dentro: a conta paga em parte vira dois pagamentos "Fiado" (o recebido, com dia e forma, e o
que continua em aberto). Nada novo no banco: usa as colunas que já existem.

## O que entrou na v1.22 (pedido de 28/10)

| Pedido | No app |
|---|---|
| Arrumar os pratos duplicados agora | Mais → **Pratos repetidos**: cada sugestão mostra se o preço fica **igual** ou **muda** ("antes R$ 35, depois R$ 30"); **Criar os 6 extras** (Baião, 2 ovos, Batata frita, Feijão de corda, Separada, Comida extra — R$ 5 cada) de uma vez; **Juntar os 10 que não mudam o preço** de uma vez (com Desfazer); **Deixar separado** para o que não quiser juntar (sai da lista e continua à venda; dá para voltar) |

Com o backup de 20/10: 17 sugestões. Juntam sem mudar preço: Costela assada → Costela, Contra filé acebolado →
Contra filé grelhado, Filé de frango grelhado e Milanesa (fora de venda, levam a ficha), Filé com batata frita,
Filé com feijão de corda, Frango assado com baião, Dobradinha separada, Feijoada com extra e Galinha com baião
grande. Mudam o preço (o dono decide): Adicional R$ 7 (→ R$ 5), Filé acebolado com baião (R$ 35 → 30),
Parmegiana com baião (R$ 38 → 40), Calabresa com ovo (R$ 25 → 30), Calabresa com baião (R$ 35 → 30), Costela com
baião (R$ 35 → 40) e Contra filé com ovo (R$ 40 → 45). Nada é apagado: juntar só tira o prato da venda e soma as
vendas no que fica; "Deixar separado" fica em `config` (itens_juntados.manter).

## O que entrou na v1.21.1 (pedido de 28/10)

| Pedido | No app |
|---|---|
| O aviso da compra paga (com o Desfazer) atrapalha lançar as coisas em seguida: pôr em outro lugar | os avisos ("R$ 650,00 pago (Pix) · Desfazer", "Mesa 3 fechada", "recebido"…) saem de cima dos botões de baixo e aparecem **no topo da tela, por cima da barra do título**. Um por vez (o novo substitui o anterior, não empilham) e tocar no texto fecha na hora. O Desfazer continua lá pelos mesmos 6 segundos |

Só muda onde o aviso aparece; nada é gravado nem apagado.

## O que entrou na v1.21 (pedido de 27/10)

| Pedido | No app |
|---|---|
| Ver o que foi consumido na parte dos fiados (só tinha os totais e os abatimentos) | Mesas → **Fiado**: cada cliente mostra o resumo do que consumiu em cada conta e os botões **Consumo · Cobrar · Receber**. *Consumo* abre a tela do cliente: cada conta com dia, hora, local e item por item (itens iguais somados: "3× Heineken long neck"), total, pago na hora, já pagou depois e quanto falta; embaixo os pagamentos destas contas e, à parte, "Antes: contas já pagas" |
| Opção de cobrança: um arquivo para mandar a quem está devendo, com o que, quanto e quando, e os pagamentos feitos | **Cobrar** (na lista ou na tela do cliente): extrato em imagem (WhatsApp), PDF ou texto com cada conta, os itens, o total, o que já foi pago (na hora e depois, com dia e forma) e o total em aberto. Os pagamentos que quitaram contas antigas não entram na cobrança, para não confundir |
| Pôr a chave Pix na cobrança: 11977570523 | o extrato termina com **Pague pelo Pix · chave 11977570523** (no texto, a chave fica sozinha numa linha para copiar). Muda em Ajustes → **Cobrança do fiado** (em branco, sai sem Pix) |

Só leitura, menos a chave Pix (fica na tabela `config`, como os outros ajustes). Nada apagado: testes com o backup
(35 telas, nenhuma diferença; fiado com Adriano, Denis, Bolívia e Devid).

## O que entrou na v1.20 (pedido de 26/10)

| Pedido | No app |
|---|---|
| Em nenhum lugar mostra com clareza as compras da semana | Painel → card da semana: **Compras da semana R$ X · N compras · % das vendas** (tocar abre a lista no período); o card do mês tem **Compras do mês**. A linha de entradas e saídas agora tem a semana também (Vendas · Compras pagas · Despesas) e "Compras" virou **Compras pagas** (o que saiu do caixa; a prazo e cartão saem quando pagos) |
| Uma opção de consultar período com os totais do período escolhido | Painel → **Consultar período** (no topo) ou Mais → Dia e período: atalhos (esta semana, semana passada, este mês, mês passado) ou de/até; no topo os totais (vendas, compras, despesas e equipe, saldo de caixa, pratos, bebidas) e a tabela **Dia a dia** com o total. No período, cada compra mostra só o total e quantos itens (tocar abre a compra) |

Só mostra o que já está lançado: nada é gravado nem apagado. Conferido no backup: semana 12 a 17/10 com
R$ 10.579,67 em 35 compras igual no Painel e no Período, e a soma do dia a dia igual aos totais.

## O que entrou na v1.19 (pedido de 24/10)

| Pedido | No app |
|---|---|
| Gerar um arquivo para cobrar as pessoas, com o que consumiu, quando e o valor, bonitinho | Mesas → **Fiado** → toque no cliente → **Extrato para cobrar (imagem, PDF ou texto)**: imagem com a marca, cada conta com dia, hora, itens e valores, o que já pagou e o total em aberto. **Enviar imagem** (abre o compartilhar do celular — WhatsApp; no computador baixa o arquivo), **Imprimir / PDF** (folha A4; no celular, "Salvar como PDF") ou **Texto** (para colar no WhatsApp) |
| Na tela de fiados, mostrar o que consumiram ao clicar | cada conta do cliente mostra os itens (ex.: "2× Filé de frango, 1× Coca-Cola lata") e a hora |
| Na mesa, ir abatendo o que forem pagando | comanda aberta → **Receber uma parte (alguém pagou e vai embora)** → valor → forma. A conta continua aberta com "Já pago · falta"; a mesa no salão, a lista e a barra mostram o que falta; *Fechar conta* cobra só o resto ("Já está tudo pago" só fecha). Desfazer em cada parte; cancelar fica bloqueado enquanto houver parte paga; reabrir mantém as partes |

Como funciona por dentro: cada parte é um pagamento normal da conta, gravado na hora em que foi pago (antes do
fechamento). O Fechar caixa e o caixa do dia já contam essas partes mesmo com a conta aberta. Nada novo no banco
e nada é apagado: as contas antigas (pagas no fechamento) continuam iguais — conferido no backup (80 pagamentos de contas fechadas).

## O que entrou na v1.18.3 (pedido de 24/10)

| Pedido | No app |
|---|---|
| Retirar o contador de quantas pessoas passaram | "Fluxo" e "Análise do fluxo" saíram de Mais e o "Fluxo" saiu da barra de baixo do operador (fica Mesas · Compras · Mais). Nada apagado: as contagens continuam guardadas e o módulo segue carregado só para salvar uma contagem que estivesse em andamento |

## O que entrou na v1.18.2 (pedido de 23/10)

| Pedido | No app |
|---|---|
| Lancei uma compra de arroz parboilizado e não está constando | provável: a busca não achava "Arroz" para "arroz parboilizado" e o Enter criava um insumo novo "Arroz parboilizado" (o preço do Arroz das fichas não mudava). Agora a busca mostra **Parecidos — é algum destes?** antes de criar, e o Enter não cria quando há parecido. Para corrigir a compra: Editar compra → toque no item → **Não é …? Trocar o insumo** → Arroz → Salvar alterações (o preço do Arroz atualiza) |
| "Aparece como hoje na busca, mas não tem nada nas compras" (foto da Sampa Atacado sem o arroz de R$ 110) | causa: o insumo novo era criado na hora de pôr o item, antes de salvar a compra; a compra do arroz não chegou a ser salva, mas o insumo "Arroz Parboilizado" ficou com o preço de hoje. Agora o insumo novo só é criado ao **salvar** a compra, e a compra começada e não salva fica como **rascunho** neste aparelho ("Compra que não foi salva… Continuar / Descartar" em Compras e em Lançar compra). Também: o cartão da compra mostra quantos itens tem e a busca de insumo mostra o último fornecedor |
| Em vez de só "trocar", poder escolher extra ou troca (nem sempre troca, às vezes acrescenta) | comanda: a faixa de acompanhamentos começa com **Extra / Troca**; Extra acrescenta com o preço; Troca pergunta quanto a mais (0 = sem custo) e entra como "⇄ Troca: Batata frita" à parte; tirar/mais um na troca não mexe no extra |
| Não vejo a função de criar extras (guarnições etc.) | Mais → **Acompanhamentos e extras** (em Dia a dia); na comanda, a faixa dos pratos mostra **+ Criar extra (batata, ovo, baião…)** para o dono; criar item na hora com o tipo **Extra** já põe na faixa; a aba "Outros" virou **Extras** |

## O que entrou na v1.18.1 (pedido de 22/10)

| Pedido | No app |
|---|---|
| Não consigo misturar os meios de pagamento ao fechar comanda, mesa ou marmita | Pagamento: a 1ª forma fica com o total; tocar em outra pergunta "Quanto foi no Pix?" e tira esse valor da primeira (pôr o total troca a forma); com duas formas, mudar o valor de uma ajusta a outra; dica na tela. Antes, a 2ª forma trocava a 1ª em vez de dividir |

## O que entrou na v1.18 (pedido de 21/10)

| Pedido | No app |
|---|---|
| Ver os pratos repetidos (sem limpar ainda) | lista enviada ao dono a partir do backup de 20/10; o dono confirmou: Costela = Costela assada e Contra filé acebolado = Contra filé grelhado |
| Lançar acompanhamentos em vez de um prato para cada variação (Filé de frango 25, com batata 30…) | Mais → **Acompanhamentos**: sugeridos pelas vendas (Comida extra, Baião, Batata frita, 2 ovos, Feijão de corda, Feijão preto, Separada, todos +R$ 5, editáveis); na comanda, faixa *+ Batata frita* logo acima dos pratos |
| Limpar os repetidos | Mais → **Pratos repetidos**: sugestões prontas (mesmo prato, prato + acompanhamento, cachaça cadastrada como prato), *Juntar* um por um com Desfazer, *Separar* depois; nada é apagado, as vendas do que sai somam no que fica |
| Não lançar de novo um prato que já existe | criar prato na comanda com nome parecido sugere o prato + acompanhamento; nome de prato juntado entra como o que ficou |
| Painel: o dinheiro que sobra no caixa entra como venda, deixando claro quanto sobrou | sobra do Fechar caixa (total informado − o que deveria ter) soma nas vendas e no que entrou do Painel (dia, semana, mês, calendário), de Dia e período, do Relatório e de Capital e caixa, sempre com a linha "Inclui R$ X de sobra do caixa" / "(+) Sobra do caixa"; refeita ao vivo (venda lançada depois tira a sobra); falta não entra |
| "Ficou na gaveta" → "ficou no bolso", e já vira o troco do dia seguinte | Fechar caixa: "Dinheiro no bolso" / "Ficou no bolso"; o troco do início vem preenchido com o que ficou no bolso no último fechamento ("O que ficou no bolso no fechamento de ter 20/10") |

Por dentro: a lista de acompanhamentos e os pratos juntados ficam na tabela `config` (`acompanhamentos`,
`itens_juntados`); o prato que sai fica com `ativo = false`. Nada novo no banco.
Ainda em aberto com o dono: preços dos acompanhamentos (sugeridos +R$ 5), se o baião é sempre +R$ 5 e se a
Galinha com arroz e feijão continua como prato separado (não entrou nas sugestões).

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
