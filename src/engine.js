import { DATA } from './data.js';

export const GOODS = ['tea', 'spice', 'coffee', 'silk'];
export const GOOD_KO = { tea: '차', spice: '향신료', coffee: '커피', silk: '비단' };
export const RING = ['trader', 'shipowner', 'governor', 'captain', 'investor'];
export const CHAR_KO = { trader: '상인', shipowner: '선주', governor: '총독', captain: '선장', investor: '투자자', center: '중앙' };
export const SLOTS = {
  trader: ['spice', 'coffee', 'silk'],
  shipowner: ['buyShip', 'dock'],
  governor: ['influenceIndies', 'tradingPost'],
  captain: ['initiative', 'freeSailing'],
  investor: ['buyShip', 'influenceEurope'],
};
export const SLOT_KO = {
  spice: '협상(향신료)', coffee: '협상(커피)', silk: '협상(비단)', buyShip: '배 구입', dock: '부두 확장',
  influenceIndies: '영향력(인도 카드)', tradingPost: '교역소', initiative: '전문가(주도권)',
  freeSailing: '지도 제작(항해비 면제)', influenceEurope: '영향력(유럽 카드)',
};
export const SHIP_KO = { galleon: '갤리온', indiaman: '인디아맨', schooner: '스쿠너', threemaster: '바크', clipper: '클리퍼', pliner: 'P-라이너', steamclipper: '스팀 클리퍼', steamer: '증기선' };
export const REGIONS = ['I', 'II', 'III'];
export const COMPANY_KO = ['빨강', '파랑', '노랑', '회색'];
const SHIP = Object.fromEntries(DATA.ships.types.map(s => [s.id, s]));
export const shipInfo = t => SHIP[t];

// 시장 칸: 비싼 칸부터 나열. n = 큐브 수(비싼 칸부터 차 있음)
const SL = {};
for (const m of ['europe', 'indies']) {
  SL[m] = {};
  for (const g of GOODS) {
    const arr = [];
    const prices = Object.keys(DATA.markets4p[m]).filter(k => /^\d+$/.test(k)).map(Number).sort((a, b) => b - a);
    for (const p of prices) for (let i = 0; i < (DATA.markets4p[m][String(p)][g] || 0); i++) arr.push(p);
    SL[m][g] = arr;
  }
}
export const marketSlots = (m, g) => SL[m][g];

