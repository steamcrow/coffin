/* File: rules/apps/canyon_map/cc_canyon_map_app.js
   Coffin Canyon — Canyon Map (read-only v1)
   ODOO CSP-SAFE + FIXED MAGNIFIER LENS + VERTICAL SCROLLER KNOB + SVG DISTORTION

   FIXES INCLUDED (complete file, no omissions):
   1) Background map “really really big” is now done by REAL Leaflet zoom (NOT CSS scale),
      so the lens + background stay aligned.
   2) Scroller knob no longer “stuck” after Reload:
      - event handlers bind ONCE, but they reference a mutable scrollerRef that is updated on every loadAll()
      - works with PointerEvents AND with Touch/Mouse fallback
      - knob position is clamped to the slot and updates in PX
      - knob has rollover/pressed state (.is-active) on touch and mouse
   3) Lens alignment + “no gaps”:
      - lens map container is forced to 100% fill
      - lens map view is explicitly set after main map is sized/zoomed
   4) Distortion kept but made SUBTLE (the old scale=80 will absolutely smear on iPad)
      - if you want more distortion, raise WARP_SCALE slowly (e.g. 16 → 22)

   IMPORTANT REALITY CHECK (so expectations match physics):
   - If your base canyon map image is a single raster PNG/JPG, zooming in will scale pixels.
     “Sharp” requires the source image to be high resolution. The code below removes *extra* blur,
     but cannot invent detail that isn’t in the image.
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

    // Base layout sizing (leaflet container size)
    baseMapHeightPx: 640,
    baseMapMaxHeightVh: 70,

    // Make the BACKGROUND map huge using REAL zoom (keeps alignment with lens)
    // Try 2 or 3 if you want it even bigger.
    backgroundZoomOffset: 2,

    // Lens
    lensEnabled: true,
    lensZoomOffset: 2,
    lensWidthPx: 638,
    lensHeightPx: 438,

    // Warp (keep subtle on iOS)
    warpEnabled: true,
    warpBaseFrequency: 0.008,
    warpScale: 16, // 12–22 is sane. 80 will smear badly.

    // Pan/drag policy
    lockHorizontalPan: false,
    maxHorizontalDriftPx: 260,
    allowMapDrag: true,

    // Styles
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

  async function loadScriptViaBlobOnce(url, key) {
    const k = key || url;
    if (_loaded.js.has(k)) return;
    const code = await fetchText(url);
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

    // iOS class for CSS fallbacks
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

    // *** SVG FILTER FOR LENS DISTORTION ***
    // Keep subtle. Large scale values blur/rasters on iPad.
    const lensSvg = el("svg", {
      style: "position: absolute; width: 0; height: 0; overflow: hidden;",
      "aria-hidden": "true"
    });

    // We will patch this innerHTML in mount() based on opts.warp*
    lensSvg.innerHTML = `
      <defs>
        <filter id="ccLensWarp">
          <feTurbulence type="fractalNoise" baseFrequency="0.008" numOctaves="1" seed="2" result="noise" />
          <feDisplacementMap in="SourceGraphic" in2="noise" scale="16" xChannelSelector="R" yChannelSelector="G" />
        </filter>
      </defs>
    `;

    const lens = el("div", { class: "cc-lens", id: "cc-lens" }, [
      el("div", { class: "cc-lens-inner", id: "cc-lens-inner" }, [
        el("div", { class: "cc-lens-map", id: "cc-lens-map" })
      ]),
      el("div", { class: "cc-lens-glare" })
    ]);

    const frameOverlay = el("div", { class: "cc-frame-overlay", id: "cc-frame" });

    const scroller = el("div", { class: "cc-scroll", id: "cc-scroll" }, [
      el("div", { class: "cc-scroll-track" }),
      el("div", { class: "cc-scroll-knob", id: "cc-scroll-knob" })
    ]);

    const body = el("div", { class: "cc-cm-body cc-cm-body--lens" }, [
      lensSvg,
      el("div", { class: "cc-cm-mapwrap" }, [
        mapEl,
        lens,
        frameOverlay,
        scroller
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

    lens.style.setProperty("--lens-w", `${opts.lensWidthPx}px`);
    lens.style.setProperty("--lens-h", `${opts.lensHeightPx}px`);

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
      scrollEl: scroller,
      knobEl: root.querySelector("#cc-scroll-knob")
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

    // Patch the SVG filter to match opts (warp on/off + tuning)
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

    let mapDoc = null, stateDoc = null, mainMap = null, lensMap = null;
    const regionLayersById = {}, regionsById = {};

    // This mutable ref is the KEY to fixing “knob stuck after reload”.
    // The handlers bind once, and always look here for current map/px.
    const scrollerRef = {
      bound: false,
      px: null,
      mainMap: null,
      trackEl: ui.scrollEl,
      knobEl: ui.knobEl,
      setKnobFromT: null
    };

    // Avoid stacking map move handlers after reload
    let _onMoveZoom = null;

    function enforceBaseMapSize() {
      if (!mapDoc) return;
      const px = mapDoc.map.background.image_pixel_size;
      const vh = window.innerHeight || 900;
      const h = clamp(opts.baseMapHeightPx, 320, Math.floor(opts.baseMapMaxHeightVh * vh / 100));
      ui.mapEl.style.height = h + "px";
      ui.mapEl.style.width = Math.round(h * (px.w / px.h)) + "px";
    }

    const syncLens = rafThrottle(() => {
      if (!opts.lensEnabled || !scrollerRef.mainMap || !lensMap) return;
      const m = scrollerRef.mainMap;
      lensMap.setView(m.getCenter(), m.getZoom() + opts.lensZoomOffset, { animate: false });
    });

    function rebuildRegions() {
      if (!scrollerRef.mainMap) return;
      Object.values(regionLayersById).forEach(l => scrollerRef.mainMap.removeLayer(l));
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
        poly.addTo(scrollerRef.mainMap);
        regionLayersById[r.region_id] = poly;
      });
    }

    async function invalidateMapsHard() {
      await nextFrame();
      if (scrollerRef.mainMap) scrollerRef.mainMap.invalidateSize({ animate: false });
      if (lensMap) lensMap.invalidateSize({ animate: false });
    }

    // Bind scroller handlers ONCE (but they always reference scrollerRef.* which updates each reload)
    function bindScrollerOnce() {
      if (scrollerRef.bound) return;
      scrollerRef.bound = true;

      const trackEl = scrollerRef.trackEl;
      const knobEl = scrollerRef.knobEl;

      function getTrackRect() { return trackEl.getBoundingClientRect(); }
      function getKnobH() { return knobEl.getBoundingClientRect().height || 140; }

      function pxToT(clientY) {
        const rect = getTrackRect();
        const knobH = getKnobH();

        // pointer Y inside track
        const y = clamp(clientY - rect.top, 0, rect.height);

        // clamp so knob never leaves slot
        const yClamped = clamp(
          y - knobH / 2,
          0,
          Math.max(0, rect.height - knobH)
        );

        // convert to 0..1
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
        const m = scrollerRef.mainMap;
        const px = scrollerRef.px;
        if (!m || !px) return;

        // t=0 => top, t=1 => bottom
        const lat = px.h * (1 - t);
        m.panTo([lat, m.getCenter().lng], { animate: false });
      }

      scrollerRef.setKnobFromT = setKnobFromT;

      // Tap/click the slot jumps knob + map
      trackEl.addEventListener("pointerdown", (e) => {
        // ignore if no current map yet
        if (!scrollerRef.mainMap || !scrollerRef.px) return;

        const { t, yClamped } = pxToT(e.clientY);
        knobEl.style.top = `${yClamped}px`;
        panMapFromT(t);
      });

      // Drag knob (PointerEvents)
      knobEl.addEventListener("pointerdown", (e) => {
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

      // Fallbacks for environments where PointerEvents are weird
      // (older iOS webviews, etc.)
      knobEl.addEventListener("touchstart", () => knobEl.classList.add("is-active"), { passive: true });
      knobEl.addEventListener("touchend", () => knobEl.classList.remove("is-active"), { passive: true });
      knobEl.addEventListener("touchcancel", () => knobEl.classList.remove("is-active"), { passive: true });
      knobEl.addEventListener("mousedown", () => knobEl.classList.add("is-active"));
      window.addEventListener("mouseup", () => knobEl.classList.remove("is-active"));
    }

    async function loadAll() {
      mapDoc = await fetchJson(opts.mapUrl);
      stateDoc = await fetchJson(opts.stateUrl);

      const mapErr = validateMapDoc(mapDoc);
      const stateErr = validateStateDoc(stateDoc);
      if (mapErr) console.warn("[CC CanyonMap] map doc validation:", mapErr);
      if (stateErr) console.warn("[CC CanyonMap] state doc validation:", stateErr);

      enforceBaseMapSize();

      const px = mapDoc.map.background.image_pixel_size;
      const bounds = [[0, 0], [px.h, px.w]];

      // Tear down old maps
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

        // Let us zoom above fitBounds without Leaflet fighting us
        // (these are safe bounds for CRS.Simple)
        minZoom: -5,
        maxZoom: 6
      });

      window.L.imageOverlay(mapDoc.map.background.image_key, bounds).addTo(mainMap);

      // Create lens map (separate instance)
      if (opts.lensEnabled) {
        lensMap = window.L.map(ui.lensMapEl, {
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
        window.L.imageOverlay(mapDoc.map.background.image_key, bounds).addTo(lensMap);
      }

      // Ensure the lens container truly fills (no “mystery inset”)
      // (Leaflet sets some inline styles; this just forces the container itself)
      ui.lensMapEl.style.position = "absolute";
      ui.lensMapEl.style.inset = "0";
      ui.lensMapEl.style.width = "100%";
      ui.lensMapEl.style.height = "100%";

      await invalidateMapsHard();

      // Fit, then zoom up to make background huge (keeps lens aligned)
      mainMap.fitBounds(bounds, { padding: [10, 10], animate: false });
      mainMap.setZoom(mainMap.getZoom() + opts.backgroundZoomOffset, { animate: false });

      // Update scrollerRef so already-bound handlers now control the NEW map
      scrollerRef.mainMap = mainMap;
      scrollerRef.px = px;

      // Build regions on main map
      rebuildRegions();

      // Initialize lens view explicitly (so it isn't stuck at default)
      if (opts.lensEnabled && lensMap) {
        lensMap.setView(mainMap.getCenter(), mainMap.getZoom() + opts.lensZoomOffset, { animate: false });
      }

      // Bind scroller once (after we have elements)
      bindScrollerOnce();

      // Keep knob synced to map movement (PX, not %)
      if (_onMoveZoom) {
        try { mainMap.off("move zoom", _onMoveZoom); } catch (_) {}
      }

      _onMoveZoom = () => {
        const t = 1 - (mainMap.getCenter().lat / px.h);
        if (scrollerRef.setKnobFromT) scrollerRef.setKnobFromT(t);
        syncLens();
      };

      mainMap.on("move zoom", _onMoveZoom);

      // Set knob position immediately (so it isn't “stuck” until first move)
      _onMoveZoom();
    }

    ui.btnReload.addEventListener("click", loadAll);

    ui.btnFit.addEventListener("click", () => {
      if (!mapDoc || !scrollerRef.mainMap) return;
      const px = mapDoc.map.background.image_pixel_size;
      scrollerRef.mainMap.fitBounds([[0, 0], [px.h, px.w]], { animate: false });
      scrollerRef.mainMap.setZoom(scrollerRef.mainMap.getZoom() + opts.backgroundZoomOffset, { animate: false });
    });

    await loadAll();

    root._ccApi = { drawerClose: () => closeDrawer(ui) };
  }

  // Auto-mount
  const root = document.getElementById("cc-app-root");
  if (root && root.getAttribute("data-cc-app") === APP_ID) mount(root, {});

  window.CC_CanyonMap = { mount };
})();
