// ================================
// Rules Explorer App - Production Final
// File: steamcrow/rules/apps/cc_app_rules_explorer.js
// ================================

console.log("📘 Rules Explorer app loaded");

window.CC_APP = {
  async init({ root, ctx }) {
    console.log("🚀 Rules Explorer init", ctx);

    // ---- 1. ASSET LOADING (Non-blocking) ----
    const loadStyle = (id, url) => {
      if (document.getElementById(id)) return;
      fetch(`${url}?t=${Date.now()}`).then(res => res.text()).then(css => {
        const style = document.createElement('style');
        style.id = id;
        style.textContent = css;
        document.head.appendChild(style);
      }).catch(e => console.error("CSS Load Error", e));
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

    // ---- 3. CORE UTILITIES (Preserved from Source) ----
    const esc = (s) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
    
    const titleize = (k) => {
      const str = String(k || "");
      if (str.match(/^[A-H]_/)) return `Abilities: ${str.substring(2).replace(/_/g, " ").replace(/\b\w/g, m => m.toUpperCase())}`;
      return str.replace(/_dictionary|_abilities?/, '').replace(/_/g, " ").replace(/\b\w/g, m => m.toUpperCase());
    };

    const getRulesRoot = () => (ctx?.rulesBase?.data || ctx?.rulesBase?.root || ctx?.rulesBase || {});

    const resolvePath = (obj, path) => {
      if (!obj || !path) return undefined;
      const parts = String(path).split(".");
      let cur = obj;
      for (const p of parts) {
        if (cur && typeof cur === "object" && p in cur) cur = cur[p];
        else return undefined;
      }
      return cur;
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

    // ---- 4. RECURSIVE RENDER ENGINE (All features preserved) ----
    const PROSE = ['philosophy', 'text', 'long', 'description', 'effect', 'definition', 'logic', 'resolution'];
    const LISTS = ['usage', 'guidelines', 'modifiers', 'restrictions', 'choices', 'process', 'effects', 'rules'];
    const NESTED = ['sections', 'mechanics', 'options', 'outcomes', 'status_conditions'];

    function renderProse(label, val) {
      if (!val) return '';
      const text = typeof val === 'string' ? val : (val.text || val.long || val.description || '');
      if (!text) return '';
      return `<div class="mb-3">${label !== 'long' && label !== 'text' ? `<div class="cc-field-label">${esc(titleize(label))}</div>` : ''}<p class="mb-0">${esc(text)}</p></div>`;
    }

    function renderList(label, arr) {
      if (!Array.isArray(arr) || !arr.length) return '';
      const items = arr.map(i => {
        if (typeof i === 'string') return `<li>${esc(i)}</li>`;
        return `<li><strong>${esc(i.name || i.value || i.trait || 'Item')}:</strong> ${esc(i.effect || i.description || i.result || '')}</li>`;
      }).join('');
      return `<div class="mb-3"><div class="cc-field-label">${esc(titleize(label))}</div><ul>${items}</ul></div>`;
    }

    function renderNested(label, obj, depth = 0) {
      if (!obj || typeof obj !== 'object' || Array.isArray(obj) || depth > 4) return '';
      let html = '';
      if (obj.title && depth > 0) html += `<div class="cc-section-title mb-2">${esc(obj.title)}</div>`;
      
      PROSE.forEach(f => obj[f] && (html += renderProse(f, obj[f])));
      LISTS.forEach(f => obj[f] && (html += renderList(f, obj[f])));
      NESTED.forEach(f => {
        if (obj[f] && typeof obj[f] === 'object') {
          if (Array.isArray(obj[f])) html += renderList(f, obj[f]);
          else Object.entries(obj[f]).forEach(([k, v]) => html += renderNested(k, v, depth + 1));
        }
      });
      return html;
    }

    // ---- 5. UI SHELL ----
    root.innerHTML = `
      <div class="cc-app-shell h-100">
        <div class="cc-app-header">
          <div><h1 class="cc-app-title">Rules Explorer</h1><div class="cc-app-subtitle">Interactive Coffin Canyon Reference</div></div>
          <button id="cc-print-btn" class="btn btn-sm btn-outline-secondary">🖨️ Print</button>
        </div>
        <div class="cc-rules-explorer">
          <aside class="cc-rules-sidebar"><div class="cc-panel h-100"><div class="cc-panel-head">
            <div class="btn-group btn-group-sm w-100 mb-3"><button class="btn btn-outline-secondary active" data-filter="all">All</button><button class="btn btn-outline-secondary" data-filter="favorites">★ Starred</button></div>
            <input id="cc-rule-search" class="form-control form-control-sm cc-input" placeholder="Search rules..." />
          </div><div id="cc-rule-list" class="cc-list"></div></div></aside>
          <main class="cc-rules-main"><div class="cc-panel h-100">
            <div class="cc-panel-head d-flex justify-content-between align-items-center"><div class="cc-panel-title">Rule Text</div><button id="cc-favorite-btn" class="btn btn-sm btn-link d-none"><span class="cc-star">☆</span></button></div>
            <div id="cc-rule-detail" class="cc-body cc-rule-reader">
              <div class="p-4 text-center"><h2 style="color:#ff7518">COFFIN CANYON</h2><p>Select a rule from the sidebar to begin.</p></div>
            </div>
          </div></main>
          <aside class="cc-rules-context"><div class="cc-panel h-100"><div class="cc-panel-head"><div class="cc-panel-title">Subsections</div></div><div id="cc-rule-context" class="cc-body cc-muted">None.</div></div></aside>
        </div>
      </div>`;

    const listEl = root.querySelector("#cc-rule-list");
    const detailEl = root.querySelector("#cc-rule-detail");
    const searchEl = root.querySelector("#cc-rule-search");
    const favBtn = root.querySelector("#cc-favorite-btn");

    // ---- 6. CORE LOGIC ----
    function refreshList() {
      const search = searchEl.value.toLowerCase();
      let items = index.filter(it => !EXCLUDED_IDS.includes(it.id));
      if (currentFilter === 'favorites') items = items.filter(it => isFavorite(it.id));
      if (search) items = items.filter(it => (it.title || '').toLowerCase().includes(search) || it.id.includes(search));

      listEl.innerHTML = items.map(it => `
        <button class="cc-list-item ${it.id === selectedId ? 'active' : ''}" data-id="${it.id}">
          <div class="cc-list-title">${esc(it.title || it.id)}</div>
          <div class="small opacity-50 text-uppercase">${esc(it.type || 'rule')} ${isFavorite(it.id) ? '★' : ''}</div>
        </button>`).join('');
    }

    function showRule(id) {
      selectedId = id;
      const meta = index.find(i => i.id === id);
      if (!meta) return;

      favBtn.classList.remove('d-none');
      favBtn.querySelector('.cc-star').innerText = isFavorite(id) ? '★' : '☆';

      let content = null;
      if (factionsData[id]) {
        // Faction Rendering Logic (same as previous)
        detailEl.innerHTML = `<h2>${esc(factionsData[id].title)}</h2><p class="cc-callout">${esc(factionsData[id].data.summary || '')}</p>` + 
          (factionsData[id].data.units || []).map(u => `<div class="cc-ability-card p-3 mb-3"><strong>${esc(u.name)}</strong> (${u.cost}₤)</div>`).join('');
      } else {
        const rootObj = getRulesRoot();
        const paths = candidatePaths(meta.path);
        for (const p of paths) {
          const found = resolvePath(rootObj, p);
          if (found !== undefined) { content = found; break; }
        }
        detailEl.innerHTML = `<h2>${esc(meta.title || id)}</h2><div class="cc-content-body mt-3">${renderNested(id, content)}</div>`;
      }
      
      const children = helpers.getChildren(id) || [];
      root.querySelector("#cc-rule-context").innerHTML = children.length ? children.map(c => `<div class="cc-badge mb-1">${esc(c.title || c.id)}</div>`).join(' ') : 'None.';
      refreshList();
    }

    // ---- 7. EVENT HANDLERS ----
    listEl.addEventListener('click', e => { const btn = e.target.closest('.cc-list-item'); if (btn) showRule(btn.dataset.id); });
    searchEl.addEventListener('input', refreshList);
    root.querySelectorAll('[data-filter]').forEach(b => b.addEventListener('click', () => {
      root.querySelectorAll('[data-filter]').forEach(x => x.classList.remove('active'));
      b.classList.add('active');
      currentFilter = b.dataset.filter;
      refreshList();
    }));
    favBtn.addEventListener('click', () => {
      const favs = getFavorites();
      const idx = favs.indexOf(selectedId);
      if (idx > -1) favs.splice(idx, 1); else favs.push(selectedId);
      saveFavorites(favs);
      showRule(selectedId);
    });

    // Load Factions and Start
    const baseUrl = 'https://raw.githubusercontent.com/steamcrow/coffin/main/factions/';
    await Promise.all(FACTION_FILES.map(async f => {
      try { const r = await fetch(`${baseUrl}${f.file}?t=${Date.now()}`); factionsData[f.id] = { title: f.title, data: await r.json() }; } catch (e) {}
    }));

    refreshList();
  }
};
