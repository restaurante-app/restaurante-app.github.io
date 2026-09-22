/* RELATÓRIO DETALHADO (dono): o que vendeu, a que horas, quanto entrou por
   forma de pagamento, quanto gastou, quanto lucrou, quem tirou item ou
   cancelou conta. Exporta CSV linha a linha. */
(function () {
  'use strict';
  const P = window.P;
  const h = P.UI.h;
  const CANAIS = ['ESPETO', 'SALAO', 'MARMITA'];
  const NOME_CANAL = { ESPETO: 'Espeto', SALAO: 'Salão', MARMITA: 'Marmita' };
  const FORMAS = ['DINHEIRO', 'PIX', 'DEBITO', 'CREDITO', 'FIADO'];

  function diasDoPeriodo(tipo, de, ate) {
    const hoje = P.Dia.hoje();
    if (tipo === 'hoje') return [hoje];
    if (tipo === 'ontem') return [P.Dia.anterior(hoje)];
    if (tipo === 'semana') return P.Dia.ultimos(6, hoje).reverse();
    if (tipo === 'mes') return P.Dia.doMes(P.Dia.mes(hoje), hoje);
    const out = [];
    if (!de || !ate || de > ate) return out;
    let d = de;
    for (let i = 0; i < 400 && d <= ate; i++) { if (P.Dia.semana(d) !== 0) out.push(d); d = P.Dia.somaDias(d, 1); }
    return out;
  }

  function montar(dias) {
    const set = new Set(dias);
    const I = P.Calc.idx();
    const M = P.Mesas;
    const usu = id => { const u = id && P.Store.get('usuarios', id); return u ? u.nome : '—'; };
    const comandas = P.Store.all('comandas').filter(c => set.has(c.dia_operacional) && c.status !== 'ABERTA');
    const fechadas = comandas.filter(c => c.status === 'FECHADA').sort((a, b) => (a.fechada_em < b.fechada_em ? -1 : 1));
    const canceladas = comandas.filter(c => c.status === 'CANCELADA');
    const despesas = P.Store.all('despesas').filter(d => set.has(d.dia_operacional)).sort((a, b) => (a.criado_em < b.criado_em ? -1 : 1));

    const r = {
      dias, fatBruto: 0, desconto: 0, cmv: 0, qtd: 0,
      porItem: new Map(), porHora: new Map(), porCanal: {}, porForma: {}, recebidoFiado: {}, linhasCsv: [],
      fechadas, canceladas, despesas, merc: 0, outras: 0, diasMov: new Set(),
    };
    CANAIS.forEach(k => { r.porCanal[k] = { fat: 0, cmv: 0, contas: 0, totContas: 0 }; });
    FORMAS.forEach(f => { r.porForma[f] = 0; r.recebidoFiado[f] = 0; });

    function addItem(itemId, nome, q, preco, cmvU, canal, hora) {
      const it = I.itens.get(itemId);
      const k = itemId;
      if (!r.porItem.has(k)) r.porItem.set(k, { nome: nome || (it && it.nome) || '?', cat: it ? it.categoria : '', q: 0, fat: 0, cmv: 0 });
      const g = r.porItem.get(k);
      g.q += q; g.fat += q * preco; g.cmv += q * cmvU;
      r.fatBruto += q * preco; r.cmv += q * cmvU; r.qtd += q;
      const c = r.porCanal[canal] || r.porCanal.SALAO;
      c.fat += q * preco; c.cmv += q * cmvU;
      if (hora != null) {
        if (!r.porHora.has(hora)) r.porHora.set(hora, { fat: 0, q: 0 });
        const hh = r.porHora.get(hora);
        hh.fat += q * preco; hh.q += q;
      }
    }
    fechadas.forEach(c => {
      const pags = M.pagamentos(c.id);
      const formas = pags.map(p => P.Mesas.NOME_FORMA[p.forma]).join(' + ');
      pags.forEach(p => { r.porForma[p.forma] = (r.porForma[p.forma] || 0) + (+p.valor || 0); });
      M.linhas(c.id).forEach(l => {
        const q = +l.quantidade || 0;
        addItem(l.item_id, l.nome, q, +l.preco_unit || 0, +l.cmv_unit || 0, c.canal, new Date(l.adicionado_em).getHours());
        const it = I.itens.get(l.item_id);
        r.linhasCsv.push([
          c.dia_operacional, fmtDataHora(l.adicionado_em), c.id.slice(0, 8), P.Mesas.nomeLocal(c), c.cliente || '', NOME_CANAL[c.canal] || c.canal,
          l.nome, it ? P.Fichas.CAT[it.categoria] : '', q, num(l.preco_unit), num(q * l.preco_unit), num(l.cmv_unit, 4), num(q * l.cmv_unit),
          num(q * (l.preco_unit - l.cmv_unit)), formas, usu(l.usuario_id),
        ]);
      });
      const d = +c.desconto || 0;
      r.desconto += d;
      const pc = r.porCanal[c.canal] || r.porCanal.SALAO;
      pc.fat -= d; pc.contas++; pc.totContas += +c.total || 0;
      r.diasMov.add(c.dia_operacional);
    });
    P.Store.all('pagamentos').forEach(p => {
      if (p.forma === 'FIADO' && p.recebido_em && set.has(p.recebido_dia)) r.recebidoFiado[p.recebido_forma] = (r.recebidoFiado[p.recebido_forma] || 0) + (+p.valor || 0);
    });
    despesas.forEach(d => { if (d.categoria === 'MERCADORIA') r.merc += +d.valor || 0; else r.outras += +d.valor || 0; });
    // compras de mercadoria: feitas no período (custo) e pagas no período (caixa)
    r.compras = P.Store.all('compras').filter(c => set.has(c.dia_operacional)).sort((a, b) => (a.criado_em < b.criado_em ? -1 : 1));
    r.comprasTotal = r.compras.reduce((s, c) => s + (+c.total || 0), 0);
    r.comprasPagas = P.Store.all('compras').filter(c => c.pago_em && set.has(c.pago_dia)).reduce((s, c) => s + (+c.total || 0), 0);
    r.comprasAPrazo = r.compras.filter(c => c.forma === 'PRAZO' && !c.pago_em).reduce((s, c) => s + (+c.total || 0), 0);
    r.porInsumo = new Map();
    r.compras.forEach(c => P.Compras.itensDe(c.id).forEach(l => {
      const k = l.insumo_id || 'avulso:' + P.UI.semAcento(l.descricao);
      if (!r.porInsumo.has(k)) r.porInsumo.set(k, { nome: l.descricao, un: l.unidade, q: 0, v: 0 });
      const g = r.porInsumo.get(k);
      g.q += +l.quantidade || 0; g.v += +l.valor || 0;
    }));

    // controle: itens tirados e contas canceladas
    const idsPer = new Set(comandas.map(c => c.id));
    const porComanda = new Map(comandas.map(c => [c.id, c]));
    r.tirados = P.Store.todos('comanda_itens').filter(l => idsPer.has(l.comanda_id) && +l.removidos > 0)
      .map(l => ({ l, c: porComanda.get(l.comanda_id), quem: usu(l.removido_por), valor: (+l.removidos || 0) * (+l.preco_unit || 0) }));
    r.canceladasValor = canceladas.map(c => ({ c, quem: usu(c.cancelada_por), valor: M.subtotal(c.id) }));

    r.fat = r.fatBruto - r.desconto;
    r.fixo = P.Painel.fixoMensal() / P.Painel.diasMes() * r.diasMov.size;
    r.lucroBruto = r.fat - r.cmv;
    r.lucro = r.lucroBruto - r.outras - r.fixo;
    r.entradas = ['DINHEIRO', 'PIX', 'DEBITO', 'CREDITO'].reduce((s, f) => s + r.porForma[f] + (r.recebidoFiado[f] || 0), 0);
    r.saidas = r.comprasPagas + r.merc + r.outras;
    r.gastoMercadoria = r.comprasTotal + r.merc;
    r.ticket = fechadas.length ? fechadas.reduce((s, c) => s + (+c.total || 0), 0) / fechadas.length : null;
    r.fiadoEmAberto = P.Mesas.fiadoAberto().reduce((s, p) => s + (+p.valor || 0), 0);
    return r;
  }
  const num = (v, casas) => P.num(+v || 0, casas == null ? 2 : casas);
  function fmtDataHora(iso) {
    const d = new Date(iso);
    const p = n => String(n).padStart(2, '0');
    return p(d.getDate()) + '/' + p(d.getMonth() + 1) + '/' + d.getFullYear() + ' ' + p(d.getHours()) + ':' + p(d.getMinutes());
  }
  function csv(cab, linhas) {
    const esc = v => { const s = String(v == null ? '' : v); return /[;"\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
    return '\uFEFF' + [cab].concat(linhas).map(l => l.map(esc).join(';')).join('\r\n');
  }

  function telaRelatorio(view) {
    view.className = 'v-relatorio';
    let tipo = 'hoje';
    let de = P.Dia.somaDias(P.Dia.hoje(), -6), ate = P.Dia.hoje();
    let ordem = 'fat';
    let verTodas = false;
    const corpo = h('div');
    const datas = h('div', { class: 'rl-datas' });
    const inDe = h('input', { type: 'date', class: 'campo', value: de });
    const inAte = h('input', { type: 'date', class: 'campo', value: ate });
    inDe.addEventListener('change', () => { de = inDe.value; desenhar(); });
    inAte.addEventListener('change', () => { ate = inAte.value; desenhar(); });
    datas.append(h('span', null, 'de'), inDe, h('span', null, 'até'), inAte);

    const linhaV = (rot, val, cls) => h('div', { class: 'rl-l' + (cls ? ' ' + cls : '') }, h('span', null, rot), h('b', null, val));
    const kpi = (rot, val, sub, cor) => h('div', { class: 'kpi' }, h('div', { class: 'kpi-rot' }, rot), h('div', { class: 'kpi-val' + (cor ? ' t-' + cor : '') }, val), sub ? h('div', { class: 'kpi-sub' }, sub) : null);
    const secao = (t, ...kids) => h('section', { class: 'rl-sec' }, h('div', { class: 'secao' }, t), kids);

    function desenhar() {
      datas.hidden = tipo !== 'datas';
      const dias = diasDoPeriodo(tipo, de, ate);
      const r = montar(dias);
      corpo.innerHTML = '';
      corpo.appendChild(h('div', { class: 'an-base' }, dias.length
        ? (dias.length === 1 ? P.Dia.rotulo(dias[0]) : P.Dia.rotuloCurto(dias[0]) + ' a ' + P.Dia.rotuloCurto(dias[dias.length - 1])) + ' · ' + r.diasMov.size + (r.diasMov.size === 1 ? ' dia com venda' : ' dias com venda')
        : 'Escolha um período válido.'));
      if (!r.fechadas.length && !r.porItem.size && !r.despesas.length && !r.canceladas.length && !r.compras.length) {
        corpo.appendChild(P.UI.vazio('Nada registrado neste período.', 'relatorio'));
        return;
      }
      const margem = r.fat > 0 ? r.lucro / r.fat * 100 : null;
      corpo.appendChild(h('div', { class: 'rl-kpis' },
        kpi('Faturamento', P.brl(r.fat), P.num(r.qtd) + ' itens'),
        kpi(r.lucro >= 0 ? 'Lucro' : 'Prejuízo', P.brl(r.lucro), 'margem ' + P.pct(margem, 1), r.lucro >= 0 ? 'verde' : 'vermelho'),
        kpi('Custo do vendido', P.brl(r.cmv), P.pct(r.fat ? r.cmv / r.fat * 100 : null, 1) + ' das vendas (fichas)'),
        kpi('Compras', P.brl(r.gastoMercadoria), P.pct(r.fat ? r.gastoMercadoria / r.fat * 100 : null, 0) + ' das vendas · real'),
        kpi('Contas fechadas', String(r.fechadas.length), 'ticket ' + (r.ticket == null ? '—' : P.brl(r.ticket))),
        kpi('Fiado em aberto', P.brl(r.fiadoEmAberto), 'total de todos os dias', r.fiadoEmAberto > 0 ? 'amarelo' : null)));

      corpo.appendChild(secao('Resultado',
        linhaV('Faturamento bruto (itens)', P.brl(r.fatBruto)),
        r.desconto ? linhaV('(−) Descontos', P.brl(r.desconto)) : null,
        linhaV('= Faturamento líquido', P.brl(r.fat), 'forte'),
        linhaV('(−) Custo do que foi vendido (fichas)', P.brl(r.cmv)),
        linhaV('= Lucro bruto', P.brl(r.lucroBruto), 'forte'),
        linhaV('(−) Despesas (gás, embalagem, limpeza…)', P.brl(r.outras)),
        linhaV('(−) Custo fixo rateado (' + r.diasMov.size + (r.diasMov.size === 1 ? ' dia' : ' dias') + ')', P.brl(r.fixo)),
        linhaV(r.lucro >= 0 ? '= Lucro' : '= Prejuízo', P.brl(r.lucro), 'total ' + (r.lucro >= 0 ? 't-verde' : 't-vermelho')),
        r.gastoMercadoria ? linhaV('Compras × custo do vendido: ' + (r.gastoMercadoria - r.cmv >= 0 ? 'comprou ' + P.brl(r.gastoMercadoria - r.cmv) + ' a mais (estoque ou perda)' : 'usou ' + P.brl(r.cmv - r.gastoMercadoria) + ' de estoque'), '', 'nota') : null));

      corpo.appendChild(secao('Caixa (dinheiro que entrou e saiu)',
        ['DINHEIRO', 'PIX', 'DEBITO', 'CREDITO'].map(f => linhaV(P.Mesas.NOME_FORMA[f], P.brl(r.porForma[f]) + (r.recebidoFiado[f] ? ' + ' + P.brl(r.recebidoFiado[f]) + ' de fiado' : ''))),
        linhaV('= Entradas', P.brl(r.entradas), 'forte'),
        linhaV('(−) Compras pagas', P.brl(r.comprasPagas + r.merc)),
        linhaV('(−) Despesas', P.brl(r.outras)),
        linhaV('= Saldo de caixa do período', P.brl(r.entradas - r.saidas), 'total ' + (r.entradas - r.saidas >= 0 ? 't-verde' : 't-vermelho')),
        r.porForma.FIADO ? linhaV('Vendido no fiado neste período (a receber)', P.brl(r.porForma.FIADO), 'aviso') : null,
        r.comprasAPrazo ? linhaV('Comprado a prazo neste período (a pagar)', P.brl(r.comprasAPrazo), 'aviso') : null));

      corpo.appendChild(secao('Por canal',
        P.UI.pilha(['SALAO', 'ESPETO', 'MARMITA'].map(k => ({ rotulo: NOME_CANAL[k], valor: r.porCanal[k].fat, serie: k.toLowerCase() })), P.brl0),
        h('div', { class: 'rl-tab' },
          h('div', { class: 'rl-tr th' }, h('span', null, 'Canal'), h('span', null, 'Faturamento'), h('span', null, 'CMV'), h('span', null, 'Contas'), h('span', null, 'Ticket')),
          ['SALAO', 'ESPETO', 'MARMITA'].map(k => { const c = r.porCanal[k]; return h('div', { class: 'rl-tr' },
            h('span', null, h('i', { class: 'leg-dot serie-' + k.toLowerCase() }), NOME_CANAL[k]), h('span', null, P.brl0(c.fat)), h('span', null, P.pct(c.fat ? c.cmv / c.fat * 100 : null, 0)),
            h('span', null, c.contas), h('span', null, c.contas ? P.brl(c.totContas / c.contas) : '—')); }))));

      if (r.porHora.size) {
        const horas = [...r.porHora.keys()].sort((a, b) => P.Dia.ordemFaixa(a) - P.Dia.ordemFaixa(b));
        const pico = horas.reduce((a, x) => (r.porHora.get(x).fat > r.porHora.get(a).fat ? x : a), horas[0]);
        const hh = x => String(x).padStart(2, '0') + 'h';
        corpo.appendChild(secao('Vendas por hora (quando o item foi pedido)',
          h('div', { class: 'rl-cols' },
            P.UI.colunas(horas.map(x => ({ rotulo: hh(x), curto: hh(x), valor: r.porHora.get(x).fat, atual: x === pico })), P.brl0,
              { largura: 320, altura: 84, aria: 'Vendas por hora: ' + horas.map(x => hh(x) + ' ' + P.brl0(r.porHora.get(x).fat)).join(', ') }),
            h('div', { class: 'rl-pico' }, 'Pico às ', h('b', null, hh(pico)), ' · ', h('b', null, P.brl0(r.porHora.get(pico).fat)), ' · ' + P.num(r.porHora.get(pico).q) + ' itens')),
          h('div', { class: 'rl-tab' },
            h('div', { class: 'rl-tr rl-tr4 th' }, h('span', null, 'Hora'), h('span', null, 'Faturamento'), h('span', null, 'Itens'), h('span', null, '% do total')),
            horas.map(x => { const v = r.porHora.get(x); return h('div', { class: 'rl-tr rl-tr4' + (x === pico ? ' pico' : '') },
              h('span', null, hh(x)), h('span', null, P.brl0(v.fat)), h('span', null, P.num(v.q)),
              h('span', null, P.pct(r.fatBruto ? v.fat / r.fatBruto * 100 : null, 0))); }))));
      }

      const itens = [...r.porItem.values()].map(g => Object.assign(g, { margem: g.fat - g.cmv, fc: g.fat ? g.cmv / g.fat * 100 : null }));
      itens.sort((a, b) => (ordem === 'q' ? b.q - a.q : ordem === 'margem' ? b.margem - a.margem : b.fat - a.fat));
      corpo.appendChild(secao('O que foi vendido',
        P.UI.seg([{ v: 'fat', rotulo: 'Faturamento' }, { v: 'q', rotulo: 'Quantidade' }, { v: 'margem', rotulo: 'Margem' }], ordem, v => { ordem = v; desenhar(); }, 'seg-p'),
        h('div', { class: 'rl-tab' },
          h('div', { class: 'rl-tr th' }, h('span', null, 'Item'), h('span', null, 'Qtd'), h('span', null, 'Faturamento'), h('span', null, 'Margem'), h('span', null, 'FC')),
          itens.map(g => h('div', { class: 'rl-tr' },
            h('span', null, g.nome), h('span', null, P.num(g.q)), h('span', null, P.brl0(g.fat)), h('span', null, P.brl0(g.margem)),
            h('span', { class: 't-' + P.Calc.faixa(g.fc) }, P.pct(g.fc, 0)))))));

      if (r.fechadas.length) {
        const lista = r.fechadas.slice().reverse();
        const mostrar = verTodas ? lista : lista.slice(0, 40);
        corpo.appendChild(secao('Contas (' + lista.length + ')',
          h('div', { class: 'ms-lista' }, mostrar.map(c => h('a', { class: 'ms-card', href: '#/mesas/c/' + c.id },
            h('div', { class: 'ms-card-n' }, P.Mesas.rotulo(c),
              h('small', null, (dias.length > 1 ? P.Dia.rotuloCurto(c.dia_operacional) + ' · ' : '') + P.Dia.hora(c.aberta_em) + '–' + P.Dia.hora(c.fechada_em) + ' · ' + NOME_CANAL[c.canal] + ' · ' +
                P.Mesas.pagamentos(c.id).map(p => P.Mesas.NOME_FORMA[p.forma]).join(' + '))),
            h('b', null, P.brl(c.total))))),
          lista.length > mostrar.length ? h('button', { type: 'button', class: 'btn bloco', onClick: () => { verTodas = true; desenhar(); } }, 'Mostrar todas as ' + lista.length) : null));
      }

      if (r.compras.length) {
        const ins = [...r.porInsumo.values()].sort((a, b) => b.v - a.v);
        corpo.appendChild(secao('Compras (' + r.compras.length + ') · ' + P.brl(r.comprasTotal),
          h('div', { class: 'rl-tab' },
            h('div', { class: 'rl-tr th rl-tr3' }, h('span', null, 'Insumo'), h('span', null, 'Qtd'), h('span', null, 'Valor')),
            ins.map(g => h('div', { class: 'rl-tr rl-tr3' }, h('span', null, g.nome), h('span', null, P.numAuto(g.q, 2) + ' ' + g.un), h('span', null, P.brl(g.v))))),
          h('div', { class: 'ms-lista' }, r.compras.slice().reverse().map(c => h('a', { class: 'ms-card', href: '#/compras/c/' + c.id },
            h('div', { class: 'ms-card-n' }, c.fornecedor || 'Compra',
              h('small', null, (dias.length > 1 ? P.Dia.rotuloCurto(c.dia_operacional) + ' · ' : '') + P.Dia.hora(c.criado_em) + ' · ' + (P.Compras.NOME_FORMA[c.forma] || c.forma) + (c.forma === 'PRAZO' && !c.pago_em ? ' (a pagar)' : ''))),
            h('b', null, P.brl(c.total)))))));
      }

      if (r.despesas.length) {
        corpo.appendChild(secao('Despesas',
          h('div', { class: 'ms-lista' }, r.despesas.map(d => h('div', { class: 'ms-card' },
            h('div', { class: 'ms-card-n' }, d.descricao || P.Mesas.NOME_DESP[d.categoria],
              h('small', null, (dias.length > 1 ? P.Dia.rotuloCurto(d.dia_operacional) + ' · ' : '') + P.Dia.hora(d.criado_em) + ' · ' + P.Mesas.NOME_DESP[d.categoria])),
            h('b', null, P.brl(d.valor)))))));
      }

      const totTir = r.tirados.reduce((s, x) => s + x.valor, 0);
      const totCan = r.canceladasValor.reduce((s, x) => s + x.valor, 0);
      corpo.appendChild(secao('Controle (itens tirados e contas canceladas)',
        linhaV('Itens tirados de comandas', r.tirados.reduce((s, x) => s + (+x.l.removidos || 0), 0) + ' un. · ' + P.brl(totTir), totTir ? 'aviso' : null),
        r.tirados.map(x => h('div', { class: 'rl-ctrl' }, P.Dia.hora(x.l.removido_em) + ' · ' + x.l.removidos + '× ' + x.l.nome + ' — ' + (x.c ? P.Mesas.rotulo(x.c) : '') + ' · por ' + x.quem)),
        linhaV('Contas canceladas', r.canceladas.length + ' · ' + P.brl(totCan), totCan ? 'aviso' : null),
        r.canceladasValor.map(x => h('div', { class: 'rl-ctrl' }, P.Dia.hora(x.c.fechada_em) + ' · ' + P.Mesas.rotulo(x.c) + ' · ' + P.brl(x.valor) + ' · por ' + x.quem))));

      const nomeArq = (dias[0] || '') + (dias.length > 1 ? '_a_' + dias[dias.length - 1] : '');
      corpo.appendChild(secao('Exportar (abre no Excel)',
        h('div', { class: 'rl-exp' },
          h('button', { type: 'button', class: 'btn', onClick: () => {
            P.UI.baixar('vendas_itens_' + nomeArq + '.csv', csv(['dia_operacional', 'data_hora', 'conta', 'local', 'cliente', 'canal', 'item', 'categoria', 'quantidade', 'preco_unit', 'total', 'cmv_unit', 'cmv_total', 'margem', 'forma_pagamento', 'atendente'], r.linhasCsv), 'text/csv;charset=utf-8');
          } }, P.UI.icone('download'), 'Itens vendidos'),
          h('button', { type: 'button', class: 'btn', onClick: () => {
            P.UI.baixar('contas_' + nomeArq + '.csv', csv(['dia_operacional', 'aberta', 'fechada', 'status', 'local', 'cliente', 'canal', 'itens', 'desconto', 'total', 'formas'],
              r.fechadas.concat(r.canceladas).map(c => [c.dia_operacional, fmtDataHora(c.aberta_em), c.fechada_em ? fmtDataHora(c.fechada_em) : '', c.status, P.Mesas.nomeLocal(c), c.cliente || '', NOME_CANAL[c.canal],
                P.Mesas.linhas(c.id).reduce((s, l) => s + (+l.quantidade || 0), 0), num(c.desconto), num(c.total),
                P.Mesas.pagamentos(c.id).map(p => P.Mesas.NOME_FORMA[p.forma] + ' ' + num(p.valor)).join(' + ')])), 'text/csv;charset=utf-8');
          } }, P.UI.icone('download'), 'Contas'),
          h('button', { type: 'button', class: 'btn', onClick: () => {
            const linhas = [];
            r.compras.forEach(c => P.Compras.itensDe(c.id).forEach(l => linhas.push([c.dia_operacional, fmtDataHora(c.criado_em), 'Compra', c.fornecedor || '',
              l.descricao, num(l.quantidade, 3), l.unidade, num(l.preco_unit, 4), num(l.valor), P.Compras.NOME_FORMA[c.forma] || c.forma, c.pago_em ? 'sim' : 'não'])));
            r.despesas.forEach(d => linhas.push([d.dia_operacional, fmtDataHora(d.criado_em), 'Despesa · ' + P.Mesas.NOME_DESP[d.categoria], '', d.descricao || '', '', '', '', num(d.valor), '', 'sim']));
            P.UI.baixar('gastos_' + nomeArq + '.csv', csv(['dia_operacional', 'data_hora', 'tipo', 'fornecedor', 'item', 'quantidade', 'unidade', 'preco_unit', 'valor', 'forma', 'pago'], linhas), 'text/csv;charset=utf-8');
          } }, P.UI.icone('download'), 'Compras e gastos'),
          h('button', { type: 'button', class: 'btn', onClick: () => window.print() }, 'Imprimir'))));
    }

    view.append(
      P.Painel.subnavPainel('relatorio'),
      P.UI.seg([{ v: 'hoje', rotulo: 'Hoje' }, { v: 'ontem', rotulo: 'Ontem' }, { v: 'semana', rotulo: 'Semana' }, { v: 'mes', rotulo: 'Mês' }, { v: 'datas', rotulo: 'Datas' }], tipo, v => { tipo = v; verTodas = false; desenhar(); }, 'seg-p'),
      datas, corpo);
    desenhar();
    return { onDados: desenhar };
  }

  P.UI.rota('relatorio', { titulo: 'Relatório', tab: 'painel', dono: true, render: telaRelatorio });
  P.Relatorio = { montar, diasDoPeriodo };
})();
