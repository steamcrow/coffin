/* File: rules/apps/canyon_map/cc_canyon_map_app.js
   Coffin Canyon — Canyon Map
   ─────────────────────────────────────────────────────────────
   Fixes in this version
   ─────────────────────────────────────────────────────────────
   1. KNOBS MOVE
      The background map now uses setView(center, BG_ZOOM) instead
      of fitBounds(). fitBounds zooms OUT until the entire image
      fits in the container — after that panTo silently does nothing
      because there's nowhere to pan to.
      BG_ZOOM = -1 means the image renders at ~2000×2822 px inside a
      ~650-px-tall container, so there's plenty of pan range.
      Knob mousedown/mousemove/mouseup handlers drag the map AND
      release into a momentum coast.

   2. BACKGROUND MAP FILLS THE BOX
      Same fix as above — larger zoom level + the map div gets both
      id AND class "cc-cm-map" so CSS rules targeting #cc-cm-map
      actually connect.

   3. PRELOADER WITH COFFIN CANYON LOGO
      Matches the style of coffin_canyon_loaders_3.js: dark overlay,
      "COFFIN CANYON" in Bungee orange, "TACTICAL DATA LINK" subtext,
      orange spinner, pulsing "LOADING…" text.
      No external image required.

   4. CLICKABLE ZONES
      .cc-lens has pointer-events:none in the CSS (correct — so the
      lens doesn't steal base-map gestures). But that blocks ALL
      descendants unless they explicitly set pointer-events:auto.
      Fix: every element in the chain from .cc-lens-inner down to
      lensMapEl gets style="pointer-events:auto" so Leaflet
      rectangle click events reach the browser.
*/

