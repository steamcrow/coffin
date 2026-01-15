CCFB.define("main", function (C) {
  // 1. Setup Data
  C.ui = C.ui || {
    fKey: "monster-rangers",
    limit: 500, 
    mode: "grid",
    roster: [],
    sId: null
  };
  
  C.getUnit = function(fKey, unitName) {
    const faction = C.state?.factions?.[fKey];
    return faction?.units?.find(u => u.name === unitName);
  };
  
  // 2. The Math Teacher: Calculates units + upgrades
  C.calculateTotal = function() {
    return (C.ui.roster || []).reduce((sum, item) => {
      const baseCost = item.cost || 0;
      const upgradeTotal = (item.selectedUpgrades || []).reduce((uSum, upg) => uSum + (upg.cost || 0), 0);
      return sum + baseCost + upgradeTotal;
    }, 0);
  };
  
  window.CCFB.handleFactionChange = function(newKey) {
    C.ui.fKey = newKey;
    CCFB.require(["data/loaders"], function(loaders) {
      loaders.loadFaction(newKey);
    });
  };
  
  // 3. The Budget Link
  window.CCFB.handleBudgetChange = function(newBudget) {
    C.ui.limit = parseInt(newBudget) || 0;
    if (window.CCFB.refreshUI) window.CCFB.refreshUI();
  };
  
  window.CCFB.shareRoster = function() { alert("Coming soon!"); };
  window.printRoster = function() { window.print(); };
  
  return {
    boot: function (containerId, factionFolder) {
      C.state.dataBaseUrl = factionFolder;
      CCFB.require(["data/loaders"], function (loaders) {
        loaders.loadRules().then(function() {
          loaders.loadFaction(C.ui.fKey);
          C.state.loading = false;
          if (window.CCFB.refreshUI) window.CCFB.refreshUI();
        });
      });
    }
  };
});