// ================================
// SCENARIO BRAIN GENERATORS
// Logic for specific sub-components
// ================================

console.log("🎲 Brain Generators loading...");

const BrainGenerators = {

  // ================================
  // RELEVANCY FILTER (The "Better" Logic)
  // ================================
  
  /**
   * Checks if an objective type aligns with a faction's priorities.
   */
  isRelevantToFaction(objType, factionId) {
    const themes = FACTION_THEMES[factionId];
    if (!themes || !themes.resource_priorities) return true; // Default to relevant if no data
    
    // Check if the objective type (e.g., 'thyr') is in the faction's priority list
    return themes.resource_priorities.some(priority => objType.includes(priority));
  },

  // ================================
  // FACTION INTERPRETATION
  // ================================

  generateFactionObjectiveInterpretation(objective, faction) {
    const factionId = faction.id;
    const verbs = FACTION_CORE_VERBS[factionId] || { primary_verb: 'SECURE' };
    const isPriority = this.isRelevantToFaction(objective.type, factionId);
    
    // Base mapping for flavor
    const flavorMap = {
      'monster_rangers': `The Wild must remain balanced.`,
      'liberty_corps': `Federal protocol dictates we secure this immediately.`,
      'monsterology': `This specimen/resource is vital for the Institute.`,
      'shine_riders': `Look at that... it's practically begging to be taken.`,
      'crow_queen': `The Queen desires this. It shall be hers.`,
      'monsters': `*Low growls* This belongs to the pack now.`
    };

    return {
      name: `${verbs.primary_verb} ${objective.name.replace('Extract ', '').replace('Recover ', '')}`,
      goal: `${flavorMap[factionId] || ''} ${objective.description}`,
      method: `Standard ${verbs.approach || 'tactical'} engagement.`,
      scoring: `+${objective.vp_per_unit} VP per ${objective.progress_label}`,
      is_priority: isPriority // Used by Core to decide whether to show this or hide it
    };
  },

  // ================================
  // THE MISSING FUNCTION (Fixes your Error)
  // ================================

  generateUniqueFactionObjective(factionId, danger, allFactions) {
    const uniques = {
      'monster_rangers': { 
        name: 'Minimize Casualties', 
        goal: 'Protect the innocent and the local fauna.', 
        method: 'Keep all units above 50% health.', 
        scoring: `+${danger} Bonus VP if no units were destroyed.` 
      },
      'liberty_corps': { 
        name: 'Establish Perimeter', 
        goal: 'Create a zone of absolute control.', 
        method: 'End the game with no enemies in your deployment zone.', 
        scoring: `+${danger + 2} VP for a clear perimeter.` 
      },
      'monsterology': { 
        name: 'Field Data Collection', 
        goal: 'Observe the enemy under live-fire conditions.', 
        method: 'Spend at least one action within 3" of an enemy leader.', 
        scoring: `+${danger * 2} VP for successful observation.` 
      },
      'shine_riders': { 
        name: 'High Roller', 
        goal: 'Show off and make it look easy.', 
        method: 'Succeed on a Test with 3+ extra successes.', 
        scoring: `+4 VP for the style points.` 
      },
      'crow_queen': { 
        name: 'Fear the Shadow', 
        goal: 'Break their spirits.', 
        method: 'Cause at least one enemy unit to Flee.', 
        scoring: `+${danger} VP for every Broken enemy.` 
      },
      'monsters': { 
        name: 'Scent of Blood', 
        goal: 'Identify the weakest link.', 
        method: 'Completely eliminate the smallest enemy unit first.', 
        scoring: `+${danger + 1} VP for the successful hunt.` 
      }
    };

    return uniques[factionId] || null;
  },

  // ================================
  // CULTISTS & NARRATIVE
  // ================================

  generateCultistEncounter(userSelections, plotFamily, location) {
    // 20% base chance, +10% per Danger Rating over 3
    const chance = 0.2 + (Math.max(0, userSelections.dangerRating - 3) * 0.1);
    if (Math.random() > chance) return null;

    const cult = this.randomChoice(CULT_REGISTRY);
    const pressure = PRESSURE_TRACKS[cult.id];

    return {
      enabled: true,
      cult: cult,
      pressure: pressure,
      markers: CULTIST_TERRAIN_MARKERS[pressure.type] || ['Ritual Site']
    };
  },

  generateNarrative(plotFamily, location, userSelections, cultistEncounter) {
    let text = `The conflict at ${location.name} centers on ${plotFamily.name}. `;
    text += location.description + " " + location.atmosphere;
    
    if (cultistEncounter) {
      text += ` WARNING: Reports indicate ${cultistEncounter.cult.name} activity in the area, bringing ${cultistEncounter.pressure.label}.`;
    }

    return text;
  },

  // ================================
  // UTILITIES
  // ================================

  randomChoice(arr, count = 1) {
    if (!arr || arr.length === 0) return null;
    if (count === 1) return arr[Math.floor(Math.random() * arr.length)];
    
    const shuffled = [...arr].sort(() => 0.5 - Math.random());
    return shuffled.slice(0, count);
  },

  weightedRandomChoice(items) {
    const totalWeight = items.reduce((sum, item) => sum + (item.weight || 1), 0);
    let random = Math.random() * totalWeight;
    for (const item of items) {
      if (random < (item.weight || 1)) return item;
      random -= (item.weight || 1);
    }
    return items[0];
  },

  formatResourceName(str) {
    return str.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
  },

  validateScenario(scenario) {
    console.log("🔍 Validating Scenario...");
    if (!scenario.name) scenario.name = "Unnamed Skirmish";
    return scenario;
  },

  // Stub methods for functionality called by Core
  getDangerDesc(rating) {
    const levels = ["Negligible", "Low", "Moderate", "High", "Extreme", "Suicidal"];
    return levels[rating] || "Unknown";
  },

  getCanyonState(state) { return state || "Stable"; },
  generateTwist(danger, loc) { return "The wind picks up, obscuring vision."; },
  generateFinale(plot, danger, loc, factions) { return "A sudden extraction window opens."; },
  generateTerrainSetup(plot, loc, danger, objectives, cultists) { return TERRAIN_MAP[plot.id] || { core: ['Cover'] }; },
  generateCoffinCough(loc, danger) { return danger > 4 ? "A light dust storm is approaching." : null; },
  generateCultistResponseObjective(factionId, encounter, danger) {
    return {
      name: `Suppress ${encounter.cult.name}`,
      goal: `Prevent the ${encounter.pressure.label} from reaching critical mass.`,
      method: `Destroy cultist markers or interact with ritual sites.`,
      scoring: `+${danger} VP if the track remains below 4.`
    };
  }
};

if (typeof window !== 'undefined') {
  window.BrainGenerators = BrainGenerators;
}
