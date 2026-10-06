-- =====================================================================
--  Pátio do Pari · Restaurante — schema do Supabase (Postgres)
--  Use um PROJETO NOVO no Supabase (separado do ERP da Agro Bras).
--  Cole tudo no SQL Editor e rode uma vez. Pode rodar de novo sem estragar.
--
--  O app é offline-first: grava no celular e envia quando tiver rede.
--  Cada tabela tem:
--    modificado_em   → hora da alteração no aparelho (vence a mais nova)
--    excluido        → exclusão "suave" (para sincronizar a exclusão)
--    sincronizado_em → hora em que chegou no servidor (cursor de download)
--  Sem chaves estrangeiras de propósito: os registros chegam fora de ordem.
--
--  SEGURANÇA: o site e a chave pública ficam à vista de qualquer um, então
--  os dados só abrem para usuário LOGADO (Authentication → Users). Depois de
--  criar o seu usuário, DESLIGUE "Allow new users to sign up" (Authentication
--  → Sign In / Providers) para ninguém criar conta sozinho.
-- =====================================================================

create or replace function pari_lww() returns trigger language plpgsql as $$
begin
  -- escrita atrasada (aparelho que estava offline) não sobrescreve a mais nova
  if tg_op = 'UPDATE' and new.modificado_em < old.modificado_em then
    return old;
  end if;
  new.sincronizado_em := clock_timestamp();
  return new;
end $$;

create table if not exists usuarios (
  id text primary key,
  nome text not null,
  pin_hash text not null,
  papel text not null check (papel in ('DONO', 'OPERADOR')),
  modificado_em timestamptz not null default now(),
  excluido boolean not null default false,
  sincronizado_em timestamptz not null default clock_timestamp()
);

create table if not exists config (
  chave text primary key,
  valor_json jsonb not null default '{}'::jsonb,
  modificado_em timestamptz not null default now(),
  excluido boolean not null default false,
  sincronizado_em timestamptz not null default clock_timestamp()
);

-- ETAPA 1 — contador de fluxo (uma linha por bloco de contagem).
-- Só PASSOU é contado à mão; "comprou" é calculado das comandas.
create table if not exists contagens (
  id text primary key,
  dia_operacional date not null,
  faixa_hora smallint not null check (faixa_hora between 0 and 23),
  modo text not null check (modo in ('PASSOU', 'COMPROU')),
  quantidade integer not null default 0,
  usuario_id text,
  criado_em timestamptz not null default now(),
  encerrado boolean not null default false,
  modificado_em timestamptz not null default now(),
  excluido boolean not null default false,
  sincronizado_em timestamptz not null default clock_timestamp()
);

-- ETAPA 2 — fichas técnicas
create table if not exists insumos (
  id text primary key,
  nome text not null,
  unidade text not null default 'kg' check (unidade in ('kg', 'L', 'un')),
  preco numeric(12, 4) not null default 0,
  fator_correcao numeric(8, 4) not null default 1,
  atualizado_em timestamptz,               -- data da última atualização de PREÇO
  modificado_em timestamptz not null default now(),
  excluido boolean not null default false,
  sincronizado_em timestamptz not null default clock_timestamp()
);

create table if not exists itens (
  id text primary key,
  nome text not null,
  categoria text not null check (categoria in ('ESPETO', 'PRATO', 'BEBIDA', 'GUARNICAO')),
  preco_venda numeric(12, 2) not null default 0,   -- 0 = componente (não vendido sozinho)
  perda_pct numeric(6, 2) not null default 0,
  ativo boolean not null default true,
  custo_estimado numeric(12, 4),           -- prato sem ficha: custo por unidade informado pelo dono
  modificado_em timestamptz not null default now(),
  excluido boolean not null default false,
  sincronizado_em timestamptz not null default clock_timestamp()
);
alter table itens add column if not exists custo_estimado numeric(12, 4);

create table if not exists componentes (
  id text primary key,
  item_id text not null,
  insumo_id text,
  item_componente_id text,
  gramas numeric(12, 3) not null default 0,  -- g (kg) · ml (L) · unidades (un) · nº de porções (item_componente)
  ordem integer not null default 0,
  modificado_em timestamptz not null default now(),
  excluido boolean not null default false,
  sincronizado_em timestamptz not null default clock_timestamp()
);

create table if not exists historico_precos (
  id text primary key,
  insumo_id text not null,
  preco numeric(12, 4) not null,
  data timestamptz not null default now(),
  modificado_em timestamptz not null default now(),
  excluido boolean not null default false,
  sincronizado_em timestamptz not null default clock_timestamp()
);

