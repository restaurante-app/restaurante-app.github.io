# Maria Simone · Restaurante & Marmitas (Pátio do Pari)

App de gestão do restaurante: **mesas e comandas ao vivo**, **compras com lucro em
tempo real**, **fichas técnicas com preço vivo** e **painel do
dono**. Programa novo, independente do ERP da Agro Bras (não usa nada dele).

Navegação (barra de baixo) — dono: Painel · Mesas · Compras · Mais.
Operador: Mesas · Compras · Mais. Em **Mais** fica tudo o resto em listas por grupo
(Dia a dia, Compras e contas, Gestão, Dono, Aparelho), com um número ao vivo em cada linha
(fiado, a pagar, despesas, preços desatualizados…) e uma **busca** no topo ("fiado", "gás",
"equipe"). **Fichas técnicas** fica em Mais → Gestão (saiu da barra de baixo).
Nas telas de dentro, o selo do topo vira o botão **voltar**: ele leva para a tela de onde você
veio (pula formulário já salvo) e, se o app foi aberto direto na tela, para a aba dela. As abas
de cima de cada módulo (ex.: Mesas · Fechadas · Totais) trocam a tela sem empilhar: o voltar
sai do módulo de uma vez.

- Funciona **offline**: tudo é gravado no celular na hora; sincroniza quando há rede.
- Visual da marca **Maria Simone**: vermelho `#B23A43` e creme `#F6EFDF` (cores do logo
  oficial), logo e selo vetorizados (`js/marca.js`), títulos e números na fonte condensada
  da faixa "Restaurante & Marmitas" (Barlow Condensed). Tema **claro (creme)** por padrão e
  **escuro (vinho)** em Mais → Tema. Botões grandes (mínimo 56 px), uso com uma mão.
- Leve no celular: sem desfoque nem textura por cima da tela; a troca de tela leva 0,2 s
  (entra da direita ao avançar, da esquerda ao voltar).
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
| Atualizar preço de compra | ✓ | ✓ |
| Painel, relatório, fichas, simulação, cadastro | ✓ | — |
| Reabrir ou excluir conta fechada (venda) | ✓ | — |

A sessão do dono trava sozinha depois de 10 minutos com o app em segundo plano.

## Módulos

**Mesas** — toque na mesa, digite o nome do cliente, e vá tocando nos itens conforme
saem. Cada item fica com o horário. O total é automático. Em *Fechar conta* escolha a
forma (Dinheiro, Pix, Débito, Crédito, Fiado); dá para dividir e calcular troco. **Mais de uma forma**: toque na
primeira (fica com o total) e depois na outra; o app pergunta quanto foi nela e o resto fica na primeira (pôr o
total inteiro troca a forma). Com duas formas, mudar o valor de uma ajusta a outra sozinha.
**Ir abatendo** (mesa aberta): *Receber uma parte* — alguém pagou a sua parte e vai embora; põe o valor e a
forma (Dinheiro, Pix, Débito, Crédito) e a conta continua aberta, mostrando "Já pago · R$ X · falta R$ Y"
(cada parte tem ✕ para desfazer). A mesa no salão mostra o que falta; *Fechar conta* cobra só o que falta e,
se já está tudo pago, só fecha. Conta com parte paga não pode ser cancelada (desfaça as partes antes). Reabrir
uma conta fechada desfaz só o pagamento do fechamento; as partes continuam pagas. O que foi pago numa conta
ainda aberta já entra no Fechar caixa e no caixa do dia.
*Venda rápida* é para o balcão (sem mesa). *Marmita* abre comanda no canal marmita.
Abas: **Fechadas** (contas do dia), **Totais do dia** (automático: itens e valores
somados das comandas, nada é digitado), **Despesas** (gás, carvão, embalagem, limpeza, manutenção; o dono lança também funcionários,
aluguel, luz/água/internet e impostos), cada uma com a **forma de pagamento** (Dinheiro, Pix, Cartão, Boleto);
toque numa despesa para editar; **Do mês** mostra o total por tipo e por forma e a lista do mês.
O **lucro** usa as despesas lançadas (salários, aluguel, contas e impostos entram no dia em que foram
pagos). Os custos fixos de Ajustes ficam só como **base**: a projeção do mês usa a base enquanto os
fixos do mês não forem lançados. O operador não vê essas despesas,
**Avisos** (ex.: "R$ 650,00 pago (Pix) · Desfazer") aparecem no topo da tela, por cima da barra do título, um por
vez; tocar no texto fecha. Assim os botões de baixo ficam livres para lançar em seguida.
**Fiado** — cada cliente devendo aparece com o total, **o que consumiu** (resumo de cada conta) e três botões:
*Consumo* (tela do cliente: cada conta com dia, hora, local e item por item — itens iguais somados —, total,
pago na hora, já pagou depois e quanto falta; os pagamentos destas contas e, à parte, os que quitaram contas
antigas), *Cobrar* e *Receber*. **Cobrar** gera o extrato com a marca: o que consumiu, quando, quanto, os
pagamentos já feitos nas contas cobradas e o total em aberto, com a **chave Pix** (Ajustes → Cobrança do fiado)
— *Enviar imagem (WhatsApp)*, *Imprimir / PDF* (A4) ou *Texto* (a chave fica sozinha numa linha para copiar).
**Receber**: o cliente pode pagar **só uma parte** — toque no valor e ponha quanto pagou; abate das contas
mais antigas e o resto continua no fiado. O recebido entra no caixa do dia em que foi pago, na forma
escolhida; o aviso tem *Desfazer*.
Item tirado de uma comanda e conta cancelada ficam registrados com quem fez.
**Excluir venda** (dono): venda lançada errada ou repetida sai pelo botão *Excluir venda* no resumo da conta
(Fechadas → toque na conta; a lista não tem lixeira, para não apagar sem querer). Pergunta antes; some das
vendas, do caixa, do fiado e dos lotes de carne; o aviso tem *Desfazer* e ela fica na **Lixeira**.

