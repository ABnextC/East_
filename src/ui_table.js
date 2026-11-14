// ---------- 테이블 화면 ----------
// 위에서 내려다본 테이블 하나를 SVG로 그린다. 공식 그림은 쓰지 않고 판·말·큐브·배를 직접 그린다.
// 규칙은 엔진이 계산하고, 사람은 말을 끌어다 놓거나 눌러서 둔다.
const PCOL = ['var(--p0)', 'var(--p1)', 'var(--p2)', 'var(--p3)'];
const PHASE_KO = { A: '요원 배치', B: '증권거래소', C: '항해', D: '적재', E: '판매', F: '정산' };
const PERIOD_KO = ['', '1700', '1750', '1800', '1840', '1870'];
const SLOT_SHORT = { spice: '향신료 +1', coffee: '커피 +1', silk: '비단 +1', buyShip: '배 구입', dock: '부두 확장', influenceIndies: '인도 카드', tradingPost: '교역소 3', initiative: '선두 주도권', freeSailing: '항해비 면제', influenceEurope: '유럽 카드' };
const SLOT_PHASE = { spice: 'E', coffee: 'E', silk: 'E', influenceIndies: 'C', initiative: 'B', freeSailing: 'C', influenceEurope: 'C' };
const GOODC = { tea: '#3f9d57', spice: '#e2703a', coffee: '#5b3a26', silk: '#eef2f4' };
const SHIP_SHORT = { galleon: '갤리온', indiaman: '인디아맨', schooner: '스쿠너', threemaster: '바크', clipper: '클리퍼', pliner: 'P-라이너', steamclipper: '스팀클리퍼', steamer: '증기선' };
let G, history = [], ui = {}, lastFocus = '';
let MODE = null; // 'local' | 'online'
const NET = { db: null, user: null, uid: null, canWrite: null, code: null, ref: null, unsub: null, ver: 0, busy: false, room: null, roomsUnsub: null, rooms: [] };
const TAB = Math.random().toString(36).slice(2, 8);
let mine = new Set();
const canAct = () => !!G && !G.over && (MODE === 'local' || mine.has(G.awaiting.player));
const seeAll = () => MODE === 'local';
const $ = id => document.getElementById(id);
const esc = t => String(t).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const MEEPLE_D = 'M12 2a4 4 0 0 1 3.6 5.7c3 .8 6.4 2.6 6.4 4.8 0 1.2-1.6 1.5-3.4 1.3L20 22h-5.5L12 17.5 9.5 22H4l1.4-8.2C3.6 14 2 13.7 2 12.5c0-2.2 3.4-4 6.4-4.8A4 4 0 0 1 12 2z';
const meeple = (p, cls = '') => `<svg class="meeple ${cls}" viewBox="0 0 24 24" style="fill:${PCOL[p]}" aria-hidden="true"><path d="${MEEPLE_D}"/></svg>`;
const coin = n => `<span class="coin">${n}</span>`;
const cube = (g, cls = '') => `<i class="cube ${g} ${cls}" title="${GOOD_KO[g]}"><svg viewBox="-1 -1 22 22" aria-hidden="true">${glyph(g)}</svg></i>`;
const pdot = p => `<i class="pdot" style="background:${PCOL[p]}"></i>`;
function save() { if (MODE !== 'local') return; try { localStorage.setItem('eic-save', JSON.stringify(G)); } catch (e) {} }
function load() { try { const t = localStorage.getItem('eic-save'); if (t) { const s = JSON.parse(t); if (s && s.players && s.awaiting) return s; } } catch (e) {} return null; }
// 확장 「시대의 사건」 켜기(기본 켬). 새 게임부터 적용
const evOn = () => { try { return localStorage.getItem('eic-events') !== '0'; } catch (e) { return true; } };
function setEv(v) { try { localStorage.setItem('eic-events', v ? '1' : '0'); } catch (e) {} }
const evOptHTML = () => `<label class="opt"><input type="checkbox" id="optev" ${evOn() ? 'checked' : ''}><span><b>확장: 시대의 사건</b><br><span class="hint">기간마다 그 시대의 사건 카드 1장이 공급·수요·항해비 등을 바꿉니다. 새 게임부터 적용</span></span></label>`;
if (typeof document !== 'undefined' && document.addEventListener) document.addEventListener('change', e => { if (e.target && e.target.id === 'optev') setEv(e.target.checked); });
function newGame() { MODE = 'local'; G = createGame({ seed: Math.floor(Math.random() * 1e9), events: evOn() }); history = []; ui = {}; lastFocus = ''; save(); render(); }
function trimLog(s) { if (s.log.length > 150) s.log = s.log.slice(-150); }
function doAct(a) {
  if (!a) return;
  if (MODE === 'online') return netAct(a);
  history.push(JSON.stringify(G)); if (history.length > 80) history.shift(); apply(G, a); ui = { lastEra: ui.lastEra }; save(); render();
}
function undo() { if (MODE === 'online') return netUndo(); if (!history.length) return; G = JSON.parse(history.pop()); ui = { lastEra: ui.lastEra }; save(); render(); }
const LA = () => (canAct() ? legalActions(G) : []);
const sameCounts = (a, b) => GOODS.every(g => (a[g] || 0) === (b[g] || 0));
const countOf = arr => arr.reduce((o, g) => (o[g] = (o[g] || 0) + 1, o), {});
const cardGroup = () => (G.period <= 2 ? 'p1-2' : G.period <= 4 ? 'p3-4' : 'p5');

// ---------- 테이블 배치(월드 좌표) ----------
const TW = 2400, TH = 1700;
const L = {
  status: { x: 60, y: 30, w: 500, h: 150 },
  track: { x: 610, y: 40, cw: 52, h: 120 },
  certs: { x: 1840, y: 22, w: 500, h: 176 },
  map: { x: 610, y: 210, w: 1180, h: 560 },
  chars: { x: 625, y: 800, w: 214, h: 250, gap: 22 },
  center: { cx: 1200, cy: 1120, r: 50 },
  europe: { x: 60, y: 210, w: 500, h: 840 },
  indies: { x: 1840, y: 210, w: 500, h: 840 },
  mats: { x: 60, y: 1190, w: 555, h: 470, gap: 30 },
  event: { x: 1478, y: 1060, w: 352, h: 122 },
};
const RING_ORDER = ['trader', 'shipowner', 'governor', 'captain', 'investor'];
const REG_ORDER = ['III', 'II', 'I'];
const charBox = c => { const i = RING_ORDER.indexOf(c); return { x: L.chars.x + i * (L.chars.w + L.chars.gap), y: L.chars.y, w: L.chars.w, h: L.chars.h }; };
const slotBox = (c, k) => { const b = charBox(c); return { x: b.x + 12, y: b.y + 78 + k * 56, w: b.w - 24, h: 50 }; };
const matBox = p => ({ x: L.mats.x + p * (L.mats.w + L.mats.gap), y: L.mats.y, w: L.mats.w, h: L.mats.h });
const homeSpot = (p, i) => { const m = matBox(p); return { x: m.x + 38 + i * 44, y: m.y + 312 }; };
const dockSpot = (p, k) => { const m = matBox(p); return { x: m.x + 196 + k * 96, y: m.y + 122 }; };
const MK_ROWS = { europe: [3, 4, 5, 6, 7, 8, 9], indies: [1, 2, 3, 4, 5, 6] };
function mkSlotPos(m, g, i) {
  const B = L[m], arr = marketSlots(m, g), p = arr[i], row = MK_ROWS[m].indexOf(p);
  let j = 0; for (let k = 0; k < i; k++) if (arr[k] === p) j++;
  const colX = B.x + 86 + GOODS.indexOf(g) * 102, rowY = B.y + 236 + row * 78;
  return { x: colX + 6 + (j % 4) * 23, y: rowY + 10 + Math.floor(j / 4) * 26 };
}

