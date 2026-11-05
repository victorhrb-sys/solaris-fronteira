// Shared rules for local play and authoritative online rooms. State-changing
// commands mutate the supplied game; playerView is the boundary for hidden data.
import {createBotProfile, ensureBotProfiles} from './bot-profiles.mjs';
import {planBot} from './bot-planner.mjs';
import {pickApprovedMap} from './map-picker.mjs';
import {spacedMap} from './map-spacing.mjs';
export const SPEED=190, RANGE=340, VISION=340;
export const names=['Sol','Vega','Altair','Mira','Sirius','Deneb','Lyra','Atlas','Polaris','Rigel','Antares','Arcturus','Orion','Nashira','Bellatrix','Acrux','Spica','Nexus'];
export const factionNames=['Você','Órion','Lyra','Draco','Fênix','Astra','Vórtice','Titã'];
export const factionColors=['#348bff','#f7983e','#ee79c7','#5dd695','#b19aff','#efd15e','#64d8ea','#ff6e73'];
export const factionName=o=>o===-1?'Milícia':factionNames[o]??`Império ${o+1}`;
export const victoryTarget=g=>Math.ceil(g.stars.length/2);
export function mapBounds(g){const xs=g.stars.map(s=>s.x),ys=g.stars.map(s=>s.y);return {x:(Math.min(...xs)+Math.max(...xs))/2,y:(Math.min(...ys)+Math.max(...ys))/2,width:Math.max(...xs)-Math.min(...xs)+150,height:Math.max(...ys)-Math.min(...ys)+150};}
export function newGame(playerCount=2){
 if(!Number.isInteger(playerCount)||playerCount<2||playerCount>8)throw Error('Escolha de 2 a 8 jogadores.');
 const layout=spacedMap(pickApprovedMap(playerCount)),homes=[...layout.homes];
 // Randomize who gets each approved starting position without changing geometry.
 for(let i=homes.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[homes[i],homes[j]]=[homes[j],homes[i]];}
 const homeNames=['Sol','Nexus','Talos','Cígnus','Helios','Aurora','Érebo','Cronos'];
 const stars=layout.points.map(([x,y],id)=>{const owner=homes.indexOf(id),home=owner>=0;return {id,name:home?homeNames[owner]:`${names[id%names.length]} ${Math.floor(id/names.length)+1}`,x,y,owner,ships:home?54:5+Math.floor(Math.random()*13),economy:home?3:1,industry:home?3:1,defense:0,defensePoints:0};});
 return {version:3,mapId:layout.id,mapSeed:layout.seed,mapVersion:layout.version,playerCount,botProfiles:Array.from({length:playerCount},()=>createBotProfile()),botStates:Array.from({length:playerCount},()=>({focus:null,since:0})),tick:0,credits:Array(playerCount).fill(60),stars,fleets:[],orders:[],battles:[],autoRoutes:[],nextId:1,winner:null,logs:[{tick:0,text:`Controle ${Math.ceil(stars.length/2)} de ${stars.length} estrelas para vencer.`,kind:'info'}]};
}
// Migrate a copy: loading must preserve the saved geometry and never draw a map.
export function restoreGame(saved) {
    if (!saved || ![1, 2, 3].includes(saved.version) || !Number.isInteger(saved.tick) || saved.tick < 0)
        return null;
    const n = saved.version === 1 ? 2 : saved.playerCount;
    if (!Number.isInteger(n) || n < 2 || n > 8 || saved.stars?.length !== n * 9 || saved.credits?.length !== n || !Array.isArray(saved.fleets) || !Array.isArray(saved.orders))
        return null;
    if (!saved.stars.every((s, i) => s.id === i && Number.isFinite(s.x) && Number.isFinite(s.y) && Number.isInteger(s.owner) && s.owner >= -1 && s.owner < n && Number.isInteger(s.ships) && s.ships >= 0))
        return null;
    const g = structuredClone(saved);
    // Version 1 used owner 2 for a draw, before games supported a third empire.
    if (g.version === 1 && g.winner === 2)
        g.winner = -1;
    if (g.version < 3)
        for (const s of g.stars) {
            s.defense = 0;
            s.defensePoints = 0;
        }
    if (!g.stars.every(s => Number.isSafeInteger(s.defense) && s.defense >= 0 && Number.isSafeInteger(s.defensePoints) && s.defensePoints >= 0 && s.defensePoints <= s.defense * 5))
        return null;
    g.version = 3;
    g.playerCount = n;
    g.battles = Array.isArray(g.battles) ? g.battles : [];
    g.autoRoutes = Array.isArray(g.autoRoutes) ? g.autoRoutes : [];
    ensureBotProfiles(g);
    if (g.winner === null)
        checkVictory(g);
    return g;
}
export function checkVictory(g){
 if(g.winner!==null)return;
 const counts=Array(g.credits.length).fill(0);for(const s of g.stars)if(Number.isInteger(s.owner)&&s.owner>=0)counts[s.owner]++;
 const qualified=counts.map((stars,owner)=>({stars,owner})).filter(p=>p.stars>=victoryTarget(g));
 if(!qualified.length)return;
 g.winner=qualified.length===1?qualified[0].owner:-1;
 log(g,g.winner===-1?'Empate: dois impérios atingiram 50% no mesmo turno.':`${factionName(g.winner)} venceu com ${counts[g.winner]} de ${g.stars.length} estrelas.`,g.winner===0?'good':'war');
}
export const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
// Vision is granted only by owned stars; fleets never extend sensor coverage.
export function pointVisible(g,owner,point){return g.stars.some(s=>s.owner===owner&&distance(s,point)<=VISION+1e-9);}
export function visibleStars(g,owner){return new Set(g.stars.filter(s=>pointVisible(g,owner,s)).map(s=>s.id));}
export function fleetPosition(g,f,progress=0){if(Number.isFinite(f.x)&&Number.isFinite(f.y))return {x:f.x,y:f.y};const a=g.stars[f.from],b=g.stars[f.to],t=g.orders?.some(o=>o.id===f.id)?.16:1-f.remaining/f.total+progress/f.total;return {x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t};}
export function movementVisible(g,owner,f){if(f.owner===owner)return true;const a=fleetPosition(g,f,0),b=fleetPosition(g,f,1),dx=b.x-a.x,dy=b.y-a.y,len=dx*dx+dy*dy;return g.stars.some(s=>{if(s.owner!==owner)return false;const t=len?Math.max(0,Math.min(1,((s.x-a.x)*dx+(s.y-a.y)*dy)/len)):0;return distance(s,{x:a.x+t*dx,y:a.y+t*dy})<=VISION+1e-9;});}
export function battleVisible(b,owner){return b.observedBy?.includes(owner)??b.forces.some(f=>f.owner===owner&&f.total+ (f.defense??0)>0);}
// Construct the public perspective explicitly; spreading the full game here
// would expose opponents' credits, preparation, and bot state in online rooms.
export function playerView(g, owner) {
    const visible = visibleStars(g, owner),
        battles = (g.battles || []).filter(b => battleVisible(b, owner))
            .map(({ observedBy, ...b }) => b),
        ids = new Set(battles.map(b => b.id));
    const stars = g.stars.map(s => visible.has(s.id) ? { ...s, visible: true } : {
        id: s.id, name: s.name, x: s.x, y: s.y,
        owner: null, ships: null, economy: null, industry: null,
        defense: null, defensePoints: null, visible: false
    });
    const fleets = g.fleets.flatMap(f => {
        if (f.owner === owner)
            return [{ ...f }];
        const point = fleetPosition(g, f);
        if (!pointVisible(g, owner, point))
            return [];
        const a = g.stars[f.from], b = g.stars[f.to],
            heading = a && b ? Math.atan2(b.y - a.y, b.x - a.x) * 180 / Math.PI : f.heading;
        // Seeing a fleet does not reveal a hidden origin, destination, or ETA.
        return [visible.has(f.from) && visible.has(f.to) ? { ...f } : {
            id: f.id, owner: f.owner, ships: f.ships, ...point,
            ...(Number.isFinite(heading) ? { heading } : {})
        }];
    });
    return {
        version: g.version, playerCount: g.playerCount, tick: g.tick,
        credits: g.credits.map((c, i) => i === owner ? c : null),
        stars, fleets,
        orders: g.orders.filter(f => f.owner === owner).map(f => ({ ...f })),
        autoRoutes: (g.autoRoutes || []).filter(r => r.owner === owner),
        battles,
        logs: g.logs.filter(l => l.battleId ? ids.has(l.battleId) : !l.observedBy || l.observedBy.includes(owner))
            .map(({ observedBy, ...l }) => l),
        winner: g.winner,
        winningStars: g.winner >= 0 && g.winner !== null ? totals(g, g.winner).stars : null
    };
}
export const travel=(a,b)=>Math.max(1,Math.ceil(distance(a,b)/SPEED));
export const cost=(s,type)=>({economy:20,industry:24,defense:15}[type])*((s[type]??0)+1);
export const defenseCapacity=s=>(s.defense??0)*5;
export const availableDefense=s=>Math.min(defenseCapacity(s),Math.max(0,s.defensePoints??0));
export const defenseAfterTicks=(s,ticks)=>Math.min(defenseCapacity(s),availableDefense(s)+(s.owner>=0?2*ticks:0));
export function totals(g,owner){const a=g.stars.filter(s=>s.owner===owner);return {stars:a.length,ships:a.reduce((v,s)=>v+s.ships,0)+[...g.fleets,...g.orders].filter(f=>f.owner===owner).reduce((v,f)=>v+f.ships,0),income:a.reduce((v,s)=>v+s.economy*3,0),production:a.reduce((v,s)=>v+s.industry*2,0)};}
export function queue(g,owner,from,to,ships){const a=g.stars[from],b=g.stars[to];if(g.winner!==null||!a||!b||a.owner!==owner||from===to||distance(a,b)>RANGE||!Number.isInteger(ships)||ships<1||ships>a.ships)throw Error('Escolha uma origem sua, um destino ao alcance e uma quantidade válida.');a.ships-=ships;const f={id:g.nextId++,owner,from,to,ships,total:travel(a,b),remaining:travel(a,b)};g.orders.push(f);return f;}
export function cancel(g,id){const f=g.orders.find(f=>f.id===id&&f.owner===0);if(!f||g.winner!==null)throw Error('Esta ordem não pode ser cancelada.');g.stars[f.from].ships+=f.ships;g.orders=g.orders.filter(o=>o.id!==id);}
export function upgrade(g,owner,id,type){const s=g.stars[id];if(!s||s.owner!==owner||!['economy','industry','defense'].includes(type)||g.winner!==null)throw Error('Melhoria inválida.');const n=cost(s,type);if(g.credits[owner]<n)throw Error('Créditos insuficientes.');g.credits[owner]-=n;const previous=availableDefense(s);s[type]=(s[type]??0)+1;if(type==='defense')s.defensePoints=previous+5;}
export function setAutoRoute(g,owner,from,to,reserve){
const a=g.stars[from],b=g.stars[to];
if(g.winner!==null||!Number.isInteger(from)||!Number.isInteger(to)||!a||!b||a.owner!==owner||b.owner!==owner||from===to||distance(a,b)>RANGE)throw Error('Escolha duas estrelas suas dentro do alcance de 340 UA.');
if(!Number.isSafeInteger(reserve)||reserve<0)throw Error('A reserva deve ser um número inteiro de naves, maior ou igual a zero.');
const routes=g.autoRoutes||[],links=new Map(routes.filter(r=>r.owner===owner&&r.enabled&&r.from!==from).map(r=>[r.from,r.to]));links.set(from,to);
const visited=new Set();let cursor=from;while(links.has(cursor)){if(visited.has(cursor))throw Error('Essa rota criaria um circuito. Escolha um destino que não devolva as naves à origem.');visited.add(cursor);cursor=links.get(cursor);}
const existing=routes.find(r=>r.owner===owner&&r.from===from),route={...existing,owner,from,to,reserve,enabled:true,pauseReason:null};g.autoRoutes=[...routes.filter(r=>r.owner!==owner||r.from!==from),route];return route;
}
export function pauseAutoRoute(g,owner,from){const r=(g.autoRoutes||[]).find(r=>r.owner===owner&&r.from===from);if(!r||g.winner!==null)throw Error('Rota indisponível.');r.enabled=false;r.pauseReason='manual';}
export function removeAutoRoute(g,owner,from){if(g.winner!==null)throw Error('A partida já terminou.');g.autoRoutes=(g.autoRoutes||[]).filter(r=>r.owner!==owner||r.from!==from);}
function validateAutoRoutes(g){for(const r of g.autoRoutes||[]){if(r.enabled&&(g.stars[r.from]?.owner!==r.owner||g.stars[r.to]?.owner!==r.owner)){r.enabled=false;r.pauseReason='ownership';log(g,`Rota ${g.stars[r.from]?.name} → ${g.stars[r.to]?.name} pausada: uma estrela mudou de dono.`,'war',[r.owner]);}}}
function sendAutoRoutes(g){validateAutoRoutes(g);for(const r of g.autoRoutes||[]){if(!r.enabled)continue;const a=g.stars[r.from],b=g.stars[r.to];if(!a||!b||distance(a,b)>RANGE)continue;const ships=Math.max(0,a.ships-r.reserve);if(!ships)continue;a.ships-=ships;const eta=travel(a,b);g.fleets.push({id:g.nextId++,owner:r.owner,from:r.from,to:r.to,ships,total:eta,remaining:eta,automatic:true});r.lastSent={tick:g.tick,ships};}}
function log(g,text,kind='info',observedBy=null){g.logs.unshift({tick:g.tick,text,kind,observedBy});g.logs=g.logs.slice(0,70);}
// One deterministic resolver is shared by actual battles and bot forecasts.
export function resolveCombat(star,arrivals){
 const before=star.owner,shipsByOwner=new Map([[before,star.ships]]),points=availableDefense(star);
 for(const f of arrivals)shipsByOwner.set(f.owner,(shipsByOwner.get(f.owner)||0)+f.ships);
 const forces=[...shipsByOwner].map(([owner,total])=>({owner,garrison:owner===before?star.ships:0,arrivals:arrivals.filter(f=>f.owner===owner).reduce((n,f)=>n+f.ships,0),total,strength:1,defense:owner===before?points:0,force:total+(owner===before?points:0)}));
 const rounds=[];
 let active=forces.filter(f=>f.force>0).map(f=>({owner:f.owner,ships:f.total,defense:f.defense,force:f.force})).sort((a,b)=>a.owner-b.owner);
 // Freeze each round's equal shares. Every pair fights before any survivors regroup.
 while(active.length>1){
  const divisor=active.length-1,participants=active.map(f=>({...f,shareShips:f.ships/divisor,shareDefense:f.defense/divisor,shareForce:f.force/divisor}));
  const next=new Map(active.map(f=>[f.owner,{owner:f.owner,ships:0,defense:0,force:0}])),duels=[];
  for(let i=0;i<participants.length;i++)for(let j=i+1;j<participants.length;j++){
   const left=participants[i],right=participants[j],high=left.shareForce>=right.shareForce?left:right,low=high===left?right:left;
   const tied=Math.abs(high.shareForce-low.shareForce)<=Number.EPSILON*16*Math.max(1,high.shareForce);
   // Equivalent to M - m²/M, but stable when the two forces are nearly equal.
   const remainingForce=tied?0:(high.shareForce-low.shareForce)*(1+low.shareForce/high.shareForce);
   const ships=tied?0:Math.min(high.shareShips,remainingForce),defense=tied?0:Math.max(0,remainingForce-ships),winner=tied?null:high.owner;
   if(winner!==null){const total=next.get(winner);total.ships+=ships;total.defense+=defense;total.force=total.ships+total.defense;}
   duels.push({left:left.owner,right:right.owner,leftForce:left.shareForce,rightForce:right.shareForce,winner,ships,defense,remainingForce});
  }
  const survivors=[...next.values()];rounds.push({number:rounds.length+1,participants,duels,survivors});
  // At least the weakest side loses every duel, so there are at most N - 1 rounds.
  active=survivors.filter(f=>f.force>0);
 }
 const survivor=active[0],winner=survivor?.owner??null,tied=winner===null&&forces.length>1,ownerAfter=winner??before;
 // Fractions stay internal throughout all rounds; quantize only the final result.
 const remainingForce=survivor?Math.round(survivor.force):0;
 const initial=forces.find(f=>f.owner===winner),remaining=survivor?Math.min(initial.total,remainingForce,Math.round(survivor.ships)):0;
 const defenseAfter=winner===before?Math.min(points,Math.max(0,remainingForce-remaining)):0;
 for(const f of forces){f.survived=winner===f.owner?remaining:0;f.lost=f.total-f.survived;f.defenseAfter=f.owner===before?defenseAfter:0;f.defenseLost=f.defense-f.defenseAfter;}
 return {ownerAfter,ships:remaining,defense:ownerAfter===before?(star.defense??0):0,defensePoints:defenseAfter,forces,tied,winner,remainingForce,rounds};
}
export function forecastStar(g,id,ticks,planned=[]){
 let star={...g.stars[id]};
 for(let step=1;step<=ticks;step++){if(star.owner>=0){star.ships+=star.industry*2;star.defensePoints=defenseAfterTicks(star,1);}const arriving=[...g.fleets,...planned].filter(f=>f.to===id&&f.remaining===step);if(arriving.length){const result=resolveCombat(star,arriving);star={...star,owner:result.ownerAfter,ships:result.ships,defense:result.defense,defensePoints:result.defensePoints};}}
 return star;
}
export const botPlan=planBot;
export function applyBotState(g,owner,plan){ensureBotProfiles(g);g.botStates[owner]=plan.botState??{focus:null,since:g.tick};}
export function advance(g, withBot = true, movementLog = null) {
    if (g.winner !== null)
        return;
    // Plan every bot before applying any plan, so iteration order gives no
    // empire advance knowledge. Online rooms supply their own plans (withBot=false).
    const plans = withBot ? g.credits.map((_, owner) => owner ? { owner, ...botPlan(g, owner) } : null).filter(Boolean) : [];
    for (const plan of plans) {
        applyBotState(g, plan.owner, plan);
        for (const u of plan.upgrades)
            upgrade(g, plan.owner, u.id, u.type);
        for (const f of plan.orders)
            queue(g, plan.owner, f.from, f.to, f.ships);
    }
    // Manual reservations depart first; production then supplies automatic routes.
    g.fleets.push(...g.orders);
    g.orders = [];
    g.tick++;
    for (const s of g.stars)
        if (s.owner !== -1) {
            g.credits[s.owner] += s.economy * 3;
            s.ships += s.industry * 2;
            s.defensePoints = defenseAfterTicks(s, 1);
        }
    sendAutoRoutes(g);
    const sightBefore = g.credits.map((_, owner) => visibleStars(g, owner));
    // Group all arrivals before resolving combat. A newly arrived fleet cannot
    // depart along another automatic route until the next tick.
    const arrivals = new Map();
    for (const f of g.fleets) {
        if (movementLog)
            movementLog.push({ ...f });
        f.remaining--;
        if (f.remaining <= 0) {
            if (!arrivals.has(f.to))
                arrivals.set(f.to, []);
            arrivals.get(f.to).push(f);
        }
    }
    g.fleets = g.fleets.filter(f => f.remaining > 0);
    for (const [id, fs] of arrivals) {
        const s = g.stars[id], before = s.owner, result = resolveCombat(s, fs);
        s.owner = result.ownerAfter;
        s.ships = result.ships;
        s.defense = result.defense;
        s.defensePoints = result.defensePoints;
        if (result.forces.length > 1) {
            const battle = { id: `${g.tick}-${id}`, tick: g.tick, starId: id, starName: s.name, defender: before, ownerAfter: s.owner, captured: before !== s.owner, remaining: s.ships, observedBy: g.credits.map((_, owner) => owner).filter(owner => sightBefore[owner].has(id) || result.forces.some(f => f.owner === owner && f.force > 0)), rule: 'moderate-duels', tied: result.tied, rounds: result.rounds, remainingForce: result.remainingForce, defenseAfter: result.defensePoints, forces: result.forces };
            g.battles = [battle, ...(g.battles || [])].slice(0, 80);
            const label = factionName(s.owner);
            log(g, `${s.name}: ${label} ${before !== s.owner ? 'conquistou a estrela' : 'manteve a posição'}. ${s.ships} naves${result.defensePoints ? ` · ${result.defensePoints} defesa` : ''}.`, s.owner === 0 ? 'good' : 'war');
            g.logs[0].battleId = battle.id;
        }
        else if (s.owner === 0)
            log(g, `${s.name} recebeu ${fs.reduce((n, f) => n + f.ships, 0)} naves de reforço.`, 'good', [0]);
    }
    // Reports retain who could witness this tick, even after coverage later changes.
    const sightAfter = g.credits.map((_, owner) => visibleStars(g, owner));
    for (const battle of g.battles.filter(b => b.tick === g.tick))
        for (let owner = 0; owner < g.playerCount; owner++)
            if (sightAfter[owner].has(battle.starId) && !battle.observedBy.includes(owner))
                battle.observedBy.push(owner);
    validateAutoRoutes(g);
    // Victory is checked once, after every star has resolved this same tick.
    checkVictory(g);
    return g;
}
