import {RANGE, distance, travel, playerView, forecastStar, availableDefense, cost, upgrade, victoryTarget} from './engine.mjs';
import {botProfile} from './bot-profiles.mjs';

const RISKS = {
 prudent: {margin: .25, minimum: 8, reserve: 1.5, exposure: .18, sustain: 2},
 calculating: {margin: .12, minimum: 5, reserve: 1, exposure: .08, sustain: 1},
 bold: {margin: .04, minimum: 2, reserve: .4, exposure: 0, sustain: 0},
};
const INVESTMENTS = {
 economic: {economy: 2.4, industry: 1, defense: .8},
 industrial: {economy: 1, industry: 2.4, defense: .8},
 fortifier: {economy: 1, industry: 1, defense: 2.4},
};

export function planBot(original, owner = 1) {
 // Planning is pure: all empires see the committed position, not reserved orders.
 const committed = structuredClone(original);
 for (const f of committed.orders) committed.stars[f.from].ships += f.ships;
 committed.orders = [];
 const profile = botProfile(original, owner), risk = RISKS[profile.risk];
 const g = playerView(committed, owner), own = g.stars.filter(s => s.owner === owner);
 const targets = g.stars.filter(s => s.owner !== owner), visibleTargets = targets.filter(s => s.visible);
 const orders = [], upgrades = [];
 let state = {focus: null, since: g.tick};
 if (!own.length || !targets.length) return {orders, upgrades, botState: state};
 const neighbors = g.stars.map(a => g.stars.filter(b => b.id !== a.id && distance(a, b) <= RANGE));
 const enemies = s => neighbors[s.id].filter(t => t.owner !== null && t.owner >= 0 && t.owner !== owner);
 const hostile = id => g.fleets.filter(f => f.to === id && f.owner !== owner);
 const forecast = (id, ticks, extra = []) => forecastStar(g, id, ticks, [...orders, ...extra]);
 const income = own.reduce((n, s) => n + s.economy * 3, 0);
 const counts = g.credits.map((_, o) => g.stars.filter(s => s.owner === o).length);
 const goal = victoryTarget(g);
 const nearEnd = Math.max(...counts) >= goal - 2;
 const threatened = s => hostile(s.id).some(f => forecast(s.id, f.remaining).owner !== owner);
 const front = own.filter(s => neighbors[s.id].some(t => t.owner !== owner));

 // Investments compare usefulness per credit; saving is limited to two ticks.
 for (let i = 0; i < Math.min(4, Math.max(2, Math.ceil(own.length / 3))); i++) {
  const options = [];
  for (const s of own) {
   const danger = threatened(s), exposed = enemies(s).length > 0;
   for (const type of ['economy', 'industry', 'defense']) {
    if (s[type] >= (type === 'defense' ? 4 : 8)) continue;
    if (danger && type !== 'defense') continue;
    if (type === 'defense' && !exposed && !hostile(s.id).length) continue;
    const price = cost(s, type);
    let utility = INVESTMENTS[profile.investment][type];
    if (type === 'economy') utility *= (nearEnd ? .15 : g.tick < 18 ? 1.3 : .8) * (exposed ? .75 : 1);
    if (type === 'industry') {
     const distanceToFront = Math.min(...front.map(t => distance(s, t)));
     utility *= 1.5 / (1 + distanceToFront / RANGE * .5);
    }
    if (type === 'defense') utility *= (danger ? 4 : 1.3) / (1 + s.defense * .5);
    // Prudent fortifiers establish a cheap first battery, then favor productive
    // infrastructure instead of stacking speculative defenses on every frontier.
    // A battery that prevents a forecast loss keeps its emergency priority.
    if (type === 'defense' && profile.investment === 'fortifier' && profile.risk === 'prudent' && !danger)
     utility *= .15 ** s.defense;
    // An imminently lost world is not worth buying a battery that cannot save it.
    if (danger && type === 'defense') {
     s.defense++; s.defensePoints += 5;
     const saved = !threatened(s);
     s.defense--; s.defensePoints -= 5;
     if (!saved) continue;
    }
    options.push({s, type, price, score: utility / price});
   }
  }
  options.sort((a, b) => b.score - a.score || a.s.id - b.s.id);
  const affordable = options.find(o => o.price <= g.credits[owner]);
  const desired = options.find(o => o.price <= g.credits[owner] + income * 2);
  if (!affordable || (desired && desired.price > g.credits[owner] && desired.score > affordable.score * 1.35 && !own.some(threatened))) break;
  upgrade(g, owner, affordable.s.id, affordable.type);
  upgrades.push({id: affordable.s.id, type: affordable.type});
 }

 // Reserve enough to survive already committed attacks whenever possible.
 // Personality controls additional caution about potential, uncommitted attacks.
 const available = new Map(own.map(s => {
  const localEnemy = Math.max(0, ...enemies(s).map(t => t.ships));
  const base = (enemies(s).length ? Math.min(12, s.industry * 2 + 2) : 3) * risk.reserve;
  let reserve = counts[owner] >= goal - 1 ? 0 : Math.ceil(base + Math.min(18, localEnemy * risk.exposure));
  const deadlines = [...new Set(hostile(s.id).map(f => f.remaining))];
  if (deadlines.length) {
   const ships = s.ships;
   const safe = kept => { s.ships = kept; const ok = deadlines.every(t => forecast(s.id, t).owner === owner); s.ships = ships; return ok; };
   if (safe(ships)) {
    let lo = 0, hi = ships;
    while (lo < hi) { const mid = Math.floor((lo + hi) / 2); if (safe(mid)) hi = mid; else lo = mid + 1; }
    reserve = Math.max(reserve, lo);
   } else reserve = ships;
  }
  return [s.id, Math.max(0, s.ships - reserve)];
 }));
 const send = (a, b, ships) => {
  ships = Math.min(Math.floor(ships), available.get(a.id));
  if (ships < 1) return;
  const eta = travel(a, b);
  orders.push({owner, from: a.id, to: b.id, ships, total: eta, remaining: eta});
  a.ships -= ships; available.set(a.id, available.get(a.id) - ships);
 };
 const makeWave = (donors, t, amount) => {
  const wave = [];
  for (const a of donors) {
   const ships = Math.min(amount, available.get(a.id));
   if (ships > 0) wave.push({owner, from: a.id, to: t.id, ships, total: travel(a, t), remaining: travel(a, t)});
   amount -= ships;
  }
  return wave;
 };
 // Rescue before expansion, including coordinated attacks by third empires.
 for (const t of own) {
  const attacks = hostile(t.id);
  if (!attacks.length) continue;
  const deadline = [...new Set(attacks.map(f => f.remaining))].sort((a, b) => a - b).find(tick => forecast(t.id, tick).owner !== owner);
  if (deadline === undefined) continue;
  const donors = own.filter(a => a.id !== t.id && distance(a, t) <= RANGE && travel(a, t) <= deadline && available.get(a.id) > 0).sort((a, b) => travel(a, t) - travel(b, t));
  const supply = donors.reduce((n, a) => n + available.get(a.id), 0);
  const safe = n => { const future = forecast(t.id, deadline, makeWave(donors, t, n)); return future.owner === owner && future.ships >= 8; };
  if (!supply || !safe(supply)) continue;
  let lo = 1, hi = supply;
  while (lo < hi) { const mid = Math.floor((lo + hi) / 2); if (safe(mid)) hi = mid; else lo = mid + 1; }
  for (const f of makeWave(donors, t, lo)) send(g.stars[f.from], t, f.ships);
 }

 // Public geometry can be used beyond vision; ownership/resources cannot.
 const positionValue = t => {
  const opened = neighbors[t.id].filter(n => !own.some(s => distance(s, n) <= RANGE)).length;
  const adjacentOwn = neighbors[t.id].filter(n => n.owner === owner);
  let bridges = 0;
  for (let i = 0; i < adjacentOwn.length; i++) for (let j = i + 1; j < adjacentOwn.length; j++)
   if (distance(adjacentOwn[i], adjacentOwn[j]) > RANGE) bridges++;
  const contested = neighbors[t.id].some(n => n.owner !== null && n.owner >= 0 && n.owner !== owner);
  return opened * 12 + Math.min(3, bridges) * 5 + (contested ? 5 : 0);
 };
 const targetScore = (t, eta, needed) => {
  const infrastructure = t.economy * 3 + t.industry * 4, position = positionValue(t);
  if (profile.territory === 'patrimonial') return 35 + infrastructure * 3 + position * .15 - eta * 5 - needed * .3;
  if (profile.territory === 'positional') return 35 + infrastructure * .5 + position * 1.5 - eta * 5 - needed * .3;
  return 60 + infrastructure * .2 + position * .1 - eta * 12 - needed * .8;
 };
 const ranked = visibleTargets.map(t => ({t, score: targetScore(t, Math.min(...own.map(s => travel(s, t))), t.ships + availableDefense(t))})).sort((a, b) => b.score - a.score || a.t.id - b.t.id);
 const previous = original.botStates?.[owner];
 const held = ranked.find(o => o.t.id === previous?.focus);
 const best = ranked[0];
 if (best) {
  const keep = held && (g.tick - previous.since < 4 || held.score + 20 >= best.score);
  state = keep ? {focus: held.t.id, since: previous.since} : {focus: best.t.id, since: g.tick};
 }
 const focused = t => state.focus !== null && (t.id === state.focus || distance(t, g.stars[state.focus]) <= RANGE);
 const regionalOrders = t => orders.filter(f => g.stars[f.to].owner !== owner && distance(t, g.stars[f.to]) <= RANGE).reduce((n, f) => n + f.ships, 0);

 for (let wave = 0; wave < own.length * 2; wave++) {
  const options = [];
  for (const t of visibleTargets) for (const eta of [1, 2]) {
   const donors = own.filter(a => distance(a, t) <= RANGE && travel(a, t) === eta && available.get(a.id) > 0).sort((a, b) => available.get(b.id) - available.get(a.id) || a.id - b.id);
   if (!donors.length) continue;
   const future = forecast(t.id, eta);
   if (future.owner === owner) continue;
   const force = future.ships + availableDefense(future);
   const finishing = counts[owner] + visibleTargets.filter(s => forecast(s.id, eta).owner === owner).length >= goal - 1;
   const blocking = future.owner >= 0 && counts[future.owner] >= goal - 1;
   const emergency = finishing || blocking;
   const margin = emergency ? 1 : Math.max(future.owner === -1 ? 2 : risk.minimum, Math.ceil(force * risk.margin));
   const supply = donors.reduce((n, a) => n + available.get(a.id), 0);
   const succeeds = amount => {
    const extra = makeWave(donors, t, amount), captured = forecast(t.id, eta, extra);
    if (captured.owner !== owner || captured.ships < margin) return false;
    return emergency || !risk.sustain || forecast(t.id, eta + risk.sustain, extra).owner === owner;
   };
   if (!succeeds(supply)) continue;
   let lo = 1, hi = supply;
   while (lo < hi) { const mid = Math.floor((lo + hi) / 2); if (succeeds(mid)) hi = mid; else lo = mid + 1; }
   let score = targetScore(t, eta, lo);
   if (profile.deployment === 'concentrated' && focused(t)) score += 25;
   if (profile.deployment === 'dispersed') score -= regionalOrders(t) * .4;
   if (emergency) score += 10000;
   options.push({t, donors, needed: lo, score});
  }
  options.sort((a, b) => b.score - a.score || a.t.id - b.t.id);
  if (!options.length) break;
  const attack = options[0];
  for (const f of makeWave(attack.donors, attack.t, attack.needed)) send(g.stars[f.from], attack.t, f.ships);
 }

 // Route surplus through owned stars by actual travel time, including detours.
 const paths = new Map(own.map(s => [s.id, new Map(own.map(t => [t.id, s.id === t.id ? 0 : distance(s, t) <= RANGE ? travel(s, t) : Infinity]))]));
 for (const k of own) for (const a of own) for (const b of own)
  paths.get(a.id).set(b.id, Math.min(paths.get(a.id).get(b.id), paths.get(a.id).get(k.id) + paths.get(k.id).get(b.id)));
 const load = t => t.ships + [...g.fleets, ...orders].filter(f => f.to === t.id && f.owner === owner).reduce((n, f) => n + f.ships, 0);
 const hubs = own.map(s => ({s, coverage: front.reduce((n, t) => n + (paths.get(s.id).get(t.id) <= 2 ? 1 : 0), 0)})).sort((a, b) => b.coverage - a.coverage || enemies(a.s).length - enemies(b.s).length || a.s.id - b.s.id);
 for (const a of own) {
  const spare = available.get(a.id);
  if (spare < 5 || !front.length) continue;
  const reachable = front.filter(t => Number.isFinite(paths.get(a.id).get(t.id)));
  if (!reachable.length) continue;
  let destinations = reachable;
  let amount = spare;
  if (profile.deployment === 'concentrated' && state.focus !== null) {
   destinations = [...reachable].sort((x, y) => distance(x, g.stars[state.focus]) - distance(y, g.stars[state.focus]) || load(x) - load(y));
  } else if (profile.deployment === 'mobile') {
   const hub = hubs.find(h => Number.isFinite(paths.get(a.id).get(h.s.id)))?.s;
   if (hub && hub.id !== a.id && load(hub) < reachable.reduce((n, t) => n + load(t), 0) * .4) destinations = [hub];
   else { destinations = [...reachable].sort((x, y) => load(x) - load(y) || x.id - y.id); if (hub?.id === a.id) amount = Math.ceil(spare * .6); }
  } else destinations = [...reachable].sort((x, y) => load(x) - load(y) || x.id - y.id);
  if (profile.deployment === 'dispersed') {
   const average = (destinations.reduce((n, t) => n + load(t), 0) + (front.includes(a) ? 0 : spare)) / destinations.length;
   for (const destination of destinations) {
    if (destination.id === a.id) continue;
    const share = Math.min(available.get(a.id), Math.max(0, Math.floor(average - load(destination))));
    const next = neighbors[a.id].filter(t => t.owner === owner && paths.get(t.id).get(destination.id) < paths.get(a.id).get(destination.id)).sort((x, y) => travel(a, x) + paths.get(x.id).get(destination.id) - travel(a, y) - paths.get(y.id).get(destination.id) || x.id - y.id)[0];
    if (next) send(a, next, share);
   }
   continue;
  }
  const destination = destinations[0];
  if (destination.id === a.id) continue;
  // Avoid equalization ping-pong and leave a meaningful force at a front.
  if (profile.deployment !== 'concentrated' && front.includes(a)) amount = Math.min(amount, Math.max(0, Math.floor((load(a) - load(destination)) / 2)));
  const next = neighbors[a.id].filter(t => t.owner === owner && paths.get(t.id).get(destination.id) < paths.get(a.id).get(destination.id)).sort((x, y) => travel(a, x) + paths.get(x.id).get(destination.id) - travel(a, y) - paths.get(y.id).get(destination.id) || x.id - y.id)[0];
  if (next) send(a, next, amount);
 }
 return {orders, upgrades, botState: state};
}
