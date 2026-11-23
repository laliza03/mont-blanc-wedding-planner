import test from 'node:test';
import assert from 'node:assert/strict';
import {themePresets,validateThemeSuggestions,scopedThemeColors,shuffleTheme,colorRoles} from '../theme-engine.js';
import {normalizePlan} from '../planner-state.js';
const fixture=()=>({...structuredClone(themePresets[0]),tips:['Use ivory linens.']});
test('all ready-made palettes have complete, valid colour roles',()=> {
  assert.equal(themePresets.length,8);
  for(const preset of themePresets) assert.equal(validateThemeSuggestions({themes:[preset]})[0].name,preset.name);
});
test('AI palettes reject incomplete and malformed results without mutating input',()=> {
  for(const value of [null,{}, {themes:[]},{themes:Array(4).fill(fixture())},{themes:[{...fixture(),colors:{accent:'#ffffff'}}]},
    {themes:[{...fixture(),goldIntensity:100}]},{themes:[{...fixture(),tips:['x'.repeat(241)]}]}]) assert.throws(()=>validateThemeSuggestions(value));
  const value={themes:[fixture()]}, before=structuredClone(value); validateThemeSuggestions(value); assert.deepEqual(value,before);
});
test('decoration-only scope preserves venue surfaces',()=> {
  const current=themePresets[0].colors, proposed=themePresets[3].colors;
  const decor=scopedThemeColors(current,proposed);
  for(const role of ['walls','floor','dance']) assert.equal(decor[role],current[role]);
  for(const role of ['accent','deep','gold','linen','chairs']) assert.equal(decor[role],proposed[role]);
  assert.deepEqual(scopedThemeColors(current,proposed,true),proposed);
});
test('shuffling rotates colour placement and preserves metal and architecture',()=> {
  const original=fixture(), shuffled=shuffleTheme(original);
  assert.equal(shuffled.colors.accent,original.colors.deep); assert.equal(shuffled.colors.linen,original.colors.accent);
  for(const role of ['gold','floor','walls','dance']) assert.equal(shuffled.colors[role],original.colors[role]);
  assert.notDeepEqual(original.colors,shuffled.colors);
});
test('AI theme names and exact colours survive plan export and reload',()=> {
  const theme=fixture();
  const plan=normalizePlan({version:4,themeName:'custom',themeLabel:'AI moonlit garden',colors:theme.colors,tableCount:10,guestTarget:95,objects:[{id:'t1',pos:[0,0,0],rot:0,scale:1}]});
  const restored=normalizePlan(JSON.parse(JSON.stringify(plan)));
  assert.equal(restored.themeName,'custom'); assert.equal(restored.themeLabel,'AI moonlit garden');
  for(const role of colorRoles) assert.equal(restored.colors[role],theme.colors[role]);
});
