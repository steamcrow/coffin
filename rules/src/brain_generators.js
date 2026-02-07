// ==========================================
// SCENARIO BRAIN GENERATORS
// ==========================================

console.log("🎲 Brain Generators loading...");

const BrainGenerators = {

  // 1. RELEVANCY FILTER
  isRelevantToFaction: function(objType, factionId) {
    var themes = FACTION_THEMES[factionId];
    if (!themes || !themes.resource_priorities) { return true; }
    for (var i = 0; i < themes.resource_priorities.length; i++) {
      if (objType.indexOf(themes.resource_priorities[i]) !== -1) { return true; }
    }
    return false;
  },

  // 2. OBJECTIVE INTERPRETATION
  generateFactionObjectiveInterpretation: function(objective, faction) {
    var fId = faction.id;
    var verbs = FACTION_CORE_VERBS[fId] || { primary_verb: 'SECURE', approach: 'tactical' };
    
    var flavor = "The objective is clear.";
    if (fId === 'monster_rangers') { flavor = "The Wild must remain balanced."; }
    if (fId === 'liberty_corps') { flavor = "Federal protocol dictates we secure this."; }
    if (fId === 'monsterology') { flavor = "This specimen is vital for research."; }
    if (fId === 'shine_riders') { flavor = "It's practically begging to be taken."; }
    if (fId === 'crow_queen') { flavor = "The Queen desires this. It shall be hers."; }
    if (fId === 'monsters') { flavor = "*Low growls* This belongs to the pack."; }

    return {
      name: verbs.primary_verb + " " + objective.name.replace('Extract ', '').replace('Recover ', ''),
      goal: flavor + " " + objective.description,
      method: "Standard " + verbs.approach + " engagement.",
      scoring: "+" + objective.vp_per_unit + " VP per " + objective.progress_label,
      is_priority: this.isRelevantToFaction(objective.type, fId)
    };
  },

  // 3. UNIQUE FACTION GOALS
  generateUniqueFactionObjective: function(fId, danger, allFactions) {
    var goals = {
      'monster_rangers': { name: 'Minimize Casualties', goal: 'Protect fauna.', method: 'Keep units healthy.', scoring: '+' + danger + ' VP.' },
      'liberty_corps': { name: 'Establish Perimeter', goal: 'Zone control.', method: 'Clear deployment zone.', scoring: '+' + (danger + 2) + ' VP.' },
      'monsterology': { name: 'Field Data', goal: 'Observe enemy.', method: 'Get near enemy leader.', scoring: '+' + (danger * 2) + ' VP.' },
      'shine_riders': { name: 'High Roller', goal: 'Show off.', method: 'Get 3+ extra successes.', scoring: '+4 VP.' },
      'crow_queen': { name: 'Fear Shadow', goal: 'Break spirits.', method: 'Make enemy flee.', scoring: '+' + danger + ' VP.' },
      'monsters': { name: 'Scent of Blood', goal: 'Hunt weak.', method: 'Kill smallest unit first.', scoring: '+' + (danger + 1) + ' VP.' }
    };
    return goals[fId] || null;
  },

  // 4. AFTERMATH
  generateFactionAftermath: function(fId) {
    var texts = {
      'monster_rangers': "Area stabilized; wildlife remains skittish.",
      'liberty_corps': "Federal outpost established.",
      'monsterology': "Data logs uploaded; harvest acceptable.",
      'shine_riders': "Loot divided; riders are richer.",
      'crow_queen': "Her shadow grows longer here.",
      'monsters': "The pack feeds. Territory is quiet."
    };
    return texts[fId] || "The dust settles as the factions withdraw.";
  },

  // 5. CULTIST SYSTEM (FIXED FOR RENDERER ERROR)
  generateCultistEncounter: function(selections, plot, location) {
    var chance = 0.2 + (Math.max(0, selections.dangerRating - 3) * 0.1);
    if (Math.random() > chance) { return null; }
    
    var cult = this.weightedRandomChoice(CULT_REGISTRY);
    var pressure = PRESSURE_TRACKS[cult.id];
    var danger = selections.dangerRating;
    
    return {
      enabled: true,
      cult: cult,
      pressure: pressure,
      markers: CULTIST_TERRAIN_MARKERS[pressure.type] || ['Ritual Site'],
      // The Renderer looks for this 'objective' block. We must provide it here.
      objective: {
        name: "Suppress " + cult.name,
        goal: "Prevent the " + pressure.label + " from reaching critical mass.",
        method: "Destroy cultist markers or interact with ritual sites.",
        scoring: "+" + danger + " VP if the pressure track remains below 4."
      }
    };
  },

  generateCultistResponseObjective: function(fId, encounter, danger) {
    // This provides the faction-specific version of the cult objective
    return {
      name: "Tactical Suppression: " + encounter.cult.name,
      goal: "Interfere with the " + encounter.pressure.label + " before it ruins our operation.",
      method: "Standard suppression of ritual sites.",
      scoring: "+" + danger + " VP for containing the threat."
    };
  },

  // 6. NARRATIVE & TERRAIN
  generateNarrative: function(plot, loc, selections, cult) {
    var text = "The conflict at " + loc.name + " centers on " + plot.name + ". " + loc.description;
    if (cult) { text += " WARNING: " + cult.cult.name + " activity detected!"; }
    return text;
  },

  generateTerrainSetup: function(plot, loc, danger) {
    var base = TERRAIN_MAP[plot.id] || { core: ['Cover'], optional: [], atmosphere: 'Standard' };
    return {
      core: base.core,
      optional: base.optional,
      atmosphere: base.atmosphere
    };
  },

  // 7. UTILITIES
  getDangerDesc: function(r) { 
    var d = ["Negligible", "Low", "Moderate", "High", "Extreme", "Suicidal"];
    return d[r] || "Unknown"; 
  },
  
  getCanyonState: function(s) { return s || "Stable"; },
  generateTwist: function() { return "The wind picks up, obscuring vision."; },
  generateFinale: function() { return "A sudden extraction window opens."; },
  generateCoffinCough: function(loc, d) { return d > 4 ? "Dust storm approaching." : null; },
  validateScenario: function(s) { if (!s.name) { s.name = "Unnamed Skirmish"; } return s; },

  weightedRandomChoice: function(items) {
    var total = 0;
    for (var i = 0; i < items.length; i++) { total += (items[i].weight || 1); }
    var random = Math.random() * total;
    for (var j = 0; j < items.length; j++) {
      if (random < (items[j].weight || 1)) { return items[j]; }
      random -= (items[j].weight || 1);
    }
    return items[0];
  }
};

if (typeof window !== 'undefined') { 
  window.BrainGenerators = BrainGenerators;
}
