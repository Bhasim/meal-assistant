import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

let calls=[],reply={choices:[{message:{content:'{"items":[]}'},finish_reason:'stop'}]},status=200;
const context=vm.createContext({
  console,JSON,Object,String,Array,Error,TypeError,Uint8Array,Blob,AbortController,setTimeout,clearTimeout,
  btoa:s=>Buffer.from(s,'binary').toString('base64'),location:{hostname:'127.0.0.1'},
  fetch:async(url,options)=>{calls.push({url,options});return {ok:status===200,status,json:async()=>reply};},
});
vm.runInContext(readFileSync(new URL('./ai.js',import.meta.url),'utf8'),context);
const A=context.MealAssistantAI,key='test-only-not-a-real-api-key';
const image=new Blob([new Uint8Array([255,216,255,0])],{type:'image/jpeg'});
let passed=0;
async function test(name,fn){await fn();passed++;console.log('PASS',name);}
await test('configuration does not send a request or expose the key',()=>{A.configure({provider:'openrouter',key,model:'openrouter/free'});assert.equal(calls.length,0);assert.equal(A.key,undefined);assert.equal(A.hasSession(),true);});
await test('paid OpenRouter models are rejected',()=>assert.throws(()=>A.configure({provider:'openrouter',key,model:'vendor/paid-model'})));
await test('free vision request contains selected image and fixed provider endpoint',async()=>{await A.analyze('test image',image);const c=calls.at(-1),body=JSON.parse(c.options.body);assert.equal(c.url,'https://openrouter.ai/api/v1/chat/completions');assert.equal(body.model,'openrouter/free');assert.ok(body.messages[0].content[1].image_url.url.startsWith('data:image/jpeg;base64,'));assert.equal(c.options.credentials,'omit');assert.equal(c.options.redirect,'error');});
await test('Gemini uses inline image data and key header rather than URL',async()=>{A.configure({provider:'gemini',key,model:'gemini-2.5-flash'});reply={candidates:[{content:{parts:[{text:'{"unclear":true}'}]}}]};await A.analyze('label',image);const c=calls.at(-1),body=JSON.parse(c.options.body);assert.ok(!c.url.includes(key));assert.equal(c.options.headers['x-goog-api-key'],key);assert.equal(body.contents[0].parts[1].inline_data.mime_type,'image/jpeg');});
await test('Claude uses only same-origin local relay',async()=>{A.configure({provider:'claude',key,model:'claude-haiku-4-5'});reply={text:'{"items":[]}'};await A.analyze('meal',image);assert.equal(calls.at(-1).url,'/api/analyze');assert.equal(calls.at(-1).options.headers['X-Meal-Assistant'],'1');});
await test('quota errors are reported without provider/key disclosure',async()=>{status=429;await assert.rejects(()=>A.analyze('meal',image),e=>e.message.includes('حد الاستخدام')&&!e.message.includes(key));status=200;});
await test('malformed model responses never become nutrition records',()=>{assert.throws(()=>A.parseJSON('not JSON'));assert.throws(()=>A.parseJSON('[]'));assert.equal(A.parseJSON('```json\n{"unclear":true}\n```').unclear,true);});
await test('disconnect removes authorization for further analysis',async()=>{A.disconnect();assert.equal(A.hasSession(),false);await assert.rejects(()=>A.analyze('meal',image));});
await test('OCR numeric strings retain decimals and matching basis units',()=>{const x=A.normalizeNutrition({basis:'100 g',unit:'g',kcal:'60',carbs:'5,5',sugar:'٤٫٢',added:null});assert.equal(x.basis,100);assert.equal(x.carbs,5.5);assert.equal(x.sugar,4.2);assert.equal(x.added,null);});
await test('ambiguous OCR values are rejected instead of guessed',()=>{for(const value of ['5-8','1,000.5','unknown','5 mg'])assert.throws(()=>A.normalizeNutrition({carbs:value}));assert.throws(()=>A.normalizeNutrition({basis:'100 ml',unit:'g'}));});
console.log(`${passed} AI adapter tests passed; all provider calls mocked, no real credentials used.`);
