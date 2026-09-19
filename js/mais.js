/* MAIS — tudo do app num lugar só, com um número ao vivo em cada atalho. */
(function () {
  'use strict';
  const P = window.P;
  const h = P.UI.h;

  function telaMais(view) {
    view.className = 'v-mais';
    const corpo = h('div');
    const tile = (href, ic, cor, tit, sub, destaque) => h('a', { class: 'tile c-' + cor, href: '#/' + href },
      h('span', { class: 'tile-ic' }, P.UI.icone(ic)),
      h('span', { class: 'tile-t' }, tit),
      h('span', { class: 'tile-s' + (destaque ? ' ' + destaque : '') }, sub));
    const grupo = (t, ...tiles) => h('section', { class: 'mais-g' }, h('div', { class: 'secao' }, t), h('div', { class: 'tiles' }, tiles));

    function desenhar() {
      corpo.innerHTML = '';
      const u = P.Auth.usuario();
      if (!u) return;
      const dono = P.Auth.isDono();
      const hoje = P.Dia.hoje();

      const tot = P.Mesas.totaisDoDia(hoje, 'TODOS');
      const fechadas = tot.nFechadas;
      const fiado = P.Mesas.fiadoAberto().reduce((s, p) => s + (+p.valor || 0), 0);
      const aPagar = P.Compras.aPagar().reduce((s, c) => s + (+c.total || 0), 0);
      const despHoje = P.Store.all('despesas').filter(d => d.dia_operacional === hoje).reduce((s, d) => s + (+d.valor || 0), 0);
      const velhos = P.Store.all('insumos').filter(P.Calc.precoVelho).length;
      const passou = P.Fluxo.totais('PASSOU').dia;

      corpo.appendChild(h('div', { class: 'mais-conta' },
        h('span', { class: 'avatar grande' + (dono ? ' dono' : '') }, P.UI.iniciais(u.nome)),
        h('div', { class: 'mais-conta-t' }, h('b', null, u.nome), h('small', null, dono ? 'Dono · vê tudo' : 'Operador · telas de registro')),
        h('button', { type: 'button', class: 'btn mini', onClick: () => P.Auth.sair() }, P.UI.icone('sair'), 'Trocar')));

      corpo.appendChild(grupo('Operação',
        tile('fluxo', 'fluxo', 'azul', 'Fluxo', 'contador · ' + P.num(passou) + ' passaram hoje'),
        tile('mesas/totais', 'relatorio', 'verde', 'Totais do dia', P.brl0(tot.fechado) + ' vendido'),
        tile('mesas/hoje', 'check', 'verde', 'Contas fechadas', fechadas + (fechadas === 1 ? ' hoje' : ' hoje')),
        tile('mesas/fiado', 'fiado', 'vermelho', 'Fiado', fiado ? P.brl0(fiado) + ' a receber' : 'ninguém devendo', fiado ? 't-amarelo' : null),
        tile('mesas/despesas', 'caixa', 'laranja', 'Despesas', despHoje ? P.brl0(despHoje) + ' hoje' : 'gás, carvão, embalagem'),
        tile('compras/pagar', 'prazo', 'amarelo', 'A pagar', aPagar ? P.brl0(aPagar) + ' a fornecedores' : 'nada pendente', aPagar ? 't-amarelo' : null),
        tile('precos', 'preco', 'roxo', 'Preços de compra', velhos ? velhos + ' desatualizados' : 'tudo em dia', velhos ? 't-amarelo' : null)));

      if (dono) {
        corpo.appendChild(grupo('Gestão',
          tile('painel', 'painel', 'verde', 'Painel', 'lucro do dia, semana e mês'),
          tile('relatorio', 'relatorio', 'azul', 'Relatório detalhado', 'vendas, caixa, compras, CSV'),
          tile('compras/custos', 'custos', 'laranja', 'Custos', 'comprado × usado pelas vendas'),
          tile('fichas', 'fichas', 'roxo', 'Fichas técnicas', 'margem de cada prato'),
          tile('fichas/simular', 'lapis', 'roxo', 'Simular', 'porção e preço antes de mudar'),
          tile('fluxo/analise', 'fluxo', 'azul', 'Análise do fluxo', 'pico e conversão por hora')));
      }

      const temaAtual = P.UI.tema();
      corpo.appendChild(grupo('Aparelho',
        h('button', { type: 'button', class: 'tile c-cinza', onClick: () => { P.UI.tema(temaAtual === 'dark' ? 'light' : 'dark'); desenhar(); } },
          h('span', { class: 'tile-ic' }, P.UI.icone(temaAtual === 'dark' ? 'sol' : 'lua')),
          h('span', { class: 'tile-t' }, temaAtual === 'dark' ? 'Tema claro' : 'Tema escuro'),
          h('span', { class: 'tile-s' }, 'para usar de dia ou de noite')),
        tile('ajustes', 'ajustes', 'cinza', dono ? 'Ajustes' : 'Conta', dono ? 'custos fixos, metas, pessoas, backup' : 'tema e sincronização'),
        tile('ajustes', 'nuvem', 'cinza', 'Sincronização', !P.Sync.configurado() ? 'dados só neste aparelho' : P.Store.pendentes() ? P.Store.pendentes() + ' pendentes' : P.Sync.estado)));

      corpo.appendChild(h('div', { class: 'aj-rodape' }, 'Pátio do Pari · Restaurante · v' + P.VERSAO + ' · dia operacional vira às 03:00'));
    }
    view.append(corpo);
    desenhar();
    return { onDados: desenhar };
  }

  P.UI.rota('mais', { titulo: 'Mais', tab: 'mais', render: telaMais });
})();
