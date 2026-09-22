/* ETAPA 6 — PAINEL DO DONO: "o negócio deu lucro hoje?"
   Três cards (dia · semana · mês), um número grande em cada, um semáforo.
   Tudo automático: vendas vêm das COMANDAS (mesas, balcão, marmita), o custo do
   que foi vendido das fichas técnicas (com o preço das últimas compras), a
   mercadoria comprada de COMPRAS e os demais gastos de DESPESAS.
     resultado = vendas − custo do vendido − despesas − custo fixo rateado
     caixa     = recebido (fora fiado) − compras pagas − despesas */
(function () {
  'use strict';
  const P = window.P;
  const h = P.UI.h;
  const CANAIS = ['ESPETO', 'SALAO', 'MARMITA'];
  const NOME_CANAL = { ESPETO: 'Espeto', SALAO: 'Salão', MARMITA: 'Marmita' };

  const cfg = chave => P.cfg(chave);
  function fixoMensal() {
    const c = cfg('custos_fixos');
    return (+c.aluguel || 0) + (+c.folha || 0) + (+c.prolabore_inss || 0) + (+c.outros || 0);
  }
  const diasMes = () => +cfg('operacao').dias_mes || 26;

  // ---------------------------------------------------------------
  //  Agregação de um conjunto de dias operacionais
  // ---------------------------------------------------------------
  function agregar(dias) {
    const set = new Set(dias);
    const I = P.Calc.idx();
    const r = {
      fat: 0, cmv: 0, desconto: 0, mercadoria: 0, compras: 0, nCompras: 0, outras: 0, espetos: 0, comandas: 0,
      entrou: 0, saiu: 0, dias: new Set(), canal: {},
    };
    CANAIS.forEach(c => { r.canal[c] = { fat: 0, cmv: 0, bebidas: 0, pratos: 0, itens: 0, comandas: 0, comBebida: 0 }; });
    function soma(canal, itemId, q, preco, cmvU) {
      const c = r.canal[canal] || r.canal.SALAO;
      const fat = q * preco, cmv = q * cmvU;
      c.fat += fat; c.cmv += cmv; c.itens += q;
      r.fat += fat; r.cmv += cmv;
      const it = I.itens.get(itemId);
      const cat = it && it.categoria;
      if (cat === 'BEBIDA') c.bebidas += q;
      if (cat === 'PRATO') c.pratos += q;
      r.espetos += q * P.Calc.espetosPorUnidade(itemId);
      return cat;
    }
    P.Store.all('comandas').forEach(cm => {
      if (cm.status !== 'FECHADA' || !set.has(cm.dia_operacional)) return;
      const k = r.canal[cm.canal] ? cm.canal : 'SALAO';
      let temBebida = false;
      P.Mesas.linhas(cm.id).forEach(l => {
        if (soma(k, l.item_id, +l.quantidade || 0, +l.preco_unit || 0, +l.cmv_unit || 0) === 'BEBIDA') temBebida = true;
      });
      const d = +cm.desconto || 0;
      r.fat -= d; r.canal[k].fat -= d; r.desconto += d;
      r.canal[k].comandas++;
      if (temBebida) r.canal[k].comBebida++;
      r.comandas++;
      r.dias.add(cm.dia_operacional);
    });
    P.Store.all('despesas').forEach(d => {
      if (!set.has(d.dia_operacional)) return;
      if (d.categoria === 'MERCADORIA') r.mercadoria += +d.valor || 0; else r.outras += +d.valor || 0;
      r.saiu += +d.valor || 0;
    });
    P.Store.all('compras').forEach(c => {
      if (set.has(c.dia_operacional)) { r.compras += +c.total || 0; r.nCompras++; }
      if (c.pago_em && set.has(c.pago_dia)) r.saiu += +c.total || 0;
    });
    r.mercadoria += r.compras;
    P.Store.all('pagamentos').forEach(p => {
      if (p.forma !== 'FIADO' && set.has(p.dia_operacional)) r.entrou += +p.valor || 0;
      if (p.forma === 'FIADO' && p.recebido_em && set.has(p.recebido_dia)) r.entrou += +p.valor || 0;
    });
    // anexação de bebida: contas com bebida ÷ total de contas, por canal
    r.anexacao = {};
    CANAIS.forEach(k => {
      const c = r.canal[k];
      r.anexacao[k] = c.comandas > 0 ? c.comBebida / c.comandas * 100 : null;
    });
    return r;
  }
  // Resultado de um dia, ao vivo (painel, compras, mesas)
  function resultadoDia(dia) {
    const r = agregar([dia]);
    const fixo = fixoMensal() / diasMes();
    return {
      fat: r.fat, cmv: r.cmv, outras: r.outras, fixo, compras: r.compras, entrou: r.entrou, saiu: r.saiu, ag: r,
      resultado: r.fat - r.cmv - r.outras - fixo,
      temMovimento: r.dias.size > 0 || r.compras > 0 || r.outras > 0,
    };
  }

  // ---------------------------------------------------------------
  //  PAINEL (dono) — cabe numa tela de celular, sem rolar.
  //  Um número principal por card, um selo de status (ícone + texto),
  //  um gráfico pequeno de apoio. Canais em ordem fixa: salão → espeto → marmita.
  // ---------------------------------------------------------------
  function subnavPainel(ativo) {
    return P.UI.subnav([{ id: 'painel', rota: 'painel', rotulo: 'Painel' }, { id: 'relatorio', rota: 'relatorio', rotulo: 'Relatório detalhado' }], ativo);
  }
  const ST = { verde: 'bom', amarelo: 'atencao', vermelho: 'critico', cinza: 'neutro' };
  function telaPainel(view) {
    view.className = 'v-painel';
    let dia = P.Dia.hoje();
    const wrap = h('div', { class: 'pn' });

    const mini = (rot, val, cor, extra) => h('div', { class: 'pn-mini' }, h('small', null, rot), h('b', { class: cor ? 't-' + cor : null }, val, extra ? h('em', null, extra) : null));
    const valorCor = (v, cor) => h('b', { class: cor ? 't-' + cor : null }, v);
    const corMax = (v, max) => (v == null ? null : v <= max ? 'verde' : v <= max * 1.08 ? 'amarelo' : 'vermelho');
    const corMin = (v, min) => (v == null ? null : v >= min ? 'verde' : v >= min * 0.85 ? 'amarelo' : 'vermelho');
    const numero = (valor, fmt, neg) => P.UI.contar(h('div', { class: 'pn-num' + (neg ? ' neg' : '') }), valor, fmt);
    const pctFmt = v => P.num(v, 0) + '%';
    const centroPct = (frac, sub) => [h('b', null, Math.max(0, Math.round((frac || 0) * 100)) + '%'), h('small', null, sub)];
    const mil = v => 'R$ ' + (Math.abs(v) >= 1000 ? P.num(v / 1000, 1).replace(/,0$/, '') + ' mil' : Math.round(v).toLocaleString('pt-BR'));

    function cab(titulo, sub, st, rotSt, navegar) {
      return h('div', { class: 'pn-cab' },
        navegar ? h('button', { type: 'button', class: 'pn-nav', 'aria-label': 'Dia anterior', onClick: () => { dia = P.Dia.anterior(dia); desenhar(); } }, P.UI.icone('voltar')) : null,
        h('div', { class: 'pn-tit' }, h('span', null, titulo), h('small', null, sub)),
        navegar ? h('button', { type: 'button', class: 'pn-nav', 'aria-label': 'Próximo dia', disabled: dia >= P.Dia.hoje(), onClick: () => { dia = P.Dia.seguinte(dia); desenhar(); } }, P.UI.icone('avancar')) : null,
        P.UI.statusPill(st, rotSt));
    }

    function desenhar() {
      wrap.innerHTML = '';
      const metas = cfg('metas');
      const D = diasMes();
      const fixoM = fixoMensal();
      const fixoDia = fixoM / D;
      const metaMes = +metas.lucro_mensal || 0;
      const metaDia = metaMes / D;
      const hoje = P.Dia.hoje();

      // ---------- DIA ----------
      const res = resultadoDia(dia);
      const rd = res.ag;
      const lucroDia = res.resultado;
      const semDia = !res.temMovimento ? 'cinza' : lucroDia >= metaDia ? 'verde' : lucroDia >= 0 ? 'amarelo' : 'vermelho';
      const dif = lucroDia - metaDia;
      const saldoCx = res.entrou - res.saiu;
      const fracDia = metaDia > 0 ? lucroDia / metaDia : 0;
      wrap.appendChild(h('section', { class: 'pn-card pn-dia s-' + semDia },
        cab(dia === hoje ? 'Hoje' : P.Dia.nomeSemana(dia), P.Dia.rotuloCurto(dia) + (dia === hoje ? ' · ao vivo' : ''), ST[semDia],
          { verde: 'meta batida', amarelo: 'no azul', vermelho: 'no vermelho', cinza: 'sem movimento' }[semDia], true),
        res.temMovimento ? [
          h('div', { class: 'pn-hero' },
            h('div', { class: 'pn-hero-l' },
              h('div', { class: 'pn-rot' }, lucroDia >= 0 ? 'Lucro do dia' : 'Prejuízo do dia'),
              numero(lucroDia, P.brl0, lucroDia < 0),
              h('div', { class: 'pn-meta' }, dif >= 0
                ? ['meta de ' + P.brl0(metaDia) + ' · ', valorCor('+' + P.brl0(dif), 'verde')]
                : ['faltam ', h('b', null, P.brl0(-dif)), ' para a meta de ' + P.brl0(metaDia)])),
            P.UI.anel(fracDia, ST[semDia], centroPct(fracDia, 'da meta'), 'Lucro do dia: ' + Math.round(Math.max(0, fracDia) * 100) + '% da meta diária')),
          P.UI.pilha([
            { rotulo: 'Salão', valor: rd.canal.SALAO.fat, serie: 'salao' },
            { rotulo: 'Espeto', valor: rd.canal.ESPETO.fat, serie: 'espeto' },
            { rotulo: 'Marmita', valor: rd.canal.MARMITA.fat, serie: 'marmita' }], P.brl0),
          h('div', { class: 'pn-linha' },
            mini('Vendas', P.brl0(rd.fat)),
            mini('Custo vendido', P.brl0(rd.cmv), null, P.pct(rd.fat ? rd.cmv / rd.fat * 100 : null, 0)),
            mini('Desp. + fixo', P.brl0(res.outras + res.fixo))),
          h('a', { class: 'pn-caixa', href: '#/compras' }, P.UI.icone('caixa'),
            h('span', null, 'Caixa ', h('b', null, P.brl0(res.entrou)), ' entrou · ', h('b', null, P.brl0(res.saiu)), ' saiu'),
            valorCor(P.brl0(saldoCx), saldoCx >= 0 ? 'verde' : 'vermelho')),
        ] : h('div', { class: 'pn-vazio' }, h('span', null, 'Nada lançado neste dia.'), h('a', { href: '#/mesas', class: 'btn mini primario' }, 'Abrir mesas'))));

      // ---------- SEMANA (6 dias operacionais = 1 semana do mercado) ----------
      const diasSem = P.Dia.ultimos(6, dia);
      const rs = agregar(diasSem);
      const nS = rs.dias.size;
      const folhaDia = (+cfg('custos_fixos').folha || 0) / D;
      const cmvBase = rs.mercadoria > 0 ? rs.mercadoria : rs.cmv;
      const prime = rs.fat > 0 ? (cmvBase + folhaDia * nS) / rs.fat * 100 : null;
      const fcFicha = rs.fat > 0 ? rs.cmv / rs.fat * 100 : null;
      const fcReal = rs.fat > 0 && rs.mercadoria > 0 ? rs.mercadoria / rs.fat * 100 : null;
      const semS = nS ? corMax(prime, +metas.prime_cost_max) : 'cinza';
      const porDia = diasSem.slice().reverse().map(d => {
        const a = agregar([d]);
        const mov = a.dias.size > 0 || a.outras > 0;
        return { rotulo: P.Dia.rotulo(d), curto: P.Dia.nomeSemana(d), atual: d === dia, valor: mov ? a.fat - a.cmv - a.outras - fixoDia : null };
      });
      wrap.appendChild(h('section', { class: 'pn-card s-' + semS },
        cab('Semana', nS + '/' + diasSem.length + ' dias', ST[semS],
          { verde: 'custo sob controle', amarelo: 'no limite', vermelho: 'custo alto', cinza: 'sem vendas' }[semS]),
        nS ? [
          h('div', { class: 'pn-hero' },
            h('div', { class: 'pn-hero-l' },
              h('div', { class: 'pn-rot' }, 'Prime cost'),
              numero(prime, pctFmt),
              h('div', { class: 'pn-meta' }, 'CMV' + (rs.mercadoria > 0 ? ' real' : ' ficha') + ' + folha · meta ≤ ' + metas.prime_cost_max + '%')),
            h('div', { class: 'pn-spark' }, h('small', null, 'Lucro por dia'),
              P.UI.colunas(porDia, P.brl0, { aria: 'Lucro por dia na semana: ' + porDia.map(p => p.curto + ' ' + (p.valor == null ? 'sem movimento' : P.brl0(p.valor))).join(', ') }))),
          h('div', { class: 'pn-linha pn-vol' },
            mini('Espetos/dia', P.num(rs.espetos / nS, 0), corMin(rs.espetos / nS, +metas.espeto_empate_dia)),
            mini('Pratos/dia', P.num(rs.canal.SALAO.pratos / nS, 0)),
            mini('Marmitas/dia', P.num(rs.canal.MARMITA.pratos / nS, 0))),
          h('div', { class: 'pn-txt' }, 'Food cost · ficha ', valorCor(P.pct(fcFicha, 0), corMax(fcFicha, +metas.food_cost_max)),
            ' · real ', fcReal == null ? h('b', null, 'sem compras') : valorCor(P.pct(fcReal, 0), corMax(fcReal, +metas.food_cost_max)),
            fcReal != null && fcFicha != null ? [' · perda oculta ', valorCor((fcReal - fcFicha >= 0 ? '+' : '') + P.num(fcReal - fcFicha, 0) + ' pts', fcReal - fcFicha > 3 ? 'vermelho' : 'verde')] : null),
          h('div', { class: 'pn-txt' }, 'Bebida junto · espeto ',
            valorCor(P.pct(rs.anexacao.ESPETO, 0), corMin(rs.anexacao.ESPETO, +metas.anexacao_espeto)), ' · salão ',
            valorCor(P.pct(rs.anexacao.SALAO, 0), corMin(rs.anexacao.SALAO, +metas.anexacao_salao)), ' · marmita ',
            valorCor(P.pct(rs.anexacao.MARMITA, 0), corMin(rs.anexacao.MARMITA, +metas.anexacao_marmita))),
        ] : h('div', { class: 'pn-vazio' }, h('span', null, 'Nenhum dia com venda nesta semana.'))));

      // ---------- MÊS ----------
      const mes = P.Dia.mes(dia);
      const rm = agregar(P.Dia.doMes(mes, dia));
      const nM = rm.dias.size;
      const lucroM = rm.fat - rm.cmv - rm.outras - fixoDia * nM;
      const projFat = nM ? rm.fat / nM * D : 0;
      const projLucro = nM ? (rm.fat - rm.cmv - rm.outras) / nM * D - fixoM : 0;
      const margem = rm.fat > 0 ? lucroM / rm.fat * 100 : null;
      const semM = !nM ? 'cinza' : projLucro >= metaMes ? 'verde' : projLucro >= 0 ? 'amarelo' : 'vermelho';
      const fracMes = metaMes > 0 ? projLucro / metaMes : 0;
      wrap.appendChild(h('section', { class: 'pn-card s-' + semM },
        cab(P.Dia.rotuloMes(mes), nM + '/' + D + ' dias', ST[semM],
          { verde: 'meta à vista', amarelo: 'abaixo da meta', vermelho: 'projeção negativa', cinza: 'sem vendas' }[semM]),
        nM ? [
          h('div', { class: 'pn-hero' },
            h('div', { class: 'pn-hero-l' },
              h('div', { class: 'pn-rot' }, lucroM >= 0 ? 'Lucro acumulado' : 'Prejuízo acumulado'),
              numero(lucroM, P.brl0, lucroM < 0),
              h('div', { class: 'pn-meta' }, 'projeção ', valorCor(P.brl0(projLucro), projLucro >= 0 ? 'verde' : 'vermelho'), ' · meta ' + mil(metaMes))),
            P.UI.anel(fracMes, ST[semM], centroPct(fracMes, 'projetado'), 'Projeção do mês: ' + Math.round(Math.max(0, fracMes) * 100) + '% da meta')),
          h('div', { class: 'pn-linha' },
            mini('Faturamento', P.brl0(rm.fat)),
            mini('Projeção fat.', P.brl0(projFat)),
            mini('Margem líq.', P.pct(margem, 1), margem == null ? null : margem >= 0 ? 'verde' : 'vermelho')),
          escada(rm.espetos / nM),
        ] : h('div', { class: 'pn-vazio' }, h('span', null, 'Nenhum dia com venda neste mês.'))));
    }

    function escada(media) {
      const deg = (cfg('escada_espetos').degraus || []).slice().sort((a, b) => a.espetos - b.espetos);
      if (!deg.length) return null;
      const max = deg[deg.length - 1].espetos * 1.1;
      let atual = null, prox = null;
      deg.forEach(d => { if (media >= d.espetos) atual = d; else if (!prox) prox = d; });
      const txt = d => (d.lucro > 0 ? 'R$ ' + (d.lucro % 1000 === 0 ? d.lucro / 1000 + ' mil' : d.lucro.toLocaleString('pt-BR')) + '/mês' : 'empata');
      const st = !atual ? 'critico' : atual.lucro > 0 ? 'bom' : 'atencao';
      return h('div', { class: 'pn-escada' },
        h('div', { class: 'pn-esc-t' }, h('b', null, P.num(media, 0) + ' espetos/dia'), ' · ', atual ? txt(atual) : 'abaixo do empate',
          prox ? ' · próx. ' + prox.espetos + ' → ' + txt(prox) : ' · topo da escada'),
        P.UI.medidor(media / max, st, deg.map(d => d.espetos / max)));
    }

    view.append(wrap);
    desenhar();
    if (P.Sync.configurado()) P.Sync.agendar(0);
    return { onDados: desenhar };
  }

  // ---------------------------------------------------------------
  //  AJUSTES
  // ---------------------------------------------------------------
  function pedirTexto(titulo, valor, placeholder) {
    return new Promise(resolve => {
      let feito = false;
      const inp = h('input', { class: 'campo', type: 'text', value: valor || '', placeholder: placeholder || '', autocomplete: 'off' });
      const ok = () => { feito = true; resolve(inp.value.trim()); sh.fechar(); };
      inp.addEventListener('keydown', e => { if (e.key === 'Enter') ok(); });
      const sh = P.UI.sheet(h('div', { class: 'np-sheet' }, inp,
        h('div', { class: 'row gap' },
          h('button', { type: 'button', class: 'btn', onClick: () => sh.fechar() }, 'Cancelar'),
          h('button', { type: 'button', class: 'btn primario grow', onClick: ok }, 'Continuar'))),
      { titulo, onFechar: () => { if (!feito) resolve(null); } });
      setTimeout(() => inp.focus(), 60);
    });
  }
  async function pedirPinConfirmado(titulo) {
    const a = await P.Auth.pedirPin(titulo);
    if (!a) return null;
    const b = await P.Auth.pedirPin('Confirme o PIN');
    if (!b) return null;
    if (a !== b) { P.UI.toast('Os PINs não conferem.', { tipo: 'perigo' }); return null; }
    return a;
  }

  function telaAjustes(view) {
    view.className = 'v-ajustes';
    const corpo = h('div');
    const secao = (t, ...kids) => h('section', { class: 'aj-sec' }, h('div', { class: 'aj-tit' }, t), kids);
    const linha = (rot, val, onClick, sub) => h(onClick ? 'button' : 'div', { type: onClick ? 'button' : null, class: 'aj-lin' + (onClick ? ' toque' : ''), onClick },
      h('span', { class: 'aj-rot' }, rot, sub ? h('small', null, sub) : null), h('b', { class: 'aj-val' }, val), onClick ? P.UI.icone('lapis') : null);

    function editar(chave, campo, o) {
      return async () => {
        const atual = cfg(chave);
        const v = await P.UI.pedirNumero(Object.assign({ valor: atual[campo] }, o));
        if (v == null) return;
        atual[campo] = v;
        P.salvarCfg(chave, atual);
        P.vibrar(15);
        desenhar();
      };
    }

    function desenhar() {
      corpo.innerHTML = '';
      const u = P.Auth.usuario();
      if (!u) return;
      const dono = P.Auth.isDono();

      corpo.appendChild(secao('Conta',
        linha(u.nome, u.papel === 'DONO' ? 'Dono' : 'Operador'),
        h('div', { class: 'aj-lin' }, h('span', { class: 'aj-rot' }, 'Tema'),
          P.UI.seg([{ v: 'dark', rotulo: 'Escuro' }, { v: 'light', rotulo: 'Claro' }], P.UI.tema(), v => {
            P.UI.tema(v);
            const b = document.getElementById('top-tema');
            if (b) b.replaceChildren(P.UI.icone(v === 'dark' ? 'sol' : 'lua'));
          }, 'seg-p')),
        h('button', { type: 'button', class: 'btn bloco', onClick: () => P.Auth.sair() }, P.UI.icone('sair'), 'Trocar usuário / bloquear')));

      const n = P.Store.pendentes();
      let st;
      if (!P.Sync.configurado()) {
        st = [h('div', { class: 'aj-info' }, 'Os dados estão guardados só neste aparelho (funciona 100% offline). Para juntar vários aparelhos, a nuvem (Supabase) precisa ser configurada — veja o LEIAME.')];
      } else if (!P.Sync.conectado()) {
        st = [
          h('div', { class: 'aj-info' }, 'Este aparelho ainda não está conectado à nuvem. Conecte para os dados aparecerem nos outros aparelhos (e os deles aqui). ' +
            (n ? n + ' registros deste aparelho serão enviados.' : '')),
          h('button', { type: 'button', class: 'btn primario bloco', onClick: async () => { if (await P.Auth.conectarNuvem()) desenhar(); } }, P.UI.icone('nuvem'), 'Conectar à nuvem'),
        ];
      } else {
        st = [
          linha('Conectado como', P.Sync.email() || '—'),
          linha('Situação', { online: 'online', offline: 'sem internet', sincronizando: 'sincronizando…', erro: 'erro', login: 'desconectado', local: '—' }[P.Sync.estado] || P.Sync.estado),
          linha('Pendentes de envio', String(n)),
          linha('Última sincronização', P.Sync.ultimoSync ? P.Dia.hora(P.Sync.ultimoSync) : '—'),
          P.Sync.ultimoErro ? h('div', { class: 'aj-erro' }, P.Sync.ultimoErro) : null,
          h('button', { type: 'button', class: 'btn bloco', onClick: async () => { const ok = await P.Sync.rodar(); P.UI.toast(ok ? 'Sincronizado' : 'Não deu agora — os dados continuam salvos no aparelho', { tipo: ok ? '' : 'perigo' }); desenhar(); } }, P.UI.icone('refresh'), 'Sincronizar agora'),
          dono ? h('button', { type: 'button', class: 'btn perigo bloco', onClick: async () => {
            if (!(await P.UI.confirmar('Desconectar este aparelho da nuvem? Os dados continuam aqui, mas param de sincronizar até conectar de novo.' + (n ? ' Há ' + n + ' registros ainda não enviados.' : ''), { ok: 'Desconectar', perigo: true }))) return;
            P.Sync.sair();
            desenhar();
          } }, 'Desconectar este aparelho') : null,
        ];
      }
      corpo.appendChild(secao('Sincronização', st, P.Store.persistente ? null : h('div', { class: 'aj-erro' }, 'Este navegador não permitiu guardar dados (modo anônimo?). Nada será mantido ao fechar.')));

      if (!dono) return;

      const cf = cfg('custos_fixos');
      const money = { decimais: 2, prefixo: 'R$ ' };
      corpo.appendChild(secao('Custos fixos mensais',
        linha('Aluguel', P.brl(cf.aluguel), editar('custos_fixos', 'aluguel', Object.assign({ titulo: 'Aluguel' }, money))),
        linha('Folha', P.brl(cf.folha), editar('custos_fixos', 'folha', Object.assign({ titulo: 'Folha de pagamento' }, money))),
        linha('Pró-labore + INSS', P.brl(cf.prolabore_inss), editar('custos_fixos', 'prolabore_inss', Object.assign({ titulo: 'Pró-labore + INSS' }, money))),
        linha('Outros fixos', P.brl(cf.outros), editar('custos_fixos', 'outros', Object.assign({ titulo: 'Outros custos fixos' }, money))),
        linha('Total por mês', P.brl(fixoMensal())),
        linha('Dias operacionais no mês', String(diasMes()), editar('operacao', 'dias_mes', { titulo: 'Dias operacionais no mês', decimais: 0, maxInteiros: 2 }), 'custo fixo por dia: ' + P.brl(fixoMensal() / diasMes()))));

      const m = cfg('metas');
      const pct = t => ({ titulo: t, decimais: 1, sufixo: '%', maxInteiros: 3 });
      corpo.appendChild(secao('Metas',
        linha('Meta de lucro no mês', P.brl(m.lucro_mensal), editar('metas', 'lucro_mensal', Object.assign({ titulo: 'Meta de lucro no mês' }, money)), 'por dia: ' + P.brl((+m.lucro_mensal || 0) / diasMes())),
        linha('Espetos/dia para empatar', String(m.espeto_empate_dia), editar('metas', 'espeto_empate_dia', { titulo: 'Espetos por dia para empatar', decimais: 0 })),
        linha('Anexação de bebida — espeto', P.pct(m.anexacao_espeto, 0), editar('metas', 'anexacao_espeto', pct('Anexação — turno espeto'))),
        linha('Anexação de bebida — salão', P.pct(m.anexacao_salao, 0), editar('metas', 'anexacao_salao', pct('Anexação — almoço salão'))),
        linha('Anexação de bebida — marmita', P.pct(m.anexacao_marmita, 0), editar('metas', 'anexacao_marmita', pct('Anexação — marmita'))),
        linha('Food cost máximo', P.pct(m.food_cost_max, 0), editar('metas', 'food_cost_max', pct('Food cost máximo'))),
        linha('Prime cost máximo', P.pct(m.prime_cost_max, 0), editar('metas', 'prime_cost_max', pct('Prime cost máximo'))),
        linha('Perda de espeto máxima', P.pct(m.perda_espeto_max, 0), editar('metas', 'perda_espeto_max', pct('Perda de espeto máxima')), 'usada quando existir o módulo Espetos')));

      const degraus = (cfg('escada_espetos').degraus || []).slice();
      corpo.appendChild(secao('Escada de espetos/dia',
        degraus.map((d, i) => linha(d.espetos + ' espetos/dia', d.lucro > 0 ? P.brl0(d.lucro) + '/mês' : 'empata', async () => {
          const e = await P.UI.pedirNumero({ titulo: 'Espetos por dia (degrau ' + (i + 1) + ')', valor: d.espetos, decimais: 0 });
          if (e == null) return;
          const l = await P.UI.pedirNumero({ titulo: 'Lucro no mês com ' + e + ' espetos/dia', valor: d.lucro, decimais: 0, prefixo: 'R$ ', sub: '0 = empata' });
          if (l == null) return;
          degraus[i] = { espetos: e, lucro: l };
          P.salvarCfg('escada_espetos', { degraus });
          desenhar();
        }))));

      const t = cfg('turnos');
      const hora = t2 => ({ titulo: t2, decimais: 0, maxInteiros: 2, sufixo: 'h' });
      corpo.appendChild(secao('Salão e turnos',
        linha('Mesas no salão', String(P.cfg('mesas').quantidade), editar('mesas', 'quantidade', { titulo: 'Quantas mesas?', decimais: 0, maxInteiros: 2 })),
        linha('Espeto começa', t.espeto_ini + 'h', editar('turnos', 'espeto_ini', hora('Turno espeto — começa às'))),
        linha('Espeto termina', t.espeto_fim + 'h', editar('turnos', 'espeto_fim', hora('Turno espeto — termina às')), 'comanda aberta nesse horário entra como Espeto'),
        linha('Almoço começa', t.almoco_ini + 'h', editar('turnos', 'almoco_ini', hora('Almoço — começa às'))),
        linha('Almoço termina', t.almoco_fim + 'h', editar('turnos', 'almoco_fim', hora('Almoço — termina às')))));

      const fi = P.Calc.cfgFichas();
      corpo.appendChild(secao('Fichas técnicas',
        linha('Semáforo verde até', P.pct(fi.verde_ate, 0), editar('fichas', 'verde_ate', pct('Verde até (food cost)'))),
        linha('Vermelho acima de', P.pct(fi.vermelho_acima, 0), editar('fichas', 'vermelho_acima', pct('Vermelho acima de'))),
        linha('Perda operacional padrão', P.pct(fi.perda_padrao, 1), editar('fichas', 'perda_padrao', pct('Perda operacional padrão'))),
        linha('Aviso de preço velho', fi.dias_preco_velho + ' dias', editar('fichas', 'dias_preco_velho', { titulo: 'Avisar preço com mais de (dias)', decimais: 0 }))));

      const us = P.Store.all('usuarios').sort((a, b) => (a.papel === b.papel ? a.nome.localeCompare(b.nome, 'pt-BR') : a.papel === 'DONO' ? -1 : 1));
      corpo.appendChild(secao('Pessoas e PINs',
        us.map(x => h('div', { class: 'aj-lin' },
          h('span', { class: 'aj-rot' }, x.nome, h('small', null, x.papel === 'DONO' ? 'Dono — vê tudo' : 'Operador — só telas de registro')),
          h('button', { type: 'button', class: 'btn mini', onClick: async () => {
            const pin = await pedirPinConfirmado('Novo PIN de ' + x.nome);
            if (!pin) return;
            try { P.Auth.trocarPin(x.id, pin); P.UI.toast('PIN trocado'); } catch (e) { P.UI.toast(e.message, { tipo: 'perigo' }); }
          } }, 'PIN'),
          x.id !== u.id ? h('button', { type: 'button', class: 'btn mini perigo', 'aria-label': 'Remover', onClick: async () => {
            if (!(await P.UI.confirmar('Remover ' + x.nome + '? O PIN deixa de funcionar.', { ok: 'Remover', perigo: true }))) return;
            try { P.Auth.removerUsuario(x.id); desenhar(); } catch (e) { P.UI.toast(e.message, { tipo: 'perigo' }); }
          } }, P.UI.icone('lixo')) : null)),
        h('div', { class: 'row gap' },
          h('button', { type: 'button', class: 'btn grow', onClick: () => novaPessoa('OPERADOR') }, P.UI.icone('mais'), 'Operador'),
          h('button', { type: 'button', class: 'btn grow', onClick: () => novaPessoa('DONO') }, P.UI.icone('mais'), 'Dono'))));

      corpo.appendChild(secao('Alertas',
        !P.Alertas.suportado() ? h('div', { class: 'aj-info' }, 'Este navegador não mostra notificações. Os alertas aparecem dentro do app.')
          : P.Alertas.permitido() ? linha('Notificação de food cost acima de ' + fi.vermelho_acima + '%', 'ativada')
            : h('button', { type: 'button', class: 'btn bloco', onClick: async () => { const ok = await P.Alertas.pedir(); P.UI.toast(ok ? 'Alertas ativados' : 'O navegador não permitiu'); desenhar(); } }, P.UI.icone('sino'), 'Ativar notificações de food cost')));

      const arquivo = h('input', { type: 'file', accept: 'application/json,.json', style: { display: 'none' } });
      arquivo.addEventListener('change', async () => {
        const f = arquivo.files && arquivo.files[0];
        if (!f) return;
        try {
          const obj = JSON.parse(await f.text());
          if (!obj || obj.app !== 'pari-restaurante') throw new Error('Arquivo não é um backup deste app.');
          const n2 = P.Store.importar(obj);
          P.UI.toast(n2 + ' registros restaurados');
          desenhar();
        } catch (e) { P.UI.toast('Não consegui ler: ' + e.message, { tipo: 'perigo' }); }
        arquivo.value = '';
      });
      corpo.appendChild(secao('Backup',
        h('div', { class: 'aj-info' }, 'Guarde uma cópia de tudo (principalmente se não estiver usando o Supabase).'),
        h('div', { class: 'row gap' },
          h('button', { type: 'button', class: 'btn grow', onClick: () => {
            P.UI.baixar('pari-backup-' + P.Dia.hoje() + '.json', JSON.stringify(P.Store.exportar()), 'application/json');
          } }, P.UI.icone('download'), 'Exportar'),
          h('button', { type: 'button', class: 'btn grow', onClick: () => arquivo.click() }, P.UI.icone('upload'), 'Importar')),
        arquivo));

      corpo.appendChild(h('div', { class: 'aj-rodape' },
        'Dia operacional atual: ' + P.Dia.rotulo(P.Dia.hoje()) + ' (vira às 03:00; domingo conta como segunda) · v' + P.VERSAO));
    }

    async function novaPessoa(papel) {
      const nome = await pedirTexto(papel === 'DONO' ? 'Nome do dono' : 'Nome do operador', '', papel === 'DONO' ? 'Ex.: Sócio' : 'Ex.: Auxiliar do espeto');
      if (nome == null) return;
      const pin = await pedirPinConfirmado('PIN de ' + (nome || 'nova pessoa'));
      if (!pin) return;
      try { P.Auth.criarUsuario({ nome, pin, papel }); P.UI.toast('Cadastrado'); desenhar(); } catch (e) { P.UI.toast(e.message, { tipo: 'perigo' }); }
    }

    view.append(corpo);
    desenhar();
    const off = P.on('sync', () => { if (!document.querySelector('.sheet-back')) desenhar(); });
    return { cleanup: off };
  }

  P.UI.rota('painel', { titulo: 'Painel', tab: 'painel', dono: true, render: telaPainel, acao: { icone: 'relatorio', href: '#/relatorio', rotulo: 'Relatório' } });
  P.UI.rota('ajustes', { titulo: 'Ajustes', tab: 'mais', render: telaAjustes });

  P.Painel = { agregar, resultadoDia, fixoMensal, diasMes, subnavPainel, CANAIS, NOME_CANAL };
})();
