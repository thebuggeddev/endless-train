import * as THREE from 'three';
import './style.css';

const $ = s => document.querySelector(s);
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const PI = Math.PI, TAU = PI * 2;

// ---------- deterministic randomness ----------
function mulberry32(a){ return function(){ a|=0; a=a+0x6D2B79F5|0; let t=Math.imul(a^a>>>15,1|a); t=t+Math.imul(t^t>>>7,61|t)^t; return ((t^t>>>14)>>>0)/4294967296; }; }
function hash1(n){ const x=Math.sin(n*127.1+311.7)*43758.5453; return x-Math.floor(x); }
function pickW(rng, arr){ let tot=0; for(const a of arr) tot+=a[1]; let r=rng()*tot; for(const a of arr){ r-=a[1]; if(r<=0) return a[0]; } return arr[0][0]; }
const rr = (rng,a,b) => a + (b-a)*rng();

// ---------- renderer / scene ----------
const canvas = $('#scene');
const renderer = new THREE.WebGLRenderer({ canvas, antialias:true, powerPreference:'high-performance' });
// resolution adapts to hold 60fps: drops when frames run late, climbs back when there is headroom
const DPR_MAX = Math.min(window.devicePixelRatio || 1, 1.5), DPR_MIN = Math.min(DPR_MAX, 0.75);
let dpr = DPR_MAX;
renderer.setPixelRatio(dpr);
renderer.setSize(innerWidth, innerHeight, false);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.02;

const scene = new THREE.Scene();
scene.background = new THREE.Color('#F2F0F4');
scene.fog = new THREE.Fog('#F2F0F4', 30, 120);

const camera = new THREE.PerspectiveCamera(46, innerWidth/innerHeight, 0.1, 400);

const hemi = new THREE.HemisphereLight('#E4EAF7', '#EBD6C0', 1.45);
const sun = new THREE.DirectionalLight('#FFF0D6', 2.7);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, { left:-36, right:36, top:36, bottom:-36, near:1, far:170 });
sun.shadow.bias = -0.0004;
sun.shadow.normalBias = 0.035;
scene.add(hemi, sun, sun.target);
const SUN_DIR = new THREE.Vector3(-0.55, 0.74, 0.40).normalize();

// ---------- colour helpers ----------
const colCache = new Map();
function C(hex){ let c = colCache.get(hex); if(!c){ c = new THREE.Color(hex); colCache.set(hex, c); } return c; }
const _jc = new THREE.Color();
function J(hex, rng, amt=0.06){ const k = 1 + (rng()-0.5)*2*amt; return _jc.copy(C(hex)).multiplyScalar(k); }

// ---------- procedural textures ----------
const maxAniso = Math.min(8, renderer.capabilities.getMaxAnisotropy());
function canvasTex(w, h, draw, srgb=true){
  const c = document.createElement('canvas'); c.width=w; c.height=h;
  const g = c.getContext('2d'); draw(g, w, h, c);
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = maxAniso;
  return t;
}
function wrapDraw(w, h, x, y, fn){ for(const dx of [-w,0,w]) for(const dy of [-h,0,h]) fn(x+dx, y+dy); }

const texPlaster = canvasTex(256, 256, (g,w,h) => {
  const r = mulberry32(7);
  g.fillStyle = '#f3f3f3'; g.fillRect(0,0,w,h);
  for (let i=0;i<120;i++){
    const x=r()*w, y=r()*h, rad=6+r()*26, v=r()<0.5?255:222, a=0.10+r()*0.12;
    wrapDraw(w,h,x,y,(X,Y)=>{ const gr=g.createRadialGradient(X,Y,0,X,Y,rad); gr.addColorStop(0,`rgba(${v},${v},${v},${a})`); gr.addColorStop(1,`rgba(${v},${v},${v},0)`); g.fillStyle=gr; g.fillRect(X-rad,Y-rad,rad*2,rad*2); });
  }
  const id = g.getImageData(0,0,w,h), d = id.data;
  for (let i=0;i<d.length;i+=4){ const n=(r()-0.5)*26; d[i]+=n; d[i+1]+=n; d[i+2]+=n; }
  g.putImageData(id,0,0);
  for (let i=0;i<900;i++){ const x=r()*w, y=r()*h, s=r()*1.6+0.4, v=150+r()*70|0; g.fillStyle=`rgba(${v},${v},${v},0.6)`; g.fillRect(x,y,s,s); }
});

function azulejoTex(ink, ink2, seed){
  return canvasTex(256, 256, (g,w,h) => {
    const T = 128;
    for (let ty=0; ty<2; ty++) for (let tx=0; tx<2; tx++){
      const ox=tx*T, oy=ty*T;
      g.fillStyle = '#F7F4EC'; g.fillRect(ox,oy,T,T);
      g.save(); g.beginPath(); g.rect(ox,oy,T,T); g.clip();
      g.fillStyle = ink; g.strokeStyle = ink; g.lineWidth = 5;
      for (const [cx,cy] of [[0,0],[T,0],[0,T],[T,T]]){ g.beginPath(); g.arc(ox+cx,oy+cy,T*0.42,0,TAU); g.stroke(); g.beginPath(); g.arc(ox+cx,oy+cy,T*0.2,0,TAU); g.fill(); }
      const cx=ox+T/2, cy=oy+T/2;
      g.fillStyle = ink2;
      for (let k=0;k<4;k++){ const a=k*PI/2+PI/4; g.beginPath(); g.ellipse(cx+Math.cos(a)*16, cy+Math.sin(a)*16, 15, 7, a, 0, TAU); g.fill(); }
      g.fillStyle = ink; g.beginPath(); g.arc(cx,cy,7,0,TAU); g.fill();
      for (let k=0;k<4;k++){ const a=k*PI/2; g.beginPath(); g.arc(cx+Math.cos(a)*40, cy+Math.sin(a)*40, 4, 0, TAU); g.fill(); }
      g.restore();
      g.strokeStyle = 'rgba(120,120,130,0.35)'; g.lineWidth = 2; g.strokeRect(ox+1,oy+1,T-2,T-2);
    }
    const r = mulberry32(seed), id = g.getImageData(0,0,w,h), d=id.data;
    for (let i=0;i<d.length;i+=4){ const n=(r()-0.5)*14; d[i]+=n; d[i+1]+=n; d[i+2]+=n; }
    g.putImageData(id,0,0);
  });
}
const texAzBlue = azulejoTex('#2A4B98', '#4F71B8', 3);
const texAzGreen = azulejoTex('#2F6B55', '#D9A531', 5);

const texCalc = canvasTex(256, 256, (g,w,h) => {
  const r = mulberry32(11);
  g.fillStyle = '#A9A097'; g.fillRect(0,0,w,h);
  const S = 13;
  for (let y=0; y<h; y+=S) for (let x=0; x<w; x+=S){
    const jx = x + (r()-0.5)*3, jy = y + (r()-0.5)*3;
    const cx = jx + S/2, cy = jy + S/2;
    const band = Math.abs(cy - (h*0.5 + Math.sin(cx/w*TAU*2)*h*0.22));
    const dark = band < 16;
    const v = dark ? 60 + r()*25 : 222 + r()*28;
    g.fillStyle = dark ? `rgb(${v},${v-4},${v-6})` : `rgb(${v},${v-5},${v-14})`;
    wrapDraw(w,h,jx+1.2,jy+1.2,(X,Y)=>{ g.beginPath(); const s=S-2.6; g.moveTo(X+1.5,Y); g.lineTo(X+s,Y+r()*1.5); g.lineTo(X+s-r()*1.5,Y+s); g.lineTo(X,Y+s-r()*1.5); g.closePath(); g.fill(); });
  }
});

const texLeaf = canvasTex(128, 128, (g,w,h) => {
  g.clearRect(0,0,w,h);
  g.translate(w/2, h*0.56);
  g.beginPath();
  for (let i=0;i<=240;i++){
    const a = i/240*TAU;
    const lobe = Math.pow(Math.abs(Math.cos(a*2.5)), 0.7);
    const teeth = 0.05*Math.abs(Math.sin(a*14));
    let R = 0.25 + 0.2*lobe + teeth;
    if (Math.sin(a) > 0.75) R *= 0.55;
    const x = Math.cos(a - PI/2 + PI)*R*w*0.95, y = Math.sin(a - PI/2 + PI)*R*h*0.95;
    i ? g.lineTo(x,y) : g.moveTo(x,y);
  }
  g.closePath(); g.fillStyle = '#ffffff'; g.fill();
  g.strokeStyle = 'rgba(150,120,100,0.55)'; g.lineWidth = 2;
  for (const a of [-PI/2, -PI/2-1.2, -PI/2+1.2, -PI/2-2.3, -PI/2+2.3]){ g.beginPath(); g.moveTo(0,4); g.lineTo(Math.cos(a)*42, Math.sin(a)*42); g.stroke(); }
  g.beginPath(); g.moveTo(0,4); g.lineTo(0,34); g.lineWidth=3; g.stroke();
});
texLeaf.wrapS = texLeaf.wrapT = THREE.ClampToEdgeWrapping;

// paper grain overlay
(function(){
  const c = document.createElement('canvas'); c.width = c.height = 320;
  const g = c.getContext('2d'), r = mulberry32(99);
  g.fillStyle = '#fff'; g.fillRect(0,0,320,320);
  const id = g.getImageData(0,0,320,320), d = id.data;
  for (let i=0;i<d.length;i+=4){ const n = 255 - r()*24; d[i]=n; d[i+1]=n; d[i+2]=n+2; }
  g.putImageData(id,0,0);
  g.strokeStyle = 'rgba(160,150,175,0.10)';
  for (let i=0;i<140;i++){ const x=r()*320, y=r()*320, a=r()*TAU, l=6+r()*22; g.lineWidth=0.6+r(); g.beginPath(); g.moveTo(x,y); g.quadraticCurveTo(x+Math.cos(a+0.6)*l*0.5, y+Math.sin(a+0.6)*l*0.5, x+Math.cos(a)*l, y+Math.sin(a)*l); g.stroke(); }
  $('#grain').style.backgroundImage = `url(${c.toDataURL()})`;
})();

