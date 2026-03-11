/* ═══════════════════════════════════════════════════════════
   TaskFlow Pro — SPA Engine
   Vanilla JS · no build step · talks to FastAPI at same origin
═══════════════════════════════════════════════════════════ */

'use strict';

// ── Config ────────────────────────────────────────────────
const API = window.location.origin;   // same server in prod; change for dev

// ── State ─────────────────────────────────────────────────
const state = {
  page: 'dashboard',
  employees: [],
  projects: [],
  tasks: [],
  dashboard: null,
  timers: {},           // taskId → { start: Date, intervalId }
};

// ── Utilities ─────────────────────────────────────────────
function $(sel, ctx = document) { return ctx.querySelector(sel); }
function $$(sel, ctx = document) { return [...ctx.querySelectorAll(sel)]; }

function fmt(n, digits = 1) { return Number(n ?? 0).toFixed(digits); }

function fmtCurrency(n) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n ?? 0);
}

function fmtDate(str) {
  if (!str) return '—';
  return new Date(str).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function fmtElapsed(startIso) {
  const secs = Math.floor((Date.now() - new Date(startIso).getTime()) / 1000);
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = secs % 60;
  return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
}

function initials(name) {
  return (name || '?').split(' ').map(w => w[0]).join('').slice(0,2).toUpperCase();
}

function empName(id) {
  const e = state.employees.find(e => e.id === id);
  return e ? e.name : `#${id}`;
}

function projName(id) {
  const p = state.projects.find(p => p.id === id);
  return p ? p.name : `#${id}`;
}

// ── Toast ─────────────────────────────────────────────────
function toast(msg, type = 'info') {
  const icons = { success:'fa-circle-check', error:'fa-circle-xmark', warning:'fa-triangle-exclamation', info:'fa-circle-info' };
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.innerHTML = `<i class="fa-solid ${icons[type]} toast-icon"></i><span>${msg}</span>`;
  $('#toast-container').appendChild(el);
  setTimeout(() => { el.classList.add('fade-out'); setTimeout(() => el.remove(), 220); }, 3200);
}

// ── Modal ─────────────────────────────────────────────────
function openModal(title, bodyHTML) {
  $('#modal-title').textContent = title;
  $('#modal-body').innerHTML = bodyHTML;
  $('#modal-backdrop').classList.remove('hidden');
}
function closeModal() { $('#modal-backdrop').classList.add('hidden'); $('#modal-body').innerHTML = ''; }
$('#modal-close').addEventListener('click', closeModal);
$('#modal-backdrop').addEventListener('click', e => { if (e.target === $('#modal-backdrop')) closeModal(); });

// ── HTTP helpers ──────────────────────────────────────────
async function http(method, path, body) {
  const opts = { method, headers: { 'Content-Type': 'application/json' } };
  if (body !== undefined) opts.body = JSON.stringify(body);
  const res = await fetch(API + path, opts);
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || `HTTP ${res.status}`);
  }
  return res.json();
}
const get  = path       => http('GET',    path);
const post = (path, b)  => http('POST',   path, b);
const put  = (path, b)  => http('PUT',    path, b);
const del  = path       => http('DELETE', path);

// ── API Status Check ──────────────────────────────────────
async function checkApi() {
  try {
    await get('/health');
    $('#status-dot').className  = 'status-dot';
    $('#status-text').textContent = 'API Online';
  } catch {
    $('#status-dot').className  = 'status-dot offline';
    $('#status-text').textContent = 'API Offline';
  }
}

// ── Data Loaders ──────────────────────────────────────────
async function loadAll() {
  const [emps, projs, tasks] = await Promise.all([
    get('/employees').catch(() => []),
    get('/projects').catch(() => []),
    get('/tasks').catch(() => []),
  ]);
  state.employees = emps;
  state.projects  = projs;
  state.tasks     = tasks;
}

async function loadDashboard() {
  state.dashboard = await get('/dashboard/summary').catch(() => null);
}

// ── Badges ────────────────────────────────────────────────
function statusBadge(s) {
  const map = { Pending:'badge-pending', 'In Progress':'badge-progress', Completed:'badge-completed' };
  return `<span class="badge ${map[s]||'badge-accent'}">${s}</span>`;
}
function priorityBadge(p) {
  const map = { Low:'badge-low', Medium:'badge-medium', High:'badge-high', Critical:'badge-critical' };
  return `<span class="badge ${map[p]||'badge-accent'}">${p||'Medium'}</span>`;
}

// ── Router ────────────────────────────────────────────────
function navigate(page) {
  state.page = page;
  $$('.nav-item').forEach(a => a.classList.toggle('active', a.dataset.page === page));
  const titles = { dashboard:'Dashboard', employees:'Employees', projects:'Projects', tasks:'Tasks', predict:'ML Predict' };
  $('#page-title').textContent = titles[page] || page;
  render();
}

$$('.nav-item').forEach(a => a.addEventListener('click', () => navigate(a.dataset.page)));
$('#sidebar-toggle').addEventListener('click', () => $('#sidebar').classList.toggle('open'));
$('#refresh-btn').addEventListener('click', async () => {
  await loadAll();
  if (state.page === 'dashboard') await loadDashboard();
  render();
  toast('Data refreshed', 'success');
});

async function render() {
  const pages = { dashboard: renderDashboard, employees: renderEmployees, projects: renderProjects, tasks: renderTasks, predict: renderPredict };
  const fn = pages[state.page];
  if (fn) await fn();
}

// ════════════════════════════════════════════════════════
//  DASHBOARD
// ════════════════════════════════════════════════════════
let chartStatus, chartPriority;

