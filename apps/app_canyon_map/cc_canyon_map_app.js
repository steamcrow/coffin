/* File: apps/app_canyon_map/cc_canyon_map_app.js
   Coffin Canyon — Canyon Map
*/

(function () {

  var BG_ZOOM = -1;
  var LENS_ZOOM_OFFSET = 0.95;
  var MIN_LOADER_MS = 700;

  var V_MIN = 24;
  var V_MAX = 76;
  var H_MIN = 18;
  var H_MAX = 82;

  var DEFAULTS = {
    title: "Coffin Canyon — Canyon Map",
    mapUrl: "https://raw.githubusercontent.com/steamcrow/coffin/main/apps/app_canyon_map/data/canyon_map.json",
    appCssUrl: "https://raw.githubusercontent.com/steamcrow/coffin/main/apps/app_canyon_map/cc_canyon_map.css",
    leafletCssUrl: "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css",
    leafletJsUrl: "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js",
    logoUrl: "https://raw.githubusercontent.com/steamcrow/coffin/main/assets/logos/coffin_canyon_logo.png",
    knobUrl: "https://raw.githubusercontent.com/steamcrow/coffin/main/apps/app_canyon_map/data/blappo_knob.png"
  };

  var root;
  var mapBG;
  var mapLens;
  var knobH;
  var knobV;

  var state = { h:50, v:50 };
  var loaderStart;

  function el(tag, attrs, children) {
    var e = document.createElement(tag);
    if (attrs) {
      Object.keys(attrs).forEach(function (k) {
        if (k === "class") e.className = attrs[k];
        else e.setAttribute(k, attrs[k]);
      });
    }
    (children || []).forEach(function (c) {
      if (typeof c === "string") e.appendChild(document.createTextNode(c));
      else e.appendChild(c);
    });
    return e;
  }

  function loadCSS(url) {
    return fetch(url)
      .then(r=>r.text())
      .then(css=>{
        var s=document.createElement("style");
        s.textContent=css;
        document.head.appendChild(s);
      });
  }

  function loadScript(url){
    return new Promise(function(resolve,reject){

      if(window.L){
        resolve();
        return;
      }

      var s=document.createElement("script");
      s.src=url;
      s.async=false;

      s.onload=function(){
        if(window.L) resolve();
        else reject("Leaflet failed to initialize");
      };

      s.onerror=reject;

      document.head.appendChild(s);

    });
  }

  function buildLoader(){

    var style=document.createElement("style");
    style.textContent=`
      .cc-loader{
        position:absolute;
        inset:0;
        display:flex;
        align-items:center;
        justify-content:center;
        background:#000;
        z-index:999;
      }
      .cc-loader img{
        width:280px;
        height:auto;
      }
    `;
    document.head.appendChild(style);

    var loader=el("div",{class:"cc-loader"},[
      el("img",{src:DEFAULTS.logoUrl})
    ]);

    root.appendChild(loader);
    return loader;

  }

  function hideLoader(loader){

    var elapsed=performance.now()-loaderStart;
    var wait=Math.max(0,MIN_LOADER_MS-elapsed);

    setTimeout(function(){
      loader.remove();
    },wait);

  }

  function createLayout(){

   var bg = el("div",{id:"cc-bg-map"});
   var lens = el("div",{id:"cc-lens-map"});

   bg.style.position = "absolute";
   bg.style.inset = "0";

   lens.style.position = "absolute";
   lens.style.inset = "0";

    knobH=el("img",{class:"cc-knob-h",src:DEFAULTS.knobUrl});
    knobV=el("img",{class:"cc-knob-v",src:DEFAULTS.knobUrl});

    root.appendChild(bg);
    root.appendChild(lens);
    root.appendChild(knobH);
    root.appendChild(knobV);

    mapBG=L.map(bg,{
      zoomControl:false,
      attributionControl:false,
      dragging:false,
      scrollWheelZoom:false
    });

    mapLens=L.map(lens,{
      zoomControl:false,
      attributionControl:false,
      dragging:false,
      scrollWheelZoom:false,
      zoomSnap:0
    });

  }

  function createOverlays(mapData){

  return new Promise(function(resolve,reject){

    if(!mapData.map || !mapData.map.background || !mapData.map.lens){
      reject("Map JSON missing map.background or map.lens");
      return;
    }

    var bgUrl = mapData.map.background.image_key;
    var lensUrl = mapData.map.lens.image_key;

    var w = mapData.map.background.image_pixel_size.w;
    var h = mapData.map.background.image_pixel_size.h;

    if(!bgUrl || !lensUrl){
      reject("Map JSON missing image_key fields");
      return;
    }

    var bounds = [[0,0],[h,w]];

    var bgOverlay = L.imageOverlay(bgUrl, bounds).addTo(mapBG);
    var lensOverlay = L.imageOverlay(lensUrl, bounds).addTo(mapLens);

    mapBG.fitBounds(bounds);
    mapLens.fitBounds(bounds);

    mapBG.setZoom(BG_ZOOM);
    mapLens.setZoom(BG_ZOOM + LENS_ZOOM_OFFSET);

    Promise.all([
      new Promise(r => bgOverlay.once("load", r)),
      new Promise(r => lensOverlay.once("load", r))
    ]).then(resolve);

  });

}

  function applyView(){

    var rect=root.getBoundingClientRect();

    var x=rect.width*(state.h/100);
    var y=rect.height*(state.v/100);

    var point=mapBG.containerPointToLatLng([x,y]);

    mapBG.panTo(point,{animate:false});
    mapLens.panTo(point,{animate:false});

    knobH.style.left=state.h+"%";
    knobV.style.top=state.v+"%";

  }

  function bindKnobs(){

    function dragStart(e,axis){

      e.preventDefault();
      e.target.setPointerCapture(e.pointerId); 
      var rect=root.getBoundingClientRect();

      function move(ev){

        if(axis==="h"){
          var x=(ev.clientX-rect.left)/rect.width*100;
          state.h=Math.min(H_MAX,Math.max(H_MIN,x));
        }

        if(axis==="v"){
          var y=(ev.clientY-rect.top)/rect.height*100;
          state.v=Math.min(V_MAX,Math.max(V_MIN,y));
        }

        applyView();
      }

      function up(){
        window.removeEventListener("pointermove",move);
        window.removeEventListener("pointerup",up);
      }

      window.addEventListener("pointermove",move);
      window.addEventListener("pointerup",up);

    }

    knobH.addEventListener("pointerdown",e=>dragStart(e,"h"));
    knobV.addEventListener("pointerdown",e=>dragStart(e,"v"));

  }

  function mount(el,opts){

  root=el;

  root.style.position = "relative";
  root.style.width = "100%";
  root.style.height = "100vh";

  var o=Object.assign({},DEFAULTS,opts||{});

    loaderStart=performance.now();
    var loader=buildLoader();

    Promise.all([
      loadCSS(o.leafletCssUrl),
      loadCSS(o.appCssUrl),
      loadScript(o.leafletJsUrl)
    ])
    .then(function(){

      createLayout();
      return fetch(o.mapUrl).then(r=>r.json());

    })
    .then(function(mapData){

      return createOverlays(mapData);

    })
    .then(function(){

     mapBG.invalidateSize();
     mapLens.invalidateSize();

     bindKnobs();
     applyView();
     hideLoader(loader);

   })
    .catch(function(err){

      console.error("Canyon Map load error:",err);
      hideLoader(loader);

    });

  }

  window.CC_CanyonMap={mount:mount};

})();