**Lixeira** (dono; Mais → Lixeira) — nada que é excluído some de verdade: fica guardado (no aparelho e na
nuvem) e aparece aqui por 90 dias — vendas, compras, despesas e lotes de carne — com **Restaurar**. A venda
volta com os itens e os pagamentos; a compra, com os itens e o lote de carne apagados junto.
O dono vê no topo das Mesas: vendido hoje, em aberto nas mesas e o lucro do dia.

**Compras** — *Lançar compra*: de quem comprou, os itens (quantidade + preço por kg, ou
o total pago) e como pagou (Dinheiro, Pix, Cartão ou **A prazo**). Cada item de insumo
**atualiza o preço da ficha técnica** e o app mostra na hora o efeito nos pratos
("Filé de frango saiu de 37% para 39%"). Item sem ficha (gelo, sacola) entra só no gasto.
**Criar na hora**: em *Adicionar item*, escreva o nome na busca; se o insumo não existe, *Criar o insumo "…"*
cadastra ali mesmo (kg, litro ou unidade, com o preço desta compra) e já põe na compra — como o "Criar e pôr
na comanda" da marmita. *"…" sem ficha* lança só no gasto sem perguntar o nome de novo. No item da nota marcado
*ligar à ficha* também dá para criar o insumo com o nome da nota (o app lembra para as próximas notas).
O insumo novo só é cadastrado quando a compra é **salva** (marcado "insumo novo" até lá). Sem nenhum insumo com
todas as palavras, a busca mostra **Parecidos — é algum destes?** (ex.: "arroz parboilizado" → Arroz) antes de
criar. **Compra não salva não some**: o que foi lançado e não salvo fica guardado neste aparelho; Compras e
Lançar compra mostram "Compra que não foi salva… *Continuar* / *Descartar*" (descartar pergunta antes).
**Trocar o insumo**: em *Editar* compra, toque no item → *Não é …? Trocar o insumo* (mantém quantidade e preço;
ao salvar, o preço do insumo certo é atualizado). O cartão da compra começa com a quantidade de itens.
**Dia da compra**: a compra nasce no dia aberto em Compras (ou hoje); toque no dia no formulário
para escolher outro no calendário (compra de ontem lançada hoje, por exemplo).
Compra de dia passado ou editada não passa por cima do preço de uma compra mais nova.
**Colar itens** (grátis, qualquer nota — até escrita à mão): em Compras → *Colar itens*,
toque em "mensagem de pedido" para copiá-la, mande a foto da nota para o Claude (app ou
claude.ai) junto com essa mensagem, copie a resposta e cole no app. O app confere a soma
com o total da nota e preenche a compra (uma linha `Data: 01/10/2026` lança no dia certo) (fardos em unidades, ligação às fichas). Não precisa
de internet nem de Supabase.
**Ler nota** (grátis): em Compras, toque em *Ler nota* e aponte a câmera para o **QR Code**
do cupom fiscal (NFC-e) — lê sozinho, como app de banco (leitor ZXing em WebAssembly,
`js/vendor/zxing`, baixado só na primeira leitura). Se o QR apontar para o portal de outro
estado (erro de alguns sistemas de caixa), o app usa o portal do estado da chave (SP). Se preferir, *Tirar foto* ou
escolher da galeria (foto de longe costuma sair borrada; chegue perto do QR). O app busca os itens
na página pública da Sefaz: fornecedor, forma de pagamento, itens com quantidade e valor.
Quando a nota diz só "FD"/"CX" sem dizer quantas vêm dentro, o app **pergunta uma vez** ("Quantas unidades vêm
em 1 FD?") e guarda para as próximas notas daquele produto. Fardo, caixa, pacote e dúzia viram **unidades** pela descrição ("2 FD" de "12X350ML" = 24 un,
"C 15" = 15, "DZ" = 12), então cada item mostra o **custo por unidade** (lata, garrafa).
Lata casa sozinha com "Cerveja lata" (pela marca) ou "Refrigerante lata"; long neck com
"Long neck" — o preço desses insumos vira a média paga por unidade.
Produtos que batem com um insumo vêm ligados à ficha (marcados **confira**); os outros vêm
com **ligar à ficha** — toque, escolha o insumo (ou "nenhum") e o app **lembra** para as
próximas notas. Nada é salvo sem tocar em *Salvar compra*; a mesma nota lançada duas vezes
dá aviso. Nota sem QR Code (feira, açougue, escrita à mão) continua sendo digitada.
Precisa de internet e da nuvem conectada (função `ler-qr` do Supabase — veja abaixo).
**Achar compras antigas**: toque no dia (no topo de Compras, Despesas ou Fechadas) para abrir o
**calendário** — cada dia mostra quanto saiu (compras + despesas) e o topo mostra compras e despesas
do mês; o dia escolhido lista as compras e as despesas; ou use a **busca** ("coca", "heineken", nome do
fornecedor), que procura em todas as compras pelo nome do produto como veio na nota.
**Como pagou**: Dinheiro, Pix, Débito (sai na hora), **Crédito** (entra na fatura do cartão:
o app sugere o próximo vencimento, que fica em Ajustes → Cartão de crédito) ou **A prazo**
(com vencimento, se quiser). *Dividir* lança a compra em partes (ex.: parte no crédito e o resto
em dinheiro; a última parte fica com o que falta).
**Excluir compra** (dono): no detalhe da compra, *Excluir compra* tira a compra do gasto e do caixa (e apaga o
lote de carne aberto por ela, se houver); pergunta antes, o aviso tem *Desfazer* e ela fica na **Lixeira**. Os preços
das fichas não voltam atrás.
**A pagar**: o que está em aberto, por fornecedor (a prazo) e por fatura do cartão, com o
vencimento ("vence 01/11 (27 dias)"); ao pagar, escolhe-se o dia do pagamento e a forma.
No caixa, a compra a prazo ou no crédito só sai no dia em que é paga.
**Resultado do dia ao vivo** (dono):

    resultado = vendas − custo do que foi vendido (fichas) − despesas lançadas (inclusive fixos pagos)
    caixa     = recebido (sem fiado) − o que foi pago no dia (compras e partes de compras) − despesas

