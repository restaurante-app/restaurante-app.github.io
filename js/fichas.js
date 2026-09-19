/* ETAPA 2 — FICHAS: ficha técnica com preço vivo.
   Painel de margem · Atualização de preço (um por vez) · Simulação · Cadastro. */
(function () {
  'use strict';
  const P = window.P;
  const h = P.UI.h;
  const CAT = { ESPETO: 'Espeto', PRATO: 'Prato', BEBIDA: 'Bebida', GUARNICAO: 'Guarnição' };
  const CATS = ['ESPETO', 'PRATO', 'BEBIDA', 'GUARNICAO'];

  // ---------------------------------------------------------------
  //  Utilidades
  // ---------------------------------------------------------------
  const precoFmt = v => (P.round(v, 2) !== P.round(v, 3) ? 'R$ ' + P.num(v, 3) : P.brl(v));
  const precoUnit = ins => precoFmt(ins.preco) + '/' + ins.unidade;
  function haDias(ins) {
    const d = P.Dia.diasDesde(ins.atualizado_em);
    return d === Infinity ? 'sem data' : d <= 0 ? 'hoje' : d === 1 ? 'há 1 dia' : 'há ' + d + ' dias';
  }
  const dot = faixa => h('span', { class: 'dot ' + faixa });
  function subnavFichas(ativo) {
    if (!P.Auth.isDono()) return null;
    const velhos = P.Store.all('insumos').filter(P.Calc.precoVelho).length;
    return P.UI.subnav([
      { id: 'margem', rota: 'fichas', rotulo: 'Margem' },
      { id: 'precos', rota: 'precos', rotulo: 'Preços', badge: velhos || null },
      { id: 'simular', rota: 'fichas/simular', rotulo: 'Simular' },
      { id: 'cadastro', rota: 'fichas/cadastro', rotulo: 'Cadastro' },
    ], ativo);
  }
  function banner(tipo, texto, acao, href) {
    return h(href ? 'a' : 'div', { class: 'banner ' + tipo, href: href || null },
      P.UI.icone(tipo === 'ok' ? 'check' : 'alerta'), h('span', { class: 'banner-t' }, texto), acao ? h('span', { class: 'banner-a' }, acao) : null);
  }
  function voltar(href, rotulo) {
    return h('a', { class: 'voltar', href }, P.UI.icone('voltar'), rotulo || 'Voltar');
  }
  const passoDe = l => (l.tipo === 'item' ? 0.5 : l.un === 'un' ? 1 : 5);

  // ---------------------------------------------------------------
  //  Alertas (notificação do sistema, se o dono permitir)
  // ---------------------------------------------------------------
  const Alertas = P.Alertas = {
    suportado: () => 'Notification' in window,
    permitido: () => 'Notification' in window && Notification.permission === 'granted',
    async pedir() {
      if (!('Notification' in window)) return false;
      try { return (await Notification.requestPermission()) === 'granted'; } catch (e) { return false; }
    },
    notificar(titulo, corpo) {
      if (!Alertas.permitido()) return;
      const o = { body: corpo, icon: 'icons/icon-192.png', badge: 'icons/icon-192.png', tag: 'pari-' + Date.now() };
      const semSW = () => { try { new Notification(titulo, o); } catch (e) { /* ok */ } };
      if (navigator.serviceWorker) {
        navigator.serviceWorker.getRegistration().then(r => (r ? r.showNotification(titulo, o) : semSW())).catch(semSW);
      } else semSW();
    },
  };

  // Salva preço (ou só confirma que continua o mesmo) e mede o efeito nas fichas
  function aplicarPreco(ins, novo, soConfirma) {
    const antes = P.Calc.snapshot();
    const agora = P.agoraISO();
    const mudou = !soConfirma && P.round(novo, 4) !== P.round(ins.preco, 4);
    P.Store.put('insumos', Object.assign({}, ins, { preco: mudou ? novo : ins.preco, atualizado_em: agora }));
    if (mudou) P.Store.put('historico_precos', { id: P.uuid(), insumo_id: ins.id, preco: novo, data: agora });
    const r = medirEfeito(antes);
    return Object.assign(r, { ins, de: ins.preco, para: mudou ? novo : ins.preco, mudou });
  }
  function medirEfeito(antes) {
    const lim = P.Calc.cfgFichas().vermelho_acima;
    const difs = P.Calc.diferencas(antes, P.Calc.snapshot());
    const cruzaram = difs.filter(d => (d.de == null || d.de <= lim) && d.para > lim);
    if (cruzaram.length) {
      Alertas.notificar('Food cost acima de ' + lim + '%',
        cruzaram.map(d => d.nome + ': ' + P.pct(d.de, 0) + ' → ' + P.pct(d.para, 0)).join('\n'));
    }
    return { difs, cruzaram, mudaramFaixa: difs.filter(d => d.mudouFaixa) };
  }
  function frasesEfeito(r) {
    const out = [];
    r.mudaramFaixa.forEach(d => out.push(h('div', { class: 'efeito f-' + d.faixaPara },
      dot(d.faixaPara), h('span', null, h('b', null, d.nome), ' saiu de ' + P.pct(d.de, 0) + ' para ' + P.pct(d.para, 0)))));
    if (!r.mudaramFaixa.length) {
      out.push(h('div', { class: 'efeito neutro' }, r.difs.length
        ? 'Nenhum item mudou de faixa · ' + r.difs.length + (r.difs.length === 1 ? ' item afetado' : ' itens afetados') +
          ' (maior: ' + r.difs[0].nome + ' ' + P.pct(r.difs[0].de, 1) + ' → ' + P.pct(r.difs[0].para, 1) + ')'
        : 'Nenhum item mudou de faixa.'));
    }
    return out;
  }

  // ---------------------------------------------------------------
  //  PAINEL DE MARGEM (dono)
  // ---------------------------------------------------------------
  function telaMargem(view) {
    view.className = 'v-fichas';
    let cat = 'TODOS';
    const corpo = h('div');
    function desenhar() {
      corpo.innerHTML = '';
      const cfg = P.Calc.cfgFichas();
      const itens = P.Store.all('itens');
      const vend = itens.filter(P.Calc.vendavel).map(it => P.Calc.ficha(it)).sort((a, b) => b.fc - a.fc);
      const comps = itens.filter(it => it.ativo !== false && !(+it.preco_venda > 0)).map(it => P.Calc.ficha(it));
      const velhos = P.Store.all('insumos').filter(P.Calc.precoVelho);
      if (velhos.length) {
        corpo.appendChild(banner('aviso', velhos.length + (velhos.length === 1 ? ' insumo com preço' : ' insumos com preço') +
          ' de mais de ' + cfg.dias_preco_velho + ' dias', 'Atualizar', '#/precos'));
      }
      const vermelhos = vend.filter(f => f.faixa === 'vermelho');
      if (vermelhos.length) {
        corpo.appendChild(banner('perigo', vermelhos.length + (vermelhos.length === 1 ? ' item' : ' itens') + ' acima de ' + cfg.vermelho_acima + '% de food cost'));
      }
      const cont = { verde: 0, amarelo: 0, vermelho: 0 };
      vend.forEach(f => { cont[f.faixa] = (cont[f.faixa] || 0) + 1; });
      const ST_F = { verde: 'bom', amarelo: 'atencao', vermelho: 'critico' };
      const semaf = (faixa, ic, rot) => h('div', { class: 'semaf-c st-' + ST_F[faixa] },
        h('span', { class: 'semaf-t' }, P.UI.icone(ic), rot), h('b', null, cont[faixa]), h('small', null, cont[faixa] === 1 ? 'item' : 'itens'));
      corpo.appendChild(h('div', { class: 'semaf' },
        semaf('verde', 'check', 'até ' + cfg.verde_ate + '%'),
        semaf('amarelo', 'alerta', cfg.verde_ate + '–' + cfg.vermelho_acima + '%'),
        semaf('vermelho', 'alerta', 'acima de ' + cfg.vermelho_acima + '%')));
      corpo.appendChild(P.UI.seg([
        { v: 'TODOS', rotulo: 'Todos' }, { v: 'ESPETO', rotulo: 'Espetos' }, { v: 'PRATO', rotulo: 'Pratos' }, { v: 'BEBIDA', rotulo: 'Bebidas' },
      ], cat, v => { cat = v; desenhar(); }, 'seg-p'));
      const lista = h('div', { class: 'mg-lista' });
      // medidor de food cost em escala 0–60%, com marcas nos limites do semáforo
      const ESC = 60;
      vend.filter(f => cat === 'TODOS' || f.item.categoria === cat).forEach(f => lista.appendChild(
        h('a', { href: '#/fichas/item/' + f.item.id, class: 'mg-lin f-' + f.faixa, 'aria-label': f.item.nome + ': food cost ' + P.pct(f.fc) + ', margem ' + P.brl(f.margem) },
          h('div', { class: 'mg-nome' }, f.item.nome, h('small', null, CAT[f.item.categoria] || '')),
          h('div', { class: 'mg-fc' }, P.pct(f.fc), h('small', null, 'food cost')),
          P.UI.medidor(f.fc / ESC, ST_F[f.faixa] || 'neutro', [cfg.verde_ate / ESC, cfg.vermelho_acima / ESC]),
          h('div', { class: 'mg-det' },
            h('span', null, 'CMV ', h('b', null, P.brl(f.cmv))),
            h('span', null, 'Preço ', h('b', null, P.brl(f.preco))),
            h('span', null, 'Margem ', h('b', null, P.brl(f.margem)))))));
      if (!lista.children.length) lista.appendChild(P.UI.vazio('Nenhum item nesta categoria.'));
      corpo.appendChild(lista);
      if (comps.length && cat === 'TODOS') {
        corpo.appendChild(h('div', { class: 'secao' }, 'Componentes (sem preço de venda)'));
        const l2 = h('div', { class: 'mg-lista' });
        comps.forEach(f => l2.appendChild(h('a', { href: '#/fichas/item/' + f.item.id, class: 'mg-lin comp' },
          h('div', { class: 'mg-nome' }, f.item.nome),
          h('div', { class: 'mg-fc' }, P.brl(f.bruto)),
          h('div', { class: 'mg-det' }, h('span', null, 'custo por porção, entra em outros itens')))));
        corpo.appendChild(l2);
      }
    }
    view.append(subnavFichas('margem'), corpo);
    desenhar();
    return { onDados: desenhar };
  }

  // ---------------------------------------------------------------
  //  FICHA DETALHADA
  // ---------------------------------------------------------------
  function telaItem(view, params) {
    view.className = 'v-fichas';
    const corpo = h('div');
    function desenhar() {
      corpo.innerHTML = '';
      const it = P.Store.get('itens', params.id);
      if (!it) { corpo.appendChild(P.UI.vazio('Item não encontrado.')); return; }
      const f = P.Calc.ficha(it);
      const L = P.Calc.linhas(P.Calc.componentesDe(it.id));
      const vend = P.Calc.vendavel(it);
      corpo.appendChild(h('div', { class: 'fd-topo f-' + f.faixa },
        h('div', { class: 'fd-cat' }, CAT[it.categoria] || it.categoria, it.ativo === false ? ' · inativo' : ''),
        h('div', { class: 'fd-nome' }, it.nome),
        vend ? h('div', { class: 'fd-grande' }, dot(f.faixa), h('span', null, P.pct(f.fc)), h('small', null, 'food cost')) : h('div', { class: 'fd-grande neutro' }, h('span', null, P.brl(f.bruto)), h('small', null, 'custo por porção')),
        h('div', { class: 'fd-nums' },
          h('div', null, h('small', null, 'CMV'), h('b', null, P.brl(f.cmv))),
          h('div', null, h('small', null, 'Preço'), h('b', null, vend ? P.brl(f.preco) : '—')),
          h('div', null, h('small', null, 'Margem'), h('b', null, vend ? P.brl(f.margem) : '—')))));

      const tab = h('div', { class: 'fd-comps' });
      L.forEach(l => {
        tab.appendChild(h(l.tipo === 'item' && l.ref ? 'a' : 'div', { class: 'fd-c', href: l.tipo === 'item' && l.ref ? '#/fichas/item/' + l.ref.id : null },
          h('div', { class: 'fd-cn' }, l.nome,
            h('small', null, l.tipo === 'insumo' && l.ref
              ? precoUnit(l.ref) + (+l.ref.fator_correcao !== 1 ? ' · fator ' + P.num(l.ref.fator_correcao, 2) : '')
              : 'item pronto · custo sem perda')),
          h('div', { class: 'fd-cq' }, P.numAuto(l.qtd) + ' ' + l.un),
          h('div', { class: 'fd-cv' }, P.brl(l.custo))));
      });
      if (!L.length) tab.appendChild(P.UI.vazio('Sem componentes. Toque em Editar ficha.'));
      corpo.appendChild(h('div', { class: 'secao' }, 'Componentes'));
      corpo.appendChild(tab);
      corpo.appendChild(h('div', { class: 'fd-tot' },
        h('div', null, h('span', null, 'Soma dos componentes'), h('b', null, P.brl(f.bruto))),
        h('div', null, h('span', null, 'Perda operacional ' + P.num(f.perda, 1) + '%'), h('b', null, '+ ' + P.brl(f.cmv - f.bruto))),
        h('div', { class: 'fd-tot-cmv' }, h('span', null, 'CMV'), h('b', null, P.brl(f.cmv)))));

      const usos = P.Calc.usosDoItem(it.id);
      if (usos.length) {
        corpo.appendChild(h('div', { class: 'secao' }, 'Usado dentro de'));
        corpo.appendChild(h('div', { class: 'chips' }, usos.map(u => h('a', { class: 'chip', href: '#/fichas/item/' + u.id }, u.nome))));
      }
      corpo.appendChild(h('div', { class: 'row gap acoes' },
        vend ? h('a', { class: 'btn grow', href: '#/fichas/simular/' + it.id }, 'Simular') : null,
        h('a', { class: 'btn primario grow', href: '#/fichas/editar/' + it.id }, P.UI.icone('lapis'), 'Editar ficha')));
    }
    view.append(voltar('#/fichas', 'Margem'), corpo);
    desenhar();
    return { onDados: desenhar };
  }

  // ---------------------------------------------------------------
  //  ATUALIZAÇÃO DE PREÇO (a mais usada — um insumo por vez)
  // ---------------------------------------------------------------
  function filaPrecos() {
    return P.Store.all('insumos')
      .sort((a, b) => ((Date.parse(a.atualizado_em) || 0) - (Date.parse(b.atualizado_em) || 0)) || a.nome.localeCompare(b.nome, 'pt-BR'))
      .map(i => i.id);
  }
  function telaPrecos(view, params) {
    view.className = 'v-precos';
    const fila = filaPrecos();
    let pos = 0;
    // escolhido entra agora; depois segue pelos preços mais antigos
    function colocarNaVez(id) {
      const i = fila.indexOf(id);
      if (i < 0) return;
      fila.splice(i, 1);
      fila.splice(pos, 0, id);
    }
    if (params.id) colocarNaVez(params.id);
    const feitos = [];
    let ultimo = null;

    const elResultado = h('div', { class: 'pr-res' });
    const elCard = h('div', { class: 'pr-card' });
    const elDisp = h('div', { class: 'pr-disp' });
    const np = P.UI.numpad({ decimais: 3, maxInteiros: 4, onChange: mostrarDisp, onEnter: () => { if (np.buf()) salvar(false); } });
    const btnMesmo = h('button', { type: 'button', class: 'btn pr-mesmo', onClick: () => salvar(true) }, P.UI.icone('check'), 'Mesmo preço');
    const btnSalvar = h('button', { type: 'button', class: 'btn primario pr-salvar', onClick: () => salvar(false) }, 'Salvar e próximo', P.UI.icone('avancar'));
    const area = h('div', { class: 'pr-area' }, elCard, elDisp, np.el, h('div', { class: 'pr-botoes' }, btnMesmo, btnSalvar));
    const elFim = h('div', { class: 'pr-fim' });

    function atual() { return pos < fila.length ? P.Store.get('insumos', fila[pos]) : null; }
    function mostrarDisp() {
      const ins = atual();
      const b = np.buf();
      elDisp.classList.toggle('vazio', !b);
      elDisp.textContent = b ? 'R$ ' + b : (ins ? precoFmt(ins.preco) : '');
      btnSalvar.disabled = !b;
    }
    function desenhar() {
      const ins = atual();
      elResultado.innerHTML = '';
      if (ultimo) {
        elResultado.classList.toggle('alerta', ultimo.cruzaram.length > 0);
        elResultado.appendChild(h('div', { class: 'pr-res-tit' },
          h('b', null, ultimo.ins.nome), ': ',
          ultimo.mudou ? precoFmt(ultimo.de) + ' → ' + precoFmt(ultimo.para) : 'preço confirmado (' + precoFmt(ultimo.para) + ')'));
        if (ultimo.mudou) frasesEfeito(ultimo).forEach(n => elResultado.appendChild(n));
      }
      elResultado.hidden = !ultimo;
      if (!ins) {
        area.hidden = true;
        elFim.hidden = false;
        elFim.replaceChildren(
          h('div', { class: 'pr-fim-ic' }, P.UI.icone('check')),
          h('div', { class: 'pr-fim-t' }, feitos.length ? 'Pronto! ' + feitos.length + (feitos.length === 1 ? ' insumo conferido.' : ' insumos conferidos.') : 'Nenhum insumo cadastrado.'),
          feitos.some(f => f.mudaramFaixa.length) ? h('div', { class: 'pr-fim-lista' },
            h('div', { class: 'secao' }, 'Itens que mudaram de faixa'),
            feitos.flatMap(f => frasesEfeito({ mudaramFaixa: f.mudaramFaixa, difs: f.difs }).filter(() => f.mudaramFaixa.length))) : null,
          h('button', { type: 'button', class: 'btn bloco', onClick: () => { if (location.hash === '#/precos') P.UI.render(); else location.hash = '#/precos'; } }, P.UI.icone('refresh'), 'Recomeçar pelos mais antigos'));
        return;
      }
      area.hidden = false;
      elFim.hidden = true;
      const velho = P.Calc.precoVelho(ins);
      const usos = P.Calc.usosDoInsumo(ins.id).length;
      elCard.replaceChildren(
        h('div', { class: 'pr-topo' },
          h('span', { class: 'pr-pos' }, (pos + 1) + ' de ' + fila.length),
          h('button', { type: 'button', class: 'btn mini', onClick: abrirLista }, 'Lista'),
          h('button', { type: 'button', class: 'btn mini', onClick: () => { pos++; np.set(null); desenhar(); } }, 'Pular')),
        h('div', { class: 'pr-nome' }, ins.nome),
        h('div', { class: 'pr-meta' }, 'por ' + ins.unidade + (+ins.fator_correcao !== 1 ? ' · fator ' + P.num(ins.fator_correcao, 2) : '') +
          ' · ' + (usos ? 'usado em ' + usos + (usos === 1 ? ' item' : ' itens') : 'não usado em ficha')),
        h('div', { class: 'pr-atual' + (velho ? ' velho' : '') }, 'Atual ', h('b', null, precoFmt(ins.preco)), ' · ', haDias(ins), velho ? ' ⚠' : ''));
      mostrarDisp();
    }
    function salvar(mesmo) {
      const ins = atual();
      if (!ins) return;
      const v = mesmo ? ins.preco : np.valor();
      if (!mesmo && !(v > 0)) {
        P.vibrar(70);
        elDisp.classList.remove('treme'); void elDisp.offsetWidth; elDisp.classList.add('treme');
        return;
      }
      const r = aplicarPreco(ins, v, mesmo);
      feitos.push(r);
      ultimo = r;
      P.vibrar(r.cruzaram.length ? [40, 60, 40, 60, 40] : 20);
      pos++;
      np.set(null);
      desenhar();
    }
    function abrirLista() {
      P.UI.escolher({
        titulo: 'Escolher insumo',
        opcoes: fila.map(id => P.Store.get('insumos', id)).filter(Boolean).map(i => ({
          v: i.id, rotulo: i.nome, sub: precoUnit(i) + ' · ' + haDias(i) + (P.Calc.precoVelho(i) ? ' ⚠' : ''),
        })),
      }).then(id => { if (id) { colocarNaVez(id); np.set(null); desenhar(); } });
    }

    view.append(subnavFichas('precos'), elResultado, area, elFim);
    desenhar();
    return { cleanup() { np.destruir(); } };
  }

  // ---------------------------------------------------------------
  //  SIMULAÇÃO (dono): e se eu mudar a gramagem? e o preço?
  // ---------------------------------------------------------------
  function telaSimular(view, params) {
    view.className = 'v-fichas';
    if (!params.id) {
      const vend = P.Store.all('itens').filter(P.Calc.vendavel).map(it => P.Calc.ficha(it)).sort((a, b) => b.fc - a.fc);
      view.append(subnavFichas('simular'), h('div', { class: 'dica' }, 'Escolha um item para testar porção e preço antes de salvar.'),
        h('div', { class: 'mg-lista' }, vend.map(f => h('a', { href: '#/fichas/simular/' + f.item.id, class: 'mg-lin f-' + f.faixa },
          h('div', { class: 'mg-nome' }, f.item.nome), h('div', { class: 'mg-fc' }, P.pct(f.fc)),
          h('div', { class: 'mg-det' }, h('span', null, 'CMV ', h('b', null, P.brl(f.cmv))), h('span', null, 'Preço ', h('b', null, P.brl(f.preco))))))));
      return {};
    }
    const it = P.Store.get('itens', params.id);
    if (!it) { view.append(voltar('#/fichas/simular'), P.UI.vazio('Item não encontrado.')); return {}; }
    const original = { preco: +it.preco_venda || 0, perda: +it.perda_pct || 0, comps: P.Calc.componentesDe(it.id).map(c => Object.assign({}, c)) };
    let preco = original.preco, perda = original.perda;
    let comps = original.comps.map(c => Object.assign({}, c));
    const antes = P.Calc.ficha(it);

    const elTopo = h('div', { class: 'sim-topo' });
    const elMeta = h('div', { class: 'sim-meta' });
    const custos = new Map();
    const elComps = h('div', { class: 'sim-comps' });

    function recalcular() {
      const f = P.Calc.fichaCom(it, comps, preco, perda);
      const dFc = f.fc - antes.fc;
      elTopo.className = 'sim-topo f-' + f.faixa;
      elTopo.replaceChildren(
        h('div', { class: 'sim-col' }, h('small', null, 'Antes'), h('div', { class: 'sim-v' }, dot(antes.faixa), P.pct(antes.fc)), h('div', { class: 'sim-m' }, 'margem ' + P.brl(antes.margem))),
        h('div', { class: 'sim-seta' }, P.UI.icone('avancar')),
        h('div', { class: 'sim-col' }, h('small', null, 'Depois'), h('div', { class: 'sim-v grande' }, dot(f.faixa), P.pct(f.fc)),
          h('div', { class: 'sim-m' }, 'margem ' + P.brl(f.margem), Math.abs(dFc) >= 0.05 ? h('span', { class: dFc > 0 ? 'pior' : 'melhor' }, ' (' + (dFc > 0 ? '+' : '') + P.num(dFc, 1) + ' pts)') : null)));
      P.Calc.linhas(comps).forEach(l => { const el = custos.get(l.c.id); if (el) el.textContent = P.brl(l.custo); });
      const alvo = P.Calc.paraAlvo(it, comps, preco, perda);
      elMeta.replaceChildren(alvo.ja
        ? h('div', null, 'Já está dentro de ' + alvo.alvo + '% (verde).')
        : h('div', null, 'Para chegar a ' + alvo.alvo + '%: ',
          h('b', null, 'preço ' + P.brl(Math.ceil(alvo.precoAlvo * 2) / 2)),
          alvo.porcao && alvo.porcao.qtd ? [' ou ', h('b', null, alvo.porcao.linha.nome.toLowerCase() + ' ' + P.numAuto(Math.floor(alvo.porcao.qtd)) + ' ' + alvo.porcao.linha.un)] : ' (só pela porção não dá)'));
    }

    const stPreco = P.UI.stepper({ valor: preco, passo: 0.5, min: 0, fmt: P.brl, pedir: { titulo: 'Preço de venda', decimais: 2, prefixo: 'R$ ' }, onChange: v => { preco = v; recalcular(); } });
    const stPerda = P.UI.stepper({ valor: perda, passo: 0.5, min: 0, max: 100, fmt: v => P.num(v, 1) + '%', pedir: { titulo: 'Perda operacional (%)', decimais: 1, sufixo: '%' }, onChange: v => { perda = v; recalcular(); } });

    function desenharComps() {
      elComps.innerHTML = '';
      custos.clear();
      P.Calc.linhas(comps).forEach(l => {
        const c = l.c;
        const elC = h('div', { class: 'sim-cv' });
        custos.set(c.id, elC);
        elComps.appendChild(h('div', { class: 'sim-c' },
          h('div', { class: 'sim-cn' }, l.nome, elC),
          P.UI.stepper({
            valor: c.gramas, passo: passoDe(l), min: 0, fmt: v => P.numAuto(v) + ' ' + l.un,
            pedir: { titulo: l.nome, decimais: l.un === 'g' || l.un === 'ml' ? 0 : 2, sufixo: ' ' + l.un },
            onChange: v => { c.gramas = v; recalcular(); },
          }).el));
      });
    }
    function restaurar() {
      preco = original.preco; perda = original.perda;
      comps = original.comps.map(c => Object.assign({}, c));
      stPreco.set(preco); stPerda.set(perda);
      desenharComps(); recalcular();
    }
    function salvarFicha() {
      const atualIt = P.Store.get('itens', it.id);
      const guardado = { it: Object.assign({}, atualIt), comps: P.Calc.componentesDe(it.id).map(c => Object.assign({}, c)) };
      const antesSnap = P.Calc.snapshot();
      P.Store.put('itens', Object.assign({}, atualIt, { preco_venda: preco, perda_pct: perda }));
      comps.forEach(c => {
        const o = P.Store.get('componentes', c.id);
        if (o && +o.gramas !== +c.gramas) P.Store.put('componentes', Object.assign({}, o, { gramas: c.gramas }));
      });
      medirEfeito(antesSnap);
      P.vibrar(20);
      P.UI.toast('Ficha de ' + it.nome + ' atualizada', {
        acao: {
          rotulo: 'Desfazer', fn: () => {
            P.Store.put('itens', guardado.it);
            guardado.comps.forEach(c => P.Store.put('componentes', c));
            P.UI.toast('Desfeito');
          },
        },
      });
      location.hash = '#/fichas/item/' + it.id;
    }

    view.append(
      voltar('#/fichas/simular', 'Itens'),
      h('div', { class: 'sim-nome' }, it.nome),
      elTopo, elMeta,
      h('div', { class: 'sim-lin' }, h('span', null, 'Preço de venda'), stPreco.el),
      h('div', { class: 'secao' }, 'Porções'), elComps,
      h('div', { class: 'sim-lin' }, h('span', null, 'Perda operacional'), stPerda.el),
      h('div', { class: 'row gap acoes' },
        h('button', { type: 'button', class: 'btn grow', onClick: restaurar }, 'Restaurar'),
        h('button', { type: 'button', class: 'btn primario grow', onClick: salvarFicha }, 'Salvar na ficha')));
    desenharComps();
    recalcular();
    return {};
  }

  // ---------------------------------------------------------------
  //  CADASTRO (dono)
  // ---------------------------------------------------------------
  function telaCadastro(view, params) {
    view.className = 'v-fichas';
    const aba = params.aba === 'insumos' ? 'insumos' : 'itens';
    const corpo = h('div');
    function desenhar() {
      corpo.innerHTML = '';
      if (aba === 'itens') {
        corpo.appendChild(h('a', { class: 'btn primario bloco', href: '#/fichas/editar/novo' }, P.UI.icone('mais'), 'Novo item'));
        const todos = P.Store.all('itens');
        CATS.forEach(cat => {
          const l = todos.filter(i => i.categoria === cat).sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
          if (!l.length) return;
          corpo.appendChild(h('div', { class: 'secao' }, CAT[cat] + ' (' + l.length + ')'));
          corpo.appendChild(h('div', { class: 'cad-lista' }, l.map(it => {
            const f = P.Calc.ficha(it);
            return h('a', { class: 'cad-lin' + (it.ativo === false ? ' inativo' : ''), href: '#/fichas/editar/' + it.id },
              h('div', { class: 'cad-n' }, it.nome, it.ativo === false ? h('small', null, ' inativo') : null),
              h('div', { class: 'cad-d' }, +it.preco_venda > 0 ? [dot(f.faixa), ' ' + P.pct(f.fc, 0) + ' · ' + P.brl(it.preco_venda)] : 'custo ' + P.brl(f.bruto)));
          })));
        });
      } else {
        corpo.appendChild(h('a', { class: 'btn primario bloco', href: '#/fichas/insumo/novo' }, P.UI.icone('mais'), 'Novo insumo'));
        const l = P.Store.all('insumos').sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
        corpo.appendChild(h('div', { class: 'cad-lista' }, l.map(i => h('a', { class: 'cad-lin', href: '#/fichas/insumo/' + i.id },
          h('div', { class: 'cad-n' }, i.nome),
          h('div', { class: 'cad-d' + (P.Calc.precoVelho(i) ? ' velho' : '') }, precoUnit(i) + (+i.fator_correcao !== 1 ? ' · f ' + P.num(i.fator_correcao, 2) : '') + ' · ' + haDias(i))))));
      }
    }
    view.append(subnavFichas('cadastro'),
      P.UI.seg([{ v: 'itens', rotulo: 'Itens' }, { v: 'insumos', rotulo: 'Insumos' }], aba, v => { location.hash = v === 'itens' ? '#/fichas/cadastro' : '#/fichas/cadastro/insumos'; }, 'seg-p'),
      corpo);
    desenhar();
    return { onDados: desenhar };
  }

  function campo(rotulo, el, dica) {
    return h('div', { class: 'campo-l' }, h('span', { class: 'campo-r' }, rotulo), el, dica ? h('small', { class: 'campo-d' }, dica) : null);
  }
  function botaoValor(texto, onClick) {
    const b = h('button', { type: 'button', class: 'btn valor', onClick });
    b.textContent = texto;
    return b;
  }

  function telaInsumo(view, params) {
    view.className = 'v-fichas';
    const novo = params.id === 'novo';
    const orig = novo ? { id: P.uuid(), nome: '', unidade: 'kg', preco: 0, fator_correcao: 1, atualizado_em: null } : P.Store.get('insumos', params.id);
    if (!orig) { view.append(voltar('#/fichas/cadastro/insumos'), P.UI.vazio('Insumo não encontrado.')); return {}; }
    const d = Object.assign({}, orig);
    const nome = h('input', { class: 'campo', type: 'text', value: d.nome, placeholder: 'Ex.: Peito de frango', autocomplete: 'off' });
    const bPreco = botaoValor('', async () => {
      const v = await P.UI.pedirNumero({ titulo: 'Preço de compra por ' + d.unidade, valor: d.preco, decimais: 3, prefixo: 'R$ ' });
      if (v != null) { d.preco = v; mostrar(); }
    });
    const stFator = P.UI.stepper({ valor: d.fator_correcao, passo: 0.01, min: 1, fmt: v => P.num(v, 2), pedir: { titulo: 'Fator de correção (bruto ÷ líquido)', decimais: 3 }, onChange: v => { d.fator_correcao = v; } });
    function mostrar() { bPreco.textContent = precoFmt(d.preco) + ' / ' + d.unidade; }
    const usos = novo ? [] : P.Calc.usosDoInsumo(orig.id);
    const hist = novo ? [] : P.Store.all('historico_precos').filter(x => x.insumo_id === orig.id).sort((a, b) => (a.data < b.data ? 1 : -1)).slice(0, 8);

    function salvar() {
      d.nome = nome.value.trim();
      if (!d.nome) { P.UI.toast('Dê um nome ao insumo.', { tipo: 'perigo' }); nome.focus(); return; }
      if (!(d.preco >= 0)) d.preco = 0;
      const antes = P.Calc.snapshot();
      const mudouPreco = novo || P.round(d.preco, 4) !== P.round(orig.preco, 4);
      if (mudouPreco) {
        d.atualizado_em = P.agoraISO();
        P.Store.put('historico_precos', { id: P.uuid(), insumo_id: d.id, preco: d.preco, data: d.atualizado_em });
      }
      P.Store.put('insumos', d);
      const r = medirEfeito(antes);
      P.vibrar(20);
      P.UI.toast(novo ? 'Insumo criado' : r.mudaramFaixa.length ? r.mudaramFaixa.map(x => x.nome + ' ' + P.pct(x.de, 0) + '→' + P.pct(x.para, 0)).join(' · ') : 'Insumo salvo', { ms: 4000 });
      location.hash = '#/fichas/cadastro/insumos';
    }
    async function excluir() {
      if (usos.length) { P.UI.toast('Usado em ' + usos.length + ' item(ns). Tire das fichas antes.', { tipo: 'perigo' }); return; }
      if (!(await P.UI.confirmar('Excluir o insumo "' + orig.nome + '"?', { ok: 'Excluir', perigo: true }))) return;
      P.Store.remove('insumos', orig.id);
      location.hash = '#/fichas/cadastro/insumos';
    }
    view.append(
      voltar('#/fichas/cadastro/insumos', 'Insumos'),
      h('div', { class: 'form' },
        h('div', { class: 'form-tit' }, novo ? 'Novo insumo' : 'Editar insumo'),
        campo('Nome', nome),
        campo('Unidade de compra', P.UI.seg([{ v: 'kg', rotulo: 'kg' }, { v: 'L', rotulo: 'litro' }, { v: 'un', rotulo: 'unidade' }], d.unidade, v => { d.unidade = v; mostrar(); }, 'seg-p')),
        campo('Preço de compra', bPreco, novo ? null : 'Atualizado ' + haDias(orig)),
        campo('Fator de correção', stFator.el, 'Peso bruto ÷ peso líquido (1,00 = sem perda no preparo)'),
        usos.length ? h('div', { class: 'form-info' }, 'Usado em: ', usos.map(u => u.nome).join(', ')) : null,
        hist.length ? h('div', { class: 'form-info' }, 'Histórico: ', hist.map(x => P.Dia.rotuloCurto(P.Dia.diaOperacional(x.data)) + ' ' + precoFmt(x.preco)).join(' · ')) : null,
        h('div', { class: 'row gap acoes' },
          novo ? null : h('button', { type: 'button', class: 'btn perigo', onClick: excluir }, P.UI.icone('lixo'), 'Excluir'),
          h('button', { type: 'button', class: 'btn primario grow', onClick: salvar }, 'Salvar'))));
    mostrar();
    if (novo) setTimeout(() => nome.focus(), 50);
    return {};
  }

  function telaEditarItem(view, params) {
    view.className = 'v-fichas';
    const novo = params.id === 'novo';
    const orig = novo
      ? { id: P.uuid(), nome: '', categoria: 'PRATO', preco_venda: 0, perda_pct: P.Calc.cfgFichas().perda_padrao, ativo: true }
      : P.Store.get('itens', params.id);
    if (!orig) { view.append(voltar('#/fichas/cadastro'), P.UI.vazio('Item não encontrado.')); return {}; }
    const d = Object.assign({}, orig);
    let comps = novo ? [] : P.Calc.componentesDe(orig.id).map(c => Object.assign({}, c));
    const removidos = [];

    const nome = h('input', { class: 'campo', type: 'text', value: d.nome, placeholder: 'Ex.: Espeto de frango', autocomplete: 'off' });
    const bPreco = botaoValor('', async () => {
      const v = await P.UI.pedirNumero({ titulo: 'Preço de venda', valor: d.preco_venda, decimais: 2, prefixo: 'R$ ', sub: '0 = componente (não é vendido sozinho)' });
      if (v != null) { d.preco_venda = v; mostrar(); }
    });
    const stPerda = P.UI.stepper({ valor: d.perda_pct, passo: 0.5, min: 0, max: 100, fmt: v => P.num(v, 1) + '%', pedir: { titulo: 'Perda operacional (%)', decimais: 1, sufixo: '%' }, onChange: v => { d.perda_pct = v; previa(); } });
    const elComps = h('div', { class: 'sim-comps' });
    const elPrevia = h('div', { class: 'ed-previa' });
    const custos = new Map();

    function mostrar() { bPreco.textContent = +d.preco_venda > 0 ? P.brl(d.preco_venda) : 'Sem preço (componente)'; previa(); }
    function previa() {
      const f = P.Calc.fichaCom(d, comps, d.preco_venda, d.perda_pct);
      P.Calc.linhas(comps).forEach(l => { const el = custos.get(l.c.id); if (el) el.textContent = P.brl(l.custo); });
      elPrevia.className = 'ed-previa f-' + f.faixa;
      elPrevia.replaceChildren(
        h('div', null, h('small', null, 'CMV'), h('b', null, P.brl(f.cmv))),
        h('div', null, h('small', null, 'Food cost'), h('b', null, dot(f.faixa), f.fc == null ? '—' : P.pct(f.fc))),
        h('div', null, h('small', null, 'Margem'), h('b', null, f.margem == null ? '—' : P.brl(f.margem))));
    }
    function desenharComps() {
      elComps.innerHTML = '';
      custos.clear();
      P.Calc.linhas(comps).forEach(l => {
        const c = l.c;
        const elC = h('div', { class: 'sim-cv' });
        custos.set(c.id, elC);
        elComps.appendChild(h('div', { class: 'sim-c' },
          h('div', { class: 'sim-cn' }, l.nome, elC),
          h('div', { class: 'ed-cq' },
            P.UI.stepper({
              valor: c.gramas, passo: passoDe(l), min: 0, fmt: v => P.numAuto(v) + ' ' + l.un,
              pedir: { titulo: l.nome, decimais: l.un === 'g' || l.un === 'ml' ? 0 : 2, sufixo: ' ' + l.un },
              onChange: v => { c.gramas = v; previa(); },
            }).el,
            h('button', { type: 'button', class: 'btn ic perigo', 'aria-label': 'Remover', onClick: () => {
              comps = comps.filter(x => x !== c);
              if (!c._novo) removidos.push(c.id);
              desenharComps(); previa();
            } }, P.UI.icone('x')))));
      });
      if (!comps.length) elComps.appendChild(P.UI.vazio('Sem componentes ainda.'));
    }
    async function addInsumo() {
      const id = await P.UI.escolher({
        titulo: 'Adicionar insumo',
        opcoes: P.Store.all('insumos').sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR')).map(i => ({ v: i.id, rotulo: i.nome, sub: precoUnit(i) })),
      });
      if (!id) return;
      const ins = P.Store.get('insumos', id);
      comps.push({ id: P.uuid(), _novo: true, item_id: d.id, insumo_id: id, item_componente_id: null, gramas: ins && ins.unidade === 'un' ? 1 : 100, ordem: comps.length });
      desenharComps(); previa();
    }
    async function addItem() {
      const id = await P.UI.escolher({
        titulo: 'Adicionar item pronto',
        opcoes: P.Store.all('itens').filter(i => i.id !== d.id && !P.Calc.contem(i.id, d.id))
          .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))
          .map(i => ({ v: i.id, rotulo: i.nome, sub: CAT[i.categoria] + ' · custo ' + P.brl(P.Calc.custoBruto(i.id)) })),
      });
      if (!id) return;
      comps.push({ id: P.uuid(), _novo: true, item_id: d.id, insumo_id: null, item_componente_id: id, gramas: 1, ordem: comps.length });
      desenharComps(); previa();
    }
    function salvar() {
      d.nome = nome.value.trim();
      if (!d.nome) { P.UI.toast('Dê um nome ao item.', { tipo: 'perigo' }); nome.focus(); return; }
      const antes = P.Calc.snapshot();
      P.Store.put('itens', d);
      comps.forEach((c, i) => {
        const o = P.Store.get('componentes', c.id);
        const rec = { id: c.id, item_id: d.id, insumo_id: c.insumo_id || null, item_componente_id: c.item_componente_id || null, gramas: +c.gramas || 0, ordem: i };
        if (!o || +o.gramas !== rec.gramas || (o.ordem || 0) !== i || o.insumo_id !== rec.insumo_id || o.item_componente_id !== rec.item_componente_id) {
          P.Store.put('componentes', Object.assign({}, o || {}, rec));
        }
      });
      removidos.forEach(id => P.Store.remove('componentes', id));
      medirEfeito(antes);
      P.vibrar(20);
      P.UI.toast(novo ? 'Item criado' : 'Ficha salva');
      location.hash = '#/fichas/item/' + d.id;
    }
    async function excluir() {
      const usos = P.Calc.usosDoItem(orig.id);
      if (usos.length) { P.UI.toast('Usado dentro de: ' + usos.map(u => u.nome).join(', ') + '. Tire de lá antes.', { tipo: 'perigo', ms: 5000 }); return; }
      if (!(await P.UI.confirmar('Excluir o item "' + orig.nome + '" e sua ficha? Para só tirar de venda, marque Inativo.', { ok: 'Excluir', perigo: true }))) return;
      P.Calc.componentesDe(orig.id).forEach(c => P.Store.remove('componentes', c.id));
      P.Store.remove('itens', orig.id);
      location.hash = '#/fichas/cadastro';
    }

    view.append(
      voltar(novo ? '#/fichas/cadastro' : '#/fichas/item/' + orig.id, novo ? 'Cadastro' : 'Ficha'),
      h('div', { class: 'form' },
        h('div', { class: 'form-tit' }, novo ? 'Novo item' : 'Editar ficha'),
        campo('Nome', nome),
        campo('Categoria', P.UI.seg(CATS.map(c => ({ v: c, rotulo: CAT[c] })), d.categoria, v => { d.categoria = v; }, 'seg-p seg-cat')),
        campo('Preço de venda', bPreco),
        campo('Perda operacional', stPerda.el),
        campo('Situação', P.UI.seg([{ v: true, rotulo: 'Ativo' }, { v: false, rotulo: 'Inativo' }], d.ativo !== false, v => { d.ativo = v; }, 'seg-p')),
        elPrevia,
        h('div', { class: 'secao' }, 'Componentes'),
        elComps,
        h('div', { class: 'row gap' },
          h('button', { type: 'button', class: 'btn grow', onClick: addInsumo }, P.UI.icone('mais'), 'Insumo'),
          h('button', { type: 'button', class: 'btn grow', onClick: addItem }, P.UI.icone('mais'), 'Item pronto')),
        h('small', { class: 'campo-d' }, 'Item pronto (ex.: base do prato, baião) entra pelo custo sem perda; a perda é aplicada uma vez só, no item vendido.'),
        h('div', { class: 'row gap acoes' },
          novo ? null : h('button', { type: 'button', class: 'btn perigo', onClick: excluir }, P.UI.icone('lixo'), 'Excluir'),
          h('button', { type: 'button', class: 'btn primario grow', onClick: salvar }, 'Salvar'))));
    desenharComps();
    mostrar();
    if (novo) setTimeout(() => nome.focus(), 50);
    return {};
  }

  // ---------------------------------------------------------------
  //  Rotas
  // ---------------------------------------------------------------
  const tabPrecos = () => (P.Auth.isDono() ? 'fichas' : 'mais');
  P.UI.rota('fichas', { titulo: 'Fichas · margem', tab: 'fichas', dono: true, render: telaMargem });
  P.UI.rota('fichas/item/:id', { titulo: 'Ficha técnica', tab: 'fichas', dono: true, render: telaItem });
  P.UI.rota('fichas/simular', { titulo: 'Simulação', tab: 'fichas', dono: true, render: telaSimular });
  P.UI.rota('fichas/simular/:id', { titulo: 'Simulação', tab: 'fichas', dono: true, render: telaSimular });
  P.UI.rota('fichas/cadastro', { titulo: 'Cadastro', tab: 'fichas', dono: true, render: telaCadastro });
  P.UI.rota('fichas/cadastro/:aba', { titulo: 'Cadastro', tab: 'fichas', dono: true, render: telaCadastro });
  P.UI.rota('fichas/insumo/:id', { titulo: 'Insumo', tab: 'fichas', dono: true, render: telaInsumo });
  P.UI.rota('fichas/editar/:id', { titulo: 'Editar ficha', tab: 'fichas', dono: true, render: telaEditarItem });
  P.UI.rota('precos', { titulo: 'Preços', tab: tabPrecos, render: telaPrecos });
  P.UI.rota('precos/:id', { titulo: 'Preços', tab: tabPrecos, render: telaPrecos });

  P.Fichas = { aplicarPreco, medirEfeito, frasesEfeito, precoFmt, precoUnit, haDias, CAT, CATS };
})();
