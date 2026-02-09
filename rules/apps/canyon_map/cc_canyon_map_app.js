/* File: rules/apps/canyon_map/cc_canyon_map_app.js
   Coffin Canyon — Canyon Map (read-only v1)
   ODOO CSP-SAFE + FIXED MAGNIFIER LENS + VERTICAL SCROLLER KNOB + HORIZONTAL SCROLLER + SVG DISTORTION (LENS-ONLY)

   FIXES IN THIS VERSION:
   1) Removes Leaflet sourcemap noise from blob loads (strips //# sourceMappingURL=leaflet.js.map)
      -> prevents: "Could not resolve map url: leaflet.js.map" spam.
   2) Lens alignment + “no gaps”: lens container + lens-map overscan is driven by CSS vars
      and set from JS (no pre-init style hacking that breaks Leaflet sizing).
   3) Lens sharpness: no CSS scaling of lens; lens uses a separate image key if provided.
      If mapDoc.map.lens.image_pixel_size exists, bounds are correct for the lens image.
   4) Vertical + Horizontal scrollers are pointer-event safe and never “stick”.
      - Uses pointer capture safely
      - Stops propagation so Leaflet drag doesn’t steal events
      - Click track jumps knob + map
      - Drag knob updates map
   5) Distortion is applied ONLY to lens (via filter id ccLensWarp).
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

    // Optional: nudge background zoom after fit
    backgroundZoomOffset: 2,

    lensEnabled: true,
    // Magnification is achieved by Leaflet zoom offset (NOT CSS scale)
    lensZoomOffset: 3,
    lensWidthPx: 638,
    lensHeightPx: 438,

    // Lens-only warp (SVG filter)
    warpEnabled: true,
    warpBaseFrequency: 0.008,
    warpScale: 16,

    // Lens overscan (hides edges under frame)
    // These are fed into CSS vars: --lens-overscan-x / --lens-overscan-y
    lensOverscanX: 60,
    lensOverscanY: 60,

    // Map interaction
    lockHorizontalPan: false, // not used in this build (you now have horizontal scroller)
    maxHorizontalDriftPx: 260, // legacy
    allowMapDrag: true,

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

  // IMPORTANT: strip sourcemap directives so blob URLs don't spam "leaflet.js.map" errors
  function stripSourceMapDirectives(code) {
    // Covers common patterns:
    //   //# sourceMappingURL=leaflet.js.map
    //   //@ sourceMappingURL=...
    return String(code)
      .replace(/\/\/#\s*sourceMappingURL=.*$/gm, "")
      .replace(/\/\/@\s*sourceMappingURL=.*$/gm, "");
  }

  async function loadScriptViaBlobOnce(url, key) {
    const k = key || url;
    if (_loaded.js.has(k)) return;

    let code = await fetchText(url);
    code = stripSourceMapDirectives(code);

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
      .map((p) => [p.y, p.x]); // Leaflet CRS.Simple uses [y,x] as [lat,lng]
  }

  function validateMapDoc(doc) {
    if (!doc || doc.schema_id !== "cc_canyon_map") return "schema_id must be cc_canyon_map";
    if (!doc.map?.background?.image_key) return "map.background.image_key missing";
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
  // UI - buildLayout
  // ---------------------------
  function buildLayout(root, opts) {
    root.innerHTML = "";
    root.classList.add("cc-canyon-map");

    // iOS class (lets CSS disable warp if needed)
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

    // SVG defs for lens-only distortion
    const lensSvg = el("svg", {
      style: "position: absolute; width: 0; height: 0; overflow: hidden;",
      "aria-hidden": "true"
    });

    const lens = el("div", { class: "cc-lens", id: "cc-lens" }, [
      el("div", { class: "cc-lens-inner", id: "cc-lens-inner" }, [
        el("div", { class: "cc-lens-map", id: "cc-lens-map" })
      ]),
      el("div", { class: "cc-lens-glare" })
    ]);

    const frameOverlay = el("div", { class: "cc-frame-overlay", id: "cc-frame" });

    // Vertical scroller (right side)
    const scrollerVertical = el("div", { class: "cc-scroll cc-scroll-vertical", id: "cc-scroll-vertical" }, [
      el("div", { class: "cc-scroll-track" }),
      el("div", { class: "cc-scroll-knob", id: "cc-scroll-knob-v" })
    ]);

    // Horizontal scroller (bottom) — uses simple structure (style should be in CSS if you want it pretty)
    const scrollerHorizontal = el("div", { class: "cc-scroll cc-scroll-horizontal", id: "cc-scroll-horizontal" }, [
      el("div", { class: "cc-scroll-track" }),
      el("div", { class: "cc-scroll-knob", id: "cc-scroll-knob-h" })
    ]);

    // Minimal inline placement for horizontal scroller so it appears even if CSS isn’t updated yet
    scrollerHorizontal.style.position = "absolute";
    scrollerHorizontal.style.left = "80px";
    scrollerHorizontal.style.right = "80px";
    scrollerHorizontal.style.bottom = "18px";
    scrollerHorizontal.style.height = "46px";
    scrollerHorizontal.style.zIndex = "60";
    scrollerHorizontal.style.pointerEvents = "auto";

    // Minimal inline skin for horizontal track + knob (you can move to CSS later)
    const hTrack = scrollerHorizontal.querySelector(".cc-scroll-track");
    const hKnob = scrollerHorizontal.querySelector("#cc-scroll-knob-h");
    if (hTrack) {
      hTrack.style.position = "absolute";
      hTrack.style.inset = "0";
      hTrack.style.borderRadius = "23px";
      hTrack.style.background = "rgba(0,0,0,0.25)";
      hTrack.style.border = "1px solid rgba(255,255,255,0.18)";
      hTrack.style.boxShadow = "inset 0 2px 10px rgba(0,0,0,0.6)";
    }
    if (hKnob) {
      hKnob.style.position = "absolute";
      hKnob.style.left = "0px"; // JS will update
      hKnob.style.top = "50%";
      hKnob.style.transform = "translateY(-50%)";
      hKnob.style.width = "140px";
      hKnob.style.height = "38px";
      hKnob.style.borderRadius = "18px";
      hKnob.style.cursor = "grab";
      hKnob.style.background = "rgba(255,255,255,0.12)";
      hKnob.style.border = "1px solid rgba(255,255,255,0.25)";
      hKnob.style.boxShadow = "0 6px 14px rgba(0,0,0,0.35), inset 0 1px 1px rgba(255,255,255,0.10)";
      hKnob.style.touchAction = "none";
      hKnob.style.userSelect = "none";
      hKnob.style.webkitUserSelect = "none";
    }

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

    // Feed sizing into CSS vars (your CSS uses these)
    lens.style.setProperty("--lens-w", `${opts.lensWidthPx}px`);
    lens.style.setProperty("--lens-h", `${opts.lensHeightPx}px`);
    lens.style.setProperty("--lens-overscan-x", `${Number(opts.lensOverscanX || 0)}px`);
    lens.style.setProperty("--lens-overscan-y", `${Number(opts.lensOverscanY || 0)}px`);

    return {
      mapEl,
      lensEl: lens,
      lensMapEl: root.querySelector("#cc-lens-map"),
      lensSvgEl: lensSvg,
      frameEl: frameOverlay,

      btnReload: root.querySelector("#cc-cm-reload"),
      btnFit: root.querySelector("#cc-cm-fit"),

      drawerEl: root.querySelector("#cc-cm-drawer"),
      drawerTitleEl: root.querySelector("#cc-cm-drawer-title"),
      drawerContentEl: root.querySelector("#cc-cm-drawer-content"),

      scrollElVertical: scrollerVertical,
      knobElVertical: root.querySelector("#cc-scroll-knob-v"),

      scrollElHorizontal: scrollerHorizontal,
      knobElHorizontal: root.querySelector("#cc-scroll-knob-h")
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

    // Build / update lens filter defs
    if (opts.warpEnabled) {
      ui.lensSvgEl.innerHTML = `
        <defs>
          <filter id="ccLensWarp">
            <feTurbulence type="fractalNoise" baseFrequency="${opts.warpBaseFrequency}" numOctaves="1" seed="2" result="noise" />
            <feDisplacementMap in="SourceGraphic" in2="noise" scale="${opts.warpScale}" xChannelSelector="R" yChannelSelector="G" />
          </filter>
        </defs>
      `;
    } else {
      ui.lensSvgEl.innerHTML = `<defs></defs>`;
    }

    let mapDoc = null, stateDoc = null;
    let mainMap = null, lensMap = null;
    const regionLayersById = {}, regionsById = {};
    let _onMoveZoom = null;

    // Scroller refs
    const vScroll = {
      bound: false,
      trackEl: ui.scrollElVertical,
      knobEl: ui.knobElVertical,
      setKnobFromT: null
    };

    const hScroll = {
      bound: false,
      trackEl: ui.scrollElHorizontal,
      knobEl: ui.knobElHorizontal,
      setKnobFromT: null
    };

    function enforceBaseMapSize() {
      if (!mapDoc) return;
      const px = mapDoc.map.background.image_pixel_size;
      const vh = window.innerHeight || 900;
      const h = clamp(opts.baseMapHeightPx, 320, Math.floor(opts.baseMapMaxHeightVh * vh / 100));
      ui.mapEl.style.height = h + "px";
      ui.mapEl.style.width = Math.round(h * (px.w / px.h)) + "px";
    }

    const syncLens = rafThrottle(() => {
      if (!opts.lensEnabled || !mainMap || !lensMap) return;
      lensMap.setView(mainMap.getCenter(), mainMap.getZoom() + opts.lensZoomOffset, { animate: false });
    });

    function rebuildRegions() {
      if (!mainMap) return;
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

    // ---------------------------
    // Scroller binding helpers
    // ---------------------------
    function bindVerticalScrollerOnce(px) {
      if (vScroll.bound) return;
      vScroll.bound = true;

      const trackEl = vScroll.trackEl;
      const knobEl = vScroll.knobEl;

      function getTrackRect() { return trackEl.getBoundingClientRect(); }
      function getKnobH() { return knobEl.getBoundingClientRect().height || 140; }

      function pxToT(clientY) {
        const rect = getTrackRect();
        const knobH = getKnobH();

        const y = clamp(clientY - rect.top, 0, rect.height);
        const yClamped = clamp(y - knobH / 2, 0, Math.max(0, rect.height - knobH));
        const denom = Math.max(1, rect.height - knobH);
        const t = clamp(yClamped / denom, 0, 1);

        return { t, yClamped };
      }

      function setKnobFromT(t) {
        const rect = getTrackRect();
        const knobH = getKnobH();
        const denom = Math.max(1, rect.height - knobH);
        const y = denom * clamp(t, 0, 1);
        knobEl.style.top = `${y}px`;
      }

      function panMapFromT(t) {
        if (!mainMap) return;
        const lat = px.h * (1 - t);     // t=0 top, t=1 bottom
        const currentLng = mainMap.getCenter().lng;
        mainMap.panTo([lat, currentLng], { animate: false });
      }

      vScroll.setKnobFromT = setKnobFromT;

      // Click/tap on track jumps
      trackEl.addEventListener("pointerdown", (e) => {
        if (!mainMap) return;
        // Ignore if clicking knob (knob has its own handler)
        if (e.target === knobEl) return;

        const { t, yClamped } = pxToT(e.clientY);
        knobEl.style.top = `${yClamped}px`;
        panMapFromT(t);
      });

      // Drag knob
      knobEl.addEventListener("pointerdown", (e) => {
        if (!mainMap) return;
        e.preventDefault();
        e.stopPropagation();

        knobEl.classList.add("is-active");
        try { knobEl.setPointerCapture(e.pointerId); } catch (_) {}

        const onMove = (ev) => {
          const { t, yClamped } = pxToT(ev.clientY);
          knobEl.style.top = `${yClamped}px`;
          panMapFromT(t);
        };

        const onUp = () => {
          knobEl.classList.remove("is-active");
          knobEl.removeEventListener("pointermove", onMove);
          knobEl.removeEventListener("pointerup", onUp);
          knobEl.removeEventListener("pointercancel", onUp);
        };

        knobEl.addEventListener("pointermove", onMove);
        knobEl.addEventListener("pointerup", onUp);
        knobEl.addEventListener("pointercancel", onUp);
      });
    }

    function bindHorizontalScrollerOnce(px) {
      if (hScroll.bound) return;
      hScroll.bound = true;

      const trackEl = hScroll.trackEl;
      const knobEl = hScroll.knobEl;

      function getTrackRect() { return trackEl.getBoundingClientRect(); }
      function getKnobW() { return knobEl.getBoundingClientRect().width || 140; }

      function pxToT(clientX) {
        const rect = getTrackRect();
        const knobW = getKnobW();

        const x = clamp(clientX - rect.left, 0, rect.width);
        const xClamped = clamp(x - knobW / 2, 0, Math.max(0, rect.width - knobW));
        const denom = Math.max(1, rect.width - knobW);
        const t = clamp(xClamped / denom, 0, 1);

        return { t, xClamped };
      }

      function setKnobFromT(t) {
        const rect = getTrackRect();
        const knobW = getKnobW();
        const denom = Math.max(1, rect.width - knobW);
        const x = denom * clamp(t, 0, 1);
        knobEl.style.left = `${x}px`;
      }

      function panMapFromT(t) {
        if (!mainMap) return;
        const lng = px.w * t;           // t=0 left, t=1 right
        const currentLat = mainMap.getCenter().lat;
        mainMap.panTo([currentLat, lng], { animate: false });
      }

      hScroll.setKnobFromT = setKnobFromT;

      // Click/tap on track jumps
      trackEl.addEventListener("pointerdown", (e) => {
        if (!mainMap) return;
        if (e.target === knobEl) return;

        const { t, xClamped } = pxToT(e.clientX);
        knobEl.style.left = `${xClamped}px`;
        panMapFromT(t);
      });

      // Drag knob
      knobEl.addEventListener("pointerdown", (e) => {
        if (!mainMap) return;
        e.preventDefault();
        e.stopPropagation();

        knobEl.classList.add("is-active");
        knobEl.style.cursor = "grabbing";
        try { knobEl.setPointerCapture(e.pointerId); } catch (_) {}

        const onMove = (ev) => {
          const { t, xClamped } = pxToT(ev.clientX);
          knobEl.style.left = `${xClamped}px`;
          panMapFromT(t);
        };

        const onUp = () => {
          knobEl.classList.remove("is-active");
          knobEl.style.cursor = "grab";
          knobEl.removeEventListener("pointermove", onMove);
          knobEl.removeEventListener("pointerup", onUp);
          knobEl.removeEventListener("pointercancel", onUp);
        };

        knobEl.addEventListener("pointermove", onMove);
        knobEl.addEventListener("pointerup", onUp);
        knobEl.addEventListener("pointercancel", onUp);
      });
    }

    // ---------------------------
    // loadAll
    // ---------------------------
    async function loadAll() {
      mapDoc = await fetchJson(opts.mapUrl);
      stateDoc = await fetchJson(opts.stateUrl);

      const mapErr = validateMapDoc(mapDoc);
      const stateErr = validateStateDoc(stateDoc);
      if (mapErr) console.warn("[CC CanyonMap] map doc validation:", mapErr);
      if (stateErr) console.warn("[CC CanyonMap] state doc validation:", stateErr);

      enforceBaseMapSize();

      // Background image (base map)
      const bgPx = mapDoc.map.background.image_pixel_size;
      const bgBounds = [[0, 0], [bgPx.h, bgPx.w]];

      // Lens image (magnified map) — allow different resolution + bounds
      const lensImageKey = mapDoc.map.lens?.image_key || mapDoc.map.background.image_key;
      const lensPx = mapDoc.map.lens?.image_pixel_size || bgPx;
      const lensBounds = [[0, 0], [lensPx.h, lensPx.w]];

      // Tear down
      if (mainMap) mainMap.remove();
      if (lensMap) lensMap.remove();

      // Create main map
      mainMap = window.L.map(ui.mapEl, {
        crs: window.L.CRS.Simple,
        attributionControl: false,
        zoomControl: false,
        dragging: !!opts.allowMapDrag,

        zoomAnimation: false,
        fadeAnimation: false,
        markerZoomAnimation: false,

        // Helps avoid weird snapping on CRS.Simple when zoom offsets are used
        zoomSnap: 0,
        zoomDelta: 0.25,

        minZoom: -5,
        maxZoom: 6
      });

      window.L.imageOverlay(mapDoc.map.background.image_key, bgBounds).addTo(mainMap);

      // Create lens map
      if (opts.lensEnabled) {
        lensMap = window.L.map(ui.lensMapEl, {
          crs: window.L.CRS.Simple,
          attributionControl: false,
          zoomControl: false,
          dragging: false,

          zoomAnimation: false,
          fadeAnimation: false,
          markerZoomAnimation: false,

          zoomSnap: 0,
          zoomDelta: 0.25,

          minZoom: -5,
          maxZoom: 6
        });

        window.L.imageOverlay(lensImageKey, lensBounds).addTo(lensMap);
      }

      await invalidateMapsHard();

      // Fit to background bounds, then zoom offset (background only)
      mainMap.fitBounds(bgBounds, { padding: [10, 10], animate: false });
      if (Number(opts.backgroundZoomOffset || 0) !== 0) {
        mainMap.setZoom(mainMap.getZoom() + Number(opts.backgroundZoomOffset || 0), { animate: false });
      }

      // Ensure lens view matches center/zoom (+ offset)
      if (opts.lensEnabled && lensMap) {
        // IMPORTANT: lens bounds may differ; setView uses CRS coords, so center works fine.
        lensMap.setView(mainMap.getCenter(), mainMap.getZoom() + Number(opts.lensZoomOffset || 0), { animate: false });
        await nextFrame();
        lensMap.invalidateSize({ animate: false });
      }

      rebuildRegions();

      // Bind scrollers (needs bgPx for mapping t->coords)
      bindVerticalScrollerOnce(bgPx);
      bindHorizontalScrollerOnce(bgPx);

      // Keep knobs in sync with map movement (AND keep lens synced)
      if (_onMoveZoom) {
        try { mainMap.off("move zoom", _onMoveZoom); } catch (_) {}
      }

      _onMoveZoom = () => {
        if (!mainMap) return;

        // Vertical knob: map center lat => t (0..1)
        const tV = clamp(1 - (mainMap.getCenter().lat / bgPx.h), 0, 1);
        if (vScroll.setKnobFromT) vScroll.setKnobFromT(tV);

        // Horizontal knob: map center lng => t (0..1)
        const tH = clamp(mainMap.getCenter().lng / bgPx.w, 0, 1);
        if (hScroll.setKnobFromT) hScroll.setKnobFromT(tH);

        syncLens();
      };

      mainMap.on("move zoom", _onMoveZoom);
      _onMoveZoom(); // initial sync
    }

    ui.btnReload.addEventListener("click", loadAll);

    ui.btnFit.addEventListener("click", () => {
      if (!mapDoc || !mainMap) return;
      const px = mapDoc.map.background.image_pixel_size;
      const bounds = [[0, 0], [px.h, px.w]];
      mainMap.fitBounds(bounds, { animate: false });
      if (Number(opts.backgroundZoomOffset || 0) !== 0) {
        mainMap.setZoom(mainMap.getZoom() + Number(opts.backgroundZoomOffset || 0), { animate: false });
      }
    });

    await loadAll();

    root._ccApi = { drawerClose: () => closeDrawer(ui) };
  }

  // Auto-mount
  const root = document.getElementById("cc-app-root");
  if (root && root.getAttribute("data-cc-app") === APP_ID) mount(root, {});

  window.CC_CanyonMap = { mount };
})();
