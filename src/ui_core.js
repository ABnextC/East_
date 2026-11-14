const PCOL = ['var(--p0)', 'var(--p1)', 'var(--p2)', 'var(--p3)'];
const PHASE_KO = { A: '요원 배치', B: '증권거래소', C: '항해', D: '적재', E: '판매', F: '정산' };
const PERIOD_KO = ['', '1700–1750', '1750–1800', '1800–1840', '1840–1870', '1870–1900'];
const SLOT_SHORT = { spice: '향신료 +1', coffee: '커피 +1', silk: '비단 +1', buyShip: '배 구입', dock: '부두 확장', influenceIndies: '인도 카드 선택', tradingPost: '교역소 3', initiative: '주도권', freeSailing: '항해비 면제', influenceEurope: '유럽 카드 선택' };
const SLOT_PHASE = { spice: 'E', coffee: 'E', silk: 'E', influenceIndies: 'C', initiative: 'B', freeSailing: 'C', influenceEurope: 'C' };
const FOCUS = { raise: 'sec-ports', place: 'sec-chars', stock: 'sec-stock', chooseCard: 'bar', sail: 'sec-map', load: 'sec-indies', sellWarehouse: 'sec-europe', unload: 'sec-europe' };
let G, history = [], ui = {}, lastFocus = '';
let MODE = null; // 'local' | 'online'
const NET = { db: null, user: null, uid: null, canWrite: null, code: null, ref: null, unsub: null, ver: 0, busy: false, room: null, roomsUnsub: null, rooms: [] };
const TAB = Math.random().toString(36).slice(2, 8);
let mine = new Set();
const canAct = () => !!G && !G.over && (MODE === 'local' || mine.has(G.awaiting.player));
const seeAll = () => MODE === 'local';
const $ = id => document.getElementById(id);
const esc = t => String(t).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const meeple = (p, cls = '') => `<svg class="meeple ${cls}" viewBox="0 0 24 24" style="fill:${PCOL[p]}" aria-label="${esc(G.players[p].name)} 요원"><path d="M12 2a4 4 0 0 1 3.6 5.7c3 .8 6.4 2.6 6.4 4.8 0 1.2-1.6 1.5-3.4 1.3L20 22h-5.5L12 17.5 9.5 22H4l1.4-8.2C3.6 14 2 13.7 2 12.5c0-2.2 3.4-4 6.4-4.8A4 4 0 0 1 12 2z"/></svg>`;
const coin = n => `<span class="coin">${n}</span>`;
const cube = (g, cls = '') => `<i class="cube ${g} ${cls}" title="${GOOD_KO[g]}"></i>`;
const pdot = p => `<i class="pdot" style="background:${PCOL[p]}"></i>`;
function save() { if (MODE !== 'local') return; try { localStorage.setItem('eic-save', JSON.stringify(G)); } catch (e) {} }
function load() { try { const t = localStorage.getItem('eic-save'); if (t) { const s = JSON.parse(t); if (s && s.players && s.awaiting) return s; } } catch (e) {} return null; }
function newGame() { MODE = 'local'; G = createGame({ seed: Math.floor(Math.random() * 1e9) }); history = []; ui = {}; lastFocus = ''; save(); render(); }
function trimLog(s) { if (s.log.length > 150) s.log = s.log.slice(-150); }
function doAct(a) {
  if (!a) return;
  if (MODE === 'online') return netAct(a);
  history.push(JSON.stringify(G)); if (history.length > 80) history.shift(); apply(G, a); ui = {}; save(); render();
}
function undo() { if (MODE === 'online') return netUndo(); if (!history.length) return; G = JSON.parse(history.pop()); ui = {}; save(); render(); }
const LA = () => (canAct() ? legalActions(G) : []);
const sameCounts = (a, b) => GOODS.every(g => (a[g] || 0) === (b[g] || 0));
const countOf = arr => arr.reduce((o, g) => (o[g] = (o[g] || 0) + 1, o), {});

