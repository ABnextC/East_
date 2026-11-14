// ---------- 인도양 지도: 실제 해안선(geo.js, Natural Earth) 위에 시대별 옛 지도 양식으로 그림 ----------
// 경도 50~134°E, 위도 30°N~10°S. 1도 = 14.05px(가로), 14px(세로)
const GP = (lon, lat) => [L.map.x + (lon - 50) * 14.05, L.map.y + (30 - lat) * 14];
const GL = (lon, lat) => [(lon - 50) * 14.05, (30 - lat) * 14]; // 지도 왼쪽 위 기준
const LANDNAME = [['페르시아', 57, 28.4], ['아라비아', 52.6, 21], ['힌두스탄', 78.5, 22.4], ['버마', 95.9, 22.6], ['시암', 101.2, 16.2], ['안남', 105.4, 16.6], ['청', 112, 26.5], ['실론', 80.8, 4.9], ['수마트라', 101.6, -1.4], ['자와', 110, -9.3], ['보르네오', 114, 0.4], ['셀레베스', 120.6, -2.4], ['루손', 121.1, 17.3], ['민다나오', 124.4, 5]];
const SEANAME = [['아라비아해', 66, 1.9, 20], ['벵골만', 89, 15.4, 16], ['남중국해', 112.6, 5.8, 15], ['인 도 양', 76, -2.6, 24], ['자와해', 111, -5, 15]];
const CITY_GEO = { III: [[72.8, 19], [88.4, 22.6], [79.8, 11.9]], II: [[102.2, 2.2], [106.8, -6.2]], I: [[113.5, 22.2], [114.2, 22.3], [120.5, 23.6]] };
const CITY_LBL = { III: [[-10, 5, 'end'], [10, 5, 'start'], [10, 5, 'start']], II: [[-10, 5, 'end'], [10, 14, 'start']], I: [[-10, 16, 'end'], [10, 16, 'start'], [12, 5, 'start']] };
const POST_OFF = { III: [[0, -19], [0, -19], [0, -19]], II: [[0, -19], [0, -19]], I: [[-13, -17], [13, -17], [0, -19]] };
// 항로 칸(배가 머무는 바다). 지역의 상품을 사는 바다
const ZONE_GEO = { III: [56.5, 18.5, 73, 4], II: [80, 3, 95, -9.4], I: [109.6, 19.6, 119.9, 7.2] };
const regionBox = r => { const [a, b, c, d] = ZONE_GEO[r], p = GP(a, b), q = GP(c, d); return { x: p[0], y: p[1], w: q[0] - p[0], h: q[1] - p[1] }; };
function shipGrid(b, n) {
  let best = { r: 0, cols: 1 };
  for (let cols = 1; cols <= Math.max(1, n); cols++) { const rows = Math.ceil(Math.max(1, n) / cols), r = Math.min((b.w - 12) / cols, (b.h - 46) / rows) / 2 - 3; if (r > best.r) best = { r, cols }; }
  best.r = Math.min(40, best.r); return best;
}
// 시대별 지도 양식
// 1 네덜란드 VOC 손채색 해도 · 2 18세기 후반 영국·프랑스 해도 · 3 19세기 초 상선용 해도
// 4 해군 수로 해도(수심 숫자) · 5 19세기 말 인쇄 지도첩(나라별 색)
const MAPSTYLE = {
  1: { paper: '#e4cb95', sea: '#e2cd9a', land: '#ecd9a9', ink: '#3a2713', wl: [6, 4.3, .55], wash: 15, washOp: .5, tint: null, rhumb: 2, grain: 1, vig: .55, stains: 2, foxes: 12, ship: 'galleon', zone: 'rgba(70,40,12,.08)' },
  2: { paper: '#e8d4a4', sea: '#e7d4a6', land: '#efdeb2', ink: '#36271a', wl: [5, 4.3, .5], wash: 12, washOp: .45, tint: null, rhumb: 1, grain: .85, vig: .42, stains: 1, foxes: 8, ship: 'indiaman', zone: 'rgba(70,40,12,.07)' },
  3: { paper: '#ecdfba', sea: '#eadebc', land: '#f1e5c2', ink: '#3a2d1c', wl: [4, 4, .42], wash: 8, washOp: .4, tint: '#7fb0a6', rhumb: 0, grain: .7, vig: .3, stains: 1, foxes: 5, ship: 'brig', zone: 'rgba(40,60,60,.07)' },
  4: { paper: '#f0e7cd', sea: '#efe6cc', land: '#ebdfbf', ink: '#24211c', wl: [0], wash: 0, tint: '#9fc3cc', rhumb: 0, grain: .55, vig: .2, stains: 0, foxes: 3, ship: 'clipper', zone: 'rgba(30,50,60,.06)' },
  5: { paper: '#f1ead6', sea: '#d4e4e4', land: '#f2ead2', ink: '#28323a', wl: [3, 4, .45, '#5f93ad'], wash: 0, tint: '#8db6c8', rhumb: 0, grain: .45, vig: .14, stains: 0, foxes: 0, ship: 'steamer', flat: true, zone: 'rgba(30,60,90,.07)' },
};
const MS = () => MAPSTYLE[(G && G.period) || 1];
// 손채색 경계 물감(1~3시대)과 인쇄 지도첩 색(5시대)
const WASH = { persia: '#c79b3c', arabia: '#d6ac44', hind: '#bf5144', ceylon: '#4f8f5c', burma: '#5c9154', siam: '#c98a36', annam: '#a85c78', china: '#c49e38', malaya: '#4a8499', indies: '#cc7040', phil: '#7f9a46' };
const ATLAS = { persia: '#e7dbb2', arabia: '#efe4c2', hind: '#efc3b6', ceylon: '#efc3b6', burma: '#f2d0c5', siam: '#d8e3b0', annam: '#dbc9e6', china: '#f1e2a4', malaya: '#efc3b6', indies: '#f5d0a2', phil: '#d4e6c3' };
// 산(옛 지도의 두더지 언덕 모양), 숲, 강
const MOUNTS = [[70, 28.6, 10], [72.6, 29.3, 11], [75, 29.4, 12], [77.4, 29.6, 12], [79.8, 29.3, 13], [82.2, 28.9, 13], [84.6, 28.6, 12], [87, 28.4, 13], [89.5, 28.3, 12], [92, 28.4, 11], [94.6, 28.6, 11],
  [67.2, 28.6, 9], [68.6, 29.6, 9], [51, 29.6, 9], [53.6, 29.3, 10], [56, 29.6, 9], [58.4, 27.4, 8], [61, 27.6, 8], [57.3, 23.2, 8], [51.6, 16.6, 7], [49.8, 16.4, 7],
  [73.8, 18.6, 8], [74.1, 16.6, 8], [74.6, 14.6, 8], [75.4, 12.6, 8], [76.4, 10.8, 9], [77.2, 9.2, 8], [79.2, 16.4, 6], [81.6, 18.4, 7], [83.6, 19.6, 6], [77.6, 15, 6], [78.4, 18.3, 6], [80.8, 7.2, 7],
  [93.4, 21.4, 8], [93.9, 19.4, 8], [94.6, 17.6, 7], [97.6, 22.4, 8], [99.2, 24.2, 9], [101.4, 25.6, 9], [103.4, 24.8, 9], [97.4, 19.4, 7], [98.9, 13.4, 7], [99.2, 10.6, 6],
  [104.6, 19.4, 8], [106.2, 17.2, 8], [107.4, 15.2, 8], [108.2, 13.2, 7], [108.4, 23.6, 8], [106.4, 25.4, 8], [110.4, 25, 9], [113.2, 25.6, 9], [115.8, 24.6, 8], [117.4, 26.4, 9], [119.6, 28, 8], [121, 23.5, 7],
  [96.8, 3.8, 8], [98.4, 2.2, 8], [99.9, 0.2, 8], [101.4, -1.8, 8], [102.9, -3.7, 7], [104.2, -4.8, 6], [107.6, -7.2, 7], [110.4, -7.5, 8], [112.6, -7.9, 7], [114.1, -8, 6],
  [114.6, 1.2, 9], [115.6, 3.2, 8], [116.4, 5.3, 8], [113.4, -0.4, 7], [120, -2.4, 7], [121.4, -1.3, 7], [120.4, -4, 6], [121.2, 17, 8], [121.3, 15.6, 7], [124.9, 7.6, 7], [102, 5, 6]];
