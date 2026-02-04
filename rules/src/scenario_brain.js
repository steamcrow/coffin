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
// PRESSURE TRACKS - Cults as Environmental Forces
// ================================
// Cults create escalating pressure, not strategic opposition
// They are weather, infection, entropy - inevitable forces
const PRESSURE_TRACKS = {
  'sons_of_ralu': {
    type: 'chaos_escalation',
    label: 'Chaos Spreading',
    rate: 1,
    max: 6,
    consumes: null, // Doesn't consume resources, just spreads
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
    consumes: 'thyr', // Actually consumes location resource
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
  },
  
  // ================================
  // AMBIENT/NON-CULT PRESSURE TRACKS
  // These occur without cultists - natural disasters, wildlife, social unrest
  // ================================
  
  'earthquake': {
    type: 'seismic_activity',
    label: 'Ground Shaking',
    rate: 1,
    max: 6,
    consumes: null,
    thresholds: {
      2: { effect: 'tremors', desc: 'All terrain becomes Difficult', forces_cooperation: false },
      4: { effect: 'major_quake', desc: 'Buildings collapse. D6 damage to models near structures.', forces_cooperation: true },
      6: { effect: 'catastrophe', desc: 'Canyon splits open - location Fractured', world_scar: 'Fractured' }
    },
    visual: 'Shake table, rubble markers spread',
    player_experience: 'Unpredictable terrain destruction, forced repositioning'
  },
  
  'flash_flood': {
    type: 'rising_water',
    label: 'Flood Waters Rising',
    rate: 1,
    max: 6,
    consumes: null,
    thresholds: {
      2: { effect: 'ankle_deep', desc: 'Difficult terrain. -1 Movement.', forces_cooperation: false },
      4: { effect: 'waist_deep', desc: 'Models must swim or drown. Non-swimmers take 3 damage per round.', forces_cooperation: true },
      6: { effect: 'catastrophe', desc: 'Location underwater - becomes Submerged', world_scar: 'Submerged' }
    },
    visual: 'Water level markers rise each round. Low ground disappears.',
    player_experience: 'Race to high ground, items lost to water, drowning mechanics'
  },
  
  'sandstorm': {
    type: 'weather_hazard',
    label: 'Sandstorm Intensifying',
    rate: 1,
    max: 6,
    consumes: null,
    thresholds: {
      2: { effect: 'poor_visibility', desc: 'Line of Sight reduced to 12". Ranged attacks -1 die.', forces_cooperation: false },
      4: { effect: 'blinding_storm', desc: 'Line of Sight reduced to 6". All models -2 dice to actions.', forces_cooperation: true },
      6: { effect: 'catastrophe', desc: 'Buried alive - location becomes Desert Wastes', world_scar: 'Buried' }
    },
    visual: 'Visibility markers, sand drifts appear',
    player_experience: 'Can\'t see enemies, forced into close combat, choking hazard'
  },
  
  'wildfire': {
    type: 'natural_fire',
    label: 'Wildfire Spreading',
    rate: 1,
    max: 6,
    consumes: null,
    thresholds: {
      2: { effect: 'smoke', desc: 'Smoke zones block line of sight. Models inside take 1 damage.', forces_cooperation: false },
      4: { effect: 'conflagration', desc: 'Fire spreads to all vegetation. 3 damage per round in fire.', forces_cooperation: true },
      6: { effect: 'catastrophe', desc: 'Everything burns - location becomes Scorched', world_scar: 'Scorched' }
    },
    visual: 'Fire spreads naturally from vegetation to vegetation',
    player_experience: 'Natural fire without cultists - wind-driven, unpredictable'
  },
  
  'monster_stampede': {
    type: 'wildlife_threat',
    label: 'Monster Herd Migration',
    rate: 1,
    max: 6,
    consumes: null,
    thresholds: {
      2: { effect: 'distant_rumble', desc: 'Herd approaching. Models hear thundering hooves.', forces_cooperation: false },
      4: { effect: 'stampede', desc: 'Herd crosses board. Models in path take 6 damage. Terrain destroyed.', forces_cooperation: true },
      6: { effect: 'catastrophe', desc: 'Trampled - location becomes Wild', world_scar: 'Wild' }
    },
    visual: 'Monster herd models move across board each round',
    player_experience: 'Avoid the herd or be trampled, terrain rearranged by passage'
  },
  
  'predator_pack': {
    type: 'wildlife_threat',
    label: 'Predator Pack Hunting',
    rate: 1,
    max: 6,
    consumes: null,
    thresholds: {
      2: { effect: 'stalking', desc: 'Predators watching. Models alone are Vulnerable.', forces_cooperation: false },
      4: { effect: 'hunting', desc: 'Pack attacks isolated models. 2d6 damage per round if alone.', forces_cooperation: true },
      6: { effect: 'catastrophe', desc: 'Pack claims territory - location becomes Wild', world_scar: 'Wild' }
    },
    visual: 'Predator models lurk at board edges, attack stragglers',
    player_experience: 'Stay in groups or get picked off, horror movie vibes'
  },
  
  'insect_swarm': {
    type: 'wildlife_threat',
    label: 'Locust Swarm',
    rate: 1,
    max: 6,
    consumes: 'food',
    thresholds: {
      2: { effect: 'buzzing_cloud', desc: 'Swarm blocks vision. -1 die to all actions.', forces_cooperation: false },
      4: { effect: 'devouring', desc: 'Swarm strips all vegetation. Food resources destroyed.', forces_cooperation: true },
      6: { effect: 'catastrophe', desc: 'Famine - location becomes Depleted', world_scar: 'Depleted' }
    },
    visual: 'Swarm tokens spread, vegetation markers removed',
    player_experience: 'Can\'t see through bugs, food disappears, panic sets in'
  },
  
  'drought': {
    type: 'resource_scarcity',
    label: 'Wells Running Dry',
    rate: 1,
    max: 6,
    consumes: 'clean_water',
    thresholds: {
      2: { effect: 'rationing', desc: 'Water scarce. -1 to Endurance checks.', forces_cooperation: false },
      4: { effect: 'desperation', desc: 'Fighting over last water. All factions hostile to water carriers.', forces_cooperation: true },
      6: { effect: 'catastrophe', desc: 'Total drought - location becomes Depleted', world_scar: 'Depleted' }
    },
    visual: 'Water sources dry up, dust spreads',
    player_experience: 'Race for remaining water, thirst mechanics, desperation'
  },
  
  'plague_outbreak': {
    type: 'disease',
    label: 'Plague Spreading',
    rate: 1,
    max: 6,
    consumes: null,
    thresholds: {
      2: { effect: 'infected', desc: 'Models must pass Endurance or become Diseased (-1 to all actions).', forces_cooperation: false },
      4: { effect: 'epidemic', desc: 'Diseased models die at end of round unless treated.', forces_cooperation: true },
      6: { effect: 'catastrophe', desc: 'Quarantine zone - location becomes Forbidden', world_scar: 'Forbidden' }
    },
    visual: 'Disease tokens on models, quarantine markers',
    player_experience: 'Infection spreads through contact, race for cure, triage decisions'
  },
  
  'civilian_riot': {
    type: 'social_pressure',
    label: 'Civilian Panic',
    rate: 1,
    max: 6,
    consumes: null,
    thresholds: {
      2: { effect: 'unrest', desc: 'Crowds block movement. Difficult terrain in populated areas.', forces_cooperation: false },
      4: { effect: 'riot', desc: 'Civilians become hostile. 3d6 attack vs any faction.', forces_cooperation: true },
      6: { effect: 'catastrophe', desc: 'Anarchy - location becomes Lawless', world_scar: 'Lawless' }
    },
    visual: 'Civilian models swarm streets, throw objects',
    player_experience: 'Navigate angry mobs, protect civilians from themselves, control vs compassion'
  },
  
  'toxic_spill': {
    type: 'contamination',
    label: 'Toxins Spreading',
    rate: 1,
    max: 6,
    consumes: null,
    thresholds: {
      2: { effect: 'fumes', desc: 'Toxic clouds. Models in area -1 die, take 1 damage per round.', forces_cooperation: false },
      4: { effect: 'contamination', desc: 'Ground poisoned. All terrain in area becomes Tainted.', forces_cooperation: true },
      6: { effect: 'catastrophe', desc: 'Dead zone - location becomes Poisoned', world_scar: 'Poisoned' }
    },
    visual: 'Toxic cloud spreads from spill point, contaminates terrain',
    player_experience: 'Avoid toxic zones, rescue trapped models, contain the spill'
  },
  
  'ley_line_surge': {
    type: 'magical_anomaly',
    label: 'Wild Magic Surge',
    rate: 1,
    max: 6,
    consumes: 'thyr',
    thresholds: {
      2: { effect: 'unpredictable', desc: 'Magic becomes erratic. All magical abilities roll twice, use worse result.', forces_cooperation: false },
      4: { effect: 'arcane_storm', desc: 'Random magical effects each round. Roll on chaos table.', forces_cooperation: true },
      6: { effect: 'catastrophe', desc: 'Ley line rupture - location becomes Haunted', world_scar: 'Haunted' }
    },
    visual: 'Magical energy arcs between terrain, random spell effects',
    player_experience: 'Magic users endangered, unpredictable battlefield, reality bends'
  },
  
  'time_distortion': {
    type: 'temporal_anomaly',
    label: 'Time Fracturing',
    rate: 1,
    max: 6,
    consumes: null,
    thresholds: {
      2: { effect: 'time_slip', desc: 'Models randomly skip or repeat activations.', forces_cooperation: false },
      4: { effect: 'temporal_chaos', desc: 'Past versions of models appear. Fight your own echoes.', forces_cooperation: true },
      6: { effect: 'catastrophe', desc: 'Time collapses - location becomes Forbidden', world_scar: 'Forbidden' }
    },
    visual: 'Ghost images of models, terrain phases in/out',
    player_experience: 'Weird time mechanics, fight past selves, causality breaks'
  },
  
  'gravity_anomaly': {
    type: 'physics_distortion',
    label: 'Gravity Failing',
    rate: 1,
    max: 6,
    consumes: null,
    thresholds: {
      2: { effect: 'light_gravity', desc: 'Movement +2", falling damage halved, ranged attacks -1 die.', forces_cooperation: false },
      4: { effect: 'no_gravity', desc: 'Models float. Difficult to aim, hard to move. All actions -2 dice.', forces_cooperation: true },
      6: { effect: 'catastrophe', desc: 'Objects torn into sky - location becomes Forbidden', world_scar: 'Forbidden' }
    },
    visual: 'Objects float, dust hangs in air, models drift',
    player_experience: 'Low gravity combat, everything floats, disorienting'
  },
  
  'train_derailment': {
    type: 'industrial_disaster',
    label: 'Runaway Train',
    rate: 1,
    max: 6,
    consumes: null,
    thresholds: {
      2: { effect: 'warning', desc: 'Train whistle. Evacuate the rails.', forces_cooperation: false },
      4: { effect: 'derailment', desc: 'Train crashes. 12" radius explosion. 6d6 damage at center.', forces_cooperation: true },
      6: { effect: 'catastrophe', desc: 'Rail line destroyed - location becomes Ruined', world_scar: 'Ruined' }
    },
    visual: 'Train model barrels across board, crashes spectacularly',
    player_experience: 'Countdown to impact, clear the rails, massive explosion'
  },
  
  'dam_burst': {
    type: 'infrastructure_failure',
    label: 'Dam Failing',
    rate: 1,
    max: 6,
    consumes: null,
    thresholds: {
      2: { effect: 'cracks_forming', desc: 'Water leaking. Low ground becomes Difficult terrain.', forces_cooperation: false },
      4: { effect: 'structural_failure', desc: 'Dam bursts. Wall of water sweeps board. 8 damage to all in path.', forces_cooperation: true },
      6: { effect: 'catastrophe', desc: 'Valley flooded - location becomes Submerged', world_scar: 'Submerged' }
    },
    visual: 'Dam cracks, water gushes, eventually massive flood wave',
    player_experience: 'Race to evacuate low ground, stop the dam breaking, or surf the wave'
  },
  
  'building_collapse': {
    type: 'structural_failure',
    label: 'Buildings Failing',
    rate: 1,
    max: 6,
    consumes: null,
    thresholds: {
      2: { effect: 'unstable', desc: 'Buildings creak. Models on upper floors -1 die to actions.', forces_cooperation: false },
      4: { effect: 'partial_collapse', desc: 'One building collapses each round. Models inside take 6 damage.', forces_cooperation: true },
      6: { effect: 'catastrophe', desc: 'Total collapse - location becomes Ruined', world_scar: 'Ruined' }
    },
    visual: 'Buildings marked unstable, eventually collapse into rubble',
    player_experience: 'Get out before it falls, rescue trapped models, navigate rubble'
  },
  
  'ammunition_fire': {
    type: 'explosive_hazard',
    label: 'Munitions Cooking Off',
    rate: 1,
    max: 6,
    consumes: 'weapons',
    thresholds: {
      2: { effect: 'small_arms', desc: 'Bullets cook off randomly. 1d6 damage to random model each round.', forces_cooperation: false },
      4: { effect: 'explosives', desc: 'Artillery shells explode. 3d6 damage in 6" radius each round.', forces_cooperation: true },
      6: { effect: 'catastrophe', desc: 'Magazine detonates - location becomes Scorched', world_scar: 'Scorched' }
    },
    visual: 'Random explosions, ammunition cache visibly burning',
    player_experience: 'Unpredictable danger from all directions, firefight hazard'
  },
  
  'sinkhole': {
    type: 'geological_hazard',
    label: 'Ground Collapsing',
    rate: 1,
    max: 6,
    consumes: null,
    thresholds: {
      2: { effect: 'subsidence', desc: 'Ground unstable. Random 3" zones become Difficult terrain.', forces_cooperation: false },
      4: { effect: 'major_sinkhole', desc: 'Center of board collapses. Models in area fall, take 4 damage, trapped.', forces_cooperation: true },
      6: { effect: 'catastrophe', desc: 'Cavern opens - location becomes Fractured', world_scar: 'Fractured' }
    },
    visual: 'Cracks spread, ground gives way, pit appears',
    player_experience: 'Watch your footing, rescue fallen models, avoid the pit'
  },
  
  'avalanche': {
    type: 'natural_disaster',
    label: 'Snow Slide',
    rate: 1,
    max: 6,
    consumes: null,
    thresholds: {
      2: { effect: 'rumbling', desc: 'Snow unstable. Loud noises risk triggering slide.', forces_cooperation: false },
      4: { effect: 'avalanche', desc: 'Snow sweeps down slope. Models in path take 6 damage, buried.', forces_cooperation: true },
      6: { effect: 'catastrophe', desc: 'Mountain collapses - location becomes Buried', world_scar: 'Buried' }
    },
    visual: 'Snow accumulates, eventually cascades down',
    player_experience: 'Move quietly, dig out buried allies, escape the slide'
  },
  
  'fungal_bloom': {
    type: 'biological_hazard',
    label: 'Spore Cloud Growing',
    rate: 1,
    max: 6,
    consumes: null,
    thresholds: {
      2: { effect: 'spores', desc: 'Spore clouds spread. Models inhaling spores -1 die to actions.', forces_cooperation: false },
      4: { effect: 'infection', desc: 'Infected models sprout mushrooms. Take 2 damage per round, spread spores.', forces_cooperation: true },
      6: { effect: 'catastrophe', desc: 'Fungal takeover - location becomes Tainted', world_scar: 'Tainted' }
    },
    visual: 'Mushrooms grow, spore clouds drift, infected models bloom',
    player_experience: 'Don\'t breathe deep, burn the infected, body horror'
  },
  
  'ghost_manifestation': {
    type: 'paranormal',
    label: 'Spirits Awakening',
    rate: 1,
    max: 6,
    consumes: null,
    thresholds: {
      2: { effect: 'cold_spots', desc: 'Temperature drops. Models must pass Will checks or become Frightened.', forces_cooperation: false },
      4: { effect: 'manifestations', desc: 'Ghosts appear. Hostile to all living. 3d6 attack, incorporeal.', forces_cooperation: true },
      6: { effect: 'catastrophe', desc: 'Permanently haunted - location becomes Haunted', world_scar: 'Haunted' }
    },
    visual: 'Ghost models materialize, cold mist spreads',
    player_experience: 'Horror atmosphere, can\'t hurt ghosts normally, fear mechanics'
  },
  
  'solar_flare': {
    type: 'cosmic_event',
    label: 'Radiation Storm',
    rate: 1,
    max: 6,
    consumes: null,
    thresholds: {
      2: { effect: 'interference', desc: 'Communications fail. Technology -1 die to function.', forces_cooperation: false },
      4: { effect: 'radiation', desc: 'Harmful radiation. All models take 2 damage per round outdoors.', forces_cooperation: true },
      6: { effect: 'catastrophe', desc: 'Irradiated - location becomes Poisoned', world_scar: 'Poisoned' }
    },
    visual: 'Aurora effect, technology sparks and fails',
    player_experience: 'Get to cover, tech fails, radiation sickness'
  }
};

