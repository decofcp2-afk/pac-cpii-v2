-- =====================================================================
-- PAC CPII v2 — Schema completo + RLS
-- Executar no Supabase SQL Editor (uma única vez)
-- Projeto: https://fhgqixzufmgebwfffdai.supabase.co
-- =====================================================================

-- ── EXTENSÕES ────────────────────────────────────────────────────── --
create extension if not exists "uuid-ossp";

-- ── TIPOS ENUM ───────────────────────────────────────────────────── --
create type papel_usuario as enum (
  'administrador', 'ord_despesas', 'chefia', 'chefe_secao', 'licitacoes'
);

create type tipo_unidade as enum (
  'campus', 'pro_reitoria', 'diretoria', 'secao'
);

create type status_demanda as enum (
  'rascunho', 'submetida', 'de_acordo', 'reprovada', 'priorizada', 'homologada'
);

create type acao_historico as enum (
  'criacao', 'envio', 'aprovacao', 'reprovacao',
  'priorizacao', 'homologacao', 'reversao', 'edicao'
);

-- ── CAMPI ────────────────────────────────────────────────────────── --
create table campi (
  id        uuid primary key default uuid_generate_v4(),
  nome      text not null,
  sigla     text not null unique,
  criado_em timestamptz not null default now()
);

-- ── UNIDADES ─────────────────────────────────────────────────────── --
create table unidades (
  id        uuid primary key default uuid_generate_v4(),
  campus_id uuid not null references campi(id) on delete cascade,
  parent_id uuid          references unidades(id) on delete set null,
  nome      text not null,
  sigla     text not null,
  tipo      tipo_unidade not null default 'secao',
  criado_em timestamptz not null default now(),
  unique (campus_id, sigla)
);

-- ── USUÁRIOS ─────────────────────────────────────────────────────── --
create table usuarios (
  id              uuid primary key references auth.users(id) on delete cascade,
  campus_id       uuid references campi(id)    on delete set null,
  unidade_id      uuid references unidades(id) on delete set null,
  nome            text not null,
  papel           papel_usuario not null,
  ativo           boolean not null default true,
  primeiro_acesso boolean not null default true,
  criado_em       timestamptz not null default now()
);

-- ── DOTAÇÕES ORÇAMENTÁRIAS ───────────────────────────────────────── --
create table dotacoes (
  id          uuid primary key default uuid_generate_v4(),
  campus_id   uuid    not null references campi(id) on delete cascade,
  exercicio   integer not null check (exercicio between 2020 and 2099),
  valor_total numeric(15,2) not null check (valor_total >= 0),
  descricao   text,
  criado_em   timestamptz not null default now(),
  unique (campus_id, exercicio)
);

-- ── DISTRIBUIÇÕES ────────────────────────────────────────────────── --
create table distribuicoes (
  id          uuid primary key default uuid_generate_v4(),
  dotacao_id  uuid not null references dotacoes(id)  on delete cascade,
  unidade_id  uuid not null references unidades(id)  on delete cascade,
  valor       numeric(15,2) not null check (valor > 0),
  criado_em   timestamptz not null default now(),
  unique (dotacao_id, unidade_id)
);

-- ── DEMANDAS ─────────────────────────────────────────────────────── --
create table demandas (
  id          uuid primary key default uuid_generate_v4(),
  campus_id   uuid not null references campi(id)    on delete cascade,
  unidade_id  uuid not null references unidades(id) on delete cascade,
  exercicio   integer not null check (exercicio between 2020 and 2099),
  status      status_demanda not null default 'rascunho',

  -- Dados da contratação
  descricao_objeto      text not null,
  justificativa         text,
  quantidade            numeric(15,4) not null check (quantidade > 0),
  unidade_medida        text not null,
  valor_estimado        numeric(15,2) not null check (valor_estimado >= 0),
  categoria_despesa     text,
  natureza_despesa      text,
  modalidade_licitacao  text,

  -- Contrato anterior
  possui_contrato         boolean not null default false,
  risco_nao_prorrogacao   text,

  -- Gestor Titular
  gestor_titular_nome   text not null,
  gestor_titular_siape  text not null check (gestor_titular_siape ~ '^\d{7}$'),
  gestor_titular_email  text not null,

  -- Gestor Substituto
  gestor_substituto_nome   text not null,
  gestor_substituto_siape  text not null check (gestor_substituto_siape ~ '^\d{7}$'),
  gestor_substituto_email  text not null,

  -- Fiscal Titular
  fiscal_titular_nome   text not null,
  fiscal_titular_siape  text not null check (fiscal_titular_siape ~ '^\d{7}$'),
  fiscal_titular_email  text not null,

  -- Fiscal Substituto
  fiscal_substituto_nome   text not null,
  fiscal_substituto_siape  text not null check (fiscal_substituto_siape ~ '^\d{7}$'),
  fiscal_substituto_email  text not null,

  -- Matriz GUT (gut_total é calculado automaticamente pelo banco)
  gut_g         integer check (gut_g between 1 and 5),
  gut_u         integer check (gut_u between 1 and 5),
  gut_t         integer check (gut_t between 1 and 5),
  gut_total     integer generated always as (
    case when gut_g is not null and gut_u is not null and gut_t is not null
    then gut_g * gut_u * gut_t else null end
  ) stored,
  gut_prioridade integer,

  -- Auditoria
  criado_por     uuid references auth.users(id),
  atualizado_por uuid references auth.users(id),
  criado_em      timestamptz not null default now(),
  atualizado_em  timestamptz not null default now()
);

