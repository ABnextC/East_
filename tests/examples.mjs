import { createGame, legalActions, apply, price, _endPeriod } from '../src/engine.js';
import assert from 'node:assert';
// 예시 1: 주가 5에서 구매 → 6
let s = createGame({ seed: 3 }); s.stock[0].idx = 4; s.phase = 'B'; s.sub = { started: true, passes: 0 }; s.turn = 0; s.awaiting = { type: 'stock', player: s.initiative[0] };
apply(s, legalActions(s).find(a => a.type === 'buyShare' && a.company === 0)); assert.equal(price(s, 0), 6);
// 예시 2: 43GP 판매(3등, 순위 보너스 0), 판매 마커 20+ → 40+ : 주가 9 → 11
s = createGame({ seed: 3 }); const io = s.initiative, p = io[2];
s.players[io[0]].sales = 60; s.players[io[1]].sales = 50; s.players[p].sales = 43; s.players[io[3]].sales = 0;
s.players[p].salesMarker = 2; s.stock[p].idx = 8; const cash = s.players[p].treasury;
_endPeriod(s);
assert.equal(price(s, p), 11); assert.equal(s.players[p].salesMarker, 4); assert.equal(s.players[p].treasury >= cash + 43 - 0, true);
assert.equal(s.initiative[0], io[3]); // 판매액 최저가 새 1번
// 예시 3: 주식 매도는 주가 1칸 하락
s = createGame({ seed: 9 }); const q = s.awaiting.player; s.players[q].shares[1] = 1; s.stock[1].inExchange = 6; s.stock[1].idx = 6;
apply(s, legalActions(s).find(a => a.type === 'sellShare')); assert.equal(price(s, 1), 6); assert.equal(s.stock[1].idx, 5);
console.log('examples ok');
{ // 0번 자리가 지은 교역소 칸은 남이 못 쓴다
  const { legalActions: L, createGame: C } = await import('../src/engine.js');
  const g = C({ seed: 5 }); g.cities['II0'] = 0; g.cities['II1'] = 1;
  const p = g.awaiting.player; g.players[p].treasury = 50;
  const bad = L(g).filter(a => a.slot === 'tradingPost' && a.region === 'II');
  if (bad.length) throw new Error('full region still offered'); console.log('trading post ok');
}
{ // 배당을 못 내면 주식을 팔게 하고, 그래도 모자라면 부채
  const E = await import('../src/engine.js');
  const g = E.createGame({ seed: 11 }); const io = g.initiative, c = io[0], h = io[1];
  g.players.forEach(pl => { pl.sales = 0; pl.treasury = 0; });
  g.stock[c].idx = 20; // 배당 4
  g.players[h].shares[c] = 2; g.stock[c].inExchange = 5;  // 내야 할 배당 8
  g.players[c].shares[h] = 1; g.stock[h].inExchange = 6; g.stock[h].idx = 2; // 팔 수 있는 주식 1장(4GP)
  g.phase = 'F'; g.sub = {}; g.awaiting = null;
  // advance는 내부 함수라 행동 하나를 통해 진행: F에서 바로 멈춰야 함
  E._endPeriod(g);
  if (g.awaiting.type !== 'raise' || g.awaiting.player !== c) throw new Error('should ask to sell, got ' + JSON.stringify(g.awaiting));
  const la = E.legalActions(g); if (!la.length || la.some(a => a.type !== 'sellShare')) throw new Error('raise must only offer sells');
  const got = E.price(g, h); E.apply(g, la[0]); // 판 돈만큼 내고 나머지는 부채
  const pc = g.players[c];
  if (pc.shares.some(k => k)) throw new Error('share not sold');
  if (pc.debt !== 8 - got || pc.treasury !== 0) throw new Error(`debt ${pc.debt} cash ${pc.treasury}`);
  if (g.players[h].treasury < 8) throw new Error('holder not paid in full');
  console.log('debt ok');
}