async function renderDashboard() {
  if (!state.dashboard) await loadDashboard();
  const d = state.dashboard || {};
  const byStatus   = d.tasks_by_status   || {};
  const byPriority = d.tasks_by_priority || {};
  const topEmps    = d.top_employees     || [];
  const projSums   = d.project_summaries || [];

  // Header CTA
  $('#header-cta').innerHTML = '';

  $('#page-content').innerHTML = `
    <!-- Stat cards -->
    <div class="stats-grid">
      <div class="stat-card" style="--card-color:var(--accent);--icon-bg:rgba(99,102,241,.15)">
        <div class="stat-icon"><i class="fa-solid fa-list-check"></i></div>
        <div class="stat-value">${d.total_tasks ?? 0}</div>
        <div class="stat-label">Total Tasks</div>
      </div>
      <div class="stat-card" style="--card-color:var(--green);--icon-bg:var(--green-dim)">
        <div class="stat-icon"><i class="fa-solid fa-circle-check"></i></div>
        <div class="stat-value">${byStatus.Completed ?? 0}</div>
        <div class="stat-label">Completed</div>
      </div>
      <div class="stat-card" style="--card-color:var(--amber);--icon-bg:var(--amber-dim)">
        <div class="stat-icon"><i class="fa-solid fa-spinner"></i></div>
        <div class="stat-value">${byStatus['In Progress'] ?? 0}</div>
        <div class="stat-label">In Progress</div>
      </div>
      <div class="stat-card" style="--card-color:var(--cyan);--icon-bg:rgba(6,182,212,.15)">
        <div class="stat-icon"><i class="fa-solid fa-clock"></i></div>
        <div class="stat-value">${fmt(d.total_hours_logged ?? 0)}</div>
        <div class="stat-label">Hours Logged</div>
      </div>
      <div class="stat-card" style="--card-color:var(--violet);--icon-bg:rgba(139,92,246,.15)">
        <div class="stat-icon"><i class="fa-solid fa-users"></i></div>
        <div class="stat-value">${d.total_employees ?? 0}</div>
        <div class="stat-label">Employees</div>
      </div>
      <div class="stat-card" style="--card-color:var(--blue);--icon-bg:var(--blue-dim)">
        <div class="stat-icon"><i class="fa-solid fa-folder-open"></i></div>
        <div class="stat-value">${d.total_projects ?? 0}</div>
        <div class="stat-label">Projects</div>
      </div>
    </div>

    <!-- Charts -->
    <div class="charts-grid">
      <div class="card">
        <div class="card-header"><span class="card-title">Tasks by Status</span></div>
        <div class="chart-container"><canvas id="chartStatus"></canvas></div>
      </div>
      <div class="card">
        <div class="card-header"><span class="card-title">Tasks by Priority</span></div>
        <div class="chart-container"><canvas id="chartPriority"></canvas></div>
      </div>
    </div>

    <!-- Bottom row -->
    <div class="charts-grid">
      <!-- Top Employees -->
      <div class="card">
        <div class="card-header">
          <span class="card-title">Top Employees</span>
          <span class="badge badge-accent">${topEmps.length}</span>
        </div>
        <div class="table-wrapper">
          <table>
            <thead><tr><th>Name</th><th>Tasks</th><th>Done</th><th>Hours</th></tr></thead>
            <tbody>
              ${topEmps.length ? topEmps.map(e => `
                <tr>
                  <td><div class="flex-center">
                    <div class="emp-avatar" style="width:28px;height:28px;font-size:11px">${initials(e.employee_name)}</div>
                    ${e.employee_name}
                  </div></td>
                  <td>${e.total_tasks}</td>
                  <td><span class="text-green">${e.completed_tasks}</span></td>
                  <td>${fmt(e.total_hours)} h</td>
                </tr>`).join('') : '<tr><td colspan="4" class="text-muted" style="text-align:center;padding:24px">No data yet</td></tr>'}
            </tbody>
          </table>
        </div>
      </div>

      <!-- Project Summaries -->
      <div class="card">
        <div class="card-header">
          <span class="card-title">Project Overview</span>
          <span class="badge badge-accent">${projSums.length}</span>
        </div>
        <div class="table-wrapper">
          <table>
            <thead><tr><th>Project</th><th>Tasks</th><th>Hours</th><th>Budget</th></tr></thead>
            <tbody>
              ${projSums.length ? projSums.map(p => `
                <tr>
                  <td>${p.project_name}</td>
                  <td>${p.completed_tasks}/${p.total_tasks}</td>
                  <td>${fmt(p.total_hours)} h</td>
                  <td>${p.budget ? fmtCurrency(p.budget) : '—'}</td>
                </tr>`).join('') : '<tr><td colspan="4" class="text-muted" style="text-align:center;padding:24px">No data yet</td></tr>'}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `;

  // Destroy previous charts if any
  if (chartStatus)   { chartStatus.destroy();   chartStatus   = null; }
  if (chartPriority) { chartPriority.destroy(); chartPriority = null; }

  const chartDefaults = {
    plugins: { legend: { labels: { color: '#8b9abf', font: { family: 'Inter', size: 12 }, boxWidth: 12 } } },
  };

  // Status doughnut
  chartStatus = new Chart($('#chartStatus'), {
    type: 'doughnut',
    data: {
      labels: Object.keys(byStatus),
      datasets: [{ data: Object.values(byStatus),
        backgroundColor: ['#3b82f6','#f59e0b','#22c55e'],
        borderWidth: 0, hoverOffset: 6 }],
    },
    options: { ...chartDefaults, cutout: '70%', responsive: true, maintainAspectRatio: false,
      plugins: { ...chartDefaults.plugins, tooltip: { callbacks: { label: ctx => ` ${ctx.label}: ${ctx.parsed}` } } } },
  });

  // Priority bar
  const priColors = { Low:'#64748b', Medium:'#3b82f6', High:'#f59e0b', Critical:'#ef4444' };
  chartPriority = new Chart($('#chartPriority'), {
    type: 'bar',
    data: {
      labels: Object.keys(byPriority),
      datasets: [{ data: Object.values(byPriority),
        backgroundColor: Object.keys(byPriority).map(k => priColors[k] || '#6366f1'),
        borderRadius: 6, borderWidth: 0 }],
    },
    options: { ...chartDefaults, responsive: true, maintainAspectRatio: false,
      scales: {
        x: { ticks: { color: '#8b9abf', font:{ family:'Inter' } }, grid:{ color:'rgba(255,255,255,0.04)' } },
        y: { ticks: { color: '#8b9abf', font:{ family:'Inter' }, stepSize: 1 }, grid:{ color:'rgba(255,255,255,0.04)' } },
      },
      plugins: { ...chartDefaults.plugins, legend: { display: false } },
    },
  });
}

