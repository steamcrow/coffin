// ================================
// BRAIN CONSTANTS
// All registries, lookups, and data structures
// ================================

console.log("📊 Brain Constants loading...");

// ================================
// CULT REGISTRY
// ================================
const CULT_REGISTRY = [
  { id: 'sons_of_ralu', name: 'Sons of Ralu', theme: 'Chaos & Destruction', color: '#c44569', description: 'Worshippers of RALU, the monster god of chaos. They seek to unleash primal, mindless destruction upon the Canyon.', weight: 8 },
  { id: 'new_children_of_tzul', name: 'The New Children of Tzul', theme: 'Undead & Ancient Power', color: '#7b2d8b', description: 'A new cult worshipping the ancient Tzul. They aid and summon the undead, seeking to resurrect their dark masters.', weight: 7 },
  { id: 'burning_choir', name: 'The Burning Choir', theme: 'Fire & Purification', color: '#e84545', description: 'Apocalypse cultists who believe the world must burn to be reborn. Fire is their sacrament.', weight: 6 },
  { id: 'children_of_hollow', name: 'Children of the Hollow', theme: 'Void & Madness', color: '#5a5aaa', description: 'They worship the void between worlds. Their rituals dissolve reality itself.', weight: 5 },
  { id: 'thyr_eaters', name: 'The Thyr Eaters', theme: 'Addiction & Consumption', color: '#daa520', description: 'Addicted to raw Thyr energy. They consume all magic and crystals, growing ever hungrier.', weight: 8 },
  { id: 'blighted_root', name: 'The Blighted Root', theme: 'Corrupted Nature', color: '#4caf50', description: 'Nature corruption cultists. They twist plants and beasts into horrifying, spreading abominations.', weight: 4 },
  { id: 'bone_singers', name: 'The Bone Singers', theme: 'Death Magic', color: '#78909c', description: 'Practitioners of death magic who raise the dead and commune with the grave.', weight: 7 },
  { id: 'regents_faithful', name: "Regent's Faithful", theme: 'Dark Monarchy', color: '#8e24aa', description: "Secret worshippers of a dark monarch. Only appear when The Crow Queen is NOT in the scenario.", weight: 3 }
];

const FACTION_CORE_VERBS = {
  monster_rangers: { primary_verb: 'PROTECT', secondary_verbs: ['PRESERVE', 'STABILIZE', 'DEFEND'], approach: 'defensive' },
  liberty_corps: { primary_verb: 'CONTROL', secondary_verbs: ['SECURE', 'ENFORCE', 'OCCUPY'], approach: 'authoritarian' },
  monsterology: { primary_verb: 'DEVOUR', secondary_verbs: ['HARVEST', 'EXTRACT', 'CONSUME'], approach: 'exploitative' },
  shine_riders: { primary_verb: 'STEAL', secondary_verbs: ['LOOT', 'RAID', 'PLUNDER'], approach: 'opportunistic' },
  crow_queen: { primary_verb: 'CONSECRATE', secondary_verbs: ['CLAIM', 'SANCTIFY', 'CONVERT'], approach: 'mystical' },
  monsters: { primary_verb: 'BREED', secondary_verbs: ['FEED', 'NEST', 'MIGRATE'], approach: 'primal' }
};

const FACTION_THEMES = {
  'monster_rangers': {
    primary_theme: 'Protect the Wild',
    pressure_stance: 'containment',
    resource_priorities: ['livestock', 'clean_water', 'wildlife']
  },
  'liberty_corps': {
    primary_theme: 'Federal Control',
    pressure_stance: 'containment',
    resource_priorities: ['weapons', 'supplies', 'communications']
  },
  'monsterology': {
    primary_theme: 'Scientific Progress',
    pressure_stance: 'exploitation',
    resource_priorities: ['thyr', 'specimens', 'mechanical_parts']
  },
  'shine_riders': {
    primary_theme: 'Profit from Chaos',
    pressure_stance: 'opportunist',
    resource_priorities: ['valuables', 'contraband', 'weapons']
  },
  'crow_queen': {
    primary_theme: 'Establish Dominion',
    pressure_stance: 'redirection',
    resource_priorities: ['territory', 'followers', 'relics']
  },
  'monsters': {
    primary_theme: 'Reclaim Territory',
    pressure_stance: 'adaptive',
    resource_priorities: ['food', 'territory', 'safety']
  }
};

