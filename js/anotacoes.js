/* PENDÊNCIAS E ANOTAÇÕES (dono) — o que falta confirmar, lembretes e tudo que
   não tem outro lugar no app. Pendência fica aberta até marcar "Resolvido"
   (com uma frase de como resolveu); nota é só para guardar a informação.
   Pode apontar para um registro (ref 'compras:<id>', 'comandas:<id>',
   'despesas:<id>', 'pessoas:<id>') — aí ganha o atalho "Ver". */
(function () {
  'use strict';
  const P = window.P;
  const h = P.UI.h;
  const TIPOS = [{ v: 'PENDENCIA', rotulo: 'Pendência' }, { v: 'NOTA', rotulo: 'Anotação' }];

  const abertas = () => P.Store.all('anotacoes').filter(a => a.tipo === 'PENDENCIA' && !a.resolvido);
  function linkDe(ref) {
    const [t, id] = String(ref || '').split(':');
    if (!id) return null;
    if (t === 'compras') return '#/compras/c/' + id;
    if (t === 'comandas') return '#/mesas/c/' + id;
    if (t === 'pessoas') return '#/equipe/' + id;
    if (t === 'itens') return '#/fichas/editar/' + id;
    if (t === 'despesas') return '#/mesas/despesas';
    if (t === 'botijoes') return '#/gas';
    if (t === 'cardapio') return '#/cardapio';
    return null;
  }

  function editar(a0) {
    return new Promise(resolve => {
      const a = Object.assign({ id: P.uuid(), dia: P.Dia.hoje(), tipo: 'PENDENCIA', texto: '', resolvido: false, resolvido_em: null, resolucao: null, ref: null, criado_em: P.agoraISO(), usuario_id: (P.Auth.usuario() || {}).id || null }, a0 || {});
      let feito = false;
      const ta = h('textarea', { class: 'campo nt-ta', rows: 4, placeholder: 'O que falta confirmar ou o que quer guardar' });
      ta.value = a.texto || '';
      const bDia = h('button', { type: 'button', class: 'btn bloco cp-dia-f' });
      const mostrarDia = () => bDia.replaceChildren(P.UI.icone('calendario'), h('span', null, a.dia ? 'Dia ' + P.Dia.rotulo(a.dia) : 'Sem dia'), h('small', null, 'trocar ▾'));
      bDia.addEventListener('click', () => P.Compras.calendario(a.dia || P.Dia.hoje(), iso => { a.dia = iso; mostrarDia(); }, { titulo: 'A que dia se refere' }));
      mostrarDia();
      const sh = P.UI.sheet(h('div', { class: 'np-sheet' },
        P.UI.seg(TIPOS, a.tipo, v => { a.tipo = v; }, 'seg-p'),
        ta, bDia,
        h('div', { class: 'row gap' },
          a0 ? h('button', { type: 'button', class: 'btn perigo', 'aria-label': 'Excluir', onClick: () => {
            P.Store.remove('anotacoes', a.id);
            feito = true; resolve(null); sh.fechar();
            P.UI.toast('Anotação excluída', { acao: { rotulo: 'Desfazer', fn: () => P.Store.put('anotacoes', Object.assign({}, a0, { excluido: false })) } });
          } }, P.UI.icone('lixo')) : null,
          h('button', { type: 'button', class: 'btn', onClick: () => sh.fechar() }, 'Cancelar'),
          h('button', { type: 'button', class: 'btn primario grow', onClick: () => {
            a.texto = ta.value.trim();
            if (!a.texto) { P.UI.toast('Escreva o texto.', { tipo: 'perigo' }); ta.focus(); return; }
            const r = P.Store.put('anotacoes', a);
            feito = true; resolve(r); sh.fechar();
          } }, 'Salvar'))),
      { titulo: a0 ? 'Editar' : 'Nova anotação', onFechar: () => { if (!feito) resolve(null); } });
      if (!a0) setTimeout(() => ta.focus(), 80);
    });
  }
  async function resolver(a) {
    const txt = await new Promise(resolve => {
      let feito = false;
      const inp = h('input', { class: 'campo', type: 'text', placeholder: 'Como resolveu? (opcional)', autocomplete: 'off' });
      const ok = () => { feito = true; resolve(inp.value.trim()); sh.fechar(); };
      inp.addEventListener('keydown', e => { if (e.key === 'Enter') ok(); });
      const sh = P.UI.sheet(h('div', { class: 'np-sheet' }, h('p', { class: 'nt-txt' }, a.texto), inp,
        h('div', { class: 'row gap' }, h('button', { type: 'button', class: 'btn', onClick: () => sh.fechar() }, 'Cancelar'), h('button', { type: 'button', class: 'btn primario grow', onClick: ok }, P.UI.icone('check'), 'Resolvido'))),
      { titulo: 'Marcar como resolvido', onFechar: () => { if (!feito) resolve(null); } });
      setTimeout(() => inp.focus(), 80);
    });
    if (txt == null) return;
    const antes = Object.assign({}, a);
    P.Store.put('anotacoes', Object.assign({}, a, { resolvido: true, resolvido_em: P.agoraISO(), resolucao: txt || null }));
    P.UI.toast('Resolvido', { acao: { rotulo: 'Desfazer', fn: () => P.Store.put('anotacoes', antes) } });
  }

  function telaAnotacoes(view) {
    view.className = 'v-mesas v-anotacoes';
    let verResolvidas = false;
    const corpo = h('div');
    function cartao(a) {
      const link = linkDe(a.ref);
      return h('div', { class: 'nt-card' + (a.resolvido ? ' resolvida' : '') + (a.tipo === 'NOTA' ? ' nota' : '') },
        h('button', { type: 'button', class: 'nt-corpo', onClick: () => editar(a).then(desenhar) },
          h('span', { class: 'nt-tag' }, a.resolvido ? 'resolvida' : a.tipo === 'NOTA' ? 'anotação' : 'pendência', a.dia ? ' · ' + P.Dia.rotulo(a.dia) : ''),
          h('span', { class: 'nt-txt' }, a.texto),
          a.resolvido && a.resolucao ? h('small', { class: 'nt-res' }, '✓ ' + a.resolucao) : null),
        h('div', { class: 'nt-acoes' },
          link ? h('a', { class: 'btn mini', href: link }, 'Ver') : null,
          a.tipo === 'PENDENCIA' && !a.resolvido ? h('button', { type: 'button', class: 'btn mini primario', onClick: () => resolver(a) }, P.UI.icone('check'), 'Resolvido') : null));
    }
    function desenhar() {
      corpo.innerHTML = '';
      const todas = P.Store.all('anotacoes').sort((a, b) => ((b.dia || '') < (a.dia || '') ? -1 : (b.dia || '') > (a.dia || '') ? 1 : a.criado_em < b.criado_em ? 1 : -1));
      const pend = todas.filter(a => a.tipo === 'PENDENCIA' && !a.resolvido);
      const notas = todas.filter(a => a.tipo === 'NOTA' && !a.resolvido);
      const resolv = todas.filter(a => a.resolvido);
      corpo.appendChild(h('div', { class: 'fx-resumo' }, h('div', { class: 'fx-tot' },
        h('small', null, pend.length ? 'Pendências para confirmar' : 'Nenhuma pendência aberta'), h('b', { class: pend.length ? 't-amarelo' : 't-verde' }, String(pend.length)))));
      corpo.appendChild(h('button', { type: 'button', class: 'btn primario bloco', onClick: () => editar().then(desenhar) }, P.UI.icone('mais'), 'Anotação'));
      if (!todas.length) { corpo.appendChild(P.UI.vazio('Aqui ficam o que falta confirmar (ex.: "o Pix do sábado") e lembretes que não têm outro lugar no app.', 'fiado')); return; }
      if (pend.length) { corpo.appendChild(h('div', { class: 'secao' }, 'Pendências · ' + pend.length)); corpo.appendChild(h('div', { class: 'nt-lista' }, pend.map(cartao))); }
      if (notas.length) { corpo.appendChild(h('div', { class: 'secao' }, 'Anotações · ' + notas.length)); corpo.appendChild(h('div', { class: 'nt-lista' }, notas.map(cartao))); }
      if (resolv.length) {
        if (!verResolvidas) corpo.appendChild(h('button', { type: 'button', class: 'cp-galeria', onClick: () => { verResolvidas = true; desenhar(); } }, 'Mostrar ' + resolv.length + (resolv.length === 1 ? ' resolvida' : ' resolvidas')));
        else { corpo.appendChild(h('div', { class: 'secao' }, 'Resolvidas · ' + resolv.length)); corpo.appendChild(h('div', { class: 'nt-lista' }, resolv.map(cartao))); }
      }
    }
    view.append(corpo);
    desenhar();
    return { onDados(t) { if (t.has('anotacoes')) desenhar(); } };
  }

  P.UI.rota('anotacoes', { titulo: 'Pendências', tab: 'mais', dono: true, render: telaAnotacoes });
  P.Anotacoes = { abertas, editar, linkDe };
})();
