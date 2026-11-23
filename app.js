import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { palettes, defaultColors, decorKinds, stationIds, clamp, seatDistribution, safeUrl, normalizePlan } from './planner-state.js';

const $ = id => document.getElementById(id);
const viewport = $('viewport');
const status = message => { $('status').textContent = message; };
function showError(message) {
  $('errorBanner').hidden = false;
  $('errorBanner').textContent = message;
}
window.addEventListener('error', e => showError(`Something went wrong: ${e.message}`));
window.addEventListener('unhandledrejection', e => showError(e.reason?.message || String(e.reason)));
function attempt(action) {
  try { $('errorBanner').hidden = true; return action(); }
  catch (e) { showError(e.message); }
}

let themeName = 'lavender';
let colors = { ...defaultColors, ...palettes[themeName] };
let floralIntensity = .35, goldIntensity = 1.25;
let selected = null, guests = [], shopping = [];
const objects = new Map(), labels = new Map(), flowerClusters = new Set();
const scene = new THREE.Scene();
scene.background = new THREE.Color('#e9e5e2');
const camera = new THREE.PerspectiveCamera(45, 1, .1, 500);
camera.position.set(44, 49, 58);
const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.domElement.tabIndex = 0;
renderer.domElement.setAttribute('aria-label', 'Interactive wedding room. Select objects with the planner menu or click a piece.');
viewport.appendChild(renderer.domElement);
const orbit = new OrbitControls(camera, renderer.domElement);
orbit.enableDamping = true;
orbit.target.set(-3, 1, 0);
orbit.minDistance = 2;
orbit.maxDistance = 300;
orbit.maxPolarAngle = Math.PI * .49;

const material = (color, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: .75, ...extra });
const mats = {
  linen: material(colors.linen), chairs: material(colors.chairs),
  walls: material(colors.walls, { side: THREE.DoubleSide }), floor: material(colors.floor), dance: material(colors.dance),
  accent: material(colors.accent), deep: material(colors.deep), gold: material(colors.gold, { metalness: .82, roughness: .24 }),
  ivory: material('#f8f5ef'), green: material('#627757'), silver: material('#c8ccd0', { metalness: .7, roughness: .25 }),
  glass: material('#bddcec', { transparent: true, opacity: .4, roughness: .1 }),
  flame: material('#ffe5a1', { emissive: '#ffb745', emissiveIntensity: 1.4 }), dark: material('#363138')
};
// Cache geometry shared by furniture and decoration instances. Changes in fullness
// reuse the same geometry instead of allocating hundreds of new GPU buffers.
const geometries = new Map();
function geometry(kind, args) {
  const key = `${kind}:${args.join(',')}`;
  if (!geometries.has(key)) geometries.set(key, new THREE[kind](...args));
  return geometries.get(key);
}
function mesh(group, kind, args, mat, pos = [0, 0, 0]) {
  const obj = new THREE.Mesh(geometry(kind, args), mat);
  obj.position.set(...pos); obj.castShadow = true; obj.receiveShadow = true;
  group.add(obj); return obj;
}
const box = (g, w, h, d, m, p) => mesh(g, 'BoxGeometry', [w, h, d], m, p);
const cylinder = (g, top, bottom, h, m, p) => mesh(g, 'CylinderGeometry', [top, bottom, h, 24], m, p);
const ball = (g, radius, m, p) => mesh(g, 'SphereGeometry', [radius, 12, 8], m, p);
function blooms(cluster) {
  cluster.clear();
  const count = Math.round(floralIntensity * 16);
  for (let i = 0; i < count; i++) {
    const angle = i * 2.39996, r = .2 + .5 * Math.sqrt(i / Math.max(1, count));
    ball(cluster, .25, i % 4 === 0 ? mats.ivory : i % 3 === 0 ? mats.deep : cluster.userData.bloomMat,
      [Math.cos(angle) * r, .12 + Math.sin(i * 1.7) * .15, Math.sin(angle) * r]);
  }
  cluster.visible = count > 0;
}
function flowers(group, pos, scale = 1, bloomMat = mats.accent) {
  const cluster = new THREE.Group();
  cluster.userData.bloomMat = bloomMat;
  cluster.userData.flowerCluster = true;
  cluster.position.set(...pos); cluster.scale.setScalar(scale); group.add(cluster);
  flowerClusters.add(cluster); blooms(cluster); return cluster;
}

