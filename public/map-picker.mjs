import {approvedMaps} from './approved-maps.mjs';
export const MAP_HISTORY_KEY='solaris-fronteira-map-cycle-v1';
const banks=new Map(Array.from({length:7},(_,i)=>[i+2,approvedMaps.filter(m=>m.players===i+2)]));
function browserStorage(){try{return globalThis.localStorage??null;}catch{return null;}}
// Memory preserves the cycle if storage is unavailable. Durable history is per browser.
export function createMapPicker({storage=browserStorage(),random=Math.random}={}){
 const memory=new Map();
 return playerCount=>{
  const bank=banks.get(playerCount);if(!bank)throw Error('Escolha de 2 a 8 jogadores.');
  const ids=new Set(bank.map(m=>m.id)),key=`${MAP_HISTORY_KEY}:${playerCount}`;
  const valid=s=>s&&s.version===1&&Array.isArray(s.remaining)&&s.remaining.length<=bank.length&&new Set(s.remaining).size===s.remaining.length&&s.remaining.every(id=>ids.has(id))&&(s.last===null||ids.has(s.last))&&!s.remaining.includes(s.last);
  let state=memory.get(playerCount);
  try{const saved=JSON.parse(storage?.getItem(key)??'null');if(valid(saved))state=saved;}catch{}
  if(!valid(state))state={version:1,remaining:[],last:null};
  if(!state.remaining.length){
   state.remaining=bank.map(m=>m.id);
   for(let i=state.remaining.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[state.remaining[i],state.remaining[j]]=[state.remaining[j],state.remaining[i]];}
   // A new cycle must not immediately repeat the last map of the previous cycle.
   const end=state.remaining.length-1;if(state.remaining[end]===state.last)[state.remaining[0],state.remaining[end]]=[state.remaining[end],state.remaining[0]];
  }
  const id=state.remaining.pop();state.last=id;memory.set(playerCount,state);
  try{storage?.setItem(key,JSON.stringify(state));}catch{storage=null;}
  return bank.find(m=>m.id===id);
 };
}
export const pickApprovedMap=createMapPicker();
