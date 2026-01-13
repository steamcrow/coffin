CCFB.define("components/skeleton", function(C) {
    return {
        draw: function() {
            // DOMAIN SAFETY: Protect the Odoo editor [cite: 44, 45]
            if (window.location.href.includes("/web")) return;

            const root = document.getElementById("ccfb-root");
            if (!root) return;

            root.innerHTML = `
                <div class="cc-container" style="display: flex; flex-direction: column; height: 100vh; overflow: hidden;">
                    <div class="cc-header-area p-3" style="flex-shrink: 0; background: #1a1a1a; border-bottom: 2px solid #333;">
                        <h1 style="color: #ff7518; margin: 0;">COFFIN CANYON FACTION BUILDER</h1>
                        
                        <div class="cc-sub-header d-flex align-items-center justify-content-between mt-2">
                            <div class="d-flex align-items-center">
                                <select id="f-selector" class="form-control mr-2" style="width:220px;" onchange="window.CCFB.handleFactionChange(this.value)">
                                    <option value="">SELECT FACTION...</option>
                                </select>
                                <input type="text" id="roster-name" class="form-control" placeholder="ROSTER NAME" style="width:220px;">
                            </div>
                            
                            <div class="cc-top-tools d-flex align-items-center">
                                <span id="display-total" class="mr-3" style="font-weight:bold; font-size:1.4rem; color: #ff7518;">0 ₤</span>
                                <button class="btn btn-outline-light mr-1" onclick="window.CCFB.shareRoster()" title="Share Link"><i class="fa fa-share-alt"></i></button>
                                <button class="btn btn-outline-light" onclick="window.printRoster()" title="Print List"><i class="fa fa-print"></i></button>
                            </div>
                        </div>
                    </div>

                    <div class="cc-main-grid" style="display: flex; flex: 1; overflow: hidden;">
                        <div class="cc-col p-3" id="lib-col" style="flex: 1; overflow-y: auto; border-right: 1px solid #333;">
                            <h2>UNIT LIBRARY</h2>
                            <div id="lib-target"></div>
                        </div>
                        <div class="cc-col p-3" id="rost-col" style="flex: 1; overflow-y: auto; border-right: 1px solid #333;">
                            <h2>ROSTER</h2>
                            <div id="rost-target"></div>
                        </div>
                        <div class="cc-col p-3" id="det-col" style="flex: 1; overflow-y: auto;">
                            <h2>UNIT DETAIL</h2>
                            <div id="det-target"></div>
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