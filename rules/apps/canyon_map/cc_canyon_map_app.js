/* File: rules/apps/canyon_map/cc_canyon_map_app.js
   Coffin Canyon — Canyon Map
   ═══════════════════════════════════════════════════════════════

   HOW THE SCROLL SYSTEM WORKS (the "t" approach)
   ────────────────────────────────────────────────
   Instead of panning the two maps independently, everything goes
   through a single normalised scroll position called `t`:

     t = 0.0  →  top of the map
     t = 0.5  →  middle
     t = 1.0  →  bottom of the map

   For each map we compute a "safe centre range":
     safeMin = half the visible height in map-units
     safeMax = imageHeight − safeMin

   This guarantees the map edge always meets the container edge —
   the image never overscrolls into blank black space.

   Because the background map and the lens map use different zoom
   levels (and often different container sizes), their safe ranges
   are different numbers. But they BOTH use the same t, so they
   always hit their respective edges at exactly the same moment.

   SAFARI AND THE LENS DISTORTION
   ────────────────────────────────
   The glass-warp effect is an SVG filter (feDisplacementMap).
   Chrome, Firefox, and Edge support it on CSS-transformed divs.
   Safari does NOT — its GPU compositor silently drops the filter
   on any element that has a CSS transform applied, which is exactly
   what Leaflet does to its map pane. The filter just disappears.

   The code detects Safari via IS_SAFARI and skips injecting the
   filter entirely. Safari users still get the vignette, chromatic
   fringe, and glare from the CSS — just no pixel warp.

   To tune the distortion (Chrome/Firefox only):
     baseFrequency  — lower = bigger smoother waves, higher = finer chaotic grain
     numOctaves     — more octaves = more layered detail on top of the base wave
     seed           — just a starting number; changing it gives a different warp pattern
     scale          — MAIN STRENGTH KNOB. ~8 = subtle shimmer, ~22 = heavy old-glass,
                      ~40 = grotesque fun-house mirror
     colorMatrix    — the 4x5 matrix boosts red/green slightly and pulls blue down,
                      giving the warm amber tint of brass-mounted Victorian glass.
                      Set all non-diagonal values to 0 for no tint.

   PRELOADER
   ──────────
   Shows the Coffin Canyon logo PNG + spinner for at least
   MIN_LOADER_MS (5000 ms by default) regardless of how fast
   the data loads. If data takes longer, it waits for data too.
*/

