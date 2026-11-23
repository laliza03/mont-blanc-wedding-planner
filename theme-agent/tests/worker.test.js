import test from 'node:test';
import assert from 'node:assert/strict';
import worker,{suggestThemes} from '../worker/index.js';
const colors={accent:'#a78cc7',deep:'#725b98',gold:'#caa85f',linen:'#f8f5ef',chairs:'#f8f5ef',walls:'#f7f4ef',floor:'#332f2e',dance:'#80746c'};
const themes=()=>Array.from({length:3},(_,i)=>({name:`Fixture theme ${i+1}`,description:'Test palette',colors:{...colors},floralIntensity:.45,goldIntensity:1.25,tips:['Use ivory linens.']}));
const env={OPENAI_API_KEY:'test-only-not-a-real-key'};
function request(body={prompt:'A romantic lavender garden',colors},headers={}) {return new Request('https://example.chatgpt.site/api/themes',{method:'POST',headers:{'Content-Type':'application/json','Origin':'https://example.chatgpt.site','oai-authenticated-user-id':'test-owner',...headers},body:JSON.stringify(body)});}
const upstream=data=>Response.json({status:'completed',output:[{type:'message',content:[{type:'output_text',text:JSON.stringify(data)}]}]});
test('rejects unauthenticated and cross-origin calls before invoking AI',async()=> {
  let calls=0; const mock=async()=>{calls++;return upstream({themes:themes()});};
  const unauth=request(); unauth.headers.delete('oai-authenticated-user-id');
  assert.equal((await suggestThemes(unauth,env,mock)).status,401);
  assert.equal((await suggestThemes(request(undefined,{Origin:'https://attacker.example'}),env,mock)).status,403);
  assert.equal(calls,0);
});
test('missing API secret reports setup required, without fake suggestions',async()=> {
  const response=await suggestThemes(request(),{});
  assert.equal(response.status,503); const data=await response.json(); assert.equal(data.code,'setup_required'); assert.equal(data.themes,undefined);
});
test('only prompt, colours and prior theme names go to OpenAI',async()=> {
  let sent;
  const response=await suggestThemes(request({prompt:'Garden wedding',colors,previousNames:['Previous'],guests:[{name:'Private guest'}],shopping:[{price:900}],model:'untrusted'}),env,async(url,init)=> {
    assert.equal(url,'https://api.openai.com/v1/responses'); sent=JSON.parse(init.body); return upstream({themes:themes()});
  });
  assert.equal(response.status,200); assert.equal(sent.model,'gpt-5-mini'); assert.equal(sent.store,false); assert.equal(sent.text.format.strict,true);
  const input=JSON.parse(sent.input); assert.deepEqual(Object.keys(input).sort(),['avoidRepeating','currentColors','request']);
  assert.ok(!JSON.stringify(sent).includes('Private guest')); assert.equal((await response.json()).themes.length,3);
});
test('invalid and oversized prompts do not call the model',async()=> {
  let calls=0; const mock=async()=>{calls++;return upstream({themes:themes()});};
  for(const prompt of ['', 'x', 'x'.repeat(1501)]) assert.equal((await suggestThemes(request({prompt}),env,mock)).status,400);
  assert.equal((await suggestThemes(request({prompt:'hello',padding:'x'.repeat(13000)}),env,mock)).status,400); assert.equal(calls,0);
});
test('provider failures and malformed outputs never become palette changes',async()=> {
  assert.equal((await suggestThemes(request(),env,async()=>new Response('private upstream details',{status:401}))).status,502);
  const malformed=themes();malformed[0].colors.accent='javascript:alert(1)';
  assert.equal((await suggestThemes(request(),env,async()=>upstream({themes:malformed}))).status,502);
  const incomplete=await suggestThemes(request(),env,async()=>Response.json({status:'incomplete',output:[]})); assert.equal(incomplete.status,502);
  const timedOut=await suggestThemes(request(),env,async()=>{throw new Error('test timeout');});assert.equal(timedOut.status,504);
});
test('browser bridge includes only permitted origins and never embeds secrets',async()=> {
  const response=await worker.fetch(new Request('https://example.chatgpt.site/'),{...env,PLANNER_ORIGINS:'https://laliza03.github.io'});
  const html=await response.text(); assert.ok(html.includes('https://laliza03.github.io')); assert.ok(!html.includes(env.OPENAI_API_KEY));
  assert.ok(response.headers.get('Content-Security-Policy').includes("default-src 'none'"));
  assert.equal((await worker.fetch(new Request('https://example.chatgpt.site/api/themes'),env)).status,405);
});
