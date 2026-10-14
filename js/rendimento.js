/* RENDIMENTO POR LOTE (só o dono) — cada compra de carne ou peixe vira um lote.
   As vendas dos pratos que usam essa carne entram sozinhas no lote ABERTO mais antigo
   (dá para mover os pratos de um dia para outro lote). "Acabou" fecha o lote: pratos,
   gramas por prato, carne por prato, carne / venda e o que sobrou depois da carne.
   Não mexe em vendas, compras, caixa nem relatórios: só lê o que já está lançado. */
(function () {
  'use strict';
  const P = window.P;
  const h = P.UI.h;
  const sa = s => P.UI.semAcento(s).replace(/\s+/g, ' ').trim();
  // troca o conteúdo ignorando partes opcionais vazias (null/false viraria o texto "null")
  const trocar = (el, ...k) => el.replaceChildren(...k.flat(Infinity).filter(x => x != null && x !== false));

  // a partir deste dia as compras de carne sem lote aparecem para abrir lote (antes: lotes importados)
  const INICIO = '2026-10-09';

  // [id, nome, palavras do nome da compra, meta de gramas por prato]
  const CARNES = [
    ['contra_file', 'Contra filé', 'contra file, contrafile, contra-file', 250],
    ['capa_file', 'Capa de filé', 'capa de file, capa do file, capa file', 200],
    // pertences da feijoada (antes da costela: "costela suína" e "costela salgada" são da feijoada)
    ['feijoada', 'Feijoada (pertences)', 'salgad, pe de porco, pe suino, rabo de porco, rabo suino, orelha, paio, charque, costela suina, feijoada', null],
    ['costelinha', 'Costelinha', 'costelinha', null],
    ['costela', 'Costela', 'costela', 500],
    ['rabada', 'Rabada', 'rabada, rabo bovino, rabo de boi', 400],
    ['file_tilapia', 'Filé de tilápia', 'file de tilapia, file tilapia, file de peixe', 200],
    ['posta_tilapia', 'Posta de tilápia', 'posta', 250],
    ['file_frango', 'Filé de frango', 'file de frango, peito de frango, file de peito, peito, sassami', 200],
    ['coxa', 'Coxa de frango', 'coxa, sobrecoxa', 400],
    ['galinha', 'Galinha', 'galinha', 400],
    ['carne_seca', 'Carne seca', 'carne seca, jaba', 150],
    ['bisteca', 'Bisteca', 'bisteca', null],
    ['figado', 'Fígado', 'figado', 200],
    ['bucho', 'Bucho (dobradinha)', 'bucho, dobradinha', null],
    ['bacalhau', 'Bacalhau', 'bacalhau', null],
    ['calabresa', 'Calabresa', 'calabresa', null],
  ];
  // ingredientes de preparo: nunca viram lote
  const EXCLUI = 'bacon, toscana, feijao, baiao';

  // qual prato usa qual carne (pelo nome do prato; editável em Rendimento → Ajustes)
  const REGRAS_PRATO = [
    [/feijoada/, 'feijoada'],
    [/calabresa/, 'calabresa'],
    [/virado|omelete/, null],
    [/parmegiana de frango|frango a parmegiana|file de frango|peito de frango|panqueca/, 'file_frango'],
    [/contra ?-?file|parmegiana/, 'contra_file'],
    [/picadinho|bife de panela/, 'capa_file'],
    [/frango assado|frango com creme|frango ao molho/, 'coxa'],
    [/galinha/, 'galinha'],
    [/rabada/, 'rabada'],
    [/costelinha/, 'costelinha'],
    [/costela/, 'costela'],
    [/jaba|carne seca/, 'carne_seca'],
    [/posta/, 'posta_tilapia'],
    [/file de tilapia|file de peixe|porcao de peixe|tilapia/, 'file_tilapia'],
    [/figado/, 'figado'],
    [/dobradinha|bucho/, 'bucho'],
    [/bisteca/, 'bisteca'],
    [/bacalhau/, 'bacalhau'],
  ];

  // lotes que já existiam (lista do dono, 12/10/2026) — entram uma vez em cada aparelho
  const IMPORT_TS = '2026-10-09T00:00:00.000Z';
  const LOTES_IMPORT = [
    { id: 'lote_imp_rabada_0710', carne: 'rabada', dia: '2026-10-07', fornecedor: 'Belo Boi', kg: 8.34, valor: 333.52, fim: '2026-10-08', base: { pratos: 14, venda: 495 } },
    { id: 'lote_imp_costela_0210', carne: 'costela', dia: '2026-10-02', fornecedor: 'Diversos', kg: 20.935, valor: 479.41, fim: '2026-10-08', base: { pratos: 33, venda: 1132 } },
    { id: 'lote_imp_frango_0110', carne: 'file_frango', dia: '2026-10-01', fornecedor: 'Belo Boi', kg: 6.436, valor: 160.84, fim: '2026-10-08', base: { pratos: 22, venda: 666 }, obs: 'Inclui 6 panquecas de 08/10.' },
    { id: 'lote_imp_contra_0110', carne: 'contra_file', dia: '2026-10-01', fornecedor: '', kg: 27.34, valor: 1227.57, base: { pratos: 45, de: '2026-10-01', ate: '2026-10-08' }, obs: '45 pratos até 08/10 (inclui 6 parmegianas de carne).' },
    { id: 'lote_imp_coxa_0510', carne: 'coxa', dia: '2026-10-05', fornecedor: '', kg: 10.58, valor: 126.85, base: { pratos: 27, de: '2026-10-05', ate: '2026-10-08' }, obs: '14 pratos em 05/10 e 13 em 06/10.' },
    { id: 'lote_imp_peito_0810', carne: 'file_frango', dia: '2026-10-08', fornecedor: '', kg: 15, valor: 235.20, base: { pratos: 12, de: '2026-10-08', ate: '2026-10-08', sem: 'panqueca' }, obs: 'Filé de peito. 12 pratos em 08/10 (7 filés + 5 parmegianas); as panquecas de 08/10 foram do lote de 01/10.' },
    { id: 'lote_imp_capa_0810', carne: 'capa_file', dia: '2026-10-08', fornecedor: '', kg: 27.07, valor: 771.50, base: { pratos: 0, venda: 0 } },
    { id: 'lote_imp_tilapia_0810', carne: 'file_tilapia', dia: '2026-10-08', fornecedor: 'Peixeiro', kg: 7.85, valor: 439.60, base: { pratos: 0, venda: 0 } },
    { id: 'lote_imp_posta_0810', carne: 'posta_tilapia', dia: '2026-10-08', fornecedor: 'Peixeiro', kg: 10.70, valor: 224.70, base: { pratos: 0, venda: 0 } },
  ];
  function semear() {
    const S = P.Store;
    if (S.meta('lotes_import_v1')) return;
    LOTES_IMPORT.forEach(l => {
      if (S.todos('lotes').some(x => x.id === l.id)) return;
      S.put('lotes', Object.assign({ compra_id: null, compra_item_id: null, fim: null, sobra_kg: null, sobra_dia: null, obs: null, conta_desde: INICIO, criado_em: IMPORT_TS, usuario_id: null }, l,
        { modificado_em: IMPORT_TS }), { stamp: false, silent: true });
    });
    S.setMeta('lotes_import_v1', true);
  }

  // ---------------------------------------------------------------
  //  Configuração (tabela config, chave 'rendimento')
  // ---------------------------------------------------------------
  function cfg() {
    const c = JSON.parse(JSON.stringify(P.cfg('rendimento') || {})); // cópia: salvarCfg mexe nela
    return { carnes: c.carnes || {}, pratos: c.pratos || {}, movidos: c.movidos || [], ignorar: c.ignorar || [], excluir: c.excluir != null ? c.excluir : EXCLUI };
  }
  function salvarCfg(muda) { const c = cfg(); muda(c); P.salvarCfg('rendimento', c); }
  const palavras = t => String(t || '').split(',').map(sa).filter(Boolean);
  function carnes() {
    const c = cfg();
    return CARNES.map(([id, nome, pal, meta]) => {
      const o = c.carnes[id] || {};
      return { id, nome, palavras: o.palavras != null ? o.palavras : pal, meta: o.meta !== undefined ? o.meta : meta };
    });
  }
  const carne = id => carnes().find(c => c.id === id) || { id, nome: id, palavras: '', meta: null };
  const nomeCarne = id => carne(id).nome;

  // nome da compra → carne (ou null se é ingrediente de preparo / não é carne de lote)
  function carneDaCompra(desc) {
    const t = ' ' + sa(desc) + ' ';
    if (palavras(cfg().excluir).some(p => t.includes(p))) return null;
    const c = carnes().find(x => palavras(x.palavras).some(p => t.includes(p)));
    return c ? c.id : null;
  }
  // prato → carne: o que o dono escolheu, senão a regra pelo nome
  function carnePeloNome(nome) {
    const t = sa(nome);
    for (const [re, c] of REGRAS_PRATO) if (re.test(t)) return c;
    return null;
  }
  function carneDoPrato(itemId, nome, c) {
    c = c || cfg();
    if (Object.prototype.hasOwnProperty.call(c.pratos, itemId)) return c.pratos[itemId] || null;
    const it = P.Store.get('itens', itemId);
    if (it && it.categoria !== 'PRATO') return null;
    return carnePeloNome(it ? it.nome : nome);
  }

  // ---------------------------------------------------------------
  //  Contas: em qual lote entra cada venda, e as métricas de cada lote
  // ---------------------------------------------------------------
  // mais antigo: dia da compra; no mesmo dia, o que começa a contar antes
  const ordemLote = (a, b) => (a.dia !== b.dia ? (a.dia < b.dia ? -1 : 1) : contaDesde(a) !== contaDesde(b) ? (contaDesde(a) < contaDesde(b) ? -1 : 1) : (a.criado_em || '') < (b.criado_em || '') ? -1 : 1);
  const contaDesde = l => l.conta_desde || l.dia;
  let memo = { v: -1 };
  function calcular() {
    if (memo.v === P.Store.versao) return memo;
    const c = cfg();
    const lotes = P.Store.all('lotes').sort(ordemLote);
    const porCarne = new Map();
    lotes.forEach(l => { if (!porCarne.has(l.carne)) porCarne.set(l.carne, []); porCarne.get(l.carne).push(l); });
    const st = new Map(lotes.map(l => [l.id, { pratos: 0, venda: 0, dias: new Map(), basePr: 0, baseV: 0, aviso: null }]));
    const porId = new Map(lotes.map(l => [l.id, l]));
    const semLote = new Map(); // carne → pratos vendidos sem lote aberto (a partir de INICIO)
    const vendas = []; // todas as linhas de prato com carne (para a base dos lotes importados)
    const cacheItem = new Map();
    const carneDe = (id, nome) => { if (!cacheItem.has(id)) cacheItem.set(id, carneDoPrato(id, nome, c)); return cacheItem.get(id); };
    P.Store.all('comandas').forEach(cm => {
      if (cm.status !== 'FECHADA') return;
      const D = cm.dia_operacional;
      P.Mesas.linhas(cm.id).forEach(ln => {
        const q = +ln.quantidade || 0;
        if (!(q > 0)) return;
        const cr = carneDe(ln.item_id, ln.nome);
        if (!cr) return;
        const v = q * (+ln.preco_unit || 0);
        vendas.push({ D, carne: cr, item_id: ln.item_id, nome: ln.nome, q, v });
        const lote = loteDaVenda(cr, D, ln.item_id, porCarne, porId, c);
        if (!lote) { if (D >= INICIO) semLote.set(cr, (semLote.get(cr) || 0) + q); return; }
        const s = st.get(lote.id);
        s.pratos += q; s.venda += v;
        if (!s.dias.has(D)) s.dias.set(D, new Map());
        const di = s.dias.get(D);
        if (!di.has(ln.item_id)) di.set(ln.item_id, { item_id: ln.item_id, nome: ln.nome, q: 0, v: 0, movido: c.movidos.some(m => m.dia === D && m.item_id === ln.item_id && m.lote_id === lote.id) });
        const g = di.get(ln.item_id);
        g.q += q; g.v += v;
      });
    });
    // lotes importados: os pratos (e a venda) de antes de conta_desde vêm da lista do dono
    lotes.forEach(l => {
      const b = l.base;
      if (!b) return;
      const s = st.get(l.id);
      s.basePr = +b.pratos || 0;
      if (b.venda != null) s.baseV = +b.venda || 0;
      else {
        const sem = b.sem ? sa(b.sem) : null;
        const ls = vendas.filter(x => x.carne === l.carne && x.D >= (b.de || l.dia) && x.D <= (b.ate || P.Dia.somaDias(contaDesde(l), -1)) && !(sem && sa(x.nome).includes(sem)));
        const q = ls.reduce((t, x) => t + x.q, 0), v = ls.reduce((t, x) => t + x.v, 0);
        if (!q) { s.baseV = 0; s.aviso = s.basePr ? 'A venda dos ' + s.basePr + ' pratos de antes de ' + P.Dia.rotuloCurto(contaDesde(l)) + ' não está no app: a venda e o "já se pagou?" estão sem ela.' : null; }
        else if (Math.abs(q - s.basePr) < 0.01) s.baseV = v;
        else {
          s.baseV = v / q * s.basePr;
          s.aviso = 'No app há ' + P.num(q) + ' pratos de ' + nomeCarne(l.carne).toLowerCase() + ' de ' + P.Dia.rotuloCurto(b.de || l.dia) + ' a ' + P.Dia.rotuloCurto(b.ate || l.dia) +
            '; vale a sua contagem (' + s.basePr + '). A venda desses pratos foi estimada pelo preço médio.';
        }
      }
      s.pratos += s.basePr; s.venda += s.baseV;
    });
    memo = { v: P.Store.versao, lotes, porCarne, st, semLote };
    return memo;
  }
  // a venda entra no lote ABERTO mais antigo daquela carne no dia (ou no lote para onde o dono moveu)
  function loteDaVenda(cr, D, itemId, porCarne, porId, c) {
    const mv = c.movidos.find(m => m.dia === D && m.item_id === itemId);
    if (mv) { const l = porId.get(mv.lote_id); if (l && l.carne === cr) return l; }
    const ls = porCarne.get(cr) || [];
    return ls.find(l => D >= contaDesde(l) && (!l.fim || D <= l.fim)) || null;
  }

  function metricas(l) {
    const s = calcular().st.get(l.id) || { pratos: 0, venda: 0, dias: new Map() };
    const kg = +l.kg || 0, valor = +l.valor || 0, pr = s.pratos, venda = s.venda;
    const m = {
      aberto: !l.fim, pratos: pr, venda, kg, valor, rsKg: kg ? valor / kg : null,
      g: pr ? kg * 1000 / pr : null, carnePrato: pr ? valor / pr : null,
      pct: venda ? valor / venda * 100 : null, sobra: venda - valor, dias: s.dias, aviso: s.aviso, meta: carne(l.carne).meta,
    };
    // peso que sobrou: ritmo de gramas por prato do que já saiu → pratos que ainda faltam
    if (m.aberto && l.sobra_kg != null && pr > 0 && kg > +l.sobra_kg) {
      m.ritmo = (kg - +l.sobra_kg) * 1000 / pr;
      m.faltam = +l.sobra_kg * 1000 / m.ritmo;
    }
    const gComparar = m.aberto ? m.ritmo : m.g;
    m.passouMeta = m.meta && gComparar ? gComparar > m.meta : false;
    m.gComparar = gComparar;
    return m;
  }
  // até 35% verde, de 35% a 45% amarelo, acima de 45% vermelho
  const corPct = p => (p == null ? 'neutro' : p <= 35 ? 'bom' : p <= 45 ? 'atencao' : 'critico');

  // ---------------------------------------------------------------
  //  Ações
  // ---------------------------------------------------------------
  function novoLote(o) {
    const u = P.Auth.usuario();
    return P.Store.put('lotes', {
      id: P.uuid(), carne: o.carne, dia: o.dia, fornecedor: o.fornecedor || '', kg: P.round(o.kg, 3), valor: P.round(o.valor, 2),
      compra_id: o.compra_id || null, compra_item_id: o.compra_item_id || null, fim: null, sobra_kg: null, sobra_dia: null,
      base: null, conta_desde: o.dia, obs: o.obs || null, criado_em: P.agoraISO(), usuario_id: u ? u.id : null,
    });
  }
  const alterar = (l, muda) => P.Store.put('lotes', Object.assign({}, l, muda));
  function abertos(cr) { return calcular().lotes.filter(l => !l.fim && (!cr || l.carne === cr)); }

  // folha com duas respostas → true (sim) / false (não) / null (fechou)
  function perguntar(msg, sim, nao, o) {
    o = o || {};
    return new Promise(res => {
      let feito = false;
      const fim = v => { feito = true; res(v); sh.fechar(); };
      const sh = P.UI.sheet(h('div', { class: 'confirma' },
        h('p', null, msg), o.sub ? h('p', { class: 'rd-sub' }, o.sub) : null,
        h('div', { class: 'row gap' },
          h('button', { type: 'button', class: 'btn grow', onClick: () => fim(false) }, nao),
          h('button', { type: 'button', class: 'btn grow primario', onClick: () => fim(true) }, sim))),
      { titulo: o.titulo, onFechar: () => { if (!feito) res(null); } });
    });
  }
  function pedirTexto(titulo, valor, placeholder) {
    return new Promise(resolve => {
      let feito = false;
      const inp = h('input', { class: 'campo', type: 'text', value: valor || '', placeholder: placeholder || '', autocomplete: 'off', enterkeyhint: 'done' });
      const fim = () => { feito = true; resolve(inp.value.trim()); sh.fechar(); };
      inp.addEventListener('keydown', e => { if (e.key === 'Enter') fim(); });
      const sh = P.UI.sheet(h('div', { class: 'np-sheet' }, inp,
        h('div', { class: 'row gap' }, h('button', { type: 'button', class: 'btn', onClick: () => sh.fechar() }, 'Cancelar'),
          h('button', { type: 'button', class: 'btn primario grow', onClick: fim }, 'OK'))),
      { titulo, onFechar: () => { if (!feito) resolve(null); } });
      setTimeout(() => inp.focus(), 80);
    });
  }

  // "O lote anterior de [carne] acabou?" — sim fecha no dia dado; não deixa os dois abertos
  async function perguntarAnterior(cr, novoId, dia) {
    const ants = abertos(cr).filter(l => l.id !== novoId && l.dia <= dia);
    for (const a of ants) {
      const m = metricas(a);
      const r = await perguntar('O lote anterior de ' + nomeCarne(cr).toLowerCase() + ' (' + P.Dia.rotuloCurto(a.dia) + ') acabou?', 'Sim, acabou', 'Não, ainda tem',
        { sub: P.num(m.pratos) + ' pratos até agora. Se ainda tem, os dois ficam abertos e as vendas continuam no mais antigo até você marcar "Acabou".' });
      if (r) alterar(a, { fim: dia < a.dia ? a.dia : dia });
    }
  }

  // Depois de salvar uma compra: carne principal → abrir lote? (só pergunta ao dono)
  async function aposCompra(compra) {
    if (!compra || !P.Auth.isDono()) return;
    const c = cfg();
    const linhas = P.Compras.itensDe(compra.id).map(l => ({ l, cr: carneDaCompra(l.descricao) || carneDaCompra(insumoNome(l)) })).filter(x => x.cr);
    for (const { l, cr } of linhas) {
      if (P.Store.all('lotes').some(x => x.compra_id === compra.id && x.carne === cr)) continue;
      if (c.ignorar.includes(compra.id + ':' + cr)) continue;
      const kg0 = l.unidade === 'kg' ? +l.quantidade : null;
      const r = await perguntar('Abrir um lote novo de ' + nomeCarne(cr).toLowerCase() + '?', 'Abrir lote', 'Não é lote',
        { titulo: 'Rendimento', sub: l.descricao + ' · ' + (kg0 != null ? P.numAuto(kg0) + ' kg · ' : '') + P.brl(l.valor) + (kg0 ? ' · ' + P.brl(l.valor / kg0) + '/kg' : '') });
      if (r === null) return;
      if (!r) { salvarCfg(x => { x.ignorar = x.ignorar.concat(compra.id + ':' + cr); }); continue; }
      const kg = kg0 != null ? kg0 : await P.UI.pedirNumero({ titulo: 'Quantos kg de ' + nomeCarne(cr).toLowerCase() + '?', decimais: 3, sufixo: ' kg' });
      if (!(kg > 0)) continue;
      const novo = novoLote({ carne: cr, dia: compra.dia_operacional, fornecedor: compra.fornecedor, kg, valor: +l.valor, compra_id: compra.id, compra_item_id: l.id });
      await perguntarAnterior(cr, novo.id, compra.dia_operacional);
      P.UI.toast('Lote de ' + nomeCarne(cr).toLowerCase() + ' aberto · ' + P.numAuto(kg) + ' kg', { acao: { rotulo: 'Ver', fn: () => { location.hash = '#/rendimento'; } } });
    }
  }
  function insumoNome(l) { const i = l.insumo_id && P.Store.get('insumos', l.insumo_id); return i ? i.nome : ''; }

  // compras de carne (a partir de INICIO) que ainda não viraram lote nem foram marcadas "não é lote"
  function comprasSemLote() {
    const c = cfg();
    const out = [];
    P.Store.all('compras').filter(cp => cp.dia_operacional >= INICIO).forEach(cp => {
      P.Compras.itensDe(cp.id).forEach(l => {
        const cr = carneDaCompra(l.descricao) || carneDaCompra(insumoNome(l));
        if (!cr || c.ignorar.includes(cp.id + ':' + cr)) return;
        if (P.Store.all('lotes').some(x => x.compra_id === cp.id && x.carne === cr)) return;
        if (out.some(o => o.compra.id === cp.id && o.cr === cr)) return;
        out.push({ compra: cp, l, cr });
      });
    });
    return out.sort((a, b) => (a.compra.dia_operacional < b.compra.dia_operacional ? -1 : 1));
  }

  async function acabou(l) {
    const hoje = P.Dia.hoje();
    const dia = hoje < l.dia ? l.dia : hoje;
    const ok = await P.UI.confirmar('Fechar o lote de ' + nomeCarne(l.carne).toLowerCase() + ' de ' + P.Dia.rotuloCurto(l.dia) + ' com a data de hoje (' + P.Dia.rotuloCurto(dia) + ')?', { ok: 'Acabou', titulo: 'Acabou' });
    if (!ok) return;
    const novo = alterar(l, { fim: dia });
    const m = metricas(novo);
    P.vibrar([20, 40, 20]);
    P.UI.sheet(h('div', { class: 'rd-fim' },
      h('p', null, nomeCarne(l.carne) + ' de ' + P.Dia.rotuloCurto(l.dia) + ' rendeu ', h('b', null, P.num(m.pratos) + (m.pratos === 1 ? ' prato' : ' pratos')), '.'),
      grade(m, false),
      h('a', { class: 'btn bloco', href: '#/rendimento/l/' + l.id }, 'Ver o lote')), { titulo: 'Lote fechado' });
  }
  async function pesoSobrou(l) {
    const v = await P.UI.pedirNumero({ titulo: 'Peso que sobrou (kg)', sub: 'Pese o que ainda tem de ' + nomeCarne(l.carne).toLowerCase() + ' deste lote. Com isso o app estima quantos pratos ainda saem.', valor: l.sobra_kg, decimais: 3, sufixo: ' kg' });
    if (v == null) return;
    if (v > +l.kg) { P.UI.toast('Sobrou mais do que foi comprado? Confira o peso.', { tipo: 'perigo' }); return; }
    alterar(l, { sobra_kg: v || null, sobra_dia: v ? P.Dia.hoje() : null });
  }

  // ---------------------------------------------------------------
  //  Telas
  // ---------------------------------------------------------------
  function subnavRend(ativo) {
    return P.UI.subnav([{ id: 'lotes', rota: 'rendimento', rotulo: 'Lotes' }, { id: 'comparar', rota: 'rendimento/comparar', rotulo: 'Comparar' }, { id: 'ajustes', rota: 'rendimento/ajustes', rotulo: 'Ajustes' }], ativo);
  }
  const st = (rot, val, cls, sub) => h('div', { class: 'rd-st' + (cls ? ' ' + cls : '') }, h('small', null, rot), h('b', null, val), sub ? h('em', null, sub) : null);
  const gramas = g => (g == null ? '—' : P.num(g, 0) + ' g');
  function pillPct(m) {
    return m.pct == null ? h('span', { class: 'st-pill st-neutro' }, 'sem venda') : P.UI.statusPill(corPct(m.pct), P.pct(m.pct, 0));
  }
  // métricas de um lote fechado (ou do aberto até agora)
  function grade(m, aberto) {
    if (aberto) {
      const pagou = m.sobra;
      return h('div', { class: 'rd-grade' },
        st('Pratos até agora', P.num(m.pratos)),
        st('Venda até agora', P.brl(m.venda)),
        st('Já se pagou?', pagou > 0 ? 'Sim, +' + P.brl(pagou) : 'Faltam ' + P.brl(-pagou), pagou > 0 ? 'bom' : 'critico'),
        m.faltam != null ? st('Ainda saem', '~' + P.num(m.faltam, 0) + ' pratos', null, gramas(m.ritmo) + ' por prato') : null,
        m.faltam != null ? st('Carne / venda até agora', P.pct(m.pct, 0), m.pct == null ? null : corPct(m.pct)) : null);
    }
    return h('div', { class: 'rd-grade' },
      st('Pratos', P.num(m.pratos)),
      st('Venda dos pratos', P.brl(m.venda)),
      st('Gramas por prato', gramas(m.g), m.passouMeta ? 'atencao' : null, m.meta ? 'meta ' + m.meta + ' g' : null),
      st('Carne por prato', m.carnePrato == null ? '—' : P.brl(m.carnePrato)),
      h('div', { class: 'rd-st' }, h('small', null, 'Carne / venda'), pillPct(m)),
      st('Sobra depois da carne', P.brl(m.sobra), m.sobra >= 0 ? 'bom' : 'critico'));
  }
  function cartao(l) {
    const m = metricas(l);
    const sub = [P.Dia.rotuloCurto(l.dia) + (l.fim ? ' → ' + P.Dia.rotuloCurto(l.fim) : ''), !l.base && contaDesde(l) > l.dia ? 'conta desde ' + P.Dia.rotuloCurto(contaDesde(l)) : null, l.fornecedor, P.numAuto(m.kg, 3) + ' kg', P.brl(m.valor), m.rsKg ? P.brl(m.rsKg) + '/kg' : null].filter(Boolean).join(' · ');
    return h('div', { class: 'rd-card' + (m.aberto ? ' aberto' : '') },
      h('a', { class: 'rd-topo', href: '#/rendimento/l/' + l.id },
        h('div', { class: 'rd-tit' }, h('b', null, nomeCarne(l.carne)), h('small', null, sub)),
        m.aberto ? h('span', { class: 'tag ok' }, 'aberto') : pillPct(m), P.UI.icone('avancar')),
      grade(m, m.aberto),
      m.passouMeta ? h('div', { class: 'banner aviso rd-ban' }, P.UI.icone('alerta'), h('span', null, (m.aberto ? 'No ritmo de agora, ' : '') + gramas(m.gComparar) + ' por prato: passou da meta de ' + m.meta + ' g.')) : null,
      m.aviso ? h('div', { class: 'rd-nota' }, m.aviso) : null,
      m.aberto ? h('div', { class: 'row gap rd-acoes' },
        h('button', { type: 'button', class: 'btn grow', onClick: () => pesoSobrou(l) }, l.sobra_kg != null ? 'Sobrou ' + P.numAuto(l.sobra_kg, 3) + ' kg' : 'Peso que sobrou'),
        h('button', { type: 'button', class: 'btn grow primario', onClick: () => acabou(l) }, P.UI.icone('check'), 'Acabou')) : null);
  }

  async function lancarLote(pre) {
    pre = pre || {};
    let cr = pre.cr;
    if (!cr) {
      cr = await P.UI.escolher({ titulo: 'Qual carne?', opcoes: carnes().map(c => ({ v: c.id, rotulo: c.nome })) });
      if (!cr) return;
    }
    const kg = pre.kg != null ? pre.kg : await P.UI.pedirNumero({ titulo: nomeCarne(cr) + ' — quantos kg?', decimais: 3, sufixo: ' kg' });
    if (!(kg > 0)) return;
    const valor = pre.valor != null ? pre.valor : await P.UI.pedirNumero({ titulo: nomeCarne(cr) + ' — valor pago', decimais: 2, prefixo: 'R$ ' });
    if (!(valor > 0)) return;
    const forn = pre.fornecedor != null ? pre.fornecedor : await pedirTexto('Fornecedor (opcional)', '', 'Ex.: Belo Boi');
    if (forn == null) return;
    const dia = pre.dia || P.Dia.hoje();
    const novo = novoLote({ carne: cr, dia, fornecedor: forn, kg, valor, compra_id: pre.compra_id, compra_item_id: pre.compra_item_id });
    await perguntarAnterior(cr, novo.id, dia);
    P.UI.toast('Lote de ' + nomeCarne(cr).toLowerCase() + ' aberto');
  }

  function telaLotes(view) {
    view.className = 'v-rend';
    const corpo = h('div');
    let verFechados = false;
    function desenhar() {
      const R = calcular();
      const ab = R.lotes.filter(l => !l.fim).sort((a, b) => (nomeCarne(a.carne).localeCompare(nomeCarne(b.carne), 'pt-BR')) || ordemLote(a, b));
      const fe = R.lotes.filter(l => l.fim).sort((a, b) => (a.fim < b.fim ? 1 : a.fim > b.fim ? -1 : ordemLote(b, a)));
      const pend = comprasSemLote();
      trocar(corpo, 
        pend.length ? h('section', null, h('div', { class: 'secao' }, 'Compras de carne sem lote (' + pend.length + ')'),
          h('div', { class: 'rd-pend' }, pend.map(x => h('div', { class: 'rd-pend-l' },
            h('div', { class: 'rd-tit' }, h('b', null, nomeCarne(x.cr)), h('small', null, P.Dia.rotuloCurto(x.compra.dia_operacional) + ' · ' + (x.compra.fornecedor || 'compra') + ' · ' + x.l.descricao + ' · ' + (x.l.unidade === 'kg' ? P.numAuto(+x.l.quantidade, 3) + ' kg · ' : '') + P.brl(x.l.valor))),
            h('div', { class: 'row gap' },
              h('button', { type: 'button', class: 'btn mini', onClick: () => salvarCfg(c => { c.ignorar = c.ignorar.concat(x.compra.id + ':' + x.cr); }) }, 'Não é lote'),
              h('button', { type: 'button', class: 'btn mini primario', onClick: () => lancarLote({ cr: x.cr, kg: x.l.unidade === 'kg' ? +x.l.quantidade : null, valor: +x.l.valor, fornecedor: x.compra.fornecedor || '', dia: x.compra.dia_operacional, compra_id: x.compra.id, compra_item_id: x.l.id }) }, 'Abrir lote')))))) : null,
        h('div', { class: 'secao' }, 'Lotes abertos (' + ab.length + ')'),
        ab.length ? h('div', { class: 'rd-lista' }, ab.map(cartao)) : P.UI.vazio('Nenhum lote aberto. Ao lançar uma compra de carne ou peixe, o app pergunta se é para abrir um lote.', 'custos'),
        h('button', { type: 'button', class: 'btn bloco rd-novo', onClick: () => lancarLote() }, P.UI.icone('mais'), 'Lançar lote à mão'),
        R.semLote.size ? h('div', { class: 'rd-nota' }, 'Pratos vendidos sem lote aberto: ' + [...R.semLote.entries()].map(([cr, q]) => nomeCarne(cr) + ' ' + P.num(q)).join(' · ') + '. Abra um lote dessa carne para eles contarem.') : null,
        h('div', { class: 'secao' }, 'Lotes fechados (' + fe.length + ')'),
        fe.length ? h('div', { class: 'rd-lista' }, (verFechados ? fe : fe.slice(0, 12)).map(cartao)) : h('div', { class: 'dica' }, 'Nenhum lote fechado ainda.'),
        !verFechados && fe.length > 12 ? h('button', { type: 'button', class: 'btn bloco', onClick: () => { verFechados = true; desenhar(); } }, 'Mostrar todos os ' + fe.length) : null,
        h('div', { class: 'dica' }, 'Cor pela carne / venda: até 35% verde, de 35% a 45% amarelo, acima de 45% vermelho.'));
    }
    view.append(subnavRend('lotes'), corpo);
    desenhar();
    return { onDados: desenhar };
  }

  function telaLote(view, params) {
    view.className = 'v-rend';
    const corpo = h('div');
    const voltar = h('a', { class: 'voltar', href: '#/rendimento' }, P.UI.icone('voltar'), 'Rendimento');
    function desenhar() {
      const l = P.Store.get('lotes', params.id);
      if (!l) { trocar(corpo, P.UI.vazio('Lote não encontrado.')); return; }
      const m = metricas(l);
      const linha = (rot, val, fn) => h('button', { type: 'button', class: 'aj-lin toque', onClick: fn }, h('span', { class: 'aj-rot' }, rot), h('span', { class: 'aj-val' }, val), P.UI.icone('lapis'));
      const outros = (calcular().porCarne.get(l.carne) || []).filter(x => x.id !== l.id);
      const dias = [...m.dias.entries()].sort((a, b) => (a[0] < b[0] ? 1 : -1));
      trocar(corpo, 
        cartao(l),
        l.obs ? h('div', { class: 'rd-nota' }, l.obs) : null,
        l.base ? h('div', { class: 'rd-nota' }, 'Lote importado: ' + P.num(+l.base.pratos || 0) + ' pratos' + (l.base.venda != null ? ' (' + P.brl(l.base.venda) + ')' : '') + ' da sua contagem até ' + P.Dia.rotuloCurto(P.Dia.somaDias(contaDesde(l), -1)) + '; depois disso as vendas entram sozinhas.') : null,
        h('div', { class: 'secao' }, 'Pratos por dia'),
        dias.length ? h('div', { class: 'rd-dias' }, dias.map(([D, itens]) => h('div', { class: 'rd-dia' },
          h('div', { class: 'rd-dia-t' }, P.Dia.rotulo(D)),
          [...itens.values()].map(g => h('div', { class: 'rd-dia-l' },
            h('span', null, P.num(g.q, g.q % 1 ? 1 : 0) + '× ' + g.nome, g.movido ? h('small', { class: 'tag neutra' }, 'movido') : null),
            h('span', null, P.brl(g.v)),
            outros.length || g.movido ? h('button', { type: 'button', class: 'btn mini', onClick: () => mover(l, D, g) }, 'Mover') : null))))) :
          h('div', { class: 'dica' }, 'Nenhuma venda contada neste lote ainda.'),
        h('div', { class: 'secao' }, 'Dados do lote'),
        h('div', { class: 'aj-sec' },
          linha('Carne', nomeCarne(l.carne), async () => { const v = await P.UI.escolher({ titulo: 'Qual carne?', opcoes: carnes().map(c => ({ v: c.id, rotulo: c.nome })) }); if (v) alterar(l, { carne: v }); }),
          linha('Dia da compra', P.Dia.rotulo(l.dia), () => P.Compras.calendario(l.dia, iso => alterar(l, { dia: iso, conta_desde: l.base || contaDesde(l) > l.dia && contaDesde(l) >= iso ? l.conta_desde : iso, fim: l.fim && l.fim < iso ? iso : l.fim }), { titulo: 'Dia da compra' })),
          l.base ? null : linha('Vendas contam desde', P.Dia.rotulo(contaDesde(l)), () => P.Compras.calendario(contaDesde(l), iso => {
            if (iso < l.dia) { P.UI.toast('Antes do dia da compra?', { tipo: 'perigo' }); return; }
            alterar(l, { conta_desde: iso });
          }, { titulo: 'Dia em que começou a usar' })),
          linha('Fornecedor', l.fornecedor || '—', async () => { const v = await pedirTexto('Fornecedor', l.fornecedor, 'Ex.: Belo Boi'); if (v != null) alterar(l, { fornecedor: v }); }),
          linha('Peso (kg)', P.numAuto(+l.kg, 3) + ' kg', async () => { const v = await P.UI.pedirNumero({ titulo: 'Peso do lote (kg)', valor: +l.kg, decimais: 3, sufixo: ' kg' }); if (v > 0) alterar(l, { kg: v }); }),
          linha('Valor pago', P.brl(l.valor), async () => { const v = await P.UI.pedirNumero({ titulo: 'Valor pago', valor: +l.valor, decimais: 2, prefixo: 'R$ ' }); if (v > 0) alterar(l, { valor: v }); }),
          l.fim ? linha('Acabou em', P.Dia.rotulo(l.fim), () => P.Compras.calendario(l.fim, iso => { if (iso < l.dia) { P.UI.toast('Acabou antes da compra?', { tipo: 'perigo' }); return; } alterar(l, { fim: iso }); }, { titulo: 'Dia em que acabou' })) : null),
        h('div', { class: 'row gap rd-acoes' },
          l.fim ? h('button', { type: 'button', class: 'btn grow', onClick: () => alterar(l, { fim: null }) }, 'Reabrir o lote') : null,
          h('button', { type: 'button', class: 'btn grow perigo', onClick: async () => {
            if (await P.UI.confirmar('Apagar este lote? As vendas dele passam para o próximo lote aberto da mesma carne (as vendas e a compra não mudam).', { perigo: true, ok: 'Apagar lote' })) {
              P.Store.remove('lotes', l.id);
              location.hash = '#/rendimento';
            }
          } }, P.UI.icone('lixo'), 'Apagar lote')));
    }
    async function mover(l, D, g) {
      const outros = (calcular().porCarne.get(l.carne) || []).filter(x => x.id !== l.id);
      const opcoes = outros.map(x => ({ v: x.id, rotulo: 'Lote de ' + P.Dia.rotuloCurto(x.dia) + (x.fornecedor ? ' · ' + x.fornecedor : ''), sub: x.fim ? 'fechado em ' + P.Dia.rotuloCurto(x.fim) : 'aberto' }));
      if (g.movido) opcoes.unshift({ v: '_auto', rotulo: 'Voltar ao automático', sub: 'o lote aberto mais antigo do dia' });
      const v = await P.UI.escolher({ titulo: 'Mover ' + P.num(g.q) + '× ' + g.nome + ' de ' + P.Dia.rotuloCurto(D) + ' para', opcoes });
      if (!v) return;
      salvarCfg(c => {
        c.movidos = c.movidos.filter(x => !(x.dia === D && x.item_id === g.item_id));
        if (v !== '_auto') c.movidos.push({ dia: D, item_id: g.item_id, lote_id: v });
      });
      P.UI.toast('Pratos movidos');
    }
    view.append(voltar, corpo);
    desenhar();
    return { onDados: desenhar };
  }

  // Comparar lotes da mesma carne: fornecedor, R$/kg, gramas por prato e carne / venda
  let carneComp = null;
  function telaComparar(view) {
    view.className = 'v-rend';
    const corpo = h('div');
    function desenhar() {
      const R = calcular();
      const com = carnes().filter(c => (R.porCarne.get(c.id) || []).length);
      if (!com.length) { trocar(corpo, P.UI.vazio('Nenhum lote ainda.', 'custos')); return; }
      if (!carneComp || !com.some(c => c.id === carneComp)) carneComp = com[0].id;
      const ls = (R.porCarne.get(carneComp) || []).slice().reverse();
      const meta = carne(carneComp).meta;
      trocar(corpo, 
        h('div', { class: 'chips dp-chips' }, com.map(c => h('button', { type: 'button', class: 'chip' + (c.id === carneComp ? ' on' : ''), onClick: () => { carneComp = c.id; desenhar(); } }, c.nome + ' (' + R.porCarne.get(c.id).length + ')'))),
        h('div', { class: 'dp-cmp rd-cmp' },
          h('div', { class: 'dp-cmp-l th' }, h('span', { class: 'dp-cmp-n' }, 'Lote'), h('span', null, 'R$/kg'), h('span', null, 'g/prato'), h('span', null, 'Carne/venda')),
          ls.map(l => {
            const m = metricas(l);
            return h('a', { class: 'dp-cmp-l', href: '#/rendimento/l/' + l.id },
              h('span', { class: 'dp-cmp-n' }, P.Dia.rotuloCurto(l.dia) + ' · ' + (l.fornecedor || 'sem fornecedor') + (m.aberto ? ' · aberto' : '')),
              h('span', null, m.rsKg ? P.brl(m.rsKg) : '—'),
              h('span', { class: m.passouMeta ? 't-amarelo' : '' }, m.aberto ? (m.ritmo ? gramas(m.ritmo) : '—') : gramas(m.g)),
              h('span', { class: m.pct == null ? '' : 't-' + ({ bom: 'verde', atencao: 'amarelo', critico: 'vermelho' }[corPct(m.pct)]) }, P.pct(m.pct, 0)));
          })),
        h('div', { class: 'dica' }, (meta ? 'Meta: ' + meta + ' g por prato. ' : '') + 'Lote aberto: gramas por prato só com o "peso que sobrou"; carne / venda até agora.'));
    }
    view.append(subnavRend('comparar'), corpo);
    desenhar();
    return { onDados: desenhar };
  }

  // Ajustes: metas, palavras de cada carne e qual prato usa qual carne
  function telaAjustes(view) {
    view.className = 'v-rend';
    const corpo = h('div');
    function desenhar() {
      const c = cfg();
      const lin = (rot, sub, val, fn) => h('button', { type: 'button', class: 'aj-lin toque', onClick: fn }, h('span', { class: 'aj-rot' }, rot, sub ? h('small', null, sub) : null), h('span', { class: 'aj-val' }, val), P.UI.icone('lapis'));
      const pratos = P.Store.all('itens').filter(it => it.categoria === 'PRATO' && it.ativo !== false && +it.preco_venda > 0).sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
      trocar(corpo, 
        h('div', { class: 'secao' }, 'Qual prato usa qual carne'),
        h('div', { class: 'dica' }, 'Prato sem carne de lote (virado, omelete…) não conta em lote nenhum; a feijoada conta no lote dos pertences. Toque para trocar.'),
        h('div', { class: 'aj-sec' }, pratos.map(it => {
          const escolhido = Object.prototype.hasOwnProperty.call(c.pratos, it.id);
          const cr = carneDoPrato(it.id, it.nome, c);
          return lin(it.nome, escolhido ? 'escolhido por você' : 'pelo nome', cr ? nomeCarne(cr) : 'não conta', async () => {
            const v = await P.UI.escolher({ titulo: it.nome + ' usa', opcoes: [{ v: '_auto', rotulo: 'Automático (pelo nome)', sub: carnePeloNome(it.nome) ? nomeCarne(carnePeloNome(it.nome)) : 'não conta' }, { v: '_nenhuma', rotulo: 'Nenhuma carne de lote' }].concat(carnes().map(x => ({ v: x.id, rotulo: x.nome }))) });
            if (!v) return;
            salvarCfg(x => { if (v === '_auto') delete x.pratos[it.id]; else x.pratos[it.id] = v === '_nenhuma' ? '' : v; });
          });
        })),
        h('div', { class: 'secao' }, 'Meta de gramas por prato'),
        h('div', { class: 'aj-sec' }, carnes().map(x => lin(x.nome, null, x.meta ? x.meta + ' g' : 'sem meta', async () => {
          const v = await P.UI.pedirNumero({ titulo: 'Meta de ' + x.nome.toLowerCase() + ' (g por prato)', valor: x.meta, decimais: 0, maxInteiros: 4, sufixo: ' g', sub: 'Deixe 0 para ficar sem meta.' });
          if (v == null) return;
          salvarCfg(k => { k.carnes[x.id] = Object.assign({}, k.carnes[x.id], { meta: v > 0 ? v : null }); });
        }))),
        h('div', { class: 'secao' }, 'Palavras da compra que abrem lote'),
        h('div', { class: 'aj-sec' }, carnes().map(x => lin(x.nome, x.palavras, '', async () => {
          const v = await pedirTexto('Palavras de ' + x.nome.toLowerCase() + ' (separe por vírgula)', x.palavras);
          if (v == null) return;
          salvarCfg(k => { k.carnes[x.id] = Object.assign({}, k.carnes[x.id], { palavras: v }); });
        })),
          lin('Nunca vira lote', c.excluir, '', async () => {
            const v = await pedirTexto('Ingredientes de preparo (separe por vírgula)', c.excluir);
            if (v != null) salvarCfg(k => { k.excluir = v; });
          })));
    }
    view.append(subnavRend('ajustes'), corpo);
    desenhar();
    return { onDados: desenhar };
  }

  function textoTile() {
    const ab = abertos();
    const passou = ab.filter(l => metricas(l).passouMeta).length;
    return ab.length ? ab.length + (ab.length === 1 ? ' lote aberto' : ' lotes abertos') + (passou ? ' · ' + passou + ' acima da meta' : '') : 'pratos por lote de carne';
  }

  P.UI.rota('rendimento', { titulo: 'Rendimento', tab: 'mais', dono: true, render: telaLotes });
  P.UI.rota('rendimento/l/:id', { titulo: 'Lote', tab: 'mais', dono: true, render: telaLote });
  P.UI.rota('rendimento/comparar', { titulo: 'Rendimento', tab: 'mais', dono: true, render: telaComparar });
  P.UI.rota('rendimento/ajustes', { titulo: 'Rendimento', tab: 'mais', dono: true, render: telaAjustes });
  P.Rendimento = { semear, calcular, metricas, carneDaCompra, carneDoPrato, aposCompra, textoTile, corPct, abertos, nomeCarne, INICIO,
    carneValida: id => CARNES.some(c => c[0] === id) };
})();