Prato **sem ficha** não tem custo: o lucro sai maior que o real, e o Painel e o Relatório avisam
quanto foi vendido assim. Até montar a ficha, dá para pôr um **custo estimado** no prato
(Fichas → Cadastro → item) ou um **% geral** para pratos sem ficha (Ajustes → Fichas); a venda
já lançada sem custo passa a usar a estimativa.

**Custos** (dono): por insumo, quanto foi comprado × quanto as vendas usaram pela ficha
(peso bruto, com fator de correção e perda). Sobra grande que se repete = desperdício,
porção maior que a ficha ou venda sem comanda. Mostra também os preços que mudaram.

**Análise de compras** (dono; Compras → *Análise* ou Mais → *Análise de compras*) — recalcula sozinha
a cada compra ou venda. Três partes, para a semana, 30 dias ou 3 meses:
- *Alertas*: preço acima do que costuma pagar pelo mesmo produto (mediana das compras dos últimos 120 dias;
  15% = atenção, 30% = confira já, com o fornecedor que vendeu mais barato), preço muito abaixo (erro de
  digitação?), quantidade 2,5× acima do costume, mesma compra lançada duas vezes, comprado bem acima do que
  as vendas usaram pela ficha (sobra/perda) e compras sem ligação com ficha. "Está certo" esconde o alerta.
  Logo depois de salvar uma compra, o que estiver fora do normal já aparece.
