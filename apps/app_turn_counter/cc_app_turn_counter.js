// ── cc_app_turn_counter.js ───────────────────────────────────────────────────
// Coffin Canyon · Game Turn Counter
// Loaded by cc_loader_core.js and mounted as window.CC_APP.
// ─────────────────────────────────────────────────────────────────────────────

console.log("⏱️ Turn Counter loaded");

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

  window.addEventListener('unhandledrejection', function ccRejectionGuard(event) {
    var reason = event.reason;
    if (reason instanceof Error && reason.message && reason.message.indexOf('DROPDOWN') !== -1) {
      event.preventDefault(); event.stopImmediatePropagation(); return;
    }
    if (reason instanceof Error && typeof reason.stack === 'string' &&
        reason.stack.indexOf('assets_frontend_lazy') !== -1 && reason.stack.indexOf('cc_app_') === -1) {
      event.preventDefault(); event.stopImmediatePropagation();
      console.warn('[CC] Swallowed Odoo-internal error:', reason.message); return;
    }
    if (reason instanceof Error && typeof reason.stack === 'string' && reason.stack.length > 0) return;
    event.preventDefault(); event.stopImmediatePropagation();
    var msg = '[CC] Caught rejection: ';
    try {
      if      (reason === null || reason === undefined) msg += '(null/undefined)';
      else if (typeof reason === 'string')              msg += reason;
      else if (reason instanceof Error)                 msg += reason.message || reason.toString();
      else if (typeof reason === 'object')              msg += reason.message || reason.data || JSON.stringify(reason);
      else                                              msg += String(reason);
    } catch (_) { msg += '(unreadable reason)'; }
    console.warn(msg, reason);
  }, { capture: true });

  console.log('🛡️ Rejection guard installed');
}());

