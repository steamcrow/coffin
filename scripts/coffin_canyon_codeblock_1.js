<script>
  document.addEventListener("DOMContentLoaded", function () {
    console.log("CCFB Diagnostic: DOM ready, starting boot sequence...");

    let attempts = 0;
    const maxAttempts = 20; // Try for 10 seconds total

    function tryBoot() {
      attempts++;

      // Check for the CCFB module system
      if (window.CCFB && typeof window.CCFB.require === "function") {
        console.log("✅ CCFB Module System Detected. Attempting to require 'main'...");

        const factionFolder = "https://cdn.jsdelivr.net/gh/steamcrow/coffin@main/factions/";

        // Attempt to require the main module
        window.CCFB.require(["main"], function (main) {
          if (main && typeof main.boot === "function") {
            console.log("✅ CCFB Main Boot Function Found. Booting app...");
            main.boot("#ccfb-app-root", factionFolder);
          } else {
            console.error("❌ CCFB Main Module Loaded but 'boot' not found.");
            if (window.CCFB.Toast && typeof window.CCFB.Toast.error === "function") {
              window.CCFB.Toast.error("Main module loaded, but no boot() found!");
            } else {
              alert("Main module loaded, but no boot() function was defined.");
            }
          }
        });

      } else if (attempts < maxAttempts) {
        console.log("🔄 CCFB not ready yet... retrying (" + attempts + "/" + maxAttempts + ")");
        setTimeout(tryBoot, 500);
      } else {
        console.error("❌ CCFB Module System never became available.");
        alert("CRITICAL ERROR: The scripts are on GitHub, but they aren't activating inside Odoo. Check File 1 for syntax or CSP issues.");
      }
    }

    // Start boot retry loop
    tryBoot();
  });
</script>