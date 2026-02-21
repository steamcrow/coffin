/* File: rules/apps/canyon_map/cc_canyon_map_app.js
   Coffin Canyon — Canyon Map
   COMPLETE OPTIMIZED VERSION - No features omitted.
   Changes:
   - Added ensureLensFilter() — injects the SVG warp filter that was missing
   - Added .cc-lens-chromatic layer for edge colour fringing
   - Fixed bug: location.name → loc.name in marker label
*/

(function () {
  const APP_ID = "canyon_map";

  const DEFAULTS = {
    title: "Coffin Canyon — Canyon Map",
    mapUrl: "https://raw.githubusercontent.com/steamcrow/coffin/main/rules/apps/canyon_map/data/canyon_map.json",
    stateUrl: "https://raw.githubusercontent.com/steamcrow/coffin/main/rules/apps/canyon_map/data/canyon_state.json",
    locationsUrl: "https://raw.githubusercontent.com/steamcrow/coffin/main/rules/src/170_named_locations.json",
    appCssUrl: "https://raw.githubusercontent.com/steamcrow/coffin/main/rules/apps/canyon_map/cc_canyon_map.css",
    uiCssUrl: "https://raw.githubusercontent.com/steamcrow/coffin/main/rules/ui/cc_ui.css",
    leafletCssUrl: "https://raw.githubusercontent.com/steamcrow/coffin/main/rules/vendor/leaflet/leaflet.css",
    leafletJsUrl: "https://raw.githubusercontent.com/steamcrow/coffin/main/rules/vendor/leaflet/leaflet.js",
    lensEnabled: true,
    lensZoomOffset: .5,
    lockHorizontalPan: false,
    maxHorizontalDriftPx: 260,
    allowMapDrag: false,
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

  // --- HITBOX DATA ---
  const COFFIN_PLACES_HITBOXES = {
    "bandit-buck": [2613, 1584, 2824, 1927], "bayou-city": [1175, 2501, 1386, 2767],
    "cowtown": [2166, 2079, 2356, 2404], "crackpits": [2605, 1138, 2859, 1427],
    "deerhoof": [3112, 2130, 3329, 2412], "diablo": [505, 1432, 716, 1698],
    "dustbuck": [1974, 2243, 2164, 2542], "fool-boot": [1631, 1752, 1818, 1872],
    "fort-plunder": [3348, 1209, 3631, 1427], "fortune": [2887, 1284, 3121, 1567],
    "ghost-mountain": [2597, 205, 2849, 489], "gore-mule-drop": [2849, 1608, 3083, 2082],
    "grade-grind": [3167, 790, 3378, 1133], "heckweed": [2229, 1334, 2447, 1526],
    "huck": [3332, 2569, 3550, 2749], "kraise": [2022, 1243, 2217, 1524],
    "little-rica": [2964, 500, 3182, 784], "lost-yots": [1582, 1303, 1960, 1616],
    "martygrail": [2436, 1971, 2714, 2315], "mindshaft": [3008, 812, 3101, 1261],
    "pallor": [1325, 1609, 2086, 1822], "plata": [2513, 916, 2765, 1089],
    "quinne-jimmy": [1687, 810, 1877, 1172], "ratsville": [1450, 1941, 1661, 2219],
    "rey": [19, 1883, 230, 2046], "river-city": [1068, 1595, 1279, 1861],
    "sangr": [1105, 1172, 1315, 1573], "santos-grin": [1185, 1898, 1396, 2176],
    "silverpit": [2132, 1537, 2321, 1746], "skull-water": [1609, 492, 1841, 701],
    "splitglass-arroyo": [735, 1417, 1046, 1673], "tin-flats": [1334, 1161, 1545, 1562],
    "tzulto": [2331, 1542, 2587, 1885], "widowflow": [1659, 1820, 1998, 1963],
    "witches-roost": [3767, 2130, 3965, 2495]
  };

  // --- UTILS ---
  function el(tag, attrs = {}, children = []) {
    const n = document.createElement(tag);
    Object.entries(attrs).forEach(([k, v]) => {
      if (k === "class") n.className = v;
      else if (k === "style") n.setAttribute("style", v);
      else if (k.startsWith("on") && typeof v === "function") n.addEventListener(k.slice(2).toLowerCase(), v);
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

  // --- LENS DISTORTION FILTER ---
  // Injects a hidden SVG into the page that defines the glass warp effect.
  // The CSS references this filter by ID: filter: url(#ccLensWarp)
  // Without this function being called, the filter doesn't exist and nothing warps.
  function ensureLensFilter() {
    // Only inject once — if it already exists on the page, skip it
    if (document.getElementById("cc-lens-warp-svg")) return;

    const ns = "http://www.w3.org/2000/svg";

    // The SVG is parked off-screen — it's invisible but the browser can still
    // reference filters defined inside it
    const svg = document.createElementNS(ns, "svg");
    svg.id = "cc-lens-warp-svg";
    // width/height must be at least 1px — Safari ignores SVG filters on 0-size elements
    svg.setAttribute("style", "position:absolute;left:-9999px;top:-9999px;width:1px;height:1px;overflow:hidden");
    svg.setAttribute("aria-hidden", "true");
    svg.setAttribute("xmlns", ns);

    const filter = document.createElementNS(ns, "filter");
    filter.id = "ccLensWarp";
    // Expand the filter region so edge pixels don't get clipped when warped outward
    filter.setAttribute("x", "-15%");
    filter.setAttribute("y", "-15%");
    filter.setAttribute("width", "130%");
    filter.setAttribute("height", "130%");
    filter.setAttribute("color-interpolation-filters", "sRGB");

    // Step 1 — Generate organic fractal noise.
    // This is the "random unevenness" of old hand-ground glass.
    // baseFrequency: lower = smoother waves, higher = more chaotic scratchy look
    // numOctaves: more = more fine detail layered on top of the big waves
    // seed: just a fixed starting point so the warp looks the same every load
    const turbulence = document.createElementNS(ns, "feTurbulence");
    turbulence.setAttribute("type", "fractalNoise");
    turbulence.setAttribute("baseFrequency", "0.022 0.016");
    turbulence.setAttribute("numOctaves", "4");
    turbulence.setAttribute("seed", "42");
    turbulence.setAttribute("result", "noise");

    // Step 2 — Use the noise to physically displace (push around) the pixels.
    // scale="22" is heavy — crank it up toward 40 for grotesque old-glass warping,
    // pull it down toward 8 for subtle shimmer
    const displacement = document.createElementNS(ns, "feDisplacementMap");
    displacement.setAttribute("in", "SourceGraphic");
    displacement.setAttribute("in2", "noise");
    displacement.setAttribute("scale", "22");
    displacement.setAttribute("xChannelSelector", "R");
    displacement.setAttribute("yChannelSelector", "G");
    displacement.setAttribute("result", "warped");

    // Step 3 — Warm amber colour tint.
    // Old brass-mounted glass has a slightly yellowish cast — it boosts reds/greens
    // and pulls blue down, making everything look aged and warm.
    const colorMatrix = document.createElementNS(ns, "feColorMatrix");
    colorMatrix.setAttribute("type", "matrix");
    colorMatrix.setAttribute("in", "warped");
    colorMatrix.setAttribute(
      "values",
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

  // --- NETWORK ---
  // One AbortController per init() call — all fetches in that batch share it.
  // When init() fires again (e.g. Reload), the old controller is aborted first,
  // which cancels any still-in-flight requests from the previous load.
  // Individual fetches within the same init() do NOT abort each other.
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

  async function fetchText(url, signal) {
    const res = await fetch(url + (url.includes("?") ? "&" : "?") + "t=" + Date.now(), { signal });
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
    await new Promise((resolve) => {
      const s = el("script", { src: blobUrl, onload: () => { URL.revokeObjectURL(blobUrl); resolve(); } });
      document.head.appendChild(s);
    });
    _loaded.js.add(key);
  }

  // --- UI RENDERERS ---
  function renderMeterBar(value, max, color) {
    const pct = Math.round((value / max) * 100);
    return `
      <div style="width: 100%; height: 24px; background: rgba(255,255,255,0.08); border-radius: 12px; overflow: hidden; position: relative; border: 1px solid rgba(255,255,255,0.12);">
        <div style="height: 100%; width: ${pct}%; background: linear-gradient(90deg, ${color}, ${color}88); transition: width 0.3s;"></div>
        <div style="position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; color: #fff; font-weight: 700; font-size: 0.85rem;">${value} / ${max}</div>
      </div>`;
  }

  function renderLocationDrawer(ui, location) {
    ui.drawerTitleEl.textContent = location.name;
    ui.drawerContentEl.innerHTML = `
      <div class="cc-block"><div class="cc-h">Description</div><p>${location.description || 'No description.'}</p></div>
      <div class="cc-block"><div class="cc-h">Danger</div>${renderMeterBar(location.danger || 0, 6, '#ff4444')}</div>
      <div class="cc-block"><div class="cc-h">Population</div>${renderMeterBar(location.population || 0, 6, '#4caf50')}</div>
      ${location.atmosphere ? `<div class="cc-block"><div class="cc-h">Atmosphere</div><p style="font-style:italic; color:#aaa;">"${location.atmosphere}"</p></div>` : ''}
      <div style="display:flex; flex-wrap:wrap; gap:0.5rem;">
        ${(location.features || []).map(f => `<span style="padding:4px 10px; background:rgba(255,117,24,0.2); border:1px solid rgba(255,117,24,0.4); border-radius:4px; font-size:0.85rem;">${f}</span>`).join('')}
      </div>`;
  }

  // --- MAIN MOUNT ---
  async function mount(root, userOpts) {
    const opts = { ...DEFAULTS, ...(userOpts || {}) };

    // Inject the SVG lens warp filter into the page.
    // Must happen before the lens is rendered so the CSS filter reference resolves.
    ensureLensFilter();

    // UI Layout (Using DocumentFragment for performance)
    const fragment = document.createDocumentFragment();
    root.classList.add("cc-canyon-map");

    const header = el("div", { class: "cc-cm-header" }, [
      el("div", { class: "cc-cm-title" }, [opts.title]),
      el("div", { class: "cc-cm-actions" }, [
        el("button", { class: "cc-btn", id: "cc-cm-reload" }, ["Reload"]),
        el("button", { class: "cc-btn", id: "cc-cm-fit" }, ["Fit"])
      ])
    ]);

    const mapEl = el("div", { id: "cc-cm-map", class: "cc-cm-map" });
    const lensMapEl = el("div", { style: "width:100%; height:100%;" });

    // Lens structure:
    //   .cc-lens              — the outer shell (positioning, rim shadow)
    //     .cc-lens-inner      — the warped glass area (SVG filter applied here)
    //       .cc-lens-overscan — slightly oversized so warp doesn't show blank edges
    //     .cc-lens-chromatic  — colour fringe layer (warm red-orange + cool blue at rim)
    //     .cc-lens-glare      — specular highlight (the bright spot on the glass)
    const lensEl = el("div", { class: "cc-lens" }, [
      el("div", { class: "cc-lens-inner" }, [
        el("div", { class: "cc-lens-overscan" }, [lensMapEl])
      ]),
      el("div", { class: "cc-lens-chromatic" }),  // <-- NEW: edge colour fringing
      el("div", { class: "cc-lens-glare" })
    ]);

    const drawer = el("div", { class: "cc-cm-drawer" }, [
      el("div", { class: "cc-cm-drawer-head" }, [
        el("div", { class: "cc-cm-drawer-title" }, ["Location"]),
        el("button", { class: "cc-btn cc-btn-x", id: "close-dr" }, ["×"])
      ]),
      el("div", { class: "cc-cm-drawer-content" })
    ]);

    // --- PRELOADER ---
    // Simple overlay that covers the mapwrap while data is fetching.
    // showLoader() displays it, hideLoader() fades it out.
    const loaderEl = el("div", {
      id: "cc-map-loader",
      style: [
        "position:absolute;inset:0;z-index:200;",
        "display:flex;flex-direction:column;align-items:center;justify-content:center;",
        "background:rgba(0,0,0,0.75);border-radius:12px;",
        "transition:opacity 0.4s ease;"
      ].join("")
    }, [
      el("div", { style: "width:60px;height:60px;border:4px solid rgba(255,117,24,0.25);border-top:4px solid #ff7518;border-radius:50%;animation:cc-spin 1s linear infinite;" }),
      el("div", { style: "color:#ff7518;margin-top:18px;font-family:system-ui;font-weight:700;font-size:1rem;letter-spacing:2px;text-transform:uppercase;" }, ["Loading..."])
    ]);

    // Inject the spin keyframes once
    if (!document.getElementById("cc-spin-style")) {
      document.head.appendChild(el("style", { id: "cc-spin-style" }, [
        "@keyframes cc-spin { 0%{ transform:rotate(0deg) } 100%{ transform:rotate(360deg) } }"
      ]));
    }

    function showLoader() {
      loaderEl.style.opacity = "1";
      loaderEl.style.display = "flex";
    }

    function hideLoader() {
      loaderEl.style.opacity = "0";
      setTimeout(() => { loaderEl.style.display = "none"; }, 420);
    }

    const body = el("div", { class: "cc-cm-body cc-cm-body--lens" }, [
      el("div", { class: "cc-cm-mapwrap" }, [
        mapEl, lensEl, loaderEl, el("div", { class: "cc-frame-overlay" }),
        el("div", { class: "cc-scroll-vertical" }, [el("div", { class: "cc-scroll-knob", id: "cc-scroll-knob-v" })]),
        el("div", { class: "cc-scroll-horizontal" }, [el("div", { class: "cc-scroll-knob", id: "cc-scroll-knob-h" })])
      ])
    ]);

    fragment.append(header, body, drawer);
    root.innerHTML = "";
    root.appendChild(fragment);

    const ui = {
      mapEl, lensMapEl, lensEl,
      drawerEl: drawer,
      drawerTitleEl: drawer.querySelector(".cc-cm-drawer-title"),
      drawerContentEl: drawer.querySelector(".cc-cm-drawer-content"),
      knobV: root.querySelector("#cc-scroll-knob-v"),
      knobH: root.querySelector("#cc-scroll-knob-h")
    };

    // Dependencies
    await loadCssOnce(opts.leafletCssUrl, "leaflet_css");
    await loadScriptOnce(opts.leafletJsUrl, "leaflet_js");
    await loadCssOnce(opts.appCssUrl, "app_css");

    let mainMap, lensMap, mapDoc, stateDoc, locationsData;

    const syncLens = rafThrottle(() => {
      if (!lensMap || !mainMap) return;
      lensMap.setView(mainMap.getCenter(), mainMap.getZoom() + opts.lensZoomOffset, { animate: false });
    });

    // --- KNOB DRAG SYSTEM ---
    // Each knob (vertical + horizontal) is draggable.
    // Dragging a knob pans the mainMap, which then fires 'move',
    // which updates the knob position — completing the feedback loop.
    function bindKnob(knobEl, axis, getMapSize) {
      let dragging = false;
      let startPointer = 0;
      let startMapCoord = 0;

      function onDown(e) {
        dragging = true;
        knobEl.classList.add("is-active");
        startPointer = axis === "v" ? e.clientY : e.clientX;
        const c = mainMap.getCenter();
        startMapCoord = axis === "v" ? c.lat : c.lng;
        e.preventDefault();
      }

      function onMove(e) {
        if (!dragging || !mainMap) return;
        const client = axis === "v"
          ? (e.touches ? e.touches[0].clientY : e.clientY)
          : (e.touches ? e.touches[0].clientX : e.clientX);
        const delta = client - startPointer;
        const { w, h } = getMapSize();
        const trackSize = axis === "v" ? h : w;
        const { image_pixel_size: px } = mapDoc.map.background;
        const mapRange = axis === "v" ? px.h : px.w;
        // Convert pixel drag into map coordinate offset
        const coordDelta = (delta / trackSize) * mapRange;
        const c = mainMap.getCenter();
        if (axis === "v") {
          mainMap.panTo([startMapCoord + coordDelta, c.lng], { animate: false });
        } else {
          mainMap.panTo([c.lat, startMapCoord + coordDelta], { animate: false });
        }
      }

      function onUp() {
        dragging = false;
        knobEl.classList.remove("is-active");
      }

      knobEl.addEventListener("mousedown",  onDown);
      knobEl.addEventListener("touchstart", onDown, { passive: false });
      window.addEventListener("mousemove",  onMove);
      window.addEventListener("touchmove",  onMove, { passive: false });
      window.addEventListener("mouseup",    onUp);
      window.addEventListener("touchend",   onUp);
    }

    // --- KNOB POSITION UPDATER ---
    // Called whenever the map moves — slides the knob to reflect current position.
    function updateKnobs(px) {
      const c = mainMap.getCenter();
      const t = clamp(c.lat / px.h, 0, 1);
      const l = clamp(c.lng / px.w, 0, 1);
      // top/left are set as inline styles; CSS transform centers the knob on that point
      ui.knobV.style.top  = `${t * 100}%`;
      ui.knobH.style.left = `${l * 100}%`;
    }

    function getMapSize() {
      const r = ui.mapEl.getBoundingClientRect();
      return { w: r.width, h: r.height };
    }

    async function init() {
      showLoader();

      // Start a new load session — cancels any previous in-flight fetches
      const signal = newInitSession();

      [mapDoc, stateDoc, locationsData] = await Promise.all([
        fetchJson(opts.mapUrl, signal),
        fetchJson(opts.stateUrl, signal),
        fetchJson(opts.locationsUrl, signal)
      ]);

      if (mainMap) mainMap.remove();
      if (lensMap) lensMap.remove();

      const px = mapDoc.map.background.image_pixel_size;
      const bounds = [[0, 0], [px.h, px.w]];

      mainMap = window.L.map(ui.mapEl, {
        crs: window.L.CRS.Simple, minZoom: -2, maxZoom: 2,
        dragging: false, zoomControl: false, attributionControl: false
      });
      window.L.imageOverlay(mapDoc.map.background.image_key, bounds).addTo(mainMap);
      mainMap.fitBounds(bounds);

      lensMap = window.L.map(ui.lensMapEl, {
        crs: window.L.CRS.Simple, dragging: false, zoomControl: false, attributionControl: false
      });
      window.L.imageOverlay(mapDoc.map.background.image_key, bounds).addTo(lensMap);

      // Hitbox Injection
      locationsData.locations.forEach(loc => {
        const bbox = COFFIN_PLACES_HITBOXES[loc.id];
        if (!bbox) return;
        const rect = window.L.rectangle([[bbox[0], bbox[1]], [bbox[2], bbox[3]]], {
          color: 'rgba(255,117,24,0.6)', fillOpacity: 0.3, weight: 2, interactive: true
        }).addTo(lensMap);

        rect.on('click', (e) => {
          window.L.DomEvent.stopPropagation(e);
          renderLocationDrawer(ui, loc);
          ui.drawerEl.classList.add("open");
        });

        window.L.marker([(bbox[0] + bbox[2]) / 2, (bbox[1] + bbox[3]) / 2], {
          icon: window.L.divIcon({
            className: 'cc-location-label',
            html: `<div style="color:#fff;font-weight:800;text-shadow:0 2px 4px #000;">${loc.emoji || '📍'} ${loc.name}</div>`
          }),
          interactive: false
        }).addTo(lensMap);
      });

      // Sync lens and knobs whenever the main map moves
      mainMap.on('move', () => {
        syncLens();
        updateKnobs(px);
      });

      // Bind knob drag — must happen after mainMap exists
      bindKnob(ui.knobV, "v", getMapSize);
      bindKnob(ui.knobH, "h", getMapSize);

      // Initial sync
      syncLens();
      updateKnobs(px);

      hideLoader();
    }

    root.querySelector("#cc-cm-reload").onclick = init;
    root.querySelector("#close-dr").onclick = () => ui.drawerEl.classList.remove("open");
    root.querySelector("#cc-cm-fit").onclick = () => mainMap.fitBounds([[0,0],[mapDoc.map.background.image_pixel_size.h, mapDoc.map.background.image_pixel_size.w]]);

    await init();
  }

  window.CC_CanyonMap = { mount };
})();
