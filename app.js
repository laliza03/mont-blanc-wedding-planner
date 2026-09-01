import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";

const $ = id => document.getElementById(id);
const viewport = $("viewport");
const statusEl = $("status");
const errorBanner = $("errorBanner");

window.addEventListener("error", e => showError(e.message));
window.addEventListener("unhandledrejection", e => showError(e.reason?.message || String(e.reason)));
function showError(message){
  if(!errorBanner) return;
  errorBanner.hidden = false;
  errorBanner.textContent = `The 3D planner hit an error: ${message}. Refresh the page after the latest deployment finishes.`;
}

const scene = new THREE.Scene();
scene.background = new THREE.Color(0xeeeae6);
scene.fog = new THREE.Fog(0xeeeae6, 70, 135);

const camera = new THREE.PerspectiveCamera(45, 1, .1, 220);
camera.position.set(38, 35, 42);

const renderer = new THREE.WebGLRenderer({ antialias:true, alpha:false });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.domElement.tabIndex = 0;
viewport.appendChild(renderer.domElement);

const orbit = new OrbitControls(camera, renderer.domElement);
orbit.enableDamping = true;
orbit.dampingFactor = .08;
orbit.target.set(0, 1.5, 0);
orbit.minDistance = 12;
orbit.maxDistance = 95;
orbit.maxPolarAngle = Math.PI * .49;

const palettes = {
  lavender:{accent:0xa78cc7,deep:0x725b98,gold:0xcaa85f},
  amethyst:{accent:0x9175bd,deep:0x624886,gold:0xd0ad63},
  sage:{accent:0x9eae96,deep:0x68775f,gold:0xcaa85f},
  blush:{accent:0xd0a9b5,deep:0x9e7682,gold:0xcaa85f},
  blue:{accent:0x9eb2cc,deep:0x697d99,gold:0xcaa85f}
};
let themeName = "lavender";
let theme = palettes[themeName];
let floralIntensity = .35;
let goldIntensity = 1.25;
let selected = null;
let guests = [];
let shopping = [];

const ivoryMat = new THREE.MeshStandardMaterial({color:0xf8f5ef,roughness:.82});
const wallMat = new THREE.MeshStandardMaterial({color:0xf7f4ef,roughness:.9,transparent:true,opacity:.9,side:THREE.DoubleSide});
const floorMat = new THREE.MeshStandardMaterial({color:0x332f2e,roughness:.66});
const danceMat = new THREE.MeshStandardMaterial({color:0x6a625e,roughness:.52});
const silverMat = new THREE.MeshStandardMaterial({color:0xc8ccd0,metalness:.72,roughness:.22});
const glassMat = new THREE.MeshStandardMaterial({color:0xbddcec,transparent:true,opacity:.32,roughness:.08});
const accentMat = new THREE.MeshStandardMaterial({color:theme.accent,roughness:.7});
const deepMat = new THREE.MeshStandardMaterial({color:theme.deep,roughness:.72});
const goldMat = new THREE.MeshStandardMaterial({color:theme.gold,metalness:.75,roughness:.22});

scene.add(new THREE.HemisphereLight(0xfffbf5, 0x554c48, 2.25));
const key = new THREE.DirectionalLight(0xffe7c7, 2.65);
key.position.set(-18, 28, 10); key.castShadow = true; key.shadow.mapSize.set(2048,2048); scene.add(key);
const fill = new THREE.DirectionalLight(0xdce9ff, 1.0); fill.position.set(25,16,-20); scene.add(fill);

const room = new THREE.Group(); scene.add(room);
const walls = [];
const fixedObjects = [];
const objects = new Map();
const labels = new Map();

// Supplied Mont-Blanc floor plan: 35' max width x 62' length, with 8' right-side recess on upper half.
const roomShape = new THREE.Shape();
roomShape.moveTo(-17.5,-31);
roomShape.lineTo(17.5,-31);
roomShape.lineTo(17.5,1);
roomShape.lineTo(9.5,1);
roomShape.lineTo(9.5,31);
roomShape.lineTo(-17.5,31);
roomShape.closePath();
const floor = new THREE.Mesh(new THREE.ShapeGeometry(roomShape), floorMat);
floor.rotation.x = -Math.PI/2; floor.receiveShadow = true; room.add(floor);

