CCFB.define("components/skeleton", function(C) {
    return {
        draw: function() {
            // 1. DOMAIN_SAFETY: Commandment v1.9 - Protect Odoo Editor
            // This preserves your original check to ensure the builder doesn't break the editor
            if (window.location.href.includes("/web")) return;
            
            const root = document.getElementById("ccfb-root");
            if (!root) return;

            // 2. Configuration for dynamic elements
            const budgets = [500, 1000, 1500, 2000];

            // 3. Strict 3-Column Design with independent scrolling
            // All original IDs and styles are preserved here
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
                                <span id="display-total" title="Liberty Bucks">0 ₤</span>
                                <button onclick="window.CCFB.shareRoster()" title="Share"><i class="fa fa-share-alt"></i></button>
                                <button onclick="window.printRoster()" title="Print"><i class="fa fa-print"></i></button>
                            </div>
                        </div>
                    </div>

                    <div class="cc-grid">
                        ${['lib', 'roster', 'details'].map(id => `
                            <div class="cc-panel" id="ccfb-${id}" style="overflow-y: auto;">
                                <div class="cc-panel-title">
                                    <h4>${id === 'lib' ? 'Unit Library' : id.charAt(0).toUpperCase() + id.slice(1)}</h4>
                                </div>
                                <div id="${id === 'details' ? 'det' : id.slice(0,4)}-target">
                                    ${id === 'details' ? '<div class="cc-empty-state">Select a unit to view details</div>' : ''}
                                </div>
                            </div>
                        `).join('')}
                    </div>
                </div>
            `;
            
            this.populateDropdown();

            // 4. TIMING FIX: Ensures "The Brain" is ready before setting the budget
            setTimeout(() => {
                if (window.CCFB && typeof window.CCFB.handleBudgetChange === "function") {
                    const budgetEl = document.getElementById("budget-selector");
                    if (budgetEl) {
                        window.CCFB.handleBudgetChange(budgetEl.value);
                    }
                }
            }, 100);
        },

        populateDropdown: function() {
            CCFB.require(["config/docTokens"], (cfg) => {
                const sel = document.getElementById("f-selector");
                if (!sel || !cfg.factions) return;

                // Restores your cleaner map/join insertion
                sel.innerHTML += cfg.factions.map(f => 
                    `<option value="${f.key}">${f.label.toUpperCase()}</option>`
                ).join('');

                // Sets default selection as per original design
                sel.value = "monster-rangers";
            });
        }
    };
});