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
     * Blue (stat-q), Red (stat-d), Brown (stat-r), Green (stat-m)
     */
    const STAT_MAP = {
        Q: { class: 'stat-q', label: 'Quality' }, 
        D: { class: 'stat-d', label: 'Defense' }, 
        R: { class: 'stat-r', label: 'Range' },   
        M: { class: 'stat-m', label: 'Move' }     
    };

    /**
     * RENDER UNIT CARD
     * Enforces All-Caps, Currency, and Lore styles
     */
    function renderUnitCard(unit) {
        const unitName = (unit.name || 'Unknown Unit').toUpperCase(); 
        const loreHtml = unit.lore ? `<div class="unit-lore-box"><em>${unit.lore}</em></div>` : ''; 
        
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
     * ROSTER LOGIC
     */
    function addToRoster(unitId) {
        const unit = factionData.units.find(u => u.id === unitId);
        if (unit) {
            // Instance ID allows multiple of same unit to be deleted individually
            currentRoster.push({...unit, rosterInstanceId: Date.now() + Math.random()});
            refreshRosterUI();
        }
    }

    function removeFromRoster(instanceId) {
        currentRoster = currentRoster.filter(u => u.rosterInstanceId !== instanceId);
        refreshRosterUI();
    }

    /**
     * CALCULATE TOTALS & REFRESH PANELS
     * Maps to Skeleton IDs: rost-target and display-total
     */
    function refreshRosterUI() {
        const rosterContainer = document.getElementById('rost-target');
        const totalEl = document.getElementById('display-total');
        
        if (!rosterContainer || !totalEl) return;

        let total = 0;
        rosterContainer.innerHTML = currentRoster.map(unit => {
            total += parseInt(unit.cost);
            return `
                <div class="roster-item">
                    <span>${unit.name.toUpperCase()}</span>
                    <span>₤${unit.cost}</span>
                    <button class="remove-btn" onclick="CCFB.painter.removeFromRoster(${unit.rosterInstanceId})">×</button>
                </div>
            `;
        }).join('');

        totalEl.innerText = `${total} ₤`;
    }

    /**
     * INITIALIZE UI
     * Maps to Skeleton ID: lib-target
     */
    async function init(data) {
        factionData = data;
        const grid = document.getElementById('lib-target');
        if (!grid) return;

        grid.innerHTML = data.units.map(u => renderUnitCard(u)).join('');
        console.log(`CCFB: Painted ${data.units.length} units.`);
        refreshRosterUI(); // Reset roster view
    }

    return {
        init,
        addToRoster,
        removeFromRoster,
        renderUnitCard,
        refreshRosterUI
    };
});