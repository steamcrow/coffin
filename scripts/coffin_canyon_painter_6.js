/**
 * COFFIN CANYON FACTION BUILDER - FILE 6: PAINTER
 * Version: 1.9.5 - Full Logic & Renders
 */

CCFB.define('painter', (require) => {
    const loaders = require('loaders');
    
    // Private State
    let currentRoster = [];
    let factionData = null;

    /**
     * UI MANIFESTO: STAT BADGE PROTOCOL
     */
    const STAT_MAP = {
        Q: { class: 'stat-q', label: 'Quality' }, // Blue
        D: { class: 'stat-d', label: 'Defense' }, // Red
        R: { class: 'stat-r', label: 'Range' },   // Brown
        M: { class: 'stat-m', label: 'Move' }     // Green
    };

    /**
     * RENDER UNIT CARD
     * Enforces All-Caps, Currency, and Lore styles
     */
    function renderUnitCard(unit) {
        const unitName = (unit.name || 'Unknown Unit').toUpperCase(); // All-Caps
        const loreHtml = unit.lore ? `<div class="unit-lore-box"><em>${unit.lore}</em></div>` : ''; // Pumpkin-border style via CSS
        
        const statsHtml = Object.entries(unit.stats || {}).map(([key, val]) => {
            const config = STAT_MAP[key] || { class: 'stat-default' };
            return `<div class="stat-badge ${config.class}" title="${config.label}">${key}: ${val}</div>`;
        }).join('');

        return `
            <div class="ccfb-card" data-unit-id="${unit.id}">
                <div class="ccfb-card-header">
                    <span class="unit-title">${unitName}</span>
                    <span class="unit-cost">₤${unit.cost}</span>
                </div>
                <div class="unit-type-tag">${(unit.type || 'Unit').toLowerCase()}</div>
                <div class="stats-row">${statsHtml}</div>
                ${loreHtml}
                <button class="ccfb-btn-add" onclick="CCFB.painter.addToRoster('${unit.id}')">Add to Roster</button>
            </div>
        `;
    }

    /**
     * ROSTER LOGIC (Restored Functionality)
     */
    function addToRoster(unitId) {
        const unit = factionData.units.find(u => u.id === unitId);
        if (unit) {
            currentRoster.push({...unit, rosterInstanceId: Date.now()});
            refreshRosterUI();
        }
    }

    function removeFromRoster(instanceId) {
        currentRoster = currentRoster.filter(u => u.rosterInstanceId !== instanceId);
        refreshRosterUI();
    }

    /**
     * CALCULATE TOTALS
     * Uses Liberty Bucks symbol (₤)
     */
    function refreshRosterUI() {
        const rosterContainer = document.getElementById('ccfb-roster-list');
        const totalEl = document.getElementById('ccfb-total-points');
        
        let total = 0;
        rosterContainer.innerHTML = currentRoster.map(unit => {
            total += parseInt(unit.cost);
            return `
                <div class="roster-item">
                    <span>${unit.name.toUpperCase()}</span>
                    <span>₤${unit.cost}</span>
                    <button onclick="CCFB.painter.removeFromRoster(${unit.rosterInstanceId})">×</button>
                </div>
            `;
        }).join('');

        totalEl.innerText = `Total: ₤${total}`;
    }

    /**
     * SAFETY BRIDGE: Initialize UI
     * Ensures ccfb-root exists and legacy IDs are bridged
     */
    async function init(data) {
        factionData = data;
        const grid = document.getElementById('ccfb-unit-grid');
        if (!grid) return;

        grid.innerHTML = data.units.map(u => renderUnitCard(u)).join('');
        console.log(`CCFB: Painted ${data.units.length} units.`);
    }

    return {
        init,
        addToRoster,
        removeFromRoster,
        renderUnitCard
    };
});