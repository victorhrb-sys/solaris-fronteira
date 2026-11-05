import assert from 'node:assert/strict';
import {resolveCombat,newGame,advance,forecastStar,restoreGame} from './fixtures/legacy-game.mjs';
const star=(ships,defensePoints=0)=>({id:0,owner:0,ships,defense:Math.ceil(defensePoints/5),defensePoints,industry:0,economy:0});
const fleet=(owner,ships)=>({owner,ships,from:owner*9,to:0,total:1,remaining:1});
const close=(a,b)=>assert(Math.abs(a-b)<1e-8*Math.max(1,a,b),`${a} ≠ ${b}`);
const solve=(values,defense=0)=>resolveCombat(star(values[0],defense),values.slice(1).map((n,i)=>fleet(i+1,n)));
let r=solve([100,60,40]);
assert.equal(r.ships,70);assert.equal(r.rounds.length,2);
assert.deepEqual(r.rounds[0].duels.map(d=>[d.leftForce,d.rightForce]),[[50,30],[50,20],[30,20]]);
close(r.rounds[0].survivors[0].ships,74);close(r.rounds[0].survivors[1].ships,50/3);
close(r.rounds[1].survivors[0].ships,70.24624624624624);
assert.equal(r.rounds[1].participants.length,2);
assert.notEqual(r.ships,solve([100,60]).ships,'Other sides actually change the outcome');
// Equal strongest sides can survive one round and tie in the next.
r=solve([10,10,5]);assert.equal(r.rounds.length,2);assert.equal(r.tied,true);assert.equal(r.ships,0);assert.equal(r.ownerAfter,0);
r=solve([1,1,1]);assert.equal(r.rounds.length,1);assert.equal(r.tied,true);
r=solve([0,5,3]);assert.equal(r.rounds[0].participants.length,2,'An empty garrison must not dilute the other armies');assert.equal(r.ships,3);assert.equal(r.ownerAfter,1);
r=resolveCombat(star(0),[fleet(1,3)]);assert.equal(r.rounds.length,0);assert.equal(r.ships,3);assert.equal(r.ownerAfter,1);
// Batteries are split, carried between rounds and never replenished during a battle.
r=solve([10,12,8],10);assert.equal(r.ships,10);assert.equal(r.defensePoints,4);
assert.equal(r.rounds[0].participants[0].shareDefense,5);
close(r.rounds[0].survivors[0].defense,4.8);close(r.rounds[1].participants[0].defense,4.8);
r=solve([0,6,4],10);assert.equal(r.ships,0);assert.equal(r.defensePoints,7);assert.equal(r.ownerAfter,0);
r=solve([5,10,10],5);assert.equal(r.tied,true);assert.equal(r.defensePoints,0);assert.equal(r.defense,1);
r=solve([5,30,12],5);assert.equal(r.ownerAfter,1);assert.equal(r.defense,0);assert.equal(r.defensePoints,0);
// Exercise odd splits, tiny forces, all eight empires plus a neutral garrison.
for(let n=2;n<=9;n++)for(let seed=1;seed<=40;seed++){
 const values=Array.from({length:n},(_,i)=>(seed*(i+3)*7+i*i)%101+1),defense=(seed%5)*5,result=solve(values,defense);
 const reversed=resolveCombat(star(values[0],defense),values.slice(1).map((ships,i)=>fleet(i+1,ships)).reverse());
 assert.deepEqual(result.rounds,reversed.rounds,'Arrival order must not change pairings or arithmetic');
 assert.equal(result.ships,reversed.ships);assert.equal(result.defensePoints,reversed.defensePoints);
 assert(result.rounds.length<=n-1,'Combat must terminate');
 let previous=null;
 for(const round of result.rounds){
  const count=round.participants.length;assert.equal(round.duels.length,count*(count-1)/2);
  assert.equal(new Set(round.duels.map(d=>`${d.left}/${d.right}`)).size,round.duels.length);
  for(const p of round.participants){close(p.shareShips*(count-1),p.ships);close(p.shareDefense*(count-1),p.defense);if(previous){const old=previous.find(f=>f.owner===p.owner);close(p.ships,old.ships);close(p.defense,old.defense);}}
  assert(round.survivors.filter(f=>f.force>0).length<count);
  for(const d of round.duels){assert(d.remainingForce>=0);assert(d.remainingForce<=Math.max(d.leftForce,d.rightForce));close(d.ships+d.defense,d.remainingForce);}
  for(const s of round.survivors){const p=round.participants.find(f=>f.owner===s.owner);assert(s.ships<=p.ships+1e-8);assert(s.defense<=p.defense+1e-8);}
  previous=round.survivors;
 }
 for(const f of result.forces){assert.equal(f.survived+f.lost,f.total);assert.equal(f.defenseAfter+f.defenseLost,f.defense);assert(f.lost>=0&&f.defenseLost>=0);assert(Number.isInteger(f.survived)&&Number.isInteger(f.defenseAfter));}
}
// Same-tick allied arrivals aggregate before division; forecasts match actual resolution.
let g=newGame(3);Object.assign(g.stars[0],star(100));g.fleets=[fleet(1,20),fleet(1,40),fleet(2,40)].map((f,i)=>({...f,id:i+50}));
const predicted=forecastStar(g,0,1);advance(g,false);assert.equal(g.tick,1);assert.equal(g.stars[0].ships,70);assert.equal(predicted.ships,g.stars[0].ships);assert.deepEqual(predicted.defensePoints,g.stars[0].defensePoints);
assert.equal(g.battles[0].rule,'moderate-duels');assert.equal(g.battles[0].forces.length,3);assert.equal(g.battles[0].rounds[0].participants[1].shareShips,30);
const snapshot=JSON.stringify(g.battles);assert.deepEqual(restoreGame(g),g);advance(g,false);assert.equal(JSON.stringify(g.battles),snapshot);
console.log('Duel rounds passed: reference result, pairings, simultaneous allocation, regrouping, fractions, ties, empty systems, split batteries, capture, 2–9 sides, order independence, termination, conservation, forecasts and immutable reports.');
