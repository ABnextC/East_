// ---------- 온라인 방 (깃허브 판: 브라우저끼리 직접 연결) ----------
// 방장 브라우저가 판정한다. 손님은 행동만 보내고, 방장은 사람마다 숨길 정보를 가린 판을 보낸다.
const NET_MINE = p => mine.has(p);
const SEAT_KO = ['빨강', '파랑', '노랑', '회색'];
const CODE_CH = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
const PEER_PREFIX = 'eic-abnextc-';
function nick() { try { return localStorage.getItem('eic-nick') || ''; } catch (e) { return ''; } }
function setNick(v) { try { localStorage.setItem('eic-nick', v); } catch (e) {} }
function myToken() {
  try { let t = localStorage.getItem('eic-token'); if (!t) { t = Math.random().toString(36).slice(2, 10) + Date.now().toString(36); localStorage.setItem('eic-token', t); } return t; }
  catch (e) { return 'tmp' + TAB; }
}
function toast(t) { const el = $('toast'); el.textContent = t; el.hidden = false; clearTimeout(toast.t); toast.t = setTimeout(() => { el.hidden = true; }, 3500); }
function show(which) {
  $('lobby').hidden = which !== 'lobby'; $('game').hidden = which !== 'game'; $('bar').hidden = which !== 'game';
  $('undo').hidden = which !== 'game'; $('new').hidden = which !== 'game' || MODE !== 'local';
  $('leave').hidden = !(MODE === 'local' && which === 'game') && !NET.code;
  $('roomtag').hidden = !NET.code && which !== 'game'; $('roomtag').textContent = NET.code ? `방 ${NET.code}` : '혼자 테스트';
}
const hostKey = code => 'eic-host-' + code;
function savedHosts() {
  const out = [];
  try { for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (k && k.startsWith('eic-host-')) { const v = JSON.parse(localStorage.getItem(k)); if (v && v.room && v.room.status !== 'over') out.push({ code: k.slice(9), room: v.room, at: v.at || 0 }); } } } catch (e) {}
  return out.sort((a, b) => b.at - a.at).slice(0, 5);
}
function roomLink() { return location.href.split('#')[0] + '#r-' + NET.code; }

function renderLobby() {
  const el = $('lobby'), d = NET.room, online = typeof Peer !== 'undefined';
  if (!NET.code) {
    const saved = savedHosts().map(r => `<li><button type="button" data-l="resume" data-code="${esc(r.code)}"><b>${esc(r.code)}</b><span>${r.room.status === 'lobby' ? '대기 중' : '진행 중'} · 내가 방장</span></button></li>`).join('');
    el.innerHTML = `<h2>온라인 방</h2>
      ${online ? '' : '<p class="warn">연결 도구를 불러오지 못했어요. 인터넷 연결을 확인하고 새로고침해 주세요. 지금은 혼자 테스트만 됩니다.</p>'}
      <label class="fld" for="nick">닉네임</label><input id="nick" maxlength="10" value="${esc(nick())}" placeholder="예: 지원">
      <div class="row"><button type="button" class="go" data-l="create" ${online ? '' : 'disabled'}>새 방 만들기</button><span class="hint">방을 만든 사람이 방장이에요. 방장 창이 열려 있어야 게임이 이어져요.</span></div>
      <label class="fld" for="code">방 코드로 들어가기</label>
      <div class="row"><input id="code" maxlength="4" placeholder="ABCD" autocapitalize="characters"><button type="button" data-l="joincode" ${online ? '' : 'disabled'}>들어가기</button></div>
      ${saved ? `<h3>내가 만든 방 이어서 하기</h3><ul class="rooms">${saved}</ul>` : ''}
      <hr><div class="row"><button type="button" data-l="local">혼자 4자리 테스트</button><span class="hint">한 기기에서 네 자리를 번갈아 조작합니다.</span></div>`;
    return;
  }
  const status = NET.role === 'host' ? (NET.online ? '방장 · 손님을 기다리는 중' : '연결 준비 중…') : (NET.hostGone ? '방장과 연결이 끊겼어요. 다시 잇는 중…' : d ? '방장과 연결됨' : '방장에게 연결하는 중…');
  if (!d) { el.innerHTML = `<h2>방 <span class="code">${esc(NET.code)}</span></h2><p class="hint">${status}</p><div class="row"><button type="button" data-l="back">나가기</button></div>`; return; }
  const seats = d.seats.map((s, i) => {
    const me = s && s.uid === NET.uid;
    return `<div class="seat" style="--pc:${PCOL[i]}"><span class="seat-c">${SEAT_KO[i]}</span><b>${s ? esc(s.name) : '빈 자리'}</b>${me ? '<span class="me">나</span>' : ''}${s && !s.on && !me ? '<span class="seat-c">연결 끊김</span>' : ''}
      ${!s ? `<button type="button" data-l="sit" data-i="${i}">앉기</button>` : me ? `<button type="button" data-l="stand" data-i="${i}">일어나기</button>` : ''}</div>`;
  }).join('');
  const full = d.seats.every(Boolean), seated = d.seats.some(s => s && s.uid === NET.uid);
  el.innerHTML = `<h2>방 <span class="code">${esc(NET.code)}</span></h2>
    <p class="hint">${status}</p>
    <div class="row"><input id="link" readonly value="${esc(roomLink())}"><button type="button" data-l="copy">링크 복사</button></div>
    <p class="hint">친구에게 이 링크를 보내거나, 같은 주소에서 방 코드 <b>${esc(NET.code)}</b>를 입력하게 하세요.</p>
    <div class="seats">${seats}</div>
    <p class="hint">한 사람이 여러 자리에 앉아도 됩니다. 네 자리가 다 차야 시작할 수 있어요.</p>
    <div class="row"><button type="button" class="go" data-l="start" ${full && seated ? '' : 'disabled'}>게임 시작</button><button type="button" data-l="back">방에서 나가기</button></div>`;
}

