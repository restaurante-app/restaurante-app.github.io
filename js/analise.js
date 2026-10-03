/* ANÁLISE (dono) — fica de olho nas compras e diz se cada prato compensa.
   Recalcula sozinha a cada compra ou venda lançada (é só uma conta sobre os dados).
   - Alertas: preço acima ou abaixo do que costuma pagar, quantidade fora do costume,
     compra lançada duas vezes, comprado bem acima (ou abaixo) do que as vendas usaram,
     compras sem ligação com ficha.
   - Compras × vendas: quanto das vendas vai para mercadoria, semana a semana.
   - Pratos: custo pela ficha, margem, quanto vendeu e quanto deixou — compensa ou não. */
(function () {
  'use strict';
  const P = window.P;
  const h = P.UI.h;
  const UN = { kg: 'kg', L: 'L', un: 'un' };

  // O que é "fora do normal"
  const LIM = {
    precoAtencao: 15, // pagou 15% acima do costume
    precoAlto: 30,    // 30% acima: confira já
    precoBaixo: 40,   // 40% abaixo: confira se digitou certo
    qtdVezes: 2.5,    // 2,5× a quantidade de costume
    qtdMinHist: 3,    // compras anteriores necessárias para saber o costume de quantidade
    histDias: 120,    // quanto tempo para trás vale como referência
    dupDias: 1,       // mesma compra até 1 dia antes ou depois = lançada duas vezes?
    sobraPct: 30,     // comprou 30% a mais do que as vendas usaram…
    sobraMin: 50,     // …e a sobra vale pelo menos R$ 50
    impactoMin: 5,    // diferença menor que R$ 5 não vira alerta
  };

  const PERIODOS = [
    { v: 'semana', rotulo: 'Semana', n: 6 },
    { v: 'mes', rotulo: '30 dias', n: 26 },
    { v: 'tri', rotulo: '3 meses', n: 78 },
  ];
  const diasDe = v => P.Dia.ultimos((PERIODOS.find(p => p.v === v) || PERIODOS[1]).n, P.Dia.hoje());

  const norm = s => P.UI.semAcento(s).replace(/[^a-z0-9]+/g, ' ').trim();
  const unid = u => UN[u] || u || 'un';
  const precoU = (pu, u) => P.Fichas.precoFmt(pu) + '/' + unid(u);
  const qtdU = (q, u) => P.numAuto(q, 3) + ' ' + unid(u);
  const diaC = d => P.Dia.rotuloCurto(d);
  function mediana(xs) {
    const a = xs.slice().sort((x, y) => x - y);
    const n = a.length;
    if (!n) return null;
    return n % 2 ? a[(n - 1) / 2] : (a[n / 2 - 1] + a[n / 2]) / 2;
  }
  const antes = (a, b) => (a.dia !== b.dia ? (a.dia < b.dia ? -1 : 1) : a.ts < b.ts ? -1 : a.ts > b.ts ? 1 : 0);

  // ---------------------------------------------------------------
  //  Base: todas as linhas de compra com o "produto" de cada uma
  //  (o insumo da ficha, ou o nome como veio na nota) — refeita só quando os dados mudam
  // ---------------------------------------------------------------
  let cache = { v: -1 };
  function base() {
    const v = P.Store.versao;
    if (cache.v === v) return cache;
    const compras = new Map(P.Store.all('compras').map(c => [c.id, c]));
    const insumos = new Map(P.Store.all('insumos').map(i => [i.id, i]));
    const linhas = [];
    P.Store.all('compra_itens').forEach(l => {
      const c = compras.get(l.compra_id);
      const q = +l.quantidade || 0, val = +l.valor || 0;
      if (!c || !(q > 0) || !(val > 0)) return; // descontos e linhas vazias ficam de fora
      const ins = (l.insumo_id && insumos.get(l.insumo_id)) || null;
      const un = l.unidade || 'un';
      linhas.push({
        l, c, q, v: val, un, pu: val / q, dia: c.dia_operacional, ts: c.criado_em || '', ins,
        chave: (ins ? 'i:' + ins.id : 'd:' + norm(l.descricao)) + '|' + un,
        nome: ins ? ins.nome : (l.descricao || 'Item'),
        forn: norm(c.fornecedor), fornNome: c.fornecedor || 'sem fornecedor',
      });
    });
    linhas.sort(antes);
    const porChave = new Map();
    linhas.forEach(x => { if (!porChave.has(x.chave)) porChave.set(x.chave, []); porChave.get(x.chave).push(x); });
    const hp = new Map();
    P.Store.all('historico_precos').forEach(r => { if (!hp.has(r.insumo_id)) hp.set(r.insumo_id, []); hp.get(r.insumo_id).push(r); });
    hp.forEach(l => l.sort((a, b) => (a.data < b.data ? -1 : 1)));
    cache = { v, compras, linhas, porChave, hp, memo: new Map() };
    return cache;
  }

  // O "normal" de um produto antes desta compra: mediana das compras anteriores
  // (até 120 dias); na primeira compra de um insumo, o preço que estava na ficha.
  function referencia(x) {
    const B = base();
    const desde = P.Dia.somaDias(x.dia, -LIM.histDias);
    const ant = (B.porChave.get(x.chave) || []).filter(y => y.c.id !== x.c.id && y.dia >= desde && antes(y, x) < 0);
    if (ant.length) {
      return {
        fonte: 'compras', n: ant.length, ant, pu: mediana(ant.map(y => y.pu)),
        q: ant.length >= LIM.qtdMinHist ? mediana(ant.map(y => y.q)) : null,
      };
    }
    if (x.ins && x.un === x.ins.unidade) {
      const hs = (B.hp.get(x.ins.id) || []).filter(r => r.data < x.ts && +r.preco > 0);
      const ult = hs[hs.length - 1];
      if (ult) return { fonte: 'ficha', n: 0, ant: [], pu: +ult.preco, q: null };
    }
    return null;
  }
  // compra anterior do mesmo produto, de outro fornecedor, mais barata
  function maisBarato(x, ref) {
    const outros = ref.ant.filter(y => y.forn !== x.forn && y.pu < x.pu * 0.95);
    return outros.length ? outros[outros.length - 1] : null;
  }

  function alertasLinha(x) {
    const out = [];
    const ref = referencia(x);
    if (!ref || !(ref.pu > 0)) return out;
    const dif = (x.pu / ref.pu - 1) * 100;
    const deOnde = ref.fonte === 'compras' ? (ref.n === 1 ? 'última compra' : 'mediana das últimas ' + ref.n + ' compras') : 'preço que estava na ficha';
    const onde = x.fornNome + ', ' + diaC(x.dia);
    const link = '#/compras/c/' + x.c.id;
    const extra = (x.pu - ref.pu) * x.q;
    if (dif >= LIM.precoAtencao && extra >= LIM.impactoMin) {
      const barato = maisBarato(x, ref);
      out.push({
        id: 'preco_alto:' + x.l.id, tipo: 'preco_alto', nivel: dif >= LIM.precoAlto && ref.fonte === 'compras' ? 'alto' : 'atencao',
        dia: x.dia, impacto: extra, link, dispensavel: true,
        titulo: x.nome + ': ' + P.num(dif, 0) + '% mais caro que o normal',
        texto: 'Pagou ' + precoU(x.pu, x.un) + ' (' + onde + '). O normal é ' + precoU(ref.pu, x.un) + ' (' + deOnde + '). Nesta compra foram ' + P.brl(extra) + ' a mais.',
        dica: barato ? 'Mais barato antes: ' + barato.fornNome + ', ' + precoU(barato.pu, x.un) + ' em ' + diaC(barato.dia) + '.' : null,
      });
    } else if (dif <= -LIM.precoBaixo && (ref.pu - x.pu) * x.q >= LIM.impactoMin) {
      out.push({
        id: 'preco_baixo:' + x.l.id, tipo: 'preco_baixo', nivel: 'atencao', dia: x.dia, impacto: (ref.pu - x.pu) * x.q, link, dispensavel: true,
        titulo: x.nome + ': ' + P.num(-dif, 0) + '% mais barato que o normal',
        texto: 'Lançado a ' + precoU(x.pu, x.un) + ' (' + onde + '); o normal é ' + precoU(ref.pu, x.un) + ' (' + deOnde + ').',
        dica: 'Confira se a quantidade (' + qtdU(x.q, x.un) + ') e o valor (' + P.brl(x.v) + ') foram digitados certo.',
      });
    }
    if (ref.q && x.q > ref.q * LIM.qtdVezes && (x.q - ref.q) * x.pu >= 30) {
      out.push({
        id: 'qtd_alta:' + x.l.id, tipo: 'qtd_alta', nivel: 'atencao', dia: x.dia, impacto: (x.q - ref.q) * x.pu, link, dispensavel: true,
        titulo: x.nome + ': quantidade ' + P.num(x.q / ref.q, 1) + '× maior que o normal',
        texto: 'Comprou ' + qtdU(x.q, x.un) + ' por ' + P.brl(x.v) + ' (' + onde + '). Costuma comprar ' + qtdU(ref.q, x.un) + ' por vez (mediana das últimas ' + ref.n + ' compras).',
        dica: 'Confira se a quantidade foi digitada certo ou se foi compra para estoque.',
      });
    }
    return out;
  }

  // Mesma compra lançada duas vezes: mesmo fornecedor, mesmo total, até 1 dia de diferença
  function repetidas(set, soCompra) {
    const B = base();
    const grupos = new Map();
    B.compras.forEach(c => {
      const t = Math.round((+c.total || 0) * 100);
      if (!(t > 0)) return;
      const k = norm(c.fornecedor) + '|' + t;
      if (!grupos.has(k)) grupos.set(k, []);
      grupos.get(k).push(c);
    });
    const out = [];
    grupos.forEach(cs => {
      if (cs.length < 2) return;
      cs.sort((a, b) => (a.criado_em < b.criado_em ? -1 : 1));
      for (let i = 0; i < cs.length; i++) {
        for (let j = i + 1; j < cs.length; j++) {
          const a = cs[i], b = cs[j];
          if (Math.abs((P.Dia.parse(b.dia_operacional) - P.Dia.parse(a.dia_operacional)) / 86400000) > LIM.dupDias) continue;
          if (set && !set.has(a.dia_operacional) && !set.has(b.dia_operacional)) continue;
          if (soCompra && a.id !== soCompra && b.id !== soCompra) continue;
          const mesmoDia = a.dia_operacional === b.dia_operacional;
          out.push({
            id: 'repetida:' + a.id + '|' + b.id, tipo: 'repetida', nivel: 'alto', dia: b.dia_operacional, impacto: +b.total || 0,
            link: '#/compras/c/' + b.id, dispensavel: true,
            titulo: 'Compra lançada duas vezes?',
            texto: (b.fornecedor || 'Sem fornecedor') + ': duas compras de ' + P.brl(b.total) + (mesmoDia ? ' no mesmo dia (' + diaC(b.dia_operacional) + ')' : ' em ' + diaC(a.dia_operacional) + ' e ' + diaC(b.dia_operacional)) + '.',
            dica: 'Se for a mesma nota, abra uma delas e exclua. Se foram duas compras de verdade, toque em "Está certo".',
          });
        }
      }
    });
    return out;
  }

  // Comprado × usado pelas vendas (pela ficha), por insumo
  function consumo(dias) {
    const r = P.Compras.custos(dias);
    const out = [];
    if (!(r.fat > 0)) return { alertas: out, semVendas: true, r };
    const longo = dias.length >= 26;
    r.lista.forEach(g => {
      const un = unid(g.ins.unidade);
      const q = v => P.numAuto(v, 2) + ' ' + un;
      const pm = g.qC > 0 ? g.vC / g.qC : +g.ins.preco || 0;
      if (g.qC > 0) {
        const sobra = g.qC - g.qU;
        const valor = sobra * pm;
        if (sobra / g.qC * 100 >= LIM.sobraPct && valor >= LIM.sobraMin) {
          out.push({
            id: 'sobra:' + g.ins.id, tipo: 'sobra', nivel: 'atencao', impacto: valor,
            titulo: g.ins.nome + ': comprou bem mais do que as vendas usaram',
            texto: 'Comprou ' + q(g.qC) + ' (' + P.brl(g.vC) + '). Pela ficha, as vendas usaram ' + q(g.qU) + '. Sobraram ' + q(sobra) + ' (' + P.brl(valor) + ').',
            dica: g.qU <= 0.0001 ? 'Nenhum prato vendido usou ' + g.ins.nome + ' no período: confira se os pratos que levam ele têm ficha técnica e se as vendas estão sendo lançadas.'
              : 'Pode ser estoque para os próximos dias, perda, porção maior que a ficha ou venda sem comanda. Se acontece todo mês, é dinheiro indo embora.',
          });
        }
      }
      // em 30 dias ou mais: as vendas usaram bem mais do que foi lançado de compra
      const falta = g.qU - g.qC;
      if (longo && falta > 0 && g.qU > g.qC * 1.5 && falta * pm >= 100) {
        out.push({
          id: 'falta:' + g.ins.id, tipo: 'falta', nivel: 'info', impacto: falta * pm,
          titulo: g.ins.nome + ': as vendas usaram mais do que foi comprado',
          texto: 'Pela ficha, as vendas usaram ' + q(g.qU) + '; foram lançadas compras de ' + q(g.qC) + '.',
          dica: 'Pode ser estoque antigo, compra que não foi lançada ou ficha com porção maior do que a servida.',
        });
      }
    });
    return { alertas: out, semVendas: false, r };
  }

  // Compras sem ligação com ficha (o app não sabe em que pratos foram usadas)
  function semFicha(set) {
    const B = base();
    const nenhum = P.cfg('nota_insumos');
    const m = new Map();
    let tot = 0;
    B.linhas.forEach(x => {
      if (!set.has(x.dia) || x.ins || nenhum[norm(x.l.descricao)] === '_nenhum') return;
      tot += x.v;
      const g = m.get(x.chave) || { nome: x.nome, v: 0 };
      g.v += x.v;
      m.set(x.chave, g);
    });
    if (!(tot > 0)) return [];
    const top = [...m.values()].sort((a, b) => b.v - a.v);
    return [{
      id: 'sem_ficha', tipo: 'sem_ficha', nivel: 'info', impacto: tot,
      titulo: P.brl(tot) + ' em compras sem ligação com ficha',
      texto: top.slice(0, 6).map(g => g.nome + ' ' + P.brl0(g.v)).join(' · ') + (top.length > 6 ? ' e mais ' + (top.length - 6) : ''),
      dica: 'Para o app saber se esses produtos compensaram, ligue cada um ao insumo da ficha (na compra, toque em "ligar à ficha"; se o insumo não existir, crie em Fichas → Cadastro). Embalagem e limpeza podem ficar assim.',
    }];
  }

  const ORDEM = { alto: 0, atencao: 1, info: 2 };
  function alertas(dias, comOcultos) {
    const B = base();
    const k = 'al|' + dias[0] + '|' + dias.length;
    let tudo = B.memo.get(k);
    if (!tudo) {
      const set = new Set(dias);
      tudo = [];
      B.linhas.forEach(x => { if (set.has(x.dia)) tudo.push(...alertasLinha(x)); });
      const cons = consumo(dias);
      tudo.push(...repetidas(set), ...cons.alertas, ...semFicha(set));
      tudo.sort((a, b) => (ORDEM[a.nivel] - ORDEM[b.nivel]) || ((b.impacto || 0) - (a.impacto || 0)));
      tudo.semVendas = cons.semVendas;
      B.memo.set(k, tudo);
    }
    const ok = P.cfg('analise_ok');
    const lista = comOcultos ? tudo : tudo.filter(a => !ok[a.id]);
    return { lista, ocultos: tudo.filter(a => ok[a.id]).length, semVendas: tudo.semVendas };
  }
  // alertas (sem os informativos) dos últimos 30 dias — para o número em Mais e em Compras
  function contar() {
    return alertas(diasDe('mes')).lista.filter(a => a.nivel !== 'info').length;
  }
  // logo depois de salvar uma compra: o que nela está fora do normal
  function daCompra(compraId) {
    const B = base();
    const ok = P.cfg('analise_ok');
    const out = [];
    B.linhas.forEach(x => { if (x.c.id === compraId) out.push(...alertasLinha(x)); });
    out.push(...repetidas(null, compraId));
    return out.filter(a => !ok[a.id]).sort((a, b) => (ORDEM[a.nivel] - ORDEM[b.nivel]) || (b.impacto - a.impacto));
  }

  // ---------------------------------------------------------------
  //  Pratos: compensa ou não
  // ---------------------------------------------------------------
  const CLASSE = {
    prejuizo: { rot: 'Dá prejuízo', st: 'critico', grupo: 'ruim' },
    nao: { rot: 'Não compensa', st: 'critico', grupo: 'ruim' },
    limite: { rot: 'No limite', st: 'atencao', grupo: 'limite' },
    sem_ficha: { rot: 'Sem ficha', st: 'neutro', grupo: 'sem_ficha' },
    compensa: { rot: 'Compensa', st: 'bom', grupo: 'compensa' },
  };
  const QUAD = {
    estrela: 'Carro-chefe: vende bem e ganha bem em cada um.',
    cavalo: 'Vende bem, mas ganha pouco em cada um: vale rever preço ou porção.',
    enigma: 'Ganha bem em cada um, mas vende pouco: vale divulgar.',
    cao: 'Vende pouco e ganha pouco: pensar em mudar ou tirar do cardápio.',
  };
  function pratos(dias) {
    const set = new Set(dias);
    const cfg = P.Calc.cfgFichas();
    const vend = new Map();
    P.Store.all('comandas').forEach(c => {
      if (c.status !== 'FECHADA' || !set.has(c.dia_operacional)) return;
      P.Mesas.linhas(c.id).forEach(l => {
        const q = +l.quantidade || 0;
        if (!(q > 0)) return;
        const g = vend.get(l.item_id) || { q: 0, fat: 0, cmvVenda: 0, qComCmv: 0 };
        g.q += q;
        g.fat += q * (+l.preco_unit || 0);
        if (+l.cmv_unit > 0) { g.cmvVenda += q * (+l.cmv_unit); g.qComCmv += q; }
        vend.set(l.item_id, g);
      });
    });
    const lista = P.Store.all('itens').filter(it => it.categoria !== 'GUARNICAO' && (P.Calc.vendavel(it) || vend.has(it.id))).map(it => {
      const f = P.Calc.ficha(it);
      const v = vend.get(it.id) || { q: 0, fat: 0, cmvVenda: 0, qComCmv: 0 };
      const preco = +it.preco_venda || 0;
      const semF = !(f.bruto > 0);
      let classe = 'compensa';
      if (semF) classe = 'sem_ficha';
      else if (!(f.margem > 0)) classe = 'prejuizo';
      else if (f.fc > cfg.vermelho_acima) classe = 'nao';
      else if (f.fc > cfg.verde_ate) classe = 'limite';
      // custo das vendas: o gravado na hora da venda; sem ele, o custo de hoje
      const cmvTotal = semF ? null : v.cmvVenda + (v.q - v.qComCmv) * f.cmv;
      const cmvMedVenda = v.qComCmv > 0 ? v.cmvVenda / v.qComCmv : null;
      const mudou = !semF && cmvMedVenda ? (f.cmv / cmvMedVenda - 1) * 100 : null;
      const alvo = !semF && preco > 0 && f.fc > cfg.verde_ate ? P.Calc.paraAlvo(it, P.Calc.componentesDe(it.id), preco, it.perda_pct) : null;
      return { it, f, v, preco, semF, classe, lucro: cmvTotal == null ? null : v.fat - cmvTotal, cmvMedVenda, mudou, alvo, quad: null };
    });
    // vende bem / ganha bem, comparando com os outros da mesma categoria (só com vendas no período)
    const porCat = new Map();
    lista.forEach(p => {
      if (p.semF || !(p.v.q > 0) || !(p.preco > 0)) return;
      if (!porCat.has(p.it.categoria)) porCat.set(p.it.categoria, []);
      porCat.get(p.it.categoria).push(p);
    });
    porCat.forEach(ps => {
      if (ps.length < 2) return;
      const totQ = ps.reduce((s, p) => s + p.v.q, 0);
      const corte = totQ / ps.length * 0.7;
      const margMed = ps.reduce((s, p) => s + p.v.q * p.f.margem, 0) / totQ;
      ps.forEach(p => {
        const vende = p.v.q >= corte, ganha = p.f.margem >= margMed;
        p.quad = vende && ganha ? 'estrela' : vende ? 'cavalo' : ganha ? 'enigma' : 'cao';
      });
    });
    return { lista, cfg };
  }

  // compras por produto no período e no período anterior de mesmo tamanho
  function produtos(dias) {
    const set = new Set(dias);
    const ini = dias[dias.length - 1];
    const ant = new Set(P.Dia.ultimos(dias.length, P.Dia.anterior(ini)));
    const m = new Map();
    base().linhas.forEach(x => {
      const noP = set.has(x.dia), noA = ant.has(x.dia);
      if (!noP && !noA) return;
      const g = m.get(x.chave) || { nome: x.nome, un: x.un, q: 0, v: 0, n: 0, qA: 0, vA: 0, forn: new Set() };
      if (noP) { g.q += x.q; g.v += x.v; g.n++; g.forn.add(x.fornNome); } else { g.qA += x.q; g.vA += x.v; }
      m.set(x.chave, g);
    });
    return [...m.values()].filter(g => g.v > 0).sort((a, b) => b.v - a.v);
  }
  // semana a semana (6 dias operacionais), mais recente primeiro
  function semanas(n) {
    const out = [];
    let fim = P.Dia.hoje();
    for (let i = 0; i < n; i++) {
      const dias = P.Dia.ultimos(6, fim);
      const r = P.Compras.custos(dias);
      out.push({ ini: dias[dias.length - 1], fim: dias[0], fat: r.fat, comprado: r.comprado, cmv: r.cmv });
      fim = P.Dia.anterior(dias[dias.length - 1]);
    }
    return out;
  }

  // ---------------------------------------------------------------
  //  TELA
  // ---------------------------------------------------------------
  let periodo = 'mes', aba = 'alertas', cat = 'TODOS', verOcultos = false;
  const NIVEL = { alto: { st: 'critico', rot: 'Confira já' }, atencao: { st: 'atencao', rot: 'Atenção' }, info: { st: 'neutro', rot: 'Para saber' } };

  function dispensar(a) {
    const ok = P.cfg('analise_ok');
    ok[a.id] = P.Dia.hoje();
    P.salvarCfg('analise_ok', ok);
    P.UI.toast('Marcado como certo', { acao: { rotulo: 'Desfazer', fn: () => { const o = P.cfg('analise_ok'); delete o[a.id]; P.salvarCfg('analise_ok', o); } } });
  }
  function cardAlerta(a, oculto) {
    return h('div', { class: 'az-card' + (oculto ? ' oculto' : '') },
      h('div', { class: 'az-card-top' }, h('b', null, a.titulo), P.UI.statusPill(NIVEL[a.nivel].st, oculto ? 'Está certo' : NIVEL[a.nivel].rot)),
      h('p', null, a.texto),
      a.dica ? h('p', { class: 'az-dica' }, a.dica) : null,
      a.link || (a.dispensavel && !oculto) ? h('div', { class: 'az-acoes' },
        a.link ? h('a', { class: 'btn mini', href: a.link }, 'Ver compra') : null,
        a.dispensavel && !oculto ? h('button', { type: 'button', class: 'btn mini', onClick: () => dispensar(a) }, P.UI.icone('check'), 'Está certo') : null) : null);
  }
  const corPct = (pct, meta) => (pct == null ? 'cinza' : pct <= meta ? 'verde' : pct <= meta * 1.15 ? 'amarelo' : 'vermelho');

  function telaAnalise(view) {
    view.className = 'v-compras v-analise';
    const topo = h('div');
    const corpo = h('div');

    function desenharAlertas(dias) {
      const A = alertas(dias, verOcultos);
      const ok = P.cfg('analise_ok');
      const fortes = A.lista.filter(a => a.nivel !== 'info' && !ok[a.id]);
      const extra = A.lista.filter(a => a.tipo === 'preco_alto' && !ok[a.id]).reduce((s, a) => s + a.impacto, 0);
      corpo.appendChild(h('div', { class: 'fx-resumo az-resumo' },
        h('div', { class: 'fx-tot' },
          h('small', null, fortes.length ? fortes.length + (fortes.length === 1 ? ' coisa fora do normal' : ' coisas fora do normal') : 'Nada fora do normal nas compras'),
          h('b', { class: extra > 0 ? 't-vermelho' : 't-verde' }, P.brl(extra))),
        h('small', { class: 'az-sub' }, 'pagos acima do preço de costume neste período')));
      if (A.semVendas) corpo.appendChild(h('div', { class: 'banner aviso' }, P.UI.icone('info'), h('span', { class: 'banner-t' }, 'Sem vendas lançadas neste período: dá para conferir preços e quantidades, mas não dá para comparar o comprado com o vendido.')));
      if (!A.lista.length) corpo.appendChild(P.UI.vazio('Nenhuma compra fora do normal neste período. O app confere cada compra assim que ela é lançada.', 'check'));
      else corpo.appendChild(h('div', { class: 'az-lista' }, A.lista.map(a => cardAlerta(a, !!ok[a.id]))));
      if (A.ocultos && !verOcultos) corpo.appendChild(h('button', { type: 'button', class: 'cp-galeria', onClick: () => { verOcultos = true; desenhar(); } }, 'Mostrar ' + A.ocultos + (A.ocultos === 1 ? ' alerta marcado' : ' alertas marcados') + ' como certo'));
      corpo.appendChild(h('div', { class: 'secao' }, 'Como o app confere'));
      corpo.appendChild(h('ul', { class: 'az-regras' },
        h('li', null, 'Preço: compara com o que você costuma pagar pelo mesmo produto (mediana das compras dos últimos 120 dias). Avisa a partir de ' + LIM.precoAtencao + '% acima; ' + LIM.precoAlto + '% acima é "confira já". Muito abaixo (' + LIM.precoBaixo + '%) também avisa, porque pode ser erro de digitação.'),
        h('li', null, 'Quantidade: avisa quando passa de ' + P.num(LIM.qtdVezes, 1) + '× o que costuma comprar de uma vez.'),
        h('li', null, 'Compra repetida: mesmo fornecedor e mesmo total, no mesmo dia ou no dia seguinte.'),
        h('li', null, 'Comprado × vendido: pela ficha técnica, quanto as vendas usaram de cada insumo. Sobra de ' + LIM.sobraPct + '% ou mais (e acima de ' + P.brl0(LIM.sobraMin) + ') vira aviso.')));
    }

    function desenharCompras(dias) {
      const r = P.Compras.custos(dias);
      const meta = +P.cfg('metas').food_cost_max || 38;
      const pctC = r.fat > 0 ? r.comprado / r.fat * 100 : null;
      const pctF = r.fat > 0 ? r.cmv / r.fat * 100 : null;
      const linha = (rot, sub, val, cor) => h('div', { class: 'rs-l cp' }, h('span', { class: 'rs-n' }, rot, h('small', null, sub)), h('b', { class: 'rs-v az-val' + (cor ? ' t-' + cor : '') }, val));
      corpo.appendChild(h('div', { class: 'rs-itens' },
        linha('Vendas', r.fat > 0 ? 'contas fechadas no período' : 'nenhuma venda lançada', P.brl(r.fat)),
        linha('Compras de mercadoria', pctC == null ? 'sem vendas para comparar' : P.pct(pctC, 0) + ' das vendas · meta até ' + meta + '%', P.brl(r.comprado), corPct(pctC, meta)),
        linha('Custo pela ficha', pctF == null ? 'do que foi vendido' : 'do que foi vendido · ' + P.pct(pctF, 0) + ' das vendas', P.brl(r.cmv))));
      if (r.fat > 0) {
        const dif = r.comprado - r.cmv;
        corpo.appendChild(h('div', { class: 'dica' }, dif >= 0
          ? ['Comprou ', h('b', null, P.brl(dif)), ' a mais do que as vendas usaram pela ficha: estoque que sobrou, perda, porção maior que a ficha ou venda sem comanda.']
          : ['As vendas usaram ', h('b', null, P.brl(-dif)), ' a mais do que foi comprado: usou estoque de antes ou falta lançar compra.']));
      }
      // semana a semana
      const sems = semanas(8);
      const maxV = Math.max(1, ...sems.map(s => Math.max(s.fat, s.comprado)));
      corpo.appendChild(h('div', { class: 'secao' }, 'Semana a semana'));
      corpo.appendChild(h('div', { class: 'az-sems' },
        h('div', { class: 'az-leg' }, h('span', null, h('i', { class: 'lg-v' }), 'vendas'), h('span', null, h('i', { class: 'lg-c' }), 'compras'), h('span', null, '% = compras ÷ vendas')),
        sems.map(s => {
          const pct = s.fat > 0 ? s.comprado / s.fat * 100 : null;
          return h('div', { class: 'az-sem' },
            h('span', { class: 'az-sem-d' }, diaC(s.ini) + '–' + diaC(s.fim)),
            h('div', { class: 'az-sem-b' },
              h('span', { class: 'az-b-v', style: { width: (s.fat / maxV * 100) + '%' } }),
              h('span', { class: 'az-b-c', style: { width: (s.comprado / maxV * 100) + '%' } })),
            h('span', { class: 'az-sem-n' }, h('small', null, P.brl0(s.fat) + ' · ' + P.brl0(s.comprado)), h('b', { class: 't-' + corPct(pct, meta) }, pct == null ? '—' : P.pct(pct, 0))));
        })));
      // o que mais comprou
      const ps = produtos(dias);
      corpo.appendChild(h('div', { class: 'secao' }, 'O que mais comprou'));
      if (!ps.length) corpo.appendChild(P.UI.vazio('Nenhuma compra neste período.', 'compras'));
      else {
        corpo.appendChild(h('div', { class: 'rs-itens' }, ps.slice(0, 12).map(g => {
          const pm = g.v / g.q, pmA = g.qA > 0 ? g.vA / g.qA : null;
          const difP = pmA ? (pm / pmA - 1) * 100 : null;
          const difQ = g.qA > 0 ? (g.q / g.qA - 1) * 100 : null;
          return h('div', { class: 'rs-l cp' },
            h('span', { class: 'rs-n' }, g.nome,
              h('small', null, qtdU(g.q, g.un) + ' em ' + g.n + (g.n === 1 ? ' compra' : ' compras') + ' · média ' + precoU(pm, g.un),
                difP != null && Math.abs(difP) >= 1 ? h('em', { class: difP > 0 ? 't-vermelho' : 't-verde' }, ' · preço ' + (difP > 0 ? '▲' : '▼') + P.num(Math.abs(difP), 0) + '%') : null,
                difQ != null && Math.abs(difQ) >= 25 ? h('em', null, ' · quantidade ' + (difQ > 0 ? '▲' : '▼') + P.num(Math.abs(difQ), 0) + '%') : null)),
            h('span', { class: 'rs-v' }, P.brl(g.v)));
        })));
        corpo.appendChild(h('div', { class: 'dica' }, '▲▼ comparado com o período anterior do mesmo tamanho.'));
      }
      corpo.appendChild(h('a', { class: 'btn bloco az-link', href: '#/compras/custos' }, P.UI.icone('custos'), 'Comprado × usado por insumo'));
    }

    function cardPrato(p) {
      const c = CLASSE[p.classe];
      const it = p.it;
      const linhas = [];
      if (!p.semF) {
        linhas.push(h('div', { class: 'mg-det' },
          h('span', null, 'Preço ', h('b', null, P.brl(p.preco))),
          h('span', null, 'Custo ', h('b', null, P.brl(p.f.cmv))),
          h('span', null, 'Margem ', h('b', { class: p.f.margem > 0 ? null : 't-vermelho' }, P.brl(p.f.margem))),
          h('span', null, 'Food cost ', h('b', null, P.pct(p.f.fc, 0)))));
      } else linhas.push(h('div', { class: 'az-p-txt' }, 'Sem ficha técnica: o app não sabe quanto custa, então não dá para saber se compensa. Toque para montar a ficha.'));
      linhas.push(h('div', { class: 'az-p-txt' }, p.v.q > 0
        ? ['Vendeu ', h('b', null, P.numAuto(p.v.q, 1)), ' · faturou ', h('b', null, P.brl0(p.v.fat)), p.lucro != null ? [' · deixou ', h('b', { class: p.lucro >= 0 ? 't-verde' : 't-vermelho' }, P.brl0(p.lucro))] : null]
        : 'Nenhuma venda neste período.'));
      if (p.quad) {
        // carro-chefe com custo alto: ainda deixa bastante por prato, então o ajuste é pequeno
        const txt = p.quad === 'estrela' && c.grupo !== 'compensa' ? 'Vende bem e deixa mais por prato que a média, mas o custo está alto: um reajuste pequeno já resolve.' : QUAD[p.quad];
        linhas.push(h('div', { class: 'az-p-txt az-quad' }, txt));
      }
      if (p.mudou != null && Math.abs(p.mudou) >= 5) {
        linhas.push(h('div', { class: 'az-p-txt ' + (p.mudou > 0 ? 't-vermelho' : 't-verde') }, 'O custo ' + (p.mudou > 0 ? 'subiu ' : 'caiu ') + P.num(Math.abs(p.mudou), 0) + '% com as últimas compras (era ' + P.brl(p.cmvMedVenda) + ' nas vendas do período).'));
      }
      if (p.alvo && !p.alvo.ja) {
        const por = p.alvo.porcao && p.alvo.porcao.qtd ? ' ou servir ' + P.numAuto(p.alvo.porcao.qtd, 0) + ' ' + p.alvo.porcao.linha.un + ' de ' + p.alvo.porcao.linha.nome + ' (hoje ' + P.numAuto(p.alvo.porcao.linha.qtd, 0) + ' ' + p.alvo.porcao.linha.un + ')' : '';
        linhas.push(h('div', { class: 'az-p-txt az-alvo' }, 'Para ficar em ' + p.alvo.alvo + '%: cobrar ' + P.brl(Math.ceil(p.alvo.precoAlvo * 2) / 2) + por + '.'));
      }
      return h('a', { class: 'az-prato', href: p.semF ? '#/fichas/editar/' + it.id : '#/fichas/item/' + it.id },
        h('div', { class: 'az-card-top' }, h('b', null, it.nome, h('small', null, (P.Fichas.CAT[it.categoria] || '').toString())), P.UI.statusPill(c.st, c.rot)),
        linhas);
    }
    function desenharPratos(dias) {
      const R = pratos(dias);
      const cont = { compensa: 0, limite: 0, ruim: 0, sem_ficha: 0 };
      R.lista.forEach(p => { cont[CLASSE[p.classe].grupo]++; });
      const box = (g, st, rot) => h('div', { class: 'semaf-c st-' + st }, h('span', { class: 'semaf-t' }, rot), h('b', null, cont[g]), h('small', null, cont[g] === 1 ? 'item' : 'itens'));
      corpo.appendChild(h('div', { class: 'semaf az-q4' },
        box('compensa', 'bom', 'Compensa'), box('limite', 'atencao', 'No limite'), box('ruim', 'critico', 'Não compensa'), box('sem_ficha', 'neutro', 'Sem ficha')));
      corpo.appendChild(h('div', { class: 'dica' }, 'Compensa = custo pela ficha até ' + R.cfg.verde_ate + '% do preço. No limite = até ' + R.cfg.vermelho_acima + '%. Acima disso, não compensa. "Deixou" = vendas menos o custo dos pratos vendidos no período.'));
      corpo.appendChild(P.UI.seg([
        { v: 'TODOS', rotulo: 'Todos' }, { v: 'PRATO', rotulo: 'Pratos' }, { v: 'ESPETO', rotulo: 'Espetos' }, { v: 'BEBIDA', rotulo: 'Bebidas' },
      ], cat, v => { cat = v; desenhar(); }, 'seg-p'));
      const ls = R.lista.filter(p => cat === 'TODOS' || p.it.categoria === cat);
      const top = ls.filter(p => p.lucro != null && p.lucro > 0).sort((a, b) => b.lucro - a.lucro)[0];
      if (top) corpo.appendChild(h('div', { class: 'banner ok' }, P.UI.icone('check'), h('span', { class: 'banner-t' }, 'Quem mais deixou dinheiro no período: ', h('b', null, top.it.nome), ' (' + P.brl0(top.lucro) + ')')));
      const GRUPOS = [['ruim', 'Não compensa'], ['limite', 'No limite'], ['sem_ficha', 'Sem ficha técnica'], ['compensa', 'Compensa']];
      let algum = false;
      GRUPOS.forEach(([g, rot]) => {
        const ps = ls.filter(p => CLASSE[p.classe].grupo === g).sort((a, b) => (b.v.q - a.v.q) || ((b.f.fc || 0) - (a.f.fc || 0)));
        if (!ps.length) return;
        algum = true;
        corpo.appendChild(h('div', { class: 'secao' }, rot + ' · ' + ps.length));
        corpo.appendChild(h('div', { class: 'az-lista' }, ps.map(cardPrato)));
      });
      if (!algum) corpo.appendChild(P.UI.vazio('Nenhum item nesta categoria.'));
    }

    function desenhar() {
      const dias = diasDe(periodo);
      const n = contar();
      topo.replaceChildren(
        P.Compras.subnav('analise'),
        P.UI.seg(PERIODOS.map(p => ({ v: p.v, rotulo: p.rotulo })), periodo, v => { periodo = v; desenhar(); }, 'seg-p'),
        P.UI.seg([
          { v: 'alertas', rotulo: 'Alertas' + (n ? ' · ' + n : '') },
          { v: 'compras', rotulo: 'Compras × vendas' },
          { v: 'pratos', rotulo: 'Pratos' },
        ], aba, v => { aba = v; verOcultos = false; desenhar(); }, 'seg-p az-abas'));
      corpo.innerHTML = '';
      if (aba === 'compras') desenharCompras(dias);
      else if (aba === 'pratos') desenharPratos(dias);
      else desenharAlertas(dias);
    }
    view.append(topo, corpo);
    desenhar();
    return { onDados(t) { if (['compras', 'compra_itens', 'comandas', 'comanda_itens', 'insumos', 'itens', 'componentes', 'config', 'historico_precos'].some(x => t.has(x))) desenhar(); } };
  }

  P.UI.rota('compras/analise', { titulo: 'Análise', tab: 'compras', dono: true, render: telaAnalise });
  P.Analise = { alertas, contar, daCompra, pratos, produtos, semanas, LIM };
})();
