// Room protocol, independent of HTTP. D1 stores a confirmed game plus private
// per-member actions; only roomView may cross the boundary back to a client.
import {newGame,playerView,queue,upgrade,setAutoRoute,pauseAutoRoute,removeAutoRoute,botPlan,applyBotState,advance,totals} from '../public/engine.mjs';
import {turnSummary} from './turn-summary.mjs';

export class RoomError extends Error { constructor(message,status=400){super(message);this.status=status;} }
const fail=(message,status)=>{throw new RoomError(message,status);};
const validKey=k=>typeof k==='string'&&/^[a-f0-9]{64}$/.test(k);
export async function hashKey(key){
 if(!validKey(key))fail('Chave pessoal inválida.',401);
 return [...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(key)))].map(v=>v.toString(16).padStart(2,'0')).join('');
}
const nameOf=name=>typeof name==='string'&&name.trim().length>0&&name.trim().length<=24?name.trim():fail('Use um nome de 1 a 24 caracteres.');
function authenticate(room,hash){const p=room.members.find(m=>m.hash===hash);if(!p)fail('Chave pessoal não pertence a esta sala.',401);return p;}
function action(g,owner,a){
 if(!a||typeof a!=='object')fail('Ação inválida.');
 switch(a.type){
  case 'send':return queue(g,owner,a.from,a.to,a.ships);
  case 'upgrade':return upgrade(g,owner,a.star,a.upgrade);
  case 'route':return setAutoRoute(g,owner,a.from,a.to,a.reserve);
  case 'pause':return pauseAutoRoute(g,owner,a.from);
  case 'remove':return removeAutoRoute(g,owner,a.from);
  case 'cancel':{const order=g.orders.find(o=>o.id===a.id&&o.owner===owner);if(!order)fail('Ordem indisponível.');g.stars[order.from].ships+=order.ships;g.orders=g.orders.filter(o=>o!==order);return;}
  default:fail('Ação desconhecida.');
 }
}
// Replay just this member's preparation on a copy, never on the confirmed game.
export function draft(room, p) {
    const g = structuredClone(room.game);
    for (const a of p.actions)
        action(g, p.owner, a);
    return g;
}
function active(room){return room.members.filter(p=>!p.resigned&&(totals(room.game,p.owner).stars+totals(room.game,p.owner).ships)>0);}
function resolve(room) {
    const humans = active(room);
    if (!humans.length || !humans.every(p => p.ready) || room.game.winner !== null)
        return;
    const g = room.game, botOwners = Array.from({ length: room.capacity }, (_, i) => i).filter(i => !room.members.some(p => p.owner === i && !p.resigned));
    // All plans and drafts see the same confirmed position. Build them before
    // merging anyone's purchases or reserved ships into the shared game.
    const plans = botOwners.map(owner => ({ owner, ...botPlan(g, owner) }));
    const drafts = room.members.filter(p => !p.resigned).map(p => ({ owner: p.owner, g: draft(room, p) }));
    for (const { owner, g: d } of drafts) {
        g.credits[owner] = d.credits[owner];
        for (const s of d.stars)
            if (s.owner === owner)
                g.stars[s.id] = { ...s };
        // Drafts share the old nextId; assign unique fleet IDs when merging them.
        g.orders.push(...d.orders.filter(o => o.owner === owner).map(o => ({ ...o, id: g.nextId++ })));
        g.autoRoutes = [...g.autoRoutes.filter(r => r.owner !== owner), ...d.autoRoutes.filter(r => r.owner === owner)];
    }
    for (const p of plans) {
        applyBotState(g, p.owner, p);
        for (const u of p.upgrades)
            upgrade(g, p.owner, u.id, u.type);
        for (const f of p.orders)
            queue(g, p.owner, f.from, f.to, f.ships);
    }
    const before = structuredClone(g), movements = [];
    // Bots have already planned, including resigned humans. Do not plan twice.
    advance(g, false, movements);
    room.turnSummaries = Object.fromEntries(room.members.map(p => [p.owner, turnSummary(before, g, movements, p.owner)]));
    for (const p of room.members) {
        p.ready = false;
        p.actions = [];
    }
}
export function roomView(room,hash){
 const p=authenticate(room,hash),playing=room.game!==null,humans=playing?active(room):room.members;
 const view=playing?playerView(draft(room,p),p.owner):null;
 if(view)view.logs=view.logs.map(l=>({...l,text:l.text.replaceAll('Você','Sol')}));
 return {code:room.code,revision:room.revision,capacity:room.capacity,owner:p.owner,host:room.host===p.owner,started:playing,
  ready:p.ready,resigned:p.resigned,canPlay:playing&&humans.some(m=>m.owner===p.owner),readyCount:humans.filter(m=>m.ready).length,humanCount:humans.length,
  members:room.members.map(m=>({owner:m.owner,name:m.name,ready:m.ready,resigned:m.resigned,active:humans.some(h=>h.owner===m.owner)})),
  turnSummary:room.turnSummaries?.[p.owner]??null,
  game:view};
}
export async function createRoom(db,input,key){
 const hash=await hashKey(key),name=nameOf(input.name),capacity=input.capacity;
 if(!Number.isInteger(capacity)||capacity<2||capacity>8)fail('Escolha de 2 a 8 impérios.');
 // A retry with the same freshly generated personal key recovers the same room.
 const code=hash.slice(0,12).toUpperCase();
 const room={code,revision:0,capacity,host:0,game:null,members:[{owner:0,name,hash,actions:[],ready:false,resigned:false,requests:[]}]};
 await db.prepare('INSERT OR IGNORE INTO rooms (code,revision,data,updated_at) VALUES (?,0,?,?)').bind(code,JSON.stringify(room),Date.now()).run();
 return accessRoom(db,code,key);
}
export async function accessRoom(db, code, key, input = null) {
    if (!/^[A-F0-9]{12}$/.test(code))
        fail('Código da sala inválido.');
    const hash = await hashKey(key);
    // Optimistic concurrency: after a conflicting write, reread and revalidate
    // the request. Never publish a result computed from an obsolete revision.
    for (let attempt = 0; attempt < 12; attempt++) {
        const row = await db.prepare('SELECT data,revision FROM rooms WHERE code = ?').bind(code).first();
        if (!row)
            fail('Sala não encontrada.', 404);
        const room = JSON.parse(row.data);
        room.revision = row.revision;
        if (!input)
            return roomView(room, hash);
        if (typeof input.requestId !== 'string' || !/^[a-zA-Z0-9-]{16,64}$/.test(input.requestId))
            fail('Identificador de ação inválido.');
        let p = room.members.find(m => m.hash === hash);
        // Retries return the current view without repeating a successful action.
        if (p?.requests.includes(input.requestId))
            return roomView(room, hash);
        if (input.type === 'join') {
            if (p)
                return roomView(room, hash);
            if (room.game || room.members.length >= room.capacity)
                fail('A sala já começou ou está cheia.');
            p = { owner: room.members.length, name: nameOf(input.name), hash, actions: [], ready: false, resigned: false, requests: [] };
            room.members.push(p);
        }
        else {
            p = authenticate(room, hash);
            if (input.type === 'start') {
                if (p.owner !== room.host)
                    fail('Só o anfitrião pode iniciar.', 403);
                if (room.game)
                    fail('A partida já começou.', 409);
                if (room.members.length < 2)
                    fail('Aguarde pelo menos dois humanos.');
                room.game = newGame(room.capacity);
            }
            else {
                if (!room.game || room.game.winner !== null)
                    fail('A partida não está em andamento.', 409);
                if (input.tick !== room.game.tick)
                    fail('O turno mudou. Confira a partida e tente novamente.', 409);
                if (p.resigned)
                    fail('Seu império está sob controle de um bot.', 403);
                if (p.requestTick !== room.game.tick) {
                    p.requests = [];
                    p.requestTick = room.game.tick;
                }
                if (input.type === 'resign') {
                    p.resigned = true;
                    p.ready = false;
                    p.actions = [];
                }
                else if (input.type === 'ready') {
                    p.ready = Boolean(input.ready);
                }
                else if (input.type === 'action') {
                    if (p.ready)
                        fail('Desfaça a confirmação antes de alterar ordens.', 409);
                    if (p.actions.length >= 200)
                        fail('Limite de 200 ações por turno.');
                    action(draft(room, p), p.owner, input.action);
                    p.actions.push(input.action);
                }
                else
                    fail('Comando desconhecido.');
                resolve(room);
            }
        }
        // Preserve all request ids within a tick. Old ticks are rejected after reset.
        p.requests.push(input.requestId);
        room.revision++;
        const result = await db.prepare('UPDATE rooms SET data = ?, revision = ?, updated_at = ? WHERE code = ? AND revision = ?').bind(JSON.stringify(room), room.revision, Date.now(), code, row.revision).run();
        if (result.meta.changes === 1)
            return roomView(room, hash);
    }
    fail('A sala está ocupada. Tente novamente.', 409);
}
