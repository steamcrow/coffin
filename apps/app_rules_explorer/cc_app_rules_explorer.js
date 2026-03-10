// ================================
// Rules Explorer App
// File: coffin/apps/app_rules_explorer/cc_app_rules_explorer.js
// ================================

console.log("📘 Rules Explorer app loaded");

window.CC_APP = {
  async init({ root, ctx }) {
    console.log("🚀 Rules Explorer init", ctx);

    // ---- LOAD CSS FROM GITHUB ----
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
        .catch(() => console.warn('⚠️ cc_print.css not found'));
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
        html += `<h3 class="cc-faction-units-header">Units</h3>`;

        data.units.forEach(unit => {
          html += `
            <div class="cc-ability-card cc-unit-card p-3 mb-4">

              <div class="d-flex justify-content-between align-items-baseline mb-1">
                <h4 class="fw-bold mb-0 cc-unit-name">${esc(unit.name)}</h4>
                <div class="cc-unit-cost-display">${unit.cost}₤</div>
              </div>

              <div class="cc-unit-type-label">${esc(unit.type || 'Unit')}</div>

              ${unit.lore ? `
                <div class="mb-3 cc-unit-lore">${esc(unit.lore)}</div>
              ` : ''}

              <div class="cc-stat-row mb-3">
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
                  <span class="fw-bold small cc-accent-label">Weapon:</span>
                  <span class="fw-semibold">${esc(unit.weapon)}</span>
                  ${unit.weapon_properties && unit.weapon_properties.length > 0
                    ? ` <span class="cc-weapon-props">(${unit.weapon_properties.map(p => esc(typeof p === 'string' ? p : p.name || '')).join(', ')})</span>`
                    : ''}
                </div>
              ` : ''}

              ${unit.abilities && unit.abilities.length > 0 ? `
                <div class="mb-3">
                  <div class="fw-bold small mb-1 cc-accent-label">Abilities:</div>
                  <div class="d-flex gap-1 flex-wrap">
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
                      return `<span class="cc-badge cc-badge-help"${titleAttr}>${esc(abilityName)}</span>`;
                    }).join(' ')}
                  </div>
                </div>
              ` : ''}

              ${unit.tactics ? `
                <div class="cc-unit-tactics">
                  <div class="fw-bold small mb-1 cc-accent-label">Tactics:</div>
                  <div class="cc-tactics-text">${esc(unit.tactics)}</div>
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
    root.innerHTML = `
      <div class="cc-app-shell cc-premium h-100">

        <div class="cc-app-header">
          <div>
            <h1 class="cc-app-title">Rules Explorer</h1>
            <div class="cc-app-subtitle">Interactive Coffin Canyon Rules Reference</div>
          </div>
          <div class="cc-header-actions">
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
              <div id="cc-rule-list" class="cc-list"></div>
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
                  <h2 class="cc-rule-title cc-intro-title">COFFIN CANYON</h2>

                  <div class="cc-intro-callout">
                    <h3>What This Game Is</h3>
                    <p class="cc-intro-text">
                      Coffin Canyon is a skirmish game about bad ground, bad choices, and things that do not stay dead.
                      It is set in a poisoned canyon where industry, monsters, and desperate people collide.
                      Victory comes from pressure, positioning, and knowing when to run — not from perfect plans.
                    </p>
                    <p class="cc-intro-tagline mb-0">This is a game of escalation.</p>
                  </div>

                  <div class="cc-intro-block">
                    <h3>Player Agency Over Optimization</h3>
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
                    <p class="cc-intro-tagline">If you stand still too long, the Canyon will notice.</p>
                  </div>

                  <div class="cc-intro-block">
                    <h3>The Role of the Game Warden (Optional)</h3>
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
                    <p class="fst-italic">They reveal what the Canyon has been waiting to do.</p>
                  </div>

                  <div class="cc-intro-block">
                    <h3>What the Rules Assume</h3>
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
                    <p class="fst-italic">Momentum matters more than precision.</p>
                  </div>

                  <div class="cc-intro-callout">
                    <h3>One Final Truth</h3>
                    <p class="cc-intro-text">
                      Coffin Canyon is not about winning clean. It is about getting out alive, stealing everything not nailed down,
                      or hunting for monster mort.
                    </p>
                    <p class="cc-intro-text fst-italic">(Depending on your Faction, of course.)</p>
                  </div>

                  <h3 class="cc-faction-units-header">How to Use This Tool</h3>
                  <p><strong>Navigate:</strong> Click any rule in the sidebar to view it in the center panel.</p>
                  <p><strong>Star Favorites:</strong> Click the ☆ icon to save rules, subsections, or abilities you reference often. Find them all in the "★ Starred" filter.</p>
                  <p><strong>Search:</strong> Use the search box to quickly find any rule by name or keyword.</p>
                  <p class="mb-4"><strong>Print:</strong> Click the Print button in the header to generate a clean, formatted rulebook.</p>
                  <p class="cc-intro-text"><strong>Ready to start?</strong> Click "Core Mechanics" in the sidebar to begin!</p>
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
            <span class="cc-star-btn" data-star-id="${esc(it.id)}" title="Star/Unstar">
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
          <div class="cc-nav-group">
            <button class="cc-nav-group-btn" data-toggle-group="${esc(group.id)}">
              <span>${esc(group.label)}</span>
              <span class="cc-nav-group-chevron">${isOpen ? '▲' : '▼'}</span>
            </button>
            <div class="cc-nav-group-items" style="display: ${isOpen ? 'block' : 'none'};">
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

    function renderContentSmart(meta, content) {
      if (content === undefined || content === null) {
        return `<div class="cc-muted">No content available.</div>`;
      }
      if (typeof content === 'string') return `<p>${esc(content)}</p>`;
      if (typeof content !== 'object') return `<p>${esc(String(content))}</p>`;

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

        if (!factionsData[factionId]) {
          detailEl.innerHTML = `<div class="cc-status-message cc-muted">Loading faction data…</div>`;
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
          detailEl.innerHTML = `<div class="cc-status-message cc-muted">⚠️ Could not load faction: ${esc(factionId)}</div>`;
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
            targetSection.style.color = 'var(--cc-primary)';
            setTimeout(() => { targetSection.style.color = ''; }, 2000);
            return;
          }
        }
      }

      // ---- NORMAL RULE ----
      selectedId = id;
      detailEl.innerHTML = `<div class="cc-status-message cc-muted">Loading…</div>`;
      ctxEl.innerHTML    = `<div class="cc-muted">Loading…</div>`;

      const raw = await helpers.getRuleSection(id);
      console.log('📦 getRuleSection raw result for', id, '→', raw);

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
      if (!section || !section.meta) {
        console.warn('⚠️ getRuleSection gave nothing — trying direct GitHub fetch for:', id);
        section = await fetchRuleDirectly(id);
      }

      if (!section || !section.meta) {
        console.error('❌ Could not load rule:', id, '— raw:', raw);
        detailEl.innerHTML = `
          <div class="cc-error-state">
            <p class="cc-error-title">Could not load: ${esc(id)}</p>
            <p class="cc-error-detail">
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
          ${breadcrumb ? `<div class="cc-breadcrumb">${breadcrumb}</div>` : ''}
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
            <div class="cc-context-label">Designer Notes</div>
            <div class="small">${esc(String(designIntentText))}</div>
          </div>
        `;
      }

      if (children.length > 0) {
        contextHtml += `
          <div class="cc-context-label">Subsections</div>
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
      const wasFocused = explorerEl.classList.contains('focus-mode');
      if (!wasFocused) explorerEl.classList.add('focus-mode');
      setTimeout(() => {
        window.print();
        if (!wasFocused) explorerEl.classList.remove('focus-mode');
      }, 150);
    });

    // ---- EVENTS: SIDEBAR LIST ----
    listEl.addEventListener("click", async (e) => {

      const toggleBtn = e.target.closest('[data-toggle-group]');
      if (toggleBtn) {
        const gid = toggleBtn.dataset.toggleGroup;
        openGroups.has(gid) ? openGroups.delete(gid) : openGroups.add(gid);
        renderList(searchEl.value);
        return;
      }

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
              targetCard.style.borderColor = 'var(--cc-primary)';
              targetCard.style.boxShadow   = '0 0 0 2px var(--cc-primary-dim)';
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
            <div class="cc-status-message">
              <h4 class="cc-error-title">Could not locate "${esc(abilityNameDisplay)}"</h4>
              <p>The ability may have been moved or renamed in the rules.</p>
              <p><strong>Try this:</strong> Use the search box to find it manually, then star it again.</p>
            </div>
          `;
        }
        return;
      }

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
      const breadcrumbLink = e.target.closest('.cc-breadcrumb-link');
      if (breadcrumbLink?.dataset.id) {
        selectRule(breadcrumbLink.dataset.id);
        return;
      }

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

    loadCampaign().then(() => {
      if (!index.find(it => it.id === CAMPAIGN_FILE.id)) {
        index.push({ id: CAMPAIGN_FILE.id, title: CAMPAIGN_FILE.title, type: 'campaign' });
      }
      renderList(searchEl.value);
    });

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
