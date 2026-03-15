/* File: apps/app_canyon_map/cc_app_canyon_map.js
   Coffin Canyon — Canyon Map
   Loaded by cc_loader_core.js — exposes window.CC_APP.init()

   ══════════════════════════════════════════════════════════════════
   QUICK-TUNE GUIDE — things you can safely change without breaking
   anything. Search for "── TUNE:" to jump to each one.

   1.  BG_ZOOM_OFFSET     — how far the background map zooms out
   2.  LENS_ZOOM_EXTRA    — how zoomed-in the lens detail view is
   3.  MIN_LOADER_MS      — minimum milliseconds the loader is shown
   4.  V_MIN / V_MAX      — vertical knob travel range (%)
   5.  H_MIN / H_MAX      — horizontal knob travel range (%)
   6.  MOMENTUM_FRICTION  — how quickly the knobs coast to a stop
   7.  HITBOXES           — pixel bounding boxes for each location
   8.  DEFAULTS.title     — the header title text
   9.  Label tab colours  — orange background + dark brown text
   10. Lens window size   — 80% of design base (816×496px)
   11. Sidebar label offset — pushes tooltip tab flush to box top
   ══════════════════════════════════════════════════════════════════
*/

(function () {

  // ── TUNE 1 & 2: Zoom levels ─────────────────────────────────────────────
  //
  //  The app measures the actual BG container size and finds the "fill zoom"
  //  — the Leaflet zoom where the image exactly covers the container.
  //  These offsets are then applied on top of that baseline.
  //
  //  BG_ZOOM_OFFSET:   negative = more zoomed OUT (shows more of the full map)
  //                    positive = more zoomed IN  (image larger than container)
  //
  //  LENS_ZOOM_EXTRA:  how many extra zoom levels the lens adds on top of BG.
  //                    Higher = more detail in the magnifier.
  //                    Lower  = lens looks more like the BG (less magnification).
  //
  var BG_ZOOM_OFFSET  = -0.2;  // ── TUNE 1: BG overview zoom (-0.5 = very zoomed out, 0 = fill)
  var LENS_ZOOM_EXTRA =  1.9;  // ── TUNE 2: Lens detail zoom offset (1.0 = mild, 3.0 = strong)

  var MIN_LOADER_MS = 700;     // ── TUNE 3: Loader minimum display time in milliseconds

  // ── TUNE 4 & 5: Knob travel limits ─────────────────────────────────────
  //
  //  These are percentages within the knob's track div.
  //  0 = track start, 100 = track end.
  //  Tighten the range to keep knobs away from track edges.
  //
  var V_MIN = 8;   // ── TUNE 4a: Vertical knob — top limit (%)
  var V_MAX = 92;  // ── TUNE 4b: Vertical knob — bottom limit (%)
  var H_MIN = 1;   // ── TUNE 5a: Horizontal knob — left limit (%)
  var H_MAX = 94;  // ── TUNE 5b: Horizontal knob — right limit (%)

  // ── TUNE 7: Location hitboxes ───────────────────────────────────────────
  //
  //  Each entry maps a location ID to its bounding box on the map image.
  //  Format: [y1, x1, y2, x2]  (top-left corner → bottom-right corner)
  //  Units:  image pixels in CRS.Simple coordinate space.
  //
  //  To adjust a box: use the "Edit Hitboxes" button in the app header,
  //  drag/resize the cyan overlays, then click Export to get new values.
  //
  var HITBOXES = {
  "bandit-buck": [1550, 956, 1668, 1160],
  "bayou-city": [1175, 2501, 1386, 2767],
  "camp-coffin": [2727, 2051, 2822, 2142],
  "cowtown": [2172, 2112, 2332, 2396],
  "crackpits": [2628, 1628, 2816, 1968],
  "deerhoof": [3112, 2130, 3329, 2412],
  "diablo": [505, 1432, 716, 1698],
  "dustbuck": [1986, 2286, 2156, 2522],
  "fool-boot": [2408, 1132, 2512, 1224],
  "fort-plunder": [3348, 1209, 3631, 1427],
  "fortune": [2887, 1284, 3121, 1567],
  "ghost-mountain": [2597, 205, 2849, 489],
  "gore-mule-drop": [2872, 1600, 3092, 2076],
  "grade-grind": [2486, 1432, 2598, 1548],
  "heckweed": [2312, 1824, 2440, 1944],
  "huck": [3332, 2569, 3550, 2749],
  "kraise": [1995, 1270, 2193, 1527],
  "little-rica": [2964, 500, 3182, 784],
  "lost-yots": [1576, 1266, 1958, 1586],
  "martygrail": [2392, 1620, 2520, 1748],
  "mindshaft": [3112, 804, 3388, 1164],
  "pallor": [1616, 1824, 1996, 1924],
  "plata": [2513, 916, 2765, 1089],
  "quinne-jimmy": [1694, 801, 1852, 1157],
  "ratsville": [1452, 1968, 1644, 2194],
  "rey": [34, 1899, 163, 2028],
  "river-city": [1102, 1607, 1280, 1854],
  "sangr": [1086, 1219, 1257, 1527],
  "santos-grin": [1185, 1898, 1396, 2176],
  "silverpit": [2128, 1548, 2294, 1762],
  "skull-water": [1609, 492, 1841, 701],
  "splitglass-arroyo": [2605, 1138, 2859, 1427],
  "tin-flats": [1374, 1258, 1512, 1608],
  "tzulto": [2229, 1334, 2447, 1526],
  "widowflow": [1316, 1630, 2078, 1798],
  "witches-roost": [3767, 2130, 3965, 2495],
  "yults-arch": [934, 1504, 1026, 1592],
  "needlewood":  [600, 2200, 780, 2500],
  "hoodoo-maze":  [1800, 600, 1980, 820]
};

  window.CC_HITBOXES = HITBOXES;

  // ── Asset URLs and app settings ─────────────────────────────────────────
  var DEFAULTS = {
    title:         "Coffin Canyon — Canyon Map",  // ── TUNE 8: Header title text
    mapUrl:        "https://raw.githubusercontent.com/steamcrow/coffin/main/apps/app_canyon_map/data/canyon_map.json",
    locationsUrl:  "https://raw.githubusercontent.com/steamcrow/coffin/main/data/src/170_named_locations.json",
    uiCssUrl:      "https://raw.githubusercontent.com/steamcrow/coffin/main/ui/cc_ui.css",
    appCssUrl:     "https://raw.githubusercontent.com/steamcrow/coffin/main/apps/app_canyon_map/cc_canyon_map.css",
    leafletCssUrl: "https://raw.githubusercontent.com/steamcrow/coffin/main/vendor/leaflet/leaflet.css",
    leafletJsUrl:  "https://raw.githubusercontent.com/steamcrow/coffin/main/vendor/leaflet/leaflet.js",
    logoUrl:       "https://raw.githubusercontent.com/steamcrow/coffin/main/assets/logos/coffin_canyon_logo.png",
    frameUrl:      "https://raw.githubusercontent.com/steamcrow/coffin/main/apps/app_canyon_map/data/mag_frame4.png",
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
    p = p.then(function () { return loadCssOnce(opts.uiCssUrl,      "cc_ui_css");   });
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

  function tag(text) {
    return '<span style="display:inline-block;padding:2px 8px;margin:2px 2px 2px 0;' +
      'background:rgba(212,130,42,.15);border:1px solid rgba(212,130,42,.4);' +
      'border-radius:3px;font-size:11px;color:#e8d9c4;">' + text + "</span>";
  }

  function section(label, content) {
    return '<div class="cc-block" style="margin-bottom:1rem;">' +
      '<div class="cc-h" style="font-size:9px;font-weight:700;text-transform:uppercase;' +
      'letter-spacing:.1em;color:#d4822a;margin-bottom:6px;">' + label + "</div>" +
      content + "</div>";
  }

  function renderDrawer(ui, loc) {
    var state     = loc.state ? loc.state.charAt(0).toUpperCase() + loc.state.slice(1) : null;
    var archetype = loc.archetype
      ? loc.archetype.replace(/_/g, " ").replace(/\b\w/g, function(c){ return c.toUpperCase(); })
      : null;

    // ── Header — no emoji ────────────────────────────────────────────────────
    ui.drawerTitleEl.textContent = loc.name || loc.id || "Location";

    var html = "";

    // Meta row: archetype + state
    var metaParts = [];
    if (archetype) metaParts.push(archetype);
    if (state)     metaParts.push("State: " + state);
    if (metaParts.length) {
      html += '<div style="font-size:10px;color:#9e8e78;margin-bottom:12px;' +
        'letter-spacing:.05em;">' + metaParts.join("  ·  ") + "</div>";
    }

    // Danger (red), Population (desaturated blue), Coffin Cough (green)
    html += section("Danger",     meterBar(loc.danger     || 0, 6, "#b03030"));
    html += section("Population", meterBar(loc.population || 0, 6, "#4a6e8a"));
    if (loc.coffinCoughChance != null) {
      html += section("Coffin Cough",
        meterBar(Math.round(loc.coffinCoughChance * 6), 6, "#3a7a4a"));
    }

    // Description
    if (loc.description) {
      html += section("Description",
        '<p style="margin:0;line-height:1.6;color:#e8d9c4;">' + loc.description + "</p>");
    }

    // Atmosphere
    var atmosphere = Array.isArray(loc.atmosphere)
      ? loc.atmosphere.join(" · ")
      : loc.atmosphere || null;
    if (atmosphere) {
      html += section("Atmosphere",
        '<p style="margin:0;font-style:italic;color:#9e8e78;">' + atmosphere + "</p>");
    }

    // Key resources
    var keyRes = loc.key_resources || [];
    if (keyRes.length) {
      html += section("Key Resources", keyRes.map(function(r){
        return tag(r.replace(/_/g," ").replace(/\b\w/g, function(c){ return c.toUpperCase(); }));
      }).join(""));
    }

    // Terrain flavour (Features omitted — redundant with Terrain)
    var terrain = loc.terrain_flavor || [];
    if (terrain.length) {
      html += section("Terrain", terrain.map(tag).join(""));
    }

    // Monster seeds
    var seeds = loc.monster_seeds || [];
    if (seeds.length) {
      var seedHtml = seeds.map(function(s){
        var name   = typeof s === "string" ? s : (s.name || "?");
        var weight = typeof s === "object" && s.weight != null ? " ×" + s.weight : "";
        return tag(name + weight);
      }).join("");
      html += section("Monster Pressure", seedHtml);
    }

    // One random rumor — pick fresh each time the drawer opens
    var rumors = loc.rumors || [];
    if (rumors.length) {
      var rumor = rumors[Math.floor(Math.random() * rumors.length)];
      html += section("Rumor",
        '<div style="padding:6px 0 6px 10px;border-left:2px solid rgba(212,130,42,.4);' +
        'color:#9e8e78;font-style:italic;font-size:12px;">' + rumor + "</div>");
    }

    // Notes
    var notes = loc.notes || [];
    if (notes.length) {
      html += section("Notes",
        '<p style="margin:0;font-size:11px;color:#6b5f4a;">' + notes.join(" ") + "</p>");
    }

    ui.drawerContentEl.innerHTML = html;
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
      refreshView: null,
      onEnter:     null
    };

    function ensureLayer() {
      if (s.layerEl) return s.layerEl;
      s.layerEl           = document.createElement("div");
      s.layerEl.className = "cc-hitbox-editor-layer";
      s.layerEl.id        = "cc-hitbox-editor";
      // MUST start hidden and pointer-events:none — otherwise this z-index:999
      // div sits invisibly over the entire lens and eats every click.
      s.layerEl.style.cssText = "position:absolute;inset:0;z-index:1000;display:none;pointer-events:none;";
      ui.lensMapEl.appendChild(s.layerEl);
      // Inject editor CSS inline so it works even if cc_canyon_map.css is missing/incomplete
      if (!document.getElementById("cc-hb-editor-styles")) {
        var _hbStyle = document.createElement("style");
        _hbStyle.id = "cc-hb-editor-styles";
        _hbStyle.textContent = [
          ".cc-hitbox-editor-layer{position:absolute;inset:0;z-index:1000;}",
          ".cc-hb-box{position:absolute;border:2px solid #00e5ff;box-sizing:border-box;cursor:move;}",
          ".cc-hb-box:hover{background:rgba(0,229,255,.15);}",
          ".cc-hb-label{position:absolute;top:-18px;left:0;background:#00e5ff;color:#000;font:700 9px/16px monospace;padding:0 5px;white-space:nowrap;pointer-events:none;}",
          ".cc-hb-handle{position:absolute;bottom:0;right:0;width:14px;height:14px;background:#00e5ff;cursor:se-resize;}",
          ".cc-hitbox-editor-badge{position:absolute;bottom:8px;left:50%;transform:translateX(-50%);background:rgba(0,0,0,.85);color:#00e5ff;font:700 10px/1 monospace;padding:6px 14px;border:1px solid #00e5ff;border-radius:4px;z-index:1001;pointer-events:none;white-space:nowrap;}"
        ].join("");
        document.head.appendChild(_hbStyle);
      }
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
        // Only intercept events when in edit mode — in normal mode this layer
        // must be display:none/pointer-events:none so it never blocks the map.
        if (!s.editing) return;
        e.preventDefault();
        e.stopPropagation();

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

        // Capture on layer so captured events route here first.
        // Belt-and-suspenders: we also listen on window below so we still
        // get events even if capture is silently dropped by the host.
        try { layer.setPointerCapture(e.pointerId); } catch (_) {}
        e.stopPropagation();
      });

      function onEditorMove(ev) {
        if (!s.active || ev.pointerId !== s.active.pointerId) return;
        ev.preventDefault();
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
      }

      function onEditorEnd(ev) {
        if (!s.active || ev.pointerId !== s.active.pointerId) return;
        s.active = null;
      }

      // Listen on both layer (for captured events) and window (fallback).
      layer.addEventListener("pointermove", onEditorMove, { passive: false });
      layer.addEventListener("pointerup",          onEditorEnd);
      layer.addEventListener("pointercancel",      onEditorEnd);
      layer.addEventListener("lostpointercapture", onEditorEnd);

      window.addEventListener("pointermove", onEditorMove, { passive: false });
      window.addEventListener("pointerup",          onEditorEnd);
      window.addEventListener("pointercancel",      onEditorEnd);
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
        if (s.layerEl) {
          s.layerEl.style.display       = "none";
          s.layerEl.style.pointerEvents = "none";
        }
        ui.editorBadgeEl.style.display = "none";
        s.map.off("move zoom resize", draw);
        if (typeof s.refreshView === "function") {
          nextFrame().then(function () { s.refreshView(); });
        }
        return;
      }

      if (typeof s.onEnter === "function") s.onEnter();
      delay(150).then(function () {
        s.map.invalidateSize({ animate: false });
        s.map.fitBounds(s.bounds, { animate: false, padding: [24, 24] });
        var layer = ensureLayer();
        // Ensure the Leaflet container has a positioning context for our absolute layer
        var lensContainer = ui.lensMapEl;
        if (lensContainer && window.getComputedStyle(lensContainer).position === "static") {
          lensContainer.style.position = "relative";
        }
        layer.style.cssText = "position:absolute;inset:0;z-index:1000;display:block;pointer-events:auto;";
        draw();
        s.map.on("move zoom resize", draw);
      });
    }

    return {
      attach: function (map, bounds, refreshViewFn, onEnterFn) {
        s.map = map; s.bounds = bounds;
        s.refreshView = refreshViewFn || null;
        s.onEnter     = onEnterFn     || null;
        attachPointerHandlers();
      },
      toggle:     function ()  { setEditing(!s.editing); },
      exportJSON: exportJSON,
      isEditing:  function ()  { return s.editing; },
      redraw:     draw,
      destroy:    function ()  {
        setEditing(false);
        if (s.layerEl && s.layerEl.parentNode) s.layerEl.parentNode.removeChild(s.layerEl);
        s.layerEl  = null;
        s.attached = false;
        s.active   = null;
      }
    };
  }

  // ── Momentum physics ────────────────────────────────────────────────────
  // ── TUNE 6: Knob momentum friction ─────────────────────────────────────
  //
  //  Controls how quickly the knobs decelerate after a fling gesture.
  //  Uses exponential decay: velocity *= e^(-FRICTION * deltaTime)
  //
  //  1.0 = very slow coast (icy)
  //  3.0 = satisfying heavy feel  ← current
  //  6.0 = stops almost instantly
  //
  var MOMENTUM_FRICTION = 3.0;

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

    // knobStyleEl is a dynamic <style> tag used to override !important knob
    // position rules from the app CSS.  It MUST be the last style tag in
    // <head> — later stylesheets beat earlier ones at equal specificity.
    // We create it here but re-append it AFTER CSS loads (see ensureDeps chain).
    var knobStyleEl = document.getElementById("cc-knob-dyn");
    if (!knobStyleEl) {
        knobStyleEl = document.createElement("style");
        knobStyleEl.id = "cc-knob-dyn";
        document.head.appendChild(knobStyleEl);
    }

    // ── Inline layout CSS — guarantees header is never covered by mapwrap ──
    if (!document.getElementById("cc-cm-layout-styles")) {
      var _layoutStyle = document.createElement("style");
      _layoutStyle.id = "cc-cm-layout-styles";
      _layoutStyle.textContent = [
        ".cc-canyon-map{display:flex;flex-direction:column;height:100%;}",
        ".cc-cm-shell{display:flex;flex-direction:column;height:100%;min-height:100vh;position:relative;}",
        ".cc-cm-header{flex-shrink:0;display:flex;align-items:center;justify-content:space-between;padding:8px 12px;background:#0a0a0a;border-bottom:1px solid #222;z-index:10;position:relative;pointer-events:auto!important;}",
        ".cc-cm-actions{display:flex;gap:6px;flex-wrap:wrap;}",
        ".cc-cm-mapwrap{flex:1;position:relative;overflow:hidden;min-height:0;}",
        ".cc-cm-map{position:absolute;inset:0;z-index:1;}",
        ".cc-lens{position:absolute;z-index:5;pointer-events:auto;}",
        ".cc-frame-overlay{position:absolute;inset:0;z-index:6;pointer-events:none;}",
        ".cc-scroll-vertical,.cc-scroll-horizontal{position:absolute;z-index:7;}",
        ".cc-cm-loader{position:absolute;inset:0;z-index:20;display:flex;flex-direction:column;align-items:center;justify-content:center;background:#0a0a0a;}",
        ".cc-hitbox-editor-badge{z-index:8;}"
      ].join("");
      document.head.appendChild(_layoutStyle);
    }

    // ── Build DOM ─────────────────────────────────────────────────────────
    var shell = el("div", { class: "cc-cm-shell" });

    var header = el("div", { class: "cc-cm-header cc-app-header" }, [
      el("div", { class: "cc-cm-title" }, [opts.title]),
      el("div", { class: "cc-cm-actions" }, [
        el("button", { class: "cc-btn", id: "cc-cm-reload", type: "button" }, ["Reload"]),
        el("button", { class: "cc-btn", id: "cc-cm-fit",    type: "button" }, ["Fit"]),
        el("button", { class: "cc-btn", id: "cc-cm-edit",   type: "button" }, ["Edit Hitboxes"]),
        el("button", { class: "cc-btn", id: "cc-cm-export", type: "button" }, ["Export"]),
        el("button", { class: "cc-btn", id: "cc-cm-home",   type: "button" }, ["← Home"])
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
    // Hide immediately — revealed only after applyView() so it never pops in early
    frameOverlay.style.visibility = "hidden";

    var knobV  = el("div", { class: "cc-scroll-knob", id: "cc-scroll-knob-v" }, [
      el("img", { class: "cc-scroll-knob-img", src: opts.knobUrl, alt: "", draggable: "false" })
    ]);
    var knobH  = el("div", { class: "cc-scroll-knob", id: "cc-scroll-knob-h" }, [
      el("img", { class: "cc-scroll-knob-img", src: opts.knobUrl, alt: "", draggable: "false" })
    ]);
    var trackV = el("div", { class: "cc-scroll-vertical",   id: "cc-scroll-track-v" }, [knobV]);
    var trackH = el("div", { class: "cc-scroll-horizontal", id: "cc-scroll-track-h" }, [knobH]);
    // Inline style beats every stylesheet !important rule.
    // Tracks are positioning containers only — knob buttons inside still get events.
    trackV.style.pointerEvents = "none";
    trackH.style.pointerEvents = "none";

    var loaderEl = el("div", { class: "cc-cm-loader", id: "cc-map-loader" }, [
      el("img", { src: opts.logoUrl, alt: "Coffin Canyon", draggable: "false" }),
      el("div", { class: "cc-cm-loader-spin" }),
      el("div", { style: "color:#ff7518;font-size:.8rem;letter-spacing:.2em;text-transform:uppercase" }, ["Loading"])
    ]);
    // Start with pointer-events off — showLoader() turns them on, hideLoader() kills them.
    // This prevents the loader from blocking map interaction at any point.
    loaderEl.style.pointerEvents = "none";

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

    // Critical inline styles — inline style always beats external CSS, even !important
    shell.style.cssText       = "display:flex;flex-direction:column;height:100%;min-height:100vh;position:relative;";
    header.style.cssText      = "flex-shrink:0;display:flex;align-items:center;justify-content:space-between;padding:8px 12px;background:#0a0a0a;border-bottom:1px solid #2a2318;z-index:100;position:relative;pointer-events:auto;";
    mapWrap.style.cssText     = "flex:1;position:relative;overflow:hidden;min-height:0;";

    shell.appendChild(header);
    shell.appendChild(mapWrap);
    rootEl.appendChild(shell);
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

    function showLoader() {
      loaderEl.style.display        = "flex";
      loaderEl.style.opacity        = "1";
      loaderEl.style.pointerEvents  = "auto";
    }
    function hideLoader() {
      // Kill pointer events IMMEDIATELY so the loader never blocks map interaction
      // even during the opacity fade — this was eating all clicks on the mapwrap.
      loaderEl.style.pointerEvents  = "none";
      loaderEl.style.opacity        = "0";
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
        "#cc-scroll-knob-v{top:"  + vPct + "%!important;}" +
        "#cc-scroll-knob-h{left:" + hPct + "%!important;}" +
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

    function hideHitboxLayers() {
      hitboxLayers.forEach(function (l) {
        try {
          var el = l.getElement();
          if (el) el.style.display = "none";
        } catch (_) {}
      });
    }

    function showHitboxLayers() {
      hitboxLayers.forEach(function (l) {
        try {
          var el = l.getElement();
          if (el) el.style.display = "";
        } catch (_) {}
      });
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

        // ── Label: divIcon at SCREEN TOP-LEFT corner.
        // In CRS.Simple lat increases upward, so b[2] (larger Y) = top of screen,
        // b[1] (smaller X) = left side.  Top-left = [b[2], b[1]].
        // iconAnchor:[0,18] puts bottom-left of the label at that point,
        // so the label sits flush above the top-left corner of the box.
        var labelMarker = window.L.marker([b[2], b[1]], {
          icon: window.L.divIcon({
            className:  "",
            html:       '<div class="cc-map-hitbox-label">' + (loc.name || loc.id) + "</div>",
            iconSize:   [0, 0],
            iconAnchor: [0, 18]
          }),
          interactive: false,
          keyboard:    false
        }).addTo(lensMap);

        // Full bounding box is hit-testable, not just the 2px stroke
        var domEl = rect.getElement();
        if (domEl) domEl.style.pointerEvents = "all";

        (function (capturedLoc) {
          rect.on("click", function (e) {
            if (editor && editor.isEditing()) return;
            if (window.L && window.L.DomEvent) window.L.DomEvent.stop(e);
            console.log("HITBOX CLICK:", capturedLoc.id);
            renderDrawer(ui, capturedLoc);
          });
        }(loc));

        hitboxLayers.push(rect);
        hitboxLayers.push(labelMarker);
      });
    }

    // ── Init / load ───────────────────────────────────────────────────────
    function init() {
      // Re-hide everything synchronously before any async work.
      // On first load the frame is already hidden (set at DOM build time).
      // On reload it was revealed by the previous run, so we must re-hide.
      ui.mapEl.style.visibility    = "hidden";
      ui.lensMapEl.style.visibility = "hidden";
      ui.frameEl.style.visibility  = "hidden";

      showLoader();
      updateResponsiveScale();
      var loadStart = Date.now();

      return ensureDeps(opts).then(function() {
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

          lockMaps();

          // Destroy previous editor and remove its DOM layer before creating
          // a new one — otherwise each reload adds another layer to lensMapEl.
          if (editor && typeof editor.destroy === "function") editor.destroy();
          var oldLayer = document.getElementById("cc-hitbox-editor");
          if (oldLayer && oldLayer.parentNode) oldLayer.parentNode.removeChild(oldLayer);

          editor = createHitboxEditor(rootEl, ui);
          editor.attach(lensMap, bounds,
            function () {                          // onExitEdit (refresh view)
              showHitboxLayers();
              lensMap.invalidateSize({ animate: false });
              bgMap.invalidateSize({ animate: false });
              applyView(currentT, currentTx);
              if (editor) editor.redraw();
            },
            function () {                          // onEnterEdit (hide orange rects)
              hideHitboxLayers();
            }
          );

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
          // Build hitboxes AFTER applyView — Leaflet positions permanent tooltips
          // at bind time, so the map must have a view set or they all stack at [0,0].
          buildHitboxes();
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
      // Full reset — exit edit mode, stop momentum, return to centre
      if (editor && editor.isEditing()) editor.toggle();
      momV.stop(); momH.stop();
      currentT = 0.5; currentTx = 0.5;
      init();
    };
    header.querySelector("#cc-cm-fit"   ).onclick = function () { if (px) applyView(0.5, 0.5); };
    header.querySelector("#cc-cm-edit"  ).onclick = function () { if (editor) editor.toggle(); };
    header.querySelector("#cc-cm-export").onclick = function () { if (editor) editor.exportJSON(); };
    header.querySelector("#cc-cm-home"  ).onclick = function () {
      if (window.CC_MASTER && typeof window.CC_MASTER.backToLauncher === 'function') {
        window.CC_MASTER.backToLauncher();
      }
    };
    drawer.querySelector("#close-dr"    ).onclick = function () { ui.drawerEl.classList.remove("cc-slide-panel-open"); };

    var onDocClick = function (e) {
      if (!ui.drawerEl.classList.contains("cc-slide-panel-open")) return;
      if (ui.drawerEl.contains(e.target)) return;
      // Don't close when clicking a hitbox rectangle — that will open a new location
      if (e.target && e.target.closest && e.target.closest(".leaflet-interactive")) return;
      ui.drawerEl.classList.remove("cc-slide-panel-open");
    };

    document.addEventListener("click", onDocClick);

    // ── Destroy ───────────────────────────────────────────────────────────
    _destroyFn = function () {
      window.removeEventListener("resize", onResize);
      document.removeEventListener("click", onDocClick);
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
      return mount(options.root, {});
    },
    destroy: function () {
      if (typeof _destroyFn === "function") { _destroyFn(); _destroyFn = null; }
    }
  };

  window.CC_CanyonMap = { mount: mount };
})();