-- MESAS / COMANDAS ao vivo (toda venda passa por aqui; totais e "comprou" saem daqui)
create table if not exists comandas (
  id text primary key,
  dia_operacional date not null,           -- dia do fechamento (regra das 03:00)
  mesa text,                               -- '1'..'12', 'Balcão', 'Marmita'
  cliente text,
  canal text not null default 'SALAO' check (canal in ('ESPETO', 'SALAO', 'MARMITA')),
  status text not null default 'ABERTA' check (status in ('ABERTA', 'FECHADA', 'CANCELADA')),
  aberta_em timestamptz not null default now(),
  fechada_em timestamptz,
  desconto numeric(12, 2) not null default 0,
  total numeric(12, 2) not null default 0,
  usuario_id text,
  fechada_por text,
  cancelada_por text,
  obs text,
  origem text,                             -- vazio = ao vivo; 'DEPOIS' = venda lançada depois (sem horário)
  modificado_em timestamptz not null default now(),
  excluido boolean not null default false,
  sincronizado_em timestamptz not null default clock_timestamp()
);
alter table comandas add column if not exists origem text;

create table if not exists comanda_itens (
  id text primary key,
  comanda_id text not null,
  item_id text not null,
  nome text,                               -- nome do item na hora da venda
  quantidade numeric(10, 2) not null default 1,
  preco_unit numeric(12, 2) not null default 0,
  cmv_unit numeric(12, 4) not null default 0,
  adicionado_em timestamptz not null default now(),
  usuario_id text,
  removidos numeric(10, 2) not null default 0,   -- unidades tiradas depois (controle)
  removido_por text,
  removido_em timestamptz,
  modificado_em timestamptz not null default now(),
  excluido boolean not null default false,
  sincronizado_em timestamptz not null default clock_timestamp()
);

create table if not exists pagamentos (
  id text primary key,
  comanda_id text not null,
  dia_operacional date not null,
  forma text not null check (forma in ('DINHEIRO', 'PIX', 'DEBITO', 'CREDITO', 'FIADO')),
  valor numeric(12, 2) not null default 0,
  pago_em timestamptz not null default now(),
  usuario_id text,
  recebido_em timestamptz,                 -- fiado: quando foi pago
  recebido_dia date,
  recebido_forma text,
  modificado_em timestamptz not null default now(),
  excluido boolean not null default false,
  sincronizado_em timestamptz not null default clock_timestamp()
);

create table if not exists despesas (
  id text primary key,
  dia_operacional date not null,
  categoria text not null check (categoria in ('MERCADORIA', 'GAS_CARVAO', 'EMBALAGEM', 'LIMPEZA', 'MANUTENCAO',
    'FUNCIONARIOS', 'ALUGUEL', 'CONTAS', 'IMPOSTOS', 'PROLABORE', 'INVESTIMENTO', 'OUTROS')),
  descricao text,
  valor numeric(12, 2) not null default 0,
  forma text,
  criado_em timestamptz not null default now(),
  usuario_id text,
  pessoa_id text,                          -- equipe: de quem é o pagamento (vale, salário, retirada do dono)
  subtipo text,                            -- VALE | CONDUCAO | SALARIO | SEMANA | OUTRO
  competencia text,                        -- mês ('2026-10') ou semana ('2026-09-28') a que o pagamento se refere
  modificado_em timestamptz not null default now(),
  excluido boolean not null default false,
  sincronizado_em timestamptz not null default clock_timestamp()
);
-- banco criado antes das categorias novas e da forma de pagamento: atualiza (pode rodar de novo)
alter table despesas add column if not exists forma text;
alter table despesas add column if not exists pessoa_id text;
alter table despesas add column if not exists subtipo text;
alter table despesas add column if not exists competencia text;
alter table despesas drop constraint if exists despesas_categoria_check;
alter table despesas add constraint despesas_categoria_check check (categoria in ('MERCADORIA', 'GAS_CARVAO', 'EMBALAGEM',
  'LIMPEZA', 'MANUTENCAO', 'FUNCIONARIOS', 'ALUGUEL', 'CONTAS', 'IMPOSTOS', 'PROLABORE', 'INVESTIMENTO', 'OUTROS'));

-- COMPRAS de mercadoria (cada item de insumo atualiza o preço da ficha técnica)
create table if not exists compras (
  id text primary key,
  dia_operacional date not null,
  fornecedor text,
  forma text not null default 'DINHEIRO' check (forma in ('DINHEIRO', 'PIX', 'CARTAO', 'CREDITO', 'PRAZO')),
  total numeric(12, 2) not null default 0,
  criado_em timestamptz not null default now(),
  usuario_id text,
  pago_em timestamptz,                     -- a prazo: vazio até pagar
  pago_dia date,
  pago_forma text,
  obs text,
  -- como foi paga, em partes: [{forma, valor, vence, pago_dia, pago_forma}]
  -- (ex.: parte no cartão de crédito com vencimento da fatura e parte em dinheiro)
  pagamentos jsonb,
  modificado_em timestamptz not null default now(),
  excluido boolean not null default false,
  sincronizado_em timestamptz not null default clock_timestamp()
);
alter table compras add column if not exists pagamentos jsonb;
alter table compras drop constraint if exists compras_forma_check;
alter table compras add constraint compras_forma_check check (forma in ('DINHEIRO', 'PIX', 'CARTAO', 'CREDITO', 'PRAZO'));

