/* MAIS — tudo do app num lugar só: listas por grupo, com um número ao vivo em cada
   linha e uma busca no topo ("fiado", "gás", "equipe"…) para achar a função na hora. */
(function () {
  'use strict';
  const P = window.P;
  const h = P.UI.h;

  function telaMais(view) {
    view.className = 'v-mais';
    let filtro = '';
    const corpo = h('div');
    // linha: { href | onClick, ic, cor, t (título), s (texto ao vivo), destaque, k (palavras para a busca) }
    function linha(it) {
      const fim = h('span', { class: 'mrow-fim' },
        it.destaque ? h('i', { class: 'mrow-ponto', 'aria-hidden': 'true' }) : null,
        it.val ? h('span', { class: 'mrow-val' }, it.val) : null,
        it.onClick ? null : P.UI.icone('avancar'));
      const miolo = [
        h('span', { class: 'mrow-ic' }, P.UI.icone(it.ic)),
        h('span', { class: 'mrow-tx' }, h('span', { class: 'mrow-t' }, it.t), h('span', { class: 'mrow-s' + (it.destaque ? ' t-amarelo' : '') }, it.s)),
        fim,
      ];
      return it.onClick
        ? h('button', { type: 'button', class: 'mrow c-' + it.cor, onClick: it.onClick }, miolo)
        : h('a', { class: 'mrow c-' + it.cor, href: '#/' + it.href }, miolo);
    }
    function grupo(titulo, itens) {
      const q = P.UI.semAcento(filtro);
      const vis = itens.filter(it => !q || P.UI.semAcento([it.t, it.s, it.k, titulo].join(' ')).includes(q));
      if (!vis.length) return null;
      return h('section', { class: 'mais-g' }, h('div', { class: 'secao' }, titulo), h('div', { class: 'mlista' }, vis.map(linha)));
    }

    const busca = P.UI.campoBusca('Buscar: fiado, gás, equipe…', q => { filtro = q; desenhar(); });

    function desenhar() {
      corpo.innerHTML = '';
      const u = P.Auth.usuario();
      if (!u) return;
      const dono = P.Auth.isDono();
      const hoje = P.Dia.hoje();

      const tot = P.Mesas.totaisDoDia(hoje, 'TODOS');
      const fechadas = tot.nFechadas;
      const fiado = P.Mesas.fiadoAberto().reduce((s, p) => s + (+p.valor || 0), 0);
      const aPagar = P.Compras.aPagar().reduce((s, c) => s + P.Compras.valorAberto(c), 0);
      const despHoje = P.Store.all('despesas').filter(d => d.dia_operacional === hoje && P.Mesas.despVisivel(d)).reduce((s, d) => s + (+d.valor || 0), 0);
      const velhos = P.Store.all('insumos').filter(P.Calc.precoVelho).length;
      const passou = P.Fluxo.totais('PASSOU').dia;
      const cardHoje = P.Cardapio.doDia(hoje);
      const bot = P.Gas.emUso();
      const botInfo = bot && P.Gas.info(bot);
      const avisoGas = P.Gas.aviso();
      const grupos = [];

      grupos.push(grupo('Dia a dia', [
        { href: 'mesas/totais', ic: 'relatorio', cor: 'verde', t: 'Totais do dia', s: P.brl0(tot.fechado) + ' vendido hoje', k: 'vendas faturamento' },
        { href: 'mesas/hoje', ic: 'check', cor: 'verde', t: 'Contas fechadas', s: fechadas + (fechadas === 1 ? ' conta hoje' : ' contas hoje'), k: 'comandas vendas' },
        { href: 'mesas/fiado', ic: 'fiado', cor: 'vermelho', t: 'Fiado', s: fiado ? P.brl0(fiado) + ' a receber' : 'ninguém devendo', destaque: !!fiado, k: 'devendo receber cliente pendura' },
        { href: 'mesas/despesas', ic: 'caixa', cor: 'laranja', t: 'Despesas', s: despHoje ? P.brl0(despHoje) + ' hoje' : dono ? 'salários, aluguel, contas, gás…' : 'gás, carvão, embalagem', k: 'gasto conta luz agua aluguel salario carvao embalagem' },
        { href: 'cardapio', ic: 'fichas', cor: 'laranja', t: 'Cardápio do dia', s: cardHoje.definido ? cardHoje.itens.length + ' pratos de ' + cardHoje.nome + ' · mandar no WhatsApp' : 'monte os pratos de cada dia', k: 'pratos whatsapp menu' },
        { href: 'gas', ic: 'fogo', cor: 'vermelho', t: 'Gás', s: avisoGas ? 'botijão perto de acabar' : bot ? (botInfo.corridos ? 'botijão em uso há ' + botInfo.corridos + (botInfo.corridos === 1 ? ' dia' : ' dias') : 'botijão ligado hoje') : 'quanto dura cada botijão', destaque: !!avisoGas, k: 'botijao' },
        { href: 'fluxo', ic: 'fluxo', cor: 'azul', t: 'Fluxo', s: 'contador · ' + P.num(passou) + ' passaram hoje', k: 'passou contador movimento pessoas' },
      ]));
      grupos.push(grupo('Compras e contas', [
        { href: 'compras/pagar', ic: 'prazo', cor: 'amarelo', t: 'A pagar', s: aPagar ? P.brl0(aPagar) + ' (fornecedores e cartão)' : 'nada pendente', destaque: !!aPagar, k: 'boleto prazo cartao fatura fornecedor' },
        { href: 'calendario', ic: 'calendario', cor: 'laranja', t: 'Calendário', s: 'compras e despesas de cada dia', k: 'dia data compras antigas' },
        { href: 'precos', ic: 'preco', cor: 'roxo', t: 'Preços de compra', s: velhos ? velhos + ' desatualizados' : 'tudo em dia', destaque: !!velhos, k: 'preco insumo atualizar' },
      ]));

      if (dono) {
        const nAl = P.Analise ? P.Analise.contar() : 0;
        const nPend = P.Anotacoes ? P.Anotacoes.abertas().length : 0;
        const nEq = P.Store.all('pessoas').filter(p => p.ativo !== false).length;
        grupos.push(grupo('Gestão', [
          { href: 'fichas', ic: 'fichas', cor: 'roxo', t: 'Fichas técnicas', s: 'margem de cada prato · cadastro', k: 'ficha cmv food cost insumos itens cadastro' },
          { href: 'relatorio', ic: 'relatorio', cor: 'azul', t: 'Relatório detalhado', s: 'vendas, caixa, compras, CSV', k: 'exportar planilha imprimir' },
          { href: 'dia', ic: 'calendario', cor: 'azul', t: 'Dia e período', s: 'tudo de um dia · comparar períodos', k: 'comparar semana mes' },
          { href: 'compras/analise', ic: 'alerta', cor: 'amarelo', t: 'Análise de compras', s: nAl ? nAl + (nAl === 1 ? ' alerta nas compras' : ' alertas nas compras') : 'compras × vendas e pratos', destaque: !!nAl, k: 'alertas preco acima' },
          { href: 'rendimento', ic: 'custos', cor: 'vermelho', t: 'Rendimento', s: P.Rendimento ? P.Rendimento.textoTile() : 'pratos por lote de carne', k: 'lote carne gramas' },
          { href: 'compras/custos', ic: 'custos', cor: 'laranja', t: 'Custos', s: 'comprado × usado pelas vendas', k: 'desperdicio sobra' },
          { href: 'fichas/simular', ic: 'lapis', cor: 'roxo', t: 'Simular', s: 'porção e preço antes de mudar', k: 'simulacao porcao preco' },
          { href: 'fluxo/analise', ic: 'fluxo', cor: 'azul', t: 'Análise do fluxo', s: 'pico e conversão por hora', k: 'conversao hora' },
        ]));
        grupos.push(grupo('Dono', [
          { href: 'anotacoes', ic: 'fiado', cor: 'amarelo', t: 'Pendências', s: nPend ? nPend + ' para confirmar' : 'anotações e lembretes', destaque: !!nPend, k: 'anotacao lembrete' },
          { href: 'equipe', ic: 'usuario', cor: 'verde', t: 'Equipe', s: nEq ? nEq + (nEq === 1 ? ' pessoa' : ' pessoas') + ' · vales, salários, pró-labore' : 'vales, salários e pró-labore', k: 'funcionario vale salario pro-labore retirada' },
          { href: 'caixa', ic: 'caixa', cor: 'azul', t: 'Capital e caixa', s: 'desde a abertura e a montagem', k: 'saldo investimento' },
          { href: 'importar', ic: 'upload', cor: 'cinza', t: 'Importar lançamentos', s: 'relatório ou caderno, com conferência', k: 'json pacote caderno' },
        ]));
      }

      const temaAtual = P.UI.tema();
      grupos.push(grupo('Aparelho', [
        { onClick: () => { P.UI.tema(temaAtual === 'dark' ? 'light' : 'dark'); desenhar(); }, ic: temaAtual === 'dark' ? 'sol' : 'lua', cor: 'cinza',
          t: 'Tema', s: temaAtual === 'dark' ? 'escuro (vinho) · toque para o claro' : 'claro (creme) · toque para o escuro', val: temaAtual === 'dark' ? 'Escuro' : 'Claro', k: 'claro escuro noite dia cor' },
        { href: 'ajustes', ic: 'ajustes', cor: 'cinza', t: dono ? 'Ajustes' : 'Conta', s: dono ? 'custos fixos, metas, pessoas, backup' : 'tema e sincronização', k: 'configuracao pin backup metas' },
        { href: 'ajustes', ic: 'nuvem', cor: 'cinza', t: 'Nuvem', s: !P.Sync.configurado() ? 'dados só neste aparelho' : !P.Sync.conectado() ? 'toque para conectar este aparelho'
          : P.Store.pendentes() ? P.Store.pendentes() + ' pendentes' : ({ online: 'sincronizado', offline: 'sem internet agora', erro: 'erro — ver ajustes', sincronizando: 'sincronizando…' }[P.Sync.estado] || P.Sync.estado),
        destaque: !P.Sync.conectado() && P.Sync.configurado(), k: 'sincronizar supabase internet' },
      ]));

      const achou = grupos.filter(Boolean);
      corpo.append(...achou);
      if (!achou.length) corpo.appendChild(h('div', { class: 'mais-nada' }, 'Nada com "' + filtro + '". Tente outra palavra.'));
      if (!filtro) {
        corpo.appendChild(h('div', { class: 'mais-rodape' }, P.UI.logo(),
          h('small', null, 'Pátio do Pari · Brás · v' + P.VERSAO, h('br'), 'dia operacional vira às 03:00')));
      }
    }

    const u = P.Auth.usuario();
    const dono = P.Auth.isDono();
    view.append(
      u ? h('div', { class: 'mais-conta' },
        h('span', { class: 'avatar grande' + (dono ? ' dono' : '') }, P.UI.iniciais(u.nome)),
        h('div', { class: 'mais-conta-t' }, h('b', null, u.nome), h('small', null, dono ? 'Dono · vê tudo' : 'Operador · telas de registro')),
        h('button', { type: 'button', class: 'btn mini', onClick: () => P.Auth.sair() }, P.UI.icone('sair'), 'Trocar')) : null,
      busca.el, corpo);
    desenhar();
    return { onDados: desenhar };
  }

  P.UI.rota('mais', { titulo: 'Mais', tab: 'mais', render: telaMais });
})();
