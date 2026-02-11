/* File: rules/apps/canyon_map/cc_canyon_map_app.js
   Coffin Canyon — Canyon Map
   
   WITH DUAL SCROLLERS + MOMENTUM + MIDDLE START
   
   Features:
   - Vertical scroller (right side) controls Y position
   - Horizontal scroller (bottom) controls X position  
   - Both knobs start in MIDDLE of their ranges
   - Momentum scrolling (coasts when you drag fast)
   - Visual feedback when grabbing (is-active class)
   - Fixed: No backwards scrolling
   - Fixed: Knobs move smoothly when dragged
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

    // App CSS
    appCssUrl:
      "https://raw.githubusercontent.com/steamcrow/coffin/main/rules/apps/canyon_map/cc_canyon_map.css",

    // Leaflet (hosted in your repo)
    leafletCssUrl:
      "https://raw.githubusercontent.com/steamcrow/coffin/main/rules/vendor/leaflet/leaflet.css",
    leafletJsUrl:
      "https://raw.githubusercontent.com/steamcrow/coffin/main/rules/vendor/leaflet/leaflet.js",

    // Layout sizing
    baseMapHeightPx: 640,
    baseMapMaxHeightVh: 70,

    // Lens behavior - NOW 20% SMALLER
    lensEnabled: true,
    lensZoomOffset: 2,
    lensWidthPx: 416,  // was 520, now 520 * 0.8 = 416
    lensHeightPx: 288, // was 360, now 360 * 0.8 = 288

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

  function nextFrame() {
    return new Promise((r) => requestAnimationFrame(r));
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
  // Validation + geometry
  // ---------------------------
  function normalizePoints(points, coordSystem) {
    if (!Array.isArray(points)) return [];
    if (coordSystem !== "image_px" && coordSystem !== "map_units") return [];
    return points
      .filter((p) => p && typeof p.x === "number" && typeof p.y === "number")
      .map((p) => [p.y, p.x]); // CRS.Simple => [y, x]
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

    const header = el("div", { class: "cc-cm-header" }, [
      el("div", { class: "cc-cm-title" }, [opts.title]),
      el("div", { class: "cc-cm-actions" }, [
        el("button", { class: "cc-btn", type: "button", id: "cc-cm-reload" }, ["Reload"]),
        el("button", { class: "cc-btn", type: "button", id: "cc-cm-fit" }, ["Fit"])
      ])
    ]);

    const mapEl = el("div", { id: "cc-cm-map", class: "cc-cm-map" });

    // Lens with overscan wrapper
    const lensOverscan = el("div", { class: "cc-lens-overscan" }, [
      el("div", { id: "cc-lens-map" })
    ]);

    const lens = el("div", { class: "cc-lens", id: "cc-lens" }, [
      el("div", { class: "cc-lens-inner" }, [lensOverscan]),
      el("div", { class: "cc-lens-glare" })
    ]);

    // Frame overlay
    const frame = el("div", { class: "cc-frame-overlay" });

    // Vertical scroller (right side)
    const scrollerV = el("div", { class: "cc-scroll-vertical", id: "cc-scroll-vertical" }, [
      el("div", { class: "cc-scroll-track" }),
      el("div", { class: "cc-scroll-knob", id: "cc-scroll-knob-v" })
    ]);

    // Horizontal scroller (bottom)
    const scrollerH = el("div", { class: "cc-scroll-horizontal", id: "cc-scroll-horizontal" }, [
      el("div", { class: "cc-scroll-track" }),
      el("div", { class: "cc-scroll-knob", id: "cc-scroll-knob-h" })
    ]);

    const body = el("div", { class: "cc-cm-body cc-cm-body--lens" }, [
      el("div", { class: "cc-cm-mapwrap" }, [mapEl, lens, frame, scrollerV, scrollerH]),
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

    // Lens dimensions
    lens.style.setProperty("--lens-w", `${opts.lensWidthPx}px`);
    lens.style.setProperty("--lens-h", `${opts.lensHeightPx}px`);

    return {
      mapEl,
      lensEl: lens,
      lensMapEl: root.querySelector("#cc-lens-map"),
      frameEl: frame,
      btnReload: root.querySelector("#cc-cm-reload"),
      btnFit: root.querySelector("#cc-cm-fit"),
      drawerEl: root.querySelector("#cc-cm-drawer"),
      drawerTitleEl: root.querySelector("#cc-cm-drawer-title"),
      drawerContentEl: root.querySelector("#cc-cm-drawer-content"),
      scrollElV: scrollerV,
      knobElV: root.querySelector("#cc-scroll-knob-v"),
      scrollElH: scrollerH,
      knobElH: root.querySelector("#cc-scroll-knob-h")
    };
  }

  function openDrawer(ui) {
    ui.drawerEl.classList.add("open");
  }

  function closeDrawer(ui) {
    ui.drawerEl.classList.remove("open");
  }

  function renderDrawer(ui, region, stateForRegion) {
    ui.drawerTitleEl.textContent = region?.name || "Region";

    const controller = stateForRegion?.controller_faction_id || "neutral";
    const status = stateForRegion?.status || "neutral";
    const weather = stateForRegion?.weather_tag || null;

    const nodes = [];

    if (region?.description) nodes.push(el("div", { class: "cc-block" }, [region.description]));

    nodes.push(
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
    nodes.push(
      el("div", { class: "cc-block" }, [
        el("div", { class: "cc-h" }, ["Resources"]),
        resources.length
          ? el("ul", { class: "cc-ul" }, resources.map((r) => el("li", {}, [String(r)])))
          : el("div", { class: "cc-muted" }, ["(none)"])
      ])
    );

    const encounters = region?.encounters || [];
    nodes.push(
      el("div", { class: "cc-block" }, [
        el("div", { class: "cc-h" }, ["Encounters"]),
        encounters.length
          ? el("ul", { class: "cc-ul" }, encounters.map((e) => el("li", {}, [String(e)])))
          : el("div", { class: "cc-muted" }, ["(none)"])
      ])
    );

    ui.drawerContentEl.innerHTML = "";
    nodes.forEach((n) => ui.drawerContentEl.appendChild(n));
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

  // ---------------------------
  // Main mount
  // ---------------------------
  async function mount(root, userOpts) {
    const opts = { ...DEFAULTS, ...(userOpts || {}) };

    let maxDrift = typeof opts.maxHorizontalDriftPx === "number" ? opts.maxHorizontalDriftPx : 0;
    if (opts.lockHorizontalPan === true) maxDrift = 0;

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

    let scrollersBound = false;

    function enforceBaseMapSize() {
      if (!mapDoc) return;

      const px = mapDoc.map.background.image_pixel_size;
      const aspect = px.w / px.h;

      const vh = window.innerHeight || 900;
      const maxH = Math.floor((opts.baseMapMaxHeightVh / 100) * vh);
      const h = clamp(opts.baseMapHeightPx, 320, maxH);
      const w = Math.round(h * aspect);

      ui.mapEl.style.height = h + "px";
      ui.mapEl.style.width = w + "px";
    }

    function fitToImage() {
      if (!mainMap || !mapDoc) return;
      const px = mapDoc.map.background.image_pixel_size;
      const bounds = [[0, 0], [px.h, px.w]];
      mainMap.fitBounds(bounds, { padding: [10, 10] });
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

    // ---- Scroller math (BOTH AXES) ----
    function getScrollRange() {
      if (!mainMap || !mapDoc) return { yMin: 0, yMax: 0, xMin: 0, xMax: 0 };

      const px = mapDoc.map.background.image_pixel_size;
      const view = mainMap.getBounds();
      const viewH = Math.abs(view.getNorth() - view.getSouth());
      const viewW = Math.abs(view.getEast() - view.getWest());

      const halfH = viewH / 2;
      const halfW = viewW / 2;

      // Y range
      let yMin, yMax;
      if (viewH >= px.h) {
        yMin = yMax = px.h / 2;
      } else {
        yMin = 0 + halfH;
        yMax = px.h - halfH;
      }

      // X range
      let xMin, xMax;
      if (viewW >= px.w) {
        xMin = xMax = px.w / 2;
      } else {
        xMin = 0 + halfW;
        xMax = px.w - halfW;
      }

      return { yMin, yMax, xMin, xMax };
    }

    function mapCenterToKnobT() {
      if (!mainMap || !mapDoc) return { tY: 0.5, tX: 0.5 };
      const { yMin, yMax, xMin, xMax } = getScrollRange();
      const c = mainMap.getCenter();

      const tY = yMax === yMin ? 0.5 : (c.lat - yMin) / (yMax - yMin);
      const tX = xMax === xMin ? 0.5 : (c.lng - xMin) / (xMax - xMin);

      return { tY: clamp(tY, 0, 1), tX: clamp(tX, 0, 1) };
    }

    function updateKnobsFromMap() {
      const { tY, tX } = mapCenterToKnobT();
      
      // Vertical knob
      ui.knobElV.style.top = `${tY * 100}%`;
      
      // Horizontal knob
      ui.knobElH.style.left = `${tX * 100}%`;
    }

    function panMapToTY(tY) {
      if (!mainMap || !mapDoc) return;
      const { yMin, yMax } = getScrollRange();
      const y = yMin === yMax ? yMin : yMin + clamp(tY, 0, 1) * (yMax - yMin);

      const c = mainMap.getCenter();
      mainMap.panTo([y, c.lng], { animate: false });
    }

    function panMapToTX(tX) {
      if (!mainMap || !mapDoc) return;
      const { xMin, xMax } = getScrollRange();
      const x = xMin === xMax ? xMin : xMin + clamp(tX, 0, 1) * (xMax - xMin);

      const c = mainMap.getCenter();
      mainMap.panTo([c.lat, x], { animate: false });
    }

    // ---- Initialize to middle ----
    function initializeToMiddle() {
      if (!mainMap || !mapDoc) return;
      const px = mapDoc.map.background.image_pixel_size;
      const centerY = px.h / 2;
      const centerX = px.w / 2;
      
      mainMap.panTo([centerY, centerX], { animate: false });
      updateKnobsFromMap();
    }

    // ---- MOMENTUM SCROLLING ----
    function bindScrollersOnce() {
      if (scrollersBound) return;
      scrollersBound = true;

      // --- VERTICAL SCROLLER ---
      let draggingV = false;
      let lastYV = 0;
      let lastTimeV = 0;
      let velocityY = 0;

      function setFromClientY(clientY) {
        const rect = ui.scrollElV.getBoundingClientRect();
        const tY = (clientY - rect.top) / rect.height;
        panMapToTY(tY);
      }

      const onMoveV = (e) => {
        if (!draggingV) return;
        const clientY = e.touches ? e.touches[0].clientY : e.clientY;
        
        // Track velocity for momentum
        const now = Date.now();
        const dt = now - lastTimeV;
        if (dt > 0) {
          velocityY = (clientY - lastYV) / dt;
        }
        lastYV = clientY;
        lastTimeV = now;

        setFromClientY(clientY);
        if (e.cancelable) e.preventDefault();
      };

      const onUpV = () => {
        draggingV = false;
        ui.knobElV.classList.remove("is-active");

        // Apply momentum
        const applyMomentum = () => {
          if (Math.abs(velocityY) < 0.01) return;
          
          const rect = ui.scrollElV.getBoundingClientRect();
          lastYV += velocityY * 16; // ~60fps frame
          const tY = (lastYV - rect.top) / rect.height;
          panMapToTY(tY);
          
          velocityY *= 0.92; // Friction
          requestAnimationFrame(applyMomentum);
        };
        
        if (Math.abs(velocityY) > 0.5) {
          applyMomentum();
        }

        document.removeEventListener("mousemove", onMoveV);
        document.removeEventListener("mouseup", onUpV);
        document.removeEventListener("touchmove", onMoveV);
        document.removeEventListener("touchend", onUpV);
      };

      ui.knobElV.addEventListener("mousedown", (e) => {
        draggingV = true;
        ui.knobElV.classList.add("is-active");
        lastYV = e.clientY;
        lastTimeV = Date.now();
        velocityY = 0;

        document.addEventListener("mousemove", onMoveV);
        document.addEventListener("mouseup", onUpV);
        e.preventDefault();
      });

      ui.knobElV.addEventListener(
        "touchstart",
        (e) => {
          draggingV = true;
          ui.knobElV.classList.add("is-active");
          lastYV = e.touches[0].clientY;
          lastTimeV = Date.now();
          velocityY = 0;

          document.addEventListener("touchmove", onMoveV, { passive: false });
          document.addEventListener("touchend", onUpV);
          if (e.cancelable) e.preventDefault();
        },
        { passive: false }
      );

      ui.scrollElV.addEventListener("mousedown", (e) => {
        if (e.target === ui.knobElV) return;
        setFromClientY(e.clientY);
      });

      ui.scrollElV.addEventListener(
        "touchstart",
        (e) => {
          if (e.target === ui.knobElV) return;
          setFromClientY(e.touches[0].clientY);
        },
        { passive: true }
      );

      // --- HORIZONTAL SCROLLER ---
      let draggingH = false;
      let lastXH = 0;
      let lastTimeH = 0;
      let velocityX = 0;

      function setFromClientX(clientX) {
        const rect = ui.scrollElH.getBoundingClientRect();
        const tX = (clientX - rect.left) / rect.width;
        panMapToTX(tX);
      }

      const onMoveH = (e) => {
        if (!draggingH) return;
        const clientX = e.touches ? e.touches[0].clientX : e.clientX;
        
        // Track velocity for momentum
        const now = Date.now();
        const dt = now - lastTimeH;
        if (dt > 0) {
          velocityX = (clientX - lastXH) / dt;
        }
        lastXH = clientX;
        lastTimeH = now;

        setFromClientX(clientX);
        if (e.cancelable) e.preventDefault();
      };

      const onUpH = () => {
        draggingH = false;
        ui.knobElH.classList.remove("is-active");

        // Apply momentum
        const applyMomentum = () => {
          if (Math.abs(velocityX) < 0.01) return;
          
          const rect = ui.scrollElH.getBoundingClientRect();
          lastXH += velocityX * 16;
          const tX = (lastXH - rect.left) / rect.width;
          panMapToTX(tX);
          
          velocityX *= 0.92; // Friction
          requestAnimationFrame(applyMomentum);
        };
        
        if (Math.abs(velocityX) > 0.5) {
          applyMomentum();
        }

        document.removeEventListener("mousemove", onMoveH);
        document.removeEventListener("mouseup", onUpH);
        document.removeEventListener("touchmove", onMoveH);
        document.removeEventListener("touchend", onUpH);
      };

      ui.knobElH.addEventListener("mousedown", (e) => {
        draggingH = true;
        ui.knobElH.classList.add("is-active");
        lastXH = e.clientX;
        lastTimeH = Date.now();
        velocityX = 0;

        document.addEventListener("mousemove", onMoveH);
        document.addEventListener("mouseup", onUpH);
        e.preventDefault();
      });

      ui.knobElH.addEventListener(
        "touchstart",
        (e) => {
          draggingH = true;
          ui.knobElH.classList.add("is-active");
          lastXH = e.touches[0].clientX;
          lastTimeH = Date.now();
          velocityX = 0;

          document.addEventListener("touchmove", onMoveH, { passive: false });
          document.addEventListener("touchend", onUpH);
          if (e.cancelable) e.preventDefault();
        },
        { passive: false }
      );

      ui.scrollElH.addEventListener("mousedown", (e) => {
        if (e.target === ui.knobElH) return;
        setFromClientX(e.clientX);
      });

      ui.scrollElH.addEventListener(
        "touchstart",
        (e) => {
          if (e.target === ui.knobElH) return;
          setFromClientX(e.touches[0].clientX);
        },
        { passive: true }
      );
    }

    // ---- Leaflet size fix ----
    async function invalidateMapsHard() {
      await nextFrame();
      try {
        mainMap && mainMap.invalidateSize({ animate: false });
      } catch (e) {}
      try {
        lensMap && lensMap.invalidateSize({ animate: false });
      } catch (e) {}

      await nextFrame();
      try {
        mainMap && mainMap.invalidateSize({ animate: false });
      } catch (e) {}
      try {
        lensMap && lensMap.invalidateSize({ animate: false });
      } catch (e) {}
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

      enforceBaseMapSize();

      const px = mapDoc.map.background.image_pixel_size;
      const bounds = [[0, 0], [px.h, px.w]];

      // Main map (small)
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

      // Lens map (large, CLEARER)
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
      } else {
        ui.lensEl.style.display = "none";
      }

      await invalidateMapsHard();
      fitToImage();
      await invalidateMapsHard();
      
      // INITIALIZE TO MIDDLE!
      initializeToMiddle();
      
      syncLens();

      // Clamp horizontal drift
      if (maxDrift >= 0) {
        mainMap.on("move", clampHorizontal);
        clampHorizontal();
      }

      rebuildRegions();
      closeDrawer(ui);
      ui.drawerTitleEl.textContent = "Region";
      ui.drawerContentEl.innerHTML = "";
      ui.drawerContentEl.appendChild(el("div", { class: "cc-muted" }, ["Click a region to view details."]));

      // Scroller + syncing
      bindScrollersOnce();
      updateKnobsFromMap();

      mainMap.on("move", () => {
        updateKnobsFromMap();
        syncLens();
      });
      mainMap.on("zoom", () => {
        updateKnobsFromMap();
        syncLens();
      });

      if (lensMap) {
        mainMap.on("move", syncLens);
        mainMap.on("zoom", syncLens);
      }

      // On resize
      window.addEventListener("resize", rafThrottle(async () => {
        enforceBaseMapSize();
        await invalidateMapsHard();
        fitToImage();
        await invalidateMapsHard();
        syncLens();
      }));
    }

    ui.btnReload.addEventListener("click", () => loadAll().catch((e) => console.error(e)));
    ui.btnFit.addEventListener("click", () => {
      fitToImage();
      initializeToMiddle();
    });

    await loadAll();

    const api = {
      reload: async () => await loadAll(),
      fit: () => {
        fitToImage();
        initializeToMiddle();
      },
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
        if (on && lensMap) syncLens();
      }
    };

    root._ccApi = api;
    return api;
  }

  // Export
  window.CC_CanyonMap = { mount };

  console.log("✅ cc_canyon_map_app.js loaded: CC_CanyonMap.mount ready");
})();
