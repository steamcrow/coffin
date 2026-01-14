CCFB.define("data/loaders", function (C) {
  return {
    loadRules: async function() {
      const url = "https://raw.githubusercontent.com/steamcrow/coffin/main/factions/rules.json?t=" + Date.now();
      try {
        const res = await fetch(url);
        if(res.ok) { 
            C.state.rules = await res.json(); 
            console.log("📜 Rules loaded.");
        }
      } catch(e) { console.warn("Rules load failed."); }
      return true;
    },
    
    loadFaction: async function (fKey) {
      console.log("📡 Requesting Faction:", fKey);
      
      CCFB.require(["config/docTokens"], async function(cfg) {
        const entry = cfg.getFaction(fKey);
        if (!entry) {
            console.error("❌ No config entry for:", fKey);
            return;
        }

        const url = "https://raw.githubusercontent.com/steamcrow/coffin/main/factions/" + entry.url + "?t=" + Date.now();
        
        try {
          const res = await fetch(url);
          if (!res.ok) throw new Error(`HTTP ${res.status} - Not Found`);
          
          const data = await res.json();
          C.state.factions[fKey] = data;
          C.ui.fKey = fKey; 
          
          console.log("✅ Successfully loaded JSON for:", fKey);

          // Force the UI to refresh with the new data
          if (typeof window.CCFB.refreshUI === "function") {
            window.CCFB.refreshUI();
          }
        } catch (err) { 
          console.error("❌ JSON Fetch Failed:", err); 
        }
      });
    }
  };
});