const PRESSURE_TRACKS = {
  'sons_of_ralu': {
    type: 'chaos_escalation',
    label: 'Chaos Spreading',
    rate: 1,
    max: 6,
    consumes: null,
    thresholds: {
      2: { effect: 'minor_mutations', desc: 'Strange growths appear on terrain', forces_cooperation: false },
      4: { effect: 'major_instability', desc: 'Reality becomes unstable - all terrain Difficult', forces_cooperation: true },
      6: { effect: 'catastrophe', desc: 'Chaos unleashed - location becomes Wild', world_scar: 'Wild' }
    },
    visual: 'Chaos corruption markers spread across board',
    player_experience: 'Terrain and units behave unpredictably'
  },
  'new_children_of_tzul': {
    type: 'necromantic_rise',
    label: 'Undead Rising',
    rate: 1,
    max: 6,
    consumes: null,
    thresholds: {
      2: { effect: 'shambling_dead', desc: 'Undead servants spawn at burial sites', forces_cooperation: false },
      4: { effect: 'tzul_awakening', desc: 'Ancient Tzul warriors rise - hostile to all', forces_cooperation: true },
      6: { effect: 'catastrophe', desc: 'Tzul King manifests - everyone loses', world_scar: 'Haunted' }
    },
    visual: 'Undead models appear at ritual markers',
    player_experience: 'Fighting on two fronts - factions AND undead'
  },
  'burning_choir': {
    type: 'fire_spread',
    label: 'Flames Spreading',
    rate: 1,
    max: 6,
    consumes: null,
    thresholds: {
      2: { effect: 'smoke_penalty', desc: 'Smoke obscures battlefield - ranged attacks -1 die', forces_cooperation: false },
      4: { effect: 'inferno', desc: 'Buildings collapse, terrain destroyed', forces_cooperation: true },
      6: { effect: 'catastrophe', desc: 'Scorched earth - location becomes Depleted', world_scar: 'Scorched' }
    },
    visual: 'Fire tokens spread each round',
    player_experience: 'Shrinking battlefield, forced movement'
  },
  'children_of_hollow': {
    type: 'reality_erosion',
    label: 'Void Incursion',
    rate: 1,
    max: 6,
    consumes: null,
    thresholds: {
      2: { effect: 'void_whispers', desc: 'Models must pass Will checks or Act Erratically', forces_cooperation: false },
      4: { effect: 'dimensional_tears', desc: 'Random teleportation effects - models displaced', forces_cooperation: true },
      6: { effect: 'catastrophe', desc: 'Reality collapses - location Forbidden', world_scar: 'Forbidden' }
    },
    visual: 'Void rifts appear as terrain features',
    player_experience: 'Sanity mechanics, unpredictable board state'
  },
  'thyr_eaters': {
    type: 'resource_consumption',
    label: 'Thyr Depletion',
    rate: 1,
    max: 6,
    consumes: 'thyr',
    thresholds: {
      2: { effect: 'crystal_dimming', desc: 'Thyr crystals pulse erratically - magic unreliable', forces_cooperation: false },
      4: { effect: 'magical_collapse', desc: 'Thyr vein collapsing - all magical abilities -2 dice', forces_cooperation: true },
      6: { effect: 'catastrophe', desc: 'Dead zone - all magic fails, location Depleted', world_scar: 'Depleted' }
    },
    visual: 'Thyr crystal markers dim and disappear',
    player_experience: 'Resource race - extract before depletion'
  },
  'blighted_root': {
    type: 'corruption_spread',
    label: 'Blight Spreading',
    rate: 1,
    max: 6,
    consumes: null,
    thresholds: {
      2: { effect: 'tainted_growth', desc: 'Corrupted plants grow - terrain becomes Difficult', forces_cooperation: false },
      4: { effect: 'twisted_ecosystem', desc: 'Plants attack models - 2 damage per round in vegetation', forces_cooperation: true },
      6: { effect: 'catastrophe', desc: 'Permanent corruption - location becomes Tainted', world_scar: 'Tainted' }
    },
    visual: 'Corruption spreads from ritual sites',
    player_experience: 'Safe zones shrink, must keep moving'
  },
  'bone_singers': {
    type: 'death_magic',
    label: 'Necromantic Power',
    rate: 1,
    max: 6,
    consumes: null,
    thresholds: {
      2: { effect: 'grave_chill', desc: 'All models -1 to Movement', forces_cooperation: false },
      4: { effect: 'mass_resurrection', desc: 'All killed models return as hostile undead', forces_cooperation: true },
      6: { effect: 'catastrophe', desc: 'Death claims all - location becomes Haunted', world_scar: 'Haunted' }
    },
    visual: 'Killed models remain on board as threats',
    player_experience: 'Cautious combat - kills create problems'
  },
  'regents_faithful': {
    type: 'dark_consecration',
    label: 'Dark Monarchy Rising',
    rate: 1,
    max: 6,
    consumes: null,
    thresholds: {
      2: { effect: 'whispered_oaths', desc: 'Models must resist Dominated status', forces_cooperation: false },
      4: { effect: 'regents_gaze', desc: 'Regent Black manifests - hostile to all non-Queen factions', forces_cooperation: true },
      6: { effect: 'catastrophe', desc: 'Eternal allegiance - location becomes Consecrated', world_scar: 'Consecrated' }
    },
    visual: 'Dark obelisks rise from ground',
    player_experience: 'Mind control effects, loyalty tests'
  }
};

