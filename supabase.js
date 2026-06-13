/* ============================================================
   PAC CPII v2 — supabase.js
   Cliente Supabase + todas as funções de dados
   ============================================================ */

const SUPABASE_URL  = 'https://fhgqixzufmgebwfffdai.supabase.co';
const SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZoZ3FpeHp1Zm1nZWJ3ZmZmZGFpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODExOTIzMzIsImV4cCI6MjA5Njc2ODMzMn0.upWS-V_1bCvk7jEJgAdJxFQKQHp5D9g6QFbR8xCX8pQ';

const { createClient } = supabase;
const db = createClient(SUPABASE_URL, SUPABASE_ANON, {
  auth: { detectSessionInUrl: false, persistSession: true, autoRefreshToken: true }
});

/* ── Helpers ───────────────────────────────────────────────── */
async function _check(res) {
  if (res.error) throw res.error;
  return res.data;
}

/* ── Auth ──────────────────────────────────────────────────── */
async function signIn(email, senha) {
  const { data, error } = await db.auth.signInWithPassword({ email, password: senha });
  if (error) throw error;
  return data;
}

async function signOut() {
  await db.auth.signOut();
}

async function getUser() {
  const { data: { user } } = await db.auth.getUser();
  return user;
}

async function getSession() {
  const { data: { session } } = await db.auth.getSession();
  return session;
}

async function updatePassword(novaSenha) {
  const { error } = await db.auth.updateUser({ password: novaSenha });
  if (error) throw error;
}

/* Perfil completo do usuário logado (inclui campus e unidade) */
async function getMeuPerfil() {
  const user = await getUser();
  if (!user) return null;
  const { data, error } = await db
    .from('usuarios')
    .select('*, campus:campi(*), unidade:unidades(*)')
    .eq('id', user.id)
    .single();
  if (error) throw error;
  return data;
}

/* Marcar primeiro_acesso = false */
async function marcarPrimeiroAcessoConcluido(userId) {
  await _check(await db.from('usuarios').update({ primeiro_acesso: false }).eq('id', userId));
}

/* ── Campi ─────────────────────────────────────────────────── */
async function listarCampi() {
  return _check(await db.from('campi').select('*').order('nome'));
}

async function criarCampus(dados) {
  return _check(await db.from('campi').insert(dados).select().single());
}

async function atualizarCampus(id, dados) {
  return _check(await db.from('campi').update(dados).eq('id', id).select().single());
}

/* Contar unidades por campus — retorna { [campus_id]: count } */
async function contarUnidadesPorCampus() {
  const { data, error } = await db.from('unidades').select('campus_id');
  if (error) throw error;
  const counts = {};
  (data || []).forEach(function (u) {
    counts[u.campus_id] = (counts[u.campus_id] || 0) + 1;
  });
  return counts;
}

/* ── Unidades ──────────────────────────────────────────────── */
/*
 * A tabela 'unidades' NÃO possui coluna 'ativo'.
 * Schema: id, campus_id, parent_id, nome, sigla, tipo, criado_em
 */
async function listarUnidadesDoCampus(campusId) {
  // Resolvemos o "pai" em JS. O embed PostgREST (unidades!parent_id) numa
  // auto-relação retorna a direção inversa (filhos), o que quebrava a coluna
  // "Unidade pai". Aqui mapeamos por id e anexamos o objeto pai correto.
  const data = await _check(await db
    .from('unidades')
    .select('*')
    .eq('campus_id', campusId)
    .order('nome'));
  const porId = {};
  data.forEach(function (u) { porId[u.id] = u; });
  data.forEach(function (u) {
    const pai = u.parent_id ? porId[u.parent_id] : null;
    u.parent = pai ? { id: pai.id, nome: pai.nome, sigla: pai.sigla } : null;
  });
  return data;
}

async function criarUnidade(dados) {
  return _check(await db.from('unidades').insert(dados).select().single());
}

async function atualizarUnidade(id, dados) {
  return _check(await db.from('unidades').update(dados).eq('id', id).select().single());
}

