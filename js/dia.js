/* DIA E PERÍODO (só o dono) — tocar num dia do calendário e ver tudo dele, ou escolher
   de um dia até outro e comparar com um segundo período qualquer.
   Só lê o que já está lançado (as contas são as do Relatório: P.Relatorio.montar). */
(function () {
  'use strict';
  const P = window.P;
  const h = P.UI.h;

  const linhaV = (rot, val, cls) => h('div', { class: 'rl-l' + (cls ? ' ' + cls : '') }, h('span', null, rot), h('b', null, val));
  const secao = (t, ...kids) => h('section', { class: 'rl-sec' }, h('div', { class: 'secao' }, t), kids);
  const kpi = (rot, val, sub, cor) => h('div', { class: 'kpi' }, h('div', { class: 'kpi-rot' }, rot), h('div', { class: 'kpi-val' + (cor ? ' t-' + cor : '') }, val), sub ? h('div', { class: 'kpi-sub' }, sub) : null);
  // troca o conteúdo ignorando partes opcionais vazias (null/false viraria o texto "null")
  const trocar = (el, ...k) => el.replaceChildren(...k.flat(Infinity).filter(x => x != null && x !== false));

  function subnavDia(ativo) {
    return P.UI.subnav([{ id: 'dia', rota: 'dia', rotulo: 'Dia' }, { id: 'periodo', rota: 'periodo', rotulo: 'Período' }], ativo);
  }

  // ---------------------------------------------------------------
  //  Tudo de um conjunto de dias (vendas, itens, compras, despesas, equipe, caixa, fiado, gás)
  // ---------------------------------------------------------------
  function resumo(dias) {
    const r = P.Relatorio.montar(dias);
    const set = new Set(dias);
    const de = dias[0], ate = dias[dias.length - 1];
    // "venda do dia sem detalhe" (diferença do caixa sem anotação): entra nas vendas, não nos pratos nem nas bebidas
    const itens = [...r.porItem.entries()].map(([id, g]) => ({ id, nome: g.nome, cat: g.cat, q: g.q, fat: g.fat })).filter(g => g.id !== 'it_venda_resumo');
    r.semDetalhe = r.porItem.has('it_venda_resumo') ? r.porItem.get('it_venda_resumo').fat : 0;
    r.comida = itens.filter(g => g.cat !== 'BEBIDA').sort((a, b) => b.q - a.q || b.fat - a.fat);
    r.bebidas = itens.filter(g => g.cat === 'BEBIDA').sort((a, b) => b.q - a.q || b.fat - a.fat);
    r.qComida = r.comida.reduce((s, g) => s + g.q, 0);
    r.qBebidas = r.bebidas.reduce((s, g) => s + g.q, 0);
    r.fatComida = r.comida.reduce((s, g) => s + g.fat, 0);
    r.fatBebidas = r.bebidas.reduce((s, g) => s + g.fat, 0);
    // equipe: pagamentos com pessoa (vale, condução, salário, semana, pró-labore)
    r.equipe = r.despesas.filter(d => d.pessoa_id || d.categoria === 'FUNCIONARIOS' || d.categoria === 'PROLABORE');
    r.equipeTotal = r.equipe.reduce((s, d) => s + (+d.valor || 0), 0);
    r.despSoltas = r.despesas.filter(d => r.equipe.indexOf(d) < 0);
    r.despTotal = r.despesas.reduce((s, d) => s + (+d.valor || 0), 0);
    // fiado dado (vendido no fiado) e recebido no período
    r.fiadoDado = [];
    r.fiadoRecebido = [];
    P.Store.all('pagamentos').forEach(p => {
      if (p.forma !== 'FIADO') return;
      const c = P.Store.get('comandas', p.comanda_id);
      if (!c || c.status !== 'FECHADA') return;
      if (set.has(p.dia_operacional)) r.fiadoDado.push({ p, c });
      if (p.recebido_em && set.has(p.recebido_dia)) r.fiadoRecebido.push({ p, c });
    });
    r.fiadoDadoTotal = r.fiadoDado.reduce((s, x) => s + (+x.p.valor || 0), 0);
    r.fiadoRecebidoTotal = r.fiadoRecebido.reduce((s, x) => s + (+x.p.valor || 0), 0);
    // gás: botijão ligado, que acabou ou em uso no período; e o que foi gasto com gás
    r.botijoes = de ? P.Gas.todos().filter(b => b.inicio <= ate && (!b.fim || b.fim >= de)) : [];
    r.gasDesp = r.despesas.filter(d => d.categoria === 'GAS_CARVAO').reduce((s, d) => s + (+d.valor || 0), 0);
    r.saldo = r.entradas - r.saidas;
    return r;
  }

  // ---------------------------------------------------------------
  //  Blocos (iguais no dia e no período)
  // ---------------------------------------------------------------
  function tabelaItens(lista) {
    if (!lista.length) return h('div', { class: 'dica' }, 'Nada vendido.');
    return h('div', { class: 'rl-tab' },
      h('div', { class: 'rl-tr th rl-tr3' }, h('span', null, 'Item'), h('span', null, 'Qtd'), h('span', null, 'Valor')),
      lista.map(g => h('div', { class: 'rl-tr rl-tr3' }, h('span', null, g.nome), h('span', null, P.num(g.q, g.q % 1 ? 1 : 0)), h('span', null, P.brl(g.fat)))));
  }
  // um dia só: como foi o fechamento do caixa (Mesas → Fechar caixa)
  function fechCaixa(dias) {
    const f = dias.length === 1 && P.Fechamento ? P.Fechamento.resultado(dias[0]) : null;
    return f ? linhaV('Fechamento do caixa' + (f.f.por ? ' (' + f.f.por + ')' : ''), f.texto, f.bateu ? 't-verde' : 'aviso') : null;
  }
  function blocos(r, dias) {
    const varios = dias.length > 1;
    const quando = d => (varios ? P.Dia.rotuloCurto(d) + ' · ' : '');
    const out = [];
    out.push(h('div', { class: 'rl-kpis' },
      kpi('Vendas', P.brl(r.fat), r.fechadas.length + (r.fechadas.length === 1 ? ' conta' : ' contas') + (r.ticket != null ? ' · ticket ' + P.brl(r.ticket) : '')),
      kpi('Saldo de caixa', P.brl(r.saldo), 'entrou ' + P.brl0(r.entradas) + ' · saiu ' + P.brl0(r.saidas), r.saldo >= 0 ? 'verde' : 'vermelho'),
      kpi('Pratos', P.num(r.qComida), P.brl0(r.fatComida)),
      kpi('Bebidas', P.num(r.qBebidas), P.brl0(r.fatBebidas))));

    out.push(secao('Vendas',
      linhaV('Vendido (itens)', P.brl(r.fatBruto)),
      r.desconto ? linhaV('(−) Descontos', P.brl(r.desconto)) : null,
      linhaV('= Vendas', P.brl(r.fat), 'forte'),
      r.semDetalhe ? linhaV('Vendas sem anotação (diferença do caixa)', P.brl(r.semDetalhe), 'nota') : null,
      ['SALAO', 'ESPETO', 'MARMITA'].filter(k => r.porCanal[k].contas).map(k => linhaV(P.Mesas.NOME_CANAL[k], P.brl(r.porCanal[k].fat) + ' · ' + r.porCanal[k].contas + (r.porCanal[k].contas === 1 ? ' conta' : ' contas'))),
      ['DINHEIRO', 'PIX', 'DEBITO', 'CREDITO', 'FIADO'].filter(f => r.porForma[f]).map(f => linhaV('Pago em ' + P.Mesas.NOME_FORMA[f], P.brl(r.porForma[f]))),
      r.canceladas.length ? linhaV('Contas canceladas', String(r.canceladas.length), 'aviso') : null));

    out.push(secao('Pratos · ' + P.num(r.qComida) + ' · ' + P.brl(r.fatComida), tabelaItens(r.comida)));
    out.push(secao('Bebidas · ' + P.num(r.qBebidas) + ' · ' + P.brl(r.fatBebidas), tabelaItens(r.bebidas)));

    out.push(secao('Compras (' + r.compras.length + ') · ' + P.brl(r.comprasTotal),
      r.compras.length ? h('div', { class: 'dp-compras' }, r.compras.map(c => h('a', { class: 'dp-compra', href: '#/compras/c/' + c.id },
        h('div', { class: 'dp-compra-t' }, h('b', null, c.fornecedor || 'Compra'), h('b', null, P.brl(c.total))),
        h('small', null, quando(c.dia_operacional) + (P.Compras.textoPartes ? P.Compras.textoPartes(c) : P.Compras.NOME_FORMA[c.forma] || c.forma) + (P.Compras.valorAberto(c) > 0 ? ' · a pagar ' + P.brl(P.Compras.valorAberto(c)) : '')),
        h('div', { class: 'dp-itens' }, P.Compras.itensDe(c.id).map(l => h('div', { class: 'dp-item' },
          h('span', null, l.descricao), h('span', null, P.numAuto(l.quantidade, 3) + ' ' + l.unidade + ' × ' + P.Fichas.precoFmt(l.preco_unit)), h('b', null, P.brl(l.valor)))))))) : h('div', { class: 'dica' }, 'Nenhuma compra.'),
      varios && r.porInsumo.size ? h('details', { class: 'dp-det' }, h('summary', null, 'Somado por item'),
        h('div', { class: 'rl-tab' },
          h('div', { class: 'rl-tr th rl-tr3' }, h('span', null, 'Item'), h('span', null, 'Qtd'), h('span', null, 'Valor')),
          [...r.porInsumo.values()].sort((a, b) => b.v - a.v).map(g => h('div', { class: 'rl-tr rl-tr3' }, h('span', null, g.nome), h('span', null, P.numAuto(g.q, 2) + ' ' + g.un), h('span', null, P.brl(g.v)))))) : null));

    out.push(secao('Despesas · ' + P.brl(r.despTotal - r.equipeTotal),
      r.despSoltas.length ? h('div', { class: 'ms-lista' }, r.despSoltas.map(d => h('div', { class: 'ms-card' },
        h('div', { class: 'ms-card-n' }, d.descricao || P.Mesas.NOME_DESP[d.categoria], h('small', null, quando(d.dia_operacional) + P.Mesas.subDesp(d))),
        h('b', null, P.brl(d.valor))))) : h('div', { class: 'dica' }, 'Nenhuma despesa.')));

    // equipe: por pessoa
    const porPessoa = new Map();
    r.equipe.forEach(d => {
      const pes = d.pessoa_id && P.Store.get('pessoas', d.pessoa_id);
      const k = pes ? pes.id : '_' + (d.descricao || d.categoria);
      if (!porPessoa.has(k)) porPessoa.set(k, { nome: pes ? pes.nome : d.descricao || P.Mesas.NOME_DESP[d.categoria], total: 0, itens: [] });
      const g = porPessoa.get(k);
      g.total += +d.valor || 0;
      g.itens.push(d);
    });
    out.push(secao('Equipe · ' + P.brl(r.equipeTotal),
      porPessoa.size ? h('div', { class: 'ms-lista' }, [...porPessoa.values()].sort((a, b) => b.total - a.total).map(g => h('div', { class: 'ms-card' },
        h('div', { class: 'ms-card-n' }, g.nome, h('small', null, g.itens.map(d => quando(d.dia_operacional) + (P.Mesas.NOME_SUBTIPO[d.subtipo] || P.Mesas.NOME_DESP[d.categoria]).replace(' (adiantamento)', '') + ' ' + P.brl0(d.valor)).join(' · '))),
        h('b', null, P.brl(g.total))))) : h('div', { class: 'dica' }, 'Nenhum pagamento da equipe.')));

    out.push(secao('Caixa',
      linhaV('Entrou (vendas recebidas' + (r.fiadoRecebidoTotal ? ' e fiado recebido' : '') + ')', P.brl(r.entradas)),
      linhaV('Saiu (compras pagas, despesas e equipe)', P.brl(r.saidas)),
      linhaV('= Saldo', P.brl(r.saldo), 'total ' + (r.saldo >= 0 ? 't-verde' : 't-vermelho')),
      r.comprasAPrazo ? linhaV('Comprado e ainda não pago (a prazo / cartão de crédito)', P.brl(r.comprasAPrazo), 'aviso') : null,
      fechCaixa(dias)));

    out.push(secao('Fiado',
      linhaV('Vendido no fiado', P.brl(r.fiadoDadoTotal), r.fiadoDadoTotal ? 'aviso' : null),
      r.fiadoDado.map(x => h('div', { class: 'rl-ctrl' }, quando(x.p.dia_operacional) + (x.c.cliente || P.Mesas.rotulo(x.c)) + ' · ' + P.brl(x.p.valor) + (x.p.recebido_em ? ' · já recebido' : ''))),
      linhaV('Fiado recebido', P.brl(r.fiadoRecebidoTotal)),
      r.fiadoRecebido.map(x => h('div', { class: 'rl-ctrl' }, (varios ? P.Dia.rotuloCurto(x.p.recebido_dia) + ' · ' : '') + (x.c.cliente || P.Mesas.rotulo(x.c)) + ' · ' + P.brl(x.p.valor) + ' · ' + (P.Mesas.NOME_FORMA[x.p.recebido_forma] || '') + ' (vendido ' + P.Dia.rotuloCurto(x.p.dia_operacional) + ')'))));

    const de = dias[0], ate = dias[dias.length - 1];
    out.push(secao('Gás' + (r.gasDesp ? ' · ' + P.brl(r.gasDesp) : ''),
      r.botijoes.length ? r.botijoes.map(b => {
        const i = P.Gas.info(b);
        const txt = [];
        if (b.inicio >= de && b.inicio <= ate) txt.push('ligado ' + P.Dia.rotuloCurto(b.inicio));
        else txt.push('em uso desde ' + P.Dia.rotuloCurto(b.inicio));
        if (b.fim && b.fim <= ate) txt.push('acabou ' + P.Dia.rotuloCurto(b.fim) + ' (' + i.corridos + (i.corridos === 1 ? ' dia' : ' dias') + ')');
        else if (!b.fim) txt.push('ainda em uso, há ' + i.corridos + (i.corridos === 1 ? ' dia' : ' dias'));
        return linhaV(P.Gas.nomeTam(b.tamanho) + ' · ' + txt.join(' · '), P.brl(b.valor));
      }) : h('div', { class: 'dica' }, 'Nenhum botijão registrado neste período.')));
    return out;
  }

  // ---------------------------------------------------------------
  //  TELA: DIA (calendário do mês com o vendido; tocar abre o dia)
  // ---------------------------------------------------------------
  function vendidoPorDia() {
    const m = new Map();
    P.Store.all('comandas').forEach(c => { if (c.status === 'FECHADA') m.set(c.dia_operacional, (m.get(c.dia_operacional) || 0) + (+c.total || 0)); });
    return m;
  }
  function telaDia(view, params) {
    view.className = 'v-relatorio v-dia';
    const hoje = P.Dia.hoje();
    let dia = params.dia && /^\d{4}-\d{2}-\d{2}$/.test(params.dia) && params.dia <= hoje ? params.dia : hoje;
    let mes = P.Dia.mes(dia);
    const cal = h('div', { class: 'dp-cal' });
    const corpo = h('div');
    const mudaMes = n => { const [y, m] = mes.split('-').map(Number); const d = new Date(y, m - 1 + n, 1); mes = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0'); desenharCal(); };
    function escolher(iso) { dia = iso; mes = P.Dia.mes(iso); history.replaceState(null, '', '#/dia/' + iso); desenhar(); }
    function desenharCal() {
      const vend = vendidoPorDia();
      const [y, m] = mes.split('-').map(Number);
      const vazios = (new Date(y, m - 1, 1).getDay() + 6) % 7;
      const ultimo = new Date(y, m, 0).getDate();
      const cel = [];
      for (let i = 0; i < vazios; i++) cel.push(h('span', { class: 'cal-d vazio' }));
      let totMes = 0;
      for (let d = 1; d <= ultimo; d++) {
        const iso = mes + '-' + String(d).padStart(2, '0');
        const domingo = new Date(y, m - 1, d).getDay() === 0;
        const v = vend.get(iso) || 0;
        totMes += v;
        cel.push(h('button', { type: 'button', disabled: domingo || iso > hoje,
          class: 'cal-d' + (v ? ' com' : '') + (iso === dia ? ' sel' : '') + (iso === hoje ? ' hoje' : ''),
          'aria-label': P.Dia.rotulo(iso) + (v ? ', vendido ' + P.brl0(v) : ''), onClick: () => escolher(iso) },
          h('b', null, d), v ? h('small', null, P.brl0(v).replace('R$ ', '')) : null));
      }
      trocar(cal, 
        h('div', { class: 'cal-top' },
          h('button', { type: 'button', class: 'pn-nav', 'aria-label': 'Mês anterior', onClick: () => mudaMes(-1) }, P.UI.icone('voltar')),
          h('div', { class: 'cal-mes' }, P.Dia.rotuloMes(mes), h('small', null, totMes ? 'vendido no mês ' + P.brl(totMes) : 'nenhuma venda no mês')),
          h('button', { type: 'button', class: 'pn-nav', 'aria-label': 'Próximo mês', disabled: mes >= P.Dia.mes(hoje), onClick: () => mudaMes(1) }, P.UI.icone('avancar'))),
        h('div', { class: 'cal-grade' }, ['seg', 'ter', 'qua', 'qui', 'sex', 'sáb', 'dom'].map(s => h('span', { class: 'cal-sem' }, s)), cel));
    }
    function desenhar() {
      desenharCal();
      const r = resumo([dia]);
      trocar(corpo, 
        h('div', { class: 'lc-dia' },
          h('button', { type: 'button', class: 'pn-nav', 'aria-label': 'Dia anterior', onClick: () => escolher(P.Dia.anterior(dia)) }, P.UI.icone('voltar')),
          h('div', { class: 'lc-dia-t' }, dia === hoje ? 'Hoje' : P.Dia.nomeSemana(dia), h('small', null, P.Dia.rotuloCurto(dia) + '/' + dia.slice(0, 4))),
          h('button', { type: 'button', class: 'pn-nav', 'aria-label': 'Próximo dia', disabled: dia >= hoje, onClick: () => escolher(P.Dia.seguinte(dia)) }, P.UI.icone('avancar'))),
        ...blocos(r, [dia]));
    }
    view.append(subnavDia('dia'), cal, corpo);
    desenhar();
    return { onDados: desenhar };
  }

  // ---------------------------------------------------------------
  //  TELA: PERÍODO (de um dia até outro, com um segundo período para comparar)
  // ---------------------------------------------------------------
  function segunda(dia) { const s = P.Dia.semana(dia); return P.Dia.somaDias(dia, -((s + 6) % 7)); }
  function atalhos() {
    const hoje = P.Dia.hoje();
    const seg = segunda(hoje);
    const mes = P.Dia.mes(hoje);
    const [y, m] = mes.split('-').map(Number);
    const ant = new Date(y, m - 2, 1);
    const mesAnt = ant.getFullYear() + '-' + String(ant.getMonth() + 1).padStart(2, '0');
    const fimMesAnt = P.Dia.somaDias(mes + '-01', -1);
    return [
      { id: 'semana', rotulo: 'Esta semana', de: seg, ate: hoje },
      { id: 'semana_ant', rotulo: 'Semana passada', de: P.Dia.somaDias(seg, -7), ate: P.Dia.somaDias(seg, -2) },
      { id: 'mes', rotulo: 'Este mês', de: mes + '-01', ate: hoje },
      { id: 'mes_ant', rotulo: 'Mês passado', de: mesAnt + '-01', ate: fimMesAnt },
    ];
  }
  // período anterior com o mesmo número de dias corridos
  function anteriorIgual(de, ate) {
    const n = Math.round((P.Dia.parse(ate) - P.Dia.parse(de)) / 86400000) + 1;
    return { de: P.Dia.somaDias(de, -n), ate: P.Dia.somaDias(de, -1) };
  }
  const rotPer = (de, ate) => (de === ate ? P.Dia.rotulo(de) : P.Dia.rotuloCurto(de) + ' a ' + P.Dia.rotuloCurto(ate));

  // linha de comparação: nome, valor 1, valor 2, diferença (R$ ou quantidade) e %
  function linhaComp(nome, a, b, fmt, menorMelhor) {
    const dif = a - b;
    const pct = b ? dif / Math.abs(b) * 100 : null;
    const bom = dif === 0 ? null : (dif > 0) !== !!menorMelhor;
    const cls = dif === 0 || menorMelhor == null ? '' : bom ? 't-verde' : 't-vermelho';
    return h('div', { class: 'dp-cmp-l' },
      h('span', { class: 'dp-cmp-n' }, nome),
      h('span', null, fmt(a)), h('span', null, fmt(b)),
      h('span', { class: cls }, (dif > 0 ? '+' : dif < 0 ? '−' : '') + fmt(Math.abs(dif)).replace('−', '') + (pct != null && dif ? ' · ' + (dif > 0 ? '+' : '−') + P.num(Math.abs(pct), 0) + '%' : '')));
  }
  function comparacao(r1, r2, p1, p2) {
    const q = v => P.num(v, v % 1 ? 1 : 0);
    const cab = h('div', { class: 'dp-cmp-l th' }, h('span', { class: 'dp-cmp-n' }, ''), h('span', null, rotPer(p1.de, p1.ate)), h('span', null, rotPer(p2.de, p2.ate)), h('span', null, 'Diferença'));
    const gerais = [
      linhaComp('Vendas', r1.fat, r2.fat, P.brl, false),
      linhaComp('Contas', r1.fechadas.length, r2.fechadas.length, q, false),
      linhaComp('Ticket médio', r1.ticket || 0, r2.ticket || 0, P.brl, false),
      linhaComp('Pratos (qtd)', r1.qComida, r2.qComida, q, false),
      linhaComp('Bebidas (qtd)', r1.qBebidas, r2.qBebidas, q, false),
      linhaComp('Compras', r1.comprasTotal, r2.comprasTotal, P.brl, true),
      linhaComp('Despesas', r1.despTotal - r1.equipeTotal, r2.despTotal - r2.equipeTotal, P.brl, true),
      linhaComp('Equipe', r1.equipeTotal, r2.equipeTotal, P.brl, true),
      linhaComp('Entrou no caixa', r1.entradas, r2.entradas, P.brl, false),
      linhaComp('Saiu do caixa', r1.saidas, r2.saidas, P.brl, true),
      linhaComp('Saldo de caixa', r1.saldo, r2.saldo, P.brl, false),
      linhaComp('Fiado vendido', r1.fiadoDadoTotal, r2.fiadoDadoTotal, P.brl, true),
      linhaComp('Fiado recebido', r1.fiadoRecebidoTotal, r2.fiadoRecebidoTotal, P.brl, false),
      linhaComp('Gás', r1.gasDesp, r2.gasDesp, P.brl, true),
    ];
    // quantidade de cada prato e bebida, nos dois períodos
    const porItem = (lista1, lista2) => {
      const m = new Map();
      lista1.forEach(g => m.set(g.id, { nome: g.nome, a: g.q, b: 0 }));
      lista2.forEach(g => { if (!m.has(g.id)) m.set(g.id, { nome: g.nome, a: 0, b: 0 }); m.get(g.id).b = g.q; });
      return [...m.values()].sort((x, y) => Math.max(y.a, y.b) - Math.max(x.a, x.b)).map(g => linhaComp(g.nome, g.a, g.b, q, false));
    };
    // compras por item
    const porInsumo = () => {
      const m = new Map();
      r1.porInsumo.forEach((g, k) => m.set(k, { nome: g.nome, un: g.un, a: g.v, b: 0 }));
      r2.porInsumo.forEach((g, k) => { if (!m.has(k)) m.set(k, { nome: g.nome, un: g.un, a: 0, b: 0 }); m.get(k).b = g.v; });
      return [...m.values()].sort((x, y) => Math.max(y.a, y.b) - Math.max(x.a, x.b)).map(g => linhaComp(g.nome, g.a, g.b, P.brl, true));
    };
    const tab = linhas => h('div', { class: 'dp-cmp' }, cab.cloneNode(true), linhas);
    return [
      secao('Comparação', tab(gerais)),
      secao('Pratos: quantidade', r1.comida.length || r2.comida.length ? tab(porItem(r1.comida, r2.comida)) : h('div', { class: 'dica' }, 'Nenhum prato vendido.')),
      secao('Bebidas: quantidade', r1.bebidas.length || r2.bebidas.length ? tab(porItem(r1.bebidas, r2.bebidas)) : h('div', { class: 'dica' }, 'Nenhuma bebida vendida.')),
      secao('Compras por item', r1.porInsumo.size || r2.porInsumo.size ? tab(porInsumo()) : h('div', { class: 'dica' }, 'Nenhuma compra.')),
    ];
  }

  let estadoPer = null; // lembra o período enquanto o app está aberto
  function telaPeriodo(view) {
    view.className = 'v-relatorio v-dia';
    const at = atalhos();
    if (!estadoPer) {
      const p1 = { de: at[0].de, ate: at[0].ate };
      estadoPer = { p1, p2: { de: at[1].de, ate: at[1].ate }, comparar: false };
    }
    const st = estadoPer;
    const corpo = h('div');
    const topo = h('div');

    function campoDatas(p, onMuda) {
      const inDe = h('input', { type: 'date', class: 'campo', value: p.de, max: P.Dia.hoje() });
      const inAte = h('input', { type: 'date', class: 'campo', value: p.ate, max: P.Dia.hoje() });
      inDe.addEventListener('change', () => { if (inDe.value) { p.de = inDe.value; if (p.ate < p.de) p.ate = p.de; onMuda(); } });
      inAte.addEventListener('change', () => { if (inAte.value) { p.ate = inAte.value; if (p.de > p.ate) p.de = p.ate; onMuda(); } });
      return h('div', { class: 'rl-datas' }, h('span', null, 'de'), inDe, h('span', null, 'até'), inAte);
    }
    function chips(p, lista, onMuda) {
      return h('div', { class: 'chips dp-chips' }, lista.map(a => h('button', { type: 'button', class: 'chip' + (a.de === p.de && a.ate === p.ate ? ' on' : ''), onClick: () => { p.de = a.de; p.ate = a.ate; onMuda(); } }, a.rotulo)));
    }
    function desenharTopo() {
      const ant = anteriorIgual(st.p1.de, st.p1.ate);
      trocar(topo, 
        h('div', { class: 'dp-per' },
          h('div', { class: 'dp-per-t' }, 'Período'),
          chips(st.p1, at, tudo), campoDatas(st.p1, tudo)),
        h('label', { class: 'dp-cmp-chk' }, h('input', { type: 'checkbox', checked: st.comparar, onChange: e => { st.comparar = e.target.checked; tudo(); } }), ' Comparar com outro período'),
        st.comparar ? h('div', { class: 'dp-per dp-per2' },
          h('div', { class: 'dp-per-t' }, 'Comparar com'),
          chips(st.p2, [{ rotulo: 'Período anterior', de: ant.de, ate: ant.ate }].concat(at), tudo), campoDatas(st.p2, tudo)) : null);
    }
    function desenhar() {
      const d1 = P.Relatorio.diasDoPeriodo('datas', st.p1.de, st.p1.ate);
      corpo.innerHTML = '';
      if (!d1.length) { corpo.appendChild(P.UI.vazio('Escolha um período válido.', 'calendario')); return; }
      const r1 = resumo(d1);
      corpo.appendChild(h('div', { class: 'an-base' }, rotPer(st.p1.de, st.p1.ate) + ' · ' + r1.diasMov.size + (r1.diasMov.size === 1 ? ' dia com venda' : ' dias com venda')));
      if (st.comparar) {
        const d2 = P.Relatorio.diasDoPeriodo('datas', st.p2.de, st.p2.ate);
        if (d2.length) corpo.append(...comparacao(r1, resumo(d2), st.p1, st.p2));
        else corpo.appendChild(h('div', { class: 'banner aviso' }, P.UI.icone('alerta'), h('span', null, 'Escolha o segundo período para comparar.')));
        corpo.appendChild(h('div', { class: 'secao' }, 'Detalhe de ' + rotPer(st.p1.de, st.p1.ate)));
      }
      corpo.append(...blocos(r1, d1));
      corpo.appendChild(secao('Exportar (abre no Excel)', h('div', { class: 'rl-exp' },
        h('button', { type: 'button', class: 'btn', onClick: () => exportar(r1, st.p1) }, P.UI.icone('download'), 'Planilha do período'))));
    }
    function tudo() { desenharTopo(); desenhar(); }
    view.append(subnavDia('periodo'), topo, corpo);
    tudo();
    return { onDados: desenhar };
  }

  // planilha do período: um resumo e o detalhe de cada item, compra e despesa
  function exportar(r, p) {
    const n = v => P.num(+v || 0, 2);
    const L = [['tipo', 'dia', 'nome', 'quantidade', 'valor']];
    L.push(['Resumo', '', 'Vendas', '', n(r.fat)], ['Resumo', '', 'Entrou no caixa', '', n(r.entradas)], ['Resumo', '', 'Saiu do caixa', '', n(r.saidas)],
      ['Resumo', '', 'Saldo de caixa', '', n(r.saldo)], ['Resumo', '', 'Compras', '', n(r.comprasTotal)], ['Resumo', '', 'Despesas (sem equipe)', '', n(r.despTotal - r.equipeTotal)],
      ['Resumo', '', 'Equipe', '', n(r.equipeTotal)], ['Resumo', '', 'Fiado vendido', '', n(r.fiadoDadoTotal)], ['Resumo', '', 'Fiado recebido', '', n(r.fiadoRecebidoTotal)]);
    r.comida.forEach(g => L.push(['Prato', '', g.nome, P.num(g.q, 2), n(g.fat)]));
    r.bebidas.forEach(g => L.push(['Bebida', '', g.nome, P.num(g.q, 2), n(g.fat)]));
    r.compras.forEach(c => P.Compras.itensDe(c.id).forEach(l => L.push(['Compra · ' + (c.fornecedor || ''), c.dia_operacional, l.descricao, P.num(+l.quantidade || 0, 3) + ' ' + l.unidade, n(l.valor)])));
    r.despesas.forEach(d => L.push(['Despesa · ' + P.Mesas.subDesp(d), d.dia_operacional, d.descricao || P.Mesas.NOME_DESP[d.categoria], '', n(d.valor)]));
    const txt = '﻿' + L.map(l => l.map(v => '"' + String(v).replace(/"/g, '""') + '"').join(';')).join('\r\n');
    P.UI.baixar('periodo_' + p.de + '_a_' + p.ate + '.csv', txt, 'text/csv;charset=utf-8');
  }

  P.UI.rota('dia', { titulo: 'Dia', tab: 'mais', dono: true, render: telaDia });
  P.UI.rota('dia/:dia', { titulo: 'Dia', tab: 'mais', dono: true, render: telaDia });
  P.UI.rota('periodo', { titulo: 'Período', tab: 'mais', dono: true, render: telaPeriodo });
  P.DiaPeriodo = { resumo };
})();
