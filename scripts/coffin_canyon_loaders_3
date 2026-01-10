CCFB.define("data/loaders", function (C) {
  return {
    loadRules: async function() {
      const url = C.state.dataBaseUrl + "rules.json";
      try {
        const res = await fetch(url);
        if(res.ok) C.state.rules = await res.json();
      } catch(e) { console.warn("Rules not found."); }
    },
    loadFaction: async function (fKey) {
      const url = C.state.dataBaseUrl + fKey + ".json";
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