const TREES = [[113, 1.6, 6], [116, 1, 5], [111.6, -1.4, 5], [102.2, -0.6, 5], [103.1, -2.6, 4], [102.2, 4, 4], [96.4, 19.8, 4], [101, 17.4, 4], [82, 21, 4], [76.4, 12.6, 3], [104.6, 12, 3], [87.4, 23.4, 3]];
const RIVERS = [
  [[88.2, 21.7], [88.1, 23.5], [87.9, 24.8], [86.5, 25.4], [85.2, 25.6], [83.2, 25.3], [82, 25.3], [81, 25.4], [80.2, 26], [79, 27], [78.2, 29.2]],
  [[90.6, 22.6], [90.3, 23.6], [89.7, 25.3], [90.5, 26.2], [92, 26.5], [94, 27.2], [95.6, 27.8]],
  [[67.4, 24.2], [68.2, 25.4], [68.6, 26.8], [69.6, 28], [70.6, 29.4], [71, 30.4]],
  [[72.7, 21.6], [74, 22.2], [76, 22.2], [78, 22.8], [80, 22.7]], [[82.2, 16.6], [81, 17.6], [79.8, 18.8], [77.8, 19.2], [75.5, 19.8]], [[81, 15.8], [80, 16.5], [78.3, 16.2], [76.5, 16.5], [74.5, 17]], [[79.8, 11.1], [78.7, 10.9], [77.7, 11.4], [76.5, 12.3]],
  [[95, 15.9], [95.3, 17.5], [95, 19.5], [95.4, 21.5], [96.1, 22.4], [96.3, 24.5], [97.2, 25.8]], [[97.6, 16.5], [97.8, 18.2], [98.4, 20], [98.6, 22.5], [98.8, 25]], [[100.6, 13.5], [100.4, 15.5], [100.1, 17], [99.5, 18.5]],
  [[106.6, 9.6], [105.4, 10.6], [105.9, 12.5], [105.8, 14.3], [105.4, 15.5], [104.8, 16.6], [104.2, 17.8], [102.6, 18], [101.8, 19.8], [100.6, 21], [100.8, 23], [99.2, 25]],
  [[106.6, 20.3], [105.8, 21], [104.5, 22.3], [103.5, 23], [102, 24.5]], [[113.4, 22.6], [112.5, 23.2], [111, 23.5], [109.5, 23.6], [108, 23.4], [106.5, 23.9]], [[109.3, -0.1], [110.5, 0], [112, 0.5], [113.2, 1]],
  [[111.5, 30.4], [113.5, 29.8], [115.5, 29.7], [117.2, 30.6]]];