scene.add(new THREE.HemisphereLight('#fff9f2', '#68656a', 2.3));
const light = new THREE.DirectionalLight('#ffedda', 2.5);
light.position.set(-18, 38, 10); light.castShadow = true;
light.shadow.mapSize.set(2048, 2048);
Object.assign(light.shadow.camera, { left: -42, right: 42, top: 42, bottom: -42, far: 100 });
light.shadow.normalBias = .04; scene.add(light);
const fill = new THREE.DirectionalLight('#e5eeff', 1.2); fill.position.set(25, 18, -20); scene.add(fill);
const room = new THREE.Group(); scene.add(room);
// ShapeGeometry's Y becomes -Z after rotation: negate the plan Z coordinates.
const roomShape = new THREE.Shape();
[[-17.5,-31],[17.5,-31],[17.5,1],[9.5,1],[9.5,31],[-17.5,31]].forEach(([x,z], i) => {
  if (i) roomShape.lineTo(x,-z); else roomShape.moveTo(x,-z);
});
roomShape.closePath();
const floor = new THREE.Mesh(new THREE.ShapeGeometry(roomShape), mats.floor);
floor.rotation.x = -Math.PI/2; floor.receiveShadow = true; room.add(floor);
box(room, 10.9, .04, 40.8, mats.dance, [-3.8, .02, -.3]);
const wallObjects = [];
function wall(w, d, x, z, normal) {
  const obj = box(room, w, 12.5, d, mats.walls, [x, 6.25, z]);
  obj.userData.outward = new THREE.Vector3(...normal); wallObjects.push(obj); return obj;
}
wall(35,.18,0,-31,[0,0,-1]); wall(27,.18,-4,31,[0,0,1]);
wall(.18,35,-17.5,-13.5,[-1,0,0]); wall(.18,24,-17.5,19,[-1,0,0]);
wall(.18,32,17.5,-15,[1,0,0]); wall(.18,30,9.5,16,[1,0,0]); wall(8,.18,13.5,1,[0,0,1]);
const rightWallDetails = new THREE.Group(); room.add(rightWallDetails);
for (let z = -26; z <= -5; z += 7) {
  box(rightWallDetails,.12,6.7,5.4,mats.glass,[17.36,6.2,z]);
  for (const side of [-1,1]) box(rightWallDetails,.18,7.8,.45,mats.ivory,[17.22,5.8,z+side*2.9]);
}
box(room,.15,2,3,material('#c94d4d'),[-17.35,6.8,5.5]);
box(room,5.4,6.8,.14,material('#d9d2c9'),[13.5,3.4,1.05]);
function chandelier(x,z) {
  const g = new THREE.Group();
  const ring = mesh(g,'TorusGeometry',[2.15,.055,8,48],mats.gold); ring.rotation.x = Math.PI/2;
  for (let i=0;i<10;i++) { const a=i/10*Math.PI*2; ball(g,.1,mats.flame,[Math.cos(a)*1.9,0,Math.sin(a)*1.9]); }
  g.position.set(x,10.8,z); scene.add(g);
}
chandelier(-2,-15); chandelier(-2,15);

