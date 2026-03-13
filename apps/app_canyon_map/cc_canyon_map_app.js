/* ================================================================
   COFFIN CANYON — CANYON MAP (COMPLETE REBUILD)
   ================================================================ */

(function () {
  // CONFIGURATION CONSTANTS
  var BG_ZOOM = -1;
  var LENS_ZOOM_OFFSET = 0.95;
  var MIN_LOADER_MS = 1000;

  // Knob Travel Limits (Percentages)
  var V_MIN = 24;
  var V_MAX = 76;
  var H_MIN = 18;
  var H_MAX = 82;

  var DEFAULTS = {
    title: "COFFIN CANYON — MAP SYSTEM",
    mapUrl: "https://raw.githubusercontent.com/steamcrow/coffin/main/apps/app_canyon_map/data/canyon_map.json",
    locationsUrl: "https://raw.githubusercontent.com/steamcrow/coffin/main/data/src/170_named_locations.json",
    logoUrl: "https://raw.githubusercontent.com/steamcrow/coffin/main/assets/logos/coffin_canyon_logo.png",
    frameUrl: "https://raw.githubusercontent.com/steamcrow/coffin/main/apps/app_canyon_map/data/mag_frame3.png",
    knobUrl: "https://raw.githubusercontent.com/steamcrow/coffin/main/apps/app_canyon_map/data/blappo_knob.png"
  };

  // --- UTILITY: ELEMENT BUILDER ---
  function el(tag, attrs, children) {
    var n = document.createElement(tag);
    Object.keys(attrs || {}).forEach(function (k) {
      if (k === "class") n.className = attrs[k];
      else if (k === "style") n.setAttribute("style", attrs[k]);
      else if (k.indexOf("on") === 0) n.addEventListener(k.slice(2).toLowerCase(), attrs[k]);
      else n.setAttribute(k, attrs[k]);
    });
    (children || []).forEach(function (c) {
      if (!c) return;
      n.appendChild(typeof c === "string" ? document.createTextNode(c) : c);
    });
    return n;
  }

  function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

  // --- MAIN APP MOUNT ---
  function mount(root, userOpts) {
    var opts = Object.assign({}, DEFAULTS, userOpts || {});
    root.innerHTML = ""; // Clear root
    root.classList.add("cc-canyon-map", "cc-loading");

    // 1. CREATE UI STRUCTURE
    var loader = el("div", { class: "cc-cm-loader" }, [
      el("img", { src: opts.logoUrl }),
      el("div", { class: "cc-cm-loader-spin" }),
      el("div", { style: "color:#ff7518; font-weight:bold; margin-top:10px;" }, ["INITIALIZING OPTICS..."])
    ]);

    var mapEl = el("div", { class: "cc-cm-map" });
    var lensMapEl = el("div", { class: "cc-lens-map" });
    
    // Knobs with your specific offsets applied via ID-based CSS logic
    var knobV = el("div", { class: "cc-scroll-knob", id: "cc-scroll-knob-v" }, [el("img", { src: opts.knobUrl, class: "cc-scroll-knob-img" })]);
    var knobH = el("div", { class: "cc-scroll-knob", id: "cc-scroll-knob-h" }, [el("img", { src: opts.knobUrl, class: "cc-scroll-knob-img" })]);

    var mapWrap = el("div", { class: "cc-cm-mapwrap" }, [
      mapEl,
      el("div", { class: "cc-lens" }, [
        el("div", { class: "cc-lens-inner" }, [lensMapEl]),
        el("div", { class: "cc-lens-chromatic" }),
        el("div", { class: "cc-lens-glare" })
      ]),
      el("div", { class: "cc-frame-overlay" }, [
        el("img", { src: opts.frameUrl, class: "cc-frame-image" })
      ]),
      el("div", { class: "cc-scroll-vertical" }, [knobV]),
      el("div", { class: "cc-scroll-horizontal" }, [knobH]),
      loader
    ]);

    var header = el("div", { class: "cc-cm-header" }, [
      el("div", { class: "cc-cm-title" }, [opts.title]),
      el("div", { class: "cc-cm-actions" }, [
        el("button", { class: "cc-btn", onclick: function() { location.reload(); } }, ["Reset System"]),
        el("button", { class: "cc-btn", id: "cc-edit-toggle" }, ["Toggle Hitbox Edit"])
      ])
    ]);

    root.appendChild(header);
    root.appendChild(mapWrap);

    // 2. STATE & LEAFLET VARS
    var bgMap, lensMap, px;
    var currentT = 0.5;  // Vertical normalized (0-1)
    var currentTx = 0.5; // Horizontal normalized (0-1)
    var isEditMode = false;

    // 3. CORE FUNCTIONS
    function applyView() {
      if (!bgMap || !lensMap || !px) return;
      var zoomL = BG_ZOOM + LENS_ZOOM_OFFSET;

      // Calculate map units based on 80% of the image to keep things in-frame
      var y = (px.h * 0.1) + (currentT * (px.h * 0.8));
      var x = (px.w * 0.1) + (currentTx * (px.w * 0.8));

      bgMap.setView([y, x], BG_ZOOM, { animate: false });
      lensMap.setView([y, x], zoomL, { animate: false });

      // Move Knobs visually
      knobV.style.top = (V_MIN + currentT * (V_MAX - V_MIN)) + "%";
      knobH.style.left = (H_MIN + currentTx * (H_MAX - H_MIN)) + "%";
    }

    function bindKnob(knob, axis) {
      function onMove(e) {
        var rect = knob.parentElement.getBoundingClientRect();
        var clientPos = (e.touches ? e.touches[0] : e)[axis === 'v' ? 'clientY' : 'clientX'];
        var relativePos = clientPos - rect[axis === 'v' ? 'top' : 'left'];
        var size = rect[axis === 'v' ? 'height' : 'width'];
        
        var percent = clamp(relativePos / size, 0, 1);
        
        if (axis === 'v') currentT = percent;
        else currentTx = percent;
        
        applyView();
      }

      function onEnd() {
        knob.classList.remove("is-active");
        window.removeEventListener("mousemove", onMove);
        window.removeEventListener("touchmove", onMove);
      }

      knob.onmousedown = knob.ontouchstart = function (e) {
        e.preventDefault();
        knob.classList.add("is-active");
        window.addEventListener("mousemove", onMove);
        window.addEventListener("touchmove", onMove);
        window.addEventListener("mouseup", onEnd);
        window.addEventListener("touchend", onEnd);
      };
    }

    function toggleEditor() {
      isEditMode = !isEditMode;
      root.classList.toggle("cc-hitbox-edit", isEditMode);
      console.log("Hitbox Editor:", isEditMode ? "ENABLED" : "DISABLED");
    }

    document.getElementById("cc-edit-toggle").onclick = toggleEditor;

    // 4. INITIALIZATION
    function init() {
      Promise.all([
        fetch(opts.mapUrl + "?t=" + Date.now()).then(function(r){ return r.json(); }),
        fetch(opts.locationsUrl + "?t=" + Date.now()).then(function(r){ return r.json(); })
      ]).then(function (res) {
        var mapDoc = res[0];
        var locDoc = res[1];
        px = mapDoc.map.background.image_pixel_size;
        var bounds = [[0, 0], [px.h, px.w]];

        // Setup Background Map (Smaller scale)
        bgMap = L.map(mapEl, {
          crs: L.CRS.Simple,
          zoomControl: false,
          dragging: false,
          touchZoom: false,
          scrollWheelZoom: false,
          doubleClickZoom: false,
          attributionControl: false
        });
        L.imageOverlay(mapDoc.map.background.image_key, bounds).addTo(bgMap);

        // Setup Lens Map (Larger scale / Detailed image)
        lensMap = L.map(lensMapEl, {
          crs: L.CRS.Simple,
          zoomControl: false,
          dragging: false,
          attributionControl: false
        });
        
        // Scale Illusion: Use the 'lens' image key if it exists, else fallback
        var lensImg = (mapDoc.map.lens && mapDoc.map.lens.image_key) ? mapDoc.map.lens.image_key : mapDoc.map.background.image_key;
        L.imageOverlay(lensImg, bounds).addTo(lensMap);

        // Add Hitboxes to Lens Map
        if (window.CC_HITBOXES) {
          locDoc.locations.forEach(function (loc) {
            var hb = window.CC_HITBOXES[loc.id];
            if (!hb) return;
            
            // Create invisible interactive rectangle
            var rect = L.rectangle([[hb[0], hb[1]], [hb[2], hb[3]]], {
              color: "#ff7518",
              weight: 1,
              fillOpacity: 0,
              interactive: true
            }).addTo(lensMap);

            rect.on('click', function() {
              alert("LOCATION: " + loc.name + "\n" + loc.description);
            });
          });
        }

        // Initialize Knobs
        bindKnob(knobV, 'v');
        bindKnob(knobH, 'h');

        // Set Initial View
        applyView();

        // Remove Loader
        setTimeout(function() {
          loader.style.opacity = "0";
          setTimeout(function() {
            loader.style.display = "none";
            root.classList.remove("cc-loading");
          }, 300);
        }, MIN_LOADER_MS);

      }).catch(function(err) {
        console.error("Canyon Map Init Error:", err);
      });
    }

    init();
    
    // Handle Window Resizing
    window.addEventListener('resize', applyView);
  }

  // GLOBAL EXPOSE
  window.CC_CanyonMap = { mount: mount };
})();