const danceShape = new THREE.Shape();
danceShape.moveTo(-5.9,-20); danceShape.lineTo(5.1,-20); danceShape.lineTo(5.1,22);
danceShape.lineTo(-5.9,22); danceShape.closePath();
const danceFloor = new THREE.Mesh(new THREE.ShapeGeometry(danceShape), danceMat);
danceFloor.rotation.x=-Math.PI/2; danceFloor.position.y=.035; room.add(danceFloor);

function addWall(w,h,d,x,z){
  const m = new THREE.Mesh(new THREE.BoxGeometry(w,h,d), wallMat);
  m.position.set(x,h/2,z); m.castShadow=true; room.add(m); walls.push(m);
}
addWall(35,12.5,.18,0,-31);
addWall(27,12.5,.18,-4,31);
addWall(.18,12.5,37,-17.5,-12.5);
addWall(.18,12.5,20,-17.5,21);
addWall(.18,12.5,32,17.5,-15);
addWall(.18,12.5,30,9.5,16);
addWall(8,12.5,.18,13.5,1);

// Window-side visual markers on the long right wall.
for(let z=-26; z<=-5; z+=7){
  const win = new THREE.Mesh(new THREE.BoxGeometry(.1,6.7,5.4), glassMat);
  win.position.set(17.39,6.2,z); room.add(win); fixedObjects.push(win);
  const curtain = new THREE.Mesh(new THREE.BoxGeometry(.16,7.6,.45), ivoryMat);
  curtain.position.set(17.25,6,-z%2?z-.1:z+.1); room.add(curtain);
}

// Entry recess and emergency-exit cues.
const exit = new THREE.Mesh(new THREE.BoxGeometry(.12,2.1,3.6), new THREE.MeshStandardMaterial({color:0xc94d4d}));
exit.position.set(-17.37,2.2,8.2); room.add(exit);
function door(x,z,rot=0,w=2.6){ const d=new THREE.Mesh(new THREE.BoxGeometry(w,6.8,.12),new THREE.MeshStandardMaterial({color:0xd9d2c9})); d.position.set(x,3.4,z); d.rotation.y=rot; room.add(d); }
door(13.1,1.08); door(15.8,1.08); door(9.42,6.3,Math.PI/2,2.8);

function chandelier(x,z){
  const g=new THREE.Group();
  const ring=new THREE.Mesh(new THREE.TorusGeometry(2.15,.055,12,48),goldMat); ring.rotation.x=Math.PI/2; g.add(ring);
  for(let i=0;i<10;i++){
    const a=i/10*Math.PI*2;
    const bulb=new THREE.Mesh(new THREE.SphereGeometry(.11,10,8),new THREE.MeshStandardMaterial({color:0xffe0aa,emissive:0xffc56b,emissiveIntensity:2}));
    bulb.position.set(Math.cos(a)*1.9,-.05,Math.sin(a)*1.9); g.add(bulb);
  }
  g.position.set(x,10.8,z); scene.add(g);
}
chandelier(-2,-15); chandelier(-2,15);

function makeLabel(text,obj){
  const el=document.createElement("div"); el.className="sceneLabel"; el.textContent=text;
  Object.assign(el.style,{position:"absolute",fontSize:"10px",background:"rgba(255,255,255,.9)",padding:"4px 7px",borderRadius:"999px",border:"1px solid rgba(80,60,90,.12)",boxShadow:"0 3px 8px rgba(0,0,0,.06)",pointerEvents:"none",whiteSpace:"nowrap",zIndex:"5"});
  viewport.appendChild(el); labels.set(obj,el);
}
function register(id,label,obj,type){
  obj.userData={id,label,type}; scene.add(obj); objects.set(id,obj); makeLabel(label,obj); return obj;
}
function removeObject(id){
  const o=objects.get(id); if(!o)return;
  scene.remove(o); labels.get(o)?.remove(); labels.delete(o); objects.delete(id); if(selected===o)selected=null;
}

