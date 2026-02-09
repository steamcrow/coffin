/* File: rules/apps/canyon_map/cc_canyon_map_app.js
   Coffin Canyon — Canyon Map (read-only v1)
   ODOO CSP-SAFE + FIXED MAGNIFIER LENS + VERTICAL+HORIZONTAL BLAPPO SCROLLERS
   - Bottom map fills the whole frame and is made “very large” via zoom offset
   - Lens uses LARGE image and stays crisp; distortion mainly on lens
   - Knobs move (px), with heavy easing and no axis reset
   - Strips Leaflet sourcemap line to stop leaflet.js.map console spam
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

    allowMapDrag: true,

    // Make the BASE map feel huge
    backgroundZoomOffset: 1.4,     // higher => “bigger” feeling
    backgroundMinZoom: -6,
    backgroundMaxZoom: 7,
    zoomSnap: 0.1,
    zoomDelta: 0.2,

    // Lens
    lensEnabled: true,
    lensZoomOffset: 2.2,           // magnifier strength (relative to base map)
    lensMinZoom: -6,
    lensMaxZoom: 9,

    // Distortion (mostly on lens)
    warpEnabled: true,
    warpBaseFrequency: 0.010,
    warpScale: 18,                 // increase to make distortion more detectable
    warpOctaves: 1,

    // “Heavy” easing
    easeDurationJumpMs: 720,       // track click/tap
    easeDurationDragMs: 180,       // knob drag smoothing
    easeLinearity: 0.16,           // lower = heavier
    easeMaxFPS: 60,

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

  function easeOutCubic(t) { return 1 - Math.pow(1 - t, 3); }

  // A small tween helper for “heavy” motion
  function tween({ from, to, ms, onUpdate, onDone }) {
    const start = performance.now();
    const dur = Math.max(1, ms || 1);
    let stopped = false;

    function frame(now) {
      if (stopped) return;
      const t = clamp((now - start) / dur, 0, 1);
      const e = easeOutCubic(t);
      const v = from + (to - from) * e;
      onUpdate(v, t);
      if (t < 1) requestAnimationFrame(frame);
      else onDone && onDone();
    }

    requestAnimationFrame(frame);
    return () => { stopped = true; };
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

    let code = await fetchText(url);

    // IMPORTANT: Strip sourcemap hint so browser doesn’t try to resolve leaflet.js.map from blob:
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
      .map((p) => [p.y, p.x]); // CRS.Simple uses [y,x] as [lat,lng]
  }

  function validateMapDoc(doc) {
    if (!doc || doc.schema_id !== "cc_canyon_map") return "schema_id must be cc_canyon_map";
    if (!doc.map?.background?.image_key) return "map.background.image_key missing";
    if (!doc.map.background.image_pixel_size) return "map.background.image_pixel_size missing";
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

    // iOS class for CSS fallback (warp can rasterize mushy on some iPads)
    const isIOS =
      /iPad|iPhone|iPod/.test(navigator.userAgent) ||
      (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
    if (isIOS) root.classList.add("cc-ios");

    const header = el("div", { class: "cc-cm-header" }, [
      el("div", { class: "cc-cm-title" }, [opts.title]),
      el("div", { class: "cc-cm-actions" }, [
        el("button", { class: "cc-btn", type: "button", id: "cc-cm-reload" }, ["Reload"]),
        el("button", { class: "cc-btn", type: "button", id: "cc-cm-fit" }, ["Fit"])
      ])
    ]);

    const mapEl = el("div", { id: "cc-cm-map", class: "cc-cm-map" });

    // SVG defs for lens warp
    const lensSvg = el("svg", {
      style: "position: absolute; width: 0; height: 0; overflow: hidden;",
      "aria-hidden": "true"
    });
    lensSvg.innerHTML = `<defs></defs>`;

    // Lens structure: mask -> inner -> overscan -> leaflet container
    const lens = el("div", { class: "cc-lens", id: "cc-lens" }, [
      el("div", { class: "cc-lens-inner", id: "cc-lens-inner" }, [
        el("div", { class: "cc-lens-overscan", id: "cc-lens-overscan" }, [
          el("div", { class: "cc-lens-map", id: "cc-lens-map" })
        ])
      ]),
      el("div", { class: "cc-lens-glare" })
    ]);

    const frameOverlay = el("div", { class: "cc-frame-overlay", id: "cc-frame" });

    // Vertical (right) scroller
    const scrollerV = el("div", { class: "cc-scroll-vertical", id: "cc-scroll-vertical" }, [
      el("div", { class: "cc-scroll-track" }),
      el("div", { class: "cc-scroll-knob", id: "cc-scroll-knob-v" })
    ]);

    // Horizontal (bottom) scroller
    const scrollerH = el("div", { class: "cc-scroll-horizontal", id: "cc-scroll-horizontal" }, [
      el("div", { class: "cc-scroll-track" }),
      el("div", { class: "cc-scroll-knob", id: "cc-scroll-knob-h" })
    ]);

    const body = el("div", { class: "cc-cm-body cc-cm-body--lens" }, [
      lensSvg,
      el("div", { class: "cc-cm-mapwrap" }, [
        mapEl,
        lens,
        frameOverlay,
        scrollerV,
        scrollerH
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
      mapEl,
      lensSvgEl: lensSvg,
      lensMapEl: root.querySelector("#cc-lens-map"),
      btnReload: root.querySelector("#cc-cm-reload"),
      btnFit: root.querySelector("#cc-cm-fit"),
      drawerEl: root.querySelector("#cc-cm-drawer"),
      drawerTitleEl: root.querySelector("#cc-cm-drawer-title"),
      drawerContentEl: root.querySelector("#cc-cm-drawer-content"),

      scrollVEl: scrollerV,
      knobVEl: root.querySelector("#cc-scroll-knob-v"),

      scrollHEl: scrollerH,
      knobHEl: root.querySelector("#cc-scroll-knob-h")
    };
  }

  // --- Drawer logic ---
  function openDrawer(ui) { ui.drawerEl.classList.add("open"); }
  function closeDrawer(ui) { ui.drawerEl.classList.remove("open"); }

  function renderDrawer(ui, region, stateForRegion) {
    ui.drawerTitleEl.textContent = region?.name || "Region";
    const nodes = [];
    if (region?.description) nodes.push(el("div", { class: "cc-block" }, [region.description]));
    nodes.push(el("div", { class: "cc-block" }, [
      el("div", { class: "cc-h" }, ["State"]),
      el("div", {}, [`Controller: ${stateForRegion?.controller_faction_id || "neutral"}`]),
      el("div", {}, [`Status: ${stateForRegion?.status || "neutral"}`])
    ]));
    ui.drawerContentEl.innerHTML = "";
    nodes.forEach((n) => ui.drawerContentEl.appendChild(n));
  }

  function buildRegionStyle(opts, regionId, stateByRegion) {
    const st = stateByRegion[regionId] || {};
    const controller = st.controller_faction_id || "neutral";
    const status = st.status || "neutral";
    const fillColor = opts.factionColors[controller] || "#9e9e9e";
    const statusPatch = opts.statusStyles[status] || {};
    return { color: "rgba(255,255,255,0.45)", weight: 2, fillColor, fillOpacity: 0.18, ...statusPatch };
  }

  // ---------------------------
  // Main mount
  // ---------------------------
  async function mount(root, userOpts) {
    const opts = { ...DEFAULTS, ...(userOpts || {}) };

    if (opts.appCssUrl) await loadCssTextOnce(opts.appCssUrl, "cc_canyon_map_css");
    await ensureLeaflet(opts);

    const ui = buildLayout(root, opts);

    // Build/refresh SVG warp filter
    if (opts.warpEnabled) {
      ui.lensSvgEl.innerHTML = `
        <defs>
          <filter id="ccLensWarp">
            <feTurbulence type="fractalNoise"
              baseFrequency="${opts.warpBaseFrequency}"
              numOctaves="${opts.warpOctaves}"
              seed="2"
              result="noise" />
            <feDisplacementMap in="SourceGraphic" in2="noise"
              scale="${opts.warpScale}"
              xChannelSelector="R" yChannelSelector="G" />
          </filter>
        </defs>
      `;
    } else {
      ui.lensSvgEl.innerHTML = `<defs></defs>`;
    }

    let mapDoc = null, stateDoc = null;
    let mainMap = null, lensMap = null;

    const regionLayersById = {};
    const regionsById = {};

    // Keep current scroll positions (0..1) so neither axis resets the other
    const scrollState = {
      tY: 0.5,
      tX: 0.5
    };

    // For canceling ongoing tweens
    let cancelLatTween = null;
    let cancelLngTween = null;

    // Lens sync
    const syncLens = rafThrottle(() => {
      if (!opts.lensEnabled || !mainMap || !lensMap) return;
      lensMap.setView(mainMap.getCenter(), mainMap.getZoom() + opts.lensZoomOffset, { animate: false });
    });

    function stopTweens() {
      if (cancelLatTween) { cancelLatTween(); cancelLatTween = null; }
      if (cancelLngTween) { cancelLngTween(); cancelLngTween = null; }
    }

    function rebuildRegions() {
      if (!mainMap || !mapDoc) return;
      Object.values(regionLayersById).forEach((l) => mainMap.removeLayer(l));

      const stateByRegion = stateDoc?.state_by_region || {};
      (mapDoc.regions || []).forEach((r) => {
        regionsById[r.region_id] = r;
        const latlngs = normalizePoints(r.shape?.points, mapDoc.map?.background?.coord_system || "image_px");
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

    async function invalidateMapsHard() {
      await nextFrame();
      if (mainMap) mainMap.invalidateSize({ animate: false });
      if (lensMap) lensMap.invalidateSize({ animate: false });
    }

    // Knob setters (px, clamped)
    function setVKnobFromT(t) {
      const track = ui.scrollVEl.getBoundingClientRect();
      const knob = ui.knobVEl.getBoundingClientRect();
      const denom = Math.max(1, track.height - knob.height);
      const y = denom * clamp(t, 0, 1);
      ui.knobVEl.style.top = `${y}px`;
    }

    function setHKnobFromT(t) {
      const track = ui.scrollHEl.getBoundingClientRect();
      const knob = ui.knobHEl.getBoundingClientRect();
      const denom = Math.max(1, track.width - knob.width);
      const x = denom * clamp(t, 0, 1);
      ui.knobHEl.style.left = `${x}px`;
    }

    // Heavy animated pan (keeps other axis)
    function animatePanTo({ tY, tX, durationMs }) {
      if (!mainMap || !mapDoc) return;

      const px = mapDoc.map.background.image_pixel_size;
      const targetLat = clamp(tY, 0, 1) * px.h; // IMPORTANT: no inversion => no “backwards on first scroll”
      const targetLng = clamp(tX, 0, 1) * px.w;

      const start = mainMap.getCenter();
      const startLat = start.lat;
      const startLng = start.lng;

      stopTweens();

      cancelLatTween = tween({
        from: startLat,
        to: targetLat,
        ms: durationMs,
        onUpdate: (lat) => {
          const cur = mainMap.getCenter();
          mainMap.panTo([lat, cur.lng], { animate: false });
          // keep knobs eased with map
          const tNowY = clamp(lat / px.h, 0, 1);
          setVKnobFromT(tNowY);
          syncLens();
        }
      });

      cancelLngTween = tween({
        from: startLng,
        to: targetLng,
        ms: durationMs,
        onUpdate: (lng) => {
          const cur = mainMap.getCenter();
          mainMap.panTo([cur.lat, lng], { animate: false });
          const tNowX = clamp(lng / px.w, 0, 1);
          setHKnobFromT(tNowX);
          syncLens();
        }
      });
    }

    // Pointer -> t conversion
    function vPointerToT(clientY) {
      const rect = ui.scrollVEl.getBoundingClientRect();
      const knobH = ui.knobVEl.getBoundingClientRect().height || 140;
      const y = clamp(clientY - rect.top, 0, rect.height);
      const yClamped = clamp(y - knobH / 2, 0, Math.max(0, rect.height - knobH));
      const denom = Math.max(1, rect.height - knobH);
      return clamp(yClamped / denom, 0, 1);
    }

    function hPointerToT(clientX) {
      const rect = ui.scrollHEl.getBoundingClientRect();
      const knobW = ui.knobHEl.getBoundingClientRect().width || 140;
      const x = clamp(clientX - rect.left, 0, rect.width);
      const xClamped = clamp(x - knobW / 2, 0, Math.max(0, rect.width - knobW));
      const denom = Math.max(1, rect.width - knobW);
      return clamp(xClamped / denom, 0, 1);
    }

    function bindScrollersOnce() {
      // Vertical track click
      ui.scrollVEl.addEventListener("pointerdown", (e) => {
        if (!mainMap || !mapDoc) return;
        const tY = vPointerToT(e.clientY);
        scrollState.tY = tY;
        animatePanTo({
          tY: scrollState.tY,
          tX: scrollState.tX,
          durationMs: opts.easeDurationJumpMs
        });
      });

      // Vertical knob drag
      ui.knobVEl.addEventListener("pointerdown", (e) => {
        e.preventDefault();
        e.stopPropagation();
        ui.knobVEl.classList.add("is-active");
        try { ui.knobVEl.setPointerCapture(e.pointerId); } catch (_) {}

        const onMove = (ev) => {
          if (!mainMap || !mapDoc) return;
          const tY = vPointerToT(ev.clientY);
          scrollState.tY = tY;
          // Slight smoothing (still “heavy”)
          animatePanTo({
            tY: scrollState.tY,
            tX: scrollState.tX,
            durationMs: opts.easeDurationDragMs
          });
        };

        const onUp = () => {
          ui.knobVEl.classList.remove("is-active");
          ui.knobVEl.removeEventListener("pointermove", onMove);
          ui.knobVEl.removeEventListener("pointerup", onUp);
          ui.knobVEl.removeEventListener("pointercancel", onUp);
        };

        ui.knobVEl.addEventListener("pointermove", onMove);
        ui.knobVEl.addEventListener("pointerup", onUp);
        ui.knobVEl.addEventListener("pointercancel", onUp);
      });

      // Horizontal track click
      ui.scrollHEl.addEventListener("pointerdown", (e) => {
        if (!mainMap || !mapDoc) return;
        const tX = hPointerToT(e.clientX);
        scrollState.tX = tX;
        animatePanTo({
          tY: scrollState.tY,
          tX: scrollState.tX,
          durationMs: opts.easeDurationJumpMs
        });
      });

      // Horizontal knob drag
      ui.knobHEl.addEventListener("pointerdown", (e) => {
        e.preventDefault();
        e.stopPropagation();
        ui.knobHEl.classList.add("is-active");
        try { ui.knobHEl.setPointerCapture(e.pointerId); } catch (_) {}

        const onMove = (ev) => {
          if (!mainMap || !mapDoc) return;
          const tX = hPointerToT(ev.clientX);
          scrollState.tX = tX;
          animatePanTo({
            tY: scrollState.tY,
            tX: scrollState.tX,
            durationMs: opts.easeDurationDragMs
          });
        };

        const onUp = () => {
          ui.knobHEl.classList.remove("is-active");
          ui.knobHEl.removeEventListener("pointermove", onMove);
          ui.knobHEl.removeEventListener("pointerup", onUp);
          ui.knobHEl.removeEventListener("pointercancel", onUp);
        };

        ui.knobHEl.addEventListener("pointermove", onMove);
        ui.knobHEl.addEventListener("pointerup", onUp);
        ui.knobHEl.addEventListener("pointercancel", onUp);
      });
    }

    async function loadAll() {
      mapDoc = await fetchJson(opts.mapUrl);
      stateDoc = await fetchJson(opts.stateUrl);

      const mapErr = validateMapDoc(mapDoc);
      const stateErr = validateStateDoc(stateDoc);
      if (mapErr) console.warn("[CC CanyonMap] map doc validation:", mapErr);
      if (stateErr) console.warn("[CC CanyonMap] state doc validation:", stateErr);

      const px = mapDoc.map.background.image_pixel_size;
      const bounds = [[0, 0], [px.h, px.w]];

      // Reset maps
      if (mainMap) mainMap.remove();
      if (lensMap) lensMap.remove();

      // BASE MAP (fills the whole wrapper via CSS)
      mainMap = window.L.map(ui.mapEl, {
        crs: window.L.CRS.Simple,
        attributionControl: false,
        zoomControl: false,
        dragging: !!opts.allowMapDrag,
        zoomAnimation: false,
        fadeAnimation: false,
        markerZoomAnimation: false,
        minZoom: opts.backgroundMinZoom,
        maxZoom: opts.backgroundMaxZoom,
        zoomSnap: opts.zoomSnap,
        zoomDelta: opts.zoomDelta,
        inertia: true,
        inertiaDeceleration: 1400
      });

      // Use SMALL image for background
      window.L.imageOverlay(mapDoc.map.background.image_key, bounds).addTo(mainMap);

      await invalidateMapsHard();

      // Fit + “make it huge”
      mainMap.fitBounds(bounds, { padding: [10, 10], animate: false });
      mainMap.setZoom(mainMap.getZoom() + opts.backgroundZoomOffset, { animate: false });

      // Init scroll state from map center
      const c0 = mainMap.getCenter();
      scrollState.tY = clamp(c0.lat / px.h, 0, 1);
      scrollState.tX = clamp(c0.lng / px.w, 0, 1);

      // LENS MAP (uses LARGE image if available)
      if (opts.lensEnabled) {
        lensMap = window.L.map(ui.lensMapEl, {
          crs: window.L.CRS.Simple,
          attributionControl: false,
          zoomControl: false,
          dragging: false,
          zoomAnimation: false,
          fadeAnimation: false,
          markerZoomAnimation: false,
          minZoom: opts.lensMinZoom,
          maxZoom: opts.lensMaxZoom,
          zoomSnap: opts.zoomSnap,
          zoomDelta: opts.zoomDelta
        });

        const lensImageKey = mapDoc.map?.lens?.image_key || mapDoc.map.background.image_key;

        // IMPORTANT: we still use the SAME bounds so geometry aligns,
        // but the large image has more pixels, so it looks crisp.
        window.L.imageOverlay(lensImageKey, bounds).addTo(lensMap);

        lensMap.setView(mainMap.getCenter(), mainMap.getZoom() + opts.lensZoomOffset, { animate: false });
        await nextFrame();
        lensMap.invalidateSize({ animate: false });
      }

      rebuildRegions();

      // Sync knobs to current state
      setVKnobFromT(scrollState.tY);
      setHKnobFromT(scrollState.tX);
      syncLens();
    }

    // Bind once
    bindScrollersOnce();

    ui.btnReload.addEventListener("click", async () => {
      stopTweens();
      await loadAll();
    });

    ui.btnFit.addEventListener("click", () => {
      if (!mainMap || !mapDoc) return;
      stopTweens();

      const px = mapDoc.map.background.image_pixel_size;
      const bounds = [[0, 0], [px.h, px.w]];

      mainMap.fitBounds(bounds, { animate: false });
      mainMap.setZoom(mainMap.getZoom() + opts.backgroundZoomOffset, { animate: false });

      // update scroll state + knobs
      const c = mainMap.getCenter();
      scrollState.tY = clamp(c.lat / px.h, 0, 1);
      scrollState.tX = clamp(c.lng / px.w, 0, 1);

      setVKnobFromT(scrollState.tY);
      setHKnobFromT(scrollState.tX);
      syncLens();
    });

    await loadAll();

    root._ccApi = { drawerClose: () => closeDrawer(ui) };
  }

  // Auto-mount
  const root = document.getElementById("cc-app-root");
  if (root && root.getAttribute("data-cc-app") === APP_ID) mount(root, {});

  window.CC_CanyonMap = { mount };
})();
