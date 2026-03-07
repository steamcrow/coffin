// ================================
// Rules Explorer App
// File: steamcrow/rules/apps/cc_app_rules_explorer.js
// ================================

console.log("📘 Rules Explorer app loaded");

window.CC_APP = {
  async init({ root, ctx }) {
    console.log("🚀 Rules Explorer init", ctx);

    // ---- INJECT CRITICAL LAYOUT CSS IMMEDIATELY (synchronous, no flicker) ----
    // This guarantees the 3-column grid and key layout classes work instantly,
    // even before the async GitHub CSS has arrived.
    if (!document.getElementById('cc-rules-critical-styles')) {
      const critical = document.createElement('style');
      critical.id = 'cc-rules-critical-styles';
      critical.textContent = `
        /* Critical layout — renders immediately without waiting for GitHub */
        .cc-app-shell { background: #0f0f0f; color: #e0e0e0; display: flex; flex-direction: column; height: 100%; font-family: sans-serif; }
        .cc-app-shell.cc-premium { background: radial-gradient(1200px 600px at 20% 0%, rgba(255,117,24,.10), transparent 60%), linear-gradient(180deg,#141414,#0f0f0f); }
        .cc-app-header { display: flex; align-items: center; justify-content: space-between; padding: 0.75rem 1rem; border-bottom: 1px solid rgba(255,255,255,0.08); flex-wrap: wrap; gap: 0.5rem; }
        .cc-app-title { font-size: 1.5rem; color: #ff7518; margin: 0; text-transform: uppercase; letter-spacing: 0.05em; }
        .cc-app-subtitle { font-size: 0.75rem; color: rgba(255,255,255,0.4); text-transform: uppercase; letter-spacing: 0.15em; }
        .cc-rules-explorer { display: grid; grid-template-columns: 280px 1fr 240px; gap: 1rem; height: calc(100% - 60px); padding: 1rem; box-sizing: border-box; }
        .cc-rules-explorer.focus-mode { grid-template-columns: 0 1fr 0; gap: 0; }
        .cc-rules-explorer.focus-mode .cc-rules-sidebar,
        .cc-rules-explorer.focus-mode .cc-rules-context { display: none; }
        .cc-rules-sidebar, .cc-rules-main, .cc-rules-context { min-width: 0; overflow: hidden; }
        .cc-rules-main { overflow-y: auto; }
        .cc-panel { background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.08); border-radius: 8px; height: 100%; display: flex; flex-direction: column; overflow: hidden; }
        .cc-panel-head { padding: 10px 14px; border-bottom: 1px solid rgba(255,255,255,0.08); flex-shrink: 0; }
        .cc-panel-title { font-size: 0.7rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.12em; color: rgba(255,255,255,0.5); margin: 0; }
        .cc-body { padding: 12px; overflow-y: auto; flex: 1; }
        .cc-list { display: flex; flex-direction: column; gap: 4px; padding: 8px; overflow-y: auto; flex: 1; }
        .cc-list-item { background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.07); border-radius: 6px; padding: 8px 10px; cursor: pointer; color: #e0e0e0; font-size: 0.85rem; text-align: left; width: 100%; transition: background 0.15s; }
        .cc-list-item:hover { background: rgba(255,117,24,0.08); border-color: rgba(255,117,24,0.3); }
        .cc-list-item.active { background: rgba(255,117,24,0.15); border-color: rgba(255,117,24,0.5); }
        .cc-list-title { font-weight: 600; line-height: 1.3; }
        .cc-list-sub { font-size: 0.72rem; color: rgba(255,255,255,0.4); text-transform: uppercase; letter-spacing: 0.05em; margin-top: 1px; }
        .cc-rule-reader { padding: 2rem; line-height: 1.7; font-size: 16px; }
        .cc-rule-reader ul, .cc-rule-reader ol { margin-left: 1.5rem; margin-bottom: 1rem; text-align: left !important; }
        .cc-rule-reader li { margin-bottom: 0.4rem; text-align: left !important; }
        .cc-rule-content ul, .cc-rule-content ol { margin-left: 1.5rem; margin-bottom: 1rem; text-align: left !important; }
        .cc-rule-content li { margin-bottom: 0.4rem; text-align: left !important; }
        .cc-rule-article { max-width: 700px; }
        .cc-rule-title { font-size: 2rem; font-weight: 700; color: #ff7518; margin-bottom: 1.5rem; }
        .cc-section-title { font-size: 1.2rem; font-weight: 600; color: #e8e8e8; margin: 2rem 0 1rem; }
        .cc-field-label { font-size: 0.8rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; color: #888; margin-bottom: 0.4rem; }
        .cc-muted { color: rgba(255,255,255,0.4); font-style: italic; padding: 0.5rem 0; }
        .cc-kv { display: flex; gap: 0.75rem; }
        .cc-k { font-weight: 600; color: #aaa; min-width: 120px; }
        .cc-v { color: #e0e0e0; }
        .cc-ability-card { background: rgba(255,117,24,0.05); border: 1px solid rgba(255,117,24,0.15); border-radius: 6px; transition: border-color 0.2s; }
        .cc-badge { background: rgba(255,117,24,0.12); color: #ff9147; border-radius: 4px; font-size: 0.75rem; padding: 2px 8px; }
        .cc-callout { background: rgba(255,117,24,0.08); border-left: 3px solid #ff7518; border-radius: 4px; padding: 0.75rem 1rem; }
        .cc-rule-nav { display: flex; justify-content: space-between; padding: 1rem 2rem; border-top: 1px solid rgba(255,255,255,0.08); flex-shrink: 0; }
        .cc-input { background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.12); border-radius: 6px; color: #e0e0e0; padding: 0.35rem 0.6rem; width: 100%; font-size: 0.85rem; }
        .cc-input::placeholder { color: rgba(255,255,255,0.3); }
        .cc-breadcrumb-link { background: none; border: none; color: #ff7518; cursor: pointer; font-size: inherit; padding: 0; text-decoration: underline; }
        .cc-breadcrumb-current { color: #e8e8e8; }
        .cc-stat-badge { display: inline-flex; align-items: center; gap: 4px; background: rgba(255,255,255,0.07); border-radius: 4px; padding: 2px 8px; }
        .cc-stat-label { font-size: 0.7rem; font-weight: 700; text-transform: uppercase; opacity: 0.7; }
        .cc-stat-value { font-weight: 700; }
        .stat-q { color: #4ade80; } .stat-q-border { border: 1px solid rgba(74,222,128,0.3); }
        .stat-d { color: #60a5fa; } .stat-d-border { border: 1px solid rgba(96,165,250,0.3); }
        .stat-m { color: #f59e0b; } .stat-m-border { border: 1px solid rgba(245,158,11,0.3); }
        .stat-r { color: #f87171; } .stat-r-border { border: 1px solid rgba(248,113,113,0.3); }
        .cc-nav-group button[data-toggle-group]:hover { background: rgba(255,255,255,0.08) !important; }
        @media (max-width: 992px) {
          .cc-rules-explorer { grid-template-columns: 1fr; grid-template-rows: auto 1fr; height: auto; }
          .cc-rules-context { display: none; }
        }
        @media print {
          /* Hide all UI chrome */
          .cc-rules-sidebar, .cc-rules-context, .cc-panel-head, .cc-rule-nav,
          .cc-app-header, .cc-rules-actions, button, .cc-nav-group { display: none !important; }
          /* Full-width single column */
          .cc-rules-explorer { display: block !important; padding: 0 !important; }
          .cc-rules-main { max-width: 100% !important; overflow: visible !important; height: auto !important; }
          .cc-rule-reader { padding: 0.25in 0 !important; max-width: 100% !important; font-size: 10pt !important; line-height: 1.45 !important; }
          /* Page setup — tight margins */
          @page { margin: 0.6in 0.65in; }
          /* Typography */
          body, p, li, td { color: #000 !important; background: #fff !important; font-size: 10pt !important; }
          .cc-rule-title { color: #000 !important; font-size: 16pt !important; margin-bottom: 8pt !important; border-bottom: 1.5pt solid #000; padding-bottom: 4pt; }
          .cc-section-title { color: #000 !important; font-size: 12pt !important; margin-top: 10pt !important; margin-bottom: 4pt !important; }
          .cc-field-label { color: #444 !important; font-size: 8pt !important; margin-bottom: 2pt !important; letter-spacing: 0.08em; }
          /* Compact ability cards — two per row on paper */
          .cc-ability-card { border: 0.75pt solid #999 !important; background: #fff !important;
            padding: 5pt 7pt !important; margin-bottom: 5pt !important;
            page-break-inside: avoid; break-inside: avoid; }
          .cc-ability-card strong { font-size: 9.5pt !important; color: #000 !important; }
          .cc-ability-card p, .cc-ability-card span { font-size: 9pt !important; color: #222 !important; }
          .cc-badge { border: 0.5pt solid #aaa !important; background: #f5f5f5 !important; color: #000 !important; font-size: 7.5pt !important; }
          /* Suppress orphans */
          p, li { orphans: 3; widows: 3; }
          h2,h3,h4,h5,h6 { page-break-after: avoid; }
          /* Remove link underlines */
          a { text-decoration: none !important; color: #000 !important; }
        }
      `;
      document.head.appendChild(critical);
      console.log('✅ Critical layout CSS injected immediately');
    }

    // ---- LOAD FULL CSS FROM GITHUB (enhances everything above) ----
    if (!document.getElementById('cc-core-ui-styles')) {
      fetch('https://raw.githubusercontent.com/steamcrow/coffin/main/rules/ui/cc_ui.css?t=' + Date.now())
        .then(res => res.text())
        .then(css => {
          const style = document.createElement('style');
          style.id = 'cc-core-ui-styles';
          style.textContent = css;
          document.head.appendChild(style);
          console.log('✅ Core UI CSS applied!');
        })
        .catch(err => console.error('❌ Core CSS load failed:', err));
    }

    if (!document.getElementById('cc-rules-explorer-styles')) {
      fetch('https://raw.githubusercontent.com/steamcrow/coffin/main/rules/apps/cc_app_rules_explorer.css?t=' + Date.now())
        .then(res => res.text())
        .then(css => {
          const style = document.createElement('style');
          style.id = 'cc-rules-explorer-styles';
          style.textContent = css;
          document.head.appendChild(style);
          console.log('✅ Rules Explorer CSS applied!');
        })
        .catch(err => console.error('❌ App CSS load failed:', err));
    }

    if (!document.getElementById('cc-print-styles')) {
      fetch('https://raw.githubusercontent.com/steamcrow/coffin/main/rules/ui/cc_print.css?t=' + Date.now())
        .then(res => res.text())
        .then(css => {
          const style = document.createElement('style');
          style.id = 'cc-print-styles';
          style.textContent = css;
          document.head.appendChild(style);
          console.log('✅ Print CSS applied!');
        })
        .catch(() => console.warn('⚠️ cc_print.css not found — using inline print styles'));
    }

    // ---- HELPERS (robust injection + adapter) ----
    // The loader calls window.createRulesHelpers but rules_helpers.js exports
    // window.CC_RULES_HELPERS.createRulesHelpers — name mismatch means the
    // loader gets an empty helpers object and falls back to getById(rulesBase.rules[id])
    // which fails because rulesBase isn't keyed that way.
    // Fix: call createRulesHelpers ourselves with the rulesBase from ctx.

    let helpersRaw = ctx?.helpers || {};

    if (window.CC_RULES_HELPERS?.createRulesHelpers) {
      const rulesBase = ctx?.rulesBase || {};
      try {
        const freshHelpers = window.CC_RULES_HELPERS.createRulesHelpers(rulesBase);
        if (typeof freshHelpers?.getRuleSection === 'function') {
          helpersRaw = freshHelpers;
          console.log('✅ Helpers bootstrapped via CC_RULES_HELPERS.createRulesHelpers');
        }
      } catch (e) {
        console.warn('⚠️ createRulesHelpers failed:', e);
      }
    }

    // Normalise function names across loader versions
    const helpers = {
      ...helpersRaw,
      getRuleSection:
        (typeof helpersRaw.getRuleSection === 'function' && helpersRaw.getRuleSection) ||
        (typeof helpersRaw.getById        === 'function' && helpersRaw.getById)        ||
        (typeof helpersRaw.getSection     === 'function' && helpersRaw.getSection)     ||
        (typeof helpersRaw.getRule        === 'function' && helpersRaw.getRule)        ||
        (typeof helpersRaw.getRuleData    === 'function' && helpersRaw.getRuleData)    ||
        (typeof helpersRaw.fetchSection   === 'function' && helpersRaw.fetchSection)   ||
        null,
      getChildren:
        (typeof helpersRaw.getChildren    === 'function' && helpersRaw.getChildren)    ||
        (typeof helpersRaw.childrenOf     === 'function' && helpersRaw.childrenOf)     ||
        (typeof helpersRaw.getSubsections === 'function' && helpersRaw.getSubsections) ||
        null,
    };

    try {
      console.log("🧰 helpersRaw keys:", Object.keys(helpersRaw || {}));
      console.log("🧰 getRuleSection:", helpers.getRuleSection ? "OK" : "MISSING");
      console.log("🧰 getChildren:",    helpers.getChildren    ? "OK" : "MISSING");
    } catch (e) {}

    const RULES_BASE_URL = 'https://raw.githubusercontent.com/steamcrow/coffin/main/rules/';

    // Load index from GitHub if ctx didn't provide it
    let index = Array.isArray(ctx?.rulesBase?.index) ? ctx.rulesBase.index : [];
    if (index.length === 0) {
      try {
        const idxRes  = await fetch(RULES_BASE_URL + 'rules_base.json?t=' + Date.now());
        const idxData = await idxRes.json();
        index = Array.isArray(idxData) ? idxData
              : Array.isArray(idxData?.index) ? idxData.index
              : Array.isArray(idxData?.rules) ? idxData.rules
              : [];
        console.log('✅ Index loaded from GitHub:', index.length, 'entries');
      } catch (e) {
        console.error('❌ Could not load rules_base.json from GitHub:', e);
      }
    } else {
      console.log('✅ Index from ctx:', index.length, 'entries');
    }

    // Cache for directly-fetched rule files (so we don't re-fetch on every click)
    const directFileCache = {};

    // Fetch a rule's JSON file directly from GitHub using its index entry
    async function fetchRuleDirectly(id) {
      if (directFileCache[id]) return directFileCache[id];
      const meta = index.find(it => it.id === id);
      if (!meta) { console.warn('⚠️ No index entry for:', id); return null; }

      // Try the file field first (e.g. "src/010_core_mechanics.json")
      const filePaths = [
        meta.file                                   && (RULES_BASE_URL + 'src/' + meta.file.replace(/^src\//, '')),
        meta.file                                   && (RULES_BASE_URL + meta.file),
        meta.path && meta.path.includes('/')        && (RULES_BASE_URL + 'src/' + meta.path.split('.')[0] + '.json'),
      ].filter(Boolean);

      for (const url of filePaths) {
        try {
          console.log('📥 Trying direct fetch:', url);
          const res = await fetch(url + '?t=' + Date.now());
          if (!res.ok) continue;
          const data = await res.json();
          const result = { meta, content: data };
          directFileCache[id] = result;
          console.log('✅ Direct fetch success:', id, url);
          return result;
        } catch (e) {
          console.warn('⚠️ Direct fetch failed for:', url, e.message);
        }
      }
      console.error('❌ All direct fetch paths failed for:', id, filePaths);
      return null;
    }

    // ---- SAFETY CHECK ----
    if (typeof helpers.getRuleSection !== "function" || typeof helpers.getChildren !== "function") {
      const found   = Object.keys(helpersRaw || {}).join(", ");
      const globals = [
        ["window.CC_RULES_HELPERS", window.CC_RULES_HELPERS],
        ["window.rules_helpers",    window.rules_helpers],
        ["window.RULES_HELPERS",    window.RULES_HELPERS],
        ["window.CC_HELPERS",       window.CC_HELPERS],
      ]
        .filter(([, v]) => !!v)
        .map(([k, v]) => `${k} (${Object.keys((v.rules || v.api || v) || {}).length} keys)`)
        .join(" • ");

      root.innerHTML = `
        <div class="cc-app-shell h-100">
          <div class="container py-5 text-danger">
            <h4>Rules helpers not available (or missing required functions)</h4>
            <p><strong>Need:</strong> getRuleSection() and getChildren()</p>
            <p><strong>Found keys:</strong> ${found || "(none)"}</p>
            <p><strong>Globals seen:</strong> ${globals || "(none)"}</p>
            <hr/>
            <p class="mb-0">Your loader injected helpers, but the function names don't match what the app expects.</p>
          </div>
        </div>
      `;
      return;
    }

    // ---- FAVORITES SYSTEM ----
    const STORAGE_KEY = 'cc_rules_favorites';

    function getFavorites() {
      try {
        const stored = localStorage.getItem(STORAGE_KEY);
        return stored ? JSON.parse(stored) : [];
      } catch (e) { return []; }
    }

    function saveFavorites(favorites) {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(favorites));
      } catch (e) { console.error('Could not save favorites', e); }
    }

    function isFavorite(id) { return getFavorites().includes(id); }

    function toggleFavorite(id) {
      const favorites = getFavorites();
      const i = favorites.indexOf(id);
      if (i > -1) { favorites.splice(i, 1); } else { favorites.push(id); }
      saveFavorites(favorites);
    }

    // ---- FACTIONS DATA ----
    // NOTE: Crow Queen added here — was missing from original
    const FACTION_FILES = [
      { id: 'monster_rangers', title: 'Monster Rangers', emoji: '🐾', file: 'faction-monster-rangers-v5.json' },
      { id: 'liberty_corps',   title: 'Liberty Corps',   emoji: '⚙️', file: 'faction-liberty-corps-v2.json'  },
      { id: 'monsterology',    title: 'Monsterology',    emoji: '🔬', file: 'faction-monsterology-v2.json'   },
      { id: 'monsters',        title: 'Monsters',        emoji: '👾', file: 'faction-monsters-v2.json'       },
      { id: 'shine_riders',    title: 'Shine Riders',    emoji: '✨', file: 'faction-shine-riders-v2.json'   },
      { id: 'crow_queen',      title: 'Crow Queen',      emoji: '🐦', file: 'faction-crow-queen.json'        },
    ];

    // ---- CAMPAIGN SYSTEM DATA ----
    const CAMPAIGN_FILE = {
      id:    'campaign_system',
      title: 'Campaign System',
      file:  'src/30_campaign_system.json',
    };

    let factionsData = {};
    let campaignData = null;

    // ---- GROUPED SIDEBAR NAVIGATION ----
    // Groups use a match() function so they work with any index IDs.
    const NAV_GROUPS = [
      {
        id: 'core', label: '⚔️ Core Rules',
        match: (it) => ['core_mechanics', 'turn_structure'].includes(it.id),
      },
      {
        id: 'vaults', label: '📖 Vaults',
        match: (it) => ['visibility_vault', 'locomotion_vault', 'combat_vault', 'morale_vault'].includes(it.id),
      },
      {
        id: 'systems', label: '⚙️ Systems',
        match: (it) => ['unit_identities', 'ability_engine'].includes(it.id),
      },
      {
        id: 'abilities', label: '✨ Ability Dictionary',
        match: (it) => Boolean(it.id?.startsWith('ability_dict_')),
      },
      {
        id: 'factions', label: '🏴 Factions',
        match: (it) => Boolean(it.id?.startsWith('faction_')),
      },
      {
        id: 'campaign', label: '🗺️ Campaign',
        match: (it) => it.id === 'campaign_system',
      },
    ];

    // Core and Vaults open by default; others start collapsed.
    let openGroups = new Set(['core', 'vaults']);

    // ---- LOAD FACTIONS ----
    async function loadFactions() {
      const baseUrl = 'https://raw.githubusercontent.com/steamcrow/coffin/main/factions/';
      try {
        const promises = FACTION_FILES.map(async (f) => {
          const response = await fetch(baseUrl + f.file + '?t=' + Date.now());
          const data = await response.json();
          return { id: f.id, title: f.title, data };
        });
        const results = await Promise.all(promises);
        results.forEach(r => { factionsData[r.id] = { title: r.title, data: r.data }; });
        console.log('✅ Factions loaded:', Object.keys(factionsData));
        return true;
      } catch (e) {
        console.error('❌ Failed to load factions:', e);
        return false;
      }
    }

    // ---- LOAD CAMPAIGN ----
    async function loadCampaign() {
      const baseUrl = 'https://raw.githubusercontent.com/steamcrow/coffin/main/rules/';
      try {
        const response = await fetch(baseUrl + CAMPAIGN_FILE.file + '?t=' + Date.now());
        const data = await response.json();
        campaignData = { title: CAMPAIGN_FILE.title, data };
        console.log('✅ Campaign system loaded');
        return true;
      } catch (e) {
        console.error('❌ Failed to load campaign system:', e);
        return false;
      }
    }

    // ---- RENDER FACTION ----
    function renderFaction(factionId) {
      const faction = factionsData[factionId];
      if (!faction) return '<div class="cc-muted">Faction not found</div>';

      const data = faction.data;
      let html = '';

      if (data.summary) {
        html += `<div class="cc-callout mb-4">${esc(data.summary)}</div>`;
      }
      if (data.lore) {
        html += `<div class="mb-4"><p>${esc(data.lore)}</p></div>`;
      }

      if (data.units && Array.isArray(data.units)) {
        html += `<h3 style="color: #ff7518; margin-top: 2rem; margin-bottom: 1.5rem;">Units</h3>`;

        data.units.forEach(unit => {
          html += `
            <div class="cc-ability-card p-3 mb-4" style="background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1);">

              <div class="d-flex justify-content-between align-items-baseline mb-1">
                <h4 class="fw-bold mb-0" style="color: #fff; font-size: 1.25rem;">${esc(unit.name)}</h4>
                <div class="fw-bold" style="color: #ff7518; font-size: 1.3rem;">${unit.cost}₤</div>
              </div>

              <div class="small text-uppercase mb-2" style="color: #ff7518; font-weight: 700; letter-spacing: 0.05em;">${esc(unit.type || 'Unit')}</div>

              ${unit.lore ? `
                <div class="mb-3" style="font-style: italic; opacity: 0.85; font-size: 0.95rem; line-height: 1.5;">${esc(unit.lore)}</div>
              ` : ''}

              <div class="d-flex gap-2 mb-3" style="flex-wrap: wrap;">
                <div class="cc-stat-badge stat-q-border">
                  <div class="cc-stat-label stat-q">Q</div>
                  <div class="cc-stat-value">${unit.quality}</div>
                </div>
                <div class="cc-stat-badge stat-d-border">
                  <div class="cc-stat-label stat-d">D</div>
                  <div class="cc-stat-value">${unit.defense}</div>
                </div>
                <div class="cc-stat-badge stat-m-border">
                  <div class="cc-stat-label stat-m">M</div>
                  <div class="cc-stat-value">${unit.move}"</div>
                </div>
                ${unit.range ? `
                  <div class="cc-stat-badge stat-r-border">
                    <div class="cc-stat-label stat-r">R</div>
                    <div class="cc-stat-value">${unit.range}"</div>
                  </div>
                ` : ''}
              </div>

              ${unit.weapon ? `
                <div class="mb-2">
                  <span class="fw-bold small" style="color: #ff7518;">Weapon:</span>
                  <span style="font-weight: 600;">${esc(unit.weapon)}</span>
                  ${unit.weapon_properties && unit.weapon_properties.length > 0
                    ? ` <span style="opacity: 0.7;">(${unit.weapon_properties.map(p => esc(typeof p === 'string' ? p : p.name || '')).join(', ')})</span>`
                    : ''}
                </div>
              ` : ''}

              ${unit.abilities && unit.abilities.length > 0 ? `
                <div class="mb-3">
                  <div class="fw-bold small mb-1" style="color: #ff7518;">Abilities:</div>
                  <div class="d-flex gap-1" style="flex-wrap: wrap;">
                    ${unit.abilities.map(ability => {
                      let abilityName   = '';
                      let abilityEffect = '';
                      if (typeof ability === 'string') {
                        abilityName = ability;
                        try {
                          const rulesRoot = getRulesRoot();
                          if (rulesRoot && rulesRoot.ability_dictionary) {
                            for (const section in rulesRoot.ability_dictionary) {
                              if (rulesRoot.ability_dictionary[section]?.[abilityName]) {
                                const d = rulesRoot.ability_dictionary[section][abilityName];
                                abilityEffect = d.short || d.effect || d.long || '';
                                break;
                              }
                            }
                          }
                        } catch (e) {}
                      } else if (ability && typeof ability === 'object') {
                        abilityName   = ability.name   || '';
                        abilityEffect = ability.effect || ability.short || '';
                      }
                      const tooltipText = abilityEffect || abilityName;
                      const titleAttr   = ` title="${tooltipText.replace(/"/g, '&quot;')}"`;
                      return `<span class="cc-badge" style="cursor: help;"${titleAttr}>${esc(abilityName)}</span>`;
                    }).join(' ')}
                  </div>
                </div>
              ` : ''}

              ${unit.tactics ? `
                <div class="mt-3 pt-2" style="border-top: 1px solid rgba(255,255,255,0.1);">
                  <div class="fw-bold small mb-1" style="color: #ff7518;">Tactics:</div>
                  <div class="small" style="line-height: 1.5;">${esc(unit.tactics)}</div>
                </div>
              ` : ''}

            </div>
          `;
        });
      }

      return html;
    }

    // ---- RENDER CAMPAIGN ----
    function renderCampaign() {
      if (!campaignData) return '<div class="cc-muted">Campaign system not loaded</div>';
      return renderNestedSection('', campaignData.data, 0);
    }

    // ---- EXCLUDED IDS ----
    const EXCLUDED_IDS = [
      'sections_philosophy',
      'philosophy',
      'philosophy_design',
      'philosophy_and_design',
      'quality_system',
      'the_roll',
      'defense_damage',
      'location_vault',
      'location_types',
      'scenario_vault',
      'objective_vault',
    ];

    // ---- APP SHELL ----
    // cc-premium adds the radial gradient depth from cc_ui.css
    root.innerHTML = `
      <div class="cc-app-shell cc-premium h-100">

        <div class="cc-app-header">
          <div>
            <h1 class="cc-app-title">Rules Explorer</h1>
            <div class="cc-app-subtitle">Interactive Coffin Canyon Rules Reference</div>
          </div>
          <div style="display:flex;gap:0.5rem;align-items:center;">
            <button id="cc-focus-btn" class="btn btn-sm btn-outline-secondary" title="Focus mode — hides sidebars for reading">
              📖 Focus
            </button>
            <button id="cc-print-btn" class="btn btn-sm btn-outline-secondary" title="Print or save as PDF">
              🖨️ PDF
            </button>
          </div>
        </div>

        <div class="cc-rules-explorer">

          <!-- Sidebar (Grouped Table of Contents) -->
          <aside class="cc-rules-sidebar" id="cc-rules-sidebar">
            <div class="cc-panel h-100">
              <div class="cc-panel-head">
                <div class="cc-panel-title mb-3">Rules</div>

                <div class="btn-group btn-group-sm w-100 mb-3" role="group">
                  <button type="button" class="btn btn-outline-secondary active" data-filter="all">All</button>
                  <button type="button" class="btn btn-outline-secondary" data-filter="favorites">★ Starred</button>
                </div>

                <input
                  id="cc-rule-search"
                  class="form-control form-control-sm cc-input w-100"
                  placeholder="Search rules..."
                />
              </div>
              <div id="cc-rule-list" class="cc-list" style="overflow-y: auto; flex: 1;"></div>
            </div>
          </aside>

          <!-- Main content area -->
          <main class="cc-rules-main">
            <div class="cc-panel h-100">
              <div class="cc-panel-head d-flex justify-content-between align-items-center">
                <div class="cc-panel-title">Rule Text</div>
                <div class="cc-rules-actions">
                  <button id="cc-favorite-btn" class="btn btn-sm btn-link d-none" title="Star this rule">
                    <span class="cc-star">☆</span>
                  </button>
                </div>
              </div>

              <div id="cc-rule-detail" class="cc-body cc-rule-reader">
                <div class="mb-4">
                  <h2 class="cc-rule-title" style="font-size: 2.5rem; margin-bottom: 1rem;">COFFIN CANYON</h2>

                  <div style="background: rgba(255,117,24,0.1); border-left: 4px solid #ff7518; padding: 1.5rem; margin-bottom: 2rem; border-radius: 8px;">
                    <h3 style="color: #ff7518; margin-top: 0;">What This Game Is</h3>
                    <p style="font-size: 1.1rem; line-height: 1.8;">
                      Coffin Canyon is a skirmish game about bad ground, bad choices, and things that do not stay dead.
                      It is set in a poisoned canyon where industry, monsters, and desperate people collide.
                      Victory comes from pressure, positioning, and knowing when to run — not from perfect plans.
                    </p>
                    <p style="font-size: 1.1rem; font-style: italic; color: #ff7518; margin-bottom: 0;">This is a game of escalation.</p>
                  </div>

                  <div style="background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.1); padding: 1.5rem; margin-bottom: 2rem; border-radius: 8px;">
                    <h3 style="color: #ff7518; margin-top: 0;">Player Agency Over Optimization</h3>
                    <p>Coffin Canyon rewards:</p>
                    <ul>
                      <li>Positioning</li>
                      <li>Timing</li>
                      <li>Risk assessment</li>
                      <li>Knowing when to retreat</li>
                    </ul>
                    <p>It does not reward:</p>
                    <ul>
                      <li>Perfect list building</li>
                      <li>Static gunlines</li>
                      <li>Passive play</li>
                    </ul>
                    <p style="font-style: italic; color: #ff7518;">If you stand still too long, the Canyon will notice.</p>
                  </div>

                  <div style="background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.1); padding: 1.5rem; margin-bottom: 2rem; border-radius: 8px;">
                    <h3 style="color: #ff7518; margin-top: 0;">The Role of the Game Warden (Optional)</h3>
                    <p>Coffin Canyon does not require a Game Warden. Some games will include one. Some will not.</p>
                    <p>When present, the Game Warden's role is:</p>
                    <ul>
                      <li>Escalation</li>
                      <li>Consequence</li>
                      <li>Rules judgements</li>
                      <li>Atmosphere</li>
                      <li>Running NPC units</li>
                    </ul>
                    <p>They do not override rules. They do not "balance" the game.</p>
                    <p style="font-style: italic;">They reveal what the Canyon has been waiting to do.</p>
                  </div>

                  <div style="background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.1); padding: 1.5rem; margin-bottom: 2rem; border-radius: 8px;">
                    <h3 style="color: #ff7518; margin-top: 0;">What the Rules Assume</h3>
                    <p>The rules assume:</p>
                    <ul>
                      <li>Players agree on terrain intent during setup</li>
                      <li>Scenarios define objectives and pressure</li>
                      <li>Ambiguity is resolved quickly and fairly</li>
                    </ul>
                    <p>If a situation is unclear:</p>
                    <ul>
                      <li>Follow the scenario</li>
                      <li>Then follow the terrain</li>
                      <li>Then roll a die and move on</li>
                    </ul>
                    <p style="font-style: italic;">Momentum matters more than precision.</p>
                  </div>

                  <div style="background: rgba(255,117,24,0.1); border-left: 4px solid #ff7518; padding: 1.5rem; margin-bottom: 2rem; border-radius: 8px;">
                    <h3 style="color: #ff7518; margin-top: 0;">One Final Truth</h3>
                    <p style="font-size: 1.1rem; line-height: 1.8;">
                      Coffin Canyon is not about winning clean. It is about getting out alive, stealing everything not nailed down,
                      or hunting for monster mort.
                    </p>
                    <p style="font-size: 1.1rem; font-style: italic;">(Depending on your Faction, of course.)</p>
                  </div>

                  <h3 style="color: #ff7518; margin-top: 2rem;">How to Use This Tool</h3>
                  <p><strong>Navigate:</strong> Click any rule in the sidebar to view it in the center panel.</p>
                  <p><strong>Star Favorites:</strong> Click the ☆ icon to save rules, subsections, or abilities you reference often. Find them all in the "★ Starred" filter.</p>
                  <p><strong>Search:</strong> Use the search box to quickly find any rule by name or keyword.</p>
                  <p style="margin-bottom: 2rem;"><strong>Print:</strong> Click the Print button in the header to generate a clean, formatted rulebook.</p>
                  <p style="font-size: 1.1rem;"><strong>Ready to start?</strong> Click "Core Mechanics" in the sidebar to begin!</p>
                </div>
              </div>

              <div id="cc-rule-nav" class="cc-rule-nav d-none">
                <button id="cc-prev-btn" class="btn btn-outline-secondary">‹ Previous</button>
                <button id="cc-next-btn" class="btn btn-outline-secondary">Next ›</button>
              </div>
            </div>
          </main>

          <!-- Context sidebar -->
          <aside class="cc-rules-context" id="cc-rules-context">
            <div class="cc-panel h-100">
              <div class="cc-panel-head">
                <div class="cc-panel-title">Subsections</div>
              </div>
              <div id="cc-rule-context" class="cc-body">
                <div class="cc-muted">Nothing selected.</div>
              </div>
            </div>
          </aside>

        </div>
      </div>
    `;

    // ---- DOM HOOKS ----
    const sidebarEl      = root.querySelector("#cc-rules-sidebar");
    const listEl         = root.querySelector("#cc-rule-list");
    const detailEl       = root.querySelector("#cc-rule-detail");
    const ctxEl          = root.querySelector("#cc-rule-context");
    const contextPanelEl = root.querySelector("#cc-rules-context");
    const searchEl       = root.querySelector("#cc-rule-search");
    const navEl          = root.querySelector("#cc-rule-nav");
    const prevBtnEl      = root.querySelector("#cc-prev-btn");
    const nextBtnEl      = root.querySelector("#cc-next-btn");
    const favoriteBtn    = root.querySelector("#cc-favorite-btn");
    const printBtn       = root.querySelector("#cc-print-btn");
    const focusBtn       = root.querySelector("#cc-focus-btn");
    const explorerEl     = root.querySelector(".cc-rules-explorer");

    let selectedId    = null;
    let currentFilter = 'all';
    let filteredIndex = [];

    // ---- SMALL UTILS ----
    const esc = (s) =>
      String(s ?? "")
        .replace(/&/g,  "&amp;")
        .replace(/</g,  "&lt;")
        .replace(/>/g,  "&gt;")
        .replace(/"/g,  "&quot;")
        .replace(/'/g,  "&#39;");

    const titleize = (k) => {
      const str = String(k || "");

      if (str.match(/^[A-H]$/)) {
        const letterMap = {
          A: 'Deployment Timing',  B: 'Movement Positioning',
          C: 'Offense Damage',     D: 'Defense Survival',
          E: 'Morale Fear',        F: 'Terrain Environment',
          G: 'Thyr Ritual',        H: 'Interaction Support',
          I: 'Monster Interactions',
        };
        return letterMap[str] ? `Abilities: ${letterMap[str]}` : `Abilities: ${str}`;
      }

      if (str.match(/^[A-I]_/)) {
        const topic = str.substring(2).replace(/_/g, " ").replace(/\b\w/g, m => m.toUpperCase());
        return `Abilities: ${topic}`;
      }

      if (str.includes('_abilities') || str.includes('_ability')) {
        return str.replace(/_abilities?/, '').replace(/_/g, " ").replace(/\b\w/g, m => m.toUpperCase()) + ' Abilities';
      }

      if (str.includes('_dictionary')) {
        return str.replace(/_dictionary/, '').replace(/_/g, " ").replace(/\b\w/g, m => m.toUpperCase()) + ' Dictionary';
      }

      return str.replace(/_/g, " ").replace(/\b\w/g, m => m.toUpperCase());
    };

    function getRulesRoot() {
      return (
        ctx?.rulesBase?.data  ||
        ctx?.rulesBase?.root  ||
        ctx?.rulesBase?.rules ||
        ctx?.rulesBase?.json  ||
        ctx?.rulesBase        ||
        ctx?.rules            ||
        {}
      );
    }

    function resolvePath(obj, path) {
      if (!obj || !path) return undefined;
      const parts = String(path).split(".");
      let cur = obj;
      for (const p of parts) {
        if (cur && typeof cur === "object" && p in cur) cur = cur[p];
        else return undefined;
      }
      return cur;
    }

    function candidatePaths(metaPath) {
      const p   = String(metaPath || "");
      const out = [p];
      out.push(p.replace(".quality_definition",    ".sections.quality"));
      out.push(p.replace(".the_roll",               ".sections.the_roll"));
      out.push(p.replace(".defense_and_damage",     ".sections.defense_and_damage"));
      out.push(p.replace(".six_based_effects",      ".sections.six_based_effects"));
      out.push(p.replace(".critical_failure",       ".sections.critical_failure"));
      out.push(p.replace(".quality_tracking",       ".sections.quality_tracking"));
      out.push(p.replace("rules_master.philosophy", "rules_master.sections.philosophy"));
      return Array.from(new Set(out)).filter(Boolean);
    }

    function pickBestResolvedContent(meta, sectionContent) {
      if (sectionContent !== undefined && sectionContent !== null) return sectionContent;
      const rootObj = getRulesRoot();
      for (const path of candidatePaths(meta?.path)) {
        const val = resolvePath(rootObj, path);
        if (val !== undefined) return val;
      }
      return sectionContent;
    }

    // ---- FILTER SYSTEM ----
    root.querySelectorAll('[data-filter]').forEach(btn => {
      btn.addEventListener('click', () => {
        root.querySelectorAll('[data-filter]').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        currentFilter = btn.dataset.filter;
        renderList(searchEl.value);
      });
    });

    // ---- RENDER A SINGLE SIDEBAR ITEM ----
    function renderListItem(it) {
      const active  = it.id === selectedId ? "active" : "";
      const starred = isFavorite(it.id);
      return `
        <button class="cc-list-item ${active}" data-id="${esc(it.id)}">
          <div class="d-flex justify-content-between align-items-center w-100">
            <div class="flex-grow-1">
              <div class="cc-list-title">${esc(it.title || it.id)}</div>
              <div class="cc-list-sub">${esc(it.type || "rule")}</div>
            </div>
            <span class="cc-star-btn" data-star-id="${esc(it.id)}"
              style="cursor: pointer; padding: 4px 8px; font-size: 14px;" title="Star/Unstar">
              ${starred ? '★' : '☆'}
            </span>
          </div>
        </button>
      `;
    }

    // ---- LIST RENDER ----
    // Renders grouped navigation by default.
    // Falls back to a flat list during search or when Starred filter is active.
    function renderList(filter = "") {
      const f    = filter.trim().toLowerCase();
      const favs = getFavorites();

      // Build flat item list (unchanged logic from original — this drives filteredIndex for prev/next)
      let allItems = index.filter(it => !EXCLUDED_IDS.includes(it.id));

      if (currentFilter === 'favorites') {
        const indexFavorites = allItems.filter(it => favs.includes(it.id));
        const abilityFavorites = favs
          .filter(fav => fav.startsWith('ability-'))
          .map(fav => ({
            id:    fav,
            title: titleize(fav.replace('ability-', '').replace(/-/g, ' ')),
            type:  'ability',
          }));
        allItems = [...indexFavorites, ...abilityFavorites];
      }

      // Original soft-filter (kept as-is)
      allItems = allItems.filter(it => {
        if (currentFilter === 'favorites') return true;
        const children = helpers.getChildren(it.id);
        if (children && children.length > 0) return true;
        return true;
      });

      if (f) {
        allItems = allItems.filter(it => {
          const hay = `${it.title || ""} ${it.id || ""} ${it.type || ""}`.toLowerCase();
          return hay.includes(f);
        });
      }

      filteredIndex = allItems;

      if (!allItems.length) {
        listEl.innerHTML = `<div class="cc-muted p-2">No matches.</div>`;
        return;
      }

      // ---- FLAT LIST: search mode or favorites mode ----
      if (f || currentFilter === 'favorites') {
        listEl.innerHTML = allItems.map(it => renderListItem(it)).join('');
        return;
      }

      // ---- GROUPED LIST: default view ----
      let html    = '';
      const claimed = new Set();

      NAV_GROUPS.forEach(group => {
        const groupItems = allItems.filter(it => group.match(it));
        if (!groupItems.length) return;
        groupItems.forEach(it => claimed.add(it.id));

        const isOpen = openGroups.has(group.id);
        html += `
          <div class="cc-nav-group" style="margin-bottom: 4px;">
            <button data-toggle-group="${esc(group.id)}"
              style="width: 100%; text-align: left;
                     background: rgba(255,255,255,0.05); border: none; border-radius: 6px;
                     padding: 5px 10px; cursor: pointer;
                     display: flex; justify-content: space-between; align-items: center;
                     color: #e8e8e8; font-size: 0.78rem; font-weight: 600;
                     letter-spacing: 0.03em; margin-bottom: 2px;">
              <span>${esc(group.label)}</span>
              <span style="opacity: 0.5; font-size: 0.7rem;">${isOpen ? '▲' : '▼'}</span>
            </button>
            <div style="display: ${isOpen ? 'block' : 'none'}; padding-left: 4px;">
              ${groupItems.map(it => renderListItem(it)).join('')}
            </div>
          </div>
        `;
      });

      // Anything not matched by a group falls through as ungrouped (future-proofing)
      const ungrouped = allItems.filter(it => !claimed.has(it.id));
      if (ungrouped.length) {
        html += ungrouped.map(it => renderListItem(it)).join('');
      }

      listEl.innerHTML = html || `<div class="cc-muted p-2">No results.</div>`;
    }

    // ============================================
    // IMPROVED RENDERING SYSTEM
    // ============================================

    const PROSE_FIELDS = [
      'philosophy', 'text', 'long', 'short', 'effect', 'description',
      'design_intent', 'definition', 'pool', 'logic', 'resolution',
      'trigger', 'thematic_reason', 'golden_rule', 'fast_resolution',
      'action_cost', 'completion', 'format',
    ];

    const LIST_FIELDS = [
      'usage', 'guidelines', 'modifiers', 'restrictions', 'choices',
      'process', 'sources', 'examples', 'effects', 'penalties',
      'recovery', 'blockers', 'non_blockers', 'absolute',
      'negation_triggers', 'terrain_trait_interactions',
      'flexibility', 'common_actions_list', 'maintenance_steps',
      'rules', 'logic_triggers', 'type_rules',
    ];

    const NESTED_FIELDS = [
      'sections', 'mechanics', 'options', 'melee_rules', 'ranged_rules',
      'rules_hooks', 'outcomes', 'status_conditions', 'attack_fundamentals',
      'damage_resolution', 'the_morale_test', 'six_based_effects',
      'cover_mechanics', 'movement_basics', 'terrain_penalties',
      'model_interaction', 'engagement_and_pressure', 'verticality',
      'trait_priority', 'activation_cycle', 'the_activation',
      'round_definition', 'action_summaries', 'line_of_sight',
      'initiative_logic',
    ];

    function renderProseField(label, value) {
      if (!value) return '';
      if (label === 'short' || label === 'text') return '';

      const lowerLabel = label.toLowerCase();
      if (lowerLabel.includes('id') || lowerLabel === 'ref' || lowerLabel === 'reference') return '';

      let text = '';
      if (typeof value === 'string') {
        text = value;
      } else if (value && typeof value === 'object') {
        text = value.text || value.long || value.description || value.short || '';
      }
      if (!text) return '';
      if (typeof text === 'string' && text.trim().match(/^R-[A-Z0-9-]+$/i)) return '';

      if (label === 'long' || label === 'text') {
        return `<p class="mb-3">${esc(text)}</p>`;
      }

      const className = label.toLowerCase().includes('philosophy') ? 'fw-semibold' : '';
      return `
        <div class="mb-3">
          <div class="cc-field-label">${esc(titleize(label))}</div>
          <p class="${className} mb-0">${esc(text)}</p>
        </div>
      `;
    }

    function renderList_Content(label, arr) {
      if (!Array.isArray(arr) || !arr.length) return '';

      const items = arr.map(item => {
        if (typeof item === 'string') {
          return `<li>${esc(item)}</li>`;
        } else if (item && typeof item === 'object') {
          if (item.name && (item.effect || item.description)) {
            return `<li><strong>${esc(item.name)}:</strong> ${esc(item.effect || item.description)}</li>`;
          } else if (item.value && item.description) {
            return `<li><strong>${esc(item.value)}:</strong> ${esc(item.description)}</li>`;
          } else if (item.trait && item.result) {
            return `<li><strong>${esc(item.trait)}:</strong> ${esc(item.result)}</li>`;
          } else if (item.id && (item.name || item.effect)) {
            return `<li><strong>${esc(item.name || item.id)}:</strong> ${esc(item.effect || '')}</li>`;
          } else {
            const parts = Object.entries(item)
              .filter(([k]) => !k.startsWith('_'))
              .map(([k, v]) => `<strong>${esc(titleize(k))}:</strong> ${esc(v)}`)
              .join(' • ');
            return `<li>${parts}</li>`;
          }
        }
        return '';
      }).filter(Boolean).join('');

      if (!items) return '';

      return `
        <div class="mb-3">
          <div class="cc-field-label">${esc(titleize(label))}</div>
          <ul>${items}</ul>
        </div>
      `;
    }

    function renderNestedSection(label, obj, depth = 0) {
      if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return '';
      if (depth >= 5) return '';

      let html = '';

      const isAbilityDict = Object.values(obj).every(v =>
        typeof v === 'string' || (v && typeof v === 'object' && (v.effect || v.short || v.long))
      );

      if (isAbilityDict) {
        html += `
          <div class="mb-4">
            <div class="cc-field-label">${esc(titleize(label))}</div>
            ${renderAbilityDictionary(obj)}
          </div>
        `;
        return html;
      }

      const hasTitle    = obj.title || obj.name;
      const headerTag   = depth === 0 ? 'h5' : depth === 1 ? 'h6' : 'div';
      const headerClass = depth <= 1 ? 'cc-section-title' : 'cc-field-label';

      if (hasTitle) {
        const displayTitle = obj.title || obj.name || titleize(label);
        const labelTitle   = titleize(label);
        if (displayTitle && displayTitle.match(/^R-[A-Z0-9-]+$/i)) {
          // skip ID-looking titles
        } else if (displayTitle.toLowerCase() === labelTitle.toLowerCase()) {
          // skip duplicates
        } else if (depth > 0) {
          html += `<${headerTag} class="${headerClass} mb-2">${esc(displayTitle)}</${headerTag}>`;
        }
      }

      for (const field of PROSE_FIELDS)  if (obj[field]) html += renderProseField(field, obj[field]);
      for (const field of LIST_FIELDS)   if (obj[field]) html += renderList_Content(field, obj[field]);

      for (const field of NESTED_FIELDS) {
        if (obj[field] && typeof obj[field] === 'object') {
          if (Array.isArray(obj[field])) {
            html += renderList_Content(field, obj[field]);
          } else {
            const nestedKeys = Object.keys(obj[field]).filter(k => !k.startsWith('_'));
            for (const nestedKey of nestedKeys) {
              html += renderNestedSection(nestedKey, obj[field][nestedKey], depth + 1);
            }
          }
        }
      }

      const processedFields = new Set([
        ...PROSE_FIELDS, ...LIST_FIELDS, ...NESTED_FIELDS,
        'title', 'Title', 'name', 'Name', '_id', 'id', 'Id', 'ID',
        'type', 'design_intent', 'designer_notes',
        'effect', 'Effect', 'restriction', 'Restriction', 'trigger', 'Trigger',
        'short', 'Short',
      ]);

      const remainingFields = Object.entries(obj).filter(([k, v]) => {
        if (processedFields.has(k))  return false;
        if (k.startsWith('_'))       return false;
        const lowerKey = k.toLowerCase();
        if (lowerKey.includes('id') || lowerKey.includes('ref')) return false;
        if (v === undefined || v === null || v === '')            return false;
        if (typeof v === 'string') {
          const t = v.trim();
          if (t.match(/^R-[A-Za-z0-9-]+$/))  return false;
          if (t.match(/^[A-Z0-9]{8,}-/))      return false;
          if (t.length < 3)                   return false;
        }
        return true;
      });

      if (remainingFields.length > 0) {
        html += '<div class="mb-3">';
        for (const [key, value] of remainingFields) {
          if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
            html += `
              <div class="cc-kv mb-1">
                <div class="cc-k">${esc(titleize(key))}</div>
                <div class="cc-v">${esc(value)}</div>
              </div>
            `;
          } else if (Array.isArray(value)) {
            html += renderList_Content(key, value);
          } else if (value && typeof value === 'object') {
            html += renderNestedSection(key, value, depth + 1);
          }
        }
        html += '</div>';
      }

      if (html) return `<div class="cc-section mb-4">${html}</div>`;
      return '';
    }

    function renderAbilityDictionary(dict) {
      const currentSectionId = selectedId;

      return Object.entries(dict || {})
        .filter(([key, value]) => {
          if (['id', '_id', 'ID', 'Id'].includes(key)) return false;
          if (typeof value === 'string' && value.match(/^R-[A-Z0-9-]+$/i)) return false;
          const standaloneFields = ['name', 'Name', 'effect', 'Effect', 'restriction', 'Restriction'];
          if (standaloneFields.includes(key) && typeof value === 'string') return false;
          return true;
        })
        .map(([key, ability]) => {
          const abilityId = `ability-${key}`;
          const starred   = isFavorite(abilityId);

          // Store section mapping so the deep-link system can find this ability later
          if (currentSectionId) {
            try {
              const abilityMap = JSON.parse(localStorage.getItem('cc_ability_sections') || '{}');
              abilityMap[abilityId] = currentSectionId;
              localStorage.setItem('cc_ability_sections', JSON.stringify(abilityMap));
            } catch (e) {
              console.warn('Could not store ability section mapping', e);
            }
          }

          if (typeof ability === 'string') {
            return `
              <div class="cc-ability-card p-3 mb-2">
                <div class="d-flex justify-content-between align-items-baseline mb-1">
                  <div class="fw-bold flex-grow-1">${esc(titleize(key))}</div>
                  <button class="btn btn-link p-0 cc-ability-star" data-star-id="${esc(abilityId)}" title="Star this ability">
                    <span class="cc-star">${starred ? '★' : '☆'}</span>
                  </button>
                </div>
                <div>${esc(ability)}</div>
              </div>
            `;
          }

          const a = ability || {};
          return `
            <div class="cc-ability-card p-3 mb-2">
              <div class="d-flex justify-content-between align-items-baseline mb-1">
                <div class="fw-bold flex-grow-1">${esc(a.name || titleize(key))}</div>
                <div class="d-flex align-items-center gap-2">
                  ${a.timing ? `<div class="cc-muted small text-uppercase">${esc(a.timing)}</div>` : ''}
                  <button class="btn btn-link p-0 cc-ability-star" data-star-id="${esc(abilityId)}" title="Star this ability">
                    <span class="cc-star">${starred ? '★' : '☆'}</span>
                  </button>
                </div>
              </div>
              ${a.short       ? `<div class="fw-semibold mb-1">${esc(a.short)}</div>` : ''}
              ${a.long        ? `<div>${esc(a.long)}</div>` : ''}
              ${a.effect      ? `<div>${esc(a.effect)}</div>` : ''}
              ${a.trigger     ? `<div class="mt-1"><strong>Trigger:</strong> ${esc(a.trigger)}</div>` : ''}
              ${a.restriction ? `<div class="cc-muted small mt-1">${esc(a.restriction)}</div>` : ''}
              ${a.restrictions ? `<div class="cc-muted small mt-1">${esc(Array.isArray(a.restrictions) ? a.restrictions.join(' • ') : a.restrictions)}</div>` : ''}
            </div>
          `;
        })
        .join('');
    }

    // ---- ARCHETYPE VAULT RENDERER ----
    // Handles the shape in 70_unit_identities.json:
    // { identity, type_rule, type_rules[], effect, logic_triggers[], sub-rule objects }
    function isArchetypeEntry(obj) {
      return obj && typeof obj === 'object' && !Array.isArray(obj) &&
        (obj.type_rule || obj.type_rules || obj.identity) &&
        !obj.timing; // don't confuse with ability dict entries
    }

    function renderArchetypeVault(vault) {
      let html = '';
      for (const [key, archetype] of Object.entries(vault)) {
        if (key.startsWith('_') || !isArchetypeEntry(archetype)) continue;

        const name = titleize(key);
        const identity = archetype.identity || '';

        // Collect all type rules (may be a single string or an array)
        const typeRules = archetype.type_rules
          ? archetype.type_rules
          : archetype.type_rule
            ? [archetype.type_rule]
            : [];

        // Collect sub-rule effect objects (e.g. fire_superiority, command_presence)
        const subRuleKeys = Object.keys(archetype).filter(k =>
          !['_id','identity','type_rule','type_rules','effect','logic_triggers'].includes(k) &&
          !k.startsWith('_') &&
          typeof archetype[k] === 'object' && archetype[k] !== null && !Array.isArray(archetype[k])
        );

        html += `
          <div class="cc-ability-card mb-4 p-3" style="border-radius:8px;">
            <h4 style="color:#ff7518;font-size:1.1rem;font-weight:700;margin:0 0 0.25rem 0;">${esc(name)}</h4>
            ${identity ? `<p style="color:#aaa;font-size:0.85rem;font-style:italic;margin:0 0 0.75rem 0;">${esc(identity)}</p>` : ''}

            ${typeRules.map(rule => `
              <div style="margin-bottom:0.75rem;">
                <div style="font-size:0.7rem;font-weight:700;text-transform:uppercase;letter-spacing:0.1em;
                            color:rgba(255,117,24,0.7);margin-bottom:0.25rem;">Type Rule</div>
                <div style="font-weight:700;color:#e8e8e8;font-size:0.95rem;">${esc(rule)}</div>
              </div>
            `).join('')}

            ${archetype.effect ? `
              <div class="mb-2">
                <div class="cc-field-label">Effect</div>
                <p style="margin:0;line-height:1.6;">${esc(archetype.effect)}</p>
              </div>
            ` : ''}

            ${subRuleKeys.map(k => {
              const sub = archetype[k];
              return sub.effect ? `
                <div class="mb-2" style="padding-left:0.75rem;border-left:2px solid rgba(255,117,24,0.3);">
                  <div style="font-weight:700;color:#e8e8e8;font-size:0.85rem;margin-bottom:0.2rem;">${esc(titleize(k))}</div>
                  <p style="margin:0;font-size:0.9rem;color:#ccc;line-height:1.5;">${esc(sub.effect)}</p>
                </div>
              ` : '';
            }).join('')}

            ${Array.isArray(archetype.logic_triggers) && archetype.logic_triggers.length ? `
              <div class="mt-2">
                <div class="cc-field-label">Logic Triggers</div>
                <ul style="margin:0.25rem 0 0 1.25rem;padding:0;">
                  ${archetype.logic_triggers.map(t => `<li style="color:#aaa;font-size:0.875rem;">${esc(t)}</li>`).join('')}
                </ul>
              </div>
            ` : ''}
          </div>
        `;
      }
      return html;
    }

    function renderContentSmart(meta, content) {
      if (content === undefined || content === null) {
        return `<div class="cc-muted">No content available.</div>`;
      }
      if (typeof content === 'string') return `<p>${esc(content)}</p>`;
      if (typeof content !== 'object') return `<p>${esc(String(content))}</p>`;

      // Unit identities: top-level object with archetype_vault
      if (content.archetype_vault && typeof content.archetype_vault === 'object') {
        let html = '';
        if (content.philosophy) {
          const p = content.philosophy;
          html += `<div class="cc-callout mb-4"><p style="margin:0;font-style:italic;">${esc(p.long || p.short || '')}</p></div>`;
        }
        html += renderArchetypeVault(content.archetype_vault);
        if (content.logic_notes) {
          html += `<div class="mt-3"><div class="cc-field-label">Logic Notes</div>`;
          for (const [k, v] of Object.entries(content.logic_notes)) {
            if (k.startsWith('_')) continue;
            html += `<p><strong>${esc(titleize(k))}:</strong> ${esc(typeof v === 'string' ? v : JSON.stringify(v))}</p>`;
          }
          html += `</div>`;
        }
        return html;
      }

      // Direct archetype vault (if content IS the vault)
      const archetypeValues = Object.values(content).filter(v => isArchetypeEntry(v));
      if (archetypeValues.length >= 3) {
        return renderArchetypeVault(content);
      }

      if (content.abilities && typeof content.abilities === 'object') {
        return renderAbilityDictionary(content.abilities);
      }
      if (content.properties && typeof content.properties === 'object') {
        return renderAbilityDictionary(content.properties);
      }

      const isFlatAbilityDict = Object.values(content).every(v =>
        typeof v === 'string' ||
        (v && typeof v === 'object' && !Array.isArray(v) && (v.effect || v.short || v.long || v.description))
      );
      if (isFlatAbilityDict && !content.sections && !content.text) {
        return renderAbilityDictionary(content);
      }

      return renderNestedSection('', content, 0) || `<div class="cc-muted">No renderable content found.</div>`;
    }

    // ---- BREADCRUMB ----
    // NOTE: renderBreadcrumb was defined in original but never called. Now it's used.
    function renderBreadcrumb(meta) {
      if (!meta) return '';

      const parts = [];
      let current = meta;
      while (current) {
        parts.unshift(current);
        current = current.parent ? index.find(it => it.id === current.parent) : null;
      }

      if (parts.length <= 1) return '';

      return parts.map((p, i) => {
        const isLast = i === parts.length - 1;
        if (isLast) {
          return `<span class="cc-breadcrumb-current">${esc(p.title || p.id)}</span>`;
        } else {
          return `<button class="cc-breadcrumb-link" data-id="${esc(p.id)}">${esc(p.title || p.id)}</button>`;
        }
      }).join(' › ');
    }

    // ---- SELECT RULE ----
    async function selectRule(id) {

      // ---- CAMPAIGN ----
      if (id === 'campaign_system') {
        selectedId = id;
        renderList(searchEl.value);

        favoriteBtn.classList.remove('d-none');
        favoriteBtn.querySelector('.cc-star').textContent = isFavorite(id) ? '★' : '☆';

        detailEl.innerHTML = `
          <article class="cc-rule-article">
            <h2 class="cc-rule-title">${esc(CAMPAIGN_FILE.title)}</h2>
            <div class="cc-rule-content">${renderCampaign()}</div>
          </article>
        `;
        contextPanelEl.style.display = 'none';
        navEl.classList.remove('d-none');
        updateNavigation();
        return;
      }

      // ---- FACTION ----
      if (id.startsWith('faction_')) {
        const factionId = id.replace('faction_', '');

        // If factions haven't loaded yet, wait for them now
        if (!factionsData[factionId]) {
          detailEl.innerHTML = `<div class="cc-muted" style="padding:2rem">Loading faction data…</div>`;
          await loadFactions();
        }

        const faction = factionsData[factionId];

        if (faction) {
          selectedId = id;
          renderList(searchEl.value);

          favoriteBtn.classList.remove('d-none');
          favoriteBtn.querySelector('.cc-star').textContent = isFavorite(id) ? '★' : '☆';

          detailEl.innerHTML = `
            <article class="cc-rule-article">
              <h2 class="cc-rule-title">${esc(faction.title)}</h2>
              <div class="cc-rule-content">${renderFaction(factionId)}</div>
            </article>
          `;
          contextPanelEl.style.display = 'none';
          navEl.classList.remove('d-none');

          const ci = filteredIndex.findIndex(it => it.id === selectedId);
          prevBtnEl.disabled = ci <= 0;
          nextBtnEl.disabled = ci >= filteredIndex.length - 1;
          if (ci > 0)                        prevBtnEl.onclick = () => selectRule(filteredIndex[ci - 1].id);
          if (ci < filteredIndex.length - 1) nextBtnEl.onclick = () => selectRule(filteredIndex[ci + 1].id);

          return;
        } else {
          detailEl.innerHTML = `<div class="cc-muted" style="padding:2rem">⚠️ Could not load faction: ${esc(factionId)}</div>`;
          return;
        }
      }

      // ---- SUBSECTION SCROLL (if already on parent) ----
      if (selectedId) {
        const children         = helpers.getChildren(selectedId);
        const isChildOfCurrent = children.some(c => c.id === id);

        if (isChildOfCurrent) {
          const targetSection = detailEl.querySelector(`#section-${id}`);
          if (targetSection) {
            targetSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
            targetSection.style.color = '#ff7518';
            setTimeout(() => { targetSection.style.color = ''; }, 2000);
            return;
          }
        }
      }

      // ---- NORMAL RULE ----
      selectedId = id;
      detailEl.innerHTML = `<div class="cc-muted" style="padding:2rem">Loading…</div>`;
      ctxEl.innerHTML    = `<div class="cc-muted">Loading…</div>`;

      const raw = await helpers.getRuleSection(id);
      console.log('📦 getRuleSection raw result for', id, '→', raw);

      // Normalise: the helper may return { meta, content } OR just the meta/section object
      let section = null;
      if (raw && raw.meta) {
        section = raw;
      } else if (raw && (raw.id || raw.title || raw.path)) {
        section = { meta: raw, content: raw.content || raw.data || null };
      } else if (raw && typeof raw === 'object') {
        const metaFromIndex = index.find(it => it.id === id);
        section = { meta: metaFromIndex || { id, title: id }, content: raw };
        console.warn('⚠️ Unexpected getRuleSection shape — salvaged:', section);
      }

      // ---- DIRECT FETCH FALLBACK ----
      // If helpers returned nothing useful, fetch the file straight from GitHub
      if (!section || !section.meta) {
        console.warn('⚠️ getRuleSection gave nothing — trying direct GitHub fetch for:', id);
        section = await fetchRuleDirectly(id);
      }

      if (!section || !section.meta) {
        console.error('❌ Could not load rule:', id, '— raw:', raw);
        detailEl.innerHTML = `
          <div style="padding:2rem">
            <p style="color:#ff7518;font-weight:700">Could not load: ${esc(id)}</p>
            <p style="color:#888;font-size:0.85rem">
              Check the browser console (F12) for details.<br>
              <code>getRuleSection</code> returned: <code>${esc(JSON.stringify(raw)?.slice(0, 200) ?? 'null')}</code>
            </p>
          </div>`;
        ctxEl.innerHTML    = `<div class="cc-muted">—</div>`;
        navEl.classList.add('d-none');
        favoriteBtn.classList.add('d-none');
        return;
      }

      const meta     = section.meta;
      const children = helpers.getChildren(id);

      const resolvedContent = pickBestResolvedContent(meta, section.content);

      const hasRealContent = resolvedContent && (
        typeof resolvedContent === 'string' ||
        (typeof resolvedContent === 'object' && Object.keys(resolvedContent).some(k =>
          !k.startsWith('_') && k !== 'id' && k !== 'title' && resolvedContent[k]
        ))
      );

      if (!hasRealContent) {
        detailEl.innerHTML = `<div class="cc-muted">This section has no content yet.</div>`;
        navEl.classList.add('d-none');
        favoriteBtn.classList.add('d-none');
        contextPanelEl.style.display = 'none';
        renderList(searchEl.value);
        return;
      }

      // Special title handling for ability dictionary sections
      let displayTitle = meta.title || "";
      if (meta.type === 'abilities' || meta.id.includes('ability_dict')) {
        if (resolvedContent && typeof resolvedContent === 'object') {
          const firstKey = Object.keys(resolvedContent)[0];
          if (firstKey && firstKey.match(/^[A-H]$/)) {
            displayTitle = titleize(firstKey);
          }
        }
      }

      const formattedContent = renderContentSmart(meta, resolvedContent);
      const breadcrumb       = renderBreadcrumb(meta);

      // ---- FAVORITE BUTTON ----
      favoriteBtn.classList.remove('d-none');
      favoriteBtn.querySelector('.cc-star').textContent = isFavorite(id) ? '★' : '☆';

      // ---- MAIN CONTENT ----
      detailEl.innerHTML = `
        <article class="cc-rule-article">
          ${breadcrumb ? `<div style="font-size: 0.75rem; color: #888; margin-bottom: 0.5rem;">${breadcrumb}</div>` : ''}
          <h2 class="cc-rule-title">${esc(displayTitle)}</h2>
          <div class="cc-rule-content">${formattedContent}</div>
        </article>
      `;

      // Anchor IDs for subsection scroll
      if (children.length > 0) {
        children.forEach(child => {
          const el = detailEl.querySelector('h2, h3, h4, h5, h6');
          if (el && el.textContent.trim() === child.title) {
            el.id = `section-${child.id}`;
          }
        });
      }

      // ---- CONTEXT PANEL ----
      let contextHtml = '';

      let designIntentText = null;
      if (resolvedContent && typeof resolvedContent === 'object') {
        if      (resolvedContent.design_intent)                          designIntentText = resolvedContent.design_intent;
        else if (resolvedContent.meta?.design_intent)                    designIntentText = resolvedContent.meta.design_intent;
        else if (resolvedContent.designer_notes)                         designIntentText = resolvedContent.designer_notes;
        else if (resolvedContent.description?.design_intent)             designIntentText = resolvedContent.description.design_intent;
      }

      if (designIntentText) {
        if (typeof designIntentText === 'object') {
          designIntentText = designIntentText.text        ||
                             designIntentText.description ||
                             designIntentText.note        ||
                             designIntentText.content     ||
                             JSON.stringify(designIntentText, null, 2);
        }
        contextHtml += `
          <div class="cc-callout mb-3">
            <div class="fw-bold small text-uppercase mb-2" style="color: #ff7518;">Designer Notes</div>
            <div class="small">${esc(String(designIntentText))}</div>
          </div>
        `;
      }

      if (children.length > 0) {
        contextHtml += `
          <div class="fw-bold small text-uppercase mb-2" style="color: #ff7518;">Subsections</div>
          <ul class="list-unstyled">
            ${children.map(c => `
              <li class="mb-2 d-flex justify-content-between align-items-center">
                <button class="btn btn-link p-0 text-start flex-grow-1" data-id="${esc(c.id)}">
                  ${esc(c.title)}
                </button>
                <button class="btn btn-link p-0 cc-context-star" data-star-id="${esc(c.id)}" title="Star this rule">
                  <span class="cc-star">${isFavorite(c.id) ? '★' : '☆'}</span>
                </button>
              </li>`).join('')}
          </ul>
        `;
      }

      if (contextHtml) {
        contextPanelEl.style.display = 'block';
        ctxEl.innerHTML = contextHtml;
      } else {
        contextPanelEl.style.display = 'none';
      }

      updateNavigation();
      renderList(searchEl.value);
    }

    // ---- NAVIGATION ----
    function updateNavigation() {
      const ci = filteredIndex.findIndex(it => it.id === selectedId);
      if (ci === -1) { navEl.classList.add('d-none'); return; }

      navEl.classList.remove('d-none');
      prevBtnEl.disabled = ci === 0;
      nextBtnEl.disabled = ci === filteredIndex.length - 1;
      if (ci > 0)                        prevBtnEl.onclick = () => selectRule(filteredIndex[ci - 1].id);
      if (ci < filteredIndex.length - 1) nextBtnEl.onclick = () => selectRule(filteredIndex[ci + 1].id);
    }

    // ---- FOCUS MODE ----
    focusBtn.addEventListener('click', () => {
      const isActive = explorerEl.classList.toggle('focus-mode');
      focusBtn.textContent = isActive ? '⬅️ Panels' : '📖 Focus';
      focusBtn.title = isActive ? 'Show sidebars' : 'Focus mode — hides sidebars for reading';
    });

    // ---- PRINT / PDF ----
    printBtn.addEventListener('click', () => {
      // Auto-enter focus mode for clean print, then restore
      const wasFocused = explorerEl.classList.contains('focus-mode');
      if (!wasFocused) explorerEl.classList.add('focus-mode');
      setTimeout(() => {
        window.print();
        if (!wasFocused) explorerEl.classList.remove('focus-mode');
      }, 150);
    });

    // ---- EVENTS: SIDEBAR LIST ----
    listEl.addEventListener("click", async (e) => {

      // Group header toggle
      const toggleBtn = e.target.closest('[data-toggle-group]');
      if (toggleBtn) {
        const gid = toggleBtn.dataset.toggleGroup;
        openGroups.has(gid) ? openGroups.delete(gid) : openGroups.add(gid);
        renderList(searchEl.value);
        return;
      }

      // Sidebar star toggle
      if (e.target.closest('.cc-star-btn')) {
        const starBtn = e.target.closest('.cc-star-btn');
        const itemId  = starBtn.dataset.starId;
        if (itemId) {
          toggleFavorite(itemId);
          renderList(searchEl.value);
          if (selectedId === itemId) {
            favoriteBtn.querySelector('.cc-star').textContent = isFavorite(itemId) ? '★' : '☆';
          }
        }
        e.stopPropagation();
        return;
      }

      const btn = e.target.closest("button[data-id]");
      if (!btn) return;

      const clickedId = btn.dataset.id;
      console.log('📍 Clicked item:', clickedId);

      // ---- ABILITY DEEP-LINK ----
      // When a starred ability is clicked, find which section it lives in,
      // load that section, then scroll + highlight the specific ability card.
      if (clickedId.startsWith('ability-')) {
        const abilityId          = clickedId.replace('ability-', '');
        const abilityNameDisplay = titleize(abilityId.replace(/_/g, ' ').replace(/-/g, ' '));

        console.log('🔍 Looking for starred ability:', clickedId);

        let foundSection = null;
        try {
          const abilityMap = JSON.parse(localStorage.getItem('cc_ability_sections') || '{}');
          foundSection = abilityMap[clickedId];
          if (foundSection) console.log('✅ Found stored section:', foundSection);
        } catch (e) {
          console.warn('Could not load ability section mapping', e);
        }

        if (!foundSection) {
          console.log('⚠️ No stored section, searching all sections...');
          const normalizedSearch = abilityId.toLowerCase().replace(/[^a-z0-9]/g, '');
          console.log('Normalized search term:', normalizedSearch);

          for (const item of index) {
            try {
              const section = await helpers.getRuleSection(item.id);
              if (section && section.content) {
                for (const key of Object.keys(section.content)) {
                  const normalizedKey = key.toLowerCase().replace(/[^a-z0-9]/g, '');
                  if (normalizedKey === normalizedSearch ||
                      normalizedKey.includes(normalizedSearch) ||
                      normalizedSearch.includes(normalizedKey)) {
                    foundSection = item.id;
                    console.log('✅ Found ability', key, 'in section', item.id, item.title);
                    break;
                  }
                }
                if (foundSection) break;
              }
            } catch (e) {
              console.error('Error loading section', item.id, e);
              continue;
            }
          }

          if (!foundSection) console.error('❌ Searched all', index.length, 'sections, could not find:', abilityId);
        }

        if (foundSection) {
          await selectRule(foundSection);

          setTimeout(() => {
            const abilityCards = detailEl.querySelectorAll('.cc-ability-card');
            let targetCard = null;

            for (const card of abilityCards) {
              const cardTitle = card.querySelector('.fw-bold');
              if (cardTitle) {
                const titleText  = cardTitle.textContent.toLowerCase().replace(/[^a-z0-9]/g, '');
                const searchText = abilityId.toLowerCase().replace(/[^a-z0-9]/g, '');
                if (titleText.includes(searchText) || searchText.includes(titleText)) {
                  targetCard = card;
                  break;
                }
              }
            }

            if (targetCard) {
              targetCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
              targetCard.style.borderColor = '#ff7518';
              targetCard.style.boxShadow   = '0 0 0 2px rgba(255,117,24,0.3)';
              setTimeout(() => {
                targetCard.style.borderColor = '';
                targetCard.style.boxShadow   = '';
              }, 2000);
              console.log('✅ Scrolled to ability');
            } else {
              console.warn('⚠️ Loaded section but could not find ability card');
            }
          }, 500);

        } else {
          console.error('❌ Could not find section');
          detailEl.innerHTML = `
            <div class="cc-muted p-4">
              <h4 style="color: #ff7518;">Could not locate "${esc(abilityNameDisplay)}"</h4>
              <p>The ability may have been moved or renamed in the rules.</p>
              <p><strong>Try this:</strong> Use the search box to find it manually, then star it again.</p>
            </div>
          `;
        }
        return;
      }

      // Normal rule click
      await selectRule(clickedId);
    });

    // ---- EVENTS: CONTEXT PANEL ----
    ctxEl.addEventListener("click", (e) => {
      const navBtn = e.target.closest("button[data-id]");
      if (navBtn) { selectRule(navBtn.dataset.id); return; }

      const starBtn = e.target.closest("button[data-star-id]");
      if (starBtn) {
        const starId = starBtn.dataset.starId;
        toggleFavorite(starId);
        starBtn.querySelector('.cc-star').textContent = isFavorite(starId) ? '★' : '☆';
        renderList(searchEl.value);
        e.stopPropagation();
      }
    });

    // ---- EVENTS: DETAIL PANEL ----
    detailEl.addEventListener('click', (e) => {
      // Breadcrumb navigation (renderBreadcrumb was defined but never wired up before)
      const breadcrumbLink = e.target.closest('.cc-breadcrumb-link');
      if (breadcrumbLink?.dataset.id) {
        selectRule(breadcrumbLink.dataset.id);
        return;
      }

      // Per-ability star toggle
      const starBtn = e.target.closest("button.cc-ability-star");
      if (starBtn) {
        const starId = starBtn.dataset.starId;
        toggleFavorite(starId);
        starBtn.querySelector('.cc-star').textContent = isFavorite(starId) ? '★' : '☆';
        renderList(searchEl.value);
        e.stopPropagation();
      }
    });

    // ---- EVENTS: SEARCH ----
    searchEl.addEventListener("input", () => {
      // Open all groups when the user starts typing so every match is visible
      if (searchEl.value.trim()) {
        NAV_GROUPS.forEach(g => openGroups.add(g.id));
      }
      renderList(searchEl.value);
    });

    // ---- EVENTS: MAIN FAVOURITE BUTTON ----
    favoriteBtn.addEventListener('click', () => {
      if (!selectedId) return;
      toggleFavorite(selectedId);
      favoriteBtn.querySelector('.cc-star').textContent = isFavorite(selectedId) ? '★' : '☆';
      renderList(searchEl.value);

      if (currentFilter === 'favorites' && !isFavorite(selectedId)) {
        if (filteredIndex.length === 0) {
          detailEl.innerHTML = `<div class="cc-muted">No starred rules yet. Click the ☆ icon on any rule to star it!</div>`;
          contextPanelEl.style.display = 'none';
          navEl.classList.add('d-none');
          favoriteBtn.classList.add('d-none');
        }
      }
    });

    // ---- INIT ----

    // Improve ability dictionary titles from path data
    index.forEach(item => {
      if (item.id?.startsWith('ability_dict_') && item.path) {
        const parts    = item.path.split('.');
        const lastPart = parts[parts.length - 1];
        if (lastPart?.match(/^[A-I]_/)) {
          item.title = `Abilities: ${lastPart.substring(2).replace(/_/g, ' ').replace(/\b\w/g, m => m.toUpperCase())}`;
        }
      }
    });

    renderList();

    // Background-load campaign → add to index → refresh sidebar
    loadCampaign().then(() => {
      if (!index.find(it => it.id === CAMPAIGN_FILE.id)) {
        index.push({ id: CAMPAIGN_FILE.id, title: CAMPAIGN_FILE.title, type: 'campaign' });
      }
      renderList(searchEl.value);
    });

    // Background-load factions → add to index → refresh sidebar
    loadFactions().then(() => {
      FACTION_FILES.forEach(f => {
        const fid = 'faction_' + f.id;
        if (!index.find(it => it.id === fid)) {
          index.push({ id: fid, title: f.title, type: 'faction' });
        }
      });
      renderList(searchEl.value);
    });
  },
};
