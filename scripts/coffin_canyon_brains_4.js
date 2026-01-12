CCFB.define("main", function (C) {
  // 1. Initialize Global UI State
  C.ui = C.ui || {
    fKey: "",
    limit: 0,
    mode: "grid",
    roster: [],
    sId: null
  };

  // 2. Helper for Painter: Find unit data
  C.getUnit = function(fKey, unitName) {
    const faction = C.state?.factions?.[fKey];
    return faction?.units?.find(u => u.name === unitName);
  };

  // 3. Helper for Painter: Calculate Roster Points
  C.calculateTotal = function() {
    return (C.ui.roster || []).reduce((sum, item) => {
      const unit = C.getUnit(item.fKey, item.uN);
      return sum + (unit ? (unit.cost || 0) : 0);
    }, 0);
  };

  // 4. Handle Faction Selection
  window.CCFB.handleFactionChange = function(newKey) {
    C.ui.fKey = newKey;
    CCFB.require(["data/loaders"], function(loaders) {
      loaders.loadFaction(newKey);
    });
  };

  // 5. Create the module object to return
  const mainModule = {
    boot: function (containerId, factionFolder) {
      ccfbLog("🚀 Brain: Booting...");
      C.state.dataBaseUrl = factionFolder;

      CCFB.require(["data/loaders"], function (loaders) {
        loaders.loadRules().then(function() {
          ccfbLog("✅ Rules Loaded. Initializing UI...");
          
          // Since File 5 (Skeleton) is an IIFE, it's already listening.
          // We just need to trigger the initial paint.
          C.state.loading = false;
          if (window.CCFB.refreshUI) window.CCFB.refreshUI();
        });
      });
    }
  };

  return mainModule;
});