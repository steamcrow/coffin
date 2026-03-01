// ── turn_counter.js ──────────────────────────────────────────────────────────
// Coffin Canyon · Game Turn Counter
// Loaded by cc_loader_core.js and mounted as window.CC_APP.
//
// SECTION MAP
//   ~   8  Init, CSS loading
//   ~  80  Constants — faction registry, colors, noise values, events
//   ~ 140  App state
//   ~ 190  Data loading helpers
//   ~ 260  Turn queue engine
//   ~ 320  Noise & monster pressure
//   ~ 370  Canyon events & Coffin Cough
//   ~ 420  NPC directive engine
//   ~ 490  Render: splash
//   ~ 520  Render: setup screen
//   ~ 680  Render: round start banner
//   ~ 720  Render: activation screen (main screen)
//   ~ 920  Render: round end summary
//   ~ 990  Render: master dispatcher
//   ~1020  Event handlers
//   ~1100  Save / Load
//   ~1180  Boot
// ─────────────────────────────────────────────────────────────────────────────

console.log("⏱️ Turn Counter loaded — coffin/rules/apps/turn_counter.js");

// ═══════════════════════════════════════════════════════════════════════════════
// SAFETY PATCHES — installed synchronously at file load, before ANYTHING else.
//
// These two patches protect against two different ways the page can crash:
//
//  1. JSON.parse patch:
//     storage_helpers.js and Odoo's RPC layer both call JSON.parse() on data
//     that is sometimes empty, undefined, or malformed (a partial network
//     response, an empty Odoo document, etc). Native JSON.parse('') throws
//     SyntaxError: Unexpected end of input. We replace JSON.parse with a
//     wrapper that catches ALL parse errors and returns null instead of
//     throwing, so the error can never become an unhandled rejection.
//
//  2. Rejection guard:
//     Odoo's handleError does error.stack.split(...) without checking first
//     whether .stack exists. If anything rejects with a plain string, null,
//     undefined, or an Odoo RPC error object {message, data, code}, there is
//     no .stack and Odoo crashes with "undefined is not an object".
//     We intercept every unhandled rejection before Odoo sees it. Only proper
//     Error objects with a real string .stack are let through to Odoo.
// ═══════════════════════════════════════════════════════════════════════════════

// ── 1. JSON.parse safety patch ────────────────────────────────────────────────
(function installCCJsonPatch() {
  if (window._ccJsonPatchInstalled) return;
  window._ccJsonPatchInstalled = true;

  var _nativeJSONParse = JSON.parse.bind(JSON);

  JSON.parse = function ccSafeJSONParse(text, reviver) {
    // Return null for anything that would definitely throw before we even try
    if (text === null || text === undefined) return null;
    if (typeof text === 'string' && text.trim() === '') return null;

    // Wrap the actual parse in try/catch so even truly malformed JSON
    // (truncated responses, "undefined" the word, binary garbage, etc.)
    // returns null instead of throwing a SyntaxError into a Promise chain.
    try {
      return reviver ? _nativeJSONParse(text, reviver) : _nativeJSONParse(text);
    } catch (_) {
      return null;
    }
  };

  console.log('🛡️ JSON.parse patch installed');
}());

// ── 3. Bootstrap Dropdown autoClose:null patch ────────────────────────────────
// Odoo's navbar renders dropdown toggles with data-bs-auto-close="null" (a
// string "null" or an actual null, depending on the template version).
// Bootstrap 5's Dropdown._typeCheckConfig() throws a TypeError when it sees
// autoClose is null instead of a boolean or string like "outside"/"inside".
// The error surfaces through Odoo's own owl event wrapper as a synchronous
// throw — NOT as an unhandled Promise rejection — so our rejection guard
// above cannot intercept it.  Fix it at the source instead.
(function patchBootstrapDropdownAutoClose() {
  if (window._ccDropdownPatchInstalled) return;

  function doPatch() {
    // Fix any existing DOM elements that have the bad attribute value
    document.querySelectorAll('[data-bs-auto-close]').forEach(function(el) {
      var v = el.getAttribute('data-bs-auto-close');
      if (v === 'null' || v === null || v === '') {
        el.setAttribute('data-bs-auto-close', 'true');
      }
    });

    // Patch Bootstrap's Dropdown class if available
    var BS = window.bootstrap;
    if (!BS || !BS.Dropdown) return false;

    // Wrap getOrCreateInstance to sanitise config before Bootstrap sees it
    var origGet = BS.Dropdown.getOrCreateInstance;
    if (origGet && !origGet._ccPatched) {
      BS.Dropdown.getOrCreateInstance = function(el, cfg) {
        if (cfg && cfg.autoClose == null) cfg.autoClose = true;
        return origGet.call(this, el, cfg);
      };
      BS.Dropdown.getOrCreateInstance._ccPatched = true;
    }

    // Also wrap the constructor itself as a second line of defence
    // (some Odoo versions call `new Dropdown(el, config)` directly)
    var OrigDropdown = BS.Dropdown;
    if (!OrigDropdown._ccPatched) {
      function PatchedDropdown(el, cfg) {
        if (cfg && cfg.autoClose == null) cfg.autoClose = true;
        return new OrigDropdown(el, cfg);
      }
      PatchedDropdown.getOrCreateInstance = BS.Dropdown.getOrCreateInstance;
      PatchedDropdown._ccPatched = true;
      // Copy any static methods Bootstrap added
      Object.keys(OrigDropdown).forEach(function(k) {
        if (!(k in PatchedDropdown)) PatchedDropdown[k] = OrigDropdown[k];
      });
      BS.Dropdown = PatchedDropdown;
    }
    return true;
  }

  // Try immediately, then retry after Odoo finishes loading its assets
  if (!doPatch()) {
    var _attempts = 0;
    var _timer = setInterval(function() {
      _attempts++;
      if (doPatch() || _attempts > 20) {
        clearInterval(_timer);
        window._ccDropdownPatchInstalled = true;
      }
    }, 300);
  } else {
    window._ccDropdownPatchInstalled = true;
  }

  // Also fix DOM nodes added later (Odoo re-renders the navbar on navigation)
  if (window.MutationObserver) {
    new MutationObserver(function(mutations) {
      mutations.forEach(function(m) {
        m.addedNodes.forEach(function(node) {
          if (node.querySelectorAll) {
            node.querySelectorAll('[data-bs-auto-close]').forEach(function(el) {
              if (el.getAttribute('data-bs-auto-close') === 'null') {
                el.setAttribute('data-bs-auto-close', 'true');
              }
            });
          }
        });
      });
    }).observe(document.body || document.documentElement,
               { childList: true, subtree: true });
  }
}());
(function installCCRejectionGuard() {
  if (window._ccRejectionGuardInstalled) return;
  window._ccRejectionGuardInstalled = true;

  window.addEventListener('unhandledrejection', function ccRejectionGuard(event) {
    var reason = event.reason;

    // ── Odoo-internal Bootstrap dropdown error ────────────────────────────────
    // Odoo's nav menu throws "DROPDOWN: Option autoClose provided type null"
    // when you hover their own menus. It's entirely inside Odoo's own assets.
    // We can't fix it, but we can stop it from crashing Odoo's own handleError.
    if (reason instanceof Error && reason.message &&
        reason.message.indexOf('DROPDOWN') !== -1) {
      event.preventDefault();
      event.stopImmediatePropagation();
      return; // silently swallow — it's Odoo's own bug
    }

    // ── Any error whose stack only references Odoo's own bundled assets ───────
    // These are Odoo-internal errors we have no control over.
    if (reason instanceof Error &&
        typeof reason.stack === 'string' &&
        reason.stack.indexOf('assets_frontend_lazy') !== -1 &&
        reason.stack.indexOf('cc_app_') === -1) {
      event.preventDefault();
      event.stopImmediatePropagation();
      console.warn('[CC] Swallowed Odoo-internal error:', reason.message);
      return;
    }

    // The only case Odoo can handle safely: a proper Error with a real .stack.
    if (reason instanceof Error &&
        typeof reason.stack === 'string' &&
        reason.stack.length > 0) {
      return; // Let Odoo handle it normally
    }

    // Everything else will crash Odoo's handler — swallow it here.
    event.preventDefault();
    event.stopImmediatePropagation();

    // Log something useful to the console so we still know what happened
    var msg = '[CC] Caught rejection: ';
    try {
      if (reason === null || reason === undefined) {
        msg += '(null/undefined)';
      } else if (typeof reason === 'string') {
        msg += reason;
      } else if (reason instanceof Error) {
        msg += reason.message || reason.toString();
      } else if (typeof reason === 'object') {
        msg += reason.message || reason.data || JSON.stringify(reason);
      } else {
        msg += String(reason);
      }
    } catch (_) {
      msg += '(unreadable reason)';
    }

    console.warn(msg, reason);
  }, { capture: true });

  console.log('🛡️ Rejection guard installed');
}());

