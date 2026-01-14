CCFB.define("main", function (C) {
  // 1. Initialize Global UI State
  // We define it on C and window.CCFB to ensure both "Brain" and "Painter" see the same data
  C.ui = {
    fKey: "monster-rangers",
    budget: 500,
    mode: "grid",
    roster: [],
    sId: null
  };
  
  // CRITICAL BRIDGE: Ensures the Painter sees the exact same Roster as the Brain
  window.CCFB.ui = C.ui;
  
  // 2. Helper for Painter: Find unit data
  // This looks up the stats for a specific unit in the current faction
  C.getUnit = function(fKey, unitName) {
    const faction = C.state?.factions?.[fKey];
    return faction?.units?.find(u => u.name === unitName);
  };
  
  // 3. Helper for Painter: Calculate Roster Points
  // This sums up the cost of every unit currently in the list
  C.calculateTotal = function() {
    return (C.ui.roster || []).reduce((sum, item) => {
      // We use the cost stored in the item for reliability
      return sum + (item.cost || 0);
    }, 0);
  };
  
  // 4. Handle Faction Selection
  // This is called when the user chooses a new faction from the dropdown
  window.CCFB.handleFactionChange = function(newKey) {
    ccfbLog("📂 Main: Faction Change Request -> " + newKey);
    C.ui.fKey = newKey;
    CCFB.require(["data/loaders"], function(loaders) {
      loaders.loadFaction(newKey).then(function() {
         ccfbLog("✅ Main: Faction " + newKey + " loaded successfully.");
         if (window.CCFB.refreshUI) window.CCFB.refreshUI();
      });
    });
  };
  
  // 5. Handle Budget Selection
  window.CCFB.handleBudgetChange = function(newBudget) {
    ccfbLog("💰 Main: Budget Change Request -> " + newBudget);
    C.ui.budget = parseInt(newBudget);
    if (window.CCFB.refreshUI) window.CCFB.refreshUI();
  };
  
  // 6. Share Roster (stub for now)
  window.CCFB.shareRoster = function() {
    alert("Share feature coming soon! Your current roster has " + C.ui.roster.length + " units.");
  };
  
  // 7. Print Roster (stub for now)
  window.printRoster = function() {
    ccfbLog("🖨️ Main: Printing Roster...");
    window.print();
  };
  
  // 8. Create the module object to return
  const mainModule = {
    boot: function (containerId, factionFolder) {
      ccfbLog("🚀 Brain: Booting...");
      
      // Store the base URL for data
      C.state.dataBaseUrl = factionFolder;
      
      CCFB.require(["data/loaders"], function (loaders) {
        // Step 1: Load Global Rules
        loaders.loadRules().then(function() {
          ccfbLog("✅ Rules Loaded. Initializing UI...");
          
          // Step 2: Load Default Faction
          return loaders.loadFaction(C.ui.fKey);
        }).then(function() {
          ccfbLog("✅ Default Faction Loaded.");
          
          C.state.loading = false;
          
          // Initial UI Draw
          if (window.CCFB.refreshUI) window.CCFB.refreshUI();
        }).catch(function(err) {
          console.error("❌ Boot Sequence Failed:", err);
        });
      });

      // CRITICAL FIX FOR DROPDOWNS:
      // This listener catches changes to f-selector even if Odoo blocks the "onchange" attribute
      document.addEventListener('change', function (e) {
          if (e.target && e.target.id === 'f-selector') {
              window.CCFB.handleFactionChange(e.target.value);
          }
          if (e.target && e.target.id === 'budget-selector') {
              window.CCFB.handleBudgetChange(e.target.value);
          }
      });
    }
  };
  
  return mainModule;
});