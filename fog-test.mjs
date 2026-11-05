import assert from 'node:assert/strict';
import {newGame,playerView,pointVisible,visibleStars,fleetPosition,movementVisible,VISION,queue,advance,restoreGame,botPlan} from './fixtures/legacy-game.mjs';
let g=newGame(3);for(const s of g.stars){s.x=10000+s.id*1000;s.y=0;s.owner=-1;}Object.assign(g.stars[0],{x:0,y:0,owner:0});Object.assign(g.stars[1],{x:VISION,y:0});Object.assign(g.stars[2],{x:VISION+.01,y:0,owner:1,ships:9876,economy:91,industry:92,defense:20,defensePoints:99});
assert(pointVisible(g,0,{x:VISION,y:0}));assert(!pointVisible(g,0,{x:VISION+.01,y:0}));assert.deepEqual([...visibleStars(g,0)],[0,1]);
let view=playerView(g,0);assert.equal(view.stars[2].owner,null);assert.equal(view.stars[2].ships,null);assert.equal(view.stars[2].economy,null);assert.equal(view.stars[2].defensePoints,null);assert.equal(view.stars[2].name,g.stars[2].name);assert.equal(view.credits[1],null);assert.equal(view.stars[1].visible,true);assert.equal(JSON.stringify(view).includes('9876'),false);
// Coverage is a union, not a chain through neutral or enemy stars.
assert.equal(view.stars[2].visible,false);g.stars[1].owner=0;assert(playerView(g,0).stars[2].visible);g.stars[1].owner=1;assert(!playerView(g,0).stars[2].visible);
// Fleets do not act as scouts; enemy trajectories with hidden endpoints are redacted.
Object.assign(g.stars[3],{x:-400,y:0});Object.assign(g.stars[4],{x:400,y:0});g.fleets=[{id:90,owner:1,from:3,to:4,ships:7,total:2,remaining:1},{id:91,owner:1,from:4,to:5,ships:8888,total:2,remaining:2},{id:92,owner:0,from:4,to:5,ships:9,total:2,remaining:2}];
assert(movementVisible(g,0,{...g.fleets[0],total:1,remaining:1}),'A segment crossing vision is detectable even with both endpoints outside');assert(!movementVisible(g,0,g.fleets[1]));
view=playerView(g,0);assert.equal(view.fleets.length,2);assert.deepEqual(view.fleets[0],{id:90,owner:1,ships:7,x:0,y:0,heading:0});assert.equal(view.fleets[1].id,92);assert(!view.stars[4].visible);assert.deepEqual(fleetPosition(view,view.fleets[0]),{x:0,y:0});
assert.deepEqual(playerView(view,0).fleets,view.fleets,'Projecting an already filtered online view preserves headings');
g.autoRoutes=[{owner:1,from:1,to:2,reserve:666,enabled:true}];assert.deepEqual(playerView(g,0).autoRoutes,[]);
// Capture immediately extends coverage; losing it hides live intel, including after reload.
g=newGame();g.credits.fill(0);for(const s of g.stars){s.x=10000+s.id*1000;s.y=0;s.industry=0;s.economy=0;}Object.assign(g.stars[0],{x:0,y:0,ships:50});Object.assign(g.stars[1],{x:300,y:0,ships:1});Object.assign(g.stars[2],{x:600,y:0,ships:1234});assert(!playerView(g,0).stars[2].visible);queue(g,0,0,1,20);advance(g,false);advance(g,false);assert.equal(g.stars[1].owner,0);assert(playerView(g,0).stars[2].visible);g.stars[1].owner=1;assert(!playerView(restoreGame(g),0).stars[2].visible);
// Observed history persists; future discoveries never reveal unobserved past battles.
g=newGame(3);g.credits.fill(0);for(const s of g.stars){s.x=10000+s.id*1000;s.y=0;s.industry=0;s.economy=0;}Object.assign(g.stars[0],{x:0,y:0});Object.assign(g.stars[1],{x:200,y:0,ships:3});Object.assign(g.stars[2],{x:4000,y:0,ships:3});g.fleets=[{id:80,owner:1,from:9,to:1,ships:10,total:1,remaining:1},{id:81,owner:1,from:9,to:2,ships:10,total:1,remaining:1}];advance(g,false);assert.equal(g.battles.length,2);view=playerView(g,0);assert.equal(view.battles.length,1);assert.equal(view.battles[0].starId,1);assert(!('observedBy' in view.battles[0]));assert(!view.logs.some(l=>l.battleId==='1-2'));assert(playerView(g,1).battles.some(b=>b.starId===2));g.stars[0].owner=2;assert.equal(playerView(g,0).battles.length,1);g.stars[2].owner=0;assert(!playerView(g,0).battles.some(b=>b.starId===2));
delete g.battles[0].observedBy;assert(!playerView(g,0).battles.some(b=>b.starId===2),'Legacy reports are visible only to participants');
// A bot cannot change its decisions based on secret owners, fleets or resources.
g=newGame(8);const original=botPlan(g,1),hidden=structuredClone(g),seen=visibleStars(g,1);
for(const s of hidden.stars)if(!seen.has(s.id)){s.owner=s.owner===0?7:0;s.ships=9000;s.economy=90;s.industry=90;s.defense=90;s.defensePoints=450;}
for(let i=0;i<hidden.credits.length;i++)if(i!==1)hidden.credits[i]=100000;
const unseen=hidden.stars.filter(s=>!seen.has(s.id));hidden.fleets.push({id:999,owner:0,from:unseen[0].id,to:unseen[1].id,ships:20000,total:2,remaining:2});
assert.deepEqual(botPlan(hidden,1),original);
for(let owner=0;owner<8;owner++){const plan=botPlan(g,owner);assert(plan.orders.every(f=>visibleStars(g,owner).has(f.to)),'Attacks target only visible systems');}
console.log('Fog passed: radius edge, union, unknown fields, capture/loss/reload, fleets and hidden routes, witnessed history, legacy reports and bot noninterference.');
