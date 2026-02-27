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
    lensZoomOffset: 0.2  // lens zoom = BG_ZOOM + this. Higher = more magnification.
  };

  // ═══════════════════════════════════════════════════════════════
  // LOCATION HITBOXES
  // [minY, minX, maxY, maxX] in image pixels
  // ═══════════════════════════════════════════════════════════════
   
   var HITBOXES = {
  "bandit-buck": [1550,956,1668,1160],
  "bayou-city": [1175,2501,1386,2767],
  "cowtown": [2172,2112,2332,2396],
  "crackpits": [2628,1628,2816,1968],
  "deerhoof": [3112,2130,3329,2412],
  "diablo": [505,1432,716,1698],
  "dustbuck": [1986,2286,2156,2522],
  "fool-boot": [2408,1132,2512,1224],
  "fort-plunder": [3348,1209,3631,1427],
  "fortune": [2887,1284,3121,1567],
  "ghost-mountain": [2597,205,2849,489],
  "gore-mule-drop": [2872,1600,3092,2076],
  "grade-grind": [2486,1432,2598,1548],
  "heckweed": [2312,1824,2440,1944],
  "huck": [3332,2569,3550,2749],
  "kraise": [1995,1270,2193,1527],
  "little-rica": [2964,500,3182,784],
  "lost-yots": [1576,1266,1958,1586],
  "martygrail": [2392,1620,2520,1748],
  "mindshaft": [3112,804,3388,1164],
  "pallor": [1616,1824,1996,1924],
  "plata": [2513,916,2765,1089],
  "quinne-jimmy": [1694,801,1852,1157],
  "ratsville": [1452,1968,1644,2194],
  "rey": [19,1883,230,2046],
  "river-city": [1068,1595,1279,1861],
  "sangr": [1105,1172,1315,1573],
  "santos-grin": [1185,1898,1396,2176],
  "silverpit": [2128,1548,2294,1762],
  "skull-water": [1609,492,1841,701],
  "splitglass-arroyo": [2605,1138,2859,1427],
  "tin-flats": [1374,1258,1512,1608],
  "tzulto": [2229,1334,2447,1526],
  "widowflow": [1316,1630,2078,1798],
  "witches-roost": [3767,2130,3965,2495],
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

    // DEV: hitbox editor CSS (inline so you don't have to touch cc_canyon_map.css)
    if (!document.getElementById("cc-hitbox-editor-style")) {
      var hbStyle = document.createElement("style");
      hbStyle.id = "cc-hitbox-editor-style";
      hbStyle.textContent = [
        ".cc-canyon-map.cc-hitbox-edit .cc-lens,",
        ".cc-canyon-map.cc-hitbox-edit .cc-frame-overlay,",
        ".cc-canyon-map.cc-hitbox-edit .cc-scroll-vertical,",
        ".cc-canyon-map.cc-hitbox-edit .cc-scroll-horizontal{display:none!important;}",
        ".cc-canyon-map.cc-hitbox-edit #cc-cm-map{position:absolute;inset:0;z-index:50;}",
        "#cc-hitbox-editor{position:absolute;inset:0;z-index:999999;pointer-events:auto;}",
        ".cc-hb-box{position:absolute;outline:2px solid rgba(0,0,0,.7);background:rgba(255,255,0,.18);border-radius:6px;box-sizing:border-box;cursor:grab;user-select:none;}",
        ".cc-hb-box:active{cursor:grabbing;}",
        ".cc-hb-label{position:absolute;left:0;top:-18px;padding:2px 6px;border-radius:6px;background:rgba(0,0,0,.75);color:#fff;font:12px/1 system-ui,sans-serif;white-space:nowrap;pointer-events:none;}",
        ".cc-hb-handle{position:absolute;width:12px;height:12px;right:-6px;bottom:-6px;background:rgba(0,0,0,.85);border-radius:3px;cursor:nwse-resize;}"
      ].join("");
      document.head.appendChild(hbStyle);
    }

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

    var lensEl = el("div", { class:"cc-lens",
      style:"overflow:hidden;"
    }, [
      lensInner,
      el("div", { class:"cc-lens-chromatic", style:"pointer-events:none;" }),
      el("div", { class:"cc-lens-glare",     style:"pointer-events:none;" })
    ]);
       // ── Preloader ──────────────────────────────────────────────────
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
          "width:360px;max-width:80vw;",
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
        el("button", { class:"cc-btn", id:"cc-cm-fit"    }, ["Fit"]),
        // DEV: hitbox editor buttons
        el("button", { class:"cc-btn", id:"cc-cm-edit"   }, ["Edit Hitboxes"]),
        el("button", { class:"cc-btn", id:"cc-cm-export" }, ["Export"])
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
        el("div", { class:"cc-frame-overlay", style:"pointer-events:none;" }),
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
      knobH:           root.querySelector("#cc-scroll-knob-h"),
      _hbEditor:       null
    };

    // DEV: Hitbox editor (private tool; remove after use)
    // HITBOXES format is [minY, minX, maxY, maxX]
    // Robust across Reload (mainMap recreated)
    function createHitboxEditor(root, ui) {
      var state = {
        editing: false,
        editorEl: null,
        active: null,
        mainMap: null,
        px: null,
        bound: false
      };

      function ensureEditorLayer() {
        if (state.editorEl) return state.editorEl;
        state.editorEl = document.createElement("div");
        state.editorEl.id = "cc-hitbox-editor";
        ui.mapEl.appendChild(state.editorEl);
        return state.editorEl;
      }

      function rectFromHitbox(b) { return { y1:b[0], x1:b[1], y2:b[2], x2:b[3] }; }
      function hitboxFromRect(r) { return [Math.round(r.y1), Math.round(r.x1), Math.round(r.y2), Math.round(r.x2)]; }

      function latLngToPx(lat, lng) {
        var pt = state.mainMap.latLngToContainerPoint(window.L.latLng(lat, lng));
        return { x: pt.x, y: pt.y };
      }

      function drawBoxes() {
        if (!state.editing || !state.mainMap || !state.px) return;
        var layer = ensureEditorLayer();
        layer.innerHTML = "";

        Object.keys(HITBOXES).forEach(function(id) {
          var b = HITBOXES[id];
          if (!b) return;

          var r = rectFromHitbox(b);
          var p1 = latLngToPx(r.y1, r.x1);
          var p2 = latLngToPx(r.y2, r.x2);

          var box = document.createElement("div");
          box.className = "cc-hb-box";
          box.dataset.id = id;
          box.style.left   = Math.min(p1.x, p2.x) + "px";
          box.style.top    = Math.min(p1.y, p2.y) + "px";
          box.style.width  = Math.abs(p2.x - p1.x) + "px";
          box.style.height = Math.abs(p2.y - p1.y) + "px";

          var label = document.createElement("div");
          label.className = "cc-hb-label";
          label.textContent = id;
          box.appendChild(label);

          var handle = document.createElement("div");
          handle.className = "cc-hb-handle";
          handle.title = "Drag to resize";
          box.appendChild(handle);

          layer.appendChild(box);
        });
      }

      function updateHitboxFromBox(box) {
        var id = box.dataset.id;
        var left   = parseFloat(box.style.left);
        var top    = parseFloat(box.style.top);
        var width  = parseFloat(box.style.width);
        var height = parseFloat(box.style.height);

        var p1 = state.mainMap.containerPointToLatLng(window.L.point(left, top));
        var p2 = state.mainMap.containerPointToLatLng(window.L.point(left + width, top + height));

        var r = {
          y1: Math.min(p1.lat, p2.lat),
          x1: Math.min(p1.lng, p2.lng),
          y2: Math.max(p1.lat, p2.lat),
          x2: Math.max(p1.lng, p2.lng)
        };

        HITBOXES[id] = hitboxFromRect(r);
      }

      function onPointerDown(e) {
        if (!state.editing) return;
        var box = e.target.closest(".cc-hb-box");
        if (!box) return;

        var isHandle = e.target.classList.contains("cc-hb-handle");
        state.active = {
          box: box,
          mode: isHandle ? "resize" : "move",
          startX: e.clientX,
          startY: e.clientY,
          left: parseFloat(box.style.left),
          top: parseFloat(box.style.top),
          width: parseFloat(box.style.width),
          height: parseFloat(box.style.height)
        };

        box.setPointerCapture(e.pointerId);
        e.preventDefault();
        e.stopPropagation();
      }

      function onPointerMove(e) {
        if (!state.editing || !state.active) return;

        var dx = e.clientX - state.active.startX;
        var dy = e.clientY - state.active.startY;

        if (state.active.mode === "move") {
          state.active.box.style.left = Math.round(state.active.left + dx) + "px";
          state.active.box.style.top  = Math.round(state.active.top  + dy) + "px";
        } else {
          state.active.box.style.width  = Math.max(6, Math.round(state.active.width  + dx)) + "px";
          state.active.box.style.height = Math.max(6, Math.round(state.active.height + dy)) + "px";
        }

        updateHitboxFromBox(state.active.box);
        e.preventDefault();
      }

      function onPointerUp(e) {
        if (!state.editing || !state.active) return;
        try { state.active.box.releasePointerCapture(e.pointerId); } catch (err) {}
        state.active = null;
      }

      function exportHitboxes() {
        var keys = Object.keys(HITBOXES).sort();
        var lines = keys.map(function(k) {
          return '  "' + k + '": [' + HITBOXES[k].join(",") + '],';
        });
        var text = "var HITBOXES = {\n" + lines.join("\n") + "\n};";

        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(text).catch(function() {
            window.prompt("Copy HITBOXES:", text);
          });
        } else {
          window.prompt("Copy HITBOXES:", text);
        }
      }

      function setEditing(on) {
        state.editing = on;
        root.classList.toggle("cc-hitbox-edit", on);

        if (!on) {
          if (state.editorEl) state.editorEl.style.display = "none";
          if (state.mainMap) state.mainMap.off("move zoom resize", drawBoxes);
          return;
        }

        if (!state.mainMap || !state.px) return;

        // 1:1 view (CRS.Simple zoom 0)
        state.mainMap.setView([state.px.h / 2, state.px.w / 2], 0, { animate:false });

        ensureEditorLayer().style.display = "block";
        drawBoxes();
        state.mainMap.on("move zoom resize", drawBoxes);
      }

      function bindOnce() {
        if (state.bound) return;
        state.bound = true;
        ui.mapEl.addEventListener("pointerdown", onPointerDown);
        window.addEventListener("pointermove", onPointerMove, { passive:false });
        window.addEventListener("pointerup", onPointerUp);
      }

      bindOnce();

      return {
        attach: function(mainMap, px) {
          state.mainMap = mainMap;
          state.px = px;
          if (state.editing) setEditing(true); // survives Reload
        },
        toggle: function() { setEditing(!state.editing); },
        export: function() { if (state.editing) exportHitboxes(); }
      };
    }

    // DEV: create editor instance once per mount
    ui._hbEditor = createHitboxEditor(root, ui);

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

    // ── Normalised scroll positions ─────────────────────────────────
    var currentT  = 0.5;
    var currentTx = 0.5;

    // Horizontal equivalent of safeRange (see safeRange above for explanation)
    function safeRangeX(containerEl, zoom, imageW) {
      var w       = containerEl.getBoundingClientRect().width || containerEl.offsetWidth || 600;
      var visible = w / Math.pow(2, zoom);
      var half    = visible / 2;
      if (half >= imageW / 2) return { min: imageW / 2, max: imageW / 2 };
      return { min: half, max: imageW - half };
    }

    // applyT: reposition both maps using currentT (vertical) and currentTx (horizontal).
    function applyT(t, px) {
      if (!mainMap || !lensMap || !px) return;
      t = clamp(t, 0, 1);
      currentT = t;

      var lensZoom = BG_ZOOM + opts.lensZoomOffset;
      var tx = currentTx;

      // Background map — vertical + horizontal
      var bgRy  = safeRange( ui.mapEl, BG_ZOOM, px.h);
      var bgRx  = safeRangeX(ui.mapEl, BG_ZOOM, px.w);
      mainMap.panTo(
        [bgRy.min + t * (bgRy.max - bgRy.min),
         bgRx.min + tx * (bgRx.max - bgRx.min)],
        { animate: false }
      );

      // Lens map — same t/tx, but its own safe ranges (different zoom + container size)
      var lnRy  = safeRange( ui.lensMapEl, lensZoom, px.h);
      var lnRx  = safeRangeX(ui.lensMapEl, lensZoom, px.w);
      lensMap.setView(
        [lnRy.min + t * (lnRy.max - lnRy.min),
         lnRx.min + tx * (lnRx.max - lnRx.min)],
        lensZoom,
        { animate: false }
      );

      // Knobs visually track t/tx exactly
      ui.knobV.style.top  = (t  * 100) + "%";
      ui.knobH.style.left = (tx * 100) + "%";
    }

    function applyTx(tx, px) {
      currentTx = clamp(tx, 0, 1);
      applyT(currentT, px);
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
          if (axis === "v") applyT( currentT  + velocity, px);
          else              applyTx(currentTx + velocity, px);
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
          if (axis === "v") applyT( currentT  + dT, px);
          else              applyTx(currentTx + dT, px);
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
      bindKnob(ui.knobH, "h"); // horizontal brass knob

      // On resize: re-measure containers and re-apply both scroll positions
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

          // DEV: attach editor to freshly created map (survives Reload)
          if (ui._hbEditor) ui._hbEditor.attach(mainMap, px);

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

          // Prevent the browser's default image-drag behaviour inside the lens.
          ui.lensMapEl.addEventListener("dragstart", function(e) { e.preventDefault(); });
          ui.lensMapEl.style.userSelect   = "none";
          ui.lensMapEl.style.webkitUserSelect = "none";

          // Force pointer-events on lensMapEl and its Leaflet internals.
          ui.lensMapEl.style.pointerEvents = "auto";
          var lensContainer = ui.lensMapEl.querySelector(".leaflet-container");
          if (lensContainer) lensContainer.style.pointerEvents = "auto";

          // ── Location hitboxes (visual only — click handled via DOM) ──
          locationsData.locations.forEach(function(loc) {
            var bbox = HITBOXES[loc.id];
            if (!bbox) return;

            // Visual orange box — NOT interactive (no Leaflet click handling)
            window.L.rectangle(
              [[bbox[0], bbox[1]], [bbox[2], bbox[3]]],
              { color:"rgba(255,117,24,0.8)", fillOpacity:0.25, weight:2, interactive:false }
            ).addTo(lensMap);

            // Location name label
            window.L.marker(
              [(bbox[0] + bbox[2]) / 2, (bbox[1] + bbox[3]) / 2],
              {
                icon: window.L.divIcon({
                  className: "cc-location-label",
                  html: '<div style="color:#fff;font-weight:800;white-space:nowrap;' +
                        'text-shadow:0 2px 4px #000;pointer-events:none;">' +
                        (loc.emoji || "\uD83D\uDCCD") + " " + loc.name + "</div>"
                }),
                interactive: false
              }
            ).addTo(lensMap);
          });

          // ── Single DOM click handler for all hitboxes ─────────────
          ui.lensMapEl.addEventListener("click", function(e) {
            if (!lensMap) return;

            var rect   = ui.lensMapEl.getBoundingClientRect();
            var pixelX = e.clientX - rect.left;
            var pixelY = e.clientY - rect.top;
            var latlng = lensMap.containerPointToLatLng(
              window.L.point(pixelX, pixelY)
            );
            var clickLat = latlng.lat;
            var clickLng = latlng.lng;

            // Walk every known hitbox and find the first one that contains the click coordinate.
            var hit = null;
            locationsData.locations.forEach(function(loc) {
              if (hit) return;
              var bbox = HITBOXES[loc.id];
              if (!bbox) return;
              if (clickLat >= bbox[0] && clickLat <= bbox[2] &&
                  clickLng >= bbox[1] && clickLng <= bbox[3]) {
                hit = loc;
              }
            });

            if (hit) {
              e.stopPropagation();
              renderDrawer(ui, hit);
              ui.drawerEl.classList.add("open");
            }
          });

          bindKnobs(px);

          // ── Wait for layout to settle, then position maps ─────────
          return nextFrame()
            .then(function() {
              try { mainMap.invalidateSize({ animate: false }); } catch(e){}
              try { lensMap.invalidateSize({ animate: false }); } catch(e){}
              return nextFrame();
            })
            .then(function() {
              try { mainMap.invalidateSize({ animate: false }); } catch(e){}
              try { lensMap.invalidateSize({ animate: false }); } catch(e){}
              currentT  = 0.5;
              currentTx = 0.5;
              applyT(0.5, px);

              ui.lensMapEl.style.pointerEvents = "auto";
              var lc = ui.lensMapEl.querySelector(".leaflet-container");
              if (lc) lc.style.pointerEvents = "auto";
              var inner = ui.lensMapEl.closest(".cc-lens-inner");
              if (inner) inner.style.pointerEvents = "auto";
            })
            .then(function() {
              var elapsed   = Date.now() - loadStart;
              var remaining = Math.max(0, MIN_LOADER_MS - elapsed);
              return delay(remaining);
            });
        })
        .then(function() {
          hideLoader();
        })
        .catch(function(err) {
          if (err && err.name === "AbortError") return;
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
      if (mapDoc) {
        currentTx = 0.5;
        applyT(0.5, mapDoc.map.background.image_pixel_size);
      }
    };

    // DEV: hitbox editor buttons
    root.querySelector("#cc-cm-edit").onclick = function() {
      if (ui._hbEditor) ui._hbEditor.toggle();
    };
    root.querySelector("#cc-cm-export").onclick = function() {
      if (ui._hbEditor) ui._hbEditor.export();
    };

    // Click anywhere outside the open drawer (but still inside the app root)
    // to slide it closed.
    root.addEventListener("click", function(e) {
      if (!ui.drawerEl.classList.contains("open")) return;
      if (ui.drawerEl.contains(e.target)) return;
      ui.drawerEl.classList.remove("open");
    });

    return init().then(function() { return {}; });
  }

  window.CC_CanyonMap = { mount: mount };
  window.CC_HITBOXES = HITBOXES;

})();  
   