// ════════════════════════════════════════════════════════
//  EMPLOYEES
// ════════════════════════════════════════════════════════
function renderEmployees() {
  const emps = state.employees;
  $('#header-cta').innerHTML = `<button class="btn btn-primary" id="btn-add-emp"><i class="fa-solid fa-plus"></i>Add Employee</button>`;
  $('#page-content').innerHTML = `
    <div class="page-toolbar">
      <div class="search-input"><i class="fa-solid fa-magnifying-glass"></i><input id="emp-search" placeholder="Search employees…" /></div>
      <span class="text-muted" style="font-size:13px">${emps.length} employee${emps.length!==1?'s':''}</span>
    </div>
    <div class="data-grid" id="emp-grid">
      ${emps.length ? emps.map(empCard).join('') : emptyState('users','No employees yet. Add your first one!')}
    </div>`;

  $('#btn-add-emp').addEventListener('click', () => openEmpModal());
  $('#emp-search').addEventListener('input', e => {
    const q = e.target.value.toLowerCase();
    $$('#emp-grid .employee-card').forEach(card => {
      card.style.display = card.dataset.name.toLowerCase().includes(q) ? '' : 'none';
    });
  });
  bindEmpActions();
}

function empCard(e) {
  return `
  <div class="employee-card" data-name="${e.name}" data-id="${e.id}">
    <div class="emp-header">
      <div class="emp-avatar">${initials(e.name)}</div>
      <div>
        <div class="emp-name">${e.name}</div>
        <div class="emp-dept">${e.department || '—'} · ${e.education || '—'}</div>
      </div>
    </div>
    <div class="emp-meta">
      <span class="emp-meta-item"><i class="fa-solid fa-cake-candles"></i>${e.age ?? '—'} yrs</span>
      <span class="emp-meta-item"><i class="fa-solid fa-briefcase"></i>${e.length_of_service ?? '—'} yrs exp</span>
      <span class="emp-meta-item"><i class="fa-solid fa-star"></i>${e.previous_year_rating ?? '—'} rating</span>
      <span class="emp-meta-item"><i class="fa-solid fa-graduation-cap"></i>${fmt(e.avg_training_score ?? 0,0)} score</span>
    </div>
    <div class="emp-meta">
      ${e.KPIs_met_more_than_80 ? '<span class="badge badge-completed"><i class="fa-solid fa-check"></i> KPIs Met</span>' : ''}
      ${e.awards_won ? '<span class="badge badge-high"><i class="fa-solid fa-trophy"></i> Award Won</span>' : ''}
      ${e.no_of_trainings ? `<span class="badge badge-accent">${e.no_of_trainings} trainings</span>` : ''}
    </div>
    <div class="emp-actions">
      <button class="btn btn-secondary btn-sm btn-edit-emp" data-id="${e.id}"><i class="fa-solid fa-pen"></i> Edit</button>
      <button class="btn btn-danger btn-sm btn-del-emp" data-id="${e.id}"><i class="fa-solid fa-trash"></i></button>
      <button class="btn btn-secondary btn-sm btn-view-tasks" data-id="${e.id}" data-name="${e.name}"><i class="fa-solid fa-list-check"></i> Tasks</button>
    </div>
  </div>`;
}

function bindEmpActions() {
  $$('.btn-edit-emp').forEach(b => b.addEventListener('click', () => openEmpModal(parseInt(b.dataset.id))));
  $$('.btn-del-emp').forEach(b => b.addEventListener('click', () => deleteEmployee(parseInt(b.dataset.id))));
  $$('.btn-view-tasks').forEach(b => b.addEventListener('click', () => {
    navigate('tasks');
    // filter handled after render
  }));
}

