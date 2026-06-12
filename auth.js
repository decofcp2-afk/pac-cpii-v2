/* ============================================================
   PAC CPII v2 — auth.js
   Sessão, guards por papel, redirecionamentos
   ============================================================ */

// Mapa: papel → página inicial após login
const HOME_POR_PAPEL = {
  administrador: 'admin.html',
  ord_despesas:  'dashboard.html',
  chefia:        'dashboard.html',
  chefe_secao:   'demandas.html',
  licitacoes:    'dashboard.html',
};

// Páginas públicas (não exigem login)
const PAGINAS_PUBLICAS = ['login.html', 'publico.html', 'index.html', ''];

let _perfil = null; // cache do perfil na sessão

/* ── Aguardar sessão inicial do Supabase ───────────────────── */
// onAuthStateChange com INITIAL_SESSION é garantido pelo Supabase v2
// para disparar mesmo para assinantes tardios, eliminando race conditions.
function _aguardarSessaoInicial() {
  return new Promise(function (resolve) {
    console.log('[auth] aguardando INITIAL_SESSION...');
    var sub = db.auth.onAuthStateChange(function (event, session) {
      console.log('[auth] evento:', event, 'sessao:', session ? 'presente' : 'null');
      if (event === 'INITIAL_SESSION') {
        console.log('[auth] INITIAL_SESSION recebido, resolvendo promise');
        resolve(session);
        // Unsubscribe adiado para evitar race condition se evento for síncrono
        setTimeout(function() {
          if (sub && sub.data && sub.data.subscription) {
            sub.data.subscription.unsubscribe();
          }
        }, 0);
      }
    });
    console.log('[auth] subscriber registrado');
  });
}

/* ── Inicializar autenticação ──────────────────────────────── */
async function initAuth(papeis) {
  // papeis: array de papéis permitidos na página (undefined = qualquer logado)
  const page = location.pathname.split('/').pop() || 'index.html';
  console.log('[auth] initAuth chamado, page:', page);

  // Páginas públicas: não verificar
  if (PAGINAS_PUBLICAS.includes(page)) {
    console.log('[auth] página pública, retornando null');
    return null;
  }

  // Aguardar Supabase restaurar sessão do localStorage (INITIAL_SESSION).
  // Isso resolve o race condition entre a inicialização do auth client
  // e a execução da IIFE da página no carregamento.
  const sessao = await _aguardarSessaoInicial();
  console.log('[auth] sessão após INITIAL_SESSION:', sessao ? 'presente' : 'null');

  if (!sessao) {
    console.log('[auth] sem sessão, redirecionando para login');
    location.href = 'login.html';
    return null;
  }

  // Com sessão válida, buscar perfil completo do banco
  try {
    console.log('[auth] buscando perfil...');
    _perfil = await getMeuPerfil();
    console.log('[auth] perfil:', _perfil ? _perfil.papel : 'null');
  } catch (e) {
    console.log('[auth] erro ao buscar perfil:', e.message);
    location.href = 'login.html';
    return null;
  }

  if (!_perfil) {
    console.log('[auth] perfil null, redirecionando');
    location.href = 'login.html';
    return null;
  }

  if (!_perfil.ativo) {
    await signOut();
    location.href = 'login.html?erro=inativo';
    return null;
  }

  // Primeiro acesso: forçar troca de senha
  if (_perfil.primeiro_acesso && page !== 'trocar-senha.html') {
    location.href = 'trocar-senha.html';
    return null;
  }

  // Verificar papel permitido
  if (papeis && !papeis.includes(_perfil.papel)) {
    console.log('[auth] papel não permitido:', _perfil.papel, 'esperado:', papeis);
    location.href = HOME_POR_PAPEL[_perfil.papel] || 'login.html';
    return null;
  }

  // Preencher header
  console.log('[auth] preenchendo header e retornando perfil');
  preencherHeader(_perfil);

  return _perfil;
}

