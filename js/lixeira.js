/* LIXEIRA (só o dono) — nada que é excluído some de verdade: o registro fica guardado com
   excluido = true (no aparelho e na nuvem) e aparece aqui por 90 dias para restaurar: vendas,
   compras, despesas e lotes de carne. Restaurar uma venda traz de volta os itens e os pagamentos
   excluídos junto com ela (no mesmo toque); uma compra traz os itens e o lote de carne apagados com
   ela. Item tirado de comanda e pagamento desfeito ao reabrir uma conta não voltam (foram antes). */
(function () {
  'use strict';
  const P = window.P;
  const h = P.UI.h;
  const DIAS = 90;
  const JANELA = 2000; // ms: excluído no mesmo toque que a venda/compra (acontece no mesmo instante)
  const quando = r => Date.parse(r.modificado_em) || 0;
  const junto = (a, b) => Math.abs(quando(a) - quando(b)) <= JANELA;
  const excluidos = t => P.Store.todos(t).filter(r => r.excluido);
  const volta = (t, r) => P.Store.put(t, Object.assign({}, r, { excluido: false }));
  const TIPOS = [{ v: 'todos', rotulo: 'Tudo' }, { v: 'venda', rotulo: 'Vendas' }, { v: 'compra', rotulo: 'Compras' }, { v: 'despesa', rotulo: 'Despesas' }, { v: 'lote', rotulo: 'Lotes' }];

  // o que está na lixeira, do mais recente para o mais antigo
  function lista() {
    const desde = Date.now() - DIAS * 86400000;
    const rec = r => quando(r) >= desde;
    const out = [];
    // vendas: só conta fechada ou cancelada (comanda vazia do balcão é limpa sozinha, não é venda)
    excluidos('comandas').filter(c => rec(c) && c.status !== 'ABERTA').forEach(c => {
      const itens = excluidos('comanda_itens').filter(l => l.comanda_id === c.id && +l.quantidade > 0 && junto(l, c));
      const pags = excluidos('pagamentos').filter(p => p.comanda_id === c.id && junto(p, c));
      out.push({ tipo: 'venda', em: quando(c), titulo: 'Venda · ' + P.Mesas.rotulo(c), valor: c.status === 'CANCELADA' ? null : +c.total || 0,
        sub: P.Dia.rotulo(c.dia_operacional) + ' · ' + (c.status === 'CANCELADA' ? 'cancelada' : pags.map(p => P.Mesas.NOME_FORMA[p.forma]).join(' + ') || 'sem pagamento'),
        restaurar: () => { volta('comandas', c); itens.forEach(l => volta('comanda_itens', l)); pags.forEach(p => volta('pagamentos', p)); } });
    });
    const lotesDeCompra = new Set();
    excluidos('compras').filter(rec).forEach(c => {
      const itens = excluidos('compra_itens').filter(l => l.compra_id === c.id && junto(l, c));
      const lotes = excluidos('lotes').filter(l => l.compra_id === c.id && junto(l, c));
      lotes.forEach(l => lotesDeCompra.add(l.id));
      out.push({ tipo: 'compra', em: quando(c), titulo: 'Compra · ' + (c.fornecedor || 'sem fornecedor'), valor: +c.total || 0,
        sub: P.Dia.rotulo(c.dia_operacional) + ' · ' + (itens.length === 1 ? '1 item' : itens.length + ' itens') + (lotes.length ? ' · com o lote de carne' : ''),
        restaurar: () => { volta('compras', c); itens.forEach(l => volta('compra_itens', l)); lotes.forEach(l => volta('lotes', l)); } });
    });
    excluidos('despesas').filter(rec).forEach(d => out.push({ tipo: 'despesa', em: quando(d), titulo: 'Despesa · ' + (d.descricao || P.Mesas.NOME_DESP[d.categoria] || 'despesa'), valor: +d.valor || 0,
      sub: P.Dia.rotulo(d.dia_operacional) + ' · ' + P.Mesas.subDesp(d), restaurar: () => volta('despesas', d) }));
    excluidos('lotes').filter(l => rec(l) && !lotesDeCompra.has(l.id)).forEach(l => out.push({ tipo: 'lote', em: quando(l),
      titulo: 'Lote · ' + (P.Rendimento ? P.Rendimento.nomeCarne(l.carne) : l.carne), valor: +l.valor || 0,
      sub: P.Dia.rotulo(l.dia) + (l.fornecedor ? ' · ' + l.fornecedor : '') + ' · ' + P.numAuto(+l.kg, 3) + ' kg', restaurar: () => volta('lotes', l) }));
    return out.sort((a, b) => b.em - a.em);
  }

  function telaLixeira(view) {
    view.className = 'v-mesas';
    let tipo = 'todos';
    const corpo = h('div');
    function desenhar() {
      const todos = lista();
      const itens = tipo === 'todos' ? todos : todos.filter(x => x.tipo === tipo);
      corpo.innerHTML = '';
      corpo.appendChild(h('div', { class: 'an-base' }, 'Nada que é excluído some de verdade: fica aqui por ' + DIAS + ' dias. Toque em Restaurar para trazer de volta (venda e compra voltam com os itens e os pagamentos).'));
      corpo.appendChild(P.UI.seg(TIPOS.map(t => ({ v: t.v, rotulo: t.rotulo })), tipo, v => { tipo = v; desenhar(); }, 'seg-p'));
      if (!itens.length) { corpo.appendChild(P.UI.vazio(todos.length ? 'Nada deste tipo na lixeira.' : 'A lixeira está vazia.', 'lixo')); return; }
      const hora = ms => { const iso = new Date(ms).toISOString(); return P.Dia.rotuloCurto(P.Dia.diaOperacional(iso)) + ' ' + P.Dia.hora(iso); };
      corpo.appendChild(h('div', { class: 'ms-lista' }, itens.map(x => h('div', { class: 'ms-card lx-card' },
        h('div', { class: 'ms-card-n' }, x.titulo, h('small', null, x.sub), h('small', { class: 'lx-quando' }, 'na lixeira desde ' + hora(x.em))),
        h('div', { class: 'lx-dir' },
          x.valor != null ? h('b', null, P.brl(x.valor)) : null,
          h('button', { type: 'button', class: 'btn mini primario', onClick: () => {
            x.restaurar();
            P.vibrar(15);
            P.UI.toast('Restaurado: ' + x.titulo);
          } }, P.UI.icone('refresh'), 'Restaurar'))))));
    }
    view.append(corpo);
    desenhar();
    return { onDados: desenhar };
  }

  P.UI.rota('lixeira', { titulo: 'Lixeira', tab: 'mais', dono: true, render: telaLixeira });
  P.Lixeira = { lista };
})();