function register(id, label, group, type, extra = {}) {
  group.userData = { ...group.userData, ...extra, id, label, type };
  scene.add(group); objects.set(id,group);
  const el = document.createElement('div'); el.className = 'sceneLabel'; el.textContent = label;
  viewport.appendChild(el); labels.set(group,el); return group;
}
function removeObject(id) {
  const obj = objects.get(id); if (!obj) return;
  if (selected === obj) selectObject(null);
  obj.traverse(child => { if (child.userData.flowerCluster) flowerClusters.delete(child); });
  obj.userData.customMat?.dispose();
  scene.remove(obj); labels.get(obj)?.remove(); labels.delete(obj); objects.delete(id);
}
function chair(group, x, z, rotation) {
  const g = new THREE.Group();
  box(g,.98,.2,.95,mats.chairs,[0,.8,0]);
  box(g,.98,1.5,.18,mats.chairs,[0,1.5,.38]);
  cylinder(g,.6,.72,1.15,mats.chairs,[0,.38,0]);
  g.position.set(x,0,z); g.rotation.y = rotation; group.add(g);
}
function roundTable(id, x, z, seats) {
  const g = new THREE.Group();
  cylinder(g,3,3,.18,mats.linen,[0,2.35,0]);
  cylinder(g,.32,.5,2.2,mats.ivory,[0,1.15,0]);
  box(g,5.15,.035,.9,mats.accent,[0,2.46,0]);
  cylinder(g,.3,.42,.62,mats.gold,[0,2.79,0]); flowers(g,[0,3.2,0],.9);
  for (let i=0;i<seats;i++) {
    const a=i/seats*Math.PI*2;
    chair(g,Math.cos(a)*4,Math.sin(a)*4,-a+Math.PI/2);
    // CylinderGeometry already lies flat in XZ; rotating it stood plates upright.
    cylinder(g,.34,.34,.035,mats.ivory,[Math.cos(a)*2.38,2.49,Math.sin(a)*2.38]);
    const fork = box(g,.04,.025,.5,mats.silver,[Math.cos(a)*2.65,2.5,Math.sin(a)*2.65]); fork.rotation.y = -a;
  }
  g.position.set(x,0,z); return register(id,`Table ${id.slice(1)} · ${seats} seats`,g,'table',{seats});
}
const stationDefs = {
  photoBooth: ['photo','Photo booth',-11,28.5,6.2,2.7],
  polaroid: ['polaroid','Polaroid scrapbook',5,28,5.3,2.2],
  video: ['video','Video messages',5.5,15.2,4.7,2.1],
  advice: ['advice','Advice jar',5.8,10.2,4.1,2],
  cake: ['cake','Cake / sweets',-13,15.5,5.8,2.3],
  dj: ['dj','DJ',-11,-28.5,5.7,2.3]
};
function station(id,label,x,z,w,d) {
  const g = new THREE.Group();
  box(g,w,2.2,d,mats.linen,[0,1.1,0]); box(g,w*.28,.06,d+.08,mats.accent,[w*.3,2.24,0]);
  if (id === 'cake') {
    cylinder(g,.9,.9,.65,mats.ivory,[0,2.56,0]); cylinder(g,.65,.65,.6,mats.ivory,[0,3.18,0]); flowers(g,[0,3.55,0],.55);
  } else if (id === 'dj') {
    box(g,1.6,.8,.1,mats.dark,[0,2.7,0]);
    for (const side of [-1,1]) box(g,.8,2,1,mats.dark,[side*(w/2+.65),1,0]);
  } else if (id === 'photo') {
    box(g,w,5.8,.12,mats.accent,[0,3,-1]); flowers(g,[-2,5.5,-1],1.2);
  } else {
    cylinder(g,.23,.3,.7,mats.gold,[0,2.6,0]); flowers(g,[0,3,0],.6);
  }
  g.position.set(x,0,z); return register(id,label,g,'station');
}
function sweetheart() {
  const g = new THREE.Group();
  box(g,7.4,.22,2.7,mats.linen,[0,2.3,0]); box(g,7.4,2.15,.18,mats.linen,[0,1.1,1.25]);
  box(g,2.1,.04,2.78,mats.accent,[0,2.43,0]);
  mesh(g,'TorusGeometry',[3.2,.075,8,48,Math.PI],mats.gold,[0,3.2,-.9]);
  // Torus arc opens upward, with both ends reaching the floor through its posts.
  cylinder(g,.075,.075,3.2,mats.gold,[-3.2,1.6,-.9]); cylinder(g,.075,.075,3.2,mats.gold,[3.2,1.6,-.9]);
  flowers(g,[-2.3,5.5,-.9],1.3); chair(g,-1.4,-2.1,0); chair(g,1.4,-2.1,0);
  g.position.set(12,0,-13); g.rotation.y = -Math.PI/2; return register('sweetheart','Bride & Groom',g,'station');
}
const defaultTablePos = [[-11.8,-21.5],[-2,-22],[7.8,-22],[-11.8,-8],[3.8,-7],[-11.8,5.5],[3.8,5.5],[-12.85,21],[-4,21],[4.85,21]];
function transform(obj) {
  return { id: obj.userData.id, type: obj.userData.type, pos: obj.position.toArray(), rot: obj.rotation.y, scale: obj.scale.x,
    ...(obj.userData.type === 'decor' ? { kind:obj.userData.kind, color:obj.userData.color, label:obj.userData.label, anchor:obj.userData.anchor||null } : {}) };
}
function restoreTransform(obj, saved) {
  if (!saved) return;
  obj.position.fromArray(saved.pos); obj.rotation.y = saved.rot; obj.scale.setScalar(saved.scale); clampObject(obj);
}
function rebuild(preserve = true) {
  const previous = new Map(preserve ? tableObjects().map(o=>[o.userData.id,transform(o)]) : []);
  const keep = selected?.userData.id;
  tableObjects().forEach(o=>removeObject(o.userData.id));
  const count = clamp(Math.round(Number($('tableCount').value)||10),8,10);
  const total = clamp(Math.round(Number($('guestTarget').value)||95),1,120);
  $('tableCount').value = count; $('guestTarget').value = total;
  const distribution = seatDistribution(count,total);
  distribution.forEach((seats,i)=> {
    const obj=roundTable(`t${i+1}`,...defaultTablePos[i],seats);
    if(i>=7) obj.scale.setScalar(.95);
    restoreTransform(obj,previous.get(obj.userData.id)); clampObject(obj);
  });
  objects.forEach(o=> { if(o.userData.anchor&&!objects.has(o.userData.anchor)) { o.userData.anchor=null; o.position.y=0; } });
  $('seatDistribution').textContent = distribution.map((s,i)=>`T${i+1}: ${s}`).join(' · ');
  reconcileGuests(); refreshSelect(); renderGuests(); metrics();
  if (objects.has(keep)) selectObject(objects.get(keep));
  status(`Seating updated: ${total} seats across ${count} tables. Existing positions kept.`);
}
function tableObjects() { return [...objects.values()].filter(o=>o.userData.type==='table'); }
function reconcileGuests() {
  const used = new Map();
  guests.forEach(g=> {
    const capacity=objects.get(g.table)?.userData.seats || 0, n=used.get(g.table)||0;
    if (n>=capacity) g.table=''; else used.set(g.table,n+1);
  });
}

