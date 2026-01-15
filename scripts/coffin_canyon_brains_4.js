CCFB.define("main", function (C) {
  C.ui = C.ui || { fKey: "monster-rangers", limit: 500, mode: "grid", roster: [], sId: null };
  
  C.getUnit = function(fKey, unitName) {
    const faction = C.state?.factions?.[fKey];
    return faction?.units?.find(u => u.name === unitName);
  };
  
  C.calculateTotal = function() {
    return (C.ui.roster || []).reduce((sum, item) => {
      const baseCost = item.cost || 0;
      const upgradeTotal = (item.selectedUpgrades || []).reduce((uSum, u) => uSum + (u.cost || 0), 0);
      return sum + baseCost + upgradeTotal;
    }, 0);
  };
  
  window.CCFB.handleFactionChange = function(newKey) {
    C.ui.fKey = newKey;
    CCFB.require(["data/loaders"], (loaders) => loaders.loadFaction(newKey));
  };
  
  window.CCFB.handleBudgetChange = function(newBudget) {
    C.ui.limit = parseInt(newBudget);
    if (window.CCFB.refreshUI) window.CCFB.refreshUI();
  };
  
  window.CCFB.shareRoster = () => alert("Coming soon!");
  window.printRoster = () => window.print();
  
  return {
    boot: function (containerId, factionFolder) {
      C.state.dataBaseUrl = factionFolder;
      CCFB.require(["data/loaders"], (loaders) => {
        loaders.loadRules().then(() => {
          loaders.loadFaction(C.ui.fKey);
          C.state.loading = false;
          if (window.CCFB.refreshUI) window.CCFB.refreshUI();
        });
      });
    }
  };
});