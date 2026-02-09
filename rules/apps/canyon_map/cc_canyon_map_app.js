/* File: rules/apps/canyon_map/cc_canyon_map_app.js
   UPDATE: Fixes for:
   - Lens window enlarged + overscan hidden beneath metal frame
   - Knobs move reliably (vertical + horizontal)
   - Heavy “eased” scrolling using a shared target center + smoothing loop
   - Switching knobs does NOT reset (shared target continues)
   - No inline styling for scrollers
   - Strips leaflet sourcemap directives to prevent leaflet.js.map console spam
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
    lensZoomOffset: 3,

    /* IMPORTANT: match/enlarge lens window so it tucks under frame */
    lensWidthPx: 780,
    lensHeightPx: 540,

    warpEnabled: true,
    warpBaseFrequency: 0.008,
    warpScale: 16,

    /* More overscan so seams are hidden */
    lensOverscanX: 110,
    lensOverscanY: 110,

    allowMapDrag: true,

    /* Heavy feel (0..1). Higher = snappier. Lower = heavier. */
    heavyEase: 0.14,
    heavyStopEps: 0.35,

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

  function stripSourceMapDirectives(code) {
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

  // ---------------------------
  // UI
  // ---------------------------
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

    const scrollerVertical = el("div", { class: "cc-scroll cc-scroll-vertical", id: "cc-scroll-vertical" }, [
      el("div", { class: "cc-scroll-track" }),
      el("div", { class: "cc-scroll-knob", id: "cc-scroll-knob-v" })
    ]);

    const scrollerHorizontal = el("div", { class: "cc-scroll cc-scroll-horizontal", id: "cc-scroll-horizontal" }, [
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

    /* Lens sizing is driven by these vars */
    lens.style.setProperty("--lens-w", `${opts.lensWidthPx}px`);
    lens.style.setProperty("--lens-h", `${opts.lensHeightPx}px`);
    lens.style.setProperty("--lens-overscan-x", `${Number(opts.lensOverscanX || 0)}px`);
    lens.style.setProperty("--lens-overscan-y", `${Number(opts.lensOverscanY || 0)}px`);

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

  // ---------------------------
  // Main mount
  // ---------------------------
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
      if (!opts.lensEnabled || !mainMap || !lensMap) return;
      lensMap.setView(mainMap.getCenter(), mainMap.getZoom() + opts.lensZoomOffset, { animate: false });
    });

    function rebuildRegions() {
      if (!mainMap) return;
      Object.values(regionLayersById).forEach(l => mainMap.removeLayer(l));
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

    // ==========================================================
    // Heavy easing: shared target center + smoothing loop
    // ==========================================================
    let target = null;     // {lat,lng}
    let animRaf = 0;

    function stopHeavyLoop() {
      if (animRaf) cancelAnimationFrame(animRaf);
      animRaf = 0;
    }

    function startHeavyLoop(px) {
      if (!mainMap) return;
      if (animRaf) return;

      const ease = clamp(Number(opts.heavyEase || 0.14), 0.05, 0.5);
      const eps = clamp(Number(opts.heavyStopEps || 0.35), 0.05, 3);

      const tick = () => {
        animRaf = 0;
        if (!mainMap || !target) return;

        const c = mainMap.getCenter();
        const dLat = target.lat - c.lat;
        const dLng = target.lng - c.lng;

        if (Math.abs(dLat) < eps && Math.abs(dLng) < eps) {
          mainMap.panTo([target.lat, target.lng], { animate: false });
          target = null;
          return;
        }

        const nLat = c.lat + dLat * ease;
        const nLng = c.lng + dLng * ease;

        // Clamp to map bounds in image px space
        const clampedLat = clamp(nLat, 0, px.h);
        const clampedLng = clamp(nLng, 0, px.w);

        mainMap.panTo([clampedLat, clampedLng], { animate: false });

        animRaf = requestAnimationFrame(tick);
      };

      animRaf = requestAnimationFrame(tick);
    }

    function setTarget(px, partial) {
      if (!mainMap) return;

      // IMPORTANT: keep a shared target so switching knobs doesn’t “start over”
      if (!target) {
        const c = mainMap.getCenter();
        target = { lat: c.lat, lng: c.lng };
      }
      if (typeof partial.lat === "number") target.lat = partial.lat;
      if (typeof partial.lng === "number") target.lng = partial.lng;

      // Clamp target
      target.lat = clamp(target.lat, 0, px.h);
      target.lng = clamp(target.lng, 0, px.w);

      startHeavyLoop(px);
    }

    // ==========================================================
    // Scrollers (bind once)
    // ==========================================================
    const vScroll = { bound: false, trackEl: ui.scrollElVertical, knobEl: ui.knobElVertical, setKnobFromT: null };
    const hScroll = { bound: false, trackEl: ui.scrollElHorizontal, knobEl: ui.knobElHorizontal, setKnobFromT: null };

    function bindVerticalScrollerOnce(px) {
      if (vScroll.bound) return;
      vScroll.bound = true;

      const trackEl = vScroll.trackEl;
      const knobEl = vScroll.knobEl;

      function pxToT(clientY) {
        const rect = trackEl.getBoundingClientRect();
        const knobH = knobEl.getBoundingClientRect().height || 140;
        const y = clamp(clientY - rect.top, 0, rect.height);
        const yClamped = clamp(y - knobH / 2, 0, Math.max(0, rect.height - knobH));
        const denom = Math.max(1, rect.height - knobH);
        const t = clamp(yClamped / denom, 0, 1);
        return { t, yClamped };
      }

      function setKnobFromT(t) {
        const rect = trackEl.getBoundingClientRect();
        const knobH = knobEl.getBoundingClientRect().height || 140;
        const denom = Math.max(1, rect.height - knobH);
        const y = denom * clamp(t, 0, 1);
        knobEl.style.top = `${y}px`;
      }

      function setTargetFromT(t) {
        const lat = px.h * (1 - t);
        // Keep shared target lng (do not “reset”)
        setTarget(px, { lat });
      }

      vScroll.setKnobFromT = setKnobFromT;

      trackEl.addEventListener("pointerdown", (e) => {
        if (!mainMap) return;
        if (e.target === knobEl) return;
        const { t, yClamped } = pxToT(e.clientY);
        knobEl.style.top = `${yClamped}px`;
        setTargetFromT(t);
      });

      knobEl.addEventListener("pointerdown", (e) => {
        if (!mainMap) return;
        e.preventDefault();
        e.stopPropagation();
        knobEl.classList.add("is-active");
        try { knobEl.setPointerCapture(e.pointerId); } catch (_) {}

        const onMove = (ev) => {
          const { t, yClamped } = pxToT(ev.clientY);
          knobEl.style.top = `${yClamped}px`;
          setTargetFromT(t);
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

      function pxToT(clientX) {
        const rect = trackEl.getBoundingClientRect();
        const knobW = knobEl.getBoundingClientRect().width || 200;
        const x = clamp(clientX - rect.left, 0, rect.width);
        const xClamped = clamp(x - knobW / 2, 0, Math.max(0, rect.width - knobW));
        const denom = Math.max(1, rect.width - knobW);
        const t = clamp(xClamped / denom, 0, 1);
        return { t, xClamped };
      }

      function setKnobFromT(t) {
        const rect = trackEl.getBoundingClientRect();
        const knobW = knobEl.getBoundingClientRect().width || 200;
        const denom = Math.max(1, rect.width - knobW);
        const x = denom * clamp(t, 0, 1);
        knobEl.style.left = `${x}px`;
      }

      function setTargetFromT(t) {
        const lng = px.w * t;
        // Keep shared target lat (do not “reset”)
        setTarget(px, { lng });
      }

      hScroll.setKnobFromT = setKnobFromT;

      trackEl.addEventListener("pointerdown", (e) => {
        if (!mainMap) return;
        if (e.target === knobEl) return;
        const { t, xClamped } = pxToT(e.clientX);
        knobEl.style.left = `${xClamped}px`;
        setTargetFromT(t);
      });

      knobEl.addEventListener("pointerdown", (e) => {
        if (!mainMap) return;
        e.preventDefault();
        e.stopPropagation();
        knobEl.classList.add("is-active");
        try { knobEl.setPointerCapture(e.pointerId); } catch (_) {}

        const onMove = (ev) => {
          const { t, xClamped } = pxToT(ev.clientX);
          knobEl.style.left = `${xClamped}px`;
          setTargetFromT(t);
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

    async function loadAll() {
      stopHeavyLoop();
      target = null;

      mapDoc = await fetchJson(opts.mapUrl);
      stateDoc = await fetchJson(opts.stateUrl);

      const mapErr = validateMapDoc(mapDoc);
      const stateErr = validateStateDoc(stateDoc);
      if (mapErr) console.warn("[CC CanyonMap] map doc validation:", mapErr);
      if (stateErr) console.warn("[CC CanyonMap] state doc validation:", stateErr);

      enforceBaseMapSize();

      const bgPx = mapDoc.map.background.image_pixel_size;
      const bgBounds = [[0, 0], [bgPx.h, bgPx.w]];

      const lensImageKey = mapDoc.map.lens?.image_key || mapDoc.map.background.image_key;
      const lensPx = mapDoc.map.lens?.image_pixel_size || bgPx;
      const lensBounds = [[0, 0], [lensPx.h, lensPx.w]];

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
        zoomSnap: 0,
        zoomDelta: 0.25,
        minZoom: -5,
        maxZoom: 6
      });

      window.L.imageOverlay(mapDoc.map.background.image_key, bgBounds).addTo(mainMap);

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

      mainMap.fitBounds(bgBounds, { padding: [10, 10], animate: false });
      mainMap.setZoom(mainMap.getZoom() + Number(opts.backgroundZoomOffset || 0), { animate: false });

      rebuildRegions();

      if (opts.lensEnabled && lensMap) {
        lensMap.setView(mainMap.getCenter(), mainMap.getZoom() + Number(opts.lensZoomOffset || 0), { animate: false });
        await nextFrame();
        lensMap.invalidateSize({ animate: false });
      }

      bindVerticalScrollerOnce(bgPx);
      bindHorizontalScrollerOnce(bgPx);

      if (_onMoveZoom) {
        try { mainMap.off("move zoom", _onMoveZoom); } catch (_) {}
      }

      _onMoveZoom = () => {
        // Keep knobs synced even while heavy easing loop runs
        const c = mainMap.getCenter();

        const tV = clamp(1 - (c.lat / bgPx.h), 0, 1);
        if (vScroll.setKnobFromT) vScroll.setKnobFromT(tV);

        const tH = clamp(c.lng / bgPx.w, 0, 1);
        if (hScroll.setKnobFromT) hScroll.setKnobFromT(tH);

        syncLens();
      };

      mainMap.on("move zoom", _onMoveZoom);
      _onMoveZoom();
    }

    ui.btnReload.addEventListener("click", loadAll);

    ui.btnFit.addEventListener("click", () => {
      if (!mapDoc || !mainMap) return;
      const px = mapDoc.map.background.image_pixel_size;
      mainMap.fitBounds([[0, 0], [px.h, px.w]], { animate: false });
      mainMap.setZoom(mainMap.getZoom() + Number(opts.backgroundZoomOffset || 0), { animate: false });
      target = null; // stop trying to ease toward an old target after a fit
      stopHeavyLoop();
    });

    await loadAll();

    root._ccApi = { drawerClose: () => closeDrawer(ui) };
  }

  // Auto-mount
  const root = document.getElementById("cc-app-root");
  if (root && root.getAttribute("data-cc-app") === APP_ID) mount(root, {});

  window.CC_CanyonMap = { mount };
})();