// ================================
// AMBIENT PRESSURE TRACKS - Environmental Forces (No Cult Required)
// ================================
// These pressures occur naturally or from accidents/disasters
// Scenarios can have these WITHOUT cultist encounters
const AMBIENT_PRESSURE_TRACKS = {
  // ===== NATURAL DISASTERS =====
  'earthquake': {
    type: 'seismic_activity',
    label: 'Ground Shaking',
    rate: 1,
    max: 6,
    consumes: null,
    thresholds: {
      2: { effect: 'tremors', desc: 'Difficult terrain - all Movement -1"', forces_cooperation: false },
      4: { effect: 'major_quake', desc: 'Buildings collapse, models take 2 damage if inside structures', forces_cooperation: true },
      6: { effect: 'catastrophe', desc: 'Canyon splits - location Unstable', world_scar: 'Fractured' }
    },
    visual: 'Terrain pieces shift position each round',
    player_experience: 'Unstable footing, buildings dangerous, forced repositioning'
  },
  
  'flash_flood': {
    type: 'rising_water',
    label: 'Flood Waters Rising',
    rate: 1,
    max: 6,
    consumes: null,
    thresholds: {
      2: { effect: 'ankle_deep', desc: 'Difficult terrain, all Movement -2"', forces_cooperation: false },
      4: { effect: 'waist_deep', desc: 'Models must pass Athletics or be swept away', forces_cooperation: true },
      6: { effect: 'catastrophe', desc: 'Total submersion - location Drowned', world_scar: 'Submerged' }
    },
    visual: 'Water level markers rise, low terrain becomes impassable',
    player_experience: 'Race to high ground, equipment lost to water, drowning mechanics'
  },
  
  'landslide': {
    type: 'terrain_collapse',
    label: 'Canyon Wall Collapsing',
    rate: 1,
    max: 6,
    consumes: null,
    thresholds: {
      2: { effect: 'rockfall', desc: 'Random rocks fall - 3 damage to models in 6" zone', forces_cooperation: false },
      4: { effect: 'major_slide', desc: 'Half the board becomes Impassable rubble', forces_cooperation: true },
      6: { effect: 'catastrophe', desc: 'Location buried - becomes Forbidden', world_scar: 'Buried' }
    },
    visual: 'Rubble tokens spread from one board edge inward',
    player_experience: 'Shrinking safe zones, forced movement away from collapse'
  },
  
  'sinkhole': {
    type: 'ground_collapse',
    label: 'Ground Opening Up',
    rate: 1,
    max: 6,
    consumes: null,
    thresholds: {
      2: { effect: 'small_holes', desc: 'Random 3" zones become Dangerous Terrain', forces_cooperation: false },
      4: { effect: 'massive_sinkhole', desc: 'Center 12" becomes pit - models fall take 6 damage', forces_cooperation: true },
      6: { effect: 'catastrophe', desc: 'Entire location collapses into caverns below', world_scar: 'Hollow' }
    },
    visual: 'Growing pit in center of board',
    player_experience: 'Avoid the center, objectives become unreachable'
  },
  
  // ===== WEATHER & ENVIRONMENTAL =====
  'dust_storm': {
    type: 'visibility_loss',
    label: 'Dust Storm Intensifying',
    rate: 1,
    max: 6,
    consumes: null,
    thresholds: {
      2: { effect: 'reduced_visibility', desc: 'Line of Sight limited to 12"', forces_cooperation: false },
      4: { effect: 'blinding_storm', desc: 'Cannot see beyond 6", ranged attacks impossible', forces_cooperation: true },
      6: { effect: 'catastrophe', desc: 'Complete whiteout - location lost', world_scar: 'Buried' }
    },
    visual: 'Visibility markers shrink radius each round',
    player_experience: 'Forced close combat, objectives hidden'
  },
  
  'heat_wave': {
    type: 'extreme_temperature',
    label: 'Scorching Heat',
    rate: 1,
    max: 6,
    consumes: 'clean_water',
    thresholds: {
      2: { effect: 'exhaustion', desc: 'All models -1 to Athletics checks', forces_cooperation: false },
      4: { effect: 'heat_stroke', desc: 'Models take 1 damage per round in direct sun', forces_cooperation: true },
      6: { effect: 'catastrophe', desc: 'Fatal temperatures - location Scorched', world_scar: 'Scorched' }
    },
    visual: 'Shade zones shrink, water sources dry up',
    player_experience: 'Must stay in shade, water becomes critical resource'
  },
  
  'blizzard': {
    type: 'extreme_cold',
    label: 'Freezing Temperatures',
    rate: 1,
    max: 6,
    consumes: null,
    thresholds: {
      2: { effect: 'frostbite', desc: 'Models take -1 to Dexterity checks', forces_cooperation: false },
      4: { effect: 'hypothermia', desc: 'Models take 2 damage per round without heat source', forces_cooperation: true },
      6: { effect: 'catastrophe', desc: 'Everything freezes - location becomes Frozen', world_scar: 'Frozen' }
    },
    visual: 'Ice tokens spread, movement becomes treacherous',
    player_experience: 'Must find/create heat sources, slippery terrain'
  },
  
  'toxic_fog': {
    type: 'poison_cloud',
    label: 'Toxic Gas Spreading',
    rate: 1,
    max: 6,
    consumes: null,
    thresholds: {
      2: { effect: 'choking_gas', desc: 'Models in fog take -1 die to all actions', forces_cooperation: false },
      4: { effect: 'deadly_toxin', desc: 'Models in fog take 3 damage per round', forces_cooperation: true },
      6: { effect: 'catastrophe', desc: 'Lethal atmosphere - location Poisoned permanently', world_scar: 'Poisoned' }
    },
    visual: 'Gas cloud tokens expand from source',
    player_experience: 'Avoid the gas, need gas masks or high ground'
  },
  
  // ===== WILDLIFE & ECOLOGICAL =====
  'monster_stampede': {
    type: 'wildlife_threat',
    label: 'Monster Herd Migration',
    rate: 1,
    max: 6,
    consumes: null,
    thresholds: {
      2: { effect: 'scouts', desc: 'Individual monsters appear at board edges', forces_cooperation: false },
      4: { effect: 'main_herd', desc: 'Stampede crosses board - 6 damage if in path', forces_cooperation: true },
      6: { effect: 'catastrophe', desc: 'Trampled flat - location Wild', world_scar: 'Wild' }
    },
    visual: 'Monster miniatures cross board following migration path',
    player_experience: 'Get out of the way or fight monsters + enemies'
  },
  
  'swarm': {
    type: 'insect_plague',
    label: 'Locust Swarm',
    rate: 1,
    max: 6,
    consumes: 'livestock',
    thresholds: {
      2: { effect: 'harassment', desc: 'Ranged attacks -1 die due to insects', forces_cooperation: false },
      4: { effect: 'devouring', desc: 'All vegetation destroyed, visibility reduced', forces_cooperation: true },
      6: { effect: 'catastrophe', desc: 'All organic resources consumed - location Depleted', world_scar: 'Depleted' }
    },
    visual: 'Swarm tokens cover terrain, livestock markers removed',
    player_experience: 'Cannot see through swarm, ranged attacks useless, resources vanishing'
  },
  
  'predator_pack': {
    type: 'apex_predator',
    label: 'Kaiju Territory',
    rate: 1,
    max: 6,
    consumes: null,
    thresholds: {
      2: { effect: 'stalking', desc: 'Predator tracks visible, anxiety rising', forces_cooperation: false },
      4: { effect: 'attack', desc: 'Kaiju appears and attacks nearest models', forces_cooperation: true },
      6: { effect: 'catastrophe', desc: 'Kaiju claims territory - location Wild', world_scar: 'Wild' }
    },
    visual: 'Kaiju miniature hunts players, ignores faction allegiance',
    player_experience: 'All factions vs one massive threat'
  },
  
  'blight_spread': {
    type: 'disease_natural',
    label: 'Crop Blight',
    rate: 1,
    max: 6,
    consumes: 'food',
    thresholds: {
      2: { effect: 'wilting', desc: 'Plant life dying, food scarce', forces_cooperation: false },
      4: { effect: 'famine', desc: 'No food sources remain, desperation sets in', forces_cooperation: true },
      6: { effect: 'catastrophe', desc: 'Ecological collapse - location Depleted', world_scar: 'Depleted' }
    },
    visual: 'Vegetation markers removed, farms destroyed',
    player_experience: 'Fighting over remaining food'
  },
  
  // ===== RESOURCE SCARCITY =====
  'water_shortage': {
    type: 'resource_depletion',
    label: 'Wells Running Dry',
    rate: 1,
    max: 6,
    consumes: 'clean_water',
    thresholds: {
      2: { effect: 'rationing', desc: 'Water sources halved in value', forces_cooperation: false },
      4: { effect: 'desperation', desc: 'Last water source - all factions converge', forces_cooperation: true },
      6: { effect: 'catastrophe', desc: 'Complete drought - location Depleted', world_scar: 'Depleted' }
    },
    visual: 'Water markers removed one by one',
    player_experience: 'Racing to secure last water before depleted'
  },
  
  'mine_collapse': {
    type: 'infrastructure_failure',
    label: 'Mine Caving In',
    rate: 1,
    max: 6,
    consumes: null,
    thresholds: {
      2: { effect: 'partial_collapse', desc: 'Tunnels blocked, some resources trapped', forces_cooperation: false },
      4: { effect: 'major_collapse', desc: 'Mine entrance sealed, models inside trapped', forces_cooperation: true },
      6: { effect: 'catastrophe', desc: 'Total collapse - location Buried', world_scar: 'Buried' }
    },
    visual: 'Cave entrance closes progressively',
    player_experience: 'Extract resources before tunnel closes'
  },
  
  'thyr_surge': {
    type: 'magical_overload',
    label: 'Thyr Crystal Overload',
    rate: 1,
    max: 6,
    consumes: null,
    thresholds: {
      2: { effect: 'radiation', desc: 'Magical abilities unpredictable, roll twice for spell effects', forces_cooperation: false },
      4: { effect: 'crystal_explosion', desc: 'Random crystals explode - 4 damage in 6" radius', forces_cooperation: true },
      6: { effect: 'catastrophe', desc: 'Magical dead zone - location Depleted', world_scar: 'Depleted' }
    },
    visual: 'Crystals pulse and crack, emit dangerous light',
    player_experience: 'Magic is dangerous, crystals are bombs'
  },
  
  // ===== SOCIAL/CIVILIAN =====
  'civilian_panic': {
    type: 'social_pressure',
    label: 'Mass Hysteria',
    rate: 1,
    max: 6,
    consumes: null,
    thresholds: {
      2: { effect: 'unrest', desc: 'Civilians block movement, create difficult terrain', forces_cooperation: false },
      4: { effect: 'riot', desc: 'Civilians become hostile - attack nearest armed models', forces_cooperation: true },
      6: { effect: 'catastrophe', desc: 'Total anarchy - location Lawless', world_scar: 'Lawless' }
    },
    visual: 'Civilian miniatures spread chaos',
    player_experience: 'Cannot harm civilians but they block path and attack'
  },
  
  'mass_exodus': {
    type: 'refugee_crisis',
    label: 'Civilian Evacuation',
    rate: 1,
    max: 6,
    consumes: null,
    thresholds: {
      2: { effect: 'crowding', desc: 'Civilians fleeing - movement reduced', forces_cooperation: false },
      4: { effect: 'trampling', desc: 'Stampede - 3 damage if in crowd path', forces_cooperation: true },
      6: { effect: 'catastrophe', desc: 'Ghost town - location Abandoned', world_scar: 'Abandoned' }
    },
    visual: 'Civilians stream toward one board edge',
    player_experience: 'Protect/ignore/exploit fleeing civilians'
  },
  
  // ===== INDUSTRIAL/MECHANICAL =====
  'train_derailment': {
    type: 'ongoing_disaster',
    label: 'Train Wreck Spreading',
    rate: 1,
    max: 6,
    consumes: null,
    thresholds: {
      2: { effect: 'initial_crash', desc: 'Cargo spills, creates hazardous terrain', forces_cooperation: false },
      4: { effect: 'secondary_explosions', desc: 'Boiler explodes - 8 damage in 12" radius', forces_cooperation: true },
      6: { effect: 'catastrophe', desc: 'Rails destroyed - location Isolated', world_scar: 'Isolated' }
    },
    visual: 'Train cars pile up, fire and wreckage spread',
    player_experience: 'Loot the cargo while avoiding explosions'
  },
  
  'dam_breach': {
    type: 'infrastructure_catastrophe',
    label: 'Dam Breaking',
    rate: 1,
    max: 6,
    consumes: null,
    thresholds: {
      2: { effect: 'cracks_forming', desc: 'Water seepage, some terrain flooding', forces_cooperation: false },
      4: { effect: 'major_breach', desc: 'Wall of water - 10 damage to models in path', forces_cooperation: true },
      6: { effect: 'catastrophe', desc: 'Total flood - location Drowned', world_scar: 'Submerged' }
    },
    visual: 'Water flows from one direction, intensifying each round',
    player_experience: 'See it coming, must evacuate or drown'
  },
  
  'clockwork_malfunction': {
    type: 'technology_failure',
    label: 'Automated Defenses Gone Haywire',
    rate: 1,
    max: 6,
    consumes: null,
    thresholds: {
      2: { effect: 'targeting_errors', desc: 'Turrets fire randomly - 2 damage to random models', forces_cooperation: false },
      4: { effect: 'full_hostile', desc: 'All automated systems attack everyone', forces_cooperation: true },
      6: { effect: 'catastrophe', desc: 'Self-destruct sequence - location Destroyed', world_scar: 'Ruins' }
    },
    visual: 'Automated turrets, robots, traps activate',
    player_experience: 'Environment itself is the enemy'
  },
  
  // ===== TEMPORAL/ANOMALOUS =====
  'time_distortion': {
    type: 'temporal_anomaly',
    label: 'Time Flowing Erratically',
    rate: 1,
    max: 6,
    consumes: null,
    thresholds: {
      2: { effect: 'time_hiccup', desc: 'Some models move twice, some skip turn (roll)', forces_cooperation: false },
      4: { effect: 'temporal_chaos', desc: 'Turn order randomizes, actions unpredictable', forces_cooperation: true },
      6: { effect: 'catastrophe', desc: 'Frozen in time - location Suspended', world_scar: 'Timeless' }
    },
    visual: 'Models flicker, appear in multiple places',
    player_experience: 'Turn order unpredictable, actions unreliable, reality unstable'
  },
  
  'reality_tear': {
    type: 'dimensional_breach',
    label: 'Barrier Between Worlds Weakening',
    rate: 1,
    max: 6,
    consumes: null,
    thresholds: {
      2: { effect: 'glimpses', desc: 'Models see alternate realities, -1 to Will checks', forces_cooperation: false },
      4: { effect: 'breach_opens', desc: 'Things from other dimensions emerge', forces_cooperation: true },
      6: { effect: 'catastrophe', desc: 'Dimensions merge - location Warped', world_scar: 'Otherworldly' }
    },
    visual: 'Rift markers expand, strange creatures appear',
    player_experience: 'Fighting enemies + dimensional horrors'
  },
  
  'ghost_manifestation': {
    type: 'spiritual_pressure',
    label: 'Vengeful Spirits Rising',
    rate: 1,
    max: 6,
    consumes: null,
    thresholds: {
      2: { effect: 'haunting', desc: 'Cold spots, unnatural fear, -1 to Morale', forces_cooperation: false },
      4: { effect: 'possession', desc: 'Ghosts possess models - opposed Will checks', forces_cooperation: true },
      6: { effect: 'catastrophe', desc: 'Spirit realm overlaps - location Haunted', world_scar: 'Haunted' }
    },
    visual: 'Ghostly miniatures phase in and out',
    player_experience: 'Fighting incorporeal enemies and possession'
  }
};

