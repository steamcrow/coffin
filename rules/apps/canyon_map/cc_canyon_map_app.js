/* File: rules/apps/canyon_map/cc_canyon_map_app.js
   Coffin Canyon — Canyon Map (read-only v1)
   ODOO CSP-SAFE + FIXED MAGNIFIER LENS + VERTICAL SCROLLER KNOB

   Mounts into: #cc-app-root[data-cc-app="canyon_map"]
*/

(function () {
  const APP_ID = "canyon_map";

  const DEFAULTS = {
    title: "Coffin Canyon — Canyon Map",

    // Data
    mapUrl:
      "https://raw.githubusercontent.com/steamcrow/coffin/main/rules/apps/canyon_map/data/canyon_map.json",
    stateUrl:
      "https://raw.githubusercontent.com/steamcrow/coffin/main/rules/apps/canyon_map/data/canyon_state.json",

    // App CSS (optional – we still inject safety CSS below)
    appCssUrl:
      "https://raw.githubusercontent.com/steamcrow/coffin/main/rules/apps/canyon_map/cc_canyon_map.css",

    // Leaflet (hosted in your repo to avoid CDN/CSP issues)
    leafletCssUrl:
      "https://raw.githubusercontent.com/steamcrow/coffin/main/rules/vendor/leaflet/leaflet.css",
    leafletJsUrl:
      "https://raw.githubusercontent.com/steamcrow/coffin/main/rules/vendor/leaflet/leaflet.js",

    // Lens behavior
    lensEnabled: true,
    lensZoomOffset: 2,
    lensWidthPx: 520,
    lensHeightPx: 360,

    // Panning behavior
    lockHorizontalPan: false,
    maxHorizontalDriftPx: 260,
    allowMapDrag: true,

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
  // CRITICAL CSS safety override
  // (z-index/pointer-events/touch-action so lens+scroller always sit above Leaflet)
  // ---------------------------
  function injectCssSafetyOnce() {
    const key = "cc_canyon_map_safety_css";
    if (document.querySelector(`style[data-cc-style="${key}"]`)) return;

    const style = document.createElement("style");
    style.setAttribute("data-cc-style", key);

    style.textContent = `
/* --- CC Canyon Map SAFETY CSS (wins even if external CSS is missing) --- */
.cc-canyon-map { color: #eee; }
.cc-cm-header { display:flex; align-items:center; justify-content:center; gap:14px; margin: 10px 0 12px; }
.cc-cm-title { font-size: 18px; opacity: .95; }
.cc-cm-actions { display:flex; gap: 10px; }
.cc-btn { font: inherit; padding: 6px 10px; border-radius: 8px; border: 1px solid rgba(255,255,255,.22); background: rgba(255,255,255,.10); color:#fff; cursor:pointer; }
.cc-btn:hover { background: rgba(255,255,255,.16); }
.cc-btn-x { width:34px; height:34px; padding:0; display:flex; align-items:center; justify-content:center; }

.cc-cm-body { display:flex; gap:12px; align-items:stretch; justify-content:center; }
.cc-cm-mapwrap { position:relative; flex: 0 1 920px; width: min(92vw, 920px); height: min(72vh, 860px); min-height: 560px; overflow:hidden; border-radius: 14px; }
.cc-cm-map { position:absolute; inset:0; z-index: 1; }

/* Leaflet panes can overlap overlays if we don't control stacking */
#cc-cm-map .leaflet-pane,
#cc-cm-map .leaflet-control-container { z-index: 2 !important; }

/* Lens ABOVE Leaflet */
.cc-lens { position:absolute; z-index: 50 !important; left: 50%; top: 50%; transform: translate(-50%, -50%);
  width: var(--lens-w, 520px); height: var(--lens-h, 360px);
  pointer-events: none; /* lens should not block interaction */
}
.cc-lens-inner { width:100%; height:100%; overflow:hidden; border-radius: 16px; filter: url(#ccLensWarp); }
.cc-lens-map { width:100%; height:100%; }
.cc-lens-rim { position:absolute; inset:-8px; border-radius: 20px; border: 2px solid rgba(255,255,255,.25); box-shadow: 0 10px 40px rgba(0,0,0,.45); }
.cc-lens-glare { position:absolute; inset:0; border-radius: 16px; background: radial-gradient(ellipse at 30% 20%, rgba(255,255,255,.16), rgba(255,255,255,0) 55%); }

/* Scroller ABOVE EVERYTHING and must receive touches */
.cc-scroll { position:absolute; z-index: 60 !important; right: 10px; top: 10px; bottom: 10px; width: 44px; pointer-events: auto !important; }
.cc-scroll-track { position:absolute; left:50%; top:0; bottom:0; width:8px; transform: translateX(-50%); border-radius: 999px; background: rgba(255,255,255,.12); }
.cc-scroll-knob { position:absolute; left:50%; width: 34px; height: 34px; border-radius: 999px;
  transform: translate(-50%, -50%);
  background: rgba(255,255,255,.34);
  border: 1px solid rgba(255,255,255,.28);
  backdrop-filter: blur(6px);
  cursor: grab;
  touch-action: none; /* IMPORTANT for iOS dragging */
}

/* Drawer */
.cc-cm-drawer { width: 320px; max-width: 42vw; background: rgba(0,0,0,.25); border: 1px solid rgba(255,255,255,.12);
  border-radius: 14px; padding: 10px; }
.cc-cm-drawer.open { outline: 1px solid rgba(255,255,255,.18); }
.cc-cm-drawer-head { display:flex; justify-content:space-between; align-items:center; gap:10px; margin-bottom: 8px; }
.cc-cm-drawer-title { font-weight: 700; opacity:.95; }
.cc-muted { opacity: .75; }
.cc-block { margin: 10px 0; }
.cc-h { font-weight: 700; margin-bottom: 4px; }
.cc-ul { margin: 6px 0 0 18px; padding: 0; }

/* Mobile layout */
@media (max-width: 920px){
  .cc-cm-body { flex-direction: column; align-items:center; }
  .cc-cm-drawer { width: min(92vw, 920px); max-width: none; }
  .cc-cm-mapwrap { width: min(92vw, 920px); height: min(70vh, 760px); }
}
`;
    document.head.appendChild(style);
  }

  // ---------------------------
  // Data validation + geometry
  // ---------------------------
  function normalizePoints(points, coordSystem) {
    if (!Array.isArray(points)) return [];
    if (coordSystem !== "image_px" && coordSystem !== "map_units") return [];
    return points
      .filter((p) => p && typeof p.x === "number" && typeof p.y === "number")
      .map((p) => [p.y, p.x]);
  }

  function validateMapDoc(doc) {
    if (!doc || doc.schema_id !== "cc_canyon_map") return "schema_id must be cc_canyon_map";
    if (!doc.map || !doc.map.background || !doc.map.background.image_key)
      return "map.background.image_key missing";
    if (!doc.map.background.image_pixel_size) return "map.background.image_pixel_size missing";
    if (!Array.isArray(doc.regions)) return "regions must be array";
    return null;
  }

  function validateStateDoc(doc) {
    if (!doc || doc.schema_id !== "cc_canyon_state") return "schema_id must be cc_canyon_state";
    if (!doc.state_by_region || typeof doc.state_by_region !== "object")
      return "state_by_region missing";
    return null;
  }

  // ---------------------------
  // UI
  // ---------------------------
  function buildLayout(root, opts) {
    root.innerHTML = "";
    root.classList.add("cc-canyon-map");

    // Inline SVG filter (lens distortion)
    const svgFilter = el(
      "svg",
      {
        class: "cc-lens-svg",
        width: "0",
        height: "0",
        "aria-hidden": "true",
        focusable: "false"
      },
      [
        el(
          "filter",
          { id: "ccLensWarp", x: "-20%", y: "-20%", width: "140%", height: "140%" },
          [
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
          ]
        )
      ]
    );

    const header = el("div", { class: "cc-cm-header" }, [
      el("div", { class: "cc-cm-title" }, [opts.title]),
      el("div", { class: "cc-cm-actions" }, [
        el("button", { class: "cc-btn", type: "button", id: "cc-cm-reload" }, ["Reload"]),
        el("button", { class: "cc-btn", type: "button", id: "cc-cm-fit" }, ["Fit"])
      ])
    ]);

    const mapEl = el("div", { id: "cc-cm-map", class: "cc-cm-map" });

    const lens = el("div", { class: "cc-lens", id: "cc-lens" }, [
      el("div", { class: "cc-lens-rim" }),
      el("div", { class: "cc-lens-inner", id: "cc-lens-inner" }, [
        el("div", { class: "cc-lens-map", id: "cc-lens-map" })
      ]),
      el("div", { class: "cc-lens-glare" })
    ]);

    const scroller = el("div", { class: "cc-scroll", id: "cc-scroll" }, [
      el("div", { class: "cc-scroll-track" }),
      el("div", { class: "cc-scroll-knob", id: "cc-scroll-knob" })
    ]);

    const body = el("div", { class: "cc-cm-body cc-cm-body--lens" }, [
      el("div", { class: "cc-cm-mapwrap" }, [mapEl, lens, scroller]),
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

    root.appendChild(svgFilter);
    root.appendChild(header);
    root.appendChild(body);

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
        weather
          ? el("div", {}, [`Weather: ${weather}`])
          : el("div", { class: "cc-muted" }, ["Weather: (none)"])
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

    // Back-compat
    let maxDrift = typeof opts.maxHorizontalDriftPx === "number" ? opts.maxHorizontalDriftPx : 0;
    if (opts.lockHorizontalPan === true) maxDrift = 0;

    // Load external CSS (optional), then inject safety CSS that forces proper stacking.
    if (opts.appCssUrl) await loadCssTextOnce(opts.appCssUrl, "cc_canyon_map_css");
    injectCssSafetyOnce();

    await ensureLeaflet(opts);

    const ui = buildLayout(root, opts);

    let mapDoc = null;
    let stateDoc = null;
    let mainMap = null;
    let lensMap = null;

    const regionLayersById = {};
    const regionsById = {};
    let selectedRegionId = null;

    let scrollerBound = false;

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
        try {
          layer.setStyle(style);
        } catch (e) {}
      });

      if (selectedRegionId && regionsById[selectedRegionId]) {
        renderDrawer(ui, regionsById[selectedRegionId], stateByRegion[selectedRegionId] || null);
      }
    }

    function clampHorizontal() {
      if (!mainMap || !mapDoc) return;
      const px = mapDoc.map.background.image_pixel_size;
      const cx = px.w / 2;

      const c = mainMap.getCenter();
      const minX = cx - maxDrift;
      const maxX = cx + maxDrift;

      const clampedX = clamp(c.lng, minX, maxX);
      if (Math.abs(clampedX - c.lng) > 0.5) {
        mainMap.panTo([c.lat, clampedX], { animate: false });
      }
    }

    const syncLens = rafThrottle(() => {
      if (!opts.lensEnabled) return;
      if (!mainMap || !lensMap) return;
      const c = mainMap.getCenter();
      const z = mainMap.getZoom();
      lensMap.setView(c, z + opts.lensZoomOffset, { animate: false });
    });

    function getScrollRange() {
      if (!mainMap || !mapDoc) return { yMin: 0, yMax: 0 };
      const px = mapDoc.map.background.image_pixel_size;
      const bounds = [[0, 0], [px.h, px.w]];
      const b = window.L.latLngBounds(bounds);

      const view = mainMap.getBounds();
      const viewH = view.getNorth() - view.getSouth();
      const half = viewH / 2;

      const yMin = b.getSouth() + half;
      const yMax = b.getNorth() - half;

      return { yMin, yMax };
    }

    function centerToKnobT() {
      if (!mainMap || !mapDoc) return 0;
      const { yMin, yMax } = getScrollRange();
      const c = mainMap.getCenter();
      const t = (c.lat - yMin) / Math.max(1e-6, yMax - yMin);
      return clamp(t, 0, 1);
    }

    function updateKnobFromMap() {
      const t = centerToKnobT();
      ui.knobEl.style.top = `${t * 100}%`;
      ui.knobEl.style.transform = `translate(-50%, -50%)`;
    }

    function panMapToT(t) {
      if (!mainMap || !mapDoc) return;
      const { yMin, yMax } = getScrollRange();
      const px = mapDoc.map.background.image_pixel_size;
      const cx = px.w / 2;

      const y = yMin + clamp(t, 0, 1) * (yMax - yMin);

      const c = mainMap.getCenter();
      const minX = cx - maxDrift;
      const maxX = cx + maxDrift;
      const x = clamp(c.lng, minX, maxX);

      mainMap.panTo([y, x], { animate: false });
    }

    function bindScrollerOnce() {
      if (scrollerBound) return;
      scrollerBound = true;

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
        if (e.cancelable) e.preventDefault();
      };

      const onUp = () => {
        dragging = false;
        document.removeEventListener("mousemove", onMove);
        document.removeEventListener("mouseup", onUp);
        document.removeEventListener("touchmove", onMove);
        document.removeEventListener("touchend", onUp);
      };

      ui.knobEl.addEventListener("mousedown", (e) => {
        dragging = true;
        document.addEventListener("mousemove", onMove);
        document.addEventListener("mouseup", onUp);
        e.preventDefault();
      });

      ui.knobEl.addEventListener(
        "touchstart",
        (e) => {
          dragging = true;
          document.addEventListener("touchmove", onMove, { passive: false });
          document.addEventListener("touchend", onUp);
          if (e.cancelable) e.preventDefault();
        },
        { passive: false }
      );

      ui.scrollEl.addEventListener("mousedown", (e) => {
        if (e.target === ui.knobEl) return;
        setFromClientY(e.clientY);
      });

      ui.scrollEl.addEventListener(
        "touchstart",
        (e) => {
          if (e.target === ui.knobEl) return;
          setFromClientY(e.touches[0].clientY);
        },
        { passive: true }
      );
    }

    async function loadAll() {
      ui.drawerContentEl.innerHTML = "";
      ui.drawerContentEl.appendChild(el("div", { class: "cc-muted" }, ["Loading…"]));

      console.log("🗺️ canyon_map.json:", opts.mapUrl);
      console.log("🗺️ canyon_state.json:", opts.stateUrl);

      mapDoc = await fetchJson(opts.mapUrl);
      stateDoc = await fetchJson(opts.stateUrl);

      const mapErr = validateMapDoc(mapDoc);
      if (mapErr) throw new Error("Bad canyon_map.json: " + mapErr);

      const stateErr = validateStateDoc(stateDoc);
      if (stateErr) throw new Error("Bad canyon_state.json: " + stateErr);

      if (mainMap) {
        try {
          mainMap.remove();
        } catch (e) {}
        mainMap = null;
      }
      if (lensMap) {
        try {
          lensMap.remove();
        } catch (e) {}
        lensMap = null;
      }

      const px = mapDoc.map.background.image_pixel_size;
      const bounds = [[0, 0], [px.h, px.w]];

      mainMap = window.L.map(ui.mapEl, {
        crs: window.L.CRS.Simple,
        minZoom: -3,
        maxZoom: 3,
        zoomSnap: 0.25,
        zoomDelta: 0.25,
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

      // IMPORTANT: Safari/iOS needs invalidateSize after layout.
      mainMap.whenReady(() => {
        try {
          mainMap.invalidateSize(true);
        } catch (e) {}
        try {
          updateKnobFromMap();
        } catch (e) {}
        try {
          syncLens();
        } catch (e) {}
      });
      setTimeout(() => {
        try {
          mainMap.invalidateSize(true);
        } catch (e) {}
        try {
          if (lensMap) lensMap.invalidateSize(true);
        } catch (e) {}
        try {
          updateKnobFromMap();
        } catch (e) {}
        try {
          syncLens();
        } catch (e) {}
      }, 60);

      if (maxDrift >= 0) {
        mainMap.on("move", clampHorizontal);
        clampHorizontal();
      }

      rebuildRegions();
      closeDrawer(ui);
      ui.drawerTitleEl.textContent = "Region";
      ui.drawerContentEl.innerHTML = "";
      ui.drawerContentEl.appendChild(
        el("div", { class: "cc-muted" }, ["Click a region to view details."])
      );

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

        const lensImageKey = mapDoc.map?.lens?.image_key || mapDoc.map.background.image_key;

        window.L.imageOverlay(lensImageKey, bounds, { opacity: 1.0 }).addTo(lensMap);
        lensMap.setMaxBounds(bounds);

        lensMap.whenReady(() => {
          try {
            lensMap.invalidateSize(true);
          } catch (e) {}
          syncLens();
        });

        syncLens();
        mainMap.on("move", syncLens);
        mainMap.on("zoom", syncLens);
      } else {
        ui.lensEl.style.display = "none";
      }

      bindScrollerOnce();
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
        stateDoc.state_by_region[regionId] = {
          ...(stateDoc.state_by_region[regionId] || {}),
          ...(patch || {})
        };
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

      const msg = (e && (e.message || String(e))) || "Unknown error";
      root.innerHTML =
        "<div style='padding:12px;opacity:.92;line-height:1.35'>" +
        "<div style='font-weight:700;margin-bottom:6px'>❌ Canyon Map failed to load</div>" +
        "<div style='font-family:monospace;font-size:12px;white-space:pre-wrap;background:rgba(0,0,0,.25);padding:10px;border-radius:8px'>" +
        msg +
        "</div>" +
        "<div style='margin-top:10px;opacity:.8'>Tip: this message is your iPad console now.</div>" +
        "</div>";
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", autoMountIfPresent);
  } else {
    autoMountIfPresent();
  }

  window.CC_CanyonMap = { mount };
})();
