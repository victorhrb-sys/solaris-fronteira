import assert from 'node:assert/strict';
import {newGame, restoreGame, botPlan, applyBotState, advance, queue, upgrade, playerView, forecastStar, visibleStars} from './public/engine.mjs';
import {BOT_TRAITS, createBotProfile, botProfile} from './public/bot-profiles.mjs';

const baseline = {territory:'opportunist',risk:'calculating',deployment:'dispersed',investment:'industrial',diplomacy:'reserved'};
function scene() {
 const g = newGame(); g.credits.fill(0);
 for (const s of g.stars) Object.assign(s,{x:10000+s.id*500,y:10000,owner:-1,ships:10000,economy:0,industry:0});
 g.botProfiles = g.credits.map(() => ({...baseline}));
 return g;
}
function at(g,id,x,y,owner,ships,economy=0,industry=0) { Object.assign(g.stars[id],{x,y,owner,ships,economy,industry}); }

// Every independent trait can be drawn; all 81 active combinations are distinct.
for (const [index, random] of [0,.5,.999].entries()) {
 const profile = createBotProfile(() => random);
 for (const [key, values] of Object.entries(BOT_TRAITS)) assert.equal(profile[key],values[index]);
}
let g = newGame(8), saved = JSON.stringify(g);
assert.deepEqual(restoreGame(JSON.parse(saved)),g);
const legacy = JSON.parse(saved); delete legacy.botProfiles; delete legacy.botStates;
const migrated = restoreGame(legacy);
assert.deepEqual(migrated,restoreGame(legacy));
assert.deepEqual(migrated.stars,legacy.stars);
assert.deepEqual(migrated.credits,legacy.credits);
assert.deepEqual(restoreGame(migrated),migrated);
const corrupt = structuredClone(migrated); corrupt.botProfiles[1].risk='invalid'; corrupt.botStates[1]={focus:9999,since:-2};
assert(BOT_TRAITS.risk.includes(restoreGame(corrupt).botProfiles[1].risk));
assert.equal(restoreGame(corrupt).botStates[1].focus,null);
assert.equal(playerView(g,0).botProfiles,undefined);
assert.equal(playerView(g,0).botStates,undefined);

// The same tactical situation produces different first targets.
g=scene(); at(g,0,0,0,0,60); at(g,1,100,0,-1,10); at(g,2,0,150,-1,20,4,4); at(g,3,-150,0,-1,15);
at(g,4,-450,0,-1,10000); at(g,5,-470,80,-1,10000); at(g,6,-470,-80,-1,10000);
for (const [territory,target] of [['opportunist',1],['patrimonial',2],['positional',3]]) {
 g.botProfiles[0].territory=territory;
 assert.equal(botPlan(g,0).orders[0].to,target,territory);
}

// Caution buys a larger surviving force, rather than changing combat rules.
g=scene(); at(g,0,0,0,0,70); at(g,1,100,0,1,30);
const amounts = BOT_TRAITS.risk.map(risk => {
 g.botProfiles[0].risk=risk;
 const plan=botPlan(g,0), attack=plan.orders.filter(f=>f.to===1);
 assert.equal(forecastStar(g,1,1,attack).owner,0);
 return attack.reduce((n,f)=>n+f.ships,0);
});
assert(amounts[0]>amounts[1]&&amounts[1]>amounts[2]);

// Rescue the first losing arrival, even if an earlier small attack is harmless.
g=scene();at(g,0,0,0,0,10);at(g,1,-100,0,0,50);at(g,2,100,0,1,0);
g.fleets=[{id:91,owner:1,from:2,to:0,ships:5,total:1,remaining:1},{id:92,owner:1,from:2,to:0,ships:30,total:2,remaining:2}];
const rescued=botPlan(g,0);
assert(rescued.orders.some(f=>f.to===0));
assert.equal(forecastStar(g,0,2,rescued.orders).owner,0);

// An immediately winning capture overrides a prudent bot's ordinary caution.
g=scene();at(g,0,0,0,0,45);at(g,1,100,0,1,40);
for(let i=2;i<=8;i++)g.stars[i].owner=0;
g.botProfiles[0].risk='prudent';
const finishing=botPlan(g,0);
assert.equal(forecastStar(g,1,1,finishing.orders).owner,0);

// Each economic policy can make a different purchase on the same world.
g=scene(); at(g,0,0,0,0,60); at(g,1,150,0,1,1000);g.credits[0]=30;
for (const [investment,type] of [['economic','economy'],['industrial','industry'],['fortifier','defense']]) {
 g.botProfiles[0].investment=investment;
 assert.equal(botPlan(g,0).upgrades[0].type,type,investment);
}