function shipDisc(d, p, attrs = '', cls = '') {
  const i = shipInfo(d.type);
  return `<button type="button" class="ship ${cls}" style="--pc:${PCOL[p]}" ${attrs}><span class="ship-n">${SHIP_KO[d.type]}</span><span class="ship-s"><b title="톤수">▣${i.tonnage}</b><b title="속도">≫${i.speed}</b></span>${d.cargo.length ? `<span class="ship-c">${d.cargo.map(g => cube(g)).join('')}</span>` : ''}</button>`;
}

function renderStatus() {
  const aw = G.awaiting;
  $('status').innerHTML = `<div class="st-l"><b class="period">${G.period}기간</b><span class="yrs">${PERIOD_KO[G.period]}</span></div>
    <div class="phases">${'ABCDEF'.split('').map(p => `<span class="${p === G.phase && !G.over ? 'on' : ''}" title="${PHASE_KO[p]}">${p}</span>`).join('')}</div>
    <div class="init">${G.initiative.map((p, i) => `<span class="wheel ${aw.player === p ? 'cur' : ''}" style="--pc:${PCOL[p]}" title="${esc(G.players[p].name)}">${i + 1}</span>`).join('')}</div>`;
}
function renderStock() {
  const tr = DATA.stockTrack, aw = G.awaiting, buy = aw.type === 'stock';
  const cells = tr.prices.map((pr, i) => `<div class="sx d${tr.dividends[i]}"><span class="sx-d">${i === 0 || tr.dividends[i] !== tr.dividends[i - 1] ? '배당 ' + tr.dividends[i] : ''}</span><span class="sx-p">${pr}</span><span class="sx-m">${G.stock.map((s, c) => s.idx === i ? pdot(c) : '').join('')}</span></div>`).join('');
  const certs = G.players.map((pl, c) => { const ok = buy && LA().some(a => a.type === 'buyShare' && a.company === c);
    return `<button type="button" class="cert ${ok ? 'legal' : ''}" style="--pc:${PCOL[c]}" ${ok ? `data-buy="${c}"` : 'disabled'}><span class="cert-n">${esc(pl.name)}</span><span class="cert-k">${G.stock[c].inExchange}장</span>${coin(price(G, c))}</button>`; }).join('');
  $('sec-stock').innerHTML = `<h2>증권거래소</h2><div class="sxwrap"><div class="sxtrack">${cells}</div></div><div class="certs">${certs}</div>`;
}
function renderChars() {
  const aw = G.awaiting, la = aw.type === 'place' ? LA() : [];
  const slotBtn = (c, sl) => { const key = c + '.' + sl, occ = G.occ[key] || [], acts = la.filter(a => a.type === 'place' && a.char === c && a.slot === sl);
    return `<button type="button" class="slot ${acts.length ? 'legal' : ''}" ${acts.length ? `data-slot="${key}"` : 'disabled'}>${SLOT_PHASE[sl] ? `<span class="ph">${SLOT_PHASE[sl]}</span>` : ''}<span class="slot-t">${SLOT_SHORT[sl]}</span><span class="slot-m">${occ.map(p => meeple(p)).join('')}${acts.length && occ.length ? `<span class="fee">+${occ.length}</span>` : ''}</span></button>`; };
  const card = c => `<div class="char c-${c}"><div class="portrait">${CHAR_KO[c][0]}</div><h3>${CHAR_KO[c]}</h3>${SLOTS[c].map(sl => slotBtn(c, sl)).join('')}</div>`;
  const cacts = la.filter(a => a.type === 'place' && a.char === 'center');
  const center = `<button type="button" class="center ${cacts.length ? 'legal' : ''}" ${cacts.length ? 'data-center="1"' : 'disabled'}><span>중앙</span><span class="slot-m">${G.center.map(p => meeple(p)).join('')}</span></button>`;
  $('sec-chars').innerHTML = `<h2>캐릭터</h2><div class="ring">${card('trader')}${card('investor')}${center}${card('shipowner')}${card('captain')}${card('governor')}</div><p class="hint">옆자리: 상인–선주–총독–선장–투자자–상인</p>`;
}
function renderMap() {
  const aw = G.awaiting, sail = aw.type === 'sail', la = sail ? LA() : [];
  const regs = ['III', 'II', 'I'].map(r => { const rg = DATA.regions[r];
    const ok = sail && ui.ship != null && la.some(a => a.dock === ui.ship && a.region === r);
    const ships = G.regions[r].map(e => { const d = G.players[e.p].docks[e.dock]; const cur = aw.type === 'load' && aw.player === e.p && aw.dock === e.dock;
      if (!seeAll() && G.phase === 'C' && !d.stayed && !mine.has(e.p)) return `<span class="ship back" style="--pc:${PCOL[e.p]}" title="뒤집어 둔 배">?</span>`;
      return shipDisc(d, e.p, 'disabled', (cur ? 'cur ' : '') + (d.stayed ? 'stay' : '')); }).join('');
    return `<button type="button" class="region ${ok ? 'legal' : ''}" ${ok ? `data-region="${r}"` : ''} ${!ok && !ships ? 'disabled' : ''}><div class="rg-h"><b>${r}</b> ${rg.name} ${rg.sailCost ? coin(rg.sailCost) : '<span class="free">무료</span>'} <span class="rg-g">${rg.goods.map(g => cube(g)).join('')}</span></div>
      <div class="cities">${rg.cities.map((c, i) => `<span class="city">${G.cities[r + i] != null ? `<i class="post" style="background:${PCOL[G.cities[r + i]]}"></i>` : '<i class="post none"></i>'}${c}</span>`).join('')}</div><div class="rg-s">${ships}</div></button>`; }).join('');
  $('sec-map').innerHTML = `<h2>인도 지도</h2><div class="map">${regs}</div>`;
}
function marketBoard(m) {
  const prices = Object.keys(DATA.markets4p[m]).filter(k => /^\d+$/.test(k)).map(Number).sort((a, b) => a - b);
  const rows = prices.map(p => `<tr><th>${coin(p)}</th>${GOODS.map(g => { const sl = marketSlots(m, g), n = G.markets[m][g]; let h = '';
    sl.forEach((v, i) => { if (v !== p) return; const next = m === 'europe' ? i === n : i === n - 1; h += `<i class="cube ${i < n ? g : 'empty'} ${next ? 'next' : ''}"></i>`; });
    return `<td>${h}</td>`; }).join('')}</tr>`).join('');
  const k = G.period <= 2 ? 'p1-2' : G.period <= 4 ? 'p3-4' : 'p5', peeked = G.cards[m] != null && !G.cards.shown[m] && (G.cards.peek[m] || []).some(p => seeAll() || mine.has(p)), c = G.cards[m] != null && (G.cards.shown[m] || peeked) ? DATA.marketCards[m][k][G.cards[m]].all : null;
  const dice = GOODS.map((g, i) => `<td><span class="die ${g}">${G.dice[m][g]}</span>${c ? `<span class="cardn">+${c[i]}</span>` : ''}</td>`).join('');
  const now = GOODS.map(g => { const v = m === 'europe' ? sellPrice(G, g) : buyPrice(G, g); return `<td class="now">${v == null ? '–' : v}</td>`; }).join('');
  return `${peeked ? '<p class="hint peek">영향력으로 미리 본 카드 값이 노란 숫자로 보입니다.</p>' : ''}<div class="scroll"><table class="mk ${m}"><thead><tr><th></th>${GOODS.map(g => `<th>${cube(g)}<br>${GOOD_KO[g]}</th>`).join('')}</tr><tr class="dice"><th>${m === 'europe' ? '수요' : '공급'}</th>${dice}</tr></thead><tbody>${rows}</tbody><tfoot><tr><th>${m === 'europe' ? '판매가' : '구매가'}</th>${now}</tr></tfoot></table></div>`;
}
function renderMarkets() {
  $('sec-europe').innerHTML = `<h2>유럽 시장</h2>${marketBoard('europe')}<p class="hint">팔면 테두리 친 칸에 큐브가 놓입니다. 카드는 E 단계에 공개됩니다.</p>`;
  $('sec-indies').innerHTML = `<h2>인도 시장</h2>${marketBoard('indies')}<p class="hint">테두리 친 큐브부터 삽니다. 카드는 D 단계에 공개됩니다.</p>`;
}
function renderPorts() {
  const aw = G.awaiting, la = LA(), first = MODE === 'online' && mine.size ? [...mine] : G.over ? [] : [aw.player];
  const order = [...first, ...G.initiative.filter(p => !first.includes(p))];
  $('sec-ports').innerHTML = `<h2>항구</h2>` + order.map(p => { const pl = G.players[p], mine = canAct() && p === aw.player;
    const docks = [...Array(dockCount(pl)).keys()].map(i => { const d = pl.docks[i]; if (!d) return `<span class="dock">빈 부두</span>`;
      if (d.loc !== 'port' && d.loc !== 'sea') return `<span class="dock away">${DATA.regions[d.loc].name}에 있음</span>`;
      const can = mine && aw.type === 'sail' && d.loc === 'port';
      const cur = mine && aw.type === 'unload' && aw.dock === i;
      return shipDisc(d, p, can ? `data-ship="${i}"` : 'disabled', (can ? 'legal ' : '') + (mine && ui.ship === i ? 'sel ' : '') + (cur ? 'cur ' : '') + (d.loc === 'sea' ? 'sea' : '')); }).join('');
    const held = pl.shares.map((k, c) => { if (!k) return ''; const ok = mine && la.some(a => a.type === 'sellShare' && a.company === c);
      return `<button type="button" class="cert mini ${ok ? 'legal' : ''}" style="--pc:${PCOL[c]}" ${ok ? `data-sell="${c}"` : 'disabled'}><span class="cert-n">${esc(G.players[c].name)}</span><span class="cert-k">×${k}</span></button>`; }).join('');
    const marks = [0, 1, 2, 3, 4, 5].map(i => `<span class="sm ${pl.salesMarker === i ? 'on' : ''}">${i ? i * 10 + '+' : '0'}</span>`).join('');
    const left = pl.agents.filter(a => a.at == null).map(() => meeple(p)).join('');
    return `<div class="port ${mine ? 'mine' : ''}" style="--pc:${PCOL[p]}"><div class="port-h"><b>${esc(pl.name)}</b>${MODE === 'online' && NET_MINE(p) ? '<span class="me">나</span>' : ''}${left}<span class="vault">금고 ${coin(pl.treasury)}</span><span class="vault">판매액 ${coin(pl.sales)}</span>${pl.debt ? `<span class="vault debt">부채 ${pl.debt}</span>` : ''}</div>
      <div class="docks">${docks}<span class="wh">창고 ${pl.warehouse.length}/${whCap(pl)} ${pl.warehouse.map(g => cube(g)).join('')}</span></div>
      <div class="port-f"><span class="smt">${marks}</span><span class="certs-h"><button type="button" class="cert mini" style="--pc:${PCOL[p]}" disabled><span class="cert-n">경영권</span><span class="cert-k">×2</span></button>${held}</span></div>
      <div class="hint">살 수 있는 배: ${[...new Set(pl.supply)].map(t => { const i = shipInfo(t); return `${SHIP_KO[t]}${pl.supply.filter(x => x === t).length > 1 ? '×2' : ''}<span class="${i.period > G.period ? 'late' : ''}">(${i.period}기간~, ${i.cost}GP)</span>`; }).join(' ') || '없음'}</div></div>`; }).join('');
}
function renderBar() {
  const bar = $('bar');
  if (G.over) { bar.innerHTML = `<div class="bar-t"><b>게임 종료</b></div><div class="scroll"><table class="score"><thead><tr><th>순위</th><th>회사</th><th>경영권</th><th>주식</th><th>현금</th><th>부채</th><th>합계</th></tr></thead><tbody>${G.ranking.map((p, i) => { const sc = G.scores[p]; return `<tr><td>${i + 1}</td><td>${pdot(p)}${esc(G.players[p].name)}</td><td>${sc.president}</td><td>${sc.shares}</td><td>${sc.cash}</td><td>${sc.debt ? '−' + sc.debt : ''}</td><td><b>${sc.total}</b></td></tr>`; }).join('')}</tbody></table></div>`; return; }
  const aw = G.awaiting, p = aw.player, pl = G.players[p], la = LA();
  let msg = '', ctl = '';
  if (!canAct()) {
    bar.innerHTML = `<div class="bar-t" style="--pc:${PCOL[p]}">${meeple(p, 'lg')}<div><b>${esc(pl.name)}</b> <span class="bar-ph">${G.phase} ${PHASE_KO[G.phase]}</span><div class="bar-m">${esc(pl.name)} 님 차례입니다. 기다리는 중…</div></div></div>`;
    return;
  }
  if (ui.chooser) { msg = ui.chooser.title; ctl = ui.chooser.acts.map((a, i) => `<button type="button" class="go" data-ch="${i}">${esc(a.short)}</button>`).join('') + `<button type="button" data-cancel="1">취소</button>`; }
  else if (aw.type === 'place') { msg = '빛나는 칸을 눌러 요원을 놓으세요'; if (la.some(a => a.type === 'passA')) ctl = `<button type="button" class="go" data-pass="passA">중앙 요원을 두고 마침</button>`; }
  else if (aw.type === 'raise') { msg = `${esc(G.players[aw.to].name)}에게 배당 ${aw.need}GP를 내야 하는데 금고가 ${pl.treasury}GP예요. 주식을 팔아 돈을 마련하세요. 팔 주식이 없으면 모자란 만큼 부채로 남아요.`; ctl = la.map(a => `<button type="button" class="go" data-forced="${a.company}">${esc(a.label)}</button>`).join(''); }
  else if (aw.type === 'stock') { msg = '거래소의 주식을 눌러 1장 사거나 패스하세요'; ctl = `<button type="button" class="go" data-pass="pass">패스</button>`; }
  else if (aw.type === 'chooseCard') { msg = `${aw.market === 'indies' ? '인도(공급)' : '유럽(수요)'} 카드를 고르세요`; ctl = la.filter(a => a.type === 'chooseCard').map(a => { const c = DATA.marketCards[aw.market][G.period <= 2 ? 'p1-2' : G.period <= 4 ? 'p3-4' : 'p5'][a.card].all; return `<button type="button" class="mcard ${aw.market}" data-card="${a.card}">${GOODS.map((g, i) => `<span>${cube(g)}${c[i]}</span>`).join('')}</button>`; }).join(''); }
  else if (aw.type === 'sail') { msg = ui.ship == null ? '보낼 배를 누르세요' : '빛나는 지역을 누르세요'; }
  else if (aw.type === 'load') {
    const d = pl.docks[aw.dock], rg = DATA.regions[aw.region], t = shipInfo(d.type).tonnage, pick = ui.pick || (ui.pick = {});
    const goodsOf = pk => rg.goods.flatMap(g => Array(pk[g] || 0).fill(g));
    const find = pk => la.find(a => a.type === 'load' && sameCounts(countOf(a.goods), pk));
    const total = goodsOf(pick).length, cost = loadCost(G, p, aw.region, goodsOf(pick));
    msg = `${SHIP_KO[d.type]} · ${rg.name} · 톤수 ${total}/${t}`;
    ctl = rg.goods.map(g => { const up = find({ ...pick, [g]: (pick[g] || 0) + 1 }); const nextCost = up ? loadCost(G, p, aw.region, goodsOf({ ...pick, [g]: (pick[g] || 0) + 1 })) - cost : null;
      return `<span class="step"><button type="button" data-minus="${g}" ${pick[g] ? '' : 'disabled'} aria-label="${GOOD_KO[g]} 빼기">−</button><span class="step-n">${cube(g)}${pick[g] || 0}</span><button type="button" data-plus="${g}" ${up ? '' : 'disabled'} aria-label="${GOOD_KO[g]} 싣기">+${nextCost != null ? `<small>${nextCost}</small>` : ''}</button></span>`; }).join('')
      + `<button type="button" class="go" data-load="1">${total ? `싣기 ${cost}GP` : '빈 배로 귀환'}</button>` + (la.some(a => a.type === 'stay') ? `<button type="button" data-stay="1">잔류 1GP</button>` : '');
  } else if (aw.type === 'sellWarehouse' || aw.type === 'unload') {
    const src = aw.type === 'unload' ? pl.docks[aw.dock].cargo : pl.warehouse;
    if (!ui.sell || ui.sell.length !== src.length) ui.sell = src.map(() => true);
    const counts = countOf(src.filter((_, i) => ui.sell[i])), act = la.find(a => a.type === aw.type && sameCounts(a.sell, counts));
    msg = aw.type === 'unload' ? `${SHIP_KO[pl.docks[aw.dock].type]} 하역 — 큐브를 눌러 팔기/보관을 바꾸세요` : '창고 — 큐브를 눌러 팔기/보관을 바꾸세요';
    ctl = src.map((g, i) => `<button type="button" class="pickc ${ui.sell[i] ? 'on' : ''}" data-tg="${i}">${cube(g, 'big')}<small>${ui.sell[i] ? '판매' : '보관'}</small></button>`).join('')
      + `<button type="button" class="go" data-sellgo="1" ${act ? '' : 'disabled'}>${act ? `확정 +${saleGain(G, p, counts)}GP` : '창고 자리 부족'}</button>`;
  }
  bar.innerHTML = `<div class="bar-t" style="--pc:${PCOL[p]}">${meeple(p, 'lg')}<div><b>${esc(pl.name)}</b> <span class="bar-ph">${G.phase} ${PHASE_KO[G.phase]}</span> ${coin(pl.treasury)}<div class="bar-m">${msg}</div></div></div><div class="bar-c">${ctl}</div>`;
}
function render() {
  renderStatus(); renderStock(); renderChars(); renderMap(); renderMarkets(); renderPorts(); renderBar();
  $('log').innerHTML = G.log.slice(-60).reverse().map(l => `<li>${esc(l)}</li>`).join('');
  $('undo').disabled = MODE === 'online' ? !(NET.room && NET.room.prev && NET.room.prevBy === NET.uid && !NET.busy) : !history.length;
  $('new').hidden = MODE !== 'local'; $('leave').hidden = false; $('leave').textContent = MODE === 'online' ? '방 목록으로' : '처음 화면으로';
  $('roomtag').hidden = false; $('roomtag').textContent = MODE === 'online' ? `방 ${NET.code}${NET.hostGone ? ' · 방장 연결 끊김' : ''}` : '혼자 테스트';
  document.title = MODE === 'online' && canAct() ? '● 내 차례 — 동인도회사' : '동인도회사';
  const aw = G.awaiting;
  if (aw.type === 'sail' && ui.ship == null) { const ds = G.players[aw.player].docks.map((d, i) => d && d.loc === 'port' ? i : -1).filter(i => i >= 0); if (ds.length === 1) { ui.ship = ds[0]; renderMap(); renderPorts(); renderBar(); } }
  const f = G.over ? 'over' : aw.type + ':' + aw.player + ':' + G.phase;
  if (f !== lastFocus && (canAct() || G.over)) { lastFocus = f; const id = G.over ? 'bar' : (aw.type === 'sail' ? 'sec-map' : FOCUS[aw.type]); const el = $(id); if (el && id !== 'bar' && el.scrollIntoView) el.scrollIntoView({ block: 'start', behavior: 'smooth' }); }
  document.querySelectorAll('.sect').forEach(s => s.classList.toggle('focus', !G.over && s.id === (FOCUS[aw.type] || '')));
}
const short = a => a.label.replace(/^.*? · /, '').replace(/^배 구입: /, '').replace(/^교역소: /, '');
function choose(title, acts) { if (acts.length === 1) return doAct(acts[0]); ui.chooser = { title, acts: acts.map(a => ({ ...a, short: (a.label.startsWith('(') || a.label.startsWith('중앙에서') ? a.label.split(' · ')[0].replace(/→ .*/, '→ ') + ' ' : '') + short(a) })) }; renderBar(); }
document.addEventListener('click', e => {
  const b = e.target.closest('button'); if (!b || b.disabled) return;
  if (b.dataset.l != null || b.id === 'leave') return lobbyClick(b);
  if (!G) return;
  const ds = b.dataset, aw = G.awaiting, la = LA();
  if (b.id === 'undo') return undo();
  if (b.id === 'new') { $('confirm').hidden = false; return; }
  if (b.id === 'new-yes') { $('confirm').hidden = true; return newGame(); }
  if (b.id === 'new-no') { $('confirm').hidden = true; return; }
  if (ds.cancel) { ui.chooser = null; return renderBar(); }
  if (ds.ch != null) { const a = ui.chooser.acts[+ds.ch]; return doAct(la.find(x => x.key === a.key)); }
  if (ds.slot) { const [c, sl] = ds.slot.split('.'); return choose(`${CHAR_KO[c]} · ${SLOT_KO[sl]}`, la.filter(a => a.type === 'place' && a.char === c && a.slot === sl)); }
  if (ds.center) return choose('중앙에 배치', la.filter(a => a.type === 'place' && a.char === 'center'));
  if (ds.pass) return doAct(la.find(a => a.type === ds.pass));
  if (ds.buy != null) return doAct(la.find(a => a.type === 'buyShare' && a.company === +ds.buy));
  if (ds.forced != null) return doAct(la.find(a => a.type === 'sellShare' && a.company === +ds.forced));
  if (ds.sell != null && aw.type === 'raise') return doAct(la.find(a => a.type === 'sellShare' && a.company === +ds.sell));
  if (ds.sell != null) { const a = la.find(x => x.type === 'sellShare' && x.company === +ds.sell); ui.chooser = { title: '주식 매도 (차례를 쓰지 않음)', acts: [{ ...a, short: a.label }] }; return renderBar(); }
  if (ds.card != null) return doAct(la.find(a => a.type === 'chooseCard' && a.card === +ds.card));
  if (ds.ship != null) { ui.ship = +ds.ship; return render(); }
  if (ds.region) return doAct(la.find(a => a.type === 'sail' && a.dock === ui.ship && a.region === ds.region));
  if (ds.plus) { ui.pick[ds.plus] = (ui.pick[ds.plus] || 0) + 1; return renderBar(); }
  if (ds.minus) { ui.pick[ds.minus]--; return renderBar(); }
  if (ds.load) return doAct(la.find(a => a.type === 'load' && sameCounts(countOf(a.goods), ui.pick || {})));
  if (ds.stay) return doAct(la.find(a => a.type === 'stay'));
  if (ds.tg != null) { ui.sell[+ds.tg] = !ui.sell[+ds.tg]; return renderBar(); }
  if (ds.sellgo) { const src = aw.type === 'unload' ? G.players[aw.player].docks[aw.dock].cargo : G.players[aw.player].warehouse; const counts = countOf(src.filter((_, i) => ui.sell[i])); return doAct(la.find(a => a.type === aw.type && sameCounts(a.sell, counts))); }
});
