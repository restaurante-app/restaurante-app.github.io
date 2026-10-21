/* ACOMPANHAMENTOS E PRATOS REPETIDOS (pedido de 21/10)
   Acompanhamentos: itens com preço (Batata frita, Baião, Comida extra…) que aparecem na comanda
   embaixo dos pratos: toca no prato e depois no acompanhamento → "Filé de frango" + "Batata frita".
   O prato continua contando como 1 prato; o acompanhamento entra com o preço dele e conta à parte.
   Pratos repetidos: o mesmo prato cadastrado mais de uma vez (ou com o acompanhamento no nome)
   é juntado no que fica. O que sai fica fora da comanda e do cardápio (não é apagado) e as vendas
   dele somam no que ficou (P.Calc.principal); as vendas antigas não mudam. Dá para separar de novo.
   Criar prato na comanda com nome parecido avisa ("Já existe Filé de frango: usar + Batata frita?"). */
(function () {
  'use strict';
  const P = window.P;
  const h = P.UI.h;

  // ---------------------------------------------------------------
  //  Acompanhamentos (config 'acompanhamentos': ids na ordem da comanda)
  // ---------------------------------------------------------------
  const idsAcomp = () => { const l = P.cfg('acompanhamentos').ids; return Array.isArray(l) ? l : []; };
  const lista = () => idsAcomp().map(id => P.Store.get('itens', id)).filter(it => it && P.Calc.vendavel(it));
  const ehAcomp = id => idsAcomp().includes(id);
  const salvarIds = ids => P.salvarCfg('acompanhamentos', Object.assign({}, P.cfg('acompanhamentos'), { ids }));

  // sugeridos pelas vendas até 20/10 (o que vinha escrito no nome do prato e quanto foi cobrado a mais)
  const SUGERIDOS = [
    { nome: 'Comida extra', preco: 5, usar: 'it_ms_adicional_5', por: '"com extra", "comida a mais", "porção grande"' },
    { nome: 'Baião', preco: 5, por: '"com baião"' },
    { nome: 'Batata frita', preco: 5, por: '"com batata frita"' },
    { nome: '2 ovos', preco: 5, por: '"com ovo", "com 2 ovos"' },
    { nome: 'Feijão de corda', preco: 5, por: '"com feijão de corda"' },
    { nome: 'Feijão preto', preco: 5, por: '"com feijão preto"' },
    { nome: 'Separada', preco: 5, por: 'marmita separada (dobradinha, feijoada)' },
  ];
  const chave = n => P.UI.semAcento(n).replace(/\s+/g, ' ').trim();
  const pendentes = () => {
    const tem = new Set(lista().map(it => chave(it.nome)));
    const ids = new Set(idsAcomp());
    return SUGERIDOS.filter(s => !tem.has(chave(s.nome)) && !(s.usar && ids.has(s.usar)));
  };

  // cria o acompanhamento (ou usa o item que já existe com esse nome) e põe no fim da lista
  function criarAcomp(nome, preco, usar) {
    const k = chave(nome);
    let it = (usar && P.Store.get('itens', usar)) || P.Store.all('itens').find(i => chave(i.nome) === k);
    if (it && it.categoria !== 'GUARNICAO') { P.UI.toast('Já existe "' + it.nome + '" como ' + (P.Fichas ? P.Fichas.CAT[it.categoria] : it.categoria) + '. Use outro nome.', { tipo: 'perigo' }); return null; }
    if (it) it = P.Store.put('itens', Object.assign({}, it, { nome, ativo: true, preco_venda: +it.preco_venda > 0 ? it.preco_venda : P.round(preco, 2) }));
    else it = P.Store.put('itens', { id: P.uuid(), nome, categoria: 'GUARNICAO', preco_venda: P.round(preco, 2), perda_pct: 0, ativo: true, custo_estimado: null });
    if (!ehAcomp(it.id)) salvarIds(idsAcomp().concat(it.id));
    return it;
  }

  // folha: nome e preço (novo ou editar)
  function editarAcomp(it0) {
    return new Promise(resolve => {
      let feito = false;
      let preco = it0 ? +it0.preco_venda : null;
      const inNome = h('input', { class: 'campo', type: 'text', value: it0 ? it0.nome : '', placeholder: 'Nome (ex.: Batata frita)', autocomplete: 'off' });
      const bPreco = h('button', { type: 'button', class: 'btn valor bloco' });
      const mostrar = () => { bPreco.textContent = preco > 0 ? '+ ' + P.brl(preco) + ' no prato' : 'Preço (R$)'; };
      bPreco.addEventListener('click', async () => {
        const v = await P.UI.pedirNumero({ titulo: 'Preço do acompanhamento', valor: preco, decimais: 2, prefixo: 'R$ ', sub: 'Quanto soma no prato (ex.: Filé de frango R$ 25 + Batata frita R$ 5 = R$ 30).' });
        if (v != null && v > 0) { preco = v; mostrar(); }
      });
      function salvar() {
        const nome = inNome.value.trim();
        if (!nome) { P.UI.toast('Ponha o nome.', { tipo: 'perigo' }); inNome.focus(); return; }
        if (!(preco > 0)) { bPreco.click(); return; }
        let r;
        if (it0) {
          const outro = P.Store.all('itens').find(i => i.id !== it0.id && chave(i.nome) === chave(nome));
          if (outro) { P.UI.toast('Já existe um item "' + outro.nome + '".', { tipo: 'perigo' }); return; }
          r = P.Store.put('itens', Object.assign({}, it0, { nome, preco_venda: P.round(preco, 2), ativo: true }));
        } else { r = criarAcomp(nome, preco); if (!r) return; }
        feito = true; resolve(r); sh.fechar();
      }
      inNome.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); salvar(); } });
      const sh = P.UI.sheet(h('div', { class: 'np-sheet' },
        inNome, bPreco,
        h('small', { class: 'campo-d' }, 'Aparece na comanda embaixo dos pratos. Sem ficha técnica o custo fica de fora; dá para montar depois em Fichas.'),
        h('div', { class: 'row gap' },
          h('button', { type: 'button', class: 'btn', onClick: () => sh.fechar() }, 'Cancelar'),
          h('button', { type: 'button', class: 'btn primario grow', onClick: salvar }, P.UI.icone('check'), 'Salvar'))),
      { titulo: it0 ? 'Editar ' + it0.nome : 'Novo acompanhamento', onFechar: () => { if (!feito) resolve(null); } });
      mostrar();
      if (!it0) setTimeout(() => inNome.focus(), 80);
    });
  }

  function subnav(ativo) { return P.Cardapio.subnav(ativo); }

  function telaAcomp(view) {
    view.className = 'v-mesas v-cardapio';
    const corpo = h('div');
    function desenhar() {
      corpo.innerHTML = '';
      corpo.appendChild(h('div', { class: 'an-base' }, 'Aparecem na comanda embaixo dos pratos: toque no prato e depois no acompanhamento (Filé de frango + Batata frita). O prato continua contando como 1 prato e o acompanhamento entra com o preço dele.'));
      const its = lista();
      if (its.length) {
        corpo.appendChild(h('div', { class: 'secao' }, 'Na comanda'));
        corpo.appendChild(h('div', { class: 'ms-lista' }, its.map((it, i) => h('div', { class: 'ms-card cd-lin ac-lin' },
          h('button', { type: 'button', class: 'ac-n', onClick: () => editarAcomp(it).then(desenhar) }, h('b', null, it.nome), h('small', null, '+ ' + P.brl(it.preco_venda) + ' · toque para mudar')),
          h('button', { type: 'button', class: 'lc-b', 'aria-label': 'Subir ' + it.nome, disabled: i === 0, onClick: () => {
            const ids = its.map(x => x.id); [ids[i - 1], ids[i]] = [ids[i], ids[i - 1]]; salvarIds(ids); desenhar();
          } }, P.UI.icone('voltar', 'cd-sobe')),
          h('button', { type: 'button', class: 'lc-b', 'aria-label': 'Tirar ' + it.nome + ' da comanda', onClick: () => {
            const antes = idsAcomp();
            salvarIds(antes.filter(id => id !== it.id));
            desenhar();
            P.UI.toast(it.nome + ' saiu dos acompanhamentos (o item continua em Outros)', { acao: { rotulo: 'Desfazer', fn: () => { salvarIds(antes); desenhar(); } } });
          } }, P.UI.icone('x'))))));
      } else corpo.appendChild(P.UI.vazio('Nenhum acompanhamento ainda. Use os sugeridos abaixo (tirados das vendas) ou crie um.', 'fichas'));
      const sug = pendentes();
      if (sug.length) {
        corpo.appendChild(h('div', { class: 'secao' }, 'Sugeridos pelas vendas'));
        corpo.appendChild(h('div', { class: 'ms-lista' }, sug.map(s => h('button', { type: 'button', class: 'ms-card ac-sug', onClick: () => {
          const it = criarAcomp(s.nome, s.preco, s.usar);
          if (!it) return;
          P.vibrar(10); desenhar();
          P.UI.toast('+ ' + it.nome + ' na comanda');
        } },
          h('div', { class: 'ms-card-n' }, s.nome, h('small', null, 'vendido como ' + s.por)),
          h('b', null, '+ ' + P.brl0(s.preco)), P.UI.icone('mais')))));
        if (sug.length > 1) corpo.appendChild(h('button', { type: 'button', class: 'btn bloco', onClick: () => {
          sug.forEach(s => criarAcomp(s.nome, s.preco, s.usar));
          P.vibrar(15); desenhar();
          P.UI.toast(sug.length + ' acompanhamentos na comanda');
        } }, P.UI.icone('check'), 'Pôr todos os sugeridos'));
      }
      corpo.appendChild(h('button', { type: 'button', class: 'btn bloco', onClick: () => editarAcomp().then(desenhar) }, P.UI.icone('mais'), 'Novo acompanhamento'));
      corpo.appendChild(h('a', { class: 'btn bloco', href: '#/cardapio/repetidos' }, 'Pratos repetidos', P.UI.icone('avancar')));
    }
    view.append(subnav('acomp'), corpo);
    desenhar();
    return { onDados(t) { if (t.has('itens') || t.has('config')) desenhar(); } };
  }

  // ---------------------------------------------------------------
  //  Nomes parecidos (criar prato na comanda)
  // ---------------------------------------------------------------
  const VAZIAS = new Set(['de', 'da', 'do', 'das', 'dos', 'com', 'c', 'e', 'a', 'o', 'as', 'os', 'ao', 'na', 'no', 'em', 'ou', 'so']);
  const PREPARO = new Set(['grelhado', 'grelhada', 'assado', 'assada', 'acebolado', 'acebolada', 'frito', 'frita']);
  const palavras = nome => P.UI.semAcento(String(nome || '').replace(/\(.*?\)/g, ' ')).replace(/[^a-z0-9]+/g, ' ').split(' ')
    .filter(w => w && !VAZIAS.has(w)).map(w => (w.length > 3 && w.endsWith('s') ? w.slice(0, -1) : w));
  // o prato que já existe dentro do nome digitado (o mais completo) e os acompanhamentos das palavras que sobram
  function parecido(nome) {
    const ws = palavras(nome);
    if (ws.length < 2) return null;
    const tem = new Set(ws);
    const acs = lista();
    const idsAc = new Set(acs.map(a => a.id));
    let base = null, nb = 0;
    P.Store.all('itens').forEach(it => {
      if (!P.Calc.vendavel(it) || idsAc.has(it.id) || P.Calc.espetoOculto(it)) return;
      const iw = [...new Set(palavras(it.nome))];
      if (!iw.length || !iw.every(w => tem.has(w))) return;
      if (iw.length > nb || (iw.length === nb && it.nome.length < base.nome.length)) { base = it; nb = iw.length; }
    });
    if (!base) return null;
    const bw = new Set(palavras(base.nome));
    const resto = ws.filter(w => !bw.has(w));
    const acomps = acs.filter(a => palavras(a.nome).some(w => resto.includes(w)));
    const usadas = new Set(acomps.flatMap(a => palavras(a.nome)));
    const sobra = resto.filter(w => !usadas.has(w) && !PREPARO.has(w));
    return { base, acomps, mesmo: !sobra.length };
  }

  // ---------------------------------------------------------------
  //  Pratos repetidos (config 'itens_juntados')
  // ---------------------------------------------------------------
  // tirados das vendas até 20/10 (conferidos com o dono em 21/10: costela = costela assada,
  // contra filé acebolado = grelhado). com: o acompanhamento que estava no nome.
  const SUG_JUNTAR = [
    { de: 'it_pf_file_frango', para: 'it_ms_file_frango' },
    { de: 'it_pf_milanesa', para: '097a62ed-1675-48d0-9fa6-8f86b2c3cd38' },
    { de: 'it_ms_costela_assada', para: 'it_ms_costela' },
    { de: 'it_ms_contra_file_acebolado', para: 'it_pf_contra_file' },
    { de: 'it_ms_adicional_7', para: 'it_ms_adicional_5' },
    { de: 'it_ms_file_frango_fritas', para: 'it_ms_file_frango', com: 'Batata frita' },
    { de: 'it_ms_file_frango_feijao', para: 'it_ms_file_frango', com: 'Feijão de corda' },
    { de: 'it_ms_file_frango_acebolado_baiao', para: 'it_ms_file_frango', com: 'Baião' },
    { de: 'it_ms_parmegiana_frango_38', para: 'it_ms_parmegiana_frango', com: 'Baião' },
    { de: 'it_ms_frango_assado_baiao', para: 'it_pf_frango_assado', com: 'Baião' },
    { de: 'it_ms_calabresa_ovo', para: 'it_ms_calabresa_acebolada', com: '2 ovos' },
    { de: 'it_ms_calabresa_baiao', para: 'it_ms_calabresa_acebolada', com: 'Baião' },
    { de: 'it_ms_costela_baiao', para: 'it_ms_costela', com: 'Baião' },
    { de: 'it_ms_contra_file_ovo', para: 'it_pf_contra_file', com: '2 ovos' },
    { de: 'it_ms_dobradinha_separada', para: 'it_ms_dobradinha', com: 'Separada' },
    { de: 'it_ms_feijoada_extra', para: 'it_ms_feijoada', com: 'Comida extra' },
    { de: 'it_ms_galinha_baiao_g', para: 'it_ms_galinha_baiao', com: 'Comida extra' },
  ];
  const SUG_CATEGORIA = [{ id: '9613da7a-3461-4e2d-b882-12a0696a64bb', categoria: 'BEBIDA', porque: 'está como Prato e conta como prato vendido no Painel' }];

  const juntados = () => P.cfg('itens_juntados').de || {};
  const temFicha = id => P.Calc.componentesDe(id).length > 0;
  const passaFicha = (deId, paraId) => temFicha(deId) && !temFicha(paraId);

  // junta "de" em "para": "de" sai das listas de venda e as vendas dele somam em "para".
  // Com ficha: copia a ficha técnica de "de" para "para" (quando "para" não tem). Devolve o registro.
  function juntar(deId, paraId, o) {
    o = o || {};
    paraId = P.Calc.principal(paraId);
    const de = P.Store.get('itens', deId), para = P.Store.get('itens', paraId);
    if (!de || !para || deId === paraId || juntados()[deId]) return null;
    const u = P.Auth.usuario();
    const reg = { para: paraId, ativo_antes: de.ativo !== false, para_ativo_antes: para.ativo !== false, comps: [], acomp: ehAcomp(deId), em: P.agoraISO(), por: u ? u.id : null };
    if (o.ficha !== false && passaFicha(deId, paraId)) {
      P.Calc.componentesDe(deId).forEach((c, i) => {
        const n = P.Store.put('componentes', { id: P.uuid(), item_id: paraId, insumo_id: c.insumo_id || null, item_componente_id: c.item_componente_id || null, gramas: +c.gramas || 0, ordem: c.ordem != null ? c.ordem : i });
        reg.comps.push(n.id);
      });
    }
    P.Store.put('itens', Object.assign({}, de, { ativo: false }));
    if (para.ativo === false) P.Store.put('itens', Object.assign({}, para, { ativo: true }));
    if (reg.acomp) salvarIds(idsAcomp().filter(id => id !== deId));
    const c = P.cfg('itens_juntados');
    P.salvarCfg('itens_juntados', Object.assign({}, c, { de: Object.assign({}, c.de, { [deId]: reg }) }));
    return reg;
  }
  // desfaz: o prato volta como estava (à venda ou não). A ficha copiada sai do que ficou só se
  // ninguém mexeu na ficha dele depois de juntar; se mexeu, fica como está (nada do que foi
  // mudado à mão some). Devolve { fichaFicou } para o aviso.
  function separar(deId) {
    const c = P.cfg('itens_juntados');
    const reg = (c.de || {})[deId];
    if (!reg) return null;
    const de = P.Store.get('itens', deId), para = P.Store.get('itens', reg.para);
    if (de) P.Store.put('itens', Object.assign({}, de, { ativo: reg.ativo_antes !== false }));
    if (para && reg.para_ativo_antes === false) P.Store.put('itens', Object.assign({}, para, { ativo: false }));
    const copiados = reg.comps || [];
    const ate = (Date.parse(reg.em) || 0) + 10000;
    const mexeu = copiados.length > 0 && (copiados.some(id => !P.Store.get('componentes', id)) ||
      P.Calc.componentesDe(reg.para).some(k => (Date.parse(k.modificado_em) || 0) > ate));
    if (!mexeu) copiados.forEach(id => { if (P.Store.get('componentes', id)) P.Store.remove('componentes', id); });
    if (reg.acomp && !ehAcomp(deId)) salvarIds(idsAcomp().concat(deId));
    const de2 = Object.assign({}, c.de);
    delete de2[deId];
    P.salvarCfg('itens_juntados', Object.assign({}, c, { de: de2 }));
    return { fichaFicou: mexeu };
  }

  // quantas vezes cada item foi vendido (contas fechadas, desde o começo)
  function vendidos() {
    const fech = new Set(P.Store.all('comandas').filter(c => c.status === 'FECHADA').map(c => c.id));
    const m = new Map();
    P.Store.all('comanda_itens').forEach(l => { if (fech.has(l.comanda_id)) m.set(l.item_id, (m.get(l.item_id) || 0) + (+l.quantidade || 0)); });
    return m;
  }
  // sugestões que ainda valem (os dois pratos existem e o de cima ainda não foi juntado)
  function sugestoes() {
    const J = juntados();
    const out = [];
    SUG_JUNTAR.forEach(s => {
      const para = P.Calc.principal(s.para);
      if (J[s.de] || para === s.de || !P.Store.get('itens', s.de) || !P.Store.get('itens', para)) return;
      out.push(Object.assign({}, s, { para }));
    });
    return out;
  }
  const catPendentes = () => SUG_CATEGORIA.filter(s => { const it = P.Store.get('itens', s.id); return it && it.categoria !== s.categoria; });
  const contar = () => sugestoes().length + catPendentes().length;

  // escolher um item (busca + lista)
  function escolherItem(titulo, sub, fora) {
    return new Promise(resolve => {
      let feito = false, termo = '';
      const its = P.Store.all('itens').filter(it => (+it.preco_venda > 0 || juntados()[it.id]) && !fora.has(it.id) && !P.Calc.espetoOculto(it))
        .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
      const corpo = h('div', { class: 'ms-lista jt-esc' });
      const busca = P.UI.campoBusca('Buscar prato', v => { termo = v; desenhar(); });
      function desenhar() {
        const ts = P.UI.semAcento(termo).split(/\s+/).filter(Boolean);
        const achou = its.filter(it => ts.every(t => P.UI.semAcento(it.nome).includes(t)));
        corpo.replaceChildren(...achou.slice(0, 60).map(it => h('button', { type: 'button', class: 'ms-card', onClick: () => { feito = true; resolve(it); sh.fechar(); } },
          h('div', { class: 'ms-card-n' }, it.nome, h('small', null, (P.Fichas ? P.Fichas.CAT[it.categoria] : it.categoria) + (it.ativo === false ? ' · fora de venda' : ''))),
          h('b', null, P.brl(it.preco_venda)))));
        if (!achou.length) corpo.appendChild(P.UI.vazio('Nada com "' + termo + '".'));
      }
      const sh = P.UI.sheet(h('div', { class: 'np-sheet' }, sub ? h('div', { class: 'np-sub' }, sub) : null, busca.el, corpo),
        { titulo, onFechar: () => { if (!feito) resolve(null); } });
      desenhar();
      setTimeout(() => busca.inp.focus(), 80);
    });
  }

  function telaRepetidos(view) {
    view.className = 'v-mesas v-cardapio';
    const corpo = h('div');
    const trocados = new Set(); // sugestões em que o dono trocou qual prato fica
    function desenhar() {
      corpo.innerHTML = '';
      const V = vendidos();
      const nV = id => { const n = V.get(id) || 0; return n + (n === 1 ? ' vendido' : ' vendidos'); };
      const info = it => P.brl(it.preco_venda) + ' · ' + nV(it.id) + (it.ativo === false ? ' · fora de venda' : '') + (temFicha(it.id) ? ' · com ficha' : '');
      corpo.appendChild(h('div', { class: 'an-base' }, 'Juntar: o prato de cima sai da comanda e do cardápio (não é apagado) e as vendas dele passam a somar no prato que fica. As vendas antigas não mudam. Dá para separar de novo em "Já juntados".'));
      const fazer = (deId, paraId, ficha) => {
        const de = P.Store.get('itens', deId);
        const reg = juntar(deId, paraId, { ficha });
        if (!reg) { P.UI.toast('Não deu para juntar.', { tipo: 'perigo' }); return; }
        P.vibrar(15); desenhar();
        P.UI.toast(de.nome + ' juntado em ' + P.Store.get('itens', reg.para).nome + (reg.comps.length ? ' (com a ficha)' : ''), { acao: { rotulo: 'Desfazer', fn: () => { separar(deId); desenhar(); } } });
      };
      const cartao = (s, podeTrocar) => {
        const k = s.de + '>' + s.para;
        const tr = podeTrocar && trocados.has(k);
        const deId = tr ? s.para : s.de, paraId = tr ? s.de : s.para;
        const de = P.Store.get('itens', deId), para = P.Store.get('itens', paraId);
        const ac = s.com ? lista().find(a => chave(a.nome) === chave(s.com)) : null;
        const ficha = passaFicha(deId, paraId);
        return h('div', { class: 'ms-card jt-card' },
          h('div', { class: 'jt-par' },
            h('div', { class: 'jt-de' }, h('small', null, 'sai'), h('b', null, de.nome), h('small', null, info(de))),
            h('div', { class: 'jt-seta' }, P.UI.icone('avancar')),
            h('div', { class: 'jt-para' }, h('small', null, 'fica'), h('b', null, para.nome + (s.com ? ' + ' + s.com : '')), h('small', null, info(para)))),
          s.com ? h('small', { class: 'jt-nota' }, ac ? 'Daqui para a frente: ' + para.nome + ' ' + P.brl(para.preco_venda) + ' + ' + ac.nome + ' ' + P.brl(ac.preco_venda) + ' = ' + P.brl(+para.preco_venda + +ac.preco_venda) + ' (antes ' + P.brl(de.preco_venda) + ').'
            : 'Crie o acompanhamento "' + s.com + '" em Acompanhamentos para lançar ' + para.nome + ' + ' + s.com + '.') : null,
          ficha ? h('small', { class: 'jt-nota' }, 'A ficha técnica de ' + de.nome + ' passa para ' + para.nome + ' (que não tem). O custo das vendas de ' + para.nome + ' sem custo gravado passa a usar essa ficha.') : null,
          h('div', { class: 'row gap' },
            podeTrocar ? h('button', { type: 'button', class: 'btn mini', onClick: () => { if (tr) trocados.delete(k); else trocados.add(k); desenhar(); } }, P.UI.icone('refresh'), 'Trocar qual fica') : null,
            h('button', { type: 'button', class: 'btn mini primario grow', onClick: () => fazer(deId, paraId, ficha) }, P.UI.icone('check'), 'Juntar')));
      };
      const sug = sugestoes();
      const mesmo = sug.filter(s => !s.com), comAc = sug.filter(s => s.com);
      if (mesmo.length) {
        corpo.appendChild(h('div', { class: 'secao' }, 'Mesmo prato'));
        corpo.appendChild(h('div', { class: 'ms-lista' }, mesmo.map(s => cartao(s, true))));
      }
      if (comAc.length) {
        corpo.appendChild(h('div', { class: 'secao' }, 'Prato + acompanhamento'));
        corpo.appendChild(h('div', { class: 'ms-lista' }, comAc.map(s => cartao(s, false))));
      }
      const cats = catPendentes();
      if (cats.length) {
        corpo.appendChild(h('div', { class: 'secao' }, 'Cadastro errado'));
        corpo.appendChild(h('div', { class: 'ms-lista' }, cats.map(s => {
          const it = P.Store.get('itens', s.id);
          const nomeCat = c => (P.Fichas ? P.Fichas.CAT[c] : c);
          return h('div', { class: 'ms-card jt-card' },
            h('div', { class: 'ms-card-n' }, it.nome, h('small', null, s.porque + ' · ' + info(it))),
            h('button', { type: 'button', class: 'btn mini primario', onClick: () => {
              const antes = it.categoria;
              P.Store.put('itens', Object.assign({}, it, { categoria: s.categoria }));
              P.vibrar(15); desenhar();
              P.UI.toast(it.nome + ' agora é ' + nomeCat(s.categoria), { acao: { rotulo: 'Desfazer', fn: () => { P.Store.put('itens', Object.assign({}, P.Store.get('itens', it.id), { categoria: antes })); desenhar(); } } });
            } }, 'Passar para ' + nomeCat(s.categoria)));
        })));
      }
      if (!sug.length && !cats.length) corpo.appendChild(P.UI.vazio('Nenhuma sugestão pendente. Para juntar outros, use o botão abaixo.', 'check'));
      corpo.appendChild(h('button', { type: 'button', class: 'btn bloco', onClick: async () => {
        const de = await escolherItem('Qual prato sai?', 'O que sai fica fora da comanda; as vendas dele somam no que fica.', new Set(Object.keys(juntados())));
        if (!de) return;
        const para = await escolherItem('Junta em qual?', de.nome + ' vai somar neste prato.', new Set(Object.keys(juntados()).concat(de.id)));
        if (!para) return;
        fazer(de.id, para.id, passaFicha(de.id, para.id));
      } }, P.UI.icone('mais'), 'Juntar outros dois pratos'));
      const J = juntados();
      const ids = Object.keys(J).filter(id => P.Store.get('itens', id)).sort((a, b) => (J[a].em < J[b].em ? 1 : -1));
      if (ids.length) {
        corpo.appendChild(h('div', { class: 'secao' }, 'Já juntados (' + ids.length + ')'));
        corpo.appendChild(h('div', { class: 'ms-lista' }, ids.map(id => {
          const it = P.Store.get('itens', id), fica = P.Store.get('itens', P.Calc.principal(id));
          return h('div', { class: 'ms-card jt-card' },
            h('div', { class: 'ms-card-n' }, it.nome, h('small', null, 'junto em ' + (fica ? fica.nome : '?') + ' · ' + nV(id) + ' · ' + P.Dia.rotuloCurto(P.Dia.diaOperacional(J[id].em)))),
            h('button', { type: 'button', class: 'btn mini', onClick: () => {
              const r = separar(id); P.vibrar(10); desenhar();
              P.UI.toast(it.nome + ' separado de novo' + (r && r.fichaFicou ? ' (a ficha de ' + (fica ? fica.nome : '?') + ' foi mudada depois e ficou como está)' : ''), { acao: { rotulo: 'Desfazer', fn: () => { juntar(id, J[id].para, { ficha: (J[id].comps || []).length > 0 }); desenhar(); } } });
            } }, 'Separar'));
        })));
      }
    }
    view.append(subnav('repetidos'), corpo);
    desenhar();
    return { onDados(t) { if (t.has('itens') || t.has('config') || t.has('componentes')) desenhar(); } };
  }

  P.UI.rota('cardapio/acompanhamentos', { titulo: 'Acompanhamentos', tab: 'mais', dono: true, render: telaAcomp });
  P.UI.rota('cardapio/repetidos', { titulo: 'Pratos repetidos', tab: 'mais', dono: true, render: telaRepetidos });
  P.Acomp = { lista, ehAcomp, criarAcomp, parecido, juntar, separar, sugestoes, contar, palavras };
})();
