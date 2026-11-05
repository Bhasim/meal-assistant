import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

// Minimal host for loading the actual app; no browser or application dependencies.
const elements = new Map();
const element = id => {
  if (!elements.has(id)) elements.set(id, {value:'',textContent:'',innerHTML:'',hidden:false,dataset:{},classList:{toggle(){}},addEventListener(){},setAttribute(){},removeAttribute(){},replaceChildren(){}});
  return elements.get(id);
};
element('ai-provider').value='openrouter';
const context = vm.createContext({
  console, Intl, Date, Math, Number, Object, Array, String, Set, JSON, Error, NaN,
  document:{getElementById:element,querySelectorAll:()=>[],addEventListener(){},documentElement:{dataset:{}}},
  localStorage:{getItem:()=>null,setItem(){}},window:{scrollTo(){}},location:{hash:''},
  matchMedia:()=>({matches:false,addEventListener(){}}),setInterval(){},setTimeout(){},clearTimeout(){},
});
vm.runInContext(readFileSync(new URL('./app.js',import.meta.url),'utf8'),context);
const M=context.MealAssistantMath;
let passed=0;
const test=(name,fn)=>{fn();passed++;console.log('PASS',name);};
const close=(a,b)=>assert.ok(Math.abs(a-b)<1e-9,`${a} != ${b}`);
const item={name:'Label',basis:100,amount:150,unit:'g',kcal:60,carbs:5,sugar:4,added:null,fiber:null};
test('150 g portion scales each nutrient exactly once',()=>{const n=M.scale(item);close(n.kcal,90);close(n.carbs,7.5);close(n.sugar,6);assert.equal(n.added,null);});
test('printed 30 g serving and two servings',()=>{const n=M.scale({...item,basis:30,amount:60,kcal:120,carbs:18,sugar:5,added:2});close(n.kcal,240);close(n.carbs,36);close(n.sugar,10);close(n.added,4);});
test('ml reference is retained without density conversion',()=>{const x=M.validateItem({...item,unit:'ml',basis:250,amount:375});assert.equal(x.unit,'ml');close(M.scale(x).carbs,7.5);});
test('carbohydrates do not double count sugar or subtract fibre',()=>{const t=M.totals([M.scale({...item,amount:100,carbs:20,sugar:7,fiber:5})]);close(t.carbs,20);close(t.sugar,7);close(t.fiber,5);});
test('unknown added sugars remain unknown, known partial values survive',()=>{const t=M.totals([{kcal:10,carbs:10,sugar:5,added:null,fiber:null},{kcal:10,carbs:4,sugar:3,added:2,fiber:1}]);assert.equal(t.addedUnknown,true);assert.equal(t.addedKnown,1);close(t.added,2);});
test('sugar cannot exceed total carbohydrates',()=>assert.throws(()=>M.validNutrition({...item,carbs:4,sugar:10})));
test('added sugar cannot exceed total sugar',()=>assert.throws(()=>M.validNutrition({...item,added:9})));
test('non-finite and negative nutrition is rejected',()=>{assert.throws(()=>M.validNutrition({...item,kcal:Infinity}));assert.throws(()=>M.validNutrition({...item,carbs:-1}));});
test('invalid quantity is rejected',()=>{assert.throws(()=>M.validateItem({...item,amount:0}));assert.throws(()=>M.validateItem({...item,basis:0}));});
const backup={version:2,goals:{kcal:null,carbs:null,added:0},theme:'system',entries:[{id:'a',name:'Test',date:'2026-11-05',time:1793844000000,slot:'lunch',kcal:999,carbs:999,sugar:4,added:null,fiber:null,items:[item]}]};
test('zero optional goal remains zero',()=>assert.equal(M.validateState(backup).goals.added,0));
test('restore recomputes ingredient totals instead of trusting cached totals',()=>{const e=M.validateState(backup).entries[0];close(e.kcal,90);close(e.carbs,7.5);close(e.sugar,6);assert.equal(e.added,null);});
test('duplicate diary identifiers are rejected',()=>assert.throws(()=>M.validateState({...backup,entries:[backup.entries[0],backup.entries[0]]})));
test('malformed backups and clinical targets are rejected',()=>{assert.throws(()=>M.validateState({version:1}));assert.throws(()=>M.validateState({...backup,goals:{carbs:-1}}));});
console.log(`${passed} tests passed.`);
