/* ============================================================
   PAC CPII v2 — ui.js
   Helpers de interface: toast, modal, spinner, formatadores BR
   ============================================================ */

/* ── Toast ─────────────────────────────────────────────────── */
(function () {
  const container = document.createElement('div');
  container.id = 'toast-container';
  document.body.appendChild(container);
})();

function showToast(msg, tipo) {
  tipo = tipo || 'info'; // success | error | info | warning
  const el = document.createElement('div');
  el.className = 'toast toast-' + tipo;
  el.textContent = msg;
  document.getElementById('toast-container').appendChild(el);
  setTimeout(function () { el.remove(); }, 4000);
}

/* ── Modal de confirmação (com campo de senha opcional) ─────── */
function showModal(cfg) {
  // cfg: { titulo, mensagem, confirmLabel, confirmClass, requireSenha, onConfirm }
  const backdrop = document.createElement('div');
  backdrop.className = 'modal-backdrop';
  backdrop.innerHTML = `
    <div class="modal" role="dialog" aria-modal="true">
      <h2>${cfg.titulo}</h2>
      <p>${cfg.mensagem || ''}</p>
      ${cfg.requireSenha ? `
        <div class="form-group" style="margin-bottom:0">
          <label>Confirme sua senha</label>
          <input type="password" id="modal-senha" placeholder="Sua senha" autocomplete="current-password">
          <span class="field-error" id="modal-senha-err" style="display:none"></span>
        </div>` : ''}
      ${cfg.requireJustificativa ? `
        <div class="form-group" style="margin-top:12px">
          <label>Justificativa <span style="color:#EF4444">*</span></label>
          <textarea id="modal-just" rows="3" placeholder="Mínimo 10 caracteres"></textarea>
          <span class="field-error" id="modal-just-err" style="display:none"></span>
        </div>` : ''}
      <div class="modal-actions">
        <button class="btn btn-secondary" id="modal-cancelar">Cancelar</button>
        <button class="btn ${cfg.confirmClass || 'btn-primary'}" id="modal-confirmar">
          ${cfg.confirmLabel || 'Confirmar'}
        </button>
      </div>
    </div>`;

  document.body.appendChild(backdrop);

  backdrop.querySelector('#modal-cancelar').onclick = function () { backdrop.remove(); };

  backdrop.querySelector('#modal-confirmar').onclick = function () {
    let ok = true;

    if (cfg.requireSenha) {
      const senha = backdrop.querySelector('#modal-senha').value.trim();
      if (!senha) {
        backdrop.querySelector('#modal-senha-err').textContent = 'Digite sua senha.';
        backdrop.querySelector('#modal-senha-err').style.display = '';
        ok = false;
      } else {
        backdrop.querySelector('#modal-senha-err').style.display = 'none';
      }
    }

    if (cfg.requireJustificativa) {
      const just = backdrop.querySelector('#modal-just').value.trim();
      if (just.length < 10) {
        backdrop.querySelector('#modal-just-err').textContent = 'Justificativa deve ter ao menos 10 caracteres.';
        backdrop.querySelector('#modal-just-err').style.display = '';
        ok = false;
      } else {
        backdrop.querySelector('#modal-just-err').style.display = 'none';
      }
    }

    if (!ok) return;

    const senha = cfg.requireSenha ? backdrop.querySelector('#modal-senha').value : null;
    const justificativa = cfg.requireJustificativa ? backdrop.querySelector('#modal-just').value.trim() : null;
    backdrop.remove();
    cfg.onConfirm({ senha, justificativa });
  };

  // Fechar ao clicar fora
  backdrop.addEventListener('click', function (e) {
    if (e.target === backdrop) backdrop.remove();
  });

  if (cfg.requireSenha) {
    setTimeout(function () {
      const inp = backdrop.querySelector('#modal-senha');
      if (inp) inp.focus();
    }, 50);
  }
}

/* ── Spinner em botão ──────────────────────────────────────── */
function setLoading(btn, loading) {
  if (loading) {
    btn._origText = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner"></span> Aguarde…';
  } else {
    btn.disabled = false;
    btn.innerHTML = btn._origText || btn.innerHTML;
  }
}

