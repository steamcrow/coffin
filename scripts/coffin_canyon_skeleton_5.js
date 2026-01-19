window.CCFB.define("components/skeleton", function(CCFB) {
    return {
        draw: function() {
            if (window.location.href.includes("/web")) return;

            const root = document.getElementById("ccfb-root");
            if (!root) return;

            const budgets = [500, 1000, 1500, 2000];

            root.innerHTML = `
                <div id="ccfb-app">
                    <div class="cc-header-area">
                        <h1>COFFIN CANYON FACTION BUILDER</h1>
                        <div class="sub-header-row d-flex align-items-center" style="gap: 10px; flex-wrap: wrap;">
                            
                            <select id="f-selector" onchange="window.CCFB.handleFactionChange(this.value)">
                                <option value="">SELECT FACTION...</option>
                            </select>

                            <select id="budget-selector" onchange="window.CCFB.handleBudgetChange(this.value)">
                                ${budgets.map(b => `<option value="${b}">${b} ₤</option>`).join('')}
                            </select>

                            <input type="text" id="roster-name" placeholder="ROSTER NAME">

                            <div class="top-tools ml-auto" style="display: flex; align-items: center; gap: 8px;">
                                <span id="display-total" style="color: #ff7518; font-weight: 800; font-size: 18px; margin-right: 5px;">0 ₤</span>
                                
                                <button id="view-toggle-btn" onclick="window.CCFB.toggleViewMode()" title="Switch View">
                                    <i class="fa fa-list"></i>
                                </button>

                                <button onclick="window.CCFB.shareRoster()" title="Share"><i class="fa fa-share-alt"></i></button>
                                <button onclick="window.printRoster()" title="Print"><i class="fa fa-print"></i></button>
                            </div>
                        </div>
                    </div>

                    <div class="cc-grid">
                        <div class="cc-panel" id="panel-library">
                            <div class="cc-panel-title"><h4>Unit Library</h4></div>
                            <div id="lib-target"></div>
                        </div>

                        <div class="cc-panel" id="panel-roster">
                            <div class="cc-panel-title"><h4>Roster</h4></div>
                            <div id="rost-target"></div>
                        </div>

                        <div class="cc-panel" id="ccfb-details">
                            <div class="cc-panel-title"><h4>Details</h4></div>
                            <div id="det-target">
                                <div class="cc-empty-state" style="text-align: center; padding-top: 50px; opacity: 0.5;">
                                    Select a unit to view details
                                </div>
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
                if (!sel || !cfg.factions) return;

                sel.innerHTML = `<option value="">SELECT FACTION...</option>` + cfg.factions.map(f =>
                    `<option value="${f.key}">${f.label.toUpperCase()}</option>`
                ).join('');

                sel.value = CCFB.ui.fKey || "monster_rangers";
            });
        }
    };
});
