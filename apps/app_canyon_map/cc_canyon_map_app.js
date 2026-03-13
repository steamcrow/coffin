/* File: apps/app_canyon_map/cc_canyon_map_app.js
   Coffin Canyon — Canyon Map
*/

(function () {
  var BG_ZOOM = -1;
  var LENS_ZOOM_OFFSET = 1.15;
  var MIN_LOADER_MS = 700;

  var V_MIN = 14;
  var V_MAX = 86;
  var H_MIN = 12;
  var H_MAX = 88;

  var DEFAULTS = {
    title: "Coffin Canyon — Canyon Map",
    mapUrl: "https://raw.githubusercontent.com/steamcrow/coffin/main/apps/app_canyon_map/data/canyon_map.json",
    locationsUrl: "https://raw.githubusercontent.com/steamcrow/coffin/main/data/src/170_named_locations.json",
    appCssUrl: "https://raw.githubusercontent.com/steamcrow/coffin/main/apps/app_canyon_map/cc_canyon_map.css",
    leafletCssUrl: "https://raw.githubusercontent.com/steamcrow/coffin/main/vendor/leaflet/leaflet.css",
    leafletJsUrl: "https://raw.githubusercontent.com/steamcrow/coffin/main/vendor/leaflet/leaflet.js",
    logoUrl: "https://raw.githubusercontent.com/steamcrow/coffin/main/assets/logos/coffin_canyon_logo.png",
    frameUrl: "https://raw.githubusercontent.com/steamcrow/coffin/main/apps/app_canyon_map/data/mag_frame3.png",
    knobUrl: "https://raw.githubusercontent.com/steamcrow/coffin/main/apps/app_canyon_map/data/blappo_knob.png"
  };

  var HITBOXES = {
    "bandit-buck": [1550, 956, 1668, 1160],
    "bayou-city": [1175, 2501, 1386, 2767],
    "camp-coffin": [2000, 1200, 2300, 1400],
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

  var _loaded = { css: {}, js: {}, stylePatch: false };

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

  function bust(url) {
    return url + (url.indexOf("?") >= 0 ? "&" : "?") + "t=" + Date.now();
  }

  function fetchText(url) {
    return fetch(bust(url)).then(function (r) {
      if (!r.ok) throw new Error("HTTP " + r.status + ": " + url);
      return r.text();
    });
  }

  function fetchJson(url) {
    return fetch(bust(url)).then(function (r) {
      if (!r.ok) throw new Error("HTTP " + r.status + ": " + url);
      return r.json();
    });
  }

  function preloadImage(url, tries) {
    tries = typeof tries === "number" ? tries : 2;
    return new Promise(function (resolve, reject) {
      function attempt(left) {
        var img = new Image();
        img.crossOrigin = "anonymous";
        img.onload = function () { resolve(url); };
        img.onerror = function () {
          if (left > 0) {
            setTimeout(function () { attempt(left - 1); }, 250);
          } else {
            reject(new Error("Image failed to load: " + url));
          }
        };
        img.src = bust(url);
      }
      attempt(tries);
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
    var p = Promise.resolve();
    p = p.then(function () { return loadCssOnce(opts.leafletCssUrl, "leaflet_css"); });
    p = p.then(function () { return loadCssOnce(opts.appCssUrl, "app_css"); });
    if (!window.L) {
      p = p.then(function () { return loadScriptOnce(opts.leafletJsUrl, "leaflet_js"); });
    }
    p = p.then(ensureRuntimeStylePatch);
    return p;
  }

  function ensureRuntimeStylePatch() {
    if (_loaded.stylePatch) return Promise.resolve();
    var s = document.createElement("style");
    s.setAttribute("data-cc-style", "cc-canyon-map-runtime-patch");
    s.textContent = [
      ".cc-canyon-map.cc-hitbox-edit .cc-lens{display:block!important;top:0!important;left:0!important;width:100%!important;height:100%!important;transform:none!important;mask-image:none!important;-webkit-mask-image:none!important;filter:none!important;pointer-events:auto!important;z-index:20!important;}",
      ".cc-canyon-map.cc-hitbox-edit .cc-frame-overlay,.cc-canyon-map.cc-hitbox-edit .cc-scroll-vertical,.cc-canyon-map.cc-hitbox-edit .cc-scroll-horizontal{display:none!important;}",
      ".cc-canyon-map.cc-hitbox-edit .cc-cm-map{opacity:0!important;pointer-events:none!important;}",
      ".cc-canyon-map.cc-hitbox-edit .cc-lens-chromatic,.cc-canyon-map.cc-hitbox-edit .cc-lens-glare{display:none!important;}",
      ".cc-canyon-map.cc-hitbox-edit .cc-lens-overscan,.cc-canyon-map.cc-hitbox-edit .cc-lens-map{inset:0!important;}",
      ".cc-hitbox-editor-layer{position:absolute!important;inset:0!important;z-index:999!important;pointer-events:auto!important;}",
      ".cc-hb-box{position:absolute!important;outline:2px solid rgba(0,255,255,.95)!important;background:rgba(0,255,255,.12)!important;border-radius:6px!important;box-sizing:border-box!important;cursor:grab!important;pointer-events:auto!important;}",
      ".cc-hb-box:active{cursor:grabbing!important;}",
      ".cc-hb-label{position:absolute!important;left:0!important;top:-18px!important;padding:2px 6px!important;border-radius:6px!important;background:rgba(0,0,0,.78)!important;color:#fff!important;font:12px/1 system-ui,sans-serif!important;white-space:nowrap!important;pointer-events:none!important;}",
      ".cc-hb-handle{position:absolute!important;width:12px!important;height:12px!important;right:-6px!important;bottom:-6px!important;background:rgba(0,255,255,.95)!important;border-radius:3px!important;cursor:nwse-resize!important;}",
      ".cc-scroll-vertical,.cc-scroll-horizontal,.cc-scroll-knob{pointer-events:auto!important;touch-action:none!important;}",
      ".cc-scroll-knob{user-select:none!important;-webkit-user-select:none!important;}"
    ].join("");
    document.head.appendChild(s);
    _loaded.stylePatch = true;
    return Promise.resolve();
  }

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
      '<div class="cc-block"><div class="cc-h">Danger</div>' + meterBar(loc.danger || 0, 6, "#ff4444") + "</div>" +
      '<div class="cc-block"><div class="cc-h">Population</div>' + meterBar(loc.population || 0, 6, "#4caf50") + "</div>" +
      (loc.atmosphere ? '<div class="cc-block"><div class="cc-h">Atmosphere</div><p><em>' + loc.atmosphere + "</em></p></div>" : "") +
      '<div style="display:flex;flex-wrap:wrap;gap:.5rem">' +
      (loc.features || []).map(function (f) {
        return '<span style="padding:4px 10px;background:rgba(255,117,24,.2);border:1px solid rgba(255,117,24,.4);border-radius:4px;font-size:.85rem">' + f + "</span>";
      }).join("") +
      "</div>";

    ui.drawerEl.classList.add("cc-slide-panel-open");
    ui.drawerEl.scrollTop = 0;
  }

  function safeRange(containerEl, zoom, imageDim, isWidth) {
    var rect = containerEl.getBoundingClientRect();
    var size = isWidth
      ? (rect.width || containerEl.offsetWidth || 800)
      : (rect.height || containerEl.offsetHeight || 600);

    var scale = Math.pow(2, zoom);
    var visible = size / scale;
    var half = visible / 2;

    if (half >= imageDim / 2) {
      return { min: imageDim / 2, max: imageDim / 2 };
    }

    return { min: half, max: imageDim - half };
  }

  function createHitboxEditor(root, ui) {
    var state = {
      editing: false,
      active: null,
      map: null,
      bounds: null,
      layerEl: null,
      attached: false,
      refreshView: null
    };

    function ensureLayer() {
      if (state.layerEl) return state.layerEl;
      state.layerEl = document.createElement("div");
      state.layerEl.className = "cc-hitbox-editor-layer";
      state.layerEl.id = "cc-hitbox-editor";
      ui.lensMapEl.appendChild(state.layerEl);
      return state.layerEl;
    }

    function rectFromHitbox(b) {
      return { y1: b[0], x1: b[1], y2: b[2], x2: b[3] };
    }

    function hitboxFromRect(r) {
      return [Math.round(r.y1), Math.round(r.x1), Math.round(r.y2), Math.round(r.x2)];
    }

    function latLngToPx(lat, lng) {
      var pt = state.map.latLngToContainerPoint(window.L.latLng(lat, lng));
      return { x: pt.x, y: pt.y };
    }

    function draw() {
      if (!state.editing || !state.map) return;

      var layer = ensureLayer();
      layer.innerHTML = "";

      Object.keys(HITBOXES).sort().forEach(function (id) {
        var b = HITBOXES[id];
        if (!b) return;

        var r = rectFromHitbox(b);
        var p1 = latLngToPx(r.y1, r.x1);
        var p2 = latLngToPx(r.y2, r.x2);

        var left = Math.min(p1.x, p2.x);
        var top = Math.min(p1.y, p2.y);
        var width = Math.max(8, Math.abs(p2.x - p1.x));
        var height = Math.max(8, Math.abs(p2.y - p1.y));

        var box = document.createElement("div");
        box.className = "cc-hb-box";
        box.dataset.id = id;
        box.style.left = left + "px";
        box.style.top = top + "px";
        box.style.width = width + "px";
        box.style.height = height + "px";

        var label = document.createElement("div");
        label.className = "cc-hb-label";
        label.textContent = id;
        box.appendChild(label);

        var handle = document.createElement("div");
        handle.className = "cc-hb-handle";
        box.appendChild(handle);

        layer.appendChild(box);
      });

      ui.editorBadgeEl.style.display = "block";
    }

    function updateFromBox(box) {
      var id = box.dataset.id;
      var left = parseFloat(box.style.left);
      var top = parseFloat(box.style.top);
      var width = parseFloat(box.style.width);
      var height = parseFloat(box.style.height);

      var p1 = state.map.containerPointToLatLng(window.L.point(left, top));
      var p2 = state.map.containerPointToLatLng(window.L.point(left + width, top + height));

      HITBOXES[id] = hitboxFromRect({
        y1: Math.min(p1.lat, p2.lat),
        x1: Math.min(p1.lng, p2.lng),
        y2: Math.max(p1.lat, p2.lat),
        x2: Math.max(p1.lng, p2.lng)
      });
    }

    function attachPointerHandlers() {
      if (state.attached) return;
      state.attached = true;

      ensureLayer().addEventListener("pointerdown", function (e) {
        if (!state.editing) return;

        var box = e.target.closest(".cc-hb-box");
        if (!box) return;

        var isHandle = e.target.classList.contains("cc-hb-handle");

        state.active = {
          box: box,
          mode: isHandle ? "resize" : "move",
          pointerId: e.pointerId,
          startX: e.clientX,
          startY: e.clientY,
          left: parseFloat(box.style.left),
          top: parseFloat(box.style.top),
          width: parseFloat(box.style.width),
          height: parseFloat(box.style.height)
        };

        try {
          box.setPointerCapture(e.pointerId);
        } catch (err) {}

        e.preventDefault();
        e.stopPropagation();
      });

      window.addEventListener("pointermove", function (ev) {
        if (!state.active) return;
        if (typeof state.active.pointerId === "number" && ev.pointerId !== state.active.pointerId) return;

        var dx = ev.clientX - state.active.startX;
        var dy = ev.clientY - state.active.startY;

        if (state.active.mode === "move") {
          state.active.box.style.left = Math.round(state.active.left + dx) + "px";
          state.active.box.style.top = Math.round(state.active.top + dy) + "px";
        } else {
          state.active.box.style.width = Math.max(8, Math.round(state.active.width + dx)) + "px";
          state.active.box.style.height = Math.max(8, Math.round(state.active.height + dy)) + "px";
        }

        updateFromBox(state.active.box);
        ev.preventDefault();
      }, { passive: false });

      function endPointer(ev) {
        if (!state.active) return;
        if (typeof state.active.pointerId === "number" && ev.pointerId !== state.active.pointerId) return;
        state.active = null;
      }

      window.addEventListener("pointerup", endPointer);
      window.addEventListener("pointercancel", endPointer);
    }

    function exportJSON() {
      var keys = Object.keys(HITBOXES).sort();
      var lines = keys.map(function (k) {
        return '  "' + k + '": [' + HITBOXES[k].map(function (n) { return Math.round(n); }).join(", ") + "]";
      });
      var text = "var HITBOXES = {\n" + lines.join(",\n") + "\n};";
      window.prompt("Copy HITBOXES:", text);
    }

    function setEditing(on) {
      state.editing = on;
      root.classList.toggle("cc-hitbox-edit", on);

      if (!state.map || !state.bounds) return;

      if (!on) {
        if (state.layerEl) state.layerEl.style.display = "none";
        ui.editorBadgeEl.style.display = "none";
        state.map.off("move zoom resize", draw);
        if (typeof state.refreshView === "function") {
          nextFrame().then(function () {
            state.refreshView();
          });
        }
        return;
      }

      nextFrame()
        .then(function () {
          state.map.invalidateSize({ animate: false });
          state.map.fitBounds(state.bounds, { animate: false, padding: [24, 24] });
          ensureLayer().style.display = "block";
          draw();
          state.map.on("move zoom resize", draw);
        });
    }

    return {
      attach: function (map, bounds, refreshViewFn) {
        state.map = map;
        state.bounds = bounds;
        state.refreshView = refreshViewFn || null;
        attachPointerHandlers();
      },
      toggle: function () { setEditing(!state.editing); },
      exportJSON: exportJSON,
      isEditing: function () { return state.editing; },
      redraw: draw
    };
  }

  function mount(root, userOpts) {
    var opts = Object.assign({}, DEFAULTS, userOpts || {});
    var destroyed = false;

    var ui = null;
    var bgMap = null;
    var lensMap = null;
    var mapDoc = null;
    var locationsDoc = null;
    var editor = null;
    var hitboxLayers = [];
    var knobsBound = false;
    var px = null;
    var bounds = null;
    var currentT = 0.5;
    var currentTx = 0.5;

    function destroyMaps() {
      try { if (bgMap) bgMap.remove(); } catch (e) {}
      try { if (lensMap) lensMap.remove(); } catch (e) {}
      bgMap = null;
      lensMap = null;
    }

    function renderLoaderOnly() {
      root.innerHTML = "";
      root.className = "cc-canyon-map cc-loading";
      root.style.minHeight = "100vh";

      var shell = el("div", { class: "cc-cm-shell" }, [
        el("div", { class: "cc-cm-mapwrap", style: "min-height:520px;position:relative;" }, [
          el("div", {
            class: "cc-cm-loader",
            id: "cc-map-loader",
            style: "display:flex;opacity:1;"
          }, [
            el("img", { src: opts.logoUrl, alt: "Coffin Canyon" }),
            el("div", { class: "cc-cm-loader-spin" }),
            el("div", {
              style: "color:#ff7518;font-size:.8rem;letter-spacing:.2em;text-transform:uppercase"
            }, ["Loading"])
          ])
        ])
      ]);

      root.appendChild(shell);
    }

    function buildUI() {
      root.innerHTML = "";
      root.className = "cc-canyon-map cc-loading";

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
        el("img", { class: "cc-frame-image", src: opts.frameUrl, alt: "", draggable: "false" })
      ]);

      var knobV = el("div", { class: "cc-scroll-knob", id: "cc-scroll-knob-v" }, [
        el("img", { class: "cc-scroll-knob-img", src: opts.knobUrl, alt: "", draggable: "false" })
      ]);

      var knobH = el("div", { class: "cc-scroll-knob", id: "cc-scroll-knob-h" }, [
        el("img", { class: "cc-scroll-knob-img", src: opts.knobUrl, alt: "", draggable: "false" })
      ]);

      var trackV = el("div", { class: "cc-scroll-vertical", id: "cc-scroll-track-v" }, [knobV]);
      var trackH = el("div", { class: "cc-scroll-horizontal", id: "cc-scroll-track-h" }, [knobH]);

      var loaderEl = el("div", { class: "cc-cm-loader", id: "cc-map-loader", style: "display:flex;opacity:1;" }, [
        el("img", { src: opts.logoUrl, alt: "Coffin Canyon" }),
        el("div", { class: "cc-cm-loader-spin" }),
        el("div", { style: "color:#ff7518;font-size:.8rem;letter-spacing:.2em;text-transform:uppercase" }, ["Loading"])
      ]);

      var editorBadgeEl = el("div", {
        class: "cc-hitbox-editor-badge",
        style: "display:none"
      }, ["Hitbox edit mode active — drag or resize cyan boxes, then click Export."]);

      var mapWrap = el("div", { class: "cc-cm-mapwrap" }, [
        mapEl,
        lensEl,
        frameOverlay,
        trackV,
        trackH,
        loaderEl,
        editorBadgeEl
      ]);

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

      ui = {
        shell: shell,
        header: header,
        mapEl: mapEl,
        lensMapEl: lensMapEl,
        lensEl: lensEl,
        mapWrap: mapWrap,
        drawerEl: drawer,
        drawerTitleEl: drawer.querySelector(".cc-cm-drawer-title"),
        drawerContentEl: drawer.querySelector(".cc-cm-drawer-content"),
        knobV: knobV,
        knobH: knobH,
        trackV: trackV,
        trackH: trackH,
        frameOverlay: frameOverlay,
        loaderEl: loaderEl,
        editorBadgeEl: editorBadgeEl
      };

      bindUIEvents();
      updateResponsiveScale();
      patchTrackGeometry();
    }

    function updateResponsiveScale() {
      if (!ui || !ui.mapWrap) return;
      var designWidth = 1280;
      var currentWidth = ui.mapWrap.getBoundingClientRect().width || ui.mapWrap.offsetWidth || designWidth;
      var scale = Math.max(0.56, Math.min(1, currentWidth / designWidth));
      root.style.setProperty("--device-scale", scale.toFixed(4));
    }

    function patchTrackGeometry() {
      if (!ui) return;
      var scale = parseFloat(getComputedStyle(root).getPropertyValue("--device-scale")) || 1;

      ui.trackV.style.position = "absolute";
      ui.trackV.style.zIndex = "60";
      ui.trackV.style.pointerEvents = "auto";
      ui.trackV.style.width = "56px";
      ui.trackV.style.height = (560 * scale) + "px";
      ui.trackV.style.left = "calc(50% + " + (470 * scale) + "px)";
      ui.trackV.style.top = "46%";
      ui.trackV.style.transform = "translate(-50%, -50%)";

      ui.trackH.style.position = "absolute";
      ui.trackH.style.zIndex = "60";
      ui.trackH.style.pointerEvents = "auto";
      ui.trackH.style.width = (900 * scale) + "px";
      ui.trackH.style.height = "56px";
      ui.trackH.style.left = "53%";
      ui.trackH.style.top = "calc(50% + " + (335 * scale) + "px)";
      ui.trackH.style.transform = "translate(-50%, -50%)";

      ui.knobV.style.zIndex = "61";
      ui.knobH.style.zIndex = "61";
      ui.knobV.style.pointerEvents = "auto";
      ui.knobH.style.pointerEvents = "auto";
      ui.knobV.style.touchAction = "none";
      ui.knobH.style.touchAction = "none";
    }

    function showLoader() {
      if (!ui || !ui.loaderEl) return;
      ui.loaderEl.style.display = "flex";
      ui.loaderEl.style.opacity = "1";
      root.classList.add("cc-loading");
      root.classList.remove("cc-ready");
    }

    function hideLoader() {
      if (!ui || !ui.loaderEl) return;
      ui.loaderEl.style.opacity = "0";
      setTimeout(function () {
        if (!ui || !ui.loaderEl) return;
        ui.loaderEl.style.display = "none";
        root.classList.remove("cc-loading");
        root.classList.add("cc-ready");
      }, 320);
    }

    function lockMaps() {
      if (!bgMap || !lensMap) return;

      [bgMap, lensMap].forEach(function (m) {
        m.dragging.disable();
        m.doubleClickZoom.disable();
        m.scrollWheelZoom.disable();
        m.touchZoom.disable();
        m.boxZoom.disable();
        m.keyboard.disable();
        if (m.tap) m.tap.disable();
      });
    }

    function applyView(t, tx) {
      if (!bgMap || !lensMap || !px || !ui) return;

      currentT = clamp(typeof t === "number" ? t : currentT, 0, 1);
      currentTx = clamp(typeof tx === "number" ? tx : currentTx, 0, 1);

      var lensZoom = BG_ZOOM + LENS_ZOOM_OFFSET;

      var bgRy = safeRange(ui.mapEl, BG_ZOOM, px.h, false);
      var bgRx = safeRange(ui.mapEl, BG_ZOOM, px.w, true);
      var lnRy = safeRange(ui.lensMapEl, lensZoom, px.h, false);
      var lnRx = safeRange(ui.lensMapEl, lensZoom, px.w, true);

      bgMap.setView([
        bgRy.min + currentT * (bgRy.max - bgRy.min),
        bgRx.min + currentTx * (bgRx.max - bgRx.min)
      ], BG_ZOOM, { animate: false });

      lensMap.setView([
        lnRy.min + currentT * (lnRy.max - lnRy.min),
        lnRx.min + currentTx * (lnRx.max - lnRx.min)
      ], lensZoom, { animate: false });

      ui.knobV.style.top = (V_MIN + currentT * (V_MAX - V_MIN)) + "%";
      ui.knobH.style.left = (H_MIN + currentTx * (H_MAX - H_MIN)) + "%";
    }

    function bindKnob(knobEl, axis) {
      function getClient(ev) {
        return axis === "v" ? ev.clientY : ev.clientX;
      }

      function getTrackRect() {
        return knobEl.parentElement.getBoundingClientRect();
      }

      knobEl.addEventListener("pointerdown", function (e) {
        if (editor && editor.isEditing()) return;

        e.preventDefault();
        e.stopPropagation();

        var trackRect = getTrackRect();
        var knobRect = knobEl.getBoundingClientRect();
        var grabOffset = axis === "v"
          ? (getClient(e) - knobRect.top)
          : (getClient(e) - knobRect.left);

        knobEl.classList.add("is-active");

        try {
          knobEl.setPointerCapture(e.pointerId);
        } catch (err) {}

        function onMove(ev) {
          var rect = getTrackRect();
          var trackSize = axis === "v" ? rect.height : rect.width;
          var knobSize = axis === "v" ? knobRect.height : knobRect.width;

          var raw = axis === "v"
            ? (getClient(ev) - rect.top - grabOffset)
            : (getClient(ev) - rect.left - grabOffset);

          var minPx = (axis === "v" ? V_MIN : H_MIN) / 100 * trackSize;
          var maxPx = (axis === "v" ? V_MAX : H_MAX) / 100 * trackSize;
          var clampedPx = clamp(raw + knobSize / 2, minPx, maxPx);

          var n = clamp((clampedPx - minPx) / Math.max(1, (maxPx - minPx)), 0, 1);

          if (axis === "v") applyView(n, currentTx);
          else applyView(currentT, n);

          ev.preventDefault();
        }

        function onEnd() {
          knobEl.classList.remove("is-active");
          window.removeEventListener("pointermove", onMove);
          window.removeEventListener("pointerup", onEnd);
          window.removeEventListener("pointercancel", onEnd);
        }

        window.addEventListener("pointermove", onMove, { passive: false });
        window.addEventListener("pointerup", onEnd);
        window.addEventListener("pointercancel", onEnd);
      }, { passive: false });
    }

    function bindKnobs() {
      if (knobsBound || !ui) return;
      knobsBound = true;
      bindKnob(ui.knobV, "v");
      bindKnob(ui.knobH, "h");
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
        var b = HITBOXES[loc.id];
        if (!b) return;

        var rect = window.L.rectangle(
          [[b[0], b[1]], [b[2], b[3]]],
          {
            color: "#ff7518",
            weight: 2,
            fillOpacity: 0.10,
            interactive: true,
            bubblingMouseEvents: false
          }
        ).addTo(lensMap);

        rect.bindTooltip(loc.name || loc.id, {
          permanent: true,
          direction: "center",
          className: "cc-map-hitbox-label",
          opacity: 0.95
        });

        function openLoc(ev) {
          if (editor && editor.isEditing()) return;
          if (window.L && window.L.DomEvent) window.L.DomEvent.stop(ev);
          renderDrawer(ui, loc);
        }

        rect.on("click", openLoc);
        rect.on("mousedown", openLoc);
        rect.on("touchstart", openLoc);

        hitboxLayers.push(rect);
      });
    }

    function bindUIEvents() {
      if (!ui) return;

      ui.header.querySelector("#cc-cm-reload").onclick = function () {
        initMaps();
      };

      ui.header.querySelector("#cc-cm-fit").onclick = function () {
        if (px) applyView(0.5, 0.5);
      };

      ui.header.querySelector("#cc-cm-edit").onclick = function () {
        if (editor) editor.toggle();
      };

      ui.header.querySelector("#cc-cm-export").onclick = function () {
        if (editor) editor.exportJSON();
      };

      ui.drawerEl.querySelector("#close-dr").onclick = function () {
        ui.drawerEl.classList.remove("cc-slide-panel-open");
      };

      root.addEventListener("click", function (e) {
        if (!ui || !ui.drawerEl.classList.contains("cc-slide-panel-open")) return;
        if (ui.drawerEl.contains(e.target)) return;
        if (e.target && (e.target.closest(".leaflet-interactive") || e.target.closest(".leaflet-tooltip"))) return;
        ui.drawerEl.classList.remove("cc-slide-panel-open");
      });
    }

    function initMaps() {
      if (!ui) return Promise.resolve();
      showLoader();
      updateResponsiveScale();
      patchTrackGeometry();

      var loadStart = Date.now();

      return Promise.resolve()
        .then(function () {
          return Promise.all([
            fetchJson(opts.mapUrl),
            fetchJson(opts.locationsUrl)
          ]);
        })
        .then(function (results) {
          mapDoc = results[0];
          locationsDoc = results[1];
          px = mapDoc.map.background.image_pixel_size;
          bounds = [[0, 0], [px.h, px.w]];

          var bgUrl = mapDoc.map.background.image_key;
          var lensUrl = (mapDoc.map.lens && mapDoc.map.lens.image_key)
            ? mapDoc.map.lens.image_key
            : mapDoc.map.background.image_key;

          return Promise.all([
            preloadImage(bgUrl, 2),
            preloadImage(lensUrl, 2)
          ]).then(function () {
            return {
              bgUrl: bgUrl,
              lensUrl: lensUrl
            };
          });
        })
        .then(function (urls) {
          destroyMaps();

          bgMap = window.L.map(ui.mapEl, {
            crs: window.L.CRS.Simple,
            minZoom: -3,
            maxZoom: 2,
            zoomSnap: 0,
            zoomDelta: 0.25,
            zoomControl: false,
            attributionControl: false
          });

          window.L.imageOverlay(bust(urls.bgUrl), bounds).addTo(bgMap);

          lensMap = window.L.map(ui.lensMapEl, {
            crs: window.L.CRS.Simple,
            minZoom: -3,
            maxZoom: 4,
            zoomSnap: 0,
            zoomDelta: 0.25,
            zoomControl: false,
            attributionControl: false
          });

          window.L.imageOverlay(bust(urls.lensUrl), bounds).addTo(lensMap);

          lockMaps();
          buildHitboxes();

          editor = createHitboxEditor(root, ui);
          editor.attach(lensMap, bounds, function () {
            lensMap.invalidateSize({ animate: false });
            bgMap.invalidateSize({ animate: false });
            applyView(currentT, currentTx);
            editor.redraw();
          });

          bindKnobs();

          return nextFrame()
            .then(function () {
              bgMap.invalidateSize({ animate: false });
              lensMap.invalidateSize({ animate: false });
              return nextFrame();
            })
            .then(function () {
              bgMap.invalidateSize({ animate: false });
              lensMap.invalidateSize({ animate: false });
              applyView(0.5, 0.5);

              var elapsed = Date.now() - loadStart;
              return delay(Math.max(0, MIN_LOADER_MS - elapsed));
            })
            .then(function () {
              hideLoader();
            });
        })
        .catch(function (err) {
          hideLoader();
          if (ui) {
            ui.drawerTitleEl.textContent = "Load failed";
            ui.drawerContentEl.innerHTML =
              '<div style="color:#f55;padding:1rem">Load failed: ' +
              (err && err.message ? err.message : err) +
              "</div>";
            ui.drawerEl.classList.add("cc-slide-panel-open");
          }
          throw err;
        });
    }

    var onResize = rafThrottle(function () {
      if (destroyed) return;
      updateResponsiveScale();
      patchTrackGeometry();

      if (bgMap) bgMap.invalidateSize({ animate: false });
      if (lensMap) lensMap.invalidateSize({ animate: false });

      if (px) {
        if (editor && editor.isEditing()) {
          lensMap.fitBounds(bounds, { animate: false, padding: [24, 24] });
          editor.redraw();
        } else {
          applyView(currentT, currentTx);
        }
      }
    });

    window.addEventListener("resize", onResize);

    renderLoaderOnly();

    return ensureDeps(opts)
      .then(function () {
        if (destroyed) return {};
        buildUI();
        return initMaps();
      })
      .then(function () { return {}; });
  }

  window.CC_CanyonMap = { mount: mount };
  window.CC_HITBOXES = HITBOXES;
})();