/* ── Formatadores BR ───────────────────────────────────────── */
function formatMoeda(val) {
  if (val === null || val === undefined || val === '') return '—';
  return Number(val).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function formatData(val) {
  if (!val) return '—';
  const d = new Date(val + (val.length === 10 ? 'T00:00:00' : ''));
  if (isNaN(d)) return val;
  return d.toLocaleDateString('pt-BR');
}

function formatDataHora(val) {
  if (!val) return '—';
  const d = new Date(val);
  if (isNaN(d)) return val;
  return d.toLocaleString('pt-BR');
}

function formatSIAPE(val) {
  if (!val) return '—';
  return String(val).padStart(7, '0');
}

/* ── Badge de status ───────────────────────────────────────── */
const STATUS_LABELS = {
  rascunho:   'Rascunho',
  submetida:  'Submetida',
  de_acordo:  'De acordo',
  reprovada:  'Reprovada',
  priorizada: 'Priorizada',
  homologada: 'Homologada',
};

function statusBadge(status) {
  const label = STATUS_LABELS[status] || status;
  return `<span class="badge badge-${status}">${label}</span>`;
}

/* ── Sidebar mobile toggle ─────────────────────────────────── */
function initSidebarToggle() {
  const btn = document.getElementById('btn-menu-mobile');
  const sidebar = document.getElementById('app-sidebar');
  if (!btn || !sidebar) return;
  btn.addEventListener('click', function () {
    sidebar.classList.toggle('open');
  });
  document.addEventListener('click', function (e) {
    if (sidebar.classList.contains('open') &&
        !sidebar.contains(e.target) && e.target !== btn) {
      sidebar.classList.remove('open');
    }
  });
}

/* ── Highlight link ativo na sidebar ──────────────────────── */
function highlightActiveNav() {
  const page = location.pathname.split('/').pop() || 'index.html';
  document.querySelectorAll('#app-sidebar nav a').forEach(function (a) {
    const href = a.getAttribute('href') || '';
    if (href === page || href.split('/').pop() === page) {
      a.classList.add('active');
    }
  });
}

/* ── Contador de caracteres ────────────────────────────────── */
function initCharCount(textarea, counterEl, max) {
  function update() {
    const len = textarea.value.length;
    counterEl.textContent = len + '/' + max;
    counterEl.style.color = len > max ? '#EF4444' : '';
  }
  textarea.addEventListener('input', update);
  update();
}

/* ── Validação de campo ────────────────────────────────────── */
function validateField(input, rules) {
  const errEl = input.parentElement.querySelector('.field-error');
  let msg = '';

  if (rules.required && !input.value.trim()) msg = 'Campo obrigatório.';
  else if (rules.email && input.value && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.value))
    msg = 'E-mail inválido.';
  else if (rules.siape && input.value && !/^\d{7}$/.test(input.value))
    msg = 'SIAPE deve ter exatamente 7 dígitos numéricos.';
  else if (rules.min !== undefined && Number(input.value) < rules.min)
    msg = 'Valor mínimo: ' + rules.min;
  else if (rules.max !== undefined && Number(input.value) > rules.max)
    msg = 'Valor máximo: ' + rules.max;
  else if (rules.maxLen && input.value.length > rules.maxLen)
    msg = 'Máximo de ' + rules.maxLen + ' caracteres.';

  if (errEl) {
    errEl.textContent = msg;
    errEl.style.display = msg ? '' : 'none';
  }
  input.classList.toggle('error', !!msg);
  return !msg;
}

/* ── GUT: calcular e exibir total ──────────────────────────── */
function initGutCalc(rowEl) {
  const g = rowEl.querySelector('[data-gut="g"]');
  const u = rowEl.querySelector('[data-gut="u"]');
  const t = rowEl.querySelector('[data-gut="t"]');
  const tot = rowEl.querySelector('[data-gut="total"]');
  function calc() {
    const val = parseInt(g.value) * parseInt(u.value) * parseInt(t.value);
    if (tot) tot.textContent = isNaN(val) ? '—' : val;
  }
  [g, u, t].forEach(function (el) { if (el) el.addEventListener('change', calc); });
  calc();
}

/* ── Inicialização geral (chamada em cada página autenticada) ─ */
function initUI() {
  initSidebarToggle();
  highlightActiveNav();
}
