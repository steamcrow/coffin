/* File: apps/app_canyon_map/cc_canyon_map_app.js
   Coffin Canyon — Canyon Map
*/

(function () {

var BG_ZOOM = -1;
var MIN_LOADER_MS = 5000;
var FRICTION = 0.88;
var MIN_VEL = 0.0003;

var IS_SAFARI = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);

var DEFAULTS = {
  title: "Coffin Canyon — Canyon Map",
  mapUrl: "https://raw.githubusercontent.com/steamcrow/coffin/main/apps/app_canyon_map/data/canyon_map.json",
  stateUrl: "https://raw.githubusercontent.com/steamcrow/coffin/main/apps/app_canyon_map/data/canyon_state.json",
  locationsUrl: "https://raw.githubusercontent.com/steamcrow/coffin/main/data/src/170_named_locations.json",
  appCssUrl: "https://raw.githubusercontent.com/steamcrow/coffin/main/apps/app_canyon_map/cc_canyon_map.css",
  leafletCssUrl: "https://raw.githubusercontent.com/steamcrow/coffin/main/vendor/leaflet/leaflet.css",
  leafletJsUrl: "https://raw.githubusercontent.com/steamcrow/coffin/main/vendor/leaflet/leaflet.js",
  logoUrl: "https://raw.githubusercontent.com/steamcrow/coffin/main/assets/logos/coffin_canyon_logo.png",
  frameUrl: "https://raw.githubusercontent.com/steamcrow/coffin/main/apps/app_canyon_map/data/mag_frame2.png",
  lensZoomOffset: 0.2
};

var HITBOXES = window.CC_HITBOXES || {};

function el(tag, attrs, children){
  attrs = attrs || {};
  children = children || [];
  var n = document.createElement(tag);

  Object.keys(attrs).forEach(function(k){
    var v = attrs[k];
    if(k === "class") n.className = v;
    else if(k.indexOf("on") === 0 && typeof v === "function"){
      n.addEventListener(k.slice(2).toLowerCase(), v);
    } else {
      n.setAttribute(k,v);
    }
  });

  children.forEach(function(c){
    n.appendChild(typeof c === "string" ? document.createTextNode(c) : c);
  });

  return n;
}

function clamp(v,lo,hi){ return Math.max(lo,Math.min(hi,v)); }

function rafThrottle(fn){
  var pending=false;
  var lastArgs;
  return function(){
    lastArgs=arguments;
    if(pending) return;
    pending=true;
    requestAnimationFrame(function(){
      pending=false;
      fn.apply(null,lastArgs);
    });
  };
}

function nextFrame(){ return new Promise(function(r){requestAnimationFrame(r);}); }
function delay(ms){ return new Promise(function(r){setTimeout(r,ms);}); }

function meterBar(value,max,color){
  var pct=Math.round(clamp(value,0,max)/max*100);
  return '<div style="width:100%;height:24px;background:rgba(255,255,255,.08);border-radius:12px;overflow:hidden;position:relative;border:1px solid rgba(255,255,255,.12)">' +
  '<div style="height:100%;width:'+pct+'%;background:'+color+';transition:width .3s"></div>' +
  '<div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;color:#fff;font-weight:700;font-size:.85rem">'+value+' / '+max+'</div></div>';
}

function renderDrawer(ui,loc){

ui.drawerTitleEl.textContent = loc.name || loc.id;

ui.drawerContentEl.innerHTML =
'<div class="cc-block"><div class="cc-h">Description</div><p>'+(loc.description||"No description.")+'</p></div>' +
'<div class="cc-block"><div class="cc-h">Danger</div>'+meterBar(loc.danger||0,6,"#ff4444")+'</div>' +
'<div class="cc-block"><div class="cc-h">Population</div>'+meterBar(loc.population||0,6,"#4caf50")+'</div>' +
(loc.atmosphere?'<div class="cc-block"><div class="cc-h">Atmosphere</div><p style="font-style:italic;color:#aaa">'+loc.atmosphere+'</p></div>':'') +
'<div style="display:flex;flex-wrap:wrap;gap:.5rem">'+
(loc.features||[]).map(function(f){
return '<span style="padding:4px 10px;background:rgba(255,117,24,.2);border:1px solid rgba(255,117,24,.4);border-radius:4px;font-size:.85rem">'+f+'</span>';
}).join("")+"</div>";

ui.drawerEl.scrollTop=0;
}
function createHitboxEditor(root,ui){

var state={
editing:false,
editorEl:null,
active:null,
mainMap:null,
px:null
};

function ensureEditor(){
if(state.editorEl) return state.editorEl;

state.editorEl=document.createElement("div");
state.editorEl.id="cc-hitbox-editor";
ui.mapEl.appendChild(state.editorEl);

return state.editorEl;
}

function drawBoxes(){

if(!state.editing) return;

var layer=ensureEditor();
layer.innerHTML="";

Object.keys(HITBOXES).forEach(function(id){

var b=HITBOXES[id];
if(!b) return;

var p1=state.mainMap.latLngToContainerPoint([b[0],b[1]]);
var p2=state.mainMap.latLngToContainerPoint([b[2],b[3]]);

var box=document.createElement("div");
box.className="cc-hb-box";
box.dataset.id=id;

box.style.left=Math.min(p1.x,p2.x)+"px";
box.style.top=Math.min(p1.y,p2.y)+"px";
box.style.width=Math.abs(p2.x-p1.x)+"px";
box.style.height=Math.abs(p2.y-p1.y)+"px";

var label=document.createElement("div");
label.className="cc-hb-label";
label.textContent=id;
box.appendChild(label);

var handle=document.createElement("div");
handle.className="cc-hb-handle";
box.appendChild(handle);

layer.appendChild(box);

});

}

function exportHitboxes(){

var keys=Object.keys(HITBOXES).sort();

var lines=keys.map(function(k){
return '  "'+k+'": ['+HITBOXES[k].join(", ")+']';
});

var text="var HITBOXES = {\n"+lines.join(",\n")+"\n};";

window.prompt("Copy HITBOXES:",text);

}

function setEditing(on){

state.editing=on;
root.classList.toggle("cc-hitbox-edit",on);

if(!on){
if(state.editorEl) state.editorEl.style.display="none";
return;
}

if(!state.mainMap || !state.px) return;

state.mainMap.fitBounds([[0,0],[state.px.h,state.px.w]],{animate:false,padding:[20,20]});

ensureEditor().style.display="block";
drawBoxes();

state.mainMap.on("move zoom resize",drawBoxes);

}

return{
attach:function(map,px){
state.mainMap=map;
state.px=px;
},
toggle:function(){ setEditing(!state.editing); },
export:exportHitboxes
};

}
function mount(root,userOpts){

var opts=Object.assign({},DEFAULTS,userOpts||{});

root.innerHTML="";
root.classList.add("cc-canyon-map");

var header=el("div",{class:"cc-cm-header"},[
el("div",{class:"cc-cm-title"},[opts.title]),
el("div",{class:"cc-cm-actions"},[
el("button",{class:"cc-btn",id:"cc-cm-reload"},["Reload"]),
el("button",{class:"cc-btn",id:"cc-cm-fit"},["Fit"]),
el("button",{class:"cc-btn",id:"cc-cm-edit"},["Edit Hitboxes"]),
el("button",{class:"cc-btn",id:"cc-cm-export"},["Export"])
])
]);

var mapEl=el("div",{id:"cc-cm-map",class:"cc-cm-map"});

var drawer=el("div",{class:"cc-slide-panel",id:"cc-location-panel"},[
el("div",{class:"cc-slide-panel-header"},[
el("h2",{class:"cc-cm-drawer-title"},["Location"]),
el("button",{class:"cc-panel-close-btn",id:"close-dr"},["×"])
]),
el("div",{class:"cc-cm-drawer-content"})
]);

root.appendChild(header);
root.appendChild(mapEl);
root.appendChild(drawer);

var ui={
mapEl:mapEl,
drawerEl:drawer,
drawerTitleEl:drawer.querySelector(".cc-cm-drawer-title"),
drawerContentEl:drawer.querySelector(".cc-cm-drawer-content")
};

var mainMap=null;
var mapDoc=null;
var locationsData=null;

function init(){

return Promise.all([
fetch(opts.mapUrl).then(r=>r.json()),
fetch(opts.stateUrl).then(r=>r.json()),
fetch(opts.locationsUrl).then(r=>r.json())
]).then(function(results){

mapDoc=results[0];
locationsData=results[2];

var px=mapDoc.map.background.image_pixel_size;

var bounds=[[0,0],[px.h,px.w]];

mainMap=L.map(ui.mapEl,{
crs:L.CRS.Simple,
zoomControl:false,
attributionControl:false
});

L.imageOverlay(mapDoc.map.background.image_key,bounds).addTo(mainMap);

mainMap.fitBounds(bounds);

locationsData.locations.forEach(function(loc){

var bbox=HITBOXES[loc.id];
if(!bbox) return;

var rect=L.rectangle(
[[bbox[0],bbox[1]],[bbox[2],bbox[3]]],
{
color:"#ff7518",
weight:2,
fillOpacity:0.15
}
).addTo(mainMap);

rect.bindTooltip(loc.name||loc.id,{
permanent:true,
direction:"center",
className:"cc-map-hitbox-label"
});

rect.on("click",function(e){
L.DomEvent.stop(e);
renderDrawer(ui,loc);
ui.drawerEl.classList.add("cc-slide-panel-open");
});

});

});

}

root.querySelector("#close-dr").onclick=function(){
ui.drawerEl.classList.remove("cc-slide-panel-open");
};

root.querySelector("#cc-cm-edit").onclick=function(){
if(ui._hbEditor) ui._hbEditor.toggle();
};

root.querySelector("#cc-cm-export").onclick=function(){
if(ui._hbEditor) ui._hbEditor.export();
};

ui._hbEditor=createHitboxEditor(root,ui);

return init();

}

window.CC_CanyonMap={mount:mount};
window.CC_HITBOXES=HITBOXES;

})();
