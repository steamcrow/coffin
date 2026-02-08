/* File: rules/apps/canyon_map/cc_canyon_map_app.js
   Coffin Canyon — Canyon Map (read-only v1) — ODOO CSP-SAFE + MAGNIFIER LENS + SCROLLER KNOB

   What this adds:
   - Fixed center rectangular "lens" (inset Leaflet map) at higher zoom
   - Distorted/glass-like lens edge via SVG filter
   - Vertical scroll knob that pans the map like paper under the lens
   - Zoom disabled (lens provides magnification)

   Mounts into: #cc-app-root[data-cc-app="canyon_map"]
*/

(function () {
  const APP_ID = "canyon_map";

  const DEFAULTS = {
    title: "Coffin Canyon — Canyon Map",

    // ✅ Your repo structure
    mapUrl: "https://raw.githubusercontent.com/steamcrow/coffin/main/rules/apps/canyon_map/data/canyon_map.json",
    stateUrl: "https://raw.githubusercontent.com/steamcrow/coffin/main/rules/apps/canyon_map/data/canyon_state.json",
    appCssUrl: "https://raw.githubusercontent.com/steamcrow/coffin/main/rules/apps/canyon_map/cc_canyon_map.css",

    leafletCssUrl: "https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/leaflet.css",
    leafletJsUrl: "https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/leaflet.js",

    // Lens behavior
    lensEnabled: true,
    lensZoomOffset: 2, // 1=2x-ish, 2=4x-ish (Leaflet zoom steps are exponential)
    lensWidthPx: 520,  // fixed lens size (desktop). CSS makes it responsive on small screens.
    lensHeightPx: 360,

    // Pan constraints
    lockHorizontalPan: true, // "paper scroll" vertical only
    allowMapDrag: true,      // drag map in addition to knob

    // Region coloring
    factionColors: {
      monster_rangers: "#4caf50",
      monsterologists: "#ff9800",
      monsters: "#9c27b0",
      liberty_corps: "#03a9f4",
      neutral: "#9e9e9e"
    },
    statusStyles: {
      controlled: { fillOpacity: 0.35 },
      contested: { fillOpacity: 0.18, dashArray: "6 6" },
      neutral: { fillOpacity: 0.12 }
    }
  };

  // ---------------------------
  // Utils
  // ---------------------------
  function el(tag, attrs = {}, children = []) {
    const n = document.createElement(tag);
    Object.entries(attrs).forEach(([k, v]) => {
      if (k === "class") n.className = v;
      else if (k === "style") n.setAttribute("style", v);
      else if (k.startsWith("on") && typeof v === "function") n.addEventListener(k.slice(2), v);
      else n.setAttr
