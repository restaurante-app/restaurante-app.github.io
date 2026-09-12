# Pátio do Pari · Restaurante

App de gestão do restaurante: **mesas e comandas ao vivo**, **contador de fluxo**,
**fichas técnicas com preço vivo** e **painel do dono**. Programa novo, independente
do ERP da Agro Bras (não usa nada dele).

- Funciona **offline**: tudo é gravado no celular na hora; sincroniza quando há rede.
- Tema escuro, botões grandes (mínimo 56 px), uso com uma mão.
- Dia operacional começa **às 03:00** (domingo conta como segunda).
- HTML + JavaScript puro, sem instalação. Para publicar é só subir a pasta.

## Acesso (PIN)

No primeiro uso o app pede para criar o **PIN do DONO** (4 dígitos).
Em **Ajustes → Pessoas e PINs** o dono cadastra os operadores.

| | Dono | Operador |
|---|---|---|
| Mesas, venda rápida, marmita, fechar conta, fiado, despesas | ✓ | ✓ |
| Contador de fluxo | ✓ | ✓ |
| Atualizar preço de compra | ✓ | ✓ |
| Painel, relatório, análise do fluxo, fichas, simulação, cadastro | ✓ | — |
| Reabrir conta fechada | ✓ | — |

A sessão do dono trava sozinha depois de 10 minutos com o app em segundo plano.

## Módulos

**Mesas** — toque na mesa, digite o nome do cliente, e vá tocando nos itens conforme
saem. Cada item fica com o horário. O total é automático. Em *Fechar conta* escolha a
forma (Dinheiro, Pix, Débito, Crédito, Fiado); dá para dividir e calcular troco.
*Venda rápida* é para o balcão (sem mesa). *Marmita* abre comanda no canal marmita.
Abas: **Fechadas** (contas do dia), **Despesas** (mercadoria e outros gastos),
**Fiado** (quem deve, com "Recebi em…"), **Lançar totais** (vendas sem comanda).
Item tirado de uma comanda e conta cancelada ficam registrados com quem fez.

**Fluxo** — botão +1 gigante, modos PASSOU / COMPROU, faixa de hora automática,
fecha sozinho na virada da hora, retoma se o app fechar. Análise (dono): média por
faixa, conversão, filtro por dia da semana, 3 maiores e 3 menores, exportar CSV.

**Fichas** — painel de margem (semáforo 35% / 40%), ficha detalhada, atualização de
preço um por vez ("Contra filé grelhado saiu de 38% para 42%"), simulação de porção e
preço, cadastro de insumos e itens (item pode conter outro item).

**Painel** — três cards (dia, semana, mês) que cabem na tela: lucro estimado com
semáforo, prime cost, food cost ficha × real, bebida junto por canal, projeção do mês
e a escada de espetos/dia. **Relatório detalhado**: resultado, caixa por forma de
pagamento, por canal, por hora, o que foi vendido, contas, gastos, controle de
cancelamentos; exporta CSV (abre no Excel) e imprime.

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

Sem configurar, tudo fica só no aparelho (a pílula no topo mostra "sem nuvem").
Para o painel do dono enxergar o que a equipe registra em outros celulares:

1. Crie um **projeto novo** no Supabase (separado do ERP).
2. SQL Editor → cole e rode o arquivo `schema.sql`.
3. Project Settings → API → copie a URL e a chave pública (anon/publishable).
4. Cole em `js/config.js` (`SUPABASE_URL` e `SUPABASE_ANON_KEY`).
5. Aumente a versão em `sw.js` (`pari-v1` → `pari-v2`) e publique de novo.

A pílula passa a mostrar **online / offline / N pendentes**.
Conflito entre aparelhos: vence a alteração mais recente.

## Backup

Ajustes → Backup → **Exportar** gera um arquivo `.json` com tudo; **Importar** restaura.
Faça isso de vez em quando se não estiver usando o Supabase.

## Publicado e instalar no celular

**Link: https://agrobras123-lab.github.io/restaurante/**
(repositório `agrobras123-lab/restaurante`, GitHub Pages a partir do `main`).

Abra o link no Chrome do celular → menu → **Instalar app / Adicionar à tela inicial**.
Abre em tela cheia e funciona sem internet depois da primeira abertura.

Para atualizar: altere os arquivos, aumente a versão em `sw.js` (`pari-v1` → `pari-v2`)
e faça `git push`. Sem aumentar a versão o celular continua abrindo a versão guardada.

O endereço `agrobras123-lab.github.io` é o mesmo do ERP e da contagem. O app só mexe
nos próprios dados (prefixo `pari`). O service worker do ERP apaga caches de outros
apps quando atualiza; o deste app se refaz sozinho na próxima abertura com internet.

## Limitações conhecidas

- Os PINs são verificados no aparelho; protegem contra uso casual, não contra
  alguém técnico com o código na mão.
- Sem o Supabase, cada celular tem os seus dados (use o backup para juntar).
- Módulos Espetos (saída/sobra/perda), Bebidas (pergunta a cada venda) e Rota da
  marmita não foram feitos (fora do pedido). Anexação de bebida é medida pelas
  comandas (conta com bebida ÷ total de contas).