// ================================

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
  // Map pressure types to terrain markers
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
// OBJECTIVE BUILDERS - Strategy Pattern
// ================================
const OBJECTIVE_BUILDERS = {
  'wrecked_engine': (loc, danger, vpSpread) => ({
    name: 'Salvage Wrecked Engine',
    description: `Extract mechanical components from abandoned machinery at ${loc.name}.`,
    target_value: Math.min(3, danger),
    progress_label: 'Components',
    vp_per_unit: 3
  }),
  'scattered_crates': (loc, danger, vpSpread) => ({
    name: 'Recover Supply Crates',
    description: `Collect scattered supply crates across the battlefield at ${loc.name}.`,
    target_value: danger + 1,
    progress_label: 'Crates',
    vp_per_unit: 2
  }),
  'ritual_circle': (loc, danger, vpSpread) => ({
    name: 'Control Ritual Site',
    description: `Maintain control of the ritual circle at ${loc.name} to channel its power.`,
    target_value: danger,
    progress_label: 'Rituals',
    vp_per_unit: 4
  }),
  'land_marker': (loc, danger, vpSpread) => ({
    name: 'Establish Territory',
    description: `Plant territorial markers at ${loc.name} and hold them.`,
    target_value: 3,
    progress_label: 'Rounds',
    vp_per_unit: vpSpread.ticker.primary_per_vp
  }),
  'fortified_position': (loc, danger, vpSpread) => ({
    name: 'Hold Fortified Position',
    description: `Maintain control of the defensive structure at ${loc.name}.`,
    target_value: 3,
    progress_label: 'Rounds',
    vp_per_unit: vpSpread.ticker.primary_per_vp
  }),
  'stored_supplies': (loc, danger, vpSpread) => ({
    name: 'Raid Supply Depot',
    description: `Extract stockpiled goods from the depot at ${loc.name}.`,
    target_value: danger + 1,
    progress_label: 'Supplies',
    vp_per_unit: 2
  }),
  'artifact': (loc, danger, vpSpread) => ({
    name: 'Recover Ancient Artifact',
    description: `Secure mysterious artifact of unknown power from ${loc.name}.`,
    target_value: 1,
    progress_label: 'Artifact',
    vp_per_unit: 8
  }),
  'tainted_ground': (loc, danger, vpSpread) => ({
    name: 'Cleanse Tainted Ground',
    description: `Purify corrupted territory at ${loc.name}.`,
    target_value: Math.max(2, danger - 1),
    progress_label: 'Sites Cleansed',
    vp_per_unit: 4
  }),
  'resource_extraction': (loc, danger, vpSpread, extra) => ({
    name: `Extract ${extra.name}`,
    description: `Secure valuable ${extra.name.toLowerCase()} from ${loc.name}.`,
    target_value: extra.amount,
    progress_label: extra.name,
    vp_per_unit: extra.vp
  })
};

