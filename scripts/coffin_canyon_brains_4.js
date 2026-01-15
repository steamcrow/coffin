// --- GLOBAL FUNCTIONS (Placed at the very top to prevent "is not a function" errors) ---
window.CCFB = window.CCFB || {};

window.CCFB.handleFactionChange = function(newKey) {
  CCFB.require(["main", "data/loaders"], function(C, loaders) {
    C.ui.fKey = newKey;
    loaders.loadFaction(newKey);
  });
};

window.CCFB.handleBudgetChange = function(newBudget) {
  CCFB.require(["main"], function(C) {
    C.ui.limit = parseInt(newBudget) || 0;
    if (window.CCFB.refreshUI) window.CCFB.refreshUI();
  });
};

window.CCFB.shareRoster = () => alert("Share feature coming soon!");
window.printRoster = () => window.print();

// --- MODULE DEFINITION ---
CCFB.define("main", function (C) {
  // Initialize State
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

  C.calculateTotal = function() {
    return (C.ui.roster || []).reduce((sum, item) => {
      const baseCost = item.cost || 0;
      const upgradeTotal = (item.selectedUpgrades || []).reduce((uSum, u) => uSum + (u.cost || 0), 0);
      return sum + baseCost + upgradeTotal;
    }, 0);
  };

  return {
    boot: function (containerId, factionFolder) {
      C.state.dataBaseUrl = factionFolder;
      CCFB.require(["data/loaders"], function (loaders) {
        loaders.loadRules().then(function() {
          loaders.loadFaction(C.ui.fKey).then(function() {
            // Initial Budget Sync
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
