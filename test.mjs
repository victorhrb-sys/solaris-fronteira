import assert from 'node:assert/strict';
import {newGame,queue,cancel,upgrade,advance,botPlan,totals,travel} from './fixtures/legacy-game.mjs';
let g=newGame();assert.equal(totals(g,0).ships,totals(g,1).ships);for(let i=0;i<18;i++)assert.equal(g.stars[i].ships,g.stars[17-i].ships);
let f=queue(g,0,0,1,20);assert.equal(g.stars[0].ships,34);cancel(g,f.id);assert.equal(g.stars[0].ships,54);assert.equal(g.orders.length,0);
assert.throws(()=>queue(g,0,0,17,10));assert.throws(()=>queue(g,0,0,1,-1));assert.throws(()=>queue(g,0,0,1,55));assert.throws(()=>queue(g,0,0,1,1.5));
queue(g,0,0,1,20);advance(g,false);assert.equal(g.stars[1].owner,0);assert.equal(g.stars[1].ships,14);assert.equal(g.credits[0],69);assert.equal(g.stars[0].ships,40);advance(g,false);assert.equal(g.stars[1].ships,16);assert.equal(g.credits[0],81);
g=newGame();f=queue(g,0,0,3,30);assert.equal(f.total,2);advance(g,false);assert.equal(g.fleets[0].remaining,1);assert.equal(g.stars[3].owner,-1);advance(g,false);assert.equal(g.stars[3].owner,0);
g=newGame();g.credits[0]=100;upgrade(g,0,0,'industry');assert.equal(g.credits[0],4);advance(g,false);assert.equal(g.stars[0].ships,62);
g=newGame();const plan=botPlan(g);queue(g,0,0,1,40);assert.deepEqual(botPlan(g),plan,'Bot cannot see uncommitted player orders');
g=newGame();for(let i=0;i<70&&g.winner===null;i++)advance(g);assert.equal(g.winner,1,'Bot should beat an idle player');console.log('Idle player defeated in',g.tick,'ticks');
g=newGame();for(let i=0;i<180&&g.winner===null;i++){const p=botPlan(g,0);for(const u of p.upgrades)upgrade(g,0,u.id,u.type);for(const f of p.orders)queue(g,0,f.from,f.to,f.ships);advance(g);assert(g.stars.every(s=>s.ships>=0&&Number.isInteger(s.ships)));assert(g.credits.every(c=>c>=0));}console.log('Bot vs bot simulation:',g.tick,'ticks, winner',g.winner,'territories',totals(g,0).stars,totals(g,1).stars);
g=newGame();for(const s of g.stars.slice(0,9))s.owner=0;advance(g,false);assert.equal(g.winner,0);const tick=g.tick;advance(g);assert.equal(g.tick,tick);
console.log('All engine checks passed.');
// Reports must retain the actual forces at combat time, including production and simultaneous arrivals.
g=newGame();queue(g,0,0,1,20);advance(g,false);let battle=g.battles.find(b=>b.starId===1);assert.equal(battle.remaining,14);assert.equal(battle.captured,true);assert.deepEqual(battle.forces.find(f=>f.owner===0),{owner:0,garrison:0,arrivals:20,total:20,strength:1,defense:0,force:20,survived:14,lost:6,defenseAfter:0,defenseLost:0});assert.equal(battle.forces.find(f=>f.owner===-1).lost,11);assert.equal(g.logs.find(l=>l.battleId===battle.id).tick,g.tick);
g=newGame();queue(g,0,0,1,11);advance(g,false);battle=g.battles[0];assert.equal(battle.ownerAfter,-1);assert.equal(battle.remaining,0);assert(battle.forces.every(f=>f.survived===0&&f.lost===11));
g=newGame();g.stars[1].owner=1;g.stars[1].ships=10;g.stars[1].industry=2;queue(g,0,0,1,20);advance(g,false);battle=g.battles[0];assert.equal(battle.forces.find(f=>f.owner===1).garrison,14);assert.equal(battle.remaining,10);
g=newGame();g.fleets=[{id:1,owner:0,from:0,to:1,ships:20,total:1,remaining:1},{id:2,owner:0,from:0,to:1,ships:5,total:1,remaining:1},{id:3,owner:1,from:17,to:1,ships:8,total:1,remaining:1}];advance(g,false);battle=g.battles[0];assert.equal(battle.forces.length,3);assert.equal(battle.forces.find(f=>f.owner===0).arrivals,25);assert.equal(battle.remaining,21);for(const f of battle.forces)assert.equal(f.total,f.lost+f.survived);
const old=JSON.parse(JSON.stringify(newGame()));delete old.battles;queue(old,0,0,1,20);advance(old,false);assert.equal(old.battles[0].remaining,14);const frozen=JSON.stringify(old.battles[0]);advance(old,false);assert.equal(JSON.stringify(old.battles[0]),frozen,'Report is a snapshot, not the current garrison');console.log('Battle reports passed: capture, tie, production, combined arrivals, three factions, older saves, immutable history.');
// Visual playback captures even arriving fleets without changing resolution or saved state.
const observed=newGame(),plain=newGame(),movements=[];
for(const state of [observed,plain]){queue(state,0,0,1,20);queue(state,0,0,3,20);}
advance(observed,true,movements);advance(plain,true);assert.deepEqual(observed,plain);
assert(movements.some(f=>f.id===1&&f.remaining===1));assert(movements.some(f=>f.id===2&&f.remaining===2));assert(movements.some(f=>f.owner===1));
assert.equal(observed.fleets.find(f=>f.id===2).remaining,1);assert.equal(movements.find(f=>f.id===2).remaining,2);
console.log('Turn playback snapshots preserve resolution, arriving fleets, bot orders and pre-movement positions.');
