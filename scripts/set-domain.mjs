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
