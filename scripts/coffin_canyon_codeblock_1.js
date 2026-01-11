<div id="ccfb-1-bootstrap"></div>
<script>
/* =========================================================
   CCFB 1 — Bootstrap + Toast Loader (ROBUST VERSION)
   ========================================================= */
(function () {
  // Guard for Odoo backend
  if (window.location.href.includes("/web")) return;

  var BOOT_KEY = "__CCFB_BOOTED__v4";
  if (window[BOOT_KEY]) return;
  window[BOOT_KEY] = true;

  var CCFB = (window.CCFB = window.CCFB || {});
  CCFB.version = "rebuild-v4";

  var registry = (CCFB._registry = {});
  var cache = (CCFB._cache = {});

  // --- Module System ---
  CCFB.define = function (name, factory) {
    registry[name] = factory;
  };

  CCFB.require = function (names, onReady) {
    var exportsList = names.map(function (n) {
      if (cache[n]) return cache[n];
      if (!registry[n]) {
        var err = "Missing module: " + n;
        if (CCFB.Toast) CCFB.Toast.error(err);
        throw new Error(err);
      }
      var out = registry[n](CCFB) || {};
      cache[n] = out;
      return out;
    });
    return onReady.apply(null, exportsList);
  };

  // --- Optimized Toast (Cached Reference) ---
  var toastEl = null;
  var toastBox = null;
  var toastTimer = null;

  function initToast() {
    if (toastEl) return;

    toastEl = document.createElement("div");
    toastEl.id = "ccfb-toast";
    // Non-blocking, fixed position container
    toastEl.style.cssText = "position:fixed; left:0; right:0; top:20px; z-index:99999; display:none; pointer-events:none; text-align:center;";

    toastBox = document.createElement("div");
    toastBox.style.cssText = "display:inline-block; max-width:90%; padding:10px 16px; border-radius:8px; background:rgba(20,20,20,.95); border:1px solid rgba(255,255,255,.15); color:#fff; font-weight:700; font-size:13px; box-shadow: 0 4px 12px rgba(0,0,0,0.5);";

    toastEl.appendChild(toastBox);
    document.body.appendChild(toastEl);
  }

  function show(msg, duration) {
    initToast();
    var time = duration || 1600;
    toastBox.textContent = msg || "Working...";
    toastEl.style.display = "block";
    
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(hide, time);
  }

  function hide() {
    if (toastEl) toastEl.style.display = "none";
  }

  function error(msg) {
    show("❌ " + (msg || "Error"), 3000);
  }

  CCFB.Toast = { show: show, hide: hide, error: error };

  // Proof of Life
  CCFB.Toast.show("System Initialized ✓");
})();
	</script>
