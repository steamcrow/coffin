CCFB.define("components/storage", function(C) {
    
    const CONFIG = {
        FOLDER_ID: 90  // Coffin Canyon Factions folder
    };

    /**
     * INTERNAL UTILITIES
     */

    // Check if user is logged in to Odoo
    async function checkAuth() {
        try {
            const response = await fetch('/web/session/get_session_info', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({})
            });
            
            if (!response.ok) return { loggedIn: false };
            
            const userData = await response.json();
            if (userData.result && userData.result.uid) {
                return {
                    loggedIn: true,
                    userId: userData.result.uid,
                    userName: userData.result.name || userData.result.username || 'User'
                };
            }
            
            return { loggedIn: false };
        } catch (e) {
            console.error('Auth check failed:', e);
            return { loggedIn: false };
        }
    }

    // Serialize current roster to JSON string
    const serializeRoster = () => {
        const UI = C.ui;
        return JSON.stringify({
            version: "1.0",
            faction: UI.fKey,
            budget: UI.budget,
            name: document.getElementById("roster-name")?.value || "Unnamed Roster",
            roster: UI.roster || [],
            timestamp: new Date().toISOString()
        });
    };

    // Deserialize JSON string and load into builder
    const deserializeRoster = async (jsonString) => {
        try {
            const data = JSON.parse(jsonString);
            
            // 1. Update UI state
            C.ui.fKey = data.faction;
            C.ui.budget = data.budget;
            C.ui.rosterName = data.name; // Keep internal state in sync

            // 2. Update DOM elements if they exist
            const fSel = document.getElementById("f-selector");
            const bSel = document.getElementById("budget-selector");
            const nInp = document.getElementById("roster-name");

            if (fSel) fSel.value = data.faction;
            if (bSel) bSel.value = data.budget;
            if (nInp) nInp.value = data.name;
            
            // 3. Load the faction data via the Loader
            return new Promise((resolve) => {
                C.require(["data/loaders"], async (L) => {
                    // Trigger the full boot sequence for this faction
                    await L.bootSequence(data.faction);
                    
                    // Inject the roster into the UI state
                    C.ui.roster = data.roster || [];
                    
                    // Trigger UI Refresh
                    if (window.CCFB.refreshUI) {
                        window.CCFB.refreshUI();
                    }
                    
                    resolve(true);
                });
            });
        } catch (e) {
            console.error("Failed to deserialize roster:", e);
            return false;
        }
    };

    // Find roster by name in Odoo Documents
    async function findRosterByName(name) {
        try {
            const response = await fetch('/web/dataset/call_kw', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({
                    jsonrpc: '2.0',
                    method: 'call',
                    params: {
                        model: 'documents.document',
                        method: 'search_read',
                        args: [[
                            ['folder_id', '=', CONFIG.FOLDER_ID],
                            ['name', '=', `${name}.json`],
                            ['active', '=', true]
                        ]],
                        kwargs: {
                            fields: ['id', 'name'],
                            limit: 1
                        }
                    }
                })
            });

            if (!response.ok) return null;
            const data = await response.json();
            if (data.error) return null;
            if (data.result && data.result.length > 0) {
                return data.result[0];
            }
            return null;
        } catch (e) {
            return null;
        }
    }

    /**
     * PUBLIC API FUNCTIONS (Attached to window.CCFB for Skeleton access)
     */

    // Save roster to Odoo Documents
    window.CCFB.saveRoster = async () => {
        const auth = await checkAuth();
        if (!auth.loggedIn) {
            alert("Please sign in to save rosters!");
            return;
        }

        const name = document.getElementById("roster-name")?.value || "Unnamed Roster";
        
        if (!name || name.trim() === "") {
            alert("Please give your roster a name first!");
            return;
        }

        const rosterData = serializeRoster();
        const base64Data = btoa(unescape(encodeURIComponent(rosterData)));

        try {
            const existing = await findRosterByName(name);
            
            if (existing) {
                // Update existing
                const response = await fetch('/web/dataset/call_kw', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    credentials: 'include',
                    body: JSON.stringify({
                        jsonrpc: '2.0',
                        method: 'call',
                        params: {
                            model: 'documents.document',
                            method: 'write',
                            args: [[existing.id], {
                                datas: base64Data,
                                name: `${name}.json`
                            }],
                            kwargs: {}
                        }
                    })
                });

                if (!response.ok) throw new Error('Update failed');
                const data = await response.json();
                if (data.error) throw new Error(data.error.data?.message || 'Update failed');
                
                alert(`✓ Roster "${name}" updated!`);
            } else {
                // Create new
                const response = await fetch('/web/dataset/call_kw', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    credentials: 'include',
                    body: JSON.stringify({
                        jsonrpc: '2.0',
                        method: 'call',
                        params: {
                            model: 'documents.document',
                            method: 'create',
                            args: [{
                                name: `${name}.json`,
                                folder_id: CONFIG.FOLDER_ID,
                                datas: base64Data,
                                mimetype: 'application/json'
                            }],
                            kwargs: {}
                        }
                    })
                });

                if (!response.ok) throw new Error('Save failed');
                const data = await response.json();
                if (data.error) throw new Error(data.error.data?.message || 'Save failed');
                
                alert(`✓ Roster "${name}" saved!`);
            }
        } catch (error) {
            console.error("Save error:", error);
            alert("Error saving roster: " + error.message);
        }
    };

    // Load list of saved rosters from Odoo
    window.CCFB.loadRosterList = async () => {
        const auth = await checkAuth();
        if (!auth.loggedIn) {
            alert("Please sign in to load rosters!");
            return;
        }

        try {
            const response = await fetch('/web/dataset/call_kw', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({
                    jsonrpc: '2.0',
                    method: 'call',
                    params: {
                        model: 'documents.document',
                        method: 'search_read',
                        args: [[
                            ['folder_id', '=', CONFIG.FOLDER_ID],
                            ['active', '=', true]
                        ]],
                        kwargs: {
                            fields: ['id', 'name', 'create_date', 'write_date'],
                            order: 'write_date desc'
                        }
                    }
                })
            });

            if (!response.ok) throw new Error('Load failed');
            const data = await response.json();
            if (data.error) throw new Error(data.error.data?.message || 'Load failed');
            
            if (!data.result || data.result.length === 0) {
                alert("You don't have any saved rosters yet!");
                return;
            }

            // Enrich each roster with faction info
        const enriched = await Promise.all(
        data.result.map(async (r) => {
            try {
                const res = await fetch('/web/dataset/call_kw', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    credentials: 'include',
                    body: JSON.stringify({
                        jsonrpc: '2.0',
                        method: 'call',
                        params: {
                            model: 'documents.document',
                            method: 'read',
                            args: [[r.id]],
                            kwargs: { fields: ['datas'] }
                    }
                })
            });

            const docData = await res.json();
            const jsonString = decodeURIComponent(escape(atob(docData.result[0].datas)));
            const parsed = JSON.parse(jsonString);

            return {
                ...r,
                faction: parsed.faction || "monster_rangers",
                rosterName: parsed.name || r.name.replace('.json', ''),
                budget: parsed.budget || 0
            };

        } catch (e) {
            return {
                ...r,
                faction: "monster_rangers",
                rosterName: r.name.replace('.json', ''),
                budget: 0
            };
        }
    })
);

