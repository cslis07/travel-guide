// 공유 링크·백업으로 들어온 값 정리 회귀 테스트 — 실제 trips.js 를 브라우저 없이 검증
//   node scripts/security_test.mjs
import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const read = f => fs.readFileSync(new URL('../' + f, import.meta.url), 'utf8');
let pass = 0;
const ok = async (name, fn) => { await fn(); pass++; console.log('  ✓ ' + name); };

const store = new Map();
const ctx = {
  console, Date, Math, JSON, Intl,
  localStorage: { getItem: k => (store.has(k) ? store.get(k) : null), setItem: (k, v) => store.set(k, String(v)), removeItem: k => store.delete(k) }
};
ctx.window = ctx;
vm.createContext(ctx);
vm.runInContext(read('trips.js'), ctx);
const T = ctx.TripStore;
const SAFE = /^[A-Za-z0-9_-]{1,40}$/;
const EVIL = "'><img src=x onerror=alert(1)>";

store.set('tc_trips_v1', JSON.stringify([
  {
    id: 'abc' + EVIL, city: '오사카', start: '2026-12-01', end: '2026-12-03',
    members: [{ name: '나', color: 'red;background:url(x)' }, { name: '민수', color: '#1B4FD8', toss: "a'b<c" }, { name: '' }, 'x'],
    expenses: [{ id: EVIL, krw: 1000, paidBy: '나', paidFor: ['나', 7] }, { id: 'goodId_1', krw: 2000 }, 'bad'],
    reservations: [{ id: "r');alert(1);//" }], checklist: [{ id: '"><svg onload=alert(1)>' }],
    days: [{ date: '2026-12-01', items: [{ id: "x')" }, { title: 'id 없음' }] }, null],
  },
  { id: 'ok123', city: '방콕', start: '2026-12-01', end: '2026-12-02', expenses: 'x', days: 'y', members: [] },
  null, 'garbage'
]));

await ok('여행·지출·예약·준비물·일정 id 가 모두 영문·숫자·_- 로 정리된다', () => {
  const [t] = T.all();
  assert.match(t.id, SAFE);
  for (const x of [...t.expenses, ...t.reservations, ...t.checklist, ...t.days[0].items.filter(i => i.id)]) assert.match(x.id, SAFE, x.id);
  assert.equal(t.expenses[1].id, 'goodId_1');   // 정상 id 는 그대로(영수증 사진 키 유지)
});

await ok('같은 값은 늘 같은 id 로 — 다시 읽어도 바뀌지 않는다', () => {
  assert.equal(T.all()[0].expenses[0].id, T.all()[0].expenses[0].id);
  assert.equal(T.cleanId(EVIL), T.cleanId(EVIL));
  assert.notEqual(T.cleanId("a'"), T.cleanId('a"'));
});