window.CC_APP = {
  init({ root, ctx }) {
    console.log("🚀 Turn Counter init", ctx);

    // Initialise the global handler object immediately so any code below can
    // safely attach methods to it regardless of declaration order.
    window.CC_TC = {};

    // ── Load shared UI CSS ────────────────────────────────────────────────────
    if (!document.getElementById('cc-core-ui-styles')) {
      fetch('https://raw.githubusercontent.com/steamcrow/coffin/main/rules/ui/cc_ui.css?t=' + Date.now())
        .then(r => r.text())
        .then(css => {
          const s = document.createElement('style');
          s.id = 'cc-core-ui-styles';
          s.textContent = css;
          document.head.appendChild(s);
        })
        .catch(err => console.error('❌ Core CSS failed:', err));
    }

    // JSON.parse safety patch and rejection guard are both installed at the
    // very top of this file (before window.CC_APP), so they are always in
    // place before any async work begins.

    // ── Load CC_STORAGE helper ────────────────────────────────────────────────
    // IMPORTANT: storage_helpers.js loads asynchronously. We must NOT snapshot
    // `!!window.CC_STORAGE` at render time — it will always be false because the
    // fetch hasn't finished yet. Instead we wait for the script to fully load,
    // then re-render the setup screen so `hasStorage` evaluates correctly.
    if (!window.CC_STORAGE) {
      fetch('https://raw.githubusercontent.com/steamcrow/coffin/main/rules/src/storage_helpers.js?t=' + Date.now())
        .then(r => r.text())
        .then(code => {
          return new Promise(function(resolve) {
            const s = document.createElement('script');
            s.textContent = code;
            document.head.appendChild(s);
            // Give the script one tick to execute and set window.CC_STORAGE
            setTimeout(resolve, 50);
          });
        })
        .then(function() {
          // Re-render setup screen now that CC_STORAGE is available
          if (state.phase === 'setup') render();
        })
        .catch(err => console.error('❌ Storage helpers failed:', err));
    }

    const helpers = ctx?.helpers;
    if (!helpers) {
      root.innerHTML = `<div class="cc-app-shell h-100"><div class="container py-5 text-danger"><h4>Helpers not available</h4></div></div>`;
      return;
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // CONSTANTS
    // ═══════════════════════════════════════════════════════════════════════════

    const FACTION_META = {
      monster_rangers: { name: 'Monster Rangers', color: '#4caf50', isMonster: false, file: 'faction-monster-rangers-v5.json' },
      liberty_corps:   { name: 'Liberty Corps',   color: '#ef5350', isMonster: false, file: 'faction-liberty-corps-v2.json'  },
      monsterology:    { name: 'Monsterology',     color: '#9c27b0', isMonster: false, file: 'faction-monsterology-v2.json'   },
      monsters:        { name: 'Monsters',         color: '#ff7518', isMonster: true,  file: 'faction-monsters-v2.json'       },
      shine_riders:    { name: 'Shine Riders',     color: '#ffd600', isMonster: false, file: 'faction-shine-riders-v2.json'   },
      crow_queen:      { name: 'Crow Queen',       color: '#00bcd4', isMonster: false, file: 'faction-crow-queen.json'        }
    };

    const LOGO_BASE = 'https://raw.githubusercontent.com/steamcrow/coffin/main/rules/apps/';

    const NOISE_VALUES = {
      shot:      { label: 'Shot',      value: 2 },
      melee:     { label: 'Melee',     value: 3 },
      explosion: { label: 'Explosion', value: 3 },
      ritual:    { label: 'Ritual',    value: 4 },
      ability:   { label: 'Ability',   value: 2 },
      silent:    { label: 'Silent',    value: 0 }
    };

    const CANYON_EVENTS = [
      { id: 'dust_devil',   icon: 'fa-wind', text: 'A dust devil cuts across the board. Ranged attacks are at −1 die until next round.' },
      { id: 'thyr_flare',   icon: 'fa-gem', text: 'Thyr crystals flare. Any unit within 3" of a cache tests Quality or is Shaken.' },
      { id: 'supply_cache', icon: 'fa-box', text: 'A supply drop is spotted. Place a bonus cache token at a random board edge.' },
      { id: 'canyon_echo',  icon: 'fa-assistive-listening-systems', text: 'Sounds carry strangely. Add +2 to current noise.' },
      { id: 'sickness',     icon: 'fa-head-side-cough', text: 'Coffin Cough drifts in. Each faction rolls — 1 or 2: one unit tests Quality.' },
      { id: 'silence',      icon: 'fa-moon', text: 'An unnatural silence falls. Monsters stir — add +3 noise.' },
      { id: 'scavengers',   icon: 'fa-crow', text: 'Scavengers at the nearest objective. It becomes Contested regardless of control.' },
      { id: 'nightfall',    icon: 'fa-moon', text: 'Early dark. Reduce all ranged ranges by 3" until end of next round.' },
      { id: 'tremor',       icon: 'fa-bolt', text: 'The ground shudders. All Unstable terrain escalates one step.' },
      { id: 'canyon_luck',  icon: 'fa-leaf', text: 'Canyon luck. One random unit may remove a Shaken condition immediately.' },
      { id: 'wanted',       icon: 'fa-scroll', text: 'A wanted poster blows past. Shine Riders gain +1 to their next Quality test.' },
      { id: 'thyr_pulse',   icon: 'fa-sun', text: 'The canyon pulses with Thyr light. All ritual actions cost +1 noise this round.' },
    ];

    const FACTION_LOADER_BASE = 'https://raw.githubusercontent.com/steamcrow/coffin/main/factions/';
    const SCENARIO_FOLDER     = 90;
    const FACTION_SAVE_FOLDER = 90;
    const TURN_SAVE_FOLDER    = 91;

    // ═══════════════════════════════════════════════════════════════════════════
    // APP STATE
    // ═══════════════════════════════════════════════════════════════════════════

    const state = {
      phase: 'setup',
      scenarioSave:   null,
      scenarioName:   '',
      factions: [],
      unitState: {},
      round:  1,
      queue:  [],
      queueIndex: 0,
      noiseLevel:    0,
      noiseThreshold: 12,
      monsterRoster: [],
      monstersTriggered: 0,
      coughSeverity: 0,
      timerRunning: false,
      timerStart:   null,
      timerElapsed: 0,
      roundLog: [],
      allRoundLogs: [],
      lastEventRound: 0,
      setupMode:       null,
      loadingData:     false,
      setupTurnIndex:  0,
      activationOrder: [],
    };

    function unitKey(factionId, unitId) { return `${factionId}::${unitId}`; }

    // Safe error string — avoids crashes when the rejected value isn't a proper Error.
    function safeErr(e) {
      if (!e) return 'Unknown error';
      if (typeof e === 'string') return e;
      if (e.message) return e.message;
      try { return JSON.stringify(e); } catch (_) { return String(e); }
    }

    // Safe JSON parse — NEVER throws. Returns null on any failure.
    function safeParseJson(str) {
      if (str === null || str === undefined) return null;
      if (typeof str !== 'string') {
        // If it's already an object, just return it
        if (typeof str === 'object') return str;
        return null;
      }
      if (str.trim() === '') return null;
      try { return JSON.parse(str); } catch (_) { return null; }
    }

    // ── FIX: Extract JSON from a CC_STORAGE document response ─────────────────
    //
    // This is the most important safety function in the whole app.
    // CC_STORAGE can return documents in several different shapes:
    //
    //   1. { json: "..." }        — storage_helpers.js style
    //   2. { datas: "base64..." } — older CCFB component style
    //   3. A plain string         — if loadDocument returns the raw content
    //   4. Already an object      — if it was already parsed upstream
    //
    // We try ALL of these, never throwing, always returning null on failure.
    function docToJson(doc) {
      if (!doc) return null;

      // Case 3: doc is already a plain string — try parsing it directly
      if (typeof doc === 'string') {
        return safeParseJson(doc);
      }

      // Case 4: doc is already a plain data object (not a wrapper)
      // We detect wrappers by checking for the .json or .datas fields.
      // If neither exists but it IS an object with actual data keys, return it.
      if (typeof doc === 'object') {
        var hasJson  = doc.json  !== undefined && doc.json  !== null;
        var hasDatas = doc.datas !== undefined && doc.datas !== null;

        if (!hasJson && !hasDatas) {
          // No wrapper fields — this might already be the parsed data object
          // (e.g. the faction roster itself). Return it if it has any keys.
          if (Object.keys(doc).length > 0) return doc;
          return null;
        }

        // Case 1: .json field — try this first
        if (hasJson) {
          var jsonStr = String(doc.json).trim();
          if (jsonStr) {
            var parsed = safeParseJson(jsonStr);
            if (parsed !== null) return parsed;
            // Fall through to try .datas if .json parse failed
          }
        }

        // Case 2: .datas field — base64 encoded content
        if (hasDatas) {
          try {
            var raw     = String(doc.datas);
            var decoded = decodeURIComponent(escape(atob(raw)));
            var result  = safeParseJson(decoded);
            if (result !== null) return result;
          } catch (_) {
            // atob failed (bad base64) — fall through to null
          }
        }
      }

      return null;
    }

    // ── Safe wrapper for CC_STORAGE.loadDocument ──────────────────────────────
    //
    // THE KEY FIX: loadDocument sometimes calls JSON.parse internally without
    // a try/catch. If it hits a bad document, it throws a SyntaxError that
    // becomes an unhandled Promise rejection and crashes Odoo's error handler.
    //
    // This wrapper catches EVERYTHING — SyntaxError, TypeError, network errors,
    // rejected promises — and returns null instead of letting the error escape.
    async function safeLoadDocument(docId) {
      if (!window.CC_STORAGE) return null;
      try {
        // The .catch() here catches rejections that might escape async/await
        var result = await Promise.resolve(window.CC_STORAGE.loadDocument(docId))
          .catch(function(e) {
            console.warn('⚠️ loadDocument(' + docId + ') rejected:', safeErr(e));
            return null;
          });
        return result || null;
      } catch (e) {
        console.warn('⚠️ loadDocument(' + docId + ') threw:', safeErr(e));
        return null;
      }
    }

    // Rejection guard is installed at file level (top of this script),
    // before init() runs. Nothing to do here.


    function getUnitState(factionId, unitId) {
      const k = unitKey(factionId, unitId);
      return state.unitState[k];
    }

    function setUnitState(factionId, unitId, patch) {
      const k = unitKey(factionId, unitId);
      state.unitState[k] = Object.assign({}, state.unitState[k], patch);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // DATA LOADING
    // ═══════════════════════════════════════════════════════════════════════════

    async function loadFactionData(factionId) {
      const meta = FACTION_META[factionId];
      if (!meta) return null;
      try {
        const url = FACTION_LOADER_BASE + meta.file + '?t=' + Date.now();
        const res = await fetch(url);
        if (!res.ok) throw new Error('HTTP ' + res.status);
        const text = await res.text();
        if (!text || !text.trim()) throw new Error('Empty response from GitHub');
        try { return JSON.parse(text); }
        catch(parseErr) { throw new Error('Bad JSON from GitHub: ' + text.slice(0, 60)); }
      } catch (err) {
        console.warn(`⚠️ Could not load faction data for ${factionId}:`, safeErr(err));
        return null;
      }
    }

    function buildFactionEntry(factionId, factionData, isNPC, isMonster) {
      const meta  = FACTION_META[factionId] || {};
      const color = meta.color || '#888';
      const name  = meta.name  || factionId;

      const rawUnits = factionData?.units || factionData?.roster || [];
      const allUnits = rawUnits.map((u, i) => ({
        id:      u.id   || `unit_${i}`,
        name:    u.name || `Unit ${i + 1}`,
        quality: u.quality     || u.Quality     || 4,
        move:    u.move        || u.Move        || 6,
        combat:  u.combat      || u.Combat      || null,
        shoot:   u.shoot       || u.Shoot       || null,
        armor:   u.armor       || u.Armor       || null,
        cost:    u.cost        || u.points      || null,
        special: u.special     || u.abilities   || [],
        isTitan: u.titan       || u.is_titan    || false,
      }));

      return {
        id:           factionId,
        name:         factionData?.name || name,
        color,
        isMonster:    isMonster ?? meta.isMonster ?? false,
        isNPC,
        logoUrl:      LOGO_BASE + factionId + '_logo.svg',
        allUnits,
        deployIndex:  0,
      };
    }

    function buildQuickFaction(id, name, unitCount, isNPC, isMonster) {
      const meta  = FACTION_META[id] || {};
      const color = meta.color || '#888';
      const units = [];
      for (let i = 0; i < unitCount; i++) {
        units.push({ id: `unit_${i}`, name: `${name} #${i + 1}`, quality: 4, move: 6,
                     combat: null, shoot: null, armor: null, cost: null, special: [], isTitan: false });
      }
      return { id, name, color, isMonster, isNPC, logoUrl: LOGO_BASE + id + '_logo.svg',
               allUnits: units, deployIndex: 0 };
    }

    // Build a faction entry from a Faction Builder cloud save.
    //
    // FIX: This function is now much more tolerant of different save shapes.
    // The faction builder may save roster items in slightly different formats
    // depending on which version of the builder created the save. We try
    // every reasonable field name before giving up.
    function buildFactionFromSave(factionId, saveData, isNPC) {
      var meta      = FACTION_META[factionId] || {};
      var color     = meta.color    || '#888';
      var name      = meta.name     || factionId;
      var isMonster = meta.isMonster || false;

      // Guard: need a valid object with a non-empty roster array
      if (!saveData || typeof saveData !== 'object') {
        console.warn('buildFactionFromSave: saveData is null/invalid for ' + factionId);
        return null;
      }

      // Find the roster — try every field name the builder might use
      var roster = saveData.roster || saveData.units || saveData.army || saveData.list || null;

      if (!Array.isArray(roster) || roster.length === 0) {
        console.warn('buildFactionFromSave: no usable roster in save for ' + factionId,
          '(keys found:', Object.keys(saveData).join(', ') + ')');
        return null;
      }

      var allUnits = roster.map(function(item, i) {
        if (!item || typeof item !== 'object') return null;
        return {
          id:      item.id       || ('saved_' + i),
          name:    item.name     || item.unitName || item.label || ('Unit ' + (i + 1)),
          quality: item.quality  || item.Quality  || 4,
          move:    item.move     || item.Move     || 6,
          combat:  item.combat   || item.Combat   || null,
          // builder uses 'range' for shoot stat
          shoot:   item.shoot    || item.Shoot    || item.range  || item.Range  || null,
          // builder uses 'defense' for armor stat
          armor:   item.armor    || item.Armor    || item.defense || item.Defence || null,
          cost:    item.totalCost || item.cost    || item.points  || null,
          special: item.abilities || item.special || item.rules  || [],
          isTitan: item.isTitan  || item.titan    || false,
        };
      }).filter(function(u) { return u !== null; }); // remove any nulls from bad items

      if (allUnits.length === 0) {
        console.warn('buildFactionFromSave: all roster items were invalid for ' + factionId);
        return null;
      }

      return {
        id:         factionId,
        name:       saveData.name || saveData.armyName || saveData.factionName || name,
        color:      color,
        isMonster:  isMonster,
        isNPC:      isNPC,
        logoUrl:    LOGO_BASE + factionId + '_logo.svg',
        allUnits:   allUnits,
        deployIndex: 0,
      };
    }

    function initUnitStates(faction) {
      faction.allUnits.forEach(u => {
        const k = unitKey(faction.id, u.id);
        if (!state.unitState[k]) {
          state.unitState[k] = { quality: u.quality, out: false, activated: false };
        }
      });
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // TURN QUEUE ENGINE
    // ═══════════════════════════════════════════════════════════════════════════

    function getActiveUnits(faction) {
      return faction.allUnits.filter(u => {
        const us = getUnitState(faction.id, u.id);
        return us && !us.out;
      });
    }

    function buildQueue() {
      var monsterFactions = state.factions.filter(function(f) { return f.isMonster; });
      var otherFactions   = state.factions.filter(function(f) { return !f.isMonster; });

      for (var i = otherFactions.length - 1; i > 0; i--) {
        var j = Math.floor(Math.random() * (i + 1));
        var tmp = otherFactions[i]; otherFactions[i] = otherFactions[j]; otherFactions[j] = tmp;
      }

      var orderedFactions = monsterFactions.concat(otherFactions);

      var columns = orderedFactions.map(function(f) {
        var active = getActiveUnits(f).slice().sort(function(a, b) {
          return (a.cost != null ? a.cost : 9999) - (b.cost != null ? b.cost : 9999);
        });
        var totalCost = active.reduce(function(s, u) { return s + (u.cost || 0); }, 0);
        return {
          factionId:   f.id,
          factionName: f.name,
          isMonster:   f.isMonster,
          totalCost:   totalCost,
          units:       active.map(function(u) { return u.id; })
        };
      }).filter(function(col) { return col.units.length > 0; });

      var maxLen = 0;
      columns.forEach(function(col) { if (col.units.length > maxLen) maxLen = col.units.length; });

      var queue = [];
      for (var slot = 0; slot < maxLen; slot++) {
        columns.forEach(function(col) {
          if (slot < col.units.length) {
            queue.push({ factionId: col.factionId, unitId: col.units[slot] });
          }
        });
      }

      state.queue           = queue;
      state.queueIndex      = 0;
      state.activationOrder = columns.map(function(c) {
        return { factionId: c.factionId, name: c.factionName, totalCost: c.totalCost, isMonster: c.isMonster };
      });

      state.factions.forEach(function(f) {
        f.allUnits.forEach(function(u) {
          var k = unitKey(f.id, u.id);
          if (state.unitState[k]) {
            state.unitState[k].activated = false;
            state.unitState[k].lastRoll  = null;   // clear roll result each new round
          }
        });
      });
    }

    function currentQueueItem() {
      return state.queue[state.queueIndex] || null;
    }

    function getFactionById(id) {
      return state.factions.find(f => f.id === id) || null;
    }

    function getUnitById(faction, unitId) {
      return faction?.allUnits.find(u => u.id === unitId) || null;
    }

    function advanceQueue() {
      const cur = currentQueueItem();
      if (cur) {
        setUnitState(cur.factionId, cur.unitId, { activated: true });
      }

      state.queueIndex++;

      while (state.queueIndex < state.queue.length) {
        const item = state.queue[state.queueIndex];
        const us   = getUnitState(item.factionId, item.unitId);
        if (!us || us.out) { state.queueIndex++; continue; }
        break;
      }

      return state.queueIndex < state.queue.length;
    }

    function isRoundComplete() {
      return state.queueIndex >= state.queue.length;
    }

    function deployReserves() {
      state.factions.forEach(f => {
        const active = getActiveUnits(f);
        if (active.length === 0 && f.deployIndex < f.allUnits.length) {
          const nextUnit = f.allUnits[f.deployIndex];
          f.deployIndex++;
          setUnitState(f.id, nextUnit.id, { quality: nextUnit.quality, out: false, activated: false });
          state.roundLog.push(`[Deploy] ${f.name}: ${nextUnit.name} deploys.`);
        }
      });
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // NOISE & MONSTER PRESSURE
    // ═══════════════════════════════════════════════════════════════════════════

    // Canyon-generic fallback pool — used only when scenario has no monster list
    // AND the Monsters faction JSON hasn't loaded yet.
    // Ability names here MUST match keys in the ability dictionaries
    // (converted: "brutal_blow" → "Brutal Blow", "berserk" → "Berserk")
    var FALLBACK_MONSTERS = [
      { id: 'ruster',         name: 'Ruster',         quality: 4, move: 6,  combat: 4, shoot: null, armor: null, special: ['Corrode'],              isTitan: false },
      { id: 'snarl',          name: 'Snarl',          quality: 4, move: 8,  combat: 5, shoot: null, armor: null, special: ['Berserk'],               isTitan: false },
      { id: 'canyon_crawler', name: 'Canyon Crawler', quality: 3, move: 5,  combat: 3, shoot: null, armor: 2,    special: ['Armored'],               isTitan: false },
      { id: 'dust_wraith',    name: 'Dust Wraith',    quality: 4, move: 7,  combat: 3, shoot: 3,    armor: null, special: ['Ambush', 'Fast'],        isTitan: false },
      { id: 'thyr_hound',     name: 'Thyr Hound',     quality: 4, move: 7,  combat: 4, shoot: null, armor: null, special: ['Brutal Blow'],           isTitan: false },
      { id: 'iron_stalker',   name: 'Iron Stalker',   quality: 3, move: 5,  combat: 4, shoot: null, armor: 3,    special: ['Armored', 'Anchor'],     isTitan: false },
      { id: 'canyon_titan',   name: 'Canyon Titan',   quality: 3, move: 4,  combat: 5, shoot: null, armor: 4,    special: ['Brutal Blow', 'Anchor'], isTitan: true  },
    ];

    // Live pool fetched from the Monsters faction JSON — filled in loadMonstersFactionData()
    var _monstersFactionPool = [];

    // Pre-fetch the Monsters faction JSON so we have real stats for encounters.
    // Called from beginGame so the data is ready before the first trigger fires.
    async function loadMonstersFactionData() {
      if (_monstersFactionPool.length > 0) return; // already loaded
      try {
        var meta = FACTION_META['monsters'];
        if (!meta) return;
        var url  = FACTION_LOADER_BASE + meta.file + '?t=' + Date.now();
        var res  = await fetch(url);
        if (!res.ok) return;
        var text = await res.text();
        var data = safeParseJson(text);
        if (!data) return;
        var rawUnits = data.units || data.roster || [];
        _monstersFactionPool = rawUnits.map(function(u, i) {
          return {
            id:      u.id      || ('monsters_' + i),
            name:    u.name    || ('Monster ' + (i+1)),
            quality: u.quality || 4,
            move:    u.move    || 6,
            combat:  u.combat  || 4,
            shoot:   u.shoot   || null,
            armor:   u.armor   || null,
            special: u.special || u.abilities || [],
            isTitan: u.titan   || u.is_titan  || false,
          };
        });
        console.log('🐉 Monsters faction loaded — ' + _monstersFactionPool.length + ' monster types');
      } catch (e) {
        console.warn('Could not load monsters faction:', safeErr(e));
      }
    }

    // Pick ONE monster definition for an encounter.
    //
    // Priority:
    //   80% — pick from the scenario's location monster list (state.monsterRoster),
    //          looking up full stats from the Monsters faction pool.
    //   20% — pick from the full Monsters faction pool (random, not back-to-back).
    //   Fallback — FALLBACK_MONSTERS table if neither list has data.
    //
    // Within the scenario list we cycle (modulo) so repeated encounters
    // rotate through all listed types rather than repeating the first one.
    function pickEncounterMonster() {
      var scenarioList = state.monsterRoster || [];   // names/objects from scenario
      var factionPool  = _monstersFactionPool;
      var fallbackPool = FALLBACK_MONSTERS;

      // Helper: find stats for a name, checking faction pool then fallback table
      function statsForName(nameOrObj) {
        var rawName = (typeof nameOrObj === 'string')
          ? nameOrObj
          : (nameOrObj && (nameOrObj.name || nameOrObj.id || ''));
        if (!rawName) return null;
        var lower = rawName.toLowerCase();
        var fromFaction = factionPool.find(function(m) {
          return m.name.toLowerCase() === lower || m.id.toLowerCase() === lower;
        });
        if (fromFaction) return fromFaction;
        var fromFallback = fallbackPool.find(function(m) {
          return m.name.toLowerCase() === lower || m.id.toLowerCase() === lower;
        });
        return fromFallback || {
          id:      lower.replace(/\s+/g,'_') + '_gen',
          name:    rawName,
          quality: 4, move: 6, combat: 4, shoot: null, armor: null,
          special: [], isTitan: false
        };
      }

      // Avoid repeating the exact same monster back-to-back
      var lastId = state._lastMonsterTriggered || '';

      if (scenarioList.length > 0 && Math.random() < 0.80) {
        // 80%: cycle through the scenario list
        var attempts = 0;
        while (attempts < scenarioList.length * 2) {
          var idx   = (state.monstersTriggered + attempts) % scenarioList.length;
          var entry = scenarioList[idx];
          var def   = statsForName(entry);
          if (def && def.id !== lastId) return def;
          attempts++;
        }
        // If we can't avoid a repeat, just take whatever is next
        return statsForName(scenarioList[state.monstersTriggered % scenarioList.length]) || randomFromPool(factionPool, fallbackPool, lastId);
      }

      // 20% (or no scenario list): pick randomly from faction pool
      return randomFromPool(factionPool, fallbackPool, lastId);
    }

    function randomFromPool(factionPool, fallbackPool, excludeId) {
      var pool = factionPool.length > 0 ? factionPool : fallbackPool;
      var filtered = pool.filter(function(m) { return m.id !== excludeId; });
      var candidates = filtered.length > 0 ? filtered : pool;
      return candidates[Math.floor(Math.random() * candidates.length)];
    }

    function addNoise(amount, label) {
      state.noiseLevel += amount;
      if (amount > 0) state.roundLog.push('[Noise] Noise +' + amount + ' (' + label + ')');
      checkMonsterTrigger();
    }

    function checkMonsterTrigger() {
      if (state.noiseLevel < state.noiseThreshold) return;

      var monsterDef = pickEncounterMonster();
      if (!monsterDef) return;

      state._lastMonsterTriggered = monsterDef.id;
      state.monstersTriggered++;
      state.noiseLevel = Math.floor(state.noiseLevel / 2);

      state.roundLog.push('[Monster] Encounter! ' + monsterDef.name + ' approaches from the nearest edge.');

      // Give this instance a unique ID so multiple encounters don't collide
      var instanceId = monsterDef.id + '_enc' + state.monstersTriggered;
      var unit = Object.assign({}, monsterDef, { id: instanceId });

      // Find or create the monsters faction
      var monsterFaction = state.factions.find(function(f) { return f.isMonster; });
      if (!monsterFaction) {
        monsterFaction = {
          id: 'encounters', name: 'Encounters', color: '#ef5350',
          isMonster: true, isNPC: true,
          logoUrl: LOGO_BASE + 'monsters_logo.svg',
          allUnits: [], deployIndex: 0,
        };
        state.factions.push(monsterFaction);
      }

      monsterFaction.allUnits.push(unit);
      var k = unitKey(monsterFaction.id, unit.id);
      state.unitState[k] = { quality: unit.quality, out: false, activated: false, lastRoll: null };

      // Insert immediately after the current activation
      state.queue.splice(state.queueIndex + 1, 0, { factionId: monsterFaction.id, unitId: unit.id });

      showMonsterAlert(monsterDef, monsterFaction, unit);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // CANYON EVENTS & COFFIN COUGH
    // ═══════════════════════════════════════════════════════════════════════════

    function rollCanyonEvent() {
      const chance = state.round >= 3 ? 0.5 : 0.33;
      if (Math.random() > chance) return null;
      const ev = CANYON_EVENTS[Math.floor(Math.random() * CANYON_EVENTS.length)];
      state.lastEventRound = state.round;

      if (ev.id === 'canyon_echo') addNoise(2, 'Canyon Echo');
      if (ev.id === 'silence')     addNoise(3, 'Unnatural Silence');

      state.roundLog.push(`[Event] Canyon Event: ${ev.text}`);
      return ev;
    }

    function tickCoffeinCough() {
      if (Math.random() < 0.4) {
        state.coughSeverity = Math.min(5, state.coughSeverity + 1);
      }
      if (state.coughSeverity >= 5) {
        state.roundLog.push('[Storm] Coffin Cough Storm! Every unit tests Quality or degrades by 1.');
        setTimeout(() => {
          state.coughSeverity = 2;
          render();
        }, 4000);
      }
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // NPC DIRECTIVE ENGINE
    // ═══════════════════════════════════════════════════════════════════════════

    function buildDirective(faction, unit) {
      const motive   = state.scenarioSave?.factions?.find(f => f.id === faction.id)?.motive   || null;
      const approach = state.scenarioSave?.factions?.find(f => f.id === faction.id)?.approach || 'aggressive';

      const us = getUnitState(faction.id, unit.id);
      const q  = us?.quality || unit.quality;

      let priority  = '';
      let ifEngaged = `Attack (Q${q}, 2 actions)`;
      let ifClear   = 'Hold position';

      if (motive) {
        priority = motive;
      } else {
        const approachMap = {
          aggressive:    'Press forward — engage the nearest enemy.',
          defensive:     'Hold current position and protect nearby allies.',
          opportunistic: 'Move toward the highest-value unclaimed objective.',
          support:       'Stay near your faction\'s strongest unit.',
        };
        priority = approachMap[approach] || approachMap.aggressive;
      }

      const primaryObj = state.scenarioSave?.objectives?.[0];
      if (primaryObj?.name) {
        ifClear = `Move toward ${primaryObj.name} and Interact.`;
      }

      return { priority, ifEngaged, ifClear };
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // FACTION LOGO HELPER
    // ═══════════════════════════════════════════════════════════════════════════

    function logoHtml(faction, sizePx = 48) {
      const initial = (faction.name || '?')[0].toUpperCase();
      const color   = faction.color || '#888';
      return `
        <img
          src="${faction.logoUrl}"
          alt="${faction.name}"
          class="cc-faction-logo"
          style="width:${sizePx}px;height:${sizePx}px;object-fit:contain;
                 filter:drop-shadow(0 0 6px ${color}88);"
          onerror="this.onerror=null;this.outerHTML='<div class=\\'cc-faction-logo-fallback\\'
            style=\\'width:${sizePx}px;height:${sizePx}px;border-radius:50%;
            background:${color}22;border:2px solid ${color};
            display:flex;align-items:center;justify-content:center;
            font-weight:900;font-size:${Math.round(sizePx * 0.45)}px;color:${color};\\'>${initial}</div>'"
        />`;
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // STAT BADGE HELPERS
    // ═══════════════════════════════════════════════════════════════════════════

    const STAT_COLORS = {
      quality: '#ff7518',
      move:    '#42a5f5',
      combat:  '#ef5350',
      shoot:   '#ffd600',
      armor:   '#90a4ae',
      cost:    '#555',
    };

    // Stat definitions shown in the slide panel
    var STAT_DEFINITIONS = {
      move:   { label: 'Move', icon: 'fa-shoe-prints', color: '#42a5f5',
                short: 'How far this unit can travel in one action.',
                long:  'Move is measured in inches. A unit may spend one Simple Action to move up to its full Move distance. Difficult terrain costs double movement. A unit may not move through enemy models.' },
      combat: { label: 'Combat', icon: 'fa-sword', color: '#ef5350',
                short: 'Dice rolled in melee attacks.',
                long:  'Combat is the number of dice this unit rolls when making a melee attack. Roll against a target number of 4+. Each die showing 4, 5, or 6 counts as one success. Compare successes to the target\'s Defense to determine damage.' },
      shoot:  { label: 'Shoot', icon: 'fa-crosshairs', color: '#ffd600',
                short: 'Dice rolled in ranged attacks.',
                long:  'Shoot is the number of dice rolled when making a ranged attack. Requires Line of Sight to the target. Ranges are Short (3"), Medium (6"), Long (12") — each step beyond Short costs 1 die. Shooting into melee is not permitted.' },
      armor:  { label: 'Armor', icon: 'fa-shield-alt', color: '#90a4ae',
                short: 'Reduces incoming damage.',
                long:  'Armor reduces damage taken by its value after all other modifiers. A result of 0 or less deals no damage. Armor does not apply against Automatic Damage sources unless the ability specifically states otherwise.' },
    };

    function statBadge(label, value, colorKey) {
      if (value === null || value === undefined) return '';
      const color  = STAT_COLORS[colorKey] || '#888';
      const hasDef = !!STAT_DEFINITIONS[colorKey];
      const clickAttr = hasDef
        ? 'onclick="window.CC_TC.openStatPanel(\'' + colorKey + '\')" style="cursor:pointer;" title="Tap for definition"'
        : '';
      return '<div class="cc-stat-badge" ' + clickAttr +
        ' style="display:inline-flex;flex-direction:column;align-items:center;' +
        'background:' + color + '22;border:1px solid ' + color + '66;border-radius:6px;' +
        'font-size:.85rem;padding:.25rem .5rem;min-width:44px;gap:1px;' +
        (hasDef ? 'transition:background .15s,border-color .15s;' : '') + '">' +
        '<span style="color:' + color + ';font-weight:900;line-height:1;">' + value + '</span>' +
        '<span style="color:' + color + '99;font-size:.65rem;text-transform:uppercase;letter-spacing:.06em;line-height:1;">' + label + '</span>' +
        '</div>';
    }

    // Open the stat definition slide panel
    window.CC_TC.openStatPanel = function(statKey) {
      if (_destroyed) return;
      var def = STAT_DEFINITIONS[statKey];
      if (!def) return;

      var existing = document.getElementById('cc-tc-stat-panel');
      if (existing) existing.parentNode.removeChild(existing);

      var panel = document.createElement('div');
      panel.id = 'cc-tc-stat-panel';
      panel.className = 'cc-slide-panel';
      panel.innerHTML =
        '<div class="cc-slide-panel-header">' +
        '<h2><i class="fa ' + def.icon + '"></i> ' + def.label.toUpperCase() + '</h2>' +
        '<button onclick="window.CC_TC.closeStatPanel()" class="cc-panel-close-btn"><i class="fa fa-times"></i></button>' +
        '</div>' +
        '<div style="padding:1.5rem;">' +
        '<div style="display:inline-block;margin-bottom:1.25rem;padding:3px 12px;border-radius:999px;' +
        'border:1px solid ' + def.color + ';color:' + def.color + ';font-size:.75rem;text-transform:uppercase;letter-spacing:.1em;">' +
        'Stat</div>' +
        '<p style="color:#fff;font-size:1rem;font-weight:600;line-height:1.5;margin:0 0 1rem;">' + def.short + '</p>' +
        '<p style="color:#bbb;font-size:.9rem;line-height:1.7;margin:0;">' + def.long + '</p>' +
        '</div>';
      document.body.appendChild(panel);
      setTimeout(function() { panel.classList.add('cc-slide-panel-open'); }, 10);
    };

    window.CC_TC.closeStatPanel = function() {
      var panel = document.getElementById('cc-tc-stat-panel');
      if (panel) {
        panel.classList.remove('cc-slide-panel-open');
        setTimeout(function() { if (panel.parentNode) panel.parentNode.removeChild(panel); }, 300);
      }
    };

    // ═══════════════════════════════════════════════════════════════════════════
    // QUALITY DICE ROLLER
    // ═══════════════════════════════════════════════════════════════════════════
    //
    // Rules: roll 1d6 per current Quality pip. A 4, 5, or 6 = 1 success.
    // ALL SIXES → Lucky Break (must be resolved immediately).
    // ALL ONES  → Spectacular failure (narrative callout only, no rule penalty).
    // Natural Sixes on an attack: guarantees at least 1 damage if the attack
    // hits — but we don't track attack context here, so we flag the presence
    // of any 6 for the player to apply at the table.

    function rollQuality(currentQ) {
      // Roll currentQ dice, each 1d6
      var dice = [];
      for (var i = 0; i < currentQ; i++) {
        dice.push(Math.floor(Math.random() * 6) + 1);
      }

      var successes  = dice.filter(function(d) { return d >= 4; }).length;
      var allSixes   = dice.length > 0 && dice.every(function(d) { return d === 6; });
      var allOnes    = dice.length > 0 && dice.every(function(d) { return d === 1; });
      var hasAnySix  = dice.some(function(d) { return d === 6; });

      return { dice: dice, successes: successes, allSixes: allSixes,
               allOnes: allOnes, hasAnySix: hasAnySix };
    }

    // Show the dice roll result in an overlay
    function showRollResult(result, unitName, isReview) {
      var existing = document.getElementById('cc-roll-overlay');
      if (existing) existing.remove();

      // Render each die as a coloured pip
      var diceHtml = result.dice.map(function(d) {
        var isHit    = d >= 4;
        var isSix    = d === 6;
        var bg       = isSix ? '#ffd600' : isHit ? '#ff7518' : 'rgba(255,255,255,.1)';
        var fg       = isSix || isHit ? '#000' : '#888';
        var ring     = isSix ? '0 0 0 2px #ffd600' : '';
        return '<div style="width:44px;height:44px;border-radius:8px;background:' + bg + ';' +
          'display:flex;align-items:center;justify-content:center;' +
          'font-size:1.4rem;font-weight:900;color:' + fg + ';' +
          'box-shadow:' + ring + ';flex-shrink:0;">' + d + '</div>';
      }).join('');

      // Result colour
      var resultColor = result.allSixes ? '#ffd600'
                      : result.successes >= Math.ceil(result.dice.length * 0.6) ? '#4caf50'
                      : result.successes > 0 ? '#ff7518'
                      : '#ef5350';

      // Special callout text
      var specialHtml = '';
      if (result.allSixes) {
        specialHtml =
          '<div style="background:#ffd60022;border:2px solid #ffd600;border-radius:8px;padding:.85rem;margin:.75rem 0 0;">' +
          '<div style="color:#ffd600;font-weight:900;font-size:1rem;margin-bottom:.4rem;">' +
          '⭐ LUCKY BREAK — All Sixes!</div>' +
          '<div style="color:#fff;font-size:.82rem;line-height:1.5;margin-bottom:.5rem;">' +
          'Must be used immediately. Cannot be saved. Choose one:' +
          '</div>' +
          '<div style="display:flex;flex-direction:column;gap:.3rem;">' +
          '<div style="font-size:.82rem;color:#ffe082;"><strong>Quick Step</strong> — Free Half Move</div>' +
          '<div style="font-size:.82rem;color:#ffe082;"><strong>Shake It Off</strong> — Remove 1 Pin or Condition</div>' +
          '<div style="font-size:.82rem;color:#ffe082;"><strong>Deadeye</strong> — +1 die on next roll this activation</div>' +
          '<div style="font-size:.82rem;color:#ffe082;"><strong>Get It Done</strong> — Free Interact action</div>' +
          '</div>' +
          '<div style="font-size:.72rem;color:#888;margin-top:.5rem;">' +
          'Only one Lucky Break per activation. Cannot modify attack damage.' +
          '</div>' +
          '</div>';
      } else if (result.allOnes) {
        specialHtml =
          '<div style="background:#ef535022;border:2px solid #ef5350;border-radius:8px;padding:.75rem;margin:.75rem 0 0;">' +
          '<div style="color:#ef5350;font-weight:900;font-size:1rem;">💀 All Ones — Total Failure</div>' +
          '<div style="color:#ffcdd2;font-size:.82rem;margin-top:.3rem;">' +
          'Zero successes. No special rule triggered — just bad luck today.' +
          '</div>' +
          '</div>';
      } else if (result.hasAnySix && !result.allSixes) {
        specialHtml =
          '<div style="background:#ffd60011;border:1px solid #ffd60066;border-radius:6px;' +
          'padding:.5rem .75rem;margin:.75rem 0 0;font-size:.78rem;color:#ffe082;">' +
          '<i class="fa fa-star"></i> <strong>Natural Six present.</strong> ' +
          'If this is an attack roll and it hits, it deals at least 1 damage regardless of total successes.' +
          '</div>';
      }

      var overlay = document.createElement('div');
      overlay.id  = 'cc-roll-overlay';
      overlay.style.cssText = 'position:fixed;inset:0;z-index:10000;background:rgba(0,0,0,.88);' +
        'display:flex;align-items:center;justify-content:center;animation:cc-fade-in .2s ease;';

      overlay.innerHTML =
        '<div style="background:#1a1a1a;border:1px solid rgba(255,255,255,.12);border-radius:12px;' +
        'padding:1.5rem;max-width:400px;width:92%;text-align:center;">' +

        // Unit name + roll label
        '<div style="font-size:.7rem;color:#666;text-transform:uppercase;letter-spacing:.12em;margin-bottom:.25rem;">' +
        (isReview ? '↩ Previous Roll — ' : 'Quality Roll — ') + unitName +
        '</div>' +
        (isReview ? '<div style="font-size:.72rem;color:#555;margin-bottom:.5rem;">One roll per activation. This was your result.</div>' : '') +

        // Dice row
        '<div style="display:flex;flex-wrap:wrap;gap:.4rem;justify-content:center;margin:.75rem 0;">' +
        diceHtml +
        '</div>' +

        // Legend
        '<div style="font-size:.68rem;color:#555;margin-bottom:.75rem;">' +
        '<span style="color:#ffd600;">■</span> 6 &nbsp;' +
        '<span style="color:#ff7518;">■</span> 4–5 = hit &nbsp;' +
        '<span style="color:rgba(255,255,255,.2);">■</span> 1–3 = miss' +
        '</div>' +

        // Successes
        '<div style="font-size:2.2rem;font-weight:900;color:' + resultColor + ';line-height:1;">' +
        result.successes +
        '</div>' +
        '<div style="font-size:.78rem;color:' + resultColor + ';margin-bottom:.25rem;">' +
        'SUCCESS' + (result.successes !== 1 ? 'ES' : '') +
        '</div>' +
        '<div style="font-size:.72rem;color:#555;">' +
        result.dice.length + 'd6 rolled' +
        '</div>' +

        // Special callout (lucky break / all ones / natural 6)
        specialHtml +

        // Dismiss button
        '<button onclick="document.getElementById(\'cc-roll-overlay\').remove()" ' +
        'class="cc-btn" style="width:100%;margin-top:1rem;font-size:1rem;padding:.85rem;">' +
        'Got It' +
        '</button>' +

        '</div>';

      document.body.appendChild(overlay);
    }

    // The quality track: dots to wound/heal + a ROLL button
    function qualityTrack(faction, unit) {
      const us  = getUnitState(faction.id, unit.id);
      const cur = us?.quality ?? unit.quality;
      const max = unit.quality;
      const color = cur <= 1 ? '#ef5350' : STAT_COLORS.quality;
      const hasRolled = !!(us?.lastRoll);

      let dots = '';
      for (let i = max; i >= 1; i--) {
        const filled = i <= cur;
        dots += `<button
          onclick="window.CC_TC.adjustQuality('${faction.id}','${unit.id}',${filled ? -1 : 1})"
          class="cc-q-dot ${filled ? 'filled' : 'empty'}"
          style="width:30px;height:30px;border-radius:50%;border:2px solid ${color};
                 background:${filled ? color : 'transparent'};cursor:pointer;
                 transition:all .15s ease;margin:2px;flex-shrink:0;"
          title="${filled ? 'Tap to wound' : 'Tap to heal'}"
        ></button>`;
      }

      return `
        <div class="cc-quality-track" style="display:flex;flex-direction:column;gap:8px;">
          <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;">
            <span style="color:${color}99;font-size:.7rem;text-transform:uppercase;
                         letter-spacing:.08em;margin-right:2px;flex-shrink:0;">Q</span>
            <div style="display:flex;flex-wrap:wrap;gap:2px;">${dots}</div>
            <span style="color:${color};font-weight:900;font-size:1.1rem;margin-left:4px;flex-shrink:0;">
              ${cur > 0 ? cur : 'OUT?'}
            </span>
          </div>
          ${cur > 0 ? `
          <button
            onclick="window.CC_TC.rollQualityForUnit('${faction.id}','${unit.id}')"
            class="cc-btn"
            style="width:100%;padding:.75rem 1rem;font-size:1rem;letter-spacing:.06em;
                   background:${hasRolled ? 'rgba(255,255,255,.08)' : color + 'dd'};
                   color:${hasRolled ? '#888' : '#000'};
                   border:1px solid ${hasRolled ? '#444' : color};
                   border-radius:8px;"
            title="${hasRolled ? 'Tap to review your roll (one roll per activation)' : 'Roll quality dice'}">
            ${hasRolled ? '↩ &nbsp;View Roll' : '🎲 &nbsp;Roll Q' + cur}
          </button>` : ''}
        </div>`;
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // RENDER: NOISE BAR
    // ═══════════════════════════════════════════════════════════════════════════

    function noiseBarHtml() {
      const pct   = Math.min(100, Math.round((state.noiseLevel / state.noiseThreshold) * 100));
      const color = pct >= 80 ? '#ef5350' : pct >= 50 ? '#ffd600' : '#4caf50';
      return `
        <div class="cc-noise-bar" style="margin:.5rem 0;">
          <div style="display:flex;justify-content:space-between;margin-bottom:3px;">
            <span style="font-size:.7rem;color:#888;text-transform:uppercase;letter-spacing:.08em;">
              <i class="fa fa-assistive-listening-systems"></i> Canyon Noise
            </span>
            <span style="font-size:.7rem;color:${color};font-weight:700;">
              ${state.noiseLevel} / ${state.noiseThreshold}
            </span>
          </div>
          <div style="height:6px;background:rgba(255,255,255,.08);border-radius:3px;overflow:hidden;">
            <div style="height:100%;width:${pct}%;background:${color};
                        transition:width .3s ease;border-radius:3px;"></div>
          </div>
        </div>`;
    }

    function coughBarHtml() {
      if (state.coughSeverity === 0) return '';
      const pct   = Math.round((state.coughSeverity / 5) * 100);
      const color = state.coughSeverity >= 4 ? '#ef5350' : '#ff9800';
      const labels = ['','Trace','Mild','Building','Warning','Storm'];
      return `
        <div style="margin:.3rem 0;">
          <div style="display:flex;justify-content:space-between;margin-bottom:3px;">
            <span style="font-size:.7rem;color:#888;text-transform:uppercase;letter-spacing:.08em;">
              <i class="fa fa-wind"></i> Coffin Cough
            </span>
            <span style="font-size:.7rem;color:${color};font-weight:700;">
              ${labels[state.coughSeverity] || ''}
            </span>
          </div>
          <div style="height:4px;background:rgba(255,255,255,.08);border-radius:2px;overflow:hidden;">
            <div style="height:100%;width:${pct}%;background:${color};border-radius:2px;"></div>
          </div>
        </div>`;
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // RENDER: MONSTER ALERT OVERLAY
    // ═══════════════════════════════════════════════════════════════════════════

    function showMonsterAlert(unit, faction, queueUnit) {
      var name  = unit.name || 'Something from the Canyon';
      var color = (faction && faction.color) || '#ef5350';

      var existing = document.getElementById('cc-monster-alert');
      if (existing) existing.remove();

      // Stat badges for the monster
      var stats = '';
      if (unit.quality) stats += '<span style="background:#ff751822;border:1px solid #ff751866;' +
        'border-radius:4px;padding:2px 8px;font-size:.82rem;color:#ff7518;font-weight:700;">Q' + unit.quality + '</span> ';
      if (unit.move)    stats += '<span style="background:#42a5f522;border:1px solid #42a5f566;' +
        'border-radius:4px;padding:2px 8px;font-size:.82rem;color:#42a5f5;font-weight:700;">' + unit.move + '"</span> ';
      if (unit.combat)  stats += '<span style="background:#ef535022;border:1px solid #ef535066;' +
        'border-radius:4px;padding:2px 8px;font-size:.82rem;color:#ef5350;font-weight:700;">C' + unit.combat + '</span> ';
      if (unit.armor)   stats += '<span style="background:#90a4ae22;border:1px solid #90a4ae66;' +
        'border-radius:4px;padding:2px 8px;font-size:.82rem;color:#90a4ae;font-weight:700;">A' + unit.armor + '</span> ';

      var specials = Array.isArray(unit.special) ? unit.special : (unit.special ? [unit.special] : []);
      var specialHtml = specials.length
        ? '<div style="margin-top:.5rem;display:flex;flex-wrap:wrap;gap:.3rem;justify-content:center;">' +
          specials.map(function(s) {
            return '<span style="padding:2px 7px;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.15);' +
                   'border-radius:3px;font-size:.75rem;color:#ccc;">' + s + '</span>';
          }).join('') + '</div>'
        : '';

      var overlay = document.createElement('div');
      overlay.id = 'cc-monster-alert';
      overlay.style.cssText = 'position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,.9);' +
        'display:flex;align-items:center;justify-content:center;animation:cc-fade-in .3s ease;padding:1rem;box-sizing:border-box;';

      overlay.innerHTML =
        '<div style="text-align:center;padding:1.5rem;max-width:380px;width:100%;' +
        'background:#1a1a1a;border:2px solid ' + color + ';border-radius:12px;">' +
        '<div style="font-size:2.5rem;margin-bottom:.5rem;color:' + color + ';animation:cc-pulse 1s ease infinite;">' +
        '<i class="fa fa-dragon"></i></div>' +
        '<h2 style="color:' + color + ';margin:0 0 .25rem;font-size:1.5rem;">Monster Encounter!</h2>' +
        '<p style="color:#ffcdd2;font-size:1rem;margin:.25rem 0 .75rem;">' +
        '<strong>' + name + '</strong> approaches from the nearest board edge.</p>' +
        '<div style="display:flex;flex-wrap:wrap;gap:.35rem;justify-content:center;margin-bottom:.5rem;">' + stats + '</div>' +
        specialHtml +
        '<div style="margin:.85rem 0 .5rem;padding:.6rem;background:rgba(0,0,0,.3);border-radius:6px;' +
        'font-size:.82rem;color:#aaa;border:1px solid rgba(255,255,255,.08);">' +
        '<i class="fa fa-chevron-right" style="color:' + color + ';margin-right:.4rem;"></i>' +
        name + ' <strong style="color:#fff;">added to the queue</strong> — activates next.</div>' +
        '<button onclick="document.getElementById(\'cc-monster-alert\').remove()" ' +
        'class="cc-btn" style="width:100%;font-size:1rem;padding:.85rem;background:' + color + ';color:#000;">' +
        'Acknowledged — Continue</button>' +
        '</div>';

      document.body.appendChild(overlay);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // RENDER: SETUP SCREEN
    // ═══════════════════════════════════════════════════════════════════════════

    function updateLoginStatus() {
      var bar = document.getElementById('cc-tc-login-status');
      if (!bar) return;
      if (!window.CC_STORAGE) {
        // Storage script may still be loading — retry in 500ms before giving up
        if (!window._ccStorageGaveUp) {
          setTimeout(function() {
            window._ccStorageGaveUp = true;
            updateLoginStatus();
          }, 500);
        } else {
          bar.className = 'cc-login-status logged-out';
          bar.innerHTML = '<i class="fa fa-exclamation-circle"></i> Storage unavailable — cloud saves disabled';
        }
        return;
      }
      window._ccStorageGaveUp = false; // reset for next time
      window.CC_STORAGE.checkAuth().then(function(auth) {
        var bar2 = document.getElementById('cc-tc-login-status');
        if (!bar2) return;
        if (auth && auth.loggedIn) {
          bar2.className = 'cc-login-status logged-in';
          bar2.innerHTML = '<i class="fa fa-check-circle"></i> Signed in as ' +
            (auth.userName || 'User') + ' — cloud saves enabled';
        } else {
          bar2.className = 'cc-login-status logged-out';
          bar2.innerHTML = '<i class="fa fa-exclamation-circle"></i> Not signed in — log in to load scenario &amp; faction saves';
        }
      }).catch(function() {
        var bar2 = document.getElementById('cc-tc-login-status');
        if (bar2) {
          bar2.className = 'cc-login-status logged-out';
          bar2.innerHTML = '<i class="fa fa-exclamation-circle"></i> Could not check login status';
        }
      });
    }

    function renderSetup() {
      const hasStorage = !!window.CC_STORAGE;
      root.innerHTML = `
        <div class="cc-app-shell h-100">

          <div class="cc-app-header">
            <div>
              <h1 class="cc-app-title">Coffin Canyon</h1>
              <div class="cc-app-subtitle">Game Turn Counter</div>
            </div>
          </div>

          <div id="cc-tc-login-status" class="cc-login-status logged-out">
            <i class="fa fa-spinner fa-spin"></i> Checking login&hellip;
          </div>

          <div style="max-width:600px;margin:0 auto;padding:1.5rem;">

            ${state.loadingData ? `
              <div style="text-align:center;padding:3rem;">
                <div style="font-size:2rem;margin-bottom:1rem;animation:cc-spin 1s linear infinite;"><i class="fa fa-cog"></i></div>
                <p style="color:#888;">Loading faction data…</p>
              </div>` : `

            <div class="cc-panel" style="margin-bottom:1rem;">
              <div class="cc-panel-header">
                <h5 style="margin:0;color:var(--cc-primary);"><i class="fa fa-dice"></i> Start a Game</h5>
              </div>
              <div class="cc-panel-body">
                <p style="color:#888;font-size:.9rem;margin:0 0 1rem;">
                  Load a saved scenario to get NPC directives, monster pressure, and objectives.
                  Or jump straight in with Quick Mode.
                </p>
                <div style="display:flex;flex-direction:column;gap:.75rem;">
                  ${hasStorage ? `
                    <button class="cc-btn" onclick="window.CC_TC.openScenarioList()" style="text-align:left;">
                      <i class="fa fa-folder-open" style="margin-right:.75rem;"></i>
                      Load Scenario Save
                      <span style="margin-left:auto;font-size:.75rem;color:#888;text-transform:none;">
                        Loads objectives, NPC motives, monsters
                      </span>
                    </button>` : `
                    <div style="padding:.75rem;border:1px solid rgba(255,255,255,.1);border-radius:6px;color:#666;font-size:.85rem;">
                      <i class="fa fa-ban"></i> Storage not available — use Quick Mode
                    </div>`}
                  <button class="cc-btn cc-btn-secondary" onclick="window.CC_TC.startQuickMode()" style="text-align:left;">
                    <i class="fa fa-bolt" style="margin-right:.75rem;"></i>
                    Quick Mode
                    <span style="margin-left:auto;font-size:.75rem;color:#888;text-transform:none;">
                      Pick factions and go
                    </span>
                  </button>
                </div>
              </div>
            </div>

            ${hasStorage ? `
              <div class="cc-panel">
                <div class="cc-panel-header">
                  <h5 style="margin:0;color:var(--cc-text);">↩️ Resume a Game</h5>
                </div>
                <div class="cc-panel-body">
                  <button class="cc-btn cc-btn-secondary" onclick="window.CC_TC.openGameList()" style="width:100%;">
                    Load Saved Game State
                  </button>
                </div>
              </div>` : ''}
            `}

          </div>
        </div>`;
      setTimeout(updateLoginStatus, 100);
    }

    function renderQuickSetup() {
      const factionList = Object.entries(FACTION_META).map(([id, meta]) => `
        <label style="display:flex;align-items:center;gap:.75rem;padding:.75rem;
                      border:1px solid rgba(255,255,255,.08);border-radius:6px;cursor:pointer;
                      transition:border-color .2s ease;" class="cc-quick-faction-row">
          <input type="checkbox" name="faction" value="${id}" style="width:18px;height:18px;cursor:pointer;"
            onchange="this.closest('.cc-quick-faction-row').style.borderColor = this.checked ? '${meta.color}' : 'rgba(255,255,255,.08)'">
          <div style="width:32px;height:32px;border-radius:50%;background:${meta.color}22;
                      border:2px solid ${meta.color};display:flex;align-items:center;
                      justify-content:center;font-weight:900;font-size:.9rem;color:${meta.color};
                      flex-shrink:0;">${meta.name[0]}</div>
          <span style="flex:1;font-weight:600;">${meta.name}</span>
          <select name="npc_${id}" style="background:#222;border:1px solid rgba(255,255,255,.15);
                                          color:#ccc;border-radius:4px;padding:2px 6px;font-size:.8rem;">
            <option value="player">Player</option>
            <option value="npc" selected>NPC</option>
          </select>
        </label>`).join('');

      root.innerHTML = `
        <div class="cc-app-shell h-100">
          <div class="cc-app-header">
            <div>
              <h1 class="cc-app-title">Coffin Canyon</h1>
              <div class="cc-app-subtitle">Quick Setup</div>
            </div>
            <button class="cc-btn cc-btn-secondary" onclick="window.CC_TC.backToSetup()">← Back</button>
          </div>
          <div style="max-width:600px;margin:0 auto;padding:1.5rem;">
            <div class="cc-panel">
              <div class="cc-panel-header">
                <h5 style="margin:0;color:var(--cc-primary);">Choose Factions</h5>
              </div>
              <div class="cc-panel-body" id="cc-quick-faction-list"
                   style="display:flex;flex-direction:column;gap:.5rem;">
                ${factionList}
              </div>
            </div>
            <div style="margin-top:1rem;display:flex;gap:.75rem;">
              <button class="cc-btn" style="flex:1;" onclick="window.CC_TC.startFromQuickSetup()">
                Start Game →
              </button>
            </div>
          </div>
        </div>`;
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // RENDER: ROUND START BANNER
    // ═══════════════════════════════════════════════════════════════════════════

    function renderRoundBanner() {
      const totalActivations = state.queue.length;

      const orderStrip = state.activationOrder.map(function(ao, idx) {
        var f = getFactionById(ao.factionId);
        if (!f) return '';
        var active = getActiveUnits(f);
        if (!active.length) return '';
        var color = f.color;
        var badge = ao.isMonster
          ? '<span style="font-size:.65rem;color:#ff7518;font-weight:700;margin-left:.25rem;">FIRST</span>'
          : (idx === 1 ? '<span style="font-size:.65rem;color:#888;margin-left:.25rem;"><i class="fa fa-dice"></i></span>' : '');
        return '<div style="display:flex;align-items:center;gap:.5rem;padding:.4rem .6rem;' +
          'border:1px solid ' + color + (ao.isMonster ? '88' : '44') + ';border-radius:6px;background:' + color + (ao.isMonster ? '1a' : '0d') + ';">' +
          '<span style="color:#555;font-size:.7rem;font-weight:700;min-width:1rem;">' + (idx+1) + '</span>' +
          logoHtml(f, 22) +
          '<div style="text-align:left;flex:1;">' +
          '<div style="color:' + color + ';font-size:.75rem;font-weight:700;">' + f.name + badge + '</div>' +
          '<div style="color:#666;font-size:.65rem;">' + active.length + ' unit' + (active.length !== 1 ? 's' : '') +
          (ao.totalCost ? ' &middot; ' + ao.totalCost + ' pts' : '') + ' &middot; cheapest first</div>' +
          '</div>' +
          '</div>';
      }).join('');

      root.innerHTML =
        '<div class="cc-app-shell h-100" style="display:flex;align-items:center;justify-content:center;">' +
        '<div style="text-align:center;padding:1.5rem;max-width:440px;width:100%;">' +
        '<div style="color:var(--cc-primary);font-size:.8rem;text-transform:uppercase;letter-spacing:.2em;margin-bottom:.5rem;">Beginning</div>' +
        '<h1 style="font-size:clamp(3rem,10vw,5rem);margin:0;color:#fff;line-height:1;">Round ' + state.round + '</h1>' +
        '<p style="color:#888;margin:.5rem 0 1.25rem;">' + totalActivations + ' activation' + (totalActivations !== 1 ? 's' : '') + ' this round</p>' +
        (orderStrip
          ? '<div style="margin-bottom:1.25rem;">' +
            '<div style="font-size:.7rem;color:#555;text-transform:uppercase;letter-spacing:.1em;margin-bottom:.4rem;">Activation Order &mdash; Monsters First, then Randomized &mdash; Units: Cheapest to Costliest</div>' +
            '<div style="display:flex;flex-direction:column;gap:.3rem;">' + orderStrip + '</div>' +
            '</div>'
          : '') +
        noiseBarHtml() +
        coughBarHtml() +
        '<button class="cc-btn" style="width:100%;font-size:1.1rem;padding:1rem;margin-top:1rem;" ' +
        'onclick="window.CC_TC.startRound()">Begin Round ' + state.round + ' →</button>' +
        '</div></div>';
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // RENDER: ACTIVATION SCREEN
    // ═══════════════════════════════════════════════════════════════════════════

    function renderActivation() {
      const item    = currentQueueItem();
      if (!item) { endRound(); return; }

      const faction = getFactionById(item.factionId);
      const unit    = getUnitById(faction, item.unitId);
      const us      = getUnitState(item.factionId, item.unitId);
      if (!faction || !unit || !us) { advanceQueue(); render(); return; }

      const remaining = state.queue.length - state.queueIndex;
      const color     = faction.color;

      const statBadges = [
        statBadge('Move', unit.move ? unit.move + '"' : null, 'move'),
        statBadge('Combat', unit.combat, 'combat'),
        statBadge('Shoot', unit.shoot, 'shoot'),
        unit.armor ? statBadge('Armor', unit.armor, 'armor') : '',
      ].join('');

      const directive = faction.isNPC ? buildDirective(faction, unit) : null;

      const directiveHtml = directive ? `
        <div class="cc-panel" style="margin:1rem 0;border-color:${color}44;">
          <div class="cc-panel-header" style="background:${color}11;">
            <h6 style="margin:0;color:${color};font-size:.75rem;text-transform:uppercase;
                       letter-spacing:.1em;"><i class="fa fa-crosshairs"></i> NPC Directive</h6>
          </div>
          <div class="cc-panel-body" style="font-size:.9rem;">
            <div style="margin-bottom:.5rem;"><strong>Priority:</strong> ${directive.priority}</div>
            <div style="color:#aaa;font-size:.82rem;margin-bottom:.25rem;">
              If Engaged: ${directive.ifEngaged}
            </div>
            <div style="color:#aaa;font-size:.82rem;">
              If Clear: ${directive.ifClear}
            </div>
          </div>
        </div>` : '';

      const specialHtml = unit.special?.length ? `
        <div style="margin:.75rem 0;">
          <div style="font-size:.68rem;color:#555;text-transform:uppercase;letter-spacing:.1em;
                      margin-bottom:.4rem;">Abilities <span style="color:#444;font-style:italic;
                      text-transform:none;letter-spacing:0;">— tap to look up rule</span></div>
          <div style="display:flex;flex-wrap:wrap;gap:.4rem;">
            ${(Array.isArray(unit.special) ? unit.special : [unit.special]).map((s, idx) =>
              `<button
                onclick="window.CC_TC.openAbilityPanel(${idx})"
                style="padding:5px 11px;background:rgba(255,255,255,.06);
                       border:1px solid rgba(255,255,255,.18);border-radius:4px;
                       font-size:.78rem;color:#ddd;cursor:pointer;
                       transition:border-color .15s,color .15s;"
                onmouseenter="this.style.borderColor='${color}';this.style.color='${color}'"
                onmouseleave="this.style.borderColor='rgba(255,255,255,.18)';this.style.color='#ddd'"
              >${s}</button>`
            ).join('')}
          </div>
        </div>` : '';

      // Store unit abilities so the panel handler can look them up by index
      window.CC_TC._currentUnitAbilities = Array.isArray(unit.special)
        ? unit.special : (unit.special ? [unit.special] : []);

      root.innerHTML = `
        <div class="cc-app-shell h-100" style="display:flex;flex-direction:column;">

          <div class="cc-app-header" style="padding:.75rem 1rem;">
            <div style="display:flex;align-items:center;gap:.75rem;">
              ${logoHtml(faction, 32)}
              <div>
                <div style="color:${color};font-size:.75rem;font-weight:700;
                             text-transform:uppercase;letter-spacing:.08em;">${faction.name}</div>
                <div style="color:#888;font-size:.7rem;">
                  Round ${state.round} · ${remaining} left
                </div>
              </div>
            </div>
            <div style="display:flex;align-items:center;gap:.5rem;">
              <div id="cc-timer" style="color:#888;font-size:.8rem;font-family:monospace;">
                00:00
              </div>
              <button onclick="window.CC_TC.toggleTimer()" class="cc-btn cc-btn-secondary"
                style="padding:.25rem .5rem;font-size:.7rem;">
                ${state.timerRunning ? '⏸' : '▶'}
              </button>
              <button onclick="window.CC_TC.saveGame()" class="cc-btn cc-btn-secondary"
                style="padding:.25rem .5rem;font-size:.7rem;" title="Save game"><i class="fa fa-save"></i></button>
            </div>
          </div>

          <div style="flex:1;overflow-y:auto;padding:1rem;max-width:600px;width:100%;
                      margin:0 auto;box-sizing:border-box;">

            <div style="margin-bottom:.75rem;">
              <h2 style="font-size:clamp(1.8rem,6vw,2.6rem);margin:0;color:#fff;line-height:1.1;">
                ${unit.name}
              </h2>
              ${unit.isTitan ? `<span style="color:#ffd600;font-size:.75rem;font-weight:700;
                text-transform:uppercase;letter-spacing:.1em;"><i class="fa fa-bolt"></i> Titan</span>` : ''}
            </div>

            <div style="margin-bottom:1rem;">
              ${qualityTrack(faction, unit)}
            </div>

            <div style="display:flex;flex-wrap:wrap;gap:.4rem;margin-bottom:.75rem;">
              ${statBadges}
            </div>

            ${specialHtml}
            ${directiveHtml}

            <div class="cc-panel" style="margin:1rem 0;">
              <div class="cc-panel-header">
                <h6 style="margin:0;color:#888;font-size:.7rem;text-transform:uppercase;
                           letter-spacing:.1em;"><i class="fa fa-assistive-listening-systems"></i> Log Noise</h6>
              </div>
              <div class="cc-panel-body" style="display:flex;flex-wrap:wrap;gap:.4rem;">
                ${Object.entries(NOISE_VALUES).map(([key, n]) => `
                  <button onclick="window.CC_TC.logNoise('${key}')"
                    class="cc-btn cc-btn-secondary"
                    style="font-size:.78rem;padding:.35rem .65rem;
                           ${n.value > 0 ? '' : 'opacity:.6;'}">
                    ${n.label}${n.value > 0 ? ` <span style="color:#ef5350;">+${n.value}</span>` : ''}
                  </button>`).join('')}
              </div>
              ${noiseBarHtml()}
              ${coughBarHtml()}
            </div>

          </div>

          <div style="padding:1rem;border-top:1px solid rgba(255,255,255,.08);
                      background:rgba(0,0,0,.3);display:flex;gap:.75rem;
                      max-width:600px;width:100%;margin:0 auto;box-sizing:border-box;">
            <button onclick="window.CC_TC.markOut()" class="cc-btn cc-btn-secondary"
              style="flex-shrink:0;opacity:.6;"
              title="Remove this unit from play">
              <i class="fa fa-times"></i> OUT
            </button>
            <button onclick="window.CC_TC.nextActivation()"
              class="cc-btn"
              style="flex:1;font-size:1.15rem;padding:1rem;
                     background:${color};color:#000;">
              DONE →
            </button>
          </div>

        </div>`;

      if (state.timerRunning) startTimerDisplay();
    }

    let _timerInterval = null;

    function startTimerDisplay() {
      clearInterval(_timerInterval);
      _timerInterval = setInterval(function() {
        if (_destroyed) { clearInterval(_timerInterval); return; }
        const el = document.getElementById('cc-timer');
        if (!el) { clearInterval(_timerInterval); return; }
        const elapsed = state.timerElapsed +
          (state.timerRunning ? Date.now() - state.timerStart : 0);
        const s = Math.floor(elapsed / 1000);
        const m = Math.floor(s / 60);
        el.textContent = String(m).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0');
      }, 500);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // RENDER: ROUND END SUMMARY
    // ═══════════════════════════════════════════════════════════════════════════

    function renderRoundEnd() {
      const canyonEvent = rollCanyonEvent();
      tickCoffeinCough();

      const unitRows = state.factions.flatMap(f =>
        f.allUnits.map(u => {
          const us = getUnitState(f.id, u.id);
          if (!us) return '';
          const qColor = us.out ? '#ef5350' : us.quality <= 1 ? '#ffd600' : '#4caf50';
          return `
            <tr>
              <td style="padding:.35rem .5rem;">
                <span style="color:${f.color};font-weight:700;font-size:.8rem;">${f.name}</span>
              </td>
              <td style="padding:.35rem .5rem;font-weight:600;">${u.name}</td>
              <td style="padding:.35rem .5rem;text-align:center;">
                <span style="color:${qColor};font-weight:700;">
                  ${us.out ? 'OUT' : 'Q' + us.quality}
                </span>
              </td>
            </tr>`;
        })
      ).join('');

      const logHtml = state.roundLog.length
        ? state.roundLog.map(l => `<li style="color:#aaa;font-size:.85rem;margin:.2rem 0;">${l}</li>`).join('')
        : '<li style="color:#555;font-size:.85rem;">Nothing eventful.</li>';

      root.innerHTML = `
        <div class="cc-app-shell h-100">
          <div class="cc-app-header">
            <div>
              <h1 class="cc-app-title">Round ${state.round} Complete</h1>
              <div class="cc-app-subtitle">End of Round Summary</div>
            </div>
          </div>
          <div style="max-width:600px;margin:0 auto;padding:1rem;overflow-y:auto;">

            ${canyonEvent ? `
              <div class="cc-panel" style="margin-bottom:1rem;border-color:${STAT_COLORS.quality}66;">
                <div class="cc-panel-header" style="background:${STAT_COLORS.quality}11;">
                  <h5 style="margin:0;color:var(--cc-primary);">
                    ${canyonEvent.icon} Canyon Event
                  </h5>
                </div>
                <div class="cc-panel-body">
                  <p style="margin:0;">${canyonEvent.text}</p>
                </div>
              </div>` : ''}

            <div class="cc-panel" style="margin-bottom:1rem;">
              <div class="cc-panel-body">
                ${noiseBarHtml()}
                ${coughBarHtml()}
              </div>
            </div>

            <div class="cc-panel" style="margin-bottom:1rem;">
              <div class="cc-panel-header">
                <h5 style="margin:0;"><i class="fa fa-list"></i> Round Log</h5>
              </div>
              <div class="cc-panel-body">
                <ul style="margin:0;padding-left:1rem;">${logHtml}</ul>
              </div>
            </div>

            <div class="cc-panel" style="margin-bottom:1.5rem;">
              <div class="cc-panel-header">
                <h5 style="margin:0;">Unit Status</h5>
              </div>
              <div class="cc-panel-body" style="padding:0;">
                <table style="width:100%;border-collapse:collapse;">
                  <thead>
                    <tr style="border-bottom:1px solid rgba(255,255,255,.08);">
                      <th style="padding:.35rem .5rem;text-align:left;color:#666;font-size:.75rem;">Faction</th>
                      <th style="padding:.35rem .5rem;text-align:left;color:#666;font-size:.75rem;">Unit</th>
                      <th style="padding:.35rem .5rem;text-align:center;color:#666;font-size:.75rem;">Status</th>
                    </tr>
                  </thead>
                  <tbody>${unitRows}</tbody>
                </table>
              </div>
            </div>

            <button onclick="window.CC_TC.beginNextRound()"
              class="cc-btn" style="width:100%;font-size:1.1rem;padding:1rem;">
              Begin Round ${state.round + 1} →
            </button>

          </div>
        </div>`;
    }

    // =========================================================================
    // RENDER: ROUND 0 — TERRAIN SETUP
    // =========================================================================

    function renderSetupRound() {
      var factions       = state.factions;
      var turnIdx        = state.setupTurnIndex % Math.max(factions.length, 1);
      var activeFaction  = factions[turnIdx] || factions[0];
      var color          = activeFaction ? activeFaction.color : '#888';
      var fname          = activeFaction ? activeFaction.name  : '?';
      var isNPC          = activeFaction && activeFaction.isNPC;

      // ── Build terrain list ──────────────────────────────────────────────────
      // Boardwalk is always present (it exists in every location).
      // Objectives come from the loaded scenario if available;
      // otherwise a generic marker is added.
      var terrainTypes = [
        { icon: 'fa-grip-lines',  label: 'Boardwalk',    note: 'Elevated walkway — present in every location', isObjective: false },
        { icon: 'fa-home',        label: 'Building',     note: 'Blocks LOS, can be entered',                   isObjective: false },
        { icon: 'fa-mountain',    label: 'Rocky Outcrop',note: 'Difficult terrain, partial cover',             isObjective: false },
        { icon: 'fa-tree',        label: 'Canyon Brush', note: 'Light cover, passable',                        isObjective: false },
        { icon: 'fa-campground',  label: 'Ruin / Debris',note: 'Narrative terrain',                            isObjective: false },
        { icon: 'fa-barricade',   label: 'Barricade',    note: 'Low cover, blocks movement',                   isObjective: false },
        { icon: 'fa-gem',         label: 'Thyr Crystal', note: 'Magical resource — mark it',                   isObjective: false },
      ];

      var scenarioObjectives = (state.scenarioSave && state.scenarioSave.objectives) || [];
      if (scenarioObjectives.length > 0) {
        scenarioObjectives.forEach(function(obj) {
          var objName = (typeof obj === 'string') ? obj : (obj.name || obj.id || 'Objective');
          var objNote = (obj.description || obj.type || 'Scenario objective') + ' — place as marker';
          terrainTypes.push({ icon: 'fa-map-marker', label: objName, note: objNote, isObjective: true });
        });
      } else {
        terrainTypes.push({ icon: 'fa-map-marker', label: 'Objective Marker', note: 'Scoring marker', isObjective: true });
      }

      window.CC_TC._terrainTypes = terrainTypes;

      var terrainButtons = terrainTypes.map(function(t, idx) {
        var accent = t.isObjective ? '#ffd600' : 'var(--cc-primary)';
        return '<button onclick="window.CC_TC.logTerrainPlace(' + idx + ')" ' +
          'class="cc-btn cc-btn-secondary" ' +
          'style="text-align:left;display:flex;align-items:center;gap:.6rem;padding:.5rem .75rem;">' +
          '<i class="fa ' + t.icon + '" style="flex-shrink:0;color:' + accent + ';width:1.2rem;text-align:center;"></i>' +
          '<span><strong>' + t.label + '</strong> ' +
          '<span style="color:#666;font-size:.78rem;">' + t.note + '</span></span>' +
          '</button>';
      }).join('');

      var logHtml = state.roundLog.length
        ? '<ul style="list-style:none;margin:0;padding:0;">' +
          state.roundLog.map(function(l) {
            return '<li style="color:#aaa;font-size:.82rem;padding:.25rem 0;border-bottom:1px solid rgba(255,255,255,.04);">' + l + '</li>';
          }).join('') + '</ul>'
        : '<p style="color:#555;font-size:.85rem;margin:0;">Nothing placed yet.</p>';

      // ── NPC auto-directive ─────────────────────────────────────────────────
      // Don't ask the player to roll — pick right now using weighted probability.
      var npcDirectiveHtml = '';
      if (isNPC) {
        var roll = Math.random();
        var picked;
        if (roll < 0.20) {
          picked = terrainTypes.find(function(t) { return t.label === 'Boardwalk'; });
        } else if (roll < 0.50) {
          var objPool = terrainTypes.filter(function(t) { return t.isObjective; });
          picked = objPool[Math.floor(Math.random() * objPool.length)];
        } else if (roll < 0.65) {
          picked = terrainTypes.find(function(t) { return t.label === 'Thyr Crystal'; });
        } else if (roll < 0.80) {
          picked = terrainTypes.find(function(t) { return t.label === 'Building'; });
        } else {
          var misc = terrainTypes.filter(function(t) {
            return !t.isObjective && ['Rocky Outcrop','Canyon Brush','Ruin / Debris','Barricade'].indexOf(t.label) !== -1;
          });
          picked = misc[Math.floor(Math.random() * misc.length)];
        }
        if (!picked) picked = terrainTypes[0];

        var pickedIdx = terrainTypes.indexOf(picked);
        npcDirectiveHtml =
          '<div style="background:' + color + '18;border:2px solid ' + color + ';border-radius:8px;padding:1rem;">' +
          '<div style="font-size:.7rem;color:' + color + ';text-transform:uppercase;letter-spacing:.1em;margin-bottom:.35rem;">' + fname + ' (NPC) — Terrain Directive</div>' +
          '<div style="font-size:1rem;font-weight:700;color:#fff;margin-bottom:.25rem;">' +
          '<i class="fa ' + picked.icon + '" style="color:' + color + ';margin-right:.5rem;"></i>Place: ' + picked.label + '</div>' +
          '<p style="color:#aaa;font-size:.85rem;margin:0 0 .7rem;">' + picked.note + '</p>' +
          '<button onclick="window.CC_TC.logTerrainPlace(' + pickedIdx + ')" class="cc-btn" style="background:' + color + ';color:#000;width:100%;">Log This Placement →</button>' +
          '</div>';
      }

      root.innerHTML =
        '<div class="cc-app-shell h-100">' +
        '<div class="cc-app-header">' +
        '<div style="display:flex;align-items:center;gap:.75rem;">' +
        logoHtml(activeFaction, 32) +
        '<div>' +
        '<div style="color:' + color + ';font-size:.75rem;font-weight:700;text-transform:uppercase;letter-spacing:.08em;">' + fname + '</div>' +
        '<div style="color:#888;font-size:.7rem;">Round 0 — Terrain Setup — Turn ' + (state.setupTurnIndex + 1) + '</div>' +
        '</div></div></div>' +

        '<div style="max-width:600px;margin:0 auto;padding:1rem;display:flex;flex-direction:column;gap:.75rem;">' +

        (isNPC ? npcDirectiveHtml :
          '<div style="background:' + color + '18;border:2px solid ' + color + ';border-radius:8px;padding:1rem;">' +
          '<div style="font-size:1.05rem;font-weight:700;color:' + color + ';margin-bottom:.3rem;">' + fname + '</div>' +
          '<p style="color:#aaa;font-size:.85rem;margin:0;">Place one terrain piece anywhere on the board, then tap what you placed below.</p>' +
          '</div>'
        ) +

        (!isNPC ?
          '<div class="cc-panel">' +
          '<div class="cc-panel-header"><h5 style="margin:0;color:var(--cc-primary);">What did you place?</h5></div>' +
          '<div class="cc-panel-body" style="display:flex;flex-direction:column;gap:.4rem;">' +
          terrainButtons +
          '</div></div>' +
          '<button onclick="window.CC_TC.skipTerrainTurn()" class="cc-btn cc-btn-secondary" style="width:100%;">Pass — no placement this turn</button>'
        : '') +

        '<div class="cc-panel">' +
        '<div class="cc-panel-header"><h5 style="margin:0;color:var(--cc-text);">Board So Far</h5></div>' +
        '<div class="cc-panel-body">' + logHtml + '</div>' +
        '</div>' +

        '<button onclick="window.CC_TC.beginRound1()" class="cc-btn" style="width:100%;padding:.85rem;font-size:1rem;">Terrain is Set — Begin Round 1 →</button>' +

        '</div></div>';
    }

    // =========================================================================
    // RENDER: FACTION SETUP
    // =========================================================================

    function renderFactionSetup() {
      if (state.loadingData) {
        root.innerHTML = '<div class="cc-app-shell h-100" style="display:flex;align-items:center;justify-content:center;flex-direction:column;gap:1rem;">' +
          '<div style="font-size:2rem;animation:cc-spin 1s linear infinite;"><i class="fa fa-cog"></i></div>' +
          '<p style="color:#888;">Loading faction saves...</p></div>';
        return;
      }

      // ── Left column: factions waiting for a roster assignment ───────────────
      var leftRows = state.pendingFactions.map(function(pf) {
        var meta       = FACTION_META[pf.id] || {};
        var color      = meta.color || '#888';
        var fname      = meta.name  || pf.id;
        var assignment = state.factionAssignments[pf.id];
        var isAssigned = !!assignment;
        var isSkipped  = !!pf.skipped;

        var borderStyle = isSkipped
          ? 'border:1px solid #333;opacity:.4;'
          : isAssigned
            ? 'border:1px solid ' + color + '33;opacity:.55;'
            : 'border:1px solid ' + color + '66;';

        return '<div style="' + borderStyle + 'border-radius:8px;padding:.7rem;background:rgba(0,0,0,.25);transition:opacity .2s;">' +
          // Faction name row
          '<div style="display:flex;align-items:center;gap:.6rem;margin-bottom:.5rem;">' +
          '<img src="' + LOGO_BASE + pf.id + '_logo.svg" alt="' + fname + '" ' +
          'style="width:28px;height:28px;object-fit:contain;filter:drop-shadow(0 0 3px ' + color + '88)' + (isSkipped ? ' grayscale(1)' : '') + ';flex-shrink:0;" ' +
          'onerror="this.onerror=null;this.outerHTML=\'<div style=\\\'width:28px;height:28px;border-radius:50%;background:' + color + '22;border:2px solid ' + color + ';display:flex;align-items:center;justify-content:center;font-weight:900;font-size:.75rem;color:' + color + ';flex-shrink:0;\\\'>' + fname[0] + '</div>\'">' +
          '<strong style="flex:1;color:' + (isSkipped ? '#555' : color) + ';font-size:.9rem;">' + fname +
          (isSkipped ? ' <span style="color:#555;font-size:.7rem;font-weight:400;">(skipped)</span>' : '') + '</strong>' +
          // NPC toggle — hidden when skipped
          (!isSkipped
            ? '<label style="display:flex;align-items:center;gap:.3rem;font-size:.75rem;color:#aaa;cursor:pointer;flex-shrink:0;">' +
              '<input type="checkbox" id="npc_toggle_' + pf.id + '"' + (pf.npc ? ' checked' : '') +
              ' onchange="window.CC_TC.toggleNPC(\'' + pf.id + '\')"> NPC</label>'
            : '') +
          '</div>' +
          // Browse / Change button — hidden when skipped
          (!isSkipped && state.factionSaveList.length > 0
            ? '<button onclick="window.CC_TC.openFactionSavePicker(\'' + pf.id + '\')" ' +
              'class="cc-btn cc-btn-secondary" style="width:100%;font-size:.75rem;padding:.3rem .5rem;margin-bottom:.4rem;">' +
              (isAssigned ? '<i class="fa fa-refresh"></i> Change Save' : '<i class="fa fa-folder-open"></i> Browse Saves') +
              '</button>'
            : (!isSkipped
                ? '<div style="font-size:.75rem;color:#555;text-align:center;padding:.25rem 0 .4rem;">No saves found — will use default</div>'
                : '')) +
          // Skip / Un-skip button
          '<button onclick="window.CC_TC.toggleSkip(\'' + pf.id + '\')" ' +
          'class="cc-btn ' + (isSkipped ? '' : 'cc-btn-secondary') + '" ' +
          'style="width:100%;font-size:.72rem;padding:.25rem .5rem;' +
          (isSkipped ? 'background:rgba(255,255,255,.08);color:#aaa;' : 'color:#ef5350;border-color:#ef535044;background:rgba(239,83,80,.06);') + '">' +
          (isSkipped ? '↩ Include This Faction' : '✕ Skip This Faction') +
          '</button>' +
          '</div>';
      }).join('');

      // ── Right column: confirmed assignments ─────────────────────────────────
      var rightRows = state.pendingFactions.filter(function(pf) { return !pf.skipped; }).map(function(pf) {
        var meta       = FACTION_META[pf.id] || {};
        var color      = meta.color || '#888';
        var fname      = meta.name  || pf.id;
        var assignment = state.factionAssignments[pf.id];

        if (assignment) {
          // Show the assigned save name
          var saveName = assignment.docName
            .replace(/_/g,' ').replace(/[0-9]{13}/,'').trim();
          // Find enriched data from preloaded list
          var saveDoc  = (state.factionSaveList || []).find(function(d) { return d.id === assignment.docId; });
          var pts      = saveDoc && saveDoc._totalPoints ? saveDoc._totalPoints + ' pts' : '';
          var unitCount = saveDoc && saveDoc._unitCount  ? saveDoc._unitCount + ' units' : '';

          return '<div style="border:2px solid ' + color + ';border-radius:8px;padding:.7rem;' +
            'background:' + color + '18;animation:cc-fade-in .25s ease;">' +
            '<div style="display:flex;align-items:center;gap:.5rem;margin-bottom:.35rem;">' +
            '<img src="' + LOGO_BASE + pf.id + '_logo.svg" alt="' + fname + '" ' +
            'style="width:22px;height:22px;object-fit:contain;flex-shrink:0;" ' +
            'onerror="this.onerror=null;this.outerHTML=\'<div style=\\\'width:22px;height:22px;border-radius:50%;background:' + color + '22;border:2px solid ' + color + ';display:flex;align-items:center;justify-content:center;font-weight:900;font-size:.65rem;color:' + color + ';flex-shrink:0;\\\'>' + fname[0] + '</div>\'">' +
            '<span style="color:' + color + ';font-size:.8rem;font-weight:700;flex:1;">' + fname + '</span>' +
            '<button onclick="window.CC_TC.clearFactionSave(\'' + pf.id + '\')" ' +
            'style="background:none;border:none;color:#ef5350;cursor:pointer;font-size:.8rem;padding:0;" ' +
            'title="Remove assignment">✕</button>' +
            '</div>' +
            '<div style="font-size:.78rem;color:#ccc;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + saveName + '</div>' +
            (pts || unitCount ? '<div style="font-size:.7rem;color:#888;margin-top:.2rem;">' + [pts, unitCount].filter(Boolean).join(' · ') + '</div>' : '') +
            '</div>';
        } else {
          // Empty slot — show a dim placeholder
          return '<div style="border:1px dashed rgba(255,255,255,.12);border-radius:8px;padding:.7rem;' +
            'display:flex;align-items:center;justify-content:center;min-height:72px;">' +
            '<span style="color:#444;font-size:.78rem;text-align:center;">' +
            '<i class="fa fa-arrow-left" style="margin-right:.4rem;"></i>' + fname + '<br>' +
            '<span style="font-size:.7rem;">using default roster</span>' +
            '</span>' +
            '</div>';
        }
      }).join('');

      var activeFactions = state.pendingFactions.filter(function(pf) { return !pf.skipped; });
      var allAssigned = activeFactions.every(function(pf) {
        return !!state.factionAssignments[pf.id];
      });

      root.innerHTML =
        '<div class="cc-app-shell h-100" style="display:flex;flex-direction:column;">' +
        '<div class="cc-app-header">' +
        '<div><h1 class="cc-app-title">Coffin Canyon</h1>' +
        '<div class="cc-app-subtitle">' + (state.scenarioName || 'Faction Setup') + '</div></div>' +
        '<button class="cc-btn cc-btn-secondary" onclick="window.CC_TC.backToSetup()">← Back</button>' +
        '</div>' +

        '<div style="flex:1;overflow-y:auto;padding:1rem;">' +

        // Scenario summary strip
        (state.scenarioSave
          ? '<div style="padding:.6rem 1rem;background:rgba(255,117,24,.08);border:1px solid rgba(255,117,24,.2);' +
            'border-radius:6px;font-size:.82rem;color:#aaa;margin-bottom:1rem;">' +
            (state.scenarioSave.narrative_hook || '') +
            ((state.scenarioSave.objectives || []).length
              ? ' <strong style="color:#ccc;">Objectives:</strong> ' +
                (state.scenarioSave.objectives || []).map(function(o){return o.name||String(o);}).join(' · ')
              : '') +
            '</div>'
          : '') +

        // ── Two-column layout ──────────────────────────────────────────────
        '<div style="display:grid;grid-template-columns:1fr 1fr;gap:1rem;align-items:start;">' +

        // Left panel — pick a save
        '<div class="cc-panel">' +
        '<div class="cc-panel-header" style="padding:.6rem .85rem;">' +
        '<h5 style="margin:0;color:var(--cc-primary);font-size:.78rem;text-transform:uppercase;letter-spacing:.08em;">' +
        '<i class="fa fa-folder-open"></i> Assign Rosters' +
        '</h5>' +
        '</div>' +
        '<div class="cc-panel-body" style="display:flex;flex-direction:column;gap:.5rem;padding:.75rem;">' +
        leftRows +
        '</div>' +
        '</div>' +

        // Right panel — confirmed selections
        '<div class="cc-panel">' +
        '<div class="cc-panel-header" style="padding:.6rem .85rem;">' +
        '<h5 style="margin:0;color:var(--cc-primary);font-size:.78rem;text-transform:uppercase;letter-spacing:.08em;">' +
        '<i class="fa fa-check-circle"></i> Confirmed' +
        '</h5>' +
        '</div>' +
        '<div class="cc-panel-body" style="display:flex;flex-direction:column;gap:.5rem;padding:.75rem;">' +
        rightRows +
        '</div>' +
        '</div>' +

        '</div>' + // end grid

        (state.factionSaveList.length === 0
          ? '<p style="font-size:.78rem;color:#444;text-align:center;margin:.75rem 0 0;">' +
            'No saved rosters found — all factions will use default game data.</p>'
          : '') +

        // Begin Game button
        '<div style="margin-top:1rem;">' +
        '<button class="cc-btn" style="width:100%;font-size:1rem;padding:.85rem;" ' +
        'onclick="window.CC_TC.startFromFactionSetup()">' +
        (allAssigned ? 'Begin Game →' : 'Begin Game with Defaults →') +
        '</button>' +
        '</div>' +

        '</div>' + // end scroll area
        '</div>';  // end app-shell
    }

    // ── Destroyed guard ────────────────────────────────────────────────────────
    // When the loader navigates away it calls appRoot.innerHTML = '' which
    // detaches `root` from the document but never tells the app.
    // Every render call checks this first so nothing tries to write to a dead node.
    var _destroyed = false;

    function isRootAlive() {
      return !_destroyed && root && document.body.contains(root);
    }

    // Full teardown — called either by the MutationObserver (automatic) or
    // by CC_APP.destroy (if the loader ever adds that call).
    function destroyApp() {
      if (_destroyed) return;
      _destroyed = true;

      // Kill the activation timer
      if (_timerInterval) { clearInterval(_timerInterval); _timerInterval = null; }

      // Kill any ability-load poll that might still be spinning
      if (window._ccAbilityPoll) { clearInterval(window._ccAbilityPoll); delete window._ccAbilityPoll; }

      // Remove any leftover overlays we injected into document.body
      ['cc-ability-overlay','cc-roll-overlay','cc-monster-alert',
       'cc-tc-scenario-panel','cc-tc-save-picker'].forEach(function(id) {
        var el = document.getElementById(id);
        if (el) el.remove();
      });

      // Null out the global so stale onclick="" handlers fail quietly
      // instead of running against dead state
      window.CC_TC = null;

      // Disconnect our own observer
      if (_rootObserver) { _rootObserver.disconnect(); _rootObserver = null; }

      console.log('[CC] Turn Counter destroyed — cleaned up globals and intervals');
    }

    // Watch for the loader wiping our root node
    var _rootObserver = null;
    if (window.MutationObserver && root && root.parentNode) {
      _rootObserver = new MutationObserver(function() {
        if (!document.body.contains(root)) destroyApp();
      });
      _rootObserver.observe(root.parentNode, { childList: true, subtree: false });
    }

    // Also expose destroy on CC_APP so a future loader version can call it directly
    window.CC_APP.destroy = destroyApp;

    function render() {
      // Bail immediately if the loader has navigated away
      if (!isRootAlive()) return;

      switch (state.phase) {
        case 'setup':         return renderSetup();
        case 'quick_setup':   return renderQuickSetup();
        case 'setup_round':   return renderSetupRound();
        case 'faction_setup': return renderFactionSetup();
        case 'round_banner': return renderRoundBanner();
        case 'activation':   return renderActivation();
        case 'round_end':    return renderRoundEnd();
        default:             return renderSetup();
      }
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // EVENT HANDLERS
    // ═══════════════════════════════════════════════════════════════════════════

    window.CC_TC.backToSetup = function() {
      state.phase = 'setup';
      render();
    };

    window.CC_TC.startQuickMode = function() {
      state.phase = 'quick_setup';
      render();
    };

    window.CC_TC.startFromQuickSetup = async function() {
      try {
        var checked = Array.from(document.querySelectorAll('input[name="faction"]:checked'));
        if (checked.length < 2) { alert('Please select at least 2 factions.'); return; }
        state.loadingData = true;
        state.factions = [];
        render();
        for (var i = 0; i < checked.length; i++) {
          var cb      = checked[i];
          var id      = cb.value;
          var meta    = FACTION_META[id];
          var sel     = document.querySelector('select[name="npc_' + id + '"]');
          var isNPC   = !sel || sel.value === 'npc';
          var fData   = await loadFactionData(id);
          var faction = fData
            ? buildFactionEntry(id, fData, isNPC, meta.isMonster)
            : buildQuickFaction(id, meta.name, 3, isNPC, meta.isMonster);
          initUnitStates(faction);
          state.factions.push(faction);
        }
        state.loadingData = false;
        window.CC_TC.beginGame();
      } catch (err) {
        state.loadingData = false;
        state.phase = 'setup';
        render();
        alert('Failed to start game: ' + safeErr(err));
      }
    };

    window.CC_TC.closeScenarioPanel = function() {
      var panel = document.getElementById('cc-tc-scenario-panel');
      if (panel) {
        panel.classList.remove('cc-slide-panel-open');
        setTimeout(function() { if (panel.parentNode) panel.parentNode.removeChild(panel); }, 300);
      }
    };

    window.CC_TC.openScenarioList = function() {
      if (!window.CC_STORAGE) { alert('Storage not available.'); return; }

      var existingPanel = document.getElementById('cc-tc-scenario-panel');
      if (existingPanel) existingPanel.parentNode.removeChild(existingPanel);

      var panel = document.createElement('div');
      panel.id = 'cc-tc-scenario-panel';
      panel.className = 'cc-slide-panel';
      panel.innerHTML =
        '<div class="cc-slide-panel-header">' +
        '<h2><i class="fa fa-map"></i> LOAD SCENARIO</h2>' +
        '<button onclick="window.CC_TC.closeScenarioPanel()" class="cc-panel-close-btn">' +
        '<i class="fa fa-times"></i></button>' +
        '</div>' +
        '<div class="cc-roster-list" id="cc-tc-scenario-list">' +
        '<div style="padding:1.5rem;color:#888;text-align:center;">' +
        '<i class="fa fa-spinner fa-spin"></i> Loading saves...</div>' +
        '</div>';
      document.body.appendChild(panel);
      setTimeout(function() { panel.classList.add('cc-slide-panel-open'); }, 10);

      window.CC_STORAGE.loadDocumentList(SCENARIO_FOLDER).then(function(docs) {
        var scenarios = (docs || []).filter(function(d) {
          return d.name && d.name.indexOf('SCN_') === 0;
        });
        var listEl = document.getElementById('cc-tc-scenario-list');
        if (!listEl) return;

        if (!scenarios.length) {
          listEl.innerHTML = '<div style="padding:1.5rem;color:#888;">' +
            '<p>No scenario saves found.</p>' +
            '<p style="font-size:.85rem;">Save a scenario in the Scenario Builder first, then come back.</p>' +
            '</div>';
          return;
        }

        listEl.innerHTML = scenarios.map(function(d) {
          var label = d.name.replace(/^SCN_/, '').replace(/_\d{13}$/, '').replace(/_/g, ' ').trim();
          var date  = d.write_date ? new Date(d.write_date).toLocaleDateString() : '';
          return '<div class="cc-saved-roster-item">' +
            '<div class="cc-saved-roster-name">' + label + '</div>' +
            (date ? '<div class="cc-saved-roster-meta">' + date + '</div>' : '') +
            '<div class="cc-saved-roster-actions">' +
            '<button onclick="window.CC_TC.loadScenario(' + d.id + ')" class="btn-outline-warning">' +
            '<i class="fa fa-folder-open"></i> LOAD</button>' +
            '</div>' +
            '</div>';
        }).join('');
      }).catch(function(err) {
        var listEl = document.getElementById('cc-tc-scenario-list');
        if (listEl) listEl.innerHTML = '<div style="padding:1.5rem;color:#f66;">Failed to load: ' + safeErr(err) + '</div>';
      });
    };

    window.CC_TC.loadScenario = async function(docId) {
      window.CC_TC.closeScenarioPanel();
      try {
        // Use safeLoadDocument — never throws, returns null on failure
        var doc     = await safeLoadDocument(docId);
        var payload = docToJson(doc);
        if (!payload) throw new Error('Scenario save is empty or unreadable. Try re-saving it in the Scenario Builder.');

        state.scenarioSave   = payload.scenario || payload;
        state.scenarioName   = payload.name || (payload.scenario && payload.scenario.name) || 'Scenario';
        state.noiseThreshold = 8 + ((payload.danger || (payload.scenario && payload.scenario.danger_rating) || 3) * 2);
        var mp = state.scenarioSave && state.scenarioSave.monster_pressure;
        state.monsterRoster  = (mp && mp.monsters) || [];

        var rawFactions = payload.factions || (payload.scenario && payload.scenario.factions) || [];
        state.pendingFactions = rawFactions.map(function(f) {
          return { id: f.id, npc: f.npc !== undefined ? f.npc : (f.isNPC !== undefined ? f.isNPC : true), skipped: false };
        }).filter(function(f) { return !!FACTION_META[f.id]; });

        if (!state.pendingFactions.length) {
          alert('No valid factions found in this scenario save.\nWas it saved from the Scenario Builder?');
          state.phase = 'setup'; render(); return;
        }

        state.factionAssignments = {};
        state.pendingFactions.forEach(function(f) { state.factionAssignments[f.id] = null; });

        // Pre-load faction save list — each doc loaded individually and safely
        state.loadingData = true; render();
        try {
          var allDocs = await window.CC_STORAGE.loadDocumentList(FACTION_SAVE_FOLDER)
            .catch(function() { return []; });

          var nonScenario = (allDocs || []).filter(function(d) {
            return d.name && d.name.indexOf('SCN_') !== 0;
          });

          // ── FIX: Load each doc with safeLoadDocument ──────────────────────
          // The old code used Promise.resolve().then(async function() { ... })
          // which could let SyntaxErrors escape into unhandled rejections.
          // safeLoadDocument() catches everything including SyntaxError from
          // JSON.parse inside CC_STORAGE, and always resolves with null on error.
          state.factionSaveList = await Promise.all(nonScenario.map(async function(d) {
            var parsed = await safeLoadDocument(d.id);
            if (parsed) {
              var data = docToJson(parsed);
              if (data) {
                d._factionId   = data.faction     || null;
                d._factionName = data.factionName || data.faction || null;
                d._armyName    = data.armyName    || data.name    || null;
                d._totalPoints = data.totalCost   || data.totalPoints || data.pts || null;
              }
            }
            return d;
          }));

        } catch (e) {
          state.factionSaveList = [];
          console.warn('Faction save list failed:', safeErr(e));
        }
        state.loadingData = false;
        state.phase = 'faction_setup';
        render();

      } catch (err) {
        alert('Failed to load scenario: ' + safeErr(err));
        state.loadingData = false; state.phase = 'setup'; render();
      }
    };

    window.CC_TC.openGameList = function() {
      alert('Resume coming soon — save/load is in the next build pass!');
    };

    // ── FACTION SETUP HANDLERS ────────────────────────────────────────────────

    window.CC_TC.toggleNPC = function(factionId) {
      var el = document.getElementById('npc_toggle_' + factionId);
      var pf = state.pendingFactions.find(function(f) { return f.id === factionId; });
      if (pf && el) pf.npc = el.checked;
    };

    window.CC_TC.toggleSkip = function(factionId) {
      var pf   = state.pendingFactions.find(function(f) { return f.id === factionId; });
      var meta = FACTION_META[factionId] || {};
      if (!pf) return;

      // Warn before skipping the monster faction — it powers noise/encounters
      if (!pf.skipped && meta.isMonster) {
        if (!confirm(
          (meta.name || factionId) + ' is the Monster faction.\n\n' +
          'Skipping them disables monster encounters and the noise system for this game.\n\n' +
          'Skip anyway?'
        )) return;
      }

      pf.skipped = !pf.skipped;

      // Enforce minimum: need at least 2 active factions
      var active = state.pendingFactions.filter(function(f) { return !f.skipped; });
      if (active.length < 2) {
        pf.skipped = false; // revert
        alert('You need at least 2 factions to play. Un-skip another faction first.');
        render();
        return;
      }

      render();
    };

    window.CC_TC.openFactionSavePicker = function(factionId) {
      var meta = FACTION_META[factionId] || {};
      var docs = (state.factionSaveList || []).filter(function(d) {
        if (!d._factionId) return true;
        return d._factionId === factionId;
      });
      if (!docs.length) {
        alert('No saved builds found for ' + (meta.name || factionId) + '.\n\nBuild and save a ' + (meta.name || factionId) + ' roster in the Faction Builder first.');
        return;
      }

      var items = docs.map(function(d) {
        var label = (d.name || String(d.id))
          .replace(/\.json$/i, '')
          .replace(/_\d{10,}/, '')
          .replace(/_/g, ' ')
          .trim();
        var pts     = d._totalPoints ? ' — ' + d._totalPoints + ' pts' : '';
        var faction = d._factionName ? ' (' + d._factionName + ')' : '';
        return '<button onclick="window.CC_TC.selectFactionSave(\'' + factionId + '\',' + d.id + ')" ' +
          'class="cc-btn cc-btn-secondary" ' +
          'style="width:100%;margin-bottom:.4rem;text-align:left;display:flex;justify-content:space-between;align-items:center;">' +
          '<span>' + label + faction + '</span>' +
          (pts ? '<span style="color:#888;font-size:.78rem;flex-shrink:0;">' + pts + '</span>' : '') +
          '</button>';
      }).join('');

      var overlay = document.createElement('div');
      overlay.id = 'cc-tc-save-picker';
      overlay.style.cssText = 'position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,.85);display:flex;align-items:center;justify-content:center;';
      overlay.innerHTML =
        '<div style="background:#1a1a1a;border:1px solid rgba(255,117,24,.4);border-radius:8px;padding:1.5rem;max-width:500px;width:90%;max-height:80vh;overflow-y:auto;">' +
        '<h5 style="margin:0 0 .25rem;color:var(--cc-primary);">Pick a Saved Build</h5>' +
        '<p style="font-size:.8rem;color:#888;margin:0 0 .75rem;">For: <strong style="color:#ccc;">' + (meta.name || factionId) + '</strong></p>' +
        items +
        '<button onclick="document.getElementById(\'cc-tc-save-picker\').remove()" ' +
        'class="cc-btn cc-btn-secondary" style="width:100%;margin-top:.5rem;">Cancel</button>' +
        '</div>';
      document.body.appendChild(overlay);
    };

    window.CC_TC.selectFactionSave = function(factionId, docId) {
      // Look up the doc name from state instead of injecting it through HTML onclick.
      // (Injecting d.name via JSON.stringify into a double-quoted HTML attribute
      // breaks if the name contains quotes — the onclick gets truncated mid-JS.)
      var doc = (state.factionSaveList || []).find(function(d) { return d.id === docId; });
      var docName = (doc && (doc.name || doc._armyName || doc._factionName))
        ? (doc.name || doc._armyName || doc._factionName)
        : String(docId);

      state.factionAssignments[factionId] = { docId: docId, docName: docName };
      var picker = document.getElementById('cc-tc-save-picker');
      if (picker) picker.remove();
      render();
    };

    window.CC_TC.clearFactionSave = function(factionId) {
      state.factionAssignments[factionId] = null;
      render();
    };

    // ── BEGIN GAME FROM FACTION SETUP ─────────────────────────────────────────
    //
    // FIX: This is the main place the crash was happening.
    // The old code had a try/catch, but CC_STORAGE.loadDocument could throw
    // a SyntaxError internally (from JSON.parse on bad data) that escaped.
    // Now we use safeLoadDocument() which catches ALL errors including SyntaxError
    // and returns null, letting buildFactionFromSave gracefully fall back to
    // loading default roster data from GitHub instead.

    window.CC_TC.startFromFactionSetup = async function() {
      state.loadingData = true;
      state.factions    = [];
      render();

      for (var i = 0; i < state.pendingFactions.length; i++) {
        var pf     = state.pendingFactions[i];
        if (pf.skipped) continue;   // ← skip factions the user excluded
        var meta   = FACTION_META[pf.id];
        var assign = state.factionAssignments[pf.id];
        var faction = null;

        if (assign && assign.docId) {
          // ── FIX: Use safeLoadDocument instead of raw CC_STORAGE.loadDocument ──
          // safeLoadDocument wraps the call in both .catch() AND try/catch,
          // so a SyntaxError from inside CC_STORAGE can never escape.
          console.log('📂 Loading faction save for ' + pf.id + ' (doc ' + assign.docId + ')');

          var saveDoc = await safeLoadDocument(assign.docId);

          if (saveDoc) {
            var saveParsed = docToJson(saveDoc);
            if (saveParsed) {
              console.log('✅ Parsed faction save for ' + pf.id + ', keys:', Object.keys(saveParsed).join(', '));
              faction = buildFactionFromSave(pf.id, saveParsed, pf.npc);
            } else {
              console.warn('⚠️ docToJson returned null for ' + pf.id + ' save — falling back to default');
            }
          } else {
            console.warn('⚠️ safeLoadDocument returned null for ' + pf.id + ' — falling back to default');
          }

          if (!faction) {
            // Save load failed or produced no usable data.
            // Clear the assignment and silently fall back to GitHub JSON.
            assign = null;
          }
        }

        if (!faction) {
          // Default: load from GitHub faction JSON
          console.log('📦 Loading default GitHub data for ' + pf.id);
          var fData = await loadFactionData(pf.id);
          faction = fData
            ? buildFactionEntry(pf.id, fData, pf.npc, meta.isMonster)
            : buildQuickFaction(pf.id, meta.name, 3, pf.npc, meta.isMonster);
        }

        initUnitStates(faction);
        state.factions.push(faction);
      }

      state.loadingData = false;
      window.CC_TC.beginGame();
    };

    // ── TERRAIN SETUP HANDLERS ────────────────────────────────────────────────

    window.CC_TC.logTerrainPlace = function(idx) {
      var t       = (window.CC_TC._terrainTypes || [])[idx];
      var label   = t ? t.label : 'Terrain';
      var factions = state.factions;
      var turnIdx  = state.setupTurnIndex % Math.max(factions.length, 1);
      var faction  = factions[turnIdx];
      var fname    = faction ? faction.name : 'Unknown';
      state.roundLog.push('[' + label + '] ' + fname + ' placed: ' + label);
      state.setupTurnIndex++;
      render();
    };

    window.CC_TC.skipTerrainTurn = function() {
      var factions = state.factions;
      var turnIdx  = state.setupTurnIndex % Math.max(factions.length, 1);
      var faction  = factions[turnIdx];
      var fname    = faction ? faction.name : 'Unknown';
      state.roundLog.push('— ' + fname + ' passed.');
      state.setupTurnIndex++;
      render();
    };

    window.CC_TC.beginGame = function() {
      state.round         = 0;
      state.unitState     = {};
      state.noiseLevel    = 0;
      state.roundLog      = [];
      state.allRoundLogs  = [];
      state.coughSeverity = 0;
      state.monstersTriggered = 0;
      state.setupTurnIndex    = 0;
      state.factions.forEach(function(f) { initUnitStates(f); });
      state.phase = 'setup_round';
      loadAbilityDictionaries();   // pre-fetch in background so ability taps are instant
      loadMonstersFactionData();   // pre-fetch monsters faction for encounter variety
      render();
    };

    window.CC_TC.beginRound1 = function() {
      state.round = 1;
      buildQueue();
      state.phase = 'round_banner';
      render();
    };

    window.CC_TC.startRound = function() {
      state.phase        = 'activation';
      state.timerElapsed = 0;
      state.timerRunning = true;
      state.timerStart   = Date.now();
      render();
    };

    window.CC_TC.nextActivation = function() {
      if (state.timerRunning) {
        state.timerElapsed += Date.now() - state.timerStart;
        state.timerRunning = false;
      }
      var hasMore = advanceQueue();
      if (!hasMore || isRoundComplete()) {
        endRound();
      } else {
        state.timerElapsed = 0;
        state.timerRunning = true;
        state.timerStart   = Date.now();
        render();
      }
    };

    window.CC_TC.markOut = function() {
      var item = currentQueueItem();
      if (!item) return;
      if (!confirm('Mark this unit as OUT?')) return;
      setUnitState(item.factionId, item.unitId, { out: true });
      var faction = getFactionById(item.factionId);
      var unit    = getUnitById(faction, item.unitId);
      state.roundLog.push('\u2716 ' + (faction ? faction.name : '') + ': ' + (unit ? unit.name : '') + ' is OUT.');
      window.CC_TC.nextActivation();
    };

    window.CC_TC.adjustQuality = function(factionId, unitId, delta) {
      var us   = getUnitState(factionId, unitId);
      var unit = getUnitById(getFactionById(factionId), unitId);
      if (!us || !unit) return;
      var newQ = Math.max(0, Math.min(unit.quality, (us.quality || 0) + delta));
      setUnitState(factionId, unitId, { quality: newQ });
      if (newQ === 0) {
        if (confirm(unit.name + ' is at Q0 \u2014 mark them OUT?')) {
          setUnitState(factionId, unitId, { out: true });
          var faction = getFactionById(factionId);
          state.roundLog.push('\u2716 ' + (faction ? faction.name : '') + ': ' + unit.name + ' is OUT (Q0).');
          window.CC_TC.nextActivation();
          return;
        }
      }
      render();
    };

    // ═══════════════════════════════════════════════════════════════════════════
    // ABILITY LOOKUP SYSTEM
    // ═══════════════════════════════════════════════════════════════════════════
    //
    // Ability names come from faction JSON as plain strings e.g. "Tough 2",
    // "Stealth", "Brutal 3". The actual rule text lives in the ability
    // dictionary JSON files. We lazy-fetch those files once and cache them.

    var _abilityCache    = {};     // slug → { name, id, timing, short, long }
    var _abilityFetched  = false;
    var _abilityFetching = false;

    var ABILITY_FILES = [
      '90_ability_dictionary_A.json',
      '91_ability_dictionary_B.json',
      '92_ability_dictionary_C.json',
      '93_ability_dictionary_D.json',
      '94_ability_dictionary_E.json',
      '95_ability_dictionary_F.json',
      '96_ability_dictionary_G.json',
      '97_ability_dictionary_H.json',
    ];
    var ABILITY_BASE = 'https://raw.githubusercontent.com/steamcrow/coffin/main/rules/src/';

    // Each file has the shape:
    //   { "_id": "R-ABIL-A", "title": "...", "abilities": { "aim": { "_id", "timing", "short", "long" } } }
    // We store every entry under its slug key (e.g. "aim", "audio_suppression").
    function ingestAbilityFile(data) {
      if (!data || typeof data.abilities !== 'object') return 0;
      var count = 0;
      Object.keys(data.abilities).forEach(function(slug) {
        var entry = data.abilities[slug];
        if (!entry || typeof entry !== 'object') return;
        _abilityCache[slug] = {
          name:   slugToName(slug),         // "audio_suppression" → "Audio Suppression"
          id:     entry._id    || '',
          timing: entry.timing || '',
          short:  entry.short  || '',
          long:   entry.long   || '',
        };
        count++;
      });
      return count;
    }

    // "audio_suppression" → "Audio Suppression"
    function slugToName(slug) {
      return slug.replace(/_/g, ' ').replace(/\b\w/g, function(c) { return c.toUpperCase(); });
    }

    // "once_per_activation" → "Once Per Activation"
    function formatTiming(timing) {
      if (!timing) return '';
      return timing.replace(/_/g, ' ').replace(/\b\w/g, function(c) { return c.toUpperCase(); });
    }

    function loadAbilityDictionaries() {
      if (_abilityFetched || _abilityFetching) return;
      _abilityFetching = true;

      var promises = ABILITY_FILES.map(function(filename) {
        return fetch(ABILITY_BASE + filename + '?t=' + Date.now())
          .then(function(r) { return r.ok ? r.text() : '{}'; })
          .then(function(text) {
            var data = safeParseJson(text);
            if (data) ingestAbilityFile(data);
          })
          .catch(function(e) {
            console.warn('[CC] Ability file failed:', filename, safeErr(e));
          });
      });

      Promise.all(promises).then(function() {
        _abilityFetched  = true;
        _abilityFetching = false;
        console.log('[CC] Abilities loaded — ' + Object.keys(_abilityCache).length + ' entries');
      });
    }

    // Look up an ability by its display name.
    // Handles:
    //   "Aim"              → slug "aim"
    //   "Audio Suppression"→ slug "audio_suppression"
    //   "Tough 2"          → slug "tough_2" → miss → strip number → "tough"
    //   "Fast"             → slug "fast"
    function lookupAbility(displayName) {
      if (!displayName) return null;
      var raw = String(displayName).trim();

      // Step 1 — convert display name to slug: spaces → underscores, lowercase
      var slug = raw.toLowerCase().replace(/\s+/g, '_');
      if (_abilityCache[slug]) return _abilityCache[slug];

      // Step 2 — strip trailing number ("tough_2" → "tough", "blast_3" → "blast")
      var base = slug.replace(/_\d+$/, '');
      if (_abilityCache[base]) return _abilityCache[base];

      // Step 3 — try without any underscores at all (handles edge-case compounding)
      var flat = slug.replace(/_/g, '');
      var keys = Object.keys(_abilityCache);
      for (var i = 0; i < keys.length; i++) {
        if (keys[i].replace(/_/g, '') === flat) return _abilityCache[keys[i]];
      }

      // Step 4 — first word only, as a last resort ("Consecrated Ground" → "consecrated")
      var firstWord = slug.split('_')[0];
      if (firstWord.length >= 4) {   // don't match on tiny words like "of", "the"
        for (var j = 0; j < keys.length; j++) {
          if (keys[j] === firstWord || keys[j].startsWith(firstWord + '_')) {
            return _abilityCache[keys[j]];
          }
        }
      }

      return null;
    }

    // ── Ability slide panel ───────────────────────────────────────────────────
    window.CC_TC.closeAbilityPanel = function() {
      var panel = document.getElementById('cc-tc-ability-panel');
      if (panel) {
        panel.classList.remove('cc-slide-panel-open');
        setTimeout(function() { if (panel.parentNode) panel.parentNode.removeChild(panel); }, 300);
      }
    };

    window.CC_TC.openAbilityPanel = function(idx) {
      if (_destroyed) return;
      var abilities   = window.CC_TC._currentUnitAbilities || [];
      var abilityName = abilities[idx];
      if (!abilityName) return;

      loadAbilityDictionaries();

      var existing = document.getElementById('cc-tc-ability-panel');
      if (existing) existing.parentNode.removeChild(existing);

      var panel = document.createElement('div');
      panel.id = 'cc-tc-ability-panel';
      panel.className = 'cc-slide-panel';

      // If still loading, show a spinner and reopen when ready
      if (_abilityFetching && !_abilityFetched) {
        panel.innerHTML =
          '<div class="cc-slide-panel-header">' +
          '<h2>' + abilityName.toUpperCase() + '</h2>' +
          '<button onclick="window.CC_TC.closeAbilityPanel()" class="cc-panel-close-btn"><i class="fa fa-times"></i></button>' +
          '</div>' +
          '<div style="padding:2rem;text-align:center;color:#888;">' +
          '<div style="font-size:2rem;animation:cc-spin 1s linear infinite;margin-bottom:.75rem;">⟳</div>' +
          'Loading ability dictionary…</div>';
        document.body.appendChild(panel);
        setTimeout(function() { panel.classList.add('cc-slide-panel-open'); }, 10);

        var _retries = 0;
        var _poll = setInterval(function() {
          _retries++;
          if (_abilityFetched || _retries > 26 || _destroyed) {
            clearInterval(_poll);
            window._ccAbilityPoll = null;
            var ov = document.getElementById('cc-tc-ability-panel');
            if (ov) { ov.classList.remove('cc-slide-panel-open'); setTimeout(function() { if (ov.parentNode) ov.parentNode.removeChild(ov); }, 300); }
            if (_abilityFetched && !_destroyed && window.CC_TC) window.CC_TC.openAbilityPanel(idx);
          }
        }, 300);
        window._ccAbilityPoll = _poll;
        return;
      }

      var entry      = lookupAbility(abilityName);
      var timingLabel = entry ? formatTiming(entry.timing) : '';
      var timingColor = {
        'Passive':              '#90a4ae',
        'Main Action':          '#42a5f5',
        'Once Per Activation':  '#ffd600',
        'Once Per Round':       '#ff9800',
        'Once Per Game':        '#ef5350',
        'Deployment':           '#9c27b0',
        'Reaction':             '#4caf50',
      }[timingLabel] || '#888';

      var bodyHtml;
      if (entry) {
        bodyHtml =
          (timingLabel
            ? '<div style="display:inline-block;margin-bottom:1.25rem;padding:3px 12px;' +
              'border-radius:999px;border:1px solid ' + timingColor + ';color:' + timingColor + ';' +
              'font-size:.75rem;text-transform:uppercase;letter-spacing:.1em;">' + timingLabel + '</div><br>'
            : '') +
          (entry.short
            ? '<p style="color:#aaa;font-size:.85rem;font-style:italic;margin:0 0 1rem;line-height:1.5;">' + entry.short + '</p>'
            : '') +
          (entry.long
            ? '<p style="color:#e8e8e8;font-size:.95rem;line-height:1.75;margin:0;">' + entry.long + '</p>'
            : '') +
          (entry.id
            ? '<div style="margin-top:1.25rem;font-size:.68rem;color:#444;font-family:monospace;">' + entry.id + '</div>'
            : '');
      } else {
        bodyHtml =
          '<p style="color:#888;font-size:.9rem;line-height:1.55;margin:0 0 .75rem;">' +
          'No rule entry found for <em style="color:#bbb;">' + abilityName + '</em>.</p>' +
          '<p style="color:#555;font-size:.82rem;line-height:1.5;margin:0;">' +
          'Open the Rules Explorer and search for <em>' + abilityName.split(' ')[0] + '</em>.' +
          '</p>';
      }

      panel.innerHTML =
        '<div class="cc-slide-panel-header">' +
        '<h2>' + abilityName.toUpperCase() + '</h2>' +
        '<button onclick="window.CC_TC.closeAbilityPanel()" class="cc-panel-close-btn"><i class="fa fa-times"></i></button>' +
        '</div>' +
        '<div style="padding:1.5rem;">' + bodyHtml + '</div>';

      document.body.appendChild(panel);
      setTimeout(function() { panel.classList.add('cc-slide-panel-open'); }, 10);
    };

    // Keep old name as alias
    window.CC_TC.showAbilityRule = window.CC_TC.openAbilityPanel;

    window.CC_TC.rollQualityForUnit = function(factionId, unitId) {
      var faction = getFactionById(factionId);
      var unit    = getUnitById(faction, unitId);
      var us      = getUnitState(factionId, unitId);
      if (!unit || !us || us.out) return;

      // If already rolled this activation, show the cached result instead of re-rolling.
      // A unit only gets one roll per activation — tap again to review, not re-roll.
      if (us.lastRoll) {
        showRollResult(us.lastRoll, unit.name, true);
        return;
      }

      var currentQ = us.quality || unit.quality;
      if (currentQ < 1) return;
      var result = rollQuality(currentQ);
      setUnitState(factionId, unitId, { lastRoll: result });
      showRollResult(result, unit.name, false);
    };

    window.CC_TC.logNoise = function(key) {
      var n = NOISE_VALUES[key];
      if (!n) return;
      addNoise(n.value, n.label);
      render();
    };

    window.CC_TC.toggleTimer = function() {
      if (state.timerRunning) {
        state.timerElapsed += Date.now() - state.timerStart;
        state.timerRunning = false;
      } else {
        state.timerStart   = Date.now();
        state.timerRunning = true;
        startTimerDisplay();
      }
      render();
    };

    window.CC_TC.saveGame = async function() {
      if (!window.CC_STORAGE) { alert('Storage not available.'); return; }
      var name = 'GAME_Round' + state.round + '_' + Date.now();
      try {
        await window.CC_STORAGE.saveDocument(name, JSON.stringify({
          version:           '1.0',
          scenarioName:      state.scenarioName,
          round:             state.round,
          unitState:         state.unitState,
          noiseLevel:        state.noiseLevel,
          coughSeverity:     state.coughSeverity,
          timerElapsed:      state.timerElapsed,
          roundLog:          state.roundLog,
          allRoundLogs:      state.allRoundLogs,
          monstersTriggered: state.monstersTriggered,
          timestamp:         new Date().toISOString()
        }), TURN_SAVE_FOLDER);
        var btn = document.querySelector('[onclick="window.CC_TC.saveGame()"]');
        if (btn) {
          var orig = btn.innerHTML;
          btn.innerHTML = '\u2705';
          setTimeout(function() { btn.innerHTML = orig; }, 1500);
        }
      } catch (err) {
        alert('Save failed: ' + safeErr(err));
      }
    };

    window.CC_TC.beginNextRound = function() {
      state.allRoundLogs.push({ round: state.round, log: state.roundLog.slice() });
      state.roundLog = [];
      state.round++;
      deployReserves();
      buildQueue();
      state.phase = 'round_banner';
      render();
    };

    // ═══════════════════════════════════════════════════════════════════════════
    // ROUND END
    // ═══════════════════════════════════════════════════════════════════════════

    function endRound() {
      clearInterval(_timerInterval);
      state.timerRunning = false;
      state.phase = 'round_end';
      render();
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // INLINE KEYFRAME STYLES
    // ═══════════════════════════════════════════════════════════════════════════

    if (!document.getElementById('cc-tc-keyframes')) {
      const s = document.createElement('style');
      s.id = 'cc-tc-keyframes';
      s.textContent = `
        @keyframes cc-spin  { 0%{transform:rotate(0deg)} 100%{transform:rotate(360deg)} }
        @keyframes cc-pulse { 0%,100%{opacity:.6} 50%{opacity:1} }
        @keyframes cc-fade-in { from{opacity:0} to{opacity:1} }
        .cc-q-dot { transition: background .15s ease, transform .1s ease; }
        .cc-q-dot:active { transform: scale(.85); }
        .cc-stat-badge { transition: background .2s ease; }
      `;
      document.head.appendChild(s);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // BOOT — go straight to setup, no second splash screen.
    // (The loader already shows the Coffin Canyon logo while loading this file.)
    // ═══════════════════════════════════════════════════════════════════════════

    state.phase = 'setup';
    render();

  } // end init()
}; // end window.CC_APP
