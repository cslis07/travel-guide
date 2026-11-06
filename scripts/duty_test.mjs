// 입국 면세 한도 회귀 테스트 — 브라우저 없이 실제 trips.js + duty-free.js 계산부를 검증
//   node scripts/duty_test.mjs
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
vm.runInContext(read('duty-free.js'), ctx);
const D = ctx.DutyFree;
assert.ok(D && ctx.TripStore, 'DutyFree·TripStore 로드');

const R = 1400;   // 계산용 고정 환율(1달러=1,400원)
const ex = (id, krw, memo, o = {}) => ({ id, krw, amount: krw, currency: 'KRW', category: 'shop', paidBy: '나', paidFor: ['나'], date: '2026-11-21', memo, ...o });

ok('한도 값이 법령(관세법 시행규칙 제48조)과 같다', () => {
  assert.equal(D.LIMITS.gen, 800); assert.equal(D.LIMITS.alcUsd, 400); assert.equal(D.LIMITS.alcL, 2);
  assert.equal(D.LIMITS.perfMl, 100); assert.equal(D.LIMITS.cig, 200);
});

ok('메모로 술·향수·담배 알아보기', () => {
  assert.equal(D.guessKind('야마자키 위스키'), 'alc');
  assert.equal(D.guessKind('와인 2병'), 'alc');
  assert.equal(D.guessKind('샤넬 향수 50ml'), 'perf');
  assert.equal(D.guessKind('Dior EDP'), 'perf');
  assert.equal(D.guessKind('면세점 담배 1보루'), 'tob');
  assert.equal(D.guessKind('돈키호테'), 'gen');
  assert.equal(D.guessKind(''), 'gen');
});

ok('쇼핑만 세고, 술·향수는 800달러에서 뺀다', () => {
  const t = { city: '오사카', members: [], expenses: [
    ex('a', 560000, '가방'), ex('b', 280000, '위스키'), ex('c', 140000, '향수'),
    { ...ex('d', 999999, '라멘'), category: 'food' }
  ] };
  const d = D.calc(t, R), p = d.me;
  assert.equal(p.gen, 400); assert.equal(p.alc, 200); assert.equal(p.perf, 100);
  assert.equal(p.status, 'ok'); assert.equal(p.left, 400);
  assert.equal(d.items.length, 3);
});

ok('80% 이상은 warn, 넘으면 over', () => {
  assert.equal(D.calc({ city: '도쿄', expenses: [ex('a', 1120000, '시계')] }, R).me.status, 'warn');      // $800 → 딱 한도: 넘지 않음
  assert.equal(D.calc({ city: '도쿄', expenses: [ex('a', 1120000, '시계')] }, R).me.left, 0);
  assert.equal(D.calc({ city: '도쿄', expenses: [ex('a', 896000, '시계')] }, R).me.status, 'warn');       // $640 = 80%
  assert.equal(D.calc({ city: '도쿄', expenses: [ex('a', 840000, '시계')] }, R).me.status, 'ok');         // $600
  const o = D.calc({ city: '도쿄', expenses: [ex('a', 1400000, '시계')] }, R).me;
  assert.equal(o.status, 'over'); assert.equal(o.left, -200);
});

ok('술 400달러 넘으면 alcOver', () => {
  assert.equal(D.calc({ city: '도쿄', expenses: [ex('a', 700000, '사케')] }, R).me.alcOver, true);
  assert.equal(D.calc({ city: '도쿄', expenses: [ex('a', 560000, '사케')] }, R).me.alcOver, false);
});

ok('사람별로 나누고, 나눠 낸 쇼핑은 인원수로 똑같이', () => {
  const t = { city: '방콕', members: [{ name: '나' }, { name: '민수' }], expenses: [
    ex('a', 1400000, '가방', { paidFor: ['민수'] }), ex('b', 280000, '기념품', { paidFor: ['나', '민수'] })
  ] };
  const d = D.calc(t, R);
  assert.equal(d.me.name, '나'); assert.equal(d.me.gen, 100);
  const m = d.people.find(x => x.name === '민수');
  assert.equal(m.gen, 1100); assert.equal(m.status, 'over');
});

ok('사용자가 고친 분류가 우선 — 빼기(out)는 한도에서 빠진다', () => {
  const t = { city: '도쿄', duty: { kinds: { a: 'out', b: 'gen' } }, expenses: [ex('a', 1400000, '화장품 바로 씀'), ex('b', 140000, '와인잔')] };
  const d = D.calc(t, R);
  assert.equal(d.me.gen, 100); assert.equal(d.me.out, 1000); assert.equal(d.me.alc, 0);
  assert.equal(d.items.find(i => i.id === 'b').guessed, false);
});

ok('달러로 쓴 지출은 금액 그대로', () => {
  const d = D.calc({ city: '괌', expenses: [ex('a', 1500000, '옷', { currency: 'USD', amount: 1000 })] }, R);
  assert.equal(d.me.gen, 1000);
});

ok('국내 여행은 안 보이고, 모르는 도시는 외화 지출로 판단', () => {
  assert.equal(D.isAbroad({ city: '제주', expenses: [] }), false);
  assert.equal(D.isAbroad({ city: '오사카', expenses: [] }), true);
  assert.equal(D.isAbroad({ city: '어딘가', expenses: [ex('a', 1000, 'x')] }), false);
  assert.equal(D.isAbroad({ city: '어딘가', expenses: [ex('a', 1000, 'x', { currency: 'EUR' })] }), true);
});

ok('비율로 나눈 쇼핑은 면세 한도도 그 비율대로', () => {
  const t = { city: '방콕', members: [{ name: '나' }, { name: '민수' }], expenses: [ex('a', 420000, '가방', { paidFor: ['나', '민수'], split: { mode: 'ratio', v: { '나': 2, '민수': 1 } } })] };
  const d = D.calc(t, R);
  assert.equal(d.me.gen, 200); assert.equal(d.people.find(x => x.name === '민수').gen, 100);
});

console.log(`duty_test: ${pass} passed`);
