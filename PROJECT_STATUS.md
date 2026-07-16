# 트립가이드 (TripGuide) — PROJECT STATUS

> **마지막 업데이트**: 2026-07-07
> **프로젝트 경로**: `C:\Users\GB\Documents\travel-guide`
> **GitHub**: `cslis07/travel-guide` (Public) · 기본 브랜치 **`master`** (main 아님)
> **배포**: https://travel-guide-cslis07.vercel.app · **Vercel** (GitHub push 자동 배포)
> **규모**: HTML 페이지 10개 · Edge Function 3개(`api/`) · 공용 JS 4개 · 유틸 스크립트 3개(`scripts/`)

---

## 0. 지금 하던 일 (WIP)

**깨끗한 상태** — `git status` 미커밋 변경 없음. 최종 커밋 `7234675`(앱 설치 버튼)까지 푸시·배포·검증 완료.

**다음 채팅이 가장 먼저 해야 할 한 가지**:
사용자 직접 액션 대기 중 — **Vercel 환경변수 등록**(`TOUR_API_KEY`, `ICN_API_KEY`). 코드는 준비됐고 대시보드 조작만 남음(§6 참조). 코드 작업을 이어받는다면 §4의 🟡 항목부터.

---

## 1. 프로젝트 목적

한국 여행자용 **여행 통합 가이드 + 인천공항 실시간 대시보드 + 여행상품 메타서치** 정적 웹앱(PWA).

**최근 방향성**: 판매용이 아닌 **포트폴리오 + 제휴 수익화** 자산으로 정리 (README 포트폴리오화, 제휴 설정 지점 마련, 법적 페이지·애널리틱스 완비). 완성도 자체평가 ≈88/100.

---

## 2. 현재 구현된 기능

| 라우트 | 기능 |
|--------|------|
| `/` (index.html) | 환율 바+계산기, 항공/숙소/국내 검색 위젯, TourAPI 국내검색(+주차·카페 필터·상세모달), 목적지 카드 |
| `/airport` | 인천공항 8탭: 진출입·주차·셔틀철도·출입국장·항공편·시설 + ⭐내 편명(카운트다운·게이트변경알림·ICS저장·자동완성) + 🛫출국준비(6단계 트래커·34항목 체크리스트·SVG 평면도·라운지9·편의9·수하물/면세/금지) + Ctrl+K 통합검색·딥링크(`#tab=`)·다크모드·한/영 |
| `/tours` | 메타서치 4탭 — 마이리얼트립 라이브(투어/숙소/국내·국제항공) + 클룩·KKday·부킹·아고다 비교 딥링크 + 검색히스토리·항공편정렬·날짜별최저가캘린더 + `?city=` 자동검색 |
| `/guide` | 이용가이드 (8섹션·사이드바 TOC 스크롤스파이·모바일 드로어) |
| `/osaka` `/fukuoka` `/tokyo` | 목적지 가이드 (일정탭·예산·숙소·현지팁·투어 CTA) |
| `/privacy` `/terms` | 법적 페이지 (제휴·수익화 심사용) |
| `/404.html` | 커스텀 404 |
| 공통 | PWA 설치(좌하단 버튼, iOS 안내시트), SW 오프라인, OG이미지, JSON-LD |

---

## 3. 수정한 주요 파일

🆕 = 이번(최근) 세션 신규

| 경로 | 역할 |
|------|------|
| `index.html` | 메인 페이지 |
| `airport.html` | 인천공항 대시보드 (단일 파일 175KB, gzip 45KB, CSS/JS 인라인) |
| `tours.html` 🆕 | 메타서치 (파트너 레지스트리 `PARTNERS`, 제휴설정 `MRT_AFFILIATE`) |
| `guide.html` 🆕 | 이용가이드 |
| `fukuoka.html` `tokyo.html` 🆕 | 목적지 가이드 (osaka 템플릿 기반) |
| `privacy.html` `terms.html` 🆕 | 법적 페이지 |
| `main.js` | 메인 로직 — 환율/계산기, TourAPI(프록시 경유 `_callTourApi`), 상세모달 |
| `style.css` | 공용 스타일 (`--primary:#1B4FD8`, `--accent:#F97316`) |
| `sw.js` | SW v3 (`tripguide-v3`) — HTML/API 네트워크 우선, 자산 캐시 우선, 오프라인 폴백 |
| `analytics.js` 🆕 | GA4 로더(ID 미설정 시 미로드) + 전역 에러 핸들러(항상 동작) |
| `pwa-install.js` 🆕 | 앱 설치 버튼 (beforeinstallprompt / iOS 안내시트) |
| `api/tour.js` 🆕 | TourAPI 프록시 (키 은닉, 엔드포인트 화이트리스트, TTL 캐시 5분~1시간) |
| `api/proxy.js` | 인천공항 프록시 + `_url` 외부프록시(Open-Meteo) |
| `api/mrt.js` 🆕 | 마이리얼트립 MCP 프록시 (stateless JSON-RPC, 60초 캐시) |
| `manifest.webmanifest` | PWA (start_url `/`, shortcuts 인천공항·투어검색) |
| `icons/` `og-image.png` `favicon.ico` 🆕 | Pillow 생성 아이콘·소셜이미지 |
| `scripts/make_icons.py` `make_og.py` 🆕 | 아이콘/OG 재생성기 (폰트 비의존 도형 렌더) |
| `scripts/smoke_test.mjs` 🆕 | 프로덕션 14페이지+2API 자동점검 |
| `sitemap.xml` `robots.txt` 🆕 | SEO |

