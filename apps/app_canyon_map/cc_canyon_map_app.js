/* File: apps/app_canyon_map/cc_app_canyon_map.js
   Coffin Canyon — Canyon Map
   Loaded by cc_loader_core.js — exposes window.CC_APP.init()
*/

(function () {

  var BG_ZOOM = -1;
  var LENS_ZOOM_OFFSET = 0.95;
  var MIN_LOADER_MS = 700;

  var V_MIN = 24;
  var V_MAX = 76;
  var H_MIN = 18;
  var H_MAX = 82;

  // ── Location hitboxes — pixel bounding boxes on the background image ───
  // Format: [x1, y1, x2, y2]  (top-left → bottom-right, image pixel coords)
  // Exposed as window.CC_HITBOXES so other apps (e.g. Scenario Builder) can
  // highlight locations on the overview image without re-loading this file.
  var HITBOXES = {
    "bandit-buck":       [1550, 956,  1668, 1160],
    "bayou-city":        [1175, 2501, 1386, 2767],
    "camp-coffin":       [2000, 1200, 2300, 1400],
    "cowtown":           [2172, 2112, 2332, 2396],
    "crackpits":         [2628, 1628, 2816, 1968],
    "deerhoof":          [3112, 2130, 3329, 2412],
    "diablo":            [505,  1432, 716,  1698],
    "dustbuck":          [1986, 2286, 2156, 2522],
    "fool-boot":         [2408, 1132, 2512, 1224],
    "fort-plunder":      [3348, 1209, 3631, 1427],
    "fortune":           [2887, 1284, 3121, 1567],
    "ghost-mountain":    [2597, 205,  2849, 489 ],
    "gore-mule-drop":    [2872, 1600, 3092, 2076],
    "grade-grind":       [2486, 1432, 2598, 1548],
    "heckweed":          [2312, 1824, 2440, 1944],
    "huck":              [3332, 2569, 3550, 2749],
    "kraise":            [1995, 1270, 2193, 1527],
    "little-rica":       [2964, 500,  3182, 784 ],
    "lost-yots":         [1576, 1266, 1958, 1586],
    "martygrail":        [2392, 1620, 2520, 1748],
    "mindshaft":         [3112, 804,  3388, 1164],
    "pallor":            [1616, 1824, 1996, 1924],
    "plata":             [2513, 916,  2765, 1089],
    "quinne-jimmy":      [1694, 801,  1852, 1157],
    "ratsville":         [1452, 1968, 1644, 2194],
    "rey":               [19,   1883, 230,  2046],
    "river-city":        [1068, 1595, 1279, 1861],
    "sangr":             [1105, 1172, 1315, 1573],
    "santos-grin":       [1185, 1898, 1396, 2176],
    "silverpit":         [2128, 1548, 2294, 1762],
    "skull-water":       [1609, 492,  1841, 701 ],
    "splitglass-arroyo": [2605, 1138, 2859, 1427],
    "tin-flats":         [1374, 1258, 1512, 1608],
    "tzulto":            [2229, 1334, 2447, 1526],
    "widowflow":         [1316, 1630, 2078, 1798],
    "witches-roost":     [3767, 2130, 3965, 2495]
  };

  // Make hitboxes available globally so the Scenario Builder can read them
  // by calling ensureHitboxes() which loads this script then reads window.CC_HITBOXES
  window.CC_HITBOXES = HITBOXES;

  var DEFAULTS = {
    title:         "Coffin Canyon — Canyon Map",
    mapUrl:        "https://raw.githubusercontent.com/steamcrow/coffin/main/apps/app_canyon_map/data/canyon_map.json",
    appCssUrl:     "https://raw.githubusercontent.com/steamcrow/coffin/main/apps/app_canyon_map/cc_canyon_map.css",
    leafletCssUrl: "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css",
    leafletJsUrl:  "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js",
    logoUrl:       "https://raw.githubusercontent.com/steamcrow/coffin/main/assets/logos/coffin_canyon_logo.png",
    knobUrl:       "https://raw.githubusercontent.com/steamcrow/coffin/main/apps/app_canyon_map/data/blappo_knob.png"
  };

  // Module-level references set during mount()
  var root;
  var mapBG;
  var mapLens;
  var knobH;
  var knobV;

  var state = { h: 50, v: 50 };
  var loaderStart;

  // ── Tiny DOM helper ─────────────────────────────────────────────────────
  function el(tag, attrs, children) {
    var e = document.createElement(tag);
    if (attrs) {
      Object.keys(attrs).forEach(function (k) {
        if (k === "class") e.className = attrs[k];
        else e.setAttribute(k, attrs[k]);
      });
    }
    (children || []).forEach(function (c) {
      if (typeof c === "string") e.appendChild(document.createTextNode(c));
      else e.appendChild(c);
    });
    return e;
  }

  // ── Asset loaders ───────────────────────────────────────────────────────
  function loadCSS(url) {
    return fetch(url)
      .then(function (r) { return r.text(); })
      .then(function (css) {
        var s = document.createElement("style");
        s.textContent = css;
        document.head.appendChild(s);
      });
  }

  function loadScript(url) {
    return new Promise(function (resolve, reject) {
      // Leaflet may already be present from another app
      if (window.L) { resolve(); return; }
      var s = document.createElement("script");
      s.src   = url;
      s.async = false;
      s.onload  = function () { window.L ? resolve() : reject("Leaflet failed to initialize"); };
      s.onerror = reject;
      document.head.appendChild(s);
    });
  }

  // ── Loader overlay ──────────────────────────────────────────────────────
  function buildLoader() {
    var style = document.createElement("style");
    style.textContent = [
      ".cc-loader{position:absolute;inset:0;display:flex;",
      "align-items:center;justify-content:center;background:#000;z-index:999;}",
      ".cc-loader img{width:280px;height:auto;}",
      // Ensure Leaflet containers always have a size regardless of external CSS.
      // background-color:#1a1a1a makes a grey box visible if the image fails to load.
      "#cc-bg-map,#cc-lens-map{width:100%;height:100%;background-color:#1a1a1a;}"
    ].join("");
    document.head.appendChild(style);

    var loader = el("div", { class: "cc-loader" }, [
      el("img", { src: DEFAULTS.logoUrl })
    ]);
    root.appendChild(loader);
    return loader;
  }

  function hideLoader(loader) {
    var elapsed = performance.now() - loaderStart;
    var wait    = Math.max(0, MIN_LOADER_MS - elapsed);
    setTimeout(function () { loader.remove(); }, wait);
  }

  // ── Layout ──────────────────────────────────────────────────────────────
  function createLayout() {
    var bg   = el("div", { id: "cc-bg-map" });
    var lens = el("div", { id: "cc-lens-map" });

    bg.style.position   = "absolute";
    bg.style.inset      = "0";
    bg.style.width      = "100%";
    bg.style.height     = "100%";
    lens.style.position = "absolute";
    lens.style.inset    = "0";
    lens.style.width    = "100%";
    lens.style.height   = "100%";

    knobH = el("img", { class: "cc-knob-h", src: DEFAULTS.knobUrl });
    knobV = el("img", { class: "cc-knob-v", src: DEFAULTS.knobUrl });

    root.appendChild(bg);
    root.appendChild(lens);
    root.appendChild(knobH);
    root.appendChild(knobV);

    // CRS.Simple tells Leaflet these are plain pixel coordinates,
    // not geographic lat/lng. Without this, image overlays render as a white box.
    mapBG = L.map(bg, {
      crs:              L.CRS.Simple,
      zoomControl:      false,
      attributionControl: false,
      dragging:         false,
      scrollWheelZoom:  false
    });

    mapLens = L.map(lens, {
      crs:              L.CRS.Simple,
      zoomControl:      false,
      attributionControl: false,
      dragging:         false,
      scrollWheelZoom:  false,
      zoomSnap:         0
    });
  }

  // ── Overlays ────────────────────────────────────────────────────────────
  function createOverlays(mapData) {
    return new Promise(function (resolve, reject) {
      if (!mapData.map || !mapData.map.background || !mapData.map.lens) {
        reject("Map JSON missing map.background or map.lens");
        return;
      }

      var bgUrl   = mapData.map.background.image_key;
      var lensUrl = mapData.map.lens.image_key;

      if (!bgUrl || !lensUrl) {
        reject("Map JSON missing image_key fields");
        return;
      }

      var w = mapData.map.background.image_pixel_size.w;
      var h = mapData.map.background.image_pixel_size.h;

      // In CRS.Simple, Leaflet maps [lat, lng] → [y, x].
      // So bounds go from the top-left [0,0] to the bottom-right [h, w].
      var bounds = [[0, 0], [h, w]];

      // Center is the middle of the image in pixel space.
      var center = [h / 2, w / 2];

      var bgOverlay   = L.imageOverlay(bgUrl,   bounds).addTo(mapBG);
      var lensOverlay = L.imageOverlay(lensUrl, bounds).addTo(mapLens);

      mapBG.setView(center,  BG_ZOOM);
      mapLens.setView(center, BG_ZOOM + LENS_ZOOM_OFFSET);

      mapBG.setZoom(BG_ZOOM);
      mapLens.setZoom(BG_ZOOM + LENS_ZOOM_OFFSET);

      Promise.all([
        new Promise(function (r) { bgOverlay.once("load",   r); }),
        new Promise(function (r) { lensOverlay.once("load", r); })
      ]).then(resolve);
    });
  }

  // ── View sync ───────────────────────────────────────────────────────────
  function applyView() {
    var rect  = root.getBoundingClientRect();

    // Convert knob percentage position to a pixel point in the container,
    // then ask Leaflet to translate that screen point into map coordinates.
    var x     = rect.width  * (state.h / 100);
    var y     = rect.height * (state.v / 100);

    // containerPointToLatLng works correctly with CRS.Simple —
    // it returns [pixelY, pixelX] in image space.
    var point = mapBG.containerPointToLatLng([x, y]);

    mapBG.panTo(point,   { animate: false });
    mapLens.panTo(point, { animate: false });

    knobH.style.left = state.h + "%";
    knobV.style.top  = state.v + "%";
  }

  // ── Knob drag ───────────────────────────────────────────────────────────
  function bindKnobs() {
    function dragStart(e, axis) {
      e.preventDefault();
      e.target.setPointerCapture(e.pointerId);
      var rect = root.getBoundingClientRect();

      function move(ev) {
        if (axis === "h") {
          var x = (ev.clientX - rect.left) / rect.width * 100;
          state.h = Math.min(H_MAX, Math.max(H_MIN, x));
        }
        if (axis === "v") {
          var y = (ev.clientY - rect.top) / rect.height * 100;
          state.v = Math.min(V_MAX, Math.max(V_MIN, y));
        }
        applyView();
      }

      function up() {
        window.removeEventListener("pointermove", move);
        window.removeEventListener("pointerup",   up);
      }

      window.addEventListener("pointermove", move);
      window.addEventListener("pointerup",   up);
    }

    knobH.addEventListener("pointerdown", function (e) { dragStart(e, "h"); });
    knobV.addEventListener("pointerdown", function (e) { dragStart(e, "v"); });
  }

  // ── Core mount ──────────────────────────────────────────────────────────
  function mount(rootEl, opts) {
    // Reset module-level state so the app is safe to re-mount
    root    = rootEl;
    mapBG   = null;
    mapLens = null;
    knobH   = null;
    knobV   = null;
    state   = { h: 50, v: 50 };

    root.style.position = "relative";
    root.style.width    = "100%";
    root.style.height   = "100vh";

    var o = Object.assign({}, DEFAULTS, opts || {});

    loaderStart = performance.now();
    var loader  = buildLoader();

    Promise.all([
      loadCSS(o.leafletCssUrl),
      loadCSS(o.appCssUrl),
      loadScript(o.leafletJsUrl)
    ])
    .then(function () {
      createLayout();
      return fetch(o.mapUrl).then(function (r) { return r.json(); });
    })
    .then(function (mapData) {
      return createOverlays(mapData);
    })
    .then(function () {
      mapBG.invalidateSize();
      mapLens.invalidateSize();
      bindKnobs();
      applyView();
      hideLoader(loader);
    })
    .catch(function (err) {
      console.error("Canyon Map load error:", err);
      hideLoader(loader);
    });
  }

  // ── Standard CC_APP interface (required by cc_loader_core.js) ──────────
  //
  //  The loader calls:  window.CC_APP.init({ root, ctx })
  //  root  = the #cc-app-root DOM element
  //  ctx   = { app, rulesBase, helpers }  (unused by this app)
  //
  window.CC_APP = {
    init: function (options) {
      console.log("🗺️ Canyon Map init");
      mount(options.root, {});
    },
    destroy: function () {
      // Clean up Leaflet instances so the loader can safely re-mount other apps
      if (mapBG)   { try { mapBG.remove();   } catch (_) {} mapBG   = null; }
      if (mapLens) { try { mapLens.remove(); } catch (_) {} mapLens = null; }
    }
  };

  // Legacy direct-mount path (kept for any standalone usage)
  window.CC_CanyonMap = { mount: mount };

  console.log("🗺️ Canyon Map app loaded");

})();
