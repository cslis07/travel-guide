#!/usr/bin/env node
// 프로덕션 스모크 테스트 — 핵심 페이지·API·자산이 살아있는지 점검
//   node scripts/smoke_test.mjs
//   node scripts/smoke_test.mjs https://내-배포-url

const BASE = process.argv[2] || 'https://travel-guide-cslis07.vercel.app';

const checks = [
  // [경로, 기대 상태, 응답에 포함되어야 할 문자열(선택)]
  ['/', 200, '트립가이드'],
  ['/airport', 200, 'ICN'],
  ['/tours', 200, 'tt-tabs'],
  ['/mytrip', 200, '내 여행'],
  ['/guide', 200, 'sidebar'],
  ['/osaka', 200, '오사카'],
  ['/fukuoka', 200, '하카타'],
  ['/tokyo', 200, '시부야'],
  ['/kyoto', 200, '교토'],
  ['/bangkok', 200, '방콕'],
  ['/danang', 200, '다낭'],
  ['/bali', 200, '발리'],
  ['/singapore', 200, '싱가포르'],
  ['/jeju', 200, '제주'],
  ['/busan', 200, '부산'],
  ['/gangneung', 200, '강릉'],
  ['/paris', 200, '파리'],
  ['/privacy', 200, '개인정보'],
  ['/terms', 200, '이용약관'],
  ['/manifest.webmanifest', 200, 'icons'],
  ['/sitemap.xml', 200, 'urlset'],
  ['/robots.txt', 200, 'Sitemap'],
  ['/og-image.png', 200, null],
  ['/favicon.ico', 200, null],
];

// API 프록시 (POST/GET)
const apiChecks = [
  ['GET', '/api/tour?path=areaBasedList2&numOfRows=1&pageNo=1&areaCode=39', null, 'response'],
  ['POST', '/api/mrt', { tool: 'getCurrentTime', arguments: {} }, 'ok'],
];

let pass = 0, fail = 0;
const fails = [];

async function get(path) {
  const res = await fetch(BASE + path, { headers: { 'User-Agent': 'smoke-test' } });
  const text = await res.text();
  return { status: res.status, text };
}

async function run() {
  console.log(`\n스모크 테스트 → ${BASE}\n`);

  for (const [path, wantStatus, contains] of checks) {
    try {
      const { status, text } = await get(path);
      const okStatus = status === wantStatus;
      const okBody = !contains || text.includes(contains);
      if (okStatus && okBody) { pass++; console.log(`  ✅ ${path} (${status})`); }
      else { fail++; fails.push(path); console.log(`  ❌ ${path} — status ${status}${contains && !okBody ? `, "${contains}" 없음` : ''}`); }
    } catch (e) { fail++; fails.push(path); console.log(`  ❌ ${path} — ${e.message}`); }
  }

  console.log('');
  for (const [method, path, body, contains] of apiChecks) {
    try {
      const opts = method === 'POST'
        ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }
        : {};
      const res = await fetch(BASE + path, opts);
      const text = await res.text();
      const ok = res.status === 200 && (!contains || text.includes(contains));
      if (ok) { pass++; console.log(`  ✅ ${method} ${path.split('?')[0]} (200)`); }
      else { fail++; fails.push(path); console.log(`  ❌ ${method} ${path.split('?')[0]} — status ${res.status}`); }
    } catch (e) { fail++; fails.push(path); console.log(`  ❌ ${method} ${path} — ${e.message}`); }
  }

  console.log(`\n결과: ${pass} 통과 / ${fail} 실패`);
  if (fail > 0) { console.log('실패:', fails.join(', ')); process.exit(1); }
  console.log('전체 통과 ✓');
}

run();