(function () {

  // ═══════════════════════════════════════════════════════════════
  // TUNEABLE CONSTANTS — safe to adjust
  // ═══════════════════════════════════════════════════════════════

  // Background map zoom level.
  // In Leaflet CRS.Simple: zoom 0 = 1:1 pixels, zoom -1 = half size.
  // Lower = more of the map visible, less panning range.
  var BG_ZOOM = -1;

  // Minimum time (ms) the preloader stays on screen.
  var MIN_LOADER_MS = 5000;

  // Momentum physics for the brass knobs.
  // FRICTION: velocity multiplied by this each animation frame (0-1).
  //   0.95 = long coast, 0.80 = snappy stop
  var FRICTION = 0.88;
  // MIN_VEL: coast stops when velocity (in t-units/frame) drops below this.
  var MIN_VEL = 0.0003;

  // ═══════════════════════════════════════════════════════════════
  // SAFARI DETECTION
  // ═══════════════════════════════════════════════════════════════
  // feDisplacementMap is silently ignored in Safari on transformed elements.
  // We skip SVG filter injection entirely on Safari. CSS-only glass effects
  // (vignette, chromatic fringe, glare) still apply.
  var IS_SAFARI = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);

  // ═══════════════════════════════════════════════════════════════
  // DATA DEFAULTS
  // ═══════════════════════════════════════════════════════════════
  var DEFAULTS = {
    title:         "Coffin Canyon — Canyon Map",
    mapUrl:        "https://raw.githubusercontent.com/steamcrow/coffin/main/rules/apps/canyon_map/data/canyon_map.json",
    stateUrl:      "https://raw.githubusercontent.com/steamcrow/coffin/main/rules/apps/canyon_map/data/canyon_state.json",
    locationsUrl:  "https://raw.githubusercontent.com/steamcrow/coffin/main/rules/src/170_named_locations.json",
    appCssUrl:     "https://raw.githubusercontent.com/steamcrow/coffin/main/rules/apps/canyon_map/cc_canyon_map.css",
    leafletCssUrl: "https://raw.githubusercontent.com/steamcrow/coffin/main/rules/vendor/leaflet/leaflet.css",
    leafletJsUrl:  "https://raw.githubusercontent.com/steamcrow/coffin/main/rules/vendor/leaflet/leaflet.js",
    logoUrl:       "https://raw.githubusercontent.com/steamcrow/coffin/main/rules/apps/canyon_map/data/coffin_canyon_logo.png",
    lensZoomOffset: 0.5  // lens zoom = BG_ZOOM + this. Higher = more magnification.
  };

  // ═══════════════════════════════════════════════════════════════
  // LOCATION HITBOXES
  // [minY, minX, maxY, maxX] in image pixels
  // ═══════════════════════════════════════════════════════════════
  var HITBOXES = {
    "bandit-buck":       [2613,1584,2824,1927], "bayou-city":       [1175,2501,1386,2767],
    "cowtown":           [2166,2079,2356,2404], "crackpits":        [2605,1138,2859,1427],
    "deerhoof":          [3112,2130,3329,2412], "diablo":           [505, 1432,716, 1698],
    "dustbuck":          [1974,2243,2164,2542], "fool-boot":        [1631,1752,1818,1872],
    "fort-plunder":      [3348,1209,3631,1427], "fortune":          [2887,1284,3121,1567],
    "ghost-mountain":    [2597,205, 2849,489],  "gore-mule-drop":   [2849,1608,3083,2082],
    "grade-grind":       [3167,790, 3378,1133], "heckweed":         [2229,1334,2447,1526],
    "huck":              [3332,2569,3550,2749], "kraise":           [2022,1243,2217,1524],
    "little-rica":       [2964,500, 3182,784],  "lost-yots":        [1582,1303,1960,1616],
    "martygrail":        [2436,1971,2714,2315], "mindshaft":        [3008,812, 3101,1261],
    "pallor":            [1325,1609,2086,1822], "plata":            [2513,916, 2765,1089],
    "quinne-jimmy":      [1687,810, 1877,1172], "ratsville":        [1450,1941,1661,2219],
    "rey":               [19,  1883,230, 2046],  "river-city":       [1068,1595,1279,1861],
    "sangr":             [1105,1172,1315,1573], "santos-grin":      [1185,1898,1396,2176],
    "silverpit":         [2132,1537,2321,1746], "skull-water":      [1609,492, 1841,701],
    "splitglass-arroyo": [735, 1417,1046,1673], "tin-flats":        [1334,1161,1545,1562],
    "tzulto":            [2331,1542,2587,1885], "widowflow":        [1659,1820,1998,1963],
    "witches-roost":     [3767,2130,3965,2495]
  };

  // ═══════════════════════════════════════════════════════════════
  // UTILITIES
  // ═══════════════════════════════════════════════════════════════
  function el(tag, attrs, children) {
    attrs    = attrs    || {};
    children = children || [];
    var n = document.createElement(tag);
    Object.keys(attrs).forEach(function(k) {
      var v = attrs[k];
      if (k === "class") n.className = v;
      else if (k === "style") n.setAttribute("style", v);
      else if (k.indexOf("on") === 0 && typeof v === "function")
        n.addEventListener(k.slice(2).toLowerCase(), v);
      else n.setAttribute(k, v);
    });
    children.forEach(function(c) {
      n.appendChild(typeof c === "string" ? document.createTextNode(c) : c);
    });
    return n;
  }

  function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

  function rafThrottle(fn) {
    var pending = false, lastArgs;
    return function() {
      lastArgs = arguments;
      if (pending) return;
      pending = true;
      requestAnimationFrame(function() { pending = false; fn.apply(null, lastArgs); });
    };
  }

  function nextFrame() { return new Promise(function(r) { requestAnimationFrame(r); }); }
  function delay(ms)   { return new Promise(function(r) { setTimeout(r, ms); }); }

  // ═══════════════════════════════════════════════════════════════
  // SVG LENS WARP FILTER  (Chrome / Firefox / Edge only — not Safari)
  // See the header comment block for tuning guidance.
  // ═══════════════════════════════════════════════════════════════
  function ensureLensFilter() {
    if (IS_SAFARI) return; // Safari silently drops this filter — skip it
    if (document.getElementById("cc-lens-warp-svg")) return;

    var ns  = "http://www.w3.org/2000/svg";
    var svg = document.createElementNS(ns, "svg");
    svg.id  = "cc-lens-warp-svg";
    // Must be 1×1 (not 0×0) — some browsers discard zero-size off-screen SVGs
    svg.setAttribute("style",
      "position:absolute;left:-9999px;top:-9999px;width:1px;height:1px;overflow:hidden");
    svg.setAttribute("aria-hidden", "true");
    svg.setAttribute("xmlns", ns);

    var filter = document.createElementNS(ns, "filter");
    filter.id = "ccLensWarp";
    // Expand filter region so warped pixels at the edge don't get hard-clipped
    filter.setAttribute("x", "-15%");
    filter.setAttribute("y", "-15%");
    filter.setAttribute("width",  "130%");
    filter.setAttribute("height", "130%");
    filter.setAttribute("color-interpolation-filters", "sRGB");

    // ── Step 1: Generate organic fractal noise ──────────────────────────────
    // Creates a "map" showing how much to push each pixel around.
    // Think of it as the surface irregularity of old hand-ground glass.
    var turb = document.createElementNS(ns, "feTurbulence");
    turb.setAttribute("type",          "fractalNoise");
    turb.setAttribute("baseFrequency", "0.014 0.010");
    //  ↑ TUNE: lower (0.005) = big smooth rolls. Higher (0.05) = fine scratchy chaos.
    //    Two values: horizontal frequency then vertical. Can differ for directional bias.
    turb.setAttribute("numOctaves", "3");
    //  ↑ TUNE: adds layers of detail on top of the base wave.
    //    3 is subtle and performant. 6 is very complex. Cost is minimal either way.
    turb.setAttribute("seed", "42");
    //  ↑ TUNE: change this integer to get a completely different warp pattern.
    turb.setAttribute("result", "noise");

    // ── Step 2: Displace pixels using the noise map ─────────────────────────
    var disp = document.createElementNS(ns, "feDisplacementMap");
    disp.setAttribute("in",               "SourceGraphic");
    disp.setAttribute("in2",              "noise");
    disp.setAttribute("scale",            "12");
    //  ↑ TUNE: THIS IS THE MAIN STRENGTH KNOB.
    //    ~5  = barely visible shimmer (quality modern optics)
    //    ~12 = noticeable old-glass warp (current default)
    //    ~22 = heavy Victorian brass-lens distortion
    //    ~40 = grotesque fun-house mirror
    disp.setAttribute("xChannelSelector", "R"); // Red   channel drives horizontal push
    disp.setAttribute("yChannelSelector", "G"); // Green channel drives vertical push
    disp.setAttribute("result",           "warped");

    // ── Step 3: Warm amber tint ─────────────────────────────────────────────
    // Boosts reds and greens, dims blue — the warm yellowish cast of aged glass.
    // To remove the tint, delete the filter.appendChild(cm) line below.
    var cm = document.createElementNS(ns, "feColorMatrix");
    cm.setAttribute("type", "matrix");
    cm.setAttribute("in",   "warped");
    cm.setAttribute("values",
      //  R-out  G-in   B-in  A-in  const
      "  1.07   0.03   0     0    0.018 " + // Red slightly boosted
      "  0      1.02   0.01  0    0.008 " + // Green slightly boosted
      "  0      0      0.88  0    0     " + // Blue slightly dimmed
      "  0      0      0     1    0     "); // Alpha unchanged

    filter.appendChild(turb);
    filter.appendChild(disp);
    filter.appendChild(cm); // remove this line to disable the amber tint
    svg.appendChild(filter);
    document.body.appendChild(svg);
  }

  // ═══════════════════════════════════════════════════════════════
  // NETWORK HELPERS
  // ═══════════════════════════════════════════════════════════════
  var _initCtrl = null;
  function newSession() {
    if (_initCtrl) _initCtrl.abort();
    _initCtrl = new AbortController();
    return _initCtrl.signal;
  }

  function fetchJson(url, signal) {
    var u = url + (url.indexOf("?") >= 0 ? "&" : "?") + "t=" + Date.now();
    return fetch(u, { signal: signal }).then(function(r) {
      if (!r.ok) throw new Error("HTTP " + r.status + ": " + url);
      return r.json();
    });
  }

  function fetchText(url) {
    var u = url + (url.indexOf("?") >= 0 ? "&" : "?") + "t=" + Date.now();
    return fetch(u).then(function(r) {
      if (!r.ok) throw new Error("HTTP " + r.status + ": " + url);
      return r.text();
    });
  }

  var _loaded = { css: {}, js: {} };

  function loadCssOnce(url, key) {
    if (_loaded.css[key]) return Promise.resolve();
    return fetchText(url).then(function(css) {
      var s = document.createElement("style");
      s.setAttribute("data-cc-style", key);
      s.textContent = css;
      document.head.appendChild(s);
      _loaded.css[key] = true;
    });
  }

  function loadScriptOnce(url, key) {
    if (_loaded.js[key]) return Promise.resolve();
    return fetchText(url).then(function(code) {
      var blob    = new Blob([code], { type: "text/javascript" });
      var blobUrl = URL.createObjectURL(blob);
      return new Promise(function(resolve, reject) {
        var s    = document.createElement("script");
        s.src    = blobUrl;
        s.onload  = function() { URL.revokeObjectURL(blobUrl); resolve(); };
        s.onerror = function() { URL.revokeObjectURL(blobUrl); reject(new Error("Script load failed: " + url)); };
        document.head.appendChild(s);
      });
    }).then(function() { _loaded.js[key] = true; });
  }

  // ═══════════════════════════════════════════════════════════════
  // DRAWER RENDERER
  // ═══════════════════════════════════════════════════════════════
  function meterBar(value, max, color) {
    var pct = Math.round(clamp(value, 0, max) / max * 100);
    return '<div style="width:100%;height:24px;background:rgba(255,255,255,.08);border-radius:12px;overflow:hidden;position:relative;border:1px solid rgba(255,255,255,.12)">' +
      '<div style="height:100%;width:' + pct + '%;background:linear-gradient(90deg,' + color + ',' + color + '88);transition:width .3s"></div>' +
      '<div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;color:#fff;font-weight:700;font-size:.85rem">' + value + ' / ' + max + '</div></div>';
  }

  function renderDrawer(ui, loc) {
    ui.drawerTitleEl.textContent = loc.name;
    ui.drawerContentEl.innerHTML =
      '<div class="cc-block"><div class="cc-h">Description</div><p>' + (loc.description || "No description.") + '</p></div>' +
      '<div class="cc-block"><div class="cc-h">Danger</div>'     + meterBar(loc.danger     || 0, 6, "#ff4444") + '</div>' +
      '<div class="cc-block"><div class="cc-h">Population</div>' + meterBar(loc.population || 0, 6, "#4caf50") + '</div>' +
      (loc.atmosphere ? '<div class="cc-block"><div class="cc-h">Atmosphere</div><p style="font-style:italic;color:#aaa">"' + loc.atmosphere + '"</p></div>' : '') +
      '<div style="display:flex;flex-wrap:wrap;gap:.5rem">' +
      (loc.features || []).map(function(f) {
        return '<span style="padding:4px 10px;background:rgba(255,117,24,.2);border:1px solid rgba(255,117,24,.4);border-radius:4px;font-size:.85rem">' + f + '</span>';
      }).join("") +
      '</div>';
  }

  // ═══════════════════════════════════════════════════════════════
  // SAFE-RANGE MATHS
  // ═══════════════════════════════════════════════════════════════
  //
  // In Leaflet CRS.Simple, at zoom level z:
  //   1 map-unit  =  2^z  screen-pixels
  //
  // So the number of map-units visible in a container of H screen-px is:
  //   visibleH  =  H / 2^z
  //
  // To keep the map edge exactly flush with the container edge, the
  // map centre must stay within:
  //   min  =  visibleH / 2           (half a viewport down from the top edge)
  //   max  =  imageH − visibleH / 2  (half a viewport up from the bottom edge)
  //
  // If the whole image fits in the container (visibleH >= imageH),
  // we lock the centre at imageH/2 — no panning possible.
  //
  function safeRange(containerEl, zoom, imageH) {
    var h       = containerEl.getBoundingClientRect().height || containerEl.offsetHeight || 360;
    var visible = h / Math.pow(2, zoom); // map-units visible at this zoom level
    var half    = visible / 2;
    if (half >= imageH / 2) {
      // Entire image fits — lock to centre, no panning
      return { min: imageH / 2, max: imageH / 2 };
    }
    return { min: half, max: imageH - half };
  }

  // ═══════════════════════════════════════════════════════════════
  // MOUNT
  // ═══════════════════════════════════════════════════════════════
  function mount(root, userOpts) {
    var opts = Object.assign({}, DEFAULTS, userOpts || {});

    ensureLensFilter();
    if (IS_SAFARI) root.classList.add("cc-safari");

    // Keyframe animations (injected once globally)
    if (!document.getElementById("cc-map-keyframes")) {
      var ks = document.createElement("style");
      ks.id  = "cc-map-keyframes";
      ks.textContent =
        "@keyframes cc-spin  {0%{transform:rotate(0deg)}100%{transform:rotate(360deg)}}" +
        "@keyframes cc-pulse {0%,100%{opacity:.6}50%{opacity:1}}";
      document.head.appendChild(ks);
    }

    // ── DOM ────────────────────────────────────────────────────────
    root.innerHTML = "";
    root.classList.add("cc-canyon-map");

    // Background map container.
    // id="cc-cm-map" is required — the CSS file targets #cc-cm-map.
    var mapEl = el("div", { id:"cc-cm-map", class:"cc-cm-map" });

    // Lens chain. .cc-lens is pointer-events:none in the CSS (correct —
    // it lets background map gestures pass through). Each child that
    // needs to receive clicks must explicitly override that with auto.
    var lensMapEl = el("div", {
      id:    "cc-lens-map",
      style: "width:100%;height:100%;pointer-events:auto;"
    });
    var lensInner = el("div", {
      class: "cc-lens-inner",
      style: "pointer-events:auto;"
    }, [el("div", { class:"cc-lens-overscan", style:"pointer-events:auto;" }, [lensMapEl])]);

    var lensEl = el("div", { class:"cc-lens" }, [
      lensInner,
      el("div", { class:"cc-lens-chromatic", style:"pointer-events:none;" }),
      el("div", { class:"cc-lens-glare",     style:"pointer-events:none;" })
    ]);

    // ── Preloader ──────────────────────────────────────────────────
    // Visible for at least MIN_LOADER_MS ms (default 5s).
    // Logo image: coffin_canyon_logo.png
    // Spinner and pulsing text beneath.
    var loaderEl = el("div", {
      id:    "cc-map-loader",
      style: [
        "position:absolute;inset:0;z-index:200;",
        "display:flex;flex-direction:column;align-items:center;justify-content:center;",
        "background:rgba(0,0,0,.92);",
        "transition:opacity .5s ease;"
      ].join("")
    }, [
      el("img", {
        src:   opts.logoUrl,
        alt:   "Coffin Canyon",
        style: [
          "width:240px;max-width:70vw;",
          "margin-bottom:32px;",
          "filter:drop-shadow(0 0 28px rgba(255,117,24,.45));",
          "animation:cc-pulse 2.5s ease-in-out infinite;"
        ].join("")
      }),
      el("div", {
        style: [
          "width:48px;height:48px;",
          "border:4px solid rgba(255,117,24,.18);",
          "border-top:4px solid #ff7518;",
          "border-radius:50%;",
          "animation:cc-spin 1s linear infinite;"
        ].join("")
      }),
      el("div", {
        style: [
          "color:#ff7518;margin-top:14px;",
          "font-family:system-ui,sans-serif;font-size:.7rem;",
          "letter-spacing:.28em;text-transform:uppercase;",
          "animation:cc-pulse 1.5s ease-in-out infinite;"
        ].join("")
      }, ["Loading\u2026"])
    ]);

    var header = el("div", { class:"cc-cm-header" }, [
      el("div", { class:"cc-cm-title" }, [opts.title]),
      el("div", { class:"cc-cm-actions" }, [
        el("button", { class:"cc-btn", id:"cc-cm-reload" }, ["Reload"]),
        el("button", { class:"cc-btn", id:"cc-cm-fit"    }, ["Fit"])
      ])
    ]);

    var drawer = el("div", { class:"cc-cm-drawer" }, [
      el("div", { class:"cc-cm-drawer-head" }, [
        el("div",    { class:"cc-cm-drawer-title" }, ["Location"]),
        el("button", { class:"cc-btn cc-btn-x", id:"close-dr" }, ["\u00d7"])
      ]),
      el("div", { class:"cc-cm-drawer-content" })
    ]);

    var body = el("div", { class:"cc-cm-body cc-cm-body--lens" }, [
      el("div", { class:"cc-cm-mapwrap" }, [
        mapEl, lensEl, loaderEl,
        el("div", { class:"cc-frame-overlay" }),
        el("div", { class:"cc-scroll-vertical"   }, [el("div", { class:"cc-scroll-knob", id:"cc-scroll-knob-v" })]),
        el("div", { class:"cc-scroll-horizontal" }, [el("div", { class:"cc-scroll-knob", id:"cc-scroll-knob-h" })])
      ])
    ]);

    root.appendChild(header);
    root.appendChild(body);
    root.appendChild(drawer);

    var ui = {
      mapEl:           mapEl,
      lensMapEl:       lensMapEl,
      lensEl:          lensEl,
      drawerEl:        drawer,
      drawerTitleEl:   drawer.querySelector(".cc-cm-drawer-title"),
      drawerContentEl: drawer.querySelector(".cc-cm-drawer-content"),
      knobV:           root.querySelector("#cc-scroll-knob-v"),
      knobH:           root.querySelector("#cc-scroll-knob-h")
    };

    function showLoader() {
      loaderEl.style.display = "flex";
      loaderEl.style.opacity = "1";
    }
    function hideLoader() {
      loaderEl.style.opacity = "0";
      setTimeout(function() { loaderEl.style.display = "none"; }, 520);
    }

    // ── Dependencies (cached after first load) ─────────────────────
    var depsReady = loadCssOnce(opts.leafletCssUrl, "leaflet_css")
      .then(function() { return loadScriptOnce(opts.leafletJsUrl, "leaflet_js"); })
      .then(function() { return loadCssOnce(opts.appCssUrl, "app_css"); });

    // ── Shared state ───────────────────────────────────────────────
    var mainMap = null, lensMap = null;
    var mapDoc  = null, locationsData = null;

    // ── Normalised scroll position (t) ─────────────────────────────
    // Everything is expressed as t in [0, 1]:
    //   0.0 = viewing the very top of the image
    //   1.0 = viewing the very bottom
    //
    // applyT() converts t into a concrete lat/lng centre for each map
    // using that map's own safe range, so neither map ever shows blank.
    var currentT = 0.5;

    function applyT(t, px) {
      if (!mainMap || !lensMap || !px) return;
      t = clamp(t, 0, 1);
      currentT = t;

      var lensZoom = BG_ZOOM + opts.lensZoomOffset;

      // Background map — compute its own safe range and pan to it
      var bgR = safeRange(ui.mapEl, BG_ZOOM, px.h);
      mainMap.panTo([bgR.min + t * (bgR.max - bgR.min), px.w / 2], { animate: false });

      // Lens map — different zoom + container, but same t.
      // Because both use t, their edges always align simultaneously.
      var lnR = safeRange(ui.lensMapEl, lensZoom, px.h);
      lensMap.setView(
        [lnR.min + t * (lnR.max - lnR.min), px.w / 2],
        lensZoom,
        { animate: false }
      );

      // Knob visual always reflects current t exactly
      ui.knobV.style.top = (t * 100) + "%";
    }

    // ── Knob drag + momentum (bound once) ─────────────────────────
    var knobbsBound = false;

    function bindKnobs(px) {
      if (knobbsBound) return;
      knobbsBound = true;

      function bindKnob(knobEl, axis) {
        var dragging   = false;
        var lastClient = 0;
        var lastTime   = 0;
        var velocity   = 0; // t-units per ~16ms frame
        var rafId      = null;

        function getClient(e) {
          var src = e.touches ? e.touches[0] : e;
          return axis === "v" ? src.clientY : src.clientX;
        }

        // Track length in screen pixels
        function trackPx() {
          var r = knobEl.parentElement.getBoundingClientRect();
          return (axis === "v" ? r.height : r.width) || 1;
        }

        // Screen-pixel drag → change in t (0-1)
        function pxTodt(pxDelta) { return pxDelta / trackPx(); }

        function momentumLoop() {
          if (Math.abs(velocity) < MIN_VEL) { rafId = null; return; }
          applyT(currentT + velocity, px);
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
          var now     = performance.now();
          var client  = getClient(e);
          var pxDelta = client - lastClient;
          var dt      = Math.max(now - lastTime, 1);
          var dT      = pxTodt(pxDelta);
          applyT(currentT + dT, px);
          velocity   = dT / dt * 16; // normalise to ~60fps
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

      bindKnob(ui.knobV, "v"); // vertical brass knob

      // Horizontal knob wired up but pans the background map only.
      // The lens stays centred horizontally (same geographic centre as bg).
      // Uncomment the line below if you want horizontal pan enabled:
      // bindKnob(ui.knobH, "h");

      // On resize: re-measure containers and re-apply scroll position
      window.addEventListener("resize", rafThrottle(function() {
        try { if (mainMap) mainMap.invalidateSize({ animate: false }); } catch(e){}
        try { if (lensMap)  lensMap.invalidateSize({ animate: false }); } catch(e){}
        if (mapDoc) applyT(currentT, mapDoc.map.background.image_pixel_size);
      }));
    }

    // ── init ───────────────────────────────────────────────────────
    function init() {
      showLoader();
      var loadStart = Date.now();
      var signal    = newSession();

      return depsReady
        .then(function() {
          return Promise.all([
            fetchJson(opts.mapUrl,       signal),
            fetchJson(opts.stateUrl,     signal),
            fetchJson(opts.locationsUrl, signal)
          ]);
        })
        .then(function(results) {
          mapDoc        = results[0];
          locationsData = results[2];

          try { if (mainMap) mainMap.remove(); } catch(e){}
          try { if (lensMap)  lensMap.remove(); } catch(e){}

          var px     = mapDoc.map.background.image_pixel_size;
          var bounds = [[0, 0], [px.h, px.w]];

          // ── Background map ────────────────────────────────────────
          // dragging:false — all panning goes through the brass knobs.
          mainMap = window.L.map(ui.mapEl, {
            crs:               window.L.CRS.Simple,
            minZoom:           -3,
            maxZoom:           2,
            dragging:          false,
            zoomControl:       false,
            attributionControl: false,
            scrollWheelZoom:   false,
            doubleClickZoom:   false
          });
          window.L.imageOverlay(mapDoc.map.background.image_key, bounds).addTo(mainMap);
          mainMap.setView([px.h / 2, px.w / 2], BG_ZOOM, { animate: false });

          // ── Lens map ──────────────────────────────────────────────
          var lensUrl = (mapDoc.map.lens && mapDoc.map.lens.image_key)
            ? mapDoc.map.lens.image_key
            : mapDoc.map.background.image_key;

          lensMap = window.L.map(ui.lensMapEl, {
            crs:               window.L.CRS.Simple,
            dragging:          false,
            zoomControl:       false,
            attributionControl: false
          });
          window.L.imageOverlay(lensUrl, bounds).addTo(lensMap);

          // ── Location hitboxes ─────────────────────────────────────
          // On the lens map so they're large enough to tap on mobile.
          locationsData.locations.forEach(function(loc) {
            var bbox = HITBOXES[loc.id];
            if (!bbox) return;

            var rect = window.L.rectangle(
              [[bbox[0], bbox[1]], [bbox[2], bbox[3]]],
              { color:"rgba(255,117,24,0.6)", fillOpacity:0.3, weight:2, interactive:true }
            ).addTo(lensMap);

            rect.on("click", function(e) {
              window.L.DomEvent.stopPropagation(e);
              renderDrawer(ui, loc);
              ui.drawerEl.classList.add("open");
            });

            window.L.marker(
              [(bbox[0] + bbox[2]) / 2, (bbox[1] + bbox[3]) / 2],
              {
                icon: window.L.divIcon({
                  className: "cc-location-label",
                  html: '<div style="color:#fff;font-weight:800;white-space:nowrap;text-shadow:0 2px 4px #000">' +
                        (loc.emoji || "\uD83D\uDCCD") + " " + loc.name + "</div>"
                }),
                interactive: false
              }
            ).addTo(lensMap);
          });

          bindKnobs(px);

          // ── Wait for layout to settle, then position maps ─────────
          // Two invalidateSize passes: first lets the browser do layout,
          // second catches any second-pass adjustments (common in Odoo).
          // After that we read real container dimensions for safeRange().
          return nextFrame()
            .then(function() {
              try { mainMap.invalidateSize({ animate: false }); } catch(e){}
              try { lensMap.invalidateSize({ animate: false }); } catch(e){}
              return nextFrame();
            })
            .then(function() {
              try { mainMap.invalidateSize({ animate: false }); } catch(e){}
              try { lensMap.invalidateSize({ animate: false }); } catch(e){}
              applyT(0.5, px); // centre both maps, using real container sizes
            })
            .then(function() {
              // Wait however long remains of MIN_LOADER_MS before hiding
              var elapsed   = Date.now() - loadStart;
              var remaining = Math.max(0, MIN_LOADER_MS - elapsed);
              return delay(remaining);
            });
        })
        .then(function() {
          hideLoader();
        })
        .catch(function(err) {
          if (err && err.name === "AbortError") return; // expected on Reload
          console.error("Canyon Map init failed:", err);
          hideLoader();
          ui.drawerContentEl.innerHTML =
            '<div style="color:#f55;padding:1rem">Load failed: ' + (err && err.message) + '</div>';
          ui.drawerEl.classList.add("open");
        });
    }

    // ── Button wiring ──────────────────────────────────────────────
    root.querySelector("#cc-cm-reload").onclick = function() { init(); };
    root.querySelector("#close-dr").onclick     = function() { ui.drawerEl.classList.remove("open"); };
    root.querySelector("#cc-cm-fit").onclick    = function() {
      // Fit = reset to centre (t = 0.5)
      if (mapDoc) applyT(0.5, mapDoc.map.background.image_pixel_size);
    };

    return init().then(function() { return {}; });
  }

  window.CC_CanyonMap = { mount: mount };

})();
