// ================================
// SCENARIO BRAIN GENERATORS
// Logic for specific sub-components
// ================================

console.log("🎲 Brain Generators loading...");

const BrainGenerators = {

  // ================================
  // RELEVANCY FILTER
  // ================================
  isRelevantToFaction(objType, factionId) {
    const themes = FACTION_THEMES[factionId];
    if (!themes || !themes.resource_priorities) return true;
    return themes.resource_priorities.some(priority => objType.includes(priority));
  },

  // ================================
  // OBJECTIVE INTERPRETATION
  // ================================
  generateFactionObjectiveInterpretation(objective, faction) {
    const factionId = faction.id;
    const verbs = FACTION_CORE_VERBS[factionId] || { primary_verb: 'SECURE', approach: 'tactical' };
    const isPriority = this.isRelevantToFaction(objective.type, factionId);
    
    const flavorMap = {
      'monster_rangers': `The Wild must remain balanced.`,
      'liberty_corps': `Federal protocol dictates we secure this immediately.`,
      'monsterology': `This specimen is vital for the Institute's research.`,
      'shine_riders': `Look at that... it's practically begging to be taken.`,
      'crow_queen': `The Queen desires this. It shall be hers.`,
      'monsters': `*Low growls* This belongs to the pack now.`
    };

    return {
      name: `${verbs.primary_verb} ${objective.name.replace('Extract ', '').replace('Recover ', '')}`,
      goal: `${flavorMap[factionId] || ''} ${objective.description}`,
      method: `Standard ${verbs.approach} engagement.`,
      scoring: `+${objective.vp_per_unit} VP per ${objective.progress_label}`,
      is_priority: isPriority
    };
  },

  // ================================
  // UNIQUE FACTION GOALS
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
  // CULTIST SYSTEM
  // ================================
  generateCultistEncounter(userSelections, plotFamily, location) {
    const chance = 0.2 + (Math.max(0, userSelections.dangerRating - 3) * 0.1);
    if (Math.random() > chance) return null;

    const cult = this.weightedRandomChoice(CULT_REGISTRY);
    const pressure = PRESSURE_TRACKS[cult.id];

    return {
      enabled: true,
      cult: cult,
      pressure: pressure,
      markers: CULTIST_TERRAIN_MARKERS[pressure.type] || ['Ritual Site']
    };
  },

  generateCultistResponseObjective(factionId, encounter, danger) {
    return {
      name: `Suppress ${encounter.cult.name}`,
      goal: `Prevent the ${encounter.pressure.label} from reaching critical mass.`,
      method: `Destroy cultist markers or interact with ritual sites.`,
      scoring: `+${danger} VP if the pressure track remains below 4.`
    };
  },

  // ================================
  // AFTERMATH GENERATION (FIXED)
  // ================================
  generateFactionAftermath(factionId) {
    const aftermaths = {
      'monster_rangers': "The area is stabilized, but the wildlife remains skittish.",
      'liberty_corps': "A temporary outpost is established to maintain federal order.",
      'monsterology': "Data logs are uploaded; the harvest was... acceptable.",
      'shine_riders': "The loot is divided. Some riders are richer; others are dead.",
      'crow_queen': "The ground feels colder. Her shadow grows longer here.",
      'monsters': "The pack feeds. For now, the territory is quiet."
    };
    return aftermaths[factionId] || "The dust settles as the factions withdraw.";
  },

  // ================================
  // NARRATIVE & WORLD BUILDING
  // ================================
  generateNarrative(plotFamily, location, userSelections, cultistEncounter) {
    let text = `The conflict at ${location.name} centers on ${plotFamily.name}. `;
    text += location.description + " " + location.atmosphere;
    if (cultistEncounter) {
      text += ` WARNING: Reports indicate ${cultistEncounter.cult.name} activity in the area, bringing ${cultistEncounter.pressure.label}.`;
    }
    return text;
  },

  generateTerrainSetup(plot, loc, danger, objectives, cultists) {
    const base = TERRAIN_MAP[plot.id] || { core: ['Cover'], optional: [], atmosphere: 'Standard' };
    return {
      core: [...base.core],
      optional: [...base.optional],
      atmosphere: base.atmosphere
    };
  },

  // ================================
  // UTILITIES & STUBS
  // ================================
  getDangerDesc(rating) {
    return ["Negligible", "Low", "Moderate", "High", "Extreme", "Suicidal"][rating] || "Unknown";
  },

  getCanyonState(state) { return state || "Stable"; },
  generateTwist(danger, loc) { return "The wind picks up, obscuring vision."; },
  generateFinale(plot, danger, loc, factions) { return "A sudden extraction window opens."; },
  generateCoffinCough(loc, danger) { return danger > 4 ? "A light dust storm is approaching." : null; },

  randomChoice(arr) {
    if (!arr || arr.length === 0) return null;
    return arr[Math.floor(Math.random() * arr.length)];
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

  validateScenario(scenario) {
    if (!scenario.name) scenario.name = "Unnamed Skirmish";
    return scenario;
  }
};

if (typeof window !== 'undefined') {
  window.BrainGenerators = BrainGenerators;
}