(function () {

  // ─── Safari detection ────────────────────────────────────────────────────────
  // Safari's compositor breaks SVG feDisplacementMap on CSS-transformed elements.
  // We detect it and skip the SVG filter, relying on CSS-only glass effects.
  const IS_SAFARI = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);

  // ─── Constants ───────────────────────────────────────────────────────────────
  // BG_ZOOM: zoom level for the background map.
  // In Leaflet CRS.Simple, zoom -1 renders 1 image-pixel as 0.5 screen-pixels.
  // For a 4000px-tall image that's a 2000px render — much taller than the
  // container, giving real panning range.
  const BG_ZOOM = -1;

  // Knob momentum physics
  const FRICTION   = 0.88;  // velocity is multiplied by this each frame (0-1)
  const MIN_VEL    = 0.4;   // stop coasting below this speed (map-units/frame)

  // ─── Defaults ────────────────────────────────────────────────────────────────
  const DEFAULTS = {
    title:        "Coffin Canyon — Canyon Map",
    mapUrl:       "https://raw.githubusercontent.com/steamcrow/coffin/main/rules/apps/canyon_map/data/canyon_map.json",
    stateUrl:     "https://raw.githubusercontent.com/steamcrow/coffin/main/rules/apps/canyon_map/data/canyon_state.json",
    locationsUrl: "https://raw.githubusercontent.com/steamcrow/coffin/main/rules/src/170_named_locations.json",
    appCssUrl:    "https://raw.githubusercontent.com/steamcrow/coffin/main/rules/apps/canyon_map/cc_canyon_map.css",
    leafletCssUrl:"https://raw.githubusercontent.com/steamcrow/coffin/main/rules/vendor/leaflet/leaflet.css",
    leafletJsUrl: "https://raw.githubusercontent.com/steamcrow/coffin/main/rules/vendor/leaflet/leaflet.js",
    lensZoomOffset: 0.5,
    factionColors: {
      monster_rangers: "#4caf50", monsterologists: "#ff9800",
      monsters: "#9c27b0", liberty_corps: "#03a9f4", neutral: "#9e9e9e"
    }
  };

  // ─── Location hitboxes ───────────────────────────────────────────────────────
  // [minY, minX, maxY, maxX] in image pixels (origin bottom-left, Y-flipped)
  const HITBOXES = {
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

  // ─── Utils ───────────────────────────────────────────────────────────────────
  function el(tag, attrs, children) {
    attrs    = attrs    || {};
    children = children || [];
    const n = document.createElement(tag);
    Object.keys(attrs).forEach(function(k) {
      const v = attrs[k];
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

  function clamp(n, lo, hi) { return Math.max(lo, Math.min(hi, n)); }

  function rafThrottle(fn) {
    var pending = false, last = null;
    return function() {
      last = arguments;
      if (pending) return;
      pending = true;
      requestAnimationFrame(function() { pending = false; fn.apply(null, last); });
    };
  }

  function nextFrame() { return new Promise(function(r) { requestAnimationFrame(r); }); }

  // ─── SVG lens warp filter ────────────────────────────────────────────────────
  // Injects a hidden <svg> with a fractalNoise displacement filter.
  // The CSS on .cc-lens-inner references it via filter:url(#ccLensWarp).
  // Skipped on Safari where feDisplacementMap on transformed elements is broken.
  function ensureLensFilter() {
    if (IS_SAFARI) return;
    if (document.getElementById("cc-lens-warp-svg")) return;

    var ns  = "http://www.w3.org/2000/svg";
    var svg = document.createElementNS(ns, "svg");
    svg.id  = "cc-lens-warp-svg";
    // Give it 1×1px so Safari's compositor doesn't discard zero-size SVGs
    svg.setAttribute("style", "position:absolute;left:-9999px;top:-9999px;width:1px;height:1px;overflow:hidden");
    svg.setAttribute("aria-hidden", "true");
    svg.setAttribute("xmlns", ns);

    var filter = document.createElementNS(ns, "filter");
    filter.id  = "ccLensWarp";
    filter.setAttribute("x", "-15%");  filter.setAttribute("y", "-15%");
    filter.setAttribute("width","130%"); filter.setAttribute("height","130%");
    filter.setAttribute("color-interpolation-filters","sRGB");

    var turb = document.createElementNS(ns, "feTurbulence");
    turb.setAttribute("type",          "fractalNoise");
    turb.setAttribute("baseFrequency", "0.014 0.010"); // large slow waves
    turb.setAttribute("numOctaves",    "3");            // less fine grain
    turb.setAttribute("seed",          "42");
    turb.setAttribute("result",        "noise");

    var disp = document.createElementNS(ns, "feDisplacementMap");
    disp.setAttribute("in",             "SourceGraphic");
    disp.setAttribute("in2",            "noise");
    disp.setAttribute("scale",          "12"); // edge-heavy, calm in centre
    disp.setAttribute("xChannelSelector","R");
    disp.setAttribute("yChannelSelector","G");
    disp.setAttribute("result",         "warped");

    var cm = document.createElementNS(ns, "feColorMatrix");
    cm.setAttribute("type","matrix");
    cm.setAttribute("in","warped");
    cm.setAttribute("values",
      "1.07 0.03 0    0 0.018 " +
      "0    1.02 0.01 0 0.008 " +
      "0    0    0.88 0 0     " +
      "0    0    0    1 0");

    filter.appendChild(turb);
    filter.appendChild(disp);
    filter.appendChild(cm);
    svg.appendChild(filter);
    document.body.appendChild(svg);
  }

  // ─── Network ─────────────────────────────────────────────────────────────────
  var _initCtrl = null;
  function newSession() {
    if (_initCtrl) _initCtrl.abort();
    _initCtrl = new AbortController();
    return _initCtrl.signal;
  }

  function fetchJson(url, signal) {
    var u = url + (url.indexOf("?") >= 0 ? "&" : "?") + "t=" + Date.now();
    return fetch(u, { signal: signal }).then(function(r) {
      if (!r.ok) throw new Error("Fetch failed " + r.status + ": " + url);
      return r.json();
    });
  }

  function fetchText(url) {
    var u = url + (url.indexOf("?") >= 0 ? "&" : "?") + "t=" + Date.now();
    return fetch(u).then(function(r) {
      if (!r.ok) throw new Error("Fetch failed " + r.status + ": " + url);
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
        var s  = document.createElement("script");
        s.src  = blobUrl;
        s.onload  = function() { URL.revokeObjectURL(blobUrl); resolve(); };
        s.onerror = function() { URL.revokeObjectURL(blobUrl); reject(new Error("Script load failed: " + url)); };
        document.head.appendChild(s);
      });
    }).then(function() { _loaded.js[key] = true; });
  }

  // ─── Drawer renderer ─────────────────────────────────────────────────────────
  function meterBar(value, max, color) {
    var pct = Math.round((value / max) * 100);
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
      }).join("") + '</div>';
  }

  // ─── MOUNT ───────────────────────────────────────────────────────────────────
  function mount(root, userOpts) {
    var opts = Object.assign({}, DEFAULTS, userOpts || {});

    ensureLensFilter();
    if (IS_SAFARI) root.classList.add("cc-safari");

    // Inject spin/pulse keyframes once
    if (!document.getElementById("cc-map-keyframes")) {
      var ks = document.createElement("style");
      ks.id  = "cc-map-keyframes";
      ks.textContent =
        "@keyframes cc-spin{0%{transform:rotate(0deg)}100%{transform:rotate(360deg)}}" +
        "@keyframes cc-pulse{0%,100%{opacity:.7}50%{opacity:1}}";
      document.head.appendChild(ks);
    }

    // ── DOM ──────────────────────────────────────────────────────────────────
    root.innerHTML = "";
    root.classList.add("cc-canyon-map");

    var header = el("div", { class:"cc-cm-header" }, [
      el("div", { class:"cc-cm-title" }, [opts.title]),
      el("div", { class:"cc-cm-actions" }, [
        el("button", { class:"cc-btn", id:"cc-cm-reload" }, ["Reload"]),
        el("button", { class:"cc-btn", id:"cc-cm-fit"    }, ["Fit"])
      ])
    ]);

    // Background map.
    // IMPORTANT: id="cc-cm-map" is required — the CSS uses #cc-cm-map
    var mapEl = el("div", { id:"cc-cm-map", class:"cc-cm-map" });

    // Lens map element chain.
    // .cc-lens has pointer-events:none in CSS (correct, so the lens
    // doesn't swallow touch/mouse events meant for the background map).
    // Every layer inside that NEEDS to receive clicks must explicitly
    // set pointer-events:auto, otherwise the none cascades down.
    var lensMapEl = el("div", {
      id:    "cc-lens-map",
      style: "width:100%;height:100%;pointer-events:auto;"
    });

    var lensInner = el("div", {
      class: "cc-lens-inner",
      style: "pointer-events:auto;"
    }, [
      el("div", {
        class: "cc-lens-overscan",
        style: "pointer-events:auto;"
      }, [lensMapEl])
    ]);

    var lensEl = el("div", { class:"cc-lens" }, [
      lensInner,
      el("div", { class:"cc-lens-chromatic", style:"pointer-events:none" }),
      el("div", { class:"cc-lens-glare",     style:"pointer-events:none" })
    ]);

    // ── Preloader ───────────────────────────────────────────────────────────
    // Branded "Coffin Canyon" text logo, matching coffin_canyon_loaders_3.js
    // visual style: dark overlay, Bungee orange title, spinner, pulsing text.
    // No image file needed.
    var loaderEl = el("div", {
      id:    "cc-map-loader",
      style: [
        "position:absolute;inset:0;z-index:200;",
        "display:flex;flex-direction:column;align-items:center;justify-content:center;",
        "background:rgba(0,0,0,.9);",
        "transition:opacity .4s ease;"
      ].join("")
    }, [
      // Logo
      el("div", { style:"text-align:center;margin-bottom:28px;" }, [
        el("div", {
          style: [
            "font-family:'Bungee',system-ui,sans-serif;",
            "font-size:clamp(1.6rem,4vw,2.4rem);",
            "letter-spacing:.1em;text-transform:uppercase;",
            "color:#ff7518;line-height:1;",
            "text-shadow:0 0 32px rgba(255,117,24,.55);"
          ].join("")
        }, ["Coffin Canyon"]),
        el("div", {
          style: [
            "font-family:system-ui,sans-serif;font-size:.55rem;",
            "letter-spacing:.38em;text-transform:uppercase;",
            "color:#444;margin-top:8px;"
          ].join("")
        }, ["Tactical Data Link"])
      ]),
      // Spinner
      el("div", {
        style: [
          "width:50px;height:50px;",
          "border:4px solid rgba(255,117,24,.18);",
          "border-top:4px solid #ff7518;",
          "border-radius:50%;",
          "animation:cc-spin 1s linear infinite;"
        ].join("")
      }),
      // Status
      el("div", {
        style: [
          "color:#ff7518;margin-top:16px;",
          "font-family:system-ui,sans-serif;font-size:.75rem;",
          "letter-spacing:.22em;text-transform:uppercase;",
          "animation:cc-pulse 1.5s ease-in-out infinite;"
        ].join("")
      }, ["Loading…"])
    ]);

    var drawer = el("div", { class:"cc-cm-drawer" }, [
      el("div", { class:"cc-cm-drawer-head" }, [
        el("div", { class:"cc-cm-drawer-title" }, ["Location"]),
        el("button", { class:"cc-btn cc-btn-x", id:"close-dr" }, ["×"])
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
      mapEl: mapEl,
      lensMapEl: lensMapEl,
      lensEl: lensEl,
      drawerEl: drawer,
      drawerTitleEl:   drawer.querySelector(".cc-cm-drawer-title"),
      drawerContentEl: drawer.querySelector(".cc-cm-drawer-content"),
      knobV: root.querySelector("#cc-scroll-knob-v"),
      knobH: root.querySelector("#cc-scroll-knob-h")
    };

    function showLoader() {
      loaderEl.style.display = "flex";
      loaderEl.style.opacity = "1";
    }
    function hideLoader() {
      loaderEl.style.opacity = "0";
      setTimeout(function() { loaderEl.style.display = "none"; }, 420);
    }

    // ── Load deps ───────────────────────────────────────────────────────────
    var depsReady = loadCssOnce(opts.leafletCssUrl, "leaflet_css")
      .then(function()  { return loadScriptOnce(opts.leafletJsUrl, "leaflet_js"); })
      .then(function()  { return loadCssOnce(opts.appCssUrl, "app_css"); });

    // ── State ────────────────────────────────────────────────────────────────
    var mainMap = null, lensMap = null;
    var mapDoc  = null, locationsData = null;

    // ── Lens sync ────────────────────────────────────────────────────────────
    // When the background map moves, copy its centre to the lens map
    // and add a zoom offset so the lens shows a magnified view.
    var syncLens = rafThrottle(function() {
      if (!lensMap || !mainMap) return;
      lensMap.setView(
        mainMap.getCenter(),
        mainMap.getZoom() + opts.lensZoomOffset,
        { animate: false }
      );
    });

    // ── Knob visual update ───────────────────────────────────────────────────
    // Slide the knob element to reflect the map's current scroll position.
    function updateKnobs(px) {
      if (!mainMap || !px) return;
      var c = mainMap.getCenter();
      ui.knobV.style.top  = clamp(c.lat / px.h, 0, 1) * 100 + "%";
      ui.knobH.style.left = clamp(c.lng / px.w, 0, 1) * 100 + "%";
    }

    // ── Knob drag + momentum ────────────────────────────────────────────────
    // bindKnob is called ONCE per knob (guarded by knobbsBound).
    // Each knob closure captures `mainMap` and `mapDoc` via the outer vars —
    // so when init() re-assigns those vars on Reload, the knob closures
    // automatically use the new map without needing to re-bind.
    var knobbsBound = false;

    function bindKnobs(px) {
      if (knobbsBound) return;
      knobbsBound = true;

      function bindKnob(knobEl, axis) {
        var dragging = false;
        var lastClient = 0, lastTime = 0;
        var velocity = 0, rafId = null;

        // Get mouse/touch coordinate on the relevant axis
        function getClient(e) {
          var src = e.touches ? e.touches[0] : e;
          return axis === "v" ? src.clientY : src.clientX;
        }

        // Length of the knob's track in screen pixels
        function trackPx() {
          var r = knobEl.parentElement.getBoundingClientRect();
          return axis === "v" ? r.height : r.width;
        }

        // Convert a screen-pixel drag distance to image-coordinate units
        function screenToMap(pxDelta) {
          var range = axis === "v"
            ? mapDoc.map.background.image_pixel_size.h
            : mapDoc.map.background.image_pixel_size.w;
          return (pxDelta / trackPx()) * range;
        }

        // Move the map by `delta` map-units along this axis
        function applyDelta(delta) {
          if (!mainMap || !mapDoc) return;
          var c    = mainMap.getCenter();
          var imgH = mapDoc.map.background.image_pixel_size.h;
          var imgW = mapDoc.map.background.image_pixel_size.w;
          if (axis === "v")
            mainMap.panTo([clamp(c.lat + delta, 0, imgH), c.lng], { animate: false });
          else
            mainMap.panTo([c.lat, clamp(c.lng + delta, 0, imgW)], { animate: false });
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
          var now    = performance.now();
          var client = getClient(e);
          var pxDelta   = client - lastClient;
          var dt        = Math.max(now - lastTime, 1);
          var mapDelta  = screenToMap(pxDelta);
          applyDelta(mapDelta);
          velocity   = mapDelta / dt * 16; // normalise to ~60fps frame time
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

      bindKnob(ui.knobV, "v");
      bindKnob(ui.knobH, "h");

      window.addEventListener("resize", rafThrottle(function() {
        try { if (mainMap) mainMap.invalidateSize({ animate: false }); } catch(e){}
        try { if (lensMap)  lensMap.invalidateSize({ animate: false }); } catch(e){}
      }));
    }

    // ── init ─────────────────────────────────────────────────────────────────
    function init() {
      showLoader();
      var signal = newSession();

      return depsReady.then(function() {
        return Promise.all([
          fetchJson(opts.mapUrl,       signal),
          fetchJson(opts.stateUrl,     signal),
          fetchJson(opts.locationsUrl, signal)
        ]);
      }).then(function(results) {
        mapDoc         = results[0];
        locationsData  = results[2];

        // Tear down old maps
        try { if (mainMap) mainMap.remove(); } catch(e){}
        try { if (lensMap)  lensMap.remove(); } catch(e){}

        var px     = mapDoc.map.background.image_pixel_size;
        var bounds = [[0, 0], [px.h, px.w]];
        var center = [px.h / 2, px.w / 2];

        // ── Background map ─────────────────────────────────────────────────
        // dragging:false — panning is driven by the brass knobs only.
        // BG_ZOOM (-1) renders the image at 2× its CSS pixel size relative
        // to zoom 0. For a 4000px-tall image that's ~2000px — much taller
        // than the container, so panTo actually moves the view.
        mainMap = window.L.map(ui.mapEl, {
          crs:              window.L.CRS.Simple,
          minZoom:          -3,
          maxZoom:          2,
          dragging:         false,
          zoomControl:      false,
          attributionControl: false,
          scrollWheelZoom:  false,
          doubleClickZoom:  false
        });
        window.L.imageOverlay(mapDoc.map.background.image_key, bounds).addTo(mainMap);
        mainMap.setView(center, BG_ZOOM, { animate: false });

        // ── Lens map ──────────────────────────────────────────────────────
        var lensUrl = (mapDoc.map.lens && mapDoc.map.lens.image_key)
          ? mapDoc.map.lens.image_key
          : mapDoc.map.background.image_key;

        lensMap = window.L.map(ui.lensMapEl, {
          crs:              window.L.CRS.Simple,
          dragging:         false,
          zoomControl:      false,
          attributionControl: false
        });
        window.L.imageOverlay(lensUrl, bounds).addTo(lensMap);

        // ── Hitboxes ──────────────────────────────────────────────────────
        // Rectangles go on the LENS map (zoomed-in view), so they're big
        // enough to tap easily on mobile.
        // They receive clicks because lensMapEl has pointer-events:auto
        // explicitly set all the way up the chain.
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
                      (loc.emoji || "📍") + " " + loc.name + "</div>"
              }),
              interactive: false
            }
          ).addTo(lensMap);
        });

        // ── Map move event ─────────────────────────────────────────────────
        mainMap.on("move", function() {
          syncLens();
          updateKnobs(px);
        });

        // ── Bind knobs (once) ─────────────────────────────────────────────
        bindKnobs(px);

        // ── Let browser settle layout, then invalidate ─────────────────────
        // Two passes because some hosts (Odoo) finish layout after the first.
        return nextFrame().then(function() {
          try { mainMap.invalidateSize({ animate: false }); } catch(e){}
          try { lensMap.invalidateSize({ animate: false }); } catch(e){}
          return nextFrame();
        }).then(function() {
          try { mainMap.invalidateSize({ animate: false }); } catch(e){}
          try { lensMap.invalidateSize({ animate: false }); } catch(e){}
          // Re-apply the desired view in case invalidateSize triggered a fitBounds
          mainMap.setView(center, BG_ZOOM, { animate: false });
          syncLens();
          updateKnobs(px);
        });

      }).then(function() {
        hideLoader();
      }).catch(function(err) {
        if (err && err.name === "AbortError") return; // normal on Reload
        console.error("Canyon Map init failed:", err);
        hideLoader();
        ui.drawerContentEl.innerHTML =
          '<div style="color:#f55;padding:1rem">Load failed: ' + (err && err.message) + '</div>';
        ui.drawerEl.classList.add("open");
      });
    }

    // ── Button wiring ─────────────────────────────────────────────────────────
    root.querySelector("#cc-cm-reload").onclick = function() { init(); };
    root.querySelector("#close-dr").onclick     = function() { ui.drawerEl.classList.remove("open"); };
    root.querySelector("#cc-cm-fit").onclick    = function() {
      if (!mainMap || !mapDoc) return;
      var p = mapDoc.map.background.image_pixel_size;
      mainMap.setView([p.h / 2, p.w / 2], BG_ZOOM, { animate: false });
    };

    return init().then(function() { return {}; });
  }

  window.CC_CanyonMap = { mount: mount };

})();
