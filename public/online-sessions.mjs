export const ACTIVE_SESSION='solaris-online-v1',SAVED_SESSIONS='solaris-online-sessions-v1';
export const validSession=s=>!!s&&/^[A-F0-9]{12}$/.test(s.code)&&/^[a-f0-9]{64}$/.test(s.key);
export class SessionBook {
 constructor(storage){
  this.storage=storage;this.entries=[];this.active=null;
  try{const entries=JSON.parse(storage.getItem(SAVED_SESSIONS));if(Array.isArray(entries))this.entries=entries.filter(validSession);}catch{}
  try{const active=JSON.parse(storage.getItem(ACTIVE_SESSION));if(validSession(active)){this.active=active;this.put(active);}}catch{}
 }
 put(session,room){
  if(!validSession(session))throw Error('Arquivo de acesso inválido.');
  const previous=this.entries.find(e=>e.code===session.code);
  const entry={...previous,code:session.code,key:session.key};
  if(room)Object.assign(entry,{name:room.members.find(m=>m.owner===room.owner)?.name??'',tick:room.game?.tick??null,finished:room.game?.winner!=null,updatedAt:Date.now()});
  this.entries=[entry,...this.entries.filter(e=>e.code!==session.code)];
  return entry;
 }
 save(session,room){this.put(session,room);this.active={code:session.code,key:session.key};this.flush();}
 flush(){
  // Other tabs may have saved a different room since this book was opened.
  try{const saved=JSON.parse(this.storage.getItem(SAVED_SESSIONS));if(Array.isArray(saved))for(const entry of saved.filter(validSession))if(!this.entries.some(e=>e.code===entry.code))this.entries.push(entry);}catch{}
  this.storage.setItem(SAVED_SESSIONS,JSON.stringify(this.entries));if(this.active)this.storage.setItem(ACTIVE_SESSION,JSON.stringify(this.active));else this.storage.removeItem(ACTIVE_SESSION);
 }
 deactivate(){this.active=null;this.flush();}
}
export function readAccessFile(text){
 let data;try{data=JSON.parse(text);}catch{throw Error('Escolha um arquivo de acesso do Solaris.');}
 if(data?.format!=='solaris-access-v1'||!validSession(data))throw Error('Arquivo de acesso inválido.');
 return {code:data.code,key:data.key};
}
export const accessFile=session=>JSON.stringify({format:'solaris-access-v1',code:session.code,key:session.key},null,2);
