import assert from 'node:assert/strict';
import {BOT_TRAITS} from './public/bot-profiles.mjs';

// Reproducible mixed matches exercise every active personality, without claiming
// that a small set of matches establishes competitive balance between profiles.
let seed=20261011;
const random=Math.random;
Math.random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
try {
 // map-picker captures Math.random when the engine is imported. Install the
 // seeded generator first so map selection is reproducible as well as bot setup.
 const {newGame, botPlan, applyBotState, advance, queue, upgrade} = await import('./public/engine.mjs');
 const profiles=[];
 for(const territory of BOT_TRAITS.territory) for(const risk of BOT_TRAITS.risk)
 for(const deployment of BOT_TRAITS.deployment) for(const investment of BOT_TRAITS.investment)
  profiles.push({territory,risk,deployment,investment,diplomacy:'reserved'});
 // Shuffle to avoid grouping opponents by the same territory/risk policy.
 for(let i=profiles.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[profiles[i],profiles[j]]=[profiles[j],profiles[i]];}
 for(let start=0;start<profiles.length;start+=8){
  const g=newGame(8);
  g.botProfiles=g.botProfiles.map((_,owner)=>({...profiles[(start+owner)%profiles.length]}));
  const personalities=structuredClone(g.botProfiles);
  for(let tick=0;tick<200&&g.winner===null;tick++){
   const plans=g.credits.map((_,owner)=>botPlan(g,owner));
   for(let owner=0;owner<plans.length;owner++){
    const plan=plans[owner];applyBotState(g,owner,plan);
    for(const u of plan.upgrades)upgrade(g,owner,u.id,u.type);
    for(const f of plan.orders)queue(g,owner,f.from,f.to,f.ships);
   }
   advance(g,false);
   assert(g.stars.every(s=>Number.isInteger(s.ships)&&s.ships>=0));
   assert(g.credits.every(c=>Number.isInteger(c)&&c>=0));
  }
  assert.notEqual(g.winner,null,`Unfinished match ${start/8+1}: ${g.mapId}`);
  assert.deepEqual(g.botProfiles,personalities);
  console.log(`Mixed match ${start/8+1}: ${g.tick} ticks, winner ${g.winner}`);
 }
 console.log('All 81 active personalities exercised in 11 completed eight-empire matches.');
} finally {Math.random=random;}
