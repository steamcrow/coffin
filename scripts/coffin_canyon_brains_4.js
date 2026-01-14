CCFB.define("main", function (C) {
  // 1. Initialize Global UI State
  // This is the single source of truth for your app
  C.ui = {
    fKey: "monster-rangers",
    budget: 500,
    mode: "grid",
    roster: [],
    sId: null
  };
  
  // CRITICAL FIX: Link the internal state to the window so the Painter can see it
  window.CCFB.ui = C.ui;
  
  // 2. Helper for Painter: Find unit data
  C.getUnit = function(fKey, unitName) {
    const faction = C.state?.factions?.[fKey];
    return faction?.units?.find(u => u.name === unitName);
  };
  
  // 3. Helper for Painter: Calculate Roster Points
  C.calculateTotal = function() {
    return (C.ui.roster || []).reduce((sum, item) => {
      return sum + (item.cost || 0);
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
    C.ui.budget = parseInt(newBudget);
    if (window.CCFB.refreshUI) window.CCFB.refreshUI();
  };
  
  // 6. Share Roster (stub)
  window.CCFB.shareRoster = function() {
    alert("Share feature coming soon!");
  };
  
  // 7. Print Roster
  window.printRoster = function() {
    window.print();
  };
  
  // 8. Create the module object to return
  const mainModule = {
    boot: function (containerId, factionFolder) {
      C.state.dataBaseUrl = factionFolder;
      CCFB.require(["data/loaders"], function (loaders) {
        loaders.loadRules().then(function() {
          // Load default faction
          loaders.loadFaction(C.ui.fKey);
          C.state.loading = false;
          
          // Wait a tiny bit for components to mount, then refresh
          setTimeout(() => {
            if (window.CCFB.refreshUI) window.CCFB.refreshUI();
          }, 200);
        });
      });
    }
  };
  return mainModule;
});