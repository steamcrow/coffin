// ================================
// Faction Builder App
// File: coffin/rules/apps/cc_app_faction_builder.js
// ================================

console.log("⚔️ Faction Builder app loaded");

window.CC_APP = {
  init({ root, ctx }) {
    console.log("🚀 Faction Builder init", ctx);

    // ---- LOAD CSS ----
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

    if (!document.getElementById('cc-faction-builder-styles')) {
      fetch('https://raw.githubusercontent.com/steamcrow/coffin/main/rules/apps/cc_app_faction_builder.css?t=' + Date.now())
        .then(res => res.text())
        .then(css => {
          const style = document.createElement('style');
          style.id = 'cc-faction-builder-styles';
          style.textContent = css;
          document.head.appendChild(style);
          console.log('✅ Faction Builder CSS applied!');
        })
        .catch(err => console.error('❌ App CSS load failed:', err));
    }

    // FIX 5 ── Load print CSS from the shared print helper
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
        .catch(() => console.warn('⚠️ cc_print.css not found — using inline print styles only'));
    }

    // ---- LOAD STORAGE HELPERS ----
    if (!window.CC_STORAGE) {
      fetch('https://raw.githubusercontent.com/steamcrow/coffin/main/rules/src/storage_helpers.js?t=' + Date.now())
        .then(res => res.text())
        .then(code => {
          const script = document.createElement('script');
          script.textContent = code;
          document.head.appendChild(script);
          console.log('✅ Storage Helpers loaded!');
        })
        .catch(err => console.error('❌ Storage Helpers load failed:', err));
    }

    const helpers = ctx && ctx.helpers;
    if (!helpers) {
      root.innerHTML = `<div class="cc-app-shell h-100"><div class="container py-5 text-danger"><h4>Helpers not available</h4></div></div>`;
      return;
    }

    // ================================
    // STATE
    // ================================
    const state = {
      currentFaction: null,
      factionData: {},
      roster: [],
      rosterName: 'Unnamed Roster',
      budget: 500,
      selectedUnitId: null,
      builderMode: null,
      builderTarget: null,
      builderConfig: { optionalUpgrades: [], supplemental: null },
      rosterViewMode: 'grid'
    };

    // ================================
    // FACTION DATA
    // ================================
    const FACTION_FILES = [
      { id: 'monster_rangers', title: 'Monster Rangers', file: 'faction-monster-rangers-v5.json' },
      { id: 'liberty_corps',   title: 'Liberty Corps',   file: 'faction-liberty-corps-v2.json'   },
      { id: 'monsterology',    title: 'Monsterology',     file: 'faction-monsterology-v2.json'    },
      { id: 'monsters',        title: 'Monsters',         file: 'faction-monsters-v2.json'        },
      { id: 'shine_riders',    title: 'Shine Riders',     file: 'faction-shine-riders-v2.json'    },
      { id: 'crow_queen',      title: 'Crow Queen',       file: 'faction-crow-queen.json'         }
    ];

    const FACTION_TITLES = {
      monster_rangers: 'Monster Rangers',
      liberty_corps:   'Liberty Corps',
      monsterology:    'Monsterology',
      monsters:        'Monsters',
      shine_riders:    'Shine Riders',
      crow_queen:      'Crow Queen'
    };

    // ================================
    // FACTION ICON SYSTEM
    // ================================
    const FACTION_COLORS = {
      monster_rangers: '#4caf50',
      liberty_corps:   '#ef5350',
      monsterology:    '#9c27b0',
      monsters:        '#ff7518',
      shine_riders:    '#ffd600',
      crow_queen:      '#00bcd4'
    };

    const FACTION_ICON_BASE = 'https://raw.githubusercontent.com/steamcrow/coffin/main/rules/apps/';

    function factionIconHtml(factionId, size = 32) {
      if (!factionId) return '';
      const color = FACTION_COLORS[factionId] || '#ff7518';
      const src   = `${FACTION_ICON_BASE}${factionId}_logo.svg`;
      const label = (FACTION_TITLES[factionId] || '?').charAt(0);
      return `<img
        src="${src}"
        class="cc-faction-icon"
        style="width:${size}px;height:${size}px;--faction-color:${color};"
        onerror="this.style.display='none';this.nextElementSibling.style.display='flex';"
        alt="${esc(factionId)}"
      /><div style="display:none;width:${size}px;height:${size}px;background:${color}22;border:1px solid ${color};border-radius:50%;align-items:center;justify-content:center;font-size:${Math.round(size * 0.45)}px;font-weight:900;color:${color};">${label}</div>`;
    }

    // ================================
    // FIX 2 ── ABILITY DICTIONARY SYSTEM
    // Loads all 8 ability dictionary files from GitHub in the background.
    // Clicking an ability tag opens a proper slide panel with timing + rules text.
    // ================================
    const ABILITY_FILES = [
      '90_ability_dictionary_A.json',
      '91_ability_dictionary_B.json',
      '92_ability_dictionary_C.json',
      '93_ability_dictionary_D.json',
      '94_ability_dictionary_E.json',
      '95_ability_dictionary_F.json',
      '96_ability_dictionary_G.json',
      '97_ability_dictionary_H.json',
    ];
    const ABILITY_BASE = 'https://raw.githubusercontent.com/steamcrow/coffin/main/rules/src/';

    let _abilityCache    = {};
    let _abilityFetched  = false;
    let _abilityFetching = false;

    function ingestAbilityFile(data) {
      if (!data || typeof data.abilities !== 'object') return;
      Object.keys(data.abilities).forEach(slug => {
        const entry = data.abilities[slug];
        if (!entry || typeof entry !== 'object') return;
        _abilityCache[slug] = {
          name:   slugToName(slug),
          id:     entry._id    || '',
          timing: entry.timing || '',
          short:  entry.short  || '',
          long:   entry.long   || '',
        };
      });
    }

    function slugToName(slug) {
      return slug.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
    }

    function formatTiming(timing) {
      if (!timing) return '';
      return timing.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
    }

    function loadAbilityDictionaries() {
      if (_abilityFetched || _abilityFetching) return;
      _abilityFetching = true;
      const promises = ABILITY_FILES.map(filename =>
        fetch(ABILITY_BASE + filename + '?t=' + Date.now())
          .then(r => r.ok ? r.json() : null)
          .then(data => { if (data) ingestAbilityFile(data); })
          .catch(e => console.warn('⚠️ Ability file failed:', filename, e))
      );
      Promise.all(promises).then(() => {
        _abilityFetched  = true;
        _abilityFetching = false;
        console.log('[FB] Abilities loaded —', Object.keys(_abilityCache).length, 'entries');
      });
    }

    function lookupAbility(displayName) {
      if (!displayName) return null;
      const slug = String(displayName).trim().toLowerCase().replace(/\s+/g, '_');
      if (_abilityCache[slug]) return _abilityCache[slug];
      const base = slug.replace(/_\d+$/, '');
      if (_abilityCache[base]) return _abilityCache[base];
      const flat = slug.replace(/_/g, '');
      const keys = Object.keys(_abilityCache);
      for (const k of keys) {
        if (k.replace(/_/g, '') === flat) return _abilityCache[k];
      }
      const firstWord = slug.split('_')[0];
      if (firstWord.length >= 4) {
        for (const k of keys) {
          if (k === firstWord || k.startsWith(firstWord + '_')) return _abilityCache[k];
        }
      }
      return null;
    }

    // ================================
    // FIX 4 ── SLIDE PANEL MANAGEMENT
    // One backdrop, one open panel at a time. Clicking anywhere outside closes.
    // ================================
    const FB_PANEL_IDS = ['fb-ability-panel', 'fb-cloud-roster-panel'];

    function closeAllSlidePanels() {
      FB_PANEL_IDS.forEach(id => {
        const p = document.getElementById(id);
        if (p) {
          p.classList.remove('cc-slide-panel-open');
          setTimeout(() => { if (p.parentNode) p.parentNode.removeChild(p); }, 300);
        }
      });
      const bd = document.getElementById('fb-panel-backdrop');
      if (bd && bd.parentNode) bd.parentNode.removeChild(bd);
    }

    function installPanelBackdrop() {
      if (document.getElementById('fb-panel-backdrop')) return;
      const bd = document.createElement('div');
      bd.id = 'fb-panel-backdrop';
      bd.style.cssText = 'position:fixed;inset:0;z-index:9998;background:transparent;';
      bd.addEventListener('click', closeAllSlidePanels);
      document.body.appendChild(bd);
    }

    // ================================
    // UTILITIES
    // ================================
    function esc(str) {
      if (!str) return '';
      return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
    }

    function generateId() {
      return 'u_' + Math.random().toString(36).substr(2, 9);
    }

    function calculateTotalCost() {
      return state.roster.reduce((sum, item) => sum + (item.totalCost || 0), 0);
    }

    function calculateUnitCost(baseUnit, config) {
      let cost = baseUnit.cost || 0;
      (config.optionalUpgrades || []).forEach(u => { cost += u.cost || 0; });
      if (config.supplemental) cost += config.supplemental.cost || 0;
      return cost;
    }

    // FIX 6 ── Composition limit: 1 of this unit type per composition.per_points ₤
    // Example: per_points: 150, budget: 500 → floor(500/150) = 3 max
    function getMaxAllowed(unit) {
      if (!unit.composition || !unit.composition.per_points) return Infinity;
      if (state.budget <= 0) return Infinity; // unlimited budget = unlimited units
      return Math.floor(state.budget / unit.composition.per_points);
    }

    function countInRoster(unitName) {
      return state.roster.filter(r => r.unitName === unitName).length;
    }

    // ================================
    // DATA LOADING
    // ================================
    const FACTION_BASE_URL = 'https://raw.githubusercontent.com/steamcrow/coffin/main/factions/';

    async function loadFaction(factionId) {
      if (state.factionData[factionId]) return state.factionData[factionId];
      const factionFile = FACTION_FILES.find(f => f.id === factionId);
      if (!factionFile) throw new Error(`Unknown faction: ${factionId}`);
      try {
        const response = await fetch(`${FACTION_BASE_URL}${factionFile.file}?t=${Date.now()}`);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const data = await response.json();
        state.factionData[factionId] = data;
        console.log('✅ Faction loaded:', factionId);
        return data;
      } catch (e) {
        console.error('❌ Failed to load faction:', e);
        alert(`Failed to load faction: ${e.message}`);
        return null;
      }
    }

    async function switchFaction(factionId) {
      if (!factionId) return;
      try {
        const data = await loadFaction(factionId);
        if (data) {
          state.currentFaction = factionId;
          state.roster         = [];
          state.selectedUnitId = null;
          state.builderMode    = null;
          state.builderTarget  = null;
          state.builderConfig  = { optionalUpgrades: [], supplemental: null };
          render();
        }
      } catch (e) {
        console.error('❌ Failed to switch faction:', e);
        alert(`Failed to switch faction: ${e.message}`);
      }
    }

    // ================================
    // LOGIN STATUS
    // ================================
    async function updateLoginStatus() {
      if (!window.CC_STORAGE) return;
      const statusBar = document.getElementById('cc-login-status');
      if (!statusBar) return;
      try {
        const auth = await window.CC_STORAGE.checkAuth();
        statusBar.className = auth.loggedIn ? 'cc-login-status logged-in' : 'cc-login-status logged-out';
        statusBar.innerHTML = auth.loggedIn
          ? `<i class="fa fa-check-circle"></i> Logged in as ${esc(auth.userName)}`
          : `<i class="fa fa-exclamation-circle"></i> Log in to save and load from cloud`;
      } catch (e) {
        const bar = document.getElementById('cc-login-status');
        if (bar) {
          bar.className = 'cc-login-status logged-out';
          bar.innerHTML = `<i class="fa fa-exclamation-circle"></i> Log in to save and load from cloud`;
        }
      }
    }

    // ================================
    // ABILITY TOOLTIP & PANEL
    // FIX 2: real dictionary lookup
    // FIX 4: no stacking — uses shared backdrop
    // ================================
    window.showAbilityTooltip = function(abilityName, event) {
      const tooltip = document.getElementById('ability-tooltip');
      if (!tooltip) return;
      tooltip.textContent = `Click to view: ${abilityName}`;
      tooltip.style.display = 'block';
      tooltip.style.left = event.pageX + 12 + 'px';
      tooltip.style.top  = event.pageY + 12 + 'px';
    };

    window.hideAbilityTooltip = function() {
      const tooltip = document.getElementById('ability-tooltip');
      if (tooltip) tooltip.style.display = 'none';
    };

    window.showAbilityPanel = function(abilityName) {
      loadAbilityDictionaries(); // no-op if already loaded/loading
      closeAllSlidePanels();
      installPanelBackdrop();

      const panel = document.createElement('div');
      panel.id = 'fb-ability-panel';
      panel.className = 'cc-slide-panel';
      panel.addEventListener('click', e => e.stopPropagation());

      // Still loading — show spinner, retry when done
      if (_abilityFetching && !_abilityFetched) {
        panel.innerHTML = `
          <div class="cc-slide-panel-header">
            <h2><i class="fa fa-book"></i> ${esc(abilityName).toUpperCase()}</h2>
            <button onclick="closeAbilityPanel()" class="cc-panel-close-btn"><i class="fa fa-times"></i></button>
          </div>
          <div style="padding:2rem;text-align:center;color:#888;">
            <div style="font-size:2rem;animation:cc-spin 1s linear infinite;display:inline-block;margin-bottom:.75rem;">⟳</div><br>
            Loading ability dictionary…
          </div>`;
        document.body.appendChild(panel);
        setTimeout(() => panel.classList.add('cc-slide-panel-open'), 10);

        let retries = 0;
        const poll = setInterval(() => {
          retries++;
          if (_abilityFetched || retries > 26) {
            clearInterval(poll);
            const old = document.getElementById('fb-ability-panel');
            if (old) { old.classList.remove('cc-slide-panel-open'); setTimeout(() => old.remove(), 300); }
            const bd = document.getElementById('fb-panel-backdrop');
            if (bd && bd.parentNode) bd.parentNode.removeChild(bd);
            if (_abilityFetched) window.showAbilityPanel(abilityName);
          }
        }, 300);
        return;
      }

      const entry = lookupAbility(abilityName);

      const TIMING_COLORS = {
        'Passive':             '#90a4ae',
        'Main Action':         '#42a5f5',
        'Once Per Activation': '#ffd600',
        'Once Per Round':      '#ff9800',
        'Once Per Game':       '#ef5350',
        'Deployment':          '#9c27b0',
        'Reaction':            '#4caf50',
      };
      const timingLabel = entry ? formatTiming(entry.timing) : '';
      const timingColor = TIMING_COLORS[timingLabel] || '#888';

      let bodyHtml;
      if (entry) {
        bodyHtml = `
          ${timingLabel ? `
            <div style="display:inline-block;margin-bottom:1.25rem;padding:3px 12px;border-radius:999px;
                        border:1px solid ${timingColor};color:${timingColor};
                        font-size:.75rem;text-transform:uppercase;letter-spacing:.1em;">
              ${timingLabel}
            </div><br>` : ''}
          ${entry.short ? `<p style="color:#aaa;font-size:.85rem;font-style:italic;margin:0 0 1rem;line-height:1.5;">${esc(entry.short)}</p>` : ''}
          ${entry.long  ? `<p style="color:#e8e8e8;font-size:.95rem;line-height:1.75;margin:0;">${esc(entry.long)}</p>` : ''}
          ${entry.id    ? `<div style="margin-top:1.5rem;font-size:.68rem;color:#333;font-family:monospace;">${esc(entry.id)}</div>` : ''}`;
      } else {
        bodyHtml = `
          <p style="color:#888;font-size:.9rem;line-height:1.55;margin:0 0 .75rem;">
            No rule entry found for <em style="color:#bbb;">${esc(abilityName)}</em>.
          </p>
          <p style="color:#555;font-size:.82rem;line-height:1.5;margin:0;">
            Open the Rules Explorer and search for <em>${esc(abilityName.split(' ')[0])}</em>.
          </p>`;
      }

      panel.innerHTML = `
        <div class="cc-slide-panel-header">
          <h2><i class="fa fa-book"></i> ${esc(abilityName).toUpperCase()}</h2>
          <button onclick="closeAbilityPanel()" class="cc-panel-close-btn"><i class="fa fa-times"></i></button>
        </div>
        <div style="padding:1.5rem;">${bodyHtml}</div>`;

      document.body.appendChild(panel);
      setTimeout(() => panel.classList.add('cc-slide-panel-open'), 10);
    };

    window.closeAbilityPanel = function() {
      closeAllSlidePanels();
    };

    // ================================
    // STAT BADGES
    // ================================
    function buildStatBadges(unit, config, compact = false) {
      const base = { q: unit.quality || 4, d: unit.defense || 2, m: unit.move || 5, r: unit.range || 0 };
      const mods = { q: 0, d: 0, m: 0, r: 0 };

      ((config && config.optionalUpgrades) || []).forEach(u => {
        const sm = u.stat_modifiers || {};
        if (sm.quality) mods.q += sm.quality;
        if (sm.defense) mods.d += sm.defense;
        if (sm.move)    mods.m += sm.move;
        if (sm.range)   mods.r += sm.range;
      });
      if (config && config.supplemental && config.supplemental.stat_modifiers) {
        const sm = config.supplemental.stat_modifiers;
        if (sm.quality) mods.q += sm.quality;
        if (sm.defense) mods.d += sm.defense;
        if (sm.move)    mods.m += sm.move;
        if (sm.range)   mods.r += sm.range;
      }

      const mod = { q: base.q + mods.q, d: base.d + mods.d, m: base.m + mods.m, r: base.r + mods.r };

      const badge = (label, val, baseVal, cls) => {
        const modified   = val !== baseVal;
        const suffix     = (label === 'Q' || label === 'D') ? '+' : '"';
        const displayVal = (val === 0 && label === 'R') ? '-' : val;
        const sizeClass  = compact ? 'compact' : '';
        return `
          <div class="cc-stat-badge stat-${cls}-border ${modified ? 'stat-modified' : ''} ${sizeClass}">
            <span class="cc-stat-label stat-${cls}">${label}</span>
            <span class="cc-stat-value">${displayVal}${suffix}</span>
          </div>`;
      };

      return `
        <div class="stat-badge-flex ${compact ? 'compact' : ''}">
          ${badge('Q', mod.q, base.q, 'q')}
          ${badge('D', mod.d, base.d, 'd')}
          ${badge('M', mod.m, base.m, 'm')}
          ${badge('R', mod.r, base.r, 'r')}
        </div>`;
    }

    // ================================
    // RENDERING
    // ================================
    function renderLibrary() {
      if (!state.currentFaction) {
        return '<div class="cc-muted p-3">Select a faction to see units</div>';
      }
      const faction = state.factionData[state.currentFaction];
      if (!faction || !faction.units) {
        return '<div class="cc-muted p-3">No units available</div>';
      }

      return faction.units.map(unit => {
        const maxAllowed = getMaxAllowed(unit);
        const inRoster   = countInRoster(unit.name);
        const atLimit    = maxAllowed !== Infinity && inRoster >= maxAllowed;

        // Show count badge: "2/3" next to the name
        const limitHint = maxAllowed !== Infinity
          ? `<span style="font-size:0.72rem;font-weight:600;margin-left:4px;color:${atLimit ? '#ff4444' : '#888'};">(${inRoster}/${maxAllowed})</span>`
          : '';

        return `
          <div class="cc-list-item${atLimit ? ' cc-list-item-at-limit' : ''}" onclick="selectLibraryUnit('${esc(unit.name)}')">
            <div class="d-flex justify-content-between align-items-start">
              <div>
                <div class="cc-list-title">${esc(unit.name)}${limitHint}</div>
                <div class="cc-list-sub">${esc(unit.type)}</div>
              </div>
              <div class="fw-bold" style="color: var(--cc-primary)">${unit.cost} ₤</div>
            </div>
          </div>`;
      }).join('');
    }

    function renderRoster() {
      if (state.roster.length === 0) {
        return '<div class="cc-muted p-3">No units in roster</div>';
      }

      if (state.rosterViewMode === 'list') {
        return state.roster.map(item => {
          const isSelected = state.selectedUnitId === item.id;
          const abilities  = item.abilities || [];
          return `
            <div class="cc-roster-list-item ${isSelected ? 'active' : ''}" onclick="selectRosterUnit('${item.id}')">
              <div class="roster-list-header">
                <div>
                  <div class="roster-list-name">${esc(item.name)}</div>
                  <div class="roster-list-type">${esc(item.type)}</div>
                </div>
                <div class="roster-list-cost">${item.totalCost} ₤</div>
              </div>
              ${buildStatBadges(item, item.config, true)}
              ${abilities.length > 0 ? `
                <div class="roster-list-abilities">
                  ${abilities.map(a => {
                    const n = typeof a === 'string' ? a : (a.name || '');
                    return `<span class="ability-tag"
                      onmouseover="showAbilityTooltip('${esc(n)}', event)"
                      onmouseout="hideAbilityTooltip()"
                      onclick="event.stopPropagation(); showAbilityPanel('${esc(n)}')">${esc(n)}</span>`;
                  }).join('')}
                </div>` : ''}
              <button class="roster-list-delete" onclick="event.stopPropagation(); removeRosterUnit('${item.id}')">
                <i class="fa fa-trash"></i>
              </button>
            </div>`;
        }).join('');
      }

      // Grid view
      return `
        <div class="cc-roster-grid">
          ${state.roster.map(item => {
            const isSelected = state.selectedUnitId === item.id;
            const abilities  = item.abilities || [];
            return `
              <div class="cc-roster-grid-item ${isSelected ? 'active' : ''}" onclick="selectRosterUnit('${item.id}')">
                <button class="grid-item-delete" onclick="event.stopPropagation(); removeRosterUnit('${item.id}')">
                  <i class="fa fa-trash"></i>
                </button>
                <div class="grid-item-name">${esc(item.name)}</div>
                <div class="grid-item-type">${esc(item.type)}</div>
                ${buildStatBadges(item, item.config, true)}
                ${abilities.length > 0 ? `
                  <div class="grid-item-abilities">
                    ${abilities.slice(0, 3).map(a => {
                      const n = typeof a === 'string' ? a : (a.name || '');
                      return `<span class="ability-tag-small"
                        onmouseover="showAbilityTooltip('${esc(n)}', event)"
                        onmouseout="hideAbilityTooltip()"
                        onclick="event.stopPropagation(); showAbilityPanel('${esc(n)}')">${esc(n)}</span>`;
                    }).join('')}
                    ${abilities.length > 3 ? `<span class="ability-tag-small" style="opacity:0.6">+${abilities.length - 3}</span>` : ''}
                  </div>` : ''}
              </div>`;
          }).join('')}
        </div>`;
    }

    function getActiveConfig() {
      if (state.builderMode === 'library') return state.builderConfig;
      if (state.builderMode === 'roster') {
        const item = state.roster.find(r => r.id === state.builderTarget);
        return item ? item.config : null;
      }
      return null;
    }

    function updateRosterCost() {
      if (state.builderMode !== 'roster') return;
      const item = state.roster.find(r => r.id === state.builderTarget);
      if (!item) return;
      const faction  = state.factionData[state.currentFaction];
      const baseUnit = faction && faction.units && faction.units.find(function(u) { return u.name === item.unitName; });
      if (!baseUnit) return;
      item.totalCost = calculateUnitCost(baseUnit, item.config);
    }

    function renderSupplemental(unit, config) {
      if (!unit.supplemental_abilities || !unit.supplemental_abilities.length) return '';
      const selected = config.supplemental;
      return `
        <div class="mt-3">
          <div class="cc-field-label">Supplemental (Choose Version)</div>
          <select class="form-select cc-input" onchange="selectSupplemental(this.value)">
            <option value="">-- Select Version --</option>
            ${unit.supplemental_abilities.map(supp => `
              <option value="${esc(supp.name)}" ${(selected && selected.name === supp.name) ? 'selected' : ''}>
                ${esc(supp.name)} ${supp.cost ? `(+${supp.cost}₤)` : ''}
              </option>`).join('')}
          </select>
          ${selected ? `
            <div class="mt-2 p-2" style="background:rgba(255,117,24,.1);border-left:3px solid var(--cc-primary);border-radius:4px;">
              <div class="small">${esc(selected.effect || '')}</div>
              ${selected.stat_modifiers ? `
                <div class="small mt-1" style="color:var(--cc-primary);font-weight:600;">
                  Modifiers: ${Object.entries(selected.stat_modifiers).map(([k,v]) => `${k.toUpperCase()} ${v > 0 ? '+' : ''}${v}`).join(', ')}
                </div>` : ''}
            </div>` : ''}
        </div>`;
    }

    function renderOptionalUpgrades(unit, config) {
      if (!unit.optional_upgrades || !unit.optional_upgrades.length) return '';
      var rows = unit.optional_upgrades.map(function(upg, idx) {
        var isSelected = (config.optionalUpgrades && config.optionalUpgrades.some(function(u){ return u.name === upg.name; }));
        // Use data-upg-idx so upgrade names with apostrophes never break onclick JS strings
        return '<div class="cc-upgrade-row' + (isSelected ? ' selected' : '') + '" ' +
               'data-upg-idx="' + idx + '" onclick="toggleOptionalUpgrade(this)">' +
               '<div class="cc-upgrade-check">' + (isSelected ? '&#10003;' : '') + '</div>' +
               '<div style="flex:1;">' +
               '<div class="fw-bold" style="font-size:.9rem;">' + esc(upg.name) + '</div>' +
               (upg.effect ? '<div class="small cc-muted">' + esc(upg.effect) + '</div>' : '') +
               '</div>' +
               '<div style="color:var(--cc-primary);font-weight:700;">' + (upg.cost ? '+' + upg.cost + ' ₤' : 'Free') + '</div>' +
               '</div>';
      });
      return '<div class="mt-3">' +
             '<div class="cc-field-label">Optional Upgrades</div>' +
             rows.join('') +
             '</div>';
    }

    function renderBuilder() {
      if (!state.builderMode || !state.builderTarget) {
        return `<div class="cc-muted p-3">${state.currentFaction
          ? 'Select a unit from the library to build, or click an existing roster unit to edit.'
          : 'Select a faction first.'}</div>`;
      }

      const faction = state.factionData[state.currentFaction];
      if (!faction) return '<div class="cc-muted p-3">Loading faction data…</div>';

      let unit, config;
      if (state.builderMode === 'library') {
        unit   = (faction.units && faction.units.find(function(u){ return u.name === state.builderTarget; }));
        config = state.builderConfig;
      } else {
        const rosterItem = state.roster.find(r => r.id === state.builderTarget);
        if (!rosterItem) return '<div class="cc-muted p-3">Unit not found</div>';
        unit   = (faction.units && faction.units.find(function(u){ return u.name === rosterItem.unitName; }));
        config = rosterItem.config;
      }
      if (!unit) return '<div class="cc-muted p-3">Unit not found in faction data</div>';

      const previewCost  = calculateUnitCost(unit, config);
      const currentTotal = calculateTotalCost();
      const maxAllowed   = getMaxAllowed(unit);
      const inRoster     = countInRoster(unit.name);

      // FIX 3: compute warning messages
      const wouldExceedBudget = state.budget > 0 && state.builderMode === 'library' && (currentTotal + previewCost > state.budget);
      const wouldExceedLimit  = maxAllowed !== Infinity && state.builderMode === 'library' && inRoster >= maxAllowed;
      const canAdd            = !wouldExceedBudget && !wouldExceedLimit;

      return `
        <div class="cc-unit-detail">
          <div class="detail-header-left">
            ${factionIconHtml(state.currentFaction, 28)}
            <div>
              <div class="cc-detail-title">${esc(unit.name)}</div>
              <div class="cc-detail-sub">${esc(unit.type)}</div>
            </div>
          </div>
          <div class="cc-detail-cost">${previewCost} ₤</div>

          ${buildStatBadges(unit, config)}

          ${unit.lore ? `<div class="u-lore">"${esc(unit.lore)}"</div>` : ''}

          ${unit.weapon ? `
            <div class="mt-3">
              <div class="cc-field-label">Weapon</div>
              <div><strong>${esc(unit.weapon)}</strong>${(unit.weapon_properties && unit.weapon_properties.length)
                ? ` — ${unit.weapon_properties.map(p => esc(p)).join(', ')}` : ''}</div>
            </div>` : ''}

          ${(unit.abilities && unit.abilities.length > 0) ? `
            <div class="mt-3">
              <div class="cc-field-label">Abilities</div>
              ${unit.abilities.map(a => {
                const n = typeof a === 'string' ? a : (a.name || '');
                return `<div class="mb-1">• <strong class="ability-link"
                  onmouseover="showAbilityTooltip('${esc(n)}', event)"
                  onmouseout="hideAbilityTooltip()"
                  onclick="showAbilityPanel('${esc(n)}')">${esc(n)}</strong></div>`;
              }).join('')}
            </div>` : ''}

          ${renderSupplemental(unit, config)}
          ${renderOptionalUpgrades(unit, config)}

          ${wouldExceedBudget ? `
            <div class="cc-warning-bar">
              ⚠️ Adding this unit would exceed your <strong>${state.budget} ₤</strong> budget!
              This unit costs <strong>${previewCost} ₤</strong> and you only have <strong>${state.budget - currentTotal} ₤</strong> left.
            </div>` : ''}

          ${wouldExceedLimit ? `
            <div class="cc-warning-bar">
              ⚠️ Roster limit reached! At <strong>${state.budget} ₤</strong>, this unit type is capped at <strong>${maxAllowed}</strong>
              (1 per ${unit.composition.per_points} ₤). Raise your budget to add more.
            </div>` : ''}

          ${state.builderMode === 'library' ? `
            <button class="btn btn-primary w-100 mt-4" onclick="addUnitToRoster()"
              ${!canAdd ? 'disabled style="opacity:0.45;cursor:not-allowed;"' : ''}>
              <i class="fa fa-plus"></i> ADD TO ROSTER
            </button>` : `
            <button class="btn btn-success w-100 mt-4" onclick="saveRosterUnit()">
              <i class="fa fa-save"></i> SAVE CHANGES
            </button>`}
        </div>`;
    }

    function render() {
      // Faction selector icon
      const selectorIconEl = document.getElementById('cc-faction-selector-icon');
      if (selectorIconEl) {
        if (state.currentFaction) {
          selectorIconEl.innerHTML = factionIconHtml(state.currentFaction, 28);
          selectorIconEl.style.display = 'flex';
        } else {
          selectorIconEl.innerHTML = '';
          selectorIconEl.style.display = 'none';
        }
      }

      // Library panel title
      const libraryTitleEl = document.getElementById('cc-library-panel-title');
      if (libraryTitleEl) {
        libraryTitleEl.innerHTML = state.currentFaction
          ? `<div class="cc-panel-title-with-icon">${factionIconHtml(state.currentFaction, 22)}<span>${esc(FACTION_TITLES[state.currentFaction])} · Units</span></div>`
          : '<span>Unit Library</span>';
      }

      // Roster panel title
      const rosterTitleEl = document.getElementById('cc-roster-panel-title');
      if (rosterTitleEl) {
        rosterTitleEl.innerHTML = state.currentFaction
          ? `<div class="cc-panel-title-with-icon">${factionIconHtml(state.currentFaction, 22)}<span>Your Roster</span></div>`
          : '<span>Your Roster</span>';
      }

      const libraryListEl   = document.getElementById('cc-library-list');
      const builderTargetEl = document.getElementById('cc-builder-target');
      const rosterListEl    = document.getElementById('cc-roster-list');
      const budgetEl        = document.getElementById('cc-budget-display');

      if (libraryListEl)   libraryListEl.innerHTML   = renderLibrary();
      if (builderTargetEl) builderTargetEl.innerHTML = renderBuilder();
      if (rosterListEl)    rosterListEl.innerHTML    = renderRoster();

      // Apply list-mode class to layout container
      var builderLayout = root.querySelector('.cc-faction-builder');
      if (builderLayout) {
        if (state.rosterViewMode === 'list') {
          builderLayout.classList.add('cc-list-mode');
        } else {
          builderLayout.classList.remove('cc-list-mode');
        }
      }

      if (budgetEl) {
        const total      = calculateTotalCost();
        const overBudget = state.budget > 0 && total > state.budget;
        budgetEl.innerHTML   = state.budget > 0 ? `${total} / ${state.budget} ₤` : `${total} ₤`;
        budgetEl.style.color = overBudget ? '#ff4444' : 'var(--cc-primary)';
      }
    }

    // ================================
    // USER ACTIONS
    // ================================
    window.changeFaction   = function(factionId) { switchFaction(factionId); };
    window.changeBudget    = function(val) { state.budget = parseInt(val) || 0; render(); };
    window.updateRosterName = function(val) { state.rosterName = val; };

    window.selectLibraryUnit = function(unitName) {
      state.builderMode    = 'library';
      state.builderTarget  = unitName;
      state.selectedUnitId = null;
      state.builderConfig  = { optionalUpgrades: [], supplemental: null };
      render();
    };

    window.selectRosterUnit = function(rosterId) {
      state.builderMode    = 'roster';
      state.builderTarget  = rosterId;
      state.selectedUnitId = rosterId;
      render();
    };

    window.selectSupplemental = function(suppName) {
      const config = getActiveConfig();
      if (!config) return;
      const faction = state.factionData[state.currentFaction];
      const target  = state.builderMode === 'library'
        ? state.builderTarget
        : (function(){ var _r = state.roster.find(function(r){ return r.id === state.builderTarget; }); return _r && _r.unitName; }());
      const unit = (faction && faction.units && faction.units.find(function(u){ return u.name === target; }));
      if (!unit || !unit.supplemental_abilities) return;
      config.supplemental = suppName === '' ? null
        : Object.assign({}, unit.supplemental_abilities.find(function(s){ return s.name === suppName; }));
      updateRosterCost();
      render();
    };

    window.toggleOptionalUpgrade = function(el) {
      // el is the clicked .cc-upgrade-row element; read index from data attribute
      var upgIdx = parseInt(el.getAttribute('data-upg-idx'), 10);

      var config = getActiveConfig();
      if (!config) return;
      if (!config.optionalUpgrades) config.optionalUpgrades = [];

      // Get the unit so we can find the upgrade by index
      var faction = state.factionData[state.currentFaction];
      if (!faction) return;
      var unitName = state.builderMode === 'library'
        ? state.builderTarget
        : (function() {
            for (var j = 0; j < state.roster.length; j++) {
              if (state.roster[j].id === state.builderTarget) return state.roster[j].unitName;
            }
            return null;
          }());
      var unit = null;
      if (faction.units) {
        for (var k = 0; k < faction.units.length; k++) {
          if (faction.units[k].name === unitName) { unit = faction.units[k]; break; }
        }
      }
      if (!unit || !unit.optional_upgrades) return;
      var upg = unit.optional_upgrades[upgIdx];
      if (!upg) return;

      // Toggle: if already selected, remove it; otherwise add it
      var existingIdx = -1;
      for (var i = 0; i < config.optionalUpgrades.length; i++) {
        if (config.optionalUpgrades[i].name === upg.name) { existingIdx = i; break; }
      }
      if (existingIdx > -1) {
        config.optionalUpgrades.splice(existingIdx, 1);
      } else {
        config.optionalUpgrades.push(Object.assign({}, upg));
      }
      updateRosterCost();
      render();
    };

    // FIX 3 & 6 ── Block add if over budget or at composition limit
    window.addUnitToRoster = function() {
      if (!state.currentFaction || !state.builderTarget) return;
      const faction = state.factionData[state.currentFaction];
      const unit    = (faction && faction.units && faction.units.find(function(u){ return u.name === state.builderTarget; }));
      if (!unit) return;

      const config    = JSON.parse(JSON.stringify(state.builderConfig));
      const totalCost = calculateUnitCost(unit, config);

      // Budget check
      if (state.budget > 0) {
        const currentTotal = calculateTotalCost();
        if (currentTotal + totalCost > state.budget) {
          alert(`⚠️ Budget exceeded!\n\n${unit.name} costs ${totalCost} ₤.\nYou have ${state.budget - currentTotal} ₤ remaining.\n\nRaise your budget or remove a unit first.`);
          return;
        }
      }

      // Composition limit check
      const maxAllowed = getMaxAllowed(unit);
      const inRoster   = countInRoster(unit.name);
      if (maxAllowed !== Infinity && inRoster >= maxAllowed) {
        alert(`⚠️ Unit limit reached!\n\nAt ${state.budget} ₤ you can only field ${maxAllowed} × ${unit.name} (1 per ${unit.composition.per_points} ₤).\n\nRaise your budget to add more.`);
        return;
      }

      const rosterItem = {
        id:        generateId(),
        unitName:  unit.name,
        name:      unit.name,
        type:      unit.type,
        quality:   unit.quality,
        defense:   unit.defense,
        move:      unit.move,
        range:     unit.range,
        weapon:    unit.weapon,
        lore:      unit.lore || '',
        abilities: unit.abilities || [],
        config,
        totalCost
      };

      state.roster.push(rosterItem);
      state.builderMode    = 'roster';
      state.builderTarget  = rosterItem.id;
      state.selectedUnitId = rosterItem.id;
      state.builderConfig  = { optionalUpgrades: [], supplemental: null };
      render();
    };

    window.saveRosterUnit = function() { render(); };

    window.removeRosterUnit = function(rosterId) {
      state.roster = state.roster.filter(r => r.id !== rosterId);
      if (state.selectedUnitId === rosterId) {
        state.builderMode    = null;
        state.builderTarget  = null;
        state.selectedUnitId = null;
        state.builderConfig  = { optionalUpgrades: [], supplemental: null };
      }
      render();
    };

    window.clearRoster = function() {
      if (!confirm('Are you sure you want to clear your entire roster?')) return;
      state.roster         = [];
      state.builderMode    = null;
      state.builderTarget  = null;
      state.selectedUnitId = null;
      state.builderConfig  = { optionalUpgrades: [], supplemental: null };
      render();
    };

    window.toggleRosterView = function(mode) {
      state.rosterViewMode = mode;
      render();
    };

    // FIX 5 ── Print view uses cc_print.css logic in the popup window
    window.printRoster = function() {
      if (state.roster.length === 0) { alert('No units in roster to print!'); return; }
      const total       = calculateTotalCost();
      const factionName = FACTION_TITLES[state.currentFaction] || state.currentFaction || 'Unknown';

      const printContent = `<!DOCTYPE html>
<html>
<head>
  <title>${esc(state.rosterName)} – ${factionName}</title>
  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Bungee&family=Source+Sans+3:wght@400;600;700&display=swap">
  <style>
    /* cc_print.css logic applied inline for popup window */
    :root { --cc-primary: #000; }
    body { font-family: "Source Sans 3", Arial, sans-serif; padding: 20px; background: #fff; color: #000; margin: 0; }
    h1 { font-family: 'Bungee', sans-serif; font-size: 22pt; border-bottom: 2px solid #000; margin-bottom: 16px; padding-bottom: 8px; }
    .roster-meta { font-size: 10pt; color: #444; margin-bottom: 3px; }
    .unit-list { margin-top: 16px; }
    .unit { display: flex; align-items: flex-start; gap: 14px; border-bottom: 1px solid #ccc; padding: 10px 0; page-break-inside: avoid; }
    .unit:last-child { border-bottom: none; }
    .unit-left { flex: 1; min-width: 0; }
    .unit-right { min-width: 60px; text-align: right; }
    .unit-name { font-size: 11pt; font-weight: 700; color: #000; }
    .unit-cost { font-weight: 700; font-size: 11pt; color: #000; white-space: nowrap; }
    .unit-type { color: #555; font-size: 8pt; text-transform: uppercase; margin-bottom: 4px; letter-spacing: .05em; }
    .lore { font-style: italic; color: #666; font-size: 8pt; margin: 3px 0; border-left: 2px solid #ccc; padding-left: 5px; }
    .stat-badges { display: flex; gap: 4px; margin: 4px 0; flex-wrap: nowrap; }
    .stat-badge { border: 1px solid #000; padding: 1px 4px; border-radius: 3px; font-size: 8pt; font-weight: 700; }
    .abilities { margin-top: 4px; }
    .ability-tag { display: inline-block; border: 1px solid #ccc; background: #f9f9f9; color: #000; padding: 1px 4px; margin: 1px; border-radius: 3px; font-size: 7.5pt; }
    .upgrades { margin-top: 4px; font-size: 8pt; color: #444; }
    .cc-app-title-print { display: block; }
    .ability-defs-section { margin-top: 28px; border-top: 2px solid #000; padding-top: 14px; }
    .ability-defs-section h2 { font-family: 'Bungee', sans-serif; font-size: 14pt; margin-bottom: 10px; }
    .ability-def { margin-bottom: 10px; padding-bottom: 10px; border-bottom: 1px solid #ddd; break-inside: avoid; }
    .ability-def:last-child { border-bottom: none; }
    .ability-def-name { font-weight: 700; font-size: 10pt; margin-bottom: 2px; }
    .ability-def-timing { background: #222; color: #fff; font-size: 7.5pt; padding: 1px 5px; border-radius: 3px; margin-right: 5px; font-weight: 600; text-transform: uppercase; letter-spacing: .04em; vertical-align: middle; }
    .ability-def-short { font-style: italic; color: #555; font-size: 8.5pt; margin-bottom: 3px; }
    .ability-def-long { font-size: 9pt; color: #222; line-height: 1.5; }
    @media print {
      .unit { page-break-inside: avoid; }
      .ability-def { page-break-inside: avoid; }
    }
  </style>
</head>
<body>
  <h1>${esc(state.rosterName)}</h1>
  <div class="roster-meta"><strong>Faction:</strong> ${factionName}</div>
  <div class="roster-meta"><strong>Total:</strong> ${total} ₤${state.budget > 0 ? ` / ${state.budget} ₤` : ' (Unlimited)'}</div>
  <div class="roster-meta"><strong>Units:</strong> ${state.roster.length}</div>
  <div class="unit-list">
    ${state.roster.map(function(item) {
      var abilities = item.abilities || [];
      return '<div class="unit">' +
        '<div class="unit-left">' +
          '<div class="unit-name">' + esc(item.name) + '</div>' +
          '<div class="unit-type">' + esc(item.type) + '</div>' +
          (item.lore ? '<div class="lore">\"' + esc(item.lore) + '\"</div>' : '') +
          '<div class="stat-badges">' +
            '<span class="stat-badge">Q ' + item.quality + '+</span> ' +
            '<span class="stat-badge">D ' + item.defense + '+</span> ' +
            '<span class="stat-badge">M ' + item.move + '\"</span> ' +
            '<span class="stat-badge">R ' + (item.range === 0 ? '\u2013' : item.range + '\"') + '</span>' +
          '</div>' +
          (abilities.length > 0 ? '<div class="abilities">' + abilities.map(function(a){ return '<span class="ability-tag">' + esc(typeof a === 'string' ? a : (a.name || '')) + '</span>'; }).join('') + '</div>' : '') +
          ((item.config && item.config.optionalUpgrades && item.config.optionalUpgrades.length > 0) ? '<div class="upgrades"><strong>Upgrades:</strong> ' + item.config.optionalUpgrades.map(function(u){ return esc(u.name); }).join(', ') + '</div>' : '') +
          ((item.config && item.config.supplemental) ? '<div class="upgrades"><strong>Supplemental:</strong> ' + esc(item.config.supplemental.name) + '</div>' : '') +
        '</div>' +
        '<div class="unit-right"><span class="unit-cost">' + item.totalCost + ' ₤</span></div>' +
      '</div>';
    }).join('')}
  </div>


  ${(function() {
    // Collect all unique ability names across entire roster
    var seen = {};
    var allAbilityNames = [];
    state.roster.forEach(function(item) {
      var abilities = item.abilities || [];
      abilities.forEach(function(a) {
        var name = typeof a === 'string' ? a : (a.name || '');
        if (name && !seen[name]) { seen[name] = true; allAbilityNames.push(name); }
      });
      // Also include supplemental and upgrade abilities if they have descriptions
      if (item.config && item.config.supplemental && item.config.supplemental.name) {
        var sName = item.config.supplemental.name;
        if (!seen[sName]) { seen[sName] = true; allAbilityNames.push(sName); }
      }
    });

    // Look up each ability in the cache
    var defs = [];
    allAbilityNames.forEach(function(name) {
      var entry = lookupAbility(name);
      if (entry && (entry.long || entry.short)) {
        defs.push({ name: name, entry: entry });
      }
    });

    if (!defs.length) return '';

    // Sort alphabetically
    defs.sort(function(a, b) { return a.name.localeCompare(b.name); });

    return '<div class="ability-defs-section">' +
      '<h2>Ability Definitions</h2>' +
      defs.map(function(d) {
        var timing = d.entry.timing ? '<span class="ability-def-timing">' + esc(d.entry.timing.replace(/_/g,' ')) + '</span> ' : '';
        return '<div class="ability-def">' +
          '<div class="ability-def-name">' + timing + esc(d.name) + '</div>' +
          (d.entry.short ? '<div class="ability-def-short">' + esc(d.entry.short) + '</div>' : '') +
          (d.entry.long  ? '<div class="ability-def-long">'  + esc(d.entry.long)  + '</div>' : '') +
        '</div>';
      }).join('') +
    '</div>';
  }())}
</body>
</html>`;

      const pw = window.open('', '_blank');
      pw.document.write(printContent);
      pw.document.close();
      pw.focus();
      setTimeout(() => pw.print(), 500);
    };

    // ================================
    // IMPORT / EXPORT
    // ================================
    window.exportRoster = function() {
      const exportData = {
        name:      state.rosterName,
        faction:   state.currentFaction,
        budget:    state.budget,
        roster:    state.roster,
        totalCost: calculateTotalCost(),
        savedAt:   new Date().toISOString()
      };
      const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement('a');
      a.href     = url;
      a.download = (state.rosterName || 'roster').replace(/\s+/g, '_') + '.json';
      a.click();
      URL.revokeObjectURL(url);
    };

    window.importRoster = function(event) {
      const file = event.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = function(e) {
        try {
          const parsed = JSON.parse(e.target.result);
          switchFaction(parsed.faction).then(() => {
            state.rosterName = parsed.name || 'Imported Roster';
            state.budget     = parsed.budget || 500;
            state.roster     = parsed.roster || [];
            const nameInput    = document.getElementById('cc-roster-name');
            const budgetSelect = document.getElementById('cc-budget-selector');
            const factionSel   = document.getElementById('cc-faction-selector');
            if (nameInput)    nameInput.value    = state.rosterName;
            if (budgetSelect) budgetSelect.value = state.budget;
            if (factionSel)   factionSel.value   = parsed.faction;
            render();
            alert('✓ Roster imported!');
          });
        } catch (err) {
          console.error('Import failed:', err);
          alert('Failed to import roster: ' + (err.message || 'Check file format'));
        }
      };
      reader.onerror = () => alert('Failed to read file');
      reader.readAsText(file);
      event.target.value = '';
    };

    // ================================
    // CLOUD STORAGE
    // ================================
    window.saveToCloud = async function() {
      try {
        if (!window.CC_STORAGE) { alert("Cloud storage not available. Please refresh the page."); return; }
        const auth = await window.CC_STORAGE.checkAuth();
        if (!auth.loggedIn) { alert("Please sign in to save rosters to the cloud!"); return; }
        if (!(state.rosterName && state.rosterName.trim())) { alert("Please give your roster a name first!"); return; }

        const exportData = {
          name:      state.rosterName,
          faction:   state.currentFaction,
          budget:    state.budget,
          roster:    state.roster,
          totalCost: calculateTotalCost(),
          savedAt:   new Date().toISOString()
        };
        const result = await window.CC_STORAGE.saveDocument(state.rosterName, JSON.stringify(exportData, null, 2));
        if (result.success) {
          alert(`✓ Roster "${state.rosterName}" ${result.action === 'created' ? 'saved' : 'updated'} to cloud!`);
        }
      } catch (error) {
        alert(error.message === 'Not logged in' ? 'Please sign in to save rosters!' : 'Error saving: ' + error.message);
      }
    };

    window.loadFromCloud = async function() {
      try {
        if (!window.CC_STORAGE) { alert("Cloud storage not available."); return; }
        const auth = await window.CC_STORAGE.checkAuth();
        if (!auth.loggedIn) { alert("Please sign in to load rosters!"); return; }

        const docs = await window.CC_STORAGE.loadDocumentList();
        if (!(docs && docs.length)) { alert("No saved rosters found."); return; }

        // Only show roster saves — not SCN_ scenario saves
        const rosterDocs = docs.filter(d => !(d.name && d.name.startsWith('SCN_')));
        if (!rosterDocs.length) { alert("No roster saves found."); return; }

        closeAllSlidePanels();
        installPanelBackdrop();

        const panel = document.createElement('div');
        panel.id = 'fb-cloud-roster-panel';
        panel.className = 'cc-slide-panel';
        panel.addEventListener('click', e => e.stopPropagation());
        panel.innerHTML = `
          <div class="cc-slide-panel-header">
            <h2><i class="fa fa-cloud-download"></i> LOAD ROSTER</h2>
            <button onclick="closeCloudRosterList()" class="cc-panel-close-btn"><i class="fa fa-times"></i></button>
          </div>
          <div class="cc-roster-list">
            ${rosterDocs.map(r => `
              <div class="cc-saved-roster-item">
                <div class="cc-saved-roster-name">${esc(r.name)}</div>
                <div class="cc-saved-roster-meta">${r.write_date ? new Date(r.write_date).toLocaleDateString() : ''}</div>
                <div class="cc-saved-roster-actions">
                  <button onclick="loadCloudRoster(${r.id})" class="btn btn-sm btn-warning">
                    <i class="fa fa-folder-open"></i> LOAD
                  </button>
                  <button onclick="deleteCloudRoster(${r.id})" class="btn btn-sm btn-danger">
                    <i class="fa fa-trash"></i>
                  </button>
                </div>
              </div>`).join('')}
          </div>`;
        document.body.appendChild(panel);
        setTimeout(() => panel.classList.add('cc-slide-panel-open'), 10);
      } catch (error) {
        alert('Error loading rosters: ' + error.message);
      }
    };

    window.loadCloudRoster = async function(docId) {
      try {
        if (!window.CC_STORAGE) return;
        const doc    = await window.CC_STORAGE.loadDocument(docId);
        if (!doc) { alert('Roster not found!'); return; }
        // doc may be: a string, an object with .content (string or object), or .value
        var rawData = doc.content || doc.value || doc;
        var parsed;
        if (typeof rawData === 'string') {
          parsed = JSON.parse(rawData);
        } else if (typeof rawData === 'object' && rawData !== null) {
          // already a plain object — use directly
          parsed = rawData;
        } else {
          throw new Error('Unrecognised roster format from cloud storage');
        }
        closeAllSlidePanels();
        // Load faction data WITHOUT calling switchFaction (which resets roster).
        // We load the faction data silently, then restore all state at once.
        var loadedFaction = await loadFaction(parsed.faction);
        if (!loadedFaction) { alert('Could not load faction data for this roster.'); return; }

        state.currentFaction = parsed.faction;
        state.rosterName     = parsed.name   || 'Loaded Roster';
        state.budget         = parsed.budget || 500;
        state.roster         = parsed.roster || [];
        state.builderMode    = null;
        state.builderTarget  = null;
        state.selectedUnitId = null;
        state.builderConfig  = { optionalUpgrades: [], supplemental: null };

        var nameInput    = document.getElementById('cc-roster-name');
        var budgetSelect = document.getElementById('cc-budget-selector');
        var factionSel   = document.getElementById('cc-faction-selector');
        if (nameInput)    nameInput.value    = state.rosterName;
        if (budgetSelect) budgetSelect.value = state.budget;
        if (factionSel)   factionSel.value   = parsed.faction;
        render();
        alert('✓ Roster "' + state.rosterName + '" loaded!');
      } catch (err) {
        alert('Failed to load roster: ' + err.message);
      }
    };

    window.deleteCloudRoster = async function(docId) {
      if (!confirm('Delete this roster? This cannot be undone.')) return;
      try {
        await (window.CC_STORAGE && window.CC_STORAGE.deleteDocument(docId));
        closeAllSlidePanels();
        alert('Roster deleted.');
      } catch (err) {
        alert('Failed to delete: ' + err.message);
      }
    };

    window.closeCloudRosterList = function() { closeAllSlidePanels(); };

    function checkSharedRoster() {
      if (!window.CC_STORAGE) return;
      const sharedData = (window.CC_STORAGE.getSharedData ? window.CC_STORAGE.getSharedData() : null);
      if (!sharedData) return;
      try {
        const parsed = JSON.parse(sharedData);
        switchFaction(parsed.faction).then(() => {
          state.rosterName = parsed.name || 'Shared Roster';
          state.budget     = parsed.budget || 500;
          state.roster     = parsed.roster || [];
          const nameInput    = document.getElementById('cc-roster-name');
          const budgetSelect = document.getElementById('cc-budget-selector');
          const factionSel   = document.getElementById('cc-faction-selector');
          if (nameInput)    nameInput.value    = state.rosterName;
          if (budgetSelect) budgetSelect.value = state.budget;
          if (factionSel)   factionSel.value   = parsed.faction;
          render();
          alert('✓ Loaded shared roster!');
        });
      } catch (e) {
        console.error('Failed to parse shared roster:', e);
      }
    }

    // ================================
    // APP SHELL HTML
    // FIX 1: taller layout — min-height is set in CSS via cc_app_faction_builder.css
    // ================================
    root.innerHTML = `
      <div class="cc-app-shell h-100">

        <div class="cc-app-header">
          <div>
            <h1 class="cc-app-title">Faction Builder</h1>
            <div class="cc-app-subtitle">Build Your Coffin Canyon Roster</div>
          </div>
          <div class="d-flex align-items-center gap-2 flex-wrap">
            <div id="cc-budget-display" style="font-size:1.5rem;font-weight:700;">0 ₤</div>
            <div class="cc-roster-view-toggle">
              <button onclick="toggleRosterView('grid')" class="${state.rosterViewMode === 'grid' ? 'active' : ''}">
                <i class="fa fa-th"></i>
              </button>
              <button onclick="toggleRosterView('list')" class="${state.rosterViewMode === 'list' ? 'active' : ''}">
                <i class="fa fa-list"></i>
              </button>
            </div>
            <button class="btn btn-sm btn-outline-secondary" onclick="saveToCloud()" title="Save Roster to Cloud">
              <i class="fa fa-cloud-upload"></i>
            </button>
            <button class="btn btn-sm btn-outline-secondary" onclick="loadFromCloud()" title="Load Roster from Cloud">
              <i class="fa fa-cloud-download"></i>
            </button>
            <button class="btn btn-sm btn-outline-secondary" onclick="exportRoster()" title="Export JSON">
              <i class="fa fa-download"></i>
            </button>
            <button class="btn btn-sm btn-outline-secondary" onclick="document.getElementById('roster-import').click()" title="Import JSON">
              <i class="fa fa-upload"></i>
            </button>
            <button class="btn btn-sm btn-outline-danger" onclick="clearRoster()" title="Clear Roster">
              <i class="fa fa-trash"></i>
            </button>
            <button class="btn btn-sm btn-outline-secondary" onclick="printRoster()" title="Print Roster">
              <i class="fa fa-print"></i>
            </button>
          </div>
        </div>

        <div id="cc-login-status" class="cc-login-status logged-out">
          <i class="fa fa-exclamation-circle"></i> Checking login status…
        </div>

        <div class="cc-faction-controls">
          <div class="cc-faction-selector-wrap">
            <div id="cc-faction-selector-icon" class="cc-faction-selector-icon" style="display:none;"></div>
            <select id="cc-faction-selector" class="form-select" onchange="changeFaction(this.value)">
              <option value="">SELECT FACTION…</option>
              ${FACTION_FILES.map(f => `<option value="${f.id}">${f.title}</option>`).join('')}
            </select>
          </div>

          <input
            id="cc-roster-name"
            type="text"
            class="form-control cc-input"
            placeholder="Roster Name…"
            value="${esc(state.rosterName)}"
            onchange="updateRosterName(this.value)"
          />

          <select id="cc-budget-selector" class="form-select" onchange="changeBudget(this.value)">
            <option value="0">UNLIMITED ₤</option>
            <option value="500" selected>500 ₤</option>
            <option value="1000">1000 ₤</option>
            <option value="1500">1500 ₤</option>
            <option value="2000">2000 ₤</option>
          </select>
        </div>

        <input type="file" id="roster-import" accept=".json" style="display:none;" onchange="importRoster(event)">

        <div class="cc-faction-builder">

          <aside class="cc-faction-sidebar">
            <div class="cc-panel h-100">
              <div class="cc-panel-head">
                <div id="cc-library-panel-title" class="cc-panel-title">Unit Library</div>
              </div>
              <div id="cc-library-list" class="cc-body"></div>
            </div>
          </aside>

          <main class="cc-faction-main">
            <div class="cc-panel h-100">
              <div class="cc-panel-head">
                <div class="cc-panel-title">Unit Builder</div>
              </div>
              <div id="cc-builder-target" class="cc-body"></div>
            </div>
          </main>

          <aside class="cc-faction-roster">
            <div class="cc-panel h-100">
              <div class="cc-panel-head">
                <div id="cc-roster-panel-title" class="cc-panel-title">Your Roster</div>
              </div>
              <div id="cc-roster-list" class="cc-body"></div>
            </div>
          </aside>

        </div>

        <div id="ability-tooltip" style="display:none;position:fixed;background:#000;color:#fff;padding:7px 11px;border-radius:4px;font-size:12px;z-index:10000;pointer-events:none;border:1px solid var(--cc-primary);max-width:220px;line-height:1.4;"></div>
      </div>
    `;

    // ================================
    // BOOT
    // ================================
    checkSharedRoster();
    render();
    setTimeout(() => updateLoginStatus(), 500);
    loadAbilityDictionaries(); // pre-load in background so ability panels are instant
    console.log("✅ Faction Builder mounted");
  }
};
