/* File: rules/apps/canyon_map/cc_canyon_map_app.js
   Coffin Canyon — Canyon Map (read-only v1)
   ODOO CSP-SAFE + FIXED MAGNIFIER LENS + VERTICAL SCROLLER KNOB

   Fixes:
   - Ensures base map container has real height (prevents collapse)
   - Leaflet invalidateSize timing (prevents blurry lens + missing base map)
   - Robust scroll range math (handles zoom/fit edge cases)
*/

(function () {
  const APP_ID = "canyon_map";

  const DEFAULTS = {
    title: "Coffin Canyon — Canyon Map",

    // Data
    mapUrl:
      "https://raw.githubusercontent.com/steamcrow/coffin/main/rules/apps/canyon_map/data/canyon_map.json",
    stateUrl:
      "https://raw.githubusercontent.com/steamcrow/coffin/main/rules/apps/canyon_map/data/canyon_state.json",

    // App CSS
    appCssUrl:
      "https://raw.githubusercontent.com/steamcrow/coffin/main/rules/apps/canyon_map/cc_canyon_map.css",

    // Leaflet (hosted in your repo)
    leafletCssUrl:
      "https://raw.githubusercontent.com/steamcrow/coffin/main/rules/vendor/leaflet/leaflet.css",
    leafletJsUrl:
      "https://raw.githubusercontent.com/steamcrow/coffin/main/rules/vendor/leaflet/leaflet.js",

    // Layout sizing (JS-enforced so map never collapses)
    baseMapHeightPx: 640, // base (small map) visible behind lens
    baseMapMaxHeightVh: 70, // will clamp to viewport height on small screens

    // Lens behavior
    lensEnabled: true,
    lensZoomOffset: 2,
    lensWidthPx: 520,
    lensHeightPx: 360,

    // Panning behavior
    lockHorizontalPan: false,
    maxHorizontalDriftPx: 260,
    allowMapDrag: true,

    // Region coloring
    factionColors: {
      monster_rangers: "#4caf50",
      monsterologists: "#ff9800",
      monsters: "#9c27b0",
      liberty_corps: "#03a9f4",
      neutral: "#9e9e9e"
    },
    statusStyles: {
      controlled: { fillOpacity: 0.35 },
      contested: { fillOpacity: 0.18, dashArray: "6 6" },
      neutral: { fillOpacity: 0.12 }
    }
  };

  // ---------------------------
  // Utils
  // ---------------------------
  function el(tag, attrs = {}, children = []) {
    const n = document.createElement(tag);
    Object.entries(attrs).forEach(([k, v]) => {
      if (k === "class") n.className = v;
      else if (k === "style") n.setAttribute("style", v);
      else if (k.startsWith("on") && typeof v === "function") n.addEventListener(k.slice(2), v);
      else n.setAttribute(k, v);
    });
    children.forEach((c) => n.appendChild(typeof c === "string" ? document.createTextNode(c) : c));
    return n;
  }

  function clamp(n, min, max) {
    return Math.max(min, Math.min(max, n));
  }

  function rafThrottle(fn) {
    let pending = false;
    let lastArgs = null;
    return function (...args) {
      lastArgs = args;
      if (pending) return;
      pending = true;
      requestAnimationFrame(() => {
        pending = false;
        fn(...lastArgs);
      });
    };
  }

  function nextFrame() {
    return new Promise((r) => requestAnimationFrame(r));
  }

  async function fetchText(url) {
    const res = await fetch(url + (url.includes("?") ? "&" : "?") + "t=" + Date.now());
    if (!res.ok) throw new Error(`Fetch failed (${res.status}) for ${url}`);
    return await res.text();
  }

  async function fetchJson(url) {
    const res = await fetch(url + (url.includes("?") ? "&" : "?") + "t=" + Date.now());
    if (!res.ok) throw new Error(`Fetch failed (${res.status}) for ${url}`);
    return await res.json();
  }

  // ---------------------------
  // Odoo CSP-safe loaders
  // ---------------------------
  const _loaded = { css: new Set(), js: new Set() };

  async function loadCssTextOnce(url, key) {
    const k = key || url;
    if (_loaded.css.has(k)) return;
    const css = await fetchText(url);
    const style = document.createElement("style");
    style.setAttribute("data-cc-style", k);
    style.textContent = css;
    document.head.appendChild(style);
    _loaded.css.add(k);
  }

  async function loadScriptViaBlobOnce(url, key) {
    const k = key || url;
    if (_loaded.js.has(k)) return;

    const code = await fetchText(url);
    const blob = new Blob([code], { type: "text/javascript" });
    const blobUrl = URL.createObjectURL(blob);

    await new Promise((resolve, reject) => {
      const s = document.createElement("script");
      s.src = blobUrl;
      s.onload = () => {
        URL.revokeObjectURL(blobUrl);
        resolve();
      };
      s.onerror = () => {
        URL.revokeObjectURL(blobUrl);
        reject(new Error("Script failed: " + url));
      };
      document.head.appendChild(s);
    });

    _loaded.js.add(k);
  }

  async function ensureLeaflet(opts) {
    await loadCssTextOnce(opts.leafletCssUrl, "leaflet_css");
    await loadScriptViaBlobOnce(opts.leafletJsUrl, "leaflet_js");
    if (!window.L) throw new Error("Leaflet did not load (window.L missing).");
  }

  // ---------------------------
  // Validation + geometry
  // ---------------------------
  function normalizePoints(points, coordSystem) {
    if (!Array.isArray(points)) return [];
    if (coordSystem !== "image_px" && coordSystem !== "map_units") return [];
    return points
      .filter((p) => p && typeof p.x === "number" && typeof p.y === "number")
      .map((p) => [p.y, p.x]); // CRS.Simple => [y, x]
  }

  function validateMapDoc(doc) {
    if (!doc || doc.schema_id !== "cc_canyon_map") return "schema_id must be cc_canyon_map";
    if (!doc.map || !doc.map.background || !doc.map.background.image_key)
      return "map.background.image_key missing";
    if (!doc.map.background.image_pixel_size) return "map.background.image_pixel_size missing";
    if (!Array.isArray(doc.regions)) return "regions must be array";
    return null;
  }

  function validateStateDoc(doc) {
    if (!doc || doc.schema_id !== "cc_canyon_state") return "schema_id must be cc_canyon_state";
    if (!doc.state_by_region || typeof doc.state_by_region !== "object")
      return "state_by_region missing";
    return null;
  }

  // ---------------------------
  // UI
  // ---------------------------
  function buildLayout(root, opts) {
    root.innerHTML = "";
    root.classList.add("cc-canyon-map");

    const header = el("div", { class: "cc-cm-header" }, [
      el("div", { class: "cc-cm-title" }, [opts.title]),
      el("div", { class: "cc-cm-actions" }, [
        el("button", { class: "cc-btn", type: "button", id: "cc-cm-reload" }, ["Reload"]),
        el("button", { class: "cc-btn", type: "button", id: "cc-cm-fit" }, ["Fit"])
      ])
    ]);

    const mapEl = el("div", { id: "cc-cm-map", class: "cc-cm-map" });

    const lens = el("div", { class: "cc-lens", id: "cc-lens" }, [
      el("div", { class: "cc-lens-rim" }),
      el("div", { class: "cc-lens-inner", id: "cc-lens-inner" }, [
        el("div", { class: "cc-lens-map", id: "cc-lens-map" })
      ]),
      el("div", { class: "cc-lens-glare" })
    ]);

    const scroller = el("div", { class: "cc-scroll", id: "cc-scroll" }, [
      el("div", { class: "cc-scroll-track" }),
      el("div", { class: "cc-scroll-knob", id: "cc-scroll-knob" })
    ]);

    const body = el("div", { class: "cc-cm-body cc-cm-body--lens" }, [
      el("div", { class: "cc-cm-mapwrap" }, [mapEl, lens, scroller]),
      el("div", { class: "cc-cm-drawer", id: "cc-cm-drawer" }, [
        el("div", { class: "cc-cm-drawer-head" }, [
          el("div", { class: "cc-cm-drawer-title", id: "cc-cm-drawer-title" }, ["Region"]),
          el(
            "button",
            {
              class: "cc-btn cc-btn-x",
              type: "button",
              onClick: () => root._ccApi && root._ccApi.drawerClose()
            },
            ["×"]
          )
        ]),
        el("div", { class: "cc-cm-drawer-content", id: "cc-cm-drawer-content" }, [
          el("div", { class: "cc-muted" }, ["Click a region to view details."])
        ])
      ])
    ]);

    root.appendChild(header);
    root.appendChild(body);

    // Lens dimensions
    lens.style.setProperty("--lens-w", `${opts.lensWidthPx}px`);
    lens.style.setProperty("--lens-h", `${opts.lensHeightPx}px`);

    return {
      mapEl,
      lensEl: lens,
      lensMapEl: root.querySelector("#cc-lens-map"),
      btnReload: root.querySelector("#cc-cm-reload"),
      btnFit: root.querySelector("#cc-cm-fit"),
      drawerEl: root.querySelector("#cc-cm-drawer"),
      drawerTitleEl: root.querySelector("#cc-cm-drawer-title"),
      drawerContentEl: root.querySelector("#cc-cm-drawer-content"),
      scrollEl: scroller,
      knobEl: root.querySelector("#cc-scroll-knob")
    };
  }

  function openDrawer(ui) {
    ui.drawerEl.classList.add("open");
  }

  function closeDrawer(ui) {
    ui.drawerEl.classList.remove("open");
  }

  function renderDrawer(ui, region, stateForRegion) {
    ui.drawerTitleEl.textContent = region?.name || "Region";

    const controller = stateForRegion?.controller_faction_id || "neutral";
    const status = stateForRegion?.status || "neutral";
    const weather = stateForRegion?.weather_tag || null;

    const nodes = [];

    if (region?.description) nodes.push(el("div", { class: "cc-block" }, [region.description]));

    nodes.push(
      el("div", { class: "cc-block" }, [
        el("div", { class: "cc-h" }, ["State"]),
        el("div", {}, [`Controller: ${controller}`]),
        el("div", {}, [`Status: ${status}`]),
        weather
          ? el("div", {}, [`Weather: ${weather}`])
          : el("div", { class: "cc-muted" }, ["Weather: (none)"])
      ])
    );

    const resources = region?.resources || [];
    nodes.push(
      el("div", { class: "cc-block" }, [
        el("div", { class: "cc-h" }, ["Resources"]),
        resources.length
          ? el("ul", { class: "cc-ul" }, resources.map((r) => el("li", {}, [String(r)])))
          : el("div", { class: "cc-muted" }, ["(none)"])
      ])
    );

    const encounters = region?.encounters || [];
    nodes.push(
      el("div", { class: "cc-block" }, [
        el("div", { class: "cc-h" }, ["Encounters"]),
        encounters.length
          ? el("ul", { class: "cc-ul" }, encounters.map((e) => el("li", {}, [String(e)])))
          : el("div", { class: "cc-muted" }, ["(none)"])
      ])
    );

    ui.drawerContentEl.innerHTML = "";
    nodes.forEach((n) => ui.drawerContentEl.appendChild(n));
  }

  function buildRegionStyle(opts, regionId, stateByRegion) {
    const st = stateByRegion[regionId] || {};
    const controller = st.controller_faction_id || "neutral";
    const status = st.status || "neutral";

    const fillColor = opts.factionColors[controller] || opts.factionColors.neutral || "#999";
    const statusPatch = opts.statusStyles[status] || opts.statusStyles.neutral || {};

    return {
      color: "rgba(255,255,255,0.45)",
      weight: 2,
      fillColor,
      fillOpacity: 0.18,
      ...statusPatch
    };
  }

  // ---------------------------
  // Main mount
  // ---------------------------
  async function mount(root, userOpts) {
    const opts = { ...DEFAULTS, ...(userOpts || {}) };

    let maxDrift = typeof opts.maxHorizontalDriftPx === "number" ? opts.maxHorizontalDriftPx : 0;
    if (opts.lockHorizontalPan === true) maxDrift = 0;

    if (opts.appCssUrl) await loadCssTextOnce(opts.appCssUrl, "cc_canyon_map_css");
    await ensureLeaflet(opts);

    const ui = buildLayout(root, opts);

    let mapDoc = null;
    let stateDoc = null;

    let mainMap = null;
    let lensMap = null;

    const regionLayersById = {};
    const regionsById = {};
    let selectedRegionId = null;

    let scrollerBound = false;

    function enforceBaseMapSize() {
      if (!mapDoc) return;

      const px = mapDoc.map.background.image_pixel_size;
      const aspect = px.w / px.h; // width / height

      const vh = window.innerHeight || 900;
      const maxH = Math.floor((opts.baseMapMaxHeightVh / 100) * vh);
      const h = clamp(opts.baseMapHeightPx, 320, maxH);
      const w = Math.round(h * aspect);

      ui.mapEl.style.height = h + "px";
      ui.mapEl.style.width = w + "px";
    }

    function fitToImage() {
      if (!mainMap || !mapDoc) return;
      const px = mapDoc.map.background.image_pixel_size;
      const bounds = [[0, 0], [px.h, px.w]];
      mainMap.fitBounds(bounds, { padding: [10, 10] });
    }

    function clampHorizontal() {
      if (!mainMap || !mapDoc) return;
      const px = mapDoc.map.background.image_pixel_size;
      const cx = px.w / 2;

      const c = mainMap.getCenter();
      const minX = cx - maxDrift;
      const maxX = cx + maxDrift;

      const clampedX = clamp(c.lng, minX, maxX);
      if (Math.abs(clampedX - c.lng) > 0.5) {
        mainMap.panTo([c.lat, clampedX], { animate: false });
      }
    }

    const syncLens = rafThrottle(() => {
      if (!opts.lensEnabled) return;
      if (!mainMap || !lensMap) return;
      const c = mainMap.getCenter();
      const z = mainMap.getZoom();
      lensMap.setView(c, z + opts.lensZoomOffset, { animate: false });
    });

    function rebuildRegions() {
      Object.values(regionLayersById).forEach((layer) => {
        try {
          mainMap.removeLayer(layer);
        } catch (e) {}
      });
      for (const k of Object.keys(regionLayersById)) delete regionLayersById[k];

      const stateByRegion = stateDoc?.state_by_region || {};
      const coordSystem = mapDoc.map?.background?.coord_system || "image_px";

      (mapDoc.regions || []).forEach((r) => {
        regionsById[r.region_id] = r;

        const latlngs = normalizePoints(r.shape?.points, coordSystem);
        if (!latlngs.length) return;

        const baseStyle = buildRegionStyle(opts, r.region_id, stateByRegion);
        const poly = window.L.polygon(latlngs, baseStyle);

        poly.on("click", () => {
          selectedRegionId = r.region_id;
          renderDrawer(ui, r, stateByRegion[r.region_id] || null);
          openDrawer(ui);
        });

        poly.addTo(mainMap);
        regionLayersById[r.region_id] = poly;
      });
    }

    function applyStateStyles() {
      const stateByRegion = stateDoc?.state_by_region || {};
      Object.entries(regionLayersById).forEach(([regionId, layer]) => {
        const style = buildRegionStyle(opts, regionId, stateByRegion);
        try {
          layer.setStyle(style);
        } catch (e) {}
      });

      if (selectedRegionId && regionsById[selectedRegionId]) {
        renderDrawer(ui, regionsById[selectedRegionId], stateByRegion[selectedRegionId] || null);
      }
    }

    // ---- Scroller math (robust) ----
    function getScrollRange() {
      if (!mainMap || !mapDoc) return { yMin: 0, yMax: 0 };

      const px = mapDoc.map.background.image_pixel_size;
      const imageMinY = 0;
      const imageMaxY = px.h;

      const view = mainMap.getBounds();
      const viewH = Math.abs(view.getNorth() - view.getSouth());
      const half = viewH / 2;

      // If view is larger than the image, we can't scroll — clamp to center
      if (viewH >= px.h) {
        const mid = px.h / 2;
        return { yMin: mid, yMax: mid };
      }

      const yMin = imageMinY + half;
      const yMax = imageMaxY - half;

      return { yMin, yMax };
    }

    function centerToKnobT() {
      if (!mainMap || !mapDoc) return 0;
      const { yMin, yMax } = getScrollRange();
      if (yMax === yMin) return 0.5;
      const c = mainMap.getCenter();
      const t = (c.lat - yMin) / (yMax - yMin);
      return clamp(t, 0, 1);
    }

    function updateKnobFromMap() {
      const t = centerToKnobT();
      ui.knobEl.style.top = `${t * 100}%`;
      ui.knobEl.style.transform = `translate(-50%, -50%)`;
    }

    function panMapToT(t) {
      if (!mainMap || !mapDoc) return;
      const { yMin, yMax } = getScrollRange();
      const px = mapDoc.map.background.image_pixel_size;
      const cx = px.w / 2;

      const y = yMin === yMax ? yMin : yMin + clamp(t, 0, 1) * (yMax - yMin);

      const c = mainMap.getCenter();
      const minX = cx - maxDrift;
      const maxX = cx + maxDrift;
      const x = clamp(c.lng, minX, maxX);

      mainMap.panTo([y, x], { animate: false });
    }

    function bindScrollerOnce() {
      if (scrollerBound) return;
      scrollerBound = true;

      let dragging = false;

      function setFromClientY(clientY) {
        const rect = ui.scrollEl.getBoundingClientRect();
        const t = (clientY - rect.top) / rect.height;
        panMapToT(t);
      }

      const onMove = (e) => {
        if (!dragging) return;
        const clientY = e.touches ? e.touches[0].clientY : e.clientY;
        setFromClientY(clientY);
        if (e.cancelable) e.preventDefault();
      };

      const onUp = () => {
        dragging = false;
        document.removeEventListener("mousemove", onMove);
        document.removeEventListener("mouseup", onUp);
        document.removeEventListener("touchmove", onMove);
        document.removeEventListener("touchend", onUp);
      };

      ui.knobEl.addEventListener("mousedown", (e) => {
        dragging = true;
        document.addEventListener("mousemove", onMove);
        document.addEventListener("mouseup", onUp);
        e.preventDefault();
      });

      ui.knobEl.addEventListener(
        "touchstart",
        (e) => {
          dragging = true;
          document.addEventListener("touchmove", onMove, { passive: false });
          document.addEventListener("touchend", onUp);
          if (e.cancelable) e.preventDefault();
        },
        { passive: false }
      );

      ui.scrollEl.addEventListener("mousedown", (e) => {
        if (e.target === ui.knobEl) return;
        setFromClientY(e.clientY);
      });

      ui.scrollEl.addEventListener(
        "touchstart",
        (e) => {
          if (e.target === ui.knobEl) return;
          setFromClientY(e.touches[0].clientY);
        },
        { passive: true }
      );
    }

    // ---- Leaflet size fix ----
    async function invalidateMapsHard() {
      // Leaflet needs real layout before it draws correctly.
      await nextFrame();
      try {
        mainMap && mainMap.invalidateSize({ animate: false });
      } catch (e) {}
      try {
        lensMap && lensMap.invalidateSize({ animate: false });
      } catch (e) {}

      await nextFrame();
      try {
        mainMap && mainMap.invalidateSize({ animate: false });
      } catch (e) {}
      try {
        lensMap && lensMap.invalidateSize({ animate: false });
      } catch (e) {}
    }

    // ---------------------------
    // Load + build
    // ---------------------------
    async function loadAll() {
      ui.drawerContentEl.innerHTML = "";
      ui.drawerContentEl.appendChild(el("div", { class: "cc-muted" }, ["Loading…"]));

      mapDoc = await fetchJson(opts.mapUrl);
      stateDoc = await fetchJson(opts.stateUrl);

      const mapErr = validateMapDoc(mapDoc);
      if (mapErr) throw new Error("Bad canyon_map.json: " + mapErr);

      const stateErr = validateStateDoc(stateDoc);
      if (stateErr) throw new Error("Bad canyon_state.json: " + stateErr);

      // Destroy old maps
      if (mainMap) {
        try {
          mainMap.remove();
        } catch (e) {}
        mainMap = null;
      }
      if (lensMap) {
        try {
          lensMap.remove();
        } catch (e) {}
        lensMap = null;
      }

      // Make sure base map has a real size BEFORE Leaflet init
      enforceBaseMapSize();

      const px = mapDoc.map.background.image_pixel_size;
      const bounds = [[0, 0], [px.h, px.w]];

      // Main map (small)
      mainMap = window.L.map(ui.mapEl, {
        crs: window.L.CRS.Simple,
        minZoom: -3,
        maxZoom: 3,
        zoomSnap: 0.25,
        zoomDelta: 0.25,
        attributionControl: false,
        zoomControl: false,
        scrollWheelZoom: false,
        doubleClickZoom: false,
        boxZoom: false,
        keyboard: false,
        dragging: !!opts.allowMapDrag,
        tap: true
      });

      window.L.imageOverlay(mapDoc.map.background.image_key, bounds, {
        opacity: clamp(mapDoc.map.background.opacity ?? 1.0, 0, 1)
      }).addTo(mainMap);

      mainMap.setMaxBounds(bounds);

      // Lens map (large)
      if (opts.lensEnabled) {
        ui.lensEl.style.display = "block";

        lensMap = window.L.map(ui.lensMapEl, {
          crs: window.L.CRS.Simple,
          minZoom: -3,
          maxZoom: 6,
          zoomSnap: 0.25,
          zoomDelta: 0.25,
          attributionControl: false,
          zoomControl: false,
          scrollWheelZoom: false,
          doubleClickZoom: false,
          boxZoom: false,
          keyboard: false,
          dragging: false,
          tap: false
        });

        const lensImageKey = mapDoc.map?.lens?.image_key || mapDoc.map.background.image_key;

        window.L.imageOverlay(lensImageKey, bounds, { opacity: 1.0 }).addTo(lensMap);
        lensMap.setMaxBounds(bounds);
      } else {
        ui.lensEl.style.display = "none";
      }

      // Critical: invalidate sizes AFTER layout exists, then fit + sync
      await invalidateMapsHard();
      fitToImage();
      await invalidateMapsHard();
      syncLens();

      // Clamp horizontal drift
      if (maxDrift >= 0) {
        mainMap.on("move", clampHorizontal);
        clampHorizontal();
      }

      // Regions
      rebuildRegions();
      closeDrawer(ui);
      ui.drawerTitleEl.textContent = "Region";
      ui.drawerContentEl.innerHTML = "";
      ui.drawerContentEl.appendChild(el("div", { class: "cc-muted" }, ["Click a region to view details."]));

      // Scroller + syncing
      bindScrollerOnce();
      updateKnobFromMap();

      mainMap.on("move", () => {
        updateKnobFromMap();
        syncLens();
      });
      mainMap.on("zoom", () => {
        updateKnobFromMap();
        syncLens();
      });

      if (lensMap) {
        mainMap.on("move", syncLens);
        mainMap.on("zoom", syncLens);
      }

      // On resize, re-enforce sizes and invalidate
      window.addEventListener("resize", rafThrottle(async () => {
        enforceBaseMapSize();
        await invalidateMapsHard();
        fitToImage();
        await invalidateMapsHard();
        syncLens();
      }));
    }

    ui.btnReload.addEventListener("click", () => loadAll().catch((e) => console.error(e)));
    ui.btnFit.addEventListener("click", () => fitToImage());

    await loadAll();

    const api = {
      reload: async () => await loadAll(),
      fit: () => fitToImage(),
      setState: (newStateDoc) => {
        const err = validateStateDoc(newStateDoc);
        if (err) throw new Error("Bad state doc: " + err);
        stateDoc = newStateDoc;
        applyStateStyles();
      },
      setRegionState: (regionId, patch) => {
        if (!stateDoc || !stateDoc.state_by_region) return;
        stateDoc.state_by_region[regionId] = {
          ...(stateDoc.state_by_region[regionId] || {}),
          ...(patch || {})
        };
        applyStateStyles();
      },
      drawerClose: () => closeDrawer(ui),
      drawerOpenRegion: (regionId) => {
        const r = regionsById[regionId];
        if (!r) return;
        selectedRegionId = regionId;
        renderDrawer(ui, r, stateDoc?.state_by_region?.[regionId] || null);
        openDrawer(ui);
      },
      setLensEnabled: (on) => {
        opts.lensEnabled = !!on;
        ui.lensEl.style.display = opts.lensEnabled ? "block" : "none";
        if (opts.lensEnabled && mainMap && lensMap) syncLens();
      },
      getMapDoc: () => mapDoc,
      getStateDoc: () => stateDoc
    };

    root._ccApi = api;
    return api;
  }

  // Auto-mount
  async function autoMountIfPresent() {
    const root = document.getElementById("cc-app-root");
    if (!root) return;

    const appId = root.getAttribute("data-cc-app");
    if (appId !== APP_ID) return;

    try {
      console.log("🗺️ CC Canyon Map: mounting…");
      await mount(root, {});
      console.log("✅ CC Canyon Map: mounted");
    } catch (e) {
      console.error("❌ CC Canyon Map mount failed:", e);
      const msg = (e && (e.message || String(e))) || "Unknown error";
      root.innerHTML =
        "<div style='padding:12px;opacity:.92;line-height:1.35'>" +
        "<div style='font-weight:700;margin-bottom:6px'>❌ Canyon Map failed to load</div>" +
        "<div style='font-family:monospace;font-size:12px;white-space:pre-wrap;background:rgba(0,0,0,.25);padding:10px;border-radius:8px'>" +
        msg +
        "</div>" +
        "<div style='margin-top:10px;opacity:.8'>Tip: this message is your iPad console now.</div>" +
        "</div>";
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", autoMountIfPresent);
  } else {
    autoMountIfPresent();
  }

  window.CC_CanyonMap = { mount };
})();
