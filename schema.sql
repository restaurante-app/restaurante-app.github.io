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
  modificado_em timestamptz not null default now(),
  excluido boolean not null default false,
  sincronizado_em timestamptz not null default clock_timestamp()
);

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
  modificado_em timestamptz not null default now(),
  excluido boolean not null default false,
  sincronizado_em timestamptz not null default clock_timestamp()
);

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
  categoria text not null check (categoria in ('MERCADORIA', 'GAS_CARVAO', 'EMBALAGEM', 'LIMPEZA', 'OUTROS')),
  descricao text,
  valor numeric(12, 2) not null default 0,
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
                           'comandas', 'comanda_itens', 'pagamentos', 'despesas'] loop
    execute format('drop trigger if exists trg_%1$s_lww on %1$s', t);
    execute format('create trigger trg_%1$s_lww before insert or update on %1$s for each row execute function pari_lww()', t);
    execute format('create index if not exists idx_%1$s_sync on %1$s (sincronizado_em)', t);
    execute format('alter table %1$s enable row level security', t);
    execute format('drop policy if exists %1$s_app on %1$s', t);
    execute format('create policy %1$s_app on %1$s for all to anon, authenticated using (true) with check (true)', t);
    -- sem DELETE: o app só marca como excluído
    execute format('grant select, insert, update on %1$s to anon, authenticated', t);
  end loop;
end $$;

create index if not exists idx_comandas_dia on comandas (dia_operacional);
create index if not exists idx_comanda_itens_comanda on comanda_itens (comanda_id);
create index if not exists idx_contagens_dia on contagens (dia_operacional);
