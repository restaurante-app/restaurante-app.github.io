/* Armazenamento OFFLINE-FIRST.
   - Toda leitura é da memória (instantânea). Toda escrita vai para a memória
     e para o IndexedDB, e entra numa fila (_outbox).
   - A fila é enviada ao Supabase quando houver rede. Nada na tela espera a rede.
   - Conflito entre aparelhos: vence a alteração mais recente (modificado_em).
   - Exclusão é "suave" (excluido = true) para poder sincronizar. */
(function () {
  'use strict';
  const P = window.P;

  const DB_NAME = 'pari-restaurante';
  const DB_VERSION = 1;

  // Colunas que existem no servidor. Só elas são enviadas.
  const SCHEMA = {
    usuarios: ['id', 'nome', 'pin_hash', 'papel'],
    config: ['chave', 'valor_json'],
    contagens: ['id', 'dia_operacional', 'faixa_hora', 'modo', 'quantidade', 'usuario_id', 'criado_em', 'encerrado'],
    insumos: ['id', 'nome', 'unidade', 'preco', 'fator_correcao', 'atualizado_em'],
    itens: ['id', 'nome', 'categoria', 'preco_venda', 'perda_pct', 'ativo'],
    componentes: ['id', 'item_id', 'insumo_id', 'item_componente_id', 'gramas', 'ordem'],
    historico_precos: ['id', 'insumo_id', 'preco', 'data'],
    comandas: ['id', 'dia_operacional', 'mesa', 'cliente', 'canal', 'status', 'aberta_em', 'fechada_em', 'desconto', 'total',
      'usuario_id', 'fechada_por', 'cancelada_por', 'obs'],
    comanda_itens: ['id', 'comanda_id', 'item_id', 'nome', 'quantidade', 'preco_unit', 'cmv_unit', 'adicionado_em', 'usuario_id',
      'removidos', 'removido_por', 'removido_em'],
    pagamentos: ['id', 'comanda_id', 'dia_operacional', 'forma', 'valor', 'pago_em', 'usuario_id', 'recebido_em', 'recebido_dia', 'recebido_forma'],
    despesas: ['id', 'dia_operacional', 'categoria', 'descricao', 'valor', 'criado_em', 'usuario_id'],
    compras: ['id', 'dia_operacional', 'fornecedor', 'forma', 'total', 'criado_em', 'usuario_id',
      'pago_em', 'pago_dia', 'pago_forma', 'obs'],
    compra_itens: ['id', 'compra_id', 'insumo_id', 'descricao', 'quantidade', 'unidade', 'preco_unit', 'valor', 'ordem'],
  };
  const COMUNS = ['modificado_em', 'excluido'];
  const TABLES = Object.keys(SCHEMA);
  const CHAVE = { config: 'chave' };
  const keyField = t => CHAVE[t] || 'id';
  const keyOf = (t, r) => r[keyField(t)];
  const ts = v => (v ? Date.parse(v) : 0) || 0;

  let idb = null;
  const mem = {};                 // tabela → Map(chave → registro)
  const outbox = new Map();       // 't:chave' → {k, t, key}
  const revs = new Map();         // 't:chave' → nº de alterações locais (desde que o app abriu)
  const meta = {};                // cursores de sincronização etc.

  // ---------------------------------------------------------------
  //  IndexedDB (baixo nível)
  // ---------------------------------------------------------------
  function openIDB() {
    return new Promise((res, rej) => {
      const rq = indexedDB.open(DB_NAME, DB_VERSION);
      rq.onupgradeneeded = () => {
        const db = rq.result;
        TABLES.forEach(t => { if (!db.objectStoreNames.contains(t)) db.createObjectStore(t, { keyPath: keyField(t) }); });
        if (!db.objectStoreNames.contains('_outbox')) db.createObjectStore('_outbox', { keyPath: 'k' });
        if (!db.objectStoreNames.contains('_meta')) db.createObjectStore('_meta', { keyPath: 'k' });
      };
      rq.onsuccess = () => res(rq.result);
      rq.onerror = () => rej(rq.error);
    });
  }
  function getAll(store) {
    return new Promise((res, rej) => {
      const rq = idb.transaction(store, 'readonly').objectStore(store).getAll();
      rq.onsuccess = () => res(rq.result || []);
      rq.onerror = () => rej(rq.error);
    });
  }

  // Escritas agrupadas numa única transação por "tique"
  const pendentes = new Map();    // 't:chave' → {t, rec, fila}
  const remocoesFila = new Set(); // chaves do _outbox a apagar
  let agendado = false;
  function agendarGravacao() {
    if (agendado) return;
    agendado = true;
    setTimeout(gravarAgora, 0);
  }
  function gravarAgora() {
    agendado = false;
    if (!idb || (!pendentes.size && !remocoesFila.size)) { pendentes.clear(); remocoesFila.clear(); return; }
    const lote = [...pendentes.values()];
    const apagar = [...remocoesFila];
    pendentes.clear();
    remocoesFila.clear();
    const stores = [...new Set(lote.map(b => b.t).concat(['_outbox']))];
    try {
      const tx = idb.transaction(stores, 'readwrite');
      lote.forEach(b => {
        tx.objectStore(b.t).put(b.rec);
        if (b.fila) {
          const key = keyOf(b.t, b.rec);
          tx.objectStore('_outbox').put({ k: b.t + ':' + key, t: b.t, key });
        }
      });
      apagar.forEach(k => { if (!outbox.has(k)) tx.objectStore('_outbox').delete(k); });
      tx.onerror = () => console.error('IndexedDB', tx.error);
    } catch (e) { console.error('IndexedDB', e); }
  }
  function gravarMeta(k, v) {
    meta[k] = v;
    if (!idb) return;
    try { idb.transaction('_meta', 'readwrite').objectStore('_meta').put({ k, v }); } catch (e) { console.error(e); }
  }

  // Avisa as telas quais tabelas mudaram (agrupa as gravações seguidas num aviso só).
  // setTimeout e não requestAnimationFrame: rAF para quando o app está em segundo plano.
  const mudadas = new Set();
  let avisoAgendado = false;
  function avisar(t) {
    mudadas.add(t);
    if (avisoAgendado) return;
    avisoAgendado = true;
    setTimeout(() => {
      avisoAgendado = false;
      const set = new Set(mudadas);
      mudadas.clear();
      P.emit('dados', set);
    });
  }

  // ---------------------------------------------------------------
  //  API pública do Store
  // ---------------------------------------------------------------
  const Store = P.Store = {
    TABLES, SCHEMA,
    versao: 0,
    persistente: true,

    async init() {
      TABLES.forEach(t => { mem[t] = new Map(); });
      try {
        idb = await openIDB();
        for (const t of TABLES) (await getAll(t)).forEach(r => mem[t].set(keyOf(t, r), r));
        (await getAll('_outbox')).forEach(o => outbox.set(o.k, o));
        (await getAll('_meta')).forEach(m => { meta[m.k] = m.v; });
        if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});
      } catch (e) {
        console.error('IndexedDB indisponível — dados só na memória', e);
        idb = null;
        Store.persistente = false;
      }
      Store.versao++;
    },

    all(t) {
      const out = [];
      mem[t].forEach(r => { if (!r.excluido) out.push(r); });
      return out;
    },
    get(t, key) {
      const r = mem[t].get(key);
      return r && !r.excluido ? r : null;
    },
    // inclusive excluídos (relatório de cancelamentos)
    todos(t) { return [...mem[t].values()]; },
    // opts: silent (não avisa telas), stamp:false (mantém modificado_em), fila:false (não sincroniza)
    put(t, rec, opts) {
      opts = opts || {};
      const r = Object.assign({}, rec);
      if (opts.stamp !== false || !r.modificado_em) r.modificado_em = P.agoraISO();
      if (r.excluido == null) r.excluido = false;
      const key = keyOf(t, r);
      if (key == null) throw new Error('registro sem chave em ' + t);
      mem[t].set(key, r);
      Store.versao++;
      const k = t + ':' + key;
      const fila = opts.fila !== false;
      if (fila) {
        revs.set(k, (revs.get(k) || 0) + 1);
        outbox.set(k, { k, t, key });
      }
      pendentes.set(k, { t, rec: r, fila });
      agendarGravacao();
      if (!opts.silent) avisar(t);
      if (fila) { P.emit('pendentes', outbox.size); Sync.agendar(); }
      return r;
    },
    putMany(t, recs, opts) {
      opts = Object.assign({}, opts, { silent: true });
      recs.forEach(r => Store.put(t, r, opts));
      avisar(t);
    },
    remove(t, key) {
      const r = mem[t].get(key);
      if (!r) return;
      Store.put(t, Object.assign({}, r, { excluido: true }));
    },
    gravarJa() { gravarAgora(); },
    pendentes: () => outbox.size,
    meta: k => meta[k],
    setMeta: gravarMeta,
    // backup: tudo, inclusive excluídos (para restaurar com fidelidade)
    exportar() {
      const out = { app: 'pari-restaurante', versao: 1, exportado_em: P.agoraISO(), tabelas: {} };
      TABLES.forEach(t => { out.tabelas[t] = [...mem[t].values()]; });
      return out;
    },
    importar(obj) {
      let n = 0;
      TABLES.forEach(t => {
        const rows = (obj && obj.tabelas && obj.tabelas[t]) || [];
        rows.forEach(r => {
          const atual = mem[t].get(keyOf(t, r));
          if (atual && ts(atual.modificado_em) >= ts(r.modificado_em)) return;
          Store.put(t, r, { stamp: false, silent: true });
          n++;
        });
        avisar(t);
      });
      return n;
    },
  };

  // ---------------------------------------------------------------
  //  Sincronização com o Supabase (REST / PostgREST)
  // ---------------------------------------------------------------
  let timer = null;
  let rodando = false;
  let deNovo = false;

  function cfg() { return P.CONFIG || {}; }
  function configurado() { return !!(cfg().SUPABASE_URL && cfg().SUPABASE_ANON_KEY); }
  const baseUrl = () => cfg().SUPABASE_URL.replace(/\/+$/, '');

  // ---------------------------------------------------------------
  //  Login na nuvem (Supabase Auth). Os dados só abrem com o e-mail e a
  //  senha da nuvem, que NÃO ficam no código (o site é público). O login
  //  fica guardado neste aparelho; o dono digita uma vez em cada celular.
  // ---------------------------------------------------------------
  const LS_NUVEM = 'pari.nuvem';
  let sessao = lerSessao();
  function lerSessao() { try { return JSON.parse(localStorage.getItem(LS_NUVEM)); } catch (e) { return null; } }
  function gravarSessao(s) {
    sessao = s;
    try { if (s) localStorage.setItem(LS_NUVEM, JSON.stringify(s)); else localStorage.removeItem(LS_NUVEM); } catch (e) { /* ok */ }
  }
  async function authPost(path, body) {
    const ctl = new AbortController();
    const to = setTimeout(() => ctl.abort(), 20000);
    try {
      const res = await fetch(baseUrl() + '/auth/v1/' + path, {
        method: 'POST', headers: { apikey: cfg().SUPABASE_ANON_KEY, 'Content-Type': 'application/json' },
        body: JSON.stringify(body), signal: ctl.signal, cache: 'no-store',
      });
      const txt = await res.text();
      let j = null;
      try { j = txt ? JSON.parse(txt) : null; } catch (e) { /* ok */ }
      if (!res.ok) {
        const err = new Error((j && (j.error_description || j.msg || j.message || j.error)) || ('HTTP ' + res.status));
        err.http = res.status;
        throw err;
      }
      return j;
    } finally { clearTimeout(to); }
  }
  function guardarSessao(j, email) {
    gravarSessao({
      email: (j.user && j.user.email) || email, access_token: j.access_token, refresh_token: j.refresh_token,
      expira: Date.now() + (+j.expires_in || 3600) * 1000,
    });
  }
  let renovando = null;
  async function token() {
    if (!sessao) { const e = new Error('Aparelho não conectado à nuvem'); e.login = true; throw e; }
    if (Date.now() < sessao.expira - 60000) return sessao.access_token;
    if (!renovando) {
      const s = sessao;
      renovando = authPost('token?grant_type=refresh_token', { refresh_token: s.refresh_token })
        .then(j => { guardarSessao(j, s.email); return sessao.access_token; })
        .catch(e => { if (e.http >= 400 && e.http < 500) { gravarSessao(null); e.login = true; } throw e; })
        .finally(() => { renovando = null; });
    }
    return renovando;
  }

  async function rest(method, path, body, prefer) {
    const key = cfg().SUPABASE_ANON_KEY;
    const headers = { apikey: key, 'Content-Type': 'application/json', Authorization: 'Bearer ' + await token() };
    if (prefer) headers.Prefer = prefer;
    const ctl = new AbortController();
    const to = setTimeout(() => ctl.abort(), 20000);
    try {
      const res = await fetch(baseUrl() + '/rest/v1/' + path, {
        method, headers, body: body ? JSON.stringify(body) : undefined, signal: ctl.signal, cache: 'no-store',
      });
      if (!res.ok) {
        const txt = await res.text().catch(() => '');
        const err = new Error('HTTP ' + res.status + ' ' + txt.slice(0, 240));
        err.http = res.status;
        throw err;
      }
      if (res.status === 204) return null;
      const txt = await res.text();
      return txt ? JSON.parse(txt) : null;
    } finally { clearTimeout(to); }
  }

  function serializar(t, r) {
    if (!r) return null;
    const o = {};
    SCHEMA[t].concat(COMUNS).forEach(c => { o[c] = r[c] === undefined ? null : r[c]; });
    return o;
  }

  // Aplica linhas vindas do servidor (vence a mais nova)
  function aplicarRemotos(t, rows) {
    const gravar = [];
    rows.forEach(row => {
      const key = keyOf(t, row);
      const k = t + ':' + key;
      const local = mem[t].get(key);
      if (local) {
        const tl = ts(local.modificado_em), tr = ts(row.modificado_em);
        if (outbox.has(k) && tl >= tr) return;  // alteração local ainda não enviada e mais nova
        if (tl === tr && !outbox.has(k)) return; // já é igual
        if (tl > tr) return;
      }
      const r = Object.assign({}, row);
      delete r.sincronizado_em;
      mem[t].set(key, r);
      gravar.push(r);
    });
    if (gravar.length) {
      Store.versao++;
      gravar.forEach(r => pendentes.set(t + ':' + keyOf(t, r), { t, rec: r, fila: false }));
      agendarGravacao();
      avisar(t);
    }
  }

  async function enviar() {
    if (!outbox.size) return;
    const porTabela = {};
    outbox.forEach(ob => { (porTabela[ob.t] = porTabela[ob.t] || []).push(ob); });
    for (const t of TABLES) {
      const obs = porTabela[t];
      if (!obs) continue;
      for (let i = 0; i < obs.length; i += 250) {
        const lote = obs.slice(i, i + 250).filter(ob => mem[t].has(ob.key));
        if (!lote.length) continue;
        const revEnviada = lote.map(ob => revs.get(ob.k) || 0);
        const rows = lote.map(ob => serializar(t, mem[t].get(ob.key)));
        const resp = await rest('POST', t + '?on_conflict=' + keyField(t), rows, 'resolution=merge-duplicates,return=representation');
        lote.forEach((ob, j) => {
          if ((revs.get(ob.k) || 0) === revEnviada[j]) { // não mudou durante o envio
            outbox.delete(ob.k);
            remocoesFila.add(ob.k);
          }
        });
        agendarGravacao();
        if (Array.isArray(resp)) aplicarRemotos(t, resp);
        P.emit('pendentes', outbox.size);
      }
    }
  }

  async function receber() {
    for (const t of TABLES) {
      let cursor = meta['cur:' + t] || '1970-01-01T00:00:00Z';
      // folga de 2 min: pega linhas de transações que terminaram fora de ordem
      let desde = new Date(ts(cursor) - 120000).toISOString();
      for (let pagina = 0; pagina < 100; pagina++) {
        const rows = await rest('GET', t + '?select=*&sincronizado_em=gt.' + encodeURIComponent(desde) + '&order=sincronizado_em.asc&limit=1000');
        if (!rows || !rows.length) break;
        aplicarRemotos(t, rows);
        const ult = rows[rows.length - 1].sincronizado_em;
        if (ts(ult) > ts(cursor)) cursor = ult;
        desde = ult;
        if (rows.length < 1000) break;
      }
      if (cursor !== meta['cur:' + t]) gravarMeta('cur:' + t, cursor);
    }
  }

  function setEstado(e) {
    Sync.estado = e;
    P.emit('sync', { estado: e, pendentes: outbox.size });
  }

  let tentou401 = false;
  const Sync = P.Sync = {
    estado: 'local',     // local | login | online | offline | sincronizando | erro
    ultimoErro: null,
    ultimoSync: null,
    configurado,
    conectado: () => !!sessao,
    email: () => (sessao ? sessao.email : null),
    agendar(ms) {
      if (!configurado() || !sessao) return;
      clearTimeout(timer);
      timer = setTimeout(() => Sync.rodar(), ms == null ? 1500 : ms);
    },
    async rodar() {
      if (!configurado()) { setEstado('local'); return false; }
      if (!sessao) { setEstado('login'); return false; }
      if (rodando) { deNovo = true; return false; }
      if (navigator.onLine === false) { setEstado('offline'); return false; }
      rodando = true;
      setEstado('sincronizando');
      let ok = false;
      try {
        await enviar();
        await receber();
        Sync.ultimoSync = new Date();
        Sync.ultimoErro = null;
        tentou401 = false;
        ok = true;
        setEstado('online');
      } catch (e) {
        Sync.ultimoErro = String((e && e.message) || e);
        if (e && e.login) setEstado('login');
        else if (e && e.http === 401 && sessao && !tentou401) { tentou401 = true; sessao.expira = 0; deNovo = true; setEstado('sincronizando'); }
        else setEstado(e && e.http ? 'erro' : 'offline');
      } finally {
        rodando = false;
        if (deNovo) { deNovo = false; Sync.agendar(400); }
      }
      return ok;
    },
    // Conecta este aparelho à nuvem (e-mail e senha criados no Supabase)
    async entrar(email, senha) {
      const j = await authPost('token?grant_type=password', { email: String(email || '').trim().toLowerCase(), password: senha });
      guardarSessao(j, email);
      tentou401 = false;
      return Sync.rodar();
    },
    sair() {
      gravarSessao(null);
      setEstado(configurado() ? 'login' : 'local');
    },
    iniciar() {
      if (!configurado()) { setEstado('local'); return; }
      window.addEventListener('online', () => Sync.agendar(200));
      window.addEventListener('offline', () => setEstado('offline'));
      document.addEventListener('visibilitychange', () => { if (!document.hidden) Sync.agendar(300); });
      setInterval(() => { if (!document.hidden) Sync.rodar(); }, 30000);
      setEstado(!sessao ? 'login' : navigator.onLine === false ? 'offline' : 'online');
    },
  };

  window.addEventListener('pagehide', gravarAgora);
  document.addEventListener('visibilitychange', () => { if (document.hidden) gravarAgora(); });
})();
