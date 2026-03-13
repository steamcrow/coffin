/* File: apps/app_canyon_map/cc_app_canyon_map.js
   Coffin Canyon — Canyon Map
   Loaded by cc_loader_core.js — exposes window.CC_APP.init()
*/

(function () {

  // ── Zoom offsets (applied to the dynamically computed fill zoom) ────────
  //
  //  After loading the image we measure the actual container sizes and compute
  //  the "fill zoom" — the Leaflet zoom level at which the image exactly covers
  //  the BG container.  These offsets are applied on top of that:
  //
  //  BG_ZOOM_OFFSET  < 0 → slightly MORE zoomed out than fill (shows full map)
  //  LENS_ZOOM_EXTRA > 0 → MUCH more zoomed in than fill (detail view)
  //
  var BG_ZOOM_OFFSET  = -0.2;  // BG: full-map overview, slightly outside fill
  var LENS_ZOOM_EXTRA =  1.9;  // Lens: zoomed in by this much relative to BG (~20% less than before)

  var MIN_LOADER_MS = 700;

  // ── Knob travel limits within their tracks (%) ─────────────────────────
  var V_MIN = 8;
  var V_MAX = 92;
  // Horizontal track is 900px wide at full scale.
  // Shift left by 60px (60/900*100 ≈ 6.7%) and right by 20px (≈2.2%)
  var H_MIN = 1;
  var H_MAX = 94;

  // ── Location hitboxes [y1, x1, y2, x2] in image pixel coords ───────────
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

  window.CC_HITBOXES = HITBOXES;

  // ── Asset URLs ──────────────────────────────────────────────────────────
  var DEFAULTS = {
    title:         "Coffin Canyon — Canyon Map",
    mapUrl:        "https://raw.githubusercontent.com/steamcrow/coffin/main/apps/app_canyon_map/data/canyon_map.json",
    locationsUrl:  "https://raw.githubusercontent.com/steamcrow/coffin/main/data/src/170_named_locations.json",
    appCssUrl:     "https://raw.githubusercontent.com/steamcrow/coffin/main/apps/app_canyon_map/cc_canyon_map.css",
    leafletCssUrl: "https://raw.githubusercontent.com/steamcrow/coffin/main/vendor/leaflet/leaflet.css",
    leafletJsUrl:  "https://raw.githubusercontent.com/steamcrow/coffin/main/vendor/leaflet/leaflet.js",
    logoUrl:       "https://raw.githubusercontent.com/steamcrow/coffin/main/assets/logos/coffin_canyon_logo.png",
    frameUrl:      "https://raw.githubusercontent.com/steamcrow/coffin/main/apps/app_canyon_map/data/mag_frame3.png",
    knobUrl:       "https://raw.githubusercontent.com/steamcrow/coffin/main/apps/app_canyon_map/data/blappo_knob.png"
  };

  // ── Loaded-once cache ───────────────────────────────────────────────────
  var _loaded  = { css: {}, js: {} };
  var _destroyFn = null;

  // ── Tiny DOM builder ────────────────────────────────────────────────────
  function el(tag, attrs, children) {
    attrs    = attrs    || {};
    children = children || [];
    var n = document.createElement(tag);
    Object.keys(attrs).forEach(function (k) {
      var v = attrs[k];
      if      (k === "class")                              n.className = v;
      else if (k === "style")                              n.setAttribute("style", v);
      else if (k.indexOf("on") === 0 && typeof v === "function")
                                                           n.addEventListener(k.slice(2).toLowerCase(), v);
      else                                                 n.setAttribute(k, v);
    });
    children.forEach(function (c) {
      n.appendChild(typeof c === "string" ? document.createTextNode(c) : c);
    });
    return n;
  }

  function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

  function delay(ms) {
    return new Promise(function (r) { setTimeout(r, ms); });
  }

  function nextFrame() {
    return new Promise(function (r) { requestAnimationFrame(r); });
  }

  function rafThrottle(fn) {
    var pending = false, lastArgs;
    return function () {
      lastArgs = arguments;
      if (pending) return;
      pending = true;
      requestAnimationFrame(function () { pending = false; fn.apply(null, lastArgs); });
    };
  }

  function fetchText(url) {
    var u = url + (url.indexOf("?") >= 0 ? "&" : "?") + "t=" + Date.now();
    return fetch(u).then(function (r) {
      if (!r.ok) throw new Error("HTTP " + r.status + ": " + url);
      return r.text();
    });
  }

  function fetchJson(url) {
    var u = url + (url.indexOf("?") >= 0 ? "&" : "?") + "t=" + Date.now();
    return fetch(u).then(function (r) {
      if (!r.ok) throw new Error("HTTP " + r.status + ": " + url);
      return r.json();
    });
  }

  function loadCssOnce(url, key) {
    if (_loaded.css[key]) return Promise.resolve();
    return fetchText(url).then(function (css) {
      var s = document.createElement("style");
      s.setAttribute("data-cc-style", key);
      s.textContent = css;
      document.head.appendChild(s);
      _loaded.css[key] = true;
    });
  }

  function loadScriptOnce(url, key) {
    if (_loaded.js[key]) return Promise.resolve();
    return fetchText(url).then(function (code) {
      var blob    = new Blob([code], { type: "text/javascript" });
      var blobUrl = URL.createObjectURL(blob);
      return new Promise(function (resolve, reject) {
        var s     = document.createElement("script");
        s.src     = blobUrl;
        s.onload  = function () { URL.revokeObjectURL(blobUrl); _loaded.js[key] = true; resolve(); };
        s.onerror = function () { URL.revokeObjectURL(blobUrl); reject(new Error("Script load failed: " + url)); };
        document.head.appendChild(s);
      });
    });
  }

  function ensureDeps(opts) {
    var p = Promise.resolve();
    p = p.then(function () { return loadCssOnce(opts.leafletCssUrl, "leaflet_css"); });
    p = p.then(function () { return loadCssOnce(opts.appCssUrl,     "app_css");     });
    if (!window.L) {
      p = p.then(function () { return loadScriptOnce(opts.leafletJsUrl, "leaflet_js"); });
    }
    return p;
  }

  // ── computeFillZoom ─────────────────────────────────────────────────────
  //
  //  Returns the Leaflet zoom level at which the image FILLS the container
  //  (both dimensions covered — image may be slightly cropped).
  //
  //  In CRS.Simple:  screen_pixels = image_pixels * 2^zoom
  //  So:             zoom = log2(screen_size / image_size)
  //
  //  "fill" uses the LARGER zoom (the axis that needs more zoom to cover).
  //
  function computeFillZoom(containerEl, imgW, imgH) {
    var r  = containerEl.getBoundingClientRect();
    var cW = r.width  || containerEl.offsetWidth  || 1200;
    var cH = r.height || containerEl.offsetHeight || 800;
    var zW = Math.log2(cW / imgW);
    var zH = Math.log2(cH / imgH);
    // +0.4 shows ~40% more detail than bare fill — image slightly larger than container
    return Math.max(zW, zH) + 0.4;
  }

  // ── safeRange ───────────────────────────────────────────────────────────
  //
  //  Compute how far the centre of a map can travel without showing white
  //  space.  If the image is fully contained in the viewport, returns a
  //  locked midpoint (no panning possible).
  //
  function safeRange(containerEl, zoom, imageDim, isWidth) {
    var r    = containerEl.getBoundingClientRect();
    var size = isWidth
      ? (r.width  || containerEl.offsetWidth  || 800)
      : (r.height || containerEl.offsetHeight || 600);
    var visible = size / Math.pow(2, zoom);
    var half    = visible / 2;
    if (half >= imageDim / 2) {
      return { min: imageDim / 2, max: imageDim / 2 };
    }
    return { min: half, max: imageDim - half };
  }

  // ── Drawer ──────────────────────────────────────────────────────────────
  function meterBar(value, max, color) {
    var pct = Math.round(clamp(value || 0, 0, max) / max * 100);
    return '<div style="width:100%;height:22px;background:rgba(255,255,255,.08);border-radius:11px;overflow:hidden;position:relative;border:1px solid rgba(255,255,255,.12)">' +
      '<div style="height:100%;width:' + pct + '%;background:' + color + ';transition:width .25s"></div>' +
      '<div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;color:#fff;font-weight:700;font-size:.8rem">' + (value || 0) + " / " + max + "</div></div>";
  }

  function renderDrawer(ui, loc) {
    ui.drawerTitleEl.textContent = loc.name || loc.id || "Location";
    ui.drawerContentEl.innerHTML =
      '<div class="cc-block"><div class="cc-h">Description</div><p>' + (loc.description || "Unknown territory.") + "</p></div>" +
      '<div class="cc-block"><div class="cc-h">Danger</div>'     + meterBar(loc.danger     || 0, 6, "#ff4444") + "</div>" +
      '<div class="cc-block"><div class="cc-h">Population</div>' + meterBar(loc.population || 0, 6, "#4caf50") + "</div>" +
      (loc.atmosphere ? '<div class="cc-block"><div class="cc-h">Atmosphere</div><p><em>' + loc.atmosphere + "</em></p></div>" : "") +
      '<div style="display:flex;flex-wrap:wrap;gap:.5rem">' +
      (loc.features || []).map(function (f) {
        return '<span style="padding:4px 10px;background:rgba(255,117,24,.2);border:1px solid rgba(255,117,24,.4);border-radius:4px;font-size:.85rem">' + f + "</span>";
      }).join("") + "</div>";
    ui.drawerEl.classList.add("cc-slide-panel-open");
    ui.drawerEl.scrollTop = 0;
  }

  // ── Hitbox editor ───────────────────────────────────────────────────────
  function createHitboxEditor(rootEl, ui) {
    var s = {
      editing:     false,
      active:      null,
      map:         null,
      bounds:      null,
      layerEl:     null,
      attached:    false,
      refreshView: null
    };

    function ensureLayer() {
      if (s.layerEl) return s.layerEl;
      s.layerEl           = document.createElement("div");
      s.layerEl.className = "cc-hitbox-editor-layer";
      s.layerEl.id        = "cc-hitbox-editor";
      ui.lensMapEl.appendChild(s.layerEl);
      return s.layerEl;
    }

    function latLngToPx(lat, lng) {
      var pt = s.map.latLngToContainerPoint(window.L.latLng(lat, lng));
      return { x: pt.x, y: pt.y };
    }

    function draw() {
      if (!s.editing || !s.map) return;
      var layer = ensureLayer();
      layer.innerHTML = "";

      Object.keys(HITBOXES).sort().forEach(function (id) {
        var b = HITBOXES[id];
        if (!b) return;
        var p1   = latLngToPx(b[0], b[1]);
        var p2   = latLngToPx(b[2], b[3]);
        var left = Math.min(p1.x, p2.x);
        var top  = Math.min(p1.y, p2.y);
        var w    = Math.abs(p2.x - p1.x);
        var h    = Math.abs(p2.y - p1.y);

        var box       = document.createElement("div");
        box.className = "cc-hb-box";
        box.dataset.id = id;
        box.style.cssText = "left:" + left + "px;top:" + top + "px;width:" + w + "px;height:" + h + "px;";

        var lbl       = document.createElement("div");
        lbl.className = "cc-hb-label";
        lbl.textContent = id;
        box.appendChild(lbl);

        var handle       = document.createElement("div");
        handle.className = "cc-hb-handle";
        box.appendChild(handle);

        layer.appendChild(box);
      });

      ui.editorBadgeEl.style.display = "block";
    }

    function updateFromBox(box) {
      var left = parseFloat(box.style.left);
      var top  = parseFloat(box.style.top);
      var bw   = parseFloat(box.style.width);
      var bh   = parseFloat(box.style.height);
      var p1   = s.map.containerPointToLatLng(window.L.point(left,      top     ));
      var p2   = s.map.containerPointToLatLng(window.L.point(left + bw, top + bh));
      HITBOXES[box.dataset.id] = [
        Math.round(Math.min(p1.lat, p2.lat)),
        Math.round(Math.min(p1.lng, p2.lng)),
        Math.round(Math.max(p1.lat, p2.lat)),
        Math.round(Math.max(p1.lng, p2.lng))
      ];
    }

    function attachPointerHandlers() {
      if (s.attached) return;
      s.attached = true;

      var layer = ensureLayer();

      layer.addEventListener("pointerdown", function (e) {
        // Always prevent default on the editor layer — this stops the browser
        // from initiating a native image-drag ghost before we can handle it.
        e.preventDefault();

        if (!s.editing) return;
        var box = e.target.closest(".cc-hb-box");
        if (!box) return;

        s.active = {
          box:       box,
          mode:      e.target.classList.contains("cc-hb-handle") ? "resize" : "move",
          pointerId: e.pointerId,
          startX:    e.clientX, startY:  e.clientY,
          left:      parseFloat(box.style.left),   top:    parseFloat(box.style.top),
          width:     parseFloat(box.style.width),  height: parseFloat(box.style.height)
        };

        // Capture on the LAYER element so all subsequent pointer events for
        // this pointer are delivered here, even if the pointer leaves the box.
        // Capturing on `box` risks losing events to Leaflet's internal handlers.
        try { layer.setPointerCapture(e.pointerId); } catch (_) {}
        e.preventDefault();
        e.stopPropagation();
      });

      // pointermove on the layer (not window) — Leaflet calls
      // stopImmediatePropagation on window-level pointer events during its
      // internal drag handling, which silently kills window listeners.
      layer.addEventListener("pointermove", function (ev) {
        if (!s.active || ev.pointerId !== s.active.pointerId) return;
        var dx = ev.clientX - s.active.startX;
        var dy = ev.clientY - s.active.startY;
        if (s.active.mode === "move") {
          s.active.box.style.left = Math.round(s.active.left + dx) + "px";
          s.active.box.style.top  = Math.round(s.active.top  + dy) + "px";
        } else {
          s.active.box.style.width  = Math.max(8, Math.round(s.active.width  + dx)) + "px";
          s.active.box.style.height = Math.max(8, Math.round(s.active.height + dy)) + "px";
        }
        updateFromBox(s.active.box);
        ev.preventDefault();
      }, { passive: false });

      function endPointer(ev) {
        if (!s.active || ev.pointerId !== s.active.pointerId) return;
        s.active = null;
      }
      layer.addEventListener("pointerup",     endPointer);
      layer.addEventListener("pointercancel", endPointer);
    }

    function exportJSON() {
      var lines = Object.keys(HITBOXES).sort().map(function (k) {
        return '  "' + k + '": [' + HITBOXES[k].map(function (n) { return Math.round(n); }).join(", ") + "]";
      });
      window.prompt("Copy HITBOXES:", "var HITBOXES = {\n" + lines.join(",\n") + "\n};");
    }

    function setEditing(on) {
      s.editing = on;
      rootEl.classList.toggle("cc-hitbox-edit", on);
      if (!s.map || !s.bounds) return;

      if (!on) {
        if (s.layerEl) s.layerEl.style.display = "none";
        ui.editorBadgeEl.style.display = "none";
        s.map.off("move zoom resize", draw);
        if (typeof s.refreshView === "function") {
          // Give CSS a frame to revert the lens layout before re-applying view
          nextFrame().then(function () { s.refreshView(); });
        }
        return;
      }

      // CSS transition expands the lens to full-screen; wait for it to finish
      // before calling invalidateSize + fitBounds, otherwise Leaflet measures
      // the OLD (small) size and renders tiles at the wrong scale.
      delay(150).then(function () {
        s.map.invalidateSize({ animate: false });
        s.map.fitBounds(s.bounds, { animate: false, padding: [24, 24] });
        ensureLayer().style.display = "block";
        draw();
        s.map.on("move zoom resize", draw);
      });
    }

    return {
      attach: function (map, bounds, refreshViewFn) {
        s.map = map; s.bounds = bounds; s.refreshView = refreshViewFn || null;
        attachPointerHandlers();
      },
      toggle:     function ()  { setEditing(!s.editing); },
      exportJSON: exportJSON,
      isEditing:  function ()  { return s.editing; },
      redraw:     draw
    };
  }

  // ── Momentum physics ────────────────────────────────────────────────────
  var MOMENTUM_FRICTION = 3.0;   // higher = stops faster; 3 = heavy and satisfying

  function makeMomentum() {
    var val = 0.5, vel = 0, rafId = null, lastT = 0, cb = null;

    function tick(now) {
      var dt = Math.min((now - lastT) * 0.001, 0.05);
      lastT  = now;
      vel   *= Math.exp(-MOMENTUM_FRICTION * dt);
      val    = clamp(val + vel * dt, 0, 1);
      if (cb) cb(val);
      if (Math.abs(vel) > 0.003) {
        rafId = requestAnimationFrame(tick);
      } else {
        rafId = null; vel = 0;
      }
    }

    return {
      set: function (v) {
        val = clamp(v, 0, 1);
        if (rafId) { cancelAnimationFrame(rafId); rafId = null; }
        vel = 0;
      },
      fling: function (v, velocity, callback) {
        val = clamp(v, 0, 1); vel = velocity; cb = callback; lastT = performance.now();
        if (rafId) cancelAnimationFrame(rafId);
        if (Math.abs(vel) > 0.003) rafId = requestAnimationFrame(tick);
      },
      stop:  function () { if (rafId) cancelAnimationFrame(rafId); rafId = null; vel = 0; },
      value: function () { return val; }
    };
  }

  // ── Mount ───────────────────────────────────────────────────────────────
  function mount(rootEl, userOpts) {
    var opts = Object.assign({}, DEFAULTS, userOpts || {});

    rootEl.innerHTML = "";
    rootEl.classList.remove("cc-ready");
    rootEl.classList.add("cc-loading", "cc-canyon-map");

    // ── Inline base styles ────────────────────────────────────────────────
    // Injected once globally — safe to re-mount multiple times.
    if (!document.getElementById("cc-cm-base-styles")) {
      var baseStyle = document.createElement("style");
      baseStyle.id  = "cc-cm-base-styles";
      baseStyle.textContent =
        // Kill Leaflet's grey/white container glow
        "#cc-bg-map.leaflet-container," +
        "#cc-lens-map.leaflet-container{background:#0d0b0a!important;box-shadow:none!important;}" +
        // Prevent native browser image-drag ghost from any img inside the map
        ".cc-cm-mapwrap img{-webkit-user-drag:none!important;user-drag:none!important;" +
        "user-select:none!important;-webkit-user-select:none!important;pointer-events:none!important;}" +
        // img inside knob should be non-interactive so clicks hit the parent div
        ".cc-scroll-knob-img{transition:filter .15s ease,transform .15s ease!important;pointer-events:none!important;}" +
        // Knob grabbed: orange glow + grow
        ".cc-scroll-knob.is-active .cc-scroll-knob-img{" +
        "filter:drop-shadow(0 4px 10px rgba(0,0,0,.7)) drop-shadow(0 0 20px rgba(255,117,24,.9))!important;" +
        "transform:scale(1.22)!important;" +
        "}";
      document.head.appendChild(baseStyle);
    }

    // knobStyleEl is a dynamic <style> tag used to override !important knob
    // position rules from the app CSS.  It MUST be the last style tag in
    // <head> — later stylesheets beat earlier ones at equal specificity.
    // We create it here but re-append it AFTER CSS loads (see ensureDeps chain).
    var knobStyleEl = document.getElementById("cc-knob-dyn");
    if (!knobStyleEl) {
      knobStyleEl    = document.createElement("style");
      knobStyleEl.id = "cc-knob-dyn";
      document.head.appendChild(knobStyleEl);
    }

    // ── Build DOM ─────────────────────────────────────────────────────────
    var shell = el("div", { class: "cc-cm-shell" });

    var header = el("div", { class: "cc-cm-header cc-app-header" }, [
      el("div", { class: "cc-cm-title" }, [opts.title]),
      el("div", { class: "cc-cm-actions" }, [
        el("button", { class: "cc-btn", id: "cc-cm-reload", type: "button" }, ["Reload"]),
        el("button", { class: "cc-btn", id: "cc-cm-fit",    type: "button" }, ["Fit"]),
        el("button", { class: "cc-btn", id: "cc-cm-edit",   type: "button" }, ["Edit Hitboxes"]),
        el("button", { class: "cc-btn", id: "cc-cm-export", type: "button" }, ["Export"])
      ])
    ]);

    var mapEl     = el("div", { id: "cc-bg-map",   class: "cc-cm-map"   });
    var lensMapEl = el("div", { id: "cc-lens-map", class: "cc-lens-map" });

    var lensEl = el("div", { class: "cc-lens" }, [
      el("div", { class: "cc-lens-inner" }, [
        el("div", { class: "cc-lens-overscan" }, [lensMapEl])
      ]),
      el("div", { class: "cc-lens-chromatic" }),
      el("div", { class: "cc-lens-glare"     })
    ]);

    var frameOverlay = el("div", { class: "cc-frame-overlay" }, [
      el("img", { class: "cc-frame-image", src: opts.frameUrl, alt: "", draggable: "false" })
    ]);

    var knobV  = el("div", { class: "cc-scroll-knob", id: "cc-scroll-knob-v" }, [
      el("img", { class: "cc-scroll-knob-img", src: opts.knobUrl, alt: "", draggable: "false" })
    ]);
    var knobH  = el("div", { class: "cc-scroll-knob", id: "cc-scroll-knob-h" }, [
      el("img", { class: "cc-scroll-knob-img", src: opts.knobUrl, alt: "", draggable: "false" })
    ]);
    var trackV = el("div", { class: "cc-scroll-vertical",   id: "cc-scroll-track-v" }, [knobV]);
    var trackH = el("div", { class: "cc-scroll-horizontal", id: "cc-scroll-track-h" }, [knobH]);

    var loaderEl = el("div", { class: "cc-cm-loader", id: "cc-map-loader" }, [
      el("img", { src: opts.logoUrl, alt: "Coffin Canyon", draggable: "false" }),
      el("div", { class: "cc-cm-loader-spin" }),
      el("div", { style: "color:#ff7518;font-size:.8rem;letter-spacing:.2em;text-transform:uppercase" }, ["Loading"])
    ]);

    var editorBadgeEl = el("div", { class: "cc-hitbox-editor-badge", style: "display:none" }, [
      "Hitbox edit mode — drag cyan boxes, resize via handle, then Export."
    ]);

    var mapWrap = el("div", { class: "cc-cm-mapwrap" }, [
      mapEl, lensEl, frameOverlay, trackV, trackH, loaderEl, editorBadgeEl
    ]);

    // Drawer: position:fixed so it escapes the map clip.
    // Appended directly to <body> so no parent transform can trap it.
    var drawer = el("div", { class: "cc-slide-panel", id: "cc-location-panel" }, [
      el("div", { class: "cc-slide-panel-header" }, [
        el("h2",     { class: "cc-panel-title cc-cm-drawer-title"   }, ["Location"]),
        el("button", { class: "cc-panel-close-btn", id: "close-dr", type: "button" }, ["×"])
      ]),
      el("div", { class: "cc-panel-body cc-cm-drawer-content" })
    ]);

    shell.appendChild(header);
    shell.appendChild(mapWrap);
    rootEl.appendChild(shell);
    // Append drawer to body so position:fixed always works regardless of
    // any parent transform/isolation/overflow on the Odoo host.
    document.body.appendChild(drawer);

    var ui = {
      mapEl:          mapEl,
      lensMapEl:      lensMapEl,
      lensEl:         lensEl,
      mapWrap:        mapWrap,
      frameEl:        frameOverlay,
      drawerEl:       drawer,
      drawerTitleEl:  drawer.querySelector(".cc-cm-drawer-title"),
      drawerContentEl:drawer.querySelector(".cc-panel-body"),
      knobV:          knobV,
      knobH:          knobH,
      editorBadgeEl:  editorBadgeEl
    };

    // ── App state ─────────────────────────────────────────────────────────
    var bgMap        = null;
    var lensMap      = null;
    var mapDoc       = null;
    var locationsDoc = null;
    var editor       = null;
    var hitboxLayers = [];
    var knobsBound   = false;
    var px           = null;    // { w, h } from JSON
    var bounds       = null;    // [[0,0],[h,w]]
    var bgZoom       = -1;      // computed after layout
    var lensZoom     = 0;       // computed after layout
    var currentT     = 0.5;
    var currentTx    = 0.5;

    var momV = makeMomentum();
    var momH = makeMomentum();

    // ── Responsive scale ──────────────────────────────────────────────────
    function updateResponsiveScale() {
      var dw    = 1280;
      var cw    = mapWrap.getBoundingClientRect().width || mapWrap.offsetWidth || dw;
      var scale = Math.max(0.56, Math.min(1, cw / dw));
      rootEl.style.setProperty("--device-scale", scale.toFixed(4));
    }

    function showLoader() { loaderEl.style.display = "flex"; loaderEl.style.opacity = "1"; }
    function hideLoader() {
      loaderEl.style.opacity = "0";
      setTimeout(function () {
        loaderEl.style.display = "none";
        rootEl.classList.remove("cc-loading");
        rootEl.classList.add("cc-ready");
      }, 320);
    }

    function lockMaps() {
      [bgMap, lensMap].forEach(function (m) {
        if (!m) return;
        m.dragging.disable();
        m.doubleClickZoom.disable();
        m.scrollWheelZoom.disable();
        m.touchZoom.disable();
        m.boxZoom.disable();
        m.keyboard.disable();
        if (m.tap) m.tap.disable();
      });
    }

    // ── applyView ─────────────────────────────────────────────────────────
    //
    //  t  = vertical   0–1   (0 = image top,  1 = image bottom)
    //  tx = horizontal 0–1   (0 = image left, 1 = image right)
    //
    //  safeRange() computes each map's pannable coordinate range given its
    //  zoom + container size.  Both maps interpolate across their own range
    //  using the same t-values, so they reach their image edge simultaneously.
    //
    //  knobStyleEl is always re-appended to <head> here, guaranteeing it is
    //  the last style sheet and therefore beats all !important declarations.
    //
    function applyView(t, tx) {
      if (!bgMap || !lensMap || !px) return;

      currentT  = clamp(typeof t  === "number" ? t  : currentT,  0, 1);
      currentTx = clamp(typeof tx === "number" ? tx : currentTx, 0, 1);

      var bgRy = safeRange(ui.mapEl,     bgZoom,   px.h, false);
      var bgRx = safeRange(ui.mapEl,     bgZoom,   px.w, true);
      var lnRy = safeRange(ui.lensMapEl, lensZoom, px.h, false);
      var lnRx = safeRange(ui.lensMapEl, lensZoom, px.w, true);

      bgMap.setView([
        bgRy.min + currentT  * (bgRy.max - bgRy.min),
        bgRx.min + currentTx * (bgRx.max - bgRx.min)
      ], bgZoom,   { animate: false });

      lensMap.setView([
        lnRy.min + currentT  * (lnRy.max - lnRy.min),
        lnRx.min + currentTx * (lnRx.max - lnRx.min)
      ], lensZoom, { animate: false });

      // Re-append knobStyleEl to <head> so it is ALWAYS the last style tag.
      // This is the only reliable way to override external !important rules —
      // a later stylesheet wins over earlier ones at identical specificity.
      document.head.appendChild(knobStyleEl);

      var vPct = (V_MIN + currentT  * (V_MAX - V_MIN)).toFixed(3);
      var hPct = (H_MIN + currentTx * (H_MAX - H_MIN)).toFixed(3);
      knobStyleEl.textContent =
        // Position rules (override the static 50% defaults)
        "#cc-scroll-knob-v{top:"  + vPct + "%!important;}" +
        "#cc-scroll-knob-h{left:" + hPct + "%!important;}" +
        // pointer-events and z-index here so they are ALWAYS last in <head>
        // and beat the app CSS !important rules regardless of load order.
        ".cc-scroll-vertical,.cc-scroll-horizontal{pointer-events:auto!important;z-index:600!important;}" +
        ".cc-scroll-knob{pointer-events:auto!important;z-index:601!important;touch-action:none!important;}";
    }

    // ── Knob drag with momentum ───────────────────────────────────────────
    function bindKnob(knobEl, axis) {
      // Track which pointer is currently driving this knob.
      // Prevents a second finger from hijacking or double-highlighting it.
      var activePointerId = null;

      knobEl.addEventListener("pointerdown", function (e) {
        if (editor && editor.isEditing()) return;
        // Ignore secondary fingers if already dragging
        if (activePointerId !== null) return;

        e.preventDefault();

        activePointerId = e.pointerId;
        var mom = axis === "v" ? momV : momH;
        mom.stop();

        var trackRect = knobEl.parentElement.getBoundingClientRect();

        knobEl.classList.add("is-active");

        // Pointer capture routes all subsequent events for this pointer to
        // knobEl — reliable even inside Odoo's iframe.
        knobEl.setPointerCapture(e.pointerId);

        var history = [];

        // No grabOffset: the knob centre snaps directly to the pointer
        // position so the knob never appears to "jump" sideways on grab.
        function getN(ev) {
          var size = axis === "v" ? trackRect.height : trackRect.width;
          var pos  = axis === "v"
            ? (ev.clientY - trackRect.top)
            : (ev.clientX - trackRect.left);
          var pct = (pos / size) * 100;
          var min = axis === "v" ? V_MIN : H_MIN;
          var max = axis === "v" ? V_MAX : H_MAX;
          return clamp((pct - min) / (max - min), 0, 1);
        }

        function onMove(ev) {
          if (ev.pointerId !== activePointerId) return;
          var n   = getN(ev);
          var now = performance.now();
          history.push({ v: n, t: now });
          if (history.length > 8) history.shift();
          mom.set(n);
          if (axis === "v") applyView(n,        currentTx);
          else              applyView(currentT, n);
          ev.preventDefault();
        }

        function onEnd(ev) {
          if (ev.pointerId !== activePointerId) return;
          finish();
        }

        function finish() {
          activePointerId = null;
          knobEl.classList.remove("is-active");
          knobEl.removeEventListener("pointermove",      onMove);
          knobEl.removeEventListener("pointerup",        onEnd);
          knobEl.removeEventListener("pointercancel",    onEnd);
          knobEl.removeEventListener("lostpointercapture", onEnd);

          // Clamp fling velocity so a brief accidental flick doesn't
          // send the knob flying.  Max 3 normalised-units/second.
          var vel = 0;
          if (history.length >= 2) {
            var span = history[history.length - 1].t - history[0].t;
            var dist = history[history.length - 1].v - history[0].v;
            if (span > 8) vel = clamp(dist / (span * 0.001), -3, 3);
          }

          var lastVal = history.length
            ? history[history.length - 1].v
            : (axis === "v" ? currentT : currentTx);

          mom.fling(lastVal, vel, function (v) {
            if (axis === "v") applyView(v, currentTx);
            else              applyView(currentT, v);
          });
        }

        knobEl.addEventListener("pointermove",        onMove, { passive: false });
        knobEl.addEventListener("pointerup",          onEnd);
        knobEl.addEventListener("pointercancel",      onEnd);
        // lostpointercapture fires when the OS steals capture (e.g. phone
        // call, notification) — guarantees the knob is always de-activated.
        knobEl.addEventListener("lostpointercapture", onEnd);
      }, { passive: false });
    }

    function bindKnobs() {
      if (knobsBound) return;
      knobsBound = true;
      bindKnob(ui.knobV, "v");
      bindKnob(ui.knobH, "h");
    }

    // ── Hitbox rectangles ─────────────────────────────────────────────────
    function clearHitboxes() {
      hitboxLayers.forEach(function (l) { try { l.remove(); } catch (_) {} });
      hitboxLayers = [];
    }

    function buildHitboxes() {
      clearHitboxes();
      if (!locationsDoc || !locationsDoc.locations || !lensMap) return;

      locationsDoc.locations.forEach(function (loc) {
        var b = HITBOXES[loc.id];
        if (!b) return;

        var rect = window.L.rectangle(
          [[b[0], b[1]], [b[2], b[3]]],
          { color: "#ff7518", weight: 2, fillOpacity: 0.10,
            interactive: true, bubblingMouseEvents: false }
        ).addTo(lensMap);

        rect.bindTooltip(loc.name || loc.id, {
          permanent: true, direction: "center",
          className: "cc-map-hitbox-label", opacity: 0.95
        });

        // Native DOM pointerdown on the Leaflet SVG path element.
        // This bypasses Leaflet's own click/drag-end event dispatch, which
        // would silently swallow the event if a drag had just ended.
        // We capture the loc variable via closure so each listener opens the
        // correct location regardless of iteration order.
        (function (capturedLoc) {
          var domEl = rect.getElement();
          if (domEl) {
            domEl.addEventListener("pointerdown", function (e) {
              if (editor && editor.isEditing()) return;
              e.stopPropagation();
              renderDrawer(ui, capturedLoc);
            });
          }
        }(loc));

        hitboxLayers.push(rect);
      });
    }

    // ── Init / load ───────────────────────────────────────────────────────
    function init() {
      showLoader();
      updateResponsiveScale();
      var loadStart = Date.now();

      return ensureDeps(opts)
        .then(function () {
          // ── KNOB STYLE FIX ─────────────────────────────────────────────
          // CSS files have just been appended to <head>.  Re-append
          // knobStyleEl now so it is the LAST style tag, guaranteeing its
          // !important declarations beat those in the external stylesheets.
          document.head.appendChild(knobStyleEl);

          return Promise.all([
            fetchJson(opts.mapUrl),
            fetchJson(opts.locationsUrl)
          ]);
        })
        .then(function (results) {
          mapDoc       = results[0];
          locationsDoc = results[1];
          px           = mapDoc.map.background.image_pixel_size;
          bounds       = [[0, 0], [px.h, px.w]];

          try { if (bgMap)   bgMap.remove();   } catch (_) {}
          try { if (lensMap) lensMap.remove(); } catch (_) {}

          bgMap = window.L.map(ui.mapEl, {
            crs: window.L.CRS.Simple,
            minZoom: -5, maxZoom: 2,
            zoomSnap: 0, zoomDelta: 0.25,
            zoomControl: false, attributionControl: false
          });
          window.L.imageOverlay(mapDoc.map.background.image_key, bounds).addTo(bgMap);

          var lensUrl = (mapDoc.map.lens && mapDoc.map.lens.image_key)
            ? mapDoc.map.lens.image_key
            : mapDoc.map.background.image_key;

          lensMap = window.L.map(ui.lensMapEl, {
            crs: window.L.CRS.Simple,
            minZoom: -5, maxZoom: 4,
            zoomSnap: 0, zoomDelta: 0.25,
            zoomControl: false, attributionControl: false
          });
          window.L.imageOverlay(lensUrl, bounds).addTo(lensMap);

          // Hide until applyView fires — prevents the Leaflet "jump" where
          // the map briefly renders at the wrong position before CSS settles.
          // Frame is hidden too so it doesn't pop in before the map is ready.
          ui.mapEl.style.visibility     = "hidden";
          ui.lensMapEl.style.visibility = "hidden";
          ui.frameEl.style.visibility   = "hidden";

          lockMaps();
          buildHitboxes();

          editor = createHitboxEditor(rootEl, ui);
          editor.attach(lensMap, bounds, function () {
            lensMap.invalidateSize({ animate: false });
            bgMap.invalidateSize({ animate: false });
            applyView(currentT, currentTx);
            if (editor) editor.redraw();
          });

          bindKnobs();

          // Two frames: let CSS apply and containers reach their final sizes
          return nextFrame().then(nextFrame);
        })
        .then(function () {
          bgMap.invalidateSize({ animate: false });
          lensMap.invalidateSize({ animate: false });

          // ── DYNAMIC ZOOM ───────────────────────────────────────────────
          // Compute the zoom that makes the image FILL the BG container.
          // BG gets a small negative offset to show slightly more of the map.
          // Lens gets a large positive offset for a nice zoomed-in detail view.
          var fillZoom = computeFillZoom(ui.mapEl, px.w, px.h);
          bgZoom   = fillZoom + BG_ZOOM_OFFSET;
          lensZoom = fillZoom + BG_ZOOM_OFFSET + LENS_ZOOM_EXTRA;

          return nextFrame();
        })
        .then(function () {
          applyView(0.5, 0.5);
          // Reveal now that Leaflet has positioned correctly — no jump visible.
          ui.mapEl.style.visibility     = "";
          ui.lensMapEl.style.visibility = "";
          ui.frameEl.style.visibility   = "";
          return delay(Math.max(0, MIN_LOADER_MS - (Date.now() - loadStart)));
        })
        .then(function () {
          hideLoader();
        })
        .catch(function (err) {
          hideLoader();
          ui.drawerTitleEl.textContent  = "Load failed";
          ui.drawerContentEl.innerHTML  =
            '<div style="color:#f55;padding:1rem">Load failed: ' +
            (err && err.message ? err.message : String(err)) + "</div>";
          ui.drawerEl.classList.add("cc-slide-panel-open");
          console.error("Canyon Map init error:", err);
        });
    }

    // ── Resize ────────────────────────────────────────────────────────────
    var onResize = rafThrottle(function () {
      updateResponsiveScale();
      if (bgMap)   bgMap.invalidateSize({ animate: false });
      if (lensMap) lensMap.invalidateSize({ animate: false });
      if (!px) return;
      // Recompute fill zoom on resize — container dimensions changed
      var fillZoom = computeFillZoom(ui.mapEl, px.w, px.h);
      bgZoom   = fillZoom + BG_ZOOM_OFFSET;
      lensZoom = fillZoom + BG_ZOOM_OFFSET + LENS_ZOOM_EXTRA;
      if (editor && editor.isEditing()) {
        lensMap.fitBounds(bounds, { animate: false, padding: [24, 24] });
        editor.redraw();
      } else {
        applyView(currentT, currentTx);
      }
    });
    window.addEventListener("resize", onResize);

    // ── Button wiring ─────────────────────────────────────────────────────
    header.querySelector("#cc-cm-reload").onclick = function () {
      // Stop any coasting momentum and reset position back to centre
      momV.stop(); momH.stop();
      currentT = 0.5; currentTx = 0.5;
      init();
    };
    header.querySelector("#cc-cm-fit"   ).onclick = function () { if (px) applyView(0.5, 0.5); };
    header.querySelector("#cc-cm-edit"  ).onclick = function () { if (editor) editor.toggle(); };
    header.querySelector("#cc-cm-export").onclick = function () { if (editor) editor.exportJSON(); };
    drawer.querySelector("#close-dr"    ).onclick = function () { ui.drawerEl.classList.remove("cc-slide-panel-open"); };

    // Close drawer when clicking outside it
    document.addEventListener("click", function (e) {
      if (!ui.drawerEl.classList.contains("cc-slide-panel-open")) return;
      if (ui.drawerEl.contains(e.target)) return;
      if (e.target && (e.target.closest(".leaflet-interactive") || e.target.closest(".leaflet-tooltip"))) return;
      ui.drawerEl.classList.remove("cc-slide-panel-open");
    });

    // ── Destroy ───────────────────────────────────────────────────────────
    _destroyFn = function () {
      window.removeEventListener("resize", onResize);
      momV.stop();
      momH.stop();
      try { if (bgMap)   bgMap.remove();   } catch (_) {}
      try { if (lensMap) lensMap.remove(); } catch (_) {}
      bgMap = null; lensMap = null;
      // Remove the drawer from body on destroy
      try { if (drawer.parentNode) drawer.parentNode.removeChild(drawer); } catch (_) {}
    };

    return init().then(function () { return {}; });
  }

  // ── Standard CC_APP interface ───────────────────────────────────────────
  window.CC_APP = {
    init: function (options) {
      console.log("🗺️ Canyon Map init");
      mount(options.root, {});
    },
    destroy: function () {
      if (typeof _destroyFn === "function") { _destroyFn(); _destroyFn = null; }
    }
  };

  window.CC_CanyonMap = { mount: mount };
  console.log("🗺️ Canyon Map app loaded");

})();