// ═════════════════════════════════════════════════════════════════════════════
(function () {
  var _destroyFn = null;

  function mount(rootEl, ctx) {
    var root = rootEl;
    console.log("🚀 Turn Counter init", ctx);
    window.CC_TC = {};

    // ── CSS ───────────────────────────────────────────────────────────────────
    if (!document.getElementById('cc-core-ui-styles')) {
      fetch('https://raw.githubusercontent.com/steamcrow/coffin/main/ui/cc_ui.css?t=' + Date.now())
        .then(r => r.text()).then(css => {
          const s = document.createElement('style');
          s.id = 'cc-core-ui-styles'; s.textContent = css; document.head.appendChild(s);
        }).catch(err => console.error('❌ Core CSS failed:', err));
    }

    if (!document.getElementById('cc-tc-styles')) {
      fetch('https://raw.githubusercontent.com/steamcrow/coffin/main/apps/app_turn_counter/cc_app_turn_counter.css?t=' + Date.now())
        .then(r => r.text()).then(css => {
          const s = document.createElement('style');
          s.id = 'cc-tc-styles'; s.textContent = css; document.head.appendChild(s);
        }).catch(err => console.error('❌ Turn counter CSS failed:', err));
    }

    // ── Load CC_STORAGE ───────────────────────────────────────────────────────
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

    const helpers = ctx?.helpers;
    if (!helpers) {
      root.innerHTML = `<div class="cc-app-shell h-100"><div class="container py-5 text-danger"><h4>Helpers not available</h4></div></div>`;
      return;
    }

    // ═════════════════════════════════════════════════════════════════════════
    // CONSTANTS
    // ═════════════════════════════════════════════════════════════════════════

    const FACTION_META = {
      monster_rangers: { name: 'Monster Rangers', color: '#4caf50', isMonster: false, file: 'faction-monster-rangers-v5.json' },
      liberty_corps:   { name: 'Liberty Corps',   color: '#ef5350', isMonster: false, file: 'faction-liberty-corps-v2.json'  },
      monsterology:    { name: 'Monsterology',     color: '#9c27b0', isMonster: false, file: 'faction-monsterology-v2.json'   },
      monsters:        { name: 'Monsters',         color: '#ff7518', isMonster: true,  file: 'faction-monsters-v2.json'       },
      shine_riders:    { name: 'Shine Riders',     color: '#ffd600', isMonster: false, file: 'faction-shine-riders-v2.json'   },
      crow_queen:      { name: 'Crow Queen',       color: '#00bcd4', isMonster: false, file: 'faction-crow-queen.json'        }
    };

    const LOGO_BASE           = 'https://raw.githubusercontent.com/steamcrow/coffin/main/assets/logos/';
    const FACTION_LOADER_BASE = 'https://raw.githubusercontent.com/steamcrow/coffin/main/data/factions/';
    const SCENARIO_FOLDER     = 90;
    const FACTION_SAVE_FOLDER = 90;
    const TURN_SAVE_FOLDER    = 91;

    const NOISE_VALUES = {
      shot:      { label: 'Shot',      value: 2 },
      melee:     { label: 'Melee',     value: 3 },
      explosion: { label: 'Explosion', value: 3 },
      ritual:    { label: 'Ritual',    value: 4 },
      ability:   { label: 'Ability',   value: 2 },
      silent:    { label: 'Silent',    value: 0 }
    };

    const CANYON_EVENTS = [
      { id: 'dust_devil',   icon: 'fa-wind',                         text: 'A dust devil cuts across the board. Ranged attacks are at −1 die until next round.' },
      { id: 'thyr_flare',   icon: 'fa-gem',                          text: 'Thyr crystals flare. Any unit within 3" of a cache tests Quality or is Shaken.' },
      { id: 'supply_cache', icon: 'fa-box',                          text: 'A supply drop is spotted. Place a bonus cache token at a random board edge.' },
      { id: 'canyon_echo',  icon: 'fa-assistive-listening-systems',  text: 'Sounds carry strangely. Add +2 to current noise.' },
      { id: 'sickness',     icon: 'fa-head-side-cough',              text: 'Coffin Cough drifts in. Each faction rolls — 1 or 2: one unit tests Quality.' },
      { id: 'silence',      icon: 'fa-moon',                         text: 'An unnatural silence falls. Monsters stir — add +3 noise.' },
      { id: 'scavengers',   icon: 'fa-crow',                         text: 'Scavengers at the nearest objective. It becomes Contested regardless of control.' },
      { id: 'nightfall',    icon: 'fa-moon',                         text: 'Early dark. Reduce all ranged ranges by 3" until end of next round.' },
      { id: 'tremor',       icon: 'fa-bolt',                         text: 'The ground shudders. All Unstable terrain escalates one step.' },
      { id: 'canyon_luck',  icon: 'fa-leaf',                         text: 'Canyon luck. One random unit may remove a Shaken condition immediately.' },
      { id: 'wanted',       icon: 'fa-scroll',                       text: 'A wanted poster blows past. Shine Riders gain +1 to their next Quality test.' },
      { id: 'thyr_pulse',   icon: 'fa-sun',                          text: 'The canyon pulses with Thyr light. All ritual actions cost +1 noise this round.' },
    ];

    const STAT_DEFINITIONS = {
      move:    { label: 'Move',    icon: 'fa-shoe-prints', color: '#42a5f5',
                 short: 'How far this unit can travel in one action.',
                 long:  'Move is measured in inches. A unit may spend one Simple Action to move up to its full Move distance. Difficult terrain costs double movement. A unit may not move through enemy models.' },
      defense: { label: 'Defense', icon: 'fa-shield-alt',  color: '#ef5350',
                 short: 'How hard this unit is to damage.',
                 long:  'Defense is the target number of successes an attacker must beat to deal damage. An attacker rolls their Quality dice — each 4, 5, or 6 is a success. If their successes exceed your Defense, you take one point of damage.' },
      range:   { label: 'Range',   icon: 'fa-crosshairs',  color: '#ffd600',
                 short: 'Maximum distance for ranged attacks.',
                 long:  'Range is the maximum distance in inches this unit can shoot. Ranges are grouped as Short (3"), Medium (6"), and Long (12"). Shooting requires Line of Sight and is not permitted into or out of melee.' },
    };

    // ═════════════════════════════════════════════════════════════════════════
    // STATE
    // ═════════════════════════════════════════════════════════════════════════

    const state = {
      phase: 'setup',
      scenarioSave: null,  scenarioName: '',
      factions: [],        unitState: {},
      round: 1,            queue: [],          queueIndex: 0,
      noiseLevel: 0,       noiseThreshold: 12,
      monsterRoster: [],   monstersTriggered: 0,
      coughSeverity: 0,
      timerRunning: false, timerStart: null,   timerElapsed: 0,
      roundLog: [],        allRoundLogs: [],
      lastEventRound: 0,
      setupMode: null,     loadingData: false,
      setupTurnIndex: 0,   activationOrder: [],
    };

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
            const result = safeParseJson(decodeURIComponent(escape(atob(String(doc.datas)))));
            if (result !== null) return result;
          } catch (_) {}
        }
      }
      return null;
    }

    async function safeLoadDocument(docId) {
      if (!window.CC_STORAGE) return null;
      try {
        return await Promise.resolve(window.CC_STORAGE.loadDocument(docId))
          .catch(e => { console.warn(`⚠️ loadDocument(${docId}) rejected:`, safeErr(e)); return null; }) || null;
      } catch (e) { console.warn(`⚠️ loadDocument(${docId}) threw:`, safeErr(e)); return null; }
    }

    function getUnitState(factionId, unitId) { return state.unitState[unitKey(factionId, unitId)]; }
    function setUnitState(factionId, unitId, patch) {
      const k = unitKey(factionId, unitId);
      state.unitState[k] = Object.assign({}, state.unitState[k], patch);
    }

    // ═════════════════════════════════════════════════════════════════════════
    // DATA LOADING
    // ═════════════════════════════════════════════════════════════════════════

    async function loadFactionData(factionId) {
      const meta = FACTION_META[factionId];
      if (!meta) return null;
      try {
        const res  = await fetch(FACTION_LOADER_BASE + meta.file + '?t=' + Date.now());
        if (!res.ok) throw new Error('HTTP ' + res.status);
        const text = await res.text();
        if (!text?.trim()) throw new Error('Empty response');
        return JSON.parse(text);
      } catch (err) { console.warn(`⚠️ Could not load ${factionId}:`, safeErr(err)); return null; }
    }

    function buildFactionEntry(factionId, factionData, isNPC, isMonster) {
      const meta = FACTION_META[factionId] || {};
      const allUnits = (factionData?.units || factionData?.roster || []).map((u, i) => ({
        id:       u.id       || `unit_${i}`,
        name:     u.name     || `Unit ${i + 1}`,
        lore:     u.lore     || u.Lore    || u.flavor || u.description || null,
        quality:  u.quality  || 4,
        move:     u.move     || 6,
        defense:  u.defense  || u.armor   || null,
        range:    u.range    || u.shoot   || null,
        cost:     u.cost     || u.points  || null,
        special:  u.special  || u.abilities || [],
        upgrades: u.upgrades || [],
        isTitan:  u.titan    || false,
      }));
      return {
        id: factionId, name: factionData?.name || meta.name || factionId,
        color: meta.color || '#888',
        isMonster: isMonster ?? meta.isMonster ?? false,
        isNPC, logoUrl: LOGO_BASE + factionId + '_logo.svg',
        allUnits, deployIndex: 0,
      };
    }

    function buildQuickFaction(id, name, unitCount, isNPC, isMonster) {
      const meta  = FACTION_META[id] || {};
      const units = Array.from({ length: unitCount }, (_, i) => ({
        id: `unit_${i}`, name: `${name} #${i + 1}`,
        quality: 4, move: 6, defense: null, range: null, cost: null, special: [], isTitan: false,
      }));
      return { id, name, color: meta.color || '#888', isMonster, isNPC, logoUrl: LOGO_BASE + id + '_logo.svg', allUnits: units, deployIndex: 0 };
    }

    function buildFactionFromSave(factionId, saveData, isNPC) {
      const meta = FACTION_META[factionId] || {};
      if (!saveData || typeof saveData !== 'object') { console.warn('buildFactionFromSave: invalid saveData for', factionId); return null; }
      const roster = saveData.roster || saveData.units || saveData.army || saveData.list || null;
      if (!Array.isArray(roster) || !roster.length) { console.warn('buildFactionFromSave: no roster for', factionId); return null; }

      const allUnits = roster.map((item, i) => {
        if (!item || typeof item !== 'object') return null;
        let _q = item.quality || 4, _d = item.defense || item.armor || null;
        let _m = item.move    || 6, _r = item.range   || item.shoot || null;
        const _cfg    = item.config || {};
        const _bought = _cfg.optionalUpgrades?.length ? _cfg.optionalUpgrades : (item.upgrades || []);
        const _mods   = _bought.slice();
        if (_cfg.supplemental?.stat_modifiers) _mods.push(_cfg.supplemental);
        _mods.forEach(upg => {
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
          lore:     item.lore     || item.flavor   || null,
          quality: _q, move: _m, defense: _d, range: _r,
          cost:     item.totalCost || item.cost || null,
          special:  item.abilities || item.special || [],
          upgrades: _bought,
          isTitan:  item.isTitan || false,
        };
      }).filter(Boolean);

      if (!allUnits.length) { console.warn('buildFactionFromSave: all items invalid for', factionId); return null; }
      return {
        id: factionId, name: saveData.name || saveData.armyName || meta.name || factionId,
        color: meta.color || '#888', isMonster: meta.isMonster || false,
        isNPC, logoUrl: LOGO_BASE + factionId + '_logo.svg',
        allUnits, deployIndex: 0,
      };
    }

    function initUnitStates(faction) {
      faction.allUnits.forEach(u => {
        const k = unitKey(faction.id, u.id);
        if (!state.unitState[k]) state.unitState[k] = { quality: u.quality, out: false, activated: false };
      });
    }

    // ═════════════════════════════════════════════════════════════════════════
    // TURN QUEUE ENGINE
    // ═════════════════════════════════════════════════════════════════════════

    function getActiveUnits(faction) {
      return faction.allUnits.filter(u => { const us = getUnitState(faction.id, u.id); return us && !us.out; });
    }

    function buildQueue() {
      const monsters = state.factions.filter(f => f.isMonster);
      let   others   = state.factions.filter(f => !f.isMonster);
      for (let i = others.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [others[i], others[j]] = [others[j], others[i]];
      }
      const columns = [...monsters, ...others].map(f => {
        const active = getActiveUnits(f).slice().sort((a, b) => (a.cost ?? 9999) - (b.cost ?? 9999));
        return { factionId: f.id, factionName: f.name, isMonster: f.isMonster,
                 totalCost: active.reduce((s, u) => s + (u.cost || 0), 0),
                 units: active.map(u => u.id) };
      }).filter(col => col.units.length > 0);

      const maxLen = columns.reduce((m, c) => Math.max(m, c.units.length), 0);
      const queue  = [];
      for (let slot = 0; slot < maxLen; slot++) {
        columns.forEach(col => { if (slot < col.units.length) queue.push({ factionId: col.factionId, unitId: col.units[slot] }); });
      }

      state.queue           = queue;
      state.queueIndex      = 0;
      state.activationOrder = columns.map(c => ({ factionId: c.factionId, name: c.factionName, totalCost: c.totalCost, isMonster: c.isMonster }));

      state.factions.forEach(f => f.allUnits.forEach(u => {
        const k = unitKey(f.id, u.id);
        if (state.unitState[k]) { state.unitState[k].activated = false; state.unitState[k].lastRoll = null; }
      }));
    }

    const currentQueueItem   = () => state.queue[state.queueIndex] || null;
    const getFactionById     = id => state.factions.find(f => f.id === id) || null;
    const getUnitById        = (faction, unitId) => faction?.allUnits.find(u => u.id === unitId) || null;
    const isRoundComplete    = () => state.queueIndex >= state.queue.length;

    function advanceQueue() {
      const cur = currentQueueItem();
      if (cur) setUnitState(cur.factionId, cur.unitId, { activated: true });
      state.queueIndex++;
      while (state.queueIndex < state.queue.length) {
        const item = state.queue[state.queueIndex];
        const us   = getUnitState(item.factionId, item.unitId);
        if (!us || us.out) { state.queueIndex++; continue; }
        break;
      }
      return state.queueIndex < state.queue.length;
    }

    function deployReserves() {
      state.factions.forEach(f => {
        if (getActiveUnits(f).length === 0 && f.deployIndex < f.allUnits.length) {
          const next = f.allUnits[f.deployIndex++];
          setUnitState(f.id, next.id, { quality: next.quality, out: false, activated: false });
          state.roundLog.push(`[Deploy] ${f.name}: ${next.name} deploys.`);
        }
      });
    }

    // ═════════════════════════════════════════════════════════════════════════
    // NOISE & MONSTER PRESSURE
    // ═════════════════════════════════════════════════════════════════════════

    const FALLBACK_MONSTERS = [
      { id: 'ruster',         name: 'Ruster',         quality: 4, move: 6, defense: null, range: null, special: ['Corrode'],              isTitan: false },
      { id: 'snarl',          name: 'Snarl',          quality: 4, move: 8, defense: null, range: null, special: ['Berserk'],               isTitan: false },
      { id: 'canyon_crawler', name: 'Canyon Crawler', quality: 3, move: 5, defense: 2,    range: null, special: ['Armored'],               isTitan: false },
      { id: 'dust_wraith',    name: 'Dust Wraith',    quality: 4, move: 7, defense: null, range: 3,    special: ['Ambush', 'Fast'],        isTitan: false },
      { id: 'thyr_hound',     name: 'Thyr Hound',     quality: 4, move: 7, defense: null, range: null, special: ['Brutal Blow'],           isTitan: false },
      { id: 'iron_stalker',   name: 'Iron Stalker',   quality: 3, move: 5, defense: 3,    range: null, special: ['Armored', 'Anchor'],     isTitan: false },
      { id: 'canyon_titan',   name: 'Canyon Titan',   quality: 3, move: 4, defense: 4,    range: null, special: ['Brutal Blow', 'Anchor'], isTitan: true  },
    ];

    let _monstersFactionPool = [];

    async function loadMonstersFactionData() {
      if (_monstersFactionPool.length > 0) return;
      try {
        const meta = FACTION_META['monsters'];
        if (!meta) return;
        const res  = await fetch(FACTION_LOADER_BASE + meta.file + '?t=' + Date.now());
        if (!res.ok) return;
        const data = safeParseJson(await res.text());
        if (!data) return;
        _monstersFactionPool = (data.units || data.roster || []).map((u, i) => ({
          id: u.id || `monsters_${i}`, name: u.name || `Monster ${i + 1}`,
          lore: u.lore || null, quality: u.quality || 4, move: u.move || 6,
          defense: u.defense || u.armor || null, range: u.range || u.shoot || null,
          special: u.special || u.abilities || [], isTitan: u.titan || false,
        }));
        console.log('🐉 Monsters faction loaded —', _monstersFactionPool.length, 'types');
      } catch (e) { console.warn('Could not load monsters faction:', safeErr(e)); }
    }

    function pickEncounterMonster() {
      const scenarioList = state.monsterRoster || [];
      const pool         = _monstersFactionPool.length > 0 ? _monstersFactionPool : FALLBACK_MONSTERS;
      const lastId       = state._lastMonsterTriggered || '';

      function statsForName(nameOrObj) {
        const raw   = typeof nameOrObj === 'string' ? nameOrObj : (nameOrObj?.name || nameOrObj?.id || '');
        if (!raw) return null;
        const lower = raw.toLowerCase();
        return pool.find(m => m.name.toLowerCase() === lower || m.id === lower)
            || FALLBACK_MONSTERS.find(m => m.name.toLowerCase() === lower)
            || { id: lower.replace(/\s+/g, '_') + '_gen', name: raw, quality: 4, move: 6, defense: null, range: null, special: [], isTitan: false };
      }

      if (scenarioList.length > 0 && Math.random() < 0.80) {
        for (let a = 0; a < scenarioList.length * 2; a++) {
          const def = statsForName(scenarioList[(state.monstersTriggered + a) % scenarioList.length]);
          if (def && def.id !== lastId) return def;
        }
      }
      const filtered = pool.filter(m => m.id !== lastId);
      const candidates = filtered.length > 0 ? filtered : pool;
      return candidates[Math.floor(Math.random() * candidates.length)];
    }

    function addNoise(amount, label) {
      state.noiseLevel += amount;
      if (amount > 0) state.roundLog.push(`[Noise] +${amount} (${label})`);
      checkMonsterTrigger();
    }

    function checkMonsterTrigger() {
      if (state.noiseLevel < state.noiseThreshold) return;
      const monsterDef = pickEncounterMonster();
      if (!monsterDef) return;

      state._lastMonsterTriggered = monsterDef.id;
      state.monstersTriggered++;
      state.noiseLevel = Math.floor(state.noiseLevel / 2);
      state.roundLog.push(`[Monster] Encounter! ${monsterDef.name} approaches from the nearest edge.`);

      const instanceId = `${monsterDef.id}_enc${state.monstersTriggered}`;
      const unit       = Object.assign({}, monsterDef, { id: instanceId });

      let monsterFaction = state.factions.find(f => f.isMonster);
      if (!monsterFaction) {
        monsterFaction = { id: 'encounters', name: 'Encounters', color: '#ef5350',
                           isMonster: true, isNPC: true, logoUrl: LOGO_BASE + 'monsters_logo.svg',
                           allUnits: [], deployIndex: 0 };
        state.factions.push(monsterFaction);
      }

      monsterFaction.allUnits.push(unit);
      state.unitState[unitKey(monsterFaction.id, unit.id)] = { quality: unit.quality, out: false, activated: false, lastRoll: null };
      state.queue.splice(state.queueIndex + 1, 0, { factionId: monsterFaction.id, unitId: unit.id });
      showMonsterAlert(monsterDef, monsterFaction);
    }

    // ═════════════════════════════════════════════════════════════════════════
    // CANYON EVENTS & COFFIN COUGH
    // ═════════════════════════════════════════════════════════════════════════

    function rollCanyonEvent() {
      if (Math.random() > (state.round >= 3 ? 0.5 : 0.33)) return null;
      const ev = CANYON_EVENTS[Math.floor(Math.random() * CANYON_EVENTS.length)];
      state.lastEventRound = state.round;
      if (ev.id === 'canyon_echo') addNoise(2, 'Canyon Echo');
      if (ev.id === 'silence')     addNoise(3, 'Unnatural Silence');
      state.roundLog.push(`[Event] ${ev.text}`);
      return ev;
    }

    function tickCoffeinCough() {
      if (Math.random() < 0.4) state.coughSeverity = Math.min(5, state.coughSeverity + 1);
      if (state.coughSeverity >= 5) {
        state.roundLog.push('[Storm] Coffin Cough Storm! Every unit tests Quality or degrades by 1.');
        setTimeout(() => { state.coughSeverity = 2; render(); }, 4000);
      }
    }

    // ═════════════════════════════════════════════════════════════════════════
    // NPC DIRECTIVE ENGINE
    // ═════════════════════════════════════════════════════════════════════════

    function buildDirective(faction, unit) {
      const fSave  = state.scenarioSave?.factions?.find(f => f.id === faction.id);
      const q      = getUnitState(faction.id, unit.id)?.quality || unit.quality;
      const approachMap = {
        aggressive:    'Press forward — engage the nearest enemy.',
        defensive:     'Hold current position and protect nearby allies.',
        opportunistic: 'Move toward the highest-value unclaimed objective.',
        support:       "Stay near your faction's strongest unit.",
      };
      const primaryObj = state.scenarioSave?.objectives?.[0];
      return {
        priority:  fSave?.motive || approachMap[fSave?.approach || 'aggressive'],
        ifEngaged: `Attack (Q${q}, 2 actions)`,
        ifClear:   primaryObj?.name ? `Move toward ${primaryObj.name} and Interact.` : 'Hold position',
      };
    }

    // ═════════════════════════════════════════════════════════════════════════
    // RENDER HELPERS
    // ═════════════════════════════════════════════════════════════════════════

    function logoHtml(faction, sizePx = 64) {
      const initial  = (faction.name || '?')[0].toUpperCase();
      const color    = faction.color || '#888';
      const fallback = `<div class="cc-faction-logo-fallback" style="width:${sizePx}px;height:${sizePx}px;background:${color}22;border:2px solid ${color};font-size:${Math.round(sizePx * 0.45)}px;color:${color};">${initial}</div>`;
      return `<img src="${faction.logoUrl}" alt="${faction.name}" class="cc-faction-logo"
        style="width:${sizePx}px;height:${sizePx}px;filter:drop-shadow(0 0 6px ${color}88);"
        onerror="this.onerror=null;this.outerHTML='${fallback.replace(/'/g, "&#39;")}'"/>`;
    }

    function statBadge(label, value, colorKey) {
      if (value == null) return '';
      const hasDef    = !!STAT_DEFINITIONS[colorKey];
      const clickAttr = hasDef ? `onclick="window.CC_TC.openStatPanel('${colorKey}')" title="Tap for definition"` : '';
      return `<div class="cc-tc-stat cc-tc-stat-${colorKey}" ${clickAttr}>
        <span class="cc-tc-stat-val">${value}</span>
        <span class="cc-tc-stat-key">${label}</span>
      </div>`;
    }

    function noiseBarHtml() {
      const pct   = Math.min(100, Math.round((state.noiseLevel / state.noiseThreshold) * 100));
      const color = pct >= 80 ? '#ef5350' : pct >= 50 ? '#ffd600' : '#4caf50';
      return `<div class="cc-noise-bar">
        <div class="cc-bar-header">
          <span class="cc-bar-label"><i class="fa fa-assistive-listening-systems"></i> Canyon Noise</span>
          <span class="cc-bar-value" style="color:${color};">${state.noiseLevel} / ${state.noiseThreshold}</span>
        </div>
        <div class="cc-noise-track"><div class="cc-noise-fill" style="width:${pct}%;background:${color};"></div></div>
      </div>`;
    }

    function coughBarHtml() {
      if (!state.coughSeverity) return '';
      const pct    = Math.round((state.coughSeverity / 5) * 100);
      const color  = state.coughSeverity >= 4 ? '#ef5350' : '#ff9800';
      const labels = ['', 'Trace', 'Mild', 'Building', 'Warning', 'Storm'];
      return `<div class="cc-cough-bar">
        <div class="cc-bar-header">
          <span class="cc-bar-label"><i class="fa fa-wind"></i> Coffin Cough</span>
          <span class="cc-bar-value" style="color:${color};">${labels[state.coughSeverity]}</span>
        </div>
        <div class="cc-cough-track"><div class="cc-cough-fill" style="width:${pct}%;background:${color};"></div></div>
      </div>`;
    }

    function qualityTrack(faction, unit) {
      const us       = getUnitState(faction.id, unit.id);
      const cur      = us?.quality ?? unit.quality;
      const color    = cur <= 1 ? '#ef5350' : '#ff7518';
      const hasRolled = !!us?.lastRoll;

      let dots = '';
      for (let i = unit.quality; i >= 1; i--) {
        const filled = i <= cur;
        dots += `<button
          onclick="window.CC_TC.adjustQuality('${faction.id}','${unit.id}',${filled ? -1 : 1})"
          class="cc-q-dot"
          style="border-color:${color};background:${filled ? color : 'transparent'};"
          title="${filled ? 'Tap to wound' : 'Tap to heal'}"></button>`;
      }

      return `<div class="cc-quality-track">
        <div class="cc-quality-dots">
          <span class="cc-quality-q-label" style="color:${color};">Q</span>
          <div class="cc-quality-dot-row">${dots}</div>
          <span class="cc-quality-current" style="color:${color};">${cur > 0 ? cur : 'OUT?'}</span>
        </div>
        ${cur > 0 ? `<button onclick="window.CC_TC.rollQualityForUnit('${faction.id}','${unit.id}')"
          class="cc-btn" style="width:100%;padding:.75rem 1rem;font-size:1rem;
            background:${hasRolled ? 'rgba(255,255,255,.08)' : color + 'dd'};
            color:${hasRolled ? '#888' : '#000'};
            border:1px solid ${hasRolled ? '#444' : color};"
          title="${hasRolled ? 'Tap to review your roll (one roll per activation)' : 'Roll quality dice'}">
          ${hasRolled ? '↩ &nbsp;View Roll' : '🎲 &nbsp;Roll Q' + cur}
        </button>` : ''}
      </div>`;
    }

    // ═════════════════════════════════════════════════════════════════════════
    // SLIDE PANELS
    // ═════════════════════════════════════════════════════════════════════════

    function closeAllSlidePanels() {
      ['cc-tc-ability-panel', 'cc-tc-stat-panel', 'cc-tc-scenario-panel'].forEach(id => {
        const p = document.getElementById(id);
        if (p) { p.classList.remove('cc-slide-panel-open'); setTimeout(() => p.parentNode?.removeChild(p), 300); }
      });
      document.getElementById('cc-tc-panel-backdrop')?.remove();
    }

    function installPanelBackdrop() {
      if (document.getElementById('cc-tc-panel-backdrop')) return;
      const bd = document.createElement('div');
      bd.id = 'cc-tc-panel-backdrop';
      bd.style.cssText = 'position:fixed;inset:0;z-index:9998;background:transparent;';
      bd.addEventListener('click', closeAllSlidePanels);
      document.body.appendChild(bd);
    }

    window.CC_TC.openStatPanel = function(statKey) {
      if (_destroyed) return;
      const def = STAT_DEFINITIONS[statKey];
      if (!def) return;
      closeAllSlidePanels();
      installPanelBackdrop();
      const panel = document.createElement('div');
      panel.id = 'cc-tc-stat-panel';
      panel.className = 'cc-slide-panel';
      panel.addEventListener('click', e => e.stopPropagation());
      panel.innerHTML = `
        <div class="cc-slide-panel-header">
          <h2><i class="fa ${def.icon}"></i> ${def.label.toUpperCase()}</h2>
          <button onclick="window.CC_TC.closeStatPanel()" class="cc-panel-close-btn"><i class="fa fa-times"></i></button>
        </div>
        <div style="padding:1.5rem;">
          <span class="cc-stat-type-pill" style="border:1px solid ${def.color};color:${def.color};">Stat</span>
          <p style="color:#fff;font-size:1rem;font-weight:600;line-height:1.5;margin:0 0 1rem;">${def.short}</p>
          <p style="color:#bbb;font-size:.9rem;line-height:1.7;margin:0;">${def.long}</p>
        </div>`;
      document.body.appendChild(panel);
      setTimeout(() => panel.classList.add('cc-slide-panel-open'), 10);
    };

    window.CC_TC.closeStatPanel = closeAllSlidePanels;

    // ═════════════════════════════════════════════════════════════════════════
    // QUALITY DICE ROLLER
    // ═════════════════════════════════════════════════════════════════════════

    function rollQuality(currentQ) {
      const dice = Array.from({ length: currentQ }, () => Math.floor(Math.random() * 6) + 1);
      return {
        dice,
        successes: dice.filter(d => d >= 4).length,
        allSixes:  dice.length > 0 && dice.every(d => d === 6),
        allOnes:   dice.length > 0 && dice.every(d => d === 1),
        hasAnySix: dice.some(d => d === 6),
      };
    }

    function showRollResult(result, unitName, isReview) {
      document.getElementById('cc-roll-overlay')?.remove();

      const diceHtml = result.dice.map(d => {
        const isSix = d === 6, isHit = d >= 4;
        const bg    = isSix ? '#ffd600' : isHit ? '#ff7518' : 'rgba(255,255,255,.1)';
        const fg    = (isSix || isHit) ? '#000' : '#888';
        const ring  = isSix ? 'box-shadow:0 0 0 2px #ffd600;' : '';
        return `<div class="cc-roll-die" style="background:${bg};color:${fg};${ring}">${d}</div>`;
      }).join('');

      const resultColor = result.allSixes ? '#ffd600'
                        : result.successes >= Math.ceil(result.dice.length * 0.6) ? '#4caf50'
                        : result.successes > 0 ? '#ff7518' : '#ef5350';

      let specialHtml = '';
      if (result.allSixes) {
        specialHtml = `<div class="cc-roll-lucky">
          <div class="cc-roll-lucky-title">⭐ LUCKY BREAK — All Sixes!</div>
          <div class="cc-roll-lucky-intro">Must be used immediately. Cannot be saved. Choose one:</div>
          <div class="cc-roll-lucky-option"><strong>Quick Step</strong> — Free Half Move</div>
          <div class="cc-roll-lucky-option"><strong>Shake It Off</strong> — Remove 1 Pin or Condition</div>
          <div class="cc-roll-lucky-option"><strong>Deadeye</strong> — +1 die on next roll this activation</div>
          <div class="cc-roll-lucky-option"><strong>Get It Done</strong> — Free Interact action</div>
          <div class="cc-roll-lucky-fine">Only one Lucky Break per activation. Cannot modify attack damage.</div>
        </div>`;
      } else if (result.allOnes) {
        specialHtml = `<div class="cc-roll-all-ones">
          <div class="cc-roll-all-ones-title">💀 All Ones — Total Failure</div>
          <p style="color:#ffcdd2;font-size:.82rem;margin:.3rem 0 0;">Zero successes. No special rule triggered — just bad luck today.</p>
        </div>`;
      } else if (result.hasAnySix) {
        specialHtml = `<div class="cc-roll-natural-six">
          <i class="fa fa-star"></i> <strong>Natural Six present.</strong>
          If this is an attack roll and it hits, it deals at least 1 damage regardless of total successes.
        </div>`;
      }

      const overlay = document.createElement('div');
      overlay.id = 'cc-roll-overlay';
      overlay.className = 'cc-roll-overlay';
      overlay.innerHTML = `<div class="cc-roll-dialog">
        <div class="cc-roll-label">${isReview ? '↩ Previous Roll — ' : 'Quality Roll — '}${unitName}</div>
        ${isReview ? '<div class="cc-roll-review-note">One roll per activation. This was your result.</div>' : ''}
        <div class="cc-roll-dice">${diceHtml}</div>
        <div class="cc-roll-legend">
          <span style="color:#ffd600;">■</span> 6 &nbsp;
          <span style="color:#ff7518;">■</span> 4–5 = hit &nbsp;
          <span style="color:rgba(255,255,255,.2);">■</span> 1–3 = miss
        </div>
        <div class="cc-roll-successes" style="color:${resultColor};">${result.successes}</div>
        <div class="cc-roll-result-label" style="color:${resultColor};">SUCCESS${result.successes !== 1 ? 'ES' : ''}</div>
        <div class="cc-roll-dice-count">${result.dice.length}d6 rolled</div>
        ${specialHtml}
        <button onclick="document.getElementById('cc-roll-overlay').remove()"
          class="cc-btn" style="width:100%;margin-top:1rem;font-size:1rem;padding:.85rem;">Got It</button>
      </div>`;
      document.body.appendChild(overlay);
    }

    // ═════════════════════════════════════════════════════════════════════════
    // MONSTER ALERT OVERLAY
    // ═════════════════════════════════════════════════════════════════════════

    function showMonsterAlert(unit, faction) {
      document.getElementById('cc-monster-alert')?.remove();
      const color    = faction?.color || '#ef5350';
      const specials = Array.isArray(unit.special) ? unit.special : (unit.special ? [unit.special] : []);

      const statTags = [
        unit.quality ? `<span class="cc-monster-stat-tag" style="background:#ff751822;border:1px solid #ff751866;color:#ff7518;">Q${unit.quality}</span>` : '',
        unit.move    ? `<span class="cc-monster-stat-tag" style="background:#42a5f522;border:1px solid #42a5f566;color:#42a5f5;">${unit.move}"</span>` : '',
        unit.defense ? `<span class="cc-monster-stat-tag" style="background:#ef535022;border:1px solid #ef535066;color:#ef5350;">Def ${unit.defense}</span>` : '',
        unit.range   ? `<span class="cc-monster-stat-tag" style="background:#ffd60022;border:1px solid #ffd60066;color:#ffd600;">${unit.range}"</span>` : '',
      ].join('');

      const overlay = document.createElement('div');
      overlay.id = 'cc-monster-alert';
      overlay.className = 'cc-monster-alert';
      overlay.innerHTML = `<div class="cc-monster-dialog" style="border:2px solid ${color};">
        <div class="cc-monster-icon" style="color:${color};"><i class="fa fa-dragon"></i></div>
        <h2 class="cc-monster-title" style="color:${color};">Monster Encounter!</h2>
        <p class="cc-monster-intro"><strong>${unit.name}</strong> approaches from the nearest board edge.</p>
        ${unit.lore ? `<p class="cc-monster-lore">${unit.lore}</p>` : ''}
        <div class="cc-monster-stats">${statTags}</div>
        ${specials.length ? `<div class="cc-monster-specials">${specials.map(s => `<span class="cc-monster-special-tag">${s}</span>`).join('')}</div>` : ''}
        <div class="cc-monster-queue-notice">
          <i class="fa fa-chevron-right" style="color:${color};margin-right:.4rem;"></i>
          ${unit.name} <strong style="color:#fff;">added to the queue</strong> — activates next.
        </div>
        <button onclick="document.getElementById('cc-monster-alert').remove()"
          class="cc-btn" style="width:100%;font-size:1rem;padding:.85rem;background:${color};color:#000;">
          Acknowledged — Continue
        </button>
      </div>`;
      document.body.appendChild(overlay);
    }

    // ═════════════════════════════════════════════════════════════════════════
    // RENDER: SETUP SCREEN
    // ═════════════════════════════════════════════════════════════════════════

    function updateLoginStatus() {
      var bar = document.getElementById('cc-tc-login-status');
      if (!bar) return;
      if (!window.CC_STORAGE) {
        if (!window._ccStorageGaveUp) {
          setTimeout(() => { window._ccStorageGaveUp = true; updateLoginStatus(); }, 500);
        } else {
          bar.className = 'cc-login-status logged-out';
          bar.innerHTML = '<i class="fa fa-exclamation-circle"></i> Storage unavailable — cloud saves disabled';
        }
        return;
      }
      window._ccStorageGaveUp = false;
      window.CC_STORAGE.checkAuth().then(auth => {
        var bar2 = document.getElementById('cc-tc-login-status');
        if (!bar2) return;
        if (auth && auth.loggedIn) {
          bar2.className = 'cc-login-status logged-in';
          bar2.innerHTML = `<i class="fa fa-check-circle"></i> Signed in as ${auth.userName || 'User'} — cloud saves enabled`;
        } else {
          bar2.className = 'cc-login-status logged-out';
          bar2.innerHTML = '<i class="fa fa-exclamation-circle"></i> Not signed in — log in to load scenario &amp; faction saves';
        }
      }).catch(() => {
        var bar2 = document.getElementById('cc-tc-login-status');
        if (bar2) { bar2.className = 'cc-login-status logged-out'; bar2.innerHTML = '<i class="fa fa-exclamation-circle"></i> Could not check login status'; }
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
          <div class="cc-tc-body">
            ${state.loadingData ? `
              <div class="cc-tc-loading-screen">
                <div class="cc-tc-loading-icon"><i class="fa fa-cog"></i></div>
                <p class="cc-tc-loading-msg">Loading faction data…</p>
              </div>` : `
            <div class="cc-panel" style="margin-bottom:1rem;">
              <div class="cc-panel-header">
                <h5 class="cc-app-title" style="font-size:1rem;margin:0;"><i class="fa fa-dice"></i> Start a Game</h5>
              </div>
              <div class="cc-panel-body">
                <p class="cc-muted" style="margin:0 0 1rem;">
                  Load a saved scenario to get NPC directives, monster pressure, and objectives.
                  Or jump straight in with Quick Mode.
                </p>
                <div style="display:flex;flex-direction:column;gap:.75rem;">
                  ${hasStorage ? `
                    <button class="cc-btn cc-btn-secondary" onclick="window.CC_TC.openScenarioList()" style="text-align:left;justify-content:flex-start;">
                      <i class="fa fa-folder-open" style="margin-right:.75rem;"></i>
                      Load Scenario Save
                      <span style="margin-left:auto;font-size:.75rem;text-transform:none;">Loads objectives, NPC motives, monsters</span>
                    </button>` : `
                    <div class="cc-callout">
                      <i class="fa fa-ban"></i> Storage not available — use Quick Mode
                    </div>`}
                  <button class="cc-btn cc-btn-secondary" onclick="window.CC_TC.startQuickMode()" style="text-align:left;justify-content:flex-start;">
                    <i class="fa fa-bolt" style="margin-right:.75rem;"></i>
                    Quick Mode
                    <span style="margin-left:auto;font-size:.75rem;text-transform:none;">Pick factions and go</span>
                  </button>
                </div>
              </div>
            </div>
            ${hasStorage ? `
              <div class="cc-panel">
                <div class="cc-panel-header"><h5 style="margin:0;">↩️ Resume a Game</h5></div>
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
        <label class="cc-quick-faction-row">
          <input type="checkbox" name="faction" value="${id}" style="width:18px;height:18px;cursor:pointer;"
            onchange="this.closest('.cc-quick-faction-row').style.borderColor = this.checked ? '${meta.color}' : 'rgba(255,255,255,.08)'">
          <div class="cc-tc-faction-initial"
            style="background:${meta.color}22;border:2px solid ${meta.color};color:${meta.color};">
            ${meta.name[0]}
          </div>
          <span style="flex:1;font-weight:600;">${meta.name}</span>
          <select name="npc_${id}" class="cc-tc-quick-select">
            <option value="player">Player</option>
            <option value="npc" selected>NPC</option>
          </select>
        </label>`).join('');

      root.innerHTML = `
        <div class="cc-app-shell h-100">
          <div class="cc-app-header">
            <div><h1 class="cc-app-title">Coffin Canyon</h1><div class="cc-app-subtitle">Quick Setup</div></div>
            <button class="cc-btn cc-btn-secondary" onclick="window.CC_TC.backToSetup()">← Back</button>
          </div>
          <div class="cc-tc-body">
            <div class="cc-panel">
              <div class="cc-panel-header">
                <h5 style="margin:0;color:var(--cc-primary);">Choose Factions</h5>
              </div>
              <div class="cc-panel-body" id="cc-quick-faction-list" style="display:flex;flex-direction:column;gap:.5rem;">
                ${factionList}
              </div>
            </div>
            <div style="margin-top:1rem;">
              <button class="cc-btn" style="width:100%;" onclick="window.CC_TC.startFromQuickSetup()">
                Start Game →
              </button>
            </div>
          </div>
        </div>`;
    }

    // ═════════════════════════════════════════════════════════════════════════
    // RENDER: ROUND START BANNER
    // ═════════════════════════════════════════════════════════════════════════

    function renderRoundBanner() {
      const totalActivations = state.queue.length;
      const orderStrip = state.activationOrder.map((ao, idx) => {
        var f = getFactionById(ao.factionId);
        if (!f) return '';
        var active = getActiveUnits(f);
        if (!active.length) return '';
        var color = f.color;
        var badge = ao.isMonster
          ? '<span class="cc-tc-monster-first-tag">FIRST</span>'
          : (idx === 1 ? ' <i class="fa fa-dice" style="color:#555;font-size:.65rem;"></i>' : '');
        return `<div class="cc-tc-order-item"
          style="border:1px solid ${color}${ao.isMonster ? '88' : '44'};background:${color}${ao.isMonster ? '1a' : '0d'};">
          <span class="cc-tc-order-rank">${idx + 1}</span>
          ${logoHtml(f, 22)}
          <div class="cc-tc-order-info">
            <div class="cc-tc-order-name" style="color:${color};">${f.name}${badge}</div>
            <div class="cc-tc-order-meta">${active.length} unit${active.length !== 1 ? 's' : ''}${ao.totalCost ? ' · ' + ao.totalCost + ' pts' : ''} · cheapest first</div>
          </div>
        </div>`;
      }).join('');

      root.innerHTML = `
        <div class="cc-app-shell h-100 cc-tc-banner-wrap">
          <div class="cc-tc-banner-inner">
            <div class="cc-tc-banner-eyebrow">Beginning</div>
            <h1 class="cc-tc-round-number">Round ${state.round}</h1>
            <p class="cc-tc-round-sub">${totalActivations} activation${totalActivations !== 1 ? 's' : ''} this round</p>
            ${orderStrip ? `
              <div class="cc-tc-order-section">
                <div class="cc-tc-order-label">Activation Order — Monsters First, then Randomized — Units: Cheapest to Costliest</div>
                <div class="cc-tc-order-list">${orderStrip}</div>
              </div>` : ''}
            ${noiseBarHtml()}
            ${coughBarHtml()}
            <button class="cc-btn" style="width:100%;font-size:1.1rem;padding:1rem;margin-top:1rem;"
              onclick="window.CC_TC.startRound()">Begin Round ${state.round} →</button>
          </div>
        </div>`;
    }

    // ═════════════════════════════════════════════════════════════════════════
    // RENDER: ACTIVATION SCREEN
    // ═════════════════════════════════════════════════════════════════════════

    function renderActivation() {
      const item = currentQueueItem();
      if (!item) { endRound(); return; }
      const faction = getFactionById(item.factionId);
      const unit    = getUnitById(faction, item.unitId);
      const us      = getUnitState(item.factionId, item.unitId);
      if (!faction || !unit || !us) { advanceQueue(); render(); return; }

      const remaining = state.queue.length - state.queueIndex;
      const color     = faction.color;

      const statBadges = [
        statBadge('Move',    unit.move    ? unit.move + '"' : null, 'move'),
        statBadge('Defense', unit.defense, 'defense'),
        unit.range ? statBadge('Range', unit.range + '"', 'range') : '',
      ].join('');

      const directive = faction.isNPC ? buildDirective(faction, unit) : null;

      const directiveHtml = directive ? `
        <div class="cc-panel cc-tc-directive" style="border-color:${color}44;">
          <div class="cc-panel-header" style="background:${color}11;">
            <h6 class="cc-tc-directive-header" style="color:${color};margin:0;">
              <i class="fa fa-crosshairs"></i> NPC Directive
            </h6>
          </div>
          <div class="cc-panel-body">
            <div class="cc-tc-directive-priority"><strong>Priority:</strong> ${directive.priority}</div>
            <div class="cc-tc-directive-sub">If Engaged: ${directive.ifEngaged}</div>
            <div class="cc-tc-directive-sub">If Clear: ${directive.ifClear}</div>
          </div>
        </div>` : '';

      const abilities = Array.isArray(unit.special) ? unit.special : (unit.special ? [unit.special] : []);
      window.CC_TC._currentUnitAbilities = abilities;
      const specialHtml = abilities.length ? `
        <div class="cc-tc-abilities">
          <div class="cc-tc-section-label">Abilities <em>— tap to look up rule</em></div>
          <div class="cc-tc-tag-row">
            ${abilities.map((s, idx) => `
              <button class="cc-tc-ability-btn"
                onclick="window.CC_TC.openAbilityPanel(${idx})"
                onmouseenter="this.style.borderColor='${color}';this.style.color='${color}'"
                onmouseleave="this.style.borderColor='rgba(255,255,255,.18)';this.style.color='#ddd'"
              >${s}</button>`).join('')}
          </div>
        </div>` : '';

      const upgradeHtml = (unit.upgrades && unit.upgrades.length) ? `
        <div class="cc-tc-upgrades">
          <div class="cc-tc-section-label">Upgrades</div>
          <div class="cc-tc-tag-row">
            ${(Array.isArray(unit.upgrades) ? unit.upgrades : [unit.upgrades]).map(upg => {
              const label = typeof upg === 'string' ? upg : (upg.name || upg.label || String(upg));
              const note  = typeof upg === 'object' ? (upg.effect || upg.description || upg.note || null) : null;
              return `<div class="cc-tc-upgrade-tag">${label}${note ? `<span class="cc-tc-upgrade-note">${note}</span>` : ''}</div>`;
            }).join('')}
          </div>
        </div>` : '';

      root.innerHTML = `
        <div class="cc-app-shell h-100" style="display:flex;flex-direction:column;">

          <div class="cc-app-header">
            <div class="cc-tc-header-left">
              ${logoHtml(faction, 32)}
              <div>
                <div class="cc-tc-header-faction" style="color:${color};">${faction.name}</div>
                <div class="cc-tc-header-meta">Round ${state.round} · ${remaining} left</div>
              </div>
            </div>
            <div class="cc-tc-header-right">
              <div id="cc-timer" class="cc-tc-timer">00:00</div>
              <button onclick="window.CC_TC.toggleTimer()" class="cc-btn cc-btn-secondary" style="padding:.25rem .5rem;font-size:.7rem;">
                ${state.timerRunning ? '⏸' : '▶'}
              </button>
              <button onclick="window.CC_TC.saveGame()" class="cc-btn cc-btn-secondary" style="padding:.25rem .5rem;font-size:.7rem;" title="Save game">
                <i class="fa fa-save"></i>
              </button>
            </div>
          </div>

          <div class="cc-tc-content">

            <div class="cc-tc-unit-header">
              <h2 class="cc-tc-unit-name">${unit.name}</h2>
              ${unit.isTitan ? `<span class="cc-tc-titan-badge"><i class="fa fa-bolt"></i> Titan</span>` : ''}
              ${unit.lore ? `<p class="cc-tc-unit-lore">${unit.lore}</p>` : ''}
            </div>

            ${qualityTrack(faction, unit)}

            <div class="cc-tc-stat-row">${statBadges}</div>

            ${specialHtml}
            ${directiveHtml}
            ${upgradeHtml}

            <div class="cc-panel" style="margin:1rem 0;">
              <div class="cc-panel-header">
                <h6 style="margin:0;color:#888;font-size:.7rem;text-transform:uppercase;letter-spacing:.1em;">
                  <i class="fa fa-assistive-listening-systems"></i> Log Noise
                </h6>
              </div>
              <div class="cc-panel-body">
                <div class="cc-tc-tag-row" style="margin-bottom:.5rem;">
                  ${Object.entries(NOISE_VALUES).map(([key, n]) => `
                    <button onclick="window.CC_TC.logNoise('${key}')"
                      class="cc-btn cc-btn-secondary"
                      style="font-size:.78rem;padding:.35rem .65rem;${n.value > 0 ? '' : 'opacity:.6;'}">
                      ${n.label}${n.value > 0 ? ` <span style="color:#ef5350;">+${n.value}</span>` : ''}
                    </button>`).join('')}
                </div>
                ${noiseBarHtml()}
                ${coughBarHtml()}
              </div>
            </div>

          </div>

          <div class="cc-tc-footer">
            <button onclick="window.CC_TC.markOut()" class="cc-btn cc-btn-secondary cc-tc-out-btn" title="Remove this unit from play">
              <i class="fa fa-times"></i> OUT
            </button>
            <button onclick="window.CC_TC.nextActivation()"
              class="cc-btn cc-tc-done-btn"
              style="background:${color};color:#000;border-color:${color};">
              DONE →
            </button>
          </div>

        </div>`;

      if (state.timerRunning) startTimerDisplay();
    }

    let _timerInterval = null;

    function startTimerDisplay() {
      clearInterval(_timerInterval);
      _timerInterval = setInterval(() => {
        if (_destroyed) { clearInterval(_timerInterval); return; }
        const el = document.getElementById('cc-timer');
        if (!el) { clearInterval(_timerInterval); return; }
        const elapsed = state.timerElapsed + (state.timerRunning ? Date.now() - state.timerStart : 0);
        const s = Math.floor(elapsed / 1000), m = Math.floor(s / 60);
        el.textContent = String(m).padStart(2,'0') + ':' + String(s % 60).padStart(2,'0');
      }, 500);
    }

    // ═════════════════════════════════════════════════════════════════════════
    // RENDER: ROUND END SUMMARY
    // ═════════════════════════════════════════════════════════════════════════

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
              <td><span style="color:${f.color};font-weight:700;font-size:.8rem;">${f.name}</span></td>
              <td style="font-weight:600;">${u.name}</td>
              <td class="cc-col-status"><span style="color:${qColor};font-weight:700;">${us.out ? 'OUT' : 'Q' + us.quality}</span></td>
            </tr>`;
        })
      ).join('');

      const logHtml = state.roundLog.length
        ? state.roundLog.map(l => `<li class="cc-tc-log-item">${l}</li>`).join('')
        : '<li class="cc-tc-log-item cc-muted">Nothing eventful.</li>';

      root.innerHTML = `
        <div class="cc-app-shell h-100">
          <div class="cc-app-header">
            <div>
              <h1 class="cc-app-title">Round ${state.round} Complete</h1>
              <div class="cc-app-subtitle">End of Round Summary</div>
            </div>
          </div>
          <div class="cc-tc-body" style="overflow-y:auto;">

            ${canyonEvent ? `
              <div class="cc-panel" style="margin-bottom:1rem;border-color:rgba(255,117,24,.4);">
                <div class="cc-panel-header" style="background:rgba(255,117,24,.08);">
                  <h5 style="margin:0;color:var(--cc-primary);">
                    <i class="fa ${canyonEvent.icon}"></i> Canyon Event
                  </h5>
                </div>
                <div class="cc-panel-body"><p style="margin:0;">${canyonEvent.text}</p></div>
              </div>` : ''}

            <div class="cc-panel" style="margin-bottom:1rem;">
              <div class="cc-panel-body">
                ${noiseBarHtml()}
                ${coughBarHtml()}
              </div>
            </div>

            <div class="cc-panel" style="margin-bottom:1rem;">
              <div class="cc-panel-header"><h5 style="margin:0;"><i class="fa fa-list"></i> Round Log</h5></div>
              <div class="cc-panel-body">
                <ul class="cc-tc-log-list">${logHtml}</ul>
              </div>
            </div>

            <div class="cc-panel" style="margin-bottom:1.5rem;">
              <div class="cc-panel-header"><h5 style="margin:0;">Unit Status</h5></div>
              <div class="cc-panel-body" style="padding:0;">
                <table class="cc-tc-unit-table">
                  <thead>
                    <tr>
                      <th>Faction</th><th>Unit</th><th class="cc-col-status">Status</th>
                    </tr>
                  </thead>
                  <tbody>${unitRows}</tbody>
                </table>
              </div>
            </div>

            <button onclick="window.CC_TC.beginNextRound()" class="cc-btn" style="width:100%;font-size:1.1rem;padding:1rem;">
              Begin Round ${state.round + 1} →
            </button>
          </div>
        </div>`;
    }

    // ═════════════════════════════════════════════════════════════════════════
    // RENDER: SETUP ROUND (TERRAIN)
    // ═════════════════════════════════════════════════════════════════════════

    function renderSetupRound() {
      var factions      = state.factions;
      var turnIdx       = state.setupTurnIndex % Math.max(factions.length, 1);
      var activeFaction = factions[turnIdx] || factions[0];
      var color         = activeFaction ? activeFaction.color : '#888';
      var fname         = activeFaction ? activeFaction.name  : '?';
      var isNPC         = activeFaction && activeFaction.isNPC;

      var scenarioTerrain = state.scenarioSave && (state.scenarioSave.terrain || state.scenarioSave.available_terrain
        || state.scenarioSave.terrain_pool || state.scenarioSave.tiles || state.scenarioSave.pieces) || null;

      var BASE_TERRAIN = [
        { icon: 'fa-grip-lines',  label: 'Boardwalk',     note: 'Elevated walkway — present in every location', isObjective: false },
        { icon: 'fa-grip-lines',  label: 'Boardwalk',     note: 'Elevated walkway — place a second one',        isObjective: false },
        { icon: 'fa-gem',         label: 'Thyr Crystal',  note: 'Magical resource — mark it',                   isObjective: false },
        { icon: 'fa-home',        label: 'Building',      note: 'Blocks LOS, can be entered',                   isObjective: false },
        { icon: 'fa-mountain',    label: 'Rocky Outcrop', note: 'Difficult terrain, partial cover',             isObjective: false },
        { icon: 'fa-tree',        label: 'Canyon Brush',  note: 'Light cover, passable',                        isObjective: false },
        { icon: 'fa-campground',  label: 'Ruin / Debris', note: 'Narrative terrain',                            isObjective: false },
        { icon: 'fa-barricade',   label: 'Barricade',     note: 'Low cover, blocks movement',                   isObjective: false },
      ];

      var terrainTypes;
      if (Array.isArray(scenarioTerrain) && scenarioTerrain.length > 0) {
        terrainTypes = scenarioTerrain.map(t => {
          if (typeof t === 'string') return { icon: 'fa-map-signs', label: t, note: '', isObjective: false };
          return { icon: t.icon || 'fa-map-signs', label: t.name || t.label || t.type || String(t), note: t.note || t.description || '', isObjective: !!(t.isObjective || t.objective) };
        });
        if (!terrainTypes.find(t => t.label === 'Boardwalk'))    terrainTypes.unshift({ icon: 'fa-grip-lines', label: 'Boardwalk',    note: 'Elevated walkway — present in every location', isObjective: false });
        if (!terrainTypes.find(t => t.label === 'Thyr Crystal')) terrainTypes.splice(1, 0, { icon: 'fa-gem',        label: 'Thyr Crystal', note: 'Magical resource — mark it', isObjective: false });
      } else {
        terrainTypes = BASE_TERRAIN.slice();
      }

      var scenarioObjectives = (state.scenarioSave && state.scenarioSave.objectives) || [];
      if (scenarioObjectives.length > 0) {
        scenarioObjectives.forEach(obj => {
          var objName = typeof obj === 'string' ? obj : (obj.name || obj.id || 'Objective');
          terrainTypes.push({ icon: 'fa-map-marker', label: objName, note: (obj.description || obj.type || 'Scenario objective') + ' — place as marker', isObjective: true });
        });
      } else {
        terrainTypes.push({ icon: 'fa-map-marker', label: 'Objective Marker', note: 'Scoring marker', isObjective: true });
      }
      window.CC_TC._terrainTypes = terrainTypes;

      var terrainButtons = terrainTypes.map((t, idx) => {
        var accent = t.isObjective ? '#ffd600' : 'var(--cc-primary)';
        return `<button onclick="window.CC_TC.logTerrainPlace(${idx})"
          class="cc-btn cc-btn-secondary cc-tc-terrain-btn">
          <i class="fa ${t.icon}" style="flex-shrink:0;color:${accent};width:1.2rem;text-align:center;"></i>
          <span><strong>${t.label}</strong> <span class="cc-muted" style="font-size:.78rem;">${t.note}</span></span>
        </button>`;
      }).join('');

      var logHtml = state.roundLog.length
        ? `<ul class="cc-tc-terrain-log">${state.roundLog.map(l => `<li class="cc-tc-terrain-log-item">${l}</li>`).join('')}</ul>`
        : `<p class="cc-muted" style="margin:0;">Nothing placed yet.</p>`;

      var npcDirectiveHtml = '';
      if (isNPC) {
        var roll   = Math.random();
        var picked = roll < 0.35 ? terrainTypes.find(t => t.label === 'Boardwalk')
          : roll < 0.50 ? terrainTypes.find(t => t.label === 'Thyr Crystal')
          : roll < 0.75 ? terrainTypes.filter(t => t.isObjective)[Math.floor(Math.random() * terrainTypes.filter(t => t.isObjective).length)]
          : roll < 0.88 ? terrainTypes.find(t => t.label === 'Building')
          : terrainTypes.filter(t => !t.isObjective && ['Rocky Outcrop','Canyon Brush','Ruin / Debris','Barricade'].includes(t.label))[Math.floor(Math.random() * 4)];
        if (!picked) picked = terrainTypes[0];
        var pickedIdx = terrainTypes.indexOf(picked);
        npcDirectiveHtml = `
          <div class="cc-tc-terrain-directive" style="background:${color}18;border:2px solid ${color};">
            <div class="cc-tc-terrain-dir-label" style="color:${color};">${fname} (NPC) — Terrain Directive</div>
            <div class="cc-tc-terrain-dir-piece" style="color:#fff;">
              <i class="fa ${picked.icon}" style="color:${color};margin-right:.5rem;"></i>Place: ${picked.label}
            </div>
            <p class="cc-muted" style="font-size:.85rem;margin:0 0 .7rem;">${picked.note}</p>
            <button onclick="window.CC_TC.logTerrainPlace(${pickedIdx})"
              class="cc-btn" style="background:${color};color:#000;width:100%;">Log This Placement →</button>
          </div>`;
      }

      root.innerHTML = `
        <div class="cc-app-shell h-100">
          <div class="cc-app-header">
            <div class="cc-tc-header-left">
              ${logoHtml(activeFaction, 32)}
              <div>
                <div class="cc-tc-header-faction" style="color:${color};">${fname}</div>
                <div class="cc-tc-header-meta">Round 0 — Terrain Setup — Turn ${state.setupTurnIndex + 1}</div>
              </div>
            </div>
          </div>
          <div class="cc-tc-body" style="display:flex;flex-direction:column;gap:.75rem;">
            ${isNPC ? npcDirectiveHtml : `
              <div class="cc-tc-terrain-directive" style="background:${color}18;border:2px solid ${color};">
                <div class="cc-tc-terrain-dir-piece" style="color:${color};">${fname}</div>
                <p class="cc-muted" style="font-size:.85rem;margin:0;">Place one terrain piece anywhere on the board, then tap what you placed below.</p>
              </div>`}
            ${!isNPC ? `
              <div class="cc-panel">
                <div class="cc-panel-header"><h5 style="margin:0;color:var(--cc-primary);">What did you place?</h5></div>
                <div class="cc-panel-body" style="display:flex;flex-direction:column;gap:.4rem;">${terrainButtons}</div>
              </div>
              <button onclick="window.CC_TC.skipTerrainTurn()" class="cc-btn cc-btn-secondary" style="width:100%;">
                Pass — no placement this turn
              </button>` : ''}
            <div class="cc-panel">
              <div class="cc-panel-header"><h5 style="margin:0;">Board So Far</h5></div>
              <div class="cc-panel-body">${logHtml}</div>
            </div>
            <button onclick="window.CC_TC.beginRound1()" class="cc-btn" style="width:100%;padding:.85rem;">
              Terrain is Set — Begin Round 1 →
            </button>
          </div>
        </div>`;
    }

    // ═════════════════════════════════════════════════════════════════════════
    // RENDER: FACTION SETUP
    // ═════════════════════════════════════════════════════════════════════════

    function renderFactionSetup() {
      if (state.loadingData) {
        root.innerHTML = `
          <div class="cc-app-shell h-100 cc-tc-banner-wrap" style="flex-direction:column;gap:1rem;">
            <div class="cc-tc-loading-icon"><i class="fa fa-cog"></i></div>
            <p class="cc-tc-loading-msg">Loading faction saves...</p>
          </div>`;
        return;
      }

      var leftRows = state.pendingFactions.map(pf => {
        var meta       = FACTION_META[pf.id] || {};
        var color      = meta.color || '#888';
        var fname      = meta.name  || pf.id;
        var assignment = state.factionAssignments[pf.id];
        var isAssigned = !!assignment;
        var isSkipped  = !!pf.skipped;
        var cardBorder = isSkipped ? 'border:1px solid #333;' : `border:1px solid ${color}${isAssigned ? '33' : '66'};`;
        var cardClass  = 'cc-tc-faction-card' + (isSkipped ? ' cc-tc-faction-card--skipped' : '');
        return `
          <div class="${cardClass}" style="${cardBorder}">
            <div class="cc-tc-faction-row-head">
              <img src="${LOGO_BASE + pf.id}_logo.svg" alt="${fname}"
                class="cc-faction-logo cc-tc-faction-logo--sm"
                style="filter:drop-shadow(0 0 3px ${color}88)${isSkipped ? ' grayscale(1)' : ''};"
                onerror="this.onerror=null;this.outerHTML='<div style=\\'width:28px;height:28px;border-radius:50%;background:${color}22;border:2px solid ${color};display:flex;align-items:center;justify-content:center;font-weight:900;font-size:.75rem;color:${color};flex-shrink:0;\\'>${fname[0]}</div>'" />
              <strong style="flex:1;color:${isSkipped ? '#555' : color};font-size:.9rem;">
                ${fname}${isSkipped ? ` <span class="cc-tc-faction-name-skipped">(skipped)</span>` : ''}
              </strong>
              ${!isSkipped ? `<label class="cc-tc-npc-toggle">
                <input type="checkbox" id="npc_toggle_${pf.id}"${pf.npc ? ' checked' : ''}
                  onchange="window.CC_TC.toggleNPC('${pf.id}')"> NPC</label>` : ''}
            </div>
            ${!isSkipped && state.factionSaveList.length > 0 ? `
              <button onclick="window.CC_TC.openFactionSavePicker('${pf.id}')"
                class="cc-btn cc-btn-secondary" style="width:100%;font-size:.75rem;padding:.3rem .5rem;margin-bottom:.4rem;">
                <i class="fa ${isAssigned ? 'fa-refresh' : 'fa-folder-open'}"></i>
                ${isAssigned ? ' Change Save' : ' Browse Saves'}
              </button>` :
              (!isSkipped ? `<div class="cc-muted" style="font-size:.75rem;text-align:center;padding:.25rem 0 .4rem;">No saves found — will use default</div>` : '')}
            <button onclick="window.CC_TC.toggleSkip('${pf.id}')"
              class="cc-btn ${isSkipped ? 'cc-btn-secondary' : ''}"
              style="width:100%;font-size:.72rem;padding:.25rem .5rem;${!isSkipped ? 'color:#ef5350;border-color:#ef535044;background:rgba(239,83,80,.06);' : ''}">
              ${isSkipped ? '↩ Include This Faction' : '✕ Skip This Faction'}
            </button>
          </div>`;
      }).join('');

      var rightRows = state.pendingFactions.filter(pf => !pf.skipped).map(pf => {
        var meta       = FACTION_META[pf.id] || {};
        var color      = meta.color || '#888';
        var fname      = meta.name  || pf.id;
        var assignment = state.factionAssignments[pf.id];
        if (assignment) {
          var saveName  = assignment.docName.replace(/_/g,' ').replace(/[0-9]{13}/,'').trim();
          var saveDoc   = (state.factionSaveList || []).find(d => d.id === assignment.docId);
          var pts       = saveDoc && saveDoc._totalPoints ? saveDoc._totalPoints + ' pts' : '';
          var unitCount = saveDoc && saveDoc._unitCount   ? saveDoc._unitCount   + ' units' : '';
          return `
            <div class="cc-tc-faction-card cc-tc-faction-card--assigned" style="border:2px solid ${color};background:${color}18;">
              <div class="cc-tc-faction-row-head">
                <img src="${LOGO_BASE + pf.id}_logo.svg" alt="${fname}"
                  class="cc-faction-logo cc-tc-faction-logo--lg"
                  style="filter:drop-shadow(0 0 4px ${color}88);"
                  onerror="this.onerror=null;this.outerHTML='<div style=\\'width:44px;height:44px;border-radius:50%;background:${color}22;border:2px solid ${color};display:flex;align-items:center;justify-content:center;font-weight:900;font-size:1rem;color:${color};flex-shrink:0;\\'>${fname[0]}</div>'" />
                <span style="color:${color};font-size:.8rem;font-weight:700;flex:1;">${fname}</span>
                <button onclick="window.CC_TC.clearFactionSave('${pf.id}')"
                  style="background:none;border:none;color:#ef5350;cursor:pointer;font-size:.8rem;padding:0;" title="Remove">✕</button>
              </div>
              <div class="cc-tc-assigned-name">${saveName}</div>
              ${pts || unitCount ? `<div class="cc-tc-assigned-meta">${[pts, unitCount].filter(Boolean).join(' · ')}</div>` : ''}
            </div>`;
        } else {
          return `
            <div class="cc-tc-empty-slot">
              <span class="cc-tc-empty-slot-label">
                <i class="fa fa-arrow-left" style="margin-right:.4rem;"></i>${fname}<br>
                <span style="font-size:.7rem;">using default roster</span>
              </span>
            </div>`;
        }
      }).join('');

      var activeFactions = state.pendingFactions.filter(pf => !pf.skipped);
      var allAssigned    = activeFactions.every(pf => !!state.factionAssignments[pf.id]);

      root.innerHTML = `
        <div class="cc-app-shell h-100" style="display:flex;flex-direction:column;">
          <div class="cc-app-header">
            <div><h1 class="cc-app-title">Coffin Canyon</h1><div class="cc-app-subtitle">${state.scenarioName || 'Faction Setup'}</div></div>
            <button class="cc-btn cc-btn-secondary" onclick="window.CC_TC.backToSetup()">← Back</button>
          </div>
          <div style="flex:1;overflow-y:auto;padding:1rem;">
            ${state.scenarioSave ? `
              <div class="cc-tc-scenario-hook">
                ${state.scenarioSave.narrative_hook || ''}
                ${(state.scenarioSave.objectives || []).length ? ` <strong style="color:#ccc;">Objectives:</strong> ${(state.scenarioSave.objectives || []).map(o => o.name || String(o)).join(' · ')}` : ''}
              </div>` : ''}
            <div class="cc-tc-faction-grid">
              <div class="cc-panel">
                <div class="cc-panel-header" style="padding:.6rem .85rem;">
                  <h5 style="margin:0;color:var(--cc-primary);font-size:.78rem;text-transform:uppercase;letter-spacing:.08em;">
                    <i class="fa fa-folder-open"></i> Assign Rosters
                  </h5>
                </div>
                <div class="cc-panel-body" style="display:flex;flex-direction:column;gap:.5rem;padding:.75rem;">${leftRows}</div>
              </div>
              <div class="cc-panel">
                <div class="cc-panel-header" style="padding:.6rem .85rem;">
                  <h5 style="margin:0;color:var(--cc-primary);font-size:.78rem;text-transform:uppercase;letter-spacing:.08em;">
                    <i class="fa fa-check-circle"></i> Confirmed
                  </h5>
                </div>
                <div class="cc-panel-body" style="display:flex;flex-direction:column;gap:.5rem;padding:.75rem;">${rightRows}</div>
              </div>
            </div>
            ${state.factionSaveList.length === 0 ? `<p class="cc-muted" style="text-align:center;margin:.75rem 0 0;font-size:.78rem;">No saved rosters found — all factions will use default game data.</p>` : ''}
            <div style="margin-top:1rem;">
              <button class="cc-btn" style="width:100%;font-size:1rem;padding:.85rem;"
                onclick="window.CC_TC.startFromFactionSetup()">
                ${allAssigned ? 'Begin Game →' : 'Begin Game with Defaults →'}
              </button>
            </div>
          </div>
        </div>`;
    }

    // ═════════════════════════════════════════════════════════════════════════
    // DESTROYED GUARD & RENDER ROUTER
    // ═════════════════════════════════════════════════════════════════════════

    var _destroyed = false;
    function isRootAlive() { return !_destroyed && root && document.body.contains(root); }

    function destroyApp() {
      if (_destroyed) return;
      _destroyed = true;
      if (_timerInterval) { clearInterval(_timerInterval); _timerInterval = null; }
      if (window._ccAbilityPoll) { clearInterval(window._ccAbilityPoll); delete window._ccAbilityPoll; }
      ['cc-ability-overlay','cc-roll-overlay','cc-monster-alert',
       'cc-tc-scenario-panel','cc-tc-save-picker','cc-tc-panel-backdrop'].forEach(id => {
        var el = document.getElementById(id);
        if (el) el.remove();
      });
      window.CC_TC = null;
      if (_rootObserver) { _rootObserver.disconnect(); _rootObserver = null; }
      console.log('[CC] Turn Counter destroyed');
    }

    var _rootObserver = null;
    if (window.MutationObserver && root && root.parentNode) {
      _rootObserver = new MutationObserver(() => { if (!document.body.contains(root)) destroyApp(); });
      _rootObserver.observe(root.parentNode, { childList: true, subtree: false });
    }
    window.CC_APP.destroy = destroyApp;

    function render() {
      if (!isRootAlive()) return;
      switch (state.phase) {
        case 'setup':         return renderSetup();
        case 'quick_setup':   return renderQuickSetup();
        case 'setup_round':   return renderSetupRound();
        case 'faction_setup': return renderFactionSetup();
        case 'round_banner':  return renderRoundBanner();
        case 'activation':    return renderActivation();
        case 'round_end':     return renderRoundEnd();
        default:              return renderSetup();
      }
    }

    // ═════════════════════════════════════════════════════════════════════════
    // EVENT HANDLERS
    // ═════════════════════════════════════════════════════════════════════════

    window.CC_TC.backToSetup    = () => { state.phase = 'setup'; render(); };
    window.CC_TC.startQuickMode = () => { state.phase = 'quick_setup'; render(); };

    window.CC_TC.startFromQuickSetup = async function() {
      try {
        var checked = Array.from(document.querySelectorAll('input[name="faction"]:checked'));
        if (checked.length < 2) { alert('Please select at least 2 factions.'); return; }
        state.loadingData = true; state.factions = []; render();
        for (var cb of checked) {
          var id    = cb.value, meta = FACTION_META[id];
          var sel   = document.querySelector(`select[name="npc_${id}"]`);
          var isNPC = !sel || sel.value === 'npc';
          var fData = await loadFactionData(id);
          var faction = fData ? buildFactionEntry(id, fData, isNPC, meta.isMonster) : buildQuickFaction(id, meta.name, 3, isNPC, meta.isMonster);
          initUnitStates(faction); state.factions.push(faction);
        }
        state.loadingData = false;
        window.CC_TC.beginGame();
      } catch (err) { state.loadingData = false; state.phase = 'setup'; render(); alert('Failed to start game: ' + safeErr(err)); }
    };

    window.CC_TC.closeScenarioPanel = () => closeAllSlidePanels();

    window.CC_TC.openScenarioList = function() {
      if (!window.CC_STORAGE) { alert('Storage not available.'); return; }
      closeAllSlidePanels(); installPanelBackdrop();
      var panel = document.createElement('div');
      panel.id = 'cc-tc-scenario-panel'; panel.className = 'cc-slide-panel';
      panel.addEventListener('click', e => e.stopPropagation());
      panel.innerHTML = `
        <div class="cc-slide-panel-header">
          <h2><i class="fa fa-map"></i> LOAD SCENARIO</h2>
          <button onclick="window.CC_TC.closeScenarioPanel()" class="cc-panel-close-btn"><i class="fa fa-times"></i></button>
        </div>
        <div class="cc-roster-list" id="cc-tc-scenario-list">
          <div style="padding:1.5rem;color:#888;text-align:center;"><i class="fa fa-spinner fa-spin"></i> Loading saves...</div>
        </div>`;
      document.body.appendChild(panel);
      setTimeout(() => panel.classList.add('cc-slide-panel-open'), 10);
      window.CC_STORAGE.loadDocumentList(SCENARIO_FOLDER).then(docs => {
        var scenarios = (docs || []).filter(d => d.name && d.name.indexOf('SCN_') === 0);
        var listEl = document.getElementById('cc-tc-scenario-list');
        if (!listEl) return;
        if (!scenarios.length) {
          listEl.innerHTML = `<div style="padding:1.5rem;color:#888;"><p>No scenario saves found.</p><p style="font-size:.85rem;">Save a scenario in the Scenario Builder first.</p></div>`;
          return;
        }
        listEl.innerHTML = scenarios.map(d => {
          var label = d.name.replace(/^SCN_/,'').replace(/_\d{13}$/,'').replace(/_/g,' ').trim();
          var date  = d.write_date ? new Date(d.write_date).toLocaleDateString() : '';
          return `<div class="cc-saved-roster-item">
            <div class="cc-saved-roster-name">${label}</div>
            ${date ? `<div class="cc-saved-roster-meta">${date}</div>` : ''}
            <div class="cc-saved-roster-actions">
              <button onclick="window.CC_TC.loadScenario(${d.id})" class="btn-outline-warning"><i class="fa fa-folder-open"></i> LOAD</button>
            </div>
          </div>`;
        }).join('');
      }).catch(err => {
        var listEl = document.getElementById('cc-tc-scenario-list');
        if (listEl) listEl.innerHTML = `<div style="padding:1.5rem;color:#f66;">Failed to load: ${safeErr(err)}</div>`;
      });
    };

    window.CC_TC.loadScenario = async function(docId) {
      window.CC_TC.closeScenarioPanel();
      try {
        var doc     = await safeLoadDocument(docId);
        var payload = docToJson(doc);
        if (!payload) throw new Error('Scenario save is empty or unreadable. Try re-saving it in the Scenario Builder.');
        state.scenarioSave   = payload.scenario || payload;
        state.scenarioName   = payload.name || (payload.scenario && payload.scenario.name) || 'Scenario';
        state.noiseThreshold = 8 + ((payload.danger || (payload.scenario && payload.scenario.danger_rating) || 3) * 2);
        var mp = state.scenarioSave && state.scenarioSave.monster_pressure;
        state.monsterRoster  = (mp && mp.monsters) || [];
        var rawFactions = payload.factions || (payload.scenario && payload.scenario.factions) || [];
        state.pendingFactions = rawFactions
          .map(f => ({ id: f.id, npc: f.npc !== undefined ? f.npc : (f.isNPC !== undefined ? f.isNPC : true), skipped: false }))
          .filter(f => !!FACTION_META[f.id]);
        if (!state.pendingFactions.length) { alert('No valid factions found in this scenario save.'); state.phase = 'setup'; render(); return; }
        state.factionAssignments = {};
        state.pendingFactions.forEach(f => { state.factionAssignments[f.id] = null; });
        state.loadingData = true; render();
        try {
          var allDocs     = await window.CC_STORAGE.loadDocumentList(FACTION_SAVE_FOLDER).catch(() => []);
          var nonScenario = (allDocs || []).filter(d => d.name && d.name.indexOf('SCN_') !== 0);
          state.factionSaveList = await Promise.all(nonScenario.map(async d => {
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
        } catch (e) { state.factionSaveList = []; console.warn('Faction save list failed:', safeErr(e)); }
        state.loadingData = false;
        state.phase = 'faction_setup';
        render();
      } catch (err) { alert('Failed to load scenario: ' + safeErr(err)); state.loadingData = false; state.phase = 'setup'; render(); }
    };

    window.CC_TC.openGameList = () => alert('Resume coming soon — save/load is in the next build pass!');

    window.CC_TC.toggleNPC = function(factionId) {
      var el = document.getElementById('npc_toggle_' + factionId);
      var pf = state.pendingFactions.find(f => f.id === factionId);
      if (pf && el) pf.npc = el.checked;
    };

    window.CC_TC.toggleSkip = function(factionId) {
      var pf   = state.pendingFactions.find(f => f.id === factionId);
      var meta = FACTION_META[factionId] || {};
      if (!pf) return;
      if (!pf.skipped && meta.isMonster) {
        if (!confirm(`${meta.name || factionId} is the Monster faction.\n\nSkipping disables monster encounters and the noise system.\n\nSkip anyway?`)) return;
      }
      pf.skipped = !pf.skipped;
      var active = state.pendingFactions.filter(f => !f.skipped);
      if (active.length < 2) { pf.skipped = false; alert('You need at least 2 factions to play.'); render(); return; }
      render();
    };

    window.CC_TC.openFactionSavePicker = function(factionId) {
      var meta = FACTION_META[factionId] || {};
      var docs = (state.factionSaveList || []).filter(d => !d._factionId || d._factionId === factionId);
      if (!docs.length) { alert(`No saved builds found for ${meta.name || factionId}.\n\nBuild and save a roster in the Faction Builder first.`); return; }
      var items = docs.map(d => {
        var label   = (d.name || String(d.id)).replace(/\.json$/i,'').replace(/_\d{10,}/,'').replace(/_/g,' ').trim();
        var pts     = d._totalPoints ? ' — ' + d._totalPoints + ' pts' : '';
        var faction = d._factionName ? ' (' + d._factionName + ')' : '';
        return `<button onclick="window.CC_TC.selectFactionSave('${factionId}',${d.id})"
          class="cc-btn cc-btn-secondary" style="width:100%;margin-bottom:.4rem;text-align:left;justify-content:space-between;">
          <span>${label}${faction}</span>
          ${pts ? `<span class="cc-muted" style="font-size:.78rem;flex-shrink:0;">${pts}</span>` : ''}
        </button>`;
      }).join('');
      var overlay = document.createElement('div');
      overlay.id = 'cc-tc-save-picker';
      overlay.className = 'cc-tc-save-picker';
      overlay.innerHTML = `
        <div class="cc-tc-save-picker-card">
          <h5 style="margin:0 0 .25rem;color:var(--cc-primary);">Pick a Saved Build</h5>
          <p class="cc-muted" style="margin:0 0 .75rem;font-size:.8rem;">For: <strong style="color:#ccc;">${meta.name || factionId}</strong></p>
          ${items}
          <button onclick="document.getElementById('cc-tc-save-picker').remove()"
            class="cc-btn cc-btn-secondary" style="width:100%;margin-top:.5rem;">Cancel</button>
        </div>`;
      document.body.appendChild(overlay);
    };

    window.CC_TC.selectFactionSave = function(factionId, docId) {
      var doc     = (state.factionSaveList || []).find(d => d.id === docId);
      var docName = doc && (doc.name || doc._armyName || doc._factionName) ? (doc.name || doc._armyName || doc._factionName) : String(docId);
      state.factionAssignments[factionId] = { docId, docName };
      var picker = document.getElementById('cc-tc-save-picker');
      if (picker) picker.remove();
      render();
    };

    window.CC_TC.clearFactionSave = function(factionId) {
      state.factionAssignments[factionId] = null; render();
    };

    window.CC_TC.startFromFactionSetup = async function() {
      state.loadingData = true; state.factions = []; render();
      for (var pf of state.pendingFactions) {
        if (pf.skipped) continue;
        var meta    = FACTION_META[pf.id];
        var assign  = state.factionAssignments[pf.id];
        var faction = null;
        if (assign && assign.docId) {
          var saveDoc = await safeLoadDocument(assign.docId);
          if (saveDoc) {
            var saveParsed = docToJson(saveDoc);
            if (saveParsed) faction = buildFactionFromSave(pf.id, saveParsed, pf.npc);
          }
          if (!faction) assign = null;
        }
        if (!faction) {
          var fData = await loadFactionData(pf.id);
          faction = fData ? buildFactionEntry(pf.id, fData, pf.npc, meta.isMonster) : buildQuickFaction(pf.id, meta.name, 3, pf.npc, meta.isMonster);
        }
        initUnitStates(faction); state.factions.push(faction);
      }
      state.loadingData = false;
      window.CC_TC.beginGame();
    };

    window.CC_TC.logTerrainPlace = function(idx) {
      var t     = (window.CC_TC._terrainTypes || [])[idx];
      var label = t ? t.label : 'Terrain';
      var f     = state.factions[state.setupTurnIndex % Math.max(state.factions.length, 1)];
      state.roundLog.push(`[${label}] ${f ? f.name : 'Unknown'} placed: ${label}`);
      state.setupTurnIndex++; render();
    };

    window.CC_TC.skipTerrainTurn = function() {
      var f = state.factions[state.setupTurnIndex % Math.max(state.factions.length, 1)];
      state.roundLog.push(`— ${f ? f.name : 'Unknown'} passed.`);
      state.setupTurnIndex++; render();
    };

    window.CC_TC.beginGame = function() {
      state.round = 0; state.unitState = {}; state.noiseLevel = 0;
      state.roundLog = []; state.allRoundLogs = []; state.coughSeverity = 0;
      state.monstersTriggered = 0; state.setupTurnIndex = 0;
      state.factions.forEach(f => initUnitStates(f));
      state.phase = 'setup_round';
      loadAbilityDictionaries(); loadMonstersFactionData();
      render();
    };

    window.CC_TC.beginRound1 = function() {
      state.round = 1; buildQueue(); state.phase = 'round_banner'; render();
    };

    window.CC_TC.startRound = function() {
      state.phase = 'activation'; state.timerElapsed = 0;
      state.timerRunning = true; state.timerStart = Date.now(); render();
    };

    window.CC_TC.nextActivation = function() {
      if (state.timerRunning) { state.timerElapsed += Date.now() - state.timerStart; state.timerRunning = false; }
      var hasMore = advanceQueue();
      if (!hasMore || isRoundComplete()) { endRound(); }
      else { state.timerElapsed = 0; state.timerRunning = true; state.timerStart = Date.now(); render(); }
    };

    window.CC_TC.markOut = function() {
      var item = currentQueueItem();
      if (!item || !confirm('Mark this unit as OUT?')) return;
      setUnitState(item.factionId, item.unitId, { out: true });
      var faction = getFactionById(item.factionId);
      var unit    = getUnitById(faction, item.unitId);
      state.roundLog.push(`✖ ${faction ? faction.name : ''}: ${unit ? unit.name : ''} is OUT.`);
      window.CC_TC.nextActivation();
    };

    window.CC_TC.adjustQuality = function(factionId, unitId, delta) {
      var us   = getUnitState(factionId, unitId);
      var unit = getUnitById(getFactionById(factionId), unitId);
      if (!us || !unit) return;
      var newQ = Math.max(0, Math.min(unit.quality, (us.quality || 0) + delta));
      setUnitState(factionId, unitId, { quality: newQ });
      if (newQ === 0 && confirm(`${unit.name} is at Q0 — mark them OUT?`)) {
        setUnitState(factionId, unitId, { out: true });
        state.roundLog.push(`✖ ${getFactionById(factionId)?.name || ''}: ${unit.name} is OUT (Q0).`);
        window.CC_TC.nextActivation(); return;
      }
      render();
    };

    // ═════════════════════════════════════════════════════════════════════════
    // ABILITY LOOKUP SYSTEM
    // ═════════════════════════════════════════════════════════════════════════

    var _abilityCache = {}, _abilityFetched = false, _abilityFetching = false;

    var ABILITY_FILES = [
      '90_ability_dictionary_A.json','91_ability_dictionary_B.json','92_ability_dictionary_C.json',
      '93_ability_dictionary_D.json','94_ability_dictionary_E.json','95_ability_dictionary_F.json',
      '96_ability_dictionary_G.json','97_ability_dictionary_H.json',
    ];
    var ABILITY_BASE = 'https://raw.githubusercontent.com/steamcrow/coffin/main/rules/src/';

    function ingestAbilityFile(data) {
      if (!data || typeof data.abilities !== 'object') return 0;
      var count = 0;
      Object.keys(data.abilities).forEach(slug => {
        var entry = data.abilities[slug];
        if (!entry || typeof entry !== 'object') return;
        _abilityCache[slug] = { name: slugToName(slug), id: entry._id || '', timing: entry.timing || '', short: entry.short || '', long: entry.long || '' };
        count++;
      });
      return count;
    }

    function slugToName(slug) { return slug.replace(/_/g,' ').replace(/\b\w/g, c => c.toUpperCase()); }
    function formatTiming(timing) { if (!timing) return ''; return timing.replace(/_/g,' ').replace(/\b\w/g, c => c.toUpperCase()); }

    function loadAbilityDictionaries() {
      if (_abilityFetched || _abilityFetching) return;
      _abilityFetching = true;
      Promise.all(ABILITY_FILES.map(f =>
        fetch(ABILITY_BASE + f + '?t=' + Date.now()).then(r => r.ok ? r.text() : '{}')
          .then(text => { var data = safeParseJson(text); if (data) ingestAbilityFile(data); })
          .catch(e => console.warn('[CC] Ability file failed:', f, safeErr(e)))
      )).then(() => { _abilityFetched = true; _abilityFetching = false; console.log('[CC] Abilities loaded — ' + Object.keys(_abilityCache).length + ' entries'); });
    }

    function lookupAbility(displayName) {
      if (!displayName) return null;
      var slug = String(displayName).trim().toLowerCase().replace(/\s+/g,'_');
      if (_abilityCache[slug]) return _abilityCache[slug];
      var base = slug.replace(/_\d+$/, '');
      if (_abilityCache[base]) return _abilityCache[base];
      var flat = slug.replace(/_/g,'');
      var keys = Object.keys(_abilityCache);
      for (var i = 0; i < keys.length; i++) { if (keys[i].replace(/_/g,'') === flat) return _abilityCache[keys[i]]; }
      var firstWord = slug.split('_')[0];
      if (firstWord.length >= 4) {
        for (var j = 0; j < keys.length; j++) { if (keys[j] === firstWord || keys[j].startsWith(firstWord + '_')) return _abilityCache[keys[j]]; }
      }
      return null;
    }

    window.CC_TC.closeAbilityPanel = () => closeAllSlidePanels();

    window.CC_TC.openAbilityPanel = function(idx) {
      if (_destroyed) return;
      var abilityName = (window.CC_TC._currentUnitAbilities || [])[idx];
      if (!abilityName) return;
      loadAbilityDictionaries();
      closeAllSlidePanels(); installPanelBackdrop();
      var panel = document.createElement('div');
      panel.id = 'cc-tc-ability-panel'; panel.className = 'cc-slide-panel';
      panel.addEventListener('click', e => e.stopPropagation());

      if (_abilityFetching && !_abilityFetched) {
        panel.innerHTML = `
          <div class="cc-slide-panel-header">
            <h2>${abilityName.toUpperCase()}</h2>
            <button onclick="window.CC_TC.closeAbilityPanel()" class="cc-panel-close-btn"><i class="fa fa-times"></i></button>
          </div>
          <div class="cc-tc-panel-loading">
            <div class="cc-tc-panel-spinner">⟳</div>
            Loading ability dictionary…
          </div>`;
        document.body.appendChild(panel);
        setTimeout(() => panel.classList.add('cc-slide-panel-open'), 10);
        var _retries = 0;
        var _poll = setInterval(() => {
          _retries++;
          if (_abilityFetched || _retries > 26 || _destroyed) {
            clearInterval(_poll); window._ccAbilityPoll = null;
            var ov = document.getElementById('cc-tc-ability-panel');
            if (ov) { ov.classList.remove('cc-slide-panel-open'); setTimeout(() => { if (ov.parentNode) ov.parentNode.removeChild(ov); }, 300); }
            if (_abilityFetched && !_destroyed && window.CC_TC) window.CC_TC.openAbilityPanel(idx);
          }
        }, 300);
        window._ccAbilityPoll = _poll;
        return;
      }

      var entry        = lookupAbility(abilityName);
      var timingLabel  = entry ? formatTiming(entry.timing) : '';
      var timingColors = {
        'Passive': '#90a4ae', 'Main Action': '#42a5f5', 'Once Per Activation': '#ffd600',
        'Once Per Round': '#ff9800', 'Once Per Game': '#ef5350', 'Deployment': '#9c27b0', 'Reaction': '#4caf50',
      };
      var timingColor = timingColors[timingLabel] || '#888';

      var bodyHtml = entry ? `
        ${timingLabel ? `<div class="cc-tc-type-tag" style="border:1px solid ${timingColor};color:${timingColor};">${timingLabel}</div><br>` : ''}
        ${entry.short ? `<p class="cc-tc-ability-short">${entry.short}</p>` : ''}
        ${entry.long  ? `<p class="cc-tc-ability-long">${entry.long}</p>`   : ''}
        ${entry.id    ? `<div class="cc-tc-ability-ref">${entry.id}</div>`  : ''}` : `
        <p class="cc-tc-no-ability-msg">No rule entry found for <em style="color:#bbb;">${abilityName}</em>.</p>
        <p class="cc-tc-no-ability-hint">Open the Rules Explorer and search for <em>${abilityName.split(' ')[0]}</em>.</p>`;

      panel.innerHTML = `
        <div class="cc-slide-panel-header">
          <h2>${abilityName.toUpperCase()}</h2>
          <button onclick="window.CC_TC.closeAbilityPanel()" class="cc-panel-close-btn"><i class="fa fa-times"></i></button>
        </div>
        <div class="cc-tc-panel-body">${bodyHtml}</div>`;
      document.body.appendChild(panel);
      setTimeout(() => panel.classList.add('cc-slide-panel-open'), 10);
    };

    window.CC_TC.showAbilityRule = window.CC_TC.openAbilityPanel;

    window.CC_TC.rollQualityForUnit = function(factionId, unitId) {
      var faction = getFactionById(factionId), unit = getUnitById(faction, unitId), us = getUnitState(factionId, unitId);
      if (!unit || !us || us.out) return;
      if (us.lastRoll) { showRollResult(us.lastRoll, unit.name, true); return; }
      var currentQ = us.quality || unit.quality;
      if (currentQ < 1) return;
      var result = rollQuality(currentQ);
      setUnitState(factionId, unitId, { lastRoll: result });
      showRollResult(result, unit.name, false);
    };

    window.CC_TC.logNoise    = function(key) { var n = NOISE_VALUES[key]; if (!n) return; addNoise(n.value, n.label); render(); };
    window.CC_TC.toggleTimer = function() {
      if (state.timerRunning) { state.timerElapsed += Date.now() - state.timerStart; state.timerRunning = false; }
      else { state.timerStart = Date.now(); state.timerRunning = true; startTimerDisplay(); }
      render();
    };

    window.CC_TC.saveGame = async function() {
      if (!window.CC_STORAGE) { alert('Storage not available.'); return; }
      var name = 'GAME_Round' + state.round + '_' + Date.now();
      try {
        await window.CC_STORAGE.saveDocument(name, JSON.stringify({
          version: '1.0', scenarioName: state.scenarioName, round: state.round,
          unitState: state.unitState, noiseLevel: state.noiseLevel, coughSeverity: state.coughSeverity,
          timerElapsed: state.timerElapsed, roundLog: state.roundLog, allRoundLogs: state.allRoundLogs,
          monstersTriggered: state.monstersTriggered, timestamp: new Date().toISOString()
        }), TURN_SAVE_FOLDER);
        var btn = document.querySelector('[onclick="window.CC_TC.saveGame()"]');
        if (btn) { var orig = btn.innerHTML; btn.innerHTML = '✅'; setTimeout(() => btn.innerHTML = orig, 1500); }
      } catch (err) { alert('Save failed: ' + safeErr(err)); }
    };

    window.CC_TC.beginNextRound = function() {
      state.allRoundLogs.push({ round: state.round, log: state.roundLog.slice() });
      state.roundLog = []; state.round++;
      deployReserves(); buildQueue();
      state.phase = 'round_banner'; render();
    };

    // ═════════════════════════════════════════════════════════════════════════
    // ROUND END & BOOT
    // ═════════════════════════════════════════════════════════════════════════

    function endRound() {
      clearInterval(_timerInterval); state.timerRunning = false;
      state.phase = 'round_end'; render();
    }

   state.phase = 'setup';
    render();

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
