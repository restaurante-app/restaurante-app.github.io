/* COMPRAS — o que foi comprado no mercado, de quem, por quanto e como foi pago.
   - Cada item comprado de insumo ATUALIZA o preço do insumo (preço vivo das fichas)
     e mostra na hora quais pratos mudaram de margem.
   - O resultado do dia (vendas − custo do vendido − despesas − fixo) e o caixa
     (entrou × saiu) são recalculados ao vivo a cada compra ou venda.
   - Custos (dono): comprado × consumido pelas vendas (pela ficha), por insumo. */
(function () {
  'use strict';
  const P = window.P;
  const h = P.UI.h;
  const FORMAS = [
    { v: 'DINHEIRO', rotulo: 'Dinheiro' }, { v: 'PIX', rotulo: 'Pix' },
    { v: 'CARTAO', rotulo: 'Cartão' }, { v: 'PRAZO', rotulo: 'A prazo' },
  ];
  const NOME_FORMA = { DINHEIRO: 'Dinheiro', PIX: 'Pix', CARTAO: 'Cartão', PRAZO: 'A prazo', DEBITO: 'Débito', CREDITO: 'Crédito' };
  const UN = { kg: 'kg', L: 'L', un: 'un' };

  // ---------------------------------------------------------------
  //  Dados
  // ---------------------------------------------------------------
  let cache = { v: -1 };
  function idx() {
    if (cache.v === P.Store.versao) return cache;
    const itens = new Map();
    P.Store.all('compra_itens').forEach(l => { if (!itens.has(l.compra_id)) itens.set(l.compra_id, []); itens.get(l.compra_id).push(l); });
    itens.forEach(l => l.sort((a, b) => (a.ordem || 0) - (b.ordem || 0)));
    cache = { v: P.Store.versao, itens };
    return cache;
  }
  const itensDe = id => idx().itens.get(id) || [];
  const aPagar = () => P.Store.all('compras').filter(c => c.forma === 'PRAZO' && !c.pago_em);
  const doDia = dia => P.Store.all('compras').filter(c => c.dia_operacional === dia).sort((a, b) => (a.criado_em < b.criado_em ? 1 : -1));
  const nomeCompra = c => c.fornecedor || 'Compra sem fornecedor';
  function resumoItens(c) {
    const ls = itensDe(c.id);
    const nomes = ls.slice(0, 3).map(l => l.descricao);
    return nomes.join(', ') + (ls.length > 3 ? ' +' + (ls.length - 3) : '');
  }
  function fornecedoresRecentes() {
    const vistos = new Map();
    P.Store.all('compras').filter(c => c.fornecedor).sort((a, b) => (a.criado_em < b.criado_em ? 1 : -1)).forEach(c => {
      const k = P.UI.semAcento(c.fornecedor);
      if (!vistos.has(k)) vistos.set(k, c.fornecedor);
    });
    return [...vistos.values()].slice(0, 8);
  }
  // quantas vezes cada insumo aparece em compras (para pôr os mais comprados no topo)
  function frequencia() {
    const m = new Map();
    P.Store.all('compra_itens').forEach(l => { if (l.insumo_id) m.set(l.insumo_id, (m.get(l.insumo_id) || 0) + 1); });
    return m;
  }

  // Grava a compra (nova ou edição) e atualiza o preço dos insumos comprados
  function salvar(d, idExistente) {
    const u = P.Auth.usuario();
    const antes = P.Calc.snapshot();
    const agora = P.agoraISO();
    const ant = idExistente ? P.Store.get('compras', idExistente) : null;
    const id = ant ? ant.id : P.uuid();
    const dia = ant ? ant.dia_operacional : P.Dia.diaOperacional(agora);
    if (ant) itensDe(id).forEach(l => P.Store.remove('compra_itens', l.id));
    const total = P.round(d.linhas.reduce((s, l) => s + (+l.valor || 0), 0), 2);
    const criado = ant ? ant.criado_em : agora;
    // pago na hora (dinheiro/pix/cartão) ou a prazo (fica em "A pagar" até marcar como pago)
    let pg = { pago_em: null, pago_dia: null, pago_forma: null };
    if (d.forma !== 'PRAZO') pg = { pago_em: criado, pago_dia: dia, pago_forma: d.forma };
    else if (ant && ant.forma === 'PRAZO' && ant.pago_em) pg = { pago_em: ant.pago_em, pago_dia: ant.pago_dia, pago_forma: ant.pago_forma };
    const compra = P.Store.put('compras', Object.assign({
      id, dia_operacional: dia, fornecedor: (d.fornecedor || '').trim() || null, forma: d.forma, total,
      criado_em: criado, usuario_id: ant ? ant.usuario_id : (u && u.id), obs: d.obs || null,
    }, pg));
    d.linhas.forEach((l, i) => P.Store.put('compra_itens', {
      id: P.uuid(), compra_id: id, insumo_id: l.insumo_id || null, descricao: l.descricao,
      quantidade: P.round(l.quantidade, 3), unidade: l.unidade, preco_unit: P.round(l.preco_unit, 4), valor: P.round(l.valor, 2), ordem: i,
    }));
    // preço vivo: preço médio pago em cada insumo desta compra vira o preço do insumo
    // (ao editar compra antiga, não passa por cima de um preço de compra mais nova)
    const maisNova = new Set();
    if (ant) {
      P.Store.all('compras').forEach(c => {
        if (c.id === id || c.criado_em <= criado) return;
        itensDe(c.id).forEach(l => { if (l.insumo_id) maisNova.add(l.insumo_id); });
      });
    }
    const porInsumo = new Map();
    d.linhas.forEach(l => {
      if (!l.insumo_id || !(l.quantidade > 0) || maisNova.has(l.insumo_id)) return;
      const g = porInsumo.get(l.insumo_id) || { q: 0, v: 0 };
      g.q += +l.quantidade; g.v += +l.valor;
      porInsumo.set(l.insumo_id, g);
    });
    const mudancas = [];
    porInsumo.forEach((g, insId) => {
      const ins = P.Store.get('insumos', insId);
      if (!ins) return;
      const novo = P.round(g.v / g.q, 4);
      if (P.round(novo, 2) !== P.round(ins.preco, 2)) {
        mudancas.push({ ins, de: +ins.preco, para: novo });
        P.Store.put('insumos', Object.assign({}, ins, { preco: novo, atualizado_em: agora }));
        P.Store.put('historico_precos', { id: P.uuid(), insumo_id: insId, preco: novo, data: agora });
      } else {
        P.Store.put('insumos', Object.assign({}, ins, { atualizado_em: agora }));
      }
    });
    const efeito = P.Fichas.medirEfeito(antes);
    return { compra, mudancas, efeito };
  }
  function pagar(compras, forma) {
    const agora = P.agoraISO();
    const dia = P.Dia.diaOperacional(agora);
    compras.forEach(c => P.Store.put('compras', Object.assign({}, c, { pago_em: agora, pago_dia: dia, pago_forma: forma })));
  }

  // ---------------------------------------------------------------
  //  Componentes
  // ---------------------------------------------------------------
  function subnavCompras(ativo) {
    const n = aPagar().length;
    const itens = [
      { id: 'dia', rota: 'compras', rotulo: 'Compras do dia' },
      { id: 'pagar', rota: 'compras/pagar', rotulo: 'A pagar', badge: n || null },
    ];
    if (P.Auth.isDono()) itens.push({ id: 'custos', rota: 'compras/custos', rotulo: 'Custos' });
    return P.UI.subnav(itens, ativo);
  }
  function voltar(href, rot) { return h('a', { class: 'voltar', href }, P.UI.icone('voltar'), rot || 'Voltar'); }
  function navDia(dia, onMuda) {
    const hoje = P.Dia.hoje();
    return h('div', { class: 'lc-dia' },
      h('button', { type: 'button', class: 'pn-nav', 'aria-label': 'Dia anterior', onClick: () => onMuda(P.Dia.anterior(dia)) }, P.UI.icone('voltar')),
      h('div', { class: 'lc-dia-t' }, dia === hoje ? 'Hoje' : P.Dia.nomeSemana(dia), h('small', null, P.Dia.rotuloCurto(dia))),
      h('button', { type: 'button', class: 'pn-nav', 'aria-label': 'Próximo dia', disabled: dia >= hoje, onClick: () => onMuda(P.Dia.seguinte(dia)) }, P.UI.icone('avancar')));
  }
  const chipForma = c => h('span', { class: 'tag ' + (c.forma === 'PRAZO' ? (c.pago_em ? 'ok' : 'aviso') : 'neutra') },
    c.forma === 'PRAZO' ? (c.pago_em ? 'pago ' + P.Dia.rotuloCurto(c.pago_dia) : 'a pagar') : NOME_FORMA[c.forma] || c.forma);

  // Resultado ao vivo (dono): vendas − custo do vendido − despesas − fixo; e o caixa
  function cardResultado(dia) {
    const r = P.Painel.resultadoDia(dia);
    const cor = !r.temMovimento ? 'cinza' : r.resultado >= 0 ? 'verde' : 'vermelho';
    return h('a', { class: 'res-card s-' + cor, href: '#/painel' },
      h('div', { class: 'res-top' },
        h('div', null, h('div', { class: 'res-rot' }, 'Resultado do dia · ao vivo'), h('div', { class: 'res-num t-' + cor }, P.brl(r.resultado))),
        P.UI.icone('avancar')),
      h('div', { class: 'res-conta' },
        h('span', null, 'Vendas ', h('b', null, P.brl0(r.fat))),
        h('span', null, '− custo vendido ', h('b', null, P.brl0(r.cmv))),
        h('span', null, '− despesas ', h('b', null, P.brl0(r.outras))),
        h('span', null, '− fixo ', h('b', null, P.brl0(r.fixo)))),
      h('div', { class: 'res-caixa' },
        h('span', null, 'Caixa: entrou ', h('b', null, P.brl0(r.entrou))),
        h('span', null, 'saiu ', h('b', null, P.brl0(r.saiu))),
        h('span', null, 'saldo ', h('b', { class: r.entrou - r.saiu >= 0 ? 't-verde' : 't-vermelho' }, P.brl0(r.entrou - r.saiu)))));
  }

  // ---------------------------------------------------------------
  //  TELA: COMPRAS DO DIA
  // ---------------------------------------------------------------
  function telaCompras(view) {
    view.className = 'v-compras';
    let dia = P.Dia.hoje();
    const corpo = h('div');
    function desenhar() {
      corpo.innerHTML = '';
      corpo.appendChild(navDia(dia, d => { dia = d; desenhar(); }));
      if (P.Auth.isDono()) corpo.appendChild(cardResultado(dia));
      const cs = doDia(dia);
      const total = cs.reduce((s, c) => s + (+c.total || 0), 0);
      const devendo = aPagar().reduce((s, c) => s + (+c.total || 0), 0);
      corpo.appendChild(h('div', { class: 'fx-resumo' },
        h('div', { class: 'fx-tot' }, h('small', null, 'Comprado · ' + cs.length + (cs.length === 1 ? ' compra' : ' compras')), h('b', null, P.brl(total))),
        devendo ? h('a', { class: 'fx-formas link', href: '#/compras/pagar' }, h('span', { class: 'fx-f' }, 'A pagar a fornecedores ', h('b', { class: 't-amarelo' }, P.brl(devendo))), P.UI.icone('avancar')) : null));
      corpo.appendChild(h('a', { class: 'btn primario bloco cp-nova', href: '#/compras/nova' }, P.UI.icone('mais'), 'Lançar compra'));
      if (!cs.length) { corpo.appendChild(P.UI.vazio('Nenhuma compra neste dia. Cada compra atualiza o preço dos insumos e o custo dos pratos na hora.', 'compras')); return; }
      corpo.appendChild(h('div', { class: 'secao' }, 'Compras'));
      corpo.appendChild(h('div', { class: 'ms-lista' }, cs.map(c => h('a', { class: 'ms-card', href: '#/compras/c/' + c.id },
        h('div', { class: 'ms-card-n' }, nomeCompra(c), h('small', null, P.Dia.hora(c.criado_em) + ' · ' + resumoItens(c))),
        h('div', { class: 'ms-card-d' }, h('b', null, P.brl(c.total)), chipForma(c))))));
    }
    view.append(subnavCompras('dia'), corpo);
    desenhar();
    return { onDados: desenhar };
  }

  // ---------------------------------------------------------------
  //  Folha: quantidade + preço (um teclado para os dois campos)
  // ---------------------------------------------------------------
  function pedirQtdPreco(o) {
    return new Promise(resolve => {
      let feito = false;
      let campo = o.qtd ? 'preco' : 'qtd';
      let modo = 'unit'; // unit = preço por kg/L/un ; total = total pago
      const v = { qtd: o.qtd || null, preco: o.preco != null ? o.preco : null, total: null };
      const un = UN[o.unidade] || o.unidade;
      const bQtd = h('button', { type: 'button', class: 'qp-campo' });
      const bPreco = h('button', { type: 'button', class: 'qp-campo' });
      const info = h('div', { class: 'qp-info' });
      const bOk = h('button', { type: 'button', class: 'btn primario grow' });
      const np = P.UI.numpad({ decimais: 3, maxInteiros: 5, onChange: (buf, val) => { if (campo === 'qtd') v.qtd = val; else if (modo === 'unit') v.preco = val; else v.total = val; mostrar(); }, onEnter: avancar });
      const segModo = P.UI.seg([{ v: 'unit', rotulo: 'Preço por ' + un }, { v: 'total', rotulo: 'Total pago' }], modo, m => {
        if (modo === 'unit' && v.qtd > 0 && v.preco != null) v.total = P.round(v.qtd * v.preco, 2);
        if (modo === 'total' && v.qtd > 0 && v.total != null) v.preco = P.round(v.total / v.qtd, 4);
        modo = m; ir('preco');
      }, 'seg-p');
      bQtd.addEventListener('click', () => ir('qtd'));
      bPreco.addEventListener('click', () => ir('preco'));
      bOk.addEventListener('click', avancar);
      function precoUnit() { return modo === 'unit' ? v.preco : (v.qtd > 0 && v.total != null ? v.total / v.qtd : null); }
      function totalCalc() { return modo === 'total' ? v.total : (v.qtd != null && v.preco != null ? v.qtd * v.preco : null); }
      function ir(c) {
        campo = c;
        np.set(c === 'qtd' ? v.qtd : (modo === 'unit' ? v.preco : v.total));
        mostrar();
      }
      function mostrar() {
        const pu = precoUnit(), tot = totalCalc();
        bQtd.className = 'qp-campo' + (campo === 'qtd' ? ' on' : '');
        bPreco.className = 'qp-campo' + (campo === 'preco' ? ' on' : '');
        bQtd.replaceChildren(h('small', null, 'Quantidade'), h('b', null, (v.qtd != null ? P.numAuto(v.qtd) : '—') + ' ' + un));
        bPreco.replaceChildren(h('small', null, modo === 'unit' ? 'Preço por ' + un : 'Total pago'),
          h('b', null, modo === 'unit' ? (v.preco != null ? P.Fichas.precoFmt(v.preco) : '—') : (v.total != null ? P.brl(v.total) : '—')));
        const partes = [];
        if (tot != null) partes.push(h('span', null, 'Total ', h('b', null, P.brl(tot))));
        if (modo === 'total' && pu != null) partes.push(h('span', null, P.Fichas.precoFmt(pu) + '/' + un));
        if (o.precoAtual != null && pu != null && o.precoAtual > 0) {
          const dif = (pu / o.precoAtual - 1) * 100;
          if (Math.abs(dif) >= 0.5) partes.push(h('span', { class: dif > 0 ? 't-vermelho' : 't-verde' }, (dif > 0 ? '▲ ' : '▼ ') + P.num(Math.abs(dif), 1) + '% vs ' + P.Fichas.precoFmt(o.precoAtual)));
          else partes.push(h('span', { class: 't-cinza' }, 'mesmo preço de antes'));
        }
        info.replaceChildren(...partes);
        bOk.textContent = campo === 'qtd' ? 'Próximo' : (o.editar ? 'Salvar item' : 'Adicionar');
      }
      function avancar() {
        if (campo === 'qtd') {
          if (!(v.qtd > 0)) { P.vibrar(60); return; }
          ir('preco');
          return;
        }
        const pu = precoUnit(), tot = totalCalc();
        if (!(v.qtd > 0) || pu == null || tot == null) { P.vibrar(60); return; }
        feito = true;
        resolve({ quantidade: v.qtd, preco_unit: pu, valor: P.round(tot, 2) });
        sh.fechar();
      }
      const sh = P.UI.sheet(h('div', { class: 'np-sheet' },
        o.sub ? h('div', { class: 'np-sub' }, o.sub) : null,
        h('div', { class: 'qp-campos' }, bQtd, bPreco),
        segModo, info, np.el,
        h('div', { class: 'row gap' }, h('button', { type: 'button', class: 'btn', onClick: () => sh.fechar() }, 'Cancelar'), bOk)),
      { titulo: o.titulo, cls: 'sheet-np', onFechar: () => { np.destruir(); if (!feito) resolve(null); } });
      ir(campo);
    });
  }
  function pedirTexto(titulo, valor, placeholder, ok) {
    return new Promise(resolve => {
      let feito = false;
      const inp = h('input', { class: 'campo', type: 'text', value: valor || '', placeholder: placeholder || '', autocomplete: 'off', enterkeyhint: 'done' });
      const fim = () => { feito = true; resolve(inp.value.trim()); sh.fechar(); };
      inp.addEventListener('keydown', e => { if (e.key === 'Enter') fim(); });
      const sh = P.UI.sheet(h('div', { class: 'np-sheet' }, inp,
        h('div', { class: 'row gap' }, h('button', { type: 'button', class: 'btn', onClick: () => sh.fechar() }, 'Cancelar'),
          h('button', { type: 'button', class: 'btn primario grow', onClick: fim }, ok || 'Continuar'))),
      { titulo, onFechar: () => { if (!feito) resolve(null); } });
      setTimeout(() => inp.focus(), 80);
    });
  }

  // ---------------------------------------------------------------
  //  TELA: NOVA COMPRA / EDITAR
  // ---------------------------------------------------------------
  function telaNova(view, params) {
    view.className = 'v-cp-form';
    const ant = params.id ? P.Store.get('compras', params.id) : null;
    if (params.id && !ant) { view.append(voltar('#/compras', 'Compras'), P.UI.vazio('Compra não encontrada.')); return {}; }
    const d = {
      fornecedor: ant ? ant.fornecedor || '' : '',
      forma: ant ? ant.forma : 'DINHEIRO',
      linhas: ant ? itensDe(ant.id).map(l => ({ insumo_id: l.insumo_id, descricao: l.descricao, quantidade: +l.quantidade, unidade: l.unidade, preco_unit: +l.preco_unit, valor: +l.valor })) : [],
    };
    const inForn = h('input', { class: 'campo', type: 'text', value: d.fornecedor, placeholder: 'Fornecedor (ex.: Box 12 — Seu Zé)', autocomplete: 'off' });
    inForn.addEventListener('input', () => { d.fornecedor = inForn.value; });
    const chipsForn = h('div', { class: 'chips' }, fornecedoresRecentes().map(f => h('button', { type: 'button', class: 'chip', onClick: () => { inForn.value = f; d.fornecedor = f; P.vibrar(8); } }, f)));
    const elLinhas = h('div', { class: 'cp-linhas' });
    const elBarra = h('div', { class: 'barra-acao' });

    function desenharLinhas() {
      elLinhas.innerHTML = '';
      if (!d.linhas.length) elLinhas.appendChild(h('div', { class: 'cp-vazio' }, 'Nenhum item ainda. Toque em "Adicionar item".'));
      d.linhas.forEach((l, i) => {
        const ins = l.insumo_id && P.Store.get('insumos', l.insumo_id);
        const dif = ins && !ant && +ins.preco > 0 ? (l.preco_unit / ins.preco - 1) * 100 : null;
        elLinhas.appendChild(h('div', { class: 'cp-lin' },
          h('button', { type: 'button', class: 'cp-lin-main', onClick: () => editarLinha(i) },
            h('span', { class: 'cp-lin-n' }, l.descricao, !l.insumo_id ? h('small', { class: 'tag neutra' }, 'sem ficha') : null),
            h('span', { class: 'cp-lin-q' }, P.numAuto(l.quantidade) + ' ' + (UN[l.unidade] || l.unidade) + ' × ' + P.Fichas.precoFmt(l.preco_unit),
              dif != null && Math.abs(dif) >= 0.5 ? h('em', { class: dif > 0 ? 't-vermelho' : 't-verde' }, (dif > 0 ? ' ▲' : ' ▼') + P.num(Math.abs(dif), 0) + '%') : null)),
          h('b', { class: 'cp-lin-v' }, P.brl(l.valor)),
          h('button', { type: 'button', class: 'btn ic', 'aria-label': 'Remover', onClick: () => { d.linhas.splice(i, 1); P.vibrar(10); desenharLinhas(); } }, P.UI.icone('x'))));
      });
      const total = d.linhas.reduce((s, l) => s + (+l.valor || 0), 0);
      elBarra.replaceChildren(
        h('div', { class: 'barra-tot' }, h('small', null, d.linhas.length + (d.linhas.length === 1 ? ' item' : ' itens')), h('b', null, P.brl(total))),
        h('button', { type: 'button', class: 'btn primario barra-btn', disabled: !d.linhas.length, onClick: salvarCompra }, P.UI.icone('check'), ant ? 'Salvar alterações' : 'Salvar compra'));
    }
    async function adicionar() {
      const freq = frequencia();
      const ins = P.Store.all('insumos').sort((a, b) => ((freq.get(b.id) || 0) - (freq.get(a.id) || 0)) || a.nome.localeCompare(b.nome, 'pt-BR'));
      const id = await P.UI.escolher({
        titulo: 'O que você comprou?',
        opcoes: [{ v: '_avulso', rotulo: '+ Item sem ficha (gelo, sacola, carvão…)', sub: 'entra no gasto, não mexe em preço de ficha' }]
          .concat(ins.map(i => ({ v: i.id, rotulo: i.nome, sub: 'último ' + P.Fichas.precoUnit(i) + ' · ' + P.Fichas.haDias(i) + (freq.get(i.id) ? ' · comprado ' + freq.get(i.id) + 'x' : '') }))),
      });
      if (!id) return;
      if (id === '_avulso') {
        const desc = await pedirTexto('Item sem ficha — o que é?', '', 'Ex.: gelo, sacola, carvão', 'Próximo');
        if (!desc) return;
        const val = await P.UI.pedirNumero({ titulo: desc + ' — valor pago', decimais: 2, prefixo: 'R$ ' });
        if (!(val > 0)) return;
        d.linhas.push({ insumo_id: null, descricao: desc, quantidade: 1, unidade: 'un', preco_unit: val, valor: P.round(val, 2) });
        desenharLinhas();
        return;
      }
      const i = P.Store.get('insumos', id);
      const r = await pedirQtdPreco({ titulo: i.nome, unidade: i.unidade, preco: +i.preco, precoAtual: +i.preco, sub: 'Preço atual ' + P.Fichas.precoUnit(i) });
      if (!r) return;
      d.linhas.push({ insumo_id: i.id, descricao: i.nome, unidade: i.unidade, quantidade: r.quantidade, preco_unit: r.preco_unit, valor: r.valor });
      P.vibrar(15);
      desenharLinhas();
    }
    async function editarLinha(idx) {
      const l = d.linhas[idx];
      if (!l.insumo_id) {
        const val = await P.UI.pedirNumero({ titulo: l.descricao + ' — valor pago', valor: l.valor, decimais: 2, prefixo: 'R$ ' });
        if (val == null) return;
        Object.assign(l, { preco_unit: val, valor: P.round(val, 2) });
      } else {
        const ins = P.Store.get('insumos', l.insumo_id);
        const r = await pedirQtdPreco({ titulo: l.descricao, unidade: l.unidade, qtd: l.quantidade, preco: l.preco_unit, precoAtual: ins && !ant ? +ins.preco : null, editar: true });
        if (!r) return;
        Object.assign(l, r);
      }
      desenharLinhas();
    }
    function salvarCompra() {
      if (!d.linhas.length) return;
      const r = salvar(d, ant && ant.id);
      P.vibrar([20, 40, 20]);
      // mostra o resultado depois que a lista de compras abrir (trocar de tela fecha as folhas)
      const aoTrocar = () => { window.removeEventListener('hashchange', aoTrocar); setTimeout(() => mostrarResultado(r), 0); };
      window.addEventListener('hashchange', aoTrocar);
      location.hash = '#/compras';
    }

    view.append(
      voltar(ant ? '#/compras/c/' + ant.id : '#/compras', ant ? 'Compra' : 'Compras'),
      h('div', { class: 'form' },
        h('div', { class: 'form-tit' }, ant ? 'Editar compra' : 'Lançar compra', h('small', null, ant ? P.Dia.rotulo(ant.dia_operacional) : P.Dia.rotulo(P.Dia.hoje()))),
        h('div', { class: 'campo-l' }, h('span', { class: 'campo-r' }, 'De quem'), inForn, chipsForn),
        h('div', { class: 'campo-l' }, h('span', { class: 'campo-r' }, 'Itens'), elLinhas,
          h('button', { type: 'button', class: 'btn bloco cp-add', onClick: adicionar }, P.UI.icone('mais'), 'Adicionar item')),
        h('div', { class: 'campo-l' }, h('span', { class: 'campo-r' }, 'Como pagou'),
          P.UI.seg(FORMAS, d.forma, v => { d.forma = v; }, 'seg-p'),
          h('small', { class: 'campo-d' }, '"A prazo" fica em Compras → A pagar até você marcar como pago.'))),
      elBarra);
    desenharLinhas();
    if (!ant) setTimeout(() => { if (!d.linhas.length && location.hash === '#/compras/nova') adicionar(); }, 250);
    return {};
  }

  // Depois de salvar: o que mudou de preço e o efeito nos pratos
  function mostrarResultado(r) {
    const partes = [];
    if (r.mudancas.length) {
      partes.push(h('div', { class: 'secao' }, 'Preços atualizados nas fichas'));
      partes.push(h('div', { class: 'rs-itens' }, r.mudancas.map(m => {
        const dif = m.de > 0 ? (m.para / m.de - 1) * 100 : 0;
        return h('div', { class: 'rs-l cp' }, h('span', { class: 'rs-n' }, m.ins.nome),
          h('span', { class: 'rs-v' }, P.Fichas.precoFmt(m.de) + ' → ' + P.Fichas.precoFmt(m.para), h('em', { class: dif > 0 ? 't-vermelho' : 't-verde' }, ' ' + (dif > 0 ? '+' : '') + P.num(dif, 1) + '%')));
      })));
      partes.push(h('div', { class: 'secao' }, 'Efeito na margem dos pratos'));
      P.Fichas.frasesEfeito(r.efeito).forEach(n => partes.push(n));
    } else {
      partes.push(h('div', { class: 'efeito neutro' }, 'Nenhum preço mudou — fichas continuam iguais.'));
    }
    const sh = P.UI.sheet(h('div', { class: 'np-sheet' },
      h('div', { class: 'cp-ok' }, P.UI.icone('check'), h('div', null, h('b', null, 'Compra salva · ' + P.brl(r.compra.total)), h('small', null, nomeCompra(r.compra) + ' · ' + NOME_FORMA[r.compra.forma]))),
      partes,
      h('button', { type: 'button', class: 'btn primario bloco', onClick: () => sh.fechar() }, 'Ok')),
    { titulo: 'Compra lançada' });
  }

  // ---------------------------------------------------------------
  //  TELA: DETALHE DA COMPRA
  // ---------------------------------------------------------------
  function telaDetalhe(view, params) {
    view.className = 'v-compras';
    const corpo = h('div');
    function desenhar() {
      corpo.innerHTML = '';
      const c = P.Store.get('compras', params.id);
      if (!c) { corpo.appendChild(P.UI.vazio('Compra não encontrada (pode ter sido excluída).')); return; }
      const u = c.usuario_id && P.Store.get('usuarios', c.usuario_id);
      corpo.appendChild(h('div', { class: 'rs-cab' },
        h('div', { class: 'rs-tit' }, nomeCompra(c)),
        h('div', { class: 'rs-sub' }, P.Dia.rotulo(c.dia_operacional) + ' · ' + P.Dia.hora(c.criado_em) + (u ? ' · lançada por ' + u.nome : '')),
        h('div', { class: 'rs-total' }, P.brl(c.total)),
        h('div', { class: 'row gap' }, chipForma(c), c.forma === 'PRAZO' && c.pago_em ? h('span', { class: 'tag neutra' }, 'pago em ' + (NOME_FORMA[c.pago_forma] || '')) : null)));
      corpo.appendChild(h('div', { class: 'secao' }, 'Itens'));
      corpo.appendChild(h('div', { class: 'rs-itens' }, itensDe(c.id).map(l => h('div', { class: 'rs-l cp' },
        h('span', { class: 'rs-n' }, l.descricao, h('small', null, P.numAuto(l.quantidade) + ' ' + (UN[l.unidade] || l.unidade) + ' × ' + P.Fichas.precoFmt(l.preco_unit))),
        h('span', { class: 'rs-v' }, P.brl(l.valor))))));
      const acoes = h('div', { class: 'row gap acoes' });
      if (c.forma === 'PRAZO' && !c.pago_em) acoes.appendChild(h('button', { type: 'button', class: 'btn primario grow', onClick: () => pagarSheet([c], nomeCompra(c)) }, P.UI.icone('check'), 'Marcar como pago'));
      acoes.appendChild(h('a', { class: 'btn grow', href: '#/compras/editar/' + c.id }, P.UI.icone('lapis'), 'Editar'));
      if (P.Auth.isDono()) acoes.appendChild(h('button', { type: 'button', class: 'btn perigo', 'aria-label': 'Excluir', onClick: async () => {
        if (!(await P.UI.confirmar('Excluir esta compra de ' + P.brl(c.total) + '? Os preços das fichas não voltam atrás.', { ok: 'Excluir', perigo: true }))) return;
        itensDe(c.id).forEach(l => P.Store.remove('compra_itens', l.id));
        P.Store.remove('compras', c.id);
        location.hash = '#/compras';
      } }, P.UI.icone('lixo')));
      corpo.appendChild(acoes);
    }
    view.append(voltar('#/compras', 'Compras'), corpo);
    desenhar();
    return { onDados: desenhar };
  }

  // ---------------------------------------------------------------
  //  TELA: A PAGAR (compras a prazo)
  // ---------------------------------------------------------------
  function pagarSheet(compras, nome) {
    const tot = compras.reduce((s, c) => s + (+c.total || 0), 0);
    const sh = P.UI.sheet(h('div', { class: 'np-sheet' },
      h('div', { class: 'rs-itens' }, compras.map(c => h('div', { class: 'rs-l' },
        h('span', { class: 'rs-h' }, P.Dia.rotuloCurto(c.dia_operacional)), h('span', { class: 'rs-n' }, resumoItens(c)), h('span', { class: 'rs-v' }, P.brl(c.total))))),
      h('div', { class: 'secao' }, 'Paguei ' + P.brl(tot) + ' em:'),
      h('div', { class: 'pg-formas' }, FORMAS.filter(f => f.v !== 'PRAZO').map(f => h('button', { type: 'button', class: 'pg-forma f-' + f.v.toLowerCase(), onClick: () => {
        const antes = compras.map(c => Object.assign({}, c));
        pagar(compras, f.v);
        P.vibrar([20, 40, 20]);
        sh.fechar();
        P.UI.toast(nome + ': ' + P.brl(tot) + ' pago (' + f.rotulo + ')', { acao: { rotulo: 'Desfazer', fn: () => antes.forEach(c => P.Store.put('compras', c)) } });
      } }, P.UI.icone(P.Mesas.ICONE_FORMA[f.v]), f.rotulo)))),
    { titulo: 'Pagar ' + nome });
  }
  function telaPagar(view) {
    view.className = 'v-compras';
    const corpo = h('div');
    function desenhar() {
      corpo.innerHTML = '';
      const grupos = new Map();
      aPagar().forEach(c => {
        const nome = c.fornecedor || 'Sem fornecedor';
        const k = P.UI.semAcento(nome);
        if (!grupos.has(k)) grupos.set(k, { nome, total: 0, compras: [] });
        const g = grupos.get(k);
        g.total += +c.total || 0;
        g.compras.push(c);
      });
      const lista = [...grupos.values()].sort((a, b) => b.total - a.total);
      const tot = lista.reduce((s, g) => s + g.total, 0);
      corpo.appendChild(h('div', { class: 'fx-resumo' }, h('div', { class: 'fx-tot' }, h('small', null, lista.length + (lista.length === 1 ? ' fornecedor' : ' fornecedores') + ' a pagar'), h('b', { class: tot ? 't-amarelo' : null }, P.brl(tot)))));
      if (!lista.length) { corpo.appendChild(P.UI.vazio('Nada a pagar. Compras lançadas como "A prazo" aparecem aqui.', 'check')); return; }
      corpo.appendChild(h('div', { class: 'ms-lista' }, lista.map(g => {
        const desde = g.compras.map(c => c.dia_operacional).sort()[0];
        return h('button', { type: 'button', class: 'ms-card', onClick: () => pagarSheet(g.compras, g.nome) },
          h('div', { class: 'ms-card-n' }, g.nome, h('small', null, g.compras.length + (g.compras.length === 1 ? ' compra' : ' compras') + ' · desde ' + P.Dia.rotuloCurto(desde))),
          h('b', { class: 't-amarelo' }, P.brl(g.total)));
      })));
    }
    view.append(subnavCompras('pagar'), corpo);
    desenhar();
    return { onDados(t) { if (t.has('compras')) desenhar(); } };
  }

  // ---------------------------------------------------------------
  //  TELA: CUSTOS (dono) — comprado × consumido pela ficha, por insumo
  // ---------------------------------------------------------------
  function custos(dias) {
    const set = new Set(dias);
    const I = P.Calc.idx();
    const linhas = new Map();
    const pegar = id => {
      if (!linhas.has(id)) { const ins = I.insumos.get(id); linhas.set(id, { ins, qC: 0, vC: 0, qU: 0, vU: 0 }); }
      return linhas.get(id);
    };
    let comprado = 0, avulso = 0;
    P.Store.all('compras').forEach(c => {
      if (!set.has(c.dia_operacional)) return;
      itensDe(c.id).forEach(l => {
        comprado += +l.valor || 0;
        if (!l.insumo_id || !I.insumos.has(l.insumo_id)) { avulso += +l.valor || 0; return; }
        const g = pegar(l.insumo_id);
        g.qC += +l.quantidade || 0; g.vC += +l.valor || 0;
      });
    });
    let cmv = 0, fat = 0;
    const vendido = new Map();
    P.Store.all('comandas').forEach(c => {
      if (c.status !== 'FECHADA' || !set.has(c.dia_operacional)) return;
      fat += +c.total || 0;
      P.Mesas.linhas(c.id).forEach(l => {
        const q = +l.quantidade || 0;
        cmv += q * (+l.cmv_unit || 0);
        vendido.set(l.item_id, (vendido.get(l.item_id) || 0) + q);
      });
    });
    const acc = new Map();
    vendido.forEach((q, itemId) => P.Calc.consumo(itemId, q, acc));
    acc.forEach((q, insId) => {
      const g = pegar(insId);
      g.qU += q;
      g.vU += q * (g.ins ? +g.ins.preco : 0);
    });
    const lista = [...linhas.values()].filter(g => g.ins && (g.qC > 0.0001 || g.qU > 0.0001));
    return { lista, comprado, avulso, cmv, fat };
  }
  function variacoes(dias) {
    const ini = dias[dias.length - 1];
    const porIns = new Map();
    P.Store.all('historico_precos').forEach(hp => { if (!porIns.has(hp.insumo_id)) porIns.set(hp.insumo_id, []); porIns.get(hp.insumo_id).push(hp); });
    const out = [];
    porIns.forEach((hs, insId) => {
      hs.sort((a, b) => (a.data < b.data ? -1 : 1));
      const ultimo = hs[hs.length - 1];
      if (P.Dia.diaOperacional(ultimo.data) < ini) return;
      const anterior = hs.filter(x => P.Dia.diaOperacional(x.data) < ini).pop() || (hs.length > 1 ? hs[0] : null);
      if (!anterior || anterior === ultimo || !(+anterior.preco > 0)) return;
      const ins = P.Store.get('insumos', insId);
      if (!ins) return;
      const dif = (+ultimo.preco / +anterior.preco - 1) * 100;
      if (Math.abs(dif) < 0.5) return;
      out.push({ ins, de: +anterior.preco, para: +ultimo.preco, dif });
    });
    return out.sort((a, b) => Math.abs(b.dif) - Math.abs(a.dif));
  }
  function telaCustos(view) {
    view.className = 'v-compras';
    let periodo = 'semana';
    const corpo = h('div');
    function diasDo(p) {
      const hoje = P.Dia.hoje();
      if (p === 'hoje') return [hoje];
      if (p === 'semana') return P.Dia.ultimos(6, hoje);
      return P.Dia.doMes(P.Dia.mes(hoje), hoje).reverse();
    }
    function desenhar() {
      corpo.innerHTML = '';
      const dias = diasDo(periodo);
      const r = custos(dias);
      const fcReal = r.fat > 0 ? r.comprado / r.fat * 100 : null;
      const fcFicha = r.fat > 0 ? r.cmv / r.fat * 100 : null;
      corpo.appendChild(h('div', { class: 'kpis3' },
        kpi('Comprado', P.brl0(r.comprado), fcReal == null ? 'sem vendas no período' : P.pct(fcReal, 0) + ' das vendas'),
        kpi('Custo do vendido', P.brl0(r.cmv), fcFicha == null ? 'pela ficha técnica' : P.pct(fcFicha, 0) + ' das vendas (ficha)'),
        kpi('Diferença', P.brl0(r.comprado - r.cmv), r.comprado - r.cmv > 0 ? 'estoque que sobrou ou perda' : 'usou estoque antigo', r.comprado - r.cmv > 0 ? 'amarelo' : 'verde')));
      corpo.appendChild(h('div', { class: 'dica' }, 'Comprado × usado pelas vendas, calculado pela ficha técnica (peso bruto, com fator de correção e perda). Sobra grande que se repete = desperdício, porção maior que a ficha ou venda sem comanda.'));
      if (!r.lista.length) { corpo.appendChild(P.UI.vazio('Sem compras nem vendas neste período.', 'compras')); return; }
      const lista = r.lista.slice().sort((a, b) => Math.max(b.vC, b.vU) - Math.max(a.vC, a.vU));
      corpo.appendChild(h('div', { class: 'secao' }, 'Por insumo'));
      corpo.appendChild(h('div', { class: 'ct-lista' }, lista.map(g => {
        const un = UN[g.ins.unidade] || g.ins.unidade;
        const max = Math.max(g.qC, g.qU, 0.0001);
        const sobra = g.qC - g.qU;
        const pctSobra = g.qC > 0 ? sobra / g.qC * 100 : null;
        const cor = g.qC <= 0 ? 'cinza' : pctSobra > 15 ? 'amarelo' : pctSobra < -5 ? 'azul' : 'verde';
        return h('div', { class: 'ct-l' },
          h('div', { class: 'ct-l-top' }, h('b', null, g.ins.nome), h('span', { class: 'ct-l-preco' }, P.Fichas.precoUnit(g.ins))),
          h('div', { class: 'ct-bar' },
            h('span', { class: 'ct-bar-c', style: { width: (g.qC / max * 100) + '%' } }),
            h('span', { class: 'ct-bar-u', style: { width: (g.qU / max * 100) + '%' } })),
          h('div', { class: 'ct-l-nums' },
            h('span', null, h('i', { class: 'lg-c2' }), 'comprado ', h('b', null, P.numAuto(g.qC, 2) + ' ' + un), ' · ' + P.brl0(g.vC)),
            h('span', null, h('i', { class: 'lg-u2' }), 'usado ', h('b', null, P.numAuto(g.qU, 2) + ' ' + un)),
            h('span', { class: 't-' + cor }, g.qC <= 0 ? 'sem compra lançada' : (sobra >= 0 ? 'sobrou ' : 'faltou ') + P.numAuto(Math.abs(sobra), 2) + ' ' + un + (pctSobra != null ? ' (' + P.num(Math.abs(pctSobra), 0) + '%)' : ''))));
      })));
      if (r.avulso) corpo.appendChild(h('div', { class: 'dica' }, 'Itens sem ficha comprados no período: ' + P.brl(r.avulso) + ' (entram no gasto, sem comparação de consumo).'));
      const vs = variacoes(dias);
      if (vs.length) {
        corpo.appendChild(h('div', { class: 'secao' }, 'Preços que mudaram no período'));
        corpo.appendChild(h('div', { class: 'rs-itens' }, vs.map(x => h('div', { class: 'rs-l cp' },
          h('span', { class: 'rs-n' }, x.ins.nome, h('small', null, P.Fichas.precoFmt(x.de) + ' → ' + P.Fichas.precoFmt(x.para) + '/' + (UN[x.ins.unidade] || x.ins.unidade))),
          h('span', { class: 'rs-v ' + (x.dif > 0 ? 't-vermelho' : 't-verde') }, (x.dif > 0 ? '+' : '') + P.num(x.dif, 1) + '%')))));
      }
    }
    function kpi(rot, val, sub, cor) {
      return h('div', { class: 'kpi' }, h('div', { class: 'kpi-rot' }, rot), h('div', { class: 'kpi-val' + (cor ? ' t-' + cor : '') }, val), sub ? h('div', { class: 'kpi-sub' }, sub) : null);
    }
    view.append(subnavCompras('custos'),
      P.UI.seg([{ v: 'hoje', rotulo: 'Hoje' }, { v: 'semana', rotulo: 'Semana' }, { v: 'mes', rotulo: 'Mês' }], periodo, v => { periodo = v; desenhar(); }, 'seg-p'),
      corpo);
    desenhar();
    return { onDados(t) { if (t.has('compras') || t.has('compra_itens') || t.has('comandas') || t.has('insumos')) desenhar(); } };
  }

  P.UI.rota('compras', { titulo: 'Compras', tab: 'compras', render: telaCompras });
  P.UI.rota('compras/nova', { titulo: 'Lançar compra', tab: 'compras', render: telaNova });
  P.UI.rota('compras/editar/:id', { titulo: 'Editar compra', tab: 'compras', render: telaNova });
  P.UI.rota('compras/c/:id', { titulo: 'Compra', tab: 'compras', render: telaDetalhe });
  P.UI.rota('compras/pagar', { titulo: 'A pagar', tab: 'compras', render: telaPagar });
  P.UI.rota('compras/custos', { titulo: 'Custos', tab: 'compras', dono: true, render: telaCustos });

  P.Compras = { itensDe, aPagar, doDia, salvar, pagar, custos, variacoes, NOME_FORMA, cardResultado };
})();
