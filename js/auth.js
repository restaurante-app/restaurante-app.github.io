/* Acesso por PIN de 4 dígitos, com papéis DONO e OPERADOR.
   A verificação é local (funciona offline). A sessão do OPERADOR fica aberta;
   a do DONO trava sozinha depois de 10 min com o app em segundo plano. */
(function () {
  'use strict';
  const P = window.P;
  const h = P.UI.h;
  const LS = 'pari.sessao';
  const TRAVA_DONO_MS = 10 * 60 * 1000;

  let sessao = ler();
  let teclasPin = null;
  function ler() { try { return JSON.parse(localStorage.getItem(LS)); } catch (e) { return null; } }
  function gravar(s) {
    sessao = s;
    try { if (s) localStorage.setItem(LS, JSON.stringify(s)); else localStorage.removeItem(LS); } catch (e) { /* ok */ }
  }
  const hash = pin => P.sha256('pari:' + pin);

  function usuario() {
    if (!sessao) return null;
    return P.Store.get('usuarios', sessao.id);
  }
  function isDono() { const u = usuario(); return !!u && u.papel === 'DONO'; }

  function marcarVisto() { if (sessao) { sessao.visto = Date.now(); gravar(sessao); } }
  function travarSeExpirou() {
    if (sessao && sessao.papel === 'DONO' && sessao.visto && Date.now() - sessao.visto > TRAVA_DONO_MS) {
      gravar(null);
      return true;
    }
    return false;
  }
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) { marcarVisto(); return; }
    if (travarSeExpirou()) P.UI.render();
    else marcarVisto();
  });
  setInterval(() => { if (!document.hidden) marcarVisto(); }, 60000);

  function entrarComo(u) {
    gravar({ id: u.id, papel: u.papel, visto: Date.now() });
    P.vibrar(25);
    const destino = u.papel === 'DONO' ? '#/painel' : '#/mesas';
    if (!location.hash || location.hash === '#/' || location.hash === destino) {
      if (location.hash === destino) P.UI.render(); else location.hash = destino;
    } else P.UI.render();
  }
  function sair() { gravar(null); P.UI.render(); }

  function pinEmUso(pin, excetoId) {
    const hs = hash(pin);
    return P.Store.all('usuarios').some(u => u.pin_hash === hs && u.id !== excetoId);
  }
  function criarUsuario({ nome, pin, papel }) {
    if (!/^\d{4}$/.test(pin)) throw new Error('O PIN precisa ter 4 dígitos.');
    if (pinEmUso(pin)) throw new Error('Esse PIN já é de outra pessoa.');
    return P.Store.put('usuarios', { id: P.uuid(), nome: (nome || '').trim() || (papel === 'DONO' ? 'Dono' : 'Operador'), pin_hash: hash(pin), papel });
  }
  function trocarPin(id, pin) {
    const u = P.Store.get('usuarios', id);
    if (!u) return;
    if (!/^\d{4}$/.test(pin)) throw new Error('O PIN precisa ter 4 dígitos.');
    if (pinEmUso(pin, id)) throw new Error('Esse PIN já é de outra pessoa.');
    P.Store.put('usuarios', Object.assign({}, u, { pin_hash: hash(pin) }));
  }
  function removerUsuario(id) {
    const u = P.Store.get('usuarios', id);
    if (!u) return;
    if (sessao && sessao.id === id) throw new Error('Você não pode remover a si mesmo.');
    if (u.papel === 'DONO' && P.Store.all('usuarios').filter(x => x.papel === 'DONO').length <= 1) throw new Error('Precisa existir pelo menos um DONO.');
    P.Store.remove('usuarios', id);
  }

  // Teclado de PIN (dígitos soltos, aceita zero à esquerda)
  function tecladoPin(onTecla) {
    const el = h('div', { class: 'numpad pin-pad' });
    ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', '⌫'].forEach(t => {
      if (!t) { el.appendChild(h('span')); return; }
      el.appendChild(h('button', { type: 'button', class: 'np-k' + (t === '⌫' ? ' np-fn' : ''), 'aria-label': t === '⌫' ? 'apagar' : t, onClick: () => onTecla(t) },
        t === '⌫' ? P.UI.icone('backspace') : t));
    });
    return el;
  }
  // Pede um PIN novo numa folha (usado nos Ajustes) → Promise<string|null>
  function pedirPin(titulo) {
    return new Promise(resolve => {
      let pin = '';
      let feito = false;
      const dots = h('div', { class: 'pin-dots' }, [0, 1, 2, 3].map(() => h('span')));
      const pad = tecladoPin(t => {
        P.vibrar(8);
        if (t === '⌫') pin = pin.slice(0, -1); else if (pin.length < 4) pin += t;
        [...dots.children].forEach((d, i) => d.classList.toggle('on', i < pin.length));
        if (pin.length === 4) setTimeout(() => { feito = true; resolve(pin); sh.fechar(); }, 150);
      });
      const sh = P.UI.sheet(h('div', { class: 'np-sheet' }, dots, pad), { titulo, onFechar: () => { if (!feito) resolve(null); } });
    });
  }

  function telaPin(view) {
    view.className = 'v-pin';
    const primeiro = P.Store.all('usuarios').length === 0;
    let etapa = primeiro ? 'criar' : 'entrar';
    let pin = '';
    let pinCriado = '';
    const tit = h('div', { class: 'pin-tit' });
    const sub = h('div', { class: 'pin-sub' });
    const dots = h('div', { class: 'pin-dots' }, [0, 1, 2, 3].map(() => h('span')));
    const msg = h('div', { class: 'pin-msg' });
    const pad = tecladoPin(tecla);

    function tecla(t) {
      P.vibrar(8);
      msg.textContent = '';
      if (t === '⌫') pin = pin.slice(0, -1);
      else if (pin.length < 4) pin += t;
      desenhar();
      if (pin.length === 4) setTimeout(enviar, 140);
    }
    function erro(txt) {
      msg.textContent = txt;
      P.vibrar([60, 50, 60]);
      dots.classList.remove('treme');
      void dots.offsetWidth;
      dots.classList.add('treme');
      pin = '';
      desenhar();
    }
    function enviar() {
      if (pin.length !== 4) return;
      if (etapa === 'entrar') {
        const hs = hash(pin);
        const u = P.Store.all('usuarios').find(x => x.pin_hash === hs);
        if (!u) { erro('PIN não reconhecido'); return; }
        entrarComo(u);
      } else if (etapa === 'criar') {
        pinCriado = pin; pin = ''; etapa = 'confirmar'; desenhar();
      } else {
        if (pin !== pinCriado) { etapa = 'criar'; pinCriado = ''; erro('Os PINs não conferem. Crie de novo.'); return; }
        const u = criarUsuario({ nome: 'Dono', pin, papel: 'DONO' });
        entrarComo(u);
      }
    }
    function desenhar() {
      tit.textContent = etapa === 'entrar' ? 'Digite seu PIN' : etapa === 'criar' ? 'Crie o PIN do DONO' : 'Confirme o PIN';
      sub.textContent = etapa === 'entrar' ? '' : 'Primeiro acesso neste aparelho. 4 dígitos.';
      [...dots.children].forEach((d, i) => d.classList.toggle('on', i < pin.length));
    }
    if (teclasPin) document.removeEventListener('keydown', teclasPin);
    teclasPin = e => {
      if (!document.body.classList.contains('sem-sessao')) return;
      if (/^[0-9]$/.test(e.key)) tecla(e.key);
      else if (e.key === 'Backspace') tecla('⌫');
    };
    document.addEventListener('keydown', teclasPin);

    // Aparelho novo: primeiro baixa os dados da nuvem (PINs, fichas, vendas) em vez de começar do zero
    const aviso = (primeiro && P.Sync.configurado() && !P.Sync.conectado())
      ? h('div', { class: 'pin-nuvem' },
        h('button', { type: 'button', class: 'btn primario bloco', onClick: async () => {
          if (await conectarNuvem()) P.UI.render();
        } }, P.UI.icone('nuvem'), 'Já uso em outro aparelho — conectar à nuvem'),
        h('div', { class: 'pin-aviso' }, 'Use o e-mail e a senha da nuvem. Os dados e os PINs do outro aparelho aparecem aqui. Primeira vez de todas? Crie o PIN acima.'))
      : null;
    view.append(
      h('div', { class: 'pin-marca' },
        P.UI.marca(92, 'pin-logo'),
        h('div', { class: 'pin-nome' }, 'Pátio do Pari'),
        h('div', { class: 'pin-nome2' }, 'Restaurante · Brás')),
      tit, sub, dots, msg, pad, aviso);
    desenhar();
  }

  // Folha para conectar este aparelho à nuvem → Promise<boolean>
  function conectarNuvem() {
    return new Promise(resolve => {
      let feito = false;
      const email = h('input', { class: 'campo', type: 'email', placeholder: 'E-mail da nuvem', autocomplete: 'username', inputmode: 'email' });
      const senha = h('input', { class: 'campo', type: 'password', placeholder: 'Senha da nuvem', autocomplete: 'current-password' });
      const msg = h('div', { class: 'pin-msg' });
      const btn = h('button', { type: 'button', class: 'btn primario grow' }, 'Conectar');
      async function ir() {
        if (!email.value.trim() || !senha.value) { msg.textContent = 'Preencha e-mail e senha.'; return; }
        btn.disabled = true;
        btn.textContent = 'Conectando…';
        msg.textContent = '';
        try {
          await P.Sync.entrar(email.value, senha.value);
          feito = true;
          P.vibrar([20, 40, 20]);
          resolve(true);
          sh.fechar();
          P.UI.toast(P.Sync.estado === 'online' ? 'Conectado à nuvem — dados sincronizados'
            : P.Sync.estado === 'erro' ? 'Conectado, mas a nuvem recusou os dados: ' + P.Sync.ultimoErro
              : 'Conectado. Os dados sincronizam quando houver internet.', { tipo: P.Sync.estado === 'erro' ? 'perigo' : '', ms: 6000 });
        } catch (e) {
          const t = String(e.message || e);
          msg.textContent = /invalid/i.test(t) ? 'E-mail ou senha errados.' : /confirm/i.test(t) ? 'Esse usuário ainda não foi confirmado no Supabase.' : navigator.onLine === false ? 'Sem internet agora. Tente de novo com rede.' : 'Não deu para conectar: ' + t;
          btn.disabled = false;
          btn.textContent = 'Conectar';
          P.vibrar([60, 50, 60]);
        }
      }
      btn.addEventListener('click', ir);
      senha.addEventListener('keydown', e => { if (e.key === 'Enter') ir(); });
      const sh = P.UI.sheet(h('div', { class: 'np-sheet' },
        h('div', { class: 'np-sub' }, 'Uma vez por aparelho. Depois tudo que for lançado aqui aparece nos outros aparelhos conectados, e vice-versa.'),
        email, senha, msg,
        h('div', { class: 'row gap' }, h('button', { type: 'button', class: 'btn', onClick: () => sh.fechar() }, 'Cancelar'), btn)),
      { titulo: 'Conectar à nuvem', onFechar: () => { if (!feito) resolve(false); } });
      setTimeout(() => email.focus(), 80);
    });
  }

  P.Auth = { usuario, isDono, sair, telaPin, criarUsuario, trocarPin, removerUsuario, pinEmUso, pedirPin, travarSeExpirou, hash, conectarNuvem };
})();
