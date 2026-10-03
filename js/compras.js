/* COMPRAS — o que foi comprado no mercado, de quem, por quanto e como foi pago.
   - Cada item comprado de insumo ATUALIZA o preço do insumo (preço vivo das fichas)
     e mostra na hora quais pratos mudaram de margem.
   - O resultado do dia (vendas − custo do vendido − despesas lançadas) e o caixa
     (entrou × saiu) são recalculados ao vivo a cada compra ou venda.
   - Custos (dono): comprado × consumido pelas vendas (pela ficha), por insumo. */
(function () {
  'use strict';
  const P = window.P;
  const h = P.UI.h;
  const FORMAS = [
    { v: 'DINHEIRO', rotulo: 'Dinheiro' }, { v: 'PIX', rotulo: 'Pix' },
    { v: 'CARTAO', rotulo: 'Cartão' }, { v: 'PRAZO', rotulo: 'A prazo' },
  ];
  const NOME_FORMA = { DINHEIRO: 'Dinheiro', PIX: 'Pix', CARTAO: 'Cartão', PRAZO: 'A prazo', DEBITO: 'Débito', CREDITO: 'Crédito' };
  const UN = { kg: 'kg', L: 'L', un: 'un' };

  // ---------------------------------------------------------------
  //  Dados
  // ---------------------------------------------------------------
  let cache = { v: -1 };
  let diaLista = null; // dia aberto em Compras: a compra nova nasce nesse dia
  let abrirCal = false; // atalho "Calendário" (Mais): abre Compras já com o calendário
  function idx() {
    if (cache.v === P.Store.versao) return cache;
    const itens = new Map();
    P.Store.all('compra_itens').forEach(l => { if (!itens.has(l.compra_id)) itens.set(l.compra_id, []); itens.get(l.compra_id).push(l); });
    itens.forEach(l => l.sort((a, b) => (a.ordem || 0) - (b.ordem || 0)));
    cache = { v: P.Store.versao, itens };
    return cache;
  }
  const itensDe = id => idx().itens.get(id) || [];
  const aPagar = () => P.Store.all('compras').filter(c => c.forma === 'PRAZO' && !c.pago_em);
  const doDia = dia => P.Store.all('compras').filter(c => c.dia_operacional === dia).sort((a, b) => (a.criado_em < b.criado_em ? 1 : -1));
  const nomeCompra = c => c.fornecedor || 'Compra sem fornecedor';
  function resumoItens(c) {
    const ls = itensDe(c.id);
    const nomes = ls.slice(0, 3).map(l => l.descricao);
    return nomes.join(', ') + (ls.length > 3 ? ' +' + (ls.length - 3) : '');
  }
  function fornecedoresRecentes() {
    const vistos = new Map();
    P.Store.all('compras').filter(c => c.fornecedor).sort((a, b) => (a.criado_em < b.criado_em ? 1 : -1)).forEach(c => {
      const k = P.UI.semAcento(c.fornecedor);
      if (!vistos.has(k)) vistos.set(k, c.fornecedor);
    });
    return [...vistos.values()].slice(0, 8);
  }
  // quantas vezes cada insumo aparece em compras (para pôr os mais comprados no topo)
  function frequencia() {
    const m = new Map();
    P.Store.all('compra_itens').forEach(l => { if (l.insumo_id) m.set(l.insumo_id, (m.get(l.insumo_id) || 0) + 1); });
    return m;
  }

  // Grava a compra (nova ou edição) e atualiza o preço dos insumos comprados
  function salvar(d, idExistente) {
    const u = P.Auth.usuario();
    const antes = P.Calc.snapshot();
    const agora = P.agoraISO();
    const ant = idExistente ? P.Store.get('compras', idExistente) : null;
    const id = ant ? ant.id : P.uuid();
    const dia = d.dia || (ant ? ant.dia_operacional : P.Dia.diaOperacional(agora));
    if (ant) itensDe(id).forEach(l => P.Store.remove('compra_itens', l.id));
    const total = P.round(d.linhas.reduce((s, l) => s + (+l.valor || 0), 0), 2);
    const criado = ant ? ant.criado_em : agora;
    // pago na hora (dinheiro/pix/cartão) ou a prazo (fica em "A pagar" até marcar como pago)
    let pg = { pago_em: null, pago_dia: null, pago_forma: null };
    if (d.forma !== 'PRAZO') pg = { pago_em: criado, pago_dia: dia, pago_forma: d.forma };
    else if (ant && ant.forma === 'PRAZO' && ant.pago_em) pg = { pago_em: ant.pago_em, pago_dia: ant.pago_dia, pago_forma: ant.pago_forma };
    const compra = P.Store.put('compras', Object.assign({
      id, dia_operacional: dia, fornecedor: (d.fornecedor || '').trim() || null, forma: d.forma, total,
      criado_em: criado, usuario_id: ant ? ant.usuario_id : (u && u.id), obs: d.obs || null,
    }, pg));
    d.linhas.forEach((l, i) => P.Store.put('compra_itens', {
      // guarda o nome como veio na nota (ex.: "COCA-COLA LATA 12X350ML"); o insumo fica no insumo_id
      id: P.uuid(), compra_id: id, insumo_id: l.insumo_id || null, descricao: l.lido || l.descricao,
      quantidade: P.round(l.quantidade, 3), unidade: l.unidade, preco_unit: P.round(l.preco_unit, 4), valor: P.round(l.valor, 2), ordem: i,
    }));
    // preço vivo: preço médio pago em cada insumo desta compra vira o preço do insumo
    // (compra de dia passado ou editada não passa por cima do preço de uma compra mais nova)
    const maisNova = new Set();
    P.Store.all('compras').forEach(c => {
      if (c.id === id || c.dia_operacional < dia || (c.dia_operacional === dia && c.criado_em <= criado)) return;
      itensDe(c.id).forEach(l => { if (l.insumo_id) maisNova.add(l.insumo_id); });
    });
    const porInsumo = new Map();
    d.linhas.forEach(l => {
      if (!l.insumo_id || !(l.quantidade > 0) || maisNova.has(l.insumo_id)) return;
      const g = porInsumo.get(l.insumo_id) || { q: 0, v: 0 };
      g.q += +l.quantidade; g.v += +l.valor;
      porInsumo.set(l.insumo_id, g);
    });
    const mudancas = [];
    porInsumo.forEach((g, insId) => {
      const ins = P.Store.get('insumos', insId);
      if (!ins) return;
      const novo = P.round(g.v / g.q, 4);
      if (P.round(novo, 2) !== P.round(ins.preco, 2)) {
        mudancas.push({ ins, de: +ins.preco, para: novo });
        P.Store.put('insumos', Object.assign({}, ins, { preco: novo, atualizado_em: agora }));
        P.Store.put('historico_precos', { id: P.uuid(), insumo_id: insId, preco: novo, data: agora });
      } else {
        P.Store.put('insumos', Object.assign({}, ins, { atualizado_em: agora }));
      }
    });
    const efeito = P.Fichas.medirEfeito(antes);
    return { compra, mudancas, efeito };
  }
  function pagar(compras, forma) {
    const agora = P.agoraISO();
    const dia = P.Dia.diaOperacional(agora);
    compras.forEach(c => P.Store.put('compras', Object.assign({}, c, { pago_em: agora, pago_dia: dia, pago_forma: forma })));
  }

  // ---------------------------------------------------------------
  //  Componentes
  // ---------------------------------------------------------------
  function subnavCompras(ativo) {
    const n = aPagar().length;
    const itens = [
      { id: 'dia', rota: 'compras', rotulo: 'Compras do dia' },
      { id: 'pagar', rota: 'compras/pagar', rotulo: 'A pagar', badge: n || null },
    ];
    if (P.Auth.isDono()) itens.push({ id: 'custos', rota: 'compras/custos', rotulo: 'Custos' });
    return P.UI.subnav(itens, ativo);
  }
  function voltar(href, rot) { return h('a', { class: 'voltar', href }, P.UI.icone('voltar'), rot || 'Voltar'); }
  function navDia(dia, onMuda) {
    const hoje = P.Dia.hoje();
    return h('div', { class: 'lc-dia' },
      h('button', { type: 'button', class: 'pn-nav', 'aria-label': 'Dia anterior', onClick: () => onMuda(P.Dia.anterior(dia)) }, P.UI.icone('voltar')),
      h('button', { type: 'button', class: 'lc-dia-t cp-dia-cal', 'aria-label': 'Escolher o dia no calendário', onClick: () => calendario(dia, onMuda) },
        dia === hoje ? 'Hoje' : P.Dia.nomeSemana(dia), h('small', null, P.Dia.rotuloCurto(dia) + ' ▾')),
      h('button', { type: 'button', class: 'pn-nav', 'aria-label': 'Próximo dia', disabled: dia >= hoje, onClick: () => onMuda(P.Dia.seguinte(dia)) }, P.UI.icone('avancar')));
  }
  // Calendário do mês: cada dia mostra quanto saiu (compras + despesas); toque escolhe o dia
  function calendario(diaAtual, onEscolher) {
    const hoje = P.Dia.hoje();
    let mes = P.Dia.mes(diaAtual);
    const totais = new Map(), soCompras = new Map();
    const soma = (m, dia, v) => m.set(dia, (m.get(dia) || 0) + (+v || 0));
    P.Store.all('compras').forEach(c => { soma(totais, c.dia_operacional, c.total); soma(soCompras, c.dia_operacional, c.total); });
    P.Store.all('despesas').forEach(d => { if (P.Mesas.despVisivel(d)) soma(totais, d.dia_operacional, d.valor); });
    const corpo = h('div');
    const mudaMes = n => { const [y, m] = mes.split('-').map(Number); const d = new Date(y, m - 1 + n, 1); mes = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0'); desenhar(); };
    function desenhar() {
      const [y, m] = mes.split('-').map(Number);
      const primeiro = new Date(y, m - 1, 1);
      const vazios = (primeiro.getDay() + 6) % 7; // semana começa na segunda
      const ultimo = new Date(y, m, 0).getDate();
      const celulas = [];
      for (let i = 0; i < vazios; i++) celulas.push(h('span', { class: 'cal-d vazio' }));
      let totMes = 0, comprasMes = 0;
      for (let d = 1; d <= ultimo; d++) {
        const iso = mes + '-' + String(d).padStart(2, '0');
        const domingo = new Date(y, m - 1, d).getDay() === 0;
        const t = totais.get(iso) || 0;
        totMes += t;
        comprasMes += soCompras.get(iso) || 0;
        celulas.push(h('button', {
          type: 'button', disabled: domingo || iso > hoje,
          class: 'cal-d' + (t ? ' com' : '') + (iso === diaAtual ? ' sel' : '') + (iso === hoje ? ' hoje' : ''),
          onClick: () => { sh.fechar(); onEscolher(iso); },
        }, h('b', null, d), t ? h('small', null, P.brl0(t).replace('R$ ', '')) : null));
      }
      corpo.replaceChildren(
        h('div', { class: 'cal-top' },
          h('button', { type: 'button', class: 'pn-nav', 'aria-label': 'Mês anterior', onClick: () => mudaMes(-1) }, P.UI.icone('voltar')),
          h('div', { class: 'cal-mes' }, P.Dia.rotuloMes(mes), h('small', null, totMes ? 'compras ' + P.brl(comprasMes) + ' · despesas ' + P.brl(totMes - comprasMes) : 'nada lançado no mês')),
          h('button', { type: 'button', class: 'pn-nav', 'aria-label': 'Próximo mês', disabled: mes >= P.Dia.mes(hoje), onClick: () => mudaMes(1) }, P.UI.icone('avancar'))),
        h('div', { class: 'cal-grade' }, ['seg', 'ter', 'qua', 'qui', 'sex', 'sáb', 'dom'].map(s => h('span', { class: 'cal-sem' }, s)), celulas),
        h('button', { type: 'button', class: 'btn bloco', onClick: () => { sh.fechar(); onEscolher(hoje); } }, 'Ir para hoje'));
    }
    const sh = P.UI.sheet(corpo, { titulo: 'Escolha o dia' });
    desenhar();
  }
  // Busca em todas as compras: fornecedor, produto (nome da nota) ou insumo
  function buscarCompras(q) {
    const termos = P.UI.semAcento(q).split(/\s+/).filter(Boolean);
    const insNome = id => { const i = id && P.Store.get('insumos', id); return i ? i.nome : ''; };
    const out = [];
    P.Store.all('compras').forEach(c => {
      const itens = itensDe(c.id);
      const textoItem = l => P.UI.semAcento(l.descricao + ' ' + insNome(l.insumo_id));
      const tudo = P.UI.semAcento(c.fornecedor || '') + ' ' + itens.map(textoItem).join(' ');
      if (!termos.every(t => tudo.includes(t))) return;
      // itens com todas as palavras; se nenhum, os que têm alguma
      const todos = itens.filter(l => termos.every(t => textoItem(l).includes(t)));
      const achados = todos.length ? todos : itens.filter(l => termos.some(t => textoItem(l).includes(t)));
      out.push({ c, achados });
    });
    return out.sort((a, b) => (a.c.criado_em < b.c.criado_em ? 1 : -1));
  }
  const chipForma = c => h('span', { class: 'tag ' + (c.forma === 'PRAZO' ? (c.pago_em ? 'ok' : 'aviso') : 'neutra') },
    c.forma === 'PRAZO' ? (c.pago_em ? 'pago ' + P.Dia.rotuloCurto(c.pago_dia) : 'a pagar') : NOME_FORMA[c.forma] || c.forma);

  // Resultado ao vivo (dono): vendas − custo do vendido − despesas lançadas; e o caixa
  function cardResultado(dia) {
    const r = P.Painel.resultadoDia(dia);
    const cor = !r.temMovimento ? 'cinza' : r.resultado >= 0 ? 'verde' : 'vermelho';
    return h('a', { class: 'res-card s-' + cor, href: '#/painel' },
      h('div', { class: 'res-top' },
        h('div', null, h('div', { class: 'res-rot' }, 'Resultado do dia · ao vivo'), h('div', { class: 'res-num t-' + cor }, P.brl(r.resultado))),
        P.UI.icone('avancar')),
      h('div', { class: 'res-conta' },
        h('span', null, 'Vendas ', h('b', null, P.brl0(r.fat))),
        h('span', null, '− custo vendido ', h('b', null, P.brl0(r.cmv))),
        h('span', null, '− despesas ', h('b', null, P.brl0(r.outras)))),
      h('div', { class: 'res-caixa' },
        h('span', null, 'Caixa: entrou ', h('b', null, P.brl0(r.entrou))),
        h('span', null, 'saiu ', h('b', null, P.brl0(r.saiu))),
        h('span', null, 'saldo ', h('b', { class: r.entrou - r.saiu >= 0 ? 't-verde' : 't-vermelho' }, P.brl0(r.entrou - r.saiu)))));
  }

  // ---------------------------------------------------------------
  //  FOTO DA NOTA (grátis) — o app acha o QR Code do cupom fiscal (NFC-e)
  //  na foto e busca os itens na página pública da Sefaz, pela função
  //  "ler-qr" do Supabase (o navegador não pode abrir a Sefaz direto).
  //  Nada é salvo sozinho: os itens entram no formulário para conferir.
  //  O app lembra qual insumo é cada produto da nota para a próxima vez.
  // ---------------------------------------------------------------
  let fotoPendente = null; // da lista de compras: foto da galeria, ou 'leitor' (abrir a câmera) ao abrir "Lançar compra"
  function escolherFoto(galeria, onFoto) {
    const inp = h('input', { type: 'file', accept: 'image/*', style: { display: 'none' } });
    if (!galeria) inp.setAttribute('capture', 'environment');
    inp.addEventListener('change', () => { const f = inp.files && inp.files[0]; inp.remove(); if (f) onFoto(f); });
    document.body.appendChild(inp);
    inp.click();
  }
  // Leitor de QR: ZXing (WebAssembly, em js/vendor/zxing), carregado só quando precisa.
  // Bem mais forte que leitores em JavaScript puro em cupom térmico fotografado.
  let zxCarga = null;
  function carregarLeitor() {
    if (!zxCarga) {
      zxCarga = new Promise((ok, erro) => {
        const sc = document.createElement('script');
        sc.src = 'js/vendor/zxing/zxing-reader.js';
        sc.onload = () => {
          const Z = window.ZXingWASM;
          Z.prepareZXingModule({
            overrides: { locateFile: (path, prefix) => (path.endsWith('.wasm') ? new URL('js/vendor/zxing/' + path, location.href).href : prefix + path) },
            fireImmediately: true,
          }).then(() => ok(Z), erro);
        };
        sc.onerror = () => erro(new Error('Não deu para carregar o leitor de QR Code.'));
        document.head.appendChild(sc);
      }).catch(e => { zxCarga = null; throw e; });
    }
    return zxCarga;
  }
  const OPCOES_QR = { formats: ['QRCode'], tryHarder: true, tryRotate: true, tryInvert: true, tryDownscale: true, maxNumberOfSymbols: 1 };
  const cvQR = document.createElement('canvas');
  // procura o QR num pedaço da imagem/vídeo (reduzido a no máximo "max" px) → texto ou null
  async function lerQRCanvas(fonte, x, y, w, hh, max) {
    const esc = Math.min(1, max / Math.max(w, hh));
    cvQR.width = Math.round(w * esc);
    cvQR.height = Math.round(hh * esc);
    const cx = cvQR.getContext('2d', { willReadFrequently: true });
    cx.drawImage(fonte, x, y, w, hh, 0, 0, cvQR.width, cvQR.height);
    const Z = await carregarLeitor();
    const r = await Z.readBarcodes(cx.getImageData(0, 0, cvQR.width, cvQR.height), OPCOES_QR);
    const ok = r.find(b => b.text && b.isValid !== false);
    return ok ? ok.text : null;
  }
  // Leitor ao vivo: câmera aberta, lê sozinho quando o QR entra em foco.
  // → { qr } | { foto } (preferiu tirar foto) | null (cancelou)
  function escanearQR() {
    return new Promise(resolve => {
      let fim = false, stream = null, timer = null, n = 0;
      const video = h('video', { class: 'qr-video', playsinline: true, autoplay: true, muted: true });
      video.muted = true;
      const status = h('small', { class: 'qr-status' }, 'Abrindo a câmera…');
      const extras = h('div', { class: 'row gap' });
      function acabar(v) {
        if (fim) return;
        fim = true;
        clearTimeout(timer);
        if (stream) stream.getTracks().forEach(t => t.stop());
        resolve(v);
        sh.fechar();
      }
      const sh = P.UI.sheet(h('div', { class: 'np-sheet' },
        h('div', { class: 'qr-caixa' }, video, h('div', { class: 'qr-mira' })),
        status, extras,
        h('div', { class: 'row gap' },
          h('button', { type: 'button', class: 'btn', onClick: () => acabar(null) }, 'Cancelar'),
          h('button', { type: 'button', class: 'btn grow', onClick: () => escolherFoto(false, f => acabar({ foto: f })) }, P.UI.icone('camera'), 'Tirar foto'))),
      { titulo: 'Aponte para o QR Code do cupom', cls: 'sheet-qr', onFechar: () => acabar(null) });
      let det = null;
      if ('BarcodeDetector' in window) { try { det = new window.BarcodeDetector({ formats: ['qr_code'] }); } catch (e) { det = null; } }
      const inicio = Date.now();
      async function tique() {
        if (fim) return;
        const vw = video.videoWidth, vh = video.videoHeight;
        if (video.readyState >= 2 && vw) {
          try {
            let r = null;
            if (det) { const a = await det.detect(video); if (a.length) r = a[0].rawValue; }
            if (!r) {
              // alterna o quadrado da mira (centro) e o quadro inteiro
              const lado = Math.min(vw, vh) * (n++ % 3 === 2 ? 1 : 0.75);
              r = await lerQRCanvas(video, (vw - lado) / 2, (vh - lado) / 2, lado, lado, 1000);
            }
            if (r) { P.vibrar(40); acabar({ qr: r }); return; }
          } catch (e) { /* quadro ruim: tenta o próximo */ }
          if (Date.now() - inicio > 12000) status.textContent = 'Ainda não leu? Chegue mais perto ou mais longe devagar, com o cupom esticado e com luz. Se não der, use "Tirar foto".';
        }
        timer = setTimeout(tique, 90);
      }
      (async () => {
        try {
          await carregarLeitor();
          if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) throw new Error('sem câmera');
          stream = await navigator.mediaDevices.getUserMedia({ audio: false, video: { facingMode: 'environment', width: { ideal: 1920 }, height: { ideal: 1080 } } });
          if (fim) { stream.getTracks().forEach(t => t.stop()); return; }
          video.srcObject = stream;
          await video.play().catch(() => {});
          status.textContent = 'Deixe o QR Code dentro do quadrado. Lê sozinho.';
          const track = stream.getVideoTracks()[0];
          const cap = track && track.getCapabilities ? track.getCapabilities() : {};
          if (cap.focusMode && cap.focusMode.includes('continuous')) track.applyConstraints({ advanced: [{ focusMode: 'continuous' }] }).catch(() => {});
          if (cap.torch) {
            let luz = false;
            extras.appendChild(h('button', { type: 'button', class: 'btn grow', onClick: e => {
              luz = !luz;
              track.applyConstraints({ advanced: [{ torch: luz }] }).catch(() => {});
              e.currentTarget.textContent = luz ? 'Apagar lanterna' : 'Acender lanterna';
            } }, 'Acender lanterna'));
          }
          tique();
        } catch (e) {
          status.textContent = 'Não deu para abrir a câmera aqui (permita o acesso à câmera). Use "Tirar foto".';
        }
      })();
    });
  }
  // → texto do QR Code da foto, ou null
  async function acharQR(arq) {
    const url = URL.createObjectURL(arq);
    try {
      const img = await new Promise((ok, erro) => { const i = new Image(); i.onload = () => ok(i); i.onerror = () => erro(new Error('Não deu para abrir a foto.')); i.src = url; });
      if ('BarcodeDetector' in window) {
        try {
          const achados = await new window.BarcodeDetector({ formats: ['qr_code'] }).detect(img);
          if (achados.length) return achados[0].rawValue;
        } catch (e) { /* sem suporte a qr_code: usa o ZXing */ }
      }
      const W = img.naturalWidth, H = img.naturalHeight;
      // a foto inteira (em dois tamanhos) e depois pedaços (o QR é pequeno na foto do cupom)
      const janelas = [[0, 0, W, H, 2000], [0, 0, W, H, 1200]];
      for (const fy of [0, 0.25, 0.5]) for (const fx of [0, 0.25, 0.5]) janelas.push([W * fx, H * fy, W / 2, H / 2, 1200]);
      for (const [x, y, w, hh, max] of janelas) {
        const r = await lerQRCanvas(img, x, y, w, hh, max);
        if (r) return r;
      }
      return null;
    } finally { URL.revokeObjectURL(url); }
  }
  // Alguns sistemas de caixa imprimem o QR com o portal de outro estado (ex.: nota de SP
  // apontando para Sergipe). O estado vem nos 2 primeiros dígitos da chave: usa o portal certo.
  const PORTAL_QR = { 35: 'https://www.nfce.fazenda.sp.gov.br/qrcode?p=' };
  function urlConsulta(qr) {
    const m = String(qr).match(/[?&]p=((\d{2})\d{42}[^&#\s]*)/);
    const base = m && PORTAL_QR[m[2]];
    if (!base) return qr;
    try { if (new URL(qr).hostname === new URL(base).hostname) return qr; } catch (e) { /* QR estranho: usa o portal */ }
    return base + m[1];
  }
  // ---------------------------------------------------------------
  //  COLAR ITENS — a foto da nota vai para o Claude (conversa, grátis na
  //  assinatura), que devolve o texto no formato abaixo; aqui só se cola.
  //  Aceita também tabela com | ; ou tab, com ou sem cabeçalho.
  // ---------------------------------------------------------------
  const INSTRUCAO_CLAUDE = 'Leia esta nota de compra e responda SÓ com um bloco de código, sem comentários, neste formato:\n' +
    'Fornecedor: nome da loja\n' +
    'Data: dia da compra (dd/mm/aaaa)\n' +
    'Pagamento: Dinheiro, Pix, Cartão ou A prazo (deixe vazio se a nota não diz)\n' +
    'Total: valor total da nota\n' +
    'descrição | quantidade | unidade | valor unitário | valor total\n' +
    '(uma linha por item, com a descrição e a unidade como estão na nota — ex.: COCA-COLA LATA 12X350ML | 2 | FD | 37,08 | 74,16; desconto geral vira a linha: Desconto | 1 | UN | -5,00 | -5,00)';
  const numBR = t => {
    let s = String(t == null ? '' : t).replace(/[R$\s]/g, '');
    if (s.includes(',')) s = s.replace(/\./g, '').replace(',', '.');
    const v = parseFloat(s);
    return isFinite(v) ? v : NaN;
  };
  const formaDoTexto = t => (/pix/i.test(t) ? 'PIX' : /dinheiro|esp[eé]cie/i.test(t) ? 'DINHEIRO' : /prazo|boleto|fiado/i.test(t) ? 'PRAZO' : /cart|d[eé]bito|cr[eé]dito/i.test(t) ? 'CARTAO' : '');
  // "01/10/2026" → dia operacional (domingo conta como segunda); sem ano = este ano; futuro não vale
  function diaDoTexto(dd, mm, aa) {
    const hoje = P.Dia.hoje();
    const ano = !aa ? hoje.slice(0, 4) : aa.length === 2 ? '20' + aa : aa;
    const pad = x => String(x).padStart(2, '0');
    const dt = new Date(+ano, +mm - 1, +dd);
    if (dt.getMonth() !== +mm - 1 || dt.getDate() !== +dd) return null;
    let iso = ano + '-' + pad(mm) + '-' + pad(dd);
    if (dt.getDay() === 0) iso = P.Dia.somaDias(iso, 1);
    return iso <= hoje ? iso : null;
  }
  function lerTextoNota(txt) {
    const nota = { fornecedor: '', forma: '', total: 0, desconto: 0, chave: null, itens: [], ruins: [] };
    String(txt || '').split(/\r?\n/).forEach(bruta => {
      const lin = bruta.replace(/```\w*/g, '').trim();
      if (!lin) return;
      let m;
      if ((m = lin.match(/^\**\s*(fornecedor|loja|emitente)\s*\**\s*:\s*(.*)$/i))) { nota.fornecedor = m[2].replace(/\*/g, '').trim(); return; }
      if ((m = lin.match(/^\**\s*(pagamento|forma(?: de pagamento)?)\s*\**\s*:\s*(.*)$/i))) { nota.forma = formaDoTexto(m[2]); return; }
      if ((m = lin.match(/^\**\s*(data|dia|emiss[aã]o)\s*\**\s*:\s*(\d{1,2})[/.-](\d{1,2})(?:[/.-](\d{2,4}))?/i))) { nota.dia = diaDoTexto(m[2], m[3], m[4]); return; }
      if ((m = lin.match(/^\**\s*(total|valor total|valor a pagar)\s*\**\s*:\s*(.*)$/i))) { nota.total = numBR(m[2]) || 0; return; }
      if (!/[|;\t]/.test(lin)) return;
      const c = lin.replace(/^\|/, '').replace(/\|$/, '').split(/\s*[|;\t]\s*/).map(x => x.trim());
      if (/^[-:\s]*$/.test(c.join('')) || (/descri/i.test(c[0]) && c.some(x => /qu?a?n?t|qtd/i.test(x)))) return; // cabeçalho/separador
      const desc = c[0];
      let q = 1, un = 'UN', vu = NaN, vt = NaN;
      if (c.length >= 5) { q = numBR(c[1]); un = c[2]; vu = numBR(c[3]); vt = numBR(c[4]); }
      else if (c.length === 4) { q = numBR(c[1]); un = c[2]; vt = numBR(c[3]); }
      else if (c.length === 3) { q = numBR(c[1]); vt = numBR(c[2]); }
      else if (c.length === 2) { vt = numBR(c[1]); }
      if (!isFinite(vt) && isFinite(vu) && isFinite(q)) vt = q * vu;
      if (!desc || !isFinite(vt) || !isFinite(q) || q === 0) { nota.ruins.push(lin); return; }
      nota.itens.push({ descricao: desc, quantidade: q, un: String(un || 'UN').toUpperCase().replace(/[^A-Z]/g, '') || 'UN', valor: P.round(vt, 2) });
    });
    return nota;
  }
  // folha para colar → nota lida, ou null
  function pedirTextoNota() {
    return new Promise(resolve => {
      let feito = false;
      const ta = h('textarea', { class: 'campo cp-colar', rows: 8, placeholder: 'Cole aqui o que o Claude respondeu', autocomplete: 'off', spellcheck: 'false' });
      const previa = h('div', { class: 'cp-previa' });
      const bOk = h('button', { type: 'button', class: 'btn primario grow', disabled: true }, 'Lançar itens');
      function ver() {
        const n = lerTextoNota(ta.value);
        const soma = n.itens.reduce((s, it) => s + it.valor, 0);
        const partes = [];
        if (n.itens.length) {
          partes.push(h('b', null, n.itens.length + (n.itens.length === 1 ? ' item' : ' itens') + ' · ' + P.brl(soma)));
          if (n.dia) partes.push(h('span', null, ' · dia ' + P.Dia.rotulo(n.dia)));
          if (n.total > 0) partes.push(Math.abs(n.total - soma) < 0.05 ? h('span', { class: 't-verde' }, ' ✓ confere com o total da nota') : h('span', { class: 't-amarelo' }, ' — nota diz ' + P.brl(n.total)));
        } else if (ta.value.trim()) partes.push(h('span', { class: 't-amarelo' }, 'Nenhum item reconhecido. Cole a resposta do Claude inteira.'));
        if (n.ruins.length) partes.push(h('div', { class: 't-amarelo' }, n.ruins.length + ' linha(s) não entendida(s): ' + n.ruins.slice(0, 2).join(' / ')));
        previa.replaceChildren(...partes);
        bOk.disabled = !n.itens.length;
        return n;
      }
      ta.addEventListener('input', ver);
      const copiar = async (texto, rot) => {
        try { await navigator.clipboard.writeText(texto); P.UI.toast(rot + ' copiado'); } catch (e) { P.UI.toast('Não deu para copiar aqui'); }
      };
      const bColar = navigator.clipboard && navigator.clipboard.readText
        ? h('button', { type: 'button', class: 'btn grow', onClick: async () => { try { ta.value = await navigator.clipboard.readText(); ver(); } catch (e) { ta.focus(); } } }, 'Colar')
        : null;
      bOk.addEventListener('click', () => { const n = ver(); if (!n.itens.length) return; feito = true; resolve(n); sh.fechar(); });
      const sh = P.UI.sheet(h('div', { class: 'np-sheet' },
        h('ol', { class: 'cp-passos' },
          h('li', null, 'Tire a foto da nota e mande para o Claude, junto com a ', h('button', { type: 'button', class: 'cp-link', onClick: () => copiar(INSTRUCAO_CLAUDE, 'Pedido') }, 'mensagem de pedido (toque para copiar)'), '.'),
          h('li', null, 'Copie o que o Claude responder e cole abaixo.')),
        ta, previa,
        h('div', { class: 'row gap' }, h('button', { type: 'button', class: 'btn', onClick: () => sh.fechar() }, 'Cancelar'), bColar, bOk)),
      { titulo: 'Colar itens da nota', onFechar: () => { if (!feito) resolve(null); } });
      setTimeout(() => ta.focus(), 80);
    });
  }

  // Lê a página da NFC-e (modelo padrão das Sefaz: tabela #tabResult)
  function lerPaginaNfce(html, urlQR) {
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const txt = el => (el ? el.textContent : '').replace(/\s+/g, ' ').trim();
    const num = t => { const m = String(t || '').replace(/\./g, '').match(/-?\d+(,\d+)?/); return m ? +m[0].replace(',', '.') : 0; };
    const itens = [...doc.querySelectorAll('#tabResult tr')].map(tr => ({
      descricao: txt(tr.querySelector('.txtTit')),
      quantidade: num(txt(tr.querySelector('.Rqtd')).replace(/qtde\.?:?/i, '')),
      un: txt(tr.querySelector('.RUN')).replace(/^UN:?/i, '').trim().toUpperCase(),
      valor: num(txt(tr.querySelector('.valor'))),
    })).filter(it => it.descricao && it.valor);
    let total = 0, desconto = 0, forma = '';
    doc.querySelectorAll('#totalNota label').forEach(lb => {
      const rot = txt(lb);
      const v = num(txt(lb.parentElement && lb.parentElement.querySelector('.totalNumb')));
      if (/valor a pagar/i.test(rot)) total = v;
      else if (/desconto/i.test(rot)) desconto = v;
      else if (lb.classList.contains('tx') && !forma) {
        if (/pix/i.test(rot)) forma = 'PIX';
        else if (/dinheiro/i.test(rot)) forma = 'DINHEIRO';
        else if (/cart|d[eé]bito|cr[eé]dito/i.test(rot)) forma = 'CARTAO';
      }
    });
    const chaveTxt = txt(doc.querySelector('.chave')).replace(/\D/g, '');
    const chaveUrl = (String(urlQR).match(/[?&]p=(\d{44})/) || [])[1];
    return { fornecedor: txt(doc.querySelector('#u20')) || txt(doc.querySelector('.txtTopo')), itens, total, desconto, forma, chave: chaveTxt.length === 44 ? chaveTxt : chaveUrl || null };
  }
  // quantas unidades vêm na embalagem, pela descrição: "12X350ML", "C 15", "C/12", "ANTARCTICA 12X", "STELLA ARTOIS 24"
  function unidadesNaEmbalagem(desc) {
    const d = ' ' + String(desc || '').toUpperCase() + ' ';
    const m = d.match(/\b(\d{1,3})\s*X\s*\d/) || d.match(/\bC\s*\/?\s*(\d{1,3})\b/) || d.match(/\b(\d{1,3})\s*X\s/)
      || d.match(/\b(?:FARDO|FD|CX|PCT|PACK)\s*(?:C\/)?\s*(\d{1,3})\b/) || d.match(/\s(6|8|12|15|18|20|24|30)\s*$/);
    const n = m ? +m[1] : 0;
    return n >= 2 && n <= 120 ? n : 0;
  }
  // unidade da nota → unidade do app (kg, L, un): converte g e ml, e fardo/caixa/pacote em unidades
  function unidadeNota(q, un, desc) {
    if (/^(KG|KGS|KILO|QUILO)/.test(un)) return { q, un: 'kg' };
    if (/^(G|GR|GRS|GRAMA)/.test(un)) return { q: q / 1000, un: 'kg' };
    if (/^(L|LT|LTS|LITRO)$/.test(un)) return { q, un: 'L' };
    if (/^ML/.test(un)) return { q: q / 1000, un: 'L' };
    if (/^(FD|FARD|CX|CAIXA|PCT|PAC|PC|PK|PACK|DZ|DUZIA|BD|BAND|EMB|KIT|SC)/.test(un)) {
      const n = unidadesNaEmbalagem(desc) || (/^DZ|^DUZIA/.test(un) ? 12 : 0);
      if (n) return { q: q * n, un: 'un', emb: n };
      return { q, un: 'un', incerto: true }; // fardo sem saber quantas vêm: não liga sozinho
    }
    return { q, un: 'un' };
  }
  // qual insumo é cada produto da nota: primeiro o que o app já aprendeu, depois pelo nome
  const chaveProduto = desc => P.UI.semAcento(desc).replace(/[^a-z0-9]+/g, ' ').trim();
  const mapaNota = () => P.cfg('nota_insumos');
  function sugerirInsumo(desc) {
    // guardado como "insumo" ou "insumo|fator" (fator = unidades da ficha por unidade da nota, ex.: 1 garrafa = 0,9 kg)
    const [lembrado, fator] = String(mapaNota()[chaveProduto(desc)] || '').split('|');
    if (lembrado) {
      if (lembrado === '_nenhum') return { nenhum: true };
      const ins = P.Store.get('insumos', lembrado);
      if (ins) return { ins, lembrado: true, fator: +fator || null };
    }
    const toks = chaveProduto(desc).split(' ').filter(t => t.length >= 3);
    // lata: cerveja (pela marca) ou refrigerante — casa com os insumos "Cerveja lata" / "Refrigerante lata"
    if (toks.includes('lata')) {
      const cerveja = /\b(skol|brahma|itaipava|original|heineken|budweiser|stella|amstel|devassa|eisenbahn|corona|spaten|bohemia|petra|crystal|kaiser|schin|imperio|cerveja|chopp)\b/.test(chaveProduto(desc)) && !/guarana|zero|soda|tonica/.test(chaveProduto(desc));
      const alvo = cerveja ? 'cerveja lata' : 'refrigerante lata';
      const ins = P.Store.all('insumos').find(i => chaveProduto(i.nome) === alvo);
      if (ins) return { ins };
    }
    const casa = (a, b) => a.startsWith(b) || b.startsWith(a);
    let melhor = null, n = 0;
    P.Store.all('insumos').forEach(ins => {
      const nt = chaveProduto(ins.nome).split(' ').filter(t => t.length >= 3 && !['com', 'sem', 'para'].includes(t));
      if (!nt.length || !nt.every(t => toks.some(x => casa(x, t)))) return;
      if (nt.length > n) { melhor = ins; n = nt.length; }
    });
    return melhor ? { ins: melhor } : {};
  }
  function linhasDaNota(nota) {
    const linhas = nota.itens.map(it => {
      const valor = P.round(it.valor, 2);
      const c = unidadeNota(it.quantidade, it.un, it.descricao);
      const s = sugerirInsumo(it.descricao);
      const base = { lido: it.descricao, nota: { q: c.q, un: c.un, incerto: c.incerto, txt: P.numAuto(it.quantidade) + ' ' + (it.un || 'UN') + (c.emb ? ' de ' + c.emb : '') }, valor };
      const q = s.ins && (c.incerto ? (s.lembrado && s.fator ? P.round(c.q * s.fator, 3) : 0)
        : s.ins.unidade === c.un ? c.q : s.fator ? P.round(c.q * s.fator, 3) : 0);
      if (s.ins && q > 0) {
        return Object.assign(base, { insumo_id: s.ins.id, descricao: s.ins.nome, unidade: s.ins.unidade, quantidade: q, preco_unit: valor / q, foto: !s.lembrado, fator: s.ins.unidade === c.un ? null : s.fator });
      }
      // sem ficha: guarda a quantidade em unidades (custo por unidade = valor ÷ unidades)
      const q1 = c.q > 0 ? c.q : 1;
      return Object.assign(base, { insumo_id: null, descricao: it.descricao, unidade: c.q > 0 ? c.un : 'un', quantidade: q1, preco_unit: valor / q1, ligar: !s.nenhum && valor > 0,
        sugerido: s.ins ? s.ins.id : null });
    });
    if (nota.desconto > 0) linhas.push({ insumo_id: null, descricao: 'Desconto', unidade: 'un', quantidade: 1, preco_unit: -nota.desconto, valor: -P.round(nota.desconto, 2) });
    return linhas;
  }
  // foto → dados da nota, ou null (cancelou/erro, já avisado)
  async function lerNota(entrada) {
    let cancelado = false;
    const ctl = new AbortController();
    const passo = h('b', null, 'Procurando o QR Code…');
    const sh = P.UI.sheet(h('div', { class: 'np-sheet cp-lendo' },
      h('div', { class: 'cp-lendo-ic' }, P.UI.icone('camera')), passo,
      h('small', null, 'Depois é só conferir os itens.'),
      h('button', { type: 'button', class: 'btn bloco', onClick: () => sh.fechar() }, 'Cancelar')),
    { titulo: 'Foto da nota', onFechar: () => { cancelado = true; ctl.abort(); } });
    const falhar = async msg => { if (cancelado) return null; sh.fechar(); await P.UI.confirmar(msg, { ok: 'Ok', titulo: 'Foto da nota' }); return null; };
    try {
      const lido = entrada.qr || await acharQR(entrada.foto);
      if (cancelado) return null;
      const qr = lido && urlConsulta(lido);
      if (!qr) return falhar('Não consegui ler o QR Code nesta foto. Use "Ler nota" e aponte a câmera bem perto do QR Code (o quadradinho no fim do cupom), com o papel esticado e com luz. Nota sem QR Code (feira, açougue) tem que ser digitada.');
      if (!/^https?:\/\/[^/?#]*\.gov\.br[/?#]/i.test(qr)) return falhar('Esse QR Code não é de cupom fiscal (NFC-e). Nota sem QR Code de cupom fiscal tem que ser digitada.');
      if (!P.Sync.configurado() || !P.Sync.conectado()) return falhar('Para buscar os itens na Sefaz, conecte o aparelho à nuvem (Mais → Nuvem).');
      passo.textContent = 'Buscando os itens na Sefaz…';
      const r = await P.Sync.funcao('ler-qr', { url: qr }, { signal: ctl.signal, timeout: 40000 });
      if (cancelado) return null;
      const nota = lerPaginaNfce(r.html || '', qr);
      if (!nota.itens.length) return falhar('A Sefaz não mostrou os itens desta nota. Se ela foi emitida agora, tente de novo em alguns minutos.');
      sh.fechar();
      return nota;
    } catch (e) {
      if (cancelado) return null;
      return falhar(e && e.name === 'AbortError' ? 'A Sefaz demorou demais para responder. Tente de novo.' : 'Não deu para ler a nota: ' + ((e && e.message) || e));
    }
  }

  // ---------------------------------------------------------------
  //  TELA: COMPRAS DO DIA
  // ---------------------------------------------------------------
  function telaCompras(view) {
    view.className = 'v-compras';
    let dia = diaLista && diaLista <= P.Dia.hoje() ? diaLista : P.Dia.hoje();
    diaLista = dia;
    const corpo = h('div');
    // a busca fica fora do "corpo" para não perder o que foi digitado quando a tela atualiza sozinha
    const inBusca = h('input', { class: 'campo cp-busca-in', type: 'search', placeholder: 'Buscar compra: fornecedor ou produto', autocomplete: 'off', enterkeyhint: 'search' });
    const bLimpa = h('button', { type: 'button', class: 'btn ic cp-busca-x', 'aria-label': 'Limpar busca', onClick: () => { inBusca.value = ''; desenhar(); } }, P.UI.icone('x'));
    inBusca.addEventListener('input', () => desenhar());
    const busca = h('div', { class: 'cp-busca' }, P.UI.icone('busca'), inBusca, bLimpa);
    function cardCompra(c, sub) {
      return h('a', { class: 'ms-card', href: '#/compras/c/' + c.id },
        h('span', { class: 'av-f', 'aria-hidden': 'true' }, c.fornecedor ? P.UI.iniciais(c.fornecedor.replace(/[—–-].*$/, '').replace(/box/i, '').trim() || c.fornecedor) : P.UI.icone('compras')),
        h('div', { class: 'ms-card-n' }, nomeCompra(c), h('small', null, sub)),
        h('div', { class: 'ms-card-d' }, h('b', null, P.brl(c.total)), chipForma(c)));
    }
    function desenharBusca(q) {
      const rs = buscarCompras(q);
      const tot = rs.reduce((s, r) => s + (+r.c.total || 0), 0);
      corpo.appendChild(h('div', { class: 'fx-resumo' },
        h('div', { class: 'fx-tot' }, h('small', null, rs.length + (rs.length === 1 ? ' compra encontrada' : ' compras encontradas') + ' · "' + q + '"'), h('b', null, P.brl(tot)))));
      if (!rs.length) { corpo.appendChild(P.UI.vazio('Nenhuma compra com "' + q + '". Tente outra palavra (ex.: nome do fornecedor, "coca", "heineken").', 'busca')); return; }
      corpo.appendChild(h('div', { class: 'ms-lista' }, rs.slice(0, 80).map(({ c, achados }) => {
        const itens = achados.slice(0, 3).map(l => l.descricao + ' (' + P.numAuto(l.quantidade) + ' ' + (UN[l.unidade] || l.unidade) + ' × ' + P.Fichas.precoFmt(l.preco_unit) + ')');
        return cardCompra(c, P.Dia.rotulo(c.dia_operacional) + ' · ' + (itens.length ? itens.join(', ') + (achados.length > 3 ? ' +' + (achados.length - 3) : '') : resumoItens(c)));
      })));
      if (rs.length > 80) corpo.appendChild(h('div', { class: 'dica' }, 'Mostrando as 80 mais recentes. Digite mais para filtrar.'));
    }
    function desenhar() {
      corpo.innerHTML = '';
      const q = inBusca.value.trim();
      bLimpa.style.visibility = q ? 'visible' : 'hidden';
      if (q.length >= 2) { desenharBusca(q); return; }
      corpo.appendChild(navDia(dia, d => { dia = diaLista = d; desenhar(); }));
      if (P.Auth.isDono()) corpo.appendChild(cardResultado(dia));
      const cs = doDia(dia);
      const total = cs.reduce((s, c) => s + (+c.total || 0), 0);
      const ds = P.Store.all('despesas').filter(x => x.dia_operacional === dia && P.Mesas.despVisivel(x)).sort((a, b) => (a.criado_em < b.criado_em ? 1 : -1));
      const totDesp = ds.reduce((s, x) => s + (+x.valor || 0), 0);
      const devendo = aPagar().reduce((s, c) => s + (+c.total || 0), 0);
      corpo.appendChild(h('div', { class: 'fx-resumo' },
        h('div', { class: 'fx-tot' }, h('small', null, 'Comprado · ' + cs.length + (cs.length === 1 ? ' compra' : ' compras')), h('b', null, P.brl(total))),
        h('a', { class: 'fx-formas link', href: '#/mesas/despesas' }, h('span', { class: 'fx-f' }, 'Despesas do dia ', h('b', null, P.brl(totDesp))), h('span', { class: 'fx-f' }, 'Saiu no dia ', h('b', null, P.brl(total + totDesp))), P.UI.icone('avancar')),
        devendo ? h('a', { class: 'fx-formas link', href: '#/compras/pagar' }, h('span', { class: 'fx-f' }, 'A pagar a fornecedores ', h('b', { class: 't-amarelo' }, P.brl(devendo))), P.UI.icone('avancar')) : null));
      corpo.appendChild(h('div', { class: 'row gap cp-novas' },
        h('button', { type: 'button', class: 'btn primario grow cp-nova', onClick: () => { fotoPendente = 'colar'; location.hash = '#/compras/nova'; } }, P.UI.icone('lapis'), 'Colar itens'),
        h('a', { class: 'btn grow cp-nova', href: '#/compras/nova' }, P.UI.icone('mais'), 'Digitar')));
      corpo.appendChild(h('button', { type: 'button', class: 'cp-galeria', onClick: () => { fotoPendente = 'leitor'; location.hash = '#/compras/nova'; } }, 'ou ler o QR Code do cupom'));
      const elDesp = ds.length ? [h('div', { class: 'secao' }, 'Despesas · ' + P.brl(totDesp)),
        h('div', { class: 'ms-lista' }, ds.map(x => h('a', { class: 'ms-card', href: '#/mesas/despesas' },
          h('div', { class: 'ms-card-n' }, x.descricao || P.Mesas.NOME_DESP[x.categoria], h('small', null, P.Dia.hora(x.criado_em) + ' · ' + P.Mesas.subDesp(x))),
          h('div', { class: 'ms-card-d' }, h('b', null, P.brl(x.valor))))))] : [];
      if (!cs.length) {
        corpo.append(...elDesp);
        corpo.appendChild(P.UI.vazio('Nenhuma compra neste dia. Cada compra atualiza o preço dos insumos e o custo dos pratos na hora.', 'compras'));
        // atalhos para os últimos dias que tiveram compra
        const dias = [...new Set(P.Store.all('compras').map(c => c.dia_operacional))].filter(x => x !== dia).sort().reverse().slice(0, 6);
        if (dias.length) corpo.appendChild(h('div', { class: 'cp-dias' }, h('small', null, 'Dias com compra:'),
          h('div', { class: 'chips' }, dias.map(x => h('button', { type: 'button', class: 'chip', onClick: () => { dia = diaLista = x; desenhar(); } }, P.Dia.rotulo(x))))));
        return;
      }
      corpo.appendChild(h('div', { class: 'secao' }, 'Compras'));
      corpo.appendChild(h('div', { class: 'ms-lista' }, cs.map(c => cardCompra(c, P.Dia.hora(c.criado_em) + ' · ' + resumoItens(c)))));
      corpo.append(...elDesp);
    }
    view.append(subnavCompras('dia'), busca, corpo);
    desenhar();
    if (abrirCal) { abrirCal = false; history.replaceState(null, '', '#/compras'); calendario(dia, d => { dia = diaLista = d; desenhar(); }); }
    return { onDados: desenhar };
  }

  // ---------------------------------------------------------------
  //  Folha: quantidade + preço (um teclado para os dois campos)
  // ---------------------------------------------------------------
  function pedirQtdPreco(o) {
    return new Promise(resolve => {
      let feito = false;
      let campo = o.qtd ? 'preco' : 'qtd';
      let modo = o.total != null ? 'total' : 'unit'; // unit = preço por kg/L/un ; total = total pago
      const v = { qtd: o.qtd || null, preco: o.preco != null ? o.preco : null, total: o.total != null ? o.total : null };
      const un = UN[o.unidade] || o.unidade;
      const bQtd = h('button', { type: 'button', class: 'qp-campo' });
      const bPreco = h('button', { type: 'button', class: 'qp-campo' });
      const info = h('div', { class: 'qp-info' });
      const bOk = h('button', { type: 'button', class: 'btn primario grow' });
      const np = P.UI.numpad({ decimais: 3, maxInteiros: 5, onChange: (buf, val) => { if (campo === 'qtd') v.qtd = val; else if (modo === 'unit') v.preco = val; else v.total = val; mostrar(); }, onEnter: avancar });
      const segModo = P.UI.seg([{ v: 'unit', rotulo: 'Preço por ' + un }, { v: 'total', rotulo: 'Total pago' }], modo, m => {
        if (modo === 'unit' && v.qtd > 0 && v.preco != null) v.total = P.round(v.qtd * v.preco, 2);
        if (modo === 'total' && v.qtd > 0 && v.total != null) v.preco = P.round(v.total / v.qtd, 4);
        modo = m; ir('preco');
      }, 'seg-p');
      bQtd.addEventListener('click', () => ir('qtd'));
      bPreco.addEventListener('click', () => ir('preco'));
      bOk.addEventListener('click', avancar);
      function precoUnit() { return modo === 'unit' ? v.preco : (v.qtd > 0 && v.total != null ? v.total / v.qtd : null); }
      function totalCalc() { return modo === 'total' ? v.total : (v.qtd != null && v.preco != null ? v.qtd * v.preco : null); }
      function ir(c) {
        campo = c;
        np.set(c === 'qtd' ? v.qtd : (modo === 'unit' ? v.preco : v.total));
        mostrar();
      }
      function mostrar() {
        const pu = precoUnit(), tot = totalCalc();
        bQtd.className = 'qp-campo' + (campo === 'qtd' ? ' on' : '');
        bPreco.className = 'qp-campo' + (campo === 'preco' ? ' on' : '');
        bQtd.replaceChildren(h('small', null, 'Quantidade'), h('b', null, (v.qtd != null ? P.numAuto(v.qtd) : '—') + ' ' + un));
        bPreco.replaceChildren(h('small', null, modo === 'unit' ? 'Preço por ' + un : 'Total pago'),
          h('b', null, modo === 'unit' ? (v.preco != null ? P.Fichas.precoFmt(v.preco) : '—') : (v.total != null ? P.brl(v.total) : '—')));
        const partes = [];
        if (tot != null) partes.push(h('span', null, 'Total ', h('b', null, P.brl(tot))));
        if (modo === 'total' && pu != null) partes.push(h('span', null, P.Fichas.precoFmt(pu) + '/' + un));
        if (o.precoAtual != null && pu != null && o.precoAtual > 0) {
          const dif = (pu / o.precoAtual - 1) * 100;
          if (Math.abs(dif) >= 0.5) partes.push(h('span', { class: dif > 0 ? 't-vermelho' : 't-verde' }, (dif > 0 ? '▲ ' : '▼ ') + P.num(Math.abs(dif), 1) + '% vs ' + P.Fichas.precoFmt(o.precoAtual)));
          else partes.push(h('span', { class: 't-cinza' }, 'mesmo preço de antes'));
        }
        info.replaceChildren(...partes);
        bOk.textContent = campo === 'qtd' ? 'Próximo' : (o.editar ? 'Salvar item' : 'Adicionar');
      }
      function avancar() {
        if (campo === 'qtd') {
          if (!(v.qtd > 0)) { P.vibrar(60); return; }
          ir('preco');
          return;
        }
        const pu = precoUnit(), tot = totalCalc();
        if (!(v.qtd > 0) || pu == null || tot == null) { P.vibrar(60); return; }
        feito = true;
        resolve({ quantidade: v.qtd, preco_unit: pu, valor: P.round(tot, 2) });
        sh.fechar();
      }
      const sh = P.UI.sheet(h('div', { class: 'np-sheet' },
        o.sub ? h('div', { class: 'np-sub' }, o.sub) : null,
        h('div', { class: 'qp-campos' }, bQtd, bPreco),
        segModo, info, np.el,
        h('div', { class: 'row gap' }, h('button', { type: 'button', class: 'btn', onClick: () => sh.fechar() }, 'Cancelar'), bOk)),
      { titulo: o.titulo, cls: 'sheet-np', onFechar: () => { np.destruir(); if (!feito) resolve(null); } });
      ir(campo);
    });
  }
  function pedirTexto(titulo, valor, placeholder, ok) {
    return new Promise(resolve => {
      let feito = false;
      const inp = h('input', { class: 'campo', type: 'text', value: valor || '', placeholder: placeholder || '', autocomplete: 'off', enterkeyhint: 'done' });
      const fim = () => { feito = true; resolve(inp.value.trim()); sh.fechar(); };
      inp.addEventListener('keydown', e => { if (e.key === 'Enter') fim(); });
      const sh = P.UI.sheet(h('div', { class: 'np-sheet' }, inp,
        h('div', { class: 'row gap' }, h('button', { type: 'button', class: 'btn', onClick: () => sh.fechar() }, 'Cancelar'),
          h('button', { type: 'button', class: 'btn primario grow', onClick: fim }, ok || 'Continuar'))),
      { titulo, onFechar: () => { if (!feito) resolve(null); } });
      setTimeout(() => inp.focus(), 80);
    });
  }

  // ---------------------------------------------------------------
  //  TELA: NOVA COMPRA / EDITAR
  // ---------------------------------------------------------------
  function telaNova(view, params) {
    view.className = 'v-cp-form';
    const ant = params.id ? P.Store.get('compras', params.id) : null;
    if (params.id && !ant) { view.append(voltar('#/compras', 'Compras'), P.UI.vazio('Compra não encontrada.')); return {}; }
    const d = {
      fornecedor: ant ? ant.fornecedor || '' : '',
      forma: ant ? ant.forma : 'DINHEIRO',
      dia: ant ? ant.dia_operacional : diaLista && diaLista <= P.Dia.hoje() ? diaLista : P.Dia.hoje(),
      obs: ant ? ant.obs || null : null,
      linhas: ant ? itensDe(ant.id).map(l => ({ insumo_id: l.insumo_id, descricao: l.descricao, quantidade: +l.quantidade, unidade: l.unidade, preco_unit: +l.preco_unit, valor: +l.valor })) : [],
    };
    const inForn = h('input', { class: 'campo', type: 'text', value: d.fornecedor, placeholder: 'Fornecedor (ex.: Box 12 — Seu Zé)', autocomplete: 'off' });
    inForn.addEventListener('input', () => { d.fornecedor = inForn.value; });
    const chipsForn = h('div', { class: 'chips' }, fornecedoresRecentes().map(f => h('button', { type: 'button', class: 'chip', onClick: () => { inForn.value = f; d.fornecedor = f; P.vibrar(8); } }, f)));
    const elLinhas = h('div', { class: 'cp-linhas' });
    const elBarra = h('div', { class: 'barra-acao' });
    const elAviso = h('div');
    let totalNota = null;
    const mkSegForma = () => P.UI.seg(FORMAS, d.forma, v => { d.forma = v; }, 'seg-p');
    let segForma = mkSegForma();
    const bDia = h('button', { type: 'button', class: 'btn bloco cp-dia-f', onClick: () => calendario(d.dia, mudaDia) });
    const tDia = h('small');
    function mudaDia(iso) {
      d.dia = iso;
      const hoje = d.dia === P.Dia.hoje();
      bDia.replaceChildren(P.UI.icone('calendario'), h('span', null, (hoje ? 'Hoje · ' : '') + P.Dia.rotulo(d.dia) + '/' + d.dia.slice(0, 4)), h('small', null, 'trocar ▾'));
      bDia.classList.toggle('passado', !hoje);
      tDia.textContent = P.Dia.rotulo(d.dia);
    }
    mudaDia(d.dia);

    function desenharLinhas() {
      elLinhas.innerHTML = '';
      if (!d.linhas.length) elLinhas.appendChild(h('div', { class: 'cp-vazio' }, 'Nenhum item ainda. Toque em "Adicionar item".'));
      d.linhas.forEach((l, i) => {
        const ins = l.insumo_id && P.Store.get('insumos', l.insumo_id);
        const lido = l.lido && P.UI.semAcento(l.lido) !== P.UI.semAcento(l.descricao) ? h('small', { class: 'cp-lin-lido' }, 'na nota: ' + l.lido) : null;
        const dif = ins && !ant && +ins.preco > 0 ? (l.preco_unit / ins.preco - 1) * 100 : null;
        elLinhas.appendChild(h('div', { class: 'cp-lin' },
          h('button', { type: 'button', class: 'cp-lin-main', onClick: () => editarLinha(i) },
            h('span', { class: 'cp-lin-n' }, l.descricao,
              l.ligar ? h('small', { class: 'tag aviso' }, 'ligar à ficha') : !l.insumo_id ? h('small', { class: 'tag neutra' }, 'sem ficha') : null,
              l.foto ? h('small', { class: 'tag aviso' }, 'confira') : null),
            lido,
            h('span', { class: 'cp-lin-q' }, !l.insumo_id && l.nota && l.nota.incerto ? l.nota.txt + ' · quantas unidades? toque'
              : P.numAuto(l.quantidade) + ' ' + (UN[l.unidade] || l.unidade) + ' × ' + P.Fichas.precoFmt(l.preco_unit) + (l.nota && l.nota.txt.includes(' de ') ? ' · ' + l.nota.txt : ''),
              dif != null && Math.abs(dif) >= 0.5 ? h('em', { class: dif > 0 ? 't-vermelho' : 't-verde' }, (dif > 0 ? ' ▲' : ' ▼') + P.num(Math.abs(dif), 0) + '%') : null)),
          h('b', { class: 'cp-lin-v' }, P.brl(l.valor)),
          h('button', { type: 'button', class: 'btn ic', 'aria-label': 'Remover', onClick: () => { d.linhas.splice(i, 1); P.vibrar(10); desenharLinhas(); } }, P.UI.icone('x'))));
      });
      const total = d.linhas.reduce((s, l) => s + (+l.valor || 0), 0);
      const avisos = [];
      if (totalNota > 0 && Math.abs(totalNota - total) >= 0.05) avisos.push('Total da nota ' + P.brl(totalNota) + ', soma dos itens ' + P.brl(total) + ' — confira os itens.');
      const daNota = d.linhas.some(l => l.foto || l.ligar);
      if (daNota) avisos.unshift('Itens do cupom fiscal. Toque nos marcados "ligar à ficha" para dizer qual insumo é (o app lembra da próxima vez) e confira os marcados "confira".');
      elAviso.replaceChildren(...avisos.map((t, i) => h('div', { class: 'banner ' + (i === 0 && daNota ? 'ok' : 'aviso') }, P.UI.icone(i === 0 && daNota ? 'camera' : 'alerta'), h('span', null, t))));
      elBarra.replaceChildren(
        h('div', { class: 'barra-tot' }, h('small', null, d.linhas.length + (d.linhas.length === 1 ? ' item' : ' itens')), h('b', null, P.brl(total))),
        h('button', { type: 'button', class: 'btn primario barra-btn', disabled: !d.linhas.length, onClick: salvarCompra }, P.UI.icone('check'), ant ? 'Salvar alterações' : 'Salvar compra'));
    }
    async function adicionar() {
      const freq = frequencia();
      const ins = P.Store.all('insumos').sort((a, b) => ((freq.get(b.id) || 0) - (freq.get(a.id) || 0)) || a.nome.localeCompare(b.nome, 'pt-BR'));
      const id = await P.UI.escolher({
        titulo: 'O que você comprou?',
        opcoes: [{ v: '_avulso', rotulo: '+ Item sem ficha (gelo, sacola, carvão…)', sub: 'entra no gasto, não mexe em preço de ficha' }]
          .concat(ins.map(i => ({ v: i.id, rotulo: i.nome, sub: 'último ' + P.Fichas.precoUnit(i) + ' · ' + P.Fichas.haDias(i) + (freq.get(i.id) ? ' · comprado ' + freq.get(i.id) + 'x' : '') }))),
      });
      if (!id) return;
      if (id === '_avulso') {
        const desc = await pedirTexto('Item sem ficha — o que é?', '', 'Ex.: gelo, sacola, carvão', 'Próximo');
        if (!desc) return;
        const val = await P.UI.pedirNumero({ titulo: desc + ' — valor pago', decimais: 2, prefixo: 'R$ ' });
        if (!(val > 0)) return;
        d.linhas.push({ insumo_id: null, descricao: desc, quantidade: 1, unidade: 'un', preco_unit: val, valor: P.round(val, 2) });
        desenharLinhas();
        return;
      }
      const i = P.Store.get('insumos', id);
      const r = await pedirQtdPreco({ titulo: i.nome, unidade: i.unidade, preco: +i.preco, precoAtual: +i.preco, sub: 'Preço atual ' + P.Fichas.precoUnit(i) });
      if (!r) return;
      d.linhas.push({ insumo_id: i.id, descricao: i.nome, unidade: i.unidade, quantidade: r.quantidade, preco_unit: r.preco_unit, valor: r.valor });
      P.vibrar(15);
      desenharLinhas();
    }
    async function editarLinha(idx) {
      const l = d.linhas[idx];
      if (!l.insumo_id && l.lido) { await ligarLinha(l); return; }
      if (!l.insumo_id) {
        const val = await P.UI.pedirNumero({ titulo: l.descricao + ' — valor pago', valor: l.valor, decimais: 2, prefixo: 'R$ ' });
        if (val == null) return;
        Object.assign(l, { preco_unit: val / (+l.quantidade || 1), valor: P.round(val, 2) });
      } else {
        const ins = P.Store.get('insumos', l.insumo_id);
        const r = await pedirQtdPreco({ titulo: l.descricao, unidade: l.unidade, qtd: l.quantidade, preco: l.preco_unit, precoAtual: ins && !ant ? +ins.preco : null, editar: true });
        if (!r) return;
        Object.assign(l, r);
        if (l.nota && (l.nota.incerto || l.nota.un !== l.unidade) && l.nota.q > 0) l.fator = r.quantidade / l.nota.q;
      }
      l.foto = false;
      desenharLinhas();
    }
    // item da nota sem ficha: escolher o insumo (ou deixar só no gasto)
    async function ligarLinha(l) {
      const freq = frequencia();
      const ins = P.Store.all('insumos').sort((a, b) => ((b.id === l.sugerido) - (a.id === l.sugerido)) || ((freq.get(b.id) || 0) - (freq.get(a.id) || 0)) || a.nome.localeCompare(b.nome, 'pt-BR'));
      const id = await P.UI.escolher({
        titulo: 'Qual insumo é "' + l.lido + '"?',
        opcoes: [{ v: '_nenhum', rotulo: 'Nenhum — deixar sem ficha', sub: 'entra no gasto (sacola, limpeza…); o app lembra' }]
          .concat(ins.map(i => ({ v: i.id, rotulo: i.nome, sub: 'último ' + P.Fichas.precoUnit(i) }))),
      });
      if (!id) return;
      if (id === '_nenhum') { l.ligar = false; l.esquecer = true; desenharLinhas(); return; }
      const i = P.Store.get('insumos', id);
      const q = l.nota && !l.nota.incerto && l.nota.un === i.unidade && l.nota.q > 0 ? l.nota.q : null;
      const r = await pedirQtdPreco({ titulo: i.nome, unidade: i.unidade, qtd: q, preco: q ? l.valor / q : +i.preco, total: q ? null : l.valor, precoAtual: +i.preco,
        sub: 'Na nota: ' + l.lido + ' · ' + (l.nota ? l.nota.txt + ' · ' : '') + P.brl(l.valor) + (l.nota && l.nota.incerto ? ' — quantas ' + (UN[i.unidade] || i.unidade) + ' vieram ao todo?' : '') });
      if (!r) return;
      const fator = l.nota && (l.nota.incerto || l.nota.un !== i.unidade) && l.nota.q > 0 ? r.quantidade / l.nota.q : null;
      Object.assign(l, { insumo_id: i.id, descricao: i.nome, unidade: i.unidade, ligar: false, esquecer: false, foto: false, fator }, r);
      P.vibrar(15);
      desenharLinhas();
    }
    async function usarLeitor() {
      const e = await escanearQR();
      if (e) usarNota(e);
    }
    async function usarColar() {
      const nota = await pedirTextoNota();
      if (nota) usarNota({ nota });
    }
    async function usarNota(entrada) {
      const nota = entrada.nota || await lerNota(entrada);
      if (!nota) return;
      const ja = nota.chave && P.Store.all('compras').find(c => c.obs && c.obs.includes(nota.chave) && c.id !== (ant && ant.id));
      if (ja && !(await P.UI.confirmar('Essa nota já foi lançada em ' + P.Dia.rotuloCurto(ja.dia_operacional) + ' (' + P.brl(ja.total) + '). Lançar de novo?', { ok: 'Lançar de novo' }))) return;
      if (nota.fornecedor && !d.fornecedor.trim()) { d.fornecedor = nota.fornecedor; inForn.value = d.fornecedor; }
      if (nota.dia && nota.dia !== d.dia) mudaDia(nota.dia);
      if (nota.forma && nota.forma !== d.forma) { d.forma = nota.forma; const s2 = mkSegForma(); segForma.replaceWith(s2); segForma = s2; }
      if (nota.chave) d.obs = [d.obs, 'NFC-e ' + nota.chave].filter(Boolean).join(' · ');
      d.linhas = d.linhas.concat(linhasDaNota(nota));
      totalNota = nota.total > 0 ? (totalNota || 0) + nota.total : totalNota;
      P.vibrar([20, 40, 20]);
      desenharLinhas();
    }
    // o app lembra qual insumo é cada produto da nota (vale para todos os aparelhos)
    function lembrarProdutos() {
      const mapa = mapaNota();
      let mudou = false;
      d.linhas.forEach(l => {
        if (!l.lido) return;
        const v = l.insumo_id ? l.insumo_id + (l.fator ? '|' + P.round(l.fator, 4) : '') : l.esquecer ? '_nenhum' : null;
        if (v && mapa[chaveProduto(l.lido)] !== v) { mapa[chaveProduto(l.lido)] = v; mudou = true; }
      });
      if (mudou) P.salvarCfg('nota_insumos', mapa);
    }
    function salvarCompra() {
      if (!d.linhas.length) return;
      lembrarProdutos();
      const r = salvar(d, ant && ant.id);
      diaLista = r.compra.dia_operacional;
      P.vibrar([20, 40, 20]);
      // mostra o resultado depois que a lista de compras abrir (trocar de tela fecha as folhas)
      const aoTrocar = () => { window.removeEventListener('hashchange', aoTrocar); setTimeout(() => mostrarResultado(r), 0); };
      window.addEventListener('hashchange', aoTrocar);
      location.hash = '#/compras';
    }

    view.append(
      voltar(ant ? '#/compras/c/' + ant.id : '#/compras', ant ? 'Compra' : 'Compras'),
      h('div', { class: 'form' },
        h('div', { class: 'form-tit' }, ant ? 'Editar compra' : 'Lançar compra', tDia),
        ant ? null : h('div', { class: 'row gap cp-novas' },
          h('button', { type: 'button', class: 'btn grow', onClick: usarColar }, P.UI.icone('lapis'), 'Colar itens'),
          h('button', { type: 'button', class: 'btn grow', onClick: usarLeitor }, P.UI.icone('camera'), 'Ler QR')),
        elAviso,
        h('div', { class: 'campo-l' }, h('span', { class: 'campo-r' }, 'Dia da compra'), bDia),
        h('div', { class: 'campo-l' }, h('span', { class: 'campo-r' }, 'De quem'), inForn, chipsForn),
        h('div', { class: 'campo-l' }, h('span', { class: 'campo-r' }, 'Itens'), elLinhas,
          h('button', { type: 'button', class: 'btn bloco cp-add', onClick: adicionar }, P.UI.icone('mais'), 'Adicionar item')),
        h('div', { class: 'campo-l' }, h('span', { class: 'campo-r' }, 'Como pagou'),
          segForma,
          h('small', { class: 'campo-d' }, '"A prazo" fica em Compras → A pagar até você marcar como pago.'))),
      elBarra);
    desenharLinhas();
    if (!ant && fotoPendente) { const f = fotoPendente; fotoPendente = null; if (f === 'leitor') usarLeitor(); else if (f === 'colar') usarColar(); else usarNota({ foto: f }); }
    else if (!ant) setTimeout(() => { if (!d.linhas.length && location.hash === '#/compras/nova') adicionar(); }, 250);
    return {};
  }

  // Depois de salvar: o que mudou de preço e o efeito nos pratos
  function mostrarResultado(r) {
    const partes = [];
    if (r.mudancas.length) {
      partes.push(h('div', { class: 'secao' }, 'Preços atualizados nas fichas'));
      partes.push(h('div', { class: 'rs-itens' }, r.mudancas.map(m => {
        const dif = m.de > 0 ? (m.para / m.de - 1) * 100 : 0;
        return h('div', { class: 'rs-l cp' }, h('span', { class: 'rs-n' }, m.ins.nome),
          h('span', { class: 'rs-v' }, P.Fichas.precoFmt(m.de) + ' → ' + P.Fichas.precoFmt(m.para), h('em', { class: dif > 0 ? 't-vermelho' : 't-verde' }, ' ' + (dif > 0 ? '+' : '') + P.num(dif, 1) + '%')));
      })));
      partes.push(h('div', { class: 'secao' }, 'Efeito na margem dos pratos'));
      P.Fichas.frasesEfeito(r.efeito).forEach(n => partes.push(n));
    } else {
      partes.push(h('div', { class: 'efeito neutro' }, 'Nenhum preço mudou — fichas continuam iguais.'));
    }
    const sh = P.UI.sheet(h('div', { class: 'np-sheet' },
      h('div', { class: 'cp-ok' }, P.UI.icone('check'), h('div', null, h('b', null, 'Compra salva · ' + P.brl(r.compra.total)), h('small', null, nomeCompra(r.compra) + ' · ' + NOME_FORMA[r.compra.forma]))),
      partes,
      h('button', { type: 'button', class: 'btn primario bloco', onClick: () => sh.fechar() }, 'Ok')),
    { titulo: 'Compra lançada' });
  }

  // ---------------------------------------------------------------
  //  TELA: DETALHE DA COMPRA
  // ---------------------------------------------------------------
  function telaDetalhe(view, params) {
    view.className = 'v-compras';
    const corpo = h('div');
    function desenhar() {
      corpo.innerHTML = '';
      const c = P.Store.get('compras', params.id);
      if (!c) { corpo.appendChild(P.UI.vazio('Compra não encontrada (pode ter sido excluída).')); return; }
      const u = c.usuario_id && P.Store.get('usuarios', c.usuario_id);
      corpo.appendChild(h('div', { class: 'rs-cab' },
        h('div', { class: 'rs-tit' }, nomeCompra(c)),
        h('div', { class: 'rs-sub' }, P.Dia.rotulo(c.dia_operacional) + ' · ' + P.Dia.hora(c.criado_em) + (u ? ' · lançada por ' + u.nome : '')),
        h('div', { class: 'rs-total' }, P.brl(c.total)),
        h('div', { class: 'row gap' }, chipForma(c), c.forma === 'PRAZO' && c.pago_em ? h('span', { class: 'tag neutra' }, 'pago em ' + (NOME_FORMA[c.pago_forma] || '')) : null)));
      corpo.appendChild(h('div', { class: 'secao' }, 'Itens'));
      corpo.appendChild(h('div', { class: 'rs-itens' }, itensDe(c.id).map(l => h('div', { class: 'rs-l cp' },
        h('span', { class: 'rs-n' }, l.descricao, h('small', null, P.numAuto(l.quantidade) + ' ' + (UN[l.unidade] || l.unidade) + ' × ' + P.Fichas.precoFmt(l.preco_unit) +
          ((ins => (ins && P.UI.semAcento(ins.nome) !== P.UI.semAcento(l.descricao) ? ' · ficha: ' + ins.nome : ''))(l.insumo_id && P.Store.get('insumos', l.insumo_id))))),
        h('span', { class: 'rs-v' }, P.brl(l.valor))))));
      const acoes = h('div', { class: 'row gap acoes' });
      if (c.forma === 'PRAZO' && !c.pago_em) acoes.appendChild(h('button', { type: 'button', class: 'btn primario grow', onClick: () => pagarSheet([c], nomeCompra(c)) }, P.UI.icone('check'), 'Marcar como pago'));
      acoes.appendChild(h('a', { class: 'btn grow', href: '#/compras/editar/' + c.id }, P.UI.icone('lapis'), 'Editar'));
      if (P.Auth.isDono()) acoes.appendChild(h('button', { type: 'button', class: 'btn perigo', 'aria-label': 'Excluir', onClick: async () => {
        if (!(await P.UI.confirmar('Excluir esta compra de ' + P.brl(c.total) + '? Os preços das fichas não voltam atrás.', { ok: 'Excluir', perigo: true }))) return;
        itensDe(c.id).forEach(l => P.Store.remove('compra_itens', l.id));
        P.Store.remove('compras', c.id);
        location.hash = '#/compras';
      } }, P.UI.icone('lixo')));
      corpo.appendChild(acoes);
    }
    view.append(voltar('#/compras', 'Compras'), corpo);
    desenhar();
    return { onDados: desenhar };
  }

  // ---------------------------------------------------------------
  //  TELA: A PAGAR (compras a prazo)
  // ---------------------------------------------------------------
  function pagarSheet(compras, nome) {
    const tot = compras.reduce((s, c) => s + (+c.total || 0), 0);
    const sh = P.UI.sheet(h('div', { class: 'np-sheet' },
      h('div', { class: 'rs-itens' }, compras.map(c => h('div', { class: 'rs-l' },
        h('span', { class: 'rs-h' }, P.Dia.rotuloCurto(c.dia_operacional)), h('span', { class: 'rs-n' }, resumoItens(c)), h('span', { class: 'rs-v' }, P.brl(c.total))))),
      h('div', { class: 'secao' }, 'Paguei ' + P.brl(tot) + ' em:'),
      h('div', { class: 'pg-formas' }, FORMAS.filter(f => f.v !== 'PRAZO').map(f => h('button', { type: 'button', class: 'pg-forma f-' + f.v.toLowerCase(), onClick: () => {
        const antes = compras.map(c => Object.assign({}, c));
        pagar(compras, f.v);
        P.vibrar([20, 40, 20]);
        sh.fechar();
        P.UI.toast(nome + ': ' + P.brl(tot) + ' pago (' + f.rotulo + ')', { acao: { rotulo: 'Desfazer', fn: () => antes.forEach(c => P.Store.put('compras', c)) } });
      } }, h('span', { class: 'pg-ic' }, P.UI.icone(P.Mesas.ICONE_FORMA[f.v])), f.rotulo)))),
    { titulo: 'Pagar ' + nome });
  }
  function telaPagar(view) {
    view.className = 'v-compras';
    const corpo = h('div');
    function desenhar() {
      corpo.innerHTML = '';
      const grupos = new Map();
      aPagar().forEach(c => {
        const nome = c.fornecedor || 'Sem fornecedor';
        const k = P.UI.semAcento(nome);
        if (!grupos.has(k)) grupos.set(k, { nome, total: 0, compras: [] });
        const g = grupos.get(k);
        g.total += +c.total || 0;
        g.compras.push(c);
      });
      const lista = [...grupos.values()].sort((a, b) => b.total - a.total);
      const tot = lista.reduce((s, g) => s + g.total, 0);
      corpo.appendChild(h('div', { class: 'fx-resumo' }, h('div', { class: 'fx-tot' }, h('small', null, lista.length + (lista.length === 1 ? ' fornecedor' : ' fornecedores') + ' a pagar'), h('b', { class: tot ? 't-amarelo' : null }, P.brl(tot)))));
      if (!lista.length) { corpo.appendChild(P.UI.vazio('Nada a pagar. Compras lançadas como "A prazo" aparecem aqui.', 'check')); return; }
      corpo.appendChild(h('div', { class: 'ms-lista' }, lista.map(g => {
        const desde = g.compras.map(c => c.dia_operacional).sort()[0];
        return h('button', { type: 'button', class: 'ms-card', onClick: () => pagarSheet(g.compras, g.nome) },
          h('div', { class: 'ms-card-n' }, g.nome, h('small', null, g.compras.length + (g.compras.length === 1 ? ' compra' : ' compras') + ' · desde ' + P.Dia.rotuloCurto(desde))),
          h('b', { class: 't-amarelo' }, P.brl(g.total)));
      })));
    }
    view.append(subnavCompras('pagar'), corpo);
    desenhar();
    return { onDados(t) { if (t.has('compras')) desenhar(); } };
  }

  // ---------------------------------------------------------------
  //  TELA: CUSTOS (dono) — comprado × consumido pela ficha, por insumo
  // ---------------------------------------------------------------
  function custos(dias) {
    const set = new Set(dias);
    const I = P.Calc.idx();
    const linhas = new Map();
    const pegar = id => {
      if (!linhas.has(id)) { const ins = I.insumos.get(id); linhas.set(id, { ins, qC: 0, vC: 0, qU: 0, vU: 0 }); }
      return linhas.get(id);
    };
    let comprado = 0, avulso = 0;
    P.Store.all('compras').forEach(c => {
      if (!set.has(c.dia_operacional)) return;
      itensDe(c.id).forEach(l => {
        comprado += +l.valor || 0;
        if (!l.insumo_id || !I.insumos.has(l.insumo_id)) { avulso += +l.valor || 0; return; }
        const g = pegar(l.insumo_id);
        g.qC += +l.quantidade || 0; g.vC += +l.valor || 0;
      });
    });
    let cmv = 0, fat = 0;
    const vendido = new Map();
    P.Store.all('comandas').forEach(c => {
      if (c.status !== 'FECHADA' || !set.has(c.dia_operacional)) return;
      fat += +c.total || 0;
      P.Mesas.linhas(c.id).forEach(l => {
        const q = +l.quantidade || 0;
        cmv += q * (+l.cmv_unit || 0);
        vendido.set(l.item_id, (vendido.get(l.item_id) || 0) + q);
      });
    });
    const acc = new Map();
    vendido.forEach((q, itemId) => P.Calc.consumo(itemId, q, acc));
    acc.forEach((q, insId) => {
      const g = pegar(insId);
      g.qU += q;
      g.vU += q * (g.ins ? +g.ins.preco : 0);
    });
    const lista = [...linhas.values()].filter(g => g.ins && (g.qC > 0.0001 || g.qU > 0.0001));
    return { lista, comprado, avulso, cmv, fat };
  }
  function variacoes(dias) {
    const ini = dias[dias.length - 1];
    const porIns = new Map();
    P.Store.all('historico_precos').forEach(hp => { if (!porIns.has(hp.insumo_id)) porIns.set(hp.insumo_id, []); porIns.get(hp.insumo_id).push(hp); });
    const out = [];
    porIns.forEach((hs, insId) => {
      hs.sort((a, b) => (a.data < b.data ? -1 : 1));
      const ultimo = hs[hs.length - 1];
      if (P.Dia.diaOperacional(ultimo.data) < ini) return;
      const anterior = hs.filter(x => P.Dia.diaOperacional(x.data) < ini).pop() || (hs.length > 1 ? hs[0] : null);
      if (!anterior || anterior === ultimo || !(+anterior.preco > 0)) return;
      const ins = P.Store.get('insumos', insId);
      if (!ins) return;
      const dif = (+ultimo.preco / +anterior.preco - 1) * 100;
      if (Math.abs(dif) < 0.5) return;
      out.push({ ins, de: +anterior.preco, para: +ultimo.preco, dif });
    });
    return out.sort((a, b) => Math.abs(b.dif) - Math.abs(a.dif));
  }
  function telaCustos(view) {
    view.className = 'v-compras';
    let periodo = 'semana';
    const corpo = h('div');
    function diasDo(p) {
      const hoje = P.Dia.hoje();
      if (p === 'hoje') return [hoje];
      if (p === 'semana') return P.Dia.ultimos(6, hoje);
      return P.Dia.doMes(P.Dia.mes(hoje), hoje).reverse();
    }
    function desenhar() {
      corpo.innerHTML = '';
      const dias = diasDo(periodo);
      const r = custos(dias);
      const fcReal = r.fat > 0 ? r.comprado / r.fat * 100 : null;
      const fcFicha = r.fat > 0 ? r.cmv / r.fat * 100 : null;
      corpo.appendChild(h('div', { class: 'kpis3' },
        kpi('Comprado', P.brl0(r.comprado), fcReal == null ? 'sem vendas no período' : P.pct(fcReal, 0) + ' das vendas'),
        kpi('Custo do vendido', P.brl0(r.cmv), fcFicha == null ? 'pela ficha técnica' : P.pct(fcFicha, 0) + ' das vendas (ficha)'),
        kpi('Diferença', P.brl0(r.comprado - r.cmv), r.comprado - r.cmv > 0 ? 'estoque que sobrou ou perda' : 'usou estoque antigo', r.comprado - r.cmv > 0 ? 'amarelo' : 'verde')));
      corpo.appendChild(h('div', { class: 'dica' }, 'Comprado × usado pelas vendas, calculado pela ficha técnica (peso bruto, com fator de correção e perda). Sobra grande que se repete = desperdício, porção maior que a ficha ou venda sem comanda.'));
      if (!r.lista.length) { corpo.appendChild(P.UI.vazio('Sem compras nem vendas neste período.', 'compras')); return; }
      const lista = r.lista.slice().sort((a, b) => Math.max(b.vC, b.vU) - Math.max(a.vC, a.vU));
      corpo.appendChild(h('div', { class: 'secao' }, 'Por insumo'));
      corpo.appendChild(h('div', { class: 'ct-lista' }, lista.map(g => {
        const un = UN[g.ins.unidade] || g.ins.unidade;
        const max = Math.max(g.qC, g.qU, 0.0001);
        const sobra = g.qC - g.qU;
        const pctSobra = g.qC > 0 ? sobra / g.qC * 100 : null;
        const cor = g.qC <= 0 ? 'cinza' : pctSobra > 15 ? 'amarelo' : pctSobra < -5 ? 'azul' : 'verde';
        return h('div', { class: 'ct-l' },
          h('div', { class: 'ct-l-top' }, h('b', null, g.ins.nome), h('span', { class: 'ct-l-preco' }, P.Fichas.precoUnit(g.ins))),
          h('div', { class: 'ct-bar' },
            h('span', { class: 'ct-bar-c', style: { width: (g.qC / max * 100) + '%' } }),
            h('span', { class: 'ct-bar-u', style: { width: (g.qU / max * 100) + '%' } })),
          h('div', { class: 'ct-l-nums' },
            h('span', null, h('i', { class: 'lg-c2' }), 'comprado ', h('b', null, P.numAuto(g.qC, 2) + ' ' + un), ' · ' + P.brl0(g.vC)),
            h('span', null, h('i', { class: 'lg-u2' }), 'usado ', h('b', null, P.numAuto(g.qU, 2) + ' ' + un)),
            h('span', { class: 't-' + cor }, g.qC <= 0 ? 'sem compra lançada' : (sobra >= 0 ? 'sobrou ' : 'faltou ') + P.numAuto(Math.abs(sobra), 2) + ' ' + un + (pctSobra != null ? ' (' + P.num(Math.abs(pctSobra), 0) + '%)' : ''))));
      })));
      if (r.avulso) corpo.appendChild(h('div', { class: 'dica' }, 'Itens sem ficha comprados no período: ' + P.brl(r.avulso) + ' (entram no gasto, sem comparação de consumo).'));
      const vs = variacoes(dias);
      if (vs.length) {
        corpo.appendChild(h('div', { class: 'secao' }, 'Preços que mudaram no período'));
        corpo.appendChild(h('div', { class: 'rs-itens' }, vs.map(x => h('div', { class: 'rs-l cp' },
          h('span', { class: 'rs-n' }, x.ins.nome, h('small', null, P.Fichas.precoFmt(x.de) + ' → ' + P.Fichas.precoFmt(x.para) + '/' + (UN[x.ins.unidade] || x.ins.unidade))),
          h('span', { class: 'rs-v ' + (x.dif > 0 ? 't-vermelho' : 't-verde') }, (x.dif > 0 ? '+' : '') + P.num(x.dif, 1) + '%')))));
      }
    }
    function kpi(rot, val, sub, cor) {
      return h('div', { class: 'kpi' }, h('div', { class: 'kpi-rot' }, rot), h('div', { class: 'kpi-val' + (cor ? ' t-' + cor : '') }, val), sub ? h('div', { class: 'kpi-sub' }, sub) : null);
    }
    view.append(subnavCompras('custos'),
      P.UI.seg([{ v: 'hoje', rotulo: 'Hoje' }, { v: 'semana', rotulo: 'Semana' }, { v: 'mes', rotulo: 'Mês' }], periodo, v => { periodo = v; desenhar(); }, 'seg-p'),
      corpo);
    desenhar();
    return { onDados(t) { if (t.has('compras') || t.has('compra_itens') || t.has('comandas') || t.has('insumos')) desenhar(); } };
  }

  P.UI.rota('compras', { titulo: 'Compras', tab: 'compras', render: telaCompras });
  P.UI.rota('calendario', { titulo: 'Compras', tab: 'compras', render: view => { abrirCal = true; return telaCompras(view); } });
  P.UI.rota('compras/nova', { titulo: 'Lançar compra', tab: 'compras', render: telaNova });
  P.UI.rota('compras/editar/:id', { titulo: 'Editar compra', tab: 'compras', render: telaNova });
  P.UI.rota('compras/c/:id', { titulo: 'Compra', tab: 'compras', render: telaDetalhe });
  P.UI.rota('compras/pagar', { titulo: 'A pagar', tab: 'compras', render: telaPagar });
  P.UI.rota('compras/custos', { titulo: 'Custos', tab: 'compras', dono: true, render: telaCustos });

  P.Compras = { calendario, itensDe, aPagar, doDia, salvar, pagar, custos, variacoes, NOME_FORMA, cardResultado };
})();