/* Filhos diretos de uma unidade */
async function listarFilhosDiretos(parentId) {
  return _check(await db
    .from('unidades')
    .select('*')
    .eq('parent_id', parentId)
    .order('nome'));
}

/* Sub-árvore completa: todos os descendentes de uma unidade */
async function listarSubArvore(unidadeId, campusId) {
  const todas = await listarUnidadesDoCampus(campusId);
  function coletarDescendentes(parentId) {
    const filhos = todas.filter(function (u) { return u.parent_id === parentId; });
    return filhos.reduce(function (acc, f) {
      return acc.concat([f], coletarDescendentes(f.id));
    }, []);
  }
  return coletarDescendentes(unidadeId);
}

/* ── Usuários ──────────────────────────────────────────────── */
async function listarUsuariosDoCampus(campusId) {
  return _check(await db
    .from('usuarios')
    .select('*, unidade:unidades(id,nome,sigla)')
    .eq('campus_id', campusId)
    .order('nome'));
}

async function listarTodosUsuarios() {
  return _check(await db
    .from('usuarios')
    .select('*, campus:campi(id,nome,sigla), unidade:unidades(id,nome,sigla)')
    .order('nome'));
}

async function criarUsuarioNoBanco(dados) {
  /* dados: { id (auth uid), campus_id, unidade_id, nome, papel } */
  return _check(await db.from('usuarios').insert(dados).select().single());
}

async function atualizarUsuario(id, dados) {
  return _check(await db.from('usuarios').update(dados).eq('id', id).select().single());
}

/* ── Dotações ──────────────────────────────────────────────── */
/*
 * Schema: id, campus_id, exercicio, valor_total, descricao, criado_em
 * NÃO tem: categoria, unidade_id
 */
async function listarDotacoes(campusId, exercicio) {
  let q = db
    .from('dotacoes')
    .select('*')
    .eq('campus_id', campusId);
  if (exercicio) q = q.eq('exercicio', exercicio);
  return _check(await q.order('criado_em', { ascending: false }));
}

async function criarDotacao(dados) {
  /* dados: { campus_id, exercicio, descricao, valor_total } */
  return _check(await db.from('dotacoes').insert(dados).select().single());
}

async function atualizarDotacao(id, dados) {
  return _check(await db.from('dotacoes').update(dados).eq('id', id).select().single());
}

async function excluirDotacao(id) {
  return _check(await db.from('dotacoes').delete().eq('id', id));
}

/* ── Distribuições ─────────────────────────────────────────── */
/*
 * Schema: id, dotacao_id, unidade_id, valor, criado_em
 * NÃO tem: campus_id, unidade_destino_id
 * dotacoes NÃO tem: categoria, unidade_id — tem: descricao
 */
async function listarDistribuicoes(campusId, exercicio) {
  const all = await _check(await db
    .from('distribuicoes')
    .select('*, dotacao:dotacoes(id,descricao,valor_total,campus_id,exercicio), unidade:unidades!unidade_id(id,nome,sigla)')
    .order('criado_em', { ascending: false }));
  let filtered = all;
  if (campusId)  filtered = filtered.filter(d => d.dotacao && d.dotacao.campus_id === campusId);
  if (exercicio) filtered = filtered.filter(d => d.dotacao && d.dotacao.exercicio === parseInt(exercicio));
  return filtered;
}

async function criarDistribuicao(dados) {
  /* dados: { dotacao_id, unidade_id, valor } */
  return _check(await db.from('distribuicoes').insert(dados).select().single());
}

async function excluirDistribuicao(id) {
  return _check(await db.from('distribuicoes').delete().eq('id', id));
}

/* Saldo disponível de uma dotação */
async function calcularSaldo(dotacaoId) {
  const [dotacao, dists] = await Promise.all([
    _check(await db.from('dotacoes').select('valor_total').eq('id', dotacaoId).single()),
    _check(await db.from('distribuicoes').select('valor').eq('dotacao_id', dotacaoId))
  ]);
  const distribuido = dists.reduce(function (s, d) { return s + Number(d.valor); }, 0);
  return { total: Number(dotacao.valor_total), distribuido, saldo: Number(dotacao.valor_total) - distribuido };
}

