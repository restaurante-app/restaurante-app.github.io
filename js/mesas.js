/* MESAS — comandas ao vivo.
   Abre a mesa com o nome do cliente → toca nos itens conforme são consumidos
   (cada adição fica com o horário) → total automático → forma de pagamento.
   Tudo entra no painel e no relatório: faturamento, CMV, lucro, horário.
   Também: venda rápida no balcão, marmita, despesas do dia e fiado. */
(function () {
  'use strict';
  const P = window.P;
  const h = P.UI.h;
  const FORMAS = [
    { v: 'DINHEIRO', rotulo: 'Dinheiro' }, { v: 'PIX', rotulo: 'Pix' },
    { v: 'DEBITO', rotulo: 'Débito' }, { v: 'CREDITO', rotulo: 'Crédito' }, { v: 'FIADO', rotulo: 'Fiado' },
  ];
  const NOME_FORMA = { DINHEIRO: 'Dinheiro', PIX: 'Pix', DEBITO: 'Débito', CREDITO: 'Crédito', FIADO: 'Fiado' };
  const EM_FORMA = { DINHEIRO: 'em dinheiro', PIX: 'no Pix', DEBITO: 'no débito', CREDITO: 'no crédito', FIADO: 'no fiado' };
  const ICONE_FORMA = { DINHEIRO: 'dinheiro', PIX: 'pix', DEBITO: 'cartao', CREDITO: 'cartao', FIADO: 'fiado', CARTAO: 'cartao', PRAZO: 'prazo' };
  const NOME_CANAL = { ESPETO: 'Espeto', SALAO: 'Salão', MARMITA: 'Marmita' };
  // fixo: salário, aluguel, contas, impostos e pró-labore — entram no lucro e no caixa do dia em
  // que foram pagos (os custos fixos de Ajustes ficam só como base de previsão); só o dono vê.
  // fora: investimento (equipamento, obra) — sai do caixa, mas não é custo do mês (fora do lucro).
  const CAT_DESPESA = [
    { v: 'MERCADORIA', rotulo: 'Mercadoria' }, { v: 'GAS_CARVAO', rotulo: 'Gás / carvão' },
    { v: 'EMBALAGEM', rotulo: 'Embalagem' }, { v: 'LIMPEZA', rotulo: 'Limpeza' }, { v: 'MANUTENCAO', rotulo: 'Manutenção' },
    { v: 'FUNCIONARIOS', rotulo: 'Funcionários', fixo: true }, { v: 'ALUGUEL', rotulo: 'Aluguel', fixo: true },
    { v: 'CONTAS', rotulo: 'Luz / água / net', fixo: true }, { v: 'IMPOSTOS', rotulo: 'Impostos e taxas', fixo: true },
    { v: 'PROLABORE', rotulo: 'Pró-labore (retirada)', fixo: true }, { v: 'INVESTIMENTO', rotulo: 'Investimento', dono: true, fora: true },
    { v: 'OUTROS', rotulo: 'Outros' },
  ];
  const NOME_DESP = Object.fromEntries(CAT_DESPESA.map(c => [c.v, c.rotulo]));
  const DESP_FIXA = new Set(CAT_DESPESA.filter(c => c.fixo).map(c => c.v));
  const DESP_DONO = new Set(CAT_DESPESA.filter(c => c.fixo || c.dono).map(c => c.v));
  const DESP_FORA = new Set(CAT_DESPESA.filter(c => c.fora).map(c => c.v)); // fora do lucro (só caixa)
  const FORMAS_DESP = [
    { v: 'DINHEIRO', rotulo: 'Dinheiro' }, { v: 'PIX', rotulo: 'Pix' }, { v: 'CARTAO', rotulo: 'Cartão' }, { v: 'BOLETO', rotulo: 'Boleto / transf.' },
  ];
  const NOME_FORMA_DESP = Object.fromEntries(FORMAS_DESP.map(f => [f.v, f.rotulo]));
  // tipo do pagamento da equipe
  const SUBTIPOS = [
    { v: 'VALE', rotulo: 'Vale (adiantamento)' }, { v: 'CONDUCAO', rotulo: 'Condução' }, { v: 'SALARIO', rotulo: 'Salário' },
    { v: 'SEMANA', rotulo: 'Semana' }, { v: 'DIARIA', rotulo: 'Diária' }, { v: 'OUTRO', rotulo: 'Outro' },
  ];
  const NOME_SUBTIPO = Object.fromEntries(SUBTIPOS.map(s => [s.v, s.rotulo]));
  const despVisivel = d => P.Auth.isDono() || !DESP_DONO.has(d.categoria);
  function subDesp(d) {
    const pes = d.pessoa_id && P.Store.get('pessoas', d.pessoa_id);
    return NOME_DESP[d.categoria] + (pes ? ' · ' + pes.nome : '') + (d.subtipo ? ' · ' + (NOME_SUBTIPO[d.subtipo] || d.subtipo).replace(' (adiantamento)', '') : '') +
      (d.forma ? ' · ' + NOME_FORMA_DESP[d.forma] : '');
  }
  // venda lançada depois (pelo caderno/relatório): não tem horário de verdade
  const semHora = c => !!(c && c.origem);
  const AGRUPA_MS = 90 * 1000; // toques seguidos no mesmo item viram uma linha só

  // ---------------------------------------------------------------
  //  Dados
  // ---------------------------------------------------------------
  let cache = { v: -1 };
  function idx() {
    if (cache.v === P.Store.versao) return cache;
    const itens = new Map(), pags = new Map();
    P.Store.all('comanda_itens').forEach(l => { if (!itens.has(l.comanda_id)) itens.set(l.comanda_id, []); itens.get(l.comanda_id).push(l); });
    P.Store.all('pagamentos').forEach(p => { if (!pags.has(p.comanda_id)) pags.set(p.comanda_id, []); pags.get(p.comanda_id).push(p); });
    itens.forEach(l => l.sort((a, b) => (a.adicionado_em < b.adicionado_em ? -1 : 1)));
    cache = { v: P.Store.versao, itens, pags };
    return cache;
  }
  const linhas = cid => idx().itens.get(cid) || [];
  const pagamentos = cid => idx().pags.get(cid) || [];
  const subtotal = cid => linhas(cid).reduce((s, l) => s + (+l.quantidade || 0) * (+l.preco_unit || 0), 0);
  const totalDe = c => Math.max(0, P.round(subtotal(c.id) - (+c.desconto || 0), 2));
  const qtdItens = cid => linhas(cid).reduce((s, l) => s + (+l.quantidade || 0), 0);
  // Conta aberta paga por partes (ex.: um da mesa paga a parte dele e vai embora): cada parte vira um
  // pagamento na hora, abate do total e entra no caixa do dia em que foi paga; no Fechar conta só
  // falta o resto. Reabrir para corrigir desfaz só o que foi pago ao fechar (as partes ficam).
  const jaPago = c => P.round(pagamentos(c.id).reduce((s, p) => s + (+p.valor || 0), 0), 2);
  const faltaDe = c => Math.max(0, P.round(totalDe(c) - jaPago(c), 2));
  function pagarParte(c, valor, forma) {
    const u = P.Auth.usuario();
    const agora = P.agoraISO();
    return P.Store.put('pagamentos', {
      id: P.uuid(), comanda_id: c.id, dia_operacional: P.Dia.diaOperacional(agora), forma, valor: P.round(valor, 2),
      pago_em: agora, usuario_id: u && u.id, recebido_em: null, recebido_dia: null, recebido_forma: null,
    });
  }
  const abertas = () => P.Store.all('comandas').filter(c => c.status === 'ABERTA').sort((a, b) => (a.aberta_em < b.aberta_em ? -1 : 1));
  // marmitas abertas: ficam em aberto durante o dia (como as mesas) e são pagas no fim do dia
  const ehMarmita = c => c.mesa === 'Marmita' || (c.canal === 'MARMITA' && !/^\d+$/.test(c.mesa || ''));
  const marmitasAbertas = () => abertas().filter(ehMarmita);
  // fecha a conta com o que falta, numa forma só ("Pago" no fim do dia). Devolve o desfazer (reabre).
  function pagarTudo(c, forma) {
    const atual = P.Store.get('comandas', c.id) || c;
    const f = faltaDe(atual);
    fechar(atual, f > 0.004 ? [{ forma, valor: f }] : [], +atual.desconto || 0);
    return () => { const x = P.Store.get('comandas', c.id); if (x && x.status === 'FECHADA') reabrir(x); };
  }
  function nomeLocal(c) { return c.mesa ? (/^\d+$/.test(c.mesa) ? 'Mesa ' + c.mesa : c.mesa) : 'Comanda'; }
  function rotulo(c) { return nomeLocal(c) + (c.cliente ? ' · ' + c.cliente : ''); }
  function tempo(iso) {
    const m = Math.max(0, Math.round((Date.now() - Date.parse(iso)) / 60000));
    return m < 60 ? m + ' min' : Math.floor(m / 60) + 'h' + String(m % 60).padStart(2, '0');
  }
  function canalPeloRelogio() {
    const f = P.Dia.faixa(), t = P.cfg('turnos');
    return P.Calc.espetoLigado() && f >= t.espeto_ini && f <= t.espeto_fim ? 'ESPETO' : 'SALAO';
  }

  function abrir({ mesa, cliente, canal }) {
    const u = P.Auth.usuario();
    const agora = P.agoraISO();
    const c = P.Store.put('comandas', {
      id: P.uuid(), dia_operacional: P.Dia.diaOperacional(agora), mesa: mesa || null, cliente: (cliente || '').trim() || null,
      canal: canal || canalPeloRelogio(), status: 'ABERTA', aberta_em: agora, fechada_em: null, desconto: 0, total: 0,
      usuario_id: u && u.id,
    });
    P.vibrar(20);
    return c;
  }
  const ultimoToque = new Map();
  const TROCA = 'Troca: '; // acompanhamento que substitui algo do prato (ex.: batata no lugar do arroz)
  // o: lançamento com outro nome e preço (troca: "Troca: Batata frita", sem custo ou com a diferença)
  function adicionar(c, item, qtd, o) {
    qtd = qtd || 1;
    const u = P.Auth.usuario();
    const agora = Date.now();
    const f = P.Calc.ficha(item);
    const nome = (o && o.nome) || item.nome;
    const preco = o && o.preco != null ? o.preco : f.preco;
    const k = c.id + '|' + item.id + '|' + nome + '|' + P.round(preco, 2);
    const ult = ultimoToque.get(k);
    if (ult && agora - ult.t < AGRUPA_MS) {
      const l = P.Store.get('comanda_itens', ult.id);
      if (l) {
        P.Store.put('comanda_itens', Object.assign({}, l, { quantidade: (+l.quantidade || 0) + qtd }));
        ult.t = agora;
        return;
      }
    }
    const id = P.uuid();
    P.Store.put('comanda_itens', {
      id, comanda_id: c.id, item_id: item.id, nome, quantidade: qtd,
      preco_unit: P.round(preco, 2), cmv_unit: P.round(f.cmv, 4),
      adicionado_em: new Date(agora).toISOString(), usuario_id: u && u.id, removidos: 0,
    });
    ultimoToque.set(k, { id, t: agora });
  }
  // tira 1 unidade do lançamento mais recente do item (fica registrado quem tirou); com o nome (e o
  // preço), só dos lançamentos assim ("Filé de frango + batata" não tira o Filé de frango sem extra)
  function tirar(c, itemId, nome, preco) {
    const ls = linhas(c.id).filter(l => l.item_id === itemId && (nome == null || l.nome === nome) && (preco == null || Math.abs((+l.preco_unit || 0) - preco) < 0.005));
    const l = ls[ls.length - 1];
    if (!l) return false;
    const u = P.Auth.usuario();
    const marca = { removidos: (+l.removidos || 0) + 1, removido_por: u && u.id, removido_em: P.agoraISO() };
    if ((+l.quantidade || 0) > 1) P.Store.put('comanda_itens', Object.assign({}, l, marca, { quantidade: l.quantidade - 1 }));
    else P.Store.put('comanda_itens', Object.assign({}, l, marca, { quantidade: 0, excluido: true }));
    [...ultimoToque.keys()].forEach(k => { if (k.startsWith(c.id + '|' + itemId + '|')) ultimoToque.delete(k); });
    return true;
  }
  // Extra escrito na hora: um do prato (o lançamento mais recente com esse nome e preço) vira
  // "Filé de frango + batata" com o valor somado (R$ 25 + R$ 5 = R$ 30). Nada sai da conta: não
  // conta como item tirado. O prato continua o mesmo nas vendas e na ficha. Devolve o desfazer.
  function porExtra(c, itemId, nome, preco, ex) {
    const ls = linhas(c.id).filter(l => l.item_id === itemId && l.nome === nome && Math.abs((+l.preco_unit || 0) - preco) < 0.005);
    const l = ls[ls.length - 1];
    if (!l) return null;
    const mudou = { nome: nome + ' + ' + ex.t, preco_unit: P.round(preco + ex.v, 2) };
    [...ultimoToque.keys()].forEach(k => { if (k.startsWith(c.id + '|' + itemId + '|')) ultimoToque.delete(k); });
    if ((+l.quantidade || 0) > 1) {
      const u = P.Auth.usuario();
      P.Store.put('comanda_itens', Object.assign({}, l, { quantidade: l.quantidade - 1 }));
      const n = P.Store.put('comanda_itens', Object.assign({ id: P.uuid(), comanda_id: c.id, item_id: itemId, quantidade: 1, cmv_unit: l.cmv_unit,
        adicionado_em: P.agoraISO(), usuario_id: u && u.id, removidos: 0 }, mudou));
      return () => { P.Store.put('comanda_itens', l); P.Store.remove('comanda_itens', n.id); };
    }
    P.Store.put('comanda_itens', Object.assign({}, l, mudou));
    return () => P.Store.put('comanda_itens', l);
  }
  // últimos extras escritos (atalhos neste aparelho): [{ t: 'batata', v: 5 }]
  const EXTRAS_K = 'pari.extras';
  const extrasRecentes = () => { try { const l = JSON.parse(localStorage.getItem(EXTRAS_K) || '[]'); return Array.isArray(l) ? l.filter(x => x && x.t) : []; } catch (e) { return []; } };
  function lembrarExtra(x) {
    try { localStorage.setItem(EXTRAS_K, JSON.stringify([x].concat(extrasRecentes().filter(o => P.UI.semAcento(o.t) !== P.UI.semAcento(x.t))).slice(0, 10))); } catch (e) { /* ok */ }
  }
  // folha: o que vai junto e quanto a mais → { t, v } (null = desistiu)
  function pedirExtra(base, preco, texto0) {
    return new Promise(resolve => {
      let feito = false, valor = null;
      const inp = h('input', { class: 'campo', type: 'text', value: texto0 || '', placeholder: 'O que vai junto? (ex.: batata, ovo, baião)', autocomplete: 'off', enterkeyhint: 'next' });
      const bValor = h('button', { type: 'button', class: 'btn valor bloco' });
      const previa = h('div', { class: 'cm-ex-previa' });
      const bOk = h('button', { type: 'button', class: 'btn primario bloco' }, P.UI.icone('check'), 'Pôr na conta');
      const fim = x => { feito = true; lembrarExtra(x); resolve(x); sh.fechar(); };
      function mostrar() {
        const t = inp.value.trim();
        bValor.replaceChildren(h('b', null, valor == null ? 'Quanto a mais?' : valor > 0 ? '+ ' + P.brl(valor) : 'Sem custo'), h('small', null, valor == null ? 'toque para pôr o valor do extra' : 'trocar o valor'));
        previa.replaceChildren(h('span', null, base + ' + ' + (t || '…')), h('b', null, P.brl(preco + (valor || 0))));
        bOk.disabled = !t || valor == null;
      }
      async function pedirValor() {
        const v = await P.UI.pedirNumero({ titulo: 'Quanto a mais?', valor, decimais: 2, prefixo: 'R$ ',
          sub: base + ' ' + P.brl(preco) + ' + ' + (inp.value.trim() || 'extra') + '. Ponha 0 se for sem custo (troca).' });
        if (v != null && v >= 0) { valor = P.round(v, 2); mostrar(); }
      }
      bValor.addEventListener('click', pedirValor);
      inp.addEventListener('input', mostrar);
      inp.addEventListener('keydown', e => { if (e.key !== 'Enter') return; e.preventDefault(); if (!inp.value.trim()) return; if (valor == null) pedirValor(); else fim({ t: inp.value.trim(), v: valor }); });
      bOk.addEventListener('click', () => { if (inp.value.trim() && valor != null) fim({ t: inp.value.trim(), v: valor }); });
      const rec = extrasRecentes();
      const sh = P.UI.sheet(h('div', { class: 'np-sheet cm-ex' },
        inp,
        rec.length ? h('div', { class: 'chips cm-ex-rec' }, rec.map(x => h('button', { type: 'button', class: 'chip', onClick: () => fim({ t: x.t, v: +x.v || 0 }) },
          x.t + ' · ' + (+x.v > 0 ? '+ ' + P.brl0(x.v) : 'sem custo')))) : null,
        bValor, previa, bOk),
      { titulo: 'Extra no ' + base, onFechar: () => { if (!feito) resolve(null); } });
      mostrar();
      setTimeout(() => inp.focus(), 80);
    });
  }
  // comanda de outro dia que já tinha sido fechada (reaberta para corrigir) ou lançada depois:
  // ao fechar de novo continua no dia dela (não muda a venda de dia)
  const jaFechada = c => !!c.origem || P.Store.todos('pagamentos').some(p => p.comanda_id === c.id && p.excluido);
  function fechar(c, pags, desconto) {
    const u = P.Auth.usuario();
    const agora = P.agoraISO();
    const atual = P.Store.get('comandas', c.id) || c;
    const manter = jaFechada(atual) && atual.dia_operacional && atual.dia_operacional < P.Dia.diaOperacional(agora);
    const dia = manter ? atual.dia_operacional : P.Dia.diaOperacional(agora);
    const quando = manter && semHora(atual) ? P.Compras.meioDia(dia) : agora;
    const d = P.round(desconto || 0, 2);
    const total = Math.max(0, P.round(subtotal(c.id) - d, 2));
    pags.filter(p => p.valor > 0).forEach(p => P.Store.put('pagamentos', {
      id: P.uuid(), comanda_id: c.id, dia_operacional: dia, forma: p.forma, valor: P.round(p.valor, 2),
      pago_em: quando, usuario_id: u && u.id, recebido_em: null, recebido_dia: null, recebido_forma: null,
    }));
    return P.Store.put('comandas', Object.assign({}, atual, {
      status: 'FECHADA', fechada_em: quando, dia_operacional: dia, desconto: d, total, fechada_por: u && u.id,
    }));
  }
  // formas de pagamento de uma conta, sem repetir (fiado pago em parte fica em dois pagamentos)
  const formasDe = c => [...new Set(pagamentos(c.id).map(p => NOME_FORMA[p.forma]))].join(' + ');
  // partes pagas com a conta ainda aberta (antes de fechar): ficam quando ela é reaberta
  function partesAntes(c) {
    const fechou = Date.parse(c.fechada_em) || 0;
    if (semHora(c) || !fechou) return [];
    return pagamentos(c.id).filter(p => (Date.parse(p.pago_em) || 0) < fechou);
  }
  function reabrir(c) {
    const ficam = new Set(partesAntes(c).map(p => p.id));
    pagamentos(c.id).forEach(p => { if (!ficam.has(p.id)) P.Store.remove('pagamentos', p.id); });
    P.Store.put('comandas', Object.assign({}, c, { status: 'ABERTA', fechada_em: null, fechada_por: null }));
  }
  function cancelar(c) {
    const u = P.Auth.usuario();
    P.Store.put('comandas', Object.assign({}, c, { status: 'CANCELADA', fechada_em: P.agoraISO(), cancelada_por: u && u.id }));
  }
  // Excluir uma venda (lançada errada ou repetida; só o dono): a conta, os itens e os pagamentos
  // somem das vendas, do caixa, do fiado e dos lotes de carne. Pergunta antes e o aviso tem Desfazer.
  async function excluirVenda(c) {
    const pags = P.Store.all('pagamentos').filter(p => p.comanda_id === c.id);
    const recebido = pags.filter(p => p.forma === 'FIADO' && p.recebido_em).reduce((s, p) => s + (+p.valor || 0), 0);
    const valor = c.status === 'CANCELADA' ? 'cancelada' : P.brl(c.total);
    if (!(await P.UI.confirmar('Excluir a venda de ' + rotulo(c) + ' (' + valor + ', ' + P.Dia.rotulo(c.dia_operacional) + ')? Ela sai das vendas, do caixa e dos lotes de carne.' +
      (recebido ? ' O fiado recebido dela (' + P.brl(recebido) + ') também sai do caixa.' : '') + ' Use para venda lançada errada ou repetida. Ela fica na Lixeira (Mais → Lixeira) e pode ser restaurada.', { ok: 'Excluir venda', perigo: true }))) return false;
    const itens = P.Store.all('comanda_itens').filter(l => l.comanda_id === c.id);
    const com = P.Store.get('comandas', c.id);
    itens.forEach(l => P.Store.remove('comanda_itens', l.id));
    pags.forEach(p => P.Store.remove('pagamentos', p.id));
    P.Store.remove('comandas', c.id);
    P.vibrar(20);
    P.UI.toast('Venda excluída · ' + rotulo(c), { acao: { rotulo: 'Desfazer', fn: () => {
      if (com) P.Store.put('comandas', Object.assign({}, com, { excluido: false }));
      itens.forEach(l => P.Store.put('comanda_itens', Object.assign({}, l, { excluido: false })));
      pags.forEach(p => P.Store.put('pagamentos', Object.assign({}, p, { excluido: false })));
    } } });
    return true;
  }

  // ---------------------------------------------------------------
  //  Componentes de tela
  // ---------------------------------------------------------------
  function subnavMesas(ativo) {
    const nFiado = fiadoAberto().length;
    const nMarm = marmitasAbertas().length;
    return P.UI.subnav([
      { id: 'abertas', rota: 'mesas', rotulo: 'Mesas' },
      { id: 'marmitas', rota: 'mesas/marmitas', rotulo: 'Marmitas', badge: nMarm || null },
      { id: 'hoje', rota: 'mesas/hoje', rotulo: 'Fechadas' },
      { id: 'totais', rota: 'mesas/totais', rotulo: 'Totais do dia' },
      { id: 'caixa', rota: 'mesas/caixa', rotulo: 'Fechar caixa' },
      { id: 'despesas', rota: 'mesas/despesas', rotulo: 'Despesas' },
      { id: 'fiado', rota: 'mesas/fiado', rotulo: 'Fiado', badge: nFiado || null },
    ], ativo);
  }
  function voltar(href, rot) { return h('a', { class: 'voltar', href }, P.UI.icone('voltar'), rot || 'Voltar'); }
  function pedirTexto(titulo, valor, placeholder, opcoesRapidas) {
    return new Promise(resolve => {
      let feito = false;
      const inp = h('input', { class: 'campo', type: 'text', value: valor || '', placeholder: placeholder || '', autocomplete: 'off', enterkeyhint: 'done' });
      const ok = v => { feito = true; resolve(v != null ? v : inp.value.trim()); sh.fechar(); };
      inp.addEventListener('keydown', e => { if (e.key === 'Enter') ok(); });
      const sh = P.UI.sheet(h('div', { class: 'np-sheet' }, inp,
        opcoesRapidas && opcoesRapidas.length ? h('div', { class: 'chips' }, opcoesRapidas.map(o => h('button', { type: 'button', class: 'chip', onClick: () => ok(o) }, o))) : null,
        h('div', { class: 'row gap' },
          h('button', { type: 'button', class: 'btn', onClick: () => ok('') }, 'Sem nome'),
          h('button', { type: 'button', class: 'btn primario grow', onClick: () => ok() }, 'Abrir'))),
      { titulo, onFechar: () => { if (!feito) resolve(null); } });
      setTimeout(() => inp.focus(), 80);
    });
  }
  function clientesRecentes() {
    const vistos = new Map();
    P.Store.all('comandas').filter(c => c.cliente).sort((a, b) => (a.aberta_em < b.aberta_em ? 1 : -1)).forEach(c => {
      const k = P.UI.semAcento(c.cliente);
      if (!vistos.has(k)) vistos.set(k, c.cliente);
    });
    return [...vistos.values()].slice(0, 8);
  }

  // marmita nova: pede o nome; se a pessoa já tem uma marmita aberta, abre a dela (vai somando no dia)
  async function novaMarmita() {
    const nome = await pedirTexto('Marmita — cliente / box', '', 'Ex.: Box 112 — Zé', clientesRecentes());
    if (nome == null) return;
    const ja = nome && marmitasAbertas().find(c => P.UI.semAcento(c.cliente || '') === P.UI.semAcento(nome));
    if (ja) { P.UI.toast(nome + ' já tem marmita em aberto: é a mesma conta'); location.hash = '#/mesas/c/' + ja.id; return; }
    const c = abrir({ mesa: 'Marmita', cliente: nome, canal: 'MARMITA' });
    location.hash = '#/mesas/c/' + c.id;
  }

  // ---------------------------------------------------------------
  //  TELA: MARMITAS EM ABERTO — vão ficando abertas durante o dia; no fim do dia "Pago" em cada uma
  // ---------------------------------------------------------------
  function telaMarmitas(view) {
    view.className = 'v-mesas';
    const corpo = h('div');
    const resumo = c => {
      const its = itensSomados(c.id);
      return its.length ? its.slice(0, 3).map(i => P.numAuto(i.q) + '× ' + i.nome).join(', ') + (its.length > 3 ? '…' : '') : 'sem itens ainda';
    };
    async function pago(c) {
      const atual = P.Store.get('comandas', c.id) || c;
      const v = faltaDe(atual);
      const forma = await P.UI.escolher({ titulo: (atual.cliente || 'Marmita') + ' pagou ' + P.brl(v) + ' em…',
        opcoes: FORMAS.filter(x => x.v !== 'FIADO' || atual.cliente).map(x => ({ v: x.v, rotulo: x.v === 'FIADO' ? 'Fiado (paga outro dia)' : x.rotulo })) });
      if (!forma) return;
      const desfazer = pagarTudo(atual, forma);
      P.vibrar([20, 40, 20]);
      P.UI.toast((atual.cliente || 'Marmita') + ': ' + P.brl(v) + (forma === 'FIADO' ? ' no fiado' : ' pago (' + NOME_FORMA[forma] + ')'), { acao: { rotulo: 'Desfazer', fn: desfazer } });
    }
    async function todas(lista) {
      const tot = P.round(lista.reduce((t, c) => t + faltaDe(c), 0), 2);
      const forma = await P.UI.escolher({ titulo: 'As ' + lista.length + ' marmitas (' + P.brl(tot) + ') foram pagas em…', opcoes: FORMAS.filter(x => x.v !== 'FIADO').map(x => ({ v: x.v, rotulo: x.rotulo })) });
      if (!forma) return;
      if (!(await P.UI.confirmar('Marcar como pagas ' + EM_FORMA[forma] + ':\n' + lista.map(c => '• ' + (c.cliente || 'sem nome') + ' ' + P.brl(faltaDe(c))).join('\n') + '\n\nTotal ' + P.brl(tot) + '.', { ok: 'Pagas' }))) return;
      const desf = lista.map(c => pagarTudo(c, forma));
      P.vibrar([20, 40, 20]);
      P.UI.toast(lista.length + ' marmitas pagas (' + NOME_FORMA[forma] + ') · ' + P.brl(tot), { acao: { rotulo: 'Desfazer', fn: () => desf.forEach(f => f()) } });
    }
    function desenhar() {
      corpo.innerHTML = '';
      const lista = marmitasAbertas();
      const tot = lista.reduce((t, c) => t + faltaDe(c), 0);
      corpo.appendChild(h('div', { class: 'fx-resumo' }, h('div', { class: 'fx-tot' },
        h('small', null, lista.length ? lista.length + (lista.length === 1 ? ' marmita em aberto' : ' marmitas em aberto') : 'Nenhuma marmita em aberto'), h('b', null, P.brl(tot)))));
      corpo.appendChild(h('div', { class: 'row gap mm-acoes' },
        h('button', { type: 'button', class: 'btn grow', onClick: novaMarmita }, P.UI.icone('mais'), 'Marmita'),
        lista.length > 1 ? h('button', { type: 'button', class: 'btn primario grow', onClick: () => todas(lista) }, P.UI.icone('check'), 'Receber todas') : null));
      if (!lista.length) {
        corpo.appendChild(P.UI.vazio('Toque em + Marmita: ela fica aqui em aberto durante o dia. No fim do dia, toque em Pago (ou Receber todas).'));
        return;
      }
      corpo.appendChild(h('div', { class: 'ms-lista' }, lista.map(c => {
        const pg = jaPago(c);
        return h('div', { class: 'mm-card' },
          h('a', { class: 'mm-top', href: '#/mesas/c/' + c.id },
            h('div', { class: 'ms-card-n' }, c.cliente || 'sem nome',
              h('small', null, P.Dia.hora(c.aberta_em) + ' · ' + tempo(c.aberta_em) + (pg ? ' · já pagou ' + P.brl(pg) : '')),
              h('small', { class: 'mm-itens' }, resumo(c))),
            h('b', null, P.brl(faltaDe(c)))),
          h('div', { class: 'mm-bts' },
            h('a', { class: 'btn mini', href: '#/mesas/c/' + c.id }, P.UI.icone('mais'), 'Pôr mais'),
            h('button', { type: 'button', class: 'btn mini primario', disabled: !qtdItens(c.id), onClick: () => pago(c) }, P.UI.icone('check'), 'Pago')));
      })));
      corpo.appendChild(h('div', { class: 'dica' }, 'As marmitas ficam em aberto (como as mesas) até você marcar como pagas. Pago: escolhe a forma (Dinheiro, Pix, cartão) e a conta fecha no dia em que pagou. Quem não pagar hoje: Pago → Fiado.'));
    }
    view.append(subnavMesas('marmitas'), corpo);
    desenhar();
    return { onDados(t) { if (t.has('comandas') || t.has('comanda_itens') || t.has('pagamentos')) desenhar(); } };
  }

  // ---------------------------------------------------------------
  //  TELA: MESAS (abertas)
  // ---------------------------------------------------------------
  function telaMesas(view) {
    view.className = 'v-mesas';
    const corpo = h('div');
    let relogio = null;

    async function abrirMesa(mesa) {
      const ja = abertas().filter(c => c.mesa === String(mesa));
      if (ja.length === 1) { location.hash = '#/mesas/c/' + ja[0].id; return; }
      if (ja.length > 1) {
        const id = await P.UI.escolher({ titulo: 'Mesa ' + mesa, opcoes: ja.map(c => ({ v: c.id, rotulo: rotulo(c), sub: P.brl(totalDe(c)) + ' · ' + tempo(c.aberta_em) })).concat([{ v: '_nova', rotulo: '+ Nova comanda nesta mesa' }]) });
        if (!id) return;
        if (id !== '_nova') { location.hash = '#/mesas/c/' + id; return; }
      }
      const nome = await pedirTexto('Mesa ' + mesa + ' — nome do cliente', '', 'Ex.: João do box 40', clientesRecentes());
      if (nome == null) return;
      const c = abrir({ mesa: String(mesa), cliente: nome });
      location.hash = '#/mesas/c/' + c.id;
    }
    const abrirMarmita = novaMarmita;
    function vendaRapida() {
      const c = abrir({ mesa: 'Balcão', cliente: '' });
      location.hash = '#/mesas/c/' + c.id + '/rapida';
    }

    function desenhar() {
      corpo.innerHTML = '';
      const ab = abertas();
      if (P.Auth.isDono()) {
        const r = P.Painel.resultadoDia(P.Dia.hoje());
        const cor = !r.temMovimento ? 'cinza' : r.resultado >= 0 ? 'verde' : 'vermelho';
        corpo.appendChild(h('a', { class: 'viva', href: '#/painel' },
          h('span', { class: 'viva-pt ' + cor }),
          h('span', { class: 'viva-i' }, h('small', null, 'Vendido hoje'), h('b', null, P.brl0(r.fat))),
          h('span', { class: 'viva-i' }, h('small', null, 'Em mesas'), h('b', null, P.brl0(ab.reduce((s, c) => s + totalDe(c), 0)))),
          h('span', { class: 'viva-i' }, h('small', null, r.caixa ? 'Entrou − saiu' : r.resultado >= 0 ? 'Lucro' : 'Prejuízo'), h('b', { class: 't-' + cor }, P.brl0(r.resultado))),
          P.UI.icone('avancar')));
      }
      corpo.appendChild(h('div', { class: 'ms-acoes' },
        h('button', { type: 'button', class: 'btn primario ms-rapida', onClick: vendaRapida }, P.UI.icone('fogo'), 'Venda rápida'),
        h('button', { type: 'button', class: 'btn ms-marm', onClick: abrirMarmita }, P.UI.icone('compras'), 'Marmita')));

      const n = Math.max(1, +P.cfg('mesas').quantidade || 12);
      const grade = h('div', { class: 'ms-grade' });
      const livres = [];
      for (let i = 1; i <= n; i++) {
        const cs = ab.filter(c => c.mesa === String(i));
        if (!cs.length) livres.push(i);
        const tot = cs.reduce((s, c) => s + faltaDe(c), 0); // o que falta (já pago por partes sai)
        const min = cs.length ? (Date.now() - Date.parse(cs[0].aberta_em)) / 60000 : 0;
        grade.appendChild(h('button', { type: 'button', class: 'ms-mesa' + (cs.length ? ' ocupada' : '') + (min > 60 ? ' demorada' : ''), onClick: () => abrirMesa(i),
          'aria-label': 'Mesa ' + i + (cs.length ? ', ' + cs.map(c => c.cliente || 'sem nome').join(', ') + ', ' + P.brl(tot) + ', aberta há ' + tempo(cs[0].aberta_em) : ', livre') },
          h('span', { class: 'ms-topo' }, h('span', { class: 'ms-n' }, String(i).padStart(2, '0')),
            cs.length ? h('span', { class: 'ms-tempo' },
              h('i', { class: 'ms-rel', style: { '--p': Math.min(1, min / 60) } }), tempo(cs[0].aberta_em)) : null),
          cs.length ? [
            h('span', { class: 'ms-cli' }, cs.map(c => c.cliente || 'sem nome').join(', ')),
            h('span', { class: 'ms-tot' }, P.brl(tot)),
          ] : h('span', { class: 'ms-livre' }, 'livre')));
      }
      corpo.appendChild(h('div', { class: 'secao sec-linha' }, h('span', null, 'Salão'),
        h('small', null, (n - livres.length) + ' ocupada' + (n - livres.length === 1 ? '' : 's') + ' · ' + livres.length + ' livre' + (livres.length === 1 ? '' : 's'))));
      corpo.appendChild(grade);

      const outras = ab.filter(c => !/^\d+$/.test(c.mesa || ''));
      if (outras.length) {
        corpo.appendChild(h('div', { class: 'secao' }, 'Balcão e marmitas abertas'));
        const nm = marmitasAbertas().length;
        if (nm) corpo.appendChild(h('a', { class: 'pn-caixa mm-link', href: '#/mesas/marmitas' }, P.UI.icone('check'),
          h('span', null, nm + (nm === 1 ? ' marmita em aberto' : ' marmitas em aberto') + ' · marcar como pagas no fim do dia'), P.UI.icone('avancar')));
        corpo.appendChild(h('div', { class: 'ms-lista' }, outras.map(c => h('a', { class: 'ms-card', href: '#/mesas/c/' + c.id },
          h('div', { class: 'ms-card-n' }, rotulo(c), h('small', null, NOME_CANAL[c.canal] + ' · ' + tempo(c.aberta_em) + ' · ' + qtdItens(c.id) + ' itens' + (jaPago(c) ? ' · pago ' + P.brl0(jaPago(c)) : ''))),
          h('b', null, P.brl(jaPago(c) ? faltaDe(c) : totalDe(c)))))));
      }
      const hoje = P.Dia.hoje();
      const fechadasHoje = P.Store.all('comandas').filter(c => c.status === 'FECHADA' && c.dia_operacional === hoje);
      const totHoje = fechadasHoje.reduce((s, c) => s + (+c.total || 0), 0);
      corpo.appendChild(h('a', { class: 'ms-resumo', href: '#/mesas/hoje' },
        h('span', null, 'Hoje: ', h('b', null, fechadasHoje.length), fechadasHoje.length === 1 ? ' conta fechada' : ' contas fechadas'),
        h('b', null, P.brl(totHoje)), P.UI.icone('avancar')));
    }
    view.append(subnavMesas('abertas'), corpo);
    desenhar();
    relogio = setInterval(desenhar, 30000);
    return {
      cleanup() { clearInterval(relogio); },
      onDados(t) { if (t.has('comandas') || t.has('comanda_itens') || t.has('compras') || t.has('despesas') || t.has('pagamentos')) desenhar(); },
    };
  }

  // ---------------------------------------------------------------
  //  TELA: COMANDA (adicionar itens ao vivo)
  // ---------------------------------------------------------------
  const ORDEM = { ESPETO: ['ESPETO', 'BEBIDA', 'PRATO', 'GUARNICAO'], SALAO: ['PRATO', 'BEBIDA', 'ESPETO', 'GUARNICAO'], MARMITA: ['PRATO', 'BEBIDA', 'ESPETO', 'GUARNICAO'] };
  const ROT_CAT = { ESPETO: 'Espetos', PRATO: 'Pratos', BEBIDA: 'Bebidas', GUARNICAO: 'Extras' };
  const CATS_ITEM = [{ v: 'PRATO', rotulo: 'Prato' }, { v: 'BEBIDA', rotulo: 'Bebida' }, { v: 'ESPETO', rotulo: 'Espeto' }, { v: 'GUARNICAO', rotulo: 'Extra' }];
  const chaveNome = n => P.UI.semAcento(n).replace(/\s+/g, ' ').trim();

  // Criar item na hora (da comanda): nome, tipo e preço. Se já existe um item com o mesmo nome,
  // usa ele (e, se estava fora do cardápio, volta com o preço informado). Entra sem ficha técnica.
  // Nome com um prato que já existe dentro ("filé de frango com batata") sugere o prato + o
  // acompanhamento. Devolve { item, extras } (extras: acompanhamentos para pôr junto) ou null.
  function criarItem(nome0, cat0) {
    return new Promise(resolve => {
      let feito = false;
      const cats = CATS_ITEM.filter(x => x.v !== 'ESPETO' || P.Calc.espetoLigado());
      let cat = cats.some(x => x.v === cat0) ? cat0 : 'PRATO';
      let preco = null;
      const inNome = h('input', { class: 'campo', type: 'text', value: nome0 ? nome0.charAt(0).toUpperCase() + nome0.slice(1) : '', placeholder: 'Nome do item (ex.: Suco de laranja)', autocomplete: 'off' });
      const bPreco = h('button', { type: 'button', class: 'btn valor bloco' });
      const aviso = h('small', { class: 'campo-d' });
      const existente = () => {
        const k = chaveNome(inNome.value);
        const it = k ? P.Store.all('itens').find(i => chaveNome(i.nome) === k) : null;
        return it ? P.Store.get('itens', P.Calc.principal(it.id)) || it : null; // juntado em outro (Pratos repetidos): o que ficou
      };
      // nome com um prato que já existe dentro ("filé de frango com batata"): sugere o prato + o extra
      // escrito na hora (o valor do extra é perguntado em seguida)
      const elParecido = h('div', { class: 'cm-parecido', hidden: true });
      function textoExtra(base) {
        const v = inNome.value.trim();
        const m = v.match(/\s(?:com|c\/|\+)\s+(.+)$/i);
        if (m) return m[1].trim();
        const bw = new Set(base.nome.split(/\s+/).map(w => P.UI.semAcento(w)));
        return v.split(/\s+/).filter(w => !bw.has(P.UI.semAcento(w))).join(' ').trim();
      }
      function mostrarParecido() {
        const p = !existente() && P.Acomp ? P.Acomp.parecido(inNome.value) : null;
        elParecido.hidden = !p;
        if (!p) return;
        const ex = p.mesmo && !p.acomps.length ? '' : textoExtra(p.base);
        elParecido.replaceChildren(...[
          h('small', null, ex ? 'É um prato que já existe, com extra:' : 'Já existe:'),
          h('button', { type: 'button', class: 'btn bloco primario', onClick: () => { feito = true; resolve({ item: p.base, extras: [], extra: ex }); sh.fechar(); } },
            P.UI.icone('check'), ex ? 'Pôr ' + p.base.nome + ' + ' + ex + ' (o valor do extra a seguir)' : 'Pôr ' + p.base.nome + ' · ' + P.brl(p.base.preco_venda)),
          h('small', null, 'Se for outro prato, crie abaixo.')]);
      }
      function mostrar() {
        mostrarParecido();
        const ja = existente();
        bPreco.textContent = ja && P.Calc.vendavel(ja) ? P.brl(ja.preco_venda) : preco > 0 ? P.brl(preco) : 'Preço de venda (R$)';
        aviso.textContent = !ja ? 'Entra no cardápio agora, sem ficha técnica (dá para montar depois em Fichas).'
          : P.Calc.vendavel(ja) ? '"' + ja.nome + '" já existe: ele entra na comanda por ' + P.brl(ja.preco_venda) + '.'
            : '"' + ja.nome + '" já existe, fora do cardápio: ele volta ao cardápio com este preço.';
      }
      inNome.addEventListener('input', mostrar);
      bPreco.addEventListener('click', async () => {
        const v = await P.UI.pedirNumero({ titulo: 'Preço de venda', valor: preco, decimais: 2, prefixo: 'R$ ' });
        if (v != null) { preco = v; mostrar(); }
      });
      function salvar() {
        const nome = inNome.value.trim();
        if (!nome) { P.UI.toast('Ponha o nome do item.', { tipo: 'perigo' }); inNome.focus(); return; }
        const ja = existente();
        let r;
        if (ja && P.Calc.vendavel(ja)) r = ja; // já está no cardápio: entra com o preço dele
        else {
          if (!(preco > 0)) { P.UI.toast('Ponha o preço de venda.', { tipo: 'perigo' }); bPreco.click(); return; }
          r = ja ? P.Store.put('itens', Object.assign({}, ja, { ativo: true, preco_venda: P.round(preco, 2) }))
            : P.Store.put('itens', { id: P.uuid(), nome, categoria: cat, preco_venda: P.round(preco, 2),
              perda_pct: cat === 'PRATO' ? +P.Calc.cfgFichas().perda_padrao || 0 : 0, ativo: true, custo_estimado: null });
        }
        feito = true; resolve({ item: r, extras: [] }); sh.fechar();
      }
      inNome.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); if (preco > 0 || existente()) salvar(); else bPreco.click(); } });
      const sh = P.UI.sheet(h('div', { class: 'np-sheet' },
        inNome, elParecido,
        P.UI.seg(cats, cat, v => { cat = v; }, 'seg-p'),
        bPreco, aviso,
        h('div', { class: 'row gap' },
          h('button', { type: 'button', class: 'btn', onClick: () => sh.fechar() }, 'Cancelar'),
          h('button', { type: 'button', class: 'btn primario grow', onClick: salvar }, P.UI.icone('check'), 'Criar e pôr na comanda'))),
      { titulo: 'Item novo', onFechar: () => { if (!feito) resolve(null); } });
      mostrar();
      // com o nome já digitado na busca, abre direto o preço (se não for parecido com um prato que já existe)
      setTimeout(() => { if (nome0 && !existente() && elParecido.hidden) bPreco.click(); else inNome.focus(); }, 150);
    });
  }

  function telaComanda(view, params) {
    view.className = 'v-comanda';
    const rapida = params.modo === 'rapida';
    let c = P.Store.get('comandas', params.id);
    if (!c) { view.append(voltar('#/mesas', 'Mesas'), P.UI.vazio('Comanda não encontrada.')); return {}; }
    if (c.status !== 'ABERTA') return telaResumo(view, c);
    let cat = ORDEM[c.canal] ? ORDEM[c.canal][0] : 'PRATO';
    if (cat === 'ESPETO' && !P.Calc.espetoLigado()) cat = 'PRATO';
    let verOutros = false; // pratos fora do cardápio do dia
    // busca de item em todas as categorias; o que não existe dá para criar na hora
    let termo = '';
    const busca = P.UI.campoBusca('Buscar item ou criar na hora', v => { termo = v; desenharCats(); desenharGrade(); });
    busca.el.classList.add('cm-busca');
    busca.inp.addEventListener('keydown', e => {
      if (e.key !== 'Enter' || !termo) return;
      e.preventDefault();
      const achados = achar(termo);
      if (achados.length === 1) { escolher(achados[0]); return; }
      if (!achados.length) criarNaHora();
    });
    function achar(txt) {
      const ts = P.UI.semAcento(txt).split(/\s+/).filter(Boolean);
      const k = P.UI.semAcento(txt);
      return vendaveis().filter(it => { const n = P.UI.semAcento(it.nome); return ts.every(t => n.includes(t)); })
        .sort((a, b) => (P.UI.semAcento(b.nome).startsWith(k) - P.UI.semAcento(a.nome).startsWith(k)) || a.nome.localeCompare(b.nome, 'pt-BR'));
    }
    function escolher(it) {
      adicionar(c, it);
      P.vibrar(15);
      busca.limpar(); termo = '';
      atualizar();
      P.UI.toast('+1 ' + it.nome);
    }
    async function criarNaHora() {
      const r = await criarItem(termo, cat);
      if (!r) return;
      cat = r.item.categoria;
      escolher(r.item);
      if (r.extra) extraNoPrato(r.item.id, r.item.nome, +P.Calc.ficha(r.item).preco || 0, r.extra);
    }
    // "+ extra" num prato da conta: pergunta o que vai junto e quanto a mais
    async function extraNoPrato(itemId, nome, preco, texto0) {
      const ex = await pedirExtra(nome, preco, texto0);
      if (!ex) return;
      const desfazer = porExtra(P.Store.get('comandas', c.id) || c, itemId, nome, preco, ex);
      if (!desfazer) return;
      P.vibrar(15); atualizar();
      P.UI.toast(nome + ' + ' + ex.t + ' · ' + P.brl(preco + ex.v), { acao: { rotulo: 'Desfazer', fn: () => { desfazer(); atualizar(); } } });
    }

    const elCab = h('div', { class: 'cm-cab' });
    const elTotal = h('div', { class: 'barra-acao' });
    const elCats = h('div', { class: 'cm-cats' });
    const elGrade = h('div', { class: 'cm-grade' });
    const elConsumo = h('div', { class: 'cm-consumo' });

    function vendaveis() { return P.Store.all('itens').filter(it => P.Calc.vendavel(it) && !P.Calc.espetoOculto(it)); }
    function qtdPorItem() {
      const m = new Map();
      linhas(c.id).forEach(l => m.set(l.item_id, (m.get(l.item_id) || 0) + (+l.quantidade || 0)));
      return m;
    }
    function desenharCab() {
      c = P.Store.get('comandas', c.id) || c;
      const selo = /^\d+$/.test(c.mesa || '') ? String(c.mesa).padStart(2, '0') : c.mesa === 'Marmita' ? 'M' : c.mesa === 'Balcão' ? 'B' : '•';
      elCab.replaceChildren(
        h('a', { class: 'cm-voltar', href: '#/mesas', 'aria-label': 'Voltar às mesas' }, P.UI.icone('voltar')),
        h('span', { class: 'cm-selo k-' + (c.canal || 'SALAO').toLowerCase(), 'aria-hidden': 'true' }, selo),
        h('button', { type: 'button', class: 'cm-tit', onClick: renomear },
          h('b', null, nomeLocal(c)), h('span', null, c.cliente || 'toque para pôr o nome', P.UI.icone('lapis'))),
        h('div', { class: 'cm-dir' },
          h('button', { type: 'button', class: 'cm-canal k-' + (c.canal || 'SALAO').toLowerCase(), onClick: trocarCanal }, NOME_CANAL[c.canal] || c.canal),
          h('span', { class: 'cm-tempo' }, P.UI.icone('relogio'), tempo(c.aberta_em))));
    }
    function desenharTotal() {
      const n = qtdItens(c.id);
      const pg = jaPago(c);
      elTotal.replaceChildren(
        h('div', { class: 'barra-tot' }, h('small', null, pg ? 'falta · já pago ' + P.brl0(pg) : n + (n === 1 ? ' item' : ' itens')), h('b', null, P.brl(pg ? faltaDe(c) : totalDe(c)))),
        h('button', { type: 'button', class: 'btn primario barra-btn', disabled: !n, onClick: () => { location.hash = '#/mesas/pagar/' + c.id; } }, 'Fechar conta', P.UI.icone('avancar')));
    }
    function desenharCats() {
      elCats.hidden = !!termo;
      const presentes = new Set(vendaveis().map(i => i.categoria));
      const porCat = {};
      const I = P.Calc.idx();
      linhas(c.id).forEach(l => { const it = I.itens.get(l.item_id); if (it) porCat[it.categoria] = (porCat[it.categoria] || 0) + (+l.quantidade || 0); });
      elCats.replaceChildren(...(ORDEM[c.canal] || ORDEM.SALAO).filter(k => presentes.has(k)).map(k =>
        h('button', { type: 'button', class: 'cm-cat k-' + k.toLowerCase() + (k === cat ? ' on' : ''), 'aria-pressed': k === cat ? 'true' : 'false', onClick: () => {
          if (cat === k) return;
          cat = k; P.vibrar(10); desenharCats(); desenharGrade();
        } }, h('i', { class: 'cm-cat-dot' }), ROT_CAT[k], porCat[k] ? h('b', null, porCat[k]) : null)));
    }
    function desenharGrade() {
      const q = qtdPorItem();
      elGrade.innerHTML = '';
      const botao = it => {
        const n = q.get(it.id) || 0;
        return h('button', { type: 'button', class: 'cm-item k-' + it.categoria.toLowerCase() + (n ? ' tem' : ''), onClick: e => {
          if (termo) { escolher(it); return; } // na busca: põe e limpa para a próxima
          adicionar(c, it);
          P.vibrar(15);
          const b = e.currentTarget;
          if (b.animate) b.animate([{ transform: 'scale(.96)' }, { transform: 'scale(1)' }], { duration: 120 });
          atualizar();
        } },
        h('span', { class: 'cm-item-n' }, it.nome),
        h('span', { class: 'cm-item-p' }, P.brl(it.preco_venda)),
        n ? h('span', { class: 'cm-item-q' }, n) : null);
      };
      if (termo) {
        const achados = achar(termo);
        achados.forEach(it => elGrade.appendChild(botao(it)));
        const igual = P.Store.all('itens').some(it => P.Calc.vendavel(it) && P.UI.semAcento(it.nome).trim() === P.UI.semAcento(termo).trim());
        if (!achados.length) elGrade.appendChild(h('div', { class: 'cm-nada' }, 'Nenhum item com "' + termo + '".'));
        if (!igual) elGrade.appendChild(h('button', { type: 'button', class: 'cm-outros cm-criar', onClick: criarNaHora }, 'Criar "' + termo + '" e pôr na comanda', P.UI.icone('mais')));
        return;
      }
      const todos = vendaveis().filter(i => i.categoria === cat).sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
      // pratos: os do cardápio do dia primeiro (na ordem do cardápio); os outros ficam guardados em "Outros pratos"
      const card = cat === 'PRATO' && P.Cardapio ? P.Cardapio.doDia(c.dia_operacional) : null;
      if (!card || !card.definido) { todos.forEach(it => elGrade.appendChild(botao(it))); return; }
      const fora = todos.filter(it => !card.ids.has(it.id));
      card.itens.concat(fora.filter(it => q.get(it.id))).forEach(it => elGrade.appendChild(botao(it)));
      const resto = fora.filter(it => !q.get(it.id));
      if (!resto.length) return;
      elGrade.appendChild(h('button', { type: 'button', class: 'cm-outros', 'aria-expanded': verOutros ? 'true' : 'false', onClick: () => { verOutros = !verOutros; desenharGrade(); } },
        verOutros ? 'Esconder os outros pratos' : 'Outros pratos (' + resto.length + ') · fora do cardápio de ' + card.nome, P.UI.icone(verOutros ? 'menos' : 'mais')));
      if (verOutros) resto.forEach(it => elGrade.appendChild(botao(it)));
    }
    function desenharConsumo() {
      const grupos = new Map();
      linhas(c.id).forEach(l => {
        const troca = (l.nome || '').startsWith(TROCA);
        const k = l.item_id + '|' + l.nome + '|' + P.round(+l.preco_unit || 0, 2); // "Filé de frango + batata" fica numa linha à parte
        if (!grupos.has(k)) grupos.set(k, { itemId: l.item_id, nome: l.nome, troca, preco: +l.preco_unit || 0, q: 0, v: 0, horas: [] });
        const g = grupos.get(k);
        g.q += +l.quantidade || 0;
        g.v += (+l.quantidade || 0) * (+l.preco_unit || 0);
        g.horas.push((l.quantidade > 1 ? l.quantidade + '× ' : '') + P.Dia.hora(l.adicionado_em));
      });
      elConsumo.innerHTML = '';
      if (!grupos.size) { elConsumo.appendChild(P.UI.vazio('Toque nos itens acima conforme forem saindo.')); return; }
      elConsumo.appendChild(h('div', { class: 'secao' }, 'Consumo'));
      const ehAc = id => P.Acomp && P.Acomp.ehAcomp(id);
      const I = P.Calc.idx();
      grupos.forEach(g => {
        const it = I.itens.get(g.itemId);
        const comoNoCardapio = it && g.nome === it.nome; // sem extra: "mais um" entra com o preço de hoje
        const podeExtra = it && (it.categoria === 'PRATO' || it.categoria === 'ESPETO') && !g.troca && !ehAc(g.itemId);
        elConsumo.appendChild(h('div', { class: 'cm-lin' + (ehAc(g.itemId) || g.troca ? ' ac' : '') },
          h('div', { class: 'cm-lin-n' }, h('b', null, g.q + '×'), ' ' + (g.troca ? '⇄ ' : ehAc(g.itemId) ? '+ ' : '') + g.nome,
            h('small', null, g.horas.join(' · ')),
            podeExtra ? h('button', { type: 'button', class: 'cm-extra', onClick: () => extraNoPrato(g.itemId, g.nome, g.preco) }, P.UI.icone('mais'), 'extra') : null),
          h('div', { class: 'cm-lin-v' }, P.brl(g.v)),
          h('button', { type: 'button', class: 'lc-b', 'aria-label': 'Tirar um', onClick: () => { tirar(c, g.itemId, g.nome, g.preco); P.vibrar([10, 40, 10]); atualizar(); } }, P.UI.icone('menos')),
          h('button', { type: 'button', class: 'lc-b mais', 'aria-label': 'Mais um', onClick: () => {
            if (!it) return;
            if (comoNoCardapio) adicionar(c, it); else adicionar(c, it, 1, { nome: g.nome, preco: g.preco });
            P.vibrar(15); atualizar();
          } }, P.UI.icone('mais'))));
      });
      // pago por partes (a conta continua aberta)
      const partes = pagamentos(c.id);
      if (partes.length) {
        elConsumo.appendChild(h('div', { class: 'secao' }, 'Já pago · ' + P.brl(jaPago(c)) + ' · falta ' + P.brl(faltaDe(c))));
        partes.forEach(p => elConsumo.appendChild(h('div', { class: 'cm-lin ac' },
          h('div', { class: 'cm-lin-n' }, NOME_FORMA[p.forma], h('small', null, 'pago às ' + P.Dia.hora(p.pago_em))),
          h('div', { class: 'cm-lin-v' }, P.brl(p.valor)),
          h('button', { type: 'button', class: 'lc-b', 'aria-label': 'Desfazer este pagamento', onClick: () => desfazerParte(p) }, P.UI.icone('x')))));
      }
      if (qtdItens(c.id)) elConsumo.appendChild(h('button', { type: 'button', class: 'btn bloco', onClick: receberParte }, P.UI.icone('dinheiro'), 'Receber uma parte (alguém pagou e vai embora)'));
      elConsumo.appendChild(h('button', { type: 'button', class: 'btn perigo bloco', onClick: cancelarComanda }, P.UI.icone('x'), 'Cancelar comanda'));
    }
    async function receberParte() {
      const f = faltaDe(c);
      if (f < 0.005) { P.UI.toast('Já está tudo pago: toque em Fechar conta.'); return; }
      const v = await P.UI.pedirNumero({ titulo: 'Quanto pagou agora?', decimais: 2, prefixo: 'R$ ', sub: 'Falta ' + P.brl(f) + ' nesta conta. O resto continua na mesa.' });
      if (v == null || !(v > 0)) return;
      if (v > f + 0.004) { P.UI.toast('Maior que o que falta (' + P.brl(f) + ').', { tipo: 'perigo' }); return; }
      const forma = await P.UI.escolher({ titulo: 'Como pagou ' + P.brl(v) + '?', opcoes: FORMAS.filter(x => x.v !== 'FIADO').map(x => ({ v: x.v, rotulo: x.rotulo })) });
      if (!forma) return;
      const p = pagarParte(P.Store.get('comandas', c.id) || c, v, forma);
      P.vibrar([20, 40, 20]);
      atualizar();
      P.UI.toast(P.brl(v) + ' recebido (' + NOME_FORMA[forma] + ') · falta ' + P.brl(faltaDe(c)), {
        acao: { rotulo: 'Desfazer', fn: () => { P.Store.remove('pagamentos', p.id); atualizar(); } },
      });
    }
    async function desfazerParte(p) {
      if (!(await P.UI.confirmar('Desfazer o pagamento de ' + P.brl(p.valor) + ' (' + NOME_FORMA[p.forma] + ', ' + P.Dia.hora(p.pago_em) + ')? Ele sai do caixa e volta a faltar na conta.', { ok: 'Desfazer', perigo: true }))) return;
      P.Store.remove('pagamentos', p.id);
      atualizar();
      P.UI.toast('Pagamento desfeito', { acao: { rotulo: 'Voltar', fn: () => { P.Store.put('pagamentos', Object.assign({}, p, { excluido: false })); atualizar(); } } });
    }
    function atualizar() { desenharTotal(); desenharCats(); desenharGrade(); desenharConsumo(); }
    async function renomear() {
      const nome = await pedirTexto('Nome do cliente', c.cliente || '', 'Ex.: João do box 40', clientesRecentes());
      if (nome == null) return;
      c = P.Store.put('comandas', Object.assign({}, P.Store.get('comandas', c.id), { cliente: nome || null }));
      desenharCab();
    }
    function trocarCanal() {
      const ordem = P.Calc.espetoLigado() ? ['ESPETO', 'SALAO', 'MARMITA'] : ['SALAO', 'MARMITA'];
      const prox = ordem[(ordem.indexOf(c.canal) + 1) % ordem.length];
      c = P.Store.put('comandas', Object.assign({}, P.Store.get('comandas', c.id), { canal: prox }));
      P.vibrar(10);
      desenharCab();
    }
    async function cancelarComanda() {
      const n = qtdItens(c.id);
      if (jaPago(c)) { P.UI.toast('Esta conta já tem ' + P.brl(jaPago(c)) + ' pago. Feche a conta, ou desfaça os pagamentos antes de cancelar.', { tipo: 'perigo', ms: 5000 }); return; }
      if (n && !(await P.UI.confirmar('Cancelar a comanda de ' + rotulo(c) + ' (' + P.brl(totalDe(c)) + ')? Fica registrado no relatório.', { ok: 'Cancelar comanda', perigo: true }))) return;
      cancelar(P.Store.get('comandas', c.id));
      location.hash = '#/mesas';
    }

    view.append(elCab, busca.el, elCats, elGrade, elConsumo, elTotal);
    desenharCab(); desenharCats(); atualizar();
    if (rapida) P.UI.toast('Venda rápida: toque nos itens e depois em Fechar conta');
    const relogio = setInterval(desenharCab, 30000);
    return {
      cleanup() {
        clearInterval(relogio);
        // venda rápida abandonada sem nenhum item: some da lista
        const cc = P.Store.get('comandas', c.id);
        if (cc && cc.status === 'ABERTA' && cc.mesa === 'Balcão' && !qtdItens(cc.id)) P.Store.remove('comandas', cc.id);
      },
      onDados(t) {
        if (!(t.has('comanda_itens') || t.has('comandas') || t.has('itens'))) return;
        const cc = P.Store.get('comandas', c.id);
        if (!cc || cc.status !== 'ABERTA') { P.UI.render(); return; }
        c = cc;
        desenharCab(); atualizar();
      },
    };
  }

  // Comanda fechada/cancelada: resumo só leitura (dono pode reabrir)
  function telaResumo(view, c) {
    const L = P.Store.todos('comanda_itens').filter(l => l.comanda_id === c.id).sort((a, b) => (a.adicionado_em < b.adicionado_em ? -1 : 1));
    const pags = pagamentos(c.id);
    const nomeUsu = id => { const u = id && P.Store.get('usuarios', id); return u ? u.nome : '—'; };
    const sh = semHora(c);
    const hora = iso => (sh ? '—' : P.Dia.hora(iso));
    view.append(
      voltar('#/mesas/hoje', 'Fechadas'),
      h('div', { class: 'rs-cab ' + c.status.toLowerCase() },
        h('div', { class: 'rs-tit' }, rotulo(c)),
        h('div', { class: 'rs-sub' }, NOME_CANAL[c.canal] + (sh ? ' · lançada depois (sem horário)' : ' · aberta ' + P.Dia.hora(c.aberta_em) + (c.fechada_em ? ' · ' + (c.status === 'CANCELADA' ? 'cancelada ' : 'fechada ') + P.Dia.hora(c.fechada_em) : '')) + ' · ' + P.Dia.rotulo(c.dia_operacional)),
        h('div', { class: 'rs-total' }, c.status === 'CANCELADA' ? 'CANCELADA' : P.brl(c.total)),
        c.obs ? h('div', { class: 'rs-obs' }, c.obs) : null),
      h('div', { class: 'secao' }, sh ? 'Itens' : 'Itens (com horário)'),
      h('div', { class: 'rs-itens' }, L.map(l => h('div', { class: 'rs-l' + (l.excluido ? ' removido' : '') },
        h('span', { class: 'rs-h' }, hora(l.adicionado_em)),
        h('span', { class: 'rs-n' }, (l.excluido ? 0 : l.quantidade) + '× ' + l.nome,
          +l.removidos ? h('small', null, ' (' + l.removidos + ' tirado' + (l.removidos > 1 ? 's' : '') + ' por ' + nomeUsu(l.removido_por) + ' às ' + P.Dia.hora(l.removido_em) + ')') : null),
        h('span', { class: 'rs-v' }, P.brl((l.excluido ? 0 : l.quantidade) * l.preco_unit))))),
      +c.desconto ? h('div', { class: 'rs-l' }, h('span', { class: 'rs-h' }), h('span', { class: 'rs-n' }, 'Desconto'), h('span', { class: 'rs-v' }, '− ' + P.brl(c.desconto))) : null,
      pags.length ? [h('div', { class: 'secao' }, 'Pagamento'), h('div', { class: 'rs-itens' }, pags.map(p => h('div', { class: 'rs-l' },
        h('span', { class: 'rs-h' }, hora(p.pago_em)),
        h('span', { class: 'rs-n' }, NOME_FORMA[p.forma] + (p.forma === 'FIADO' ? (p.recebido_em ? ' — recebido ' + P.Dia.rotuloCurto(p.recebido_dia) + ' (' + NOME_FORMA[p.recebido_forma] + ')' : ' — em aberto') : '')),
        h('span', { class: 'rs-v' }, P.brl(p.valor)))))] : null,
      h('div', { class: 'rs-quem' }, 'Aberta por ' + nomeUsu(c.usuario_id) + (c.fechada_por ? ' · fechada por ' + nomeUsu(c.fechada_por) : '') + (c.cancelada_por ? ' · cancelada por ' + nomeUsu(c.cancelada_por) : '')),
      P.Auth.isDono() && c.status !== 'ABERTA' ? h('button', { type: 'button', class: 'btn bloco', onClick: async () => {
        const recFiado = pags.filter(p => p.forma === 'FIADO' && p.recebido_em).reduce((s, p) => s + (+p.valor || 0), 0);
        const partes = partesAntes(c).reduce((s, p) => s + (+p.valor || 0), 0);
        if (!(await P.UI.confirmar('Reabrir a comanda de ' + rotulo(c) + '? Os pagamentos do fechamento serão desfeitos.' +
          (partes ? ' O que já tinha sido pago em partes (' + P.brl(partes) + ') continua pago.' : '') +
          (recFiado ? ' Isso inclui ' + P.brl(recFiado) + ' do fiado que o cliente já pagou: sai do caixa e volta a ficar devendo ao fechar de novo no fiado.' : ''), { ok: 'Reabrir' }))) return;
        reabrir(c);
        location.hash = '#/mesas/c/' + c.id;
        P.UI.render();
      } }, P.UI.icone('refresh'), 'Reabrir para corrigir') : null,
      P.Auth.isDono() && c.status !== 'ABERTA' ? h('button', { type: 'button', class: 'btn perigo bloco', onClick: async () => {
        if (await excluirVenda(c)) location.hash = '#/mesas/hoje';
      } }, P.UI.icone('lixo'), 'Excluir venda') : null);
    return {};
  }

  // ---------------------------------------------------------------
  //  TELA: PAGAMENTO
  // ---------------------------------------------------------------
  function telaPagar(view, params) {
    view.className = 'v-pagar';
    const c = P.Store.get('comandas', params.id);
    if (!c || c.status !== 'ABERTA') { view.append(voltar('#/mesas', 'Mesas'), P.UI.vazio('Comanda não está aberta.')); return {}; }
    let desconto = +c.desconto || 0;
    let pags = [];         // {forma, valor, recebido?}
    const elTopo = h('div', { class: 'pg-topo' });
    const elFormas = h('div', { class: 'pg-formas' });
    const elPags = h('div', { class: 'pg-pags' });
    const elFalta = h('div', { class: 'pg-falta' });
    const elDica = h('div', { class: 'pg-dica' });
    const btnOk = h('button', { type: 'button', class: 'btn primario bloco pg-ok', onClick: confirmar }, P.UI.icone('check'), 'Confirmar pagamento');

    const partes = pagamentos(c.id); // pago por partes com a conta aberta
    const pagoAntes = P.round(partes.reduce((s, p) => s + (+p.valor || 0), 0), 2);
    const total = () => Math.max(0, P.round(subtotal(c.id) - desconto - pagoAntes, 2)); // o que falta receber
    const pago = () => P.round(pags.reduce((s, p) => s + p.valor, 0), 2);
    const falta = () => P.round(total() - pago(), 2);

    function desenhar() {
      elTopo.replaceChildren(
        h('div', { class: 'pg-rot' }, rotulo(c)),
        h('div', { class: 'pg-cap' }, pagoAntes ? 'Falta receber' : 'Total a receber'),
        h('div', { class: 'pg-total' }, P.brl(total())),
        h('div', { class: 'pg-sub' }, qtdItens(c.id) + (qtdItens(c.id) === 1 ? ' item' : ' itens') + ' · subtotal ' + P.brl(subtotal(c.id)),
          h('button', { type: 'button', class: 'btn mini', onClick: pedirDesconto }, desconto ? 'desconto ' + P.brl(desconto) : '+ desconto')),
        pagoAntes ? h('div', { class: 'pg-partes' }, 'Já pago: ' + partes.map(p => NOME_FORMA[p.forma] + ' ' + P.brl(p.valor) + ' (' + P.Dia.hora(p.pago_em) + ')').join(' · ')) : null);
      elFormas.replaceChildren(...FORMAS.map(f => h('button', { type: 'button', class: 'pg-forma f-' + f.v.toLowerCase(), onClick: () => escolher(f.v) },
        h('span', { class: 'pg-ic' }, P.UI.icone(ICONE_FORMA[f.v])), f.rotulo)));
      elPags.innerHTML = '';
      pags.forEach((p, i) => {
        const troco = p.forma === 'DINHEIRO' && p.recebido > p.valor ? P.round(p.recebido - p.valor, 2) : 0;
        elPags.appendChild(h('div', { class: 'pg-lin' },
          h('span', { class: 'pg-lin-f' }, NOME_FORMA[p.forma]),
          h('button', { type: 'button', class: 'btn valor', onClick: async () => {
            const v = await P.UI.pedirNumero({ titulo: NOME_FORMA[p.forma], valor: p.valor, decimais: 2, prefixo: 'R$ ', sub: pags.length === 2 ? 'O resto fica em ' + NOME_FORMA[pags[1 - i].forma] + '.' : null });
            if (v == null) return;
            p.valor = P.round(v, 2);
            // com duas formas, a outra fica com o resto (até o total)
            if (pags.length === 2) {
              const o = pags[1 - i];
              o.valor = Math.max(0, P.round(total() - p.valor, 2));
              if (o.valor < 0.005) pags.splice(1 - i, 1);
            }
            desenhar();
          } }, P.brl(p.valor)),
          p.forma === 'DINHEIRO' ? h('button', { type: 'button', class: 'btn mini', onClick: async () => {
            const v = await P.UI.pedirNumero({ titulo: 'Quanto o cliente entregou?', valor: p.recebido || null, decimais: 2, prefixo: 'R$ ', rapidos: [10, 20, 50, 100] });
            if (v != null) { p.recebido = v; desenhar(); }
          } }, troco ? 'troco ' + P.brl(troco) : 'troco?') : null,
          h('button', { type: 'button', class: 'btn ic', 'aria-label': 'Remover', onClick: () => { pags.splice(i, 1); desenhar(); } }, P.UI.icone('x'))));
      });
      const f = falta();
      elFalta.className = 'pg-falta' + (Math.abs(f) < 0.005 ? ' ok' : f < 0 ? ' mais' : '');
      elFalta.textContent = !pags.length && pagoAntes && total() < 0.005 ? 'Já está tudo pago' : !pags.length ? 'Toque na forma de pagamento' : Math.abs(f) < 0.005 ? 'Tudo certo' : f > 0 ? 'Falta ' + P.brl(f) : 'Passou ' + P.brl(-f) + ' — ajuste os valores';
      elDica.textContent = !pags.length ? 'Pagou com mais de uma forma (ex.: parte no dinheiro, parte no Pix)? Toque numa e depois na outra.'
        : Math.abs(f) < 0.005 ? 'Mais de uma forma? Toque na outra e diga quanto foi nela; o resto fica ' + EM_FORMA[pags[0].forma] + '.' : '';
      btnOk.disabled = (!pags.length && !(pagoAntes && total() < 0.005)) || Math.abs(f) >= 0.005;
    }
    // Toque numa forma: com valor faltando, ela fica com o que falta. Já pago tudo, outra forma =
    // dividir: pergunta quanto foi nela e tira esse valor das que já estavam (a primeira primeiro).
    // Pôr o total inteiro troca a forma.
    async function escolher(forma) {
      P.vibrar(12);
      const f = falta();
      if (f > 0.004) { pags.push({ forma, valor: f }); desenhar(); return; }
      if (!pags.length) return;
      if (pags.some(p => p.forma === forma)) { P.UI.toast('Já está ' + EM_FORMA[forma] + ': toque no valor para mudar.'); return; }
      const v = await P.UI.pedirNumero({ titulo: 'Quanto foi ' + EM_FORMA[forma] + '?', valor: null, decimais: 2, prefixo: 'R$ ',
        sub: 'Total ' + P.brl(total()) + '. O resto fica ' + EM_FORMA[pags[0].forma] + '. (Pôr ' + P.brl(total()) + ' troca tudo para ' + NOME_FORMA[forma] + '.)' });
      if (v == null || !(v > 0)) return;
      const val = Math.min(P.round(v, 2), total());
      let tirar = val;
      pags.forEach(p => { const t = Math.min(p.valor, tirar); p.valor = P.round(p.valor - t, 2); tirar = P.round(tirar - t, 2); });
      pags = pags.filter(p => p.valor > 0.004);
      pags.push({ forma, valor: val });
      desenhar();
    }
    async function pedirDesconto() {
      const v = await P.UI.pedirNumero({ titulo: 'Desconto', valor: desconto || null, decimais: 2, prefixo: 'R$ ' });
      if (v == null) return;
      desconto = Math.min(v, subtotal(c.id));
      pags = [];
      desenhar();
    }
    async function confirmar() {
      if (btnOk.disabled) return;
      let atual = P.Store.get('comandas', c.id);
      if (pags.some(p => p.forma === 'FIADO') && !atual.cliente) {
        const nome = await pedirTexto('Fiado precisa do nome do cliente', '', 'Nome de quem vai pagar depois', clientesRecentes());
        if (!nome) { P.UI.toast('Sem nome não dá para lançar fiado.', { tipo: 'perigo' }); return; }
        atual = P.Store.put('comandas', Object.assign({}, atual, { cliente: nome }));
      }
      const fechada = fechar(atual, pags, desconto);
      const troco = pags.reduce((s, p) => s + (p.forma === 'DINHEIRO' && p.recebido > p.valor ? p.recebido - p.valor : 0), 0);
      P.vibrar([20, 40, 20]);
      location.hash = '#/mesas';
      P.UI.toast(rotulo(fechada) + ' fechada · ' + P.brl(fechada.total) + (troco ? ' · troco ' + P.brl(troco) : ''), {
        ms: 7000,
        acao: { rotulo: 'Desfazer', fn: () => { reabrir(P.Store.get('comandas', fechada.id)); location.hash = '#/mesas/c/' + fechada.id; } },
      });
    }

    view.append(voltar('#/mesas/c/' + c.id, 'Comanda'), elTopo, elFormas, elPags, elFalta, elDica, btnOk);
    desenhar();
    return {};
  }

  // ---------------------------------------------------------------
  //  TELA: FECHADAS (por dia)
  // ---------------------------------------------------------------
  function navDia(dia, onMuda) {
    const hoje = P.Dia.hoje();
    return h('div', { class: 'lc-dia' },
      h('button', { type: 'button', class: 'pn-nav', 'aria-label': 'Dia anterior', onClick: () => onMuda(P.Dia.anterior(dia)) }, P.UI.icone('voltar')),
      h('button', { type: 'button', class: 'lc-dia-t cp-dia-cal', 'aria-label': 'Escolher o dia no calendário', onClick: () => P.Compras.calendario(dia, onMuda) },
        dia === hoje ? 'Hoje' : P.Dia.nomeSemana(dia), h('small', null, P.Dia.rotuloCurto(dia) + ' ▾')),
      h('button', { type: 'button', class: 'pn-nav', 'aria-label': 'Próximo dia', disabled: dia >= hoje, onClick: () => onMuda(P.Dia.seguinte(dia)) }, P.UI.icone('avancar')));
  }
  function telaFechadas(view) {
    view.className = 'v-mesas';
    let dia = P.Dia.hoje();
    const corpo = h('div');
    function desenhar() {
      corpo.innerHTML = '';
      corpo.appendChild(navDia(dia, d => { dia = d; desenhar(); }));
      const cs = P.Store.all('comandas').filter(c => c.dia_operacional === dia && c.status !== 'ABERTA').sort((a, b) => (a.fechada_em < b.fechada_em ? 1 : -1));
      const porForma = {};
      let tot = 0;
      cs.filter(c => c.status === 'FECHADA').forEach(c => {
        tot += +c.total || 0;
        pagamentos(c.id).forEach(p => { porForma[p.forma] = (porForma[p.forma] || 0) + (+p.valor || 0); });
      });
      corpo.appendChild(h('div', { class: 'fx-resumo' },
        h('div', { class: 'fx-tot' }, h('small', null, cs.filter(c => c.status === 'FECHADA').length + ' contas'), h('b', null, P.brl(tot))),
        h('div', { class: 'fx-formas' }, FORMAS.filter(f => porForma[f.v]).map(f => h('span', { class: 'fx-f f-' + f.v.toLowerCase() }, f.rotulo + ' ', h('b', null, P.brl(porForma[f.v])))))));
      if (!cs.length) { corpo.appendChild(P.UI.vazio('Nenhuma conta fechada neste dia.')); return; }
      corpo.appendChild(h('div', { class: 'ms-lista' }, cs.map(c => h('a', { class: 'ms-card' + (c.status === 'CANCELADA' ? ' cancelada' : ''), href: '#/mesas/c/' + c.id },
        h('div', { class: 'ms-card-n' }, rotulo(c),
          h('small', null, (semHora(c) ? 'lançada depois' : P.Dia.hora(c.aberta_em) + '–' + P.Dia.hora(c.fechada_em)) + ' · ' + NOME_CANAL[c.canal] + ' · ' +
            (c.status === 'CANCELADA' ? 'cancelada' : formasDe(c)))),
        h('b', null, c.status === 'CANCELADA' ? '—' : P.brl(c.total))))));
    }
    view.append(subnavMesas('hoje'), corpo);
    desenhar();
    return { onDados: desenhar };
  }

  // ---------------------------------------------------------------
  //  TELA: TOTAIS DO DIA — automático, somado das comandas (nada é digitado)
  // ---------------------------------------------------------------
  function totaisDoDia(dia, canal) {
    const itens = new Map();
    const r = { fechado: 0, nFechadas: 0, aberto: 0, nAbertas: 0, qtd: 0, itens };
    P.Store.all('comandas').forEach(c => {
      if (c.status === 'CANCELADA') return;
      const d = c.status === 'FECHADA' ? c.dia_operacional : P.Dia.diaOperacional(c.aberta_em);
      if (d !== dia || (canal !== 'TODOS' && c.canal !== canal)) return;
      const ls = linhas(c.id);
      if (!ls.length) return;
      const aberta = c.status !== 'FECHADA';
      if (aberta) { r.aberto += totalDe(c); r.nAbertas++; } else { r.fechado += +c.total || 0; r.nFechadas++; }
      ls.forEach(l => {
        const q = +l.quantidade || 0;
        if (!itens.has(l.item_id)) itens.set(l.item_id, { nome: l.nome, q: 0, v: 0, qAberta: 0 });
        const g = itens.get(l.item_id);
        g.q += q; g.v += q * (+l.preco_unit || 0);
        if (aberta) g.qAberta += q;
        r.qtd += q;
      });
    });
    return r;
  }
  function telaTotais(view) {
    view.className = 'v-mesas';
    let dia = P.Dia.hoje();
    let canal = 'TODOS';
    const corpo = h('div');
    function desenhar() {
      corpo.innerHTML = '';
      corpo.appendChild(navDia(dia, d => { dia = d; desenhar(); }));
      corpo.appendChild(P.UI.seg([{ v: 'TODOS', rotulo: 'Todos' }, P.Calc.espetoLigado() ? { v: 'ESPETO', rotulo: 'Espeto' } : null, { v: 'SALAO', rotulo: 'Salão' }, { v: 'MARMITA', rotulo: 'Marmita' }].filter(Boolean),
        canal, v => { canal = v; desenhar(); }, 'seg-p'));
      const t = totaisDoDia(dia, canal);
      corpo.appendChild(h('div', { class: 'fx-resumo' },
        h('div', { class: 'fx-tot' }, h('small', null, 'Vendido · ' + t.nFechadas + (t.nFechadas === 1 ? ' conta fechada' : ' contas fechadas')), h('b', null, P.brl(t.fechado))),
        h('div', { class: 'fx-formas' },
          h('span', { class: 'fx-f' }, 'Itens ', h('b', null, P.num(t.qtd))),
          t.nAbertas ? h('span', { class: 'fx-f' }, 'Em aberto nas mesas ', h('b', null, P.brl(t.aberto)), ' (' + t.nAbertas + ')') : null)));
      const lista = [...t.itens.values()].sort((a, b) => b.q - a.q || b.v - a.v);
      if (!lista.length) { corpo.appendChild(P.UI.vazio('Nenhum item vendido neste dia. Tudo que for lançado nas mesas aparece aqui sozinho.')); return; }
      corpo.appendChild(h('div', { class: 'secao' }, 'Itens vendidos (automático, pelas comandas)'));
      corpo.appendChild(h('div', { class: 'ms-lista' }, lista.map(g => h('div', { class: 'ms-card' },
        h('div', { class: 'ms-card-n' }, h('b', null, P.num(g.q) + '× '), g.nome, g.qAberta ? h('small', null, g.qAberta + ' ainda em mesa aberta') : null),
        h('b', null, P.brl(g.v))))));
    }
    view.append(subnavMesas('totais'), corpo);
    desenhar();
    return { onDados(t) { if (t.has('comandas') || t.has('comanda_itens')) desenhar(); } };
  }

  // ---------------------------------------------------------------
  //  TELA: DESPESAS (quanto gastei)
  // ---------------------------------------------------------------
  // A que mês (ou semana) o pagamento da equipe se refere: salário pago até o dia 10 é do mês
  // anterior; semana = segunda-feira da semana; o resto, o mês do pagamento.
  function inicioSemana(dia) {
    const d = P.Dia.parse(dia);
    return P.Dia.somaDias(dia, -((d.getDay() + 6) % 7));
  }
  function competenciaDe(cat, subtipo, dia) {
    if (cat === 'PROLABORE') return dia.slice(0, 7);
    if (cat !== 'FUNCIONARIOS' || !subtipo) return null;
    if (subtipo === 'SEMANA') return inicioSemana(dia);
    if (subtipo === 'SALARIO' && +dia.slice(8, 10) <= 10) {
      const [y, m] = dia.split('-').map(Number);
      const a = new Date(y, m - 2, 1);
      return a.getFullYear() + '-' + String(a.getMonth() + 1).padStart(2, '0');
    }
    return dia.slice(0, 7);
  }
  const rotuloCompetencia = c => (!c ? '' : c.length === 7 ? P.Dia.rotuloMes(c) : 'semana de ' + P.Dia.rotuloCurto(c));
  // o: atalhos da tela Equipe { pessoa_id, subtipo, valor, descricao }
  function novaDespesa(dia, cat0, ant, o) {
    o = o || {};
    return new Promise(resolve => {
      let cat = ant ? ant.categoria : cat0 || 'GAS_CARVAO';
      let forma = ant ? ant.forma || 'DINHEIRO' : 'DINHEIRO';
      let valor = ant ? +ant.valor : o.valor != null ? o.valor : null;
      let pessoa = ant ? ant.pessoa_id || null : o.pessoa_id || null;
      let subtipo = ant ? ant.subtipo || null : o.subtipo || null;
      let feito = false;
      const desc = h('input', { class: 'campo', type: 'text', value: ant ? ant.descricao || '' : o.descricao || '', placeholder: 'O quê? (ex.: botijão, salário do João, aluguel de outubro)', autocomplete: 'off' });
      const dica = h('small', { class: 'campo-d' });
      const elEquipe = h('div', { class: 'ds-equipe' });
      const DICAS = {
        PROLABORE: 'Retirada do dono por conta do pró-labore do mês (inclusive coisa pessoal paga com dinheiro do restaurante). Entra no lucro como custo fixo.',
        INVESTIMENTO: 'Equipamento, obra, reforma: sai do caixa, mas não entra no lucro do mês (é gasto de uma vez).',
      };
      const mostrarDica = () => { dica.textContent = DICAS[cat] || (DESP_FIXA.has(cat) ? 'Entra no lucro e no caixa deste dia. Os custos fixos de Ajustes ficam só como base de previsão do mês.' : ''); };
      // funcionários e pró-labore: de quem é e que tipo de pagamento (para a tela Equipe)
      function desenharEquipe() {
        if (cat !== 'FUNCIONARIOS' && cat !== 'PROLABORE') { elEquipe.replaceChildren(); return; }
        const ps = P.Store.all('pessoas').filter(p => (p.ativo !== false || p.id === pessoa) && (cat === 'PROLABORE') === (p.pagamento === 'PROLABORE'))
          .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
        if (cat === 'PROLABORE' && !pessoa && ps.length === 1) pessoa = ps[0].id;
        const comp = competenciaDe(cat, subtipo, ant ? ant.dia_operacional : dia);
        elEquipe.replaceChildren(...[
          ps.length ? [h('span', { class: 'campo-r' }, cat === 'PROLABORE' ? 'De quem' : 'Quem'),
            P.UI.seg(ps.map(p => ({ v: p.id, rotulo: p.nome })), pessoa, v => { pessoa = v; }, 'seg-p seg-cat')]
            : h('small', { class: 'campo-d' }, 'Cadastre a equipe em Mais → Equipe para ver quanto falta pagar a cada um.'),
          cat === 'FUNCIONARIOS' ? [h('span', { class: 'campo-r' }, 'Tipo'), P.UI.seg(SUBTIPOS, subtipo, v => { subtipo = v; desenharEquipe(); }, 'seg-p seg-cat')] : null,
          comp ? h('small', { class: 'campo-d' }, 'Conta para ' + rotuloCompetencia(comp) + '.') : null,
        ].flat().filter(Boolean));
      }
      const cats = CAT_DESPESA.filter(c => c.v !== 'MERCADORIA' && (P.Auth.isDono() || !(c.fixo || c.dono)));
      const bValor = h('button', { type: 'button', class: 'btn valor bloco' });
      const mostrar = () => { bValor.textContent = valor ? P.brl(valor) : 'Valor (R$)'; };
      bValor.addEventListener('click', async () => {
        const v = await P.UI.pedirNumero({ titulo: 'Valor da despesa', valor, decimais: 2, prefixo: 'R$ ' });
        if (v != null) { valor = v; mostrar(); }
      });
      const sh = P.UI.sheet(h('div', { class: 'np-sheet' },
        P.UI.seg(cats, cat, v => { cat = v; mostrarDica(); desenharEquipe(); }, 'seg-p seg-cat'),
        dica, bValor, elEquipe, desc,
        h('span', { class: 'campo-r' }, 'Como pagou'),
        P.UI.seg(FORMAS_DESP, forma, v => { forma = v; }, 'seg-p seg-cat'),
        h('div', { class: 'row gap' },
          h('button', { type: 'button', class: 'btn', onClick: () => sh.fechar() }, 'Cancelar'),
          h('button', { type: 'button', class: 'btn primario grow', onClick: () => {
            if (!(valor > 0)) { P.UI.toast('Informe o valor.', { tipo: 'perigo' }); return; }
            const u = P.Auth.usuario();
            const equipe = cat === 'FUNCIONARIOS' || cat === 'PROLABORE';
            const diaD = ant ? ant.dia_operacional : dia;
            const extra = {
              pessoa_id: equipe ? pessoa : null,
              subtipo: cat === 'FUNCIONARIOS' ? subtipo : null,
              // editando sem trocar o tipo: mantém a competência que já tinha (ex.: vale de antes da abertura)
              competencia: !equipe ? null : ant && ant.competencia && ant.categoria === cat && ant.subtipo === subtipo ? ant.competencia : competenciaDe(cat, subtipo, diaD),
            };
            const r = P.Store.put('despesas', ant
              ? Object.assign({}, ant, { categoria: cat, forma, descricao: desc.value.trim() || null, valor: P.round(valor, 2) }, extra)
              : Object.assign({ id: P.uuid(), dia_operacional: dia, categoria: cat, forma, descricao: desc.value.trim() || null, valor: P.round(valor, 2), criado_em: P.agoraISO(), usuario_id: u && u.id }, extra));
            feito = true; resolve(r); sh.fechar();
          } }, 'Salvar'))),
      { titulo: (ant ? 'Editar despesa · ' : 'Nova despesa · ') + P.Dia.rotulo(ant ? ant.dia_operacional : dia), onFechar: () => { if (!feito) resolve(null); } });
      mostrar();
      mostrarDica();
      desenharEquipe();
      if (!ant && o.valor == null) setTimeout(() => bValor.click(), 150);
    });
  }
  function telaDespesas(view) {
    view.className = 'v-mesas';
    let dia = P.Dia.hoje();
    let modo = 'dia'; // dia | mes
    let mes = P.Dia.mes(dia);
    const corpo = h('div');
    // toque na despesa = editar (tipo, valor, forma); lixeira = excluir
    const cardDesp = (d, comDia) => h('div', { class: 'ms-card' },
      h('button', { type: 'button', class: 'ds-card', onClick: () => novaDespesa(d.dia_operacional, null, d).then(desenhar) },
        h('div', { class: 'ms-card-n' }, d.descricao || NOME_DESP[d.categoria],
          h('small', null, (comDia ? P.Dia.rotulo(d.dia_operacional) : P.Dia.hora(d.criado_em)) + ' · ' + subDesp(d))),
        h('b', null, P.brl(d.valor))),
      h('button', { type: 'button', class: 'btn ic perigo', 'aria-label': 'Excluir', onClick: () => {
        P.Store.remove('despesas', d.id);
        P.UI.toast('Despesa excluída (fica na Lixeira)', { acao: { rotulo: 'Desfazer', fn: () => P.Store.put('despesas', Object.assign({}, d, { excluido: false })) } });
      } }, P.UI.icone('lixo')));
    // linhas "nome ........ valor" com barra proporcional
    const barras = (pares, total) => h('div', { class: 'ds-barras' }, pares.map(([nome, v]) => h('div', { class: 'ds-barra' },
      h('span', { class: 'ds-barra-n' }, nome), h('b', null, P.brl(v)),
      h('span', { class: 'ds-barra-f', style: { width: (total ? v / total * 100 : 0).toFixed(1) + '%' } }))));
    function desenharMes() {
      const mudaMes = n => { const [y, m] = mes.split('-').map(Number); const d = new Date(y, m - 1 + n, 1); mes = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0'); desenhar(); };
      corpo.appendChild(h('div', { class: 'lc-dia' },
        h('button', { type: 'button', class: 'pn-nav', 'aria-label': 'Mês anterior', onClick: () => mudaMes(-1) }, P.UI.icone('voltar')),
        h('div', { class: 'lc-dia-t' }, P.Dia.rotuloMes(mes)),
        h('button', { type: 'button', class: 'pn-nav', 'aria-label': 'Próximo mês', disabled: mes >= P.Dia.mes(P.Dia.hoje()), onClick: () => mudaMes(1) }, P.UI.icone('avancar'))));
      const ds = P.Store.all('despesas').filter(d => d.dia_operacional.slice(0, 7) === mes && d.categoria !== 'MERCADORIA' && despVisivel(d))
        .sort((a, b) => (a.dia_operacional < b.dia_operacional ? 1 : a.dia_operacional > b.dia_operacional ? -1 : a.criado_em < b.criado_em ? 1 : -1));
      const tot = ds.reduce((s, d) => s + (+d.valor || 0), 0);
      const compras = P.Store.all('compras').filter(c => c.dia_operacional.slice(0, 7) === mes).reduce((s, c) => s + (+c.total || 0), 0);
      corpo.appendChild(h('div', { class: 'fx-resumo' },
        h('div', { class: 'fx-tot' }, h('small', null, 'Despesas do mês · ' + ds.length), h('b', null, P.brl(tot))),
        h('a', { class: 'fx-formas link', href: '#/calendario' }, h('span', { class: 'fx-f' }, 'Compras de mercadoria ', h('b', null, P.brl(compras))), h('span', { class: 'fx-f' }, 'Saiu no mês ', h('b', null, P.brl(tot + compras))), P.UI.icone('avancar'))));
      if (!ds.length) { corpo.appendChild(P.UI.vazio('Nenhuma despesa lançada neste mês.', 'caixa')); return; }
      const soma = chave => { const m = new Map(); ds.forEach(d => { const k = chave(d); m.set(k, (m.get(k) || 0) + (+d.valor || 0)); }); return [...m].sort((a, b) => b[1] - a[1]); };
      corpo.appendChild(h('div', { class: 'secao' }, 'Por tipo'));
      corpo.appendChild(barras(soma(d => NOME_DESP[d.categoria]), tot));
      corpo.appendChild(h('div', { class: 'secao' }, 'Como pagou'));
      corpo.appendChild(barras(soma(d => NOME_FORMA_DESP[d.forma] || 'Não informado'), tot));
      corpo.appendChild(h('div', { class: 'secao' }, 'Todas as despesas do mês'));
      corpo.appendChild(h('div', { class: 'ms-lista' }, ds.map(d => cardDesp(d, true))));
    }
    // busca em todas as despesas: nome, tipo, pessoa, data e valor
    const busca = P.UI.campoBusca('Buscar despesa: nome, data ou valor', () => desenhar());
    function desenharBusca(q) {
      const b = P.UI.busca(q);
      const alvo = d => {
        const pes = d.pessoa_id && P.Store.get('pessoas', d.pessoa_id);
        return { texto: P.UI.semAcento([d.descricao, NOME_DESP[d.categoria], pes && pes.nome, NOME_SUBTIPO[d.subtipo], NOME_FORMA_DESP[d.forma]].filter(Boolean).join(' ')),
          dias: [d.dia_operacional], valores: [d.valor] };
      };
      const ds = P.Store.all('despesas').filter(d => despVisivel(d) && b.casa(alvo(d)))
        .sort((a, c) => (a.dia_operacional < c.dia_operacional ? 1 : a.dia_operacional > c.dia_operacional ? -1 : a.criado_em < c.criado_em ? 1 : -1));
      const tot = ds.reduce((s, d) => s + (+d.valor || 0), 0);
      corpo.appendChild(h('div', { class: 'fx-resumo' },
        h('div', { class: 'fx-tot' }, h('small', null, ds.length + (ds.length === 1 ? ' despesa encontrada' : ' despesas encontradas') + ' · "' + q + '"'), h('b', null, P.brl(tot)))));
      if (!ds.length) { corpo.appendChild(P.UI.vazio('Nenhuma despesa com "' + q + '". Busque pelo nome ou tipo ("gás", "vale", "chave"), pela data ("06/10") ou pelo valor ("380") — dá para misturar: "vale 05/10".', 'busca')); return; }
      corpo.appendChild(h('div', { class: 'ms-lista' }, ds.slice(0, 100).map(d => cardDesp(d, true))));
      if (ds.length > 100) corpo.appendChild(h('div', { class: 'dica' }, 'Mostrando as 100 mais recentes. Digite mais para filtrar.'));
    }
    function desenhar() {
      corpo.innerHTML = '';
      const q = busca.valor();
      if (q.length >= 2) { desenharBusca(q); return; }
      corpo.appendChild(P.UI.seg([{ v: 'dia', rotulo: 'Do dia' }, { v: 'mes', rotulo: 'Do mês' }], modo, v => { modo = v; if (v === 'mes') mes = P.Dia.mes(dia); desenhar(); }, 'seg-p'));
      corpo.appendChild(h('div', { class: 'row gap ds-novas' },
        h('button', { type: 'button', class: 'btn primario grow', onClick: () => novaDespesa(modo === 'dia' ? dia : (mes === P.Dia.mes(P.Dia.hoje()) ? P.Dia.hoje() : P.Dia.doMes(mes).slice(-1)[0]), 'GAS_CARVAO').then(desenhar) }, P.UI.icone('mais'), 'Despesa'),
        h('a', { class: 'btn grow', href: '#/compras/nova' }, P.UI.icone('compras'), 'Compra de mercadoria')));
      if (modo === 'mes') { desenharMes(); return; }
      corpo.appendChild(navDia(dia, d => { dia = d; desenhar(); }));
      const ds = P.Store.all('despesas').filter(d => d.dia_operacional === dia && despVisivel(d)).sort((a, b) => (a.criado_em < b.criado_em ? 1 : -1));
      const tot = ds.reduce((s, d) => s + (+d.valor || 0), 0);
      const compras = P.Compras.doDia(dia).reduce((s, c) => s + (+c.total || 0), 0);
      corpo.appendChild(h('div', { class: 'fx-resumo' },
        h('div', { class: 'fx-tot' }, h('small', null, 'Despesas do dia'), h('b', null, P.brl(tot))),
        h('a', { class: 'fx-formas link', href: '#/compras' }, h('span', { class: 'fx-f' }, 'Compras de mercadoria ', h('b', null, P.brl(compras))), P.UI.icone('avancar'))));
      if (!ds.length) { corpo.appendChild(P.UI.vazio('Nenhuma despesa neste dia. Aqui entram gás, carvão, embalagem, limpeza, manutenção' + (P.Auth.isDono() ? ', salários, aluguel, contas e impostos' : '') + '. Mercadoria (comida e bebida) vai em Compras.', 'caixa')); return; }
      corpo.appendChild(h('div', { class: 'ms-lista' }, ds.map(d => cardDesp(d, false))));
    }
    view.append(subnavMesas('despesas'), busca.el, corpo);
    desenhar();
    return { onDados(t) { if (t.has('despesas') || t.has('compras')) desenhar(); } };
  }

  // ---------------------------------------------------------------
  //  TELA: FIADO (quem deve)
  // ---------------------------------------------------------------
  function fiadoAberto() {
    return P.Store.all('pagamentos').filter(p => p.forma === 'FIADO' && !p.recebido_em);
  }
  const clienteDe = p => { const c = P.Store.get('comandas', p.comanda_id); return (c && c.cliente) || 'Sem nome'; };
  const ordemFiado = (a, b) => ((a.dia_operacional || '') + (a.pago_em || '') < (b.dia_operacional || '') + (b.pago_em || '') ? -1 : 1);
  // Dar baixa no fiado: o cliente paga o que puder e o resto continua devendo. O valor abate das
  // contas mais antigas; a conta paga só em parte vira duas (a parte recebida e a que segue em
  // aberto), assim o caixa conta o recebido no dia e na forma em que entrou e a venda continua no
  // dia dela. Devolve a função que desfaz.
  function receberFiado(pags, valor, forma) {
    const agora = P.agoraISO();
    const rec = { recebido_em: agora, recebido_dia: P.Dia.diaOperacional(agora), recebido_forma: forma };
    const antes = [], novos = [];
    let resta = P.round(valor, 2);
    pags.slice().sort(ordemFiado).forEach(p => {
      if (resta < 0.01) return;
      const v = +p.valor || 0;
      antes.push(p);
      if (resta >= v - 0.004) { P.Store.put('pagamentos', Object.assign({}, p, rec)); resta = P.round(resta - v, 2); return; }
      P.Store.put('pagamentos', Object.assign({}, p, { valor: P.round(v - resta, 2) }));
      novos.push(P.Store.put('pagamentos', Object.assign({}, p, rec, { id: P.uuid(), valor: resta })).id);
      resta = 0;
    });
    return () => { antes.forEach(p => P.Store.put('pagamentos', p)); novos.forEach(id => P.Store.remove('pagamentos', id)); };
  }
  // itens da conta com o mesmo nome e preço somados ("3× Heineken long neck"), na ordem em que entraram
  function itensSomados(cid) {
    const m = new Map();
    linhas(cid).filter(l => +l.quantidade > 0).forEach(l => {
      const k = l.nome + '|' + (+l.preco_unit || 0);
      const x = m.get(k) || { q: 0, nome: l.nome, v: 0 };
      x.q += +l.quantidade; x.v = P.round(x.v + (+l.quantidade) * (+l.preco_unit || 0), 2);
      m.set(k, x);
    });
    return [...m.values()];
  }
  // tudo o que o cliente deve, conta por conta, para o extrato de cobrança (js/extrato.js)
  function extratoFiado(g) {
    const porConta = new Map();
    g.pags.slice().sort(ordemFiado).forEach(p => porConta.set(p.comanda_id, (porConta.get(p.comanda_id) || 0) + (+p.valor || 0)));
    const contas = [...porConta.entries()].map(([cid, deve]) => {
      const c = P.Store.get('comandas', cid) || {};
      const ps = pagamentos(cid);
      return {
        id: cid, dia: c.dia_operacional || '', hora: c.aberta_em && !semHora(c) ? P.Dia.hora(c.aberta_em) : '', local: c.id ? nomeLocal(c) : '',
        itens: itensSomados(cid),
        desconto: +c.desconto || 0, consumo: +c.total || 0,
        pagoNaHora: P.round(ps.filter(p => p.forma !== 'FIADO').reduce((s, p) => s + (+p.valor || 0), 0), 2),
        fiadoPago: P.round(ps.filter(p => p.forma === 'FIADO' && p.recebido_em).reduce((s, p) => s + (+p.valor || 0), 0), 2),
        deve: P.round(deve, 2),
      };
    });
    // pagamentos destas contas (o que quitou contas antigas fica fora da cobrança)
    const baixas = baixasDe(g.k, new Set(porConta.keys()));
    return { nome: g.nome, contas, baixas, pago: P.round(baixas.reduce((t, b) => t + b.v, 0), 2), total: P.round(g.total, 2) };
  }
  // o que o cliente já pagou do fiado (cada baixa, da mais recente para a mais antiga)
  // contas (opcional): Set de comanda_id; só conta o que foi pago nelas (ex.: as contas ainda em aberto)
  function baixasDe(k, contas) {
    const m = new Map();
    P.Store.all('pagamentos').forEach(p => {
      if (p.forma !== 'FIADO' || !p.recebido_em || P.UI.semAcento(clienteDe(p)) !== k) return;
      if (contas && !contas.has(p.comanda_id)) return;
      const x = m.get(p.recebido_em) || { em: p.recebido_em, dia: p.recebido_dia, forma: p.recebido_forma, v: 0 };
      x.v = P.round(x.v + (+p.valor || 0), 2);
      m.set(p.recebido_em, x);
    });
    return [...m.values()].sort((a, b) => (a.em < b.em ? 1 : -1));
  }
  // clientes devendo: o fiado em aberto agrupado pelo nome do cliente → [{ k, nome, total, pags }]
  function devedores() {
    const grupos = new Map();
    fiadoAberto().forEach(p => {
      const nome = clienteDe(p);
      const k = P.UI.semAcento(nome);
      if (!grupos.has(k)) grupos.set(k, { k, nome, total: 0, pags: [] });
      const g = grupos.get(k);
      g.total = P.round(g.total + (+p.valor || 0), 2);
      g.pags.push(p);
    });
    return [...grupos.values()].sort((a, b) => b.total - a.total);
  }
  const contasDe = g => [...new Set(g.pags.slice().sort(ordemFiado).map(p => p.comanda_id))];
  // o que consumiu nas contas em aberto, em poucas palavras ("22/10: 2× Filé de frango… · 23/10: 1× Feijoada")
  const consumoCurto = g => contasDe(g).map(id => {
    const its = itensSomados(id);
    return P.Dia.rotuloCurto((P.Store.get('comandas', id) || {}).dia_operacional || '') + ': ' +
      (its.length ? its.slice(0, 3).map(i => P.numAuto(i.q) + '× ' + i.nome).join(', ') + (its.length > 3 ? '…' : '') : 'sem itens anotados');
  }).join(' · ');
  const hrefCliente = k => '#/mesas/fiado/' + encodeURIComponent(k);
  const cobrar = g => { if (P.Extrato) P.Extrato.abrir(extratoFiado(g)); };

  function telaFiado(view) {
    view.className = 'v-mesas';
    const corpo = h('div');
    function desenhar() {
      corpo.innerHTML = '';
      const lista = devedores();
      const tot = lista.reduce((s, g) => s + g.total, 0);
      corpo.appendChild(h('div', { class: 'fx-resumo' }, h('div', { class: 'fx-tot' }, h('small', null, lista.length + (lista.length === 1 ? ' cliente' : ' clientes') + ' devendo'), h('b', null, P.brl(tot)))));
      if (!lista.length) { corpo.appendChild(P.UI.vazio('Ninguém devendo. Fiado aparece aqui quando a conta é fechada como "Fiado".')); return; }
      corpo.appendChild(h('div', { class: 'ms-lista' }, lista.map(g => {
        const desde = g.pags.map(p => p.dia_operacional).sort()[0];
        const ult = baixasDe(g.k)[0];
        const n = contasDe(g).length;
        return h('div', { class: 'fia-card' },
          h('a', { class: 'fia-card-top', href: hrefCliente(g.k) },
            h('div', { class: 'ms-card-n' }, g.nome,
              h('small', null, n + (n === 1 ? ' conta' : ' contas') + ' · desde ' + P.Dia.rotuloCurto(desde) + (ult ? ' · pagou ' + P.brl(ult.v) + ' em ' + P.Dia.rotuloCurto(ult.dia) : '')),
              h('small', { class: 'fia-consumo' }, consumoCurto(g))),
            h('b', null, P.brl(g.total))),
          h('div', { class: 'fia-acoes' },
            h('a', { class: 'btn mini', href: hrefCliente(g.k) }, P.UI.icone('relatorio'), 'Consumo'),
            h('button', { type: 'button', class: 'btn mini', onClick: () => cobrar(g) }, P.UI.icone('upload'), 'Cobrar'),
            h('button', { type: 'button', class: 'btn mini primario', onClick: () => receber(g) }, P.UI.icone('dinheiro'), 'Receber')));
      })));
      corpo.appendChild(h('div', { class: 'dica' }, 'Consumo: tudo o que o cliente consumiu, conta por conta, e o que já pagou. Cobrar: extrato para mandar no WhatsApp (imagem, PDF ou texto). ' +
        'Receber: dar baixa — se pagou só uma parte, troque o valor; abate das contas mais antigas e o resto continua no fiado.'));
    }
    view.append(subnavMesas('fiado'), corpo);
    desenhar();
    return { onDados(t) { if (t.has('pagamentos') || t.has('comandas')) desenhar(); } };
  }

  // FIADO DE UM CLIENTE: o que consumiu (conta por conta, item por item), o que já pagou e quanto falta
  function telaFiadoCliente(view, params) {
    view.className = 'v-mesas';
    const k = params.k || '';
    const corpo = h('div', { class: 'fia-cli' });
    const nomeDe = () => { const p = P.Store.all('pagamentos').find(x => x.forma === 'FIADO' && P.UI.semAcento(clienteDe(x)) === k); return p ? clienteDe(p) : k; };
    const linha = (rot, val, cls) => h('div', { class: 'fia-it' + (cls ? ' ' + cls : '') }, h('span', null, rot), h('span', null, val));
    function desenhar() {
      const g = devedores().find(x => x.k === k);
      const d = g ? extratoFiado(g) : null;
      const abertas = new Set(g ? contasDe(g) : []);
      const baixas = g ? d.baixas : [];
      const antigas = baixasDe(k, new Set(P.Store.all('pagamentos').filter(p => p.forma === 'FIADO' && !abertas.has(p.comanda_id)).map(p => p.comanda_id)));
      const soma = l => P.round(l.reduce((s, b) => s + b.v, 0), 2);
      const pagoTot = soma(baixas);
      const listaPags = l => h('div', { class: 'rs-itens' }, l.map(b => h('div', { class: 'rs-l' },
        h('span', { class: 'rs-h' }, P.Dia.rotuloCurto(b.dia)),
        h('span', { class: 'rs-n' }, (NOME_FORMA[b.forma] || b.forma) + (b.em ? ' · ' + P.Dia.hora(b.em) : '')),
        h('span', { class: 'rs-v' }, P.brl(b.v)))));
      corpo.replaceChildren(...[
        h('div', { class: 'fia-topo' },
          h('div', { class: 'fia-nome' }, g ? g.nome : nomeDe()),
          h('div', { class: 'fia-deve' }, h('small', null, g ? 'Deve' : 'Não deve nada'), h('b', null, P.brl(g ? g.total : 0))),
          h('small', { class: 'fia-sub' }, g ? d.contas.length + (d.contas.length === 1 ? ' conta em aberto' : ' contas em aberto') + (pagoTot ? ' · já pagou ' + P.brl(pagoTot) + ' delas' : '') : 'tudo pago')),
        g ? h('div', { class: 'fia-botoes' },
          h('button', { type: 'button', class: 'btn primario', onClick: () => cobrar(g) }, P.UI.icone('upload'), 'Enviar cobrança'),
          h('button', { type: 'button', class: 'btn', onClick: () => receber(g) }, P.UI.icone('dinheiro'), 'Recebi pagamento')) : null,
        g ? h('div', { class: 'secao' }, 'O que consumiu') : null,
        g ? d.contas.map(c => h('div', { class: 'fia-conta' },
          h('div', { class: 'fia-conta-t' }, P.Dia.rotulo(c.dia) + (c.hora ? ' · ' + c.hora : '') + (c.local ? ' · ' + c.local : '')),
          c.itens.length ? c.itens.map(i => linha(P.numAuto(i.q) + '× ' + i.nome, P.brl(i.v))) : linha('sem itens anotados', '', 'fia-menos'),
          c.desconto ? linha('Desconto', '− ' + P.brl(c.desconto), 'fia-menos') : null,
          linha('Total da conta', P.brl(c.consumo), 'fia-sum'),
          c.pagoNaHora ? linha('Pago na hora', '− ' + P.brl(c.pagoNaHora), 'fia-menos') : null,
          c.fiadoPago ? linha('Já pagou depois', '− ' + P.brl(c.fiadoPago), 'fia-menos') : null,
          linha('Falta desta conta', P.brl(c.deve), 'fia-falta'))) : null,
        g ? [h('div', { class: 'secao' }, 'Pagamentos destas contas' + (pagoTot ? ' · ' + P.brl(pagoTot) : '')),
          baixas.length ? listaPags(baixas) : h('div', { class: 'dica' }, 'Ainda não pagou nada destas contas.')] : null,
        antigas.length ? [h('div', { class: 'secao' }, (g ? 'Antes: contas já pagas · ' : 'Pagamentos já feitos · ') + P.brl(soma(antigas))), listaPags(antigas)] : null,
        g ? null : h('a', { class: 'btn bloco', href: '#/mesas/fiado' }, P.UI.icone('voltar'), 'Voltar ao fiado'),
      ].flat(Infinity).filter(x => x != null && x !== false));
    }
    view.append(corpo);
    desenhar();
    return { onDados(t) { if (t.has('pagamentos') || t.has('comandas') || t.has('comanda_itens')) desenhar(); } };
  }

  // dar baixa no fiado: quanto pagou agora e em que forma (se for só uma parte, o resto continua devendo)
  function receber(g) {
    let valor = g.total;
    const bValor = h('button', { type: 'button', class: 'btn valor bloco fia-valor' });
    const tit = h('div', { class: 'secao' });
    function mostrar() {
      const tudo = valor >= g.total - 0.004;
      bValor.replaceChildren(h('b', null, P.brl(valor)), h('small', null, tudo ? 'a dívida toda · pagou só uma parte? toque aqui' : 'continua devendo ' + P.brl(g.total - valor) + ' · trocar'));
      tit.textContent = (tudo ? 'Recebi tudo (' : 'Recebi ') + P.brl(valor) + (tudo ? ') em:' : ' em:');
    }
    bValor.addEventListener('click', async () => {
      const v = await P.UI.pedirNumero({ titulo: 'Quanto pagou agora?', valor: null, decimais: 2, prefixo: 'R$ ', sub: g.nome + ' deve ' + P.brl(g.total) + '. O resto continua no fiado.' });
      if (v == null || !(v > 0)) return;
      if (v > g.total + 0.004) { P.UI.toast('Maior que a dívida (' + P.brl(g.total) + ').', { tipo: 'perigo' }); return; }
      valor = P.round(v, 2);
      mostrar();
    });
    const n = contasDe(g).length;
    const sh = P.UI.sheet(h('div', { class: 'np-sheet' },
      h('div', { class: 'fia-deve' }, h('small', null, 'Deve'), h('b', null, P.brl(g.total))),
      location.hash.startsWith(hrefCliente(g.k)) ? null : h('a', { class: 'fia-ver', href: hrefCliente(g.k), onClick: () => sh.fechar() },
        n + (n === 1 ? ' conta' : ' contas') + ': ' + consumoCurto(g), h('b', null, ' Ver tudo ›')),
      h('div', { class: 'secao' }, 'Quanto pagou agora'),
      bValor, tit,
      h('div', { class: 'pg-formas' }, FORMAS.filter(f => f.v !== 'FIADO').map(f => h('button', { type: 'button', class: 'pg-forma f-' + f.v.toLowerCase(), onClick: () => {
        const v = valor, resta = P.round(g.total - v, 2);
        const desfazer = receberFiado(g.pags, v, f.v);
        P.vibrar([20, 40, 20]);
        sh.fechar();
        P.UI.toast(g.nome + ': ' + P.brl(v) + ' recebido (' + f.rotulo + ')' + (resta > 0.004 ? ' · continua devendo ' + P.brl(resta) : ' · quitou'), {
          acao: { rotulo: 'Desfazer', fn: desfazer },
        });
      } }, h('span', { class: 'pg-ic' }, P.UI.icone(ICONE_FORMA[f.v])), f.rotulo)))),
    { titulo: 'Receber de ' + g.nome });
    mostrar();
  }

  P.UI.rota('mesas', { titulo: 'Mesas', tab: 'mesas', render: telaMesas });
  P.UI.rota('mesas/c/:id', { titulo: 'Comanda', tab: 'mesas', render: telaComanda });
  P.UI.rota('mesas/c/:id/:modo', { titulo: 'Venda rápida', tab: 'mesas', render: telaComanda });
  P.UI.rota('mesas/pagar/:id', { titulo: 'Pagamento', tab: 'mesas', render: telaPagar });
  P.UI.rota('mesas/hoje', { titulo: 'Contas fechadas', tab: 'mesas', render: telaFechadas });
  P.UI.rota('mesas/totais', { titulo: 'Totais do dia', tab: 'mesas', render: telaTotais });
  P.UI.rota('mesas/despesas', { titulo: 'Despesas', tab: 'mesas', render: telaDespesas });
  P.UI.rota('mesas/fiado', { titulo: 'Fiado', tab: 'mesas', render: telaFiado });
  P.UI.rota('mesas/marmitas', { titulo: 'Marmitas em aberto', tab: 'mesas', render: telaMarmitas });
  P.UI.rota('mesas/fiado/:k', { titulo: 'Fiado do cliente', tab: 'mesas', render: telaFiadoCliente });

  P.Mesas = {
    linhas, pagamentos, subtotal, totalDe, jaPago, faltaDe, pagarParte, extratoFiado, abertas, rotulo, nomeLocal, canalPeloRelogio, subnavMesas, navDia, fiadoAberto, receberFiado, baixasDe, formasDe, totaisDoDia,
    FORMAS, NOME_FORMA, ICONE_FORMA, NOME_CANAL, CAT_DESPESA, NOME_DESP, DESP_FIXA, DESP_DONO, DESP_FORA, FORMAS_DESP, NOME_FORMA_DESP, despVisivel, subDesp,
    SUBTIPOS, NOME_SUBTIPO, competenciaDe, rotuloCompetencia, inicioSemana, novaDespesa, semHora, jaFechada, criarItem, excluirVenda,
    _abrir: abrir, _adicionar: adicionar, _fechar: fechar, _tirar: tirar,
  };
})();
