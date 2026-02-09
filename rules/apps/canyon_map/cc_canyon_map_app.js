/* File: rules/apps/canyon_map/cc_canyon_map_app.js
   Coffin Canyon — Canyon Map (read-only v1)
   ODOO CSP-SAFE + FIXED LENS COORDS + EDGE-ONLY DISTORTION + 2-AXIS SCROLLERS + HEAVY EASING

   FIXES INCLUDED (no omissions):
   - Removes leaflet sourcemap warnings (leaflet.js.map)
   - Main map uses SMALL image + SMALL bounds
   - Lens uses LARGE image BUT rendered into SMALL bounds => coordinates match (crisp, aligned)
   - Lens consists of two Leaflet maps: sharp base + warp overlay (edge-only via CSS mask)
   - Vertical + horizontal knobs move with easing (heavy “weight”)
   - Knob movement never “resets”; both knobs share the same target center
   - First scroll no “backwards” jump: target initialized to current center
   - Region click drawer restored
*/

(function () {
  const APP_ID = "canyon_map";

  const DEFAULTS = {
    title: "Coffin Canyon — Canyon Map",
    mapUrl: "https://raw.githubusercontent.com/steamcrow/coffin/main/rules/apps/canyon_map/data/canyon_map.json",
    stateUrl: "https://raw.githubusercontent.com/steamcrow/coffin/main/rules/apps/canyon_map/data/canyon_state.json",
    appCssUrl: "https://raw.githubusercontent.com/steamcrow/coffin/main/rules/apps/canyon_map/cc_canyon_map.css",
    leafletCssUrl: "https://raw.githubusercontent.com/steamcrow/coffin/main/rules/vendor/leaflet/leaflet.css",
    leafletJsUrl: "https://raw.githubusercontent.com/steamcrow/coffin/main/rules/vendor/leaflet/leaflet.js",

    baseMapHeightPx: 640,
    baseMapMaxHeightVh: 70,

    allowMapDrag: true,

    lensEnabled: true,

    // You requested: "make the top lens map smaller"
    // Lower zoom offset = less zoom = smaller magnification but still crisp due to large image.
    lensZoomOffset: 1, // try 1; set to 0 for even smaller; 2 for bigger

    // Warp tuning (JS controls filter strength; CSS masks it to edges)
    warpEnabled: true,
    warpBaseFrequency: 0.010,
    warpScaleDesktop: 22,
    warpScaleIOS: 14,

    // HEAVY EASING: lower numbers = heavier/longer slide
    mapEase: 0.045,
    knobEase: 0.10,
    settleFrames: 90,
    minCenterDeltaPx: 0.04,

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

  function clamp(n, min, max) { return Math.max(min, Math.min(max, n)); }

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

  function nextFrame() { return new Promise((r) => requestAnimationFrame(r)); }

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

  function isIOSDevice() {
    return (
      /iPad|iPhone|iPod/.test(navigator.userAgent) ||
      (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
    );
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

    let code = await fetchText(url);

    // Remove sourcemap reference so console doesn't spam: "Could not resolve map url: leaflet.js.map"
    code = code.replace(/\/\/# sourceMappingURL=.*$/gm, "");

    const blob = new Blob([code], { type: "text/javascript" });
    const blobUrl = URL.createObjectURL(blob);
    await new Promise((resolve, reject) => {
      const s = document.createElement("script");
      s.src = blobUrl;
      s.onload = () => { URL.revokeObjectURL(blobUrl); resolve(); };
      s.onerror = () => { URL.revokeObjectURL(blobUrl); reject(new Error("Script failed: " + url)); };
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
      .map((p) => [p.y, p.x]); // CRS.Simple uses [y,x]
  }

  function validateMapDoc(doc) {
    if (!doc || doc.schema_id !== "cc_canyon_map") return "schema_id must be cc_canyon_map";
    if (!doc.map?.background?.image_key) return "map.background.image_key missing";
    if (!doc.map.background.image_pixel_size) return "map.background.image_pixel_size missing";
    if (!doc.map?.lens?.image_key) return "map.lens.image_key missing";
    if (!Array.isArray(doc.regions)) return "regions must be array";
    return null;
  }

  function validateStateDoc(doc) {
    if (!doc || doc.schema_id !== "cc_canyon_state") return "schema_id must be cc_canyon_state";
    if (!doc.state_by_region || typeof doc.state_by_region !== "object") return "state_by_region missing";
    return null;
  }

  // ---------------------------
  // UI - buildLayout
  // ---------------------------
  function buildLayout(root, opts) {
    root.innerHTML = "";
    root.classList.add("cc-canyon-map");

    const ios = isIOSDevice();
    if (ios) root.classList.add("cc-ios");

    const header = el("div", { class: "cc-cm-header" }, [
      el("div", { class: "cc-cm-title" }, [opts.title]),
      el("div", { class: "cc-cm-actions" }, [
        el("button", { class: "cc-btn", type: "button", id: "cc-cm-reload" }, ["Reload"]),
        el("button", { class: "cc-btn", type: "button", id: "cc-cm-fit" }, ["Fit"])
      ])
    ]);

    // Base map
    const mapEl = el("div", { id: "cc-cm-map", class: "cc-cm-map" });

    // SVG filter for warp (edge overlay only)
    const lensSvg = el("svg", {
      style: "position:absolute; width:0; height:0; overflow:hidden;",
      "aria-hidden": "true"
    });

    // Lens: 2 leaflet containers inside (sharp + warp overlay)
    const lens = el("div", { class: "cc-lens", id: "cc-lens" }, [
      el("div", { class: "cc-lens-inner", id: "cc-lens-inner" }, [
        el("div", { class: "cc-lens-map", id: "cc-lens-map" }),
        el("div", { class: "cc-lens-map", id: "cc-lens-map-warp" })
      ]),
      el("div", { class: "cc-lens-glare" })
    ]);

    const frameOverlay = el("div", { class: "cc-frame-overlay", id: "cc-frame" });

    // Vertical scroller (right)
    const scrollerVertical = el("div", { id: "cc-scroll-vertical" }, [
      el("div", { class: "cc-scroll-track" }),
      el("div", { class: "cc-scroll-knob", id: "cc-scroll-knob-v" })
    ]);

    // Horizontal scroller (bottom)
    const scrollerHorizontal = el("div", { id: "cc-scroll-horizontal" }, [
      el("div", { class: "cc-scroll-track" }),
      el("div", { class: "cc-scroll-knob", id: "cc-scroll-knob-h" })
    ]);

    const body = el("div", { class: "cc-cm-body cc-cm-body--lens" }, [
      lensSvg,
      el("div", { class: "cc-cm-mapwrap" }, [
        mapEl,
        lens,
        frameOverlay,
        scrollerVertical,
        scrollerHorizontal
      ]),
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
      ios,
      lensSvgEl: lensSvg,
      mapEl,
      lensMapEl: root.querySelector("#cc-lens-map"),
      lensWarpEl: root.querySelector("#cc-lens-map-warp"),
      btnReload: root.querySelector("#cc-cm-reload"),
      btnFit: root.querySelector("#cc-cm-fit"),
      drawerEl: root.querySelector("#cc-cm-drawer"),
      drawerTitleEl: root.querySelector("#cc-cm-drawer-title"),
      drawerContentEl: root.querySelector("#cc-cm-drawer-content"),
      scrollVEl: root.querySelector("#cc-scroll-vertical"),
      knobVEl: root.querySelector("#cc-scroll-knob-v"),
      scrollHEl: root.querySelector("#cc-scroll-horizontal"),
      knobHEl: root.querySelector("#cc-scroll-knob-h")
    };
  }

  // ---------------------------
  // Drawer logic
  // ---------------------------
  function openDrawer(ui) { ui.drawerEl.classList.add("open"); }
  function closeDrawer(ui) { ui.drawerEl.classList.remove("open"); }

  function renderDrawer(ui, region, stateForRegion) {
    ui.drawerTitleEl.textContent = region?.name || "Region";
    const nodes = [];

    if (region?.description) {
      nodes.push(el("div", { class: "cc-block" }, [region.description]));
    }

    nodes.push(el("div", { class: "cc-block" }, [
      el("div", { class: "cc-h" }, ["State"]),
      el("div", {}, [`Controller: ${stateForRegion?.controller_faction_id || "neutral"}`]),
      el("div", {}, [`Status: ${stateForRegion?.status || "neutral"}`])
    ]));

    ui.drawerContentEl.innerHTML = "";
    nodes.forEach((n) => ui.drawerContentEl.appendChild(n));
  }

  // ---------------------------
  // Main mount
  // ---------------------------
  async function mount(root, userOpts) {
    const opts = { ...DEFAULTS, ...(userOpts || {}) };

    if (opts.appCssUrl) await loadCssTextOnce(opts.appCssUrl, "cc_canyon_map_css");
    await ensureLeaflet(opts);

    const ui = buildLayout(root, opts);

    // Warp filter defs (scale reduced on iOS)
    const warpScale = ui.ios ? opts.warpScaleIOS : opts.warpScaleDesktop;
    if (opts.warpEnabled) {
      ui.lensSvgEl.innerHTML = `
        <defs>
          <filter id="ccLensWarp">
            <feTurbulence type="fractalNoise" baseFrequency="${opts.warpBaseFrequency}" numOctaves="1" seed="2" result="noise" />
            <feDisplacementMap in="SourceGraphic" in2="noise" scale="${warpScale}" xChannelSelector="R" yChannelSelector="G" />
          </filter>
        </defs>
      `;
    } else {
      ui.lensSvgEl.innerHTML = `<defs></defs>`;
    }

    let mapDoc = null, stateDoc = null;
    let mainMap = null, lensSharp = null, lensWarp = null;

    const regionLayersById = {};
    const regionsById = {};

    // Shared targets (prevents “reset” between knobs)
    let targetLat = 0;
    let targetLng = 0;

    // Smoothed knob display values
    let knobTV = 0, knobTH = 0;
    let knobTargetTV = 0, knobTargetTH = 0;

    // Animation
    let rafId = 0;
    let animating = false;
    let draggingKnob = false;
    let settle = 0;

    function stopAnim() {
      if (rafId) cancelAnimationFrame(rafId);
      rafId = 0;
      animating = false;
    }

    function ensureAnim() {
      if (animating) return;
      animating = true;
      tick();
    }

    function enforceBaseMapSize() {
      if (!mapDoc) return;
      const px = mapDoc.map.background.image_pixel_size;
      const vh = window.innerHeight || 900;
      const h = clamp(opts.baseMapHeightPx, 320, Math.floor(opts.baseMapMaxHeightVh * vh / 100));
      ui.mapEl.style.height = h + "px";
      ui.mapEl.style.width = Math.round(h * (px.w / px.h)) + "px";
    }

    const syncLens = rafThrottle(() => {
      if (!opts.lensEnabled || !mainMap || !lensSharp || !lensWarp) return;
      const c = mainMap.getCenter();
      const z = mainMap.getZoom() + opts.lensZoomOffset;
      lensSharp.setView(c, z, { animate: false });
      lensWarp.setView(c, z, { animate: false });
    });

    async function invalidateMapsHard() {
      await nextFrame();
      if (mainMap) mainMap.invalidateSize({ animate: false });
      if (lensSharp) lensSharp.invalidateSize({ animate: false });
      if (lensWarp) lensWarp.invalidateSize({ animate: false });
    }

    function setVerticalKnobFromT(t) {
      const trackEl = ui.scrollVEl;
      const knobEl = ui.knobVEl;
      if (!trackEl || !knobEl) return;

      const rect = trackEl.getBoundingClientRect();
      const knobH = knobEl.getBoundingClientRect().height || 140;
      const denom = Math.max(1, rect.height - knobH);
      const y = denom * clamp(t, 0, 1);
      knobEl.style.top = `${y}px`;
    }

    function setHorizontalKnobFromT(t) {
      const trackEl = ui.scrollHEl;
      const knobEl = ui.knobHEl;
      if (!trackEl || !knobEl) return;

      const rect = trackEl.getBoundingClientRect();
      const knobW = knobEl.getBoundingClientRect().width || 150;

      // We position by "center X" (because the knob is translateX(-50%))
      const minX = knobW / 2;
      const maxX = Math.max(minX, rect.width - knobW / 2);

      const x = minX + (maxX - minX) * clamp(t, 0, 1);
      knobEl.style.left = `${x}px`;
    }

    function tick() {
      rafId = requestAnimationFrame(tick);
      if (!mainMap) return;

      // Smooth knobs (heavy)
      knobTV += (knobTargetTV - knobTV) * opts.knobEase;
      knobTH += (knobTargetTH - knobTH) * opts.knobEase;
      setVerticalKnobFromT(knobTV);
      setHorizontalKnobFromT(knobTH);

      // Smooth map center (heavy)
      const c = mainMap.getCenter();
      const dLat = targetLat - c.lat;
      const dLng = targetLng - c.lng;

      const dist = Math.abs(dLat) + Math.abs(dLng);

      if (dist > opts.minCenterDeltaPx) {
        const nLat = c.lat + dLat * opts.mapEase;
        const nLng = c.lng + dLng * opts.mapEase;
        mainMap.setView([nLat, nLng], mainMap.getZoom(), { animate: false });
        syncLens();
        settle = opts.settleFrames;
        return;
      }

      if (draggingKnob) {
        syncLens();
        return;
      }

      if (settle > 0) {
        settle--;
        syncLens();
        return;
      }

      // Final snap
      mainMap.setView([targetLat, targetLng], mainMap.getZoom(), { animate: false });
      syncLens();

      stopAnim();
    }

    function buildRegionStyle(opts2, regionId, stateByRegion) {
      const st = stateByRegion[regionId] || {};
      const controller = st.controller_faction_id || "neutral";
      const status = st.status || "neutral";
      const fillColor = opts2.factionColors[controller] || "#9e9e9e";
      const statusPatch = opts2.statusStyles[status] || {};
      return { color: "rgba(255,255,255,0.45)", weight: 2, fillColor, fillOpacity: 0.18, ...statusPatch };
    }

    function rebuildRegions(bgCoordSystem) {
      if (!mainMap) return;
      Object.values(regionLayersById).forEach((l) => { try { mainMap.removeLayer(l); } catch(_) {} });

      const stateByRegion = stateDoc?.state_by_region || {};
      (mapDoc.regions || []).forEach((r) => {
        regionsById[r.region_id] = r;

        const latlngs = normalizePoints(r.shape?.points, bgCoordSystem || "image_px");
        if (!latlngs.length) return;

        const poly = window.L.polygon(latlngs, buildRegionStyle(opts, r.region_id, stateByRegion));
        poly.on("click", () => {
          renderDrawer(ui, r, stateByRegion[r.region_id]);
          openDrawer(ui);
        });
        poly.addTo(mainMap);
        regionLayersById[r.region_id] = poly;
      });
    }

    function bindVerticalScrollerOnce(bgH) {
      const trackEl = ui.scrollVEl;
      const knobEl = ui.knobVEl;
      if (!trackEl || !knobEl) return;

      const clientYToT = (clientY) => {
        const rect = trackEl.getBoundingClientRect();
        const knobH = knobEl.getBoundingClientRect().height || 140;

        const y = clamp(clientY - rect.top, 0, rect.height);
        const yClamped = clamp(y - knobH / 2, 0, Math.max(0, rect.height - knobH));
        const denom = Math.max(1, rect.height - knobH);
        return clamp(yClamped / denom, 0, 1);
      };

      const applyT = (t) => {
        // IMPORTANT: for CRS.Simple bounds [[0,0],[h,w]], y increases downward
        // So "down" should increase lat.
        knobTargetTV = t;
        targetLat = bgH * t;

        settle = opts.settleFrames;
        ensureAnim();
      };

      // click track
      trackEl.addEventListener("pointerdown", (e) => {
        if (e.target === knobEl) return;
        applyT(clientYToT(e.clientY));
      });

      // drag knob
      knobEl.addEventListener("pointerdown", (e) => {
        e.preventDefault();
        e.stopPropagation();
        draggingKnob = true;
        knobEl.classList.add("is-active");
        try { knobEl.setPointerCapture(e.pointerId); } catch (_) {}

        const onMove = (ev) => applyT(clientYToT(ev.clientY));
        const onUp = () => {
          draggingKnob = false;
          knobEl.classList.remove("is-active");
          knobEl.removeEventListener("pointermove", onMove);
          knobEl.removeEventListener("pointerup", onUp);
          knobEl.removeEventListener("pointercancel", onUp);
          settle = opts.settleFrames;
          ensureAnim();
        };

        knobEl.addEventListener("pointermove", onMove);
        knobEl.addEventListener("pointerup", onUp);
        knobEl.addEventListener("pointercancel", onUp);
      });
    }

    function bindHorizontalScrollerOnce(bgW) {
      const trackEl = ui.scrollHEl;
      const knobEl = ui.knobHEl;
      if (!trackEl || !knobEl) return;

      const clientXToT = (clientX) => {
        const rect = trackEl.getBoundingClientRect();
        const knobW = knobEl.getBoundingClientRect().width || 150;

        // center-based clamp
        const minX = knobW / 2;
        const maxX = Math.max(minX, rect.width - knobW / 2);

        const x = clamp(clientX - rect.left, minX, maxX);
        const t = (x - minX) / Math.max(1, (maxX - minX));
        return clamp(t, 0, 1);
      };

      const applyT = (t) => {
        knobTargetTH = t;
        targetLng = bgW * t;

        settle = opts.settleFrames;
        ensureAnim();
      };

      // click track
      trackEl.addEventListener("pointerdown", (e) => {
        if (e.target === knobEl) return;
        applyT(clientXToT(e.clientX));
      });

      // drag knob
      knobEl.addEventListener("pointerdown", (e) => {
        e.preventDefault();
        e.stopPropagation();
        draggingKnob = true;
        knobEl.classList.add("is-active");
        try { knobEl.setPointerCapture(e.pointerId); } catch (_) {}

        const onMove = (ev) => applyT(clientXToT(ev.clientX));
        const onUp = () => {
          draggingKnob = false;
          knobEl.classList.remove("is-active");
          knobEl.removeEventListener("pointermove", onMove);
          knobEl.removeEventListener("pointerup", onUp);
          knobEl.removeEventListener("pointercancel", onUp);
          settle = opts.settleFrames;
          ensureAnim();
        };

        knobEl.addEventListener("pointermove", onMove);
        knobEl.addEventListener("pointerup", onUp);
        knobEl.addEventListener("pointercancel", onUp);
      });
    }

    async function loadAll() {
      mapDoc = await fetchJson(opts.mapUrl);
      stateDoc = await fetchJson(opts.stateUrl);

      const mapErr = validateMapDoc(mapDoc);
      const stateErr = validateStateDoc(stateDoc);
      if (mapErr) console.warn("[CC CanyonMap] map doc validation:", mapErr);
      if (stateErr) console.warn("[CC CanyonMap] state doc validation:", stateErr);

      enforceBaseMapSize();

      // SMALL bounds define the coordinate space for BOTH maps
      const bgPx = mapDoc.map.background.image_pixel_size;
      const bgBounds = [[0, 0], [bgPx.h, bgPx.w]];
      const bgCoordSystem = mapDoc.map.background.coord_system || "image_px";

      const baseImageKey = mapDoc.map.background.image_key;
      const lensImageKey = mapDoc.map.lens.image_key;

      stopAnim();

      if (mainMap) mainMap.remove();
      if (lensSharp) lensSharp.remove();
      if (lensWarp) lensWarp.remove();

      // MAIN MAP (blurred)
      mainMap = window.L.map(ui.mapEl, {
        crs: window.L.CRS.Simple,
        attributionControl: false,
        zoomControl: false,
        dragging: !!opts.allowMapDrag,
        zoomAnimation: false,
        fadeAnimation: false,
        markerZoomAnimation: false,
        minZoom: -5,
        maxZoom: 6
      });
      window.L.imageOverlay(baseImageKey, bgBounds).addTo(mainMap);

      // LENS MAPS: use LARGE image but render to SMALL bounds => crisp + aligned
      if (opts.lensEnabled) {
        lensSharp = window.L.map(ui.lensMapEl, {
          crs: window.L.CRS.Simple,
          attributionControl: false,
          zoomControl: false,
          dragging: false,
          zoomAnimation: false,
          fadeAnimation: false,
          markerZoomAnimation: false,
          minZoom: -5,
          maxZoom: 6
        });
        lensWarp = window.L.map(ui.lensWarpEl, {
          crs: window.L.CRS.Simple,
          attributionControl: false,
          zoomControl: false,
          dragging: false,
          zoomAnimation: false,
          fadeAnimation: false,
          markerZoomAnimation: false,
          minZoom: -5,
          maxZoom: 6
        });

        // THIS is the “why is it blurry / misaligned?” fix:
        // large image (more pixels) but same bounds (same coords)
        window.L.imageOverlay(lensImageKey, bgBounds).addTo(lensSharp);
        window.L.imageOverlay(lensImageKey, bgBounds).addTo(lensWarp);
      }

      await invalidateMapsHard();

      // Fit once
      mainMap.fitBounds(bgBounds, { padding: [10, 10], animate: false });

      // Initialize targets to current center (prevents first scroll “backwards” jump)
      const c = mainMap.getCenter();
      targetLat = c.lat;
      targetLng = c.lng;

      knobTargetTV = clamp(targetLat / bgPx.h, 0, 1);
      knobTargetTH = clamp(targetLng / bgPx.w, 0, 1);
      knobTV = knobTargetTV;
      knobTH = knobTargetTH;

      setVerticalKnobFromT(knobTV);
      setHorizontalKnobFromT(knobTH);

      // Regions
      rebuildRegions(bgCoordSystem);

      // Lens sync
      if (opts.lensEnabled && lensSharp && lensWarp) {
        syncLens();
        await nextFrame();
        lensSharp.invalidateSize({ animate: false });
        lensWarp.invalidateSize({ animate: false });
      }

      // Bind scrollers (they share targetLat/targetLng)
      bindVerticalScrollerOnce(bgPx.h);
      bindHorizontalScrollerOnce(bgPx.w);

      // If user drags the map, keep knobs + lens following with weight
      mainMap.on("move", () => {
        if (draggingKnob) return;

        const cc = mainMap.getCenter();
        targetLat = cc.lat;
        targetLng = cc.lng;

        knobTargetTV = clamp(targetLat / bgPx.h, 0, 1);
        knobTargetTH = clamp(targetLng / bgPx.w, 0, 1);

        settle = opts.settleFrames;
        ensureAnim();
      });

      settle = opts.settleFrames;
      ensureAnim();
    }

    // Buttons
    ui.btnReload.addEventListener("click", loadAll);

    ui.btnFit.addEventListener("click", () => {
      if (!mapDoc || !mainMap) return;

      const bgPx = mapDoc.map.background.image_pixel_size;
      const bgBounds = [[0, 0], [bgPx.h, bgPx.w]];
      mainMap.fitBounds(bgBounds, { animate: false });

      const c = mainMap.getCenter();
      targetLat = c.lat;
      targetLng = c.lng;

      knobTargetTV = clamp(targetLat / bgPx.h, 0, 1);
      knobTargetTH = clamp(targetLng / bgPx.w, 0, 1);

      settle = opts.settleFrames;
      ensureAnim();
    });

    await loadAll();

    root._ccApi = { drawerClose: () => closeDrawer(ui) };
  }

  // Auto-mount
  const root = document.getElementById("cc-app-root");
  if (root && root.getAttribute("data-cc-app") === APP_ID) mount(root, {});

  window.CC_CanyonMap = { mount };
})();
