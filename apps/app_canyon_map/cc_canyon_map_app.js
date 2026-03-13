/* File: apps/app_canyon_map/cc_canyon_map_app.js
   Coffin Canyon — Canyon Map
*/

(function () {
  // ═══════════════════════════════════════════════════════════════
  // TUNEABLE CONSTANTS
  // ═══════════════════════════════════════════════════════════════
  var BG_ZOOM = -1;
  var LENS_ZOOM_OFFSET = 0.95;
  var MIN_LOADER_MS = 1000;

  // knob travel ranges as percentages of track size
  var V_MIN = 24;
  var V_MAX = 76;
  var H_MIN = 18;
  var H_MAX = 82;

  // ═══════════════════════════════════════════════════════════════
  // DEFAULTS
  // ═══════════════════════════════════════════════════════════════
  var DEFAULTS = {
    title: "Coffin Canyon — Canyon Map",
    mapUrl: "https://raw.githubusercontent.com/steamcrow/coffin/main/apps/app_canyon_map/data/canyon_map.json",
    locationsUrl: "https://raw.githubusercontent.com/steamcrow/coffin/main/data/src/170_named_locations.json",
    appCssUrl: "https://raw.githubusercontent.com/steamcrow/coffin/main/apps/app_canyon_map/cc_canyon_map.css",
    leafletCssUrl: "https://raw.githubusercontent.com/steamcrow/coffin/main/vendor/leaflet/leaflet.css",
    leafletJsUrl: "https://raw.githubusercontent.com/steamcrow/coffin/main/vendor/leaflet/leaflet.js",
    logoUrl: "https://raw.githubusercontent.com/steamcrow/coffin/main/assets/logos/coffin_canyon_logo.png",
    frameUrl: "https://raw.githubusercontent.com/steamcrow/coffin/main/apps/app_canyon_map/data/mag_frame2.png",
    knobUrl: "https://raw.githubusercontent.com/steamcrow/coffin/main/apps/app_canyon_map/data/blappo_knob.png"
  };

  // ═══════════════════════════════════════════════════════════════
  // LOCATION HITBOXES
  // [minY, minX, maxY, maxX] in image pixels
  // ═══════════════════════════════════════════════════════════════
  var HITBOXES = {
    "bandit-buck": [1550, 956, 1668, 1160],
    "bayou-city": [1175, 2501, 1386, 2767],
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
    "rey": [19, 1883, 230, 2046],
    "river-city": [1068, 1595, 1279, 1861],
    "sangr": [1105, 1172, 1315, 1573],
    "santos-grin": [1185, 1898, 1396, 2176],
    "silverpit": [2128, 1548, 2294, 1762],
    "skull-water": [1609, 492, 1841, 701],
    "splitglass-arroyo": [2605, 1138, 2859, 1427],
    "tin-flats": [1374, 1258, 1512, 1608],
    "tzulto": [2229, 1334, 2447, 1526],
    "widowflow": [1316, 1630, 2078, 1798],
    "witches-roost": [3767, 2130, 3965, 2495]
  };

  // ═══════════════════════════════════════════════════════════════
  // UTILITIES
  // ═══════════════════════════════════════════════════════════════
  function el(tag, attrs, children) {
    attrs = attrs || {};
    children = children || [];
    var n = document.createElement(tag);

    Object.keys(attrs).forEach(function (k) {
      var v = attrs[k];
      if (k === "class") n.className = v;
      else if (k === "style") n.setAttribute("style", v);
      else if (k.indexOf("on") === 0 && typeof v === "function") {
        n.addEventListener(k.slice(2).toLowerCase(), v);
      } else {
        n.setAttribute(k, v);
      }
    });

    children.forEach(function (c) {
      n.appendChild(typeof c === "string" ? document.createTextNode(c) : c);
    });

    return n;
  }

  function clamp(v, lo, hi) {
    return Math.max(lo, Math.min(hi, v));
  }

  function delay(ms) {
    return new Promise(function (r) { setTimeout(r, ms); });
  }

  function nextFrame() {
    return new Promise(function (r) { requestAnimationFrame(r); });
  }

  function rafThrottle(fn) {
    var pending = false;
    var lastArgs;
    return function () {
      lastArgs = arguments;
      if (pending) return;
      pending = true;
      requestAnimationFrame(function () {
        pending = false;
        fn.apply(null, lastArgs);
      });
    };
  }

  function meterBar(value, max, color) {
    var pct = Math.round(clamp(value || 0, 0, max) / max * 100);
    return '<div style="width:100%;height:22px;background:rgba(255,255,255,.08);border-radius:11px;overflow:hidden;position:relative;border:1px solid rgba(255,255,255,.12)">' +
      '<div style="height:100%;width:' + pct + '%;background:' + color + ';transition:width .25s"></div>' +
      '<div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;color:#fff;font-weight:700;font-size:.8rem">' + (value || 0) + ' / ' + max + '</div></div>';
  }

  function renderDrawer(ui, loc) {
    ui.drawerTitleEl.textContent = loc.name || loc.id || "Location";
    ui.drawerContentEl.innerHTML =
      '<div class="cc-block"><div class="cc-h">Description</div><p>' + (loc.description || "No description.") + '</p></div>' +
      '<div class="cc-block"><div class="cc-h">Danger</div>' + meterBar(loc.danger || 0, 6, "#ff4444") + '</div>' +
      '<div class="cc-block"><div class="cc-h">Population</div>' + meterBar(loc.population || 0, 6, "#4caf50") + '</div>' +
      (loc.atmosphere ? '<div class="cc-block"><div class="cc-h">Atmosphere</div><p style="font-style:italic;color:#aaa">' + loc.atmosphere + '</p></div>' : '') +
      '<div style="display:flex;flex-wrap:wrap;gap:.5rem">' +
      (loc.features || []).map(function (f) {
        return '<span style="padding:4px 10px;background:rgba(255,117,24,.2);border:1px solid rgba(255,117,24,.4);border-radius:4px;font-size:.85rem">' + f + '</span>';
      }).join("") +
      '</div>';

    ui.drawerEl.classList.add("cc-slide-panel-open");
    ui.drawerContentEl.scrollTop = 0;
  }

  // ═══════════════════════════════════════════════════════════════
  // NETWORK / LOADER HELPERS
  // ═══════════════════════════════════════════════════════════════
  var _loaded = { css: {}, js: {} };

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
      var blob = new Blob([code], { type: "text/javascript" });
      var blobUrl = URL.createObjectURL(blob);

      return new Promise(function (resolve, reject) {
        var s = document.createElement("script");
        s.src = blobUrl;
        s.onload = function () {
          URL.revokeObjectURL(blobUrl);
          _loaded.js[key] = true;
          resolve();
        };
        s.onerror = function () {
          URL.revokeObjectURL(blobUrl);
          reject(new Error("Script load failed: " + url));
        };
        document.head.appendChild(s);
      });
    });
  }

  function ensureDeps(opts) {
    return loadCssOnce(opts.leafletCssUrl, "leaflet_css")
      .then(function () { return loadScriptOnce(opts.leafletJsUrl, "leaflet_js"); })
      .then(function () { return loadCssOnce(opts.appCssUrl, "app_css"); });
  }

  // ═══════════════════════════════════════════════════════════════
  // RANGE MATH
  // ═══════════════════════════════════════════════════════════════
  function safeRange(containerEl, zoom, imageH) {
    var h = containerEl.getBoundingClientRect().height || containerEl.offsetHeight || 360;
    var visible = h / Math.pow(2, zoom);
    var half = visible / 2;
    if (half >= imageH / 2) {
      return { min: imageH / 2, max: imageH / 2 };
    }
    return { min: half, max: imageH - half };
  }

  function safeRangeX(containerEl, zoom, imageW) {
    var w = containerEl.getBoundingClientRect().width || containerEl.offsetWidth || 600;
    var visible = w / Math.pow(2, zoom);
    var half = visible / 2;
    if (half >= imageW / 2) {
      return { min: imageW / 2, max: imageW / 2 };
    }
    return { min: half, max: imageW - half };
  }

  // ═══════════════════════════════════════════════════════════════
  // HITBOX EDITOR
  // ═══════════════════════════════════════════════════════════════
  function createHitboxEditor(root, ui) {
    var state = {
      editing: false,
      active: null,
      mainMap: null,
      px: null,
      layerEl: null,
      bounds: null
    };

    function ensureLayer() {
      if (state.layerEl) return state.layerEl;
      state.layerEl = document.createElement("div");
      state.layerEl.className = "cc-hitbox-editor-layer";
      state.layerEl.id = "cc-hitbox-editor";
      ui.mapEl.appendChild(state.layerEl);
      return state.layerEl;
    }

    function rectFromHitbox(b) {
      return { y1: b[0], x1: b[1], y2: b[2], x2: b[3] };
    }

    function hitboxFromRect(r) {
      return [
        Math.round(r.y1),
        Math.round(r.x1),
        Math.round(r.y2),
        Math.round(r.x2)
      ];
    }

    function latLngToPx(lat, lng) {
      var pt = state.mainMap.latLngToContainerPoint(window.L.latLng(lat, lng));
      return { x: pt.x, y: pt.y };
    }

    function drawBoxes() {
      if (!state.editing || !state.mainMap || !state.px) return;

      var layer = ensureLayer();
      layer.innerHTML = "";

      Object.keys(HITBOXES).sort().forEach(function (id) {
        var b = HITBOXES[id];
        if (!b) return;

        var r = rectFromHitbox(b);
        var p1 = latLngToPx(r.y1, r.x1);
        var p2 = latLngToPx(r.y2, r.x2);

        var box = document.createElement("div");
        box.className = "cc-hb-box";
        box.dataset.id = id;
        box.style.left = Math.min(p1.x, p2.x) + "px";
        box.style.top = Math.min(p1.y, p2.y) + "px";
        box.style.width = Math.abs(p2.x - p1.x) + "px";
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

      ui.editorBadgeEl.style.display = "block";
    }

    function updateHitboxFromBox(box) {
      var id = box.dataset.id;
      var left = parseFloat(box.style.left);
      var top = parseFloat(box.style.top);
      var width = parseFloat(box.style.width);
      var height = parseFloat(box.style.height);

      var p1 = state.mainMap.containerPointToLatLng(window.L.point(left, top));
      var p2 = state.mainMap.containerPointToLatLng(window.L.point(left + width, top + height));

      HITBOXES[id] = hitboxFromRect({
        y1: Math.min(p1.lat, p2.lat),
        x1: Math.min(p1.lng, p2.lng),
        y2: Math.max(p1.lat, p2.lat),
        x2: Math.max(p1.lng, p2.lng)
      });
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

      try { box.setPointerCapture(e.pointerId); } catch (err) {}

      e.preventDefault();
      e.stopPropagation();
    }

    function onPointerMove(e) {
      if (!state.editing || !state.active) return;

      var dx = e.clientX - state.active.startX;
      var dy = e.clientY - state.active.startY;

      if (state.active.mode === "move") {
        state.active.box.style.left = Math.round(state.active.left + dx) + "px";
        state.active.box.style.top = Math.round(state.active.top + dy) + "px";
      } else {
        state.active.box.style.width = Math.max(8, Math.round(state.active.width + dx)) + "px";
        state.active.box.style.height = Math.max(8, Math.round(state.active.height + dy)) + "px";
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
      var lines = keys.map(function (k) {
        return '  "' + k + '": [' + HITBOXES[k].map(function (n) { return Math.round(n); }).join(", ") + ']';
      });
      var text = "var HITBOXES = {\n" + lines.join(",\n") + "\n};";
      window.prompt("Copy HITBOXES:", text);
    }

    function setEditing(on) {
      state.editing = on;
      root.classList.toggle("cc-hitbox-edit", on);

      if (!state.mainMap || !state.bounds) return;

      if (!on) {
        if (state.layerEl) state.layerEl.style.display = "none";
        ui.editorBadgeEl.style.display = "none";

        state.mainMap.dragging.disable();
        state.mainMap.doubleClickZoom.disable();
        state.mainMap.scrollWheelZoom.disable();
        state.mainMap.touchZoom.disable();
        state.mainMap.boxZoom.disable();
        state.mainMap.keyboard.disable();

        state.mainMap.off("move zoom resize", drawBoxes);
        return;
      }

      state.mainMap.fitBounds(state.bounds, {
        animate: false,
        padding: [24, 24]
      });

      state.mainMap.dragging.enable();
      state.mainMap.doubleClickZoom.enable();
      state.mainMap.scrollWheelZoom.enable();
      state.mainMap.touchZoom.enable();
      state.mainMap.boxZoom.enable();
      state.mainMap.keyboard.enable();

      ensureLayer().style.display = "block";
      drawBoxes();
      state.mainMap.on("move zoom resize", drawBoxes);
    }

    window.addEventListener("pointermove", onPointerMove, { passive: false });
    window.addEventListener("pointerup", onPointerUp);

    return {
      attach: function (mainMap, px, bounds) {
        state.mainMap = mainMap;
        state.px = px;
        state.bounds = bounds;
        ensureLayer().addEventListener("pointerdown", onPointerDown);
      },
      toggle: function () { setEditing(!state.editing); },
      exportJSON: exportHitboxes,
      isEditing: function () { return state.editing; }
    };
  }

  // ═══════════════════════════════════════════════════════════════
  // MOUNT
  // ═══════════════════════════════════════════════════════════════
  function mount(root, userOpts) {
    var opts = Object.assign({}, DEFAULTS, userOpts || {});

    root.innerHTML = "";
    root.classList.remove("cc-ready");
    root.classList.add("cc-loading");
    root.classList.add("cc-canyon-map");

    var shell = el("div", { class: "cc-cm-shell" });

    var header = el("div", { class: "cc-cm-header cc-app-header" }, [
      el("div", { class: "cc-cm-title" }, [opts.title]),
      el("div", { class: "cc-cm-actions" }, [
        el("button", { class: "cc-btn", id: "cc-cm-reload", type: "button" }, ["Reload"]),
        el("button", { class: "cc-btn", id: "cc-cm-fit", type: "button" }, ["Fit"]),
        el("button", { class: "cc-btn", id: "cc-cm-edit", type: "button" }, ["Edit Hitboxes"]),
        el("button", { class: "cc-btn", id: "cc-cm-export", type: "button" }, ["Export"])
      ])
    ]);

    var mapWrap = el("div", { class: "cc-cm-mapwrap" });

    var mapEl = el("div", { id: "cc-cm-map", class: "cc-cm-map" });

    var lensMapEl = el("div", { id: "cc-lens-map", class: "cc-lens-map" });

    var lensInner = el("div", { class: "cc-lens-inner" }, [
      el("div", { class: "cc-lens-overscan" }, [lensMapEl])
    ]);

    var lensEl = el("div", { class: "cc-lens" }, [
      lensInner,
      el("div", { class: "cc-lens-chromatic" }),
      el("div", { class: "cc-lens-glare" })
    ]);

    var frameOverlay = el("div", { class: "cc-frame-overlay" }, [
      el("img", {
        class: "cc-frame-image",
        src: opts.frameUrl,
        alt: "",
        draggable: "false"
      })
    ]);

    var knobV = el("div", { class: "cc-scroll-knob", id: "cc-scroll-knob-v" }, [
      el("img", {
        class: "cc-scroll-knob-img",
        src: opts.knobUrl,
        alt: "",
        draggable: "false"
      })
    ]);

    var knobH = el("div", { class: "cc-scroll-knob", id: "cc-scroll-knob-h" }, [
      el("img", {
        class: "cc-scroll-knob-img",
        src: opts.knobUrl,
        alt: "",
        draggable: "false"
      })
    ]);

    var trackV = el("div", { class: "cc-scroll-vertical", id: "cc-scroll-track-v" }, [knobV]);
    var trackH = el("div", { class: "cc-scroll-horizontal", id: "cc-scroll-track-h" }, [knobH]);

    var loaderEl = el("div", { class: "cc-cm-loader", id: "cc-map-loader" }, [
      el("img", { src: opts.logoUrl, alt: "Coffin Canyon" }),
      el("div", { class: "cc-cm-loader-spin" }),
      el("div", { style: "color:#ff7518;font-size:.8rem;letter-spacing:.2em;text-transform:uppercase" }, ["Loading"])
    ]);

    var editorBadgeEl = el("div", { class: "cc-hitbox-editor-badge", style: "display:none" }, [
      "Hitbox edit mode active — drag or resize cyan boxes, then click Export."
    ]);

    mapWrap.appendChild(mapEl);
    mapWrap.appendChild(lensEl);
    mapWrap.appendChild(frameOverlay);
    mapWrap.appendChild(trackV);
    mapWrap.appendChild(trackH);
    mapWrap.appendChild(loaderEl);
    mapWrap.appendChild(editorBadgeEl);

    var drawer = el("div", { class: "cc-slide-panel", id: "cc-location-panel" }, [
      el("div", { class: "cc-slide-panel-header" }, [
        el("h2", { class: "cc-panel-title cc-cm-drawer-title" }, ["Location"]),
        el("button", { class: "cc-panel-close-btn", id: "close-dr", type: "button" }, ["×"])
      ]),
      el("div", { class: "cc-panel-body cc-cm-drawer-content" })
    ]);

    shell.appendChild(header);
    shell.appendChild(mapWrap);
    root.appendChild(shell);
    root.appendChild(drawer);

    var ui = {
      mapEl: mapEl,
      lensMapEl: lensMapEl,
      lensEl: lensEl,
      drawerEl: drawer,
      drawerTitleEl: drawer.querySelector(".cc-cm-drawer-title"),
      drawerContentEl: drawer.querySelector(".cc-cm-drawer-content"),
      knobV: knobV,
      knobH: knobH,
      trackV: trackV,
      trackH: trackH,
      editorBadgeEl: editorBadgeEl
    };

    var bgMap = null;
    var lensMap = null;
    var mapDoc = null;
    var locationsDoc = null;
    var currentT = 0.5;
    var currentTx = 0.5;
    var editor = null;
    var bounds = null;
    var hitboxLayers = [];

    function updateResponsiveScale() {
      var wrap = mapWrap;
      var designWidth = 1280;
      var currentWidth = wrap.getBoundingClientRect().width || wrap.offsetWidth || designWidth;
      var scale = Math.max(0.62, Math.min(1, currentWidth / designWidth));
      root.style.setProperty("--device-scale", scale.toFixed(4));
    }

    function showLoader() {
      loaderEl.style.display = "flex";
      loaderEl.style.opacity = "1";
    }

    function hideLoader() {
      loaderEl.style.opacity = "0";
      setTimeout(function () {
        loaderEl.style.display = "none";
        root.classList.remove("cc-loading");
        root.classList.add("cc-ready");
      }, 320);
    }

    function disableNormalMapInteraction() {
      if (!bgMap || !lensMap) return;

      [
        bgMap,
        lensMap
      ].forEach(function (m) {
        m.dragging.disable();
        m.doubleClickZoom.disable();
        m.scrollWheelZoom.disable();
        m.touchZoom.disable();
        m.boxZoom.disable();
        m.keyboard.disable();
      });
    }

    function applyView(t, tx, px) {
      if (!bgMap || !lensMap || !px) return;

      currentT = clamp(t, 0, 1);
      currentTx = clamp(tx, 0, 1);

      var lensZoom = BG_ZOOM + LENS_ZOOM_OFFSET;

      var bgRy = safeRange(ui.mapEl, BG_ZOOM, px.h);
      var bgRx = safeRangeX(ui.mapEl, BG_ZOOM, px.w);

      var lnRy = safeRange(ui.lensMapEl, lensZoom, px.h);
      var lnRx = safeRangeX(ui.lensMapEl, lensZoom, px.w);

      bgMap.setView(
        [
          bgRy.min + currentT * (bgRy.max - bgRy.min),
          bgRx.min + currentTx * (bgRx.max - bgRx.min)
        ],
        BG_ZOOM,
        { animate: false }
      );

      lensMap.setView(
        [
          lnRy.min + currentT * (lnRy.max - lnRy.min),
          lnRx.min + currentTx * (lnRx.max - lnRx.min)
        ],
        lensZoom,
        { animate: false }
      );

      var knobVTop = V_MIN + currentT * (V_MAX - V_MIN);
      var knobHLeft = H_MIN + currentTx * (H_MAX - H_MIN);

      ui.knobV.style.top = knobVTop + "%";
      ui.knobH.style.left = knobHLeft + "%";
    }

    function bindKnob(knobEl, axis, px) {
      var dragging = false;
      var grabOffset = 0;

      function getClient(e) {
        var src = e.touches ? e.touches[0] : e;
        return axis === "v" ? src.clientY : src.clientX;
      }

      function getTrackRect() {
        return knobEl.parentElement.getBoundingClientRect();
      }

      function getKnobRect() {
        return knobEl.getBoundingClientRect();
      }

      function posToNormalized(trackPosPx) {
        var trackRect = getTrackRect();
        var size = axis === "v" ? trackRect.height : trackRect.width;
        var pct = (trackPosPx / size) * 100;
        var min = axis === "v" ? V_MIN : H_MIN;
        var max = axis === "v" ? V_MAX : H_MAX;
        return clamp((pct - min) / (max - min), 0, 1);
      }

      function onDown(e) {
        if (editor && editor.isEditing()) return;

        dragging = true;
        var knobRect = getKnobRect();
        var client = getClient(e);

        if (axis === "v") grabOffset = client - knobRect.top;
        else grabOffset = client - knobRect.left;

        knobEl.classList.add("is-active");
        e.preventDefault();
        e.stopPropagation();
      }

      function onMove(e) {
        if (!dragging) return;

        var trackRect = getTrackRect();
        var client = getClient(e);
        var trackPos;

        if (axis === "v") trackPos = client - trackRect.top - grabOffset;
        else trackPos = client - trackRect.left - grabOffset;

        var n = posToNormalized(trackPos);

        if (axis === "v") applyView(n, currentTx, px);
        else applyView(currentT, n, px);

        e.preventDefault();
      }

      function onUp() {
        if (!dragging) return;
        dragging = false;
        knobEl.classList.remove("is-active");
      }

      knobEl.addEventListener("mousedown", onDown);
      knobEl.addEventListener("touchstart", onDown, { passive: false });
      window.addEventListener("mousemove", onMove);
      window.addEventListener("touchmove", onMove, { passive: false });
      window.addEventListener("mouseup", onUp);
      window.addEventListener("touchend", onUp);
    }

    function clearHitboxes() {
      hitboxLayers.forEach(function (l) {
        try { l.remove(); } catch (e) {}
      });
      hitboxLayers = [];
    }

    function buildHitboxes() {
      clearHitboxes();

      if (!locationsDoc || !locationsDoc.locations || !lensMap) return;

      locationsDoc.locations.forEach(function (loc) {
        var bbox = HITBOXES[loc.id];
        if (!bbox) return;

        var rect = window.L.rectangle(
          [[bbox[0], bbox[1]], [bbox[2], bbox[3]]],
          {
            color: "#ff7518",
            weight: 2,
            fillOpacity: 0.14,
            interactive: true
          }
        ).addTo(lensMap);

        rect.bindTooltip(loc.name || loc.id, {
          permanent: true,
          direction: "center",
          className: "cc-map-hitbox-label",
          opacity: 0.95
        });

        rect.on("click", function (e) {
          if (window.L && window.L.DomEvent) window.L.DomEvent.stop(e);
          renderDrawer(ui, loc);
        });

        rect.on("touchstart", function (e) {
          if (window.L && window.L.DomEvent) window.L.DomEvent.stop(e);
          renderDrawer(ui, loc);
        });

        hitboxLayers.push(rect);
      });
    }

    function init() {
      showLoader();
      updateResponsiveScale();
      var loadStart = Date.now();

      return ensureDeps(opts)
        .then(function () {
          return Promise.all([
            fetchJson(opts.mapUrl),
            fetchJson(opts.locationsUrl)
          ]);
        })
        .then(function (results) {
          mapDoc = results[0];
          locationsDoc = results[1];

          var px = mapDoc.map.background.image_pixel_size;
          bounds = [[0, 0], [px.h, px.w]];

          try { if (bgMap) bgMap.remove(); } catch (e) {}
          try { if (lensMap) lensMap.remove(); } catch (e) {}

          bgMap = window.L.map(ui.mapEl, {
            crs: window.L.CRS.Simple,
            minZoom: -3,
            maxZoom: 2,
            zoomControl: false,
            attributionControl: false
          });

          window.L.imageOverlay(mapDoc.map.background.image_key, bounds).addTo(bgMap);

          var lensUrl = (mapDoc.map.lens && mapDoc.map.lens.image_key)
            ? mapDoc.map.lens.image_key
            : mapDoc.map.background.image_key;

          lensMap = window.L.map(ui.lensMapEl, {
            crs: window.L.CRS.Simple,
            minZoom: -3,
            maxZoom: 3,
            zoomControl: false,
            attributionControl: false
          });

          window.L.imageOverlay(lensUrl, bounds).addTo(lensMap);

          disableNormalMapInteraction();

          buildHitboxes();

          editor = createHitboxEditor(root, ui);
          editor.attach(bgMap, px, bounds);

          bindKnob(ui.knobV, "v", px);
          bindKnob(ui.knobH, "h", px);

          return nextFrame().then(function () {
            bgMap.invalidateSize({ animate: false });
            lensMap.invalidateSize({ animate: false });
            applyView(0.5, 0.5, px);

            var elapsed = Date.now() - loadStart;
            return delay(Math.max(0, MIN_LOADER_MS - elapsed));
          });
        })
        .then(function () {
          hideLoader();
        })
        .catch(function (err) {
          hideLoader();
          ui.drawerTitleEl.textContent = "Load failed";
          ui.drawerContentEl.innerHTML =
            '<div style="color:#f55;padding:1rem">Load failed: ' + (err && err.message ? err.message : err) + "</div>";
          ui.drawerEl.classList.add("cc-slide-panel-open");
          throw err;
        });
    }

    window.addEventListener("resize", rafThrottle(function () {
      updateResponsiveScale();
      if (bgMap) bgMap.invalidateSize({ animate: false });
      if (lensMap) lensMap.invalidateSize({ animate: false });

      if (mapDoc && mapDoc.map && mapDoc.map.background && mapDoc.map.background.image_pixel_size) {
        applyView(currentT, currentTx, mapDoc.map.background.image_pixel_size);
      }
    }));

    header.querySelector("#cc-cm-reload").onclick = function () {
      init();
    };

    header.querySelector("#cc-cm-fit").onclick = function () {
      if (mapDoc && mapDoc.map && mapDoc.map.background && mapDoc.map.background.image_pixel_size) {
        currentT = 0.5;
        currentTx = 0.5;
        applyView(0.5, 0.5, mapDoc.map.background.image_pixel_size);
      }
    };

    header.querySelector("#cc-cm-edit").onclick = function () {
      if (editor) editor.toggle();
    };

    header.querySelector("#cc-cm-export").onclick = function () {
      if (editor) editor.exportJSON();
    };

    drawer.querySelector("#close-dr").onclick = function () {
      ui.drawerEl.classList.remove("cc-slide-panel-open");
    };

    root.addEventListener("click", function (e) {
      if (!ui.drawerEl.classList.contains("cc-slide-panel-open")) return;
      if (ui.drawerEl.contains(e.target)) return;
      if (e.target && (e.target.closest(".leaflet-interactive") || e.target.closest(".leaflet-tooltip"))) return;
      ui.drawerEl.classList.remove("cc-slide-panel-open");
    });

    return init().then(function () { return {}; });
  }

  window.CC_CanyonMap = { mount: mount };
  window.CC_HITBOXES = HITBOXES;
})();
