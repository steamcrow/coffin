// ================================
// SCENARIO BRAIN - COMPLETE VERSION
// File: scenario_brain.js
// Purpose: Intelligent scenario generation using relational JSON data
// 
// Architecture:
// 1. Loads all JSON data files
// 2. Builds context tags from user selections
// 3. Selects Plot Family as organizing principle
// 4. Generates measurable objectives with VP math
// 5. Creates Round 6 finale using plot escalation
// 6. Outputs complete, playable scenario
// ================================

console.log("🧠 Scenario Brain loading...");

class ScenarioBrain {
  
  constructor() {
    // All our JSON data lives here
    this.data = {
      scenarios: null,           // 180_scenario_vault.json
      names: null,               // 230_scenario_names.json
      locations: null,           // 170_named_locations.json
      locationTypes: null,       // 150_location_types.json
      plotFamilies: null,        // 200_plot_families.json
      twists: null,              // 210_twist_tables.json
      canyonStates: null,        // R-CAMPAIGN.json
      factions: {}               // All faction files
    };
    
    this.loaded = false;
  }
  
  // ================================
  // STEP 1: LOAD ALL THE DATA
  // ================================
  
  async loadAllData() {
    console.log("📚 Brain loading all JSON files...");
    
    try {
      // Load scenario vault
      const vaultRes = await fetch('https://raw.githubusercontent.com/steamcrow/coffin/main/rules/src/180_scenario_vault.json?t=' + Date.now());
      this.data.scenarios = await vaultRes.json();
      console.log("✅ Scenario vault loaded:", this.data.scenarios.scenarios?.length || 0, "scenarios");
      
      // Load scenario names
      const namesRes = await fetch('https://raw.githubusercontent.com/steamcrow/coffin/main/rules/src/230_scenario_names.json?t=' + Date.now());
      this.data.names = await namesRes.json();
      console.log("✅ Scenario names loaded:", this.data.names.prefixes?.length || 0, "prefixes");
      
      // Load named locations
      const locationsRes = await fetch('https://raw.githubusercontent.com/steamcrow/coffin/main/rules/src/170_named_locations.json?t=' + Date.now());
      this.data.locations = await locationsRes.json();
      console.log("✅ Named locations loaded:", this.data.locations.locations?.length || 0, "locations");
      
      // Load location types (for random generation)
      const locationTypesRes = await fetch('https://raw.githubusercontent.com/steamcrow/coffin/main/rules/src/150_location_types.json?t=' + Date.now());
      this.data.locationTypes = await locationTypesRes.json();
      console.log("✅ Location types loaded:", this.data.locationTypes.location_types?.length || 0, "types");
      
      // Load plot families
      const plotRes = await fetch('https://raw.githubusercontent.com/steamcrow/coffin/main/rules/src/200_plot_families.json?t=' + Date.now());
      this.data.plotFamilies = await plotRes.json();
      console.log("✅ Plot families loaded:", this.data.plotFamilies.plot_families?.length || 0, "plots");
      
      // Load twists
      const twistRes = await fetch('https://raw.githubusercontent.com/steamcrow/coffin/main/rules/src/210_twist_tables.json?t=' + Date.now());
      this.data.twists = await twistRes.json();
      console.log("✅ Twists loaded:", this.data.twists.twists?.length || 0, "twists");
      
      // Load campaign states
      const campaignRes = await fetch('https://raw.githubusercontent.com/steamcrow/coffin/main/rules/src/R-CAMPAIGN.json?t=' + Date.now());
      this.data.canyonStates = await campaignRes.json();
      console.log("✅ Canyon States loaded");
      
      // Load Monster Rangers faction (others can be added later)
      const monsterRangersRes = await fetch('https://raw.githubusercontent.com/steamcrow/coffin/main/factions/faction-monster-rangers-v5.json?t=' + Date.now());
      this.data.factions['monster_rangers'] = await monsterRangersRes.json();
      console.log("✅ Monster Rangers faction loaded");
      
      this.loaded = true;
      console.log("🎉 Brain fully loaded and ready!");
      
    } catch (err) {
      console.error("❌ Brain failed to load data:", err);
      throw new Error("Brain initialization failed: " + err.message);
    }
  }
  
  // ================================
  // STEP 2: BUILD CONTEXT TAGS
  // This is how the Brain "understands" what you've selected
  // ================================
  
