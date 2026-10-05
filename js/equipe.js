/* EQUIPE (dono) — quem trabalha, como recebe e quanto falta pagar.
   Cada pagamento é uma despesa (Funcionários ou Pró-labore) ligada à pessoa,
   com o tipo (vale, condução, salário, semana, diária) e a competência (mês ou
   semana a que se refere). Assim o lucro e o caixa continuam vindo das despesas,
   e aqui aparece a conta de cada um:
     mensal  → salário do mês − vales − salário já pago = falta pagar
     semanal → valor da semana − o que já foi pago naquela semana
     dono    → pró-labore do mês − retiradas = quanto ainda pode retirar */
(function () {
  'use strict';
  const P = window.P;
  const h = P.UI.h;
  const COMO = [
    { v: 'MENSAL', rotulo: 'Salário mensal' }, { v: 'SEMANAL', rotulo: 'Por semana' },
    { v: 'DIARIA', rotulo: 'Diária' }, { v: 'PROLABORE', rotulo: 'Dono (pró-labore)' },
  ];
  const NOME_COMO = Object.fromEntries(COMO.map(c => [c.v, c.rotulo]));

  const pessoas = () => P.Store.all('pessoas').sort((a, b) => ((a.pagamento === 'PROLABORE') - (b.pagamento === 'PROLABORE')) || a.nome.localeCompare(b.nome, 'pt-BR'));
  const pagamentosDe = id => P.Store.all('despesas').filter(d => d.pessoa_id === id).sort((a, b) => (a.dia_operacional < b.dia_operacional ? 1 : a.dia_operacional > b.dia_operacional ? -1 : a.criado_em < b.criado_em ? 1 : -1));
  const soma = ds => P.round(ds.reduce((s, d) => s + (+d.valor || 0), 0), 2);
  const fimSemana = seg => P.Dia.somaDias(seg, 5); // segunda → sábado (o mercado fecha domingo)
  const rotuloSemana = seg => P.Dia.rotuloCurto(seg) + '–' + P.Dia.rotuloCurto(fimSemana(seg));
  // competência de um pagamento (gravada; se não tiver, deduz pelo dia)
  const comp = d => d.competencia || P.Mesas.competenciaDe(d.categoria, d.subtipo, d.dia_operacional) || d.dia_operacional.slice(0, 7);
  const mesDe = d => comp(d).slice(0, 7);

  // conta de uma pessoa no mês (mensal/diária/dono) ou na semana (semanal)
  function contaMes(p, mes) {
    const ds = pagamentosDe(p.id);
    if (p.pagamento === 'PROLABORE') {
      const ret = ds.filter(d => d.categoria === 'PROLABORE' && mesDe(d) === mes);
      return { previsto: +p.valor || 0, pago: soma(ret), lista: ret, falta: P.round((+p.valor || 0) - soma(ret), 2) };
    }
    const doMes = ds.filter(d => mesDe(d) === mes);
    const por = t => doMes.filter(d => d.subtipo === t);
    const vales = soma(por('VALE')), salario = soma(por('SALARIO')), conducao = soma(por('CONDUCAO'));
    const outros = soma(doMes.filter(d => !['VALE', 'SALARIO', 'CONDUCAO'].includes(d.subtipo)));
    const devido = p.pagamento === 'MENSAL' && ativoNoMes(p, mes) ? +p.valor || 0 : 0;
    return { previsto: devido, vales, salario, conducao, outros, pago: soma(doMes), lista: doMes, nConducao: por('CONDUCAO').length,
      falta: p.pagamento === 'MENSAL' ? P.round(Math.max(0, devido - vales - salario), 2) : 0 };
  }
  function ativoNoMes(p, mes) {
    if (p.inicio && p.inicio.slice(0, 7) > mes) return false;
    if (p.fim && p.fim.slice(0, 7) < mes) return false;
    return true;
  }
  // semanas de uma pessoa semanal: do início (ou da 1ª com pagamento) até a semana atual
  function semanas(p) {
    const hoje = P.Dia.hoje();
    const atual = P.Mesas.inicioSemana(hoje);
    const ds = pagamentosDe(p.id);
    const porSem = new Map();
    // semana do pagamento: a competência gravada (segunda-feira) ou a semana do dia em que pagou
    ds.forEach(d => {
      const k = d.competencia && d.competencia.length === 10 ? d.competencia : P.Mesas.inicioSemana(d.dia_operacional);
      porSem.set(k, (porSem.get(k) || []).concat(d));
    });
    const ini = p.inicio ? P.Mesas.inicioSemana(p.inicio) : atual;
    const out = [];
    let s = [...porSem.keys(), ini].sort()[0];
    for (let i = 0; i < 60 && s <= atual; i++) {
      const lista = porSem.get(s) || [];
      const devida = s >= ini && (!p.fim || s <= p.fim) ? +p.valor || 0 : 0;
      out.push({ seg: s, devida, pago: soma(lista), lista, atual: s === atual, falta: P.round(Math.max(0, devida - soma(lista)), 2) });
      s = P.Dia.somaDias(s, 7);
    }
    return out.reverse();
  }

  // atalho: lança o pagamento (abre a folha de despesa já preenchida)
  function pagar(p, subtipo, valor) {
    const cat = p.pagamento === 'PROLABORE' ? 'PROLABORE' : 'FUNCIONARIOS';
    return P.Mesas.novaDespesa(P.Dia.hoje(), cat, null, { pessoa_id: p.id, subtipo: cat === 'PROLABORE' ? null : subtipo, valor: valor > 0 ? P.round(valor, 2) : null });
  }

  // ---------------------------------------------------------------
  //  Cadastro da pessoa (folha)
  // ---------------------------------------------------------------
  function editarPessoa(p0) {
    return new Promise(resolve => {
      const p = Object.assign({ id: P.uuid(), nome: '', funcao: '', pagamento: 'MENSAL', valor: 0, conducao_dia: 0, inicio: P.Dia.hoje(), fim: null, ativo: true, obs: null }, p0 || {});
      let feito = false;
      const nome = h('input', { class: 'campo', type: 'text', value: p.nome, placeholder: 'Nome (ex.: Maria)', autocomplete: 'off' });
      const funcao = h('input', { class: 'campo', type: 'text', value: p.funcao || '', placeholder: 'Função (ex.: Cozinheira)', autocomplete: 'off' });
      const obs = h('input', { class: 'campo', type: 'text', value: p.obs || '', placeholder: 'Observação (opcional)', autocomplete: 'off' });
      const bValor = h('button', { type: 'button', class: 'btn valor bloco' });
      const bCond = h('button', { type: 'button', class: 'btn valor bloco' });
      const bIni = h('button', { type: 'button', class: 'btn bloco cp-dia-f' });
      const rotValor = () => ({ MENSAL: 'Salário do mês', SEMANAL: 'Valor da semana', DIARIA: 'Valor da diária', PROLABORE: 'Pró-labore do mês' }[p.pagamento]);
      const elValor = h('span', { class: 'campo-r' });
      function mostrar() {
        elValor.textContent = rotValor();
        bValor.textContent = +p.valor > 0 ? P.brl(p.valor) : rotValor() + ' (R$)';
        bCond.textContent = +p.conducao_dia > 0 ? P.brl(p.conducao_dia) + ' por dia trabalhado' : 'Sem condução';
        bIni.replaceChildren(P.UI.icone('calendario'), h('span', null, p.inicio ? 'Começou ' + P.Dia.rotulo(p.inicio) + '/' + p.inicio.slice(0, 4) : 'Data de início'), h('small', null, 'trocar ▾'));
        bCond.parentElement && (bCond.parentElement.hidden = p.pagamento === 'PROLABORE');
      }
      bValor.addEventListener('click', async () => { const v = await P.UI.pedirNumero({ titulo: rotValor(), valor: +p.valor || null, decimais: 2, prefixo: 'R$ ' }); if (v != null) { p.valor = v; mostrar(); } });
      bCond.addEventListener('click', async () => { const v = await P.UI.pedirNumero({ titulo: 'Condução por dia trabalhado', valor: +p.conducao_dia || null, decimais: 2, prefixo: 'R$ ', sub: '0 = sem condução' }); if (v != null) { p.conducao_dia = v; mostrar(); } });
      bIni.addEventListener('click', () => P.Compras.calendario(p.inicio || P.Dia.hoje(), iso => { p.inicio = iso; mostrar(); }, { titulo: 'Começou a trabalhar em' }));
      const cond = h('div', { class: 'campo-l' }, h('span', { class: 'campo-r' }, 'Condução'), bCond);
      const sh = P.UI.sheet(h('div', { class: 'np-sheet' },
        nome, funcao,
        h('span', { class: 'campo-r' }, 'Como recebe'),
        P.UI.seg(COMO, p.pagamento, v => { p.pagamento = v; mostrar(); }, 'seg-p seg-cat'),
        elValor, bValor, cond, bIni, obs,
        p0 ? P.UI.seg([{ v: true, rotulo: 'Trabalha aqui' }, { v: false, rotulo: 'Saiu' }], p.ativo !== false, v => { p.ativo = v; if (!v && !p.fim) p.fim = P.Dia.hoje(); if (v) p.fim = null; }, 'seg-p') : null,
        h('div', { class: 'row gap' },
          h('button', { type: 'button', class: 'btn', onClick: () => sh.fechar() }, 'Cancelar'),
          h('button', { type: 'button', class: 'btn primario grow', onClick: () => {
            p.nome = nome.value.trim();
            if (!p.nome) { P.UI.toast('Ponha o nome.', { tipo: 'perigo' }); nome.focus(); return; }
            p.funcao = funcao.value.trim() || null;
            p.obs = obs.value.trim() || null;
            if (p.pagamento === 'PROLABORE') p.conducao_dia = 0;
            const r = P.Store.put('pessoas', p);
            feito = true; resolve(r); sh.fechar();
          } }, 'Salvar'))),
      { titulo: p0 ? 'Editar ' + p0.nome : 'Nova pessoa na equipe', onFechar: () => { if (!feito) resolve(null); } });
      mostrar();
      if (!p0) setTimeout(() => nome.focus(), 80);
    });
  }

  // ---------------------------------------------------------------
  //  TELA: EQUIPE
  // ---------------------------------------------------------------
  function telaEquipe(view) {
    view.className = 'v-mesas v-equipe';
    let mes = P.Dia.mes(P.Dia.hoje());
    const corpo = h('div');
    const linha = (rot, val, cls) => h('div', { class: 'eq-l' + (cls ? ' ' + cls : '') }, h('span', null, rot), h('b', null, val));
    function cartao(p) {
      const acoes = h('div', { class: 'row gap eq-acoes' });
      const corpoC = [];
      if (p.pagamento === 'PROLABORE') {
        const c = contaMes(p, mes);
        corpoC.push(linha('Pró-labore de ' + P.Dia.rotuloMes(mes), P.brl(c.previsto)),
          linha('Retirado no mês (' + c.lista.length + ')', P.brl(c.pago)),
          linha(c.falta >= 0 ? 'Ainda pode retirar' : 'Retirou a mais', P.brl(Math.abs(c.falta)), c.falta >= 0 ? 't-verde' : 't-vermelho'));
        acoes.append(h('button', { type: 'button', class: 'btn primario grow', onClick: () => pagar(p, null).then(desenhar) }, P.UI.icone('mais'), 'Retirada'));
      } else if (p.pagamento === 'SEMANAL') {
        const ss = semanas(p);
        const at = ss.find(s => s.atual);
        const atrasadas = ss.filter(s => !s.atual && s.falta > 0);
        if (at) corpoC.push(linha('Semana ' + rotuloSemana(at.seg) + ' (esta)', P.brl(at.devida)), linha('Pago nesta semana', P.brl(at.pago)), linha('Falta pagar', P.brl(at.falta), at.falta > 0 ? 't-amarelo' : 't-verde'));
        atrasadas.forEach(s => corpoC.push(linha('Semana ' + rotuloSemana(s.seg) + ' — falta', P.brl(s.falta), 't-vermelho')));
        const anteriores = ss.filter(s => !s.atual && s.pago > 0).slice(0, 3);
        if (anteriores.length) corpoC.push(h('small', { class: 'eq-hist' }, 'Pago antes: ' + anteriores.map(s => rotuloSemana(s.seg) + ' ' + P.brl0(s.pago)).join(' · ')));
        acoes.append(
          h('button', { type: 'button', class: 'btn primario grow', onClick: () => pagar(p, 'SEMANA', at ? at.falta : +p.valor).then(desenhar) }, P.UI.icone('check'), 'Pagar semana'),
          h('button', { type: 'button', class: 'btn grow', onClick: () => pagar(p, 'VALE').then(desenhar) }, 'Vale'));
      } else {
        const c = contaMes(p, mes);
        if (p.pagamento === 'MENSAL') {
          corpoC.push(linha('Salário de ' + P.Dia.rotuloMes(mes), P.brl(c.previsto)));
          if (c.vales) corpoC.push(linha('Vales (descontar do salário)', '− ' + P.brl(c.vales)));
          if (c.salario) corpoC.push(linha('Salário já pago', '− ' + P.brl(c.salario)));
          corpoC.push(linha('Falta pagar do salário', P.brl(c.falta), c.falta > 0 ? 't-amarelo' : 't-verde'));
        } else corpoC.push(linha('Diária', P.brl(p.valor)), linha('Pago no mês', P.brl(c.pago)));
        if (+p.conducao_dia > 0 || c.conducao) corpoC.push(linha('Condução ' + (+p.conducao_dia > 0 ? P.brl(p.conducao_dia) + '/dia' : '') + ' · ' + c.nConducao + (c.nConducao === 1 ? ' dia pago' : ' dias pagos'), P.brl(c.conducao)));
        if (c.outros) corpoC.push(linha('Outros pagamentos', P.brl(c.outros)));
        acoes.append(
          h('button', { type: 'button', class: 'btn grow', onClick: () => pagar(p, 'VALE').then(desenhar) }, 'Vale'),
          +p.conducao_dia > 0 ? h('button', { type: 'button', class: 'btn grow', onClick: () => pagar(p, 'CONDUCAO', +p.conducao_dia).then(desenhar) }, 'Condução') : null,
          p.pagamento === 'MENSAL' ? h('button', { type: 'button', class: 'btn primario grow', onClick: () => pagar(p, 'SALARIO', c.falta).then(desenhar) }, 'Salário')
            : h('button', { type: 'button', class: 'btn primario grow', onClick: () => pagar(p, 'DIARIA', +p.valor).then(desenhar) }, 'Diária'));
      }
      const como = p.pagamento === 'PROLABORE' ? 'Pró-labore' + (+p.valor > 0 ? ' ' + P.brl0(p.valor) + '/mês' : '') : NOME_COMO[p.pagamento] + (+p.valor > 0 ? ' ' + P.brl0(p.valor) : '');
      return h('section', { class: 'eq-card' + (p.ativo === false ? ' inativo' : '') },
        h('a', { class: 'eq-top', href: '#/equipe/' + p.id },
          h('span', { class: 'avatar' + (p.pagamento === 'PROLABORE' ? ' dono' : '') }, P.UI.iniciais(p.nome.replace(/\(.*?\)/g, ''))),
          h('div', { class: 'eq-nome' }, h('b', null, p.nome), h('small', null, [p.pagamento === 'PROLABORE' ? null : p.funcao, como].filter(Boolean).join(' · ') + (p.ativo === false ? ' · saiu' : ''))),
          P.UI.icone('avancar')),
        corpoC, p.obs ? h('small', { class: 'eq-obs' }, p.obs) : null,
        p.ativo === false ? null : acoes);
    }
    function desenhar() {
      corpo.innerHTML = '';
      const mudaMes = n => { const [y, m] = mes.split('-').map(Number); const d = new Date(y, m - 1 + n, 1); mes = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0'); desenhar(); };
      corpo.appendChild(h('div', { class: 'lc-dia' },
        h('button', { type: 'button', class: 'pn-nav', 'aria-label': 'Mês anterior', onClick: () => mudaMes(-1) }, P.UI.icone('voltar')),
        h('div', { class: 'lc-dia-t' }, P.Dia.rotuloMes(mes)),
        h('button', { type: 'button', class: 'pn-nav', 'aria-label': 'Próximo mês', disabled: mes >= P.Dia.mes(P.Dia.hoje()), onClick: () => mudaMes(1) }, P.UI.icone('avancar'))));
      const ps = pessoas().filter(p => p.ativo !== false || pagamentosDe(p.id).some(d => mesDe(d) === mes));
      // total do mês pela data em que foi pago (o caixa); cada cartão mostra a conta pela competência
      const pagos = P.Store.all('despesas').filter(d => (d.categoria === 'FUNCIONARIOS' || d.categoria === 'PROLABORE') && d.dia_operacional.slice(0, 7) === mes);
      const totEquipe = soma(pagos.filter(d => d.categoria === 'FUNCIONARIOS')), totDono = soma(pagos.filter(d => d.categoria === 'PROLABORE'));
      corpo.appendChild(h('div', { class: 'fx-resumo' },
        h('div', { class: 'fx-tot' }, h('small', null, 'Pago à equipe em ' + P.Dia.rotuloMes(mes) + ' (pela data do pagamento)'), h('b', null, P.brl(totEquipe))),
        h('div', { class: 'fx-formas' }, h('span', { class: 'fx-f' }, 'Pró-labore retirado ', h('b', null, P.brl(totDono))))));
      if (!ps.length) corpo.appendChild(P.UI.vazio('Ninguém cadastrado. Cadastre quem trabalha (e você, para o pró-labore) e lance vales, condução e salários por aqui.', 'usuario'));
      ps.forEach(p => corpo.appendChild(cartao(p)));
      const semPessoa = pagos.filter(d => !d.pessoa_id);
      if (semPessoa.length) corpo.appendChild(h('div', { class: 'dica' }, semPessoa.length + (semPessoa.length === 1 ? ' pagamento' : ' pagamentos') + ' de funcionário neste mês sem pessoa ligada (' + P.brl(soma(semPessoa)) + '). Toque na despesa (Mesas → Despesas) e escolha quem.'));
      corpo.appendChild(h('button', { type: 'button', class: 'btn bloco', onClick: () => editarPessoa().then(desenhar) }, P.UI.icone('mais'), 'Pessoa'));
    }
    view.append(corpo);
    desenhar();
    return { onDados(t) { if (t.has('pessoas') || t.has('despesas')) desenhar(); } };
  }

  // ---------------------------------------------------------------
  //  TELA: UMA PESSOA (pagamentos)
  // ---------------------------------------------------------------
  function telaPessoa(view, params) {
    view.className = 'v-mesas v-equipe';
    const corpo = h('div');
    function desenhar() {
      corpo.innerHTML = '';
      const p = P.Store.get('pessoas', params.id);
      if (!p) { corpo.appendChild(P.UI.vazio('Pessoa não encontrada.')); return; }
      const ds = pagamentosDe(p.id);
      corpo.appendChild(h('div', { class: 'rs-cab' },
        h('div', { class: 'rs-tit' }, p.nome),
        h('div', { class: 'rs-sub' }, [p.funcao, NOME_COMO[p.pagamento] + (+p.valor > 0 ? ' ' + P.brl(p.valor) : ''), +p.conducao_dia > 0 ? 'condução ' + P.brl(p.conducao_dia) + '/dia' : null,
          p.inicio ? 'desde ' + P.Dia.rotuloCurto(p.inicio) : null].filter(Boolean).join(' · ')),
        h('div', { class: 'rs-total' }, P.brl(soma(ds))), h('small', { class: 'rs-sub' }, 'pago no total (' + ds.length + (ds.length === 1 ? ' pagamento)' : ' pagamentos)')),
        p.obs ? h('div', { class: 'rs-obs' }, p.obs) : null,
        h('div', { class: 'row gap' }, h('button', { type: 'button', class: 'btn grow', onClick: () => editarPessoa(p).then(desenhar) }, P.UI.icone('lapis'), 'Editar'))));
      if (!ds.length) { corpo.appendChild(P.UI.vazio('Nenhum pagamento lançado para ' + p.nome + '.')); return; }
      corpo.appendChild(h('div', { class: 'secao' }, 'Pagamentos'));
      corpo.appendChild(h('div', { class: 'ms-lista' }, ds.map(d => h('button', { type: 'button', class: 'ms-card', onClick: () => P.Mesas.novaDespesa(d.dia_operacional, null, d).then(desenhar) },
        h('div', { class: 'ms-card-n' }, (d.subtipo ? P.Mesas.NOME_SUBTIPO[d.subtipo] : P.Mesas.NOME_DESP[d.categoria]) + (d.descricao ? ' · ' + d.descricao : ''),
          h('small', null, P.Dia.rotulo(d.dia_operacional) + (d.competencia ? ' · conta para ' + P.Mesas.rotuloCompetencia(d.competencia) : '') + (d.forma ? ' · ' + (P.Mesas.NOME_FORMA_DESP[d.forma] || d.forma) : ''))),
        h('b', null, P.brl(d.valor))))));
    }
    view.append(h('a', { class: 'voltar', href: '#/equipe' }, P.UI.icone('voltar'), 'Equipe'), corpo);
    desenhar();
    return { onDados(t) { if (t.has('pessoas') || t.has('despesas')) desenhar(); } };
  }

  P.UI.rota('equipe', { titulo: 'Equipe', tab: 'mais', dono: true, render: telaEquipe });
  P.UI.rota('equipe/:id', { titulo: 'Equipe', tab: 'mais', dono: true, render: telaPessoa });
  P.Equipe = { pessoas, pagamentosDe, contaMes, semanas, editarPessoa, NOME_COMO };
})();