await ok('멤버 색은 #hex 만, 토스 아이디는 허용 문자만, 빈 이름은 빠진다', () => {
  const [t] = T.all();
  assert.deepEqual(t.members.map(m => m.name), ['나', '민수']);
  assert.match(t.members[0].color, /^#[0-9a-fA-F]{6}$/);
  assert.equal(t.members[1].color, '#1B4FD8');
  assert.equal(t.members[1].toss, 'abc');
  assert.deepEqual(t.expenses[0].paidFor, ['나', '7']);
});

await ok('배열 자리에 배열이 아니면 [] — 여행이 열리지 않는 일 없음, 멤버가 비면 나', () => {
  const all = T.all();
  assert.equal(all.length, 2);   // null·문자열 항목은 버림
  const b = all[1];
  assert.deepEqual([b.expenses, b.days, b.reservations, b.checklist].map(a => Array.isArray(a)), [true, true, true, true]);
  assert.equal(b.members[0].name, '나');
  assert.equal(T.spent(b), 0);
});

await ok('일정 항목에 id 가 없으면 만들지 않는다(기존 동작 유지)', () => {
  assert.equal(T.all()[0].days[0].items[1].id, undefined);
});

// 2026-11-07 2차 점검: 날짜·통화·금액·취소 마감일 칸으로 태그가 들어가 링크만 열어도 실행되던 문제
const TAG = '<img src=x onerror=alert(1)>';
await ok('공유 링크·백업의 날짜·통화·금액·예약 날짜 칸은 형식만 남는다', () => {
  store.set('tc_trips_v1', JSON.stringify([{
    id: 'd1', city: '오사카', start: '2026-11-10' + TAG, end: TAG,
    expenses: [{ id: 'e1', krw: '1000' + TAG, amount: TAG, currency: 'JPY' + TAG, date: '2026-11-10' + TAG, category: 'food"' + TAG, method: TAG, spanDays: '3' + TAG,
      split: { mode: 'ratio', v: { ['나' + TAG]: '2' + TAG } } }],
    reservations: [{ id: 'r1', cancelBy: TAG, checkin: '2026-11-10x', dep: '10:30' + TAG, date: '2026-11-11' }],
    payments: [{ id: 'p1', from: '나', to: '민수', krw: 5000, date: TAG }],
    days: [{ date: TAG, items: [] }],
  }]));
  const t = T.all()[0], e = t.expenses[0], r = t.reservations[0];
  assert.equal(t.start, '2026-11-10'); assert.equal(t.end, '2026-11-10');   // 끝 날짜가 없으면 시작일
  assert.equal(e.currency, 'KRW'); assert.equal(e.amount, 0); assert.equal(e.krw, 0); assert.equal(e.date, '2026-11-10');
  assert.equal(e.category, 'etc'); assert.equal(e.method, 'card'); assert.equal(e.spanDays, 3);
  assert.equal(r.cancelBy, ''); assert.equal(r.checkin, '2026-11-10'); assert.equal(r.dep, ''); assert.equal(r.date, '2026-11-11');
  assert.equal(t.payments[0].date, ''); assert.equal(t.days[0].date, '');
  const blob = JSON.stringify({ s: t.start, e: t.end, x: [e.currency, e.amount, e.krw, e.date, e.category, e.method, e.spanDays], r, p: t.payments, d: t.days[0].date });
  assert.doesNotMatch(blob, /</);
  assert.deepEqual(Object.values(e.split.v), [0]);   // 비율 값도 숫자만
});
await ok('정상 값은 그대로 — 통화 소문자는 대문자로, 30자 넘는 낸 사람 이름은 멤버처럼 30자', () => {
  const long = '가'.repeat(33);
  store.set('tc_trips_v1', JSON.stringify([{ id: 'd2', city: '방콕', start: '2026-12-01', end: '2026-12-03', members: [{ name: '나' }, { name: long }],
    expenses: [{ id: 'e1', krw: 60000, amount: 1500, currency: 'thb', category: 'food', method: 'cash', date: '2026-12-01', paidBy: long, paidFor: ['나', long] }] }]));
  const t = T.all()[0], e = t.expenses[0];
  assert.equal(e.currency, 'THB'); assert.equal(e.amount, 1500); assert.equal(e.method, 'cash'); assert.equal(e.category, 'food');
  assert.equal(e.paidBy, t.members[1].name);
  assert.deepEqual(JSON.parse(JSON.stringify(T.settlements(t))), [{ from: '나', to: t.members[1].name, amt: 30000 }]);
});
await ok("송금 기록 이름이 'constructor'·'toString' 이어도 멤버로 치지 않는다", () => {
  const t = { members: [{ name: 'A' }, { name: 'B' }], expenses: [{ krw: 20000, paidBy: 'A', paidFor: ['A', 'B'] }], payments: [{ from: 'constructor', to: 'B', krw: 5000 }, { from: 'toString', to: 'A', krw: 5000 }] };
  assert.deepEqual(JSON.parse(JSON.stringify(T.settlements(t))), [{ from: 'B', to: 'A', amt: 10000 }]);
  assert.deepEqual(T.balances(t).map(b => b.net), [10000, -10000]);
});
await ok('영수증 사진 값은 끝까지 base64 일 때만 화면·복원에 쓴다', () => {
  for (const f of ['trip.html', 'trips.html']) {
    assert.ok(read(f).includes('/^data:image\\/jpeg;base64,[A-Za-z0-9+\\/=]+$/'), f);
    assert.ok(!read(f).includes('/^data:image\\/jpeg;base64,/.test'), f + ' 앞부분만 검사하는 곳이 남음');
  }
});
await ok('투어 화면: 외부 링크는 http(s) 만, 날짜 버튼은 날짜 형식만', () => {
  const s = read('tours.html');
  assert.match(s, /function webUrl\(u\)/); assert.match(s, /webUrl\(f\.reservationUrl\)/); assert.match(s, /webUrl\(it\.url\)/);
  assert.doesNotMatch(s, /const dep = esc\(it\.departureDate\)/);
});

const G = await import(new URL('../api/_guard.js', import.meta.url));
const req = o => ({ headers: { get: k => (k === 'origin' ? o : null) } });
await ok('API 는 우리 사이트·이 프로젝트 Vercel 배포만 허용', () => {
  for (const o of ['https://travelcost.co.kr', 'https://www.travelcost.co.kr', 'https://travel-guide-cslis07.vercel.app', 'https://travel-guide-c8hbbxxto-cslis07.vercel.app', 'https://travel-guide-git-master-cslis07.vercel.app', 'http://localhost:5180', null])
    assert.equal(G.foreignOrigin(req(o)), false, String(o));
  // travel-guide.vercel.app 은 남의 사이트, travel-guide-아무거나.vercel.app 은 누구나 만들 수 있다
  for (const o of ['https://evil.vercel.app', 'https://travelcost.co.kr.evil.com', 'https://evil.example', 'https://travel-guide.vercel.app', 'https://travel-guide-attacker.vercel.app', 'https://travel-guide-abc123-team.vercel.app'])
    assert.equal(G.foreignOrigin(req(o)), true, o);
});

const src = { proxy: read('api/proxy.js'), idx: read('api/hotelidx.js'), price: read('api/hotelprice.js') };
await ok('프록시 오류 응답에 상류 주소(키 포함)를 싣지 않는다', () => {
  assert.doesNotMatch(src.proxy, /target:\s*safe/);
});
await ok('숙소 API 두 곳에 남의 사이트 차단·호출 제한·시간 제한', () => {
  for (const s of [src.idx, src.price]) {
    assert.match(s, /foreignOrigin\(req\)/); assert.match(s, /rateLimited\(req/); assert.match(s, /AbortSignal\.timeout/);
  }
});

console.log(`security_test: ${pass} passed`);