let decorationNumber = 0;
function newDecoration(kind, saved = null) {
  if (!Object.hasOwn(decorKinds,kind)) return;
  if (!saved && [...objects.values()].filter(o=>o.userData.type==='decor').length>=180) { status('The room supports up to 180 decorations. Remove a piece before adding another.'); return; }
  const g = new THREE.Group();
  const color = saved?.color || null;
  const accent = color ? material(color) : mats.accent;
  if (color) g.userData.customMat = accent;
  if (kind==='flowers') {
    cylinder(g,.48,.6,.6,mats.gold,[0,.3,0]); flowers(g,[0,.85,0],1.6,accent);
  } else if (kind==='candles') {
    [-.6,0,.6].forEach((x,i)=> { const h=[1.2,1.8,.9][i]; cylinder(g,.24,.24,h,accent,[x,h/2,0]); ball(g,.09,mats.flame,[x,h+.1,0]); cylinder(g,.36,.36,.08,mats.gold,[x,.04,0]); });
  } else if (kind==='arch') {
    mesh(g,'TorusGeometry',[3.5,.12,8,56,Math.PI],mats.gold,[0,4,0]);
    for(const x of [-3.5,3.5]) { cylinder(g,.12,.12,4,mats.gold,[x,2,0]); box(g,1.5,.12,1.8,mats.gold,[x,.06,0]); }
    flowers(g,[-2.6,6.4,0],2,accent); flowers(g,[2.8,5.7,0],1.5,accent);
  } else if (kind==='backdrop') {
    for(let i=0;i<17;i++) box(g,.5,8.5,.25,accent,[-4+i*.5,4.35,Math.sin(i*Math.PI/2)*.16]);
    box(g,9,.15,.3,mats.gold,[0,8.7,0]); for(const x of [-4.3,4.3]) { cylinder(g,.07,.07,8.6,mats.gold,[x,4.3,0]); box(g,1.2,.12,1.8,mats.gold,[x,.06,0]); }
  } else if (kind==='vase') {
    cylinder(g,.4,.55,2.3,accent,[0,1.15,0]); flowers(g,[0,2.7,0],1.6,accent);
  } else if (kind==='plant') {
    cylinder(g,.65,.48,1,accent,[0,.5,0]); cylinder(g,.05,.08,3,mats.green,[0,2,0]);
    for(let i=0;i<9;i++) { const a=i*2.4; const leaf=ball(g,.65,mats.green,[Math.cos(a)*.6,1.5+i*.25,Math.sin(a)*.6]); leaf.scale.set(.65,.28,1.4); leaf.rotation.z=a; }
  } else if (kind==='lantern') {
    box(g,1.15,.12,1.15,accent,[0,.06,0]); box(g,1.15,.12,1.15,accent,[0,1.9,0]);
    for(const x of [-.5,.5]) for(const z of [-.5,.5]) box(g,.06,1.8,.06,accent,[x,1,z]);
    cylinder(g,.22,.22,1.1,mats.ivory,[0,.65,0]); ball(g,.1,mats.flame,[0,1.3,0]);
    mesh(g,'TorusGeometry',[.26,.035,6,24],accent,[0,2.2,0]);
  } else if (kind==='runner') box(g,3.5,.035,13,accent,[0,.025,0]);
  const id = saved?.id || `decor-${crypto.randomUUID()}`;
  decorationNumber++;
  register(id,saved?.label||`${decorKinds[kind]} ${decorationNumber}`,g,'decor',{kind,color,anchor:saved?.anchor||null});
  if (saved) restoreTransform(g,saved);
  else {
    const tabletop = selected?.userData.type==='table' || selected?.userData.type==='station';
    const small = ['flowers','candles','vase','lantern'].includes(kind);
    if (tabletop && small) {
      const top=selected.userData.type==='table'?2.46:selected.userData.id==='sweetheart'?2.43:2.27;
      g.position.set(selected.position.x,selected.position.y+top*selected.scale.y,selected.position.z);
      g.userData.anchor=selected.userData.id;
    }
    else { const n=[...objects.values()].filter(o=>o.userData.type==='decor').length-1; g.position.set(orbit.target.x+(n%3-1)*2.2,0,orbit.target.z+Math.floor(n/3)%3*2.2); }
    clampObject(g);
  }
  refreshSelect(); renderDecorations();
  if (!saved) { selectObject(g); status(`${decorKinds[kind]} added. Drag it into place, or adjust the controls.`); }
  return g;
}
function replaceDecoration(obj, color) {
  const saved={...transform(obj),color}; const wasSelected=selected===obj;
  removeObject(obj.userData.id); const next=newDecoration(saved.kind,saved);
  if (wasSelected) selectObject(next); return next;
}
function renderDecorations() {
  const list=$('decorationList'); list.replaceChildren();
  const pieces=[...objects.values()].filter(o=>o.userData.type==='decor');
  $('decorCount').textContent=pieces.length;
  if (!pieces.length) { const p=document.createElement('p'); p.className='empty'; p.textContent='Your added decorations will appear here.'; list.append(p); }
  pieces.forEach(obj=> { const button=document.createElement('button'); button.textContent=obj.userData.label+(obj.visible?'':' (station hidden)'); button.disabled=!obj.visible; button.classList.toggle('active',selected===obj); button.onclick=()=>selectObject(obj); list.append(button); });
  metrics();
}
function refreshSelect() {
  const select=$('selectedObject'), keep=selected?.userData.id;
  select.replaceChildren(new Option('Select an object',''));
  [...objects.values()].filter(o=>o.visible).sort((a,b)=>a.userData.label.localeCompare(b.userData.label,undefined,{numeric:true})).forEach(o=>select.add(new Option(o.userData.label,o.userData.id)));
  if (keep && objects.get(keep)?.visible) select.value=keep;
}
const selectionBox=new THREE.Box3();
const selectionHelper=new THREE.Box3Helper(selectionBox,'#725b98'); selectionHelper.visible=false; scene.add(selectionHelper);
function clampObject(obj) {
  // Account for the entire rotated/scaled footprint, including chair backs.
  obj.updateMatrixWorld(true);
  const bounds=new THREE.Box3().setFromObject(obj);
  const ex=Math.max(obj.position.x-bounds.min.x,bounds.max.x-obj.position.x);
  const ez=Math.max(obj.position.z-bounds.min.z,bounds.max.z-obj.position.z);
  const z=clamp(obj.position.z,-30.8+ez,30.8-ez);
  const right=z+ez>1?9.3:17.3;
  obj.position.set(clamp(obj.position.x,-17.3+ex,right-ex),obj.userData.type==='decor'?clamp(obj.position.y,0,8):0,z);
  obj.updateMatrixWorld(true);
}
function syncSliders() {
  if (!selected) return;
  const rotation=(THREE.MathUtils.radToDeg(selected.rotation.y)%360+360)%360;
  $('xPos').value=selected.position.x; $('zPos').value=selected.position.z;
  $('rot').value=rotation; $('scale').value=selected.scale.x; $('height').value=selected.position.y;
  $('xValue').textContent=selected.position.x.toFixed(1); $('zValue').textContent=selected.position.z.toFixed(1);
  $('rotValue').textContent=`${Math.round(rotation)}°`; $('scaleValue').textContent=`${Math.round(selected.scale.x*100)}%`; $('heightValue').textContent=selected.position.y.toFixed(2);
}
function selectObject(obj) {
  selected=obj?.visible?obj:null;
  $('selectedObject').value=selected?.userData.id||'';
  $('objectControls').disabled=!selected;
  const isDecor=selected?.userData.type==='decor';
  for(const id of ['height','objectColor','followTheme','duplicateObject','deleteObject']) $(id).disabled=!isDecor;
  $('heightLabel').hidden=!isDecor; $('objectColorLabel').hidden=!isDecor;
  $('deleteObject').hidden=!isDecor; $('followTheme').hidden=!isDecor; $('duplicateObject').hidden=!isDecor;
  labels.forEach((el,o)=>el.classList.toggle('selected',o===selected));
  if (selected) { syncSliders(); $('objectColor').value=selected.userData.color||colors.accent; status(`Selected ${selected.userData.label}. Drag to move, or use the controls.`); }
  selectionHelper.visible=Boolean(selected); renderDecorations();
}
$('selectedObject').onchange=e=>selectObject(objects.get(e.target.value));
function moveAttachedPieces(obj, before) {
  if(obj.userData.type==='decor') return;
  obj.updateMatrixWorld(true);
  const delta=new THREE.Matrix4().multiplyMatrices(obj.matrixWorld,before.clone().invert());
  objects.forEach(piece=> {
    if(piece.userData.anchor===obj.userData.id) {
      piece.applyMatrix4(delta); piece.scale.setScalar(clamp(piece.scale.x,.4,2)); clampObject(piece);
    }
  });
}
for(const [id,action] of Object.entries({
  xPos: n=>selected.position.x=n, zPos:n=>selected.position.z=n,
  rot:n=>selected.rotation.y=THREE.MathUtils.degToRad(n), scale:n=>selected.scale.setScalar(n), height:n=>selected.position.y=n
})) $(id).oninput=e=> {
  if(!selected) return;
  const before=selected.matrixWorld.clone();
  if(selected.userData.type==='decor'&&['xPos','zPos','height'].includes(id)) selected.userData.anchor=null;
  action(Number(e.target.value)); clampObject(selected); moveAttachedPieces(selected,before); syncSliders();
};
$('objectColor').oninput=e=> { if(selected?.userData.type==='decor') replaceDecoration(selected,e.target.value); };
$('followTheme').onclick=()=> { if(selected?.userData.type==='decor') replaceDecoration(selected,null); };
$('duplicateObject').onclick=()=> {
  if(selected?.userData.type!=='decor') return;
  const saved=transform(selected); saved.id=`decor-${crypto.randomUUID()}`; delete saved.label; saved.pos=[saved.pos[0]+2,saved.pos[1],saved.pos[2]+2];
  if([...objects.values()].filter(o=>o.userData.type==='decor').length>=180) { status('Remove a piece before adding another.'); return; }
  selectObject(newDecoration(saved.kind,saved)); status('Decoration duplicated. Drag the new piece into place.');
};
$('deleteObject').onclick=()=> { if(selected?.userData.type==='decor') { removeObject(selected.userData.id); refreshSelect(); renderDecorations(); status('Decoration removed.'); } };
document.querySelectorAll('[data-decor]').forEach(button=>button.onclick=()=>newDecoration(button.dataset.decor));

