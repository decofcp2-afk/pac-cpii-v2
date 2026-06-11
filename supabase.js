/* ============================================================
   PAC CPII v2 — supabase.js
   Cliente Supabase + todas as funções de dados
   ============================================================ */

// ⚠️ SUBSTITUA A ANON KEY ABAIXO
// Settings → API → Project API Keys → anon / public
const SUPABASE_URL  = 'https://fhgqixzufmgebwfffdai.supabase.co';
const SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZoZ3FpeHp1Zm1nZWJ3ZmZmZGFpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODExOTIzMzIsImV4cCI6MjA5Njc2ODMzMn0.upWS-V_1bCvk7jEJgAdJxFQKQHp5D9g6QFbR8xCX8pQ';

const { createClient } = supabase;
const db = createClient(SUPABASE_URL, SUPABASE_ANON);

/* ── Helpers internos ──────────────────────────────────────── */
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

/* ── Unidades ──────────────────────────────────────────────── */
async function listarUnidadesDoCampus(campusId) {
  return _check(await db
    .from('unidades')
    .select('*, parent:unidades!parent_id(id,nome,sigla)')
    .eq('campus_id', campusId)
    .order('nome'));
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

/* Sub-árvore completa: retorna todos os descendentes de uma unidade */
async function listarSubArvore(unidadeId, campusId) {
  const todas = await listarUnidadesDoCampus(campusId);
  function coletarDescendentes(parentId) {
    const filhos = todas.filter(u => u.parent_id === parentId);
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
  // dados: { id (auth uid), campus_id, unidade_id, nome, papel }
  return _check(await db.from('usuarios').insert(dados).select().single());
}

async function atualizarUsuario(id, dados) {
  return _check(await db.from('usuarios').update(dados).eq('id', id).select().single());
}

/* ── Dotações ──────────────────────────────────────────────── */
async function listarDotacoes(campusId, exercicio) {
  let q = db
    .from('dotacoes')
    .select('*')
    .eq('campus_id', campusId);
  if (exercicio) q = q.eq('exercicio', exercicio);
  return _check(await q.order('criado_em', { ascending: false }));
}

async function criarDotacao(dados) {
  return _check(await db.from('dotacoes').insert(dados).select().single());
}

async function atualizarDotacao(id, dados) {
  return _check(await db.from('dotacoes').update(dados).eq('id', id).select().single());
}

async function excluirDotacao(id) {
  return _check(await db.from('dotacoes').delete().eq('id', id));
}

/* ── Distribuições ────────────────────────────────────────── */
async function listarDistribuicoes(campusId, exercicio) {
  // campus_id não existe em distribuicoes — RLS já filtra pelo campus via dotacoes
  return _check(await db
    .from('distribuicoes')
    .select('*, dotacao:dotacoes(id,descricao,valor_total), unidade:unidades!unidade_id(id,nome,sigla)')
    .order('criado_em', { ascending: false }));
}

async function criarDistribuicao(dados) {
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
async function listarDemandasDaUnidade(unidadeId, exercicio, status) {
  let q = db
    .from('demandas')
    .select('*, unidade:unidades(id,nome,sigla), criador:usuarios!criado_por(id,nome)')
    .eq('unidade_id', unidadeId);
  if (exercicio) q = q.eq('exercicio', exercicio);
  if (status)    q = q.eq('status', status);
  return _check(await q.order('criado_em', { ascending: false }));
}

async function listarDemandasDoCampus(campusId, exercicio, status) {
  let q = db
    .from('demandas')
    .select('*, unidade:unidades(id,nome,sigla), criador:usuarios!criado_por(id,nome)')
    .eq('campus_id', campusId);
  if (exercicio) q = q.eq('exercicio', exercicio);
  if (status)    q = q.eq('status', status);
  return _check(await q.order('gut_prioridade').order('criado_em', { ascending: false }));
}

async function listarDemandasParaAprovacao(unidadesIds, exercicio) {
  // Demandas submetidas de unidades filhas diretas
  let q = db
    .from('demandas')
    .select('*, unidade:unidades(id,nome,sigla), criador:usuarios!criado_por(id,nome)')
    .in('unidade_id', unidadesIds)
    .eq('status', 'submetida');
  if (exercicio) q = q.eq('exercicio', exercicio);
  return _check(await q.order('criado_em'));
}

async function listarDemandasHomologadas(campusId, exercicio) {
  let q = db
    .from('demandas')
    .select('*, unidade:unidades(id,nome,sigla)')
    .eq('campus_id', campusId)
    .eq('status', 'homologada');
  if (exercicio) q = q.eq('exercicio', exercicio);
  return _check(await q.order('gut_prioridade'));
}

async function getDemanda(id) {
  return _check(await db
    .from('demandas')
    .select('*, unidade:unidades(id,nome,sigla), criador:usuarios!criado_por(id,nome)')
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

/* ── Aprovações / histórico ────────────────────────────────── */
async function registrarAprovacao(dados) {
  // dados: { demanda_id, usuario_id, acao, justificativa? }
  return _check(await db.from('historico_demandas').insert(dados).select().single());
}

async function listarHistorico(demandaId) {
  return _check(await db
    .from('historico_demandas')
    .select('*, usuario:usuarios(id,nome,papel)')
    .eq('demanda_id', demandaId)
    .order('criado_em'));
}

/* ── Ações de workflow ─────────────────────────────────────── */

/* Enviar demanda (rascunho → submetida) */
async function enviarDemanda(demandaId, usuarioId) {
  await atualizarDemanda(demandaId, { status: 'submetida' });
  await registrarAprovacao({ demanda_id: demandaId, usuario_id: usuarioId, acao: 'envio' });
}

/* Aprovar demanda (submetida → de_acordo) */
async function aprovarDemanda(demandaId, usuarioId) {
  await atualizarDemanda(demandaId, { status: 'de_acordo' });
  await registrarAprovacao({ demanda_id: demandaId, usuario_id: usuarioId, acao: 'aprovacao' });
}

/* Reprovar demanda (submetida → reprovada) */
async function reprovarDemanda(demandaId, usuarioId, justificativa) {
  await atualizarDemanda(demandaId, { status: 'reprovada' });
  await registrarAprovacao({ demanda_id: demandaId, usuario_id: usuarioId, acao: 'reprovacao', justificativa });
}

/* Salvar GUT e priorizar demandas */
async function salvarGut(demandaId, g, u, t, prioridade, usuarioId) {
  await atualizarDemanda(demandaId, { gut_g: g, gut_u: u, gut_t: t, gut_prioridade: prioridade, status: 'priorizada' });
  await registrarAprovacao({ demanda_id: demandaId, usuario_id: usuarioId, acao: 'priorizacao' });
}

/* Homologar todas as demandas priorizadas do campus/exercício */
async function homologarPlano(campusId, exercicio, usuarioId) {
  const demandas = await listarDemandasDoCampus(campusId, exercicio, 'priorizada');
  for (const d of demandas) {
    await atualizarDemanda(d.id, { status: 'homologada' });
    await registrarAprovacao({ demanda_id: d.id, usuario_id: usuarioId, acao: 'homologacao' });
  }
  return demandas.length;
}

/* Reverter status (licitacoes/admin) */
async function reverterDemanda(demandaId, novoStatus, usuarioId, justificativa) {
  await atualizarDemanda(demandaId, { status: novoStatus });
  await registrarAprovacao({ demanda_id: demandaId, usuario_id: usuarioId, acao: 'reversao', justificativa });
}

/* ── Painel público ────────────────────────────────────────── */
async function listarCampiPublico() {
  return _check(await db.from('campi').select('id,nome,sigla').order('nome'));
}

/* Conta unidades por campus (para admin) */
async function contarUnidadesPorCampus() {
  const { data, error } = await db.from('unidades').select('campus_id');
  if (error) throw error;
  const counts = {};
  data.forEach(function (u) {
    counts[u.campus_id] = (counts[u.campus_id] || 0) + 1;
  });
  return counts;
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
