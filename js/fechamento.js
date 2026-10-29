/* FECHAR CAIXA — no fim do dia, informe o dinheiro que ficou no bolso, o Pix que entrou na conta
   e o total da maquininha; o app confere com o que registrou no dia:
   - Dinheiro: troco do início + vendas e fiado recebidos em dinheiro − compras e despesas pagas
     em dinheiro = o que deveria ter no bolso. O que ficou no bolso vira o troco do dia seguinte.
   - Pix: vendas e fiado recebidos no Pix = o que deveria ter entrado na conta (o que saiu no Pix
     aparece à parte, não entra nesta conta).
   - Cartão: débito + crédito das vendas (e do fiado) = o total da maquininha.
   Cada fechamento fica guardado por dia (config 'caixa_fechamentos'), com quem fechou e o que
   foi informado; a conta é refeita ao vivo se algo for lançado depois. Todos fecham; o que é só
   do dono (salário, retirada…) entra na conta sem mostrar o que é.
   Sobra (o total informado passou do que deveria ter) entra como venda no Painel e em Dia e
   período, sempre à parte ("sobra do caixa"); falta fica só no aviso. */
(function () {
  'use strict';
  const P = window.P;
  const h = P.UI.h;
  const CHAVE = 'caixa_fechamentos';
  const FORMAS = [
    { v: 'dinheiro', rotulo: 'Dinheiro', ic: 'dinheiro' },
    { v: 'pix', rotulo: 'Pix', ic: 'pix' },
    { v: 'cartao', rotulo: 'Cartão', ic: 'cartao' },
  ];
  // forma de pagamento de uma saída (compra ou despesa) → de onde o dinheiro saiu
  const ORIGEM = { DINHEIRO: 'dinheiro', PIX: 'pix', CARTAO: 'conta', DEBITO: 'conta', BOLETO: 'conta', CREDITO: 'fatura' };
  const quase = v => Math.abs(v) < 0.005;

  const fechamentos = () => P.cfg(CHAVE);
  const fechamento = dia => fechamentos()[dia] || null;
  // troco do início: o que ficou no bolso no último fechamento antes deste dia (sem o dinheiro
  // informado, o troco daquele dia). Devolve { valor, dia } (dia: de qual fechamento veio)
  function trocoAnterior(dia) {
    const f = fechamentos();
    const ant = Object.keys(f).filter(d => d < dia).sort().pop();
    if (!ant) return { valor: 0, dia: null };
    return { valor: f[ant].dinheiro != null ? +f[ant].dinheiro || 0 : +f[ant].troco || 0, dia: ant };
  }

  // ---------------------------------------------------------------
  //  O que o app registrou no dia
  // ---------------------------------------------------------------
  function conta(dia) {
    const vendas = { DINHEIRO: 0, PIX: 0, DEBITO: 0, CREDITO: 0, FIADO: 0 };
    const fiado = { DINHEIRO: 0, PIX: 0, DEBITO: 0, CREDITO: 0 };
    let nContas = 0;
    P.Store.all('comandas').forEach(c => {
      if (c.status !== 'FECHADA' || c.dia_operacional !== dia) return;
      nContas++;
      P.Mesas.pagamentos(c.id).forEach(p => { if (p.forma in vendas) vendas[p.forma] += +p.valor || 0; });
    });
    // conta ainda aberta com parte já paga (ex.: um da mesa pagou e foi embora): o dinheiro já entrou
    let parcial = 0;
    P.Store.all('pagamentos').forEach(p => {
      if (p.forma === 'FIADO' && p.recebido_em && p.recebido_dia === dia && p.recebido_forma in fiado) fiado[p.recebido_forma] += +p.valor || 0;
      if (p.forma === 'FIADO' || p.dia_operacional !== dia || !(p.forma in vendas)) return;
      const c = P.Store.get('comandas', p.comanda_id);
      if (c && c.status === 'ABERTA') { vendas[p.forma] += +p.valor || 0; parcial += +p.valor || 0; }
    });
    // saídas pagas no dia: compras (inclusive a prazo e fatura pagas hoje) e despesas
    const saidas = [];
    P.Store.all('compras').forEach(c => P.Compras.saidas(c).forEach(s => {
      if (s.dia === dia) saidas.push({ nome: c.fornecedor || 'Compra', sub: 'compra', valor: s.valor, origem: ORIGEM[s.forma] || 'sem', href: '#/compras/c/' + c.id });
    }));
    P.Store.all('despesas').forEach(d => {
      if (d.dia_operacional !== dia) return;
      const ver = P.Mesas.despVisivel(d);
      saidas.push({ nome: ver ? d.descricao || P.Mesas.NOME_DESP[d.categoria] : 'Pagamento do dono', sub: ver ? P.Mesas.NOME_DESP[d.categoria].toLowerCase() : 'despesa', valor: +d.valor || 0, origem: ORIGEM[d.forma] || 'sem' });
    });
    const soma = o => saidas.filter(s => s.origem === o).reduce((t, s) => t + s.valor, 0);
    const abertas = P.Mesas.totaisDoDia(dia, 'TODOS');
    return {
      vendas, fiado, nContas, saidas, abertas, parcial,
      saiDinheiro: soma('dinheiro'), saiPix: soma('pix'), saiSem: soma('sem'),
      entDinheiro: vendas.DINHEIRO + fiado.DINHEIRO,
      entPix: vendas.PIX + fiado.PIX,
      entCartao: vendas.DEBITO + vendas.CREDITO + fiado.DEBITO + fiado.CREDITO,
    };
  }
  function esperado(k, troco) {
    return {
      dinheiro: P.round((+troco || 0) + k.entDinheiro - k.saiDinheiro, 2),
      pix: P.round(k.entPix, 2),
      cartao: P.round(k.entCartao, 2),
    };
  }
  // diferença de cada forma informada (informado − esperado): + sobrou, − faltou
  function diferencas(f, k) {
    const e = esperado(k, f.troco);
    const out = {};
    FORMAS.forEach(x => { if (f[x.v] != null) out[x.v] = P.round(f[x.v] - e[x.v], 2); });
    return out;
  }
  // sobra do caixa de um dia: quanto o total informado (dinheiro + Pix + maquininha) passou do que
  // deveria ter. Refeita ao vivo: se a venda que faltava for lançada depois, a sobra diminui.
  function sobra(dia) {
    const f = fechamento(dia);
    if (!f) return 0;
    const d = diferencas(f, conta(dia));
    const tot = P.round(Object.keys(d).reduce((s, x) => s + d[x], 0), 2);
    return tot > 0.005 ? tot : 0;
  }
  // soma das sobras de um conjunto de dias: { v, n } (n: dias com sobra)
  function sobraDe(dias) {
    const f = fechamentos();
    let v = 0, n = 0;
    dias.forEach(d => { if (!f[d]) return; const s = sobra(d); if (s > 0) { v += s; n++; } });
    return { v: P.round(v, 2), n };
  }
  // o que foi lançado ou mudado no dia depois de fechar o caixa (ex.: o peixeiro pago antes de contar o
  // dinheiro, mas lançado depois). A sobra é refeita ao vivo; aqui fica o antes e o agora para mostrar:
  // { antes, agora, itens: ['Peixeiro R$ 120,00', …] } ou null se nada mudou
  function depois(dia) {
    const f = fechamento(dia);
    if (!f || !f.esperado || !f.em) return null;
    const e = esperado(conta(dia), f.troco);
    let antes = 0, agora = 0;
    FORMAS.forEach(x => { if (f[x.v] != null) { antes += f[x.v] - (+f.esperado[x.v] || 0); agora += f[x.v] - e[x.v]; } });
    antes = P.round(antes, 2); agora = P.round(agora, 2);
    if (quase(agora - antes)) return null;
    const novo = r => (r.modificado_em || '') > f.em;
    const itens = [];
    P.Store.all('compras').forEach(c => {
      if (!novo(c)) return;
      const v = P.Compras.saidas(c).filter(s => s.dia === dia).reduce((t, s) => t + s.valor, 0);
      if (v > 0.005) itens.push((c.fornecedor || 'Compra') + ' ' + P.brl(v));
    });
    P.Store.all('despesas').forEach(d => { if (d.dia_operacional === dia && novo(d)) itens.push((d.descricao || P.Mesas.NOME_DESP[d.categoria] || 'Despesa') + ' ' + P.brl(d.valor)); });
    P.Store.all('comandas').forEach(c => { if (c.dia_operacional === dia && c.status === 'FECHADA' && novo(c)) itens.push('venda ' + P.Mesas.rotulo(c) + ' ' + P.brl(c.total)); });
    return { antes, agora, itens };
  }
  // frase para o Painel e o Fechar caixa
  function textoDepois(x) {
    const sa = v => (quase(v) ? 'batia' : v > 0 ? 'sobravam ' + P.brl(v) : 'faltavam ' + P.brl(-v));
    const sb = v => (quase(v) ? 'bate' : v > 0 ? 'sobram ' + P.brl(v) : 'faltam ' + P.brl(-v));
    return 'Lançado depois do fechamento' + (x.itens.length ? ': ' + x.itens.slice(0, 4).join(', ') + (x.itens.length > 4 ? '…' : '') : '') +
      '. A conta do caixa foi refeita: no fechamento ' + sa(x.antes) + ', agora ' + sb(x.agora) + '. ' +
      'Se o dinheiro foi contado depois de pagar, o resultado do dia não muda (a saída e a sobra mudam juntas).';
  }
  function textoDif(v) {
    return quase(v) ? 'bateu' : (v > 0 ? 'sobrou ' : 'faltou ') + P.brl(Math.abs(v));
  }
  // resumo de um fechamento: "bateu" ou "faltou R$ 20,00 no dinheiro · sobrou R$ 5,00 no Pix"
  function resultado(dia) {
    const f = fechamento(dia);
    if (!f) return null;
    const d = diferencas(f, conta(dia));
    const fora = FORMAS.filter(x => d[x.v] != null && !quase(d[x.v]));
    return {
      bateu: !fora.length,
      texto: fora.length ? fora.map(x => textoDif(d[x.v]) + (x.v === 'dinheiro' ? ' no dinheiro' : x.v === 'pix' ? ' no Pix' : ' no cartão')).join(' · ') : 'bateu',
      f,
    };
  }

  // ---------------------------------------------------------------
  //  TELA
  // ---------------------------------------------------------------
  function telaCaixa(view) {
    view.className = 'v-mesas v-fechar';
    let dia = P.Dia.hoje();
    let v = null; // o que foi informado na tela (troco, dinheiro, pix, cartao, obs)
    function carregar() {
      const f = fechamento(dia);
      v = f ? { troco: +f.troco || 0, dinheiro: f.dinheiro, pix: f.pix, cartao: f.cartao, obs: f.obs || '' }
        : { troco: trocoAnterior(dia).valor, dinheiro: null, pix: null, cartao: null, obs: '' };
    }
    carregar();
    const corpo = h('div');
    const obs = h('textarea', { class: 'campo fc-obs', rows: 2, placeholder: 'Observação (opcional): ex.: R$ 20 de troco dado a mais' });
    obs.addEventListener('input', () => { v.obs = obs.value; });

    async function pedir(campo, titulo) {
      const n = await P.UI.pedirNumero({ titulo, valor: v[campo], decimais: 2, prefixo: 'R$ ', maxInteiros: 6 });
      if (n == null) return;
      v[campo] = n;
      desenhar();
    }
    const linha = (rot, val, cls) => h('div', { class: 'eq-l' + (cls ? ' ' + cls : '') }, h('span', null, rot), h('b', null, val));
    const sinal = (s, n) => (s === '−' ? '− ' : '+ ') + P.brl(n);
    function resultadoLinha(inf, esp) {
      if (inf == null) return null;
      const d = P.round(inf - esp, 2);
      return h('div', { class: 'fc-res ' + (quase(d) ? 'ok' : d > 0 ? 'sobra' : 'falta') },
        P.UI.icone(quase(d) ? 'check' : 'alerta'), h('b', null, quase(d) ? 'Bateu' : (d > 0 ? 'Sobrou ' : 'Faltou ') + P.brl(Math.abs(d))));
    }
    function cartao(x, titulo, linhas, esp, rotInf, rotPedir) {
      const inf = v[x.v];
      return h('section', { class: 'eq-card fc-card' },
        h('div', { class: 'eq-top' },
          h('span', { class: 'avatar fc-ic' }, P.UI.icone(x.ic)),
          h('div', { class: 'eq-nome' }, h('b', null, titulo), h('small', null, 'deveria ter ' + P.brl(esp)))),
        linhas.filter(Boolean),
        linha('= Deveria ter', P.brl(esp), 'fc-esp'),
        h('button', { type: 'button', class: 'btn valor bloco fc-inf' + (inf == null ? ' fc-sem' : ''), onClick: () => pedir(x.v, rotPedir) },
          h('span', null, rotInf), h('b', null, inf == null ? 'informar' : P.brl(inf))),
        resultadoLinha(inf, esp));
    }

    function desenhar() {
      const k = conta(dia);
      const e = esperado(k, v.troco);
      const f = fechamento(dia);
      corpo.innerHTML = '';
      corpo.appendChild(P.Mesas.navDia(dia, d => { dia = d; carregar(); desenhar(); }));
      if (f) {
        const r = resultado(dia);
        corpo.appendChild(h('div', { class: 'banner ' + (r.bateu ? 'ok' : 'aviso') }, P.UI.icone(r.bateu ? 'check' : 'alerta'),
          h('span', { class: 'banner-t' }, 'Caixa fechado ' + (f.em ? 'às ' + P.Dia.hora(f.em) + ' ' : '') + (f.por ? 'por ' + f.por : '') + ' · ' + r.texto)));
      }
      if (k.abertas.nAbertas) {
        corpo.appendChild(h('a', { class: 'banner aviso', href: '#/mesas' }, P.UI.icone('alerta'),
          h('span', { class: 'banner-t' }, k.abertas.nAbertas + (k.abertas.nAbertas === 1 ? ' conta ainda aberta' : ' contas ainda abertas') + ' (' + P.brl(k.abertas.aberto) + '): feche antes de conferir o caixa' +
            (k.parcial ? ' (o ' + P.brl(k.parcial) + ' já pago nelas já está na conta abaixo)' : '')),
          h('span', { class: 'banner-a' }, 'Ver')));
      }
      corpo.appendChild(h('div', { class: 'an-base' }, k.nContas + (k.nContas === 1 ? ' conta fechada' : ' contas fechadas') + ' em ' + P.Dia.rotulo(dia) +
        '. Informe o que você contou; o app compara com as vendas, o fiado recebido e o que foi pago no dia.'));

      // dinheiro: troco + entrou − saiu
      const saiuDin = k.saidas.filter(s => s.origem === 'dinheiro');
      const ant = trocoAnterior(dia);
      corpo.appendChild(cartao(FORMAS[0], 'Dinheiro no bolso', [
        h('button', { type: 'button', class: 'eq-l fc-troco', onClick: () => pedir('troco', 'Troco no início do dia (dinheiro no bolso)') },
          h('span', null, 'Troco no início ', P.UI.icone('lapis')), h('b', null, P.brl(v.troco))),
        !f && ant.dia && quase(v.troco - ant.valor) ? h('small', { class: 'fc-nota' }, 'O que ficou no bolso no fechamento de ' + P.Dia.rotulo(ant.dia) + '.') : null,
        linha('Vendas em dinheiro', sinal('+', k.vendas.DINHEIRO)),
        k.fiado.DINHEIRO ? linha('Fiado recebido em dinheiro', sinal('+', k.fiado.DINHEIRO)) : null,
        linha('Pago em dinheiro (compras e despesas)', sinal('−', k.saiDinheiro)),
        saiuDin.length ? h('details', { class: 'fc-det' }, h('summary', null, 'O que saiu em dinheiro (' + saiuDin.length + ')'),
          saiuDin.map(s => h(s.href ? 'a' : 'div', { class: 'fc-sai', href: s.href || null }, h('span', null, s.nome, h('small', null, ' · ' + s.sub)), h('b', null, P.brl(s.valor))))) : null,
      ], e.dinheiro, 'Ficou no bolso', 'Quanto ficou no bolso (dinheiro contado)'));

      corpo.appendChild(cartao(FORMAS[1], 'Pix', [
        linha('Vendas no Pix', sinal('+', k.vendas.PIX)),
        k.fiado.PIX ? linha('Fiado recebido no Pix', sinal('+', k.fiado.PIX)) : null,
        k.saiPix ? h('small', { class: 'fc-nota' }, 'Saiu no Pix ' + P.brl(k.saiPix) + ' (compras e despesas): não entra nesta conta, é só o que entrou.') : null,
      ], e.pix, 'Entrou na conta (Pix)', 'Pix que entrou na conta no dia'));

      corpo.appendChild(cartao(FORMAS[2], 'Cartão (maquininha)', [
        linha('Vendas no débito', sinal('+', k.vendas.DEBITO)),
        linha('Vendas no crédito', sinal('+', k.vendas.CREDITO)),
        k.fiado.DEBITO + k.fiado.CREDITO ? linha('Fiado recebido no cartão', sinal('+', k.fiado.DEBITO + k.fiado.CREDITO)) : null,
      ], e.cartao, 'Total da maquininha', 'Total da maquininha (débito + crédito)'));

      // resumo
      const inf = FORMAS.filter(x => v[x.v] != null);
      if (inf.length) {
        const totInf = inf.reduce((s, x) => s + v[x.v], 0);
        const totEsp = inf.reduce((s, x) => s + e[x.v], 0);
        corpo.appendChild(h('div', { class: 'secao' }, 'Resumo'));
        const sb = P.round(totInf - totEsp, 2);
        corpo.appendChild(h('section', { class: 'eq-card' },
          linha('Informado (' + inf.map(x => x.rotulo.toLowerCase()).join(', ') + ')', P.brl(totInf)),
          linha('Deveria ter', P.brl(totEsp)),
          resultadoLinha(totInf, totEsp),
          sb > 0.005 ? h('small', { class: 'fc-nota' }, 'A sobra de ' + P.brl(sb) + ' entra como venda no Painel e em Dia e período, à parte ("sobra do caixa").') : null,
          f && depois(dia) ? h('small', { class: 'fc-nota fc-depois' }, textoDepois(depois(dia))) : null,
          v.dinheiro != null ? h('small', { class: 'fc-nota' }, 'Os ' + P.brl(v.dinheiro) + ' que ficaram no bolso viram o troco do início do próximo dia.') : null));
      }
      if (k.vendas.FIADO) corpo.appendChild(h('div', { class: 'dica' }, 'Vendido no fiado hoje: ' + P.brl(k.vendas.FIADO) + ' (não entra no caixa até receber).'));
      if (k.saiSem) corpo.appendChild(h('div', { class: 'banner aviso' }, P.UI.icone('alerta'), h('span', { class: 'banner-t' }, P.brl(k.saiSem) + ' em despesas sem a forma de pagamento: se foram pagas em dinheiro, o bolso tem isso a menos. Corrija em Despesas.')));

      obs.value = v.obs || '';
      corpo.appendChild(obs);
      corpo.appendChild(h('button', { type: 'button', class: 'btn primario bloco', disabled: !inf.length, onClick: fechar },
        P.UI.icone('check'), (f ? 'Salvar de novo o caixa de ' : 'Fechar o caixa de ') + (dia === P.Dia.hoje() ? 'hoje' : P.Dia.rotulo(dia))));
      if (!inf.length) corpo.appendChild(h('div', { class: 'dica' }, 'Informe pelo menos um valor (dinheiro, Pix ou maquininha) para fechar.'));
    }
    function fechar() {
      const k = conta(dia);
      const u = P.Auth.usuario();
      const todos = Object.assign({}, fechamentos());
      const antes = todos[dia] || null;
      todos[dia] = {
        troco: P.round(v.troco, 2), dinheiro: v.dinheiro, pix: v.pix, cartao: v.cartao, obs: (v.obs || '').trim() || null,
        esperado: esperado(k, v.troco), por: u ? u.nome : null, por_id: u ? u.id : null, em: P.agoraISO(),
      };
      P.salvarCfg(CHAVE, todos);
      P.vibrar([20, 40, 20]);
      const r = resultado(dia);
      P.UI.toast('Caixa fechado · ' + r.texto, { tipo: r.bateu ? '' : 'perigo', ms: 4500, acao: { rotulo: 'Desfazer', fn: () => {
        const t = Object.assign({}, fechamentos());
        if (antes) t[dia] = antes; else delete t[dia];
        P.salvarCfg(CHAVE, t);
      } } });
    }
    view.append(P.Mesas.subnavMesas('caixa'), corpo);
    desenhar();
    return {
      onDados(t) {
        if (['comandas', 'pagamentos', 'despesas', 'compras', 'config'].some(x => t.has(x))) desenhar();
      },
    };
  }

  P.UI.rota('mesas/caixa', { titulo: 'Fechar caixa', tab: 'mesas', render: telaCaixa });
  P.Fechamento = { conta, esperado, fechamento, resultado, sobra, sobraDe, depois, textoDepois };
})();
