// ── cc_app_game_simulator.js ─────────────────────────────────────────────────
// Coffin Canyon · Game Simulator
// Based on cc_app_turn_counter.js — same Odoo pipeline, adds live map + sprites
// ─────────────────────────────────────────────────────────────────────────────

console.log("🎮 Game Simulator loaded");

// ── JSON.parse safety patch ───────────────────────────────────────────────────
(function installCCJsonPatch() {
  if (window._ccJsonPatchInstalled) return;
  window._ccJsonPatchInstalled = true;
  var _native = JSON.parse.bind(JSON);
  JSON.parse = function ccSafeJSONParse(text, reviver) {
    if (text === null || text === undefined) return null;
    if (typeof text === 'string' && text.trim() === '') return null;
    try { return reviver ? _native(text, reviver) : _native(text); } catch (_) { return null; }
  };
  console.log('🛡️ JSON.parse patch installed');
}());

// ── Bootstrap Dropdown autoClose:null patch ───────────────────────────────────
(function patchBootstrapDropdownAutoClose() {
  if (window._ccDropdownPatchInstalled) return;
  window._ccDropdownPatchInstalled = true;

  // Fix data attribute on individual elements
  function fixEl(el) {
    if (!el || !el.getAttribute) return;
    var v = el.getAttribute('data-bs-auto-close');
    if (v === 'null' || v === null || v === '') el.setAttribute('data-bs-auto-close', 'true');
  }

  // Patch Bootstrap prototype to coerce null -> true before type checking
  function patchPrototype() {
    var BS = window.bootstrap;
    if (!BS || !BS.Dropdown || !BS.Dropdown.prototype) return false;
    var proto = BS.Dropdown.prototype;
    if (proto._ccAutoClosePatch) return true;
    proto._ccAutoClosePatch = true;

    // Patch _getConfig to sanitise autoClose before it reaches _typeCheckConfig
    var origGetConfig = proto._getConfig;
    proto._getConfig = function(config) {
      if (this._element) fixEl(this._element);
      if (config && config.autoClose == null) config.autoClose = true;
      return origGetConfig.call(this, config);
    };

    // Also patch _typeCheckConfig directly as a last-resort safety net
    if (proto._typeCheckConfig) {
      var origTypeCheck = proto._typeCheckConfig;
      proto._typeCheckConfig = function(config) {
        if (config && config.autoClose == null) config.autoClose = true;
        try { return origTypeCheck.call(this, config); }
        catch (e) {
          if (e && e.message && e.message.indexOf('autoClose') !== -1) return; // swallow
          throw e;
        }
      };
    }
    return true;
  }

  document.querySelectorAll('[data-bs-auto-close]').forEach(fixEl);
  if (!patchPrototype()) {
    var _attempts = 0;
    var _retry = setInterval(function() {
      _attempts++;
      document.querySelectorAll('[data-bs-auto-close]').forEach(fixEl);
      if (patchPrototype() || _attempts > 30) clearInterval(_retry);
    }, 200);
  }
  if (window.MutationObserver) {
    new MutationObserver(function(mutations) {
      mutations.forEach(function(m) {
        m.addedNodes.forEach(function(node) {
          if (node.nodeType !== 1) return;
          fixEl(node);
          if (node.querySelectorAll) node.querySelectorAll('[data-bs-auto-close]').forEach(fixEl);
        });
      });
      patchPrototype();
    }).observe(document.documentElement, { childList: true, subtree: true });
  }
  setInterval(function() {
    document.querySelectorAll('[data-bs-auto-close]').forEach(fixEl);
    var BS = window.bootstrap;
    if (BS && BS.Dropdown && BS.Dropdown.prototype && !BS.Dropdown.prototype._ccAutoClosePatch) patchPrototype();
  }, 30000);
}());

// ── Unhandled rejection guard ─────────────────────────────────────────────────
(function installCCRejectionGuard() {
  if (window._ccRejectionGuardInstalled) return;
  window._ccRejectionGuardInstalled = true;
  window.addEventListener('unhandledrejection', function(event) {
    var reason = event.reason;
    if (reason instanceof Error && reason.message && reason.message.indexOf('DROPDOWN') !== -1) {
      event.preventDefault(); return;
    }
    if (reason instanceof Error && typeof reason.stack === 'string' &&
        reason.stack.indexOf('assets_frontend_lazy') !== -1 && reason.stack.indexOf('cc_app_') === -1) {
      event.preventDefault();
      console.warn('[CC] Swallowed Odoo-internal error:', reason.message); return;
    }
    if (reason instanceof Error && typeof reason.stack === 'string' && reason.stack.length > 0) return;
    event.preventDefault();
    console.warn('[CC] Caught rejection:', reason);
  }, { capture: true });
  console.log('🛡️ Rejection guard installed');
}());