/* ── Demandas ──────────────────────────────────────────────── */
/*
 * demandas.criado_por → auth.users(id)  (FK NÃO aponta para usuarios)
 * Por isso NÃO é possível fazer join demandas → usuarios pelo criado_por via PostgREST.
 * Todos os selects abaixo omitem o criador.
 */

async function listarDemandasDaUnidade(unidadeId, exercicio, status) {
  let q = db
    .from('demandas')
    .select('*, unidade:unidades(id,nome,sigla)')
    .eq('unidade_id', unidadeId);
  if (exercicio) q = q.eq('exercicio', exercicio);
  if (status)    q = q.eq('status', status);
  return _check(await q.order('criado_em', { ascending: false }));
}

async function listarDemandasDoCampus(campusId, exercicio, status) {
  let q = db
    .from('demandas')
    .select('*, unidade:unidades(id,nome,sigla)');
  if (campusId)  q = q.eq('campus_id', campusId);
  if (exercicio) q = q.eq('exercicio', exercicio);
  if (status)    q = q.eq('status', status);
  return _check(await q.order('gut_prioridade').order('criado_em', { ascending: false }));
}

/* Para admin: lista todas as demandas sem filtro de campus */
async function listarTodasDemandas(exercicio, status) {
  let q = db
    .from('demandas')
    .select('*, unidade:unidades(id,nome,sigla), campus:campi(id,nome,sigla)');
  if (exercicio) q = q.eq('exercicio', exercicio);
  if (status)    q = q.eq('status', status);
  return _check(await q.order('criado_em', { ascending: false }));
}

async function listarDemandasParaAprovacao(unidadesIds, exercicio) {
  let q = db
    .from('demandas')
    .select('*, unidade:unidades(id,nome,sigla)')
    .in('unidade_id', unidadesIds)
    .eq('status', 'submetida');
  if (exercicio) q = q.eq('exercicio', exercicio);
  return _check(await q.order('criado_em'));
}

async function listarDemandasHomologadas(campusId, exercicio) {
  let q = db
    .from('demandas')
    .select('*, unidade:unidades(id,nome,sigla)')
    .eq('status', 'homologada');
  if (campusId)  q = q.eq('campus_id', campusId);
  if (exercicio) q = q.eq('exercicio', exercicio);
  return _check(await q.order('gut_prioridade'));
}

async function getDemanda(id) {
  return _check(await db
    .from('demandas')
    .select('*, unidade:unidades(id,nome,sigla)')
    .eq('id', id)
    .single());
}

async function criarDemanda(dados) {
  return _check(await db.from('demandas').insert(dados).select().single());
}

async function atualizarDemanda(id, dados) {
  dados.atualizado_em = new Date().toISOString();
  return _check(await db.from('demandas').update(dados).eq('id', id).select().single());
}

async function excluirDemanda(id) {
  return _check(await db.from('demandas').delete().eq('id', id));
}

/* ── Histórico (tabela: historico_demandas) ────────────────── */
/*
 * historico_demandas.usuario_id → auth.users(id)  (FK NÃO aponta para usuarios)
 * Solução: buscar histórico sem join e depois resolver nomes manualmente.
 *
 * Enum acao_historico válidos:
 * criacao | envio | aprovacao | reprovacao | priorizacao | homologacao | reversao | edicao
 */

async function registrarHistorico(dados) {
  /* dados: { demanda_id, usuario_id, acao, status_anterior?, status_novo?, justificativa? } */
  return _check(await db.from('historico_demandas').insert(dados).select().single());
}

