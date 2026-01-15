CCFB.define("main", function (C) {
  
  // --- 1. GLOBAL UI FUNCTIONS ---
  // We define these first so the HTML buttons and dropdowns can see them immediately.
  
  window.CCFB.handleFactionChange = function(newKey) {
    console.log("📡 Brain: Switching Faction to", newKey);
    C.ui.fKey = newKey;
    CCFB.require(["data/loaders"], function(loaders) {
      loaders.loadFaction(newKey);
    });
  };

  window.CCFB.handleBudgetChange = function(newBudget) {
    const val = parseInt(newBudget) || 0;
    C.ui.limit = val; 
    console.log("💰 Brain: Budget Limit set to", val);
    if (window.CCFB.refreshUI) window.CCFB.refreshUI();
  };

  window.CCFB.shareRoster = function() {
    alert("Share feature coming soon!");
  };

  window.printRoster = function() {
    window.print();
  };

  // --- 2. INITIALIZE GLOBAL STATE ---
  C.ui = C.ui || {
    fKey: "monster-rangers",
    limit: 500,
    mode: "grid",
    roster: [],
    sId: null
  };

  // --- 3. CORE HELPERS ---
  
  // Finds the raw data for a unit from the loaded faction JSON
  C.getUnit = function(fKey, unitName) {
    const faction = C.state?.factions?.[fKey];
    return faction?.units?.find(u => u.name === unitName);
  };

  // The "Master Accountant": Adds up Base Cost + All Selected Upgrades
  C.calculateTotal = function() {
    if (!C.ui.roster) return 0;
    
    return C.ui.roster.reduce((totalSum, item) => {
      // Start with the base cost of the unit
      const baseCost = item.cost || 0;
      
      // Look at the "selectedUpgrades" array we built in the Painter
      const upgradeSum = (item.selectedUpgrades || []).reduce((uSum, upg) => {
        return uSum + (upg.cost || 0);
      }, 0);
      
      return totalSum + baseCost + upgradeSum;
    }, 0);
  };

  // --- 4. THE BOOT SEQUENCE ---
  // This runs once when the page first loads.
  
  const mainModule = {
    boot: function (containerId, factionFolder) {
      ccfbLog("🚀 Brain: Booting system...");
      C.state.dataBaseUrl = factionFolder;

      CCFB.require(["data/loaders"], function (loaders) {
        // First, load the universal rules (abilities, etc)
        loaders.loadRules().then(function() {
          ccfbLog("✅ Rules Loaded.");

          // Second, load the default faction
          loaders.loadFaction(C.ui.fKey).then(function() {
            ccfbLog("✅ Default Faction Loaded.");

            // Third, grab the current value from the budget dropdown in the Skeleton
            const budgetSelector = document.getElementById("budget-selector");
            if (budgetSelector) {
              C.ui.limit = parseInt(budgetSelector.value);
            }

            // Finally, tell the app we are ready to show the screen
            C.state.loading = false;
            if (window.CCFB.refreshUI) {
              window.CCFB.refreshUI();
            }
          });
        });
      });
    }
  };

  return mainModule;
});
