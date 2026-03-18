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

const FACTION_CORE_VERBS = {
  monster_rangers: { primary_verb: 'PROTECT', secondary_verbs: ['PRESERVE', 'STABILIZE', 'DEFEND'], approach: 'defensive' },
  liberty_corps:   { primary_verb: 'CONTROL', secondary_verbs: ['SECURE', 'ENFORCE', 'OCCUPY'], approach: 'authoritarian' },
  monsterology:    { primary_verb: 'DEVOUR',  secondary_verbs: ['HARVEST', 'EXTRACT', 'CONSUME'], approach: 'exploitative' },
  shine_riders:    { primary_verb: 'STEAL',   secondary_verbs: ['LOOT', 'RAID', 'PLUNDER'], approach: 'opportunistic' },
  crow_queen:      { primary_verb: 'CONSECRATE', secondary_verbs: ['CLAIM', 'SANCTIFY', 'CONVERT'], approach: 'mystical' },
  monsters:        { primary_verb: 'BREED',   secondary_verbs: ['FEED', 'NEST', 'MIGRATE'], approach: 'primal' }
};

// ================================
// PRESSURE TRACKS - Cults as Environmental Forces
// ================================
const PRESSURE_TRACKS = {
  'sons_of_ralu': {
    type: 'chaos_escalation', label: 'Chaos Spreading', rate: 1, max: 6, consumes: null,
    thresholds: {
      2: { effect: 'minor_mutations',   desc: 'Strange growths appear on terrain',                          forces_cooperation: false },
      4: { effect: 'major_instability', desc: 'Reality becomes unstable - all terrain Difficult',           forces_cooperation: true  },
      6: { effect: 'catastrophe',       desc: 'Chaos unleashed - location becomes Wild',                    world_scar: 'Wild' }
    },
    visual: 'Chaos corruption markers spread across board',
    player_experience: 'Terrain and units behave unpredictably'
  },
  'new_children_of_tzul': {
    type: 'necromantic_rise', label: 'Undead Rising', rate: 1, max: 6, consumes: null,
    thresholds: {
      2: { effect: 'shambling_dead',  desc: 'Undead servants spawn at burial sites',                      forces_cooperation: false },
      4: { effect: 'tzul_awakening', desc: 'Ancient Tzul warriors rise - hostile to all',                 forces_cooperation: true  },
      6: { effect: 'catastrophe',    desc: 'Tzul King manifests - everyone loses',                        world_scar: 'Haunted' }
    },
    visual: 'Undead models appear at ritual markers',
    player_experience: 'Fighting on two fronts - factions AND undead'
  },
  'burning_choir': {
    type: 'fire_spread', label: 'Flames Spreading', rate: 1, max: 6, consumes: null,
    thresholds: {
      2: { effect: 'smoke_penalty', desc: 'Smoke obscures battlefield - ranged attacks -1 die',           forces_cooperation: false },
      4: { effect: 'inferno',       desc: 'Buildings collapse, terrain destroyed',                        forces_cooperation: true  },
      6: { effect: 'catastrophe',   desc: 'Scorched earth - location becomes Depleted',                   world_scar: 'Scorched' }
    },
    visual: 'Fire tokens spread each round',
    player_experience: 'Shrinking battlefield, forced movement'
  },
  'children_of_hollow': {
    type: 'reality_erosion', label: 'Void Incursion', rate: 1, max: 6, consumes: null,
    thresholds: {
      2: { effect: 'void_whispers',       desc: 'Models must pass Will checks or Act Erratically',        forces_cooperation: false },
      4: { effect: 'dimensional_tears',   desc: 'Random teleportation effects - models displaced',        forces_cooperation: true  },
      6: { effect: 'catastrophe',         desc: 'Reality collapses - location Forbidden',                 world_scar: 'Forbidden' }
    },
    visual: 'Void rifts appear as terrain features',
    player_experience: 'Sanity mechanics, unpredictable board state'
  },
  'thyr_eaters': {
    type: 'resource_consumption', label: 'Thyr Depletion', rate: 1, max: 6, consumes: 'thyr',
    thresholds: {
      2: { effect: 'crystal_dimming',  desc: 'Thyr crystals pulse erratically - magic unreliable',        forces_cooperation: false },
      4: { effect: 'magical_collapse', desc: 'Thyr vein collapsing - all magical abilities -2 dice',      forces_cooperation: true  },
      6: { effect: 'catastrophe',      desc: 'Dead zone - all magic fails, location Depleted',            world_scar: 'Depleted' }
    },
    visual: 'Thyr crystal markers dim and disappear',
    player_experience: 'Resource race - extract before depletion'
  },
  'blighted_root': {
    type: 'corruption_spread', label: 'Blight Spreading', rate: 1, max: 6, consumes: null,
    thresholds: {
      2: { effect: 'tainted_growth',    desc: 'Corrupted plants grow - terrain becomes Difficult',        forces_cooperation: false },
      4: { effect: 'twisted_ecosystem', desc: 'Plants attack models - 2 damage per round in vegetation',  forces_cooperation: true  },
      6: { effect: 'catastrophe',       desc: 'Permanent corruption - location becomes Tainted',          world_scar: 'Tainted' }
    },
    visual: 'Corruption spreads from ritual sites',
    player_experience: 'Safe zones shrink, must keep moving'
  },
  'bone_singers': {
    type: 'death_magic', label: 'Necromantic Power', rate: 1, max: 6, consumes: null,
    thresholds: {
      2: { effect: 'grave_chill',       desc: 'All models -1 to Movement',                                forces_cooperation: false },
      4: { effect: 'mass_resurrection', desc: 'All killed models return as hostile undead',               forces_cooperation: true  },
      6: { effect: 'catastrophe',       desc: 'Death claims all - location becomes Haunted',              world_scar: 'Haunted' }
    },
    visual: 'Killed models remain on board as threats',
    player_experience: 'Cautious combat - kills create problems'
  },
  'regents_faithful': {
    type: 'dark_consecration', label: 'Dark Monarchy Rising', rate: 1, max: 6, consumes: null,
    thresholds: {
      2: { effect: 'whispered_oaths', desc: 'Models must resist Dominated status',                        forces_cooperation: false },
      4: { effect: 'regents_gaze',    desc: 'Regent Black manifests - hostile to all non-Queen factions', forces_cooperation: true  },
      6: { effect: 'catastrophe',     desc: 'Eternal allegiance - location becomes Consecrated',          world_scar: 'Consecrated' }
    },
    visual: 'Dark obelisks rise from ground',
    player_experience: 'Mind control effects, loyalty tests'
  }
};

// ================================
// CANYON STATES — Cultist modifiers
// ================================
const CULTIST_STATE_MODIFIERS = {
  'poisoned':    { modifier: 0.10,  reason: 'Corruption breeds cult activity' },
  'haunted':     { modifier: 0.25,  reason: 'Dark energy draws cultists like moths to flame' },
  'exalted':     { modifier: 0.20,  reason: "The Regent's dark power awakens darker forces" },
  'strangewild': { modifier: 0.10,  reason: 'Feral chaos makes cults bold and reckless' },
  'lawless':     { modifier: 0.05,  reason: 'No law means no one stops the cults' },
  'liberated':   { modifier: -0.15, reason: 'Federal order suppresses cult activity' },
  'extracted':   { modifier: -0.05, reason: 'Stripped wasteland offers little for rituals' },
  'rusted':      { modifier: -0.10, reason: "Machines don't worship gods" },
  'held':        { modifier: 0.0,   reason: 'Controlled territory. Cults are watched.' }
};

// ================================
// TERRAIN MAP
// ================================
const TERRAIN_MAP = {
  'extraction_heist':          { core: ['Mine Entrance', 'Thyr Extraction Rig', 'Supply Crates (×3)'],            optional: ['Quonset Huts', 'Rail Tracks'],           atmosphere: 'Active industrial dig site' },
  'claim_and_hold':            { core: ['Fortified Post', 'Territory Markers (×3)', 'Board Walks'],               optional: ['Ruined Cantina', 'Stilt Buildings'],      atmosphere: 'Contested frontier outpost' },
  'ambush_derailment':         { core: ['Rail Tracks', 'Overpass / Bridge', 'Scattered Crates (×4)'],             optional: ['Stagecoach Ruins', 'Rocky Outcrop'],      atmosphere: 'Remote stretch of rail' },
  'siege_standoff':            { core: ['Fortified Wall', 'Guard Tower', 'Barricades (×2)'],                      optional: ['Quonset Huts', 'Supply Depot'],           atmosphere: 'Fortified position under siege' },
  'escort_run':                { core: ['Trail Path', 'Waypoint Markers (×2)', 'Escort Cargo'],                   optional: ['Monster Den / Nest', 'Bridge Ruins'],     atmosphere: 'Dangerous mountain trail' },
  'sabotage_strike':           { core: ['Thyr Extraction Rig', 'Dynamo', 'Control Panel'],                        optional: ['Quonset Huts', 'Rail Tracks'],            atmosphere: 'Active industrial site. Explosions possible.' },
  'corruption_ritual':         { core: ['Ritual Circle', 'Tainted Ground', 'Ancient Altar'],                      optional: ['Tzul Ruins', 'Strange Plants'],           atmosphere: 'Dark, oppressive, and wrong.' },
  'natural_disaster_response': { core: ['Cracked Ground', 'Collapsing Structure', 'Evacuation Point'],            optional: ['Buried Supplies', 'Unstable Terrain'],    atmosphere: 'Active catastrophe.' }
};

