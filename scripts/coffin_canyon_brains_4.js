CCFB.define("main", function (C) {
  // 1. Initialize Global UI State
  C.ui = C.ui || {
    fKey: "monster-rangers",
    limit: 500,
    mode: "grid",
    roster: [],
    sId: null
  };
  
  // 2. Helper: Find unit data
  C.getUnit = function(fKey, unitName) {
    const faction = C.state?.factions?.[fKey];
    return faction?.units?.find(u => u.name === unitName);
  };
  
  // 3. Helper: Calculate Points (Units + Upgrades)
  C.calculateTotal = function() {
    return (C.ui.roster || []).reduce((sum, item) => {
      const baseCost = item.cost || 0;
      const upgradeTotal = (item.selectedUpgrades || []).reduce((uSum, u) => uSum + (u.cost || 0), 0);
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
    // Only refresh if the Painter is actually ready
    if (window.CCFB.refreshUI) window.CCFB.refreshUI();
  };
  
  window.CCFB.shareRoster = function() { alert("Share feature coming soon!"); };
  window.printRoster = function() { window.print(); };
  
  // 6. Boot Sequence
  const mainModule = {
    boot: function (containerId, factionFolder) {
      C.state.dataBaseUrl = factionFolder;
      CCFB.require(["data/loaders"], function (loaders) {
        loaders.loadRules().then(function() {
          loaders.loadFaction(C.ui.fKey || "monster-rangers").then(() => {
            
            // NOW WE SET THE BUDGET: Everything is loaded, so this won't crash
            const budgetEl = document.getElementById("budget-selector");
            if (budgetEl) {
                C.ui.limit = parseInt(budgetEl.value);
            }

            C.state.loading = false;
            if (window.CCFB.refreshUI) window.CCFB.refreshUI();
          });
        });
      });
    }
  };
  return mainModule;
});
