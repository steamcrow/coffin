// ================================
// SCENARIO BRAIN - COMPLETE VERSION
// File: scenario_brain.js
// Purpose: Intelligent scenario generation using relational JSON data
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
  
  // ================================
  // STEP 1: LOAD ALL THE DATA
  // ================================
  
  async loadAllData() {
    console.log("📚 Brain loading all JSON files...");
    
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
        console.log(`📡 Fetching: ${file.key}...`);
        const res = await fetch(`${file.url}?t=${Date.now()}`);
        if (!res.ok) throw new Error(`HTTP Error ${res.status}`);
        
        const json = await res.json();
        
        if (file.faction) {
          this.data.factions[file.faction] = json;
        } else {
          this.data[file.key] = json;
        }
        console.log(`✅ ${file.key} loaded.`);
      } catch (err) {
        console.error(`❌ FAILED TO LOAD ${file.key}:`, err);
        throw new Error(`Pattern Match Fail: ${file.key} is malformed or missing.`);
      }
    }
    
    this.loaded = true;
    console.log("🎉 Brain fully loaded!");
  }
  
  // ================================
  // STEP 2: BUILD CONTEXT TAGS
  // ================================
  
  buildContextTags(userSelections) {
    console.log("🏷️ Building context tags from selections:", userSelections);
    
    const tags = [];
    
    // --- FACTION TAGS ---
    userSelections.factions.forEach(faction => {
      tags.push(faction.id);
      
      const factionData = this.data.factions[faction.id];
      if (factionData && factionData.faction_tags) {
        tags.push(...factionData.faction_tags);
      }
      
      if (factionData && factionData.faction_features) {
        factionData.faction_features.forEach(feature => {
          if (feature.keywords) {
            tags.push(...feature.keywords);
          }
        });
      }
    });
    
    // --- DANGER TAGS ---
    const danger = userSelections.dangerRating;
    tags.push(`danger_${danger}`);
    
    if (danger >= 5) {
      tags.push('horror', 'extreme', 'deadly', 'escalation');
    } else if (danger >= 4) {
      tags.push('combat', 'dangerous', 'high_pressure');
    } else if (danger >= 3) {
      tags.push('standard', 'balanced');
    } else {
      tags.push('low_escalation', 'tutorial', 'learning');
    }
    
    // --- CANYON STATE TAGS ---
    const canyonState = userSelections.canyonState || 'poisoned';
    tags.push(`state_${canyonState}`);
    tags.push(canyonState);
    
    const stateData = this.getCanyonStateData(canyonState);
    if (stateData && stateData.faction) {
      tags.push(stateData.faction.toLowerCase().replace(/ /g, '_'));
    }
    
    // --- GAME MODE TAGS ---
    if (userSelections.gameMode === 'solo') {
      tags.push('solo', 'npc_opponents');
    } else {
      tags.push('multiplayer', 'pvp');
    }
    
    console.log("✅ Built", tags.length, "context tags:", tags);
    return tags;
  }
  
  // ================================
  // STEP 3: GENERATE LOCATION
  // NOW CREATES "Just outside of..." LOCATIONS!
  // ================================
  
  generateLocation(userSelections, contextTags) {
    console.log("📍 Generating location...");
    
    // If user selected a named location, use it
    if (userSelections.locationType === 'named' && userSelections.selectedLocation) {
      const location = this.data.locations.locations.find(l => 
        l.name.toLowerCase() === userSelections.selectedLocation.toLowerCase() ||
        l.id === userSelections.selectedLocation
      );
      
      if (location) {
        console.log("✅ Using named location:", location.name);
        return location;
      }
    }
    
    // Otherwise, generate a procedural location
    return this.generateProceduralLocation(userSelections.dangerRating, contextTags);
  }
  
  generateProceduralLocation(dangerRating, contextTags) {
    console.log("🎲 Generating procedural location...");
    
    if (!this.data.locationTypes || !this.data.locationTypes.location_types) {
      console.error("❌ Location types not loaded!");
      return null;
    }
    
    if (!this.data.locations || !this.data.locations.locations) {
      console.error("❌ Named locations not loaded!");
      return null;
    }
    
    // Filter location types by danger rating
    const suitableTypes = this.data.locationTypes.location_types.filter(type => {
      if (type.danger_floor && type.danger_ceiling) {
        return dangerRating >= type.danger_floor && dangerRating <= type.danger_ceiling;
      }
      return true;
    });
    
    if (suitableTypes.length === 0) {
      console.warn("⚠️ No suitable location types found, using all types");
      suitableTypes.push(...this.data.locationTypes.location_types);
    }
    
    // Pick random type
    const chosenType = this.randomChoice(suitableTypes);
    console.log("  Chose location type:", chosenType.name);
    
    // Pick random named location for the "Just outside of..." part
    const nearbyLocation = this.randomChoice(this.data.locations.locations);
    
    // Generate the location name
    const locationName = `Just outside of ${nearbyLocation.name}`;
    
    // Generate full location
    const location = {
      id: `procedural_${chosenType.id}_${Date.now()}`,
      name: locationName,
      emoji: chosenType.emoji || "🗺️",
      type_ref: chosenType.id,
      description: `${chosenType.description} This ${chosenType.name.toLowerCase()} lies just beyond the borders of ${nearbyLocation.name}.`,
      atmosphere: this.randomChoice(chosenType.atmosphere || ["The air is thick with tension"]),
      terrain_flavor: chosenType.terrain_features || ["Scattered debris"],
      
      // Add resource data from location type
      resources: chosenType.resources || {},
      hazards: chosenType.environmental_hazards || [],
      terrain_features: chosenType.terrain_features || [],
      
      // Mark as procedurally generated
      procedural: true,
      nearby_settlement: nearbyLocation.name
    };
    
    console.log("✅ Generated procedural location:", location.name);
    return location;
  }
  
  // ================================
  // STEP 4: SELECT PLOT FAMILY
  // ================================
  
  selectPlotFamily(contextTags, location, userSelections) {
    console.log("📖 Selecting Plot Family...");
    
    if (!this.data.plotFamilies || !this.data.plotFamilies.plot_families) {
      console.error("❌ Plot families not loaded!");
      return null;
    }
    
    let bestPlot = null;
    let maxScore = 0;
    
    this.data.plotFamilies.plot_families.forEach(plot => {
      let score = 0;
      
      // --- RESOURCE MATCHING ---
      if (location.resources) {
        const totalResources = Object.values(location.resources).reduce((sum, val) => sum + val, 0);
        
        if (totalResources >= 8 && plot.id === 'extraction_heist') {
          score += 5;
        }
        
        if (plot.primary_resources) {
          plot.primary_resources.forEach(resource => {
            if (location.resources[resource] && location.resources[resource] > 0) {
              score += 3;
            }
          });
        }
      }
      
      // --- LOCATION TYPE MATCHING ---
      if (location.type_ref) {
        if (location.type_ref.includes('fortress') && plot.id === 'siege_standoff') {
          score += 4;
        }
        
        if ((location.type_ref.includes('pass') || location.type_ref.includes('bridge')) && 
            plot.id === 'escort_run') {
          score += 4;
        }
        
        if (location.type_ref.includes('ruins') && plot.id === 'ambush_derailment') {
          score += 4;
        }
      }
      
      // --- FACTION MATCHING ---
      userSelections.factions.forEach(faction => {
        const factionData = this.data.factions[faction.id];
        if (!factionData) return;
        
        if (faction.id === 'monster_rangers' && plot.id === 'ritual_corruption') {
          score += 3;
        }
        
        if (factionData.scenario_preferences && factionData.scenario_preferences.ideal_scenarios) {
          const scenarioTypes = factionData.scenario_preferences.ideal_scenarios;
          if (scenarioTypes.some(type => 
            plot.name.toLowerCase().includes(type.toLowerCase().split(' ')[0]) ||
            type.toLowerCase().includes(plot.name.toLowerCase().split(' ')[0])
          )) {
            score += 2;
          }
        }
      });
      
      // --- DANGER MATCHING ---
      const danger = userSelections.dangerRating;
      
      if (danger >= 5 && (plot.id === 'ritual_corruption' || plot.id === 'natural_disaster')) {
        score += 2;
      }
      
      if (danger <= 2 && (plot.id === 'claim_and_hold' || plot.id === 'escort_run')) {
        score += 2;
      }
      
      if (score > maxScore) {
        maxScore = score;
        bestPlot = plot;
      }
    });
    
    if (!bestPlot) {
      console.warn("⚠️ No strong plot match, selecting random");
      bestPlot = this.randomChoice(this.data.plotFamilies.plot_families);
    }
    
    console.log(`✅ Selected: "${bestPlot.name}" (score: ${maxScore})`);
    return bestPlot;
  }
  
  // ================================
  // STEP 5: FIND VAULT SCENARIO
  // ================================
  
  findVaultScenarioForPlot(contextTags, userSelections, plotFamily) {
    console.log("🔍 Searching vault for scenarios matching plot:", plotFamily.name);
    
    if (!this.data.scenarios || !this.data.scenarios.scenarios) {
      console.warn("⚠️ No vault scenarios available");
      return null;
    }
    
    let bestScenario = null;
    let maxScore = 0;
    
    this.data.scenarios.scenarios.forEach(scenario => {
      let score = 0;
      
      if (scenario.tags && Array.isArray(scenario.tags)) {
        const tagMatches = scenario.tags.filter(tag => 
          contextTags.includes(tag)
        );
        score += tagMatches.length;
        
        const plotId = plotFamily.id;
        if (scenario.tags.includes(`plot_${plotId}`) || 
            scenario.tags.includes(plotId)) {
          score += 3;
        }
      }
      
      if (scenario.spotlight_factions && Array.isArray(scenario.spotlight_factions)) {
        const factionMatches = scenario.spotlight_factions.filter(spotlightFaction => {
          return userSelections.factions.some(playerFaction => {
            const normalized = spotlightFaction.toLowerCase().replace(/ /g, '_');
            return playerFaction.id.includes(normalized) || normalized.includes(playerFaction.id);
          });
        });
        score += factionMatches.length * 3;
      }
      
      if (scenario.danger_floor && scenario.danger_ceiling) {
        const danger = userSelections.dangerRating;
        if (danger >= scenario.danger_floor && danger <= scenario.danger_ceiling) {
          score += 2;
        }
      }
      
      if (score > maxScore) {
        maxScore = score;
        bestScenario = scenario;
      }
    });
    
    if (bestScenario && maxScore >= 3) {
      console.log(`✅ Vault match: "${bestScenario.name}" (score: ${maxScore})`);
      return { scenario: bestScenario, score: maxScore };
    } else {
      console.log("⚠️ No good vault match - will use procedural generation");
      return null;
    }
  }
  
  // ================================
  // STEP 6: CALCULATE VP SPREAD
  // ================================
  
  calculateVictorySpread(plotFamilyId, dangerRating) {
    console.log("🎲 Calculating VP spread for:", plotFamilyId, "at Danger", dangerRating);
    
    const baseVP = 10;
    const scalingFactor = dangerRating * 2;
    const targetScore = baseVP + scalingFactor;
    
    const logicMap = {
      "extraction_heist": {
        primary: "Items Extracted",
        primary_value: 3,
        bonus: "Speed Bonus (Rounds remaining)",
        bonus_value: 1,
        formula: "(Items × 3) + (Rounds remaining × 1)"
      },
      "claim_and_hold": {
        primary: "Rounds Controlled",
        primary_value: 2,
        bonus: "Consecutive Control Bonus",
        bonus_value: 3,
        formula: "(Rounds × 2) + (Consecutive × 3)"
      },
      "ambush_derailment": {
        primary: "Crates Salvaged",
        primary_value: 2,
        bonus: "Wreckage Secured",
        bonus_value: 5,
        formula: "(Crates × 2) + (Wreckage × 5)"
      },
      "siege_standoff": {
        primary: "Rounds Survived",
        primary_value: 3,
        bonus: "Elite Kills",
        bonus_value: 2,
        formula: "(Rounds × 3) + (Elites × 2)"
      },
      "escort_run": {
        primary: "Distance Traveled",
        primary_value: 1,
        bonus: "Cargo Intact",
        bonus_value: 5,
        formula: "(Distance/6 × 1) + (Intact × 5)"
      },
      "ritual_corruption": {
        primary: "Ritual Actions Completed",
        primary_value: 4,
        bonus: "Opponent Rituals Disrupted",
        bonus_value: 3,
        formula: "(Actions × 4) + (Disruptions × 3)"
      },
      "natural_disaster": {
        primary: "Evacuated Units",
        primary_value: 2,
        bonus: "Resources Saved",
        bonus_value: 3,
        formula: "(Units × 2) + (Resources × 3)"
      }
    };
    
    const logic = logicMap[plotFamilyId] || { 
      primary: "Objectives Completed", 
      primary_value: 2, 
      bonus: "Enemy Units Eliminated", 
      bonus_value: 1,
      formula: "(Objectives × 2) + (Kills × 1)"
    };
    
    const result = {
      target_to_win: targetScore,
      scoring_rule: `Gain ${logic.primary_value} VP per ${logic.primary}`,
      bonus_rule: `Gain ${logic.bonus_value} VP per ${logic.bonus}`,
      formula: logic.formula,
      thresholds: {
        minor_victory: Math.floor(targetScore * 0.6),
        major_victory: targetScore,
        legendary_victory: Math.floor(targetScore * 1.5)
      },
      ticker: {
        primary_label: logic.primary,
        primary_per_vp: logic.primary_value,
        bonus_label: logic.bonus,
        bonus_per_vp: logic.bonus_value
      }
    };
    
    console.log("✅ VP Spread calculated:", result);
    return result;
  }
  
  // ================================
  // STEP 7: GENERATE PLOT FAMILY OBJECTIVES
  // ================================
  
  generatePlotFamilyObjectives(plotFamily, vaultMatch, userSelections, location, canyonState, vpSpread) {
    console.log("🎯 Generating Plot Family objectives from:", plotFamily.name);
    
    const objectives = [];
    
    if (plotFamily.default_objectives && plotFamily.default_objectives.length > 0) {
      plotFamily.default_objectives.forEach((objType, index) => {
        const objective = this.buildObjectiveFromType(
          objType,
          location,
          userSelections.dangerRating,
          vpSpread,
          index
        );
        
        if (objective) {
          objectives.push(objective);
        }
      });
    }
    
    if (location.resources && plotFamily.primary_resources) {
      const matchingResources = plotFamily.primary_resources.filter(r => 
        location.resources[r] && location.resources[r] > 0
      );
      
      if (matchingResources.length > 0) {
        const resource = this.randomChoice(matchingResources);
        const amount = location.resources[resource];
        
        objectives.push({
          name: `Extract ${this.capitalizeFirst(resource)}`,
          description: `Secure ${amount} units of ${resource} from ${location.name}. ${this.getResourceFlavorText(resource, location)}`,
          type: 'resource_extraction',
          target_value: amount,
          progress_label: `${this.capitalizeFirst(resource)} Secured`,
          vp_per_unit: this.getResourceVPValue(resource),
          max_vp: amount * this.getResourceVPValue(resource),
          resource_type: resource,
          plot_family: plotFamily.id
        });
      }
    }
    
    userSelections.factions.forEach(faction => {
      const factionData = this.data.factions[faction.id];
      if (!factionData) return;
      
      const factionObjective = this.generateFactionLocationObjective(
        factionData, 
        location, 
        canyonState, 
        userSelections.dangerRating
      );
      
      if (factionObjective) {
        objectives.push(factionObjective);
      }
    });
    
    if (objectives.length < 2) {
      objectives.push({
        name: "Secure the Territory",
        description: "Establish control over key positions",
        type: "control",
        target_value: 3,
        progress_label: "Positions Held",
        vp_per_unit: 2,
        max_vp: 6
      });
    }
    
    console.log("✅ Generated", objectives.length, "measurable objectives");
    return objectives;
  }
  
  buildObjectiveFromType(objType, location, dangerRating, vpSpread, index) {
    const templates = {
      "wrecked_engine": {
        name: "Salvage the Wrecked Engine",
        description: `Extract mechanical components from the wreckage. Coffin Cough risk increases with each salvage attempt.`,
        target: Math.min(3, dangerRating),
        label: "Components Salvaged",
        vp: 3
      },
      "scattered_crates": {
        name: "Recover Scattered Supplies",
        description: `Collect supply crates scattered across ${location.name}. Each crate requires 1 Interact action.`,
        target: dangerRating + 1,
        label: "Crates Recovered",
        vp: 2
      },
      "derailed_cars": {
        name: "Search Derailed Cars",
        description: `Search the wreckage for valuable cargo. Each car requires 1 Interact action.`,
        target: Math.max(2, dangerRating),
        label: "Cars Searched",
        vp: 2
      },
      "cargo_vehicle": {
        name: "Escort the Cargo Vehicle",
        description: `Move the cargo vehicle at least 24" across the board. Vehicle moves 6" per activation.`,
        target: 4,
        label: "Distance Traveled (×6\")",
        vp: vpSpread.ticker.primary_per_vp
      },
      "pack_animals": {
        name: "Capture Pack Animals",
        description: `Secure the pack animals without killing them. Animals may panic under fire.`,
        target: Math.max(2, Math.floor(dangerRating / 2)),
        label: "Animals Captured",
        vp: 3
      },
      "ritual_components": {
        name: "Gather Ritual Components",
        description: `Collect mystical components scattered across the battlefield.`,
        target: dangerRating,
        label: "Components Gathered",
        vp: 2
      },
      "ritual_site": {
        name: "Complete the Ritual",
        description: `Perform ${dangerRating} successful Interact actions at the ritual site. Each requires Quality test.`,
        target: dangerRating,
        label: "Ritual Actions Complete",
        vp: 4
      },
      "land_marker": {
        name: "Establish Territorial Claim",
        description: `Plant markers and hold territory. Score VP for each round of control.`,
        target: 3,
        label: "Rounds Controlled",
        vp: vpSpread.ticker.primary_per_vp
      },
      "command_structure": {
        name: "Seize Command Post",
        description: `Control the command structure to coordinate your forces.`,
        target: 3,
        label: "Rounds Held",
        vp: 3
      },
      "thyr_cache": {
        name: "Extract Thyr Crystals",
        description: `Recover Thyr crystals from the cache. Handling Thyr always carries risk.`,
        target: Math.max(2, Math.floor(dangerRating / 2)),
        label: "Thyr Extracted",
        vp: 4
      },
      "artifact": {
        name: "Recover Ancient Artifact",
        description: `Secure the artifact. Its true nature may be hidden.`,
        target: 1,
        label: "Artifact Secured",
        vp: 8
      },
      "captive_entity": {
        name: "Free the Captive",
        description: `Rescue or capture the entity. May not be what it appears.`,
        target: 1,
        label: "Entity Controlled",
        vp: 6
      },
      "fortified_position": {
        name: "Hold the Fortified Position",
        description: `Maintain control of the position. Score VP for each round held.`,
        target: 3,
        label: "Rounds Held",
        vp: vpSpread.ticker.primary_per_vp
      },
      "barricades": {
        name: "Control the Chokepoint",
        description: `Hold the barricades to restrict enemy movement.`,
        target: 3,
        label: "Rounds Controlled",
        vp: 2
      },
      "stored_supplies": {
        name: "Raid Supply Depot",
        description: `Extract stockpiled resources before depletion.`,
        target: dangerRating + 1,
        label: "Supplies Extracted",
        vp: 2
      },
      "ritual_circle": {
        name: "Empower the Ritual Circle",
        description: `Control the circle to complete mystical workings.`,
        target: dangerRating,
        label: "Ritual Actions",
        vp: 4
      },
      "tainted_ground": {
        name: "Cleanse Tainted Ground",
        description: `Purify corrupted terrain. Corruption spreads each round.`,
        target: Math.max(2, dangerRating - 1),
        label: "Sections Cleansed",
        vp: 4
      },
      "sacrificial_focus": {
        name: "Destroy Dark Altar",
        description: `Control or destroy the sacrificial focus.`,
        target: 1,
        label: "Altar Destroyed",
        vp: 8
      },
      "collapsing_route": {
        name: "Cross Unstable Passage",
        description: `Traverse the route before complete collapse.`,
        target: 24,
        label: "Distance Crossed (inches)",
        vp: 1
      },
      "fouled_resource": {
        name: "Purify Contaminated Cache",
        description: `Recover and purify the fouled supplies.`,
        target: Math.max(2, dangerRating),
        label: "Resources Purified",
        vp: 3
      },
      "unstable_structure": {
        name: "Salvage Before Collapse",
        description: `Extract value before structural failure.`,
        target: 3,
        label: "Salvage Actions",
        vp: 3
      },
      "evacuation_point": {
        name: "Reach Evacuation Zone",
        description: `Get your forces to safety before disaster.`,
        target: 5,
        label: "Units Evacuated",
        vp: 2
      }
    };
    
    const template = templates[objType];
    if (!template) {
      console.warn("  Unknown objective type:", objType);
      return null;
    }
    
    return {
      name: template.name,
      description: template.description,
      type: objType,
      target_value: template.target,
      progress_label: template.label,
      vp_per_unit: template.vp,
      max_vp: template.target * template.vp,
      plot_family_objective: true
    };
  }
  
  generateFactionLocationObjective(factionData, location, canyonState, dangerRating) {
    const factionId = factionData.faction;
    
    if (factionId === "Monster Rangers") {
      if (location.terrain_flavor && Array.isArray(location.terrain_flavor)) {
        const hasMonsterFeature = location.terrain_flavor.some(t => 
          t.toLowerCase().includes('auction') ||
          t.toLowerCase().includes('cage') ||
          t.toLowerCase().includes('market') ||
          t.toLowerCase().includes('pen')
        );
        
        if (hasMonsterFeature) {
          return {
            name: "Monster Liberation",
            description: `Use Befriend ability to liberate captured monsters from ${location.name}. Each befriended monster must be escorted to board edge.`,
            type: "monster_rescue",
            target_value: Math.min(3, dangerRating),
            progress_label: "Monsters Liberated",
            vp_per_unit: 3,
            max_vp: Math.min(3, dangerRating) * 3,
            special: "Befriend ability grants advantage. Pocket Snacks provide +1 to rolls.",
            faction_specific: true,
            faction: factionId
          };
        }
      }
      
      if (location.hazards && location.hazards.some(h => 
          h.toLowerCase().includes('corrupt') || 
          h.toLowerCase().includes('taint') ||
          h.toLowerCase().includes('poison'))) {
        
        return {
          name: "Purification Ritual",
          description: `Use Dark Librarian or Conjure Guard abilities to purify corrupted terrain at ${location.name}.`,
          type: "purification",
          target_value: dangerRating >= 4 ? 3 : 2,
          progress_label: "Terrain Sections Purified",
          vp_per_unit: 4,
          max_vp: (dangerRating >= 4 ? 3 : 2) * 4,
          special: "Requires 2 full activations per section. Dark Librarian grants +1 die.",
          faction_specific: true,
          faction: factionId
        };
      }
    }
    
    if (factionData.scenario_preferences && factionData.scenario_preferences.ideal_scenarios) {
      const idealScenario = this.randomChoice(factionData.scenario_preferences.ideal_scenarios);
      
      return {
        name: `${factionData.faction} Priority`,
        description: idealScenario,
        type: "faction_priority",
        target_value: dangerRating + 1,
        progress_label: "Priority Actions",
        vp_per_unit: 2,
        max_vp: (dangerRating + 1) * 2,
        special: null,
        faction_specific: true,
        faction: factionId
      };
    }
    
    return null;
  }
  
  getResourceFlavorText(resource, location) {
    const flavors = {
      thyr: "Thyr crystals glow with unstable energy",
      weapons: "Military-grade armaments lie abandoned",
      coal: "Coal deposits fuel the Canyon's engines",
      livestock: "Panicked animals must be captured alive",
      food: "Preserved rations from before the Storm",
      water: "Clean water is worth its weight in gold",
      spare_parts: "Mechanical components scattered in the wreckage"
    };
    return flavors[resource] || "Valuable resources await";
  }
  
  getResourceVPValue(resourceType) {
    const vpValues = {
      'thyr': 4,
      'weapons': 3,
      'coal': 2,
      'livestock': 2,
      'food': 2,
      'water': 2,
      'spare_parts': 2
    };
    return vpValues[resourceType] || 2;
  }
  
  // ================================
  // STEP 8: GENERATE NARRATIVE
  // ================================
  
  generatePlotFamilyNarrative(plotFamily, location, userSelections, vaultMatch) {
    console.log("📝 Generating Plot Family narrative...");
    
    if (vaultMatch && vaultMatch.scenario.narrative_hook && vaultMatch.score >= 5) {
      return vaultMatch.scenario.narrative_hook;
    }
    
    const incitingPressure = plotFamily.common_inciting_pressures ?
      this.randomChoice(plotFamily.common_inciting_pressures).replace(/_/g, ' ') :
      "mounting tension";
    
    const defaultObjective = plotFamily.default_objectives ?
      this.makeObjectiveName(plotFamily.default_objectives[0]) :
      "the objective";
    
    const escalation = plotFamily.escalation_bias ?
      this.randomChoice(plotFamily.escalation_bias).replace(/_/g, ' ') :
      "escalating danger";
    
    const factionName = userSelections.factions[0].name;
    
    const narrative = `${this.capitalizeFirst(incitingPressure)} has triggered ${plotFamily.name.toLowerCase()} at ${location.name}. The ${factionName} must secure ${defaultObjective} before ${escalation} makes extraction impossible.`;
    
    console.log("✅ Generated narrative:", narrative);
    return narrative;
  }
  
  makeObjectiveName(type) {
    const names = {
      wrecked_engine: 'the wrecked engine',
      scattered_crates: 'scattered supply crates',
      derailed_cars: 'the derailed cars',
      cargo_vehicle: 'the cargo vehicle',
      pack_animals: 'the pack animals',
      ritual_components: 'ritual components',
      ritual_site: 'the ritual site',
      land_marker: 'territorial markers',
      command_structure: 'the command structure',
      thyr_cache: 'Thyr crystals',
      artifact: 'the ancient artifact',
      captive_entity: 'the captive entity',
      fortified_position: 'the fortified position',
      barricades: 'the barricades',
      stored_supplies: 'stored supplies',
      ritual_circle: 'the ritual circle',
      tainted_ground: 'tainted ground',
      sacrificial_focus: 'the dark altar',
      collapsing_route: 'the unstable passage',
      fouled_resource: 'contaminated resources',
      unstable_structure: 'the collapsing structure',
      evacuation_point: 'the evacuation zone',
      control_point: 'key positions'
    };
    return names[type] || 'the objective';
  }
  
  // ================================
  // STEP 9: ADD CANYON STATE EFFECTS
  // ================================
  
  getCanyonStateData(stateName) {
    if (!this.data.canyonStates || !this.data.canyonStates.sections || !this.data.canyonStates.sections.canyon_states) {
      return null;
    }
    
    const states = this.data.canyonStates.sections.canyon_states.states;
    return states[stateName.toLowerCase()] || null;
  }
  
  addCanyonStateEffects(scenario, canyonStateName) {
    console.log("⚙️ Adding Canyon State effects for:", canyonStateName);
    
    const stateData = this.getCanyonStateData(canyonStateName);
    if (!stateData) {
      console.warn("⚠️ No state data found for:", canyonStateName);
      return scenario;
    }
    
    scenario.canyon_state = {
      name: stateData.name,
      faction: stateData.faction || null,
      terrain_features: stateData.terrain || [],
      environmental_effects: stateData.effects || [],
      plant_life: stateData.plant_life || null,
      storms: stateData.storms || null
    };
    
    console.log("✅ Canyon State effects added");
    return scenario;
  }
  
  // ================================
  // STEP 10: GENERATE MONSTER PRESSURE
  // ================================
  
  generateMonsterPressure(userSelections, plotFamily) {
    const enabled = Math.random() > 0.3;
    
    if (!enabled) {
      return { enabled: false };
    }
    
    const trigger = `Round ${this.randomInt(2, 4)}`;
    const escalationType = plotFamily.escalation_bias ?
      this.randomChoice(plotFamily.escalation_bias) :
      'monster_action';
    
    return {
      enabled: true,
      trigger: trigger,
      escalation_type: escalationType,
      notes: `${escalationType.replace(/_/g, ' ')} - monsters or threats appear based on danger rating`
    };
  }
  
  // ================================
  // STEP 11: MAYBE ADD A TWIST
  // ================================
  
  maybeAddTwist(dangerRating) {
    if (Math.random() > 0.3) return null;
    
    if (!this.data.twists || !this.data.twists.twists) return null;
    
    const eligibleTwists = this.data.twists.twists.filter(t => 
      t.danger_floor <= dangerRating && t.danger_ceiling >= dangerRating
    );
    
    if (eligibleTwists.length === 0) return null;
    
    const twist = this.randomChoice(eligibleTwists);
    return {
      name: twist.name,
      description: twist.description,
      example: twist.example_outcomes ? this.randomChoice(twist.example_outcomes) : null
    };
  }
  
  // ================================
  // STEP 12: GENERATE ROUND 6 FINALE
  // ================================
  
  generateFinalEscalation(plotFamily, dangerRating, location) {
    console.log("🎭 Generating Round 6 finale...");
    
    const twist = plotFamily.twist_bias ? 
      this.randomChoice(plotFamily.twist_bias) : 
      "sudden_collapse";
    
    const escalation = plotFamily.escalation_bias ?
      this.randomChoice(plotFamily.escalation_bias) :
      "environmental_hazard";
    
    const dangerDamage = dangerRating * 2;
    
    const finaleTemplates = {
      "monster_action": {
        title: "THE BEASTS ARRIVE",
        flavor: `The violence has drawn every monster within miles to ${location.name}`,
        mechanical: `Deploy ${dangerRating}d6 monster units (random types) in the center. All factions become secondary targets. VP values DOUBLE this round.`,
        ticker_effect: "×2 VP multiplier active"
      },
      "authority_intervention": {
        title: "LIBERTY CORPS ENFORCEMENT",
        flavor: `Authority sirens pierce the air. Liberty Corps arrives to "restore order"`,
        mechanical: `Deploy ${Math.floor(dangerRating * 1.5)} Liberty Corps units. They attack the faction with highest VP. VP values DOUBLE this round.`,
        ticker_effect: "×2 VP multiplier active"
      },
      "environmental_hazard": {
        title: "CATASTROPHIC COLLAPSE",
        flavor: `The Canyon itself turns against you. ${twist.replace(/_/g, ' ')}`,
        mechanical: `All units must pass Quality test or take ${dangerDamage} damage. Units carrying objectives test with -1 die. VP values DOUBLE this round.`,
        ticker_effect: "×2 VP multiplier, Quality tests required"
      },
      "betrayal": {
        title: "THE DOUBLE-CROSS",
        flavor: `A claimant reveals their true allegiance. Nothing is as it seemed.`,
        mechanical: `The player with lowest VP may steal ${Math.floor(dangerRating / 2)} VP from any other faction. All VP values DOUBLE this round.`,
        ticker_effect: "×2 VP multiplier, VP theft possible"
      },
      "resource_exhaustion": {
        title: "FINAL EXTRACTION WINDOW",
        flavor: `The site is collapsing. This is your last chance to claim anything.`,
        mechanical: `All unclaimed objectives auto-destroy at end of round. All extraction attempts this round gain +${dangerRating} VP bonus. No new objectives may be claimed.`,
        ticker_effect: `+${dangerRating} VP extraction bonus, final round`
      }
    };
    
    const finale = finaleTemplates[escalation] || finaleTemplates["environmental_hazard"];
    
    console.log("✅ Round 6 Finale:", finale.title);
    
    return {
      round: 6,
      title: finale.title,
      narrative: finale.flavor,
      mechanical_effect: finale.mechanical,
      ticker_effect: finale.ticker_effect,
      escalation_type: escalation,
      danger_scaling: dangerDamage
    };
  }
  
  // ================================
  // STEP 13: GENERATE CUSTOM VICTORY CONDITIONS
  // NOW PULLS FROM FACTION DATA FILES!
  // ================================
  
  generateMathematicalVictoryConditions(userSelections, scenario, vpSpread) {
    console.log("🏆 Generating CUSTOM victory conditions from faction data...");
    
    const conditions = {};
    
    userSelections.factions.forEach(faction => {
      const factionData = this.data.factions[faction.id];
      
      if (!factionData) {
        console.warn(`⚠️ No faction data for ${faction.id}`);
        conditions[faction.id] = this.getGenericVictoryConditions(vpSpread, scenario);
        return;
      }
      
      // BUILD CUSTOM CONDITIONS FROM FACTION DATA
      const customConditions = [];
      
      // 1. FACTION IDENTITY - What they fight for
      if (factionData.faction_identity && factionData.faction_identity.what_they_fight_for) {
        const fightFor = this.randomChoice(factionData.faction_identity.what_they_fight_for);
        customConditions.push(`${fightFor} (+3 VP bonus when achieved)`);
      }
      
      // 2. IDEAL SCENARIOS - Their preferred objectives
      if (factionData.scenario_preferences && factionData.scenario_preferences.ideal_scenarios) {
        const idealScenario = this.randomChoice(factionData.scenario_preferences.ideal_scenarios);
        customConditions.push(idealScenario);
      }
      
      // 3. FACTION-SPECIFIC MECHANICS
      if (faction.id === 'monster_rangers') {
        customConditions.push("Befriend monsters using your abilities (+2 VP per befriended monster)");
        customConditions.push("Prevent unnecessary monster deaths (lose -3 VP per monster killed by your faction)");
        
        if (scenario.objectives.some(obj => obj.type.includes('ritual') || obj.type.includes('thyr'))) {
          customConditions.push("Protect mystical resources from corruption (+2 VP per objective preserved)");
        }
      }
      
      if (faction.id === 'liberty_corps') {
        customConditions.push("Establish territorial dominance (+2 VP per round of area control)");
        customConditions.push("Eliminate rival faction leaders (+5 VP per leader eliminated)");
        
        if (scenario.plot_family_id && scenario.plot_family_id.includes('ambush')) {
          customConditions.push("Prevent unauthorized salvage operations (+3 VP if you control all objectives)");
        }
      }
      
      if (faction.id === 'monsterology') {
        customConditions.push("Extract specimens alive (+3 VP per live capture)");
        customConditions.push("Complete field research objectives (+2 VP per documented specimen)");
        
        if (scenario.objectives.some(obj => obj.resource_type === 'thyr')) {
          customConditions.push("Study Thyr phenomena without destroying samples (+4 VP bonus)");
        }
      }
      
      if (faction.id === 'shine_riders') {
        customConditions.push("Create memorable spectacle through daring maneuvers (+2 VP per legendary action)");
        customConditions.push("Extract maximum profit from chaos (+1 VP per resource stolen from opponents)");
        
        if (scenario.plot_family_id && (scenario.plot_family_id.includes('extraction') || scenario.plot_family_id.includes('ambush'))) {
          customConditions.push("Steal the most valuable cargo (+5 VP if you claim the highest-value objective)");
        }
      }
      
      if (faction.id === 'monsters') {
        customConditions.push("Defend territorial claims from intruders (+3 VP per round holding sacred ground)");
        customConditions.push("Drive humans from feeding grounds (+2 VP per human unit eliminated)");
        
        if (scenario.plot_family_id && scenario.plot_family_id.includes('ritual')) {
          customConditions.push("Protect mystically significant locations (+5 VP if ritual site remains uncorrupted)");
        }
      }
      
      // 4. PLOT FAMILY SPECIFIC CONDITIONS
      if (scenario.plot_family_id === 'escort_run') {
        if (faction.id === 'monster_rangers') {
          customConditions.push("Ensure cargo reaches destination safely without harming monsters en route");
        } else if (faction.id === 'liberty_corps') {
          customConditions.push("Seize or destroy the cargo convoy before it escapes");
        } else {
          customConditions.push("Intercept and claim the cargo for yourself");
        }
      }
      
      if (scenario.plot_family_id === 'siege_standoff') {
        if (faction.isNPC && userSelections.gameMode === 'solo') {
          customConditions.push("Break the siege or eliminate the defender before Round 6");
        } else {
          customConditions.push("Hold your fortified position until extraction or reinforcements arrive");
        }
      }
      
      // 5. WEAKNESSES - Things they struggle with
      if (factionData.faction_identity && factionData.faction_identity.what_they_struggle_with) {
        const struggle = this.randomChoice(factionData.faction_identity.what_they_struggle_with);
        customConditions.push(`⚠️ Weakness: ${struggle} (may cause VP penalties)`);
      }
      
      // Build final conditions object
      conditions[faction.id] = {
        target_vp: vpSpread.target_to_win,
        thresholds: vpSpread.thresholds,
        primary_scoring: vpSpread.scoring_rule,
        bonus_scoring: vpSpread.bonus_rule,
        formula: vpSpread.formula,
        
        // CUSTOM FACTION CONDITIONS
        faction_specific_conditions: customConditions,
        
        objectives: scenario.objectives.map(obj => ({
          name: obj.name,
          vp_value: obj.vp_per_unit,
          target: obj.target_value,
          max_vp: obj.max_vp,
          ticker: `${obj.progress_label}: [ ] / ${obj.target_value}`
        })),
        
        // Faction bonus from identity
        faction_bonus: factionData.faction_identity && factionData.faction_identity.what_they_fight_for ? 
          this.randomChoice(factionData.faction_identity.what_they_fight_for) + " (+3 VP)" :
          null
      };
    });
    
    console.log("✅ Custom victory conditions generated from faction data!");
    return conditions;
  }
  
  getGenericVictoryConditions(vpSpread, scenario) {
    return {
      target_vp: vpSpread.target_to_win,
      thresholds: vpSpread.thresholds,
      primary_scoring: vpSpread.scoring_rule,
      bonus_scoring: vpSpread.bonus_rule,
      formula: vpSpread.formula,
      faction_specific_conditions: ["Complete scenario objectives", "Score the target VP"],
      objectives: scenario.objectives.map(obj => ({
        name: obj.name,
        vp_value: obj.vp_per_unit,
        target: obj.target_value,
        max_vp: obj.max_vp,
        ticker: `${obj.progress_label}: [ ] / ${obj.target_value}`
      })),
      faction_bonus: null
    };
  }
  
  // ================================
  // STEP 14: GENERATE SCENARIO NAME
  // ================================
  
  generateScenarioName(contextTags, location, vaultMatch) {
    console.log("📝 Generating scenario name...");
    
    if (vaultMatch && vaultMatch.scenario.name && vaultMatch.score >= 5) {
      console.log("✅ Using vault scenario name:", vaultMatch.scenario.name);
      return vaultMatch.scenario.name;
    }
    
    if (!this.data.names || !this.data.names.prefixes || !this.data.names.suffixes) {
      return `The Battle of ${location.name}`;
    }
    
    let chosenPrefix = null;
    let maxPrefixMatches = 0;
    
    this.data.names.prefixes.forEach(prefix => {
      const matches = prefix.tags.filter(tag => contextTags.includes(tag)).length;
      if (matches > maxPrefixMatches) {
        maxPrefixMatches = matches;
        chosenPrefix = prefix.text;
      }
    });
    
    if (!chosenPrefix || maxPrefixMatches === 0) {
      const generalPrefixes = this.data.names.prefixes.filter(p => 
        p.tags.includes('general') || p.tags.includes('default') || p.tags.includes('time')
      );
      if (generalPrefixes.length > 0) {
        chosenPrefix = this.randomChoice(generalPrefixes).text;
      } else {
        chosenPrefix = "Night";
      }
    }
    
    console.log(`  Prefix: "${chosenPrefix}" (${maxPrefixMatches} matches)`);
    
    let chosenSuffix = null;
    let maxSuffixMatches = 0;
    
    if (location.name.length <= 15) {
      chosenSuffix = location.name;
    } else {
      this.data.names.suffixes.forEach(suffix => {
        const matches = suffix.tags.filter(tag => contextTags.includes(tag)).length;
        if (matches > maxSuffixMatches) {
          maxSuffixMatches = matches;
          chosenSuffix = suffix.text;
        }
      });
      
      if (!chosenSuffix || maxSuffixMatches === 0) {
        const genericSuffixes = this.data.names.suffixes.filter(s => 
          s.tags.includes('generic') || s.tags.includes('default')
        );
        if (genericSuffixes.length > 0) {
          chosenSuffix = this.randomChoice(genericSuffixes).text;
        } else {
          chosenSuffix = "the Canyon";
        }
      }
    }
    
    console.log(`  Suffix: "${chosenSuffix}" (${maxSuffixMatches} matches)`);
    
    const finalName = `The ${chosenPrefix} of ${chosenSuffix}`;
    console.log(`✅ Generated name: "${finalName}"`);
    
    return finalName;
  }
  
  // ================================
  // MAIN ORCHESTRATOR
  // ================================
  
  async generateCompleteScenario(userSelections) {
    console.log("🎬 BRAIN: Starting PLOT-FAMILY-FIRST scenario generation...");
    console.log("   User selections:", userSelections);
    
    if (!this.loaded) {
      console.log("   Brain not loaded yet, loading now...");
      await this.loadAllData();
    }
    
    // STEP 1: Build context tags
    const contextTags = this.buildContextTags(userSelections);
    
    // STEP 2: Generate location (NOW CREATES PROCEDURAL LOCATIONS!)
    const location = this.generateLocation(userSelections, contextTags);
    
    // STEP 3: Select plot family
    const plotFamily = this.selectPlotFamily(contextTags, location, userSelections);
    console.log("📖 Selected Plot Family:", plotFamily.name);
    
    // STEP 4: Find vault scenario
    const vaultMatch = this.findVaultScenarioForPlot(contextTags, userSelections, plotFamily);
    
    // STEP 5: Calculate VP spread
    const vpSpread = this.calculateVictorySpread(plotFamily.id, userSelections.dangerRating);
    
    // STEP 6: Get canyon state
    const canyonState = userSelections.canyonState || 'poisoned';
    
    // STEP 7: Generate objectives
    const objectives = this.generatePlotFamilyObjectives(
      plotFamily, 
      vaultMatch, 
      userSelections, 
      location, 
      canyonState,
      vpSpread
    );
    
    // STEP 8: Generate scenario name
    const scenarioName = this.generateScenarioName(contextTags, location, vaultMatch);
    
    // STEP 9: Generate narrative hook
    const narrativeHook = this.generatePlotFamilyNarrative(
      plotFamily,
      location,
      userSelections,
      vaultMatch
    );
    
    // STEP 10: Create base scenario
    let scenario = {
      name: scenarioName,
      narrative_hook: narrativeHook,
      plot_family: plotFamily.name,
      plot_family_id: plotFamily.id,
      location: location,
      danger_rating: userSelections.dangerRating,
      danger_description: this.getDangerDescription(userSelections.dangerRating),
      objectives: objectives,
      vp_spread: vpSpread,
      vault_source: vaultMatch ? vaultMatch.scenario.name : null,
      vault_score: vaultMatch ? vaultMatch.score : 0,
      context_tags: contextTags
    };
    
    // STEP 11: Add canyon state effects
    scenario = this.addCanyonStateEffects(scenario, canyonState);
    
    // STEP 12: Add monster pressure
    scenario.monster_pressure = this.generateMonsterPressure(userSelections, plotFamily);
    
    // STEP 13: Maybe add a twist
    if (Math.random() < 0.3) {
      scenario.twist = this.maybeAddTwist(userSelections.dangerRating);
    }
    
    // STEP 14: Generate Round 6 Finale
    scenario.finale = this.generateFinalEscalation(plotFamily, userSelections.dangerRating, location);
    
    // STEP 15: Generate CUSTOM victory conditions
    scenario.victory_conditions = this.generateMathematicalVictoryConditions(
      userSelections, 
      scenario,
      vpSpread
    );
    
    console.log("🎉 BRAIN: Scenario generation complete!");
    console.log("   Name:", scenario.name);
    console.log("   Plot Family:", scenario.plot_family);
    console.log("   Location:", scenario.location.name);
    console.log("   Target VP:", scenario.vp_spread.target_to_win);
    console.log("   Objectives:", scenario.objectives.length);
    
    return scenario;
  }
  
  // ================================
  // HELPER FUNCTIONS
  // ================================
  
  getDangerDescription(rating) {
    const descriptions = {
      1: 'Tutorial / Low Escalation - Controlled environment, comparatively safe',
      2: 'Frontier Skirmish - Regular patrols, moderate risk',
      3: 'Standard Coffin Canyon - Hostile territory, regular monster presence',
      4: 'High Pressure - Dangerous terrain, elite monsters possible',
      5: 'Escalation Guaranteed - Extreme conditions, Titan possible',
      6: 'Catastrostorm Risk - Titan-active or immune-dominant zone'
    };
    return descriptions[rating] || 'Unknown Danger Level';
  }
  
  capitalizeFirst(str) {
    if (!str) return '';
    return str.charAt(0).toUpperCase() + str.slice(1);
  }
  
  randomChoice(array) {
    if (!array || array.length === 0) return null;
    return array[Math.floor(Math.random() * array.length)];
  }
  
  randomInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }
}

// ================================
// EXPORT
// ================================

window.ScenarioBrain = ScenarioBrain;
console.log("✅ Scenario Brain class available as window.ScenarioBrain");
