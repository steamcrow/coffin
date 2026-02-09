/* File: rules/apps/canyon_map/cc_canyon_map_app.js
   COFFIN CANYON — CANYON MAP (read-only v1)
   FIXES:
   - Lens uses LARGE image rendered into SMALL bounds => same coords, crisp
   - Lens warp is EDGE-ONLY overlay layer
   - Longer/heavier easing (map + knobs), no early stop
   - Horizontal scroller clamps correctly + uses blappo knob (rotated via CSS)
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

    // Make the top lens "smaller" (less zoom) now that the image is crisp:
    lensZoomOffset: 1,  // try 1; if you want more, set to 2

    // Edge warp
    warpEnabled: true,
    warpBaseFrequency: 0.010,
    warpScaleDesktop: 22,
    warpScaleIOS: 14,

    // HEAVIER / LONGER SLIDE
    mapEase: 0.045,       // lower = heavier/longer
    knobEase: 0.10,       // lower = heavier/longer
    settleFrames: 90,     // longer coast
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

    // remove sourcemap reference => no "leaflet.js.map" warnings
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

    const scrollerV = el("div", { id: "cc-scroll-vertical" }, [
      el("div", { class: "cc-scroll-track" }),
      el("div", { class: "cc-scroll-knob", id: "cc-scroll-knob-v" })
    ]);

    const scrollerH = el("div", { id: "cc-scroll-horizontal" }, [
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
      scrollVEl: root.querySelector("#cc-scroll-vertical"),
      knobVEl: root.querySelector("#cc-scroll-knob-v"),
      scrollHEl: root.querySelector("#cc-scroll-horizontal"),
      knobHEl: root.querySelector("#cc-scroll-knob-h")
    };
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
    let regionLayersById = {};

    // Shared targets (prevents “reset” between knobs)
    let targetLat = 0;
    let targetLng = 0;

    // Smoothed knob display
    let knobTV = 0, knobTH = 0;
    let knobTargetTV = 0, knobTargetTH = 0;

    // Animation / easing
    let raf = 0;
    let animating = false;
    let draggingKnob = false;
    let settle = 0;

    function stopAnim() {
      if (raf) cancelAnimationFrame(raf);
      raf = 0;
      animating = false;
    }

    const syncLens = rafThrottle(() => {
      if (!opts.lensEnabled || !mainMap || !lensSharp || !lensWarp) return;
      const center = mainMap.getCenter();
      const z = mainMap.getZoom() + opts.lensZoomOffset;
      lensSharp.setView(center, z, { animate: false });
      lensWarp.setView(center, z, { animate: false });
    });

    function enforceBaseMapSize() {
      if (!mapDoc) return;
      const px = mapDoc.map.background.image_pixel_size;
      const vh = window.innerHeight || 900;
      const h = clamp(opts.baseMapHeightPx, 320, Math.floor(opts.baseMapMaxHeightVh * vh / 100));
      ui.mapEl.style.height = h + "px";
      ui.mapEl.style.width = Math.round(h * (px.w / px.h)) + "px";
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
      const knobW = knobEl.getBoundingClientRect().width || 140;

      const minX = knobW / 2;
      const maxX = Math.max(minX, rect.width - knobW / 2);

      const x = minX + (maxX - minX) * clamp(t, 0, 1);
      knobEl.style.left = `${x}px`;
    }

    function startAnim() {
      if (animating) return;
      animating = true;

      const tick = () => {
        raf = requestAnimationFrame(tick);
        if (!mainMap) return;

        // knobs ease longer
        knobTV += (knobTargetTV - knobTV) * opts.knobEase;
        knobTH += (knobTargetTH - knobTH) * opts.knobEase;
        setVerticalKnobFromT(knobTV);
        setHorizontalKnobFromT(knobTH);

        // map heavy ease longer
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

        // settle window (keeps “heavy” feeling)
        if (draggingKnob) {
          syncLens();
          return;
        }
        if (settle > 0) {
          settle--;
          syncLens();
          return;
        }

        // final snap and stop
        mainMap.setView([targetLat, targetLng], mainMap.getZoom(), {
