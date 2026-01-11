CCFB.define("data/loaders", function (C) {
  return {
    // 1. THIS IS THE MISSING PIECE
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
      return true; // Tells the brain "I'm done trying"
    },

    // 2. THIS LOADS THE INDIVIDUAL FACTIONS
    loadFaction: async function (fKey) {
      // Find the faction entry in the config to get the filename
      var factionEntry = C.config.getFaction(fKey);
      var filename = factionEntry ? factionEntry.url : fKey + ".json";
      
      const url = C.state.dataBaseUrl + filename;
      
      try {
        const response = await fetch(url);
        if (!response.ok) throw new Error("Faction not found");
        const data = await response.json();
        C.state.currentFaction = data;
        if (window.CCFB.refreshUI) window.CCFB.refreshUI();
      } catch (err) {
        console.error("Fetch Error:", err);
      }
    }
  };
});
