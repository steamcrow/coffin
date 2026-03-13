/* Coffin Canyon Map — V2 */

(function(){

const DEFAULTS = {
title:"Coffin Canyon — Canyon Map",
mapUrl:"https://raw.githubusercontent.com/steamcrow/coffin/main/apps/app_canyon_map/data/canyon_map.json",
locationsUrl:"https://raw.githubusercontent.com/steamcrow/coffin/main/data/src/170_named_locations.json",
frameUrl:"https://raw.githubusercontent.com/steamcrow/coffin/main/apps/app_canyon_map/data/mag_frame2.png"
};

function el(tag,attrs,children){
attrs=attrs||{};
children=children||[];

const n=document.createElement(tag);

Object.keys(attrs).forEach(k=>{
if(k==="class") n.className=attrs[k];
else n.setAttribute(k,attrs[k]);
});

children.forEach(c=>{
n.appendChild(typeof c==="string"?document.createTextNode(c):c);
});

return n;
}

function renderDrawer(ui,loc){

ui.title.textContent = loc.name || loc.id;

ui.body.innerHTML =
'<div class="cc-block">'+
'<div class="cc-h">Description</div>'+
'<p>'+(loc.description||"No description.")+'</p>'+
'</div>'+

'<div class="cc-block">'+
'<div class="cc-h">Danger</div>'+
(loc.danger||0)+
'</div>'+

'<div class="cc-block">'+
'<div class="cc-h">Population</div>'+
(loc.population||0)+
'</div>';

ui.panel.classList.add("cc-slide-panel-open");

}
function buildHitboxes(map, locations, ui) {

let activeRect = null;
let activeTooltipEl = null;

function clearActive() {
  if (activeRect) {
    activeRect.setStyle({
      color: "#ff7518",
      weight: 2,
      fillOpacity: 0.15
    });
    if (activeRect._path) {
      activeRect._path.classList.remove("cc-hitbox-active");
    }
  }

  if (activeTooltipEl) {
    activeTooltipEl.classList.remove("cc-label-active");
  }

  activeRect = null;
  activeTooltipEl = null;
}

function setHover(rect, on) {
  if (!rect || !rect._path) return;
  rect._path.classList.toggle("cc-hitbox-hover", !!on);

  var tooltipEl = rect.getTooltip() && rect.getTooltip().getElement
    ? rect.getTooltip().getElement()
    : null;

  if (tooltipEl) {
    tooltipEl.classList.toggle("cc-label-hover", !!on);
  }
}

function setActive(rect) {
  clearActive();

  activeRect = rect;
  rect.setStyle({
    color: "#fff0c2",
    weight: 3,
    fillOpacity: 0.26
  });

  if (rect._path) {
    rect._path.classList.add("cc-hitbox-active");
  }

  var tooltipEl = rect.getTooltip() && rect.getTooltip().getElement
    ? rect.getTooltip().getElement()
    : null;

  if (tooltipEl) {
    tooltipEl.classList.add("cc-label-active");
    activeTooltipEl = tooltipEl;
  }

  if (ui && ui.mapWrapEl) {
    ui.mapWrapEl.classList.add("cc-map-focus");
  }
}

locations.forEach(function (loc) {
  const box = window.CC_HITBOXES && window.CC_HITBOXES[loc.id];
  if (!box) return;

  const rect = L.rectangle(
    [[box[0], box[1]], [box[2], box[3]]],
    {
      color: "#ff7518",
      weight: 2,
      fillOpacity: 0.15
    }
  ).addTo(map);

  rect.bindTooltip(loc.name, {
    permanent: true,
    direction: "center",
    className: "cc-map-hitbox-label"
  });

  rect.on("mouseover", function () {
    setHover(rect, true);
  });

  rect.on("mouseout", function () {
    if (rect !== activeRect) {
      setHover(rect, false);
    }
  });

  rect.on("click", function () {
    renderDrawer(ui, loc);
    setActive(rect);
  });

  rect.on("touchstart", function () {
    renderDrawer(ui, loc);
    setActive(rect);
  });
});

if (ui && ui.panel) {
  const closeBtn = ui.panel.querySelector("#cc-panel-close");
  if (closeBtn) {
    closeBtn.addEventListener("click", function () {
      clearActive();
      if (ui.mapWrapEl) {
        ui.mapWrapEl.classList.remove("cc-map-focus");
      }
    });
  }
}
}

function attachKnobs(map,frame){

const knobV = frame.querySelector(".cc-knob-v");
const knobH = frame.querySelector(".cc-knob-h");

map.on("move",()=>{

const center = map.getCenter();
const zoom = map.getZoom();

const p = map.project(center,zoom);

const v = (p.y/4000)*100;
const h = (p.x/4000)*100;

knobV.style.top = v+"%";
knobH.style.left = h+"%";

});

}
async function mount(root,userOpts){

const opts = Object.assign({},DEFAULTS,userOpts||{});

root.innerHTML="";

const mapWrap = el("div",{class:"cc-map-wrap"});

const mapEl = el("div",{class:"cc-map-root"});

const frame = el("div",{class:"cc-map-frame"},[
el("img",{class:"cc-map-frame-img",src:opts.frameUrl}),
el("div",{class:"cc-knob-v"}),
el("div",{class:"cc-knob-h"})
]);

const panel = el("div",{class:"cc-slide-panel"},[
el("div",{class:"cc-slide-panel-header"},[
el("h2",{class:"cc-panel-title"}),
el("button",{class:"cc-panel-close-btn",id:"cc-panel-close"},["×"])
]),
el("div",{class:"cc-panel-body"})
]);

mapWrap.appendChild(mapEl);
mapWrap.appendChild(frame);

root.appendChild(mapWrap);
root.appendChild(panel);

const ui = {
panel: panel,
title: panel.querySelector(".cc-panel-title"),
body: panel.querySelector(".cc-panel-body"),
mapWrapEl: mapWrap
};

panel.querySelector("#cc-panel-close").onclick=()=>{
panel.classList.remove("cc-slide-panel-open");
};

const [mapDoc,locDoc] = await Promise.all([
fetch(opts.mapUrl).then(r=>r.json()),
fetch(opts.locationsUrl).then(r=>r.json())
]);

const px = mapDoc.map.background.image_pixel_size;

const map = L.map(mapEl,{
crs:L.CRS.Simple,
minZoom:-2,
maxZoom:2
});

const bounds=[[0,0],[px.h,px.w]];

L.imageOverlay(
mapDoc.map.background.image_key,
bounds
).addTo(map);

map.fitBounds(bounds);

buildHitboxes(map,locDoc.locations,ui);

attachKnobs(map,frame);

if(window.CC_HitboxEditor){
window.editor = CC_HitboxEditor(map,window.CC_HITBOXES);
}

return map;

}

window.CC_CanyonMap={mount};

})();
