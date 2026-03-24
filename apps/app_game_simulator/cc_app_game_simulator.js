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
  function fixEl(el) {
    if (!el || !el.getAttribute) return;
    var v = el.getAttribute('data-bs-auto-close');
    if (v === 'null' || v === null || v === '') el.setAttribute('data-bs-auto-close', 'true');
  }
  function patchPrototype() {
    var BS = window.bootstrap;
    if (!BS || !BS.Dropdown || !BS.Dropdown.prototype) return false;
    var proto = BS.Dropdown.prototype;
    if (proto._ccAutoClosePatch) return true;
    proto._ccAutoClosePatch = true;
    var orig = proto._getConfig;
    proto._getConfig = function(config) {
      if (this._element) fixEl(this._element);
      if (config && config.autoClose == null) config.autoClose = true;
      return orig.call(this, config);
    };
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
    const SPRITE_SRC_SIZE    = 20;             // sprite sheet frame size (px)
    const SPRITE_DRAW_SIZE   = 40;             // drawn size on map canvas (px)
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

    // Deployment zones around the 4096x4096 map edges
    // Up to 4 factions get a full side; 5-8 get a half-side
    // Deployment zones — inset well within the 4096x4096 map so units land on the board
    // The isometric SVG has its playable area roughly between 600-3500 on each axis
    const ZONE_DEFS = [
      { key: 'north',      xMin: 700,  xMax: 3400, yMin: 600,  yMax: 900  },
      { key: 'south',      xMin: 700,  xMax: 3400, yMin: 3200, yMax: 3500 },
      { key: 'west',       xMin: 600,  xMax: 900,  yMin: 700,  yMax: 3400 },
      { key: 'east',       xMin: 3200, xMax: 3500, yMin: 700,  yMax: 3400 },
      { key: 'north_west', xMin: 600,  xMax: 1800, yMin: 600,  yMax: 900  },
      { key: 'north_east', xMin: 2300, xMax: 3500, yMin: 600,  yMax: 900  },
      { key: 'south_west', xMin: 600,  xMax: 1800, yMin: 3200, yMax: 3500 },
      { key: 'south_east', xMin: 2300, xMax: 3500, yMin: 3200, yMax: 3500 },
    ];
    const MONSTER_ZONE = { key: 'center', xMin: 1700, xMax: 2400, yMin: 1700, yMax: 2400 };

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
      terrainImages: {},         // terrain_type_id -> HTMLImageElement
      tabletopImg: null,         // loaded SVG background image
      // Solo mode
      soloFactionId: null,       // which faction the player controls
      soloWaiting: false,        // waiting for player drag input
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
      unitPositions: {},        // unitKey -> { x, y, animName, frameIdx, frameTimer, vx, vy, status }
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
      const logEl = document.getElementById('cc-sim-log');
      if (logEl) {
        const cls = type ? `log-${type}` : '';
        logEl.insertAdjacentHTML('afterbegin',
          `<div class="cc-sim-log-entry ${cls}">${msg}</div>`);
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
        img.onload  = () => { sim.tabletopImg = img; console.log('🎲 Tabletop loaded'); resolve(); };
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
          }
        });
        console.log('📋 Terrain catalog loaded:', Object.keys(sim.terrainCatalog).length, 'entries');
      } catch (e) {
        console.warn('Could not load terrain catalog:', safeErr(e));
      }
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
          // Queue monsters — they spawn one per trigger, starting in center
          sim.monsterQueue = units.map(u => unitKey(faction.id, u.id));
          // Don't place them yet — they appear via noise triggers
          units.forEach(u => {
            sim.unitPositions[unitKey(faction.id, u.id)] = null; // null = not on map yet
          });
          return;
        }

        // Space out units evenly within their zone
        units.forEach((u, i) => {
          const k = unitKey(faction.id, u.id);
          // Scatter with slight randomness so they don't stack
          const x = randomInRange(zone.xMin + 20, zone.xMax - 20);
          const y = randomInRange(zone.yMin + 20, zone.yMax - 20);
          sim.unitPositions[k] = {
            x, y,
            animName:  'idle',
            frameIdx:  0,
            frameTimer: 0,
            vx: 0, vy: 0,
            status: 'idle',   // 'idle' | 'moving' | 'fighting' | 'routed'
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
      if (amount > 0) simLog(`[Noise] +${amount} (${label})`, 'info');
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
      sim.unitPositions[unitKey(monsterFaction.id, unit.id)] = {
        x: randomInRange(MONSTER_ZONE.xMin, MONSTER_ZONE.xMax),
        y: randomInRange(MONSTER_ZONE.yMin, MONSTER_ZONE.yMax),
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
        canvas.width  = wrap.clientWidth  || 600;
        canvas.height = wrap.clientHeight || 500;
        // Fit the map to fill ~90% of the viewport
        sim.viewScale = Math.min(canvas.width, canvas.height) * 0.9 / MAP_SIZE;
        sim.viewX = (canvas.width  - MAP_SIZE * sim.viewScale) / 2;
        sim.viewY = (canvas.height - MAP_SIZE * sim.viewScale) / 2;
      }
      resizeCanvas();
      window.addEventListener('resize', resizeCanvas);

      // Pan with mouse drag
      canvas.addEventListener('mousedown', e => {
        sim.isDragging = true;
        sim.dragLast = { x: e.clientX, y: e.clientY };
        wrap.classList.add('is-dragging');
      });
      canvas.addEventListener('mousemove', e => {
        if (sim.isDragging && sim.dragLast) {
          sim.viewX += e.clientX - sim.dragLast.x;
          sim.viewY += e.clientY - sim.dragLast.y;
          sim.dragLast = { x: e.clientX, y: e.clientY };
        }
        // Hover detection
        const rect = canvas.getBoundingClientRect();
        const mx = (e.clientX - rect.left - sim.viewX) / sim.viewScale;
        const my = (e.clientY - rect.top  - sim.viewY) / sim.viewScale;
        detectHoveredUnit(mx, my);
      });
      canvas.addEventListener('mouseup', () => {
        sim.isDragging = false;
        sim.dragLast   = null;
        wrap.classList.remove('is-dragging');
      });
      canvas.addEventListener('mouseleave', () => {
        sim.isDragging = false;
        sim.dragLast   = null;
        wrap.classList.remove('is-dragging');
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

      // Touch support
      let lastTouchDist = 0;
      canvas.addEventListener('touchstart', e => {
        if (e.touches.length === 1) {
          sim.isDragging = true;
          sim.dragLast = { x: e.touches[0].clientX, y: e.touches[0].clientY };
        } else if (e.touches.length === 2) {
          const dx = e.touches[0].clientX - e.touches[1].clientX;
          const dy = e.touches[0].clientY - e.touches[1].clientY;
          lastTouchDist = Math.hypot(dx, dy);
        }
      }, { passive: true });
      canvas.addEventListener('touchmove', e => {
        if (e.touches.length === 1 && sim.isDragging && sim.dragLast) {
          sim.viewX += e.touches[0].clientX - sim.dragLast.x;
          sim.viewY += e.touches[0].clientY - sim.dragLast.y;
          sim.dragLast = { x: e.touches[0].clientX, y: e.touches[0].clientY };
        } else if (e.touches.length === 2) {
          const dx   = e.touches[0].clientX - e.touches[1].clientX;
          const dy   = e.touches[0].clientY - e.touches[1].clientY;
          const dist = Math.hypot(dx, dy);
          if (lastTouchDist > 0) {
            const factor = dist / lastTouchDist;
            sim.viewScale = Math.max(0.05, Math.min(2, sim.viewScale * factor));
          }
          lastTouchDist = dist;
        }
      }, { passive: true });
      canvas.addEventListener('touchend', () => {
        sim.isDragging = false; sim.dragLast = null; lastTouchDist = 0;
      }, { passive: true });

      // ── Solo mode drag handlers ──────────────────────────────────────────
      canvas.addEventListener('mousedown', e => {
        const rect = canvas.getBoundingClientRect();
        const mx   = (e.clientX - rect.left - sim.viewX) / sim.viewScale;
        const my   = (e.clientY - rect.top  - sim.viewY) / sim.viewScale;

        // Check if clicking a solo unit
        if (sim.soloWaiting && sim.soloFactionId) {
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
          // Move unit with mouse, clamped to move range
          const pos  = sim.unitPositions[sim.dragUnit];
          if (pos) {
            const dx   = mx - sim.dragStartX;
            const dy   = my - sim.dragStartY;
            const dist = Math.hypot(dx, dy);
            sim.rulerDist = dist;
            if (dist <= sim.rulerMax) {
              pos.x = mx;
              pos.y = my;
            } else {
              // Clamp to range circle
              const ratio = sim.rulerMax / dist;
              pos.x = sim.dragStartX + dx * ratio;
              pos.y = sim.dragStartY + dy * ratio;
            }
            // Update ruler HUD
            const rulerEl = document.getElementById('cc-sim-ruler-hud');
            if (rulerEl) {
              const used  = Math.round(sim.rulerDist / GRID_PX * 10) / 10;
              const maxIn = Math.round(sim.rulerMax  / GRID_PX * 10) / 10;
              rulerEl.textContent = used + '" / ' + maxIn + '"';
              rulerEl.classList.add('visible');
            }
          }
          return;
        }
      }, true);

      canvas.addEventListener('mouseup', e => {
        if (sim.dragUnit) {
          // Snap to grid
          const pos = sim.unitPositions[sim.dragUnit];
          if (pos) {
            pos.x = Math.round(pos.x / GRID_PX) * GRID_PX;
            pos.y = Math.round(pos.y / GRID_PX) * GRID_PX;
            pos.status = 'idle';
          }
          sim.dragUnit    = null;
          sim.rulerActive = false;
          sim.rulerDist   = 0;
          const rulerEl = document.getElementById('cc-sim-ruler-hud');
          if (rulerEl) rulerEl.classList.remove('visible');
          // Auto advance after move
          setTimeout(() => window.CC_SIM.soloMoveComplete(), 200);
          return;
        }
        sim.isDragging = false;
        sim.dragLast   = null;
        wrap.classList.remove('is-dragging');
      }, true);

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
      if (!sim.canvas) return;
      const pos = sim.unitPositions[key];
      if (!pos) return;
      sim.camTargetX = sim.canvas.width  / 2 - pos.x * sim.viewScale;
      sim.camTargetY = sim.canvas.height / 2 - pos.y * sim.viewScale;
    }

    function tickCamera() {
      if (sim.camTargetX === null || sim.isDragging) return;
      const speed = 0.08; // lerp factor — lower = smoother
      sim.viewX += (sim.camTargetX - sim.viewX) * speed;
      sim.viewY += (sim.camTargetY - sim.viewY) * speed;
      // Stop when close enough
      if (Math.abs(sim.camTargetX - sim.viewX) < 0.5 && Math.abs(sim.camTargetY - sim.viewY) < 0.5) {
        sim.viewX = sim.camTargetX;
        sim.viewY = sim.camTargetY;
        sim.camTargetX = null;
        sim.camTargetY = null;
      }
    }

    function renderLoop(timestamp) {
      if (_destroyed || !sim.canvas || !sim.ctx) return;

      tickCamera();

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
      drawUnits(ctx, timestamp);

      ctx.restore();

      if (sim.hoveredUnit) drawTooltip(ctx, canvas);

      sim.animFrameId = requestAnimationFrame(renderLoop);
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
      // Draw tabletop SVG as full background
      if (sim.tabletopImg) {
        ctx.drawImage(sim.tabletopImg, 0, 0, MAP_SIZE, MAP_SIZE);
      } else {
        ctx.fillStyle = '#1c1008';
        ctx.fillRect(0, 0, MAP_SIZE, MAP_SIZE);
      }
      // Grid is baked into the isometric SVG — no overlay needed
      // Just a subtle outer border
      ctx.strokeStyle = 'rgba(0,0,0,0.3)';
      ctx.lineWidth = 8;
      ctx.strokeRect(4, 4, MAP_SIZE - 8, MAP_SIZE - 8);
    }

    function drawDeployZones(ctx) {
      Object.entries(sim.factionZones).forEach(([fid, zone]) => {
        const faction = getFactionById(fid);
        if (!faction || !zone) return;
        const color = faction.color || '#888';
        ctx.save();
        ctx.globalAlpha = 0.12;
        ctx.fillStyle   = color;
        ctx.fillRect(zone.xMin, zone.yMin, zone.xMax - zone.xMin, zone.yMax - zone.yMin);
        ctx.globalAlpha = 0.4;
        ctx.strokeStyle = color;
        ctx.lineWidth   = 3;
        ctx.setLineDash([12, 6]);
        ctx.strokeRect(zone.xMin, zone.yMin, zone.xMax - zone.xMin, zone.yMax - zone.yMin);
        ctx.setLineDash([]);
        ctx.restore();
      });
    }

    function drawTerrain(ctx) {
      if (!sim.mapData || !sim.mapData.instances) return;
      sim.mapData.instances.forEach(inst => {
        if (inst.hidden_in_editor) return;
        const img = sim.terrainImages[inst.terrain_type_id];
        if (!img) return;
        const w   = img.naturalWidth  * inst.scale;
        const h   = img.naturalHeight * inst.scale;
        ctx.save();
        ctx.translate(inst.x, inst.y);
        if (inst.rotation_deg) ctx.rotate(inst.rotation_deg * Math.PI / 180);
        if (inst.mirror_x || inst.mirror_y) ctx.scale(inst.mirror_x ? -1 : 1, inst.mirror_y ? -1 : 1);
        ctx.globalAlpha = inst.opacity ?? 1;
        ctx.drawImage(img, -w / 2, -h / 2, w, h);
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

        // Draw shadow
        ctx.save();
        ctx.globalAlpha = 0.25;
        ctx.fillStyle   = '#000';
        ctx.beginPath();
        ctx.ellipse(pos.x, pos.y + half - 4, half * 0.8, half * 0.25, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();

        // Draw sprite OR colored circle fallback
        const frame = animName ? getSpriteFrame(animName, pos.frameIdx) : null;
        if (frame && sim.spriteSheet) {
          ctx.save();
          // Clip to circle
          ctx.beginPath();
          ctx.arc(pos.x, pos.y, half, 0, Math.PI * 2);
          ctx.clip();
          // Background circle
          ctx.fillStyle = color + '33';
          ctx.fillRect(pos.x - half, pos.y - half, SPRITE_DRAW_SIZE, SPRITE_DRAW_SIZE);
          // Draw sprite frame
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
      if (cur) setUnitState(cur.factionId, cur.unitId, { activated: true });
      // Set unit back to idle animation
      if (cur) {
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

    function moveUnitToward(key, targetX, targetY, speedPx) {
      const pos = sim.unitPositions[key];
      if (!pos) return;
      const dx   = targetX - pos.x;
      const dy   = targetY - pos.y;
      const dist = Math.hypot(dx, dy);
      if (dist <= 2) return; // already there
      const step = Math.min(dist, speedPx);
      pos.x += (dx / dist) * step;
      pos.y += (dy / dist) * step;
      pos.status = 'moving';
    }

    function rollQualityDice(qualityScore) {
      const dice = [];
      for (let i = 0; i < qualityScore; i++) {
        dice.push(Math.floor(Math.random() * 6) + 1);
      }
      const successes = dice.filter(d => d >= 4).length;
      return { dice, successes };
    }

    function showRollDialog(attacker, defender, dice, successes, defense, hit) {
      const existing = document.getElementById('cc-sim-roll-overlay');
      if (existing) existing.remove();
      const color    = hit ? '#4caf50' : '#ef5350';
      const diceHtml = dice.map(d =>
        '<div class="cc-sim-die ' + (d >= 4 ? 'success' : 'fail') + '">' + d + '</div>'
      ).join('');
      const overlay = document.createElement('div');
      overlay.id        = 'cc-sim-roll-overlay';
      overlay.className = 'cc-sim-roll-overlay';
      overlay.innerHTML =
        '<div class="cc-sim-roll-dialog">' +
          '<div class="cc-sim-roll-title">' + attacker.name + ' attacks ' + defender.name + '</div>' +
          '<div class="cc-sim-dice-row">' + diceHtml + '</div>' +
          '<div class="cc-sim-roll-result" style="color:' + color + ';">' +
            successes + ' success' + (successes !== 1 ? 'es' : '') +
            ' vs Defense ' + defense + ' &mdash; ' + (hit ? 'HIT!' : 'Blocked') +
          '</div>' +
          '<button class="cc-btn" style="width:100%;" onclick="window.CC_SIM.closeRollDialog();">Continue</button>' +
        '</div>';
      document.body.appendChild(overlay);
      setTimeout(() => { if (overlay.parentNode) overlay.remove(); }, 4000);
    }

    function resolveEngagement(attackerKey, defenderKey, showDialog) {
      const [aFid, aUid] = attackerKey.split('::');
      const [dFid, dUid] = defenderKey.split('::');
      const attackerUnit  = getUnitById(getFactionById(aFid), aUid);
      const defenderUnit  = getUnitById(getFactionById(dFid), dUid);
      const attackerState = getUnitState(aFid, aUid);
      const defenderState = getUnitState(dFid, dUid);
      if (!attackerUnit || !defenderUnit || !attackerState || !defenderState) return;

      const attackQ  = attackerState.quality || 1;
      const defenseD = defenderUnit.defense  || 1;
      const aPos     = sim.unitPositions[attackerKey];
      const dPos     = sim.unitPositions[defenderKey];
      if (aPos) aPos.status = 'fighting';

      const { dice, successes } = rollQualityDice(attackQ);
      const hit = successes > defenseD;

      if (showDialog !== false) showRollDialog(attackerUnit, defenderUnit, dice, successes, defenseD, hit);

      if (hit) {
        const newQ = Math.max(0, defenderState.quality - 1);
        setUnitState(dFid, dUid, { quality: newQ });
        simLog(attackerUnit.name + ' hit ' + defenderUnit.name + '! (' + successes + ' vs D' + defenseD + ')', 'combat');
        if (newQ <= 0) {
          setUnitState(dFid, dUid, { out: true });
          if (dPos) dPos.status = 'routed';
          simLog(defenderUnit.name + ' is OUT!', 'combat');
        }
      } else {
        simLog(defenderUnit.name + ' blocked! (' + successes + ' vs D' + defenseD + ')', 'combat');
      }
      return { dice, successes, hit };
    }


    function simulateActivation(fid, uid) {
      const key  = unitKey(fid, uid);
      const pos  = sim.unitPositions[key];
      const unit = getUnitById(getFactionById(fid), uid);
      if (!pos || !unit) return;

      const speedPx = (unit.move || 6) * GRID_PX;  // move stat is in inches, GRID_PX = 1"
      const { key: enemyKey, dist: enemyDist } = findNearestEnemy(fid, pos);

      if (enemyKey && enemyDist <= ENGAGEMENT_PX) {
        // Already in range — fight!
        resolveEngagement(key, enemyKey);
        addNoise(NOISE_VALUES.melee, 'Melee');
      } else if (enemyKey) {
        // Move toward nearest enemy
        const ePos = sim.unitPositions[enemyKey];
        if (ePos) moveUnitToward(key, ePos.x, ePos.y, speedPx);
        simLog(`🦶 ${unit.name} advances.`, 'move');
      }

      // Settle back to idle after a moment
      setTimeout(() => {
        if (pos && pos.status !== 'routed') pos.status = 'idle';
      }, 600);
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
        root.innerHTML = `
          <div class="cc-sim-layout" id="cc-sim-layout">

            <!-- LEFT SIDEBAR -->
            <div class="cc-sim-sidebar cc-sim-sidebar-left">
              <div class="cc-sim-panel-header"><i class="fa fa-users"></i> Factions</div>
              <div class="cc-sim-sidebar-scroll" id="cc-sim-faction-list"></div>
              <div id="cc-sim-noise-wrap">
                <div class="cc-sim-bar-wrap">
                  <div class="cc-sim-bar-label">
                    <span><i class="fa fa-volume-up"></i> Canyon Noise</span>
                    <span id="cc-sim-noise-val">${state.noiseLevel} / ${state.noiseThreshold}</span>
                  </div>
                  <div class="cc-sim-bar-track">
                    <div class="cc-sim-bar-fill" id="cc-sim-noise-fill"
                         style="width:${Math.min(100,Math.round(state.noiseLevel/state.noiseThreshold*100))}%;background:#4caf50;"></div>
                  </div>
                </div>
              </div>
              <div class="cc-sim-controls">
                <button class="cc-btn cc-btn-sm" onclick="window.CC_SIM.addNoise(3,'Melee')">+Noise</button>
                <button class="cc-btn cc-btn-sm cc-btn-secondary" onclick="window.CC_SIM.rollEvent()">Event</button>
              </div>
            </div>

            <!-- MAP AREA -->
            <div class="cc-sim-map-wrap" id="cc-sim-map-wrap">
              <div class="cc-sim-ruler-hud" id="cc-sim-ruler-hud"></div>
              <div class="cc-sim-waiting-badge" id="cc-sim-waiting-badge">Your turn &mdash; drag your unit to move</div>
              <div class="cc-sim-map-hud-top">
                <div class="cc-sim-round-badge" id="cc-sim-round-badge">Round ${state.round}</div>
                <div class="cc-sim-round-badge" id="cc-sim-queue-badge" style="font-size:.75rem;"></div>
              </div>
              <div class="cc-sim-map-hud">
                <button class="cc-btn cc-btn-sm" id="cc-sim-next-btn" onclick="window.CC_SIM.nextActivation()">
                  <i class="fa fa-step-forward"></i> Next
                </button>
                <button class="cc-btn cc-btn-sm cc-btn-secondary" id="cc-sim-auto-btn" onclick="window.CC_SIM.toggleAuto()">
                  <i class="fa fa-play"></i> Auto
                </button>
                <button class="cc-btn cc-btn-sm cc-btn-secondary" onclick="window.CC_SIM.zoomFit()">
                  <i class="fa fa-compress"></i>
                </button>
              </div>
              <div class="cc-sim-zoom-controls">
                <button class="cc-sim-zoom-btn" onclick="window.CC_SIM.zoom(1.2)">+</button>
                <button class="cc-sim-zoom-btn" onclick="window.CC_SIM.zoom(0.8)">−</button>
              </div>
            </div>

            <!-- RIGHT SIDEBAR -->
            <div class="cc-sim-sidebar cc-sim-sidebar-right">
              <div class="cc-sim-panel-header"><i class="fa fa-bolt"></i> Active Unit</div>
              <div id="cc-sim-active-unit"></div>
              <div class="cc-sim-panel-header" style="margin-top:auto;"><i class="fa fa-list"></i> Log</div>
              <div class="cc-sim-sidebar-scroll">
                <div class="cc-sim-log" id="cc-sim-log"></div>
              </div>
            </div>

          </div>`;

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
        const zone     = sim.factionZones[f.id];
        const active   = getActiveUnits(f).length;
        const total    = f.allUnits.length;
        const isCur    = curItem && curItem.factionId === f.id;
        return `<div class="cc-sim-faction-entry ${isCur ? 'is-active' : ''}" onclick="window.CC_SIM.focusFaction('${f.id}')">
          <div class="cc-sim-faction-dot" style="background:${f.color};box-shadow:0 0 6px ${f.color}66;"></div>
          <div class="cc-sim-faction-name">${f.name}</div>
          <div style="display:flex;flex-direction:column;align-items:flex-end;gap:2px;">
            <div class="cc-sim-faction-count">${active}/${total}</div>
            ${zone && zone.key ? '<div class="cc-sim-faction-zone-tag" style="background:' + f.color + '22;color:' + f.color + ';">' + zone.key.replace('_',' ') + '</div>' : ''}
          </div>
        </div>`;
      }).join('');
    }

    function refreshActiveUnitPanel() {
      const el = document.getElementById('cc-sim-active-unit');
      if (!el) return;
      const curItem = currentQueueItem();
      if (!curItem) {
        el.innerHTML = `<div class="cc-sim-empty">Round complete — press End Round.</div>`;
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
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;">
            <div style="width:8px;height:8px;border-radius:50%;background:${color};box-shadow:0 0 8px ${color};flex-shrink:0;"></div>
            <div>
              <div class="cc-sim-active-name">${unit.name}</div>
              <div class="cc-sim-active-faction">${faction.name}</div>
            </div>
          </div>
          <div class="cc-sim-health-track">${dots}</div>
          <div class="cc-sim-stat-row">
            ${unit.move    ? `<span class="cc-sim-stat-pill move"><i class="fa fa-shoe-prints"></i> ${unit.move}"</span>` : ''}
            ${unit.defense ? `<span class="cc-sim-stat-pill defense"><i class="fa fa-shield-alt"></i> D${unit.defense}</span>` : ''}
            ${unit.range   ? `<span class="cc-sim-stat-pill range"><i class="fa fa-crosshairs"></i> ${unit.range}"</span>` : ''}
            ${unit.cost    ? `<span class="cc-sim-stat-pill cost">${unit.cost}pts</span>` : ''}
          </div>
          ${abilities}
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
      const el      = document.getElementById('cc-sim-queue-badge');
      const roundEl = document.getElementById('cc-sim-round-badge');
      if (el) {
        const remaining = state.queue.length - state.queueIndex;
        el.textContent  = remaining > 0 ? `${remaining} activations left` : 'Round complete';
      }
      if (roundEl) roundEl.textContent = `Round ${state.round}`;
    }

    // ═════════════════════════════════════════════════════════════════════════
    // CONTROLS — public CC_SIM.* functions
    // ═════════════════════════════════════════════════════════════════════════

    window.CC_SIM.closeRollDialog = function() {
      const o = document.getElementById('cc-sim-roll-overlay');
      if (o) o.remove();
    };

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
    };

    window.CC_SIM.activateAndAdvance = function() {
      const cur = currentQueueItem();
      if (!cur) return;
      const pos = sim.unitPositions[unitKey(cur.factionId, cur.unitId)];
      if (pos) pos.status = 'moving';
      simulateActivation(cur.factionId, cur.unitId);
      setTimeout(() => {
        window.CC_SIM.nextActivation();
      }, 700);
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
      sim.viewScale = Math.min(sim.canvas.width, sim.canvas.height) * 0.9 / MAP_SIZE;
      sim.viewX     = (sim.canvas.width  - MAP_SIZE * sim.viewScale) / 2;
      sim.viewY     = (sim.canvas.height - MAP_SIZE * sim.viewScale) / 2;
      sim.camTargetX = null;
      sim.camTargetY = null;
    };

    window.CC_SIM.toggleAuto = function() {
      if (sim.autoRunning) {
        sim.autoRunning = false;
        clearInterval(sim.autoTimer);
        sim.autoTimer = null;
        const btn = document.getElementById('cc-sim-auto-btn');
        if (btn) btn.innerHTML = '<i class="fa fa-play"></i> Auto';
      } else {
        sim.autoRunning = true;
        const btn = document.getElementById('cc-sim-auto-btn');
        if (btn) btn.innerHTML = '<i class="fa fa-stop"></i> Stop';
        sim.autoTimer = setInterval(() => {
          window.CC_SIM.activateAndAdvance();
          // Stop when a round completes
          if (isRoundComplete()) {
            window.CC_SIM.toggleAuto();
          }
        }, sim.simSpeed);
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