---

## 4. 남은 작업

### 🔴 사용자 직접 액션 (코드로 불가 — 대시보드/가입 필요)
1. **Vercel 환경변수 등록** `TOUR_API_KEY`·`ICN_API_KEY` — *안 한 이유: 대시보드 로그인 필요.* 등록 후 `api/*.js`의 `FALLBACK_KEY` 제거 권장 (절차: `API_SECURITY.md`)
2. **data.go.kr 정식 활용신청** — *안 한 이유: 본인 계정 신청 필요.* 일 1만→10만 건
3. **제휴 발급값 입력** — *안 한 이유: 파트너스 가입 필요.* `tours.html`의 `MRT_AFFILIATE.value`, `PARTNERS[].aff`
4. **GA4 측정 ID** — *안 한 이유: GA 계정 필요.* `analytics.js`의 `GA4_ID`

### 🟡 코드 개선 (선택)
- 목적지 가이드 추가(교토·방콕·다낭 등) — *안 한 이유: 콘텐츠 정확성 검증 부담, 현재 `tours?city=` 검색으로 우회 중이라 급하지 않음*
- Vercel KV 캐싱 — *안 한 이유: 트래픽 5K+ PV/일 도달 전에는 Edge Cache로 충분*
- airport.html 데이터 외부화 — *안 한 이유: gzip 45KB로 실전송 문제없음 확인, 분리 리스크 > 이득*

### 🟢 아이디어
- 메인 인기 투어 위젯, 관심상품 찜, SEO 블로그 콘텐츠

---

## 5. 실행 명령어

```bash
# ⚠️ API 포함 로컬 테스트는 반드시 vercel dev (Edge Function은 Vercel 런타임 전용)
npx vercel dev              # http://localhost:3000  (전체 기능)
npx serve -l 3333 .         # http://localhost:3333  (정적 UI만 — /api/* 는 404)

# 커밋 전 검증 절차
node --check api/tour.js api/proxy.js api/mrt.js sw.js analytics.js pwa-install.js  # JS 문법
py -m py_compile scripts/make_icons.py scripts/make_og.py                            # Python 문법

# 배포 (push = 자동 프로덕션)
git push origin master

# 배포 후 검증 (필수 습관)
node scripts/smoke_test.mjs         # 14페이지 + 2API — 16개 전부 ✅ 여야 정상

# 자산 재생성 (Pillow 필요: py -m pip install pillow)
py scripts/make_icons.py            # PWA 아이콘 4종
py scripts/make_og.py               # OG 소셜 이미지
```

---

## 6. 배포 관련 주의사항

- **계정**: git push는 **cslis07 전용** (403 시 cmdkey 자격증명 삭제 + `gh auth switch` — 사용자 전역 정책)
- **자동 배포**: `master` push → Vercel 프로덕션. 배포 반영까지 ~40초
- **Edge Function**: `api/*.js`는 `runtime:'edge'` — Node 내장모듈 불가, Web Fetch만

### 환경변수

| 키 | 용도 | 설정된 곳 | 상태 |
|----|------|-----------|------|
| `TOUR_API_KEY` | 한국관광공사 TourAPI | Vercel(권장) | **미등록(미확인)** — 코드 내 폴백 키로 동작 중 |
| `ICN_API_KEY` | 인천공항 공공데이터 | Vercel(권장) | **미등록(미확인)** — 폴백 키로 동작 중 |
| `GA4_ID` | 애널리틱스 | `analytics.js` 상수(환경변수 아님) | 빈 값 = 의도적 미로드 |
| (없음) | 마이리얼트립 MCP | — | 인증 불필요 (공개 서버) |