async function listarHistorico(demandaId) {
  const historico = await _check(await db
    .from('historico_demandas')
    .select('*')
    .eq('demanda_id', demandaId)
    .order('criado_em'));

  /* Resolver nomes dos usuários via join manual em JS */
  const ids = [...new Set(historico.map(function (h) { return h.usuario_id; }).filter(Boolean))];
  if (ids.length > 0) {
    const { data: usuarios } = await db.from('usuarios').select('id,nome,papel').in('id', ids);
    const mapa = {};
    (usuarios || []).forEach(function (u) { mapa[u.id] = u; });
    historico.forEach(function (h) { h.usuario = mapa[h.usuario_id] || null; });
  } else {
    historico.forEach(function (h) { h.usuario = null; });
  }
  return historico;
}

/* ── Ações de workflow ─────────────────────────────────────── */

/* Enviar demanda (rascunho → submetida) */
async function enviarDemanda(demandaId, usuarioId) {
  const d = await getDemanda(demandaId);
  await atualizarDemanda(demandaId, { status: 'submetida' });
  await registrarHistorico({
    demanda_id: demandaId, usuario_id: usuarioId,
    acao: 'envio', status_anterior: d.status, status_novo: 'submetida'
  });
}

/* Aprovar demanda (submetida → de_acordo) */
async function aprovarDemanda(demandaId, usuarioId) {
  const d = await getDemanda(demandaId);
  await atualizarDemanda(demandaId, { status: 'de_acordo' });
  await registrarHistorico({
    demanda_id: demandaId, usuario_id: usuarioId,
    acao: 'aprovacao', status_anterior: d.status, status_novo: 'de_acordo'
  });
}

/* Reprovar demanda (→ reprovada) */
async function reprovarDemanda(demandaId, usuarioId, justificativa) {
  const d = await getDemanda(demandaId);
  await atualizarDemanda(demandaId, { status: 'reprovada' });
  await registrarHistorico({
    demanda_id: demandaId, usuario_id: usuarioId,
    acao: 'reprovacao', status_anterior: d.status, status_novo: 'reprovada',
    justificativa: justificativa
  });
}

/* Salvar GUT e priorizar (de_acordo → priorizada) */
async function salvarGut(demandaId, g, u, t, prioridade, usuarioId) {
  const d = await getDemanda(demandaId);
  await atualizarDemanda(demandaId, {
    gut_g: g, gut_u: u, gut_t: t, gut_prioridade: prioridade, status: 'priorizada'
  });
  await registrarHistorico({
    demanda_id: demandaId, usuario_id: usuarioId,
    acao: 'priorizacao', status_anterior: d.status, status_novo: 'priorizada'
  });
}

/* Homologar todas as demandas priorizadas do campus/exercício */
async function homologarPlano(campusId, exercicio, usuarioId) {
  const demandas = await listarDemandasDoCampus(campusId, exercicio, 'priorizada');
  for (const d of demandas) {
    await atualizarDemanda(d.id, { status: 'homologada' });
    await registrarHistorico({
      demanda_id: d.id, usuario_id: usuarioId,
      acao: 'homologacao', status_anterior: 'priorizada', status_novo: 'homologada'
    });
  }
  return demandas.length;
}

/* Reverter status (licitacoes/admin) */
async function reverterDemanda(demandaId, novoStatus, usuarioId, justificativa) {
  const d = await getDemanda(demandaId);
  await atualizarDemanda(demandaId, { status: novoStatus });
  await registrarHistorico({
    demanda_id: demandaId, usuario_id: usuarioId,
    acao: 'reversao', status_anterior: d.status, status_novo: novoStatus,
    justificativa: justificativa
  });
}

/* ── Painel público ────────────────────────────────────────── */
async function listarCampiPublico() {
  return _check(await db.from('campi').select('id,nome,sigla').order('nome'));
}

async function listarExerciciosPublicos(campusId) {
  const { data, error } = await db
    .from('demandas')
    .select('exercicio')
    .eq('campus_id', campusId)
    .eq('status', 'homologada');
  if (error) throw error;
  const anos = [...new Set(data.map(function (d) { return d.exercicio; }))].sort(function (a, b) { return b - a; });
  return anos;
}
