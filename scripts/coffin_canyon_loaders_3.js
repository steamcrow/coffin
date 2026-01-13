CCFB.define("data/loaders", function (C) {
  return {
    loadRules: async function() {
      const url = "https://raw.githubusercontent.com/steamcrow/coffin/main/factions/rules.json?t=" + Date.now();
      try {
        const res = await fetch(url);
        if(res.ok) { C.state.rules = await res.json(); }
      } catch(e) { console.warn("Rules load failed."); }
      return true;
    },
    
    loadFaction: async function (fKey) {
      console.log("Attempting to load:", fKey);
      
      CCFB.require(["config/docTokens"], async function(cfg) {
        const entry = cfg.getFaction(fKey);
        if (!entry) {
            console.error("No config entry found for:", fKey);
            return;
        }

        // DIRECT PATH TO FACTIONS FOLDER
        const url = "https://raw.githubusercontent.com/steamcrow/coffin/main/factions/" + entry.url + "?t=" + Date.now();
        
        try {
          const res = await fetch(url);
          if (!res.ok) throw new Error("File not found on GitHub");
          
          const data = await res.json();
          C.state.factions[fKey] = data;
          C.ui.fKey = fKey; // Set the active faction
          
          console.log("Successfully loaded JSON for:", fKey);

          // Tell the Painter to draw the new data
          if (window.CCFB.refreshUI) {
            window.CCFB.refreshUI();
          }
        } catch (err) { 
          console.error("JSON Fetch Failed:", err); 
        }
      });
    }
  };
});