// ================================
// SCENARIO BRAIN - FULL VERSION
// with Cultist System + Terrain Map
// ================================

console.log("🧠 Scenario Brain loading...");

// ================================
// REGISTRIES & DATA CONSTANTS
// ================================

const CULT_REGISTRY = [
  { id: 'sons_of_ralu',            name: 'Sons of Ralu',            theme: 'Chaos & Destruction',    color: '#c44569', description: 'Worshippers of RALU, the monster god of chaos. They seek to unleash primal, mindless destruction upon the Canyon.', weight: 8 },
  { id: 'new_children_of_tzul',    name: 'The New Children of Tzul', theme: 'Undead & Ancient Power',   color: '#7b2d8b', description: 'A new cult worshipping the ancient Tzul. They aid and summon the undead, seeking to resurrect their dark masters.', weight: 7 },
  { id: 'burning_choir',           name: 'The Burning Choir',        theme: 'Fire & Purification',     color: '#e84545', description: 'Apocalypse cultists who believe the world must burn to be reborn. Fire is their sacrament.', weight: 6 },
  { id: 'children_of_hollow',      name: 'Children of the Hollow',   theme: 'Void & Madness',          color: '#5a5aaa', description: 'They worship the void between worlds. Their rituals dissolve reality itself.', weight: 5 },
  { id: 'thyr_eaters',             name: 'The Thyr Eaters',           theme: 'Addiction & Consumption',  color: '#daa520', description: 'Addicted to raw Thyr energy. They consume all magic and crystals, growing ever hungrier.', weight: 8 },
  { id: 'blighted_root',           name: 'The Blighted Root',        theme: 'Corrupted Nature',        color: '#4caf50', description: 'Nature corruption cultists. They twist plants and beasts into horrifying, spreading abominations.', weight: 4 },
  { id: 'bone_singers',            name: 'The Bone Singers',         theme: 'Death Magic',             color: '#78909c', description: 'Practitioners of death magic who raise the dead and commune with the grave.', weight: 7 },
  { id: 'regents_faithful',        name: "Regent's Faithful",        theme: 'Dark Monarchy',           color: '#8e24aa', description: "Secret worshippers of a dark monarch. Only appear when The Crow Queen is NOT in the scenario.", weight: 3 }
];