// 지도 그림에 쓰는 무거운 정의(해안선 경로·종이 결)는 문서에 한 번만 넣고 <use>로 다시 씀
let GEO_READY = false, GEO_SRC = '';
function grainURL() {
  try {
    const N = 160, c = document.createElement('canvas'); c.width = c.height = N; const x = c.getContext && c.getContext('2d'); if (!x) return '';
    let r = 7; const rnd = () => ((r = (r * 1103515245 + 12345) >>> 0) / 4294967296);
    const Gn = 8, cg = []; for (let i = 0; i < Gn * Gn; i++) cg.push(rnd());
    const at = (i, j) => cg[((j % Gn + Gn) % Gn) * Gn + ((i % Gn + Gn) % Gn)];
    const cv = (u, v) => { const i = Math.floor(u), j = Math.floor(v), fu = u - i, fv = v - j, a = at(i, j) * (1 - fu) + at(i + 1, j) * fu, b = at(i, j + 1) * (1 - fu) + at(i + 1, j + 1) * fu; return a * (1 - fv) + b * fv; };
    const im = x.createImageData(N, N);
    for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) { const n = rnd(), c0 = cv(i / N * Gn, j / N * Gn); const a = Math.round((n * n * 0.6 + c0 * 0.4) * 6) / 6, k = (j * N + i) * 4; im.data[k] = 96; im.data[k + 1] = 64; im.data[k + 2] = 30; im.data[k + 3] = Math.round(a * 52); }
    x.putImageData(im, 0, 0); x.lineWidth = 0.6;
    for (let f = 0; f < 46; f++) { const sx = rnd() * N, sy = rnd() * N, a = rnd() * 6.28, l = 5 + rnd() * 14; x.strokeStyle = `rgba(80,52,24,${0.06 + rnd() * 0.08})`; x.beginPath(); x.moveTo(sx, sy); x.lineTo(sx + Math.cos(a) * l, sy + Math.sin(a) * l); x.stroke(); }
    return c.toDataURL('image/png');
  } catch (e) { return ''; }
}
function geoDefs() {
  if (GEO_READY || typeof document === 'undefined' || !document.createElementNS || !document.body || typeof GEOD === 'undefined') return;
  GEO_READY = true;
  try {
    const NS = 'http://www.w3.org/2000/svg', sv = document.createElementNS(NS, 'svg');
    sv.setAttribute('width', '0'); sv.setAttribute('height', '0'); sv.setAttribute('aria-hidden', 'true'); sv.setAttribute('id', 'geodefs');
    if (sv.style) sv.style.cssText = 'position:absolute;width:0;height:0;overflow:hidden;pointer-events:none';
    let d = `<path id="g-land" d="${GEOD.land}"/><path id="g-big" d="${GEOD.big || GEOD.land}"/><path id="g-border" d="${GEOD.border}"/><clipPath id="c-land"><use href="#g-land"/></clipPath>`;
    for (const k in GEOD.bloc) d += `<path id="g-b-${k}" d="${GEOD.bloc[k]}"/><clipPath id="c-b-${k}"><use href="#g-b-${k}"/></clipPath>`;
    const g = grainURL(); if (g) d += `<pattern id="grain" width="200" height="200" patternUnits="userSpaceOnUse"><image href="${g}" width="200" height="200"/></pattern>`;
    GEO_SRC = d; sv.innerHTML = '<defs>' + d + '</defs>'; document.body.appendChild(sv);
  } catch (e) { /* 그림만 빠지고 게임은 그대로 */ }
}
const useG = (id, a) => `<use href="#${id}" ${a}/>`;
// 먹선으로 그린 배(장식)
function inkShip(x, y, s, kind, S, flip) {
  const k = S.ink, pp = S.paper; let g = `<path d="M-30 8q9-3 17 0M-36 12q11-3 22 0" fill="none" stroke="${k}" stroke-width=".7" opacity=".55"/>`;
  const sail = (mx, h, n, w0) => { let t = `<path d="M${mx} -2V${-h}" stroke="${k}" stroke-width="1"/>`; const hh = (h - 6) / n;
    for (let r = 0; r < n; r++) { const yb = -4 - r * hh, w = w0 - r * 2.2, top = yb - hh + 1.2; t += `<path d="M${mx - w / 2} ${top}Q${mx} ${top + 1.6} ${mx + w / 2} ${top}L${mx + w / 2 - .6} ${yb}Q${mx} ${yb + 2.2} ${mx - w / 2 + .6} ${yb}Z" fill="${pp}" stroke="${k}" stroke-width=".6"/>`; }
    return t; };
  if (kind === 'steamer') {
    g += `<path d="M-19 -2H18Q16 5 8 6.5H-14Q-18 4 -19 -2Z" fill="${k}"/><rect x="-10" y="-6" width="20" height="4" fill="${pp}" stroke="${k}" stroke-width=".6"/>
      <rect x="-2" y="-17" width="5" height="11" fill="${k}"/><rect x="-2" y="-14" width="5" height="1.6" fill="#b8322a"/><path d="M0 -18c-4-4-10-3-14-7c-4-3-10-2-14-5" fill="none" stroke="${k}" stroke-width="2.2" opacity=".35" stroke-linecap="round"/>
      <path d="M-12 -2V-18M10 -2V-16" stroke="${k}" stroke-width=".9"/><path d="M-12 -17L-5 -6H-12Z M10 -15L16 -5H10Z" fill="${pp}" stroke="${k}" stroke-width=".6"/>`;
  } else {
    const masts = kind === 'galleon' ? [[-8, 20, 2, 10], [1, 25, 3, 12], [9, 17, 2, 9]] : kind === 'clipper' ? [[-9, 28, 4, 11], [0, 32, 5, 12], [9, 26, 4, 10]] : kind === 'brig' ? [[-4, 24, 3, 11], [6, 22, 3, 10]] : [[-8, 22, 3, 11], [1, 27, 3, 12], [9, 20, 2, 10]];
    g += `<path d="M15 -2L26 -9M15 -2L25 -8" stroke="${k}" stroke-width=".8"/><path d="M${masts[masts.length - 1][0]} ${-masts[masts.length - 1][1] + 4}L24 -8L${masts[masts.length - 1][0] + 1} -4Z" fill="${pp}" stroke="${k}" stroke-width=".6"/>`;
    for (const [mx, h, n, w0] of masts) g += sail(mx, h, n, w0);
    const [mx, h] = masts[kind === 'brig' ? 0 : 1]; g += `<path d="M${mx} ${-h}l7 1.5l-7 1.5" fill="${kind === 'galleon' ? '#a33a2a' : k}"/>`;
    g += `<path d="M-17 -2H16Q14 5 6 6.6H-10Q-16 5 -17 -2Z" fill="${k}"/>`;
    if (kind === 'galleon') g += `<path d="M-17 -2V-9H-9V-2Z" fill="${pp}" stroke="${k}" stroke-width=".7"/><path d="M-15 -6h4" stroke="${k}" stroke-width=".6"/>`;
    if (kind !== 'clipper') g += `<path d="M-12 1.6H12" stroke="${pp}" stroke-width="1.2" stroke-dasharray="1.4 2.6"/>`;
  }
  return `<g transform="translate(${x},${y}) scale(${flip ? -s : s},${s})" opacity=".9">${g}</g>`;
}
const molehill = (x, y, h, S, flat) => { const w = h * 0.95, k = flat ? '#8b7a5e' : S.ink; let t = `<path d="M${x - w} ${y}Q${x - w * .35} ${y - h * .95} ${x} ${y - h}Q${x + w * .4} ${y - h * .95} ${x + w} ${y}" fill="${flat ? 'none' : S.land}" stroke="${k}" stroke-width=".85" stroke-linejoin="round"/>`;
  for (const f of [.22, .42, .62, .8]) t += `<path d="M${x + w * f} ${y - h * (1 - f * f) * .9}L${x + w * f - 1.6} ${y - 1}" stroke="${k}" stroke-width=".6" opacity=".75"/>`;
  return t; };
