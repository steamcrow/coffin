CCFB.define("core/brain", function (C) {
  // We pull in the loaders we defined in File 3
  CCFB.require(["ui", "data/loaders"], function (ui, loaders) {
    
    // This is the main "Start" command
    CCFB.boot = function (containerId, factionFolder) {
      // 1. Set the global URL prefix (from your Odoo script)
      C.state.dataBaseUrl = factionFolder;

      // 2. Build the visual "Skeleton" (File 5)
      ui.init(containerId);

      // 3. Load the Rules (The "Fuel")
      loaders.loadRules().then(function() {
        console.log("Rules acquired. Removing spinner...");
        
        // 4. KILL THE SPINNER
        C.state.loading = false;
        
        // 5. Redraw the screen with the actual builder
        if (window.CCFB.refreshUI) window.CCFB.refreshUI();
      });
    };
  });

  return {
    // You can put extra logic here if needed
  };
});
