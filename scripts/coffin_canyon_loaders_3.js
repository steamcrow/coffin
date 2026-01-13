CCFB.define("data/loaders", function (C) {
  return {
    loadRules: async function() {
      const url = C.state.dataBaseUrl + "rules.json?t=" + Date.now();
      try {
        const res = await fetch(url);
        if(res.ok) { 
          C.state.rules = await res.json(); 
          console.log("📜 Rules loaded successfully.");
        }
      } catch(e) { console.warn("Rules load failed."); }
      return true;
    },
    
    loadFaction: async function (fKey) {
      console.log(`📡 Attempting to fetch faction: ${fKey}`);
      
      CCFB.require(["config/docTokens"], async function(cfg) {
        const entry = cfg.getFaction(fKey);
        // Ensure we are hitting the /factions/ folder
        const fileName = entry ? entry.url : fKey + ".json";
        const url = `https://raw.githubusercontent.com/steamcrow/coffin/main/factions/${fileName}?t=${Date.now()}`;
        
        try {
          const res = await fetch(url);
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          
          const data = await res.json();
          C.state.factions[fKey] = data;
          console.log(`✅ ${fKey} data injected into state.`);
          
          if (window.CCFB.refreshUI) {
            window.CCFB.refreshUI();
          }
        } catch (err) { 
          console.error("❌ Faction JSON load failed:", err); 
        }
      });
    }
  };
});