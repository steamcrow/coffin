/* File: apps/app_canyon_map/cc_app_canyon_map.js
   Coffin Canyon — Canyon Map
   Loaded by cc_loader_core.js — exposes window.CC_APP.init()
*/

(function () {

  // ── Zoom constants ──────────────────────────────────────────────────────
  var BG_ZOOM          = -1;
  var LENS_ZOOM_OFFSET = 0.95;
  var MIN_LOADER_MS    = 700;

  // ── Pan limits (% of image) ─────────────────────────────────────────────
  var V_MIN = 24;
  var V_MAX = 76;
  var H_MIN = 18;
  var H_MAX = 82;

  // ── Location hitboxes — pixel bounding boxes [x1,y1,x2,y2] ────────────
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

  // Expose globally so Scenario Builder's ensureHitboxes() can read them
  window.CC_HITBOXES = HITBOXES;

  // ── Asset URLs ──────────────────────────────────────────────────────────
  var DEFAULTS = {
    mapUrl:        "https://raw.githubusercontent.com/steamcrow/coffin/main/apps/app_canyon_map/data/canyon_map.json",
    appCssUrl:     "https://raw.githubusercontent.com/steamcrow/coffin/main/apps/app_canyon_map/cc_canyon_map.css",
    leafletCssUrl: "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css",
    leafletJsUrl:  "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js",
    logoUrl:       "https://raw.githubusercontent.com/steamcrow/coffin/main/assets/logos/coffin_canyon_logo.png",
    knobUrl:       "https://raw.githubusercontent.com/steamcrow/coffin/main/apps/app_canyon_map/data/blappo_knob.png",
    frameUrl:      "https://raw.githubusercontent.com/steamcrow/coffin/main/apps/app_canyon_map/data/canyon_map_frame.png"
  };

  // ── Module-level refs ───────────────────────────────────────────────────
  var root;
  var mapWrap;
  var mapBG;
  var mapLens;
  var knobV;
  var knobH;
  var loaderEl;
  var loaderStart;

  var state = { h: 50, v: 50 };

  // ── Tiny DOM helper ─────────────────────────────────────────────────────
  function el(tag, attrs, children) {
    var e = document.createElement(tag);
    if (attrs) {
      Object.keys(attrs).forEach(function (k) {
        if (k === "class")      e.className     = attrs[k];
        else if (k === "style") e.style.cssText = attrs[k];
        else                    e.setAttribute(k, attrs[k]);
      });
    }
    (children || []).forEach(function (c) {
      if (typeof c === "string") e.appendChild(document.createTextNode(c));
      else if (c)                e.appendChild(c);
    });
    return e;
  }

  // ── Asset loaders ───────────────────────────────────────────────────────
  function loadCSS(url) {
    return fetch(url + "?t=" + Date.now())
      .then(function (r) { return r.text(); })
      .then(function (css) {
        var s = document.createElement("style");
        s.textContent = css;
        document.head.appendChild(s);
      });
  }

  function loadScript(url) {
    return new Promise(function (resolve, reject) {
      if (window.L) { resolve(); return; }
      var s     = document.createElement("script");
      s.src     = url;
      s.async   = false;
      s.onload  = function () { window.L ? resolve() : reject("Leaflet failed to initialize"); };
      s.onerror = reject;
      document.head.appendChild(s);
    });
  }

  // ── Build the DOM tree that matches cc_canyon_map.css ──────────────────
  //
  //  .cc-canyon-map
  //    .cc-cm-shell
  //      .cc-cm-mapwrap
  //        .cc-cm-map                  ← bg Leaflet target  (z-index:1)
  //        .cc-lens                    ← positioned inset   (z-index:10)
  //          .cc-lens-inner
  //            .cc-lens-overscan
  //              .cc-lens-map          ← lens Leaflet target
  //            .cc-lens-chromatic      ← decorative ring
  //            .cc-lens-glare          ← decorative glare
  //        .cc-frame-overlay           ← frame PNG          (z-index:50)
  //          img.cc-frame-image
  //        .cc-scroll-vertical         ← knob track         (z-index:60)
  //          button#cc-scroll-knob-v.cc-scroll-knob
  //            img.cc-scroll-knob-img
  //        .cc-scroll-horizontal       ← knob track         (z-index:60)
  //          button#cc-scroll-knob-h.cc-scroll-knob
  //            img.cc-scroll-knob-img
  //        .cc-cm-loader               ← loading overlay    (z-index:80)
  //
  function buildDOM(opts) {

    var bgDiv      = el("div", { class: "cc-cm-map",         id: "cc-bg-map"   });

    var lensMapDiv = el("div", { class: "cc-lens-map",       id: "cc-lens-map" });
    var overscan   = el("div", { class: "cc-lens-overscan"                     }, [lensMapDiv]);
    var chromatic  = el("div", { class: "cc-lens-chromatic"                    });
    var glare      = el("div", { class: "cc-lens-glare"                        });
    var lensInner  = el("div", { class: "cc-lens-inner"                        }, [overscan, chromatic, glare]);
    var lensDiv    = el("div", { class: "cc-lens"                              }, [lensInner]);

    var frameImg   = el("img", { class: "cc-frame-image", src: opts.frameUrl, alt: "" });
    var frameDiv   = el("div", { class: "cc-frame-overlay"                     }, [frameImg]);

    knobV = el("button", { class: "cc-scroll-knob", id: "cc-scroll-knob-v", type: "button" }, [
      el("img", { class: "cc-scroll-knob-img", src: opts.knobUrl, alt: "scroll" })
    ]);
    var scrollV = el("div", { class: "cc-scroll-vertical" }, [knobV]);

    knobH = el("button", { class: "cc-scroll-knob", id: "cc-scroll-knob-h", type: "button" }, [
      el("img", { class: "cc-scroll-knob-img", src: opts.knobUrl, alt: "scroll" })
    ]);
    var scrollH = el("div", { class: "cc-scroll-horizontal" }, [knobH]);

    loaderEl = el("div", { class: "cc-cm-loader" }, [
      el("img", { src: opts.logoUrl, alt: "Coffin Canyon" }),
      el("div", { class: "cc-cm-loader-spin" })
    ]);

    mapWrap = el("div", { class: "cc-cm-mapwrap" }, [
      bgDiv, lensDiv, frameDiv, scrollV, scrollH, loaderEl
    ]);

    var shell = el("div", { class: "cc-cm-shell"       }, [mapWrap]);
    var wrap  = el("div", { class: "cc-canyon-map"     }, [shell]);

    root.appendChild(wrap);

    return { bgDiv: bgDiv, lensMapDiv: lensMapDiv };
  }

  // ── Leaflet map instances ───────────────────────────────────────────────
  function createMaps(bgDiv, lensMapDiv) {
    // CRS.Simple = plain pixel coords, not geographic lat/lng
    mapBG = L.map(bgDiv, {
      crs:               L.CRS.Simple,
      zoomControl:       false,
      attributionControl: false,
      dragging:          false,
      scrollWheelZoom:   false
    });

    mapLens = L.map(lensMapDiv, {
      crs:               L.CRS.Simple,
      zoomControl:       false,
      attributionControl: false,
      dragging:          false,
      scrollWheelZoom:   false,
      zoomSnap:          0
    });
  }

  // ── Image overlays ──────────────────────────────────────────────────────
  function createOverlays(mapData) {
    return new Promise(function (resolve, reject) {
      if (!mapData.map || !mapData.map.background || !mapData.map.lens) {
        reject("Map JSON missing map.background or map.lens"); return;
      }

      var bgUrl   = mapData.map.background.image_key;
      var lensUrl = mapData.map.lens.image_key;
      var w       = mapData.map.background.image_pixel_size.w;
      var h       = mapData.map.background.image_pixel_size.h;

      if (!bgUrl || !lensUrl) {
        reject("Map JSON missing image_key fields"); return;
      }

      // CRS.Simple: [lat,lng] = [y,x], so bounds are [[0,0],[h,w]]
      var bounds = [[0, 0], [h, w]];
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
      ]).then(resolve).catch(reject);
    });
  }

  // ── Sync both maps + knob positions to current state ───────────────────
  function applyView() {
    var rect  = mapWrap.getBoundingClientRect();
    var x     = rect.width  * (state.h / 100);
    var y     = rect.height * (state.v / 100);

    // With CRS.Simple, containerPointToLatLng returns image-space [y,x]
    var point = mapBG.containerPointToLatLng([x, y]);
    mapBG.panTo(point,   { animate: false });
    mapLens.panTo(point, { animate: false });

    // Map state percentage range → 0–100% within knob tracks
    var vPct = (state.v - V_MIN) / (V_MAX - V_MIN) * 100;
    var hPct = (state.h - H_MIN) / (H_MAX - H_MIN) * 100;

    knobV.style.top  = vPct + "%";
    knobH.style.left = hPct + "%";
  }

  // ── Drag handling for both scroll knobs ─────────────────────────────────
  function bindKnobs() {

    function startDrag(e, axis) {
      e.preventDefault();
      e.currentTarget.setPointerCapture(e.pointerId);
      e.currentTarget.classList.add("is-active");

      // Measure the track (parent div), not the knob itself
      var track = e.currentTarget.parentElement;
      var rect  = track.getBoundingClientRect();

      function onMove(ev) {
        var pct;
        if (axis === "v") {
          pct     = (ev.clientY - rect.top)  / rect.height * 100;
          state.v = V_MIN + clamp01(pct / 100) * (V_MAX - V_MIN);
        } else {
          pct     = (ev.clientX - rect.left) / rect.width  * 100;
          state.h = H_MIN + clamp01(pct / 100) * (H_MAX - H_MIN);
        }
        applyView();
      }

      function onUp() {
        knobV.classList.remove("is-active");
        knobH.classList.remove("is-active");
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup",   onUp);
      }

      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup",   onUp);
    }

    knobV.addEventListener("pointerdown", function (e) { startDrag(e, "v"); });
    knobH.addEventListener("pointerdown", function (e) { startDrag(e, "h"); });
  }

  function clamp01(v) { return Math.min(1, Math.max(0, v)); }

  // ── Fade out and remove loader ──────────────────────────────────────────
  function hideLoader() {
    var elapsed = performance.now() - loaderStart;
    var wait    = Math.max(0, MIN_LOADER_MS - elapsed);
    setTimeout(function () {
      loaderEl.style.transition = "opacity 0.35s ease";
      loaderEl.style.opacity    = "0";
      setTimeout(function () { if (loaderEl.parentNode) loaderEl.remove(); }, 400);
    }, wait);
  }

  // ── Mount ───────────────────────────────────────────────────────────────
  function mount(rootEl, opts) {
    root    = rootEl;
    mapBG   = null;
    mapLens = null;
    knobV   = null;
    knobH   = null;
    state   = { h: 50, v: 50 };

    var o = Object.assign({}, DEFAULTS, opts || {});
    loaderStart = performance.now();

    Promise.all([
      loadCSS(o.leafletCssUrl),
      loadCSS(o.appCssUrl),
      loadScript(o.leafletJsUrl)
    ])
    .then(function () {
      var divs = buildDOM(o);
      createMaps(divs.bgDiv, divs.lensMapDiv);
      return fetch(o.mapUrl + "?t=" + Date.now()).then(function (r) { return r.json(); });
    })
    .then(function (mapData) {
      return createOverlays(mapData);
    })
    .then(function () {
      mapBG.invalidateSize();
      mapLens.invalidateSize();
      bindKnobs();
      applyView();
      hideLoader();
    })
    .catch(function (err) {
      console.error("Canyon Map load error:", err);
      hideLoader();
    });
  }

  // ── Standard CC_APP interface ───────────────────────────────────────────
  window.CC_APP = {
    init: function (options) {
      console.log("🗺️ Canyon Map init");
      mount(options.root, {});
    },
    destroy: function () {
      if (mapBG)   { try { mapBG.remove();   } catch (_) {} mapBG   = null; }
      if (mapLens) { try { mapLens.remove(); } catch (_) {} mapLens = null; }
    }
  };

  // Legacy direct-mount path
  window.CC_CanyonMap = { mount: mount };

  console.log("🗺️ Canyon Map app loaded");

})();
