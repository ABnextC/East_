// 실제 해안선(Natural Earth 1:50m, 공공 영역)을 잘라 src/geo.js로 만든다.
// 사용: (world-atlas@2, topojson-client@3 이 있는 곳에서) node tools/geo.mjs <node_modules 경로>
import fs from 'fs'; import path from 'path'; import { createRequire } from 'module';
const NM = process.argv[2] || '/tmp/geo/node_modules', req = createRequire(path.join(NM, 'x.js'));
const topo = req('topojson-client'), T = JSON.parse(fs.readFileSync(path.join(NM, 'world-atlas/countries-50m.json')));
const X = lon => (lon - 50) * 14.05, Y = lat => (30 - lat) * 14;
const BB = [X(46.5), Y(33.5), X(137.5), Y(-13.5)];
const BLOC = { persia: ['Iran', 'Afghanistan', 'Turkmenistan'], arabia: ['Saudi Arabia', 'Oman', 'Yemen', 'United Arab Emirates', 'Qatar', 'Bahrain', 'Kuwait', 'Iraq'],
  hind: ['India', 'Pakistan', 'Bangladesh', 'Nepal', 'Bhutan'], ceylon: ['Sri Lanka'], burma: ['Myanmar'], siam: ['Thailand', 'Laos', 'Cambodia'], annam: ['Vietnam'],
  china: ['China', 'Taiwan', 'Hong Kong', 'Macao'], malaya: ['Malaysia', 'Singapore', 'Brunei'], indies: ['Indonesia', 'Timor-Leste', 'Papua New Guinea'], phil: ['Philippines'] };
const blocOf = n => Object.keys(BLOC).find(k => BLOC[k].includes(n)) || 'other';
const geoms = T.objects.countries.geometries;
const proj = r => r.map(([lo, la]) => [X(lo), Y(la)]);
function clipRing(pts) { // Sutherland–Hodgman, 사각형
  const E = [[p => p[0] >= BB[0], (a, b) => it(a, b, 0, BB[0])], [p => p[0] <= BB[2], (a, b) => it(a, b, 0, BB[2])], [p => p[1] >= BB[1], (a, b) => it(a, b, 1, BB[1])], [p => p[1] <= BB[3], (a, b) => it(a, b, 1, BB[3])]];
  function it(a, b, k, v) { const t = (v - a[k]) / (b[k] - a[k]); return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]; }
  for (const [ins, cut] of E) { const out = []; for (let i = 0; i < pts.length; i++) { const a = pts[(i + pts.length - 1) % pts.length], b = pts[i];
      if (ins(b)) { if (!ins(a)) out.push(cut(a, b)); out.push(b); } else if (ins(a)) out.push(cut(a, b)); } pts = out; if (!pts.length) break; }
  return pts;
}
function dp(pts, tol) { if (pts.length < 3) return pts; const keep = new Uint8Array(pts.length); keep[0] = keep[pts.length - 1] = 1; const st = [[0, pts.length - 1]];
  while (st.length) { const [a, b] = st.pop(); let mx = 0, mi = -1; const [x1, y1] = pts[a], [x2, y2] = pts[b], dx = x2 - x1, dy = y2 - y1, L2 = dx * dx + dy * dy || 1e-9;
    for (let i = a + 1; i < b; i++) { const [x, y] = pts[i]; let t = ((x - x1) * dx + (y - y1) * dy) / L2; t = Math.max(0, Math.min(1, t)); const d = (x - x1 - t * dx) ** 2 + (y - y1 - t * dy) ** 2; if (d > mx) { mx = d; mi = i; } }
    if (mx > tol * tol) { keep[mi] = 1; st.push([a, mi], [mi, b]); } }
  return pts.filter((_, i) => keep[i]); }
const area = r => { let s = 0; for (let i = 0; i < r.length; i++) { const a = r[i], b = r[(i + 1) % r.length]; s += a[0] * b[1] - b[0] * a[1]; } return Math.abs(s / 2); };
const f1 = v => (Math.round(v * 10) / 10).toString();
function ringD(r) { let d = 'M' + f1(r[0][0]) + ' ' + f1(r[0][1]), px = r[0][0], py = r[0][1];
  for (let i = 1; i < r.length; i++) { const x = Math.round(r[i][0] * 10) / 10, y = Math.round(r[i][1] * 10) / 10, dx = Math.round((x - px) * 10) / 10, dy = Math.round((y - py) * 10) / 10; if (!dx && !dy) continue; d += 'l' + f1(dx) + ' ' + f1(dy); px = x; py = y; }
  return d + 'z'; }