function openEmpModal(id) {
  const emp = id ? state.employees.find(e => e.id === id) : null;
  openModal(emp ? 'Edit Employee' : 'Add Employee', `
    <div class="form-grid">
      <div class="form-group form-full"><label>Full Name *</label>
        <input id="f-name" value="${emp?.name||''}" placeholder="e.g. Alice Dev" /></div>
      <div class="form-group"><label>Department</label>
        <select id="f-dept">
          ${['Technology','Management','Analytics','Design','QA','DevOps','Mobile','Full Stack'].map(d =>
            `<option ${emp?.department===d?'selected':''}>${d}</option>`).join('')}
        </select></div>
      <div class="form-group"><label>Education</label>
        <select id="f-edu">
          ${["Bachelor's","Master's","PhD","Diploma","High School"].map(d =>
            `<option ${emp?.education===d?'selected':''}>${d}</option>`).join('')}
        </select></div>
      <div class="form-group"><label>Age</label>
        <input id="f-age" type="number" min="18" max="70" value="${emp?.age||''}" /></div>
      <div class="form-group"><label>Years of Service</label>
        <input id="f-service" type="number" min="0" value="${emp?.length_of_service||''}" /></div>
      <div class="form-group"><label>Performance Rating (1–5)</label>
        <input id="f-rating" type="number" min="1" max="5" step=".5" value="${emp?.previous_year_rating||''}" /></div>
      <div class="form-group"><label>Avg Training Score (0–100)</label>
        <input id="f-score" type="number" min="0" max="100" value="${emp?.avg_training_score||''}" /></div>
      <div class="form-group"><label>No. of Trainings</label>
        <input id="f-trainings" type="number" min="0" value="${emp?.no_of_trainings||0}" /></div>
      <div class="form-group"><label>KPIs Met >80%</label>
        <select id="f-kpi"><option value="0" ${!emp?.KPIs_met_more_than_80?'selected':''}>No</option><option value="1" ${emp?.KPIs_met_more_than_80?'selected':''}>Yes</option></select></div>
      <div class="form-group"><label>Award Won</label>
        <select id="f-award"><option value="0" ${!emp?.awards_won?'selected':''}>No</option><option value="1" ${emp?.awards_won?'selected':''}>Yes</option></select></div>
    </div>
    <hr class="divider" />
    <div class="form-actions">
      <button class="btn btn-secondary" onclick="closeModal()">Cancel</button>
      <button class="btn btn-primary" id="save-emp">${emp ? 'Save Changes' : 'Create Employee'}</button>
    </div>`);

  $('#save-emp').addEventListener('click', async () => {
    const name = $('#f-name').value.trim();
    if (!name) { toast('Name is required', 'error'); return; }
    const payload = {
      name, department: $('#f-dept').value, education: $('#f-edu').value,
      age: parseInt($('#f-age').value)||null,
      length_of_service: parseInt($('#f-service').value)||null,
      previous_year_rating: parseFloat($('#f-rating').value)||null,
      avg_training_score: parseFloat($('#f-score').value)||null,
      no_of_trainings: parseInt($('#f-trainings').value)||0,
      KPIs_met_more_than_80: parseInt($('#f-kpi').value),
      awards_won: parseInt($('#f-award').value),
    };
    try {
      if (emp) { await put(`/employees/${emp.id}`, payload); toast('Employee updated', 'success'); }
      else      { await post('/employees', payload);          toast('Employee added', 'success'); }
      closeModal();
      await loadAll();
      renderEmployees();
    } catch(e) { toast(e.message, 'error'); }
  });
}

async function deleteEmployee(id) {
  const emp = state.employees.find(e => e.id === id);
  openModal('Delete Employee', `
    <p style="color:var(--text-secondary);margin-bottom:20px">
      Are you sure you want to delete <strong>${emp?.name}</strong>? This cannot be undone.
    </p>
    <div class="form-actions">
      <button class="btn btn-secondary" onclick="closeModal()">Cancel</button>
      <button class="btn btn-danger" id="confirm-del"><i class="fa-solid fa-trash"></i> Delete</button>
    </div>`);
  $('#confirm-del').addEventListener('click', async () => {
    try {
      await del(`/employees/${id}`);
      toast('Employee deleted', 'warning');
      closeModal(); await loadAll(); renderEmployees();
    } catch(e) { toast(e.message, 'error'); }
  });
}

// ════════════════════════════════════════════════════════
//  PROJECTS
// ════════════════════════════════════════════════════════
function renderProjects() {
  const projs = state.projects;
  $('#header-cta').innerHTML = `<button class="btn btn-primary" id="btn-add-proj"><i class="fa-solid fa-plus"></i>New Project</button>`;
  $('#page-content').innerHTML = `
    <div class="page-toolbar">
      <div class="search-input"><i class="fa-solid fa-magnifying-glass"></i><input id="proj-search" placeholder="Search projects…" /></div>
      <span class="text-muted" style="font-size:13px">${projs.length} project${projs.length!==1?'s':''}</span>
    </div>
    <div class="data-grid" id="proj-grid">
      ${projs.length ? projs.map(projCard).join('') : emptyState('folder-open','No projects yet. Create one!')}
    </div>`;

  $('#btn-add-proj').addEventListener('click', () => openProjModal());
  $('#proj-search').addEventListener('input', e => {
    const q = e.target.value.toLowerCase();
    $$('#proj-grid .project-card').forEach(c => {
      c.style.display = c.dataset.name.toLowerCase().includes(q) ? '' : 'none';
    });
  });
  bindProjActions();
}

function projCard(p) {
  const tasks = state.tasks.filter(t => t.project_id === p.id);
  const done  = tasks.filter(t => t.status === 'Completed').length;
  const pct   = tasks.length ? Math.round((done / tasks.length) * 100) : 0;
  const budgetUsed = p.budget ? Math.min(Math.round((p.actual_cost||0) / p.budget * 100), 100) : 0;
  return `
  <div class="project-card" data-id="${p.id}" data-name="${p.name}">
    <div class="proj-header">
      <div>
        <div class="proj-name">${p.name}</div>
        <div class="proj-type">${p.project_type||'—'}</div>
      </div>
      <div style="display:flex;flex-direction:column;align-items:flex-end;gap:6px">
        ${statusBadge(p.status||'In Progress')}
        ${priorityBadge(p.priority)}
      </div>
    </div>
    <div>
      <div style="display:flex;justify-content:space-between;font-size:12px;color:var(--text-secondary);margin-bottom:5px">
        <span>Task Progress</span><span>${done}/${tasks.length} (${pct}%)</span>
      </div>
      <div class="progress-bar-wrap"><div class="progress-bar" style="width:${pct}%"></div></div>
    </div>
    ${p.budget ? `
    <div>
      <div style="display:flex;justify-content:space-between;font-size:12px;color:var(--text-secondary);margin-bottom:5px">
        <span>Budget Used</span><span>${fmtCurrency(p.actual_cost||0)} / ${fmtCurrency(p.budget)}</span>
      </div>
      <div class="progress-bar-wrap">
        <div class="progress-bar" style="width:${budgetUsed}%;background:${budgetUsed>90?'var(--red)':'linear-gradient(90deg,var(--cyan),var(--accent))'}"></div>
      </div>
    </div>` : ''}
    <div class="proj-budget">
      <span><i class="fa-regular fa-calendar" style="margin-right:4px"></i>${fmtDate(p.start_date)} → ${fmtDate(p.planned_completion_date)}</span>
    </div>
    <div class="proj-actions">
      <button class="btn btn-secondary btn-sm btn-edit-proj" data-id="${p.id}"><i class="fa-solid fa-pen"></i> Edit</button>
      <button class="btn btn-danger btn-sm btn-del-proj" data-id="${p.id}"><i class="fa-solid fa-trash"></i></button>
    </div>
  </div>`;
}

