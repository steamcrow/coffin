CCFB.define("main", function (C) {
    // 1. Initialize Global UI State
    // We define this on 'C' for internal logic and 'window.CCFB' for the Painter
    C.ui = {
        fKey: "monster-rangers",
        budget: 500,
        mode: "grid",
        roster: [],
        sId: null
    };
    
    // Create the global bridge
    window.CCFB.ui = C.ui;

    // 2. Helper: Find unit data across factions
    C.getUnit = function(fKey, unitName) {
        if (!C.state || !C.state.factions) return null;
        const faction = C.state.factions[fKey];
        if (!faction || !faction.units) return null;
        return faction.units.find(u => u.name === unitName);
    };

    // 3. Helper: Calculate total cost of the current roster
    C.calculateTotal = function() {
        if (!C.ui || !C.ui.roster) return 0;
        return C.ui.roster.reduce((sum, item) => {
            // We use the cost stored in the roster item for speed
            return sum + (item.cost || 0);
        }, 0);
    };

    // 4. Global Action: Handle Faction Change (Dropdown)
    window.CCFB.handleFactionChange = function(newKey) {
        console.log("🚀 Faction Change Triggered:", newKey);
        C.ui.fKey = newKey;
        CCFB.require(["data/loaders"], function(loaders) {
            loaders.loadFaction(newKey).then(function() {
                if (window.CCFB.refreshUI) window.CCFB.refreshUI();
            });
        });
    };

    // 5. Global Action: Handle Budget Change (Dropdown)
    window.CCFB.handleBudgetChange = function(newBudget) {
        console.log("💰 Budget Change Triggered:", newBudget);
        C.ui.budget = parseInt(newBudget);
        if (window.CCFB.refreshUI) window.CCFB.refreshUI();
    };

    // 6. Global Action: Share Roster
    window.CCFB.shareRoster = function() {
        alert("Share feature coming soon! Your roster has " + C.ui.roster.length + " units.");
    };

    // 7. Global Action: Print Roster
    window.printRoster = function() {
        window.print();
    };

    // 8. The Boot Sequence
    // This runs when the app first starts
    const mainModule = {
        boot: function (containerId, factionFolder) {
            ccfbLog("🚀 Brain: Booting System...");
            
            // Set the data path
            C.state.dataBaseUrl = factionFolder;

            CCFB.require(["data/loaders"], function (loaders) {
                // First, load the core game rules
                loaders.loadRules().then(function() {
                    ccfbLog("✅ Rules Loaded. Loading Default Faction...");
                    
                    // Load the default faction (Monster Rangers)
                    return loaders.loadFaction(C.ui.fKey);
                }).then(function() {
                    ccfbLog("✅ Faction Loaded. Initializing UI...");
                    
                    C.state.loading = false;
                    
                    // Final refresh to draw the screen
                    if (window.CCFB.refreshUI) {
                        window.CCFB.refreshUI();
                    }
                }).catch(function(err) {
                    console.error("❌ Boot Error:", err);
                });
            });
        }
    };

    return mainModule;
});