// ================================
// VP SCORING SYSTEMS - Data-Driven Configuration
// ================================
const VP_SYSTEMS = {
  'extraction_heist': {
    primary: 'Items Extracted',
    primary_vp: 3,
    bonus: 'Speed Bonus',
    bonus_vp: 1,
    ticker_primary: 2,
    ticker_bonus: 1
  },
  'claim_and_hold': {
    primary: 'Rounds Controlled',
    primary_vp: 2,
    bonus: 'Consecutive Control',
    bonus_vp: 3,
    ticker_primary: 2,
    ticker_bonus: 2
  },
  'corruption_ritual': {
    primary: 'Rituals Disrupted',
    primary_vp: 4,
    bonus: 'Taint Cleansed',
    bonus_vp: 2,
    ticker_primary: 4,
    ticker_bonus: 1
  },
  'ambush_derailment': {
    primary: 'Cargo Secured',
    primary_vp: 3,
    bonus: 'Ambush Success',
    bonus_vp: 2,
    ticker_primary: 3,
    ticker_bonus: 1
  },
  'siege_standoff': {
    primary: 'Defenses Held',
    primary_vp: 2,
    bonus: 'Breach Points',
    bonus_vp: 3,
    ticker_primary: 2,
    ticker_bonus: 2
  },
  'escort_run': {
    primary: 'Cargo Delivered',
    primary_vp: 4,
    bonus: 'Zero Casualties',
    bonus_vp: 3,
    ticker_primary: 3,
    ticker_bonus: 2
  },
  'sabotage_strike': {
    primary: 'Targets Destroyed',
    primary_vp: 4,
    bonus: 'Clean Escape',
    bonus_vp: 2,
    ticker_primary: 3,
    ticker_bonus: 1
  },
  'natural_disaster_response': {
    primary: 'Civilians Saved',
    primary_vp: 3,
    bonus: 'Resources Secured',
    bonus_vp: 2,
    ticker_primary: 2,
    ticker_bonus: 1
  }
};

