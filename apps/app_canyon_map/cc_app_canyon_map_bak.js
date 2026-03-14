/* File: apps/app_canyon_map/cc_app_canyon_map.js
   CC Core Loader wrapper — MUST define window.CC_APP.init synchronously.
*/
(function () {
  "use strict";

  function resolveMountRoot(input) {
    if (input && input.nodeType === 1) {
      return input;
    }

    if (typeof input === "string") {
      return document.querySelector(input);
    }

    if (input && typeof input === "object") {
      if (input.root && input.root.nodeType === 1) {
        return input.root;
      }
      if (input.el && input.el.nodeType === 1) {
        return input.el;
      }
      if (input.mountEl && input.mountEl.nodeType === 1) {
        return input.mountEl;
      }
      if (input.container && input.container.nodeType === 1) {
        return input.container;
      }
      if (typeof input.selector === "string") {
        return document.querySelector(input.selector);
      }
    }

    return null;
  }

  function resolveOptions(input, opts) {
    if (opts && typeof opts === "object") {
      return opts;
    }

    if (input && typeof input === "object" && !input.nodeType) {
      if (input.opts && typeof input.opts === "object") {
        return input.opts;
      }
      if (input.options && typeof input.options === "object") {
        return input.options;
      }
    }

    return {};
  }

  async function loadScriptViaBlob(url) {
    const res = await fetch(url + "?t=" + Date.now());
    if (!res.ok) {
      throw new Error("Fetch failed: " + url);
    }

    const code = await res.text();
    const blob = new Blob([code], { type: "text/javascript" });
    const blobUrl = URL.createObjectURL(blob);

    return new Promise((resolve, reject) => {
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
  }

  // Define immediately so the core loader can see it right away.
  window.CC_APP = {
    app_id: "canyon_map",

    init: async function init(rootEl, opts) {
      const APP_MAIN =
        "https://raw.githubusercontent.com/steamcrow/coffin/main/apps/app_canyon_map/cc_canyon_map_app.js";

      const mountRoot = resolveMountRoot(rootEl);
      const mountOpts = resolveOptions(rootEl, opts);

      console.log("🧭 canyon_map init input:", rootEl);
      console.log("🧭 canyon_map resolved mountRoot:", mountRoot);
      console.log("🧭 canyon_map resolved mountOpts:", mountOpts);

      if (!mountRoot || mountRoot.nodeType !== 1) {
        throw new Error("cc_app_canyon_map.js: could not resolve a valid mount root.");
      }

      await loadScriptViaBlob(APP_MAIN);

      if (!window.CC_CanyonMap || typeof window.CC_CanyonMap.mount !== "function") {
        throw new Error("CC_CanyonMap.mount missing after loading main app.");
      }

      return await window.CC_CanyonMap.mount(mountRoot, mountOpts);
    }
  };

  console.log("✅ cc_app_canyon_map.js loaded, CC_APP.init ready");
})();
