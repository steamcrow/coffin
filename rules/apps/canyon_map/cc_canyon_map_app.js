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
      else n.setAttribute(k, v);
    });
    children.forEach((c) => n.appendChild(typeof c === "string" ? document.createTextNode(c) : c));
    return n;
  }

  function clamp(n, min, max) {
    return Math.max(min, Math.min(max, n));
  }

  function rafThrottle(fn) {
    let pending = false;
    let lastArgs = null;
    return function (...args) {
      lastArgs = args;
      if (pending) return;
      pending = true;
      requestAnimationFrame(() => {
        pending = false;
        fn(...lastArgs);
      });
    };
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
  const _loaded = { css: new Set(), js: new Set() };

  async function loadCssTextOnce(url, key) {
    const k = key || url;
    if (_loaded.css.has(k)) return;
    const css = await fetchText(url);
    const style = document.createElement("style");
    style.setAttribute("data-cc-style", k);
    style.textContent = css;
    document.head.appendChild(style);
    _loaded.css.add(k);
  }

  async function loadScriptViaBlobOnce(url, key) {
    const k = key || url;
    if (_loaded.js.has(k)) return;

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

    _loaded.js.add(k);
  }

  async function ensureLeaflet(opts) {
    await loadCssTextOnce(opts.leafletCssUrl, "leaflet_css");
    await loadScriptViaBlobOnce(opts.leafletJsUrl, "leaflet_js");
    if (!window.L) throw new Error("Leaflet did not load (window.L missing).");
  }

  // ---------------------------
  // Data validation + geometry
  // ---------------------------
  function normalizePoints(points, coordSystem) {
    if (!Array.isArray(points)) return [];
    if (coordSystem !== "image_px" && coordSystem !== "map_units") return [];
    return points
      .filter((p) => p && typeof p.x === "number" && typeof p.y === "number")
      .map((p) => [p.y, p.x]); // Leaflet latlng [y,x]
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

  // ---------------------------
  // UI
  // ---------------------------
  function buildLayout(root, opts) {
    root.innerHTML = "";
    root.classList.add("cc-canyon-map");

    // Inline SVG filter (for lens distortion)
    const svgFilter = el("svg", {
      class: "cc-lens-svg",
      width: "0",
      height: "0",
      "aria-hidden": "true",
      focusable: "false"
    }, [
      el("filter", { id: "ccLensWarp", x: "-20%", y: "-20%", width: "140%", height: "140%" }, [
        el("feTurbulence", {
          type: "fractalNoise",
          baseFrequency: "0.012",
          numOctaves: "2",
          seed: "8",
          result: "noise"
        }),
        el("feDisplacementMap", {
          in: "SourceGraphic",
          in2: "noise",
          scale: "14",
          xChannelSelector: "R",
          yChannelSelector: "G"
        })
      ])
    ]);

    const header = el("div", { class: "cc-cm-header" }, [
      el("div", { class: "cc-cm-title" }, [opts.title]),
      el("div", { class: "cc-cm-actions" }, [
        el("button", { class: "cc-btn", type: "button", id: "cc-cm-reload" }, ["Reload"]),
        el("button", { class: "cc-btn", type: "button", id: "cc-cm-fit" }, ["Fit"])
      ])
    ]);

    const mapEl = el("div", { id: "cc-cm-map", class: "cc-cm-map" });

    // Lens overlay
    const lens = el("div", { class: "cc-lens", id: "cc-lens" }, [
      el("div", { class: "cc-lens-rim" }),
      el("div", { class: "cc-lens-inner", id: "cc-lens-inner" }, [
        el("div", { class: "cc-lens-map", id: "cc-lens-map" })
      ]),
      el("div", { class: "cc-lens-glare" })
    ]);

    // Vertical scroller
    const scroller = el("div", { class: "cc-scroll", id: "cc-scroll" }, [
      el("div", { class: "cc-scroll-track" }),
      el("div", { class: "cc-scroll-knob", id: "cc-scroll-knob" })
    ]);

    const body = el("div", { class: "cc-cm-body cc-cm-body--lens" }, [
      el("div", { class: "cc-cm-mapwrap" }, [mapEl, lens, scroller]),
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

    root.appendChild(svgFilter);
    root.appendChild(header);
    root.appendChild(body);

    // Apply fixed lens dimensions (desktop) via inline style for convenience
    lens.style.setProperty("--lens-w", `${opts.lensWidthPx}px`);
    lens.style.setProperty("--lens-h", `${opts.lensHeightPx}px`);

    return {
      mapEl,
      lensEl: lens,
      lensMapEl: root.querySelector("#cc-lens-map"),
      btnReload: root.querySelector("#cc-cm-reload"),
      btnFit: root.querySelector("#cc-cm-fit"),
      drawerEl: root.querySelector("#cc-cm-drawer"),
      drawerTitleEl: root.querySelector("#cc-cm-drawer-title"),
      drawerContentEl: root.querySelector("#cc-cm-drawer-content"),
      scrollEl: scroller,
      knobEl: root.querySelector("#cc-scroll-knob")
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

  // ---------------------------
  // Main mount
  // ---------------------------
  async function mount(root, userOpts) {
    const opts = { ...DEFAULTS, ...(userOpts || {}) };

    // Load CSS + Leaflet (CSP-safe)
    if (opts.appCssUrl) await loadCssTextOnce(opts.appCssUrl, "cc_canyon_map_css");
    await ensureLeaflet(opts);

    const ui = buildLayout(root, opts);

    let mapDoc = null;
    let stateDoc = null;

    let mainMap = null;
    let lensMap = null;

    const regionLayersById = {};
    const regionsById = {};
    let selectedRegionId = null;

    function fitToImage() {
      if (!mainMap || !mapDoc) return;
      const px = mapDoc.map.background.image_pixel_size;
      const bounds = [[0, 0], [px.h, px.w]];
      mainMap.fitBounds(bounds, { padding: [10, 10] });
    }

    function rebuildRegions() {
      Object.values(regionLayersById).forEach((layer) => {
        try {
          mainMap.removeLayer(layer);
        } catch (e) {}
      });
      for (const k of Object.keys(regionLayersById)) delete regionLayersById[k];

      const stateByRegion = stateDoc?.state_by_region || {};
      const coordSystem = mapDoc.map?.background?.coord_system || "image_px";

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

        poly.addTo(mainMap);
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

    // Keep horizontal locked (paper scroll)
    function lockHorizontalCenter() {
      if (!opts.lockHorizontalPan || !mainMap || !mapDoc) return;
      const px = mapDoc.map.background.image_pixel_size;
      const cx = px.w / 2;
      const c = mainMap.getCenter();
      if (Math.abs(c.lng - cx) > 0.5) {
        mainMap.panTo([c.lat, cx], { animate: false });
      }
    }

    // ---------------------------
    // Lens map sync
    // ---------------------------
    const syncLens = rafThrottle(() => {
      if (!opts.lensEnabled) return;
      if (!mainMap || !lensMap) return;
      const c = mainMap.getCenter();
      const z = mainMap.getZoom();
      lensMap.setView(c, z + opts.lensZoomOffset, { animate: false });
    });

    // ---------------------------
    // Scroll knob
    // ---------------------------
    function getScrollRange() {
      if (!mainMap || !mapDoc) return { yMin: 0, yMax: 0 };

      const px = mapDoc.map.background.image_pixel_size;
      const bounds = [[0, 0], [px.h, px.w]];
      const b = window.L.latLngBounds(bounds);

      // Get current viewport height in "map units" (CRS.Simple)
      // We'll approximate by using the map's bounds.
      const view = mainMap.getBounds();
      const viewH = view.getNorth() - view.getSouth();
      const half = viewH / 2;

      const yMin = b.getSouth() + half; // 0 + half
      const yMax = b.getNorth() - half; // h - half

      return { yMin, yMax };
    }

    function centerToKnobY() {
      if (!mainMap || !mapDoc) return 0;
      const { yMin, yMax } = getScrollRange();
      const c = mainMap.getCenter();
      const t = (c.lat - yMin) / Math.max(1e-6, (yMax - yMin));
      return clamp(t, 0, 1);
    }

    function updateKnobFromMap() {
      const t = centerToKnobY();
      ui.knobEl.style.top = `${t * 100}%`;
      ui.knobEl.style.transform = `translate(-50%, -50%)`;
    }

    function panMapToT(t) {
      if (!mainMap || !mapDoc) return;
      const { yMin, yMax } = getScrollRange();
      const px = mapDoc.map.background.image_pixel_size;
      const cx = px.w / 2;
      const y = yMin + clamp(t, 0, 1) * (yMax - yMin);
      mainMap.panTo([y, cx], { animate: false });
    }

    function bindScroller() {
      let dragging = false;

      function setFromClientY(clientY) {
        const rect = ui.scrollEl.getBoundingClientRect();
        const t = (clientY - rect.top) / rect.height;
        panMapToT(t);
      }

      const onMove = (e) => {
        if (!dragging) return;
        const clientY = e.touches ? e.touches[0].clientY : e.clientY;
        setFromClientY(clientY);
      };

      const onUp = () => {
        dragging = false;
        document.removeEventListener("mousemove", onMove);
        document.removeEventListener("mouseup", onUp);
        document.removeEventListener("touchmove", onMove, { passive: false });
        document.removeEventListener("touchend", onUp);
      };

      ui.knobEl.addEventListener("mousedown", (e) => {
        dragging = true;
        document.addEventListener("mousemove", onMove);
        document.addEventListener("mouseup", onUp);
        e.preventDefault();
      });

      ui.knobEl.addEventListener("touchstart", (e) => {
        dragging = true;
        document.addEventListener("touchmove", onMove, { passive: false });
        document.addEventListener("touchend", onUp);
        e.preventDefault();
      }, { passive: false });

      // clicking on the track moves too
      ui.scrollEl.addEventListener("mousedown", (e) => {
        if (e.target === ui.knobEl) return;
        setFromClientY(e.clientY);
      });

      ui.scrollEl.addEventListener("touchstart", (e) => {
        if (e.target === ui.knobEl) return;
        const clientY = e.touches[0].clientY;
        setFromClientY(clientY);
      }, { passive: true });
    }

    // ---------------------------
    // Load + build
    // ---------------------------
    async function loadAll() {
      ui.drawerContentEl.innerHTML = "";
      ui.drawerContentEl.appendChild(el("div", { class: "cc-muted" }, ["Loading…"]));

      mapDoc = await fetchJson(opts.mapUrl);
      stateDoc = await fetchJson(opts.stateUrl);

      const mapErr = validateMapDoc(mapDoc);
      if (mapErr) throw new Error("Bad canyon_map.json: " + mapErr);

      const stateErr = validateStateDoc(stateDoc);
      if (stateErr) throw new Error("Bad canyon_state.json: " + stateErr);

      // Destroy old maps
      if (mainMap) { try { mainMap.remove(); } catch (e) {} mainMap = null; }
      if (lensMap) { try { lensMap.remove(); } catch (e) {} lensMap = null; }

      const px = mapDoc.map.background.image_pixel_size;
      const bounds = [[0, 0], [px.h, px.w]];

      // Main map
      mainMap = window.L.map(ui.mapEl, {
        crs: window.L.CRS.Simple,
        minZoom: -3,
        maxZoom: 3,
        zoomSnap: 0.25,
        zoomDelta: 0.25,
        wheelDebounceTime: 30,
        attributionControl: false,
        zoomControl: false,
        scrollWheelZoom: false,
        doubleClickZoom: false,
        boxZoom: false,
        keyboard: false,
        dragging: !!opts.allowMapDrag,
        tap: true
      });

      window.L.imageOverlay(mapDoc.map.background.image_key, bounds, {
        opacity: clamp(mapDoc.map.background.opacity ?? 1.0, 0, 1)
      }).addTo(mainMap);

      mainMap.setMaxBounds(bounds);
      fitToImage();

      // Lock horizontal pan to center
      if (opts.lockHorizontalPan) {
        mainMap.on("move", lockHorizontalCenter);
        // snap immediately after fit
        lockHorizontalCenter();
      }

      // Regions
      rebuildRegions();
      closeDrawer(ui);
      ui.drawerTitleEl.textContent = "Region";
      ui.drawerContentEl.innerHTML = "";
      ui.drawerContentEl.appendChild(el("div", { class: "cc-muted" }, ["Click a region to view details."]));

      // Lens
      if (opts.lensEnabled) {
        ui.lensEl.style.display = "block";

        lensMap = window.L.map(ui.lensMapEl, {
          crs: window.L.CRS.Simple,
          minZoom: -3,
          maxZoom: 6,
          zoomSnap: 0.25,
          zoomDelta: 0.25,
          attributionControl: false,
          zoomControl: false,
          scrollWheelZoom: false,
          doubleClickZoom: false,
          boxZoom: false,
          keyboard: false,
          dragging: false,
          tap: false
        });

        window.L.imageOverlay(mapDoc.map.background.image_key, bounds, {
          opacity: 1.0
        }).addTo(lensMap);

        lensMap.setMaxBounds(bounds);

        // initial sync
        syncLens();

        // keep synced
        mainMap.on("move", syncLens);
        mainMap.on("zoom", syncLens);
      } else {
        ui.lensEl.style.display = "none";
      }

      // Scroller
      bindScroller();
      updateKnobFromMap();
      mainMap.on("move", () => {
        updateKnobFromMap();
        syncLens();
      });
      mainMap.on("zoom", () => {
        updateKnobFromMap();
        syncLens();
      });
    }

    ui.btnReload.addEventListener("click", () => loadAll().catch((e) => console.error(e)));
    ui.btnFit.addEventListener("click", fitToImage);

    await loadAll();

    // API
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

      // Lens controls (optional)
      setLensEnabled: (on) => {
        opts.lensEnabled = !!on;
        ui.lensEl.style.display = opts.lensEnabled ? "block" : "none";
        if (opts.lensEnabled && mainMap && lensMap) syncLens();
      },

      getMapDoc: () => mapDoc,
      getStateDoc: () => stateDoc
    };

    root._ccApi = api;
    return api;
  }

  // Auto-mount
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
      root.innerHTML = "<div style='padding:12px;opacity:.85'>❌ Canyon Map failed to load. Check console.</div>";
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", autoMountIfPresent);
  } else {
    autoMountIfPresent();
  }

  window.CC_CanyonMap = { mount };
})();
