// ================================
// SCENARIO BRAIN - FULL SOPHISTICATED VERSION
// File: coffin/rules/src/scenario_brain.js
// ================================

console.log("🧠 Scenario Brain: Sophisticated Engine Loaded");

window.ScenarioBrain = {
  // ================================
  // DATA REGISTRIES (Preserved & Enhanced)
  // ================================
  cults: [
    { id: 'sons_of_ralu', name: 'Sons of Ralu', theme: 'Chaos & Destruction', color: '#c44569', danger_min: 1, weight: 10 },
    { id: 'new_children_of_tzul', name: 'The New Children of Tzul', theme: 'Undead & Ancient Power', color: '#7b2d8b', danger_min: 2, weight: 8 },
    { id: 'burning_choir', name: 'The Burning Choir', theme: 'Fire & Purification', color: '#e84545', danger_min: 3, weight: 7 },
    { id: 'children_of_hollow', name: 'Children of the Hollow', theme: 'Void & Madness', color: '#5a5aaa', danger_min: 4, weight: 5 },
    { id: 'thyr_eaters', name: 'The Thyr Eaters', theme: 'Addiction & Consumption', color: '#daa520', danger_min: 2, weight: 9 },
    { id: 'whisper_weavers', name: 'The Whisper Weavers', theme: 'Espionage & Secrets', color: '#2f3542', danger_min: 3, weight: 6 },
    { id: 'iron_circle', name: 'The Iron Circle', theme: 'Order & Tyranny', color: '#57606f', danger_min: 2, weight: 8 },
    { id: 'blood_tithe', name: 'The Blood Tithe', theme: 'Sacrifice & Vengeance', color: '#ff4757', danger_min: 4, weight: 4 }
  ],

  twists: [
    { name: "The Thyr-Mist", effect: "Visibility reduced to 12\".", weight: 10 },
    { name: "Unstable Ground", effect: "Difficult terrain is now Dangerous terrain.", weight: 5 },
    { name: "Psychic Echoes", effect: "Characters must pass a Morale test to use Special Abilities.", weight: 8 },
    { name: "The Coffin Coughs", effect: "All models take a -1 penalty to Toughness.", weight: 3 },
    { name: "Ley Line Flare", effect: "Magic and Thyr abilities gain +1 Power but explode on a 1.", weight: 6 }
  ],

  // ================================
  // CORE GENERATOR
  // ================================
  generate(input) {
    const { mode, points, danger, factions, locationType, locationName } = input;
    
    // 1. Resolve Location
    const location = this.selectLocation(locationType, locationName);
    
    // 2. Roll for Cultist Presence (Danger modifies the odds)
    const cultistChance = (danger * 0.12) + (mode === 'solo' ? 0.15 : 0.05);
    const hasCult = Math.random() < cultistChance;
    
    // 3. Construct Unified Scenario
    const scenario = {
      name: this.generateScenarioName(location),
      narrative_hook: this.generateHook(location, factions),
      danger_rating: danger,
      danger_description: this.getDangerDesc(danger),
      location: location,
      factions: factions,
      
      // Dynamic Systems
      cultist_encounter: hasCult ? this.generateCult(danger) : { enabled: false },
      terrain_setup: this.generateTerrain(location, danger),
      twist: this.pickWeighted(this.twists),
      victory_conditions: this.generateVictoryConditions(factions, mode),
      
      // Metadata
      generated_at: new Date().toISOString(),
      seed: Math.floor(Math.random() * 999999)
    };

    return scenario;
  },

  // ================================
  // LOGIC HELPERS
  // ================================

  selectLocation(type, name) {
    if (type === 'named' && name) {
      return { 
        name: name, 
        emoji: '📍', 
        description: 'A key strategic point within the canyon.', 
        atmosphere: 'The air feels thick with historical weight.' 
      };
    }
    // Default procedural fallback
    const names = ["Whispering Gulch", "Iron Ridge", "Shattered Spire", "Dead Man's Drop"];
    return {
      name: this.rand(names),
      emoji: '🏜️',
      description: "A desolate stretch of the canyon shaped by wind and ancient wars.",
      atmosphere: "Eerie silence broken only by the shifting sand."
    };
  },

  generateScenarioName(loc) {
    const prefixes = ["Assault on", "Secret of", "The Siege of", "Showdown at", "Discovery in"];
    return `${this.rand(prefixes)} ${loc.name}`;
  },

  generateHook(loc, factions) {
    const primaryFaction = factions[0]?.name || "The Rangers";
    const templates = [
      `${primaryFaction} arrived at ${loc.name} only to find the ground already stained.`,
      `The scouts reported movement at ${loc.name}. ${primaryFaction} must secure it before nightfall.`,
      `Rumors of Thyr crystals led ${primaryFaction} to ${loc.name}, but they aren't alone.`
    ];
    return this.rand(templates);
  },

  generateCult(danger) {
    const availableCults = this.cults.filter(c => danger >= c.danger_min);
    const cult = this.pickWeighted(availableCults.length ? availableCults : this.cults);
    
    return {
      enabled: true,
      cult: cult,
      objective: {
        name: "Dark Communion",
        description: "They are performing a ritual to thin the veil between worlds.",
        turn_limit: Math.max(3, 7 - Math.floor(danger / 1.5)),
        win_condition: "Maintain 3 ritual markers for 2 consecutive turns.",
        counter: "Disrupt the markers or eliminate the Cult Leader."
      },
      force_size: 4 + (danger * 2),
      controller_note: "AI: Prioritize the ritual. Only engage if a player enters within 8\".",
      chance_that_was_rolled: 1.0,
      state_modifier_used: danger
    };
  },

  generateTerrain(loc, danger) {
    return {
      core_terrain: ["2x Large Rock Outcroppings", "1x Ruined Structure"],
      optional_terrain: ["Crates", "Dead Trees", "Scrap Piles"],
      objective_markers: ["Primary Cache", "Secondary Intel"],
      thyr_crystals: { 
        count: Math.max(1, danger - 1), 
        placement: "Scattered in the neutral zone between deployment areas." 
      },
      setup_note: "Players take turns placing pieces. No piece within 4\" of another."
    };
  },

  generateVictoryConditions(factions, mode) {
    const vcs = {};
    factions.forEach(f => {
      vcs[f.id] = {
        faction_objectives: [
          { 
            name: "Secure Resources", 
            goal: "Collect more Thyr than the enemy.", 
            scoring: "15 VP", 
            method: "Pick up and carry crystals to your edge." 
          },
          {
            name: "Hold the Line",
            goal: "End the game with more models in the center than the enemy.",
            scoring: "10 VP",
            method: "Area control."
          }
        ],
        aftermath: {
          immediate_effect: "Gain 2D6 Silver.",
          canyon_state_change: "The region stabilizes under your control.",
          long_term: "Improved trade relations with local scavengers.",
          flavor: "You have carved your name into the canyon's history."
        }
      };
    });
    return vcs;
  },

  // ================================
  // UTILITIES
  // ================================
  rand(arr) { 
    return arr[Math.floor(Math.random() * arr.length)]; 
  },
  
  pickWeighted(items) {
    const totalWeight = items.reduce((sum, item) => sum + (item.weight || 1), 0);
    let random = Math.random() * totalWeight;
    for (const item of items) {
      if (random < (item.weight || 1)) return item;
      random -= (item.weight || 1);
    }
    return items[0];
  },

  getDangerDesc(rating) {
    const levels = ["Safe", "Tutorial", "Frontier", "Standard", "High Pressure", "Extreme", "Catastrophic"];
    return levels[rating] || "Lethal";
  }
};