const raycaster=new THREE.Raycaster(), pointer=new THREE.Vector2();
const dragPlane=new THREE.Plane(new THREE.Vector3(0,1,0),0), dragOffset=new THREE.Vector3(), hitPoint=new THREE.Vector3();
let dragging=null;
function pointerRay(event) {
  const rect=renderer.domElement.getBoundingClientRect();
  pointer.set((event.clientX-rect.left)/rect.width*2-1,-(event.clientY-rect.top)/rect.height*2+1);
  camera.updateMatrixWorld(); scene.updateMatrixWorld(true); raycaster.setFromCamera(pointer,camera);
}
renderer.domElement.addEventListener('pointerdown',event=> {
  if(event.button!==0 || dragging) return;
  pointerRay(event);
  const hits=raycaster.intersectObjects([...objects.values()].filter(o=>o.visible),true);
  if(!hits.length) { selectObject(null); return; }
  let obj=hits[0].object; while(obj.parent && !obj.userData.id) obj=obj.parent;
  if(!obj.userData.id) return;
  selectObject(obj);
  if(!$('moveMode').checked) return;
  dragPlane.constant=-obj.position.y;
  if(!raycaster.ray.intersectPlane(dragPlane,hitPoint)) return;
  event.stopImmediatePropagation(); orbit.enabled=false;
  dragging={obj,pointerId:event.pointerId}; dragOffset.copy(obj.position).sub(hitPoint);
  renderer.domElement.setPointerCapture(event.pointerId); renderer.domElement.style.cursor='grabbing';
},true);
renderer.domElement.addEventListener('pointermove',event=> {
  if(!dragging || event.pointerId!==dragging.pointerId) return;
  event.stopImmediatePropagation(); pointerRay(event);
  if(raycaster.ray.intersectPlane(dragPlane,hitPoint)) {
    const before=dragging.obj.matrixWorld.clone();
    if(dragging.obj.userData.type==='decor') dragging.obj.userData.anchor=null;
    dragging.obj.position.copy(hitPoint).add(dragOffset); clampObject(dragging.obj); moveAttachedPieces(dragging.obj,before); syncSliders();
  }
},true);
function endDrag(event) {
  if(!dragging || event.pointerId!==dragging.pointerId) return;
  event.stopImmediatePropagation();
  status(`${dragging.obj.userData.label} placed.`); dragging=null; orbit.enabled=true; renderer.domElement.style.cursor='';
  if(renderer.domElement.hasPointerCapture(event.pointerId)) renderer.domElement.releasePointerCapture(event.pointerId);
}
for(const event of ['pointerup','pointercancel','lostpointercapture']) renderer.domElement.addEventListener(event,endDrag,true);