const CULTIST_STATE_MODIFIERS = {
  'poisoned': { modifier: 0.10, reason: 'Corruption breeds cult activity' },
  'haunted': { modifier: 0.25, reason: 'Dark energy draws cultists like moths to flame' },
  'exalted': { modifier: 0.20, reason: 'The Regent\'s dark power awakens darker forces' },
  'strangewild': { modifier: 0.10, reason: 'Feral chaos makes cults bold and reckless' },
  'lawless': { modifier: 0.05, reason: 'No law means no one stops the cults' },
  'liberated': { modifier: -0.15, reason: 'Federal order suppresses cult activity' },
  'extracted': { modifier: -0.05, reason: 'Stripped wasteland offers little for rituals' },
  'rusted': { modifier: -0.10, reason: 'Machines don\'t worship gods' },
  'held': { modifier: 0.0, reason: 'Controlled territory. Cults are watched.' }
};

const TERRAIN_MAP = {
  'extraction_heist': { core: ['Mine Entrance', 'Thyr Extraction Rig', 'Supply Crates (×3)'], optional: ['Quonset Huts', 'Rail Tracks'], atmosphere: 'Active industrial dig site' },
  'claim_and_hold': { core: ['Fortified Post', 'Territory Markers (×3)', 'Board Walks'], optional: ['Ruined Cantina', 'Stilt Buildings'], atmosphere: 'Contested frontier outpost' },
  'ambush_derailment': { core: ['Rail Tracks', 'Overpass / Bridge', 'Scattered Crates (×4)'], optional: ['Stagecoach Ruins', 'Rocky Outcrop'], atmosphere: 'Remote stretch of rail' },
  'siege_standoff': { core: ['Fortified Wall', 'Guard Tower', 'Barricades (×2)'], optional: ['Quonset Huts', 'Supply Depot'], atmosphere: 'Fortified position under siege' },
  'escort_run': { core: ['Trail Path', 'Waypoint Markers (×2)', 'Escort Cargo'], optional: ['Monster Den / Nest', 'Bridge Ruins'], atmosphere: 'Dangerous mountain trail' },
  'sabotage_strike': { core: ['Thyr Extraction Rig', 'Dynamo', 'Control Panel'], optional: ['Quonset Huts', 'Rail Tracks'], atmosphere: 'Active industrial site. Explosions possible.' },
  'corruption_ritual': { core: ['Ritual Circle', 'Tainted Ground', 'Ancient Altar'], optional: ['Tzul Ruins', 'Strange Plants'], atmosphere: 'Dark, oppressive, and wrong.' },
  'natural_disaster_response': { core: ['Cracked Ground', 'Collapsing Structure', 'Evacuation Point'], optional: ['Buried Supplies', 'Unstable Terrain'], atmosphere: 'Active catastrophe.' }
};

