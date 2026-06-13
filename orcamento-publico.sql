-- =====================================================================
-- PAC CPII v2 — Leitura pública do orçamento (transparência)
-- Executar UMA vez no Supabase: SQL Editor > New query > Run
-- Permite que o Painel Público (não autenticado) leia dotações e
-- distribuições para exibir o gráfico de distribuição e os saldos.
-- (A escrita continua restrita pelas políticas existentes.)
-- =====================================================================

grant select on dotacoes      to anon;
grant select on distribuicoes to anon;

drop policy if exists "dotacoes_select_publico" on dotacoes;
create policy "dotacoes_select_publico" on dotacoes
  for select using (true);

drop policy if exists "distribuicoes_select_publico" on distribuicoes;
create policy "distribuicoes_select_publico" on distribuicoes
  for select using (true);
