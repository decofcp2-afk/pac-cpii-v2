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

let _perfil = null;

/* ── Inicializar autenticação ──────────────────────────────── */
async function initAuth(papeis) {
  const page = location.pathname.split('/').pop() || 'index.html';
  if (PAGINAS_PUBLICAS.includes(page)) return null;

  // FIX: aguardar a inicialização do cliente Supabase antes de ler localStorage
  // Sem isso, o cliente pode estar escrevendo no localStorage ao mesmo tempo
  // que tentamos lê-lo, causando travamento indefinido no IIFE da página
  if (window._sessaoPromise) await window._sessaoPromise;

  let accessToken = null;
  let userId = null;
  try {
    var lsKey = 'sb-' + SUPABASE_URL.match(/\/\/([^.]+)\./)[1] + '-auth-token';
    var lsRaw = localStorage.getItem(lsKey);
    if (lsRaw) {
      var lsData = JSON.parse(lsRaw);
      var agora = Math.floor(Date.now() / 1000);
      if (lsData && lsData.access_token && lsData.expires_at > agora) {
        accessToken = lsData.access_token;
        userId = lsData.user && lsData.user.id;
      }
    }
  } catch (e) { /* ignora */ }

  if (!accessToken || !userId) {
    location.href = 'login.html';
    return null;
  }

  try {
    var resp = await fetch(
      SUPABASE_URL + '/rest/v1/usuarios?select=*,campus:campi(*),unidade:unidades(*)&id=eq.' + userId,
      {
        headers: {
          'apikey': SUPABASE_ANON,
          'Authorization': 'Bearer ' + accessToken,
          'Content-Type': 'application/json'
        }
      }
    );
    var rows = await resp.json();
    _perfil = rows && rows[0] ? rows[0] : null;
  } catch (e) {
    location.href = 'login.html';
    return null;
  }

  if (!_perfil) { location.href = 'login.html'; return null; }
  if (!_perfil.ativo) { await signOut(); location.href = 'login.html?erro=inativo'; return null; }
  if (_perfil.primeiro_acesso && page !== 'trocar-senha.html') { location.href = 'trocar-senha.html'; return null; }
  if (papeis && !papeis.includes(_perfil.papel)) { location.href = HOME_POR_PAPEL[_perfil.papel] || 'login.html'; return null; }

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
function isAdmin()     { return _perfil && _perfil.papel === 'administrador'; }
function isLicitacoes(){ return _perfil && (_perfil.papel === 'licitacoes' || _perfil.papel === 'administrador'); }
function isOrdenador() { return _perfil && (_perfil.papel === 'ord_despesas' || isLicitacoes()); }
function isChefia()    { return _perfil && (_perfil.papel === 'chefia' || isOrdenador()); }

/* ── Verificar senha do usuário logado ─────────────────────── */
async function verificarSenha(senha) {
  if (!_perfil) return false;
  try {
    const user = await getUser();
    const { error } = await db.auth.signInWithPassword({ email: user.email, password: senha });
    return !error;
  } catch { return false; }
}

/* ── Construir sidebar ─────────────────────────────────────── */
function buildSidebar(perfil) {
  const nav = document.getElementById('sidebar-nav');
  if (!nav) return;

  const papel = perfil.papel;
  const items = [];

  if (papel === 'administrador') items.push({ href: 'admin.html', icon: '⚙️', label: 'Administração' });

  if (['ord_despesas','chefia','licitacoes'].includes(papel)) {
    items.push({ href: 'dashboard.html', icon: '📊', label: 'Dashboard' });
    items.push({ href: 'orcamento.html', icon: '💰', label: 'Orçamento' });
    items.push({ href: 'demandas.html',  icon: '📋', label: 'Demandas' });
  }

  if (papel === 'chefe_secao') items.push({ href: 'demandas.html', icon: '📋', label: 'Minhas Demandas' });

  if (['chefia','ord_despesas','licitacoes'].includes(papel))
    items.push({ href: 'aprovacoes.html', icon: '✅', label: 'Aprovações' });

  if (['ord_despesas','licitacoes'].includes(papel)) {
    items.push({ href: 'prioridades.html', icon: '🎯', label: 'Prioridades (GUT)' });
    items.push({ href: 'homologacao.html', icon: '🏛️', label: 'Homologação' });
    items.push({ href: 'usuarios.html',    icon: '👥', label: 'Usuários' });
  }

  items.push({ href: 'publico.html', icon: '🌐', label: 'Painel Público', separator: true });

  let html = '';
  items.forEach(function (it) {
    if (it.separator) html += '<div class="sidebar-section">Consulta</div>';
    html += '<a href="' + it.href + '"><span class="nav-icon">' + it.icon + '</span>' + it.label + '</a>';
  });

  nav.innerHTML = html;
  highlightActiveNav();
       }