const tree = (x, y, S) => `<path d="M${x} ${y}V${y - 4}" stroke="${S.ink}" stroke-width=".8"/><circle cx="${x}" cy="${y - 6.5}" r="3.3" fill="${S.land}" stroke="${S.ink}" stroke-width=".7"/><path d="M${x - 1} ${y - 7.5}a1.6 1.6 0 0 1 2 0" fill="none" stroke="${S.ink}" stroke-width=".5"/>`;
const FLEUR = 'M0 -15C3.2 -11 3.2 -6.5 0 -2.5C-3.2 -6.5 -3.2 -11 0 -15Z M1 -4C4.6 -9.6 10 -8.6 8.6 -3.6C7.6 -.6 3.6 -1 2.2 -2.2Z M-1 -4C-4.6 -9.6 -10 -8.6 -8.6 -3.6C-7.6 -.6 -3.6 -1 -2.2 -2.2Z M-5.4 -.4H5.4V1.6H-5.4Z';
function compassRose(cx, cy, R, P, S) {
  const k = S.ink; let g = '';
  const pt = (a, len, wid, d1, d2) => `<g transform="rotate(${a})"><path d="M0 0L0 ${-len}L${-wid} ${-wid}Z" fill="${d1}" stroke="${k}" stroke-width=".5"/><path d="M0 0L0 ${-len}L${wid} ${-wid}Z" fill="${d2}" stroke="${k}" stroke-width=".5"/></g>`;
  if (P <= 3) {
    const red = P === 1 ? '#9a3324' : k, grn = P === 1 ? '#4f6f46' : P === 2 ? '#5a4a36' : k, gold = '#b8892e';
    g += `<circle r="${R}" fill="${S.paper}" fill-opacity=".7" stroke="${k}" stroke-width="1.3"/><circle r="${R - 5}" fill="none" stroke="${k}" stroke-width=".6"/>`;
    for (let i = 0; i < 64; i++) g += `<path d="M0 ${-R + 5}V${-R + (i % 8 ? 2.6 : 0.6)}" transform="rotate(${i * 5.625})" stroke="${k}" stroke-width="${i % 8 ? .5 : 1}"/>`;
    if (P <= 2) for (let i = 0; i < 16; i++) g += pt(11.25 + i * 22.5, R * .42, R * .07, S.paper, gold);
    for (let i = 0; i < 8; i++) g += pt(22.5 + i * 45, R * .62, R * .1, grn, S.paper);
    for (let i = 0; i < 4; i++) g += pt(45 + i * 90, R * .76, R * .13, k, S.paper);
    for (let i = 0; i < 4; i++) g += pt(i * 90, R * .98, R * .15, i === 0 ? red : k, S.paper);
    g += `<circle r="${R * .1}" fill="${gold}" stroke="${k}" stroke-width=".6"/><path d="${FLEUR}" transform="translate(0 ${-R - 1}) scale(${R / 40})" fill="${red}" stroke="${k}" stroke-width=".5"/>`;
    if (P <= 2) g += `<path d="M${R + 3} 0h12M${R + 9} -6v12" stroke="${k}" stroke-width="1.6"/>`;
  } else if (P === 4) {
    g += `<circle r="${R}" fill="${S.paper}" fill-opacity=".6" stroke="${k}" stroke-width="1"/><circle r="${R - 9}" fill="none" stroke="${k}" stroke-width=".7"/><circle r="${R - 16}" fill="none" stroke="${k}" stroke-width=".5"/>`;
    for (let i = 0; i < 72; i++) g += `<path d="M0 ${-R}V${-R + (i % 2 ? 4 : 8)}" transform="rotate(${i * 5})" stroke="${k}" stroke-width=".6"/>`;
    for (const [a, t] of [[0, '0'], [90, '90'], [180, '180'], [270, '270']]) g += `<text transform="rotate(${a}) translate(0 ${-R + 15})" text-anchor="middle" font-size="6.5" fill="${k}">${t}</text>`;
    g += `<g transform="rotate(-2)">`; for (let i = 0; i < 32; i++) g += `<path d="M0 ${-R + 16}V${-R + 19}" transform="rotate(${i * 11.25})" stroke="${k}" stroke-width=".5"/>`; g += `</g>`;
    for (let i = 0; i < 4; i++) g += pt(45 + i * 90, R * .38, R * .08, k, S.paper);
    for (let i = 0; i < 4; i++) g += pt(i * 90, R * .56, R * .1, k, S.paper);
    g += `<path d="M0 ${-R - 2}l4 7h-8z" fill="${k}"/>`;
  } else {
    g += `<path d="M0 ${-R}L${R * .22} ${R * .5}L0 ${R * .3}L${-R * .22} ${R * .5}Z" fill="${S.paper}" stroke="${k}" stroke-width="1"/><path d="M0 ${-R}L0 ${R * .3}L${-R * .22} ${R * .5}Z" fill="${k}"/>`;
    g += `<text y="${-R - 6}" text-anchor="middle" font-size="13" font-weight="700" fill="${k}" class="disp">N</text>`;
  }
  return `<g transform="translate(${cx},${cy})">${g}</g>`;
}
function cartouche(x, y, P, S, E) {
  const k = S.ink, pp = S.paper, w = 304, h = 84; let g = '';
  if (P === 1) { // 두루마리
    g += `<path d="M18 4H${w - 18}V${h - 4}H18Z" fill="${pp}" stroke="${k}" stroke-width="1.4"/>`;
    for (const [sx, d] of [[18, -1], [w - 18, 1]]) g += `<path d="M${sx} 4c${d * 14} 0 ${d * 16} 4 ${d * 16} 10v${h - 24}c0 6 ${-d * 2} 10 ${-d * 16} 10" fill="${pp}" stroke="${k}" stroke-width="1.4"/><path d="M${sx + d * 16} 14c0 -6 ${-d * 9} -6 ${-d * 9} 0s${d * 5} 4 ${d * 5} 0" fill="none" stroke="${k}" stroke-width="1"/><path d="M${sx + d * 16} ${h - 14}c0 6 ${-d * 9} 6 ${-d * 9} 0s${d * 5} -4 ${d * 5} 0" fill="none" stroke="${k}" stroke-width="1"/><path d="M${sx + d * 4} 8v${h - 16}" stroke="${k}" stroke-width=".5" opacity=".5"/>`;
    g += `<g transform="translate(${w / 2} 4)">${[-60, -30, 0, 30, 60].map(a => `<path d="M0 0L0 -12" transform="rotate(${a})" stroke="${k}" stroke-width=".8"/>`).join('')}<path d="M-13 0a13 13 0 0 1 26 0z" fill="${pp}" stroke="${k}" stroke-width="1"/>${[-50, -25, 0, 25, 50].map(a => `<path d="M0 0L0 -12" transform="rotate(${a})" stroke="${k}" stroke-width=".6"/>`).join('')}<path d="M-30 0q-12-10-22 -2q8-1 10 4M30 0q12-10 22 -2q-8-1-10 4" fill="none" stroke="${k}" stroke-width="1"/></g>`;
  } else if (P === 2) { // 로코코 곡선 틀
    g += `<rect x="8" y="4" width="${w - 16}" height="${h - 8}" rx="16" fill="${pp}" stroke="${k}" stroke-width="1.4"/><rect x="14" y="10" width="${w - 28}" height="${h - 20}" rx="11" fill="none" stroke="${k}" stroke-width=".6"/>`;
    for (const [cx, cy, sx, sy] of [[8, 4, 1, 1], [w - 8, 4, -1, 1], [8, h - 4, 1, -1], [w - 8, h - 4, -1, -1]]) g += `<path d="M${cx} ${cy + sy * 18}c${-sx * 8} 0 ${-sx * 10} ${-sy * 12} ${-sx * 2} ${-sy * 16}c${sx * 6} ${-sy * 3} ${sx * 10} ${sy * 2} ${sx * 6} ${sy * 6}c${-sx * 3} ${sy * 3} ${-sx * 6} 0 ${-sx * 4} ${-sy * 3}" fill="none" stroke="${k}" stroke-width="1.2"/>`;
    g += `<g transform="translate(${w / 2} 4)"><path d="M-16 0c0 -14 32 -14 32 0z" fill="${pp}" stroke="${k}" stroke-width="1"/>${[-55, -28, 0, 28, 55].map(a => `<path d="M0 0L0 -11" transform="rotate(${a})" stroke="${k}" stroke-width=".7"/>`).join('')}</g>`;
  } else if (P === 3) { // 월계수 테
    g += `<rect x="20" y="4" width="${w - 40}" height="${h - 8}" rx="4" fill="${pp}" stroke="${k}" stroke-width="1.3"/><rect x="25" y="9" width="${w - 50}" height="${h - 18}" fill="none" stroke="${k}" stroke-width=".5"/>`;
    for (const d of [-1, 1]) { const bx = d < 0 ? 16 : w - 16; let lv = `<path d="M${bx} ${h - 8}Q${bx - d * 12} ${h / 2} ${bx} 8" fill="none" stroke="${k}" stroke-width=".9"/>`;
      for (let i = 0; i < 6; i++) { const t = i / 5, yy = h - 12 - t * (h - 22), xx = bx - d * 12 * 4 * t * (1 - t) * .75; lv += `<ellipse cx="${xx - d * 4}" cy="${yy}" rx="4.4" ry="1.8" transform="rotate(${d * -35} ${xx - d * 4} ${yy})" fill="#7a8f5a" stroke="${k}" stroke-width=".4"/><ellipse cx="${xx + d * 3}" cy="${yy - 3}" rx="4" ry="1.6" transform="rotate(${d * 35} ${xx + d * 3} ${yy - 3})" fill="#7a8f5a" stroke="${k}" stroke-width=".4"/>`; }
      g += lv; }
  } else if (P === 4) { // 수로 해도 표제
    g += `<rect x="10" y="4" width="${w - 20}" height="${h - 8}" fill="${pp}" stroke="${k}" stroke-width="1.6"/><rect x="14" y="8" width="${w - 28}" height="${h - 16}" fill="none" stroke="${k}" stroke-width=".5"/>`;
  } else { // 인쇄 지도첩
    g += `<rect x="10" y="4" width="${w - 20}" height="${h - 8}" fill="${pp}" stroke="${k}" stroke-width="2.2"/><rect x="15" y="9" width="${w - 30}" height="${h - 18}" fill="none" stroke="${k}" stroke-width=".6"/>`;
    for (const [cx, cy] of [[10, 4], [w - 10, 4], [10, h - 4], [w - 10, h - 4]]) g += `<rect x="${cx - 4}" y="${cy - 4}" width="8" height="8" fill="${k}"/>`;
  }
  const t = sTxt(w / 2, 29, E.name, { a: 'middle', s: 17, w: 700, f: k, cls: 'disp' }) + sTxt(w / 2, 44, E.years, { a: 'middle', s: 11, f: k, cls: 'disp yrs-sp' }) + sTxt(w / 2, 62, E.sub[0], { a: 'middle', s: 10, f: k }) + sTxt(w / 2, 74, E.sub[1], { a: 'middle', s: 10, f: k });
  return [`<g transform="translate(${x},${y})">${g}</g>`, `<g transform="translate(${x},${y})">${t}</g>`];
}
function neatline(P, S) {
  const M = L.map, k = S.ink, o1 = 4, o2 = 10, o3 = 26; let g = '', tx = '';
  g += `<rect x="${M.x - o3 + 3}" y="${M.y - o3 + 3}" width="${M.w + 2 * o3 - 6}" height="${M.h + 2 * o3 - 6}" fill="none" stroke="${k}" stroke-width="${P >= 4 ? 1.2 : 2}"/>`;
  g += `<rect x="${M.x - o2}" y="${M.y - o2}" width="${M.w + 2 * o2}" height="${M.h + 2 * o2}" fill="none" stroke="${k}" stroke-width=".8"/><rect x="${M.x - o1}" y="${M.y - o1}" width="${M.w + 2 * o1}" height="${M.h + 2 * o1}" fill="none" stroke="${k}" stroke-width=".8"/>`;
  for (let lon = 50; lon < 134; lon++) { const x0 = GP(lon, 0)[0], x1 = GP(lon + 1, 0)[0];
    if (P < 5 ? lon % 2 === 0 : false) g += `<rect x="${x0}" y="${M.y - o2}" width="${x1 - x0}" height="${o2 - o1}" fill="${k}"/><rect x="${x0}" y="${M.y + M.h + o1}" width="${x1 - x0}" height="${o2 - o1}" fill="${k}"/>`;
    else if (P === 5) g += `<path d="M${x0} ${M.y - o2}v${lon % 5 ? 3 : 6}M${x0} ${M.y + M.h + o2}v${lon % 5 ? -3 : -6}" stroke="${k}" stroke-width=".6"/>`;
    if (lon % 10 === 0 && lon > 50) for (const yy of [M.y - o2 - 5, M.y + M.h + o2 + 12]) tx += `<text x="${x0}" y="${yy}" text-anchor="middle" font-size="10" fill="${k}" class="disp">${lon}°</text>`; }
  for (let lat = 30; lat > -10; lat--) { const y0 = GP(50, lat)[1], y1 = GP(50, lat - 1)[1];
    if (P < 5 ? lat % 2 === 0 : false) g += `<rect x="${M.x - o2}" y="${y0}" width="${o2 - o1}" height="${y1 - y0}" fill="${k}"/><rect x="${M.x + M.w + o1}" y="${y0}" width="${o2 - o1}" height="${y1 - y0}" fill="${k}"/>`;
    else if (P === 5) g += `<path d="M${M.x - o2} ${y0}h${lat % 5 ? 3 : 6}M${M.x + M.w + o2} ${y0}h${lat % 5 ? -3 : -6}" stroke="${k}" stroke-width=".6"/>`;
    if (lat % 10 === 0 && lat < 30 && lat > -10) { const t = lat === 0 ? '0°' : Math.abs(lat) + '°' + (lat > 0 ? 'N' : 'S');
      tx += `<text transform="translate(${M.x - o2 - 6} ${y0}) rotate(-90)" text-anchor="middle" font-size="10" fill="${k}" class="disp">${t}</text><text transform="translate(${M.x + M.w + o2 + 6} ${y0}) rotate(90)" text-anchor="middle" font-size="10" fill="${k}" class="disp">${t}</text>`; } }
  return [g, tx];
}
let MAP_BG = {};
const MAP_IMG = {}, MAP_PEND = {}, MAP_SC = 3.3;
const mapSheet = () => { const M = L.map, o = 26; return { x: M.x - o, y: M.y - o, w: M.w + 2 * o, h: M.h + 2 * o }; };
function mapLocalDefs(P) {
  const { W, H } = { W: L.map.w, H: L.map.h };
  return `<clipPath id="mapclip"><rect width="${W}" height="${H}"/></clipPath>
    <radialGradient id="stainR"><stop offset=".72" stop-color="#7a4a1a" stop-opacity="0"/><stop offset=".9" stop-color="#7a4a1a" stop-opacity=".2"/><stop offset=".97" stop-color="#7a4a1a" stop-opacity=".05"/><stop offset="1" stop-color="#7a4a1a" stop-opacity="0"/></radialGradient>
    <radialGradient id="foxR"><stop offset="0" stop-color="#8a5420" stop-opacity=".32"/><stop offset="1" stop-color="#8a5420" stop-opacity="0"/></radialGradient>`;
}
// 지도 그림을 한 번 비트맵으로 구워 두면 끌고 확대할 때 훨씬 가볍다(글자는 웹 글꼴 때문에 그대로 둠)
function rasterize(P, art) {
  if (MAP_PEND[P] || MAP_IMG[P] || typeof Image === 'undefined' || typeof document === 'undefined' || !document.getElementById('geodefs')) return;
  MAP_PEND[P] = true;
  try {
    const R = mapSheet(), S = MAPSTYLE[P], src = GEO_SRC;
    const extra = `<radialGradient id="mapvig" cx=".5" cy=".5" r=".75"><stop offset=".55" stop-color="#6a4218" stop-opacity="0"/><stop offset="1" stop-color="#6a4218" stop-opacity="${S.vig}"/></radialGradient><marker id="arri" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0L10 5L0 10z" fill="${S.ink}"/></marker>`;
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${Math.round(R.w * MAP_SC)}" height="${Math.round(R.h * MAP_SC)}" viewBox="${R.x} ${R.y} ${R.w} ${R.h}"><defs>${src}${extra}</defs>${art}</svg>`;
    const img = new Image();
    img.onload = () => {
      try {
        const c = document.createElement('canvas'); c.width = Math.round(R.w * MAP_SC); c.height = Math.round(R.h * MAP_SC);
        const x = c.getContext('2d'); x.fillStyle = S.paper; x.fillRect(0, 0, c.width, c.height); x.drawImage(img, 0, 0, c.width, c.height);
        const url = c.toDataURL('image/jpeg', 0.9); if (!/^data:image\/jpeg/.test(url)) return;
        const NS = 'http://www.w3.org/2000/svg', im = document.createElementNS(NS, 'image');
        for (const [k, v] of [['id', 'mapimg-' + P], ['x', R.x], ['y', R.y], ['width', R.w], ['height', R.h], ['preserveAspectRatio', 'none']]) im.setAttribute(k, v);
        im.setAttribute('href', url); im.setAttributeNS('http://www.w3.org/1999/xlink', 'xlink:href', url);
        document.querySelector('#geodefs defs').appendChild(im); MAP_IMG[P] = true;
        const g = document.getElementById('mapart'); if (g && g.getAttribute('data-p') === String(P)) g.innerHTML = `<use href="#mapimg-${P}"/>`;
      } catch (e) { /* 그림으로 굽지 못하면 벡터 그대로 */ }
    };
    img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
  } catch (e) { /* 그대로 */ }
}
function mapBackground() {
  const P = (G && G.period) || 1, E = ERA[P], S = MAPSTYLE[P];
  geoDefs();
  if (!MAP_BG[P]) MAP_BG[P] = buildMap(P, E, S);
  const { art, txt } = MAP_BG[P], R = mapSheet();
  if (!MAP_IMG[P]) rasterize(P, art);
  return `<defs>${mapLocalDefs(P)}</defs><rect x="${R.x}" y="${R.y}" width="${R.w}" height="${R.h}" fill="${S.paper}" filter="url(#sh)"/><g id="mapart" data-p="${P}">${MAP_IMG[P] ? `<use href="#mapimg-${P}"/>` : art}</g>${txt}`;
}
function buildMap(P, E, S) {
  const M = L.map, W = M.w, H = M.h, k = S.ink, o3 = 26;
  const pl = pts => 'M' + pts.map(p => GL(...p).map(v => v.toFixed(1)).join(' ')).join('L');
  let s = '', t = '';
  s += `<rect x="${M.x - o3}" y="${M.y - o3}" width="${W + 2 * o3}" height="${H + 2 * o3}" fill="${S.paper}"/>`;
  s += `<g transform="translate(${M.x},${M.y})"><g clip-path="url(#mapclip)"><rect width="${W}" height="${H}" fill="${S.sea}"/>`;
  // 경위선
  if (P >= 4) { const gc = P === 5 ? '#6f95ab' : k;
    for (let lat = 25; lat > -10; lat -= 5) { const y = GL(50, lat)[1]; s += `<path d="M0 ${y}H${W}" stroke="${gc}" stroke-width="${lat ? .5 : 1}" opacity="${P === 5 ? .45 : .35}"/>`; }
    for (let lon = 55; lon < 134; lon += 5) { const x = GL(lon, 0)[0]; s += `<path d="M${x} 0V${H}" stroke="${gc}" stroke-width=".5" opacity="${P === 5 ? .45 : .35}"/>`; } }
  // 해안을 따라 겹겹이 그은 물결선(옛 해도의 수선)
  if (S.wl[0]) { const [n, sp, a0, wc] = S.wl, c = wc || k;
    for (let i = n; i >= 1; i--) { const wd = 2 * i * sp; s += useG('g-big', `fill="none" stroke="${c}" stroke-width="${wd + 1}" stroke-linejoin="round" opacity="${(a0 * (1 - (i - 1) / (n + 1))).toFixed(2)}"`) + useG('g-big', `fill="none" stroke="${S.sea}" stroke-width="${wd - .8}" stroke-linejoin="round"`); } }
  if (P === 4) for (const [d, dash] of [[18, '2.5 3'], [8, '1 2.6']]) s += useG('g-big', `fill="none" stroke="${k}" stroke-width="${2 * d + 1}" stroke-dasharray="${dash}" stroke-linejoin="round" opacity=".55"`) + useG('g-big', `fill="none" stroke="${S.sea}" stroke-width="${2 * d - .8}" stroke-linejoin="round"`);
  // 얕은 바다 물감
  if (S.tint) for (const [wd, op] of [[34, .16], [20, .2], [9, .26]]) s += useG(wd > 20 ? 'g-big' : 'g-land', `fill="none" stroke="${S.tint}" stroke-width="${wd}" stroke-linejoin="round" opacity="${op}"`);
  // 항정선(나침반에서 뻗는 방위선)
  if (S.rhumb) { const hubs = [GL(128.8, 25.3), GL(77.5, -6.2)].slice(0, S.rhumb === 2 ? 2 : 2), cols = P === 1 ? [k, '#4f6f46', '#9a3324'] : [k, k, k];
    for (const [hx, hy] of hubs) for (let i = 0; i < (P === 1 ? 32 : 16); i++) { const a = i * Math.PI / (P === 1 ? 16 : 8), c = cols[P === 1 ? (i % 4 === 0 ? 0 : i % 2 === 0 ? 1 : 2) : 0];
      s += `<path d="M${hx} ${hy}L${(hx + Math.cos(a) * 1500).toFixed(1)} ${(hy + Math.sin(a) * 1500).toFixed(1)}" stroke="${c}" stroke-width="${P === 1 && i % 4 === 0 ? .8 : .55}" opacity="${P === 1 ? .32 : .2}"/>`; } }
  // 적도와 북회귀선
  { const y = GL(50, 0)[1]; if (P <= 3) { s += `<path d="M0 ${y - 2.5}H${W}M0 ${y + 2.5}H${W}" stroke="${k}" stroke-width=".7" opacity=".7"/>`; for (let lon = 50; lon < 134; lon += 2) { const x0 = GL(lon, 0)[0]; s += `<rect x="${x0}" y="${y - 2.5}" width="14.05" height="5" fill="${k}" opacity=".55"/>`; } }
    else s += `<path d="M0 ${y}H${W}" stroke="${P === 5 ? '#b8322a' : k}" stroke-width="1.1" opacity=".6"/>`;
    const yt = GL(50, 23.44)[1]; s += `<path d="M0 ${yt}H${W}" stroke="${k}" stroke-width=".8" stroke-dasharray="7 4 1.5 4" opacity=".5"/>`;
    const [ex, ey] = GL(132.1, 0.65); t += sTxt(ex, ey, '적 도', { a: 'middle', s: 10, f: k, cls: 'disp' }); const [tx, ty] = GL(64.4, 23.8); t += sTxt(tx, ty, '북회귀선', { a: 'middle', s: 10, f: k, cls: 'disp' }); }
  // 땅
  s += useG('g-land', `fill="${S.land}"`);
  if (S.flat) for (const b in ATLAS) s += useG('g-b-' + b, `fill="${ATLAS[b]}"`);
  if (S.wash) for (const b in WASH) s += useG('g-b-' + b, `fill="none" stroke="${WASH[b]}" stroke-width="${S.wash}" stroke-linejoin="round" opacity="${S.washOp}" clip-path="url(#c-b-${b})"`);
  s += useG('g-land', `fill="none" stroke="${k}" stroke-width="7" opacity=".07" clip-path="url(#c-land)"`);
  s += useG('g-border', `fill="none" stroke="${P === 5 ? '#a8443a' : k}" stroke-width="${P === 5 ? 1.1 : .9}" stroke-dasharray="${P === 5 ? '5 2 1.2 2' : '1.4 2.6'}" opacity=".75"`);
  s += useG('g-land', `fill="none" stroke="${k}" stroke-width="${P >= 4 ? 1 : 1.25}" stroke-linejoin="round"`);
  // 강·호수
  const rc = P === 5 ? '#4f86a8' : P === 4 ? k : '#5a7c78';
  for (const r of RIVERS) s += `<path d="${pl(r)}" fill="none" stroke="${rc}" stroke-width="1.15" stroke-linecap="round" stroke-linejoin="round" opacity=".8"/>`;
  { const [x, y] = GL(104.2, 12.8); s += `<ellipse cx="${x}" cy="${y}" rx="7" ry="4" transform="rotate(-35 ${x} ${y})" fill="${P === 5 ? S.sea : S.sea}" stroke="${rc}" stroke-width=".8"/>`; }
  // 산과 숲
  for (const [lo, la, h] of [...MOUNTS].sort((a, b) => b[1] - a[1])) { const [x, y] = GL(lo, la); s += molehill(x, y, h, S, S.flat); }
  if (P <= 3) { let rr = 3; const rn = () => ((rr = (rr * 69069 + 1) >>> 0) / 4294967296);
    for (const [lo, la, n] of TREES) for (let i = 0; i < n; i++) { const [x, y] = GL(lo + (rn() - .5) * 2.4, la + (rn() - .5) * 1.6); s += tree(x, y, S); } }
  // 수심(해군 수로 해도)
  if (P === 4 && GEOD.sound) for (const [x, y, d] of GEOD.sound) s += `<text x="${x}" y="${y}" font-size="7.5" text-anchor="middle" fill="${k}" opacity=".62" font-style="italic">${d}</text>`;
  // 시대의 바닷길
  if (P < 5) { const [ax, ay] = GL(50.4, -1.2); s += `<path d="M${ax} ${ay}q46 -6 82 -64" fill="none" stroke="${k}" stroke-width="1.6" stroke-dasharray="6 4" opacity=".8" marker-end="url(#arri)"/>`; t += sTxt(ax + 22, ay + 14, '희망봉을 돌아 유럽에서', { s: 11, f: k, cls: 'disp' }); }
  else { const [ax, ay] = GL(50, 12.6); s += `<path d="M${ax} ${ay}q60 6 112 -40" fill="none" stroke="${k}" stroke-width="1.6" stroke-dasharray="6 4" opacity=".8" marker-end="url(#arri)"/>`; t += sTxt(ax + 4, ay + 16, '수에즈에서', { s: 11, f: k, cls: 'disp' }); }
  if (P === 4) { s += `<path d="${pl([[114.2, 21.5], [113, 16], [110.6, 9], [107.5, 3], [105.7, -5.6], [102, -9.2], [90, -10.4]])}" fill="none" stroke="#9a3b22" stroke-width="1.8" stroke-dasharray="1.5 5" stroke-linecap="round"/>`;
    const [x, y] = GL(105.6, 5.4); t += `<g transform="translate(${x} ${y}) skewX(-10)">${sTxt(0, 0, '차 경주 항로', { a: 'middle', s: 11, f: '#8a3320', cls: 'disp' })}</g>`; }
  if (P === 5) { const cb = '#b8322a';
    for (const r of [[[50, 12.6], [60, 16], [72.8, 19]], [[80.3, 13.1], [92, 9], [100.3, 5.4], [103.8, 1.3]], [[103.8, 1.3], [105.5, -3], [106.8, -6.1]], [[103.8, 1.3], [108.5, 8], [112, 16], [114.2, 22.1]], [[72.8, 19], [76, 12], [79.6, 8.2], [80.3, 13.1]]]) s += `<path d="${pl(r)}" fill="none" stroke="${cb}" stroke-width="1.5" opacity=".85"/>`;
    const [x, y] = GL(87.5, 7.6); t += `<g transform="translate(${x} ${y}) skewX(-10)">${sTxt(0, 0, '해저 전신선', { a: 'middle', s: 11, w: 700, f: cb, cls: 'disp' })}</g>`; }
  if (P >= 3) { const [x, y] = GL(103.8, 1.3); s += `<circle cx="${x}" cy="${y}" r="3.6" fill="${S.paper}" stroke="${k}" stroke-width="1.4"/><circle cx="${x}" cy="${y}" r="1.3" fill="${k}"/>`; t += sTxt(x + 7, y + 13, '싱가포르', { s: 10.5, w: 700, f: k, cls: 'city-lbl disp' }); }
  // 장식 배와 바다 괴물
  const SHIPS = { 1: [[86.6, 10.4, 0], [126, -5.6, 1]], 2: [[86.6, 10.4, 0], [127, 13, 1]], 3: [[86.6, 10.4, 0], [126, -5.6, 1]], 4: [[97.8, -9.1, 1], [86.6, 10.4, 0]], 5: [[126, -5.6, 1], [127, 13, 1]] };
  for (const [lo, la, f] of SHIPS[P]) { const [x, y] = GL(lo, la); s += inkShip(x, y, P === 4 ? .9 : 1, S.ship, S, f); }
  if (P === 1) { const [mx, my] = GL(100.2, -6.6);
    s += `<g transform="translate(${mx},${my})" stroke="${k}" stroke-width="1" fill="${S.paper}" opacity=".9"><path d="M-62 8h132M-56 12h120" fill="none" stroke-dasharray="4 3" opacity=".6"/>
      <path d="M-58 8c0 -6 -6 -10 -10 -6c4 0 6 3 4 6z"/><path d="M-48 8c2 -15 18 -15 20 0z"/><path d="M-20 8c2 -18 22 -18 24 0z"/><path d="M12 8c0 -22 10 -32 22 -30c8 2 12 8 20 6l-3 6l-9 -1l6 5c-6 3 -12 0 -16 -4c-4 6 -2 12 -2 18z"/>
      <circle cx="40" cy="-19" r="1.6" fill="${k}"/><path d="M33 -26c-2 -8 -8 -12 -12 -14M36 -27c0 -8 -4 -14 -6 -18" fill="none"/><path d="M-44 4l3 -6M-38 2l3 -6M-14 4l3 -7M-8 2l3 -7M20 2l4 -8M26 -2l4 -8" fill="none" opacity=".7"/></g>`;
    t += sTxt(mx, my + 26, '이곳에 괴물이 산다', { a: 'middle', s: 10.5, f: k, cls: 'disp' }); }
  // 땅·바다 이름
  for (const [n, lo, la] of LANDNAME) { const [x, y] = GL(lo, la); t += sTxt(x, y, n, { a: 'middle', s: n.length > 2 ? 14 : 16, w: 700, f: k, cls: 'disp land-name' + (P === 5 ? ' atlas' : '') }); }
  for (const [n, lo, la, sz] of SEANAME) { const [x, y] = GL(lo, la); t += `<g transform="translate(${x} ${y}) skewX(-12)" opacity=".8">${sTxt(0, 0, n, { a: 'middle', s: sz, f: P === 5 ? '#2f5d78' : k, cls: 'disp sea-name' })}</g>`; }
  // 나침반, 축척, 표제
  { const [x, y] = GL(128.8, 25.6); s += compassRose(x, y, P <= 3 ? 40 : 36, P, S); }
  if (S.rhumb) { const [x, y] = GL(77.5, -6.2); s += compassRose(x, y, 16, 3, S); }
  if (P >= 4) { const [x, y] = GL(124.6, -8.6), d = 300 / 60 * 14; // 위도 1도 = 60해리
    s += `<g transform="translate(${x},${y})"><rect width="${d}" height="5" fill="${S.paper}" stroke="${k}" stroke-width=".8"/>${[0, 1, 2].map(i => `<rect x="${i * d / 3}" width="${d / 6}" height="5" fill="${k}"/>`).join('')}${sTxt(0, -5, '0', { a: 'middle', s: 8, f: k })}${sTxt(d, -5, '300해리', { a: 'middle', s: 8, f: k })}</g>`; }
  { const [x, y] = GL(50.5, -3.4), [a, b] = cartouche(x, y, P, S, E); s += a; t += b; }
  // 얼룩과 종이 결
  let sr = 5; const srn = () => ((sr = (sr * 69069 + 7) >>> 0) / 4294967296);
  for (let i = 0; i < S.stains; i++) { const [x, y] = [[1120, 470], [60, 40]][i]; s += `<ellipse cx="${x}" cy="${y}" rx="58" ry="52" fill="url(#stainR)"/>`; }
  for (let i = 0; i < S.foxes; i++) { const x = srn() * W, y = srn() * H, r = 4 + srn() * 9; s += `<circle cx="${x.toFixed(0)}" cy="${y.toFixed(0)}" r="${r.toFixed(1)}" fill="url(#foxR)"/>`; }
  s += `</g></g>`;
  s += `<rect x="${M.x - o3}" y="${M.y - o3}" width="${W + 2 * o3}" height="${H + 2 * o3}" fill="url(#grain)" opacity="${S.grain}" pointer-events="none"/><rect x="${M.x - o3}" y="${M.y - o3}" width="${W + 2 * o3}" height="${H + 2 * o3}" fill="url(#mapvig)" pointer-events="none"/>`;
  const [ng, nt] = neatline(P, S); s += ng;
  return { art: s, txt: `<g transform="translate(${M.x},${M.y})" pointer-events="none">${t}</g>${nt}` };
}