// ---------- 시대(기간)별 이름과 테마 ----------
const ERA = {
  1: { name: '특허 회사의 시대', years: '1700–1750', sub: ['특허장을 받은 회사들이', '향신료 무역을 다투던 때'],
    sea: ['#a7b28c', '#5f6e55'], land: ['#ecd5a0', '#d3b47c'], coast: '#5e4524', grid: '#f3e6c4', label: 'rgba(84,54,24,.62)', paper: ['#f2dfb5', '#dcc08a'] },
  2: { name: '제국 경쟁의 시대', years: '1750–1800', sub: ['플라시 전투(1757) 뒤 벵골이', '넘어가고 차 무역이 커지던 때'],
    sea: ['#8eae9e', '#4d7064'], land: ['#ecd8a6', '#d6bd88'], coast: '#5e4524', grid: '#f1e6c8', label: 'rgba(84,58,28,.6)', paper: ['#f3e3be', '#ddc596'] },
  3: { name: '자유 무역의 시대', years: '1800–1840', sub: ['회사의 독점이 풀리고(1813·1833)', '싱가포르(1819)가 열리던 때'],
    sea: ['#6fa3ab', '#3a6a73'], land: ['#eddcb0', '#d3dfbf'], coast: '#6f5a3a', grid: '#e4f1ee', label: 'rgba(90,64,34,.55)', paper: ['#f4e8cc', '#e2d0a6'] },
  4: { name: '클리퍼와 차 경주의 시대', years: '1840–1870', sub: ['아편 전쟁 뒤 항구가 열리고', '쾌속 범선이 차를 나르던 때'],
    sea: ['#5e9fb2', '#2d6074'], land: ['#efe3c0', '#cfe0c2'], coast: '#6f5a3a', grid: '#e4f1ee', label: 'rgba(80,62,40,.55)', paper: ['#f5ebd2', '#e4d4ae'] },
  5: { name: '증기와 수에즈의 시대', years: '1870–1900', sub: ['수에즈 운하(1869)와 해저 전신으로', '증기선이 바다를 차지한 때'],
    sea: ['#86b8d6', '#3d6f98'], land: ['#f3ecd6', '#dfe6c8'], coast: '#46525e', grid: '#ffffff', label: 'rgba(52,62,76,.55)', paper: ['#f6f0de', '#e5dcc2'] },
};
const era = () => ERA[(G && G.period) || 1];
// ---------- 상품 그림 ----------
const GLYPH = {
  tea: (c, b) => `<path d="M4 16.5C4 8.5 9 3.5 16.5 3.5C16.5 11 11.5 16.5 4 16.5Z" fill="${c}"/><path d="M4.5 16L13 7.5" stroke="${b}" stroke-width="1.3" stroke-linecap="round"/>`,
  spice: (c) => `<path d="${(() => { let d = ''; for (let k = 0; k < 16; k++) { const a = Math.PI * k / 8 - Math.PI / 2, r = k % 2 ? 2.8 : 7.6; d += (k ? 'L' : 'M') + (10 + r * Math.cos(a)).toFixed(2) + ' ' + (10 + r * Math.sin(a)).toFixed(2); } return d + 'Z'; })()}" fill="${c}"/><circle cx="10" cy="10" r="1.5" fill="${c}" opacity=".6"/>`,
  coffee: (c, b) => `<ellipse cx="10" cy="10" rx="5.4" ry="7.6" transform="rotate(35 10 10)" fill="${c}"/><path d="M8.2 4.6c4.6 3.4-1 7.4 3.6 10.8" fill="none" stroke="${b}" stroke-width="1.4" stroke-linecap="round" transform="rotate(35 10 10) translate(0 0)"/>`,
  silk: (c, b) => `<rect x="4" y="3" width="12" height="2.6" rx="1" fill="${c}"/><rect x="4" y="14.4" width="12" height="2.6" rx="1" fill="${c}"/><rect x="6" y="5.6" width="8" height="8.8" fill="${c}" opacity=".55"/><path d="M6 7.8h8M6 10h8M6 12.2h8" stroke="${c}" stroke-width="1"/>`,
};
const GLYPHC = { tea: ['#eaf7ec', '#3f9d57'], spice: ['#fff3e6', '#e2703a'], coffee: ['#f3e3d0', '#5b3a26'], silk: ['#7f8b97', '#eef2f4'] };
const glyph = g => GLYPH[g](GLYPHC[g][0], GLYPHC[g][1]);
// 큰 상품 그림(시장판 머리줄): 44×40 안에 그림
const GOODART = {
  tea: `<rect x="6" y="14" width="32" height="24" rx="2" fill="#8a5a32" stroke="#4a2c14"/><rect x="6" y="14" width="32" height="5" fill="#6b4220"/><rect x="14" y="22" width="16" height="11" fill="#f3e3c0" stroke="#4a2c14" stroke-width=".8"/><path d="M17 25h10M17 28h10M17 31h6" stroke="#b03a2a" stroke-width="1.2"/>
    <path d="M10 15C9 6 16 2 22 4C21 10 16 14 10 15Z" fill="#4fae66" stroke="#2c6b3c"/><path d="M24 14C25 5 32 3 37 6C34 11 29 14 24 14Z" fill="#3f9d57" stroke="#2c6b3c"/><path d="M11 14L20 6M25 13L34 7" stroke="#2c6b3c" stroke-width=".9"/>`,
  spice: `<path d="M8 38C5 28 9 18 14 14h16c5 4 9 14 6 24Z" fill="#c9a26a" stroke="#6b4a2c"/><path d="M13 14c2-4 16-4 18 0" fill="none" stroke="#6b4a2c" stroke-width="2"/><ellipse cx="22" cy="15" rx="9" ry="3" fill="#e2703a"/>
    ${[[16, 13], [21, 11.5], [26, 13], [19, 14], [24, 15]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="2" fill="#b4502a" stroke="#7a3214" stroke-width=".6"/>`).join('')}
    <g transform="translate(33 30) scale(.6) translate(-10 -10)">${GLYPH.spice('#a8451c')}</g><path d="M3 33l9-3M3 36l9-3" stroke="#8a4a22" stroke-width="2.6" stroke-linecap="round"/>`,
  coffee: `<path d="M8 38c-2-10 0-20 4-26 4-3 16-3 20 0 4 6 6 16 4 26Z" fill="#b89366" stroke="#5a3d22"/><path d="M12 12c3 2 17 2 20 0" fill="none" stroke="#5a3d22" stroke-width="1.6"/><path d="M14 18c4 1 12 1 16 0M13 25c5 1 14 1 18 0" stroke="#8a6a44" stroke-width="1" fill="none"/>
    ${[[16, 11], [22, 9.5], [28, 11], [19, 13], [25, 13]].map(([x, y], k) => `<g transform="translate(${x} ${y}) rotate(${k * 37}) scale(.45) translate(-10 -10)">${GLYPH.coffee('#5b3a26', '#2a1a10')}</g>`).join('')}`,
  silk: `<ellipse cx="11" cy="22" rx="6" ry="13" fill="#e9eef1" stroke="#7f8b97"/><path d="M11 9h20c3 0 6 6 6 13s-3 13-6 13H11" fill="#f7f9fa" stroke="#7f8b97"/><ellipse cx="11" cy="22" rx="2.4" ry="5" fill="#c3ccd3"/>
    <path d="M31 35c4 1 6 3 8 5H22c3-2 6-4 9-5Z" fill="#f2f5f7" stroke="#7f8b97"/><path d="M16 12c6 2 12 2 18 0M16 32c6 2 12 2 18 0" stroke="#d0d8de" stroke-width="1.2" fill="none"/><path d="M20 10v24" stroke="#c8402f" stroke-width="1.6" opacity=".7"/>`,
};
// ---------- 배 그림(종류마다 다름) ----------
const sail = (x, y, w, h) => `<path d="M${x} ${y}q${w / 2} 2.2 ${w} 0v${h}q${-w / 2} 3.2 ${-w} 0z" fill="#fffaf0" stroke="#7a6a52" stroke-width=".7"/>`;
const gaff = (x, y, w, h) => `<path d="M${x} ${y + 3}L${x + w} ${y}L${x + w + 2} ${y + h}L${x} ${y + h}Z" fill="#fffaf0" stroke="#7a6a52" stroke-width=".7"/>`;
const mast = (x, y0, y1) => `<path d="M${x} ${y0}V${y1}" stroke="#4a3018" stroke-width="1.6"/>`;
const smoke = (x, y) => `<path d="M${x} ${y}c-3-4 2-6-1-10c4 1 6 5 3 9c4-2 7 1 5 5" fill="#9aa0a4" opacity=".75"/>`;
const SHIPART = {
  galleon: `<path d="M-27 3L-25-7H-16V1H20L27-3L22 12H-22Z" fill="#6b4220" stroke="#3a2210"/><path d="M-22 6H23" stroke="#c9a25a" stroke-width="1.2"/>${mast(-9, 2, -24)}${mast(4, 2, -27)}${mast(16, 0, -18)}
    ${sail(-15, -21, 12, 8)}${sail(-15, -11, 12, 9)}${sail(-2, -25, 12, 9)}${sail(-2, -13, 12, 10)}${sail(11, -15, 10, 9)}<path d="M4-27l7 2-7 2z" fill="#c8402f"/><path d="M22 -1L32 -7" stroke="#4a3018" stroke-width="1.2"/>`,
  indiaman: `<path d="M-28 2L-26-5H-20V1H24L29-2L23 12H-23Z" fill="#3b2a1e" stroke="#1e140c"/><path d="M-23 5H24" stroke="#e6c36a" stroke-width="2.4"/>${[-16, -10, -4, 2, 8, 14].map(x => `<rect x="${x}" y="4" width="2.4" height="2.4" fill="#1e140c"/>`).join('')}
    ${mast(-12, 2, -25)}${mast(1, 2, -29)}${mast(14, 1, -24)}${sail(-18, -22, 12, 7)}${sail(-18, -13, 12, 9)}${sail(-5, -26, 12, 8)}${sail(-5, -16, 12, 10)}${sail(8, -21, 12, 7)}${sail(8, -12, 12, 8)}<path d="M24 0L34-6" stroke="#4a3018" stroke-width="1.2"/><path d="M1-29l8 2-8 2z" fill="#c8402f"/>`,
  schooner: `<path d="M-24 4H25L20 11H-20Z" fill="#6b4a2c" stroke="#3a2210"/>${mast(-6, 4, -25)}${mast(8, 4, -23)}${gaff(-6, -23, 12, 24)}${gaff(8, -21, 12, 22)}<path d="M8 -22L26 2H9Z" fill="#fffaf0" stroke="#7a6a52" stroke-width=".7" transform="translate(4 0) scale(.6 1)"/><path d="M25 4L33-2" stroke="#4a3018" stroke-width="1.2"/>`,
  threemaster: `<path d="M-27 3H25L19 12H-21Z" fill="#7a5334" stroke="#3a2210"/><path d="M-22 6H22" stroke="#e8d8b0" stroke-width="1.2"/>${mast(-11, 3, -25)}${mast(2, 3, -28)}${mast(14, 3, -22)}
    ${sail(-17, -22, 12, 8)}${sail(-17, -12, 12, 10)}${sail(-4, -25, 12, 9)}${sail(-4, -14, 12, 11)}${gaff(14, -19, 9, 18)}<path d="M25 3L33-3" stroke="#4a3018" stroke-width="1.2"/>`,
  clipper: `<path d="M-28 4H24L31 1L22 11H-22Z" fill="#202a30" stroke="#0e1418"/><path d="M-22 7H24" stroke="#d6b24c" stroke-width="1"/>${mast(-13, 4, -28)}${mast(0, 4, -31)}${mast(13, 4, -27)}
    ${[-13, 0, 13].map((m, k) => sail(m - 6, -27 - (k === 1 ? 3 : 0), 12, 6) + sail(m - 6, -19 - (k === 1 ? 2 : 0), 12, 7) + sail(m - 6, -10, 12, 8)).join('')}<path d="M24 2L36-5" stroke="#4a3018" stroke-width="1.2"/><path d="M28 0L22-22" stroke="#7a6a52" stroke-width=".7"/>`,
  pliner: `<path d="M-28 3H26L21 12H-22Z" fill="#262a2e" stroke="#0e1012"/><path d="M-22 6H22" stroke="#b8302a" stroke-width="1.6"/><rect x="-10" y="-4" width="20" height="7" fill="#f0e8d8" stroke="#4a4a4a"/><rect x="-3" y="-17" width="6" height="13" fill="#2a2a2a"/><rect x="-3" y="-17" width="6" height="3" fill="#b8302a"/>${smoke(0, -18)}
    <path d="M-16 6a7 7 0 0 1 14 0" fill="#7a5334" stroke="#3a2210"/>${mast(-18, 3, -20)}${mast(15, 3, -18)}${sail(-23, -18, 10, 8)}${sail(10, -16, 10, 8)}`,
  steamclipper: `<path d="M-28 4H24L31 1L22 11H-22Z" fill="#23303a" stroke="#0e1418"/><path d="M-22 7H24" stroke="#b8302a" stroke-width="1.4"/>${mast(-14, 4, -26)}${mast(12, 4, -25)}${sail(-20, -24, 12, 7)}${sail(-20, -15, 12, 9)}${sail(6, -23, 12, 7)}${sail(6, -14, 12, 9)}
    <rect x="-3" y="-14" width="6" height="18" fill="#2a2a2a"/><rect x="-3" y="-14" width="6" height="3" fill="#d6b24c"/>${smoke(0, -15)}<path d="M24 2L35-4" stroke="#4a3018" stroke-width="1.2"/>`,
  steamer: `<path d="M-29 1H27L22 12H-24Z" fill="#1c1f22" stroke="#08090a"/><path d="M-24 7H24" stroke="#b8302a" stroke-width="3"/><rect x="-18" y="-6" width="34" height="7" fill="#f2ece0" stroke="#4a4a4a"/>${[-14, -9, -4, 1, 6, 11].map(x => `<rect x="${x}" y="-4" width="2.6" height="2.6" fill="#5a6a78"/>`).join('')}
    <rect x="-10" y="-19" width="7" height="13" fill="#b8302a"/><rect x="-10" y="-19" width="7" height="3" fill="#1c1f22"/><rect x="3" y="-19" width="7" height="13" fill="#b8302a"/><rect x="3" y="-19" width="7" height="3" fill="#1c1f22"/>${smoke(-6, -20)}${smoke(7, -20)}${mast(-21, 1, -16)}${mast(19, 1, -14)}`,
};
const shipArt = (t, s = 1) => `<g transform="scale(${s})">${SHIPART[t] || SHIPART.galleon}</g>`;

// ---------- 그림 조각 ----------
const sTxt = (x, y, t, o = {}) => `<text x="${x}" y="${y}" ${o.a ? `text-anchor="${o.a}"` : ''} font-size="${o.s || 16}" ${o.w ? `font-weight="${o.w}"` : ''} fill="${o.f || 'var(--ink)'}" ${o.cls ? `class="${o.cls}"` : ''}>${esc(t)}</text>`;
const sCoin = (x, y, r, n) => `<g class="coin3"><circle cx="${x}" cy="${y + 2}" r="${r}" fill="#7a5410"/><circle cx="${x}" cy="${y}" r="${r}" fill="url(#gold)" stroke="#8a6412" stroke-width="1.5"/><circle cx="${x}" cy="${y}" r="${r * 0.72}" fill="none" stroke="#b58a2a" stroke-width="1"/>${sTxt(x, y + r * 0.36, n, { a: 'middle', s: r * 1.0, w: 700, f: '#3a2a05' })}</g>`;
const sCube = (g, s = 20) => `<rect x="1" y="3" width="${s}" height="${s}" rx="3" fill="rgba(0,0,0,.35)"/><rect width="${s}" height="${s}" rx="3" fill="${GOODC[g]}" stroke="rgba(0,0,0,.45)" stroke-width="1"/><rect x="2.5" y="2.5" width="${s - 5}" height="${s * 0.22}" rx="2" fill="#fff" opacity=".22"/>${s >= 13 ? `<g transform="translate(${s * 0.1} ${s * 0.1}) scale(${s * 0.8 / 20})">${glyph(g)}</g>` : ''}`;
const sMeeple = (p, s = 40) => `<g transform="translate(${-s / 2},${-s / 2}) scale(${s / 24})"><path d="${MEEPLE_D}" transform="translate(.8,1.2)" fill="rgba(0,0,0,.35)"/><path d="${MEEPLE_D}" fill="${PCOL[p]}" stroke="rgba(0,0,0,.55)" stroke-width=".7"/></g>`;
function sShip(d, p, r = 44, back = false) {
  if (back) return `<circle r="${r}" cy="3" fill="rgba(0,0,0,.35)"/><circle r="${r}" fill="url(#shipback)" stroke="${PCOL[p]}" stroke-width="6"/>${sTxt(0, 9, '?', { a: 'middle', s: r * 0.7, w: 700, f: '#fff' })}`;
  const i = shipInfo(d.type), cargo = d.cargo.map((g, k) => `<g transform="translate(${-d.cargo.length * 8 + k * 16},${r * 0.34})">${sCube(g, 14)}</g>`).join('');
  return `<circle r="${r}" cy="3" fill="rgba(0,0,0,.35)"/><circle r="${r}" fill="${d.loc === 'sea' ? 'url(#shipsea)' : 'url(#shipface)'}" stroke="${PCOL[p]}" stroke-width="6" ${d.stayed ? 'stroke-dasharray="7 5"' : ''}/>
    <path d="M${-r * 0.78} ${r * 0.2} q${r * 0.2} ${-r * 0.06} ${r * 0.39} 0 t${r * 0.39} 0 t${r * 0.39} 0 t${r * 0.39} 0" fill="none" stroke="#3e7f8a" stroke-width="1.2" opacity=".6"/>
    <g transform="translate(0 ${r * 0.02})">${shipArt(d.type, r / 52)}</g>
    ${sTxt(0, -r * 0.68, SHIP_SHORT[d.type], { a: 'middle', s: r * 0.24, w: 700, f: '#10303a', cls: 'shipname' })}
    <g transform="translate(${-r * 0.82},${r * 0.36})"><rect x="-13" y="-12" width="26" height="22" rx="4" fill="#10303a"/>${sTxt(0, 5, '▣' + i.tonnage, { a: 'middle', s: 12, w: 700, f: '#fff' })}</g>
    <g transform="translate(${r * 0.82},${r * 0.36})"><rect x="-13" y="-12" width="26" height="22" rx="4" fill="#fffaf0" stroke="#10303a"/>${sTxt(0, 5, '≫' + i.speed, { a: 'middle', s: 12, w: 700, f: '#10303a' })}</g>${cargo}`;
}
// 움직이는 조각: 바깥 g가 자리, 안쪽 g가 애니메이션
const pc = (key, kind, x, y, inner, attrs = '', cls = '') => `<g class="pc ${cls}" data-k="${key}" data-kind="${kind}" data-x="${x}" data-y="${y}" transform="translate(${x},${y})" ${attrs}><g class="in">${inner}</g></g>`;
const actAttrs = (act, extra, label) => `data-act="${act}" ${extra} tabindex="0" role="button" aria-label="${esc(label)}"`;

// ---------- 테이블 그리기 ----------
function drawStatus() {
  const B = L.status, aw = G.awaiting;
  let s = `<rect x="${B.x}" y="${B.y}" width="${B.w}" height="${B.h}" rx="12" fill="url(#paper)" stroke="#8a7350" stroke-width="2" filter="url(#sh)"/>`;
  for (let k = 1; k <= 5; k++) { const x = B.x + 50 + (k - 1) * 66, on = k === G.period; s += `<circle cx="${x}" cy="${B.y + 40}" r="20" fill="${on ? '#16303d' : '#efe2c4'}" stroke="#8a7350" stroke-width="2"/>${sTxt(x, B.y + 46, k, { a: 'middle', s: 17, w: 700, f: on ? '#fff' : '#6e5c45' })}${sTxt(x, B.y + 76, PERIOD_KO[k], { a: 'middle', s: 12, f: '#6e5c45' })}`; }
  'ABCDEF'.split('').forEach((ph, k) => { const x = B.x + 380 + (k % 3) * 38, y = B.y + 22 + Math.floor(k / 3) * 42, on = ph === G.phase && !G.over;
    s += `<rect x="${x}" y="${y}" width="32" height="32" rx="5" fill="${on ? '#c8962e' : '#efe2c4'}" stroke="#8a7350"/>${sTxt(x + 16, y + 22, ph, { a: 'middle', s: 16, w: 700, f: on ? '#fff' : '#6e5c45' })}`; });
  s += sTxt(B.x + 20, B.y + 122, '주도권', { s: 14, w: 700, f: '#6e5c45' });
  G.initiative.forEach((p, k) => { const x = B.x + 106 + k * 50, cur = !G.over && aw.player === p;
    s += pc('init' + p, 'init', x, B.y + 116, `<circle r="19" fill="${PCOL[p]}" stroke="${cur ? '#ffd45e' : 'rgba(0,0,0,.5)'}" stroke-width="${cur ? 5 : 3}"/>${sTxt(0, 6, k + 1, { a: 'middle', s: 17, w: 700, f: '#fff' })}`); });
  s += sTxt(B.x + 330, B.y + 122, G.over ? '게임 종료' : PHASE_KO[G.phase], { s: 15, w: 700 });
  return s;
}
function drawTrack() {
  const T = L.track, tr = DATA.stockTrack, n = tr.prices.length;
  let s = `<rect x="${T.x - 14}" y="${T.y - 14}" width="${n * T.cw + 28}" height="${T.h + 28}" rx="14" fill="url(#wood2)" stroke="#3e2714" stroke-width="2" filter="url(#sh)"/><rect x="${T.x - 9}" y="${T.y - 9}" width="${n * T.cw + 18}" height="${T.h + 18}" rx="10" fill="none" stroke="#c9a25a" stroke-width="1.5"/>`;
  tr.prices.forEach((pr, i) => {
    const x = T.x + i * T.cw, d = tr.dividends[i];
    if (i === 0 || d !== tr.dividends[i - 1]) s += `<g transform="translate(${x + 4},${T.y + 4})"><rect width="64" height="20" rx="10" fill="#7a2418"/>${sTxt(32, 15, '배당 ' + d, { a: 'middle', s: 12, w: 700, f: '#ffe7b8' })}</g>`;
    s += `<path d="M${x + 4} ${T.y + 30} h${T.cw - 8} v${T.h - 40} q0 8 -8 8 h${-(T.cw - 24)} q-8 0 -8 -8z" fill="#8a6540" stroke="#5a3d22"/>${sCoin(x + T.cw / 2, T.y + 52, 15, pr)}`;
  });
  G.stock.forEach((st, c) => {
    const same = G.stock.filter((o, k) => k < c && o.idx === st.idx).length;
    s += pc('sm' + c, 'sm', T.x + st.idx * T.cw + T.cw / 2, T.y + 104 - same * 9, `<ellipse cy="4" rx="17" ry="8" fill="rgba(0,0,0,.4)"/><ellipse rx="17" ry="8" fill="${PCOL[c]}" stroke="rgba(0,0,0,.55)" stroke-width="1.5"/><path d="M-17 0 v-6 a17 8 0 0 1 34 0 v6" fill="${PCOL[c]}" stroke="rgba(0,0,0,.55)" stroke-width="1.5"/><ellipse cy="-6" rx="17" ry="8" fill="${PCOL[c]}" stroke="rgba(255,255,255,.35)"/>`);
  });
  return s;
}
function certArt(c, left, pr) {
  const col = PCOL[c], nm = G.players[c].name;
  return `<rect width="104" height="86" rx="3" fill="#fffaf0" stroke="${col}" stroke-width="2.2"/><rect x="4" y="4" width="96" height="78" rx="2" fill="none" stroke="${col}" stroke-width=".8" stroke-dasharray="2 1.5"/>
    <path d="M8 8h88v16H8z" fill="${col}"/>${sTxt(52, 20, nm + ' 회사', { a: 'middle', s: 12, w: 700, f: '#fff', cls: 'disp' })}
    <circle cx="26" cy="48" r="15" fill="none" stroke="${col}" stroke-width="1.6"/><circle cx="26" cy="48" r="11" fill="${col}" opacity=".14"/><g transform="translate(26 49)">${shipArt('indiaman', 0.36)}</g>
    ${sTxt(68, 41, '주 권', { a: 'middle', s: 12, w: 700, f: '#2b2118', cls: 'disp' })}${sTxt(68, 55, `남은 ${left}장`, { a: 'middle', s: 11, f: '#4a3a28' })}
    <path d="M10 74h40" stroke="${col}" stroke-width=".8"/>${sCoin(82, 70, 12, pr)}`;
}
function drawCerts() {
  const B = L.certs, buy = G.awaiting.type === 'stock', la = buy ? LA() : [], E = era(), H = B.h;
  // 거래소 건물: 박공, 처마 글씨, 기둥, 계단
  let s = `<g filter="url(#sh)"><path d="M${B.x - 6} ${B.y + 34} L${B.x + B.w / 2} ${B.y - 2} L${B.x + B.w + 6} ${B.y + 34}Z" fill="url(#stone2)" stroke="#8a7f68" stroke-width="2"/>
    <rect x="${B.x}" y="${B.y + 34}" width="${B.w}" height="${H - 34}" fill="url(#stone2)" stroke="#8a7f68" stroke-width="2"/></g>
    <path d="M${B.x + 40} ${B.y + 30} L${B.x + B.w / 2} ${B.y + 6} L${B.x + B.w - 40} ${B.y + 30}Z" fill="none" stroke="#a89c80"/>
    <circle cx="${B.x + B.w / 2}" cy="${B.y + 21}" r="9" fill="url(#gold)" stroke="#8a6412"/>${sTxt(B.x + B.w / 2, B.y + 25, '₤', { a: 'middle', s: 11, w: 700, f: '#4a3210' })}
    <rect x="${B.x - 4}" y="${B.y + 34}" width="${B.w + 8}" height="20" fill="#e2d9c2" stroke="#8a7f68"/>${sTxt(B.x + B.w / 2, B.y + 49, '증 권 거 래 소', { a: 'middle', s: 14, w: 700, f: '#3a3226', cls: 'disp' })}
    ${sTxt(B.x + 12, B.y + 49, E.years.slice(0, 4), { s: 10, f: '#6e6450' })}${sTxt(B.x + B.w - 12, B.y + 49, buy ? '주식 1장 사기' : '', { a: 'end', s: 10, w: 700, f: '#8a3a12' })}
    <rect x="${B.x + 4}" y="${B.y + 58}" width="${B.w - 8}" height="${H - 76}" fill="#3a2e22" opacity=".18"/>`;
  for (let k = 0; k <= 4; k++) { const x = B.x + 4 + k * 120 + (k === 4 ? -12 : 0); s += `<rect x="${x}" y="${B.y + 58}" width="10" height="${H - 76}" fill="#efe9da" stroke="#a89c80"/><rect x="${x - 2}" y="${B.y + 56}" width="14" height="5" fill="#e2d9c2" stroke="#a89c80"/><path d="M${x + 3} ${B.y + 62}v${H - 84}M${x + 7} ${B.y + 62}v${H - 84}" stroke="#d2c8b2" stroke-width=".8"/>`; }
  s += `<rect x="${B.x - 4}" y="${B.y + H - 18}" width="${B.w + 8}" height="9" fill="#e2d9c2" stroke="#8a7f68"/><rect x="${B.x - 10}" y="${B.y + H - 9}" width="${B.w + 20}" height="9" fill="#d6ccb4" stroke="#8a7f68"/>`;
  G.players.forEach((pl, c) => {
    const x = B.x + 17 + c * 120, y = B.y + 62, ok = la.some(a => a.type === 'buyShare' && a.company === c), left = G.stock[c].inExchange;
    let stack = ''; for (let k = Math.min(left, 4) - 1; k >= 1; k--) stack += `<rect x="${k * 2.5}" y="${-k * 2.5}" width="104" height="86" rx="3" fill="#fffaf0" stroke="${PCOL[c]}" stroke-width="1.5"/>`;
    s += `<g class="${ok ? 'hot' : ''}" ${ok ? actAttrs('buy', `data-c="${c}"`, `${pl.name} 주식 사기 ${price(G, c)}GP`) : ''} transform="translate(${x},${y})">${left ? stack + certArt(c, left, price(G, c)) : `<rect width="104" height="86" rx="3" fill="none" stroke="#8a7f68" stroke-dasharray="5 4"/>${sTxt(52, 48, '다 팔림', { a: 'middle', s: 12, f: '#6e6450' })}`}
      ${ok ? '<rect class="hl" x="-4" y="-6" width="114" height="96" rx="5" fill="none" stroke="#ffd45e"/>' : ''}</g>`;
  });
  return s;
}
/*MAP*/
function drawMap() {
  const aw = G.awaiting, la = LA(), S = MS();
  let s = mapBackground();
  for (const r of REG_ORDER) {
    const b = regionBox(r), rg = DATA.regions[r], ships = G.regions[r];
    const drop = canAct() && aw.type === 'sail' && la.some(a => a.type === 'sail' && a.region === r && (ui.ship == null || a.dock === ui.ship));
    // 항로 칸
    s += `<g class="${drop ? 'hot' : ''}" ${drop ? `data-drop="region" ${actAttrs('region', `data-r="${r}"`, `${rg.name}로 보내기`)}` : ''}>
      <rect class="hl zone" x="${b.x}" y="${b.y}" width="${b.w}" height="${b.h}" rx="10" fill="${S.zone}" stroke="${S.ink}" stroke-width="1.8" stroke-dasharray="7 4"/>
      <g transform="translate(${b.x + 8},${b.y + 8})"><rect width="${b.w - 16}" height="54" rx="4" fill="${S.paper}" fill-opacity=".94" stroke="${S.ink}" stroke-width="1.2"/><rect x="3" y="3" width="${b.w - 22}" height="48" rx="2" fill="none" stroke="${S.ink}" stroke-width=".5"/>
        <circle cx="16" cy="16" r="11" fill="${S.ink}"/>${sTxt(16, 20.5, r, { a: 'middle', s: 11, w: 700, f: '#fff', cls: 'disp' })}
        ${sTxt(32, 22, rg.name, { s: 15, w: 700, f: S.ink, cls: 'disp' })}
        ${rg.goods.map((g, k) => `<g transform="translate(${8 + k * 20},34)">${sCube(g, 14)}</g>`).join('')}
        ${sTxt(b.w - 16 - 30, 46, '항해비', { a: 'end', s: 11, f: S.ink })}${zoneEv(r, b)}${sailCost(G, r) ? sCoin(b.w - 16 - 15, 41, 10, sailCost(G, r)) : sTxt(b.w - 16 - 8, 46, '0', { a: 'end', s: 13, w: 700 })}</g></g>`;
    // 도시와 교역소
    rg.cities.forEach((c, i) => {
      const [x, y] = GP(...CITY_GEO[r][i]), [dx, dy, an] = CITY_LBL[r][i], own = G.cities[r + i];
      s += `<circle cx="${x}" cy="${y}" r="5" fill="${S.paper}" stroke="${S.ink}" stroke-width="1.8"/><circle cx="${x}" cy="${y}" r="2" fill="${S.ink}"/>`;
      s += `<g transform="translate(${x + dx},${y + dy})">${sTxt(0, 0, c, { a: an, s: 13, w: 700, f: S.ink, cls: 'city-lbl disp' })}</g>`;
      const tx = x + POST_OFF[r][i][0], ty = y + POST_OFF[r][i][1];
      s += `<circle cx="${tx}" cy="${ty}" r="11" fill="${own != null ? 'none' : 'rgba(255,246,220,.75)'}" stroke="#6f5a3a" stroke-dasharray="${own != null ? '0' : '3 2'}"/>`;
      if (own != null) s += pc(`tp${r}${i}`, 'tp' + own, tx, ty, `<path d="M-10 7 v-9 l10 -8 l10 8 v9 z" fill="${PCOL[own]}" stroke="rgba(0,0,0,.6)" stroke-width="1.5"/>`);
    });
    // 이 지역에 와 있는 배
    const n = ships.length, inner = { x: b.x, y: b.y + 24, w: b.w, h: b.h - 24 }, gd = shipGrid(inner, n), rr = gd.r, cw = (b.w - 12) / gd.cols;
    ships.forEach((e, k) => {
      const d = G.players[e.p].docks[e.dock], col = k % gd.cols, row = Math.floor(k / gd.cols), x = b.x + 6 + cw * (col + 0.5), y = b.y + 70 + rr + 3 + row * (2 * rr + 6);
      const hide = !seeAll() && G.phase === 'C' && !d.stayed && !mine.has(e.p), cur = aw.type === 'load' && aw.player === e.p && aw.dock === e.dock;
      s += pc(`sh${e.p}.${e.dock}`, `ship${e.p}`, x, y, sShip(d, e.p, rr, hide) + (cur ? `<circle r="${rr + 8}" fill="none" stroke="#ffd45e" stroke-width="5" class="pulse"/>` : ''));
    });
    if (!n && drop) s += sTxt(b.x + b.w / 2, b.y + b.h / 2 + 20, '여기로 끌어다 놓기', { a: 'middle', s: 14, w: 700, f: S.ink });
  }
  if (G.phase === 'D') { const [x, y] = GP(92, 28.6); s += sTxt(x, y, '지역 I → II → III, 빠른 배부터 싣습니다', { a: 'middle', s: 13, w: 700, f: S.ink, cls: 'city-lbl' }); }
  return s;
}

// ---------- 확장: 시대의 사건 카드 ----------
const sgnK = k => (k > 0 ? '+' : '−') + Math.abs(k);
const EV_GOOD = { sup: 1, dem: 1, sale: 1, toll: -1, load: -1, ship: -1 }; // 플레이어에게 좋은 방향
function zoneEv(r, b) {
  const d = sailCost(G, r) - DATA.regions[r].sailCost, lm = evMod(G, 'load', r); let t = '';
  if (d) t += sTxt(b.w - 16 - 30, 30, `사건 ${sgnK(d)}`, { a: 'end', s: 10, w: 700, f: d > 0 ? '#a3321f' : '#2f6b3a' });
  if (lm) t += sTxt(54, 46, `살 때 큐브당 ${sgnK(lm)}`, { s: 10, w: 700, f: lm > 0 ? '#a3321f' : '#2f6b3a' });
  return t;
}
function evIcon(l) {
  if (l.kind === 'sup' || l.kind === 'dem' || l.kind === 'sale') return l.key === 'all' ? GOODS.map((g, i) => `<g transform="translate(${(i % 2) * 8},${Math.floor(i / 2) * 8 - 1})">${sCube(g, 7)}</g>`).join('') : `<g transform="translate(0,-1)">${sCube(l.key, 15)}</g>`;
  if (l.kind === 'ship') return `<g transform="translate(8,7) scale(.75)">${SICON.buyShip}</g>`;
  return `<circle cx="8" cy="7" r="7.5" fill="#3a2713"/>${sTxt(8, 10.6, l.key === 'all' ? '全' : l.key, { a: 'middle', s: l.key.length > 2 ? 7 : 9, w: 700, f: '#f1e4c2', cls: 'disp' })}`;
}
function drawEventCard() {
  if (!(G.opts && G.opts.events)) return '';
  const B = L.event, e = eventOf(G), ink = '#3a2713';
  let s = `<g transform="translate(${B.x},${B.y})"><rect x="3" y="6" width="${B.w}" height="${B.h}" rx="6" fill="rgba(0,0,0,.4)"/><rect width="${B.w}" height="${B.h}" rx="6" fill="#f1e4c2" stroke="${ink}" stroke-width="2"/>
    <rect x="5" y="5" width="${B.w - 10}" height="20" rx="2" fill="${ink}"/>${sTxt(14, 19.5, `시대의 사건 · ${G.period}기간`, { s: 11.5, w: 700, f: '#f1e4c2', cls: 'disp' })}`;
  if (!e) return s + sTxt(B.w / 2, 72, '기간이 시작되면 사건 카드를 뽑습니다', { a: 'middle', s: 12, f: '#6e5c45' }) + '</g>';
  s += sTxt(B.w - 14, 19.5, e.year, { a: 'end', s: 11, f: '#e8c878' }) + sTxt(14, 47, e.name, { s: 18, w: 700, f: ink, cls: 'disp' }) + sTxt(14, 64, e.text, { s: 11, f: '#6a5236' });
  const ls = eventLines(e), two = ls.length > 2;
  ls.forEach((l, i) => { const x = 12 + (two ? (i % 2) * 170 : 0), y = 74 + (two ? Math.floor(i / 2) : i) * 21, good = l.k * EV_GOOD[l.kind] > 0;
    s += `<g transform="translate(${x},${y})">${evIcon(l)}${sTxt(21, 12, l.t, { s: 11.5, w: 700, f: good ? '#2f6b3a' : '#a3321f' })}</g>`; });
  return s + `<rect x="0" y="0" width="${B.w}" height="${B.h}" fill="url(#grain)" opacity=".5" pointer-events="none" rx="6"/></g>`;
}

// ---------- 캐릭터·칸 그림(직접 그린 아이콘) ----------
const INK = '#4a3210';
const ICON = {
  trader: `<path d="M0 -15 v26 M-12 11 h24" stroke="${INK}" stroke-width="2.4" stroke-linecap="round"/><path d="M-15 -9 h30" stroke="${INK}" stroke-width="2.2"/><circle cy="-15" r="2.4" fill="${INK}"/>
    <path d="M-15 -9 l-5 11 h10z M15 -9 l-5 11 h10z" fill="none" stroke="${INK}" stroke-width="1.6"/><path d="M-20 2 a5 3 0 0 0 10 0z M10 2 a5 3 0 0 0 10 0z" fill="${INK}"/>`,
  shipowner: `<circle cy="-13" r="4" fill="none" stroke="${INK}" stroke-width="2.4"/><path d="M0 -9 v24 M-8 -3 h16" stroke="${INK}" stroke-width="2.6" stroke-linecap="round"/><path d="M-14 4 q2 13 14 11 q12 2 14 -11" fill="none" stroke="${INK}" stroke-width="2.6" stroke-linecap="round"/><path d="M-17 6 l3 -4 l3 4 M11 6 l3 -4 l3 4" fill="none" stroke="${INK}" stroke-width="2.2"/>`,
  governor: `<path d="M-15 8 l-3 -18 l9 8 l9 -14 l9 14 l9 -8 l-3 18z" fill="${INK}"/><rect x="-15" y="9" width="30" height="5" rx="1.5" fill="${INK}"/><circle cx="0" cy="-17" r="2.6" fill="${INK}"/><circle cx="-18" cy="-11" r="2.2" fill="${INK}"/><circle cx="18" cy="-11" r="2.2" fill="${INK}"/>`,
  captain: `<circle r="11" fill="none" stroke="${INK}" stroke-width="3"/><circle r="4" fill="${INK}"/>${[0, 45, 90, 135, 180, 225, 270, 315].map(a => `<path d="M0 0 L0 -18" transform="rotate(${a})" stroke="${INK}" stroke-width="2.6" stroke-linecap="round"/><circle cy="-18" r="2.6" transform="rotate(${a})" fill="${INK}"/>`).join('')}`,
  investor: `${[0, 1, 2, 3].map(k => `<ellipse cx="-6" cy="${12 - k * 6}" rx="9" ry="3.4" fill="#e9c35a" stroke="${INK}" stroke-width="1.6"/>`).join('')}<path d="M4 10 l7 -9 l5 4 l7 -12" fill="none" stroke="${INK}" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/><path d="M17 -9 h6 v6" fill="none" stroke="${INK}" stroke-width="2.6" stroke-linecap="round"/>`,
};
const SICON = {
  buyShip: `<path d="M-10 2 h20 l-4 6 h-12z" fill="#6b4a2c"/><path d="M0 -10 v12" stroke="#6b4a2c" stroke-width="1.6"/><path d="M1 -9 q7 5 0 10z" fill="#fff" stroke="#6b4a2c" stroke-width="1"/><path d="M-1 -7 q-6 4 0 8z" fill="#fff" stroke="#6b4a2c" stroke-width="1"/>`,
  dock: `<path d="M-11 -2 h22" stroke="#6b4a2c" stroke-width="4"/><path d="M-8 -2 v10 M0 -2 v10 M8 -2 v10" stroke="#6b4a2c" stroke-width="2.4"/><path d="M-12 8 q3 -2 6 0 t6 0 t6 0 t6 0" fill="none" stroke="#3e7f8a" stroke-width="1.6"/>`,
  tradingPost: `<path d="M-10 8 v-9 l10 -8 l10 8 v9z" fill="#c9a25a" stroke="#6b4a2c" stroke-width="1.5"/><rect x="-3" y="2" width="6" height="6" fill="#6b4a2c"/><path d="M8 -12 v8 M8 -12 h7 l-2 2 l2 2 h-7" fill="#c8402f" stroke="#6b4a2c" stroke-width="1"/>`,
  influenceIndies: `<rect x="-9" y="-11" width="15" height="21" rx="2" fill="#74503a" stroke="#3b2416"/><rect x="-4" y="-8" width="15" height="21" rx="2" fill="#fffaf0" stroke="#3b2416"/><circle cx="3.5" cy="2.5" r="4" fill="none" stroke="#3b2416" stroke-width="1.5"/><circle cx="3.5" cy="2.5" r="1.6" fill="#3b2416"/>`,
  influenceEurope: `<rect x="-9" y="-11" width="15" height="21" rx="2" fill="#2a6170" stroke="#123039"/><rect x="-4" y="-8" width="15" height="21" rx="2" fill="#fffaf0" stroke="#123039"/><circle cx="3.5" cy="2.5" r="4" fill="none" stroke="#123039" stroke-width="1.5"/><circle cx="3.5" cy="2.5" r="1.6" fill="#123039"/>`,
  initiative: `<circle r="10" fill="#c8962e" stroke="#6b4a2c" stroke-width="1.5"/><text y="5" text-anchor="middle" font-size="13" font-weight="700" fill="#fff">1</text><path d="M-7 10 l-3 6 l4 -1 l2 3 l2 -7 M7 10 l3 6 l-4 -1 l-2 3 l-2 -7" fill="#c8402f"/>`,
  freeSailing: `<rect x="-11" y="-9" width="22" height="17" rx="2" fill="#efe2c4" stroke="#6b4a2c"/><path d="M-7 4 q4 -9 8 -2 t6 -5" fill="none" stroke="#c8402f" stroke-width="1.6" stroke-dasharray="2 2"/><path d="M-11 -9 q-3 8.5 0 17 M11 -9 q3 8.5 0 17" fill="none" stroke="#6b4a2c" stroke-width="1.5"/>`,
};
const slotIcon = sl => SICON[sl] || (['spice', 'coffee', 'silk'].includes(sl) ? `<g transform="translate(-9,-9)">${sCube(sl, 18)}</g>` : '');

function drawChars() {
  const aw = G.awaiting, la = aw.type === 'place' ? LA() : [], sel = ui.sel && ui.sel.t === 'agent' ? ui.sel.i : null;
  const okFor = acts => acts.filter(a => sel == null || agentMatch(a, sel));
  let s = '';
  for (const c of RING_ORDER) {
    const b = charBox(c);
    s += `<rect x="${b.x}" y="${b.y}" width="${b.w}" height="${b.h}" rx="14" fill="url(#leather)" stroke="#5a2a12" stroke-width="2" filter="url(#sh)"/>
      <circle cx="${b.x + 42}" cy="${b.y + 40}" r="30" fill="url(#gold)" stroke="#e6c36a" stroke-width="3"/><circle cx="${b.x + 42}" cy="${b.y + 40}" r="24" fill="none" stroke="#b58a2a" stroke-width="1"/><g transform="translate(${b.x + 42},${b.y + 41})">${ICON[c]}</g>
      ${sTxt(b.x + 82, b.y + 47, CHAR_KO[c], { s: 22, w: 700, f: '#ffe7b8', cls: 'disp' })}`;
    SLOTS[c].forEach((sl, k) => {
      const q = slotBox(c, k), key = c + '.' + sl, acts = okFor(la.filter(a => a.type === 'place' && a.char === c && a.slot === sl)), occ = G.occ[key] || [];
      s += `<g class="${acts.length ? 'hot' : ''}" ${acts.length ? `data-drop="slot" ${actAttrs('slot', `data-s="${key}"`, `${CHAR_KO[c]} ${SLOT_SHORT[sl]}`)}` : ''}>
        <rect class="hl" x="${q.x}" y="${q.y}" width="${q.w}" height="${q.h}" rx="8" fill="#f6ecd4" stroke="#cdb98a"/>
        <g transform="translate(${q.x + 20},${q.y + 25})">${slotIcon(sl)}</g>
        ${sTxt(q.x + 40, q.y + 30, SLOT_SHORT[sl], { s: 14, w: 600 })}
        ${SLOT_PHASE[sl] ? `<g transform="translate(${q.x + 40},${q.y + 34})"><rect width="16" height="13" rx="2" fill="#fff" stroke="#2b2118"/>${sTxt(8, 10.5, SLOT_PHASE[sl], { a: 'middle', s: 10, w: 700 })}${sTxt(20, 10.5, '단계', { s: 10, f: '#6e5c45' })}</g>` : ''}
        ${acts.length && occ.length ? sTxt(q.x + q.w - 8, q.y + 46, `자리세 +${occ.length}`, { a: 'end', s: 11, w: 700, f: '#8a3a12' }) : ''}</g>`;
    });
  }
  const C = L.center, cacts = okFor(la.filter(a => a.type === 'place' && a.char === 'center'));
  s += `<g class="${cacts.length ? 'hot' : ''}" ${cacts.length ? `data-drop="center" ${actAttrs('center', '', '중앙에 놓기')}` : ''}><circle cx="${C.cx}" cy="${C.cy + 3}" r="${C.r + 10}" fill="rgba(0,0,0,.3)"/><circle class="hl" cx="${C.cx}" cy="${C.cy}" r="${C.r + 10}" fill="url(#stone)" stroke="#6d726f" stroke-width="3"/>
    ${sTxt(C.cx, C.cy - 30, '중앙', { a: 'middle', s: 16, w: 700, f: '#2b2118', cls: 'disp' })}${sTxt(C.cx + C.r + 20, C.cy + 5, '능력 없음 · 다음에 옮길 수 있음', { s: 12, f: '#e8d9b8' })}</g>`;
  const L0 = charBox('trader'), L4 = charBox('investor');
  s += `<path d="M${L0.x + 20} ${L0.y + L0.h + 8} Q ${(L0.x + L4.x + L4.w) / 2} ${L0.y + L0.h + 70} ${L4.x + L4.w - 20} ${L4.y + L4.h + 8}" fill="none" stroke="#c9b48a" stroke-width="2" stroke-dasharray="6 6" opacity=".7"/>
    ${sTxt(L0.x + 8, L0.y + L0.h + 34, '상인과 투자자도 옆자리', { s: 12, f: '#e8d9b8' })}`;
  return s;
}
function drawMarket(m) {
  const B = L[m], rows = MK_ROWS[m], eu = m === 'europe';
  const peeked = G.cards[m] != null && !G.cards.shown[m] && (G.cards.peek[m] || []).some(p => seeAll() || mine.has(p));
  const card = G.cards[m] != null && (G.cards.shown[m] || peeked) ? DATA.marketCards[m][cardGroup()][G.cards[m]].all : null;
  let s = `<rect x="${B.x}" y="${B.y}" width="${B.w}" height="${B.h}" rx="16" fill="${eu ? 'url(#eu)' : 'url(#in)'}" stroke="${eu ? '#123039' : '#3b2416'}" stroke-width="3" filter="url(#sh)"/>
    ${sTxt(B.x + 24, B.y + 40, eu ? '유럽 시장' : '인도 시장', { s: 24, w: 700, f: '#fff', cls: 'disp' })}${sTxt(B.x + 24, B.y + 62, eu ? '여기에 팝니다 · 싼 칸부터 채움' : '여기서 삽니다 · 비싼 칸부터 남음', { s: 13, f: 'rgba(255,255,255,.75)' })}`;
  // 시장 카드
  const cx = B.x + B.w - 150, cy = B.y + 16;
  if (G.cards[m] == null) s += `<rect x="${cx}" y="${cy}" width="130" height="72" rx="8" fill="none" stroke="rgba(255,255,255,.4)" stroke-dasharray="5 4"/>${sTxt(cx + 65, cy + 42, '카드 없음', { a: 'middle', s: 13, f: 'rgba(255,255,255,.6)' })}`;
  else if (!card) s += `<g transform="translate(${cx},${cy})"><rect width="130" height="72" rx="8" fill="url(#cardback)" stroke="#e8d9b8" stroke-width="2"/>${sTxt(65, 44, '뒤집힌 카드', { a: 'middle', s: 13, w: 700, f: '#e8d9b8' })}</g>`;
  else s += `<g transform="translate(${cx},${cy})"><rect width="130" height="72" rx="8" fill="#fffaf0" stroke="${peeked ? '#ffd45e' : '#e8d9b8'}" stroke-width="${peeked ? 4 : 2}"/>${GOODS.map((g, k) => `<g transform="translate(${10 + k * 30},14)">${sCube(g, 16)}</g>${sTxt(18 + k * 30, 58, card[k], { a: 'middle', s: 16, w: 700 })}`).join('')}</g>${peeked ? sTxt(cx + 65, cy + 90, '나만 본 카드', { a: 'middle', s: 12, w: 700, f: '#ffd45e' }) : ''}`;
  // 상품 머리줄과 주사위
  GOODS.forEach((g, k) => { const x = B.x + 86 + k * 102;
    s += `<g transform="translate(${x + 20},${B.y + 100}) scale(1.05)">${GOODART[g]}</g>${sTxt(x + 43, B.y + 155, GOOD_KO[g], { a: 'middle', s: 14, w: 700, f: '#fff' })}`;
    const dv = G.dice ? G.dice[m][g] : '';
    s += `<g transform="translate(${x + 22},${B.y + 162})"><rect width="42" height="42" rx="8" fill="${GOODC[g]}" stroke="rgba(0,0,0,.5)" stroke-width="1.5"/><rect x="3" y="3" width="36" height="10" rx="4" fill="#fff" opacity=".2"/>${sTxt(21, 29, dv, { a: 'middle', s: 22, w: 700, f: g === 'silk' ? '#16303d' : '#fff' })}</g>`;
    if (card) s += sTxt(x + 78, B.y + 190, '+' + card[k], { s: 16, w: 700, f: '#ffd45e' });
    const evb = (eu ? [['dem', '수요'], ['sale', '값']] : [['sup', '공급']]).map(([kd, nm]) => [nm, evMod(G, kd, g)]).filter(z => z[1]);
    if (evb.length) { const t = '사건 ' + evb.map(([nm, v]) => nm + sgnK(v)).join(' '); s += `<rect x="${x + 4}" y="${B.y + 209}" width="80" height="17" rx="8.5" fill="rgba(0,0,0,.45)" stroke="#ffd45e" stroke-width="1"/>${sTxt(x + 44, B.y + 221.5, t, { a: 'middle', s: 10.5, w: 700, f: '#ffd45e' })}`; }
  });
  s += sTxt(B.x + 20, B.y + 190, eu ? '수요' : '공급', { s: 13, w: 700, f: 'rgba(255,255,255,.8)' });
  rows.forEach((p, ri) => { const y = B.y + 236 + ri * 78;
    s += `<line x1="${B.x + 16}" x2="${B.x + B.w - 16}" y1="${y - 8}" y2="${y - 8}" stroke="rgba(255,255,255,.15)"/>${sCoin(B.x + 42, y + 26, 20, p)}`;
    GOODS.forEach((g, k) => { s += `<rect x="${B.x + 86 + k * 102}" y="${y}" width="96" height="60" rx="8" fill="rgba(0,0,0,.18)"/>`; });
  });
  for (const g of GOODS) {
    const arr = marketSlots(m, g), n = G.markets[m][g];
    arr.forEach((_, i) => { const q = mkSlotPos(m, g, i), next = eu ? i === n : i === n - 1;
      s += `<rect x="${q.x}" y="${q.y}" width="20" height="20" rx="3" fill="none" stroke="rgba(255,255,255,${next ? 1 : 0.28})" stroke-width="${next ? 2.5 : 1}" ${next ? '' : 'stroke-dasharray="3 2"'}/>`;
      if (i < n) s += pc(`mk${m[0]}${g}${i}`, 'cube-' + g, q.x, q.y, sCube(g));
    });
  }
  const fy = B.y + 236 + rows.length * 78 + 6;
  s += sTxt(B.x + 20, fy + 30, eu ? '지금 팔면' : '지금 사면', { s: 13, w: 700, f: 'rgba(255,255,255,.8)' });
  GOODS.forEach((g, k) => { const v = eu ? sellPrice(G, g) : buyPrice(G, g); s += v == null ? sTxt(B.x + 129 + k * 102, fy + 32, '품절', { a: 'middle', s: 14, f: '#fff' }) : sCoin(B.x + 129 + k * 102, fy + 24, 17, v); });
  if (eu) s += sTxt(B.x + 20, fy + 66, '칸이 다 차면 1GP에 팝니다', { s: 12, f: 'rgba(255,255,255,.65)' });
  else s += sTxt(B.x + 20, fy + 66, '교역소가 있는 지역에서는 큐브당 1GP 쌉니다', { s: 12, f: 'rgba(255,255,255,.65)' });
  return s;
}
function drawMats() {
  const aw = G.awaiting, la = LA(), act = canAct();
  let s = '';
  G.players.forEach((pl, p) => {
    const M = matBox(p), me = MODE === 'online' && mine.has(p), turn = !G.over && aw.player === p, actor = act && turn;
    s += `<g><rect x="${M.x}" y="${M.y}" width="${M.w}" height="${M.h}" rx="16" fill="url(#mat)" stroke="${PCOL[p]}" stroke-width="${turn ? 6 : 3}" filter="url(#sh)"/>
      <path d="M${M.x} ${M.y + 16} q0 -16 16 -16 h${M.w - 32} q16 0 16 16 v34 h${-M.w} z" fill="${PCOL[p]}"/>
      ${sTxt(M.x + 20, M.y + 34, pl.name, { s: 21, w: 700, f: '#fff', cls: 'disp' })}${me ? `<g transform="translate(${M.x + 30 + pl.name.length * 21},${M.y + 13})"><rect width="30" height="24" rx="12" fill="#fff"/>${sTxt(15, 17, '나', { a: 'middle', s: 13, w: 700 })}</g>` : ''}
      ${turn ? sTxt(M.x + M.w - 16, M.y + 33, act && turn ? '내 차례' : '차례', { a: 'end', s: 15, w: 700, f: '#fff' }) : ''}
      ${sCoin(M.x + 62, M.y + 112, 36, pl.treasury)}${sTxt(M.x + 62, M.y + 168, '금고', { a: 'middle', s: 13, w: 700, f: '#6e5c45' })}
      <rect x="${M.x + 24}" y="${M.y + 186}" width="76" height="62" rx="8" fill="#fffaf0" stroke="#8a7350"/>${sTxt(M.x + 62, M.y + 206, '판매액', { a: 'middle', s: 12, w: 700, f: '#6e5c45' })}${sTxt(M.x + 62, M.y + 236, pl.sales, { a: 'middle', s: 22, w: 700 })}
      ${pl.debt ? `<g transform="translate(${M.x + 24},${M.y + 254})"><rect width="76" height="26" rx="13" fill="#b4512a"/>${sTxt(38, 18, '부채 ' + pl.debt, { a: 'middle', s: 13, w: 700, f: '#fff' })}</g>` : ''}`;
    // 부두
    for (let k = 0; k < 4; k++) { const q = dockSpot(p, k), open = k < dockCount(pl);
      s += `<circle cx="${q.x}" cy="${q.y}" r="47" fill="${open ? 'rgba(16,48,58,.12)' : 'none'}" stroke="${open ? '#3e5f66' : 'rgba(110,92,69,.35)'}" stroke-width="2" stroke-dasharray="${open ? '0' : '6 5'}"/>${!open ? sTxt(q.x, q.y + 5, k < 4 ? '확장' : '', { a: 'middle', s: 12, f: 'rgba(110,92,69,.6)' }) : ''}`;
      const d = pl.docks[k]; if (!d) continue;
      if (d.loc !== 'port' && d.loc !== 'sea') { s += sTxt(q.x, q.y + 5, `${d.loc} 지역`, { a: 'middle', s: 13, w: 700, f: '#3e5f66' }); continue; }
      const drag = actor && aw.type === 'sail' && d.loc === 'port' && la.some(a => a.type === 'sail' && a.dock === k);
      const cur = turn && aw.type === 'unload' && aw.dock === k, selc = ui.sel && ui.sel.t === 'ship' && ui.sel.i === k && actor;
      s += pc(`sh${p}.${k}`, `ship${p}`, q.x, q.y, sShip(d, p, 44) + (drag && !selc ? `<circle class="ring" r="52" fill="none" stroke="#ffd45e" stroke-width="4"/>` : '') + (cur || selc ? `<circle r="53" fill="none" stroke="#ffd45e" stroke-width="5" class="pulse"/>` : ''),
        drag ? `data-drag="ship" ${actAttrs('pickship', `data-i="${k}"`, `${SHIP_KO[d.type]} 고르기`)}` : '', drag ? 'hot drag' : '');
    }
    // 창고
    const wx = M.x + 148, wy = M.y + 190, cap = whCap(pl);
    s += `<rect x="${wx}" y="${wy}" width="190" height="58" rx="8" fill="#6b4a2c" stroke="#3e2714"/>${sTxt(wx + 10, wy + 18, `창고 ${pl.warehouse.length}/${cap}`, { s: 12, w: 700, f: '#ffe7b8' })}`;
    for (let k = 0; k < Math.max(cap, 1); k++) s += `<rect x="${wx + 12 + k * 30}" y="${wy + 26}" width="22" height="22" rx="3" fill="none" stroke="rgba(255,231,184,${k < cap ? 0.6 : 0.2})" stroke-dasharray="3 2"/>`;
    pl.warehouse.forEach((g, k) => { s += pc(`wh${p}.${k}`, 'cube-' + g, wx + 13 + k * 30, wy + 27, sCube(g)); });
    // 판매 마커 트랙
    const tx = M.x + 352, ty = M.y + 190;
    s += sTxt(tx, ty + 12, '판매 마커', { s: 12, w: 700, f: '#6e5c45' });
    for (let k = 0; k <= 5; k++) s += `<rect x="${tx + k * 31}" y="${ty + 20}" width="28" height="28" rx="5" fill="#fffaf0" stroke="#8a7350"/>${sTxt(tx + k * 31 + 14, ty + 38, k ? k * 10 : 0, { a: 'middle', s: 11, f: '#6e5c45' })}`;
    s += pc('sales' + p, 'sales', tx + pl.salesMarker * 31 + 14, ty + 34, `<circle r="12" fill="${PCOL[p]}" stroke="rgba(0,0,0,.55)" stroke-width="1.5"/>`);
    // 주식 증서
    const cx0 = M.x + 352, cy0 = M.y + 262;
    s += sTxt(cx0, cy0 + 12, '주식', { s: 12, w: 700, f: '#6e5c45' });
    let ci = 0;
    const cert = (c, label, attrs, hot) => { const x = cx0 + (ci % 3) * 64, y = cy0 + 18 + Math.floor(ci / 3) * 40; ci++;
      return `<g class="${hot ? 'hot' : ''}" ${attrs} transform="translate(${x},${y})"><rect class="hl" width="58" height="34" rx="4" fill="#fffaf0" stroke="${PCOL[c]}" stroke-width="2.5"/><rect width="58" height="8" rx="3" fill="${PCOL[c]}"/>${sTxt(29, 27, label, { a: 'middle', s: 12, w: 700 })}</g>`; };
    s += cert(p, '경영권×2', '', false);
    pl.shares.forEach((k, c) => { if (!k) return; const ok = actor && la.some(a => a.type === 'sellShare' && a.company === c);
      s += cert(c, `${G.players[c].name}×${k}`, ok ? actAttrs('sell', `data-c="${c}"`, `${G.players[c].name} 주식 팔기`) : '', ok && aw.type === 'raise'); });
    // 대기 중인 요원
    s += sTxt(M.x + 24, M.y + 290, '요원', { s: 12, w: 700, f: '#6e5c45' });
    for (let i = 0; i < 3; i++) { const h = homeSpot(p, i); s += `<circle cx="${h.x}" cy="${h.y}" r="20" fill="rgba(0,0,0,.08)" stroke="rgba(110,92,69,.4)" stroke-dasharray="3 3"/>`; }
    // 살 수 있는 배
    s += sTxt(M.x + 24, M.y + 370, '살 수 있는 배', { s: 12, w: 700, f: '#6e5c45' });
    pl.supply.forEach((t, k) => { const info = shipInfo(t), late = info.period > G.period, x = M.x + 44 + k * 64, y = M.y + 418, dup = pl.supply.slice(0, k).filter(z => z === t).length;
      s += pc(`sup${p}${t}${dup}`, `ship${p}`, x, y, `<g opacity="${late ? 0.45 : 1}"><circle r="27" cy="2" fill="rgba(0,0,0,.3)"/><circle r="27" fill="url(#shipface)" stroke="${PCOL[p]}" stroke-width="4"/><g transform="translate(0 -3)">${shipArt(t, 0.5)}</g>${sTxt(0, -15, SHIP_SHORT[t], { a: 'middle', s: 9, w: 700, f: '#10303a', cls: 'shipname' })}${sTxt(0, 15, `▣${info.tonnage} ≫${info.speed}`, { a: 'middle', s: 9, w: 700, f: '#10303a' })}${sTxt(0, 24, '★'.repeat(info.period) + ' ' + shipCost(G, t) + 'GP', { a: 'middle', s: 8, f: shipCost(G, t) !== info.cost ? '#b8322a' : '#8a5a00' })}</g>`); });
    s += `</g>`;
  });
  return s;
}
function agentMatch(a, i) {
  if (a.agent === i) return true;
  const pl = G.players[G.awaiting.player], A = pl.agents[a.agent], B = pl.agents[i];
  return A && B && A.at == null && B.at == null && A.last === B.last;
}
function drawAgents() {
  const aw = G.awaiting, la = aw.type === 'place' ? LA() : [];
  let s = '';
  const slotCount = {};
  G.players.forEach((pl, p) => pl.agents.forEach((a, i) => {
    let x, y;
    if (a.at == null) { const h = homeSpot(p, i); x = h.x; y = h.y; }
    else if (a.at === 'center') { const k = (slotCount.center = (slotCount.center || 0) + 1) - 1, x = L.center.cx - 30 + (k % 3) * 30; y = L.center.cy + 14 + Math.floor(k / 3) * 22; }
    else { const key = a.at.char + '.' + a.at.slot, k = (G.occ[key] || []).indexOf(p), q = slotBox(a.at.char, SLOTS[a.at.char].indexOf(a.at.slot)); x = q.x + q.w - 16 - k * 21; y = q.y + 25; }
    const drag = canAct() && aw.type === 'place' && aw.player === p && la.some(x => x.type === 'place' && agentMatch(x, i));
    const sel = ui.sel && ui.sel.t === 'agent' && ui.sel.i === i && aw.player === p;
    s += pc(`ag${p}.${i}`, 'ag' + p, x, y, sMeeple(p, a.at == null ? 38 : 26) + (drag && !sel ? `<circle class="ring" r="23" fill="none" stroke="#ffd45e" stroke-width="3"/>` : '') + (sel ? `<circle r="24" fill="none" stroke="#ffd45e" stroke-width="4" class="pulse"/>` : ''),
      drag ? `data-drag="agent" ${actAttrs('pickagent', `data-i="${i}"`, `${G.players[p].name} 요원 ${i + 1} 고르기`)}` : '', drag ? 'hot drag' : '');
  }));
  return s;
}
const defs = E => `<defs>
  <marker id="arri" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0L10 5L0 10z" fill="${MS().ink}"/></marker>
  <marker id="arr" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0L10 5L0 10z" fill="#fff6dc"/></marker>
  <filter id="sh" x="-5%" y="-5%" width="110%" height="115%"><feDropShadow dx="0" dy="6" stdDeviation="6" flood-color="#000" flood-opacity=".45"/></filter>
  <radialGradient id="gold" cx=".35" cy=".3"><stop offset="0" stop-color="#ffefb0"/><stop offset=".6" stop-color="#e2b13c"/><stop offset="1" stop-color="#b8861c"/></radialGradient>
  <linearGradient id="paper" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${E.paper[0]}"/><stop offset="1" stop-color="${E.paper[1]}"/></linearGradient>
  <linearGradient id="mat" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${E.paper[0]}"/><stop offset="1" stop-color="${E.paper[1]}"/></linearGradient>
  <linearGradient id="leather" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#b85a2e"/><stop offset="1" stop-color="#8d3f1d"/></linearGradient>
  <linearGradient id="wood2" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#7a5334"/><stop offset="1" stop-color="#5a3a20"/></linearGradient>
  <radialGradient id="sea" cx=".5" cy=".45" r=".75"><stop offset="0" stop-color="${E.sea[0]}"/><stop offset="1" stop-color="${E.sea[1]}"/></radialGradient>
  <radialGradient id="mapvig" cx=".5" cy=".5" r=".75"><stop offset=".55" stop-color="#6a4218" stop-opacity="0"/><stop offset="1" stop-color="#6a4218" stop-opacity="${MS().vig}"/></radialGradient>
  <linearGradient id="land" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${E.land[0]}"/><stop offset="1" stop-color="${E.land[1]}"/></linearGradient>
  <linearGradient id="stone2" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f1ece0"/><stop offset="1" stop-color="#d6cdb8"/></linearGradient>
  <linearGradient id="eu" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2a6170"/><stop offset="1" stop-color="#173f49"/></linearGradient>
  <linearGradient id="in" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#7a5236"/><stop offset="1" stop-color="#4f321f"/></linearGradient>
  <radialGradient id="stone" cx=".4" cy=".35"><stop offset="0" stop-color="#e3e6e3"/><stop offset="1" stop-color="#a9afab"/></radialGradient>
  <radialGradient id="shipface" cx=".5" cy=".3"><stop offset="0" stop-color="#e4f2f5"/><stop offset="1" stop-color="#8fbccb"/></radialGradient>
  <radialGradient id="shipsea" cx=".5" cy=".3"><stop offset="0" stop-color="#f6efdc"/><stop offset="1" stop-color="#cdbd93"/></radialGradient>
  <pattern id="shipback" width="10" height="10" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="10" height="10" fill="#2c5a6a"/><rect width="5" height="10" fill="#244c5a"/></pattern>
  <pattern id="cardback" width="12" height="12" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="12" height="12" fill="#5a2a12"/><rect width="6" height="12" fill="#6b3418"/></pattern>
