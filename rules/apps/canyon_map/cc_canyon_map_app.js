/* File: rules/apps/canyon_map/cc_canyon_map_app.js
   Coffin Canyon — Canyon Map (read-only v1) — ODOO CSP-SAFE
   - Loads Leaflet (CSS+JS) via fetch + <style> + Blob <script> (no external <script src>)
   - Loads app CSS via fetch + <style>
   - Leaflet static-image map (CRS.Simple)
   - Region polygons from JSON points
   - Click region => drawer info
   - Separate canyon_state.json recolors regions
   - Auto-mounts when #cc-app-root[data-cc-app="canyon_map"]
*/

(function () {
  const APP_ID = "canyon_map";

  // If you move folders later, only change these defaults.
  const DEFAULTS = {
    title: "Coffin Canyon — Canyon Map",

    // ✅ Your repo structure (matches your screenshot)
    mapUrl: "https://raw.githubusercontent.com/steamcrow/coffin/main/rules/apps/canyon_map/data/canyon_map.json",
    stateUrl: "https://raw.githubusercontent.com/steamcrow/coffin/main/rules/apps/canyon_map/data/canyon_state.json",
    appCssUrl: "https://raw.githubusercontent.com/steamcrow/coffin/main/rules/apps/canyon_map/cc_canyon_map.css",

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

  function clamp(n, min, max) {
    return Math.max(min, Math.min(max, n));
  }

  async function fetchText(url) {
    const res = await fetch(url + (url.includes("?") ? "&" : "?") + "t=" + Date.now());
    if (!res.ok) throw new Error(`Fetch failed (${res.status}) for ${url}`);
    return await res.text();
  }

  async function fetchJson(url) {
    const res = await fetch(url + (url.includes("?") ? "&" : "?") + "t=" + Date.now());
    if (!res.ok) throw new Error(`Fetch failed (${res.status}) for ${url}`);
    return await res.json();
  }

  // ---------------------------
  // Odoo CSP-safe loaders
  // ---------------------------
  const _loaded = {
    cssKeys: new Set(),
    jsKeys: new Set()
  };

  function _keyFor(urlOrKey) {
    return String(urlOrKey || "").trim();
  }

  async function loadCssTextOnce(url, keyOverride = null) {
    const key = _keyFor(keyOverride || url);
    if (_loaded.cssKeys.has(key)) return;

    const css = await fetchText(url);
    const style = document.createElement("style");
    style.setAttribute("data-cc-style", key);
    style.textContent = css;
    document.head.appendChild(style);

    _loaded.cssKeys.add(key);
  }

  async function loadScriptViaBlobOnce(url, keyOverride = null) {
    const key = _keyFor(keyOverride || url);
    if (_loaded.jsKeys.has(key)) return;

    const code = await fetchText(url);
    const blob = new Blob([code], { type: "text/javascript" });
    const blobUrl = URL.createObjectURL(blob);

    await new Promise((resolve, reject) => {
      const s = document.createElement("script");
      s.src = blobUrl;
      s.onload = () => {
        URL.revokeObjectURL(blobUrl);
        resolve();
      };
      s.onerror = () => {
        URL.revokeObjectURL(blobUrl);
        reject(new Error("Script failed: " + url));
      };
      document.head.appendChild(s);
    });

    _loaded.jsKeys.add(key);
  }

  async function ensureLeaflet(opts) {
    // Leaflet CSS + JS via CSP-safe loading
    await loadCssTextOnce(opts.leafletCssUrl, "leaflet_css");
    await loadScriptViaBlobOnce(opts.leafletJsUrl, "leaflet_js");
    if (!window.L) throw new Error("Leaflet did not load (window.L missing).");
  }

  // ---------------------------
  // Map logic
  // ---------------------------
  function normalizePoints(points, coordSystem) {
    // Stored points: {x,y} in pixels of background image (image_px)
    // Leaflet CRS.Simple uses [y,x]
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
          el(
            "button",
            {
              class: "cc-btn cc-btn-x",
              type: "button",
              onClick: () => root._ccApi && root._ccApi.drawerClose()
            },
            ["×"]
          )
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

    lines.push(
      el("div", { class: "cc-block" }, [
        el("div", { class: "cc-h" }, ["State"]),
        el("div", {}, [`Controller: ${controller}`]),
        el("div", {}, [`Status: ${status}`]),
        weather ? el("div", {}, [`Weather: ${weather}`]) : el("div", { class: "cc-muted" }, ["Weather: (none)"])
      ])
    );

    const resources = region?.resources || [];
    lines.push(
      el("div", { class: "cc-block" }, [
        el("div", { class: "cc-h" }, ["Resources"]),
        resources.length
          ? el("ul", { class: "cc-ul" }, resources.map((r) => el("li", {}, [String(r)])))
          : el("div", { class: "cc-muted" }, ["(none)"])
      ])
    );

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
      layer.bringToFront();
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

    // ✅ Load app CSS and Leaflet in CSP-safe way
    if (opts.appCssUrl) await loadCssTextOnce(opts.appCssUrl, "cc_canyon_map_css");
    await ensureLeaflet(opts);

    const ui = buildLayout(root, opts);

    let mapDoc = null;
    let stateDoc = null;

    let leafletMap = null;
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

      if (leafletMap) {
        try {
          leafletMap.remove();
        } catch (e) {}
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

      window.L.imageOverlay(mapDoc.map.background.image_key, bounds, {
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

      drawerClose: () => closeDrawer(ui),
      drawerOpenRegion: (regionId) => {
        const r = regionsById[regionId];
        if (!r) return;
        selectedRegionId = regionId;
        renderDrawer(ui, r, stateDoc?.state_by_region?.[regionId] || null);
        openDrawer(ui);
      },

      getMapDoc: () => mapDoc,
      getStateDoc: () => stateDoc
    };

    root._ccApi = api;
    return api;
  }

  // Auto-mount when embedded the same way as your other apps
  async function autoMountIfPresent() {
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
      root.innerHTML =
        "<div style='padding:12px;opacity:.85'>❌ Canyon Map failed to load. Check console.</div>";
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", autoMountIfPresent);
  } else {
    autoMountIfPresent();
  }

  // Global export (for other apps to embed programmatically)
  window.CC_CanyonMap = { mount };
})();