function chair(){
  const g=new THREE.Group();
  const seat=new THREE.Mesh(new THREE.BoxGeometry(.92,.22,.9),ivoryMat); seat.position.y=.62;
  const back=new THREE.Mesh(new THREE.BoxGeometry(.94,1.52,.18),ivoryMat); back.position.set(0,1.35,.34);
  const skirt=new THREE.Mesh(new THREE.CylinderGeometry(.62,.72,1.15,18,1,true),ivoryMat); skirt.position.y=.28;
  g.add(seat,back,skirt); return g;
}
function flowers(scale=1){
  const g=new THREE.Group(); const n=Math.max(3,Math.round(4+floralIntensity*8));
  for(let i=0;i<n;i++){
    const c=i%4===0?theme.deep:(i%2===0?theme.accent:0xf2eee7);
    const m=new THREE.Mesh(new THREE.SphereGeometry(.26,10,8),new THREE.MeshStandardMaterial({color:c,roughness:.8}));
    const a=i/n*Math.PI*2,r=.28+(i%3)*.15; m.position.set(Math.cos(a)*r,(i%2)*.18,Math.sin(a)*r); g.add(m);
  }
  g.scale.setScalar(scale); return g;
}
function roundTable(id,x,z,seats){
  const g=new THREE.Group();
  const top=new THREE.Mesh(new THREE.CylinderGeometry(3.0,3.0,.18,48),ivoryMat); top.position.y=2.35; top.castShadow=true;
  const base=new THREE.Mesh(new THREE.CylinderGeometry(.28,.5,2.2,20),ivoryMat); base.position.y=1.15;
  const runner=new THREE.Mesh(new THREE.BoxGeometry(5.15,.035,.9),accentMat); runner.position.y=2.46;
  const vase=new THREE.Mesh(new THREE.CylinderGeometry(.3,.42,.62,18),goldMat); vase.position.y=2.79;
  g.add(top,base,runner,vase);
  const f=flowers(.9); f.position.y=3.2; g.add(f);
  for(let i=0;i<seats;i++){
    const a=i/seats*Math.PI*2; const c=chair(); c.position.set(Math.cos(a)*4.0,0,Math.sin(a)*4.0); c.rotation.y=-a+Math.PI/2; g.add(c);
    const plate=new THREE.Mesh(new THREE.CylinderGeometry(.34,.34,.03,18),ivoryMat); plate.rotation.x=Math.PI/2; plate.position.set(Math.cos(a)*2.38,2.48,Math.sin(a)*2.38); g.add(plate);
    const fork=new THREE.Mesh(new THREE.BoxGeometry(.04,.025,.52),silverMat); fork.position.set(Math.cos(a)*2.65,2.5,Math.sin(a)*2.65); fork.rotation.y=-a; g.add(fork);
  }
  g.position.set(x,0,z); g.userData.seats=seats; return register(id,`Table ${id.slice(1)} · ${seats}`,g,"table");
}
function station(id,label,x,z,w=5.5,d=2.2){
  const g=new THREE.Group();
  const box=new THREE.Mesh(new THREE.BoxGeometry(w,2.2,d),ivoryMat); box.position.y=1.1; box.castShadow=true;
  const accent=new THREE.Mesh(new THREE.BoxGeometry(w*.28,.06,d+.08),accentMat); accent.position.set(w*.32,2.24,0); g.add(box,accent);
  g.position.set(x,0,z); return register(id,label,g,"station");
}
function sweetheart(){
  const g=new THREE.Group();
  const tableTop=new THREE.Mesh(new THREE.BoxGeometry(7.4,.22,2.7),ivoryMat); tableTop.position.y=2.3;
  const front=new THREE.Mesh(new THREE.BoxGeometry(7.4,2.15,.18),ivoryMat); front.position.set(0,1.1,1.25);
  const runner=new THREE.Mesh(new THREE.BoxGeometry(2.1,.04,2.78),accentMat); runner.position.y=2.43;
  const arch=new THREE.Mesh(new THREE.TorusGeometry(3.2,.075,12,64,Math.PI),goldMat); arch.rotation.z=Math.PI; arch.position.set(0,5.1,.65);
  const f=flowers(1.3); f.position.set(-2.15,5.3,.65);
  g.add(tableTop,front,runner,arch,f); g.position.set(12.5,0,-13.5); return register("sweetheart","Bride & Groom",g,"station");
}

const defaultTablePos=[[-12,-23],[-3.5,-24],[6.8,-23],[-12,-9],[7.2,-8],[-12,7],[7,7],[-12,22],[-4,24],[5.2,22]];
const stationDefs={
  photoBooth:["photo","Photo booth",-12,28,6.2,2.7],
  polaroid:["polaroid","Polaroid scrapbook",5.5,27,5.3,2.2],
  video:["video","Video messages",5.5,15.2,4.7,2.1],
  advice:["advice","Advice jar",5.8,10.2,4.1,2],
  cake:["cake","Cake / sweets",-13,15.5,5.8,2.3],
  dj:["dj","DJ",-13,-28,5.7,2.3]
};

