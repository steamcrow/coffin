CCFB.define("components/skeleton", function(C) {
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
                        <div class="sub-header-row d-flex align-items-center">
                            <select id="f-selector" onchange="window.CCFB.handleFactionChange(this.value)">
                                <option value="">SELECT FACTION...</option>
                            </select>

                            <select id="budget-selector" onchange="window.CCFB.handleBudgetChange(this.value)">
                                ${budgets.map(b => `<option value="${b}">${b} ₤</option>`).join('')}
                            </select>

                            <input type="text" id="roster-name" placeholder="ROSTER NAME">

                            <div class="top-tools ml-auto">
                                <button onclick="window.CCFB.toggleViewMode('card')" title="Card View"><i class="fa fa-th-large"></i></button>
                                <button onclick="window.CCFB.toggleViewMode('list')" title="List View"><i class="fa fa-list"></i></button>
                                <span id="display-total">0 ₤</span>
                                <button onclick="window.CCFB.shareRoster()"><i class="fa fa-share-alt"></i></button>
                                <button onclick="window.printRoster()"><i class="fa fa-print"></i></button>
                            </div>      
                    </div>

                    <div class="cc-grid">
                        <div class="cc-panel" id="ccfb-lib">
                            <div class="cc-panel-title"><h4>Unit Library</h4></div>
                            <div id="lib-target"></div>
                        </div>

                        <div class="cc-panel" id="ccfb-roster">
                            <div class="cc-panel-title"><h4>Roster</h4></div>
                            <div id="rost-target"></div>
                        </div>

                        <div class="cc-panel" id="ccfb-details">
                            <div class="cc-panel-title"><h4>Details</h4></div>
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
                if (!sel || !cfg.factions) return;

                sel.innerHTML = `<option value="">SELECT FACTION...</option>` + cfg.factions.map(f =>
                    `<option value="${f.key}">${f.label.toUpperCase()}</option>`
                ).join('');

                sel.value = "monster_rangers";

                if (window.CCFB && typeof window.CCFB.handleFactionChange === "function") {
                    window.CCFB.handleFactionChange(sel.value);
                } else {
                    sel.dispatchEvent(new Event("change", { bubbles: true }));
                }
            });
        }
    };
});