// ---------- materials ----------
// One set of uniforms drives season, weather and wind on every material, so the whole
// street you are looking at changes in place: snow settles, leaves turn and fall, cobbles get wet.
const U = {
  uTime:{value:0}, uWind:{value:0.3}, uSnow:{value:0}, uWet:{value:0},
  uSnowCol:{value:new THREE.Color('#F3F6FA')},
  uSeasonA:{value:2}, uSeasonB:{value:3}, uSeasonMix:{value:0},
  uAmt:{value:new THREE.Vector3(0.85, 0.95, 1.0)},
  uPal:{value:null},
  uHaze:{value:new THREE.Color('#F2F0F4')}, uHazeNear:{value:70}, uHazeFar:{value:520},
};
const GLSL_HASH = 'float lnHash(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7)))*43758.5453); }\n';
function weatherize(mat, opts = {}){
  const wet = opts.wet !== false, snow = opts.snow !== false, haze = !!opts.haze;
  mat.customProgramCacheKey = () => `lnw${+wet}${+snow}${+haze}`;
  mat.onBeforeCompile = sh => {
    Object.assign(sh.uniforms, { uSnow:U.uSnow, uWet:U.uWet, uSnowCol:U.uSnowCol, uHaze:U.uHaze, uHazeNear:U.uHazeNear, uHazeFar:U.uHazeFar });
    sh.vertexShader = 'varying vec3 vWPos;\n' + sh.vertexShader.replace('#include <project_vertex>', `#include <project_vertex>
      vec4 lnW = vec4(transformed, 1.0);
      #ifdef USE_INSTANCING
        lnW = instanceMatrix * lnW;
      #endif
      vWPos = (modelMatrix * lnW).xyz;`);
    let fs = 'varying vec3 vWPos;\nuniform float uSnow; uniform float uWet; uniform vec3 uSnowCol; uniform vec3 uHaze; uniform float uHazeNear; uniform float uHazeFar;\n' + GLSL_HASH + sh.fragmentShader;
    fs = fs.replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
      {
        float up = inverseTransformDirection(normal, viewMatrix).y;
        float cover = 0.0;
        ${snow ? `float n = lnHash(floor(vWPos.xz*3.0))*0.6 + lnHash(floor(vWPos.xz*0.7))*0.4;
        cover = smoothstep(n*0.7, n*0.7 + 0.3, uSnow) * smoothstep(0.45, 0.8, up);
        diffuseColor.rgb = mix(diffuseColor.rgb, uSnowCol, cover);` : ''}
        float lnWet = uWet * smoothstep(0.3, 0.8, up) * (1.0 - cover);
        diffuseColor.rgb *= 1.0 - 0.32*lnWet;
        ${wet ? 'roughnessFactor = mix(roughnessFactor, 0.14, lnWet);' : ''}
      }`);
    if (haze) fs = fs.replace('#include <colorspace_fragment>', '#include <colorspace_fragment>\n  gl_FragColor.rgb = mix(gl_FragColor.rgb, uHaze, smoothstep(uHazeNear, uHazeFar, distance(vWPos, cameraPosition)));');
    sh.fragmentShader = fs;
  };
  return mat;
}
const matPlaster = weatherize(new THREE.MeshStandardMaterial({ vertexColors:true, map:texPlaster, bumpMap:texPlaster, bumpScale:1.4, roughness:0.93, metalness:0 }));
const matAz = [texAzBlue, texAzGreen].map(t => weatherize(new THREE.MeshStandardMaterial({ vertexColors:true, map:t, roughness:0.38, metalness:0 })));
const matCalc = weatherize(new THREE.MeshStandardMaterial({ map:texCalc, bumpMap:texCalc, bumpScale:0.8, roughness:0.86 }));
const matCobble = weatherize(new THREE.MeshStandardMaterial({ roughness:0.82, metalness:0 }));
const matSteel = new THREE.MeshStandardMaterial({ vertexColors:true, roughness:0.35, metalness:0.55 });
const matLamp = new THREE.MeshStandardMaterial({ color:'#FFE6A8', emissive:'#FFB44A', emissiveIntensity:0.45, roughness:0.35 });
const matGlassDark = new THREE.MeshStandardMaterial({ vertexColors:true, roughness:0.22, metalness:0.1 });
const matGlassLit = new THREE.MeshStandardMaterial({ vertexColors:true, roughness:0.22, metalness:0.1, emissive:'#000000' });
const matCity = weatherize(new THREE.MeshStandardMaterial({ vertexColors:true, map:texPlaster, roughness:0.92, metalness:0, fog:false }), { wet:false, haze:true });
const matWater = weatherize(new THREE.MeshLambertMaterial({ vertexColors:true, fog:false }), { wet:false, snow:false, haze:true });
const matCityLights = new THREE.PointsMaterial({ color:'#FFC46B', size:0.55, sizeAttenuation:true, transparent:true, opacity:0, fog:false, depthWrite:false });
const matLeafFall = new THREE.MeshStandardMaterial({ map:texLeaf, alphaTest:0.5, side:THREE.DoubleSide, roughness:0.75 });

// leaf colours per season (rows) and kind (canopy, vines, ground cover), read in the shader
const PAL = [
  ['#F6C9D6','#F2A7BE','#FBF3F5','#E98AA8','#A8C96A','#F6C9D6','#F4B6C8','#9CC460'],
  ['#6F9A43','#8FB85A','#B78AD6','#9A6CC4','#6F9A43','#A8C96A','#8E63C2','#7FA84C'],
  ['#F6C9D6','#FBF3F5','#F2A7BE','#E98AA8','#F4B6C8','#FBF3F5','#F6C9D6','#A8C96A'],
  ['#5E8C3A','#4E7A32','#78A548','#3F6B2C','#8DB456','#5E8C3A','#6A9A40','#4E7A32'],
  ['#D6336C','#C2185B','#5E8C3A','#78A548','#D6336C','#E8568A','#5E8C3A','#B8124A'],
  ['#78A548','#8DB456','#C9B458','#5E8C3A','#A8B04A','#78A548','#D9C27A','#6A9A40'],
  ['#E8561E','#F07F22','#F4A93A','#D23A26','#C0282F','#F6C54A','#E8561E','#F07F22'],
  ['#D6336C','#C2185B','#E8561E','#F07F22','#B8124A','#D6336C','#E8561E','#C2185B'],
  ['#E8561E','#F07F22','#F4A93A','#D23A26','#C0282F','#F6C54A','#B8563A','#F07F22'],
  ['#8A6A4A','#A07850','#6E5540','#9A7A58','#8A6A4A','#7A5E44','#A07850','#6E5540'],
  ['#8A6A4A','#A07850','#6E5540','#7A5E44','#8A6A4A','#9A7A58','#6E5540','#A07850'],
  ['#8A6A4A','#A07850','#6E5540','#9A7A58','#8A6A4A','#7A5E44','#A07850','#6E5540'],
];
(function(){
  const d = new Uint8Array(8*12*4);
  PAL.forEach((row, r) => row.forEach((hex, c) => { const n = parseInt(hex.slice(1), 16), i = (r*8 + c)*4; d[i] = n>>16&255; d[i+1] = n>>8&255; d[i+2] = n&255; d[i+3] = 255; }));
  const t = new THREE.DataTexture(d, 8, 12, THREE.RGBAFormat);
  t.colorSpace = THREE.SRGBColorSpace; t.magFilter = t.minFilter = THREE.NearestFilter; t.needsUpdate = true;
  U.uPal.value = t;
})();
function leafVertex(src, withColor){
  return `attribute vec3 aLeaf; uniform float uTime; uniform float uWind; uniform float uSeasonA; uniform float uSeasonB; uniform float uSeasonMix; uniform vec3 uAmt; uniform sampler2D uPal; varying vec3 vLeafCol;\n` + src
    .replace('#include <begin_vertex>', `#include <begin_vertex>
      float lAmt = aLeaf.z < 0.5 ? uAmt.x : (aLeaf.z < 1.5 ? uAmt.y : uAmt.z);
      transformed *= smoothstep(aLeaf.y - 0.08, aLeaf.y, lAmt);`)
    .replace('#include <project_vertex>', `
      vec4 mvPosition = vec4(transformed, 1.0);
      #ifdef USE_INSTANCING
        mvPosition = instanceMatrix * mvPosition;
      #endif
      float lSway = aLeaf.z < 1.5 ? 1.0 : 0.0;
      mvPosition.xyz += lSway * vec3(sin(uTime*1.9 + mvPosition.y*0.7 + mvPosition.x*0.4), 0.35*sin(uTime*2.3 + mvPosition.z*0.6), cos(uTime*1.4 + mvPosition.x*0.5)) * (0.02 + 0.14*uWind);
      mvPosition = modelViewMatrix * mvPosition;
      gl_Position = projectionMatrix * mvPosition;
      ${withColor ? `float lRowA = (uSeasonA*3.0 + aLeaf.z + 0.5)/12.0, lRowB = (uSeasonB*3.0 + aLeaf.z + 0.5)/12.0;
      vLeafCol = mix(texture2D(uPal, vec2(aLeaf.x, lRowA)).rgb, texture2D(uPal, vec2(aLeaf.x, lRowB)).rgb, uSeasonMix);` : 'vLeafCol = vec3(1.0);'}`);
}
const LEAF_UNIFORMS = sh => Object.assign(sh.uniforms, { uTime:U.uTime, uWind:U.uWind, uSeasonA:U.uSeasonA, uSeasonB:U.uSeasonB, uSeasonMix:U.uSeasonMix, uAmt:U.uAmt, uPal:U.uPal });
const matLeaf = new THREE.MeshStandardMaterial({ map:texLeaf, alphaTest:0.5, side:THREE.DoubleSide, roughness:0.75 });
matLeaf.customProgramCacheKey = () => 'lnleaf';
matLeaf.onBeforeCompile = sh => {
  LEAF_UNIFORMS(sh);
  sh.vertexShader = leafVertex(sh.vertexShader, true);
  sh.fragmentShader = 'varying vec3 vLeafCol;\n' + sh.fragmentShader.replace('#include <color_fragment>', '#include <color_fragment>\n  diffuseColor.rgb *= vLeafCol;');
};
// shadows follow the same leaves, so bare winter trees cast bare shadows
const matLeafDepth = new THREE.MeshDepthMaterial({ depthPacking:THREE.RGBADepthPacking, map:texLeaf, alphaTest:0.5 });
matLeafDepth.customProgramCacheKey = () => 'lnleafdepth';
matLeafDepth.onBeforeCompile = sh => { LEAF_UNIFORMS(sh); sh.vertexShader = leafVertex(sh.vertexShader, false); };


// ---------- geometry templates ----------
const UNIT_BOX = new THREE.BoxGeometry(1,1,1);
const POT = new THREE.CylinderGeometry(0.5, 0.38, 1, 9);
const ICO = new THREE.IcosahedronGeometry(1, 0);
const CONE4 = new THREE.ConeGeometry(0.5, 1, 4);
const GABLE = (() => {
  const g = new THREE.BufferGeometry();
  const p = [0,0,0, 0,1,0.5, 0,0,1,  0,0,0, 0,0,1, 0,1,0.5];
  g.setAttribute('position', new THREE.Float32BufferAttribute(p,3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute([0,0, .5,1, 1,0, 0,0, 1,0, .5,1],2));
  g.computeVertexNormals(); return g;
})();
const LEAF_GEO = new THREE.PlaneGeometry(1,1);
const FLAG = (() => {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute([-0.5,0,0, 0.5,0,0, 0,-1,0,  -0.5,0,0, 0,-1,0, 0.5,0,0],3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute([0,0, 1,0, .5,1, 0,0, .5,1, 1,0],2));
  g.computeVertexNormals(); return g;
})();
const COBBLE_GEO = (() => {
  const s=0.22, c=0.055, h=0.12, ch=0.04;
  const oct = (hs,cc,y) => [[hs-cc,-hs],[hs,-hs+cc],[hs,hs-cc],[hs-cc,hs],[-hs+cc,hs],[-hs,hs-cc],[-hs,-hs+cc],[-hs+cc,-hs]].map(p=>new THREE.Vector3(p[0],y,p[1]));
  const B = oct(s,c,0), M = oct(s,c,h-ch), T = oct(s-ch,c*0.7,h);
  const pos = [], ctr = new THREE.Vector3(0,h*0.4,0), n=new THREE.Vector3(), e1=new THREE.Vector3(), e2=new THREE.Vector3(), m=new THREE.Vector3();
  function tri(a,b,d){ e1.subVectors(b,a); e2.subVectors(d,a); n.crossVectors(e1,e2); m.copy(a).add(b).add(d).multiplyScalar(1/3).sub(ctr); if (n.dot(m) < 0){ const t=b; b=d; d=t; } pos.push(a.x,a.y,a.z,b.x,b.y,b.z,d.x,d.y,d.z); }
  for (let i=0;i<8;i++){ const j=(i+1)%8; tri(B[i],B[j],M[j]); tri(B[i],M[j],M[i]); tri(M[i],M[j],T[j]); tri(M[i],T[j],T[i]); }
  for (let i=1;i<7;i++) tri(T[0],T[i],T[i+1]);
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos,3)); g.computeVertexNormals(); return g;
})();

// ---------- merge builder ----------
const BOX_FACE = [[2,1],[2,1],[0,2],[0,2],[0,1],[0,1]];
const _nm = new THREE.Matrix3();
class Builder {
  constructor(ts=2){ this.p=[]; this.n=[]; this.u=[]; this.c=[]; this.i=[]; this.v=0; this.ts=ts; }
  add(g, m, col, dims){
    const ts = this.ts;
    const P = g.attributes.position.array, N = g.attributes.normal.array;
    const U = g.attributes.uv ? g.attributes.uv.array : null;
    const GC = g.attributes.color ? g.attributes.color.array : null;
    const e = m.elements; _nm.getNormalMatrix(m); const q = _nm.elements;
    const cnt = P.length/3, base = this.v;
    const cr = col.r, cg = col.g, cb = col.b;
    for (let k=0;k<cnt;k++){
      const x=P[k*3], y=P[k*3+1], z=P[k*3+2];
      this.p.push(e[0]*x+e[4]*y+e[8]*z+e[12], e[1]*x+e[5]*y+e[9]*z+e[13], e[2]*x+e[6]*y+e[10]*z+e[14]);
      const nx=N[k*3], ny=N[k*3+1], nz=N[k*3+2];
      let ax=q[0]*nx+q[3]*ny+q[6]*nz, ay=q[1]*nx+q[4]*ny+q[7]*nz, az=q[2]*nx+q[5]*ny+q[8]*nz;
      const l = Math.hypot(ax,ay,az) || 1; this.n.push(ax/l, ay/l, az/l);
      let uu = U ? U[k*2] : 0, vv = U ? U[k*2+1] : 0;
      if (dims){ const f = BOX_FACE[(k/4)|0]; uu *= dims[f[0]]/ts; vv *= dims[f[1]]/ts; }
      this.u.push(uu, vv);
      if (GC) this.c.push(cr*GC[k*3], cg*GC[k*3+1], cb*GC[k*3+2]); else this.c.push(cr, cg, cb);
    }
    if (g.index){ const I=g.index.array; for (let k=0;k<I.length;k++) this.i.push(base+I[k]); }
    else for (let k=0;k<cnt;k++) this.i.push(base+k);
    this.v += cnt;
  }
  mesh(mat, cast=true, recv=true){
    if (!this.v) return null;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.p,3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.n,3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(this.u,2));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.c,3));
    g.setIndex(this.v > 65535 ? new THREE.Uint32BufferAttribute(this.i,1) : new THREE.Uint16BufferAttribute(this.i,1));
    g.computeBoundingSphere();
    const m = new THREE.Mesh(g, mat); m.castShadow = cast; m.receiveShadow = recv; return m;
  }
}

const _m = new THREE.Matrix4(), _m2 = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler();
const _v = new THREE.Vector3(), _v2 = new THREE.Vector3(), _s = new THREE.Vector3(), _d = new THREE.Vector3();
const ZAX = new THREE.Vector3(0,0,1), YAX = new THREE.Vector3(0,1,0);
const IDENT = new THREE.Matrix4();

function lbox(B, M, cx,cy,cz, sx,sy,sz, col, rx=0, ry=0, rz=0, order='XYZ'){
  _e.set(rx,ry,rz,order); _q.setFromEuler(_e);
  _m.compose(_v.set(cx,cy,cz), _q, _s.set(sx,sy,sz)).premultiply(M);
  B.add(UNIT_BOX, _m, col, [sx,sy,sz]);
}
function lgeo(B, M, g, cx,cy,cz, sx,sy,sz, col, rx=0, ry=0, rz=0, order='XYZ'){
  _e.set(rx,ry,rz,order); _q.setFromEuler(_e);
  _m.compose(_v.set(cx,cy,cz), _q, _s.set(sx,sy,sz)).premultiply(M);
  B.add(g, _m, col, null);
}
function segBox(B, a, b, t, col){
  _d.subVectors(b,a); const len = _d.length(); _d.divideScalar(len || 1);
  _q.setFromUnitVectors(ZAX, _d);
  _m.compose(_v.addVectors(a,b).multiplyScalar(0.5), _q, _s.set(t,t,len));
  B.add(UNIT_BOX, _m, col, [t,t,len]);
}

// ---------- the endless route ----------
const DS = 0.5;
const PX=[0], PZ=[0], PH=[], PY=[];
const smooth01 = x => { x = Math.max(0, Math.min(1, x)); return x*x*(3-2*x); };
function hy(s){ return 7.5*Math.sin(s*0.0061+0.3) + 3.4*Math.sin(s*0.0173+1.7) + 1.2*Math.sin(s*0.041+0.4); }
function dhy(s){ return 7.5*0.0061*Math.cos(s*0.0061+0.3) + 3.4*0.0173*Math.cos(s*0.0173+1.7) + 1.2*0.041*Math.cos(s*0.041+0.4); }
function headBase(s){ return 0.5*Math.sin(s*0.012+1.3) + 0.25*Math.sin(s*0.03+4.1) + 0.08*Math.sin(s*0.07+2.2); }

// one feature at most per 280 m block, always aligned to the 20 m house cells
const BLOCK = 280;
const DISTRICTS = [['Castelo','Graça'],['Alfama','Sé'],['Estrela','Lapa'],['Bica','Chiado'],['Mouraria','Penha'],['Belém','Ajuda']];
const featCache = new Map();
function feature(k){
  if (featCache.has(k)) return featCache.get(k);
  let f = null;
  if (k >= 1){
    const r = hash1(k*7.31 + 1.7), at = k*BLOCK + 100;
    // a repeating 1.4 km pattern so every kind of place comes round regularly
    const slot = k % 5, side = hash1(k*3.3) < 0.5 ? 1 : -1;
    if (slot === 3) f = { type:'junction', s0:at, s1:at+100, J:at, k, names:DISTRICTS[Math.floor(k/5) % DISTRICTS.length] };
    else if (slot === 2) f = { type:'bridge', s0:at, s1:at+60 };
    else if (slot === 4) f = { type:'miradouro', s0:at, s1:at+40, side };
    else if (slot === 0 && Math.abs(dhy(at+10)) < 0.075) f = { type:'arch', s0:at+6, s1:at+14 };
    else if (slot === 1 && r < 0.5) f = { type:'miradouro', s0:at, s1:at+40, side };
    else f = { type:'festival', s0:at, s1:at+80 };
  }
  featCache.set(k, f); return f;
}
function featuresIn(a, b){ const out = []; for (let k = Math.floor(a/BLOCK)-1; k <= Math.floor(b/BLOCK)+1; k++){ const f = feature(k); if (f && f.s1 >= a && f.s0 <= b) out.push(f); } return out; }
function featureAt(s, m = 0){ for (const f of featuresIn(s-m-1, s+m+1)) if (s >= f.s0 - m && s <= f.s1 + m) return f; return null; }

// junctions: the branch you pick bends the line for a while, then it settles back
const junctionChoice = new Map();
let junctionPick = 1, onJunctionLocked = () => {};
function choiceFor(k){ if (!junctionChoice.has(k)){ junctionChoice.set(k, junctionPick); onJunctionLocked(k); } return junctionChoice.get(k); }
function bump(x){ if (x <= 2) return 0; if (x < 47) return 0.38*smooth01((x-2)/45); if (x < 262) return 0.38*(1 - smooth01((x-47)/215)); return 0; }
function headAt(s){
  let h = headBase(s);
  for (let k = Math.max(1, Math.floor((s-270)/BLOCK)); k <= Math.floor(s/BLOCK); k++){
    const f = feature(k);
    if (f && f.type === 'junction' && s > f.J + 2 && s < f.J + 262) h += choiceFor(k)*bump(s - f.J);
  }
  return h;
}
PH.push(headAt(0)); PY.push(hy(0));
function ensure(s){
  const need = Math.ceil(s/DS) + 2;
  while (PX.length <= need){
    const i = PX.length-1, si = i*DS;
    const h1 = headAt(si + DS), hm = (PH[i]+h1)*0.5;
    PX.push(PX[i] + Math.sin(hm)*DS); PZ.push(PZ[i] + Math.cos(hm)*DS); PH.push(h1); PY.push(hy(si+DS));
  }
}
function frame(s, o){
  if (s < 0) s = 0; ensure(s);
  const f = s/DS, i = Math.floor(f), t = f-i;
  o.x = PX[i] + (PX[i+1]-PX[i])*t; o.z = PZ[i] + (PZ[i+1]-PZ[i])*t; o.y = hy(s);
  o.h = PH[i] + (PH[i+1]-PH[i])*t;
  o.fx = Math.sin(o.h); o.fz = Math.cos(o.h); o.rx = -o.fz; o.rz = o.fx;
  return o;
}
frame.grade = dhy;
const curv = s => (headAt(s+0.5) - headAt(s-0.5));
const FA = {}, FB = {}, FC = {};
function pt(s, u, yo, out){ frame(s, FA); return out.set(FA.x + FA.rx*u, FA.y + yo, FA.z + FA.rz*u); }
function ptF(fr, s, u, yo, out){ fr(s, FA); return out.set(FA.x + FA.rx*u, FA.y + yo, FA.z + FA.rz*u); }

// the branch you did not take: its own short street that curves away
const stubCache = new Map();
function stubPath(f){
  if (stubCache.has(f.k)) return stubCache.get(f.k);
  const c = choiceFor(f.k), X = [], Z = [], H = [], Y = [], F0 = frame(f.J, {});
  let x = F0.x, z = F0.z;
  for (let t = 0; t <= 96; t++){
    const h = headAt(f.J + t) - 2*c*bump(t);
    if (t > 0){ const hm = (H[t-1] + h)/2; x += Math.sin(hm); z += Math.cos(hm); }
    X.push(x); Z.push(z); H.push(h); Y.push(hy(f.J + t));
  }
  const fr = (t, o) => {
    t = Math.max(0, Math.min(95.999, t)); const i = Math.floor(t), a = t - i;
    o.x = X[i]+(X[i+1]-X[i])*a; o.z = Z[i]+(Z[i+1]-Z[i])*a; o.y = Y[i]+(Y[i+1]-Y[i])*a; o.h = H[i]+(H[i+1]-H[i])*a;
    o.fx = Math.sin(o.h); o.fz = Math.cos(o.h); o.rx = -o.fz; o.rz = o.fx; return o;
  };
  fr.grade = t => dhy(f.J + t);
  const P = { fr, c }; stubCache.set(f.k, P); return P;
}

function sweep(B, profile, s0, s1, step, O, col, uvs=2, fr=frame){
  const rows = Math.max(1, Math.ceil((s1-s0)/step));
  const pos=[], uv=[], idx=[]; let base=0;
  for (let j=0;j<profile.length-1;j++){
    const a=profile[j], b=profile[j+1], L=Math.hypot(b[0]-a[0], b[1]-a[1]);
    for (let i=0;i<=rows;i++){
      const s = s0 + (s1-s0)*i/rows; fr(s, FB);
      pos.push(FB.x+FB.rx*a[0]-O.x, FB.y+a[1]-O.y, FB.z+FB.rz*a[0]-O.z, FB.x+FB.rx*b[0]-O.x, FB.y+b[1]-O.y, FB.z+FB.rz*b[0]-O.z);
      uv.push(s/uvs, 0, s/uvs, L/uvs);
    }
    for (let i=0;i<rows;i++){ const a0=base+i*2, b0=a0+1, a1=a0+2, b1=a0+3; idx.push(a0,b0,b1, a0,b1,a1); }
    base += (rows+1)*2;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos,3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv,2));
  g.setIndex(idx); g.computeVertexNormals();
  B.add(g, IDENT, col, null); g.dispose();
}
// quads with a known outward direction, so winding never has to be guessed
const _qa = new THREE.Vector3(), _qb = new THREE.Vector3(), _qn = new THREE.Vector3();
function addQuads(B, quads, col){
  if (!quads.length) return;
  const pos = [];
  for (const [a, b, c, d, want] of quads){
    for (const tri of [[a,b,c],[a,c,d]]){
      _qa.subVectors(tri[1], tri[0]); _qb.subVectors(tri[2], tri[0]); _qn.crossVectors(_qa, _qb);
      const t = _qn.dot(want) < 0 ? [tri[0], tri[2], tri[1]] : tri;
      for (const p of t) pos.push(p.x, p.y, p.z);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos,3));
  const uv = new Float32Array(pos.length/3*2); for (let i=0;i<pos.length/3;i++){ uv[i*2] = (pos[i*3] + pos[i*3+2])*0.5; uv[i*2+1] = pos[i*3+1]*0.5; }
  g.setAttribute('uv', new THREE.BufferAttribute(uv,2));
  g.computeVertexNormals(); B.add(g, IDENT, col, null); g.dispose();
}


// ---------- palettes ----------
const WALLS = [['#F6F2EB',5],['#F3EDE3',4],['#EFE5D3',2],['#F0DEC6',1.6],['#EFD5CA',1.2],['#F0E3AE',1.2],['#DDE4E8',0.8]];
const STONE = '#E4DBCC', STONE2 = '#D9CFBE', IRON = '#2A292E', GROUT = '#C8C0B3', STEEL = '#8F8C8A', WIRE = '#34323A';
const SHUTTERS = [['#3F5C49',3],['#7B4A2E',2],['#44597C',1.4],['#2E4A3F',1]];
const DOORS = [['#2F4A3A',3],['#5A3521',2],['#2E3E5C',1.4],['#7A2E26',1]];
const TERRA = ['#C8683F','#BE5D3A','#D07A4A','#B8563A','#D98A57','#C46E48','#CF7244'];
const LEAVES = [['#E8561E',3],['#F07F22',3],['#F4A93A',2],['#D23A26',2],['#C0282F',1],['#F6C54A',1]];
const BLOOM = [['#D6336C',3],['#C2185B',2],['#E8561E',2],['#F07F22',1.2],['#B8124A',1]];
const GLASS = '#39424F';
const SNOW = '#F3F6FA';
const FEST = ['#F2B519','#D6336C','#2A4B98','#5E8C3A','#F07F22','#E8561E','#FBF3F5','#B78AD6'];
const PETAL_PAL = [['#F6C9D6',3],['#F2A7BE',2],['#FBF3F5',2],['#E98AA8',1]];
const SUMMER_LEAF = [['#5E8C3A',3],['#78A548',2],['#8DB456',1]];
const SEASONS = ['Spring','Summer','Autumn','Winter'];
const STOP_NAMES = ['Largo das Laranjeiras','Calçada do Poço','Travessa da Figueira','Rua dos Telhados','Escadinhas do Sol','Largo do Relógio','Beco das Andorinhas','Rua da Lua Cheia','Pátio das Cores','Miradouro do Vento','Largo da Fonte Velha','Rua dos Gatos Pretos','Travessa do Limoeiro','Calçada das Gaivotas'];
// stops never land on a bridge, a viewpoint, an arch or a junction
const stopCache = [];
function stopS(n){
  while (stopCache.length <= n){
    const i = stopCache.length, prev = i ? stopCache[i-1] : -1e9;
    let s = 170 + i*400 + Math.floor(hash1(i+3)*90);
    for (let g = 0; g < 8; g++){
      if (s < prev + 140) s = prev + 140;
      const f = featureAt(s, 14);
      if (!f || f.type === 'festival') break;
      s = f.s1 + 20;
    }
    stopCache.push(s);
  }
  return stopCache[n];
}
const stopName = n => STOP_NAMES[n % STOP_NAMES.length];


// ---------- roof tiles ----------
function roofGeo(W, Ls, rng, coarse, snow){
  const tw = coarse ? 0.5 : 0.32, cl = coarse ? 0.6 : 0.42;
  const nT = Math.max(2, Math.round(W/tw)), nC = Math.max(2, Math.round(Ls/cl));
  const cols = nT*2+1, rows = nC*2;
  const pos=[], col=[], idx=[];
  const tcol = [], sc = C(SNOW);
  for (let t=0;t<nT*nC;t++){
    const c = C(TERRA[(rng()*TERRA.length)|0]), k = 0.9 + rng()*0.18;
    const m = snow ? (rng() < 0.16 ? 0.2 : 0.8 + rng()*0.18) : 0;
    tcol.push([c.r*k + (sc.r - c.r*k)*m, c.g*k + (sc.g - c.g*k)*m, c.b*k + (sc.b - c.b*k)*m]);
  }
  for (let r=0;r<rows;r++){
    const c = r>>1, end = r&1, z = (c+end)*Ls/nC;
    const off = end ? 0.0 : (coarse ? 0.07 : 0.055), shade = end ? 0.62 : 1.0;
    for (let q=0;q<cols;q++){
      const x = -W/2 + q*W/(cols-1), crest = q&1;
      pos.push(x, off + (crest ? (coarse?0.09:0.075) : 0), z);
      const t = Math.min(nT-1, q>>1), tc = tcol[c*nT + t], s2 = snow ? (end ? 0.86 : 1.0)*(crest ? 1.0 : 0.94) : shade * (crest ? 1.0 : 0.82);
      col.push(tc[0]*s2, tc[1]*s2, tc[2]*s2);
    }
  }
  for (let r=0;r<rows-1;r++) for (let q=0;q<cols-1;q++){ const a=r*cols+q, b=a+1, c2=a+cols, d=c2+1; idx.push(a,d,b, a,c2,d); }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos,3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col,3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(pos.length/3*2),2));
  g.setIndex(idx); g.computeVertexNormals(); return g;
}
function roof(ctx, M, w, depth, H, rng, coarse){
  const a = 0.46, over = 0.42;
  const Ls = (depth/2 + over)/Math.cos(a), W = w + 0.3;
  const g = roofGeo(W, Ls, rng, coarse, ctx.snow);
  const y0 = H - 0.22, white = C('#ffffff');
  lgeo(ctx.P, M, g, 0, y0, -over, 1,1,1, white, -a, 0, 0);
  lgeo(ctx.P, M, g, 0, y0, depth+over, 1,1,1, white, -a, PI, 0, 'YXZ');
  g.dispose();
  const ridgeY = y0 + Ls*Math.sin(a);
  lbox(ctx.P, M, 0, ridgeY+0.02, depth/2, W, 0.16, 0.16, ctx.snow ? C(SNOW) : J(TERRA[3], rng, 0.05), PI/4);
  const peak = (depth/2)*Math.tan(a) - 0.1;
  for (const sx of [-1,1]){ _m.compose(_v.set(sx*w/2, H-0.05, 0), _q.identity(), _s.set(1, peak, depth)).premultiply(M); ctx.P.add(GABLE, _m, C(ctx.wall), null); }
  return ridgeY;
}

// ---------- house parts ----------
function pot(ctx, M, x, y, z, rng){
  lgeo(ctx.P, M, POT, x, y+0.12, z, 0.26,0.24,0.26, J('#C0673F', rng, 0.08));
  lgeo(ctx.P, M, ICO, x, y+0.33, z, 0.2,0.17,0.2, J(ctx.season===3 ? '#5C6A4E' : rng()<0.5?'#6E8B3D':'#587A34', rng, 0.1), rng()*3, rng()*3, 0);
  if (ctx.season !== 3 && rng() < 0.7){ const fc = ['#D6334A','#E85A8A','#F2B53A','#F4F0F0'][(rng()*4)|0]; for (let k=0;k<4;k++){ const a=rng()*TAU; lgeo(ctx.P, M, ICO, x+Math.cos(a)*0.13, y+0.4+rng()*0.08, z+Math.sin(a)*0.13, 0.05,0.05,0.05, C(fc)); } }
}
function windowUnit(ctx, M, x, yb, ww, wh, st, rng, upper){
  const P = ctx.P, stone = C(STONE);
  lbox(P, M, x-(ww/2+0.07), yb+wh/2, -0.06, 0.14, wh+0.28, 0.12, stone);
  lbox(P, M, x+(ww/2+0.07), yb+wh/2, -0.06, 0.14, wh+0.28, 0.12, stone);
  lbox(P, M, x, yb+wh+0.07, -0.07, ww+0.28, 0.16, 0.14, stone);
  lbox(P, M, x, yb-0.06, -0.1, ww+0.42, 0.12, 0.2, C(STONE2));
  if (ctx.snow) lbox(P, M, x, yb+0.01, -0.11, ww+0.38, 0.05, 0.17, C(SNOW));
  (rng() < 0.42 ? ctx.GL : ctx.GD).add(UNIT_BOX, _m.compose(_v.set(x, yb+wh/2, -0.01), _q.identity(), _s.set(ww, wh, 0.02)).premultiply(M), J(GLASS, rng, 0.08), null);
  const wf = C('#F4F1EA');
  lbox(P, M, x, yb+wh/2, -0.035, 0.05, wh, 0.03, wf);
  lbox(P, M, x, yb+wh*0.62, -0.035, ww, 0.05, 0.03, wf);
  if (st.shutters){ const sc = C(st.shutter); for (const sx of [-1,1]) lbox(P, M, x+sx*(ww/2+0.16+ww*0.24), yb+wh/2, -0.05, ww*0.46, wh, 0.05, sc); }
  if (upper && rng() < st.balcony){
    const bw = ww + 0.9, iron = C(IRON);
    lbox(P, M, x, yb-0.05, -0.36, bw, 0.1, 0.72, stone);
    if (ctx.snow) lbox(P, M, x, yb+0.02, -0.36, bw-0.06, 0.05, 0.68, C(SNOW));
    lbox(P, M, x, yb+0.95, -0.7, bw, 0.045, 0.045, iron);
    lbox(P, M, x, yb+0.08, -0.7, bw, 0.035, 0.035, iron);
    for (const sx of [-1,1]){ lbox(P, M, x+sx*bw/2, yb+0.95, -0.36, 0.045, 0.045, 0.7, iron); for (let k=1;k<4;k++) lbox(P, M, x+sx*bw/2, yb+0.5, -0.7*k/4, 0.025, 0.9, 0.025, iron); }
    const nb = Math.round(bw/0.14); for (let k=0;k<=nb;k++) lbox(P, M, x-bw/2+k*bw/nb, yb+0.5, -0.7, 0.022, 0.9, 0.022, iron);
    const np = 1 + (rng()*3|0); for (let k=0;k<np;k++) pot(ctx, M, x - bw/2 + 0.3 + rng()*(bw-0.6), yb, -0.45, rng);
    if (st.festive){
      // paper flowers along the railing and streamers hanging from it
      for (let q=0;q<=7;q++) lgeo(P, M, ICO, x - bw/2 + q*bw/7, yb+0.98, -0.72, 0.075,0.075,0.075, C(FEST[(q*3 + (rng()*8|0)) % FEST.length]), rng()*3, rng()*3, 0);
      for (let q=0;q<4;q++) lbox(P, M, x - bw/2 + (q+0.5)*bw/4, yb+0.55, -0.735, 0.06, 0.75, 0.008, C(FEST[(rng()*8)|0]));
    }
  } else if (upper && (st.festive || rng() < 0.35)){
    const px = x + (rng()-0.5)*ww*0.5; pot(ctx, M, px, yb, -0.14, rng);
    if (st.festive) lgeo(P, M, FLAG, px + 0.1, yb + 0.75, -0.16, 0.13, 0.16, 1, C(FEST[(rng()*8)|0]));
  }
}
function door(ctx, M, x, st, rng){
  const P = ctx.P, stone = C(STONE);
  const dw = 1.15, dh = 2.45;
  lbox(P, M, x-(dw/2+0.09), dh/2+0.1, -0.06, 0.18, dh+0.5, 0.12, stone);
  lbox(P, M, x+(dw/2+0.09), dh/2+0.1, -0.06, 0.18, dh+0.5, 0.12, stone);
  lbox(P, M, x, dh+0.42, -0.07, dw+0.36, 0.2, 0.14, stone);
  lbox(P, M, x, dh/2, -0.015, dw, dh, 0.03, C(st.door));
  lbox(P, M, x, dh*0.3, -0.04, dw*0.8, dh*0.36, 0.02, J(st.door, rng, 0.0).multiplyScalar(0.8));
  lbox(P, M, x, dh*0.72, -0.04, dw*0.8, dh*0.36, 0.02, J(st.door, rng, 0.0).multiplyScalar(0.8));
  lbox(P, M, x+dw*0.34, dh*0.5, -0.07, 0.06, 0.06, 0.05, C('#C9A24A'));
  ctx.GD.add(UNIT_BOX, _m.compose(_v.set(x, dh+0.18, -0.01), _q.identity(), _s.set(dw, 0.28, 0.02)).premultiply(M), C(GLASS), null);
  // the floor is level, the street is not: step down to the pavement where it falls away
  const gap = ctx.gapAt ? ctx.gapAt(x) : 0;
  if (gap > 0.06){
    const n = Math.min(4, Math.ceil(gap/0.2)), hs = gap/n, dz = Math.min(0.3, 1.0/n);
    for (let k=0;k<n;k++){ const top = -k*hs, bot = -gap-0.3; lbox(P, M, x, (top+bot)/2, -(k+0.5)*dz, dw+0.6, top-bot, dz, C(STONE2)); }
  } else lbox(P, M, x, 0.02, -0.28, dw+0.6, 0.16, 0.5, C(STONE2));
  if (rng() < 0.55){ const px = x + (rng()<0.5?-1:1)*(dw/2+0.45); pot(ctx, M, px, ctx.gapAt ? -ctx.gapAt(px) : 0, -0.35, rng); }
}
function lamp(ctx, M, x){
  const P = ctx.P, iron = C(IRON);
  lbox(P, M, x, 4.72, -0.46, 0.05, 0.05, 0.92, iron);
  lbox(P, M, x, 4.5, -0.25, 0.04, 0.04, 0.62, iron, -0.62);
  lbox(P, M, x, 4.6, -0.02, 0.16, 0.3, 0.04, iron);
  lbox(P, M, x, 4.62, -0.9, 0.03, 0.14, 0.03, iron);
  lgeo(P, M, CONE4, x, 4.5, -0.9, 0.44, 0.2, 0.44, iron, 0, PI/4, 0);
  lbox(ctx.LP, M, x, 4.24, -0.9, 0.24, 0.36, 0.24, C('#ffffff'));
  for (const [dx,dz] of [[-1,-1],[1,-1],[-1,1],[1,1]]) lbox(P, M, x+dx*0.12, 4.24, -0.9+dz*0.12, 0.025, 0.38, 0.025, iron);
  lbox(P, M, x, 4.04, -0.9, 0.2, 0.05, 0.2, iron);
}

// tapered tube, normals set explicitly
function tube(B, M, pts, r0, r1, col, seg=14, rad=6){
  const curve = new THREE.CatmullRomCurve3(pts);
  const fr = curve.computeFrenetFrames(seg, false);
  const pos=[], nor=[], uv=[], idx=[];
  for (let i=0;i<=seg;i++){
    const p = curve.getPointAt(i/seg), r = r0 + (r1-r0)*(i/seg), N = fr.normals[i], Bn = fr.binormals[i];
    for (let j=0;j<=rad;j++){
      const a = j/rad*TAU, cx = Math.cos(a), sx = Math.sin(a);
      const nx = cx*N.x + sx*Bn.x, ny = cx*N.y + sx*Bn.y, nz = cx*N.z + sx*Bn.z;
      pos.push(p.x+nx*r, p.y+ny*r, p.z+nz*r); nor.push(nx,ny,nz); uv.push(j/rad, i/seg*3);
    }
  }
  for (let i=0;i<seg;i++) for (let j=0;j<rad;j++){ const a=i*(rad+1)+j, b=a+1, c=a+rad+1, d=c+1; idx.push(a,b,c, b,d,c); }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos,3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor,3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv,2));
  g.setIndex(idx); B.add(g, M, col, null); g.dispose();
}
const _lm = new THREE.Matrix4(), _lq = new THREE.Quaternion(), _le = new THREE.Euler(), _lp = new THREE.Vector3(), _ls = new THREE.Vector3();
// every leaf stores a colour pick, a drop threshold and its kind; the shader does the rest
function leaf(ctx, M, x, y, z, size, kind, rng, rx, ry, rz){
  _le.set(rx ?? rng()*TAU, ry ?? rng()*TAU, rz ?? rng()*TAU);
  _lq.setFromEuler(_le);
  _lm.compose(_lp.set(x,y,z), _lq, _ls.set(size,size,size)).premultiply(M);
  ctx.leaves.push(_lm.clone()); ctx.leafData.push(rng(), 0.02 + rng()*0.96, kind);
}
function tree(ctx, M, x, z, rng){
  const bark = J('#6B4A33', rng, 0.08);
  const p0 = new THREE.Vector3(x, -0.4, z), p1 = new THREE.Vector3(x+rr(rng,-0.4,0.4), 1.8, z-0.2);
  const p2 = new THREE.Vector3(x+rr(rng,-0.6,0.6), 3.5, z-0.8), p3 = new THREE.Vector3(x+rr(rng,-0.8,0.8), 5.0, z-1.7);
  tube(ctx.P, M, [p0,p1,p2,p3], 0.3, 0.13, bark, 16, 7);
  const n = 5 + (rng()*2|0);
  for (let k=0;k<n;k++){
    const cx = x + rr(rng,-2.8,2.8), cy = rr(rng,5.2,8.3), cz = Math.max(-2.7, z - 1.8 + rr(rng,-1.5,1.6));
    const R = rr(rng, 1.25, 2.0);
    const from = k%2 ? p2 : p3, tip = new THREE.Vector3(cx, cy-0.4, cz);
    const mid = from.clone().lerp(tip, 0.5).add(new THREE.Vector3(rr(rng,-0.4,0.4), 0.4, rr(rng,-0.3,0.3)));
    tube(ctx.P, M, [from.clone(), mid, tip], 0.11, 0.035, bark, 8, 5);
    // twigs are always there; in winter they are all you see
    for (let t=0;t<4;t++){
      const tp = tip.clone().add(new THREE.Vector3(rr(rng,-1.3,1.3), rr(rng,-0.1,1.1), rr(rng,-0.9,0.9)));
      if (tp.z < -3.0) tp.z = -3.0;
      const tm = tip.clone().lerp(tp, 0.5); tm.y += 0.15;
      tube(ctx.P, M, [tip.clone(), tm, tp], 0.035, 0.012, bark, 5, 4);
    }
    for (let i=0;i<105;i++){
      const u = rng()*2-1, th = rng()*TAU, s = Math.sqrt(1-u*u), rad = R*(0.5 + 0.5*Math.sqrt(rng()));
      const lx = cx + s*Math.cos(th)*rad, ly = cy + u*rad*0.8, lz = cz + s*Math.sin(th)*rad;
      if (ly < 4.6 && lz < -2.3) continue;
      if (lz < -3.3) continue;
      leaf(ctx, M, lx, ly, lz, rr(rng,0.3,0.46), 0, rng);
    }
  }
}
function creeper(ctx, M, x0, H, w, rng){
  const vine = J('#5E4230', rng, 0.1), pts = [];
  let x = x0; for (let y=-0.3; y<=H-0.3; y+=1.1){ pts.push(new THREE.Vector3(x, y, -0.09)); x += rr(rng,-0.35,0.35); }
  if (pts.length < 3) return;
  tube(ctx.P, M, pts, 0.08, 0.04, vine, 18, 5);
  const curve = new THREE.CatmullRomCurve3(pts);
  for (let t=0.15;t<=1;t+=0.012){ const p = curve.getPointAt(t); for (let k=0;k<3;k++) leaf(ctx, M, p.x+rr(rng,-0.45,0.45), p.y+rr(rng,-0.3,0.3), rr(rng,-0.38,-0.1), rr(rng,0.22,0.34), 1, rng, rr(rng,-0.5,0.5), rr(rng,-0.5,0.5)); }
  const top = pts[pts.length-1], span = Math.min(w*0.8, 3.2);
  for (let i=0;i<190;i++){
    const lx = top.x + rr(rng,-span/2,span/2), ly = H - 1.0 + Math.pow(rng(),0.6)*1.8, lz = rr(rng,-0.75,0.3);
    leaf(ctx, M, Math.max(-w/2, Math.min(w/2, lx)), ly, lz, rr(rng,0.24,0.38), 1, rng);
  }
  for (let sIdx=0; sIdx<3; sIdx++){ const sx = top.x + rr(rng,-span/2,span/2), len = rr(rng,1.2,2.6); for (let y=0;y<len;y+=0.14) leaf(ctx, M, sx+Math.sin(y*3)*0.12, H-0.9-y, -0.3+rr(rng,-0.1,0.1), rr(rng,0.2,0.3), 1, rng); }
}
function groundBit(ctx, M, x, y, z, rng){
  leaf(ctx, M, x, y, z, rr(rng,0.26,0.42), 2, rng, -PI/2 + rr(rng,-0.15,0.15), rr(rng,-0.15,0.15), rng()*TAU);
}


function house(ctx, M, w, depth, st, rng){
  const P = ctx.P, gH = 3.4, fH = 3.0, H = gH + (st.floors-1)*fH + 0.75;
  ctx.wall = st.wall;
  const wall = C(st.wall), stone = C(STONE);
  lbox(P, M, 0, (H-22)/2, depth/2, w+0.04, H+22, depth, wall);
  if (st.tiled === 2) lbox(ctx.A[st.az], M, 0, (0.55+H-0.8)/2, -0.012, w-0.7, H-0.8-0.55, 0.024, C('#ffffff'));
  else if (st.tiled === 1) lbox(ctx.A[st.az], M, 0, 1.05, -0.012, w-0.7, 1.0, 0.024, C('#ffffff'));
  for (const sx of [-1,1]) lbox(P, M, sx*(w/2-0.17), (H-6)/2, -0.04, 0.34, H+6, 0.1, stone);
  lbox(P, M, 0, -1.3, -0.05, w, 3.6, 0.12, C(STONE2));
  for (let f=1; f<st.floors; f++) lbox(P, M, 0, gH+(f-1)*fH, -0.05, w, 0.14, 0.12, stone);
  lbox(P, M, 0, H-0.62, -0.1, w+0.08, 0.2, 0.22, stone);
  lbox(P, M, 0, H-0.42, -0.15, w+0.14, 0.12, 0.32, stone);
  const nW = Math.max(1, Math.floor((w-0.8)/2.0)), doorIdx = (rng()*nW)|0;
  for (let f=0; f<st.floors; f++){
    const y0 = f===0 ? 0 : gH + (f-1)*fH;
    for (let i=0;i<nW;i++){
      const x = -w/2 + 0.4 + (i+0.5)*(w-0.8)/nW;
      if (f===0 && i===doorIdx) door(ctx, M, x, st, rng);
      else if (f===0) windowUnit(ctx, M, x, 1.0, 0.95, 1.5, st, rng, false);
      else windowUnit(ctx, M, x, y0+0.55, 0.95, 1.85, st, rng, true);
    }
  }
  if (st.lamp) lamp(ctx, M, -w/2 + 0.55);
  const ridge = roof(ctx, M, w, depth, H, rng, false);
  if (rng() < 0.45){ const cx = rr(rng,-w/3,w/3); lbox(P, M, cx, ridge+0.3, depth*0.62, 0.5, 1.6, 0.5, wall); lbox(P, M, cx, ridge+1.12, depth*0.62, 0.66, 0.1, 0.66, stone); }
  if (st.creeper) creeper(ctx, M, (rng()<0.5?-1:1)*(w/2-0.45), H, w, rng);
}
function backHouse(ctx, M, w, depth, floors, rng){
  const P = ctx.P, H = 3.2 + (floors-1)*3.0 + 0.6, wc = pickW(rng, WALLS), wall = C(wc), stone = C(STONE);
  ctx.wall = wc;
  lbox(P, M, 0, (H-24)/2, depth/2, w+0.04, H+24, depth, wall);
  lbox(P, M, 0, H-0.5, -0.08, w+0.08, 0.2, 0.18, stone);
  const nW = Math.max(1, Math.floor((w-0.6)/2.0));
  for (let f=0; f<floors; f++) for (let i=0;i<nW;i++){
    const x = -w/2 + 0.3 + (i+0.5)*(w-0.6)/nW, y = 1.0 + f*3.0;
    lbox(P, M, x, y+0.85, -0.04, 1.15, 1.95, 0.08, stone);
    (rng()<0.4?ctx.GL:ctx.GD).add(UNIT_BOX, _m.compose(_v.set(x, y+0.85, -0.09), _q.identity(), _s.set(0.9,1.7,0.02)).premultiply(M), J(GLASS, rng, 0.08), null);
  }
  roof(ctx, M, w, depth, H, rng, true);
}

function styleFor(rng){
  const tiledRoll = rng();
  return {
    wall: pickW(rng, WALLS), shutter: pickW(rng, SHUTTERS), door: pickW(rng, DOORS),
    floors: 2 + (rng()*3|0), shutters: rng() < 0.45, balcony: 0.55,
    tiled: tiledRoll < 0.11 ? 2 : tiledRoll < 0.26 ? 1 : 0, az: rng() < 0.7 ? 0 : 1,
    lamp: false, creeper: rng() < 0.16,
  };
}

// ---------- chunks ----------
const CH = 40, CELL = 20, CURB = 3.3, FACADE = 4.5, SW = 0.24, WIRE_H = 6.3;
const LANES = [[-0.195,0.34,1],[0.195,0.34,1]];
for (let i=0;i<6;i++){ const c = 0.53 + 0.235 + i*0.46; LANES.push([c,0.44,i<1?1:0],[-c,0.44,i<1?1:0]); }
const COB_GRAY = ['#A7A29C','#B4AFA8','#9C9892','#ADA7A0'], COB_LIGHT = [['#E4DED4',3],['#D8D1C6',3],['#CFC8BC',2],['#E9E4DB',2],['#C9C1B5',1.5],['#D9C7AE',0.8]];
const ROOFP = (() => {
  const A=[-.5,0,-.5], B=[.5,0,-.5], Cc=[.5,1,0], D=[-.5,1,0], E=[-.5,0,.5], F=[.5,0,.5];
  const tris = [[A,B,Cc],[A,Cc,D],[F,E,D],[F,D,Cc],[A,D,E],[B,F,Cc]], pos = [];
  for (const t of tris){
    const n = new THREE.Vector3().crossVectors(new THREE.Vector3(...t[1]).sub(new THREE.Vector3(...t[0])), new THREE.Vector3(...t[2]).sub(new THREE.Vector3(...t[0])));
    const m = new THREE.Vector3((t[0][0]+t[1][0]+t[2][0])/3, (t[0][1]+t[1][1]+t[2][1])/3 - 0.33, (t[0][2]+t[1][2]+t[2][2])/3);
    const tt = n.dot(m) < 0 ? [t[0],t[2],t[1]] : t; for (const p of tt) pos.push(...p);
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos,3)); g.computeVertexNormals(); return g;
})();

function houseMatrix(sc, side, O, backOff, yOff, fr=frame){
  fr(sc, FC);
  const X = side > 0 ? _v.set(FC.fx,0,FC.fz) : _v.set(-FC.fx,0,-FC.fz);
  const Z = _v2.set(FC.rx*side, 0, FC.rz*side);
  const M = new THREE.Matrix4().makeBasis(X, YAX, Z);
  const u = side*(FACADE + backOff);
  M.setPosition(FC.x + FC.rx*u - O.x, FC.y + SW + yOff - O.y, FC.z + FC.rz*u - O.z);
  return M;
}
// a box standing on the route: size across the street and along it, between two absolute heights
function boxOnRoute(B, O, s, u, yb, yt, su, ss, col, fr=frame){
  fr(s, FB);
  _m2.makeBasis(_v.set(FB.rx,0,FB.rz), YAX, _v2.set(-FB.fx,0,-FB.fz)).scale(_s.set(su, yt-yb, ss));
  _m2.setPosition(FB.x + FB.rx*u - O.x, (yb+yt)/2 - O.y, FB.z + FB.rz*u - O.z);
  B.add(UNIT_BOX, _m2, col, [su, yt-yb, ss]);
}
const P3 = (s, u, yAbs, O, fr=frame) => ptF(fr, s, u, 0, new THREE.Vector3()).setY(yAbs).sub(O);
function prism(B, O, poly, yb, yt, col){
  let cx = 0, cz = 0; for (const p of poly){ cx += p.x; cz += p.z; } cx /= poly.length; cz /= poly.length;
  const V3 = (p, y) => new THREE.Vector3(p.x - O.x, y - O.y, p.z - O.z), q = [];
  for (let i=0;i<poly.length;i++){
    const p = poly[i], n = poly[(i+1)%poly.length];
    q.push([V3(p,yb), V3(n,yb), V3(n,yt), V3(p,yt), new THREE.Vector3((p.x+n.x)/2 - cx, 0, (p.z+n.z)/2 - cz)]);
  }
  q.push([V3(poly[0],yt), V3(poly[1],yt), V3(poly[2],yt), V3(poly[3],yt), YAX]);
  addQuads(B, q, col);
}

function stopSignTexture(name){
  return canvasTex(512, 256, (g,w,h) => {
    g.fillStyle = '#F6F1E2'; g.fillRect(0,0,w,h);
    g.fillStyle = '#F2B519'; g.fillRect(0,0,w,70);
    g.fillStyle = '#24262B'; g.font = '700 50px "Barlow Condensed","Arial Narrow",sans-serif'; g.textBaseline='middle';
    g.fillText('Paragem 31', 26, 38);
    g.font = '600 50px "Barlow Condensed","Arial Narrow",sans-serif';
    const words = name.split(' '); let line='', y=125; const lines=[];
    for (const wd of words){ const t = line ? line+' '+wd : wd; if (g.measureText(t).width > w-52){ lines.push(line); line = wd; } else line = t; }
    lines.push(line); for (const l of lines.slice(0,2)){ g.fillText(l, 26, y); y += 58; }
    g.strokeStyle = '#24262B'; g.lineWidth = 8; g.strokeRect(4,4,w-8,h-8);
  });
}


function streetAlong(ctx, fr, a, b, O){
  sweep(ctx.P, [[-CURB-0.05,0.01],[CURB+0.05,0.01]], a, b, 1, O, C(GROUT), 2, fr);
  sweep(ctx.CA, [[CURB,0.02],[CURB,SW],[FACADE+1.4,SW]], a, b, 1, O, C('#ffffff'), 1.4, fr);
  sweep(ctx.CA, [[-FACADE-1.4,SW],[-CURB,SW],[-CURB,0.02]], a, b, 1, O, C('#ffffff'), 1.4, fr);
  for (const ru of [-0.45, 0.45]) sweep(ctx.RL, [[ru-0.035,0.03],[ru-0.035,0.11],[ru+0.035,0.11],[ru+0.035,0.03]], a, b, 1, O, C(STEEL), 2, fr);
  const t = 0.022; sweep(ctx.RL, [[-t,WIRE_H],[0,WIRE_H+t],[t,WIRE_H],[0,WIRE_H-t],[-t,WIRE_H]], a, b, 1, O, C(WIRE), 2, fr);
}
function cobbles(group, fr, a, b, O, rng){
  const rows = Math.round((b-a)/0.5), cob = new THREE.InstancedMesh(COBBLE_GEO, matCobble, rows*LANES.length), grade = fr.grade || dhy;
  let n = 0;
  for (let r=0; r<rows; r++){
    const sBase = a + 0.25 + r*0.5;
    for (let L=0; L<LANES.length; L++){
      const [u, lw, gray] = LANES[L], s = sBase + ((L>>1)%2 ? 0.125 : 0)*(r%2 ? 1 : -1);
      fr(s, FB);
      _v.set(FB.x + FB.rx*u - O.x, FB.y - 0.03 - O.y, FB.z + FB.rz*u - O.z);
      _e.set(-Math.atan(grade(s)) + (rng()-0.5)*0.05, FB.h + (rng()-0.5)*0.12, (rng()-0.5)*0.05, 'YXZ'); _q.setFromEuler(_e);
      _s.set(lw/0.44*rr(rng,0.9,1.0), rr(rng,0.75,1.2), rr(rng,0.9,1.05));
      _m.compose(_v, _q, _s); cob.setMatrixAt(n, _m);
      cob.setColorAt(n, gray ? J(COB_GRAY[(rng()*COB_GRAY.length)|0], rng, 0.05) : J(pickW(rng, COB_LIGHT), rng, 0.05)); n++;
    }
  }
  cob.count = n; cob.receiveShadow = true; cob.instanceMatrix.needsUpdate = true; cob.instanceColor.needsUpdate = true;
  cob.computeBoundingSphere(); group.add(cob);
}
function spanWire(ctx, O, s, openL, openR, fr=frame, bridge=false){
  const edge = bridge ? 5.4 : FACADE - 0.3, uL = openL ? -edge : -FACADE, uR = openR ? edge : FACADE;
  let prev = null;
  for (let k=0;k<=10;k++){
    const u = uL + k*(uR-uL)/10, nu = 2*k/10 - 1, h = WIRE_H + 0.06 + 0.5*nu*nu;
    const p = ptF(fr, s, u, h, new THREE.Vector3()).sub(O);
    if (prev) segBox(ctx.P, prev, p, 0.024, C(WIRE));
    prev = p;
  }
  for (const [open, u] of [[openL, uL],[openR, uR]]){
    const top = ptF(fr, s, u, WIRE_H+0.56, new THREE.Vector3()).sub(O);
    if (open){ const base = ptF(fr, s, u, SW, new THREE.Vector3()).sub(O); top.y += 0.3; segBox(ctx.P, base, top, 0.12, C(IRON)); }
    else lgeo(ctx.P, IDENT, UNIT_BOX, top.x, top.y, top.z, 0.16, 0.16, 0.16, C(IRON));
  }
}
// which house slots give way to a feature
function skipHouse(side, a, b, back){
  a += 0.01; b -= 0.01;
  for (const f of featuresIn(a - 1, b + 1)){
    if (f.type === 'bridge' && b > f.s0 && a < f.s1) return true;
    if (f.type === 'miradouro' && side === f.side && b > f.s0 && a < f.s1) return true;
  }
  for (const f of featuresIn(a - 120, b + 120)){
    if (f.type !== 'junction' || side !== choiceFor(f.k)) continue;
    if (!back && b > f.J && a < f.J + 80) return true;
    if (back && b > f.J - 20 && a < f.J + 100) return true;
  }
  return false;
}

// festival: paper bunting and strings of bulbs across the street
function garland(ctx, O, s, flags, rng){
  frame(s, FB); const h = FB.h, hTop = flags ? 7.5 : 7.9; let prev = null, fi = (rng()*8)|0;
  for (let k=0;k<=24;k++){
    const u = -FACADE + k*(2*FACADE/24), hh = hTop - 0.6*(1 - (u/FACADE)*(u/FACADE));
    const q = pt(s, u, hh, new THREE.Vector3()).sub(O);
    if (prev) segBox(ctx.P, prev, q, 0.018, C('#5A4A3C'));
    if (k > 0 && k < 24){
      if (flags) lgeo(ctx.P, IDENT, FLAG, q.x, q.y, q.z, 0.34, 0.42, 1, C(FEST[fi++ % FEST.length]), 0, h, 0);
      else if (k % 4 === 2){
        segBox(ctx.P, q, q.clone().add(new THREE.Vector3(0, -0.3, 0)), 0.01, C('#5A4A3C'));
        lgeo(ctx.P, IDENT, ICO, q.x, q.y - 0.5, q.z, 0.15, 0.21, 0.15, C(FEST[(k + fi) % FEST.length]));
        lbox(ctx.P, IDENT, q.x, q.y - 0.3, q.z, 0.12, 0.04, 0.12, C('#5A4A3C'));
      }
      else if (k % 2 === 0) lgeo(ctx.LP, IDENT, ICO, q.x, q.y - 0.1, q.z, 0.07, 0.09, 0.07, C('#ffffff'));
    }
    prev = q;
  }
}
function buildFestival(ctx, f, O, rng){ for (let s = f.s0 + 4, i = 0; s <= f.s1 - 4; s += 8, i++) garland(ctx, O, s, i % 2 === 0, rng); }

// a house built across the street, with the tram passing underneath
function buildArch(ctx, f, O, rng){
  const sa = (f.s0 + f.s1)/2; frame(sa, FB);
  const W = FACADE + 0.4, top = 14.5, hw = 3.4, sp = 7.2, depth = 7;
  // one outline with the archway cut up from the ground, so the opening is always open
  const shape = new THREE.Shape();
  shape.moveTo(-W, 0); shape.lineTo(-hw, 0); shape.lineTo(-hw, sp); shape.absarc(0, sp, hw, PI, 0, true);
  shape.lineTo(hw, 0); shape.lineTo(W, 0); shape.lineTo(W, top); shape.lineTo(-W, top); shape.lineTo(-W, 0);
  const g = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled:false, curveSegments:20 }); g.translate(0, 0, -depth/2);
  const M = new THREE.Matrix4().makeBasis(new THREE.Vector3(FB.rx,0,FB.rz), YAX, new THREE.Vector3(-FB.fx,0,-FB.fz)).setPosition(FB.x - O.x, FB.y - O.y, FB.z - O.z);
  const wall = pickW(rng, WALLS); ctx.wall = wall;
  ctx.P.add(g, M, C(wall), null); g.dispose();
  const stone = C(STONE);
  lbox(ctx.P, M, 0, sp + hw + 0.35, 0, 2*hw + 1.4, 0.3, depth + 0.1, stone);
  lbox(ctx.P, M, 0, top - 0.25, 0, 2*W + 0.2, 0.25, depth + 0.3, stone);
  for (const face of [-1, 1]) for (const wx of [-2.4, 0, 2.4]){
    const z = face*(depth/2 + 0.01);
    lbox(ctx.P, M, wx, 12.9, z, 1.2, 1.9, 0.08, stone);
    (rng() < 0.5 ? ctx.GL : ctx.GD).add(UNIT_BOX, _m.compose(_v.set(wx, 12.9, z + face*0.056), _q.identity(), _s.set(0.9, 1.6, 0.02)).premultiply(M), J(GLASS, rng, 0.08), null);
  }
  for (const face of [-1, 1]){
    lbox(ctx.A[0], M, 0, 11.55, face*(depth/2 + 0.014), 5.2, 0.7, 0.024, C('#ffffff'));
    lbox(ctx.P, M, 0, 11.95, face*(depth/2 + 0.04), 5.5, 0.1, 0.08, stone);
    pot(ctx, M, -1.6, 11.99, face*(depth/2 + 0.2), rng); pot(ctx, M, 1.6, 11.99, face*(depth/2 + 0.2), rng);
  }
  const M2 = M.clone().multiply(new THREE.Matrix4().makeTranslation(0, 0, -depth/2));
  roof(ctx, M2, 2*W, depth, top + 0.1, rng, false);
  lbox(ctx.P, M, 0, sp + hw - 0.35, 0, 0.03, 0.7, 0.03, C(IRON));
  lbox(ctx.LP, M, 0, sp + hw - 0.9, 0, 0.26, 0.36, 0.26, C('#ffffff'));
}

// miradouro: a terrace with a view over a lower town to the river
function buildMiradouro(ctx, f, O, rng){
  const m = f.side, a = f.s0, b = f.s1, mid = (a+b)/2, yMid = hy(mid);
  const pIn = FACADE + 1.4, pOut = FACADE + 7.2, pw0 = pOut - 0.45;
  sweep(ctx.CA, m>0 ? [[pIn,SW],[pOut,SW]] : [[-pOut,SW],[-pIn,SW]], a, b, 1, O, C('#ffffff'), 1.4);
  sweep(ctx.P, m>0 ? [[pw0,SW],[pw0,SW+1.0],[pOut,SW+1.0],[pOut,SW]] : [[-pOut,SW],[-pOut,SW+1.0],[-pw0,SW+1.0],[-pw0,SW]], a, b, 1, O, C(STONE));
  sweep(ctx.A[0], m>0 ? [[pw0-0.01,SW+0.1],[pw0-0.01,SW+0.9]] : [[-pw0+0.01,SW+0.9],[-pw0+0.01,SW+0.1]], a+0.3, b-0.3, 1, O, C('#ffffff'), 0.55);
  ctx.gapAt = null;
  for (let i=0;i<3;i++){
    const M = houseMatrix(a + 8 + i*12, m, O, 0, 0);
    lbox(ctx.P, M, 0, 0.44, 4.8, 1.9, 0.1, 0.5, C(STONE));
    for (const lx of [-0.75, 0.75]) lbox(ctx.P, M, lx, 0.2, 4.8, 0.14, 0.42, 0.42, C(STONE2));
    lbox(ctx.P, M, 0, 0.78, 4.52, 1.9, 0.55, 0.07, C('#7B4A2E'));
  }
  for (const ls of [a + 14, a + 26]){
    const M = houseMatrix(ls, m, O, 0, 0);
    lbox(ctx.P, M, 0, 1.8, 3.2, 0.1, 3.6, 0.1, C(IRON));
    lbox(ctx.LP, M, 0, 3.75, 3.2, 0.26, 0.36, 0.26, C('#ffffff'));
    lgeo(ctx.P, M, CONE4, 0, 4.03, 3.2, 0.44, 0.2, 0.44, C(IRON), 0, PI/4, 0);
  }
  tree(ctx, houseMatrix(a + 20, m, O, 0, 0), 0, 3.4, rng);

  // the hillside falling away from the parapet
  const yBot = yMid - 24, hill = [];
  for (let s = a - 60; s < b + 60; s += 4){
    hill.push([pt(s, m*pOut, SW-0.02, new THREE.Vector3()).sub(O), pt(s+4, m*pOut, SW-0.02, new THREE.Vector3()).sub(O),
               P3(s+4, m*(FACADE+36), yBot, O), P3(s, m*(FACADE+36), yBot, O), YAX]);
  }
  addQuads(ctx.P, hill, J('#B7A88E', rng, 0.02));

  // the lower town: small houses stepping down toward the water
  const guard = []; for (let s = a - 260; s <= b + 260; s += 6){ frame(s, FB); guard.push(FB.x, FB.z); }
  for (let s = mid - 120; s <= mid + 120; s += rr(rng, 7, 10)){
    for (let d = 40; d < 190; d += rr(rng, 8, 11)){
      pt(s, m*d, 0, _v);
      let ok = true; for (let g = 0; g < guard.length; g += 2){ const dx = guard[g]-_v.x, dz = guard[g+1]-_v.z; if (dx*dx + dz*dz < 676){ ok = false; break; } }
      if (!ok) continue;
      const y = yBot - (d-40)*0.1, w = rr(rng,5.5,8), dep = rr(rng,6,8.5);
      const M = houseMatrix(s, m, O, d - FACADE, y - hy(s) - SW);
      M.multiply(new THREE.Matrix4().makeRotationY(rr(rng,-0.15,0.15)));
      townHouse(ctx, M, w, dep, 2 + (rng()*3|0), rng);
    }
  }
  const farOK = (x, z) => { for (let g = 0; g < guard.length; g += 2){ const dx = guard[g]-x, dz = guard[g+1]-z; if (dx*dx + dz*dz < 900) return false; } return true; };
  for (let i=0;i<16;i++){
    const s = mid + rr(rng,-110,110), d = rr(rng,45,165); pt(s, m*d, 0, _v); if (!farOK(_v.x, _v.z)) continue;
    const b0 = _v.clone().setY(yBot - (d-40)*0.1 - 0.5).sub(O), lean = new THREE.Vector3(rr(rng,-1.2,1.2), 0, rr(rng,-1.2,1.2));
    const b1 = b0.clone().add(new THREE.Vector3(0, rr(rng,4,5.5), 0)).addScaledVector(lean, 0.5), b2 = b0.clone().add(new THREE.Vector3(0, rr(rng,8,10), 0)).add(lean);
    tube(ctx.LC, IDENT, [b0, b1, b2], 0.32, 0.16, C('#5E4636'), 8, 5);
    for (let k=0;k<3;k++) lgeo(ctx.LC, IDENT, ICO, b2.x+rr(rng,-1.6,1.6), b2.y+rr(rng,0,1.2), b2.z+rr(rng,-1.6,1.6), rr(rng,2.4,3.4), rr(rng,0.9,1.3), rr(rng,2.4,3.4), J('#4E6B3A', rng, 0.12), 0, rng()*TAU, 0);
  }
  {
    const s = mid + rr(rng,-40,40), d = rr(rng,75,110); pt(s, m*d, 0, _v);
    if (farOK(_v.x, _v.z)){
      const M = houseMatrix(s, m, O, d - FACADE, yBot - (d-40)*0.1 - hy(s) - SW), P = ctx.LC, wc = C('#F4EFE6'), st = C(STONE), dk = C('#3A3F4A');
      lbox(P, M, 0, 6, 2.5, 5, 22, 5, wc);
      for (const yy of [6, 11, 16.8]) lbox(P, M, 0, yy, 2.5, 5.3, 0.3, 5.3, st);
      lbox(P, M, 0, 18.6, 2.5, 4.4, 3.4, 4.4, wc);
      lbox(P, M, 0, 18.4, 2.5-2.23, 1.3, 2.2, 0.04, dk); lbox(P, M, 0, 18.4, 2.5+2.23, 1.3, 2.2, 0.04, dk);
      lbox(P, M, 2.23, 18.4, 2.5, 0.04, 2.2, 1.3, dk); lbox(P, M, -2.23, 18.4, 2.5, 0.04, 2.2, 1.3, dk);
      lbox(P, M, 0, 20.4, 2.5, 4.8, 0.25, 4.8, st);
      lgeo(P, M, DOME, 0, 20.5, 2.5, 2.2, 2.3, 2.2, wc);
      lbox(P, M, 0, 23.3, 2.5, 0.12, 1.4, 0.12, C(IRON)); lbox(P, M, 0, 23.5, 2.5, 0.7, 0.12, 0.12, C(IRON));
      const lp = new THREE.Vector3(0, 18.4, 0.2).applyMatrix4(M); ctx.lights.push(lp.x, lp.y, lp.z);
    }
  }
  frame(mid, FB);
  const R = new THREE.Vector3(FB.rx*m, 0, FB.rz*m), F = new THREE.Vector3(FB.fx, 0, FB.fz), C0 = new THREE.Vector3(FB.x - O.x, 0, FB.z - O.z);
  const Pp = (d, al, y) => C0.clone().addScaledVector(R, d).addScaledVector(F, al).setY(y - O.y);
  addQuads(ctx.LC, [[Pp(34,-170,yBot), Pp(34,170,yBot), Pp(200,170,yBot-16), Pp(200,-170,yBot-16), YAX]], C('#C9B79A'));
  const W0 = yBot - 17;
  addQuads(ctx.W, [[Pp(196,-700,W0), Pp(196,700,W0), Pp(520,700,W0), Pp(520,-700,W0), YAX]], C('#6E92B6'));
  addQuads(ctx.W, [[Pp(520,-900,W0), Pp(520,900,W0), Pp(1200,900,W0), Pp(1200,-900,W0), YAX]], C('#93AECA'));
  for (let i=0;i<9;i++){
    const p = Pp(rr(rng,230,520), rr(rng,-260,260), W0), rot = rng()*TAU;
    lbox(ctx.LC, IDENT, p.x, p.y + 0.25, p.z, 2.6, 0.5, 1.0, C('#4A3A32'), 0, rot, 0);
    lgeo(ctx.LC, IDENT, FLAG, p.x, p.y + 0.5, p.z, 1.6, 2.4, 1, C('#FBF8F2'), 0, rot, PI);
  }
}

// a small house for the lower town, built with the same details as the main street
const DOME = new THREE.SphereGeometry(1, 18, 8, 0, TAU, 0, PI/2);
function townHouse(ctx, M, w, dep, floors, rng){
  const T = { P:ctx.LC, wall:pickW(rng, WALLS) }, P = ctx.LC, H = 3.1 + (floors-1)*2.9 + 0.6;
  const wall = C(T.wall), stone = C(STONE), dark = C('#3E4652');
  lbox(P, M, 0, (H-10)/2, dep/2, w+0.04, H+10, dep, wall);
  lbox(P, M, 0, H-0.45, -0.07, w+0.1, 0.18, 0.16, stone);
  for (const sx of [-1,1]) lbox(P, M, sx*(w/2-0.15), H/2 - 2, -0.03, 0.3, H+4, 0.08, stone);
  const nW = Math.max(1, Math.floor((w-0.6)/2.0)), sh = rng() < 0.45 ? C(pickW(rng, SHUTTERS)) : null, door = rng()*nW|0;
  for (let f=0; f<floors; f++) for (let i=0;i<nW;i++){
    const x = -w/2 + 0.3 + (i+0.5)*(w-0.6)/nW, yb = f === 0 ? 0.9 : 3.1 + (f-1)*2.9 + 0.5;
    if (f === 0 && i === door){ lbox(P, M, x, 1.15, -0.04, 1.3, 2.4, 0.08, stone); lbox(P, M, x, 1.05, -0.09, 1.0, 2.1, 0.03, C(pickW(rng, DOORS))); continue; }
    const wh = f === 0 ? 1.3 : 1.6;
    lbox(P, M, x, yb + wh/2, -0.04, 1.1, wh + 0.26, 0.08, stone);
    lbox(P, M, x, yb + wh/2, -0.095, 0.82, wh, 0.02, dark);
    if (sh) for (const sx of [-1,1]) lbox(P, M, x + sx*0.66, yb + wh/2, -0.07, 0.38, wh, 0.06, sh);
    if (f > 0 && rng() < 0.3){
      lbox(P, M, x, yb - 0.04, -0.34, 1.5, 0.08, 0.6, stone);
      lbox(P, M, x, yb + 0.8, -0.62, 1.5, 0.04, 0.04, C(IRON));
      for (const sx of [-1,1]) lbox(P, M, x + sx*0.74, yb + 0.4, -0.62, 0.03, 0.8, 0.03, C(IRON));
      lgeo(P, M, ICO, x + rr(rng,-0.4,0.4), yb + 0.25, -0.4, 0.2, 0.17, 0.2, J('#6E8B3D', rng, 0.1));
    }
    if (rng() < 0.5){ const lp = new THREE.Vector3(x, yb + wh/2, -0.14).applyMatrix4(M); ctx.lights.push(lp.x, lp.y, lp.z); }
  }
  roof(T, M, w, dep, H, rng, true);
}

// viaduct: the street crosses a valley with its own street, houses and tram below
function buildBridge(ctx, f, O, rng, group, chunk){
  const a = f.s0, b = f.s1, mid = (a+b)/2;
  let ymin = 1e9; for (let s = a-14; s <= b+14; s += 2) ymin = Math.min(ymin, hy(s));
  const floorY = ymin - 16;
  sweep(ctx.P, [[5.9,SW],[5.9,-1.4],[-5.9,-1.4],[-5.9,SW]], a-1, b+1, 1, O, C(STONE2));
  sweep(ctx.P, [[5.5,SW],[5.5,SW+1.05],[5.9,SW+1.05],[5.9,SW]], a, b, 1, O, C(STONE));
  sweep(ctx.P, [[-5.9,SW],[-5.9,SW+1.05],[-5.5,SW+1.05],[-5.5,SW]], a, b, 1, O, C(STONE));
  for (const ps of [mid-27, mid-13.5, mid+13.5, mid+27]) boxOnRoute(ctx.P, O, ps, 0, floorY - 1, hy(ps) - 1.3, 12.6, 2.6, J(STONE2, rng, 0.03));
  const q = [];
  for (const [sa, sb] of [[mid-25.7, mid-14.8], [mid-12.2, mid+12.2], [mid+14.8, mid+25.7]]){
    const half = (sb - sa)/2, sm = (sa + sb)/2, rise = Math.min(half*0.85, (hy(sm) - 1.4 - floorY)*0.45), spring = hy(sm) - 1.9 - rise;
    const soff = s => spring + rise*Math.sqrt(Math.max(0, 1 - ((s - sm)/half)**2)), N = 14;
    for (let i=0;i<N;i++){
      const s0 = sa + (sb-sa)*i/N, s1 = sa + (sb-sa)*(i+1)/N; frame(s0, FB);
      for (const sd of [1,-1]){
        const u = sd*5.9;
        q.push([P3(s0,u,soff(s0),O), P3(s1,u,soff(s1),O), P3(s1,u,hy(s1)-1.4,O), P3(s0,u,hy(s0)-1.4,O), new THREE.Vector3(FB.rx*sd, 0, FB.rz*sd)]);
      }
      q.push([P3(s0,-5.9,soff(s0),O), P3(s0,5.9,soff(s0),O), P3(s1,5.9,soff(s1),O), P3(s1,-5.9,soff(s1),O), new THREE.Vector3(0,-1,0)]);
    }
  }
  addQuads(ctx.P, q, C(STONE2));
  boxOnRoute(ctx.P, O, a - 1.3, 0, floorY - 1, hy(a) - 0.05, 130, 3, C(STONE2));
  boxOnRoute(ctx.P, O, b + 1.3, 0, floorY - 1, hy(b) - 0.05, 130, 3, C(STONE2));
  const vf = [];
  for (let s = a; s < b; s += 6) vf.push([P3(s,-65,floorY,O), P3(s,65,floorY,O), P3(s+6,65,floorY,O), P3(s+6,-65,floorY,O), YAX]);
  addQuads(ctx.P, vf, C('#CDBFA3'));
  // the lower street, crossing under the bridge
  frame(mid, FB);
  const R = new THREE.Vector3(FB.rx, 0, FB.rz), F = new THREE.Vector3(FB.fx, 0, FB.fz), C0 = new THREE.Vector3(FB.x - O.x, floorY + 0.03 - O.y, FB.z - O.z);
  const Lp = (L, al, dy=0) => C0.clone().addScaledVector(R, L).addScaledVector(F, al).add(new THREE.Vector3(0, dy, 0));
  addQuads(ctx.CA, [[Lp(-64,-3.4), Lp(64,-3.4), Lp(64,3.4), Lp(-64,3.4), YAX]], C('#ffffff'));
  for (const off of [-0.45, 0.45]) segBox(ctx.RL, Lp(-64, off, 0.08), Lp(64, off, 0.08), 0.07, C(STEEL));
  ctx.gapAt = null;
  for (const qd of [1, -1]){
    for (let L = -62; L < 62; ){
      const w = rr(rng, 5.5, 8), Lc = L + w/2; L += w;
      if (Math.abs(Lc) < 7 + w/2) continue;
      const Z = F.clone().multiplyScalar(qd), X = qd > 0 ? R.clone().negate() : R.clone();
      const pos = Lp(Lc, qd*3.4, 0.07);
      const M = new THREE.Matrix4().makeBasis(X, YAX, Z).setPosition(pos.x, pos.y, pos.z);
      if (Math.abs(Lc) < 36){ const st = styleFor(rng); st.floors = Math.min(st.floors, 3); house(ctx, M, w, 7, st, rng); }
      else backHouse(ctx, M, w, 7, 2 + (rng()*3|0), rng);
    }
  }
  const lt = tram.clone(true);
  lt.traverse(o => { if (o.isPointLight) o.visible = false; });
  const pi = tram.children.indexOf(tramParts.pole), si = tram.children.indexOf(tramParts.shoe);
  if (pi >= 0) lt.children[pi].visible = false; if (si >= 0) lt.children[si].visible = false;
  group.add(lt);
  chunk.lower = { obj:lt, C0:C0.clone().add(new THREE.Vector3(0, 0.08, 0)), R, ph:rng()*TAU };
}

// junction: the other branch curves away past its own houses and a wedge shaped corner building
function buildJunction(ctx, f, O, rng, group){
  const S = stubPath(f), fr = S.fr, c = S.c;
  streetAlong(ctx, fr, 0, 86, O);
  cobbles(group, fr, 0, 86, O, rng);
  // the corner building starts once the branch's near facade has crossed clear of the main street's facade
  let tf = 70;
  for (let t = 6; t < 76; t++){
    const B = ptF(fr, t, -c*FACADE, 0, new THREE.Vector3()); frame(f.J + t, FB);
    if (c*((B.x - FB.x)*FB.rx + (B.z - FB.z)*FB.rz) > FACADE + 1.5){ tf = t; break; }
  }
  for (const t of [22, 40, 58, 76]) if (t >= tf + 2) spanWire(ctx, O, t, false, false, fr);
  // houses on the far side of the branch
  for (let t = 3; t < 80; ){
    let w = rr(rng, 5.5, 8.2); if (t + w > 80) w = 80 - t; if (w < 4) break;
    const tc = t + w/2, base = Math.max(hy(f.J+t), hy(f.J+tc), hy(f.J+t+w)), lift0 = base - hy(f.J+tc);
    ctx.gapAt = x => base - hy(f.J + tc + x*c);
    const st = styleFor(rng); st.lamp = rng() < 0.3;
    house(ctx, houseMatrix(tc, c, O, 0, lift0, fr), w, 8, st, rng);
    backHouse(ctx, houseMatrix(tc, c, O, 8.6, lift0 + rr(rng, 1, 4), fr), w, 8, 2 + (rng()*3|0), rng);
    t += w;
  }
  ctx.gapAt = null;
  // the corner building filling the wedge between the two streets
  const segs = 8, wall = pickW(rng, WALLS);
  for (let i=0;i<segs;i++){
    const ta = tf + (80-tf)*i/segs, tb = tf + (80-tf)*(i+1)/segs;
    const A0 = pt(f.J+ta, c*FACADE, 0, new THREE.Vector3()), A1 = pt(f.J+tb, c*FACADE, 0, new THREE.Vector3());
    const B1 = ptF(fr, tb, -c*FACADE, 0, new THREE.Vector3()), B0 = ptF(fr, ta, -c*FACADE, 0, new THREE.Vector3());
    const base = Math.max(A0.y, A1.y, B0.y, B1.y) + SW, top = base + 12.4 + (i%3)*0.7;
    prism(ctx.P, O, [A0, A1, B1, B0], base - 24, top, C(wall));
    prism(ctx.P, O, [A0, A1, B1, B0], top - 0.05, top + 0.25, C(STONE));
    for (let t = ta + 1.3; t < tb - 1; t += 2.6) for (let y = 1.1; y < 11; y += 3.1){
      for (const [M, side] of [[houseMatrix(f.J + t, c, O, 0, base - hy(f.J+t) - SW), c], [houseMatrix(t, -c, O, 0, base - hy(f.J+t) - SW, fr), -c]]){
        lbox(ctx.P, M, 0, y + 0.85, -0.03, 1.15, 1.95, 0.06, C(STONE));
        (rng() < 0.45 ? ctx.GL : ctx.GD).add(UNIT_BOX, _m.compose(_v.set(0, y + 0.85, -0.07), _q.identity(), _s.set(0.9, 1.7, 0.02)).premultiply(M), J(GLASS, rng, 0.08), null);
      }
    }
  }
  // a house across the end of the branch closes the view
  fr(84, FB);
  const Mend = new THREE.Matrix4().makeBasis(new THREE.Vector3(-FB.rx,0,-FB.rz), YAX, new THREE.Vector3(FB.fx,0,FB.fz)).setPosition(FB.x - O.x, FB.y + SW - O.y, FB.z - O.z);
  house(ctx, Mend, 15, 8, styleFor(rng), rng);
}

// a generator so a chunk can be built a few milliseconds at a time across frames
function* buildChunk(ci){
  const s0 = ci*CH, s1 = s0 + CH, rng = mulberry32(ci*9973 + 17);
  const O = pt(s0, 0, 0, new THREE.Vector3());
  const ctx = { P:new Builder(), A:[new Builder(0.55), new Builder(0.55)], GL:new Builder(), GD:new Builder(), LP:new Builder(), CA:new Builder(), RL:new Builder(), LC:new Builder(), W:new Builder(), leaves:[], leafData:[], lights:[], wall:'#fff', gapAt:null };
  const group = new THREE.Group(); group.position.copy(O);
  const extras = [], chunk = { group, extras, lower:null };

  streetAlong(ctx, frame, s0, s1, O);
  yield;
  const feats = featuresIn(s0 - 1, s1 + 1);
  for (let s = Math.ceil(s0/18)*18; s < s1; s += 18){
    let openL = false, openR = false, bridge = false, skip = false;
    for (const f of feats){
      if (f.type === 'bridge' && s >= f.s0 - 1 && s <= f.s1 + 1){ openL = openR = bridge = true; }
      if (f.type === 'miradouro' && s >= f.s0 && s <= f.s1){ if (f.side > 0) openR = true; else openL = true; }
      if (f.type === 'arch' && Math.abs(s - (f.s0 + f.s1)/2) < 8) skip = true;
      if (f.type === 'junction' && s >= f.J - 1 && s <= f.J + 45) skip = true;
    }
    if (!skip) spanWire(ctx, O, s, openL, openR, frame, bridge);
  }
  cobbles(group, frame, s0, s1, O, rng);
  yield;

  // houses in 20 m cells, deterministic per cell and side
  for (const side of [1,-1]){
    for (let cell = s0/CELL; cell < s1/CELL; cell++){
      const cr = mulberry32(cell*7919 + (side>0?101:202));
      const splits = cr() < 0.35 ? 4 : 3;
      const ws = []; let rem = CELL;
      for (let k=0;k<splits-1;k++){ const avg = rem/(splits-k); const w = Math.max(4.2, Math.min(rem-4.2*(splits-k-1), avg*rr(cr,0.8,1.2))); ws.push(w); rem -= w; }
      ws.push(rem);
      let s = cell*CELL;
      for (let k = 0; k < ws.length; k++){
        const w = ws[k], sc = s + w/2, roll = cr();
        if (skipHouse(side, s, s + w, false)){ s += w; continue; }
        const nearArch = feats.some(f => f.type === 'arch' && s < f.s1 + 1.5 && s + w > f.s0 - 1.5);
        const festive = feats.some(f => f.type === 'festival' && s < f.s1 && s + w > f.s0);
        // sit the house on the highest point of the pavement along its front, never below it
        const base = Math.max(hy(sc - w/2), hy(sc), hy(sc + w/2)), lift0 = base - hy(sc);
        ctx.gapAt = x => base - hy(sc + x*side);
        const M = houseMatrix(sc, side, O, 0, lift0);
        if (roll < 0.13 && w > 4.8 && !nearArch){
          const wc = pickW(cr, WALLS); ctx.wall = wc;
          lbox(ctx.P, M, 0, -1.2, 0.15, w+0.04, 6.0, 0.3, C(wc));
          lbox(ctx.P, M, 0, 1.85, 0.15, w+0.1, 0.12, 0.4, C(STONE));
          lbox(ctx.P, M, 0, -0.6, 4, w, 1.4, 7.7, J('#B9A58A', cr, 0.05));
          tree(ctx, M, rr(cr,-w/4,w/4), 2.2, cr);
          for (let i=0;i<46;i++){
            const sb2 = sc + rr(cr,-w/2-2,w/2+2), ub = side*rr(cr,0.6,FACADE-0.1), walk = Math.abs(ub) > CURB;
            pt(sb2, ub, walk ? SW+0.012 : 0.1, _v2).sub(O);
            groundBit(ctx, IDENT, _v2.x, _v2.y, _v2.z, cr);
          }
        } else if (roll < 0.2 && !nearArch){
          const st = styleFor(cr); st.creeper = false; st.balcony = 0.3; st.festive = festive;
          ctx.gapAt = null; house(ctx, houseMatrix(sc, side, O, 6, 0.4 + lift0), Math.max(3.2, w-1.2), 6, st, cr);
          lbox(ctx.P, M, 0, -1.5, 3, w, 3.2, 6, J('#CFC4B4', cr, 0.03));
        } else {
          const st = styleFor(cr);
          st.lamp = ((cell + (side>0?0:1)) % 2 === 0) && k === 0;
          st.festive = festive;
          if (nearArch){ st.balcony = 0; st.lamp = false; st.creeper = false; st.shutters = false; }
          house(ctx, M, w, 8, st, cr);
        }
        s += w;
        yield;
      }
      let sb = cell*CELL + rr(cr,-1.5,1.5);
      while (sb < (cell+1)*CELL){
        const w = rr(cr, 5.5, 8.5), scb = sb + w/2;
        const lift = (side > 0 ? rr(cr,3.5,6.5) : rr(cr,-1,2.5)) + Math.max(hy(scb - w/2), hy(scb + w/2)) - hy(scb);
        const fl = 2 + (cr()*3|0);
        if (!skipHouse(side, sb, sb + w, true)) backHouse(ctx, houseMatrix(scb, side, O, 8.6, lift), w, 8, fl, cr);
        sb += w;
      }
      yield;
    }
  }
  ctx.gapAt = null;

  for (let i=0;i<110;i++){
    const s = rr(rng, s0, s1), u = rr(rng, -FACADE+0.2, FACADE-0.2), y = Math.abs(u) > CURB ? SW+0.012 : 0.1;
    pt(s, u, y, _v2).sub(O);
    groundBit(ctx, IDENT, _v2.x, _v2.y, _v2.z, rng);
  }

  for (let n = 0; ; n++){
    const ss = stopS(n); if (ss >= s1) break; if (ss < s0) continue;
    sweep(ctx.P, [[CURB-0.006,0.03],[CURB-0.006,SW+0.006],[CURB+0.24,SW+0.006]], ss-4.5, ss+4.5, 1, O, C('#F2B519'));
    const base = pt(ss+3, CURB+0.45, SW, new THREE.Vector3()).sub(O);
    const top = base.clone().add(new THREE.Vector3(0, 2.9, 0));
    segBox(ctx.P, base, top, 0.08, C('#3A3940'));
    const tex = stopSignTexture(stopName(n)); extras.push(tex);
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(1.0, 0.5), new THREE.MeshStandardMaterial({ map:tex, side:THREE.DoubleSide, roughness:0.6 }));
    frame(ss+3, FB); sign.position.copy(top).add(new THREE.Vector3(FB.rx*-0.45, -0.35, FB.rz*-0.45));
    sign.rotation.y = FB.h; sign.castShadow = true; group.add(sign); extras.push(sign.geometry, sign.material);
    const armA = top.clone().add(new THREE.Vector3(0,-0.12,0)), armB = armA.clone().add(new THREE.Vector3(FB.rx*-0.9, 0, FB.rz*-0.9));
    segBox(ctx.P, armA, armB, 0.05, C('#3A3940'));
  }

  // features anchored in this chunk
  for (const f of featuresIn(s0 - 200, s1 + 200)){
    const anchor = f.type === 'junction' ? f.J : f.s0;
    if (anchor < s0 || anchor >= s1) continue;
    if (f.type === 'festival') buildFestival(ctx, f, O, rng);
    else if (f.type === 'arch') buildArch(ctx, f, O, rng);
    else if (f.type === 'miradouro') buildMiradouro(ctx, f, O, rng);
    else if (f.type === 'bridge') buildBridge(ctx, f, O, rng, group, chunk);
    else if (f.type === 'junction') buildJunction(ctx, f, O, rng, group);
    yield;
  }

  const add = m => { if (m) group.add(m); };
  add(ctx.P.mesh(matPlaster));
  add(ctx.A[0].mesh(matAz[0], false)); add(ctx.A[1].mesh(matAz[1], false));
  add(ctx.GL.mesh(matGlassLit, false)); add(ctx.GD.mesh(matGlassDark, false));
  add(ctx.LP.mesh(matLamp, false, false));
  add(ctx.CA.mesh(matCalc, false));
  add(ctx.RL.mesh(matSteel, false));
  add(ctx.LC.mesh(matCity, false, false));
  add(ctx.W.mesh(matWater, false, false));
  const nl = ctx.leaves.length;
  if (nl){
    const lg = new THREE.PlaneGeometry(1,1);
    lg.setAttribute('aLeaf', new THREE.InstancedBufferAttribute(new Float32Array(ctx.leafData), 3));
    const lm = new THREE.InstancedMesh(lg, matLeaf, nl);
    for (let i=0;i<nl;i++) lm.setMatrixAt(i, ctx.leaves[i]);
    lm.customDepthMaterial = matLeafDepth;
    lm.castShadow = true; lm.receiveShadow = true; lm.computeBoundingSphere(); group.add(lm);
  }
  if (ctx.lights.length){
    const pg = new THREE.BufferGeometry(); pg.setAttribute('position', new THREE.Float32BufferAttribute(ctx.lights, 3));
    const pts = new THREE.Points(pg, matCityLights); pts.frustumCulled = false; group.add(pts);
  }
  return chunk;
}
function disposeChunk(c){
  scene.remove(c.group);
  if (c.lower) c.group.remove(c.lower.obj);
  c.group.traverse(o => { if ((o.isMesh || o.isPoints) && o.geometry !== COBBLE_GEO && o.geometry !== LEAF_GEO) o.geometry.dispose(); if (o.isInstancedMesh) o.dispose(); });
  for (const e of c.extras) e.dispose();
}
const chunks = new Map();
// chunks ahead are built within a per-frame time budget, then their shaders compile off the main thread before they appear
const BUILD_MS = 4;
let job = null;
function finishChunk(i, c, sync){
  chunks.set(i, c);
  if (sync){ scene.add(c.group); return; }
  c.pending = true;
  renderer.compileAsync(c.group, camera, scene).catch(() => {}).then(() => { if (c.pending){ c.pending = false; scene.add(c.group); } });
}
function updateChunks(s, all){
  const i0 = Math.floor((s-45)/CH), i1 = Math.floor((s+170)/CH);
  if (job && (job.i < i0-1 || job.i > i1+1)) job = null;
  for (let i=Math.max(0,i0); i<=i1; i++){
    if (chunks.has(i) || (job && job.i === i)) continue;
    // the chunk under the tram can't wait: build it now
    if (all || i <= Math.floor(s/CH) + 1){ const g = buildChunk(i); let r; do r = g.next(); while (!r.done); finishChunk(i, r.value, true); }
    else if (!job) job = { i, g:buildChunk(i) };
  }
  if (job && !all){
    const t0 = performance.now();
    let r;
    do r = job.g.next(); while (!r.done && performance.now() - t0 < BUILD_MS);
    if (r.done){ finishChunk(job.i, r.value, false); job = null; }
  }
  for (const [i,c] of chunks) if (i < i0-1 || i > i1+1){ c.pending = false; disposeChunk(c); chunks.delete(i); }
}


// ---------- the tram ----------
function rrShape(hl, hw, r){
  const s = new THREE.Shape(), a = hw-r, b = hl-r;
  s.moveTo(-a, -hl); s.lineTo(a, -hl); s.absarc(a, -b, r, -PI/2, 0, false); s.lineTo(hw, b);
  s.absarc(a, b, r, 0, PI/2, false); s.lineTo(-a, hl); s.absarc(-a, b, r, PI/2, PI, false); s.lineTo(-hw, -b);
  s.absarc(-a, -b, r, PI, PI*1.5, false); return s;
}
function rrExtrude(hl, hw, r, h, y){
  const g = new THREE.ExtrudeGeometry(rrShape(hl,hw,r), { depth:h, bevelEnabled:false, curveSegments:14 });
  g.rotateX(-PI/2); g.translate(0, y, 0); return g;
}
function rrPerimeter(hl, hw, r, N){
  const a = hw-r, b = hl-r, segs = [
    {L:[-a,-hl,a,-hl]}, {A:[a,-b,-PI/2]}, {L:[hw,-b,hw,b]}, {A:[a,b,0]},
    {L:[a,hl,-a,hl]}, {A:[-a,b,PI/2]}, {L:[-hw,b,-hw,-b]}, {A:[-a,-b,PI]} ];
  for (const sg of segs) sg.len = sg.L ? Math.hypot(sg.L[2]-sg.L[0], sg.L[3]-sg.L[1]) : r*PI/2;
  const tot = segs.reduce((q,sg)=>q+sg.len,0), out = [];
  for (let k=0;k<N;k++){
    let d = (k+0.5)/N*tot;
    for (const sg of segs){
      if (d > sg.len){ d -= sg.len; continue; }
      if (sg.L){ const [x0,y0,x1,y1] = sg.L, t = d/sg.len; out.push({x:x0+(x1-x0)*t, y:y0+(y1-y0)*t, tx:(x1-x0)/sg.len, ty:(y1-y0)/sg.len}); }
      else { const [cx,cy,a0] = sg.A, th = a0 + d/r; out.push({x:cx+r*Math.cos(th), y:cy+r*Math.sin(th), tx:-Math.sin(th), ty:Math.cos(th)}); }
      break;
    }
  }
  return out;
}
let boardName = 'Miradouro', redrawBoard = () => {};
function boardTexture(){
  const c = document.createElement('canvas'); c.width = 512; c.height = 128;
  const draw = () => {
    const g = c.getContext('2d');
    g.fillStyle = '#1E1F23'; g.fillRect(0,0,512,128);
    g.fillStyle = '#F6F1E2'; g.textBaseline = 'middle';
    const txt = boardName.toUpperCase(); let fs = 84; g.font = `700 ${fs}px "Barlow Condensed","Arial Narrow",sans-serif`;
    while (g.measureText(txt).width > 360 && fs > 44){ fs -= 4; g.font = `700 ${fs}px "Barlow Condensed","Arial Narrow",sans-serif`; }
    g.fillText(txt, 24, 68);
    g.fillStyle = '#F2B519'; g.fillRect(398, 14, 100, 100);
    g.fillStyle = '#1E1F23'; g.font = '700 80px "Barlow Condensed","Arial Narrow",sans-serif'; g.textAlign = 'center'; g.fillText('31', 448, 68); g.textAlign = 'left';
  };
  draw();
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = maxAniso;
  redrawBoard = () => { draw(); t.needsUpdate = true; };
  if (document.fonts) document.fonts.ready.then(redrawBoard);
  return t;
}

const tram = new THREE.Group();
const tramParts = {};
(function buildTram(){
  const hidden = new THREE.MeshBasicMaterial({ visible:false });
  const yellow = new THREE.MeshStandardMaterial({ color:'#F2B519', roughness:0.45, metalness:0.05, side:THREE.DoubleSide });
  const cream = new THREE.MeshStandardMaterial({ color:'#F4EEDC', roughness:0.5 });
  const dark = new THREE.MeshStandardMaterial({ color:'#3E4146', roughness:0.7 });
  const brown = new THREE.MeshStandardMaterial({ color:'#5E2C1B', roughness:0.6 });
  const steel = new THREE.MeshStandardMaterial({ color:'#55565A', roughness:0.4, metalness:0.6 });
  const wood = new THREE.MeshStandardMaterial({ color:'#8A5A33', roughness:0.7 });
  const glass = new THREE.MeshStandardMaterial({ color:'#A8BCC7', roughness:0.08, metalness:0.1, transparent:true, opacity:0.42, emissive:'#000000', depthWrite:false });
  const light = new THREE.MeshStandardMaterial({ color:'#FFF6DE', emissive:'#FFE7B0', emissiveIntensity:0.6 });
  const red = new THREE.MeshStandardMaterial({ color:'#B3261E', emissive:'#6A0C08', emissiveIntensity:0.6 });
  tramParts.glass = glass; tramParts.light = light;
  const add = (g, m, cast=true) => { const me = new THREE.Mesh(g, m); me.castShadow = cast; me.receiveShadow = true; tram.add(me); return me; };
  const HL = 4.2, HW = 1.15, R = 0.95;
  add(rrExtrude(HL-0.1, HW-0.07, R-0.07, 0.3, 0.3), brown);
  add(rrExtrude(HL, HW, R, 1.05, 0.6), [hidden, yellow]);
  add(rrExtrude(HL+0.03, HW+0.03, R+0.02, 0.08, 1.6), cream);
  add(rrExtrude(HL-0.02, HW-0.02, R-0.02, 0.97, 1.68), [hidden, glass], false);
  add(rrExtrude(HL, HW, R, 0.3, 2.64), cream);
  add(rrExtrude(HL+0.07, HW+0.05, R+0.03, 0.1, 2.93), dark);
  add(rrExtrude(3.2, 0.7, 0.6, 0.2, 3.02), dark);
  const pil = new THREE.BoxGeometry(0.11, 0.97, 0.06);
  for (const p of rrPerimeter(HL, HW, R, 24)){
    const me = add(pil, yellow); me.position.set(p.x + p.ty*0.015, 2.165, -(p.y - p.tx*0.015)); me.rotation.y = Math.atan2(p.ty, p.tx);
  }
  const boardTex = boardTexture();
  const boardMat = new THREE.MeshBasicMaterial({ map:boardTex });
  for (const dir of [1,-1]){
    const bx = add(new THREE.BoxGeometry(1.3, 0.34, 0.12), dark); bx.position.set(0, 3.26, dir*3.72);
    const pl = add(new THREE.PlaneGeometry(1.24, 0.3), boardMat, false); pl.position.set(0, 3.26, dir*3.785); if (dir<0) pl.rotation.y = PI;
    const bump = add(new THREE.BoxGeometry(1.5, 0.2, 0.22), brown); bump.position.set(0, 0.48, dir*4.12);
    const hlm = add(new THREE.CylinderGeometry(0.13, 0.13, 0.08, 16), dir>0 ? light : red, false); hlm.rotation.x = PI/2; hlm.position.set(0, 1.12, dir*4.215);
    const truck = add(new THREE.BoxGeometry(1.25, 0.35, 2.0), steel); truck.position.set(0, 0.36, dir*2.6);
  }
  const wheelGeo = new THREE.CylinderGeometry(0.33, 0.33, 0.09, 14); wheelGeo.rotateZ(PI/2);
  tramParts.wheels = [];
  for (const z of [-3.3,-1.9,1.9,3.3]) for (const x of [-0.47,0.47]){ const w = add(wheelGeo, steel, false); w.position.set(x, 0.33, z); tramParts.wheels.push(w); }
  // interior
  const floor = add(new THREE.BoxGeometry(1.9, 0.05, 7.4), wood, false); floor.position.y = 0.95;
  const seat = new THREE.BoxGeometry(0.78, 0.08, 0.45), back = new THREE.BoxGeometry(0.78, 0.55, 0.07);
  for (let z=-2.7; z<=2.2; z+=0.9) for (const x of [-0.56,0.56]){
    const a = add(seat, wood, false); a.position.set(x, 1.38, z);
    const b = add(back, wood, false); b.position.set(x, 1.66, z-0.2);
  }
  const skin = new THREE.MeshStandardMaterial({ color:'#E0B592', roughness:0.8 });
  const coats = ['#3A4A6B','#7A3B2E','#4F6B45','#6B5B7A','#C9A24A'].map(c => new THREE.MeshStandardMaterial({ color:c, roughness:0.85 }));
  const body = new THREE.CylinderGeometry(0.17, 0.21, 0.6, 10), head = new THREE.SphereGeometry(0.13, 12, 10);
  const people = [[-0.42, 3.3, 0], [-0.56, -1.8, 1], [0.56, 0.9, 2], [-0.56, 1.8, 3], [0.56, -0.9, 4]];
  for (const [x, z, ci] of people){
    const b = add(body, coats[ci], false); b.position.set(x, z===3.3 ? 1.9 : 1.7, z);
    const h = add(head, skin, false); h.position.set(x, z===3.3 ? 2.33 : 2.13, z);
  }
  // trolley pole, aimed at the wire every frame
  const poleBase = add(new THREE.BoxGeometry(0.34, 0.14, 0.5), dark); poleBase.position.set(0, 3.18, -1.4);
  const poleGeo = new THREE.CylinderGeometry(0.03, 0.035, 1, 8); poleGeo.translate(0, 0.5, 0);
  tramParts.pole = add(poleGeo, new THREE.MeshStandardMaterial({ color:'#2B2A2E', roughness:0.5 }));
  tramParts.pole.position.set(0, 3.25, -1.4);
  tramParts.shoe = add(new THREE.BoxGeometry(0.08, 0.08, 0.22), steel, false);
  tramParts.lamp = new THREE.PointLight('#FFC27A', 0, 9, 1.6); tramParts.lamp.position.set(0, 2.3, 0); tram.add(tramParts.lamp);
})();
scene.add(tram);

// ---------- falling things: leaves, petals, snow, rain ----------
const frng = mulberry32(4242);
const texPetal = canvasTex(64, 64, (g) => {
  g.clearRect(0,0,64,64); g.fillStyle = '#ffffff';
  g.beginPath(); g.moveTo(32,5); g.bezierCurveTo(58,14,54,46,32,59); g.bezierCurveTo(10,46,6,14,32,5); g.fill();
  g.fillStyle = 'rgba(210,150,170,0.45)'; g.beginPath(); g.ellipse(32,52,5,6,0,0,TAU); g.fill();
});
texPetal.wrapS = texPetal.wrapT = THREE.ClampToEdgeWrapping;
const matPetal = new THREE.MeshStandardMaterial({ map:texPetal, alphaTest:0.4, side:THREE.DoubleSide, roughness:0.7 });
function makeFall(mat, N, a, b, va, vb){
  const mesh = new THREE.InstancedMesh(LEAF_GEO, mat, N);
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage); mesh.frustumCulled = false; mesh.castShadow = false;
  const items = [];
  for (let i=0;i<N;i++){
    items.push({ p:new THREE.Vector3(), g:0, v:rr(frng,va,vb), ph:frng()*TAU, sp:rr(frng,1.2,3.2), rot:new THREE.Euler(frng()*TAU, frng()*TAU, 0), sz:rr(frng,a,b) });
    mesh.setColorAt(i, C('#ffffff'));
  }
  mesh.count = 0; scene.add(mesh);
  return { mesh, items, N, dirty:false };
}
const LEAF_FALL = makeFall(matLeafFall, reduceMotion ? 50 : 170, 0.3, 0.44, 0.55, 1.05);
const PETAL_FALL = makeFall(matPetal, reduceMotion ? 60 : 260, 0.1, 0.17, 0.3, 0.65);
function respawn(F, L, i, first, pal){
  const s = sTram + rr(frng, -8, 48), u = rr(frng, -FACADE+0.3, FACADE-0.3);
  pt(s, u, 0, L.p); L.g = L.p.y + 0.1; L.p.y += first ? rr(frng, 0.5, 11) : rr(frng, 7, 12);
  F.mesh.setColorAt(i, J(pickW(frng, pal), frng, 0.08)); F.dirty = true;
}
function stepFall(F, active, dt, wind, palFn){
  active = Math.min(F.N, active); F.mesh.count = active;
  for (let i=0;i<active;i++){
    const L = F.items[i];
    if (L.g === 0) respawn(F, L, i, true, palFn());
    L.p.y -= L.v*dt;
    L.p.x += (Math.sin(time*L.sp + L.ph)*0.8 + wind*1.6)*dt;
    L.p.z += Math.cos(time*L.sp*0.8 + L.ph)*0.6*dt;
    L.rot.x += dt*L.sp*(0.9 + wind); L.rot.y += dt*L.sp*0.6;
    if (L.p.y < L.g || L.p.distanceToSquared(tram.position) > 4900) respawn(F, L, i, false, palFn());
    _q.setFromEuler(L.rot); _m.compose(L.p, _q, _s.setScalar(L.sz)); F.mesh.setMatrixAt(i, _m);
  }
  F.mesh.instanceMatrix.needsUpdate = true;
  if (F.dirty && F.mesh.instanceColor){ F.mesh.instanceColor.needsUpdate = true; F.dirty = false; }
}
const SB = 26, SY = 30;
const wrapTo = (x, c, lo, span) => c + lo + ((((x - c - lo) % span) + span) % span);
const texDot = canvasTex(64, 64, (g) => {
  const gr = g.createRadialGradient(32,32,0,32,32,30);
  gr.addColorStop(0,'rgba(255,255,255,1)'); gr.addColorStop(0.45,'rgba(255,255,255,0.85)'); gr.addColorStop(1,'rgba(255,255,255,0)');
  g.fillStyle = gr; g.fillRect(0,0,64,64);
});
const SNOW_N = reduceMotion ? 400 : 1600;
const snowPos = new Float32Array(SNOW_N*3), snowVel = new Float32Array(SNOW_N);
for (let i=0;i<SNOW_N;i++){ snowPos[i*3] = rr(frng,-SB,SB); snowPos[i*3+1] = rr(frng,-8,22); snowPos[i*3+2] = rr(frng,-SB,SB); snowVel[i] = rr(frng,0.8,1.5); }
const snowGeo = new THREE.BufferGeometry(), snowAttr = new THREE.BufferAttribute(snowPos, 3);
snowAttr.setUsage(THREE.DynamicDrawUsage); snowGeo.setAttribute('position', snowAttr);
const snowMat = new THREE.PointsMaterial({ map:texDot, size:0.14, transparent:true, depthWrite:false, sizeAttenuation:true, color:'#ffffff' });
const snow = new THREE.Points(snowGeo, snowMat); snow.frustumCulled = false; scene.add(snow);
function stepSnow(dt, wind, active){
  snowGeo.setDrawRange(0, active);
  if (!active) return;
  const c = camera.position;
  for (let i=0;i<active;i++){
    const k = i*3;
    snowPos[k+1] -= snowVel[i]*dt;
    snowPos[k] += (Math.sin(time*0.8 + i)*0.35 + wind*1.2)*dt;
    snowPos[k+2] += Math.cos(time*0.6 + i*1.3)*0.3*dt;
    snowPos[k] = wrapTo(snowPos[k], c.x, -SB, 2*SB); snowPos[k+2] = wrapTo(snowPos[k+2], c.z, -SB, 2*SB); snowPos[k+1] = wrapTo(snowPos[k+1], c.y, -8, SY);
  }
  snowAttr.needsUpdate = true;
}
const RAIN_N = reduceMotion ? 500 : 1800;
const rainPos = new Float32Array(RAIN_N*6), rainVel = new Float32Array(RAIN_N);
for (let i=0;i<RAIN_N;i++){ rainPos[i*6] = rr(frng,-SB,SB); rainPos[i*6+1] = rr(frng,-8,22); rainPos[i*6+2] = rr(frng,-SB,SB); rainVel[i] = rr(frng,13,18); }
const rainGeo = new THREE.BufferGeometry(), rainAttr = new THREE.BufferAttribute(rainPos, 3);
rainAttr.setUsage(THREE.DynamicDrawUsage); rainGeo.setAttribute('position', rainAttr);
const rainMat = new THREE.LineBasicMaterial({ color:'#AEB8C8', transparent:true, opacity:0.5, depthWrite:false });
const rain = new THREE.LineSegments(rainGeo, rainMat); rain.frustumCulled = false; scene.add(rain);
function stepRain(dt, wind, active){
  rainGeo.setDrawRange(0, active*2);
  if (!active) return;
  const c = camera.position, sx = wind*2.2;
  for (let i=0;i<active;i++){
    const k = i*6;
    let x = rainPos[k] + sx*dt, y = rainPos[k+1] - rainVel[i]*dt, z = rainPos[k+2];
    x = wrapTo(x, c.x, -SB, 2*SB); z = wrapTo(z, c.z, -SB, 2*SB); y = wrapTo(y, c.y, -8, SY);
    rainPos[k] = x; rainPos[k+1] = y; rainPos[k+2] = z;
    rainPos[k+3] = x - sx*0.035; rainPos[k+4] = y + 0.55; rainPos[k+5] = z;
  }
  rainAttr.needsUpdate = true;
}

// ---------- night sky ----------
const STAR_N = 900, starPos = new Float32Array(STAR_N*3);
for (let i=0;i<STAR_N;i++){ const u = rr(frng,0.08,1), th = frng()*TAU, r = Math.sqrt(1-u*u); starPos[i*3] = Math.cos(th)*r*280; starPos[i*3+1] = u*280; starPos[i*3+2] = Math.sin(th)*r*280; }
const starGeo = new THREE.BufferGeometry(); starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
const starMat = new THREE.PointsMaterial({ color:'#FFFFFF', size:1.6, sizeAttenuation:false, transparent:true, opacity:0, fog:false, depthWrite:false });
const stars = new THREE.Points(starGeo, starMat); stars.frustumCulled = false; scene.add(stars);
const moonTex = canvasTex(128, 128, (g) => {
  const gr = g.createRadialGradient(64,64,10,64,64,64); gr.addColorStop(0,'rgba(255,248,225,0.55)'); gr.addColorStop(1,'rgba(255,248,225,0)');
  g.fillStyle = gr; g.fillRect(0,0,128,128);
  g.fillStyle = '#FBF4DE'; g.beginPath(); g.arc(64,64,22,0,TAU); g.fill();
  g.fillStyle = 'rgba(190,180,160,0.45)'; for (const [x,y,r] of [[57,58,5],[70,70,4],[66,54,3],[58,72,3]]){ g.beginPath(); g.arc(x,y,r,0,TAU); g.fill(); }
});
const moonMat = new THREE.SpriteMaterial({ map:moonTex, transparent:true, opacity:0, fog:false, depthWrite:false });
const moon = new THREE.Sprite(moonMat); moon.scale.set(30,30,1); scene.add(moon);
const MOON_DIR = new THREE.Vector3(0.35, 0.42, 0.84).normalize();

// ---------- birds ----------
const birds = [];
const birdMat = new THREE.MeshBasicMaterial({ color:'#3A3540', side:THREE.DoubleSide, fog:false });
const wingGeo = (() => { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute([0,0,0.12, 0,0,-0.1, 0.62,0.02,-0.05],3)); g.computeVertexNormals(); return g; })();
for (let i=0;i<4;i++){
  const b = new THREE.Group(); const l = new THREE.Mesh(wingGeo, birdMat), r = new THREE.Mesh(wingGeo, birdMat); r.scale.x = -1;
  b.add(l, r); b.userData = { l, r, ph:i*1.7, off:new THREE.Vector3((i-1.5)*3.2, (i%2)*1.6, i*2.1) }; birds.push(b); scene.add(b);
}

// ---------- sound ----------
let ac = null, master, rollGain, rollFilter, motorOsc, motorGain, squealGain, rainGain, windGain, windFilter, noiseBuf, soundOn = false;
function initAudio(){
  if (ac) return;
  const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
  ac = new AC(); master = ac.createGain(); master.gain.value = 0.9; master.connect(ac.destination);
  noiseBuf = ac.createBuffer(1, ac.sampleRate*2, ac.sampleRate);
  const whiteBuf = ac.createBuffer(1, ac.sampleRate*2, ac.sampleRate);
  const d = noiseBuf.getChannelData(0), wd = whiteBuf.getChannelData(0); let last = 0;
  for (let i=0;i<d.length;i++){ const w = Math.random()*2-1; last = (last + 0.02*w)/1.02; d[i] = last*3.5; wd[i] = Math.random()*2-1; }
  const loop = (buf) => { const s = ac.createBufferSource(); s.buffer = buf; s.loop = true; s.start(); return s; };
  rollFilter = ac.createBiquadFilter(); rollFilter.type = 'lowpass'; rollFilter.frequency.value = 320;
  rollGain = ac.createGain(); rollGain.gain.value = 0;
  loop(noiseBuf).connect(rollFilter).connect(rollGain).connect(master);
  motorOsc = ac.createOscillator(); motorOsc.type = 'sawtooth'; motorOsc.frequency.value = 60;
  const mf = ac.createBiquadFilter(); mf.type = 'lowpass'; mf.frequency.value = 380;
  motorGain = ac.createGain(); motorGain.gain.value = 0;
  motorOsc.connect(mf).connect(motorGain).connect(master); motorOsc.start();
  const sq = ac.createOscillator(); sq.frequency.value = 2870; const sq2 = ac.createOscillator(); sq2.frequency.value = 3410;
  squealGain = ac.createGain(); squealGain.gain.value = 0;
  sq.connect(squealGain); sq2.connect(squealGain); squealGain.connect(master); sq.start(); sq2.start();
  const rh = ac.createBiquadFilter(); rh.type = 'highpass'; rh.frequency.value = 900;
  const rl = ac.createBiquadFilter(); rl.type = 'lowpass'; rl.frequency.value = 5500;
  rainGain = ac.createGain(); rainGain.gain.value = 0;
  loop(whiteBuf).connect(rh).connect(rl).connect(rainGain).connect(master);
  windFilter = ac.createBiquadFilter(); windFilter.type = 'bandpass'; windFilter.frequency.value = 420; windFilter.Q.value = 0.6;
  windGain = ac.createGain(); windGain.gain.value = 0;
  loop(whiteBuf).connect(windFilter).connect(windGain).connect(master);
}
function strike(t){
  for (const [ratio, amp] of [[1,1],[2.02,0.45],[2.76,0.38],[4.07,0.2],[5.43,0.12]]){
    const o = ac.createOscillator(), g = ac.createGain(); o.type = 'sine'; o.frequency.value = 1180*ratio;
    const dur = 1.7/Math.sqrt(ratio);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.16*amp, t+0.004); g.gain.exponentialRampToValueAtTime(0.0001, t+dur);
    o.connect(g).connect(master); o.start(t); o.stop(t+dur+0.05);
  }
}
function ringBell(){ if (!ac || !soundOn) return; const t = ac.currentTime + 0.01; strike(t); strike(t + 0.22); }
function clack(t, level){
  if (!ac || !soundOn) return;
  const src = ac.createBufferSource(); src.buffer = noiseBuf; const f = ac.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 1300; f.Q.value = 1.3;
  const g = ac.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(level, t+0.003); g.gain.exponentialRampToValueAtTime(0.0001, t+0.07);
  src.connect(f).connect(g).connect(master); src.start(t, Math.random()*1.5, 0.1);
}

// ---------- time of day ----------
// phase, name, sky, hemi sky, hemi ground, hemi power, sun colour, sun power, sun elevation, sun azimuth, street lamps, lit windows, exposure
const TOD = [
  [0.00,'Dawn',     '#E9D8DE','#D8C6E2','#CDB6A6',0.95,'#FFB48A',1.3, 10, 110,0.55,0.5, 1.05],
  [0.12,'Morning',  '#EEF1F4','#E2EAF6','#E6D6C4',1.35,'#FFF1DE',2.4, 32,  80,0.0, 0.05,1.02],
  [0.30,'Noon',     '#F1F2F6','#E8EEF8','#EDE0CE',1.55,'#FFFFFF',2.9, 64,  20,0.0, 0.0, 1.0],
  [0.48,'Afternoon','#F2F0F4','#E4EAF7','#EBD6C0',1.45,'#FFF0D6',2.7, 44, -54,0.0, 0.0, 1.02],
  [0.64,'Evening',  '#F2DFCB','#EACBB9','#D9B89D',1.05,'#FF9C5C',2.0, 13, -95,0.35,0.35,1.05],
  [0.74,'Dusk',     '#6E6184','#8E86B8','#5E4E58',0.75,'#FF8466',0.55, 3,-110,1.0, 0.9, 1.1],
  [0.84,'Night',    '#262634','#6470A0','#342E38',0.68,'#B4C4EE',0.5, 52,  40,1.0, 1.0, 1.25],
  [0.94,'Night',    '#262634','#6470A0','#342E38',0.68,'#B4C4EE',0.5, 52,  70,1.0, 1.0, 1.25],
  [1.00,'Dawn',     '#E9D8DE','#D8C6E2','#CDB6A6',0.95,'#FFB48A',1.3, 10, 110,0.55,0.5, 1.05],
].map(r => [r[0], r[1], new THREE.Color(r[2]), new THREE.Color(r[3]), new THREE.Color(r[4]), r[5], new THREE.Color(r[6]), r[7], r[8], r[9], r[10], r[11], r[12]]);
const TOD_PRESETS = [[0.03,'dawn'],[0.18,'morning'],[0.33,'noon'],[0.5,'afternoon'],[0.66,'evening'],[0.755,'dusk'],[0.88,'night']];
let phase = 0.5, timeOverride = -1, lampLevel = 0;
function todName(p){ p = ((p % 1) + 1) % 1; let n = TOD[0][1]; for (const k of TOD) if (p >= k[0]) n = k[1]; return n; }

// ---------- seasons: one clock for the whole city ----------
const SEASON_LEN = 900;
const CANOPY = [0.9, 1.0, 0.85, 0.04], VINES = [0.9, 1.0, 0.95, 0.22], GROUND = [0.35, 0.2, 1.0, 0.0];
let seasonClock = 2.3, seasonOverride = -1, seasonTarget = 0;
const _sw = [0,0,0,0], SS = { a:2, b:3, t:0 };
function seasonState(){
  const i = Math.floor(seasonClock), f = seasonClock - i;
  SS.t = smooth01((f - 0.76)/0.24); SS.a = ((i % 4) + 4) % 4; SS.b = (SS.a + 1) % 4;
  _sw.fill(0); _sw[SS.a] += 1 - SS.t; _sw[SS.b] += SS.t;
  U.uSeasonA.value = SS.a; U.uSeasonB.value = SS.b; U.uSeasonMix.value = SS.t;
  let c = 0, v2 = 0, g = 0; for (let k=0;k<4;k++){ c += CANOPY[k]*_sw[k]; v2 += VINES[k]*_sw[k]; g += GROUND[k]*_sw[k]; }
  U.uAmt.value.set(c, v2, g);
  U.uSnow.value = _sw[3];
  return SS;
}

// ---------- weather and wind ----------
const WEATHERS = ['clear','fog','rain'], WBLOCK = 700;
let weatherOverride = -1, fogAmt = 0, rainAmt = 0, wetAmt = 0;
function weatherPlan(i){ if (i < 1) return 'clear'; const r = hash1(i*5.17 + 9.1); return r < 0.5 ? 'clear' : r < 0.73 ? 'fog' : 'rain'; }
let wind = 0.3, gust = 0, gustT = 8, gustLeft = 0, gustLen = 1, gustAmp = 0;
function stepWind(dt){
  gustT -= dt;
  if (gustT <= 0 && gustLeft <= 0){ gustLen = gustLeft = rr(frng, 2.5, 4.5); gustAmp = rr(frng, 0.5, 1.0); gustT = rr(frng, 7, 16); }
  if (gustLeft > 0){ gustLeft -= dt; gust = gustAmp*Math.sin(PI*(1 - Math.max(0, gustLeft)/gustLen)); } else gust = 0;
  wind = 0.25 + 0.12*Math.sin(time*0.21) + gust + 0.35*rainAmt;
  U.uWind.value = wind;
}

// ---------- lighting ----------
const SEASON_SKY = ['#F7E9F0','#F6EFD9','#F4E8DC','#E2EAF5'].map(c => new THREE.Color(c));
const SEASON_SUN = ['#FFE6EE','#FFF0C8','#FFE2C0','#DDE7FF'].map(c => new THREE.Color(c));
const _tint = new THREE.Color(), _tint2 = new THREE.Color();
const OVERCAST = new THREE.Color('#A7AEB9'), FOGC = new THREE.Color('#E6E5EA'), NIGHT_SNOW = new THREE.Color('#8E95B4'), WHITE = new THREE.Color('#ffffff');
function applyLighting(){
  const p = ((phase % 1) + 1) % 1;
  let i = 0; while (i < TOD.length-2 && p >= TOD[i+1][0]) i++;
  const A = TOD[i], B = TOD[i+1], t = (p - A[0])/(B[0] - A[0]), L = (a,b) => a + (b-a)*t;
  const w = _sw, lamps = L(A[10], B[10]), win = L(A[11], B[11]), day = 1 - lamps;
  _tint.setRGB(0,0,0); _tint2.setRGB(0,0,0);
  for (let k=0;k<4;k++){ _tint.r += SEASON_SKY[k].r*w[k]; _tint.g += SEASON_SKY[k].g*w[k]; _tint.b += SEASON_SKY[k].b*w[k]; _tint2.r += SEASON_SUN[k].r*w[k]; _tint2.g += SEASON_SUN[k].g*w[k]; _tint2.b += SEASON_SUN[k].b*w[k]; }
  scene.background.copy(A[2]).lerp(B[2], t).lerp(_tint, 0.55*day).lerp(OVERCAST, 0.42*rainAmt*day).lerp(FOGC, 0.38*fogAmt*day);
  scene.fog.color.copy(scene.background);
  const fk = 1 - 0.25*w[3] + 0.08*w[1];
  scene.fog.near = (30 - 6*lamps)*fk*(1 - 0.72*fogAmt - 0.25*rainAmt);
  scene.fog.far = (120 - 15*lamps)*fk*(1 - 0.6*fogAmt - 0.3*rainAmt);
  hemi.color.copy(A[3]).lerp(B[3], t).lerp(_tint, 0.3*day); hemi.groundColor.copy(A[4]).lerp(B[4], t);
  hemi.intensity = L(A[5], B[5])*(1 - 0.12*rainAmt);
  sun.color.copy(A[6]).lerp(B[6], t).lerp(_tint2, 0.45*day);
  sun.intensity = L(A[7], B[7]) * (1 + 0.14*w[1] - 0.12*w[3]) * Math.max(0.12, 1 - 0.72*rainAmt - 0.5*fogAmt);
  const el = L(A[8], B[8])*PI/180, az = L(A[9], B[9])*PI/180;
  SUN_DIR.set(Math.cos(el)*Math.sin(az), Math.sin(el), Math.cos(el)*Math.cos(az));
  renderer.toneMappingExposure = L(A[12], B[12]);
  matLamp.emissiveIntensity = 0.45 + lamps*2.8;
  matGlassLit.emissive.setRGB(1, 0.62, 0.3); matGlassLit.emissiveIntensity = win*1.1;
  tramParts.glass.emissive.setRGB(1, 0.66, 0.36); tramParts.glass.emissiveIntensity = win*0.55;
  tramParts.light.emissiveIntensity = 0.6 + lamps*2.4;
  tramParts.lamp.intensity = lamps*7;
  snowMat.color.copy(WHITE).lerp(NIGHT_SNOW, lamps*0.8);
  rainMat.color.copy(WHITE).lerp(NIGHT_SNOW, 0.3 + lamps*0.5);
  for (const b of birds) b.visible = lamps < 0.6 && rainAmt < 0.5;
  const clearSky = (1 - 0.9*fogAmt)*(1 - 0.9*rainAmt);
  starMat.opacity = Math.max(0, (lamps - 0.3)/0.7)*clearSky;
  moonMat.opacity = lamps*clearSky;
  matCityLights.opacity = Math.min(1, win*1.2);
  U.uHaze.value.copy(scene.background).convertLinearToSRGB();
  U.uHazeNear.value = 140*(1 - 0.6*fogAmt); U.uHazeFar.value = 760*(1 - 0.65*fogAmt - 0.3*rainAmt);
  lampLevel = lamps;
}


// ---------- state ----------
const AUTO_V = 50/3.6, AUTO_ACC = 1.4, AUTO_DEC = 1.6, MAXF = 70/3.6, MAXR = -12/3.6, BRAKE = 3.2, LOCK_AHEAD = 260;
const DIAL_MAX = 80;
let v = 0, sTram = 34, odo = 0, dwell = 0, nStop = 0, served = 0, lastJoint = 0, prevV = 0, brakeHold = 0;
let driveState = 'Parked', autopilot = false, braking = false, time = 0;
while (stopS(nStop) < sTram + 1) nStop++;
const input = { go:false, brake:false, left:false, right:false };
// every view is placed in route coordinates, so the camera always stays over the street
const VIEW_DEF = {
  ahead:  { ds:16,  u:-1.0, h:5.0,  lds:0,  lu:0, lh:1.8 },
  behind: { ds:-14, u:0,    h:7.6,  lds:14, lu:0, lh:1.2 },
  cab:    { ds:2.3, u:-0.34,h:2.53, lds:24, lu:0, lh:2.3 },
  above:  { ds:-18, u:0,    h:26,   lds:12, lu:0, lh:0   },
};
const VIEW_ORDER = ['ahead','behind','cab','above'];
let viewIdx = 0, yaw = 0;
const camP = Object.assign({}, VIEW_DEF.ahead), camV = {};
const pointer = { x:0, y:0, tx:0, ty:0 };
const tgtLook = new THREE.Vector3();
function damp(cur, target, vel, key, st, dt){
  const w = 2/st, x = w*dt, e = 1/(1 + x + 0.48*x*x + 0.235*x*x*x), ch = cur - target, v0 = vel[key] || 0;
  const tmp = (v0 + w*ch)*dt; vel[key] = (v0 - w*tmp)*e; return target + (ch + tmp)*e;
}

// ---------- ui ----------
const ICON = {
  flower:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="2.2"/><circle cx="12" cy="6.3" r="2.8"/><circle cx="17.4" cy="10.2" r="2.8"/><circle cx="15.3" cy="16.6" r="2.8"/><circle cx="8.7" cy="16.6" r="2.8"/><circle cx="6.6" cy="10.2" r="2.8"/></svg>',
  sun:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><circle cx="12" cy="12" r="4"/><path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M5.6 18.4L7 17M17 7l1.4-1.4"/></svg>',
  leaf:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M5 19C5 10 11 5 20 4c-1 9-6 15-15 15z"/><path d="M5 19l8-8"/></svg>',
  flake:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M12 3v18M4.2 7.5l15.6 9M4.2 16.5l15.6-9M9.5 4.5L12 6l2.5-1.5M9.5 19.5L12 18l2.5 1.5"/></svg>',
  moon:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"><path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z"/></svg>',
  rise:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M3 18h18M7 18a5 5 0 0 1 10 0M12 6v3M5 11l1.5 1.5M19 11l-1.5 1.5"/></svg>',
  cloud:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"><path d="M7 17h10a4 4 0 0 0 0-8 6 6 0 0 0-11.5 1.5A3.5 3.5 0 0 0 7 17z"/></svg>',
  rain:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M7 14h10a4 4 0 0 0 0-8 6 6 0 0 0-11.5 1.5A3.5 3.5 0 0 0 7 14z"/><path d="M8 17l-1 3M12 17l-1 3M16 17l-1 3"/></svg>',
  fog:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M4 9h16M3 13h14M6 17h14"/></svg>',
};
const SEASON_ICON = ['flower','sun','leaf','flake'];
const SEASON_START = ['Blossom is opening on the trees', 'The trees are turning green', 'The leaves are starting to turn', 'Snow is starting to settle'];
const $$ = id => document.getElementById(id);
const el = {};
for (const id of ['dest','stopLabel','stopName','stopDist','grade','odo','served','icSeason','seasonTxt','icTime','timeTxt','icWeather','weatherTxt','chipPlace','placeTxt','chipAuto','infoBtn','help','notices','jn','jnTitle','jnLeft','jnRight','jnL','jnR','brake','go','speed','driveState','knob','nP','n0','nB','nR','kBell','kView','vView','kAuto','vAuto','kSound','vSound','kSeason','vSeason','kTime','vTime','kWeather','vWeather','kInfo']) el[id] = $$(id);

function notice(title, text, dur = 4.5){
  const li = document.createElement('li'); li.className = 'plaque';
  const b = document.createElement('b'); b.textContent = title;
  li.append(b, document.createTextNode(text)); el.notices.prepend(li);
  while (el.notices.children.length > 3) el.notices.lastChild.remove();
  setTimeout(() => { li.classList.add('out'); setTimeout(() => li.remove(), 520); }, dur*1000);
}
let needle = null;
(function buildDial(){
  const svg = $$('dialSvg'), NS = 'http://www.w3.org/2000/svg';
  const mk = (n, a) => { const e = document.createElementNS(NS, n); for (const k in a) e.setAttribute(k, a[k]); svg.appendChild(e); return e; };
  mk('circle', { cx:100, cy:100, r:97, fill:'#8C6A2A' }); mk('circle', { cx:100, cy:100, r:93, fill:'#C9A24A' }); mk('circle', { cx:100, cy:100, r:88, fill:'#F4EEDC' });
  const arc = (v0, v1, r) => { const a0 = (-210 + v0/DIAL_MAX*240)*PI/180, a1 = (-210 + v1/DIAL_MAX*240)*PI/180; return `M${100+Math.cos(a0)*r} ${100+Math.sin(a0)*r} A${r} ${r} 0 0 1 ${100+Math.cos(a1)*r} ${100+Math.sin(a1)*r}`; };
  mk('path', { d:arc(MAXF*3.6, DIAL_MAX, 78), stroke:'#B3261E', 'stroke-width':10, fill:'none' });
  for (let s = 0; s <= DIAL_MAX; s += 5){
    const a = (-210 + s/DIAL_MAX*240)*PI/180, big = s % 10 === 0, r0 = big ? 69 : 75;
    mk('line', { x1:100+Math.cos(a)*r0, y1:100+Math.sin(a)*r0, x2:100+Math.cos(a)*83, y2:100+Math.sin(a)*83, stroke:'#1B2B55', 'stroke-width':big ? 6 : 3.5, 'stroke-linecap':'round' });
  }
  needle = mk('line', { x1:100, y1:112, x2:100, y2:26, stroke:'#B3261E', 'stroke-width':8, 'stroke-linecap':'round' });
  mk('circle', { cx:100, cy:100, r:11, fill:'#1B2B55' });
})();

const boardDestSet = name => { boardName = name; redrawBoard(); };
function setDest(name){ el.dest.textContent = name; if (boardDestSet) boardDestSet(name); }
function syncHold(){ el.go.dataset.active = String(input.go); el.brake.dataset.active = String(input.brake); }
function setAuto(on, quiet){
  autopilot = on; el.kAuto.setAttribute('aria-pressed', String(on)); el.vAuto.textContent = on ? 'on' : 'off'; el.chipAuto.hidden = !on;
  if (!quiet) notice(on ? 'Autopilot' : 'Driving', on ? 'The tram drives and stops by itself. Press W or S to take over.' : 'You are in control.');
}
function unlockAudio(){ if (!soundOn) return; initAudio(); if (ac && ac.state === 'suspended') ac.resume(); }
function toggleSound(){
  soundOn = !soundOn; initAudio(); if (ac && ac.state === 'suspended') ac.resume();
  el.vSound.textContent = soundOn ? 'on' : 'off'; el.kSound.setAttribute('aria-pressed', String(soundOn));
  if (!soundOn && ac) for (const g of [rollGain, motorGain, squealGain, rainGain, windGain]) g.gain.setTargetAtTime(0, ac.currentTime, 0.05);
}
function holdBtn(b, key){
  const on = e => { e.preventDefault(); input[key] = true; syncHold(); if (autopilot) setAuto(false); unlockAudio(); try { b.setPointerCapture(e.pointerId); } catch(_){} };
  const off = () => { input[key] = false; syncHold(); };
  b.addEventListener('pointerdown', on);
  for (const ev of ['pointerup','pointercancel','lostpointercapture']) b.addEventListener(ev, off);
  b.addEventListener('contextmenu', e => e.preventDefault());
}
holdBtn(el.go, 'go'); holdBtn(el.brake, 'brake');
const arc = { amp:0, span:1 };
function cycleView(){
  viewIdx = (viewIdx+1) % VIEW_ORDER.length; el.vView.textContent = VIEW_ORDER[viewIdx];
  const span = Math.abs(camP.ds - VIEW_DEF[VIEW_ORDER[viewIdx]].ds); arc.span = Math.max(span, 1e-3); arc.amp = span > 6 ? Math.min(6, 2 + span*0.2) : 0;
}
function cycleSeason(){
  seasonOverride = seasonOverride >= 3 ? -1 : seasonOverride + 1;
  if (seasonOverride >= 0){ let t = seasonOverride + 0.4; while (t < seasonClock - 0.05) t += 4; seasonTarget = t; notice(SEASONS[seasonOverride], 'The city is changing season'); }
  el.vSeason.textContent = seasonOverride < 0 ? 'auto' : SEASONS[seasonOverride].toLowerCase();
}
function cycleTime(){ timeOverride = timeOverride >= TOD_PRESETS.length-1 ? -1 : timeOverride + 1; el.vTime.textContent = timeOverride < 0 ? 'auto' : TOD_PRESETS[timeOverride][1]; }
function cycleWeather(){ weatherOverride = weatherOverride >= 2 ? -1 : weatherOverride + 1; el.vWeather.textContent = weatherOverride < 0 ? 'auto' : WEATHERS[weatherOverride]; }
function toggleHelp(force){ const open = force ?? !el.help.classList.contains('open'); el.help.classList.toggle('open', open); el.infoBtn.setAttribute('aria-expanded', String(open)); }
el.kBell.onclick = () => { unlockAudio(); ringBell(); };
el.kView.onclick = cycleView;
el.kAuto.onclick = () => setAuto(!autopilot);
el.kSound.onclick = toggleSound;
el.kSeason.onclick = cycleSeason;
el.kTime.onclick = cycleTime;
el.kWeather.onclick = cycleWeather;
el.kInfo.onclick = () => toggleHelp();
el.infoBtn.onclick = () => toggleHelp();
function pickBranch(c){ const f = nextJunction(); if (f && !junctionChoice.has(f.k)){ junctionPick = c; hudT = 0; } }
el.jnLeft.onclick = () => pickBranch(1);
el.jnRight.onclick = () => pickBranch(-1);

const KEYMAP = { KeyW:'go', ArrowUp:'go', KeyS:'brake', ArrowDown:'brake', KeyA:'left', ArrowLeft:'left', KeyD:'right', ArrowRight:'right' };
addEventListener('keydown', e => {
  if (e.metaKey || e.ctrlKey || e.altKey) return;
  const k = KEYMAP[e.code];
  if (k){
    e.preventDefault();
    if (!input[k]){ input[k] = true; syncHold(); if ((k === 'go' || k === 'brake') && autopilot) setAuto(false); unlockAudio(); }
    return;
  }
  if (e.repeat) return;
  if (e.target.closest && e.target.closest('button') && (e.key === ' ' || e.key === 'Enter')) return;
  if (e.code === 'Space'){ e.preventDefault(); unlockAudio(); ringBell(); }
  else if (e.code === 'KeyV') cycleView();
  else if (e.code === 'KeyC') setAuto(!autopilot);
  else if (e.code === 'KeyN') cycleSeason();
  else if (e.code === 'KeyT') cycleTime();
  else if (e.code === 'KeyF') cycleWeather();
  else if (e.code === 'KeyM') toggleSound();
  else if (e.code === 'KeyQ') pickBranch(1);
  else if (e.code === 'KeyE') pickBranch(-1);
  else if (e.code === 'Escape') toggleHelp(false);
});
addEventListener('keyup', e => { const k = KEYMAP[e.code]; if (k){ input[k] = false; syncHold(); } });
addEventListener('blur', () => { for (const k in input) input[k] = false; syncHold(); });
canvas.addEventListener('pointermove', e => { pointer.tx = (e.clientX/innerWidth)*2-1; pointer.ty = (e.clientY/innerHeight)*2-1; });
canvas.addEventListener('pointerleave', () => { pointer.tx = 0; pointer.ty = 0; });
canvas.addEventListener('pointerdown', () => toggleHelp(false));
function onResize(){ renderer.setSize(innerWidth, innerHeight, false); camera.aspect = innerWidth/innerHeight; camera.fov = innerWidth < innerHeight ? 62 : 46; camera.updateProjectionMatrix(); }
addEventListener('resize', onResize); onResize();

// junctions: pick before the points are set, then the line follows your choice
function nextJunction(){
  const k0 = Math.floor(sTram/BLOCK);
  for (let k = k0 - 1; k <= k0 + 3; k++){ const f = feature(k); if (f && f.type === 'junction' && f.J + 25 > sTram) return f; }
  return null;
}
onJunctionLocked = k => {
  const f = feature(k), c = junctionChoice.get(k), name = c > 0 ? f.names[0] : f.names[1];
  setDest(name); notice('Points set', `Taking the ${c > 0 ? 'left' : 'right'} branch to ${name}`);
};

// ---------- hud ----------
let hudT = 0, lastSeasonStart = -1, lastWeatherWant = 'clear', lastPlace = null;
function hud(){
  const atStop = dwell > 0, d = stopS(nStop) - sTram;
  el.stopLabel.textContent = atStop ? 'Now at' : 'Next stop';
  el.stopName.textContent = stopName(nStop);
  let txt;
  if (atStop) txt = 'Doors open';
  else if (!autopilot && Math.abs(d) <= 4) txt = 'Stop here';
  else if (!autopilot && d > 4 && v > 1 && (v*v)/(2*BRAKE) > d - 6) txt = 'Brake now';
  else txt = d >= 0 ? `${Math.round(d)} m ahead` : `${Math.round(-d)} m behind`;
  el.stopDist.textContent = txt; el.stopDist.dataset.alert = String(txt === 'Brake now' || txt === 'Stop here');
  const g = dhy(sTram)*100;
  el.grade.textContent = Math.abs(g) < 1.5 ? 'Level' : (g > 0 ? `Climbing ${Math.round(g)}%` : `Descending ${Math.round(-g)}%`);
  el.odo.textContent = `${(odo/1000).toFixed(2)} km`;
  el.served.textContent = `${served} ${served === 1 ? 'stop' : 'stops'}`;

  // season chip, with the season that is arriving while it changes
  const S = SS, dom = S.t > 0.5 ? S.b : S.a;
  el.icSeason.innerHTML = ICON[SEASON_ICON[dom]];
  el.seasonTxt.innerHTML = S.t > 0.02 && S.t < 0.98 ? `${SEASONS[S.a]} <small>to</small> ${SEASONS[S.b]}` : SEASONS[dom];
  const startKey = Math.floor(seasonClock);
  if (S.t > 0.02 && lastSeasonStart !== startKey){ lastSeasonStart = startKey; notice(SEASONS[S.b], SEASON_START[S.b]); }
  const tn = todName(phase);
  el.timeTxt.textContent = tn;
  el.icTime.innerHTML = ICON[tn === 'Night' ? 'moon' : (tn === 'Dawn' || tn === 'Dusk' || tn === 'Evening') ? 'rise' : 'sun'];
  const snowy = _sw[3] > 0.5;
  const wLabel = rainAmt > 0.4 ? (snowy ? 'Snow' : 'Rain') : fogAmt > 0.4 ? 'Fog' : (snowy ? 'Snowy' : 'Clear');
  el.weatherTxt.innerHTML = wLabel + (wind > 0.75 ? ' <small>gusty</small>' : '');
  el.icWeather.innerHTML = ICON[rainAmt > 0.4 ? (snowy ? 'flake' : 'rain') : fogAmt > 0.4 ? 'fog' : (lampLevel > 0.7 ? 'moon' : 'cloud')];

  const f = featureAt(sTram);
  const place = f && f.type !== 'junction' ? f : null;
  el.chipPlace.hidden = !place;
  if (place){
    const label = { festival:'Festa', miradouro:'Miradouro', bridge:'Viaduto', arch:'Arco' }[place.type];
    el.placeTxt.textContent = label;
    if (lastPlace !== place){
      const msg = { festival:'Bunting and lights over the street', miradouro:`The view opens on your ${place.side > 0 ? 'right' : 'left'}`, bridge:'Crossing the valley, look down', arch:'Through the arch under the house' }[place.type];
      notice(label, msg);
    }
  }
  lastPlace = place;

  const jf = nextJunction();
  const showJ = jf && sTram > jf.J - 540 && sTram < jf.J + 20;
  el.jn.hidden = !showJ;
  if (showJ){
    const locked = junctionChoice.has(jf.k), c = locked ? junctionChoice.get(jf.k) : junctionPick;
    el.jnL.textContent = jf.names[0]; el.jnR.textContent = jf.names[1];
    el.jnLeft.setAttribute('aria-pressed', String(c > 0)); el.jnRight.setAttribute('aria-pressed', String(c < 0));
    el.jn.classList.toggle('locked', locked);
    el.jnTitle.textContent = locked ? `Junction in ${Math.max(0, Math.round(jf.J - sTram))} m` : `Choose a branch, points set in ${Math.max(0, Math.round(jf.J - LOCK_AHEAD - sTram))} m`;
  }
  document.documentElement.style.setProperty('--scene', '#' + scene.background.getHexString());
}

// ---------- driving ----------
function drive(dt){
  const ss = stopS(nStop), d = ss - sTram;
  braking = false;
  if (dwell > 0){
    v = 0; dwell -= dt; driveState = 'Doors open';
    if (dwell <= 0){ dwell = 0; nStop++; ringBell(); }
    return;
  }
  if (autopilot){
    driveState = 'Autopilot';
    if (d <= (v*v)/(2*AUTO_DEC) + 0.3 && d > -0.5){
      v = Math.min(Math.max(v, 0.6), Math.sqrt(Math.max(0, 2*AUTO_DEC*Math.max(0, d - 0.05)))); braking = v > 1;
      if (d < 0.08 || v < 0.06){ v = 0; sTram = ss; dwell = 3.4; served++; }
    } else {
      if (d < -0.5) nStop++;
      const a = AUTO_V > v ? AUTO_ACC : 1.5;
      v += Math.sign(AUTO_V - v) * Math.min(Math.abs(AUTO_V - v), a*dt);
    }
    return;
  }
  const grav = -9.81 * dhy(sTram) * 0.32, drag = -0.0025 * v * Math.abs(v);
  brakeHold = input.brake && Math.abs(v) < 0.1 ? brakeHold + dt : (input.brake ? brakeHold : 0);
  if (input.go && !input.brake){
    let a;
    if (v < -0.05){ a = BRAKE; driveState = 'Braking'; braking = true; }
    else { a = 2.2*Math.max(0, 1 - v/MAXF) + 0.6 + grav + drag; driveState = 'Power'; }
    const nv = v + a*dt; v = (v < 0 && nv > 0) ? 0 : nv;
  } else if (input.brake){
    if (v > 0.05){ driveState = 'Braking'; braking = true; const nv = v + (-BRAKE + grav*0.3)*dt; v = nv < 0 ? 0 : nv; }
    else if (brakeHold > 0.6 || v < -0.05){ driveState = 'Reversing'; v += (-0.9*Math.max(0, 1 - v/MAXR) + grav*0.5)*dt; }
    else { v = 0; driveState = 'Holding'; }
  } else if (Math.abs(v) < 0.2){
    v = 0; driveState = 'Parked';
  } else {
    driveState = 'Coasting'; v += (grav + drag - 0.18*Math.sign(v))*dt;
  }
  v = Math.max(MAXR, Math.min(MAXF, v));
  if (Math.abs(d) <= 4 && Math.abs(v) < 0.3 && !input.go){
    v = 0; dwell = 3.2; served++; driveState = 'Doors open';
    notice('Doors open', stopName(nStop));
  } else if (d < -6){
    notice('Missed stop', `${stopName(nStop)}. Next is ${stopName(nStop+1)}`);
    nStop++;
  }
}
const LEVER = { Power:10, Coasting:40, Parked:40, Holding:68, Braking:68, Reversing:92, 'Doors open':40, Autopilot:40 };

// ---------- loop ----------
const _tmp = new THREE.Vector3(), _fb = new THREE.Vector3(), _rb = new THREE.Vector3();
let lastT = performance.now();
updateChunks(sTram, true);
// capped at 60fps: on faster displays the extra vsyncs are skipped
const FRAME_MS = 1000/60;
let nextFrame = 0, frameAvg = FRAME_MS, slowT = 0, fastT = 0;
function adaptResolution(ms){
  if (ms > 100) return; // tab was hidden or paused
  frameAvg += (ms - frameAvg)*0.1;
  if (frameAvg > FRAME_MS + 2.5){ slowT += ms; fastT = 0; } else if (frameAvg < FRAME_MS + 0.8){ fastT += ms; slowT = 0; }
  if (slowT > 500 && dpr > DPR_MIN){ dpr = Math.max(DPR_MIN, dpr - 0.125); renderer.setPixelRatio(dpr); slowT = 0; frameAvg = FRAME_MS; }
  else if (fastT > 4000 && dpr < DPR_MAX){ dpr = Math.min(DPR_MAX, dpr + 0.125); renderer.setPixelRatio(dpr); fastT = 0; }
}
function tick(now){
  requestAnimationFrame(tick);
  if (now < nextFrame - 1.5) return;
  nextFrame = now - nextFrame > FRAME_MS ? now + FRAME_MS : nextFrame + FRAME_MS;
  const ms = now - lastT;
  adaptResolution(ms);
  const dt = Math.min(0.05, ms/1000); lastT = now; time += dt;
  U.uTime.value = time;

  const jf = nextJunction();
  if (jf && !junctionChoice.has(jf.k) && sTram >= jf.J - LOCK_AHEAD) choiceFor(jf.k);
  drive(dt);
  const accel = (v - prevV)/Math.max(dt, 1e-4); prevV = v;
  sTram += v*dt; odo += Math.abs(v)*dt;
  if (sTram < 24){ sTram = 24; if (v < 0) v = 0; }
  updateChunks(sTram, false);

  // time, season and weather all move on as you travel
  if (timeOverride < 0) phase = (phase + dt/600 + Math.abs(v)*dt/2400) % 1;
  else { let dp = TOD_PRESETS[timeOverride][0] - phase; dp -= Math.round(dp); phase = (phase + dp*(1 - Math.exp(-dt*1.6)) + 1) % 1; }
  if (seasonOverride >= 0) seasonClock = damp(seasonClock, seasonTarget, camV, 'season', 2.4, dt);
  else seasonClock += Math.abs(v)*dt/SEASON_LEN;
  seasonState();
  const want = weatherOverride >= 0 ? WEATHERS[weatherOverride] : weatherPlan(Math.floor(odo/WBLOCK));
  if (want !== lastWeatherWant){ notice('Weather', { clear:'The sky is clearing', fog:'Fog is rolling in', rain:_sw[3] > 0.5 ? 'Snow is starting to fall' : 'Rain is starting' }[want]); lastWeatherWant = want; }
  fogAmt = damp(fogAmt, want === 'fog' ? 1 : want === 'rain' ? 0.3 : 0, camV, 'fog', 4, dt);
  rainAmt = damp(rainAmt, want === 'rain' ? 1 : 0, camV, 'rain', 3.5, dt);
  wetAmt = damp(wetAmt, rainAmt > 0.3 ? 1 : 0, camV, 'wet', rainAmt > 0.3 ? 5 : 20, dt);
  U.uWet.value = wetAmt*(1 - _sw[3]);
  stepWind(dt);
  applyLighting();

  // tram pose from the two bogies
  pt(sTram+2.6, 0, 0.11, _fb); pt(sTram-2.6, 0, 0.11, _rb);
  tram.position.addVectors(_fb, _rb).multiplyScalar(0.5);
  const bob = Math.sin(time*9.1)*0.006*Math.min(1, Math.abs(v)/4);
  tram.position.y += bob;
  tram.lookAt(_fb.x, _fb.y + bob, _fb.z);
  tram.rotateZ(Math.max(-0.045, Math.min(0.045, curv(sTram)*v*v*0.03)) + Math.sin(time*5.3)*0.0025*Math.min(1, Math.abs(v)/4));
  for (const w of tramParts.wheels) w.rotation.x += v*dt/0.33;
  tram.updateMatrixWorld();
  pt(sTram-5.1, 0, WIRE_H - 0.02, _tmp); tram.worldToLocal(_tmp);
  const pb = tramParts.pole.position; _d.subVectors(_tmp, pb); const pl = _d.length(); _d.divideScalar(pl);
  tramParts.pole.quaternion.setFromUnitVectors(YAX, _d); tramParts.pole.scale.set(1, pl, 1);
  tramParts.shoe.position.copy(_tmp); tramParts.shoe.quaternion.copy(tramParts.pole.quaternion);

  // camera: spring damped between views and when you look around
  const V = VIEW_DEF[VIEW_ORDER[viewIdx]];
  for (const k in camP) camP[k] = damp(camP[k], V[k], camV, k, 0.7, dt);
  pointer.x = damp(pointer.x, pointer.tx, camV, 'px', 0.4, dt);
  pointer.y = damp(pointer.y, pointer.ty, camV, 'py', 0.4, dt);
  const turn = (input.left ? 1 : 0) - (input.right ? 1 : 0);
  yaw = damp(yaw, turn*1.1, camV, 'yaw', turn ? 0.3 : 0.5, dt);
  let lift = 0;
  if (arc.amp){ const prog = 1 - Math.min(1, Math.abs(camP.ds - V.ds)/arc.span); lift = arc.amp*Math.sin(PI*prog); if (prog > 0.99) arc.amp = 0; }
  const par = reduceMotion ? 0.3 : 1, inCab = camP.h < 3.5 && !arc.amp, facing = Math.sign(camP.lds - camP.ds) || 1;
  const u = Math.max(-1.8, Math.min(1.8, camP.u + (inCab ? 0.15 : 1.0)*par*pointer.x + (inCab ? 0 : 1.2)*facing*Math.sin(yaw)));
  pt(sTram + camP.ds, u, camP.h + lift + (inCab ? 0.1 : 0.7)*par*-pointer.y + (inCab ? bob : 0), camera.position);
  pt(sTram + camP.lds, camP.lu, camP.lh, tgtLook);
  if (Math.abs(yaw) > 1e-4){ _d.subVectors(tgtLook, camera.position).applyAxisAngle(YAX, yaw); tgtLook.copy(camera.position).add(_d); }
  camera.lookAt(tgtLook);

  sun.target.position.copy(tram.position);
  sun.position.copy(tram.position).addScaledVector(SUN_DIR, 70);
  stars.position.copy(camera.position);
  moon.position.copy(camera.position).addScaledVector(MOON_DIR, 260);

  // weather follows the season at the tram, with extra leaves in a gust
  const w = _sw;
  const leafAmt = Math.min(1, (w[2] + 0.18*w[1])*(1 + gust*0.8));
  stepFall(LEAF_FALL, Math.round(LEAF_FALL.N*leafAmt), dt, wind, () => frng() < w[2]/(w[2] + 0.18*w[1] + 1e-6) ? LEAVES : SUMMER_LEAF);
  stepFall(PETAL_FALL, Math.round(PETAL_FALL.N*w[0]*(1 + gust*0.5)), dt, wind*0.7, () => PETAL_PAL);
  stepSnow(dt, wind, Math.round(SNOW_N*w[3]*(0.35 + 0.65*rainAmt)));
  stepRain(dt, wind, Math.round(RAIN_N*rainAmt*(1 - w[3])));

  frame(sTram+60, FA);
  for (const b of birds){
    const bu = b.userData, a = time*0.25 + bu.ph;
    b.position.set(FA.x + bu.off.x + Math.sin(a)*4, FA.y + 20 + bu.off.y + Math.sin(a*1.7)*0.8, FA.z + bu.off.z + Math.cos(a)*3);
    b.rotation.y = FA.h + Math.sin(a)*0.4;
    const flap = Math.sin(time*7 + bu.ph*3)*0.55; bu.l.rotation.z = flap; bu.r.rotation.z = -flap;
  }
  // the little tram on the street under the viaduct
  for (const [, c] of chunks){
    if (!c.lower) continue;
    const L = c.lower, ph = time*0.06 + L.ph, dir = Math.cos(ph) >= 0 ? 1 : -1;
    L.obj.position.copy(L.C0).addScaledVector(L.R, 60*Math.sin(ph));
    _tmp.copy(L.obj.position).addScaledVector(L.R, dir).add(c.group.position); L.obj.lookAt(_tmp);
  }

  if (ac && soundOn){
    const t = ac.currentTime, av = Math.abs(v);
    rollGain.gain.setTargetAtTime(Math.min(0.26, av*0.03), t, 0.15);
    rollFilter.frequency.setTargetAtTime(220 + av*40, t, 0.2);
    motorOsc.frequency.setTargetAtTime(48 + av*13, t, 0.1);
    motorGain.gain.setTargetAtTime(av > 0.1 ? Math.min(0.05, 0.012 + Math.max(0, Math.abs(accel) - 0.3)*0.02) : 0, t, 0.2);
    squealGain.gain.setTargetAtTime((braking && av > 1.5 ? 0.012 : 0) + (Math.abs(curv(sTram)) > 0.015 && av > 5 ? 0.006 : 0), t, 0.12);
    rainGain.gain.setTargetAtTime(0.07*rainAmt*(1 - w[3]), t, 0.3);
    windGain.gain.setTargetAtTime(0.012 + 0.05*Math.max(0, wind - 0.3), t, 0.25);
    windFilter.frequency.setTargetAtTime(320 + wind*380, t, 0.3);
    const joint = Math.floor(sTram/12);
    if (joint !== lastJoint && av > 1){ const lv = Math.min(0.35, 0.05 + av*0.025); for (const off of [0, 1.4, 5.2, 6.6]) clack(t + off/av, lv*(off > 3 ? 0.8 : 1)); }
    lastJoint = joint;
  }

  // dashboard
  const kmh = Math.abs(v)*3.6;
  needle.setAttribute('transform', `rotate(${-210 + Math.min(DIAL_MAX, kmh)/DIAL_MAX*240 + 90} 100 100)`);
  el.speed.textContent = Math.round(kmh);
  if (el.driveState.textContent !== driveState) el.driveState.textContent = driveState;
  hudT -= dt; if (hudT <= 0){ hud(); hudT = 0.15; }
  renderer.render(scene, camera);
}
seasonState();
applyLighting();
hud();
// compile every shader up front (hidden weather, sky and tram parts included) so none stalls a frame later
renderer.compile(scene, camera);
setTimeout(() => notice('Linha 31', matchMedia('(pointer: coarse)').matches ? 'Hold Go to drive. Tap Controls for help.' : 'Hold W or \u2191 to drive. Hover the i for all controls.', 6), 600);
requestAnimationFrame(tick);
