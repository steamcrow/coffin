// ================================
// SCENARIO BRAIN - FULL VERSION
// with Cultist System + Terrain Map
// ================================

console.log("🧠 Scenario Brain loading...");

// ================================
// CULT REGISTRY — 8 Named Cults
// ================================
const CULT_REGISTRY = [
  { id: 'sons_of_ralu',            name: 'Sons of Ralu',              theme: 'Chaos & Destruction',     color: '#c44569', description: 'Worshippers of RALU, the monster god of chaos. They seek to unleash primal, mindless destruction upon the Canyon.', weight: 8 },
  { id: 'new_children_of_tzul',    name: 'The New Children of Tzul', theme: 'Undead & Ancient Power',   color: '#7b2d8b', description: 'A new cult worshipping the ancient Tzul. They aid and summon the undead, seeking to resurrect their dark masters.', weight: 7 },
  { id: 'burning_choir',           name: 'The Burning Choir',        theme: 'Fire & Purification',     color: '#e84545', description: 'Apocalypse cultists who believe the world must burn to be reborn. Fire is their sacrament.', weight: 6 },
  { id: 'children_of_hollow',      name: 'Children of the Hollow',   theme: 'Void & Madness',          color: '#5a5aaa', description: 'They worship the void between worlds. Their rituals dissolve reality itself.', weight: 5 },
  { id: 'thyr_eaters',             name: 'The Thyr Eaters',          theme: 'Addiction & Consumption',  color: '#daa520', description: 'Addicted to raw Thyr energy. They consume all magic and crystals, growing ever hungrier.', weight: 8 },
  { id: 'blighted_root',           name: 'The Blighted Root',        theme: 'Corrupted Nature',        color: '#4caf50', description: 'Nature corruption cultists. They twist plants and beasts into horrifying, spreading abominations.', weight: 4 },
  { id: 'bone_singers',            name: 'The Bone Singers',         theme: 'Death Magic',             color: '#78909c', description: 'Practitioners of death magic who raise the dead and commune with the grave.', weight: 7 },
  { id: 'regents_faithful',        name: "Regent's Faithful",        theme: 'Dark Monarchy',           color: '#8e24aa', description: "Secret worshippers of a dark monarch. Only appear when The Crow Queen is NOT in the scenario.", weight: 3 }
];

// ================================
// CULT OBJECTIVES — What the cultists are trying to DO
// Each has a turn limit (how long players have to stop them)
// ================================
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

// ================================
// CANYON STATES — Which ones are "pro-cultist"
// Haunted and Exalted are the big ones. Poisoned and Strangewild add a little.
// Liberated and Rusted actually SUPPRESS cultists.
// ================================
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

// ================================
// TERRAIN MAP — Plot types suggest what terrain to place
// "core" = must have. "optional" = nice to have. Scales with danger.
// ================================
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

// ================================
// SCENARIO BRAIN CLASS
// ================================

// ================================
// PRESSURE LABELS — human-readable versions of plotFamily pressure IDs
// ================================
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

