window.CCFB.define("components/skeleton", function(CCFB) {

    // =========================================================
    // STEP 1 — Canonical faction icon map (single source of truth)
    // =========================================================
    window.CCFB.FACTION_ICONS = {
        monster_rangers: "fa-compass",
        monsterology: "fa-skull-crossbones",
        monsters: "fa-ghost",
        shine_riders: "fa-hat-cowboy-side",
        liberty_corps: "fa-flag-usa"
    };

    // =========================================================
    // STEP 2 — Faction icon renderer (FA6-correct)
    // =========================================================
    window.CCFB.renderFactionIcon = function(factionKey) {
        const faClass = window.CCFB.FACTION_ICONS[factionKey] || "fa-circle-question";
        return `
            <span class="cc-faction-icon" data-faction="${factionKey}">
                <i class="fa-solid ${faClass}"></i>
            </span>
        `;
    };

    return {
        /**
         * The Main Draw Function - NEW 3-COLUMN LAYOUT
         */
        draw: function() {
            if (window.location.href.includes("/web") && !window.location.href.includes("ccfb")) return;

            const root = document.getElementById("ccfb-root");
            if (!root) return;

            // Load Font Awesome
            if (!document.getElementById('cc-fa-icons')) {
                console.log('🎨 Loading Font Awesome...');
                const fa = document.createElement('link');
                fa.id = 'cc-fa-icons';
                fa.rel = 'stylesheet';
                fa.href = 'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.0/css/all.min.css';
                document.head.appendChild(fa);
            }

            // Load Coffin Canyon CSS
            if (!document.getElementById('cc-coffin-styles')) {
                console.log('🎃 Loading Coffin Canyon CSS...');
                fetch('https://raw.githubusercontent.com/steamcrow/coffin/main/scripts/coffin.css?t=' + Date.now())
                    .then(res => res.text())
                    .then(css => {
                        const style = document.createElement('style');
                        style.id = 'cc-coffin-styles';
                        style.textContent = css;
                        document.head.appendChild(style);
                        console.log('✅ Coffin Canyon CSS applied!');
                    })
                    .catch(err => console.error('❌ CSS load failed:', err));
            }

            const budgets = [500, 1000, 1500, 2000, 2500, 3000];
            
            root.innerHTML = `
                <div id="ccfb-app">
                    <div class="cc-header-area">
                        <div class="d-flex justify-content-between align-items-end mb-2">
                            <h1 class="m-0" style="font-weight: 900; letter-spacing: -1px;">COFFIN CANYON <span style="color:var(--cc-primary)">FACTION BUILDER</span></h1>
                            <div id="display-total">0 / 0 ₤</div>
                        </div>

                        <div id="auth-status-bar" style="text-align: center; padding: 6px; margin-bottom: 12px; background: rgba(0,0,0,0.4); border: 1px solid var(--cc-border); border-radius: 4px; font-size: 11px; color: #888; text-transform: uppercase; letter-spacing: 1px;">
                            <i class="fa fa-spinner fa-spin"></i> Synchronizing with Odoo Session...
                        </div>

                        <div class="sub-header-row d-flex align-items-center" style="gap: 10px; flex-wrap: wrap;">
                            <div class="d-flex align-items-center" style="flex-grow: 1; gap: 8px;">
                                <select id="f-selector" onchange="window.CCFB.handleFactionChange(this.value)" class="cc-select">
                                    <option value="">SELECT FACTION...</option>
                                </select>

                                <select id="budget-selector" onchange="window.CCFB.handleBudgetChange(this.value)" class="cc-select">
                                    <option value="0">UNLIMITED ₤</option>
                                    ${budgets.map(b => `<option value="${b}" ${CCFB.ui.budget == b ? 'selected' : ''}>${b} ₤</option>`).join('')}
                                </select>

                                <input type="text" id="roster-name" class="cc-input" placeholder="ROSTER NAME..." 
                                       oninput="CCFB.ui.rosterName = this.value" value="${CCFB.ui.rosterName || ''}">
                            </div>

                            <div class="top-tools ml-auto d-flex" style="gap: 6px;">
                                <button class="cc-tool-btn" onclick="window.CCFB.clearRoster()" title="Clear Roster"><i class="fa fa-refresh"></i></button>
                                <button class="cc-tool-btn" onclick="window.CCFB.saveRoster()" title="Save Roster (To Odoo)"><i class="fa fa-save"></i></button>
                                <button class="cc-tool-btn" onclick="window.CCFB.loadRosterList()" title="Load Saved Rosters"><i class="fa fa-folder-open"></i></button>
                                <button id="view-toggle-btn" class="cc-tool-btn" onclick="window.CCFB.toggleViewMode()" title="Toggle List View"><i class="fa fa-list"></i></button>
                                <button class="cc-tool-btn" onclick="window.CCFB.shareRoster()" title="Copy Share Link"><i class="fa fa-share-alt"></i></button>
                                <button class="cc-tool-btn" onclick="window.print()" title="Print Roster"><i class="fa fa-print"></i></button>
                            </div>
                        </div>
                    </div>

                    <!-- NEW 3-COLUMN LAYOUT -->
                    <div class="cc-grid">
                        <!-- LEFT: UNIT LIBRARY -->
                        <div class="cc-panel" id="panel-library">
                            <div class="cc-panel-header">
                                <span>
                                    ${window.CCFB.renderFactionIcon(CCFB.ui.fKey || "monster_rangers")}
                                    UNIT LIBRARY
                                </span>
                            </div>
                            <div id="lib-target"></div>
                        </div>

                        <!-- MIDDLE: UNIT BUILDER -->
                        <div class="cc-panel" id="ccfb-builder">
                            <div class="cc-panel-header">
                                <span><i class="fa fa-wrench"></i> UNIT BUILDER</span>
                            </div>
                            <div id="builder-target">
                                <div class="cc-empty-state">
                                    <i class="fa fa-mouse-pointer mb-3" style="font-size: 2rem; display: block;"></i>
                                    SELECT A UNIT TO CUSTOMIZE
                                </div>
                            </div>
                        </div>

                        <!-- RIGHT: ACTIVE ROSTER -->
                        <div class="cc-panel" id="panel-roster">
                            <div class="cc-panel-header">
                                <span><i class="fa fa-users"></i> ACTIVE ROSTER</span>
                            </div>
                            <div id="rost-target"></div>
                        </div>
                    </div>
                </div>
            `;

            this.populateDropdown();
            this.checkLoginStatus();
        },

        /**
         * Hardcoded list to match your actual GitHub filenames
         */
        populateDropdown: function() {
            const sel = document.getElementById("f-selector");
            if (!sel) return;

            const factions = [
                { key: "monster_rangers", label: "Monster Rangers" },
                { key: "liberty_corps", label: "Liberty Corps" },
                { key: "monsterology", label: "Monsterology" },
                { key: "monsters", label: "Monsters" },
                { key: "shine_riders", label: "Shine Riders" }
            ];

            const options = factions.map(f => 
                `<option value="${f.key}" ${CCFB.ui.fKey === f.key ? 'selected' : ''}>${f.label.toUpperCase()}</option>`
            ).join('');

            sel.innerHTML = `<option value="">SELECT FACTION...</option>` + options;
        },

        checkLoginStatus: async function() {
            const statusBar = document.getElementById("auth-status-bar");
            if (!statusBar) return;

            try {
                const response = await fetch('/web/session/get_session_info', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    credentials: 'include',
                    body: JSON.stringify({})
                });
                const data = await response.json();
                const user = data.result;

                if (user && user.uid) {
                    statusBar.innerHTML = `<i class="fa fa-check-circle" style="color: #8f8"></i> AUTHENTICATED: <strong>${user.name || 'Officer'}</strong>`;
                    statusBar.style.background = 'rgba(50, 200, 100, 0.1)';
                } else {
                    statusBar.innerHTML = `<i class="fa fa-exclamation-triangle" style="color: var(--cc-primary)"></i> NOT LOGGED IN — <a href="/web/login" style="color: #fff; text-decoration: underline;">SIGN IN</a>`;
                    statusBar.style.background = 'rgba(255, 117, 24, 0.1)';
                }
            } catch (e) {
                statusBar.innerHTML = `<i class="fa fa-info-circle"></i> LOCAL MODE`;
            }
        }
    };
});
