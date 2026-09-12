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
  const NOME_CANAL = { ESPETO: 'Espeto', SALAO: 'Salão', MARMITA: 'Marmita' };
  const CAT_DESPESA = [
    { v: 'MERCADORIA', rotulo: 'Mercadoria' }, { v: 'GAS_CARVAO', rotulo: 'Gás / carvão' },
    { v: 'EMBALAGEM', rotulo: 'Embalagem' }, { v: 'LIMPEZA', rotulo: 'Limpeza' }, { v: 'OUTROS', rotulo: 'Outros' },
  ];
  const NOME_DESP = Object.fromEntries(CAT_DESPESA.map(c => [c.v, c.rotulo]));
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
  const abertas = () => P.Store.all('comandas').filter(c => c.status === 'ABERTA').sort((a, b) => (a.aberta_em < b.aberta_em ? -1 : 1));
  function nomeLocal(c) { return c.mesa ? (/^\d+$/.test(c.mesa) ? 'Mesa ' + c.mesa : c.mesa) : 'Comanda'; }
  function rotulo(c) { return nomeLocal(c) + (c.cliente ? ' · ' + c.cliente : ''); }
  function tempo(iso) {
    const m = Math.max(0, Math.round((Date.now() - Date.parse(iso)) / 60000));
    return m < 60 ? m + ' min' : Math.floor(m / 60) + 'h' + String(m % 60).padStart(2, '0');
  }
  function canalPeloRelogio() {
    const f = P.Dia.faixa(), t = P.cfg('turnos');
    return f >= t.espeto_ini && f <= t.espeto_fim ? 'ESPETO' : 'SALAO';
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
  function adicionar(c, item, qtd) {
    qtd = qtd || 1;
    const u = P.Auth.usuario();
    const agora = Date.now();
    const k = c.id + '|' + item.id;
    const ult = ultimoToque.get(k);
    if (ult && agora - ult.t < AGRUPA_MS) {
      const l = P.Store.get('comanda_itens', ult.id);
      if (l) {
        P.Store.put('comanda_itens', Object.assign({}, l, { quantidade: (+l.quantidade || 0) + qtd }));
        ult.t = agora;
        return;
      }
    }
    const f = P.Calc.ficha(item);
    const id = P.uuid();
    P.Store.put('comanda_itens', {
      id, comanda_id: c.id, item_id: item.id, nome: item.nome, quantidade: qtd,
      preco_unit: P.round(f.preco, 2), cmv_unit: P.round(f.cmv, 4),
      adicionado_em: new Date(agora).toISOString(), usuario_id: u && u.id, removidos: 0,
    });
    ultimoToque.set(k, { id, t: agora });
  }
  // tira 1 unidade do lançamento mais recente do item (fica registrado quem tirou)
  function tirar(c, itemId) {
    const ls = linhas(c.id).filter(l => l.item_id === itemId);
    const l = ls[ls.length - 1];
    if (!l) return false;
    const u = P.Auth.usuario();
    const marca = { removidos: (+l.removidos || 0) + 1, removido_por: u && u.id, removido_em: P.agoraISO() };
    if ((+l.quantidade || 0) > 1) P.Store.put('comanda_itens', Object.assign({}, l, marca, { quantidade: l.quantidade - 1 }));
    else P.Store.put('comanda_itens', Object.assign({}, l, marca, { quantidade: 0, excluido: true }));
    ultimoToque.delete(c.id + '|' + itemId);
    return true;
  }
  function fechar(c, pags, desconto) {
    const u = P.Auth.usuario();
    const agora = P.agoraISO();
    const dia = P.Dia.diaOperacional(agora);
    const d = P.round(desconto || 0, 2);
    const total = Math.max(0, P.round(subtotal(c.id) - d, 2));
    pags.filter(p => p.valor > 0).forEach(p => P.Store.put('pagamentos', {
      id: P.uuid(), comanda_id: c.id, dia_operacional: dia, forma: p.forma, valor: P.round(p.valor, 2),
      pago_em: agora, usuario_id: u && u.id, recebido_em: null, recebido_dia: null, recebido_forma: null,
    }));
    return P.Store.put('comandas', Object.assign({}, P.Store.get('comandas', c.id) || c, {
      status: 'FECHADA', fechada_em: agora, dia_operacional: dia, desconto: d, total, fechada_por: u && u.id,
    }));
  }
  function reabrir(c) {
    pagamentos(c.id).forEach(p => P.Store.remove('pagamentos', p.id));
    P.Store.put('comandas', Object.assign({}, c, { status: 'ABERTA', fechada_em: null, fechada_por: null }));
  }
  function cancelar(c) {
    const u = P.Auth.usuario();
    P.Store.put('comandas', Object.assign({}, c, { status: 'CANCELADA', fechada_em: P.agoraISO(), cancelada_por: u && u.id }));
  }

  // ---------------------------------------------------------------
  //  Componentes de tela
  // ---------------------------------------------------------------
  function subnavMesas(ativo) {
    const nFiado = fiadoAberto().length;
    return P.UI.subnav([
      { id: 'abertas', rota: 'mesas', rotulo: 'Mesas' },
      { id: 'hoje', rota: 'mesas/hoje', rotulo: 'Fechadas' },
      { id: 'despesas', rota: 'mesas/despesas', rotulo: 'Despesas' },
      { id: 'fiado', rota: 'mesas/fiado', rotulo: 'Fiado', badge: nFiado || null },
      { id: 'lancar', rota: 'lancar', rotulo: 'Lançar totais' },
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
    async function abrirMarmita() {
      const nome = await pedirTexto('Marmita — cliente / box', '', 'Ex.: Box 112 — Zé', clientesRecentes());
      if (nome == null) return;
      const c = abrir({ mesa: 'Marmita', cliente: nome, canal: 'MARMITA' });
      location.hash = '#/mesas/c/' + c.id;
    }
    function vendaRapida() {
      const c = abrir({ mesa: 'Balcão', cliente: '' });
      location.hash = '#/mesas/c/' + c.id + '/rapida';
    }

    function desenhar() {
      corpo.innerHTML = '';
      const ab = abertas();
      corpo.appendChild(h('div', { class: 'ms-acoes' },
        h('button', { type: 'button', class: 'btn primario ms-rapida', onClick: vendaRapida }, h('span', { class: 'ms-raio' }, '⚡'), 'Venda rápida (balcão)'),
        h('button', { type: 'button', class: 'btn ms-marm', onClick: abrirMarmita }, 'Marmita')));

      const n = Math.max(1, +P.cfg('mesas').quantidade || 12);
      const grade = h('div', { class: 'ms-grade' });
      for (let i = 1; i <= n; i++) {
        const cs = ab.filter(c => c.mesa === String(i));
        const tot = cs.reduce((s, c) => s + totalDe(c), 0);
        grade.appendChild(h('button', { type: 'button', class: 'ms-mesa' + (cs.length ? ' ocupada' : ''), onClick: () => abrirMesa(i) },
          h('span', { class: 'ms-n' }, i),
          cs.length ? [
            h('span', { class: 'ms-cli' }, cs.map(c => c.cliente || 'sem nome').join(', ')),
            h('span', { class: 'ms-tot' }, P.brl(tot)),
            h('span', { class: 'ms-tempo' }, tempo(cs[0].aberta_em)),
          ] : h('span', { class: 'ms-livre' }, 'livre')));
      }
      corpo.appendChild(grade);

      const outras = ab.filter(c => !/^\d+$/.test(c.mesa || ''));
      if (outras.length) {
        corpo.appendChild(h('div', { class: 'secao' }, 'Balcão e marmitas abertas'));
        corpo.appendChild(h('div', { class: 'ms-lista' }, outras.map(c => h('a', { class: 'ms-card', href: '#/mesas/c/' + c.id },
          h('div', { class: 'ms-card-n' }, rotulo(c), h('small', null, NOME_CANAL[c.canal] + ' · ' + tempo(c.aberta_em) + ' · ' + qtdItens(c.id) + ' itens')),
          h('b', null, P.brl(totalDe(c)))))));
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
      onDados(t) { if (t.has('comandas') || t.has('comanda_itens')) desenhar(); },
    };
  }

  // ---------------------------------------------------------------
  //  TELA: COMANDA (adicionar itens ao vivo)
  // ---------------------------------------------------------------
  const ORDEM = { ESPETO: ['ESPETO', 'BEBIDA', 'PRATO', 'GUARNICAO'], SALAO: ['PRATO', 'BEBIDA', 'ESPETO', 'GUARNICAO'], MARMITA: ['PRATO', 'BEBIDA', 'ESPETO', 'GUARNICAO'] };
  const ROT_CAT = { ESPETO: 'Espetos', PRATO: 'Pratos', BEBIDA: 'Bebidas', GUARNICAO: 'Outros' };

  function telaComanda(view, params) {
    view.className = 'v-comanda';
    const rapida = params.modo === 'rapida';
    let c = P.Store.get('comandas', params.id);
    if (!c) { view.append(voltar('#/mesas', 'Mesas'), P.UI.vazio('Comanda não encontrada.')); return {}; }
    if (c.status !== 'ABERTA') return telaResumo(view, c);
    let cat = ORDEM[c.canal] ? ORDEM[c.canal][0] : 'PRATO';

    const elCab = h('div', { class: 'cm-cab' });
    const elTotal = h('div', { class: 'cm-total' });
    const elCats = h('div', { class: 'cm-cats' });
    const elGrade = h('div', { class: 'cm-grade' });
    const elConsumo = h('div', { class: 'cm-consumo' });

    function vendaveis() { return P.Store.all('itens').filter(P.Calc.vendavel); }
    function qtdPorItem() {
      const m = new Map();
      linhas(c.id).forEach(l => m.set(l.item_id, (m.get(l.item_id) || 0) + (+l.quantidade || 0)));
      return m;
    }
    function desenharCab() {
      c = P.Store.get('comandas', c.id) || c;
      elCab.replaceChildren(
        h('a', { class: 'cm-voltar', href: '#/mesas', 'aria-label': 'Voltar às mesas' }, P.UI.icone('voltar')),
        h('button', { type: 'button', class: 'cm-tit', onClick: renomear },
          h('b', null, nomeLocal(c)), h('span', null, c.cliente || 'toque para pôr o nome')),
        h('button', { type: 'button', class: 'cm-canal', onClick: trocarCanal }, NOME_CANAL[c.canal] || c.canal),
        h('span', { class: 'cm-tempo' }, tempo(c.aberta_em)));
    }
    function desenharTotal() {
      const n = qtdItens(c.id);
      elTotal.replaceChildren(
        h('div', { class: 'cm-tot-v' }, h('small', null, n + (n === 1 ? ' item' : ' itens')), h('b', null, P.brl(totalDe(c)))),
        h('button', { type: 'button', class: 'btn primario cm-fechar', disabled: !n, onClick: () => { location.hash = '#/mesas/pagar/' + c.id; } }, 'Fechar conta', P.UI.icone('avancar')));
    }
    function desenharCats() {
      const presentes = new Set(vendaveis().map(i => i.categoria));
      elCats.replaceChildren(P.UI.seg((ORDEM[c.canal] || ORDEM.SALAO).filter(k => presentes.has(k)).map(k => ({ v: k, rotulo: ROT_CAT[k] })), cat, v => { cat = v; desenharGrade(); }, 'seg-p'));
    }
    function desenharGrade() {
      const q = qtdPorItem();
      elGrade.innerHTML = '';
      vendaveis().filter(i => i.categoria === cat).sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR')).forEach(it => {
        const n = q.get(it.id) || 0;
        elGrade.appendChild(h('button', { type: 'button', class: 'cm-item' + (n ? ' tem' : ''), onClick: e => {
          adicionar(c, it);
          P.vibrar(15);
          const b = e.currentTarget;
          if (b.animate) b.animate([{ transform: 'scale(.96)' }, { transform: 'scale(1)' }], { duration: 120 });
          atualizar();
        } },
        h('span', { class: 'cm-item-n' }, it.nome),
        h('span', { class: 'cm-item-p' }, P.brl(it.preco_venda)),
        n ? h('span', { class: 'cm-item-q' }, n) : null));
      });
    }
    function desenharConsumo() {
      const grupos = new Map();
      linhas(c.id).forEach(l => {
        if (!grupos.has(l.item_id)) grupos.set(l.item_id, { nome: l.nome, q: 0, v: 0, horas: [] });
        const g = grupos.get(l.item_id);
        g.q += +l.quantidade || 0;
        g.v += (+l.quantidade || 0) * (+l.preco_unit || 0);
        g.horas.push((l.quantidade > 1 ? l.quantidade + '× ' : '') + P.Dia.hora(l.adicionado_em));
      });
      elConsumo.innerHTML = '';
      if (!grupos.size) { elConsumo.appendChild(P.UI.vazio('Toque nos itens acima conforme forem saindo.')); return; }
      elConsumo.appendChild(h('div', { class: 'secao' }, 'Consumo'));
      grupos.forEach((g, itemId) => elConsumo.appendChild(h('div', { class: 'cm-lin' },
        h('div', { class: 'cm-lin-n' }, h('b', null, g.q + '×'), ' ' + g.nome, h('small', null, g.horas.join(' · '))),
        h('div', { class: 'cm-lin-v' }, P.brl(g.v)),
        h('button', { type: 'button', class: 'lc-b', 'aria-label': 'Tirar um', onClick: () => { tirar(c, itemId); P.vibrar([10, 40, 10]); atualizar(); } }, P.UI.icone('menos')),
        h('button', { type: 'button', class: 'lc-b mais', 'aria-label': 'Mais um', onClick: () => { const it = P.Store.get('itens', itemId); if (it) { adicionar(c, it); P.vibrar(15); atualizar(); } } }, P.UI.icone('mais')))));
      elConsumo.appendChild(h('button', { type: 'button', class: 'btn perigo bloco', onClick: cancelarComanda }, P.UI.icone('x'), 'Cancelar comanda'));
    }
    function atualizar() { desenharTotal(); desenharGrade(); desenharConsumo(); }
    async function renomear() {
      const nome = await pedirTexto('Nome do cliente', c.cliente || '', 'Ex.: João do box 40', clientesRecentes());
      if (nome == null) return;
      c = P.Store.put('comandas', Object.assign({}, P.Store.get('comandas', c.id), { cliente: nome || null }));
      desenharCab();
    }
    function trocarCanal() {
      const ordem = ['ESPETO', 'SALAO', 'MARMITA'];
      const prox = ordem[(ordem.indexOf(c.canal) + 1) % ordem.length];
      c = P.Store.put('comandas', Object.assign({}, P.Store.get('comandas', c.id), { canal: prox }));
      P.vibrar(10);
      desenharCab();
    }
    async function cancelarComanda() {
      const n = qtdItens(c.id);
      if (n && !(await P.UI.confirmar('Cancelar a comanda de ' + rotulo(c) + ' (' + P.brl(totalDe(c)) + ')? Fica registrado no relatório.', { ok: 'Cancelar comanda', perigo: true }))) return;
      cancelar(P.Store.get('comandas', c.id));
      location.hash = '#/mesas';
    }

    view.append(elCab, elTotal, elCats, elGrade, elConsumo);
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
    view.append(
      voltar('#/mesas/hoje', 'Fechadas'),
      h('div', { class: 'rs-cab ' + c.status.toLowerCase() },
        h('div', { class: 'rs-tit' }, rotulo(c)),
        h('div', { class: 'rs-sub' }, NOME_CANAL[c.canal] + ' · aberta ' + P.Dia.hora(c.aberta_em) + (c.fechada_em ? ' · ' + (c.status === 'CANCELADA' ? 'cancelada ' : 'fechada ') + P.Dia.hora(c.fechada_em) : '') + ' · ' + P.Dia.rotulo(c.dia_operacional)),
        h('div', { class: 'rs-total' }, c.status === 'CANCELADA' ? 'CANCELADA' : P.brl(c.total))),
      h('div', { class: 'secao' }, 'Itens (com horário)'),
      h('div', { class: 'rs-itens' }, L.map(l => h('div', { class: 'rs-l' + (l.excluido ? ' removido' : '') },
        h('span', { class: 'rs-h' }, P.Dia.hora(l.adicionado_em)),
        h('span', { class: 'rs-n' }, (l.excluido ? 0 : l.quantidade) + '× ' + l.nome,
          +l.removidos ? h('small', null, ' (' + l.removidos + ' tirado' + (l.removidos > 1 ? 's' : '') + ' por ' + nomeUsu(l.removido_por) + ' às ' + P.Dia.hora(l.removido_em) + ')') : null),
        h('span', { class: 'rs-v' }, P.brl((l.excluido ? 0 : l.quantidade) * l.preco_unit))))),
      +c.desconto ? h('div', { class: 'rs-l' }, h('span', { class: 'rs-h' }), h('span', { class: 'rs-n' }, 'Desconto'), h('span', { class: 'rs-v' }, '− ' + P.brl(c.desconto))) : null,
      pags.length ? [h('div', { class: 'secao' }, 'Pagamento'), h('div', { class: 'rs-itens' }, pags.map(p => h('div', { class: 'rs-l' },
        h('span', { class: 'rs-h' }, P.Dia.hora(p.pago_em)),
        h('span', { class: 'rs-n' }, NOME_FORMA[p.forma] + (p.forma === 'FIADO' ? (p.recebido_em ? ' — recebido ' + P.Dia.rotuloCurto(p.recebido_dia) + ' (' + NOME_FORMA[p.recebido_forma] + ')' : ' — em aberto') : '')),
        h('span', { class: 'rs-v' }, P.brl(p.valor)))))] : null,
      h('div', { class: 'rs-quem' }, 'Aberta por ' + nomeUsu(c.usuario_id) + (c.fechada_por ? ' · fechada por ' + nomeUsu(c.fechada_por) : '') + (c.cancelada_por ? ' · cancelada por ' + nomeUsu(c.cancelada_por) : '')),
      P.Auth.isDono() && c.status !== 'ABERTA' ? h('button', { type: 'button', class: 'btn bloco', onClick: async () => {
        if (!(await P.UI.confirmar('Reabrir a comanda de ' + rotulo(c) + '? Os pagamentos registrados serão desfeitos.', { ok: 'Reabrir' }))) return;
        reabrir(c);
        location.hash = '#/mesas/c/' + c.id;
        P.UI.render();
      } }, P.UI.icone('refresh'), 'Reabrir para corrigir') : null);
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
    const btnOk = h('button', { type: 'button', class: 'btn primario bloco pg-ok', onClick: confirmar }, P.UI.icone('check'), 'Confirmar pagamento');

    const total = () => Math.max(0, P.round(subtotal(c.id) - desconto, 2));
    const pago = () => P.round(pags.reduce((s, p) => s + p.valor, 0), 2);
    const falta = () => P.round(total() - pago(), 2);

    function desenhar() {
      elTopo.replaceChildren(
        h('div', { class: 'pg-rot' }, rotulo(c)),
        h('div', { class: 'pg-total' }, P.brl(total())),
        h('div', { class: 'pg-sub' }, qtdItens(c.id) + ' itens · subtotal ' + P.brl(subtotal(c.id)),
          h('button', { type: 'button', class: 'btn mini', onClick: pedirDesconto }, desconto ? 'desconto ' + P.brl(desconto) : '+ desconto')));
      elFormas.replaceChildren(...FORMAS.map(f => h('button', { type: 'button', class: 'pg-forma f-' + f.v.toLowerCase(), onClick: () => escolher(f.v) }, f.rotulo)));
      elPags.innerHTML = '';
      pags.forEach((p, i) => {
        const troco = p.forma === 'DINHEIRO' && p.recebido > p.valor ? P.round(p.recebido - p.valor, 2) : 0;
        elPags.appendChild(h('div', { class: 'pg-lin' },
          h('span', { class: 'pg-lin-f' }, NOME_FORMA[p.forma]),
          h('button', { type: 'button', class: 'btn valor', onClick: async () => {
            const v = await P.UI.pedirNumero({ titulo: NOME_FORMA[p.forma], valor: p.valor, decimais: 2, prefixo: 'R$ ' });
            if (v != null) { p.valor = v; desenhar(); }
          } }, P.brl(p.valor)),
          p.forma === 'DINHEIRO' ? h('button', { type: 'button', class: 'btn mini', onClick: async () => {
            const v = await P.UI.pedirNumero({ titulo: 'Quanto o cliente entregou?', valor: p.recebido || null, decimais: 2, prefixo: 'R$ ', rapidos: [10, 20, 50, 100] });
            if (v != null) { p.recebido = v; desenhar(); }
          } }, troco ? 'troco ' + P.brl(troco) : 'troco?') : null,
          h('button', { type: 'button', class: 'btn ic', 'aria-label': 'Remover', onClick: () => { pags.splice(i, 1); desenhar(); } }, P.UI.icone('x'))));
      });
      const f = falta();
      elFalta.className = 'pg-falta' + (Math.abs(f) < 0.005 ? ' ok' : f < 0 ? ' mais' : '');
      elFalta.textContent = !pags.length ? 'Toque na forma de pagamento' : Math.abs(f) < 0.005 ? 'Tudo certo' : f > 0 ? 'Falta ' + P.brl(f) : 'Passou ' + P.brl(-f) + ' — ajuste os valores';
      btnOk.disabled = !pags.length || Math.abs(f) >= 0.005;
    }
    function escolher(forma) {
      P.vibrar(12);
      const f = falta();
      if (f > 0.004) pags.push({ forma, valor: f });
      else if (pags.length === 1) pags[0].forma = forma;   // troca rápida da forma
      else pags.push({ forma, valor: 0 });
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

    view.append(voltar('#/mesas/c/' + c.id, 'Comanda'), elTopo, elFormas, elPags, elFalta, btnOk);
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
      h('div', { class: 'lc-dia-t' }, dia === hoje ? 'Hoje' : P.Dia.nomeSemana(dia), h('small', null, P.Dia.rotuloCurto(dia))),
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
          h('small', null, P.Dia.hora(c.aberta_em) + '–' + P.Dia.hora(c.fechada_em) + ' · ' + NOME_CANAL[c.canal] + ' · ' +
            (c.status === 'CANCELADA' ? 'cancelada' : pagamentos(c.id).map(p => NOME_FORMA[p.forma]).join(' + ')))),
        h('b', null, c.status === 'CANCELADA' ? '—' : P.brl(c.total))))));
    }
    view.append(subnavMesas('hoje'), corpo);
    desenhar();
    return { onDados: desenhar };
  }

  // ---------------------------------------------------------------
  //  TELA: DESPESAS (quanto gastei)
  // ---------------------------------------------------------------
  function novaDespesa(dia, cat0) {
    return new Promise(resolve => {
      let cat = cat0 || 'MERCADORIA';
      let valor = null;
      let feito = false;
      const desc = h('input', { class: 'campo', type: 'text', placeholder: 'O quê? (ex.: frango — box 12)', autocomplete: 'off' });
      const bValor = h('button', { type: 'button', class: 'btn valor bloco' });
      const mostrar = () => { bValor.textContent = valor ? P.brl(valor) : 'Valor (R$)'; };
      bValor.addEventListener('click', async () => {
        const v = await P.UI.pedirNumero({ titulo: 'Valor da despesa', valor, decimais: 2, prefixo: 'R$ ' });
        if (v != null) { valor = v; mostrar(); }
      });
      const sh = P.UI.sheet(h('div', { class: 'np-sheet' },
        P.UI.seg(CAT_DESPESA, cat, v => { cat = v; }, 'seg-p seg-cat'),
        bValor, desc,
        h('div', { class: 'row gap' },
          h('button', { type: 'button', class: 'btn', onClick: () => sh.fechar() }, 'Cancelar'),
          h('button', { type: 'button', class: 'btn primario grow', onClick: () => {
            if (!(valor > 0)) { P.UI.toast('Informe o valor.', { tipo: 'perigo' }); return; }
            const u = P.Auth.usuario();
            const r = P.Store.put('despesas', { id: P.uuid(), dia_operacional: dia, categoria: cat, descricao: desc.value.trim() || null, valor: P.round(valor, 2), criado_em: P.agoraISO(), usuario_id: u && u.id });
            feito = true; resolve(r); sh.fechar();
          } }, 'Salvar'))),
      { titulo: 'Nova despesa · ' + P.Dia.rotulo(dia), onFechar: () => { if (!feito) resolve(null); } });
      mostrar();
      setTimeout(() => bValor.click(), 150);
    });
  }
  function telaDespesas(view) {
    view.className = 'v-mesas';
    let dia = P.Dia.hoje();
    const corpo = h('div');
    function desenhar() {
      corpo.innerHTML = '';
      corpo.appendChild(navDia(dia, d => { dia = d; desenhar(); }));
      const ds = P.Store.all('despesas').filter(d => d.dia_operacional === dia).sort((a, b) => (a.criado_em < b.criado_em ? 1 : -1));
      const merc = ds.filter(d => d.categoria === 'MERCADORIA').reduce((s, d) => s + (+d.valor || 0), 0);
      const outras = ds.filter(d => d.categoria !== 'MERCADORIA').reduce((s, d) => s + (+d.valor || 0), 0);
      corpo.appendChild(h('div', { class: 'fx-resumo' },
        h('div', { class: 'fx-tot' }, h('small', null, 'Gasto no dia'), h('b', null, P.brl(merc + outras))),
        h('div', { class: 'fx-formas' }, h('span', { class: 'fx-f' }, 'Mercadoria ', h('b', null, P.brl(merc))), h('span', { class: 'fx-f' }, 'Outras ', h('b', null, P.brl(outras))))));
      corpo.appendChild(h('div', { class: 'row gap' },
        h('button', { type: 'button', class: 'btn primario grow', onClick: () => novaDespesa(dia, 'MERCADORIA').then(desenhar) }, P.UI.icone('mais'), 'Mercadoria'),
        h('button', { type: 'button', class: 'btn grow', onClick: () => novaDespesa(dia, 'OUTROS').then(desenhar) }, P.UI.icone('mais'), 'Outra despesa')));
      if (!ds.length) { corpo.appendChild(P.UI.vazio('Nenhuma despesa lançada neste dia. Mercadoria entra no food cost real do painel.')); return; }
      corpo.appendChild(h('div', { class: 'ms-lista' }, ds.map(d => h('div', { class: 'ms-card' },
        h('div', { class: 'ms-card-n' }, d.descricao || NOME_DESP[d.categoria], h('small', null, P.Dia.hora(d.criado_em) + ' · ' + NOME_DESP[d.categoria])),
        h('b', null, P.brl(d.valor)),
        h('button', { type: 'button', class: 'btn ic perigo', 'aria-label': 'Excluir', onClick: () => {
          P.Store.remove('despesas', d.id);
          P.UI.toast('Despesa excluída', { acao: { rotulo: 'Desfazer', fn: () => P.Store.put('despesas', Object.assign({}, d, { excluido: false })) } });
        } }, P.UI.icone('lixo'))))));
    }
    view.append(subnavMesas('despesas'), corpo);
    desenhar();
    return { onDados(t) { if (t.has('despesas')) desenhar(); } };
  }

  // ---------------------------------------------------------------
  //  TELA: FIADO (quem deve)
  // ---------------------------------------------------------------
  function fiadoAberto() {
    return P.Store.all('pagamentos').filter(p => p.forma === 'FIADO' && !p.recebido_em);
  }
  function telaFiado(view) {
    view.className = 'v-mesas';
    const corpo = h('div');
    function desenhar() {
      corpo.innerHTML = '';
      const grupos = new Map();
      fiadoAberto().forEach(p => {
        const c = P.Store.get('comandas', p.comanda_id);
        const nome = (c && c.cliente) || 'Sem nome';
        const k = P.UI.semAcento(nome);
        if (!grupos.has(k)) grupos.set(k, { nome, total: 0, pags: [] });
        const g = grupos.get(k);
        g.total += +p.valor || 0;
        g.pags.push(p);
      });
      const lista = [...grupos.values()].sort((a, b) => b.total - a.total);
      const tot = lista.reduce((s, g) => s + g.total, 0);
      corpo.appendChild(h('div', { class: 'fx-resumo' }, h('div', { class: 'fx-tot' }, h('small', null, lista.length + (lista.length === 1 ? ' cliente' : ' clientes') + ' devendo'), h('b', null, P.brl(tot)))));
      if (!lista.length) { corpo.appendChild(P.UI.vazio('Ninguém devendo. Fiado aparece aqui quando a conta é fechada como "Fiado".')); return; }
      corpo.appendChild(h('div', { class: 'ms-lista' }, lista.map(g => {
        const desde = g.pags.map(p => p.dia_operacional).sort()[0];
        return h('button', { type: 'button', class: 'ms-card', onClick: () => receber(g) },
          h('div', { class: 'ms-card-n' }, g.nome, h('small', null, g.pags.length + (g.pags.length === 1 ? ' conta' : ' contas') + ' · desde ' + P.Dia.rotuloCurto(desde))),
          h('b', null, P.brl(g.total)));
      })));
    }
    function receber(g) {
      const sh = P.UI.sheet(h('div', { class: 'np-sheet' },
        h('div', { class: 'rs-itens' }, g.pags.sort((a, b) => (a.pago_em < b.pago_em ? -1 : 1)).map(p => h('div', { class: 'rs-l' },
          h('span', { class: 'rs-h' }, P.Dia.rotuloCurto(p.dia_operacional)), h('span', { class: 'rs-n' }, rotulo(P.Store.get('comandas', p.comanda_id) || {})), h('span', { class: 'rs-v' }, P.brl(p.valor))))),
        h('div', { class: 'secao' }, 'Recebi ' + P.brl(g.total) + ' em:'),
        h('div', { class: 'pg-formas' }, FORMAS.filter(f => f.v !== 'FIADO').map(f => h('button', { type: 'button', class: 'pg-forma f-' + f.v.toLowerCase(), onClick: () => {
          const agora = P.agoraISO();
          const dia = P.Dia.diaOperacional(agora);
          g.pags.forEach(p => P.Store.put('pagamentos', Object.assign({}, p, { recebido_em: agora, recebido_dia: dia, recebido_forma: f.v })));
          P.vibrar([20, 40, 20]);
          sh.fechar();
          P.UI.toast(g.nome + ': ' + P.brl(g.total) + ' recebido (' + f.rotulo + ')', {
            acao: { rotulo: 'Desfazer', fn: () => g.pags.forEach(p => P.Store.put('pagamentos', Object.assign({}, p, { recebido_em: null, recebido_dia: null, recebido_forma: null }))) },
          });
        } }, f.rotulo)))),
      { titulo: 'Fiado de ' + g.nome });
    }
    view.append(subnavMesas('fiado'), corpo);
    desenhar();
    return { onDados(t) { if (t.has('pagamentos') || t.has('comandas')) desenhar(); } };
  }

  P.UI.rota('mesas', { titulo: 'Mesas', tab: 'mesas', render: telaMesas });
  P.UI.rota('mesas/c/:id', { titulo: 'Comanda', tab: 'mesas', render: telaComanda });
  P.UI.rota('mesas/c/:id/:modo', { titulo: 'Venda rápida', tab: 'mesas', render: telaComanda });
  P.UI.rota('mesas/pagar/:id', { titulo: 'Pagamento', tab: 'mesas', render: telaPagar });
  P.UI.rota('mesas/hoje', { titulo: 'Contas fechadas', tab: 'mesas', render: telaFechadas });
  P.UI.rota('mesas/despesas', { titulo: 'Despesas', tab: 'mesas', render: telaDespesas });
  P.UI.rota('mesas/fiado', { titulo: 'Fiado', tab: 'mesas', render: telaFiado });

  P.Mesas = {
    linhas, pagamentos, subtotal, totalDe, abertas, rotulo, nomeLocal, canalPeloRelogio, subnavMesas, fiadoAberto,
    FORMAS, NOME_FORMA, NOME_CANAL, CAT_DESPESA, NOME_DESP,
    _abrir: abrir, _adicionar: adicionar, _fechar: fechar, _tirar: tirar,
  };
})();