- *Compras × vendas*: vendas, compras (% das vendas, meta de food cost), custo pela ficha, semana a semana
  e o que mais comprou, com a variação de preço e quantidade sobre o período anterior.
- *Pratos*: compensa (custo até 35% do preço), no limite (até 40%), não compensa ou sem ficha; quanto
  vendeu e quanto deixou, se o custo subiu com as últimas compras, o preço (ou a porção) para voltar a 35%
  e se vende bem / ganha bem comparado com os outros da categoria.

**Fluxo** — *fora das telas desde 24/10 (pedido do dono): sem atalho em Mais nem na barra do operador; as
contagens feitas continuam guardadas.* Como era: só a passagem é contada à mão: botão +1 gigante para **PASSOU**, faixa de
hora automática, fecha sozinho na virada da hora, retoma se o app fechar.
**COMPROU é automático**: cada comanda com item conta como uma compra, na hora em que
foi aberta. A tela mostra a conversão (comprou ÷ passou) ao vivo. Análise (dono): média
por faixa, conversão, filtro por dia da semana, 3 maiores e 3 menores, exportar CSV.

**Fichas** — painel de margem (semáforo 35% / 40%), ficha detalhada, atualização de
preço um por vez ("Contra filé grelhado saiu de 38% para 42%"), simulação de porção e
preço, cadastro de insumos e itens (item pode conter outro item).

**Painel** — três cards (dia, semana, mês) que cabem na tela, atualizando ao vivo. A **semana é a do
calendário** (segunda a sábado do dia escolhido) e o **mês é o mês inteiro** (até hoje): trocar o dia nas setas
só muda o card do dia, a semana e o mês só mudam quando o dia escolhido cai em outra semana ou outro mês.
**Tocar no título do dia** abre o calendário para escolher qualquer dia (o painel inteiro vai para ele). No
card do mês, **Calendário do mês** mostra cada dia com o resultado (entrou − saiu, ou o lucro pelas fichas;
verde ou vermelho); as setas trocam o mês e **tocar num dia** abre tudo daquele dia (vendas, pratos e bebidas,
compras com os itens, despesas, equipe, caixa e fechamento, fiado e gás), com as setas para o dia anterior e
o seguinte, "Ver no painel" e "Abrir em Dia e período". **Compras da semana** e **Compras do mês**: quanto
foi comprado (lançado em Compras), quantas compras e quanto isso é das vendas; tocar abre o período com a lista e
o dia a dia. Nos cards de entradas e saídas, "Compras pagas" é o que saiu do caixa para compras (a prazo e cartão
saem quando são pagos). No topo, **Consultar período** leva aos totais de um dia até outro. Nos cards:
lucro ou prejuízo do dia com semáforo e caixa (entrou × saiu), prime cost, food cost
ficha × real (compras ÷ vendas), bebida junto por canal, projeção do mês e a escada de
espetos/dia. **Relatório detalhado**: resultado, caixa por forma de pagamento, compras
por insumo, por canal, por hora, o que foi vendido, contas, despesas, controle de
cancelamentos; exporta CSV (itens vendidos, contas, compras e gastos) e imprime.

**Despesas do dono** — além de funcionários, aluguel, contas e impostos: **Pró-labore (retirada)**
(retirada do dono, inclusive coisa pessoal paga com dinheiro do restaurante; conta como custo
fixo) e **Investimento** (equipamento, obra: sai do caixa, mas fica fora do lucro do mês). Em
Funcionários e Pró-labore escolhe-se **quem** e o **tipo** (vale, condução, salário, semana,
diária); o app guarda a que mês ou semana o pagamento se refere.

