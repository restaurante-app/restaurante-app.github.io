/* GÁS — cada botijão, do dia em que foi ligado ao dia em que acabou.
   Com isso o app sabe quanto um botijão dura (em dias e em dias com venda),
   o custo do gás por dia aberto e quando o botijão em uso deve acabar.
   Gás comprado depois de ligar o botijão em uso fica como reserva (liga em "Acabou o gás").
   A compra do botijão é uma despesa (Gás / carvão) ligada a ele: lançada daqui
   ou, se já foi lançada em Despesas, só ligada. */
(function () {
  'use strict';
  const P = window.P;
  const h = P.UI.h;
  const TAMANHOS = [{ v: 'P13', rotulo: 'P13' }, { v: 'P20', rotulo: 'P20' }, { v: 'P45', rotulo: 'P45 (grande)' }];
  const NOME_TAM = { P13: 'P13', P20: 'P20', P45: 'P45 (grande)' };
  const nomeTam = t => NOME_TAM[t] || t || 'Botijão';

  const todos = () => P.Store.all('botijoes').sort((a, b) => (a.inicio < b.inicio ? 1 : a.inicio > b.inicio ? -1 : a.criado_em < b.criado_em ? 1 : -1));
  const emUso = () => todos().find(b => !b.fim) || null;
  const diasEntre = (de, ate) => Math.round((P.Dia.parse(ate) - P.Dia.parse(de)) / 86400000);
  // dias com venda (conta fechada) de `de` até antes de `ate`
  function diasComVenda(de, ate) {
    const set = new Set();
    P.Store.all('comandas').forEach(c => { if (c.status === 'FECHADA' && c.dia_operacional >= de && c.dia_operacional < ate) set.add(c.dia_operacional); });
    return set.size;
  }
  // um botijão: dias corridos e dias com venda (o que acabou: do dia em que ligou até o dia em que acabou;
  // o em uso: até hoje, contando hoje)
  function info(b) {
    const hoje = P.Dia.hoje();
    const ate = b.fim || P.Dia.somaDias(hoje, 1);
    const corridos = Math.max(0, diasEntre(b.inicio, b.fim || hoje));
    const abertos = diasComVenda(b.inicio, ate);
    return { corridos, abertos, custoDia: b.fim && abertos ? (+b.valor || 0) / abertos : null };
  }
  // média dos botijões que já acabaram (do mesmo tamanho do em uso, se houver)
  function medias(tamanho) {
    let fins = todos().filter(b => b.fim && diasEntre(b.inicio, b.fim) > 0);
    if (tamanho && fins.some(b => b.tamanho === tamanho)) fins = fins.filter(b => b.tamanho === tamanho);
    if (!fins.length) return null;
    const is = fins.map(info);
    const n = fins.length;
    const abertos = is.reduce((s, i) => s + i.abertos, 0);
    const valor = fins.reduce((s, b) => s + (+b.valor || 0), 0);
    const custoDia = abertos ? valor / abertos : null;
    return {
      n, corridos: is.reduce((s, i) => s + i.corridos, 0) / n, abertos: abertos / n, custoDia,
      custoMes: custoDia != null ? custoDia * (+P.cfg('operacao').dias_mes || 26) : null,
    };
  }
  // previsão do botijão em uso pela média
  function previsao(b) {
    const m = medias(b.tamanho);
    if (!m || !(m.abertos > 0)) return null;
    const i = info(b);
    const falta = Math.round(m.abertos - i.abertos);
    let d = P.Dia.hoje(), k = 0;
    while (k < falta) { d = P.Dia.somaDias(d, 1); if (P.Dia.semana(d) !== 0) k++; }
    return { m, i, falta, dia: d, frac: Math.min(1.2, i.abertos / m.abertos) };
  }
  // aviso para o Painel quando o botijão em uso está perto da média
  function aviso() {
    const b = emUso();
    const p = b && previsao(b);
    if (!p || p.falta > 1) return null;
    return 'Gás: ' + (p.falta < 0 ? 'o botijão em uso já passou da média (' + dias(p.m.abertos) + ' com venda)'
      : 'pela média, o botijão em uso deve acabar ' + (p.falta === 0 ? 'hoje' : P.Dia.rotulo(p.dia))) + '. Tenha outro à mão.';
  }
  const quando = p => (p.falta < 0 ? ['Já passou da média', 'tenha outro à mão'] : p.falta === 0 ? ['Pela média, deve acabar', 'hoje'] : ['Deve acabar por volta de', P.Dia.rotulo(p.dia)]);
  const nDias = n => (n === 0 ? 'desde hoje' : n + (n === 1 ? ' dia' : ' dias'));
  const dias = v => { const n = Math.round(v); return P.num(n, 0) + (n === 1 ? ' dia' : ' dias'); };
  // despesas de gás que ainda não estão ligadas a um botijão (lançadas em Despesas)
  function despesasSoltas() {
    const ligadas = new Set(P.Store.all('botijoes').map(b => b.despesa_id).filter(Boolean));
    return P.Store.all('despesas').filter(d => d.categoria === 'GAS_CARVAO' && !ligadas.has(d.id) && !/carv/i.test(d.descricao || ''))
      .sort((a, b) => (a.dia_operacional < b.dia_operacional ? 1 : -1));
  }
  // botijões de reserva: gás comprado (em Despesas) depois que o botijão em uso foi ligado e ainda
  // não ligado a nenhum botijão — o mais antigo primeiro. Ligado em "Acabou o gás".
  function reservas(b) {
    if (!b) return [];
    return despesasSoltas().filter(d => d.dia_operacional >= b.inicio && !(!b.despesa_id && d.dia_operacional === b.inicio)).reverse();
  }
  function lancarDespesa(dia, valor, forma, tamanho) {
    const u = P.Auth.usuario();
    return P.Store.put('despesas', {
      id: P.uuid(), dia_operacional: dia, categoria: 'GAS_CARVAO', forma, descricao: 'Botijão de gás ' + nomeTam(tamanho), valor: P.round(valor, 2),
      criado_em: dia === P.Dia.hoje() ? P.agoraISO() : P.Compras.meioDia(dia), usuario_id: u && u.id,
    });
  }

  // ---------------------------------------------------------------
  //  Folhas
  // ---------------------------------------------------------------
  // botijão novo (ligado agora ou registrar o que está em uso) ou editar um existente.
  // o: { inicio, tamanho, valor, despesa } — despesa: despesa já lançada para ligar
  function editar(b0, o) {
    o = o || {};
    return new Promise(resolve => {
      const ult = todos()[0];
      const b = Object.assign({ id: P.uuid(), inicio: o.inicio || P.Dia.hoje(), fim: null, tamanho: o.tamanho || (ult && ult.tamanho) || 'P45',
        valor: o.valor != null ? o.valor : ult ? +ult.valor || 0 : 0, despesa_id: o.despesa ? o.despesa.id : null, obs: null,
        criado_em: P.agoraISO(), usuario_id: (P.Auth.usuario() || {}).id || null }, b0 || {});
      let lancar = !b0 && !o.despesa;
      let forma = 'DINHEIRO';
      let feito = false;
      const bIni = h('button', { type: 'button', class: 'btn bloco cp-dia-f' });
      const bFim = h('button', { type: 'button', class: 'btn bloco cp-dia-f' });
      const bValor = h('button', { type: 'button', class: 'btn valor bloco' });
      const obs = h('input', { class: 'campo', type: 'text', value: b.obs || '', placeholder: 'Observação (opcional)', autocomplete: 'off' });
      const elDesp = h('div');
      function mostrar() {
        bIni.replaceChildren(P.UI.icone('calendario'), h('span', null, 'Ligado ' + P.Dia.rotulo(b.inicio)), h('small', null, 'trocar ▾'));
        bFim.replaceChildren(P.UI.icone('calendario'), h('span', null, b.fim ? 'Acabou ' + P.Dia.rotulo(b.fim) : 'Ainda em uso'), h('small', null, 'trocar ▾'));
        bValor.textContent = +b.valor > 0 ? P.brl(b.valor) : 'Valor pago (R$)';
        elDesp.replaceChildren(...[
          b0 || o.despesa ? h('small', { class: 'campo-d' }, b.despesa_id ? 'Ligado à despesa de gás ' + (o.despesa ? 'de ' + P.Dia.rotulo(o.despesa.dia_operacional) : 'lançada') + '.' : 'Sem despesa ligada.')
            : [
              P.UI.seg([{ v: true, rotulo: 'Lançar a compra em Despesas' }, { v: false, rotulo: 'Já lancei / não paguei' }], lancar, v => { lancar = v; mostrar(); }, 'seg-p'),
              lancar ? P.UI.seg(P.Mesas.FORMAS_DESP, forma, v => { forma = v; }, 'seg-p') : null,
            ]].flat().filter(Boolean));
      }
      bIni.addEventListener('click', () => P.Compras.calendario(b.inicio, iso => { b.inicio = iso; if (b.fim && b.fim < iso) b.fim = iso; mostrar(); }, { titulo: 'Dia em que o botijão foi ligado' }));
      bFim.addEventListener('click', () => P.Compras.calendario(b.fim || P.Dia.hoje(), iso => { if (iso < b.inicio) { P.UI.toast('Acabou antes de ser ligado?', { tipo: 'perigo' }); return; } b.fim = iso; mostrar(); }, { titulo: 'Dia em que o botijão acabou' }));
      bValor.addEventListener('click', async () => { const v = await P.UI.pedirNumero({ titulo: 'Valor do botijão', valor: +b.valor || null, decimais: 2, prefixo: 'R$ ' }); if (v != null) { b.valor = v; mostrar(); } });
      const sh = P.UI.sheet(h('div', { class: 'np-sheet' },
        h('span', { class: 'campo-r' }, 'Tamanho'),
        P.UI.seg(TAMANHOS, b.tamanho, v => { b.tamanho = v; }, 'seg-p'),
        bIni, b0 ? bFim : null,
        h('span', { class: 'campo-r' }, 'Valor'), bValor, elDesp, obs,
        h('div', { class: 'row gap' },
          b0 ? h('button', { type: 'button', class: 'btn perigo', 'aria-label': 'Excluir', onClick: async () => {
            if (!(await P.UI.confirmar('Excluir este botijão do controle do gás? A despesa da compra continua lançada.', { ok: 'Excluir', perigo: true }))) return;
            P.Store.remove('botijoes', b.id);
            feito = true; resolve(null); sh.fechar();
          } }, P.UI.icone('lixo')) : null,
          h('button', { type: 'button', class: 'btn', onClick: () => sh.fechar() }, 'Cancelar'),
          h('button', { type: 'button', class: 'btn primario grow', onClick: () => {
            if (lancar && !(+b.valor > 0)) { P.UI.toast('Ponha o valor do botijão (ou escolha "Já lancei").', { tipo: 'perigo' }); return; }
            if (lancar) b.despesa_id = lancarDespesa(b.inicio, +b.valor, forma, b.tamanho).id;
            b.obs = obs.value.trim() || null;
            b.valor = P.round(+b.valor || 0, 2);
            const r = P.Store.put('botijoes', b);
            feito = true; resolve(r); sh.fechar();
          } }, 'Salvar'))),
      { titulo: b0 ? 'Editar botijão' : o.despesa ? 'Registrar o botijão' : 'Botijão ligado', onFechar: () => { if (!feito) resolve(null); } });
      mostrar();
    });
  }
  // acabou o gás: fecha o botijão em uso e já registra o novo (se ligou outro)
  function acabou(b) {
    return new Promise(resolve => {
      let dia = P.Dia.hoje();
      const res = reservas(b)[0] || null; // botijão de reserva já comprado
      let modo = res ? 'reserva' : 'novo'; // reserva | novo | nao
      let lancar = true, forma = 'DINHEIRO';
      let tamanho = b.tamanho || 'P45', valor = +b.valor || 0;
      let feito = false;
      const bDia = h('button', { type: 'button', class: 'btn bloco cp-dia-f' });
      const bValor = h('button', { type: 'button', class: 'btn valor bloco' });
      const elNovo = h('div', { class: 'gs-novo' });
      const elInfo = h('small', { class: 'campo-d' });
      function mostrar() {
        const i = info(Object.assign({}, b, { fim: dia }));
        bDia.replaceChildren(P.UI.icone('calendario'), h('span', null, 'Acabou ' + P.Dia.rotulo(dia)), h('small', null, 'trocar ▾'));
        elInfo.textContent = 'Ligado ' + P.Dia.rotulo(b.inicio) + ' → durou ' + i.corridos + (i.corridos === 1 ? ' dia' : ' dias') + ' (' + i.abertos + ' com venda)' +
          (i.custoDia != null ? ' · ' + P.brl(i.custoDia) + ' por dia aberto' : '') + '.';
        bValor.textContent = valor > 0 ? P.brl(valor) : 'Valor pago (R$)';
        elNovo.replaceChildren(...[
          P.UI.seg([res ? { v: 'reserva', rotulo: 'Liguei a reserva' } : null, { v: 'novo', rotulo: res ? 'Liguei outro' : 'Liguei outro botijão' }, { v: 'nao', rotulo: 'Ainda não' }].filter(Boolean),
            modo, v => { modo = v; mostrar(); }, 'seg-p'),
          modo === 'reserva' ? [
            h('small', { class: 'campo-d' }, 'Reserva comprada ' + P.Dia.rotulo(res.dia_operacional) + ' · ' + (res.descricao || 'gás') + ' · ' + P.brl(res.valor) + ' (já está em Despesas).'),
            h('span', { class: 'campo-r' }, 'Tamanho'),
            P.UI.seg(TAMANHOS, tamanho, v => { tamanho = v; }, 'seg-p'),
          ] : null,
          modo === 'novo' ? [
            h('span', { class: 'campo-r' }, 'Botijão novo'),
            P.UI.seg(TAMANHOS, tamanho, v => { tamanho = v; }, 'seg-p'),
            bValor,
            P.UI.seg([{ v: true, rotulo: 'Lançar a compra em Despesas' }, { v: false, rotulo: 'Já lancei / não paguei' }], lancar, v => { lancar = v; mostrar(); }, 'seg-p'),
            lancar ? P.UI.seg(P.Mesas.FORMAS_DESP, forma, v => { forma = v; }, 'seg-p') : null,
          ] : null].flat().filter(Boolean));
      }
      bDia.addEventListener('click', () => P.Compras.calendario(dia, iso => { if (iso < b.inicio) { P.UI.toast('Esse dia é antes de ligar o botijão.', { tipo: 'perigo' }); return; } dia = iso; mostrar(); }, { titulo: 'Dia em que o gás acabou' }));
      bValor.addEventListener('click', async () => { const v = await P.UI.pedirNumero({ titulo: 'Valor do botijão novo', valor: valor || null, decimais: 2, prefixo: 'R$ ' }); if (v != null) { valor = v; mostrar(); } });
      const sh = P.UI.sheet(h('div', { class: 'np-sheet' }, bDia, elInfo, elNovo,
        h('div', { class: 'row gap' },
          h('button', { type: 'button', class: 'btn', onClick: () => sh.fechar() }, 'Cancelar'),
          h('button', { type: 'button', class: 'btn primario grow', onClick: () => {
            if (modo === 'novo' && lancar && !(valor > 0)) { P.UI.toast('Ponha o valor do botijão novo (ou escolha "Já lancei").', { tipo: 'perigo' }); return; }
            P.Store.put('botijoes', Object.assign({}, b, { fim: dia }));
            if (modo !== 'nao') {
              const desp = modo === 'reserva' ? res : lancar ? lancarDespesa(dia, valor, forma, tamanho) : null;
              P.Store.put('botijoes', { id: P.uuid(), inicio: dia, fim: null, tamanho, valor: P.round(modo === 'reserva' ? +res.valor : valor, 2), despesa_id: desp ? desp.id : null, obs: null,
                criado_em: P.agoraISO(), usuario_id: (P.Auth.usuario() || {}).id || null });
            }
            const i = info(Object.assign({}, b, { fim: dia }));
            P.UI.toast('O botijão durou ' + i.corridos + (i.corridos === 1 ? ' dia' : ' dias') + ' (' + i.abertos + ' com venda)');
            P.vibrar([20, 40, 20]);
            feito = true; resolve(true); sh.fechar();
          } }, P.UI.icone('check'), 'Salvar'))),
      { titulo: 'Acabou o gás', onFechar: () => { if (!feito) resolve(null); } });
      mostrar();
    });
  }

  // ---------------------------------------------------------------
  //  TELA
  // ---------------------------------------------------------------
  function telaGas(view) {
    view.className = 'v-mesas v-gas';
    const corpo = h('div');
    const linha = (rot, val, cls) => h('div', { class: 'eq-l' + (cls ? ' ' + cls : '') }, h('span', null, rot), h('b', null, val));
    function desenhar() {
      corpo.innerHTML = '';
      const b = emUso();
      if (b) {
        const i = info(b);
        const p = previsao(b);
        corpo.appendChild(h('section', { class: 'eq-card gs-uso' },
          h('div', { class: 'eq-top' },
            h('span', { class: 'avatar dono' }, P.UI.icone('fogo')),
            h('div', { class: 'eq-nome' }, h('b', null, 'Botijão em uso · ' + nomeTam(b.tamanho)), h('small', null, 'ligado ' + P.Dia.rotulo(b.inicio) + (+b.valor > 0 ? ' · ' + P.brl(b.valor) : ''))),
            h('button', { type: 'button', class: 'lc-b', 'aria-label': 'Editar botijão', onClick: () => editar(b).then(desenhar) }, P.UI.icone('lapis'))),
          linha('Em uso', nDias(i.corridos) + ' · ' + i.abertos + (i.abertos === 1 ? ' dia com venda' : ' dias com venda')),
          p ? [
            h('div', { class: 'gs-barra' + (p.falta < 0 ? ' passou' : p.falta <= 1 ? ' perto' : '') }, h('i', { style: { width: Math.min(100, p.frac * 100) + '%' } })),
            linha('A média é', dias(p.m.abertos) + ' com venda'),
            linha(quando(p)[0], quando(p)[1], p.falta <= 1 ? 't-amarelo' : null),
          ] : h('small', { class: 'eq-obs' }, 'Quando este botijão acabar, toque em "Acabou o gás": o app guarda quanto ele durou e passa a prever o próximo.'),
          b.obs ? h('small', { class: 'eq-obs' }, b.obs) : null,
          h('div', { class: 'row gap eq-acoes' },
            h('button', { type: 'button', class: 'btn primario grow', onClick: () => acabou(b).then(desenhar) }, P.UI.icone('fogo'), 'Acabou o gás'))));
      } else {
        corpo.appendChild(P.UI.vazio('Nenhum botijão em uso registrado. Registre o que está ligado (com o dia em que foi ligado) e, quando acabar, toque em "Acabou o gás": o app calcula quanto dura e o custo por dia.', 'fogo'));
      }
      // despesas de gás lançadas em Despesas que ainda não viraram botijão
      const soltas = despesasSoltas().filter(d => !b || d.dia_operacional >= b.inicio).slice(0, 3);
      soltas.forEach(d => {
        // gás do mesmo dia em que o botijão em uso foi ligado (e ele está sem despesa): é a compra dele
        const dele = b && !b.despesa_id && d.dia_operacional === b.inicio;
        // comprado depois de ligar o botijão em uso: é reserva (liga em "Acabou o gás")
        if (b && !dele) {
          corpo.appendChild(h('div', { class: 'banner ok gs-solta' }, P.UI.icone('fogo'),
            h('span', { class: 'banner-t' }, 'Reserva: botijão comprado ' + P.Dia.rotulo(d.dia_operacional) + ' (' + P.brl(d.valor) + '). Quando o atual acabar, toque em "Acabou o gás" e escolha "Liguei a reserva".')));
          return;
        }
        corpo.appendChild(h('div', { class: 'banner aviso gs-solta' }, P.UI.icone('fogo'),
          h('span', { class: 'banner-t' }, 'Gás lançado em Despesas ' + P.Dia.rotulo(d.dia_operacional) + ': ' + (d.descricao || 'gás') + ' · ' + P.brl(d.valor) + '. ' +
            (dele ? 'É a compra do botijão em uso?' : 'É um botijão ligado nesse dia?')),
          h('button', { type: 'button', class: 'btn mini', onClick: async () => {
            if (dele) { P.Store.put('botijoes', Object.assign({}, b, { despesa_id: d.id, valor: +b.valor > 0 ? b.valor : +d.valor })); desenhar(); return; }
            if (b && b.inicio < d.dia_operacional && !(await P.UI.confirmar('Fechar o botijão em uso (ligado ' + P.Dia.rotulo(b.inicio) + ') como acabado ' + P.Dia.rotulo(d.dia_operacional) + ' e registrar este como o novo?', { ok: 'Sim' }))) return;
            const r = await editar(null, { inicio: d.dia_operacional, valor: +d.valor, despesa: d });
            if (r && b && b.inicio < r.inicio) P.Store.put('botijoes', Object.assign({}, b, { fim: r.inicio }));
            desenhar();
          } }, dele ? 'Ligar' : 'Registrar')));
      });
      if (!b) corpo.appendChild(h('button', { type: 'button', class: 'btn primario bloco', onClick: () => editar(null).then(desenhar) }, P.UI.icone('mais'), 'Registrar botijão em uso'));

      const m = medias(b && b.tamanho);
      corpo.appendChild(h('div', { class: 'secao' }, 'Quanto dura'));
      corpo.appendChild(m ? h('section', { class: 'eq-card' },
        linha('Média (' + m.n + (m.n === 1 ? ' botijão' : ' botijões') + ')', dias(m.corridos) + ' · ' + dias(m.abertos) + ' com venda'),
        m.custoDia != null ? linha('Custo do gás por dia aberto', P.brl(m.custoDia)) : null,
        m.custoMes != null ? linha('No mês (' + (+P.cfg('operacao').dias_mes || 26) + ' dias)', '≈ ' + P.brl0(m.custoMes)) : null)
        : h('div', { class: 'dica' }, 'Ainda nenhum botijão acabou. A média aparece aqui depois do primeiro.'));

      const fins = todos().filter(x => x.fim);
      if (fins.length) {
        corpo.appendChild(h('div', { class: 'secao' }, 'Botijões anteriores'));
        corpo.appendChild(h('div', { class: 'ms-lista' }, fins.map(x => {
          const i = info(x);
          return h('button', { type: 'button', class: 'ms-card', onClick: () => editar(x).then(desenhar) },
            h('div', { class: 'ms-card-n' }, nomeTam(x.tamanho) + ' · ' + P.Dia.rotuloCurto(x.inicio) + ' → ' + P.Dia.rotuloCurto(x.fim),
              h('small', null, i.corridos + (i.corridos === 1 ? ' dia' : ' dias') + ' · ' + i.abertos + ' com venda' + (i.custoDia != null ? ' · ' + P.brl(i.custoDia) + '/dia aberto' : ''))),
            h('b', null, P.brl(x.valor)));
        })));
      }
    }
    view.append(corpo);
    desenhar();
    return { onDados(t) { if (t.has('botijoes') || t.has('despesas') || t.has('comandas')) desenhar(); } };
  }

  P.UI.rota('gas', { titulo: 'Gás', tab: 'mais', render: telaGas });
  P.Gas = { todos, emUso, info, medias, previsao, aviso, despesasSoltas, reservas, nomeTam, TAMANHOS };
})();
