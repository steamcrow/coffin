CCFB.define("components/storage", function(C) {
    
    const CONFIG = {
        FOLDER_ID: 90  // Same folder as Scenario Builder - Coffin Canyon Factions
    };

    // Check if user is logged in
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
    const deserializeRoster = (jsonString) => {
        try {
            const data = JSON.parse(jsonString);
            C.ui.fKey = data.faction;
            C.ui.budget = data.budget;
            C.ui.roster = data.roster || [];
            
            // Update UI elements
            document.getElementById("f-selector").value = data.faction;
            document.getElementById("budget-selector").value = data.budget;
            document.getElementById("roster-name").value = data.name;
            
            // Trigger faction change to reload everything
            window.CCFB.handleFactionChange(data.faction);
            
            return true;
        } catch (e) {
            console.error("Failed to deserialize roster:", e);
            return false;
        }
    };

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
            // Check if roster with this name already exists
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
                            }]
                        }
                    })
                });

                if (!response.ok) throw new Error('Update failed');
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
                            }]
                        }
                    })
                });

                if (!response.ok) throw new Error('Save failed');
                alert(`✓ Roster "${name}" saved!`);
            }
        } catch (error) {
            console.error("Save error:", error);
            alert("Error saving roster. Please try again.");
        }
    };

    // Find roster by name
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
                            ['name', '=', `${name}.json`]
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
            if (data.result && data.result.length > 0) {
                return data.result[0];
            }
            return null;
        } catch (e) {
            return null;
        }
    }

    // Load list of saved rosters
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
                            ['folder_id', '=', CONFIG.FOLDER_ID]
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
            
            if (!data.result || data.result.length === 0) {
                alert("You don't have any saved rosters yet!");
                return;
            }

            showRosterListPanel(data.result);
        } catch (error) {
            console.error("Load error:", error);
            alert("Error loading rosters. Please try again.");
        }
    };

// Delete a roster
window.CCFB.deleteRoster = async (rosterId) => {
    if (!confirm("Are you sure you want to delete this roster?")) {
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
                    method: 'unlink',
                    args: [[rosterId]]
                }
            })
        });

        if (!response.ok) throw new Error('Delete failed');
        
        const data = await response.json();
        if (data.error) {
            throw new Error(data.error.data?.message || 'Delete failed');
        }
        
        // Wait a moment for Odoo to process, then refresh the list
        setTimeout(async () => {
            try {
                // Fetch fresh roster list with cache busting
                const listResponse = await fetch('/web/dataset/call_kw', {
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
                                ['folder_id', '=', CONFIG.FOLDER_ID]
                            ]],
                            kwargs: {
                                fields: ['id', 'name', 'create_date', 'write_date'],
                                order: 'write_date desc'
                            }
                        }
                    })
                });

                const listData = await listResponse.json();
                
                if (listData.result && listData.result.length > 0) {
                    // Update the panel with fresh data
                    showRosterListPanel(listData.result);
                    alert("✓ Roster deleted!");
                } else {
                    // No rosters left
                    closeRosterListPanel();
                    alert("✓ Roster deleted! (No more saved rosters)");
                }
            } catch (e) {
                console.error("Refresh error:", e);
                alert("✓ Deleted, but couldn't refresh list. Please close and reopen.");
            }
        }, 500); // Give Odoo time to process the delete
        
    } catch (error) {
        console.error("Delete error:", error);
        alert("Error deleting roster: " + error.message);
    }
};
    // Load a specific roster
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
            
            const doc = data.result[0];
            if (!doc || !doc.datas) throw new Error('No data in document');
            
            const jsonString = decodeURIComponent(escape(atob(doc.datas)));
            const success = deserializeRoster(jsonString);
            
            if (success) {
                closeRosterListPanel();
                const rosterName = doc.name.replace('.json', '');
                alert(`✓ Loaded roster: ${rosterName}`);
            } else {
                alert("Failed to load roster data.");
            }
        } catch (error) {
            console.error("Load error:", error);
            alert("Error loading roster.");
        }
    };

    // Share roster (generate URL)
    window.CCFB.shareRoster = () => {
        const rosterData = serializeRoster();
        const encoded = encodeURIComponent(btoa(rosterData));
        const shareUrl = `${window.location.origin}${window.location.pathname}?roster=${encoded}`;
        
        // Copy to clipboard
        navigator.clipboard.writeText(shareUrl).then(() => {
            alert("✓ Share link copied to clipboard!");
        }).catch(() => {
            prompt("Copy this link to share your roster:", shareUrl);
        });
    };

    // Load roster from URL parameter
    const loadFromUrl = () => {
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

    // Show slide-in panel with roster list
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

    // Try to load from URL on init
    loadFromUrl();

    return {
        saveRoster: window.CCFB.saveRoster,
        loadRosterList: window.CCFB.loadRosterList,
        shareRoster: window.CCFB.shareRoster
    };
});
