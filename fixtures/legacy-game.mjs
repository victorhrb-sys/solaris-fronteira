// Fixed historical geometry and explicit bot personalities keep rule regression
// tests deterministic. Actual pre-profile save migration is covered separately.
export * from '../public/engine.mjs';
import {names} from '../public/engine.mjs';
const halfMap=[[95,290],[190,135],[190,440],[305,235],[310,365],[400,80],[400,520],[440,290],[505,180]];
const points=[...halfMap,...[...halfMap].reverse().map(([x,y])=>[1010-x,600-y])];
export function newGame(playerCount=2){
 if(!Number.isInteger(playerCount)||playerCount<2||playerCount>8)throw Error('Escolha de 2 a 8 jogadores.');
 let stars;
 if(playerCount===2)stars=points.map(([x,y],id)=>({id,name:names[id],x,y,owner:id===0?0:id===17?1:-1,ships:id===0||id===17?54:8+(Math.min(id,17-id)%4)*3,economy:id===0||id===17?3:1,industry:id===0||id===17?3:1}));
 else {stars=[];const radius=Math.max(480,playerCount*90),center=radius+100,sector=Math.PI*2/playerCount,slots=[[2,0],[2,-1],[2,1],[1,0],[1,-1],[1,1],[0,0],[0,-1],[0,1]],homes=['Sol','Nexus','Talos','Cígnus','Helios','Aurora','Érebo','Cronos'];
  for(let owner=0;owner<playerCount;owner++)for(let j=0;j<slots.length;j++){const [row,column]=slots[j],r=radius-(2-row)*125,angle=Math.PI+owner*sector+column*sector/4;stars.push({id:stars.length,name:j===0?homes[owner]:`${names[j]} ${owner+1}`,x:center+r*Math.cos(angle),y:center+r*Math.sin(angle),owner:j===0?owner:-1,ships:j===0?54:8+(j%4)*3,economy:j===0?3:1,industry:j===0?3:1});}
 }
 stars=stars.map(s=>({...s,defense:0,defensePoints:0}));
 return {version:3,playerCount,botProfiles:Array.from({length:playerCount},()=>({territory:'opportunist',risk:'calculating',deployment:'dispersed',investment:'fortifier',diplomacy:'reserved'})),botStates:Array.from({length:playerCount},()=>({focus:null,since:0})),tick:0,credits:Array(playerCount).fill(60),stars,fleets:[],orders:[],battles:[],autoRoutes:[],nextId:1,winner:null,logs:[{tick:0,text:`Controle ${Math.ceil(stars.length/2)} de ${stars.length} estrelas para vencer.`,kind:'info'}]};
}
