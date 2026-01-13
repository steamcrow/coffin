/**
 * COFFIN CANYON FACTION BUILDER - FILE 3: DATA & STORAGE
 * Version: 1.9.5 - Odoo Document Storage Integration
 */

CCFB.define('loaders', (require) => {
    // 1. DOMAIN SAFETY BRIDGE
    if (window.location.pathname.includes('/web')) {
        console.warn("CCFB: Odoo Editor detected. Aborting script to protect DOM.");
        return;
    }

    const CONFIG_ID = 'atBNrncJQTOL-dmzsRMZAwo92'; // From your provided config loader

    /**
     * CORE ODOO RPC CALLER
     * Leverages the session to read/write documents
     */
    async function odooRPC(model, method, args, kwargs = {}) {
        const response = await fetch('/web/dataset/call_kw', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({
                jsonrpc: '2.0',
                method: 'call',
                params: { model, method, args, kwargs }
            })
        });
        const data = await response.json();
        if (data.error) throw new Error(data.error.data?.message || "Odoo RPC Error");
        return data.result;
    }

    /**
     * FETCH ROSTER FROM ODOO
     * Triggered if URL contains ?id=X
     */
    async function fetchRoster(documentId) {
        try {
            const result = await odooRPC('documents.document', 'read', [[parseInt(documentId)]], {
                fields: ['datas', 'name']
            });
            
            if (result && result[0]?.datas) {
                // Decode Base64 from Odoo storage
                const jsonString = decodeURIComponent(escape(atob(result[0].datas)));
                return JSON.parse(jsonString);
            }
        } catch (e) {
            console.error("CCFB: Failed to fetch roster document", e);
            return null;
        }
    }

    /**
     * SAVE ROSTER TO ODOO
     * Converts current state to JSON and uploads as document
     */
    async function saveRoster(rosterData, rosterName = "MY FACTION") {
        const base64Data = btoa(unescape(encodeURIComponent(JSON.stringify(rosterData))));
        
        try {
            const result = await odooRPC('documents.document', 'create', [{
                name: `${rosterName}.ccfb`,
                datas: base64Data,
                mimetype: 'application/json',
                // folder_id logic can be added here if a specific folder is required
            }]);
            return result; // Returns the new document ID
        } catch (e) {
            console.error("CCFB: Save failed", e);
            alert("Failed to save to Odoo. Check login status.");
        }
    }

    return {
        fetchRoster,
        saveRoster,
        odooRPC,
        configId: CONFIG_ID
    };
});