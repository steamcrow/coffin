/* File: apps/app_canyon_map/cc_canyon_map_app.js
   Coffin Canyon — Canyon Map V2
*/

(function () {
  var DEFAULTS = {
    title: "Coffin Canyon — Canyon Map",
    mapUrl: "https://raw.githubusercontent.com/steamcrow/coffin/main/apps/app_canyon_map/data/canyon_map.json",
    locationsUrl: "https://raw.githubusercontent.com/steamcrow/coffin/main/data/src/170_named_locations.json",
    leafletCssUrl: "https://raw.githubusercontent.com/steamcrow/coffin/main/vendor/leaflet/leaflet.css",
    leafletJsUrl: "https://raw.githubusercontent.com/steamcrow/coffin/main/vendor/leaflet/leaflet.js",
    logoUrl: "https://raw.githubusercontent.com/steamcrow/coffin/main/assets/logos/coffin_canyon_logo.png",
    frameUrl: "https://raw.githubusercontent.com/steamcrow/coffin/main/apps/app_canyon_map/data/mag_frame2.png",
    knobUrl: "https://raw.githubusercontent.com/steamcrow/coffin/main/apps/app_canyon_map/data/blappo_knob.png"
  };

  var HITBOXES = window.CC_HITBOXES || {};

  var _loaded = { css: {}, js: {} };

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

  function ensureLeaflet(opts) {
    if (window.L) return Promise.resolve();
    return loadCssOnce(opts.leafletCssUrl, "leaflet_css")
      .then(function () { return loadScriptOnce(opts.leafletJsUrl, "leaflet_js"); });
  }

  function ensureBaseStyles(opts) {
    if (document.getElementById("cc-canyon-map-v2-inline-styles")) return;

    var s = document.createElement("style");
    s.id = "cc-canyon-map-v2-inline-styles";
    s.textContent = [
      ".cc-canyon-map{position:relative;}",
      ".cc-cm-shell{display:flex;flex-direction:column;gap:12px;}",
      ".cc-cm-header{display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap;}",
      ".cc-cm-title{font-weight:700;letter-spacing:.02em;}",
      ".cc-cm-actions{display:flex;gap:8px;flex-wrap:wrap;}",
      ".cc-cm-mapwrap{position:relative;width:100%;height:85vh;min-height:520px;background:#0d0b0a;border:12px solid #4a3728;border-radius:12px;overflow:hidden;isolation:isolate;}",
      ".cc-map-root{position:absolute;inset:0;z-index:1;}",
      ".cc-map-frame{position:absolute;inset:0;z-index:50;pointer-events:none;display:flex;align-items:center;justify-content:center;}",
      ".cc-map-frame-img{max-width:100%;height:auto;display:block;pointer-events:none;}",
      ".cc-knob-v,.cc-knob-h{position:absolute;width:48px;height:48px;z-index:60;pointer-events:none;background:url('" + opts.knobUrl + "') center/contain no-repeat;filter:drop-shadow(0 4px 10px rgba(0,0,0,.7));}",
      ".cc-knob-v{right:18px;top:50%;transform:translateY(-50%);}",
      ".cc-knob-h{bottom:18px;left:50%;transform:translateX(-50%) rotate(-90deg);}",
      ".cc-map-hitbox-label{background:rgba(0,0,0,.82)!important;border:1px solid rgba(255,117,24,.72)!important;color:#fff!important;font-size:10px!important;font-weight:700!important;line-height:1.05!important;padding:2px 5px!important;border-radius:4px!important;text-align:center!important;max-width:88px!important;white-space:normal!important;word-break:break-word!important;pointer-events:none!important;box-shadow:0 1px 4px rgba(0,0,0,.4)!important;}",
      ".cc-map-hitbox-label:before{display:none!important;}",
      ".leaflet-interactive{transition:stroke .18s ease,stroke-width .18s ease,fill-opacity .18s ease,filter .18s ease;}",
      ".cc-hitbox-hover{stroke:#ffd28c!important;stroke-width:3!important;fill-opacity:.22!important;filter:drop-shadow(0 0 8px rgba(255,117,24,.65));}",
      ".cc-hitbox-active{stroke:#fff0c2!important;stroke-width:3!important;fill-opacity:.26!important;filter:drop-shadow(0 0 10px rgba(255,180,80,.75));}",
      ".cc-hitbox-editor-layer{position:absolute;inset:0;z-index:70;pointer-events:none;}",
      ".cc-hitbox-editor-badge{position:absolute;left:10px;bottom:10px;z-index:71;background:rgba(0,0,0,.72);color:#fff;padding:6px 10px;border-radius:6px;font-size:12px;pointer-events:none;}",
      ".cc-cm-loader{position:absolute;inset:0;z-index:80;display:flex;align-items:center;justify-content:center;flex-direction:column;gap:14px;background:rgba(0,0,0,.88);transition:opacity .3s ease;}",
      ".cc-cm-loader img{width:280px;max-width:72vw;filter:drop-shadow(0 0 22px rgba(255,117,24,.35));}",
      ".cc-cm-loader-spin{width:42px;height:42px;border:4px solid rgba(255,117,24,.2);border-top-color:#ff7518;border-radius:50%;animation:cc-cm-spin 1s linear infinite;}",
      "@keyframes cc-cm-spin{to{transform:rotate(360deg)}}",
      ".cc-cm-mapwrap.cc-map-focus .cc-map-frame-img{transform:scale(1.01);filter:drop-shadow(0 0 12px rgba(255,117,24,.18));transition:transform .2s ease,filter .2s ease;}",
      ".cc-cm-mapwrap.cc-map-focus .cc-knob-v,.cc-cm-mapwrap.cc-map-focus .cc-knob-h{filter:drop-shadow(0 0 10px rgba(255,117,24,.35)) drop-shadow(0 4px 10px rgba(0,0,0,.7));}",
      "@media (max-width:900px){.cc-cm-mapwrap{height:72vh;min-height:420px}.cc-knob-v,.cc-knob-h{width:36px;height:36px}.cc-map-hitbox-label{font-size:9px!important;max-width:72px!important}}"
    ].join("");
    document.head.appendChild(s);
  }

  function nextFrame() {
    return new Promise(function (resolve) { requestAnimationFrame(resolve); });
  }

  function meterBar(value, max, color) {
    var pct = Math.round(clamp(value || 0, 0, max) / max * 100);
    return '<div style="width:100%;height:22px;background:rgba(255,255,255,.08);border-radius:11px;overflow:hidden;position:relative;border:1px solid rgba(255,255,255,.12)">' +
      '<div style="height:100%;width:' + pct + '%;background:' + color + ';transition:width .25s"></div>' +
      '<div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;color:#fff;font-weight:700;font-size:.8rem">' + (value || 0) + ' / ' + max + '</div></div>';
  }

  function renderDrawer(ui, loc) {
    ui.title.textContent = loc.name || loc.id || "Location";
    ui.body.innerHTML =
      '<div class="cc-block"><div class="cc-h">Description</div><p>' + (loc.description || "No description.") + '</p></div>' +
      '<div class="cc-block"><div class="cc-h">Danger</div>' + meterBar(loc.danger || 0, 6, "#ff4444") + '</div>' +
      '<div class="cc-block"><div class="cc-h">Population</div>' + meterBar(loc.population || 0, 6, "#4caf50") + '</div>' +
      (loc.atmosphere ? '<div class="cc-block"><div class="cc-h">Atmosphere</div><p style="font-style:italic;color:#aaa">' + loc.atmosphere + '</p></div>' : '') +
      '<div style="display:flex;flex-wrap:wrap;gap:.5rem">' +
      (loc.features || []).map(function (f) {
        return '<span style="padding:4px 10px;background:rgba(255,117,24,.2);border:1px solid rgba(255,117,24,.4);border-radius:4px;font-size:.85rem">' + f + '</span>';
      }).join("") +
      "</div>";

    ui.panel.classList.add("cc-slide-panel-open");
    ui.body.scrollTop = 0;
  }

  function createInternalHitboxEditor(map, hitboxes, ui) {
    var layer = window.L.layerGroup().addTo(map);
    var active = null;
    var enabled = false;
    var boxMap = {};

    function makeText() {
      return Object.keys(hitboxes).sort().reduce(function (out, id) {
        out[id] = (hitboxes[id] || []).map(function (n) { return Math.round(n); });
        return out;
      }, {});
    }

    function exportJSON() {
      var json = JSON.stringify(makeText(), null, 2);
      window.prompt("Copy HITBOXES JSON:", json);
    }

    function clear() {
      layer.clearLayers();
      boxMap = {};
    }

    function draw() {
      clear();
      if (!enabled) return;

      Object.keys(hitboxes).sort().forEach(function (id) {
        var b = hitboxes[id];
        if (!b || b.length !== 4) return;

        var rect = window.L.rectangle(
          [[b[0], b[1]], [b[2], b[3]]],
          {
            color: "#00ffff",
            weight: 2,
            fillOpacity: 0.08,
            interactive: true
          }
        ).addTo(layer);

        rect.bindTooltip(id, {
          permanent: true,
          direction: "center",
          className: "cc-map-hitbox-label",
          opacity: 0.95
        });

        rect._hbId = id;
        boxMap[id] = rect;

        rect.on("mousedown", startMove);
        rect.on("touchstart", startMove);
      });

      if (ui.editorBadgeEl) {
        ui.editorBadgeEl.style.display = enabled ? "block" : "none";
      }
    }

    function startMove(e) {
      if (!enabled) return;
      if (window.L && window.L.DomEvent) window.L.DomEvent.stop(e);

      active = {
        id: e.target._hbId,
        start: e.latlng
      };

      map.on("mousemove", move);
      map.on("mouseup", endMove);
      map.on("touchmove", move);
      map.on("touchend", endMove);
    }

    function move(e) {
      if (!enabled || !active) return;

      var id = active.id;
      var b = hitboxes[id];
      if (!b) return;

      var dy = e.latlng.lat - active.start.lat;
      var dx = e.latlng.lng - active.start.lng;

      hitboxes[id] = [
        b[0] + dy,
        b[1] + dx,
        b[2] + dy,
        b[3] + dx
      ];

      active.start = e.latlng;
      draw();
    }

    function endMove() {
      active = null;
      map.off("mousemove", move);
      map.off("mouseup", endMove);
      map.off("touchmove", move);
      map.off("touchend", endMove);
    }

    function fitWholeMap(bounds) {
      map.fitBounds(bounds, { animate: false, padding: [20, 20] });
    }

    return {
      enable: function (bounds) {
        enabled = true;
        draw();
        if (bounds) fitWholeMap(bounds);
      },
      disable: function () {
        enabled = false;
        draw();
      },
      toggle: function (bounds) {
        enabled = !enabled;
        draw();
        if (enabled && bounds) fitWholeMap(bounds);
      },
      exportJSON: exportJSON,
      refresh: draw,
      isEnabled: function () { return enabled; }
    };
  }

  function buildHitboxes(map, locations, ui) {
    var activeRect = null;
    var activeTooltipEl = null;

    function clearActive() {
      if (activeRect) {
        activeRect.setStyle({
          color: "#ff7518",
          weight: 2,
          fillOpacity: 0.15
        });
        if (activeRect._path) {
          activeRect._path.classList.remove("cc-hitbox-active");
          activeRect._path.classList.remove("cc-hitbox-hover");
        }
      }

      if (activeTooltipEl) {
        activeTooltipEl.classList.remove("cc-label-active");
        activeTooltipEl.classList.remove("cc-label-hover");
      }

      activeRect = null;
      activeTooltipEl = null;
      if (ui.mapWrapEl) ui.mapWrapEl.classList.remove("cc-map-focus");
    }

    function setHover(rect, on) {
      if (!rect || !rect._path) return;
      if (rect === activeRect) return;

      rect._path.classList.toggle("cc-hitbox-hover", !!on);

      var tip = rect.getTooltip() && rect.getTooltip().getElement ? rect.getTooltip().getElement() : null;
      if (tip) tip.classList.toggle("cc-label-hover", !!on);
    }

    function setActive(rect) {
      clearActive();

      activeRect = rect;
      rect.setStyle({
        color: "#fff0c2",
        weight: 3,
        fillOpacity: 0.26
      });

      if (rect._path) rect._path.classList.add("cc-hitbox-active");

      var tip = rect.getTooltip() && rect.getTooltip().getElement ? rect.getTooltip().getElement() : null;
      if (tip) {
        tip.classList.add("cc-label-active");
        activeTooltipEl = tip;
      }

      if (ui.mapWrapEl) ui.mapWrapEl.classList.add("cc-map-focus");
    }

    locations.forEach(function (loc) {
      var box = HITBOXES[loc.id];
      if (!box || box.length !== 4) return;

      var rect = window.L.rectangle(
        [[box[0], box[1]], [box[2], box[3]]],
        {
          color: "#ff7518",
          weight: 2,
          fillOpacity: 0.15,
          interactive: true
        }
      ).addTo(map);

      rect.bindTooltip(loc.name || loc.id, {
        permanent: true,
        direction: "center",
        className: "cc-map-hitbox-label",
        opacity: 0.95
      });

      rect.on("mouseover", function () { setHover(rect, true); });
      rect.on("mouseout", function () { setHover(rect, false); });

      rect.on("click", function (e) {
        if (window.L && window.L.DomEvent) window.L.DomEvent.stop(e);
        renderDrawer(ui, loc);
        setActive(rect);
      });

      rect.on("touchstart", function (e) {
        if (window.L && window.L.DomEvent) window.L.DomEvent.stop(e);
        renderDrawer(ui, loc);
        setActive(rect);
      });
    });

    if (ui.closeBtnEl) {
      ui.closeBtnEl.addEventListener("click", clearActive);
    }

    return {
      clearActive: clearActive
    };
  }

  function attachKnobs(map, frame) {
    var knobV = frame.querySelector(".cc-knob-v");
    var knobH = frame.querySelector(".cc-knob-h");

    function update() {
      var center = map.getCenter();
      var p = map.project(center, map.getZoom());

      var x = clamp((p.x / 4000) * 100, 6, 94);
      var y = clamp((p.y / 4000) * 100, 6, 94);

      knobV.style.top = y + "%";
      knobH.style.left = x + "%";
    }

    map.on("move zoom", update);
    nextFrame().then(update);
  }

  function showLoader(loaderEl) {
    loaderEl.style.display = "flex";
    loaderEl.style.opacity = "1";
  }

  function hideLoader(loaderEl) {
    loaderEl.style.opacity = "0";
    setTimeout(function () {
      loaderEl.style.display = "none";
    }, 320);
  }

  function mount(root, userOpts) {
    var opts = Object.assign({}, DEFAULTS, userOpts || {});

    ensureBaseStyles(opts);

    return ensureLeaflet(opts).then(function () {
      root.innerHTML = "";
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

      var mapWrap = el("div", { class: "cc-cm-mapwrap" }, []);
      var mapEl = el("div", { class: "cc-map-root", id: "cc-cm-map" });
      var frame = el("div", { class: "cc-map-frame" }, [
        el("img", { class: "cc-map-frame-img", src: opts.frameUrl, alt: "", draggable: "false" }),
        el("div", { class: "cc-knob-v" }),
        el("div", { class: "cc-knob-h" })
      ]);

      var loaderEl = el("div", { class: "cc-cm-loader" }, [
        el("img", { src: opts.logoUrl, alt: "Coffin Canyon" }),
        el("div", { class: "cc-cm-loader-spin" }),
        el("div", { style: "color:#ff7518;font-size:.78rem;letter-spacing:.18em;text-transform:uppercase" }, ["Loading"])
      ]);

      var editorBadgeEl = el("div", { class: "cc-hitbox-editor-badge", style: "display:none" }, [
        "Hitbox edit mode active — drag cyan boxes, then click Export."
      ]);

      mapWrap.appendChild(mapEl);
      mapWrap.appendChild(frame);
      mapWrap.appendChild(loaderEl);
      mapWrap.appendChild(editorBadgeEl);

      var panel = el("div", { class: "cc-slide-panel", id: "cc-location-panel" }, [
        el("div", { class: "cc-slide-panel-header" }, [
          el("h2", { class: "cc-panel-title" }, ["Location"]),
          el("button", { class: "cc-panel-close-btn", id: "cc-panel-close", type: "button" }, ["×"])
        ]),
        el("div", { class: "cc-panel-body" })
      ]);

      shell.appendChild(header);
      shell.appendChild(mapWrap);
      root.appendChild(shell);
      root.appendChild(panel);

      var ui = {
        panel: panel,
        title: panel.querySelector(".cc-panel-title"),
        body: panel.querySelector(".cc-panel-body"),
        mapWrapEl: mapWrap,
        closeBtnEl: panel.querySelector("#cc-panel-close"),
        editorBadgeEl: editorBadgeEl
      };

      var map = null;
      var editor = null;
      var bounds = null;

      showLoader(loaderEl);

      function boot() {
        return Promise.all([
          fetchJson(opts.mapUrl),
          fetchJson(opts.locationsUrl)
        ]).then(function (results) {
          var mapDoc = results[0];
          var locDoc = results[1];
          var px = mapDoc.map.background.image_pixel_size;

          bounds = [[0, 0], [px.h, px.w]];

          if (map) {
            try { map.remove(); } catch (e) {}
            map = null;
          }

          map = window.L.map(mapEl, {
            crs: window.L.CRS.Simple,
            minZoom: -2,
            maxZoom: 2,
            zoomControl: true,
            attributionControl: false
          });

          window.L.imageOverlay(mapDoc.map.background.image_key, bounds).addTo(map);
          map.fitBounds(bounds, { animate: false });

          buildHitboxes(map, locDoc.locations || [], ui);
          attachKnobs(map, frame);

          editor = createInternalHitboxEditor(map, HITBOXES, ui);

          hideLoader(loaderEl);

          return map;
        }).catch(function (err) {
          hideLoader(loaderEl);
          ui.title.textContent = "Load failed";
          ui.body.innerHTML = '<div style="color:#f55;padding:1rem">Load failed: ' + (err && err.message ? err.message : err) + "</div>";
          ui.panel.classList.add("cc-slide-panel-open");
          throw err;
        });
      }

      header.querySelector("#cc-cm-reload").onclick = function () {
        showLoader(loaderEl);
        boot();
      };

      header.querySelector("#cc-cm-fit").onclick = function () {
        if (map && bounds) map.fitBounds(bounds, { animate: false, padding: [20, 20] });
      };

      header.querySelector("#cc-cm-edit").onclick = function () {
        if (!editor) return;
        editor.toggle(bounds);
      };

      header.querySelector("#cc-cm-export").onclick = function () {
        if (!editor) return;
        editor.exportJSON();
      };

      ui.closeBtnEl.onclick = function () {
        ui.panel.classList.remove("cc-slide-panel-open");
        ui.mapWrapEl.classList.remove("cc-map-focus");
      };

      root.addEventListener("click", function (e) {
        if (!ui.panel.classList.contains("cc-slide-panel-open")) return;
        if (ui.panel.contains(e.target)) return;
        if (e.target && (e.target.closest(".leaflet-interactive") || e.target.closest(".leaflet-tooltip"))) return;
        ui.panel.classList.remove("cc-slide-panel-open");
        ui.mapWrapEl.classList.remove("cc-map-focus");
      });

      return boot().then(function () { return {}; });
    });
  }

  window.CC_CanyonMap = { mount: mount };
  window.CC_HITBOXES = HITBOXES;
})();
