const api = await window.CC_CanyonMap.mount(root, {
  ctx,

  // Use the exact working RAW urls (refs form)
  mapUrl: "https://raw.githubusercontent.com/steamcrow/coffin/refs/heads/main/rules/apps/canyon_map/data/canyon_map.json",
  stateUrl: "https://raw.githubusercontent.com/steamcrow/coffin/refs/heads/main/rules/apps/canyon_map/data/canyon_state.json",
  appCssUrl: "https://raw.githubusercontent.com/steamcrow/coffin/refs/heads/main/rules/apps/canyon_map/cc_canyon_map.css",

  // Leaflet in your repo (keep as-is)
  leafletCssUrl: "https://raw.githubusercontent.com/steamcrow/coffin/refs/heads/main/rules/vendor/leaflet/leaflet.css",
  leafletJsUrl: "https://raw.githubusercontent.com/steamcrow/coffin/refs/heads/main/rules/vendor/leaflet/leaflet.js"
});
return api;
