// ================================
// SCENARIO BRAIN - FULLY DEBUGGED VERSION
// ================================

console.log("🧠 Scenario Brain loading...");

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
      { key: 'scenarios', url: 'https://raw.githubusercontent.com/steamcrow/coffin/main/rules/src/180_scenario_vault.json' },
      { key: 'names', url: 'https://raw.githubusercontent.com/steamcrow/coffin/main/rules/src/230_scenario_names.json' },
      { key: 'locations', url: 'https://raw.githubusercontent.com/steamcrow/coffin/main/rules/src/170_named_locations.json' },
      { key: 'locationTypes', url: 'https://raw.githubusercontent.com/steamcrow/coffin/main/rules/src/150_location_types.json' },
      { key: 'plotFamilies', url: 'https://raw.githubusercontent.com/steamcrow/coffin/main/rules/src/200_plot_families.json' },
      { key: 'twists', url: 'https://raw.githubusercontent.com/steamcrow/coffin/main/rules/src/210_twist_tables.json' },
      { key: 'canyonStates', url: 'https://raw.githubusercontent.com/steamcrow/coffin/main/rules/src/30_campaign_system.json' },
      { key: 'monsterRangers', url: 'https://raw.githubusercontent.com/steamcrow/coffin/main/factions/faction-monster-rangers-v5.json', faction: 'monster_rangers' },
      { key: 'libertyCorps', url: 'https://raw.githubusercontent.com/steamcrow/coffin/main/factions/faction-liberty-corps-v2.json', faction: 'liberty_corps' },
      { key: 'monsterology', url: 'https://raw.githubusercontent.com/steamcrow/coffin/main/factions/faction-monsterology-v2.json', faction: 'monsterology' },
      { key: 'monsters', url: 'https://raw.githubusercontent.com/steamcrow/coffin/main/factions/faction-monsters-v2.json', faction: 'monsters' },
      { key: 'shineRiders', url: 'https://raw.githubusercontent.com/steamcrow/coffin/main/factions/faction-shine-riders-v2.json', faction: 'shine_riders' }
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
    console.log("─────────────────────────────────────────");
    const location = this.generateLocation(userSelections);
    console.log("✓ Location:", location.name);
    console.log("  Type:", location.type_ref || 'named');
    console.log("  Resources:", JSON.stringify(location.resources));
    
    // STEP 2: Plot Family
    console.log("\n📖 STEP 2: PLOT FAMILY");
    console.log("─────────────────────────────────────────");
    const plotFamily = this.selectPlotFamily(location, userSelections);
    console.log("✓ Plot Family:", plotFamily.name);
    console.log("  ID:", plotFamily.id);
    console.log("  Default Objectives:", JSON.stringify(plotFamily.default_objectives));
    
    // STEP 3: VP Spread
    console.log("\n🎲 STEP 3: VP SPREAD");
    console.log("─────────────────────────────────────────");
    const vpSpread = this.calculateVPSpread(plotFamily.id, userSelections.dangerRating);
    console.log("✓ VP System Created:");
    console.log("  Target VP:", vpSpread.target_to_win);
    console.log("  Primary:", vpSpread.scoring_rule);
    console.log("  Bonus:", vpSpread.bonus_rule);
    console.log("  Formula:", vpSpread.formula);
    
    // STEP 4: Objectives
    console.log("\n🎯 STEP 4: OBJECTIVES");
    console.log("─────────────────────────────────────────");
    const objectives = this.generateObjectives(plotFamily, location, userSelections, vpSpread);
    console.log(`✓ Generated ${objectives.length} objectives:`);
    objectives.forEach((obj, i) => {
      console.log(`  ${i+1}. ${obj.name}`);
      console.log(`     - Target: ${obj.target_value} ${obj.progress_label}`);
      console.log(`     - VP: ${obj.vp_per_unit} per unit (Max: ${obj.max_vp})`);
    });
    
    // STEP 5: Victory Conditions
    console.log("\n🏆 STEP 5: VICTORY CONDITIONS");
    console.log("─────────────────────────────────────────");
    const victoryConditions = this.generateVictoryConditions(userSelections, objectives, vpSpread);
    console.log("✓ Created conditions for factions:");
    Object.keys(victoryConditions).forEach(factionId => {
      const vc = victoryConditions[factionId];
      console.log(`  ${factionId}:`);
      console.log(`    - Target VP: ${vc.target_vp}`);
      console.log(`    - Primary: ${vc.primary_scoring}`);
      console.log(`    - Bonus: ${vc.bonus_scoring}`);
      console.log(`    - Custom conditions: ${vc.faction_specific_conditions.length}`);
    });
    
    // STEP 6: Name & Narrative
    console.log("\n📝 STEP 6: NAME & NARRATIVE");
    console.log("─────────────────────────────────────────");
    const tags = this.buildTags(userSelections);
    const name = this.generateName(tags, location);
    const narrative = this.generateNarrative(plotFamily, location, userSelections);
    console.log("✓ Scenario Name:", name);
    console.log("✓ Narrative:", narrative);
    
    // STEP 7: Extras
    console.log("\n⚙️ STEP 7: EXTRAS");
    console.log("─────────────────────────────────────────");
    const canyonState = userSelections.canyonState || 'poisoned';
    const monsterPressure = Math.random() > 0.3 ? {
      enabled: true,
      trigger: `Round ${this.randomInt(2, 4)}`,
      escalation_type: this.randomChoice(plotFamily.escalation_bias || ['monster_action']),
      notes: "Monsters appear based on danger"
    } : { enabled: false };
    
    const twist = Math.random() < 0.3 ? this.generateTwist(userSelections.dangerRating) : null;
    const finale = this.generateFinale(plotFamily, userSelections.dangerRating, location);
    
    console.log("✓ Canyon State:", canyonState);
    console.log("✓ Monster Pressure:", monsterPressure.enabled);
    console.log("✓ Twist:", twist ? twist.name : 'None');
    console.log("✓ Finale:", finale.title);
    
    // BUILD FINAL SCENARIO
    const scenario = {
      name: name,
      narrative_hook: narrative,
      plot_family: plotFamily.name,
      plot_family_id: plotFamily.id,
      location: location,
      danger_rating: userSelections.dangerRating,
      danger_description: this.getDangerDesc(userSelections.dangerRating),
      objectives: objectives,
      vp_spread: vpSpread,
      victory_conditions: victoryConditions,
      canyon_state: this.getCanyonState(canyonState),
      monster_pressure: monsterPressure,
      twist: twist,
      finale: finale,
      vault_source: null,
      vault_score: 0
    };
    
    console.log("\n✅ ========================================");
    console.log("    GENERATION COMPLETE");
    console.log("========================================");
    console.log("Scenario:", scenario.name);
    console.log("Plot:", scenario.plot_family);
    console.log("Objectives:", scenario.objectives.length);
    console.log("VP Target:", scenario.vp_spread.target_to_win);
    console.log("========================================\n\n");
    
    return scenario;
  }
  
  // ================================
  // LOCATION
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
      name: `Just outside of ${nearby.name}`,
      emoji: type.emoji || "🗺️",
      type_ref: type.id,
      description: `${type.description} Located near ${nearby.name}.`,
      atmosphere: this.randomChoice(type.atmosphere || ["Tension fills the air"]),
      resources: type.resources || {},
      hazards: type.environmental_hazards || [],
      terrain_features: type.terrain_features || [],
      rewards: type.rewards || [],
      procedural: true
    };
  }
  
  // ================================
  // PLOT FAMILY
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
      
      // Type matching
      if (location.type_ref) {
        if (location.type_ref.includes('fortress') && plot.id === 'siege_standoff') score += 4;
        if (location.type_ref.includes('pass') && plot.id === 'escort_run') score += 4;
        if (location.type_ref.includes('ruins') && plot.id === 'ambush_derailment') score += 4;
        if (location.type_ref.includes('mine') && plot.id === 'extraction_heist') score += 4;
      }
      
      // Faction matching
      userSelections.factions.forEach(faction => {
        if (faction.id === 'monster_rangers' && plot.id === 'corruption_ritual') score += 3;
        if (faction.id === 'liberty_corps' && plot.id === 'claim_and_hold') score += 2;
        if (faction.id === 'shine_riders' && (plot.id === 'extraction_heist' || plot.id === 'sabotage_strike')) score += 2;
      });
      
      if (score > maxScore) {
        maxScore = score;
        bestPlot = plot;
      }
    });
    
    console.log(`  Matched: ${bestPlot.name} (score: ${maxScore})`);
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
  // VP SPREAD - CRITICAL FIX
  // ================================
  
  calculateVPSpread(plotId, danger) {
    const target = 10 + (danger * 2);
    
    const systems = {
      'extraction_heist': { primary: 'Items Extracted', pVal: 3, bonus: 'Speed Bonus', bVal: 1 },
      'claim_and_hold': { primary: 'Rounds Controlled', pVal: 2, bonus: 'Consecutive Control', bVal: 3 },
      'ambush_derailment': { primary: 'Crates Salvaged', pVal: 2, bonus: 'Wreckage Secured', bVal: 5 },
      'siege_standoff': { primary: 'Rounds Survived', pVal: 3, bonus: 'Elite Kills', bVal: 2 },
      'escort_run': { primary: 'Distance Traveled', pVal: 1, bonus: 'Cargo Intact', bVal: 5 },
      'corruption_ritual': { primary: 'Rituals Complete', pVal: 4, bonus: 'Disruptions', bVal: 3 },
      'natural_disaster_response': { primary: 'Units Evacuated', pVal: 2, bonus: 'Resources Saved', bVal: 3 },
      'sabotage_strike': { primary: 'Systems Disabled', pVal: 3, bonus: 'Stealth Bonus', bVal: 2 }
    };
    
    const sys = systems[plotId] || { primary: 'Objectives Complete', pVal: 2, bonus: 'Enemy Eliminated', bVal: 1 };
    
    const vpSpread = {
      target_to_win: target,
      scoring_rule: `${sys.pVal} VP per ${sys.primary}`,
      bonus_rule: `${sys.bVal} VP per ${sys.bonus}`,
      formula: `(${sys.primary} × ${sys.pVal}) + (${sys.bonus} × ${sys.bVal})`,
      thresholds: {
        minor_victory: Math.floor(target * 0.6),
        major_victory: target,
        legendary_victory: Math.floor(target * 1.5)
      },
      ticker: {
        primary_label: sys.primary,
        primary_per_vp: sys.pVal,
        bonus_label: sys.bonus,
        bonus_per_vp: sys.bVal
      }
    };
    
    // DEFENSIVE CHECK
    if (!vpSpread.target_to_win || !vpSpread.scoring_rule) {
      console.error("❌ VP Spread creation failed!");
      console.error("Plot ID:", plotId);
      console.error("Result:", vpSpread);
    }
    
    return vpSpread;
  }
  
  // ================================
  // OBJECTIVES - COMPLETE REWRITE
  // ================================
  
  generateObjectives(plotFamily, location, userSelections, vpSpread) {
    const objectives = [];
    
    console.log("  Starting objective generation...");
    console.log("  Plot family has", plotFamily.default_objectives?.length || 0, "default objectives");
    
    // FROM PLOT FAMILY
    if (plotFamily.default_objectives && Array.isArray(plotFamily.default_objectives)) {
      plotFamily.default_objectives.forEach((objType, index) => {
        console.log(`  Attempting to build: ${objType}`);
        const obj = this.buildObjective(objType, location, userSelections.dangerRating, vpSpread);
        if (obj) {
          console.log(`    ✓ Built successfully`);
          objectives.push(obj);
        } else {
          console.warn(`    ✗ Failed to build ${objType}`);
        }
      });
    }
    
    // FROM RESOURCES
    if (location.resources && plotFamily.primary_resources) {
      const matching = plotFamily.primary_resources.filter(r => 
        location.resources[r] && location.resources[r] > 0
      );
      
      if (matching.length > 0) {
        const resource = this.randomChoice(matching);
        const amount = location.resources[resource];
        
        console.log(`  Adding resource objective: ${resource} (${amount} units)`);
        
        objectives.push({
          name: `Extract ${this.capitalize(resource)}`,
          description: `Secure ${amount} units of ${resource} from ${location.name}`,
          type: 'resource',
          target_value: amount,
          progress_label: this.capitalize(resource),
          vp_per_unit: this.getResourceVP(resource),
          max_vp: amount * this.getResourceVP(resource)
        });
      }
    }
    
    // ABSOLUTE FALLBACK - Should never happen
    if (objectives.length === 0) {
      console.error("⚠️ NO OBJECTIVES GENERATED! Adding emergency fallback.");
      objectives.push({
        name: 'Seize Strategic Position',
        description: `Control the key position at ${location.name}`,
        type: 'emergency_control',
        target_value: 3,
        progress_label: 'Rounds Held',
        vp_per_unit: 2,
        max_vp: 6
      });
    }
    
    return objectives;
  }
  
  buildObjective(type, location, danger, vpSpread) {
    const templates = {
      // CORE
      'wrecked_engine': { name: 'Salvage Wrecked Engine', desc: 'Extract components. Coffin Cough risk.', target: Math.min(3, danger), label: 'Components', vp: 3 },
      'scattered_crates': { name: 'Recover Supply Crates', desc: `Collect crates at ${location.name}. 1 Interact each.`, target: danger + 1, label: 'Crates', vp: 2 },
      'derailed_cars': { name: 'Search Derailed Cars', desc: 'Search wreckage. 1 Interact per car.', target: Math.max(2, danger), label: 'Cars', vp: 2 },
      'cargo_vehicle': { name: 'Escort Cargo Vehicle', desc: 'Move 24" across board. 6" per activation.', target: 4, label: 'Progress', vp: vpSpread.ticker.primary_per_vp },
      'pack_animals': { name: 'Capture Pack Animals', desc: 'Secure alive. May panic.', target: Math.max(2, Math.floor(danger / 2)), label: 'Animals', vp: 3 },
      'ritual_components': { name: 'Gather Ritual Components', desc: 'Collect mystical items.', target: danger, label: 'Components', vp: 2 },
      'ritual_site': { name: 'Complete the Ritual', desc: `${danger} Interact actions. Quality test.`, target: danger, label: 'Rituals', vp: 4 },
      'land_marker': { name: 'Establish Territory', desc: 'Plant markers. VP per round.', target: 3, label: 'Rounds', vp: vpSpread.ticker.primary_per_vp },
      'command_structure': { name: 'Seize Command Post', desc: 'Control to coordinate.', target: 3, label: 'Rounds', vp: 3 },
      'thyr_cache': { name: 'Extract Thyr Crystals', desc: 'Recover Thyr. Risky.', target: Math.max(2, Math.floor(danger / 2)), label: 'Thyr', vp: 4 },
      'artifact': { name: 'Recover Ancient Artifact', desc: 'Secure artifact. Nature hidden.', target: 1, label: 'Artifact', vp: 8 },
      'captive_entity': { name: 'Free the Captive', desc: 'Rescue entity.', target: 1, label: 'Captive', vp: 6 },
      'fortified_position': { name: 'Hold Fortified Position', desc: 'Maintain control.', target: 3, label: 'Rounds', vp: vpSpread.ticker.primary_per_vp },
      'barricades': { name: 'Control Chokepoint', desc: 'Hold barricades.', target: 3, label: 'Rounds', vp: 2 },
      'stored_supplies': { name: 'Raid Supply Depot', desc: 'Extract stockpile.', target: danger + 1, label: 'Supplies', vp: 2 },
      'ritual_circle': { name: 'Empower Ritual Circle', desc: 'Control circle.', target: danger, label: 'Rituals', vp: 4 },
      'tainted_ground': { name: 'Cleanse Tainted Ground', desc: 'Purify corruption.', target: Math.max(2, danger - 1), label: 'Cleansed', vp: 4 },
      'sacrificial_focus': { name: 'Destroy Dark Altar', desc: 'Eliminate altar.', target: 1, label: 'Destroyed', vp: 8 },
      'collapsing_route': { name: 'Cross Unstable Passage', desc: 'Traverse before collapse.', target: 24, label: 'Inches', vp: 1 },
      'fouled_resource': { name: 'Purify Cache', desc: 'Recover fouled supplies.', target: Math.max(2, danger), label: 'Purified', vp: 3 },
      'unstable_structure': { name: 'Salvage Structure', desc: 'Extract before collapse.', target: 3, label: 'Salvaged', vp: 3 },
      'evacuation_point': { name: 'Reach Evacuation', desc: 'Get to safety.', target: 5, label: 'Evacuated', vp: 2 },
      
      // RESCUE
      'rescue_hostages': { name: 'Rescue Hostages', desc: 'Free captives. Panic if unattended.', target: Math.max(2, Math.floor(danger / 2)), label: 'Rescued', vp: 4 },
      'downed_ally': { name: 'Recover Fallen Ally', desc: 'Stabilize and extract under fire.', target: 1, label: 'Extracted', vp: 6 },
      'prison_break': { name: 'Stage Prison Break', desc: 'Disable guards, free prisoners.', target: Math.max(2, danger), label: 'Freed', vp: 3 },
      
      // ESCORT
      'protect_informant': { name: 'Protect Informant', desc: 'Keep alive until extraction.', target: 3, label: 'Rounds', vp: vpSpread.ticker.primary_per_vp },
      'escort_civilians': { name: 'Escort Civilians', desc: 'Move across board without losses.', target: Math.max(2, danger - 1), label: 'Escorted', vp: 3 },
      
      // SABOTAGE
      'sabotage_machinery': { name: 'Sabotage Machinery', desc: 'Disable systems.', target: Math.max(2, danger), label: 'Disabled', vp: 3 },
      'blow_the_bridge': { name: 'Destroy Crossing', desc: 'Plant charges.', target: 1, label: 'Destroyed', vp: 7 },
      'cut_power': { name: 'Cut Power', desc: 'Disable generators.', target: Math.max(2, Math.floor(danger / 2)), label: 'Disabled', vp: 4 },
      
      // INVESTIGATION
      'gather_intel': { name: 'Gather Intelligence', desc: 'Search and find clues.', target: danger + 1, label: 'Clues', vp: 2 },
      'expose_conspiracy': { name: 'Expose Conspiracy', desc: 'Collect proof.', target: 3, label: 'Evidence', vp: 5 },
      
      // RACE
      'race_the_clock': { name: 'Race Against Time', desc: 'Complete before timeout.', target: 3, label: 'Tasks', vp: 3 },
      'stop_the_train': { name: 'Stop Runaway Train', desc: 'Reach and halt engine.', target: 24, label: 'Inches', vp: 1 },
      
      // DECEPTION
      'decoy_operation': { name: 'Run Decoy Operation', desc: 'Draw enemies away.', target: 3, label: 'Rounds', vp: 2 },
      'false_artifact': { name: 'Plant False Artifact', desc: 'Swap with fake.', target: 1, label: 'Planted', vp: 6 },
      
      // SURVIVAL
      'last_stand': { name: 'Hold the Line', desc: 'Survive overwhelming pressure.', target: 3, label: 'Rounds', vp: vpSpread.ticker.primary_per_vp },
      'secure_shelter': { name: 'Secure Shelter', desc: 'Barricade and defend.', target: 3, label: 'Rounds', vp: 3 }
    };
    
    const t = templates[type];
    if (!t) {
      console.error(`    ✗ Template not found for: ${type}`);
      return null;
    }
    
    return {
      name: t.name,
      description: t.desc,
      type: type,
      target_value: t.target,
      progress_label: t.label,
      vp_per_unit: t.vp,
      max_vp: t.target * t.vp
    };
  }
  
  getResourceVP(resource) {
    return { thyr: 4, weapons: 3, coal: 2, livestock: 2, food: 2, water: 2, spare_parts: 2 }[resource] || 2;
  }
  
  // ================================
  // VICTORY CONDITIONS - COMPLETE FIX
  // ================================
  
  generateVictoryConditions(userSelections, objectives, vpSpread) {
    console.log("  Generating victory conditions...");
    console.log("  VP Spread received:", JSON.stringify(vpSpread, null, 2));
    
    const conditions = {};
    
    userSelections.factions.forEach(faction => {
      console.log(`  Processing faction: ${faction.name} (${faction.id})`);
      
      const factionData = this.data.factions[faction.id];
      const customConditions = [];
      
      if (factionData) {
        // IDENTITY
        if (factionData.faction_identity?.what_they_fight_for) {
          const fight = this.randomChoice(factionData.faction_identity.what_they_fight_for);
          customConditions.push(`${fight} (+3 VP bonus when achieved)`);
        }
        
        // SCENARIOS
        if (factionData.scenario_preferences?.ideal_scenarios) {
          const ideal = this.randomChoice(factionData.scenario_preferences.ideal_scenarios);
          customConditions.push(ideal);
        }
        
        // FACTION SPECIFICS
        if (faction.id === 'monster_rangers') {
          customConditions.push('Befriend monsters using abilities (+2 VP per befriended monster)');
          customConditions.push('Prevent unnecessary monster deaths (-3 VP per monster killed by your faction)');
        } else if (faction.id === 'liberty_corps') {
          customConditions.push('Establish territorial dominance (+2 VP per round of area control)');
          customConditions.push('Eliminate rival faction leaders (+5 VP per leader eliminated)');
        } else if (faction.id === 'monsterology') {
          customConditions.push('Extract specimens alive for study (+3 VP per live capture)');
          customConditions.push('Complete field research objectives (+2 VP per documented specimen)');
        } else if (faction.id === 'shine_riders') {
          customConditions.push('Create memorable spectacle through daring maneuvers (+2 VP per legendary action)');
          customConditions.push('Extract maximum profit from chaos (+1 VP per resource stolen from opponents)');
        } else if (faction.id === 'monsters') {
          customConditions.push('Defend territorial claims from intruders (+3 VP per round holding sacred ground)');
          customConditions.push('Drive humans from feeding grounds (+2 VP per human unit eliminated)');
        }
        
        // WEAKNESSES
        if (factionData.faction_identity?.what_they_struggle_with) {
          const struggle = this.randomChoice(factionData.faction_identity.what_they_struggle_with);
          customConditions.push(`⚠️ Weakness: ${struggle} (may cause VP penalties)`);
        }
      }
      
      console.log(`    Custom conditions: ${customConditions.length}`);
      
      // BUILD FINAL CONDITION OBJECT
      conditions[faction.id] = {
        target_vp: vpSpread.target_to_win,
        thresholds: vpSpread.thresholds,
        primary_scoring: vpSpread.scoring_rule,
        bonus_scoring: vpSpread.bonus_rule,
        formula: vpSpread.formula,
        faction_specific_conditions: customConditions,
        objectives: objectives.map(obj => ({
          name: obj.name,
          vp_value: obj.vp_per_unit,
          target: obj.target_value,
          max_vp: obj.max_vp,
          ticker: `${obj.progress_label}: [ ] / ${obj.target_value}`
        })),
        faction_bonus: factionData?.faction_identity?.what_they_fight_for ? 
          this.randomChoice(factionData.faction_identity.what_they_fight_for) + ' (+3 VP bonus)' : null
      };
      
      // DEFENSIVE CHECK
      console.log(`    ✓ Victory condition created:`);
      console.log(`      Target VP: ${conditions[faction.id].target_vp}`);
      console.log(`      Primary: ${conditions[faction.id].primary_scoring}`);
      console.log(`      Bonus: ${conditions[faction.id].bonus_scoring}`);
    });
    
    return conditions;
  }
  
  // ================================
  // HELPERS
  // ================================
  
  buildTags(userSelections) {
    const tags = [];
    userSelections.factions.forEach(f => tags.push(f.id));
    tags.push(`danger_${userSelections.dangerRating}`);
    if (userSelections.dangerRating >= 4) tags.push('dangerous');
    return tags;
  }
  
  generateName(tags, location) {
    if (!this.data.names?.prefixes || !this.data.names?.suffixes) {
      return `The Battle of ${location.name}`;
    }
    
    const prefix = this.randomChoice(this.data.names.prefixes.filter(p => p.tags.includes('general')))?.text || 'Night';
    const suffix = location.name.length <= 15 ? location.name : 
      this.randomChoice(this.data.names.suffixes.filter(s => s.tags.includes('generic')))?.text || 'the Canyon';
    
    return `The ${prefix} of ${suffix}`;
  }
  
  generateNarrative(plotFamily, location, userSelections) {
  const faction = userSelections.factions[0].name;
  const pressure = this.randomChoice(plotFamily.common_inciting_pressures || ['conflict']);
  const objective = plotFamily.default_objectives ? plotFamily.default_objectives[0] : 'the objective';
  const danger = userSelections.dangerRating;
  
  // VARIED NARRATIVE TEMPLATES
  const templates = [
    // TEMPLATE 1: Dramatic Opening
    `${location.name} erupts into chaos as ${pressure.replace(/_/g, ' ')} tears through the settlement. The ${faction} have only hours to ${this.getObjectiveAction(objective)} before the situation becomes irreversible.`,
    
    // TEMPLATE 2: Atmospheric
    `Reports from ${location.name} speak of ${pressure.replace(/_/g, ' ')}—the kind that draws scavengers from every corner of the Canyon. Intelligence suggests ${this.getObjectiveDescription(objective)} hidden within. The ${faction} move in before others stake their claim.`,
    
    // TEMPLATE 3: Urgent
    `A runner arrives at dawn with news from ${location.name}: ${pressure.replace(/_/g, ' ')} has created an opportunity. The ${faction} must act now to ${this.getObjectiveAction(objective)}. Delay means rivals, monsters, or worse.`,
    
    // TEMPLATE 4: Mysterious
    `Strange lights were seen over ${location.name} last night. By morning, ${pressure.replace(/_/g, ' ')} had transformed the area entirely. The ${faction} investigate, knowing ${this.getObjectiveDescription(objective)} could be the key to understanding what happened—or preventing it from spreading.`,
    
    // TEMPLATE 5: Desperate
    `${location.name} is dying. ${this.capitalize(pressure.replace(/_/g, ' '))} advances with each passing hour. The ${faction} have one chance to ${this.getObjectiveAction(objective)} before the window closes forever. Success means survival. Failure means evacuation—or worse.`,
    
    // TEMPLATE 6: Political
    `Word spreads through the Canyon: ${location.name} is up for grabs. ${this.capitalize(pressure.replace(/_/g, ' '))} has created a power vacuum, and every faction with ambition is moving. The ${faction} know ${this.getObjectiveDescription(objective)} determines who controls the region tomorrow.`,
    
    // TEMPLATE 7: Personal Stakes
    `The ${faction} have history with ${location.name}—old debts, buried secrets, things worth protecting. Now ${pressure.replace(/_/g, ' ')} threatens to expose everything. They return not for glory or profit, but to ${this.getObjectiveAction(objective)} before the past consumes the present.`,
    
    // TEMPLATE 8: High Danger
    danger >= 5 ? `${location.name} is a death trap. Everyone knows it. ${this.capitalize(pressure.replace(/_/g, ' '))} has made the area nearly impassable. But the ${faction} don't have a choice—${this.getObjectiveDescription(objective)} is too valuable to abandon. They go in knowing not everyone comes back.` : null,
    
    // TEMPLATE 9: Discovery
    `Scouts returned from ${location.name} with impossible reports: ${pressure.replace(/_/g, ' ')} has revealed something that shouldn't exist. The ${faction} assemble a team to investigate. If they can ${this.getObjectiveAction(objective)}, it could change everything. If they can't, others will.`,
    
    // TEMPLATE 10: Time Pressure
    `The clock is running. ${this.capitalize(pressure.replace(/_/g, ' '))} at ${location.name} creates a window that won't last. The ${faction} have until the Canyon shifts to ${this.getObjectiveAction(objective)}. After that, the opportunity—and possibly ${location.name} itself—will be gone.`
  ].filter(Boolean); // Remove nulls
  
  return this.randomChoice(templates);
}