// ═════════════════════════════════════════════════════════════════════════════
(function () {
  'use strict';
  var _destroyed = false;

  function mount(rootEl, ctx) {
    var root = rootEl;
    console.log("🎮 Game Simulator init", ctx);
    window.CC_SIM = {};

    // ── CSS ─────────────────────────────────────────────────────────────────
    if (!document.getElementById('cc-core-ui-styles')) {
      fetch('https://raw.githubusercontent.com/steamcrow/coffin/main/ui/cc_ui.css?t=' + Date.now())
        .then(r => r.text()).then(css => {
          const s = document.createElement('style');
          s.id = 'cc-core-ui-styles'; s.textContent = css; document.head.appendChild(s);
        }).catch(err => console.error('❌ Core CSS failed:', err));
    }
    if (!document.getElementById('cc-sim-styles')) {
      fetch('https://raw.githubusercontent.com/steamcrow/coffin/main/apps/app_game_simulator/cc_app_game_simulator.css?t=' + Date.now())
        .then(r => r.text()).then(css => {
          const s = document.createElement('style');
          s.id = 'cc-sim-styles'; s.textContent = css; document.head.appendChild(s);
        }).catch(err => console.error('❌ Simulator CSS failed:', err));
    }

    // ── Load CC_STORAGE ──────────────────────────────────────────────────────
    if (!window.CC_STORAGE) {
      fetch('https://raw.githubusercontent.com/steamcrow/coffin/main/apps/storage_helpers.js?t=' + Date.now())
        .then(r => r.text())
        .then(code => new Promise(function(resolve) {
          const s = document.createElement('script');
          s.textContent = code; document.head.appendChild(s);
          setTimeout(resolve, 50);
        }))
        .then(function() { if (state.phase === 'setup') render(); })
        .catch(err => console.error('❌ Storage helpers failed:', err));
    }

    // ═════════════════════════════════════════════════════════════════════════
    // CONSTANTS
    // ═════════════════════════════════════════════════════════════════════════

    const RAW_BASE           = 'https://raw.githubusercontent.com/steamcrow/coffin/main/';
    const TERRAIN_CATALOG_URL = RAW_BASE + 'data/src/terrain_catalog.json';
    const TABLETOP_SVG_URL    = RAW_BASE + 'assets/textures/isometric_tile_48x48.svg';

    // Grid: each cell = 48px = 1 inch. Movement stats are in inches.
    const GRID_PX   = 48;   // pixels per inch
    const MAP_INCHES = 4096 / GRID_PX;  // ~85 inches across
    const TERRAIN_BASE       = RAW_BASE + 'assets/terrain/';
    const SPRITE_SHEET_URL   = RAW_BASE + 'assets/characters/all_no_trim.png';
    const SPRITE_JSON_URL    = RAW_BASE + 'assets/characters/all_no_trim.json';
    const LOGO_BASE          = RAW_BASE + 'assets/logos/';
    const FACTION_LOADER_BASE= RAW_BASE + 'data/factions/';
    const SCENARIO_FOLDER    = 90;
    const FACTION_SAVE_FOLDER= 90;

    // 1 game inch = this many map pixels (map is 4096px, table is ~48" wide)
    const ENGAGEMENT_PX      = GRID_PX * 2;  // 2" engagement range
    const SPRITE_SRC_SIZE    = 20;   // sprite sheet frame size (px)
    const SPRITE_DRAW_SIZE   = GRID_PX * 3.2; // drawn size: 3.2 grid squares
    const MAP_SIZE           = 4096;

    const FACTION_META = {
      monster_rangers: { name: 'Monster Rangers', color: '#4caf50', isMonster: false, file: 'faction-monster-rangers-v5.json' },
      liberty_corps:   { name: 'Liberty Corps',   color: '#ef5350', isMonster: false, file: 'faction-liberty-corps-v2.json'  },
      monsterology:    { name: 'Monsterology',     color: '#9c27b0', isMonster: false, file: 'faction-monsterology-v2.json'   },
      monsters:        { name: 'Monsters',         color: '#ff7518', isMonster: true,  file: 'faction-monsters-v2.json'       },
      shine_riders:    { name: 'Shine Riders',     color: '#ffd600', isMonster: false, file: 'faction-shine-riders-v2.json'   },
      crow_queen:      { name: 'Crow Queen',       color: '#00bcd4', isMonster: false, file: 'faction-crow-queen.json'        }
    };

    // Which sprite animation to use per faction
    const FACTION_SPRITE = {
      monster_rangers: { idle: 'basic_bow_idle',   run: 'basic_bow_run',   attack: 'basic_bow_attack'   },
      liberty_corps:   { idle: 'guard_idle',        run: 'guard_run',       attack: 'guard_attack'        },
      monsterology:    { idle: 'wizard_idle',        run: 'wizard_run',      attack: 'wizard_attack'       },
      monsters:        { idle: 'lizard_idle',        run: 'lizard_run',      attack: 'lizard_attack'       },
      shine_riders:    { idle: 'knight_yellow_idle', run: 'knight_yellow_run', attack: 'knight_yellow_attack' },
      crow_queen:      { idle: 'monk_idle',          run: 'monk_run',        attack: 'monk_attack'         },
      encounters:      { idle: 'troll_idle',         run: 'troll_run',       attack: 'troll_attack'        },
    };

    // Diamond edge lines for deployment — units line up along these in MAP coords
    // Each edge connects two diamond corners, with a small inset from each corner
    const _DT = { x: 2048, y: 3051 };  // top
    const _DR = { x: 4014, y: 2068 };  // right
    const _DB = { x: 2048, y: 1085 };  // bottom
    const _DL = { x: 82,   y: 2068 };  // left
    function _edgeInset(a, b, t) { return { x: a.x + (b.x-a.x)*t, y: a.y + (b.y-a.y)*t }; }
    const I = 0.05; // inset fraction from corner
    // Each of the 4 diamond edges is divided into 2 halves = 8 unique deployment lines
    // NW edge (left->top): bottom-half = 'west', top-half = 'north_west'
    // NE edge (top->right): top-half = 'north', bottom-half = 'north_east'
    // SE edge (right->bottom): top-half = 'east', bottom-half = 'south_east'
    // SW edge (bottom->left): bottom-half = 'south', top-half = 'south_west'
    const ZONE_EDGE_LINES = {
      'west':       { x1: _edgeInset(_DL,_DT,I).x,    y1: _edgeInset(_DL,_DT,I).y,    x2: _edgeInset(_DL,_DT,0.48).x, y2: _edgeInset(_DL,_DT,0.48).y }, // NW lower
      'north_west': { x1: _edgeInset(_DL,_DT,0.52).x, y1: _edgeInset(_DL,_DT,0.52).y, x2: _edgeInset(_DL,_DT,1-I).x,  y2: _edgeInset(_DL,_DT,1-I).y  }, // NW upper
      'north':      { x1: _edgeInset(_DT,_DR,I).x,    y1: _edgeInset(_DT,_DR,I).y,    x2: _edgeInset(_DT,_DR,0.48).x, y2: _edgeInset(_DT,_DR,0.48).y }, // NE upper
      'north_east': { x1: _edgeInset(_DT,_DR,0.52).x, y1: _edgeInset(_DT,_DR,0.52).y, x2: _edgeInset(_DT,_DR,1-I).x,  y2: _edgeInset(_DT,_DR,1-I).y  }, // NE lower
      'east':       { x1: _edgeInset(_DR,_DB,I).x,    y1: _edgeInset(_DR,_DB,I).y,    x2: _edgeInset(_DR,_DB,0.48).x, y2: _edgeInset(_DR,_DB,0.48).y }, // SE upper
      'south_east': { x1: _edgeInset(_DR,_DB,0.52).x, y1: _edgeInset(_DR,_DB,0.52).y, x2: _edgeInset(_DR,_DB,1-I).x,  y2: _edgeInset(_DR,_DB,1-I).y  }, // SE lower
      'south_west': { x1: _edgeInset(_DB,_DL,I).x,    y1: _edgeInset(_DB,_DL,I).y,    x2: _edgeInset(_DB,_DL,0.48).x, y2: _edgeInset(_DB,_DL,0.48).y }, // SW lower
      'south':      { x1: _edgeInset(_DB,_DL,0.52).x, y1: _edgeInset(_DB,_DL,0.52).y, x2: _edgeInset(_DB,_DL,1-I).x,  y2: _edgeInset(_DB,_DL,1-I).y  }, // SW upper
      'center':     null,
    };

    // Deployment zones in MAP coords (Leaflet CRS.Simple: y=0 at bottom)
    // Diamond: top(2048,3051) right(4014,2068) bottom(2048,1085) left(82,2068)
    const ZONE_DEFS = [
      { key: 'north',      xMin: 1400, xMax: 2700, yMin: 2700, yMax: 3000 },
      { key: 'south',      xMin: 1400, xMax: 2700, yMin: 1100, yMax: 1400 },
      { key: 'west',       xMin: 150,  xMax: 500,  yMin: 1700, yMax: 2400 },
      { key: 'east',       xMin: 3600, xMax: 3950, yMin: 1700, yMax: 2400 },
      { key: 'north_west', xMin: 500,  xMax: 1300, yMin: 2400, yMax: 3000 },
      { key: 'north_east', xMin: 2800, xMax: 3600, yMin: 2400, yMax: 3000 },
      { key: 'south_west', xMin: 500,  xMax: 1300, yMin: 1100, yMax: 1700 },
      { key: 'south_east', xMin: 2800, xMax: 3600, yMin: 1100, yMax: 1700 },
    ];
    const MONSTER_ZONE = { key: 'center', xMin: 1800, xMax: 2300, yMin: 1800, yMax: 2300 };
    const NOISE_VALUES = {
      shot: 2, melee: 3, explosion: 3, ritual: 4, ability: 2, silent: 0
    };

    const CANYON_EVENTS = [
      { id: 'dust_devil',   icon: 'fa-wind',       text: 'Dust devil! Ranged attacks −1 die until next round.' },
      { id: 'thyr_flare',   icon: 'fa-gem',        text: 'Thyr crystals flare. Units within 3" of a cache test Quality or Shaken.' },
      { id: 'canyon_echo',  icon: 'fa-volume-up',  text: 'Sounds carry far. +2 to current noise.' },
      { id: 'sickness',     icon: 'fa-skull',      text: 'Coffin Cough drifts in. Each faction: 1-2 = one unit tests Quality.' },
      { id: 'silence',      icon: 'fa-moon',       text: 'Unnatural silence. Monsters stir — +3 noise.' },
      { id: 'scavengers',   icon: 'fa-crow',       text: 'Scavengers at nearest objective. It becomes Contested.' },
      { id: 'nightfall',    icon: 'fa-moon',       text: 'Early dark. Ranged reduced 3" until end of next round.' },
      { id: 'tremor',       icon: 'fa-bolt',       text: 'Ground shudders. All Unstable terrain escalates one step.' },
      { id: 'canyon_luck',  icon: 'fa-leaf',       text: 'Canyon luck. One random unit removes a Shaken condition.' },
      { id: 'thyr_pulse',   icon: 'fa-sun',        text: 'Thyr pulse. All ritual actions +1 noise this round.' },
    ];

    const MAP_LIST = [
      { id: 'quinine-jimmy', name: 'Quinine Jimmy' },
    ];

    const FALLBACK_MONSTERS = [
      { id: 'ruster',         name: 'Ruster',         quality: 4, move: 6, defense: null, range: null, special: ['Corrode'],        isTitan: false },
      { id: 'snarl',          name: 'Snarl',          quality: 4, move: 8, defense: null, range: null, special: ['Berserk'],         isTitan: false },
      { id: 'canyon_crawler', name: 'Canyon Crawler', quality: 3, move: 5, defense: 2,    range: null, special: ['Armored'],         isTitan: false },
      { id: 'dust_wraith',    name: 'Dust Wraith',    quality: 4, move: 7, defense: null, range: 3,    special: ['Ambush', 'Fast'],  isTitan: false },
      { id: 'thyr_hound',     name: 'Thyr Hound',     quality: 4, move: 7, defense: null, range: null, special: ['Brutal Blow'],     isTitan: false },
      { id: 'canyon_titan',   name: 'Canyon Titan',   quality: 3, move: 4, defense: 4,    range: null, special: ['Anchor'],          isTitan: true  },
    ];

    // ═════════════════════════════════════════════════════════════════════════
    // STATE
    // ═════════════════════════════════════════════════════════════════════════

    // Core game state (mirrors turn counter)
    const state = {
      phase: 'setup',          // 'setup' | 'loading' | 'playing' | 'done'
      scenarioSave: null,
      scenarioName: '',
      factions: [],
      unitState: {},           // unitKey -> { quality, out, activated, lastRoll }
      round: 1,
      queue: [],
      queueIndex: 0,
      noiseLevel: 0,
      noiseThreshold: 12,
      monsterRoster: [],
      monstersTriggered: 0,
      coughSeverity: 0,
      roundLog: [],
      allRoundLogs: [],
      lastEventRound: 0,
      loadingData: false,
      loadingMsg: 'Loading…',
      setupMode: null,
      availableScenarios: [],
      selectedScenarioId: null,
    };

    // Simulator-specific state
    const sim = {
      mapData: null,            // loaded map JSON
      spriteSheet: null,        // HTMLImageElement
      spriteData: null,         // sprite atlas JSON
      terrainCatalog: {},        // terrain_type_id -> asset_file
      terrainCatalogFull: {},    // terrain_type_id -> full catalog entry (for footprint)
      terrainImages: {},         // terrain_type_id -> HTMLImageElement
      tabletopImg: null,         // loaded SVG background image
      // Solo mode
      soloFactionId: null,       // which faction the player controls
      soloWaiting: false,        // waiting for player drag input
      soloMovedThisTurn: false,  // prevent multiple moves per activation
      dragUnit: null,            // unitKey being dragged
      dragStartX: 0,
      dragStartY: 0,
      rulerActive: false,
      rulerDist: 0,
      rulerMax: 0,
      // Camera smooth follow
      camTargetX: null,
      camTargetY: null,
      terrainLoadQueue: 0,      // how many terrain images are still loading
      unitPositions: {},        // unitKey -> { x, y, targetX, targetY, animName, frameIdx, frameTimer, status }
      deathMarkers: [],          // [{ x, y, name }] skull positions
      factionZones: {},         // factionId -> ZONE_DEF
      monsterQueue: [],         // monsters waiting to enter the map
      canvas: null,
      ctx: null,
      viewX: 0,
      viewY: 0,
      viewScale: 0.14,          // initial zoom: fits 4096 map into ~573px
      isDragging: false,
      dragLast: null,
      animFrameId: null,
      hoveredUnit: null,        // unitKey of hovered unit
      selectedUnit: null,       // unitKey of selected unit
      simSpeed: 400,            // ms per auto-sim step
      autoRunning: false,
      autoTimer: null,
    };

    // ─────────────────────────────────────────────────────────────────────────
    // HELPERS (same as turn counter)
    // ─────────────────────────────────────────────────────────────────────────

    function unitKey(factionId, unitId) { return `${factionId}::${unitId}`; }
    function safeErr(e) {
      if (!e) return 'Unknown error';
      if (typeof e === 'string') return e;
      if (e.message) return e.message;
      try { return JSON.stringify(e); } catch (_) { return String(e); }
    }
    function safeParseJson(str) {
      if (str === null || str === undefined) return null;
      if (typeof str !== 'string') return typeof str === 'object' ? str : null;
      if (str.trim() === '') return null;
      try { return JSON.parse(str); } catch (_) { return null; }
    }
    function docToJson(doc) {
      if (!doc) return null;
      if (typeof doc === 'string') return safeParseJson(doc);
      if (typeof doc === 'object') {
        const hasJson  = doc.json  != null;
        const hasDatas = doc.datas != null;
        if (!hasJson && !hasDatas) return Object.keys(doc).length > 0 ? doc : null;
        if (hasJson) { const p = safeParseJson(String(doc.json).trim()); if (p !== null) return p; }
        if (hasDatas) {
          try {
            const r = safeParseJson(decodeURIComponent(escape(atob(String(doc.datas)))));
            if (r !== null) return r;
          } catch (_) {}
        }
      }
      return null;
    }
    async function safeLoadDocument(docId) {
      if (!window.CC_STORAGE) return null;
      try {
        return await Promise.resolve(window.CC_STORAGE.loadDocument(docId))
          .catch(e => { console.warn(`⚠️ loadDocument(${docId}):`, safeErr(e)); return null; }) || null;
      } catch (e) { console.warn(`⚠️ loadDocument(${docId}) threw:`, safeErr(e)); return null; }
    }
    function getFactionById(id)        { return state.factions.find(f => f.id === id) || null; }
    function getUnitById(faction, uid) { return faction?.allUnits.find(u => u.id === uid) || null; }
    function getUnitState(fid, uid)    { return state.unitState[unitKey(fid, uid)]; }
    function setUnitState(fid, uid, p) {
      const k = unitKey(fid, uid);
      state.unitState[k] = Object.assign({}, state.unitState[k], p);
    }
    function getActiveUnits(faction) {
      return faction.allUnits.filter(u => {
        const us = getUnitState(faction.id, u.id);
        return us && !us.out;
      });
    }
    function currentQueueItem() { return state.queue[state.queueIndex] || null; }
    function isRoundComplete()  { return state.queueIndex >= state.queue.length; }

    function simLog(msg, type) {
      state.roundLog.push({ msg, type: type || 'info', ts: Date.now() });
      const cls = type ? 'log-' + type : '';
      const logEl = document.getElementById('cc-sim-log');
      if (logEl) {
        logEl.insertAdjacentHTML('afterbegin',
          '<div class="cc-sim-log-entry ' + cls + '">' + msg + '</div>');
      }
      // Update ticker with latest message
      const ticker = document.getElementById('cc-sim-log-latest');
      if (ticker) {
        ticker.textContent = msg;
        ticker.className = 'cc-sim-log-bar-latest ' + cls;
      }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // DATA LOADING — Factions (mirrors turn counter)
    // ─────────────────────────────────────────────────────────────────────────

    async function loadFactionData(factionId) {
      const meta = FACTION_META[factionId];
      if (!meta) return null;
      try {
        const res  = await fetch(FACTION_LOADER_BASE + meta.file + '?t=' + Date.now());
        if (!res.ok) throw new Error('HTTP ' + res.status);
        const text = await res.text();
        return safeParseJson(text);
      } catch (err) { console.warn(`⚠️ Could not load ${factionId}:`, safeErr(err)); return null; }
    }

    function buildFactionFromSave(factionId, saveData, isNPC) {
      const meta = FACTION_META[factionId] || {};
      if (!saveData || typeof saveData !== 'object') return null;
      const roster = saveData.roster || saveData.units || saveData.army || saveData.list || null;
      if (!Array.isArray(roster) || !roster.length) return null;

      const allUnits = roster.map((item, i) => {
        if (!item || typeof item !== 'object') return null;
        let _q = item.quality || 4, _d = item.defense || item.armor || null;
        let _m = item.move    || 6, _r = item.range   || item.shoot || null;
        const _cfg    = item.config || {};
        const _bought = _cfg.optionalUpgrades?.length ? _cfg.optionalUpgrades : (item.upgrades || []);
        _bought.forEach(upg => {
          if (!upg?.stat_modifiers) return;
          const sm = upg.stat_modifiers;
          if (sm.quality) _q += sm.quality;
          if (sm.defense) _d  = (_d || 0) + sm.defense;
          if (sm.move)    _m += sm.move;
          if (sm.range) { _r = _r ? _r + sm.range : sm.range; }
        });
        return {
          id:       item.id       || `saved_${i}`,
          name:     item.name     || item.unitName || `Unit ${i + 1}`,
          lore:     item.lore     || null,
          quality: _q, move: _m, defense: _d, range: _r,
          cost:    item.totalCost || item.cost || null,
          weapon:  item.weapon    || null,
          weapon_properties: item.weapon_properties || [],
          special: item.abilities || item.special || [],
          isTitan: item.isTitan   || false,
        };
      }).filter(Boolean);

      if (!allUnits.length) return null;
      return {
        id: factionId,
        name: saveData.name || saveData.armyName || meta.name || factionId,
        color: meta.color || '#888',
        isMonster: meta.isMonster || false,
        isNPC, logoUrl: LOGO_BASE + factionId + '_logo.svg',
        allUnits, deployIndex: 0,
      };
    }

    function buildFactionEntry(factionId, factionData, isNPC, isMonster) {
      const meta = FACTION_META[factionId] || {};
      const allUnits = (factionData?.units || factionData?.roster || []).map((u, i) => ({
        id:      u.id       || `unit_${i}`,
        name:    u.name     || `Unit ${i + 1}`,
        lore:    u.lore     || null,
        quality: u.quality  || 4,
        move:    u.move     || 6,
        defense: u.defense  || u.armor  || null,
        range:   u.range    || u.shoot  || null,
        cost:    u.cost     || u.points || null,
        weapon:  u.weapon   || null,
        weapon_properties: u.weapon_properties || [],
        special: u.special  || u.abilities || [],
        isTitan: u.titan    || false,
      }));
      return {
        id: factionId, name: factionData?.name || meta.name || factionId,
        color: meta.color || '#888',
        isMonster: isMonster ?? meta.isMonster ?? false,
        isNPC, logoUrl: LOGO_BASE + factionId + '_logo.svg',
        allUnits, deployIndex: 0,
      };
    }

    function initUnitStates(faction) {
      faction.allUnits.forEach(u => {
        const k = unitKey(faction.id, u.id);
        if (!state.unitState[k]) state.unitState[k] = { quality: u.quality, out: false, activated: false, lastRoll: null };
      });
    }

    // ═════════════════════════════════════════════════════════════════════════
    // SPRITE & MAP ASSET LOADING
    // ═════════════════════════════════════════════════════════════════════════

    async function loadTabletop() {
      return new Promise(resolve => {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload  = () => {
          sim.tabletopImg = img;
          console.log('Tabletop loaded: natural size', img.naturalWidth, 'x', img.naturalHeight);
          // If SVG has a non-square natural size, store the aspect ratio
          sim.tabletopAspect = img.naturalWidth > 0 ? img.naturalHeight / img.naturalWidth : 1;
          resolve();
        };
        img.onerror = () => { console.warn('Tabletop SVG failed'); resolve(); };
        img.src = TABLETOP_SVG_URL + '?t=' + Date.now();
      });
    }

    async function loadSpriteAssets() {
      return new Promise((resolve) => {
        // Load sprite JSON
        fetch(SPRITE_JSON_URL + '?t=' + Date.now())
          .then(r => r.json())
          .then(data => {
            sim.spriteData = data;
            // Load sprite sheet image
            const img = new Image();
            img.crossOrigin = 'anonymous';
            img.onload  = () => { sim.spriteSheet = img; console.log('🎨 Sprite sheet loaded'); resolve(); };
            img.onerror = () => { console.warn('⚠️ Sprite sheet failed to load'); resolve(); };
            img.src = SPRITE_SHEET_URL + '?t=' + Date.now();
          })
          .catch(err => { console.warn('⚠️ Sprite JSON failed:', safeErr(err)); resolve(); });
      });
    }

    async function loadTerrainCatalog() {
      if (Object.keys(sim.terrainCatalog).length > 0) return; // already loaded
      try {
        const res  = await fetch(TERRAIN_CATALOG_URL + '?t=' + Date.now());
        if (!res.ok) throw new Error('HTTP ' + res.status);
        const data = await res.json();
        // Build lookup: terrain_type_id -> asset_file
        const list = Array.isArray(data) ? data : (data.terrain_types || data.terrain || data.types || data.catalog || []);
        list.forEach(entry => {
          if (entry.terrain_type_id && entry.asset_file) {
            sim.terrainCatalog[entry.terrain_type_id] = entry.asset_file;
            // Also store full entry for footprint-based sizing
            if (!sim.terrainCatalogFull) sim.terrainCatalogFull = {};
            sim.terrainCatalogFull[entry.terrain_type_id] = entry;
          }
        });
        console.log('📋 Terrain catalog loaded:', Object.keys(sim.terrainCatalog).length, 'entries');
      } catch (e) {
        console.warn('Could not load terrain catalog:', safeErr(e));
      }
    }

    function buildTerrainBlockedMap() {
      // Mark grid squares occupied by impassable terrain
      sim.blockedSquares = new Set();
      if (!sim.mapData || !sim.mapData.instances) return;
      const TABLE_INCHES = 48;
      sim.mapData.instances.forEach(inst => {
        const entry = sim.terrainCatalogFull && sim.terrainCatalogFull[inst.terrain_type_id];
        if (!entry) return;
        // Block unless explicitly marked passable = true
        // Buildings/features with no movement data default to blocking
        const kind     = (entry.kind || '').toLowerCase();
        const passable = entry.movement && entry.movement.is_passable;
        // scatter/area terrain is walkable by default; buildings/features block
        const defaultPassable = (kind === 'scatter' || kind === 'area' || kind === 'hazard');
        if (passable === true || (passable === undefined && defaultPassable)) return;
        // Find which grid squares this terrain occupies
        const fp = entry.footprint && entry.footprint.size_in;
        const fw = fp ? fp.w : 4;
        const fd = fp ? fp.d : 4;
        const halfW = (fw / TABLE_INCHES * MAP_SIZE) / 2;
        const halfD = (fd / TABLE_INCHES * MAP_SIZE) / 2;
        // In canvas coords (Y-flipped)
        const cx = inst.x;
        const cy = MAP_SIZE - inst.y;
        const minGX = Math.floor((cx - halfW) / GRID_PX);
        const maxGX = Math.ceil( (cx + halfW) / GRID_PX);
        const minGY = Math.floor((cy - halfD) / GRID_PX);
        const maxGY = Math.ceil( (cy + halfD) / GRID_PX);
        for (let gx = minGX; gx <= maxGX; gx++) {
          for (let gy = minGY; gy <= maxGY; gy++) {
            sim.blockedSquares.add(gx + ',' + gy);
          }
        }
      });
      console.log('Terrain blocked squares:', sim.blockedSquares.size);
    }

    function isSquareBlocked(canvasX, canvasY, excludeKey) {
      const gx = Math.round(canvasX / GRID_PX);
      const gy = Math.round(canvasY / GRID_PX);
      // Terrain blocking
      if (sim.blockedSquares && sim.blockedSquares.has(gx + ',' + gy)) return true;
      // Unit blocking — can't share a square with another unit
      for (const [k, pos] of Object.entries(sim.unitPositions)) {
        if (!pos || pos.status === 'routed') continue;
        if (k === excludeKey) continue;
        const ugx = Math.round(pos.x / GRID_PX);
        const ugy = Math.round(pos.y / GRID_PX);
        if (ugx === gx && ugy === gy) return true;
      }
      return false;
    }

    function preloadTerrainImages() {
      if (!sim.mapData || !sim.mapData.instances) return;
      const ids = [...new Set(sim.mapData.instances.map(i => i.terrain_type_id))];
      sim.terrainLoadQueue = ids.length;
      ids.forEach(id => {
        if (sim.terrainImages[id]) { sim.terrainLoadQueue--; return; }
        // Look up the real filename from the catalog, fall back to id.png
        const filename = sim.terrainCatalog[id] || (id + '.png');
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload  = () => { sim.terrainImages[id] = img; sim.terrainLoadQueue = Math.max(0, sim.terrainLoadQueue - 1); };
        img.onerror = () => { sim.terrainImages[id] = null;  sim.terrainLoadQueue = Math.max(0, sim.terrainLoadQueue - 1); };
        img.src = TERRAIN_BASE + filename;
      });
    }

    // ═════════════════════════════════════════════════════════════════════════
    // DEPLOYMENT ENGINE
    // ═════════════════════════════════════════════════════════════════════════

    function assignFactionZones() {
      const nonMonsters = state.factions.filter(f => !f.isMonster);
      const monsters    = state.factions.filter(f => f.isMonster);

      // Shuffle zone assignments
      const zones = [...ZONE_DEFS];
      for (let i = zones.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [zones[i], zones[j]] = [zones[j], zones[i]];
      }

      nonMonsters.forEach((f, i) => {
        sim.factionZones[f.id] = zones[i % zones.length];
      });

      // Monsters always deploy from center, queued
      monsters.forEach(f => {
        sim.factionZones[f.id] = MONSTER_ZONE;
      });
    }

    function randomInRange(min, max) {
      return min + Math.random() * (max - min);
    }

    function deployAllFactions() {
      assignFactionZones();
      state.factions.forEach(faction => {
        const zone = sim.factionZones[faction.id] || MONSTER_ZONE;
        const units = faction.allUnits;

        if (faction.isMonster) {
          // Monsters deploy in the center zone from the start -- visible with icons
          const usedSquares = new Set();
          units.forEach(u => {
            const k = unitKey(faction.id, u.id);
            let mx, my, sq, attempts = 0;
            do {
              mx = MONSTER_ZONE.xMin + Math.random() * (MONSTER_ZONE.xMax - MONSTER_ZONE.xMin);
              my = MONSTER_ZONE.yMin + Math.random() * (MONSTER_ZONE.yMax - MONSTER_ZONE.yMin);
              mx = Math.round(mx / GRID_PX) * GRID_PX + GRID_PX / 2;
              my = Math.round(my / GRID_PX) * GRID_PX + GRID_PX / 2;
              sq = mx + ',' + my;
              attempts++;
            } while (usedSquares.has(sq) && attempts < 200);
            usedSquares.add(sq);
            const cv = mapToCanvas(mx, my);
            sim.unitPositions[k] = {
              x: cv.cx, y: cv.cy,
              mapX: mx, mapY: my,
              animName: 'idle', frameIdx: 0, frameTimer: 0,
              vx: 0, vy: 0, status: 'idle',
            };
          });
          return;
        }

        // Line units evenly along their diamond edge
        // Each zone defines a start and end point on the diamond perimeter
        const edgeLine = ZONE_EDGE_LINES[zone.key] || null;
        const unitCount = units.length;
        units.forEach((u, i) => {
          const k = unitKey(faction.id, u.id);
          let mx, my;
          if (edgeLine) {
            // Space evenly along the edge, inset slightly from each end
            const t0 = 0.06, t1 = 0.94;
            const t = unitCount === 1 ? 0.5 : t0 + (t1 - t0) * (i / (unitCount - 1));
            mx = edgeLine.x1 + (edgeLine.x2 - edgeLine.x1) * t;
            my = edgeLine.y1 + (edgeLine.y2 - edgeLine.y1) * t;
          } else {
            // Fallback: zone center
            mx = (zone.xMin + zone.xMax) / 2;
            my = (zone.yMin + zone.yMax) / 2;
          }
          // Snap to grid
          mx = Math.round(mx / GRID_PX) * GRID_PX + GRID_PX / 2;
          my = Math.round(my / GRID_PX) * GRID_PX + GRID_PX / 2;
          const cv = mapToCanvas(mx, my);
          sim.unitPositions[k] = {
            x: cv.cx, y: cv.cy,
            mapX: mx, mapY: my,
            animName: 'idle', frameIdx: 0, frameTimer: 0,
            vx: 0, vy: 0, status: 'idle',
          };
        });
      });
      simLog(`[Deploy] All factions deployed to their zones.`, 'deploy');
    }

    function spawnNextMonster(monsterFaction) {
      // Pop next monster from queue and place in center
      const nextKey = sim.monsterQueue.shift();
      if (!nextKey) return;
      const center = MONSTER_ZONE;
      sim.unitPositions[nextKey] = {
        x: randomInRange(center.xMin, center.xMax),
        y: randomInRange(center.yMin, center.yMax),
        animName: 'idle', frameIdx: 0, frameTimer: 0,
        vx: 0, vy: 0, status: 'idle',
      };
      const [fid, uid] = nextKey.split('::');
      const faction = getFactionById(fid);
      const unit    = getUnitById(faction, uid);
      simLog(`💀 ${unit?.name || 'Monster'} emerges from the center!`, 'monster');
    }

    // ═════════════════════════════════════════════════════════════════════════
    // NOISE & MONSTER PRESSURE (mirrors turn counter)
    // ═════════════════════════════════════════════════════════════════════════

    let _monsterPool = [];

    async function loadMonsterPool() {
      if (_monsterPool.length > 0) return;
      try {
        const meta = FACTION_META['monsters'];
        if (!meta) return;
        const res  = await fetch(FACTION_LOADER_BASE + meta.file + '?t=' + Date.now());
        if (!res.ok) return;
        const data = safeParseJson(await res.text());
        _monsterPool = (data?.units || []).map((u, i) => ({
          id: u.id || `m_${i}`, name: u.name || `Monster ${i+1}`,
          quality: u.quality || 4, move: u.move || 6,
          defense: u.defense || null, range: u.range || null,
          special: u.special || u.abilities || [], isTitan: u.titan || false,
        }));
        console.log('🐉 Monster pool:', _monsterPool.length, 'types');
      } catch (e) { console.warn('Could not load monster pool:', safeErr(e)); }
    }

    function pickEncounterMonster() {
      const pool = _monsterPool.length > 0 ? _monsterPool : FALLBACK_MONSTERS;
      const last = state._lastMonsterTriggered || '';
      const candidates = pool.filter(m => m.id !== last);
      const chosen = candidates.length > 0 ? candidates : pool;
      return chosen[Math.floor(Math.random() * chosen.length)];
    }

    function addNoise(amount, label) {
      state.noiseLevel += amount;
      // Don't log noise — game tracks it silently
      checkMonsterTrigger();
      refreshNoiseBars();
    }

    function refreshNoiseBars() {
      const noiseEl = document.getElementById('cc-sim-noise-fill');
      const noiseValEl = document.getElementById('cc-sim-noise-val');
      if (noiseEl) {
        const pct   = Math.min(100, Math.round((state.noiseLevel / state.noiseThreshold) * 100));
        const color = pct >= 80 ? '#ef5350' : pct >= 50 ? '#ffd600' : '#4caf50';
        noiseEl.style.width = pct + '%';
        noiseEl.style.background = color;
      }
      if (noiseValEl) noiseValEl.textContent = state.noiseLevel + ' / ' + state.noiseThreshold;
    }

    function checkMonsterTrigger() {
      if (state.noiseLevel < state.noiseThreshold) return;
      const monsterDef = pickEncounterMonster();
      if (!monsterDef) return;

      state._lastMonsterTriggered = monsterDef.id;
      state.monstersTriggered++;
      state.noiseLevel = Math.floor(state.noiseLevel / 2);
      simLog(`🔥 Encounter! ${monsterDef.name} approaches!`, 'monster');

      const instanceId = `${monsterDef.id}_enc${state.monstersTriggered}`;
      const unit = Object.assign({}, monsterDef, { id: instanceId });

      let monsterFaction = state.factions.find(f => f.isMonster);
      if (!monsterFaction) {
        monsterFaction = {
          id: 'encounters', name: 'Encounters', color: '#ef5350',
          isMonster: true, isNPC: true, logoUrl: LOGO_BASE + 'monsters_logo.svg',
          allUnits: [], deployIndex: 0,
        };
        state.factions.push(monsterFaction);
        sim.factionZones['encounters'] = MONSTER_ZONE;
      }
      monsterFaction.allUnits.push(unit);
      state.unitState[unitKey(monsterFaction.id, unit.id)] = { quality: unit.quality, out: false, activated: false, lastRoll: null };

      // Place immediately in center
      const mGX = Math.round((MONSTER_ZONE.xMin + MONSTER_ZONE.xMax) / 2 / GRID_PX) + Math.floor(Math.random() * 4) - 2;
      const mGY = Math.round((MONSTER_ZONE.yMin + MONSTER_ZONE.yMax) / 2 / GRID_PX) + Math.floor(Math.random() * 4) - 2;
      sim.unitPositions[unitKey(monsterFaction.id, unit.id)] = {
        x: mGX * GRID_PX + GRID_PX / 2,
        y: mGY * GRID_PX + GRID_PX / 2,
        animName: 'idle', frameIdx: 0, frameTimer: 0,
        vx: 0, vy: 0, status: 'idle',
      };

      // Insert into queue after current unit
      state.queue.splice(state.queueIndex + 1, 0, { factionId: monsterFaction.id, unitId: unit.id });
      showMonsterAlert(monsterDef);
    }

    function rollCanyonEvent() {
      if (Math.random() > (state.round >= 3 ? 0.5 : 0.33)) return null;
      const ev = CANYON_EVENTS[Math.floor(Math.random() * CANYON_EVENTS.length)];
      state.lastEventRound = state.round;
      if (ev.id === 'canyon_echo') addNoise(2, 'Canyon Echo');
      if (ev.id === 'silence')     addNoise(3, 'Unnatural Silence');
      simLog(`[Event] ${ev.text}`, 'event');
      return ev;
    }

    // ═════════════════════════════════════════════════════════════════════════
    // CANVAS RENDERER
    // ═════════════════════════════════════════════════════════════════════════

    function initCanvas() {
      const wrap = document.getElementById('cc-sim-map-wrap');
      if (!wrap) return;

      const canvas = document.createElement('canvas');
      canvas.id = 'cc-sim-canvas';
      canvas.className = 'cc-sim-canvas';
      wrap.appendChild(canvas);
      sim.canvas = canvas;
      sim.ctx    = canvas.getContext('2d');

      // Fit canvas to container
      function resizeCanvas() {
        canvas.width  = wrap.clientWidth  || 800;
        canvas.height = wrap.clientHeight || 600;
        // SVG viewBox is 2000x1060. Diamond spans ~3932w x 3772h in map coords.
        // Fit the full diamond into the viewport.
        const diamondW = 3932, diamondH = 3772;
        const scaleW   = canvas.width  * 0.92 / diamondW;
        const scaleH   = canvas.height * 0.92 / diamondH;
        sim.viewScale  = Math.min(scaleW, scaleH);
        // Center on diamond centre in canvas coords (2048, 2090)
        sim.viewX = canvas.width  / 2 - 2048 * sim.viewScale;
        sim.viewY = canvas.height / 2 - 2090 * sim.viewScale;
      }
      resizeCanvas();
      window.addEventListener('resize', resizeCanvas);

      // Pan with mouse drag
      // Map is static — no panning. Only hover detection.
      canvas.addEventListener('mousemove', e => {
        const rect = canvas.getBoundingClientRect();
        const mx = (e.clientX - rect.left - sim.viewX) / sim.viewScale;
        const my = (e.clientY - rect.top  - sim.viewY) / sim.viewScale;
        detectHoveredUnit(mx, my);
      });

      // Scroll to zoom
      canvas.addEventListener('wheel', e => {
        e.preventDefault();
        const rect   = canvas.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;
        const factor = e.deltaY < 0 ? 1.1 : 0.9;
        // Zoom around mouse position
        sim.viewX = mouseX - (mouseX - sim.viewX) * factor;
        sim.viewY = mouseY - (mouseY - sim.viewY) * factor;
        sim.viewScale = Math.max(0.05, Math.min(2, sim.viewScale * factor));
      }, { passive: false });

      // Touch: pinch to zoom only (no pan)

      // ── Solo mode drag handlers ──────────────────────────────────────────
      canvas.addEventListener('mousedown', e => {
        const rect = canvas.getBoundingClientRect();
        const mx   = (e.clientX - rect.left - sim.viewX) / sim.viewScale;
        const my   = (e.clientY - rect.top  - sim.viewY) / sim.viewScale;

        // Check if clicking a solo unit
        if (sim.soloWaiting && sim.soloFactionId && !sim.soloMovedThisTurn) {
          const HIT = SPRITE_DRAW_SIZE / 2 + 10;
          for (const [key, pos] of Object.entries(sim.unitPositions)) {
            if (!pos || pos.status === 'routed') continue;
            const [fid] = key.split('::');
            if (fid !== sim.soloFactionId) continue;
            const cur = currentQueueItem();
            if (!cur || cur.factionId + '::' + cur.unitId !== key) continue;
            if (Math.abs(pos.x - mx) < HIT && Math.abs(pos.y - my) < HIT) {
              // Start dragging this solo unit
              sim.dragUnit   = key;
              sim.dragStartX = pos.x;
              sim.dragStartY = pos.y;
              sim.rulerActive = true;
              const unit = getUnitById(getFactionById(fid), cur.unitId);
              sim.rulerMax = (unit ? unit.move || 6 : 6) * GRID_PX;  // inches * px/inch
              sim.isDragging = false; // don't pan
              e.stopPropagation();
              return;
            }
          }
        }

        // Otherwise pan
        sim.isDragging = true;
        sim.dragLast   = { x: e.clientX, y: e.clientY };
        wrap.classList.add('is-dragging');
      }, true);

      canvas.addEventListener('mousemove', e => {
        const rect = canvas.getBoundingClientRect();
        const mx   = (e.clientX - rect.left - sim.viewX) / sim.viewScale;
        const my   = (e.clientY - rect.top  - sim.viewY) / sim.viewScale;

        if (sim.dragUnit) {
          const pos = sim.unitPositions[sim.dragUnit];
          if (pos) {
            // Snap target to nearest grid square centre
            const snapX = Math.round(mx / GRID_PX) * GRID_PX + GRID_PX / 2;
            const snapY = Math.round(my / GRID_PX) * GRID_PX + GRID_PX / 2;
            const dx    = snapX - sim.dragStartX;
            const dy    = snapY - sim.dragStartY;
            const squares = Math.max(Math.abs(Math.round(dx / GRID_PX)), Math.abs(Math.round(dy / GRID_PX)));
            const maxSq   = Math.floor(sim.rulerMax / GRID_PX);
            sim.rulerDist = squares * GRID_PX;
            const destBlocked = isSquareBlocked(snapX, snapY, sim.dragUnit || '');
            if (squares <= maxSq && !destBlocked) {
              pos.x = snapX;
              pos.y = snapY;
            } else if (!destBlocked) {
              // Clamp — move along the vector but only maxSq squares
              const ratio = maxSq / Math.max(1, squares);
              pos.x = sim.dragStartX + Math.round(dx * ratio / GRID_PX) * GRID_PX;
              pos.y = sim.dragStartY + Math.round(dy * ratio / GRID_PX) * GRID_PX;
            }
            // If destBlocked, pos stays at last valid position
            const rulerEl = document.getElementById('cc-sim-ruler-hud');
            if (rulerEl) {
              const used = Math.min(squares, maxSq);
              rulerEl.textContent = used + '" used / ' + maxSq + '" max';
              rulerEl.classList.add('visible');
            }
          }
          return;
        }
      }, true);

      canvas.addEventListener('mouseup', e => {
        if (sim.dragUnit) {
          const pos = sim.unitPositions[sim.dragUnit];
          if (pos) {
            pos.x = Math.round((pos.x - GRID_PX/2) / GRID_PX) * GRID_PX + GRID_PX / 2;
            pos.y = Math.round((pos.y - GRID_PX/2) / GRID_PX) * GRID_PX + GRID_PX / 2;
            pos.status = 'idle';
          }
          // Show action menu even if didn't move (tap = attack in place)
          if (!sim.soloMovedThisTurn) sim.soloMovedThisTurn = true;
          const _movedKey = sim.dragUnit;   // capture BEFORE clearing
          sim.dragUnit    = null;
          sim.rulerActive = false;
          sim.rulerDist   = 0;
          sim.soloMovedThisTurn = true;
          const rulerEl = document.getElementById('cc-sim-ruler-hud');
          if (rulerEl) rulerEl.classList.remove('visible');
          setTimeout(() => window.CC_SIM.showSoloActionMenu(_movedKey || ''), 200);
          return;
        }
        sim.isDragging = false;
        sim.dragLast   = null;
        wrap.classList.remove('is-dragging');
      }, true);

      // Click any unit sprite to open inspector panel
      canvas.addEventListener('click', e => {
        // Don't trigger if we just finished a drag
        if (sim._justDragged) { sim._justDragged = false; return; }
        const rect = canvas.getBoundingClientRect();
        const mx = (e.clientX - rect.left - sim.viewX) / sim.viewScale;
        const my = (e.clientY - rect.top  - sim.viewY) / sim.viewScale;
        const HIT = SPRITE_DRAW_SIZE / 2 + 10;
        for (const [key, pos] of Object.entries(sim.unitPositions)) {
          if (!pos || pos.status === 'routed') continue;
          if (Math.abs(pos.x - mx) < HIT && Math.abs(pos.y - my) < HIT) {
            window.CC_SIM.showUnitInspector(key);
            return;
          }
        }
      });

      // Start render loop
      if (sim.animFrameId) cancelAnimationFrame(sim.animFrameId);
      sim.animFrameId = requestAnimationFrame(renderLoop);
    }

    function destroyCanvas() {
      if (sim.animFrameId) { cancelAnimationFrame(sim.animFrameId); sim.animFrameId = null; }
      const canvas = document.getElementById('cc-sim-canvas');
      if (canvas) canvas.remove();
      sim.canvas = null; sim.ctx = null;
    }

    function detectHoveredUnit(mx, my) {
      const HIT = SPRITE_DRAW_SIZE / 2 + 8;
      let found = null;
      for (const [key, pos] of Object.entries(sim.unitPositions)) {
        if (!pos || pos.status === 'routed') continue;
        if (Math.abs(pos.x - mx) < HIT && Math.abs(pos.y - my) < HIT) {
          found = key; break;
        }
      }
      sim.hoveredUnit = found;
    }

    // ─────────────────────────────────────────────────────────────────────────
    // RENDER LOOP
    // ─────────────────────────────────────────────────────────────────────────

    function smoothCameraToUnit(key) {
      // Camera is now static — no auto-follow
      // Users pan manually
    }

    function tickCamera() {
      // Camera is static — no auto-pan
    }

    function tickUnitSlides() {
      // Lerp all units toward their targetX/targetY with easing
      const SLIDE_SPEED = 0.18;
      Object.values(sim.unitPositions).forEach(pos => {
        if (!pos) return;
        if (pos.targetX === undefined || pos.targetY === undefined) return;
        const dx = pos.targetX - pos.x;
        const dy = pos.targetY - pos.y;
        if (Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5) {
          pos.x = pos.targetX;
          pos.y = pos.targetY;
          pos.targetX = undefined;
          pos.targetY = undefined;
          if (pos.status === 'moving') pos.status = 'idle';
        } else {
          pos.x += dx * SLIDE_SPEED;
          pos.y += dy * SLIDE_SPEED;
          pos.status = 'moving';
        }
      });
    }

    function renderLoop(timestamp) {
      if (_destroyed || !sim.canvas || !sim.ctx) return;

      tickCamera();
      tickUnitSlides();

      const canvas = sim.canvas;
      const ctx    = sim.ctx;
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      ctx.save();
      ctx.translate(sim.viewX, sim.viewY);
      ctx.scale(sim.viewScale, sim.viewScale);

      drawBackground(ctx);
      drawDeployZones(ctx);
      drawTerrain(ctx);
      drawRuler(ctx);
      drawDeathMarkers(ctx);
      drawUnits(ctx, timestamp);

      ctx.restore();

      if (sim.hoveredUnit) drawTooltip(ctx, canvas);

      sim.animFrameId = requestAnimationFrame(renderLoop);
    }

    function drawDeathMarkers(ctx) {
      if (!sim.deathMarkers || !sim.deathMarkers.length) return;
      ctx.save();
      ctx.font = Math.round(SPRITE_DRAW_SIZE * 0.7) + 'px FontAwesome, serif';
      ctx.textAlign    = 'center';
      ctx.textBaseline = 'middle';
      ctx.globalAlpha  = 0.75;
      sim.deathMarkers.forEach(m => {
        // Draw skull unicode as fallback (FA may not be on canvas)
        ctx.fillStyle = 'rgba(239,83,80,0.9)';
        ctx.font = Math.round(SPRITE_DRAW_SIZE * 0.8) + 'px serif';
        ctx.fillText('☠', m.x, m.y);
      });
      ctx.restore();
    }

    function drawRuler(ctx) {
      if (!sim.rulerActive || !sim.dragUnit) return;
      const pos = sim.unitPositions[sim.dragUnit];
      if (!pos) return;
      // Line from drag start to current pos
      ctx.save();
      ctx.strokeStyle = '#ffd600';
      ctx.lineWidth   = 2;
      ctx.setLineDash([8, 4]);
      ctx.beginPath();
      ctx.moveTo(sim.dragStartX, sim.dragStartY);
      ctx.lineTo(pos.x, pos.y);
      ctx.stroke();
      ctx.setLineDash([]);
      // Range circle
      ctx.strokeStyle = sim.rulerDist <= sim.rulerMax
        ? 'rgba(255,214,0,0.25)'
        : 'rgba(239,83,80,0.35)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(sim.dragStartX, sim.dragStartY, sim.rulerMax, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    function drawBackground(ctx) {
      // Transparent fill so canvas background CSS shows through (no dark boxes)
      ctx.clearRect(0, 0, MAP_SIZE, MAP_SIZE);

      if (!sim.tabletopImg) return;

      const img = sim.tabletopImg;
      const iw  = img.naturalWidth  || MAP_SIZE;
      const ih  = img.naturalHeight || MAP_SIZE;

      // Fit inside the square map without distorting the SVG
      const scale = Math.min(MAP_SIZE / iw, MAP_SIZE / ih);
      const dw = iw * scale;
      const dh = ih * scale;
      const dx = (MAP_SIZE - dw) / 2;
      const dy = (MAP_SIZE - dh) / 2;

      ctx.drawImage(img, dx, dy, dw, dh);
    }

    function drawDeployZones(ctx) {
      // Only draw zones during the first round as a subtle reference
      if (state.round > 1) return;
      Object.entries(sim.factionZones).forEach(([fid, zone]) => {
        const faction = getFactionById(fid);
        if (!faction || !zone) return;
        const color = faction.color || '#888';
        ctx.save();
        ctx.globalAlpha = 0.06;
        ctx.fillStyle   = color;
        ctx.fillRect(zone.xMin, zone.yMin, zone.xMax - zone.xMin, zone.yMax - zone.yMin);
        ctx.globalAlpha = 0.2;
        ctx.strokeStyle = color;
        ctx.lineWidth   = 2;
        ctx.setLineDash([8, 6]);
        ctx.strokeRect(zone.xMin, zone.yMin, zone.xMax - zone.xMin, zone.yMax - zone.yMin);
        ctx.setLineDash([]);
        ctx.restore();
      });
    }

    // Leaflet CRS.Simple has Y increasing upward, so terrain y must be flipped
    function mapToCanvas(mx, my) {
      return { cx: mx, cy: MAP_SIZE - my };
    }

    function drawTerrain(ctx) {
      if (!sim.mapData || !sim.mapData.instances) return;
      // Table is 48 inches wide, drawn at MAP_SIZE px wide in our coordinate space
      const TABLE_INCHES = 48;
      sim.mapData.instances.forEach(inst => {
        if (inst.hidden_in_editor) return;
        const img = sim.terrainImages[inst.terrain_type_id];
        if (!img) return;
        // Use footprint-based sizing if catalog has it, otherwise fall back to natural size
        const catalogEntry = (sim.terrainCatalogFull && sim.terrainCatalogFull[inst.terrain_type_id]) || null;
        const fp = catalogEntry && catalogEntry.footprint && catalogEntry.footprint.size_in;
        let w, h;
        if (fp && fp.w) {
          // Map maker formula: tableWidthPx * (footprintInches / tableSizeInches) * scale
          const iconW = MAP_SIZE * (fp.w / TABLE_INCHES) * (inst.scale || 1);
          const aspect = img.naturalHeight / Math.max(1, img.naturalWidth);
          w = iconW;
          h = iconW * aspect;
        } else {
          w = img.naturalWidth  * (inst.scale || 1);
          h = img.naturalHeight * (inst.scale || 1);
        }
        const { cx, cy } = mapToCanvas(inst.x, inst.y);
        ctx.save();
        ctx.translate(cx, cy);
        if (inst.rotation_deg) ctx.rotate(inst.rotation_deg * Math.PI / 180);
        if (inst.mirror_x || inst.mirror_y) ctx.scale(inst.mirror_x ? -1 : 1, inst.mirror_y ? -1 : 1);
        ctx.globalAlpha = inst.opacity ?? 1;
        // iconAnchor is [width/2, 0] = top-center, so draw from (-w/2, 0) not (-w/2, -h/2)
        ctx.drawImage(img, -w / 2, 0, w, h);
        ctx.restore();
      });
    }

    function getSpriteFrame(animName, frameIdx) {
      if (!sim.spriteData || !sim.spriteData[animName]) return null;
      const anim   = sim.spriteData[animName];
      const frames = anim.frames;
      if (!frames || !frames.length) return null;
      return frames[frameIdx % frames.length];
    }

    function drawUnits(ctx, timestamp) {
      const curItem = currentQueueItem();

      Object.entries(sim.unitPositions).forEach(([key, pos]) => {
        if (!pos || pos.status === 'routed') return;

        const [fid, uid] = key.split('::');
        const faction = getFactionById(fid);
        const unit    = getUnitById(faction, uid);
        const us      = getUnitState(fid, uid);
        if (!faction || !unit || !us || us.out) return;

        const isActive   = curItem && curItem.factionId === fid && curItem.unitId === uid;
        const isHovered  = sim.hoveredUnit === key;
        const isSelected = sim.selectedUnit === key;
        const color      = faction.color || '#888';

        // Advance animation frame
        const animSet = FACTION_SPRITE[fid] || FACTION_SPRITE['encounters'];
        const animName = animSet ? animSet[pos.status === 'moving' ? 'run' : pos.status === 'fighting' ? 'attack' : 'idle'] : null;
        if (animName && sim.spriteData) {
          const anim = sim.spriteData[animName];
          if (anim) {
            pos.frameTimer = (pos.frameTimer || 0) + (timestamp - (pos._lastTs || timestamp));
            pos._lastTs    = timestamp;
            const frame    = anim.frames[pos.frameIdx % anim.frames.length];
            if (frame && pos.frameTimer >= frame.duration) {
              pos.frameTimer = 0;
              pos.frameIdx   = (pos.frameIdx + 1) % anim.frames.length;
            }
          }
        }

        const half = SPRITE_DRAW_SIZE / 2;

        // Draw selection ring
        if (isActive || isSelected || isHovered) {
          ctx.save();
          ctx.beginPath();
          ctx.arc(pos.x, pos.y, half + 6, 0, Math.PI * 2);
          ctx.strokeStyle = isActive ? '#fff' : isSelected ? color : 'rgba(255,255,255,0.4)';
          ctx.lineWidth   = isActive ? 3 : 2;
          if (isActive) {
            ctx.shadowColor = color;
            ctx.shadowBlur  = 12;
          }
          ctx.stroke();
          ctx.restore();
        }

        // Drop shadow — offset left-down for isometric look
        ctx.save();
        ctx.globalAlpha = 0.3;
        ctx.fillStyle   = '#000';
        ctx.beginPath();
        ctx.ellipse(
          pos.x - half * 0.5,   // left offset
          pos.y + half * 0.7,   // below unit
          half * 0.85,           // wide
          half * 0.25,           // flat
          -0.25,                 // slight angle
          0, Math.PI * 2
        );
        ctx.fill();
        ctx.restore();

        // Draw sprite OR colored circle fallback
        const frame = animName ? getSpriteFrame(animName, pos.frameIdx) : null;
        if (frame && sim.spriteSheet) {
          ctx.save();
          // Clip to circle centered on pos
          ctx.beginPath();
          ctx.arc(pos.x, pos.y, half, 0, Math.PI * 2);
          ctx.clip();
          ctx.fillStyle = color + '33';
          ctx.fill();
          // Center sprite in the circle
          ctx.drawImage(
            sim.spriteSheet,
            frame.x, frame.y, SPRITE_SRC_SIZE, SPRITE_SRC_SIZE,
            pos.x - half, pos.y - half, SPRITE_DRAW_SIZE, SPRITE_DRAW_SIZE
          );
          ctx.restore();
          // Circle border
          ctx.beginPath();
          ctx.arc(pos.x, pos.y, half, 0, Math.PI * 2);
          ctx.strokeStyle = color;
          ctx.lineWidth   = 2;
          ctx.stroke();
        } else {
          // Fallback: colored circle with initial
          ctx.beginPath();
          ctx.arc(pos.x, pos.y, half, 0, Math.PI * 2);
          ctx.fillStyle = color + '44';
          ctx.fill();
          ctx.strokeStyle = color;
          ctx.lineWidth   = 2;
          ctx.stroke();
          ctx.fillStyle   = color;
          ctx.font        = `bold ${Math.round(SPRITE_DRAW_SIZE * 0.45)}px sans-serif`;
          ctx.textAlign   = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText((unit.name || '?')[0].toUpperCase(), pos.x, pos.y);
        }

        // Shaken/Panicked indicator
        if (us.shaken || us.panicked) {
          ctx.save();
          ctx.font = 'bold ' + Math.round(SPRITE_DRAW_SIZE * 0.55) + 'px sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(us.panicked ? '💀' : '⚡', pos.x + half, pos.y - half - 14);
          ctx.restore();
        }

        // Health dots above unit
        const maxQ = unit.quality || 4;
        const curQ = us.quality   || 0;
        const dotR = 4;
        const dotW = (dotR * 2 + 3) * maxQ;
        let dx     = pos.x - dotW / 2 + dotR;
        const dy   = pos.y - half - 12;
        for (let i = 0; i < maxQ; i++) {
          ctx.beginPath();
          ctx.arc(dx, dy, dotR, 0, Math.PI * 2);
          ctx.fillStyle = i < curQ ? color : 'rgba(255,255,255,0.15)';
          ctx.fill();
          dx += dotR * 2 + 3;
        }
      });
    }

    function drawTooltip(ctx, canvas) {
      const key     = sim.hoveredUnit;
      const pos     = sim.unitPositions[key];
      if (!pos) return;
      const [fid, uid] = key.split('::');
      const faction = getFactionById(fid);
      const unit    = getUnitById(faction, uid);
      const us      = getUnitState(fid, uid);
      if (!unit || !us) return;

      const sx = pos.x * sim.viewScale + sim.viewX;
      const sy = pos.y * sim.viewScale + sim.viewY;
      const label  = `${unit.name} (Q${us.quality}/${unit.quality})`;
      const label2 = [unit.move ? `M${unit.move}"` : '', unit.defense ? `D${unit.defense}` : '', unit.range ? `R${unit.range}"` : ''].filter(Boolean).join('  ');

      ctx.save();
      ctx.font = 'bold 11px sans-serif';
      const w = Math.max(ctx.measureText(label).width, ctx.measureText(label2).width) + 20;
      const h = 40;
      let tx = sx + 18;
      let ty = sy - h / 2;
      if (tx + w > canvas.width  - 8) tx = sx - w - 18;
      if (ty < 4)                      ty = 4;
      if (ty + h > canvas.height - 4)  ty = canvas.height - h - 4;

      ctx.fillStyle = 'rgba(0,0,0,0.88)';
      roundRect(ctx, tx, ty, w, h, 5);
      ctx.fill();
      ctx.strokeStyle = faction?.color || '#888';
      ctx.lineWidth   = 1;
      ctx.stroke();
      ctx.fillStyle   = '#fff';
      ctx.textBaseline = 'top';
      ctx.fillText(label,  tx + 10, ty + 6);
      ctx.fillStyle = '#aaa';
      ctx.font      = '10px sans-serif';
      ctx.fillText(label2, tx + 10, ty + 22);
      ctx.restore();
    }

    function roundRect(ctx, x, y, w, h, r) {
      ctx.beginPath();
      ctx.moveTo(x + r, y);
      ctx.lineTo(x + w - r, y);      ctx.quadraticCurveTo(x + w, y,     x + w, y + r);
      ctx.lineTo(x + w, y + h - r);  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
      ctx.lineTo(x + r, y + h);      ctx.quadraticCurveTo(x, y + h,     x, y + h - r);
      ctx.lineTo(x, y + r);          ctx.quadraticCurveTo(x, y,         x + r, y);
      ctx.closePath();
    }

    // ═════════════════════════════════════════════════════════════════════════
    // TURN QUEUE ENGINE (mirrors turn counter)
    // ═════════════════════════════════════════════════════════════════════════

    function buildQueue() {
      const monsters = state.factions.filter(f => f.isMonster);
      let   others   = state.factions.filter(f => !f.isMonster);
      // Shuffle non-monsters
      for (let i = others.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [others[i], others[j]] = [others[j], others[i]];
      }
      // Sort each faction's units lowest cost first
      const columns = [...monsters, ...others].map(f => {
        const active = getActiveUnits(f).slice().sort((a, b) => (a.cost ?? 9999) - (b.cost ?? 9999));
        return {
          factionId: f.id, isMonster: f.isMonster,
          units: active.map(u => u.id),
        };
      }).filter(col => col.units.length > 0);

      const maxLen = columns.reduce((m, c) => Math.max(m, c.units.length), 0);
      const queue  = [];
      for (let slot = 0; slot < maxLen; slot++) {
        columns.forEach(col => {
          if (slot < col.units.length) queue.push({ factionId: col.factionId, unitId: col.units[slot] });
        });
      }
      state.queue      = queue;
      state.queueIndex = 0;
    }

    function advanceQueue() {
      const cur = currentQueueItem();
      if (cur) {
        setUnitState(cur.factionId, cur.unitId, { activated: true });
        // Shaken clears at end of this unit's activation
        const us = getUnitState(cur.factionId, cur.unitId);
        if (us && us.shaken) setUnitState(cur.factionId, cur.unitId, { shaken: false });
        const pos = sim.unitPositions[unitKey(cur.factionId, cur.unitId)];
        if (pos) { pos.status = 'idle'; pos.frameIdx = 0; }
      }
      state.queueIndex++;
      // Skip out units
      while (state.queueIndex < state.queue.length) {
        const item = state.queue[state.queueIndex];
        const us   = getUnitState(item.factionId, item.unitId);
        if (!us || us.out) { state.queueIndex++; continue; }
        break;
      }
      return state.queueIndex < state.queue.length;
    }

    function startNewRound() {
      state.round++;
      state.allRoundLogs.push([...state.roundLog]);
      state.roundLog = [];
      simLog(`═══ Round ${state.round} begins ═══`, 'round');

      // Reset activation flags
      state.factions.forEach(f => f.allUnits.forEach(u => {
        const k = unitKey(f.id, u.id);
        if (state.unitState[k]) { state.unitState[k].activated = false; state.unitState[k].lastRoll = null; }
      }));

      rollCanyonEvent();
      buildQueue();
      refreshActiveUnitPanel();
    }

    // ═════════════════════════════════════════════════════════════════════════
    // SIMULATION — MOVEMENT & COMBAT
    // ═════════════════════════════════════════════════════════════════════════

    function findNearestEnemy(fid, pos) {
      // Find closest unit from a different faction
      let nearestKey  = null;
      let nearestDist = Infinity;
      Object.entries(sim.unitPositions).forEach(([key, ePos]) => {
        if (!ePos || ePos.status === 'routed') return;
        const [eFid] = key.split('::');
        if (eFid === fid) return; // same faction
        const dx   = ePos.x - pos.x;
        const dy   = ePos.y - pos.y;
        const dist = Math.hypot(dx, dy);
        if (dist < nearestDist) { nearestDist = dist; nearestKey = key; }
      });
      return { key: nearestKey, dist: nearestDist };
    }

    // Snap pixel coords to nearest grid square centre
    function snapToGrid(x, y) {
      return {
        x: Math.round(x / GRID_PX) * GRID_PX + GRID_PX / 2,
        y: Math.round(y / GRID_PX) * GRID_PX + GRID_PX / 2,
      };
    }

    // Grid distance in map-coord squares (Chebyshev — diagonal counts as 1)
    // Accepts canvas positions and converts internally
    function gridDist(acx, acy, bcx, bcy) {
      const ax = acx, ay = MAP_SIZE - acy;
      const bx = bcx, by = MAP_SIZE - bcy;
      return Math.max(
        Math.abs(Math.round(ax / GRID_PX) - Math.round(bx / GRID_PX)),
        Math.abs(Math.round(ay / GRID_PX) - Math.round(by / GRID_PX))
      );
    }
    function isGridAdjacent(acx, acy, bcx, bcy) {
      return gridDist(acx, acy, bcx, bcy) <= 1;
    }

    function moveUnitToward(key, targetMapX, targetMapY, moveInches) {
      const pos = sim.unitPositions[key];
      if (!pos) return;
      // Work in map coord grid squares
      const maxSquares = Math.floor(moveInches);
      const curGX = Math.round((pos.mapX || pos.x) / GRID_PX);
      const curGY = Math.round((pos.mapY || (MAP_SIZE - pos.y)) / GRID_PX);
      const tgtGX = Math.round(targetMapX / GRID_PX);
      const tgtGY = Math.round(targetMapY / GRID_PX);
      let gx = curGX, gy = curGY;
      for (let step = 0; step < maxSquares; step++) {
        const ddx = Math.sign(tgtGX - gx);
        const ddy = Math.sign(tgtGY - gy);
        if (ddx === 0 && ddy === 0) break;
        if (Math.max(Math.abs(tgtGX - gx), Math.abs(tgtGY - gy)) <= 1) break;
        const nextX = gx + ddx;
        const nextY = gy + ddy;
        // Skip blocked terrain squares
        const nextCX = nextX * GRID_PX + GRID_PX / 2;
        const nextCY = nextY * GRID_PX + GRID_PX / 2;
        if (isSquareBlocked(nextCX, nextCY, key)) {
          // Try to go around — try each axis separately
          if (ddx !== 0 && !isSquareBlocked((gx + ddx) * GRID_PX, nextCY)) { gx += ddx; }
          else if (ddy !== 0 && !isSquareBlocked(nextCX, (gy + ddy) * GRID_PX)) { gy += ddy; }
          else break; // fully blocked
        } else {
          gx = nextX;
          gy = nextY;
        }
      }
      const newMapX = gx * GRID_PX + GRID_PX / 2;
      const newMapY = gy * GRID_PX + GRID_PX / 2;
      pos.mapX = newMapX;
      pos.mapY = newMapY;
      const cv = mapToCanvas(newMapX, newMapY);
      // Slide to new position with easing instead of snapping
      pos.targetX = cv.cx;
      pos.targetY = cv.cy;
      pos.status  = 'moving';
    }

    // ═══════════════════════════════════════════════════════════════════════
    // CORE MECHANICS — per official Coffin Canyon rules
    // ═══════════════════════════════════════════════════════════════════════

    // Roll [qualityScore] d6s. 4+ = success.
    // Returns { dice, successes, critFail, luckyBreak }
    function rollQualityDice(qualityScore) {
      const dice = [];
      for (let i = 0; i < Math.max(1, qualityScore); i++) {
        dice.push(Math.floor(Math.random() * 6) + 1);
      }
      const successes  = dice.filter(d => d >= 4).length;
      const critFail   = dice.every(d => d === 1);                    // all 1s
      const luckyBreak = dice.length > 0 && dice.every(d => d === 6); // all 6s
      return { dice, successes, critFail, luckyBreak };
    }

    // Apply Shaken to a unit (–1 die on all rolls, removed at end of next activation)
    function applyShaken(fid, uid) {
      const us = getUnitState(fid, uid);
      if (!us) return;
      if (us.shaken) {
        // Already Shaken → Panicked
        setUnitState(fid, uid, { panicked: true });
        simLog(getUnitById(getFactionById(fid), uid)?.name + ' PANICS!', 'combat');
      } else {
        setUnitState(fid, uid, { shaken: true });
        simLog(getUnitById(getFactionById(fid), uid)?.name + ' is Shaken.', 'combat');
      }
    }

    // Run a morale test for a unit
    function testMorale(fid, uid) {
      const us   = getUnitState(fid, uid);
      const unit = getUnitById(getFactionById(fid), uid);
      if (!us || !unit) return;
      // fearless / unshakable abilities skip morale
      const abilities = unit.special || [];
      const abilityNames = abilities.map(a => (typeof a === 'string' ? a : (a.name || '')).toLowerCase());
      if (abilityNames.includes('fearless') || abilityNames.includes('unshakable')) return;
      const q = Math.max(1, us.quality);
      const { successes } = rollQualityDice(q);
      if (successes === 0) applyShaken(fid, uid);
    }

    // Get effective defense, applying ability modifiers
    function getEffectiveDefense(unit, us, attackerAbilities) {
      let def = unit.defense || 0;
      // shaken defender: –1 die on their side but doesn't reduce defense directly
      // pierce ability on attacker reduces defense
      const atk = (attackerAbilities || []).map(a => (typeof a === 'string' ? a : (a.name || '')).toLowerCase());
      if (atk.includes('pierce'))        def = Math.max(0, def - 1);
      if (atk.includes('brutal pierce')) def = Math.max(0, def - 2);
      if (atk.includes('savage pierce')) def = Math.max(0, def - 3);
      // shield_wall: +1 defense when adjacent to ally (simplified: always apply if unit has it)
      const defAbil = (unit.special || []).map(a => (typeof a === 'string' ? a : (a.name || '')).toLowerCase());
      if (defAbil.includes('shield_wall') || defAbil.includes('shield wall')) def += 1;
      return Math.max(0, def);
    }

    // Get effective attack dice count (applying Shaken penalty)
    function getEffectiveQuality(unit, us) {
      let q = us.quality || 1;
      if (us.shaken) q = Math.max(1, q - 1); // Shaken: –1 die
      return q;
    }

    function showRollDialog(attacker, defender, dice, successes, defense, damage, critFail, luckyBreak) {
      const existing = document.getElementById('cc-sim-roll-overlay');
      if (existing) existing.remove();

      let resultColor = damage > 0 ? '#4caf50' : '#ef5350';
      if (critFail)   resultColor = '#ef5350';
      if (luckyBreak) resultColor = '#ffd600';

      const diceHtml = dice.map(d => {
        let cls = d >= 4 ? 'success' : 'fail';
        if (d === 6) cls = 'success'; // highlight sixes
        return '<div class="cc-sim-die ' + cls + '" style="' + (d === 6 ? 'border-color:#ffd600;color:#ffd600;' : '') + '">' + d + '</div>';
      }).join('');

      let resultText = '';
      if (critFail)        resultText = 'CRITICAL FAILURE — Shaken!';
      else if (luckyBreak) resultText = 'LUCKY BREAK — All sixes!';
      else if (damage > 0) resultText = damage + ' damage dealt! (' + successes + ' hits vs D' + defense + ')';
      else                 resultText = 'Blocked! (' + successes + ' hits vs D' + defense + ')';

      const overlay = document.createElement('div');
      overlay.id        = 'cc-sim-roll-overlay';
      overlay.className = 'cc-sim-roll-overlay';
      overlay.style.cssText = 'transition:opacity 0.6s ease;opacity:1;';
      overlay.innerHTML =
        '<div class="cc-sim-roll-dialog" style="min-width:300px;padding-top:0;">' +
          '<div id="cc-sim-spotlight-inner" style="margin:0 0 1rem;border-radius:12px 12px 0 0;overflow:hidden;background:#111;height:200px;display:flex;align-items:center;justify-content:center;">' +
            '<canvas id="cc-sim-spotlight-canvas" width="380" height="200" style="display:block;width:100%;height:100%;"></canvas>' +
          '</div>' +
          '<div class="cc-sim-roll-title" style="padding:0 1.5rem;">' + attacker.name + ' <span style="color:#666;">vs</span> ' + defender.name + '</div>' +
          '<div class="cc-sim-dice-row" style="padding:0 1.5rem;">' + diceHtml + '</div>' +
          '<div class="cc-sim-roll-result" style="color:' + resultColor + ';padding:0 1.5rem;">' + resultText + '</div>' +
          '<div style="padding:0 1.5rem 1.5rem;">' +
            '<button class="cc-btn" style="width:100%;margin-top:.5rem;" onclick="window.CC_SIM.closeRollDialog();">Continue</button>' +
          '</div>' +
        '</div>';
      document.body.appendChild(overlay);

      // Auto-dismiss: fade out then remove
      function dismissRollOverlay() {
        if (_spotlightAnimId) { cancelAnimationFrame(_spotlightAnimId); _spotlightAnimId = null; }
        overlay.style.opacity = '0';
        setTimeout(() => { if (overlay.parentNode) overlay.remove(); }, 650);
      }
      overlay._dismiss = dismissRollOverlay;
      setTimeout(dismissRollOverlay, 4500);
    }

    function resolveEngagement(attackerKey, defenderKey, showDialog) {
      const [aFid, aUid] = attackerKey.split('::');
      const [dFid, dUid] = defenderKey.split('::');
      const attackerUnit  = getUnitById(getFactionById(aFid), aUid);
      const defenderUnit  = getUnitById(getFactionById(dFid), dUid);
      const attackerState = getUnitState(aFid, aUid);
      const defenderState = getUnitState(dFid, dUid);
      if (!attackerUnit || !defenderUnit || !attackerState || !defenderState) return;

      const aPos = sim.unitPositions[attackerKey];
      const dPos = sim.unitPositions[defenderKey];
      if (aPos) aPos.status = 'fighting';

      // Effective stats with ability modifiers
      const attackQ  = getEffectiveQuality(attackerUnit, attackerState);
      const defenseD = getEffectiveDefense(defenderUnit, defenderState, attackerUnit.special);

      const { dice, successes, critFail, luckyBreak } = rollQualityDice(attackQ);

      // Critical Failure: attacker becomes Shaken
      if (critFail) {
        applyShaken(aFid, aUid);
        if (showDialog !== false) showRollDialog(attackerUnit, defenderUnit, dice, 0, defenseD, 0, true, false);
        return { dice, successes: 0, damage: 0, critFail: true };
      }

      // Lucky Break: all 6s — attacker gets a free bonus (we auto-apply Quick Step)
      if (luckyBreak) {
        simLog(attackerUnit.name + ' — Lucky Break! (all sixes)', 'combat');
      }

      // Natural Six bonus: if attack hits and attacker rolled any 6, minimum 1 damage
      const hasNaturalSix = dice.some(d => d === 6);

      // Damage = successes − defense (per core rules), minimum 0
      // Natural Six guarantees minimum 1 damage if the attack hits at all
      let damage = Math.max(0, successes - defenseD);
      if (hasNaturalSix && successes > 0 && damage === 0) damage = 1;

      // Tough / Tougher / Toughest: roll to ignore each damage point
      const defAbil = (defenderUnit.special || []).map(a => (typeof a === 'string' ? a : (a.name || '')).toLowerCase());
      if (damage > 0) {
        let ignored = 0;
        const dicePerWound = defAbil.includes('toughest') ? 3 : defAbil.includes('tougher') ? 2 : defAbil.includes('tough') ? 1 : 0;
        if (dicePerWound > 0) {
          for (let i = 0; i < damage; i++) {
            for (let j = 0; j < dicePerWound; j++) {
              if (Math.floor(Math.random() * 6) + 1 >= 5) { ignored++; break; }
            }
          }
          if (ignored > 0) simLog(defenderUnit.name + ' shrugs off ' + ignored + ' wound(s) (Tough).', 'combat');
        }
        damage = Math.max(0, damage - ignored);
      }

      if (showDialog !== false) showRollDialog(attackerUnit, defenderUnit, dice, successes, defenseD, damage, false, luckyBreak);
      // Show combat spotlight with both fighters animating
      showCombatSpotlight(attackerKey, defenderKey);
      if (aPos) aPos.status = 'fighting';
      // Show fight animation in unit preview panel for 2 seconds
      const _curItem = currentQueueItem();
      if (_curItem && _curItem.factionId === aFid) {
        startUnitPreview(aFid, aUid, 'fighting');
        setTimeout(() => { startUnitPreview(aFid, aUid, 'idle'); }, 2000);
      }

      if (damage > 0) {
        const newQ = Math.max(0, defenderState.quality - damage);
        setUnitState(dFid, dUid, { quality: newQ });
        simLog(attackerUnit.name + ' deals ' + damage + ' damage to ' + defenderUnit.name + '! (Q' + newQ + ' remaining)', 'combat');
        // Morale test after taking damage (non-titan, non-fearless)
        if (damage > 0 && newQ > 0) testMorale(dFid, dUid);
        if (newQ <= 0) {
          setUnitState(dFid, dUid, { out: true });
          if (dPos) {
            dPos.status = 'routed';
            // Place skull at death position
            if (!sim.deathMarkers) sim.deathMarkers = [];
            sim.deathMarkers.push({ x: dPos.x, y: dPos.y, name: defenderUnit.name });
          }
          simLog('☠ ' + defenderUnit.name + ' is KILLED!', 'combat');
          // Show death callout overlay briefly
          showDeathCallout(defenderUnit.name, getFactionById(dFid));
          // Cascading fear: nearby enemies of same faction test morale
          const defFaction = getFactionById(dFid);
          if (defFaction) {
            defFaction.allUnits.forEach(u => {
              const uKey = unitKey(dFid, u.id);
              const uPos = sim.unitPositions[uKey];
              if (!uPos || uKey === defenderKey) return;
              const dx = uPos.x - (dPos ? dPos.x : 0);
              const dy = uPos.y - (dPos ? dPos.y : 0);
              if (Math.hypot(dx, dy) < GRID_PX * 6) testMorale(dFid, u.id);
            });
          }
        }
      } else {
        simLog(defenderUnit.name + ' blocked! (' + successes + ' vs D' + defenseD + ')', 'combat');
      }
      return { dice, successes, damage, critFail: false };
    }


    function simulateActivation(fid, uid) {
      const key  = unitKey(fid, uid);
      const pos  = sim.unitPositions[key];
      const unit = getUnitById(getFactionById(fid), uid);
      if (!pos || !unit) return;

      const moveInches  = unit.move  || 6;
      const rangeInches = unit.range || 0;
      const { key: enemyKey, dist: enemyDist } = findNearestEnemy(fid, pos);
      const ePos = enemyKey ? sim.unitPositions[enemyKey] : null;

      // Check grid adjacency for melee
      const inMelee  = ePos && isGridAdjacent(pos.x, pos.y, ePos.x, ePos.y);
      // Check ranged: enemy within range inches (in grid squares) and not adjacent
      const inRange  = !inMelee && rangeInches > 0 && ePos &&
                       gridDist(pos.x, pos.y, ePos.x, ePos.y) <= rangeInches;

      if (inMelee) {
        resolveEngagement(key, enemyKey);
        addNoise(NOISE_VALUES.melee, 'Melee');
      } else if (inRange) {
        // Ranged attack — no movement needed
        pos.status = 'fighting';
        simLog(unit.name + ' fires at ' + (getUnitById(getFactionById(enemyKey.split('::')[0]), enemyKey.split('::')[1])?.name || '?') + '!', 'combat');
        resolveEngagement(key, enemyKey, true);
        addNoise(NOISE_VALUES.shot, 'Shot');
      } else if (ePos) {
        // Move toward enemy — use map coords
        const eMX = ePos.mapX || ePos.x;
        const eMY = ePos.mapY || (MAP_SIZE - ePos.y);
        moveUnitToward(key, eMX, eMY, moveInches);
        simLog(unit.name + ' advances.', 'move');
        // After moving, check melee or range
        if (isGridAdjacent(pos.x, pos.y, ePos.x, ePos.y)) {
          resolveEngagement(key, enemyKey);
          addNoise(NOISE_VALUES.melee, 'Melee');
        } else if (rangeInches > 0 && gridDist(pos.x, pos.y, ePos.x, ePos.y) <= rangeInches) {
          pos.status = 'fighting';
          resolveEngagement(key, enemyKey, true);
          addNoise(NOISE_VALUES.shot, 'Shot');
        }
      }

      const fightDuration = (inMelee || inRange) ? 1200 : 500;
      setTimeout(() => {
        if (pos && pos.status !== 'routed') pos.status = 'idle';
        pos.frameIdx = 0;
      }, fightDuration);
    }

    // ═════════════════════════════════════════════════════════════════════════
    // MONSTER ALERT OVERLAY
    // ═════════════════════════════════════════════════════════════════════════

    function showMonsterAlert(monsterDef) {
      const overlay = document.createElement('div');
      overlay.className = 'cc-sim-monster-alert';
      overlay.innerHTML = `
        <div class="cc-sim-monster-dialog">
          <div style="font-size:2.5rem;margin-bottom:.5rem;">💀</div>
          <div style="font-size:1.2rem;font-weight:800;color:#ef5350;margin-bottom:.5rem;">ENCOUNTER!</div>
          <div style="font-size:1rem;color:#fff;margin-bottom:.25rem;">${monsterDef.name}</div>
          <div style="font-size:.8rem;color:#aaa;margin-bottom:1.2rem;">
            Q${monsterDef.quality} · M${monsterDef.move}"
            ${monsterDef.defense ? ' · D' + monsterDef.defense : ''}
            ${monsterDef.isTitan ? ' · TITAN' : ''}
          </div>
          ${monsterDef.special?.length ? `<div style="font-size:.75rem;color:#ff7518;margin-bottom:1rem;">${monsterDef.special.join(', ')}</div>` : ''}
          <button class="cc-btn" onclick="this.closest('.cc-sim-monster-alert').remove()" style="width:100%;">
            Understood
          </button>
        </div>`;
      document.body.appendChild(overlay);
      setTimeout(() => overlay.remove(), 6000);
    }

    // ═════════════════════════════════════════════════════════════════════════
    // HTML RENDER
    // ═════════════════════════════════════════════════════════════════════════

    function render() {
      if (_destroyed || !root) return;
      if      (state.phase === 'setup')   root.innerHTML = renderSetup();
      else if (state.phase === 'loading') root.innerHTML = renderLoading();
      else if (state.phase === 'playing') renderPlaying();
    }

    function renderSetup() {
      const loggedIn = !!window.CC_STORAGE;
      const scenarios = state.availableScenarios || [];
      const scenarioItems = scenarios.length
        ? scenarios.map(s => `
            <div class="cc-sim-scenario-card ${state.selectedScenarioId === s.id ? 'selected' : ''}"
                 onclick="window.CC_SIM.selectScenario(${s.id})">
              <div style="font-weight:700;color:var(--cc-text);">${s.name || 'Unnamed Scenario'}</div>
              <div style="font-size:.75rem;color:var(--cc-text-dim);margin-top:3px;">${s.factions ? s.factions.length + ' factions' : ''}</div>
            </div>`).join('')
        : `<div class="cc-sim-empty">No scenarios found in Odoo folder ${SCENARIO_FOLDER}.</div>`;

      return `
        <div style="padding:24px 20px;max-width:480px;margin:0 auto;animation:cc-fade-in .25s ease;">
          <div class="cc-sim-setup-title">🎮 Game Simulator</div>
          <div class="cc-sim-setup-sub">Load a saved scenario from Odoo to begin. All faction rosters will load automatically.</div>

          <div class="${loggedIn ? 'cc-login-status logged-in' : 'cc-login-status logged-out'}">
            <i class="fa ${loggedIn ? 'fa-check-circle' : 'fa-times-circle'}"></i>
            ${loggedIn ? 'Odoo connected' : 'Odoo not connected — CC_STORAGE missing'}
          </div>

          <div style="margin:16px 0 8px;font-size:.78rem;color:var(--cc-text-dim);text-transform:uppercase;letter-spacing:.07em;">
            Saved Scenarios
          </div>

          ${scenarios.length === 0 && loggedIn ? `
            <div style="margin-bottom:10px;">
              <button class="cc-btn cc-btn-secondary" onclick="window.CC_SIM.fetchScenarios()">
                <i class="fa fa-sync"></i> Load Scenarios
              </button>
            </div>` : ''}

          ${scenarioItems}

          ${state.selectedScenarioId ? `
            <div style="margin-top:20px;">
              <div style="margin-bottom:8px;font-size:.78rem;color:var(--cc-text-dim);text-transform:uppercase;letter-spacing:.07em;">
                Factions Playing
              </div>
              <div id="cc-sim-faction-toggles" style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:14px;">
                ${Object.entries(FACTION_META).map(([id, m]) =>
                  '<label style="display:flex;align-items:center;gap:5px;padding:4px 10px;border-radius:6px;border:1px solid ' + m.color + '33;cursor:pointer;font-size:.78rem;">' +
                  '<input type="checkbox" class="cc-sim-faction-check" value="' + id + '" checked style="accent-color:' + m.color + ';"> ' +
                  '<span style="color:' + m.color + ';font-weight:700;">' + m.name + '</span>' +
                  '</label>'
                ).join('')}
              </div>
              <div style="margin-bottom:8px;font-size:.78rem;color:var(--cc-text-dim);text-transform:uppercase;letter-spacing:.07em;">
                Map (optional)
              </div>
              <select id="cc-sim-map-id-input"
                style="width:100%;padding:8px 10px;background:var(--cc-bg-soft);border:1px solid var(--cc-border);
                       border-radius:6px;color:var(--cc-text);font-size:.85rem;margin-bottom:14px;cursor:pointer;">
                <option value="">-- No map --</option>
                ${MAP_LIST.map(m => '<option value="' + m.id + '">' + m.name + '</option>').join('')}
              </select>
              <div class="cc-sim-solo-faction-select">
                <label>Solo Mode (optional)</label>
                <select id="cc-sim-solo-select">
                  <option value="">-- Auto-simulate all factions --</option>
                  ${Object.entries(FACTION_META).map(([id, m]) => '<option value="' + id + '">' + m.name + '</option>').join('')}
                </select>
              </div>
              <button class="cc-btn" style="width:100%;" onclick="window.CC_SIM.launchSimulator()">
                <i class="fa fa-play"></i> Launch Simulator
              </button>
            </div>` : ''}
        </div>`;
    }

    function renderLoading() {
      return `
        <div class="cc-sim-loading-screen">
          <div class="cc-sim-loading-icon">⚙️</div>
          <div class="cc-sim-loading-text">${state.loadingMsg}</div>
        </div>`;
    }

    function renderPlaying() {
      // Build full simulator layout (only once — canvas persists in the map wrap)
      if (!document.getElementById('cc-sim-map-wrap')) {
        root.innerHTML =
          '<div class="cc-sim-layout" id="cc-sim-layout">' +

            '<!-- MAIN ROW -->' +
            '<div class="cc-sim-main-row">' +

              '<!-- LEFT SIDEBAR: Active Unit on top, Factions below -->' +
              '<div class="cc-sim-sidebar">' +
                '<div class="cc-sim-panel-header"><i class="fa fa-bolt"></i> Active Unit</div>' +
                '<div id="cc-sim-active-unit" style="overflow-y:auto;flex-shrink:0;border-bottom:1px solid var(--cc-border,#333);"></div>' +
                '<div class="cc-sim-panel-header"><i class="fa fa-users"></i> Factions</div>' +
                '<div class="cc-sim-sidebar-scroll" id="cc-sim-faction-list"></div>' +
              '</div>' +

              '<!-- MAP COLUMN -->' +
              '<div style="display:flex;flex-direction:column;flex:1;min-width:0;overflow:hidden;">' +
                '<!-- Controls bar above map -->' +
                '<div style="display:flex;align-items:center;gap:8px;padding:7px 12px;border-bottom:1px solid var(--cc-border,#333);flex-shrink:0;background:var(--cc-bg-darker,#0d0d0d);">' +
                  '<button class="cc-btn cc-btn-sm" id="cc-sim-next-btn" onclick="window.CC_SIM.nextActivation()">' +
                    '<i class="fa fa-step-forward"></i> <span id="cc-sim-next-label">Next</span>' +
                  '</button>' +
                  '<button class="cc-btn cc-btn-sm cc-btn-secondary" id="cc-sim-auto-btn" onclick="window.CC_SIM.toggleAuto()">' +
                    '<i class="fa fa-play"></i> Auto' +
                  '</button>' +
                  '<button class="cc-btn cc-btn-sm cc-btn-secondary" onclick="window.CC_SIM.zoomFit()">' +
                    '<i class="fa fa-compress"></i>' +
                  '</button>' +
                  '<div style="flex:1;text-align:center;font-family:var(--cc-font-display,serif);font-size:1rem;font-weight:800;color:#d4822a;letter-spacing:.05em;text-transform:uppercase;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' +
                    (state.scenarioName || '') +
                  '</div>' +
                  '<div style="display:flex;gap:6px;align-items:center;flex-shrink:0;">' +
                    '<div class="cc-sim-round-badge" id="cc-sim-round-badge">Round ' + state.round + '</div>' +
                    '<div class="cc-sim-round-badge" id="cc-sim-queue-badge" style="font-size:.75rem;"></div>' +
                  '</div>' +
                '</div>' +
                '<!-- Map canvas area -->' +
                '<div class="cc-sim-map-wrap" id="cc-sim-map-wrap" style="flex:1;min-height:0;">' +
                  '<div class="cc-sim-ruler-hud" id="cc-sim-ruler-hud"></div>' +
                  '<div class="cc-sim-waiting-badge" id="cc-sim-waiting-badge">Your turn &mdash; drag to move</div>' +
                '</div>' +
              '</div>' +

            '</div>' + // end main-row

            // spotlight canvas lives inside the roll dialog

            '<!-- LOG BAR (accordion at bottom) -->' +
            '<div class="cc-sim-log-bar" id="cc-sim-log-bar">' +
              '<div class="cc-sim-log-bar-ticker" onclick="window.CC_SIM.toggleLog()">' +
                '<span style="font-size:.7rem;color:var(--cc-text-dim,#888);text-transform:uppercase;letter-spacing:.08em;flex-shrink:0;">Log</span>' +
                '<span class="cc-sim-log-bar-latest" id="cc-sim-log-latest">—</span>' +
                '<span class="cc-sim-log-bar-chevron">&#9650;</span>' +
              '</div>' +
              '<div class="cc-sim-log-drawer" id="cc-sim-log-drawer">' +
                '<div class="cc-sim-log" id="cc-sim-log" style="padding:8px;"></div>' +
              '</div>' +
            '</div>' +

          '</div>';

        initCanvas();
      }

      // Update dynamic panels without destroying the canvas
      refreshFactionList();
      refreshActiveUnitPanel();
      refreshQueueBadge();
    }

    function refreshFactionList() {
      const el = document.getElementById('cc-sim-faction-list');
      if (!el) return;
      const curItem = currentQueueItem();
      el.innerHTML = state.factions.map(f => {
        const zone   = sim.factionZones[f.id];
        const active = getActiveUnits(f).length;
        const total  = f.allUnits.length;
        const isCur  = curItem && curItem.factionId === f.id;
        const style  = isCur ? '--active-color:' + f.color + ';border-left-color:' + f.color + ';' : '';
        return '<div class="cc-sim-faction-entry ' + (isCur ? 'is-active' : '') + '" style="' + style + '" onclick="window.CC_SIM.focusFaction(\'' + f.id + '\')">' +
          '<div class="cc-sim-faction-dot" style="background:' + f.color + ';box-shadow:0 0 6px ' + f.color + '66;color:' + f.color + ';"></div>' +
          '<div class="cc-sim-faction-name">' + f.name + '</div>' +
          '<div style="display:flex;flex-direction:column;align-items:flex-end;gap:2px;">' +
            '<div class="cc-sim-faction-count">' + active + '/' + total + '</div>' +
            (zone && zone.key ? '<div class="cc-sim-faction-zone-tag" style="background:' + f.color + '22;color:' + f.color + ';">' + zone.key.replace('_',' ') + '</div>' : '') +
          '</div>' +
        '</div>';
      }).join('');
    }

    let _previewAnimId   = null;
    let _spotlightAnimId = null;

    function showCombatSpotlight(attackerKey, defenderKey) {
      if (_spotlightAnimId) { cancelAnimationFrame(_spotlightAnimId); _spotlightAnimId = null; }
      if (!sim.spriteSheet || !sim.spriteData) return;

      const [aFid, aUid] = attackerKey.split('::');
      const [dFid, dUid] = defenderKey.split('::');
      const aFaction  = getFactionById(aFid);
      const dFaction  = getFactionById(dFid);
      const aColor    = (aFaction && aFaction.color) || '#ff7518';
      const dColor    = (dFaction && dFaction.color) || '#42a5f5';

      // Resolve animation names
      const aSet  = FACTION_SPRITE[aFid] || FACTION_SPRITE['encounters'];
      const dSet  = FACTION_SPRITE[dFid] || FACTION_SPRITE['encounters'];
      const aAnim = aSet && sim.spriteData[aSet.attack] ? sim.spriteData[aSet.attack] : null;
      const dAnim = dSet && sim.spriteData[dSet.attack] ? sim.spriteData[dSet.attack] : null;
      const aIdle = aSet && sim.spriteData[aSet.idle]   ? sim.spriteData[aSet.idle]   : null;
      const dIdle = dSet && sim.spriteData[dSet.idle]   ? sim.spriteData[dSet.idle]   : null;
      // Use attack anim if available, else fall back to idle
      const aDraw = aAnim || aIdle;
      const dDraw = dAnim || dIdle;

      let aFrame = 0, dFrame = 0, aTimer = 0, dTimer = 0, lastTs = 0;

      function drawFighter(ctx, anim, frame, cx, cy, r, color, flipX) {
        if (!anim || !anim.frames || !anim.frames[frame]) return;
        const f = anim.frames[frame % anim.frames.length];
        ctx.save();
        // Tinted bg circle
        ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.fillStyle = color + '44'; ctx.fill();
        // Clip to circle
        ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.clip();
        const sz = r * 2;
        if (flipX) {
          // Mirror: translate to cx, flip, draw centred
          ctx.translate(cx, cy);
          ctx.scale(-1, 1);
          ctx.drawImage(sim.spriteSheet, f.x, f.y, SPRITE_SRC_SIZE, SPRITE_SRC_SIZE,
            -r, -r, sz, sz);
        } else {
          ctx.drawImage(sim.spriteSheet, f.x, f.y, SPRITE_SRC_SIZE, SPRITE_SRC_SIZE,
            cx - r, cy - r, sz, sz);
        }
        ctx.restore();
        // Faction colour ring
        ctx.beginPath(); ctx.arc(cx, cy, r + 2, 0, Math.PI * 2);
        ctx.strokeStyle = color; ctx.lineWidth = 3; ctx.stroke();
      }

      function advanceAnim(anim, frame, timer, dt) {
        if (!anim || !anim.frames) return { frame, timer };
        timer += dt;
        const f = anim.frames[frame % anim.frames.length];
        if (f && timer >= f.duration) { timer -= f.duration; frame = (frame + 1) % anim.frames.length; }
        return { frame, timer };
      }

      function step(ts) {
        // Re-query canvas every frame — dialog may have been recreated
        const canvas = document.getElementById('cc-sim-spotlight-canvas');
        if (!canvas) { _spotlightAnimId = null; return; }
        const ctx = canvas.getContext('2d');
        const W = canvas.width, H = canvas.height;
        const dt = lastTs > 0 ? ts - lastTs : 16;
        lastTs = ts;

        const ra = advanceAnim(aDraw, aFrame, aTimer, dt);
        aFrame = ra.frame; aTimer = ra.timer;
        const rd = advanceAnim(dDraw, dFrame, dTimer, dt);
        dFrame = rd.frame; dTimer = rd.timer;

        // Dark background
        ctx.fillStyle = '#111'; ctx.fillRect(0, 0, W, H);

        // Divider
        ctx.strokeStyle = '#333'; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(W/2, 0); ctx.lineTo(W/2, H); ctx.stroke();

        const r = Math.min(W / 4 - 8, H / 2 - 8);
        drawFighter(ctx, aDraw, aFrame, W / 4,     H / 2, r, aColor, false);
        drawFighter(ctx, dDraw, dFrame, W * 3 / 4, H / 2, r, dColor, true);

        // VS
        ctx.fillStyle = '#fff'; ctx.font = 'bold 13px sans-serif';
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText('VS', W / 2, H / 2);

        _spotlightAnimId = requestAnimationFrame(step);
      }

      _spotlightAnimId = requestAnimationFrame(step);
      // Stop when roll dialog dismisses (auto at 4.5s + fade 0.65s)
      setTimeout(() => { if (_spotlightAnimId) { cancelAnimationFrame(_spotlightAnimId); _spotlightAnimId = null; } }, 5200);
    }

    function startUnitPreview(fid, uid, status) {
      // Animate the small sprite canvas in the active unit panel
      const previewCanvas = document.getElementById('cc-sim-unit-preview');
      if (!previewCanvas || !sim.spriteSheet || !sim.spriteData) return;
      if (_previewAnimId) cancelAnimationFrame(_previewAnimId);

      const ctx    = previewCanvas.getContext('2d');
      const W      = previewCanvas.width;
      const H      = previewCanvas.height;
      const animSet = FACTION_SPRITE[fid] || FACTION_SPRITE['encounters'];
      const animName = animSet ? animSet[status === 'fighting' ? 'attack' : 'idle'] : null;
      if (!animName || !sim.spriteData[animName]) return;

      const anim = sim.spriteData[animName];
      let frameIdx  = 0;
      let lastTime  = 0;
      let frameTimer = 0;

      function step(ts) {
        if (!document.getElementById('cc-sim-unit-preview')) return;
        frameTimer += ts - lastTime;
        lastTime    = ts;
        const frame = anim.frames[frameIdx % anim.frames.length];
        if (frame && frameTimer >= frame.duration) {
          frameTimer = 0;
          frameIdx   = (frameIdx + 1) % anim.frames.length;
        }
        ctx.clearRect(0, 0, W, H);
        if (frame) {
          ctx.drawImage(sim.spriteSheet, frame.x, frame.y, 20, 20, 0, 0, W, H);
        }
        _previewAnimId = requestAnimationFrame(step);
      }
      _previewAnimId = requestAnimationFrame(step);
    }

    function refreshActiveUnitPanel() {
      const el = document.getElementById('cc-sim-active-unit');
      if (!el) return;
      const curItem = currentQueueItem();
      if (!curItem) {
        el.innerHTML = '<div class="cc-sim-empty" style="color:#ffd600;">Round ' + state.round + ' complete! Press NEXT to begin Round ' + (state.round+1) + '.</div>';
        return;
      }
      const faction = getFactionById(curItem.factionId);
      const unit    = getUnitById(faction, curItem.unitId);
      const us      = getUnitState(curItem.factionId, curItem.unitId);
      if (!faction || !unit || !us) return;

      const color  = faction.color || '#888';
      const maxQ   = unit.quality || 1;
      const curQ   = us.quality   || 0;
      const dots   = Array.from({ length: maxQ }, (_, i) =>
        `<div class="cc-sim-health-dot ${i < curQ ? 'filled' : 'empty'}" style="${i < curQ ? 'border-color:' + color + ';background:' + color + ';' : ''}"></div>`
      ).join('');

      const abilities = Array.isArray(unit.special) && unit.special.length
        ? `<div class="cc-sim-abilities">${unit.special.map(a =>
            `<span class="cc-sim-ability-tag">${typeof a === 'string' ? a : (a.name || a)}</span>`
          ).join('')}</div>`
        : '';

      el.innerHTML = `
        <div class="cc-sim-active-card">
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;cursor:pointer;" onclick="window.CC_SIM.zoomToUnit('${unitKey(faction.id, unit.id)}')">
            <div style="width:8px;height:8px;border-radius:50%;background:${color};box-shadow:0 0 8px ${color};flex-shrink:0;"></div>
            <div>
              <div class="cc-sim-active-name">${unit.name}</div>
              <div class="cc-sim-active-faction">${faction.name}</div>
            </div>
          </div>
          <div class="cc-sim-health-track">${dots}</div>
          ${us.shaken   ? '<div style="color:#ffd600;font-size:.75rem;font-weight:700;margin:4px 0;">⚡ SHAKEN (-1 die)</div>' : ''}
          ${us.panicked ? '<div style="color:#ef5350;font-size:.75rem;font-weight:700;margin:4px 0;">💀 PANICKED</div>' : ''}
          <div class="cc-sim-stat-row">
            ${unit.move    ? `<span class="cc-sim-stat-pill move"><i class="fa fa-shoe-prints"></i> ${unit.move}"</span>` : ''}
            ${unit.defense ? `<span class="cc-sim-stat-pill defense"><i class="fa fa-shield-alt"></i> D${unit.defense}</span>` : ''}
            ${unit.range   ? `<span class="cc-sim-stat-pill range"><i class="fa fa-crosshairs"></i> ${unit.range}"</span>` : ''}
            ${unit.cost    ? `<span class="cc-sim-stat-pill cost">${unit.cost}pts</span>` : ''}
          </div>
          ${abilities}
          ${unit.weapon ? '<div style="font-size:.74rem;color:#9e8e78;margin-top:6px;font-style:italic;">' + unit.weapon + '</div>' : ''}
          <canvas id="cc-sim-unit-preview" width="80" height="80" style="display:block;margin:8px auto 0;border-radius:50%;border:2px solid ${color};background:${color}22;"></canvas>
          ${unit.lore ? `<div style="font-size:.73rem;color:var(--cc-text-dim);margin-top:8px;line-height:1.5;font-style:italic;">${unit.lore.slice(0,140)}${unit.lore.length>140?'…':''}</div>` : ''}
          <div style="margin-top:10px;display:flex;gap:6px;flex-wrap:wrap;">
            <button class="cc-btn cc-btn-sm" onclick="window.CC_SIM.activateAndAdvance()">
              <i class="fa fa-bolt"></i> Activate
            </button>
            <button class="cc-btn cc-btn-sm cc-btn-secondary" onclick="window.CC_SIM.markOut('${curItem.factionId}','${curItem.unitId}')">
              Out
            </button>
          </div>
        </div>`;
    }

    function refreshQueueBadge() {
      const el       = document.getElementById('cc-sim-queue-badge');
      const roundEl  = document.getElementById('cc-sim-round-badge');
      const labelEl  = document.getElementById('cc-sim-next-label');
      const remaining = state.queue.length - state.queueIndex;
      const complete  = remaining <= 0;
      if (el)      el.textContent = complete ? 'Round ' + state.round + ' complete' : remaining + ' activations left';
      if (roundEl) roundEl.textContent = 'Round ' + state.round;
      if (labelEl) labelEl.textContent = complete ? 'New Round' : 'Next';
    }

    // ═════════════════════════════════════════════════════════════════════════
    // CONTROLS — public CC_SIM.* functions
    // ═════════════════════════════════════════════════════════════════════════

    let _zoomTimer = null;

    window.CC_SIM.zoomToUnit = function(key) {
      if (!sim.canvas) return;
      const pos = sim.unitPositions[key];
      if (!pos) return;

      // Save original view
      const origScale = sim.viewScale;
      const origX     = sim.viewX;
      const origY     = sim.viewY;
      const targetScale = Math.min(1.2, origScale * 4); // zoom to 4x current, max 1.2
      const targetX   = sim.canvas.width  / 2 - pos.x * targetScale;
      const targetY   = sim.canvas.height / 2 - pos.y * targetScale;

      // Eased zoom in
      const STEPS  = 30;
      const DELAY  = 16;
      let   step   = 0;

      if (_zoomTimer) clearInterval(_zoomTimer);
      _zoomTimer = setInterval(() => {
        step++;
        const t = step / STEPS;
        const ease = t < 0.5 ? 2*t*t : -1+(4-2*t)*t; // ease in-out quad
        sim.viewScale = origScale + (targetScale - origScale) * ease;
        sim.viewX     = origX     + (targetX     - origX)     * ease;
        sim.viewY     = origY     + (targetY     - origY)     * ease;
        if (step >= STEPS) {
          clearInterval(_zoomTimer);
          // Hold for 1.5s then zoom back out
          setTimeout(() => {
            step = 0;
            _zoomTimer = setInterval(() => {
              step++;
              const t2   = step / STEPS;
              const ease2 = t2 < 0.5 ? 2*t2*t2 : -1+(4-2*t2)*t2;
              sim.viewScale = targetScale + (origScale - targetScale) * ease2;
              sim.viewX     = targetX     + (origX     - targetX)     * ease2;
              sim.viewY     = targetY     + (origY     - origY)       * ease2;
              // Just lerp back to original
              sim.viewScale = targetScale + (origScale - targetScale) * ease2;
              sim.viewX     = targetX + (origX - targetX) * ease2;
              sim.viewY     = targetY + (origY - targetY) * ease2;
              if (step >= STEPS) clearInterval(_zoomTimer);
            }, DELAY);
          }, 1500);
        }
      }, DELAY);
    };

    window.CC_SIM.showUnitInspector = function(key) {
      const existing = document.getElementById('cc-sim-unit-inspector');
      if (existing) existing.remove();

      const [fid, uid] = key.split('::');
      const faction = getFactionById(fid);
      const unit    = getUnitById(faction, uid);
      const us      = getUnitState(fid, uid);
      if (!unit) return;

      const color   = (faction && faction.color) || '#ff7518';
      const curQ    = us ? (us.quality || 0) : (unit.quality || 0);
      const maxQ    = unit.quality || 0;
      const isOut   = us && us.out;
      const shaken  = us && us.shaken;
      const panicked= us && us.panicked;

      // Build quality dots
      const qDots = Array.from({ length: maxQ }, (_, i) =>
        '<span style="display:inline-block;width:11px;height:11px;border-radius:50%;margin:0 2px;' +
        'background:' + (i < curQ ? color : '#333') + ';' +
        'box-shadow:' + (i < curQ ? '0 0 4px ' + color : 'none') + ';"></span>'
      ).join('');

      // Build special abilities list
      const specials = (unit.special || []);
      const specialHtml = specials.length ? specials.map(s => {
        const name = typeof s === 'string' ? s : (s.name || '');
        const desc = typeof s === 'object' ? (s.description || s.effect || '') : '';
        return '<div style="margin-bottom:8px;">' +
          '<div style="font-size:.78rem;font-weight:700;color:' + color + ';">' + name + '</div>' +
          (desc ? '<div style="font-size:.72rem;color:#999;margin-top:2px;line-height:1.5;">' + desc + '</div>' : '') +
          '</div>';
      }).join('') : '<div style="color:#555;font-size:.75rem;">No special abilities</div>';

      // Status tags
      let statusHtml = '';
      if (isOut)    statusHtml += '<span style="background:#ef535022;color:#ef9090;border:1px solid #ef535055;border-radius:4px;padding:2px 8px;font-size:.72rem;margin-right:4px;">OUT</span>';
      if (shaken)   statusHtml += '<span style="background:#fb8c0022;color:#ffb74d;border:1px solid #fb8c0055;border-radius:4px;padding:2px 8px;font-size:.72rem;margin-right:4px;">SHAKEN</span>';
      if (panicked) statusHtml += '<span style="background:#ffd60022;color:#fff176;border:1px solid #ffd60055;border-radius:4px;padding:2px 8px;font-size:.72rem;">PANICKED</span>';

      // Weapon properties
      const wpProps = (unit.weapon_properties || []);
      const wpHtml = wpProps.length
        ? wpProps.map(p => '<span style="font-size:.7rem;background:#ffffff11;border-radius:3px;padding:1px 6px;margin-right:3px;color:#ccc;">' + p + '</span>').join('')
        : '';

      const overlay = document.createElement('div');
      overlay.id = 'cc-sim-unit-inspector';
      overlay.style.cssText = 'position:fixed;inset:0;z-index:10010;background:rgba(0,0,0,0.8);display:flex;align-items:center;justify-content:center;animation:cc-fade-in .15s ease;';
      overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });

      overlay.innerHTML =
        '<div style="background:#141414;border:1px solid ' + color + '44;border-radius:14px;' +
        'width:min(420px,92vw);max-height:85vh;overflow-y:auto;box-shadow:0 8px 40px #000c;">' +

          // Header
          '<div style="display:flex;align-items:center;gap:12px;padding:1.25rem 1.5rem 1rem;border-bottom:1px solid #222;">' +
            '<div style="width:44px;height:44px;border-radius:50%;background:' + color + '22;border:2px solid ' + color + ';' +
              'display:flex;align-items:center;justify-content:center;flex-shrink:0;">' +
              '<canvas id="cc-inspector-sprite" width="44" height="44"></canvas>' +
            '</div>' +
            '<div style="flex:1;min-width:0;">' +
              '<div style="font-size:1.05rem;font-weight:800;color:#fff;">' + unit.name + '</div>' +
              '<div style="font-size:.78rem;color:' + color + ';margin-top:1px;">' + (faction ? faction.name : '') + '</div>' +
            '</div>' +
            '<button onclick="document.querySelector(\"#cc-sim-unit-inspector\").remove()" ' +
              'style="background:none;border:none;color:#666;font-size:1.3rem;cursor:pointer;padding:4px;line-height:1;">&times;</button>' +
          '</div>' +

          // Quality bar
          '<div style="padding:1rem 1.5rem;border-bottom:1px solid #1e1e1e;">' +
            '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px;">' +
              '<span style="font-size:.7rem;text-transform:uppercase;letter-spacing:.08em;color:#666;">Quality</span>' +
              '<span style="font-size:.8rem;color:#ccc;">' + curQ + ' / ' + maxQ + '</span>' +
            '</div>' +
            '<div>' + qDots + '</div>' +
            (statusHtml ? '<div style="margin-top:8px;">' + statusHtml + '</div>' : '') +
          '</div>' +

          // Stats grid
          '<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:1px;background:#1a1a1a;border-bottom:1px solid #1a1a1a;">' +
            _statCell('Move', (unit.move || 6) + '"', '#42a5f5') +
            _statCell('Defense', unit.defense ? 'D' + unit.defense : '—', '#ef5350') +
            _statCell('Range', unit.range ? unit.range + '"' : '—', '#ff7518') +
          '</div>' +

          // Cost
          (unit.cost ? '<div style="padding:.6rem 1.5rem;border-bottom:1px solid #1a1a1a;font-size:.75rem;color:#666;">' +
            '<span style="color:#aaa;font-weight:700;">' + unit.cost + ' pts</span>' +
          '</div>' : '') +

          // Weapon
          (unit.weapon ? '<div style="padding:.75rem 1.5rem;border-bottom:1px solid #1a1a1a;">' +
            '<div style="font-size:.7rem;text-transform:uppercase;letter-spacing:.08em;color:#666;margin-bottom:4px;">Weapon</div>' +
            '<div style="font-size:.85rem;color:#ddd;font-weight:600;">' + unit.weapon + '</div>' +
            (wpHtml ? '<div style="margin-top:5px;">' + wpHtml + '</div>' : '') +
          '</div>' : '') +

          // Special abilities
          '<div style="padding:.75rem 1.5rem;border-bottom:1px solid #1a1a1a;">' +
            '<div style="font-size:.7rem;text-transform:uppercase;letter-spacing:.08em;color:#666;margin-bottom:8px;">Abilities</div>' +
            specialHtml +
          '</div>' +

          // Lore
          (unit.lore ? '<div style="padding:.75rem 1.5rem;">' +
            '<div style="font-size:.7rem;text-transform:uppercase;letter-spacing:.08em;color:#666;margin-bottom:6px;">Lore</div>' +
            '<div style="font-size:.78rem;color:#888;line-height:1.6;font-style:italic;">' + unit.lore + '</div>' +
          '</div>' : '') +

        '</div>';

      document.body.appendChild(overlay);

      // Animate sprite in inspector
      _startInspectorSprite(fid, uid, 'idle');
    };

    function _statCell(label, value, color) {
      return '<div style="background:#141414;padding:.7rem .5rem;text-align:center;">' +
        '<div style="font-size:.65rem;text-transform:uppercase;letter-spacing:.07em;color:#555;margin-bottom:3px;">' + label + '</div>' +
        '<div style="font-size:1rem;font-weight:800;color:' + color + ';">' + value + '</div>' +
      '</div>';
    }

    let _inspectorAnimId = null;
    function _startInspectorSprite(fid, uid, status) {
      if (_inspectorAnimId) { cancelAnimationFrame(_inspectorAnimId); _inspectorAnimId = null; }
      if (!sim.spriteSheet || !sim.spriteData) return;
      const animSet  = FACTION_SPRITE[fid] || FACTION_SPRITE['encounters'];
      const animName = animSet ? animSet[status] || animSet.idle : null;
      const anim     = animName && sim.spriteData[animName] ? sim.spriteData[animName] : null;
      if (!anim) return;
      let frame = 0, timer = 0, lastTs = 0;
      function step(ts) {
        const canvas = document.getElementById('cc-inspector-sprite');
        if (!canvas) { _inspectorAnimId = null; return; }
        const ctx = canvas.getContext('2d');
        const dt  = lastTs > 0 ? ts - lastTs : 16; lastTs = ts;
        timer += dt;
        const f = anim.frames[frame % anim.frames.length];
        if (f && timer >= f.duration) { timer -= f.duration; frame = (frame + 1) % anim.frames.length; }
        ctx.clearRect(0, 0, 44, 44);
        if (f) ctx.drawImage(sim.spriteSheet, f.x, f.y, SPRITE_SRC_SIZE, SPRITE_SRC_SIZE, 0, 0, 44, 44);
        _inspectorAnimId = requestAnimationFrame(step);
      }
      _inspectorAnimId = requestAnimationFrame(step);
    }

    window.CC_SIM.toggleLog = function() {
      const bar = document.getElementById('cc-sim-log-bar');
      if (bar) bar.classList.toggle('open');
    };

    function showDeathCallout(unitName, faction) {
      const color = (faction && faction.color) || '#ef5350';
      const el = document.createElement('div');
      el.style.cssText = 'position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);' +
        'background:rgba(0,0,0,0.92);border:2px solid ' + color + ';border-radius:10px;' +
        'padding:1rem 2rem;z-index:10002;text-align:center;animation:cc-fade-in .15s ease;pointer-events:none;';
      el.innerHTML = '<div style="font-size:2rem;margin-bottom:.25rem;">☠</div>' +
        '<div style="font-size:1.1rem;font-weight:800;color:' + color + ';">' + unitName + '</div>' +
        '<div style="font-size:.8rem;color:#aaa;margin-top:.2rem;">is KILLED</div>';
      document.body.appendChild(el);
      setTimeout(() => el.remove(), 2200);
    }

    window.CC_SIM.closeRollDialog = function() {
      const o = document.getElementById('cc-sim-roll-overlay');
      if (o && o._dismiss) o._dismiss();
      else if (o) o.remove();
    };

    window.CC_SIM.showSoloActionMenu = function(key) {
      // Show action choice for solo player unit
      const [fid, uid] = key.split('::');
      const faction = getFactionById(fid);
      const unit    = getUnitById(faction, uid);
      const us      = getUnitState(fid, uid);
      if (!unit || !us) return;

      const color = (faction && faction.color) || '#ff7518';
      const existing = document.getElementById('cc-sim-solo-action-menu');
      if (existing) existing.remove();

      // Find enemies in range
      const pos = sim.unitPositions[key];
      const rangeInches = unit.range || 0;
      const enemies = [];
      Object.entries(sim.unitPositions).forEach(([eKey, ePos]) => {
        if (!ePos || ePos.status === 'routed') return;
        const [eFid] = eKey.split('::');
        if (eFid === fid) return;
        const dist = gridDist(pos.x, pos.y, ePos.x, ePos.y);
        const eFaction = getFactionById(eFid);
        const eUnit    = getUnitById(eFaction, eKey.split('::')[1]);
        if (!eUnit) return;
        if (isGridAdjacent(pos.x, pos.y, ePos.x, ePos.y)) {
          enemies.push({ key: eKey, name: eUnit.name, type: 'melee', dist });
        } else if (rangeInches > 0 && dist <= rangeInches) {
          enemies.push({ key: eKey, name: eUnit.name, type: 'ranged', dist });
        }
      });

      const menu = document.createElement('div');
      menu.id = 'cc-sim-solo-action-menu';
      menu.style.cssText = 'position:fixed;inset:0;z-index:10003;background:rgba(0,0,0,0.75);display:flex;align-items:center;justify-content:center;';

      let buttonsHtml = '';
      if (enemies.length > 0) {
        enemies.forEach(e => {
          const icon = e.type === 'ranged' ? 'fa-crosshairs' : 'fa-sword';
          buttonsHtml += '<button class="cc-btn" style="width:100%;margin-bottom:6px;background:' + color + '22;color:' + color + ';border:1px solid ' + color + ';" ' +
            'onclick="window.CC_SIM.soloAttack(this)" data-akey="' + key + '" data-dkey="' + e.key + '" data-type="' + e.type + '">' +
            '<i class="fa ' + icon + '"></i> ' + (e.type === 'ranged' ? 'Shoot' : 'Melee') + ': ' + e.name + ' (' + e.dist + '")</button>';
        });
      }

      // Ability buttons for mystic/special units
      const abilities = (unit.special || []).filter(a => {
        const n = (typeof a === 'string' ? a : (a.name || '')).toLowerCase();
        return n.includes('hex') || n.includes('ritual') || n.includes('curse') ||
               n.includes('charm') || n.includes('inspire') || n.includes('rally');
      });
      abilities.forEach(a => {
        const name = typeof a === 'string' ? a : (a.name || a);
        buttonsHtml += '<button class="cc-btn cc-btn-secondary" style="width:100%;margin-bottom:6px;" ' +
          'onclick="window.CC_SIM.soloAbility(this)" data-key="' + key + '" data-ability="' + name + '">' +
          '<i class="fa fa-magic"></i> ' + name + '</button>';
      });

      buttonsHtml += '<button class="cc-btn cc-btn-secondary" style="width:100%;margin-top:6px;" ' +
        'onclick="window.CC_SIM.soloSkipAction(this)" data-key="' + key + '">' +
        '<i class="fa fa-forward"></i> Skip / Hold</button>';

      menu.innerHTML = '<div style="background:var(--cc-bg-darker,#0d0d0d);border:1px solid ' + color + ';border-radius:12px;padding:1.5rem;min-width:280px;max-width:380px;">' +
        '<div style="font-size:1rem;font-weight:700;color:#fff;margin-bottom:1rem;">' + unit.name + ' — Choose Action</div>' +
        buttonsHtml + '</div>';
      document.body.appendChild(menu);
    };

    window.CC_SIM.soloAttack = function(btnOrKey, defenderKey, type) {
      const menu = document.getElementById('cc-sim-solo-action-menu');
      // Support both direct call and data-attribute button call
      let attackerKey = btnOrKey;
      if (btnOrKey && btnOrKey.dataset) {
        attackerKey = btnOrKey.dataset.akey;
        defenderKey = btnOrKey.dataset.dkey;
        type        = btnOrKey.dataset.type;
      }
      if (menu) menu.remove();
      const aPos = sim.unitPositions[attackerKey];
      if (aPos) aPos.status = 'fighting';
      resolveEngagement(attackerKey, defenderKey, true);
      addNoise(type === 'ranged' ? NOISE_VALUES.shot : NOISE_VALUES.melee, type);
      setTimeout(() => window.CC_SIM.soloMoveComplete(), 800);
    };

    window.CC_SIM.soloAbility = function(btnOrKey, abilityName) {
      let key = btnOrKey;
      if (btnOrKey && btnOrKey.dataset) { key = btnOrKey.dataset.key; abilityName = btnOrKey.dataset.ability; }
      const menu = document.getElementById('cc-sim-solo-action-menu');
      if (menu) menu.remove();
      applyAbilityEffect(key, abilityName || '');
      setTimeout(() => window.CC_SIM.soloMoveComplete(), 600);
    };

    window.CC_SIM.soloSkipAction = function(btnOrKey) {
      let key = btnOrKey;
      if (btnOrKey && btnOrKey.dataset) key = btnOrKey.dataset.key;
      const menu = document.getElementById('cc-sim-solo-action-menu');
      if (menu) menu.remove();
      window.CC_SIM.soloMoveComplete();
    };

    function applyAbilityEffect(attackerKey, abilityName) {
      // Apply mechanical effects of abilities per rules
      const [aFid, aUid] = attackerKey.split('::');
      const attackerUnit  = getUnitById(getFactionById(aFid), aUid);
      const attackerState = getUnitState(aFid, aUid);
      if (!attackerUnit || !attackerState) return;

      const name = abilityName.toLowerCase();

      // Find nearest enemy for targeted abilities
      const pos = sim.unitPositions[attackerKey];
      const { key: enemyKey } = pos ? findNearestEnemy(aFid, pos) : { key: null };

      if (name.includes('hex') || name.includes('curse') || name.includes('charm')) {
        // Targeted debuff — apply shaken to nearest enemy
        if (enemyKey) {
          const [eFid, eUid] = enemyKey.split('::');
          applyShaken(eFid, eUid);
          const eName = getUnitById(getFactionById(eFid), eUid)?.name || 'enemy';
          simLog(attackerUnit.name + ' hexes ' + eName + '!', 'event');
        }
        addNoise(NOISE_VALUES.ritual, abilityName);
      } else if (name.includes('ritual') || name.includes('unleashed')) {
        // Ritual/wild magic — roll on wild magic table
        const roll = Math.floor(Math.random() * 11) + 2; // 2d6 simplified
        simLog(attackerUnit.name + ' channels ' + abilityName + '! (Roll ' + roll + ')', 'event');
        if (enemyKey && roll >= 6) {
          const dmg = roll >= 10 ? 3 : roll >= 8 ? 2 : 1;
          const [eFid, eUid] = enemyKey.split('::');
          const eState = getUnitState(eFid, eUid);
          if (eState) {
            const newQ = Math.max(0, eState.quality - dmg);
            setUnitState(eFid, eUid, { quality: newQ });
            const eName = getUnitById(getFactionById(eFid), eUid)?.name || 'enemy';
            simLog(eName + ' takes ' + dmg + ' magic damage! (Q' + newQ + ' left)', 'combat');
            if (newQ <= 0) {
              setUnitState(eFid, eUid, { out: true });
              const ePos = sim.unitPositions[enemyKey];
              if (ePos) { ePos.status = 'routed'; sim.deathMarkers.push({ x: ePos.x, y: ePos.y, name: eName }); }
              showDeathCallout(eName, getFactionById(eFid));
            }
          }
        }
        addNoise(NOISE_VALUES.ritual, abilityName);
      } else if (name.includes('inspire') || name.includes('rally') || name.includes('calamity')) {
        // Buff nearby allies — remove shaken from nearby friendlies
        let healed = 0;
        Object.entries(sim.unitPositions).forEach(([k, p]) => {
          if (!p || p.status === 'routed') return;
          const [fid] = k.split('::');
          if (fid !== aFid) return;
          const dist = gridDist(p.x, p.y, pos.x, pos.y);
          if (dist <= 6) {
            const [, uid] = k.split('::');
            const us = getUnitState(fid, uid);
            if (us && us.shaken) { setUnitState(fid, uid, { shaken: false }); healed++; }
          }
        });
        simLog(attackerUnit.name + ' rallies allies! ' + (healed ? '(' + healed + ' Shaken removed)' : ''), 'event');
        addNoise(NOISE_VALUES.ability, abilityName);
      }
    }

    window.CC_SIM.soloMoveComplete = function() {
      // Called after player finishes dragging their unit
      const cur = currentQueueItem();
      if (!cur) return;
      // Check for engagement after move
      const key = unitKey(cur.factionId, cur.unitId);
      const pos = sim.unitPositions[key];
      if (pos) {
        const { key: enemyKey, dist: enemyDist } = findNearestEnemy(cur.factionId, pos);
        if (enemyKey && enemyDist <= ENGAGEMENT_PX) {
          resolveEngagement(key, enemyKey, true);
          addNoise(NOISE_VALUES.melee, 'Melee');
        }
      }
      sim.soloWaiting = false;
      const waitEl = document.getElementById('cc-sim-waiting-badge');
      if (waitEl) waitEl.classList.remove('visible');
      // Advance to next unit
      setTimeout(() => window.CC_SIM.nextActivation(), 800);
    };

    window.CC_SIM.nextActivation = function() {
      if (isRoundComplete()) {
        startNewRound();
        render();
        return;
      }
      advanceQueue();

      const cur = currentQueueItem();

      // Solo mode: if this unit belongs to the player, wait for drag input
      if (cur && sim.soloFactionId && cur.factionId === sim.soloFactionId) {
        sim.soloMovedThisTurn = false;  // reset for new activation
        sim.soloWaiting = true;
        const waitEl = document.getElementById('cc-sim-waiting-badge');
        if (waitEl) waitEl.classList.add('visible');
      } else {
        sim.soloWaiting = false;
        const waitEl = document.getElementById('cc-sim-waiting-badge');
        if (waitEl) waitEl.classList.remove('visible');
      }

      // Smooth camera follow
      if (cur) smoothCameraToUnit(unitKey(cur.factionId, cur.unitId));

      refreshActiveUnitPanel();
      refreshFactionList();
      refreshQueueBadge();
      // Start sprite preview animation for active unit
      const _cur = currentQueueItem();
      if (_cur) startUnitPreview(_cur.factionId, _cur.unitId, 'idle');
    };

    window.CC_SIM.activateAndAdvance = function(callback) {
      const cur = currentQueueItem();
      if (!cur) { if (callback) callback(); return; }

      // Skip solo player's units — they control manually
      if (sim.soloFactionId && cur.factionId === sim.soloFactionId) {
        window.CC_SIM.nextActivation();
        if (callback) callback();
        return;
      }

      const key = unitKey(cur.factionId, cur.unitId);
      const pos = sim.unitPositions[key];
      const unit = getUnitById(getFactionById(cur.factionId), cur.unitId);

      // Camera first — center on this unit before it acts
      smoothCameraToUnit(key);

      // Short delay so camera settles, then animate movement
      setTimeout(() => {
        if (pos) pos.status = 'moving';
        simulateActivation(cur.factionId, cur.unitId);
        // Wait for movement animation to finish, THEN advance
        const moveDuration = unit ? Math.max(600, (unit.move || 6) * 80) : 800;
        setTimeout(() => {
          window.CC_SIM.nextActivation();
          if (callback) callback();
        }, moveDuration);
      }, 350);
    };

    window.CC_SIM.markOut = function(fid, uid) {
      setUnitState(fid, uid, { out: true });
      const pos = sim.unitPositions[unitKey(fid, uid)];
      if (pos) pos.status = 'routed';
      const faction = getFactionById(fid);
      const unit    = getUnitById(faction, uid);
      simLog(`${unit?.name || uid} marked as OUT.`, 'combat');
      window.CC_SIM.nextActivation();
    };

    window.CC_SIM.addNoise = function(amount, label) {
      addNoise(amount, label || 'Manual');
      refreshNoiseBars();
    };

    window.CC_SIM.rollEvent = function() {
      const ev = rollCanyonEvent();
      if (!ev) simLog('[Event] Nothing happens this round.', 'event');
    };

    window.CC_SIM.selectScenario = function(id) {
      state.selectedScenarioId = id;
      render();
    };

    window.CC_SIM.fetchScenarios = async function() {
      if (!window.CC_STORAGE) { render(); return; }
      state.loadingMsg = 'Fetching scenarios…';
      state.phase = 'loading';
      render();
      try {
        // CC_STORAGE uses loadDocumentList() — filter to SCN_ files only (same as turn counter)
        const allDocs = await window.CC_STORAGE.loadDocumentList(SCENARIO_FOLDER);
        // Case-insensitive match — handles both SCN_ and scn_ prefixes
        const scenarios = (allDocs || []).filter(d => d.name && d.name.toLowerCase().indexOf('scn_') === 0);
        state.availableScenarios = scenarios.map(d => ({
          id:   d.id,
          // Strip SCN_ prefix, timestamp suffix, underscores — same as turn counter
          name: d.name.replace(/^scn_/i, '').replace(/_\d{13}(\.json)?$/i, '').replace(/\.json$/i, '').replace(/_/g, ' ').trim() || 'Scenario ' + d.id,
          date: d.write_date ? new Date(d.write_date).toLocaleDateString() : '',
        }));
      } catch (e) { console.warn('fetchScenarios error:', safeErr(e)); state.availableScenarios = []; }
      state.phase = 'setup';
      render();
    };

    window.CC_SIM.launchSimulator = async function() {
      if (!state.selectedScenarioId) return;
      // Grab mapId from input BEFORE we replace the setup screen
      const mapIdInput  = document.getElementById('cc-sim-map-id-input');
      const mapIdValue  = (mapIdInput  ? mapIdInput.value  : '').trim();
      const soloInput   = document.getElementById('cc-sim-solo-select');
      sim.soloFactionId = (soloInput   ? soloInput.value   : '') || null;
      // Read faction checkboxes — unchecked = exclude from sim
      const factionChecks = document.querySelectorAll('.cc-sim-faction-check');
      const enabledFactions = new Set();
      factionChecks.forEach(cb => { if (cb.checked) enabledFactions.add(cb.value); });
      sim.enabledFactions = enabledFactions.size > 0 ? enabledFactions : null; // null = all
      if (sim.soloFactionId) simLog('Solo mode: you control ' + (FACTION_META[sim.soloFactionId] && FACTION_META[sim.soloFactionId].name || sim.soloFactionId), 'deploy');
      state.phase      = 'loading';
      state.loadingMsg = 'Loading scenario…';
      render();

      try {
        // 1. Load scenario
        const rawScenario = await safeLoadDocument(state.selectedScenarioId);
        const scenario    = docToJson(rawScenario);
        if (!scenario) throw new Error('Scenario data empty');
        // Scenario builder wraps data as { scenario: {...}, factions: [...], name, danger, ... }
        // Turn counter uses: payload.scenario for the actual scenario, payload.factions for faction list
        const payload = scenario;
        state.scenarioSave   = payload.scenario || payload;
        state.scenarioName   = payload.name || (payload.scenario && payload.scenario.name) || 'Scenario';
        state.round          = 1;
        state.noiseThreshold = 8 + ((payload.danger || (payload.scenario && payload.scenario.danger_rating) || 3) * 2);
        const mp = state.scenarioSave && state.scenarioSave.monster_pressure;
        state.monsterRoster  = (mp && mp.monsters) || [];

        // 2. Load factions — mirrors turn counter logic exactly
        // Scenario save has: factions: [{ id, npc }]
        // We then load saved rosters from Odoo folder 90 (non-SCN_ files)
        state.loadingMsg = 'Loading faction rosters...';
        render();

        const rawFactions = payload.factions || (payload.scenario && payload.scenario.factions) || [];
        const pendingFactions = rawFactions
          .map(f => ({ id: f.id, npc: f.npc !== undefined ? f.npc : (f.isNPC !== undefined ? f.isNPC : true) }))
          .filter(f => !!FACTION_META[f.id]);

        // Load all non-SCN docs from folder 90 to find matching rosters
        let factionSaveDocs = [];
        if (window.CC_STORAGE) {
          try {
            const allDocs2 = await window.CC_STORAGE.loadDocumentList(FACTION_SAVE_FOLDER).catch(() => []);
            const nonScenario = (allDocs2 || []).filter(d => d.name && d.name.toLowerCase().indexOf('scn_') !== 0);
            factionSaveDocs = await Promise.all(nonScenario.map(async d => {
              const parsed = await safeLoadDocument(d.id);
              const data   = parsed ? docToJson(parsed) : null;
              if (data) {
                d._factionId = data.faction || null;
                d._armyName  = data.armyName || data.name || null;
                d._data      = data;
              }
              return d;
            }));
          } catch (e) { console.warn('Faction save list failed:', safeErr(e)); }
        }

        const loadedFactions = [];

        for (const fDef of pendingFactions) {
          const fid = fDef.id;
          let faction = null;

          // Match saved roster by faction id — prefer one matching the scenario point value
          const pts = payload.pts || 0;
          const matches = factionSaveDocs.filter(d => d._factionId === fid);
          let matchDoc = null;
          if (matches.length === 1) {
            matchDoc = matches[0];
          } else if (matches.length > 1 && pts) {
            // Prefer the roster whose budget matches the scenario point value
            matchDoc = matches.find(d => d._data && (d._data.budget === pts || d._data.totalCost === pts))
                    || matches[0];
          } else if (matches.length > 1) {
            matchDoc = matches[0];
          }
          if (matchDoc && matchDoc._data) {
            faction = buildFactionFromSave(fid, matchDoc._data, fDef.npc);
            console.log('Loaded saved roster for', fid, ':', matchDoc.name);
          }

          // Fallback: load default faction data from CDN
          if (!faction) {
            const data = await loadFactionData(fid);
            if (data) faction = buildFactionEntry(fid, data, fDef.npc, null);
          }

          if (faction) {
            initUnitStates(faction);
            loadedFactions.push(faction);
          } else {
            console.warn('Could not load faction:', fid);
          }
        }

        // Filter to only enabled factions
        const filteredFactions = sim.enabledFactions
          ? loadedFactions.filter(f => sim.enabledFactions.has(f.id))
          : loadedFactions;
        if (!filteredFactions.length) throw new Error('No factions loaded');
        loadedFactions.length = 0;
        filteredFactions.forEach(f => loadedFactions.push(f));
        if (!loadedFactions.length) throw new Error('No factions loaded');
        state.factions       = loadedFactions;
        state.noiseLevel     = scenario.noiseLevel     || 0;
        state.noiseThreshold = scenario.noiseThreshold || 12;
        state.monstersTriggered = scenario.monstersTriggered || 0;
        state.monsterRoster  = scenario.monsterRoster  || [];

        // 3. Load monster pool
        await loadMonsterPool();

        // 4. Load map (optional) — use value captured before loading screen rendered
        const mapId = mapIdValue || scenario.mapId || '';
        if (mapId) {
          state.loadingMsg = `Loading map "${mapId}"…`;
          render();
          try {
            const mapUrl = RAW_BASE + 'data/src/terrain_instances/map_' + mapId + '.json?t=' + Date.now();
            const res    = await fetch(mapUrl);
            if (res.ok) {
              sim.mapData = safeParseJson(await res.text());
              if (sim.mapData) {
                await loadTerrainCatalog();
                preloadTerrainImages();
                buildTerrainBlockedMap();
                console.log('Map loaded:', mapId);
              }
            }
          } catch (e) { console.warn('Map load failed:', safeErr(e)); }
        }

        // 5. Load sprites + tabletop
        state.loadingMsg = 'Loading sprite assets…';
        render();
        await Promise.all([loadSpriteAssets(), loadTabletop()]);

        // 6. Deploy and build queue
        try { deployAllFactions(); } catch(e) { throw new Error('deployAllFactions failed: ' + e.message); }
        try { buildQueue(); }        catch(e) { throw new Error('buildQueue failed: ' + e.message); }

        state.phase = 'playing';
        simLog('Game start: ' + state.scenarioName + ' Round ' + state.round, 'round');

        try { render(); }            catch(e) { throw new Error('render failed: ' + e.message); }

      } catch (err) {
        // Log full stack so we can see exactly which line crashed
        console.error('❌ Simulator launch failed:', err);
        console.error('Stack:', err && err.stack ? err.stack : '(no stack)');
        state.phase = 'setup';
        render();
        alert('Failed to launch simulator: ' + (err && err.message ? err.message : String(err)));
      }
    };

    window.CC_SIM.focusFaction = function(fid) {
      // Pan camera to show this faction's units
      const units = Object.entries(sim.unitPositions)
        .filter(([k, pos]) => pos && k.startsWith(fid + '::'))
        .map(([, pos]) => pos);
      if (!units.length || !sim.canvas) return;
      const cx = units.reduce((s, p) => s + p.x, 0) / units.length;
      const cy = units.reduce((s, p) => s + p.y, 0) / units.length;
      sim.viewX = sim.canvas.width  / 2 - cx * sim.viewScale;
      sim.viewY = sim.canvas.height / 2 - cy * sim.viewScale;
    };

    window.CC_SIM.zoom = function(factor) {
      if (!sim.canvas) return;
      const cx = sim.canvas.width  / 2;
      const cy = sim.canvas.height / 2;
      sim.viewX = cx - (cx - sim.viewX) * factor;
      sim.viewY = cy - (cy - sim.viewY) * factor;
      sim.viewScale = Math.max(0.05, Math.min(2, sim.viewScale * factor));
    };

    window.CC_SIM.zoomFit = function() {
      if (!sim.canvas) return;
      const diamondW = 3932, diamondH = 3772;
      const scaleW   = sim.canvas.width  * 0.92 / diamondW;
      const scaleH   = sim.canvas.height * 0.92 / diamondH;
      sim.viewScale  = Math.min(scaleW, scaleH);
      sim.viewX      = sim.canvas.width  / 2 - 2048 * sim.viewScale;
      sim.viewY      = sim.canvas.height / 2 - 2090 * sim.viewScale;
      sim.camTargetX = null;
      sim.camTargetY = null;
    };

    window.CC_SIM.toggleAuto = function() {
      if (sim.autoRunning) {
        sim.autoRunning = false;
        const btn = document.getElementById('cc-sim-auto-btn');
        if (btn) btn.innerHTML = '<i class="fa fa-play"></i> Auto';
      } else {
        sim.autoRunning = true;
        const btn = document.getElementById('cc-sim-auto-btn');
        if (btn) btn.innerHTML = '<i class="fa fa-stop"></i> Stop';
        // Use a recursive setTimeout chain — waits for each activation to complete
        function autoStep() {
          if (!sim.autoRunning) return;
          if (isRoundComplete()) {
            sim.autoRunning = false;
            const b = document.getElementById('cc-sim-auto-btn');
            if (b) b.innerHTML = '<i class="fa fa-play"></i> Auto';
            return;
          }
          window.CC_SIM.activateAndAdvance(function() {
            if (sim.autoRunning) setTimeout(autoStep, sim.simSpeed);
          });
        }
        setTimeout(autoStep, 100);
      }
    };

    // ═════════════════════════════════════════════════════════════════════════
    // INITIAL BOOT
    // ═════════════════════════════════════════════════════════════════════════

    // If CC_STORAGE is already present when we mount, fetch scenarios immediately
    if (window.CC_STORAGE) {
      window.CC_SIM.fetchScenarios();
    }

    // Initial render
    render();

  } // end mount()

  // ── Destroy ──────────────────────────────────────────────────────────────────
  function destroy() {
    _destroyed = true;
    if (typeof destroyCanvas === 'function') destroyCanvas();
    const canvas = document.getElementById('cc-sim-canvas');
    if (canvas) canvas.remove();
    if (window.CC_SIM) {
      if (window.CC_SIM._autoTimer) clearInterval(window.CC_SIM._autoTimer);
      window.CC_SIM = {};
    }
    console.log('🎮 Game Simulator destroyed');
  }

  // ── Register ─────────────────────────────────────────────────────────────────
  window.CC_APP = { mount, destroy };
  console.log('🎮 CC_APP (Game Simulator) registered');

}()); // end IIFE
