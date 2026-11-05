// Only events involving this empire are included. No hidden rival totals or routes.
export function turnSummary(before,after,movements,owner){
 const star=s=>({id:s.id,name:s.name});
 const battles=after.battles.filter(b=>b.tick===after.tick&&(b.defender===owner||b.forces.some(f=>f.owner===owner&&f.force>0)));
 const arrivals=new Map();
 for(const f of movements)if(f.owner===owner&&f.remaining===1){const s=after.stars[f.to],entry=arrivals.get(s.id)??{...star(s),ships:0};entry.ships+=f.ships;arrivals.set(s.id,entry);}
 return {tick:after.tick,income:after.credits[owner]-before.credits[owner],
  gained:after.stars.filter(s=>s.owner===owner&&before.stars[s.id].owner!==owner).map(star),
  lost:before.stars.filter(s=>s.owner===owner&&after.stars[s.id].owner!==owner).map(star),
  arrivals:[...arrivals.values()],
  battles:battles.map(b=>({id:b.id,starId:b.starId,name:b.starName,defending:b.defender===owner,lostShips:b.forces.find(f=>f.owner===owner)?.lost??0}))};
}