/* ── Preencher header ──────────────────────────────────────── */
function preencherHeader(perfil) {
  const elNome   = document.getElementById('header-nome');
  const elCampus = document.getElementById('header-campus');
  const elPapel  = document.getElementById('header-papel');

  if (elNome)   elNome.textContent   = perfil.nome;
  if (elCampus) elCampus.textContent = perfil.campus ? perfil.campus.sigla : 'Admin';
  if (elPapel)  elPapel.textContent  = formatarPapel(perfil.papel);

  const btnLogout = document.getElementById('btn-logout');
  if (btnLogout) btnLogout.addEventListener('click', doLogout);
}

function formatarPapel(papel) {
  const map = {
    administrador: 'Administrador',
    ord_despesas:  'Ordenador de Despesas',
    chefia:        'Chefia',
    chefe_secao:   'Chefe de Seção',
    licitacoes:    'Licitações',
  };
  return map[papel] || papel;
}

/* ── Logout ────────────────────────────────────────────────── */
async function doLogout() {
  await signOut();
  _perfil = null;
  location.href = 'login.html';
}

/* ── Obter perfil cacheado ─────────────────────────────────── */
function getPerfil() { return _perfil; }

/* ── Verificar acesso admin/licitacoes ─────────────────────── */
function isAdmin() { return _perfil && _perfil.papel === 'administrador'; }
function isLicitacoes() { return _perfil && (_perfil.papel === 'licitacoes' || _perfil.papel === 'administrador'); }
function isOrdenador() { return _perfil && (_perfil.papel === 'ord_despesas' || isLicitacoes()); }
function isChefia() { return _perfil && (_perfil.papel === 'chefia' || isOrdenador()); }

/* ── Verificar senha do usuário logado (para confirmações) ─── */
async function verificarSenha(senha) {
  if (!_perfil) return false;
  try {
    const user = await getUser();
    const { error } = await db.auth.signInWithPassword({
      email: user.email,
      password: senha
    });
    return !error;
  } catch {
    return false;
  }
}

/* ── Construir sidebar de acordo com o papel ───────────────── */
function buildSidebar(perfil) {
  const nav = document.getElementById('sidebar-nav');
  if (!nav) return;

  const papel = perfil.papel;

  const items = [];

  if (papel === 'administrador') {
    items.push({ href: 'admin.html',    icon: '⚙️', label: 'Administração' });
  }

  if (['ord_despesas','chefia','licitacoes'].includes(papel)) {
    items.push({ href: 'dashboard.html',   icon: '📊', label: 'Dashboard' });
    items.push({ href: 'orcamento.html',   icon: '💰', label: 'Orçamento' });
  }

  if (['ord_despesas','chefia','licitacoes'].includes(papel)) {
    items.push({ href: 'demandas.html',    icon: '📋', label: 'Demandas' });
  }

  if (papel === 'chefe_secao') {
    items.push({ href: 'demandas.html',    icon: '📋', label: 'Minhas Demandas' });
  }

  if (['chefia','ord_despesas','licitacoes'].includes(papel)) {
    items.push({ href: 'aprovacoes.html',  icon: '✅', label: 'Aprovações' });
  }

  if (['ord_despesas','licitacoes'].includes(papel)) {
    items.push({ href: 'prioridades.html', icon: '🎯', label: 'Prioridades (GUT)' });
    items.push({ href: 'homologacao.html', icon: '🏛️', label: 'Homologação' });
  }

  if (['ord_despesas','licitacoes'].includes(papel)) {
    items.push({ href: 'usuarios.html',    icon: '👥', label: 'Usuários' });
  }

  items.push({ href: 'publico.html', icon: '🌐', label: 'Painel Público', separator: true });

  let html = '';
  items.forEach(function (it) {
    if (it.separator) html += '<div class="sidebar-section">Consulta</div>';
    html += `<a href="${it.href}"><span class="nav-icon">${it.icon}</span>${it.label}</a>`;
  });

  nav.innerHTML = html;
  highlightActiveNav();
}