function updateColors() {
  for(const [name,color] of Object.entries(colors)) { mats[name].color.set(color); $(`color-${name}`).value=color; }
  for(const name of ['accent','deep','gold']) document.documentElement.style.setProperty(`--${name}`,colors[name]);
  $('swatches').replaceChildren();
  for(const name of ['linen','accent','deep','gold']) { const swatch=document.createElement('span'); swatch.className='swatch'; swatch.style.background=colors[name]; swatch.title=name; $('swatches').append(swatch); }
  mats.gold.metalness=clamp(.35+goldIntensity*.34,0,.96); mats.gold.roughness=clamp(.65-goldIntensity*.3,.1,.6);
}
$('theme').onchange=e=> { themeName=e.target.value; Object.assign(colors,palettes[themeName]); updateColors(); if(selected?.userData.type==='decor'&&!selected.userData.color) $('objectColor').value=colors.accent; status('Palette updated. Your layout has been kept.'); };
for(const name of Object.keys(colors)) $(`color-${name}`).oninput=e=> { colors[name]=e.target.value; updateColors(); };
$('floralIntensity').oninput=e=> { floralIntensity=Number(e.target.value); flowerClusters.forEach(blooms); };
$('goldIntensity').oninput=e=> { goldIntensity=Number(e.target.value); updateColors(); };
$('rebuild').onclick=()=>rebuild();
$('tableCount').onchange=()=>rebuild(); $('guestTarget').onchange=()=>rebuild();
Object.entries(stationDefs).forEach(([checkbox,[id]])=> {
  $(checkbox).onchange=e=> {
    const obj=objects.get(id); obj.visible=e.target.checked;
    objects.forEach(piece=> { if(piece.userData.anchor===id) piece.visible=obj.visible; });
    if(selected&&!selected.visible) selectObject(null);
    refreshSelect(); renderDecorations(); status(`${obj.userData.label} ${obj.visible?'added to':'hidden from'} the room.`);
  };
});
$('wallsToggle').onchange=()=>status($('wallsToggle').checked?'Cutaway walls on. Near walls hide so you can see the room.':'Walls hidden.');
$('moveMode').onchange=()=>status($('moveMode').checked?'Drag pieces to move them. Drag empty space to orbit.':'Orbit only. Drag anywhere to look around.');

