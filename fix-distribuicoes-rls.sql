-- =====================================================================
-- CORREÇÃO RLS — Permitir que chefias intermediárias distribuam orçamento
-- Tabela: distribuicoes
-- Problema: a política de INSERT só autorizava 'ord_despesas' e 'licitacoes',
--           então uma 'chefia' (ex.: Pró-Reitoria recebendo verba da Reitoria)
--           recebia: "new row violates row-level security policy".
-- Solução: incluir o papel 'chefia' nas políticas de INSERT e DELETE.
-- Executar no Supabase SQL Editor (uma única vez).
-- =====================================================================

drop policy if exists "distribuicoes_insert" on distribuicoes;
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

drop policy if exists "distribuicoes_delete" on distribuicoes;
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

-- Verificação (opcional): listar as políticas da tabela após aplicar
-- select polname, cmd from pg_policies where tablename = 'distribuicoes';
