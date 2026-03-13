/* File: apps/app_canyon_map/cc_app_canyon_map.js
   Coffin Canyon — Canyon Map
   Loaded by cc_loader_core.js — exposes window.CC_APP.init()
*/

(function () {

  // ── Zoom constants ──────────────────────────────────────────────────────
  // BG_ZOOM: more negative = more zoomed out = shows more of the image at once.
  // LENS_ZOOM: higher = more zoomed in = the magnified detail view.
  // Both maps always pan to the same image coordinate.  Because the bg is
  // more zoomed out, the image appears to travel faster on screen per knob
  // unit — it covers more ground to cross the same pixel distance.
  var BG_ZOOM       = -2;   // overview — tune more negative to zoom out further
  var LENS_ZOOM     =  0;   // detail — tune positive to zoom in further
  var MIN_LOADER_MS = 700;

  // (No V_MIN / H_MIN limits — state.h and state.v run 0–100 across the full
  //  image range, and Leaflet's maxBounds prevents overshooting the image edge.)

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
    frameUrl:      "https://raw.githubusercontent.com/steamcrow/coffin/main/apps/app_canyon_map/data/mag_frame3.png"
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
  var knobStyleEl;  // dynamic <style> tag — only way to beat !important in stylesheet

  var state = { h: 50, v: 50 };
  var imgW  = 0;   // image pixel width  — set in createOverlays
  var imgH  = 0;   // image pixel height — set in createOverlays

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
    // CRS.Simple = plain pixel coords, not geographic lat/lng.
    mapBG = L.map(bgDiv, {
      crs:                L.CRS.Simple,
      zoomControl:        false,
      attributionControl: false,
      dragging:           false,
      scrollWheelZoom:    false
    });

    mapLens = L.map(lensMapDiv, {
      crs:                L.CRS.Simple,
      zoomControl:        false,
      attributionControl: false,
      dragging:           false,
      scrollWheelZoom:    false,
      zoomSnap:           0
    });

    // Override Leaflet's default grey (#ddd) tile background so the area
    // outside the image is dark, not white.  Do this via a scoped style tag
    // so it survives Leaflet's own stylesheet being loaded later.
    var bgStyle = document.createElement("style");
    bgStyle.textContent =
      "#cc-bg-map.leaflet-container," +
      "#cc-lens-map.leaflet-container{background:#0d0b0a !important;}";
    document.head.appendChild(bgStyle);
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

      imgW = w;
      imgH = h;

      if (!bgUrl || !lensUrl) {
        reject("Map JSON missing image_key fields"); return;
      }

      // CRS.Simple: [lat,lng] = [y,x], so bounds are [[0,0],[h,w]]
      var bounds = [[0, 0], [h, w]];
      var center = [h / 2, w / 2];

      var bgOverlay   = L.imageOverlay(bgUrl,   bounds).addTo(mapBG);
      var lensOverlay = L.imageOverlay(lensUrl, bounds).addTo(mapLens);

      // maxBounds locks each map to the image edges — prevents panning to white.
      // maxBoundsViscosity:1 makes it a hard wall, not a rubber-band.
      mapBG.setMaxBounds(bounds);
      mapBG.options.maxBoundsViscosity = 1;
      mapLens.setMaxBounds(bounds);
      mapLens.options.maxBoundsViscosity = 1;

      var center = [h / 2, w / 2];
      mapBG.setView(center,   BG_ZOOM);
      mapLens.setView(center, LENS_ZOOM);

      Promise.all([
        new Promise(function (r) { bgOverlay.once("load",   r); }),
        new Promise(function (r) { lensOverlay.once("load", r); })
      ]).then(resolve).catch(reject);
    });
  }

  // ── Sync both maps + knob positions to current state ───────────────────
  //
  //  state.h / state.v are 0–100.  Both maps pan to the exact same image
  //  coordinate.  Because the BG is more zoomed out, it covers the same
  //  image distance but in fewer screen pixels — so it appears to scroll
  //  faster and show more context as the knob moves.
  //
  //  Knob positioning uses a dynamic <style> tag inserted after the app CSS.
  //  This is the only reliable way to override !important rules in an external
  //  stylesheet — a later stylesheet always wins at equal specificity.
  //
  function applyView() {
    if (!imgW || !imgH) return;

    var t_h = clamp01(state.h / 100);
    var t_v = clamp01(state.v / 100);

    // Image-space coordinate — same for both maps
    var lat = imgH * t_v;
    var lng = imgW * t_h;

    mapBG.panTo(  [lat, lng], { animate: false });
    mapLens.panTo([lat, lng], { animate: false });

    // Inject / update a <style> tag that is always last in <head>.
    // It beats the app stylesheet's !important rules because it comes after.
    if (!knobStyleEl) {
      knobStyleEl = document.createElement("style");
      knobStyleEl.id = "cc-knob-dyn";
      document.head.appendChild(knobStyleEl);
    }
    knobStyleEl.textContent =
      "#cc-scroll-knob-v{top:"  + (t_v * 100).toFixed(2) + "%!important;}" +
      "#cc-scroll-knob-h{left:" + (t_h * 100).toFixed(2) + "%!important;}";
  }

  // ── Update --device-scale so frame/lens/knobs resize with container ─────
  function updateDeviceScale() {
    if (!mapWrap) return;
    // 1200px is the design reference width; clamp at 1 so we never scale up
    var scale = Math.min(1, mapWrap.offsetWidth / 1200);
    mapWrap.style.setProperty("--device-scale", scale.toString());
    if (mapBG)   mapBG.invalidateSize();
    if (mapLens) mapLens.invalidateSize();
    applyView();
  }

  // ── Drag handling for both scroll knobs ─────────────────────────────────
  function bindKnobs() {

    function startDrag(e, axis) {
      e.preventDefault();
      e.currentTarget.setPointerCapture(e.pointerId);
      e.currentTarget.classList.add("is-active");

      var track = e.currentTarget.parentElement;
      var rect  = track.getBoundingClientRect();

      function onMove(ev) {
        if (axis === "v") {
          state.v = clamp01((ev.clientY - rect.top)  / rect.height) * 100;
        } else {
          state.h = clamp01((ev.clientX - rect.left) / rect.width)  * 100;
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

    // Resize: recalculate scale + re-sync maps when the container changes size
    if (window.ResizeObserver) {
      var ro = new ResizeObserver(function () { updateDeviceScale(); });
      ro.observe(mapWrap);
    } else {
      window.addEventListener("resize", updateDeviceScale);
    }
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
    root        = rootEl;
    mapBG       = null;
    mapLens     = null;
    knobV       = null;
    knobH       = null;
    knobStyleEl = null;
    state       = { h: 50, v: 50 };
    imgW        = 0;
    imgH        = 0;

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
      updateDeviceScale();   // sets --device-scale + calls applyView
      bindKnobs();
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