**Equipe** (dono; Mais → Equipe) — quem trabalha e como recebe (salário mensal, por semana,
diária ou pró-labore do dono), com a conta de cada um: salário do mês − vales = falta pagar,
condução paga, semana a semana da entregadora e quanto o dono ainda pode retirar no mês.
Botões para lançar vale, condução, salário, semana ou retirada (viram despesas do dia).

**Pendências** (dono; Mais → Pendências) — o que falta confirmar e anotações que não têm outro
lugar no app, com "Resolvido" (e como resolveu) e atalho para a compra, conta ou item ligado.

**Capital e caixa** (dono; Mais → Capital e caixa) — caixa desde a abertura (vendas recebidas −
compras pagas − equipe − retiradas − despesas = saldo das operações; e o que ainda vai sair e
entrar) e a **montagem**: tudo que foi gasto antes do dia da abertura (Ajustes → Custos fixos).

**Cardápio do dia** (Mais → Cardápio do dia) — os pratos de cada dia da semana (segunda a
sábado; o dono monta, na ordem que quiser). Na comanda, os pratos do dia aparecem primeiro e o
resto fica em "Outros pratos"; dia sem cardápio = todos os pratos. Botões para copiar o cardápio
de hoje ou mandar no WhatsApp.

**Fechar caixa** (Mesas → Fechar caixa, ou Mais → Fechar caixa) — no fim do dia, informe o **dinheiro
que ficou no bolso**, o **Pix que entrou na conta** e o **total da maquininha**; o app confere com o que
registrou no dia e mostra, em cada um, **bateu**, **sobrou** ou **faltou** (e quanto):
- Dinheiro = troco do início + vendas e fiado recebidos em dinheiro − compras e despesas pagas em dinheiro
  (a lista do que saiu fica à mão). O troco do início é o que **ficou no bolso** no último fechamento
  (já vem preenchido no dia seguinte); toque para mudar.
- Pix = vendas e fiado recebidos no Pix (o que saiu no Pix aparece à parte e não entra nesta conta).
- Cartão = débito + crédito das vendas (e do fiado recebido no cartão).
Avisa se ainda há conta aberta no dia e se há despesa sem forma de pagamento. *Fechar o caixa* guarda o que
foi informado, quem fechou e a hora (dá para salvar de novo ou desfazer); a conta é refeita ao vivo se algo
for lançado depois. Mais → Fechar caixa e Dia e período (no dia) mostram o resultado. Todos fecham; o que é
só do dono (salário, retirada…) entra na conta sem mostrar o que é.
**Sobra do caixa**: quando o total informado passa do que deveria ter, a sobra entra como **venda** no Painel
(dia, semana, mês e calendário), em Dia e período, no Relatório e em Capital e caixa, sempre à parte ("Inclui R$ X de sobra do caixa",
"(+) Sobra do caixa"). É refeita ao vivo: se a venda que faltava for lançada depois, a sobra diminui e não
conta duas vezes. Falta não entra (fica só o aviso no fechamento).

**Folha da cozinha** (Mais → Folha da cozinha, ou a aba ao lado do Cardápio do dia) — a folha A4 que fica
impressa na cozinha para as cozinheiras saberem o que fazer: os **pratos do dia** de cada dia da semana e os
**fixos da chapa** (saem todos os dias), cada um com o que **leva**. Toque no dia (Seg a Sáb), em *Adicionar
prato* (busca nos pratos já usados na cozinha e nos da comanda, ou escreva um novo) e escreva o que leva; o
"Leva" fica guardado no prato e volta pronto quando ele entra em outro dia. *Trazer do cardápio* puxa os pratos
do Cardápio do dia; *Copiar outro dia* copia a folha de outro dia; a seta sobe o prato; o X tira (com
Desfazer). *Imprimir* sai numa folha A4 no visual da marca (faixa Maria Simone, creme, cartões com borda
vermelha), com a data do dia escolhido ou só o dia da semana (para deixar a mesma folha impressa por mais
tempo). Com muito prato a letra encolhe sozinha para caber numa página (e avisa se não couber). O dono monta;
todos veem e imprimem. Começa com a folha de sexta montada com o dono (16/10).