function bindProjActions() {
  $$('.btn-edit-proj').forEach(b => b.addEventListener('click', () => openProjModal(parseInt(b.dataset.id))));
  $$('.btn-del-proj').forEach(b => b.addEventListener('click', () => deleteProject(parseInt(b.dataset.id))));
}

function openProjModal(id) {
  const p = id ? state.projects.find(x => x.id === id) : null;
  const toDateVal = str => str ? str.split('T')[0] : '';
  openModal(p ? 'Edit Project' : 'New Project', `
    <div class="form-grid">
      <div class="form-group form-full"><label>Project Name *</label>
        <input id="p-name" value="${p?.name||''}" placeholder="e.g. Client Portal v2" /></div>
      <div class="form-group"><label>Type</label>
        <select id="p-type">
          ${['Web App','Mobile App','API Integration','Data Pipeline','Desktop App','E-Commerce','Analytics Dashboard','Other'].map(t=>
            `<option ${p?.project_type===t?'selected':''}>${t}</option>`).join('')}
        </select></div>
      <div class="form-group"><label>Priority</label>
        <select id="p-priority">
          ${['Low','Medium','High','Critical'].map(v=>`<option ${p?.priority===v?'selected':''}>${v}</option>`).join('')}
        </select></div>
      <div class="form-group"><label>Status</label>
        <select id="p-status">
          ${['In Progress','Completed','On Hold'].map(v=>`<option ${p?.status===v?'selected':''}>${v}</option>`).join('')}
        </select></div>
      <div class="form-group"><label>Budget ($)</label>
        <input id="p-budget" type="number" min="0" value="${p?.budget||''}" placeholder="e.g. 150000" /></div>
      <div class="form-group"><label>Actual Cost ($)</label>
        <input id="p-cost" type="number" min="0" value="${p?.actual_cost||''}" placeholder="e.g. 82000" /></div>
      <div class="form-group"><label>Start Date</label>
        <input id="p-start" type="date" value="${toDateVal(p?.start_date)}" /></div>
      <div class="form-group"><label>Planned Completion</label>
        <input id="p-planned" type="date" value="${toDateVal(p?.planned_completion_date)}" /></div>
      <div class="form-group"><label>Actual Completion</label>
        <input id="p-actual" type="date" value="${toDateVal(p?.actual_completion_date)}" /></div>
    </div>
    <hr class="divider" />
    <div class="form-actions">
      <button class="btn btn-secondary" onclick="closeModal()">Cancel</button>
      <button class="btn btn-primary" id="save-proj">${p ? 'Save Changes' : 'Create Project'}</button>
    </div>`);

  $('#save-proj').addEventListener('click', async () => {
    const name = $('#p-name').value.trim();
    if (!name) { toast('Name is required', 'error'); return; }
    const isoDate = v => v ? new Date(v).toISOString() : null;
    const payload = {
      name, project_type: $('#p-type').value, priority: $('#p-priority').value,
      status: $('#p-status').value,
      budget:     parseFloat($('#p-budget').value)||null,
      actual_cost:parseFloat($('#p-cost').value)||null,
      start_date:            isoDate($('#p-start').value),
      planned_completion_date:isoDate($('#p-planned').value),
      actual_completion_date: isoDate($('#p-actual').value),
    };
    try {
      if (p) { await put(`/projects/${p.id}`, payload); toast('Project updated', 'success'); }
      else    { await post('/projects', payload);        toast('Project created', 'success'); }
      closeModal(); await loadAll(); renderProjects();
    } catch(e) { toast(e.message, 'error'); }
  });
}

async function deleteProject(id) {
  const p = state.projects.find(x => x.id === id);
  openModal('Delete Project', `
    <p style="color:var(--text-secondary);margin-bottom:20px">
      Delete <strong>${p?.name}</strong>? All associated tasks remain.
    </p>
    <div class="form-actions">
      <button class="btn btn-secondary" onclick="closeModal()">Cancel</button>
      <button class="btn btn-danger" id="confirm-del-proj"><i class="fa-solid fa-trash"></i> Delete</button>
    </div>`);
  $('#confirm-del-proj').addEventListener('click', async () => {
    try {
      await del(`/projects/${id}`);
      toast('Project deleted', 'warning');
      closeModal(); await loadAll(); renderProjects();
    } catch(e) { toast(e.message, 'error'); }
  });
}