const CULT_OBJECTIVES = [
  {
    id: 'awaken_tzul_dust_kings',
    name: 'Awaken the Tzul Dust Kings',
    description: 'The cultists are sacrificing local miners and their families at the ancient Tzul burial grounds. If the ritual completes, the Dust Kings rise.',
    cult_affinity: ['new_children_of_tzul', 'bone_singers'],
    turn_limit: 5,
    win_condition: 'Ritual completes by turn limit. Stop it by controlling the burial grounds for 2 consecutive rounds.',
    counter: 'Control the burial site for 2 consecutive rounds.'
  },
  {
    id: 'awaken_ralu',
    name: 'Awaken RALU at the Fountain Idol',
    description: 'At the ancient RALU fountain idol, the Sons of Ralu are sacrificing a captured monster. If the sacrifice completes, the monster god of chaos stirs.',
    cult_affinity: ['sons_of_ralu'],
    turn_limit: 4,
    win_condition: 'The monster sacrifice completes at the idol.',
    counter: 'Destroy the idol OR rescue the captured monster.'
  },
  {
    id: 'ring_the_doom_bell',
    name: 'Ring the Bell of Doom',
    description: 'The cultists are raising a dark temple in the Canyon. If they finish construction and ring the bell, something ancient and terrible answers the call.',
    cult_affinity: ['burning_choir', 'new_children_of_tzul', 'regents_faithful'],
    turn_limit: 6,
    win_condition: 'Temple construction completes and the bell is rung.',
    counter: 'Destroy the bell OR prevent 3 construction actions.'
  },
  {
    id: 'open_hollow_portal',
    name: 'Open a Portal to the Hollow',
    description: 'The Children of the Hollow are completing a blood circle in the ruins. When finished, reality tears open and something worse pours through.',
    cult_affinity: ['children_of_hollow'],
    turn_limit: 5,
    win_condition: 'The blood circle is completed.',
    counter: 'Control the blood circle for 2 consecutive rounds to disrupt it.'
  },
  {
    id: 'corrupt_thyr_vein',
    name: 'Corrupt the Thyr Vein',
    description: 'The Thyr Eaters are funneling raw Thyr into a corrupting device. If the vein is fully poisoned, the entire region becomes dead ground.',
    cult_affinity: ['thyr_eaters'],
    turn_limit: 5,
    win_condition: 'The corruption device fully poisons the vein.',
    counter: 'Destroy the corruption device OR extract the Thyr before it is consumed.'
  },
  {
    id: 'raise_dead_army',
    name: 'Raise an Army of the Dead',
    description: 'The Bone Singers are raising the dead from the local graveyard. Each round they succeed, another wave of corpses joins them.',
    cult_affinity: ['bone_singers', 'new_children_of_tzul'],
    turn_limit: 4,
    win_condition: 'The Bone Singers successfully raise 3 waves.',
    counter: 'Destroy the Ritual Focus before 3 waves are raised.'
  },
  {
    id: 'burn_the_boomtown',
    name: 'Purge the Boomtown',
    description: 'The Burning Choir has set fires across the boomtown as a "purification offering." Every round the flames spread further.',
    cult_affinity: ['burning_choir'],
    turn_limit: 4,
    win_condition: 'Fire spreads to all objectives on the map.',
    counter: 'Destroy all 3 fire sources before the flames spread.'
  },
  {
    id: 'poison_water_supply',
    name: 'Poison the Water Supply',
    description: 'Cultists are adding something dark and ancient to the settlement water. If completed, mass hysteria breaks out and no one can think straight.',
    cult_affinity: ['blighted_root', 'children_of_hollow'],
    turn_limit: 3,
    win_condition: 'The water supply is fully poisoned.',
    counter: 'Destroy or capture the poison source before the turn limit.'
  },
  {
    id: 'desecrate_sacred_site',
    name: 'Desecrate the Sacred Site',
    description: 'The cultists are performing dark rites at a sacred location, twisting its power for themselves.',
    cult_affinity: ['regents_faithful', 'sons_of_ralu', 'burning_choir'],
    turn_limit: 5,
    win_condition: 'The desecration ritual is completed.',
    counter: 'Hold the sacred site for 2 consecutive rounds.'
  },
  {
    id: 'harvest_living_souls',
    name: 'Harvest Living Souls',
    description: 'The cultists have captured civilians and are feeding them to a terrible engine, one soul at a time.',
    cult_affinity: ['bone_singers', 'children_of_hollow', 'sons_of_ralu'],
    turn_limit: 4,
    win_condition: 'All captured civilians are consumed by the engine.',
    counter: 'Rescue the civilians by interacting with the cages.'
  },
  {
    id: 'grow_the_blight',
    name: 'Grow the Living Blight',
    description: 'The Blighted Root has planted a seed of corruption. Each round it spreads, claiming more terrain and more lives.',
    cult_affinity: ['blighted_root'],
    turn_limit: 6,
    win_condition: 'The Blight covers all objectives.',
    counter: 'Destroy the Blight Heart to stop the spread.'
  },
  {
    id: 'summon_canyon_titan',
    name: 'Summon the Canyon Titan',
    description: 'Deep beneath the canyon, something enormous sleeps. The cultists are performing the exact ritual to wake it. No one knows what follows.',
    cult_affinity: ['sons_of_ralu', 'children_of_hollow', 'new_children_of_tzul'],
    turn_limit: 5,
    win_condition: 'The summoning ritual completes.',
    counter: 'Destroy all 3 summoning pillars to break the ritual.'
  }
];