function distribution(){
  const n=Math.max(8,Math.min(10,+$("tableCount").value||10));
  const total=Math.max(70,Math.min(100,+$("guestTarget").value||95));
  const base=Math.floor(total/n), extra=total%n;
  return Array.from({length:n},(_,i)=>base+(i<extra?1:0));
}
function rebuild(){
  [...objects].filter(([,o])=>o.userData.type==="table").forEach(([id])=>removeObject(id));
  const d=distribution();
  d.forEach((seats,i)=>roundTable(`t${i+1}`,defaultTablePos[i][0],defaultTablePos[i][1],seats));
  $("seatDistribution").textContent=d.map((s,i)=>`T${i+1}: ${s}`).join("  ·  ");
  refreshSelect(); metrics(); renderGuests();
  statusEl.textContent=`Layout rebuilt: ${d.reduce((a,b)=>a+b,0)} seats across ${d.length} tables.`;
}

sweetheart();
Object.values(stationDefs).forEach(v=>station(...v));
rebuild();

function refreshSelect(){
  const select=$("selectedObject"); const keep=selected?.userData.id || "";
  select.innerHTML='<option value="">Select a table or station</option>';
  [...objects.values()].sort((a,b)=>a.userData.label.localeCompare(b.userData.label)).forEach(o=>{
    const op=document.createElement("option"); op.value=o.userData.id; op.textContent=o.userData.label; select.appendChild(op);
  });
  if(keep&&objects.has(keep))select.value=keep;
}
refreshSelect();

function roomXLimit(z){ return z>1?8.2:16.2; }
function clampSelected(){ if(!selected)return; selected.position.z=Math.max(-29,Math.min(29,selected.position.z)); selected.position.x=Math.max(-16,Math.min(roomXLimit(selected.position.z),selected.position.x)); }
function syncSliders(){ if(!selected)return; $("xPos").value=selected.position.x; $("zPos").value=selected.position.z; $("rot").value=(THREE.MathUtils.radToDeg(selected.rotation.y)%360+360)%360; $("scale").value=selected.scale.x; }
function selectObject(o){
  selected=o||null;
  if(!selected){$("selectedObject").value=""; return;}
  $("selectedObject").value=selected.userData.id; syncSliders();
  statusEl.textContent=`Selected ${selected.userData.label}. Use the position sliders to place it.`;
}

const raycaster=new THREE.Raycaster(), pointer=new THREE.Vector2();
renderer.domElement.addEventListener("pointerdown",e=>{
  const r=renderer.domElement.getBoundingClientRect();
  pointer.x=(e.clientX-r.left)/r.width*2-1; pointer.y=-(e.clientY-r.top)/r.height*2+1;
  raycaster.setFromCamera(pointer,camera);
  const hits=raycaster.intersectObjects([...objects.values()],true);
  if(!hits.length)return;
  let o=hits[0].object;
  while(o.parent&&!o.userData.id)o=o.parent;
  if(o.userData.id)selectObject(o);
});

$("selectedObject").addEventListener("change",e=>selectObject(objects.get(e.target.value)));
$("xPos").addEventListener("input",e=>{if(selected){selected.position.x=+e.target.value;clampSelected();syncSliders();}});
$("zPos").addEventListener("input",e=>{if(selected){selected.position.z=+e.target.value;clampSelected();syncSliders();}});
$("rot").addEventListener("input",e=>{if(selected)selected.rotation.y=THREE.MathUtils.degToRad(+e.target.value)});
$("scale").addEventListener("input",e=>{if(selected)selected.scale.setScalar(+e.target.value)});
$("rebuild").addEventListener("click",rebuild);
$("tableCount").addEventListener("change",rebuild);
$("guestTarget").addEventListener("change",rebuild);