// Prudent fortifiers buy a first battery, then fund production instead of
// repeatedly stacking unneeded levels. Forecast emergencies bypass that bias.
g=scene();at(g,0,0,0,0,60,3,3);at(g,1,150,0,1,1000);g.credits[0]=200;
g.botProfiles[0]={...baseline,territory:'positional',risk:'prudent',deployment:'mobile',investment:'fortifier'};
const beforeFortification=structuredClone(g),fortification=botPlan(g,0);
assert.deepEqual(fortification.upgrades.map(u=>u.type),['defense','industry']);
assert.deepEqual(g,beforeFortification,'Investment evaluation must remain pure');
Object.assign(g.stars[0],{defense:1,defensePoints:5});g.credits[0]=100;
assert.equal(botPlan(g,0).upgrades[0].type,'industry');
Object.assign(g.stars[0],{ships:0,industry:0,economy:0,defensePoints:0});g.credits[0]=30;
g.fleets=[{id:93,owner:1,from:1,to:0,ships:3,total:1,remaining:1}];
assert.equal(forecastStar(g,0,1).owner,1);
const emergency=botPlan(g,0);assert(emergency.upgrades.some(u=>u.id===0&&u.type==='defense'));
for(const u of emergency.upgrades)upgrade(g,0,u.id,u.type);
assert.equal(forecastStar(g,0,1).owner,0,'A necessary second battery still saves the star');

// Dispersed supplies both flanks, mobile retains a central reserve, concentrated
// sends its surplus to the preferred flank. These are orders, not just scores.
g=scene();at(g,0,0,0,0,100);at(g,1,300,0,0,4);at(g,2,-300,0,0,4);at(g,3,600,0,1,1000);at(g,4,-600,0,1,1000);
const deployments={};
for (const deployment of BOT_TRAITS.deployment) {g.botProfiles[0].deployment=deployment;deployments[deployment]=botPlan(g,0).orders.filter(f=>f.from===0);}
assert.equal(new Set(deployments.dispersed.map(f=>f.to)).size,2);
assert.equal(new Set(deployments.concentrated.map(f=>f.to)).size,1);
assert(deployments.mobile.reduce((n,f)=>n+f.ships,0)<deployments.concentrated.reduce((n,f)=>n+f.ships,0));

// Stable focus persists through save/load and ordinary turn advancement.
g.botProfiles[1]={...baseline,deployment:'concentrated'};
const plan=botPlan(g,1);applyBotState(g,1,plan);
assert.deepEqual(restoreGame(g).botStates,g.botStates);
const beforeProfiles=structuredClone(g.botProfiles);advance(g);
assert.deepEqual(g.botProfiles,beforeProfiles);

// All 81 profiles plan legally, without mutating input or consulting hidden data.
g=newGame(8);
let combinations=0;
for(const territory of BOT_TRAITS.territory) for(const risk of BOT_TRAITS.risk)
for(const deployment of BOT_TRAITS.deployment) for(const investment of BOT_TRAITS.investment) {
 g.botProfiles[1]={territory,risk,deployment,investment,diplomacy:'reserved'};
 const before=structuredClone(g), plan=botPlan(g,1);
 assert.deepEqual(g,before);
 assert(plan.orders.length>0);
 const hidden=structuredClone(g),seen=visibleStars(g,1);
 for(const s of hidden.stars) if(!seen.has(s.id)) {s.owner=7;s.ships+=9999;s.economy=8;s.industry=8;}
 assert.deepEqual(botPlan(hidden,1),plan);
 for(const diplomacy of BOT_TRAITS.diplomacy) {hidden.botProfiles[1].diplomacy=diplomacy;assert.deepEqual(botPlan(hidden,1),plan);}
 const reserved=structuredClone(g),home=reserved.stars.find(s=>s.owner===0),target=reserved.stars.find(s=>s.id!==home.id&&Math.hypot(s.x-home.x,s.y-home.y)<=340);
 queue(reserved,0,home.id,target.id,10);assert.deepEqual(botPlan(reserved,1),plan);
 const applied=structuredClone(g);
 for(const u of plan.upgrades) upgrade(applied,1,u.id,u.type);
 for(const f of plan.orders) queue(applied,1,f.from,f.to,f.ships);
 assert(applied.credits[1]>=0);assert(applied.stars.every(s=>s.ships>=0));
 combinations++;
}
assert.equal(combinations,81);
assert.deepEqual(botProfile(legacy,1),migrated.botProfiles[1]);
console.log('Bots: 81 profiles, behavioral differences on all four axes, legal orders, pure planning, fog, private orders, inactive diplomacy, saves and migration passed.');
