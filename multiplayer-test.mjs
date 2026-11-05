import assert from 'node:assert/strict';
import {newGame,restoreGame,checkVictory,victoryTarget,botPlan,forecastStar,advance,queue,upgrade,totals,distance,RANGE,mapBounds,factionColors} from './fixtures/legacy-game.mjs';
for(let n=2;n<=8;n++){
 const g=newGame(n);assert.equal(g.stars.length,9*n);assert.equal(g.credits.length,n);assert.equal(new Set(factionColors.slice(0,n)).size,n);assert.equal(new Set(g.stars.map(s=>s.name)).size,g.stars.length);assert.equal(victoryTarget(g),Math.ceil(9*n/2));
 const homes=g.stars.filter(s=>s.owner>=0);assert.equal(homes.length,n);for(const h of homes){assert.equal(h.ships,54);assert.equal(h.economy,3);assert.equal(h.industry,3);assert.equal(g.credits[h.owner],60);}
 const reached=new Set([0]),work=[g.stars[0]];while(work.length){const a=work.pop();for(const b of g.stars)if(!reached.has(b.id)&&distance(a,b)<=RANGE){reached.add(b.id);work.push(b);}}assert.equal(reached.size,g.stars.length,'Map must be connected');
 const distances=homes.map(h=>g.stars.map(s=>Math.round(distance(s,h)*1000)).sort((a,b)=>a-b));for(const d of distances)assert.deepEqual(d,distances[0],'Each home must have equivalent access');
 assert.deepEqual(restoreGame(g),g);assert(mapBounds(g).width>0);
 const rich=g.stars.slice(0,victoryTarget(g)-1);for(const s of g.stars)s.owner=-1;for(const s of rich)s.owner=n-1;checkVictory(g);assert.equal(g.winner,null);g.stars[victoryTarget(g)-1].owner=n-1;checkVictory(g);assert.equal(g.winner,n-1,'Any empire can win, including owner 7');
}
for(const n of [0,1,9,2.5,NaN])assert.throws(()=>newGame(n));
let g=newGame(8);for(const s of g.stars)s.owner=s.id<36?2:7;checkVictory(g);assert.equal(g.winner,-1,'Equal simultaneous thresholds are a draw, not an ID-based winner');
g=newGame(3);g.stars.forEach((s,i)=>s.owner=i<13?2:-1);checkVictory(g);assert.equal(g.winner,null);g.stars[13].owner=2;checkVictory(g);assert.equal(g.winner,2,'27 stars require 14, not 13');
g=newGame(8);for(const s of g.stars)s.owner=-1;g.stars[0].owner=7;checkVictory(g);assert.equal(g.winner,null,'Elimination alone does not replace the 50% condition');
// Victory is checked after all simultaneous captures, without favoring arrival order.
for(const reverse of [false,true]){g=newGame(8);g.stars.forEach((s,i)=>{s.owner=i<35?0:i<70?7:-1;s.ships=0;s.industry=0;});g.fleets=[{id:100,owner:0,from:0,to:70,ships:1,total:1,remaining:1},{id:101,owner:7,from:63,to:71,ships:1,total:1,remaining:1}];if(reverse)g.fleets.reverse();advance(g,false);assert.equal(g.winner,-1);assert.equal(totals(g,0).stars,36);assert.equal(totals(g,7).stars,36);}
// Loading an old two-player save keeps the position and resolves the new threshold.
const legacy=newGame();legacy.version=1;delete legacy.playerCount;delete legacy.battles;delete legacy.autoRoutes;legacy.stars[1].owner=0;legacy.tick=5;const migrated=restoreGame(legacy);assert.equal(migrated.version,3);assert.equal(migrated.playerCount,2);assert.deepEqual(migrated.stars,legacy.stars);assert.equal(migrated.tick,5);legacy.winner=2;assert.equal(restoreGame(legacy).winner,-1);assert.equal(restoreGame({...newGame(8),stars:[]}),null);
// All bots plan from the same committed state before any bot's actions are applied.
g=newGame(8);const expected=g.credits.map((_,owner)=>owner?botPlan(g,owner):null),initial=structuredClone(g),moves=[];advance(g,true,moves);for(let owner=1;owner<8;owner++){const sent=moves.filter(f=>f.owner===owner).map(({from,to,ships})=>({from,to,ships}));assert.deepEqual(sent,expected[owner].orders.map(({from,to,ships})=>({from,to,ships})));assert(sent.length>0,'All seven bots must take actions');}
const hidden=structuredClone(initial);queue(hidden,0,0,1,20);for(let owner=1;owner<8;owner++)assert.deepEqual(botPlan(hidden,owner),expected[owner],'Bots cannot read human reserved orders');
// Combined assault: neither origin can beat the target alone; both arrive in one tick.
g=newGame(3);g.credits.fill(0);for(const s of g.stars){s.owner=-1;s.ships=10000;s.industry=0;s.x=5000+s.id*500;s.y=5000;}
Object.assign(g.stars[0],{owner:0,ships:30,x:100,y:100});Object.assign(g.stars[9],{owner:1,ships:24,x:0,y:100});Object.assign(g.stars[10],{owner:1,ships:24,x:100,y:0});
const assault=botPlan(g,1).orders.filter(f=>f.to===0);assert.equal(assault.length,2);assert(assault.every(f=>f.total===1));assert(assault.reduce((n,f)=>n+f.ships,0)>30);
// Defense must recognize visible attacks from a third empire, not only the human.
// Both fleet endpoints must be visible so the bot is allowed to know its target.
g=newGame(3);g.credits.fill(0);for(const s of g.stars){s.owner=-1;s.ships=10000;s.industry=0;s.x=5000+s.id*500;s.y=5000;}
Object.assign(g.stars[9],{owner:1,ships:10,x:100,y:100});Object.assign(g.stars[10],{owner:1,ships:50,x:0,y:100});Object.assign(g.stars[18],{owner:2,ships:0,x:100,y:200});g.fleets=[{id:90,owner:2,from:18,to:9,ships:30,total:1,remaining:1}];const rescue=botPlan(g,1).orders.find(f=>f.to===9);assert(rescue&&rescue.ships>0);assert.equal(forecastStar(g,9,1,botPlan(g,1).orders).owner,1,'Rescue must actually preserve the threatened star');
// Reports aggregate every side; a third/fourth empire is not treated as neutral or a draw.
g=newGame(4);g.stars[1].owner=2;g.stars[1].ships=5;g.stars[1].industry=0;g.fleets=[{id:100,owner:3,from:27,to:1,ships:35,total:1,remaining:1},{id:101,owner:0,from:0,to:1,ships:7,total:1,remaining:1},{id:102,owner:1,from:9,to:1,ships:6,total:1,remaining:1}];advance(g,false);assert.equal(g.stars[1].owner,3);assert.equal(g.stars[1].ships,34);assert.equal(g.battles[0].forces.length,4);assert(g.logs.some(l=>l.text.includes('Draco')));
// Growth, ownership safety and legal orders across full multi-empire simulations.
for(const n of [2,3,4,5,6,7,8]){g=newGame(n);const start=performance.now();for(let tick=0;tick<150&&g.winner===null;tick++){advance(g);assert(g.stars.every(s=>s.ships>=0&&Number.isInteger(s.ships)&&s.owner>=-1&&s.owner<n));assert(g.credits.every(c=>Number.isInteger(c)&&c>=0));assert(g.fleets.every(f=>f.owner>=0&&f.owner<n&&f.ships>0&&f.remaining>0));}assert(g.winner!==null,'A group of bots should conclude against an idle player');if(g.winner>=0)assert(totals(g,g.winner).stars>=victoryTarget(g));console.log(n+' players: winner '+g.winner+', '+g.tick+' ticks, '+Math.round(performance.now()-start)+'ms');}
console.log('Multiplayer passed: 2–8 balanced connected maps, thresholds/ties, migration, fair planning, coordinated attacks, third-party defense, multi-side battles and simulations.');