// ════════════════════════════════════════════════════════
//  TASKS — Kanban Board
// ════════════════════════════════════════════════════════
function renderTasks() {
  const pending    = state.tasks.filter(t => t.status === 'Pending');
  const inProgress = state.tasks.filter(t => t.status === 'In Progress');
  const completed  = state.tasks.filter(t => t.status === 'Completed');

  $('#header-cta').innerHTML = `<button class="btn btn-primary" id="btn-add-task"><i class="fa-solid fa-plus"></i>New Task</button>`;
  $('#page-content').innerHTML = `
    <div class="kanban-board">
      <div class="kanban-col">
        <div class="kanban-col-header">
          <div class="kanban-col-title">
            <span style="width:8px;height:8px;border-radius:50%;background:var(--blue);display:inline-block"></span>
            PENDING
          </div>
          <span class="col-count">${pending.length}</span>
        </div>
        ${pending.map(t => taskCard(t)).join('') || emptyCol()}
      </div>
      <div class="kanban-col">
        <div class="kanban-col-header">
          <div class="kanban-col-title">
            <span style="width:8px;height:8px;border-radius:50%;background:var(--amber);display:inline-block"></span>
            IN PROGRESS
          </div>
          <span class="col-count">${inProgress.length}</span>
        </div>
        ${inProgress.map(t => taskCard(t)).join('') || emptyCol()}
      </div>
      <div class="kanban-col">
        <div class="kanban-col-header">
          <div class="kanban-col-title">
            <span style="width:8px;height:8px;border-radius:50%;background:var(--green);display:inline-block"></span>
            COMPLETED
          </div>
          <span class="col-count">${completed.length}</span>
        </div>
        ${completed.map(t => taskCard(t)).join('') || emptyCol()}
      </div>
    </div>`;

  $('#btn-add-task').addEventListener('click', () => openTaskModal());
  bindTaskActions();
  startLiveTimers();
}

function emptyCol() {
  return `<div style="text-align:center;padding:28px 12px;color:var(--text-muted);font-size:12px">No tasks here</div>`;
}

function taskCard(t) {
  const elapsed = t.status === 'In Progress' && t.start_time
    ? `<span class="timer-live" id="timer-${t.id}">${fmtElapsed(t.start_time)}</span>` : '';
  return `
  <div class="task-card" data-id="${t.id}">
    <div class="task-card-title">${t.title}</div>
    ${t.description ? `<div style="font-size:12px;color:var(--text-secondary);margin-bottom:8px;line-height:1.4">${t.description}</div>` : ''}
    <div class="task-card-meta">
      ${priorityBadge(t.priority)}
      ${t.employee_id ? `<span class="badge badge-accent"><i class="fa-solid fa-user"></i> ${empName(t.employee_id)}</span>` : ''}
      ${t.project_id  ? `<span class="badge badge-pending"><i class="fa-solid fa-folder"></i> ${projName(t.project_id)}</span>` : ''}
    </div>
    ${t.status === 'In Progress' ? `<div class="task-timer"><i class="fa-solid fa-stopwatch"></i>${elapsed}</div>` : ''}
    ${t.status === 'Completed' && t.measured_hours ? `<div style="font-size:11px;color:var(--green);margin-bottom:8px"><i class="fa-solid fa-clock"></i> ${fmt(t.measured_hours, 2)} hours logged</div>` : ''}
    <div class="task-card-footer">
      ${t.status === 'Pending'     ? `<button class="btn btn-success btn-sm btn-start-task" data-id="${t.id}"><i class="fa-solid fa-play"></i> Start</button>` : ''}
      ${t.status === 'In Progress' ? `<button class="btn btn-amber  btn-sm btn-stop-task"  data-id="${t.id}"><i class="fa-solid fa-stop"></i> Stop</button>` : ''}
      <button class="btn btn-secondary btn-sm btn-edit-task" data-id="${t.id}"><i class="fa-solid fa-pen"></i></button>
      <button class="btn btn-danger btn-sm btn-del-task" data-id="${t.id}"><i class="fa-solid fa-trash"></i></button>
    </div>
  </div>`;
}

function bindTaskActions() {
  $$('.btn-start-task').forEach(b => b.addEventListener('click', async () => {
    try {
      await post(`/tasks/${b.dataset.id}/start`);
      toast('Task started — timer running', 'success');
      await loadAll(); renderTasks();
    } catch(e) { toast(e.message, 'error'); }
  }));
  $$('.btn-stop-task').forEach(b => b.addEventListener('click', async () => {
    try {
      const t = await post(`/tasks/${b.dataset.id}/stop`);
      toast(`Task completed — ${fmt(t.measured_hours, 2)} hours logged`, 'success');
      await loadAll(); await loadDashboard(); renderTasks();
    } catch(e) { toast(e.message, 'error'); }
  }));
  $$('.btn-edit-task').forEach(b => b.addEventListener('click', () => openTaskModal(parseInt(b.dataset.id))));
  $$('.btn-del-task').forEach(b => b.addEventListener('click', () => deleteTask(parseInt(b.dataset.id))));
}

function startLiveTimers() {
  // Clear all previous timers
  Object.values(state.timers).forEach(clearInterval);
  state.timers = {};
  state.tasks.filter(t => t.status === 'In Progress' && t.start_time).forEach(t => {
    const el = () => $(`#timer-${t.id}`);
    state.timers[t.id] = setInterval(() => {
      const dom = el();
      if (dom) dom.textContent = fmtElapsed(t.start_time);
      else clearInterval(state.timers[t.id]);
    }, 1000);
  });
}

