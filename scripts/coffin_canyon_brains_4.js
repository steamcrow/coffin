CCFB.define("main", function (C) {
  // 1. Initialize Global UI State (Restored to stable 'budget' variable)
  C.ui = C.ui || {
    fKey: "monster-rangers",
    budget: 500,
    mode: "grid",
    roster: [],
    sId: null
  };
  
  // 2. Helper: Find unit data
  C.getUnit = function(fKey, unitName) {
    const faction = C.state?.factions?.[fKey];
    return faction?.units?.find(u => u.name === unitName);
  };
  
  // 3. Helper: Calculate Total (Restored stable calculation)
  C.calculateTotal = function() {
    return (C.ui.roster || []).reduce((sum, item) => {
      const baseCost = item.cost || 0;
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
    C.ui.budget = parseInt(newBudget) || 500;
    if (window.CCFB.refreshUI) window.CCFB.refreshUI();
  };
  
  // 6. Tool Stubs
  window.CCFB.shareRoster = function() { alert("Share feature coming soon!"); };
  window.printRoster = function() { window.print(); };
  
  // 7. Boot Module (Restored original sequence)
  return {
    boot: function (containerId, factionFolder) {
      C.state.dataBaseUrl = factionFolder;
      CCFB.require(["data/loaders"], function (loaders) {
        loaders.loadRules().then(function() {
          loaders.loadFaction(C.ui.fKey || "monster-rangers").then(function() {
            C.state.loading = false;
            if (window.CCFB.refreshUI) window.CCFB.refreshUI();
          });
        });
      });
    }
  };
});