-- ── HISTÓRICO ────────────────────────────────────────────────────── --
create table historico_demandas (
  id               uuid primary key default uuid_generate_v4(),
  demanda_id       uuid not null references demandas(id) on delete cascade,
  usuario_id       uuid references auth.users(id),
  acao             acao_historico not null,
  status_anterior  status_demanda,
  status_novo      status_demanda,
  justificativa    text,
  criado_em        timestamptz not null default now()
);

-- ── ÍNDICES ──────────────────────────────────────────────────────── --
create index on demandas(campus_id, exercicio, status);
create index on demandas(unidade_id);
create index on unidades(campus_id);
create index on unidades(parent_id);
create index on usuarios(campus_id);
create index on distribuicoes(dotacao_id);
create index on historico_demandas(demanda_id);

-- ── TRIGGER: atualizado_em ───────────────────────────────────────── --
create or replace function set_atualizado_em()
returns trigger language plpgsql as $$
begin new.atualizado_em = now(); return new; end;
$$;

create trigger trg_demandas_atualizado_em
  before update on demandas
  for each row execute function set_atualizado_em();

-- ── FUNÇÕES AUXILIARES (security definer) ───────────────────────── --
-- Evitam joins repetidos nas políticas RLS

create or replace function get_meu_campus_id()
returns uuid language sql security definer stable as $$
  select campus_id from usuarios where id = auth.uid()
$$;

create or replace function get_meu_papel()
returns text language sql security definer stable as $$
  select papel::text from usuarios where id = auth.uid()
$$;

create or replace function get_minha_unidade_id()
returns uuid language sql security definer stable as $$
  select unidade_id from usuarios where id = auth.uid()
$$;

-- Retorna todos IDs de uma sub-árvore de unidades (para visibilidade da chefia)
create or replace function sub_arvore(root_id uuid)
returns setof uuid language sql security definer stable as $$
  with recursive tree as (
    select id from unidades where id = root_id
    union all
    select u.id from unidades u join tree t on u.parent_id = t.id
  )
  select id from tree
$$;

-- ── HABILITAR RLS ────────────────────────────────────────────────── --
alter table campi              enable row level security;
alter table unidades           enable row level security;
alter table usuarios           enable row level security;
alter table dotacoes           enable row level security;
alter table distribuicoes      enable row level security;
alter table demandas           enable row level security;
alter table historico_demandas enable row level security;

-- ── POLÍTICAS: CAMPI ─────────────────────────────────────────────── --
-- Leitura pública (painel público não autenticado)
create policy "campi_select_publico" on campi
  for select using (true);

create policy "campi_insert_admin" on campi
  for insert with check (get_meu_papel() = 'administrador');

create policy "campi_update_admin" on campi
  for update using (get_meu_papel() = 'administrador');

-- ── POLÍTICAS: UNIDADES ──────────────────────────────────────────── --
create policy "unidades_select" on unidades
  for select using (
    get_meu_papel() = 'administrador'
    or campus_id = get_meu_campus_id()
    or true  -- leitura pública necessária para o painel
  );

create policy "unidades_insert_admin" on unidades
  for insert with check (get_meu_papel() = 'administrador');

create policy "unidades_update_admin" on unidades
  for update using (get_meu_papel() = 'administrador');

-- ── POLÍTICAS: USUÁRIOS ──────────────────────────────────────────── --
create policy "usuarios_select" on usuarios
  for select using (
    id = auth.uid()
    or get_meu_papel() = 'administrador'
    or (
      campus_id = get_meu_campus_id()
      and get_meu_papel() in ('ord_despesas', 'licitacoes')
    )
  );

create policy "usuarios_insert" on usuarios
  for insert with check (
    get_meu_papel() = 'administrador'
    or (
      get_meu_papel() = 'licitacoes'
      and campus_id = get_meu_campus_id()
    )
  );

create policy "usuarios_update" on usuarios
  for update using (
    id = auth.uid()
    or get_meu_papel() = 'administrador'
    or (
      campus_id = get_meu_campus_id()
      and get_meu_papel() in ('ord_despesas', 'licitacoes')
    )
  );

-- ── POLÍTICAS: DOTAÇÕES ──────────────────────────────────────────── --
create policy "dotacoes_select" on dotacoes
  for select using (
    get_meu_papel() = 'administrador'
    or campus_id = get_meu_campus_id()
  );