// Faction-Plot Affinity Map (for faster plot selection)
const FACTION_PLOT_AFFINITIES = {
  'monster_rangers': {
    'corruption_ritual': 3,
    'natural_disaster_response': 2,
    'escort_run': 2
  },
  'liberty_corps': {
    'claim_and_hold': 2,
    'siege_standoff': 2,
    'escort_run': 1
  },
  'monsterology': {
    'extraction_heist': 2,
    'corruption_ritual': 2,
    'sabotage_strike': 1
  },
  'shine_riders': {
    'extraction_heist': 2,
    'sabotage_strike': 2,
    'ambush_derailment': 1
  },
  'crow_queen': {
    'corruption_ritual': 2,
    'claim_and_hold': 1,
    'siege_standoff': 1
  },
  'monsters': {
    'natural_disaster_response': 2,
    'ambush_derailment': 1
  }
};

// ================================
// FACTION THEMES - Asymmetric Motivations
// ================================
// Defines how each faction responds to pressure and resources
const FACTION_THEMES = {
  'monster_rangers': {
    primary_theme: 'Protect the Wild',
    pressure_stance: 'containment', // Tries to slow/stop pressure
    resource_priorities: ['livestock', 'clean_water', 'wildlife'],
    tactical_asset: {
      name: 'Ranger Outpost',
      effect: 'Pressure rate -1 within 6"',
      destruction_vp: 3,
      pressure_limit: 5 // Fails if pressure >= 5
    }
  },
  
  'liberty_corps': {
    primary_theme: 'Federal Control',
    pressure_stance: 'containment',
    resource_priorities: ['weapons', 'supplies', 'communications'],
    tactical_asset: {
      name: 'Field Communications Relay',
      effect: '+1 die to nearby Federal units',
      destruction_vp: 3,
      pressure_limit: 4
    }
  },
  
  'monsterology': {
    primary_theme: 'Scientific Progress',
    pressure_stance: 'exploitation', // Benefits from moderate pressure
    resource_priorities: ['thyr', 'specimens', 'mechanical_parts'],
    exploitation_sweet_spot: [3, 5], // Benefits most at pressure 3-5
    tactical_asset: {
      name: 'Extraction Rig',
      effect: '+1 die to resource extraction actions',
      destruction_vp: 4,
      pressure_limit: 6
    }
  },
  
  'shine_riders': {
    primary_theme: 'Profit from Chaos',
    pressure_stance: 'opportunist', // Benefits from any pressure
    resource_priorities: ['valuables', 'contraband', 'weapons'],
    tactical_asset: {
      name: 'Hidden Cache',
      effect: 'Can stash stolen goods mid-game',
      destruction_vp: 2,
      pressure_limit: 6 // Riders adapt to anything
    }
  },
  
  'crow_queen': {
    primary_theme: 'Establish Dominion',
    pressure_stance: 'redirection', // Converts pressure to control
    resource_priorities: ['territory', 'followers', 'relics'],
    tactical_asset: {
      name: 'Consecration Obelisk',
      effect: 'Terrain within 6" becomes Consecrated',
      destruction_vp: 4,
      pressure_limit: 5,
      pressure_interaction: 'Converts pressure into territory control'
    }
  },
  
  'monsters': {
    primary_theme: 'Reclaim Territory',
    pressure_stance: 'adaptive', // Responds based on pressure type
    resource_priorities: ['food', 'territory', 'safety'],
    tactical_asset: {
      name: 'Monster Den',
      effect: 'Spawns additional Monster units at pressure thresholds',
      destruction_vp: 3,
      pressure_limit: 6
    }
  }
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
    
    // STEP 4.5: Cultist Encounter (must happen before victory conditions)
    console.log("\n👹 STEP 4.5: CULTIST ENCOUNTER");
    const cultistEncounter = this.generateCultistEncounter(userSelections, plotFamily, location);
    console.log("✓ Cultist check:", cultistEncounter ? `${cultistEncounter.cult.name} APPEARING` : 'No cultists this time');
    
    // STEP 5: Victory Conditions (now knows about cultists)
    console.log("\n🏆 STEP 5: VICTORY CONDITIONS");
    const victoryConditions = this.generateVictoryConditions(userSelections, objectives, vpSpread, cultistEncounter);
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
    
    // STEP 8: Narrative — now we have cultist data
    console.log("\n📝 STEP 8: NARRATIVE");
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
      
      // Resource matching
      if (location.resources && plot.primary_resources) {
        plot.primary_resources.forEach(res => {
          if (location.resources[res] && location.resources[res] > 0) {
            score += 3;
          }
        });
      }
      
      // Location type matching
      if (location.type_ref) {
        if (location.type_ref.includes('fortress') && plot.id === 'siege_standoff') score += 4;
        if (location.type_ref.includes('pass') && plot.id === 'escort_run') score += 4;
        if (location.type_ref.includes('ruins') && plot.id === 'ambush_derailment') score += 4;
        if (location.type_ref.includes('mine') && plot.id === 'extraction_heist') score += 4;
      }
      
      // Faction affinity scoring using data-driven map
      userSelections.factions.forEach(faction => {
        const affinity = FACTION_PLOT_AFFINITIES[faction.id]?.[plot.id] || 0;
        score += affinity;
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
    
    // Use data-driven VP system from registry
    const sys = VP_SYSTEMS[plotId] || {
      primary: 'Objectives Complete',
      primary_vp: 2,
      bonus: 'Enemy Eliminated',
      bonus_vp: 1,
      ticker_primary: 2,
      ticker_bonus: 1
    };
    
    return {
      target_to_win: target,
      scoring_rule: `${sys.primary_vp} VP per ${sys.primary}`,
      bonus_rule: `${sys.bonus_vp} VP per ${sys.bonus}`,
      formula: `(${sys.primary} × ${sys.primary_vp}) + (${sys.bonus} × ${sys.bonus_vp})`,
      thresholds: {
        minor_victory: Math.floor(target * 0.6),
        major_victory: target,
        legendary_victory: Math.floor(target * 1.5)
      },
      ticker: {
        primary_label: sys.primary,
        primary_per_vp: sys.ticker_primary,
        bonus_label: sys.bonus,
        bonus_per_vp: sys.ticker_bonus
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
        
        // Use buildObjective with extraData for resource extraction
        const obj = this.buildObjective('resource_extraction', location, danger, vpSpread, {
          name: prettyName,
          amount: Math.min(amount, danger + 2),
          vp: this.getResourceVP(resource)
        });
        
        if (obj) {
          objectives.push(obj);
          usedTypes.add('resource_extraction');
        }
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
  
  buildObjective(type, location, danger, vpSpread, extraData = {}) {
    // Use strategy pattern - each builder function handles its own logic
    const builder = OBJECTIVE_BUILDERS[type];
    if (!builder) return null;
    
    // Call builder function with context
    const obj = builder(location, danger, vpSpread, extraData);
    
    // Add common fields
    obj.type = type;
    obj.max_vp = obj.target_value * obj.vp_per_unit;
    
    return obj;
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

  generateVictoryConditions(userSelections, objectives, vpSpread, cultistEncounter) {
    const conditions = {};
    
    userSelections.factions.forEach(faction => {
      const factionObjectives = [];
      
      // If cultists are present, add faction-specific response objective FIRST
      if (cultistEncounter && cultistEncounter.enabled) {
        const cultistResponse = this.generateCultistResponseObjective(faction.id, cultistEncounter, userSelections.dangerRating);
        if (cultistResponse) factionObjectives.push(cultistResponse);
      }
      
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
  
  // Generate faction-specific response to cultist threat
  generateCultistResponseObjective(factionId, cultistEncounter, danger) {
    const cult = cultistEncounter.cult;
    const pressure = cultistEncounter.pressure;
    const factionTheme = FACTION_THEMES[factionId];
    
    if (!factionTheme) {
      console.warn(`No theme found for faction: ${factionId}`);
      return null;
    }
    
    // Detect pressure type and generate stance-appropriate response
    const pressureType = pressure.type;
    const stance = factionTheme.pressure_stance;
    const theme = factionTheme.primary_theme;
    
    // Build objectives based on faction stance toward this pressure type
    if (stance === 'containment') {
      return this.generateContainmentObjective(pressureType, theme, danger, pressure);
    } else if (stance === 'exploitation') {
      return this.generateExploitationObjective(pressureType, theme, danger, pressure);
    } else if (stance === 'opportunist') {
      return this.generateOpportunistObjective(pressureType, theme, danger, pressure);
    } else if (stance === 'redirection') {
      return this.generateRedirectionObjective(pressureType, theme, danger, pressure);
    } else if (stance === 'adaptive') {
      return this.generateAdaptiveObjective(pressureType, theme, danger, pressure);
    }
    
    // Fallback
    return {
      name: `Respond to ${pressure.label}`,
      goal: `Deal with the ${cult.name} threat.`,
      method: `Engage cult directly.`,
      scoring: `+${danger * 2} VP if pressure contained`
    };
  }
  
  // Containment stance - slow or stop pressure
  generateContainmentObjective(pressureType, theme, danger, pressure) {
    const containmentMap = {
      'fire_spread': {
        name: 'Extinguish the Flames',
        goal: `${theme}: Protect from fire`,
        method: 'Deploy water sources. +1 die near fire zones.',
        scoring: `+${danger * 2} VP per fire source extinguished`,
        effect: 'pressure_rate - 1 when active'
      },
      'resource_consumption': {
        name: 'Protect the Resource',
        goal: `${theme}: Preserve ${pressure.consumes}`,
        method: 'Guard resource locations. Slow consumption.',
        scoring: `+${danger * 2} VP if consumption slowed`,
        effect: 'pressure_rate - 1 when guarding'
      },
      'necromantic_rise': {
        name: 'Suppress the Undead',
        goal: `${theme}: Prevent undead rising`,
        method: 'Consecrate burial sites. +1 die vs undead.',
        scoring: `+${danger * 2} VP per site consecrated`,
        effect: 'pressure_rate - 1 per consecrated site'
      },
      'chaos_escalation': {
        name: 'Stabilize Reality',
        goal: `${theme}: Restore order`,
        method: 'Deploy stabilization wards. Counter chaos.',
        scoring: `+${danger} VP per round chaos contained`,
        effect: 'pressure_rate - 1 within ward radius'
      },
      'reality_erosion': {
        name: 'Seal the Rifts',
        goal: `${theme}: Close void portals`,
        method: 'Ritual to seal rifts. +1 die vs void entities.',
        scoring: `+${danger * 2} VP per rift sealed`,
        effect: 'pressure_rate - 1 per sealed rift'
      },
      'corruption_spread': {
        name: 'Contain the Blight',
        goal: `${theme}: Stop corruption spread`,
        method: 'Cleanse corrupted ground. Create barriers.',
        scoring: `+${danger} VP per zone cleansed`,
        effect: 'pressure_rate - 1 per barrier deployed'
      },
      'death_magic': {
        name: 'Counter Necromancy',
        goal: `${theme}: Disrupt death magic`,
        method: 'Life-affirming rituals. Protect the living.',
        scoring: `+${danger * 2} VP if death magic countered`,
        effect: 'pressure_rate - 1 within ritual area'
      },
      'dark_consecration': {
        name: 'Resist Domination',
        goal: `${theme}: Maintain free will`,
        method: 'Mental fortification. +2 to Will checks.',
        scoring: `+${danger} VP per ally freed from control`,
        effect: 'pressure_rate - 1 within fortified area'
      }
    };
    
    return containmentMap[pressureType] || containmentMap['chaos_escalation'];
  }
  
  // Exploitation stance - benefit from moderate pressure
  generateExploitationObjective(pressureType, theme, danger, pressure) {
    const exploitationMap = {
      'fire_spread': {
        name: 'Harvest Fire Energy',
        goal: `${theme}: Extract power from flames`,
        method: 'Fire grants bonus Thyr when harvested.',
        scoring: `+${danger * 2} VP when pressure = 3-5`,
        trigger: 'pressure >= 3'
      },
      'resource_consumption': {
        name: 'Study the Consumption',
        goal: `${theme}: Learn from cult methods`,
        method: 'Document consumption process for research.',
        scoring: `+${danger * 2} VP when pressure = 4-5`,
        trigger: 'pressure >= 4'
      },
      'necromantic_rise': {
        name: 'Capture Undead Specimens',
        goal: `${theme}: Research necromancy`,
        method: 'Trap and study undead. Gain research tokens.',
        scoring: `+${danger} VP per undead captured`,
        trigger: 'pressure >= 3'
      },
      'chaos_escalation': {
        name: 'Harvest Chaos Energy',
        goal: `${theme}: Study reality instability`,
        method: 'Extract chaos samples. +1 research per round.',
        scoring: `+${danger * 2} VP when pressure = 3-5`,
        trigger: 'pressure >= 3'
      },
      'reality_erosion': {
        name: 'Map the Void',
        goal: `${theme}: Chart dimensional rifts`,
        method: 'Collect void data. Dangerous but valuable.',
        scoring: `+${danger * 3} VP when pressure = 4-5`,
        trigger: 'pressure >= 4'
      },
      'corruption_spread': {
        name: 'Extract Blight Samples',
        goal: `${theme}: Study corrupted biology`,
        method: 'Harvest corrupted specimens.',
        scoring: `+${danger} VP per sample collected`,
        trigger: 'pressure >= 3'
      },
      'death_magic': {
        name: 'Document Death Magic',
        goal: `${theme}: Record necromantic techniques`,
        method: 'Observe and document rituals.',
        scoring: `+${danger * 2} VP if fully documented`,
        trigger: 'pressure >= 4'
      },
      'dark_consecration': {
        name: 'Steal Dark Relics',
        goal: `${theme}: Acquire cult artifacts`,
        method: 'Raid cult sites during ritual.',
        scoring: `+${danger * 2} VP per relic stolen`,
        trigger: 'pressure >= 3'
      }
    };
    
    return exploitationMap[pressureType] || exploitationMap['chaos_escalation'];
  }
  
  // Opportunist stance - profit from any chaos
  generateOpportunistObjective(pressureType, theme, danger, pressure) {
    return {
      name: 'Profit from Chaos',
      goal: `${theme}: Loot during pressure`,
      method: `+1 VP per pressure level. Move faster through chaos.`,
      scoring: `+${danger} VP per objective stolen, +1 VP per pressure level`,
      special: 'Benefits increase as pressure rises'
    };
  }
  
  // Redirection stance - convert pressure to advantage
  generateRedirectionObjective(pressureType, theme, danger, pressure) {
    return {
      name: 'Weaponize the Pressure',
      goal: `${theme}: Turn chaos into control`,
      method: `Pressure converts into territory control at objectives.`,
      scoring: `+${danger} VP per objective controlled, +2 VP per pressure level`,
      effect: 'Controlled territory persists after scenario'
    };
  }
  
  // Adaptive stance - respond based on situation
  generateAdaptiveObjective(pressureType, theme, danger, pressure) {
    const isPressureLow = pressure.current < 3;
    
    if (isPressureLow) {
      return {
        name: 'Defend Territory',
        goal: `${theme}: Protect from invaders`,
        method: `+1 Attack when defending held ground.`,
        scoring: `+${danger} VP per enemy driven off`,
        adaptive: 'Switches to survival mode at pressure >= 4'
      };
    } else {
      return {
        name: 'Survival Mode',
        goal: `${theme}: Escape the danger`,
        method: `+2 Movement when fleeing. Extract what you can.`,
        scoring: `+${danger} VP per unit evacuated safely`,
        adaptive: 'Fight becomes retreat at high pressure'
      };
    }
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
        pressure: cultistEncounter.pressure.description,
        factions: factions
      };
      
      const cultNarratives = [
        '{location} was quiet until the {cult} arrived. {pressure} {factions} have stumbled into something they weren\'t prepared for.',
        'The {cult} chose {location} for a reason. {pressure} {factions} showed up at the worst possible time.',
        '{pressure} The {cult} have been working in secret at {location}. {factions} are about to interrupt them.'
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
    
    // BASE CHANCE by danger rating - cults should be rare special events
    let baseChance = 0;
    if (danger <= 1) baseChance = 0.03;       // 3%  — very rare
    else if (danger === 2) baseChance = 0.05; // 5%
    else if (danger === 3) baseChance = 0.10; // 10% — standard encounters
    else if (danger === 4) baseChance = 0.15; // 15%
    else if (danger === 5) baseChance = 0.20; // 20%
    else if (danger >= 6)  baseChance = 0.30; // 30% — extreme danger
    
    // Corruption rituals are more likely to involve cults, but not guaranteed
    if (plotFamily.id === 'corruption_ritual') {
      baseChance = Math.min(1.0, baseChance * 2); // Double the chance, capped at 100%
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
    
    // Get pressure track for this cult
    const pressureTrack = PRESSURE_TRACKS[selectedCult.id];
    if (!pressureTrack) {
      console.error(`⚠️ No pressure track found for cult: ${selectedCult.id}`);
      return null;
    }
    
    // Check if pressure track consumes a resource - verify location has it
    let canConsume = true;
    if (pressureTrack.consumes) {
      const resourceAmount = location.resources?.[pressureTrack.consumes] || 0;
      if (resourceAmount === 0) {
        console.log(`  Cult would consume ${pressureTrack.consumes} but location has none. Cult pressure will be abstract.`);
      }
    }
    
    // FORCE SIZE — kept small and manageable!
    // danger 3-4: 2-3 models, danger 5: 3-4 models, danger 6: 4-5 models
    let forceMin, forceMax;
    if (danger <= 3)      { forceMin = 2; forceMax = 3; }
    else if (danger === 4){ forceMin = 2; forceMax = 4; }
    else if (danger === 5){ forceMin = 3; forceMax = 4; }
    else                  { forceMin = 4; forceMax = 5; }
    
    const actualForce = forceMin + Math.floor(Math.random() * (forceMax - forceMin + 1));
    
    // WHO PLAYS THEM?
    const playerFactions = userSelections.factions.filter(f => !f.isNPC);
    const allFactions = userSelections.factions;
    
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
    
    // Generate pressure-specific description
    const pressureDescription = this.generatePressureDescription(pressureTrack, selectedCult, location);
    
    return {
      enabled: true,
      cult: {
        id: selectedCult.id,
        name: selectedCult.name,
        theme: selectedCult.theme,
        color: selectedCult.color,
        description: selectedCult.description
      },
      pressure: {
        type: pressureTrack.type,
        label: pressureTrack.label,
        description: pressureDescription,
        rate: pressureTrack.rate,
        max: pressureTrack.max,
        current: 0, // Starts at 0
        consumes: pressureTrack.consumes,
        thresholds: pressureTrack.thresholds,
        visual: pressureTrack.visual,
        player_experience: pressureTrack.player_experience
      },
      force_size: actualForce,
      controller: controllerFaction ? { id: controllerFaction.id, name: controllerFaction.name } : null,
      controller_note: controllerNote,
      everyone_loses: true, // Still true - catastrophe threshold means everyone loses
      state_modifier_used: stateModifier,
      chance_that_was_rolled: parseFloat(finalChance.toFixed(2))
    };
  }
  
  // Generate descriptive text for what the pressure looks/feels like
  generatePressureDescription(pressureTrack, cult, location) {
    const descriptions = {
      'fire_spread': `The ${cult.name} has set fires across ${location.name}. Every round the flames spread further.`,
      'resource_consumption': `The ${cult.name} is consuming the ${pressureTrack.consumes} at ${location.name}. The resource depletes each round.`,
      'necromantic_rise': `The ${cult.name} is awakening the dead at ${location.name}. More undead rise each round.`,
      'chaos_escalation': `The ${cult.name} is unleashing chaos at ${location.name}. Reality becomes unstable each round.`,
      'reality_erosion': `The ${cult.name} is opening rifts to the void at ${location.name}. The barriers between worlds thin each round.`,
      'corruption_spread': `The ${cult.name} is spreading blight across ${location.name}. Corrupted growth spreads each round.`,
      'death_magic': `The ${cult.name} is channeling necromantic power at ${location.name}. Death's grip tightens each round.`,
      'dark_consecration': `The ${cult.name} is consecrating ${location.name} to the Regent Black. Dark oaths spread each round.`
    };
    
    return descriptions[pressureTrack.type] || `The ${cult.name} has begun their ritual at ${location.name}. Pressure escalates each round.`;
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
    
    // Cultist markers — if a cult showed up, their pressure needs terrain too
    const cultMarkers = cultistEncounter && cultistEncounter.enabled && cultistEncounter.pressure
      ? (CULTIST_TERRAIN_MARKERS[cultistEncounter.pressure.type] || ['Pressure markers - see pressure visual description'])
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
