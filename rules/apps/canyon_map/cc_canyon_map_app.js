/* File: rules/apps/canyon_map/cc_canyon_map_app.js
   Coffin Canyon — Canyon Map
   Fixes in this version:
   - Momentum physics restored on knobs (velocity + friction decay loop)
   - Both maps now use setMaxBounds so they hit extents simultaneously
   - Background map gets correct ID + invalidateSize() fix so it fills the container
   - Lens map gets correct ID + uses high-res image_key if available
   - Safari detected: SVG filter skipped, CSS-only glass effect used instead
   - SVG distortion lowered (scale 12, larger waves) for less wobble in centre
   - Clickable zones fixed: pointer-events:auto on lensInnerEl and lensMapEl
*/

(function () {
  const APP_ID = "canyon_map";

  // Detect Safari once. Safari breaks SVG feDisplacementMap on CSS-transformed elements.
  const IS_SAFARI = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);

  const DEFAULTS = {
    title:        "Coffin Canyon — Canyon Map",
    mapUrl:       "https://raw.githubusercontent.com/steamcrow/coffin/main/rules/apps/canyon_map/data/canyon_map.json",
    stateUrl:     "https://raw.githubusercontent.com/steamcrow/coffin/main/rules/apps/canyon_map/data/canyon_state.json",
    locationsUrl: "https://raw.githubusercontent.com/steamcrow/coffin/main/rules/src/170_named_locations.json",
    appCssUrl:    "https://raw.githubusercontent.com/steamcrow/coffin/main/rules/apps/canyon_map/cc_canyon_map.css",
    leafletCssUrl:"https://raw.githubusercontent.com/steamcrow/coffin/main/rules/vendor/leaflet/leaflet.css",
    leafletJsUrl: "https://raw.githubusercontent.com/steamcrow/coffin/main/rules/vendor/leaflet/leaflet.js",
    lensEnabled:       true,
    lensZoomOffset:    0.5,
    allowMapDrag:      false,
    factionColors: {
      monster_rangers: "#4caf50", monsterologists: "#ff9800",
      monsters: "#9c27b0", liberty_corps: "#03a9f4", neutral: "#9e9e9e"
    },
    statusStyles: {
      controlled: { fillOpacity: 0.35 },
      contested:  { fillOpacity: 0.18, dashArray: "6 6" },
      neutral:    { fillOpacity: 0.12 }
    }
  };

  // ================================================================
  // HITBOX DATA
  // ================================================================
  const COFFIN_PLACES_HITBOXES = {
    "bandit-buck":      [2613,1584,2824,1927], "bayou-city":      [1175,2501,1386,2767],
    "cowtown":          [2166,2079,2356,2404], "crackpits":       [2605,1138,2859,1427],
    "deerhoof":         [3112,2130,3329,2412], "diablo":          [505, 1432,716, 1698],
    "dustbuck":         [1974,2243,2164,2542], "fool-boot":       [1631,1752,1818,1872],
    "fort-plunder":     [3348,1209,3631,1427], "fortune":         [2887,1284,3121,1567],
    "ghost-mountain":   [2597,205, 2849,489],  "gore-mule-drop":  [2849,1608,3083,2082],
    "grade-grind":      [3167,790, 3378,1133], "heckweed":        [2229,1334,2447,1526],
    "huck":             [3332,2569,3550,2749], "kraise":          [2022,1243,2217,1524],
    "little-rica":      [2964,500, 3182,784],  "lost-yots":       [1582,1303,1960,1616],
    "martygrail":       [2436,1971,2714,2315], "mindshaft":       [3008,812, 3101,1261],
    "pallor":           [1325,1609,2086,1822], "plata":           [2513,916, 2765,1089],
    "quinne-jimmy":     [1687,810, 1877,1172], "ratsville":       [1450,1941,1661,2219],
    "rey":              [19,  1883,230, 2046],  "river-city":      [1068,1595,1279,1861],
    "sangr":            [1105,1172,1315,1573], "santos-grin":     [1185,1898,1396,2176],
    "silverpit":        [2132,1537,2321,1746], "skull-water":     [1609,492, 1841,701],
    "splitglass-arroyo":[735, 1417,1046,1673], "tin-flats":       [1334,1161,1545,1562],
    "tzulto":           [2331,1542,2587,1885], "widowflow":       [1659,1820,1998,1963],
    "witches-roost":    [3767,2130,3965,2495]
  };

  // ================================================================
  // UTILS
  // ================================================================
  function el(tag, attrs = {}, children = []) {
    const n = document.createElement(tag);
    Object.entries(attrs).forEach(([k, v]) => {
      if (k === "class") n.className = v;
      else if (k === "style") n.setAttribute("style", v);
      else if (k.startsWith("on") && typeof v === "function") n.addEventListener(k.slice(2).toLowerCase(), v);
      else n.setAttribute(k, v);
    });
    children.forEach(c => n.appendChild(typeof c === "string" ? document.createTextNode(c) : c));
    return n;
  }

  function clamp(n, min, max) { return Math.max(min, Math.min(max, n)); }

  function rafThrottle(fn) {
    let pending = false, lastArgs = null;
    return function (...args) {
      lastArgs = args;
      if (pending) return;
      pending = true;
      requestAnimationFrame(() => { pending = false; fn(...lastArgs); });
    };
  }

  // ================================================================
  // SVG LENS FILTER
  // Skipped on Safari — the CSS glass fallback (.cc-safari rules) is used there.
  // On Chrome: lower scale (12 vs 22 before) + larger wave pattern (lower baseFrequency)
  // produces a smoother barrel-like warp that is calmer in the centre and
  // more aggressive toward the edges where the wave amplitude is naturally higher.
  // ================================================================
  function ensureLensFilter() {
    if (IS_SAFARI) return;
    if (document.getElementById("cc-lens-warp-svg")) return;

    const ns = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(ns, "svg");
    svg.id = "cc-lens-warp-svg";
    svg.setAttribute("style", "position:absolute;left:-9999px;top:-9999px;width:1px;height:1px;overflow:hidden");
    svg.setAttribute("aria-hidden", "true");
    svg.setAttribute("xmlns", ns);

    const filter = document.createElementNS(ns, "filter");
    filter.id = "ccLensWarp";
    filter.setAttribute("x", "-15%");
    filter.setAttribute("y", "-15%");
    filter.setAttribute("width", "130%");
    filter.setAttribute("height", "130%");
    filter.setAttribute("color-interpolation-filters", "sRGB");

    // Low baseFrequency = large slow waves = barrel-distortion feel rather than noise
    // 3 octaves (not 4) = less fine-grain detail = cleaner centre
    const turbulence = document.createElementNS(ns, "feTurbulence");
    turbulence.setAttribute("type", "fractalNoise");
    turbulence.setAttribute("baseFrequency", "0.014 0.010");
    turbulence.setAttribute("numOctaves", "3");
    turbulence.setAttribute("seed", "42");
    turbulence.setAttribute("result", "noise");

    // scale=12: visibly warped at edges, notably calmer in the centre
    const displacement = document.createElementNS(ns, "feDisplacementMap");
    displacement.setAttribute("in", "SourceGraphic");
    displacement.setAttribute("in2", "noise");
    displacement.setAttribute("scale", "12");
    displacement.setAttribute("xChannelSelector", "R");
    displacement.setAttribute("yChannelSelector", "G");
    displacement.setAttribute("result", "warped");

    // Warm amber tint — aged brass-mounted glass
    const colorMatrix = document.createElementNS(ns, "feColorMatrix");
    colorMatrix.setAttribute("type", "matrix");
    colorMatrix.setAttribute("in", "warped");
    colorMatrix.setAttribute("values",
      "1.07 0.03 0    0 0.018 " +
      "0    1.02 0.01 0 0.008 " +
      "0    0    0.88 0 0     " +
      "0    0    0    1 0"
    );

    filter.appendChild(turbulence);
    filter.appendChild(displacement);
    filter.appendChild(colorMatrix);
    svg.appendChild(filter);
    document.body.appendChild(svg);
  }

  // ================================================================
  // NETWORK
  // ================================================================
  let _initController = null;

  function newInitSession() {
    if (_initController) _initController.abort();
    _initController = new AbortController();
    return _initController.signal;
  }

  async function fetchJson(url, signal) {
    const res = await fetch(url + (url.includes("?") ? "&" : "?") + "t=" + Date.now(), { signal });
    if (!res.ok) throw new Error(`Fetch failed: ${res.status}`);
    return res.json();
  }

  async function fetchText(url) {
    const res = await fetch(url + (url.includes("?") ? "&" : "?") + "t=" + Date.now());
    if (!res.ok) throw new Error(`Fetch failed: ${res.status}`);
    return res.text();
  }

  const _loaded = { css: new Set(), js: new Set() };

  async function loadCssOnce(url, key) {
    if (_loaded.css.has(key)) return;
    const css = await fetchText(url);
    document.head.appendChild(el("style", { "data-cc-style": key }, [css]));
    _loaded.css.add(key);
  }

  async function loadScriptOnce(url, key) {
    if (_loaded.js.has(key)) return;
    const code = await fetchText(url);
    const blob = new Blob([code], { type: "text/javascript" });
    const blobUrl = URL.createObjectURL(blob);
    await new Promise(resolve => {
      const s = document.createElement("script");
      s.src = blobUrl;
      s.onload = () => { URL.revokeObjectURL(blobUrl); resolve(); };
      document.head.appendChild(s);
    });
    _loaded.js.add(key);
  }

  // ================================================================
  // UI RENDERERS
  // ================================================================
  function renderMeterBar(value, max, color) {
    const pct = Math.round((value / max) * 100);
    return `
      <div style="width:100%;height:24px;background:rgba(255,255,255,0.08);border-radius:12px;
                  overflow:hidden;position:relative;border:1px solid rgba(255,255,255,0.12);">
        <div style="height:100%;width:${pct}%;background:linear-gradient(90deg,${color},${color}88);
                    transition:width 0.3s;"></div>
        <div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;
                    color:#fff;font-weight:700;font-size:0.85rem;">${value} / ${max}</div>
      </div>`;
  }

  function renderLocationDrawer(ui, location) {
    ui.drawerTitleEl.textContent = location.name;
    ui.drawerContentEl.innerHTML = `
      <div class="cc-block"><div class="cc-h">Description</div>
        <p>${location.description || "No description."}</p></div>
      <div class="cc-block"><div class="cc-h">Danger</div>
        ${renderMeterBar(location.danger || 0, 6, "#ff4444")}</div>
      <div class="cc-block"><div class="cc-h">Population</div>
        ${renderMeterBar(location.population || 0, 6, "#4caf50")}</div>
      ${location.atmosphere
        ? `<div class="cc-block"><div class="cc-h">Atmosphere</div>
           <p style="font-style:italic;color:#aaa;">"${location.atmosphere}"</p></div>`
        : ""}
      <div style="display:flex;flex-wrap:wrap;gap:0.5rem;">
        ${(location.features || []).map(f =>
          `<span style="padding:4px 10px;background:rgba(255,117,24,0.2);
                        border:1px solid rgba(255,117,24,0.4);border-radius:4px;
                        font-size:0.85rem;">${f}</span>`
        ).join("")}
      </div>`;
  }

  // ================================================================
  // MAIN MOUNT
  // ================================================================
  async function mount(root, userOpts) {
    const opts = { ...DEFAULTS, ...(userOpts || {}) };

    ensureLensFilter();

    // Tag Safari so CSS can apply its glass fallback
    if (IS_SAFARI) root.classList.add("cc-safari");

    // Spin keyframe for the preloader
    if (!document.getElementById("cc-spin-style")) {
      document.head.appendChild(el("style", { id: "cc-spin-style" }, [
        "@keyframes cc-spin{0%{transform:rotate(0deg)}100%{transform:rotate(360deg)}}"
      ]));
    }

    // ------------------------------------------------------------------
    // BUILD DOM
    // ------------------------------------------------------------------
    const fragment = document.createDocumentFragment();
    root.classList.add("cc-canyon-map");

    const header = el("div", { class: "cc-cm-header" }, [
      el("div", { class: "cc-cm-title" }, [opts.title]),
      el("div", { class: "cc-cm-actions" }, [
        el("button", { class: "cc-btn", id: "cc-cm-reload" }, ["Reload"]),
        el("button", { class: "cc-btn", id: "cc-cm-fit"    }, ["Fit"])
      ])
    ]);

    // ID is critical here — CSS targets #cc-cm-map, not the class
    const mapEl = el("div", { id: "cc-cm-map", class: "cc-cm-map" });

    // ID is critical here — CSS targets #cc-lens-map
    // pointer-events:auto overrides the parent .cc-lens pointer-events:none
    // so Leaflet rectangle clicks can register
    const lensMapEl = el("div", {
      id: "cc-lens-map",
      style: "width:100%;height:100%;pointer-events:auto;"
    });

    // .cc-lens is pointer-events:none so it doesn't block the base map below it.
    // But the inner chain needs pointer-events:auto so clicks reach Leaflet's overlay pane.
    const lensInnerEl = el("div", {
      class: "cc-lens-inner",
      style: "pointer-events:auto;"
    }, [
      el("div", {
        class: "cc-lens-overscan",
        style: "pointer-events:auto;"
      }, [lensMapEl])
    ]);

    const lensEl = el("div", { class: "cc-lens" }, [
      lensInnerEl,
      el("div", { class: "cc-lens-chromatic" }),  // decorative, pointer-events:none via CSS
      el("div", { class: "cc-lens-glare"     })   // decorative, pointer-events:none via CSS
    ]);

    // Preloader overlay — full-coverage spinner while data fetches
    const loaderEl = el("div", {
      id: "cc-map-loader",
      style: [
        "position:absolute;inset:0;z-index:200;",
        "display:flex;flex-direction:column;align-items:center;justify-content:center;",
        "background:rgba(0,0,0,0.82);border-radius:10px;",
        "transition:opacity 0.4s ease;"
      ].join("")
    }, [
      el("div", { style: [
        "width:56px;height:56px;",
        "border:4px solid rgba(255,117,24,0.2);",
        "border-top:4px solid #ff7518;",
        "border-radius:50%;",
        "animation:cc-spin 1s linear infinite;"
      ].join("") }),
      el("div", { style: [
        "color:#ff7518;margin-top:16px;",
        "font-weight:700;font-size:0.9rem;",
        "letter-spacing:2px;text-transform:uppercase;"
      ].join("") }, ["Loading..."])
    ]);

    const drawer = el("div", { class: "cc-cm-drawer" }, [
      el("div", { class: "cc-cm-drawer-head" }, [
        el("div", { class: "cc-cm-drawer-title" }, ["Location"]),
        el("button", { class: "cc-btn cc-btn-x", id: "close-dr" }, ["×"])
      ]),
      el("div", { class: "cc-cm-drawer-content" })
    ]);

    const body = el("div", { class: "cc-cm-body cc-cm-body--lens" }, [
      el("div", { class: "cc-cm-mapwrap" }, [
        mapEl, lensEl, loaderEl,
        el("div", { class: "cc-frame-overlay" }),
        el("div", { class: "cc-scroll-vertical"   }, [el("div", { class: "cc-scroll-knob", id: "cc-scroll-knob-v" })]),
        el("div", { class: "cc-scroll-horizontal" }, [el("div", { class: "cc-scroll-knob", id: "cc-scroll-knob-h" })])
      ])
    ]);

    fragment.append(header, body, drawer);
    root.innerHTML = "";
    root.appendChild(fragment);

    const ui = {
      mapEl, lensMapEl, lensEl,
      drawerEl:        drawer,
      drawerTitleEl:   drawer.querySelector(".cc-cm-drawer-title"),
      drawerContentEl: drawer.querySelector(".cc-cm-drawer-content"),
      knobV: root.querySelector("#cc-scroll-knob-v"),
      knobH: root.querySelector("#cc-scroll-knob-h")
    };

    function showLoader() { loaderEl.style.opacity = "1"; loaderEl.style.display = "flex"; }
    function hideLoader() {
      loaderEl.style.opacity = "0";
      setTimeout(() => { loaderEl.style.display = "none"; }, 420);
    }

    // ------------------------------------------------------------------
    // DEPENDENCIES
    // ------------------------------------------------------------------
    await loadCssOnce(opts.leafletCssUrl, "leaflet_css");
    await loadScriptOnce(opts.leafletJsUrl, "leaflet_js");
    await loadCssOnce(opts.appCssUrl, "app_css");

    let mainMap, lensMap, mapDoc, stateDoc, locationsData;

    // ------------------------------------------------------------------
    // LENS SYNC — keeps lens centred on the same point as the main map
    // ------------------------------------------------------------------
    const syncLens = rafThrottle(() => {
      if (!lensMap || !mainMap) return;
      lensMap.setView(mainMap.getCenter(), mainMap.getZoom() + opts.lensZoomOffset, { animate: false });
    });

    // ------------------------------------------------------------------
    // KNOB POSITION — reflects current map centre on the knob track
    // ------------------------------------------------------------------
    function updateKnobs(px) {
      if (!mainMap) return;
      const c = mainMap.getCenter();
      ui.knobV.style.top  = `${clamp(c.lat / px.h, 0, 1) * 100}%`;
      ui.knobH.style.left = `${clamp(c.lng / px.w, 0, 1) * 100}%`;
    }

    // ------------------------------------------------------------------
    // MOMENTUM KNOB SYSTEM
    //
    // Step-by-step for a 10-year-old:
    //   1. You grab the knob (onDown). We stop any moving that's already happening.
    //   2. You drag (onMove). We move the map by how far you dragged,
    //      and we remember how fast you were going.
    //   3. You let go (onUp). We keep moving the map at that speed,
    //      but slow it down a little each frame (friction) until it stops.
    // ------------------------------------------------------------------
    function bindKnob(knobEl, axis) {
      const FRICTION = 0.88;  // Each frame, speed becomes 88% of what it was
      const MIN_VEL  = 0.4;   // Stop once speed drops below this (map units/frame)

      let dragging   = false;
      let lastClient = 0;
      let lastTime   = 0;
      let velocity   = 0;
      let rafId      = null;

      function getClient(e) {
        const src = e.touches ? e.touches[0] : e;
        return axis === "v" ? src.clientY : src.clientX;
      }

      function getTrackPx() {
        const r = knobEl.parentElement.getBoundingClientRect();
        return axis === "v" ? r.height : r.width;
      }

      function pixToMapUnits(pxDelta) {
        const imgPx  = mapDoc.map.background.image_pixel_size;
        const range  = axis === "v" ? imgPx.h : imgPx.w;
        return (pxDelta / getTrackPx()) * range;
      }

      function applyDelta(mapDelta) {
        if (!mainMap || !mapDoc) return;
        const c     = mainMap.getCenter();
        const imgPx = mapDoc.map.background.image_pixel_size;
        if (axis === "v") {
          mainMap.panTo([clamp(c.lat + mapDelta, 0, imgPx.h), c.lng], { animate: false });
        } else {
          mainMap.panTo([c.lat, clamp(c.lng + mapDelta, 0, imgPx.w)], { animate: false });
        }
      }

      function momentumLoop() {
        if (Math.abs(velocity) < MIN_VEL) { rafId = null; return; }
        applyDelta(velocity);
        velocity *= FRICTION;
        rafId = requestAnimationFrame(momentumLoop);
      }

      function onDown(e) {
        if (rafId) { cancelAnimationFrame(rafId); rafId = null; }
        dragging   = true;
        velocity   = 0;
        lastClient = getClient(e);
        lastTime   = performance.now();
        knobEl.classList.add("is-active");
        e.stopPropagation();
        e.preventDefault();
      }

      function onMove(e) {
        if (!dragging) return;
        const now      = performance.now();
        const client   = getClient(e);
        const pxDelta  = client - lastClient;
        const dt       = Math.max(now - lastTime, 1);
        const mapDelta = pixToMapUnits(pxDelta);

        applyDelta(mapDelta);
        velocity   = mapDelta / dt * 16;  // normalise to ~60fps frame
        lastClient = client;
        lastTime   = now;
        e.preventDefault();
      }

      function onUp() {
        if (!dragging) return;
        dragging = false;
        knobEl.classList.remove("is-active");
        rafId = requestAnimationFrame(momentumLoop);
      }

      knobEl.addEventListener("mousedown",  onDown);
      knobEl.addEventListener("touchstart", onDown, { passive: false });
      window.addEventListener("mousemove",  onMove);
      window.addEventListener("touchmove",  onMove, { passive: false });
      window.addEventListener("mouseup",    onUp);
      window.addEventListener("touchend",   onUp);
    }

    // ------------------------------------------------------------------
    // INIT
    // ------------------------------------------------------------------
    async function init() {
      showLoader();
      const signal = newInitSession();

      [mapDoc, stateDoc, locationsData] = await Promise.all([
        fetchJson(opts.mapUrl,       signal),
        fetchJson(opts.stateUrl,     signal),
        fetchJson(opts.locationsUrl, signal)
      ]);

      if (mainMap) { try { mainMap.remove(); } catch(e) {} }
      if (lensMap) { try { lensMap.remove(); } catch(e) {} }

      const px     = mapDoc.map.background.image_pixel_size;
      const bounds = [[0, 0], [px.h, px.w]];

      // ---- BACKGROUND MAP ----
      mainMap = window.L.map(ui.mapEl, {
        crs: window.L.CRS.Simple,
        minZoom: -2, maxZoom: 2,
        dragging: false, zoomControl: false, attributionControl: false
      });
      window.L.imageOverlay(mapDoc.map.background.image_key, bounds).addTo(mainMap);
      mainMap.setMaxBounds(bounds);  // Stops panning past image edges
      mainMap.fitBounds(bounds);

      // If the container wasn't fully laid out at Leaflet init time,
      // the map renders too small. This corrects it after one paint frame.
      setTimeout(() => {
        mainMap.invalidateSize({ animate: false });
        mainMap.fitBounds(bounds);
      }, 80);

      // ---- LENS MAP ----
      // Use the dedicated high-res lens image if defined, otherwise use the same image.
      const lensImageUrl = mapDoc.map?.lens?.image_key || mapDoc.map.background.image_key;

      lensMap = window.L.map(ui.lensMapEl, {
        crs: window.L.CRS.Simple,
        dragging: false, zoomControl: false, attributionControl: false
      });
      window.L.imageOverlay(lensImageUrl, bounds).addTo(lensMap);
      lensMap.setMaxBounds(bounds);  // Keeps both maps hitting edges at the same moment

      // ---- HITBOXES ----
      // Rectangles on lensMap are clickable because lensInnerEl + lensMapEl
      // have pointer-events:auto set in the DOM construction above.
      locationsData.locations.forEach(loc => {
        const bbox = COFFIN_PLACES_HITBOXES[loc.id];
        if (!bbox) return;

        const rect = window.L.rectangle(
          [[bbox[0], bbox[1]], [bbox[2], bbox[3]]],
          { color: "rgba(255,117,24,0.6)", fillOpacity: 0.3, weight: 2, interactive: true }
        ).addTo(lensMap);

        rect.on("click", e => {
          window.L.DomEvent.stopPropagation(e);
          renderLocationDrawer(ui, loc);
          ui.drawerEl.classList.add("open");
        });

        window.L.marker(
          [(bbox[0] + bbox[2]) / 2, (bbox[1] + bbox[3]) / 2],
          {
            icon: window.L.divIcon({
              className: "cc-location-label",
              html: `<div style="color:#fff;font-weight:800;text-shadow:0 2px 4px #000;">
                       ${loc.emoji || "📍"} ${loc.name}
                     </div>`
            }),
            interactive: false
          }
        ).addTo(lensMap);
      });

      // ---- EVENTS ----
      mainMap.on("move", () => { syncLens(); updateKnobs(px); });

      bindKnob(ui.knobV, "v");
      bindKnob(ui.knobH, "h");

      window.addEventListener("resize", rafThrottle(() => {
        if (mainMap) mainMap.invalidateSize({ animate: false });
        if (lensMap)  lensMap.invalidateSize({ animate: false });
      }));

      syncLens();
      updateKnobs(px);
      hideLoader();
    }

    // ------------------------------------------------------------------
    // BUTTON WIRING
    // ------------------------------------------------------------------
    root.querySelector("#cc-cm-reload").onclick = () => init().catch(console.error);
    root.querySelector("#close-dr").onclick     = () => ui.drawerEl.classList.remove("open");
    root.querySelector("#cc-cm-fit").onclick    = () => {
      if (!mainMap || !mapDoc) return;
      const p = mapDoc.map.background.image_pixel_size;
      mainMap.fitBounds([[0, 0], [p.h, p.w]]);
    };

    await init();
  }

  window.CC_CanyonMap = { mount };
})();
