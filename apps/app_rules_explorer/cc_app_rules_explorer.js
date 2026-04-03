/* cc-schema-patched-v1 */
// ================================
// Rules Explorer App
// File: coffin/apps/app_rules_explorer/cc_app_rules_explorer.js
// ================================

console.log("📘 Rules Explorer app loaded");

(function () {
  var _destroyFn = null;

  async function mount(rootEl, ctx) {
    var root = rootEl;
    console.log("🚀 Rules Explorer init", ctx);

    // ---- LOAD CSS FROM GITHUB ----
    if (!document.getElementById('cc-core-ui-styles')) {
      fetch('https://raw.githubusercontent.com/steamcrow/coffin/main/ui/cc_ui.css?t=' + Date.now())
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
      fetch('https://raw.githubusercontent.com/steamcrow/coffin/main/apps/app_rules_explorer/cc_app_rules_explorer.css?t=' + Date.now())
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
      fetch('https://raw.githubusercontent.com/steamcrow/coffin/main/ui/cc_print.css?t=' + Date.now())
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

    // Styles live in cc_app_rules_explorer.css — no inline injection needed.

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

    const RULES_BASE_URL     = 'https://raw.githubusercontent.com/steamcrow/coffin/main/data/';
    const RULES_BASE_URL_OLD = 'https://raw.githubusercontent.com/steamcrow/coffin/main/rules/';

    // Load index from GitHub if ctx didn't provide it
    let index = Array.isArray(ctx?.rulesBase?.index) ? ctx.rulesBase.index : [];
    if (index.length === 0) {
      // Try data/ first (new location), fall back to rules/ (legacy)
      const indexUrls = [
        RULES_BASE_URL     + 'rules_base.json',
        RULES_BASE_URL_OLD + 'rules_base.json',
      ];
      for (const url of indexUrls) {
        try {
          const idxRes  = await fetch(url + '?t=' + Date.now());
          if (!idxRes.ok) continue;
          const idxData = await idxRes.json();
          index = Array.isArray(idxData) ? idxData
                : Array.isArray(idxData?.index) ? idxData.index
                : Array.isArray(idxData?.rules) ? idxData.rules
                : [];
          if (index.length > 0) {
            console.log('✅ Index loaded from:', url, '—', index.length, 'entries');
            break;
          }
        } catch (e) {
          console.warn('⚠️ Index fetch failed:', url, e.message);
        }
      }
      if (index.length === 0) console.error('❌ Could not load rules index from any URL');
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
        // New location: data/src/
        meta.file && (RULES_BASE_URL + 'src/' + meta.file.replace(/^src\//, '').replace(/^data\/src\//, '')),
        meta.file && (RULES_BASE_URL + meta.file.replace(/^rules\//, '').replace(/^data\//, '')),
        meta.path && meta.path.includes('/') && (RULES_BASE_URL + 'src/' + meta.path.split('.')[0] + '.json'),
        // Legacy fallback: rules/src/
        meta.file && (RULES_BASE_URL_OLD + 'src/' + meta.file.replace(/^src\//, '')),
        meta.file && (RULES_BASE_URL_OLD + meta.file),
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
        .filter(([_k, v]) => !!v)
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

    // ---- LOGIN + FAVORITES SYSTEM ----
    // Uses the exact same auth pattern as the Faction Builder:
    // CC_STORAGE.checkAuth() → POST /web/session/get_session_info
    // Result is cached after the first call — no repeated network requests.

    let _authCache = null;

    async function getAuth() {
      if (_authCache) return _authCache;
      if (!window.CC_STORAGE) return { loggedIn: false };
      try {
        _authCache = await window.CC_STORAGE.checkAuth();
        return _authCache;
      } catch (e) {
        return { loggedIn: false };
      }
    }

    async function updateLoginStatus() {
      const statusBar = root.querySelector('#cc-login-status');
      if (!statusBar) return;
      const auth = await getAuth();
      statusBar.className = auth.loggedIn ? 'cc-login-status logged-in' : 'cc-login-status logged-out';
      statusBar.innerHTML = auth.loggedIn
        ? `<i class="fa fa-check-circle"></i> Logged in as ${esc(auth.userName)}`
        : `<i class="fa fa-exclamation-circle"></i> Log in to star rules`;
    }

    function storageKey(auth) {
      return auth.loggedIn ? `cc_rules_favorites_${auth.userId}` : null;
    }

    function getFavorites() {
      // Synchronous read — uses cached auth if available, else returns empty.
      // Full async callers should await getAuth() first.
      if (!_authCache?.loggedIn) return [];
      try {
        const key = storageKey(_authCache);
        const stored = key ? localStorage.getItem(key) : null;
        return stored ? JSON.parse(stored) : [];
      } catch (e) { return []; }
    }

    function saveFavorites(favorites) {
      if (!_authCache?.loggedIn) return;
      try {
        const key = storageKey(_authCache);
        if (key) localStorage.setItem(key, JSON.stringify(favorites));
      } catch (e) { console.error('Could not save favorites', e); }
    }

    function isFavorite(id) {
      return !!(_authCache?.loggedIn && getFavorites().includes(id));
    }

    async function toggleFavorite(id) {
      const auth = await getAuth();
      if (!auth.loggedIn) {
        const hint = document.createElement('div');
        hint.className = 'cc-login-hint';
        hint.innerHTML = '<i class="fa fa-lock"></i> Log in to save starred rules';
        document.body.appendChild(hint);
        setTimeout(() => hint.remove(), 2200);
        return;
      }
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
    // Quickstart first, then Core Rules, etc.
    const NAV_GROUPS = [
      {
        id: 'quickstart', label: '🚀 Quickstart',
        match: (it) => it.id === 'quickstart',
      },
      {
        id: 'core', label: '⚔️ Core Rules',
        match: (it) => ['core_mechanics', 'turn_structure'].includes(it.id),
      },
      {
        id: 'vaults', label: '📖 Vaults',
        match: (it) => ['visibility_vault', 'locomotion_vault', 'combat_vault', 'morale_vault',
                        'terrain_vault'].includes(it.id),
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

    // Quickstart, Core and Vaults open by default; others start collapsed.
    let openGroups = new Set(['quickstart', 'core', 'vaults']);

    // ---- LOAD FACTIONS ----
    async function loadFactions() {
      const baseUrl = 'https://raw.githubusercontent.com/steamcrow/coffin/main/data/factions/';
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
      const baseUrl = 'https://raw.githubusercontent.com/steamcrow/coffin/main/data/';
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

      if (data.desc_short) {
        html += `<p class="cc-rule-lead mb-3">${esc(data.desc_short)}</p>`;
      }
      if (data.desc_long) {
        html += `<div class="cc-callout mb-4"><p class="mb-0">${esc(data.desc_long)}</p></div>`;
      } else if (data.summary) {
        html += `<div class="cc-callout mb-4">${esc(data.summary)}</div>`;
      }
      if (data.lore) {
        html += `<div class="mb-4"><p>${esc(data.lore)}</p></div>`;
      }
      if (data.history) {
        html += `<div class="mb-4"><div class="cc-section-label">History</div><p>${esc(data.history)}</p></div>`;
      }

      // Faction identity block (core values, what they fight for/against, reputation, etc.)
      if (data.faction_identity && typeof data.faction_identity === 'object') {
        const fi = data.faction_identity;
        const fiSections = [
          { key: 'core_values',       label: 'Core Values' },
          { key: 'what_they_fight_for',   label: 'What They Fight For' },
          { key: 'what_they_fight_against', label: 'What They Fight Against' },
        ];
        for (const { key, label } of fiSections) {
          if (Array.isArray(fi[key]) && fi[key].length) {
            html += `
              <div class="mb-3">
                <div class="cc-section-label">${esc(label)}</div>
                <ul>${fi[key].map(v => `<li>${esc(v)}</li>`).join('')}</ul>
              </div>
            `;
          }
        }
        if (fi.reputation && typeof fi.reputation === 'object') {
          const repLines = Object.entries(fi.reputation)
            .map(([k, v]) => `<div class="cc-kv mb-1"><div class="cc-k">${esc(titleize(k))}</div><div class="cc-v">${esc(v)}</div></div>`)
            .join('');
          if (repLines) html += `<div class="mb-3"><div class="cc-section-label">Reputation</div>${repLines}</div>`;
        }
        if (fi.how_they_see_others && typeof fi.how_they_see_others === 'object') {
          const hLines = Object.entries(fi.how_they_see_others)
            .map(([k, v]) => `<div class="cc-kv mb-1"><div class="cc-k">${esc(titleize(k))}</div><div class="cc-v">${esc(v)}</div></div>`)
            .join('');
          if (hLines) html += `<div class="mb-3"><div class="cc-section-label">How They See Others</div>${hLines}</div>`;
        }
        if (fi.on_monsters) {
          html += `<div class="mb-3"><div class="cc-section-label">On Monsters</div><p>${esc(fi.on_monsters)}</p></div>`;
        }
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
                                abilityEffect = d.desc_short || d.desc_long || '';
                                break;
                              }
                            }
                          }
                        } catch (e) {}
                      } else if (ability && typeof ability === 'object') {
                        abilityName   = ability.name   || '';
                        abilityEffect = ability.desc_short || ability.desc_long || '';
                      }
                      const displayName = titleize(abilityName);
                      const tooltipText = abilityEffect || displayName;
                      const titleAttr   = ` title="${tooltipText.replace(/"/g, '&quot;')}"`;
                      const searchTerm  = esc(abilityName.replace(/_/g, ' '));
                      return `<button class="cc-ability-link" onclick="document.getElementById('cc-rule-search').value='${searchTerm}';document.getElementById('cc-rule-search').dispatchEvent(new Event('input'));"${titleAttr}>${esc(displayName)}</button>`;
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

              ${Array.isArray(unit.optional_upgrades) && unit.optional_upgrades.length > 0 ? `
                <div class="mt-3">
                  <div class="fw-bold small mb-1 cc-accent-label">Optional Upgrades:</div>
                  ${unit.optional_upgrades.map(u => {
                    const upgName = u.name || '';
                    const upgDesc = u.desc_short || '';
                    const searchTerm = esc(upgName.replace(/_/g, ' '));
                    return `
                      <button class="cc-upgrade-link" onclick="document.getElementById('cc-rule-search').value='${searchTerm}';document.getElementById('cc-rule-search').dispatchEvent(new Event('input'));">
                        ${u.cost ? `<span class="cc-upgrade-cost">${u.cost}₤</span>` : ''}
                        <div class="cc-upgrade-name">${esc(titleize(upgName))}</div>
                        ${upgDesc ? `<div class="cc-upgrade-desc">${esc(upgDesc)}</div>` : ''}
                      </button>
                    `;
                  }).join('')}
                </div>
              ` : ''}

              ${Array.isArray(unit.supplemental_abilities) && unit.supplemental_abilities.length > 0 ? `
                <div class="mt-3">
                  <div class="fw-bold small mb-1 cc-accent-label">Supplemental Abilities:</div>
                  ${unit.supplemental_abilities.map(u => {
                    const upgName  = u.name || '';
                    const upgDesc  = u.desc_short || '';
                    const upgLong  = u.desc_long  || '';
                    const statMods = u.stat_modifiers
                      ? Object.entries(u.stat_modifiers).map(([k,v]) => `${titleize(k)}: ${v}`).join(' • ')
                      : '';
                    const searchTerm = esc(upgName.replace(/_/g, ' '));
                    return `
                      <button class="cc-upgrade-link" onclick="document.getElementById('cc-rule-search').value='${searchTerm}';document.getElementById('cc-rule-search').dispatchEvent(new Event('input'));">
                        ${u.cost ? `<span class="cc-upgrade-cost">${u.cost}₤</span>` : ''}
                        <div class="cc-upgrade-name">${esc(titleize(upgName))}</div>
                        ${statMods ? `<div class="cc-upgrade-desc cc-muted">${esc(statMods)}</div>` : ''}
                        ${upgDesc  ? `<div class="cc-upgrade-desc">${esc(upgDesc)}</div>` : ''}
                        ${upgLong  ? `<div class="cc-upgrade-desc">${esc(upgLong)}</div>` : ''}
                      </button>
                    `;
                  }).join('')}
                </div>
              ` : ''}

            </div>
          `;
        });
      }

      return html || '<div class="cc-muted">No faction data to display.</div>';
    }

    // ---- RENDER CAMPAIGN ----
    function renderCampaign() {
      if (!campaignData) return '<div class="cc-muted">Campaign system not loaded</div>';
      return renderNestedSection('', campaignData.data, 0);
    }

    // ---- EXCLUDED IDS ----
    // These IDs either have no standalone content (they're sub-sections of a parent page)
    // or are handled by a dedicated renderer and shouldn't appear as bare sidebar items.
    const EXCLUDED_IDS = [
      'sections_philosophy',
      'philosophy',
      'philosophy_design',
      'philosophy_and_design',
      // These are sub-sections of core_mechanics — shown on that page, not standalone
      'quality_system',
      'the_roll',
      'defense_damage',
      'defense_and_damage',
      // Location/scenario vaults handled separately
      'location_vault',
      'location_types',
      'scenario_vault',
      'objective_vault',
    ];

    // R-ABIL- entries in the index are individual ability references, not standalone pages.
    // Filter them from the sidebar — abilities are read from the ability dictionary sections.
    function isExcluded(it) {
      if (EXCLUDED_IDS.includes(it.id)) return true;
      // Individual ability refs like R-ABIL-F-CONSECRATED-GROUND
      if (/^R-ABIL-/i.test(it.id)) return true;
      return false;
    }

    // ---- APP SHELL ----
    root.innerHTML = `
      <div class="cc-app-shell cc-premium h-100">

        <div class="cc-app-header">
          <div>
            <h1 class="cc-app-title">Rules Explorer</h1>
            <div class="cc-app-subtitle">Interactive Coffin Canyon Rules Reference</div>
          </div>
          <div class="cc-header-actions" style="display:flex;align-items:center;gap:8px;">
            <div id="cc-login-status" style="font-size:0.78rem;font-family:var(--cc-font-mono);text-transform:uppercase;letter-spacing:0.07em;opacity:0.6;"></div>
            <button id="cc-focus-btn" class="btn btn-sm btn-outline-secondary" title="Focus mode — hides sidebars for reading">
              📖 Focus
            </button>
            <button id="cc-print-btn" class="btn btn-sm btn-outline-secondary" title="Print or save as PDF">
              🖨️ Print
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
    const loginStatusEl  = root.querySelector("#cc-login-status");

    // Kick off async login check — updates the status bar when it resolves.
    // Auth is cached so this is one network call for the whole session.
    updateLoginStatus();

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
        const topic = str.substring(2).replace(/_/g, " ").replace(/\w/g, m => m.toUpperCase());
        return `Abilities: ${topic}`;
      }

      if (str.includes('_abilities') || str.includes('_ability')) {
        return str.replace(/_abilities?/, '').replace(/_/g, " ").replace(/\w/g, m => m.toUpperCase()) + ' Abilities';
      }

      if (str.includes('_dictionary')) {
        return str.replace(/_dictionary/, '').replace(/_/g, " ").replace(/\w/g, m => m.toUpperCase()) + ' Dictionary';
      }

      return str.replace(/_/g, " ").replace(/\w/g, m => m.toUpperCase());
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
      // Use the title if it exists, otherwise titleize the id
      const displayTitle = it.title || titleize(it.id);
      // Capitalise first letter of each word for sidebar display
      const sidebarTitle = displayTitle.replace(/\b\w/g, m => m.toUpperCase());
      return `
        <button class="cc-list-item ${active}" data-id="${esc(it.id)}">
          <div class="d-flex justify-content-between align-items-center w-100">
            <div class="flex-grow-1">
              <div class="cc-list-title">${esc(sidebarTitle)}</div>
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

      let allItems = index.filter(it => !isExcluded(it));

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
      'desc_long', 'desc_short',
      'philosophy', 'text', 'long', 'short', 'effect', 'description',
      'design_intent', 'definition', 'pool', 'logic', 'resolution',
      'trigger', 'thematic_reason', 'golden_rule', 'fast_resolution',
      'action_cost', 'completion', 'format',
      // Ability engine specific
      'stacking_rule', 'range_rule', 'los_rule', 'targeting_rule',
    ];

    const LIST_FIELDS = [
      'usage', 'guidelines', 'modifiers', 'restrictions', 'choices',
      'process', 'sources', 'examples', 'effects', 'penalties',
      'recovery', 'blockers', 'non_blockers', 'absolute',
      'negation_triggers', 'terrain_trait_interactions',
      'flexibility', 'common_actions_list', 'maintenance_steps',
      'rules', 'logic_triggers', 'type_rules',
      // Ability engine specific
      'stacking_rules', 'range_rules', 'los_rules', 'steps',
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

      const lowerLabel = label.toLowerCase();
      if (lowerLabel.includes('id') || lowerLabel === 'ref' || lowerLabel === 'reference') return '';

      let text = '';
      if (typeof value === 'string') {
        text = value;
      } else if (value && typeof value === 'object') {
        text = value.desc_long || value.desc_short || '';
      }
      if (!text) return '';
      if (typeof text === 'string' && text.trim().match(/^R-[A-Z0-9-]+$/i)) return '';

      // desc_long / long / text: plain paragraph, no label
      if (label === 'desc_long') {
        return `<p class="mb-3">${esc(text)}</p>`;
      }

      // desc_short / short: italic lead-in, no label
      if (label === 'desc_short') {
        return `<p class="cc-rule-lead mb-2">${esc(text)}</p>`;
      }

      const className = lowerLabel.includes('philosophy') ? 'fw-semibold' : '';

      // Stacking / range / LoS rules get callout treatment for emphasis
      if (lowerLabel.includes('stacking') || lowerLabel.includes('range_rule') || lowerLabel.includes('los_rule')) {
        return `
          <div class="cc-callout mb-3">
            <div class="cc-section-label mb-1">${esc(titleize(label))}</div>
            <p class="mb-0">${esc(text)}</p>
          </div>
        `;
      }

      return `
        <div class="mb-3">
          <div class="cc-section-label">${esc(titleize(label))}</div>
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
          // Migrated schema: desc_short is the one-liner
          const desc = item.desc_short || item.desc_long || '';
          if (item.name && desc) {
            return `<li><strong>${esc(item.name)}:</strong> ${esc(desc)}</li>`;
          } else if (item.value && item.description) {
            return `<li><strong>${esc(item.value)}:</strong> ${esc(item.description)}</li>`;
          } else if (item.trait && item.result) {
            return `<li><strong>${esc(item.trait)}:</strong> ${esc(item.result)}</li>`;
          } else if (item.id && item.name) {
            return `<li><strong>${esc(item.name || item.id)}:</strong> ${esc(item.desc_short || '')}</li>`;
          } else {
            const parts = Object.entries(item)
              .filter(([k]) => !k.startsWith('_') && !['desc_short','desc_long'].includes(k))
              .map(([k, v]) => `<strong>${esc(titleize(k))}:</strong> ${esc(v)}`)
              .join(' • ');
            return `<li>${parts}</li>`;
          }
        }
        return '';
      }).filter(Boolean).join('');

      if (!items) return '';

      // Stacking rules get callout emphasis
      const isStacking = label.toLowerCase().includes('stacking');
      return `
        <div class="mb-3${isStacking ? ' cc-callout' : ''}">
          <div class="cc-section-label">${esc(titleize(label))}</div>
          <ul>${items}</ul>
        </div>
      `;
    }

    function renderNestedSection(label, obj, depth = 0) {
      if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return '';
      if (depth >= 6) return '';

      let html = '';

      // ---- ABILITY DICTIONARY DETECTION ----
      const SECTION_STRUCT_KEYS = new Set([
        'title','name','rules','format','notes','steps','process','choices',
        'penalties','recovery','maintenance_steps','common_actions_list',
        'reactions','action_economy','flexibility','completion',
        'first_activation','reset','move','attack','withdraw',
        'immediate_effect','activation_penalty','cascading_fear',
        'monster_logic','environmental_fear','outcomes',
      ]);
      const objKeys = Object.keys(obj).filter(k => !k.startsWith('_'));
      const hasStructKey = objKeys.some(k => SECTION_STRUCT_KEYS.has(k));
      const hasTitleOrDesc = obj.title || obj.name || obj.desc_long || obj.desc_short;
      const allAbilityLike = objKeys.length >= 2 && objKeys.every(k =>
        typeof obj[k] === 'string' ||
        (obj[k] && typeof obj[k] === 'object' && !Array.isArray(obj[k]) &&
         (obj[k].desc_short || obj[k].desc_long))
      );
      const isAbilityDict = !hasStructKey && !hasTitleOrDesc && allAbilityLike;

      if (isAbilityDict) {
        html += `
          <div class="mb-4">
            ${label ? `<div class="cc-section-label">${esc(titleize(label))}</div>` : ''}
            ${renderAbilityDictionary(obj)}
          </div>
        `;
        return html;
      }

      // ---- SECTION HEADER ----
      const displayTitle = obj.title || obj.name || (label ? titleize(label) : '');
      const showHeader   = displayTitle &&
                           !displayTitle.match(/^R-[A-Z0-9-]+$/i) &&
                           (depth > 0 || label);

      if (showHeader) {
        const headerTag   = depth <= 1 ? 'h5' : 'h6';
        const headerClass = depth === 0 ? 'cc-rule-title' : depth === 1 ? 'cc-section-title' : 'cc-section-label';
        html += `<${headerTag} class="${headerClass} mt-3 mb-2">${esc(displayTitle)}</${headerTag}>`;
      }

      // ---- PROSE FIELDS ----
      for (const field of PROSE_FIELDS) {
        if (obj[field]) html += renderProseField(field, obj[field]);
      }

      // ---- LIST FIELDS ----
      for (const field of LIST_FIELDS) {
        if (obj[field]) html += renderList_Content(field, obj[field]);
      }

      // ---- ALL REMAINING FIELDS ----
      const handledFields = new Set([
        ...PROSE_FIELDS, ...LIST_FIELDS,
        'title', 'name', '_id', 'id', 'type',
        'short', 'long', 'text', 'effect', 'description', 'lore',
        'summary', 'definition', 'tagline', 'philosophy', 'introduction',
        'design_intent', 'designer_notes', '_migrated', '_migrated_at',
      ]);

      for (const [k, v] of Object.entries(obj)) {
        if (k.startsWith('_'))         continue;
        if (handledFields.has(k))      continue;
        const lk = k.toLowerCase();
        if (lk === 'id' || lk.endsWith('_id') || lk === 'ref') continue;
        if (v === undefined || v === null || v === '') continue;

        if (Array.isArray(v)) {
          html += renderList_Content(k, v);
        } else if (v && typeof v === 'object') {
          html += renderNestedSection(k, v, depth + 1);
        } else if (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') {
          const s = String(v).trim();
          if (s.match(/^R-[A-Za-z0-9-]+$/) || s.match(/^[A-Z0-9]{8,}-/) || s.length < 3) continue;
          html += `
            <div class="cc-kv mb-1">
              <div class="cc-k">${esc(titleize(k))}</div>
              <div class="cc-v">${esc(s)}</div>
            </div>
          `;
        }
      }

      if (html) return `<div class="cc-section mb-3">${html}</div>`;
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
                  <div class="cc-ability-name flex-grow-1">${esc(titleize(key))}</div>
                  <button class="btn btn-link p-0 cc-ability-star" data-star-id="${esc(abilityId)}" title="Star this ability">
                    <span class="cc-star">${starred ? '★' : '☆'}</span>
                  </button>
                </div>
                <div>${esc(ability)}</div>
              </div>
            `;
          }

          const a = ability || {};
          const aShort = a.desc_short || '';
          const aLong  = a.desc_long  || '';

          // Timing keywords get an orange title-font header instead of a plain card
          const TIMING_KEYS = new Set(['passive','reaction','once_per_activation',
            'once_per_round','once_per_game','free_action','triggered']);
          const isTimingEntry = TIMING_KEYS.has(key.toLowerCase().replace(/\s+/g,'_'));

          if (isTimingEntry) {
            const timingName = (a.name || titleize(key)).toUpperCase();
            return `
              <div class="cc-ability-card p-3 mb-2">
                <div class="d-flex justify-content-between align-items-baseline mb-1">
                  <div class="cc-timing-header flex-grow-1">${esc(timingName)}</div>
                  <button class="btn btn-link p-0 cc-ability-star" data-star-id="${esc(abilityId)}" title="Star this ability">
                    <span class="cc-star">${starred ? '★' : '☆'}</span>
                  </button>
                </div>
                ${aShort ? `<p class="cc-rule-lead mb-1">${esc(aShort)}</p>` : ''}
                ${aLong  ? `<p class="mb-0">${esc(aLong)}</p>` : ''}
              </div>
            `;
          }

          return `
            <div class="cc-ability-card p-3 mb-2">
              <div class="d-flex justify-content-between align-items-baseline mb-1">
                <div class="cc-ability-name flex-grow-1">${esc(a.name || titleize(key))}</div>
                <div class="d-flex align-items-center gap-2">
                  ${a.timing ? `<div class="cc-muted small text-uppercase">${esc(a.timing)}</div>` : ''}
                  <button class="btn btn-link p-0 cc-ability-star" data-star-id="${esc(abilityId)}" title="Star this ability">
                    <span class="cc-star">${starred ? '★' : '☆'}</span>
                  </button>
                </div>
              </div>
              ${aShort ? `<p class="cc-rule-lead mb-1">${esc(aShort)}</p>` : ''}
              ${aLong  ? `<p class="mb-1">${esc(aLong)}</p>` : ''}
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

      // Wild magic table
      if (meta?.id?.includes('wild_magic') || content.type === 'wild_magic' ||
          (Array.isArray(content.entries) && content.entries[0]?.roll !== undefined) ||
          (Array.isArray(content.table)   && content.table[0]?.roll   !== undefined)) {
        return renderWildMagicTable(content);
      }

      // Ability Engine — has timing_keywords.timings or stacking_rules
      if (content.timing_keywords || content.stacking_rules) {
        return renderAbilityEngine(content);
      }

      // Named locations
      if (Array.isArray(content.locations) && content.locations[0]?.name) {
        return renderNamedLocations(content);
      }

      // Unit identities — has archetype_vault
      if (content.archetype_vault && typeof content.archetype_vault === 'object') {
        return renderUnitIdentities(content);
      }

      // Terrain vault — has traits dict
      if (content.traits && typeof content.traits === 'object' && content.categories) {
        return renderTerrainVault(content);
      }

      // Ability dict with abilities wrapper
      if (content.abilities && typeof content.abilities === 'object' &&
          Object.keys(content.abilities).length > 0) {
        return renderAbilityDictionary(content.abilities);
      }
      if (content.properties && typeof content.properties === 'object') {
        return renderAbilityDictionary(content.properties);
      }

      // Flat ability dict — old or new schema
      const abilEntries = Object.entries(content)
        .filter(([k]) => !['type','_id','id','title','_migrated','_migrated_at'].includes(k) && !k.startsWith('_'));
      const isFlatAbilityDict = abilEntries.length > 0 && abilEntries.every(([_k, v]) =>
        typeof v === 'string' ||
        (v && typeof v === 'object' && !Array.isArray(v) &&
         (v.desc_short || v.desc_long))
      );
      if (isFlatAbilityDict && !content.sections && !content.text && !content.desc_long) {
        return renderAbilityDictionary(content);
      }

      return renderNestedSection('', content, 0) || `<div class="cc-muted">No renderable content found.</div>`;
    }

    // ---- ABILITY ENGINE RENDERER ----
    function renderAbilityEngine(content) {
      let html = '';
      if (content.desc_short) html += `<p class="cc-rule-lead mb-2">${esc(content.desc_short)}</p>`;
      if (content.desc_long)  html += `<p class="mb-4">${esc(content.desc_long)}</p>`;

      // Sections in preferred display order
      const ORDER = [
        'ability_definition',
        'timing_keywords',
        'ability_resolution_order',
        'stacking_rules',
        'range_and_targeting',
        'state_changes',
        'ability_failure',
        'ability_precedence',
        'action_chain_limit',
        'design_notes',
      ];

      const rendered = new Set();

      for (const key of ORDER) {
        const section = content[key];
        if (!section || typeof section !== 'object') continue;
        rendered.add(key);

        const sTitle = section.title || titleize(key);

        // --- TIMING KEYWORDS: special — timings dict renders as orange ability cards
        if (key === 'timing_keywords') {
          html += `<h5 class="cc-section-title mt-3 mb-2">${esc(sTitle)}</h5>`;
          if (section.desc_short) html += `<p class="cc-rule-lead mb-3">${esc(section.desc_short)}</p>`;

          const timings = section.timings || {};
          for (const [tKey, tVal] of Object.entries(timings)) {
            if (!tVal || typeof tVal !== 'object') continue;
            const tName  = tVal.name || titleize(tKey).toUpperCase();
            const tShort = tVal.desc_short || '';
            const tLong  = tVal.desc_long  || '';
            const tStar  = isFavorite(`ability-${tKey}`);
            const tId    = `ability-${tKey}`;
            html += `
              <div class="cc-ability-card p-3 mb-2">
                <div class="d-flex justify-content-between align-items-baseline mb-1">
                  <div class="cc-timing-header flex-grow-1">${esc(tName)}</div>
                  <button class="btn btn-link p-0 cc-ability-star" data-star-id="${esc(tId)}">
                    <span class="cc-star">${tStar ? '★' : '☆'}</span>
                  </button>
                </div>
                ${tShort ? `<p class="cc-rule-lead mb-1">${esc(tShort)}</p>` : ''}
                ${tLong  ? `<p class="mb-1">${esc(tLong)}</p>` : ''}
                ${tVal.stacking     ? `<p class="cc-muted small mb-0"><strong>Stacking:</strong> ${esc(tVal.stacking)}</p>` : ''}
                ${tVal.restriction  ? `<p class="cc-muted small mb-0"><em>${esc(tVal.restriction)}</em></p>` : ''}
              </div>
            `;
          }
          continue;
        }

        // --- STACKING RULES: callout box with individual rules
        if (key === 'stacking_rules') {
          html += `
            <div class="cc-callout mb-4 mt-3">
              <h5 class="cc-section-title mb-2">${esc(sTitle)}</h5>
              ${section.desc_short ? `<p class="cc-rule-lead mb-2">${esc(section.desc_short)}</p>` : ''}
              ${section.general        ? `<p class="mb-1"><strong>General:</strong> ${esc(section.general)}</p>` : ''}
              ${section.dice_modifiers ? `<p class="mb-1"><strong>Dice Modifiers:</strong> ${esc(section.dice_modifiers)}</p>` : ''}
              ${section.rerolls        ? `<p class="mb-0"><strong>Rerolls:</strong> ${esc(section.rerolls)}</p>` : ''}
            </div>
          `;
          continue;
        }

        // --- RANGE AND TARGETING: show defaults as a clean table
        if (key === 'range_and_targeting') {
          html += `<h5 class="cc-section-title mt-3 mb-2">${esc(sTitle)}</h5>`;
          if (section.desc_short) html += `<p class="cc-rule-lead mb-2">${esc(section.desc_short)}</p>`;
          const defaults = section.defaults || {};
          if (Object.keys(defaults).length) {
            html += `<div class="mb-2">`;
            for (const [dk, dv] of Object.entries(defaults)) {
              html += `<div class="cc-kv mb-1">
                <div class="cc-k">${esc(titleize(dk))}</div>
                <div class="cc-v">${esc(dv)}</div>
              </div>`;
            }
            html += `</div>`;
          }
          if (section.exceptions) {
            html += `<p class="cc-muted small mb-3"><em>${esc(section.exceptions)}</em></p>`;
          }
          continue;
        }

        // --- ACTION CHAIN LIMIT: emphasise the core rule
        if (key === 'action_chain_limit') {
          html += `<h5 class="cc-section-title mt-3 mb-2">${esc(sTitle)}</h5>`;
          if (section.core_rule) {
            html += `<div class="cc-callout mb-3"><p class="mb-0 fw-semibold">${esc(section.core_rule)}</p></div>`;
          }
          if (section.desc_long) html += `<p class="mb-2">${esc(section.desc_long)}</p>`;
          if (Array.isArray(section.clarifications) && section.clarifications.length) {
            html += `<ul>${section.clarifications.map(c => `<li>${esc(c)}</li>`).join('')}</ul>`;
          }
          if (section.thematic_note) {
            html += `<p class="cc-rule-lead mt-2">${esc(section.thematic_note)}</p>`;
          }
          continue;
        }

        // --- DEFAULT: standard section rendering
        html += `<h5 class="cc-section-title mt-3 mb-2">${esc(sTitle)}</h5>`;
        if (section.desc_short) html += `<p class="cc-rule-lead mb-1">${esc(section.desc_short)}</p>`;
        if (section.desc_long)  html += `<p class="mb-2">${esc(section.desc_long)}</p>`;

        // Render string fields as labelled prose
        for (const [k, v] of Object.entries(section)) {
          if (k.startsWith('_') || ['title','desc_short','desc_long','type'].includes(k)) continue;
          if (typeof v === 'string') {
            html += `<div class="cc-kv mb-1">
              <div class="cc-k">${esc(titleize(k))}</div>
              <div class="cc-v">${esc(v)}</div>
            </div>`;
          } else if (Array.isArray(v)) {
            html += `<div class="mb-2">
              <div class="cc-section-label">${esc(titleize(k))}</div>
              <ul>${v.map(i => `<li>${esc(i)}</li>`).join('')}</ul>
            </div>`;
          }
        }
      }

      // Any remaining top-level sections not in the order list
      for (const [k, v] of Object.entries(content)) {
        if (k.startsWith('_') || rendered.has(k)) continue;
        if (['type','title','desc_short','desc_long','_migrated','_migrated_at'].includes(k)) continue;
        if (v && typeof v === 'object') {
          html += renderNestedSection(k, v, 1);
        }
      }

      return html;
    }

    // ---- UNIT IDENTITIES RENDERER ----
    function renderUnitIdentities(content) {
      let html = '';
      if (content.desc_short) html += `<p class="cc-rule-lead mb-2">${esc(content.desc_short)}</p>`;
      if (content.desc_long)  html += `<p class="mb-4">${esc(content.desc_long)}</p>`;

      const vault = content.archetype_vault || {};
      for (const [key, unit] of Object.entries(vault)) {
        if (!unit || typeof unit !== 'object') continue;
        const unitName = unit.name || titleize(key);

        html += `<h3 class="cc-unit-type-header">${esc(unitName.toUpperCase())}</h3>`;
        html += `<div class="cc-section mb-4">`;

        if (unit.identity) {
          html += `<p class="cc-rule-lead mb-1">${esc(unit.identity)}</p>`;
        }
        if (unit.desc_short) {
          html += `<p class="mb-2">${esc(unit.desc_short)}</p>`;
        }
        if (unit.desc_long) {
          html += `<p class="mb-2">${esc(unit.desc_long)}</p>`;
        }

        // type_rule(s)
        const typeRules = unit.type_rules || (unit.type_rule ? [unit.type_rule] : []);
        if (typeRules.length) {
          html += `<div class="cc-kv mb-2">
            <div class="cc-k">Type Rule</div>
            <div class="cc-v">${typeRules.map(r => esc(r)).join(' • ')}</div>
          </div>`;
        }

        // logic_triggers
        if (Array.isArray(unit.logic_triggers) && unit.logic_triggers.length) {
          html += `<div class="mb-2">
            <div class="cc-section-label">Logic Triggers</div>
            <ul>${unit.logic_triggers.map(t => `<li>${esc(t)}</li>`).join('')}</ul>
          </div>`;
        }

        // sub-rules (fire_superiority, rally, etc.)
        const skipKeys = new Set(['_id','name','identity','type_rule','type_rules',
                                   'logic_triggers','desc_short','desc_long']);
        for (const [k, v] of Object.entries(unit)) {
          if (k.startsWith('_') || skipKeys.has(k)) continue;
          if (v && typeof v === 'object' && !Array.isArray(v)) {
            const subName = v.name || titleize(k);
            const subDesc = v.desc_short || v.desc_long || '';
            html += `<div class="cc-kv mb-1">
              <div class="cc-k">${esc(subName)}</div>
              <div class="cc-v">${esc(subDesc)}</div>
            </div>`;
          }
        }

        html += `</div>`;
      }

      // logic notes
      if (content.logic_notes) {
        const ln = content.logic_notes;
        html += `<div class="cc-callout mt-3">`;
        if (ln.hybrid_units)        html += `<p class="mb-1"><strong>Hybrid Units:</strong> ${esc(ln.hybrid_units)}</p>`;
        if (ln.conflict_resolution) html += `<p class="mb-0"><strong>Conflict Resolution:</strong> ${esc(ln.conflict_resolution)}</p>`;
        html += `</div>`;
      }

      return html;
    }

    // ---- TERRAIN VAULT RENDERER ----
    function renderTerrainVault(content) {
      let html = '';
      if (content.desc_long) html += `<p class="mb-4">${esc(content.desc_long)}</p>`;

      // Categories
      const cats = content.categories || {};
      if (Object.keys(cats).length) {
        html += `<h5 class="cc-section-title mt-2 mb-3">Movement Categories</h5>`;
        for (const [key, val] of Object.entries(cats)) {
          const name = titleize(key);
          if (typeof val === 'string') {
            html += `<div class="cc-ability-card p-3 mb-2">
              <div class="fw-bold mb-1">${esc(name)}</div>
              <p class="mb-0">${esc(val)}</p>
            </div>`;
          } else if (val && typeof val === 'object') {
            const desc  = val.desc_short || val.desc_long || '';
            const exs   = Array.isArray(val.examples) ? val.examples : [];
            html += `<div class="cc-ability-card p-3 mb-2">
              <div class="fw-bold mb-1">${esc(name)}</div>
              ${desc ? `<p class="mb-1">${esc(desc)}</p>` : ''}
              ${exs.length ? `<div class="cc-muted small">${exs.map(e => esc(e)).join(' · ')}</div>` : ''}
            </div>`;
          }
        }
      }

      // Terrain Traits
      const traits = content.traits || {};
      if (Object.keys(traits).length) {
        html += `<h5 class="cc-section-title mt-4 mb-3">Terrain Traits</h5>`;
        for (const [key, trait] of Object.entries(traits)) {
          if (!trait || typeof trait !== 'object') continue;
          const name    = titleize(key).toUpperCase();
          const desc    = trait.desc_short || trait.desc_long || '';
          const trigger = trait.trigger || '';
          const test    = trait.test || '';
          const collapse = trait.collapse || '';

          html += `<div class="cc-ability-card p-3 mb-2">
            <div class="fw-bold mb-1" style="color:var(--cc-primary);font-family:var(--cc-font-title)">${esc(name)}</div>
            ${trigger ? `<div class="cc-section-label mb-1">Trigger</div><p class="mb-1">${esc(trigger)}</p>` : ''}
            ${test    ? `<div class="cc-section-label mb-1">Test</div><p class="mb-1">${esc(test)}</p>` : ''}
            ${desc    ? `<p class="mb-1">${esc(desc)}</p>` : ''}
            ${collapse ? `<div class="cc-muted small mt-1"><strong>Collapse:</strong> ${esc(collapse)}</div>` : ''}
          </div>`;
        }
      }

      // Escalation logic
      const esc_logic = content.escalation_logic;
      if (esc_logic) {
        html += `<div class="cc-callout mt-3 mb-2">
          <div class="cc-section-label mb-1">Escalation</div>
          ${esc_logic.taint_to_haunt ? `<p class="mb-1"><strong>Taint → Haunt:</strong> ${esc(esc_logic.taint_to_haunt)}</p>` : ''}
          ${esc_logic.logic ? `<p class="mb-0 cc-rule-lead">${esc(esc_logic.logic)}</p>` : ''}
        </div>`;
      }

      if (content.dispute_resolution) {
        html += `<p class="cc-muted small mt-2">${esc(content.dispute_resolution)}</p>`;
      }

      return html;
    }

    // ---- NAMED LOCATIONS RENDERER ----
    function renderNamedLocations(content) {
      const locations = content.locations || [];
      let html = '';

      if (content.notes && Array.isArray(content.notes)) {
        html += `<p class="cc-muted small mb-4">${content.notes.map(n => esc(n)).join(' · ')}</p>`;
      }

      for (const loc of locations) {
        const name      = loc.name || loc.id || '?';
        const emoji     = loc.emoji || '';
        const desc      = loc.desc_long || '';
        const atmo      = loc.atmosphere || '';
        const state     = loc.state || '';
        const archetype = loc.archetype || '';
        const danger    = loc.danger ?? '';
        const pop       = loc.population ?? '';
        const resources = Array.isArray(loc.key_resources) ? loc.key_resources : [];
        const features  = Array.isArray(loc.features) ? loc.features : [];
        const rumors    = Array.isArray(loc.rumors) ? loc.rumors : [];
        const flavor    = Array.isArray(loc.terrain_flavor) ? loc.terrain_flavor : [];

        html += `<div class="cc-ability-card cc-location-card p-4 mb-4">`;

        // Name header
        html += `<h3 class="cc-location-name">${emoji ? esc(emoji) + ' ' : ''}${esc(name)}</h3>`;

        // Tags row
        const tags = [archetype, state].filter(Boolean).map(t => titleize(t));
        if (danger !== '') tags.push(`Danger ${danger}`);
        if (pop    !== '') tags.push(`Pop. ${pop}`);
        if (tags.length) {
          html += `<div class="mb-3">${tags.map(t =>
            `<span class="cc-badge" style="margin-right:4px">${esc(t)}</span>`
          ).join('')}</div>`;
        }

        // Description (flavour prose)
        if (desc) html += `<p class="cc-unit-lore mb-3">"${esc(desc)}"</p>`;
        if (atmo) html += `<p class="cc-muted small mb-3">${esc(atmo)}</p>`;

        // Resources & features
        if (resources.length) {
          html += `<div class="mb-2"><div class="cc-section-label">Key Resources</div>
            <div>${resources.map(r => `<span class="cc-badge" style="margin-right:4px">${esc(r)}</span>`).join('')}</div>
          </div>`;
        }
        if (features.length) {
          html += `<div class="mb-2"><div class="cc-section-label">Features</div>
            <ul>${features.map(f => `<li>${esc(typeof f === 'string' ? f : (f.name || JSON.stringify(f)))}</li>`).join('')}</ul>
          </div>`;
        }
        if (flavor.length) {
          html += `<div class="mb-2"><div class="cc-section-label">Terrain</div>
            <div class="cc-muted small">${flavor.map(f => esc(f)).join(' · ')}</div>
          </div>`;
        }
        if (rumors.length) {
          html += `<div class="mb-2"><div class="cc-section-label">Rumors</div>
            <ul>${rumors.map(r => `<li class="cc-muted small">${esc(typeof r === 'string' ? r : (r.text || JSON.stringify(r)))}</li>`).join('')}</ul>
          </div>`;
        }

        html += `</div>`;
      }

      return html || `<div class="cc-muted">No locations found.</div>`;
    }

    // ---- WILD MAGIC TABLE RENDERER (issue 10) ----
    function renderWildMagicTable(content) {
      const entries = content.entries || content.table || content.results || [];
      if (!entries.length) return renderNestedSection('', content, 0);

      const intro = content.desc_long || '';
      const note  = content.note || content.notes || '';

      let html = '';
      if (intro) html += `<p class="mb-3">${esc(intro)}</p>`;

      html += `<table class="cc-wild-magic-table">
        <thead>
          <tr>
            <th style="width:60px">Roll</th>
            <th style="width:160px">Result</th>
            <th>Effect</th>
          </tr>
        </thead>
        <tbody>`;

      for (const row of entries) {
        const roll   = row.roll   ?? row.value ?? row.number ?? '';
        const name   = row.name   ?? row.result ?? row.title ?? '';
        const desc   = row.desc_long  || '';
        const short  = row.desc_short || '';
        html += `
          <tr>
            <td class="cc-wm-roll">${esc(String(roll))}</td>
            <td><div class="cc-wm-name">${esc(name)}</div></td>
            <td>
              ${short ? `<div class="cc-wm-desc" style="font-style:italic">${esc(short)}</div>` : ''}
              ${desc  ? `<div>${esc(desc)}</div>` : ''}
            </td>
          </tr>`;
      }

      html += `</tbody></table>`;
      if (note) html += `<p class="cc-muted small mt-3">${esc(typeof note === 'string' ? note : JSON.stringify(note))}</p>`;
      return html;
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
    // Builds a complete rulebook as a standalone HTML document in a new window.
    // Uses cc_print.css as the base stylesheet — no duplicate print rules here.
    printBtn.addEventListener('click', async () => {
      const origLabel = printBtn.innerHTML;
      printBtn.disabled = true;
      printBtn.innerHTML = '⏳ Building…';

      try {
        // Print order: Quickstart first, then core rules, vaults, systems, abilities, factions
        const PRINT_ORDER = [
          // Quickstart comes first in the printed rulebook
          'quickstart',
          // Core
          'core_mechanics', 'turn_structure',
          // Vaults
          'visibility_vault', 'locomotion_vault', 'combat_vault', 'morale_vault', 'terrain_vault',
          // Systems
          'unit_identities', 'ability_engine',
          // Ability dictionaries A–I
          ...index.filter(it => it.id?.startsWith('ability_dict_')).sort((a,b) => a.id.localeCompare(b.id)).map(it => it.id),
          // Factions
          ...index.filter(it => it.id?.startsWith('faction_')).map(it => it.id),
          // Campaign last
          'campaign_system',
        ].filter(id => id && (index.find(it => it.id === id) || id.startsWith('faction_') || id.startsWith('ability_dict_')));

        // Build section HTML array
        const sections = [];
        let done = 0;

        for (const id of PRINT_ORDER) {
          printBtn.innerHTML = `⏳ ${Math.round((done / PRINT_ORDER.length) * 100)}%`;

          try {
            let content = null;
            let title   = '';

            if (id === 'campaign_system') {
              if (!campaignData) await loadCampaign();
              content = campaignData?.data;
              title   = 'Campaign System';
            } else if (id.startsWith('faction_')) {
              const fid = id.replace('faction_', '');
              if (!factionsData[fid]) await loadFactions();
              content = factionsData[fid]?.data;
              title   = factionsData[fid]?.title || fid;
            } else {
              const raw = await helpers.getRuleSection(id) || await fetchRuleDirectly(id);
              if (raw?.meta) { content = raw.content; title = raw.meta.title || raw.meta.id; }
              else if (raw?.content) { content = raw.content; title = index.find(it=>it.id===id)?.title || id; }
            }

            if (content || title) {
              const meta   = index.find(it => it.id === id) || { id, title };
              const bodyHtml = content ? renderContentSmart(meta, content) : '';
              sections.push(`
                <section class="cc-print-section" id="section-${id}">
                  <h2 class="cc-print-title">${esc(title || id)}</h2>
                  <div class="cc-rule-content">${bodyHtml}</div>
                </section>
              `);
            }
          } catch(e) {
            console.warn('Print: could not load section', id, e);
          }
          done++;
        }

        // Fetch the two stylesheets — all print rules live in cc_print.css
        let coreCss = '', printCss = '';
        try {
          const [coreR, printR] = await Promise.all([
            fetch('https://raw.githubusercontent.com/steamcrow/coffin/main/ui/cc_ui.css?t=' + Date.now()),
            fetch('https://raw.githubusercontent.com/steamcrow/coffin/main/ui/cc_print.css?t=' + Date.now()),
          ]);
          if (coreR.ok)  coreCss  = await coreR.text();
          if (printR.ok) printCss = await printR.text();
        } catch(e) { console.warn('Could not fetch print CSS:', e); }

        const printDoc = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Coffin Canyon — Complete Rulebook</title>
  <style>
${coreCss}
${printCss}

/* Screen-only layout overrides for the print preview window */
body { font-family: Georgia, serif; font-size: 11pt; line-height: 1.6; color: #1a1a1a; background: #fff; margin: 0; padding: 0; }
.cc-print-document { max-width: 720px; margin: 0 auto; padding: 40px 48px 80px; }
  </style>
</head>
<body>
  <div class="cc-print-document">
    <div class="cc-print-cover">
      <h1>COFFIN CANYON</h1>
      <p>Complete Rulebook &mdash; ${new Date().toLocaleDateString('en-US', {year:'numeric',month:'long'})}</p>
    </div>
    ${sections.join('\n')}
  </div>
  <script>window.onload = () => window.print();<\/script>
</body>
</html>`;

        const blob = new Blob([printDoc], { type: 'text/html' });
        const url  = URL.createObjectURL(blob);
        const win  = window.open(url, '_blank');
        if (!win) alert('Pop-up blocked. Please allow pop-ups for this site and try again.');

      } catch(e) {
        console.error('Print failed:', e);
        alert('Could not build PDF. Check the browser console for details.');
      } finally {
        printBtn.disabled = false;
        printBtn.innerHTML = origLabel;
      }
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

    // Rewrite ability dictionary sidebar titles to use proper category names
    const ABILITY_DICT_NAMES = {
      A: 'Deployment & Timing',   B: 'Movement & Positioning',
      C: 'Offense & Damage',      D: 'Defense & Survival',
      E: 'Morale & Fear',         F: 'Terrain & Environment',
      G: 'Thyr & Ritual',         H: 'Interaction & Support',
      I: 'Monster Interactions',
    };
    index.forEach(item => {
      if (item.id?.startsWith('ability_dict_')) {
        const letter = item.id.replace('ability_dict_', '').toUpperCase();
        if (ABILITY_DICT_NAMES[letter]) item.title = ABILITY_DICT_NAMES[letter];
      }
    });

    // ── Boot — canonical preloader overlay, dismiss when data resolves ─────
    const _rePreloader = document.createElement('div');
    _rePreloader.id = 'cc-re-preloader';
    _rePreloader.className = 'cc-preloader cc-preloader--page';
    _rePreloader.innerHTML = `
      <img class="cc-preloader-logo"
           src="https://raw.githubusercontent.com/steamcrow/coffin/main/assets/logos/coffin_canyon_logo.png"
           alt="Coffin Canyon"
           style="width:200px;max-width:70vw;">
      <p class="cc-preloader-title">Rules Explorer</p>
      <div class="cc-loading-bar" style="width:260px;max-width:80vw;">
        <div class="cc-loading-progress"></div>
      </div>
      <p class="cc-loading-text">Loading rules data…</p>
    `;
    root.appendChild(_rePreloader);

    function _reDismissPreloader() {
      _rePreloader.classList.add('cc-preloader--hidden');
      setTimeout(function() {
        if (_rePreloader.parentNode) _rePreloader.parentNode.removeChild(_rePreloader);
      }, 480);
    }

    renderList();

    Promise.all([
      loadCampaign().then(() => {
        if (!index.find(it => it.id === CAMPAIGN_FILE.id)) {
          index.push({ id: CAMPAIGN_FILE.id, title: CAMPAIGN_FILE.title, type: 'campaign' });
        }
        renderList(searchEl.value);
      }),
      loadFactions().then(() => {
        FACTION_FILES.forEach(f => {
          const fid = 'faction_' + f.id;
          if (!index.find(it => it.id === fid)) {
            index.push({ id: fid, title: f.title, type: 'faction' });
          }
        });
        renderList(searchEl.value);
      })
    ]).then(_reDismissPreloader).catch(_reDismissPreloader);

    return Promise.resolve();
  } // end mount()

  window.CC_APP = {
    init: function (options) {
      return mount(options.root, options.ctx || {});
    },
    destroy: function () {
      if (typeof _destroyFn === 'function') { _destroyFn(); }
    }
  };
})();
