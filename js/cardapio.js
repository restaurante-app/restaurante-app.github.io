/* CARDÁPIO DO DIA — cada dia da semana tem os seus pratos (segunda: virado à
   paulista; sexta: peixe; sábado: feijoada…). Na comanda, os pratos do dia vêm
   primeiro e o resto fica em "Outros pratos". Dia sem cardápio montado = todos
   os pratos, como antes. Daqui também sai o texto do cardápio de hoje para
   mandar no WhatsApp. O dono monta; todos veem e mandam. */
(function () {
  'use strict';
  const P = window.P;
  const h = P.UI.h;
  const DIAS = [1, 2, 3, 4, 5, 6]; // segunda a sábado (domingo conta como segunda)
  const NOME = { 1: 'segunda', 2: 'terça', 3: 'quarta', 4: 'quinta', 5: 'sexta', 6: 'sábado' };
  const LONGO = { 1: 'segunda-feira', 2: 'terça-feira', 3: 'quarta-feira', 4: 'quinta-feira', 5: 'sexta-feira', 6: 'sábado' };
  const CURTO = { 1: 'Seg', 2: 'Ter', 3: 'Qua', 4: 'Qui', 5: 'Sex', 6: 'Sáb' };

  // pratos que podem entrar no cardápio: os que estão à venda (ativos, com preço) na categoria Prato
  const pratos = () => P.Store.all('itens').filter(it => it.categoria === 'PRATO' && P.Calc.vendavel(it)).sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
  const diaSemana = dia => { const s = P.Dia.semana(dia); return s === 0 ? 1 : s; };
  function lista(sem) {
    const l = (P.cfg('cardapio_semana').dias || {})[sem];
    return Array.isArray(l) ? l : [];
  }
  // os pratos de um dia da semana na ordem montada (só os que continuam à venda)
  const itensDe = sem => lista(sem).map(id => P.Store.get('itens', id)).filter(it => it && it.categoria === 'PRATO' && P.Calc.vendavel(it));
  function doDia(dia) {
    const sem = diaSemana(dia || P.Dia.hoje());
    const itens = itensDe(sem);
    return { sem, nome: NOME[sem], definido: itens.length > 0, itens, ids: new Set(itens.map(i => i.id)) };
  }
  function salvar(sem, ids) {
    const c = P.cfg('cardapio_semana');
    const dias = Object.assign({}, c.dias);
    if (ids.length) dias[sem] = ids; else delete dias[sem];
    P.salvarCfg('cardapio_semana', Object.assign({}, c, { dias }));
  }
  // texto para o WhatsApp (negrito com *)
  function texto(dia) {
    const c = doDia(dia);
    const its = c.definido ? c.itens : pratos();
    return '*Cardápio de ' + LONGO[c.sem] + ', ' + P.Dia.rotuloCurto(dia) + '*\nRestaurante Maria Simone\n\n' +
      its.map(it => '• ' + it.nome + ' — ' + P.brl(it.preco_venda)).join('\n');
  }
  async function copiar(dia) {
    const t = texto(dia);
    try { await navigator.clipboard.writeText(t); P.UI.toast('Cardápio copiado — cole no WhatsApp'); } catch (e) {
      P.UI.sheet(h('div', { class: 'np-sheet' }, h('textarea', { class: 'campo cd-txt', rows: 10, readonly: true }, t)), { titulo: 'Copie o cardápio' });
    }
  }

  // ---------------------------------------------------------------
  //  TELA
  // ---------------------------------------------------------------
  function telaCardapio(view) {
    view.className = 'v-mesas v-cardapio';
    const dono = P.Auth.isDono();
    let sem = diaSemana(P.Dia.hoje());
    const corpo = h('div');
    function mover(ids, i, d) {
      const j = i + d;
      if (j < 0 || j >= ids.length) return;
      [ids[i], ids[j]] = [ids[j], ids[i]];
      salvar(sem, ids);
    }
    function desenhar() {
      corpo.innerHTML = '';
      const hoje = P.Dia.hoje();
      const cHoje = doDia(hoje);
      corpo.appendChild(h('section', { class: 'eq-card cd-hoje' },
        h('div', { class: 'eq-top' },
          h('span', { class: 'avatar dono' }, P.UI.icone('fichas')),
          h('div', { class: 'eq-nome' }, h('b', null, 'Hoje, ' + P.Dia.rotulo(hoje)),
            h('small', null, cHoje.definido ? cHoje.itens.length + (cHoje.itens.length === 1 ? ' prato' : ' pratos') + ' no cardápio de ' + cHoje.nome
              : 'Sem cardápio de ' + cHoje.nome + ': na comanda aparecem todos os pratos'))),
        cHoje.definido ? h('div', { class: 'cd-hoje-l' }, cHoje.itens.map(it => h('span', { class: 'cd-chip' }, it.nome))) : null,
        h('div', { class: 'row gap eq-acoes' },
          h('button', { type: 'button', class: 'btn grow', onClick: () => copiar(hoje) }, 'Copiar'),
          h('a', { class: 'btn primario grow', href: 'https://wa.me/?text=' + encodeURIComponent(texto(hoje)), target: '_blank', rel: 'noopener' }, 'Mandar no WhatsApp'))));

      corpo.appendChild(h('div', { class: 'secao' }, 'Cardápio de cada dia'));
      corpo.appendChild(P.UI.seg(DIAS.map(d => { const n = itensDe(d).length; return { v: d, rotulo: [CURTO[d], h('small', null, n ? String(n) : '—')] }; }), sem,
        v => { sem = v; desenhar(); }, 'seg-p cd-dias'));
      const ids = itensDe(sem).map(it => it.id);
      const fora = pratos().filter(it => !ids.includes(it.id));
      corpo.appendChild(h('div', { class: 'an-base' }, ids.length
        ? 'Na comanda de ' + NOME[sem] + ', estes pratos aparecem primeiro, nesta ordem; os outros ficam em "Outros pratos".'
        : 'Sem cardápio de ' + NOME[sem] + ': na comanda aparecem todos os pratos. ' + (dono ? 'Toque nos pratos de ' + NOME[sem] + ' para montar.' : '')));
      if (ids.length) {
        corpo.appendChild(h('div', { class: 'ms-lista' }, ids.map((id, i) => {
          const it = P.Store.get('itens', id);
          return h('div', { class: 'ms-card cd-lin no' },
            h('div', { class: 'ms-card-n' }, it.nome, h('small', null, P.brl(it.preco_venda))),
            dono ? [
              h('button', { type: 'button', class: 'lc-b', 'aria-label': 'Subir ' + it.nome, disabled: i === 0, onClick: () => { mover(ids.slice(), i, -1); desenhar(); } }, P.UI.icone('voltar', 'cd-sobe')),
              h('button', { type: 'button', class: 'lc-b', 'aria-label': 'Tirar ' + it.nome + ' do cardápio de ' + NOME[sem], onClick: () => { salvar(sem, ids.filter(x => x !== id)); desenhar(); } }, P.UI.icone('x')),
            ] : null);
        })));
      }
      if (dono && fora.length) {
        corpo.appendChild(h('div', { class: 'secao' }, ids.length ? 'Fora do cardápio de ' + NOME[sem] : 'Pratos à venda'));
        corpo.appendChild(h('div', { class: 'ms-lista' }, fora.map(it => h('button', { type: 'button', class: 'ms-card cd-lin', onClick: () => { salvar(sem, ids.concat(it.id)); P.vibrar(10); desenhar(); } },
          h('div', { class: 'ms-card-n' }, it.nome, h('small', null, P.brl(it.preco_venda))),
          h('span', { class: 'lc-b mais' }, P.UI.icone('mais'))))));
      }
      if (dono && ids.length) {
        const outros = DIAS.filter(d => d !== sem && itensDe(d).length);
        corpo.appendChild(h('div', { class: 'row gap cd-rodape' },
          h('button', { type: 'button', class: 'btn grow', onClick: async () => {
            if (!(await P.UI.confirmar('Apagar o cardápio de ' + NOME[sem] + '? Na comanda voltam a aparecer todos os pratos nesse dia.', { ok: 'Apagar', perigo: true }))) return;
            salvar(sem, []); desenhar();
          } }, 'Apagar o de ' + NOME[sem]),
          outros.length ? h('button', { type: 'button', class: 'btn grow', onClick: async () => {
            const d = await P.UI.escolher({ titulo: 'Copiar para ' + NOME[sem] + ' o cardápio de…', opcoes: outros.map(o => ({ v: o, rotulo: LONGO[o], sub: itensDe(o).map(it => it.nome).join(', ') })) });
            if (!d) return;
            salvar(sem, itensDe(d).map(it => it.id)); desenhar();
          } }, 'Copiar de outro dia') : null));
      }
      if (!dono) corpo.appendChild(h('div', { class: 'dica' }, 'Só o dono muda o cardápio.'));
    }
    view.append(corpo);
    desenhar();
    return { onDados(t) { if (t.has('config') || t.has('itens')) desenhar(); } };
  }

  P.UI.rota('cardapio', { titulo: 'Cardápio do dia', tab: 'mais', render: telaCardapio });
  P.Cardapio = { doDia, lista, salvar, texto, pratos, diaSemana, NOME, LONGO };
})();