const CULTIST_STATE_MODIFIERS = {
  'poisoned':    { modifier: 0.10,  reason: 'Corruption breeds cult activity' },
  'haunted':     { modifier: 0.25,  reason: 'Dark energy draws cultists like moths to flame' },
  'exalted':     { modifier: 0.20,  reason: 'The Regent\'s dark power awakens darker forces' },
  'strangewild': { modifier: 0.10,  reason: 'Feral chaos makes cults bold and reckless' },
  'lawless':     { modifier: 0.05,  reason: 'No law means no one stops the cults' },
  'liberated':   { modifier: -0.15, reason: 'Federal order suppresses cult activity' },
  'extracted':   { modifier: -0.05, reason: 'Stripped wasteland offers little for rituals' },
  'rusted':      { modifier: -0.10, reason: 'Machines don\'t worship gods' },
  'held':        { modifier: 0.0,   reason: 'Controlled territory. Cults are watched.' }
};

const TERRAIN_MAP = {
  'extraction_heist':            { core: ['Mine Entrance', 'Thyr Extraction Rig', 'Supply Crates (×3)'], optional: ['Quonset Huts', 'Rail Tracks'], atmosphere: 'Active industrial dig site' },
  'claim_and_hold':              { core: ['Fortified Post', 'Territory Markers (×3)', 'Board Walks'], optional: ['Ruined Cantina', 'Stilt Buildings'], atmosphere: 'Contested frontier outpost' },
  'ambush_derailment':           { core: ['Rail Tracks', 'Overpass / Bridge', 'Scattered Crates (×4)'], optional: ['Stagecoach Ruins', 'Rocky Outcrop'], atmosphere: 'Remote stretch of rail' },
  'siege_standoff':              { core: ['Fortified Wall', 'Guard Tower', 'Barricades (×2)'], optional: ['Quonset Huts', 'Supply Depot'], atmosphere: 'Fortified position under siege' },
  'escort_run':                  { core: ['Trail Path', 'Waypoint Markers (×2)', 'Escort Cargo'], optional: ['Monster Den / Nest', 'Bridge Ruins'], atmosphere: 'Dangerous mountain trail' },
  'sabotage_strike':             { core: ['Thyr Extraction Rig', 'Dynamo', 'Control Panel'], optional: ['Quonset Huts', 'Rail Tracks'], atmosphere: 'Active industrial site. Explosions possible.' },
  'corruption_ritual':           { core: ['Ritual Circle', 'Tainted Ground', 'Ancient Altar'], optional: ['Tzul Ruins', 'Strange Plants'], atmosphere: 'Dark, oppressive, and wrong.' },
  'natural_disaster_response':   { core: ['Cracked Ground', 'Collapsing Structure', 'Evacuation Point'], optional: ['Buried Supplies', 'Unstable Terrain'], atmosphere: 'Active catastrophe.' }
};

const PRESSURE_PRETTY = {
  'ritual_misuse':          'ritual misuse',
  'belief_conflict':        'a clash of beliefs',
  'occult_overreach':       'occult forces none of them fully understand',
  'power_vacuum':           'a power vacuum',
  'retaliation':            'retaliation',
  'territorial_control':    'the fight for territorial control',
  'resource_scarcity':      'dwindling resources',
  'old_blood_feuds':        'old blood feuds',
  'monster_incursion':      'a monster incursion',
  'supply_shortage':        'a supply shortage',
  'faction_rivalry':        'faction rivalry',
  'desperation':            'sheer desperation',
  'survival':               'the need to survive',
  'greed':                  'greed',
  'curiosity':              'dangerous curiosity'
};