  buildContextTags(userSelections) {
    console.log("🏷️ Building context tags from selections:", userSelections);
    
    const tags = [];
    
    // --- FACTION TAGS ---
    userSelections.factions.forEach(faction => {
      tags.push(faction.id);
      
      // Add faction-specific tags from faction file
      const factionData = this.data.factions[faction.id];
      if (factionData && factionData.faction_tags) {
        tags.push(...factionData.faction_tags);
      }
      
      // Add faction feature keywords
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
    
    // Add state-specific tags based on R-CAMPAIGN.json
    const stateData = this.getCanyonStateData(canyonState);
    if (stateData) {
      if (stateData.faction) {
        tags.push(stateData.faction.toLowerCase().replace(/ /g, '_'));
      }
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
  // STEP 3: GENERATE OR SELECT LOCATION
  // ================================
  
  generateLocation(userSelections, contextTags) {
    console.log("📍 Generating location...");
    
    // If user selected a named location, use it
    if (userSelections.locationType === 'named' && userSelections.selectedLocation) {
      const location = this.data.locations.locations.find(l => l.id === userSelections.selectedLocation);
      console.log("✅ Using named location:", location.name);
      return location;
    }
    
    // Otherwise, generate a random location using 150_location_types.json
    return this.generateRandomLocation(userSelections.dangerRating, contextTags);
  }
  
  generateRandomLocation(dangerRating, contextTags) {
    console.log("🎲 Generating random location from location types...");
    
    if (!this.data.locationTypes || !this.data.locationTypes.location_types) {
      console.error("❌ Location types not loaded!");
      return null;
    }
    
    // Filter location types by danger rating
    const suitableTypes = this.data.locationTypes.location_types.filter(type => {
      // Check if danger rating is within range
      if (type.danger_floor && type.danger_ceiling) {
        return dangerRating >= type.danger_floor && dangerRating <= type.danger_ceiling;
      }
      return true; // Include if no danger range specified
    });
    
    if (suitableTypes.length === 0) {
      console.warn("⚠️ No suitable location types found, using all types");
      suitableTypes.push(...this.data.locationTypes.location_types);
    }
    
    // Pick random type
    const chosenType = this.randomChoice(suitableTypes);
    console.log("  Chose location type:", chosenType.name);
    
    // Generate location from type
    const location = {
      id: `random_${chosenType.id}_${Date.now()}`,
      name: this.generateLocationName(chosenType, contextTags),
      emoji: chosenType.emoji || "🗺️",
      type_ref: chosenType.id,
      description: chosenType.description,
      atmosphere: this.randomChoice(chosenType.atmosphere || ["The air is thick with tension"]),
      terrain_flavor: chosenType.terrain_features || ["Scattered debris"],
      
      // Add resource data from location type
      resources: chosenType.resources || {},
      hazards: chosenType.environmental_hazards || [],
      terrain_features: chosenType.terrain_features || [],
      
      // Mark as procedurally generated
      procedural: true
    };
    
    console.log("✅ Generated location:", location.name);
    return location;
  }
  
  generateLocationName(locationType, contextTags) {
    // If location type has example names, use one
    if (locationType.example_names && locationType.example_names.length > 0) {
      return this.randomChoice(locationType.example_names);
    }
    
    // Otherwise use descriptor + type name
    const descriptors = [
      "The", "Old", "Broken", "Lost", "Hidden", "Forgotten", 
      "Dead", "Cursed", "Blessed", "Ancient", "New"
    ];
    
    const descriptor = this.randomChoice(descriptors);
    return `${descriptor} ${locationType.name}`;
  }
  
  // ================================
  // STEP 4: SELECT PLOT FAMILY (THE ORGANIZING PRINCIPLE)
  // Matches context tags + location resources to best plot
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
      // High resource locations favor extraction/heist
      if (location.resources) {
        const totalResources = Object.values(location.resources).reduce((sum, val) => sum + val, 0);
        
        if (totalResources >= 8 && plot.id === 'extraction_heist') {
          score += 5;
          console.log(`  "${plot.name}": +5 for high resources (${totalResources})`);
        }
        
        // Specific resource types
        if (plot.primary_resources) {
          plot.primary_resources.forEach(resource => {
            if (location.resources[resource] && location.resources[resource] > 0) {
              score += 3;
              console.log(`  "${plot.name}": +3 for matching resource ${resource}`);
            }
          });
        }
      }
      
      // --- LOCATION TYPE MATCHING ---
      if (location.type_ref) {
        // Fortified locations favor siege
        if (location.type_ref.includes('fortress') && plot.id === 'siege_standoff') {
          score += 4;
          console.log(`  "${plot.name}": +4 for fortress location`);
        }
        
        // Travel routes favor escort
        if ((location.type_ref.includes('pass') || location.type_ref.includes('bridge')) && 
            plot.id === 'escort_run') {
          score += 4;
          console.log(`  "${plot.name}": +4 for travel route`);
        }
        
        // Ruins favor ambush
        if (location.type_ref.includes('ruins') && plot.id === 'ambush_derailment') {
          score += 4;
          console.log(`  "${plot.name}": +4 for ruins`);
        }
      }
      
      // --- FACTION MATCHING ---
      userSelections.factions.forEach(faction => {
        const factionData = this.data.factions[faction.id];
        if (!factionData) return;
        
        // Monster Rangers prefer rituals and mystical plots
        if (faction.id === 'monster_rangers' && plot.id === 'ritual_corruption') {
          score += 3;
          console.log(`  "${plot.name}": +3 for Monster Rangers + ritual`);
        }
        
        // Check faction's preferred scenarios
        if (factionData.scenario_preferences && factionData.scenario_preferences.ideal_scenarios) {
          const scenarioTypes = factionData.scenario_preferences.ideal_scenarios;
          if (scenarioTypes.some(type => 
            plot.name.toLowerCase().includes(type.toLowerCase().split(' ')[0]) ||
            type.toLowerCase().includes(plot.name.toLowerCase().split(' ')[0])
          )) {
            score += 2;
            console.log(`  "${plot.name}": +2 for faction scenario preference`);
          }
        }
      });
      
      // --- DANGER MATCHING ---
      const danger = userSelections.dangerRating;
      
      // High danger favors complex plots
      if (danger >= 5 && (plot.id === 'ritual_corruption' || plot.id === 'natural_disaster')) {
        score += 2;
        console.log(`  "${plot.name}": +2 for high danger complexity`);
      }
      
      // Low danger favors simpler plots
      if (danger <= 2 && (plot.id === 'claim_and_hold' || plot.id === 'escort_run')) {
        score += 2;
        console.log(`  "${plot.name}": +2 for low danger simplicity`);
      }
      
      // Track best match
      if (score > maxScore) {
        maxScore = score;
        bestPlot = plot;
      }
    });
    
    if (!bestPlot) {
      // Fallback to random
      console.warn("⚠️ No strong plot match, selecting random");
      bestPlot = this.randomChoice(this.data.plotFamilies.plot_families);
    }
    
    console.log(`✅ Selected: "${bestPlot.name}" (score: ${maxScore})`);
    return bestPlot;
  }
  
  // ================================
  // STEP 5: FIND VAULT SCENARIO (Filtered by plot family)
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
      
      // --- TAG MATCHING (1 point each) ---
      if (scenario.tags && Array.isArray(scenario.tags)) {
        const tagMatches = scenario.tags.filter(tag => 
          contextTags.includes(tag)
        );
        score += tagMatches.length;
        
        // Bonus for plot family tag matches
        const plotId = plotFamily.id;
        if (scenario.tags.includes(`plot_${plotId}`) || 
            scenario.tags.includes(plotId)) {
          score += 3;
          console.log(`  "${scenario.name}": +3 for plot family match`);
        }
      }
      
      // --- FACTION SPOTLIGHT BONUS (3 points each) ---
      if (scenario.spotlight_factions && Array.isArray(scenario.spotlight_factions)) {
        const factionMatches = scenario.spotlight_factions.filter(spotlightFaction => {
          return userSelections.factions.some(playerFaction => {
            const normalized = spotlightFaction.toLowerCase().replace(/ /g, '_');
            return playerFaction.id.includes(normalized) || normalized.includes(playerFaction.id);
          });
        });
        score += factionMatches.length * 3;
      }
      
      // --- DANGER RANGE BONUS (2 points) ---
      if (scenario.danger_floor && scenario.danger_ceiling) {
        const danger = userSelections.dangerRating;
        if (danger >= scenario.danger_floor && danger <= scenario.danger_ceiling) {
          score += 2;
        }
      }
      
      // Track best
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
  // Converts Plot Families into measurable game mechanics
  // ================================
  
  calculateVictorySpread(plotFamilyId, dangerRating) {
    console.log("🎲 Calculating VP spread for:", plotFamilyId, "at Danger", dangerRating);
    
    const baseVP = 10;
    const scalingFactor = dangerRating * 2;
    const targetScore = baseVP + scalingFactor;
    
    // Define VP logic per Plot Family
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
        primary_value: 1, // Per 6 inches
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
  // Uses plot family as template for measurable goals
  // ================================
  
  generatePlotFamilyObjectives(plotFamily, vaultMatch, userSelections, location, canyonState, vpSpread) {
    console.log("🎯 Generating Plot Family objectives from:", plotFamily.name);
    
    const objectives = [];
    
    // --- USE PLOT FAMILY'S DEFAULT OBJECTIVES AS TEMPLATE ---
    if (plotFamily.default_objectives && plotFamily.default_objectives.length > 0) {
      console.log("  Using", plotFamily.default_objectives.length, "default objectives from plot");
      
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
    
    // --- ADD LOCATION-SPECIFIC RESOURCE OBJECTIVE ---
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
    
    // --- ADD FACTION-SPECIFIC OBJECTIVES ---
    userSelections.factions.forEach(faction => {
      const factionData = this.data.factions[faction.id];
      if (!factionData) return;
      
      // Generate objective based on faction + location combo
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
    
    // --- ENSURE MINIMUM OBJECTIVES ---
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
  
  // Helper: Build objective from type
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
        target: 4, // 4 activations = 24"
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
        target: 24, // 24 inches
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
        target: Math.ceil(userSelections.factions.length * 2), // Based on force size
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
  
  // Helper: Generate faction + location specific objective
  generateFactionLocationObjective(factionData, location, canyonState, dangerRating) {
    const factionId = factionData.faction;
    
    // Monster Rangers specific objectives
    if (factionId === "Monster Rangers") {
      // Check for monster-related opportunities
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
      
      // Check for corruption/purification opportunities
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
    
    // Generic faction objective based on preferred scenarios
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
  
  // Helper: Get resource flavor text
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
  
  // Helper: Get VP value for resources
  getResourceVPValue(resourceType) {
    const vpValues = {
      'thyr': 4,        // Most valuable
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
  // STEP 8: GENERATE PLOT FAMILY NARRATIVE
  // Uses Mad Libs style with plot family data
  // ================================
  
  generatePlotFamilyNarrative(plotFamily, location, userSelections, vaultMatch) {
    console.log("📝 Generating Plot Family narrative...");
    
    // If vault has great narrative and high score, use it
    if (vaultMatch && vaultMatch.scenario.narrative_hook && vaultMatch.score >= 5) {
      return vaultMatch.scenario.narrative_hook;
    }
    
    // Otherwise, build from plot family
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
    
    // MAD LIBS TEMPLATE
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
    const enabled = Math.random() > 0.3; // 70% chance
    
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
  // Uses Plot Family escalation_bias
  // ================================
  
  generateFinalEscalation(plotFamily, dangerRating, location) {
    console.log("🎭 Generating Round 6 finale...");
    
    // Get twist from plot family
    const twist = plotFamily.twist_bias ? 
      this.randomChoice(plotFamily.twist_bias) : 
      "sudden_collapse";
    
    // Get escalation from plot family
    const escalation = plotFamily.escalation_bias ?
      this.randomChoice(plotFamily.escalation_bias) :
      "environmental_hazard";
    
    const dangerDamage = dangerRating * 2;
    
    // Create finale based on escalation type
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
  // STEP 13: GENERATE MATHEMATICAL VICTORY CONDITIONS
  // Uses VP spread from plot family
  // ================================
  
  generateMathematicalVictoryConditions(userSelections, scenario, vpSpread) {
    console.log("🏆 Generating mathematical victory conditions...");
    
    const conditions = {};
    
    userSelections.factions.forEach(faction => {
      const factionData = this.data.factions[faction.id];
      
      conditions[faction.id] = {
        target_vp: vpSpread.target_to_win,
        thresholds: vpSpread.thresholds,
        primary_scoring: vpSpread.scoring_rule,
        bonus_scoring: vpSpread.bonus_rule,
        formula: vpSpread.formula,
        
        objectives: scenario.objectives.map(obj => ({
          name: obj.name,
          vp_value: obj.vp_per_unit,
          target: obj.target_value,
          max_vp: obj.max_vp,
          ticker: `${obj.progress_label}: [ ] / ${obj.target_value}`
        })),
        
        faction_bonus: factionData && factionData.faction_identity ? 
          this.randomChoice(factionData.faction_identity.what_they_fight_for) + " (+2 VP)" :
          null
      };
    });
    
    console.log("✅ Victory conditions with VP math generated");
    return conditions;
  }
  
  // ================================
  // STEP 14: GENERATE SCENARIO NAME
  // Uses tag-based matching from 230_scenario_names.json
  // ================================
  
  generateScenarioName(contextTags, location, vaultMatch) {
    console.log("📝 Generating scenario name...");
    
    // If vault scenario has a good name, use it
    if (vaultMatch && vaultMatch.scenario.name && vaultMatch.score >= 5) {
      console.log("✅ Using vault scenario name:", vaultMatch.scenario.name);
      return vaultMatch.scenario.name;
    }
    
    if (!this.data.names || !this.data.names.prefixes || !this.data.names.suffixes) {
      return `The Battle of ${location.name}`;
    }
    
    // Find best PREFIX by tag matching
    let chosenPrefix = null;
    let maxPrefixMatches = 0;
    
    this.data.names.prefixes.forEach(prefix => {
      const matches = prefix.tags.filter(tag => contextTags.includes(tag)).length;
      if (matches > maxPrefixMatches) {
        maxPrefixMatches = matches;
        chosenPrefix = prefix.text;
      }
    });
    
    // Fallback to general prefix
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
    
    // Find best SUFFIX by tag matching
    let chosenSuffix = null;
    let maxSuffixMatches = 0;
    
    // First try location name if it's short
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
      
      // Fallback
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
  // MAIN FUNCTION: GENERATE COMPLETE SCENARIO
  // THE ORCHESTRATOR - This runs everything in order
  // ================================
  
  async generateCompleteScenario(userSelections) {
    console.log("🎬 BRAIN: Starting PLOT-FAMILY-FIRST scenario generation...");
    console.log("   User selections:", userSelections);
    
    // Make sure data is loaded
    if (!this.loaded) {
      console.log("   Brain not loaded yet, loading now...");
      await this.loadAllData();
    }
    
    // STEP 1: Build context tags
    const contextTags = this.buildContextTags(userSelections);
    
    // STEP 2: Generate or select location EARLY (we need it for plot selection)
    const location = this.generateLocation(userSelections, contextTags);
    
    // STEP 3: SELECT PLOT FAMILY (THE ORGANIZING PRINCIPLE)
    const plotFamily = this.selectPlotFamily(contextTags, location, userSelections);
    console.log("📖 Selected Plot Family:", plotFamily.name);
    
    // STEP 4: Find vault scenario (now filtered by plot family)
    const vaultMatch = this.findVaultScenarioForPlot(contextTags, userSelections, plotFamily);
    
    // STEP 5: Calculate VP spread based on plot family
    const vpSpread = this.calculateVictorySpread(plotFamily.id, userSelections.dangerRating);
    
    // STEP 6: Get canyon state
    const canyonState = userSelections.canyonState || 'poisoned';
    
    // STEP 7: Generate MEASURABLE objectives using plot family template
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
    
    // STEP 9: Generate narrative hook using plot family
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
    
    // STEP 13: Maybe add a twist (separate from Round 6 finale)
    if (Math.random() < 0.3) {
      scenario.twist = this.maybeAddTwist(userSelections.dangerRating);
    }
    
    // STEP 14: Generate Round 6 Finale (using plot family escalation)
    scenario.finale = this.generateFinalEscalation(plotFamily, userSelections.dangerRating, location);
    
    // STEP 15: Generate victory conditions (now using VP spread)
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
  
  // Utility functions
  randomChoice(array) {
    if (!array || array.length === 0) return null;
    return array[Math.floor(Math.random() * array.length)];
  }
  
  randomInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }
}

// ================================
// EXPORT THE BRAIN
// ================================

window.ScenarioBrain = ScenarioBrain;
console.log("✅ Scenario Brain class available as window.ScenarioBrain");
```

---

## Usage Instructions

**1. Add this file to your GitHub repo at:**
```
/rules/src/scenario_brain.js