getObjectiveAction(objType) {
  const actions = {
    'wrecked_engine': 'salvage the wrecked engine',
    'scattered_crates': 'recover the scattered supply crates',
    'derailed_cars': 'search the derailed cars',
    'cargo_vehicle': 'escort the cargo vehicle to safety',
    'pack_animals': 'secure the pack animals',
    'ritual_components': 'gather the ritual components',
    'ritual_site': 'complete the ritual',
    'land_marker': 'establish territorial control',
    'command_structure': 'seize the command post',
    'thyr_cache': 'extract the Thyr crystals',
    'artifact': 'recover the ancient artifact',
    'captive_entity': 'free the captive',
    'fortified_position': 'hold the fortified position',
    'barricades': 'control the chokepoint',
    'stored_supplies': 'raid the supply depot',
    'ritual_circle': 'secure the ritual circle',
    'tainted_ground': 'cleanse the corrupted terrain',
    'sacrificial_focus': 'destroy the dark altar',
    'collapsing_route': 'cross the unstable passage',
    'fouled_resource': 'purify the contaminated cache',
    'unstable_structure': 'salvage before total collapse',
    'evacuation_point': 'evacuate before disaster',
    'rescue_hostages': 'rescue the hostages',
    'downed_ally': 'recover their fallen comrade',
    'prison_break': 'break prisoners free',
    'protect_informant': 'protect the informant',
    'escort_civilians': 'escort civilians to safety',
    'sabotage_machinery': 'sabotage enemy machinery',
    'blow_the_bridge': 'destroy the crossing',
    'cut_power': 'cut power to the facility',
    'gather_intel': 'gather critical intelligence',
    'expose_conspiracy': 'expose the conspiracy',
    'race_the_clock': 'complete objectives before time runs out',
    'stop_the_train': 'stop the runaway train',
    'decoy_operation': 'execute the decoy operation',
    'false_artifact': 'plant the false artifact',
    'last_stand': 'hold the line',
    'secure_shelter': 'secure shelter from the storm'
  };
  return actions[objType] || 'complete the objective';
}

