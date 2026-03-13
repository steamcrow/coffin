/* File: apps/app_canyon_map/cc_canyon_map_app.js
   Coffin Canyon — Canyon Map
*/

(function () {
  // ═══════════════════════════════════════════════════════════════
  // TUNEABLE CONSTANTS
  // ═══════════════════════════════════════════════════════════════
  var BG_ZOOM = -1;
  var MIN_LOADER_MS = 5000;
  var FRICTION = 0.88;
  var MIN_VEL = 0.0003;

  // ═══════════════════════════════════════════════════════════════
  // SAFARI DETECTION
  // ═══════════════════════════════════════════════════════════════
  var IS_SAFARI = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);

  // ═══════════════════════════════════════════════════════════════
  // DEFAULT DATA URLS
  // ═══════════════════════════════════════════════════════════════
  var DEFAULTS = {
    title: "Coffin Canyon — Canyon Map",
    mapUrl: "https://raw.githubusercontent.com/steamcrow/coffin/main/apps/app_canyon_map/data/canyon_map.json",
    stateUrl: "https://raw.githubusercontent.com/steamcrow/coffin/main/apps/app_canyon_map/data/canyon_state.json",
    locationsUrl: "https://raw.githubusercontent.com/steamcrow/coffin/main/data/src/170_named_locations.json",
    appCssUrl: "https://raw.githubusercontent.com/steamcrow/coffin/main/apps/app_canyon_map/cc_canyon_map.css",
    leafletCssUrl: "https://raw.githubusercontent.com/steamcrow/coffin/main/vendor/leaflet/leaflet.css",
    leafletJsUrl: "https://raw.githubusercontent.com/steamcrow/coffin/main/vendor/leaflet/leaflet.js",
    logoUrl: "https://raw.githubusercontent.com/steamcrow/coffin/main/assets/logos/coffin_canyon_logo.png",
    frameUrl: "https://raw.githubusercontent.com/steamcrow/coffin/main/apps/app_canyon_map/data/mag_frame2.png",
    lensZoomOffset: 0.2
  };

  // ═══════════════════════════════════════════════════════════════
  // LOCATION HITBOXES
  // [minY, minX, maxY, maxX] in image pixels
  // ═══════════════════════════════════════════════════════════════
  var HITBOXES = {
    "bandit-buck": [1550, 956, 1668, 1160],
    "bayou-city": [1175, 2501, 1386, 2767],
    "camp-coffin": [212, 1050, 600, 900],
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
    "rey": [199, 1883, 230, 2046],
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

  function nextFrame() {
    return new Promise(function (r) { requestAnimationFrame(r); });
  }

  function delay(ms) {
    return new Promise(function (r) { setTimeout(r, ms); });
  }

  // ═══════════════════════════════════════════════════════════════
  // SVG LENS FILTER
  // ═══════════════════════════════════════════════════════════════
  function ensureLensFilter() {
    if (IS_SAFARI) return;
    if (document.getElementById("cc-lens-warp-svg")) return;

    var ns = "http://www.w3.org/2000/svg";
    var svg = document.createElementNS(ns, "svg");
    svg.id = "cc-lens-warp-svg";
    svg.setAttribute("style", "position:absolute;left:-9999px;top:-9999px;width:1px;height:1px;overflow:hidden");
    svg.setAttribute("aria-hidden", "true");
    svg.setAttribute("xmlns", ns);

    var filter = document.createElementNS(ns, "filter");
    filter.id = "ccLensWarp";
    filter.setAttribute("x", "-15%");
    filter.setAttribute("y", "-15%");
    filter.setAttribute("width", "130%");
    filter.setAttribute("height", "130%");
    filter.setAttribute("color-interpolation-filters", "sRGB");

    var turb = document.createElementNS(ns, "feTurbulence");
    turb.setAttribute("type", "fractalNoise");
    turb.setAttribute("baseFrequency", "0.014 0.010");
    turb.setAttribute("numOctaves", "3");
    turb.setAttribute("seed", "42");
    turb.setAttribute("result", "noise");

    var disp = document.createElementNS(ns, "feDisplacementMap");
    disp.setAttribute("in", "SourceGraphic");
    disp.setAttribute("in2", "noise");
    disp.setAttribute("scale", "12");
    disp.setAttribute("xChannelSelector", "R");
    disp.setAttribute("yChannelSelector", "G");
    disp.setAttribute("result", "warped");

    var cm = document.createElementNS(ns, "feColorMatrix");
    cm.setAttribute("type", "matrix");
    cm.setAttribute("in", "warped");
    cm.setAttribute(
      "values",
      "1.07 0.03 0 0 0.018 " +
      "0 1.02 0.01 0 0.008 " +
      "0 0 0.88 0 0 " +
      "0 0 0 1 0"
    );

    filter.appendChild(turb);
    filter.appendChild(disp);
    filter.appendChild(cm);
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
    return fetch(u, { signal: signal }).then(function (r) {
      if (!r.ok) throw new Error("HTTP " + r.status + ": " + url);
      return r.json();
    });
  }

  function fetchText(url) {
    var u = url + (url.indexOf("?") >= 0 ? "&" : "?") + "t=" + Date.now();
    return fetch(u).then(function (r) {
      if (!r.ok) throw new Error("HTTP " + r.status + ": " + url);
      return r.text();
    });
  }

  var _loaded = { css: {}, js: {} };

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
          resolve();
        };
        s.onerror = function () {
          URL.revokeObjectURL(blobUrl);
          reject(new Error("Script load failed: " + url));
        };
        document.head.appendChild(s);
      });
    }).then(function () {
      _loaded.js[key] = true;
    });
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
  ui.drawerTitleEl.textContent = loc.name || loc.id || "Location";
  ui.drawerContentEl.innerHTML =
    '<div class="cc-block"><div class="cc-h">Description</div><p>' + (loc.description || "No description.") + '</p></div>' +
    '<div class="cc-block"><div class="cc-h">Danger</div>' + meterBar(loc.danger || 0, 6, "#ff4444") + '</div>' +
    '<div class="cc-block"><div class="cc-h">Population</div>' + meterBar(loc.population || 0, 6, "#4caf50") + '</div>' +
    (loc.atmosphere ? '<div class="cc-block"><div class="cc-h">Atmosphere</div><p style="font-style:italic;color:#aaa">"' + loc.atmosphere + '"</p></div>' : '') +
    '<div style="display:flex;flex-wrap:wrap;gap:.5rem">' +
    (loc.features || []).map(function (f) {
      return '<span style="padding:4px 10px;background:rgba(255,117,24,.2);border:1px solid rgba(255,117,24,.4);border-radius:4px;font-size:.85rem">' + f + '</span>';
    }).join("") +
    "</div>";

  ui.drawerEl.scrollTop = 0;
}
  // ═══════════════════════════════════════════════════════════════
  // SAFE RANGE MATH
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
    if (half >= imageW / 2) return { min: imageW / 2, max: imageW / 2 };
    return { min: half, max: imageW - half };
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

    ensureLensFilter();
    if (IS_SAFARI) root.classList.add("cc-safari");

    if (!document.getElementById("cc-map-keyframes")) {
      var ks = document.createElement("style");
      ks.id = "cc-map-keyframes";
      ks.textContent =
        "@keyframes cc-spin {0%{transform:rotate(0deg)}100%{transform:rotate(360deg)}}" +
        "@keyframes cc-pulse {0%,100%{opacity:.6}50%{opacity:1}}";
      document.head.appendChild(ks);
    }

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

    var mapEl = el("div", { id: "cc-cm-map", class: "cc-cm-map" });

    var lensMapEl = el("div", {
      id: "cc-lens-map",
      style: "width:100%;height:100%;pointer-events:auto;"
    });

    var lensInner = el("div", {
      class: "cc-lens-inner",
      style: "pointer-events:auto;"
    }, [
      el("div", { class: "cc-lens-overscan", style: "pointer-events:auto;" }, [lensMapEl])
    ]);

    var lensEl = el("div", { class: "cc-lens", style: "overflow:hidden;" }, [
      lensInner,
      el("div", { class: "cc-lens-chromatic", style: "pointer-events:none;" }),
      el("div", { class: "cc-lens-glare", style: "pointer-events:none;" })
    ]);

    var loaderEl = el("div", {
      id: "cc-map-loader",
      style: [
        "position:absolute;inset:0;z-index:200;",
        "display:flex;flex-direction:column;align-items:center;justify-content:center;",
        "background:rgba(0,0,0,.92);",
        "transition:opacity .5s ease;"
      ].join("")
    }, [
      el("img", {
        src: opts.logoUrl,
        alt: "Coffin Canyon",
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
      }, ["Loading…"])
    ]);

    var header = el("div", { class: "cc-cm-header cc-app-header" }, [
      el("div", { class: "cc-cm-title" }, [opts.title]),
      el("div", { class: "cc-cm-actions" }, [
        el("button", { class: "cc-btn", id: "cc-cm-reload" }, ["Reload"]),
        el("button", { class: "cc-btn", id: "cc-cm-fit" }, ["Fit"]),
        el("button", { class: "cc-btn", id: "cc-cm-edit" }, ["Edit Hitboxes"]),
        el("button", { class: "cc-btn", id: "cc-cm-export" }, ["Export"])
      ])
    ]);

    var drawer = el("div", { class: "cc-slide-panel", id: "cc-location-panel" }, [
  el("div", { class: "cc-slide-panel-header" }, [
    el("h2", { class: "cc-cm-drawer-title" }, ["Location"]),
    el("button", { class: "cc-panel-close-btn", id: "close-dr", type: "button" }, ["×"])
  ]),
  el("div", { class: "cc-cm-drawer-content" })
]);
    var body = el("div", { class: "cc-cm-body cc-cm-body--lens" }, [
      el("div", { class: "cc-cm-mapwrap" }, [
        mapEl,
        lensEl,
        loaderEl,
        el("div", { class: "cc-frame-overlay", style: "pointer-events:none;" }, [
          el("img", {
            class: "cc-frame-image",
            src: opts.frameUrl,
            alt: "",
            draggable: "false"
          })
        ]),
        el("div", { class: "cc-scroll-vertical", id: "cc-scroll-track-v" }, [
          el("div", { class: "cc-scroll-knob", id: "cc-scroll-knob-v" }, [
            el("img", {
              src: "https://raw.githubusercontent.com/steamcrow/coffin/main/apps/app_canyon_map/data/blappo_knob.png",
              alt: "",
              draggable: "false",
              class: "cc-scroll-knob-img"
            })
          ])
        ]),
        el("div", { class: "cc-scroll-horizontal", id: "cc-scroll-track-h" }, [
          el("div", { class: "cc-scroll-knob", id: "cc-scroll-knob-h" }, [
            el("img", {
              src: "https://raw.githubusercontent.com/steamcrow/coffin/main/apps/app_canyon_map/data/blappo_knob.png",
              alt: "",
              draggable: "false",
              class: "cc-scroll-knob-img"
            })
          ])
        ])
      ])
    ]);

    root.appendChild(header);
    root.appendChild(body);
    root.appendChild(drawer);

    function updateResponsiveScale() {
      var wrap = root.querySelector(".cc-cm-mapwrap");
      if (!wrap) return;
      var designWidth = 1280;
      var currentWidth = wrap.getBoundingClientRect().width || wrap.offsetWidth || designWidth;
      var scale = Math.max(0.62, Math.min(1, currentWidth / designWidth));
      root.style.setProperty("--device-scale", scale.toFixed(4));
    }

    updateResponsiveScale();

    var ui = {
      mapEl: mapEl,
      lensMapEl: lensMapEl,
      lensEl: lensEl,
      drawerEl: drawer,
      drawerTitleEl: drawer.querySelector(".cc-cm-drawer-title"),
      drawerContentEl: drawer.querySelector(".cc-cm-drawer-content"),
      knobV: root.querySelector("#cc-scroll-knob-v"),
      knobH: root.querySelector("#cc-scroll-knob-h"),
      trackV: root.querySelector("#cc-scroll-track-v"),
      trackH: root.querySelector("#cc-scroll-track-h"),
      _hbEditor: null
    };

    function primeKnobs() {
      var wrap = root.querySelector(".cc-cm-mapwrap");
      var frame = root.querySelector(".cc-frame-overlay");
      var trackV = ui.trackV;
      var trackH = ui.trackH;
      var knobV = ui.knobV;
      var knobH = ui.knobH;
      var knobImgs = root.querySelectorAll(".cc-scroll-knob-img");

      if (wrap) {
        wrap.style.position = "relative";
        wrap.style.overflow = "hidden";
      }

      if (frame) {
        frame.style.position = "absolute";
        frame.style.inset = "0";
        frame.style.zIndex = "50";
        frame.style.pointerEvents = "none";
        frame.style.display = "flex";
      }

      if (trackV) {
        trackV.style.position = "absolute";
        trackV.style.top = "0";
        trackV.style.right = "0";
        trackV.style.width = "calc(88px * var(--device-scale, 1))";
        trackV.style.height = "100%";
        trackV.style.zIndex = "60";
        trackV.style.pointerEvents = "auto";
        trackV.style.display = "block";
      }

      if (trackH) {
        trackH.style.position = "absolute";
        trackH.style.left = "0";
        trackH.style.bottom = "0";
        trackH.style.width = "100%";
        trackH.style.height = "calc(88px * var(--device-scale, 1))";
        trackH.style.zIndex = "60";
        trackH.style.pointerEvents = "auto";
        trackH.style.display = "block";
      }

      if (knobV) {
        knobV.style.position = "absolute";
        knobV.style.zIndex = "61";
        knobV.style.display = "block";
        knobV.style.pointerEvents = "auto";
        knobV.style.cursor = "grab";
        knobV.style.touchAction = "none";
      }

      if (knobH) {
        knobH.style.position = "absolute";
        knobH.style.zIndex = "61";
        knobH.style.display = "block";
        knobH.style.pointerEvents = "auto";
        knobH.style.cursor = "grab";
        knobH.style.touchAction = "none";
      }

      Array.prototype.forEach.call(knobImgs, function (img) {
        img.style.display = "block";
        img.style.width = "100%";
        img.style.height = "100%";
        img.style.objectFit = "contain";
        img.style.pointerEvents = "none";
        img.style.userSelect = "none";
        img.style.webkitUserDrag = "none";
        img.style.filter = "drop-shadow(0 4px 8px rgba(0,0,0,0.6))";
      });
    }

    primeKnobs();

    function blockWheelZoom(targetEl) {
      targetEl.addEventListener("wheel", function (e) {
        e.preventDefault();
      }, { passive: false });
    }

    blockWheelZoom(ui.mapEl);
    blockWheelZoom(ui.lensMapEl);

    function createHitboxEditor(rootEl, uiObj) {
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
        uiObj.mapEl.appendChild(state.editorEl);
        return state.editorEl;
      }

      function rectFromHitbox(b) {
        return { y1: b[0], x1: b[1], y2: b[2], x2: b[3] };
      }

      function hitboxFromRect(r) {
        return [Math.round(r.y1), Math.round(r.x1), Math.round(r.y2), Math.round(r.x2)];
      }

      function latLngToPx(lat, lng) {
        var pt = state.mainMap.latLngToContainerPoint(window.L.latLng(lat, lng));
        return { x: pt.x, y: pt.y };
      }

      function drawBoxes() {
        if (!state.editing || !state.mainMap || !state.px) return;
        var layer = ensureEditorLayer();
        layer.innerHTML = "";

        Object.keys(HITBOXES).forEach(function (id) {
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
      }

      function updateHitboxFromBox(box) {
        var id = box.dataset.id;
        var left = parseFloat(box.style.left);
        var top = parseFloat(box.style.top);
        var width = parseFloat(box.style.width);
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
          state.active.box.style.top = Math.round(state.active.top + dy) + "px";
        } else {
          state.active.box.style.width = Math.max(6, Math.round(state.active.width + dx)) + "px";
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
  var lines = keys.map(function (k) {
    return '  "' + k + '": [' + HITBOXES[k].join(", ") + ']';
  });

  var text = "var HITBOXES = {\n" + lines.join(",\n") + "\n};";

  window.prompt("Copy HITBOXES:", text);
}
      }

      function setEditing(on) {
        state.editing = on;
        rootEl.classList.toggle("cc-hitbox-edit", on);

        if (!on) {
          if (state.editorEl) state.editorEl.style.display = "none";
          if (state.mainMap) state.mainMap.off("move zoom resize", drawBoxes);
          return;
        }

        if (!state.mainMap || !state.px) return;

        state.mainMap.fitBounds([[0, 0], [state.px.h, state.px.w]], {
        animate: false,
        padding: [20, 20]
         });

        ensureEditorLayer().style.display = "block";
        drawBoxes();
        state.mainMap.on("move zoom resize", drawBoxes);
      }

      function bindOnce() {
        if (state.bound) return;
        state.bound = true;
        uiObj.mapEl.addEventListener("pointerdown", onPointerDown);
        window.addEventListener("pointermove", onPointerMove, { passive: false });
        window.addEventListener("pointerup", onPointerUp);
      }

      bindOnce();

      return {
        attach: function (mainMapInstance, px) {
          state.mainMap = mainMapInstance;
          state.px = px;
          if (state.editing) setEditing(true);
        },
        toggle: function () { setEditing(!state.editing); },
        export: function () { if (state.editing) exportHitboxes(); }
      };
    }

    ui._hbEditor = createHitboxEditor(root, ui);

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
      }, 520);
    }

    var depsReady = loadCssOnce(opts.leafletCssUrl, "leaflet_css")
      .then(function () { return loadScriptOnce(opts.leafletJsUrl, "leaflet_js"); })
      .then(function () { return loadCssOnce(opts.appCssUrl, "app_css"); });

    var mainMap = null;
    var lensMap = null;
    var mapDoc = null;
    var locationsData = null;
    var currentT = 0.5;
    var currentTx = 0.5;

    function applyT(t, px) {
      if (!mainMap || !lensMap || !px) return;
      t = clamp(t, 0, 1);
      currentT = t;

      var lensZoom = BG_ZOOM + opts.lensZoomOffset;
      var tx = currentTx;

      var bgRy = safeRange(ui.mapEl, BG_ZOOM, px.h);
      var bgRx = safeRangeX(ui.mapEl, BG_ZOOM, px.w);
      mainMap.panTo(
        [
          bgRy.min + t * (bgRy.max - bgRy.min),
          bgRx.min + tx * (bgRx.max - bgRx.min)
        ],
        { animate: false }
      );

      var lnRy = safeRange(ui.lensMapEl, lensZoom, px.h);
      var lnRx = safeRangeX(ui.lensMapEl, lensZoom, px.w);
      lensMap.setView(
        [
          lnRy.min + t * (lnRy.max - lnRy.min),
          lnRx.min + tx * (lnRx.max - lnRx.min)
        ],
        lensZoom,
        { animate: false }
      );

      var V_MIN = 30;
      var V_MAX = 70;
      var H_MIN = 16;
      var H_MAX = 84;

      var knobVTop = V_MIN + t * (V_MAX - V_MIN);
      var knobHLeft = H_MIN + tx * (H_MAX - H_MIN);

      ui.knobV.style.top = knobVTop + "%";
      ui.knobV.style.left = "calc(50% - (64px * var(--device-scale, 1)))";

      ui.knobH.style.left = knobHLeft + "%";
      ui.knobH.style.top = "calc(50% - (185px * var(--device-scale, 1)))";
    }

    function applyTx(tx, px) {
      currentTx = clamp(tx, 0, 1);
      applyT(currentT, px);
    }

    var knobbsBound = false;

    function bindKnobs(px) {
      if (knobbsBound) return;
      knobbsBound = true;

      function bindKnob(knobEl, axis) {
        var dragging = false;
        var lastTime = 0;
        var velocity = 0;
        var rafId = null;
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

        function trackPx() {
          var r = getTrackRect();
          return (axis === "v" ? r.height : r.width) || 1;
        }

        function rangeForAxis() {
          if (axis === "v") return { min: 30, max: 70 };
          return { min: 16, max: 84 };
        }

        function posToNormalized(trackPosPx) {
          var range = rangeForAxis();
          var pct = (trackPosPx / trackPx()) * 100;
          var n = (pct - range.min) / (range.max - range.min);
          return clamp(n, 0, 1);
        }

        function momentumLoop() {
          if (Math.abs(velocity) < MIN_VEL) {
            rafId = null;
            return;
          }
          if (axis === "v") applyT(currentT + velocity, px);
          else applyTx(currentTx + velocity, px);
          velocity *= FRICTION;
          rafId = requestAnimationFrame(momentumLoop);
        }

        function onDown(e) {
          if (rafId) {
            cancelAnimationFrame(rafId);
            rafId = null;
          }

          var trackRect = getTrackRect();
          var knobRect = getKnobRect();
          var client = getClient(e);

          dragging = true;
          velocity = 0;
          lastTime = performance.now();

          if (axis === "v") {
            grabOffset = client - knobRect.top;
          } else {
            grabOffset = client - knobRect.left;
          }

          knobEl.classList.add("is-active");
          knobEl.style.cursor = "grabbing";

          e.stopPropagation();
          e.preventDefault();
        }

        function onMove(e) {
          if (!dragging) return;

          var now = performance.now();
          var trackRect = getTrackRect();
          var client = getClient(e);
          var trackPos;

          if (axis === "v") {
            trackPos = client - trackRect.top - grabOffset;
          } else {
            trackPos = client - trackRect.left - grabOffset;
          }

          var nextNormalized = posToNormalized(trackPos);
          var prevNormalized = axis === "v" ? currentT : currentTx;
          var dt = Math.max(now - lastTime, 1);
          var dT = nextNormalized - prevNormalized;

          if (axis === "v") applyT(nextNormalized, px);
          else applyTx(nextNormalized, px);

          velocity = dT / dt * 16;
          lastTime = now;
          e.preventDefault();
        }

        function onUp() {
          if (!dragging) return;
          dragging = false;
          knobEl.classList.remove("is-active");
          knobEl.style.cursor = "grab";
          rafId = requestAnimationFrame(momentumLoop);
        }

        knobEl.addEventListener("mousedown", onDown);
        knobEl.addEventListener("touchstart", onDown, { passive: false });
        window.addEventListener("mousemove", onMove);
        window.addEventListener("touchmove", onMove, { passive: false });
        window.addEventListener("mouseup", onUp);
        window.addEventListener("touchend", onUp);
      }

      bindKnob(ui.knobV, "v");
      bindKnob(ui.knobH, "h");

      window.addEventListener("resize", rafThrottle(function () {
        updateResponsiveScale();
        try { if (mainMap) mainMap.invalidateSize({ animate: false }); } catch (e) {}
        try { if (lensMap) lensMap.invalidateSize({ animate: false }); } catch (e) {}
        if (mapDoc) applyT(currentT, mapDoc.map.background.image_pixel_size);
        primeKnobs();
      }));
    }

    function init() {
      root.classList.remove("cc-ready");
      root.classList.add("cc-loading");

      showLoader();
      var loadStart = Date.now();
      var signal = newSession();

      return depsReady
        .then(function () {
          return Promise.all([
            fetchJson(opts.mapUrl, signal),
            fetchJson(opts.stateUrl, signal),
            fetchJson(opts.locationsUrl, signal)
          ]);
        })
        .then(function (results) {
          mapDoc = results[0];
          locationsData = results[2];

          try { if (mainMap) mainMap.remove(); } catch (e) {}
          try { if (lensMap) lensMap.remove(); } catch (e) {}

          updateResponsiveScale();
          primeKnobs();

          var px = mapDoc.map.background.image_pixel_size;
          var bounds = [[0, 0], [px.h, px.w]];

          mainMap = window.L.map(ui.mapEl, {
            crs: window.L.CRS.Simple,
            minZoom: -3,
            maxZoom: 2,
            dragging: false,
            zoomControl: false,
            attributionControl: false,
            scrollWheelZoom: false,
            doubleClickZoom: false,
            touchZoom: false,
            boxZoom: false,
            keyboard: false
          });

          window.L.imageOverlay(mapDoc.map.background.image_key, bounds).addTo(mainMap);
          mainMap.setView([px.h / 2, px.w / 2], BG_ZOOM, { animate: false });

          if (ui._hbEditor) ui._hbEditor.attach(mainMap, px);

          var lensUrl = (mapDoc.map.lens && mapDoc.map.lens.image_key)
            ? mapDoc.map.lens.image_key
            : mapDoc.map.background.image_key;

          lensMap = window.L.map(ui.lensMapEl, {
            crs: window.L.CRS.Simple,
            dragging: false,
            zoomControl: false,
            attributionControl: false,
            scrollWheelZoom: false,
            doubleClickZoom: false,
            touchZoom: false,
            boxZoom: false,
            keyboard: false
          });

          lensMap.dragging.disable();
          lensMap.doubleClickZoom.disable();
          lensMap.scrollWheelZoom.disable();
          lensMap.boxZoom.disable();
          lensMap.keyboard.disable();

          window.L.imageOverlay(lensUrl, bounds).addTo(lensMap);

         locationsData.locations.forEach(function (loc) {
  var bbox = HITBOXES[loc.id];
  if (!bbox) {
    console.warn("Missing hitbox for:", loc.id, loc.name);
    return;
  }

  var rect = window.L.rectangle(
    [[bbox[0], bbox[1]], [bbox[2], bbox[3]]],
    {
      color: "#ff7518",
      fillOpacity: 0.12,
      weight: 2,
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
    if (window.L && window.L.DomEvent) {
      window.L.DomEvent.stop(e);
    }
    renderDrawer(ui, loc);
    ui.drawerEl.classList.add("cc-slide-panel-open");
  });

  rect.on("touchstart", function (e) {
    if (window.L && window.L.DomEvent) {
      window.L.DomEvent.stop(e);
    }
    renderDrawer(ui, loc);
    ui.drawerEl.classList.add("cc-slide-panel-open");
  });
});

          bindKnobs(px);
          primeKnobs();

          setTimeout(function () {
            primeKnobs();
            console.log("Knobs primed.", ui.knobV, ui.knobH);
          }, 1000);

          return nextFrame()
            .then(function () {
              try { mainMap.invalidateSize({ animate: false }); } catch (e) {}
              try { lensMap.invalidateSize({ animate: false }); } catch (e) {}
              return nextFrame();
            })
            .then(function () {
              try { mainMap.invalidateSize({ animate: false }); } catch (e) {}
              try { lensMap.invalidateSize({ animate: false }); } catch (e) {}

              currentT = 0.5;
              currentTx = 0.5;
              applyT(0.5, px);

              ui.lensMapEl.style.pointerEvents = "auto";

              var lc = ui.lensMapEl.querySelector(".leaflet-container");
              if (lc) lc.style.pointerEvents = "auto";

              var inner = ui.lensMapEl.closest(".cc-lens-inner");
              if (inner) inner.style.pointerEvents = "auto";

              primeKnobs();

              var elapsed = Date.now() - loadStart;
              return delay(Math.max(0, MIN_LOADER_MS - elapsed));
            });
        })
        .then(function () {
          hideLoader();
          primeKnobs();
        })
        .catch(function (err) {
          if (err && err.name === "AbortError") return;
          console.error("Canyon Map init failed:", err);
          hideLoader();
          ui.drawerContentEl.innerHTML =
            '<div style="color:#f55;padding:1rem">Load failed: ' +
            (err && err.message) +
            "</div>";
          ui.drawerEl.classList.add("cc-slide-panel-open");
        });
    }

    root.querySelector("#cc-cm-reload").onclick = function () { init(); };
    root.querySelector("#close-dr").onclick = function () { ui.drawerEl.classList.remove("cc-slide-panel-open"); };
    root.querySelector("#cc-cm-fit").onclick = function () {
      if (mapDoc) {
        currentTx = 0.5;
        applyT(0.5, mapDoc.map.background.image_pixel_size);
        primeKnobs();
      }
    };
    root.querySelector("#cc-cm-edit").onclick = function () {
      if (ui._hbEditor) ui._hbEditor.toggle();
    };
    root.querySelector("#cc-cm-export").onclick = function () {
      if (ui._hbEditor) ui._hbEditor.export();
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