showRosterListPanel(enriched);

        } catch (error) {
            console.error("Load error:", error);
            alert("Error loading rosters: " + error.message);
        }
    };

    // Delete a roster (archives it)
    window.CCFB.deleteRoster = async (rosterId) => {
        if (!confirm("Are you sure you want to delete this roster?")) return;

        try {
            const response = await fetch('/web/dataset/call_kw', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({
                    jsonrpc: '2.0',
                    method: 'call',
                    params: {
                        model: 'documents.document',
                        method: 'write',
                        args: [[rosterId], { active: false }],
                        kwargs: {}
                    }
                })
            });

            if (!response.ok) throw new Error('Delete failed');
            const data = await response.json();
            if (data.error) throw new Error(data.error.data?.message || 'Delete failed');
            
            alert("✓ Roster deleted!");
            setTimeout(() => { window.CCFB.loadRosterList(); }, 300);
            
        } catch (error) {
            console.error("Delete error:", error);
            alert("Error deleting roster: " + error.message);
        }
    };

    // Load a specific roster by ID
    window.CCFB.loadRoster = async (rosterId) => {
        try {
            const response = await fetch('/web/dataset/call_kw', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({
                    jsonrpc: '2.0',
                    method: 'call',
                    params: {
                        model: 'documents.document',
                        method: 'read',
                        args: [[rosterId]],
                        kwargs: { fields: ['datas', 'name'] }
                    }
                })
            });

            if (!response.ok) throw new Error('Load failed');
            const data = await response.json();
            if (data.error) throw new Error(data.error.data?.message || 'Load failed');
            
            const doc = data.result[0];
            if (!doc || !doc.datas) throw new Error('No data in document');
            
            const jsonString = decodeURIComponent(escape(atob(doc.datas)));
            const success = await deserializeRoster(jsonString);
            
            if (success) {
                closeRosterListPanel();
                const rosterName = doc.name.replace('.json', '');
                alert(`✓ Loaded roster: ${rosterName}`);
            } else {
                alert("Failed to load roster data.");
            }
        } catch (error) {
            console.error("Load error:", error);
            alert("Error loading roster: " + error.message);
        }
    };

    // Share roster via URL
    window.CCFB.shareRoster = () => {
        const rosterData = serializeRoster();
        const encoded = encodeURIComponent(btoa(rosterData));
        const shareUrl = `${window.location.origin}${window.location.pathname}?roster=${encoded}`;
        
        navigator.clipboard.writeText(shareUrl).then(() => {
            alert("✓ Share link copied to clipboard!");
        }).catch(() => {
            prompt("Copy this link to share your roster:", shareUrl);
        });
    };

    /**
     * UI PANELS
     */

    const showRosterListPanel = (rosters) => {
        closeRosterListPanel();
        
        const panel = document.createElement('div');
        panel.id = 'roster-list-panel';
        panel.className = 'cc-slide-panel';

        panel.innerHTML = `
            <div class="cc-slide-panel-header">
                <h2>SAVED ROSTERS</h2>
                <button onclick="window.CCFB.closeRosterListPanel()" class="cc-panel-close-btn">
                    <i class="fa fa-times"></i>
                </button>
            </div>
            <div class="cc-roster-list">
                ${rosters.map(r => {
                    const displayName = r.name.replace('.json', '');
                    return `
                        <div class="cc-saved-roster-item">
                            <div class="cc-saved-roster-info">
                                <div class="cc-saved-roster-name">${displayName}</div>
                                <div class="cc-saved-roster-date">
                                    Saved: ${new Date(r.write_date).toLocaleDateString()}
                                </div>
                            </div>
                            <div class="cc-saved-roster-actions">
                                <button onclick="window.CCFB.loadRoster(${r.id})" class="btn-outline-warning">
                                    <i class="fa fa-upload"></i> LOAD
                                </button>
                                <button onclick="window.CCFB.deleteRoster(${r.id})" class="btn-outline-danger">
                                    <i class="fa fa-trash"></i>
                                </button>
                            </div>
                        </div>
                    `;
                }).join('')}
            </div>
        `;

        document.body.appendChild(panel);
        setTimeout(() => panel.classList.add('cc-slide-panel-open'), 10);
    };

    const closeRosterListPanel = () => {
        const panel = document.getElementById('roster-list-panel');
        if (panel) {
            panel.classList.remove('cc-slide-panel-open');
            setTimeout(() => panel.remove(), 300);
        }
    };

    window.CCFB.closeRosterListPanel = closeRosterListPanel;

    // The logic to check URL parameters
    const checkUrlParams = () => {
        const urlParams = new URLSearchParams(window.location.search);
        const rosterParam = urlParams.get('roster');
        
        if (rosterParam) {
            try {
                const decoded = atob(decodeURIComponent(rosterParam));
                deserializeRoster(decoded);
            } catch (e) {
                console.error("Failed to load roster from URL:", e);
            }
        }
    };

    // Return the module API
    return {
        saveRoster: window.CCFB.saveRoster,
        loadRosterList: window.CCFB.loadRosterList,
        shareRoster: window.CCFB.shareRoster,
        init: () => {
            checkUrlParams();
        }
    };
});