**Acompanhamentos e extras** (Mais → Acompanhamentos e extras, ou a aba no Cardápio; só o dono monta) — Batata frita, Baião,
Comida extra, 2 ovos, Feijão de corda, Feijão preto, Separada… cada um com o preço que soma no prato. Na
comanda, na aba Pratos, aparecem numa faixa logo acima dos pratos: toque no prato e depois em *+ Batata frita*
(Filé de frango R$ 25 + Batata frita R$ 5 = R$ 30). O prato continua contando como 1 prato e o acompanhamento
entra como item à parte (dá para ver quantos saíram). Os sugeridos saíram das vendas (o que vinha escrito no
nome do prato); *Pôr todos os sugeridos* cria de uma vez, e toque no nome para mudar nome e preço.
Na comanda, o dono também cria um extra na hora: *+ Criar extra* na faixa (ou, na busca, criar como tipo
*Extra*), e ele já entra na faixa. A aba "Outros" da comanda virou **Extras**.
**Extra ou Troca**: no começo da faixa, *Extra* (padrão) acrescenta com o preço do acompanhamento; *Troca* põe no
lugar de algo do prato (ex.: batata no lugar do arroz) — pergunta quanto a mais (0 = sem custo), entra como
"Troca: Batata frita" numa linha à parte e a faixa volta para Extra.

**Pratos repetidos** (Mais → Pratos repetidos, ou a aba *Repetidos* no Cardápio; só o dono) — o mesmo prato
cadastrado duas vezes (Costela e Costela assada) ou com o acompanhamento no nome (Filé de frango com batata
frita). *Juntar*: o de cima sai da comanda e do cardápio do dia (não é apagado) e as vendas dele passam a
somar no que fica (relatório, análise, cardápio); as vendas antigas não mudam. Quando o que sai tem ficha
técnica e o que fica não tem, a ficha passa junto. *Trocar qual fica* inverte; *Já juntados* → *Separar*
desfaz. *Juntar outros dois pratos* escolhe quaisquer dois. Na comanda, criar um prato com nome parecido com
um que já existe avisa: "Já existe: Pôr Filé de frango + Batata frita · R$ 30"; nome de prato juntado entra
como o prato que ficou.

**Buscas** — Compras e Despesas têm uma busca no topo que aceita nome, data e valor juntos
(ex.: "gás 05/10", "coca", "380", "247,80"): procura em tudo o que já foi lançado. Na comanda
(mesa, marmita ou venda rápida), "Buscar item" acha em todas as categorias; se o item não existe,
"Criar … e pôr na comanda" cadastra na hora (nome, tipo e preço) e já lança.

**Painel: entradas e saídas ou lucro pelas fichas** — seletor no topo do Painel (e em Ajustes →
Painel). O padrão é **entradas e saídas**: o que entrou no caixa (vendas recebidas) menos o que
saiu (compras pagas, despesas, retiradas, investimentos), no dia, na semana e no mês — não depende
das fichas técnicas. "Lucro pelas fichas" desconta o custo de cada prato vendido (precisa das fichas).

**Gás** (Mais → Gás) — cada botijão, do dia em que foi ligado ao dia em que acabou. "Acabou o
gás" fecha o botijão em uso e já registra o novo (e lança a compra em Despesas, se quiser). Com
os botijões que acabaram, o app mostra quanto dura em média (dias e dias com venda), o custo do
gás por dia aberto e por mês, prevê quando o atual acaba e avisa no Painel quando está perto. Gás
lançado direto em Despesas depois de ligar o botijão em uso fica como **reserva**: quando o atual
acabar, "Acabou o gás" → "Liguei a reserva" usa essa compra (sem lançar de novo).

