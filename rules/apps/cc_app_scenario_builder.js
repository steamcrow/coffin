// ================================
// Scenario Builder App
// File: coffin/rules/apps/cc_app_scenario_builder.js
// ================================

console.log("🎲 Scenario Builder app loaded");

window.CC_APP = {
  init({ root, ctx }) {
    console.log("🚀 Scenario Builder init", ctx);

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

    if (!document.getElementById('cc-scenario-builder-styles')) {
      fetch('https://raw.githubusercontent.com/steamcrow/coffin/main/rules/apps/cc_app_scenario_builder.css?t=' + Date.now())
        .then(res => res.text())
        .then(css => {
          const style = document.createElement('style');
          style.id = 'cc-scenario-builder-styles';
          style.textContent = css;
          document.head.appendChild(style);
          console.log('✅ Scenario Builder CSS applied!');
        })
        .catch(err => console.error('❌ App CSS load failed:', err));
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

    const helpers = ctx?.helpers;

    if (!helpers) {
      root.innerHTML = `<div class="cc-app-shell h-100"><div class="container py-5 text-danger"><h4>Helpers not available</h4></div></div>`;
      return;
    }

    // ================================
    // STATE
    // ================================
    const state = {
      gameMode: null,
      pointValue: 500,
      dangerRating: 3,
      gameWarden: null,
      factions: [],
      locationType: null,
      selectedLocation: null,
      generated: false,
      scenario: null,
      currentStep: 1,
      completedSteps: []
    };

    // ================================
    // FACTION REGISTRY
    // ================================
    const FACTIONS = [
      { id: 'monster_rangers', name: 'Monster Rangers', file: 'faction-monster-rangers-v5.json' },
      { id: 'liberty_corps',   name: 'Liberty Corps',   file: 'faction-liberty-corps-v2.json'  },
      { id: 'monsterology',    name: 'Monsterology',    file: 'faction-monsterology-v2.json'   },
      { id: 'monsters',        name: 'Monsters',        file: 'faction-monsters-v2.json'       },
      { id: 'shine_riders',    name: 'Shine Riders',    file: 'faction-shine-riders-v2.json'   },
      { id: 'crow_queen',      name: 'Crow Queen',      file: 'faction-crow-queen.json'        }
    ];

    // ================================
    // DATA LOADING
    // ================================
    let plotFamiliesData   = null;
    let twistTablesData    = null;
    let locationData       = null;
    let locationTypesData  = null;
    let monsterFactionData = null;
    let scenarioVaultData  = null;
    let scenarioNamesData  = null;
    let factionDataMap     = {};

    async function loadGameData() {
      try {
        const base = 'https://raw.githubusercontent.com/steamcrow/coffin/main';
        const t    = '?t=' + Date.now();

        const [plotRes, twistRes, locRes, locTypesRes, monstersRes, vaultRes, namesRes] = await Promise.all([
          fetch(`${base}/rules/src/200_plot_families.json${t}`),
          fetch(`${base}/rules/src/210_twist_tables.json${t}`),
          fetch(`${base}/rules/src/170_named_locations.json${t}`),
          fetch(`${base}/rules/src/150_location_types.json${t}`),
          fetch(`${base}/factions/faction-monsters-v2.json${t}`),
          fetch(`${base}/rules/src/180_scenario_vault.json${t}`),
          fetch(`${base}/rules/src/230_scenario_names.json${t}`)
        ]);

        plotFamiliesData   = await plotRes.json();
        twistTablesData    = await twistRes.json();
        locationData       = await locRes.json();
        locationTypesData  = await locTypesRes.json();
        monsterFactionData = await monstersRes.json();
        scenarioVaultData  = await vaultRes.json();
        scenarioNamesData  = await namesRes.json();

        const PLAYER_FACTIONS = [
          { id: 'monster_rangers', file: 'faction-monster-rangers-v5.json' },
          { id: 'liberty_corps',   file: 'faction-liberty-corps-v2.json'  },
          { id: 'monsterology',    file: 'faction-monsterology-v2.json'   },
          { id: 'shine_riders',    file: 'faction-shine-riders-v2.json'   },
          { id: 'crow_queen',      file: 'faction-crow-queen.json'        }
        ];
        factionDataMap = {};
        await Promise.all(PLAYER_FACTIONS.map(async ({ id, file }) => {
          try {
            const res = await fetch(`${base}/factions/${file}${t}`);
            factionDataMap[id] = await res.json();
            console.log(`✅ Faction loaded: ${id}`);
          } catch (e) {
            console.warn(`⚠️ Could not load faction: ${id}`, e);
            factionDataMap[id] = null;
          }
        }));

        console.log('✅ All game data loaded');
      } catch (err) {
        console.error('❌ Failed to load game data:', err);
        alert('Failed to load scenario data. Please refresh the page.');
      }
    }

    // ================================
    // MAP EMBED — URLs + STATE
    // ================================
    const MAP_APP_URL     = 'https://raw.githubusercontent.com/steamcrow/coffin/main/rules/apps/canyon_map/cc_canyon_map_app.js';
    const MAP_DATA_URL    = 'https://raw.githubusercontent.com/steamcrow/coffin/main/rules/apps/canyon_map/data/canyon_map.json';
    const LEAFLET_CSS_URL = 'https://raw.githubusercontent.com/steamcrow/coffin/main/rules/vendor/leaflet/leaflet.css';
    const LEAFLET_JS_URL  = 'https://raw.githubusercontent.com/steamcrow/coffin/main/rules/vendor/leaflet/leaflet.js';

    let _mapData      = null;   // cached canyon_map.json
    let _leafletReady = false;  // have we loaded Leaflet yet?
    let _scenarioMap  = null;   // active Leaflet instance in the embed (so we can destroy it on re-render)

    // Load a remote JS file as a blob script (same pattern as the map app)
    function loadScriptDynamic(url) {
      return fetch(url + '?t=' + Date.now())
        .then(r => r.text())
        .then(code => new Promise((resolve, reject) => {
          const blob = new Blob([code], { type: 'text/javascript' });
          const src  = URL.createObjectURL(blob);
          const s    = document.createElement('script');
          s.src      = src;
          s.onload   = () => { URL.revokeObjectURL(src); resolve(); };
          s.onerror  = () => { URL.revokeObjectURL(src); reject(new Error('Script load failed: ' + url)); };
          document.head.appendChild(s);
        }));
    }

    // Load a remote CSS file as an inline <style> (same pattern as map app)
    function loadStyleDynamic(url, id) {
      if (document.getElementById(id)) return Promise.resolve();
      return fetch(url + '?t=' + Date.now())
        .then(r => r.text())
        .then(css => {
          const s = document.createElement('style');
          s.id    = id;
          s.textContent = css;
          document.head.appendChild(s);
        });
    }

    // Ensure Leaflet CSS + JS are available (idempotent)
    async function ensureLeaflet() {
      if (_leafletReady && window.L) return;
      await loadStyleDynamic(LEAFLET_CSS_URL, 'cc-leaflet-css');
      if (!window.L) await loadScriptDynamic(LEAFLET_JS_URL);
      _leafletReady = true;
    }

    // Ensure window.CC_HITBOXES is available by loading the map app (idempotent)
    async function ensureHitboxes() {
      if (window.CC_HITBOXES) return window.CC_HITBOXES;
      try {
        await loadScriptDynamic(MAP_APP_URL);
      } catch (e) {
        console.warn('⚠️ Could not load map app for hitboxes:', e);
      }
      return window.CC_HITBOXES || {};
    }

    // Fetch and cache canyon_map.json
    async function fetchMapData() {
      if (_mapData) return _mapData;
      const res = await fetch(MAP_DATA_URL + '?t=' + Date.now());
      _mapData = await res.json();
      return _mapData;
    }

    // ================================
    // UTILITIES
    // ================================
    function randomChoice(arr) {
      if (!arr || arr.length === 0) return null;
      return arr[Math.floor(Math.random() * arr.length)];
    }

    function randomInt(min, max) {
      return Math.floor(Math.random() * (max - min + 1)) + min;
    }

    function getDangerDescription(rating) {
      const map = {
        1: 'Skirmish — light danger',
        2: 'Tense — expect resistance',
        3: 'Hostile — expect casualties',
        4: 'Dangerous — expect losses',
        5: 'Deadly — expect to mourn',
        6: 'Lethal — survival unlikely'
      };
      return map[rating] || 'Unknown danger level';
    }

    // ================================
    // FIX 3: CARGO VEHICLE NAME HELPER
    // Returns "Cargo Tiger Truck" for Monster Rangers, otherwise "Cargo Vehicle"
    // ================================
    function getCargoVehicleName() {
      const hasRangers = state.factions.some(f => f.id === 'monster_rangers');
      return hasRangers ? 'Cargo Tiger Truck' : 'Cargo Vehicle';
    }

    // ================================
    // LOCATION PROFILE BUILDER
    // ================================
    function buildLocationProfile(locationType, selectedLocationId) {
      let location = null;

      if (locationType === 'named' && selectedLocationId && locationData) {
        location = locationData.locations.find(l => l.id === selectedLocationId);
      }

      if (!location && locationData?.locations?.length) {
        location = randomChoice(locationData.locations);
      }

      if (!location) {
        return {
          id:               'unknown',
          name:             'Unknown Territory',
          emoji:            '❓',
          archetype:        'frontier',
          state:            'poisoned',
          features:         [],
          effectiveDanger:  state.dangerRating,
          effectiveResources: {},
          monster_seeds:    [],
          tags:             [],
          notes:            [],
          description:      '',
          atmosphere:       ''
        };
      }

      let typeDefaults = {};
      if (locationTypesData?.location_types && location.type_ref) {
        typeDefaults = locationTypesData.location_types.find(t => t.id === location.type_ref) || {};
      }

      const effectiveResources = Object.assign({}, typeDefaults.base_resources || {}, location.resources || {});
      const effectiveDanger    = location.danger ?? state.dangerRating;

      return {
        id:               location.id,
        name:             location.name,
        emoji:            location.emoji || '📍',
        archetype:        location.archetype || 'unknown',
        state:            location.state || 'alive',
        features:         location.features || [],
        effectiveDanger,
        effectiveResources,
        monster_seeds:    location.monster_seeds || [],
        tags:             location.tags || [],
        notes:            location.notes || [],
        description:      location.description || '',
        atmosphere:       location.atmosphere || '',
        terrain_flavor:   location.terrain_flavor || [],
        rumors:           location.rumors || []
      };
    }

    // ================================
    // VAULT SCENARIO MATCHING
    // ================================
    function matchVaultScenario(plotFamily, locProfile, contextTags) {
      if (!scenarioVaultData?.scenarios?.length) return { scenario: null, score: 0 };

      const allTags = [
        ...(plotFamily.tags || []),
        ...(locProfile.tags || []),
        ...contextTags,
        locProfile.archetype
      ].filter(Boolean).map(t => t.toLowerCase());

      let best      = null;
      let bestScore = 0;

      for (const s of scenarioVaultData.scenarios) {
        const sTags = (s.tags || []).map(t => t.toLowerCase());
        const score = sTags.filter(t => allTags.includes(t)).length;
        if (score > bestScore) {
          best      = s;
          bestScore = score;
        }
      }

      return { scenario: bestScore >= 2 ? best : null, score: bestScore };
    }

    // ================================
    // RESOURCE DISPLAY HELPER
    // ================================
    function buildResourceSummary(resources) {
      if (!resources) return '';
      const LABELS = {
        food_good:    '🍖 Food',
        water_clean:  '💧 Water',
        medicine:     '💉 Medicine',
        supplies:     '📦 Supplies',
        thyr:         '💎 Thyr',
        silver:       '🥈 Silver',
        weapons:      '🔫 Weapons',
        moonshine:    '🥃 Moonshine',
        spare_parts:  '⚙️ Parts',
        rotgut:       '🍶 Rotgut',
        food_foul:    '☠️ Foul Food',
        water_foul:   '🤢 Foul Water'
      };
      const VITAL = ['food_good', 'water_clean', 'medicine', 'supplies'];
      const highs  = [];
      const absent = [];

      for (const [k, v] of Object.entries(resources)) {
        if (typeof v !== 'number') continue;
        if (v >= 2 && LABELS[k]) highs.push(`<span class="cc-resource-high">${LABELS[k]}: ${v}</span>`);
        if (v === 0 && VITAL.includes(k)) absent.push(`<span class="cc-resource-absent">${LABELS[k]} ✗</span>`);
      }

      if (highs.length === 0 && absent.length === 0) return '';
      return `<p>${highs.concat(absent).join(' ')}</p>`;
    }

    // ================================
    // FIX 2: NARRATIVE HOOK GENERATOR
    // Now accepts objectives array so it can name specific things
    // (e.g. "Cargo Tiger Truck" instead of "a fragile or vital asset")
    // ================================
    function generateNarrativeHook(plotFamily, location, objectives) {
      const locName  = location.name;
      const atmo     = location.atmosphere || '';
      const desc     = location.description ? location.description.split('.')[0] : '';

      // Build a specific plot description based on actual objectives
      // instead of falling back to the generic plotFamily.description
      let plotDesc = (plotFamily.description || '').replace(/\.$/, '');

      // --- Replace generic asset language with the real objective name ---
      const cargoObj = objectives?.find(o => o.type === 'cargo_vehicle');
      if (cargoObj) {
        const cargoName = cargoObj.name; // "Cargo Tiger Truck" or "Cargo Vehicle"
        // Replace any version of "a fragile or vital asset" / "an asset" / "the asset"
        plotDesc = plotDesc.replace(
          /a fragile or vital asset|an asset|the asset|a fragile asset|a vital asset/gi,
          `the ${cargoName}`
        );
      }

      const thyrObj     = objectives?.find(o => o.type === 'thyr_cache' || o.type === 'ritual_site');
      const supplyObj   = objectives?.find(o => o.type === 'stored_supplies' || o.type === 'scattered_crates');
      const ritualObj   = objectives?.find(o => o.type === 'ritual_components' || o.type === 'ritual_circle');

      // Build a specific situation summary from the actual objectives
      let situationLine = '';
      if (cargoObj) {
        situationLine = `The ${cargoObj.name} needs to cross ${locName} intact — that's already the hard part.`;
      } else if (thyrObj) {
        situationLine = `The Thyr at ${locName} is active. That means someone already knows about it.`;
      } else if (ritualObj) {
        situationLine = `${locName} is the only place the ritual can be completed. Everyone is racing to get there.`;
      } else if (supplyObj) {
        situationLine = `The caches at ${locName} are the kind of find that changes who survives the season.`;
      }

      // Pick from a pool of strongly-voiced hooks
      const pools = [
        // Arrival hooks
        `Nobody who left ${locName} told the same story. ${plotDesc}. The only way to know is to go in.`,
        `Three factions picked up the same rumour about ${locName} within 48 hours. That's not coincidence. ${plotDesc}.`,
        `${locName} was supposed to be a clean job. The Canyon had other ideas. ${plotDesc}.`,
        `${desc ? desc + '. ' : ''}${plotDesc}. The factions arrive at the same time. That's the problem.`,
        // Tension hooks
        `The window at ${locName} is closing. ${plotDesc}. Whoever moves first may be the only one who leaves with anything.`,
        `Something at ${locName} drew too much attention. ${plotDesc}. Now everyone is reacting and nobody is thinking.`,
        `${plotDesc} at ${locName}. The smart money said don't get involved. The smart money wasn't enough.`,
        `The last group through ${locName} didn't come back whole. ${plotDesc}. That didn't stop the next group.`,
        // Canyon voice hooks
        `The Canyon doesn't warn you. At ${locName}, it just changes the terms. ${plotDesc}.`,
        `${locName}. ${atmo ? '"' + atmo + '"' : 'Whatever it was, it isn\'t that anymore.'}. ${plotDesc}.`,
        `${plotDesc}. ${locName} is where it ends — or where it gets worse.`,
        `Word reached ${locName} before anyone expected. ${plotDesc}. By the time boots hit the ground, it was already complicated.`,
      ];

      // If we have a specific situation line, prepend it to a pool pick
      if (situationLine) {
        return situationLine + ' ' + randomChoice(pools.slice(6)); // use a canyon-voice hook as the second sentence
      }

      // Try plot-family specific hook first
      if (plotFamily?.hook)   return plotFamily.hook;
      if (plotFamily?.flavor) return `${plotFamily.flavor} ${plotDesc} at ${locName}.`;

      return randomChoice(pools);
    }

    // ================================
    // FIX 1: SCENARIO NAME GENERATOR
    // Fixed double-location bug: location.name no longer appears in
    // both the prefix slot AND the middle slot.
    // New format: "[Adjective] [Location] — [Noun]"
    // ================================
    function generateScenarioNameFromTags(plotFamily, location, objectives, twist, dangerRating, contextTags) {
      contextTags = contextTags || [];
      location    = location || { name: 'Unknown' };

      if (scenarioNamesData) {
        const prefixes = scenarioNamesData.prefixes || [];
        const suffixes = scenarioNamesData.suffixes || [];

        // Tag-aware prefix selection
        const taggedPrefixes = prefixes.filter(p =>
          Array.isArray(p.tags) && p.tags.some(t => contextTags.includes(t))
        );

        const prefix = taggedPrefixes.length
          ? (randomChoice(taggedPrefixes)?.text || randomChoice(prefixes)?.text || 'Bloody')
          : (randomChoice(prefixes)?.text || 'Bloody');

        const suffix = randomChoice(suffixes)?.text || 'Reckoning';

        // FIX: location.name appears exactly ONCE — in the center slot only.
        // Do NOT use the "middle" field from names data (it contains location names
        // which caused "Camp Coffin — Camp Coffin Huck" duplication).
        return `${prefix} ${location.name} — ${suffix}`;
      }

      // Fallback without JSON data
      const fallbackPrefixes = ['Bloody', 'Burning', 'Broken', 'Cursed', 'Forsaken', 'Iron'];
      const fallbackSuffixes = ['Reckoning', 'Standoff', 'Collapse', 'Ruin', 'Harvest', 'Judgment'];
      return `${randomChoice(fallbackPrefixes)} ${location.name} — ${randomChoice(fallbackSuffixes)}`;
    }

    // ================================
    // MONSTER PRESSURE GENERATOR
    // ================================
    function generateMonsterPressure(plotFamily, dangerRating, locProfile) {
      const enabled = Math.random() > 0.3;
      if (!enabled || !monsterFactionData) return { enabled: false };

      const budgetPercent    = 0.2 + (dangerRating / 6) * 0.2;
      const monsterBudget    = Math.floor(state.pointValue * budgetPercent);
      const selectedMonsters = [];
      let remainingBudget    = monsterBudget;
      let seedBased          = false;

      if (locProfile?.monster_seeds?.length > 0) {
        let attempts = 0;
        while (remainingBudget > 100 && attempts < 10) {
          const seed = randomChoice(locProfile.monster_seeds);
          const unit = monsterFactionData.units?.find(u => u.name === seed.name);
          if (!unit || unit.cost > remainingBudget) { attempts++; continue; }
          selectedMonsters.push(unit);
          remainingBudget -= unit.cost;
          seedBased = true;
          attempts++;
        }
      }

      if (selectedMonsters.length === 0 && monsterFactionData.units) {
        const available = monsterFactionData.units.filter(u => u.cost <= monsterBudget);
        let budget = monsterBudget;
        while (budget > 0 && available.length > 0) {
          const valid   = available.filter(m => m.cost <= budget);
          if (valid.length === 0) break;
          const monster = randomChoice(valid);
          selectedMonsters.push(monster);
          budget -= monster.cost;
        }
      }

      const escalationNote = plotFamily.escalation_bias
        ? `Escalation: ${randomChoice(plotFamily.escalation_bias).replace(/_/g, ' ')}`
        : null;

      return {
        enabled:    true,
        trigger:    `Round ${randomInt(2, 4)}`,
        monsters:   selectedMonsters,
        seed_based: seedBased,
        notes:      escalationNote
      };
    }

    // ================================
    // AFTERMATH GENERATOR
    // ================================
    function generateAftermath(plotFamily) {
      const options = plotFamily.aftermath_bias || ['location_state_change', 'resource_depletion_or_corruption'];
      const type    = randomChoice(options);
      const descriptions = {
        location_state_change:            'This location will be permanently altered by the outcome.',
        resource_depletion_or_corruption: 'Resources here will be depleted or corrupted.',
        new_landmark_created:             'A new landmark will mark what happened here.',
        faction_ownership:                'The victor will claim lasting control.',
        mystical_claim:                   'Mystical forces will remember this event.',
        monster_bias_shift:               'Monster behaviour in this region will change.'
      };
      return descriptions[type] || 'The Canyon will remember what happened here.';
    }

    // ================================
    // OBJECTIVE GENERATION ENGINE
    // ================================

    const RESOURCE_OBJECTIVE_AFFINITY = {
      supplies:         ['stored_supplies', 'scattered_crates'],
      food_good:        ['stored_supplies', 'scattered_crates'],
      food_foul:        ['fouled_resource', 'tainted_ground'],
      water_clean:      ['stored_supplies'],
      water_foul:       ['fouled_resource', 'tainted_ground'],
      thyr:             ['thyr_cache', 'ritual_site', 'ritual_circle'],
      tzul_silver:      ['artifact', 'ritual_site', 'sacrificial_focus'],
      silver:           ['land_marker', 'command_structure'],
      lead:             ['land_marker', 'wrecked_engine'],
      mechanical_parts: ['wrecked_engine', 'unstable_structure'],
      spare_parts:      ['wrecked_engine', 'unstable_structure'],
      livestock:        ['pack_animals', 'cargo_vehicle'],
      medicine:         ['stored_supplies', 'scattered_crates'],
      weapons:          ['fortified_position', 'command_structure', 'barricades'],
      moonshine:        ['scattered_crates', 'cargo_vehicle'],
      rotgut:           ['fouled_resource', 'scattered_crates'],
      gildren:          ['land_marker', 'command_structure']
    };

    const ALL_OBJECTIVE_TYPES = [
      'wrecked_engine', 'scattered_crates', 'derailed_cars',
      'cargo_vehicle', 'pack_animals', 'ritual_components',
      'ritual_site', 'land_marker', 'command_structure',
      'thyr_cache', 'artifact', 'captive_entity',
      'fortified_position', 'barricades', 'stored_supplies',
      'ritual_circle', 'tainted_ground', 'sacrificial_focus',
      'collapsing_route', 'fouled_resource', 'unstable_structure',
      'evacuation_point'
    ];

    // FIX 3: makeObjectiveName uses getCargoVehicleName() for the cargo_vehicle type
    function makeObjectiveName(type, locProfile) {
      const r        = locProfile?.effectiveResources || {};
      const features = locProfile?.features || [];

      // FIX 3: Cargo vehicle respects faction context
      if (type === 'cargo_vehicle') {
        return getCargoVehicleName();
      }

      if (type === 'fouled_resource') {
        if ((r.water_foul || 0) >= 1 && (r.rotgut || 0) >= 1)
          return 'Fouled Water & Rotgut Cache';
        if ((r.water_foul || 0) >= 1)
          return 'Tainted Water Supply';
        if ((r.rotgut || 0) >= 1)
          return 'Spoiled Rotgut Barrels';
        if ((r.food_foul || 0) >= 1)
          return 'Contaminated Ration Store';
        return 'Fouled Resource Cache';
      }

      if (type === 'unstable_structure') {
        if (features.includes('GlassShards') || features.includes('KnifeRocks'))
          return 'Glass-Wall Overhang';
        if (features.includes('RailGrade')   || features.includes('BrakeScars'))
          return 'Failing Rail Section';
        if (features.includes('RockfallChutes'))
          return 'Rockfall Chute';
        if (features.includes('NarrowPass'))
          return 'Crumbling Canyon Shelf';
        const arch = locProfile?.archetype || '';
        if (arch === 'arroyo')     return 'Eroded Canyon Wall';
        if (arch === 'rail_grade') return 'Failing Trestle';
        if (arch === 'boomtown')   return 'Condemned Boomtown Building';
        return 'Unstable Structure';
      }

      const names = {
        wrecked_engine:     'Wrecked Engine',
        scattered_crates:   'Scattered Supply Crates',
        derailed_cars:      'Derailed Cars',
        pack_animals:       'Pack Animals',
        ritual_components:  'Ritual Components',
        ritual_site:        'Ritual Site',
        land_marker:        'Land Marker',
        command_structure:  'Command Structure',
        thyr_cache:         'Thyr Crystal Cache',
        artifact:           'Ancient Artifact',
        captive_entity:     'Captive Entity',
        fortified_position: 'Fortified Position',
        barricades:         'Barricades',
        stored_supplies:    'Stored Supplies',
        ritual_circle:      'Ritual Circle',
        tainted_ground:     'Tainted Ground',
        sacrificial_focus:  'Sacrificial Focus',
        collapsing_route:   'Collapsing Route',
        evacuation_point:   'Evacuation Point'
      };
      return names[type] || 'Contested Objective';
    }

    function makeObjectiveDescription(type, locProfile) {
      const r = locProfile?.effectiveResources || {};
      const cargoName = getCargoVehicleName(); // FIX 3

      const descriptions = {
        wrecked_engine:     'Salvage mechanical parts or prevent others from claiming them. Each salvage increases Coffin Cough risk.',
        scattered_crates:   'Collect and extract scattered food, water, and supplies before others claim them.',
        derailed_cars:      "Search the wreckage for valuable cargo before it's lost or claimed.",
        // FIX 3: use the real vehicle name in the description
        cargo_vehicle:      `Escort the ${cargoName} safely across the board. The sweet scent may attract monsters.`,
        pack_animals:       'Control or escort the animals. They may panic under fire.',
        ritual_components:  'Gather mystical components scattered across the battlefield.',
        ritual_site:        'Control this location to complete rituals or disrupt enemy mysticism.',
        land_marker:        'Hold this symbolic location to establish territorial claim.',
        command_structure:  'Control this position to coordinate forces and establish leadership.',
        thyr_cache:         'Extract or corrupt the glowing Thyr crystals. Handling Thyr is always dangerous.',
        artifact:           'Recover the ancient artifact. Its true nature may be hidden.',
        captive_entity:     'Free, capture, or control the entity. May not be what it appears.',
        fortified_position: 'Hold this defensible position against all comers.',
        barricades:         'Control the chokepoint to restrict enemy movement.',
        stored_supplies:    'Secure stockpiled resources before they are depleted.',
        ritual_circle:      'Control the circle to empower rituals or prevent enemy mysticism.',
        tainted_ground:     'Interact at your own risk. Corruption spreads.',
        sacrificial_focus:  'Control or destroy this dark altar.',
        collapsing_route:   'The passage is deteriorating. Hold it open or let it collapse to trap the enemy.',
        fouled_resource:    'Contaminated supplies that are worse than nothing — unless you know what to do with them.',
        unstable_structure: 'The building will not survive the battle. Get what you need from it before it comes down.',
        evacuation_point:   'Reach this location to escape the escalating danger.'
      };

      let base = descriptions[type] || 'Control this objective to score victory points.';

      if (locProfile) {
        if (type === 'stored_supplies'  && (r.supplies   || 0) >= 4)
          base = `These caches hold enough to shift the balance — food, medicine, kit. ${base}`;
        if (type === 'scattered_crates' && (r.food_good  || 0) >= 3)
          base = `The crates are scattered but what's inside is worth the risk. ${base}`;
        if (type === 'thyr_cache'       && (r.thyr       || 0) >= 4)
          base = `The crystals are warm to the touch and getting warmer. ${base}`;
        if (type === 'fouled_resource'  && (r.water_foul || 0) >= 2)
          base = `The water here is wrong. Something got in. ${base}`;
        if (type === 'fouled_resource'  && (r.rotgut     || 0) >= 2)
          base = `The barrels are marked safe but the smell says otherwise. ${base}`;
      }
      return base;
    }

    // FIX 4: makeObjectiveSpecial names the actual monster when available
    function makeObjectiveSpecial(type, locProfile) {
      // For "guarded" specials, try to name a real monster from seeds or faction data
      if (Math.random() < 0.4) {
        const seeds = locProfile?.monster_seeds || [];
        if (seeds.length > 0) {
          const seed = randomChoice(seeds);
          return `Guarded — ${seed.name} nearby`;
        }
        // Fall back to a generic monster from the faction data
        if (monsterFactionData?.units?.length) {
          const genericMonster = randomChoice(monsterFactionData.units);
          if (genericMonster) return `Guarded — ${genericMonster.name} nearby`;
        }
      }

      const specials = [
        'Unstable — may collapse if damaged',
        'Tainted — triggers morale tests',
        'Valuable — worth extra VP',
        'Corrupted — alters nearby terrain',
        'Hot — every faction already knows about it'
      ];
      return randomChoice(specials);
    }

    function calcObjectiveVP(type, locProfile) {
      const r = locProfile?.effectiveResources || {};
      const table = {
        stored_supplies:    Math.max(2, Math.ceil((r.supplies    || 2) / 2)),
        scattered_crates:   Math.max(2, Math.ceil(((r.food_good || 1) + (r.supplies || 1)) / 3)),
        thyr_cache:         Math.max(3, r.thyr    || 3),
        ritual_site:        Math.max(3, Math.ceil((r.thyr || 2) * 0.8)),
        ritual_circle:      Math.max(3, Math.ceil((r.thyr || 2) * 0.8)),
        land_marker:        Math.max(2, Math.ceil((r.silver || 2) / 2)),
        wrecked_engine:     Math.max(2, Math.ceil((r.spare_parts || 2) / 2)),
        pack_animals:       Math.max(2, Math.ceil((r.livestock || 2) / 2)),
        artifact:           4,
        sacrificial_focus:  4,
        captive_entity:     4,
        ritual_components:  3,
        fortified_position: 3,
        command_structure:  3,
        cargo_vehicle:      3,
        collapsing_route:   3,
        fouled_resource:    2,
        tainted_ground:     3,
        barricades:         2,
        unstable_structure: 2,
        evacuation_point:   3,
        derailed_cars:      2
      };
      return table[type] || 2;
    }

    function generateObjectives(plotFamily, locProfile) {
      const scores = {};
      ALL_OBJECTIVE_TYPES.forEach(t => scores[t] = 0);

      (plotFamily.default_objectives || []).forEach(t => {
        if (scores[t] !== undefined) scores[t] += 3;
      });

      if (locProfile?.effectiveResources) {
        const r = locProfile.effectiveResources;
        for (const [key, val] of Object.entries(r)) {
          if (typeof val === 'number' && val >= 2) {
            (RESOURCE_OBJECTIVE_AFFINITY[key] || []).forEach(t => {
              if (scores[t] !== undefined) scores[t] += val;
            });
          }
        }

        if ((r.water_clean || 0) < 1 && (r.water_foul || 0) < 1 && (r.rotgut || 0) < 1 && (r.food_foul || 0) < 1)
          scores['fouled_resource'] = Math.max(0, scores['fouled_resource'] - 4);
        if ((r.thyr || 0) < 2) {
          scores['thyr_cache']    = Math.max(0, scores['thyr_cache']    - 4);
          scores['ritual_circle'] = Math.max(0, scores['ritual_circle'] - 2);
        }
        if ((r.spare_parts || 0) < 2)
          scores['wrecked_engine'] = Math.max(0, scores['wrecked_engine'] - 3);
        if ((r.livestock || 0) < 2)
          scores['pack_animals'] = 0;
        if ((r.tzul_silver || 0) < 3)
          scores['sacrificial_focus'] = Math.max(0, scores['sacrificial_focus'] - 2);
      }

      const sorted = Object.entries(scores)
        .filter(([, s]) => s > 0)
        .sort((a, b) => b[1] - a[1]);

      console.log('🎯 Objective scores (top 6):', sorted.slice(0, 6).map(([t, s]) => `${t}:${s}`).join(', '));

      const numObjectives = randomInt(2, 3);
      const objectives    = [];
      const used          = new Set();

      const EXCLUSIVE_GROUPS = {
        taint_group:   ['tainted_ground', 'fouled_resource'],
        ritual_group:  ['ritual_site', 'ritual_circle', 'sacrificial_focus', 'ritual_components'],
        salvage_group: ['wrecked_engine', 'derailed_cars', 'unstable_structure'],
        supply_group:  ['stored_supplies', 'scattered_crates']
      };
      const usedGroups = new Set();

      function getGroup(type) {
        for (const [grp, types] of Object.entries(EXCLUSIVE_GROUPS)) {
          if (types.includes(type)) return grp;
        }
        return null;
      }

      for (const [type] of sorted) {
        if (objectives.length >= numObjectives) break;
        if (used.has(type)) continue;
        const grp = getGroup(type);
        if (grp && usedGroups.has(grp)) continue;
        used.add(type);
        if (grp) usedGroups.add(grp);
        objectives.push({
          name:        makeObjectiveName(type, locProfile),
          description: makeObjectiveDescription(type, locProfile),
          type,
          vp_base:     calcObjectiveVP(type, locProfile),
          special:     Math.random() < 0.2 ? makeObjectiveSpecial(type, locProfile) : null  // FIX 4: pass locProfile
        });
      }

      if (objectives.length === 0) {
        objectives.push({
          name:        'Contested Ground',
          description: 'Hold this position.',
          type:        'land_marker',
          vp_base:     3,
          special:     null
        });
      }

      return objectives;
    }

    function generateObjectivesFromVault(vaultScenario, locProfile) {
      const objectives = [];
      if (vaultScenario.objectives && Array.isArray(vaultScenario.objectives)) {
        vaultScenario.objectives.forEach(vo => {
          const type = vo.id || vo.type;
          objectives.push({
            name:        makeObjectiveName(type, locProfile),
            description: vo.notes ? vo.notes[0] : makeObjectiveDescription(type, locProfile),
            type,
            vp_base:     3,
            special:     vo.special ? vo.special.join(', ') : null
          });
        });
      }
      if (objectives.length < 2) {
        objectives.push({
          name:        'Contested Objective',
          description: 'Control this location to score victory points.',
          type:        'land_marker',
          vp_base:     2,
          special:     null
        });
      }
      return objectives;
    }

    // ================================
    // OBJECTIVE MARKERS TABLE
    // ================================
    const OBJECTIVE_MARKER_TABLE = {
      wrecked_engine:     { count: '1',    placement: 'Center board',              token: 'Wreck token or large model',    interactions: ['SALVAGE', 'CONTROL', 'SABOTAGE'] },
      scattered_crates:   { count: 'd3+2', placement: 'Scattered across board',    token: 'Crate tokens',                  interactions: ['COLLECT', 'EXTRACT'] },
      stored_supplies:    { count: 'd3+1', placement: 'Within 6″ of center',       token: 'Supply crate tokens',           interactions: ['CLAIM', 'EXTRACT'] },
      derailed_cars:      { count: 'd3+1', placement: 'Scattered near wreck',      token: 'Rail car tokens',               interactions: ['SEARCH', 'EXTRACT'] },
      // FIX 3: cargo_vehicle uses the faction-aware name at render time
      cargo_vehicle:      { count: '1',    placement: 'One table edge, center',    token: 'Vehicle model',                 interactions: ['BOARD', 'ESCORT', 'DISABLE'] },
      pack_animals:       { count: 'd3',   placement: 'Center board',              token: 'Animal tokens',                 interactions: ['CONTROL', 'ESCORT'] },
      ritual_components:  { count: 'd3+1', placement: 'Scattered across board',    token: 'Component tokens',              interactions: ['GATHER', 'CORRUPT'] },
      ritual_site:        { count: '1',    placement: 'Center board',              token: 'Ritual marker (3″ radius)',     interactions: ['ACTIVATE', 'DISRUPT', 'CORRUPT'] },
      ritual_circle:      { count: '1',    placement: 'Center board',              token: 'Circle marker (3″ radius)',     interactions: ['ACTIVATE', 'DISRUPT', 'CONTROL'] },
      land_marker:        { count: '3',    placement: 'Spread across board',       token: 'Territory markers',             interactions: ['CLAIM', 'CONTROL'] },
      command_structure:  { count: '1',    placement: 'Strategic position',        token: 'Command post marker',           interactions: ['CONTROL', 'HOLD', 'DESTROY'] },
      thyr_cache:         { count: '1',    placement: 'Center board',              token: 'Glowing crystal token',         interactions: ['EXTRACT', 'CORRUPT', 'DESTROY'] },
      artifact:           { count: '1',    placement: 'Center board',              token: 'Artifact token',                interactions: ['RECOVER', 'EXAMINE', 'DESTROY'] },
      captive_entity:     { count: '1',    placement: 'Random mid-board',          token: 'Entity marker or model',        interactions: ['FREE', 'CAPTURE', 'CONTROL'] },
      fortified_position: { count: '1',    placement: 'Defensible terrain',        token: 'Fortification marker',          interactions: ['HOLD', 'ASSAULT', 'REINFORCE'] },
      barricades:         { count: '1',    placement: 'Chokepoint / lane center',  token: 'Barricade tokens',              interactions: ['HOLD', 'DESTROY', 'BYPASS'] },
      tainted_ground:     { count: '1',    placement: 'Dangerous central area',    token: 'Taint marker (6″ radius)',      interactions: ['CLEANSE', 'CORRUPT', 'AVOID'] },
      sacrificial_focus:  { count: '1',    placement: 'Center board',              token: 'Altar token',                   interactions: ['CONTROL', 'DESTROY', 'ACTIVATE'] },
      unstable_structure: { count: '1',    placement: 'Random mid-board',          token: 'Structure marker',              interactions: ['SALVAGE', 'CONTROL', 'COLLAPSE'] },
      collapsing_route:   { count: '1',    placement: 'Divides board in half',     token: 'Route markers at each end',     interactions: ['CROSS', 'BLOCK', 'REINFORCE'] },
      evacuation_point:   { count: '1',    placement: 'Far table edge, center',    token: 'Exit marker',                   interactions: ['REACH', 'ESCAPE'] },
      fouled_resource:    { count: '2',    placement: 'Scatter near center',       token: 'Contaminated supply tokens',    interactions: ['CONTROL', 'PURGE', 'WEAPONIZE'] }
    };

    function generateObjectiveMarkers(objectives, vaultScenario) {
      const markers = [];
      objectives.forEach(obj => {
        let vaultObj = null;
        if (vaultScenario?.objectives) {
          vaultObj = vaultScenario.objectives.find(vo => vo.id === obj.type || vo.type === obj.type);
        }
        const defaults = OBJECTIVE_MARKER_TABLE[obj.type] || {
          count:        '1',
          placement:    'Board center',
          token:        'Objective token',
          interactions: []
        };
        markers.push({
          name:         obj.name,  // Already has correct name (e.g. "Cargo Tiger Truck")
          type:         obj.type,
          count:        vaultObj?.count       || defaults.count,
          placement:    defaults.placement,
          token:        defaults.token,
          interactions: vaultObj?.interactions?.length ? vaultObj.interactions : defaults.interactions,
          notes:        vaultObj?.notes ? vaultObj.notes[0] : null
        });
      });
      return markers;
    }

    // ================================
    // VICTORY CONDITIONS ENGINE
    // ================================

    const FACTION_APPROACH = {
      monster_rangers: {
        verbs:    ['Secure', 'Protect', 'Stabilize', 'Guard', 'Preserve'],
        vp_style: 'per_round',
        bonus:    'Bonus VP if no casualties.',
        tactic:   'Defensive positioning. +1 die when protecting objectives.',
        quote:    'Not all protectors carry badges.'
      },
      monsterology: {
        verbs:    ['Extract', 'Harvest', 'Acquire', 'Catalogue', 'Weaponize'],
        vp_style: 'per_extraction',
        bonus:    'Can convert extracted resources to VP.',
        tactic:   'Surgical extraction. Ignore collateral damage.',
        quote:    'Progress has a price, paid in full by the land.'
      },
      liberty_corps: {
        verbs:    ['Seize', 'Lock Down', 'Control', 'Claim', 'Arrest'],
        vp_style: 'area_control',
        bonus:    'Bonus VP for arrests over kills.',
        tactic:   'Hold the line. +1 die from controlled positions.',
        quote:    'Order will be maintained.'
      },
      shine_riders: {
        verbs:    ['Hit', 'Grab', 'Flip', 'Salt', 'Extract'],
        vp_style: 'hit_and_run',
        bonus:    'Bonus VP if Shine Boss exits with resources.',
        tactic:   'Speed over combat. Extract early, stay mobile.',
        quote:    'Everything has a price. We just set it.'
      },
      crow_queen: {
        verbs:    ['Claim', 'Convert', 'Subjugate', 'Consecrate', 'Crown'],
        vp_style: 'per_round',
        bonus:    'Bonus VP for each monster converted to a Subject.',
        tactic:   'Dominance through will. Obelisk presence amplifies control.',
        quote:    'Everything in the canyon kneels. Eventually.'
      },
      monsters: {
        verbs:    ['Claim', 'Guard', 'Hold', 'Escape', 'Feed'],
        vp_style: 'survival',
        bonus:    'Bonus VP per model alive at end.',
        tactic:   'Territorial. Protect the ground or flee to exits.',
        quote:    'The canyon was here first.'
      }
    };

    const FACTION_OBJECTIVE_FLAVOR = {
      monster_rangers: {
        monsters_befriendable: "There's a creature out there that doesn't want to fight. Reach it before the others do — use your Pocket Snacks. Walk it off the board alive.",
        monsters_hostile:      "The monster is cornered or terrified. Don't put it down — get between it and the factions that will. Escort it to an exit.",
        stored_supplies:       "These caches belong to the canyon's people. Every crate we hold is someone who doesn't go hungry.",
        scattered_crates:      "Gather what's left. Supplies belong to survivors, not scavengers.",
        fouled_resource:       "Contaminated doesn't mean worthless. We can purify it. Others will weaponize it.",
        unstable_structure:    "Get what's salvageable out before it comes down. Then let it fall.",
        collapsing_route:      "We need this route. Hold it open long enough to get what matters through.",
        thyr_cache:            "Don't extract the Thyr — monitor it. Mark the cluster and get out.",
        land_marker:           "This territory needs to be witnessed and recorded. Not conquered.",
        command_structure:     "Control the structure. Use it to call in support, not to fortify.",
        cargo_vehicle:         "Get the Cargo Tiger Truck through. Whatever's in it matters — that's the job."
      },
      monsterology: {
        monsters_befriendable: "Unclassified specimen. Mobile, possibly sapient, definitely valuable. Capture it intact — no kill shots until a live capture is confirmed impossible.",
        monsters_hostile:      "Threat-class specimen. If live capture is impossible, harvest what you can on the way out. The Institute pays by weight.",
        stored_supplies:       "Survey the caches. Record contents. Extract anything with research value.",
        scattered_crates:      "Scattered materials mean a field opportunity. Collect everything, sort later.",
        fouled_resource:       "Contaminated supplies are a sample set. The Institute wants the contaminant, not the supplies.",
        unstable_structure:    "Structural analysis while it's still standing. Extract data before it collapses.",
        collapsing_route:      "Geological event in real-time. Document it. Extract before it seals.",
        thyr_cache:            "Active Thyr cluster. Extract maximum yield. Radiation protocols in effect.",
        land_marker:           "Survey marker. Record coordinates and resource density. File the claim.",
        command_structure:     "This installation has records. Extract them.",
        cargo_vehicle:         "The vehicle is the specimen. Analyse its contents. Extract samples."
      },
      liberty_corps: {
        monsters_befriendable: "Unlicensed biological entity. Subdue and contain for formal classification.",
        monsters_hostile:      "Active threat to personnel. Engage and neutralize. File the report afterward.",
        stored_supplies:       "Unsecured federal property. Lock it down. Anyone else touching it is a thief.",
        scattered_crates:      "Contraband until proven otherwise. Collect and tag for inspection.",
        fouled_resource:       "Biohazard. Cordon the area. Decontamination is Corps jurisdiction.",
        unstable_structure:    "Condemned. Hold the perimeter. Nobody goes in without clearance.",
        collapsing_route:      "Critical infrastructure. Hold or reroute. The Corps controls movement here.",
        thyr_cache:            "Unregulated Thyr extraction is a federal crime. Secure the site.",
        land_marker:           "Territory is Corps jurisdiction. Plant the flag. Hold it.",
        command_structure:     "Command post. Secure it first. Everything else flows from here.",
        cargo_vehicle:         "Intercept the vehicle. Inspect its cargo. Impound if necessary."
      },
      shine_riders: {
        monsters_befriendable: "Chaos costs nothing. If the creature goes left, we go right. Use it.",
        monsters_hostile:      "Distraction. While it's eating whoever's dumbest, we hit the real target.",
        stored_supplies:       "Full caches. Best haul in the canyon if we move before anyone else notices.",
        scattered_crates:      "Grab what you can carry. Leave the rest for the fire.",
        fouled_resource:       "Contaminated supplies that are worse than nothing — unless you know what to do with them.",
        unstable_structure:    "Quick grab before it comes down. We've done worse.",
        collapsing_route:      "The chaos at the route is our window. Hit the real objective while they watch it fall.",
        thyr_cache:            "Hot cargo but the buyer doesn't ask questions. Extract fast.",
        land_marker:           "Nobody owns this canyon. But if we plant the marker, we collect the fee.",
        command_structure:     "Hit the command post. Take what's valuable. Make it look like someone else.",
        cargo_vehicle:         "Whatever that truck is carrying is worth more than the truck. Get it and go."
      },
      crow_queen: {
        monsters_befriendable: "These creatures are subjects who have not yet pledged. Convert them. Gently if possible.",
        monsters_hostile:      "They resist the Crown's call. Break them or convert them. There is no third option.",
        stored_supplies:       "The canyon's resources flow to the Crown. Claim the cache. Consecrate it.",
        scattered_crates:      "Scattered tribute. Gather it in the Crown's name.",
        fouled_resource:       "What others call contamination, the Crown calls potential. Claim and convert it.",
        unstable_structure:    "The canyon reshapes itself for her. Claim what's within before it transforms.",
        collapsing_route:      "Patience is dominance. Hold the route long enough to demonstrate who commands this ground.",
        thyr_cache:            "The crystals already answer to the Crown. Claim them formally.",
        land_marker:           "The canyon was always hers. This marker is a reminder.",
        command_structure:     "There is one command in this canyon. Replace whatever was here with an Obelisk.",
        cargo_vehicle:         "The vehicle carries something useful. Crown it. Then drive it where you need it."
      }
    };

    function generateVictoryConditions(plotFamily, objectives, locProfile) {
      const conditions = {};

      const hasMonsterPressure = objectives.some(o => o.type === 'captive_entity');
      const injectMonsterObjective = hasMonsterPressure ||
        state.factions.some(f => f.id === 'monsters');

      state.factions.forEach(faction => {
        const approach  = FACTION_APPROACH[faction.id] || FACTION_APPROACH.monsters;
        const flavorMap = FACTION_OBJECTIVE_FLAVOR[faction.id] || {};

        const candidatePool = [];

        if (injectMonsterObjective && faction.id !== 'monsters') {
          const isFriendly  = faction.id === 'monster_rangers' || faction.id === 'crow_queen';
          const flavorKey   = isFriendly ? 'monsters_befriendable' : 'monsters_hostile';
          const monsterDesc = flavorMap[flavorKey] || "Deal with the monsters on the board.";
          const monsterVP   = {
            monster_rangers: '+3 VP per monster safely escorted off board. +5 VP if befriended and fighting alongside you.',
            monsterology:    '+4 VP per monster harvested and extracted off board. +2 VP per live capture.',
            liberty_corps:   '+3 VP per monster captured. +2 VP per monster eliminated.',
            shine_riders:    '+3 VP if you redirect a monster into an enemy faction this game. +1 VP per round you avoid monster contact.',
            crow_queen:      '+4 VP per monster converted to a Crown Subject. +2 VP per round a converted monster fights for you.'
          };
          candidatePool.push({
            name:   'Monsters on the Board',
            desc:   monsterDesc,
            vp:     monsterVP[faction.id] || '+2 VP per monster interaction.',
            tactic: approach.tactic
          });
        }

        objectives.forEach(obj => {
          // FIX 3: use the actual objective name (already "Cargo Tiger Truck") as the flavorMap key
          // Try the type key first, then fall back to the generic verb approach
          const flavorKey = obj.type;
          const desc      = flavorMap[flavorKey]
            || `${randomChoice(approach.verbs)} the ${obj.name}.`;
          const vp        = `+${obj.vp_base} VP base`;

          candidatePool.push({
            name:   `${randomChoice(approach.verbs)} — ${obj.name}`,
            desc,
            vp,
            tactic: approach.tactic
          });
        });

        const shuffled         = candidatePool.sort(() => Math.random() - 0.5);
        const pickedObjectives = shuffled.slice(0, 2);

        const finale   = buildFactionFinale(faction.id, objectives, state.dangerRating, locProfile);
        const aftermath = buildFactionAftermath(faction.id, plotFamily);
        const isNPC    = faction.id === 'monsters' || faction.id === 'crow_queen';

        conditions[faction.id] = {
          faction_name: faction.name,
          is_npc:       isNPC,
          objectives:   pickedObjectives,
          finale,
          aftermath,
          quote:        approach.quote
        };
      });

      return conditions;
    }

    function buildFactionFinale(factionId, objectives, dangerRating, locProfile) {
      const danger = dangerRating || 3;

      const finales = {
        monster_rangers: {
          name: 'The Canyon Holds',
          desc: 'Preserve what matters. Leave the canyon better than you found it.',
          vp:   `${danger * 2} VP if no permanent terrain is destroyed by your faction`
        },
        liberty_corps: {
          name: 'Full Occupation',
          desc: 'Hold all contested objectives simultaneously for one full round.',
          vp:   `${danger * 3} VP if you hold all objectives at round end`
        },
        monsterology: {
          name: 'Total Extraction Protocol',
          desc: 'Extract from every objective on the board. Leave nothing.',
          vp:   `${danger * 3} VP if all objectives extracted`
        },
        shine_riders: {
          name: 'The Getaway',
          desc: 'Extract the highest-value objective and get your Boss off the board.',
          vp:   `${danger * 3} VP if Boss exits with extracted resource before Round 4`
        },
        crow_queen: {
          name: 'Canyon Remembers',
          desc: 'Patience is dominance. Hold. Hold. Hold.',
          vp:   `15 VP if Crown holds center objective for 3+ rounds`
        },
        monsters: {
          name: 'Herd Intact',
          desc: 'Survive. That is the win condition.',
          vp:   `15 VP if 3+ monster units alive at game end`
        }
      };

      return finales[factionId] || {
        name: 'Last Stand',
        desc: 'Hold the line.',
        vp:   `${danger * 2} VP`
      };
    }

    function buildFactionAftermath(factionId, plotFamily) {
      const immediates = {
        monster_rangers: [
          'The Rangers restore balance.',
          'The canyon breathes again.',
          'What was taken is returned.'
        ],
        monsterology: [
          'Specimen crates loaded.',
          'The survey is complete.',
          'Progress continues. The site is stripped bare.'
        ],
        liberty_corps: [
          'The area is secured.',
          'Jurisdiction established.',
          'Federal flags rise. The law holds.'
        ],
        shine_riders: [
          'The Riders are gone before anyone organises a pursuit.',
          'The haul is counted. Nobody left empty-handed.',
          'Some resources are missing. No one is sure who took them.'
        ],
        crow_queen: [
          "The Crown's marks appear on every surface. The canyon feels different here.",
          'New subjects kneel. The canyon shifts in her favour.',
          'The Obelisk pulses once and goes dark. Something lingers.'
        ],
        monsters: [
          'The canyon reclaims it.',
          'The predators scatter — and regroup elsewhere.',
          'Silence returns. A hungry kind.'
        ]
      };

      const longTerms = {
        monster_rangers: [
          'Monster populations stabilize. The Wild remains wild.',
          'Something was preserved today. The canyon remembers.',
          'The canyon is not safe. But it is kept.'
        ],
        monsterology: [
          'Progress has a price, paid in full by the land.',
          'The specimens will be studied.',
          'Nothing grows here because everything useful is gone.'
        ],
        liberty_corps: [
          'Liberated land is clean. And very quiet.',
          'Trade routes secured, but tension rises.',
          'Order will be maintained. The Corps will return.'
        ],
        shine_riders: [
          'Word spreads that the Shine Riders hit this location. Defenders get nervous everywhere.',
          'Crime and opportunity intertwine.',
          "They'll be back when the heat dies down."
        ],
        crow_queen: [
          "The Regent's influence expands. The canyon shifts in her favour.",
          'Old stone remembers old names.',
          'The subjects multiply.'
        ],
        monsters: [
          'They were here before the people came.',
          'Monsters use this area as a feeding ground and nesting site.',
          'The canyon is older than all of them.'
        ]
      };

      const canyonStates = {
        monster_rangers: 'Held',
        monsterology:    'Extracted',
        liberty_corps:   'Liberated',
        shine_riders:    'Lawless',
        crow_queen:      'Exalted',
        monsters:        'Strangewild'
      };

      return {
        immediate:    randomChoice(immediates[factionId]  || immediates.monsters),
        canyon_state: canyonStates[factionId] || 'Contested',
        long_term:    randomChoice(longTerms[factionId]   || longTerms.monsters)
      };
    }

    // ================================
    // MAIN SCENARIO GENERATION
    // ================================
    window.generateScenario = function() {
      console.log('🎲 Generating scenario...', state);

      if (!plotFamiliesData || !twistTablesData || !monsterFactionData) {
        alert('Game data not loaded yet. Please wait a moment and try again.');
        return;
      }

      const dangerRating = state.dangerRating || 3;
      const contextTags  = [];

      const locProfile = buildLocationProfile(state.locationType, state.selectedLocation);
      console.log('📍 Location profile:', locProfile);

      const families   = plotFamiliesData.plot_families || [];
      const plotFamily = randomChoice(families);
      console.log('📖 Plot family:', plotFamily.name);

      const { scenario: vaultScenario, score: maxMatchScore } = matchVaultScenario(plotFamily, locProfile, contextTags);
      if (vaultScenario) console.log(`📚 Vault match: ${vaultScenario.name} (${maxMatchScore} tags)`);

      // Generate objectives BEFORE generating the name or narrative hook
      // so the hook and name can reference specific objective names
      const objectives = vaultScenario
        ? generateObjectivesFromVault(vaultScenario, locProfile)
        : generateObjectives(plotFamily, locProfile);

      const monsterPressure = generateMonsterPressure(plotFamily, dangerRating, locProfile);

      let twist = null;
      if (Math.random() < 0.3) {
        const eligible = (twistTablesData.twists || []).filter(t =>
          t.danger_floor <= dangerRating && t.danger_ceiling >= dangerRating
        );
        if (eligible.length > 0) {
          const td = randomChoice(eligible);
          twist = {
            name:        td.name,
            description: td.description,
            example:     randomChoice(td.example_outcomes || [])
          };
        }
      }

      const objectiveMarkers  = generateObjectiveMarkers(objectives, vaultScenario);
      const victoryConditions = generateVictoryConditions(plotFamily, objectives, locProfile);
      const aftermath         = generateAftermath(plotFamily);

      const nameContextTags = [...contextTags];
      if (vaultScenario?.tags) {
        vaultScenario.tags.forEach(t => { if (!nameContextTags.includes(t)) nameContextTags.push(t); });
      }

      // FIX 1: scenario name no longer repeats location.name
      const scenarioName = generateScenarioNameFromTags(plotFamily, locProfile, objectives, twist, dangerRating, nameContextTags);

      // FIX 2: narrative hook now knows about objectives so it can name specific things
      const narrative_hook = vaultScenario?.narrative_hook
        ? vaultScenario.narrative_hook
        : generateNarrativeHook(plotFamily, locProfile, objectives);

      state.scenario = {
        name:               scenarioName,
        narrative_hook,
        location:           locProfile,
        danger_rating:      dangerRating,
        danger_description: getDangerDescription(dangerRating),
        plot_family:        plotFamily.name,
        objectives,
        monster_pressure:   monsterPressure,
        twist,
        victory_conditions: victoryConditions,
        aftermath,
        factions:           state.factions,
        pointValue:         state.pointValue,
        gameMode:           state.gameMode,
        loc_profile:        locProfile,
        objective_markers:  objectiveMarkers,
        vault_source:       vaultScenario ? vaultScenario.name : null,
        vault_match_score:  vaultScenario ? maxMatchScore : 0
      };

      state.generated = true;
      render();
    };

    // ================================
    // LOCATION MAP EMBED
    // Two-panel layout:
    //   LEFT  — static tiny overview of the whole canyon.
    //           An orange highlight box shows where the location is.
    //           Never moves, never loads Leaflet.
    //   RIGHT — zoomed Leaflet map centered on the location.
    //           Gold star + name label. Read-only.
    // ================================

    const TINY_MAP_URL = 'https://raw.githubusercontent.com/steamcrow/coffin/main/rules/apps/canyon_map/data/map_coffin_canyon_tiny.jpg';

    function renderLocationMapEmbed() {
      return `
        <div id="cc-scenario-map-wrap"
             style="display:flex;gap:6px;
                    margin:0.5rem 0 0.75rem 0;
                    border-radius:8px;overflow:hidden;
                    border:1px solid rgba(255,117,24,0.3);
                    align-items:stretch;">

          <!-- LEFT: static overview — width drives the layout, image fills it naturally -->
          <div id="cc-scenario-map-overview"
               style="flex:0 0 33%;position:relative;overflow:hidden;background:#0a0a0a;">
            <img id="cc-scenario-map-tiny"
                 src="${TINY_MAP_URL}"
                 alt="Canyon overview"
                 style="width:100%;height:auto;display:block;opacity:0.85;">
            <!-- highlight box injected by initLocationMapEmbed -->
            <div id="cc-scenario-map-highlight"
                 style="display:none;position:absolute;
                        border:2px solid #ff7518;
                        background:rgba(255,117,24,0.25);
                        box-shadow:0 0 0 1px rgba(0,0,0,0.6),
                                   0 0 12px rgba(255,117,24,0.5);
                        pointer-events:none;"></div>
            <div id="cc-scenario-map-here"
                 style="display:none;position:absolute;bottom:6px;left:0;right:0;
                        text-align:center;
                        font-size:0.55rem;letter-spacing:0.12em;text-transform:uppercase;
                        color:rgba(255,255,255,0.5);">Canyon overview</div>
          </div>

          <!-- RIGHT: zoomed Leaflet map — stretches to match left panel height -->
          <div id="cc-scenario-map-embed"
               style="flex:1;position:relative;background:#111;min-height:260px;">
            <div style="position:absolute;inset:0;display:flex;align-items:center;
                        justify-content:center;color:rgba(255,255,255,0.25);
                        font-size:0.8rem;letter-spacing:0.1em;text-transform:uppercase;">
              Loading map&hellip;
            </div>
          </div>

        </div>`;
    }

    async function initLocationMapEmbed(locProfile) {
      const leafletContainer = document.getElementById('cc-scenario-map-embed');
      const highlightEl      = document.getElementById('cc-scenario-map-highlight');
      const hereEl           = document.getElementById('cc-scenario-map-here');
      if (!leafletContainer) return;

      if (_scenarioMap) {
        try { _scenarioMap.remove(); } catch (e) {}
        _scenarioMap = null;
      }

      try {
        const [hitboxes, mapData] = await Promise.all([
          ensureHitboxes(),
          fetchMapData(),
          ensureLeaflet()
        ]);

        const px   = mapData.map.background.image_pixel_size;
        const bbox = hitboxes[locProfile.id];

        // ── LEFT PANEL: position the highlight box ──────────────────
        // Leaflet CRS.Simple: lat=0 is BOTTOM of image, lat=px.h is TOP.
        // CSS:                top=0% is TOP of img,      top=100% is BOTTOM.
        // So we flip the Y axis: cssTop = (1 - maxLat/px.h) * 100
        if (bbox && highlightEl && hereEl) {
          const minLat = bbox[0], maxLat = bbox[2];
          const minLng = bbox[1], maxLng = bbox[3];

          const cssTop    = (1 - maxLat / px.h) * 100;   // flip Y
          const cssLeft   = (minLng / px.w) * 100;
          const cssHeight = ((maxLat - minLat) / px.h) * 100;
          const cssWidth  = ((maxLng - minLng) / px.w) * 100;

          // Minimum visible size for tiny locations
          const minW = Math.max(cssWidth,  1.5);
          const minH = Math.max(cssHeight, 0.8);

          highlightEl.style.top     = cssTop  + '%';
          highlightEl.style.left    = cssLeft + '%';
          highlightEl.style.width   = minW   + '%';
          highlightEl.style.height  = minH   + '%';
          highlightEl.style.display = 'block';
          hereEl.style.display      = 'block';
        }

        // ── RIGHT PANEL: Leaflet zoomed map ────────────────────────
        const bounds  = [[0, 0], [px.h, px.w]];
        let centerLat = px.h / 2;
        let centerLng = px.w / 2;
        if (bbox) {
          centerLat = (bbox[0] + bbox[2]) / 2;
          centerLng = (bbox[1] + bbox[3]) / 2;
        }

        leafletContainer.innerHTML = '';

        const L = window.L;
        _scenarioMap = L.map(leafletContainer, {
          crs:                L.CRS.Simple,
          minZoom:            -4,
          maxZoom:            0,
          zoomControl:        false,
          attributionControl: false,
          dragging:           false,
          scrollWheelZoom:    false,
          doubleClickZoom:    false,
          touchZoom:          false,
          keyboard:           false
        });

        L.imageOverlay(mapData.map.background.image_key, bounds).addTo(_scenarioMap);

        if (bbox) {
          L.rectangle(
            [[bbox[0], bbox[1]], [bbox[2], bbox[3]]],
            {
              color:       'rgba(255,117,24,0.9)',
              fillColor:   'rgba(255,117,24,0.18)',
              fillOpacity: 1,
              weight:      2,
              interactive: false
            }
          ).addTo(_scenarioMap);

          L.marker([centerLat, centerLng], {
            icon: L.divIcon({
              className: '',
              html: `<i class="fa fa-star"
                        style="color:#ffd700;font-size:1.5rem;
                               text-shadow:0 0 10px rgba(0,0,0,0.9),0 0 4px #000;
                               display:block;line-height:1;"></i>`,
              iconSize:   [20, 20],
              iconAnchor: [10, 10]
            }),
            interactive: false
          }).addTo(_scenarioMap);

          L.marker([centerLat, centerLng], {
            icon: L.divIcon({
              className: '',
              html: `<div style="color:#fff;font-weight:800;white-space:nowrap;
                                 font-size:0.72rem;letter-spacing:0.03em;
                                 text-shadow:0 1px 4px #000,0 0 8px #000;
                                 padding-top:4px;">
                       ${locProfile.emoji || '📍'} ${locProfile.name}
                     </div>`,
              iconSize:   [0, 0],
              iconAnchor: [-4, -12]
            }),
            interactive: false
          }).addTo(_scenarioMap);
        }

        _scenarioMap.setView([centerLat, centerLng], -2);

        requestAnimationFrame(() => {
          try { _scenarioMap.invalidateSize({ animate: false }); } catch (e) {}
        });

      } catch (err) {
        console.warn('⚠️ Location map embed failed:', err);
        if (leafletContainer) {
          leafletContainer.innerHTML = `<div style="padding:1rem;color:rgba(255,255,255,0.25);
                                                    font-size:0.8rem;text-align:center;">
                                          Map unavailable
                                        </div>`;
        }
      }
    }

    // ================================
    // RENDER: ACCORDION STEP WRAPPER
    // ================================
    function renderAccordionStep(stepNum, title, icon, content, isActive, isComplete) {
      return `
        <div class="cc-accordion-item ${isActive ? 'active' : ''} ${isComplete ? 'complete' : ''}">
          <div class="cc-accordion-header" onclick="openStep(${stepNum})">
            <div class="cc-step-icon">${icon}</div>
            <div class="cc-step-title">${title}</div>
            <div class="cc-step-status">${isComplete ? '<i class="fa fa-check"></i>' : ''}</div>
          </div>
          <div class="cc-accordion-body" style="display: ${isActive ? 'block' : 'none'}">
            ${content}
          </div>
        </div>
      `;
    }

    // ================================
    // RENDER: STEP 1 — GAME SETUP
    // ================================
    function renderStep1_GameSetup() {
      return `
        <div class="cc-form-section">
          <label class="cc-label">Game Mode</label>
          <div class="cc-button-group">
            <button class="cc-btn ${state.gameMode === 'solo' ? 'cc-btn-primary' : 'cc-btn-ghost'}"
                    onclick="setGameMode('solo')">Solo Play</button>
            <button class="cc-btn ${state.gameMode === 'multiplayer' ? 'cc-btn-primary' : 'cc-btn-ghost'}"
                    onclick="setGameMode('multiplayer')">Multiplayer</button>
          </div>
        </div>

        <div class="cc-form-section">
          <label class="cc-label">Point Value</label>
          <select class="cc-input" onchange="setPointValue(this.value)">
            <option value="500"  ${state.pointValue === 500  ? 'selected' : ''}>500 ₤</option>
            <option value="1000" ${state.pointValue === 1000 ? 'selected' : ''}>1000 ₤</option>
            <option value="1500" ${state.pointValue === 1500 ? 'selected' : ''}>1500 ₤</option>
            <option value="2000" ${state.pointValue === 2000 ? 'selected' : ''}>2000 ₤</option>
          </select>
        </div>

        <div class="cc-form-section">
          <label class="cc-label">Danger Rating</label>
          <select class="cc-input" onchange="setDangerRating(this.value)">
            <option value="1" ${state.dangerRating === 1 ? 'selected' : ''}>&#9733;&#9734;&#9734;&#9734;&#9734;&#9734; &mdash; Controlled</option>
            <option value="2" ${state.dangerRating === 2 ? 'selected' : ''}>&#9733;&#9733;&#9734;&#9734;&#9734;&#9734; &mdash; Frontier Risk</option>
            <option value="3" ${state.dangerRating === 3 ? 'selected' : ''}>&#9733;&#9733;&#9733;&#9734;&#9734;&#9734; &mdash; Hostile</option>
            <option value="4" ${state.dangerRating === 4 ? 'selected' : ''}>&#9733;&#9733;&#9733;&#9733;&#9734;&#9734; &mdash; Dangerous</option>
            <option value="5" ${state.dangerRating === 5 ? 'selected' : ''}>&#9733;&#9733;&#9733;&#9733;&#9733;&#9734; &mdash; Extreme</option>
            <option value="6" ${state.dangerRating === 6 ? 'selected' : ''}>&#9733;&#9733;&#9733;&#9733;&#9733;&#9733; &mdash; Catastrophic</option>
          </select>
        </div>

        <div class="cc-form-section">
          <label class="cc-label">Game Warden</label>
          <select class="cc-input" onchange="setGameWarden(this.value)">
            <option value="none"      ${!state.gameWarden               ? 'selected' : ''}>No Warden</option>
            <option value="observing" ${state.gameWarden === 'observing' ? 'selected' : ''}>Observing</option>
            <option value="npc"       ${state.gameWarden === 'npc'       ? 'selected' : ''}>Running NPC</option>
          </select>
        </div>

        ${state.gameMode ? `
          <div class="cc-form-actions">
            <button class="cc-btn cc-btn-primary" onclick="completeStep(1)">Next: Factions &rarr;</button>
          </div>
        ` : ''}
      `;
    }

    // ================================
    // RENDER: STEP 2 — FACTIONS & FORCES
    // ================================
    function renderStep2_Factions() {
      if (!state.gameMode) {
        return `<div class="cc-info-box"><p>Complete Step 1 first.</p></div>`;
      }

      if (state.gameMode === 'solo') {
        const playerFaction = state.factions.find(f => !f.isNPC);
        return `
          <div class="cc-form-section">
            <label class="cc-label">Your Faction</label>
            <select class="cc-input" onchange="setPlayerFaction(this.value)">
              <option value="">Choose your faction&hellip;</option>
              ${FACTIONS.filter(f => f.id !== 'monsters').map(f => `
                <option value="${f.id}" ${playerFaction?.id === f.id ? 'selected' : ''}>${f.name}</option>
              `).join('')}
            </select>
          </div>

          <div class="cc-form-section">
            <label class="cc-label">NPC Opponents</label>
            <p class="cc-help-text">Choose which factions you'll be playing against.</p>
            ${FACTIONS.map(f => {
              const isNPC = state.factions.some(sf => sf.id === f.id && sf.isNPC);
              return `
                <div class="cc-faction-row">
                  <label class="cc-checkbox-label">
                    <input type="checkbox" ${isNPC ? 'checked' : ''}
                      onchange="toggleNPCFaction('${f.id}', '${f.name}', this.checked)">
                    ${f.name}
                  </label>
                  <span class="cc-help-text" style="margin:0">(NPC)</span>
                </div>
              `;
            }).join('')}
          </div>

          <div class="cc-form-actions">
            <button class="cc-btn cc-btn-ghost" onclick="openStep(1)">&larr; Back</button>
            <button class="cc-btn cc-btn-primary" onclick="completeStep(2)"
              ${!playerFaction ? 'disabled' : ''}>Next: Location &rarr;</button>
          </div>
        `;
      }

      // Multiplayer
      return `
        <div class="cc-form-section">
          <label class="cc-label">Factions Playing</label>
          <p class="cc-help-text">Select each faction in this game. Mark NPCs where needed.</p>
          ${FACTIONS.map(f => {
            const inGame = state.factions.find(sf => sf.id === f.id);
            return `
              <div class="cc-faction-row">
                <label class="cc-checkbox-label">
                  <input type="checkbox" ${inGame ? 'checked' : ''}
                    onchange="toggleFaction('${f.id}', '${f.name}', this.checked)">
                  ${f.name}
                </label>
                ${inGame ? `
                  <input type="text" class="cc-input cc-player-name"
                    placeholder="Player name..."
                    value="${inGame.player || ''}"
                    onchange="setFactionPlayer('${f.id}', this.value)">
                  <label class="cc-checkbox-label" style="flex:0 0 auto">
                    <input type="checkbox" ${inGame.isNPC ? 'checked' : ''}
                      onchange="toggleFactionNPC('${f.id}', this.checked)">
                    NPC
                  </label>
                ` : ''}
              </div>
            `;
          }).join('')}
        </div>

        <div class="cc-form-actions">
          <button class="cc-btn cc-btn-ghost" onclick="openStep(1)">&larr; Back</button>
          <button class="cc-btn cc-btn-primary" onclick="completeStep(2)"
            ${state.factions.length < 2 ? 'disabled' : ''}>Next: Location &rarr;</button>
        </div>
      `;
    }

    // ================================
    // RENDER: STEP 3 — LOCATION
    // ================================
    function renderStep3_Location() {
      const namedLocations = locationData?.locations || [];

      return `
        <div class="cc-form-section">
          <label class="cc-label">Location Type</label>
          <div class="cc-button-group">
            <button class="cc-btn ${state.locationType === 'random_any' ? 'cc-btn-primary' : 'cc-btn-ghost'}"
                    onclick="setLocationType('random_any')">Random</button>
            <button class="cc-btn ${state.locationType === 'named' ? 'cc-btn-primary' : 'cc-btn-ghost'}"
                    onclick="setLocationType('named')">Named Location</button>
          </div>
        </div>

        ${state.locationType === 'named' ? `
          <div class="cc-form-section">
            <label class="cc-label">Choose Location</label>
            <select class="cc-input" onchange="setSelectedLocation(this.value)">
              <option value="">&mdash; Select a location &mdash;</option>
              ${namedLocations.map(loc => `
                <option value="${loc.id}" ${state.selectedLocation === loc.id ? 'selected' : ''}>
                  ${loc.name} (Danger ${loc.danger || '?'})
                </option>
              `).join('')}
            </select>
          </div>
        ` : ''}

        ${state.locationType === 'random_any' ? `
          <div class="cc-info-box"><p><i class="fa fa-info-circle"></i> A random location will be chosen when you generate.</p></div>
        ` : ''}

        <div class="cc-form-actions">
          <button class="cc-btn cc-btn-ghost" onclick="openStep(2)">&larr; Back</button>
          <button class="cc-btn cc-btn-primary" onclick="completeStep(3)"
            ${(state.locationType === 'named' && !state.selectedLocation) || !state.locationType ? 'disabled' : ''}>
            Next: Generate Scenario &rarr;
          </button>
        </div>
      `;
    }

    // ================================
    // RENDER: STEP 4 — GENERATE
    // ================================
    function renderStep4_Generate() {
      if (!state.generated) {
        const locName = state.locationType === 'named'
          ? locationData?.locations.find(l => l.id === state.selectedLocation)?.name || 'Named'
          : 'Random';
        return `
          <div class="cc-generate-section">
            <p class="cc-help-text">Ready to generate your scenario based on:</p>
            <ul class="cc-summary-list">
              <li><strong>Mode:</strong> ${state.gameMode === 'solo' ? 'Solo Play' : 'Multiplayer'}</li>
              <li><strong>Points:</strong> ${state.pointValue} &#8356;</li>
              <li><strong>Danger:</strong> ${'&#9733;'.repeat(state.dangerRating)}${'&#9734;'.repeat(6 - state.dangerRating)}</li>
              <li><strong>Factions:</strong> ${state.factions.map(f => f.name + (f.isNPC ? ' (NPC)' : '')).join(', ') || '—'}</li>
              <li><strong>Location:</strong> ${locName}</li>
            </ul>
            <div class="cc-form-actions">
              <button class="cc-btn cc-btn-ghost" onclick="openStep(3)">&larr; Back</button>
              <button class="cc-btn cc-btn-primary" onclick="generateScenario()"><i class="fa fa-dice"></i> Generate Scenario</button>
            </div>
          </div>
        `;
      }
      return renderScenarioOutput();
    }

    // ================================
    // RENDER: SCENARIO OUTPUT
    // ================================
    function renderScenarioOutput() {
      const s = state.scenario;
      if (!s) return '';

      return `
        <div class="cc-scenario-result">

          <h3>${s.name}</h3>
          <div class="cc-scenario-hook">${s.narrative_hook}</div>

          <!-- LOCATION -->
          <div class="cc-scenario-section">
            <h4><i class="fa fa-map-marker"></i> Location</h4>
            <p>
              <strong>${s.location.name}</strong>
              <span class="cc-state-badge cc-state-${s.location.state}">${s.location.state}</span>
              &nbsp;Danger ${s.danger_rating} &mdash; ${s.danger_description}
            </p>
            ${s.location.description ? `<p><em>${s.location.description}</em></p>` : ''}
            ${s.location.atmosphere  ? `<p class="cc-quote">"${s.location.atmosphere}"</p>` : ''}
            ${s.location.features?.length ? `<p class="cc-help-text">${s.location.features.join(' &middot; ')}</p>` : ''}
            ${buildResourceSummary(s.location.effectiveResources)}
            ${renderLocationMapEmbed()}
          </div>

          <!-- OBJECTIVES -->
          <div class="cc-scenario-section">
            <h4><i class="fa fa-crosshairs"></i> Objectives</h4>
            ${s.objectives.map(obj => `
              <div class="cc-objective-card">
                <strong>${obj.name}</strong>
                <p>${obj.description}</p>
                <p class="cc-vp-line"><i class="fa fa-star"></i> ${obj.vp_base} VP base</p>
                ${obj.special ? `<p><em><i class="fa fa-exclamation-triangle"></i> Special: ${obj.special}</em></p>` : ''}
              </div>
            `).join('')}
          </div>

          <!-- BOARD SETUP TABLE -->
          ${s.objective_markers?.length ? `
            <div class="cc-scenario-section cc-markers-section">
              <h4><i class="fa fa-thumb-tack"></i> Board Setup &mdash; Objective Markers</h4>
              <p class="cc-markers-intro">Before the game begins, place these tokens on the board as described.</p>
              <table class="cc-marker-table">
                <thead>
                  <tr>
                    <th>MARKER</th>
                    <th>COUNT</th>
                    <th>PLACEMENT</th>
                    <th>ACTIONS</th>
                  </tr>
                </thead>
                <tbody>
                  ${s.objective_markers.map(m => `
                    <tr>
                      <td>
                        <strong>${m.name}</strong><br>
                        <span class="cc-marker-token">${m.token}</span>
                      </td>
                      <td class="cc-marker-count">${m.count}</td>
                      <td>${m.placement}</td>
                      <td>${(m.interactions || []).map(i => `<span class="cc-marker-action">${i}</span>`).join(' ')}</td>
                    </tr>
                    ${m.notes ? `<tr class="cc-marker-note-row"><td colspan="4"><em><i class="fa fa-info-circle"></i> ${m.notes}</em></td></tr>` : ''}
                  `).join('')}
                </tbody>
              </table>
            </div>
          ` : ''}

          <!-- MONSTER PRESSURE -->
          ${s.monster_pressure?.enabled ? `
            <div class="cc-scenario-section">
              <h4><i class="fa fa-paw"></i> Monster Pressure</h4>
              <p><strong>Trigger:</strong> ${s.monster_pressure.trigger}</p>
              ${s.monster_pressure.seed_based ? '<p class="cc-help-text"><em>Location-specific monsters selected.</em></p>' : ''}
              <ul>
                ${s.monster_pressure.monsters.map(m => `<li>${m.name} (${m.type || 'Monster'}) &mdash; ${m.cost} &#8356;</li>`).join('')}
              </ul>
              ${s.monster_pressure.notes ? `<p><em>${s.monster_pressure.notes}</em></p>` : ''}
            </div>
          ` : ''}

          <!-- TWIST -->
          ${s.twist ? `
            <div class="cc-scenario-section cc-twist">
              <h4><i class="fa fa-random"></i> Scenario Twist</h4>
              <p><strong>${s.twist.name}</strong></p>
              <p>${s.twist.description}</p>
              ${s.twist.example ? `<p><em>Example: ${s.twist.example}</em></p>` : ''}
            </div>
          ` : ''}

          <!-- VICTORY CONDITIONS -->
          <div class="cc-scenario-section">
            <h4><i class="fa fa-trophy"></i> Victory Conditions</h4>
            ${Object.entries(s.victory_conditions).map(([factionId, vc]) => `
              <div class="cc-victory-card">
                <div class="cc-vc-header">
                  <h5>${vc.faction_name}${vc.is_npc ? ' <span class="cc-npc-tag">NPC</span>' : ''}</h5>
                </div>
                <div class="cc-vc-objectives">
                  ${(vc.objectives || []).map((obj, i) => `
                    <div class="cc-vc-obj">
                      <div class="cc-vc-obj-label">Objective ${i + 1}</div>
                      <div class="cc-vc-obj-name"><i class="fa fa-crosshairs"></i> ${obj.name}</div>
                      <p class="cc-vc-obj-desc">${obj.desc}</p>
                      <div class="cc-vc-obj-meta">
                        <span class="cc-vp-line"><i class="fa fa-star"></i> ${obj.vp}</span>
                        <span class="cc-tactic-line"><i class="fa fa-book"></i> ${obj.tactic}</span>
                      </div>
                    </div>
                  `).join('')}
                </div>
                <hr class="cc-vc-divider" />
                <div class="cc-vc-finale">
                  <div class="cc-vc-obj-label">Finale</div>
                  <div class="cc-vc-obj-name"><i class="fa fa-bolt"></i> ${vc.finale.name}</div>
                  <p>${vc.finale.desc}</p>
                  <p class="cc-vp-line"><i class="fa fa-star"></i> ${vc.finale.vp}</p>
                </div>
                <hr class="cc-vc-divider" />
                <div class="cc-vc-aftermath">
                  <div class="cc-vc-obj-label">If ${vc.faction_name} Wins</div>
                  <p><i class="fa fa-chevron-right"></i> ${vc.aftermath.immediate}</p>
                  <p><i class="fa fa-university"></i> Territory becomes <strong>${vc.aftermath.canyon_state}</strong>.</p>
                  <p><i class="fa fa-calendar"></i> ${vc.aftermath.long_term}</p>
                  ${vc.quote ? `<p class="cc-quote">"${vc.quote}"</p>` : ''}
                </div>
              </div>
            `).join('')}
          </div>

          <!-- AFTERMATH -->
          ${s.aftermath ? `
            <div class="cc-scenario-section">
              <h4><i class="fa fa-scroll"></i> Aftermath</h4>
              <p>${s.aftermath}</p>
            </div>
          ` : ''}

          ${s.vault_source ? `
            <div class="cc-scenario-section">
              <p class="cc-help-text"><em><i class="fa fa-book"></i> Based on vault scenario: "${s.vault_source}" (${s.vault_match_score} tag matches)</em></p>
            </div>
          ` : ''}

          <div class="cc-form-actions">
            <button class="cc-btn cc-btn-ghost"     onclick="resetScenario()"><i class="fa fa-refresh"></i> Start Over</button>
            <button class="cc-btn cc-btn-secondary" onclick="rollAgain()"><i class="fa fa-random"></i> The Canyon Shifts</button>
            <button class="cc-btn cc-btn-primary"   onclick="printScenario()"><i class="fa fa-print"></i> Print</button>
            <button class="cc-btn cc-btn-primary"   onclick="saveScenario()"><i class="fa fa-cloud"></i> Save to Cloud</button>
          </div>

        </div>
      `;
    }

    // ================================
    // RENDER: SUMMARY SIDEBAR PANEL
    // ================================
    function renderSummaryPanel() {
      const steps = [
        { num: 1, title: 'Game Setup', complete: state.completedSteps.includes(1) },
        { num: 2, title: 'Factions',   complete: state.completedSteps.includes(2) },
        { num: 3, title: 'Location',   complete: state.completedSteps.includes(3) },
        { num: 4, title: 'Generate',   complete: state.generated }
      ];

      return `
        <div class="cc-summary-header"><h3>Scenario Progress</h3></div>
        <div class="cc-summary-steps">
          ${steps.map(step => `
            <div class="cc-summary-step ${step.complete ? 'complete' : ''} ${state.currentStep === step.num ? 'active' : ''}"
                 onclick="openStep(${step.num})">
              <div class="cc-summary-step-number">${step.num}</div>
              <div class="cc-summary-step-title">${step.title}</div>
              ${step.complete ? '<div class="cc-summary-step-check"><i class="fa fa-check"></i></div>' : ''}
            </div>
          `).join('')}
        </div>

        ${state.completedSteps.length > 0 ? `
          <div class="cc-summary-details">
            <h4>Current Setup</h4>
            ${state.gameMode    ? `<p><strong>Mode:</strong> ${state.gameMode === 'solo' ? 'Solo' : 'Multiplayer'}</p>` : ''}
            ${state.pointValue  ? `<p><strong>Points:</strong> ${state.pointValue} &#8356;</p>` : ''}
            ${state.dangerRating ? `<p><strong>Danger:</strong> ${'&#9733;'.repeat(state.dangerRating)}${'&#9734;'.repeat(6 - state.dangerRating)}</p>` : ''}
            ${state.factions.length ? `<p><strong>Factions:</strong> ${state.factions.map(f => f.name).join(', ')}</p>` : ''}
            ${state.selectedLocation || state.locationType === 'random_any'
              ? `<p><strong>Location:</strong> ${state.locationType === 'named' ? '&#10003; Named' : 'Random'}</p>`
              : ''}
          </div>
        ` : ''}

        ${state.generated ? `
          <div class="cc-summary-details" style="border-top: 2px solid var(--cc-primary); margin-top: 1rem; padding-top: 1rem;">
            <h4>Quick Actions</h4>
            <button class="cc-btn cc-btn-ghost" style="width: 100%; margin-bottom: 0.5rem;"
                    onclick="loadFromCloud()"><i class="fa fa-folder-open"></i> Load Saved Scenario</button>
          </div>
        ` : ''}
      `;
    }

    // ================================
    // RENDER: MAIN
    // ================================
    function render() {
      if (state.generated && state.scenario) {
        const html = `
          <div class="cc-app-header">
            <div>
              <h1 class="cc-app-title">Coffin Canyon</h1>
              <div class="cc-app-subtitle">Scenario Builder</div>
            </div>
          </div>
          <div class="cc-scenario-full-layout">
            ${renderScenarioOutput()}
          </div>
        `;
        root.innerHTML = `<div class="cc-app-shell h-100">${html}</div>`;

        // Boot the location map embed after the DOM is updated
        // (requestAnimationFrame lets the browser paint the placeholder first)
        requestAnimationFrame(() => {
          initLocationMapEmbed(state.scenario.location);
        });
        return;
      }

      const html = `
        <div class="cc-app-header">
          <div>
            <h1 class="cc-app-title">Coffin Canyon</h1>
            <div class="cc-app-subtitle">Scenario Builder</div>
          </div>
        </div>

        <div class="cc-scenario-builder-layout">
          <aside class="cc-scenario-sidebar">
            <div class="cc-panel h-100">
              <div class="cc-panel-head">
                <div class="cc-panel-title">Build Scenario</div>
              </div>
              <div class="cc-body cc-accordion">
                ${renderAccordionStep(1, 'Game Setup',        '<i class="fa fa-cog"></i>',    renderStep1_GameSetup(), state.currentStep === 1, state.completedSteps.includes(1))}
                ${renderAccordionStep(2, 'Factions & Forces', '<i class="fa fa-users"></i>',  renderStep2_Factions(),  state.currentStep === 2, state.completedSteps.includes(2))}
                ${renderAccordionStep(3, 'Location',          '<i class="fa fa-map"></i>',    renderStep3_Location(),  state.currentStep === 3, state.completedSteps.includes(3))}
                ${renderAccordionStep(4, 'Generate Scenario', '<i class="fa fa-dice"></i>',   renderStep4_Generate(),  state.currentStep === 4, state.generated)}
              </div>
            </div>
          </aside>

          <main class="cc-scenario-main">
            <div class="cc-panel h-100">
              <div class="cc-panel-head">
                <div class="cc-panel-title">Summary</div>
              </div>
              <div class="cc-body">
                ${renderSummaryPanel()}
              </div>
            </div>
          </main>
        </div>
      `;
      root.innerHTML = `<div class="cc-app-shell h-100">${html}</div>`;
    }

    // ================================
    // EVENT HANDLERS
    // ================================
    window.setGameMode = function(mode) {
      state.gameMode = mode;
      state.factions = [];
      render();
    };

    window.setPointValue = function(value) {
      state.pointValue = parseInt(value);
    };

    window.setDangerRating = function(value) {
      state.dangerRating = parseInt(value);
      render();
    };

    window.setGameWarden = function(value) {
      state.gameWarden = (value === 'none') ? null : value;
    };

    window.setPlayerFaction = function(factionId) {
      state.factions = state.factions.filter(f => f.isNPC);
      if (factionId) {
        const faction = FACTIONS.find(f => f.id === factionId);
        if (faction) state.factions.unshift({ id: faction.id, name: faction.name, player: '', isNPC: false });
      }
      render();
    };

    window.toggleNPCFaction = function(id, name, checked) {
      if (checked) {
        if (!state.factions.some(f => f.id === id && f.isNPC)) {
          state.factions.push({ id, name, player: 'NPC', isNPC: true });
        }
      } else {
        state.factions = state.factions.filter(f => !(f.id === id && f.isNPC));
      }
      render();
    };

    window.toggleFaction = function(id, name, checked) {
      if (checked) {
        if (!state.factions.some(f => f.id === id)) {
          state.factions.push({ id, name, player: '', isNPC: false });
        }
      } else {
        state.factions = state.factions.filter(f => f.id !== id);
      }
      render();
    };

    window.toggleFactionNPC = function(id, isNPC) {
      const f = state.factions.find(f => f.id === id);
      if (f) { f.isNPC = isNPC; f.player = isNPC ? 'NPC' : ''; }
      render();
    };

    window.setFactionPlayer = function(factionId, playerName) {
      const f = state.factions.find(f => f.id === factionId);
      if (f) f.player = playerName;
    };

    window.setLocationType = function(type) {
      state.locationType     = type;
      state.selectedLocation = null;
      render();
    };

    window.setSelectedLocation = function(id) {
      state.selectedLocation = id || null;
    };

    window.openStep     = function(n) { state.currentStep = n; render(); };
    window.goToStep     = function(n) { state.currentStep = n; render(); };
    window.completeStep = function(n) {
      if (!state.completedSteps.includes(n)) state.completedSteps.push(n);
      state.currentStep = n + 1;
      render();
    };

    window.resetScenario = function() {
      state.generated        = false;
      state.scenario         = null;
      state.currentStep      = 1;
      state.completedSteps   = [];
      state.factions         = [];
      state.locationType     = null;
      state.selectedLocation = null;
      render();
    };

    window.rollAgain = function() {
      if (state.factions.length >= 2) {
        window.generateScenario();
      } else {
        alert('Please complete setup first (Steps 1–3).');
      }
    };

    window.printScenario = function() { window.print(); };

    // ================================
    // SAVE / LOAD
    // ================================
    window.saveScenario = async function() {
      if (!state.scenario) return;
      if (!window.CC_STORAGE) {
        alert('Storage not ready. Please wait a moment and try again.');
        return;
      }
      try {
        const key  = 'SCN_' + Date.now();
        const data = JSON.stringify({
          savedAt:  new Date().toISOString(),
          scenario: state.scenario,
          setup: {
            gameMode:         state.gameMode,
            pointValue:       state.pointValue,
            dangerRating:     state.dangerRating,
            factions:         state.factions,
            locationType:     state.locationType,
            selectedLocation: state.selectedLocation
          }
        });
        await window.CC_STORAGE.set(key, data);
        alert(`✅ Scenario saved as: ${key}`);
      } catch (err) {
        console.error('Save failed:', err);
        alert('Save failed. Check console for details.');
      }
    };

    window.loadFromCloud = async function() {
      if (!window.CC_STORAGE) {
        alert('Storage not ready. Please wait a moment and try again.');
        return;
      }
      try {
        const keys = await window.CC_STORAGE.list('SCN_');
        if (!keys?.keys?.length) {
          alert('No saved scenarios found.');
          return;
        }
        const keyList = keys.keys.join('\n');
        const chosen  = prompt(`Choose a save to load:\n\n${keyList}`);
        if (!chosen) return;

        const raw = await window.CC_STORAGE.get(chosen);
        if (!raw?.value) { alert('Save not found.'); return; }

        const saved            = JSON.parse(raw.value);
        state.scenario         = saved.scenario;
        state.gameMode         = saved.setup?.gameMode         || state.gameMode;
        state.pointValue       = saved.setup?.pointValue       || state.pointValue;
        state.dangerRating     = saved.setup?.dangerRating     || state.dangerRating;
        state.factions         = saved.setup?.factions         || state.factions;
        state.locationType     = saved.setup?.locationType     || state.locationType;
        state.selectedLocation = saved.setup?.selectedLocation || state.selectedLocation;
        state.generated        = true;
        state.completedSteps   = [1, 2, 3];
        state.currentStep      = 4;
        render();
      } catch (err) {
        console.error('Load failed:', err);
        alert('Load failed. Check console for details.');
      }
    };

    // ================================
    // BOOT
    // ================================
    root.innerHTML = `
      <div class="cc-app-shell h-100">
        <div class="cc-app-header">
          <div>
            <h1 class="cc-app-title">Coffin Canyon</h1>
            <div class="cc-app-subtitle">Scenario Builder</div>
          </div>
        </div>
        <div class="cc-loading-container">
          <img
            src="https://raw.githubusercontent.com/steamcrow/coffin/main/rules/apps/canyon_map/data/coffin_canyon_logo.png"
            alt="Coffin Canyon"
            style="width:320px;max-width:80vw;margin-bottom:2rem;filter:drop-shadow(0 0 28px rgba(255,117,24,.45));"
          />
          <div class="cc-loading-bar">
            <div class="cc-loading-progress"></div>
          </div>
          <div class="cc-loading-text">Loading scenario data&hellip;</div>
        </div>
      </div>
    `;

    loadGameData().then(() => {
      console.log('✅ Game data ready — rendering app');
      render();
    });

  } // end init()
}; // end window.CC_APP      { id: 'monster_rangers', name: 'Monster Rangers', file: 'faction-monster-rangers-v5.json' },
      { id: 'liberty_corps',   name: 'Liberty Corps',   file: 'faction-liberty-corps-v2.json'  },
      { id: 'monsterology',    name: 'Monsterology',    file: 'faction-monsterology-v2.json'   },
      { id: 'monsters',        name: 'Monsters',        file: 'faction-monsters-v2.json'       },
      { id: 'shine_riders',    name: 'Shine Riders',    file: 'faction-shine-riders-v2.json'   },
      { id: 'crow_queen',      name: 'Crow Queen',      file: 'faction-crow-queen.json'        }
    ];

    // ================================
    // DATA LOADING
    // ================================
    let plotFamiliesData   = null;
    let twistTablesData    = null;
    let locationData       = null;
    let locationTypesData  = null;
    let monsterFactionData = null;
    let scenarioVaultData  = null;
    let scenarioNamesData  = null;
    let factionDataMap     = {};

    async function loadGameData() {
      try {
        const base = 'https://raw.githubusercontent.com/steamcrow/coffin/main';
        const t    = '?t=' + Date.now();

        const [plotRes, twistRes, locRes, locTypesRes, monstersRes, vaultRes, namesRes] = await Promise.all([
          fetch(`${base}/rules/src/200_plot_families.json${t}`),
          fetch(`${base}/rules/src/210_twist_tables.json${t}`),
          fetch(`${base}/rules/src/170_named_locations.json${t}`),
          fetch(`${base}/rules/src/150_location_types.json${t}`),
          fetch(`${base}/factions/faction-monsters-v2.json${t}`),
          fetch(`${base}/rules/src/180_scenario_vault.json${t}`),
          fetch(`${base}/rules/src/230_scenario_names.json${t}`)
        ]);

        plotFamiliesData   = await plotRes.json();
        twistTablesData    = await twistRes.json();
        locationData       = await locRes.json();
        locationTypesData  = await locTypesRes.json();
        monsterFactionData = await monstersRes.json();
        scenarioVaultData  = await vaultRes.json();
        scenarioNamesData  = await namesRes.json();

        const PLAYER_FACTIONS = [
          { id: 'monster_rangers', file: 'faction-monster-rangers-v5.json' },
          { id: 'liberty_corps',   file: 'faction-liberty-corps-v2.json'  },
          { id: 'monsterology',    file: 'faction-monsterology-v2.json'   },
          { id: 'shine_riders',    file: 'faction-shine-riders-v2.json'   },
          { id: 'crow_queen',      file: 'faction-crow-queen.json'        }
        ];
        factionDataMap = {};
        await Promise.all(PLAYER_FACTIONS.map(async ({ id, file }) => {
          try {
            const res = await fetch(`${base}/factions/${file}${t}`);
            factionDataMap[id] = await res.json();
            console.log(`✅ Faction loaded: ${id}`);
          } catch (e) {
            console.warn(`⚠️ Could not load faction: ${id}`, e);
            factionDataMap[id] = null;
          }
        }));

        console.log('✅ All game data loaded');
      } catch (err) {
        console.error('❌ Failed to load game data:', err);
        alert('Failed to load scenario data. Please refresh the page.');
      }
    }

    // ================================
    // MAP EMBED — URLs + STATE
    // ================================
    const MAP_APP_URL     = 'https://raw.githubusercontent.com/steamcrow/coffin/main/rules/apps/canyon_map/cc_canyon_map_app.js';
    const MAP_DATA_URL    = 'https://raw.githubusercontent.com/steamcrow/coffin/main/rules/apps/canyon_map/data/canyon_map.json';
    const LEAFLET_CSS_URL = 'https://raw.githubusercontent.com/steamcrow/coffin/main/rules/vendor/leaflet/leaflet.css';
    const LEAFLET_JS_URL  = 'https://raw.githubusercontent.com/steamcrow/coffin/main/rules/vendor/leaflet/leaflet.js';

    let _mapData      = null;   // cached canyon_map.json
    let _leafletReady = false;  // have we loaded Leaflet yet?
    let _scenarioMap  = null;   // active Leaflet instance in the embed (so we can destroy it on re-render)

    // Load a remote JS file as a blob script (same pattern as the map app)
    function loadScriptDynamic(url) {
      return fetch(url + '?t=' + Date.now())
        .then(r => r.text())
        .then(code => new Promise((resolve, reject) => {
          const blob = new Blob([code], { type: 'text/javascript' });
          const src  = URL.createObjectURL(blob);
          const s    = document.createElement('script');
          s.src      = src;
          s.onload   = () => { URL.revokeObjectURL(src); resolve(); };
          s.onerror  = () => { URL.revokeObjectURL(src); reject(new Error('Script load failed: ' + url)); };
          document.head.appendChild(s);
        }));
    }

    // Load a remote CSS file as an inline <style> (same pattern as map app)
    function loadStyleDynamic(url, id) {
      if (document.getElementById(id)) return Promise.resolve();
      return fetch(url + '?t=' + Date.now())
        .then(r => r.text())
        .then(css => {
          const s = document.createElement('style');
          s.id    = id;
          s.textContent = css;
          document.head.appendChild(s);
        });
    }

    // Ensure Leaflet CSS + JS are available (idempotent)
    async function ensureLeaflet() {
      if (_leafletReady && window.L) return;
      await loadStyleDynamic(LEAFLET_CSS_URL, 'cc-leaflet-css');
      if (!window.L) await loadScriptDynamic(LEAFLET_JS_URL);
      _leafletReady = true;
    }

    // Ensure window.CC_HITBOXES is available by loading the map app (idempotent)
    async function ensureHitboxes() {
      if (window.CC_HITBOXES) return window.CC_HITBOXES;
      try {
        await loadScriptDynamic(MAP_APP_URL);
      } catch (e) {
        console.warn('⚠️ Could not load map app for hitboxes:', e);
      }
      return window.CC_HITBOXES || {};
    }

    // Fetch and cache canyon_map.json
    async function fetchMapData() {
      if (_mapData) return _mapData;
      const res = await fetch(MAP_DATA_URL + '?t=' + Date.now());
      _mapData = await res.json();
      return _mapData;
    }

    // ================================
    // UTILITIES
    // ================================
    function randomChoice(arr) {
      if (!arr || arr.length === 0) return null;
      return arr[Math.floor(Math.random() * arr.length)];
    }

    function randomInt(min, max) {
      return Math.floor(Math.random() * (max - min + 1)) + min;
    }

    function getDangerDescription(rating) {
      const map = {
        1: 'Skirmish — light danger',
        2: 'Tense — expect resistance',
        3: 'Hostile — expect casualties',
        4: 'Dangerous — expect losses',
        5: 'Deadly — expect to mourn',
        6: 'Lethal — survival unlikely'
      };
      return map[rating] || 'Unknown danger level';
    }

    // ================================
    // FIX 3: CARGO VEHICLE NAME HELPER
    // Returns "Cargo Tiger Truck" for Monster Rangers, otherwise "Cargo Vehicle"
    // ================================
    function getCargoVehicleName() {
      const hasRangers = state.factions.some(f => f.id === 'monster_rangers');
      return hasRangers ? 'Cargo Tiger Truck' : 'Cargo Vehicle';
    }

    // ================================
    // LOCATION PROFILE BUILDER
    // ================================
    function buildLocationProfile(locationType, selectedLocationId) {
      let location = null;

      if (locationType === 'named' && selectedLocationId && locationData) {
        location = locationData.locations.find(l => l.id === selectedLocationId);
      }

      if (!location && locationData?.locations?.length) {
        location = randomChoice(locationData.locations);
      }

      if (!location) {
        return {
          id:               'unknown',
          name:             'Unknown Territory',
          emoji:            '❓',
          archetype:        'frontier',
          state:            'poisoned',
          features:         [],
          effectiveDanger:  state.dangerRating,
          effectiveResources: {},
          monster_seeds:    [],
          tags:             [],
          notes:            [],
          description:      '',
          atmosphere:       ''
        };
      }

      let typeDefaults = {};
      if (locationTypesData?.location_types && location.type_ref) {
        typeDefaults = locationTypesData.location_types.find(t => t.id === location.type_ref) || {};
      }

      const effectiveResources = Object.assign({}, typeDefaults.base_resources || {}, location.resources || {});
      const effectiveDanger    = location.danger ?? state.dangerRating;

      return {
        id:               location.id,
        name:             location.name,
        emoji:            location.emoji || '📍',
        archetype:        location.archetype || 'unknown',
        state:            location.state || 'alive',
        features:         location.features || [],
        effectiveDanger,
        effectiveResources,
        monster_seeds:    location.monster_seeds || [],
        tags:             location.tags || [],
        notes:            location.notes || [],
        description:      location.description || '',
        atmosphere:       location.atmosphere || '',
        terrain_flavor:   location.terrain_flavor || [],
        rumors:           location.rumors || []
      };
    }

    // ================================
    // VAULT SCENARIO MATCHING
    // ================================
    function matchVaultScenario(plotFamily, locProfile, contextTags) {
      if (!scenarioVaultData?.scenarios?.length) return { scenario: null, score: 0 };

      const allTags = [
        ...(plotFamily.tags || []),
        ...(locProfile.tags || []),
        ...contextTags,
        locProfile.archetype
      ].filter(Boolean).map(t => t.toLowerCase());

      let best      = null;
      let bestScore = 0;

      for (const s of scenarioVaultData.scenarios) {
        const sTags = (s.tags || []).map(t => t.toLowerCase());
        const score = sTags.filter(t => allTags.includes(t)).length;
        if (score > bestScore) {
          best      = s;
          bestScore = score;
        }
      }

      return { scenario: bestScore >= 2 ? best : null, score: bestScore };
    }

    // ================================
    // RESOURCE DISPLAY HELPER
    // ================================
    function buildResourceSummary(resources) {
      if (!resources) return '';
      const LABELS = {
        food_good:    '🍖 Food',
        water_clean:  '💧 Water',
        medicine:     '💉 Medicine',
        supplies:     '📦 Supplies',
        thyr:         '💎 Thyr',
        silver:       '🥈 Silver',
        weapons:      '🔫 Weapons',
        moonshine:    '🥃 Moonshine',
        spare_parts:  '⚙️ Parts',
        rotgut:       '🍶 Rotgut',
        food_foul:    '☠️ Foul Food',
        water_foul:   '🤢 Foul Water'
      };
      const VITAL = ['food_good', 'water_clean', 'medicine', 'supplies'];
      const highs  = [];
      const absent = [];

      for (const [k, v] of Object.entries(resources)) {
        if (typeof v !== 'number') continue;
        if (v >= 2 && LABELS[k]) highs.push(`<span class="cc-resource-high">${LABELS[k]}: ${v}</span>`);
        if (v === 0 && VITAL.includes(k)) absent.push(`<span class="cc-resource-absent">${LABELS[k]} ✗</span>`);
      }

      if (highs.length === 0 && absent.length === 0) return '';
      return `<p>${highs.concat(absent).join(' ')}</p>`;
    }

    // ================================
    // FIX 2: NARRATIVE HOOK GENERATOR
    // Now accepts objectives array so it can name specific things
    // (e.g. "Cargo Tiger Truck" instead of "a fragile or vital asset")
    // ================================
    function generateNarrativeHook(plotFamily, location, objectives) {
      const locName  = location.name;
      const atmo     = location.atmosphere || '';
      const desc     = location.description ? location.description.split('.')[0] : '';

      // Build a specific plot description based on actual objectives
      // instead of falling back to the generic plotFamily.description
      let plotDesc = (plotFamily.description || '').replace(/\.$/, '');

      // --- Replace generic asset language with the real objective name ---
      const cargoObj = objectives?.find(o => o.type === 'cargo_vehicle');
      if (cargoObj) {
        const cargoName = cargoObj.name; // "Cargo Tiger Truck" or "Cargo Vehicle"
        // Replace any version of "a fragile or vital asset" / "an asset" / "the asset"
        plotDesc = plotDesc.replace(
          /a fragile or vital asset|an asset|the asset|a fragile asset|a vital asset/gi,
          `the ${cargoName}`
        );
      }

      const thyrObj     = objectives?.find(o => o.type === 'thyr_cache' || o.type === 'ritual_site');
      const supplyObj   = objectives?.find(o => o.type === 'stored_supplies' || o.type === 'scattered_crates');
      const ritualObj   = objectives?.find(o => o.type === 'ritual_components' || o.type === 'ritual_circle');

      // Build a specific situation summary from the actual objectives
      let situationLine = '';
      if (cargoObj) {
        situationLine = `The ${cargoObj.name} needs to cross ${locName} intact — that's already the hard part.`;
      } else if (thyrObj) {
        situationLine = `The Thyr at ${locName} is active. That means someone already knows about it.`;
      } else if (ritualObj) {
        situationLine = `${locName} is the only place the ritual can be completed. Everyone is racing to get there.`;
      } else if (supplyObj) {
        situationLine = `The caches at ${locName} are the kind of find that changes who survives the season.`;
      }

      // Pick from a pool of strongly-voiced hooks
      const pools = [
        // Arrival hooks
        `Nobody who left ${locName} told the same story. ${plotDesc}. The only way to know is to go in.`,
        `Three factions picked up the same rumour about ${locName} within 48 hours. That's not coincidence. ${plotDesc}.`,
        `${locName} was supposed to be a clean job. The Canyon had other ideas. ${plotDesc}.`,
        `${desc ? desc + '. ' : ''}${plotDesc}. The factions arrive at the same time. That's the problem.`,
        // Tension hooks
        `The window at ${locName} is closing. ${plotDesc}. Whoever moves first may be the only one who leaves with anything.`,
        `Something at ${locName} drew too much attention. ${plotDesc}. Now everyone is reacting and nobody is thinking.`,
        `${plotDesc} at ${locName}. The smart money said don't get involved. The smart money wasn't enough.`,
        `The last group through ${locName} didn't come back whole. ${plotDesc}. That didn't stop the next group.`,
        // Canyon voice hooks
        `The Canyon doesn't warn you. At ${locName}, it just changes the terms. ${plotDesc}.`,
        `${locName}. ${atmo ? '"' + atmo + '"' : 'Whatever it was, it isn\'t that anymore.'}. ${plotDesc}.`,
        `${plotDesc}. ${locName} is where it ends — or where it gets worse.`,
        `Word reached ${locName} before anyone expected. ${plotDesc}. By the time boots hit the ground, it was already complicated.`,
      ];

      // If we have a specific situation line, prepend it to a pool pick
      if (situationLine) {
        return situationLine + ' ' + randomChoice(pools.slice(6)); // use a canyon-voice hook as the second sentence
      }

      // Try plot-family specific hook first
      if (plotFamily?.hook)   return plotFamily.hook;
      if (plotFamily?.flavor) return `${plotFamily.flavor} ${plotDesc} at ${locName}.`;

      return randomChoice(pools);
    }

    // ================================
    // FIX 1: SCENARIO NAME GENERATOR
    // Fixed double-location bug: location.name no longer appears in
    // both the prefix slot AND the middle slot.
    // New format: "[Adjective] [Location] — [Noun]"
    // ================================
    function generateScenarioNameFromTags(plotFamily, location, objectives, twist, dangerRating, contextTags) {
      contextTags = contextTags || [];
      location    = location || { name: 'Unknown' };

      if (scenarioNamesData) {
        const prefixes = scenarioNamesData.prefixes || [];
        const suffixes = scenarioNamesData.suffixes || [];

        // Tag-aware prefix selection
        const taggedPrefixes = prefixes.filter(p =>
          Array.isArray(p.tags) && p.tags.some(t => contextTags.includes(t))
        );

        const prefix = taggedPrefixes.length
          ? (randomChoice(taggedPrefixes)?.text || randomChoice(prefixes)?.text || 'Bloody')
          : (randomChoice(prefixes)?.text || 'Bloody');

        const suffix = randomChoice(suffixes)?.text || 'Reckoning';

        // FIX: location.name appears exactly ONCE — in the center slot only.
        // Do NOT use the "middle" field from names data (it contains location names
        // which caused "Camp Coffin — Camp Coffin Huck" duplication).
        return `${prefix} ${location.name} — ${suffix}`;
      }

      // Fallback without JSON data
      const fallbackPrefixes = ['Bloody', 'Burning', 'Broken', 'Cursed', 'Forsaken', 'Iron'];
      const fallbackSuffixes = ['Reckoning', 'Standoff', 'Collapse', 'Ruin', 'Harvest', 'Judgment'];
      return `${randomChoice(fallbackPrefixes)} ${location.name} — ${randomChoice(fallbackSuffixes)}`;
    }

    // ================================
    // MONSTER PRESSURE GENERATOR
    // ================================
    function generateMonsterPressure(plotFamily, dangerRating, locProfile) {
      const enabled = Math.random() > 0.3;
      if (!enabled || !monsterFactionData) return { enabled: false };

      const budgetPercent    = 0.2 + (dangerRating / 6) * 0.2;
      const monsterBudget    = Math.floor(state.pointValue * budgetPercent);
      const selectedMonsters = [];
      let remainingBudget    = monsterBudget;
      let seedBased          = false;

      if (locProfile?.monster_seeds?.length > 0) {
        let attempts = 0;
        while (remainingBudget > 100 && attempts < 10) {
          const seed = randomChoice(locProfile.monster_seeds);
          const unit = monsterFactionData.units?.find(u => u.name === seed.name);
          if (!unit || unit.cost > remainingBudget) { attempts++; continue; }
          selectedMonsters.push(unit);
          remainingBudget -= unit.cost;
          seedBased = true;
          attempts++;
        }
      }

      if (selectedMonsters.length === 0 && monsterFactionData.units) {
        const available = monsterFactionData.units.filter(u => u.cost <= monsterBudget);
        let budget = monsterBudget;
        while (budget > 0 && available.length > 0) {
          const valid   = available.filter(m => m.cost <= budget);
          if (valid.length === 0) break;
          const monster = randomChoice(valid);
          selectedMonsters.push(monster);
          budget -= monster.cost;
        }
      }

      const escalationNote = plotFamily.escalation_bias
        ? `Escalation: ${randomChoice(plotFamily.escalation_bias).replace(/_/g, ' ')}`
        : null;

      return {
        enabled:    true,
        trigger:    `Round ${randomInt(2, 4)}`,
        monsters:   selectedMonsters,
        seed_based: seedBased,
        notes:      escalationNote
      };
    }

    // ================================
    // AFTERMATH GENERATOR
    // ================================
    function generateAftermath(plotFamily) {
      const options = plotFamily.aftermath_bias || ['location_state_change', 'resource_depletion_or_corruption'];
      const type    = randomChoice(options);
      const descriptions = {
        location_state_change:            'This location will be permanently altered by the outcome.',
        resource_depletion_or_corruption: 'Resources here will be depleted or corrupted.',
        new_landmark_created:             'A new landmark will mark what happened here.',
        faction_ownership:                'The victor will claim lasting control.',
        mystical_claim:                   'Mystical forces will remember this event.',
        monster_bias_shift:               'Monster behaviour in this region will change.'
      };
      return descriptions[type] || 'The Canyon will remember what happened here.';
    }

    // ================================
    // OBJECTIVE GENERATION ENGINE
    // ================================

    const RESOURCE_OBJECTIVE_AFFINITY = {
      supplies:         ['stored_supplies', 'scattered_crates'],
      food_good:        ['stored_supplies', 'scattered_crates'],
      food_foul:        ['fouled_resource', 'tainted_ground'],
      water_clean:      ['stored_supplies'],
      water_foul:       ['fouled_resource', 'tainted_ground'],
      thyr:             ['thyr_cache', 'ritual_site', 'ritual_circle'],
      tzul_silver:      ['artifact', 'ritual_site', 'sacrificial_focus'],
      silver:           ['land_marker', 'command_structure'],
      lead:             ['land_marker', 'wrecked_engine'],
      mechanical_parts: ['wrecked_engine', 'unstable_structure'],
      spare_parts:      ['wrecked_engine', 'unstable_structure'],
      livestock:        ['pack_animals', 'cargo_vehicle'],
      medicine:         ['stored_supplies', 'scattered_crates'],
      weapons:          ['fortified_position', 'command_structure', 'barricades'],
      moonshine:        ['scattered_crates', 'cargo_vehicle'],
      rotgut:           ['fouled_resource', 'scattered_crates'],
      gildren:          ['land_marker', 'command_structure']
    };

    const ALL_OBJECTIVE_TYPES = [
      'wrecked_engine', 'scattered_crates', 'derailed_cars',
      'cargo_vehicle', 'pack_animals', 'ritual_components',
      'ritual_site', 'land_marker', 'command_structure',
      'thyr_cache', 'artifact', 'captive_entity',
      'fortified_position', 'barricades', 'stored_supplies',
      'ritual_circle', 'tainted_ground', 'sacrificial_focus',
      'collapsing_route', 'fouled_resource', 'unstable_structure',
      'evacuation_point'
    ];

    // FIX 3: makeObjectiveName uses getCargoVehicleName() for the cargo_vehicle type
    function makeObjectiveName(type, locProfile) {
      const r        = locProfile?.effectiveResources || {};
      const features = locProfile?.features || [];

      // FIX 3: Cargo vehicle respects faction context
      if (type === 'cargo_vehicle') {
        return getCargoVehicleName();
      }

      if (type === 'fouled_resource') {
        if ((r.water_foul || 0) >= 1 && (r.rotgut || 0) >= 1)
          return 'Fouled Water & Rotgut Cache';
        if ((r.water_foul || 0) >= 1)
          return 'Tainted Water Supply';
        if ((r.rotgut || 0) >= 1)
          return 'Spoiled Rotgut Barrels';
        if ((r.food_foul || 0) >= 1)
          return 'Contaminated Ration Store';
        return 'Fouled Resource Cache';
      }

      if (type === 'unstable_structure') {
        if (features.includes('GlassShards') || features.includes('KnifeRocks'))
          return 'Glass-Wall Overhang';
        if (features.includes('RailGrade')   || features.includes('BrakeScars'))
          return 'Failing Rail Section';
        if (features.includes('RockfallChutes'))
          return 'Rockfall Chute';
        if (features.includes('NarrowPass'))
          return 'Crumbling Canyon Shelf';
        const arch = locProfile?.archetype || '';
        if (arch === 'arroyo')     return 'Eroded Canyon Wall';
        if (arch === 'rail_grade') return 'Failing Trestle';
        if (arch === 'boomtown')   return 'Condemned Boomtown Building';
        return 'Unstable Structure';
      }

      const names = {
        wrecked_engine:     'Wrecked Engine',
        scattered_crates:   'Scattered Supply Crates',
        derailed_cars:      'Derailed Cars',
        pack_animals:       'Pack Animals',
        ritual_components:  'Ritual Components',
        ritual_site:        'Ritual Site',
        land_marker:        'Land Marker',
        command_structure:  'Command Structure',
        thyr_cache:         'Thyr Crystal Cache',
        artifact:           'Ancient Artifact',
        captive_entity:     'Captive Entity',
        fortified_position: 'Fortified Position',
        barricades:         'Barricades',
        stored_supplies:    'Stored Supplies',
        ritual_circle:      'Ritual Circle',
        tainted_ground:     'Tainted Ground',
        sacrificial_focus:  'Sacrificial Focus',
        collapsing_route:   'Collapsing Route',
        evacuation_point:   'Evacuation Point'
      };
      return names[type] || 'Contested Objective';
    }

    function makeObjectiveDescription(type, locProfile) {
      const r = locProfile?.effectiveResources || {};
      const cargoName = getCargoVehicleName(); // FIX 3

      const descriptions = {
        wrecked_engine:     'Salvage mechanical parts or prevent others from claiming them. Each salvage increases Coffin Cough risk.',
        scattered_crates:   'Collect and extract scattered food, water, and supplies before others claim them.',
        derailed_cars:      "Search the wreckage for valuable cargo before it's lost or claimed.",
        // FIX 3: use the real vehicle name in the description
        cargo_vehicle:      `Escort the ${cargoName} safely across the board. The sweet scent may attract monsters.`,
        pack_animals:       'Control or escort the animals. They may panic under fire.',
        ritual_components:  'Gather mystical components scattered across the battlefield.',
        ritual_site:        'Control this location to complete rituals or disrupt enemy mysticism.',
        land_marker:        'Hold this symbolic location to establish territorial claim.',
        command_structure:  'Control this position to coordinate forces and establish leadership.',
        thyr_cache:         'Extract or corrupt the glowing Thyr crystals. Handling Thyr is always dangerous.',
        artifact:           'Recover the ancient artifact. Its true nature may be hidden.',
        captive_entity:     'Free, capture, or control the entity. May not be what it appears.',
        fortified_position: 'Hold this defensible position against all comers.',
        barricades:         'Control the chokepoint to restrict enemy movement.',
        stored_supplies:    'Secure stockpiled resources before they are depleted.',
        ritual_circle:      'Control the circle to empower rituals or prevent enemy mysticism.',
        tainted_ground:     'Interact at your own risk. Corruption spreads.',
        sacrificial_focus:  'Control or destroy this dark altar.',
        collapsing_route:   'The passage is deteriorating. Hold it open or let it collapse to trap the enemy.',
        fouled_resource:    'Contaminated supplies that are worse than nothing — unless you know what to do with them.',
        unstable_structure: 'The building will not survive the battle. Get what you need from it before it comes down.',
        evacuation_point:   'Reach this location to escape the escalating danger.'
      };

      let base = descriptions[type] || 'Control this objective to score victory points.';

      if (locProfile) {
        if (type === 'stored_supplies'  && (r.supplies   || 0) >= 4)
          base = `These caches hold enough to shift the balance — food, medicine, kit. ${base}`;
        if (type === 'scattered_crates' && (r.food_good  || 0) >= 3)
          base = `The crates are scattered but what's inside is worth the risk. ${base}`;
        if (type === 'thyr_cache'       && (r.thyr       || 0) >= 4)
          base = `The crystals are warm to the touch and getting warmer. ${base}`;
        if (type === 'fouled_resource'  && (r.water_foul || 0) >= 2)
          base = `The water here is wrong. Something got in. ${base}`;
        if (type === 'fouled_resource'  && (r.rotgut     || 0) >= 2)
          base = `The barrels are marked safe but the smell says otherwise. ${base}`;
      }
      return base;
    }

    // FIX 4: makeObjectiveSpecial names the actual monster when available
    function makeObjectiveSpecial(type, locProfile) {
      // For "guarded" specials, try to name a real monster from seeds or faction data
      if (Math.random() < 0.4) {
        const seeds = locProfile?.monster_seeds || [];
        if (seeds.length > 0) {
          const seed = randomChoice(seeds);
          return `Guarded — ${seed.name} nearby`;
        }
        // Fall back to a generic monster from the faction data
        if (monsterFactionData?.units?.length) {
          const genericMonster = randomChoice(monsterFactionData.units);
          if (genericMonster) return `Guarded — ${genericMonster.name} nearby`;
        }
      }

      const specials = [
        'Unstable — may collapse if damaged',
        'Tainted — triggers morale tests',
        'Valuable — worth extra VP',
        'Corrupted — alters nearby terrain',
        'Hot — every faction already knows about it'
      ];
      return randomChoice(specials);
    }

    function calcObjectiveVP(type, locProfile) {
      const r = locProfile?.effectiveResources || {};
      const table = {
        stored_supplies:    Math.max(2, Math.ceil((r.supplies    || 2) / 2)),
        scattered_crates:   Math.max(2, Math.ceil(((r.food_good || 1) + (r.supplies || 1)) / 3)),
        thyr_cache:         Math.max(3, r.thyr    || 3),
        ritual_site:        Math.max(3, Math.ceil((r.thyr || 2) * 0.8)),
        ritual_circle:      Math.max(3, Math.ceil((r.thyr || 2) * 0.8)),
        land_marker:        Math.max(2, Math.ceil((r.silver || 2) / 2)),
        wrecked_engine:     Math.max(2, Math.ceil((r.spare_parts || 2) / 2)),
        pack_animals:       Math.max(2, Math.ceil((r.livestock || 2) / 2)),
        artifact:           4,
        sacrificial_focus:  4,
        captive_entity:     4,
        ritual_components:  3,
        fortified_position: 3,
        command_structure:  3,
        cargo_vehicle:      3,
        collapsing_route:   3,
        fouled_resource:    2,
        tainted_ground:     3,
        barricades:         2,
        unstable_structure: 2,
        evacuation_point:   3,
        derailed_cars:      2
      };
      return table[type] || 2;
    }

    function generateObjectives(plotFamily, locProfile) {
      const scores = {};
      ALL_OBJECTIVE_TYPES.forEach(t => scores[t] = 0);

      (plotFamily.default_objectives || []).forEach(t => {
        if (scores[t] !== undefined) scores[t] += 3;
      });

      if (locProfile?.effectiveResources) {
        const r = locProfile.effectiveResources;
        for (const [key, val] of Object.entries(r)) {
          if (typeof val === 'number' && val >= 2) {
            (RESOURCE_OBJECTIVE_AFFINITY[key] || []).forEach(t => {
              if (scores[t] !== undefined) scores[t] += val;
            });
          }
        }

        if ((r.water_clean || 0) < 1 && (r.water_foul || 0) < 1 && (r.rotgut || 0) < 1 && (r.food_foul || 0) < 1)
          scores['fouled_resource'] = Math.max(0, scores['fouled_resource'] - 4);
        if ((r.thyr || 0) < 2) {
          scores['thyr_cache']    = Math.max(0, scores['thyr_cache']    - 4);
          scores['ritual_circle'] = Math.max(0, scores['ritual_circle'] - 2);
        }
        if ((r.spare_parts || 0) < 2)
          scores['wrecked_engine'] = Math.max(0, scores['wrecked_engine'] - 3);
        if ((r.livestock || 0) < 2)
          scores['pack_animals'] = 0;
        if ((r.tzul_silver || 0) < 3)
          scores['sacrificial_focus'] = Math.max(0, scores['sacrificial_focus'] - 2);
      }

      const sorted = Object.entries(scores)
        .filter(([, s]) => s > 0)
        .sort((a, b) => b[1] - a[1]);

      console.log('🎯 Objective scores (top 6):', sorted.slice(0, 6).map(([t, s]) => `${t}:${s}`).join(', '));

      const numObjectives = randomInt(2, 3);
      const objectives    = [];
      const used          = new Set();

      const EXCLUSIVE_GROUPS = {
        taint_group:   ['tainted_ground', 'fouled_resource'],
        ritual_group:  ['ritual_site', 'ritual_circle', 'sacrificial_focus', 'ritual_components'],
        salvage_group: ['wrecked_engine', 'derailed_cars', 'unstable_structure'],
        supply_group:  ['stored_supplies', 'scattered_crates']
      };
      const usedGroups = new Set();

      function getGroup(type) {
        for (const [grp, types] of Object.entries(EXCLUSIVE_GROUPS)) {
          if (types.includes(type)) return grp;
        }
        return null;
      }

      for (const [type] of sorted) {
        if (objectives.length >= numObjectives) break;
        if (used.has(type)) continue;
        const grp = getGroup(type);
        if (grp && usedGroups.has(grp)) continue;
        used.add(type);
        if (grp) usedGroups.add(grp);
        objectives.push({
          name:        makeObjectiveName(type, locProfile),
          description: makeObjectiveDescription(type, locProfile),
          type,
          vp_base:     calcObjectiveVP(type, locProfile),
          special:     Math.random() < 0.2 ? makeObjectiveSpecial(type, locProfile) : null  // FIX 4: pass locProfile
        });
      }

      if (objectives.length === 0) {
        objectives.push({
          name:        'Contested Ground',
          description: 'Hold this position.',
          type:        'land_marker',
          vp_base:     3,
          special:     null
        });
      }

      return objectives;
    }

    function generateObjectivesFromVault(vaultScenario, locProfile) {
      const objectives = [];
      if (vaultScenario.objectives && Array.isArray(vaultScenario.objectives)) {
        vaultScenario.objectives.forEach(vo => {
          const type = vo.id || vo.type;
          objectives.push({
            name:        makeObjectiveName(type, locProfile),
            description: vo.notes ? vo.notes[0] : makeObjectiveDescription(type, locProfile),
            type,
            vp_base:     3,
            special:     vo.special ? vo.special.join(', ') : null
          });
        });
      }
      if (objectives.length < 2) {
        objectives.push({
          name:        'Contested Objective',
          description: 'Control this location to score victory points.',
          type:        'land_marker',
          vp_base:     2,
          special:     null
        });
      }
      return objectives;
    }

    // ================================
    // OBJECTIVE MARKERS TABLE
    // ================================
    const OBJECTIVE_MARKER_TABLE = {
      wrecked_engine:     { count: '1',    placement: 'Center board',              token: 'Wreck token or large model',    interactions: ['SALVAGE', 'CONTROL', 'SABOTAGE'] },
      scattered_crates:   { count: 'd3+2', placement: 'Scattered across board',    token: 'Crate tokens',                  interactions: ['COLLECT', 'EXTRACT'] },
      stored_supplies:    { count: 'd3+1', placement: 'Within 6″ of center',       token: 'Supply crate tokens',           interactions: ['CLAIM', 'EXTRACT'] },
      derailed_cars:      { count: 'd3+1', placement: 'Scattered near wreck',      token: 'Rail car tokens',               interactions: ['SEARCH', 'EXTRACT'] },
      // FIX 3: cargo_vehicle uses the faction-aware name at render time
      cargo_vehicle:      { count: '1',    placement: 'One table edge, center',    token: 'Vehicle model',                 interactions: ['BOARD', 'ESCORT', 'DISABLE'] },
      pack_animals:       { count: 'd3',   placement: 'Center board',              token: 'Animal tokens',                 interactions: ['CONTROL', 'ESCORT'] },
      ritual_components:  { count: 'd3+1', placement: 'Scattered across board',    token: 'Component tokens',              interactions: ['GATHER', 'CORRUPT'] },
      ritual_site:        { count: '1',    placement: 'Center board',              token: 'Ritual marker (3″ radius)',     interactions: ['ACTIVATE', 'DISRUPT', 'CORRUPT'] },
      ritual_circle:      { count: '1',    placement: 'Center board',              token: 'Circle marker (3″ radius)',     interactions: ['ACTIVATE', 'DISRUPT', 'CONTROL'] },
      land_marker:        { count: '3',    placement: 'Spread across board',       token: 'Territory markers',             interactions: ['CLAIM', 'CONTROL'] },
      command_structure:  { count: '1',    placement: 'Strategic position',        token: 'Command post marker',           interactions: ['CONTROL', 'HOLD', 'DESTROY'] },
      thyr_cache:         { count: '1',    placement: 'Center board',              token: 'Glowing crystal token',         interactions: ['EXTRACT', 'CORRUPT', 'DESTROY'] },
      artifact:           { count: '1',    placement: 'Center board',              token: 'Artifact token',                interactions: ['RECOVER', 'EXAMINE', 'DESTROY'] },
      captive_entity:     { count: '1',    placement: 'Random mid-board',          token: 'Entity marker or model',        interactions: ['FREE', 'CAPTURE', 'CONTROL'] },
      fortified_position: { count: '1',    placement: 'Defensible terrain',        token: 'Fortification marker',          interactions: ['HOLD', 'ASSAULT', 'REINFORCE'] },
      barricades:         { count: '1',    placement: 'Chokepoint / lane center',  token: 'Barricade tokens',              interactions: ['HOLD', 'DESTROY', 'BYPASS'] },
      tainted_ground:     { count: '1',    placement: 'Dangerous central area',    token: 'Taint marker (6″ radius)',      interactions: ['CLEANSE', 'CORRUPT', 'AVOID'] },
      sacrificial_focus:  { count: '1',    placement: 'Center board',              token: 'Altar token',                   interactions: ['CONTROL', 'DESTROY', 'ACTIVATE'] },
      unstable_structure: { count: '1',    placement: 'Random mid-board',          token: 'Structure marker',              interactions: ['SALVAGE', 'CONTROL', 'COLLAPSE'] },
      collapsing_route:   { count: '1',    placement: 'Divides board in half',     token: 'Route markers at each end',     interactions: ['CROSS', 'BLOCK', 'REINFORCE'] },
      evacuation_point:   { count: '1',    placement: 'Far table edge, center',    token: 'Exit marker',                   interactions: ['REACH', 'ESCAPE'] },
      fouled_resource:    { count: '2',    placement: 'Scatter near center',       token: 'Contaminated supply tokens',    interactions: ['CONTROL', 'PURGE', 'WEAPONIZE'] }
    };

    function generateObjectiveMarkers(objectives, vaultScenario) {
      const markers = [];
      objectives.forEach(obj => {
        let vaultObj = null;
        if (vaultScenario?.objectives) {
          vaultObj = vaultScenario.objectives.find(vo => vo.id === obj.type || vo.type === obj.type);
        }
        const defaults = OBJECTIVE_MARKER_TABLE[obj.type] || {
          count:        '1',
          placement:    'Board center',
          token:        'Objective token',
          interactions: []
        };
        markers.push({
          name:         obj.name,  // Already has correct name (e.g. "Cargo Tiger Truck")
          type:         obj.type,
          count:        vaultObj?.count       || defaults.count,
          placement:    defaults.placement,
          token:        defaults.token,
          interactions: vaultObj?.interactions?.length ? vaultObj.interactions : defaults.interactions,
          notes:        vaultObj?.notes ? vaultObj.notes[0] : null
        });
      });
      return markers;
    }

    // ================================
    // VICTORY CONDITIONS ENGINE
    // ================================

    const FACTION_APPROACH = {
      monster_rangers: {
        verbs:    ['Secure', 'Protect', 'Stabilize', 'Guard', 'Preserve'],
        vp_style: 'per_round',
        bonus:    'Bonus VP if no casualties.',
        tactic:   'Defensive positioning. +1 die when protecting objectives.',
        quote:    'Not all protectors carry badges.'
      },
      monsterology: {
        verbs:    ['Extract', 'Harvest', 'Acquire', 'Catalogue', 'Weaponize'],
        vp_style: 'per_extraction',
        bonus:    'Can convert extracted resources to VP.',
        tactic:   'Surgical extraction. Ignore collateral damage.',
        quote:    'Progress has a price, paid in full by the land.'
      },
      liberty_corps: {
        verbs:    ['Seize', 'Lock Down', 'Control', 'Claim', 'Arrest'],
        vp_style: 'area_control',
        bonus:    'Bonus VP for arrests over kills.',
        tactic:   'Hold the line. +1 die from controlled positions.',
        quote:    'Order will be maintained.'
      },
      shine_riders: {
        verbs:    ['Hit', 'Grab', 'Flip', 'Salt', 'Extract'],
        vp_style: 'hit_and_run',
        bonus:    'Bonus VP if Shine Boss exits with resources.',
        tactic:   'Speed over combat. Extract early, stay mobile.',
        quote:    'Everything has a price. We just set it.'
      },
      crow_queen: {
        verbs:    ['Claim', 'Convert', 'Subjugate', 'Consecrate', 'Crown'],
        vp_style: 'per_round',
        bonus:    'Bonus VP for each monster converted to a Subject.',
        tactic:   'Dominance through will. Obelisk presence amplifies control.',
        quote:    'Everything in the canyon kneels. Eventually.'
      },
      monsters: {
        verbs:    ['Claim', 'Guard', 'Hold', 'Escape', 'Feed'],
        vp_style: 'survival',
        bonus:    'Bonus VP per model alive at end.',
        tactic:   'Territorial. Protect the ground or flee to exits.',
        quote:    'The canyon was here first.'
      }
    };

    const FACTION_OBJECTIVE_FLAVOR = {
      monster_rangers: {
        monsters_befriendable: "There's a creature out there that doesn't want to fight. Reach it before the others do — use your Pocket Snacks. Walk it off the board alive.",
        monsters_hostile:      "The monster is cornered or terrified. Don't put it down — get between it and the factions that will. Escort it to an exit.",
        stored_supplies:       "These caches belong to the canyon's people. Every crate we hold is someone who doesn't go hungry.",
        scattered_crates:      "Gather what's left. Supplies belong to survivors, not scavengers.",
        fouled_resource:       "Contaminated doesn't mean worthless. We can purify it. Others will weaponize it.",
        unstable_structure:    "Get what's salvageable out before it comes down. Then let it fall.",
        collapsing_route:      "We need this route. Hold it open long enough to get what matters through.",
        thyr_cache:            "Don't extract the Thyr — monitor it. Mark the cluster and get out.",
        land_marker:           "This territory needs to be witnessed and recorded. Not conquered.",
        command_structure:     "Control the structure. Use it to call in support, not to fortify.",
        cargo_vehicle:         "Get the Cargo Tiger Truck through. Whatever's in it matters — that's the job."
      },
      monsterology: {
        monsters_befriendable: "Unclassified specimen. Mobile, possibly sapient, definitely valuable. Capture it intact — no kill shots until a live capture is confirmed impossible.",
        monsters_hostile:      "Threat-class specimen. If live capture is impossible, harvest what you can on the way out. The Institute pays by weight.",
        stored_supplies:       "Survey the caches. Record contents. Extract anything with research value.",
        scattered_crates:      "Scattered materials mean a field opportunity. Collect everything, sort later.",
        fouled_resource:       "Contaminated supplies are a sample set. The Institute wants the contaminant, not the supplies.",
        unstable_structure:    "Structural analysis while it's still standing. Extract data before it collapses.",
        collapsing_route:      "Geological event in real-time. Document it. Extract before it seals.",
        thyr_cache:            "Active Thyr cluster. Extract maximum yield. Radiation protocols in effect.",
        land_marker:           "Survey marker. Record coordinates and resource density. File the claim.",
        command_structure:     "This installation has records. Extract them.",
        cargo_vehicle:         "The vehicle is the specimen. Analyse its contents. Extract samples."
      },
      liberty_corps: {
        monsters_befriendable: "Unlicensed biological entity. Subdue and contain for formal classification.",
        monsters_hostile:      "Active threat to personnel. Engage and neutralize. File the report afterward.",
        stored_supplies:       "Unsecured federal property. Lock it down. Anyone else touching it is a thief.",
        scattered_crates:      "Contraband until proven otherwise. Collect and tag for inspection.",
        fouled_resource:       "Biohazard. Cordon the area. Decontamination is Corps jurisdiction.",
        unstable_structure:    "Condemned. Hold the perimeter. Nobody goes in without clearance.",
        collapsing_route:      "Critical infrastructure. Hold or reroute. The Corps controls movement here.",
        thyr_cache:            "Unregulated Thyr extraction is a federal crime. Secure the site.",
        land_marker:           "Territory is Corps jurisdiction. Plant the flag. Hold it.",
        command_structure:     "Command post. Secure it first. Everything else flows from here.",
        cargo_vehicle:         "Intercept the vehicle. Inspect its cargo. Impound if necessary."
      },
      shine_riders: {
        monsters_befriendable: "Chaos costs nothing. If the creature goes left, we go right. Use it.",
        monsters_hostile:      "Distraction. While it's eating whoever's dumbest, we hit the real target.",
        stored_supplies:       "Full caches. Best haul in the canyon if we move before anyone else notices.",
        scattered_crates:      "Grab what you can carry. Leave the rest for the fire.",
        fouled_resource:       "Contaminated supplies that are worse than nothing — unless you know what to do with them.",
        unstable_structure:    "Quick grab before it comes down. We've done worse.",
        collapsing_route:      "The chaos at the route is our window. Hit the real objective while they watch it fall.",
        thyr_cache:            "Hot cargo but the buyer doesn't ask questions. Extract fast.",
        land_marker:           "Nobody owns this canyon. But if we plant the marker, we collect the fee.",
        command_structure:     "Hit the command post. Take what's valuable. Make it look like someone else.",
        cargo_vehicle:         "Whatever that truck is carrying is worth more than the truck. Get it and go."
      },
      crow_queen: {
        monsters_befriendable: "These creatures are subjects who have not yet pledged. Convert them. Gently if possible.",
        monsters_hostile:      "They resist the Crown's call. Break them or convert them. There is no third option.",
        stored_supplies:       "The canyon's resources flow to the Crown. Claim the cache. Consecrate it.",
        scattered_crates:      "Scattered tribute. Gather it in the Crown's name.",
        fouled_resource:       "What others call contamination, the Crown calls potential. Claim and convert it.",
        unstable_structure:    "The canyon reshapes itself for her. Claim what's within before it transforms.",
        collapsing_route:      "Patience is dominance. Hold the route long enough to demonstrate who commands this ground.",
        thyr_cache:            "The crystals already answer to the Crown. Claim them formally.",
        land_marker:           "The canyon was always hers. This marker is a reminder.",
        command_structure:     "There is one command in this canyon. Replace whatever was here with an Obelisk.",
        cargo_vehicle:         "The vehicle carries something useful. Crown it. Then drive it where you need it."
      }
    };

    function generateVictoryConditions(plotFamily, objectives, locProfile) {
      const conditions = {};

      const hasMonsterPressure = objectives.some(o => o.type === 'captive_entity');
      const injectMonsterObjective = hasMonsterPressure ||
        state.factions.some(f => f.id === 'monsters');

      state.factions.forEach(faction => {
        const approach  = FACTION_APPROACH[faction.id] || FACTION_APPROACH.monsters;
        const flavorMap = FACTION_OBJECTIVE_FLAVOR[faction.id] || {};

        const candidatePool = [];

        if (injectMonsterObjective && faction.id !== 'monsters') {
          const isFriendly  = faction.id === 'monster_rangers' || faction.id === 'crow_queen';
          const flavorKey   = isFriendly ? 'monsters_befriendable' : 'monsters_hostile';
          const monsterDesc = flavorMap[flavorKey] || "Deal with the monsters on the board.";
          const monsterVP   = {
            monster_rangers: '+3 VP per monster safely escorted off board. +5 VP if befriended and fighting alongside you.',
            monsterology:    '+4 VP per monster harvested and extracted off board. +2 VP per live capture.',
            liberty_corps:   '+3 VP per monster captured. +2 VP per monster eliminated.',
            shine_riders:    '+3 VP if you redirect a monster into an enemy faction this game. +1 VP per round you avoid monster contact.',
            crow_queen:      '+4 VP per monster converted to a Crown Subject. +2 VP per round a converted monster fights for you.'
          };
          candidatePool.push({
            name:   'Monsters on the Board',
            desc:   monsterDesc,
            vp:     monsterVP[faction.id] || '+2 VP per monster interaction.',
            tactic: approach.tactic
          });
        }

        objectives.forEach(obj => {
          // FIX 3: use the actual objective name (already "Cargo Tiger Truck") as the flavorMap key
          // Try the type key first, then fall back to the generic verb approach
          const flavorKey = obj.type;
          const desc      = flavorMap[flavorKey]
            || `${randomChoice(approach.verbs)} the ${obj.name}.`;
          const vp        = `+${obj.vp_base} VP base`;

          candidatePool.push({
            name:   `${randomChoice(approach.verbs)} — ${obj.name}`,
            desc,
            vp,
            tactic: approach.tactic
          });
        });

        const shuffled         = candidatePool.sort(() => Math.random() - 0.5);
        const pickedObjectives = shuffled.slice(0, 2);

        const finale   = buildFactionFinale(faction.id, objectives, state.dangerRating, locProfile);
        const aftermath = buildFactionAftermath(faction.id, plotFamily);
        const isNPC    = faction.id === 'monsters' || faction.id === 'crow_queen';

        conditions[faction.id] = {
          faction_name: faction.name,
          is_npc:       isNPC,
          objectives:   pickedObjectives,
          finale,
          aftermath,
          quote:        approach.quote
        };
      });

      return conditions;
    }

    function buildFactionFinale(factionId, objectives, dangerRating, locProfile) {
      const danger = dangerRating || 3;

      const finales = {
        monster_rangers: {
          name: 'The Canyon Holds',
          desc: 'Preserve what matters. Leave the canyon better than you found it.',
          vp:   `${danger * 2} VP if no permanent terrain is destroyed by your faction`
        },
        liberty_corps: {
          name: 'Full Occupation',
          desc: 'Hold all contested objectives simultaneously for one full round.',
          vp:   `${danger * 3} VP if you hold all objectives at round end`
        },
        monsterology: {
          name: 'Total Extraction Protocol',
          desc: 'Extract from every objective on the board. Leave nothing.',
          vp:   `${danger * 3} VP if all objectives extracted`
        },
        shine_riders: {
          name: 'The Getaway',
          desc: 'Extract the highest-value objective and get your Boss off the board.',
          vp:   `${danger * 3} VP if Boss exits with extracted resource before Round 4`
        },
        crow_queen: {
          name: 'Canyon Remembers',
          desc: 'Patience is dominance. Hold. Hold. Hold.',
          vp:   `15 VP if Crown holds center objective for 3+ rounds`
        },
        monsters: {
          name: 'Herd Intact',
          desc: 'Survive. That is the win condition.',
          vp:   `15 VP if 3+ monster units alive at game end`
        }
      };

      return finales[factionId] || {
        name: 'Last Stand',
        desc: 'Hold the line.',
        vp:   `${danger * 2} VP`
      };
    }

    function buildFactionAftermath(factionId, plotFamily) {
      const immediates = {
        monster_rangers: [
          'The Rangers restore balance.',
          'The canyon breathes again.',
          'What was taken is returned.'
        ],
        monsterology: [
          'Specimen crates loaded.',
          'The survey is complete.',
          'Progress continues. The site is stripped bare.'
        ],
        liberty_corps: [
          'The area is secured.',
          'Jurisdiction established.',
          'Federal flags rise. The law holds.'
        ],
        shine_riders: [
          'The Riders are gone before anyone organises a pursuit.',
          'The haul is counted. Nobody left empty-handed.',
          'Some resources are missing. No one is sure who took them.'
        ],
        crow_queen: [
          "The Crown's marks appear on every surface. The canyon feels different here.",
          'New subjects kneel. The canyon shifts in her favour.',
          'The Obelisk pulses once and goes dark. Something lingers.'
        ],
        monsters: [
          'The canyon reclaims it.',
          'The predators scatter — and regroup elsewhere.',
          'Silence returns. A hungry kind.'
        ]
      };

      const longTerms = {
        monster_rangers: [
          'Monster populations stabilize. The Wild remains wild.',
          'Something was preserved today. The canyon remembers.',
          'The canyon is not safe. But it is kept.'
        ],
        monsterology: [
          'Progress has a price, paid in full by the land.',
          'The specimens will be studied.',
          'Nothing grows here because everything useful is gone.'
        ],
        liberty_corps: [
          'Liberated land is clean. And very quiet.',
          'Trade routes secured, but tension rises.',
          'Order will be maintained. The Corps will return.'
        ],
        shine_riders: [
          'Word spreads that the Shine Riders hit this location. Defenders get nervous everywhere.',
          'Crime and opportunity intertwine.',
          "They'll be back when the heat dies down."
        ],
        crow_queen: [
          "The Regent's influence expands. The canyon shifts in her favour.",
          'Old stone remembers old names.',
          'The subjects multiply.'
        ],
        monsters: [
          'They were here before the people came.',
          'Monsters use this area as a feeding ground and nesting site.',
          'The canyon is older than all of them.'
        ]
      };

      const canyonStates = {
        monster_rangers: 'Held',
        monsterology:    'Extracted',
        liberty_corps:   'Liberated',
        shine_riders:    'Lawless',
        crow_queen:      'Exalted',
        monsters:        'Strangewild'
      };

      return {
        immediate:    randomChoice(immediates[factionId]  || immediates.monsters),
        canyon_state: canyonStates[factionId] || 'Contested',
        long_term:    randomChoice(longTerms[factionId]   || longTerms.monsters)
      };
    }

    // ================================
    // MAIN SCENARIO GENERATION
    // ================================
    window.generateScenario = function() {
      console.log('🎲 Generating scenario...', state);

      if (!plotFamiliesData || !twistTablesData || !monsterFactionData) {
        alert('Game data not loaded yet. Please wait a moment and try again.');
        return;
      }

      const dangerRating = state.dangerRating || 3;
      const contextTags  = [];

      const locProfile = buildLocationProfile(state.locationType, state.selectedLocation);
      console.log('📍 Location profile:', locProfile);

      const families   = plotFamiliesData.plot_families || [];
      const plotFamily = randomChoice(families);
      console.log('📖 Plot family:', plotFamily.name);

      const { scenario: vaultScenario, score: maxMatchScore } = matchVaultScenario(plotFamily, locProfile, contextTags);
      if (vaultScenario) console.log(`📚 Vault match: ${vaultScenario.name} (${maxMatchScore} tags)`);

      // Generate objectives BEFORE generating the name or narrative hook
      // so the hook and name can reference specific objective names
      const objectives = vaultScenario
        ? generateObjectivesFromVault(vaultScenario, locProfile)
        : generateObjectives(plotFamily, locProfile);

      const monsterPressure = generateMonsterPressure(plotFamily, dangerRating, locProfile);

      let twist = null;
      if (Math.random() < 0.3) {
        const eligible = (twistTablesData.twists || []).filter(t =>
          t.danger_floor <= dangerRating && t.danger_ceiling >= dangerRating
        );
        if (eligible.length > 0) {
          const td = randomChoice(eligible);
          twist = {
            name:        td.name,
            description: td.description,
            example:     randomChoice(td.example_outcomes || [])
          };
        }
      }

      const objectiveMarkers  = generateObjectiveMarkers(objectives, vaultScenario);
      const victoryConditions = generateVictoryConditions(plotFamily, objectives, locProfile);
      const aftermath         = generateAftermath(plotFamily);

      const nameContextTags = [...contextTags];
      if (vaultScenario?.tags) {
        vaultScenario.tags.forEach(t => { if (!nameContextTags.includes(t)) nameContextTags.push(t); });
      }

      // FIX 1: scenario name no longer repeats location.name
      const scenarioName = generateScenarioNameFromTags(plotFamily, locProfile, objectives, twist, dangerRating, nameContextTags);

      // FIX 2: narrative hook now knows about objectives so it can name specific things
      const narrative_hook = vaultScenario?.narrative_hook
        ? vaultScenario.narrative_hook
        : generateNarrativeHook(plotFamily, locProfile, objectives);

      state.scenario = {
        name:               scenarioName,
        narrative_hook,
        location:           locProfile,
        danger_rating:      dangerRating,
        danger_description: getDangerDescription(dangerRating),
        plot_family:        plotFamily.name,
        objectives,
        monster_pressure:   monsterPressure,
        twist,
        victory_conditions: victoryConditions,
        aftermath,
        factions:           state.factions,
        pointValue:         state.pointValue,
        gameMode:           state.gameMode,
        loc_profile:        locProfile,
        objective_markers:  objectiveMarkers,
        vault_source:       vaultScenario ? vaultScenario.name : null,
        vault_match_score:  vaultScenario ? maxMatchScore : 0
      };

      state.generated = true;
      render();
    };

    // ================================
    // LOCATION MAP EMBED
    // Two-panel layout:
    //   LEFT  — static tiny overview of the whole canyon.
    //           An orange highlight box shows where the location is.
    //           Never moves, never loads Leaflet.
    //   RIGHT — zoomed Leaflet map centered on the location.
    //           Gold star + name label. Read-only.
    // ================================

    const TINY_MAP_URL = 'https://raw.githubusercontent.com/steamcrow/coffin/main/rules/apps/canyon_map/data/map_coffin_canyon_tiny.jpg';

    // Returns the two-panel placeholder HTML.
    // Leaflet fills in the right panel; the overview box is positioned in initLocationMapEmbed.
    function renderLocationMapEmbed() {
      return `
        <div id="cc-scenario-map-wrap"
             style="display:flex;gap:6px;height:260px;
                    margin:0.5rem 0 0.75rem 0;
                    border-radius:8px;overflow:hidden;
                    border:1px solid rgba(255,117,24,0.3);">

          <!-- LEFT: static overview -->
          <div id="cc-scenario-map-overview"
               style="flex:0 0 32%;position:relative;overflow:hidden;background:#0a0a0a;">
            <img id="cc-scenario-map-tiny"
                 src="${TINY_MAP_URL}"
                 alt="Canyon overview"
                 style="width:100%;height:100%;object-fit:cover;object-position:top left;
                        display:block;opacity:0.85;">
            <!-- highlight box injected here by initLocationMapEmbed -->
            <div id="cc-scenario-map-highlight"
                 style="display:none;position:absolute;
                        border:2px solid #ff7518;
                        background:rgba(255,117,24,0.25);
                        box-shadow:0 0 0 1px rgba(0,0,0,0.6),
                                   0 0 12px rgba(255,117,24,0.5);
                        pointer-events:none;"></div>
            <!-- "YOU ARE HERE" label -->
            <div id="cc-scenario-map-here"
                 style="display:none;position:absolute;bottom:6px;left:0;right:0;
                        text-align:center;
                        font-size:0.55rem;letter-spacing:0.12em;text-transform:uppercase;
                        color:rgba(255,255,255,0.5);">Canyon overview</div>
          </div>

          <!-- RIGHT: zoomed Leaflet map -->
          <div id="cc-scenario-map-embed"
               style="flex:1;position:relative;background:#111;">
            <div style="position:absolute;inset:0;display:flex;align-items:center;
                        justify-content:center;color:rgba(255,255,255,0.25);
                        font-size:0.8rem;letter-spacing:0.1em;text-transform:uppercase;">
              Loading map&hellip;
            </div>
          </div>

        </div>`;
    }

    // Called after render() sets innerHTML.
    // 1. Positions the highlight box on the static overview.
    // 2. Boots Leaflet into the right panel.
    async function initLocationMapEmbed(locProfile) {
      const leafletContainer  = document.getElementById('cc-scenario-map-embed');
      const highlightEl       = document.getElementById('cc-scenario-map-highlight');
      const hereEl            = document.getElementById('cc-scenario-map-here');
      const tinyImg           = document.getElementById('cc-scenario-map-tiny');
      if (!leafletContainer) return;

      // Destroy any previous Leaflet instance
      if (_scenarioMap) {
        try { _scenarioMap.remove(); } catch (e) {}
        _scenarioMap = null;
      }

      try {
        // Load everything in parallel
        const [hitboxes, mapData] = await Promise.all([
          ensureHitboxes(),
          fetchMapData(),
          ensureLeaflet()
        ]);

        const px    = mapData.map.background.image_pixel_size;  // full map pixel dimensions
        const bbox  = hitboxes[locProfile.id];

        // ── LEFT PANEL: position the highlight box as % of full map dims ──
        // Since the tiny image uses object-fit:cover / object-position:top left,
        // percentage coordinates map directly onto the full map's coordinate space.
        if (bbox && highlightEl && hereEl) {
          const left   = (bbox[1] / px.w) * 100;
          const top    = (bbox[0] / px.h) * 100;
          const width  = ((bbox[3] - bbox[1]) / px.w) * 100;
          const height = ((bbox[2] - bbox[0]) / px.h) * 100;

          // Minimum visible size so tiny locations still show a box
          const minW = Math.max(width,  1.5);
          const minH = Math.max(height, 1.0);

          highlightEl.style.left    = left + '%';
          highlightEl.style.top     = top  + '%';
          highlightEl.style.width   = minW + '%';
          highlightEl.style.height  = minH + '%';
          highlightEl.style.display = 'block';
          hereEl.style.display      = 'block';
        }

        // ── RIGHT PANEL: Leaflet zoomed map ──
        const bounds    = [[0, 0], [px.h, px.w]];
        let centerLat   = px.h / 2;
        let centerLng   = px.w / 2;
        if (bbox) {
          centerLat = (bbox[0] + bbox[2]) / 2;
          centerLng = (bbox[1] + bbox[3]) / 2;
        }

        // Clear the "Loading map…" placeholder
        leafletContainer.innerHTML = '';

        const L = window.L;
        _scenarioMap = L.map(leafletContainer, {
          crs:                L.CRS.Simple,
          minZoom:            -4,
          maxZoom:            0,
          zoomControl:        false,
          attributionControl: false,
          dragging:           false,
          scrollWheelZoom:    false,
          doubleClickZoom:    false,
          touchZoom:          false,
          keyboard:           false
        });

        // Base map image
        L.imageOverlay(mapData.map.background.image_key, bounds).addTo(_scenarioMap);

        if (bbox) {
          // Soft orange highlight matching the overview box
          L.rectangle(
            [[bbox[0], bbox[1]], [bbox[2], bbox[3]]],
            {
              color:       'rgba(255,117,24,0.9)',
              fillColor:   'rgba(255,117,24,0.18)',
              fillOpacity: 1,
              weight:      2,
              interactive: false
            }
          ).addTo(_scenarioMap);

          // Gold star at centre
          L.marker([centerLat, centerLng], {
            icon: L.divIcon({
              className: '',
              html: `<i class="fa fa-star"
                        style="color:#ffd700;font-size:1.5rem;
                               text-shadow:0 0 10px rgba(0,0,0,0.9),0 0 4px #000;
                               display:block;line-height:1;"></i>`,
              iconSize:   [20, 20],
              iconAnchor: [10, 10]
            }),
            interactive: false
          }).addTo(_scenarioMap);

          // Name label just below the star
          L.marker([centerLat, centerLng], {
            icon: L.divIcon({
              className: '',
              html: `<div style="color:#fff;font-weight:800;white-space:nowrap;
                                 font-size:0.72rem;letter-spacing:0.03em;
                                 text-shadow:0 1px 4px #000,0 0 8px #000;
                                 padding-top:4px;">
                       ${locProfile.emoji || '📍'} ${locProfile.name}
                     </div>`,
              iconSize:   [0, 0],
              iconAnchor: [-4, -12]
            }),
            interactive: false
          }).addTo(_scenarioMap);
        }

        // Zoom level -2 shows good surrounding context without black edges
        _scenarioMap.setView([centerLat, centerLng], -2);

        requestAnimationFrame(() => {
          try { _scenarioMap.invalidateSize({ animate: false }); } catch (e) {}
        });

      } catch (err) {
        console.warn('⚠️ Location map embed failed:', err);
        if (leafletContainer) {
          leafletContainer.innerHTML = `<div style="padding:1rem;color:rgba(255,255,255,0.25);
                                                    font-size:0.8rem;text-align:center;">
                                          Map unavailable
                                        </div>`;
        }
      }
    }

    // ================================
    // RENDER: ACCORDION STEP WRAPPER
    // ================================
    function renderAccordionStep(stepNum, title, icon, content, isActive, isComplete) {
      return `
        <div class="cc-accordion-item ${isActive ? 'active' : ''} ${isComplete ? 'complete' : ''}">
          <div class="cc-accordion-header" onclick="openStep(${stepNum})">
            <div class="cc-step-icon">${icon}</div>
            <div class="cc-step-title">${title}</div>
            <div class="cc-step-status">${isComplete ? '<i class="fa fa-check"></i>' : ''}</div>
          </div>
          <div class="cc-accordion-body" style="display: ${isActive ? 'block' : 'none'}">
            ${content}
          </div>
        </div>
      `;
    }

    // ================================
    // RENDER: STEP 1 — GAME SETUP
    // ================================
    function renderStep1_GameSetup() {
      return `
        <div class="cc-form-section">
          <label class="cc-label">Game Mode</label>
          <div class="cc-button-group">
            <button class="cc-btn ${state.gameMode === 'solo' ? 'cc-btn-primary' : 'cc-btn-ghost'}"
                    onclick="setGameMode('solo')">Solo Play</button>
            <button class="cc-btn ${state.gameMode === 'multiplayer' ? 'cc-btn-primary' : 'cc-btn-ghost'}"
                    onclick="setGameMode('multiplayer')">Multiplayer</button>
          </div>
        </div>

        <div class="cc-form-section">
          <label class="cc-label">Point Value</label>
          <select class="cc-input" onchange="setPointValue(this.value)">
            <option value="500"  ${state.pointValue === 500  ? 'selected' : ''}>500 ₤</option>
            <option value="1000" ${state.pointValue === 1000 ? 'selected' : ''}>1000 ₤</option>
            <option value="1500" ${state.pointValue === 1500 ? 'selected' : ''}>1500 ₤</option>
            <option value="2000" ${state.pointValue === 2000 ? 'selected' : ''}>2000 ₤</option>
          </select>
        </div>

        <div class="cc-form-section">
          <label class="cc-label">Danger Rating</label>
          <select class="cc-input" onchange="setDangerRating(this.value)">
            <option value="1" ${state.dangerRating === 1 ? 'selected' : ''}>&#9733;&#9734;&#9734;&#9734;&#9734;&#9734; &mdash; Controlled</option>
            <option value="2" ${state.dangerRating === 2 ? 'selected' : ''}>&#9733;&#9733;&#9734;&#9734;&#9734;&#9734; &mdash; Frontier Risk</option>
            <option value="3" ${state.dangerRating === 3 ? 'selected' : ''}>&#9733;&#9733;&#9733;&#9734;&#9734;&#9734; &mdash; Hostile</option>
            <option value="4" ${state.dangerRating === 4 ? 'selected' : ''}>&#9733;&#9733;&#9733;&#9733;&#9734;&#9734; &mdash; Dangerous</option>
            <option value="5" ${state.dangerRating === 5 ? 'selected' : ''}>&#9733;&#9733;&#9733;&#9733;&#9733;&#9734; &mdash; Extreme</option>
            <option value="6" ${state.dangerRating === 6 ? 'selected' : ''}>&#9733;&#9733;&#9733;&#9733;&#9733;&#9733; &mdash; Catastrophic</option>
          </select>
        </div>

        <div class="cc-form-section">
          <label class="cc-label">Game Warden</label>
          <select class="cc-input" onchange="setGameWarden(this.value)">
            <option value="none"      ${!state.gameWarden               ? 'selected' : ''}>No Warden</option>
            <option value="observing" ${state.gameWarden === 'observing' ? 'selected' : ''}>Observing</option>
            <option value="npc"       ${state.gameWarden === 'npc'       ? 'selected' : ''}>Running NPC</option>
          </select>
        </div>

        ${state.gameMode ? `
          <div class="cc-form-actions">
            <button class="cc-btn cc-btn-primary" onclick="completeStep(1)">Next: Factions &rarr;</button>
          </div>
        ` : ''}
      `;
    }

    // ================================
    // RENDER: STEP 2 — FACTIONS & FORCES
    // ================================
    function renderStep2_Factions() {
      if (!state.gameMode) {
        return `<div class="cc-info-box"><p>Complete Step 1 first.</p></div>`;
      }

      if (state.gameMode === 'solo') {
        const playerFaction = state.factions.find(f => !f.isNPC);
        return `
          <div class="cc-form-section">
            <label class="cc-label">Your Faction</label>
            <select class="cc-input" onchange="setPlayerFaction(this.value)">
              <option value="">Choose your faction&hellip;</option>
              ${FACTIONS.filter(f => f.id !== 'monsters').map(f => `
                <option value="${f.id}" ${playerFaction?.id === f.id ? 'selected' : ''}>${f.name}</option>
              `).join('')}
            </select>
          </div>

          <div class="cc-form-section">
            <label class="cc-label">NPC Opponents</label>
            <p class="cc-help-text">Choose which factions you'll be playing against.</p>
            ${FACTIONS.map(f => {
              const isNPC = state.factions.some(sf => sf.id === f.id && sf.isNPC);
              return `
                <div class="cc-faction-row">
                  <label class="cc-checkbox-label">
                    <input type="checkbox" ${isNPC ? 'checked' : ''}
                      onchange="toggleNPCFaction('${f.id}', '${f.name}', this.checked)">
                    ${f.name}
                  </label>
                  <span class="cc-help-text" style="margin:0">(NPC)</span>
                </div>
              `;
            }).join('')}
          </div>

          <div class="cc-form-actions">
            <button class="cc-btn cc-btn-ghost" onclick="openStep(1)">&larr; Back</button>
            <button class="cc-btn cc-btn-primary" onclick="completeStep(2)"
              ${!playerFaction ? 'disabled' : ''}>Next: Location &rarr;</button>
          </div>
        `;
      }

      // Multiplayer
      return `
        <div class="cc-form-section">
          <label class="cc-label">Factions Playing</label>
          <p class="cc-help-text">Select each faction in this game. Mark NPCs where needed.</p>
          ${FACTIONS.map(f => {
            const inGame = state.factions.find(sf => sf.id === f.id);
            return `
              <div class="cc-faction-row">
                <label class="cc-checkbox-label">
                  <input type="checkbox" ${inGame ? 'checked' : ''}
                    onchange="toggleFaction('${f.id}', '${f.name}', this.checked)">
                  ${f.name}
                </label>
                ${inGame ? `
                  <input type="text" class="cc-input cc-player-name"
                    placeholder="Player name..."
                    value="${inGame.player || ''}"
                    onchange="setFactionPlayer('${f.id}', this.value)">
                  <label class="cc-checkbox-label" style="flex:0 0 auto">
                    <input type="checkbox" ${inGame.isNPC ? 'checked' : ''}
                      onchange="toggleFactionNPC('${f.id}', this.checked)">
                    NPC
                  </label>
                ` : ''}
              </div>
            `;
          }).join('')}
        </div>

        <div class="cc-form-actions">
          <button class="cc-btn cc-btn-ghost" onclick="openStep(1)">&larr; Back</button>
          <button class="cc-btn cc-btn-primary" onclick="completeStep(2)"
            ${state.factions.length < 2 ? 'disabled' : ''}>Next: Location &rarr;</button>
        </div>
      `;
    }

    // ================================
    // RENDER: STEP 3 — LOCATION
    // ================================
    function renderStep3_Location() {
      const namedLocations = locationData?.locations || [];

      return `
        <div class="cc-form-section">
          <label class="cc-label">Location Type</label>
          <div class="cc-button-group">
            <button class="cc-btn ${state.locationType === 'random_any' ? 'cc-btn-primary' : 'cc-btn-ghost'}"
                    onclick="setLocationType('random_any')">Random</button>
            <button class="cc-btn ${state.locationType === 'named' ? 'cc-btn-primary' : 'cc-btn-ghost'}"
                    onclick="setLocationType('named')">Named Location</button>
          </div>
        </div>

        ${state.locationType === 'named' ? `
          <div class="cc-form-section">
            <label class="cc-label">Choose Location</label>
            <select class="cc-input" onchange="setSelectedLocation(this.value)">
              <option value="">&mdash; Select a location &mdash;</option>
              ${namedLocations.map(loc => `
                <option value="${loc.id}" ${state.selectedLocation === loc.id ? 'selected' : ''}>
                  ${loc.name} (Danger ${loc.danger || '?'})
                </option>
              `).join('')}
            </select>
          </div>
        ` : ''}

        ${state.locationType === 'random_any' ? `
          <div class="cc-info-box"><p><i class="fa fa-info-circle"></i> A random location will be chosen when you generate.</p></div>
        ` : ''}

        <div class="cc-form-actions">
          <button class="cc-btn cc-btn-ghost" onclick="openStep(2)">&larr; Back</button>
          <button class="cc-btn cc-btn-primary" onclick="completeStep(3)"
            ${(state.locationType === 'named' && !state.selectedLocation) || !state.locationType ? 'disabled' : ''}>
            Next: Generate Scenario &rarr;
          </button>
        </div>
      `;
    }

    // ================================
    // RENDER: STEP 4 — GENERATE
    // ================================
    function renderStep4_Generate() {
      if (!state.generated) {
        const locName = state.locationType === 'named'
          ? locationData?.locations.find(l => l.id === state.selectedLocation)?.name || 'Named'
          : 'Random';
        return `
          <div class="cc-generate-section">
            <p class="cc-help-text">Ready to generate your scenario based on:</p>
            <ul class="cc-summary-list">
              <li><strong>Mode:</strong> ${state.gameMode === 'solo' ? 'Solo Play' : 'Multiplayer'}</li>
              <li><strong>Points:</strong> ${state.pointValue} &#8356;</li>
              <li><strong>Danger:</strong> ${'&#9733;'.repeat(state.dangerRating)}${'&#9734;'.repeat(6 - state.dangerRating)}</li>
              <li><strong>Factions:</strong> ${state.factions.map(f => f.name + (f.isNPC ? ' (NPC)' : '')).join(', ') || '—'}</li>
              <li><strong>Location:</strong> ${locName}</li>
            </ul>
            <div class="cc-form-actions">
              <button class="cc-btn cc-btn-ghost" onclick="openStep(3)">&larr; Back</button>
              <button class="cc-btn cc-btn-primary" onclick="generateScenario()"><i class="fa fa-dice"></i> Generate Scenario</button>
            </div>
          </div>
        `;
      }
      return renderScenarioOutput();
    }

    // ================================
    // RENDER: SCENARIO OUTPUT
    // ================================
    function renderScenarioOutput() {
      const s = state.scenario;
      if (!s) return '';

      return `
        <div class="cc-scenario-result">

          <h3>${s.name}</h3>
          <div class="cc-scenario-hook">${s.narrative_hook}</div>

          <!-- LOCATION -->
          <div class="cc-scenario-section">
            <h4><i class="fa fa-map-marker"></i> Location</h4>
            <p>
              <strong>${s.location.name}</strong>
              <span class="cc-state-badge cc-state-${s.location.state}">${s.location.state}</span>
              &nbsp;Danger ${s.danger_rating} &mdash; ${s.danger_description}
            </p>
            ${s.location.description ? `<p><em>${s.location.description}</em></p>` : ''}
            ${s.location.atmosphere  ? `<p class="cc-quote">"${s.location.atmosphere}"</p>` : ''}
            ${s.location.features?.length ? `<p class="cc-help-text">${s.location.features.join(' &middot; ')}</p>` : ''}
            ${buildResourceSummary(s.location.effectiveResources)}
            ${renderLocationMapEmbed()}
          </div>

          <!-- OBJECTIVES -->
          <div class="cc-scenario-section">
            <h4><i class="fa fa-crosshairs"></i> Objectives</h4>
            ${s.objectives.map(obj => `
              <div class="cc-objective-card">
                <strong>${obj.name}</strong>
                <p>${obj.description}</p>
                <p class="cc-vp-line"><i class="fa fa-star"></i> ${obj.vp_base} VP base</p>
                ${obj.special ? `<p><em><i class="fa fa-exclamation-triangle"></i> Special: ${obj.special}</em></p>` : ''}
              </div>
            `).join('')}
          </div>

          <!-- BOARD SETUP TABLE -->
          ${s.objective_markers?.length ? `
            <div class="cc-scenario-section cc-markers-section">
              <h4><i class="fa fa-thumb-tack"></i> Board Setup &mdash; Objective Markers</h4>
              <p class="cc-markers-intro">Before the game begins, place these tokens on the board as described.</p>
              <table class="cc-marker-table">
                <thead>
                  <tr>
                    <th>MARKER</th>
                    <th>COUNT</th>
                    <th>PLACEMENT</th>
                    <th>ACTIONS</th>
                  </tr>
                </thead>
                <tbody>
                  ${s.objective_markers.map(m => `
                    <tr>
                      <td>
                        <strong>${m.name}</strong><br>
                        <span class="cc-marker-token">${m.token}</span>
                      </td>
                      <td class="cc-marker-count">${m.count}</td>
                      <td>${m.placement}</td>
                      <td>${(m.interactions || []).map(i => `<span class="cc-marker-action">${i}</span>`).join(' ')}</td>
                    </tr>
                    ${m.notes ? `<tr class="cc-marker-note-row"><td colspan="4"><em><i class="fa fa-info-circle"></i> ${m.notes}</em></td></tr>` : ''}
                  `).join('')}
                </tbody>
              </table>
            </div>
          ` : ''}

          <!-- MONSTER PRESSURE -->
          ${s.monster_pressure?.enabled ? `
            <div class="cc-scenario-section">
              <h4><i class="fa fa-paw"></i> Monster Pressure</h4>
              <p><strong>Trigger:</strong> ${s.monster_pressure.trigger}</p>
              ${s.monster_pressure.seed_based ? '<p class="cc-help-text"><em>Location-specific monsters selected.</em></p>' : ''}
              <ul>
                ${s.monster_pressure.monsters.map(m => `<li>${m.name} (${m.type || 'Monster'}) &mdash; ${m.cost} &#8356;</li>`).join('')}
              </ul>
              ${s.monster_pressure.notes ? `<p><em>${s.monster_pressure.notes}</em></p>` : ''}
            </div>
          ` : ''}

          <!-- TWIST -->
          ${s.twist ? `
            <div class="cc-scenario-section cc-twist">
              <h4><i class="fa fa-random"></i> Scenario Twist</h4>
              <p><strong>${s.twist.name}</strong></p>
              <p>${s.twist.description}</p>
              ${s.twist.example ? `<p><em>Example: ${s.twist.example}</em></p>` : ''}
            </div>
          ` : ''}

          <!-- VICTORY CONDITIONS -->
          <div class="cc-scenario-section">
            <h4><i class="fa fa-trophy"></i> Victory Conditions</h4>
            ${Object.entries(s.victory_conditions).map(([factionId, vc]) => `
              <div class="cc-victory-card">
                <div class="cc-vc-header">
                  <h5>${vc.faction_name}${vc.is_npc ? ' <span class="cc-npc-tag">NPC</span>' : ''}</h5>
                </div>
                <div class="cc-vc-objectives">
                  ${(vc.objectives || []).map((obj, i) => `
                    <div class="cc-vc-obj">
                      <div class="cc-vc-obj-label">Objective ${i + 1}</div>
                      <div class="cc-vc-obj-name"><i class="fa fa-crosshairs"></i> ${obj.name}</div>
                      <p class="cc-vc-obj-desc">${obj.desc}</p>
                      <div class="cc-vc-obj-meta">
                        <span class="cc-vp-line"><i class="fa fa-star"></i> ${obj.vp}</span>
                        <span class="cc-tactic-line"><i class="fa fa-book"></i> ${obj.tactic}</span>
                      </div>
                    </div>
                  `).join('')}
                </div>
                <hr class="cc-vc-divider" />
                <div class="cc-vc-finale">
                  <div class="cc-vc-obj-label">Finale</div>
                  <div class="cc-vc-obj-name"><i class="fa fa-bolt"></i> ${vc.finale.name}</div>
                  <p>${vc.finale.desc}</p>
                  <p class="cc-vp-line"><i class="fa fa-star"></i> ${vc.finale.vp}</p>
                </div>
                <hr class="cc-vc-divider" />
                <div class="cc-vc-aftermath">
                  <div class="cc-vc-obj-label">If ${vc.faction_name} Wins</div>
                  <p><i class="fa fa-chevron-right"></i> ${vc.aftermath.immediate}</p>
                  <p><i class="fa fa-university"></i> Territory becomes <strong>${vc.aftermath.canyon_state}</strong>.</p>
                  <p><i class="fa fa-calendar"></i> ${vc.aftermath.long_term}</p>
                  ${vc.quote ? `<p class="cc-quote">"${vc.quote}"</p>` : ''}
                </div>
              </div>
            `).join('')}
          </div>

          <!-- AFTERMATH -->
          ${s.aftermath ? `
            <div class="cc-scenario-section">
              <h4><i class="fa fa-scroll"></i> Aftermath</h4>
              <p>${s.aftermath}</p>
            </div>
          ` : ''}

          ${s.vault_source ? `
            <div class="cc-scenario-section">
              <p class="cc-help-text"><em><i class="fa fa-book"></i> Based on vault scenario: "${s.vault_source}" (${s.vault_match_score} tag matches)</em></p>
            </div>
          ` : ''}

          <div class="cc-form-actions">
            <button class="cc-btn cc-btn-ghost"     onclick="resetScenario()"><i class="fa fa-refresh"></i> Start Over</button>
            <button class="cc-btn cc-btn-secondary" onclick="rollAgain()"><i class="fa fa-random"></i> The Canyon Shifts</button>
            <button class="cc-btn cc-btn-primary"   onclick="printScenario()"><i class="fa fa-print"></i> Print</button>
            <button class="cc-btn cc-btn-primary"   onclick="saveScenario()"><i class="fa fa-cloud"></i> Save to Cloud</button>
          </div>

        </div>
      `;
    }

    // ================================
    // RENDER: SUMMARY SIDEBAR PANEL
    // ================================
    function renderSummaryPanel() {
      const steps = [
        { num: 1, title: 'Game Setup', complete: state.completedSteps.includes(1) },
        { num: 2, title: 'Factions',   complete: state.completedSteps.includes(2) },
        { num: 3, title: 'Location',   complete: state.completedSteps.includes(3) },
        { num: 4, title: 'Generate',   complete: state.generated }
      ];

      return `
        <div class="cc-summary-header"><h3>Scenario Progress</h3></div>
        <div class="cc-summary-steps">
          ${steps.map(step => `
            <div class="cc-summary-step ${step.complete ? 'complete' : ''} ${state.currentStep === step.num ? 'active' : ''}"
                 onclick="openStep(${step.num})">
              <div class="cc-summary-step-number">${step.num}</div>
              <div class="cc-summary-step-title">${step.title}</div>
              ${step.complete ? '<div class="cc-summary-step-check"><i class="fa fa-check"></i></div>' : ''}
            </div>
          `).join('')}
        </div>

        ${state.completedSteps.length > 0 ? `
          <div class="cc-summary-details">
            <h4>Current Setup</h4>
            ${state.gameMode    ? `<p><strong>Mode:</strong> ${state.gameMode === 'solo' ? 'Solo' : 'Multiplayer'}</p>` : ''}
            ${state.pointValue  ? `<p><strong>Points:</strong> ${state.pointValue} &#8356;</p>` : ''}
            ${state.dangerRating ? `<p><strong>Danger:</strong> ${'&#9733;'.repeat(state.dangerRating)}${'&#9734;'.repeat(6 - state.dangerRating)}</p>` : ''}
            ${state.factions.length ? `<p><strong>Factions:</strong> ${state.factions.map(f => f.name).join(', ')}</p>` : ''}
            ${state.selectedLocation || state.locationType === 'random_any'
              ? `<p><strong>Location:</strong> ${state.locationType === 'named' ? '&#10003; Named' : 'Random'}</p>`
              : ''}
          </div>
        ` : ''}

        ${state.generated ? `
          <div class="cc-summary-details" style="border-top: 2px solid var(--cc-primary); margin-top: 1rem; padding-top: 1rem;">
            <h4>Quick Actions</h4>
            <button class="cc-btn cc-btn-ghost" style="width: 100%; margin-bottom: 0.5rem;"
                    onclick="loadFromCloud()"><i class="fa fa-folder-open"></i> Load Saved Scenario</button>
          </div>
        ` : ''}
      `;
    }

    // ================================
    // RENDER: MAIN
    // ================================
    function render() {
      if (state.generated && state.scenario) {
        const html = `
          <div class="cc-app-header">
            <div>
              <h1 class="cc-app-title">Coffin Canyon</h1>
              <div class="cc-app-subtitle">Scenario Builder</div>
            </div>
          </div>
          <div class="cc-scenario-full-layout">
            ${renderScenarioOutput()}
          </div>
        `;
        root.innerHTML = `<div class="cc-app-shell h-100">${html}</div>`;

        // Boot the location map embed after the DOM is updated
        // (requestAnimationFrame lets the browser paint the placeholder first)
        requestAnimationFrame(() => {
          initLocationMapEmbed(state.scenario.location);
        });
        return;
      }

      const html = `
        <div class="cc-app-header">
          <div>
            <h1 class="cc-app-title">Coffin Canyon</h1>
            <div class="cc-app-subtitle">Scenario Builder</div>
          </div>
        </div>

        <div class="cc-scenario-builder-layout">
          <aside class="cc-scenario-sidebar">
            <div class="cc-panel h-100">
              <div class="cc-panel-head">
                <div class="cc-panel-title">Build Scenario</div>
              </div>
              <div class="cc-body cc-accordion">
                ${renderAccordionStep(1, 'Game Setup',        '<i class="fa fa-cog"></i>',    renderStep1_GameSetup(), state.currentStep === 1, state.completedSteps.includes(1))}
                ${renderAccordionStep(2, 'Factions & Forces', '<i class="fa fa-users"></i>',  renderStep2_Factions(),  state.currentStep === 2, state.completedSteps.includes(2))}
                ${renderAccordionStep(3, 'Location',          '<i class="fa fa-map"></i>',    renderStep3_Location(),  state.currentStep === 3, state.completedSteps.includes(3))}
                ${renderAccordionStep(4, 'Generate Scenario', '<i class="fa fa-dice"></i>',   renderStep4_Generate(),  state.currentStep === 4, state.generated)}
              </div>
            </div>
          </aside>

          <main class="cc-scenario-main">
            <div class="cc-panel h-100">
              <div class="cc-panel-head">
                <div class="cc-panel-title">Summary</div>
              </div>
              <div class="cc-body">
                ${renderSummaryPanel()}
              </div>
            </div>
          </main>
        </div>
      `;
      root.innerHTML = `<div class="cc-app-shell h-100">${html}</div>`;
    }

    // ================================
    // EVENT HANDLERS
    // ================================
    window.setGameMode = function(mode) {
      state.gameMode = mode;
      state.factions = [];
      render();
    };

    window.setPointValue = function(value) {
      state.pointValue = parseInt(value);
    };

    window.setDangerRating = function(value) {
      state.dangerRating = parseInt(value);
      render();
    };

    window.setGameWarden = function(value) {
      state.gameWarden = (value === 'none') ? null : value;
    };

    window.setPlayerFaction = function(factionId) {
      state.factions = state.factions.filter(f => f.isNPC);
      if (factionId) {
        const faction = FACTIONS.find(f => f.id === factionId);
        if (faction) state.factions.unshift({ id: faction.id, name: faction.name, player: '', isNPC: false });
      }
      render();
    };

    window.toggleNPCFaction = function(id, name, checked) {
      if (checked) {
        if (!state.factions.some(f => f.id === id && f.isNPC)) {
          state.factions.push({ id, name, player: 'NPC', isNPC: true });
        }
      } else {
        state.factions = state.factions.filter(f => !(f.id === id && f.isNPC));
      }
      render();
    };

    window.toggleFaction = function(id, name, checked) {
      if (checked) {
        if (!state.factions.some(f => f.id === id)) {
          state.factions.push({ id, name, player: '', isNPC: false });
        }
      } else {
        state.factions = state.factions.filter(f => f.id !== id);
      }
      render();
    };

    window.toggleFactionNPC = function(id, isNPC) {
      const f = state.factions.find(f => f.id === id);
      if (f) { f.isNPC = isNPC; f.player = isNPC ? 'NPC' : ''; }
      render();
    };

    window.setFactionPlayer = function(factionId, playerName) {
      const f = state.factions.find(f => f.id === factionId);
      if (f) f.player = playerName;
    };

    window.setLocationType = function(type) {
      state.locationType     = type;
      state.selectedLocation = null;
      render();
    };

    window.setSelectedLocation = function(id) {
      state.selectedLocation = id || null;
    };

    window.openStep     = function(n) { state.currentStep = n; render(); };
    window.goToStep     = function(n) { state.currentStep = n; render(); };
    window.completeStep = function(n) {
      if (!state.completedSteps.includes(n)) state.completedSteps.push(n);
      state.currentStep = n + 1;
      render();
    };

    window.resetScenario = function() {
      state.generated        = false;
      state.scenario         = null;
      state.currentStep      = 1;
      state.completedSteps   = [];
      state.factions         = [];
      state.locationType     = null;
      state.selectedLocation = null;
      render();
    };

    window.rollAgain = function() {
      if (state.factions.length >= 2) {
        window.generateScenario();
      } else {
        alert('Please complete setup first (Steps 1–3).');
      }
    };

    window.printScenario = function() { window.print(); };

    // ================================
    // SAVE / LOAD
    // ================================
    window.saveScenario = async function() {
      if (!state.scenario) return;
      if (!window.CC_STORAGE) {
        alert('Storage not ready. Please wait a moment and try again.');
        return;
      }
      try {
        const key  = 'SCN_' + Date.now();
        const data = JSON.stringify({
          savedAt:  new Date().toISOString(),
          scenario: state.scenario,
          setup: {
            gameMode:         state.gameMode,
            pointValue:       state.pointValue,
            dangerRating:     state.dangerRating,
            factions:         state.factions,
            locationType:     state.locationType,
            selectedLocation: state.selectedLocation
          }
        });
        await window.CC_STORAGE.set(key, data);
        alert(`✅ Scenario saved as: ${key}`);
      } catch (err) {
        console.error('Save failed:', err);
        alert('Save failed. Check console for details.');
      }
    };

    window.loadFromCloud = async function() {
      if (!window.CC_STORAGE) {
        alert('Storage not ready. Please wait a moment and try again.');
        return;
      }
      try {
        const keys = await window.CC_STORAGE.list('SCN_');
        if (!keys?.keys?.length) {
          alert('No saved scenarios found.');
          return;
        }
        const keyList = keys.keys.join('\n');
        const chosen  = prompt(`Choose a save to load:\n\n${keyList}`);
        if (!chosen) return;

        const raw = await window.CC_STORAGE.get(chosen);
        if (!raw?.value) { alert('Save not found.'); return; }

        const saved            = JSON.parse(raw.value);
        state.scenario         = saved.scenario;
        state.gameMode         = saved.setup?.gameMode         || state.gameMode;
        state.pointValue       = saved.setup?.pointValue       || state.pointValue;
        state.dangerRating     = saved.setup?.dangerRating     || state.dangerRating;
        state.factions         = saved.setup?.factions         || state.factions;
        state.locationType     = saved.setup?.locationType     || state.locationType;
        state.selectedLocation = saved.setup?.selectedLocation || state.selectedLocation;
        state.generated        = true;
        state.completedSteps   = [1, 2, 3];
        state.currentStep      = 4;
        render();
      } catch (err) {
        console.error('Load failed:', err);
        alert('Load failed. Check console for details.');
      }
    };

    // ================================
    // BOOT
    // ================================
    root.innerHTML = `
      <div class="cc-app-shell h-100">
        <div class="cc-app-header">
          <div>
            <h1 class="cc-app-title">Coffin Canyon</h1>
            <div class="cc-app-subtitle">Scenario Builder</div>
          </div>
        </div>
        <div class="cc-loading-container">
          <img
            src="https://raw.githubusercontent.com/steamcrow/coffin/main/rules/apps/canyon_map/data/coffin_canyon_logo.png"
            alt="Coffin Canyon"
            style="width:320px;max-width:80vw;margin-bottom:2rem;filter:drop-shadow(0 0 28px rgba(255,117,24,.45));"
          />
          <div class="cc-loading-bar">
            <div class="cc-loading-progress"></div>
          </div>
          <div class="cc-loading-text">Loading scenario data&hellip;</div>
        </div>
      </div>
    `;

    loadGameData().then(() => {
      console.log('✅ Game data ready — rendering app');
      render();
    });

  } // end init()
}; // end window.CC_APP
