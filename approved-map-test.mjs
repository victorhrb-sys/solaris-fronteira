import assert from 'node:assert/strict';
import {spacedMap,mapScales} from './public/map-spacing.mjs';
import {inspect} from './scripts/space-maps.mjs';
import {approvedMaps} from './public/approved-maps.mjs';
import {createMapPicker,MAP_HISTORY_KEY} from './public/map-picker.mjs';
import {newGame,restoreGame,botPlan,advance,queue,upgrade,travel,distance,totals,RANGE} from './public/engine.mjs';
const memoryStorage=()=>{const data=new Map();return {getItem:k=>data.get(k)??null,setItem:(k,v)=>data.set(k,v)};};
// Guard against returning to a fixed neutral garrison; loading never rolls again.
const originalRandom=Math.random;
try{for(const [roll,ships] of [[0,5],[1-Number.EPSILON,17]]){Math.random=()=>roll;const g=newGame(2);assert(g.stars.filter(s=>s.owner===-1).every(s=>s.ships===ships));const old=structuredClone(g);for(const s of old.stars)if(s.owner===-1)s.ships=11;assert.deepEqual(restoreGame(old),old);}}finally{Math.random=originalRandom;}
assert.equal(approvedMaps.length,896);assert.equal(new Set(approvedMaps.map(m=>m.id)).size,896);
for(let players=2;players<=8;players++){
 const bank=approvedMaps.filter(m=>m.players===players);assert.equal(bank.length,128);
 const storage=memoryStorage();let picker=createMapPicker({storage}),draws=[];
 for(let i=0;i<128;i++){if(i===17)picker=createMapPicker({storage});draws.push(picker(players).id);}
 assert.equal(new Set(draws).size,128);assert.notEqual(picker(players).id,draws.at(-1));
 assert.equal(JSON.parse(storage.getItem(`${MAP_HISTORY_KEY}:${players}`)).remaining.length,127);
 // Every geometry retains its approved access distances under the actual game travel rule.
 for(const m of bank){
  const g={stars:m.points.map(([x,y],id)=>({x,y,id}))},n=g.stars.length;assert.equal(n,players*9);
  const d=g.stars.map((a,i)=>g.stars.map((b,j)=>i===j?0:distance(a,b)<=RANGE?travel(a,b):999));
  for(let i=0;i<n;i++)for(let j=0;j<i;j++)assert(distance(g.stars[i],g.stars[j])>=100-1e-7);
  for(let k=0;k<n;k++)for(let i=0;i<n;i++)for(let j=0;j<n;j++)d[i][j]=Math.min(d[i][j],d[i][k]+d[k][j]);
  assert(d.every(row=>row.every(v=>v<999)));
  const a=[1,2,3,4].map(t=>m.homes.map(h=>d[h].filter(v=>v>0&&v<=t).length));
  const span=x=>Math.max(...x)-Math.min(...x);assert.equal(span(a[0]),0);assert([2,3].includes(a[0][0]));assert(a[1].every(x=>x>=6&&x<=10));assert(span(a[1])<=2);assert(span(a[2])<=4);assert(span(a[3])<=6);
  const near=m.homes.map(h=>Math.min(...m.homes.filter(v=>v!==h).map(v=>d[h][v])));assert(near.every(x=>x>=4&&x<=6));assert(span(near)<=1);
  const territory=Array(players).fill(0);for(let v=0;v<n;v++){const ranked=m.homes.map((h,i)=>[d[h][v],i]).sort((a,b)=>a[0]-b[0]);if(ranked[0][0]<ranked[1][0])territory[ranked[0][1]]++;}assert(span(territory)<=4);
  const adj=g.stars.map((a,i)=>g.stars.flatMap((b,j)=>i!==j&&distance(a,b)<=RANGE?[j]:[]));
  for(let blocked=0;blocked<n;blocked++){const reached=new Set([blocked===0?1:0]),work=[...reached];while(work.length)for(const v of adj[work.pop()])if(v!==blocked&&!reached.has(v)){reached.add(v);work.push(v);}assert.equal(reached.size,n-1,'No single star can disconnect the map');}
 }
 for(const m of bank){const spaced=spacedMap(m);assert(inspect(m,mapScales[m.id]),'Spaced geometry remains connected and meets access limits');assert.equal(spaced.points.length,m.points.length);assert(mapScales[m.id]>=1&&mapScales[m.id]<=1.35);assert.notEqual(spaced.version,m.version);}
 const g=newGame(players),layout=spacedMap(bank.find(m=>m.id===g.mapId));assert(layout);assert.deepEqual(g.stars.map(s=>[s.x,s.y]),layout.points);assert.deepEqual(g.stars.filter(s=>s.owner>=0).map(s=>s.id).sort((a,b)=>a-b),[...layout.homes].sort((a,b)=>a-b));assert.equal(new Set(g.stars.map(s=>s.name)).size,players*9);
 for(let owner=0;owner<players;owner++){const home=g.stars.find(s=>s.owner===owner);assert.equal(home.ships,54);assert.equal(home.industry,3);assert.equal(home.economy,3);assert.equal(g.credits[owner],60);assert(botPlan(g,owner).orders.length>0);}
 assert(g.stars.filter(s=>s.owner===-1).every(s=>Number.isInteger(s.ships)&&s.ships>=5&&s.ships<=17));assert.deepEqual(restoreGame(g),g);
 for(let tick=0;tick<180&&g.winner===null;tick++){const plan=botPlan(g,0);for(const u of plan.upgrades)upgrade(g,0,u.id,u.type);for(const f of plan.orders)queue(g,0,f.from,f.to,f.ships);advance(g);assert(g.stars.every(s=>Number.isInteger(s.ships)&&s.ships>=0));}
 assert.notEqual(g.winner,null,'Bots must finish a sampled approved map');if(g.winner>=0)assert(totals(g,g.winner).stars>=Math.ceil(g.stars.length/2));console.log(`${players} players: 128 maps checked, 128 unique draws and persisted cycle; bot game finished in ${g.tick} ticks`);
}
for(const storage of [null,{getItem(){throw Error('blocked')},setItem(){throw Error('blocked')}},{getItem(){return '{bad'},setItem(){throw Error('full')}}]){const pick=createMapPicker({storage});assert.equal(new Set(Array.from({length:128},()=>pick(8).id)).size,128);}
const storage=memoryStorage();storage.setItem(`${MAP_HISTORY_KEY}:8`,JSON.stringify({version:1,remaining:['missing','missing'],last:null}));assert.equal(createMapPicker({storage})(8).players,8);
// Loading another player count cannot reset this count's cycle.
const pick=createMapPicker({storage:memoryStorage()});const first=pick(8).id;pick(2);assert.notEqual(pick(8).id,first);
// Force the cycle-boundary case where a fresh shuffle would repeat the last map.
const boundary=memoryStorage(),last=approvedMaps.filter(m=>m.players===8).at(-1).id;
boundary.setItem(`${MAP_HISTORY_KEY}:8`,JSON.stringify({version:1,remaining:[],last}));
assert.notEqual(createMapPicker({storage:boundary,random:()=>1-Number.EPSILON})(8).id,last);
console.log('Approved maps: geometry, fresh games, bots, persisted non-repeating cycles, corrupt/full/blocked storage passed.');
