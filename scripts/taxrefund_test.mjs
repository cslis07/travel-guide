// 택스리펀 회귀 테스트 — 브라우저 없이 실제 trips.js + tax-refund.js 계산부를 검증
//   node scripts/taxrefund_test.mjs
import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const read = f => fs.readFileSync(new URL('../' + f, import.meta.url), 'utf8');
let pass = 0;
const ok = (name, fn) => { fn(); pass++; console.log('  ✓ ' + name); };

const store = new Map();
const ctx = {
  console, Date, Math, JSON, Intl,
  localStorage: { getItem: k => (store.has(k) ? store.get(k) : null), setItem: (k, v) => store.set(k, String(v)), removeItem: k => store.delete(k) }
};
ctx.window = ctx;
vm.createContext(ctx);
vm.runInContext(read('trips.js'), ctx);
vm.runInContext(read('tax-refund.js'), ctx);
const R = ctx.TaxRefund;
assert.ok(R && ctx.TripStore, 'TaxRefund·TripStore 로드');

const RATES = { KRW: 1, JPY: 9, CNY: 200, TWD: 42, THB: 40, VND: 0.05, IDR: 0.085, SGD: 1000, PHP: 24, EUR: 1500, HKD: 175, MYR: 320, USD: 1400 };
let n = 0;
const ex = (amount, cur, memo, o = {}) => ({ id: 'e' + (++n), amount, currency: cur, krw: Math.round(amount * RATES[cur]), category: 'shop', date: '2026-11-21', memo, paidBy: '나', paidFor: ['나'], ...o });

ok('나라별 기준 금액이 공식 자료와 같다', () => {
  const r = R.RULES;
  assert.equal(r.jp.min, 5000); assert.equal(r.jp.taxIn, 1.1);
  assert.equal(r.cn.min, 200); assert.equal(r.tw.min, 2000); assert.equal(r.th.min, 2000);
  assert.equal(r.vn.min, 2000000); assert.equal(r.sg.min, 100); assert.equal(r.ph.min, 3000); assert.equal(r.fr.min, 100.01);
  assert.ok(r.hk.none && r.my.none);
  assert.ok(r.id.perReceipt && r.ph.perReceipt && !r.jp.perReceipt);
  for (const k of Object.keys(r)) if (!r[k].none) assert.match(r[k].src[1], /^https:\/\//, k);
});

ok('일본: 세금 뺀 ¥5,000 — 세금 포함 ¥5,500부터', () => {
  assert.equal(R.calc({ city: '오사카', expenses: [ex(5499, 'JPY', '돈키호테')] }, RATES).ok.length, 0);
  assert.equal(R.calc({ city: '오사카', expenses: [ex(5500, 'JPY', '돈키호테')] }, RATES).ok.length, 1);
});

ok('같은 가게(메모)·같은 날은 합치고, 날이 다르거나 메모가 없으면 따로', () => {
  const d = R.calc({ city: '도쿄', expenses: [
    ex(3000, 'JPY', '돈키호테'), ex(3000, 'JPY', ' 돈키 호테 '),            // 같은 가게(공백 무시) → ¥6,000
    ex(3000, 'JPY', '돈키호테', { date: '2026-11-22' }),                     // 다른 날 → 따로
    ex(3000, 'JPY', ''), ex(3000, 'JPY', '')                                  // 메모 없음 → 합치지 않음
  ] }, RATES);
  assert.equal(d.groups.length, 4);
  assert.equal(d.ok.length, 1); assert.equal(d.ok[0].amt, 6000); assert.equal(d.ok[0].ids.length, 2);
  assert.equal(d.tripOk, true);
});

ok('쇼핑만 센다', () => {
  assert.equal(R.calc({ city: '방콕', expenses: [{ ...ex(9000, 'THB', '호텔'), category: 'stay' }] }, RATES).groups.length, 0);
});

ok('원화로 적은 쇼핑은 현지 통화로 바꿔 판단', () => {
  assert.equal(R.calc({ city: '타이베이', expenses: [ex(84000, 'KRW', '성품서점')] }, RATES).ok.length, 1);   // ₩84,000 / 42 = NT$2,000
  assert.equal(R.calc({ city: '타이베이', expenses: [ex(80000, 'KRW', '성품서점')] }, RATES).ok.length, 0);
});

ok('필리핀은 영수증 한 장씩 — 같은 가게라도 합치지 않음', () => {
  const d = R.calc({ city: '세부', expenses: [ex(2000, 'PHP', 'SM몰'), ex(2000, 'PHP', 'SM몰'), ex(3000, 'PHP', 'SM몰')] }, RATES);
  assert.equal(d.groups.length, 3); assert.equal(d.ok.length, 1);
});

ok('인도네시아는 영수증 기준 + 여행 합계 기준', () => {
  const few = R.calc({ city: '발리', expenses: [ex(600000, 'IDR', '가게A'), ex(600000, 'IDR', '가게B')] }, RATES);
  assert.equal(few.ok.length, 2); assert.equal(few.tripOk, false);
  const lots = R.calc({ city: '발리', expenses: [ex(3000000, 'IDR', '가게A'), ex(2100000, 'IDR', '가게B'), ex(400000, 'IDR', '가게C')] }, RATES);
  assert.equal(lots.ok.length, 2); assert.equal(lots.tripOk, true);
});

ok('프랑스 €100.01 — 딱 €100은 안 됨', () => {
  assert.equal(R.calc({ city: '파리', expenses: [ex(100, 'EUR', '약국')] }, RATES).ok.length, 0);
  assert.equal(R.calc({ city: '파리', expenses: [ex(100.01, 'EUR', '약국')] }, RATES).ok.length, 1);
});

ok('홍콩·말레이시아는 제도 없음, 국내·모르는 도시는 null', () => {
  assert.ok(R.calc({ city: '홍콩', expenses: [ex(5000, 'HKD', '시계')] }, RATES).rule.none);
  assert.ok(R.calc({ city: '코타키나발루', expenses: [] }, RATES).rule.none);
  assert.equal(R.calc({ city: '제주', expenses: [ex(500000, 'KRW', '기념품')] }, RATES), null);
  assert.equal(R.calc({ city: '어딘가', expenses: [] }, RATES), null);
});

ok('지출 입력 창: 금액 하나로 기준을 넘는지(다른 통화도 환산)', () => {
  assert.equal(R.hits({ city: '방콕' }, 2000, 'THB', RATES).ok, true);
  assert.equal(R.hits({ city: '방콕' }, 1999, 'THB', RATES).ok, false);
  assert.equal(R.hits({ city: '방콕' }, 80000, 'KRW', RATES).ok, true);   // ₩80,000 = ฿2,000
  assert.equal(R.hits({ city: '홍콩' }, 9999, 'HKD', RATES), null);
  assert.equal(R.hits({ city: '부산' }, 9999, 'KRW', RATES), null);
});

console.log(`taxrefund_test: ${pass} passed`);
