import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizePlan, seatDistribution, safeUrl, defaultColors } from '../planner-state.js';
const object = (id, extra={}) => ({id,pos:[0,0,0],rot:0,scale:1,...extra});
const legacy = () => ({version:3,tableCount:10,guestTarget:95,themeName:'lavender',objects:[object('t1'),object('sweetheart'),object('photo')],guests:[],shopping:[]});

test('seat distribution supports venue capacity and stays evenly balanced', () => {
  for(const n of [8,9,10]) for(const total of [1,70,95,100,120]) {
    const seats=seatDistribution(n,total);
    assert.equal(seats.length,n); assert.equal(seats.reduce((a,b)=>a+b),total);
    assert.ok(Math.max(...seats)-Math.min(...seats)<=1);
  }
  assert.equal(seatDistribution(100,999).reduce((a,b)=>a+b),120);
});
test('legacy v3 plans infer hidden stations and retain transforms', () => {
  const raw=legacy(); raw.objects[0].pos=[-9,0,-18]; raw.objects[0].rot=.7;
  const plan=normalizePlan(raw);
  assert.equal(plan.stations.photo,true); assert.equal(plan.stations.cake,false);
  assert.deepEqual(plan.objects[0].pos,[-9,0,-18]); assert.equal(plan.objects[0].rot,.7);
  assert.equal(plan.colors.linen,defaultColors.linen);
});
test('v4 survives a JSON round trip with decorations, custom colours and hidden stations', () => {
  const raw={...legacy(),version:4,colors:{accent:'#123456',linen:'#ffeedd'},floralIntensity:0,goldIntensity:1.8,
    stations:{photo:false,cake:true},display:{walls:false,labels:false},
    objects:[object('t1'),object('photo',{pos:[3,0,-5]}),object('decor-abc',{type:'decor',kind:'arch',color:'#ba2f4a',label:'My arch',anchor:null,pos:[-6,0,-12],rot:1,scale:1.4})]};
  const plan=normalizePlan(JSON.parse(JSON.stringify(raw)));
  assert.equal(plan.colors.accent,'#123456'); assert.equal(plan.colors.linen,'#ffeedd');
  assert.equal(plan.stations.photo,false); assert.equal(plan.stations.cake,true);
  assert.equal(plan.floralIntensity,0); assert.equal(plan.goldIntensity,1.8);
  assert.deepEqual(plan.display,{walls:false,labels:false});
  assert.deepEqual(plan.objects[2],raw.objects[2]);
  assert.deepEqual(normalizePlan(JSON.parse(JSON.stringify(plan))),plan);
});
test('rejects malformed plans before any caller state can be changed', () => {
  for(const raw of [null,[],{}, {version:4,objects:[]},{...legacy(),version:99},
    {...legacy(),objects:[object('t1'),object('t1')]},
    {...legacy(),objects:[object('t1',{pos:[NaN,0,1]})]},
    {...legacy(),objects:[object('t1'),object('decor-x',{type:'decor',kind:'unknown'})]}]) {
    assert.throws(()=>normalizePlan(raw));
  }
});
test('normalization does not mutate the input document', () => {
  const raw=legacy(); raw.guests=[{name:'Liza',side:'Friends',table:'t10'}];
  const before=JSON.stringify(raw); normalizePlan(raw); assert.equal(JSON.stringify(raw),before);
});
test('removed tables and overbooked tables leave guests unassigned', () => {
  const raw={...legacy(),tableCount:8,guestTarget:8,guests:[
    {name:'First',side:'Friends',table:'t1'}, {name:'Overflow',side:'Friends',table:'t1'},
    {name:'Removed',side:'Bride family',table:'t10'}]};
  assert.deepEqual(normalizePlan(raw).guests.map(g=>g.table),['t1','','']);
});
test('limits imported numbers and accepts only valid CSS hex colours', () => {
  const raw={...legacy(),themeName:'__proto__',colors:{accent:'red;display:none',gold:'#ffffff'},
    floralIntensity:-100,goldIntensity:99,tableCount:999,guestTarget:999,
    objects:[object('t1',{scale:Infinity}),object('decor-x',{type:'decor',kind:'flowers',color:'bad',pos:[999,-99,-999],scale:99})]};
  const plan=normalizePlan(raw);
  assert.equal(plan.themeName,'lavender'); assert.equal(plan.colors.accent,'#a78cc7'); assert.equal(plan.colors.gold,'#ffffff');
  assert.equal(plan.tableCount,10); assert.equal(plan.guestTarget,120); assert.equal(plan.floralIntensity,0); assert.equal(plan.goldIntensity,1.8);
  assert.equal(plan.objects[0].scale,1); assert.equal(plan.objects[1].color,null); assert.deepEqual(plan.objects[1].pos,[17,0,-30]);
});
test('product links reject executable and non-web protocols', () => {
  for(const url of ['javascript:alert(1)','data:text/html,hello','file:///private','not a url','']) assert.equal(safeUrl(url),'');
  assert.equal(safeUrl('https://example.com/vase'),'https://example.com/vase');
  const raw={...legacy(),shopping:[{name:'Vase',price:-4,qty:-2,url:'javascript:alert(1)'}]};
  assert.deepEqual(normalizePlan(raw).shopping,[{name:'Vase',price:0,qty:1,url:''}]);
});
test('rejects oversized object arrays', () => {
  const raw=legacy(); raw.objects.push(...Array.from({length:201},(_,i)=>object(`decor-${i}`,{type:'decor',kind:'candles'})));
  assert.throws(()=>normalizePlan(raw),/too large/);
});
test('tabletop attachment survives export and rejects missing furniture', () => {
  const raw=legacy();
  raw.objects.push(object('decor-candle',{type:'decor',kind:'candles',anchor:'t1'}));
  assert.equal(normalizePlan(raw).objects.at(-1).anchor,'t1');
  raw.objects.at(-1).anchor='unknown';
  assert.equal(normalizePlan(raw).objects.at(-1).anchor,null);
  raw.tableCount=8; raw.objects.at(-1).anchor='t10';
  assert.equal(normalizePlan(raw).objects.at(-1).anchor,null);
});
