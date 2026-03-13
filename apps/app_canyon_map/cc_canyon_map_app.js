(function(){

const DEFAULTS={
title:"Coffin Canyon — Canyon Map",
mapUrl:"https://raw.githubusercontent.com/steamcrow/coffin/main/apps/app_canyon_map/data/canyon_map.json",
locationsUrl:"https://raw.githubusercontent.com/steamcrow/coffin/main/data/src/170_named_locations.json"
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

ui.title.textContent=loc.name||loc.id;

ui.body.innerHTML=

`<div class="cc-block">
<div class="cc-h">Description</div>
<p>${loc.description||"No description."}</p>
</div>

<div class="cc-block">
<div class="cc-h">Danger</div>
${loc.danger||0}
</div>

<div class="cc-block">
<div class="cc-h">Population</div>
${loc.population||0}
</div>`;

ui.panel.classList.add("cc-slide-panel-open");

}

function buildHitboxes(map,locations,ui){

locations.forEach(loc=>{

const box=window.CC_HITBOXES?.[loc.id];
if(!box) return;

const rect=L.rectangle(
[[box[0],box[1]],[box[2],box[3]]],
{
color:"#ff7518",
weight:2,
fillOpacity:0.15
}).addTo(map);

rect.bindTooltip(loc.name,{
permanent:true,
direction:"center",
className:"cc-map-hitbox-label"
});

rect.on("click",()=>{
renderDrawer(ui,loc);
});

});

}

async function mount(root,userOpts){

const opts=Object.assign({},DEFAULTS,userOpts||{});

root.innerHTML="";

const mapEl=el("div",{class:"cc-map-root"});
const panel=el("div",{class:"cc-slide-panel"},[
el("div",{class:"cc-slide-panel-header"},[
el("h2",{class:"cc-panel-title"}),
el("button",{class:"cc-panel-close-btn",id:"cc-panel-close"},["×"])
]),
el("div",{class:"cc-panel-body"})
]);

root.appendChild(mapEl);
root.appendChild(panel);

const ui={
panel:panel,
title:panel.querySelector(".cc-panel-title"),
body:panel.querySelector(".cc-panel-body")
};

panel.querySelector("#cc-panel-close").onclick=()=>{
panel.classList.remove("cc-slide-panel-open");
};

const [mapDoc,locDoc]=await Promise.all([
fetch(opts.mapUrl).then(r=>r.json()),
fetch(opts.locationsUrl).then(r=>r.json())
]);

const px=mapDoc.map.background.image_pixel_size;

const map=L.map(mapEl,{
crs:L.CRS.Simple,
minZoom:-2,
maxZoom:2
});

const bounds=[[0,0],[px.h,px.w]];

L.imageOverlay(mapDoc.map.background.image_key,bounds).addTo(map);

map.fitBounds(bounds);

buildHitboxes(map,locDoc.locations,ui);

}

window.CC_CanyonMap={mount};

})();
