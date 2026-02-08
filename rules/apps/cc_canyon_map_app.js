/* File: apps/cc_canyon_map_app.js
   Coffin Canyon — Canyon Map (read-only v1)
   Mounts into: #cc-app-root[data-cc-app="canyon_map"]
*/

(function () {
  const APP_ID = "canyon_map";

  const DEFAULTS = {
    title: "Coffin Canyon — Canyon Map",

    // Data (you will create these files)
    mapUrl: "https://raw.githubusercontent.com/steamcrow/coffin/main/data/canyon_map.json",
    stateUrl: "https://raw.githubusercontent.com/steamcrow/coffin/main/data/canyon_state.json",

    leafletCssUrl: "https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/leaflet.css",
    leafletJsUrl: "https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/leaflet.js",

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

  function el(tag, attrs = {}, children = []) {
    const n = document.createElement(tag);
    Object.entries(attrs).forEach(([k, v]) => {
      if (k === "class") n.className = v;
      else if (k === "style") n.setAttribute("style", v);
      else if (k.startsWith("on") && typeof v === "function") n.addEventListener(k.slice(2), v);
      else n.setAttribute(k, v);
    });
    children.forEach((c) => n.appendChild(typeof c === "string" ? document.createTextNode(c) : c));
    return n;
  }

  async function fetchJson(url) {
    const res = await fetch(url + (url.includes("?") ? "&" : "?") + "t=" + Date.now());
    if (!res.ok) throw new Error(`Fetch failed (${res.status}) for ${url}`);
    return await res.json();
  }

  async function loadCssOnce(href) {
    const exists = [...document.querySelectorAll("link[rel='stylesheet']")].some((l) => l.href === href);
    if (exists) return;
    document.head.appendChild(el("link", { rel: "stylesheet", href }));
  }

  async function loadScriptOnce(src) {
    const exists = [...document.querySelectorAll("script")].some((s) => s.src === src);
    if (exists) return;
    await new Promise((resolve, reject) => {
      const s = el("script", { src });
      s.onload = resolve;
      s.onerror = () => reject(new Error("Script failed: " + src));
      document.head.appendChild(s);
    });
  }

  async function ensureLeaflet(opts) {
    await loadCssOnce(opts.leafletCssUrl);
    await loadScriptOnce(opts.leafletJsUrl);
    if (!window.L) throw new Error("Leaflet did not load (window.L missing).");
  }

  function clamp(n, min, max) {
    return Math.max(min, Math.min(max, n));
  }

  function normalizePoints(points, coordSystem) {
    if (!Array.isArray(points)) return [];
    if (coordSystem !== "image_px" && coordSystem !== "map_units") return [];
    return points
      .filter((p) => p && typeof p.x === "number" && typeof p.y === "number")
      .map((p) => [p.y, p.x]); // Leaflet latlng as [y,x]
  }

  function validateMapDoc(doc) {
    if (!doc || doc.schema_id !== "cc_canyon_map") return "schema_id must be cc_canyon_map";
    if (!doc.map || !doc.map.background || !doc.map.background.image_key) return "map.background.image_key missing";
    if (!doc.map.background.image_pixel_size) return "map.background.image_pixel_size missing";
    if (!Array.isArray(doc.regions)) return "regions must be array";
    return null;
  }

  function validateStateDoc(doc) {
    if (!doc || doc.schema_id !== "cc_canyon_state") return "schema_id must be cc_canyon_state";
    if (!doc.state_by_region || typeof doc.state_by_region !== "object") return "state_by_region missing";
    return null;
  }

  function buildRegionStyle(opts, regionId, stateByRegion) {
    const st = stateByRegion[regionId] || {};
    const controller = st.controller_faction_id || "neutral";
    const status = st.status || "neutral";

    const fillColor = opts.factionColors[controller] || opts.factionColors.neutral || "#999";
    const statusPatch = opts.statusStyles[status] || opts.statusStyles.neutral || {};

    return {
      color: "rgba(255,255,255,0.45)",
      weight: 2,
      fillColor,
      fillOpacity: 0.18,
      ...statusPatch
    };
  }

  function highlightLayer(layer) {
    try {
      layer.setStyle({ weight: 3, color: "rgba(255,255,255,0.85)" });
      layer.bringToFront();
    } catch (e) {}
  }

  function unhighlightLayer(layer, baseStyle) {
    try {
      layer.setStyle(baseStyle);
    } catch (e) {}
  }

  function buildUI(root, opts) {
    root.innerHTML = "";
    root.classList.add("cc-canyon-map");

    // Minimal CSS (inline) so you don’t have to add another file yet
    const style = el("style", {}, [`
      .cc-canyon-map{position:relative;min-height:900px;border:1px solid rgba(255,255,255,0.12);border-radius:12px;overflow:hidden;background:rgba(0,0,0,0.15)}
      .cc-cm-header{display:flex;justify-content:space-between;align-items:center;gap:12px;padding:10px 12px;border-bottom:1px solid rgba(255,255,255,0.10)}
      .cc-cm-title{font-weight:700;letter-spacing:.3px}
      .cc-cm-actions{display:flex;gap:8px}
      .cc-btn{appearance:none;border:1px solid rgba(255,255,255,0.18);background:rgba(0,0,0,0.35);color:inherit;padding:6px 10px;border-radius:10px;cursor:pointer}
      .cc-btn:hover{border-color:rgba(255,255,255,0.35)}
      .cc-btn-x{width:34px;height:34px;line-height:30px;font-size:18px;padding:0;border-radius:10px}
      .cc-cm-body{display:grid;grid-template-columns:1fr 360px;height:calc(100% - 52px);min-height:820px}
      .cc-cm-mapwrap{position:relative;min-height:820px}
      .cc-cm-map{position:absolute;inset:0}
      .cc-cm-drawer{border-left:1px solid rgba(255,255,255,0.10);background:rgba(0,0,0,0.35);display:flex;flex-direction:column}
      .cc-cm-drawer-head{display:flex;justify-content:space-between;align-items:center;padding:10px 12px;border-bottom:1px solid rgba(255,255,255,0.10)}
      .cc-cm-drawer-title{font-weight:700}
      .cc-cm-drawer-content{padding:12px;overflow:auto}
      .cc-block{padding:10px;border:1px solid rgba(255,255,255,0.10);border-radius:12px;background:rgba(0,0,0,0.25);margin-bottom:10px}
      .cc-h{font-weight:700;margin-bottom:6px}
      .cc-ul{margin:6px 0 0 18px}
      .cc-muted{opacity:.75}
      @media (max-width:980px){
        .cc-cm-body{grid-template-columns:1fr}
        .cc-cm-drawer{position:absolute;right:0;top:52px;bottom:0;width:min(92vw,420px);transform:translateX(105%);transition:transform 160ms ease;box-shadow:0 0 40px rgba(0,0,0,0.45)}
        .cc-cm-drawer.open{transform:translateX(0)}
      }
    `]);

    const header = el("div", { class: "cc-cm-header" }, [
      el("div", { class: "cc-cm-title" }, [opts.title]),
      el("div", { class: "cc-cm-actions" }, [
        el("button", { class: "cc-btn", type: "button", id: "cc-cm-reload" }, ["Reload"]),
        el("button", { class: "cc-btn", type: "button", id: "cc-cm-fit" }, ["Fit"])
      ])
    ]);

    const body = el("div", { class: "cc-cm-body" }, [
      el("div", { class: "cc-cm-mapwrap" }, [
        el("div", { id: "cc-cm-map", class: "cc-cm-map" })
      ]),
      el("div", { class: "cc-cm-drawer", id: "cc-cm-drawer" }, [
        el("div", { class: "cc-cm-drawer-head" }, [
          el("div", { class: "cc-cm-drawer-title", id: "cc-cm-drawer-title" }, ["Region"]),
          el("button", { class: "cc-btn cc-btn-x", type: "button", id: "cc-cm-close" }, ["×"])
        ]),
        el("div", { class: "cc-cm-drawer-content", id: "cc-cm-drawer-content" }, [
          el("div", { class: "cc-muted" }, ["Click a region to view details."])
        ])
      ])
    ]);

    root.appendChild(style);
    root.appendChild(header);
    root.appendChild(body);

    return {
      mapEl: root.querySelector("#cc-cm-map"),
      btnReload: root.querySelector("#cc-cm-reload"),
      btnFit: root.querySelector("#cc-cm-fit"),
      drawerEl: root.querySelector("#cc-cm-drawer"),
      drawerTitleEl: root.querySelector("#cc-cm-drawer-title"),
      drawerContentEl: root.querySelector("#cc-cm-drawer-content"),
      btnClose: root.querySelector("#cc-cm-close")
    };
  }

  function renderDrawer(ui, region, stateForRegion) {
    ui.drawerTitleEl.textContent = region?.name || "Region";

    const controller = stateForRegion?.controller_faction_id || "neutral";
    const status = stateForRegion?.status || "neutral";
    const weather = stateForRegion?.weather_tag || null;

    const blocks = [];

    if (region?.description) {
      blocks.push(el("div", { class: "cc-block" }, [region.description]));
    }

    blocks.push(
      el("div", { class: "cc-block" }, [
        el("div", { class: "cc-h" }, ["State"]),
        el("div", {}, [`Controller: ${controller}`]),
        el("div", {}, [`Status: ${status}`]),
        weather ? el("div", {}, [`Weather: ${weather}`]) : el("div", { class: "cc-muted" }, ["Weather: (none)"])
      ])
    );

    const resources = region?.resources || [];
    blocks.push(
      el("div", { class: "cc-block" }, [
        el("div", { class: "cc-h" }, ["Resources"]),
        resources.length ? el("ul", { class: "cc-ul" }, resources.map((r) => el("li", {}, [String(r)]))) : el("div", { class: "cc-muted" }, ["(none)"])
      ])
    );

    const encounters = region?.encounters || [];
    blocks.push(
      el("div", { class: "cc-block" }, [
        el("div", { class: "cc-h" }, ["Encounters"]),
        encounters.length ? el("ul", { class: "cc-ul" }, encounters.map((e) => el("li", {}, [String(e)]))) : el("div", { class: "cc-muted" }, ["(none)"])
      ])
    );

    ui.drawerContentEl.innerHTML = "";
    blocks.forEach((b) => ui.drawerContentEl.appendChild(b));
  }

  function openDrawer(ui) {
    ui.drawerEl.classList.add("open");
  }

  function closeDrawer(ui) {
    ui.drawerEl.classList.remove("open");
  }

  async function mount(root, userOpts) {
    const opts = { ...DEFAULTS, ...(userOpts || {}) };
    await ensureLeaflet(opts);

    const ui = buildUI(root, opts);

    let mapDoc = null;
    let stateDoc = null;

    let leafletMap = null;
    let imageOverlay = null;

    const regionsById = {};
    const regionLayersById = {};
    let selectedRegionId = null;

    function fitToImage() {
      if (!leafletMap || !mapDoc) return;
      const px = mapDoc.map.background.image_pixel_size;
      const bounds = [[0, 0], [px.h, px.w]];
      leafletMap.fitBounds(bounds, { padding: [10, 10] });
    }

    function rebuildRegions() {
      // clear old layers
      Object.values(regionLayersById).forEach((layer) => {
        try { leafletMap.removeLayer(layer); } catch (e) {}
      });
      for (const k of Object.keys(regionLayersById)) delete regionLayersById[k];

      const stateByRegion = stateDoc?.state_by_region || {};
      const coordSystem = mapDoc.map.background.coord_system || "image_px";

      (mapDoc.regions || []).forEach((r) => {
        regionsById[r.region_id] = r;

        const latlngs = normalizePoints(r.shape?.points, coordSystem);
        if (!latlngs.length) return;

        const baseStyle = buildRegionStyle(opts, r.region_id, stateByRegion);
        const poly = window.L.polygon(latlngs, baseStyle);

        poly.on("mouseover", () => highlightLayer(poly));
        poly.on("mouseout", () => {
          const freshStyle = buildRegionStyle(opts, r.region_id, stateByRegion);
          unhighlightLayer(poly, freshStyle);
        });

        poly.on("click", () => {
          selectedRegionId = r.region_id;
          renderDrawer(ui, r, stateByRegion[r.region_id] || null);
          openDrawer(ui);
        });

        poly.addTo(leafletMap);
        regionLayersById[r.region_id] = poly;
      });
    }

    function applyStateStyles() {
      const stateByRegion = stateDoc?.state_by_region || {};
      Object.entries(regionLayersById).forEach(([regionId, layer]) => {
        const style = buildRegionStyle(opts, regionId, stateByRegion);
        try { layer.setStyle(style); } catch (e) {}
      });

      if (selectedRegionId && regionsById[selectedRegionId]) {
        renderDrawer(ui, regionsById[selectedRegionId], stateByRegion[selectedRegionId] || null);
      }
    }

    async function loadAll() {
      ui.drawerContentEl.innerHTML = "";
      ui.drawerContentEl.appendChild(el("div", { class: "cc-muted" }, ["Loading…"]));

      mapDoc = await fetchJson(opts.mapUrl);
      stateDoc = await fetchJson(opts.stateUrl);

      const mapErr = validateMapDoc(mapDoc);
      if (mapErr) throw new Error("Bad canyon_map.json: " + mapErr);

      const stateErr = validateStateDoc(stateDoc);
      if (stateErr) throw new Error("Bad canyon_state.json: " + stateErr);

      // rebuild map
      if (leafletMap) {
        try { leafletMap.remove(); } catch (e) {}
        leafletMap = null;
      }

      const px = mapDoc.map.background.image_pixel_size;
      const bounds = [[0, 0], [px.h, px.w]];

      leafletMap = window.L.map(ui.mapEl, {
        crs: window.L.CRS.Simple,
        minZoom: -3,
        maxZoom: 3,
        zoomSnap: 0.25,
        zoomDelta: 0.25,
        attributionControl: false
      });

      imageOverlay = window.L.imageOverlay(mapDoc.map.background.image_key, bounds, {
        opacity: clamp(mapDoc.map.background.opacity ?? 1.0, 0, 1)
      }).addTo(leafletMap);

      leafletMap.setMaxBounds(bounds);
      fitToImage();

      rebuildRegions();
      closeDrawer(ui);
      ui.drawerTitleEl.textContent = "Region";
      ui.drawerContentEl.innerHTML = "";
      ui.drawerContentEl.appendChild(el("div", { class: "cc-muted" }, ["Click a region to view details."]));
    }

    ui.btnReload.addEventListener("click", () => loadAll().catch((e) => console.error(e)));
    ui.btnFit.addEventListener("click", fitToImage);
    ui.btnClose.addEventListener("click", () => closeDrawer(ui));

    await loadAll();

    // API for other apps
    const api = {
      reload: async () => await loadAll(),
      fit: () => fitToImage(),
      setState: (newStateDoc) => {
        const err = validateStateDoc(newStateDoc);
        if (err) throw new Error("Bad state doc: " + err);
        stateDoc = newStateDoc;
        applyStateStyles();
      },
      setRegionState: (regionId, patch) => {
        if (!stateDoc || !stateDoc.state_by_region) return;
        stateDoc.state_by_region[regionId] = { ...(stateDoc.state_by_region[regionId] || {}), ...(patch || {}) };
        applyStateStyles();
      },
      drawerOpenRegion: (regionId) => {
        const r = regionsById[regionId];
        if (!r) return;
        selectedRegionId = regionId;
        renderDrawer(ui, r, stateDoc?.state_by_region?.[regionId] || null);
        openDrawer(ui);
      },
      drawerClose: () => closeDrawer(ui),
      getMapDoc: () => mapDoc,
      getStateDoc: () => stateDoc
    };

    root._ccMapApi = api;
    return api;
  }

  // Auto-mount: looks for #cc-app-root with data-cc-app="canyon_map"
  async function autoMount() {
    const root = document.getElementById("cc-app-root");
    if (!root) return;
    const appId = root.getAttribute("data-cc-app");
    if (appId !== APP_ID) return;

    try {
      console.log("🗺️ CC Canyon Map: mounting…");
      await mount(root, {});
      console.log("✅ CC Canyon Map: mounted");
    } catch (e) {
      console.error("❌ CC Canyon Map mount failed:", e);
      root.innerHTML = "<div style='padding:12px;opacity:.85'>❌ Canyon Map failed to load. Check console.</div>";
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", autoMount);
  } else {
    autoMount();
  }
})();
