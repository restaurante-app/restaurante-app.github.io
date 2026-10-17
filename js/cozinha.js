/* FOLHA DA COZINHA — a folha que fica impressa na cozinha para as cozinheiras saberem o
   que fazer: os pratos do dia (cada dia da semana tem os seus) e os fixos da chapa, cada um
   com o que leva. O "Leva" fica guardado no prato: ele volta em outro dia já escrito.
   Monta em poucos toques e imprime numa folha A4 no visual da marca (faixa Maria Simone,
   creme e vermelho), com a letra encolhendo sozinha quando há muito prato para caber numa
   página. O dono monta; todos veem e imprimem.
   Guardado em config 'cozinha': { pratos: { id: { nome, leva } }, dias: { '1'…'6': [ids] },
   fixos: [ids], com_data } — o mesmo prato pode estar em vários dias e nos fixos. */
(function () {
  'use strict';
  const P = window.P;
  const h = P.UI.h;
  const DIAS = [1, 2, 3, 4, 5, 6];
  const CURTO = { 1: 'Seg', 2: 'Ter', 3: 'Qua', 4: 'Qui', 5: 'Sex', 6: 'Sáb' };
  const LARG = 793, ALT = 1122; // A4 em px (96 por polegada)
  const FONTES = 'https://fonts.googleapis.com/css2?family=Atkinson+Hyperlegible:wght@400;700&family=Bagel+Fat+One&display=swap';
  const NOME = d => P.Cardapio.NOME[d];

  // ---------------------------------------------------------------
  //  Dados
  // ---------------------------------------------------------------
  const chave = n => P.UI.semAcento(n).replace(/\s+/g, ' ').trim();
  function cfg() {
    const c = JSON.parse(JSON.stringify(P.cfg('cozinha') || {})); // cópia: quem salva mexe nela
    if (!c.pratos || typeof c.pratos !== 'object') c.pratos = {};
    if (!c.dias || typeof c.dias !== 'object') c.dias = {};
    if (!Array.isArray(c.fixos)) c.fixos = [];
    return c;
  }
  // muda e salva; devolve como estava (para o Desfazer)
  function salvar(muda) {
    const c = cfg();
    const antes = JSON.parse(JSON.stringify(c));
    muda(c);
    P.salvarCfg('cozinha', c);
    return antes;
  }
  const desfazer = antes => ({ rotulo: 'Desfazer', fn: () => P.salvarCfg('cozinha', antes) });
  // onde = 'fixos' ou o dia da semana (1..6)
  function ler(c, onde) {
    const l = onde === 'fixos' ? c.fixos : c.dias[onde];
    return (Array.isArray(l) ? l : []).filter(id => c.pratos[id]);
  }
  function gravar(c, onde, ids) {
    if (onde === 'fixos') c.fixos = ids;
    else if (ids.length) c.dias[onde] = ids;
    else delete c.dias[onde];
  }
  // prato com o mesmo nome é o mesmo prato (o "Leva" dele vale em todo lugar)
  function acharOuCriar(c, nome) {
    const k = chave(nome);
    const ja = Object.keys(c.pratos).find(id => chave(c.pratos[id].nome) === k);
    if (ja) return ja;
    const id = 'cz_' + P.uuid().slice(0, 8);
    c.pratos[id] = { nome: nome.trim(), leva: '' };
    return id;
  }
  // a data da folha: o dia escolhido nesta semana (hoje ou o próximo)
  function dataDe(sem) {
    const hoje = P.Dia.hoje();
    const s = P.Cardapio.diaSemana(hoje);
    return P.Dia.somaDias(hoje, sem >= s ? sem - s : sem - s + 7);
  }
  function resumo(sem) {
    const c = cfg();
    return { dia: ler(c, sem).length, fixos: ler(c, 'fixos').length };
  }

  // ---------------------------------------------------------------
  //  A folha (A4)
  // ---------------------------------------------------------------
  function folha(c, sem, comData) {
    const cartao = id => {
      const p = c.pratos[id];
      return h('div', { class: 'cz-prato' }, h('div', { class: 'cz-nome' }, p.nome),
        p.leva ? h('div', { class: 'cz-leva' }, h('b', null, 'Leva:'), ' ' + p.leva) : null);
    };
    const fx = ler(c, 'fixos');
    return h('div', { class: 'cz-folha' },
      h('img', { class: 'cz-faixa', src: 'icons/faixa-cozinha.png', width: 1524, height: 365, alt: 'Maria Simone — Restaurante & Marmitas' }),
      h('div', { class: 'cz-cab' }, h('span', { class: 'cz-cab-t' }, 'PRATOS DO DIA'),
        h('span', { class: 'cz-cab-d' }, comData ? NOME(sem).toUpperCase() + ', ' + P.Dia.rotuloCurto(dataDe(sem)) : P.Cardapio.LONGO[sem].toUpperCase())),
      ler(c, sem).map(cartao),
      fx.length ? [h('div', { class: 'cz-sec' }, 'FIXOS · NA CHAPA, NA HORA'), h('div', { class: 'cz-fixos' }, fx.map(cartao))] : null);
  }
  // muito prato: encolhe a letra até caber numa página (até a metade) → { k, coube }
  function encaixar(f) {
    if (!f || !f.isConnected) return null;
    let k = 1;
    f.style.setProperty('--k', k);
    const sobra = () => f.scrollHeight > f.clientHeight + 1;
    while (k > 0.5 && sobra()) {
      k = P.round(k - 0.04, 2);
      f.style.setProperty('--k', k);
    }
    return { k, coube: !sobra() };
  }
  // fontes da folha (as mesmas da arte aprovada): só baixa quando a tela abre; sem internet
  // na primeira vez, a folha sai com a letra do app
  let fontesP = null;
  function fontes() {
    if (!fontesP) {
      fontesP = new Promise(res => {
        const l = h('link', { rel: 'stylesheet', href: FONTES });
        l.addEventListener('load', res);
        l.addEventListener('error', res);
        document.head.appendChild(l);
      }).then(() => document.fonts && document.fonts.load ? Promise.all([
        document.fonts.load('30px "Bagel Fat One"', 'Baião'),
        document.fonts.load('20px "Atkinson Hyperlegible"', 'Leva'),
        document.fonts.load('700 20px "Atkinson Hyperlegible"', 'Leva'),
      ]) : null).catch(() => {});
    }
    return Promise.race([fontesP, new Promise(r => setTimeout(r, 3000))]);
  }

  // ---------------------------------------------------------------
  //  Editar e adicionar
  // ---------------------------------------------------------------
  function editar(id, onde, escreverLeva) {
    const c = cfg();
    const p = c.pratos[id];
    if (!p) return;
    const nome = h('input', { class: 'campo', type: 'text', autocomplete: 'off', enterkeyhint: 'next' });
    nome.value = p.nome;
    const ta = h('textarea', { class: 'campo cz-ta', rows: 4, placeholder: 'Ex.: arroz, feijão de corda, carne seca desfiada, cebola, alho e coentro.' });
    ta.value = p.leva || '';
    const outros = DIAS.filter(d => d !== onde && ler(c, d).includes(id)).map(d => NOME(d)).concat(onde !== 'fixos' && c.fixos.includes(id) ? ['fixos'] : []);
    function ok() {
      const n = nome.value.trim();
      if (!n) { P.UI.toast('Escreva o nome do prato.', { tipo: 'perigo' }); nome.focus(); return; }
      const leva = ta.value.replace(/^\s*leva\s*:\s*/i, '').replace(/\s+/g, ' ').trim();
      salvar(x => { x.pratos[id] = Object.assign({}, x.pratos[id], { nome: n, leva }); });
      sh.fechar();
    }
    nome.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); ta.focus(); } });
    const sh = P.UI.sheet(h('div', { class: 'np-sheet' },
      h('label', { class: 'campo-l' }, h('span', { class: 'campo-r' }, 'Prato'), nome),
      h('label', { class: 'campo-l' }, h('span', { class: 'campo-r' }, 'Leva'), ta),
      outros.length ? h('small', { class: 'campo-d' }, 'O que leva muda também em: ' + outros.join(', ') + '.') : null,
      h('div', { class: 'row gap' },
        h('button', { type: 'button', class: 'btn perigo ic', 'aria-label': 'Tirar da folha', onClick: () => { sh.fechar(); tirar(id, onde); } }, P.UI.icone('lixo')),
        h('button', { type: 'button', class: 'btn', onClick: () => sh.fechar() }, 'Cancelar'),
        h('button', { type: 'button', class: 'btn primario grow', onClick: ok }, 'Salvar'))),
    { titulo: onde === 'fixos' ? 'Fixo da chapa' : 'Prato de ' + NOME(onde) });
    if (escreverLeva) setTimeout(() => ta.focus(), 80);
  }
  function tirar(id, onde) {
    let nome = '';
    const antes = salvar(x => { nome = x.pratos[id] ? x.pratos[id].nome : ''; gravar(x, onde, ler(x, onde).filter(i => i !== id)); });
    P.UI.toast(nome + ' saiu ' + (onde === 'fixos' ? 'dos fixos' : 'da folha de ' + NOME(onde)), { acao: desfazer(antes) });
  }
  function mover(onde, i, d) {
    salvar(x => {
      const ids = ler(x, onde);
      const j = i + d;
      if (j < 0 || j >= ids.length) return;
      [ids[i], ids[j]] = [ids[j], ids[i]];
      gravar(x, onde, ids);
    });
  }
  // escolher na lista (pratos do cardápio do dia, os já usados na cozinha, os da comanda) ou escrever um novo
  function adicionar(onde) {
    const c = cfg();
    const naFolha = new Set(ler(c, onde).map(id => chave(c.pratos[id].nome)));
    const guardado = new Map(Object.keys(c.pratos).map(id => [chave(c.pratos[id].nome), c.pratos[id]]));
    const doDia = onde === 'fixos' ? [] : P.Cardapio.itensDe(onde).map(it => it.nome);
    const naCozinha = Object.keys(c.pratos).map(id => c.pratos[id].nome).sort((a, b) => a.localeCompare(b, 'pt-BR'));
    const daComanda = P.Cardapio.pratos().map(it => it.nome);
    const vistos = new Set();
    const ops = [];
    doDia.concat(naCozinha, daComanda).forEach(nome => {
      const k = chave(nome);
      if (vistos.has(k) || naFolha.has(k)) return;
      vistos.add(k);
      const g = guardado.get(k);
      const sub = [g && g.leva ? 'Leva: ' + g.leva : null, doDia.some(n => chave(n) === k) ? 'no cardápio de ' + NOME(onde) : null].filter(Boolean).join(' · ');
      ops.push({ nome, k, sub: sub || (g ? 'sem o que leva' : 'prato da comanda') });
    });
    const busca = h('input', { type: 'search', class: 'campo', placeholder: 'Buscar ou escrever o nome…', autocomplete: 'off', enterkeyhint: 'done' });
    const lista = h('div', { class: 'esc-lista' });
    let feito = false;
    function escolher(nome) {
      if (feito) return;
      feito = true;
      let id;
      salvar(x => { id = acharOuCriar(x, nome); const ids = ler(x, onde); if (!ids.includes(id)) gravar(x, onde, ids.concat(id)); });
      sh.fechar();
      P.vibrar(10);
      const p = cfg().pratos[id];
      if (p && !p.leva) editar(id, onde, true); // prato novo: já abre para escrever o que leva
    }
    function desenhar() {
      const q = busca.value.trim();
      const k = chave(q);
      lista.innerHTML = '';
      if (q && naFolha.has(k)) lista.appendChild(h('div', { class: 'dica' }, q + ' já está ' + (onde === 'fixos' ? 'nos fixos.' : 'na folha de ' + NOME(onde) + '.')));
      else if (q && !ops.some(o => o.k === k)) {
        lista.appendChild(h('button', { type: 'button', class: 'esc-op cz-novo', onClick: () => escolher(q) },
          h('span', { class: 'esc-rot' }, P.UI.icone('mais'), ' Novo: ' + q), h('span', { class: 'esc-sub' }, 'depois escreva o que leva')));
      }
      ops.filter(o => !k || o.k.includes(k)).forEach(o => lista.appendChild(h('button', { type: 'button', class: 'esc-op', onClick: () => escolher(o.nome) },
        h('span', { class: 'esc-rot' }, o.nome), h('span', { class: 'esc-sub' }, o.sub))));
      if (!lista.children.length) lista.appendChild(h('div', { class: 'dica' }, 'Escreva o nome do prato.'));
    }
    busca.addEventListener('input', desenhar);
    busca.addEventListener('keydown', e => {
      if (e.key !== 'Enter') return;
      e.preventDefault();
      const q = busca.value.trim();
      if (!q || naFolha.has(chave(q))) return;
      const exato = ops.find(o => o.k === chave(q));
      escolher(exato ? exato.nome : q);
    });
    const sh = P.UI.sheet(h('div', { class: 'esc' }, busca, lista),
      { titulo: onde === 'fixos' ? 'Adicionar fixo' : 'Prato de ' + NOME(onde), cls: 'sheet-alta' });
    desenhar();
    setTimeout(() => busca.focus(), 80);
  }

  // ---------------------------------------------------------------
  //  TELA
  // ---------------------------------------------------------------
  function telaCozinha(view) {
    view.className = 'v-mesas v-cardapio';
    const dono = P.Auth.isDono();
    let sem = P.Cardapio.diaSemana(P.Dia.hoje());
    let comData = cfg().com_data !== false;
    // a folha que vai para a impressora fica pronta (fora da tela) enquanto esta tela está aberta:
    // o botão Imprimir e o Imprimir do navegador (Ctrl+P) saem só com ela, em A4 sem margem
    const impressao = h('div', { id: 'cz-impressao', 'aria-hidden': 'true' });
    const pagina = h('style', null, '@page { size: A4 portrait; margin: 0; }');
    document.head.appendChild(pagina);
    document.body.appendChild(impressao);
    document.body.classList.add('imprime-cozinha');
    let previa = null;
    function escalar() {
      if (!previa || !previa.isConnected) return;
      const s = previa.clientWidth / LARG;
      previa.firstChild.style.transform = 'scale(' + s + ')';
      previa.style.height = Math.round(ALT * s) + 'px';
    }
    const aviso = h('div', { class: 'banner aviso cz-aviso', hidden: true });
    function encaixarTudo() {
      encaixar(impressao.firstChild);
      const r = encaixar(previa && previa.firstChild);
      aviso.hidden = !r || r.k >= 0.75;
      if (r) aviso.textContent = !r.coube ? 'Não cabe tudo numa folha: o fim fica cortado. Tire algum prato ou encurte o que leva.'
        : 'Muito prato: a letra ficou pequena para caber numa folha.';
    }
    async function imprimir() {
      await fontes();
      encaixarTudo();
      window.print();
    }
    const corpo = h('div');

    function lista(c, onde) {
      const ids = ler(c, onde);
      return h('div', { class: 'ms-lista' }, ids.map((id, i) => {
        const p = c.pratos[id];
        return h('div', { class: 'ms-card cd-lin no cz-lin' },
          h('button', { type: 'button', class: 'ds-card', onClick: () => editar(id, onde) },
            h('span', { class: 'ms-card-n' }, p.nome,
              h('small', { class: p.leva ? null : 't-amarelo' }, p.leva ? 'Leva: ' + p.leva : 'falta o que leva — toque para escrever'))),
          h('button', { type: 'button', class: 'lc-b', 'aria-label': 'Subir ' + p.nome, disabled: i === 0, onClick: () => mover(onde, i, -1) }, P.UI.icone('voltar', 'cd-sobe')),
          h('button', { type: 'button', class: 'lc-b', 'aria-label': 'Tirar ' + p.nome, onClick: () => tirar(id, onde) }, P.UI.icone('x')));
      }));
    }
    function botaoImprimir() {
      return h('button', { type: 'button', class: 'btn primario bloco', onClick: imprimir }, P.UI.icone('imprimir'), 'Imprimir a folha de ' + NOME(sem));
    }

    function desenhar() {
      const c = cfg();
      if (dono) comData = c.com_data !== false; // pode ter mudado em outro aparelho
      corpo.innerHTML = '';
      corpo.appendChild(P.UI.seg(DIAS.map(d => { const n = ler(c, d).length; return { v: d, rotulo: [CURTO[d], h('small', null, n ? String(n) : '—')] }; }), sem,
        v => { sem = v; desenhar(); }, 'seg-p cd-dias'));
      const r = { dia: ler(c, sem).length, fixos: ler(c, 'fixos').length };
      corpo.appendChild(h('div', { class: 'an-base' }, 'Folha de ' + P.Cardapio.LONGO[sem] + (comData ? ', ' + P.Dia.rotuloCurto(dataDe(sem)) : '') + ': ' +
        (r.dia ? r.dia + (r.dia === 1 ? ' prato do dia' : ' pratos do dia') : 'sem pratos do dia') + ' e ' + (r.fixos ? r.fixos + (r.fixos === 1 ? ' fixo' : ' fixos') : 'sem fixos') + '.'));
      corpo.appendChild(botaoImprimir());

      if (dono) {
        corpo.appendChild(h('div', { class: 'secao' }, 'Pratos do dia · ' + NOME(sem)));
        if (r.dia) corpo.appendChild(lista(c, sem));
        else corpo.appendChild(h('div', { class: 'dica' }, 'Nenhum prato na folha de ' + NOME(sem) + '. Toque em "Adicionar prato".'));
        const faltam = P.Cardapio.itensDe(sem).filter(it => !ler(c, sem).some(id => chave(c.pratos[id].nome) === chave(it.nome)));
        const outros = DIAS.filter(d => d !== sem && ler(c, d).length);
        corpo.appendChild(h('div', { class: 'row gap cz-acoes' },
          h('button', { type: 'button', class: 'btn grow', onClick: () => adicionar(sem) }, P.UI.icone('mais'), 'Adicionar prato'),
          outros.length ? h('button', { type: 'button', class: 'btn grow', onClick: async () => {
            const d = await P.UI.escolher({ titulo: 'Copiar para ' + NOME(sem) + ' os pratos de…', opcoes: outros.map(o => ({ v: o, rotulo: P.Cardapio.LONGO[o], sub: ler(c, o).map(id => c.pratos[id].nome).join(', ') })) });
            if (!d) return;
            const antes = salvar(x => gravar(x, sem, ler(x, d).slice()));
            P.UI.toast('Pratos de ' + NOME(d) + ' copiados para ' + NOME(sem), { acao: desfazer(antes) });
          } }, 'Copiar outro dia') : null));
        if (faltam.length) {
          corpo.appendChild(h('button', { type: 'button', class: 'btn bloco', onClick: () => {
            const antes = salvar(x => {
              const ids = ler(x, sem);
              faltam.forEach(it => { const id = acharOuCriar(x, it.nome); if (!ids.includes(id)) ids.push(id); });
              gravar(x, sem, ids);
            });
            P.UI.toast(faltam.length + (faltam.length === 1 ? ' prato do cardápio entrou' : ' pratos do cardápio entraram') + ' na folha', { acao: desfazer(antes) });
          } }, h('span', { class: 'cz-trazer' }, 'Trazer do cardápio de ' + NOME(sem), h('small', null, faltam.map(it => it.nome).join(', ')))));
        }

        corpo.appendChild(h('div', { class: 'secao' }, 'Fixos · na chapa, na hora'));
        corpo.appendChild(h('div', { class: 'an-base' }, 'Os fixos saem na folha de todos os dias.'));
        if (r.fixos) corpo.appendChild(lista(c, 'fixos'));
        corpo.appendChild(h('button', { type: 'button', class: 'btn bloco', onClick: () => adicionar('fixos') }, P.UI.icone('mais'), 'Adicionar fixo'));
      }

      corpo.appendChild(h('div', { class: 'secao' }, 'Como sai na folha'));
      previa = h('div', { class: 'cz-previa' }, folha(c, sem, comData));
      corpo.append(aviso, previa);
      corpo.appendChild(P.UI.seg([{ v: true, rotulo: 'Com a data' }, { v: false, rotulo: 'Só o dia da semana' }], comData, v => {
        comData = v;
        if (dono) salvar(x => { x.com_data = v; }); else desenhar();
      }, 'seg-p cz-data'));
      corpo.appendChild(botaoImprimir());
      if (!dono) corpo.appendChild(h('div', { class: 'dica' }, 'Só o dono muda a folha.'));
      impressao.replaceChildren(folha(c, sem, comData));
      escalar();
      encaixarTudo();
      fontes().then(encaixarTudo);
    }
    view.append(P.Cardapio.subnav('cozinha'), corpo);
    desenhar();
    window.addEventListener('resize', escalar);
    return {
      onDados(t) { if (t.has('config') || t.has('itens')) desenhar(); },
      cleanup() {
        window.removeEventListener('resize', escalar);
        document.body.classList.remove('imprime-cozinha');
        impressao.remove();
        pagina.remove();
      },
    };
  }

  P.UI.rota('cardapio/cozinha', { titulo: 'Folha da cozinha', tab: 'mais', render: telaCozinha });
  P.Cozinha = { resumo };
})();
