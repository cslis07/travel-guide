// 예약 메일 붙여넣기 파서 고정 샘플 테스트 — 형식이 바뀌어 '0건으로 조용히 통과'하는 것을 막는다.
//   node scripts/parse_test.mjs        (smoke_test.mjs와 따로, 네트워크 없이 돈다)
import fs from 'node:fs';
import '../booking-parse.js';

const cases = JSON.parse(fs.readFileSync(new URL('./fixtures/booking.json', import.meta.url), 'utf8'));
let fail = 0;
for (const c of cases) {
  const got = globalThis.parseBooking(c.text, { year: c.year || 2026 });
  const errs = [];
  for (const k of ['flights', 'hotels']) {
    const exp = c.expect[k];
    if (!exp) continue;
    if ((got[k] || []).length !== exp.length) { errs.push(`${k} ${(got[k] || []).length}건 (기대 ${exp.length}건)`); continue; }
    exp.forEach((e, i) => { for (const f in e) if (got[k][i][f] !== e[f]) errs.push(`${k}[${i}].${f} = ${JSON.stringify(got[k][i][f])} (기대 ${JSON.stringify(e[f])})`); });
  }
  for (const r of c.expect.refs || []) if (!(got.refs || []).includes(r)) errs.push(`예약번호 ${r} 없음 (${JSON.stringify(got.refs)})`);
  console.log((errs.length ? 'FAIL ' : 'PASS ') + c.name + (errs.length ? ' — ' + errs.join(' / ') : ''));
  if (errs.length) fail++;
}
console.log(`${cases.length - fail}/${cases.length}`);
process.exit(fail ? 1 : 0);