function openTaskModal(id) {
  const t = id ? state.tasks.find(x => x.id === id) : null;
  openModal(t ? 'Edit Task' : 'New Task', `
    <div class="form-grid cols-1">
      <div class="form-group"><label>Task Title *</label>
        <input id="t-title" value="${t?.title||''}" placeholder="e.g. Build Login Page" /></div>
      <div class="form-group"><label>Description</label>
        <textarea id="t-desc" rows="3" placeholder="Optional description…">${t?.description||''}</textarea></div>
    </div>
    <div class="form-grid">
      <div class="form-group"><label>Priority</label>
        <select id="t-priority">
          ${['Low','Medium','High','Critical'].map(v=>`<option ${(t?.priority||'Medium')===v?'selected':''}>${v}</option>`).join('')}
        </select></div>
      <div class="form-group"><label>Assign to Employee</label>
        <select id="t-emp">
          <option value="">— select —</option>
          ${state.employees.map(e=>`<option value="${e.id}" ${t?.employee_id===e.id?'selected':''}>${e.name}</option>`).join('')}
        </select></div>
      <div class="form-group"><label>Project</label>
        <select id="t-proj">
          <option value="">— select —</option>
          ${state.projects.map(p=>`<option value="${p.id}" ${t?.project_id===p.id?'selected':''}>${p.name}</option>`).join('')}
        </select></div>
    </div>
    <hr class="divider" />
    <div class="form-actions">
      <button class="btn btn-secondary" onclick="closeModal()">Cancel</button>
      <button class="btn btn-primary" id="save-task">${t ? 'Save Changes' : 'Create Task'}</button>
    </div>`);

  $('#save-task').addEventListener('click', async () => {
    const title = $('#t-title').value.trim();
    if (!title) { toast('Title is required', 'error'); return; }
    const empId  = parseInt($('#t-emp').value)  || null;
    const projId = parseInt($('#t-proj').value) || null;
    if (!t && (!empId || !projId)) { toast('Employee and Project are required', 'error'); return; }
    const payload = { title, description: $('#t-desc').value.trim()||null, priority: $('#t-priority').value };
    if (!t) { payload.employee_id = empId; payload.project_id = projId; }
    try {
      if (t) { await put(`/tasks/${t.id}`, payload); toast('Task updated', 'success'); }
      else    { await post('/tasks', payload);         toast('Task created', 'success'); }
      closeModal(); await loadAll(); renderTasks();
    } catch(e) { toast(e.message, 'error'); }
  });
}

async function deleteTask(id) {
  const t = state.tasks.find(x => x.id === id);
  openModal('Delete Task', `
    <p style="color:var(--text-secondary);margin-bottom:20px">Delete task <strong>"${t?.title}"</strong>?</p>
    <div class="form-actions">
      <button class="btn btn-secondary" onclick="closeModal()">Cancel</button>
      <button class="btn btn-danger" id="confirm-del-task"><i class="fa-solid fa-trash"></i> Delete</button>
    </div>`);
  $('#confirm-del-task').addEventListener('click', async () => {
    try {
      await del(`/tasks/${id}`);
      toast('Task deleted', 'warning');
      closeModal(); await loadAll(); renderTasks();
    } catch(e) { toast(e.message, 'error'); }
  });
}

