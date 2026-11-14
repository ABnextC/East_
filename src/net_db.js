// ---------- 온라인 방 ----------
const NET_MINE = p => mine.has(p);
const SEAT_KO = ['빨강', '파랑', '노랑', '회색'];
const CODE_CH = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
function nick() { try { return localStorage.getItem('eic-nick') || ''; } catch (e) { return ''; } }
function setNick(v) { try { localStorage.setItem('eic-nick', v); } catch (e) {} }
function toast(t) { const el = $('toast'); el.textContent = t; el.hidden = false; clearTimeout(toast.t); toast.t = setTimeout(() => { el.hidden = true; }, 3500); }
function show(which) {
  $('lobby').hidden = which !== 'lobby'; $('game').hidden = which !== 'game'; $('bar').hidden = which !== 'game';
  document.body.classList.toggle('ingame', which === 'game');
  $('undo').hidden = which !== 'game'; $('new').hidden = which !== 'game' || MODE !== 'local';
  $('leave').hidden = !(MODE === 'local' && which === 'game') && !NET.code;
  $('roomtag').hidden = !NET.code && which !== 'game'; $('roomtag').textContent = NET.code ? `방 ${NET.code}` : '혼자 테스트';
}
const errTxt = e => ({ quota_exceeded: '저장 공간이 꽉 찼어요', invalid_argument: '이 페이지에 쓸 권한이 없어요', resource_exhausted: '요청이 너무 잦아요. 잠시 뒤 다시 눌러 주세요', revoked: '접근 권한이 바뀌었어요' }[e && e.code] || '연결이 불안정해요. 다시 눌러 주세요');
async function withLease(fn) {
  const lease = await NET.ref.acquire({ holder: NET.uid + ':' + TAB, ttlMs: 6000 });
  if (!lease.acquired) { toast('다른 사람이 막 움직이는 중이에요. 다시 눌러 주세요'); return null; }
  const snap = await NET.ref.get();
  return fn(snap.exists ? snap.data() : null);
}

function renderLobby() {
  const el = $('lobby'), d = NET.room;
  if (!NET.code) {
    const online = !!NET.db, canW = NET.canWrite !== false;
    const rooms = NET.rooms.map(r => `<li><button type="button" data-l="join" data-code="${esc(r.id)}"><b>${esc(r.id)}</b><span>${r.status === 'lobby' ? `대기 중 ${r.seated}/4` : r.status === 'over' ? '끝난 판' : `${r.period}기간 진행 중`}</span></button></li>`).join('');
    el.innerHTML = `<h2>온라인 방</h2>
      ${!online ? `<p class="warn">온라인 대전은 claude.ai에 로그인한 상태로 이 페이지를 열어야 쓸 수 있어요. 지금은 혼자 테스트만 됩니다.</p>`
      : !canW ? `<p class="warn">이 페이지에 쓰기 권한이 없어서 방을 만들거나 앉을 수 없어요. 페이지 주인에게 편집자로 초대해 달라고 하세요.</p>` : ''}
      <label class="fld" for="nick">닉네임</label><input id="nick" maxlength="10" value="${esc(nick())}" placeholder="예: 지원" ${online && canW ? '' : 'disabled'}>
      <div class="row"><button type="button" class="go" data-l="create" ${online && canW ? '' : 'disabled'}>새 방 만들기</button></div>
      <label class="fld" for="code">방 코드로 들어가기</label>
      <div class="row"><input id="code" maxlength="4" placeholder="ABCD" ${online ? '' : 'disabled'}><button type="button" data-l="joincode" ${online ? '' : 'disabled'}>들어가기</button></div>
      ${online ? `<h3>최근 방</h3>${rooms ? `<ul class="rooms">${rooms}</ul>` : '<p class="hint">아직 만든 방이 없어요.</p>'}` : ''}
${evOptHTML()}
      <hr><div class="row"><button type="button" data-l="local">혼자 4자리 테스트</button><span class="hint">한 기기에서 네 자리를 번갈아 조작합니다.</span></div>`;
    return;
  }
  if (!d) { el.innerHTML = `<p>방 ${esc(NET.code)} 불러오는 중…</p><button type="button" data-l="back">나가기</button>`; return; }
  const seats = d.seats.map((s, i) => {
    const me = s && s.uid === NET.uid;
    return `<div class="seat" style="--pc:${PCOL[i]}"><span class="seat-c">${SEAT_KO[i]}</span><b>${s ? esc(s.name) : '빈 자리'}</b>${me ? '<span class="me">나</span>' : ''}
      ${!s ? `<button type="button" data-l="sit" data-i="${i}" ${NET.canWrite === false ? 'disabled' : ''}>앉기</button>` : me ? `<button type="button" data-l="stand" data-i="${i}">일어나기</button>` : ''}</div>`;
  }).join('');
  const full = d.seats.every(Boolean), seated = d.seats.some(s => s && s.uid === NET.uid);
  el.innerHTML = `<h2>방 <span class="code">${esc(NET.code)}</span></h2>
    <p class="hint">친구에게 이 페이지 주소와 방 코드 <b>${esc(NET.code)}</b>를 알려 주세요. 주소 끝이 #r-${esc(NET.code)}이면 바로 이 방으로 들어옵니다.</p>
    <div class="seats">${seats}</div>
    <p class="hint">규칙: ${d.events ? '<b>확장 「시대의 사건」 켬</b>' : '기본 규칙(확장 없음)'}</p>
    <p class="hint">한 사람이 여러 자리에 앉아도 됩니다. 네 자리가 다 차야 시작할 수 있어요.</p>
    <div class="row"><button type="button" class="go" data-l="start" ${full && seated ? '' : 'disabled'}>게임 시작</button><button type="button" data-l="back">방에서 나가기</button></div>`;
}

