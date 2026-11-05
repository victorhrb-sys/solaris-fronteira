import assert from 'node:assert/strict';
import {SessionBook,ACTIVE_SESSION,SAVED_SESSIONS,accessFile,readAccessFile} from './public/online-sessions.mjs';
import {empireLabel,escapeHTML} from './public/online-labels.mjs';
import {turnSummary} from './server/turn-summary.mjs';
import {newGame,advance} from './fixtures/legacy-game.mjs';
const data=new Map(),storage={getItem:k=>data.get(k)??null,setItem:(k,v)=>data.set(k,v),removeItem:k=>data.delete(k)};
const first={code:'ABCDEF123456',key:'a'.repeat(64)},second={code:'123456ABCDEF',key:'b'.repeat(64)};
storage.setItem(ACTIVE_SESSION,JSON.stringify(first));
let book=new SessionBook(storage);assert.deepEqual(book.active,first);book.deactivate();
book=new SessionBook(storage);assert.equal(book.active,null);assert.deepEqual(book.entries,[first]);
book.save(second);book.save(first);book.deactivate();book=new SessionBook(storage);
assert.equal(book.entries.length,2);assert.deepEqual(book.entries.find(s=>s.code===second.code),second);
assert.deepEqual(readAccessFile(accessFile(first)),first);assert.throws(()=>readAccessFile('{bad'));
assert.throws(()=>readAccessFile(JSON.stringify({...first,format:'public-invite'})));
assert.throws(()=>readAccessFile(JSON.stringify({format:'solaris-access-v1',...first,key:'short'})));
storage.setItem(SAVED_SESSIONS,JSON.stringify([first,{code:'bad',key:'bad'},second]));assert.equal(new SessionBook(storage).entries.length,2);
const blocked=new SessionBook({getItem(){throw Error('blocked')},setItem(){throw Error('full')}});
assert.throws(()=>blocked.save(first));assert.equal(blocked.entries[0].key,first.key,'Failed storage retains access in memory');
data.clear();const tabA=new SessionBook(storage),tabB=new SessionBook(storage);tabA.save(first);tabB.save(second);
assert.equal(new SessionBook(storage).entries.length,2,'Saving from another tab must preserve both rooms');
const room={members:[{owner:1,name:'<b>Pedro & João</b>'}]};
assert.equal(empireLabel(room,1),'<b>Pedro & João</b> · Órion');assert.equal(escapeHTML(empireLabel(room,1)),'&lt;b&gt;Pedro &amp; João&lt;/b&gt; · Órion');

const g=newGame();for(const s of g.stars)Object.assign(s,{industry:0,economy:0,ships:5});
Object.assign(g.stars[0],{economy:3});g.stars[2].owner=0;g.stars[2].ships=0;g.stars[3].owner=0;
g.orders=[{id:1,owner:0,from:0,to:1,ships:20,total:1,remaining:1},
 {id:2,owner:1,from:17,to:2,ships:40,total:1,remaining:1},
 {id:3,owner:0,from:0,to:3,ships:13,total:1,remaining:1},
 {id:4,owner:1,from:17,to:16,ships:99,total:1,remaining:1}];
const before=structuredClone(g),movements=[];advance(g,false,movements);
const summary=turnSummary(before,g,movements,0);
assert.equal(summary.income,9);assert.equal(summary.tick,1);
assert.deepEqual(summary.gained.map(s=>s.id),[1]);assert.deepEqual(summary.lost.map(s=>s.id),[2]);
assert.deepEqual(summary.arrivals.map(s=>[s.id,s.ships]),[[1,20],[3,13]]);
assert.equal(summary.battles.length,2);assert.equal(summary.battles.filter(b=>b.defending).length,1,'An undefended star still counts as attacked');
assert(!JSON.stringify(summary).includes('99'));assert(!summary.battles.some(b=>b.starId===16));
console.log('Usability: old access migration, multiple rooms, local return, backup import, blocked storage, safe names, arrivals, attacks, capture/loss, income and private summaries passed.');