const VP_SYSTEMS = {
  'extraction_heist': { primary: 'Items Extracted', primary_vp: 3, bonus: 'Speed Bonus', bonus_vp: 1, ticker_primary: 2, ticker_bonus: 1 },
  'claim_and_hold': { primary: 'Rounds Controlled', primary_vp: 2, bonus: 'Consecutive Control', bonus_vp: 3, ticker_primary: 2, ticker_bonus: 2 },
  'corruption_ritual': { primary: 'Rituals Disrupted', primary_vp: 4, bonus: 'Taint Cleansed', bonus_vp: 2, ticker_primary: 4, ticker_bonus: 1 },
  'ambush_derailment': { primary: 'Cargo Secured', primary_vp: 3, bonus: 'Ambush Success', bonus_vp: 2, ticker_primary: 3, ticker_bonus: 1 },
  'siege_standoff': { primary: 'Defenses Held', primary_vp: 2, bonus: 'Breach Points', bonus_vp: 3, ticker_primary: 2, ticker_bonus: 2 },
  'escort_run': { primary: 'Cargo Delivered', primary_vp: 4, bonus: 'Zero Casualties', bonus_vp: 3, ticker_primary: 3, ticker_bonus: 2 },
  'sabotage_strike': { primary: 'Targets Destroyed', primary_vp: 4, bonus: 'Clean Escape', bonus_vp: 2, ticker_primary: 3, ticker_bonus: 1 },
  'natural_disaster_response': { primary: 'Civilians Saved', primary_vp: 3, bonus: 'Resources Secured', bonus_vp: 2, ticker_primary: 2, ticker_bonus: 1 }
};

const FACTION_PLOT_AFFINITIES = {
  'monster_rangers': { 'corruption_ritual': 3, 'natural_disaster_response': 2, 'escort_run': 2 },
  'liberty_corps': { 'claim_and_hold': 2, 'siege_standoff': 2, 'escort_run': 1 },
  'monsterology': { 'extraction_heist': 2, 'corruption_ritual': 2, 'sabotage_strike': 1 },
  'shine_riders': { 'extraction_heist': 2, 'sabotage_strike': 2, 'ambush_derailment': 1 },
  'crow_queen': { 'corruption_ritual': 2, 'claim_and_hold': 1, 'siege_standoff': 1 },
  'monsters': { 'natural_disaster_response': 2, 'ambush_derailment': 1 }
};

const OBJECTIVE_BUILDERS = {
  'wrecked_engine': (loc, danger, vpSpread) => ({
    name: 'Salvage Wrecked Engine',
    description: `Extract mechanical components from wrecked machinery at ${loc.name}.`,
    target_value: Math.min(3, danger),
    progress_label: 'Components',
    vp_per_unit: 3,
    type: 'wrecked_engine'
  }),
  'scattered_crates': (loc, danger, vpSpread) => ({
    name: 'Recover Supply Crates',
    description: `Collect scattered supply crates across the battlefield at ${loc.name}.`,
    target_value: danger + 1,
    progress_label: 'Crates',
    vp_per_unit: 2,
    type: 'scattered_crates'
  }),
  'ritual_circle': (loc, danger, vpSpread) => ({
    name: 'Control Ritual Site',
    description: `Maintain control of the ritual circle at ${loc.name} to channel its power.`,
    target_value: danger,
    progress_label: 'Rituals',
    vp_per_unit: 4,
    type: 'ritual_circle'
  }),
  'land_marker': (loc, danger, vpSpread) => ({
    name: 'Establish Territory',
    description: `Plant territorial markers at ${loc.name} and hold them.`,
    target_value: 3,
    progress_label: 'Rounds',
    vp_per_unit: vpSpread.ticker.primary_per_vp,
    type: 'land_marker'
  }),
  'fortified_position': (loc, danger, vpSpread) => ({
    name: 'Hold Fortified Position',
    description: `Maintain control of the defensive structure at ${loc.name}.`,
    target_value: 3,
    progress_label: 'Rounds',
    vp_per_unit: vpSpread.ticker.primary_per_vp,
    type: 'fortified_position'
  }),
  'stored_supplies': (loc, danger, vpSpread) => ({
    name: 'Raid Supply Depot',
    description: `Extract stockpiled resources from the supply depot at ${loc.name}.`,
    target_value: danger + 1,
    progress_label: 'Supplies',
    vp_per_unit: 2,
    type: 'stored_supplies'
  }),
  'artifact': (loc, danger, vpSpread) => ({
    name: 'Recover Ancient Artifact',
    description: `Secure mysterious artifact of unknown power from ${loc.name}.`,
    target_value: 1,
    progress_label: 'Artifact',
    vp_per_unit: 8,
    type: 'artifact'
  }),
  'tainted_ground': (loc, danger, vpSpread) => ({
    name: 'Cleanse Tainted Ground',
    description: `Purify corrupted territory at ${loc.name}.`,
    target_value: Math.max(2, danger - 1),
    progress_label: 'Sites Cleansed',
    vp_per_unit: 4,
    type: 'tainted_ground'
  }),
  'resource_extraction': (loc, danger, vpSpread, extra) => {
    // FIX: Add specific container types for different resources
    const containerMap = {
      'Water': `water barrels at ${loc.name}`,
      'Clean Water': `water tanks at ${loc.name}`,
      'Foul Water': `contaminated water barrels at ${loc.name}`,
      'Food': `food crates at ${loc.name}`,
      'Good Food': `preserved food supplies at ${loc.name}`,
      'Foul Food': `spoiled food stockpile at ${loc.name}`,
      'Supplies': `supply depot at ${loc.name}`,
      'Mechanical Parts': `salvage yard at ${loc.name}`,
      'Tzul Silver': `tzul silver cache at ${loc.name}`,
      'Silver': `silver ingots at ${loc.name}`,
      'Lead': `lead stockpile at ${loc.name}`,
      'Coal': `coal bunker at ${loc.name}`,
      'Livestock': `corrals at ${loc.name}`,
      'Gildren': `gildren hoard at ${loc.name}`,
      'Thyr Crystals': `thyr crystal deposits at ${loc.name}`,
      'Weapons': `armory at ${loc.name}`
    };
    
    const container = containerMap[extra.name] || `${extra.name.toLowerCase()} at ${loc.name}`;
    
    return {
      name: `Extract ${extra.name}`,
      description: `Secure valuable ${extra.name.toLowerCase()} from the ${container}.`,
      target_value: extra.amount,
      progress_label: extra.name,
      vp_per_unit: extra.vp,
      type: 'resource_extraction'
    };
  }
};

