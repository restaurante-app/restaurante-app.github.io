/* Núcleo: regra do dia operacional, formatação, eventos, utilidades.
   NENHUM outro módulo calcula data por conta própria — tudo passa por P.Dia. */
(function () {
  'use strict';
  const P = window.P = window.P || {};

  // ---------------------------------------------------------------
  //  DIA OPERACIONAL
  //  O dia começa às 03:00 e termina às 02:59 do dia seguinte.
  //  Domingo não existe: o que cair em domingo (depois do corte)
  //  vai para a segunda-feira seguinte.
  // ---------------------------------------------------------------
  const CORTE_HORA = 3;
  const pad = n => String(n).padStart(2, '0');
  const isoLocal = d => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  const NOMES_SEMANA = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];
  const NOMES_MES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

  function diaOperacional(ts) {
    const d = new Date(ts == null ? Date.now() : ts);
    const s = new Date(d.getTime() - CORTE_HORA * 3600000);
    if (s.getDay() === 0) s.setDate(s.getDate() + 1);
    return isoLocal(s);
  }
  function parse(dia) {
    const [y, m, d] = dia.split('-').map(Number);
    return new Date(y, m - 1, d);
  }
  function somaDias(dia, n) {
    const d = parse(dia);
    d.setDate(d.getDate() + n);
    return isoLocal(d);
  }
  function anterior(dia) {
    let x = somaDias(dia, -1);
    if (parse(x).getDay() === 0) x = somaDias(x, -1);
    return x;
  }
  function seguinte(dia) {
    let x = somaDias(dia, 1);
    if (parse(x).getDay() === 0) x = somaDias(x, 1);
    return x;
  }
  // Últimos n dias operacionais até `ate` (inclusive), mais recente primeiro.
  // `semana` (1..6) filtra por dia da semana. n = Infinity → até `limiteDias` para trás.
  function ultimos(n, ate, semana, limiteDias) {
    const out = [];
    let dia = ate || diaOperacional();
    const lim = limiteDias || 800;
    for (let i = 0; i < lim && out.length < n; i++) {
      const ds = parse(dia).getDay();
      if (ds !== 0 && (!semana || ds === semana)) out.push(dia);
      dia = somaDias(dia, -1);
    }
    return out;
  }
  function doMes(mes, ate) { // mes = 'YYYY-MM' → dias operacionais (seg–sáb) do mês, até `ate` se dado
    const [y, m] = mes.split('-').map(Number);
    const out = [];
    const d = new Date(y, m - 1, 1);
    while (d.getMonth() === m - 1) {
      const iso = isoLocal(d);
      if (d.getDay() !== 0 && (!ate || iso <= ate)) out.push(iso);
      d.setDate(d.getDate() + 1);
    }
    return out;
  }

  P.Dia = {
    CORTE_HORA,
    diaOperacional,
    hoje: () => diaOperacional(),
    faixa: ts => new Date(ts == null ? Date.now() : ts).getHours(),
    parse, somaDias, anterior, seguinte, ultimos, doMes,
    semana: dia => parse(dia).getDay(),
    mes: dia => dia.slice(0, 7),
    nomeSemana: dia => NOMES_SEMANA[parse(dia).getDay()],
    NOMES_SEMANA,
    rotulo: dia => { const d = parse(dia); return NOMES_SEMANA[d.getDay()] + ' ' + pad(d.getDate()) + '/' + pad(d.getMonth() + 1); },
    rotuloCurto: dia => { const d = parse(dia); return pad(d.getDate()) + '/' + pad(d.getMonth() + 1); },
    rotuloMes: mes => { const [y, m] = mes.split('-').map(Number); return NOMES_MES[m - 1] + '/' + y; },
    // ordem das faixas dentro do dia operacional: 03h primeiro, 02h por último
    ordemFaixa: f => (f - CORTE_HORA + 24) % 24,
    rotuloFaixa: f => pad(f) + 'h–' + pad((f + 1) % 24) + 'h',
    hora: ts => { const d = new Date(ts == null ? Date.now() : ts); return pad(d.getHours()) + ':' + pad(d.getMinutes()); },
    // dias corridos desde um timestamp ISO (para "preço há N dias")
    diasDesde: iso => iso ? Math.floor((Date.now() - Date.parse(iso)) / 86400000) : Infinity,
  };

  // ---------------------------------------------------------------
  //  Formatação
  // ---------------------------------------------------------------
  const fBRL = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
  P.brl = v => fBRL.format(+v || 0);
  P.brl0 = v => (v < 0 ? '−' : '') + 'R$ ' + Math.round(Math.abs(+v || 0)).toLocaleString('pt-BR');
  P.num = (v, dec = 0) => (+v || 0).toLocaleString('pt-BR', { minimumFractionDigits: dec, maximumFractionDigits: dec });
  P.numAuto = (v, max = 3) => (+v || 0).toLocaleString('pt-BR', { maximumFractionDigits: max });
  P.pct = (v, dec = 1) => (v == null || !isFinite(v)) ? '—' : P.num(v, dec) + '%';
  P.round = (v, casas = 2) => { const f = Math.pow(10, casas); return Math.round((+v || 0) * f + (v >= 0 ? 1e-9 : -1e-9)) / f; };
  P.agoraISO = () => new Date().toISOString();
  P.esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  P.uuid = () => (window.crypto && crypto.randomUUID) ? crypto.randomUUID()
    : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
      const r = Math.random() * 16 | 0;
      return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
    });

  P.vibrar = (p = 15) => { try { if (navigator.vibrate) navigator.vibrate(p); } catch (e) { /* sem vibração */ } };

  // ---------------------------------------------------------------
  //  Eventos
  // ---------------------------------------------------------------
  const handlers = {};
  P.on = (ev, fn) => {
    (handlers[ev] = handlers[ev] || []).push(fn);
    return () => { handlers[ev] = (handlers[ev] || []).filter(f => f !== fn); };
  };
  P.emit = (ev, data) => (handlers[ev] || []).slice().forEach(fn => {
    try { fn(data); } catch (e) { console.error(e); }
  });

  // ---------------------------------------------------------------
  //  SHA-256 (síncrono, igual em qualquer aparelho, com ou sem HTTPS)
  // ---------------------------------------------------------------
  P.sha256 = function (ascii) {
    const rr = (v, a) => (v >>> a) | (v << (32 - a));
    const maxWord = Math.pow(2, 32);
    let result = '';
    const words = [];
    const bitLen = ascii.length * 8;
    let hash = [];
    const k = [];
    let primeCounter = 0;
    const isComposite = {};
    for (let candidate = 2; primeCounter < 64; candidate++) {
      if (!isComposite[candidate]) {
        for (let i = 0; i < 313; i += candidate) isComposite[i] = candidate;
        hash[primeCounter] = (Math.pow(candidate, 0.5) * maxWord) | 0;
        k[primeCounter++] = (Math.pow(candidate, 1 / 3) * maxWord) | 0;
      }
    }
    ascii += '\x80';
    while (ascii.length % 64 - 56) ascii += '\x00';
    for (let i = 0; i < ascii.length; i++) {
      const j = ascii.charCodeAt(i);
      if (j >> 8) return null; // só ASCII
      words[i >> 2] |= j << ((3 - i) % 4) * 8;
    }
    words[words.length] = ((bitLen / maxWord) | 0);
    words[words.length] = (bitLen);
    for (let j = 0; j < words.length;) {
      const w = words.slice(j, j += 16);
      const oldHash = hash;
      hash = hash.slice(0, 8);
      for (let i = 0; i < 64; i++) {
        const w15 = w[i - 15], w2 = w[i - 2];
        const a = hash[0], e = hash[4];
        const temp1 = hash[7] + (rr(e, 6) ^ rr(e, 11) ^ rr(e, 25)) + ((e & hash[5]) ^ ((~e) & hash[6])) + k[i]
          + (w[i] = (i < 16) ? w[i] : (w[i - 16] + (rr(w15, 7) ^ rr(w15, 18) ^ (w15 >>> 3)) + w[i - 7] + (rr(w2, 17) ^ rr(w2, 19) ^ (w2 >>> 10))) | 0);
        const temp2 = (rr(a, 2) ^ rr(a, 13) ^ rr(a, 22)) + ((a & hash[1]) ^ (a & hash[2]) ^ (hash[1] & hash[2]));
        hash = [(temp1 + temp2) | 0].concat(hash);
        hash[4] = (hash[4] + temp1) | 0;
      }
      for (let i = 0; i < 8; i++) hash[i] = (hash[i] + oldHash[i]) | 0;
    }
    for (let i = 0; i < 8; i++) {
      for (let j = 3; j + 1; j--) {
        const b = (hash[i] >> (j * 8)) & 255;
        result += ((b < 16) ? 0 : '') + b.toString(16);
      }
    }
    return result;
  };
})();
