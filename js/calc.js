/* Cálculo das fichas técnicas.
   custo_componente = preço_insumo × fator_correção × gramas ÷ 1000   (un: × quantidade)
   CMV              = (soma dos componentes) × (1 + perda)
   food_cost%       = CMV ÷ preço_venda
   margem R$        = preço_venda − CMV
   Item usado como componente de outro entra pelo custo SEM perda;
   a perda é aplicada uma vez só, no item vendido. */
(function () {
  'use strict';
  const P = window.P;
  const S = () => P.Store;

  const PADRAO_FICHAS = { verde_ate: 35, vermelho_acima: 40, perda_padrao: 4, dias_preco_velho: 14 };
  function cfgFichas() {
    const c = S().get('config', 'fichas');
    return Object.assign({}, PADRAO_FICHAS, c && c.valor_json);
  }

  let cache = { v: -1 };
  function idx() {
    const v = S().versao;
    if (cache.v === v) return cache;
    const comps = new Map();
    S().all('componentes').forEach(c => {
      if (!comps.has(c.item_id)) comps.set(c.item_id, []);
      comps.get(c.item_id).push(c);
    });
    comps.forEach(l => l.sort((a, b) => (a.ordem || 0) - (b.ordem || 0)));
    cache = {
      v, comps,
      insumos: new Map(S().all('insumos').map(i => [i.id, i])),
      itens: new Map(S().all('itens').map(i => [i.id, i])),
      bruto: new Map(),
      fichas: new Map(),
    };
    return cache;
  }

  const divisor = u => (u === 'un' ? 1 : 1000);
  const unidadeQtd = u => (u === 'un' ? 'un' : u === 'L' ? 'ml' : 'g');
  function custoInsumo(ins, qtd) {
    return (+ins.preco || 0) * (+ins.fator_correcao || 1) * (+qtd || 0) / divisor(ins.unidade);
  }

  // custo sem perda de uma lista de componentes
  function custoLista(lista, pilha) {
    const I = idx();
    let total = 0;
    lista.forEach(c => {
      if (c.insumo_id) {
        const ins = I.insumos.get(c.insumo_id);
        if (ins) total += custoInsumo(ins, c.gramas);
      } else if (c.item_componente_id) {
        total += custoBruto(c.item_componente_id, pilha) * (+c.gramas || 0);
      }
    });
    return total;
  }
  function custoBruto(itemId, pilha) {
    const I = idx();
    if (I.bruto.has(itemId)) return I.bruto.get(itemId);
    pilha = pilha || new Set();
    if (pilha.has(itemId)) return 0; // ciclo: ignora
    pilha.add(itemId);
    const v = custoLista(I.comps.get(itemId) || [], pilha);
    pilha.delete(itemId);
    I.bruto.set(itemId, v);
    return v;
  }

  function faixa(fc) {
    if (fc == null || !isFinite(fc)) return 'na';
    const c = cfgFichas();
    return fc <= c.verde_ate ? 'verde' : fc <= c.vermelho_acima ? 'amarelo' : 'vermelho';
  }

  function montar(item, bruto, perda, preco) {
    const cmv = bruto * (1 + (+perda || 0) / 100);
    const fc = preco > 0 ? cmv / preco * 100 : null;
    return { item, bruto, perda: +perda || 0, cmv, preco, fc, margem: preco > 0 ? preco - cmv : null, faixa: faixa(fc) };
  }

  // ficha de um item salvo
  function ficha(itemOrId) {
    const I = idx();
    const item = typeof itemOrId === 'string' ? I.itens.get(itemOrId) : itemOrId;
    if (!item) return null;
    const salvo = I.itens.get(item.id) === item;
    if (salvo && I.fichas.has(item.id)) return I.fichas.get(item.id);
    const f = montar(item, custoBruto(item.id), item.perda_pct, +item.preco_venda || 0);
    if (salvo) I.fichas.set(item.id, f);
    return f;
  }
  // ficha com alterações (simulação / edição): comps = lista de componentes, preco, perda
  function fichaCom(item, comps, preco, perda) {
    return montar(item, custoLista(comps, new Set([item.id])), perda, +preco || 0);
  }

  // linhas detalhadas para exibir
  function linhas(comps) {
    const I = idx();
    return comps.map(c => {
      if (c.insumo_id) {
        const ins = I.insumos.get(c.insumo_id);
        return {
          c, tipo: 'insumo', ref: ins, nome: ins ? ins.nome : '(insumo removido)',
          qtd: +c.gramas || 0, un: ins ? unidadeQtd(ins.unidade) : 'g',
          custo: ins ? custoInsumo(ins, c.gramas) : 0,
        };
      }
      const it = I.itens.get(c.item_componente_id);
      return {
        c, tipo: 'item', ref: it, nome: it ? it.nome : '(item removido)',
        qtd: +c.gramas || 0, un: (+c.gramas === 1 ? 'porção' : 'porções'),
        custo: it ? custoBruto(it.id) * (+c.gramas || 0) : 0,
      };
    });
  }

  // espetos contidos em 1 unidade do item (espeto = 1; combo com espeto = nº de espetos dentro)
  function espetosPorUnidade(itemId, pilha) {
    const I = idx();
    const it = I.itens.get(itemId);
    if (!it) return 0;
    if (it.categoria === 'ESPETO') return 1;
    pilha = pilha || new Set();
    if (pilha.has(itemId)) return 0;
    pilha.add(itemId);
    let n = 0;
    (I.comps.get(itemId) || []).forEach(c => {
      if (c.item_componente_id) n += espetosPorUnidade(c.item_componente_id, pilha) * (+c.gramas || 0);
    });
    pilha.delete(itemId);
    return n;
  }

  // o item `raizId` contém (direta ou indiretamente) o item `alvoId`?
  function contem(raizId, alvoId, pilha) {
    if (raizId === alvoId) return true;
    const I = idx();
    pilha = pilha || new Set();
    if (pilha.has(raizId)) return false;
    pilha.add(raizId);
    return (I.comps.get(raizId) || []).some(c => c.item_componente_id && contem(c.item_componente_id, alvoId, pilha));
  }

  function usosDoInsumo(insumoId) {
    const I = idx();
    const ids = new Set();
    I.comps.forEach((lista, itemId) => { if (lista.some(c => c.insumo_id === insumoId)) ids.add(itemId); });
    return [...ids].map(id => I.itens.get(id)).filter(Boolean);
  }
  function usosDoItem(itemId) {
    const I = idx();
    const ids = new Set();
    I.comps.forEach((lista, pai) => { if (lista.some(c => c.item_componente_id === itemId)) ids.add(pai); });
    return [...ids].map(id => I.itens.get(id)).filter(Boolean);
  }

  // Quanto de cada insumo (na unidade de compra: kg, L ou un, peso BRUTO) é gasto
  // para vender `qtd` unidades do item — pela ficha, com fator de correção e perda.
  function consumo(itemId, qtd, acc, pilha, perdaAplicada) {
    acc = acc || new Map();
    const I = idx();
    const it = I.itens.get(itemId);
    if (!it || !(qtd > 0)) return acc;
    pilha = pilha || new Set();
    if (pilha.has(itemId)) return acc;
    pilha.add(itemId);
    const mult = perdaAplicada ? qtd : qtd * (1 + (+it.perda_pct || 0) / 100);
    (I.comps.get(itemId) || []).forEach(c => {
      if (c.insumo_id) {
        const ins = I.insumos.get(c.insumo_id);
        if (!ins) return;
        const q = mult * (+c.gramas || 0) * (+ins.fator_correcao || 1) / divisor(ins.unidade);
        acc.set(ins.id, (acc.get(ins.id) || 0) + q);
      } else if (c.item_componente_id) {
        consumo(c.item_componente_id, mult * (+c.gramas || 0), acc, pilha, true);
      }
    });
    pilha.delete(itemId);
    return acc;
  }

  const vendavel = it => it && it.ativo !== false && (+it.preco_venda || 0) > 0;

  // foto do food cost de todos os itens vendáveis (para comparar antes × depois)
  function snapshot() {
    const m = new Map();
    idx().itens.forEach(it => {
      if (!vendavel(it)) return;
      const f = ficha(it);
      m.set(it.id, { nome: it.nome, fc: f.fc, faixa: f.faixa, cmv: f.cmv });
    });
    return m;
  }
  function diferencas(antes, depois) {
    const out = [];
    depois.forEach((d, id) => {
      const a = antes.get(id);
      if (!a) return;
      if (Math.abs((d.fc || 0) - (a.fc || 0)) < 0.05) return;
      out.push({ id, nome: d.nome, de: a.fc, para: d.fc, faixaDe: a.faixa, faixaPara: d.faixa, mudouFaixa: a.faixa !== d.faixa });
    });
    return out.sort((x, y) => Math.abs(y.para - y.de) - Math.abs(x.para - x.de));
  }

  // O que é preciso para chegar a um food cost alvo: pelo preço ou pela porção do principal
  function paraAlvo(item, comps, preco, perda, alvo) {
    alvo = alvo || cfgFichas().verde_ate;
    const f = fichaCom(item, comps, preco, perda);
    const precoAlvo = f.cmv / (alvo / 100);
    const L = linhas(comps).filter(l => l.tipo === 'insumo' && l.ref);
    let porcao = null;
    if (L.length && preco > 0) {
      const princ = L.reduce((a, b) => (b.custo > a.custo ? b : a));
      const brutoAlvo = (alvo / 100) * preco / (1 + (+perda || 0) / 100);
      const resto = f.bruto - princ.custo;
      const custoUnit = custoInsumo(princ.ref, 1);
      const qtd = custoUnit > 0 ? (brutoAlvo - resto) / custoUnit : null;
      porcao = { linha: princ, qtd: qtd != null && qtd > 0 ? qtd : null };
    }
    return { alvo, precoAlvo, porcao, ja: f.fc != null && f.fc <= alvo };
  }

  P.Calc = {
    cfgFichas, idx, custoInsumo, custoBruto, custoLista, ficha, fichaCom, linhas, faixa,
    espetosPorUnidade, contem, usosDoInsumo, usosDoItem, vendavel, snapshot, diferencas, paraAlvo, consumo,
    unidadeQtd, divisor,
    componentesDe: itemId => (idx().comps.get(itemId) || []).slice(),
    precoVelho: ins => P.Dia.diasDesde(ins.atualizado_em) > cfgFichas().dias_preco_velho,
  };
})();
