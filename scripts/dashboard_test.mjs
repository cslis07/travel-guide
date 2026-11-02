// 여행 대시보드 회귀 테스트 — 브라우저·네트워크 없이 실제 trips.js + dashboard.js 계산부를 검증
//   node scripts/dashboard_test.mjs
import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const read = f => fs.readFileSync(new URL('../' + f, import.meta.url), 'utf8');
const html = read('dashboard.html'), css = read('dashboard.css');
let pass = 0;
const ok = (name, fn) => { fn(); pass++; console.log('  ✓ ' + name); };

ok('마크업: 카드 3개·여행 선택·라벨 연결', () => {
  for (const id of ['db-trip', 'db-budget', 'db-air', 'db-trip-select', 'db-dest']) assert.ok(html.includes(`id="${id}"`), id);
  assert.ok(html.includes('<label for="db-trip-select">'));
  assert.ok(html.includes('class="db-skip"'));
});
ok('스타일: 다크 모드·폴드·동작 줄이기 대응', () => {
  for (const q of ['prefers-color-scheme:dark', 'max-width:360px', 'max-width:680px', 'prefers-reduced-motion']) assert.ok(css.includes(q), q);
});

// 실제 trips.js 와 dashboard.js 를 같은 가짜 window 에 올린다
const store = new Map();
const ctx = {
  console, Date, Math, JSON, Intl,
  localStorage: { getItem: k => (store.has(k) ? store.get(k) : null), setItem: (k, v) => store.set(k, String(v)), removeItem: k => store.delete(k) },
  document: undefined
};
ctx.window = ctx;
vm.createContext(ctx);
vm.runInContext(read('trips.js'), ctx);
vm.runInContext(read('dashboard.js'), ctx);
const T = ctx.TripStore, D = ctx.TCDashCore;
assert.ok(T && D, 'TripStore·TCDashCore 로드');

ok('기본 여행: 저장한 선택 → 다가오는 여행 → 지난 여행', () => {
  const trips = [{ id: 'a', start: '2026-09-01', end: '2026-09-04' }, { id: 'b', start: '2026-12-01', end: '2026-12-03' }, { id: 'c', start: '2026-11-20', end: '2026-11-23' }];
  assert.equal(D.pickDefault(trips, '2026-11-02', '').id, 'c');
  assert.equal(D.pickDefault(trips, '2026-11-02', 'b').id, 'b');
  assert.equal(D.pickDefault(trips, '2026-11-02', 'zzz').id, 'c');
  assert.equal(D.pickDefault([trips[0]], '2026-11-02', '').id, 'a');
  assert.equal(D.pickDefault([], '2026-11-02', ''), null);
});

ok('준비 진행률: 항공·숙소·일정·준비물 평균', () => {
  const t = { start: '2026-11-20', end: '2026-11-23', days: [{ items: [1] }, { items: [] }, { items: [1] }, { items: [] }],
    reservations: [{ type: 'flight', status: 'confirmed' }, { type: 'hotel', status: 'planned' }],
    checklist: [{ done: true }, { done: false }, { done: false }, { done: true }] };
  const r = D.readiness(t);
  // (1 + 0.5 + 2/4 + 2/4) / 4 = 62.5 → 63
  assert.equal(r.pct, 63);
  assert.equal(r.flight, 'confirmed'); assert.equal(r.stay, 'planned');
  assert.equal(r.planDays, 2); assert.equal(r.totalDays, 4); assert.equal(r.done, 2); assert.equal(r.total, 4);
  assert.equal(D.readiness({}).pct, 0);
  assert.equal(D.readiness({ flight: { no: 'KE1' } }).pct, 13);   // 편명만 저장 = 항공 0.5
});

ok('예상 여행비: 경비 계산 예상액(plan)을 그대로, 합계는 총예산', () => {
  const t = { budget: { total: 1000000, plan: { at: '2026-11-02', items: [
    { key: 'flight', label: '항공권', color: '#1B4FD8', amt: 400000 }, { key: 'stay', label: '숙소', color: '#F97316', amt: 300000 },
    { key: 'food', label: '식비', color: '#039855', amt: 200000 }, { key: 'buffer', label: '예비비', color: '#98A2B3', amt: 100000 }, { key: 'shop', label: '쇼핑', amt: 0 }] } },
    expenses: [{ krw: 250000, category: 'food' }] };
  const m = D.budgetModel(t, T.CATS);
  assert.equal(m.source, 'plan');
  assert.deepEqual(Array.from(m.rows, x => x.label), ['항공권', '숙소', '식비', '예비비']);   // 0원 항목 제외
  assert.deepEqual(Array.from(m.rows, x => x.pct), [40, 30, 20, 10]);
  assert.equal(m.spent, 250000); assert.equal(m.left, 750000); assert.equal(m.spentPct, 25);
});

ok('예상 여행비: 항목 한도(catLimits) + 미배정 예산', () => {
  const m = D.budgetModel({ budget: { total: 1000000, catLimits: { food: 300000, stay: 500000 } }, expenses: [] }, T.CATS);
  assert.equal(m.source, 'limits');
  assert.deepEqual(Array.from(m.rows, x => [x.label, x.amt]), [['숙박', 500000], ['식비', 300000], ['항목 미배정', 200000]]);
});

