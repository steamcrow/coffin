(function(){

function createEditor(map,hitboxes){

let active=null;
let layer=L.layerGroup().addTo(map);

function draw(){

layer.clearLayers();

Object.entries(hitboxes).forEach(([id,b])=>{

let rect=L.rectangle(
[[b[0],b[1]],[b[2],b[3]]],
{
color:"#00ffff",
weight:2,
fillOpacity:.1
}
).addTo(layer);

rect.bindTooltip(id,{permanent:true,direction:"center"});

rect.on("mousedown",startMove);
rect.on("touchstart",startMove);

rect._id=id;

});

}

function startMove(e){

active={
rect:e.target,
start:e.latlng
};

map.on("mousemove",move);
map.on("mouseup",end);

map.on("touchmove",move);
map.on("touchend",end);

}

function move(e){

if(!active) return;

let id=active.rect._id;
let b=hitboxes[id];

let dy=e.latlng.lat-active.start.lat;
let dx=e.latlng.lng-active.start.lng;

hitboxes[id]=[
b[0]+dy,
b[1]+dx,
b[2]+dy,
b[3]+dx
];

active.start=e.latlng;

draw();

}

function end(){

active=null;

map.off("mousemove",move);
map.off("mouseup",end);

map.off("touchmove",move);
map.off("touchend",end);

}

function exportJSON(){

let text=JSON.stringify(hitboxes,null,2);

window.prompt("Copy hitboxes:",text);

}

draw();

return{

refresh:draw,

export:exportJSON,

add:function(id,lat,lng){

hitboxes[id]=[
lat,
lng,
lat+120,
lng+120
];

draw();

},

delete:function(id){

delete hitboxes[id];
draw();

}

};

}

window.CC_HitboxEditor=createEditor;

})();
