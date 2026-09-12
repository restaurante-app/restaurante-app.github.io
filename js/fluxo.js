/* ETAPA 1 — FLUXO: contador por faixa de hora (PASSOU / COMPROU) + análise do dono.
   Cada "bloco" de contagem (do 1º toque até Encerrar ou a virada da hora) vira
   uma linha em `contagens`. O bloco aberto fica também no localStorage a cada
   toque (gravação síncrona): se o app fechar, reabre retomando a mesma faixa. */
(function () {
  'use strict';
  const P = window.P;
  const h = P.UI.h;
  const LS = 'pari.fluxo.blocos.v1';
  const MODOS = ['PASSOU', 'COMPROU']; // COMPROU manual foi aposentado (vem das comandas); fica para fechar blocos antigos
  const COR = { PASSOU: 'var(--passou)', COMPROU: 'var(--comprou)' };

  // ---------------------------------------------------------------
  //  Estado dos blocos abertos neste aparelho
  // ---------------------------------------------------------------
  let blocos = ler();
  function ler() { try { return JSON.parse(localStorage.getItem(LS)) || {}; } catch (e) { return {}; } }
  function salvarLS() { try { localStorage.setItem(LS, JSON.stringify(blocos)); } catch (e) { /* ok */ } }

  function registro(b) {
    return {
      id: b.id, dia_operacional: b.dia, faixa_hora: b.faixa, modo: b.modo, quantidade: b.qtd,
      usuario_id: b.usuario_id, criado_em: b.criado_em, encerrado: !!b.encerrado,
    };
  }
  const timers = {};
  function persistir(b, agora) {
    const fn = () => {
      const rec = P.Store.get('contagens', b.id);
      if (b.qtd <= 0) { if (rec) P.Store.remove('contagens', b.id); return; }
      if (rec && rec.quantidade === b.qtd && !!rec.encerrado === !!b.encerrado) return;
      P.Store.put('contagens', registro(b), { silent: true });
    };
    clearTimeout(timers[b.id]);
    if (agora) fn(); else timers[b.id] = setTimeout(fn, 350);
  }
  function fecharBloco(modo) {
    const b = blocos[modo];
    if (!b) return null;
    b.encerrado = true;
    persistir(b, true);
    delete blocos[modo];
    salvarLS();
    return b;
  }
  // fecha sozinho o que ficou de outra faixa/dia
  function checarVirada() {
    const dia = P.Dia.hoje(), f = P.Dia.faixa();
    const fechados = [];
    MODOS.forEach(m => {
      const b = blocos[m];
      if (b && (b.dia !== dia || b.faixa !== f)) {
        const x = fecharBloco(m);
        if (x && x.qtd > 0) fechados.push(x);
      }
    });
    return fechados;
  }
  function somar(modo, d) {
    const u = P.Auth.usuario();
    if (!u) return null;
    checarVirada();
    let b = blocos[modo];
    if (!b) {
      if (d < 0) return null;
      b = blocos[modo] = { id: P.uuid(), dia: P.Dia.hoje(), faixa: P.Dia.faixa(), modo, qtd: 0, usuario_id: u.id, criado_em: P.agoraISO() };
    }
    if (d < 0 && b.qtd <= 0) return null;
    b.qtd += d;
    salvarLS();
    persistir(b);
    return b;
  }
  // No boot: garante que o banco tem a última quantidade e fecha faixas vencidas
  function reconciliar() {
    MODOS.forEach(m => { if (blocos[m]) persistir(blocos[m], true); });
    checarVirada();
  }
  setInterval(() => {
    const fechados = checarVirada();
    P.emit('fluxo-tick', fechados);
  }, 1000);
  window.addEventListener('pagehide', () => MODOS.forEach(m => { if (blocos[m]) persistir(blocos[m], true); }));

  // total da faixa atual e do dia (todos os aparelhos + bloco aberto ao vivo)
  function totais(modo) {
    const dia = P.Dia.hoje(), f = P.Dia.faixa();
    const aberto = blocos[modo];
    let faixa = 0, noDia = 0;
    P.Store.all('contagens').forEach(c => {
      if (c.modo !== modo || c.dia_operacional !== dia) return;
      if (aberto && c.id === aberto.id) return;
      noDia += +c.quantidade || 0;
      if (c.faixa_hora === f) faixa += +c.quantidade || 0;
    });
    if (aberto && aberto.dia === dia) { noDia += aberto.qtd; if (aberto.faixa === f) faixa += aberto.qtd; }
    return { faixa, dia: noDia };
  }

  // COMPROU é automático: cada comanda com item (não cancelada) = 1 compra,
  // na faixa de hora e no dia operacional em que a comanda foi aberta.
  function compras(diasSet) {
    const porChave = new Map();   // 'dia|faixa' → nº de compras
    const diasVenda = new Set();
    P.Store.all('comandas').forEach(c => {
      if (c.status === 'CANCELADA' || !c.aberta_em) return;
      const dia = P.Dia.diaOperacional(c.aberta_em);
      if (diasSet && !diasSet.has(dia)) return;
      if (!P.Mesas.linhas(c.id).some(l => +l.quantidade > 0)) return;
      const k = dia + '|' + P.Dia.faixa(c.aberta_em);
      porChave.set(k, (porChave.get(k) || 0) + 1);
      diasVenda.add(dia);
    });
    return { porChave, diasVenda };
  }
  function comprasHoje() {
    const dia = P.Dia.hoje(), f = P.Dia.faixa();
    const c = compras(new Set([dia]));
    let noDia = 0;
    c.porChave.forEach(n => { noDia += n; });
    return { faixa: c.porChave.get(dia + '|' + f) || 0, dia: noDia };
  }

  function subnavFluxo(ativo) {
    return P.Auth.isDono() ? P.UI.subnav([
      { id: 'contar', rota: 'fluxo', rotulo: 'Contar' },
      { id: 'analise', rota: 'fluxo/analise', rotulo: 'Análise' },
    ], ativo) : null;
  }

  // ---------------------------------------------------------------
  //  TELA: CONTAGEM
  // ---------------------------------------------------------------
  function telaContar(view) {
    view.className = 'v-contar';
    const modo = 'PASSOU'; // COMPROU vem sozinho das comandas

    const elHora = h('span', { class: 'ct-hora' });
    const elFaixa = h('span', { class: 'ct-faixa' });
    const elNum = h('div', { class: 'ct-num' });
    const elRot = h('div', { class: 'ct-rot' });
    const elTot = h('div', { class: 'ct-tot' });
    const elComp = h('div', { class: 'ct-comp' });
    const btnMais = h('button', { type: 'button', class: 'ct-mais', 'aria-label': 'Mais um' }, h('span', { class: 'ct-mais-t' }, '+1'));
    const btnMenos = h('button', { type: 'button', class: 'btn ct-menos', 'aria-label': 'Menos um' }, '−1');
    const btnEnc = h('button', { type: 'button', class: 'btn ct-enc' }, 'Encerrar faixa');

    btnMais.addEventListener('pointerdown', e => {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      e.preventDefault();
      tocar(+1);
    });
    btnMais.addEventListener('contextmenu', e => e.preventDefault());
    btnMenos.addEventListener('click', () => tocar(-1));
    btnEnc.addEventListener('click', encerrar);

    function tocar(d) {
      const b = somar(modo, d);
      if (d > 0) {
        P.vibrar(15);
        if (btnMais.animate) btnMais.animate([{ transform: 'scale(.975)' }, { transform: 'scale(1)' }], { duration: 110 });
      } else if (b) P.vibrar([10, 40, 10]);
      else P.vibrar(70);
      desenharNumeros();
    }
    function encerrar() {
      const fechados = MODOS.map(fecharBloco).filter(b => b && b.qtd > 0);
      if (!fechados.length) { P.UI.toast('Nada contado nesta faixa ainda.'); return; }
      P.vibrar([20, 40, 20]);
      desenhar();
      P.UI.toast('Faixa encerrada · ' + fechados.map(b => b.modo.toLowerCase() + ' ' + b.qtd).join(' · '), {
        acao: {
          rotulo: 'Desfazer', fn: () => {
            const dia = P.Dia.hoje(), f = P.Dia.faixa();
            fechados.forEach(b => {
              if (b.dia === dia && b.faixa === f && !blocos[b.modo]) {
                b.encerrado = false;
                blocos[b.modo] = b;
                persistir(b, true);
              }
            });
            salvarLS();
            desenhar();
          },
        },
      });
    }

    function desenharNumeros() {
      const b = blocos[modo];
      const t = totais(modo);
      elNum.textContent = b ? b.qtd : 0;
      elTot.replaceChildren(
        h('span', null, 'Faixa ', h('b', null, P.num(t.faixa))),
        h('span', null, 'Hoje ', h('b', null, P.num(t.dia))));
      desenharCompras(t);
    }
    function desenharCompras(t) {
      t = t || totais(modo);
      const c = comprasHoje();
      elComp.replaceChildren(
        h('span', { class: 'ct-comp-t' }, 'Compraram (pelas comandas)'),
        h('span', null, 'Faixa ', h('b', null, P.num(c.faixa)), t.faixa ? ' · ' + P.pct(c.faixa / t.faixa * 100, 0) : ''),
        h('span', null, 'Hoje ', h('b', null, P.num(c.dia)), t.dia ? ' · ' + P.pct(c.dia / t.dia * 100, 0) : ''));
    }
    function desenharRelogio() {
      elHora.textContent = P.Dia.hora();
      elFaixa.textContent = 'faixa ' + P.Dia.rotuloFaixa(P.Dia.faixa());
    }
    function desenhar() {
      view.style.setProperty('--modo', COR[modo]);
      elRot.textContent = 'passaram nesta contagem';
      desenharRelogio();
      desenharNumeros();
    }

    const offTick = P.on('fluxo-tick', fechados => {
      desenharRelogio();
      if (fechados && fechados.length) {
        desenharNumeros();
        P.vibrar([30, 60, 30]);
        P.UI.toast('Virou a hora — faixa ' + P.Dia.rotuloFaixa(fechados[0].faixa) + ' fechada (' +
          fechados.map(b => b.modo.toLowerCase() + ' ' + b.qtd).join(' · ') + ')');
      }
    });
    const onKey = e => {
      if (e.target && /INPUT|TEXTAREA/.test(e.target.tagName)) return;
      if (e.key === '+' || e.key === '=' || e.key === ' ' || e.key === 'ArrowUp') { e.preventDefault(); tocar(+1); }
      else if (e.key === '-' || e.key === 'ArrowDown') { e.preventDefault(); tocar(-1); }
    };
    document.addEventListener('keydown', onKey);

    // tela sempre acesa enquanto conta
    let trava = null;
    const pedirTrava = async () => {
      try { if ('wakeLock' in navigator && !document.hidden) trava = await navigator.wakeLock.request('screen'); } catch (e) { /* ok */ }
    };
    const onVis = () => { if (!document.hidden) { pedirTrava(); desenhar(); } };
    document.addEventListener('visibilitychange', onVis);
    pedirTrava();

    view.append(
      subnavFluxo('contar'),
      h('div', { class: 'ct-titulo' }, 'Quantas pessoas PASSARAM'),
      h('div', { class: 'ct-info' }, elHora, elFaixa),
      h('div', { class: 'ct-placar' }, elNum, elRot, elTot),
      elComp,
      btnMais,
      h('div', { class: 'ct-rodape' }, btnMenos, btnEnc));
    desenhar();

    return {
      cleanup() {
        offTick();
        document.removeEventListener('keydown', onKey);
        document.removeEventListener('visibilitychange', onVis);
        if (trava) trava.release().catch(() => {});
      },
      onDados(t) {
        if (t.has('contagens')) desenharNumeros();
        else if (t.has('comandas') || t.has('comanda_itens')) desenharCompras();
      },
    };
  }

  // ---------------------------------------------------------------
  //  ANÁLISE (só DONO)
  // ---------------------------------------------------------------
  // PASSOU: média dos dias em que aquela faixa foi contada (a contagem é esporádica).
  // COMPROU: média por dia com venda (faixa sem venda naquele dia conta como 0).
  // Conversão: compras ÷ passagens, só nos dias/faixas em que houve contagem de passagem.
  function calcular(periodo, semana) {
    const hoje = P.Dia.hoje();
    const dias = P.Dia.ultimos(periodo || Infinity, hoje, semana || null, periodo ? undefined : 800);
    const set = new Set(dias);
    const porDia = new Map();
    const pegar = (dia, faixa) => {
      const k = dia + '|' + faixa;
      let r = porDia.get(k);
      if (!r) porDia.set(k, r = { dia, faixa, PASSOU: 0, COMPROU: 0, temP: false });
      return r;
    };
    P.Store.all('contagens').forEach(c => {
      if (c.modo !== 'PASSOU' || !set.has(c.dia_operacional)) return;
      const r = pegar(c.dia_operacional, c.faixa_hora);
      r.PASSOU += +c.quantidade || 0;
      r.temP = true;
    });
    const cp = compras(set);
    cp.porChave.forEach((n, k) => { const [dia, f] = k.split('|'); pegar(dia, +f).COMPROU = n; });
    const nDiasVenda = cp.diasVenda.size;
    const porFaixa = new Map();
    porDia.forEach(r => {
      let f = porFaixa.get(r.faixa);
      if (!f) porFaixa.set(r.faixa, f = { faixa: r.faixa, sP: 0, nP: 0, sC: 0, cP: 0, cC: 0 });
      if (r.temP) { f.sP += r.PASSOU; f.nP++; f.cP += r.PASSOU; f.cC += r.COMPROU; }
      f.sC += r.COMPROU;
    });
    const linhas = [...porFaixa.values()].map(f => ({
      faixa: f.faixa,
      passou: f.nP ? f.sP / f.nP : null, diasP: f.nP,
      comprou: nDiasVenda ? f.sC / nDiasVenda : null,
      conv: f.cP > 0 ? f.cC / f.cP * 100 : null,
    })).sort((a, b) => P.Dia.ordemFaixa(a.faixa) - P.Dia.ordemFaixa(b.faixa));
    let tP = 0, tC = 0;
    porDia.forEach(r => { if (r.temP) { tP += r.PASSOU; tC += r.COMPROU; } });
    return {
      dias, linhas, porDia, nDiasVenda,
      diasComDado: new Set([...porDia.values()].map(r => r.dia)),
      convGeral: tP > 0 ? tC / tP * 100 : null,
    };
  }

  function destaques(linhas, modo) {
    const campo = modo === 'PASSOU' ? 'passou' : 'comprou';
    const ok = linhas.filter(l => l[campo] != null);
    const desc = ok.slice().sort((a, b) => b[campo] - a[campo]);
    const top = desc.slice(0, 3).map(l => l.faixa);
    const baixo = desc.slice().reverse().filter(l => !top.includes(l.faixa)).slice(0, 3).map(l => l.faixa);
    return { top, baixo, campo };
  }

  function telaAnalise(view) {
    view.className = 'v-analise';
    let periodo = 7, semana = 0, rank = 'COMPROU';
    const corpo = h('div');

    const filtros = h('div', { class: 'filtros' },
      h('div', { class: 'filtro-lin' }, h('span', { class: 'filtro-rot' }, 'Período'),
        P.UI.seg([{ v: 7, rotulo: '7 dias' }, { v: 30, rotulo: '30 dias' }, { v: 0, rotulo: 'Tudo' }], periodo, v => { periodo = v; desenhar(); }, 'seg-p')),
      h('div', { class: 'filtro-lin' }, h('span', { class: 'filtro-rot' }, 'Dia'),
        P.UI.seg([{ v: 0, rotulo: 'Todos' }].concat([1, 2, 3, 4, 5, 6].map(d => ({ v: d, rotulo: P.Dia.NOMES_SEMANA[d] }))), semana, v => { semana = v; desenhar(); }, 'seg-p seg-dias')),
      h('div', { class: 'filtro-lin' }, h('span', { class: 'filtro-rot' }, 'Ranking'),
        P.UI.seg([{ v: 'COMPROU', rotulo: 'Comprou' }, { v: 'PASSOU', rotulo: 'Passou' }], rank, v => { rank = v; desenhar(); }, 'seg-p')));

    function desenhar() {
      const r = calcular(periodo, semana);
      corpo.innerHTML = '';
      const nome = semana ? P.Dia.NOMES_SEMANA[semana] : '';
      const base = (periodo ? 'Últimos ' + periodo + ' dias operacionais' : 'Todo o histórico') + (semana ? ' de ' + nome : '');
      corpo.appendChild(h('div', { class: 'an-base' },
        base + (r.dias.length ? ' (' + P.Dia.rotuloCurto(r.dias[r.dias.length - 1]) + ' a ' + P.Dia.rotuloCurto(r.dias[0]) + ')' : '') +
        ' · ' + r.nDiasVenda + (r.nDiasVenda === 1 ? ' dia com venda' : ' dias com venda') + '. Comprou = comandas, automático.'));
      if (!r.linhas.length) {
        corpo.appendChild(P.UI.vazio('Sem dados neste período. As compras entram sozinhas pelas comandas; a passagem, pela tela Contar.'));
        return;
      }
      const d = destaques(r.linhas, rank);
      const max = Math.max(1, ...r.linhas.map(l => Math.max(l.passou || 0, l.comprou || 0)));

      corpo.appendChild(h('div', { class: 'an-kpis' },
        kpi('Conversão geral', P.pct(r.convGeral, 0), r.convGeral == null ? 'conte a passagem' : 'comprou ÷ passou'),
        kpi('Pico (' + (rank === 'COMPROU' ? 'compra' : 'passagem') + ')', d.top[0] != null ? P.Dia.rotuloFaixa(d.top[0]) : '—', d.top.length ? 'maior média' : ''),
        kpi('Dias com venda', String(r.nDiasVenda), 'no período')));

      const legenda = h('div', { class: 'an-leg' },
        h('span', { class: 'lg lg-p' }, 'Passou (contado)'), h('span', { class: 'lg lg-c' }, 'Comprou (comandas)'), h('span', { class: 'lg-conv' }, 'conversão'));
      const grafico = h('div', { class: 'an-graf' });
      r.linhas.forEach(l => {
        const ehTop = d.top.includes(l.faixa), ehBaixo = d.baixo.includes(l.faixa);
        grafico.appendChild(h('div', { class: 'an-lin' + (ehTop ? ' top' : '') + (ehBaixo ? ' baixo' : '') },
          h('div', { class: 'an-fx' }, String(l.faixa).padStart(2, '0') + 'h',
            ehTop ? h('span', { class: 'an-tag t' }, '▲') : ehBaixo ? h('span', { class: 'an-tag b' }, '▼') : null),
          h('div', { class: 'an-barras' },
            barra('p', l.passou, max), barra('c', l.comprou, max)),
          h('div', { class: 'an-conv' + (l.conv == null ? ' nd' : '') }, P.pct(l.conv, 0))));
      });
      corpo.append(legenda, grafico);

      const nomes = arr => arr.length ? arr.map(f => P.Dia.rotuloFaixa(f)).join(', ') : '—';
      corpo.appendChild(h('div', { class: 'an-dest' },
        h('div', null, h('span', { class: 'an-tag t' }, '▲'), ' Maior movimento: ', h('b', null, nomes(d.top))),
        h('div', null, h('span', { class: 'an-tag b' }, '▼'), ' Menor movimento: ', h('b', null, nomes(d.baixo)))));

      corpo.appendChild(h('button', { type: 'button', class: 'btn bloco', onClick: () => exportar(r) }, P.UI.icone('download'), 'Exportar CSV'));
    }
    function kpi(rot, val, sub) {
      return h('div', { class: 'kpi' }, h('div', { class: 'kpi-rot' }, rot), h('div', { class: 'kpi-val' }, val), sub ? h('div', { class: 'kpi-sub' }, sub) : null);
    }
    function barra(tipo, v, max) {
      return h('div', { class: 'an-b an-' + tipo },
        h('span', { class: 'an-bar', style: { width: v == null ? '0' : Math.max(2, v / max * 100) + '%' } }),
        h('span', { class: 'an-bv' }, v == null ? '—' : P.num(v, v < 10 ? 1 : 0)));
    }
    function exportar(r) {
      const linhas = [...r.porDia.values()].sort((a, b) => a.dia === b.dia ? P.Dia.ordemFaixa(a.faixa) - P.Dia.ordemFaixa(b.faixa) : (a.dia < b.dia ? -1 : 1));
      const csv = ['dia_operacional;dia_semana;faixa;passou;comprou_comandas;conversao_pct'].concat(linhas.map(l => [
        l.dia, P.Dia.nomeSemana(l.dia), P.Dia.rotuloFaixa(l.faixa),
        l.temP ? l.PASSOU : '', l.COMPROU,
        l.temP && l.PASSOU > 0 ? P.num(l.COMPROU / l.PASSOU * 100, 1) : '',
      ].join(';'))).join('\r\n');
      P.UI.baixar('fluxo_' + P.Dia.hoje() + '.csv', '\uFEFF' + csv, 'text/csv;charset=utf-8');
      P.UI.toast('CSV gerado (' + linhas.length + ' linhas)');
    }

    view.append(subnavFluxo('analise'), filtros, corpo);
    desenhar();
    return { onDados(t) { if (t.has('contagens') || t.has('comandas') || t.has('comanda_itens')) desenhar(); } };
  }

  P.UI.rota('fluxo', { titulo: 'Fluxo', tab: 'fluxo', render: telaContar });
  P.UI.rota('fluxo/analise', { titulo: 'Fluxo · análise', tab: 'fluxo', dono: true, render: telaAnalise });

  P.Fluxo = { reconciliar, calcular, totais, compras, _blocos: () => blocos };
})();
