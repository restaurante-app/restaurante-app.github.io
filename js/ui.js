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
    compras: '<path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z"/><path d="M3 6h18"/><path d="M16 10a4 4 0 0 1-8 0"/>',
    mais_grade: '<rect width="7" height="7" x="3" y="3" rx="1.5"/><rect width="7" height="7" x="14" y="3" rx="1.5"/><rect width="7" height="7" x="14" y="14" rx="1.5"/><rect width="7" height="7" x="3" y="14" rx="1.5"/>',
    info: '<circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/>',
    caixa: '<path d="M19 7V4a1 1 0 0 0-1-1H5a2 2 0 0 0 0 4h15a1 1 0 0 1 1 1v4h-3a2 2 0 0 0 0 4h3a1 1 0 0 0 1-1v-2a1 1 0 0 0-1-1"/><path d="M3 5v14a2 2 0 0 0 2 2h15a1 1 0 0 0 1-1v-4"/>',
    relatorio: '<path d="M3 3v16a2 2 0 0 0 2 2h16"/><path d="M18 17V9"/><path d="M13 17V5"/><path d="M8 17v-3"/>',
    dinheiro: '<rect width="20" height="12" x="2" y="6" rx="2"/><circle cx="12" cy="12" r="2"/><path d="M6 12h.01M18 12h.01"/>',
    pix: '<path d="m12 2 4.2 4.2-4.2 4.2-4.2-4.2Z"/><path d="m12 13.6 4.2 4.2L12 22l-4.2-4.2Z"/><path d="m6.2 7.8 4.2 4.2-4.2 4.2L2 12Z"/><path d="m17.8 7.8 4.2 4.2-4.2 4.2-4.2-4.2Z"/>',
    cartao: '<rect width="20" height="14" x="2" y="5" rx="2"/><path d="M2 10h20"/>',
    fiado: '<path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>',
    prazo: '<rect width="18" height="18" x="3" y="4" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>',
    custos: '<path d="M22 7 13.5 15.5 8.5 10.5 2 17"/><path d="M16 7h6v6"/>',
    relogio: '<circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>',
    nuvem: '<path d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z"/>',
    usuario: '<path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>',
    fogo: '<path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.07-2.14-.22-4.05 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.15.43-2.29 1-3a2.5 2.5 0 0 0 2.5 2.5z"/>',
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
    if (meta) meta.setAttribute('content', atual === 'light' ? '#f6f1ea' : '#0c0a09');
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
      { id: 'painel', rota: 'painel', rotulo: 'Painel', icone: 'painel' },
      { id: 'mesas', rota: 'mesas', rotulo: 'Mesas', icone: 'mesas' },
      { id: 'compras', rota: 'compras', rotulo: 'Compras', icone: 'compras' },
      { id: 'fichas', rota: 'fichas', rotulo: 'Fichas', icone: 'fichas' },
      { id: 'mais', rota: 'mais', rotulo: 'Mais', icone: 'mais_grade' },
    ],
    OPERADOR: [
      { id: 'mesas', rota: 'mesas', rotulo: 'Mesas', icone: 'mesas' },
      { id: 'compras', rota: 'compras', rotulo: 'Compras', icone: 'compras' },
      { id: 'fluxo', rota: 'fluxo', rotulo: 'Fluxo', icone: 'fluxo' },
      { id: 'mais', rota: 'mais', rotulo: 'Mais', icone: 'mais_grade' },
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
    // entrada suave (só na troca de tela; atualizações ao vivo não re-animam).
    // Atributo e não classe: cada tela redefine o className do #view.
    clearTimeout(render._t);
    view.setAttribute('data-entra', '');
    render._t = setTimeout(() => view.removeAttribute('data-entra'), 900);
    let r = null;
    try { r = m.def.render(view, m.params) || {}; } catch (e) {
      console.error(e);
      view.appendChild(vazio('Erro ao abrir a tela: ' + e.message, 'alerta'));
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

  const iniciais = nome => String(nome || '?').trim().split(/\s+/).slice(0, 2).map(p => p[0]).join('').toUpperCase();
  function montarTopo(def, params) {
    const u = P.Auth.usuario();
    $('#top-titulo').textContent = typeof def.titulo === 'function' ? def.titulo(params) : (def.titulo || '');
    // ação da tela no topo (ex.: Painel → Relatório)
    const slot = $('#top-acao');
    slot.replaceChildren();
    if (def.acao) slot.appendChild(h('a', { class: 'top-acao', href: def.acao.href, 'aria-label': def.acao.rotulo, title: def.acao.rotulo }, icone(def.acao.icone), h('span', null, def.acao.rotulo)));
    const av = $('#top-user');
    av.textContent = u ? iniciais(u.nome) : '';
    av.className = 'avatar' + (u && u.papel === 'DONO' ? ' dono' : '');
    av.setAttribute('aria-label', u ? u.nome + ' — conta e mais opções' : 'Conta');
    atualizarSubtitulo();
    atualizarPilula();
  }
  function atualizarSubtitulo() {
    const el = $('#top-sub');
    if (el) el.textContent = P.Dia.rotulo(P.Dia.hoje()) + ' · ' + P.Dia.hora();
  }
  setInterval(atualizarSubtitulo, 20000);
  function montarTabbar(def) {
    const nav = $('#tabbar');
    const papel = P.Auth.isDono() ? 'DONO' : 'OPERADOR';
    const ativo = typeof def.tab === 'function' ? def.tab() : def.tab;
    const ind = nav.querySelector('.tab-ind') || h('span', { class: 'tab-ind', 'aria-hidden': 'true' });
    nav.replaceChildren(ind);
    TABS[papel].forEach(t => {
      nav.appendChild(h('a', { href: '#/' + t.rota, class: t.id === ativo ? 'ativo' : '', 'data-tab': t.id, 'aria-current': t.id === ativo ? 'page' : null },
        h('span', { class: 'tab-ic' }, icone(t.icone), h('span', { class: 'badge', hidden: true })),
        h('span', { class: 'tab-rot' }, t.rotulo)));
    });
    posicionarIndicador();
    atualizarBadges();
  }
  // pílula de brasa que desliza até a aba ativa
  function posicionarIndicador() {
    const nav = $('#tabbar');
    const ind = nav && nav.querySelector('.tab-ind');
    const a = nav && nav.querySelector('a.ativo');
    if (!ind) return;
    if (!a) { ind.style.opacity = '0'; return; }
    ind.style.opacity = '1';
    ind.style.width = a.offsetWidth + 'px';
    ind.style.transform = 'translateX(' + a.offsetLeft + 'px)';
  }
  window.addEventListener('resize', posicionarIndicador);
  function marcar(tab, n, tipo) {
    const b = $('#tabbar [data-tab="' + tab + '"] .badge');
    if (!b) return;
    b.hidden = !n;
    b.textContent = n;
    b.className = 'badge' + (tipo ? ' ' + tipo : '');
  }
  function atualizarBadges() {
    if (!$('#tabbar') || !P.Auth.usuario()) return;
    const velhos = P.Store.all('insumos').filter(P.Calc.precoVelho).length;
    const abertas = P.Store.all('comandas').filter(c => c.status === 'ABERTA' && P.Mesas && P.Mesas.linhas(c.id).length).length;
    const aPagar = P.Compras ? P.Compras.aPagar().length : 0;
    marcar('mesas', abertas, 'info');
    marcar('compras', aPagar, 'aviso');
    if (P.Auth.isDono()) marcar('fichas', velhos, 'aviso');
    else marcar('mais', velhos, 'aviso');
  }

  // Pílula de status: online / offline / N pendentes
  function atualizarPilula() {
    const el = $('#top-sync');
    if (!el) return;
    const n = P.Store.pendentes();
    let cls, txt;
    if (!P.Sync.configurado()) { cls = 'local'; txt = 'no aparelho'; }
    else if (!P.Sync.conectado()) { cls = 'pend'; txt = 'conectar nuvem'; }
    else if (P.Sync.estado === 'offline') { cls = 'off'; txt = n ? 'offline · ' + n : 'offline'; }
    else if (P.Sync.estado === 'erro') { cls = 'off'; txt = 'erro' + (n ? ' · ' + n : ''); }
    else if (n) { cls = 'pend'; txt = n + (n === 1 ? ' pendente' : ' pendentes'); }
    else if (P.Sync.estado === 'sincronizando') { cls = 'pend'; txt = 'enviando'; }
    else { cls = 'on'; txt = 'online'; }
    el.className = 'pilula ' + cls;
    el.textContent = txt;
    el.title = !P.Sync.configurado() ? 'Dados guardados só neste aparelho' : !P.Sync.conectado() ? 'Toque para conectar este aparelho à nuvem' : 'Sincronização';
  }
  P.on('sync', atualizarPilula);
  P.on('pendentes', atualizarPilula);

  function montarCasca() {
    $('#topbar').replaceChildren(
      h('a', { class: 'top-marca', href: '#/', 'aria-label': 'Início', onClick: e => { e.preventDefault(); location.hash = P.Auth.isDono() ? '#/painel' : '#/mesas'; } },
        marca(38)),
      h('div', { class: 'top-tit' }, h('div', { id: 'top-titulo', class: 'top-titulo' }), h('div', { id: 'top-sub', class: 'top-sub' })),
      h('span', { id: 'top-acao' }),
      h('button', { id: 'top-sync', type: 'button', class: 'pilula', onClick: async () => {
        if (!P.Auth.usuario()) return;
        if (P.Sync.configurado() && !P.Sync.conectado()) { await P.Auth.conectarNuvem(); atualizarPilula(); return; }
        P.Sync.agendar(0);
        location.hash = '#/ajustes';
      } }),
      h('button', { id: 'top-user', type: 'button', class: 'avatar', onClick: () => { if (P.Auth.usuario()) location.hash = '#/mais'; } }));
    window.addEventListener('hashchange', render);
  }

  // Sub-navegação dentro de um módulo
  function subnav(itens, ativo) {
    return h('div', { class: 'subnav' }, itens.map(i =>
      h('a', { href: '#/' + i.rota, class: i.id === ativo ? 'on' : '' }, i.rotulo,
        i.badge ? h('span', { class: 'badge-in' }, i.badge) : null)));
  }
  function vazio(msg, ic) {
    return h('div', { class: 'vazio' }, h('div', { class: 'vazio-ic' }, icone(ic || 'info')), h('p', null, msg));
  }

  // ---------------------------------------------------------------
  //  Marca (espeto na brasa) — SVG, nítido em qualquer tamanho
  // ---------------------------------------------------------------
  let nMarca = 0;
  function marca(tam, cls) {
    const id = 'mk' + (++nMarca);
    const w = document.createElement('span');
    w.className = 'marca' + (cls ? ' ' + cls : '');
    w.style.setProperty('--t', (tam || 36) + 'px');
    w.innerHTML = '<svg viewBox="0 0 48 48" aria-hidden="true">' +
      '<defs><linearGradient id="' + id + 'b" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ffc063"/><stop offset=".5" stop-color="#ff6b2c"/><stop offset="1" stop-color="#d4331a"/></linearGradient>' +
      '<radialGradient id="' + id + 'f" cx=".3" cy=".15" r="1.05"><stop offset="0" stop-color="#3a2519"/><stop offset=".55" stop-color="#1a120e"/><stop offset="1" stop-color="#0d0908"/></radialGradient>' +
      '<radialGradient id="' + id + 'g" cx=".5" cy=".62" r=".5"><stop offset="0" stop-color="#ff6b2c" stop-opacity=".55"/><stop offset="1" stop-color="#ff6b2c" stop-opacity="0"/></radialGradient></defs>' +
      '<rect width="48" height="48" rx="13" fill="url(#' + id + 'f)"/>' +
      '<ellipse cx="24" cy="30" rx="20" ry="15" fill="url(#' + id + 'g)"/>' +
      '<rect x=".5" y=".5" width="47" height="47" rx="12.5" fill="none" stroke="#ffd2ad" stroke-opacity=".16"/>' +
      '<g transform="rotate(-42 24 24)"><line x1="6" y1="24" x2="42" y2="24" stroke="#f3dcc2" stroke-width="1.9" stroke-linecap="round"/>' +
      '<rect x="10.5" y="18" width="7.5" height="12" rx="3.2" fill="url(#' + id + 'b)"/>' +
      '<rect x="20.3" y="18" width="7.5" height="12" rx="3.2" fill="#f6ede3"/>' +
      '<rect x="30.1" y="18" width="7.5" height="12" rx="3.2" fill="url(#' + id + 'b)"/></g>' +
      '<circle cx="37" cy="37.5" r="1.5" fill="#ffb049"/><circle cx="32.5" cy="41" r="1" fill="#ff8a3c" opacity=".8"/><circle cx="40.5" cy="32" r=".9" fill="#ffc063" opacity=".7"/>' +
      '</svg>';
    return w;
  }

  // ---------------------------------------------------------------
  //  Visualizações pequenas. Regras: status sempre com ícone + texto;
  //  cor de série só na marca (nunca no texto); canais em ordem fixa
  //  salão → espeto → marmita (paleta validada p/ daltonismo, ver CSS).
  // ---------------------------------------------------------------
  const SVGNS = 'http://www.w3.org/2000/svg';
  function svg(tag, attrs) { const e = document.createElementNS(SVGNS, tag); for (const k in attrs) e.setAttribute(k, attrs[k]); return e; }
  const entrando = () => { const v = $('#view'); return !!(v && v.hasAttribute('data-entra')); };
  const semMovimento = () => window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;

  // status: 'bom' | 'atencao' | 'critico' | 'neutro'
  const ST_ICONE = { bom: 'check', atencao: 'alerta', critico: 'alerta', neutro: 'info' };
  function statusPill(st, rotulo) {
    return h('span', { class: 'st-pill st-' + st }, icone(ST_ICONE[st] || 'info'), rotulo);
  }

  // Anel: fração (0..1) de uma meta; o preenchimento carrega o status
  function anel(frac, st, centro, rotuloAria) {
    const r = 29, circ = 2 * Math.PI * r;
    const f = Math.max(0, Math.min(1, +frac || 0));
    const s = svg('svg', { viewBox: '0 0 72 72', 'aria-hidden': 'true' });
    s.appendChild(svg('circle', { cx: 36, cy: 36, r, class: 'anel-trilho' }));
    const arco = svg('circle', { cx: 36, cy: 36, r, class: 'anel-arco', 'stroke-dasharray': circ.toFixed(2), transform: 'rotate(-90 36 36)' });
    const alvo = (circ * (1 - f)).toFixed(2);
    if (entrando() && !semMovimento()) {
      arco.setAttribute('stroke-dashoffset', circ.toFixed(2));
      requestAnimationFrame(() => requestAnimationFrame(() => arco.setAttribute('stroke-dashoffset', alvo)));
    } else arco.setAttribute('stroke-dashoffset', alvo);
    s.appendChild(arco);
    return h('div', { class: 'anel st-' + st, role: 'img', 'aria-label': rotuloAria || '' }, s, h('div', { class: 'anel-c' }, centro));
  }

  // Barra empilhada (parte do todo) + legenda com valores sempre visíveis
  function pilha(partes, fmt) {
    const total = partes.reduce((s, p) => s + Math.max(0, +p.valor || 0), 0);
    const barra = h('div', { class: 'pilha-b' + (total ? '' : ' vazia'), role: 'img',
      'aria-label': partes.map(p => p.rotulo + ' ' + fmt(p.valor)).join(', ') });
    if (total) partes.forEach(p => {
      if (!(p.valor > 0)) return;
      barra.appendChild(h('span', { class: 'pilha-s serie-' + p.serie, style: { flexGrow: String(p.valor) }, title: p.rotulo + ': ' + fmt(p.valor) }));
    });
    const leg = h('div', { class: 'pilha-leg' }, partes.map(p => h('span', { class: 'leg-i' },
      h('i', { class: 'leg-dot serie-' + p.serie }), h('span', null, p.rotulo), h('b', null, fmt(p.valor)),
      total && p.valor > 0 ? h('small', null, Math.round(p.valor / total * 100) + '%') : null)));
    return h('div', { class: 'pilha' }, barra, leg);
  }

  // Colunas pequenas (uma série; o dia atual em destaque, os outros apagados)
  function barraPath(x, y0, w, v, raio) {
    const up = v >= 0, hgt = Math.abs(v), r = Math.min(raio, hgt, w / 2);
    if (hgt < 0.5) return '';
    if (up) {
      const top = y0 - hgt;
      return 'M' + x + ',' + y0 + 'V' + (top + r) + 'Q' + x + ',' + top + ' ' + (x + r) + ',' + top + 'H' + (x + w - r) + 'Q' + (x + w) + ',' + top + ' ' + (x + w) + ',' + (top + r) + 'V' + y0 + 'Z';
    }
    const bot = y0 + hgt;
    return 'M' + x + ',' + y0 + 'V' + (bot - r) + 'Q' + x + ',' + bot + ' ' + (x + r) + ',' + bot + 'H' + (x + w - r) + 'Q' + (x + w) + ',' + bot + ' ' + (x + w) + ',' + (bot - r) + 'V' + y0 + 'Z';
  }
  function colunas(itens, fmt, o) {
    o = o || {};
    const W = o.largura || 128, H = o.altura || 44, n = itens.length || 1;
    const vals = itens.map(i => (i.valor == null ? 0 : +i.valor));
    const maxP = Math.max(0, ...vals), maxN = Math.max(0, ...vals.map(v => -v));
    const escala = (H - 6) / Math.max(1, maxP + maxN);
    const y0 = 3 + maxP * escala;
    const passo = W / n, bw = Math.min(14, passo * 0.62);
    const s = svg('svg', { viewBox: '0 0 ' + W + ' ' + H, width: W, height: H, class: 'cols', 'aria-hidden': 'true' });
    s.appendChild(svg('line', { x1: 0, x2: W, y1: y0, y2: y0, class: 'cols-base' }));
    itens.forEach((it, i) => {
      const x = i * passo + (passo - bw) / 2;
      const g = svg('g', { class: 'cols-g' + (it.atual ? ' atual' : '') + (it.valor == null ? ' nulo' : '') });
      const t = svg('title', {}); t.textContent = it.rotulo + ': ' + (it.valor == null ? 'sem movimento' : fmt(it.valor)); g.appendChild(t);
      g.appendChild(svg('rect', { x: i * passo, y: 0, width: passo, height: H, class: 'cols-hit' }));
      if (it.valor == null) g.appendChild(svg('circle', { cx: x + bw / 2, cy: y0, r: 1.6, class: 'cols-nulo' }));
      else { const d = barraPath(x, y0, bw, it.valor * escala, 3); if (d) g.appendChild(svg('path', { d, class: 'cols-b' })); }
      s.appendChild(g);
    });
    return h('div', { class: 'cols-w', role: 'img', 'aria-label': o.aria || '' }, s,
      h('div', { class: 'cols-x' }, itens.map(it => h('span', { class: it.atual ? 'atual' : null }, it.curto))));
  }

  // Medidor horizontal com marcas de referência (limites/metas)
  function medidor(frac, st, marcas) {
    const f = Math.max(0, Math.min(1, +frac || 0));
    const fill = h('span', { class: 'med-f', style: { width: (entrando() && !semMovimento() ? 0 : f * 100) + '%' } });
    if (entrando() && !semMovimento()) requestAnimationFrame(() => requestAnimationFrame(() => { fill.style.width = f * 100 + '%'; }));
    return h('div', { class: 'med st-' + st }, h('span', { class: 'med-t' }, fill,
      (marcas || []).map(m => h('i', { class: 'med-m', style: { left: Math.max(0, Math.min(100, m * 100)) + '%' } }))));
  }

  // Número que "conta" até o valor quando a tela abre
  function contar(el, alvo, fmt) {
    if (!entrando() || semMovimento() || !isFinite(alvo)) { el.textContent = fmt(alvo); return el; }
    const t0 = performance.now(), dur = 650;
    el.textContent = fmt(0);
    const passo = t => {
      const p = Math.min(1, (t - t0) / dur), e = 1 - Math.pow(1 - p, 3);
      el.textContent = fmt(alvo * e);
      if (p < 1) requestAnimationFrame(passo);
    };
    requestAnimationFrame(passo);
    return el;
  }

  P.UI = {
    h, icone, tema, toast, sheet, fecharSheets, confirmar, numpad, pedirNumero, stepper, seg, escolher, baixar,
    rota, render, subnav, montarCasca, atualizarPilula, semAcento, iniciais, vazio,
    marca, statusPill, anel, pilha, colunas, medidor, contar,
  };
})();
