CCFB.define("components/skeleton", function(C) {
    return {
        draw: function() {
            // DOMAIN_SAFETY: Commandment v1.9 - Protect Odoo Editor
            if (window.location.href.includes("/web")) return;

            const root = document.getElementById("ccfb-root");
            if (!root) return;

            // Strict 3-Column Design with independent scrolling
            root.innerHTML = `
                <div id="ccfb-app">
                    <div class="cc-header-area">
                        <h1>COFFIN CANYON FACTION BUILDER</h1>
                        <div class="sub-header-row d-flex align-items-center">
                            <select id="f-selector" onchange="window.CCFB.handleFactionChange(this.value)">
                                <option value="">SELECT FACTION...</option>
                            </select>
                            <input type="text" id="roster-name" placeholder="ROSTER NAME">
                            <div class="top-tools ml-auto">
                                <span id="display-total" title="Liberty Bucks">0 ₤</span>
                                <button onclick="window.CCFB.shareRoster()" title="Share"><i class="fa fa-share-alt"></i></button>
                                <button onclick="window.printRoster()" title="Print"><i class="fa fa-print"></i></button>
                            </div>
                        </div>
                    </div>

                    <div class="cc-grid">
                        <div class="cc-panel" id="ccfb-lib" style="overflow-y: auto;">
                            <div class="cc-panel-title"><h4>Unit Library</h4></div>
                            <div id="lib-target"></div>
                        </div>
                        <div class="cc-panel" id="ccfb-roster" style="overflow-y: auto;">
                            <div class="cc-panel-title"><h4>Roster</h4></div>
                            <div id="rost-target"></div>
                        </div>
                        <div class="cc-panel" id="ccfb-details" style="overflow-y: auto;">
                            <div class="cc-panel-title"><h4>Unit Detail</h4></div>
                            <div id="det-target">
                                <div class="cc-empty-state">Select a unit to view details</div>
                            </div>
                        </div>
                    </div>
                </div>
            `;
            this.populateDropdown();
        },
        populateDropdown: function() {
            CCFB.require(["config/docTokens"], (cfg) => {
                const sel = document.getElementById("f-selector");
                if (!sel) return;
                cfg.factions.forEach(f => {
                    const opt = document.createElement("option");
                    opt.value = f.key;
                    opt.textContent = f.label.toUpperCase();
                    sel.appendChild(opt);
                });
            });
        }
    };
});