function rnd(s) {
  s.rng = (s.rng + 0x6D2B79F5) | 0;
  let t = s.rng;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
const rint = (s, n) => Math.floor(rnd(s) * n);
function shuffle(s, a) { for (let i = a.length - 1; i > 0; i--) { const j = rint(s, i + 1); [a[i], a[j]] = [a[j], a[i]]; } return a; }
const group = p => (p <= 2 ? 'p1-2' : p <= 4 ? 'p3-4' : 'p5');
const sk = (c, s) => c + '.' + s;
const log = (s, t) => { s.log.push(`[${s.period}${s.phase}] ${t}`); };
const N = s => s.players.length;
const pname = (s, p) => s.players[p].name;

export function createGame({ seed = 1, names = ['빨강', '파랑', '노랑', '회색'] } = {}) {
  const n = names.length;
  const s = { rng: seed | 0, seed, period: 1, phase: 'A', sub: {}, turn: 0, log: [], over: false };
  s.initiative = shuffle(s, [...Array(n).keys()]);
  const money = [10, 10, 11, 12];
  s.players = names.map((name, i) => ({
    name, treasury: 0, sales: 0, salesMarker: 0, ext: 0, warehouse: [],
    docks: [mkShip('galleon'), mkShip('galleon')],
    supply: DATA.ships.types.filter(t => t.id !== 'galleon').flatMap(t => Array(t.count).fill(t.id)),
    shares: Array(n).fill(0), posts: [], doneA: false, debt: 0,
    agents: [0, 1, 2].map(() => ({ last: null, at: null, moved: false })),
  }));
  s.initiative.forEach((p, i) => { s.players[p].treasury = money[i]; });
  s.stock = names.map(() => ({ idx: DATA.stockTrack.startIndex, inExchange: 7 }));
  s.markets = { europe: {}, indies: {} };
  for (const m of ['europe', 'indies']) for (const g of GOODS) s.markets[m][g] = SL[m][g].length - DATA.markets4p.initialEmpty[m][g];
  s.decks = { europe: {}, indies: {} };
  for (const m of ['europe', 'indies']) for (const k of ['p1-2', 'p3-4', 'p5']) s.decks[m][k] = DATA.marketCards[m][k].map((_, i) => i);
  s.cards = { indies: null, europe: null, peek: { indies: [], europe: [] }, shown: { indies: false, europe: false } };
  s.dice = null; s.occ = {}; s.center = []; s.cities = {}; s.regions = { I: [], II: [], III: [] };
  s.awaiting = null;
  advance(s);
  return s;
}
function mkShip(type) { return { type, cargo: [], loc: 'port', stayed: false }; }
export const price = (s, c) => DATA.stockTrack.prices[s.stock[c].idx];
export const dividend = (s, c) => DATA.stockTrack.dividends[s.stock[c].idx];
function moveStock(s, c, d) { s.stock[c].idx = Math.max(0, Math.min(DATA.stockTrack.prices.length - 1, s.stock[c].idx + d)); }
export const dockCount = pl => 2 + pl.ext;
export const whCap = pl => [0, 2, 3][pl.ext];
export const sellPrice = (s, g) => { const a = SL.europe[g], n = s.markets.europe[g]; return n < a.length ? a[n] : 1; };
export const buyPrice = (s, g) => { const n = s.markets.indies[g]; return n > 0 ? SL.indies[g][n - 1] : null; };
const hasSlot = (s, p, key) => (s.occ[key] || []).includes(p);

function rollDice(s) {
  s.dice = { indies: {}, europe: {} };
  for (const m of ['indies', 'europe']) for (const g of GOODS) s.dice[m][g] = DATA.dice.faces[rint(s, 6)];
  log(s, `주사위 — 인도 ${GOODS.map(g => GOOD_KO[g] + s.dice.indies[g]).join(' ')} / 유럽 ${GOODS.map(g => GOOD_KO[g] + s.dice.europe[g]).join(' ')}`);
}

// ---------- 진행 ----------
function advance(s) {
  for (let guard = 0; guard < 10000; guard++) {
    if (s.over) { s.awaiting = { type: 'over', player: null }; return; }
    const ph = s.phase, sub = s.sub;
    if (ph === 'A') {
      if (!sub.started) {
        if (s.period === 5) for (const pl of s.players) { pl.docks = pl.docks.map(d => (d && d.type === 'galleon' ? null : d)); }
        if (s.period === 5) { for (const r of REGIONS) s.regions[r] = s.regions[r].filter(e => s.players[e.p].docks[e.dock]); log(s, '5기간 — 갤리온을 모두 폐기'); }
        rollDice(s); sub.started = true; s.turn = 0;
      }
      const p = nextPlayer(s, q => pendingA(s, q));
      if (p == null) { s.phase = 'B'; s.sub = {}; continue; }
      s.awaiting = { type: 'place', player: p }; return;
    }
    if (ph === 'B') {
      if (!sub.started) {
        const users = s.occ[sk('captain', 'initiative')] || [];
        if (users.length) { s.initiative = [...users, ...s.initiative.filter(p => !users.includes(p))]; log(s, `주도권 변경 → ${s.initiative.map(p => pname(s, p)).join(' > ')}`); }
        sub.started = true; s.turn = 0; sub.passes = 0;
      }
      if (sub.passes >= N(s)) { s.phase = 'C'; s.sub = {}; continue; }
      s.awaiting = { type: 'stock', player: s.initiative[s.turn] }; return;
    }
    if (ph === 'C') {
      if (!sub.step) sub.step = 'cardI';
      if (sub.step === 'cardI' || sub.step === 'cardE') {
        const m = sub.step === 'cardI' ? 'indies' : 'europe';
        const users = s.occ[sk(m === 'indies' ? 'governor' : 'investor', m === 'indies' ? 'influenceIndies' : 'influenceEurope')] || [];
        const deck = s.decks[m][group(s.period)];
        if (users.length) { s.awaiting = { type: 'chooseCard', player: users[0], market: m }; return; }
        takeCard(s, m, deck[rint(s, deck.length)], []);
        continue;
      }
      if (sub.step === 'sail') {
        if (!sub.started) { sub.started = true; s.turn = 0; }
        const p = nextPlayer(s, q => s.players[q].docks.some(d => d && d.loc === 'port'));
        if (p == null) { s.phase = 'D'; s.sub = {}; continue; }
        s.awaiting = { type: 'sail', player: p }; return;
      }
    }
    if (ph === 'D') {
      if (!sub.started) {
        sub.started = true; s.cards.shown.indies = true;
        const card = DATA.marketCards.indies[group(s.period)][s.cards.indies].all;
        GOODS.forEach((g, i) => { const k = s.dice.indies[g] + card[i]; s.markets.indies[g] = Math.min(SL.indies[g].length, s.markets.indies[g] + k); });
        log(s, `인도 카드 공개 — 공급 ${GOODS.map((g, i) => GOOD_KO[g] + '+' + (s.dice.indies[g] + card[i])).join(' ')}`);
        sub.queue = [];
        for (const r of REGIONS) {
          const st = s.regions[r].map((e, i) => ({ ...e, i, region: r }));
          const sh = e => s.players[e.p].docks[e.dock];
          st.sort((a, b) => (sh(b).stayed - sh(a).stayed) || (sh(a).stayed ? a.i - b.i : (SHIP[sh(b).type].speed - SHIP[sh(a).type].speed) || (b.i - a.i)));
          sub.queue.push(...st);
        }
        sub.ptr = 0;
      }
      if (sub.ptr >= sub.queue.length) { s.phase = 'E'; s.sub = {}; continue; }
      const e = sub.queue[sub.ptr];
      s.awaiting = { type: 'load', player: e.p, dock: e.dock, region: e.region }; return;
    }
    if (ph === 'E') {
      if (!sub.step) {
        sub.step = 'wh'; s.turn = 0; sub.whDone = []; s.cards.shown.europe = true;
        const card = DATA.marketCards.europe[group(s.period)][s.cards.europe].all;
        GOODS.forEach((g, i) => { const k = s.dice.europe[g] + card[i]; s.markets.europe[g] = Math.max(0, s.markets.europe[g] - k); });
        log(s, `유럽 카드 공개 — 수요 ${GOODS.map((g, i) => GOOD_KO[g] + '-' + (s.dice.europe[g] + card[i])).join(' ')}`);
      }
      if (sub.step === 'wh') {
        const p = s.initiative.find(q => !sub.whDone.includes(q) && s.players[q].warehouse.length);
        if (p == null) {
          sub.step = 'ships'; sub.queue = []; sub.ptr = 0;
          s.initiative.forEach((p2, oi) => s.players[p2].docks.forEach((d, di) => { if (d && d.loc === 'sea') sub.queue.push({ p: p2, dock: di, oi }); }));
          sub.queue.sort((a, b) => (SHIP[s.players[b.p].docks[b.dock].type].speed - SHIP[s.players[a.p].docks[a.dock].type].speed) || (a.oi - b.oi) || (a.dock - b.dock));
          continue;
        }
        s.awaiting = { type: 'sellWarehouse', player: p }; return;
      }
      if (sub.step === 'ships') {
        while (sub.ptr < sub.queue.length) {
          const e = sub.queue[sub.ptr], d = s.players[e.p].docks[e.dock];
          if (d.cargo.length) break;
          d.loc = 'port'; sub.ptr++;
        }
        if (sub.ptr >= sub.queue.length) { s.phase = 'F'; s.sub = {}; continue; }
        const e = sub.queue[sub.ptr];
        s.awaiting = { type: 'unload', player: e.p, dock: e.dock }; return;
      }
    }
    if (ph === 'F') { if (endPeriod(s)) return; continue; }
  }
  throw new Error('advance loop');
}
function nextPlayer(s, need) {
  for (let i = 0; i < N(s); i++) { const idx = (s.turn + i) % N(s), p = s.initiative[idx]; if (need(p)) { s.turn = idx; return p; } }
  return null;
}
function pendingA(s, p) {
  const pl = s.players[p];
  return pl.agents.some(a => a.at == null) || (!pl.doneA && pl.agents.some(a => a.at === 'center' && !a.moved));
}
function takeCard(s, m, idx, peek) {
  const deck = s.decks[m][group(s.period)];
  deck.splice(deck.indexOf(idx), 1);
  s.cards[m] = idx; s.cards.peek[m] = peek; s.cards.shown[m] = false;
  s.sub.step = m === 'indies' ? 'cardE' : 'sail';
}
export function _endPeriod(s) { s.phase = 'F'; s.sub = {}; endPeriod(s); }
// 갚을 수 있는 만큼 부채를 갚는다
function settle(s, pl) { const r = Math.min(pl.treasury, pl.debt || 0); if (r > 0) { pl.treasury -= r; pl.debt -= r; log(s, `${pl.name}: 부채 ${r}GP 상환 (남은 부채 ${pl.debt})`); } }
// 내야 할 돈: 모자라면 그만큼 부채로 남긴다(받는 쪽은 은행에서 전액을 받는다)
function charge(s, p, amt) { const pl = s.players[p], paid = Math.min(pl.treasury, amt); pl.treasury -= paid; if (amt > paid) { pl.debt = (pl.debt || 0) + amt - paid; log(s, `${pl.name}: 돈이 모자라 ${amt - paid}GP를 부채로 남김`); } }
const sellable = pl => pl.shares.some(k => k > 0);
// F 단계. 반환값 true = 플레이어 결정(주식 매도)을 기다림
function endPeriod(s) {
  const sub = s.sub;
  if (!sub.step) {
    const n = N(s), order = s.initiative;
    const rank = [...order].sort((a, b) => (s.players[b].sales - s.players[a].sales) || (order.indexOf(a) - order.indexOf(b)));
    const bonus = n === 4 ? [2, 1, 0, -1] : [2, 1, 0];
    rank.forEach((p, i) => moveStock(s, p, bonus[i] ?? 0));
    for (const p of order) {
      const pl = s.players[p], nm = Math.min(5, Math.floor(pl.sales / 10));
      moveStock(s, p, nm - pl.salesMarker); pl.salesMarker = nm;
    }
    log(s, `판매액 — ${rank.map(p => `${pname(s, p)} ${s.players[p].sales}`).join(', ')}`);
    s.initiative = [...order].sort((a, b) => (s.players[a].sales - s.players[b].sales) || (order.indexOf(a) - order.indexOf(b)));
    for (const pl of s.players) { pl.treasury += pl.sales; pl.sales = 0; settle(s, pl); }
    sub.pay = [];
    for (const c of s.initiative) {
      const dv = dividend(s, c); if (!dv) continue;
      for (const h of s.initiative) if (h !== c && s.players[h].shares[c]) sub.pay.push({ c, h, amt: dv * s.players[h].shares[c] });
    }
    sub.step = 'div'; sub.i = 0;
  }
  if (sub.step === 'div') {
    while (sub.i < sub.pay.length) {
      const { c, h, amt } = sub.pay[sub.i], pc = s.players[c];
      if (pc.treasury < amt && sellable(pc)) { s.awaiting = { type: 'raise', player: c, need: amt, to: h }; return true; }
      charge(s, c, amt); s.players[h].treasury += amt; settle(s, s.players[h]);
      log(s, `배당 — ${pname(s, c)} → ${pname(s, h)} ${amt}GP`); sub.i++;
    }
    sub.step = 'done';
  }
  log(s, `주가 — ${s.players.map((pl, c) => `${pl.name} ${price(s, c)}`).join(', ')}`);
  for (const pl of s.players) { pl.doneA = false; for (const a of pl.agents) { a.last = a.at === 'center' ? 'center' : a.at ? a.at.char : null; a.at = null; a.moved = false; } }
  s.occ = {}; s.center = [];
  s.cards = { indies: null, europe: null, peek: { indies: [], europe: [] }, shown: { indies: false, europe: false } };
  if (s.period === 5) {
    s.over = true;
    s.scores = s.players.map((pl, p) => {
      const own = 2 * price(s, p), held = pl.shares.reduce((t, k, c) => t + k * price(s, c), 0), debt = pl.debt || 0;
      return { p, president: own, shares: held, cash: pl.treasury, debt, total: own + held + pl.treasury - debt };
    });
    const io = s.initiative;
    s.ranking = [...s.scores].sort((a, b) => (b.total - a.total) || (price(s, b.p) - price(s, a.p)) || (b.cash - a.cash) || (io.indexOf(a.p) - io.indexOf(b.p))).map(x => x.p);
    log(s, `게임 종료 — ${s.ranking.map(p => `${pname(s, p)} ${s.scores[p].total}`).join(', ')}`);
    return false;
  }
  s.period++; s.phase = 'A'; s.sub = {};
  return false;
}

// ---------- 가능한 행동 ----------
function combos(limits, maxTotal) {
  const keys = Object.keys(limits), out = [];
  (function rec(i, cur, tot) {
    if (i === keys.length) { out.push({ ...cur }); return; }
    for (let k = 0; k <= limits[keys[i]] && tot + k <= maxTotal; k++) { cur[keys[i]] = k; rec(i + 1, cur, tot + k); }
  })(0, {}, 0);
  return out;
}
const cnt = arr => arr.reduce((o, g) => (o[g] = (o[g] || 0) + 1, o), {});
function loadCost(s, p, region, goods) {
  const sim = { ...s.markets.indies }, disc = s.players[p].posts.some(c => c.region === region) ? 1 : 0;
  let cost = 0;
  for (const g of goods) { if (sim[g] <= 0) return null; cost += Math.max(0, SL.indies[g][sim[g] - 1] - disc); sim[g]--; }
  return cost;
}
function saleGain(s, p, counts) {
  let gain = 0;
  for (const g of GOODS) {
    let n = s.markets.europe[g];
    const bonus = g !== 'tea' && hasSlot(s, p, sk('trader', g)) ? 1 : 0;
    for (let i = 0; i < (counts[g] || 0); i++) { gain += (n < SL.europe[g].length ? SL.europe[g][n] : 1) + bonus; n++; }
  }
  return gain;
}
const fmtCounts = c => GOODS.filter(g => c[g]).map(g => `${GOOD_KO[g]} ${c[g]}`).join(', ') || '없음';

export function legalActions(s) {
  const aw = s.awaiting, out = [];
  if (!aw || aw.type === 'over') return out;
  const p = aw.player, pl = s.players[p];
  const add = a => { a.key = JSON.stringify(a); out.push(a); return a; };
  if (aw.type === 'place') {
    const seen = new Set();
    pl.agents.forEach((a, ai) => {
      if (a.at != null && !(a.at === 'center' && !a.moved)) return;
      const tag = a.at === 'center' ? 'c' : 'n:' + a.last;
      if (seen.has(tag)) return; seen.add(tag);
      const fromCenter = a.at === 'center';
      const chars = (fromCenter || s.period === 1 || a.last == null || a.last === 'center') ? RING
        : RING.filter(c => { const d = Math.abs(RING.indexOf(c) - RING.indexOf(a.last)); return d <= 1 || d === 4; });
      const pre = fromCenter ? '중앙에서 이동 → ' : (a.last && s.period > 1 ? `(${CHAR_KO[a.last]}에 있던 요원) ` : '');
      for (const c of chars) for (const sl of SLOTS[c]) {
        const key = sk(c, sl), occ = s.occ[key] || [];
        if (occ.includes(p)) continue;
        const fee = occ.length, base = { type: 'place', agent: ai, char: c, slot: sl };
        const feeTxt = fee ? ` +자리세 ${fee}` : '';
        if (sl === 'buyShip') {
          const types = [...new Set(pl.supply)].filter(t => SHIP[t].period <= s.period && pl.treasury >= SHIP[t].cost + fee);
          const empty = pl.docks.findIndex((d, i) => i < dockCount(pl) && !d);
          for (const t of types) {
            const tx = `${SHIP_KO[t]}(톤 ${SHIP[t].tonnage}·속 ${SHIP[t].speed}) ${SHIP[t].cost}GP${feeTxt}`;
            if (dockCount(pl) > pl.docks.filter(Boolean).length) add({ ...base, ship: t, dock: empty === -1 ? pl.docks.length : empty, label: `${pre}${CHAR_KO[c]} · 배 구입: ${tx}` });
            else pl.docks.forEach((d, di) => { if (d && d.loc === 'port') add({ ...base, ship: t, dock: di, label: `${pre}${CHAR_KO[c]} · 배 구입: ${tx} — ${di + 1}번 부두 ${SHIP_KO[d.type]} 폐기` }); });
          }
        } else if (sl === 'dock') { if (pl.ext < 2 && pl.treasury >= fee) add({ ...base, label: `${pre}${CHAR_KO[c]} · 부두 확장 ${pl.ext + 1}단계${feeTxt}` }); }
        else if (sl === 'tradingPost') {
          if (pl.posts.length < 2 && pl.treasury >= 3 + fee) for (const r of REGIONS) {
            if (pl.posts.some(x => x.region === r)) continue;
            const ci = DATA.regions[r].cities.findIndex((_, i) => s.cities[r + i] == null);
            if (ci >= 0) add({ ...base, region: r, city: ci, label: `${pre}${CHAR_KO[c]} · 교역소: ${DATA.regions[r].name} ${DATA.regions[r].cities[ci]} 3GP${feeTxt}` });
          }
        } else if (sl === 'initiative') { if (pl.treasury >= s.period + fee) add({ ...base, label: `${pre}${CHAR_KO[c]} · 전문가(주도권) ${s.period}GP${feeTxt}` }); }
        else if (pl.treasury >= fee) add({ ...base, label: `${pre}${CHAR_KO[c]} · ${SLOT_KO[sl]}${feeTxt}` });
      }
      if (!fromCenter) { const fee = s.center.filter(q => q !== p).length; add({ type: 'place', agent: ai, char: 'center', label: `${pre}중앙에 배치(능력 없음)${fee ? ` 자리세 ${fee}` : ''}${fee > pl.treasury ? ` (모자란 ${fee - pl.treasury}GP는 부채)` : ''}` }); }
    });
    if (!pl.agents.some(a => a.at == null)) add({ type: 'passA', label: '중앙 요원을 그대로 두고 마침' });
  }
  if (aw.type === 'stock') {
    s.stock.forEach((st, c) => { if (st.inExchange > 0 && pl.treasury >= price(s, c)) add({ type: 'buyShare', company: c, label: `${pname(s, c)} 주식 1장 구매 (${price(s, c)}GP)` }); });
    add({ type: 'pass', label: '패스' });
  }
  if (aw.type === 'chooseCard') {
    const m = aw.market, k = group(s.period);
    for (const i of s.decks[m][k]) { const c = DATA.marketCards[m][k][i].all; add({ type: 'chooseCard', card: i, label: `${m === 'indies' ? '인도' : '유럽'} 카드: ${GOODS.map((g, j) => GOOD_KO[g] + c[j]).join(' ')}` }); }
  }
  if (aw.type === 'sail') {
    const free = hasSlot(s, p, sk('captain', 'freeSailing'));
    pl.docks.forEach((d, di) => {
      if (!d || d.loc !== 'port') return;
      for (const r of REGIONS) { const cost = free ? 0 : DATA.regions[r].sailCost; if (pl.treasury >= cost) add({ type: 'sail', dock: di, region: r, label: `${SHIP_KO[d.type]}(${di + 1}번) → ${DATA.regions[r].name} ${cost}GP` }); }
    });
  }
  if (aw.type === 'load') {
    const d = pl.docks[aw.dock], rg = DATA.regions[aw.region].goods, t = SHIP[d.type].tonnage;
    const lim = {}; for (const g of rg) lim[g] = Math.min(t, s.markets.indies[g]);
    for (const c of combos(lim, t)) {
      const goods = rg.flatMap(g => Array(c[g]).fill(g)), cost = loadCost(s, p, aw.region, goods);
      if (cost == null || cost > pl.treasury) continue;
      add({ type: 'load', goods, label: goods.length ? `${SHIP_KO[d.type]} 적재: ${fmtCounts(c)} (${cost}GP)` : `${SHIP_KO[d.type]} 빈 배로 귀환` });
    }
    if (s.period < 5 && pl.treasury >= 1) add({ type: 'stay', label: `${SHIP_KO[d.type]} 인도양 잔류 (1GP)` });
  }
  if (aw.type === 'sellWarehouse') {
    for (const c of combos(cnt(pl.warehouse), 99)) add({ type: 'sellWarehouse', sell: c, label: `창고 판매: ${fmtCounts(c)} (+${saleGain(s, p, c)}GP)` });
  }
  if (aw.type === 'unload') {
    const d = pl.docks[aw.dock], cargo = cnt(d.cargo), free = whCap(pl) - pl.warehouse.length;
    for (const c of combos(cargo, 99)) {
      const kept = d.cargo.length - Object.values(c).reduce((a, b) => a + b, 0);
      if (kept > free) continue;
      add({ type: 'unload', sell: c, label: `${SHIP_KO[d.type]} 하역 — 판매: ${fmtCounts(c)} (+${saleGain(s, p, c)}GP)${kept ? `, 창고 보관 ${kept}` : ''}` });
    }
  }
  if (aw.type === 'raise') {
    pl.shares.forEach((k, c) => { if (k > 0) add({ type: 'sellShare', company: c, label: `${pname(s, c)} 주식 1장 매도 (+${price(s, c)}GP)` }); });
    return out;
  }
  if (s.phase !== 'B' && (s.period < 5 || s.phase === 'A')) {
    pl.shares.forEach((k, c) => { if (k > 0) add({ type: 'sellShare', company: c, extra: true, label: `${pname(s, c)} 주식 1장 매도 (+${price(s, c)}GP)` }); });
  }
  return out;
}

export function apply(s, action) {
  const legal = legalActions(s).find(a => a.key === (action.key || JSON.stringify(action)));
  if (!legal) throw new Error('illegal action: ' + JSON.stringify(action));
  const a = legal, aw = s.awaiting, p = aw.player, pl = s.players[p];
  const nextTurn = () => { s.turn = (s.turn + 1) % N(s); };
  if (a.type === 'sellShare') {
    pl.treasury += price(s, a.company); pl.shares[a.company]--; s.stock[a.company].inExchange++; moveStock(s, a.company, -1);
    log(s, `${pl.name}: ${pname(s, a.company)} 주식 매도 → 주가 ${price(s, a.company)}`);
    advance(s); return s;
  }
  if (a.type === 'place') {
    const ag = pl.agents[a.agent];
    if (ag.at === 'center') { s.center.splice(s.center.indexOf(p), 1); ag.moved = true; }
    if (a.char === 'center') {
      const others = s.center.filter(q => q !== p);
      charge(s, p, others.length); for (const q of others) s.players[q].treasury++;
      s.center.push(p); ag.at = 'center';
    } else {
      const key = sk(a.char, a.slot), occ = s.occ[key] || (s.occ[key] = []);
      for (const q of occ) { pl.treasury--; s.players[q].treasury++; }
      occ.push(p); ag.at = { char: a.char, slot: a.slot };
      if (a.slot === 'buyShip') {
        pl.treasury -= SHIP[a.ship].cost; pl.supply.splice(pl.supply.indexOf(a.ship), 1);
        pl.docks[a.dock] = mkShip(a.ship);
      } else if (a.slot === 'dock') pl.ext++;
      else if (a.slot === 'tradingPost') { pl.treasury -= 3; pl.posts.push({ region: a.region, city: a.city }); s.cities[a.region + a.city] = p; }
      else if (a.slot === 'initiative') pl.treasury -= s.period;
    }
    log(s, `${pl.name}: ${a.label}`); nextTurn();
  } else if (a.type === 'passA') { pl.doneA = true; nextTurn(); }
  else if (a.type === 'buyShare') {
    pl.treasury -= price(s, a.company); pl.shares[a.company]++; s.stock[a.company].inExchange--; moveStock(s, a.company, 1);
    s.sub.passes = 0; log(s, `${pl.name}: ${pname(s, a.company)} 주식 구매 → 주가 ${price(s, a.company)}`); nextTurn();
  } else if (a.type === 'pass') { s.sub.passes++; nextTurn(); }
  else if (a.type === 'chooseCard') {
    const m = aw.market, users = s.occ[sk(m === 'indies' ? 'governor' : 'investor', m === 'indies' ? 'influenceIndies' : 'influenceEurope')];
    takeCard(s, m, a.card, [...users]); log(s, `${pl.name}: ${m === 'indies' ? '인도' : '유럽'} 카드를 골라 뒤집어 둠`);
  } else if (a.type === 'sail') {
    const d = pl.docks[a.dock], free = hasSlot(s, p, sk('captain', 'freeSailing'));
    pl.treasury -= free ? 0 : DATA.regions[a.region].sailCost; d.loc = a.region; s.regions[a.region].push({ p, dock: a.dock });
    log(s, `${pl.name}: 배 1척 → ${DATA.regions[a.region].name}`); nextTurn();
  } else if (a.type === 'load' || a.type === 'stay') {
    const d = pl.docks[aw.dock], r = aw.region;
    if (a.type === 'stay') { pl.treasury -= 1; d.stayed = true; }
    else {
      pl.treasury -= loadCost(s, p, r, a.goods);
      for (const g of a.goods) s.markets.indies[g]--;
      d.cargo = [...a.goods]; d.loc = 'sea'; d.stayed = false;
      s.regions[r] = s.regions[r].filter(e => !(e.p === p && e.dock === aw.dock));
    }
    log(s, `${pl.name}: ${a.label}`); s.sub.ptr++;
  } else if (a.type === 'sellWarehouse' || a.type === 'unload') {
    const gain = saleGain(s, p, a.sell);
    for (const g of GOODS) s.markets.europe[g] = Math.min(SL.europe[g].length, s.markets.europe[g] + (a.sell[g] || 0));
    pl.sales += gain;
    const src = a.type === 'unload' ? pl.docks[aw.dock].cargo : pl.warehouse, rest = [...src];
    for (const g of GOODS) for (let i = 0; i < (a.sell[g] || 0); i++) rest.splice(rest.indexOf(g), 1);
    if (a.type === 'unload') { pl.warehouse.push(...rest); pl.docks[aw.dock].cargo = []; pl.docks[aw.dock].loc = 'port'; s.sub.ptr++; }
    else { pl.warehouse = rest; s.sub.whDone.push(p); }
    log(s, `${pl.name}: ${a.label}`);
  }
  advance(s);
  return s;
}

// 불변식 점검(테스트용)
export function check(s) {
  const n = N(s), err = [];
  s.players.forEach((pl, p) => {
    if (pl.treasury < 0) err.push(`treasury<0 ${p}`);
    if ((pl.debt || 0) < 0) err.push(`debt<0 ${p}`);
    if (pl.warehouse.length > whCap(pl)) err.push(`warehouse over ${p}`);
    if (pl.docks.filter(Boolean).length > dockCount(pl)) err.push(`docks over ${p}`);
    if (pl.posts.length > 2) err.push('posts>2');
    for (const d of pl.docks) if (d && d.cargo.length > SHIP[d.type].tonnage) err.push('cargo over');
  });
  for (let c = 0; c < n; c++) { const held = s.players.reduce((t, pl) => t + pl.shares[c], 0); if (held + s.stock[c].inExchange !== 7) err.push(`shares ${c}`); }
  for (const m of ['europe', 'indies']) for (const g of GOODS) { const v = s.markets[m][g]; if (v < 0 || v > SL[m][g].length) err.push(`market ${m} ${g}`); }
  return err;
}