// ---- 방장 ----
const PEER_OPTS = { debug: 0 };
function redact(full, seatsMine) {
  const g = JSON.parse(JSON.stringify(full));
  g.rng = 0;
  for (const m of ['indies', 'europe']) if (g.cards[m] != null && !g.cards.shown[m] && !(g.cards.peek[m] || []).some(p => seatsMine.has(p))) g.cards[m] = null;
  if (g.phase === 'C') g.players.forEach((pl, p) => { if (seatsMine.has(p)) return; pl.docks.forEach(d => { if (d && d.loc !== 'port' && d.loc !== 'sea' && !d.stayed) { d.type = 'galleon'; d.cargo = []; } }); });
  return g;
}
const seatsOf = (room, uid) => new Set(room.seats.map((s, i) => (s && s.uid === uid ? i : -1)).filter(i => i >= 0));
function viewFor(uid) {
  const H = NET.H, r = H.room;
  return { t: 'room', room: { code: NET.code, status: r.status, seats: r.seats.map(s => s && { uid: s.uid, name: s.name, on: s.uid === NET.uid || H.conns.has(s.uid) }), ver: r.ver, prev: !!H.prev, prevBy: r.prevBy },
    state: r.status === 'lobby' ? null : JSON.stringify(redact(H.full, seatsOf(r, uid))) };
}
function hostSave() { try { localStorage.setItem(hostKey(NET.code), JSON.stringify({ room: NET.H.room, full: NET.H.full, prev: NET.H.prev, at: Date.now() })); } catch (e) {} }
function hostPublish() {
  hostSave();
  takeRoom(viewFor(NET.uid));
  for (const [uid, c] of NET.H.conns) { try { if (c.open) c.send(viewFor(uid)); } catch (e) {} }
}
function hostMsg(from, m) {
  const H = NET.H, r = H.room, err = msg => from.reply({ t: 'err', msg });
  if (!m || typeof m !== 'object') return;
  if (m.t === 'sit') {
    if (r.status !== 'lobby') return;
    if (r.seats[m.i]) return err('이미 누가 앉았어요');
    r.seats[m.i] = { uid: from.uid, name: String(m.name || '손님').slice(0, 10) };
  } else if (m.t === 'stand') {
    if (r.status !== 'lobby' || !r.seats[m.i] || r.seats[m.i].uid !== from.uid) return;
    r.seats[m.i] = null;
  } else if (m.t === 'start') {
    if (r.status !== 'lobby' || !r.seats.every(Boolean) || !r.seats.some(s => s.uid === from.uid)) return;
    H.full = createGame({ seed: Math.floor(Math.random() * 1e9), names: r.seats.map(s => s.name) });
    r.status = 'playing'; r.ver = 1; H.prev = null; r.prevBy = null;
  } else if (m.t === 'act') {
    if (r.status !== 'playing') return;
    if (m.ver !== r.ver) return err('판이 바뀌어서 최신 상태로 다시 그렸어요');
    const g = H.full, owner = r.seats[g.awaiting.player];
    if (!owner || owner.uid !== from.uid) return err('지금은 내 차례가 아니에요');
    const a = legalActions(g).find(x => x.key === m.key);
    if (!a) return err('둘 수 없는 수예요. 화면을 다시 그렸어요');
    const before = JSON.stringify(g), P0 = g.period, F0 = g.phase;
    apply(g, a); trimLog(g);
    const undoable = g.period === P0 && g.phase === F0;
    H.prev = undoable ? before : null; r.prevBy = undoable ? from.uid : null;
    r.ver++; if (g.over) r.status = 'over';
  } else if (m.t === 'undo') {
    if (!H.prev || r.prevBy !== from.uid || m.ver !== r.ver) return err('지금은 무를 수 없어요');
    H.full = JSON.parse(H.prev); H.prev = null; r.prevBy = null; r.ver++; r.status = 'playing';
  } else if (m.t !== 'hello') return;
  hostPublish();
}
function hostOpen(code, saved, tries = 0) {
  MODE = 'online'; NET.role = 'host'; NET.code = code; NET.online = false; NET.room = null; NET.ver = 0; G = null;
  NET.H = saved ? { conns: new Map(), room: saved.room, full: saved.full, prev: saved.prev } :
    { conns: new Map(), room: { status: 'lobby', seats: [{ uid: NET.uid, name: nick() || '방장' }, null, null, null], ver: 0, prevBy: null }, full: null, prev: null };
  try { location.hash = 'r-' + code; } catch (e) {}
  show('lobby'); renderLobby();
  const peer = NET.peer = new Peer(PEER_PREFIX + code, PEER_OPTS);
  peer.on('open', () => { NET.online = true; hostPublish(); });
  peer.on('connection', conn => {
    conn.on('data', m => {
      if (m && m.t === 'hello' && typeof m.uid === 'string') {
        const old = NET.H.conns.get(m.uid); if (old && old !== conn) { try { old.close(); } catch (e) {} }
        conn.uid = m.uid; NET.H.conns.set(m.uid, conn);
      }
      if (!conn.uid) return;
      hostMsg({ uid: conn.uid, reply: x => { try { conn.send(x); } catch (e) {} } }, m);
    });
    conn.on('close', () => { if (conn.uid && NET.H && NET.H.conns.get(conn.uid) === conn) { NET.H.conns.delete(conn.uid); hostPublish(); } });
  });
  peer.on('disconnected', () => { NET.online = false; renderLobby(); setTimeout(() => { try { if (!peer.destroyed) peer.reconnect(); } catch (e) {} }, 2000); });
  peer.on('error', e => {
    if (e.type === 'unavailable-id') {
      try { peer.destroy(); } catch (x) {}
      if (saved && tries < 8) { toast('방을 다시 여는 중… 잠시만요'); setTimeout(() => { if (NET.code === code) hostOpen(code, saved, tries + 1); }, 4000); }
      else if (!saved) hostOpen(newCode(), null, tries + 1);
      else { toast('이 방 코드를 다른 창에서 쓰고 있어요'); leaveRoom(); }
    } else if (e.type === 'network' || e.type === 'server-error' || e.type === 'socket-error') toast('연결 서버에 닿지 못했어요. 인터넷 연결을 확인해 주세요');
  });
}
function newCode() { return Array.from({ length: 4 }, () => CODE_CH[Math.floor(Math.random() * CODE_CH.length)]).join(''); }

