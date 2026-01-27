// ================================
// Rules Explorer App (Optimized)
// File: steamcrow/rules/apps/cc_app_rules_explorer.js
// ================================

window.CC_APP = {
  async init({ root, ctx }) {
    console.log("🚀 Rules Explorer init", ctx);

    // ---- HELPER: Inject CSS ----
    const loadStyle = (id, url) => {
      if (document.getElementById(id)) return Promise.resolve();
      return fetch(`${url}?t=${Date.now()}`)
        .then(res => res.text())
        .then(css => {
          const style = document.createElement('style');
          style.id = id;
          style.textContent = css;
          document.head.appendChild(style);
        })
        .catch(err => console.error(`❌ CSS Load Failure (${id}):`, err));
    };

    // Parallel load styles
    Promise.all([
      loadStyle('cc-core-ui-styles', 'https://raw.githubusercontent.com/steamcrow/coffin/main/rules/ui/cc_ui.css'),
      loadStyle('cc-rules-explorer-styles', 'https://raw.githubusercontent.com/steamcrow/coffin/main/rules/apps/cc_app_rules_explorer.css')
    ]);

    const helpers = ctx?.helpers;
    const index = Array.isArray(ctx?.rulesBase?.index) ? ctx.rulesBase.index : [];

    if (!helpers) {
      root.innerHTML = `<div class="cc-app-shell h-100"><div class="container py-5 text-danger"><h4>Rules helpers not available</h4></div></div>`;
      return;
    }

    // ---- STATE & UTILS ----
    const STORAGE_KEY = 'cc_rules_favorites';
    const esc = (s) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
    
    const getFavorites = () => {
      try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || []; } 
      catch { return []; }
    };

    const toggleFavorite = (id) => {
      const favs = getFavorites();
      const idx = favs.indexOf(id);
      idx > -1 ? favs.splice(idx, 1) : favs.push(id);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(favs));
    };

    // ---- DYNAMIC RENDERING ENGINE ----
    const renderField = (label, value) => {
      if (!value || label.startsWith('_') || label === 'id') return '';
      
      const title = label.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
      
      if (Array.isArray(value)) {
        const items = value.map(v => typeof v === 'object' ? `<li>${esc(v.name || v.text || JSON.stringify(v))}</li>` : `<li>${esc(v)}</li>`).join('');
        return `<div class="mb-3"><div class="cc-field-label">${title}</div><ul>${items}</ul></div>`;
      }
      
      if (typeof value === 'object') {
        return `<div class="ms-3 border-start ps-2">${Object.entries(value).map(([k, v]) => renderField(k, v)).join('')}</div>`;
      }

      return `<div class="mb-2"><strong>${title}:</strong> ${esc(value)}</div>`;
    };

    // ---- APP SHELL SETUP ----
    root.innerHTML = `
      <div class="cc-app-shell h-100">
        <div class="cc-app-header">
          <div><h1 class="cc-app-title">Rules Explorer</h1></div>
          <button id="cc-print-btn" class="btn btn-sm btn-outline-secondary">🖨️ Print</button>
        </div>
        <div class="cc-rules-explorer">
          <aside class="cc-rules-sidebar">
            <div class="cc-panel h-100">
              <div class="cc-panel-head">
                <input id="cc-rule-search" class="form-control form-control-sm cc-input mb-2" placeholder="Search rules..." />
                <div class="btn-group btn-group-sm w-100">
                  <button class="btn btn-outline-secondary active" data-filter="all">All</button>
                  <button class="btn btn-outline-secondary" data-filter="favorites">★ Starred</button>
                </div>
              </div>
              <div id="cc-rule-list" class="cc-list"></div>
            </div>
          </aside>
          <main class="cc-rules-main">
            <div id="cc-rule-detail" class="cc-body cc-rule-reader p-4">
              <div class="text-center cc-muted mt-5">Select a rule to begin.</div>
            </div>
          </main>
        </div>
      </div>`;

    const listEl = root.querySelector("#cc-rule-list");
    const detailEl = root.querySelector("#cc-rule-detail");
    const searchEl = root.querySelector("#cc-rule-search");

    // ---- RENDER LOGIC ----
    const renderList = () => {
      const query = searchEl.value.toLowerCase();
      const filter = root.querySelector('[data-filter].active').dataset.filter;
      const favs = getFavorites();

      const items = index.filter(it => {
        const matchesSearch = it.title?.toLowerCase().includes(query) || it.id.includes(query);
        const matchesFilter = filter === 'all' || favs.includes(it.id);
        return matchesSearch && matchesFilter;
      });

      listEl.innerHTML = items.map(it => `
        <button class="cc-list-item" data-id="${esc(it.id)}">
          <div class="d-flex justify-content-between">
            <span>${esc(it.title || it.id)}</span>
            ${favs.includes(it.id) ? '<span>★</span>' : ''}
          </div>
        </button>
      `).join('');
    };

    const showDetail = (id) => {
      const item = index.find(i => i.id === id);
      if (!item) return;

      // Extract content using existing helpers
      const content = helpers.getContent ? helpers.getContent(id) : item;
      
      detailEl.innerHTML = `
        <div class="d-flex justify-content-between align-items-center mb-4">
          <h2>${esc(item.title || item.id)}</h2>
          <button class="btn btn-sm btn-link fav-toggle" data-id="${id}">
            ${getFavorites().includes(id) ? '★ Favorited' : '☆ Favorite'}
          </button>
        </div>
        <div class="cc-content-body">
          ${Object.entries(content).map(([k, v]) => renderField(k, v)).join('')}
        </div>
      `;
    };

    // ---- EVENTS ----
    searchEl.addEventListener('input', renderList);
    
    root.querySelectorAll('[data-filter]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        root.querySelectorAll('[data-filter]').forEach(b => b.classList.remove('active'));
        e.target.classList.add('active');
        renderList();
      });
    });

    listEl.addEventListener('click', (e) => {
      const btn = e.target.closest('.cc-list-item');
      if (btn) showDetail(btn.dataset.id);
    });

    detailEl.addEventListener('click', (e) => {
      if (e.target.classList.contains('fav-toggle')) {
        toggleFavorite(e.target.dataset.id);
        showDetail(e.target.dataset.id);
        renderList();
      }
    });

    renderList();
  }
};