function renderGuests() {
  const list=$('guestList'); list.replaceChildren(); const tables=tableObjects();
  guests.forEach((guest,index)=> {
    const row=document.createElement('div'); row.className='guestRow';
    const info=document.createElement('div'), name=document.createElement('div'), side=document.createElement('div');
    name.textContent=guest.name; side.textContent=guest.side; side.className='meta'; info.append(name,side);
    const select=document.createElement('select'); select.setAttribute('aria-label',`Table for ${guest.name}`); select.add(new Option('Unassigned',''));
    tables.forEach(t=> { const used=guests.filter(g=>g.table===t.userData.id).length; const option=new Option(`T${t.userData.id.slice(1)} (${used}/${t.userData.seats})`,t.userData.id); option.disabled=used>=t.userData.seats&&guest.table!==t.userData.id; select.add(option); });
    select.value=guest.table;
    select.onchange=()=> { const t=objects.get(select.value); if(t&&guests.filter(g=>g!==guest&&g.table===select.value).length>=t.userData.seats) { status('That table is full. Choose another table.'); renderGuests(); return; } guest.table=select.value; renderGuests(); };
    const del=document.createElement('button'); del.textContent='×'; del.setAttribute('aria-label',`Remove ${guest.name}`); del.onclick=()=> { guests.splice(index,1); renderGuests(); };
    row.append(info,select,del); list.append(row);
  }); metrics();
}
function addGuest() {
  const name=$('guestName').value.trim(); if(!name) { status('Enter a guest name first.'); return; }
  guests.push({name,side:$('guestSide').value,table:''}); $('guestName').value=''; renderGuests();
}
$('addGuest').onclick=addGuest; $('guestName').onkeydown=e=> { if(e.key==='Enter') addGuest(); };
$('fillDemoGuests').onclick=()=> { if(guests.length) { status('Remove your existing guests before filling demo guests, so no names are lost.'); return; } guests=Array.from({length:Number($('guestTarget').value)},(_,i)=>({name:`Guest ${i+1}`,side:i%3===0?'Friends':i%2?'Bride family':'Groom family',table:''})); renderGuests(); };
function renderShopping() {
  const list=$('shoppingList'); list.replaceChildren(); let total=0;
  shopping.forEach((item,index)=> {
    total+=item.price*item.qty; const row=document.createElement('div'); row.className='shopRow';
    const info=document.createElement('div');
    if(safeUrl(item.url)) { const a=document.createElement('a'); a.href=safeUrl(item.url); a.target='_blank'; a.rel='noopener noreferrer'; a.textContent=item.name; info.append(a); } else info.textContent=item.name;
    const price=document.createElement('div'); price.textContent=`$${item.price.toFixed(2)}`;
    const qty=document.createElement('div'); qty.textContent=`×${item.qty}`;
    const del=document.createElement('button'); del.textContent='×'; del.setAttribute('aria-label',`Remove ${item.name}`); del.onclick=()=> { shopping.splice(index,1); renderShopping(); };
    row.append(info,price,qty,del); list.append(row);
  }); $('budgetTotal').textContent=`$${total.toFixed(2)}`;
}
$('addItem').onclick=()=> {
  const name=$('itemName').value.trim(), price=Number($('itemPrice').value), qty=Number($('itemQty').value), url=$('itemUrl').value.trim();
  if(!name) { status('Enter an item name first.'); return; }
  if(!Number.isFinite(price)||price<0||price>1000000||!Number.isInteger(qty)||qty<1||qty>10000) { status('Use a nonnegative price and a whole quantity of at least 1.'); return; }
  if(url&&!safeUrl(url)) { status('Use a complete product link beginning with https:// or http://.'); return; }
  shopping.push({name,price,qty,url:safeUrl(url)}); $('itemName').value=$('itemPrice').value=$('itemUrl').value=''; $('itemQty').value=1; renderShopping(); status('Item added to the shopping list. Use the decoration library to add pieces to the room.');
};
function metrics() {
  const tables=tableObjects(), seats=tables.reduce((sum,o)=>sum+o.userData.seats,0), assigned=guests.filter(g=>g.table&&objects.has(g.table)).length;
  for(const id of ['seatCount','seatCountSide']) $(id).textContent=seats;
  for(const id of ['tableCountMetric','tableCountSide']) $(id).textContent=tables.length;
  $('assignedCount').textContent=assigned; $('unassignedCount').textContent=Math.max(Number($('guestTarget').value),guests.length)-assigned;
  $('capacity').textContent=`${seats} seats · ${[...objects.values()].filter(o=>o.userData.type==='decor').length} decorations`;
}
function planData() {
  return { version:4,themeName,colors:{...colors},floralIntensity,goldIntensity,guestTarget:Number($('guestTarget').value),tableCount:Number($('tableCount').value),
    guests,shopping,objects:[...objects.values()].map(transform),stations:Object.fromEntries(stationIds.map(id=>[id,objects.get(id)?.visible!==false])),
    display:{walls:$('wallsToggle').checked,labels:$('labelsToggle').checked} };
}
function loadPlan(raw) {
  const data=normalizePlan(raw); // No mutation until validation has succeeded.
  selectObject(null); [...objects.keys()].forEach(removeObject);
  themeName=data.themeName; colors=data.colors; floralIntensity=data.floralIntensity; goldIntensity=data.goldIntensity; guests=data.guests; shopping=data.shopping;
  $('guestTarget').value=data.guestTarget; $('tableCount').value=data.tableCount; $('theme').value=themeName;
  $('floralIntensity').value=floralIntensity; $('goldIntensity').value=goldIntensity; updateColors();
  sweetheart(); Object.values(stationDefs).forEach(args=>station(...args)); rebuild(false);
  data.objects.forEach(saved=> { if(saved.type==='decor') newDecoration(saved.kind,saved); else if(objects.has(saved.id)) restoreTransform(objects.get(saved.id),saved); });
  Object.entries(stationDefs).forEach(([checkbox,[id]])=> { $(checkbox).checked=data.stations[id]; objects.get(id).visible=data.stations[id]; });
  objects.forEach(obj=> { if(obj.userData.anchor) obj.visible=objects.get(obj.userData.anchor)?.visible!==false; });
  $('wallsToggle').checked=data.display.walls; $('labelsToggle').checked=data.display.labels;
  refreshSelect(); renderGuests(); renderShopping(); renderDecorations(); metrics(); status('Saved plan loaded, including decorations, colours and station visibility.');
}
$('saveLocal').onclick=()=>attempt(()=> { localStorage.setItem('montBlancWeddingPlan',JSON.stringify(planData())); status('Your room, decorations and colours are saved in this browser.'); });
$('loadLocal').onclick=()=>attempt(()=> { const saved=localStorage.getItem('montBlancWeddingPlan'); if(!saved) { status('No plan saved in this browser yet. Use Save or import an exported plan.'); return; } loadPlan(JSON.parse(saved)); });
function download(blob,name) {
  const url=URL.createObjectURL(blob), a=document.createElement('a'); a.href=url; a.download=name; a.click(); setTimeout(()=>URL.revokeObjectURL(url),1000);
}
$('downloadPlan').onclick=()=>download(new Blob([JSON.stringify(planData(),null,2)],{type:'application/json'}),'mont-blanc-wedding-plan.json');
$('importPlan').onchange=async e=> {
  const file=e.target.files?.[0]; if(!file) return;
  try { $('errorBanner').hidden=true; if(file.size>2*1024*1024) throw new Error('Choose a wedding plan smaller than 2 MB.'); loadPlan(JSON.parse(await file.text())); }
  catch(error) { showError(`Could not load this plan. ${error.message}`); }
  finally { e.target.value=''; }
};
$('snapshot').onclick=()=> { renderer.render(scene,camera); renderer.domElement.toBlob(blob=> { if(blob) { download(blob,'mont-blanc-wedding-room.png'); status('Room image downloaded.'); } }); };

