CCFB.define("data/loaders", function (C) {
  return {
    // 1. Load the core rules
    loadRules: async function() {
      const url = C.state.dataBaseUrl + "rules.json";
      console.log("Fetching rules from:", url);
      try {
        const res = await fetch(url);
        if(res.ok) {
          C.state.rules = await res.json();
        }
      } catch(e) { 
        console.warn("Rules file not found or corrupted."); 
      }
      return true;
    },

    // 2. Load the specific faction JSON
    loadFaction: async function (fKey) {
      // We reach into the docTokens module we defined in Odoo
      CCFB.require(["config/docTokens"], async function(cfg) {
        const factionEntry = cfg.getFaction(fKey);
        const filename = factionEntry ? factionEntry.url : fKey + ".json";
        const url = C.state.dataBaseUrl + filename;
        
        try {
          const response = await fetch(url);
          if (!response.ok) throw new Error("Faction not found");
          const data = await response.json();
          
          // Save to global state so Painter can see it
          C.state.factions = C.state.factions || {};
          C.state.factions[fKey] = data;
          
          if (window.CCFB.refreshUI) window.CCFB.refreshUI();
        } catch (err) {
          console.error("Fetch Error:", err);
        }
      });
    }
  };
});