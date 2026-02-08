/* File: apps/canyon_map/cc_canyon_map_app.js
   Coffin Canyon — Canyon Map (read-only v1)
   - Leaflet static-image map (CRS.Simple)
   - Region polygons from JSON points
   - Click region => drawer info
   - Separate canyon_state.json recolors regions
*/

(function () {
  const DEFAULTS = {
    // REQUIRED by you at runtime:
    // mapUrl: "https://.../data/canyon_map.json",
    // stateUrl: "https://.../data/canyon_state.json",

    title: "Coffin Canyon — Canyon Map",
    leafletCssUrl: "https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/leaflet.css",
    leafletJsUrl: "https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/leaflet.js",

    // Visual mapping from “controller_faction_id” -> color
    factionColors: {
      monster_rangers: "#4caf50",
      monsterologists: "#ff9800",
      monsters: "#9c27b0",
      liberty_corps: "#03a9f4",
      neutral: "#9e9e9e"
    },

    // Status styles (optional)
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

  function safeJsonParse(str, fallback = null) {
    try {
      return JSON.parse(str);
    } catch (e) {
      return fallback;
    }
  }

  async function fetchJson(url) {
    const res = await fetch(url + (url.includes("?") ? "&" : "?") + "t=" + Date.now());
    if (!res.ok) throw new Error(`Fetch failed (${res.status}) for ${url}`);
    return await res.json();
  }

  async function loadCssOnce(href) {
    if ([...document.querySelectorAll("link[rel='stylesheet']")].some((l) => l.href === href)) return;
    const link = el("link", { rel: "stylesheet", href });
    document.head.appendChild(link);
  }

  async function loadScriptOnce(src) {
    if ([...document.querySelectorAll("script")].some((s) => s.src === src)) return;
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
    // We store points as {x,y} in either:
    // - "image_px": x,y in pixels of the original background image
    // - "map_units": already in Leaflet CRS.Simple units (we’ll use pixels as units anyway)
    // Leaflet CRS.Simple expects [y, x] (lat,lng) style.
    if (!Array.isArray(points)) return [];
    if (coordSystem !== "image_px" && coordSystem !== "map_units") return [];

    return points
      .filter((p) => p && typeof p.x === "number" && typeof p.y === "number")
      .map((p) => [p.y, p.x]);
  }

  function buildLayout(root, opts) {
    root.innerHTML = "";
    root.classList.add("cc-canyon-map");

    const header = el("div", { class: "cc-cm-header" }, [
      el("div", { class: "cc-cm-title" }, [opts.title]),
      el("div", { class: "cc-cm-actions" }, [
        el("button", { class: "cc-btn", type: "button", id: "cc-cm-reload" }, ["Reload"]),
        el("button", { class: "cc-btn", type: "button", id: "cc-cm-fit" }, ["Fit"])
      ])
    ]);

    const body = el("div", { class: "cc-cm-body" }, [
      el("div", { class: "cc-cm-mapwrap" }, [el("div", { id: "cc-cm-map", class: "cc-cm-map" })]),
      el("div", { class: "cc-cm-drawer", id: "cc-cm-drawer" }, [
        el("div", { class: "cc-cm-drawer-head" }, [
          el("div", { class: "cc-cm-drawer-title", id: "cc-cm-drawer-title" }, ["Region"]),
          el("button", {
            class: "cc-btn cc-btn-x",
            type: "button",
            onClick: () => root._ccApi && root._ccApi.drawerClose()
          }, ["×"])
        ]),
        el("div", { class: "cc-cm-drawer-content", id: "cc-cm-drawer-content" }, [
          el("div", { class: "cc-muted" }, ["Click a region to view details."])
        ])
      ])
    ]);

    root.appendChild(header);
    root.appendChild(body);

    return {
      mapEl: root.querySelector("#cc-cm-map"),
      btnReload: root.querySelector("#cc-cm-reload"),
      btnFit: root.querySelector("#cc-cm-fit"),
      drawerEl: root.querySelector("#cc-cm-drawer"),
      drawerTitleEl: root.querySelector("#cc-cm-drawer-title"),
      drawerContentEl: root.querySelector("#cc-cm-drawer-content")
    };
  }

  function renderDrawer(ui, region, stateForRegion) {
    ui.drawerTitleEl.textContent = region?.name || "Region";

    const controller = stateForRegion?.controller_faction_id || "neutral";
    const status = stateForRegion?.status || "neutral";
    const weather = stateForRegion?.weather_tag || null;

    const lines = [];
    if (region?.description) lines.push(el("div", { class: "cc-block" }, [region.description]));

    // State block
    lines.push(
      el("div", { class: "cc-block" }, [
        el("div", { class: "cc-h" }, ["State"]),
        el("div", {}, [`Controller: ${controller}`]),
        el("div", {}, [`Status: ${status}`]),
        weather ? el("div", {}, [`Weather: ${weather}`]) : el("div", { class: "cc-muted" }, ["Weather: (none)"])
      ])
    );

    // Resources
    const resources = region?.resources || [];
    lines.push(
      el("div", { class: "cc-block" }, [
        el("div", { class: "cc-h" }, ["Resources"]),
        resources.length
          ? el("ul", { class: "cc-ul" }, resources.map((r) => el("li", {}, [String(r)])))
          : el("div", { class: "cc-muted" }, ["(none)"])
      ])
    );

    // Encounters
    const encounters = region?.encounters || [];
    lines.push(
      el("div", { class: "cc-block" }, [
        el("div", { class: "cc-h" }, ["Encounters"]),
        encounters.length
          ? el("ul", { class: "cc-ul" }, encounters.map((e) => el("li", {}, [String(e)])))
          : el("div", { class: "cc-muted" }, ["(none)"])
      ])
    );

    ui.drawerContentEl.innerHTML = "";
    lines.forEach((n) => ui.drawerContentEl.appendChild(n));
  }

  function openDrawer(ui) {
    ui.drawerEl.classList.add("open");
  }

  function closeDrawer(ui) {
    ui.drawerEl.classList.remove("open");
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
      if (!layer._bringToFrontLocked) layer.bringToFront();
    } catch (e) {}
  }

  function unhighlightLayer(layer, baseStyle) {
    try {
      layer.setStyle(baseStyle);
    } catch (e) {}
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

  async function mount(root, userOpts) {
    const opts = { ...DEFAULTS, ...(userOpts || {}) };
    if (!opts.mapUrl) throw new Error("mount() requires opts.mapUrl");
    if (!opts.stateUrl) throw new Error("mount() requires opts.stateUrl");

    await ensureLeaflet(opts);

    const ui = buildLayout(root, opts);

    let mapDoc = null;
    let stateDoc = null;

    let leafletMap = null;
    let imageOverlay = null;
    const regionLayersById = {};
    const regionsById = {};
    let selectedRegionId = null;

    function rebuildRegions() {
      Object.values(regionLayersById).forEach((layer) => {
        try {
          leafletMap.removeLayer(layer);
        } catch (e) {}
      });
      for (const k of Object.keys(regionLayersById)) delete regionLayersById[k];

      const stateByRegion = stateDoc?.state_by_region || {};

      (mapDoc.regions || []).forEach((r) => {
        regionsById[r.region_id] = r;

        const latlngs = normalizePoints(r.shape?.points, mapDoc.map?.background?.coord_system || "image_px");
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
          const st = stateByRegion[r.region_id] || null;
          renderDrawer(ui, r, st);
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
        try {
          layer.setStyle(style);
        } catch (e) {}
      });

      // If drawer open, refresh it too
      if (selectedRegionId && regionsById[selectedRegionId]) {
        renderDrawer(ui, regionsById[selectedRegionId], stateByRegion[selectedRegionId] || null);
      }
    }

    function fitToImage() {
      if (!leafletMap || !mapDoc) return;
      const px = mapDoc.map.background.image_pixel_size;
      const bounds = [[0, 0], [px.h, px.w]];
      leafletMap.fitBounds(bounds, { padding: [10, 10] });
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

      // Create Leaflet map
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
        wheelDebounceTime: 30,
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

    await loadAll();

    // Exposed API for other apps (scenario builder, etc.)
    const api = {
      reload: async () => await loadAll(),
      fit: () => fitToImage(),

      // Replace ONLY state (fast)
      setState: (newStateDoc) => {
        const err = validateStateDoc(newStateDoc);
        if (err) throw new Error("Bad state doc: " + err);
        stateDoc = newStateDoc;
        applyStateStyles();
      },

      // Convenience: set a single region state
      setRegionState: (regionId, patch) => {
        if (!stateDoc || !stateDoc.state_by_region) return;
        stateDoc.state_by_region[regionId] = { ...(stateDoc.state_by_region[regionId] || {}), ...(patch || {}) };
        applyStateStyles();
      },

      drawerClose: () => closeDrawer(ui),
      drawerOpenRegion: (regionId) => {
        const r = regionsById[regionId];
        if (!r) return;
        selectedRegionId = regionId;
        renderDrawer(ui, r, stateDoc?.state_by_region?.[regionId] || null);
        openDrawer(ui);
      },

      // Read access
      getMapDoc: () => mapDoc,
      getStateDoc: () => stateDoc
    };

    root._ccApi = api;
    return api;
  }

  // Global export (so other apps can embed it)
  window.CC_CanyonMap = { mount };
})();
