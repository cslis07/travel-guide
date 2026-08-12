#!/usr/bin/env node
/* ═══════════════════════════════════════════════════════════
   도메인 일괄 교체

   왜 필요한가
   정식 도메인이 canonical·og:url·og:image·JSON-LD·sitemap·robots 에
   **106곳** 하드코딩돼 있다. 손으로 바꾸면 반드시 몇 개를 빠뜨리고,
   빠뜨린 canonical 하나가 검색엔진에 중복 콘텐츠로 잡힌다.

   사용법
     node scripts/set-domain.mjs tripguide.co.kr        # 교체
     node scripts/set-domain.mjs tripguide.co.kr --dry  # 미리보기

   교체 후 site.config.json 의 domain 이 자동으로 갱신되므로
   다음번에도 같은 명령이 그대로 동작한다.
   ═══════════════════════════════════════════════════════════ */
import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { join, extname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(fileURLToPath(new URL('.', import.meta.url)), '..');
const CONFIG = join(ROOT, 'site.config.json');

const EXTS = new Set(['.html', '.xml', '.txt', '.mjs', '.js', '.json', '.webmanifest', '.md']);
const SKIP_DIRS = new Set(['node_modules', '.git', '.vercel', 'icons']);
const SKIP_FILES = new Set(['site.config.json']);

const arg = process.argv[2];
const dry = process.argv.includes('--dry');
const force = process.argv.includes('--force');

if (!arg || arg.startsWith('--')) {
  console.error('사용법: node scripts/set-domain.mjs <새도메인> [--dry]');
  console.error('예:     node scripts/set-domain.mjs tripguide.co.kr');
  process.exit(1);
}

/* 입력 정규화 — https:// 나 끝 슬래시를 붙여 와도 받아준다 */
const next = arg.replace(/^https?:\/\//, '').replace(/\/+$/, '').trim().toLowerCase();
if (!/^[a-z0-9.-]+\.[a-z]{2,}$/.test(next)) {
  console.error(`도메인 형식이 아닙니다: ${next}`);
  process.exit(1);
}

const cfg = JSON.parse(readFileSync(CONFIG, 'utf8'));
const prev = cfg.domain;

if (prev === next) {
  console.log(`이미 ${next} 입니다. 바꿀 것이 없습니다.`);
  process.exit(0);
}

/* ── 전환 전 확인 ────────────────────────────────────────────
   아직 서비스되지 않는 도메인으로 바꾸면 canonical·og:url·sitemap 이
   **전부 죽은 주소를 가리킨다.** 검색엔진 입장에서는 아무것도 안 한 것보다 나쁘다.
   그래서 실제 응답을 확인하고, 우리 사이트가 맞는지까지 본 뒤에만 진행한다.
   (DNS 전파 중이라 확실히 아는데 급할 때만 --force) */
async function preflight(domain) {
  const url = `https://${domain}/`;
  let res;
  try {
    const ac = new AbortController();
    const timer = setTimeout(() => ac.abort(), 15000);
    res = await fetch(url, { redirect: 'follow', signal: ac.signal });
    clearTimeout(timer);
  } catch (e) {
    return { ok: false, why: `응답이 없습니다 (${e.cause?.code || e.name}). ` +
      `도메인 구입·DNS 레코드 등록·전파 중 하나가 아직 안 끝났습니다.` };
  }
  if (!res.ok) return { ok: false, why: `HTTP ${res.status} 를 반환합니다.` };

  const body = await res.text();
  const mine = /트립가이드|TripGuide|tripguide/i.test(body);
  if (!mine) return { ok: false, why:
    `응답은 오는데 우리 사이트가 아닙니다(주차 페이지·기본 페이지일 수 있음). ` +
    `Vercel Domains 연결이 끝났는지 확인하세요.` };

  return { ok: true };
}

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    if (SKIP_DIRS.has(name)) continue;
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) walk(p, out);
    else if (EXTS.has(extname(name)) && !SKIP_FILES.has(name)) out.push(p);
  }
  return out;
}

if (!dry && !force) {
  process.stdout.write(`https://${next} 확인 중... `);
  const pre = await preflight(next);
  if (!pre.ok) {
    console.log('❌');
    console.error('');
    console.error(`전환을 중단합니다 — ${pre.why}`);
    console.error('');
    console.error('순서:');
    console.error('  1) Vercel → Settings → Domains 에 도메인 추가');
    console.error('  2) Vercel이 알려주는 A(루트)·CNAME(www) 레코드를 등록기관 DNS에 입력');
    console.error(`  3) https://${next} 가 우리 사이트를 띄우는지 브라우저로 확인`);
    console.error('  4) 이 명령 재실행');
    console.error('');
    console.error('미리보기만 하려면 --dry, 전파 중인 걸 확실히 안다면 --force');
    process.exit(1);
  }
  console.log('✅');
}

const files = walk(ROOT);
let touched = 0, total = 0;
const rows = [];

for (const f of files) {
  const src = readFileSync(f, 'utf8');
  if (!src.includes(prev)) continue;
  const hits = src.split(prev).length - 1;
  total += hits;
  touched++;
  rows.push([relative(ROOT, f).replace(/\\/g, '/'), hits]);
  if (!dry) writeFileSync(f, src.split(prev).join(next), 'utf8');
}

rows.sort((a, b) => b[1] - a[1]);
for (const [f, n] of rows) console.log(`  ${String(n).padStart(3)}곳  ${f}`);

console.log('');
console.log(`${prev}  →  ${next}`);
console.log(`파일 ${touched}개 · ${total}곳${dry ? ' (미리보기 — 아무것도 바꾸지 않았습니다)' : ' 교체 완료'}`);

if (!dry) {
  cfg.domain = next;
  writeFileSync(CONFIG, JSON.stringify(cfg, null, 2) + '\n', 'utf8');
  console.log('site.config.json 갱신됨');
  console.log('');
  console.log('다음 순서로 마무리하세요:');
  console.log('  1) git add -A && git commit && git push   (Vercel 자동 배포)');
  console.log(`  2) node scripts/smoke_test.mjs https://${next}`);
  console.log('  3) Search Console에 새 도메인 등록 + sitemap 제출');
}
