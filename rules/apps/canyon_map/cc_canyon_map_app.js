/* File: rules/apps/canyon_map/cc_canyon_map_app.js
   COFFIN CANYON — CANYON MAP (read-only v1)
   ODOO CSP-SAFE + CRISP LENS + EDGE-ONLY DISTORTION + DUAL BLAPPO SCROLLERS
   RESTORED: HEAVY EASING (oil-damped), knobs ease too, no reset between knobs
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

    // Lens behavior
    lensEnabled: true,
    lensZoomOffset: 3,

    // Edge warp tuning
    warpEnabled: true,
    warpBaseFrequency: 0.010,
    warpScaleDesktop: 22,
    warpScaleIOS: 14,

    // HEAVY FEEL (tune these)
    // Lower mapEase = heavier, slower
    mapEase: 0.085,          // 0.06–0.12 feels “heavy”
    knobEase: 0.16,          // 0.12–0.22 feels “heavy”
    settleFrames: 26,        // how long we keep easing after release
    minCenterDeltaPx: 0.18,  // don't snap too early

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

    // kill the leaflet.js.map warning spam
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

    const ios = isIOSDevice();
    if (ios) root.classList.add("cc-ios");

    const header = el("div", { class: "cc-cm-header" }, [
      el("div", { class: "cc-cm-title" }, [opts.title]),
      el("div", { class: "cc-cm-actions" }, [
        el("button", { class: "cc-btn", type: "button", id: "cc-cm-reload" }, ["Reload"]),
        el("button", { class: "cc-btn", type: "button", id: "cc-cm-fit" }, ["Fit"])
      ])
    ]);

    const mapEl = el("div", { id: "cc-cm-map", class: "cc-cm-map" });

    const lensSvg = el("svg", {
      style: "position:absolute; width:0; height:0; overflow:hidden;",
      "aria-hidden": "true"
    });

    const lens = el("div", { class: "cc-lens", id: "cc-lens" }, [
      el("div", { class: "cc-lens-inner", id: "cc-lens-inner" }, [
        el("div", { class: "cc-lens-map", id: "cc-lens-map" }),
        el("div", { class: "cc-lens-map", id: "cc-lens-map-warp" })
      ]),
      el("div", { class: "cc-lens-glare" })
    ]);

    const frameOverlay = el("div", { class: "cc-frame-overlay", id: "cc-frame" });

    const scrollerV = el("div", { class: "cc-scroll-vertical", id: "cc-scroll-vertical" }, [
      el("div", { class: "cc-scroll-track" }),
      el("div", { class: "cc-scroll-knob", id: "cc-scroll-knob-v" })
    ]);

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
      ios,
      mapEl,
      lensSvgEl: lensSvg,
      lensMapEl: root.querySelector("#cc-lens-map"),
      lensWarpEl: root.querySelector("#cc-lens-map-warp"),
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
    let mainMap = null;
    let lensMapSharp = null;
    let lensMapWarp = null;

    const regionLayersById = {};
    const regionsById = {};

    // Targets shared by both knobs (prevents “reset”)
    let targetLat = 0;
    let targetLng = 0;

    // Smoothed knob display state
    let knobTV = 0, knobTH = 0;
    let knobTargetTV = 0, knobTargetTH = 0;

    // Animation control
    let animRaf = 0;
    let animating = false;
    let draggingKnob = false;
    let settleCountdown = 0; // frames to continue easing after release

    function stopAnim() {
      if (animRaf) cancelAnimationFrame(animRaf);
      animRaf = 0;
      animating = false;
    }

    function startAnim() {
      if (animating) return;
      animating = true;

      const tick = () => {
        animRaf = requestAnimationFrame(tick);
        if (!mainMap) return;

        // Always ease knobs toward targets (even if map is close)
        knobTV += (knobTargetTV - knobTV) * opts.knobEase;
        knobTH += (knobTargetTH - knobTH) * opts.knobEase;

        setVerticalKnobFromT(knobTV);
        setHorizontalKnobFromT(knobTH);

        // Ease map toward target
        const c = mainMap.getCenter();
        const dLat = targetLat - c.lat;
        const dLng = targetLng - c.lng;
        const dist = Math.abs(dLat) + Math.abs(dLng);

        if (dist > opts.minCenterDeltaPx) {
          const nLat = c.lat + dLat * opts.mapEase;
          const nLng = c.lng + dLng * opts.mapEase;
          mainMap.setView([nLat, nLng], mainMap.getZoom(), { animate: false });
          syncLens();
          settleCountdown = opts.settleFrames; // reset settle window while moving
          return;
        }

        // If we're close, keep a little “settle” time unless we're fully idle
        if (draggingKnob) {
          // while dragging, never stop: it keeps the weighty feel
          syncLens();
          return;
        }

        if (settleCountdown > 0) {
          settleCountdown--;
          syncLens();
          return;
        }

        // final snap to exact target, then stop
        mainMap.setView([targetLat, targetLng], mainMap.getZoom(), { animate: false });
        syncLens();
        stopAnim();
      };

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
      if (!opts.lensEnabled || !mainMap || !lensMapSharp || !lensMapWarp) return;
      const center = mainMap.getCenter();
      const z = mainMap.getZoom() + opts.lensZoomOffset;
      lensMapSharp.setView(center, z, { animate: false });
      lensMapWarp.setView(center, z, { animate: false });
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
      if (lensMapSharp) lensMapSharp.invalidateSize({ animate: false });
      if (lensMapWarp) lensMapWarp.invalidateSize({ animate: false });
    }

    // ---------------------------
    // Knob -> T helpers
    // ---------------------------
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
      const knobW = knobEl.getBoundingClientRect().width || 70;

      const minX = knobW / 2;
      const maxX = Math.max(minX, rect.width - knobW / 2);

      const x = minX + (maxX - minX) * clamp(t, 0, 1);
      knobEl.style.left = `${x}px`;
    }

    // ---------------------------
    // Bind scrollers
    // ---------------------------
    function bindVerticalScrollerOnce(pxH) {
      const trackEl = ui.scrollVEl;
      const knobEl = ui.knobVEl;
      if (!trackEl || !knobEl) return;

      const getRect = () => trackEl.getBoundingClientRect();
      const getKnobH = () => knobEl.getBoundingClientRect().height || 140;

      const clientYToT = (clientY) => {
        const rect = getRect();
        const knobH = getKnobH();

        const y = clamp(clientY - rect.top, 0, rect.height);
        const yClamped = clamp(y - knobH / 2, 0, Math.max(0, rect.height - knobH));
        const denom = Math.max(1, rect.height - knobH);
        return clamp(yClamped / denom, 0, 1);
      };

      const applyT = (t) => {
        // CRS.Simple: lat increases downward
        knobTargetTV = t;
        targetLat = pxH * t;
        settleCountdown = opts.settleFrames;
        startAnim();
      };

      trackEl.addEventListener("pointerdown", (e) => {
        if (e.target === knobEl) return;
        applyT(clientYToT(e.clientY));
      });

      knobEl.addEventListener("pointerdown", (e) => {
        e.preventDefault();
        e.stopPropagation();
        draggingKnob = true;
        settleCountdown = opts.settleFrames;

        knobEl.classList.add("is-active");
        try { knobEl.setPointerCapture(e.pointerId); } catch (_) {}

        const onMove = (ev) => applyT(clientYToT(ev.clientY));

        const onUp = () => {
          draggingKnob = false;
          knobEl.classList.remove("is-active");
          knobEl.removeEventListener("pointermove", onMove);
          knobEl.removeEventListener("pointerup", onUp);
          knobEl.removeEventListener("pointercancel", onUp);
          settleCountdown = opts.settleFrames; // keep heavy settle after release
          startAnim();
        };

        knobEl.addEventListener("pointermove", onMove);
        knobEl.addEventListener("pointerup", onUp);
        knobEl.addEventListener("pointercancel", onUp);
      });
    }

    function bindHorizontalScrollerOnce(pxW) {
      const trackEl = ui.scrollHEl;
      const knobEl = ui.knobHEl;
      if (!trackEl || !knobEl) return;

      const getRect = () => trackEl.getBoundingClientRect();
      const getKnobW = () => knobEl.getBoundingClientRect().width || 70;

      const clientXToT = (clientX) => {
        const rect = getRect();
        const knobW = getKnobW();

        const minX = knobW / 2;
        const maxX = Math.max(minX, rect.width - knobW / 2);

        const x = clamp(clientX - rect.left, minX, maxX);
        const t = (x - minX) / Math.max(1, (maxX - minX));
        return clamp(t, 0, 1);
      };

      const applyT = (t) => {
        knobTargetTH = t;
        targetLng = pxW * t;
        settleCountdown = opts.settleFrames;
        startAnim();
      };

      trackEl.addEventListener("pointerdown", (e) => {
        if (e.target === knobEl) return;
        applyT(clientXToT(e.clientX));
      });

      knobEl.addEventListener("pointerdown", (e) => {
        e.preventDefault();
        e.stopPropagation();
        draggingKnob = true;
        settleCountdown = opts.settleFrames;

        knobEl.classList.add("is-active");
        try { knobEl.setPointerCapture(e.pointerId); } catch (_) {}

        const onMove = (ev) => applyT(clientXToT(ev.clientX));

        const onUp = () => {
          draggingKnob = false;
          knobEl.classList.remove("is-active");
          knobEl.removeEventListener("pointermove", onMove);
          knobEl.removeEventListener("pointerup", onUp);
          knobEl.removeEventListener("pointercancel", onUp);
          settleCountdown = opts.settleFrames;
          startAnim();
        };

        knobEl.addEventListener("pointermove", onMove);
        knobEl.addEventListener("pointerup", onUp);
        knobEl.addEventListener("pointercancel", onUp);
      });
    }

    // ---------------------------
    // Load
    // ---------------------------
    async function loadAll() {
      mapDoc = await fetchJson(opts.mapUrl);
      stateDoc = await fetchJson(opts.stateUrl);

      const mapErr = validateMapDoc(mapDoc);
      const stateErr = validateStateDoc(stateDoc);
      if (mapErr) console.warn("[CC CanyonMap] map doc validation:", mapErr);
      if (stateErr) console.warn("[CC CanyonMap] state doc validation:", stateErr);

      enforceBaseMapSize();

      const bgPx = mapDoc.map.background.image_pixel_size;
      const bgBounds = [[0, 0], [bgPx.h, bgPx.w]];

      // Lens should use your large image:
      const lensImageKey = mapDoc.map.lens?.image_key || mapDoc.map.background.image_key;
      const lensPx = mapDoc.map.lens?.image_pixel_size || bgPx;
      const lensBounds = [[0, 0], [lensPx.h, lensPx.w]];

      stopAnim();
      if (mainMap) mainMap.remove();
      if (lensMapSharp) lensMapSharp.remove();
      if (lensMapWarp) lensMapWarp.remove();

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

      window.L.imageOverlay(mapDoc.map.background.image_key, bgBounds).addTo(mainMap);

      if (opts.lensEnabled) {
        lensMapSharp = window.L.map(ui.lensMapEl, {
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

        lensMapWarp = window.L.map(ui.lensWarpEl, {
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

        // Use large lens image + lens bounds
        window.L.imageOverlay(lensImageKey, lensBounds).addTo(lensMapSharp);
        window.L.imageOverlay(lensImageKey, lensBounds).addTo(lensMapWarp);
      }

      await invalidateMapsHard();

      mainMap.fitBounds(bgBounds, { padding: [10, 10], animate: false });

      const c = mainMap.getCenter();
      targetLat = c.lat;
      targetLng = c.lng;

      rebuildRegions();

      bindVerticalScrollerOnce(bgPx.h);
      bindHorizontalScrollerOnce(bgPx.w);

      // Initialize knob targets from center
      knobTargetTV = clamp(targetLat / bgPx.h, 0, 1);
      knobTargetTH = clamp(targetLng / bgPx.w, 0, 1);
      knobTV = knobTargetTV;
      knobTH = knobTargetTH;
      setVerticalKnobFromT(knobTV);
      setHorizontalKnobFromT(knobTH);

      // Sync lens now
      if (opts.lensEnabled && lensMapSharp && lensMapWarp) {
        lensMapSharp.setView(mainMap.getCenter(), mainMap.getZoom() + opts.lensZoomOffset, { animate: false });
        lensMapWarp.setView(mainMap.getCenter(), mainMap.getZoom() + opts.lensZoomOffset, { animate: false });
        await nextFrame();
        lensMapSharp.invalidateSize({ animate: false });
        lensMapWarp.invalidateSize({ animate: false });
      }

      // If user drags the map, update targets but KEEP the heavy settle feeling
      mainMap.on("move", () => {
        if (draggingKnob) return;
        const cc = mainMap.getCenter();
        targetLat = cc.lat;
        targetLng = cc.lng;

        knobTargetTV = clamp(targetLat / bgPx.h, 0, 1);
        knobTargetTH = clamp(targetLng / bgPx.w, 0, 1);

        // Keep anim alive briefly so it feels weighty, not “hard stop”
        settleCountdown = opts.settleFrames;
        startAnim();
      });

      mainMap.on("zoom", () => {
        settleCountdown = opts.settleFrames;
        startAnim();
      });

      settleCountdown = opts.settleFrames;
      startAnim();
    }

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

      settleCountdown = opts.settleFrames;
      startAnim();
    });

    await loadAll();

    root._ccApi = { drawerClose: () => closeDrawer(ui) };
  }

  // Auto-mount
  const root = document.getElementById("cc-app-root");
  if (root && root.getAttribute("data-cc-app") === APP_ID) mount(root, {});

  window.CC_CanyonMap = { mount };
})();
