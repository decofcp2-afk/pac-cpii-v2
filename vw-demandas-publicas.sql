-- =====================================================================
-- PAC CPII v2 — View pública de demandas (transparência)
-- Executar UMA vez no Supabase: SQL Editor > New query > Run
--
-- Expõe ao Painel Público (anon) as demandas HOMOLOGADAS e REJEITADAS,
-- indicando a chefia que deu o "de acordo" e, nas rejeitadas, o motivo
-- e quem reprovou. A view roda com os privilégios do dono (postgres),
-- então lê historico_demandas e usuarios sem violar o RLS dessas tabelas;
-- o acesso externo fica limitado às colunas e linhas abaixo.
-- =====================================================================

create or replace view vw_demandas_publicas as
select
  d.id,
  d.campus_id,
  d.exercicio,
  d.status,
  d.unidade_id,
  un.sigla as unidade_sigla,
  un.nome  as unidade_nome,
  d.descricao_objeto,
  d.justificativa,
  d.quantidade,
  d.unidade_medida,
  d.valor_estimado,
  d.gut_total,
  d.gut_prioridade,
  d.gestor_titular_nome,
  d.gestor_titular_siape,
  d.fiscal_titular_nome,
  d.fiscal_titular_siape,
  ap.nome          as de_acordo_por,
  ap.criado_em     as de_acordo_em,
  rp.nome          as reprovado_por,
  rp.justificativa as motivo_reprovacao,
  rp.criado_em     as reprovado_em
from demandas d
left join unidades un on un.id = d.unidade_id
left join lateral (
  select u.nome, h.criado_em
  from historico_demandas h
  join usuarios u on u.id = h.usuario_id
  where h.demanda_id = d.id and h.acao = 'aprovacao'
  order by h.criado_em desc
  limit 1
) ap on true
left join lateral (
  select u.nome, h.justificativa, h.criado_em
  from historico_demandas h
  join usuarios u on u.id = h.usuario_id
  where h.demanda_id = d.id and h.acao = 'reprovacao'
  order by h.criado_em desc
  limit 1
) rp on true
where d.status in ('homologada', 'reprovada');

grant select on vw_demandas_publicas to anon, authenticated;
