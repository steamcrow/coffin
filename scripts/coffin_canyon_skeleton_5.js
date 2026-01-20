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
                        <div id="auth-status-bar" style="text-align: center; padding: 8px; margin-bottom: 10px; background: rgba(0,0,0,0.3); border-radius: 4px; font-size: 12px; color: #999;">
                            Checking login status...
                        </div>
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
                                
                                <button onclick="window.CCFB.clearRoster()" title="Clear Roster">
                                    <i class="fa fa-times-circle"></i>
                                </button>
                                <button onclick="window.CCFB.saveRoster()" title="Save Roster">
                                    <i class="fa fa-save"></i>
                                </button>
                                <button onclick="window.CCFB.loadRosterList()" title="Load Roster">
                                    <i class="fa fa-folder-open"></i>
                                </button>
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
            this.checkLoginStatus();
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
        },
        checkLoginStatus: async function() {
            try {
                const response = await fetch('/web/session/get_session_info', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    credentials: 'include',
                    body: JSON.stringify({})
                });
                
                const statusBar = document.getElementById("auth-status-bar");
                if (!statusBar) return;
                
                if (!response.ok) {
                    statusBar.innerHTML = '⚠️ Not logged in - <a href="/web/login" style="color: var(--pumpkin);">Sign in</a> to save rosters';
                    statusBar.style.background = 'rgba(200, 50, 50, 0.2)';
                    return;
                }
                
                const userData = await response.json();
                if (userData.result && userData.result.uid) {
                    const userName = userData.result.name || userData.result.username || 'User';
                    statusBar.innerHTML = `✓ Logged in as <strong>${userName}</strong>`;
                    statusBar.style.background = 'rgba(50, 200, 100, 0.2)';
                    statusBar.style.color = '#8f8';
                } else {
                    statusBar.innerHTML = '⚠️ Not logged in - <a href="/web/login" style="color: var(--pumpkin);">Sign in</a> to save rosters';
                    statusBar.style.background = 'rgba(200, 50, 50, 0.2)';
                }
            } catch (e) {
                const statusBar = document.getElementById("auth-status-bar");
                if (statusBar) {
                    statusBar.innerHTML = '⚠️ Not logged in - <a href="/web/login" style="color: var(--pumpkin);">Sign in</a> to save rosters';
                    statusBar.style.background = 'rgba(200, 50, 50, 0.2)';
                }
            }
        }
    };
});
