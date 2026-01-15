CCFB.define("main", function (C) {
  // 1. Initialize Global UI State
  C.ui = C.ui || {
    fKey: "monster-rangers",
    limit: 500, // Changed from budget to limit to match Painter logic
    mode: "grid",
    roster: [],
    sId: null
  };
  
  // 2. Helper for Painter: Find unit data
  C.getUnit = function(fKey, unitName) {
    const faction = C.state?.factions?.[fKey];
    return faction?.units?.find(u => u.name === unitName);
  };
  
  // 3. Helper for Painter: Calculate Roster Points (REVISED FOR UPGRADES)
  C.calculateTotal = function() {
    return (C.ui.roster || []).reduce((sum, item) => {
      // Get the base cost stored in the roster item
      const baseCost = item.cost || 0;
      
      // Calculate total of all selected upgrades for this specific unit instance
      const upgradeTotal = (item.selectedUpgrades || []).reduce((uSum, upg) => {
        return uSum + (upg.cost || 0);
      }, 0);
      
      return sum + baseCost + upgradeTotal;
    }, 0);
  };
  
  // 4. Handle Faction Selection
  window.CCFB.handleFactionChange = function(newKey) {
    C.ui.fKey = newKey;
    CCFB.require(["data/loaders"], function(loaders) {
      loaders.loadFaction(newKey);
    });
  };
  
  // 5. Handle Budget Selection
  window.CCFB.handleBudgetChange = function(newBudget) {
    // Keep internal state 'limit' synced with the dropdown
    C.ui.limit = parseInt(newBudget); 
    if (window.CCFB.refreshUI) window.CCFB.refreshUI();
  };
  
  // 6. Share Roster (stub for now)
  window.CCFB.shareRoster = function() {
    alert("Share feature coming soon!");
  };
  
  // 7. Print Roster (stub for now)
  window.printRoster = function() {
    window.print();
  };
  
  // 8. Create the module object to return
  const mainModule = {
    boot: function (containerId, factionFolder) {
      ccfbLog("🚀 Brain: Booting...");
      C.state.dataBaseUrl = factionFolder;
      CCFB.require(["data/loaders"], function (loaders) {
        loaders.loadRules().then(function() {
          ccfbLog("✅ Rules Loaded. Initializing UI...");
          
          // Load default faction
          loaders.loadFaction(C.ui.fKey || "monster-rangers");
          
          C.state.loading = false;
          if (window.CCFB.refreshUI) window.CCFB.refreshUI();
        });
      });
    }
  };
  return mainModule;
});