// ================================
// CULTIST TERRAIN MARKERS
// ================================
const CULTIST_TERRAIN_MARKERS = {
  'chaos_escalation':     ['Chaos Corruption Markers (x3)', 'Reality Distortion Zones'],
  'necromantic_rise':     ['Burial Ground', 'Ritual Circle', 'Undead Spawn Points (x2)'],
  'fire_spread':          ['Fire Source Markers (x3)', 'Burning Terrain'],
  'reality_erosion':      ['Void Rift Markers (x2)', 'Dimensional Tear'],
  'resource_consumption': ['Thyr Crystal Cache', 'Consumption Device', 'Depleted Crystal Markers'],
  'corruption_spread':    ['Blight Heart', 'Corrupted Terrain Markers (x3)'],
  'death_magic':          ['Necromantic Focus', 'Grave Sites (x2)', 'Death Magic Circle'],
  'dark_consecration':    ['Dark Obelisks (x3)', 'Consecration Circle']
};

// ================================
// OBJECTIVE BUILDERS
// ================================
const OBJECTIVE_BUILDERS = {
  'wrecked_engine':     (loc, danger, vpSpread)        => ({ name: 'Salvage Wrecked Engine',    description: `Extract mechanical components from abandoned machinery at ${loc.name}.`, target_value: Math.min(3, danger), progress_label: 'Components', vp_per_unit: 3 }),
  'scattered_crates':   (loc, danger, vpSpread)        => ({ name: 'Recover Supply Crates',     description: `Collect scattered supply crates across the battlefield at ${loc.name}.`, target_value: danger + 1,          progress_label: 'Crates',      vp_per_unit: 2 }),
  'ritual_circle':      (loc, danger, vpSpread)        => ({ name: 'Control Ritual Site',       description: `Maintain control of the ritual circle at ${loc.name} to channel its power.`, target_value: danger,          progress_label: 'Rituals',     vp_per_unit: 4 }),
  'land_marker':        (loc, danger, vpSpread)        => ({ name: 'Establish Territory',       description: `Plant territorial markers at ${loc.name} and hold them.`, target_value: 3,                                  progress_label: 'Rounds',      vp_per_unit: vpSpread.ticker.primary_per_vp }),
  'fortified_position': (loc, danger, vpSpread)        => ({ name: 'Hold Fortified Position',   description: `Maintain control of the defensive structure at ${loc.name}.`, target_value: 3,                              progress_label: 'Rounds',      vp_per_unit: vpSpread.ticker.primary_per_vp }),
  'stored_supplies':    (loc, danger, vpSpread)        => ({ name: 'Raid Supply Depot',         description: `Extract stockpiled goods from the depot at ${loc.name}.`, target_value: danger + 1,                          progress_label: 'Supplies',    vp_per_unit: 2 }),
  'artifact':           (loc, danger, vpSpread)        => ({ name: 'Recover Ancient Artifact',  description: `Secure mysterious artifact of unknown power from ${loc.name}.`, target_value: 1,                             progress_label: 'Artifact',    vp_per_unit: 8 }),
  'tainted_ground':     (loc, danger, vpSpread)        => ({ name: 'Cleanse Tainted Ground',    description: `Purify corrupted territory at ${loc.name}.`, target_value: Math.max(2, danger - 1),                         progress_label: 'Sites Cleansed', vp_per_unit: 4 }),
  'resource_extraction':(loc, danger, vpSpread, extra) => ({ name: `Extract ${extra.name}`,     description: `Secure valuable ${extra.name.toLowerCase()} from ${loc.name}.`, target_value: extra.amount,                 progress_label: extra.name,    vp_per_unit: extra.vp })
};

// ================================
// VP SCORING SYSTEMS
// ================================
const VP_SYSTEMS = {
  'extraction_heist':          { primary: 'Items Extracted',    primary_vp: 3, bonus: 'Speed Bonus',          bonus_vp: 1, ticker_primary: 2, ticker_bonus: 1 },
  'claim_and_hold':            { primary: 'Rounds Controlled',  primary_vp: 2, bonus: 'Consecutive Control',  bonus_vp: 3, ticker_primary: 2, ticker_bonus: 2 },
  'corruption_ritual':         { primary: 'Rituals Disrupted',  primary_vp: 4, bonus: 'Taint Cleansed',       bonus_vp: 2, ticker_primary: 4, ticker_bonus: 1 },
  'ambush_derailment':         { primary: 'Cargo Secured',      primary_vp: 3, bonus: 'Ambush Success',       bonus_vp: 2, ticker_primary: 3, ticker_bonus: 1 },
  'siege_standoff':            { primary: 'Defenses Held',      primary_vp: 2, bonus: 'Breach Points',        bonus_vp: 3, ticker_primary: 2, ticker_bonus: 2 },
  'escort_run':                { primary: 'Cargo Delivered',    primary_vp: 4, bonus: 'Zero Casualties',      bonus_vp: 3, ticker_primary: 3, ticker_bonus: 2 },
  'sabotage_strike':           { primary: 'Targets Destroyed',  primary_vp: 4, bonus: 'Clean Escape',         bonus_vp: 2, ticker_primary: 3, ticker_bonus: 1 },
  'natural_disaster_response': { primary: 'Civilians Saved',    primary_vp: 3, bonus: 'Resources Secured',    bonus_vp: 2, ticker_primary: 2, ticker_bonus: 1 }
};

const FACTION_PLOT_AFFINITIES = {
  'monster_rangers': { 'corruption_ritual': 3, 'natural_disaster_response': 2, 'escort_run': 2 },
  'liberty_corps':   { 'claim_and_hold': 2,    'siege_standoff': 2,            'escort_run': 1 },
  'monsterology':    { 'extraction_heist': 2,  'corruption_ritual': 2,         'sabotage_strike': 1 },
  'shine_riders':    { 'extraction_heist': 2,  'sabotage_strike': 2,           'ambush_derailment': 1 },
  'crow_queen':      { 'corruption_ritual': 2, 'claim_and_hold': 1,            'siege_standoff': 1 },
  'monsters':        { 'natural_disaster_response': 2, 'ambush_derailment': 1 }
};

const FACTION_THEMES = {
  'monster_rangers': { primary_theme: 'Protect the Wild',    pressure_stance: 'containment',  resource_priorities: ['livestock', 'clean_water', 'wildlife'],      tactical_asset: { name: 'Ranger Outpost',               effect: 'Pressure rate -1 within 6"',           destruction_vp: 3, pressure_limit: 5 } },
  'liberty_corps':   { primary_theme: 'Federal Control',     pressure_stance: 'containment',  resource_priorities: ['weapons', 'supplies', 'communications'],     tactical_asset: { name: 'Field Communications Relay',   effect: '+1 die to nearby Federal units',       destruction_vp: 3, pressure_limit: 4 } },
  'monsterology':    { primary_theme: 'Scientific Progress', pressure_stance: 'exploitation', resource_priorities: ['thyr', 'specimens', 'mechanical_parts'],     tactical_asset: { name: 'Extraction Rig',               effect: '+1 die to resource extraction actions',destruction_vp: 4, pressure_limit: 6 }, exploitation_sweet_spot: [3, 5] },
  'shine_riders':    { primary_theme: 'Profit from Chaos',   pressure_stance: 'opportunist',  resource_priorities: ['valuables', 'contraband', 'weapons'],        tactical_asset: { name: 'Hidden Cache',                 effect: 'Can stash stolen goods mid-game',      destruction_vp: 2, pressure_limit: 6 } },
  'crow_queen':      { primary_theme: 'Establish Dominion',  pressure_stance: 'redirection',  resource_priorities: ['territory', 'followers', 'relics'],          tactical_asset: { name: 'Consecration Obelisk',         effect: 'Terrain within 6" becomes Consecrated',destruction_vp: 4, pressure_limit: 5, pressure_interaction: 'Converts pressure into territory control' } },
  'monsters':        { primary_theme: 'Reclaim Territory',   pressure_stance: 'adaptive',     resource_priorities: ['food', 'territory', 'safety'],               tactical_asset: { name: 'Monster Den',                  effect: 'Spawns additional Monster units at pressure thresholds', destruction_vp: 3, pressure_limit: 6 } }
};

const PRESSURE_PRETTY = {
  'ritual_misuse':       'ritual misuse',
  'belief_conflict':     'a clash of beliefs',
  'occult_overreach':    'occult forces none of them fully understand',
  'power_vacuum':        'a power vacuum',
  'retaliation':         'retaliation',
  'territorial_control': 'the fight for territorial control',
  'resource_scarcity':   'dwindling resources',
  'old_blood_feuds':     'old blood feuds',
  'monster_incursion':   'a monster incursion',
  'supply_shortage':     'a supply shortage',
  'faction_rivalry':     'faction rivalry',
  'desperation':         'sheer desperation',
  'survival':            'the need to survive',
  'greed':               'greed',
  'curiosity':           'dangerous curiosity'
};

// ================================
// SCENARIO BRAIN CLASS
// ================================
class ScenarioBrain {

  constructor(data) {
    this.data   = data   || {};
    this.loaded = false;
  }

  // ================================
  // MAIN GENERATOR
  // ================================

