// 내 여행 데이터 계산 회귀 테스트 — 정산·예시 여행·오프라인 환율·연말 귀국편 연도
//   node scripts/data_test.mjs
import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const read = f => fs.readFileSync(new URL('../' + f, import.meta.url), 'utf8');
let pass = 0;
const ok = async (name, fn) => { await fn(); pass++; console.log('  ✓ ' + name); };

function boot({ fetchOk = true, store = new Map() } = {}) {
  const ctx = {
    console, Date, Math, JSON, Intl, store,
    localStorage: { getItem: k => (store.has(k) ? store.get(k) : null), setItem: (k, v) => store.set(k, String(v)), removeItem: k => store.delete(k) },
    fetch: () => fetchOk ? Promise.resolve({ ok: true, json: () => Promise.resolve({ result: 'success', rates: { JPY: 0.1, USD: 0.0007 }, time_last_update_unix: 1 }) }) : Promise.reject(new Error('offline')),
  };
  ctx.window = ctx;
  vm.createContext(ctx);
  vm.runInContext(read('trips.js'), ctx);
  vm.runInContext(read('booking-parse.js'), ctx);
  return ctx;
}
const ex = (krw, paidBy, paidFor) => ({ id: 'e' + Math.random().toString(36).slice(2, 8), krw, amount: krw, currency: 'KRW', paidBy, paidFor });
const trip = (names, exps) => ({ members: names.map(n => ({ name: n })), expenses: exps });

await ok('멤버가 아닌 이름은 빼고 나눈다 — 9만 원이 사라지지 않음, 표와 송금 목록이 같은 기준', () => {
  const T = boot().TripStore;
  const t = trip(['나', '민수'], [ex(90000, '나', ['나', '민수', '철수'])]);
  assert.deepEqual(JSON.parse(JSON.stringify(T.settlements(t))), [{ from: '민수', to: '나', amt: 45000 }]);
  const b = T.balances(t);
  assert.equal(b.find(x => x.name === '민수').net, -45000);
  assert.equal(b.reduce((s, x) => s + x.net, 0), 0);
});

await ok('낸 사람이 멤버가 아니면 표·송금 목록 모두에서 빠진다', () => {
  const T = boot().TripStore;
  const t = trip(['나', '민수'], [ex(50000, '철수', ['나', '민수'])]);
  assert.equal(T.settlements(t).length, 0);
  assert.ok(T.balances(t).every(x => x.net === 0));
});

await ok('500원 이하 송금도 목록에 — 4명이 1,800원', () => {
  const T = boot().TripStore;
  const s = T.settlements(trip(['A', 'B', 'C', 'D'], [ex(1800, 'A', ['A', 'B', 'C', 'D'])]));
  assert.equal(s.length, 3); assert.ok(s.every(x => x.to === 'A' && x.amt === 450));
});

await ok('나눔 대상에 같은 사람이 두 번 있어도 한 번만', () => {
  const T = boot().TripStore;
  assert.deepEqual(JSON.parse(JSON.stringify(T.settlements(trip(['나', '민수'], [ex(30000, '나', ['나', '민수', '민수'])])))), [{ from: '민수', to: '나', amt: 15000 }]);
});

await ok('예시 여행은 처음 한 번만 — 다 지운 뒤(빈 목록)·깨진 저장값이면 다시 안 생김', () => {
  const c1 = boot(); c1.TripStore.seedIfEmpty(); assert.equal(c1.TripStore.all().length, 1);
  c1.TripStore.remove(c1.TripStore.all()[0].id); c1.TripStore.seedIfEmpty(); assert.equal(c1.TripStore.all().length, 0);
  const s2 = new Map([['tc_trips_v1', '[]']]); const c2 = boot({ store: s2 }); c2.TripStore.seedIfEmpty(); assert.equal(c2.TripStore.all().length, 0);
  const s3 = new Map([['tc_trips_v1', '{깨짐']]); const c3 = boot({ store: s3 }); c3.TripStore.seedIfEmpty(); assert.equal(s3.get('tc_trips_v1'), '{깨짐');
});

await ok('오프라인이면 오래된 캐시라도 마지막 환율을 쓴다(9월 고정값 아님)', async () => {
  const store = new Map([['tc_fx', JSON.stringify({ ts: Date.now() - 8 * 3600e3, rates: { JPY: 9.5 } })]]);
  const c = boot({ fetchOk: false, store });
  const r = await new Promise(res => c.TripStore.refreshRates(res));
  assert.equal(r, false);
  assert.equal(c.TripStore.RATES.JPY, 9.5);
  assert.equal(c.TripStore.fxState().cached, true);
});

await ok('예약 붙여넣기: 연말 출발·연초 귀국이면 귀국편은 다음 해', () => {
  const c = boot();
  const r = c.parseBooking('KE723 12월 29일 08:05 ICN KIX\nKE724 1월 3일 12:00 KIX ICN', { year: 2026, after: '2026-12-29' });
  assert.equal(JSON.stringify(r.flights.map(f => f.date)), JSON.stringify(['2026-12-29', '2027-01-03']));
  // 연초 여행에서 1월 날짜는 그대로
  assert.equal(c.parseBooking('KE724 1월 3일 12:00 KIX ICN', { year: 2026, after: '2026-01-02' }).flights[0].date, '2026-01-03');
});

console.log(`data_test: ${pass} passed`);
