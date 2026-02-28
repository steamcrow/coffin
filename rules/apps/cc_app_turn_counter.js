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

window.CC_APP = {
  init({ root, ctx }) {
    console.log("🚀 Turn Counter init", ctx);

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

    // ── Load app-specific CSS ────────────────────────────────────────────────
    if (!document.getElementById('cc-turn-counter-styles')) {
      fetch('https://raw.githubusercontent.com/steamcrow/coffin/main/rules/apps/cc_app_turn_counter.css?t=' + Date.now())
        .then(r => r.text())
        .then(css => {
          const s = document.createElement('style');
          s.id = 'cc-turn-counter-styles';
          s.textContent = css;
          document.head.appendChild(s);
        })
        .catch(() => console.warn('⚠️ Turn Counter CSS not found — using inline styles only'));
    }

    // ── Load CC_STORAGE helper ────────────────────────────────────────────────
    if (!window.CC_STORAGE) {
      fetch('https://raw.githubusercontent.com/steamcrow/coffin/main/rules/src/storage_helpers.js?t=' + Date.now())
        .then(r => r.text())
        .then(code => {
          const s = document.createElement('script');
          s.textContent = code;
          document.head.appendChild(s);
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

    // Faction logo PNGs — grey, transparent background.
    // Fallback SVG badge is generated inline if the PNG 404s.
    const LOGO_BASE = 'https://raw.githubusercontent.com/steamcrow/coffin/main/rules/apps/';

    // Noise values per logged action
    const NOISE_VALUES = {
      shot:      { label: '🔫 Shot',      value: 2 },
      explosion: { label: '💥 Explosion', value: 3 },
      ritual:    { label: '🔮 Ritual',    value: 4 },
      ability:   { label: '⚡ Ability',   value: 2 },
      silent:    { label: '🤫 Silent',    value: 0 }
    };

    // Canyon event table — fires at round end with escalating probability
    const CANYON_EVENTS = [
      { id: 'dust_devil',   icon: '🌪️', text: 'A dust devil cuts across the board. Ranged attacks are at −1 die until next round.' },
      { id: 'thyr_flare',   icon: '💎', text: 'Thyr crystals flare. Any unit within 3" of a cache tests Quality or is Shaken.' },
      { id: 'supply_cache', icon: '📦', text: 'A supply drop is spotted. Place a bonus cache token at a random board edge.' },
      { id: 'canyon_echo',  icon: '👂', text: 'Sounds carry strangely. Add +2 to current noise.' },
      { id: 'sickness',     icon: '🤧', text: 'Coffin Cough drifts in. Each faction rolls — 1 or 2: one unit tests Quality.' },
      { id: 'silence',      icon: '🌑', text: 'An unnatural silence falls. Monsters stir — add +3 noise.' },
      { id: 'scavengers',   icon: '🐦', text: 'Scavengers at the nearest objective. It becomes Contested regardless of control.' },
      { id: 'nightfall',    icon: '🌙', text: 'Early dark. Reduce all ranged ranges by 3" until end of next round.' },
      { id: 'tremor',       icon: '⚡', text: 'The ground shudders. All Unstable terrain escalates one step.' },
      { id: 'canyon_luck',  icon: '🍀', text: 'Canyon luck. One random unit may remove a Shaken condition immediately.' },
      { id: 'wanted',       icon: '📜', text: 'A wanted poster blows past. Shine Riders gain +1 to their next Quality test.' },
      { id: 'thyr_pulse',   icon: '🔆', text: 'The canyon pulses with Thyr light. All ritual actions cost +1 noise this round.' },
    ];

    const FACTION_LOADER_BASE = 'https://raw.githubusercontent.com/steamcrow/coffin/main/rules/src/';
    const SCENARIO_FOLDER     = 90;
    const TURN_SAVE_FOLDER    = 91;

    // ═══════════════════════════════════════════════════════════════════════════
    // APP STATE
    // ═══════════════════════════════════════════════════════════════════════════

    const state = {
      // Screens: 'splash' | 'setup' | 'round_banner' | 'activation' | 'round_end' | 'game_over'
      phase: 'splash',

      // Loaded data
      scenarioSave:   null,   // full parsed scenario save object
      scenarioName:   '',

      // Factions in this game
      factions: [],
      // [{ id, name, color, isMonster, isNPC, logoUrl,
      //    allUnits: [{id, name, quality, move, combat, shoot, special, cost}],
      //    deployIndex: 0 }]

      // Live unit states — keyed "factionId::unitId"
      unitState: {},
      // { quality: N, out: false, activated: false }

      // Turn tracking
      round:  1,
      queue:  [],          // [{ factionId, unitId }] — ordered activations this round
      queueIndex: 0,       // which activation we're on

      // Noise
      noiseLevel:    0,
      noiseThreshold: 12,  // overridden from scenario save
      monsterRoster: [],   // from scenario monster_pressure
      monstersTriggered: 0,

      // Coffin Cough
      coughSeverity: 0,    // 0–5

      // Timer (per activation)
      timerRunning: false,
      timerStart:   null,
      timerElapsed: 0,

      // Round log
      roundLog: [],
      allRoundLogs: [],

      // Canyon event tracking
      lastEventRound: 0,

      // Setup helpers
      setupMode:    null,    // 'scenario' | 'quick'
      loadingData:  false,
    };

    // ── Unit state key ────────────────────────────────────────────────────────
    function unitKey(factionId, unitId) { return `${factionId}::${unitId}`; }

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
        return await res.json();
      } catch (err) {
        console.warn(`⚠️ Could not load faction data for ${factionId}:`, err.message);
        return null;
      }
    }

    // Build a faction entry from raw JSON data
    function buildFactionEntry(factionId, factionData, isNPC, isMonster) {
      const meta  = FACTION_META[factionId] || {};
      const color = meta.color || '#888';
      const name  = meta.name  || factionId;

      // Normalise units from faction JSON format
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
        deployIndex:  0,   // next unit to deploy when roster grows
      };
    }

    // Build a quick-mode faction with manual unit entries
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

    // Initialise unitState for all active units in a faction
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

    // Active units for a faction this round (not OUT, and deployed)
    function getActiveUnits(faction) {
      return faction.allUnits.filter(u => {
        const us = getUnitState(faction.id, u.id);
        return us && !us.out;
      });
    }

    // Build the activation queue for a round.
    // Monsters activate first; then alternate human/monster one model at a time.
    function buildQueue() {
      const monsterUnits = [];
      const humanUnits   = [];

      state.factions.forEach(f => {
        const active = getActiveUnits(f);
        active.forEach(u => {
          (f.isMonster ? monsterUnits : humanUnits).push({ factionId: f.id, unitId: u.id });
        });
      });

      // Interleave: monsters first, then alternate
      const queue = [];
      let mi = 0, hi = 0;
      while (mi < monsterUnits.length || hi < humanUnits.length) {
        if (mi < monsterUnits.length) queue.push(monsterUnits[mi++]);
        if (hi < humanUnits.length)   queue.push(humanUnits[hi++]);
      }

      state.queue      = queue;
      state.queueIndex = 0;

      // Reset activated flags
      state.factions.forEach(f => {
        f.allUnits.forEach(u => {
          const k = unitKey(f.id, u.id);
          if (state.unitState[k]) state.unitState[k].activated = false;
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

    // Advance to the next non-OUT unit in the queue
    function advanceQueue() {
      // Mark current unit activated
      const cur = currentQueueItem();
      if (cur) {
        setUnitState(cur.factionId, cur.unitId, { activated: true });
      }

      state.queueIndex++;

      // Skip units that went OUT mid-round
      while (state.queueIndex < state.queue.length) {
        const item = state.queue[state.queueIndex];
        const us   = getUnitState(item.factionId, item.unitId);
        if (!us || us.out) { state.queueIndex++; continue; }
        break;
      }

      return state.queueIndex < state.queue.length;
    }

    // Are all activations done this round?
    function isRoundComplete() {
      return state.queueIndex >= state.queue.length;
    }

    // Deploy next reserve unit for each faction at round start
    function deployReserves() {
      state.factions.forEach(f => {
        const active = getActiveUnits(f);
        if (active.length === 0 && f.deployIndex < f.allUnits.length) {
          const nextUnit = f.allUnits[f.deployIndex];
          f.deployIndex++;
          // Restore this unit to play (was OUT, or never activated)
          setUnitState(f.id, nextUnit.id, { quality: nextUnit.quality, out: false, activated: false });
          state.roundLog.push(`🔄 ${f.name}: ${nextUnit.name} deploys.`);
        }
      });
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // NOISE & MONSTER PRESSURE
    // ═══════════════════════════════════════════════════════════════════════════

    function addNoise(amount, label) {
      state.noiseLevel += amount;
      if (amount > 0) state.roundLog.push(`👂 Noise +${amount} (${label})`);
      checkMonsterTrigger();
    }

    function checkMonsterTrigger() {
      if (state.noiseLevel < state.noiseThreshold) return;
      if (state.monstersTriggered >= state.monsterRoster.length) return;

      const monster = state.monsterRoster[state.monstersTriggered];
      state.monstersTriggered++;
      state.noiseLevel = Math.floor(state.noiseLevel / 2);  // noise drops after scare

      const msg = monster
        ? `🐉 Monster Encounter! ${monster.name} approaches from the nearest edge.`
        : `🐉 Monster Encounter! Something stirs in the canyon.`;

      state.roundLog.push(msg);
      showMonsterAlert(monster);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // CANYON EVENTS & COFFIN COUGH
    // ═══════════════════════════════════════════════════════════════════════════

    function rollCanyonEvent() {
      const chance = state.round >= 3 ? 0.5 : 0.33;
      if (Math.random() > chance) return null;
      const ev = CANYON_EVENTS[Math.floor(Math.random() * CANYON_EVENTS.length)];
      state.lastEventRound = state.round;

      // Apply side effects
      if (ev.id === 'canyon_echo') addNoise(2, 'Canyon Echo');
      if (ev.id === 'silence')     addNoise(3, 'Unnatural Silence');

      state.roundLog.push(`${ev.icon} Canyon Event: ${ev.text}`);
      return ev;
    }

    function tickCoffeinCough() {
      if (Math.random() < 0.4) {
        state.coughSeverity = Math.min(5, state.coughSeverity + 1);
      }
      if (state.coughSeverity >= 5) {
        state.roundLog.push('☠️ Coffin Cough Storm! Every unit tests Quality or degrades by 1.');
        setTimeout(() => {
          state.coughSeverity = 2; // storm passes, leaves residue
          render();
        }, 4000);
      }
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // NPC DIRECTIVE ENGINE
    // ═══════════════════════════════════════════════════════════════════════════

    function buildDirective(faction, unit) {
      const motive = state.scenarioSave?.factions?.find(f => f.id === faction.id)?.motive || null;
      const approach = state.scenarioSave?.factions?.find(f => f.id === faction.id)?.approach || 'aggressive';

      // Priority tree
      const us = getUnitState(faction.id, unit.id);
      const q  = us?.quality || unit.quality;

      let priority = '';
      let ifEngaged = `Attack (Q${q}, 2 actions)`;
      let ifClear   = 'Hold position';

      if (motive) {
        priority = motive;
      } else {
        // Generic fallback based on approach
        const approachMap = {
          aggressive:   'Press forward — engage the nearest enemy.',
          defensive:    'Hold current position and protect nearby allies.',
          opportunistic:'Move toward the highest-value unclaimed objective.',
          support:      'Stay near your faction\'s strongest unit.',
        };
        priority = approachMap[approach] || approachMap.aggressive;
      }

      // Objective from scenario
      const primaryObj = state.scenarioSave?.objectives?.[0];
      if (primaryObj?.name) {
        ifClear = `Move toward ${primaryObj.name} and Interact.`;
      }

      return { priority, ifEngaged, ifClear };
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // FACTION LOGO HELPER
    // ═══════════════════════════════════════════════════════════════════════════

    // Renders a faction logo — PNG with CSS tint, falling back to SVG badge if 404.
    function logoHtml(faction, sizePx = 48) {
      const initial = (faction.name || '?')[0].toUpperCase();
      const color   = faction.color || '#888';
      // The onerror swaps to an inline SVG badge
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
      quality: '#ff7518',   // canyon orange
      move:    '#42a5f5',   // blue
      combat:  '#ef5350',   // red
      shoot:   '#ffd600',   // gold
      armor:   '#90a4ae',   // grey
      cost:    '#555',      // dim
    };

    function statBadge(label, value, colorKey, big = false) {
      if (value === null || value === undefined) return '';
      const color = STAT_COLORS[colorKey] || '#888';
      const size  = big ? 'font-size:1.4rem;padding:.4rem .7rem;' : 'font-size:.85rem;padding:.25rem .5rem;';
      return `
        <div class="cc-stat-badge" style="
          display:inline-flex;flex-direction:column;align-items:center;
          background:${color}22;border:1px solid ${color}66;border-radius:6px;
          ${size}min-width:${big ? 56 : 44}px;gap:1px;">
          <span style="color:${color};font-weight:900;line-height:1;">${value}</span>
          <span style="color:${color}99;font-size:.65rem;text-transform:uppercase;
                       letter-spacing:.06em;line-height:1;">${label}</span>
        </div>`;
    }

    // Quality track — tappable dots showing current/max quality
    function qualityTrack(faction, unit) {
      const us  = getUnitState(faction.id, unit.id);
      const cur = us?.quality ?? unit.quality;
      const max = unit.quality;
      const color = cur <= 1 ? '#ef5350' : STAT_COLORS.quality;

      let dots = '';
      for (let i = max; i >= 1; i--) {
        const filled = i <= cur;
        dots += `<button
          onclick="window.CC_TC.adjustQuality('${faction.id}','${unit.id}',${filled ? -1 : 1})"
          class="cc-q-dot ${filled ? 'filled' : 'empty'}"
          style="width:28px;height:28px;border-radius:50%;border:2px solid ${color};
                 background:${filled ? color : 'transparent'};cursor:pointer;
                 transition:all .15s ease;margin:2px;"
          title="${filled ? 'Tap to wound' : 'Tap to heal'}"
        ></button>`;
      }

      return `
        <div class="cc-quality-track" style="display:flex;align-items:center;gap:4px;flex-wrap:wrap;">
          <span style="color:${color}99;font-size:.7rem;text-transform:uppercase;
                       letter-spacing:.08em;margin-right:4px;">Quality</span>
          <div style="display:flex;flex-wrap:wrap;gap:2px;">${dots}</div>
          <span style="color:${color};font-weight:900;font-size:1.1rem;margin-left:6px;">
            ${cur > 0 ? 'Q' + cur : '⚠️ OUT?'}
          </span>
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
              👂 Canyon Noise
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

    // Coffin Cough severity bar
    function coughBarHtml() {
      if (state.coughSeverity === 0) return '';
      const pct   = Math.round((state.coughSeverity / 5) * 100);
      const color = state.coughSeverity >= 4 ? '#ef5350' : '#ff9800';
      const labels = ['','Trace','Mild','Building','Warning','Storm'];
      return `
        <div style="margin:.3rem 0;">
          <div style="display:flex;justify-content:space-between;margin-bottom:3px;">
            <span style="font-size:.7rem;color:#888;text-transform:uppercase;letter-spacing:.08em;">
              ☁️ Coffin Cough
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

    function showMonsterAlert(monster) {
      const name = monster?.name || 'Something from the Canyon';
      const overlay = document.createElement('div');
      overlay.style.cssText = [
        'position:fixed;inset:0;z-index:9999;',
        'background:rgba(0,0,0,.85);',
        'display:flex;align-items:center;justify-content:center;',
        'animation:cc-fade-in .3s ease;'
      ].join('');
      overlay.innerHTML = `
        <div style="text-align:center;padding:2rem;max-width:400px;">
          <div style="font-size:4rem;margin-bottom:1rem;animation:cc-pulse 1s ease infinite;">🐉</div>
          <h2 style="color:#ef5350;margin:0 0 .5rem;font-size:1.8rem;">Monster Encounter!</h2>
          <p style="color:#ffcdd2;font-size:1.1rem;margin:.5rem 0 1.5rem;">${name} approaches from the nearest board edge.</p>
          <button onclick="this.closest('div[style]').remove()" class="cc-btn" style="width:100%;">
            Acknowledged — Continue
          </button>
        </div>`;
      document.body.appendChild(overlay);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // RENDER: SETUP SCREEN
    // ═══════════════════════════════════════════════════════════════════════════

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

          <div style="max-width:600px;margin:0 auto;padding:1.5rem;">

            ${state.loadingData ? `
              <div style="text-align:center;padding:3rem;">
                <div style="font-size:2rem;margin-bottom:1rem;animation:cc-spin 1s linear infinite;">⚙️</div>
                <p style="color:#888;">Loading faction data…</p>
              </div>` : `

            <!-- Mode selector -->
            <div class="cc-panel" style="margin-bottom:1rem;">
              <div class="cc-panel-header">
                <h5 style="margin:0;color:var(--cc-primary);">🎲 Start a Game</h5>
              </div>
              <div class="cc-panel-body">
                <p style="color:#888;font-size:.9rem;margin:0 0 1rem;">
                  Load a saved scenario to get NPC directives, monster pressure, and objectives.
                  Or jump straight in with Quick Mode.
                </p>
                <div style="display:flex;flex-direction:column;gap:.75rem;">
                  ${hasStorage ? `
                    <button class="cc-btn" onclick="window.CC_TC.openScenarioList()" style="text-align:left;">
                      <span style="font-size:1.2rem;margin-right:.75rem;">📋</span>
                      Load Scenario Save
                      <span style="margin-left:auto;font-size:.75rem;color:#888;text-transform:none;">
                        Loads objectives, NPC motives, monsters
                      </span>
                    </button>` : `
                    <div style="padding:.75rem;border:1px solid rgba(255,255,255,.1);border-radius:6px;color:#666;font-size:.85rem;">
                      📋 Storage not available — use Quick Mode
                    </div>`}
                  <button class="cc-btn cc-btn-secondary" onclick="window.CC_TC.startQuickMode()" style="text-align:left;">
                    <span style="font-size:1.2rem;margin-right:.75rem;">⚡</span>
                    Quick Mode
                    <span style="margin-left:auto;font-size:.75rem;color:#888;text-transform:none;">
                      Pick factions and go
                    </span>
                  </button>
                </div>
              </div>
            </div>

            <!-- Resume saved game -->
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
    }

    // ── Quick Mode faction picker ─────────────────────────────────────────────

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
      root.innerHTML = `
        <div class="cc-app-shell h-100" style="display:flex;align-items:center;justify-content:center;">
          <div style="text-align:center;padding:2rem;max-width:400px;">
            <div style="color:var(--cc-primary);font-size:.8rem;text-transform:uppercase;
                        letter-spacing:.2em;margin-bottom:.5rem;">Beginning</div>
            <h1 style="font-size:clamp(3rem,10vw,5rem);margin:0;color:#fff;line-height:1;">
              Round ${state.round}
            </h1>
            <p style="color:#888;margin:.5rem 0 2rem;">
              ${totalActivations} activation${totalActivations !== 1 ? 's' : ''} this round
            </p>

            <!-- Faction lineup -->
            <div style="display:flex;justify-content:center;gap:1rem;flex-wrap:wrap;margin-bottom:2rem;">
              ${state.factions.map(f => {
                const active = getActiveUnits(f);
                if (active.length === 0) return '';
                return `
                  <div style="text-align:center;opacity:${active.length > 0 ? 1 : .3};">
                    ${logoHtml(f, 36)}
                    <div style="color:${f.color};font-size:.7rem;margin-top:4px;font-weight:700;">
                      ${active.length} unit${active.length !== 1 ? 's' : ''}
                    </div>
                  </div>`;
              }).join('')}
            </div>

            ${noiseBarHtml()}
            ${coughBarHtml()}

            <button class="cc-btn" style="width:100%;font-size:1.1rem;padding:1rem;"
                    onclick="window.CC_TC.startRound()">
              Begin Round ${state.round} →
            </button>
          </div>
        </div>`;
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // RENDER: ACTIVATION SCREEN — THE MAIN SCREEN
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

      // Build stat badges row
      const statBadges = [
        statBadge('Move', unit.move ? unit.move + '"' : null, 'move'),
        statBadge('Combat', unit.combat, 'combat'),
        statBadge('Shoot', unit.shoot, 'shoot'),
        unit.armor ? statBadge('Armor', unit.armor, 'armor') : '',
        unit.cost  ? statBadge('Cost', unit.cost + '£', 'cost')  : '',
      ].join('');

      // NPC directive if applicable
      const directive = faction.isNPC ? buildDirective(faction, unit) : null;

      const directiveHtml = directive ? `
        <div class="cc-panel" style="margin:1rem 0;border-color:${color}44;">
          <div class="cc-panel-header" style="background:${color}11;">
            <h6 style="margin:0;color:${color};font-size:.75rem;text-transform:uppercase;
                       letter-spacing:.1em;">🎯 NPC Directive</h6>
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

      // Special abilities (if any)
      const specialHtml = unit.special?.length ? `
        <div style="margin:.75rem 0;display:flex;flex-wrap:wrap;gap:.4rem;">
          ${(Array.isArray(unit.special) ? unit.special : [unit.special]).map(s =>
            `<span style="padding:3px 8px;background:rgba(255,255,255,.06);
                          border:1px solid rgba(255,255,255,.12);border-radius:4px;
                          font-size:.78rem;color:#ccc;">${s}</span>`
          ).join('')}
        </div>` : '';

      root.innerHTML = `
        <div class="cc-app-shell h-100" style="display:flex;flex-direction:column;">

          <!-- Header -->
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
              <!-- Timer -->
              <div id="cc-timer" style="color:#888;font-size:.8rem;font-family:monospace;">
                00:00
              </div>
              <button onclick="window.CC_TC.toggleTimer()" class="cc-btn cc-btn-secondary"
                style="padding:.25rem .5rem;font-size:.7rem;">
                ${state.timerRunning ? '⏸' : '▶'}
              </button>
              <button onclick="window.CC_TC.saveGame()" class="cc-btn cc-btn-secondary"
                style="padding:.25rem .5rem;font-size:.7rem;" title="Save game">💾</button>
            </div>
          </div>

          <!-- Scroll area -->
          <div style="flex:1;overflow-y:auto;padding:1rem;max-width:600px;width:100%;
                      margin:0 auto;box-sizing:border-box;">

            <!-- Unit name — BIG -->
            <div style="margin-bottom:.75rem;">
              <h2 style="font-size:clamp(1.8rem,6vw,2.6rem);margin:0;color:#fff;line-height:1.1;">
                ${unit.name}
              </h2>
              ${unit.isTitan ? `<span style="color:#ffd600;font-size:.75rem;font-weight:700;
                text-transform:uppercase;letter-spacing:.1em;">⚡ Titan</span>` : ''}
            </div>

            <!-- Quality track (big, tappable) -->
            <div style="margin-bottom:1rem;">
              ${qualityTrack(faction, unit)}
            </div>

            <!-- Stat badges row -->
            <div style="display:flex;flex-wrap:wrap;gap:.4rem;margin-bottom:.75rem;">
              ${statBadges}
            </div>

            <!-- Special abilities -->
            ${specialHtml}

            <!-- NPC Directive -->
            ${directiveHtml}

            <!-- Noise logging -->
            <div class="cc-panel" style="margin:1rem 0;">
              <div class="cc-panel-header">
                <h6 style="margin:0;color:#888;font-size:.7rem;text-transform:uppercase;
                           letter-spacing:.1em;">👂 Log Noise</h6>
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

          <!-- Bottom action bar -->
          <div style="padding:1rem;border-top:1px solid rgba(255,255,255,.08);
                      background:rgba(0,0,0,.3);display:flex;gap:.75rem;
                      max-width:600px;width:100%;margin:0 auto;box-sizing:border-box;">
            <button onclick="window.CC_TC.markOut()" class="cc-btn cc-btn-secondary"
              style="flex-shrink:0;opacity:.6;"
              title="Remove this unit from play">
              ✖ OUT
            </button>
            <button onclick="window.CC_TC.nextActivation()"
              class="cc-btn"
              style="flex:1;font-size:1.15rem;padding:1rem;
                     background:${color};color:#000;">
              DONE →
            </button>
          </div>

        </div>`;

      // Start timer if running
      if (state.timerRunning) startTimerDisplay();
    }

    // ── Timer display loop ────────────────────────────────────────────────────

    let _timerInterval = null;

    function startTimerDisplay() {
      clearInterval(_timerInterval);
      _timerInterval = setInterval(() => {
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

      // Build unit status table
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

            <!-- Noise & Cough status -->
            <div class="cc-panel" style="margin-bottom:1rem;">
              <div class="cc-panel-body">
                ${noiseBarHtml()}
                ${coughBarHtml()}
              </div>
            </div>

            <!-- Round log -->
            <div class="cc-panel" style="margin-bottom:1rem;">
              <div class="cc-panel-header">
                <h5 style="margin:0;">📋 Round Log</h5>
              </div>
              <div class="cc-panel-body">
                <ul style="margin:0;padding-left:1rem;">${logHtml}</ul>
              </div>
            </div>

            <!-- Unit status -->
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

    // ═══════════════════════════════════════════════════════════════════════════
    // RENDER: SPLASH
    // ═══════════════════════════════════════════════════════════════════════════

    function renderSplash() {
      root.innerHTML = `
        <div class="cc-app-shell h-100">
          <div class="cc-app-header">
            <div>
              <h1 class="cc-app-title">Coffin Canyon</h1>
              <div class="cc-app-subtitle">Game Turn Counter</div>
            </div>
          </div>
          <div id="cc-tc-splash" style="
            display:flex;flex-direction:column;align-items:center;justify-content:center;
            min-height:calc(100vh - 80px);
            transition:opacity .6s ease;">
            <img
              src="https://raw.githubusercontent.com/steamcrow/coffin/main/rules/apps/canyon_map/data/coffin_canyon_logo.png"
              alt="Coffin Canyon"
              style="width:280px;max-width:75vw;margin-bottom:2rem;
                     filter:drop-shadow(0 0 28px rgba(255,117,24,.45));
                     animation:cc-pulse 2.4s ease-in-out infinite;"
            />
            <div style="
              width:44px;height:44px;
              border:4px solid rgba(255,117,24,.18);
              border-top:4px solid #ff7518;
              border-radius:50%;
              animation:cc-spin 1s linear infinite;">
            </div>
            <div style="color:#ff7518;margin-top:14px;font-size:.7rem;
                        letter-spacing:.28em;text-transform:uppercase;
                        animation:cc-pulse 1.5s ease-in-out infinite;">
              Loading…
            </div>
          </div>
        </div>`;
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // RENDER: MASTER DISPATCHER
    // ═══════════════════════════════════════════════════════════════════════════

    function render() {
      switch (state.phase) {
        case 'splash':       return renderSplash();
        case 'setup':        return renderSetup();
        case 'quick_setup':  return renderQuickSetup();
        case 'round_banner': return renderRoundBanner();
        case 'activation':   return renderActivation();
        case 'round_end':    return renderRoundEnd();
        default:             return renderSetup();
      }
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // EVENT HANDLERS — all called via window.CC_TC
    // ═══════════════════════════════════════════════════════════════════════════

    window.CC_TC = {

      backToSetup() {
        state.phase = 'setup';
        render();
      },

      startQuickMode() {
        state.phase = 'quick_setup';
        render();
      },

      async startFromQuickSetup() {
        const checked = Array.from(document.querySelectorAll('input[name="faction"]:checked'));
        if (checked.length < 2) {
          alert('Please select at least 2 factions.');
          return;
        }

        state.loadingData = true;
        state.factions = [];
        render();

        for (const cb of checked) {
          const id   = cb.value;
          const meta = FACTION_META[id];
          const npcSelect = document.querySelector(`select[name="npc_${id}"]`);
          const isNPC = !npcSelect || npcSelect.value === 'npc';
          const fData = await loadFactionData(id);
          const faction = fData
            ? buildFactionEntry(id, fData, isNPC, meta.isMonster)
            : buildQuickFaction(id, meta.name, 3, isNPC, meta.isMonster);
          initUnitStates(faction);
          state.factions.push(faction);
        }

        state.loadingData = false;
        this.beginGame();
      },

      openScenarioList() {
        if (!window.CC_STORAGE) { alert('Storage not available.'); return; }
        window.CC_STORAGE.listDocuments(SCENARIO_FOLDER).then(docs => {
          if (!docs?.length) { alert('No scenario saves found.'); return; }
          const list = docs.map(d => `
            <button onclick="window.CC_TC.loadScenario('${d.id}')"
              class="cc-btn cc-btn-secondary" style="width:100%;margin-bottom:.5rem;text-align:left;">
              📋 ${d.name || d.id}
            </button>`).join('');
          // Simple inline modal
          const overlay = document.createElement('div');
          overlay.style.cssText = 'position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,.85);' +
            'display:flex;align-items:center;justify-content:center;';
          overlay.innerHTML = `
            <div style="background:#1a1a1a;border:1px solid rgba(255,255,255,.15);border-radius:8px;
                        padding:1.5rem;max-width:500px;width:90%;max-height:80vh;overflow-y:auto;">
              <h5 style="margin:0 0 1rem;color:var(--cc-primary);">Load Scenario</h5>
              ${list}
              <button onclick="this.closest('div[style]').remove()"
                class="cc-btn cc-btn-secondary" style="width:100%;margin-top:.5rem;">
                Cancel
              </button>
            </div>`;
          document.body.appendChild(overlay);
        }).catch(() => alert('Failed to load saves.'));
      },

      async loadScenario(docId) {
        // Close modal
        document.querySelector('div[style*="z-index:9999"]')?.remove();
        try {
          const doc     = await window.CC_STORAGE.getDocument(docId);
          const payload = JSON.parse(doc.content);
          state.scenarioSave  = payload.scenario || payload;
          state.scenarioName  = payload.name || 'Scenario';
          state.noiseThreshold = 8 + (payload.danger || 3) * 2;

          // Monster pressure from scenario
          const mp = state.scenarioSave?.monster_pressure;
          state.monsterRoster = mp?.monsters || [];

          // Build factions from scenario
          state.loadingData = true;
          state.factions = [];
          render();

          const factionEntries = payload.factions || [];
          for (const fe of factionEntries) {
            const id   = fe.id;
            const meta = FACTION_META[id];
            if (!meta) continue;
            const fData = await loadFactionData(id);
            const faction = fData
              ? buildFactionEntry(id, fData, fe.npc ?? true, meta.isMonster)
              : buildQuickFaction(id, meta.name, 3, fe.npc ?? true, meta.isMonster);
            initUnitStates(faction);
            state.factions.push(faction);
          }

          state.loadingData = false;
          this.beginGame();
        } catch (err) {
          alert('Failed to load scenario: ' + err.message);
          state.loadingData = false;
          state.phase = 'setup';
          render();
        }
      },

      openGameList() {
        if (!window.CC_STORAGE) { alert('Storage not available.'); return; }
        // TODO: list from TURN_SAVE_FOLDER — implement in next pass
        alert('Resume coming soon — save/load is in the next build pass!');
      },

      beginGame() {
        state.round      = 1;
        state.unitState  = {};
        state.noiseLevel = 0;
        state.roundLog   = [];
        state.factions.forEach(f => initUnitStates(f));
        buildQueue();
        state.phase = 'round_banner';
        render();
      },

      startRound() {
        state.phase = 'activation';
        state.timerElapsed = 0;
        state.timerRunning = true;
        state.timerStart   = Date.now();
        render();
      },

      nextActivation() {
        // Stop timer, accumulate elapsed
        if (state.timerRunning) {
          state.timerElapsed += Date.now() - state.timerStart;
          state.timerRunning = false;
        }

        const hasMore = advanceQueue();
        if (!hasMore || isRoundComplete()) {
          endRound();
        } else {
          // Reset timer for next activation
          state.timerElapsed = 0;
          state.timerRunning = true;
          state.timerStart   = Date.now();
          render();
        }
      },

      markOut() {
        const item = currentQueueItem();
        if (!item) return;
        if (!confirm('Mark this unit as OUT?')) return;
        setUnitState(item.factionId, item.unitId, { out: true });
        const faction = getFactionById(item.factionId);
        const unit    = getUnitById(faction, item.unitId);
        state.roundLog.push(`✖ ${faction?.name}: ${unit?.name} is OUT.`);
        this.nextActivation();
      },

      adjustQuality(factionId, unitId, delta) {
        const us   = getUnitState(factionId, unitId);
        const unit = getUnitById(getFactionById(factionId), unitId);
        if (!us || !unit) return;
        const newQ = Math.max(0, Math.min(unit.quality, (us.quality || 0) + delta));
        setUnitState(factionId, unitId, { quality: newQ });
        if (newQ === 0) {
          // Prompt to mark OUT
          if (confirm(`${unit.name} is at Q0 — mark them OUT?`)) {
            setUnitState(factionId, unitId, { out: true });
            const faction = getFactionById(factionId);
            state.roundLog.push(`✖ ${faction?.name}: ${unit.name} is OUT (Q0).`);
            this.nextActivation();
            return;
          }
        }
        render();
      },

      logNoise(key) {
        const n = NOISE_VALUES[key];
        if (!n) return;
        addNoise(n.value, n.label);
        render();
      },

      toggleTimer() {
        if (state.timerRunning) {
          state.timerElapsed += Date.now() - state.timerStart;
          state.timerRunning = false;
        } else {
          state.timerStart   = Date.now();
          state.timerRunning = true;
          startTimerDisplay();
        }
        render();
      },

      async saveGame() {
        if (!window.CC_STORAGE) { alert('Storage not available.'); return; }
        const name = `GAME_Round${state.round}_${Date.now()}`;
        try {
          await window.CC_STORAGE.saveDocument(name, JSON.stringify({
            version:          '1.0',
            scenarioName:     state.scenarioName,
            round:            state.round,
            unitState:        state.unitState,
            noiseLevel:       state.noiseLevel,
            coughSeverity:    state.coughSeverity,
            timerElapsed:     state.timerElapsed,
            roundLog:         state.roundLog,
            allRoundLogs:     state.allRoundLogs,
            monstersTriggered: state.monstersTriggered,
            timestamp:        new Date().toISOString()
          }), TURN_SAVE_FOLDER);
          // Quick visual confirmation on the save button
          const btn = document.querySelector('[onclick="window.CC_TC.saveGame()"]');
          if (btn) {
            const orig = btn.innerHTML;
            btn.innerHTML = '✅';
            setTimeout(() => { btn.innerHTML = orig; }, 1500);
          }
        } catch (err) {
          alert('Save failed: ' + err.message);
        }
      },

      beginNextRound() {
        state.allRoundLogs.push({ round: state.round, log: [...state.roundLog] });
        state.roundLog = [];
        state.round++;
        deployReserves();
        buildQueue();
        state.phase = 'round_banner';
        render();
      },
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
    // INLINE KEYFRAME STYLES (injected once)
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
    // BOOT — 5-second splash, then setup
    // ═══════════════════════════════════════════════════════════════════════════

    const MIN_SPLASH_MS = 5000;
    const _bootStart    = Date.now();

    render(); // Shows splash immediately

    setTimeout(() => {
      const splash = document.getElementById('cc-tc-splash');
      if (splash) {
        splash.style.opacity = '0';
        setTimeout(() => {
          state.phase = 'setup';
          render();
        }, 650);
      } else {
        state.phase = 'setup';
        render();
      }
    }, MIN_SPLASH_MS);

  } // end init()
}; // end window.CC_APP      monster_rangers: { name: 'Monster Rangers', color: '#4caf50', isMonster: false, file: 'faction-monster-rangers-v5.json' },
      liberty_corps:   { name: 'Liberty Corps',   color: '#ef5350', isMonster: false, file: 'faction-liberty-corps-v2.json'  },
      monsterology:    { name: 'Monsterology',     color: '#9c27b0', isMonster: false, file: 'faction-monsterology-v2.json'   },
      monsters:        { name: 'Monsters',         color: '#ff7518', isMonster: true,  file: 'faction-monsters-v2.json'       },
      shine_riders:    { name: 'Shine Riders',     color: '#ffd600', isMonster: false, file: 'faction-shine-riders-v2.json'   },
      crow_queen:      { name: 'Crow Queen',       color: '#00bcd4', isMonster: false, file: 'faction-crow-queen.json'        }
    };

    // Faction logo PNGs — grey, transparent background.
    // Fallback SVG badge is generated inline if the PNG 404s.
    const LOGO_BASE = 'https://raw.githubusercontent.com/steamcrow/coffin/main/rules/apps/turn_counter/logos/';

    // Noise values per logged action
    const NOISE_VALUES = {
      shot:      { label: '🔫 Shot',      value: 2 },
      explosion: { label: '💥 Explosion', value: 3 },
      ritual:    { label: '🔮 Ritual',    value: 4 },
      ability:   { label: '⚡ Ability',   value: 2 },
      silent:    { label: '🤫 Silent',    value: 0 }
    };

    // Canyon event table — fires at round end with escalating probability
    const CANYON_EVENTS = [
      { id: 'dust_devil',   icon: '🌪️', text: 'A dust devil cuts across the board. Ranged attacks are at −1 die until next round.' },
      { id: 'thyr_flare',   icon: '💎', text: 'Thyr crystals flare. Any unit within 3" of a cache tests Quality or is Shaken.' },
      { id: 'supply_cache', icon: '📦', text: 'A supply drop is spotted. Place a bonus cache token at a random board edge.' },
      { id: 'canyon_echo',  icon: '👂', text: 'Sounds carry strangely. Add +2 to current noise.' },
      { id: 'sickness',     icon: '🤧', text: 'Coffin Cough drifts in. Each faction rolls — 1 or 2: one unit tests Quality.' },
      { id: 'silence',      icon: '🌑', text: 'An unnatural silence falls. Monsters stir — add +3 noise.' },
      { id: 'scavengers',   icon: '🐦', text: 'Scavengers at the nearest objective. It becomes Contested regardless of control.' },
      { id: 'nightfall',    icon: '🌙', text: 'Early dark. Reduce all ranged ranges by 3" until end of next round.' },
      { id: 'tremor',       icon: '⚡', text: 'The ground shudders. All Unstable terrain escalates one step.' },
      { id: 'canyon_luck',  icon: '🍀', text: 'Canyon luck. One random unit may remove a Shaken condition immediately.' },
      { id: 'wanted',       icon: '📜', text: 'A wanted poster blows past. Shine Riders gain +1 to their next Quality test.' },
      { id: 'thyr_pulse',   icon: '🔆', text: 'The canyon pulses with Thyr light. All ritual actions cost +1 noise this round.' },
    ];

    const FACTION_LOADER_BASE = 'https://raw.githubusercontent.com/steamcrow/coffin/main/rules/src/';
    const SCENARIO_FOLDER     = 90;
    const TURN_SAVE_FOLDER    = 91;

    // ═══════════════════════════════════════════════════════════════════════════
    // APP STATE
    // ═══════════════════════════════════════════════════════════════════════════

    const state = {
      // Screens: 'splash' | 'setup' | 'round_banner' | 'activation' | 'round_end' | 'game_over'
      phase: 'splash',

      // Loaded data
      scenarioSave:   null,   // full parsed scenario save object
      scenarioName:   '',

      // Factions in this game
      factions: [],
      // [{ id, name, color, isMonster, isNPC, logoUrl,
      //    allUnits: [{id, name, quality, move, combat, shoot, special, cost}],
      //    deployIndex: 0 }]

      // Live unit states — keyed "factionId::unitId"
      unitState: {},
      // { quality: N, out: false, activated: false }

      // Turn tracking
      round:  1,
      queue:  [],          // [{ factionId, unitId }] — ordered activations this round
      queueIndex: 0,       // which activation we're on

      // Noise
      noiseLevel:    0,
      noiseThreshold: 12,  // overridden from scenario save
      monsterRoster: [],   // from scenario monster_pressure
      monstersTriggered: 0,

      // Coffin Cough
      coughSeverity: 0,    // 0–5

      // Timer (per activation)
      timerRunning: false,
      timerStart:   null,
      timerElapsed: 0,

      // Round log
      roundLog: [],
      allRoundLogs: [],

      // Canyon event tracking
      lastEventRound: 0,

      // Setup helpers
      setupMode:    null,    // 'scenario' | 'quick'
      loadingData:  false,
    };

    // ── Unit state key ────────────────────────────────────────────────────────
    function unitKey(factionId, unitId) { return `${factionId}::${unitId}`; }

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
        return await res.json();
      } catch (err) {
        console.warn(`⚠️ Could not load faction data for ${factionId}:`, err.message);
        return null;
      }
    }

    // Build a faction entry from raw JSON data
    function buildFactionEntry(factionId, factionData, isNPC, isMonster) {
      const meta  = FACTION_META[factionId] || {};
      const color = meta.color || '#888';
      const name  = meta.name  || factionId;

      // Normalise units from faction JSON format
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
        logoUrl:      LOGO_BASE + factionId + '.png',
        allUnits,
        deployIndex:  0,   // next unit to deploy when roster grows
      };
    }

    // Build a quick-mode faction with manual unit entries
    function buildQuickFaction(id, name, unitCount, isNPC, isMonster) {
      const meta  = FACTION_META[id] || {};
      const color = meta.color || '#888';
      const units = [];
      for (let i = 0; i < unitCount; i++) {
        units.push({ id: `unit_${i}`, name: `${name} #${i + 1}`, quality: 4, move: 6,
                     combat: null, shoot: null, armor: null, cost: null, special: [], isTitan: false });
      }
      return { id, name, color, isMonster, isNPC, logoUrl: LOGO_BASE + id + '.png',
               allUnits: units, deployIndex: 0 };
    }

    // Initialise unitState for all active units in a faction
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

    // Active units for a faction this round (not OUT, and deployed)
    function getActiveUnits(faction) {
      return faction.allUnits.filter(u => {
        const us = getUnitState(faction.id, u.id);
        return us && !us.out;
      });
    }

    // Build the activation queue for a round.
    // Monsters activate first; then alternate human/monster one model at a time.
    function buildQueue() {
      const monsterUnits = [];
      const humanUnits   = [];

      state.factions.forEach(f => {
        const active = getActiveUnits(f);
        active.forEach(u => {
          (f.isMonster ? monsterUnits : humanUnits).push({ factionId: f.id, unitId: u.id });
        });
      });

      // Interleave: monsters first, then alternate
      const queue = [];
      let mi = 0, hi = 0;
      while (mi < monsterUnits.length || hi < humanUnits.length) {
        if (mi < monsterUnits.length) queue.push(monsterUnits[mi++]);
        if (hi < humanUnits.length)   queue.push(humanUnits[hi++]);
      }

      state.queue      = queue;
      state.queueIndex = 0;

      // Reset activated flags
      state.factions.forEach(f => {
        f.allUnits.forEach(u => {
          const k = unitKey(f.id, u.id);
          if (state.unitState[k]) state.unitState[k].activated = false;
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

    // Advance to the next non-OUT unit in the queue
    function advanceQueue() {
      // Mark current unit activated
      const cur = currentQueueItem();
      if (cur) {
        setUnitState(cur.factionId, cur.unitId, { activated: true });
      }

      state.queueIndex++;

      // Skip units that went OUT mid-round
      while (state.queueIndex < state.queue.length) {
        const item = state.queue[state.queueIndex];
        const us   = getUnitState(item.factionId, item.unitId);
        if (!us || us.out) { state.queueIndex++; continue; }
        break;
      }

      return state.queueIndex < state.queue.length;
    }

    // Are all activations done this round?
    function isRoundComplete() {
      return state.queueIndex >= state.queue.length;
    }

    // Deploy next reserve unit for each faction at round start
    function deployReserves() {
      state.factions.forEach(f => {
        const active = getActiveUnits(f);
        if (active.length === 0 && f.deployIndex < f.allUnits.length) {
          const nextUnit = f.allUnits[f.deployIndex];
          f.deployIndex++;
          // Restore this unit to play (was OUT, or never activated)
          setUnitState(f.id, nextUnit.id, { quality: nextUnit.quality, out: false, activated: false });
          state.roundLog.push(`🔄 ${f.name}: ${nextUnit.name} deploys.`);
        }
      });
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // NOISE & MONSTER PRESSURE
    // ═══════════════════════════════════════════════════════════════════════════

    function addNoise(amount, label) {
      state.noiseLevel += amount;
      if (amount > 0) state.roundLog.push(`👂 Noise +${amount} (${label})`);
      checkMonsterTrigger();
    }

    function checkMonsterTrigger() {
      if (state.noiseLevel < state.noiseThreshold) return;
      if (state.monstersTriggered >= state.monsterRoster.length) return;

      const monster = state.monsterRoster[state.monstersTriggered];
      state.monstersTriggered++;
      state.noiseLevel = Math.floor(state.noiseLevel / 2);  // noise drops after scare

      const msg = monster
        ? `🐉 Monster Encounter! ${monster.name} approaches from the nearest edge.`
        : `🐉 Monster Encounter! Something stirs in the canyon.`;

      state.roundLog.push(msg);
      showMonsterAlert(monster);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // CANYON EVENTS & COFFIN COUGH
    // ═══════════════════════════════════════════════════════════════════════════

    function rollCanyonEvent() {
      const chance = state.round >= 3 ? 0.5 : 0.33;
      if (Math.random() > chance) return null;
      const ev = CANYON_EVENTS[Math.floor(Math.random() * CANYON_EVENTS.length)];
      state.lastEventRound = state.round;

      // Apply side effects
      if (ev.id === 'canyon_echo') addNoise(2, 'Canyon Echo');
      if (ev.id === 'silence')     addNoise(3, 'Unnatural Silence');

      state.roundLog.push(`${ev.icon} Canyon Event: ${ev.text}`);
      return ev;
    }

    function tickCoffeinCough() {
      if (Math.random() < 0.4) {
        state.coughSeverity = Math.min(5, state.coughSeverity + 1);
      }
      if (state.coughSeverity >= 5) {
        state.roundLog.push('☠️ Coffin Cough Storm! Every unit tests Quality or degrades by 1.');
        setTimeout(() => {
          state.coughSeverity = 2; // storm passes, leaves residue
          render();
        }, 4000);
      }
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // NPC DIRECTIVE ENGINE
    // ═══════════════════════════════════════════════════════════════════════════

    function buildDirective(faction, unit) {
      const motive = state.scenarioSave?.factions?.find(f => f.id === faction.id)?.motive || null;
      const approach = state.scenarioSave?.factions?.find(f => f.id === faction.id)?.approach || 'aggressive';

      // Priority tree
      const us = getUnitState(faction.id, unit.id);
      const q  = us?.quality || unit.quality;

      let priority = '';
      let ifEngaged = `Attack (Q${q}, 2 actions)`;
      let ifClear   = 'Hold position';

      if (motive) {
        priority = motive;
      } else {
        // Generic fallback based on approach
        const approachMap = {
          aggressive:   'Press forward — engage the nearest enemy.',
          defensive:    'Hold current position and protect nearby allies.',
          opportunistic:'Move toward the highest-value unclaimed objective.',
          support:      'Stay near your faction\'s strongest unit.',
        };
        priority = approachMap[approach] || approachMap.aggressive;
      }

      // Objective from scenario
      const primaryObj = state.scenarioSave?.objectives?.[0];
      if (primaryObj?.name) {
        ifClear = `Move toward ${primaryObj.name} and Interact.`;
      }

      return { priority, ifEngaged, ifClear };
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // FACTION LOGO HELPER
    // ═══════════════════════════════════════════════════════════════════════════

    // Renders a faction logo — PNG with CSS tint, falling back to SVG badge if 404.
    function logoHtml(faction, sizePx = 48) {
      const initial = (faction.name || '?')[0].toUpperCase();
      const color   = faction.color || '#888';
      // The onerror swaps to an inline SVG badge
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
      quality: '#ff7518',   // canyon orange
      move:    '#42a5f5',   // blue
      combat:  '#ef5350',   // red
      shoot:   '#ffd600',   // gold
      armor:   '#90a4ae',   // grey
      cost:    '#555',      // dim
    };

    function statBadge(label, value, colorKey, big = false) {
      if (value === null || value === undefined) return '';
      const color = STAT_COLORS[colorKey] || '#888';
      const size  = big ? 'font-size:1.4rem;padding:.4rem .7rem;' : 'font-size:.85rem;padding:.25rem .5rem;';
      return `
        <div class="cc-stat-badge" style="
          display:inline-flex;flex-direction:column;align-items:center;
          background:${color}22;border:1px solid ${color}66;border-radius:6px;
          ${size}min-width:${big ? 56 : 44}px;gap:1px;">
          <span style="color:${color};font-weight:900;line-height:1;">${value}</span>
          <span style="color:${color}99;font-size:.65rem;text-transform:uppercase;
                       letter-spacing:.06em;line-height:1;">${label}</span>
        </div>`;
    }

    // Quality track — tappable dots showing current/max quality
    function qualityTrack(faction, unit) {
      const us  = getUnitState(faction.id, unit.id);
      const cur = us?.quality ?? unit.quality;
      const max = unit.quality;
      const color = cur <= 1 ? '#ef5350' : STAT_COLORS.quality;

      let dots = '';
      for (let i = max; i >= 1; i--) {
        const filled = i <= cur;
        dots += `<button
          onclick="window.CC_TC.adjustQuality('${faction.id}','${unit.id}',${filled ? -1 : 1})"
          class="cc-q-dot ${filled ? 'filled' : 'empty'}"
          style="width:28px;height:28px;border-radius:50%;border:2px solid ${color};
                 background:${filled ? color : 'transparent'};cursor:pointer;
                 transition:all .15s ease;margin:2px;"
          title="${filled ? 'Tap to wound' : 'Tap to heal'}"
        ></button>`;
      }

      return `
        <div class="cc-quality-track" style="display:flex;align-items:center;gap:4px;flex-wrap:wrap;">
          <span style="color:${color}99;font-size:.7rem;text-transform:uppercase;
                       letter-spacing:.08em;margin-right:4px;">Quality</span>
          <div style="display:flex;flex-wrap:wrap;gap:2px;">${dots}</div>
          <span style="color:${color};font-weight:900;font-size:1.1rem;margin-left:6px;">
            ${cur > 0 ? 'Q' + cur : '⚠️ OUT?'}
          </span>
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
              👂 Canyon Noise
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

    // Coffin Cough severity bar
    function coughBarHtml() {
      if (state.coughSeverity === 0) return '';
      const pct   = Math.round((state.coughSeverity / 5) * 100);
      const color = state.coughSeverity >= 4 ? '#ef5350' : '#ff9800';
      const labels = ['','Trace','Mild','Building','Warning','Storm'];
      return `
        <div style="margin:.3rem 0;">
          <div style="display:flex;justify-content:space-between;margin-bottom:3px;">
            <span style="font-size:.7rem;color:#888;text-transform:uppercase;letter-spacing:.08em;">
              ☁️ Coffin Cough
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

    function showMonsterAlert(monster) {
      const name = monster?.name || 'Something from the Canyon';
      const overlay = document.createElement('div');
      overlay.style.cssText = [
        'position:fixed;inset:0;z-index:9999;',
        'background:rgba(0,0,0,.85);',
        'display:flex;align-items:center;justify-content:center;',
        'animation:cc-fade-in .3s ease;'
      ].join('');
      overlay.innerHTML = `
        <div style="text-align:center;padding:2rem;max-width:400px;">
          <div style="font-size:4rem;margin-bottom:1rem;animation:cc-pulse 1s ease infinite;">🐉</div>
          <h2 style="color:#ef5350;margin:0 0 .5rem;font-size:1.8rem;">Monster Encounter!</h2>
          <p style="color:#ffcdd2;font-size:1.1rem;margin:.5rem 0 1.5rem;">${name} approaches from the nearest board edge.</p>
          <button onclick="this.closest('div[style]').remove()" class="cc-btn" style="width:100%;">
            Acknowledged — Continue
          </button>
        </div>`;
      document.body.appendChild(overlay);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // RENDER: SETUP SCREEN
    // ═══════════════════════════════════════════════════════════════════════════

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

          <div style="max-width:600px;margin:0 auto;padding:1.5rem;">

            ${state.loadingData ? `
              <div style="text-align:center;padding:3rem;">
                <div style="font-size:2rem;margin-bottom:1rem;animation:cc-spin 1s linear infinite;">⚙️</div>
                <p style="color:#888;">Loading faction data…</p>
              </div>` : `

            <!-- Mode selector -->
            <div class="cc-panel" style="margin-bottom:1rem;">
              <div class="cc-panel-header">
                <h5 style="margin:0;color:var(--cc-primary);">🎲 Start a Game</h5>
              </div>
              <div class="cc-panel-body">
                <p style="color:#888;font-size:.9rem;margin:0 0 1rem;">
                  Load a saved scenario to get NPC directives, monster pressure, and objectives.
                  Or jump straight in with Quick Mode.
                </p>
                <div style="display:flex;flex-direction:column;gap:.75rem;">
                  ${hasStorage ? `
                    <button class="cc-btn" onclick="window.CC_TC.openScenarioList()" style="text-align:left;">
                      <span style="font-size:1.2rem;margin-right:.75rem;">📋</span>
                      Load Scenario Save
                      <span style="margin-left:auto;font-size:.75rem;color:#888;text-transform:none;">
                        Loads objectives, NPC motives, monsters
                      </span>
                    </button>` : `
                    <div style="padding:.75rem;border:1px solid rgba(255,255,255,.1);border-radius:6px;color:#666;font-size:.85rem;">
                      📋 Storage not available — use Quick Mode
                    </div>`}
                  <button class="cc-btn cc-btn-secondary" onclick="window.CC_TC.startQuickMode()" style="text-align:left;">
                    <span style="font-size:1.2rem;margin-right:.75rem;">⚡</span>
                    Quick Mode
                    <span style="margin-left:auto;font-size:.75rem;color:#888;text-transform:none;">
                      Pick factions and go
                    </span>
                  </button>
                </div>
              </div>
            </div>

            <!-- Resume saved game -->
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
    }

    // ── Quick Mode faction picker ─────────────────────────────────────────────

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
      root.innerHTML = `
        <div class="cc-app-shell h-100" style="display:flex;align-items:center;justify-content:center;">
          <div style="text-align:center;padding:2rem;max-width:400px;">
            <div style="color:var(--cc-primary);font-size:.8rem;text-transform:uppercase;
                        letter-spacing:.2em;margin-bottom:.5rem;">Beginning</div>
            <h1 style="font-size:clamp(3rem,10vw,5rem);margin:0;color:#fff;line-height:1;">
              Round ${state.round}
            </h1>
            <p style="color:#888;margin:.5rem 0 2rem;">
              ${totalActivations} activation${totalActivations !== 1 ? 's' : ''} this round
            </p>

            <!-- Faction lineup -->
            <div style="display:flex;justify-content:center;gap:1rem;flex-wrap:wrap;margin-bottom:2rem;">
              ${state.factions.map(f => {
                const active = getActiveUnits(f);
                if (active.length === 0) return '';
                return `
                  <div style="text-align:center;opacity:${active.length > 0 ? 1 : .3};">
                    ${logoHtml(f, 36)}
                    <div style="color:${f.color};font-size:.7rem;margin-top:4px;font-weight:700;">
                      ${active.length} unit${active.length !== 1 ? 's' : ''}
                    </div>
                  </div>`;
              }).join('')}
            </div>

            ${noiseBarHtml()}
            ${coughBarHtml()}

            <button class="cc-btn" style="width:100%;font-size:1.1rem;padding:1rem;"
                    onclick="window.CC_TC.startRound()">
              Begin Round ${state.round} →
            </button>
          </div>
        </div>`;
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // RENDER: ACTIVATION SCREEN — THE MAIN SCREEN
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

      // Build stat badges row
      const statBadges = [
        statBadge('Move', unit.move ? unit.move + '"' : null, 'move'),
        statBadge('Combat', unit.combat, 'combat'),
        statBadge('Shoot', unit.shoot, 'shoot'),
        unit.armor ? statBadge('Armor', unit.armor, 'armor') : '',
        unit.cost  ? statBadge('Cost', unit.cost + '£', 'cost')  : '',
      ].join('');

      // NPC directive if applicable
      const directive = faction.isNPC ? buildDirective(faction, unit) : null;

      const directiveHtml = directive ? `
        <div class="cc-panel" style="margin:1rem 0;border-color:${color}44;">
          <div class="cc-panel-header" style="background:${color}11;">
            <h6 style="margin:0;color:${color};font-size:.75rem;text-transform:uppercase;
                       letter-spacing:.1em;">🎯 NPC Directive</h6>
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

      // Special abilities (if any)
      const specialHtml = unit.special?.length ? `
        <div style="margin:.75rem 0;display:flex;flex-wrap:wrap;gap:.4rem;">
          ${(Array.isArray(unit.special) ? unit.special : [unit.special]).map(s =>
            `<span style="padding:3px 8px;background:rgba(255,255,255,.06);
                          border:1px solid rgba(255,255,255,.12);border-radius:4px;
                          font-size:.78rem;color:#ccc;">${s}</span>`
          ).join('')}
        </div>` : '';

      root.innerHTML = `
        <div class="cc-app-shell h-100" style="display:flex;flex-direction:column;">

          <!-- Header -->
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
              <!-- Timer -->
              <div id="cc-timer" style="color:#888;font-size:.8rem;font-family:monospace;">
                00:00
              </div>
              <button onclick="window.CC_TC.toggleTimer()" class="cc-btn cc-btn-secondary"
                style="padding:.25rem .5rem;font-size:.7rem;">
                ${state.timerRunning ? '⏸' : '▶'}
              </button>
              <button onclick="window.CC_TC.saveGame()" class="cc-btn cc-btn-secondary"
                style="padding:.25rem .5rem;font-size:.7rem;" title="Save game">💾</button>
            </div>
          </div>

          <!-- Scroll area -->
          <div style="flex:1;overflow-y:auto;padding:1rem;max-width:600px;width:100%;
                      margin:0 auto;box-sizing:border-box;">

            <!-- Unit name — BIG -->
            <div style="margin-bottom:.75rem;">
              <h2 style="font-size:clamp(1.8rem,6vw,2.6rem);margin:0;color:#fff;line-height:1.1;">
                ${unit.name}
              </h2>
              ${unit.isTitan ? `<span style="color:#ffd600;font-size:.75rem;font-weight:700;
                text-transform:uppercase;letter-spacing:.1em;">⚡ Titan</span>` : ''}
            </div>

            <!-- Quality track (big, tappable) -->
            <div style="margin-bottom:1rem;">
              ${qualityTrack(faction, unit)}
            </div>

            <!-- Stat badges row -->
            <div style="display:flex;flex-wrap:wrap;gap:.4rem;margin-bottom:.75rem;">
              ${statBadges}
            </div>

            <!-- Special abilities -->
            ${specialHtml}

            <!-- NPC Directive -->
            ${directiveHtml}

            <!-- Noise logging -->
            <div class="cc-panel" style="margin:1rem 0;">
              <div class="cc-panel-header">
                <h6 style="margin:0;color:#888;font-size:.7rem;text-transform:uppercase;
                           letter-spacing:.1em;">👂 Log Noise</h6>
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

          <!-- Bottom action bar -->
          <div style="padding:1rem;border-top:1px solid rgba(255,255,255,.08);
                      background:rgba(0,0,0,.3);display:flex;gap:.75rem;
                      max-width:600px;width:100%;margin:0 auto;box-sizing:border-box;">
            <button onclick="window.CC_TC.markOut()" class="cc-btn cc-btn-secondary"
              style="flex-shrink:0;opacity:.6;"
              title="Remove this unit from play">
              ✖ OUT
            </button>
            <button onclick="window.CC_TC.nextActivation()"
              class="cc-btn"
              style="flex:1;font-size:1.15rem;padding:1rem;
                     background:${color};color:#000;">
              DONE →
            </button>
          </div>

        </div>`;

      // Start timer if running
      if (state.timerRunning) startTimerDisplay();
    }

    // ── Timer display loop ────────────────────────────────────────────────────

    let _timerInterval = null;

    function startTimerDisplay() {
      clearInterval(_timerInterval);
      _timerInterval = setInterval(() => {
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

      // Build unit status table
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

            <!-- Noise & Cough status -->
            <div class="cc-panel" style="margin-bottom:1rem;">
              <div class="cc-panel-body">
                ${noiseBarHtml()}
                ${coughBarHtml()}
              </div>
            </div>

            <!-- Round log -->
            <div class="cc-panel" style="margin-bottom:1rem;">
              <div class="cc-panel-header">
                <h5 style="margin:0;">📋 Round Log</h5>
              </div>
              <div class="cc-panel-body">
                <ul style="margin:0;padding-left:1rem;">${logHtml}</ul>
              </div>
            </div>

            <!-- Unit status -->
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

    // ═══════════════════════════════════════════════════════════════════════════
    // RENDER: SPLASH
    // ═══════════════════════════════════════════════════════════════════════════

    function renderSplash() {
      root.innerHTML = `
        <div class="cc-app-shell h-100">
          <div class="cc-app-header">
            <div>
              <h1 class="cc-app-title">Coffin Canyon</h1>
              <div class="cc-app-subtitle">Game Turn Counter</div>
            </div>
          </div>
          <div id="cc-tc-splash" style="
            display:flex;flex-direction:column;align-items:center;justify-content:center;
            min-height:calc(100vh - 80px);
            transition:opacity .6s ease;">
            <img
              src="https://raw.githubusercontent.com/steamcrow/coffin/main/rules/apps/canyon_map/data/coffin_canyon_logo.png"
              alt="Coffin Canyon"
              style="width:280px;max-width:75vw;margin-bottom:2rem;
                     filter:drop-shadow(0 0 28px rgba(255,117,24,.45));
                     animation:cc-pulse 2.4s ease-in-out infinite;"
            />
            <div style="
              width:44px;height:44px;
              border:4px solid rgba(255,117,24,.18);
              border-top:4px solid #ff7518;
              border-radius:50%;
              animation:cc-spin 1s linear infinite;">
            </div>
            <div style="color:#ff7518;margin-top:14px;font-size:.7rem;
                        letter-spacing:.28em;text-transform:uppercase;
                        animation:cc-pulse 1.5s ease-in-out infinite;">
              Loading…
            </div>
          </div>
        </div>`;
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // RENDER: MASTER DISPATCHER
    // ═══════════════════════════════════════════════════════════════════════════

    function render() {
      switch (state.phase) {
        case 'splash':       return renderSplash();
        case 'setup':        return renderSetup();
        case 'quick_setup':  return renderQuickSetup();
        case 'round_banner': return renderRoundBanner();
        case 'activation':   return renderActivation();
        case 'round_end':    return renderRoundEnd();
        default:             return renderSetup();
      }
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // EVENT HANDLERS — all called via window.CC_TC
    // ═══════════════════════════════════════════════════════════════════════════

    window.CC_TC = {

      backToSetup() {
        state.phase = 'setup';
        render();
      },

      startQuickMode() {
        state.phase = 'quick_setup';
        render();
      },

      async startFromQuickSetup() {
        const checked = Array.from(document.querySelectorAll('input[name="faction"]:checked'));
        if (checked.length < 2) {
          alert('Please select at least 2 factions.');
          return;
        }

        state.loadingData = true;
        state.factions = [];
        render();

        for (const cb of checked) {
          const id   = cb.value;
          const meta = FACTION_META[id];
          const npcSelect = document.querySelector(`select[name="npc_${id}"]`);
          const isNPC = !npcSelect || npcSelect.value === 'npc';
          const fData = await loadFactionData(id);
          const faction = fData
            ? buildFactionEntry(id, fData, isNPC, meta.isMonster)
            : buildQuickFaction(id, meta.name, 3, isNPC, meta.isMonster);
          initUnitStates(faction);
          state.factions.push(faction);
        }

        state.loadingData = false;
        this.beginGame();
      },

      openScenarioList() {
        if (!window.CC_STORAGE) { alert('Storage not available.'); return; }
        window.CC_STORAGE.listDocuments(SCENARIO_FOLDER).then(docs => {
          if (!docs?.length) { alert('No scenario saves found.'); return; }
          const list = docs.map(d => `
            <button onclick="window.CC_TC.loadScenario('${d.id}')"
              class="cc-btn cc-btn-secondary" style="width:100%;margin-bottom:.5rem;text-align:left;">
              📋 ${d.name || d.id}
            </button>`).join('');
          // Simple inline modal
          const overlay = document.createElement('div');
          overlay.style.cssText = 'position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,.85);' +
            'display:flex;align-items:center;justify-content:center;';
          overlay.innerHTML = `
            <div style="background:#1a1a1a;border:1px solid rgba(255,255,255,.15);border-radius:8px;
                        padding:1.5rem;max-width:500px;width:90%;max-height:80vh;overflow-y:auto;">
              <h5 style="margin:0 0 1rem;color:var(--cc-primary);">Load Scenario</h5>
              ${list}
              <button onclick="this.closest('div[style]').remove()"
                class="cc-btn cc-btn-secondary" style="width:100%;margin-top:.5rem;">
                Cancel
              </button>
            </div>`;
          document.body.appendChild(overlay);
        }).catch(() => alert('Failed to load saves.'));
      },

      async loadScenario(docId) {
        // Close modal
        document.querySelector('div[style*="z-index:9999"]')?.remove();
        try {
          const doc     = await window.CC_STORAGE.getDocument(docId);
          const payload = JSON.parse(doc.content);
          state.scenarioSave  = payload.scenario || payload;
          state.scenarioName  = payload.name || 'Scenario';
          state.noiseThreshold = 8 + (payload.danger || 3) * 2;

          // Monster pressure from scenario
          const mp = state.scenarioSave?.monster_pressure;
          state.monsterRoster = mp?.monsters || [];

          // Build factions from scenario
          state.loadingData = true;
          state.factions = [];
          render();

          const factionEntries = payload.factions || [];
          for (const fe of factionEntries) {
            const id   = fe.id;
            const meta = FACTION_META[id];
            if (!meta) continue;
            const fData = await loadFactionData(id);
            const faction = fData
              ? buildFactionEntry(id, fData, fe.npc ?? true, meta.isMonster)
              : buildQuickFaction(id, meta.name, 3, fe.npc ?? true, meta.isMonster);
            initUnitStates(faction);
            state.factions.push(faction);
          }

          state.loadingData = false;
          this.beginGame();
        } catch (err) {
          alert('Failed to load scenario: ' + err.message);
          state.loadingData = false;
          state.phase = 'setup';
          render();
        }
      },

      openGameList() {
        if (!window.CC_STORAGE) { alert('Storage not available.'); return; }
        // TODO: list from TURN_SAVE_FOLDER — implement in next pass
        alert('Resume coming soon — save/load is in the next build pass!');
      },

      beginGame() {
        state.round      = 1;
        state.unitState  = {};
        state.noiseLevel = 0;
        state.roundLog   = [];
        state.factions.forEach(f => initUnitStates(f));
        buildQueue();
        state.phase = 'round_banner';
        render();
      },

      startRound() {
        state.phase = 'activation';
        state.timerElapsed = 0;
        state.timerRunning = true;
        state.timerStart   = Date.now();
        render();
      },

      nextActivation() {
        // Stop timer, accumulate elapsed
        if (state.timerRunning) {
          state.timerElapsed += Date.now() - state.timerStart;
          state.timerRunning = false;
        }

        const hasMore = advanceQueue();
        if (!hasMore || isRoundComplete()) {
          endRound();
        } else {
          // Reset timer for next activation
          state.timerElapsed = 0;
          state.timerRunning = true;
          state.timerStart   = Date.now();
          render();
        }
      },

      markOut() {
        const item = currentQueueItem();
        if (!item) return;
        if (!confirm('Mark this unit as OUT?')) return;
        setUnitState(item.factionId, item.unitId, { out: true });
        const faction = getFactionById(item.factionId);
        const unit    = getUnitById(faction, item.unitId);
        state.roundLog.push(`✖ ${faction?.name}: ${unit?.name} is OUT.`);
        this.nextActivation();
      },

      adjustQuality(factionId, unitId, delta) {
        const us   = getUnitState(factionId, unitId);
        const unit = getUnitById(getFactionById(factionId), unitId);
        if (!us || !unit) return;
        const newQ = Math.max(0, Math.min(unit.quality, (us.quality || 0) + delta));
        setUnitState(factionId, unitId, { quality: newQ });
        if (newQ === 0) {
          // Prompt to mark OUT
          if (confirm(`${unit.name} is at Q0 — mark them OUT?`)) {
            setUnitState(factionId, unitId, { out: true });
            const faction = getFactionById(factionId);
            state.roundLog.push(`✖ ${faction?.name}: ${unit.name} is OUT (Q0).`);
            this.nextActivation();
            return;
          }
        }
        render();
      },

      logNoise(key) {
        const n = NOISE_VALUES[key];
        if (!n) return;
        addNoise(n.value, n.label);
        render();
      },

      toggleTimer() {
        if (state.timerRunning) {
          state.timerElapsed += Date.now() - state.timerStart;
          state.timerRunning = false;
        } else {
          state.timerStart   = Date.now();
          state.timerRunning = true;
          startTimerDisplay();
        }
        render();
      },

      async saveGame() {
        if (!window.CC_STORAGE) { alert('Storage not available.'); return; }
        const name = `GAME_Round${state.round}_${Date.now()}`;
        try {
          await window.CC_STORAGE.saveDocument(name, JSON.stringify({
            version:          '1.0',
            scenarioName:     state.scenarioName,
            round:            state.round,
            unitState:        state.unitState,
            noiseLevel:       state.noiseLevel,
            coughSeverity:    state.coughSeverity,
            timerElapsed:     state.timerElapsed,
            roundLog:         state.roundLog,
            allRoundLogs:     state.allRoundLogs,
            monstersTriggered: state.monstersTriggered,
            timestamp:        new Date().toISOString()
          }), TURN_SAVE_FOLDER);
          // Quick visual confirmation on the save button
          const btn = document.querySelector('[onclick="window.CC_TC.saveGame()"]');
          if (btn) {
            const orig = btn.innerHTML;
            btn.innerHTML = '✅';
            setTimeout(() => { btn.innerHTML = orig; }, 1500);
          }
        } catch (err) {
          alert('Save failed: ' + err.message);
        }
      },

      beginNextRound() {
        state.allRoundLogs.push({ round: state.round, log: [...state.roundLog] });
        state.roundLog = [];
        state.round++;
        deployReserves();
        buildQueue();
        state.phase = 'round_banner';
        render();
      },
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
    // INLINE KEYFRAME STYLES (injected once)
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
    // BOOT — 5-second splash, then setup
    // ═══════════════════════════════════════════════════════════════════════════

    const MIN_SPLASH_MS = 5000;
    const _bootStart    = Date.now();

    render(); // Shows splash immediately

    setTimeout(() => {
      const splash = document.getElementById('cc-tc-splash');
      if (splash) {
        splash.style.opacity = '0';
        setTimeout(() => {
          state.phase = 'setup';
          render();
        }, 650);
      } else {
        state.phase = 'setup';
        render();
      }
    }, MIN_SPLASH_MS);

  } // end init()
}; // end window.CC_APP
