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

await ok('일정 시간: 예전 자유 입력은 HH:MM 으로, 시각만으로 다 못 담는 말은 시간 메모(when)에 남긴다', () => {
  const store = new Map(), T = boot({ store }).TripStore;
  const cases = { '9:00': ['09:00', undefined], '오후 2시': ['14:00', undefined], '1330': ['13:30', undefined], '오전 중': ['', '오전 중'], '13:00~15:00': ['13:00', '13:00~15:00'], '13': ['', '13'] };
  store.set(T.KEY, JSON.stringify([{ id: 'a', start: '2026-12-01', end: '2026-12-01', days: [{ date: '2026-12-01', items: Object.keys(cases).map((k, i) => ({ id: 'i' + i, time: k, title: k })) }] }]));
  T.get('a').days[0].items.forEach(it => { const [tm, w] = cases[it.title]; assert.equal(it.time, tm, it.title); assert.equal(it.when, w, it.title); });
});
await ok('일정 시간 순 자리: 시간을 넣은 항목만 옮기고 시간 없는 항목 순서는 그대로', () => {
  const store = new Map(), T = boot({ store }).TripStore;
  store.set(T.KEY, JSON.stringify([{ id: 'a', start: '2026-12-01', end: '2026-12-01', days: [{ date: '2026-12-01', items: [
    { id: 'x1', time: '09:00', title: 'A' }, { id: 'x2', time: '', title: '메모' }, { id: 'x3', time: '15:00', title: 'C' }] }] }]));
  let t = T.addDayItem('a', 0, { time: '12:00', title: 'B' }); const nid = t.days[0].items[3].id;
  T.placeDayItem('a', 0, nid);
  assert.deepEqual(T.get('a').days[0].items.map(x => x.title), ['A', '메모', 'B', 'C']);
  t = T.addDayItem('a', 0, { time: '18:00', title: 'D' }); T.placeDayItem('a', 0, t.days[0].items[4].id);
  t = T.addDayItem('a', 0, { time: '', title: '시간 없음' }); T.placeDayItem('a', 0, t.days[0].items[5].id);
  assert.deepEqual(T.get('a').days[0].items.map(x => x.title), ['A', '메모', 'B', 'C', 'D', '시간 없음']);
});

await ok('지난 여행 씀씀이: 사람×일 평균, 여행 기간 밖 지출·3건 미만 여행은 뺀다', () => {
  const T = boot().TripStore;
  const e = (krw, category, date) => ({ krw, amount: krw, currency: 'KRW', category, date });
  const a = { id: 'a', city: '오사카', start: '2026-10-01', end: '2026-10-03', members: [{ name: '나' }, { name: '민수' }],
    expenses: [e(300000, 'food', '2026-10-01'), e(60000, 'cafe', '2026-10-02'), e(120000, 'transit', '2026-10-02'), e(900000, 'transit', '2026-08-01'), e(180000, 'shop', '2026-10-03')] };
  const b = { id: 'b', city: '도쿄', start: '2026-09-01', end: '2026-09-01', expenses: [e(50000, 'food', '2026-09-01'), e(10000, 'sight', '2026-09-01')] };
  const p = T.spendProfile([a, b]);
  assert.equal(p.trips.length, 1); assert.equal(p.personDays, 6);   // 3일 × 2명, b 는 2건이라 빠짐
  assert.equal(p.perDay.food, 50000); assert.equal(p.perDay.cafe, 10000);
  assert.equal(p.perDay.transit, 20000);   // 8월 미리 낸 90만 원(기간 밖)은 빠짐
  assert.equal(p.perDay.shop, 30000);
  assert.equal(p.stayPerNight, 0);   // 숙박 지출 없는 여행은 숙소 단가에 안 섞음
  const c = { id: 'c', city: '오사카', start: '2026-07-01', end: '2026-07-04', expenses: [e(270000, 'stay', '2026-05-01'), e(1, 'food', '2026-07-01'), e(1, 'food', '2026-07-02')] };
  assert.equal(T.spendProfile([a, c]).stayPerNight, 90000);   // 미리 낸 숙박(기간 밖 날짜)도 넣고 3박으로 나눔
});

await ok('견적 대비 실제: 항공+현지 교통은 교통 한 줄, 식비=식비+카페, 예비비는 합계에만', () => {
  const T = boot().TripStore;
  const t = { budget: { plan: { at: '2026-11-01', items: [{ key: 'flight', amt: 700000 }, { key: 'stay', amt: 390000 }, { key: 'food', amt: 560000 }, { key: 'transit', amt: 120000 }, { key: 'play', amt: 0 }, { key: 'buffer', amt: 177000 }] } },
    expenses: [{ krw: 750000, category: 'transit' }, { krw: 400000, category: 'stay' }, { krw: 300000, category: 'food' }, { krw: 50000, category: 'cafe' }, { krw: 30000, category: 'shop' }] };
  const v = T.planVsActual(t);
  const by = Object.fromEntries(v.rows.map(r => [r.label, r]));
  assert.equal(by['교통(항공 포함)'].plan, 820000); assert.equal(by['교통(항공 포함)'].diff, -70000);
  assert.equal(by['식비'].actual, 350000); assert.equal(by['식비'].diff, -210000);
  assert.equal(by['관광'], undefined);                 // 견적 0·실제 0 이면 줄 없음
  assert.equal(by['쇼핑·기타'].plan, 0); assert.equal(by['쇼핑·기타'].actual, 30000);
  assert.equal(v.plan, 1947000); assert.equal(v.actual, 1530000); assert.equal(v.diff, -417000);
  assert.equal(T.planVsActual({ budget: { total: 100 }, expenses: [] }), null);
});

await ok('영수증 금액 고르기: 합계 줄 우선, 소계·받은 돈·거스름·승인번호·날짜는 빼고, 통화 기호 인식', () => {
  const c = { window: {}, document: {} }; vm.createContext(c); vm.runInContext(read('receipt-ocr.js'), c);
  const P = c.window.ReceiptOCR.parse;   // 가게 이름도
  let r = P(['ローソン', '2026年11月16日 13:45', 'TEL 06-1234-5678', 'おにぎり ¥150', '小計 ¥310', '合計 ¥334', 'お預り ¥1,000', 'お釣り ¥666'].join('\n'), 'KRW');
  assert.equal(r.best, 334); assert.equal(r.cur, 'JPY'); assert.equal(r.shop, 'ローソン'); assert.equal(P(['ロー ソン 難波 店', '合計 ¥300'].join('\n'), 'JPY').shop, 'ローソン難波店'); assert.ok(!r.cands.includes(1000) && !r.cands.includes(666) && !r.cands.includes(310));
  r = P(['일란', '라멘 980', '합 계', '1,190'].join('\n'), 'JPY'); assert.equal(r.best, 1190);   // 합계 말과 숫자가 다른 줄
  r = P(['아메리카노 4,500', '합계 9,500', '승인번호 12345678'].join('\n'), 'KRW'); assert.equal(r.best, 9500); assert.ok(!r.cands.includes(12345678));
  r = P(['SUBTOTAL 6.28', 'TAX 0.55', 'TOTAL 6.83', 'CASH 10.00', 'CHANGE 3.17'].join('\n'), 'USD'); assert.equal(r.best, 6.83);
  r = P(['Pho bo 75.000', 'Tổng cộng: 85.000 đ'].join('\n'), 'VND'); assert.equal(r.best, 85000);
  r = P(['item 120', 'item 340'].join('\n'), 'JPY'); assert.equal(r.best, null); assert.deepEqual([...r.cands], [340, 120]);
});

console.log(`data_test: ${pass} passed`);
