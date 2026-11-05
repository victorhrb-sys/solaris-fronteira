import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
import {createRoom,accessRoom} from './server/rooms.mjs';
import {botPlan,totals,distance} from './public/engine.mjs';
const sqlite=new DatabaseSync(':memory:');sqlite.exec(readFileSync('drizzle/0000_wet_lila_cheney.sql','utf8'));
const db={prepare(sql){return {bind(...args){return {
 async first(){return sqlite.prepare(sql).get(...args);},
 async run(){return {meta:{changes:Number(sqlite.prepare(sql).run(...args).changes)}};}
 };}};}};
const key=()=>crypto.randomUUID().replaceAll('-','')+crypto.randomUUID().replaceAll('-','');
const request=(type,extra={})=>({type,requestId:crypto.randomUUID(),...extra});
async function setup(capacity){const keys=[key(),key()];const created=await createRoom(db,{name:'Ana',capacity},keys[0]);await accessRoom(db,created.code,keys[1],request('join',{name:'Beto'}));await accessRoom(db,created.code,keys[0],request('start'));return {code:created.code,keys};}
const read=(r,i)=>accessRoom(db,r.code,r.keys[i]);
const send=(r,i,type,extra)=>accessRoom(db,r.code,r.keys[i],request(type,extra));
const raw=r=>JSON.parse(sqlite.prepare('SELECT data FROM rooms WHERE code=?').get(r.code).data);
const r=await setup(8);let a=await read(r,0),b=await read(r,1);
assert.equal(a.game.stars.length,72);assert.equal(b.owner,1);assert.equal(a.game.credits[1],null);
assert(!JSON.stringify(a).includes('hash'));assert(!JSON.stringify(a).includes(r.keys[1]));
const home=a.game.stars.find(s=>s.owner===0),target=a.game.stars.find(s=>s.id!==home.id&&distance(home,s)<=190);
await assert.rejects(()=>send(r,1,'action',{tick:0,action:{type:'send',from:home.id,to:target.id,ships:1}}));
await assert.rejects(()=>accessRoom(db,r.code,key()),/Chave/);
await assert.rejects(()=>send(r,0,'action',{tick:0,action:{type:'send',from:home.id,to:target.id,ships:-1}}));
const order=request('action',{tick:0,action:{type:'send',from:home.id,to:target.id,ships:20}});
await Promise.all([accessRoom(db,r.code,r.keys[0],order),accessRoom(db,r.code,r.keys[0],order)]);
a=await read(r,0);b=await read(r,1);assert.equal(a.game.orders.length,1);assert.equal(a.game.stars[home.id].ships,34);assert.equal(b.game.orders.length,0);
assert.equal(raw(r).game.stars[home.id].ships,54,'Draft must not affect committed state');
await send(r,0,'action',{tick:0,action:{type:'cancel',id:a.game.orders[0].id}});
assert.equal((await read(r,0)).game.stars[home.id].ships,54);
await send(r,0,'ready',{tick:0,ready:true});
await assert.rejects(()=>send(r,0,'action',{tick:0,action:{type:'upgrade',star:home.id,upgrade:'defense'}}),/confirmação/);
await send(r,0,'ready',{tick:0,ready:false});
await send(r,0,'action',{tick:0,action:{type:'upgrade',star:home.id,upgrade:'defense'}});
assert.equal((await read(r,0)).game.credits[0],45);
const ready=request('ready',{tick:0,ready:true});
const responses=await Promise.allSettled([accessRoom(db,r.code,r.keys[0],ready),send(r,1,'ready',{tick:0,ready:true}),accessRoom(db,r.code,r.keys[0],ready)]);
assert(responses.some(x=>x.status==='fulfilled'));assert.equal(raw(r).game.tick,1);
await assert.rejects(()=>send(r,0,'ready',{tick:0,ready:true}),/turno mudou/);
assert.equal(raw(r).game.tick,1);
assert.equal((await read(r,0)).turnSummary.tick,1);
assert.equal((await read(r,0)).turnSummary.income,9);
assert(!('turnSummaries' in await read(r,0)),'Only this player summary may leave the server');
assert.equal((await read(r,0)).members.every(m=>m.active),true);
a=await read(r,0);for(const s of a.game.stars.filter(s=>!s.visible)){assert.equal(s.ships,null);assert.equal(s.owner,null);assert.equal(s.defense,null);}
// Every human's complete perspective must survive reconnection unchanged.
assert.deepEqual(await read(r,1),await accessRoom(db,r.code,r.keys[1]));
await send(r,1,'resign',{tick:1});assert.equal((await read(r,1)).resigned,true);
await assert.rejects(()=>send(r,1,'action',{tick:1,action:{type:'upgrade',star:home.id,upgrade:'defense'}}));
await send(r,0,'ready',{tick:1,ready:true});assert.equal(raw(r).game.tick,2);
// Two independent humans submit plans based only on their network views, until victory.
const duel=await setup(2);
for(let step=0;step<350&&raw(duel).game.winner===null;step++){
 const views=await Promise.all([read(duel,0),read(duel,1)]);
 for(let i=0;i<2;i++){
  const plan=botPlan(views[i].game,i);
  for(const u of plan.upgrades)await send(duel,i,'action',{tick:step,action:{type:'upgrade',star:u.id,upgrade:u.type}});
  for(const f of plan.orders)await send(duel,i,'action',{tick:step,action:{type:'send',from:f.from,to:f.to,ships:f.ships}});
 }
 await Promise.all([send(duel,0,'ready',{tick:step,ready:true}),send(duel,1,'ready',{tick:step,ready:true})]);
}
assert.notEqual(raw(duel).game.winner,null,'Two network participants complete a game');
assert(raw(duel).game.winner===-1||totals(raw(duel).game,raw(duel).game.winner).stars>=9);
console.log('Online: authorization, private drafts, fog, races, retries, reconnection, resignation, 8 empires and complete 2-human match passed.');
