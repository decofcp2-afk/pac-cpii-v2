/* ============================================================
   PAC CPII v2 — auth.js v2
   Sessão, guards por papel, redirecionamentos
   ============================================================ */

const HOME_POR_PAPEL = {
  administrador: 'admin.html',
  ord_despesas:  'dashboard.html',
  chefia:        'dashboard.html',
  chefe_secao:   'demandas.html',
  licitacoes:    'dashboard.html',
};

const PAGINAS_PUBLICAS = ['login.html', 'publico.html', 'index.html', ''];

let _perfil = null;

/* ── Inicializar autenticação ──────────────────────────────── */
async function initAuth(papeis) {
  const page = location.pathname.split('/').pop() || 'index.html';
  if (PAGINAS_PUBLICAS.includes(page)) return null;

  let accessToken = null;
  let userId = null;

  // Estratégia 1: usar sessão do _sessaoPromise diretamente.
  // O cliente Supabase pode renovar o token expirado internamente e retornar
  // a sessão atualizada via INITIAL_SESSION — sem depender do localStorage,
  // que pode ter token vencido até a escrita ser concluída.
  if (window._sessaoPromise) {
    try {
      var session = await window._sessaoPromise;
      if (session && session.access_token) {
        accessToken = session.access_token;
        userId = session.user && session.user.id;
      }
    } catch (e) { /* ignora */ }
  }

  // Estratégia 2: fallback para localStorage (quando _sessaoPromise não está disponível)
  if (!accessToken) {
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
  }

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
    if (resp.status === 401) { location.href = 'login.html'; return null; }
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

async function doLogout() { await signOut(); _perfil = null; location.href = 'login.html'; }
function getPerfil()    { return _perfil; }
function isAdmin()      { return _perfil && _perfil.papel === 'administrador'; }
function isLicitacoes() { return _perfil && (_perfil.papel === 'licitacoes' || _perfil.papel === 'administrador'); }
function isOrdenador()  { return _perfil && (_perfil.papel === 'ord_despesas' || isLicitacoes()); }
function isChefia()     { return _perfil && (_perfil.papel === 'chefia' || isOrdenador()); }

async function verificarSenha(senha) {
  if (!_perfil) return false;
  try {
    const user = await getUser();
    const { error } = await db.auth.signInWithPassword({ email: user.email, password: senha });
    return !error;
  } catch { return false; }
}

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