// ================================
// CULTIST TERRAIN — what physical markers each cultist objective needs on the table
// ================================
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
  
  // ================================
  // MAIN GENERATOR — assembles the full scenario
  // ================================
  
  async generateCompleteScenario(userSelections) {
    console.log("\n\n🎬 ========================================");
    console.log("    SCENARIO GENERATION START");
    console.log("========================================\n");
    console.log("User selections:", JSON.stringify(userSelections, null, 2));
    
    if (!this.loaded) {
      console.log("⏳ Data not loaded, loading now...");
      await this.loadAllData();
    }
    
    // STEP 1: Location
    console.log("\n📍 STEP 1: LOCATION");
    const location = this.generateLocation(userSelections);
    console.log("✓ Location:", location.name);
    
    // STEP 2: Plot Family
    console.log("\n📖 STEP 2: PLOT FAMILY");
    const plotFamily = this.selectPlotFamily(location, userSelections);
    console.log("✓ Plot Family:", plotFamily.name);
    
    // STEP 3: VP Spread
    console.log("\n🎲 STEP 3: VP SPREAD");
    const vpSpread = this.calculateVPSpread(plotFamily.id, userSelections.dangerRating);
    console.log("✓ VP System Created:", vpSpread.scoring_rule);
    
    // STEP 4: Objectives
    console.log("\n🎯 STEP 4: OBJECTIVES");
    const objectives = this.generateObjectives(plotFamily, location, userSelections, vpSpread);
    console.log(`✓ Generated ${objectives.length} objectives`);
    
    // STEP 5: Victory Conditions
    console.log("\n🏆 STEP 5: VICTORY CONDITIONS");
    const victoryConditions = this.generateVictoryConditions(userSelections, objectives, vpSpread);
    console.log("✓ Victory conditions created");
    
    // STEP 6: Name (narrative comes later — needs cultist data)
    console.log("\n📝 STEP 6: NAME");
    const name = this.generateName(['battle'], location);
    console.log("✓ Name:", name);
    
    // STEP 7: Extras (twist, canyon state, finale)
    console.log("\n🎭 STEP 7: EXTRAS");
    const twist = this.generateTwist(userSelections.dangerRating, location);
    const canyonState = this.getCanyonState(userSelections.canyonState);
    const finale = this.generateFinale(plotFamily, userSelections.dangerRating, location, userSelections.factions);
    console.log("✓ Extras added");
    
    // STEP 8: Cultist Encounter
    console.log("\n👹 STEP 8: CULTIST ENCOUNTER");
    const cultistEncounter = this.generateCultistEncounter(userSelections, plotFamily, location);
    console.log("✓ Cultist check:", cultistEncounter ? `${cultistEncounter.cult.name} APPEARING` : 'No cultists this time');
    
    // STEP 8b: Narrative — now we know if cultists are here
    console.log("\n📝 STEP 8b: NARRATIVE");
    const narrative = this.generateNarrative(plotFamily, location, userSelections, cultistEncounter);
    console.log("✓ Narrative written");
    
    // STEP 9: Terrain Setup — needs objectives + cultist encounter for markers
    console.log("\n🏜️ STEP 9: TERRAIN SETUP");
    const terrainSetup = this.generateTerrainSetup(plotFamily, location, userSelections.dangerRating, objectives, cultistEncounter);
    console.log("✓ Terrain setup generated");
    
    // STEP 10: Coffin Cough Storm
    console.log("\n☠️ STEP 10: COFFIN COUGH STORM");
    const coffinCough = this.generateCoffinCough(location, userSelections.dangerRating);
    console.log("✓ Coffin Cough:", coffinCough ? 'STORM INCOMING' : 'Clear skies');
    
    // ================================
    // ASSEMBLE FINAL SCENARIO
    // ================================
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
      canyon_state: canyonState,
      twist: twist,
      finale: finale,
      cultist_encounter: cultistEncounter,
      terrain_setup: terrainSetup,
      coffin_cough: coffinCough
    };
    
    console.log("\n✅ SCENARIO GENERATION COMPLETE\n");
    return this.validateScenario(scenario);
  }
  
  // Validation ensures all required fields exist
  validateScenario(scenario) {
    const validated = {
      name: scenario.name || 'Unnamed Scenario',
      narrative_hook: scenario.narrative_hook || 'A conflict in the Canyon.',
      danger_rating: scenario.danger_rating || 3,
      danger_description: scenario.danger_description || 'Standard danger',
      location: scenario.location || { name: 'Unknown Location', description: 'A place in the Canyon' },
      canyon_state: scenario.canyon_state || { name: 'Poisoned', effect: 'Standard Canyon state' },
      factions: scenario.factions || [],
      objectives: scenario.objectives || [],
      victory_conditions: scenario.victory_conditions || {},
      twist: scenario.twist || null,
      finale: scenario.finale || null,
      terrain_setup: scenario.terrain_setup || { core_terrain: [], optional_terrain: [] },
      coffin_cough: scenario.coffin_cough || null,
      cultist_encounter: scenario.cultist_encounter || null,
      monster_pressure: scenario.monster_pressure || null
    };
    
    // Ensure location has required fields
    if (validated.location) {
      validated.location = {
        name: validated.location.name || 'Unknown',
        description: validated.location.description || '',
        emoji: validated.location.emoji || '🗺️',
        atmosphere: validated.location.atmosphere || null,
        resources: validated.location.resources || {},
        hazards: validated.location.hazards || []
      };
    }
    
    // Ensure terrain_setup has required fields
    if (validated.terrain_setup) {
      validated.terrain_setup = {
        atmosphere: validated.terrain_setup.atmosphere || '',
        core_terrain: validated.terrain_setup.core_terrain || [],
        optional_terrain: validated.terrain_setup.optional_terrain || [],
        objective_markers: validated.terrain_setup.objective_markers || [],
        cultist_markers: validated.terrain_setup.cultist_markers || [],
        thyr_crystals: validated.terrain_setup.thyr_crystals || null,
        setup_note: validated.terrain_setup.setup_note || 'Standard terrain setup.'
      };
    }
    
    return validated;
  }
  
  // ================================
  // LOCATION (STEP 1)
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
    if (!location.resources) location.resources = {};
    if (!location.hazards) location.hazards = [];
    if (!location.terrain_features) location.terrain_features = [];
    if (!location.rewards) location.rewards = [];
    return location;
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
      atmosphere: this.randomChoice(type.atmosphere || ["Tension hangs heavy in the air", "The wind carries whispers of conflict"]),
      resources: type.resources || {},
      hazards: type.environmental_hazards || [],
      terrain_features: type.terrain_features || [],
      rewards: type.rewards || [],
      procedural: true
    };
  }
  
  // ================================
  // PLOT FAMILY (STEP 2)
  // ================================
  
  selectPlotFamily(location, userSelections) {
    if (!this.data.plotFamilies?.plot_families) {
      console.error("⚠️ No plot families loaded! Using emergency plot.");
      return this.getEmergencyPlot();
    }
    
    const plots = this.data.plotFamilies.plot_families;
    let bestPlot = plots[0];
    let maxScore = 0;
    
    plots.forEach(plot => {
      let score = 0;
      
      if (location.resources && plot.primary_resources) {
        plot.primary_resources.forEach(res => {
          if (location.resources[res] && location.resources[res] > 0) {
            score += 3;
          }
        });
      }
      
      if (location.type_ref) {
        if (location.type_ref.includes('fortress') && plot.id === 'siege_standoff') score += 4;
        if (location.type_ref.includes('pass') && plot.id === 'escort_run') score += 4;
        if (location.type_ref.includes('ruins') && plot.id === 'ambush_derailment') score += 4;
        if (location.type_ref.includes('mine') && plot.id === 'extraction_heist') score += 4;
      }
      
      userSelections.factions.forEach(faction => {
        if (faction.id === 'monster_rangers' && plot.id === 'corruption_ritual') score += 3;
        if (faction.id === 'liberty_corps' && plot.id === 'claim_and_hold') score += 2;
        if (faction.id === 'shine_riders' && (plot.id === 'extraction_heist' || plot.id === 'sabotage_strike')) score += 2;
      });
      
      if (score > maxScore) {
        maxScore = score;
        bestPlot = plot;
      }
    });
    
    console.log(`Matched: ${bestPlot.name} (score: ${maxScore})`);
    return bestPlot;
  }
  
  getEmergencyPlot() {
    return {
      id: 'claim_and_hold',
      name: 'Claim and Hold',
      description: 'Control territory',
      default_objectives: ['land_marker', 'command_structure', 'fortified_position'],
      primary_resources: ['food', 'water'],
      escalation_bias: ['environmental_hazard'],
      aftermath_bias: ['location_state_change'],
      common_inciting_pressures: ['territorial_dispute']
    };
  }
  
  // ================================
  // VP SPREAD (STEP 3)
  // ================================
  
  calculateVPSpread(plotId, danger) {
    const target = 10 + (danger * 2);
    
    const systems = {
      'extraction_heist':            { primary: 'Items Extracted',    pVal: 3, bonus: 'Speed Bonus',        bVal: 1 },
      'claim_and_hold':              { primary: 'Rounds Controlled',  pVal: 2, bonus: 'Consecutive Control', bVal: 3 },
      'ambush_derailment':           { primary: 'Crates Salvaged',    pVal: 2, bonus: 'Wreckage Secured',    bVal: 5 },
      'siege_standoff':              { primary: 'Rounds Survived',    pVal: 3, bonus: 'Elite Kills',         bVal: 2 },
      'escort_run':                  { primary: 'Distance Traveled',  pVal: 1, bonus: 'Cargo Intact',        bVal: 5 },
      'corruption_ritual':           { primary: 'Rituals Complete',   pVal: 4, bonus: 'Disruptions',         bVal: 3 },
      'natural_disaster_response':   { primary: 'Units Evacuated',    pVal: 2, bonus: 'Resources Saved',     bVal: 3 },
      'sabotage_strike':             { primary: 'Systems Disabled',   pVal: 3, bonus: 'Stealth Bonus',       bVal: 2 }
    };
    
    const sys = systems[plotId] || { primary: 'Objectives Complete', pVal: 2, bonus: 'Enemy Eliminated', bVal: 1 };
    
    return {
      target_to_win: target,
      scoring_rule: `${sys.pVal} VP per ${sys.primary}`,
      bonus_rule: `${sys.bVal} VP per ${sys.bonus}`,
      formula: `(${sys.primary} × ${sys.pVal}) + (${sys.bonus} × ${sys.bVal})`,
      thresholds: {
        minor_victory: Math.floor(target * 0.6),
        major_victory: target,
        legendary_victory: Math.floor(target * 1.5)
      },
      ticker: {
        primary_label: sys.primary,
        primary_per_vp: sys.pVal,
        bonus_label: sys.bonus,
        bonus_per_vp: sys.bVal
      }
    };
  }

  // ================================
  // OBJECTIVES (STEP 4)
  // ================================
  
  generateObjectives(plotFamily, location, userSelections, vpSpread) {
    const objectives = [];
    const danger = userSelections.dangerRating;
    const usedTypes = new Set();
    
    console.log("  Starting objective generation...");
    
    // STEP 4.1: Plot-Specific Objectives
    if (plotFamily.default_objectives && plotFamily.default_objectives.length > 0) {
      const plotObjectives = this.randomChoice(plotFamily.default_objectives, Math.min(2, plotFamily.default_objectives.length));
      plotObjectives.forEach(objType => {
        const obj = this.buildObjective(objType, location, danger, vpSpread);
        if (obj) {
          objectives.push(obj);
          usedTypes.add(objType);
        }
      });
    }
    
    // STEP 4.2: Resource-Based Objectives
    if (location.resources) {
      const highValueResources = Object.entries(location.resources)
        .filter(([key, val]) => val >= 2)
        .map(([key]) => key);
      
      if (highValueResources.length > 0 && !usedTypes.has('resource_extraction')) {
        const resource = this.randomChoice(highValueResources);
        const amount = location.resources[resource];
        const prettyName = this.formatResourceName(resource);
        objectives.push({
          name: `Extract ${prettyName}`,
          description: `Secure valuable ${prettyName.toLowerCase()} stockpile from ${location.name}`,
          type: 'resource_extraction',
          target_value: Math.min(amount, danger + 2),
          progress_label: prettyName,
          vp_per_unit: this.getResourceVP(resource),
          max_vp: Math.min(amount, danger + 2) * this.getResourceVP(resource)
        });
        usedTypes.add('resource_extraction');
      }
    }
    
    // STEP 4.3: Fill with General Conflict Objectives (no duplicates)
    const generalObjectives = ['scattered_crates', 'wrecked_engine', 'land_marker', 'fortified_position', 'stored_supplies'];
    const numToFill = Math.max(1, 4 - objectives.length);

    for (let i = 0; i < numToFill && generalObjectives.length > 0; i++) {
      const availableTypes = generalObjectives.filter(t => !usedTypes.has(t));
      if (availableTypes.length === 0) break;
      
      const objType = this.randomChoice(availableTypes);
      const obj = this.buildObjective(objType, location, danger, vpSpread);
      if (obj) {
        objectives.push(obj);
        usedTypes.add(objType);
      }
    }
    
    return objectives;
  }
  
  buildObjective(type, location, danger, vpSpread) {
    const templates = {
      'wrecked_engine':      { name: 'Salvage Wrecked Engine',     desc: 'Extract mechanical components from abandoned machinery.',   target: Math.min(3, danger), label: 'Components', vp: 3 },
      'scattered_crates':    { name: 'Recover Supply Crates',      desc: 'Collect scattered supply crates across the battlefield.',    target: danger + 1,          label: 'Crates',     vp: 2 },
      'ritual_circle':       { name: 'Control Ritual Site',        desc: 'Maintain control of the ritual circle to channel its power.',target: danger,              label: 'Rituals',    vp: 4 },
      'land_marker':         { name: 'Establish Territory',        desc: 'Plant territorial markers and hold them.',                   target: 3,                   label: 'Rounds',     vp: vpSpread.ticker.primary_per_vp },
      'fortified_position':  { name: 'Hold Fortified Position',    desc: 'Maintain control of the defensive structure.',              target: 3,                   label: 'Rounds',     vp: vpSpread.ticker.primary_per_vp },
      'stored_supplies':     { name: 'Raid Supply Depot',          desc: 'Extract stockpiled goods from the depot.',                  target: danger + 1,          label: 'Supplies',   vp: 2 },
      'artifact':            { name: 'Recover Ancient Artifact',   desc: 'Secure mysterious artifact of unknown power.',              target: 1,                   label: 'Artifact',   vp: 8 },
      'tainted_ground':      { name: 'Cleanse Tainted Ground',     desc: 'Purify corrupted territory.',                               target: Math.max(2, danger - 1), label: 'Sites Cleansed', vp: 4 }
    };
    
    const t = templates[type];
    if (!t) return null;
    
    return {
      name: t.name,
      description: t.desc,
      type: type,
      target_value: t.target,
      progress_label: t.label,
      vp_per_unit: t.vp,
      max_vp: t.target * t.vp
    };
  }

  getResourceVP(resource) {
    const rates = {
      'thyr': 4,
      'tzul_silver': 4,
      'weapons': 3,
      'mechanical_parts': 3,
      'gildren': 3,
      'livestock': 2,
      'food': 2,
      'water': 2,
      'food_good': 2,
      'water_clean': 2,
      'coal': 2,
      'silver': 2,
      'lead': 2,
      'supplies': 2,
      'food_foul': 1,  // corrupted resources worth less
      'water_foul': 1
    };
    return rates[resource] || 2;
  }

  // ================================
  // VICTORY CONDITIONS (STEP 5)
  // ================================

  generateVictoryConditions(userSelections, objectives, vpSpread) {
    const conditions = {};
    
    userSelections.factions.forEach(faction => {
      const factionObjectives = [];
      
      // Map global objectives to faction-specific flavor/rules
      objectives.forEach(obj => {
        const interpretation = this.getFactionObjectiveInterpretation(faction.id, obj);
        if (interpretation) factionObjectives.push(interpretation);
      });
      
      // Add the Unique Faction Grand Goal
      const unique = this.generateUniqueFactionObjective(faction.id, userSelections.dangerRating, userSelections.factions);
      if (unique) factionObjectives.push(unique);
      
      conditions[faction.id] = {
        target_vp: vpSpread.target_to_win,
        thresholds: vpSpread.thresholds,
        primary_scoring: vpSpread.scoring_rule,
        bonus_scoring: vpSpread.bonus_rule,
        faction_objectives: factionObjectives,
        aftermath: this.generateFactionAftermath(faction.id),
        objectives: objectives.map(obj => ({
          name: obj.name,
          ticker: `${obj.progress_label}: ${obj.vp_per_unit} VP each`
        }))
      };
    });
    
    return conditions;
  }

  getFactionObjectiveInterpretation(factionId, objective) {
    const library = {
      'monster_rangers': {
        'ritual_circle':    { goal: 'Stabilize the land via ritual.',         method: 'Dark Librarian gains +1 die to ritual actions.',    scoring: '+4 VP per ritual' },
        'scattered_crates': { goal: 'Distribute supplies to refugees.',       method: 'Escort crates to civilians.',                       scoring: '+2 VP per crate',  restriction: 'Harming civilians costs -2 VP' }
      },
      'liberty_corps': {
        'ritual_circle':    { goal: 'Assert federal control over site.',      method: 'Establish barriers and patrols.',                   scoring: '+4 VP per site controlled' },
        'scattered_crates': { goal: 'Confiscate contraband as evidence.',     method: 'Secure and tag all crates.',                        scoring: '+2 VP per crate',  restriction: 'Must maintain chain of custody' }
      },
      'monsterology': {
        'ritual_circle':    { goal: 'Harvest energies and bound entities.',   method: 'Extraction rigs grant +1 die vs monsters.',        scoring: '+4 VP per extraction' },
        'tainted_ground':   { goal: 'Strip the Taint for reagents.',         method: 'Deploy Taint collectors.',                          scoring: '+4 VP per site',   restriction: 'Extracted land cannot be restored' }
      },
      'crow_queen': {
        'land_marker':      { goal: 'Mark the boundaries of the new kingdom.', method: 'Ladies in Waiting gain +2" move when placing.',  scoring: '+2 VP per marker' },
        'ritual_circle':    { goal: 'Consecrate the ground to the Regent Black.', method: 'Convert site to Consecrated terrain.',         scoring: '+4 VP per site' }
      },
      'shine_riders': {
        'scattered_crates': { goal: 'Steal valuable goods.',                 method: 'Fast extraction with Bikes.',                       scoring: '+2 VP per crate' },
        'stored_supplies':  { goal: 'The legendary heist.',                  method: 'Extract and escape with loot.',                    scoring: '+2 VP per supply' }
      },
      'monsters': {
        'resource_extraction': { goal: 'Consume resources.',                  method: 'Monsters gain +2 VP per resource consumed.', scoring: '+2 VP per resource consumed' },
        'scattered_crates':    { goal: 'Hoard food stores.',                  method: 'Drag crates to Monster den.',                           scoring: '+2 VP per crate hoarded' },
        'land_marker':         { goal: 'Mark territory.',                     method: 'Territorial scent markers.',                            scoring: '+2 VP per marker held' },
        'ritual_circle':       { goal: 'Disrupt human ritual.',               method: 'Monsters can sense magical energies.',                  scoring: '+4 VP per site disrupted' }
      }
    };
    
    const factionMap = library[factionId];
    if (!factionMap || !factionMap[objective.type]) return null;
    
    return {
      name: objective.name,
      ...factionMap[objective.type]
    };
  }

  generateUniqueFactionObjective(factionId, danger, allFactions) {
    const uniques = {
      'monster_rangers': { name: 'Minimize Casualties',         goal: 'Protect monsters and civilians.',                  method: 'Escort non-combatants to safety.',          scoring: `${danger * 2} VP minus deaths` },
      'liberty_corps':   { name: 'Establish Authority',         goal: 'Hold the center of the board.',                    method: 'Maintain control for 3 rounds.',            scoring: `${danger * 2} VP if held at end` },
      'monsterology':    { name: 'Total Extraction Protocol',   goal: 'Exploit every site.',                              method: 'Extract from all objectives.',              scoring: `${danger * 3} VP if all extracted` },
      'shine_riders':    { name: 'Legendary Heist',             goal: 'Steal the most valuable prize.',                   method: 'Extract highest-value objective and escape.',scoring: `${danger * 3} VP if escaped` },
      'crow_queen':      { name: 'Divine Mandate',              goal: 'Force enemies to kneel.',                          method: 'Break enemy morale with Fear.',             scoring: `${danger * 2} VP per enemy unit Broken` }
    };
    
    // MONSTERS - context-aware objectives
    if (factionId === 'monsters') {
      const humanFactions = allFactions.filter(f => f.id !== 'monsters' && f.id !== 'crow_queen');
      
      if (humanFactions.length === 0) {
        // No humans = territorial fight
        return {
          name: 'Territorial Supremacy',
          goal: 'Drive out all intruders.',
          method: 'Eliminate enemy leaders and hold ground.',
          scoring: `${danger * 2} VP per enemy faction broken`
        };
      } else {
        // Humans present = purge them
        return {
          name: 'Drive Out Invaders',
          goal: 'Purge humans from the Canyon.',
          method: 'Eliminate enemy leaders.',
          scoring: `${danger * 2} VP per human faction broken`
        };
      }
    }
    
    return uniques[factionId] || null;
  }

  generateFactionAftermath(factionId) {
    const aftermaths = {
      'monster_rangers': { immediate_effect: 'The land begins to heal.',              canyon_state_change: 'Territory becomes Restored.',  long_term: 'Monster populations stabilize.',      flavor: 'The Rangers have bought time, but the Canyon never forgets.' },
      'liberty_corps':   { immediate_effect: 'Federal presence increases.',          canyon_state_change: 'Territory becomes Occupied.',  long_term: 'Trade routes secure, but tension rises.', flavor: 'Order has been imposed. The question is: for how long?' },
      'monsterology':    { immediate_effect: 'The site is stripped bare.',           canyon_state_change: 'Territory becomes Depleted.',  long_term: 'Resource scarcity increases.',         flavor: 'Progress has a price, paid in full by the land itself.' },
      'shine_riders':    { immediate_effect: 'Valuables vanish into the night.',     canyon_state_change: 'Territory becomes Lawless.',   long_term: 'Crime and opportunity intertwine.',    flavor: 'The Riders leave only dust and legend behind.' },
      'crow_queen':      { immediate_effect: 'Dark banners rise.',                   canyon_state_change: 'Territory becomes Consecrated.', long_term: 'The Regent\'s influence spreads.',   flavor: 'All who remain know: the Queen is watching.' },
      'monsters':        { immediate_effect: 'Humans retreat in fear.',              canyon_state_change: 'Territory becomes Wild.',      long_term: 'The Canyon reclaims its own.',         flavor: 'Nature is not kind. It simply is.' }
    };
    return aftermaths[factionId] || {
      immediate_effect: 'The battle ends.',
      canyon_state_change: 'Territory status unchanged.',
      long_term: 'The struggle continues.',
      flavor: 'Another skirmish in an endless war.'
    };
  }

  // ================================
  // NAME & NARRATIVE (STEP 6)
  // ================================

  generateName(tags, location) {
    if (!this.data.names) return `The Battle at ${location.name}`;
    
    const prefixes = this.data.names.prefixes || ["Skirmish at", "Battle of", "Conflict at"];
    const suffixes = this.data.names.suffixes || ["Pass", "Ridge", "Crossing"];
    const descriptors = this.data.names.descriptors || ["Bloody", "Desperate", "Final"];
    
    // Extract strings if they're objects (some name data uses {text, tags} format)
    const getTextValue = (item) => {
      if (typeof item === 'string') return item;
      if (item && typeof item === 'object' && item.text) return item.text;
      return String(item);
    };
    
    const prefix = getTextValue(this.randomChoice(prefixes));
    const suffix = getTextValue(this.randomChoice(suffixes));
    const descriptor = getTextValue(this.randomChoice(descriptors));

    const styles = [
      `${prefix} ${location.name}`,
      `The ${descriptor} ${suffix} of ${location.name}`,
      `${location.name}: ${descriptor} Stand`
    ];
    
    return this.randomChoice(styles);
  }

    generateNarrative(plotFamily, location, userSelections, cultistEncounter) {
    const names = userSelections.factions.map(f => f.name);
    const factions = names.length <= 2 
      ? names.join(' and ') 
      : names.slice(0, -1).join(', ') + ', and ' + names[names.length - 1];
    
    // If cultists are present, lead with their plot
    if (cultistEncounter && cultistEncounter.enabled) {
      const context = {
        location: location.name,
        cult: cultistEncounter.cult.name,
        objective: cultistEncounter.objective.description,
        factions: factions
      };
      
      const cultNarratives = [
        '{location} was quiet until the {cult} arrived. {objective} {factions} have stumbled into something they weren\'t prepared for.',
        'The {cult} chose {location} for a reason. {objective} {factions} showed up at the worst possible time.',
        '{objective} The {cult} have been working in secret at {location}. {factions} are about to interrupt them.'
      ];
      
      const template = this.randomChoice(cultNarratives);
      return this.parseTemplate(template, context);
    }
    
    // PLOT-DRIVEN NARRATIVES with template parsing
    const context = { location: location.name, factions: factions };
    
    const plotNarratives = {
      'extraction_heist': () => {
        const resources = location.resources ? Object.keys(location.resources).filter(r => location.resources[r] > 0) : [];
        const resource = resources.length > 0 ? this.formatResourceName(this.randomChoice(resources)) : 'valuable cargo';
        context.resource = resource.toLowerCase();
        return this.parseTemplate('{location} sits on a cache of {resource}. Word got out. {factions} all want it, and none of them are walking away empty-handed.', context);
      },
      
      'ambush_derailment': () => {
        return this.parseTemplate('The rails through {location} are a critical supply line. {factions} know that whoever controls the rails controls the flow of weapons, food, and power in this part of the Canyon. Someone\'s about to derail that.', context);
      },
      
      'claim_and_hold': () => {
        return this.parseTemplate('{location} has changed hands three times in the last year. {factions} are here to make sure the fourth time is permanent. Nobody\'s leaving until the question is settled.', context);
      },
      
      'corruption_ritual': () => {
        return this.parseTemplate('Something ancient sleeps beneath {location}. {factions} are about to wake it up — whether they mean to or not. The ground is already starting to crack.', context);
      },
      
      'siege_standoff': () => {
        return this.parseTemplate('The fortifications at {location} have held for weeks. {factions} are done waiting. Someone breaks through today, or everyone starves tomorrow.', context);
      },
      
      'escort_run': () => {
        const cargo = location.resources && Object.keys(location.resources).length > 0 ? 'critical cargo' : 'people who can\'t defend themselves';
        context.cargo = cargo.charAt(0).toUpperCase() + cargo.slice(1);
        return this.parseTemplate('{cargo} needs to cross {location}. {factions} all have different ideas about where it ends up. The crossing is the killing ground.', context);
      },
      
      'sabotage_strike': () => {
        return this.parseTemplate('{location} is infrastructure. Blow it, and supply lines collapse for a hundred miles. {factions} are racing to either destroy it or defend it. The charges are already placed.', context);
      },
      
      'natural_disaster_response': () => {
        return this.parseTemplate('{location} is tearing itself apart. {factions} are here to save what they can — or loot what\'s left. The Canyon doesn\'t care which.', context);
      }
    };
    
    const narrative = plotNarratives[plotFamily.id];
    return narrative ? narrative() : this.parseTemplate('{factions} have collided at {location}. The fight starts now.', context);
  }

  // ================================
  // EXTRAS (STEP 7)
  // ================================

  generateTwist(danger, location) {
    if (!this.data.twists?.twists) {
      return { name: "Unpredictable Winds", description: "The canyon winds shift without warning.", effect: "-1 to Ranged attacks.", example: null };
    }
    
    // Check for resource corruption twist first (30% chance if applicable)
    if (location && Math.random() < 0.3) {
      const corruptionTwist = this.checkResourceCorruption(location);
      if (corruptionTwist) return corruptionTwist;
    }
    
    // Filter by danger range
    let pool = this.data.twists.twists.filter(t => {
      if (t.danger_floor && danger < t.danger_floor) return false;
      if (t.danger_ceiling && danger > t.danger_ceiling) return false;
      return true;
    });
    if (pool.length === 0) pool = this.data.twists.twists;
    
    const twist = this.weightedRandomChoice(pool);
    
    // Pick one example so players know what this looks like in play
    const example = twist.example_outcomes && twist.example_outcomes.length > 0
      ? this.randomChoice(twist.example_outcomes)
      : null;
    
    return {
      name: twist.name,
      description: twist.description,
      effect: twist.mechanical_effect || twist.effect || "Unknown effect.",
      example: example
    };
  }
  
  checkResourceCorruption(location) {
    if (!location.resources) return null;
    
    const corruptible = [];
    if (location.resources.food > 0 || location.resources.food_good > 0) {
      corruptible.push({
        name: 'Poisoned Supplies',
        description: 'The food stockpile has been compromised.',
        effect: 'All Food resources are actually Foul Food. Models consuming them must test against Poison.',
        example: 'What looked like fresh rations is crawling with Coffin Cough spores.'
      });
    }
    if (location.resources.water > 0 || location.resources.water_clean > 0) {
      corruptible.push({
        name: 'Tainted Water',
        description: 'The water supply is contaminated.',
        effect: 'All Water resources are actually Foul Water. Models drinking it suffer -1 Stamina until treated.',
        example: 'The well looked clean. It wasn\'t.'
      });
    }
    if (location.resources.mechanical_parts > 0) {
      corruptible.push({
        name: 'Sabotaged Components',
        description: 'Someone rigged the machinery.',
        effect: 'Mechanical Parts have a 50% chance to explode when salvaged (1d6 damage to salvager).',
        example: 'The gears were fine. The explosive charge hidden inside them was not.'
      });
    }
    
    return corruptible.length > 0 ? this.randomChoice(corruptible) : null;
  }

  getCanyonState(stateId) {
    if (!this.data.canyonStates?.canyon_states) return { name: "Poisoned", effect: "The Canyon's default state. Toxic air, poisoned water, corrupted soil." };
    const state = this.data.canyonStates.canyon_states.find(s => s.id === stateId);
    return state || { name: "Unknown State", effect: "Standard rules apply." };
  }

    generateFinale(plotFamily, danger, location, factions) {
    const damage = danger + 1;
    
    // PLOT-SPECIFIC FINALE TEMPLATES
    // Each plot family has themed escalations that reflect what's happening
    const plotFinales = {
      'extraction_heist': [
        {
          title: 'RIVAL EXTRACTORS ARRIVE',
          flavor: 'You weren\'t the only ones with this idea.',
          effect: `Deploy ${damage} hostile NPC models. They attack whoever is winning.`,
          ticker: '×2 VP',
          player_note: 'New enemies target the leader. If you\'re ahead, prepare for a fight.',
          weight: 10
        },
        {
          title: 'RESOURCE DEPLETION',
          flavor: 'The cache is running dry.',
          effect: `Halve all remaining resource values. First to extract gets full points.`,
          ticker: '÷2 VP',
          player_note: 'Rush objectives now. Waiting means they\'re worth less.',
          weight: 5
        }
      ],
      'ambush_derailment': [
        {
          title: 'THE RAIL EXPLODES',
          flavor: 'Someone rigged the tracks.',
          effect: `All models within 6" of rails take ${damage} dice damage. Rails become Impassable.`,
          ticker: '×2 VP',
          player_note: 'Get away from the rails before Round 6. Cargo near rails is lost.',
          weight: 8
        },
        {
          title: 'REINFORCEMENT TRAIN',
          flavor: 'Steel screams as the engine arrives.',
          effect: `Each faction deploys ${damage} Grunt units from board edge. VP for kills doubles.`,
          ticker: '×2 VP',
          player_note: 'Both sides get reinforcements. Hold your objectives before the fresh troops arrive.',
          weight: 7
        }
      ],
      'claim_and_hold': [
        {
          title: 'TERRITORIAL DEADLINE',
          flavor: 'The Canyon judges who truly holds this ground.',
          effect: `Only models ON objectives score. All VP values double.`,
          ticker: '×2 VP',
          player_note: 'If you\'re not standing on it at Round 6, it doesn\'t count.',
          weight: 10
        },
        {
          title: 'CONTESTED COLLAPSE',
          flavor: 'The ground rejects your claim.',
          effect: `All contested objectives become Impassable. Uncontested objectives triple VP.`,
          ticker: '×3 VP',
          player_note: 'Secure one fully or lose them all. Split forces = disaster.',
          weight: 4
        }
      ],
      'corruption_ritual': [
        {
          title: 'THE RITUAL COMPLETES',
          flavor: 'The ground cracks open. Something answers.',
          effect: `${location.name} transforms. If ritual wasn\'t stopped, deploy Corrupted entity.`,
          ticker: '×2 VP',
          player_note: 'If nobody disrupted the ritual, a new threat spawns. Position to finish the ritual OR stop it.',
          weight: 9
        },
        {
          title: 'TAINT SPREADS',
          flavor: 'Corruption seeps across the battlefield.',
          effect: `All terrain becomes Tainted. Models on Tainted ground take ${damage - 1} damage per round.`,
          ticker: '÷2 VP',
          player_note: 'Standing still kills you. Keep moving or find Clean ground.',
          weight: 6
        }
      ]
    };
    
    // Get plot-specific finales, or use generic escalation
    let finalePool = plotFinales[plotFamily.id];
    
    // Filter finales based on which factions are playing
    if (finalePool && finalePool.length > 0 && factions) {
      const factionIds = factions.map(f => f.id);
      const hasHumans = factionIds.some(id => id !== 'monsters' && id !== 'crow_queen');
      const hasMachines = factionIds.some(id => id === 'liberty_corps' || id === 'monsterology');
      
      finalePool = finalePool.filter(finale => {
        // "REINFORCEMENT TRAIN" only works if someone operates trains
        if (finale.title === 'REINFORCEMENT TRAIN') {
          return hasMachines || hasHumans;
        }
        // All other finales work for everyone
        return true;
      });
    }
    
    if (!finalePool || finalePool.length === 0) {
      // Fallback to danger-based generic finales
      finalePool = [
        {
          title: 'THE CANYON REJECTS YOU',
          flavor: 'The very earth begins to buckle.',
          effect: `All units take ${damage} dice of environmental damage. VP for surviving units doubles.`,
          ticker: '×2 VP',
          player_note: 'Every unit on the table takes damage simultaneously. Keep your strongest models alive — they score double.'
        },
        {
          title: 'NO SURRENDER',
          flavor: 'The local factions commit everything they have.',
          effect: `Deploy extra Grunt units for every faction. VP for kills doubles.`,
          ticker: '×2 VP',
          player_note: 'Both sides get more bodies. Don\'t overextend before Round 6 — you\'ll be outnumbered.'
        }
      ];
    }
    
    const finale = this.weightedRandomChoice(finalePool);
    
    return {
      round: 6,
      title: finale.title,
      narrative: finale.flavor,
      mechanical_effect: finale.effect,
      ticker_effect: finale.ticker,
      player_note: finale.player_note,
      escalation_type: plotFamily.id
    };
  }

  // ================================
  // CULTIST ENCOUNTER (STEP 8) — NEW!
  // Decides IF cultists appear, WHICH cult, WHAT they want, WHO plays them
  // ================================

  generateCultistEncounter(userSelections, plotFamily, location) {
    const danger = userSelections.dangerRating;
    const canyonStateId = userSelections.canyonState || 'poisoned';
    
    // BASE CHANCE by danger rating
    let baseChance = 0;
    if (danger <= 2) baseChance = 0.05;       // 5%  — very rare at low danger
    else if (danger === 3) baseChance = 0.10; // 10%
    else if (danger === 4) baseChance = 0.20; // 20%
    else if (danger === 5) baseChance = 0.45; // 45% — user-requested
    else if (danger >= 6)  baseChance = 0.65; // 65% — user-requested
    
    // ALWAYS appear for ritual/corruption plot types
    const alwaysCultPlots = ['corruption_ritual'];
    if (alwaysCultPlots.includes(plotFamily.id)) {
      baseChance = 1.0;
    }
    
    // CANYON STATE modifier (haunted/exalted boost, liberated/rusted suppress)
    const stateModifier = CULTIST_STATE_MODIFIERS[canyonStateId]?.modifier || 0;
    const finalChance = Math.min(1.0, Math.max(0, baseChance + stateModifier));
    
    console.log(`  Cultist check: base=${baseChance}, state_mod=${stateModifier}, final=${finalChance.toFixed(2)}`);
    
    // THE ROLL
    if (Math.random() > finalChance) {
      return null; // No cultists this scenario
    }
    
    // ===== CULTISTS APPEAR =====
    console.log("  🔥 CULTISTS ARE COMING");
    
    // Pick a cult — filter out Regent's Faithful if Crow Queen is playing
    let availableCults = [...CULT_REGISTRY];
    const hasCrowQueen = userSelections.factions.some(f => f.id === 'crow_queen');
    if (hasCrowQueen) {
      availableCults = availableCults.filter(c => c.id !== 'regents_faithful');
    }
    
    const selectedCult = this.weightedRandomChoice(availableCults);
    
    // Pick objective — prefer one that MATCHES this cult's affinity
    const matchingObjectives = CULT_OBJECTIVES.filter(o => o.cult_affinity.includes(selectedCult.id));
    const objective = matchingObjectives.length > 0 
      ? this.randomChoice(matchingObjectives) 
      : this.randomChoice(CULT_OBJECTIVES);
    
    // FORCE SIZE — kept small and manageable!
    // danger 3-4: 2-3 models, danger 5: 3-4 models, danger 6: 4-5 models
    let forceMin, forceMax;
    if (danger <= 3)      { forceMin = 2; forceMax = 3; }
    else if (danger === 4){ forceMin = 2; forceMax = 4; }
    else if (danger === 5){ forceMin = 3; forceMax = 4; }
    else                  { forceMin = 4; forceMax = 5; }
    
    const actualForce = forceMin + Math.floor(Math.random() * (forceMax - forceMin + 1));
    
    // WHO PLAYS THEM?
    // If multiplayer with 2+ player factions, one of them runs the cultists (rotates each round).
    // If solo or only 1 player faction, the Game Warden or the other NPC faction runs them.
    const playerFactions = userSelections.factions.filter(f => !f.isNPC);
    const allFactions = userSelections.factions;
    
    let controllerNote = '';
    let controllerFaction = null;
    
    if (playerFactions.length >= 2) {
      // Multiplayer: assign to a random player faction to START, then it rotates
      controllerFaction = this.randomChoice(playerFactions);
      controllerNote = `${controllerFaction.name} controls the cultists first. Control rotates to the next player each round.`;
    } else if (playerFactions.length === 1) {
      // Solo or 1-player: assign to an NPC faction, or Game Warden handles it
      const npcs = allFactions.filter(f => f.isNPC);
      if (npcs.length > 0) {
        controllerFaction = this.randomChoice(npcs);
        controllerNote = `${controllerFaction.name} (NPC) plays the cultists. Their controller handles cultist moves.`;
      } else {
        controllerNote = 'Game Warden controls the cultists.';
      }
    } else {
      controllerNote = 'Game Warden controls the cultists.';
    }
    
    return {
      enabled: true,
      cult: {
        id: selectedCult.id,
        name: selectedCult.name,
        theme: selectedCult.theme,
        color: selectedCult.color,
        description: selectedCult.description
      },
      objective: {
        id: objective.id,
        name: objective.name,
        description: objective.description,
        turn_limit: objective.turn_limit,
        win_condition: objective.win_condition,
        counter: objective.counter
      },
      force_size: actualForce,
      controller: controllerFaction ? { id: controllerFaction.id, name: controllerFaction.name } : null,
      controller_note: controllerNote,
      everyone_loses: true,
      state_modifier_used: stateModifier,
      chance_that_was_rolled: parseFloat(finalChance.toFixed(2))
    };
  }
  
  // ================================
  // COFFIN COUGH STORM (STEP 10)
  // Location has a coffinCoughChance. Danger rating adds to it.
  // If it fires, we pick one of the 6 effects from the scenario vault.
  // ================================
  
  generateCoffinCough(location, danger) {
    const baseChance = location.coffinCoughChance || 0.10;
    const dangerBonus = Math.max(0, (danger - 3)) * 0.05;
    const finalChance = Math.min(0.95, baseChance + dangerBonus);
    
    console.log(`  Coffin Cough check: base=${baseChance}, danger_bonus=${dangerBonus.toFixed(2)}, final=${finalChance.toFixed(2)}`);
    
    if (Math.random() > finalChance) {
      console.log("  No Coffin Cough this time.");
      return null;
    }
    
    console.log("  COFFIN COUGH IS COMING");
    
    const effects = [
      { name: 'Rolling Coffin Cough',  effects: ['Place a 6" radius Choking zone touching any board edge.', 'At the end of each round, it drifts 3" in a direction chosen by the Warden.'] },
      { name: 'Ashfall',               effects: ['All models suffer -1 die on ranged attacks until end of next round.', 'Burning terrain automatically escalates.'] },
      { name: 'Visibility Collapse',   effects: ['Line of Sight beyond 12" is blocked until end of next round.', 'Fog blocks clarity and intent, not movement.'] },
      { name: 'Panic on the Wind',     effects: ['All models must test Morale at the start of their next activation.'] },
      { name: 'Dead Ground',           effects: ["One heavily contested terrain feature becomes Haunted or Unstable (Warden\'s choice)."] },
      { name: 'Canyon Remembers',      effects: ['All Tainted terrain immediately escalates to Haunted.'] }
    ];
    
    // Pick one — this is fully resolved for the players
    const picked = this.randomChoice(effects);
    
    return {
      active: true,
      effect: picked
    };
  }

  // ================================
  // TERRAIN SETUP (STEP 9) — NEW!
  // Tells the players what terrain to place and where
  // ================================
  
  generateTerrainSetup(plotFamily, location, danger, objectives, cultistEncounter) {
    const baseSetup = TERRAIN_MAP[plotFamily.id] || TERRAIN_MAP['claim_and_hold'];
    
    // Thyr: danger-scaled. 3 at danger 1, up to 12 at danger 6. Always at least 3.
    const thyrCount = Math.min(12, Math.max(3, danger * 2));
    
    // Total terrain pieces scales with danger
    const totalPieces = Math.min(6, 3 + Math.min(danger, 3));
    
    // Objective markers — specific to plot and physical objects
    const objMarkers = objectives ? objectives.map(obj => {
      // Plot-specific marker descriptions
      const plotMarkers = {
        'extraction_heist': {
          'scattered_crates':   `Supply Crates (×${obj.target_value || 3}) - use crate tokens or models`,
          'resource_extraction': `${obj.progress_label} Cache - use appropriate resource tokens`,
          'stored_supplies':    'Locked Supply Depot - 3" building or token'
        },
        'ambush_derailment': {
          'scattered_crates':   `Cargo Crates (×${obj.target_value || 3}) - scattered along rails`,
          'resource_extraction': `${obj.progress_label} in Rail Cars - use cargo tokens`,
          'wrecked_engine':     'Derailed Engine - large wreck model'
        },
        'claim_and_hold': {
          'land_marker':        `Territory Markers (×${obj.target_value || 3}) - faction-specific obelisks/flags`,
          'fortified_position': 'Defensible Structure - bunker, watchtower, or barricade'
        },
        'corruption_ritual': {
          'ritual_circle':      'Ritual Site - 6" circle with runes/stones',
          'tainted_ground':     'Corrupted Ground (×' + (obj.target_value || 2) + ') - 3" zones with taint tokens'
        }
      };
      
      const plotSpecific = plotMarkers[plotFamily.id];
      if (plotSpecific && plotSpecific[obj.type]) {
        return plotSpecific[obj.type];
      }
      
      // Fallback generic markers
      const genericMap = {
        'ritual_circle':      'Ritual Site - 6" circle',
        'tainted_ground':     'Corrupted Ground markers (×' + (obj.target_value || 2) + ')',
        'scattered_crates':   'Supply Crates (×' + (obj.target_value || 3) + ')',
        'land_marker':        'Territory Markers (×' + (obj.target_value || 3) + ') - obelisks or flags',
        'fortified_position': 'Fortified Position - bunker or watchtower',
        'wrecked_engine':     'Wrecked Engine - large terrain piece',
        'stored_supplies':    'Supply Depot - 3" building',
        'artifact':           'Artifact - place on high ground or hidden',
        'resource_extraction': `${obj.progress_label} - use ${obj.progress_label.toLowerCase()} tokens`
      };
      return genericMap[obj.type] || obj.name + ' marker';
    }) : [];
    
    // Cultist markers — if a cult showed up, their objective needs terrain too
    const cultMarkers = cultistEncounter && cultistEncounter.enabled && cultistEncounter.objective
      ? (CULTIST_TERRAIN_MARKERS[cultistEncounter.objective.id] || ['Cultist Objective marker'])
      : [];
    
    return {
      atmosphere: baseSetup.atmosphere,
      core_terrain: baseSetup.core,
      optional_terrain: baseSetup.optional,
      objective_markers: objMarkers,
      cultist_markers: cultMarkers,
      thyr_crystals: { count: thyrCount, placement: 'Scatter across the board. Each model is a cache — when mined, roll for how many crystals are inside.' },
      total_terrain_pieces: totalPieces,
      setup_note: `Place ${totalPieces} terrain pieces total. Core terrain is required. Optional terrain adds cover.`
    };
  }

  // ================================
  // HELPERS & UTILITIES
  // ================================

  getDangerDesc(rating) {
    const levels = [
      'None',
      'Tutorial / Low Escalation', 
      'Frontier Skirmish', 
      'Standard Coffin Canyon', 
      'High Pressure', 
      'Escalation Guaranteed', 
      'Catastrostorm Risk'
    ];
    return levels[rating] || 'Extreme Danger';
  }

  formatResourceName(key) {
    const pretty = {
      'food_foul':      'Foul Food',
      'food_good':      'Good Food',
      'water_foul':     'Foul Water',
      'water_clean':    'Clean Water',
      'mechanical_parts': 'Mechanical Parts',
      'tzul_silver':    'Tzul Silver',
      'thyr':           'Thyr Crystals',
      'livestock':      'Livestock',
      'supplies':       'Supplies',
      'silver':         'Silver',
      'lead':           'Lead',
      'coal':           'Coal',
      'weapons':        'Weapons',
      'food':           'Food',
      'water':          'Water',
      'gildren':        'Gildren'
    };
    return pretty[key] || this.capitalize(key.replace(/_/g, ' '));
  }

  capitalize(str) {
    if (!str) return '';
    return str.charAt(0).toUpperCase() + str.slice(1);
  }

  randomChoice(arr, count = 1) {
    if (!arr || arr.length === 0) return null;
    if (count === 1) return arr[Math.floor(Math.random() * arr.length)];
    
    const shuffled = [...arr].sort(() => 0.5 - Math.random());
    return shuffled.slice(0, count);
  }
  
  // Weighted random selection - items with higher weight are more likely
  weightedRandomChoice(arr) {
    if (!arr || arr.length === 0) return null;
    
    // If array has no weights, treat as equal probability
    const hasWeights = arr.some(item => item.weight !== undefined);
    if (!hasWeights) return this.randomChoice(arr);
    
    const totalWeight = arr.reduce((sum, item) => sum + (item.weight || 1), 0);
    let random = Math.random() * totalWeight;
    
    for (let item of arr) {
      random -= (item.weight || 1);
      if (random <= 0) return item;
    }
    
    return arr[arr.length - 1]; // Fallback
  }
  
  // Template parser - replaces {faction}, {location}, etc with actual values
  parseTemplate(template, context) {
    if (!template) return '';
    return template.replace(/{(\w+)}/g, (match, key) => {
      return context[key] !== undefined ? context[key] : match;
    });
  }
}

// Expose to window
window.ScenarioBrain = ScenarioBrain;
console.log("🎉 SCENARIO BRAIN: Fully assembled and ready!");
