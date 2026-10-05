/* CAPITAL E CAIXA (dono) — o dinheiro desde a abertura e o que foi investido antes.
   - Caixa desde a abertura: vendas recebidas − compras pagas − despesas (por tipo)
     − retiradas do dono − investimentos = saldo das operações; e o que ainda vai
     sair (a pagar: fornecedores e fatura do cartão) e entrar (fiado).
   - Montagem: compras, despesas e investimentos de antes da abertura (capital usado).
   A data de abertura fica em Ajustes → Custos fixos (ou aqui). */
(function () {
  'use strict';
  const P = window.P;
  const h = P.UI.h;

  function dias(de, ate) {
    const out = [];
    let d = de;
    for (let i = 0; i < 800 && d <= ate; i++) { if (P.Dia.semana(d) !== 0) out.push(d); d = P.Dia.somaDias(d, 1); }
    return out;
  }
  // movimento de caixa num conjunto de dias
  function caixa(set) {
    const r = { vendas: 0, porForma: {}, compras: 0, desp: {}, despTotal: 0 };
    P.Store.all('pagamentos').forEach(p => {
      const v = +p.valor || 0;
      if (p.forma !== 'FIADO' && set.has(p.dia_operacional)) { r.vendas += v; r.porForma[p.forma] = (r.porForma[p.forma] || 0) + v; }
      if (p.forma === 'FIADO' && p.recebido_em && set.has(p.recebido_dia)) { r.vendas += v; r.porForma['FIADO_REC'] = (r.porForma['FIADO_REC'] || 0) + v; }
    });
    P.Store.all('compras').forEach(c => P.Compras.saidas(c).forEach(s => { if (set.has(s.dia)) r.compras += s.valor; }));
    P.Store.all('despesas').forEach(d => {
      if (!set.has(d.dia_operacional)) return;
      r.desp[d.categoria] = (r.desp[d.categoria] || 0) + (+d.valor || 0);
      r.despTotal += +d.valor || 0;
    });
    r.saldo = r.vendas - r.compras - r.despTotal;
    return r;
  }
  // tudo de antes da abertura (compras pelo dia da compra, despesas pelo dia)
  function montagem(abertura) {
    const r = { compras: [], despesas: [], totCompras: 0, totDesp: 0, porCat: {} };
    P.Store.all('compras').forEach(c => { if (c.dia_operacional < abertura) { r.compras.push(c); r.totCompras += +c.total || 0; } });
    P.Store.all('despesas').forEach(d => {
      if (d.dia_operacional >= abertura) return;
      r.despesas.push(d); r.totDesp += +d.valor || 0;
      r.porCat[d.categoria] = (r.porCat[d.categoria] || 0) + (+d.valor || 0);
    });
    r.compras.sort((a, b) => (a.dia_operacional < b.dia_operacional ? -1 : 1));
    r.total = r.totCompras + r.totDesp;
    return r;
  }

  function telaCaixa(view) {
    view.className = 'v-relatorio v-caixa';
    const corpo = h('div');
    const linhaV = (rot, val, cls) => h('div', { class: 'rl-l' + (cls ? ' ' + cls : '') }, h('span', null, rot), h('b', null, val));
    const secao = (t, ...kids) => h('section', { class: 'rl-sec' }, h('div', { class: 'secao' }, t), kids);
    function escolherAbertura() {
      P.Compras.calendario(P.cfg('operacao').abertura || P.Dia.hoje(), iso => { const o = P.cfg('operacao'); o.abertura = iso; P.salvarCfg('operacao', o); desenhar(); }, { titulo: 'Dia em que o restaurante abriu' });
    }
    function desenhar() {
      corpo.innerHTML = '';
      const ab = P.cfg('operacao').abertura;
      const hoje = P.Dia.hoje();
      if (!ab) {
        corpo.appendChild(P.UI.vazio('Diga o dia em que o restaurante abriu: o que foi gasto antes vira o capital de montagem, e o caixa passa a contar a partir dele.', 'calendario'));
        corpo.appendChild(h('button', { type: 'button', class: 'btn primario bloco', onClick: escolherAbertura }, P.UI.icone('calendario'), 'Escolher o dia da abertura'));
        return;
      }
      const ds = dias(ab, hoje);
      const cx = caixa(new Set(ds));
      const NOME = P.Mesas.NOME_DESP;
      const d = cx.desp;
      const grupos = [
        ['Equipe (salários, vales, condução)', d.FUNCIONARIOS],
        ['Retiradas do dono (pró-labore)', d.PROLABORE],
        ['Gás / carvão', d.GAS_CARVAO],
        ['Aluguel, contas e impostos', (d.ALUGUEL || 0) + (d.CONTAS || 0) + (d.IMPOSTOS || 0)],
        ['Investimentos (equipamento, obra)', d.INVESTIMENTO],
        ['Outras despesas (' + ['EMBALAGEM', 'LIMPEZA', 'MANUTENCAO', 'MERCADORIA', 'OUTROS'].filter(k => d[k]).map(k => NOME[k].toLowerCase()).join(', ') + ')',
          ['EMBALAGEM', 'LIMPEZA', 'MANUTENCAO', 'MERCADORIA', 'OUTROS'].reduce((s, k) => s + (d[k] || 0), 0)],
      ].filter(g => g[1] > 0.004);
      const contas = P.Compras.contasAPagar();
      const aPagar = contas.reduce((s, g) => s + g.total, 0);
      const fiado = P.Mesas.fiadoAberto().reduce((s, p) => s + (+p.valor || 0), 0);
      corpo.appendChild(h('div', { class: 'an-base' }, 'Abriu em ' + P.Dia.rotulo(ab) + '/' + ab.slice(0, 4) + ' · ', h('button', { type: 'button', class: 'cp-link', onClick: escolherAbertura }, 'trocar')));
      const formas = Object.keys(cx.porForma).map(f => (f === 'FIADO_REC' ? 'fiado recebido' : (P.Mesas.NOME_FORMA[f] || f).toLowerCase()) + ' ' + P.brl0(cx.porForma[f])).join(' · ');
      corpo.appendChild(secao('Caixa desde a abertura',
        linhaV('Vendas recebidas' + (formas ? ' (' + formas + ')' : ''), P.brl(cx.vendas)),
        linhaV('(−) Compras pagas', P.brl(cx.compras)),
        grupos.map(g => linhaV('(−) ' + g[0], P.brl(g[1]))),
        linhaV('= Saldo das operações', P.brl(cx.saldo), 'total ' + (cx.saldo >= 0 ? 't-verde' : 't-vermelho')),
        aPagar ? linhaV('(−) Ainda a pagar (fornecedores e cartão)', P.brl(aPagar), 'aviso') : null,
        fiado ? linhaV('(+) Fiado a receber', P.brl(fiado), 'aviso') : null,
        aPagar || fiado ? linhaV('= Depois de pagar e receber o que está em aberto', P.brl(cx.saldo - aPagar + fiado), 'forte') : null,
        h('div', { class: 'dica' }, 'Saldo negativo = parte do que foi pago saiu do capital de giro (dinheiro posto pelo dono), não das vendas.')));
      if (contas.length) {
        corpo.appendChild(secao('A pagar',
          contas.map(g => h('a', { class: 'rl-l link', href: '#/compras/pagar' }, h('span', null, g.nome, g.venceMin ? h('small', null, ' · ' + P.Compras.quandoVence(g.venceMin)) : null), h('b', null, P.brl(g.total))))));
      }
      const m = montagem(ab);
      corpo.appendChild(secao('Montagem (antes de ' + P.Dia.rotuloCurto(ab) + ')',
        m.total ? [
          linhaV('Compras (' + m.compras.length + ')', P.brl(m.totCompras)),
          Object.keys(m.porCat).map(k => linhaV(NOME[k] || k, P.brl(m.porCat[k]))),
          linhaV('= Capital usado antes da abertura', P.brl(m.total), 'total'),
          h('div', { class: 'ms-lista' },
            m.compras.map(c => h('a', { class: 'ms-card', href: '#/compras/c/' + c.id },
              h('div', { class: 'ms-card-n' }, c.fornecedor || 'Compra', h('small', null, P.Dia.rotulo(c.dia_operacional))), h('b', null, P.brl(c.total)))),
            m.despesas.map(x => h('div', { class: 'ms-card' },
              h('div', { class: 'ms-card-n' }, x.descricao || NOME[x.categoria], h('small', null, P.Dia.rotulo(x.dia_operacional) + ' · ' + P.Mesas.subDesp(x))), h('b', null, P.brl(x.valor))))),
        ] : h('div', { class: 'dica' }, 'Nada lançado antes da abertura.')));
    }
    view.append(corpo);
    desenhar();
    return { onDados: desenhar };
  }

  P.UI.rota('caixa', { titulo: 'Capital e caixa', tab: 'mais', dono: true, render: telaCaixa });
  P.Caixa = { caixa, montagem, dias };
})();