const CULTIST_TERRAIN_MARKERS = {
  'awaken_tzul_dust_kings':  ['Tzul Burial Ground', 'Captive Markers (x2)'],
  'awaken_ralu':             ['RALU Fountain Idol', 'Captive Monster Marker'],
  'ring_the_doom_bell':      ['Dark Temple (incomplete)', 'Doom Bell'],
  'open_hollow_portal':      ['Blood Circle', 'Ruined Archway'],
  'corrupt_thyr_vein':       ['Thyr Vein', 'Corruption Device'],
  'raise_dead_army':         ['Graveyard', 'Ritual Focus Marker'],
  'burn_the_boomtown':       ['Fire Source Markers (x3)'],
  'poison_water_supply':     ['Water Supply Marker', 'Poison Source'],
  'desecrate_sacred_site':   ['Sacred Site Marker'],
  'harvest_living_souls':    ['Soul Engine', 'Captive Cages (x3)'],
  'grow_the_blight':         ['Blight Heart Marker'],
  'summon_canyon_titan':     ['Summoning Pillars (x3)']
};

const VP_SYSTEMS = {
  'extraction_heist':            { primary: 'Items Extracted',    pVal: 3, bonus: 'Speed Bonus',        bVal: 1 },
  'claim_and_hold':              { primary: 'Rounds Controlled',  pVal: 2, bonus: 'Consecutive Control', bVal: 3 },
  'ambush_derailment':           { primary: 'Crates Salvaged',    pVal: 2, bonus: 'Wreckage Secured',    bVal: 5 },
  'siege_standoff':              { primary: 'Rounds Survived',    pVal: 3, bonus: 'Elite Kills',         bVal: 2 },
  'escort_run':                  { primary: 'Distance Traveled',  pVal: 1, bonus: 'Cargo Intact',        bVal: 5 },
  'corruption_ritual':           { primary: 'Rituals Complete',   pVal: 4, bonus: 'Disruptions',         bVal: 3 },
  'natural_disaster_response':   { primary: 'Units Evacuated',    pVal: 2, bonus: 'Resources Saved',     bVal: 3 },
  'sabotage_strike':             { primary: 'Systems Disabled',   pVal: 3, bonus: 'Stealth Bonus',       bVal: 2 }
};

const OBJECTIVE_BUILDERS = {
  'wrecked_engine': (loc, danger) => ({
    name: 'Salvage Wrecked Engine',
    description: 'Extract mechanical components from abandoned machinery.',
    target_value: Math.min(3, danger),
    progress_label: 'Components',
    vp_per_unit: 3
  }),
  'scattered_crates': (loc, danger) => ({
    name: 'Recover Supply Crates',
    description: 'Collect scattered supply crates across the battlefield.',
    target_value: danger + 1,
    progress_label: 'Crates',
    vp_per_unit: 2
  }),
  'ritual_circle': (loc, danger) => ({
    name: 'Control Ritual Site',
    description: 'Maintain control of the ritual circle to channel its power.',
    target_value: danger,
    progress_label: 'Rituals',
    vp_per_unit: 4
  }),
  'land_marker': (loc, danger, vpVal) => ({
    name: 'Establish Territory',
    description: 'Plant territorial markers and hold them.',
    target_value: 3,
    progress_label: 'Rounds',
    vp_per_unit: vpVal
  }),
  'fortified_position': (loc, danger, vpVal) => ({
    name: 'Hold Fortified Position',
    description: 'Maintain control of the defensive structure.',
    target_value: 3,
    progress_label: 'Rounds',
    vp_per_unit: vpVal
  }),
  'stored_supplies': (loc, danger) => ({
    name: 'Secure Stored Supplies',
    description: 'Locate and defend the local supply cache.',
    target_value: 2,
    progress_label: 'Caches',
    vp_per_unit: 4
  })
};

// ================================
// SCENARIO BRAIN CLASS
// ================================

class ScenarioBrain {
  constructor() {
    this.data = {
      scenarios: null,
      names: null,
      locations: null,
      locationTypes: null,
      plotFamilies: null,
      twists: null,
      canyonStates: null,
      factions: {}
    };
    this.loaded = false;
  }