function polysD(mp, minA) { let d = ''; for (const poly of mp.coordinates) for (const ring of poly) { let r = clipRing(proj(ring)); if (r.length < 3) continue; r = dp(r.concat([r[0]]), 0.55).slice(0, -1); if (r.length < 3 || area(r) < minA) continue; d += ringD(r); } return d; }
const inBox = g => true;
const out = { land: polysD(topo.merge(T, geoms), 2.5), big: polysD(topo.merge(T, geoms), 40), bloc: {}, border: '' };
for (const k of Object.keys(BLOC)) { const gs = geoms.filter(g => blocOf(g.properties.name) === k); if (gs.length) out.bloc[k] = polysD(topo.merge(T, gs), 2.5); }
const mesh = topo.mesh(T, T.objects.countries, (a, b) => a !== b && blocOf(a.properties.name) !== blocOf(b.properties.name));
for (const line of mesh.coordinates) { let seg = []; const flush = () => { if (seg.length > 1) { const s = dp(seg, 0.8); out.border += 'M' + s.map(p => f1(p[0]) + ' ' + f1(p[1])).join('L'); } seg = []; };
  for (const p of proj(line)) { if (p[0] >= BB[0] && p[0] <= BB[2] && p[1] >= BB[1] && p[1] <= BB[3]) seg.push(p); else flush(); } flush(); }
// 수심 숫자(1840~70년대 해도 양식): 바다 위 고정 위치, 해안에서 멀수록 깊게
const rings = []; for (const poly of topo.merge(T, geoms).coordinates) for (const ring of poly) { const r = clipRing(proj(ring)); if (r.length > 2) rings.push(dp(r, 0.55)); }
const inLand = (x, y) => { let c = false; for (const r of rings) for (let i = 0, j = r.length - 1; i < r.length; j = i++) { const [xi, yi] = r[i], [xj, yj] = r[j]; if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) c = !c; } return c; };
const dist = (x, y) => { let m = 1e9; for (const r of rings) for (const [a, b] of r) { const d = (a - x) ** 2 + (b - y) ** 2; if (d < m) m = d; } return Math.sqrt(m); };
const NOGO = [[56, 19, 73.5, 3.5], [79.5, 3.5, 95.5, -10], [109, 20, 120.5, 6.7], [50, -2.6, 72.5, -10.5], [123, 30, 134, 20], [50, 4.5, 56.5, -3], [60, 14.5, 68.5, 10.5], [85.5, 17, 92.5, 13], [111, 16, 118, 12], [71, 0.5, 80, -2.8], [107.5, -3.5, 114.5, -6.5]];
const bad = (lo, la) => NOGO.some(([a, b, c, d]) => lo >= a && lo <= c && la <= b && la >= d);
let sd = 11; const rnd = () => ((sd = (sd * 1103515245 + 12345) >>> 0) / 4294967296);
out.sound = [];
for (let y = 10; y < 556; y += 30) for (let x = 12; x < 1172; x += 34) { const px = x + (rnd() - 0.5) * 22, py = y + (rnd() - 0.5) * 18, lo = px / 14.05 + 50, la = 30 - py / 14;
  if (bad(lo, la) || inLand(px, py)) continue; const d = dist(px, py); if (d < 7) continue; if (d > 90 && rnd() < 0.55) continue;
  const fm = d < 22 ? 3 + Math.round(d * 0.7 + rnd() * 4) : d < 70 ? Math.round(18 + d * 0.9 + rnd() * 12) : Math.round(70 + d * 0.8 + rnd() * 30);
  out.sound.push([Math.round(px), Math.round(py), fm]); }
const js = `// 자동 생성(tools/geo.mjs): Natural Earth 1:50m 해안선(공공 영역). 좌표는 지도 왼쪽 위(50°E, 30°N) 기준 px\nconst GEOD = ${JSON.stringify(out)};\n`;
fs.writeFileSync(new URL('../src/geo.js', import.meta.url), js);
console.log('land', out.land.length, 'blocs', Object.entries(out.bloc).map(([k, v]) => k + ':' + v.length).join(' '), 'border', out.border.length, 'sound', out.sound.length, 'total', js.length);
const names = new Set(); for (const g of geoms) names.add(g.properties.name); console.log([...names].filter(n => /Lao|Viet|Timor|Burma|Myan|Taiw|Hong|Maca|Brun|Somal|Ira|Afgh/.test(n)).join(', '));