// ---- 손님 ----
function guestOpen(code) {
  MODE = 'online'; NET.role = 'guest'; NET.code = code; NET.room = null; NET.ver = 0; NET.hostGone = false; G = null;
  try { location.hash = 'r-' + code; } catch (e) {}
  show('lobby'); renderLobby();
  const peer = NET.peer = new Peer(undefined, PEER_OPTS);
  peer.on('open', () => guestConnect());
  peer.on('disconnected', () => setTimeout(() => { try { if (!peer.destroyed) peer.reconnect(); } catch (e) {} }, 2000));
  peer.on('error', e => {
    if (e.type === 'peer-unavailable') { NET.hostGone = true; if (!NET.room) toast(`${code} 방을 찾지 못했어요. 코드가 맞는지, 방장 창이 열려 있는지 확인해 주세요`); retryGuest(); renderLobby(); if (G) render(); }
    else if (e.type === 'network' || e.type === 'server-error' || e.type === 'socket-error') toast('연결 서버에 닿지 못했어요. 인터넷 연결을 확인해 주세요');
  });
}
function retryGuest() { clearTimeout(retryGuest.t); retryGuest.t = setTimeout(() => { if (NET.role === 'guest' && NET.code && NET.hostGone && NET.peer && !NET.peer.destroyed) guestConnect(); }, 4000); }
function guestConnect() {
  const c = NET.conn = NET.peer.connect(PEER_PREFIX + NET.code, { reliable: true });
  c.on('open', () => { NET.hostGone = false; c.send({ t: 'hello', uid: NET.uid, name: nick() || '손님' }); });
  c.on('data', m => { if (!m) return; if (m.t === 'room') takeRoom(m); else if (m.t === 'err') { NET.busy = false; toast(m.msg); if (G) render(); } });
  c.on('close', () => { if (NET.conn !== c) return; NET.hostGone = true; NET.busy = false; toast('방장과 연결이 끊겼어요. 다시 잇는 중…'); renderLobby(); if (G) render(); retryGuest(); });
}

