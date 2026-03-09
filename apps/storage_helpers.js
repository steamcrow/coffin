// ================================
// Storage Helpers - Reusable Cloud Storage
// File: coffin/rules/src/storage_helpers.js
// ================================

console.log("💾 storage_helpers.js loaded");

window.CC_STORAGE = {
  
  // Default config - can be overridden per app
  CONFIG: {
    FOLDER_ID: 90  // Coffin Canyon Factions folder
  },

  // ================================
  // AUTH
  // ================================
  async checkAuth() {
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
  },

  // ================================
  // ODOO DOCUMENTS API
  // ================================
  async findDocumentByName(name, folderId) {
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
              ['folder_id', '=', folderId || this.CONFIG.FOLDER_ID],
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
  },

  async saveDocument(name, jsonData, folderId) {
    const auth = await this.checkAuth();
    if (!auth.loggedIn) {
      throw new Error('Not logged in');
    }

    const base64Data = btoa(unescape(encodeURIComponent(jsonData)));
    const existing = await this.findDocumentByName(name, folderId);
    
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
      
      return { success: true, action: 'updated', id: existing.id };
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
              folder_id: folderId || this.CONFIG.FOLDER_ID,
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
      
      return { success: true, action: 'created', id: data.result };
    }
  },

  async loadDocumentList(folderId) {
    const auth = await this.checkAuth();
    if (!auth.loggedIn) {
      throw new Error('Not logged in');
    }

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
            ['folder_id', '=', folderId || this.CONFIG.FOLDER_ID],
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
    
    return data.result || [];
  },

  async loadDocument(docId) {
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
          args: [[docId]],
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
    return { json: jsonString, name: doc.name };
  },

  async deleteDocument(docId) {
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
          args: [[docId], { active: false }],
          kwargs: {}
        }
      })
    });

    if (!response.ok) throw new Error('Delete failed');
    const data = await response.json();
    if (data.error) throw new Error(data.error.data?.message || 'Delete failed');
    
    return { success: true };
  },

  // ================================
  // URL SHARING
  // ================================
  createShareUrl(jsonData) {
    const encoded = encodeURIComponent(btoa(jsonData));
    return `${window.location.origin}${window.location.pathname}?data=${encoded}`;
  },

  getSharedData() {
    const urlParams = new URLSearchParams(window.location.search);
    const dataParam = urlParams.get('data');
    
    if (dataParam) {
      try {
        return atob(decodeURIComponent(dataParam));
      } catch (e) {
        console.error("Failed to decode shared data:", e);
        return null;
      }
    }
    return null;
  }
};
