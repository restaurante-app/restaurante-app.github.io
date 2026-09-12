/* Interface: DOM, ícones, rotas, barra inferior, teclado numérico, avisos. */
(function () {
  'use strict';
  const P = window.P;
  const $ = s => document.querySelector(s);

  // ---------------------------------------------------------------
  //  DOM
  // ---------------------------------------------------------------
  function h(tag, attrs) {
    const el = document.createElement(tag);
    if (attrs) {
      for (const k in attrs) {
        const v = attrs[k];
        if (v == null || v === false) continue;
        if (k === 'class') el.className = v;
        else if (k === 'style' && typeof v === 'object') {
          for (const sk in v) { if (v[sk] == null) continue; if (sk.startsWith('--')) el.style.setProperty(sk, v[sk]); else el.style[sk] = v[sk]; }
        } else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v);
        else if (k === 'html') el.innerHTML = v;
        else if (v === true) el.setAttribute(k, '');
        else el.setAttribute(k, v);
      }
    }
    for (let i = 2; i < arguments.length; i++) adicionar(el, arguments[i]);
    return el;
  }
  function adicionar(el, c) {
    if (c == null || c === false) return;
    if (Array.isArray(c)) { c.forEach(x => adicionar(el, x)); return; }
    el.appendChild(c instanceof Node ? c : document.createTextNode(String(c)));
  }

  // ---------------------------------------------------------------
  //  Ícones (traço 2px, 24×24)
  // ---------------------------------------------------------------
  const IC = {
    fluxo: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
    fichas: '<rect x="8" y="2" width="8" height="4" rx="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><path d="M12 11h4"/><path d="M12 16h4"/><path d="M8 11h.01"/><path d="M8 16h.01"/>',
    mesas: '<path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2"/><path d="M7 2v20"/><path d="M21 15V2a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3Zm0 0v7"/>',
    painel: '<path d="m12 14 4-4"/><path d="M3.34 19a10 10 0 1 1 17.32 0"/>',
    ajustes: '<line x1="21" x2="14" y1="4" y2="4"/><line x1="10" x2="3" y1="4" y2="4"/><line x1="21" x2="12" y1="12" y2="12"/><line x1="8" x2="3" y1="12" y2="12"/><line x1="21" x2="16" y1="20" y2="20"/><line x1="12" x2="3" y1="20" y2="20"/><line x1="14" x2="14" y1="2" y2="6"/><line x1="8" x2="8" y1="10" y2="14"/><line x1="16" x2="16" y1="18" y2="22"/>',
    preco: '<path d="M12.586 2.586A2 2 0 0 0 11.172 2H4a2 2 0 0 0-2 2v7.172a2 2 0 0 0 .586 1.414l8.704 8.704a2.426 2.426 0 0 0 3.42 0l6.58-6.58a2.426 2.426 0 0 0 0-3.42z"/><circle cx="7.5" cy="7.5" r="1.5"/>',
    sol: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="m4.93 4.93 1.41 1.41"/><path d="m17.66 17.66 1.41 1.41"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="m6.34 17.66-1.41 1.41"/><path d="m19.07 4.93-1.41 1.41"/>',
    lua: '<path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/>',
    voltar: '<path d="m15 18-6-6 6-6"/>',
    avancar: '<path d="m9 18 6-6-6-6"/>',
    backspace: '<path d="M21 4H8l-7 8 7 8h13a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2Z"/><line x1="18" x2="12" y1="9" y2="15"/><line x1="12" x2="18" y1="9" y2="15"/>',
    x: '<path d="M18 6 6 18"/><path d="m6 6 12 12"/>',
    mais: '<path d="M5 12h14"/><path d="M12 5v14"/>',
    menos: '<path d="M5 12h14"/>',
    alerta: '<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3"/><path d="M12 9v4"/><path d="M12 17h.01"/>',
    check: '<path d="M20 6 9 17l-5-5"/>',
    download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m7 10 5 5 5-5"/><path d="M12 15V3"/>',
    upload: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m17 8-5-5-5 5"/><path d="M12 3v12"/>',
    refresh: '<path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/><path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16"/><path d="M16 16h5v5"/>',
    lapis: '<path d="M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z"/>',
    lixo: '<path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/>',
    sair: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="m16 17 5-5-5-5"/><path d="M21 12H9"/>',
    sino: '<path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/>',
    busca: '<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>',
  };
  function icone(nome, cls) {
    const s = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    s.setAttribute('viewBox', '0 0 24 24');
    s.setAttribute('fill', 'none');
    s.setAttribute('stroke', 'currentColor');
    s.setAttribute('stroke-width', '2');
    s.setAttribute('stroke-linecap', 'round');
    s.setAttribute('stroke-linejoin', 'round');
    s.setAttribute('aria-hidden', 'true');
    if (cls) s.setAttribute('class', cls);
    s.innerHTML = IC[nome] || '';
    return s;
  }

  // ---------------------------------------------------------------
  //  Tema
  // ---------------------------------------------------------------
  function tema(t) {
    if (t) {
      document.documentElement.dataset.theme = t;
      try { localStorage.setItem('pari.tema', t); } catch (e) { /* ok */ }
    }
    const atual = document.documentElement.dataset.theme || 'dark';
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', atual === 'light' ? '#f3f6f4' : '#0e1311');
    return atual;
  }

  // ---------------------------------------------------------------
  //  Avisos (toast), folha inferior (sheet), confirmação
  // ---------------------------------------------------------------
  function toast(msg, o) {
    o = o || {};
    const root = $('#toast-root');
    const el = h('div', { class: 'toast ' + (o.tipo || '') },
      h('span', { class: 'toast-msg' }, msg),
      o.acao ? h('button', { type: 'button', class: 'toast-acao', onClick: () => { fechar(); o.acao.fn(); } }, o.acao.rotulo) : null);
    root.appendChild(el);
    requestAnimationFrame(() => el.classList.add('on'));
    const t = setTimeout(fechar, o.ms || (o.acao ? 6000 : 2800));
    function fechar() { clearTimeout(t); el.classList.remove('on'); setTimeout(() => el.remove(), 250); }
    return fechar;
  }

  const sheetsAbertas = new Set();
  function sheet(conteudo, o) {
    o = o || {};
    const root = $('#sheet-root');
    const box = h('div', { class: 'sheet' + (o.cls ? ' ' + o.cls : '') },
      o.titulo ? h('div', { class: 'sheet-tit' }, o.titulo) : null, conteudo);
    const back = h('div', { class: 'sheet-back' }, box);
    root.appendChild(back);
    requestAnimationFrame(() => back.classList.add('on'));
    let fechada = false;
    const api = {
      el: box,
      fechar() {
        if (fechada) return;
        fechada = true;
        sheetsAbertas.delete(api);
        back.classList.remove('on');
        setTimeout(() => back.remove(), 200);
        if (o.onFechar) o.onFechar();
      },
    };
    back.addEventListener('click', e => { if (e.target === back) api.fechar(); });
    sheetsAbertas.add(api);
    return api;
  }
  function fecharSheets() { [...sheetsAbertas].forEach(s => s.fechar()); }

  function confirmar(msg, o) {
    o = o || {};
    return new Promise(res => {
      const sh = sheet(h('div', { class: 'confirma' },
        h('p', null, msg),
        h('div', { class: 'row gap' },
          h('button', { type: 'button', class: 'btn', onClick: () => { res(false); sh.fechar(); } }, 'Cancelar'),
          h('button', { type: 'button', class: 'btn grow ' + (o.perigo ? 'perigo-cheio' : 'primario'), onClick: () => { res(true); sh.fechar(); } }, o.ok || 'Confirmar'))),
      { titulo: o.titulo, onFechar: () => res(false) });
    });
  }

  // ---------------------------------------------------------------
  //  Teclado numérico grande
  // ---------------------------------------------------------------
  function paraBuf(v, dec) {
    if (v == null || v === '' || isNaN(v)) return '';
    const s = dec ? String(P.round(v, dec)) : String(Math.round(v));
    return s.replace('.', ',');
  }
  function numpad(o) {
    o = o || {};
    const dec = o.decimais || 0;
    let buf = paraBuf(o.inicial, dec);
    let novo = !!buf; // a primeira tecla substitui o valor mostrado
    const el = h('div', { class: 'numpad' });
    ['1', '2', '3', '4', '5', '6', '7', '8', '9', dec ? ',' : 'C', '0', '⌫'].forEach(t => {
      el.appendChild(h('button', { type: 'button', class: 'np-k' + (t === '⌫' || t === 'C' ? ' np-fn' : ''), 'aria-label': t === '⌫' ? 'apagar' : t, onClick: () => tecla(t) },
        t === '⌫' ? icone('backspace') : t));
    });
    function tecla(t) {
      P.vibrar(8);
      if (novo && t !== '⌫' && t !== 'C') buf = '';
      if (t === '⌫') buf = novo ? '' : buf.slice(0, -1);
      else if (t === 'C') buf = '';
      else if (t === ',') { if (!buf.includes(',')) buf = (buf || '0') + ','; }
      else {
        if (buf.includes(',')) { if (buf.split(',')[1].length >= dec) { novo = false; return; } }
        else if (buf.replace(/^0+/, '').length >= (o.maxInteiros || 6)) { novo = false; return; }
        buf = buf === '0' ? t : buf + t;
      }
      novo = false;
      if (o.onChange) o.onChange(buf, valor());
    }
    function valor() {
      if (!buf || buf === ',') return null;
      const v = parseFloat(buf.replace(',', '.'));
      return isNaN(v) ? null : v;
    }
    function onKey(e) {
      if (e.target && /INPUT|TEXTAREA|SELECT/.test(e.target.tagName)) return;
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (/^[0-9]$/.test(e.key)) tecla(e.key);
      else if ((e.key === ',' || e.key === '.') && dec) tecla(',');
      else if (e.key === 'Backspace') tecla('⌫');
      else if (e.key === 'Enter') { if (o.onEnter) o.onEnter(); }
      else return;
      e.preventDefault();
    }
    document.addEventListener('keydown', onKey);
    return {
      el, valor,
      buf: () => buf,
      set(v) { buf = paraBuf(v, dec); novo = !!buf; if (o.onChange) o.onChange(buf, valor()); },
      destruir() { document.removeEventListener('keydown', onKey); },
    };
  }

  // Pergunta um número numa folha inferior → Promise<number|null>
  function pedirNumero(o) {
    o = o || {};
    return new Promise(resolve => {
      let feito = false;
      const disp = h('div', { class: 'np-display' });
      const np = numpad({ decimais: o.decimais || 0, inicial: o.valor, maxInteiros: o.maxInteiros, onChange: mostrar, onEnter: ok });
      function mostrar() {
        const b = np.buf();
        disp.textContent = (o.prefixo || '') + (b || '0') + (o.sufixo || '');
        disp.classList.toggle('vazio', !b);
      }
      const rapidos = (o.rapidos || []).length ? h('div', { class: 'np-rapidos' }, o.rapidos.map(r =>
        h('button', { type: 'button', class: 'btn', onClick: () => { np.set(P.round((np.valor() || 0) + r, 3)); P.vibrar(8); } }, (r > 0 ? '+' : '') + r))) : null;
      const sh = sheet(h('div', { class: 'np-sheet' },
        o.sub ? h('div', { class: 'np-sub' }, o.sub) : null,
        disp, rapidos, np.el,
        h('div', { class: 'row gap' },
          h('button', { type: 'button', class: 'btn', onClick: () => sh.fechar() }, 'Cancelar'),
          h('button', { type: 'button', class: 'btn primario grow', onClick: ok }, o.ok || 'OK'))),
      { titulo: o.titulo, cls: 'sheet-np', onFechar: () => { np.destruir(); if (!feito) { feito = true; resolve(null); } } });
      function ok() {
        if (feito) return;
        const v = np.valor();
        feito = true;
        resolve(v == null ? 0 : v);
        sh.fechar();
      }
      mostrar();
    });
  }

  function stepper(o) {
    let v = +o.valor || 0;
    const val = h('button', { type: 'button', class: 'st-val' + (o.pedir ? ' editavel' : ''), onClick: async () => {
      if (!o.pedir) return;
      const n = await pedirNumero(Object.assign({ valor: v }, o.pedir));
      if (n != null) set(n);
    } });
    const el = h('div', { class: 'stepper' + (o.cls ? ' ' + o.cls : '') },
      h('button', { type: 'button', class: 'st-b', 'aria-label': 'menos', onClick: () => set(v - o.passo) }, icone('menos')),
      val,
      h('button', { type: 'button', class: 'st-b', 'aria-label': 'mais', onClick: () => set(v + o.passo) }, icone('mais')));
    function set(n) {
      n = P.round(n, 4);
      if (o.min != null) n = Math.max(o.min, n);
      if (o.max != null) n = Math.min(o.max, n);
      v = n;
      mostrar();
      P.vibrar(8);
      if (o.onChange) o.onChange(v);
    }
    function mostrar() { val.textContent = o.fmt ? o.fmt(v) : String(v); }
    mostrar();
    return { el, set, valor: () => v };
  }

  function seg(opcoes, valor, onChange, cls) {
    const el = h('div', { class: 'seg' + (cls ? ' ' + cls : '') });
    opcoes.forEach(op => {
      el.appendChild(h('button', {
        type: 'button', class: op.v === valor ? 'on' : '', style: op.cor ? { '--c': op.cor } : null,
        onClick: () => {
          if (valor === op.v) return;
          valor = op.v;
          [...el.children].forEach((c, i) => c.classList.toggle('on', opcoes[i].v === valor));
          P.vibrar(10);
          onChange(op.v);
        },
      }, op.rotulo));
    });
    return el;
  }

  // Lista com busca numa folha → Promise<valor|null>
  const semAcento = s => String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  function escolher(o) {
    return new Promise(resolve => {
      let feito = false;
      const lista = h('div', { class: 'esc-lista' });
      const busca = h('input', { type: 'search', class: 'campo', placeholder: 'Buscar…', autocomplete: 'off' });
      function desenhar() {
        const q = semAcento(busca.value);
        lista.innerHTML = '';
        o.opcoes.filter(op => !q || semAcento(op.rotulo + ' ' + (op.sub || '')).includes(q)).forEach(op => {
          lista.appendChild(h('button', { type: 'button', class: 'esc-op', onClick: () => { feito = true; resolve(op.v); sh.fechar(); } },
            h('span', { class: 'esc-rot' }, op.rotulo), op.sub ? h('span', { class: 'esc-sub' }, op.sub) : null));
        });
        if (!lista.children.length) lista.appendChild(h('div', { class: 'vazio' }, 'Nada encontrado.'));
      }
      busca.addEventListener('input', desenhar);
      const sh = sheet(h('div', { class: 'esc' }, busca, lista), { titulo: o.titulo, cls: 'sheet-alta', onFechar: () => { if (!feito) resolve(null); } });
      desenhar();
    });
  }

  function baixar(nome, conteudo, tipo) {
    const blob = new Blob([conteudo], { type: tipo || 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = h('a', { href: url, download: nome, style: { display: 'none' } });
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 1500);
  }

  // ---------------------------------------------------------------
  //  Rotas
  // ---------------------------------------------------------------
  const rotas = [];
  function rota(padrao, def) { def.padrao = padrao; def.partes = padrao.split('/'); rotas.push(def); }
  function casar(hash) {
    const partes = hash.split('/').filter(Boolean);
    for (const def of rotas) {
      if (def.partes.length !== partes.length) continue;
      const params = {};
      let ok = true;
      def.partes.forEach((p, i) => {
        if (p.startsWith(':')) params[p.slice(1)] = decodeURIComponent(partes[i]);
        else if (p !== partes[i]) ok = false;
      });
      if (ok) return { def, params };
    }
    return null;
  }
  const TABS = {
    DONO: [
      { id: 'mesas', rota: 'mesas', rotulo: 'Mesas', icone: 'mesas' },
      { id: 'fluxo', rota: 'fluxo', rotulo: 'Fluxo', icone: 'fluxo' },
      { id: 'fichas', rota: 'fichas', rotulo: 'Fichas', icone: 'fichas' },
      { id: 'painel', rota: 'painel', rotulo: 'Painel', icone: 'painel' },
      { id: 'ajustes', rota: 'ajustes', rotulo: 'Ajustes', icone: 'ajustes' },
    ],
    OPERADOR: [
      { id: 'mesas', rota: 'mesas', rotulo: 'Mesas', icone: 'mesas' },
      { id: 'fluxo', rota: 'fluxo', rotulo: 'Fluxo', icone: 'fluxo' },
      { id: 'precos', rota: 'precos', rotulo: 'Preços', icone: 'preco' },
      { id: 'ajustes', rota: 'ajustes', rotulo: 'Conta', icone: 'ajustes' },
    ],
  };

  let atual = null;
  function render() {
    fecharSheets();
    if (atual && atual.cleanup) { try { atual.cleanup(); } catch (e) { console.error(e); } }
    atual = null;
    const view = $('#view');
    // append tolerante: ignora null/false e aceita listas (telas montam partes opcionais)
    if (!view._appendSeguro) { view.append = function () { for (let i = 0; i < arguments.length; i++) adicionar(view, arguments[i]); }; view._appendSeguro = true; }
    view.innerHTML = '';
    view.scrollTop = 0;
    view.className = '';
    view.removeAttribute('style');
    const u = P.Auth.usuario();
    if (!u) {
      document.body.classList.add('sem-sessao');
      P.Auth.telaPin(view);
      return;
    }
    document.body.classList.remove('sem-sessao');
    const hash = location.hash.replace(/^#\/?/, '');
    const m = casar(hash);
    if (!m || (m.def.dono && !P.Auth.isDono())) {
      if (hash !== 'mesas') location.replace('#/mesas');
      return;
    }
    let r = null;
    try { r = m.def.render(view, m.params) || {}; } catch (e) {
      console.error(e);
      view.appendChild(h('div', { class: 'vazio' }, 'Erro ao abrir a tela: ' + e.message));
      r = {};
    }
    atual = { def: m.def, cleanup: r.cleanup, onDados: r.onDados };
    montarTopo(m.def, m.params);
    montarTabbar(m.def);
  }
  P.on('dados', tabelas => {
    if (atual && atual.onDados) { try { atual.onDados(tabelas); } catch (e) { console.error(e); } }
    atualizarBadges();
  });

  function montarTopo(def, params) {
    const u = P.Auth.usuario();
    $('#top-titulo').textContent = typeof def.titulo === 'function' ? def.titulo(params) : (def.titulo || '');
    $('#top-user').textContent = u ? u.nome : '';
    atualizarPilula();
  }
  function montarTabbar(def) {
    const nav = $('#tabbar');
    const papel = P.Auth.isDono() ? 'DONO' : 'OPERADOR';
    const ativo = typeof def.tab === 'function' ? def.tab() : def.tab;
    nav.innerHTML = '';
    TABS[papel].forEach(t => {
      nav.appendChild(h('a', { href: '#/' + t.rota, class: t.id === ativo ? 'ativo' : '', 'data-tab': t.id },
        h('span', { class: 'tab-ic' }, icone(t.icone), h('span', { class: 'badge', hidden: true })),
        h('span', null, t.rotulo)));
    });
    atualizarBadges();
  }
  function atualizarBadges() {
    const nav = $('#tabbar');
    if (!nav || !P.Auth.usuario()) return;
    const velhos = P.Store.all('insumos').filter(P.Calc.precoVelho).length;
    const alvo = nav.querySelector('[data-tab="' + (P.Auth.isDono() ? 'fichas' : 'precos') + '"] .badge');
    if (alvo) { alvo.hidden = !velhos; alvo.textContent = velhos; }
  }

  // Pílula de status: online / offline / N pendentes
  function atualizarPilula() {
    const el = $('#top-sync');
    if (!el) return;
    const n = P.Store.pendentes();
    let cls, txt;
    if (!P.Sync.configurado()) { cls = 'local'; txt = 'sem nuvem'; }
    else if (P.Sync.estado === 'offline') { cls = 'off'; txt = n ? 'offline · ' + n + ' pend.' : 'offline'; }
    else if (P.Sync.estado === 'erro') { cls = 'off'; txt = 'erro de sync' + (n ? ' · ' + n : ''); }
    else if (n) { cls = 'pend'; txt = n + (n === 1 ? ' pendente' : ' pendentes'); }
    else if (P.Sync.estado === 'sincronizando') { cls = 'pend'; txt = 'sincronizando'; }
    else { cls = 'on'; txt = 'online'; }
    el.className = 'pilula ' + cls;
    el.textContent = txt;
  }
  P.on('sync', atualizarPilula);
  P.on('pendentes', atualizarPilula);

  function montarCasca() {
    const btnTema = h('button', { id: 'top-tema', type: 'button', class: 'top-ic', 'aria-label': 'Alternar tema claro/escuro', onClick: () => {
      tema(tema() === 'dark' ? 'light' : 'dark');
      btnTema.replaceChildren(icone(tema() === 'dark' ? 'sol' : 'lua'));
    } }, icone(tema() === 'dark' ? 'sol' : 'lua'));
    $('#topbar').replaceChildren(
      h('div', { id: 'top-titulo', class: 'top-titulo' }),
      h('button', { id: 'top-sync', type: 'button', class: 'pilula', onClick: () => { P.Sync.agendar(0); if (P.Auth.usuario()) location.hash = '#/ajustes'; } }),
      btnTema,
      h('button', { id: 'top-user', type: 'button', class: 'top-user', onClick: () => { if (P.Auth.usuario()) location.hash = '#/ajustes'; } }));
    window.addEventListener('hashchange', render);
  }

  // Sub-navegação dentro de um módulo
  function subnav(itens, ativo) {
    return h('div', { class: 'subnav' }, itens.map(i =>
      h('a', { href: '#/' + i.rota, class: i.id === ativo ? 'on' : '' }, i.rotulo,
        i.badge ? h('span', { class: 'badge-in' }, i.badge) : null)));
  }

  P.UI = {
    h, icone, tema, toast, sheet, fecharSheets, confirmar, numpad, pedirNumero, stepper, seg, escolher, baixar,
    rota, render, subnav, montarCasca, atualizarPilula, semAcento,
    vazio: msg => h('div', { class: 'vazio' }, msg),
  };
})();