**Importar lançamentos** (dono; Mais → Importar lançamentos ou Ajustes → Backup) — lança de uma
vez um pacote `.json` com compras, vendas por cliente, despesas, equipe, cardápio e pendências
(ex.: o que foi anotado no caderno antes de usar o app). Antes de lançar, **confere**: mostra os
totais de cada dia, o que é novo, o que **já está no app** (não lança de novo) e o que é
**parecido** (mesmo dia e mesmo valor: fica de fora, a não ser que você marque). As compras
passam pelo caminho normal (atualizam o preço dos insumos, dia a dia); as vendas entram como
contas fechadas **"lançadas depois"**, sem horário — contam no faturamento, no caixa e nos
pratos, mas ficam fora das vendas por hora e do Fluxo. **Desfazer** apaga o que a importação
criou e volta o que ela mudou. Ids fixos: importar duas vezes, ou em dois aparelhos, não duplica.
O pacote também pode trazer botijões do gás, o cardápio de cada dia, conta a prazo paga depois,
prato desativado que volta ao cardápio, pendências antigas que ele resolve, correções em registros
já lançados (fornecedor da compra, linha de compra ligada ao insumo certo, nome da equipe, insumo da
ficha, dia em que o botijão foi ligado…), fiado recebido depois, apagar um preço ou uma despesa que
entrou errado (repetida) e separar linhas de uma compra
numa compra de outro fornecedor. No Rendimento, o pacote abre lotes de carne ligados às compras dele,
fecha um lote que acabou (corrige o dia e o fornecedor), diz desde quando o lote conta as vendas, move pratos de um dia para outro lote e
marca compras que "não são lote".
Conta reaberta para corrigir continua no dia dela ao fechar de novo.

**Unidade na compra** — na folha de quantidade e preço de um item da compra, "Comprado por" escolhe
kg, litro ou unidade (ex.: alface por unidade). Trocando a unidade de um insumo, o app pergunta
quanto pesa 1 unidade (se ele estiver numa ficha) e, ao salvar a compra, converte o insumo, as
quantidades das fichas que o usam e o histórico de preço. As próximas compras já vêm na unidade nova.

**Dia e período** (só o dono; Painel → Consultar período, ou Mais → Dia e período) — no topo, os totais:
**vendas, compras, despesas e equipe, saldo de caixa, pratos e bebidas**; no período, a tabela **Dia a dia**
(vendas, compras e despesas de cada dia, com o total). Calendário do mês com o vendido em cada
dia; tocar num dia mostra tudo dele: vendas (por canal e forma de pagamento), quantidade e valor de
cada prato e de cada bebida, compras com os itens, despesas, equipe (vales, salários, pró-labore),
caixa (entrou, saiu e saldo), fiado vendido e recebido e o gás. **Período**: de um dia até outro
(atalhos: esta semana, semana passada, este mês, mês passado), com os mesmos blocos somados e a
planilha (CSV); marcando **Comparar com outro período**, escolhe-se um segundo período qualquer e os
dois aparecem lado a lado com a diferença em R$ e em % (vendas, quantidades de cada prato e bebida,
compras por item, despesas, equipe, caixa, fiado e gás). Só lê o que já está lançado.

**Rendimento por lote** (só o dono; Mais → Rendimento) — cada compra de carne ou peixe (só a carne
principal: contra filé, capa de filé, costela, rabada, filé de frango, coxa, galinha, tilápia,
carne seca, bisteca, fígado, bucho, costelinha, bacalhau, carneiro, calabresa e os pertences da feijoada —
salgados, costela suína, paio, charque) vira um **lote**; os pertences contam as feijoadas. Ao salvar a compra, o
app pergunta se abre um lote novo e, se já houver um aberto da mesma carne, se o anterior acabou
(com "não", os dois ficam abertos). As vendas dos pratos que usam a carne entram sozinhas no lote
**aberto mais antigo** ("3 rabadas" = 3 pratos; pedido com vários pratos conta 1 em cada lote); dá
para **mover** os pratos de um dia para outro lote (até de outra carne em uso no dia, ex.: costela feita com a costelinha). **Acabou** fecha o lote e mostra pratos, venda
dos pratos (só a comida), gramas por prato, carne por prato, carne / venda (até 35% verde, até 45%
amarelo, acima vermelho) e a sobra depois da carne. **Peso que sobrou** estima quantos pratos ainda
saem. Avisa quando passa da meta de gramas por prato. **Busca** no topo dos lotes: carne, fornecedor, dia
(05/10) ou valor (380, 52,90 o kg), nos abertos e nos fechados. **Comparar**: lotes da mesma carne
(fornecedor, R$/kg, g por prato, carne / venda). **Ajustes**: qual prato usa qual carne, metas e as
palavras da compra que abrem lote. **Vendas contam desde**: o dia em que começou a usar o lote (para
um lote comprado antes e guardado, ex.: pertences que entram de uma vez numa feijoada futura). Os lotes de 01 a 08/10 entram uma vez em cada
aparelho (contagem do dono); a partir de 09/10 as vendas contam sozinhas. Não muda vendas, compras,
caixa nem relatórios.