- **cleanUrls**: `/airport` = `airport.html`. ⚠️ `vercel.json`에 `redirects` 추가 금지(§9)
- Public 레포 → 폴백 키가 코드에 노출 중. 환경변수 등록 전까지는 감수 상태(사용자 인지)

---

## 7. 최근 발생한 에러와 해결 방법

| 증상 | 원인 | 해결 |
|------|------|------|
| tours 항공편 탭 항상 "결과 없음" | `summarize()`가 `products/stays`만 탐색, 항공편은 `result.items[]` 구조 | 전용 `renderFlights()` 카드 렌더 신설 |
| 검색어에 `"` `<` 입력 시 화면 깨짐 | CTA 텍스트에 이스케이프 없이 삽입 | `esc()` 전면 적용 |
| 모바일 출입국장 테이블 좌측 잘림("1번"→"L번") | `.tbl-wrap{margin:0 -12px}` 음수 마진 | 음수마진 제거 + 첫 열 sticky |
| 모바일 항공편 3열 텍스트 잘림 | 모바일 CSS가 `.flt-cols` 타깃했으나 실제 클래스는 `.flt-board2` | 셀렉터 수정 + 세로 스택 |
| 목적지 카드 21개 링크 404 | 과거 revert(`1593d8e`)로 페이지 삭제됐는데 링크 잔존 | `tours?city=` 검색으로 교체, 후쿠오카·도쿄는 페이지 신설 |
| 로컬 `npx serve`에서 검색 404 | Edge Function은 Vercel 런타임 전용 | 버그 아님 — `vercel dev` 사용 |
| PowerShell 한글 커밋 pathspec 오류 | 히어독 내부 `"..."` 따옴표 파싱 깨짐 | **Bash single-quote 멀티라인 커밋** |
| 프리뷰에서 함수 전부 undefined | 구버전 SW가 옛 HTML 캐시 서빙 | SW unregister + 캐시 삭제 + 캐시명 버전 범프(v3) |
| OG 이미지 칩이 빈 알약 | 흰 글자를 반투명 흰 알약 위에 렌더 / 이모지 폰트 미지원 | 불투명 흰 배경+파란 글자, 이모지 제거 |

---

## 8. API 구조

### 내부 라우트 (Vercel Edge Functions)

| 라우트 | 방식 | 역할 | 캐시 |
|--------|------|------|------|
| `/api/tour?path=<ep>&...` | GET | TourAPI 프록시. 화이트리스트: areaBasedList2·searchKeyword2·locationBasedList2·detailCommon2·detailIntro2·detailImage2 | s-maxage 검색5분/위치3분/상세30분~1시간 |
| `/api/proxy?path=<ep>` 또는 `?_url=<full>` | GET | 인천공항(B551177) + 외부 URL(Open-Meteo) 프록시 | s-maxage 30초 |
| `/api/mrt` | POST `{tool,arguments}` | 마이리얼트립 MCP `tools/call` 전달. 도구 11종 화이트리스트. 응답 `{ok,copyText,text,data}` | s-maxage 60초 |

### 외부 의존 API 특이사항

| API | 인증 | 쿼터/함정 |
|-----|------|-----------|
| 한국관광공사 KorService2 | serviceKey(Decoded) | **일 1만 건**(활용신청 시 10만). 응답 item이 단건이면 배열 아님 → 배열화 처리돼 있음 |
| 인천공항 B551177 | serviceKey | 일 1만 건. **T2 출국장 혼잡도는 데이터 미제공**(운영시간만 표시) |
| 마이리얼트립 MCP | **불필요** | stateless — initialize/세션 없이 tools/call 직행. 응답이 **위젯 UI JSON 또는 `copy_text` 마크다운**으로 형태 가변. 항공편은 `data.result.items[]`. flightsFareCalendar는 **실시간 아님 고지 의무** |
| open.er-api.com | 불필요 | 24시간 갱신. 간헐 다운 → 폴백 메시지 |
| Open-Meteo | 불필요 | proxy의 `_url` 경유(CORS) |

---

## 9. ⛔ 하지 말 것