create table if not exists compra_itens (
  id text primary key,
  compra_id text not null,
  insumo_id text,                          -- vazio = item sem ficha (gelo, sacola…)
  descricao text not null,
  quantidade numeric(12, 3) not null default 0,
  unidade text not null default 'kg',
  preco_unit numeric(12, 4) not null default 0,
  valor numeric(12, 2) not null default 0,
  ordem integer not null default 0,
  modificado_em timestamptz not null default now(),
  excluido boolean not null default false,
  sincronizado_em timestamptz not null default clock_timestamp()
);

-- EQUIPE: quem trabalha (e o dono, para o pró-labore) e como recebe.
-- Os pagamentos (vale, condução, salário, semana, retirada) são despesas com pessoa_id.
create table if not exists pessoas (
  id text primary key,
  nome text not null,
  funcao text,                             -- ex.: Cozinheira, Entregadora, Dono
  pagamento text not null default 'MENSAL' check (pagamento in ('MENSAL', 'SEMANAL', 'DIARIA', 'PROLABORE')),
  valor numeric(12, 2) not null default 0, -- salário do mês, valor da semana, da diária ou pró-labore do mês
  conducao_dia numeric(12, 2) not null default 0,
  inicio date,
  fim date,
  ativo boolean not null default true,
  obs text,
  modificado_em timestamptz not null default now(),
  excluido boolean not null default false,
  sincronizado_em timestamptz not null default clock_timestamp()
);

-- PENDÊNCIAS E ANOTAÇÕES do dono (o que falta confirmar, lembretes, o que não tem outro lugar)
create table if not exists anotacoes (
  id text primary key,
  dia date,                                -- dia a que se refere (opcional)
  tipo text not null default 'PENDENCIA' check (tipo in ('PENDENCIA', 'NOTA')),
  texto text not null,
  resolvido boolean not null default false,
  resolvido_em timestamptz,
  resolucao text,
  ref text,                                -- registro ligado (ex.: 'compras:<id>')
  criado_em timestamptz not null default now(),
  usuario_id text,
  modificado_em timestamptz not null default now(),
  excluido boolean not null default false,
  sincronizado_em timestamptz not null default clock_timestamp()
);

-- GÁS: cada botijão, do dia em que foi ligado ao dia em que acabou (quanto dura, custo por dia)
create table if not exists botijoes (
  id text primary key,
  inicio date not null,                    -- dia em que começou a usar
  fim date,                                -- dia em que acabou (vazio = em uso)
  tamanho text,                            -- P13 | P20 | P45
  valor numeric(12, 2) not null default 0,
  despesa_id text,                         -- despesa da compra (Gás / carvão)
  obs text,
  criado_em timestamptz not null default now(),
  usuario_id text,
  modificado_em timestamptz not null default now(),
  excluido boolean not null default false,
  sincronizado_em timestamptz not null default clock_timestamp()
);

-- Gatilho, índice de sincronização e acesso (chave pública do app)
do $$
declare t text;
begin
  foreach t in array array['usuarios', 'config', 'contagens', 'insumos', 'itens', 'componentes', 'historico_precos',
                           'comandas', 'comanda_itens', 'pagamentos', 'despesas', 'compras', 'compra_itens',
                           'pessoas', 'anotacoes', 'botijoes'] loop
    execute format('drop trigger if exists trg_%1$s_lww on %1$s', t);
    execute format('create trigger trg_%1$s_lww before insert or update on %1$s for each row execute function pari_lww()', t);
    execute format('create index if not exists idx_%1$s_sync on %1$s (sincronizado_em)', t);
    execute format('alter table %1$s enable row level security', t);
    execute format('drop policy if exists %1$s_app on %1$s', t);
    -- só usuário logado (o app faz login com o e-mail e a senha da nuvem)
    execute format('create policy %1$s_app on %1$s for all to authenticated using (true) with check (true)', t);
    execute format('revoke all on %1$s from anon', t);
    -- sem DELETE: o app só marca como excluído
    execute format('grant select, insert, update on %1$s to authenticated', t);
  end loop;
end $$;

create index if not exists idx_comandas_dia on comandas (dia_operacional);
create index if not exists idx_comanda_itens_comanda on comanda_itens (comanda_id);
create index if not exists idx_contagens_dia on contagens (dia_operacional);
create index if not exists idx_compras_dia on compras (dia_operacional);
create index if not exists idx_compra_itens_compra on compra_itens (compra_id);
