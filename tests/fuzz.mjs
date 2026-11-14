import { createGame, legalActions, apply, check, price } from '../src/engine.js';
const games = +process.argv[2] || 500, EVX = process.argv.includes('events'); let steps = 0, totals = [], maxLen = 0;
for (let seed = 1; seed <= games; seed++) {
  const s = createGame({ seed, events: EVX }); let r = seed * 7919, k = 0;
  const rnd = () => { r = (r * 1103515245 + 12345) & 0x7fffffff; return r / 0x7fffffff; };
  while (!s.over) {
    const la = legalActions(s); if (!la.length) throw new Error(`no actions seed ${seed} ${JSON.stringify(s.awaiting)}`);
    let pool = la.filter(a => !a.extra); if (!pool.length || rnd() < 0.03) pool = la;
    apply(s, pool[Math.floor(rnd() * pool.length)]);
    const e = check(s); if (e.length) throw new Error(`seed ${seed}: ${e.join(';')}`);
    if (++k > 5000) throw new Error('too long ' + seed);
  }
  steps += k; maxLen = Math.max(maxLen, k); totals.push(...s.scores.map(x => x.total));
}
// 재현성
const run = seed => { const s = createGame({ seed, events: EVX }); let i = 0; while (!s.over) { const la = legalActions(s); apply(s, la[(i++ * 31) % la.length]); } return JSON.stringify(s.scores) + s.log.length; };
if (run(42) !== run(42)) throw new Error('not deterministic');
totals.sort((a, b) => a - b);
console.log(`ok${EVX ? ' (events)' : ''} games=${games} avgSteps=${(steps / games).toFixed(0)} maxSteps=${maxLen} score min/med/max=${totals[0]}/${totals[totals.length >> 1]}/${totals.at(-1)}`);
