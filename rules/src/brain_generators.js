// ================================
// BRAIN GENERATORS
// Faction interpretation methods and utilities
// ================================

console.log("⚙️ Brain Generators loading...");

const BrainGenerators = {
  
  // ================================
  // RELEVANCY FILTER
  // Prevents "Nonsense" by limiting objective bloat
  // ================================

  isRelevantToFaction(factionId, objective) {
    // Mapping specific objective types to faction interests
    const mapping = {
      'monster_rangers': ['silver', 'lead', 'fortified_position', 'civilians', 'supplies', 'water_clean'],
      'crow_queen': ['thyr', 'tzul_silver', 'ritual_site', 'fortified_position', 'wrecked_engine', 'weapons'],
      'monsters': ['food', 'territory', 'wrecked_engine', 'land_marker', 'livestock', 'water_foul'],
      'liberty_corps': ['fortified_position', 'coal', 'lead', 'weapons', 'land_marker'],
      'monsterology': ['thyr', 'specimen', 'wrecked_engine', 'mechanical_parts'],
      'shine_riders': ['silver', 'gildren', 'supplies', 'weapons', 'mechanical_parts']
    };
    
    const interests = mapping[factionId] || [];
    // Returns true if the objective type matches an interest or by 30% chance for variety
    return interests.some(i => objective.type.toLowerCase().includes(i)) || Math.random() < 0.3;
  },

  // ================================
  // FACTION OBJECTIVE INTERPRETATION
  // ================================
  
  generateFactionObjectiveInterpretation(objective, faction, pressure = null) {
    const factionId = faction.id;
    const verb = FACTION_CORE_VERBS[factionId];
    const theme = FACTION_THEMES[factionId];
    
    if (!verb || !theme) {
      return {
        name: objective.name,
        goal: objective.description,
        method: objective.success || 'Complete objective',
        scoring: `+${objective.vp_value} VP per ${objective.vp_per}`,
        flavor: null
      };
    }
    
    // Check if this faction actually cares about this specific objective
    const isCoreInterest = this.isRelevantToFaction(factionId, objective);

    const factionName = this.generateFactionObjectiveName(objective, verb, theme);
    const goal = this.generateFactionGoal(objective, verb, theme, pressure);
    const method = isCoreInterest 
      ? `Priority: ${this.generateFactionMethod(objective, verb, theme)}` 
      : `Secondary: Standard interaction.`;
    
    const scoring = this.generateFactionScoring(objective, verb, theme);
    const flavor = this.generateFactionFlavor(objective, verb, faction);
    
    return {
      name: factionName,
      goal: goal,
      method: method,
      scoring: scoring,
      flavor: flavor,
      action_type: objective.action_type,
      action_cost: objective.action_cost,
      test_required: objective.test_required,
      vp_value: objective.vp_value,
      is_priority: isCoreInterest
    };
  },
  
  generateFactionObjectiveName(objective, verb, theme) {
    const patterns = {
      'PROTECT': ['Defend', 'Preserve', 'Stabilize', 'Guard'],
      'CONTROL': ['Secure', 'Establish Control of', 'Enforce Order at', 'Occupy'],
      'DEVOUR': ['Harvest', 'Extract', 'Consume', 'Weaponize'],
      'STEAL': ['Loot', 'Raid', 'Plunder', 'Claim'],
      'CONSECRATE': ['Claim', 'Sanctify', 'Convert', 'Dedicate'],
      'BREED': ['Nest in', 'Claim as Territory', 'Feed from', 'Spawn at']
    };
    
    const verbs = patterns[verb.primary_verb] || [verb.primary_verb];
    const selectedVerb = this.randomChoice(verbs);
    const keyNoun = this.extractKeyNoun(objective.name);
    
    return `${selectedVerb} ${keyNoun}`;
  },
  
  extractKeyNoun(name) {
    const important = name
      .replace(/Salvage|Recover|Control|Complete|Destroy|Gather|Search|Raid|Stage|Extract/gi, '')
      .replace(/the|a|an/gi, '')
      .trim();
    return important || name;
  },
  
  generateFactionGoal(objective, verb, theme, pressure) {
    const baseGoal = objective.description;
    if (pressure) {
      return `${baseGoal} Time is running out before ${pressure.label}.`;
    }
    return baseGoal;
  },
  
  generateFactionMethod(objective, verb, theme) {
    const tactics = {
      'PROTECT': 'Defensive positioning. +1 die when protecting objectives.',
      'CONTROL': 'Overwhelming force. Control requires majority presence.',
      'DEVOUR': 'Surgical extraction. Ignore collateral damage.',
      'STEAL': 'Hit and run. +1 Movement when carrying loot.',
      'CONSECRATE': 'Ritual conversion. Area remains claimed.',
      'BREED': 'Territorial marking. Spawns reinforcements when held.'
    };
    
    return tactics[verb.primary_verb] || 'Complete the objective';
  },
  
  generateFactionScoring(objective, verb, theme) {
    const vpValue = objective.vp_per_unit || objective.vp_value || 2;
    const progressLabel = objective.progress_label || objective.vp_per || 'completion';
    const base = `+${vpValue} VP per ${progressLabel}`;
    
    const bonuses = {
      'PROTECT': 'Bonus VP if no casualties.',
      'CONTROL': 'Bonus VP if held for 2+ rounds.',
      'DEVOUR': 'Can convert extracted resources to VP.',
      'STEAL': 'Double VP if extracted before enemy arrives.',
      'CONSECRATE': 'Permanent VP if site remains claimed.',
      'BREED': 'Spawned units worth VP.'
    };
    
    const bonus = bonuses[verb.primary_verb];
    return bonus ? `${base}. ${bonus}` : base;
  },
  
  generateFactionFlavor(objective, verb, faction) {
    const quotes = {
      'monster_rangers': [
        '"We don\'t deal with this often. But when we do, we deal with it permanently."',
        '"The Canyon doesn\'t care about fair. Neither do we."',
        '"Save what can be saved. The rest becomes a lesson."'
      ],
      'liberty_corps': [
        '"Order isn\'t negotiable."',
        '"The Corps protects. Even from themselves."',
        '"Lawlessness ends here."'
      ],
      'monsterology': [
        '"Science requires sacrifice. Usually someone else\'s."',
        '"Progress doesn\'t ask permission."',
        '"The Institute takes what it needs."'
      ],
      'shine_riders': [
        '"Everything\'s for sale if you\'re fast enough."',
        '"Profit waits for no one."',
        '"This\'ll sell papers for months."'
      ],
      'crow_queen': [
        '"What the Queen claims, Regent Black keeps."',
        '"All who remain will kneel."',
        '"The Crown does not ask. It takes."'
      ],
      'monsters': [
        '"The pack does not negotiate."',
        '"Survival is not a crime."',
        '"Territory. Food. Breeding. Everything else is noise."'
      ]
    };
    
    const factionQuotes = quotes[faction.id] || [];
    return factionQuotes.length > 0 ? this.randomChoice(factionQuotes) : null;
  },
  
  // ================================
  // UTILITY METHODS
  // ================================
  
  randomChoice(arr, count = 1) {
    if (!arr || arr.length === 0) return null;
    if (count === 1) return arr[Math.floor(Math.random() * arr.length)];
    const shuffled = [...arr].sort(() => 0.5 - Math.random());
    return shuffled.slice(0, count);
  },
  
  weightedRandomChoice(arr) {
    if (!arr || arr.length === 0) return null;
    const totalWeight = arr.reduce((sum, item) => sum + (item.weight || 1), 0);
    let random = Math.random() * totalWeight;
    for (let item of arr) {
      random -= (item.weight || 1);
      if (random <= 0) return item;
    }
    return arr[arr.length - 1];
  },
  
  capitalize(str) {
    if (!str) return '';
    return str.charAt(0).toUpperCase() + str.slice(1);
  },
  
  formatResourceName(key) {
    const pretty = {
      'food_foul': 'Foul Food', 'food_good': 'Good Food',
      'water_foul': 'Foul Water', 'water_clean': 'Clean Water',
      'mechanical_parts': 'Mechanical Parts', 'tzul_silver': 'Tzul Silver',
      'thyr': 'Thyr Crystals', 'livestock': 'Livestock',
      'supplies': 'Supplies', 'silver': 'Silver',
      'lead': 'Lead', 'coal': 'Coal', 'weapons': 'Weapons',
      'food': 'Food', 'water': 'Water', 'gildren': 'Gildren'
    };
    return pretty[key] || this.capitalize(key.replace(/_/g, ' '));
  },
  
  parseTemplate(template, context) {
    if (!template) return '';
    return template.replace(/{(\w+)}/g, (match, key) => {
      return context[key] !== undefined ? context[key] : match;
    });
  }
};

console.log("✅ Brain Generators loaded!");

if (typeof window !== 'undefined') {
  window.BrainGenerators = BrainGenerators;
}