  async generateCompleteScenario(userSelections) {
    console.log("\n\n🎬 ========================================");
    console.log("    SCENARIO GENERATION START");
    console.log("========================================\n");

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

    // STEP 4.5: Cultist Encounter
    console.log("\n👹 STEP 4.5: CULTIST ENCOUNTER");
    const cultistEncounter = this.generateCultistEncounter(userSelections, plotFamily, location);
    console.log("✓ Cultist check:", cultistEncounter ? `${cultistEncounter.cult.name} APPEARING` : 'No cultists this time');

    // STEP 5: Victory Conditions
    console.log("\n🏆 STEP 5: VICTORY CONDITIONS");
    const victoryConditions = this.generateVictoryConditions(userSelections, objectives, vpSpread, cultistEncounter);
    console.log("✓ Victory conditions created");

    // STEP 6: Name
    console.log("\n📝 STEP 6: NAME");
    const name = this.generateName(['battle'], location);
    console.log("✓ Name:", name);

    // STEP 7: Extras
    console.log("\n🎭 STEP 7: EXTRAS");
    const twist      = this.generateTwist(userSelections.dangerRating, location);
    const canyonState= this.getCanyonState(userSelections.canyonState);
    const finale     = this.generateFinale(plotFamily, userSelections.dangerRating, location, userSelections.factions);
    console.log("✓ Extras added");

    // STEP 8: Narrative
    console.log("\n📝 STEP 8: NARRATIVE");
    const narrative = this.generateNarrative(plotFamily, location, userSelections, cultistEncounter);
    console.log("✓ Narrative written");

    // STEP 9: Terrain Setup
    console.log("\n🏜️ STEP 9: TERRAIN SETUP");
    const terrainSetup = this.generateTerrainSetup(plotFamily, location, userSelections.dangerRating, objectives, cultistEncounter);
    console.log("✓ Terrain setup generated");

    // STEP 10: Coffin Cough Storm
    console.log("\n☠️ STEP 10: COFFIN COUGH STORM");
    const coffinCough = this.generateCoffinCough(location, userSelections.dangerRating);
    console.log("✓ Coffin Cough:", coffinCough ? 'STORM INCOMING' : 'Clear skies');

    // STEP 11: Wandering NPCs
    console.log("\n🤖 STEP 11: WANDERING NPCs");
    const wanderingNPCs = this.generateWanderingNPCs(location, userSelections.dangerRating);
    console.log("✓ Wandering NPCs:", wanderingNPCs ? wanderingNPCs.map(n => n.name).join(', ') : 'None this game');

    // ================================
    // ASSEMBLE FINAL SCENARIO
    // ================================
    const scenario = {
      name:              name,
      narrative_hook:    narrative,
      plot_family:       plotFamily.name,
      location:          location,
      danger_rating:     userSelections.dangerRating,
      danger_description:this.getDangerDesc(userSelections.dangerRating),
      vp_spread:         vpSpread,
      objectives:        objectives,
      victory_conditions:victoryConditions,
      monster_pressure: {
        enabled:          userSelections.dangerRating >= 4,
        trigger:          userSelections.dangerRating >= 4 ? `Round ${userSelections.dangerRating - 1}` : 'N/A',
        escalation_type:  userSelections.dangerRating >= 4 ? 'Environmental threat increases each round' : 'None'
      },
      canyon_state:      canyonState,
      twist:             twist,
      finale:            finale,
      cultist_encounter: cultistEncounter,
      terrain_setup:     terrainSetup,
      coffin_cough:      coffinCough,
      wandering_npcs:    wanderingNPCs
    };

    console.log("\n✅ SCENARIO GENERATION COMPLETE\n");
    return this.validateScenario(scenario);
  }

  // ================================
  // VALIDATE
  // ================================
  validateScenario(scenario) {
    const validated = {
      name:              scenario.name              || 'Unnamed Scenario',
      narrative_hook:    scenario.narrative_hook    || 'A conflict in the Canyon.',
      danger_rating:     scenario.danger_rating     || 3,
      danger_description:scenario.danger_description|| 'Standard danger',
      location:          scenario.location          || { name: 'Unknown Location', description: 'A place in the Canyon' },
      canyon_state:      scenario.canyon_state      || { name: 'Poisoned', effect: 'Standard Canyon state' },
      factions:          scenario.factions          || [],
      objectives:        scenario.objectives        || [],
      victory_conditions:scenario.victory_conditions|| {},
      twist:             scenario.twist             || null,
      finale:            scenario.finale            || null,
      terrain_setup:     scenario.terrain_setup     || { core_terrain: [], optional_terrain: [] },
      coffin_cough:      scenario.coffin_cough      || null,
      wandering_npcs:    scenario.wandering_npcs    || null,
      cultist_encounter: scenario.cultist_encounter || null,
      monster_pressure:  scenario.monster_pressure  || null
    };

    if (validated.location) {
      validated.location = {
        name:        validated.location.name        || 'Unknown',
        description: validated.location.description || '',
        emoji:       validated.location.emoji       || '🗺️',
        atmosphere:  validated.location.atmosphere  || null,
        resources:   validated.location.resources   || {},
        hazards:     validated.location.hazards     || []
      };
    }

    if (validated.terrain_setup) {
      validated.terrain_setup = {
        atmosphere:       validated.terrain_setup.atmosphere       || '',
        core_terrain:     validated.terrain_setup.core_terrain     || [],
        optional_terrain: validated.terrain_setup.optional_terrain || [],
        objective_markers:validated.terrain_setup.objective_markers|| [],
        cultist_markers:  validated.terrain_setup.cultist_markers  || [],
        thyr_crystals:    validated.terrain_setup.thyr_crystals    || null,
        setup_note:       validated.terrain_setup.setup_note       || 'Standard terrain setup.'
      };
    }

    return validated;
  }

  // ================================
  // LOAD ALL DATA
  // ================================
  async loadAllData() {
    console.log("📚 Loading all data files...");

    const files = [
      { key: 'scenarios',        url: 'https://raw.githubusercontent.com/steamcrow/coffin/main/data/src/180_scenario_vault.json' },
      { key: 'scenarioVault140', url: 'https://raw.githubusercontent.com/steamcrow/coffin/main/data/src/140_scenario_vault.json' },
      { key: 'names',            url: 'https://raw.githubusercontent.com/steamcrow/coffin/main/data/src/230_scenario_names.json' },
      { key: 'locations',        url: 'https://raw.githubusercontent.com/steamcrow/coffin/main/data/src/170_named_locations.json' },
      { key: 'locationArchetypes',url:'https://raw.githubusercontent.com/steamcrow/coffin/main/data/src/97_location_vault.json' },
      { key: 'locationTypes',    url: 'https://raw.githubusercontent.com/steamcrow/coffin/main/data/src/150_location_types.json' },
      { key: 'plotFamilies',     url: 'https://raw.githubusercontent.com/steamcrow/coffin/main/data/src/200_plot_families.json' },
      { key: 'plotEngine',       url: 'https://raw.githubusercontent.com/steamcrow/coffin/main/data/src/190_plot_engine_schema.json' },
      { key: 'objectiveVault',   url: 'https://raw.githubusercontent.com/steamcrow/coffin/main/data/src/240_objective_vault.json' },
      { key: 'twists',           url: 'https://raw.githubusercontent.com/steamcrow/coffin/main/data/src/210_twist_tables.json' },
      { key: 'turnStructure',    url: 'https://raw.githubusercontent.com/steamcrow/coffin/main/data/src/20_turn_structure.json' },
      { key: 'unitIdentities',   url: 'https://raw.githubusercontent.com/steamcrow/coffin/main/data/src/70_unit_identities.json' },
      { key: 'canyonStates',     url: 'https://raw.githubusercontent.com/steamcrow/coffin/main/data/src/30_campaign_system.json' },
      { key: 'monsterRangers', url: 'https://raw.githubusercontent.com/steamcrow/coffin/main/data/factions/faction-monster-rangers-v5.json', faction: 'monster_rangers' },
      { key: 'libertyCorps',   url: 'https://raw.githubusercontent.com/steamcrow/coffin/main/data/factions/faction-liberty-corps-v2.json',   faction: 'liberty_corps'   },
      { key: 'monsterology',   url: 'https://raw.githubusercontent.com/steamcrow/coffin/main/data/factions/faction-monsterology-v2.json',    faction: 'monsterology'    },
      { key: 'monsters',       url: 'https://raw.githubusercontent.com/steamcrow/coffin/main/data/factions/faction-monsters-v2.json',        faction: 'monsters'        },
      { key: 'shineRiders',    url: 'https://raw.githubusercontent.com/steamcrow/coffin/main/data/factions/faction-shine-riders-v2.json',    faction: 'shine_riders'    },
      { key: 'crowQueen',      url: 'https://raw.githubusercontent.com/steamcrow/coffin/main/data/factions/faction-crow-queen.json',         faction: 'crow_queen'      }
    ];

    if (!this.data.factions) this.data.factions = {};

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
    if (!location.resources)       location.resources       = {};
    if (!location.hazards)         location.hazards         = [];
    if (!location.terrain_features)location.terrain_features= [];
    if (!location.rewards)         location.rewards         = [];

    if (this.data.locationArchetypes?.location_archetypes && location.type_ref) {
      const archetype = this.data.locationArchetypes.location_archetypes[location.type_ref];
      if (archetype) {
        location.default_traits    = archetype.terrain_profile?.default_traits    || [];
        location.common_traits     = archetype.terrain_profile?.common_traits     || [];
        location.rare_traits       = archetype.terrain_profile?.rare_traits       || [];
        location.escalation_logic  = archetype.escalation_logic  || [];
        location.objective_patterns= archetype.objective_patterns || {};
      }
    }
    return location;
  }

