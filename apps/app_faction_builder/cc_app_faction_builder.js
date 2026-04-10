/* cc-schema-patched-v1 */
// ================================
// Faction Builder App
// File: coffin/apps/app_faction_builder/cc_app_faction_builder.js
// ================================

console.log("⚔️ Faction Builder app loaded");

// ── Bootstrap Dropdown null-autoClose patch ──────────────────────────────
(function() {
  function patchDropdown() {
    if (!window.bootstrap || !window.bootstrap.Dropdown) return false;
    var OrigDropdown = window.bootstrap.Dropdown;
    function PatchedDropdown(el, config) {
      if (config && config.autoClose === null) config.autoClose = true;
      return new OrigDropdown(el, config);
    }
    Object.keys(OrigDropdown).forEach(function(k) {
      PatchedDropdown[k] = typeof OrigDropdown[k] === 'function'
        ? function() { return OrigDropdown[k].apply(OrigDropdown, arguments); }
        : OrigDropdown[k];
    });
    PatchedDropdown.prototype = OrigDropdown.prototype;
    window.bootstrap.Dropdown = PatchedDropdown;
    console.log("✅ Bootstrap Dropdown autoClose patch applied");
    return true;
  }
  if (!patchDropdown()) {
    var _tries = 0;
    var _iv = setInterval(function() {
      if (patchDropdown() || _tries++ > 20) clearInterval(_iv);
    }, 100);
  }
}());