  async loadAllData() {
    console.log("📚 Loading all data files...");
    const files = [
      { key: 'scenarios',        url: 'https://raw.githubusercontent.com/steamcrow/coffin/main/rules/src/180_scenario_vault.json' },
      { key: 'names',            url: 'https://raw.githubusercontent.com/steamcrow/coffin/main/rules/src/230_scenario_names.json' },
      { key: 'locations',        url: 'https://raw.githubusercontent.com/steamcrow/coffin/main/rules/src/170_named_locations.json' },
      { key: 'locationTypes',    url: 'https://raw.githubusercontent.com/steamcrow/coffin/main/rules/src/150_location_types.json' },
      { key: 'plotFamilies',     url: 'https://raw.githubusercontent.com/steamcrow/coffin/main/rules/src/200_plot_families.json' },
      { key: 'twists',           url: 'https://raw.githubusercontent.com/steamcrow/coffin/main/rules/src/210_twist_tables.json' },
      { key: 'canyonStates',     url: 'https://raw.githubusercontent.com/steamcrow/coffin/main/rules/src/30_campaign_system.json' },
      { key: 'monsterRangers',   url: 'https://raw.githubusercontent.com/steamcrow/coffin/main/factions/faction-monster-rangers-v5.json',  faction: 'monster_rangers' },
      { key: 'libertyCorps',     url: 'https://raw.githubusercontent.com/steamcrow/coffin/main/factions/faction-liberty-corps-v2.json',   faction: 'liberty_corps' },
      { key: 'monsterology',     url: 'https://raw.githubusercontent.com/steamcrow/coffin/main/factions/faction-monsterology-v2.json',    faction: 'monsterology' },
      { key: 'monsters',         url: 'https://raw.githubusercontent.com/steamcrow/coffin/main/factions/faction-monsters-v2.json',        faction: 'monsters' },
      { key: 'shineRiders',      url: 'https://raw.githubusercontent.com/steamcrow/coffin/main/factions/faction-shine-riders-v2.json',   faction: 'shine_riders' },
      { key: 'crowQueen',        url: 'https://raw.githubusercontent.com/steamcrow/coffin/main/factions/faction-crow-queen.json',        faction: 'crow_queen' }
    ];

    for (const file of files) {
      try {
        const res = await fetch(`${file.url}?t=${Date.now()}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json();
        if (file.faction) {
          this.data.factions[file.faction] = json;
        } else {
          this.data[file.key] = json;
        }
        console.log(`✅ Loaded: ${file.key}`);
      } catch (err) {
        console.error(`❌ Failed: ${file.key}`, err);
      }
    }
    this.loaded = true;
    console.log("🎉 All data loaded!");
  }

  async generateCompleteScenario(userSelections) {
    console.log("\n\n🎬 ========================================");
    console.log("    SCENARIO GENERATION START");
    console.log("========================================\n");
    if (!this.loaded) await this.loadAllData();

    // 1. Geography
    const location = this.generateLocation(userSelections);
    
    // 2. Plotting
    const plotFamily = this.selectPlotFamily(location, userSelections);
    const vpSpread = this.calculateVPSpread(plotFamily.id, userSelections.dangerRating);
    
    // 3. Objectives & Encounters
    const objectives = this.generateObjectives(plotFamily, location, userSelections, vpSpread);
    const cultistEncounter = this.generateCultistEncounter(userSelections, plotFamily, location);
    
    // 4. Winning & Narrative
    const victoryConditions = this.generateVictoryConditions(userSelections, objectives, vpSpread, cultistEncounter);
    const name = this.generateName(['battle'], location);
    const narrative = this.generateNarrative(plotFamily, location, userSelections, cultistEncounter);
    
    // 5. Physical Setup
    const terrainSetup = this.generateTerrainSetup(plotFamily, location, userSelections.dangerRating, objectives, cultistEncounter);
    const coffinCough = this.generateCoffinCough(location, userSelections.dangerRating);

    const scenario = {
      name: name,
      narrative_hook: narrative,
      plot_family: plotFamily.name,
      location: location,
      danger_rating: userSelections.dangerRating,
      danger_description: this.getDangerDesc(userSelections.dangerRating),
      vp_spread: vpSpread,
      objectives: objectives,
      victory_conditions: victoryConditions,
      monster_pressure: { 
        enabled: userSelections.dangerRating >= 4,
        trigger: userSelections.dangerRating >= 4 ? `Round ${userSelections.dangerRating - 1}` : 'N/A',
        escalation_type: userSelections.dangerRating >= 4 ? 'Environmental threat increases each round' : 'None'
      },
      canyon_state: this.getCanyonState(userSelections.canyonState),
      twist: this.generateTwist(userSelections.dangerRating, location),
      finale: this.generateFinale(plotFamily, userSelections.dangerRating, location, userSelections.factions),
      cultist_encounter: cultistEncounter,
      terrain_setup: terrainSetup,
      coffin_cough: coffinCough
    };

    console.log("\n✅ SCENARIO GENERATION COMPLETE\n");
    return this.validateScenario(scenario);
  }

  // ================================
  // STEP 1: LOCATION
  // ================================
  generateLocation(userSelections) {
    if (userSelections.locationType === 'named' && userSelections.selectedLocation) {
      const location = this.data.locations.locations.find(l => 
        l.name.toLowerCase() === userSelections.selectedLocation.toLowerCase()
      );
      if (location) return this.enrichLocation(location);
    }
    return this.generateProceduralLocation(userSelections.dangerRating);
  }

  enrichLocation(location) {
    return {
      ...location,
      resources: location.resources || {},
      hazards: location.hazards || [],
      terrain_features: location.terrain_features || [],
      rewards: location.rewards || []
    };
  }

  generateProceduralLocation(dangerRating) {
    const types = this.data.locationTypes.location_types.filter(t => 
      (!t.danger_floor || dangerRating >= t.danger_floor) &&
      (!t.danger_ceiling || dangerRating <= t.danger_ceiling)
    );
    const type = types.length > 0 ? this.randomChoice(types) : this.data.locationTypes.location_types[0];
    const nearby = this.randomChoice(this.data.locations.locations);

    return {
      id: `proc_${Date.now()}`,
      name: `The Outskirts of ${nearby.name}`,
      emoji: type.emoji || "🗺️",
      type_ref: type.id,
      description: `${type.description || 'A contested zone'} in the shadow of ${nearby.name}.`,
      atmosphere: this.randomChoice(type.atmosphere || ["Tension hangs heavy in the air"]),
      resources: type.resources || {},
      hazards: type.environmental_hazards || [],
      terrain_features: type.terrain_features || [],
      rewards: type.rewards || [],
      procedural: true
    };
  }

  // ================================
  // STEP 2: PLOT & VP
  // ================================
  selectPlotFamily(location, userSelections) {
    if (!this.data.plotFamilies?.plot_families) return this.getEmergencyPlot();
    const plots = this.data.plotFamilies.plot_families;
    let bestPlot = plots[0];
    let maxScore = -1;

    plots.forEach(plot => {
      let score = 0;
      if (location.resources && plot.primary_resources) {
        plot.primary_resources.forEach(res => { if (location.resources[res] > 0) score += 3; });
      }
      if (location.type_ref) {
        const tr = location.type_ref;
        if (tr.includes('fortress') && plot.id === 'siege_standoff') score += 4;
        if (tr.includes('pass') && plot.id === 'escort_run') score += 4;
        if (tr.includes('ruins') && plot.id === 'ambush_derailment') score += 4;
        if (tr.includes('mine') && plot.id === 'extraction_heist') score += 4;
      }
      userSelections.factions.forEach(faction => {
        if (faction.id === 'monster_rangers' && plot.id === 'corruption_ritual') score += 3;
        if (faction.id === 'liberty_corps' && plot.id === 'claim_and_hold') score += 2;
        if (faction.id === 'shine_riders' && (plot.id === 'extraction_heist' || plot.id === 'sabotage_strike')) score += 2;
      });
      if (score > maxScore) { maxScore = score; bestPlot = plot; }
    });
    return bestPlot;
  }

  getEmergencyPlot() {
    return { id: 'claim_and_hold', name: 'Claim and Hold', default_objectives: ['land_marker', 'fortified_position'] };
  }

  calculateVPSpread(plotId, danger) {
    const target = 10 + (danger * 2);
    const sys = VP_SYSTEMS[plotId] || { primary: 'Objectives Complete', pVal: 2, bonus: 'Enemy Eliminated', bVal: 1 };
    return {
      target_to_win: target,
      scoring_rule: `${sys.pVal} VP per ${sys.primary}`,
      bonus_rule: `${sys.bVal} VP per ${sys.bonus}`,
      formula: `(${sys.primary} × ${sys.pVal}) + (${sys.bonus} × ${sys.bVal})`,
      thresholds: { minor_victory: Math.floor(target * 0.6), major_victory: target, legendary_victory: Math.floor(target * 1.5) },
      ticker: { primary_label: sys.primary, primary_per_vp: sys.pVal, bonus_label: sys.bonus, bonus_per_vp: sys.bVal }
    };
  }

  // ================================
  // STEP 3: OBJECTIVES & CULTISTS
  // ================================
  buildObjective(type, location, danger, vpSpread) {
    const builder = OBJECTIVE_BUILDERS[type];
    if (!builder) return null;
    const obj = builder(location, danger, vpSpread.ticker.primary_per_vp);
    return { ...obj, type, max_vp: obj.target_value * obj.vp_per_unit };
  }

  generateResourceObjective(location, danger) {
    const highValue = Object.entries(location.resources || {}).filter(([_, v]) => v >= 2).map(([k]) => k);
    if (highValue.length === 0) return null;
    const res = this.randomChoice(highValue);
    const target = Math.min(location.resources[res], danger + 2);
    const vpPer = this.getResourceVP(res);
    return {
      name: `Extract ${this.formatResourceName(res)}`,
      description: `Secure valuable ${res} from ${location.name}`,
      type: 'resource_extraction',
      target_value: target,
      progress_label: this.formatResourceName(res),
      vp_per_unit: vpPer,
      max_vp: target * vpPer
    };
  }

  generateObjectives(plotFamily, location, userSelections, vpSpread) {
    const objectives = [];
    const used = new Set();
    const danger = userSelections.dangerRating;

    if (plotFamily.default_objectives?.length) {
      this.randomChoice(plotFamily.default_objectives, 2).forEach(t => {
        const o = this.buildObjective(t, location, danger, vpSpread);
        if (o) { objectives.push(o); used.add(t); }
      });
    }

    const res = this.generateResourceObjective(location, danger);
    if (res) { objectives.push(res); used.add('resource_extraction'); }

    const general = ['scattered_crates', 'wrecked_engine', 'land_marker', 'fortified_position', 'stored_supplies'];
    while (objectives.length < 4) {
      const t = general.filter(x => !used.has(x))[0];
      if (!t) break;
      const o = this.buildObjective(t, location, danger, vpSpread);
      if (o) objectives.push(o);
      used.add(t);
    }
    return objectives;
  }

  generateCultistEncounter(userSelections, plotFamily, location) {
    const base = 0.20 + (userSelections.dangerRating * 0.05);
    const mod = CULTIST_STATE_MODIFIERS[userSelections.canyonState]?.modifier || 0;
    if (Math.random() > (base + mod)) return null;

    const cult = this.weightedChoice(CULT_REGISTRY);
    const objective = this.randomChoice(CULT_OBJECTIVES.filter(o => o.cult_affinity.includes(cult.id) || Math.random() < 0.2));
    return { cult, objective, markers: CULTIST_TERRAIN_MARKERS[objective.id] || ['Ritual Focus'] };
  }

  // ================================
  // STEP 4: VICTORY & NARRATIVE
  // ================================
  generateVictoryConditions(userSelections, objectives, vpSpread, cultist) {
    const conditions = {
      standard_victory: `Reach ${vpSpread.target_to_win} Victory Points.`,
      major_victory: `Reach ${vpSpread.thresholds.major_victory} Victory Points while completing the primary objective.`,
      failure_condition: `Player party is wiped out OR turn limit of 6 reached.`
    };
    if (cultist) {
      conditions.cultist_threat = `CRITICAL: ${cultist.objective.name}. ${cultist.objective.win_condition}`;
      conditions.cultist_counter = cultist.objective.counter;
    }
    return conditions;
  }

  generateNarrative(plot, location, userSelections, cultist) {
    const pressure = this.randomChoice(plot.common_inciting_pressures || ['territorial_dispute']);
    let text = `In ${location.name}, ${PRESSURE_PRETTY[pressure] || pressure} has brought local factions to the brink. `;
    if (cultist) text += `Worse still, the ${cultist.cult.name} have been sighted, moving toward their goal: ${cultist.objective.name}. `;
    text += `The atmosphere is ${location.atmosphere || 'tense'}.`;
    return text;
  }

  // ================================
  // STEP 5: SETUP & EXTRAS
  // ================================
  generateTerrainSetup(plot, location, danger, objectives, cultists) {
    const map = TERRAIN_MAP[plot.id] || { core: [], optional: [], atmosphere: 'Standard Canyon' };
    return {
      atmosphere: map.atmosphere,
      core_terrain: map.core,
      optional_terrain: map.optional,
      objective_markers: objectives.map(o => `${o.name} (${o.target_value} markers)`),
      cultist_markers: cultists ? cultists.markers : [],
      thyr_crystals: danger >= 3 ? `${Math.floor(danger/2) + 1} clusters` : null,
      setup_note: "Standard 3x3 or 4x4 layout."
    };
  }

  getCanyonState(stateId) {
    const state = this.data.canyonStates?.location_states?.find(s => s.id === stateId);
    return state || { name: 'Poisoned', effect: 'Hazardous terrain' };
  }

  generateTwist(danger, location) {
    return this.randomChoice(this.data.twists?.twists || [{ name: 'Heat Wave', effect: 'Reduced movement' }]);
  }

  generateFinale(plot, danger, location, factions) {
    return { name: 'The Final Push', effect: 'Double VP for the last round.' };
  }

  generateName(tags, location) {
    return `The ${this.randomChoice(['Battle', 'Conflict', 'Raid'])} at ${location.name}`;
  }

  generateCoffinCough(location, danger) {
    return danger >= 5 ? { intensity: 'Severe', effect: 'Vision obscured' } : null;
  }

  getDangerDesc(rating) {
    if (rating <= 2) return "Low Danger";
    if (rating <= 4) return "Moderate Danger";
    return "Extreme Danger";
  }

  // ================================
  // UTILS
  // ================================
  randomChoice(arr, count = 1) {
    if (!arr || arr.length === 0) return null;
    if (count === 1) return arr[Math.floor(Math.random() * arr.length)];
    return [...arr].sort(() => 0.5 - Math.random()).slice(0, count);
  }

  weightedChoice(arr) {
    const total = arr.reduce((s, i) => s + (i.weight || 1), 0);
    let r = Math.random() * total;
    for (const i of arr) {
      if (r < (i.weight || 1)) return i;
      r -= (i.weight || 1);
    }
    return arr[0];
  }

  formatResourceName(str) { return str.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' '); }
  getResourceVP(res) { return res === 'thyr' ? 5 : 2; }

  validateScenario(s) {
    return {
      ...s,
      name: s.name || 'Unnamed Scenario',
      narrative_hook: s.narrative_hook || 'A conflict begins.',
      location: {
        name: s.location.name || 'Unknown',
        emoji: s.location.emoji || '🗺️',
        description: s.location.description || '',
        resources: s.location.resources || {},
        hazards: s.location.hazards || []
      },
      terrain_setup: {
        ...s.terrain_setup,
        core_terrain: s.terrain_setup.core_terrain || [],
        objective_markers: s.terrain_setup.objective_markers || []
      }
    };
  }
}
