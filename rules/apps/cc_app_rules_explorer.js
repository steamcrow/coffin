// ================================
// Rules Explorer App - Optimized
// File: steamcrow/rules/apps/cc_app_rules_explorer.js
// ================================

console.log("📘 Rules Explorer app loaded");

window.CC_APP = {
  async init({ root, ctx }) {
    console.log("🚀 Rules Explorer init", ctx);

    // ---- ASSET LOADING ----
    const loadStyle = (id, url) => {
      if (document.getElementById(id)) return;
      fetch(`${url}?t=${Date.now()}`)
        .then(res => res.text())
        .then(css => {
          const style = document.createElement('style');
          style.id = id;
          style.textContent = css;
          document.head.appendChild(style);
        })
        .catch(err => console.error(`❌ CSS load failed: ${id}`, err));
    };

    loadStyle('cc-core-ui-styles', 'https://raw.githubusercontent.com/steamcrow/coffin/main/rules/ui/cc_ui.css');
    loadStyle('cc-rules-explorer-styles', 'https://raw.githubusercontent.com/steamcrow/coffin/main/rules/apps/cc_app_rules_explorer.css');

    const helpers = ctx?.helpers;
    const index = Array.isArray(ctx?.rulesBase?.index) ? ctx.rulesBase.index : [];

    if (!helpers) {
      root.innerHTML = `<div class="cc-app-shell h-100"><div class="container py-5 text-danger"><h4>Rules helpers not available</h4><p>Check loader injection.</p></div></div>`;
      return;
    }

    // ---- STATE & CONSTANTS ----
    const STORAGE_KEY = 'cc_rules_favorites';
    const FACTION_FILES = [
      { id: 'monster_rangers', title: 'Monster Rangers', file: 'faction-monster-rangers-v5.json' },
      { id: 'liberty_corps', title: 'Liberty Corps', file: 'faction-liberty-corps-v2.json' },
      { id: 'monsterology', title: 'Monsterology', file: 'faction-monsterology-v2.json' },
      { id: 'monsters', title: 'Monsters', file: 'faction-monsters-v2.json' },
      { id: 'shine_riders', title: 'Shine Riders', file: 'faction-shine-riders-v2.json' }
    ];
    const EXCLUDED_IDS = ['sections_philosophy', 'location_vault', 'location_types', 'scenario_vault', 'objective_vault', 'location_vault_97'];
    
    let factionsData = {};
    let selectedId = null;
    let currentFilter = 'all';
    let filteredIndex = [];

    // ---- UTILITIES ----
    const esc = (s) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
    
    const titleize = (k) => {
      const str = String(k || "");
      if (str.match(/^[A-H]_/)) return `Abilities: ${str.substring(2).replace(/_/g, " ").replace(/\b\w/g, m => m.toUpperCase())}`;
      return str.replace(/_dictionary|_abilities?/, '').replace(/_/g, " ").replace(/\b\w/g, m => m.toUpperCase());
    };

    const getFavorites = () => { try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || []; } catch { return []; } };
    const saveFavorites = (favs) => localStorage.setItem(STORAGE_KEY, JSON.stringify(favs));
    const isFavorite = (id) => getFavorites().includes(id);

    // ---- FACTION DATA LOAD ----
    async function loadFactions() {
      const baseUrl = 'https://raw.githubusercontent.com/steamcrow/coffin/main/factions/';
      const promises = FACTION_FILES.map(async f => {
        try {
          const res = await fetch(`${baseUrl}${f.file}?t=${Date.now()}`);
          const data = await res.json();
          factionsData[f.id] = { title: f.title, data };
        } catch (e) { console.error(`Failed to load faction ${f.id}`, e); }
      });
      await Promise.all(promises);
    }

    // ---- UI SHELL ----
    root.innerHTML = `
      <div class="cc-app-shell h-100">
        <div class="cc-app-header">
          <div>
            <h1 class="cc-app-title">Rules Explorer</h1>
            <div class="cc-app-subtitle">Interactive Coffin Canyon Rules Reference</div>
          </div>
          <button id="cc-print-btn" class="btn btn-sm btn-outline-secondary">🖨️ Print</button>
        </div>
        <div class="cc-rules-explorer">
          <aside class="cc-rules-sidebar">
            <div class="cc-panel h-100">
              <div class="cc-panel-head">
                <div class="btn-group btn-group-sm w-100 mb-3">
                  <button class="btn btn-outline-secondary active" data-filter="all">All</button>
                  <button class="btn btn-outline-secondary" data-filter="favorites">★ Starred</button>
                </div>
                <input id="cc-rule-search" class="form-control form-control-sm cc-input" placeholder="Search rules..." />
              </div>
              <div id="cc-rule-list" class="cc-list"></div>
            </div>
          </aside>
          <main class="cc-rules-main">
            <div class="cc-panel h-100">
              <div class="cc-panel-head d-flex justify-content-between">
                <div class="cc-panel-title">Rule Text</div>
                <button id="cc-favorite-btn" class="btn btn-sm btn-link d-none"><span class="cc-star">☆</span></button>
              </div>
              <div id="cc-rule-detail" class="cc-body cc-rule-reader">
                <div class="cc-welcome-screen p-4 text-center">
                   <h2 style="color:#ff7518">COFFIN CANYON</h2>
                   <p class="lead">Select a rule from the sidebar to begin.</p>
                </div>
              </div>
              <div id="cc-rule-nav" class="cc-rule-nav d-none">
                <button id="cc-prev-btn" class="btn btn-outline-secondary">‹ Previous</button>
                <button id="cc-next-btn" class="btn btn-outline-secondary">Next ›</button>
              </div>
            </div>
          </main>
          <aside class="cc-rules-context" id="cc-rules-context">
            <div class="cc-panel h-100"><div class="cc-panel-head"><div class="cc-panel-title">Subsections</div></div>
            <div id="cc-rule-context" class="cc-body"><div class="cc-muted">No context available.</div></div></div>
          </aside>
        </div>
      </div>`;

    const listEl = root.querySelector("#cc-rule-list");
    const detailEl = root.querySelector("#cc-rule-detail");
    const searchEl = root.querySelector("#cc-rule-search");
    const favBtn = root.querySelector("#cc-favorite-btn");

    // ---- RENDER LOGIC ----
    function renderList() {
      const search = searchEl.value.toLowerCase();
      let items = index.filter(it => !EXCLUDED_IDS.includes(it.id));
      
      if (currentFilter === 'favorites') {
        const favs = getFavorites();
        items = items.filter(it => favs.includes(it.id));
      }

      if (search) {
        items = items.filter(it => it.title?.toLowerCase().includes(search) || it.id.includes(search));
      }

      listEl.innerHTML = items.map(it => `
        <button class="cc-list-item ${it.id === selectedId ? 'active' : ''}" data-id="${it.id}">
          <div class="cc-list-title">${esc(it.title || it.id)}</div>
          <div class="small opacity-50 text-uppercase">${esc(it.type || 'rule')} ${isFavorite(it.id) ? '★' : ''}</div>
        </button>
      `).join('');
    }

    function showRule(id) {
      selectedId = id;
      const meta = index.find(i => i.id === id);
      if (!meta) return;

      favBtn.classList.remove('d-none');
      favBtn.querySelector('.cc-star').innerText = isFavorite(id) ? '★' : '☆';

      // Resolve content via helper or faction data
      let content = helpers.getContent(id);
      
      // If no standard content, check if it's a faction
      if (!content && factionsData[id]) {
        detailEl.innerHTML = renderFaction(id);
      } else {
        detailEl.innerHTML = `<h2>${esc(meta.title)}</h2><div class="cc-content-body">${renderNestedSection(id, content)}</div>`;
      }
      
      renderList();
      updateSubsections(id);
    }

    function renderFaction(factionId) {
      const f = factionsData[factionId];
      if (!f) return '';
      return `
        <h2 style="color: #ff7518">${esc(f.title)}</h2>
        <p class="cc-callout">${esc(f.data.summary || '')}</p>
        <div class="mt-4">
          ${f.data.units?.map(u => `
            <div class="cc-ability-card p-3 mb-3" style="border-left: 4px solid #ff7518; background: rgba(255,255,255,0.03)">
              <div class="d-flex justify-content-between">
                <h4 class="m-0">${esc(u.name)}</h4>
                <div class="fw-bold" style="color:#ff7518">${u.cost}₤</div>
              </div>
              <div class="cc-stats-row d-flex gap-2 my-2">
                <span class="badge bg-dark">Q: ${u.quality}</span>
                <span class="badge bg-dark">D: ${u.defense}</span>
                <span class="badge bg-dark">M: ${u.move}"</span>
              </div>
              <p class="small italic opacity-75">${esc(u.lore || '')}</p>
            </div>
          `).join('')}
        </div>`;
    }

    function renderNestedSection(key, val) {
      if (!val) return '';
      if (typeof val === 'string') return `<p>${esc(val)}</p>`;
      if (Array.isArray(val)) return `<ul>${val.map(v => `<li>${esc(typeof v === 'string' ? v : JSON.stringify(v))}</li>`).join('')}</ul>`;
      
      return Object.entries(val).map(([k, v]) => {
        if (k.startsWith('_')) return '';
        return `<div class="mb-2"><strong class="text-orange">${titleize(k)}:</strong> ${renderNestedSection(k, v)}</div>`;
      }).join('');
    }

    function updateSubsections(id) {
      const children = helpers.getChildren(id) || [];
      const ctxEl = root.querySelector("#cc-rule-context");
      if (!children.length) {
        ctxEl.innerHTML = '<div class="cc-muted">No sub-rules.</div>';
        return;
      }
      ctxEl.innerHTML = children.map(c => `<div class="cc-badge mb-1">${esc(c.title || c.id)}</div>`).join(' ');
    }

    // ---- EVENTS ----
    listEl.addEventListener('click', e => {
      const btn = e.target.closest('.cc-list-item');
      if (btn) showRule(btn.dataset.id);
    });

    searchEl.addEventListener('input', () => renderList());

    root.querySelectorAll('[data-filter]').forEach(b => {
      b.addEventListener('click', () => {
        root.querySelectorAll('[data-filter]').forEach(x => x.classList.remove('active'));
        b.classList.add('active');
        currentFilter = b.dataset.filter;
        renderList();
      });
    });

    favBtn.addEventListener('click', () => {
      const favs = getFavorites();
      const idx = favs.indexOf(selectedId);
      if (idx > -1) favs.splice(idx, 1);
      else favs.push(selectedId);
      saveFavorites(favs);
      showRule(selectedId);
    });

    root.querySelector("#cc-print-btn").addEventListener('click', () => window.print());

    // ---- INIT ----
    await loadFactions();
    renderList();
  }
};