(function () {
  var _destroyFn = null;

  function mount(rootEl, ctx) {
    var root = rootEl;
    console.log("🚀 Faction Builder init", ctx);

    // ---- SLIDE PANEL CSS — injected synchronously so panels work immediately
    //      regardless of whether cc_ui.css has finished loading from GitHub.
    if (!document.getElementById('cc-fb-panel-styles')) {
      const panelStyle = document.createElement('style');
      panelStyle.id = 'cc-fb-panel-styles';
      panelStyle.textContent = `
        .cc-slide-panel {
          position: fixed !important;
          top: 0 !important;
          right: -520px !important;
          width: 460px;
          max-width: 92vw;
          height: 100vh;
          background: #111 !important;
          border-left: 3px solid #ff7518;
          box-shadow: -10px 0 50px rgba(0,0,0,0.85);
          z-index: 9999 !important;
          transition: right 0.32s ease-in-out !important;
          overflow-y: auto;
          padding: 22px;
          box-sizing: border-box;
        }
        .cc-slide-panel-open {
          right: 0 !important;
        }
        .cc-slide-panel-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 20px;
          padding-bottom: 15px;
          border-bottom: 2px solid #ff7518;
        }
        .cc-slide-panel-header h2 {
          color: #ff7518;
          margin: 0;
          font-size: 17px;
          font-weight: 900;
          text-transform: uppercase;
          letter-spacing: .06em;
        }
        .cc-panel-close-btn {
          background: transparent;
          border: 1px solid #ff7518;
          color: #ff7518;
          padding: 4px 10px;
          border-radius: 4px;
          cursor: pointer;
          font-size: 16px;
          line-height: 1;
        }
        .cc-panel-close-btn:hover {
          background: #ff7518;
          color: #000;
        }
        @media (max-width: 768px) {
          .cc-slide-panel { width: 100vw !important; right: -100vw !important; }
        }

        /* ---- Splash / preloader ---- */
        .cc-loading-container {
          flex: 1;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 2rem;
          background: #0a0806;
        }
        .cc-loading-text {
          color: rgba(255,255,255,0.4);
          font-size: 0.8rem;
          letter-spacing: 0.12em;
          text-transform: uppercase;
          margin-top: 1rem;
        }
        .cc-loading-bar {
          width: 260px;
          max-width: 80vw;
          height: 3px;
          background: rgba(255,117,24,0.15);
          border-radius: 2px;
          overflow: hidden;
          position: relative;
        }
        .cc-loading-progress {
          position: absolute;
          top: 0; left: 0; bottom: 0;
          width: 40%;
          background: #ff7518;
          border-radius: 2px;
          animation: cc-bar-slide 1.4s ease-in-out infinite;
        }
        @keyframes cc-bar-slide {
          0%   { left: -40%; width: 40%; }
          50%  { left: 30%;  width: 50%; }
          100% { left: 110%; width: 40%; }
        }
        @keyframes cc-logo-pulse {
          0%   { filter: drop-shadow(0 0 18px rgba(255,117,24,0.35)); transform: scale(1);    }
          50%  { filter: drop-shadow(0 0 48px rgba(255,117,24,0.85)); transform: scale(1.03); }
          100% { filter: drop-shadow(0 0 18px rgba(255,117,24,0.35)); transform: scale(1);    }
        }
        .cc-splash-logo {
          animation: cc-logo-pulse 2.4s ease-in-out infinite;
        }
      `;
      document.head.appendChild(panelStyle);
    }

    // ---- LOAD CSS ----
    // FIX: paths updated from rules/ui/ → ui/ and rules/apps/ → apps/app_faction_builder/
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

    if (!document.getElementById('cc-faction-builder-styles')) {
      fetch('https://raw.githubusercontent.com/steamcrow/coffin/main/apps/app_faction_builder/cc_app_faction_builder.css?t=' + Date.now())
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

    // ---- LOAD STORAGE HELPERS ----
    // FIX: path updated from rules/src/ → data/src/
    if (!window.CC_STORAGE) {
      fetch('https://raw.githubusercontent.com/steamcrow/coffin/main/apps/storage_helpers.js?t=' + Date.now())
        .then(res => res.text())
        .then(code => {
          const script = document.createElement('script');
          script.textContent = code;
          document.head.appendChild(script);
          console.log('✅ Storage Helpers loaded!');
        })
        .catch(err => console.error('❌ Storage Helpers load failed:', err));
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


    const FACTION_ICON_BASE = 'https://raw.githubusercontent.com/steamcrow/coffin/main/assets/logos/';

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
    // ABILITY DICTIONARY SYSTEM
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
      '98_ability_dictionary_I.json',
    ];
    // FIX: ability base path updated from rules/src/ → data/src/
    const ABILITY_BASE = 'https://raw.githubusercontent.com/steamcrow/coffin/main/data/src/';

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

    // displayName: converts slug or raw ability names to human-readable labels.
    // "load_and_carry" -> "Load and Carry"   "GAS_MASK" -> "Gas Mask"
    const _LC_WORDS = new Set(['and','or','of','the','a','an','in','on','at','to','for','with','by']);
    function displayName(raw) {
      if (!raw) return '';
      const words = String(raw).replace(/_/g, ' ').trim().split(/\s+/);
      return words.map((w, i) => {
        const lower = w.toLowerCase();
        return (i === 0 || !_LC_WORDS.has(lower))
          ? lower.charAt(0).toUpperCase() + lower.slice(1)
          : lower;
      }).join(' ');
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
    // SLIDE PANEL MANAGEMENT
    // ================================
    const FB_PANEL_IDS = ['fb-ability-panel', 'fb-stat-panel', 'fb-cloud-roster-panel'];

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

    function getMaxAllowed(unit) {
      const comp = unit.composition || {};

      // Hard cap: unit.unique OR composition.max_count  → use that number, period.
      // This is for heroes, named characters, etc. Budget size is irrelevant.
      if (unit.unique === true)          return comp.max_count || 1;
      if (comp.max_count != null)        return comp.max_count;

      // Scaling limit: 1 per X points of budget.
      // e.g. per_points:150 at 500 pt budget → floor(500/150) = 3 max.
      // Guard: if per_points is somehow bigger than the budget,
      // that still means "1" — not "0" (which would wrongly block purchase).
      if (comp.per_points) {
        if (state.budget <= 0) return Infinity;
        return Math.max(1, Math.floor(state.budget / comp.per_points));
      }

      return Infinity;
    }

    function countInRoster(unitName) {
      return state.roster.filter(r => r.unitName === unitName).length;
    }

    // ================================
    // DATA LOADING
    // FIX: faction base URL updated from factions/ → data/factions/
    // ================================
    const FACTION_BASE_URL = 'https://raw.githubusercontent.com/steamcrow/coffin/main/data/factions/';

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
    // Auth result cached after first check — no repeated network calls per interaction.
    let _authCache = null;

    async function getAuth() {
      if (_authCache)       return _authCache;
      if (ctx?.auth)        return (_authCache = ctx.auth);
      if (window.CC_AUTH)   return (_authCache = window.CC_AUTH);
      if (window.CC_STORAGE) {
        try { return (_authCache = await window.CC_STORAGE.checkAuth()); }
        catch (e) {}
      }
      return (_authCache = { loggedIn: false });
    }

    async function updateLoginStatus() {
      const statusBar = document.getElementById('cc-login-status');
      if (!statusBar) return;
      const auth = await getAuth();
      statusBar.className = auth.loggedIn ? 'cc-login-status logged-in' : 'cc-login-status logged-out';
      statusBar.innerHTML = auth.loggedIn
        ? `<i class="fa fa-check-circle"></i> Logged in as ${esc(auth.userName)}`
        : `<i class="fa fa-exclamation-circle"></i> Log in to save and load from cloud`;
    }

    // ================================
    // ABILITY PANEL
    // ================================
    window.showAbilityTooltip = function(abilityName, event) {
      const tooltip = document.getElementById('ability-tooltip');
      if (!tooltip) return;
      tooltip.textContent = `Click to view: ${displayName(abilityName)}`;
      tooltip.style.display = 'block';
      tooltip.style.left = event.pageX + 12 + 'px';
      tooltip.style.top  = event.pageY + 12 + 'px';
    };

    window.hideAbilityTooltip = function() {
      const tooltip = document.getElementById('ability-tooltip');
      if (tooltip) tooltip.style.display = 'none';
    };

    window.showAbilityPanel = function(abilityName) {
      loadAbilityDictionaries();
      closeAllSlidePanels();
      installPanelBackdrop();

      const panel = document.createElement('div');
      panel.id = 'fb-ability-panel';
      panel.className = 'cc-slide-panel';
      panel.style.zIndex = '9999';
      panel.addEventListener('click', e => e.stopPropagation());

      if (_abilityFetching && !_abilityFetched) {
        panel.innerHTML = `
          <div class="cc-slide-panel-header">
            <h2><i class="fa fa-book"></i> ${esc(displayName(abilityName)).toUpperCase()}</h2>
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
          ${entry.desc_short ? `<p style="color:#aaa;font-size:.85rem;font-style:italic;margin:0 0 1rem;line-height:1.5;">${esc(entry.desc_short)}</p>` : ''}
          ${entry.desc_long  ? `<p style="color:#e8e8e8;font-size:.95rem;line-height:1.75;margin:0;">${esc(entry.desc_long)}</p>` : ''}
          ${entry.id    ? `<div style="margin-top:1.5rem;font-size:.68rem;color:#444;font-family:monospace;">${esc(entry.id)}</div>` : ''}`;
      } else {
        // Fallback: search faction data for a matching upgrade or weapon effect
        let factionEntry = null;
        const factionData = state.factionData && state.factionData[state.currentFaction];
        if (factionData && factionData.units) {
          const nameLower = abilityName.toLowerCase();
          for (const u of factionData.units) {
            // Check optional_upgrades
            if (u.optional_upgrades) {
              const upg = u.optional_upgrades.find(x => x.name && x.name.toLowerCase() === nameLower);
              if (upg) { factionEntry = { source: upg.name, effect: upg.desc_short, type: 'Upgrade', cost: upg.cost }; break; }
            }
            // Check weapon_effects
            if (u.weapon_effects) {
              const we = u.weapon_effects.find(x => x.name && x.name.toLowerCase() === nameLower);
              if (we) { factionEntry = { source: we.name, effect: we.desc_short, type: 'Weapon Effect' }; break; }
            }
            // Check abilities by name
            if (u.abilities) {
              const ab = u.abilities.find(x => (typeof x === 'object') && x.name && x.name.toLowerCase() === nameLower);
              if (ab) { factionEntry = { source: ab.name, effect: ab.desc_short, type: 'Ability' }; break; }
            }
          }
        }

        if (factionEntry) {
          bodyHtml = `
            <div style="display:inline-block;margin-bottom:1rem;padding:3px 12px;border-radius:999px;
                        border:1px solid #555;color:#999;font-size:.72rem;text-transform:uppercase;
                        letter-spacing:.1em;">${esc(factionEntry.type)}${factionEntry.cost ? ' · +' + factionEntry.cost + ' ₤' : ''}</div><br>
            <p style="color:#e8e8e8;font-size:.95rem;line-height:1.75;margin:0;">${esc(factionEntry.desc_short || '')}</p>`;
        } else {
          bodyHtml = `
            <p style="color:#888;font-size:.9rem;line-height:1.55;margin:0 0 .75rem;">
              No rule entry found for <em style="color:#bbb;">${esc(displayName(abilityName))}</em>.
            </p>
            <p style="color:#555;font-size:.82rem;line-height:1.5;margin:0;">
              Open the Rules Explorer and search for <em>${esc(abilityName.split(' ')[0])}</em>.
            </p>`;
        }
      }

      panel.innerHTML = `
        <div class="cc-slide-panel-header">
          <h2><i class="fa fa-book"></i> ${esc(displayName(abilityName)).toUpperCase()}</h2>
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
    // STAT BADGE PANEL
    // ================================
    const STAT_DEFINITIONS = {
      Q: {
        label: 'Quality',
        color: '#2c5282',
        short: 'How capable this unit is at everything it does.',
        long:  'Quality (Q) is the core dice stat. When this unit attacks, uses abilities, or tests Morale, it rolls dice equal to its Quality score. Higher Q means more dice, more consistent results. Q also sets the threshold for critical failures and special ability triggers. The + suffix is a reminder that Quality dice are rolled as a pool, not compared to a fixed number.'
      },
      D: {
        label: 'Defense',
        color: '#9b2c2c',
        short: 'How hard this unit is to damage.',
        long:  'Defense (D) sets how many dice the target rolls when an attack lands. Each die that rolls 5 or higher cancels one hit. A unit with D2 rolls 2 dice per hit — on average one hit is cancelled. D0 means no defense dice at all: every hit lands. The + suffix is a reminder that defense dice are added to the cancel pool.'
      },
      M: {
        label: 'Move',
        color: '#276749',
        short: 'How far this unit can travel per Move action.',
        long:  'Move (M) is the distance in inches this unit can travel when it takes a Move action. A unit gets two actions per activation — it can move twice, attack twice, or split them. Move is also used to calculate charge range, Disengage distances, and some ability triggers. Terrain may reduce effective Move.'
      },
      R: {
        label: 'Range',
        color: '#744210',
        short: 'Maximum distance for ranged attacks.',
        long:  'Range (R) is the maximum distance in inches for this unit\'s ranged attack. A dash (—) means the unit has no ranged attack and must fight in melee. Range is measured from base edge to base edge. Some abilities modify effective range. Line of Sight is always required unless an ability states otherwise.'
      }
    };

    window.showStatPanel = function(statKey) {
      closeAllSlidePanels();
      installPanelBackdrop();

      const def = STAT_DEFINITIONS[statKey];
      if (!def) return;

      const panel = document.createElement('div');
      panel.id = 'fb-stat-panel';
      panel.className = 'cc-slide-panel';
      panel.style.zIndex = '9999';
      panel.addEventListener('click', e => e.stopPropagation());

      panel.innerHTML = `
        <div class="cc-slide-panel-header">
          <h2>
            <span style="display:inline-flex;align-items:center;gap:.6rem;">
              <span style="background:${def.color};color:#fff;font-size:.85rem;font-weight:900;
                           padding:3px 9px;border-radius:3px;letter-spacing:.05em;">${statKey}</span>
              ${esc(def.label).toUpperCase()}
            </span>
          </h2>
          <button onclick="closeAbilityPanel()" class="cc-panel-close-btn"><i class="fa fa-times"></i></button>
        </div>
        <div style="padding:1.5rem;">
          <p style="color:#aaa;font-size:.85rem;font-style:italic;margin:0 0 1rem;line-height:1.5;">${esc(def.desc_short)}</p>
          <p style="color:#e8e8e8;font-size:.95rem;line-height:1.75;margin:0;">${esc(def.desc_long)}</p>
        </div>`;

      document.body.appendChild(panel);
      setTimeout(() => panel.classList.add('cc-slide-panel-open'), 10);
    };

    // ================================
    // STAT BADGES
    // ================================
    function getEffectiveStats(baseItem, config) {
      const stats = {
        quality: baseItem.quality || 0,
        defense: baseItem.defense || 0,
        move:    baseItem.move    || 0,
        range:   baseItem.range   || 0
      };
      if (config && config.optionalUpgrades) {
        config.optionalUpgrades.forEach(upgrade => {
          if (upgrade.stat_modifiers) {
            Object.entries(upgrade.stat_modifiers).forEach(([stat, val]) => {
              if (stats[stat] !== undefined) stats[stat] += val;
            });
          }
        });
      }
      if (config && config.supplemental && config.supplemental.stat_modifiers) {
        Object.entries(config.supplemental.stat_modifiers).forEach(([stat, val]) => {
          if (stats[stat] !== undefined) stats[stat] += val;
        });
      }
      return stats;
    }

    function buildStatBadges(unit, config, compact = false) {
      const base = { q: unit.quality || 0, d: unit.defense || 0, m: unit.move || 0, r: unit.range || 0 };
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

      const badge = (label, val, baseVal, cls, statKey) => {
        const modified   = val !== baseVal;
        const suffix     = (label === 'Q' || label === 'D') ? '+' : '"';
        const displayVal = (val === 0 && label === 'R') ? '-' : val;
        const sizeClass  = compact ? 'compact' : '';
        return `
          <div class="cc-stat-badge stat-${cls}-border ${modified ? 'stat-modified' : ''} ${sizeClass}"
               onclick="event.stopPropagation(); showStatPanel('${statKey}')"
               style="cursor:pointer;"
               title="Click to see ${label} rules">
            <span class="cc-stat-label stat-${cls}">${label}</span>
            <span class="cc-stat-value">${displayVal}${suffix}</span>
          </div>`;
      };

      return `
        <div class="stat-badge-flex ${compact ? 'compact' : ''}">
          ${badge('Q', mod.q, base.q, 'q', 'Q')}
          ${badge('D', mod.d, base.d, 'd', 'D')}
          ${badge('M', mod.m, base.m, 'm', 'M')}
          ${badge('R', mod.r, base.r, 'r', 'R')}
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
              ${item.config && item.config.supplemental
              ? `<div class="grid-item-version">${esc(item.config.supplemental.name)}</div>`
              : ''}
    <div class="roster-list-type">${esc(item.type)}</div>
  </div>
  <div class="cc-detail-cost">
    <i class="fa-solid fa-tag"></i>
    <span class="cost-value">${item.totalCost} ₤</span>
  </div>
</div>
              ${buildStatBadges(item, item.config, true)}
              ${abilities.length > 0 ? `
                <div class="roster-list-abilities">
                  ${abilities.map(a => {
                    const n = typeof a === 'string' ? a : (a.name || '');
                    return `<span class="ability-tag"
                      onmouseover="showAbilityTooltip('${esc(n)}', event)"
                      onmouseout="hideAbilityTooltip()"
                      onclick="event.stopPropagation(); showAbilityPanel('${esc(n)}')"
                      style="cursor:pointer;">${esc(displayName(n))}</span>`;
                  }).join('')}
                </div>` : ''}
              ${item.config && item.config.optionalUpgrades && item.config.optionalUpgrades.length > 0 ? `
                <div class="roster-list-upgrades">
                  ${item.config.optionalUpgrades.map(u => `<span class="ability-tag" style="cursor:pointer;" onmouseover="showAbilityTooltip('${esc(u.name)}', event)" onmouseout="hideAbilityTooltip()" onclick="event.stopPropagation(); showAbilityPanel('${esc(u.name)}')">${esc(u.name)}</span>`).join('')}
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
                ${item.config && item.config.supplemental
                  ? `<div class="grid-item-version">${esc(item.config.supplemental.name)}</div>`
                  : ''}
                <div class="grid-item-type">${esc(item.type)}</div>
                ${buildStatBadges(item, item.config, true)}
                ${abilities.length > 0 ? `
                  <div class="grid-item-abilities">
                    ${abilities.map(a => {
                      const n = typeof a === 'string' ? a : (a.name || '');
                      return `<span class="ability-tag-small"
                        onmouseover="showAbilityTooltip('${esc(n)}', event)"
                        onmouseout="hideAbilityTooltip()"
                        onclick="event.stopPropagation(); showAbilityPanel('${esc(n)}')"
                        style="cursor:pointer;">${esc(displayName(n))}</span>`;
                    }).join('')}
                  </div>` : ''}
                ${item.config && item.config.optionalUpgrades && item.config.optionalUpgrades.length > 0 ? `
                  <div class="grid-item-upgrades">
                    ${item.config.optionalUpgrades.map(u => `<span class="ability-tag-small" style="cursor:pointer;" onmouseover="showAbilityTooltip('${esc(u.name)}', event)" onmouseout="hideAbilityTooltip()" onclick="event.stopPropagation(); showAbilityPanel('${esc(u.name)}')">${esc(u.name)}</span>`).join('')}
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
              <div class="small">${esc(selected.desc_short || '')}</div>
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
        return '<div class="cc-upgrade-row' + (isSelected ? ' selected' : '') + '" ' +
               'data-upg-idx="' + idx + '" onclick="toggleOptionalUpgrade(this)">' +
               '<div class="cc-upgrade-check">' + (isSelected ? '&#10003;' : '') + '</div>' +
               '<div style="flex:1;">' +
               '<div class="fw-bold" style="font-size:.9rem;">' + esc(upg.name) + '</div>' +
               (upg.desc_short ? '<div class="small cc-muted">' + esc(upg.desc_short) + '</div>' : '') +
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
                  onclick="showAbilityPanel('${esc(n)}')"
                  style="cursor:pointer;">${esc(displayName(n))}</strong></div>`;
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
              ${unit.unique || (unit.composition && unit.composition.max_count) ? `${unit.name} is a unique character — only ${maxAllowed} per roster.` : `(1 per ${unit.composition.per_points} ₤). Raise your budget to add more.`}
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

      const libraryTitleEl = document.getElementById('cc-library-panel-title');
      if (libraryTitleEl) {
        libraryTitleEl.innerHTML = state.currentFaction
          ? `<div class="cc-panel-title-with-icon">${factionIconHtml(state.currentFaction, 22)}<span>${esc(FACTION_TITLES[state.currentFaction])} · Units</span></div>`
          : '<span>Unit Library</span>';
      }

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
    window.changeFaction    = function(factionId) { switchFaction(factionId); };
    window.changeBudget     = function(val) { state.budget = parseInt(val) || 0; render(); };
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
      var upgIdx = parseInt(el.getAttribute('data-upg-idx'), 10);
      var config = getActiveConfig();
      if (!config) return;
      if (!config.optionalUpgrades) config.optionalUpgrades = [];

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

    window.addUnitToRoster = function() {
      if (!state.currentFaction || !state.builderTarget) return;
      const faction = state.factionData[state.currentFaction];
      const unit    = (faction && faction.units && faction.units.find(function(u){ return u.name === state.builderTarget; }));
      if (!unit) return;

      const config    = JSON.parse(JSON.stringify(state.builderConfig));
      const totalCost = calculateUnitCost(unit, config);

      if (state.budget > 0) {
        const currentTotal = calculateTotalCost();
        if (currentTotal + totalCost > state.budget) {
          alert(`⚠️ Budget exceeded!\n\n${unit.name} costs ${totalCost} ₤.\nYou have ${state.budget - currentTotal} ₤ remaining.\n\nRaise your budget or remove a unit first.`);
          return;
        }
      }

      const maxAllowed = getMaxAllowed(unit);
      const inRoster   = countInRoster(unit.name);
      if (maxAllowed !== Infinity && inRoster >= maxAllowed) {
        const limitReason = (unit.unique || (unit.composition && unit.composition.max_count))
          ? `${unit.name} is unique — only ${maxAllowed} per roster.`
          : `At ${state.budget} ₤ you can field ${maxAllowed} × ${unit.name} ${unit.unique || (unit.composition && unit.composition.max_count) ? `${unit.name} is a unique character — only ${maxAllowed} per roster.` : `(1 per ${unit.composition.per_points} ₤). Raise your budget to add more.`}`;
        alert('⚠️ Roster limit reached!\n\n' + limitReason);
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
    :root { --cc-primary: #000; }
    body { font-family: "Source Sans 3", Arial, sans-serif; padding: 20px; background: #fff; color: #000; margin: 0; }
    h1 { font-family: 'Bungee', sans-serif; font-size: 22pt; border-bottom: 2px solid #000; margin-bottom: 16px; padding-bottom: 8px; }
    .roster-meta { font-size: 10pt; color: #444; margin-bottom: 3px; }
    .unit-list { margin-top: 16px; }
    .unit { display: flex; align-items: flex-start; gap: 14px; border-bottom: 1px solid #ccc; padding: 10px 0; page-break-inside: avoid; }
    .unit:last-child { border-bottom: none; }
    .unit-left { flex: 1; min-width: 0; }
    .unit-right { min-width: 60px; text-align: right; }
    .unit-name { font-size: 11pt; font-weight: 700; }
    .unit-cost { font-weight: 700; font-size: 11pt; white-space: nowrap; }
    .unit-type { color: #555; font-size: 8pt; text-transform: uppercase; margin-bottom: 4px; letter-spacing: .05em; }
    .lore { font-style: italic; color: #666; font-size: 8pt; margin: 3px 0; border-left: 2px solid #ccc; padding-left: 5px; }
    .stat-badges { display: flex; gap: 4px; margin: 4px 0; }
    .stat-badge { border: 1px solid #000; padding: 1px 4px; border-radius: 3px; font-size: 8pt; font-weight: 700; }
    .abilities { margin-top: 4px; }
    .ability-tag { display: inline-block; border: 1px solid #ccc; background: #f9f9f9; padding: 1px 4px; margin: 1px; border-radius: 3px; font-size: 7.5pt; }
    .upgrades { margin-top: 4px; font-size: 8pt; color: #444; }
    .roster-list-upgrades { display: flex; flex-wrap: wrap; gap: 3px; margin-top: 4px; }

    .ability-defs-section { margin-top: 28px; border-top: 2px solid #000; padding-top: 14px; }
    .ability-defs-section h2 { font-family: 'Bungee', sans-serif; font-size: 14pt; margin-bottom: 10px; }
    .ability-def { margin-bottom: 10px; padding-bottom: 10px; border-bottom: 1px solid #ddd; break-inside: avoid; }
    .ability-def:last-child { border-bottom: none; }
    .ability-def-name { font-weight: 700; font-size: 10pt; margin-bottom: 2px; }
    .ability-def-timing { background: #222; color: #fff; font-size: 7.5pt; padding: 1px 5px; border-radius: 3px; margin-right: 5px; font-weight: 600; text-transform: uppercase; }
    .ability-def-short { font-style: italic; color: #555; font-size: 8.5pt; margin-bottom: 3px; }
    .ability-def-long { font-size: 9pt; color: #222; line-height: 1.5; }
    @media print { .unit, .ability-def { page-break-inside: avoid; } }
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
      var ps = getEffectiveStats(item, item.config);
      return '<div class="unit">' +
        '<div class="unit-left">' +
          '<div class="unit-name">' + esc(item.name) + '</div>' +
          ((item.config && item.config.supplemental) ? '<div style="font-size:10px;color:#ff7518;font-weight:600;margin-bottom:3px;">' + esc(item.config.supplemental.name) + '</div>' : '') +
          '<div class="unit-type">' + esc(item.type) + '</div>' +
          (item.lore ? '<div class="lore">"' + esc(item.lore) + '"</div>' : '') +
          '<div class="stat-badges">' +
            '<span class="stat-badge">Q ' + ps.quality + '+</span> ' +
            '<span class="stat-badge">D ' + ps.defense + '+</span> ' +
            '<span class="stat-badge">M ' + ps.move + '"</span> ' +
            '<span class="stat-badge">R ' + (ps.range === 0 ? '\u2013' : ps.range + '"') + '</span>' +
          '</div>' +
          (abilities.length > 0 ? '<div class="abilities">' + abilities.map(function(a){ return '<span class="ability-tag">' + esc(typeof a === 'string' ? a : (a.name || '')) + '</span>'; }).join('') + '</div>' : '') +
          ((item.config && item.config.optionalUpgrades && item.config.optionalUpgrades.length > 0) ? '<div class="abilities">' + item.config.optionalUpgrades.map(function(u){ var n = esc(u.name); return '<span class="ability-tag" style="cursor:pointer;" onmouseover="showAbilityTooltip(\'' + n + '\', event)" onmouseout="hideAbilityTooltip()" onclick="event.stopPropagation(); showAbilityPanel(\'' + n + '\')">' + n + '</span>'; }).join('') + '</div>' : '') +
        '</div>' +
        '<div class="unit-right"><span class="unit-cost">' + item.totalCost + ' ₤</span></div>' +
      '</div>';
    }).join('')}
  </div>

  ${(function() {
    var seen = {};
    var allAbilityNames = [];
    state.roster.forEach(function(item) {
      (item.abilities || []).forEach(function(a) {
        var name = typeof a === 'string' ? a : (a.name || '');
        if (name && !seen[name]) { seen[name] = true; allAbilityNames.push(name); }
      });
    });
    var defs = [];
    allAbilityNames.forEach(function(name) {
      var entry = lookupAbility(name);
      if (entry && (entry.desc_long || entry.desc_short)) defs.push({ name: name, entry: entry });
    });
    if (!defs.length) return '';
    defs.sort(function(a, b) { return a.name.localeCompare(b.name); });
    return '<div class="ability-defs-section"><h2>Ability Definitions</h2>' +
      defs.map(function(d) {
        var timing = d.entry.timing ? '<span class="ability-def-timing">' + esc(d.entry.timing.replace(/_/g,' ')) + '</span> ' : '';
        return '<div class="ability-def">' +
          '<div class="ability-def-name">' + timing + esc(d.name) + '</div>' +
          (d.entry.desc_short ? '<div class="ability-def-short">' + esc(d.entry.desc_short) + '</div>' : '') +
          (d.entry.desc_long  ? '<div class="ability-def-long">'  + esc(d.entry.desc_long)  + '</div>' : '') +
        '</div>';
      }).join('') + '</div>';
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
        const auth = await getAuth();
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
        const auth = await getAuth();
        if (!auth.loggedIn) { alert("Please sign in to load rosters!"); return; }
        const docs = await window.CC_STORAGE.loadDocumentList();
        if (!(docs && docs.length)) { alert("No saved rosters found."); return; }
        const rosterDocs = docs.filter(d => !(d.name && d.name.startsWith('SCN_')));
        if (!rosterDocs.length) { alert("No roster saves found."); return; }

        closeAllSlidePanels();
        installPanelBackdrop();

        const panel = document.createElement('div');
        panel.id = 'fb-cloud-roster-panel';
        panel.className = 'cc-slide-panel';
        panel.style.zIndex = '9999';
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
        const doc = await window.CC_STORAGE.loadDocument(docId);
        if (!doc) { alert('Roster not found!'); return; }

        function tryParse(val) {
          if (!val) return null;
          if (typeof val === 'string') { try { return JSON.parse(val); } catch(e) { return null; } }
          if (typeof val === 'object') return val;
          return null;
        }

        var parsed = null;
        var candidates = [doc.json, doc, doc.content, doc.value, doc.data,
          (doc.content && doc.content.content), (doc.value && doc.value.content)];
        for (var _ci = 0; _ci < candidates.length; _ci++) {
          var attempt = tryParse(candidates[_ci]);
          if (attempt && attempt.faction) { parsed = attempt; break; }
        }
        if (!parsed) {
          console.error('[FB] loadCloudRoster — could not find faction in doc:', JSON.stringify(doc));
          throw new Error('Could not find roster data in cloud response. Check console for details.');
        }
        closeAllSlidePanels();
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
    // BOOT — overlay preloader, render underneath, then reveal
    // ================================
    // The app shell is already in root.innerHTML above.
    // We overlay a .cc-preloader on top of it so render() can run against
    // the real DOM immediately, hidden behind the preloader.

    const _fbBootStart   = Date.now();
    const FB_MIN_SPLASH  = 2000; // 2s minimum — no heavy JSON to wait for

    // Build the overlay preloader and append to root (not replace it)
    const _fbPreloader = document.createElement('div');
    _fbPreloader.id = 'cc-fb-preloader';
    _fbPreloader.className = 'cc-preloader cc-preloader--page';
    _fbPreloader.innerHTML = `
      <img class="cc-preloader-logo"
           src="https://raw.githubusercontent.com/steamcrow/coffin/main/assets/logos/coffin_canyon_logo.png"
           alt="Coffin Canyon"
           style="width:200px;max-width:70vw;">
      <p class="cc-preloader-title">Faction Builder</p>
      <div class="cc-loading-bar" style="width:260px;max-width:80vw;">
        <div class="cc-loading-progress"></div>
      </div>
      <p class="cc-loading-text">Loading faction data&hellip;</p>
    `;
    root.appendChild(_fbPreloader);

    // Run all startup tasks against the real (overlaid) shell immediately
    checkSharedRoster();
    render();
    loadAbilityDictionaries();

    // After minimum hold, fade out and remove preloader, then update login
    const _fbHold = Math.max(0, FB_MIN_SPLASH - (Date.now() - _fbBootStart));
    setTimeout(function() {
      _fbPreloader.classList.add('cc-preloader--hidden');
      setTimeout(function() {
        if (_fbPreloader.parentNode) _fbPreloader.parentNode.removeChild(_fbPreloader);
        updateLoginStatus();
      }, 480); // matches cc_ui.css transition: 0.45s
    }, _fbHold);

    console.log("✅ Faction Builder mounted");
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
