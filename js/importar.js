/* IMPORTAR LANÇAMENTOS (dono) — pacote com o que aconteceu fora do app
   (relatório, caderno): compras, vendas por cliente, despesas, equipe,
   cardápio e pendências. Antes de lançar, CONFERE:
   - o que já está no app (mesmo id = já importado; mesmo dia + mesmo valor =
     parecido, fica de fora a não ser que você marque);
   - se cada compra soma o total e se cada venda bate com o que foi pago.
   Lança pelos mesmos caminhos do app (a compra atualiza o preço dos insumos;
   a venda entra como conta fechada "lançada depois", sem horário).
   Ids fixos: importar duas vezes (ou em dois aparelhos) não duplica.
   Também: botijões do gás, cardápio de cada dia, contas a prazo pagas depois, pendências antigas que o pacote
   resolve, correções em registros já lançados (fornecedor, dia do botijão…) e separar linhas de uma compra.
   "Desfazer" apaga o que esta importação criou e volta o que ela mudou. */
(function () {
  'use strict';
  const P = window.P;
  const h = P.UI.h;
  const S = () => P.Store;

  let pacote = null;      // o que foi aberto (arquivo ou backup)
  let escolhas = {};      // chave do registro parecido → true (importar mesmo assim)
  let opcoes = {};        // seções opcionais (limpeza, desativar) → true/false
  let resultado = null;   // depois de lançar

  const semAc = s => P.UI.semAcento(String(s || '')).replace(/\s+/g, ' ').trim();
  const cents = v => Math.round((+v || 0) * 100);
  const idDe = (pk, ref) => 'imp-' + pk.id + '-' + ref;
  const meioDia = (dia, seg) => { const [y, m, d] = dia.split('-').map(Number); return new Date(y, m - 1, d, 12, 0, seg || 0).toISOString(); };
  function diaDe(iso) { // data do relatório → dia operacional (domingo conta como segunda)
    return P.Dia.parse(iso).getDay() === 0 ? P.Dia.somaDias(iso, 1) : iso;
  }

  // ---------------------------------------------------------------
  //  Leitura e conferência (nada é gravado aqui)
  // ---------------------------------------------------------------
  function validar(pk) {
    if (!pk || pk.app !== 'pari-restaurante' || pk.tipo !== 'lancamentos') throw new Error('Este arquivo não é um pacote de lançamentos do app.');
    if (!pk.id || !/^[a-z0-9-]{2,24}$/i.test(pk.id)) throw new Error('Pacote sem identificação.');
    ['insumos', 'itens', 'desativar', 'pessoas', 'compras', 'vendas', 'despesas', 'anotacoes', 'limpeza', 'botijoes', 'resolver', 'pagarCompras', 'corrigir', 'moverItens'].forEach(k => { pk[k] = Array.isArray(pk[k]) ? pk[k] : []; });
    // cardápio de dias da semana: { '1': [ids], '2': [ids] } — troca só os dias que vierem
    pk.cardapio = pk.cardapio && typeof pk.cardapio === 'object' && !Array.isArray(pk.cardapio) ? pk.cardapio : {};
    return pk;
  }
  // item/insumo/pessoa do pacote → o que já existe no app (pelo id ou pelo nome)
  function mapear(tabela, lista) {
    const porNome = new Map(S().all(tabela).map(r => [semAc(r.nome), r]));
    const m = new Map();
    lista.forEach(x => {
      const porId = S().get(tabela, x.id);
      const igual = porId || (x.nome ? porNome.get(semAc(x.nome)) : null);
      m.set(x.id, igual ? igual.id : x.id);
    });
    return m;
  }
  // referência a registro: '@d13' = o registro d13 deste pacote; sem @ = id do app (ex.: de um pacote anterior)
  const refId = (pk, r) => (r ? (String(r).startsWith('@') ? idDe(pk, String(r).slice(1)) : String(r)) : null);
  // o que um pacote pode corrigir em registros já lançados (o resto se corrige no app)
  const valCorr = v => (v == null || v === '' ? '—' : /^\d{4}-\d{2}-\d{2}$/.test(String(v)) ? P.Dia.rotulo(v) : String(v));
  const PODE_CORRIGIR = { compras: ['fornecedor', 'obs'], botijoes: ['inicio', 'fim', 'tamanho', 'valor', 'obs'], comandas: ['cliente', 'obs'], despesas: ['descricao'] };
  const NOME_CFG = { cardapio_semana: 'Cardápio de cada dia da semana', operacao: 'Operação (abertura, dias por mês)', cartao: 'Cartão de crédito' };
  function conferir(pk) {
    const c = { problemas: [], cadastro: [], compras: [], vendas: [], despesas: [], anotacoes: [], limpeza: [], desativar: [], botijoes: [], resolver: [], pagar: [], corrigir: [], mover: [], porDia: new Map() };
    const mapaIns = mapear('insumos', pk.insumos);
    const mapaItem = mapear('itens', pk.itens.filter(x => x.nome));
    const mapaPes = mapear('pessoas', pk.pessoas);
    c.mapaIns = mapaIns; c.mapaItem = mapaItem; c.mapaPes = mapaPes;
    const itemId = id => mapaItem.get(id) || id;
    const dia = d => c.porDia.get(d) || (c.porDia.set(d, { vendas: 0, nVendas: 0, compras: 0, nCompras: 0, despesas: 0 }), c.porDia.get(d));

    // cadastro
    pk.insumos.forEach(x => {
      const ja = S().get('insumos', mapaIns.get(x.id));
      c.cadastro.push({ tipo: 'insumo', x, status: ja ? 'ja' : 'novo', texto: 'Insumo ' + x.nome + ' (' + x.unidade + ')' + (ja && ja.id !== x.id ? ' — já existe como "' + ja.nome + '"' : '') });
    });
    pk.itens.forEach(x => {
      const ja = S().get('itens', itemId(x.id));
      if (!ja && !x.nome) { c.problemas.push('Item ' + x.id + ' para atualizar não existe no app.'); return; }
      if (!ja) { c.cadastro.push({ tipo: 'item', x, status: 'novo', texto: 'Novo no cardápio: ' + x.nome + ' · ' + P.brl(x.preco_venda) + (x.componentes && x.componentes.length ? ' (com ficha)' : '') + (x.ativo === false ? ' (inativo)' : '') }); return; }
      const muda = [];
      if (x.ativo === true && ja.ativo === false) muda.push('volta ao cardápio (estava desativado)');
      if (x.preco_venda != null && cents(x.preco_venda) !== cents(ja.preco_venda)) muda.push('preço ' + P.brl(ja.preco_venda) + ' → ' + P.brl(x.preco_venda));
      if (x.componentes && x.componentes.length && !P.Calc.componentesDe(ja.id).length) muda.push('ganha ficha (' + x.componentes.length + ' componente' + (x.componentes.length > 1 ? 's' : '') + ')');
      c.cadastro.push({ tipo: 'item', x, status: muda.length ? 'muda' : 'ja', texto: ja.nome + (muda.length ? ': ' + muda.join(' · ') : ' — já está igual') });
    });
    pk.pessoas.forEach(x => {
      const ja = S().get('pessoas', mapaPes.get(x.id));
      c.cadastro.push({ tipo: 'pessoa', x, status: ja ? 'ja' : 'novo', texto: 'Equipe: ' + x.nome + ' · ' + (P.Equipe.NOME_COMO[x.pagamento] || x.pagamento) + (+x.valor ? ' ' + P.brl(x.valor) : '') });
    });
    pk.desativar.forEach(x => {
      const it = S().get('itens', x.id);
      if (it && it.ativo !== false) c.desativar.push({ x, it, texto: it.nome + ' · ' + P.brl(it.preco_venda) });
    });
    Object.keys(pk.config || {}).forEach(ch => {
      const v = pk.config[ch];
      const dias = ch === 'cardapio_semana' && v && v.dias ? Object.keys(v.dias).sort().map(d => P.Cardapio.NOME[d] + ' (' + v.dias[d].length + ')').join(', ') : '';
      const atual = P.cfg(ch);
      const igual = JSON.stringify(Object.assign({}, atual, v)) === JSON.stringify(atual);
      c.cadastro.push({ tipo: 'config', status: igual ? 'ja' : 'muda', texto: (NOME_CFG[ch] || 'Ajuste ' + ch) + (dias ? ': ' + dias : '') });
    });
    // gás: botijões (a despesa da compra pode ser deste pacote, '@d01', ou de um anterior)
    pk.botijoes.forEach(x => {
      const id = idDe(pk, x.ref);
      const desp = refId(pk, x.despesa);
      const despOk = !desp || S().get('despesas', desp) || (String(x.despesa).startsWith('@') && pk.despesas.some(d => idDe(pk, d.ref) === desp));
      const ja = S().get('botijoes', id) || S().all('botijoes').find(b => b.inicio === x.inicio);
      const it = { x, id, despesa: despOk ? desp : null, status: ja ? 'ja' : 'novo' };
      c.botijoes.push(it);
      c.cadastro.push({ tipo: 'gas', status: it.status, texto: 'Gás: botijão ' + P.Gas.nomeTam(x.tamanho) + ' ligado ' + P.Dia.rotulo(x.inicio) + (x.fim ? ', acabou ' + P.Dia.rotulo(x.fim) : ', em uso') + (+x.valor ? ' · ' + P.brl(x.valor) : '') +
        (desp && !despOk ? ' (a despesa ' + desp + ' não está no app: fica sem ligar)' : '') });
    });
    // cardápio de cada dia (os pratos podem ser deste pacote)
    c.cardapio = [];
    Object.keys(pk.cardapio).sort().forEach(sem => {
      const ids = (Array.isArray(pk.cardapio[sem]) ? pk.cardapio[sem] : []).map(itemId);
      if (!P.Cardapio.NOME[sem]) { c.problemas.push('Cardápio: dia da semana ' + sem + ' não existe (1 = segunda … 6 = sábado).'); return; }
      ids.forEach(id => { if (!S().get('itens', id) && !pk.itens.some(i => i.id === id)) c.problemas.push('Cardápio de ' + P.Cardapio.NOME[sem] + ': prato ' + id + ' não existe.'); });
      const igual = JSON.stringify(P.Cardapio.lista(sem)) === JSON.stringify(ids);
      c.cardapio.push({ sem, ids, status: igual ? 'ja' : 'muda' });
      c.cadastro.push({ tipo: 'cardapio', status: igual ? 'ja' : 'muda', texto: 'Cardápio de ' + P.Cardapio.NOME[sem] + ': ' + ids.length + ' pratos' + (igual ? ' — já está igual' : '') });
    });
    // contas a prazo pagas depois (compra deste pacote, '@c01', ou de um anterior)
    pk.pagarCompras.forEach(x => {
      const cp = S().get('compras', refId(pk, x.compra));
      if (!cp) { c.cadastro.push({ tipo: 'pagar', status: 'ja', texto: 'Pagar a compra ' + x.compra + ': não está no app (fica de fora).' }); return; }
      const aberto = P.Compras.valorAberto(cp);
      const it = { x, compra: cp, status: aberto > 0 ? 'muda' : 'ja' };
      c.pagar.push(it);
      c.cadastro.push({ tipo: 'pagar', status: it.status, texto: 'Pagar ' + (cp.fornecedor || 'compra') + ' (compra de ' + P.Dia.rotuloCurto(cp.dia_operacional) + '): ' +
        (aberto > 0 ? P.brl(aberto) + ' em ' + P.Dia.rotulo(diaDe(x.dia)) + ' · ' + (P.Compras.NOME_FORMA[x.forma || 'DINHEIRO'] || x.forma) : 'já está paga') });
    });
    // correções em registros que já estão no app (só estes campos)
    pk.corrigir.forEach(x => {
      const campos = PODE_CORRIGIR[x.tabela];
      if (!campos) { c.problemas.push('Correção: ' + x.tabela + ' não pode ser corrigida por pacote.'); return; }
      const fora = Object.keys(x.campos || {}).filter(k => !campos.includes(k));
      if (fora.length) { c.problemas.push('Correção de ' + x.tabela + ': o campo ' + fora.join(', ') + ' não pode ser corrigido por pacote.'); return; }
      const r = S().get(x.tabela, refId(pk, x.id));
      const rot = x.rotulo || x.tabela + ' ' + x.id;
      if (!r) { c.cadastro.push({ tipo: 'corrigir', status: 'ja', texto: 'Corrigir ' + rot + ': não está no app (fica de fora).' }); return; }
      const muda = Object.keys(x.campos).filter(k => String(r[k] == null ? '' : r[k]) !== String(x.campos[k] == null ? '' : x.campos[k]));
      const it = { x, r, status: muda.length ? 'muda' : 'ja' };
      c.corrigir.push(it);
      const mostra = muda.filter(k => k !== 'obs');
      c.cadastro.push({ tipo: 'corrigir', status: it.status, texto: 'Corrigir ' + rot + ': ' + (!muda.length ? 'já está certo'
        : mostra.length ? mostra.map(k => valCorr(r[k]) + ' → ' + valCorr(x.campos[k])).join(' · ') : 'observação') });
    });
    // separar linhas de uma compra numa compra nova (ex.: nota que era de outro fornecedor)
    pk.moverItens.forEach(x => {
      const id = idDe(pk, x.ref);
      const de = S().get('compras', refId(pk, x.de));
      const rot = (x.itens || []).length + ' itens para ' + x.fornecedor;
      if (S().get('compras', id)) { c.cadastro.push({ tipo: 'mover', status: 'ja', texto: 'Separar ' + rot + ' — já separado' }); return; }
      if (!de) { c.cadastro.push({ tipo: 'mover', status: 'ja', texto: 'Separar ' + rot + ': a compra ' + x.de + ' não está no app (fica de fora).' }); return; }
      const linhas = (x.itens || []).map(i => S().get('compra_itens', refId(pk, i))).filter(l => l && l.compra_id === de.id);
      if (!linhas.length || linhas.length !== (x.itens || []).length) { c.problemas.push('Separar compra: itens não encontrados na compra de ' + (de.fornecedor || '') + ' de ' + P.Dia.rotuloCurto(de.dia_operacional) + '.'); return; }
      if (P.Compras.partes(de).length !== 1 || P.Compras.valorAberto(de) > 0) { c.problemas.push('Separar compra: só compra paga de uma vez (' + (de.fornecedor || '') + ').'); return; }
      const total = P.round(linhas.reduce((s, l) => s + (+l.valor || 0), 0), 2);
      c.mover.push({ x, id, de, linhas, total });
      c.cadastro.push({ tipo: 'mover', status: 'muda', texto: 'Separar da compra ' + (de.fornecedor || '') + ' de ' + P.Dia.rotuloCurto(de.dia_operacional) + ': ' +
        linhas.map(l => l.descricao).join(', ') + ' (' + P.brl(total) + ') → compra de ' + x.fornecedor + ', paga como a original' });
    });
    // pendências de antes que este pacote resolve
    pk.resolver.forEach(x => {
      const a = S().get('anotacoes', refId(pk, x.anotacao));
      if (!a) return;
      const it = { x, a, status: a.resolvido ? 'ja' : 'muda' };
      c.resolver.push(it);
      c.cadastro.push({ tipo: 'resolver', status: it.status, texto: 'Resolve a pendência: ' + a.texto.slice(0, 90) + (a.texto.length > 90 ? '…' : '') + (a.resolvido ? ' (já estava resolvida)' : '') });
    });

    // compras
    const comprasApp = S().all('compras');
    pk.compras.forEach(x => {
      const id = idDe(pk, x.ref);
      const d = diaDe(x.dia);
      const soma = P.round(x.itens.reduce((s, l) => s + (+l[4] || 0), 0), 2);
      if (x.total != null && cents(soma) !== cents(x.total)) c.problemas.push('Compra ' + (x.fornecedor || x.ref) + ' de ' + P.Dia.rotuloCurto(d) + ': itens somam ' + P.brl(soma) + ', total ' + P.brl(x.total) + '.');
      const pags = (x.pagamentos || []).slice(0, -1).reduce((s, p) => s + (+p.valor || 0), 0);
      if (pags >= soma && (x.pagamentos || []).length > 1) c.problemas.push('Compra ' + (x.fornecedor || x.ref) + ': as partes do pagamento passam do total.');
      x.itens.forEach(l => { if (l[5] && !S().get('insumos', mapaIns.get(l[5]) || l[5]) && !pk.insumos.some(i => i.id === l[5])) c.problemas.push('Compra ' + x.ref + ': insumo ' + l[5] + ' não existe.'); });
      let status = 'novo', parecido = null;
      if (S().get('compras', id)) status = 'ja';
      else {
        parecido = comprasApp.find(o => o.dia_operacional === d && cents(o.total) === cents(soma));
        if (parecido) status = 'parecido';
      }
      const it = { x, id, dia: d, total: soma, status, parecido, chave: 'compra:' + x.ref };
      c.compras.push(it);
      if (status !== 'ja') { dia(d).compras += soma; dia(d).nCompras++; }
    });
    // vendas
    const vendasApp = S().all('comandas').filter(o => o.status === 'FECHADA');
    pk.vendas.forEach(x => {
      const id = idDe(pk, x.ref);
      const d = diaDe(x.dia);
      const total = P.round(x.itens.reduce((s, l) => s + (+l[1] || 0) * (+l[2] || 0), 0) - (+x.desconto || 0), 2);
      const pago = P.round((x.pag || []).reduce((s, p) => s + (+p[1] || 0), 0), 2);
      if (cents(total) !== cents(pago)) c.problemas.push('Venda ' + (x.cliente || x.ref) + ' de ' + P.Dia.rotuloCurto(d) + ': itens ' + P.brl(total) + ', pagamento ' + P.brl(pago) + '.');
      x.itens.forEach(l => { if (!S().get('itens', itemId(l[0])) && !pk.itens.some(i => i.id === l[0])) c.problemas.push('Venda ' + x.ref + ': item ' + l[0] + ' não existe.'); });
      let status = 'novo', parecido = null;
      if (S().get('comandas', id)) status = 'ja';
      else {
        parecido = vendasApp.find(o => o.dia_operacional === d && cents(o.total) === cents(total) && semAc(o.cliente) === semAc(x.cliente));
        if (parecido) status = 'parecido';
      }
      c.vendas.push({ x, id, dia: d, total, status, parecido, chave: 'venda:' + x.ref });
      if (status !== 'ja') { dia(d).vendas += total; dia(d).nVendas++; }
    });
    // despesas
    const despApp = S().all('despesas');
    pk.despesas.forEach(x => {
      const id = idDe(pk, x.ref);
      const d = diaDe(x.dia);
      let status = 'novo', parecido = null;
      if (S().get('despesas', id)) status = 'ja';
      else if (!x.distinto) { // distinto: o relatório já conferiu que não é a despesa parecida (ex.: condução de outro dia)
        parecido = despApp.find(o => o.dia_operacional === d && cents(o.valor) === cents(x.valor) && o.categoria === x.categoria);
        if (parecido) status = 'parecido';
      }
      c.despesas.push({ x, id, dia: d, status, parecido, chave: 'despesa:' + x.ref });
      if (status !== 'ja') dia(d).despesas += +x.valor || 0;
    });
    // anotações
    const textos = new Set(S().all('anotacoes').map(a => semAc(a.texto)));
    pk.anotacoes.forEach(x => {
      const id = idDe(pk, x.ref);
      c.anotacoes.push({ x, id, status: S().get('anotacoes', id) || textos.has(semAc(x.texto)) ? 'ja' : 'novo' });
    });
    // limpeza (comandas de teste, vazias…)
    pk.limpeza.forEach(x => {
      const r = S().get(x.tabela, x.id);
      if (r && !(x.tabela === 'comandas' && r.status !== 'ABERTA')) c.limpeza.push({ x, r });
    });
    return c;
  }

  // ---------------------------------------------------------------
  //  Lançar
  // ---------------------------------------------------------------
  function aplicar(pk, c) {
    const log = { id: pk.id, titulo: pk.titulo, quando: P.agoraISO(), criados: [], antes: [] };
    // guarda como o registro estava ANTES da importação (só a 1ª vez), para o "Desfazer";
    // o que esta importação criou não entra aqui (o Desfazer só apaga)
    const guardados = new Set();
    const criados = new Set();
    const chaveDe = (t, r) => t + ':' + (t === 'config' ? r.chave : r.id);
    const guardarAntes = (t, r) => {
      if (!r) return;
      const k = chaveDe(t, r);
      if (guardados.has(k) || criados.has(k)) return;
      guardados.add(k);
      log.antes.push([t, Object.assign({}, r)]);
    };
    const criar = (t, rec) => {
      const key = rec[t === 'config' ? 'chave' : 'id'];
      if (!S().get(t, key)) { log.criados.push([t, key]); criados.add(t + ':' + key); }
      return S().put(t, rec);
    };
    const u = P.Auth.usuario();
    const uid = u && u.id;
    const itemId = id => c.mapaItem.get(id) || id;
    const insId = id => (id ? c.mapaIns.get(id) || id : null);
    const pesId = id => (id ? c.mapaPes.get(id) || id : null);
    const n = { config: 0, insumos: 0, itens: 0, precos: 0, reativados: 0, pessoas: 0, compras: 0, vendas: 0, despesas: 0, anotacoes: 0, limpeza: 0, desativados: 0, botijoes: 0, resolvidas: 0, pagas: 0, cardapio: 0, corrigidos: 0, movidos: 0 };

    // configurações (junta com o que já existe)
    Object.keys(pk.config || {}).forEach(ch => {
      const atual = S().get('config', ch);
      guardarAntes('config', atual);
      S().put('config', { chave: ch, valor_json: Object.assign({}, P.cfg(ch), pk.config[ch]) });
      if (!atual) log.criados.push(['config', ch]);
      n.config++;
    });
    // insumos novos (preço vem das compras)
    pk.insumos.forEach(x => {
      if (S().get('insumos', insId(x.id))) return;
      criar('insumos', { id: x.id, nome: x.nome, unidade: x.unidade, preco: +x.preco || 0, fator_correcao: +x.fator_correcao || 1, atualizado_em: null });
      n.insumos++;
    });
    // cardápio: itens novos (com ficha, se vier) e preços que mudaram
    pk.itens.forEach(x => {
      const ja = S().get('itens', itemId(x.id));
      if (!ja) {
        criar('itens', { id: x.id, nome: x.nome, categoria: x.categoria, preco_venda: +x.preco_venda || 0, perda_pct: x.perda_pct != null ? +x.perda_pct : 0, ativo: x.ativo !== false, custo_estimado: x.custo_estimado || null });
        n.itens++;
      } else {
        // preço que mudou e prato desativado que volta ao cardápio
        const mudaPreco = x.preco_venda != null && cents(x.preco_venda) !== cents(ja.preco_venda);
        const reativa = x.ativo === true && ja.ativo === false;
        if (mudaPreco || reativa) {
          guardarAntes('itens', ja);
          S().put('itens', Object.assign({}, ja, mudaPreco ? { preco_venda: +x.preco_venda } : null, reativa ? { ativo: true } : null));
          if (mudaPreco) n.precos++;
          if (reativa) n.reativados++;
        }
      }
      const alvo = itemId(x.id);
      if (x.componentes && x.componentes.length && !P.Calc.componentesDe(alvo).length) {
        x.componentes.forEach((cp, i) => criar('componentes', {
          id: 'cp_' + alvo + '_imp' + i, item_id: alvo, insumo_id: cp.insumo ? insId(cp.insumo) : null,
          item_componente_id: cp.item ? itemId(cp.item) : null, gramas: +cp.qtd || 0, ordem: i,
        }));
      }
    });
    if (opcoes.desativar !== false) c.desativar.forEach(({ it }) => {
      guardarAntes('itens', it);
      S().put('itens', Object.assign({}, it, { ativo: false }));
      n.desativados++;
    });
    pk.pessoas.forEach(x => {
      if (S().get('pessoas', pesId(x.id))) return;
      criar('pessoas', { id: x.id, nome: x.nome, funcao: x.funcao || null, pagamento: x.pagamento || 'MENSAL', valor: +x.valor || 0, conducao_dia: +x.conducao_dia || 0,
        inicio: x.inicio || null, fim: x.fim || null, ativo: x.ativo !== false, obs: x.obs || null });
      n.pessoas++;
    });

    // preço de insumo informado no pacote (ex.: média de várias compras), com a data em que vale
    (pk.precosInsumos || []).forEach(x => {
      const ins = S().get('insumos', insId(x.insumo));
      if (!ins || !(+x.preco > 0) || cents(x.preco * 100) === cents(+ins.preco * 100)) return;
      const quando = meioDia(x.data || P.Dia.hoje());
      guardarAntes('insumos', ins);
      S().put('insumos', Object.assign({}, ins, { preco: +x.preco, atualizado_em: quando }));
      criar('historico_precos', { id: idDe(pk, 'hp-' + ins.id), insumo_id: ins.id, preco: +x.preco, data: quando });
      n.precos++;
    });

    // dia a dia: as compras do dia e depois as vendas do dia — assim o custo da bebida vendida
    // é o da compra mais nova até aquele dia (e o preço do insumo termina no da última compra)
    const entra = it => it.status === 'novo' || (it.status === 'parecido' && escolhas[it.chave]);
    const compras = c.compras.filter(entra).sort((a, b) => (a.dia < b.dia ? -1 : a.dia > b.dia ? 1 : 0));
    const vendas = c.vendas.filter(entra);
    const diasMov = [...new Set(compras.map(it => it.dia).concat(vendas.map(it => it.dia)))].sort();
    const lancarCompra = it => {
      const x = it.x;
      const linhas = x.itens.map(l => {
        const [descricao, q, un, pu, valor, ins, qIns] = l;
        const insumo = ins ? S().get('insumos', insId(ins)) : null;
        if (insumo) guardarAntes('insumos', insumo);
        if (insumo) {
          const qi = +qIns || +q;
          return { insumo_id: insumo.id, descricao: insumo.nome, lido: descricao, unidade: insumo.unidade, quantidade: qi, preco_unit: +valor / qi, valor: +valor };
        }
        return { insumo_id: null, descricao, unidade: un || 'un', quantidade: +q || 1, preco_unit: pu != null ? +pu : +valor / (+q || 1), valor: +valor };
      });
      const partes = (x.pagamentos || [{ forma: 'DINHEIRO' }]).map(p => ({
        forma: p.forma, valor: +p.valor || 0, vence: p.vence || null,
        pago_dia: p.pago_dia ? diaDe(p.pago_dia) : null, pago_forma: p.pago_forma || null, pago_em: p.pago_dia ? meioDia(diaDe(p.pago_dia)) : null,
      }));
      // hora da compra: a do pacote (no dia de verdade, mesmo domingo) ou meio-dia; segundos mantêm a ordem
      const [hh, mm] = String(x.hora || '12:00').split(':').map(Number);
      const [y, mo, dd] = x.dia.split('-').map(Number);
      const criado = new Date(y, mo - 1, dd, hh || 12, mm || 0, compras.indexOf(it) % 60).toISOString();
      P.Compras.salvar({
        silencioso: true, // sem aviso de food cost a cada compra importada
        id: it.id, idLinha: i => it.id + '-' + i, idHist: insid => it.id + '-hp-' + insid,
        criado_em: criado, dia: it.dia, fornecedor: x.fornecedor, forma: partes[0].forma, partes, obs: x.obs || null, linhas,
      });
      log.criados.push(['compras', it.id]);
      linhas.forEach((l, i) => log.criados.push(['compra_itens', it.id + '-' + i]));
      linhas.forEach(l => { if (l.insumo_id) log.criados.push(['historico_precos', it.id + '-hp-' + l.insumo_id]); });
      n.compras++;
    };
    // vendas: conta fechada, lançada depois (sem horário), com os itens e o pagamento
    const lancarVenda = it => {
      const x = it.x;
      const k = vendas.indexOf(it);
      const quando = meioDia(it.dia, k % 60);
      const linhas = x.itens.map((l, i) => {
        const item = S().get('itens', itemId(l[0]));
        const f = item && P.Calc.ficha(item);
        return {
          id: it.id + '-i' + i, comanda_id: it.id, item_id: item ? item.id : l[0], nome: l[3] || (item ? item.nome : l[0]), quantidade: +l[1], preco_unit: +l[2],
          // custo: o da ficha (bebida com custo de compra); prato sem ficha fica 0 e usa a estimativa de hoje
          cmv_unit: f && !f.semFicha ? P.round(f.cmv, 4) : 0,
          adicionado_em: quando, usuario_id: uid, removidos: 0,
        };
      });
      const total = P.round(linhas.reduce((s, l) => s + l.quantidade * l.preco_unit, 0) - (+x.desconto || 0), 2);
      linhas.forEach(l => criar('comanda_itens', l));
      (x.pag || []).forEach((p, i) => criar('pagamentos', {
        id: it.id + '-p' + i, comanda_id: it.id, dia_operacional: it.dia, forma: p[0], valor: P.round(+p[1], 2), pago_em: quando, usuario_id: uid,
        recebido_em: p[2] ? meioDia(diaDe(p[2])) : null, recebido_dia: p[2] ? diaDe(p[2]) : null, recebido_forma: p[3] || null,
      }));
      criar('comandas', {
        id: it.id, dia_operacional: it.dia, mesa: x.mesa || (x.canal === 'MARMITA' ? 'Marmita' : null), cliente: x.cliente || null, canal: x.canal || 'SALAO',
        status: 'FECHADA', aberta_em: quando, fechada_em: quando, desconto: +x.desconto || 0, total, usuario_id: uid, fechada_por: uid, cancelada_por: null,
        obs: x.obs || null, origem: 'DEPOIS',
      });
      n.vendas++;
    };
    diasMov.forEach(dia => {
      compras.filter(it => it.dia === dia).forEach(lancarCompra);
      vendas.filter(it => it.dia === dia).forEach(lancarVenda);
    });
    c.despesas.filter(entra).forEach((it, k) => {
      const x = it.x;
      criar('despesas', {
        id: it.id, dia_operacional: it.dia, categoria: x.categoria, descricao: x.descricao || null, valor: P.round(+x.valor, 2), forma: x.forma || null,
        criado_em: meioDia(x.dia, k % 60), usuario_id: uid, pessoa_id: pesId(x.pessoa), subtipo: x.subtipo || null,
        competencia: x.competencia || (x.pessoa ? P.Mesas.competenciaDe(x.categoria, x.subtipo, it.dia) : null),
      });
      n.despesas++;
    });
    c.anotacoes.filter(a => a.status === 'novo').forEach(a => {
      const x = a.x;
      criar('anotacoes', {
        id: a.id, dia: x.dia ? diaDe(x.dia) : null, tipo: x.tipo || 'PENDENCIA', texto: x.texto, resolvido: false, resolvido_em: null, resolucao: null,
        // 'compras:@c06' = a compra c06 deste pacote; sem @ = id de registro do app
        ref: x.registro ? x.registro.replace(/:@(.+)$/, (m0, r) => ':' + idDe(pk, r)) : null,
        criado_em: P.agoraISO(), usuario_id: uid,
      });
      n.anotacoes++;
    });
    // gás: botijões (depois das despesas, para a da compra já existir)
    c.botijoes.filter(b => b.status === 'novo').forEach(b => {
      const x = b.x;
      criar('botijoes', { id: b.id, inicio: x.inicio, fim: x.fim || null, tamanho: x.tamanho || null, valor: P.round(+x.valor || 0, 2), despesa_id: b.despesa,
        obs: x.obs || null, criado_em: P.agoraISO(), usuario_id: uid });
      n.botijoes++;
    });
    // contas a prazo pagas depois: as partes em aberto (menos a do cartão de crédito, que é a fatura)
    c.pagar.filter(p => p.status === 'muda').forEach(({ x, compra }) => {
      const atual = S().get('compras', compra.id);
      if (!atual || !(P.Compras.valorAberto(atual) > 0)) return;
      guardarAntes('compras', atual);
      P.Compras.pagar([atual], x.forma || 'DINHEIRO', diaDe(x.dia), p => (x.parte ? p.forma === x.parte : p.forma !== 'CREDITO'));
      n.pagas++;
    });
    // cardápio de cada dia (só os pratos que existem)
    c.cardapio.filter(d => d.status === 'muda').forEach(d => {
      const atual = S().get('config', 'cardapio_semana');
      if (atual) guardarAntes('config', atual); else if (!log.criados.some(k => k[0] === 'config' && k[1] === 'cardapio_semana')) log.criados.push(['config', 'cardapio_semana']);
      P.Cardapio.salvar(d.sem, d.ids.filter(id => S().get('itens', id)));
      n.cardapio++;
    });
    // correções em registros já lançados
    c.corrigir.filter(k => k.status === 'muda').forEach(({ x, r }) => {
      const atual = S().get(x.tabela, r.id);
      if (!atual) return;
      guardarAntes(x.tabela, atual);
      S().put(x.tabela, Object.assign({}, atual, x.campos));
      n.corrigidos++;
    });
    // separar linhas numa compra nova (mesmo dia e mesma forma de pagamento, já paga)
    c.mover.forEach(({ x, id, de, linhas, total }) => {
      const atual = S().get('compras', de.id);
      if (!atual || S().get('compras', id)) return;
      guardarAntes('compras', atual);
      const p0 = P.Compras.partes(atual)[0];
      const comLista = Array.isArray(atual.pagamentos) && atual.pagamentos.length;
      const resto = P.round((+atual.total || 0) - total, 2);
      S().put('compras', Object.assign({}, atual, { total: resto }, comLista ? { pagamentos: [Object.assign({}, p0, { valor: resto })] } : null));
      criar('compras', {
        id, dia_operacional: atual.dia_operacional, fornecedor: x.fornecedor, forma: atual.forma, total, criado_em: atual.criado_em, usuario_id: atual.usuario_id,
        pago_em: atual.pago_em || null, pago_dia: atual.pago_dia || null, pago_forma: atual.pago_forma || null, obs: x.obs || null,
        pagamentos: comLista ? [Object.assign({}, p0, { valor: total })] : null,
      });
      linhas.forEach((l, i) => {
        const la = S().get('compra_itens', l.id);
        guardarAntes('compra_itens', la);
        S().put('compra_itens', Object.assign({}, la, { compra_id: id, ordem: i }));
      });
      n.movidos++;
    });
    // pendências de antes resolvidas por este pacote
    c.resolver.filter(r => r.status === 'muda').forEach(({ x, a }) => {
      const atual = S().get('anotacoes', a.id);
      if (!atual || atual.resolvido) return;
      guardarAntes('anotacoes', atual);
      S().put('anotacoes', Object.assign({}, atual, { resolvido: true, resolvido_em: P.agoraISO(), resolucao: x.resolucao || null }));
      n.resolvidas++;
    });
    if (opcoes.limpeza !== false) c.limpeza.forEach(({ x, r }) => {
      guardarAntes(x.tabela, r);
      if (x.acao === 'cancelar') S().put('comandas', Object.assign({}, r, { status: 'CANCELADA', fechada_em: P.agoraISO(), cancelada_por: uid, obs: [r.obs, x.motivo].filter(Boolean).join(' · ') }));
      else S().remove(x.tabela, x.id);
      n.limpeza++;
    });
    // guarda para poder desfazer (só neste aparelho)
    const hist = (S().meta('importacoes') || []).filter(l => l.id !== pk.id);
    hist.push(log);
    S().setMeta('importacoes', hist);
    S().gravarJa();
    P.Sync.agendar(500);
    return n;
  }
  function desfazer(id) {
    const hist = S().meta('importacoes') || [];
    const log = hist.find(l => l.id === id);
    if (!log) return false;
    log.criados.forEach(([t, key]) => S().remove(t, key));
    log.antes.forEach(([t, r]) => S().put(t, r)); // volta como estava (vale como alteração nova)
    S().setMeta('importacoes', hist.filter(l => l.id !== id));
    S().gravarJa();
    return true;
  }

  // ---------------------------------------------------------------
  //  TELA
  // ---------------------------------------------------------------
  function abrir(obj) {
    try { pacote = validar(obj); } catch (e) { P.UI.toast(e.message, { tipo: 'perigo' }); return; }
    escolhas = {}; opcoes = {}; resultado = null;
    if (location.hash === '#/importar') P.UI.render(); else location.hash = '#/importar';
  }
  function telaImportar(view) {
    view.className = 'v-relatorio v-importar';
    const corpo = h('div');
    const arquivo = h('input', { type: 'file', accept: 'application/json,.json', style: { display: 'none' } });
    arquivo.addEventListener('change', async () => {
      const f = arquivo.files && arquivo.files[0];
      arquivo.value = '';
      if (!f) return;
      try { abrir(JSON.parse(await f.text())); } catch (e) { P.UI.toast('Não consegui ler o arquivo: ' + e.message, { tipo: 'perigo' }); }
    });
    const secao = (t, ...kids) => h('section', { class: 'rl-sec' }, h('div', { class: 'secao' }, t), kids);
    const linhaV = (rot, val, cls) => h('div', { class: 'rl-l' + (cls ? ' ' + cls : '') }, h('span', null, rot), h('b', null, val));
    const STATUS = { novo: ['novo', 'ok'], ja: ['já está no app', 'neutra'], parecido: ['parecido já existe', 'aviso'], muda: ['vai mudar', 'aviso'] };
    const tag = st => h('span', { class: 'tag ' + STATUS[st][1] }, STATUS[st][0]);
    function listaRegistros(itens, rotulo) {
      return h('details', { class: 'im-det' }, h('summary', null, rotulo),
        h('div', { class: 'rs-itens' }, itens.map(it => h('div', { class: 'rs-l im-l' },
          h('span', { class: 'rs-h' }, it.dia ? P.Dia.rotuloCurto(it.dia) : ''),
          h('span', { class: 'rs-n' }, it.nome, it.parecido ? h('small', null, 'no app: ' + it.parecido) : null,
            it.status === 'parecido' ? h('label', { class: 'im-chk' }, h('input', { type: 'checkbox', checked: !!escolhas[it.chave], onChange: e => { escolhas[it.chave] = e.target.checked; desenhar(); } }), ' lançar mesmo assim') : null),
          h('span', { class: 'rs-v' }, it.valor != null ? P.brl(it.valor) : '', ' ', tag(it.status))))));
    }
    function desenhar() {
      corpo.innerHTML = '';
      const hist = S().meta('importacoes') || [];
      if (resultado) {
        corpo.appendChild(h('div', { class: 'cp-ok' }, P.UI.icone('check'), h('div', null, h('b', null, 'Lançado: ' + resultado.titulo),
          h('small', null, [
            resultado.n.compras && resultado.n.compras + ' compras', resultado.n.vendas && resultado.n.vendas + ' vendas', resultado.n.despesas && resultado.n.despesas + ' despesas',
            resultado.n.itens && resultado.n.itens + ' itens novos no cardápio', resultado.n.reativados && resultado.n.reativados + (resultado.n.reativados === 1 ? ' prato de volta ao cardápio' : ' pratos de volta ao cardápio'),
            resultado.n.precos && resultado.n.precos + (resultado.n.precos === 1 ? ' preço atualizado' : ' preços atualizados'), resultado.n.insumos && resultado.n.insumos + ' insumos novos',
            resultado.n.pessoas && resultado.n.pessoas + (resultado.n.pessoas === 1 ? ' pessoa nova na equipe' : ' pessoas na equipe'), resultado.n.anotacoes && resultado.n.anotacoes + ' pendências', resultado.n.resolvidas && resultado.n.resolvidas + (resultado.n.resolvidas === 1 ? ' pendência antiga resolvida' : ' pendências antigas resolvidas'),
            resultado.n.botijoes && resultado.n.botijoes + (resultado.n.botijoes === 1 ? ' botijão no controle do gás' : ' botijões no controle do gás'),
            resultado.n.pagas && (resultado.n.pagas === 1 ? '1 conta a prazo paga' : resultado.n.pagas + ' contas a prazo pagas'), resultado.n.cardapio && 'cardápio de ' + resultado.n.cardapio + (resultado.n.cardapio === 1 ? ' dia' : ' dias'),
            resultado.n.corrigidos && (resultado.n.corrigidos === 1 ? '1 correção' : resultado.n.corrigidos + ' correções'), resultado.n.movidos && (resultado.n.movidos === 1 ? '1 compra separada' : resultado.n.movidos + ' compras separadas'),
            resultado.n.config && (resultado.n.config === 1 ? '1 ajuste' : resultado.n.config + ' ajustes'), resultado.n.desativados && resultado.n.desativados + ' pratos antigos desativados',
            resultado.n.limpeza && resultado.n.limpeza + ' comandas de teste limpas'].filter(Boolean).join(' · ')))));
        corpo.appendChild(h('div', { class: 'row gap' },
          h('a', { class: 'btn grow', href: '#/relatorio' }, 'Ver no relatório'), h('a', { class: 'btn grow', href: '#/anotacoes' }, 'Pendências'), h('a', { class: 'btn grow', href: '#/caixa' }, 'Capital e caixa')));
      }
      if (!pacote || resultado) {
        if (!resultado) corpo.appendChild(P.UI.vazio('Escolha o arquivo de lançamentos (.json). Antes de lançar, o app mostra o que é novo, o que já existe e os totais de cada dia.', 'upload'));
        corpo.appendChild(h('button', { type: 'button', class: 'btn primario bloco', onClick: () => arquivo.click() }, P.UI.icone('upload'), 'Escolher arquivo'));
        if (hist.length) corpo.appendChild(secao('Importações feitas neste aparelho', hist.slice().reverse().map(l => h('div', { class: 'rl-l' },
          h('span', null, l.titulo || l.id, h('small', null, ' · ' + new Date(l.quando).toLocaleString('pt-BR'))),
          h('button', { type: 'button', class: 'btn mini perigo', onClick: async () => {
            if (!(await P.UI.confirmar('Desfazer a importação "' + (l.titulo || l.id) + '"? Tudo que ela lançou é apagado e o que ela mudou volta como era.', { ok: 'Desfazer', perigo: true }))) return;
            desfazer(l.id); resultado = null; P.UI.toast('Importação desfeita'); desenhar();
          } }, 'Desfazer')))));
        return;
      }
      const pk = pacote;
      const c = conferir(pk);
      const entra = it => it.status === 'novo' || (it.status === 'parecido' && escolhas[it.chave]);
      const nC = c.compras.filter(entra), nV = c.vendas.filter(entra), nD = c.despesas.filter(entra);
      const soma = (l, k) => l.reduce((s, it) => s + (+it[k] || 0), 0);
      corpo.appendChild(h('div', { class: 'rs-cab' },
        h('div', { class: 'rs-tit' }, pk.titulo || 'Lançamentos'),
        h('div', { class: 'rs-sub' }, (pk.periodo ? P.Dia.rotuloCurto(pk.periodo[0]) + ' a ' + P.Dia.rotuloCurto(pk.periodo[1]) + ' · ' : '') + (pk.fonte || '')),
        pk.resumo ? h('div', { class: 'rs-obs' }, pk.resumo) : null));
      if (c.problemas.length) corpo.appendChild(h('div', { class: 'banner perigo' }, P.UI.icone('alerta'), h('span', { class: 'banner-t' }, h('b', null, 'O pacote tem erros — nada será lançado: '), c.problemas.slice(0, 6).join(' '))));
      // por dia: para conferir com o relatório
      const ds = [...c.porDia.keys()].sort();
      corpo.appendChild(secao('Por dia (o que vai entrar)',
        h('div', { class: 'rl-tab' },
          h('div', { class: 'rl-tr th' }, h('span', null, 'Dia'), h('span', null, 'Vendas'), h('span', null, 'Contas'), h('span', null, 'Compras'), h('span', null, 'Despesas')),
          ds.map(d => { const x = c.porDia.get(d); return h('div', { class: 'rl-tr' }, h('span', null, P.Dia.rotuloCurto(d)), h('span', null, x.vendas ? P.brl(x.vendas) : '—'), h('span', null, x.nVendas || '—'), h('span', null, x.compras ? P.brl(x.compras) : '—'), h('span', null, x.despesas ? P.brl(x.despesas) : '—')); }),
          h('div', { class: 'rl-tr th' }, h('span', null, 'Total'), h('span', null, P.brl(soma(nV, 'total'))), h('span', null, nV.length), h('span', null, P.brl(soma(nC, 'total'))), h('span', null, P.brl(nD.reduce((s, it) => s + (+it.x.valor || 0), 0)))))));
      const conta = (lista, st) => lista.filter(it => it.status === st).length;
      const resumoSec = l => [conta(l, 'novo') + ' novos', conta(l, 'ja') ? conta(l, 'ja') + ' já no app' : null, conta(l, 'parecido') ? conta(l, 'parecido') + ' parecidos' : null].filter(Boolean).join(' · ');
      corpo.appendChild(secao('Compras · ' + resumoSec(c.compras),
        listaRegistros(c.compras.map(it => ({ dia: it.dia, nome: (it.x.fornecedor || 'Compra') + ' · ' + it.x.itens.length + ' itens' + (it.x.pagamentos && it.x.pagamentos.some(p => p.forma === 'PRAZO' || p.forma === 'CREDITO') ? ' · ' + it.x.pagamentos.map(p => P.Compras.NOME_FORMA[p.forma]).join(' + ') : ''),
          valor: it.total, status: it.status, chave: it.chave, parecido: it.parecido ? (it.parecido.fornecedor || 'compra') + ' ' + P.brl(it.parecido.total) : null })), 'Ver as ' + c.compras.length + ' compras')));
      corpo.appendChild(secao('Vendas · ' + resumoSec(c.vendas),
        listaRegistros(c.vendas.map(it => ({ dia: it.dia, nome: (it.x.cliente || 'sem nome') + ' · ' + (P.Mesas.NOME_CANAL[it.x.canal] || '') + ' · ' + it.x.pag.map(p => P.Mesas.NOME_FORMA[p[0]]).join(' + '),
          valor: it.total, status: it.status, chave: it.chave, parecido: it.parecido ? P.Mesas.rotulo(it.parecido) + ' ' + P.brl(it.parecido.total) : null })), 'Ver as ' + c.vendas.length + ' vendas')));
      corpo.appendChild(secao('Despesas, equipe e retiradas · ' + resumoSec(c.despesas),
        listaRegistros(c.despesas.map(it => ({ dia: it.dia, nome: (P.Mesas.NOME_DESP[it.x.categoria] || it.x.categoria) + ' · ' + (it.x.descricao || ''), valor: it.x.valor, status: it.status, chave: it.chave,
          parecido: it.parecido ? (it.parecido.descricao || P.Mesas.NOME_DESP[it.parecido.categoria]) + ' ' + P.brl(it.parecido.valor) : null })), 'Ver as ' + c.despesas.length + ' despesas')));
      corpo.appendChild(secao('Cadastro, cardápio do dia, gás, contas pagas, correções e ajustes · ' + c.cadastro.filter(x => x.status !== 'ja').length + ' mudanças',
        h('details', { class: 'im-det' }, h('summary', null, 'Ver o cadastro'),
          h('div', { class: 'rs-itens' }, c.cadastro.map(x => h('div', { class: 'rs-l' }, h('span', { class: 'rs-n' }, x.texto), h('span', { class: 'rs-v' }, tag(x.status))))))));
      if (c.desativar.length) {
        corpo.appendChild(secao('Pratos do plano antigo',
          h('label', { class: 'im-op' }, h('input', { type: 'checkbox', checked: opcoes.desativar !== false, onChange: e => { opcoes.desativar = e.target.checked; } }),
            ' Desativar ' + c.desativar.length + ' pratos que não estão no cardápio Maria Simone (saem da tela das mesas; a ficha continua guardada e dá para reativar em Fichas → Cadastro)'),
          h('small', { class: 'campo-d' }, c.desativar.map(d => d.texto).join(' · '))));
      }
      if (c.limpeza.length) {
        corpo.appendChild(secao('Limpeza',
          h('label', { class: 'im-op' }, h('input', { type: 'checkbox', checked: opcoes.limpeza !== false, onChange: e => { opcoes.limpeza = e.target.checked; } }), ' Limpar ' + c.limpeza.length + ' comandas abertas de teste'),
          h('small', { class: 'campo-d' }, c.limpeza.map(l => l.x.motivo).join(' · '))));
      }
      const nA = c.anotacoes.filter(a => a.status === 'novo').length;
      if (c.anotacoes.length) corpo.appendChild(secao('Pendências · ' + nA + ' novas', h('details', { class: 'im-det' }, h('summary', null, 'Ver'),
        h('div', { class: 'rs-itens' }, c.anotacoes.map(a => h('div', { class: 'rs-l' }, h('span', { class: 'rs-n' }, a.x.texto), h('span', { class: 'rs-v' }, tag(a.status))))))));
      const total = nC.length + nV.length + nD.length + nA + c.cadastro.filter(x => x.status !== 'ja').length;
      corpo.appendChild(h('div', { class: 'row gap acoes' },
        h('button', { type: 'button', class: 'btn', onClick: () => { pacote = null; desenhar(); } }, 'Cancelar'),
        h('button', { type: 'button', class: 'btn primario grow', disabled: !!c.problemas.length || !total, onClick: async () => {
          if (!(await P.UI.confirmar('Lançar ' + nC.length + ' compras, ' + nV.length + ' vendas e ' + nD.length + ' despesas (com o cadastro e as pendências)? Dá para desfazer depois em Importar lançamentos.', { ok: 'Lançar' }))) return;
          const n = aplicar(pk, c);
          resultado = { titulo: pk.titulo || pk.id, n };
          pacote = null;
          P.vibrar([20, 40, 20]);
          desenhar();
        } }, P.UI.icone('check'), total ? 'Lançar tudo' : 'Nada novo para lançar')));
    }
    view.append(corpo, arquivo);
    desenhar();
    return { onDados() { if (pacote && !document.querySelector('.sheet-back')) desenhar(); } };
  }

  P.UI.rota('importar', { titulo: 'Importar lançamentos', tab: 'mais', dono: true, render: telaImportar });
  P.Importar = { abrir, conferir, aplicar, desfazer, validar };
})();