const viewButtons=['topView','roomView','windowView','guestView1','guestView2','coupleView'];
let autoFit = true, activeView = 'roomView';
orbit.addEventListener('start',()=> { autoFit=false; });
function fitRoom() {
  // Fit the whole room to the available canvas, including a narrow split panel.
  if(activeView==='roomView') camera.position.copy(orbit.target).add(camera.aspect<.85?new THREE.Vector3(0,65,45):new THREE.Vector3(44,49,58));
  camera.lookAt(orbit.target); camera.updateMatrixWorld();
  const direction=camera.position.clone().sub(orbit.target).normalize();
  const right=new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld,0);
  const up=new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld,1);
  const tanY=Math.tan(THREE.MathUtils.degToRad(camera.fov/2))*.9, tanX=tanY*camera.aspect;
  let distance=0;
  for(const x of [-18,18]) for(const y of [0,13]) for(const z of [-32,32]) {
    const offset=new THREE.Vector3(x,y,z).sub(orbit.target), depth=offset.dot(direction);
    distance=Math.max(distance,depth+Math.abs(offset.dot(right))/tanX,depth+Math.abs(offset.dot(up))/tanY);
  }
  camera.position.copy(orbit.target).addScaledVector(direction,distance); orbit.update();
}
function moveCamera(id,pos,target=[-3,1,0]) {
  activeView=id;
  const damping=orbit.enableDamping; orbit.enableDamping=false; orbit.update(); orbit.enableDamping=damping;
  orbit.enabled=true; camera.position.set(...pos); orbit.target.set(...target); orbit.update();
  autoFit=['topView','roomView','windowView'].includes(id); if(autoFit) fitRoom();
  viewButtons.forEach(button=>$(button).classList.toggle('active',button===id));
}
$('roomView').onclick=()=>moveCamera('roomView',[44,49,58]);
$('topView').onclick=()=>moveCamera('topView',[-3,84,.01],[-3,0,0]);
$('windowView').onclick=()=>moveCamera('windowView',[45,27,-11],[-3,1,-5]);
$('guestView1').onclick=()=>moveCamera('guestView1',[-11,5,-21],[1,3,0]);
$('guestView2').onclick=()=>moveCamera('guestView2',[-11,5,14],[2,3,-8]);
$('coupleView').onclick=()=> { const obj=objects.get('sweetheart'); moveCamera('coupleView',[obj.position.x,5,obj.position.z],[-4,3,0]); };
function setSidebar(open, focus = true) {
  $('sidebar').classList.toggle('hidden',!open);
  $('sidebar').inert=!open; $('sidebar').setAttribute('aria-hidden',String(!open));
  $('openSidebar').setAttribute('aria-expanded',String(open));
  if(focus) (open?$('closeSidebar'):$('openSidebar')).focus();
}
$('closeSidebar').onclick=()=>setSidebar(false);
$('openSidebar').onclick=()=>setSidebar(true);
if(window.matchMedia('(max-width:760px)').matches) setSidebar(false,false);
document.querySelectorAll('[data-jump]').forEach(button=>button.onclick=()=> {
  document.querySelectorAll('.navChip').forEach(b=>b.classList.toggle('active',b===button));
  $(button.dataset.jump).scrollIntoView({behavior:window.matchMedia('(prefers-reduced-motion:reduce)').matches?'instant':'smooth',block:'start'});
});
function resize() {
  const rect=viewport.getBoundingClientRect(); if(rect.width<2||rect.height<2) return;
  renderer.setSize(rect.width,rect.height,false); camera.aspect=rect.width/rect.height; camera.updateProjectionMatrix();
  if(autoFit) fitRoom();
}
new ResizeObserver(resize).observe(viewport); resize();
const projected=new THREE.Vector3(), wallOffset=new THREE.Vector3();
function updateSceneOverlays() {
  const rect=viewport.getBoundingClientRect();
  const occupied=[];
  const ordered=[...labels].sort(([a],[b])=>(b===selected?1:0)-(a===selected?1:0));
  ordered.forEach(([obj,el])=> {
    obj.getWorldPosition(projected); projected.y+=obj.userData.type==='decor'?2:4; projected.project(camera);
    const x=(projected.x*.5+.5)*rect.width, y=(-projected.y*.5+.5)*rect.height;
    const width=obj.userData.label.length*6.5+16;
    const overlap=occupied.some(r=>Math.abs(r.x-x)<(r.width+width)/2+4&&Math.abs(r.y-y)<27);
    const visible=obj.visible&&$('labelsToggle').checked&&projected.z>-1&&projected.z<1&&Math.abs(projected.x)<.98&&Math.abs(projected.y)<.94&&!overlap;
    el.style.display=visible?'block':'none';
    if(visible) { occupied.push({x,y,width}); el.style.left=`${x}px`; el.style.top=`${y}px`; el.style.transform='translate(-50%,-50%)'; }
  });
  wallObjects.forEach(obj=> { wallOffset.copy(camera.position).sub(obj.position); obj.visible=$('wallsToggle').checked&&wallOffset.dot(obj.userData.outward)<.1; });
  rightWallDetails.visible=$('wallsToggle').checked&&camera.position.x<17.5;
  if(selected) { selectionBox.setFromObject(selected); selectionBox.expandByScalar(.08); }
}
function animate() { requestAnimationFrame(animate); orbit.update(); updateSceneOverlays(); renderer.render(scene,camera); }
renderer.domElement.addEventListener('webglcontextlost',e=> { e.preventDefault(); showError('The 3D view paused because graphics memory became unavailable. Save or export your plan, then reload to continue.'); });
updateColors(); sweetheart(); Object.values(stationDefs).forEach(args=>station(...args)); rebuild(false);
renderShopping(); renderDecorations(); selectObject(null); metrics(); animate();
status('Your room is ready. Add a decoration or try a colour palette.');