</defs>`;
function drawTable() {
  return defs(era()) + drawStatus() + drawTrack() + drawCerts() + drawMarket('europe') + drawMarket('indies') + drawMap() + drawChars() + drawEventCard() + drawMats() + drawAgents() + '<g id="ghost" pointer-events="none"></g>';
}

// ---------- 카메라(끌어서 이동, 휠·두 손가락 확대) ----------
const cam = { x: 0, y: 0, w: TW, h: TH };
function autoCam() { try { return localStorage.getItem('eic-autocam') !== '0'; } catch (e) { return true; } }
const VIEWS = {
  all: { x: 0, y: 0, w: TW, h: TH },
  board: { x: 560, y: 0, w: 1280, h: 1200 },
  europe: { x: 20, y: 180, w: 580, h: 900 },
  indies: { x: 1800, y: 180, w: 580, h: 900 },
};
function setCam(v) { Object.assign(cam, v); const svg = $('table'); if (svg) svg.setAttribute('viewBox', `${cam.x} ${cam.y} ${cam.w} ${cam.h}`); }
function fitView(v, animate = true) {
  const svg = $('table'); if (!svg) return;
  const r = svg.getBoundingClientRect(), bar = $('bar'), bh = bar && !bar.hidden ? bar.getBoundingClientRect().height : 0, top = 46;
  const availH = Math.max(80, r.height - bh - top), ar = r.width && availH ? r.width / availH : TW / TH;
  let { x, y, w, h } = v; if (w / h > ar) { const nh = w / ar; y -= (nh - h) / 2; h = nh; } else { const nw = h * ar; x -= (nw - w) / 2; w = nw; }
  const sc = r.width ? w / r.width : 1, to = { x, y: y - top * sc, w, h: h + (bh + top) * sc };
  if (!animate || matchMedia('(prefers-reduced-motion: reduce)').matches) return setCam(to);
  const from = { ...cam }, t0 = performance.now();
  const step = t => { const k = Math.min(1, (t - t0) / 420), e = 1 - Math.pow(1 - k, 3); setCam({ x: from.x + (to.x - from.x) * e, y: from.y + (to.y - from.y) * e, w: from.w + (to.w - from.w) * e, h: from.h + (to.h - from.h) * e }); if (k < 1) requestAnimationFrame(step); };
  requestAnimationFrame(step);
}
const myMat = () => { const p = MODE === 'online' && mine.size ? [...mine][0] : G && !G.over ? G.awaiting.player : 0; const m = matBox(p); return { x: m.x - 40, y: m.y - 60, w: m.w + 80, h: m.h + 100 }; };
const unionR = (a, b) => { const x = Math.min(a.x, b.x), y = Math.min(a.y, b.y); return { x, y, w: Math.max(a.x + a.w, b.x + b.w) - x, h: Math.max(a.y + a.h, b.y + b.h) - y }; };
function focusFor(aw) {
  const m = matBox(aw.player), r0 = $('table') && $('table').getBoundingClientRect(), portrait = r0 && r0.width < r0.height;
  const mat = portrait ? { x: 900, y: 900, w: 1, h: 1 } : { x: m.x - 20, y: m.y - 20, w: m.w + 40, h: m.h + 40 };
  if (portrait && aw.type === 'place') return { x: 610, y: 790, w: 1180, h: 420 };
  if (portrait && (aw.type === 'unload' || aw.type === 'sellWarehouse')) return VIEWS.europe;
  if (aw.type === 'place') return unionR({ x: 600, y: 780, w: 1200, h: 420 }, mat);
  if (aw.type === 'stock') return { x: 560, y: 0, w: 1820, h: 220 };
  if (aw.type === 'raise') return unionR({ x: 1820, y: 20, w: 540, h: 170 }, mat);
  if (aw.type === 'sail') return unionR({ x: 600, y: 200, w: 1200, h: 580 }, mat);
  if (aw.type === 'load') { const r = regionBox(aw.region); return unionR(r, { x: 1830, y: 200, w: 520, h: 860 }); }
  if (aw.type === 'unload' || aw.type === 'sellWarehouse') return unionR({ x: 40, y: 200, w: 540, h: 860 }, mat);
  if (aw.type === 'chooseCard') return aw.market === 'indies' ? VIEWS.indies : VIEWS.europe;
  return VIEWS.all;
}
function toWorld(cx, cy) { const svg = $('table'), m = svg.getScreenCTM(); if (!m) return { x: 0, y: 0 }; const p = svg.createSVGPoint(); p.x = cx; p.y = cy; const q = p.matrixTransform(m.inverse()); return { x: q.x, y: q.y }; }

// ---------- 그리기 + 움직임 ----------
let firstDraw = true;
function render() {
  const svg = $('table');
  if (svg) {
    const old = {};
    svg.querySelectorAll('.pc').forEach(el => { old[el.dataset.k] = { x: +el.dataset.x, y: +el.dataset.y, kind: el.dataset.kind }; });
    svg.innerHTML = drawTable();
    if (!firstDraw && !matchMedia('(prefers-reduced-motion: reduce)').matches) animatePieces(svg, old);
    firstDraw = false;
    bindTable();
    if (!cam.fitted && svg.getBoundingClientRect().width > 0) { cam.fitted = true; fitView(VIEWS.all, false); }
  }
  const tw = $('tablewrap'); if (tw) { const cl = 'e' + G.period; if (tw.className !== cl) tw.className = cl; }
  if (G.period !== ui.lastEra) { const prev = ui.lastEra; ui.lastEra = G.period; showEra(prev == null); }
  renderBar();
  $('log').innerHTML = G.log.slice(-60).reverse().map(l => `<li>${esc(l)}</li>`).join('');
  $('undo').disabled = MODE === 'online' ? !(NET.room && NET.room.prev && NET.room.prevBy === NET.uid && !NET.busy) : !history.length;
  $('new').hidden = MODE !== 'local'; $('leave').hidden = false; $('leave').textContent = '나가기';
  $('roomtag').hidden = false; $('roomtag').textContent = MODE === 'online' ? `방 ${NET.code}${NET.hostGone ? ' · 방장 연결 끊김' : ''}` : '혼자 테스트';
  document.title = MODE === 'online' && canAct() ? '● 내 차례 — 동인도회사' : '동인도회사';
  const aw = G.awaiting;
  if (aw.type === 'sail' && canAct() && !ui.sel) { const ds = G.players[aw.player].docks.map((d, i) => d && d.loc === 'port' ? i : -1).filter(i => i >= 0); if (ds.length === 1) { ui.sel = { t: 'ship', i: ds[0] }; ui.ship = ds[0]; return render(); } }
  const f = G.over ? 'over' : aw.type + ':' + aw.player + ':' + G.phase + ':' + G.period;
  if (f !== lastFocus && (canAct() || G.over)) { lastFocus = f; if (autoCam() && !G.over) requestAnimationFrame(() => fitView(focusFor(aw))); }
  const ac = $('autocam'); if (ac) { ac.textContent = autoCam() ? '자동 시점' : '시점 고정'; ac.setAttribute('aria-pressed', autoCam()); }
}
function showEra(first) {
  const el = $('era'); if (!el || G.over) return; const E = era();
  const ev = eventOf(G);
  el.innerHTML = `<div class="era-k">${G.period}기간 · ${E.years}</div><div class="era-n">${E.name}</div><div class="era-s">${E.sub.join(' ')}</div>${ev ? `<div class="era-e"><b>사건 · ${esc(ev.name)}</b> (${esc(ev.year)})<br>${eventLines(ev).map(l => esc(l.t)).join(' · ')}</div>` : ''}`;
  if (el.style) el.style.animationDuration = ev ? '6s' : ''; el.classList.remove('show'); void el.offsetWidth; el.classList.add('show');
}
function animatePieces(svg, old) {
  const pool = {}, now = {};
  svg.querySelectorAll('.pc').forEach(el => { now[el.dataset.k] = true; });
  for (const k in old) if (!now[k]) (pool[old[k].kind] = pool[old[k].kind] || []).push(old[k]);
  svg.querySelectorAll('.pc').forEach(el => {
    const k = el.dataset.k, x = +el.dataset.x, y = +el.dataset.y, inner = el.firstElementChild;
    let from = old[k];
    if (!from && pool[el.dataset.kind] && pool[el.dataset.kind].length) from = pool[el.dataset.kind].shift();
    if (from && (Math.abs(from.x - x) > 0.5 || Math.abs(from.y - y) > 0.5)) {
      inner.animate([{ transform: `translate(${from.x - x}px,${from.y - y}px) scale(1.12)` }, { transform: 'translate(0,0) scale(1)' }], { duration: 560, easing: 'cubic-bezier(.2,.8,.2,1)' });
    } else if (!from && !old[k]) inner.animate([{ opacity: 0, transform: 'scale(.6)' }, { opacity: 1, transform: 'scale(1)' }], { duration: 320, easing: 'ease-out' });
  });
}

// ---------- 아래 띠(차례 안내와 고르기) ----------
function renderBar() {
  const bar = $('bar');
  if (G.over) { bar.innerHTML = `<div class="bar-t"><b>게임 종료</b></div><div class="scroll"><table class="score"><thead><tr><th>순위</th><th>회사</th><th>경영권</th><th>주식</th><th>현금</th><th>부채</th><th>합계</th></tr></thead><tbody>${G.ranking.map((p, i) => { const sc = G.scores[p]; return `<tr><td>${i + 1}</td><td>${pdot(p)}${esc(G.players[p].name)}</td><td>${sc.president}</td><td>${sc.shares}</td><td>${sc.cash}</td><td>${sc.debt ? '−' + sc.debt : ''}</td><td><b>${sc.total}</b></td></tr>`; }).join('')}</tbody></table></div>`; return; }
  const aw = G.awaiting, p = aw.player, pl = G.players[p], la = LA();
  let msg = '', ctl = '';
  if (!canAct()) {
    bar.innerHTML = `<div class="bar-t" style="--pc:${PCOL[p]}">${meeple(p, 'lg')}<div><b>${esc(pl.name)}</b> <span class="bar-ph">${G.phase} ${PHASE_KO[G.phase]}</span><div class="bar-m">${esc(pl.name)} 님 차례예요. 기다리는 중…</div></div></div>`;
    return;
  }
  if (ui.chooser) { msg = ui.chooser.title; ctl = ui.chooser.acts.map((a, i) => `<button type="button" class="go" data-ch="${i}">${esc(a.short)}</button>`).join('') + `<button type="button" data-cancel="1">취소</button>`; }
  else if (aw.type === 'place') { msg = ui.sel ? '빛나는 칸에 놓으세요 (다시 누르면 고르기 취소)' : '요원을 빛나는 칸으로 끌어다 놓으세요. 눌러서 고른 뒤 칸을 눌러도 돼요'; if (la.some(a => a.type === 'passA')) ctl = `<button type="button" class="go" data-pass="passA">중앙 요원을 두고 마침</button>`; }
  else if (aw.type === 'raise') { msg = `${esc(G.players[aw.to].name)}에게 배당 ${aw.need}GP를 내야 하는데 금고가 ${pl.treasury}GP예요. 주식을 팔아 돈을 마련하세요. 팔 주식이 없으면 모자란 만큼 부채로 남아요.`; ctl = la.map(a => `<button type="button" class="go" data-forced="${a.company}">${esc(a.label)}</button>`).join(''); }
  else if (aw.type === 'stock') { msg = '오른쪽 위 증권거래소의 주식 더미를 눌러 1장 사거나 패스하세요'; ctl = `<button type="button" class="go" data-pass="pass">패스</button>`; }
  else if (aw.type === 'chooseCard') { msg = `${aw.market === 'indies' ? '인도(공급)' : '유럽(수요)'} 카드를 하나 고르세요. 다른 사람은 못 봐요`; ctl = la.filter(a => a.type === 'chooseCard').map(a => { const c = DATA.marketCards[aw.market][cardGroup()][a.card].all; return `<button type="button" class="mcard ${aw.market}" data-card="${a.card}">${GOODS.map((g, i) => `<span>${cube(g)}${c[i]}</span>`).join('')}</button>`; }).join(''); }
  else if (aw.type === 'sail') { msg = ui.ship == null ? '항구의 배를 지도 위 지역으로 끌어다 놓으세요' : '빛나는 지역에 놓으세요 (끌어도 돼요)'; }
  else if (aw.type === 'load') {
    const d = pl.docks[aw.dock], rg = DATA.regions[aw.region], t = shipInfo(d.type).tonnage, pick = ui.pick || (ui.pick = {});
    const goodsOf = pk => rg.goods.flatMap(g => Array(pk[g] || 0).fill(g));
    const find = pk => la.find(a => a.type === 'load' && sameCounts(countOf(a.goods), pk));
    const total = goodsOf(pick).length, cost = loadCost(G, p, aw.region, goodsOf(pick));
    msg = `${SHIP_KO[d.type]} · ${rg.name}에서 싣기 · 톤수 ${total}/${t}`;
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
  ctl += `<button type="button" class="ghostbtn" data-look="1">할 곳 보기</button>`;
  bar.innerHTML = `<div class="bar-t" style="--pc:${PCOL[p]}">${meeple(p, 'lg')}<div><b>${esc(pl.name)}</b> <span class="bar-ph">${G.phase} ${PHASE_KO[G.phase]}</span> ${coin(pl.treasury)}<div class="bar-m">${msg}</div></div></div><div class="bar-c">${ctl}</div>`;
}
const short = a => a.label.replace(/^.*? · /, '').replace(/^배 구입: /, '').replace(/^교역소: /, '');
function choose(title, acts) { if (!acts.length) return; if (acts.length === 1) return doAct(acts[0]); ui.chooser = { title, acts: acts.map(a => ({ ...a, short: (a.label.startsWith('(') || a.label.startsWith('중앙에서') ? a.label.split(' · ')[0].replace(/→ .*/, '→ ') + ' ' : '') + short(a) })) }; renderBar(); }

// ---------- 테이블 위 조작 ----------
function tableAct(el, dropFrom) {
  if (!G || !canAct()) return;
  const aw = G.awaiting, la = LA(), t = el.dataset.act, sel = dropFrom || ui.sel;
  if (t === 'pickagent' || t === 'pickship') {
    const i = +el.dataset.i, kind = t === 'pickagent' ? 'agent' : 'ship';
    ui.sel = ui.sel && ui.sel.t === kind && ui.sel.i === i ? null : { t: kind, i }; ui.ship = ui.sel && kind === 'ship' ? i : null; ui.chooser = null; return render();
  }
  if (t === 'slot' || t === 'center') {
    let acts = la.filter(a => a.type === 'place' && (t === 'center' ? a.char === 'center' : `${a.char}.${a.slot}` === el.dataset.s));
    if (sel && sel.t === 'agent') { const f = acts.filter(a => agentMatch(a, sel.i)); if (f.length) acts = f; }
    ui.sel = null;
    const [c, sl] = t === 'center' ? ['center', ''] : el.dataset.s.split('.');
    return choose(t === 'center' ? '중앙에 놓기' : `${CHAR_KO[c]} · ${SLOT_KO[sl]}`, acts);
  }
  if (t === 'region') {
    const dock = sel && sel.t === 'ship' ? sel.i : ui.ship;
    const a = la.find(x => x.type === 'sail' && x.region === el.dataset.r && (dock == null || x.dock === dock));
    ui.sel = null; ui.ship = null; return doAct(a);
  }
  if (t === 'buy') return doAct(la.find(a => a.type === 'buyShare' && a.company === +el.dataset.c));
  if (t === 'sell') {
    const a = la.find(x => x.type === 'sellShare' && x.company === +el.dataset.c); if (!a) return;
    if (aw.type === 'raise') return doAct(a);
    ui.chooser = { title: '주식 매도 (차례를 쓰지 않아요)', acts: [{ ...a, short: a.label }] }; return renderBar();
  }
}
const drag = { el: null, id: null, sx: 0, sy: 0, moved: false, pan: null, pts: new Map(), pinch: null };
function onDown(e) {
  const svg = $('table'); if (!svg) return;
  svg.setPointerCapture && svg.setPointerCapture(e.pointerId);
  drag.pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
  if (drag.pts.size === 2) { const [a, b] = [...drag.pts.values()]; drag.pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), cam: { ...cam }, mid: toWorld((a.x + b.x) / 2, (a.y + b.y) / 2) }; drag.el = null; drag.pan = null; return; }
  const pieceEl = e.target.closest && e.target.closest('[data-act]');
  drag.el = pieceEl; drag.id = e.pointerId; drag.sx = e.clientX; drag.sy = e.clientY; drag.moved = false;
  drag.pan = { cx: e.clientX, cy: e.clientY, cam: { ...cam } };
}
function onMove(e) {
  if (!drag.pts.has(e.pointerId)) return;
  drag.pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
  const svg = $('table');
  if (drag.pinch && drag.pts.size === 2) {
    const [a, b] = [...drag.pts.values()], d = Math.hypot(a.x - b.x, a.y - b.y), k = Math.max(0.25, Math.min(4, drag.pinch.d / d)), c = drag.pinch.cam, m = drag.pinch.mid;
    const w = Math.max(300, Math.min(TW * 1.6, c.w * k)), h = w * c.h / c.w;
    setCam({ x: m.x - (m.x - c.x) * (w / c.w), y: m.y - (m.y - c.y) * (h / c.h), w, h }); return;
  }
  if (e.pointerId !== drag.id) return;
  const dx = e.clientX - drag.sx, dy = e.clientY - drag.sy;
  if (!drag.moved && Math.hypot(dx, dy) > 7) {
    drag.moved = true;
    if (drag.el && drag.el.dataset.drag && canAct()) { // 말이나 배를 집어 든다
      const g = $('ghost'), src = drag.el.querySelector('.in');
      g.innerHTML = `<g class="lift">${src ? src.innerHTML : ''}</g>`; drag.el.classList.add('lifted');
      ui.sel = { t: drag.el.dataset.drag, i: +drag.el.dataset.i }; if (ui.sel.t === 'ship') ui.ship = ui.sel.i;
      svg.classList.add('dragging'); drag.carry = { t: ui.sel.t, i: ui.sel.i };
      highlightDrops(svg, drag.carry);
    }
  }
  if (!drag.moved) return;
  if (drag.carry) { const w = toWorld(e.clientX, e.clientY); $('ghost').setAttribute('transform', `translate(${w.x},${w.y})`);
    svg.querySelectorAll('.over').forEach(x => x.classList.remove('over'));
    const t = dropAt(e.clientX, e.clientY); if (t) t.classList.add('over'); return; }
  const p = drag.pan; if (!p) return; const r = svg.getBoundingClientRect(), s = cam.w / r.width;
  setCam({ ...cam, x: p.cam.x - (e.clientX - p.cx) * s, y: p.cam.y - (e.clientY - p.cy) * s });
}
function dropAt(cx, cy) { const el = document.elementFromPoint(cx, cy); return el && el.closest ? el.closest('[data-drop]') : null; }
function highlightDrops(svg, carry) {
  const la = LA();
  svg.querySelectorAll('[data-drop]').forEach(t => {
    let ok = false;
    if (carry.t === 'agent') ok = la.some(a => a.type === 'place' && agentMatch(a, carry.i) && (t.dataset.drop === 'center' ? a.char === 'center' : `${a.char}.${a.slot}` === t.dataset.s));
    if (carry.t === 'ship') ok = t.dataset.drop === 'region' && la.some(a => a.type === 'sail' && a.dock === carry.i && a.region === t.dataset.r);
    t.classList.toggle('dimmed', !ok); if (!ok) t.removeAttribute('data-drop');
  });
}
function onUp(e) {
  const svg = $('table');
  const wasPinch = !!drag.pinch;
  drag.pts.delete(e.pointerId);
  if (drag.pts.size < 2) drag.pinch = null;
  if (wasPinch || e.pointerId !== drag.id) return;
  const carry = drag.carry; drag.carry = null;
  if (carry) {
    const t = dropAt(e.clientX, e.clientY);
    svg.classList.remove('dragging'); $('ghost').innerHTML = '';
    if (t) return tableAct(t, carry);
    return render();
  }
  if (!drag.moved && drag.el) tableAct(drag.el);
  drag.el = null; drag.pan = null;
}
function onWheel(e) {
  e.preventDefault(); const m = toWorld(e.clientX, e.clientY), k = Math.exp(e.deltaY * 0.0012);
  const w = Math.max(300, Math.min(TW * 1.6, cam.w * k)), h = w * cam.h / cam.w;
  setCam({ x: m.x - (m.x - cam.x) * (w / cam.w), y: m.y - (m.y - cam.y) * (h / cam.h), w, h });
}
function zoomBy(k) { const c = { x: cam.x + cam.w / 2, y: cam.y + cam.h / 2 }, w = Math.max(300, Math.min(TW * 1.6, cam.w * k)), h = w * cam.h / cam.w; fitView({ x: c.x - w / 2, y: c.y - h / 2, w, h }); }
function bindTable() {
  const svg = $('table'); if (!svg || svg.dataset.bound) return; svg.dataset.bound = '1';
  svg.addEventListener('pointerdown', onDown); svg.addEventListener('pointermove', onMove);
  svg.addEventListener('pointerup', onUp); svg.addEventListener('pointercancel', e => { drag.pts.delete(e.pointerId); drag.pinch = null; if (drag.carry) { drag.carry = null; svg.classList.remove('dragging'); $('ghost').innerHTML = ''; render(); } });
  svg.addEventListener('wheel', onWheel, { passive: false });
  svg.addEventListener('keydown', e => { if ((e.key === 'Enter' || e.key === ' ') && e.target.closest('[data-act]')) { e.preventDefault(); tableAct(e.target.closest('[data-act]')); } });
  window.addEventListener('resize', () => fitView(cam, false));
}
document.addEventListener('click', e => {
  const b = e.target.closest('button'); if (!b || b.disabled) return;
  if (b.dataset.l != null || b.id === 'leave') return lobbyClick(b);
  if (b.dataset.view) { const v = b.dataset.view; return fitView(v === 'mine' ? myMat() : VIEWS[v]); }
  if (b.dataset.zoom) return zoomBy(+b.dataset.zoom);
  if (b.id === 'autocam') { try { localStorage.setItem('eic-autocam', autoCam() ? '0' : '1'); } catch (e) {} if (G) render(); return; }
  if (!G) return;
  const ds = b.dataset, aw = G.awaiting, la = LA();
  if (b.id === 'undo') return undo();
  if (b.id === 'new') { $('confirm').hidden = false; return; }
  if (b.id === 'new-yes') { $('confirm').hidden = true; return newGame(); }
  if (b.id === 'new-no') { $('confirm').hidden = true; return; }
  if (ds.look) return fitView(focusFor(aw));
  if (ds.cancel) { ui.chooser = null; return renderBar(); }
  if (ds.ch != null) { const a = ui.chooser.acts[+ds.ch]; return doAct(la.find(x => x.key === a.key)); }
  if (ds.pass) return doAct(la.find(a => a.type === ds.pass));
  if (ds.forced != null) return doAct(la.find(a => a.type === 'sellShare' && a.company === +ds.forced));
  if (ds.card != null) return doAct(la.find(a => a.type === 'chooseCard' && a.card === +ds.card));
  if (ds.plus) { ui.pick[ds.plus] = (ui.pick[ds.plus] || 0) + 1; return renderBar(); }
  if (ds.minus) { ui.pick[ds.minus]--; return renderBar(); }
  if (ds.load) return doAct(la.find(a => a.type === 'load' && sameCounts(countOf(a.goods), ui.pick || {})));
  if (ds.stay) return doAct(la.find(a => a.type === 'stay'));
  if (ds.tg != null) { ui.sell[+ds.tg] = !ui.sell[+ds.tg]; return renderBar(); }
  if (ds.sellgo) { const src = aw.type === 'unload' ? G.players[aw.player].docks[aw.dock].cargo : G.players[aw.player].warehouse; const counts = countOf(src.filter((_, i) => ui.sell[i])); return doAct(la.find(a => a.type === aw.type && sameCounts(a.sell, counts))); }
});