- **`vercel.json`에 `redirects` 추가 금지** — cleanUrls와 충돌해 **리다이렉트 루프**(ERR_TOO_MANY_REDIRECTS) 재발. 과거 실제 장애.
- **PowerShell 히어독으로 따옴표 포함 한글 커밋 금지** — pathspec 오류로 커밋 깨짐. Bash `git commit -m '...'` 사용.
- **`api/*.js`의 `FALLBACK_KEY`를 환경변수 등록 전에 제거 금지** — 즉시 전체 검색 기능 사망.
- **`main.js`의 `saveTourApiKey`/`getTourApiKey` no-op 삭제 금지** — deprecated지만 호환용으로 의도적으로 남김.
- **`sw.js`의 SHELL/전략 수정 시 캐시명(`tripguide-v3`) 버전 범프 필수** — 안 하면 구캐시가 계속 서빙되어 "함수 undefined" 유령 버그 재발.
- **`analytics.js`의 `GA4_ID=''` 빈 값은 버그 아님** — 미설정 시 GA 미로드가 의도된 동작(에러 핸들러는 항상 동작).
- **`npx serve`로 검색/API 기능 테스트 금지** — `/api/*` 404는 환경 한계. 테스트는 `vercel dev` 또는 프로덕션 스모크.
- **히스토리 rewrite(force push) 금지** — Public 포트폴리오 레포, 커밋 이력이 자산.

## 10. ❌ 보류 / 구조적 한계 (재시도 방지)

- **클룩·KKday·부킹·아고다 라이브 검색 결과 표시 불가** — 공개 검색 API/MCP 없음. 클룩은 서버측 접근 403(봇차단) 실측. → **제휴 딥링크 핸드오프**로 확정.
- **아고다 텍스트 검색 딥링크 불안정** — `?textToSearch=`가 cityId 없으면 홈으로 리다이렉트됨(실측). 제휴 cid 추적은 유효하므로 유지하되, 정확 랜딩은 어필리에이트 링크빌더 필요.
- **KKday 서버측 검증 불가** — 이 환경에서 URLError(차단). 표준 URL 패턴(`/ko/product/productlist?keyword=`) 사용 중, 브라우저 동작은 미확인.
- **마이리얼트립 위젯 JSON 풀 카드 렌더 보류** — 응답이 자사 위젯 렌더러용 트리라 스키마 변경에 취약. `copy_text` 우선 + 구조화 배열 요약으로 확정.
- **iOS 자동 설치 프롬프트 불가** — Safari가 `beforeinstallprompt` 미지원. 안내 시트로 대체(구조적 한계).
- **T2 출국장 혼잡도** — 공공데이터 자체가 미제공. UI에 안내 문구로 처리됨.
- **로컬 정적 서버에서 Edge Function 실행 불가** — Vercel 런타임 전용(구조적).
- **네이버 검색어 딥링크류 과거 이슈와 무관** — 이 프로젝트는 해당 없음(참고: 다른 프로젝트 메모).

## 11. 디렉토리 구조

```
travel-guide/
├─ index.html            # 메인
├─ airport.html          # 인천공항 8탭 (인라인 CSS/JS 단일 파일)
├─ tours.html            # 메타서치 (제휴 설정: MRT_AFFILIATE, PARTNERS)
├─ guide.html            # 이용가이드
├─ osaka/fukuoka/tokyo.html  # 목적지 가이드
├─ privacy/terms.html    # 법적 페이지
├─ 404.html
├─ main.js               # 메인 로직 (TourAPI는 _callTourApi 프록시 경유)
├─ style.css             # 공용 토큰/스타일
├─ sw.js                 # SW v3 — 수정 시 캐시명 버전업 필수(§9)
├─ analytics.js          # GA4 로더(ID 입력처) + 전역 에러핸들러
├─ pwa-install.js        # 앱 설치 버튼
├─ api/                  # ⚡ Vercel Edge Functions (키 은닉 계층)
│   ├─ tour.js           #   한국관광공사 프록시
│   ├─ proxy.js          #   인천공항 + 외부URL 프록시
│   └─ mrt.js            #   마이리얼트립 MCP 프록시
├─ icons/                # PWA 아이콘 (scripts/make_icons.py 로 재생성)
├─ scripts/              # 유틸 (아이콘·OG 생성, 스모크 테스트)
├─ manifest.webmanifest / sw.js / favicon.ico / og-image.png
├─ sitemap.xml / robots.txt
├─ API_SECURITY.md       # 환경변수·활용신청·KV 운영 가이드
└─ README.md             # 포트폴리오용 (Mermaid 아키텍처 포함)
```
