const fs = require('fs'), vm = require('vm');
const js = fs.readFileSync(require('path').join(__dirname,'..','index.html'), 'utf8').split('<script>')[1].split('</script>')[0];
// 가짜 PeerJS: 같은 프로세스 안에서 id로 서로를 찾는다
const broker = new Map();
const later = f => setTimeout(f, 0);
class Emitter { constructor() { this.h = {}; } on(e, f) { (this.h[e] = this.h[e] || []).push(f); } emit(e, ...a) { (this.h[e] || []).forEach(f => f(...a)); } }
class Conn extends Emitter { constructor() { super(); this.open = false; } send(m) { const o = this.other; if (!this.open) throw new Error('closed'); const copy = JSON.parse(JSON.stringify(m)); later(() => o.emit('data', copy)); } close() { if (!this.open) return; this.open = this.other.open = false; later(() => { this.emit('close'); this.other.emit('close'); }); } }
let auto = 0;
class Peer extends Emitter {
  constructor(id) { super(); this.id = id || 'anon' + (++auto); this.destroyed = false;
    later(() => { if (broker.has(this.id)) return this.emit('error', { type: 'unavailable-id' }); broker.set(this.id, this); this.emit('open', this.id); }); }
  connect(id) { const a = new Conn(), b = new Conn(); a.other = b; b.other = a;
    later(() => { const t = broker.get(id); if (!t) return this.emit('error', { type: 'peer-unavailable' }); a.open = b.open = true; t.emit('connection', b); later(() => a.emit('open')); });
    return a; }
  destroy() { this.destroyed = true; if (broker.get(this.id) === this) broker.delete(this.id); }
  reconnect() {}
}
function client(uid) {
  const els = {}; let click;
  const mk = () => ({ innerHTML: '', hidden: false, disabled: false, value: '', textContent: '', setAttribute() {}, dataset: {}, classList: { toggle() {} }, focus() {}, select() {} });
  const store = { _: { 'eic-token': uid }, get length() { return Object.keys(this._).length; }, key(i) { return Object.keys(this._)[i]; }, getItem(k) { return this._[k] ?? null; }, setItem(k, v) { this._[k] = String(v); } };
  const ctx = { console, setTimeout, clearTimeout, JSON, Math, Date, Promise, Peer, navigator: { clipboard: { writeText: async () => {} } },
    document: { getElementById: id => els[id] || (els[id] = mk()), querySelectorAll: () => [], addEventListener: (t, f) => { if (t === 'click') click = f; } },
    location: { hash: '', href: 'https://abnextc.github.io/eic/' }, localStorage: store };
  ctx.window = ctx; vm.createContext(ctx);
  vm.runInContext(js + ';globalThis.__=()=>({G,MODE,NET,mine,canAct:canAct()});', ctx);
  const press = attrs => { const ds = {}; for (const m of attrs.matchAll(/data-([a-z]+)="([^"]*)"/g)) ds[m[1]] = m[2].replace(/&quot;/g, '"'); return click({ target: { closest: () => ({ dataset: ds, disabled: false, id: '' }) } }); };
  const buttons = ids => ids.map(i => els[i] ? els[i].innerHTML : '').join('').match(/<button type="button"[^>]*>/g) || [];
  return { els, press, buttons, st: () => ctx.__(), ctx, store };
}
const tick = (n = 3) => new Promise(r => { let k = 0; const f = () => (++k >= n ? r() : setTimeout(f, 0)); setTimeout(f, 0); });
(async () => {
  const A = client('hostA'), B = client('guestB');
  A.els.nick = { value: '지원', focus() {} };
  await A.press('data-l="create"'); await tick(5);
  const code = A.st().NET.code; console.log('room', code, 'host online', A.st().NET.online);
  await A.press('data-l="sit" data-i="1"'); await tick();
  B.els.code = { value: code }; B.els.nick = { value: '친구' };
  await B.press('data-l="joincode"'); await tick(8);
  await B.press('data-l="sit" data-i="2"'); await tick(5); await B.press('data-l="sit" data-i="3"'); await tick(5);
  console.log('seats', JSON.stringify(A.st().NET.room.seats.map(s => s && s.name)), 'B sees', JSON.stringify(B.st().NET.room && B.st().NET.room.seats.map(s => s && s.name)));
  await B.press('data-l="start"'); await tick(8);
  console.log('A mine', [...A.st().mine], 'B mine', [...B.st().mine], 'B has rng?', B.st().G.rng);
  let r = 7, clicks = 0, leakChecks = 0, guestShipHidden = 0;
  const rr = () => { r = (r * 1103515245 + 12345) & 0x7fffffff; return r / 0x7fffffff; };
  let reconnected = false;
  while (!A.st().G.over && clicks < 9000) {
    // 중간에 손님 연결을 한 번 끊었다 다시 잇는다
    if (clicks === 100 && !reconnected) { reconnected = true; B.st().NET.conn.close(); await tick(4); await new Promise(res => setTimeout(res, 4200)); await tick(8); console.log('after reconnect, B gone?', B.st().NET.hostGone, 'same ver', A.st().NET.ver === B.st().NET.ver); }
    const actor = A.st().canAct ? A : B.st().canAct ? B : null;
    if (!actor) throw new Error('nobody can act ' + JSON.stringify(A.st().G.awaiting));
    // 손님이 받은 판에는 남이 뒤집어 둔 배 종류와 안 본 카드가 없어야 한다
    const gB = B.st().G, full = A.st().NET.H.full;
    if (full.phase === 'C') full.players.forEach((pl, p) => { if (B.st().mine.has(p)) return; pl.docks.forEach((d, i) => { if (d && d.loc !== 'port' && d.loc !== 'sea' && !d.stayed) { leakChecks++; if (gB.players[p].docks[i].type !== 'galleon' && d.type !== 'galleon') throw new Error('ship type leaked'); } }); });
    for (const m of ['indies', 'europe']) if (full.cards[m] != null && !full.cards.shown[m] && !full.cards.peek[m].some(p => B.st().mine.has(p)) && gB.cards[m] != null) throw new Error('card leaked');
    const btns = actor.buttons(['sec-stock', 'sec-chars', 'sec-map', 'sec-ports', 'bar']).filter(a => /data-/.test(a) && !/disabled/.test(a) && !/data-(sell|minus|cancel)=/.test(a));
    if (!btns.length) throw new Error('no buttons ' + JSON.stringify(actor.st().G.awaiting) + ' busy ' + actor.st().NET.busy);
    await actor.press(btns[Math.floor(rr() * btns.length)]); clicks++;
    await tick(5);
  }
  const sa = A.st().NET.H.full.scores, sb = B.st().G.scores;
  console.log('over', A.st().G.over, B.st().G.over, 'clicks', clicks, 'scores equal', JSON.stringify(sa) === JSON.stringify(sb), 'hidden-ship checks', leakChecks);
  // 방장 새로고침: 저장된 판으로 같은 방 다시 열기
  A.st().NET.peer.destroy();
  const A2 = client('hostA'); Object.assign(A2.store._, A.store._); A2.ctx.location.hash = '#r-' + code;
  vm.runInContext('boot()', A2.ctx); await tick(6);
  console.log('host resumed', A2.st().NET.role, A2.st().NET.code === code, 'state over', A2.st().G && A2.st().G.over);
  process.exit(0);
})().catch(e => { console.error('FAIL', e); process.exit(1); });
