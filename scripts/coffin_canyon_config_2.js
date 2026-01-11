<div id="ccfb-2-config"></div>
<script>
/* =========================================================
   CCFB 2 — Config (Document tokens, RELATIVE PATHS)
   ========================================================= */
(function () {
  var CCFB = window.CCFB;
  if (!CCFB || !CCFB.define) return;

  // Initialize state global if not already present
  CCFB.state = CCFB.state || { factions: {} };

  CCFB.define("config/docTokens", function () {
    var rawFactions = [
      { key: "monster_rangers", label: "Monster Rangers", url: "faction_monster_rangers-v5.json" },
      { key: "shine_riders",    label: "Shine Riders",    url: "faction_shine_riders-v2.json" },
      { key: "monsterology",    label: "Monsterology",    url: "faction_monsterology-v2.json" },
      { key: "monsters",        label: "Monsters",        url: "faction_monsters-v2.json" },
      { key: "liberty_corps",   label: "Liberty Corps",   url: "faction_liberty_corps-v2.json" }
    ];

    // Auto-sort factions alphabetically by label for the UI
    rawFactions.sort(function(a, b) {
      return a.label.localeCompare(b.label);
    });

    return {
      rulesUrl: "rules.json",
      factions: rawFactions,
      // Helper to quickly find faction data by key
      getFaction: function(key) {
        return rawFactions.find(function(f) { return f.key === key; });
      }
    };
  });
})();
</script>