function applyTheme(name){
  themeName=name; theme=palettes[name]; accentMat.color.set(theme.accent); deepMat.color.set(theme.deep); goldMat.color.set(theme.gold);
  document.documentElement.style.setProperty("--accent",`#${theme.accent.toString(16).padStart(6,"0")}`);
  document.documentElement.style.setProperty("--deep",`#${theme.deep.toString(16).padStart(6,"0")}`);
  document.documentElement.style.setProperty("--gold",`#${theme.gold.toString(16).padStart(6,"0")}`);
  $("swatches").innerHTML=`<span class="swatch" style="background:#faf7ef"></span><span class="swatch" style="background:#${theme.accent.toString(16).padStart(6,"0")}"></span><span class="swatch" style="background:#${theme.deep.toString(16).padStart(6,"0")}"></span><span class="swatch" style="background:#${theme.gold.toString(16).padStart(6,"0")}"></span>`;
  rebuild();
}
$("theme").addEventListener("change",e=>applyTheme(e.target.value));
$("floralIntensity").addEventListener("change",e=>{floralIntensity=+e.target.value;rebuild();});
$("goldIntensity").addEventListener("input",e=>{goldIntensity=+e.target.value;goldMat.metalness=Math.min(.96,.45+goldIntensity*.3);});
applyTheme("lavender");

Object.entries(stationDefs).forEach(([boxId,def])=>{
  $(boxId).addEventListener("change",e=>{
    if(e.target.checked&&!objects.has(def[0]))station(...def);
    if(!e.target.checked)removeObject(def[0]);
    refreshSelect();
  });
});

$("wallsToggle").addEventListener("change",e=>walls.forEach(w=>w.visible=e.target.checked));
$("labelsToggle").addEventListener("change",e=>labels.forEach(l=>l.style.display=e.target.checked?"block":"none"));

function esc(s){return String(s).replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[m]));}
function tableObjects(){return [...objects.values()].filter(o=>o.userData.type==="table");}
function renderGuests(){
  const list=$("guestList"); list.innerHTML=""; const tables=tableObjects();
  guests.forEach((g,i)=>{
    const row=document.createElement("div"); row.className="guestRow";
    const info=document.createElement("div"); info.innerHTML=`<div>${esc(g.name)}</div><div class="meta">${esc(g.side)}</div>`;
    const sel=document.createElement("select"); sel.innerHTML='<option value="">Unassigned</option>'+tables.map(t=>`<option value="${t.userData.id}">${t.userData.label.split(" · ")[0]}</option>`).join(""); sel.value=g.table||""; sel.onchange=()=>{g.table=sel.value;metrics()};
    const del=document.createElement("button"); del.textContent="×"; del.onclick=()=>{guests.splice(i,1);renderGuests();metrics()};
    row.append(info,sel,del); list.appendChild(row);
  }); metrics();
}
$("addGuest").addEventListener("click",()=>{const name=$("guestName").value.trim();if(!name)return;guests.push({name,side:$("guestSide").value,table:""});$("guestName").value="";renderGuests();});
$("fillDemoGuests").addEventListener("click",()=>{guests=Array.from({length:95},(_,i)=>({name:`Guest ${i+1}`,side:i%3===0?"Friends":i%2?"Bride family":"Groom family",table:""}));renderGuests();});

function renderShopping(){
  const list=$("shoppingList"); list.innerHTML=""; let total=0;
  shopping.forEach((it,i)=>{total+=it.price*it.qty;const row=document.createElement("div");row.className="shopRow";const info=document.createElement("div");info.innerHTML=it.url?`<a href="${esc(it.url)}" target="_blank" rel="noopener">${esc(it.name)}</a>`:esc(it.name);const p=document.createElement("div");p.textContent=`$${it.price.toFixed(2)}`;const q=document.createElement("div");q.textContent=`×${it.qty}`;const del=document.createElement("button");del.textContent="×";del.onclick=()=>{shopping.splice(i,1);renderShopping()};row.append(info,p,q,del);list.appendChild(row);});
  $("budgetTotal").textContent=`$${total.toFixed(2)}`;
}
$("addItem").addEventListener("click",()=>{const name=$("itemName").value.trim();if(!name)return;shopping.push({name,price:+$("itemPrice").value||0,qty:+$("itemQty").value||1,url:$("itemUrl").value.trim()});$("itemName").value=$("itemPrice").value=$("itemUrl").value="";$("itemQty").value=1;renderShopping();});

function metrics(){
  const seats=distribution().reduce((a,b)=>a+b,0), assigned=guests.filter(g=>g.table).length, tables=distribution().length;
  $("assignedCount").textContent=assigned; $("unassignedCount").textContent=Math.max(0,(+$("guestTarget").value||95)-assigned); $("seatCount").textContent=seats; $("tableCountMetric").textContent=tables; $("capacity").textContent=`${seats} seats`; $("seatCountSide").textContent=seats; $("tableCountSide").textContent=tables;
}

