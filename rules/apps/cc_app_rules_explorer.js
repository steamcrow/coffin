// ================================
// Rules Explorer App - Stability Build
// File: steamcrow/rules/apps/cc_app_rules_explorer.js
// ================================

console.log("📘 Rules Explorer app loaded");

window.CC_APP = {
  async init({ root, ctx }) {
    console.log("🚀 Rules Explorer init", ctx);

    // ---- 1. ASSET LOADING (Preserved) ----
    const loadStyle = (id, url) => {
      if (document.getElementById(id)) return;
      fetch(`${url}?t=${Date.now()}`).then(res => res.text()).then(css => {
        const style = document.createElement('style');
        style.id = id;
        style.textContent = css;
        document.head.appendChild(style);
      }).catch(err => console.error(`❌ CSS load failed: ${id}`, err));
    };

    loadStyle('cc-core-ui-styles', 'https://raw.githubusercontent.com/steamcrow/coffin/main/rules/ui/cc_ui.css');
    loadStyle('cc-rules-explorer-styles', 'https://raw.githubusercontent.com/steamcrow/coffin/main/rules/apps/cc_app_rules_explorer.css');

    // ---- 2. DATA & HELPERS ----
    const helpers = ctx?.helpers;
    const index = Array.isArray(ctx?.rulesBase?.index) ? ctx.rulesBase.index : [];
    const EXCLUDED_IDS = ['sections_philosophy', 'location_vault', 'location_types', 'scenario_vault', 'objective_vault', 'location_vault_97'];
    const STORAGE_KEY = 'cc_rules_favorites';

    if (!helpers) {
      root.innerHTML = `<div class="cc-app-shell h-100"><div class="container py-5 text-danger"><h4>Rules helpers not available</h4></div></div>`;
      return;
    }

    let factionsData = {};
    let selectedId = null;
    let currentFilter = 'all';

    // ---- 3. UTILITIES (Direct Data Access) ----
    const esc = (s) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
    
    const titleize = (k) => {
      const str = String(k || "");
      if (str.match(/^[A-H]_/)) return `Abilities: ${str.substring(2).replace(/_/g, " ").replace(/\b\w/g, m => m.toUpperCase())}`;
      return str.replace(/_dictionary|_abilities?/, '').replace(/_/g, " ").replace(/\b\w/g, m => m.toUpperCase());
    };

    const getRulesRoot = () => (ctx?.rulesBase?.data || ctx?.rulesBase?.root || ctx?.rulesBase || {});

    const resolvePath = (obj, path) => {
      if (!obj || !path) return undefined;
      return String(path).split(".").reduce((cur, p) => (cur && typeof cur === "object") ? cur[p] : undefined, obj);
    };

    const candidatePaths = (metaPath) => {
      const p = String(metaPath || "");
      const out = [p];
      out.push(p.replace(".quality_definition", ".sections.quality"));
      out.push(p.replace(".the_roll", ".sections.the_roll"));
      out.push(p.replace(".defense_and_damage", ".sections.defense_and_damage"));
      out.push(p.replace("rules_master.philosophy", "rules_master.sections.philosophy"));
      return Array.from(new Set(out)).filter(Boolean);
    };

    const getFavorites = () => { try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || []; } catch { return []; } };
    const saveFavorites = (favs) => localStorage.setItem(STORAGE_KEY, JSON.stringify(favs));
    const isFavorite = (id) => getFavorites().includes(id);

    // ---- 4. RENDERERS (Faction Styles Restored) ----
    function renderFaction(factionId) {
      const f = factionsData[factionId];
      if (!f) return '<div class="cc-muted">Faction data missing.</div>';
      const data = f.data;
      return `
        <h2 style="color: #ff7518">${esc(f.title)}</h2>
        <div class="cc-callout mb-4">${esc(data.summary || '')}</div>
        ${(data.units || []).map(u => `
          <div class="cc-ability-card p-3 mb-4" style="background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1);">
            <div class="d-flex justify-content-between align-items-baseline mb-1">
              <h4 class="fw-bold mb-0" style="color: #fff; font-size: 1.25rem;">${esc(u.name)}</h4>
              <div class="fw-bold" style="color: #ff7518; font-size: 1.3rem;">${u.cost}₤</div>
            </div>
            <div class="small text-uppercase mb-2" style="color: #ff7518; font-weight: 700;">${esc(u.type || 'Unit')}</div>
            <div class="d-flex gap-2 mb-3">
              <div class="cc-stat-badge"><span class="cc-stat-label">Q</span><span class="cc-stat-value">${u.quality}</span></div>
              <div class="cc-stat-badge"><span class="cc-stat-label">D</span><span class="cc-stat-value">${u.defense}</span></div>
              <div class="cc-stat-badge"><span class="cc-stat-label">M</span><span class="cc-stat-value">${u.move}"</span></div>
            </div>
            <div class="small italic opacity-75 mb-2">${esc(u.lore || '')}</div>
            ${u.weapon ? `<div class="small"><strong style="color:#ff7518">Weapon:</strong> ${esc(u.weapon)}</div>` : ''}
          </div>
        `).join('')}
      `;
    }

    function renderDeepObject(obj) {
      if (!obj || typeof obj !== 'object') return esc(obj);
      if (Array.isArray(obj)) return `<ul>${obj.map(i => `<li>${typeof i === 'object' ? (i.name || i.text || JSON.stringify(i)) : esc(i)}</li>`).join('')}</ul>`;
      
      return Object.entries(obj).map(([k, v]) => {
        if (k.startsWith('_') || ['id', 'title', 'short'].includes(k)) return '';
        return `<div class="mb-3"><div class="cc-field-label">${esc(titleize(k))}</div><div>${renderDeepObject(v)}</div></div>`;
      }).join('');
    }

    // ---- 5. UI SHELL & INTRO (Restored) ----
    const introHtml = `
      <div class="mb-4">
        <h2 class="cc-rule-title" style="font-size: 2.5rem; margin-bottom: 1rem;">COFFIN CANYON</h2>
        <div style="background: rgba(255,117,24,0.1); border-left: 4px solid #ff7518; padding: 1.5rem; margin-bottom: 2rem; border-radius: 8px;">
          <h3 style="color: #ff7518; margin-top: 0;">What This Game Is</h3>
          <p style="font-size: 1.1rem; line-height: 1.8;">Coffin Canyon is a skirmish game about bad ground, bad choices, and things that do not stay dead. Victory comes from pressure, positioning, and knowing when to run.</p>
        </div>
        <p><strong>Ready to start?</strong> Click any rule in the sidebar to begin!</p>
      </div>`;

    root.innerHTML = `
      <div class="cc-app-shell h-100">
        <div class="cc-app-header">
          <div><h1 class="cc-app-title">Rules Explorer</h1><div class="cc-app-subtitle">Interactive Reference</div></div>
          <button id="cc-print-btn" class="btn btn-sm btn-outline-secondary">🖨️ Print</button>
        </div>
        <div class="cc-rules-explorer">
          <aside class="cc-rules-sidebar"><div class="cc-panel h-100">
            <div class="cc-panel-head">
              <div class="btn-group btn-group-sm w-100 mb-3">
                <button class="btn btn-outline-secondary active" data-filter="all">All</button>
                <button class="btn btn-outline-secondary" data-filter="favorites">★ Starred</button>
              </div>
              <input id="cc-rule-search" class="form-control form-control-sm cc-input" placeholder="Search rules..." />
            </div>
            <div id="cc-rule-list" class="cc-list"></div>
          </div></aside>
          <main class="cc-rules-main"><div class="cc-panel h-100">
            <div class="cc-panel-head d-flex justify-content-between">
              <div class="cc-panel-title">Rule Text</div>
              <button id="cc-favorite-btn" class="btn btn-sm btn-link d-none"><span class="cc-star">☆</span></button>
            </div>
            <div id="cc-rule-detail" class="cc-body cc-rule-reader">${introHtml}</div>
          </div></main>
          <aside class="cc-rules-context"><div class="cc-panel h-100">
            <div class="cc-panel-head"><div class="cc-panel-title">Subsections</div></div>
            <div id="cc-rule-context" class="cc-body cc-muted">Nothing selected.</div>
          </div></aside>
        </div>
      </div>`;

    const listEl = root.querySelector("#cc-rule-list");
    const detailEl = root.querySelector("#cc-rule-detail");
    const searchEl = root.querySelector("#cc-rule-search");
    const favBtn = root.querySelector("#cc-favorite-btn");
    const ctxEl = root.querySelector("#cc-rule-context");

    function renderList() {
      const search = searchEl.value.toLowerCase();
      let items = index.filter(it => !EXCLUDED_IDS.includes(it.id));
      if (currentFilter === 'favorites') items = items.filter(it => isFavorite(it.id));
      if (search) items = items.filter(it => (it.title || '').toLowerCase().includes(search) || it.id.includes(search));

      listEl.innerHTML = items.map(it => `
        <button class="cc-list-item ${it.id === selectedId ? 'active' : ''}" data-id="${it.id}">
          <div class="cc-list-title">${esc(it.title || it.id)}</div>
          <div class="cc-list-sub">${esc(it.type || 'rule')} ${isFavorite(it.id) ? '★' : ''}</div>
        </button>
      `).join('');
    }

    function showRule(id) {
      selectedId = id;
      const meta = index.find(i => i.id === id);
      if (!meta) return;

      favBtn.classList.remove('d-none');
      favBtn.querySelector('.cc-star').innerText = isFavorite(id) ? '★' : '☆';

      // CONTENT RESOLUTION
      if (factionsData[id]) {
        detailEl.innerHTML = renderFaction(id);
      } else {
        const rootObj = getRulesRoot();
        const paths = candidatePaths(meta.path);
        let content = null;
        for (const p of paths) {
          const found = resolvePath(rootObj, p);
          if (found !== undefined) { content = found; break; }
        }
        detailEl.innerHTML = `<h2 class="cc-rule-title">${esc(meta.title || id)}</h2><div class="mt-3">${renderDeepObject(content)}</div>`;
      }

      // SUBSECTIONS LOGIC
      const children = helpers.getChildren(id) || [];
      ctxEl.innerHTML = children.length ? children.map(c => `<div class="cc-badge mb-1">${esc(c.title || c.id)}</div>`).join(' ') : 'None.';
      renderList();
    }

    // ---- 6. EVENTS ----
    listEl.addEventListener('click', e => {
      const btn = e.target.closest('.cc-list-item');
      if (btn) showRule(btn.dataset.id);
    });

    searchEl.addEventListener('input', renderList);

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
      if (idx > -1) favs.splice(idx, 1); else favs.push(selectedId);
      saveFavorites(favs);
      showRule(selectedId);
    });

    // ---- 7. INITIAL LOAD ----
    const FACTION_FILES = [
      { id: 'monster_rangers', title: 'Monster Rangers', file: 'faction-monster-rangers-v5.json' },
      { id: 'liberty_corps', title: 'Liberty Corps', file: 'faction-liberty-corps-v2.json' },
      { id: 'monsterology', title: 'Monsterology', file: 'faction-monsterology-v2.json' },
      { id: 'monsters', title: 'Monsters', file: 'faction-monsters-v2.json' },
      { id: 'shine_riders', title: 'Shine Riders', file: 'faction-shine-riders-v2.json' }
    ];

    const loadFactions = async () => {
      const baseUrl = 'https://raw.githubusercontent.com/steamcrow/coffin/main/factions/';
      await Promise.all(FACTION_FILES.map(async f => {
        try {
          const res = await fetch(`${baseUrl}${f.file}?t=${Date.now()}`);
          factionsData[f.id] = { title: f.title, data: await res.json() };
        } catch (e) {}
      }));
      renderList();
    };

    loadFactions();
  }
};
