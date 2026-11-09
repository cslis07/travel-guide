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

await ok('불균등 나눔: 비율 2:1, 금액 지정 — 원화 합계가 정확히 맞는다', () => {
  const T = boot().TripStore;
  const r = T.sharesOf({ krw: 90000, paidBy: '나', paidFor: ['나', '민수'], split: { mode: 'ratio', v: { '나': 2, '민수': 1 } } }, ['나', '민수']);
  assert.equal(Math.round(r['나']), 60000); assert.equal(Math.round(r['민수']), 30000);
  const a = T.sharesOf({ krw: 10000, amount: 1000, paidBy: '나', paidFor: ['나', '민수'], split: { mode: 'amt', v: { '나': 700, '민수': 300 } } }, ['나', '민수']);
  assert.equal(Math.round(a['나']), 7000); assert.equal(Math.round(a['민수']), 3000);
  const z = T.sharesOf({ krw: 9000, paidBy: '나', paidFor: ['나', '민수', '철수'], split: { mode: 'ratio', v: {} } }, ['나', '민수', '철수']);
  assert.equal(Math.round(z['철수']), 3000);   // 비율이 비어 있으면 똑같이
  const s = T.settlements({ members: [{ name: '나' }, { name: '민수' }], expenses: [{ krw: 90000, paidBy: '나', paidFor: ['나', '민수'], split: { mode: 'ratio', v: { '나': 2, '민수': 1 } } }] });
  assert.equal(JSON.stringify(s), JSON.stringify([{ from: '민수', to: '나', amt: 30000 }]));
});

await ok('송금 완료 기록: 일부 보내면 남은 것만, 다 보내면 정산 끝(done)', () => {
  const T = boot().TripStore;
  const t = { members: [{ name: '나' }, { name: '민수' }, { name: '지수' }], expenses: [ex(90000, '나', ['나', '민수', '지수'])], payments: [] };
  assert.equal(T.settleState(t), 'open'); assert.equal(T.settlements(t).length, 2);
  t.payments.push({ from: '민수', to: '나', krw: 30000 });
  assert.equal(JSON.stringify(T.settlements(t)), JSON.stringify([{ from: '지수', to: '나', amt: 30000 }]));
  assert.equal(T.balances(t).find(b => b.name === '민수').net, 0);
  t.payments.push({ from: '지수', to: '나', krw: 30000 });
  assert.equal(T.settlements(t).length, 0); assert.equal(T.settleState(t), 'done');
  assert.equal(T.settleState({ members: [{ name: '나' }, { name: '민수' }], expenses: [ex(1000, '나', ['나'])] }), 'even');
});

await ok('여러 날 몫: 숙박 30만 원 3박 → 날짜별 10만 원씩, 총액은 그대로', () => {
  const T = boot().TripStore;
  const t = { expenses: [{ krw: 300001, date: '2026-12-29', spanDays: 3 }, { krw: 5000, date: '2026-12-30' }] };
  const d = T.dayTotals(t);
  assert.equal(d['2026-12-29'], 100000); assert.equal(d['2026-12-30'], 105000); assert.equal(d['2026-12-31'], 100001);
  assert.equal(T.spent(t), 305001);
});

await ok('저장값 정리: 이상한 송금 기록은 버린다', () => {
  const store = new Map([['tc_trips_v1', JSON.stringify([{ id: 't1', city: '오사카', start: '2026-12-01', end: '2026-12-02', members: [{ name: '나' }], payments: [{ id: 'p1', from: '나', to: '민수', krw: 1000 }, { id: 'p2', from: '', to: 'x', krw: 5 }, { id: 'p3', from: 'a', to: 'b', krw: -3 }, 'x'] }])]]);
  const T = boot({ store }).TripStore;
  assert.equal(T.all()[0].payments.length, 1);
});

// 2026-11-09 2차 점검 T2·T4·T7
await ok('되살리기: 정산 기능 전 백업(payments 없음·키 순서 다름)도 같은 여행으로 본다', () => {
  const saved = { id: 't1', city: '오사카', start: '2026-12-01', end: '2026-12-03', members: [{ name: '나' }], expenses: [{ id: 'e1', krw: 1000, amount: 1000, currency: 'KRW' }] };
  const store = new Map([['tc_trips_v1', JSON.stringify([saved])]]);
  const T = boot({ store }).TripStore;
  const cur = T.all()[0];   // 정리를 거쳐 payments:[] 등이 붙은 값
  const old = { city: '오사카', id: 't1', end: '2026-12-03', start: '2026-12-01', expenses: [{ currency: 'KRW', amount: 1000, krw: 1000, id: 'e1' }], members: [{ name: '나' }] };
  assert.equal(JSON.stringify(cur) === JSON.stringify(old), false);   // 예전 비교 방식은 다르다고 봤다
  assert.equal(T.sameTrip(cur, old), true);
  assert.equal(T.sameTrip(cur, { ...old, expenses: [{ ...old.expenses[0], krw: 2000 }] }), false);
  assert.equal(JSON.stringify(old.expenses[0]), '{"currency":"KRW","amount":1000,"krw":1000,"id":"e1"}');   // 비교가 원본을 바꾸지 않음
});
await ok('여러 날 몫이 여행 끝을 넘으면 넘친 몫은 마지막 날에 — 날짜별 합 = 총액', () => {
  const T = boot().TripStore;
  const t = { start: '2026-12-01', end: '2026-12-03', expenses: [{ krw: 300000, date: '2026-12-03', spanDays: 3 }, { krw: 9000, date: '2026-12-10', spanDays: 3 }] };
  const d = T.dayTotals(t);
  assert.equal(d['2026-12-03'], 300000); assert.equal(d['2026-12-04'], undefined);
  assert.equal(d['2026-12-11'], 3000);   // 여행 밖 날짜 지출은 그대로 나눔
});
await ok('지출을 다 지워도 주고받은 기록이 있으면 정산 상태가 none 이 아니다', () => {
  const T = boot().TripStore;
  const t = { members: [{ name: '나' }, { name: '민수' }], expenses: [], payments: [{ from: '민수', to: '나', krw: 5000 }] };
  assert.notEqual(T.settleState(t), 'none');
  assert.equal(T.settleState({ members: t.members, expenses: [], payments: [] }), 'none');
});

console.log(`data_test: ${pass} passed`);
