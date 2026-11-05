// Internal save data. Diplomacy is deliberately not consumed by the planner.
export const BOT_TRAITS = Object.freeze({
 territory: ['opportunist', 'patrimonial', 'positional'],
 risk: ['prudent', 'calculating', 'bold'],
 deployment: ['dispersed', 'mobile', 'concentrated'],
 investment: ['economic', 'industrial', 'fortifier'],
 diplomacy: ['reserved', 'pragmatic', 'sociable'],
});
export function createBotProfile(random = Math.random) {
 return Object.fromEntries(Object.entries(BOT_TRAITS).map(([key, values]) => [key, values[Math.min(2, Math.floor(random() * 3))]]));
}
// Legacy games receive repeatable profiles using public geometry only. Loading
// the same old save twice cannot reroll personalities or consume map randomness.
export function botProfile(g, owner) {
 let seed = 2166136261;
 for (const char of `${owner}:${g.stars.map(s => `${s.x},${s.y}`).join(';')}`) seed = Math.imul(seed ^ char.charCodeAt(0), 16777619) >>> 0;
 const fallback = createBotProfile(() => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; });
 const saved = g.botProfiles?.[owner];
 return Object.fromEntries(Object.entries(BOT_TRAITS).map(([key, values]) => [key, values.includes(saved?.[key]) ? saved[key] : fallback[key]]));
}
export function ensureBotProfiles(g) {
 g.botProfiles = g.credits.map((_, owner) => botProfile(g, owner));
 const old = g.botStates;
 g.botStates = g.credits.map((_, owner) => {
  const state = old?.[owner];
  return (state?.focus === null || (Number.isInteger(state?.focus) && state.focus >= 0 && state.focus < g.stars.length)) && Number.isInteger(state?.since) && state.since >= 0 && state.since <= g.tick
   ? {focus: state.focus, since: state.since} : {focus: null, since: g.tick};
 });
}