getObjectiveDescription(objType) {
  const descriptions = {
    'wrecked_engine': 'the engine wreckage',
    'scattered_crates': 'supply crates scattered across the site',
    'derailed_cars': 'cargo from the derailed cars',
    'cargo_vehicle': 'the cargo vehicle',
    'pack_animals': 'the pack animals',
    'ritual_components': 'ritual components of unknown power',
    'ritual_site': 'the ritual site',
    'land_marker': 'territorial markers',
    'command_structure': 'the command structure',
    'thyr_cache': 'a cache of raw Thyr',
    'artifact': 'an artifact from before the Storm',
    'captive_entity': 'a captive entity',
    'fortified_position': 'the fortified position',
    'barricades': 'the barricade chokepoint',
    'stored_supplies': 'stockpiled supplies',
    'ritual_circle': 'an active ritual circle',
    'tainted_ground': 'corrupted ground spreading like infection',
    'sacrificial_focus': 'a sacrificial altar',
    'collapsing_route': 'a passage about to collapse',
    'fouled_resource': 'contaminated resources',
    'unstable_structure': 'a structure on the verge of collapse',
    'evacuation_point': 'the evacuation zone',
    'rescue_hostages': 'hostages held captive',
    'downed_ally': 'a fallen ally',
    'prison_break': 'imprisoned allies',
    'protect_informant': 'a critical informant',
    'escort_civilians': 'civilians trapped in the war zone',
    'sabotage_machinery': 'enemy infrastructure',
    'blow_the_bridge': 'a strategic crossing',
    'cut_power': 'power to enemy facilities',
    'gather_intel': 'intelligence that could change the war',
    'expose_conspiracy': 'proof of conspiracy',
    'race_the_clock': 'time-critical objectives',
    'stop_the_train': 'a runaway train',
    'decoy_operation': 'a window for deception',
    'false_artifact': 'an opportunity to mislead',
    'last_stand': 'a position worth dying for',
    'secure_shelter': 'shelter from the approaching storm'
  };
  return descriptions[objType] || 'something valuable';
}
  
  getCanyonState(stateName) {
    const stateData = this.data.canyonStates?.sections?.canyon_states?.states?.[stateName.toLowerCase()];
    if (!stateData) return null;
    
    return {
      name: stateData.name,
      faction: stateData.faction || null,
      terrain_features: stateData.terrain || [],
      environmental_effects: stateData.effects || []
    };
  }
  
  generateTwist(danger) {
    const twists = this.data.twists?.twists?.filter(t => 
      t.danger_floor <= danger && t.danger_ceiling >= danger
    ) || [];
    
    if (twists.length === 0) return null;
    
    const twist = this.randomChoice(twists);
    return {
      name: twist.name,
      description: twist.description,
      example: twist.example_outcomes ? this.randomChoice(twist.example_outcomes) : null
    };
  }
  
  generateFinale(plotFamily, danger, location) {
    const escalation = this.randomChoice(plotFamily.escalation_bias || ['environmental_hazard']);
    const damage = danger * 2;
    
    const templates = {
      'monster_action': { title: 'THE BEASTS ARRIVE', flavor: `Monsters converge on ${location.name}`, effect: `Deploy ${danger}d6 monsters. VP doubles this round.`, ticker: '×2 VP' },
      'authority_intervention': { title: 'LIBERTY CORPS ARRIVES', flavor: 'Authority enforcers arrive', effect: `Deploy ${Math.floor(danger * 1.5)} Liberty Corps units. VP doubles.`, ticker: '×2 VP' },
      'environmental_hazards': { title: 'CATASTROPHIC COLLAPSE', flavor: `${location.name} collapses`, effect: `Quality test or take ${damage} damage. VP doubles.`, ticker: '×2 VP, tests' },
      'environmental_rupture': { title: 'CANYON RUPTURE', flavor: 'The Canyon tears open', effect: `Quality test or ${damage} damage. VP doubles.`, ticker: '×2 VP, tests' },
      'structural_collapse': { title: 'TOTAL COLLAPSE', flavor: 'Structure fails', effect: `All units Quality test or ${damage} damage. VP doubles.`, ticker: '×2 VP' },
      'panic_and_morale_failure': { title: 'PANIC SPREADS', flavor: 'Morale breaks', effect: `Quality test or units flee. VP doubles.`, ticker: '×2 VP' },
      'ritual_completion': { title: 'RITUAL COMPLETES', flavor: 'The ritual reaches climax', effect: `${location.name} transforms. VP doubles.`, ticker: '×2 VP' },
      'monster_awakening': { title: 'TITAN STIRS', flavor: 'Something massive awakens', effect: `Deploy Titan-class threat. VP doubles.`, ticker: '×2 VP' },
      'monster_migration': { title: 'MONSTER HORDE', flavor: 'A migration arrives', effect: `Deploy ${danger}d6 monsters. VP doubles.`, ticker: '×2 VP' },
      'visibility_loss': { title: 'DARKNESS FALLS', flavor: 'Vision fails', effect: `Range reduced to 6". VP doubles.`, ticker: '×2 VP' }
    };
    
    const finale = templates[escalation] || templates['environmental_hazards'];
    
    return {
      round: 6,
      title: finale.title,
      narrative: finale.flavor,
      mechanical_effect: finale.effect,
      ticker_effect: finale.ticker,
      escalation_type: escalation,
      danger_scaling: damage
    };
  }
  
  getDangerDesc(rating) {
    return ['', 'Tutorial / Low Escalation', 'Frontier Skirmish', 'Standard Coffin Canyon', 'High Pressure', 'Escalation Guaranteed', 'Catastrostorm Risk'][rating] || 'Unknown';
  }
  
  capitalize(str) {
    return str ? str.charAt(0).toUpperCase() + str.slice(1) : '';
  }
  
  randomChoice(arr) {
    return arr && arr.length > 0 ? arr[Math.floor(Math.random() * arr.length)] : null;
  }
  
  randomInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }
}

window.ScenarioBrain = ScenarioBrain;
console.log("✅ Scenario Brain ready");