const CULTIST_TERRAIN_MARKERS = {
  'chaos_escalation': ['Chaos Corruption Markers (x3)', 'Reality Distortion Zones'],
  'necromantic_rise': ['Burial Ground', 'Ritual Circle', 'Undead Spawn Points (x2)'],
  'fire_spread': ['Fire Source Markers (x3)', 'Burning Terrain'],
  'reality_erosion': ['Void Rift Markers (x2)', 'Dimensional Tear'],
  'resource_consumption': ['Thyr Crystal Cache', 'Consumption Device', 'Depleted Crystal Markers'],
  'corruption_spread': ['Blight Heart', 'Corrupted Terrain Markers (x3)'],
  'death_magic': ['Necromantic Focus', 'Grave Sites (x2)', 'Death Magic Circle'],
  'dark_consecration': ['Dark Obelisks (x3)', 'Consecration Circle']
};

console.log("✅ Brain Constants loaded!");

// Make constants globally accessible
if (typeof window !== 'undefined') {
  window.CULT_REGISTRY = CULT_REGISTRY;
  window.FACTION_CORE_VERBS = FACTION_CORE_VERBS;
  window.FACTION_THEMES = FACTION_THEMES;
  window.PRESSURE_TRACKS = PRESSURE_TRACKS;
  window.CULTIST_STATE_MODIFIERS = CULTIST_STATE_MODIFIERS;
  window.TERRAIN_MAP = TERRAIN_MAP;
  window.VP_SYSTEMS = VP_SYSTEMS;
  window.FACTION_PLOT_AFFINITIES = FACTION_PLOT_AFFINITIES;
  window.OBJECTIVE_BUILDERS = OBJECTIVE_BUILDERS;
  window.CULTIST_TERRAIN_MARKERS = CULTIST_TERRAIN_MARKERS;
  
  window.BRAIN_CONSTANTS = {
    CULT_REGISTRY,
    FACTION_CORE_VERBS,
    FACTION_THEMES,
    PRESSURE_TRACKS,
    CULTIST_STATE_MODIFIERS,
    TERRAIN_MAP,
    VP_SYSTEMS,
    FACTION_PLOT_AFFINITIES,
    OBJECTIVE_BUILDERS,
    CULTIST_TERRAIN_MARKERS
  };
}