create policy "dotacoes_insert" on dotacoes
  for insert with check (
    get_meu_papel() = 'administrador'
    or (
      campus_id = get_meu_campus_id()
      and get_meu_papel() in ('ord_despesas', 'licitacoes')
    )
  );

create policy "dotacoes_update" on dotacoes
  for update using (
    get_meu_papel() = 'administrador'
    or (
      campus_id = get_meu_campus_id()
      and get_meu_papel() in ('ord_despesas', 'licitacoes')
    )
  );

create policy "dotacoes_delete" on dotacoes
  for delete using (
    get_meu_papel() = 'administrador'
    or (
      campus_id = get_meu_campus_id()
      and get_meu_papel() = 'ord_despesas'
    )
  );

-- ── POLÍTICAS: DISTRIBUIÇÕES ─────────────────────────────────────── --
create policy "distribuicoes_select" on distribuicoes
  for select using (
    get_meu_papel() = 'administrador'
    or exists (
      select 1 from dotacoes d
      where d.id = dotacao_id and d.campus_id = get_meu_campus_id()
    )
  );

create policy "distribuicoes_insert" on distribuicoes
  for insert with check (
    get_meu_papel() = 'administrador'
    or (
      get_meu_papel() in ('ord_despesas', 'licitacoes', 'chefia')
      and exists (
        select 1 from dotacoes d
        where d.id = dotacao_id and d.campus_id = get_meu_campus_id()
      )
    )
  );

create policy "distribuicoes_delete" on distribuicoes
  for delete using (
    get_meu_papel() = 'administrador'
    or (
      get_meu_papel() in ('ord_despesas', 'licitacoes', 'chefia')
      and exists (
        select 1 from dotacoes d
        where d.id = dotacao_id and d.campus_id = get_meu_campus_id()
      )
    )
  );

-- ── POLÍTICAS: DEMANDAS ──────────────────────────────────────────── --
-- SELECT: autenticados veem o próprio campus; anon vê apenas homologadas
create policy "demandas_select" on demandas
  for select using (
    get_meu_papel() = 'administrador'
    or campus_id = get_meu_campus_id()
    or status = 'homologada'
  );

create policy "demandas_insert" on demandas
  for insert with check (
    get_meu_papel() = 'administrador'
    or (
      campus_id = get_meu_campus_id()
      and get_meu_papel() in ('chefe_secao', 'chefia', 'ord_despesas')
    )
  );

create policy "demandas_update" on demandas
  for update using (
    get_meu_papel() = 'administrador'
    or campus_id = get_meu_campus_id()
  );

create policy "demandas_delete" on demandas
  for delete using (
    get_meu_papel() = 'administrador'
    or (
      campus_id = get_meu_campus_id()
      and status = 'rascunho'
      and unidade_id = get_minha_unidade_id()
    )
  );

-- ── POLÍTICAS: HISTÓRICO ─────────────────────────────────────────── --
create policy "historico_select" on historico_demandas
  for select using (
    get_meu_papel() = 'administrador'
    or exists (
      select 1 from demandas d
      where d.id = demanda_id and d.campus_id = get_meu_campus_id()
    )
  );

create policy "historico_insert" on historico_demandas
  for insert with check (
    get_meu_papel() = 'administrador'
    or exists (
      select 1 from demandas d
      where d.id = demanda_id and d.campus_id = get_meu_campus_id()
    )
  );

-- ── GRANTS (role anon para painel público) ───────────────────────── --
grant select on campi              to anon;
grant select on unidades           to anon;
grant select on demandas           to anon;
grant execute on function sub_arvore(uuid)        to anon;
grant execute on function get_meu_campus_id()     to anon;
grant execute on function get_meu_papel()         to anon;
grant execute on function get_minha_unidade_id()  to anon;

-- ── GRANTS (role authenticated) ──────────────────────────────────── --
grant all on campi              to authenticated;
grant all on unidades           to authenticated;
grant all on usuarios           to authenticated;
grant all on dotacoes           to authenticated;
grant all on distribuicoes      to authenticated;
grant all on demandas           to authenticated;
grant all on historico_demandas to authenticated;
grant execute on function sub_arvore(uuid)        to authenticated;
grant execute on function get_meu_campus_id()     to authenticated;
grant execute on function get_meu_papel()         to authenticated;
grant execute on function get_minha_unidade_id()  to authenticated;

-- =====================================================================
-- SEED: Usuário Administrador
-- Executar APÓS criar o usuário no Supabase Auth (Authentication > Users)
-- Substitua o UUID abaixo pelo ID real do usuário criado
-- =====================================================================
-- insert into usuarios (id, campus_id, unidade_id, nome, papel, ativo, primeiro_acesso)
-- values (
--   'UUID-DO-USUARIO-ADMIN-AQUI',  -- cole o ID do Auth
--   null,                          -- admin não pertence a campus
--   null,                          -- admin não pertence a unidade
--   'Administrador PAC CPII',
--   'administrador',
--   true,
--   false  -- admin não precisa trocar senha no primeiro acesso
-- );