ok('예상 여행비: 항목 내역이 없으면 가짜 비율 대신 총예산 대비 지출만', () => {
  const m = D.budgetModel({ budget: { total: 1000000 }, expenses: [{ krw: 300000, category: 'food' }, { krw: 100000, category: 'stay' }] }, T.CATS);
  assert.equal(m.source, 'usage');
  assert.deepEqual(Array.from(m.rows, x => [x.label, x.amt]), [['실제 지출', 400000], ['남은 예산', 600000]]);
  const over = D.budgetModel({ budget: { total: 100000 }, expenses: [{ krw: 150000, category: 'food' }] }, T.CATS);
  assert.equal(over.left, -50000); assert.equal(over.rows.length, 1); assert.equal(over.rows[0].amt, 100000);
  const none = D.budgetModel({ budget: { total: 0 }, expenses: [] }, T.CATS);
  assert.equal(none.source, 'none'); assert.equal(none.rows.length, 0);
  const actual = D.budgetModel({ expenses: [{ krw: 5000, category: 'food' }] }, T.CATS);
  assert.equal(actual.source, 'actual');
});

ok('항공편: 여행 → 오는 편 → 인천 내 편명 순서', () => {
  assert.equal(D.storedFlight({ flight: { no: 'KE723', from: 'ICN', date: '2026-11-20' } }, []).no, 'KE723');
  assert.equal(D.storedFlight({ flightBack: { no: 'KE724' } }, []).no, 'KE724');
  const fav = D.storedFlight({}, [{ flightId: 'OZ111', dir: 'arr' }, { flightId: '7C1301', dir: 'dep' }]);
  assert.equal(fav.no, '7C1301'); assert.equal(fav.origin, 'fav');
  assert.equal(D.storedFlight({}, []), null);
});

ok('실시간 조회 조건: 인천 출발 + 오늘만', () => {
  assert.equal(D.liveEligibility({ no: 'KE1', from: 'ICN', date: '2026-11-02' }, '2026-11-02'), 'ok');
  assert.equal(D.liveEligibility({ no: 'KE1', from: 'ICN', date: '2026-11-03' }, '2026-11-02'), 'notToday');   // 운항표는 오늘분만
  assert.equal(D.liveEligibility({ no: 'KE1', from: 'ICN', date: '2026-11-20' }, '2026-11-02'), 'notToday');
  assert.equal(D.liveEligibility({ no: 'KE1', from: 'ICN', date: '2026-10-30' }, '2026-11-02'), 'notToday');
  assert.equal(D.liveEligibility({ no: 'KE2', from: 'KIX' }, '2026-11-02'), 'notIcn');
  assert.equal(D.liveEligibility({ no: 'KE3', from: '' }, '2026-11-02'), 'ok');
});

ok('실시간 매칭: 편명 정규화 + 날짜 일치만, 응답 모양 3가지', () => {
  // 실제 운항표는 HHmm(오늘분)만 준다 — 날짜가 붙은 응답이 오면 날짜까지 맞춰 본다
  assert.equal(D.matchLive([{ flightId: 'KE723', scheduleDateTime: '0850', terminalId: 'P03' }], { no: 'KE723', date: '2026-11-02' }).terminalId, 'P03');
  const items = [{ flightId: 'KE 723', scheduleDateTime: '202611021005' }, { flightId: 'KE723', scheduleDateTime: '202611031005', gatenumber: '244' }];
  assert.equal(D.matchLive(items, { no: 'ke723', date: '2026-11-03' }).gatenumber, '244');
  assert.equal(D.matchLive(items, { no: 'KE723', date: '2026-11-05' }), null);
  assert.equal(D.matchLive(items, { no: 'KE723', date: '' }).scheduleDateTime, '202611021005');
  assert.equal(D.liveItems({ response: { body: { items: { item: { flightId: 'A' } } } } }).length, 1);
  assert.equal(D.liveItems({ response: { body: { items: [{}, {}] } } }).length, 2);
  assert.equal(D.liveItems(null).length, 0);
  assert.equal(D.remarkClass('지연'), 'is-delay'); assert.equal(D.remarkClass('결항'), 'is-bad'); assert.equal(D.remarkClass('탑승중'), 'is-ok');
});

ok('금액 축약 표기', () => {
  assert.equal(D.manwon(1240000), '124만원');
  assert.equal(D.manwon(35000), '3.5만원');
  assert.equal(D.manwon(9000), '9,000원');
});

ok('체크리스트 토글이 같은 저장소(tc_trips_v1)에 기록됨 — 여행 상세와 공유', () => {
  const t = T.create({ city: '오사카', start: '2026-11-20', end: '2026-11-23' });
  T.addChecklistItem(t.id, { group: '서류', text: '여권' });
  const cid = T.get(t.id).checklist[0].id;
  T.toggleChecklist(t.id, cid);
  const saved = JSON.parse(store.get('tc_trips_v1')).find(x => x.id === t.id);
  assert.equal(saved.checklist[0].done, true);
});

console.log(`\n대시보드 테스트 ${pass}개 통과`);