// ---- 공통 ----
function send(m) {
  if (NET.role === 'host') return hostMsg({ uid: NET.uid, reply: x => { if (x.t === 'err') { NET.busy = false; toast(x.msg); if (G) render(); } } }, m);
  if (NET.conn && NET.conn.open) { NET.conn.send(m); return; }
  NET.busy = false; toast('방장과 연결이 끊겨 있어요. 다시 잇는 중이에요');
}
function takeRoom(m) {
  NET.room = m.room;
  mine = new Set(m.room.seats.map((s, i) => (s && s.uid === NET.uid ? i : -1)).filter(i => i >= 0));
  if (m.room.status === 'lobby') { G = null; show('lobby'); renderLobby(); return; }
  if (m.room.ver !== NET.ver || !G) { G = JSON.parse(m.state); NET.ver = m.room.ver; ui = {}; }
  NET.busy = false; clearTimeout(netAct.t);
  show('game'); render();
}
function netAct(a) {
  if (NET.busy) return; NET.busy = true;
  netAct.t = setTimeout(() => { if (NET.busy) { NET.busy = false; toast('응답이 없어요. 다시 눌러 주세요'); render(); } }, 6000);
  send({ t: 'act', key: a.key, ver: NET.ver });
}
function netUndo() { if (NET.busy) return; send({ t: 'undo', ver: NET.ver }); }
function leaveRoom() {
  try { if (NET.peer) NET.peer.destroy(); } catch (e) {}
  NET.peer = null; NET.conn = null; NET.H = null; NET.code = null; NET.room = null; NET.role = null; mine = new Set();
  MODE = null; G = null;
  try { history = []; location.hash = ''; } catch (e) {}
  show('lobby'); renderLobby();
}
function readNick() { const n = ($('nick') && $('nick').value || '').trim(); if (n) setNick(n); return n || nick(); }
async function lobbyClick(b) {
  const l = b.dataset.l;
  if (b.id === 'leave') { if (MODE === 'local') { MODE = null; G = null; show('lobby'); return renderLobby(); } return leaveRoom(); }
  if (l === 'local') { MODE = 'local'; G = load() || createGame({ seed: Math.floor(Math.random() * 1e9) }); history = []; show('game'); return render(); }
  if (l === 'create') { if (!readNick()) { toast('닉네임을 먼저 적어 주세요'); $('nick').focus(); return; } return hostOpen(newCode(), null); }
  if (l === 'joincode') { const c = ($('code').value || '').trim().toUpperCase(); if (!/^[A-Z]{4}$/.test(c)) return toast('방 코드는 영문 4글자예요'); readNick(); return guestOpen(c); }
  if (l === 'resume') { readNick(); let v = null; try { v = JSON.parse(localStorage.getItem(hostKey(b.dataset.code))); } catch (e) {} return v ? hostOpen(b.dataset.code, v) : toast('저장된 방을 찾지 못했어요'); }
  if (l === 'back') return leaveRoom();
  if (l === 'sit') return send({ t: 'sit', i: +b.dataset.i, name: nick() || '손님' });
  if (l === 'stand') return send({ t: 'stand', i: +b.dataset.i });
  if (l === 'start') return send({ t: 'start' });
  if (l === 'copy') { const t = roomLink(); try { await navigator.clipboard.writeText(t); toast('링크를 복사했어요'); } catch (e) { const i = $('link'); if (i && i.select) i.select(); toast('링크를 길게 눌러 복사해 주세요'); } }
}
document.addEventListener('input', e => { if (e.target.id === 'nick') setNick(e.target.value.trim()); });

function boot() {
  NET.uid = myToken();
  show('lobby'); renderLobby();
  const h = (location.hash || '').match(/^#r-([A-Z]{4})$/);
  if (!h || typeof Peer === 'undefined') return;
  let v = null; try { v = JSON.parse(localStorage.getItem(hostKey(h[1]))); } catch (e) {}
  if (v) hostOpen(h[1], v); else guestOpen(h[1]);
}
boot();
