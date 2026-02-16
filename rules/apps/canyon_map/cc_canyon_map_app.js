/* CANYON MAP - MOBILE & CLICKABLE LOCATIONS FIX
   
   Apply these changes to cc_canyon_map_app.js
   
   ISSUE 1: Hitboxes too hard to see/click
   ISSUE 2: Mobile touch targets need to be bigger
   ISSUE 3: No visual feedback on hover
*/

// ================================================================
// STEP 1: Replace the addNamedLocationHitboxes() function
// Find this function around line 473 and replace it entirely
// ================================================================

function addNamedLocationHitboxes() {
  if (!locationsData || !lensMap) {
    console.warn("⚠️ Cannot add hitboxes - missing locationsData or lensMap");
    return;
  }

  Object.values(locationMarkersById).forEach(marker => {
    try {
      lensMap.removeLayer(marker);
    } catch (e) {}
  });

  // Map location IDs to pixel coordinates [y, x] where text/dots appear on map
  // Map is 2824w x 4000h pixels
  const locationCoords = {
    "fort-plunder": [400, 1400],
    "deerhoof": [800, 2200],
    "huck": [1000, 700],
    "camp-coffin": [1100, 1400],
    "silverpit": [1200, 2100],
    "ghost-mountain": [1600, 900],
    "plata": [1800, 2300],
    "fortune": [2000, 1100],
    "ratsville": [2400, 1600],
    "cowtown": [2600, 2400],
    "river-city": [2800, 800],
    "dustbuck": [3000, 2000],
    "bayou-city": [3500, 1800],
    "diablo": [3600, 1400]
  };

  // Detect if mobile for bigger touch targets
  const isMobile = window.innerWidth <= 768;
  const hitboxSize = isMobile ? 200 : 150;  // Bigger on mobile
  const iconAnchor = hitboxSize / 2;

  let hitboxCount = 0;
  locationsData.locations.forEach(loc => {
    const coords = locationCoords[loc.id];
    if (!coords) {
      console.warn(`⚠️ No coordinates for location: ${loc.id}`);
      return;
    }

    // Create clickable marker with visible hover state
    const icon = window.L.divIcon({
      className: 'cc-location-hitbox',
      html: `
        <div class="cc-hitbox-inner" 
             style="
               width: ${hitboxSize}px;
               height: ${hitboxSize}px;
               cursor: pointer;
               background: rgba(255,117,24,0.08);
               border: 2px solid rgba(255,117,24,0.25);
               border-radius: 8px;
               display: flex;
               align-items: center;
               justify-content: center;
               transition: all 0.2s ease;
               font-weight: 700;
               font-size: ${isMobile ? '14px' : '12px'};
               color: rgba(255,255,255,0.8);
               text-align: center;
               padding: 4px;
               box-shadow: 0 2px 8px rgba(0,0,0,0.3);
             " 
             title="${loc.name}"
             onmouseover="this.style.background='rgba(255,117,24,0.25)'; this.style.borderColor='rgba(255,117,24,0.6)'; this.style.transform='scale(1.05)';"
             onmouseout="this.style.background='rgba(255,117,24,0.08)'; this.style.borderColor='rgba(255,117,24,0.25)'; this.style.transform='scale(1)';"
        >
          ${loc.emoji || '📍'} ${loc.name}
        </div>
      `,
      iconSize: [hitboxSize, hitboxSize],
      iconAnchor: [iconAnchor, iconAnchor]
    });

    const marker = window.L.marker(coords, { 
      icon,
      interactive: true,
      keyboard: false,
      riseOnHover: true  // Bring to front on hover
    });

    marker.on('click', (e) => {
      console.log(`📍 Clicked: ${loc.name}`);
      e.originalEvent.stopPropagation();
      renderLocationDrawer(ui, loc);
      drawerJustOpened = true;
      openDrawer(ui);
      
      setTimeout(() => {
        drawerJustOpened = false;
      }, 100);
    });

    // Add touch feedback for mobile
    marker.on('touchstart', () => {
      const hitbox = marker.getElement().querySelector('.cc-hitbox-inner');
      if (hitbox) {
        hitbox.style.background = 'rgba(255,117,24,0.4)';
        hitbox.style.transform = 'scale(1.08)';
      }
    });
    
    marker.on('touchend', () => {
      setTimeout(() => {
        const hitbox = marker.getElement().querySelector('.cc-hitbox-inner');
        if (hitbox) {
          hitbox.style.background = 'rgba(255,117,24,0.08)';
          hitbox.style.transform = 'scale(1)';
        }
      }, 150);
    });

    marker.addTo(lensMap);
    locationMarkersById[loc.id] = marker;
    hitboxCount++;
  });
  
  console.log(`✅ Added ${hitboxCount} clickable markers (${hitboxSize}x${hitboxSize}px)`);
}


// ================================================================
// STEP 2: Add this CSS to cc_canyon_map.css
// Add to the bottom of the file, before the responsive section
// ================================================================

/* Location hitbox styling with hover effects */
.cc-location-hitbox {
  z-index: 1000 !important;
  pointer-events: auto !important;
}

.cc-location-hitbox div {
  pointer-events: auto !important;
}

.cc-hitbox-inner {
  font-family: system-ui, -apple-system, sans-serif;
  user-select: none;
  -webkit-user-select: none;
  -webkit-tap-highlight-color: transparent;
}

/* Pulse animation to make locations more noticeable */
@keyframes pulse-glow {
  0%, 100% {
    box-shadow: 0 2px 8px rgba(0,0,0,0.3), 0 0 0 0 rgba(255,117,24,0.4);
  }
  50% {
    box-shadow: 0 2px 8px rgba(0,0,0,0.3), 0 0 0 8px rgba(255,117,24,0);
  }
}

.cc-hitbox-inner:hover {
  animation: pulse-glow 1.5s ease-in-out infinite;
}

/* Ensure touch targets are large enough on mobile */
@media (max-width: 768px) {
  .cc-location-hitbox {
    /* Touch targets should be minimum 44x44px, we're using 200x200px */
    min-width: 200px !important;
    min-height: 200px !important;
  }
}


// ================================================================
// STEP 3: OPTIONAL - Debug Mode Toggle
// Add this button to the header if you want to toggle visibility
// ================================================================

// In buildLayout() function, around line 332, add this button:

el("button", { 
  class: "cc-btn", 
  type: "button", 
  id: "cc-cm-toggle-markers",
  onclick: () => toggleMarkerVisibility()
}, ["Markers"])

// Then add this function after mount():

function toggleMarkerVisibility() {
  const markers = document.querySelectorAll('.cc-hitbox-inner');
  markers.forEach(hitbox => {
    const isHidden = hitbox.style.opacity === '0';
    if (isHidden) {
      // Show markers
      hitbox.style.opacity = '1';
      hitbox.style.background = 'rgba(255,117,24,0.08)';
      hitbox.style.borderColor = 'rgba(255,117,24,0.25)';
    } else {
      // Hide markers (nearly invisible but still clickable)
      hitbox.style.opacity = '0.05';
      hitbox.style.background = 'transparent';
      hitbox.style.borderColor = 'transparent';
    }
  });
}
