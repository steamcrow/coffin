/* File: rules/apps/canyon_map/cc_canyon_map_app.js
   UPDATE: Added HORIZONTAL scroller knob at bottom + distortion on lens.
   - Vertical scroller controls up/down (latitude)
   - NEW: Horizontal scroller controls left/right (longitude)
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

    backgroundZoomOffset: 2,

    lensEnabled: true,
    lensZoomOffset: 2,
    lensWidthPx: 638,
    lensHeightPx: 438,

    warpEnabled: true,
    warpBaseFrequency: 0.008,
    warpScale: 16,

    lensOverscanX: 22,
    lensOverscanY: 22,

    lockHorizontalPan: false,
    maxHorizontalDriftPx: 260,
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

  function normalizePoints(points, coordSystem) {
    if (!Array.isArray(points)) return [];
    if (coordSystem !== "image_px" && coordSystem !== "map_units") return [];
    return points
      .filter((p) => p && typeof p.x === "number" && typeof p.y === "number")
      .map((p) => [p.y, p.x]);
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

  function buildLayout(root, opts) {
    root.innerHTML = "";
    root.classList.add("cc-canyon-map");

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

    const lensSvg = el("svg", {
      style: "position: absolute; width: 0; height: 0; overflow: hidden;",
      "aria-hidden": "true"
    });

    lensSvg.innerHTML = `<defs></defs>`;

    const lens = el("div", { class: "cc-lens", id: "cc-lens" }, [
      el("div", { class: "cc-lens-inner", id: "cc-lens-inner" }, [
        el("div", { class: "cc-lens-map", id: "cc-lens-map" })
      ]),
      el("div", { class: "cc-lens-glare" })
    ]);

    const frameOverlay = el("div", { class: "cc-frame-overlay", id: "cc-frame" });

    // VERTICAL SCROLLER (up/down on the right side)
    const scrollerVertical = el("div", { class: "cc-scroll cc-scroll-vertical", id: "cc-scroll-vertical" }, [
      el("div", { class: "cc-scroll-track" }),
      el("div", { class: "cc-scroll-knob", id: "cc-scroll-knob-v" })
    ]);

    // NEW: HORIZONTAL SCROLLER (left/right on the bottom)
    const scrollerHorizontal = el("div", { 
      class: "cc-scroll cc-scroll-horizontal", 
      id: "cc-scroll-horizontal",
      style: "position: absolute; bottom: 15px; left: 70px; right: 70px; height: 35px; pointer-events: auto; z-index: 100;"
    }, [
      el("div", { 
        class: "cc-scroll-track",
        style: "width: 100%; height: 100%; background: rgba(0,0,0,0.4); border: 2px solid rgba(255,255,255,0.3); border-radius: 18px; position: relative; box-shadow: inset 0 2px 4px rgba(0,0,0,0.3);"
      }),
      el("div", { 
        class: "cc-scroll-knob", 
        id: "cc-scroll-knob-h",
        style: "position: absolute; left: 0; top: 50%; transform: translateY(-50%); width: 120px; height: 90%; background: linear-gradient(180deg, rgba(255,255,255,0.5), rgba(255,255,255,0.3)); border: 2px solid rgba(255,255,255,0.6); border-radius: 15px; cursor: grab; box-shadow: 0 2px 6px rgba(0,0,0,0.3);"
      })
    ]);

    const body = el("div", { class: "cc-cm-body cc-cm-body--lens" }, [
      lensSvg,
      el("div", { class: "cc-cm-mapwrap" }, [
        mapEl,
        lens,
        frameOverlay,
        scrollerVertical,      // vertical scroller
        scrollerHorizontal     // NEW: horizontal scroller
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

  async function mount(root, userOpts) {
    const opts = { ...DEFAULTS, ...(userOpts || {}) };

    if (opts.appCssUrl) await loadCssTextOnce(opts.appCssUrl, "cc_canyon_map_css");
    await ensureLeaflet(opts);

    const ui = buildLayout(root, opts);

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

    // VERTICAL scroller reference (controls up/down)
    const scrollerVerticalRef = {
      bound: false,
      px: null,
      mainMap: null,
      trackEl: ui.scrollElVertical,
      knobEl: ui.knobElVertical,
      setKnobFromT: null
    };

    // NEW: HORIZONTAL scroller reference (controls left/right)
    const scrollerHorizontalRef = {
      bound: false,
      px: null,
      mainMap: null,
      trackEl: ui.scrollElHorizontal,
      knobEl: ui.knobElHorizontal,
      setKnobFromT: null
    };

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
      if (!opts.lensEnabled || !scrollerVerticalRef.mainMap || !lensMap) return;
      const m = scrollerVerticalRef.mainMap;
      lensMap.setView(m.getCenter(), m.getZoom() + opts.lensZoomOffset, { animate: false });
    });

    function rebuildRegions() {
      if (!scrollerVerticalRef.mainMap) return;
      Object.values(regionLayersById).forEach(l => scrollerVerticalRef.mainMap.removeLayer(l));
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
        poly.addTo(scrollerVerticalRef.mainMap);
        regionLayersById[r.region_id] = poly;
      });
    }

    async function invalidateMapsHard() {
      await nextFrame();
      if (scrollerVerticalRef.mainMap) scrollerVerticalRef.mainMap.invalidateSize({ animate: false });
      if (lensMap) lensMap.invalidateSize({ animate: false });
    }

    // VERTICAL SCROLLER BINDING (up/down movement)
    function bindVerticalScrollerOnce() {
      if (scrollerVerticalRef.bound) return;
      scrollerVerticalRef.bound = true;

      const trackEl = scrollerVerticalRef.trackEl;
      const knobEl = scrollerVerticalRef.knobEl;

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
        const m = scrollerVerticalRef.mainMap;
        const px = scrollerVerticalRef.px;
        if (!m || !px) return;
        const lat = px.h * (1 - t); // t=0 -> top of map, t=1 -> bottom of map
        const currentLng = m.getCenter().lng; // KEEP the current left/right position
        m.panTo([lat, currentLng], { animate: false });
      }

      scrollerVerticalRef.setKnobFromT = setKnobFromT;

      trackEl.addEventListener("pointerdown", (e) => {
        if (!scrollerVerticalRef.mainMap || !scrollerVerticalRef.px) return;
        const { t, yClamped } = pxToT(e.clientY);
        knobEl.style.top = `${yClamped}px`;
        panMapFromT(t);
      });

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

      knobEl.addEventListener("touchstart", () => knobEl.classList.add("is-active"), { passive: true });
      knobEl.addEventListener("touchend", () => knobEl.classList.remove("is-active"), { passive: true });
      knobEl.addEventListener("touchcancel", () => knobEl.classList.remove("is-active"), { passive: true });
      knobEl.addEventListener("mousedown", () => knobEl.classList.add("is-active"));
      window.addEventListener("mouseup", () => knobEl.classList.remove("is-active"));
    }

    // NEW: HORIZONTAL SCROLLER BINDING (left/right movement)
    function bindHorizontalScrollerOnce() {
      if (scrollerHorizontalRef.bound) return;
      scrollerHorizontalRef.bound = true;

      const trackEl = scrollerHorizontalRef.trackEl;
      const knobEl = scrollerHorizontalRef.knobEl;

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
        const m = scrollerHorizontalRef.mainMap;
        const px = scrollerHorizontalRef.px;
        if (!m || !px) return;
        const lng = px.w * t; // t=0 -> left edge, t=1 -> right edge
        const currentLat = m.getCenter().lat; // KEEP the current up/down position
        m.panTo([currentLat, lng], { animate: false });
      }

      scrollerHorizontalRef.setKnobFromT = setKnobFromT;

      trackEl.addEventListener("pointerdown", (e) => {
        if (!scrollerHorizontalRef.mainMap || !scrollerHorizontalRef.px) return;
        const { t, xClamped } = pxToT(e.clientX);
        knobEl.style.left = `${xClamped}px`;
        panMapFromT(t);
      });

      knobEl.addEventListener("pointerdown", (e) => {
        e.preventDefault();
        e.stopPropagation();
        knobEl.classList.add("is-active");
        knobEl.style.cursor = "grabbing"; // Change cursor while dragging
        try { knobEl.setPointerCapture(e.pointerId); } catch (_) {}

        const onMove = (ev) => {
          const { t, xClamped } = pxToT(ev.clientX);
          knobEl.style.left = `${xClamped}px`;
          panMapFromT(t);
        };

        const onUp = () => {
          knobEl.classList.remove("is-active");
          knobEl.style.cursor = "grab"; // Reset cursor
          knobEl.removeEventListener("pointermove", onMove);
          knobEl.removeEventListener("pointerup", onUp);
          knobEl.removeEventListener("pointercancel", onUp);
        };

        knobEl.addEventListener("pointermove", onMove);
        knobEl.addEventListener("pointerup", onUp);
        knobEl.addEventListener("pointercancel", onUp);
      });

      knobEl.addEventListener("touchstart", () => knobEl.classList.add("is-active"), { passive: true });
      knobEl.addEventListener("touchend", () => knobEl.classList.remove("is-active"), { passive: true });
      knobEl.addEventListener("touchcancel", () => knobEl.classList.remove("is-active"), { passive: true });
      knobEl.addEventListener("mousedown", () => knobEl.classList.add("is-active"));
      window.addEventListener("mouseup", () => knobEl.classList.remove("is-active"));
    }

    function applyLensOverscanSizing() {
      if (!ui.lensMapEl) return;

      const x = Number(opts.lensOverscanX || 0);
      const y = Number(opts.lensOverscanY || 0);

      ui.lensMapEl.style.position = "absolute";
      ui.lensMapEl.style.left = (-x) + "px";
      ui.lensMapEl.style.top = (-y) + "px";
      ui.lensMapEl.style.width = `calc(100% + ${x * 2}px)`;
      ui.lensMapEl.style.height = `calc(100% + ${y * 2}px)`;
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

      if (mainMap) mainMap.remove();
      if (lensMap) lensMap.remove();

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
      window.L.imageOverlay(mapDoc.map.background.image_key, bounds).addTo(mainMap);

      if (opts.lensEnabled) {
        applyLensOverscanSizing();

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

      await invalidateMapsHard();

      mainMap.fitBounds(bounds, { padding: [10, 10], animate: false });
      mainMap.setZoom(mainMap.getZoom() + opts.backgroundZoomOffset, { animate: false });

      scrollerVerticalRef.mainMap = mainMap;
      scrollerVerticalRef.px = px;

      // NEW: Set horizontal scroller reference
      scrollerHorizontalRef.mainMap = mainMap;
      scrollerHorizontalRef.px = px;

      rebuildRegions();

      if (opts.lensEnabled && lensMap) {
        lensMap.setView(mainMap.getCenter(), mainMap.getZoom() + opts.lensZoomOffset, { animate: false });
        await nextFrame();
        lensMap.invalidateSize({ animate: false });
      }

      bindVerticalScrollerOnce();
      bindHorizontalScrollerOnce(); // NEW: Bind horizontal scroller

      if (_onMoveZoom) {
        try { mainMap.off("move zoom", _onMoveZoom); } catch (_) {}
      }

      _onMoveZoom = () => {
        // Update VERTICAL knob position
        const tVertical = 1 - (mainMap.getCenter().lat / px.h);
        if (scrollerVerticalRef.setKnobFromT) scrollerVerticalRef.setKnobFromT(tVertical);

        // NEW: Update HORIZONTAL knob position
        const tHorizontal = mainMap.getCenter().lng / px.w;
        if (scrollerHorizontalRef.setKnobFromT) scrollerHorizontalRef.setKnobFromT(tHorizontal);

        syncLens();
      };

      mainMap.on("move zoom", _onMoveZoom);
      _onMoveZoom();
    }

    ui.btnReload.addEventListener("click", loadAll);

    ui.btnFit.addEventListener("click", () => {
      if (!mapDoc || !scrollerVerticalRef.mainMap) return;
      const px = mapDoc.map.background.image_pixel_size;
      scrollerVerticalRef.mainMap.fitBounds([[0, 0], [px.h, px.w]], { animate: false });
      scrollerVerticalRef.mainMap.setZoom(scrollerVerticalRef.mainMap.getZoom() + opts.backgroundZoomOffset, { animate: false });
    });

    await loadAll();

    root._ccApi = { drawerClose: () => closeDrawer(ui) };
  }

  const root = document.getElementById("cc-app-root");
  if (root && root.getAttribute("data-cc-app") === APP_ID) mount(root, {});

  window.CC_CanyonMap = { mount };
})();
