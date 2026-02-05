// ================================
// SCENARIO BRAIN CORE
// Main orchestration class
// Requires: brain_constants.js, brain_generators.js
// ================================

console.log("🧠 Scenario Brain Core loading...");

class ScenarioBrain {
  
  constructor() {
    this.data = {
      scenarios: null,
      scenarioVault140: null,
      names: null,
      locations: null,
      locationArchetypes: null,
      locationTypes: null,
      plotFamilies: null,
      plotEngine: null,
      objectiveVault: null,
      twists: null,
      turnStructure: null,
      unitIdentities: null,
      canyonStates: null,
      factions: {}
    };
    this.loaded = false;
    
    // Import generators as methods
    Object.assign(this, BrainGenerators);
  }
  
  async loadAllData() {
    console.log("📚 Loading all data files...");
    
    const files = [
      { key: 'scenarios', url: 'https://raw.githubusercontent.com/steamcrow/coffin/main/rules/src/180_scenario_vault.json' },
      { key: 'scenarioVault140', url: 'https://raw.githubusercontent.com/steamcrow/coffin/main/rules/src/140_scenario_vault.json' },
      { key: 'names', url: 'https://raw.githubusercontent.com/steamcrow/coffin/main/rules/src/230_scenario_names.json' },
      { key: 'locations', url: 'https://raw.githubusercontent.com/steamcrow/coffin/main/rules/src/170_named_locations.json' },
      { key: 'locationArchetypes', url: 'https://raw.githubusercontent.com/steamcrow/coffin/main/rules/src/97_location_vault.json' },
      { key: 'locationTypes', url: 'https://raw.githubusercontent.com/steamcrow/coffin/main/rules/src/150_location_types.json' },
      { key: 'plotFamilies', url: 'https://raw.githubusercontent.com/steamcrow/coffin/main/rules/src/200_plot_families.json' },
      { key: 'plotEngine', url: 'https://raw.githubusercontent.com/steamcrow/coffin/main/rules/src/190_plot_engine_schema.json' },
      { key: 'objectiveVault', url: 'https://raw.githubusercontent.com/steamcrow/coffin/main/rules/src/240_objective_vault.json' }, // FIXED!
      { key: 'twists', url: 'https://raw.githubusercontent.com/steamcrow/coffin/main/rules/src/210_twist_tables.json' },
      { key: 'turnStructure', url: 'https://raw.githubusercontent.com/steamcrow/coffin/main/rules/src/20_turn_structure.json' },
      { key: 'unitIdentities', url: 'https://raw.githubusercontent.com/steamcrow/coffin/main/rules/src/70_unit_identities.json' },
      { key: 'canyonStates', url: 'https://raw.githubusercontent.com/steamcrow/coffin/main/rules/src/30_campaign_system.json' },
      { key: 'monsterRangers', url: 'https://raw.githubusercontent.com/steamcrow/coffin/main/factions/faction-monster-rangers-v5.json', faction: 'monster_rangers' },
      { key: 'libertyCorps', url: 'https://raw.githubusercontent.com/steamcrow/coffin/main/factions/faction-liberty-corps-v2.json', faction: 'liberty_corps' },
      { key: 'monsterology', url: 'https://raw.githubusercontent.com/steamcrow/coffin/main/factions/faction-monsterology-v2.json', faction: 'monsterology' },
      { key: 'monsters', url: 'https://raw.githubusercontent.com/steamcrow/coffin/main/factions/faction-monsters-v2.json', faction: 'monsters' },
      { key: 'shineRiders', url: 'https://raw.githubusercontent.com/steamcrow/coffin/main/factions/faction-shine-riders-v2.json', faction: 'shine_riders' },
      { key: 'crowQueen', url: 'https://raw.githubusercontent.com/steamcrow/coffin/main/factions/faction-crow-queen.json', faction: 'crow_queen' }
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
  
  async generateCompleteScenario(userSelections) {
    console.log("\n🎬 SCENARIO GENERATION START\n");
    
    if (!this.loaded) {
      await this.loadAllData();
    }
    
    // Generate all components
    const location = this.generateLocation(userSelections);
    const plotFamily = this.selectPlotFamily(location, userSelections);
    const vpSpread = this.calculateVPSpread(plotFamily.id, userSelections.dangerRating);
    const objectives = this.generateObjectives(plotFamily, location, userSelections, vpSpread);
    const cultistEncounter = this.generateCultistEncounter(userSelections, plotFamily, location);
    const victoryConditions = this.generateVictoryConditions(userSelections, objectives, vpSpread, cultistEncounter);
    const name = this.generateName(['battle'], location);
    const twist = this.generateTwist(userSelections.dangerRating, location);
    const canyonState = this.getCanyonState(userSelections.canyonState);
    const finale = this.generateFinale(plotFamily, userSelections.dangerRating, location, userSelections.factions);
    const narrative = this.generateNarrative(plotFamily, location, userSelections, cultistEncounter);
    const terrainSetup = this.generateTerrainSetup(plotFamily, location, userSelections.dangerRating, objectives, cultistEncounter);
    const coffinCough = this.generateCoffinCough(location, userSelections.dangerRating);
    
    return this.validateScenario({
      name, narrative_hook: narrative, plot_family: plotFamily.name,
      location, danger_rating: userSelections.dangerRating,
      danger_description: this.getDangerDesc(userSelections.dangerRating),
      vp_spread: vpSpread, objectives, victory_conditions: victoryConditions,
      monster_pressure: { enabled: userSelections.dangerRating >= 4 },
      canyon_state: canyonState, twist, finale,
      cultist_encounter: cultistEncounter,
      terrain_setup: terrainSetup,
      coffin_cough: coffinCough
    });
  }
  
  // ================================
  // STUB METHODS - Keep your existing implementations
  // Copy from your original file
  // ================================
  
  generateLocation(userSelections) {
    // Your existing code
    return { name: 'Test Location', description: 'A place in the Canyon' };
  }
  
  selectPlotFamily(location, userSelections) {
    // Your existing code
    return this.data.plotFamilies?.plot_families?.[0] || { id: 'claim_and_hold', name: 'Claim and Hold' };
  }
  
  calculateVPSpread(plotId, danger) {
    const sys = VP_SYSTEMS[plotId] || VP_SYSTEMS['claim_and_hold'];
    const target = 10 + (danger * 2);
    return {
      target_to_win: target,
      scoring_rule: `${sys.primary_vp} VP per ${sys.primary}`,
      bonus_rule: `${sys.bonus_vp} VP per ${sys.bonus}`,
      thresholds: { minor_victory: Math.floor(target * 0.6), major_victory: target },
      ticker: { primary_label: sys.primary, primary_per_vp: sys.ticker_primary }
    };
  }
  
  generateObjectives(plotFamily, location, userSelections, vpSpread) {
    // Your existing code
    return [];
  }
  
  generateCultistEncounter(userSelections, plotFamily, location) {
    // Your existing code
    return null;
  }
  
  generateVictoryConditions(userSelections, objectives, vpSpread, cultistEncounter) {
    // Your existing code - now uses this.generateFactionObjectiveInterpretation
    const conditions = {};
    userSelections.factions.forEach(faction => {
      const factionObjectives = [];
      objectives.forEach(obj => {
        const faction_data = { id: faction.id };
        const interpretation = this.generateFactionObjectiveInterpretation(obj, faction_data, cultistEncounter?.pressure);
        if (interpretation) factionObjectives.push(interpretation);
      });
      conditions[faction.id] = { faction_objectives: factionObjectives };
    });
    return conditions;
  }
  
  generateName(tags, location) {
    return `Battle at ${location.name}`;
  }
  
  generateTwist(danger, location) {
    return null;
  }
  
  getCanyonState(stateId) {
    return { name: 'Poisoned', effect: 'Standard state' };
  }
  
  generateFinale(plotFamily, danger, location, factions) {
    return null;
  }
  
  generateNarrative(plotFamily, location, userSelections, cultistEncounter) {
    return `A conflict at ${location.name}.`;
  }
  
  generateTerrainSetup(plotFamily, location, danger, objectives, cultistEncounter) {
    return { core_terrain: [], optional_terrain: [] };
  }
  
  generateCoffinCough(location, danger) {
    return null;
  }
  
  getDangerDesc(rating) {
    const levels = ['None', 'Low', 'Standard', 'High', 'Extreme', 'Catastrophic'];
    return levels[rating] || 'Unknown';
  }
  
  validateScenario(scenario) {
    return scenario;
  }
}

console.log("✅ Scenario Brain Core loaded!");

// Export
window.ScenarioBrain = ScenarioBrain;