function planData(){return {version:3,themeName,floralIntensity,goldIntensity,guestTarget:+$("guestTarget").value,tableCount:+$("tableCount").value,guests,shopping,objects:[...objects.values()].map(o=>({id:o.userData.id,pos:o.position.toArray(),rot:o.rotation.y,scale:o.scale.x}))};}
function loadPlan(data){
  if(!data)return; $("guestTarget").value=data.guestTarget||95; $("tableCount").value=data.tableCount||10; floralIntensity=data.floralIntensity??.35; goldIntensity=data.goldIntensity??1.25; $("floralIntensity").value=floralIntensity; $("goldIntensity").value=goldIntensity; guests=data.guests||[]; shopping=data.shopping||[]; $("theme").value=data.themeName||"lavender"; applyTheme($("theme").value);
  (data.objects||[]).forEach(s=>{const o=objects.get(s.id);if(o){o.position.fromArray(s.pos);o.rotation.y=s.rot||0;o.scale.setScalar(s.scale||1);}}); renderGuests();renderShopping();metrics();statusEl.textContent="Saved plan loaded.";
}
$("saveLocal").addEventListener("click",()=>{localStorage.setItem("montBlancWeddingPlan",JSON.stringify(planData()));statusEl.textContent="Plan saved in this browser.";});
$("loadLocal").addEventListener("click",()=>loadPlan(JSON.parse(localStorage.getItem("montBlancWeddingPlan")||"null")));
$("downloadPlan").addEventListener("click",()=>{const blob=new Blob([JSON.stringify(planData(),null,2)],{type:"application/json"});const a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download="mont-blanc-wedding-plan.json";a.click();URL.revokeObjectURL(a.href);});
$("importPlan").addEventListener("change",async e=>{const file=e.target.files?.[0];if(file)loadPlan(JSON.parse(await file.text()));});

function moveCamera(pos,target=[0,1.5,0]){camera.position.set(...pos);orbit.target.set(...target);orbit.update();}
const viewButtons=["topView","roomView","windowView","guestView1","guestView2","coupleView"];
function markView(id){viewButtons.forEach(v=>$(v).classList.toggle("active",v===id));}
$("topView").onclick=()=>{moveCamera([0,72,0],[0,0,0]);markView("topView")};
$("roomView").onclick=()=>{moveCamera([38,35,42]);markView("roomView")};
$("windowView").onclick=()=>{moveCamera([44,12,-11],[0,2,-5]);markView("windowView")};
$("guestView1").onclick=()=>{moveCamera([-11,5,-22],[0,2,2]);markView("guestView1")};
$("guestView2").onclick=()=>{moveCamera([-12,5,14],[2,2,-8]);markView("guestView2")};
$("coupleView").onclick=()=>{moveCamera([12,5,-12],[-2,2,4]);markView("coupleView")};

$("closeSidebar").onclick=()=>$("sidebar").classList.add("hidden");
$("openSidebar").onclick=()=>$("sidebar").classList.remove("hidden");
document.querySelectorAll("[data-jump]").forEach(btn=>btn.onclick=()=>{document.querySelectorAll(".navChip").forEach(b=>b.classList.remove("active"));btn.classList.add("active");$(btn.dataset.jump).scrollIntoView({behavior:"smooth",block:"start"});});

function resize(){const r=viewport.getBoundingClientRect();if(r.width<2||r.height<2)return;renderer.setSize(r.width,r.height,false);camera.aspect=r.width/r.height;camera.updateProjectionMatrix();}
new ResizeObserver(resize).observe(viewport); resize();

function updateLabels(){
  const v=new THREE.Vector3(); const rect=viewport.getBoundingClientRect();
  labels.forEach((el,obj)=>{if(!obj.visible)return;obj.getWorldPosition(v);v.y+=4;v.project(camera);const visible=v.z<1&&Math.abs(v.x)<1.2&&Math.abs(v.y)<1.2;el.style.display=visible&&$("labelsToggle").checked?"block":"none";if(visible){el.style.left=`${(v.x*.5+.5)*rect.width}px`;el.style.top=`${(-v.y*.5+.5)*rect.height}px`;el.style.transform="translate(-50%,-50%)";}});
}
function animate(){requestAnimationFrame(animate);orbit.update();updateLabels();renderer.render(scene,camera);} animate();

renderGuests();renderShopping();metrics();
statusEl.textContent="3D room ready. Click a table or station to select it.";
