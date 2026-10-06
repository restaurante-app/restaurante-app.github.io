/* Dados iniciais reais (carregados uma única vez, no primeiro uso).
   IDs fixos: dois celulares que começam offline não duplicam nada.
   Data de modificação antiga: qualquer edição real vence o seed. */
(function () {
  'use strict';
  const P = window.P;
  const SEED_TS = '2026-01-01T00:00:00.000Z';

  // [id, nome, unidade, preço, fator de correção]
  const INSUMOS = [
    ['peito_frango', 'Peito de frango', 'kg', 21.00, 1.10],
    ['coxa_sobrecoxa_des', 'Coxa e sobrecoxa desossada', 'kg', 17.00, 1.05],
    ['coracao', 'Coração de frango', 'kg', 22.00, 1.08],
    ['coxao_duro', 'Coxão duro', 'kg', 33.00, 1.20],
    ['acem', 'Acém', 'kg', 29.00, 1.18],
    ['contra_file', 'Contra filé', 'kg', 52.00, 1.15],
    ['bisteca', 'Bisteca suína', 'kg', 22.00, 1.08],
    ['linguica_toscana', 'Linguiça toscana', 'kg', 19.00, 1.02],
    ['calabresa', 'Calabresa', 'kg', 22.00, 1.02],
    ['queijo_coalho', 'Queijo coalho', 'kg', 42.00, 1.00],
    ['mussarela', 'Mussarela', 'kg', 38.00, 1.00],
    ['bacon', 'Bacon', 'kg', 26.00, 1.00],
    ['arroz', 'Arroz', 'kg', 5.50, 1.00],
    ['feijao', 'Feijão', 'kg', 9.00, 1.00],
    ['feijao_fradinho', 'Feijão fradinho', 'kg', 12.00, 1.00],
    ['farinha_mandioca', 'Farinha de mandioca', 'kg', 8.00, 1.00],
    ['batata', 'Batata', 'kg', 4.50, 1.25],
    ['macarrao', 'Macarrão', 'kg', 6.00, 1.00],
    ['oleo', 'Óleo', 'kg', 8.50, 1.00],
    ['pao_frances', 'Pão francês', 'kg', 14.00, 1.00],
    ['maionese', 'Maionese', 'kg', 12.00, 1.00],
    ['molho_tomate', 'Molho de tomate', 'kg', 8.00, 1.00],
    ['cebola', 'Cebola', 'kg', 5.00, 1.15],
    ['tomate', 'Tomate', 'kg', 7.00, 1.15],
    ['alface', 'Alface', 'kg', 6.00, 1.35],
    ['cenoura', 'Cenoura', 'kg', 5.00, 1.25],
    ['repolho', 'Repolho', 'kg', 3.50, 1.20],
    ['alho', 'Alho', 'kg', 25.00, 1.30],
    ['laranja', 'Laranja', 'kg', 3.50, 1.80],
    ['ovo', 'Ovo', 'un', 0.70, 1.00],
    // inferidos para bater o CMV esperado das fichas (conferir e ajustar)
    ['tempero', 'Tempero, sal e gás/carvão (estimado)', 'un', 0.20, 1.00],
    ['palito', 'Palito de espeto (estimado)', 'un', 0.053, 1.00],
    // bebidas (custo informado)
    ['cafe_dose', 'Café — dose com açúcar e copo', 'un', 0.37, 1.00],
    ['agua_500', 'Água 500 ml', 'un', 1.00, 1.00],
    ['refri_lata', 'Refrigerante lata', 'un', 3.00, 1.00],
    ['cerveja_lata', 'Cerveja lata', 'un', 3.20, 1.00],
    ['long_neck', 'Long neck', 'un', 6.00, 1.00],
  ];

  // Componente: 'i:<insumo>' ou 't:<item>' (item pronto, quantidade em porções)
  const ACOMP = [['t:acomp_espeto', 1], ['i:tempero', 1], ['i:palito', 1]];
  const PF = [['t:base_pf', 1], ['t:guarnicao', 1]];

  // [id, nome, categoria, preço de venda, perda %, componentes]
  const ITENS = [
    // Componentes (sem preço de venda — entram dentro de outros itens)
    ['acomp_espeto', 'Acompanhamento do espeto (farofa, vinagrete, molhos)', 'GUARNICAO', 0, 0,
      [['i:farinha_mandioca', 22], ['i:tomate', 20], ['i:cebola', 12], ['i:maionese', 8], ['i:oleo', 1]]],
    ['base_pf', 'Base do prato feito', 'GUARNICAO', 0, 0,
      [['i:arroz', 150], ['i:feijao', 90], ['i:farinha_mandioca', 35], ['i:oleo', 16], ['i:alface', 30],
        ['i:tomate', 35], ['i:cenoura', 15], ['i:repolho', 25], ['i:cebola', 12], ['i:alho', 3], ['i:tempero', 1]]],
    ['guarnicao', 'Guarnição do dia (média)', 'GUARNICAO', 0, 0,
      [['i:batata', 150], ['i:oleo', 9]]],

    // Espetos
    ['esp_linguica', 'Espeto de linguiça', 'ESPETO', 8, 4, [['i:linguica_toscana', 90]].concat(ACOMP)],
    ['esp_frango', 'Espeto de frango', 'ESPETO', 8, 4, [['i:peito_frango', 90]].concat(ACOMP)],
    ['esp_frango_bacon', 'Espeto de frango com bacon', 'ESPETO', 9, 4, [['i:peito_frango', 70], ['i:bacon', 20]].concat(ACOMP)],
    ['esp_coracao', 'Espeto de coração', 'ESPETO', 9, 4, [['i:coracao', 90]].concat(ACOMP)],
    ['esp_queijo', 'Espeto de queijo coalho', 'ESPETO', 11, 4, [['i:queijo_coalho', 80]].concat(ACOMP)],
    ['esp_carne', 'Espeto de carne', 'ESPETO', 12, 4, [['i:coxao_duro', 90]].concat(ACOMP)],
    ['esp_pao', 'Espeto no pão', 'ESPETO', 9, 4, [['i:peito_frango', 90], ['i:pao_frances', 50], ['i:maionese', 20]].concat(ACOMP)],

    // Turno do espeto — pratos
    ['baiao', 'Baião de dois', 'PRATO', 12, 4,
      [['i:arroz', 100], ['i:feijao_fradinho', 60], ['i:calabresa', 30], ['i:queijo_coalho', 25], ['i:bacon', 15], ['i:cebola', 12], ['i:tempero', 1]]],
    ['baiao_espeto', 'Baião + espeto de frango', 'PRATO', 18, 4, [['t:baiao', 1], ['t:esp_frango', 1]]],

    // Pratos feitos (proteína + base + guarnição)
    ['pf_file_frango', 'Filé de frango grelhado', 'PRATO', 23, 4, [['i:peito_frango', 180]].concat(PF)],
    ['pf_linguica', 'Linguiça toscana acebolada', 'PRATO', 25, 4, [['i:linguica_toscana', 210], ['i:cebola', 40]].concat(PF)],
    ['pf_frango_assado', 'Frango assado', 'PRATO', 26, 4, [['i:coxa_sobrecoxa_des', 260]].concat(PF)],
    ['pf_bisteca', 'Bisteca suína grelhada', 'PRATO', 26, 4, [['i:bisteca', 205]].concat(PF)],
    ['pf_passarinho', 'Frango à passarinho', 'PRATO', 27, 4, [['i:coxa_sobrecoxa_des', 240], ['i:oleo', 35], ['i:alho', 1]].concat(PF)],
    ['pf_milanesa', 'Milanesa de frango', 'PRATO', 30, 4,
      [['i:peito_frango', 180], ['i:ovo', 1], ['i:farinha_mandioca', 25], ['i:oleo', 30]].concat(PF)],
    ['pf_bife', 'Bife acebolado', 'PRATO', 30, 4, [['i:coxao_duro', 160], ['i:cebola', 45]].concat(PF)],
    ['pf_picadinho', 'Picadinho', 'PRATO', 30, 4,
      [['i:coxao_duro', 165], ['i:molho_tomate', 30], ['i:cebola', 20], ['i:alho', 1]].concat(PF)],
    ['pf_carne_panela', 'Carne de panela', 'PRATO', 32, 4,
      [['i:acem', 200], ['i:cebola', 20], ['i:molho_tomate', 20], ['i:alho', 2]].concat(PF)],
    ['pf_contra_file', 'Contra filé grelhado', 'PRATO', 40, 4, [['i:contra_file', 175], ['i:alho', 3], ['i:oleo', 9]].concat(PF)],
    ['pf_parmegiana', 'Parmegiana de contra filé', 'PRATO', 45, 4,
      [['i:contra_file', 175], ['i:mussarela', 50], ['i:ovo', 1], ['i:farinha_mandioca', 25], ['i:oleo', 30], ['i:molho_tomate', 90]].concat(PF)],

    // Bebidas
    ['beb_cafe', 'Cafezinho', 'BEBIDA', 2, 0, [['i:cafe_dose', 1]]],
    ['beb_agua', 'Água 500 ml', 'BEBIDA', 3, 0, [['i:agua_500', 1]]],
    ['beb_suco', 'Suco natural 300 ml', 'BEBIDA', 6, 0, [['i:laranja', 214]]],
    ['beb_refri', 'Refrigerante lata', 'BEBIDA', 6, 0, [['i:refri_lata', 1]]],
    ['beb_cerveja', 'Cerveja lata', 'BEBIDA', 6, 0, [['i:cerveja_lata', 1]]],
    ['beb_longneck', 'Long neck', 'BEBIDA', 11, 0, [['i:long_neck', 1]]],
  ];

  // CMV esperado informado no documento (para conferência)
  const ESPERADO = {
    esp_linguica: 2.61, esp_frango: 2.96, esp_frango_bacon: 3.00, esp_coracao: 3.02, esp_queijo: 4.29,
    esp_carne: 4.50, esp_pao: 3.93, baiao: 3.80, baiao_espeto: 6.75,
    acomp_espeto: 0.51, base_pf: 3.14, guarnicao: 0.92,
    pf_file_frango: 8.55, pf_linguica: 8.70, pf_frango_assado: 9.05, pf_bisteca: 9.29, pf_passarinho: 9.02,
    pf_milanesa: 9.75, pf_bife: 11.08, pf_picadinho: 11.42, pf_carne_panela: 11.70, pf_contra_file: 15.29,
    pf_parmegiana: 19.03,
    beb_cafe: 0.37, beb_agua: 1.00, beb_suco: 1.35, beb_refri: 3.00, beb_cerveja: 3.20, beb_longneck: 6.00,
  };

  const CONFIG = {
    custos_fixos: { aluguel: 5000, folha: 14129, prolabore_inss: 6660, outros: 4230 },
    operacao: { dias_mes: 26, abertura: null }, // abertura: dia em que o restaurante abriu (antes disso = montagem)
    metas: {
      espeto_empate_dia: 22,
      anexacao_espeto: 80, anexacao_salao: 75, anexacao_marmita: 60,
      food_cost_max: 38, perda_espeto_max: 3, prime_cost_max: 58,
      lucro_mensal: 10000,
    },
    escada_espetos: {
      degraus: [
        { espetos: 22, lucro: 0 }, { espetos: 45, lucro: 5000 }, { espetos: 80, lucro: 10000 },
        { espetos: 105, lucro: 15000 }, { espetos: 140, lucro: 20000 },
      ],
    },
    fichas: { verde_ate: 35, vermelho_acima: 40, perda_padrao: 4, dias_preco_velho: 14 },
    turnos: { espeto_ini: 3, espeto_fim: 10, almoco_ini: 11, almoco_fim: 16 },
    mesas: { quantidade: 12 },
    cartao: { nome: null, vencimento_dia: 1 }, // cartão de crédito das compras: fatura vence todo dia X
    // cardápio de cada dia da semana: { '1': [ids dos pratos de segunda], …, '6': sábado }; dia sem lista = todos os pratos
    cardapio_semana: { dias: {} },
  };
  // valor de configuração (o salvo no banco por cima do padrão)
  P.cfg = chave => {
    const c = P.Store.get('config', chave);
    return Object.assign({}, CONFIG[chave], c && c.valor_json);
  };
  P.salvarCfg = (chave, valor) => P.Store.put('config', { chave, valor_json: valor });

  // Pratos do Restaurante Maria Simone (lista do dono, 03/10/2026) — [id, nome, preço]
  // Entram uma vez em cada aparelho; prato com o mesmo nome não é duplicado e o preço
  // dele só muda se o dono confirmar (folha "Cardápio Maria Simone").
  const CARDAPIO_TS = '2026-10-03T00:00:00.000Z'; // dia da lista do dono
  const CARDAPIO_SIMONE = [
    ['ms_rabada', 'Rabada', 35], ['ms_costelinha', 'Costelinha', 35], ['ms_contra_file_ovo', 'Contra filé com ovo', 40],
    ['ms_bife_panela', 'Bife de panela', 35], ['ms_panqueca_frango_1', 'Panqueca de frango (1 no prato)', 25],
    ['ms_panqueca_frango_2', 'Panqueca de frango (2 no prato)', 30], ['ms_file_frango', 'Filé de frango', 25],
    ['ms_costela', 'Costela', 35], ['ms_file_tilapia', 'Filé de tilápia', 40], ['ms_posta_tilapia', 'Posta de tilápia', 35],
    ['ms_bacalhau', 'Bacalhau', 40], ['ms_picadinho', 'Picadinho', 30], ['ms_contra_file_acebolado', 'Contra filé acebolado', 40],
    ['ms_porcao_calabresa', 'Porção de calabresa', 25], ['ms_porcao_peixe_peq', 'Porção de peixe pequena', 30],
  ];
  const chaveNome = n => P.UI.semAcento(String(n || '')).replace(/\s+/g, ' ').replace(/\(\s+/g, '(').replace(/\s+\)/g, ')').trim();
  function cardapioSimone() {
    const S = P.Store;
    if (S.meta('cardapio_simone_v1')) return;
    const porNome = new Map(S.all('itens').map(it => [chaveNome(it.nome), it]));
    const rel = { novos: [], iguais: [], diferentes: [] };
    CARDAPIO_SIMONE.forEach(([id, nome, preco]) => {
      const ja = porNome.get(chaveNome(nome)) || S.get('itens', 'it_' + id);
      if (!ja) {
        // data antiga de propósito: num aparelho novo, nunca passa por cima do prato já editado na nuvem
        S.put('itens', { id: 'it_' + id, nome, categoria: 'PRATO', preco_venda: preco, perda_pct: CONFIG.fichas.perda_padrao, ativo: true, modificado_em: CARDAPIO_TS }, { stamp: false });
        rel.novos.push({ id: 'it_' + id, nome, preco });
      } else if (P.round(+ja.preco_venda || 0, 2) === preco) rel.iguais.push({ id: ja.id, nome: ja.nome, preco });
      else rel.diferentes.push({ id: ja.id, nome: ja.nome, atual: +ja.preco_venda || 0, preco });
    });
    S.setMeta('cardapio_simone_v1', rel);
    S.setMeta('cardapio_simone_ver', true);
  }
  // Folha para o dono: o que entrou, o que já existia e os preços diferentes (só muda se confirmar)
  function mostrarCardapioSimone() {
    const S = P.Store;
    const rel = S.meta('cardapio_simone_v1');
    if (!S.meta('cardapio_simone_ver') || !rel || !P.Auth.isDono()) return;
    S.setMeta('cardapio_simone_ver', false);
    const h = P.UI.h;
    const linha = (nome, dir, cls) => h('div', { class: 'cs-linha' + (cls ? ' ' + cls : '') }, h('span', null, nome), h('b', null, dir));
    const difs = rel.diferentes.map(d => {
      const el = h('div', { class: 'cs-dif' });
      const desenhar = feito => el.replaceChildren(
        linha(d.nome, feito || ('no app ' + P.brl(d.atual) + ' · na lista ' + P.brl(d.preco))),
        feito ? null : h('div', { class: 'row gap' },
          h('button', { type: 'button', class: 'btn', onClick: () => desenhar('mantido ' + P.brl(d.atual)) }, 'Manter ' + P.brl(d.atual)),
          h('button', { type: 'button', class: 'btn primario grow', onClick: () => {
            const it = S.get('itens', d.id);
            if (it) S.put('itens', Object.assign({}, it, { preco_venda: d.preco }));
            desenhar('alterado para ' + P.brl(d.preco));
          } }, 'Usar ' + P.brl(d.preco))));
      desenhar();
      return el;
    });
    P.UI.sheet(h('div', { class: 'np-sheet cs-sheet' },
      h('div', { class: 'secao' }, 'Cadastrados · ' + rel.novos.length),
      rel.novos.length ? rel.novos.map(n => linha(n.nome, P.brl(n.preco))) : h('small', null, 'Nenhum: todos já existiam.'),
      rel.novos.length ? h('small', { class: 'campo-d' }, 'Entraram sem ficha técnica (custo R$ 0). Monte a ficha em Fichas → Cadastro para ver a margem certa.') : null,
      rel.iguais.length ? [h('div', { class: 'secao' }, 'Já existiam com o mesmo preço · ' + rel.iguais.length), rel.iguais.map(n => linha(n.nome, P.brl(n.preco)))] : null,
      rel.diferentes.length ? [h('div', { class: 'secao' }, 'Já existiam com preço diferente · ' + rel.diferentes.length), h('small', { class: 'campo-d' }, 'Nada foi alterado. Escolha qual preço fica:'), difs] : null),
    { titulo: 'Cardápio Maria Simone' });
  }

  function aplicar() {
    const novo = aplicarBase();
    cardapioSimone();
    return novo;
  }
  function aplicarBase() {
    const S = P.Store;
    const op = { stamp: false, silent: true };
    Object.keys(CONFIG).forEach(ch => {
      if (!S.get('config', ch)) S.put('config', { chave: ch, valor_json: CONFIG[ch], modificado_em: SEED_TS }, op);
    });
    if (S.meta('seed_v1') || S.all('insumos').length || S.all('itens').length) {
      if (!S.meta('seed_v1')) S.setMeta('seed_v1', true);
      return false;
    }
    const agora = P.agoraISO();
    INSUMOS.forEach(([id, nome, unidade, preco, fator]) => {
      S.put('insumos', { id: 'ins_' + id, nome, unidade, preco, fator_correcao: fator, atualizado_em: agora, modificado_em: SEED_TS }, op);
      S.put('historico_precos', { id: 'hp_seed_' + id, insumo_id: 'ins_' + id, preco, data: agora, modificado_em: SEED_TS }, op);
    });
    ITENS.forEach(([id, nome, categoria, preco, perda, comps]) => {
      S.put('itens', { id: 'it_' + id, nome, categoria, preco_venda: preco, perda_pct: perda, ativo: true, modificado_em: SEED_TS }, op);
      comps.forEach(([ref, qtd], n) => {
        const [tipo, rid] = ref.split(':');
        S.put('componentes', {
          id: 'cp_' + id + '_' + n, item_id: 'it_' + id,
          insumo_id: tipo === 'i' ? 'ins_' + rid : null,
          item_componente_id: tipo === 't' ? 'it_' + rid : null,
          gramas: qtd, ordem: n, modificado_em: SEED_TS,
        }, op);
      });
    });
    S.setMeta('seed_v1', true);
    P.emit('dados', new Set(S.TABLES));
    return true;
  }

  // Conferência: CMV calculado × esperado
  function conferir() {
    return Object.keys(ESPERADO).map(id => {
      const f = P.Calc.ficha('it_' + id);
      const calc = f ? (f.preco > 0 ? f.cmv : f.bruto) : null;
      return { id, nome: f && f.item.nome, esperado: ESPERADO[id], calculado: calc == null ? null : P.round(calc, 2), dif: calc == null ? null : P.round(calc - ESPERADO[id], 2) };
    });
  }

  P.Seed = { aplicar, conferir, mostrarCardapioSimone, CONFIG, ESPERADO, CARDAPIO_SIMONE };
})();
