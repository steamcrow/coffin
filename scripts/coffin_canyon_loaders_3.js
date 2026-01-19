CCFB.define("data/loaders", function (C) {
  
  // ============================================================
  // NEW: RULES TRANSFORMER (same one from Painter)
  // ============================================================
  C.transformRules = function(rawRules) {
    const transformed = {
      abilities: [],
      weapon_properties: [],
      type_rules: []
    };
    
    const abilityDict = rawRules?.rules_master?.ability_dictionary;
    
    if (!abilityDict) {
      console.warn("⚠️ No ability_dictionary found in rules");
      return transformed;
    }
    
    // Loop through each category (A_deployment_timing, B_movement_positioning, etc)
    for (let categoryKey in abilityDict) {
      const category = abilityDict[categoryKey];
      
      // Loop through each ability in this category
      for (let abilityKey in category) {
        const abilityText = category[abilityKey];
        
        transformed.abilities.push({
          id: abilityKey,
          name: makeReadable(abilityKey),
          effect: abilityText,
          category: categoryKey
        });
      }
    }
    
    console.log(`✅ Transformed ${transformed.abilities.length} abilities from rules`);
    return transformed;
  };
  
  // Helper: Turn "first_strike" into "First Strike"
  function makeReadable(id) {
    return id.split('_').map(word => 
      word.charAt(0).toUpperCase() + word.slice(1)
    ).join(' ');
  }
  
  // ============================================================
  // EXISTING: LOAD FUNCTIONS
  // ============================================================
  return {
    loadRules: async function() {
      // Add cache busting to ensure we always get the latest rules
      const url = "https://raw.githubusercontent.com/steamcrow/coffin/main/factions/rules.json?t=" + Date.now();
      
      try {
        const res = await fetch(url);
        if(res.ok) { 
            // CHANGED: Transform the raw rules into flat arrays
            const rawRules = await res.json();
            C.state.rules = C.transformRules(rawRules);
            
            if (window.diagLog) diagLog("📜 Rules loaded successfully.", "#0f0");
            console.log("📜 Rules loaded and transformed.");
        }
      } catch(e) { 
        if (window.diagLog) diagLog("⚠️ Rules load failed. Using defaults.", "#f33");
        console.warn("Rules load failed:", e); 
      }
      return true;
    },
    
    loadFaction: async function (fKey) {
      if (window.diagLog) diagLog(`📡 Requesting Faction: ${fKey}...`, "#ff7518");
      
      // Ensure UI state is initialized so we don't crash on first load
      C.ui = C.ui || {};
      C.ui.roster = C.ui.roster || [];
      C.ui.budget = C.ui.budget || 500;
      
      CCFB.require(["config/docTokens"], async function(cfg) {
        const entry = cfg.getFaction(fKey);
        if (!entry) {
            console.error("❌ No config entry for:", fKey);
            if (window.diagLog) diagLog(`❌ Faction Key "${fKey}" not found in config.`, "#f33");
            return;
        }
        const url = "https://raw.githubusercontent.com/steamcrow/coffin/main/factions/" + entry.url + "?t=" + Date.now();
        
        try {
          const res = await fetch(url);
          if (!res.ok) throw new Error(`HTTP ${res.status} - Not Found`);
          
          const data = await res.json();
          
          // Save the data to our state
          C.state.factions[fKey] = data;
          C.ui.fKey = fKey; 
          
          if (window.diagLog) diagLog(`✅ Loaded ${data.name || fKey}`, "#0f0");
          
          // Force the UI to refresh with the new data
          if (typeof window.CCFB.refreshUI === "function") {
            window.CCFB.refreshUI();
          }
        } catch (err) { 
          console.error("❌ JSON Fetch Failed:", err); 
          if (window.diagLog) diagLog(`❌ Fetch Failed: ${err.message}`, "#f33");
        }
      });
    }
  };
});
