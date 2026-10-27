/* EXTRATO DE COBRANÇA (fiado) — para mandar ao cliente o que ele consumiu, quando e quanto falta.
   Sai como imagem (para o WhatsApp: compartilhar ou baixar), como folha para imprimir ou salvar em
   PDF, ou como texto. Só lê o que está lançado; não grava nada.
   Os dados vêm de P.Mesas.extratoFiado(cliente):
   { nome, contas: [{ dia, hora, local, itens: [{ q, nome, v }], desconto, consumo, pagoNaHora, fiadoPago, deve }],
     baixas: [{ dia, forma, v }] (todos os pagamentos do fiado, do mais novo ao mais antigo), pago, total } */
(function () {
  'use strict';
  const P = window.P;
  const h = P.UI.h;
  const COR = { fundo: '#F6EFDF', cartao: '#FFFBF3', marca: '#B23A43', marcaEsc: '#962F37', tx: '#2B1618', tx2: '#5E4547', tx3: '#7A6062', borda: '#E6D9C2', verde: '#2E7D4F' };
  const FONTE = "'Plus Jakarta Sans', system-ui, -apple-system, 'Segoe UI', Roboto, Arial, sans-serif";
  const FONTE_T = "'Barlow Condensed', 'Roboto Condensed', 'Arial Narrow', " + FONTE;
  const quando = () => { const a = P.agoraISO(); return P.Dia.rotulo(P.Dia.diaOperacional(a)) + '/' + a.slice(0, 4) + ' às ' + P.Dia.hora(a); };
  const pixCobranca = () => String((P.cfg('cobranca') || {}).pix || '').trim(); // Ajustes → Cobrança do fiado
  const pagoDe = d => (d.pago != null ? d.pago : d.baixas.reduce((s, b) => s + b.v, 0));
  const MAX_PAGS = 10; // na imagem: os mais recentes; os anteriores somados numa linha
  const nomeArq = d => 'extrato-' + P.UI.semAcento(d.nome).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') + '.png';

  // ---------------------------------------------------------------
  //  Texto (WhatsApp: negrito com *)
  // ---------------------------------------------------------------
  function texto(d) {
    const L = ['*Maria Simone · Restaurante & Marmitas*', 'Extrato de *' + d.nome + '* — ' + quando(), ''];
    d.contas.forEach(c => {
      L.push('*' + P.Dia.rotulo(c.dia) + '*' + (c.hora ? ' · ' + c.hora : '') + (c.local ? ' · ' + c.local : ''));
      c.itens.forEach(i => L.push('  ' + P.numAuto(i.q) + '× ' + i.nome + ' — ' + P.brl(i.v)));
      if (c.desconto) L.push('  Desconto − ' + P.brl(c.desconto));
      const extras = [c.pagoNaHora ? 'pago na hora ' + P.brl(c.pagoNaHora) : null, c.fiadoPago ? 'já pagou ' + P.brl(c.fiadoPago) : null].filter(Boolean);
      L.push('  Total ' + P.brl(c.consumo) + (extras.length ? ' · ' + extras.join(' · ') : '') + ' → *falta ' + P.brl(c.deve) + '*', '');
    });
    if (d.baixas.length) {
      L.push('*Pagamentos já feitos* (total ' + P.brl(pagoDe(d)) + ')');
      d.baixas.forEach(b => L.push('  ' + P.Dia.rotulo(b.dia) + ' · ' + (P.Mesas.NOME_FORMA[b.forma] || b.forma) + ' — ' + P.brl(b.v)));
      L.push('');
    }
    L.push('*Total em aberto: ' + P.brl(d.total) + '*');
    // a chave sozinha numa linha, para copiar fácil no WhatsApp
    if (pixCobranca()) L.push('', 'Para pagar no Pix, a chave é:', pixCobranca());
    return L.join('\n');
  }

  // ---------------------------------------------------------------
  //  Imagem (canvas 1080 px de largura, altura conforme o conteúdo)
  // ---------------------------------------------------------------
  const W = 1080, M = 56;
  function carregarLogo() {
    return new Promise(res => { const i = new Image(); i.onload = () => res(i); i.onerror = () => res(null); i.src = 'icons/icon-192.png'; });
  }
  function caber(ctx, t, max) {
    if (ctx.measureText(t).width <= max) return t;
    while (t.length > 1 && ctx.measureText(t + '…').width > max) t = t.slice(0, -1);
    return t + '…';
  }
  function retRed(ctx, x, y, w, hh, r) {
    ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + hh, r); ctx.arcTo(x + w, y + hh, x, y + hh, r);
    ctx.arcTo(x, y + hh, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
  }
  // desenha (ou só mede, com ctx de medida) e devolve a altura usada
  function compor(ctx, d, logo, desenhar) {
    const txt = (t, x, y, font, cor, alin) => { if (!desenhar) return; ctx.font = font; ctx.fillStyle = cor; ctx.textAlign = alin || 'left'; ctx.fillText(t, x, y); };
    let y = 0;
    // faixa da marca
    if (desenhar) { ctx.fillStyle = COR.marca; ctx.fillRect(0, 0, W, 220); ctx.fillStyle = COR.marcaEsc; ctx.fillRect(0, 214, W, 6); }
    if (desenhar && logo) { ctx.save(); retRed(ctx, M, 46, 128, 128, 30); ctx.clip(); ctx.drawImage(logo, M, 46, 128, 128); ctx.restore(); }
    txt('MARIA SIMONE', M + (logo ? 156 : 0), 118, '800 74px ' + FONTE_T, '#FFFFFF');
    txt('Restaurante & Marmitas · Pátio do Pari', M + (logo ? 156 : 0), 162, '600 30px ' + FONTE, 'rgba(255,255,255,.86)');
    y = 290;
    txt('EXTRATO DE CONTA', M, y, '800 26px ' + FONTE, COR.tx3);
    y += 64;
    ctx.font = '800 56px ' + FONTE;
    txt(caber(ctx, d.nome, W - 2 * M), M, y, '800 56px ' + FONTE, COR.tx);
    y += 44;
    txt('Atualizado em ' + quando(), M, y, '500 28px ' + FONTE, COR.tx2);
    y += 46;
    d.contas.forEach(c => {
      const abatido = c.pagoNaHora || c.fiadoPago; // com pagamento: mostra o total da conta antes de descontar
      const altura = 86 + c.itens.length * 46 + (c.desconto ? 42 : 0) + (abatido ? 44 : 0) + (c.pagoNaHora ? 42 : 0) + (c.fiadoPago ? 42 : 0) + 104;
      if (desenhar) { ctx.fillStyle = COR.cartao; retRed(ctx, M, y, W - 2 * M, altura, 28); ctx.fill(); ctx.strokeStyle = COR.borda; ctx.lineWidth = 2; ctx.stroke(); }
      let yy = y + 58;
      const x0 = M + 34, x1 = W - M - 34;
      txt(P.Dia.rotulo(c.dia) + (c.hora ? ' · ' + c.hora : '') + (c.local ? ' · ' + c.local : ''), x0, yy, '800 32px ' + FONTE, COR.tx);
      yy += 28;
      c.itens.forEach(i => {
        yy += 46;
        ctx.font = '500 30px ' + FONTE;
        txt(caber(ctx, P.numAuto(i.q) + '× ' + i.nome, x1 - x0 - 200), x0, yy, '500 30px ' + FONTE, COR.tx);
        txt(P.brl(i.v), x1, yy, '600 30px ' + FONTE, COR.tx, 'right');
      });
      const linhaMenor = (rot, val) => { yy += 42; txt(rot, x0, yy, '500 27px ' + FONTE, COR.tx2); txt(val, x1, yy, '600 27px ' + FONTE, COR.tx2, 'right'); };
      if (c.desconto) linhaMenor('Desconto', '− ' + P.brl(c.desconto));
      if (abatido) { yy += 44; txt('Total da conta', x0, yy, '700 28px ' + FONTE, COR.tx); txt(P.brl(c.consumo), x1, yy, '700 28px ' + FONTE, COR.tx, 'right'); }
      if (c.pagoNaHora) linhaMenor('Pago na hora', '− ' + P.brl(c.pagoNaHora));
      if (c.fiadoPago) linhaMenor('Já pagou depois', '− ' + P.brl(c.fiadoPago));
      yy += 20;
      if (desenhar) { ctx.strokeStyle = COR.borda; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x0, yy); ctx.lineTo(x1, yy); ctx.stroke(); }
      yy += 44;
      txt('Falta desta conta', x0, yy, '700 29px ' + FONTE, COR.tx);
      txt(P.brl(c.deve), x1, yy, '800 34px ' + FONTE, COR.marca, 'right');
      y += altura + 24;
    });
    if (d.baixas.length) {
      y += 30;
      txt('PAGAMENTOS JÁ FEITOS', M, y, '800 24px ' + FONTE, COR.tx3);
      txt('total ' + P.brl(pagoDe(d)), W - M, y, '800 26px ' + FONTE, COR.verde, 'right');
      const mostra = d.baixas.slice(0, MAX_PAGS), resto = d.baixas.slice(MAX_PAGS);
      mostra.forEach(b => {
        y += 44;
        txt(P.Dia.rotulo(b.dia) + ' · ' + (P.Mesas.NOME_FORMA[b.forma] || b.forma), M, y, '500 28px ' + FONTE, COR.tx2);
        txt(P.brl(b.v), W - M, y, '600 28px ' + FONTE, COR.verde, 'right');
      });
      if (resto.length) {
        y += 44;
        txt('+ ' + resto.length + (resto.length === 1 ? ' pagamento anterior' : ' pagamentos anteriores'), M, y, '500 28px ' + FONTE, COR.tx2);
        txt(P.brl(resto.reduce((s, b) => s + b.v, 0)), W - M, y, '600 28px ' + FONTE, COR.verde, 'right');
      }
      y += 30;
    }
    y += 24;
    // total
    if (desenharTotal(ctx, y, d, desenhar, txt)) y += 170;
    // Pix para pagar
    const chave = pixCobranca();
    if (chave) {
      if (desenhar) { ctx.fillStyle = '#FFFFFF'; retRed(ctx, M, y, W - 2 * M, 150, 30); ctx.fill(); ctx.strokeStyle = COR.marca; ctx.lineWidth = 3; ctx.stroke(); }
      txt('PAGUE PELO PIX · CHAVE', W / 2, y + 56, '800 26px ' + FONTE, COR.marca, 'center');
      txt(chave, W / 2, y + 116, '800 54px ' + FONTE, COR.tx, 'center');
      y += 170;
    }
    y += 40;
    txt('Obrigado pela preferência!', W / 2, y, '600 28px ' + FONTE, COR.tx3, 'center');
    return y + 56;
  }
  function desenharTotal(ctx, y, d, desenhar, txt) {
    if (desenhar) { ctx.fillStyle = COR.tx; retRed(ctx, M, y, W - 2 * M, 150, 30); ctx.fill(); }
    txt('TOTAL EM ABERTO', M + 40, y + 62, '800 26px ' + FONTE, 'rgba(255,255,255,.75)');
    txt(d.contas.length + (d.contas.length === 1 ? ' conta' : ' contas'), M + 40, y + 108, '500 28px ' + FONTE, 'rgba(255,255,255,.75)');
    txt(P.brl(d.total), W - M - 40, y + 102, '800 66px ' + FONTE_T, '#FFFFFF', 'right');
    return true;
  }
  async function imagem(d) {
    try { if (document.fonts) { await Promise.all([document.fonts.load('800 56px "Plus Jakarta Sans"'), document.fonts.load('800 74px "Barlow Condensed"')]); } } catch (e) { /* sem as fontes: usa as do sistema */ }
    const logo = await carregarLogo();
    const medida = document.createElement('canvas').getContext('2d');
    const alt = Math.ceil(compor(medida, d, logo, false));
    const cv = document.createElement('canvas');
    cv.width = W; cv.height = alt;
    const ctx = cv.getContext('2d');
    ctx.fillStyle = COR.fundo; ctx.fillRect(0, 0, W, alt);
    compor(ctx, d, logo, true);
    return cv;
  }
  const paraBlob = cv => new Promise(res => cv.toBlob(res, 'image/png'));

  // ---------------------------------------------------------------
  //  Folha para imprimir (ou salvar em PDF pelo imprimir do celular)
  // ---------------------------------------------------------------
  function imprimir(d, url) {
    const folha = h('div', { id: 'ex-impressao' }, h('img', { src: url, alt: 'Extrato de ' + d.nome }));
    const pagina = h('style', null, '@page { size: A4 portrait; margin: 10mm; }');
    document.head.appendChild(pagina);
    document.body.appendChild(folha);
    document.body.classList.add('imprime-extrato');
    const fim = () => { document.body.classList.remove('imprime-extrato'); folha.remove(); pagina.remove(); window.removeEventListener('afterprint', fim); };
    window.addEventListener('afterprint', fim);
    const img = folha.firstChild;
    const ir = () => { window.print(); setTimeout(() => { if (folha.isConnected && !matchMedia('print').matches) fim(); }, 60000); };
    if (img.complete) ir(); else img.onload = ir;
  }

  // ---------------------------------------------------------------
  //  Folha com a prévia e os botões
  // ---------------------------------------------------------------
  async function abrir(d) {
    const previa = h('div', { class: 'ex-previa' }, h('div', { class: 'dica' }, 'Montando o extrato…'));
    const t = texto(d);
    let cv = null, blob = null, url = null;
    const bEnviar = h('button', { type: 'button', class: 'btn primario bloco', disabled: true, onClick: async () => {
      const arq = new File([blob], nomeArq(d), { type: 'image/png' });
      try {
        if (navigator.canShare && navigator.canShare({ files: [arq] })) { await navigator.share({ files: [arq], title: 'Extrato de ' + d.nome }); return; }
      } catch (e) { if (e && e.name === 'AbortError') return; }
      P.UI.baixar(nomeArq(d), blob, 'image/png');
      P.UI.toast('Imagem salva: mande pelo WhatsApp');
    } }, P.UI.icone('upload'), 'Enviar imagem (WhatsApp)');
    const bImprimir = h('button', { type: 'button', class: 'btn grow', disabled: true, onClick: () => imprimir(d, url) }, P.UI.icone('imprimir'), 'Imprimir / PDF');
    const bTexto = h('button', { type: 'button', class: 'btn grow', onClick: async () => {
      try {
        if (navigator.share) { await navigator.share({ text: t }); return; }
      } catch (e) { if (e && e.name === 'AbortError') return; }
      try { await navigator.clipboard.writeText(t); P.UI.toast('Texto copiado — cole no WhatsApp'); } catch (e) { P.UI.toast('Não deu para copiar aqui'); }
    } }, P.UI.icone('lapis'), 'Texto');
    const sh = P.UI.sheet(h('div', { class: 'np-sheet ex-sheet' }, previa, bEnviar, h('div', { class: 'row gap' }, bImprimir, bTexto)),
      { titulo: 'Extrato de ' + d.nome, cls: 'sheet-alta', onFechar: () => { if (url) setTimeout(() => URL.revokeObjectURL(url), 60000); } });
    try {
      cv = await imagem(d);
      blob = await paraBlob(cv);
      url = URL.createObjectURL(blob);
      previa.replaceChildren(h('img', { src: url, alt: 'Extrato de ' + d.nome }));
      bEnviar.disabled = false; bImprimir.disabled = false;
    } catch (e) {
      console.error(e);
      previa.replaceChildren(h('div', { class: 'dica' }, 'Não deu para montar a imagem neste aparelho. Use o Texto.'));
    }
    return sh;
  }

  P.Extrato = { texto, imagem, abrir };
})();
