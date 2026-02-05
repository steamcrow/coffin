// ================================
// BRAIN CONSTANTS
// All data registries, lookup tables, and configuration
// ================================

console.log("📊 Brain Constants loading...");

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
// FACTION CORE VERBS
// ================================
const FACTION_CORE_VERBS = {
  monster_rangers: {
    primary_verb: 'PROTECT',
    secondary_verbs: ['PRESERVE', 'STABILIZE', 'DEFEND'],
    approach: 'defensive'
  },
  liberty_corps: {
    primary_verb: 'CONTROL',
    secondary_verbs: ['SECURE', 'ENFORCE', 'OCCUPY'],
    approach: 'authoritarian'
  },
  monsterology: {
    primary_verb: 'DEVOUR',
    secondary_verbs: ['HARVEST', 'EXTRACT', 'CONSUME'],
    approach: 'exploitative'
  },
  shine_riders: {
    primary_verb: 'STEAL',
    secondary_verbs: ['LOOT', 'RAID', 'PLUNDER'],
    approach: 'opportunistic'
  },
  crow_queen: {
    primary_verb: 'CONSECRATE',
    secondary_verbs: ['CLAIM', 'SANCTIFY', 'CONVERT'],
    approach: 'mystical'
  },
  monsters: {
    primary_verb: 'BREED',
    secondary_verbs: ['FEED', 'NEST', 'MIGRATE'],
    approach: 'primal'
  }
};

// ================================
// FACTION THEMES
// ================================
const FACTION_THEMES = {
  monster_rangers: {
    primary_theme: 'Protect the Wild',
    secondary_themes: ['Contain threats', 'Preserve balance'],
    tone: 'grim_duty'
  },
  liberty_corps: {
    primary_theme: 'Establish Order',
    secondary_themes: ['Enforce law', 'Control chaos'],
    tone: 'authoritarian'
  },
  monsterology: {
    primary_theme: 'Advance Science',
    secondary_themes: ['Extract knowledge', 'Ignore ethics'],
    tone: 'clinical'
  },
  shine_riders: {
    primary_theme: 'Turn Profit',
    secondary_themes: ['Move fast', 'Sell stories'],
    tone: 'opportunistic'
  },
  crow_queen: {
    primary_theme: 'Serve the Crown',
    secondary_themes: ['Claim territory', 'Convert subjects'],
    tone: 'dark_royal'
  },
  monsters: {
    primary_theme: 'Survive',
    secondary_themes: ['Breed', 'Feed', 'Territory'],
    tone: 'primal'
  }
};

// ================================
// PRESSURE TRACKS (large - just include the structure)
// Full definitions in your original file
// ================================
const PRESSURE_TRACKS = {
  // Cult pressure tracks
  'sons_of_ralu': { type: 'chaos_escalation', label: 'Chaos Spreading', rate: 1, max: 6 },
  'new_children_of_tzul': { type: 'necromantic_rise', label: 'Undead Rising', rate: 1, max: 6 },
  'burning_choir': { type: 'fire_spread', label: 'Flames Spreading', rate: 1, max: 6 },
  'children_of_hollow': { type: 'reality_erosion', label: 'Void Incursion', rate: 1, max: 6 },
  'thyr_eaters': { type: 'resource_consumption', label: 'Thyr Depletion', rate: 1, max: 6 },
  'blighted_root': { type: 'corruption_spread', label: 'Blight Spreading', rate: 1, max: 6 },
  'bone_singers': { type: 'death_magic', label: 'Necromantic Power', rate: 1, max: 6 },
  'regents_faithful': { type: 'dark_consecration', label: 'Dark Monarchy Rising', rate: 1, max: 6 }
  // Add ambient tracks as needed
};

// ================================
// CULTIST STATE MODIFIERS
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
// TERRAIN MAP
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
// VP SYSTEMS
// ================================
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

// ================================
// FACTION PLOT AFFINITIES
// ================================
const FACTION_PLOT_AFFINITIES = {
  'monster_rangers': { 'corruption_ritual': 3, 'natural_disaster_response': 2, 'escort_run': 2 },
  'liberty_corps': { 'claim_and_hold': 2, 'siege_standoff': 2, 'escort_run': 1 },
  'monsterology': { 'extraction_heist': 2, 'corruption_ritual': 2, 'sabotage_strike': 1 },
  'shine_riders': { 'extraction_heist': 2, 'sabotage_strike': 2, 'ambush_derailment': 1 },
  'crow_queen': { 'corruption_ritual': 2, 'claim_and_hold': 1, 'siege_standoff': 1 },
  'monsters': { 'natural_disaster_response': 2, 'ambush_derailment': 1 }
};

// ================================
// OBJECTIVE BUILDERS
// ================================
const OBJECTIVE_BUILDERS = {
  'wrecked_engine': (loc, danger, vpSpread) => ({
    name: 'Salvage Wrecked Engine',
    description: `Extract mechanical components from abandoned machinery at ${loc.name}.`,
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
    description: `Extract stockpiled goods from the depot at ${loc.name}.`,
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
  'resource_extraction': (loc, danger, vpSpread, extra) => ({
    name: `Extract ${extra.name}`,
    description: `Secure valuable ${extra.name.toLowerCase()} from ${loc.name}.`,
    target_value: extra.amount,
    progress_label: extra.name,
    vp_per_unit: extra.vp,
    type: 'resource_extraction'
  })
};

console.log("✅ Brain Constants loaded!");

// Export for use in other modules
if (typeof window !== 'undefined') {
  window.BRAIN_CONSTANTS = {
    CULT_REGISTRY,
    FACTION_CORE_VERBS,
    FACTION_THEMES,
    PRESSURE_TRACKS,
    CULTIST_STATE_MODIFIERS,
    TERRAIN_MAP,
    VP_SYSTEMS,
    FACTION_PLOT_AFFINITIES,
    OBJECTIVE_BUILDERS
  };
}
