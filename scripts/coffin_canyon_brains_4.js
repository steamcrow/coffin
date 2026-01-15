CCFB.define("main", function (C) {
  // 1. Initialize Global UI State
  C.ui = C.ui || {
    fKey: "monster-rangers",
    limit: 500, // Synchronized with Painter
    mode: "grid",
    roster: [],
    sId: null
  };
  
  // 2. Helper: Find unit data
  C.getUnit = function(fKey, unitName) {
    const faction = C.state?.factions?.[fKey];
    return faction?.units?.find(u => u.name === unitName);
  };
  
  // 3. Helper: Calculate Total (Units + Upgrades)
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
    C.ui.limit = parseInt(newBudget) || 0;
    if (window.CCFB.refreshUI) window.CCFB.refreshUI();
  };
  
  // 6. Tool Stubs
  window.CCFB.shareRoster = function() { alert("Share feature coming soon!"); };
  window.printRoster = function() { window.print(); };
  
  // 7. Boot Module
  return {
    boot: function (containerId, factionFolder) {
      C.state.dataBaseUrl = factionFolder;
      CCFB.require(["data/loaders"], function (loaders) {
        loaders.loadRules().then(function() {
          loaders.loadFaction(C.ui.fKey || "monster-rangers").then(function() {
            
            // Set initial limit from the dropdown
            const bSel = document.getElementById("budget-selector");
            if (bSel) C.ui.limit = parseInt(bSel.value);

            C.state.loading = false;
            if (window.CCFB.refreshUI) window.CCFB.refreshUI();
          });
        });
      });
    }
  };
});
