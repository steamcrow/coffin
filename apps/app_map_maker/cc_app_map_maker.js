/* File: coffin/apps/app_map_maker/cc_app_map_maker.js
   Coffin Canyon — Map Maker (V1)
   Fake-isometric Leaflet map editor
*/

(function () {
  "use strict";

  var DEFAULTS = {
    title: "Coffin Canyon — Map Maker",
    mapImageUrl: "https://raw.githubusercontent.com/steamcrow/coffin/main/assets/maps/lost_yots.png",
    mapWidth: 4096,
    mapHeight: 4096,

    terrainCatalogUrl: "https://raw.githubusercontent.com/steamcrow/coffin/main/data/src/terrain_catalog.json",
    locationsUrl: "https://raw.githubusercontent.com/steamcrow/coffin/main/data/src/170_named_locations.json",

    initialInstancesUrl: "",

    appCssUrl: "https://raw.githubusercontent.com/steamcrow/coffin/main/apps/app_map_maker/cc_app_map_maker.css",
    leafletCssUrl: "https://raw.githubusercontent.com/steamcrow/coffin/main/vendor/leaflet/leaflet.css",
    leafletJsUrl: "https://raw.githubusercontent.com/steamcrow/coffin/main/vendor/leaflet/leaflet.js",

    assetBaseUrl: "https://raw.githubusercontent.com/steamcrow/coffin/main/assets/terrain/",
    defaultMapId: "lost_yots",
    defaultMapTitle: "Lost Yots",
    defaultLocationId: "lost_yots"
  };

  var state = {
    opts: null,
    map: null,
    imageBounds: null,
    terrainCatalog: null,
    terrainById: {},
    locations: [],
    currentFile: null,
    selectedTerrainTypeId: null,
    selectedInstanceId: null,
    markersByInstanceId: {},
    instanceData: {
      map_id: DEFAULTS.defaultMapId,
      map_title: DEFAULTS.defaultMapTitle,
      location_id: DEFAULTS.defaultLocationId,
      map_image: DEFAULTS.mapImageUrl,
      map_size_px: { w: DEFAULTS.mapWidth, h: DEFAULTS.mapHeight },
      instances: []
    },
    ui: {}
  };

  function mergeOpts(userOpts) {
    var out = {};
    Object.keys(DEFAULTS).forEach(function (k) { out[k] = DEFAULTS[k]; });
    Object.keys(userOpts || {}).forEach(function (k) { out[k] = userOpts[k]; });
    return out;
  }

  function ensureCss(url) {
    if (!url) return Promise.resolve();
    var existing = Array.prototype.slice.call(document.querySelectorAll('link[rel="stylesheet"]'))
      .find(function (el) { return (el.href || "").indexOf(url) !== -1; });
    if (existing) return Promise.resolve();

    return new Promise(function (resolve, reject) {
      var link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = url + "?t=" + Date.now();
      link.onload = resolve;
      link.onerror = function () { reject(new Error("Failed to load CSS: " + url)); };
      document.head.appendChild(link);
    });
  }

  function ensureScript(url) {
    if (!url) return Promise.resolve();
    return new Promise(function (resolve, reject) {
      var found = Array.prototype.slice.call(document.scripts).some(function (s) {
        return (s.src || "").indexOf(url) !== -1;
      });
      if (found) {
        resolve();
        return;
      }

      fetch(url + "?t=" + Date.now())
        .then(function (r) {
          if (!r.ok) throw new Error("HTTP " + r.status + " for " + url);
          return r.text();
        })
        .then(function (text) {
          var blob = new Blob([text], { type: "text/javascript" });
          var blobUrl = URL.createObjectURL(blob);
          var script = document.createElement("script");
          script.src = blobUrl;
          script.onload = function () {
            URL.revokeObjectURL(blobUrl);
            resolve();
          };
          script.onerror = function () {
            URL.revokeObjectURL(blobUrl);
            reject(new Error("Failed to execute script: " + url));
          };
          document.head.appendChild(script);
        })
        .catch(reject);
    });
  }

  function fetchJson(url) {
    if (!url) return Promise.resolve(null);
    return fetch(url + (url.indexOf("?") === -1 ? "?t=" : "&t=") + Date.now())
      .then(function (r) {
        if (!r.ok) throw new Error("HTTP " + r.status + " for " + url);
        return r.json();
      });
  }

  function el(tag, attrs, children) {
    var node = document.createElement(tag);
    attrs = attrs || {};
    Object.keys(attrs).forEach(function (k) {
      if (k === "class") node.className = attrs[k];
      else if (k === "html") node.innerHTML = attrs[k];
      else if (k === "text") node.textContent = attrs[k];
      else node.setAttribute(k, attrs[k]);
    });
    (children || []).forEach(function (child) {
      if (child == null) return;
      node.appendChild(typeof child === "string" ? document.createTextNode(child) : child);
    });
    return node;
  }

  function clamp(num, min, max) {
    return Math.max(min, Math.min(max, num));
  }

  function makeId(prefix) {
    return prefix + "_" + Math.random().toString(36).slice(2, 10);
  }

  function deepClone(obj) {
    return JSON.parse(JSON.stringify(obj));
  }

  function getTerrainTypes() {
    if (!state.terrainCatalog) return [];
    if (Array.isArray(state.terrainCatalog.terrain_types)) return state.terrainCatalog.terrain_types;
    if (Array.isArray(state.terrainCatalog.terrain_types_batch_2)) return state.terrainCatalog.terrain_types_batch_2;
    return [];
  }

  function normalizeLocations(raw) {
    if (!raw) return [];
    if (Array.isArray(raw.locations)) return raw.locations;
    if (Array.isArray(raw.named_locations)) return raw.named_locations;
    if (Array.isArray(raw)) return raw;
    return [];
  }

  function buildLayout(root) {
    root.innerHTML = "";

    var app = el("div", { class: "cc-mm-app" });
    var toolbar = el("div", { class: "cc-mm-toolbar" });
    var body = el("div", { class: "cc-mm-body" });

    var left = el("aside", { class: "cc-mm-sidebar cc-mm-sidebar--left" });
    var center = el("main", { class: "cc-mm-center" });
    var right = el("aside", { class: "cc-mm-sidebar cc-mm-sidebar--right" });

    var mapWrap = el("div", { class: "cc-mm-map-wrap" });
    var mapEl = el("div", { class: "cc-mm-map", id: "cc-mm-map" });
    mapWrap.appendChild(mapEl);

    center.appendChild(mapWrap);
    body.appendChild(left);
    body.appendChild(center);
    body.appendChild(right);

    app.appendChild(toolbar);
    app.appendChild(body);
    root.appendChild(app);

    state.ui = {
      root: root,
      app: app,
      toolbar: toolbar,
      left: left,
      center: center,
      right: right,
      mapEl: mapEl
    };

    buildToolbar();
    buildLeftSidebar();
    buildRightSidebar();
  }

  function buildToolbar() {
    var ui = state.ui;
    ui.toolbar.innerHTML = "";

    var title = el("div", { class: "cc-mm-toolbar-title", text: state.opts.title });

    var mapTitleInput = el("input", {
      class: "cc-mm-input",
      type: "text",
      placeholder: "Map Title"
    });
    mapTitleInput.value = state.instanceData.map_title || "";

    var mapIdInput = el("input", {
      class: "cc-mm-input",
      type: "text",
      placeholder: "map_id"
    });
    mapIdInput.value = state.instanceData.map_id || "";

    var locationSelect = el("select", { class: "cc-mm-input" });
    renderLocationOptions(locationSelect);

    var btnExport = el("button", { class: "cc-mm-btn cc-mm-btn--primary", text: "Export JSON" });
    var btnLoadJson = el("button", { class: "cc-mm-btn", text: "Load JSON" });
    var btnDelete = el("button", { class: "cc-mm-btn", text: "Delete Selected" });
    var btnClear = el("button", { class: "cc-mm-btn", text: "Clear Map" });

    var fileInput = el("input", {
      type: "file",
      accept: ".json,application/json",
      style: "display:none"
    });

    btnLoadJson.addEventListener("click", function () {
      fileInput.click();
    });

    fileInput.addEventListener("change", function (ev) {
      var file = ev.target.files && ev.target.files[0];
      if (!file) return;

      var reader = new FileReader();
      reader.onload = function () {
        try {
          var parsed = JSON.parse(reader.result);
          loadInstancesData(parsed);
        } catch (err) {
          alert("Invalid JSON file: " + err.message);
        }
      };
      reader.readAsText(file);
    });

    mapTitleInput.addEventListener("input", function () {
      state.instanceData.map_title = mapTitleInput.value.trim();
    });

    mapIdInput.addEventListener("input", function () {
      state.instanceData.map_id = mapIdInput.value.trim();
    });

    locationSelect.addEventListener("change", function () {
      state.instanceData.location_id = locationSelect.value || "";
    });

    btnExport.addEventListener("click", function () {
      exportJson();
    });

    btnDelete.addEventListener("click", function () {
      deleteSelectedInstance();
    });

    btnClear.addEventListener("click", function () {
      if (!confirm("Clear all placed terrain from this map?")) return;
      clearAllInstances();
    });

    var group1 = el("div", { class: "cc-mm-toolbar-group" }, [title]);
    var group2 = el("div", { class: "cc-mm-toolbar-group" }, [
      el("label", { class: "cc-mm-label", text: "Map Title" }),
      mapTitleInput,
      el("label", { class: "cc-mm-label", text: "Map ID" }),
      mapIdInput,
      el("label", { class: "cc-mm-label", text: "Location" }),
      locationSelect
    ]);
    var group3 = el("div", { class: "cc-mm-toolbar-group" }, [
      btnLoadJson,
      btnExport,
      btnDelete,
      btnClear,
      fileInput
    ]);

    ui.toolbar.appendChild(group1);
    ui.toolbar.appendChild(group2);
    ui.toolbar.appendChild(group3);

    ui.mapTitleInput = mapTitleInput;
    ui.mapIdInput = mapIdInput;
    ui.locationSelect = locationSelect;
  }

  function renderLocationOptions(selectEl) {
    selectEl.innerHTML = "";
    selectEl.appendChild(el("option", { value: "", text: "— Select Location —" }));

    state.locations.forEach(function (loc) {
      var id = loc.location_id || loc.id || loc.slug || loc.name || "";
      var name = loc.name || loc.title || id;
      if (!id) return;
      selectEl.appendChild(el("option", { value: id, text: name }));
    });

    selectEl.value = state.instanceData.location_id || "";
  }

  function buildLeftSidebar() {
    var ui = state.ui;
    ui.left.innerHTML = "";

    var header = el("div", { class: "cc-mm-sidebar-header", text: "Terrain Palette" });

    var search = el("input", {
      class: "cc-mm-input cc-mm-input--full",
      type: "text",
      placeholder: "Search terrain..."
    });

    var filterKind = el("select", { class: "cc-mm-input cc-mm-input--full" });
    filterKind.appendChild(el("option", { value: "", text: "All kinds" }));
    ["building", "scatter", "obstacle", "area", "hazard", "feature", "objective"].forEach(function (kind) {
      filterKind.appendChild(el("option", { value: kind, text: kind }));
    });

    var list = el("div", { class: "cc-mm-palette-list" });

    function renderPalette() {
      var q = (search.value || "").trim().toLowerCase();
      var kind = filterKind.value || "";
      list.innerHTML = "";

      getTerrainTypes().forEach(function (item) {
        var hay = [
          item.name,
          item.terrain_type_id,
          item.family,
          (item.tags || []).join(" ")
        ].join(" ").toLowerCase();

        if (q && hay.indexOf(q) === -1) return;
        if (kind && item.kind !== kind) return;

        var card = el("button", { class: "cc-mm-palette-card" });
        if (state.selectedTerrainTypeId === item.terrain_type_id) {
          card.classList.add("is-selected");
        }

        var line1 = el("div", { class: "cc-mm-palette-title", text: item.name || item.terrain_type_id });
        var line2 = el("div", { class: "cc-mm-palette-meta", text: (item.family || "") + " · " + (item.kind || "") });
        var line3 = el("div", { class: "cc-mm-palette-meta", text: item.terrain_type_id });

        card.appendChild(line1);
        card.appendChild(line2);
        card.appendChild(line3);

        card.addEventListener("click", function () {
          state.selectedTerrainTypeId = item.terrain_type_id;
          renderPalette();
          renderInspector();
        });

        list.appendChild(card);
      });
    }

    search.addEventListener("input", renderPalette);
    filterKind.addEventListener("change", renderPalette);

    ui.left.appendChild(header);
    ui.left.appendChild(search);
    ui.left.appendChild(filterKind);
    ui.left.appendChild(list);

    ui.paletteSearch = search;
    ui.paletteFilterKind = filterKind;
    ui.paletteList = list;
    ui.renderPalette = renderPalette;

    renderPalette();
  }

  function buildRightSidebar() {
    var ui = state.ui;
    ui.right.innerHTML = "";
    var header = el("div", { class: "cc-mm-sidebar-header", text: "Inspector" });
    var panel = el("div", { class: "cc-mm-inspector" });
    ui.right.appendChild(header);
    ui.right.appendChild(panel);
    ui.inspector = panel;
    renderInspector();
  }

  function renderInspector() {
    var ui = state.ui;
    var panel = ui.inspector;
    if (!panel) return;
    panel.innerHTML = "";

    var selectedTerrain = state.terrainById[state.selectedTerrainTypeId] || null;
    var selectedInstance = getSelectedInstance();

    if (!selectedTerrain && !selectedInstance) {
      panel.appendChild(el("div", {
        class: "cc-mm-empty",
        text: "Select a terrain type on the left, then click the map to place it."
      }));
      return;
    }

    if (selectedTerrain && !selectedInstance) {
      panel.appendChild(el("div", { class: "cc-mm-section-title", text: "Selected Terrain Type" }));
      panel.appendChild(el("div", { class: "cc-mm-kv" }, [
        el("div", { class: "cc-mm-k", text: "Name" }),
        el("div", { class: "cc-mm-v", text: selectedTerrain.name || "" })
      ]));
      panel.appendChild(el("div", { class: "cc-mm-kv" }, [
        el("div", { class: "cc-mm-k", text: "ID" }),
        el("div", { class: "cc-mm-v", text: selectedTerrain.terrain_type_id || "" })
      ]));
      panel.appendChild(el("div", { class: "cc-mm-kv" }, [
        el("div", { class: "cc-mm-k", text: "Kind" }),
        el("div", { class: "cc-mm-v", text: selectedTerrain.kind || "" })
      ]));
      panel.appendChild(el("div", {
        class: "cc-mm-help",
        text: "Click the map to place this terrain."
      }));
      return;
    }

    if (!selectedInstance) return;

    var terrain = state.terrainById[selectedInstance.terrain_type_id] || null;

    panel.appendChild(el("div", { class: "cc-mm-section-title", text: "Selected Instance" }));

    function numberField(label, value, step, onInput) {
      var wrap = el("div", { class: "cc-mm-field" });
      var lbl = el("label", { class: "cc-mm-label", text: label });
      var input = el("input", {
        class: "cc-mm-input cc-mm-input--full",
        type: "number",
        step: step || "1",
        value: String(value == null ? "" : value)
      });
      input.addEventListener("input", function () {
        onInput(input.value);
      });
      wrap.appendChild(lbl);
      wrap.appendChild(input);
      return wrap;
    }

    function textField(label, value, onInput) {
      var wrap = el("div", { class: "cc-mm-field" });
      var lbl = el("label", { class: "cc-mm-label", text: label });
      var input = el("input", {
        class: "cc-mm-input cc-mm-input--full",
        type: "text",
        value: value == null ? "" : value
      });
      input.addEventListener("input", function () {
        onInput(input.value);
      });
      wrap.appendChild(lbl);
      wrap.appendChild(input);
      return wrap;
    }

    panel.appendChild(el("div", { class: "cc-mm-kv" }, [
      el("div", { class: "cc-mm-k", text: "Terrain" }),
      el("div", { class: "cc-mm-v", text: terrain ? terrain.name : selectedInstance.terrain_type_id })
    ]));
    panel.appendChild(el("div", { class: "cc-mm-kv" }, [
      el("div", { class: "cc-mm-k", text: "Instance ID" }),
      el("div", { class: "cc-mm-v", text: selectedInstance.instance_id })
    ]));

    panel.appendChild(numberField("X", selectedInstance.x, "1", function (v) {
      selectedInstance.x = Number(v || 0);
      syncInstanceMarker(selectedInstance);
    }));

    panel.appendChild(numberField("Y", selectedInstance.y, "1", function (v) {
      selectedInstance.y = Number(v || 0);
      syncInstanceMarker(selectedInstance);
    }));

    panel.appendChild(numberField("Rotation", selectedInstance.rotation_deg || 0, "1", function (v) {
      selectedInstance.rotation_deg = Number(v || 0);
      syncInstanceMarker(selectedInstance);
    }));

    panel.appendChild(numberField("Scale", selectedInstance.scale || 1, "0.05", function (v) {
      selectedInstance.scale = clamp(Number(v || 1), 0.1, 5);
      syncInstanceMarker(selectedInstance);
    }));

    panel.appendChild(numberField("Z Index", selectedInstance.z_index || 0, "1", function (v) {
      selectedInstance.z_index = Number(v || 0);
      syncInstanceMarker(selectedInstance);
    }));

    panel.appendChild(textField("Tags (comma separated)", (selectedInstance.tags || []).join(", "), function (v) {
      selectedInstance.tags = String(v || "")
        .split(",")
        .map(function (x) { return x.trim(); })
        .filter(Boolean);
    }));

    panel.appendChild(el("div", {
      class: "cc-mm-help",
      text: "You can also drag the selected terrain directly on the map."
    }));
  }

  function initLeaflet() {
    if (!window.L) throw new Error("Leaflet is not loaded.");

    var mapEl = state.ui.mapEl;
    mapEl.innerHTML = "";

    var map = L.map(mapEl, {
      crs: L.CRS.Simple,
      minZoom: -3,
      maxZoom: 3,
      zoomSnap: 0.25,
      attributionControl: false
    });

    var bounds = [[0, 0], [state.instanceData.map_size_px.h, state.instanceData.map_size_px.w]];
    state.imageBounds = bounds;

    L.imageOverlay(state.instanceData.map_image, bounds).addTo(map);
    map.fitBounds(bounds);

    map.on("click", function (ev) {
      if (!state.selectedTerrainTypeId) return;
      placeTerrainAt(ev.latlng);
    });

    state.map = map;
  }

  function buildAssetUrl(assetFile) {
    if (!assetFile) return "";
    if (/^https?:\/\//i.test(assetFile)) return assetFile;
    return state.opts.assetBaseUrl.replace(/\/+$/, "") + "/" + assetFile.replace(/^\/+/, "");
  }

  function getTerrainSizeGuess(terrain) {
    var fp = terrain && terrain.footprint && terrain.footprint.size_in;
    var w = fp && fp.w ? fp.w : 4;
    var d = fp && fp.d ? fp.d : w;
    return {
      widthPx: Math.round(w * 28),
      heightPx: Math.round(d * 28 + ((terrain && terrain.footprint && terrain.footprint.base_height_in) || 2) * 10)
    };
  }

  function buildMarkerHtml(instance, terrain) {
    var url = buildAssetUrl(terrain.asset_file);
    var guess = getTerrainSizeGuess(terrain);
    var scale = instance.scale || 1;
    var rotation = instance.rotation_deg || 0;

    var width = Math.max(24, Math.round(guess.widthPx * scale));
    var height = Math.max(24, Math.round(guess.heightPx * scale));

    return (
      '<div class="cc-mm-terrain-wrap" data-instance-id="' + escapeHtml(instance.instance_id) + '">' +
        '<img class="cc-mm-terrain-img' + (state.selectedInstanceId === instance.instance_id ? ' is-selected' : '') + '"' +
        ' src="' + escapeHtml(url) + '"' +
        ' draggable="false"' +
        ' style="width:' + width + 'px;height:' + height + 'px;transform: rotate(' + rotation + 'deg);" />' +
      '</div>'
    );
  }

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function buildDivIcon(instance, terrain) {
    var guess = getTerrainSizeGuess(terrain);
    var scale = instance.scale || 1;
    var width = Math.max(24, Math.round(guess.widthPx * scale));
    var height = Math.max(24, Math.round(guess.heightPx * scale));

    return L.divIcon({
      className: "cc-mm-div-icon",
      html: buildMarkerHtml(instance, terrain),
      iconSize: [width, height],
      iconAnchor: [Math.round(width / 2), height]
    });
  }

  function addInstanceMarker(instance) {
    var terrain = state.terrainById[instance.terrain_type_id];
    if (!terrain) return;

    var marker = L.marker([instance.y, instance.x], {
      draggable: true,
      icon: buildDivIcon(instance, terrain),
      zIndexOffset: (instance.z_index || 0) + Math.round(instance.y || 0)
    }).addTo(state.map);

    marker.on("click", function (ev) {
      L.DomEvent.stopPropagation(ev);
      selectInstance(instance.instance_id);
    });

    marker.on("dragend", function () {
      var ll = marker.getLatLng();
      instance.x = Math.round(ll.lng);
      instance.y = Math.round(ll.lat);
      syncInstanceMarker(instance);
      renderInspector();
    });

    state.markersByInstanceId[instance.instance_id] = marker;

    setTimeout(function () {
      var elNode = marker.getElement();
      if (!elNode) return;
      elNode.style.pointerEvents = "auto";
    }, 0);
  }

  function syncInstanceMarker(instance) {
    var marker = state.markersByInstanceId[instance.instance_id];
    var terrain = state.terrainById[instance.terrain_type_id];
    if (!marker || !terrain) return;

    marker.setLatLng([instance.y, instance.x]);
    marker.setIcon(buildDivIcon(instance, terrain));
    marker.setZIndexOffset((instance.z_index || 0) + Math.round(instance.y || 0));
    renderInspector();
  }

  function clearAllMarkers() {
    Object.keys(state.markersByInstanceId).forEach(function (id) {
      var marker = state.markersByInstanceId[id];
      if (marker && state.map) state.map.removeLayer(marker);
    });
    state.markersByInstanceId = {};
  }

  function loadInstancesData(data) {
    if (!data || !Array.isArray(data.instances)) {
      alert("This file does not look like a terrain instances file.");
      return;
    }

    state.instanceData = deepClone(data);

    state.ui.mapTitleInput.value = state.instanceData.map_title || "";
    state.ui.mapIdInput.value = state.instanceData.map_id || "";
    state.ui.locationSelect.value = state.instanceData.location_id || "";

    clearAllMarkers();

    if (state.map) {
      state.map.remove();
      state.map = null;
    }

    initLeaflet();

    state.instanceData.instances.forEach(function (instance) {
      addInstanceMarker(instance);
    });

    state.selectedInstanceId = null;
    renderInspector();
  }

  function getSelectedInstance() {
    if (!state.selectedInstanceId) return null;
    return state.instanceData.instances.find(function (x) {
      return x.instance_id === state.selectedInstanceId;
    }) || null;
  }

  function selectInstance(instanceId) {
    state.selectedInstanceId = instanceId;

    state.instanceData.instances.forEach(function (inst) {
      syncInstanceMarker(inst);
    });

    renderInspector();
  }

  function placeTerrainAt(latlng) {
    var terrain = state.terrainById[state.selectedTerrainTypeId];
    if (!terrain) return;

    var instance = {
      instance_id: makeId("terrain"),
      terrain_type_id: terrain.terrain_type_id,
      x: Math.round(latlng.lng),
      y: Math.round(latlng.lat),
      rotation_deg: 0,
      scale: terrain.editor_defaults && terrain.editor_defaults.scale ? terrain.editor_defaults.scale : 1,
      mirror_x: false,
      mirror_y: false,
      z_index: 0,
      opacity: 1,
      locked: false,
      hidden_in_editor: false,
      state: {
        destroyed: false,
        disabled: false,
        variant_override: null
      },
      slot_bindings: [],
      tags: [],
      notes: ""
    };

    state.instanceData.instances.push(instance);
    addInstanceMarker(instance);
    selectInstance(instance.instance_id);
  }

  function deleteSelectedInstance() {
    var selected = getSelectedInstance();
    if (!selected) return;

    if (!confirm("Delete selected terrain instance?")) return;

    var marker = state.markersByInstanceId[selected.instance_id];
    if (marker && state.map) {
      state.map.removeLayer(marker);
    }
    delete state.markersByInstanceId[selected.instance_id];

    state.instanceData.instances = state.instanceData.instances.filter(function (x) {
      return x.instance_id !== selected.instance_id;
    });

    state.selectedInstanceId = null;
    renderInspector();
  }

  function clearAllInstances() {
    clearAllMarkers();
    state.instanceData.instances = [];
    state.selectedInstanceId = null;
    renderInspector();
  }

  function exportJson() {
    var payload = deepClone(state.instanceData);

    var blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: "application/json"
    });

    var fileName = (payload.map_id || "map") + "_instances.json";
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);

    setTimeout(function () {
      URL.revokeObjectURL(url);
    }, 1000);
  }

  function initData() {
    var opts = state.opts;

    return Promise.all([
      fetchJson(opts.terrainCatalogUrl),
      fetchJson(opts.locationsUrl),
      opts.initialInstancesUrl ? fetchJson(opts.initialInstancesUrl) : Promise.resolve(null)
    ]).then(function (results) {
      state.terrainCatalog = results[0];
      state.locations = normalizeLocations(results[1]);

      getTerrainTypes().forEach(function (item) {
        state.terrainById[item.terrain_type_id] = item;
      });

      if (results[2] && Array.isArray(results[2].instances)) {
        state.instanceData = results[2];
      } else {
        state.instanceData = {
          map_id: opts.defaultMapId,
          map_title: opts.defaultMapTitle,
          location_id: opts.defaultLocationId,
          map_image: opts.mapImageUrl,
          map_size_px: { w: opts.mapWidth, h: opts.mapHeight },
          instances: []
        };
      }
    });
  }

    function mount(root, userOpts) {
    if (!root) throw new Error("Map Maker mount root is required.");

    state.opts = mergeOpts(userOpts || {});

    return Promise.resolve()
      .then(function () {
        return initData();
      })
      .then(function () {
        buildLayout(root);
        initLeaflet();

        state.instanceData.instances.forEach(function (instance) {
          addInstanceMarker(instance);
        });

        renderLocationOptions(state.ui.locationSelect);
      })
      .catch(function (err) {
        console.error("Map Maker failed:", err);
        root.innerHTML = '<div style="padding:16px;color:#f88;background:#1a1a1a;border:1px solid #533;">Map Maker failed: ' +
          escapeHtml(err.message) + "</div>";
      });
  }

  window.CC_APP_MAP_MAKER = {
    mount: mount
  };
})();