**Espeto desligado** (por enquanto) — o turno do espeto (madrugada) ainda não abriu, então tudo do espeto fica
escondido: os espetos e o "Baião + espeto de frango" saem da comanda, da busca, do cardápio, das fichas e do
painel; a comanda nova não entra mais como "Espeto" pelo horário; somem a barra "Espeto" dos canais, os
espetos/dia, a escada de espetos e as metas e horários do espeto em Ajustes. **Nada é apagado**: os itens e as
fichas continuam guardados, e venda que já tenha sido feita no canal Espeto continua contando (o canal aparece se
tiver venda). Para voltar: Ajustes → Salão e turnos → **Turno do espeto** → Ligar.

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

**Atualizar a nuvem** (quando o app ganha tabela, coluna ou opção nova — v1.7: equipe,
pendências, pagamento em partes/cartão de crédito, pró-labore, investimento, vendas lançadas
depois, custo estimado; v1.8: botijões do gás): SQL Editor → cole o `schema.sql` inteiro de novo
→ *Run* (pode rodar quantas vezes quiser). O Supabase avisa "Potential issues detected"
(operações destrutivas e tabelas sem RLS): é alarme falso — o arquivo só troca listas de valores
e regras de acesso, e liga o RLS de todas as tabelas no bloco do final. Escolha **Run without RLS**
(roda o arquivo como está). Enquanto isso não é feito, a sincronização **não trava**: o que a nuvem
ainda não aceita fica guardado no aparelho (Ajustes → Sincronização mostra o que falta) e o
resto segue normalmente; depois de rodar o SQL, toque em *Sincronizar agora*.

## Leitura do cupom fiscal (função `ler-qr`) — grátis

O navegador não pode abrir o site da Sefaz direto, então uma Edge Function do Supabase
só busca a página do QR Code e devolve para o app. Não usa nenhuma API paga (cabe no
plano grátis do Supabase). Publicar uma vez:

1. Supabase → **Edge Functions → Deploy a new function → Via Editor**: nome `ler-qr`,
   apague o exemplo, cole o conteúdo de `supabase/functions/ler-qr/index.ts` e *Deploy*.
   (Com a CLI: `supabase functions deploy ler-qr --no-verify-jwt`.)
2. Na função `ler-qr` → **Details** → desligue *Verify JWT with legacy secret*
   (a própria função confere o login da nuvem do app).

Sem isso, o botão avisa "Função "ler-qr" não publicada no Supabase".

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
As fontes (Plus Jakarta Sans e Barlow Condensed) vêm do Google Fonts e ficam guardadas no
celular na primeira abertura com internet; sem elas, o app usa a fonte do sistema.
Ícone do app: o selo redondo Maria Simone (`icons/`). Quem já instalou continua com o ícone
antigo até remover e instalar de novo (o Android às vezes troca sozinho depois de alguns dias).

O app tem endereço próprio (organização separada), então não divide o armazenamento
do navegador com o ERP nem com a contagem, que ficam em `agrobras123-lab.github.io`.
Por garantia, ele só mexe nos próprios dados (prefixo `pari`).

## Testar no computador

`.claude/launch.json` sobe um servidor local (porta 5611). Em `localhost` o service worker e a
**nuvem ficam desligados** (nada de teste vai para os dados de verdade); para testar a nuvem aí:
`localStorage.setItem('pari.nuvemLocal', '1')`. Arquivos de teste com dados ficam em `.claude/`
(fora do Git).

## Limitações conhecidas

- Os PINs são verificados no aparelho; protegem contra uso casual, não contra
  alguém técnico com o código na mão.
- Sem o Supabase, cada celular tem os seus dados (use o backup para juntar).
- Módulos Espetos (saída/sobra/perda), Bebidas (pergunta a cada venda) e Rota da
  marmita não foram feitos (fora do pedido). Anexação de bebida é medida pelas
  comandas (conta com bebida ÷ total de contas).
