// ================================
// SCENARIO BRAIN GENERATORS
// ================================

console.log("🎲 Brain Generators loading...");

const BrainGenerators = {

  // 1. RELEVANCY (For the Thyr/Monsterology logic)
  isRelevantToFaction(objType, factionId) {
    const themes = FACTION_THEMES[factionId];
    if (!themes || !themes.resource_priorities) return true;
    return themes.resource_priorities.some(priority => objType.includes(priority));
  },

  // 2. INTERPRETATION (The "Voice" of the faction)
  generateFactionObjectiveInterpretation(objective, faction) {
    const fId = faction.id;
    const verbs = FACTION_CORE_VERBS[fId] || { primary_verb: 'SECURE', approach: 'tactical' };
    const flavor = {
      monster_rangers: "The Wild must remain balanced.",
      liberty_corps: "Federal protocol dictates we secure this.",
      monsterology: "This specimen is vital for research.",
      shine_riders: "It's practically begging to be taken.",
      crow_queen: "The Queen desires this. It shall be hers.",
      monsters: "*Low growls* This belongs to the pack."
    };

    return {
      name: `${verbs.primary_verb} ${objective.name.replace('Extract ', '').replace('Recover ', '')}`,
      goal: `${flavor[fId] || ''} ${objective.description}`,
      method: `Standard ${verbs.approach} engagement.`,
      scoring: `+${objective.vp_per_unit} VP per ${objective.progress_label}`,
      is_priority: this.isRelevantToFaction(objective.type, fId)
    };
  },

  // 3. UNIQUE GOALS (The specific faction missions)
  generateUniqueFactionObjective(fId, danger, allFactions) {
    const goals = {
      monster_rangers: { name: 'Minimize Casualties', goal: 'Protect fauna.', method: 'Keep units above 50% HP.', scoring: `+${danger} VP.` },
      liberty_corps: { name: 'Establish Perimeter', goal: 'Zone control.', method: 'Clear deployment zone.', scoring: `+${danger + 2} VP.` },
      monsterology: { name: 'Field Data', goal: 'Observe enemy.', method: 'Near enemy leader.', scoring: `+${danger * 2} VP.` },
      shine_riders: { name: 'High Roller', goal: 'Show off.', method: '3+ extra successes.', scoring: '+4 VP.' },
      crow_queen: { name: 'Fear Shadow', goal: 'Break spirits.', method: 'Enemy must Flee.', scoring: `+${danger} VP.` },
      monsters: { name: 'Scent of Blood', goal: 'Hunt weak.', method: 'Kill smallest unit first.', scoring: `+${danger + 1} VP.` }
    };
    return goals[fId] || null;
  },

  // 4. AFTERMATH (The Missing Piece)
  generateFactionAftermath(fId) {
    const texts = {
      monster_rangers: "Area stabilized; wildlife remains skittish.",
      liberty_corps: "Federal outpost established.",
      monsterology: "Data logs uploaded; harvest acceptable.",
      shine_riders: "Loot divided; riders are richer.",
      crow_queen: "Her shadow grows longer here.",
      monsters: "The pack feeds. Territory is quiet."
    };
    return texts[fId] || "The dust settles.";
  },

  // 5. CULTISTS
  generateCultistEncounter(selections, plot, location) {
    const chance = 0.2 + (Math.max(0, selections.dangerRating - 3) * 0.1);
    if (Math.random() > chance) return null;
    const cult = this.weightedRandomChoice(CULT_REGISTRY);
    return {
      enabled: true, cult: cult, pressure: PRESSURE_TRACKS[cult.id],
      markers: CULTIST_TERRAIN_MARKERS[PRESSURE_TRACKS[cult.id].type] || ['Ritual Site']
    };
  },

  generateCultistResponseObjective(fId, encounter, danger) {
    return {
      name: `Suppress ${encounter.cult.name}`,
      goal: `Stop the ${encounter.pressure.label}.`,
      method: "Interact with ritual sites.",
      scoring: `+${danger} VP if pressure < 4.`
    };
  },

  // 6. NARRATIVE & TERRAIN
  generateNarrative(plot, loc, selections, cult) {
    let t = `Conflict at ${loc.name} centers on ${plot.name}. ${loc.description}`;
    if (cult) t += ` WARNING: ${cult.cult.name} activity detected!`;
    return t;
  },

  generateTerrainSetup(plot, loc, danger) {
    return TERRAIN_MAP[plot.id] || { core: ['Cover'], optional: [], atmosphere: 'Standard' };
  },

  // 7. UTILITIES (The "Short" versions)
  getDangerDesc(r) { return ["Negligible", "Low", "Moderate", "High", "Extreme", "Suicidal"][r] || "Unknown"; },
  getCanyonState(s) { return s || "Stable"; },
  generateTwist() { return "The wind picks up, obscuring vision."; },
  generateFinale() { return "A sudden extraction window opens."; },
  generateCoffinCough(loc, d) { return d > 4 ? "Dust storm approaching." : null; },
  validateScenario(s) { if (!s.name) s.name = "Unnamed Skirmish"; return s; },

  weightedRandomChoice(items) {
    const total = items.reduce((s, i) => s + (i.weight || 1), 0);
    let r = Math.random() * total;
    for (const i of items) { if (r < (i.weight || 1)) return i; r -= (i.weight || 1); }
    return items[0];
  }
};

if (typeof window !== 'undefined') { window.BrainGenerators = BrainGenerators; }
