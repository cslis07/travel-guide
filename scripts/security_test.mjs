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

const G = await import(new URL('../api/_guard.js', import.meta.url));
const req = o => ({ headers: { get: k => (k === 'origin' ? o : null) } });
await ok('API 는 우리 사이트·이 프로젝트 Vercel 배포만 허용', () => {
  for (const o of ['https://travelcost.co.kr', 'https://www.travelcost.co.kr', 'https://travel-guide.vercel.app', 'https://travel-guide-abc123-team.vercel.app', 'http://localhost:5180', null])
    assert.equal(G.foreignOrigin(req(o)), false, String(o));
  for (const o of ['https://evil.vercel.app', 'https://travelcost.co.kr.evil.com', 'https://evil.example'])
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