// ════════════════════════════════════════════════════════
//  ML PREDICT
// ════════════════════════════════════════════════════════
function renderPredict() {
  $('#header-cta').innerHTML = '';
  $('#page-content').innerHTML = `
    <div class="predict-layout">

      <!-- Form -->
      <div class="card">
        <div class="card-header"><span class="card-title"><i class="fa-solid fa-wand-magic-sparkles" style="color:var(--violet)"></i> &nbsp;Predict Task Hours</span></div>
        <div class="card-body">

          <div class="section-title">EMPLOYEE PROFILE</div>
          <div class="form-grid">
            <div class="form-group"><label>Department</label>
              <select id="pr-dept">${['Technology','Management','Analytics','Design','QA','DevOps','Mobile','Full Stack'].map(d=>`<option>${d}</option>`).join('')}</select></div>
            <div class="form-group"><label>Education</label>
              <select id="pr-edu">${["Bachelor's","Master's","PhD","Diploma"].map(d=>`<option>${d}</option>`).join('')}</select></div>
            <div class="form-group"><label>Age</label>          <input id="pr-age"      type="number" value="28"  /></div>
            <div class="form-group"><label>Years of Service</label><input id="pr-service" type="number" value="3"   /></div>
            <div class="form-group"><label>Perf. Rating (1–5)</label><input id="pr-rating" type="number" value="3.5" step=".5"/></div>
            <div class="form-group"><label>Avg Training Score</label><input id="pr-score"   type="number" value="65"  /></div>
            <div class="form-group"><label>No. of Trainings</label><input id="pr-train"    type="number" value="2"   /></div>
            <div class="form-group"><label>KPIs Met >80%</label>
              <select id="pr-kpi"><option value="0">No</option><option value="1">Yes</option></select></div>
            <div class="form-group"><label>Award Won</label>
              <select id="pr-award"><option value="0">No</option><option value="1">Yes</option></select></div>
          </div>

          <div class="section-title">PROJECT CONTEXT</div>
          <div class="form-grid">
            <div class="form-group"><label>Project Type</label>
              <select id="pr-ptype">${['Web App','Mobile App','API Integration','Data Pipeline','Analytics Dashboard','E-Commerce'].map(d=>`<option>${d}</option>`).join('')}</select></div>
            <div class="form-group"><label>Priority</label>
              <select id="pr-pri">${['Low','Medium','High','Critical'].map(d=>`<option ${d==='High'?'selected':''}>${d}</option>`).join('')}</select></div>
            <div class="form-group"><label>Budget ($)</label>     <input id="pr-budget"  type="number" value="100000" /></div>
            <div class="form-group"><label>Actual Cost ($)</label> <input id="pr-cost"    type="number" value="80000"  /></div>
            <div class="form-group"><label>Delay Days</label>      <input id="pr-delay"   type="number" value="0"      /></div>
            <div class="form-group"><label>Tasks Completed</label>  <input id="pr-tcomp"   type="number" value="5"      /></div>
            <div class="form-group"><label>Productivity Score</label><input id="pr-prod"   type="number" value="70"     /></div>
            <div class="form-group"><label>Workload Pressure (0–1)</label><input id="pr-workload" type="number" value="0.5" step=".1" min="0" max="1" /></div>
          </div>

          <hr class="divider" />
          <div class="form-actions" style="justify-content:flex-start">
            <button class="btn btn-primary" id="btn-predict" style="padding:10px 28px;font-size:14px">
              <i class="fa-solid fa-bolt-lightning"></i> Predict Hours
            </button>
          </div>
        </div>
      </div>

      <!-- Result Panel -->
      <div style="display:flex;flex-direction:column;gap:16px">
        <div class="predict-result" id="predict-result">
          <i class="fa-solid fa-wand-magic-sparkles" style="font-size:48px;opacity:.2;color:var(--accent-light)"></i>
          <p class="predict-label">Fill in the form and click<br><strong>Predict Hours</strong></p>
        </div>

        <div class="card" id="model-info-card">
          <div class="card-header"><span class="card-title">Model Info</span></div>
          <div class="card-body" id="model-info-body">
            <div style="text-align:center;color:var(--text-muted);font-size:12px">Loading…</div>
          </div>
        </div>
      </div>
    </div>`;

  // Load model info
  get('/model-info').then(meta => {
    $('#model-info-body').innerHTML = `
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;font-size:12px">
        <div><div class="text-muted" style="font-size:11px;margin-bottom:3px">TARGET</div><strong>${meta.target||'Hours Spent'}</strong></div>
        <div><div class="text-muted" style="font-size:11px;margin-bottom:3px">ALGORITHM</div><strong>Random Forest</strong></div>
        <div><div class="text-muted" style="font-size:11px;margin-bottom:3px">TEST MAE</div><strong class="text-green">± ${fmt(meta.metrics?.mae,3)} hrs</strong></div>
        <div><div class="text-muted" style="font-size:11px;margin-bottom:3px">TEST RMSE</div><strong class="text-amber">± ${fmt(meta.metrics?.rmse,3)} hrs</strong></div>
        <div style="grid-column:1/-1"><div class="text-muted" style="font-size:11px;margin-bottom:3px">NUMERIC FEATURES</div>
          <div style="display:flex;flex-wrap:wrap;gap:4px;margin-top:4px">
            ${(meta.numeric_features||[]).map(f=>`<span class="badge badge-pending" style="font-size:10px">${f}</span>`).join('')}
          </div>
        </div>
      </div>`;
  }).catch(() => {
    $('#model-info-body').innerHTML = `<p style="color:var(--red);font-size:12px">Model not trained. Run <code style="background:var(--bg-base);padding:2px 5px;border-radius:3px">python -m backend.ml.train_models</code></p>`;
  });

  $('#btn-predict').addEventListener('click', async () => {
    const btn = $('#btn-predict');
    btn.innerHTML = '<span class="spinner"></span> Predicting…'; btn.disabled = true;
    const priScale = { Low:1, Medium:2, High:3, Critical:4 };
    const pri = $('#pr-pri').value;
    const payload = {
      department: $('#pr-dept').value, education: $('#pr-edu').value,
      age: +$('#pr-age').value, length_of_service: +$('#pr-service').value,
      previous_year_rating: +$('#pr-rating').value,
      avg_training_score: +$('#pr-score').value,
      no_of_trainings: +$('#pr-train').value,
      KPIs_met_more_than_80: +$('#pr-kpi').value,
      awards_won: +$('#pr-award').value,
      Project_Type: $('#pr-ptype').value, Priority: pri,
      Priority_Scaled: priScale[pri]||2,
      Budget: +$('#pr-budget').value,
      Actual_Cost: +$('#pr-cost').value,
      Delay_Days: +$('#pr-delay').value,
      Cost_Overrun_pct: +(((+$('#pr-cost').value - +$('#pr-budget').value) / Math.max(+$('#pr-budget').value,1) * 100).toFixed(1)),
      Tasks_Completed: +$('#pr-tcomp').value,
      Productivity_Score: +$('#pr-prod').value,
      Workload_Pressure: +$('#pr-workload').value,
      Training_Effectiveness: +$('#pr-rating').value,
      Experience_Index: +$('#pr-service').value,
    };
    try {
      const res = await post('/predict', payload);
      $('#predict-result').innerHTML = `
        <div class="predict-label" style="color:var(--text-muted);font-size:11px;letter-spacing:.8px">ESTIMATED TASK HOURS</div>
        <div class="predict-hours">${fmt(res.predicted_hours, 1)}</div>
        <div class="predict-label">hours to complete</div>
        <hr style="border-color:var(--border);width:100%;margin:4px 0" />
        <div class="predict-metrics">
          <div class="predict-metric"><div class="val text-green">±${fmt(res.model_mae,2)}</div><div class="lbl">MAE</div></div>
          <div class="predict-metric"><div class="val text-amber">±${fmt(res.model_rmse,2)}</div><div class="lbl">RMSE</div></div>
        </div>`;
      toast(`Prediction: ${fmt(res.predicted_hours,1)} hours`, 'success');
    } catch(e) {
      toast(e.message, 'error');
      $('#predict-result').innerHTML = `<i class="fa-solid fa-circle-xmark" style="font-size:36px;color:var(--red)"></i><p class="predict-label">${e.message}</p>`;
    } finally {
      btn.innerHTML = '<i class="fa-solid fa-bolt-lightning"></i> Predict Hours'; btn.disabled = false;
    }
  });
}

// ── Helpers ───────────────────────────────────────────────
function emptyState(icon, msg) {
  return `<div class="empty-state" style="grid-column:1/-1">
    <i class="fa-solid fa-${icon}"></i><p>${msg}</p>
  </div>`;
}

// ── Boot ──────────────────────────────────────────────────
async function init() {
  await checkApi();
  await loadAll();
  await loadDashboard();
  await renderDashboard();
}

init();