async function netAct(a) {
  if (NET.busy) return; NET.busy = true;
  const before = JSON.stringify(G), P0 = G.period, F0 = G.phase;
  try {
    await withLease(async d => {
      if (!d || d.ver !== NET.ver) { toast('판이 바뀌어서 최신 상태로 다시 그렸어요'); if (d) takeRoom(d); return; }
      apply(G, a); trimLog(G);
      const undoable = G.period === P0 && G.phase === F0;
      await NET.ref.update({ state: JSON.stringify(G), ver: d.ver + 1, status: G.over ? 'over' : 'playing', period: G.period, prev: undoable ? before : null, prevBy: undoable ? NET.uid : null, at: Date.now() });
      NET.ver = d.ver + 1;
    });
  } catch (e) { G = JSON.parse(before); toast(errTxt(e)); }
  finally { NET.busy = false; ui = {}; render(); }
}
async function netUndo() {
  if (NET.busy) return; NET.busy = true;
  try {
    await withLease(async d => {
      if (!d || !d.prev || d.prevBy !== NET.uid || d.ver !== NET.ver) { toast('지금은 무를 수 없어요'); return; }
      await NET.ref.update({ state: d.prev, ver: d.ver + 1, prev: null, prevBy: null, at: Date.now() });
    });
  } catch (e) { toast(errTxt(e)); }
  finally { NET.busy = false; }
}
function takeRoom(d) {
  NET.room = d;
  mine = new Set(d.seats.map((s, i) => (s && s.uid === NET.uid ? i : -1)).filter(i => i >= 0));
  if (d.status === 'lobby') { G = null; show('lobby'); renderLobby(); return; }
  if (!NET.busy && (d.ver !== NET.ver || !G)) { G = JSON.parse(d.state); NET.ver = d.ver; ui = { lastEra: ui.lastEra }; }
  show('game'); render();
}
function openRoom(code) {
  leaveRoom(true);
  MODE = 'online'; NET.code = code; NET.ref = NET.db.doc('games/' + code); NET.room = null; NET.ver = 0; G = null;
  try { history = []; location.hash = 'r-' + code; } catch (e) {}
  show('lobby'); renderLobby();
  const timer = setTimeout(() => { if (!NET.room) toast('방 정보를 아직 받지 못했어요. 연결을 확인해 주세요'); }, 10000);
  NET.unsub = NET.ref.onSnapshot(snap => {
    clearTimeout(timer);
    if (!snap.exists) { if (!snap.metadata.fromCache) { toast(`${code} 방이 없어요`); leaveRoom(); } return; }
    takeRoom(snap.data());
  }, e => { clearTimeout(timer); toast(errTxt(e)); });
}
function leaveRoom(quiet) {
  if (NET.unsub) { NET.unsub(); NET.unsub = null; }
  NET.code = null; NET.ref = null; NET.room = null; mine = new Set();
  if (quiet) return;
  MODE = null; G = null;
  try { history = []; location.hash = ''; } catch (e) {}
  show('lobby'); renderLobby();
}
async function createRoom() {
  const name = ($('nick').value || '').trim(); if (!name) { toast('닉네임을 먼저 적어 주세요'); $('nick').focus(); return; }
  setNick(name);
  for (let t = 0; t < 5; t++) {
    const code = Array.from({ length: 4 }, () => CODE_CH[Math.floor(Math.random() * CODE_CH.length)]).join('');
    const ref = NET.db.doc('games/' + code);
    const snap = await ref.get(); if (snap.exists) continue;
    await ref.set({ status: 'lobby', seats: [{ uid: NET.uid, name }, null, null, null], seated: 1, ver: 0, period: 0, at: Date.now(), events: evOn() });
    openRoom(code); return;
  }
  toast('방 코드를 만들지 못했어요. 다시 눌러 주세요');
}
async function seat(i, sit) {
  const name = nick() || '손님';
  await withLease(async d => {
    if (!d || d.status !== 'lobby') return;
    const seats = d.seats.slice();
    if (sit) { if (seats[i]) { toast('이미 누가 앉았어요'); return; } seats[i] = { uid: NET.uid, name }; }
    else { if (!seats[i] || seats[i].uid !== NET.uid) return; seats[i] = null; }
    await NET.ref.update({ seats, seated: seats.filter(Boolean).length, at: Date.now() });
  });
}
async function startGame() {
  await withLease(async d => {
    if (!d || d.status !== 'lobby' || !d.seats.every(Boolean)) return;
    const g = createGame({ seed: Math.floor(Math.random() * 1e9), names: d.seats.map(s => s.name), events: !!d.events });
    await NET.ref.update({ status: 'playing', state: JSON.stringify(g), ver: 1, period: 1, prev: null, prevBy: null, at: Date.now() });
  });
}
async function lobbyClick(b) {
  const l = b.dataset.l;
  try {
    if (b.id === 'leave') { if (MODE === 'local') { MODE = null; G = null; show('lobby'); return renderLobby(); } return leaveRoom(); }
    if (l === 'local') { MODE = 'local'; G = load() || createGame({ seed: Math.floor(Math.random() * 1e9), events: evOn() }); history = []; show('game'); return render(); }
    if (l === 'create') return await createRoom();
    if (l === 'joincode') { const c = ($('code').value || '').trim().toUpperCase(); if (!/^[A-Z]{4}$/.test(c)) return toast('방 코드는 영문 4글자예요'); const n = ($('nick') && $('nick').value || '').trim(); if (n) setNick(n); return openRoom(c); }
    if (l === 'join') { const n = ($('nick') && $('nick').value || '').trim(); if (n) setNick(n); return openRoom(b.dataset.code); }
    if (l === 'back') return leaveRoom();
    if (l === 'sit') { if (!nick()) setNick('손님'); return await seat(+b.dataset.i, true); }
    if (l === 'stand') return await seat(+b.dataset.i, false);
    if (l === 'start') return await startGame();
  } catch (e) { toast(errTxt(e)); }
}
document.addEventListener('input', e => { if (e.target.id === 'nick') setNick(e.target.value.trim()); });

async function boot() {
  show('lobby'); renderLobby();
  if (!window.claude || !window.claude.use) return;
  const [db, user] = await Promise.all([window.claude.use('db'), window.claude.use('user')]);
  if (!db || !user) return;
  NET.db = db; NET.user = user;
  NET.uid = await user.id();
  if (!NET.uid) { NET.db = null; renderLobby(); return; }
  try { NET.canWrite = await user.can('data.write'); } catch (e) { NET.canWrite = null; }
  NET.roomsUnsub = db.collection('games').orderBy('at', 'desc').limit(8).onSnapshot(q => { NET.rooms = q.docs.map(x => ({ id: x.id, ...x.data() })); if (!NET.code && MODE !== 'local') renderLobby(); }, () => {});
  const h = (location.hash || '').match(/^#r-([A-Z]{4})$/);
  if (h) openRoom(h[1]); else if (MODE !== 'local') renderLobby();
}
boot();

