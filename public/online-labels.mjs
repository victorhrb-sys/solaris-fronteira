import {factionName} from './engine.mjs';
export const escapeHTML=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function empireLabel(room,owner){
 const faction=owner===0?'Sol':factionName(owner),member=room?.members.find(m=>m.owner===owner);
 return member?`${member.name} · ${faction}`:`${faction}${room?' · bot':''}`;
}