  generateProceduralLocation(dangerRating) {
    const types = this.data.locationTypes.location_types.filter(t =>
      (!t.danger_floor   || dangerRating >= t.danger_floor) &&
      (!t.danger_ceiling || dangerRating <= t.danger_ceiling)
    );
    const type   = types.length > 0 ? this.randomChoice(types) : this.data.locationTypes.location_types[0];
    const nearby = this.randomChoice(this.data.locations.locations);

    const positionPatterns = [
      { pattern: 'outskirts', template: 'The Outskirts of {location}', weight: 3 },
      { pattern: 'inside',    template: 'Inside {location}',           weight: 2 },
      { pattern: 'near',      template: 'Near {location}',             weight: 2 },
      { pattern: 'edge',      template: 'At the Edge of {location}',   weight: 2 },
      { pattern: 'beyond',    template: 'Beyond {location}',           weight: 1 },
      { pattern: 'below',     template: 'Below {location}',            weight: 1 },
      { pattern: 'above',     template: 'Above {location}',            weight: 1 },
      { pattern: 'ruins',     template: 'The Ruins Near {location}',   weight: 1 },
      { pattern: 'shadows',   template: 'In the Shadow of {location}', weight: 2 }
    ];

    const position     = this.weightedRandomChoice(positionPatterns);
    const locationName = position.template.replace('{location}', nearby.name);

    const descTemplates = [
      `${type.description || 'A contested zone'} in the shadow of ${nearby.name}.`,
      `A ${type.id.replace(/_/g, ' ')} where ${nearby.name}'s influence reaches, but authority does not.`,
      `The kind of place ${nearby.name} pretends doesn't exist.`,
      `${nearby.name} casts a long shadow. This is where that shadow falls.`,
      `Close enough to ${nearby.name} to hear the gunshots. Far enough to ignore them.`
    ];

    return {
      id:               `proc_${Date.now()}`,
      name:             locationName,
      emoji:            type.emoji || '🗺️',
      type_ref:         type.id,
      description:      this.randomChoice(descTemplates),
      atmosphere:       this.randomChoice(type.atmosphere || ['Tension hangs heavy in the air']),
      resources:        type.resources        || {},
      hazards:          type.environmental_hazards || [],
      terrain_features: type.terrain_features || [],
      rewards:          type.rewards          || [],
      procedural:       true,
      nearby_location:  nearby.name
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
          if (location.resources[res] && location.resources[res] > 0) score += 3;
        });
      }

      if (location.type_ref) {
        if (location.type_ref.includes('fortress') && plot.id === 'siege_standoff')    score += 4;
        if (location.type_ref.includes('pass')     && plot.id === 'escort_run')         score += 4;
        if (location.type_ref.includes('ruins')    && plot.id === 'ambush_derailment')  score += 4;
        if (location.type_ref.includes('mine')     && plot.id === 'extraction_heist')   score += 4;
      }

      userSelections.factions.forEach(faction => {
        const affinity = FACTION_PLOT_AFFINITIES[faction.id]?.[plot.id] || 0;
        score += affinity;
      });

      if (score > maxScore) { maxScore = score; bestPlot = plot; }
    });

    console.log(`Matched: ${bestPlot.name} (score: ${maxScore})`);
    return bestPlot;
  }

  getEmergencyPlot() {
    return {
      id: 'claim_and_hold', name: 'Claim and Hold', description: 'Control territory',
      default_objectives: ['land_marker', 'command_structure', 'fortified_position'],
      primary_resources: ['food', 'water'], escalation_bias: ['environmental_hazard'],
      aftermath_bias: ['location_state_change'], common_inciting_pressures: ['territorial_dispute']
    };
  }

  // ================================
  // VP SPREAD (STEP 3)
  // ================================
  calculateVPSpread(plotId, danger) {
    const target = 10 + (danger * 2);
    const sys = VP_SYSTEMS[plotId] || { primary: 'Objectives Complete', primary_vp: 2, bonus: 'Enemy Eliminated', bonus_vp: 1, ticker_primary: 2, ticker_bonus: 1 };

    return {
      target_to_win: target,
      scoring_rule:  `${sys.primary_vp} VP per ${sys.primary}`,
      bonus_rule:    `${sys.bonus_vp} VP per ${sys.bonus}`,
      formula:       `(${sys.primary} × ${sys.primary_vp}) + (${sys.bonus} × ${sys.bonus_vp})`,
      thresholds: {
        minor_victory:    Math.floor(target * 0.6),
        major_victory:    target,
        legendary_victory:Math.floor(target * 1.5)
      },
      ticker: {
        primary_label: sys.primary, primary_per_vp: sys.ticker_primary,
        bonus_label:   sys.bonus,   bonus_per_vp:   sys.ticker_bonus
      }
    };
  }

  // ================================
  // OBJECTIVES (STEP 4)
  // ================================
  generateObjectives(plotFamily, location, userSelections, vpSpread) {
    const objectives = [];
    const danger     = userSelections.dangerRating;
    const usedTypes  = new Set();

    console.log("  Starting objective generation...");

    if (plotFamily.default_objectives && plotFamily.default_objectives.length > 0) {
      const plotObjectives = this.randomChoice(plotFamily.default_objectives, Math.min(2, plotFamily.default_objectives.length));
      plotObjectives.forEach(objType => {
        const obj = this.buildObjective(objType, location, danger, vpSpread);
        if (obj) { objectives.push(obj); usedTypes.add(objType); }
      });
    }

    if (location.resources) {
      const highValueResources = Object.entries(location.resources)
        .filter(([key, val]) => val >= 2).map(([key]) => key);

      if (highValueResources.length > 0 && !usedTypes.has('resource_extraction')) {
        const resource   = this.randomChoice(highValueResources);
        const amount     = location.resources[resource];
        const prettyName = this.formatResourceName(resource);

        const obj = this.buildObjective('resource_extraction', location, danger, vpSpread, {
          name: prettyName, amount: Math.min(amount, danger + 2), vp: this.getResourceVP(resource)
        });
        if (obj) { objectives.push(obj); usedTypes.add('resource_extraction'); }
      }
    }

    const generalObjectives = ['scattered_crates', 'wrecked_engine', 'land_marker', 'fortified_position', 'stored_supplies'];
    const numToFill = Math.max(1, 4 - objectives.length);

    for (let i = 0; i < numToFill && generalObjectives.length > 0; i++) {
      const availableTypes = generalObjectives.filter(t => !usedTypes.has(t));
      if (availableTypes.length === 0) break;
      const objType = this.randomChoice(availableTypes);
      const obj = this.buildObjective(objType, location, danger, vpSpread);
      if (obj) { objectives.push(obj); usedTypes.add(objType); }
    }

    return objectives;
  }

  buildObjective(type, location, danger, vpSpread, extraData = {}) {
    if (this.data.objectiveVault?.objective_categories) {
      const vaultObj = this.findVaultObjective(type);
      if (vaultObj) return this.buildFromVault(vaultObj, location, danger, extraData);
    }
    const builder = OBJECTIVE_BUILDERS[type];
    if (!builder) return null;
    const obj     = builder(location, danger, vpSpread, extraData);
    obj.type      = type;
    obj.max_vp    = obj.target_value * obj.vp_per_unit;
    return obj;
  }

  findVaultObjective(objectiveId) {
    if (!this.data.objectiveVault?.objective_categories) return null;
    for (const category of this.data.objectiveVault.objective_categories) {
      const obj = category.objectives.find(o => o.objective_id === objectiveId);
      if (obj) return obj;
    }
    return null;
  }

  buildFromVault(vaultObj, location, danger, extraData = {}) {
    const obj = {
      type:         vaultObj.objective_id,
      name:         vaultObj.name,
      description:  vaultObj.description,
      markers:      this.evaluateVaultValue(vaultObj.setup?.markers, danger),
      marker_type:  vaultObj.setup?.marker_type || vaultObj.objective_id,
      action_type:  vaultObj.interaction?.action_type  || 'interact',
      action_cost:  vaultObj.interaction?.action_cost  || 1,
      test_required:vaultObj.interaction?.test_required|| false,
      test_type:    vaultObj.interaction?.test_type    || 'quality',
      success:      vaultObj.interaction?.success      || 'Complete objective',
      failure:      vaultObj.interaction?.failure      || 'Action wasted',
      vp_value:     vaultObj.vp_value   || 3,
      vp_per:       vaultObj.vp_per     || 'completion',
      danger_scaling:vaultObj.danger_scaling || false,
      target_value: this.evaluateVaultValue(vaultObj.setup?.markers, danger) || danger,
      vp_per_unit:  vaultObj.vp_value   || 3
    };
    if (vaultObj.bonus_vp)          obj.bonus_vp          = vaultObj.bonus_vp;
    if (vaultObj.extraction_required) obj.extraction_required = true;
    if (vaultObj.hazard_level)      obj.hazard_level      = vaultObj.hazard_level;
    if (vaultObj.escalation)        obj.escalation        = vaultObj.escalation;
    if (vaultObj.corruption_spread) obj.corruption_spread = vaultObj.corruption_spread;
    obj.max_vp = obj.target_value * obj.vp_per_unit;
    return obj;
  }

  evaluateVaultValue(expression, danger) {
    if (typeof expression === 'number') return expression;
    if (typeof expression !== 'string') return danger;
    try {
      const evaluated = expression
        .replace(/danger_rating/g, danger)
        .replace(/Math\.max/g, 'Math.max')
        .replace(/Math\.floor/g, 'Math.floor');
      return eval(evaluated) || danger;
    } catch (e) {
      console.warn("Could not evaluate:", expression, e);
      return danger;
    }
  }

  getResourceVP(resource) {
    const rates = {
      'thyr': 4, 'tzul_silver': 4, 'weapons': 3, 'mechanical_parts': 3,
      'gildren': 3, 'vitagood': 3, 'livestock': 2, 'food': 2, 'water': 2,
      'food_good': 2, 'water_clean': 2, 'coal': 2, 'silver': 2, 'lead': 2,
      'supplies': 2, 'food_foul': 1, 'water_foul': 1
    };
    return rates[resource] || 2;
  }

  // ================================
  // VICTORY CONDITIONS (STEP 5)
  // ================================
  generateVictoryConditions(userSelections, objectives, vpSpread, cultistEncounter) {
    const conditions = {};

    userSelections.factions.forEach(faction => {
      const factionObjectives = [];

      if (cultistEncounter && cultistEncounter.enabled) {
        const cultistResponse = this.generateCultistResponseObjective(faction.id, cultistEncounter, userSelections.dangerRating);
        if (cultistResponse) factionObjectives.push(cultistResponse);
      }

      objectives.forEach(obj => {
        const interpretation = this.getFactionObjectiveInterpretation(faction.id, obj);
        if (interpretation) factionObjectives.push(interpretation);
      });

      const unique = this.generateUniqueFactionObjective(faction.id, userSelections.dangerRating, userSelections.factions);
      if (unique) factionObjectives.push(unique);

      conditions[faction.id] = {
        target_vp:       vpSpread.target_to_win,
        thresholds:      vpSpread.thresholds,
        primary_scoring: vpSpread.scoring_rule,
        bonus_scoring:   vpSpread.bonus_rule,
        faction_objectives: factionObjectives,
        aftermath:       this.generateFactionAftermath(faction.id),
        objectives:      objectives.map(obj => ({ name: obj.name, ticker: `${obj.progress_label}: ${obj.vp_per_unit} VP each` }))
      };
    });

    return conditions;
  }

  generateCultistResponseObjective(factionId, cultistEncounter, danger) {
    const cult         = cultistEncounter.cult;
    const pressure     = cultistEncounter.pressure;
    const factionTheme = FACTION_THEMES[factionId];
    if (!factionTheme) { console.warn(`No theme for faction: ${factionId}`); return null; }

    const pressureType = pressure.type;
    const stance       = factionTheme.pressure_stance;
    const theme        = factionTheme.primary_theme;

    if (stance === 'containment')  return this.generateContainmentObjective(pressureType, theme, danger, pressure);
    if (stance === 'exploitation') return this.generateExploitationObjective(pressureType, theme, danger, pressure);
    if (stance === 'opportunist')  return this.generateOpportunistObjective(pressureType, theme, danger, pressure);
    if (stance === 'redirection')  return this.generateRedirectionObjective(pressureType, theme, danger, pressure);
    if (stance === 'adaptive')     return this.generateAdaptiveObjective(pressureType, theme, danger, pressure);

    return { name: `Respond to ${pressure.label}`, goal: `Deal with the ${cult.name} threat.`, method: 'Engage cult directly.', scoring: `+${danger * 2} VP if pressure contained` };
  }

  generateContainmentObjective(pressureType, theme, danger, pressure) {
    const map = {
      'fire_spread':          { name: 'Extinguish the Flames',   goal: `${theme}: Protect from fire`,           method: 'Deploy water sources. +1 die near fire zones.',       scoring: `+${danger * 2} VP per fire source extinguished`, effect: 'pressure_rate - 1 when active' },
      'resource_consumption': { name: 'Protect the Resource',    goal: `${theme}: Preserve ${pressure.consumes}`,method: 'Guard resource locations. Slow consumption.',          scoring: `+${danger * 2} VP if consumption slowed`,        effect: 'pressure_rate - 1 when guarding' },
      'necromantic_rise':     { name: 'Suppress the Undead',     goal: `${theme}: Prevent undead rising`,       method: 'Consecrate burial sites. +1 die vs undead.',           scoring: `+${danger * 2} VP per site consecrated`,         effect: 'pressure_rate - 1 per consecrated site' },
      'chaos_escalation':     { name: 'Stabilize Reality',       goal: `${theme}: Restore order`,               method: 'Deploy stabilization wards. Counter chaos.',           scoring: `+${danger} VP per round chaos contained`,        effect: 'pressure_rate - 1 within ward radius' },
      'reality_erosion':      { name: 'Seal the Rifts',          goal: `${theme}: Close void portals`,          method: 'Ritual to seal rifts. +1 die vs void entities.',       scoring: `+${danger * 2} VP per rift sealed`,              effect: 'pressure_rate - 1 per sealed rift' },
      'corruption_spread':    { name: 'Contain the Blight',      goal: `${theme}: Stop corruption spread`,      method: 'Cleanse corrupted ground. Create barriers.',           scoring: `+${danger} VP per zone cleansed`,                effect: 'pressure_rate - 1 per barrier deployed' },
      'death_magic':          { name: 'Counter Necromancy',       goal: `${theme}: Disrupt death magic`,         method: 'Life-affirming rituals. Protect the living.',          scoring: `+${danger * 2} VP if death magic countered`,     effect: 'pressure_rate - 1 within ritual area' },
      'dark_consecration':    { name: 'Resist Domination',       goal: `${theme}: Maintain free will`,          method: 'Mental fortification. +2 to Will checks.',            scoring: `+${danger} VP per ally freed from control`,      effect: 'pressure_rate - 1 within fortified area' }
    };
    return map[pressureType] || map['chaos_escalation'];
  }

  generateExploitationObjective(pressureType, theme, danger, pressure) {
    const map = {
      'fire_spread':          { name: 'Harvest Fire Energy',       goal: `${theme}: Extract power from flames`,     method: 'Fire grants bonus Thyr when harvested.',       scoring: `+${danger * 2} VP when pressure = 3-5`, trigger: 'pressure >= 3' },
      'resource_consumption': { name: 'Study the Consumption',     goal: `${theme}: Learn from cult methods`,       method: 'Document consumption process for research.',   scoring: `+${danger * 2} VP when pressure = 4-5`, trigger: 'pressure >= 4' },
      'necromantic_rise':     { name: 'Capture Undead Specimens',  goal: `${theme}: Research necromancy`,           method: 'Trap and study undead. Gain research tokens.', scoring: `+${danger} VP per undead captured`,    trigger: 'pressure >= 3' },
      'chaos_escalation':     { name: 'Harvest Chaos Energy',      goal: `${theme}: Study reality instability`,     method: 'Extract chaos samples. +1 research per round.',scoring: `+${danger * 2} VP when pressure = 3-5`, trigger: 'pressure >= 3' },
      'reality_erosion':      { name: 'Map the Void',              goal: `${theme}: Chart dimensional rifts`,       method: 'Collect void data. Dangerous but valuable.',   scoring: `+${danger * 3} VP when pressure = 4-5`, trigger: 'pressure >= 4' },
      'corruption_spread':    { name: 'Extract Blight Samples',    goal: `${theme}: Study corrupted biology`,       method: 'Harvest corrupted specimens.',                 scoring: `+${danger} VP per sample collected`,   trigger: 'pressure >= 3' },
      'death_magic':          { name: 'Document Death Magic',      goal: `${theme}: Record necromantic techniques`, method: 'Observe and document rituals.',                scoring: `+${danger * 2} VP if fully documented`,trigger: 'pressure >= 4' },
      'dark_consecration':    { name: 'Steal Dark Relics',         goal: `${theme}: Acquire cult artifacts`,        method: 'Raid cult sites during ritual.',               scoring: `+${danger * 2} VP per relic stolen`,   trigger: 'pressure >= 3' }
    };
    return map[pressureType] || map['chaos_escalation'];
  }

  generateOpportunistObjective(pressureType, theme, danger, pressure) {
    return { name: 'Profit from Chaos', goal: `${theme}: Loot during pressure`, method: `+1 VP per pressure level. Move faster through chaos.`, scoring: `+${danger} VP per objective stolen, +1 VP per pressure level`, special: 'Benefits increase as pressure rises' };
  }

  generateRedirectionObjective(pressureType, theme, danger, pressure) {
    return { name: 'Weaponize the Pressure', goal: `${theme}: Turn chaos into control`, method: 'Pressure converts into territory control at objectives.', scoring: `+${danger} VP per objective controlled, +2 VP per pressure level`, effect: 'Controlled territory persists after scenario' };
  }

  generateAdaptiveObjective(pressureType, theme, danger, pressure) {
    if (pressure.current < 3) {
      return { name: 'Defend Territory', goal: `${theme}: Protect from invaders`, method: '+1 Attack when defending held ground.', scoring: `+${danger} VP per enemy driven off`, adaptive: 'Switches to survival mode at pressure >= 4' };
    }
    return { name: 'Survival Mode', goal: `${theme}: Escape the danger`, method: '+2 Movement when fleeing. Extract what you can.', scoring: `+${danger} VP per unit evacuated safely`, adaptive: 'Fight becomes retreat at high pressure' };
  }

  getFactionObjectiveInterpretation(factionId, objective, pressure = null) {
    const library = {
      'monster_rangers': {
        'ritual_circle':    { goal: 'Stabilize the land via ritual.',         method: 'Dark Librarian gains +1 die to ritual actions.',    scoring: '+4 VP per ritual' },
        'scattered_crates': { goal: 'Distribute supplies to refugees.',       method: 'Escort crates to civilians.',                       scoring: '+2 VP per crate', restriction: 'Harming civilians costs -2 VP' }
      },
      'liberty_corps': {
        'ritual_circle':    { goal: 'Assert federal control over site.',      method: 'Establish barriers and patrols.',                   scoring: '+4 VP per site controlled' },
        'scattered_crates': { goal: 'Confiscate contraband as evidence.',     method: 'Secure and tag all crates.',                        scoring: '+2 VP per crate', restriction: 'Must maintain chain of custody' }
      },
      'monsterology': {
        'ritual_circle':    { goal: 'Harvest energies and bound entities.',   method: 'Extraction rigs grant +1 die vs monsters.',         scoring: '+4 VP per extraction' },
        'tainted_ground':   { goal: 'Strip the Taint for reagents.',          method: 'Deploy Taint collectors.',                          scoring: '+4 VP per site', restriction: 'Extracted land cannot be restored' }
      },
      'crow_queen': {
        'land_marker':      { goal: 'Mark the boundaries of the new kingdom.',method: 'Ladies in Waiting gain +2" move when placing.',     scoring: '+2 VP per marker' },
        'ritual_circle':    { goal: 'Consecrate the ground to the Regent Black.', method: 'Convert site to Consecrated terrain.',          scoring: '+4 VP per site' }
      },
      'shine_riders': {
        'scattered_crates': { goal: 'Steal valuable goods.',                  method: 'Fast extraction with Bikes.',                       scoring: '+2 VP per crate' },
        'stored_supplies':  { goal: 'The legendary heist.',                   method: 'Extract and escape with loot.',                     scoring: '+2 VP per supply' }
      },
      'monsters': {
        'resource_extraction': { goal: 'Consume resources.',                  method: 'Monsters gain +2 VP per resource consumed.',        scoring: '+2 VP per resource consumed' },
        'scattered_crates':    { goal: 'Hoard food stores.',                  method: 'Drag crates to Monster den.',                       scoring: '+2 VP per crate hoarded' },
        'land_marker':         { goal: 'Mark territory.',                     method: 'Territorial scent markers.',                        scoring: '+2 VP per marker held' },
        'ritual_circle':       { goal: 'Disrupt human ritual.',               method: 'Monsters can sense magical energies.',              scoring: '+4 VP per site disrupted' }
      }
    };

    const factionMap = library[factionId];
    if (!factionMap || !factionMap[objective.type]) return null;
    return { name: objective.name, ...factionMap[objective.type] };
  }

  generateUniqueFactionObjective(factionId, danger, allFactions) {
    const uniques = {
      'monster_rangers': { name: 'Minimize Casualties',       goal: 'Protect monsters and civilians.',               method: 'Escort non-combatants to safety.',           scoring: `${danger * 2} VP minus deaths` },
      'liberty_corps':   { name: 'Establish Authority',       goal: 'Hold the center of the board.',                 method: 'Maintain control for 3 rounds.',             scoring: `${danger * 2} VP if held at end` },
      'monsterology':    { name: 'Total Extraction Protocol', goal: 'Exploit every site.',                           method: 'Extract from all objectives.',               scoring: `${danger * 3} VP if all extracted` },
      'shine_riders':    { name: 'Legendary Heist',           goal: 'Steal the most valuable prize.',                method: 'Extract highest-value objective and escape.',scoring: `${danger * 3} VP if escaped` },
      'crow_queen':      { name: 'Divine Mandate',            goal: 'Force enemies to kneel.',                       method: 'Break enemy morale with Fear.',              scoring: `${danger * 2} VP per enemy unit Broken` }
    };

    if (factionId === 'monsters') {
      const humanFactions = allFactions.filter(f => f.id !== 'monsters' && f.id !== 'crow_queen');
      if (humanFactions.length === 0) {
        return { name: 'Territorial Supremacy', goal: 'Drive out all intruders.',   method: 'Eliminate enemy leaders and hold ground.', scoring: `${danger * 2} VP per enemy faction broken` };
      }
      return   { name: 'Drive Out Invaders',    goal: 'Purge humans from the Canyon.', method: 'Eliminate enemy leaders.',               scoring: `${danger * 2} VP per human faction broken` };
    }

    return uniques[factionId] || null;
  }

  generateFactionAftermath(factionId) {
    const aftermaths = {
      'monster_rangers': { immediate_effect: 'The land begins to heal.',         canyon_state_change: 'Territory becomes Restored.',     long_term: 'Monster populations stabilize.',        flavor: 'The Rangers have bought time, but the Canyon never forgets.' },
      'liberty_corps':   { immediate_effect: 'Federal presence increases.',      canyon_state_change: 'Territory becomes Occupied.',     long_term: 'Trade routes secure, but tension rises.',flavor: 'Order has been imposed. The question is: for how long?' },
      'monsterology':    { immediate_effect: 'The site is stripped bare.',       canyon_state_change: 'Territory becomes Depleted.',     long_term: 'Resource scarcity increases.',           flavor: 'Progress has a price, paid in full by the land itself.' },
      'shine_riders':    { immediate_effect: 'Valuables vanish into the night.', canyon_state_change: 'Territory becomes Lawless.',      long_term: 'Crime and opportunity intertwine.',      flavor: 'The Riders leave only dust and legend behind.' },
      'crow_queen':      { immediate_effect: 'Dark banners rise.',               canyon_state_change: 'Territory becomes Consecrated.', long_term: "The Regent's influence spreads.",        flavor: 'All who remain know: the Queen is watching.' },
      'monsters':        { immediate_effect: 'Humans retreat in fear.',          canyon_state_change: 'Territory becomes Wild.',         long_term: 'The Canyon reclaims its own.',           flavor: 'Nature is not kind. It simply is.' }
    };
    return aftermaths[factionId] || { immediate_effect: 'The battle ends.', canyon_state_change: 'Territory status unchanged.', long_term: 'The struggle continues.', flavor: 'Another skirmish in an endless war.' };
  }

  // ================================
  // NAME & NARRATIVE (STEP 6)
  // ================================
  generateName(tags, location) {
    if (!this.data.names) return `The Battle at ${location.name}`;

    const prefixes    = this.data.names.prefixes    || ['Skirmish at', 'Battle of', 'Conflict at'];
    const suffixes    = this.data.names.suffixes    || ['Pass', 'Ridge', 'Crossing'];
    const descriptors = this.data.names.descriptors || ['Bloody', 'Desperate', 'Final'];

    const getTextValue = item => (typeof item === 'string' ? item : (item?.text ? item.text : String(item)));

    const prefix     = getTextValue(this.randomChoice(prefixes));
    const suffix     = getTextValue(this.randomChoice(suffixes));
    const descriptor = getTextValue(this.randomChoice(descriptors));

    const styles = [
      `${prefix} ${location.name}`,
      `The ${descriptor} ${suffix} of ${location.name}`,
      `${location.name}: ${descriptor} Stand`
    ];
    return this.randomChoice(styles);
  }

  generateNarrative(plotFamily, location, userSelections, cultistEncounter) {
    const names    = userSelections.factions.map(f => f.name);
    const factions = names.length <= 2 ? names.join(' and ') : names.slice(0, -1).join(', ') + ', and ' + names[names.length - 1];

    if (cultistEncounter && cultistEncounter.enabled) {
      const context = { location: location.name, cult: cultistEncounter.cult.name, pressure: cultistEncounter.pressure.description, factions };
      const cultNarratives = [
        '{location} was quiet until the {cult} arrived. {pressure} {factions} have stumbled into something they weren\'t prepared for.',
        'The {cult} chose {location} for a reason. {pressure} {factions} showed up at the worst possible time.',
        '{pressure} The {cult} have been working in secret at {location}. {factions} are about to interrupt them.'
      ];
      return this.parseTemplate(this.randomChoice(cultNarratives), context);
    }

    const context = { location: location.name, factions };

    const plotNarratives = {
      'extraction_heist': () => {
        const resources = location.resources ? Object.keys(location.resources).filter(r => location.resources[r] > 0) : [];
        const resource  = resources.length > 0 ? this.formatResourceName(this.randomChoice(resources)) : 'valuable cargo';
        context.resource = resource.toLowerCase();
        return this.parseTemplate('{location} sits on a cache of {resource}. Word got out. {factions} all want it, and none of them are walking away empty-handed.', context);
      },
      'ambush_derailment':         () => this.parseTemplate('The rails through {location} are a critical supply line. {factions} know that whoever controls the rails controls the flow of weapons, food, and power in this part of the Canyon. Someone\'s about to derail that.', context),
      'claim_and_hold':            () => this.parseTemplate('{location} has changed hands three times in the last year. {factions} are here to make sure the fourth time is permanent. Nobody\'s leaving until the question is settled.', context),
      'corruption_ritual':         () => this.parseTemplate('Something ancient sleeps beneath {location}. {factions} are about to wake it up — whether they mean to or not. The ground is already starting to crack.', context),
      'siege_standoff':            () => this.parseTemplate('The fortifications at {location} have held for weeks. {factions} are done waiting. Someone breaks through today, or everyone starves tomorrow.', context),
      'escort_run':                () => { context.cargo = 'Critical cargo'; return this.parseTemplate('{cargo} needs to cross {location}. {factions} all have different ideas about where it ends up.', context); },
      'sabotage_strike':           () => this.parseTemplate('{location} is infrastructure. Blow it, and supply lines collapse for a hundred miles. {factions} are racing to either destroy it or defend it. The charges are already placed.', context),
      'natural_disaster_response': () => this.parseTemplate('{location} is tearing itself apart. {factions} are here to save what they can — or loot what\'s left. The Canyon doesn\'t care which.', context)
    };

    const narrative = plotNarratives[plotFamily.id];
    return narrative ? narrative() : this.parseTemplate('{factions} have collided at {location}. The fight starts now.', context);
  }

  // ================================
  // EXTRAS (STEP 7)
  // ================================
  generateTwist(danger, location) {
    if (!this.data.twists?.twists) {
      return { name: 'Unpredictable Winds', description: 'The canyon winds shift without warning.', effect: '-1 to Ranged attacks.', example: null };
    }

    if (location && Math.random() < 0.3) {
      const corruptionTwist = this.checkResourceCorruption(location);
      if (corruptionTwist) return corruptionTwist;
    }

    let pool = this.data.twists.twists.filter(t => {
      if (t.danger_floor   && danger < t.danger_floor)   return false;
      if (t.danger_ceiling && danger > t.danger_ceiling) return false;
      return true;
    });
    if (pool.length === 0) pool = this.data.twists.twists;

    const twist   = this.weightedRandomChoice(pool);
    const example = twist.example_outcomes?.length > 0 ? this.randomChoice(twist.example_outcomes) : null;

    return { name: twist.name, description: twist.description, effect: twist.mechanical_effect || twist.effect || 'Unknown effect.', example };
  }

  checkResourceCorruption(location) {
    if (!location.resources) return null;
    const corruptible = [];
    if (location.resources.food   > 0 || location.resources.food_good  > 0) corruptible.push({ name: 'Poisoned Supplies',     description: 'The food stockpile has been compromised.',    effect: 'All Food resources are Foul Food. Models consuming them must test against Poison.',                    example: 'What looked like fresh rations is crawling with Coffin Cough spores.' });
    if (location.resources.water  > 0 || location.resources.water_clean > 0) corruptible.push({ name: 'Tainted Water',         description: 'The water supply is contaminated.',           effect: 'All Water resources are Foul Water. Models drinking it suffer -1 Stamina until treated.',              example: 'The well looked clean. It wasn\'t.' });
    if (location.resources.mechanical_parts > 0)                              corruptible.push({ name: 'Sabotaged Components',  description: 'Someone rigged the machinery.',               effect: 'Mechanical Parts have a 50% chance to explode when salvaged (1d6 damage to salvager).',                example: 'The gears were fine. The explosive charge hidden inside them was not.' });
    return corruptible.length > 0 ? this.randomChoice(corruptible) : null;
  }

  getCanyonState(stateId) {
    if (!this.data.canyonStates?.canyon_states) return { name: 'Poisoned', effect: "The Canyon's default state. Toxic air, poisoned water, corrupted soil." };
    const state = this.data.canyonStates.canyon_states.find(s => s.id === stateId);
    return state || { name: 'Unknown State', effect: 'Standard rules apply.' };
  }

  generateFinale(plotFamily, danger, location, factions) {
    const damage = danger + 1;

    const plotFinales = {
      'extraction_heist': [
        { title: 'RIVAL EXTRACTORS ARRIVE',  flavor: 'You weren\'t the only ones with this idea.',         effect: `Deploy ${damage} hostile NPC models. They attack whoever is winning.`,                          ticker: '×2 VP', player_note: 'New enemies target the leader. If you\'re ahead, prepare for a fight.',            weight: 10 },
        { title: 'RESOURCE DEPLETION',        flavor: 'The cache is running dry.',                          effect: 'Halve all remaining resource values. First to extract gets full points.',                      ticker: '÷2 VP', player_note: 'Rush objectives now. Waiting means they\'re worth less.',                        weight: 5  }
      ],
      'ambush_derailment': [
        { title: 'THE RAIL EXPLODES',          flavor: 'Someone rigged the tracks.',                         effect: `All models within 6" of rails take ${damage} dice damage. Rails become Impassable.`,           ticker: '×2 VP', player_note: 'Get away from the rails before Round 6. Cargo near rails is lost.',               weight: 8  },
        { title: 'REINFORCEMENT TRAIN',        flavor: 'Steel screams as the engine arrives.',               effect: `Each faction deploys ${damage} Grunt units from board edge. VP for kills doubles.`,            ticker: '×2 VP', player_note: 'Both sides get reinforcements. Hold your objectives before the fresh troops arrive.',weight: 7  }
      ],
      'claim_and_hold': [
        { title: 'TERRITORIAL DEADLINE',       flavor: 'The Canyon judges who truly holds this ground.',     effect: 'Only models ON objectives score. All VP values double.',                                         ticker: '×2 VP', player_note: 'If you\'re not standing on it at Round 6, it doesn\'t count.',                  weight: 10 },
        { title: 'CONTESTED COLLAPSE',         flavor: 'The ground rejects your claim.',                     effect: 'All contested objectives become Impassable. Uncontested objectives triple VP.',                 ticker: '×3 VP', player_note: 'Secure one fully or lose them all. Split forces = disaster.',                  weight: 4  }
      ],
      'corruption_ritual': [
        { title: 'THE RITUAL COMPLETES',       flavor: 'The ground cracks open. Something answers.',         effect: `${location.name} transforms. If ritual wasn't stopped, deploy Corrupted entity.`,               ticker: '×2 VP', player_note: 'If nobody disrupted the ritual, a new threat spawns.',                            weight: 9  },
        { title: 'TAINT SPREADS',              flavor: 'Corruption seeps across the battlefield.',           effect: `All terrain becomes Tainted. Models on Tainted ground take ${damage - 1} damage per round.`,   ticker: '÷2 VP', player_note: 'Standing still kills you. Keep moving or find Clean ground.',                  weight: 6  }
      ]
    };

    let finalePool = plotFinales[plotFamily.id];

    if (!finalePool || finalePool.length === 0) {
      finalePool = [
        { title: 'THE CANYON REJECTS YOU', flavor: 'The very earth begins to buckle.', effect: `All units take ${damage} dice of environmental damage. VP for surviving units doubles.`, ticker: '×2 VP', player_note: 'Every unit on the table takes damage simultaneously. Keep your strongest models alive — they score double.' },
        { title: 'NO SURRENDER',           flavor: 'The local factions commit everything they have.',        effect: `Deploy extra Grunt units for every faction. VP for kills doubles.`,                                ticker: '×2 VP', player_note: "Both sides get more bodies. Don't overextend before Round 6 — you'll be outnumbered." }
      ];
    }

    const finale = this.weightedRandomChoice(finalePool);

    return {
      round:             6,
      title:             finale.title,
      narrative:         finale.flavor,
      mechanical_effect: finale.effect,
      ticker_effect:     finale.ticker,
      player_note:       finale.player_note,
      escalation_type:   plotFamily.id
    };
  }

  // ================================
  // CULTIST ENCOUNTER (STEP 4.5)
  // ================================
  generateCultistEncounter(userSelections, plotFamily, location) {
    const danger       = userSelections.dangerRating;
    const canyonStateId= userSelections.canyonState || 'poisoned';

    let baseChance = 0;
    if      (danger <= 1) baseChance = 0.03;
    else if (danger === 2) baseChance = 0.05;
    else if (danger === 3) baseChance = 0.10;
    else if (danger === 4) baseChance = 0.15;
    else if (danger === 5) baseChance = 0.20;
    else                   baseChance = 0.30;

    if (plotFamily.id === 'corruption_ritual') baseChance = Math.min(1.0, baseChance * 2);

    const stateModifier = CULTIST_STATE_MODIFIERS[canyonStateId]?.modifier || 0;
    const finalChance   = Math.min(1.0, Math.max(0, baseChance + stateModifier));

    console.log(`  Cultist check: base=${baseChance}, state_mod=${stateModifier}, final=${finalChance.toFixed(2)}`);

    if (Math.random() > finalChance) return null;

    console.log("  🔥 CULTISTS ARE COMING");

    let availableCults = [...CULT_REGISTRY];
    const hasCrowQueen = userSelections.factions.some(f => f.id === 'crow_queen');
    if (hasCrowQueen) availableCults = availableCults.filter(c => c.id !== 'regents_faithful');

    const selectedCult  = this.weightedRandomChoice(availableCults);
    const pressureTrack = PRESSURE_TRACKS[selectedCult.id];
    if (!pressureTrack) { console.error(`⚠️ No pressure track for cult: ${selectedCult.id}`); return null; }

    let forceMin, forceMax;
    if      (danger <= 3)  { forceMin = 2; forceMax = 3; }
    else if (danger === 4) { forceMin = 2; forceMax = 4; }
    else if (danger === 5) { forceMin = 3; forceMax = 4; }
    else                   { forceMin = 4; forceMax = 5; }

    const actualForce    = forceMin + Math.floor(Math.random() * (forceMax - forceMin + 1));
    const playerFactions = userSelections.factions.filter(f => !f.isNPC);
    const allFactions    = userSelections.factions;

    let controllerNote = '';
    let controllerFaction = null;

    if (playerFactions.length >= 2) {
      controllerFaction = this.randomChoice(playerFactions);
      controllerNote = `${controllerFaction.name} controls the cultists first. Control rotates to the next player each round.`;
    } else if (playerFactions.length === 1) {
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

    const pressureDescription = this.generatePressureDescription(pressureTrack, selectedCult, location);

    return {
      enabled:    true,
      cult:       { id: selectedCult.id, name: selectedCult.name, theme: selectedCult.theme, color: selectedCult.color, description: selectedCult.description },
      pressure: {
        type:             pressureTrack.type,
        label:            pressureTrack.label,
        description:      pressureDescription,
        rate:             pressureTrack.rate,
        max:              pressureTrack.max,
        current:          0,
        consumes:         pressureTrack.consumes,
        thresholds:       pressureTrack.thresholds,
        visual:           pressureTrack.visual,
        player_experience:pressureTrack.player_experience
      },
      force_size:       actualForce,
      controller:       controllerFaction ? { id: controllerFaction.id, name: controllerFaction.name } : null,
      controller_note:  controllerNote,
      everyone_loses:   true,
      state_modifier_used:   stateModifier,
      chance_that_was_rolled:parseFloat(finalChance.toFixed(2))
    };
  }

  // ================================
  // WANDERING NPCs (STEP 11)
  // ================================
  generateWanderingNPCs(location, danger) {
    const npcs = [];

    // Vendomat — 30% base, +4% per danger above 2
    const vendomat_chance = Math.min(0.80, 0.30 + Math.max(0, (danger - 2)) * 0.04);
    console.log(`  Vendomat check: chance=${vendomat_chance.toFixed(2)}`);
    if (Math.random() < vendomat_chance) {
      npcs.push({
        id:        'vendomat',
        name:      'The Vendomat',
        emoji:     '🎃',
        placement: 'random_board_quarter',
        note:      'Place in any board quarter. It moves d6" in a random direction at the start of each round.',
        warning:   'Explodes on death — every model within 10" takes 1 automatic hit.'
      });
      console.log('  🎃 VENDOMAT IS HERE');
    }

    // Monte Haul — 20% base, +5% per danger above 2. Does not appear at Danger 1.
    if (danger >= 2) {
      const monte_chance = Math.min(0.70, 0.20 + Math.max(0, (danger - 2)) * 0.05);
      console.log(`  Monte Haul check: chance=${monte_chance.toFixed(2)}`);
      if (Math.random() < monte_chance) {
        npcs.push({
          id:        'monte_haul',
          name:      'Monte Haul',
          emoji:     '⚙️',
          placement: 'board_center_or_nearest_open',
          note:      'Place at board center. He cannot move — ever. Sells weapons, venom, and special gear for 4 Gildren.',
          warning:   'Attacking Monte Haul costs your faction 2 VP. His brass fists push back 3" and Stagger. Goes into Lockdown at Quality 2.'
        });
        console.log('  ⚙️ MONTE HAUL IS HERE');
      }
    }

    return npcs.length > 0 ? npcs : null;
  }

  // ================================
  // PRESSURE DESCRIPTION
  // ================================
  generatePressureDescription(pressureTrack, cult, location) {
    const descriptions = {
      'fire_spread':          `The ${cult.name} has set fires across ${location.name}. Every round the flames spread further.`,
      'resource_consumption': `The ${cult.name} is consuming the ${pressureTrack.consumes} at ${location.name}. The resource depletes each round.`,
      'necromantic_rise':     `The ${cult.name} is awakening the dead at ${location.name}. More undead rise each round.`,
      'chaos_escalation':     `The ${cult.name} is unleashing chaos at ${location.name}. Reality becomes unstable each round.`,
      'reality_erosion':      `The ${cult.name} is opening rifts to the void at ${location.name}. The barriers between worlds thin each round.`,
      'corruption_spread':    `The ${cult.name} is spreading blight across ${location.name}. Corrupted growth spreads each round.`,
      'death_magic':          `The ${cult.name} is channeling necromantic power at ${location.name}. Death's grip tightens each round.`,
      'dark_consecration':    `The ${cult.name} is consecrating ${location.name} to the Regent Black. Dark oaths spread each round.`
    };
    return descriptions[pressureTrack.type] || `The ${cult.name} has begun their ritual at ${location.name}. Pressure escalates each round.`;
  }

  // ================================
  // COFFIN COUGH STORM (STEP 10)
  // ================================
  generateCoffinCough(location, danger) {
    const baseChance  = location.coffinCoughChance || 0.10;
    const dangerBonus = Math.max(0, (danger - 3)) * 0.05;
    const finalChance = Math.min(0.95, baseChance + dangerBonus);

    console.log(`  Coffin Cough check: base=${baseChance}, danger_bonus=${dangerBonus.toFixed(2)}, final=${finalChance.toFixed(2)}`);

    if (Math.random() > finalChance) {
      console.log("  No Coffin Cough this time.");
      return null;
    }

    console.log("  COFFIN COUGH IS COMING");

    const effects = [
      { name: 'Rolling Coffin Cough', effects: ['Place a 6" radius Choking zone touching any board edge.', 'At the end of each round, it drifts 3" in a direction chosen by the Warden.'] },
      { name: 'Ashfall',              effects: ['All models suffer -1 die on ranged attacks until end of next round.', 'Burning terrain automatically escalates.'] },
      { name: 'Visibility Collapse',  effects: ['Line of Sight beyond 12" is blocked until end of next round.', 'Fog blocks clarity and intent, not movement.'] },
      { name: 'Panic on the Wind',    effects: ['All models must test Morale at the start of their next activation.'] },
      { name: 'Dead Ground',          effects: ["One heavily contested terrain feature becomes Haunted or Unstable (Warden's choice)."] },
      { name: 'Canyon Remembers',     effects: ['All Tainted terrain immediately escalates to Haunted.'] }
    ];

    // Pick one — fully resolved for the players
    const picked = this.randomChoice(effects);

    return { active: true, effect: picked };
  }

  // ================================
  // TERRAIN SETUP (STEP 9)
  // ================================
  generateTerrainSetup(plotFamily, location, danger, objectives, cultistEncounter) {
    const baseSetup  = TERRAIN_MAP[plotFamily.id] || TERRAIN_MAP['claim_and_hold'];
    const thyrCount  = Math.min(12, Math.max(3, danger * 2));
    const totalPieces= Math.min(6, 3 + Math.min(danger, 3));

    const objMarkers = objectives ? objectives.map(obj => {
      const genericMap = {
        'ritual_circle':      'Ritual Site - 6" circle',
        'tainted_ground':     'Corrupted Ground markers (×' + (obj.target_value || 2) + ')',
        'scattered_crates':   'Supply Crates (×' + (obj.target_value || 3) + ')',
        'land_marker':        'Territory Markers (×' + (obj.target_value || 3) + ') - obelisks or flags',
        'fortified_position': 'Fortified Position - bunker or watchtower',
        'wrecked_engine':     'Wrecked Engine - large terrain piece',
        'stored_supplies':    'Supply Depot - 3" building',
        'artifact':           'Artifact - place on high ground or hidden',
        'resource_extraction':`${obj.progress_label} - use ${(obj.progress_label||'resource').toLowerCase()} tokens`
      };
      return genericMap[obj.type] || obj.name + ' marker';
    }) : [];

    const cultMarkers = (cultistEncounter?.enabled && cultistEncounter?.pressure)
      ? (CULTIST_TERRAIN_MARKERS[cultistEncounter.pressure.type] || ['Pressure markers - see pressure visual description'])
      : [];

    return {
      atmosphere:       baseSetup.atmosphere,
      core_terrain:     baseSetup.core,
      optional_terrain: baseSetup.optional,
      objective_markers:objMarkers,
      cultist_markers:  cultMarkers,
      thyr_crystals:    { count: thyrCount, placement: 'Scatter across the board. Each model is a cache — when mined, roll for how many crystals are inside.' },
      total_terrain_pieces: totalPieces,
      setup_note:       `Place ${totalPieces} terrain pieces total. Core terrain is required. Optional terrain adds cover.`
    };
  }

  // ================================
  // HELPERS & UTILITIES
  // ================================
  getDangerDesc(rating) {
    const levels = ['None', 'Tutorial / Low Escalation', 'Frontier Skirmish', 'Standard Coffin Canyon', 'High Pressure', 'Escalation Guaranteed', 'Catastrostorm Risk'];
    return levels[rating] || 'Extreme Danger';
  }

  formatResourceName(key) {
    const pretty = {
      'food_foul':        'Foul Food',   'food_good':      'Good Food',
      'water_foul':       'Foul Water',  'water_clean':    'Clean Water',
      'mechanical_parts': 'Mechanical Parts', 'tzul_silver': 'Tzul Silver',
      'thyr':             'Thyr Crystals','livestock':     'Livestock',
      'supplies':         'Supplies',    'silver':         'Silver',
      'lead':             'Lead',        'coal':           'Coal',
      'weapons':          'Weapons',     'food':           'Food',
      'water':            'Water',       'gildren':        'Gildren',
      'vitagood':         'VitaGood'
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

  weightedRandomChoice(arr) {
    if (!arr || arr.length === 0) return null;
    const hasWeights = arr.some(item => item.weight !== undefined);
    if (!hasWeights) return this.randomChoice(arr);
    const totalWeight = arr.reduce((sum, item) => sum + (item.weight || 1), 0);
    let random = Math.random() * totalWeight;
    for (let item of arr) {
      random -= (item.weight || 1);
      if (random <= 0) return item;
    }
    return arr[arr.length - 1];
  }

  parseTemplate(template, context) {
    if (!template) return '';
    return template.replace(/{(\w+)}/g, (match, key) => context[key] !== undefined ? context[key] : match);
  }
}

// Expose to window
window.ScenarioBrain = ScenarioBrain;
console.log("🎉 SCENARIO BRAIN: Fully assembled and ready!");
