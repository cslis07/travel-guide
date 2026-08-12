# 트래블코스트 (TravelCost) — PROJECT STATUS

> **마지막 업데이트**: 2026-08-11
> **프로젝트 경로**: `C:\Users\GB\Documents\travel-guide`
> **GitHub**: `cslis07/travel-guide` (Public) · 기본 브랜치 **`master`** (main 아님)
> **배포**: https://travel-guide-cslis07.vercel.app · **Vercel** (GitHub push 자동 배포)
> **규모**: HTML 페이지 23개(**목적지 가이드 13곳** 포함) · Edge Function 3개(`api/`) · 공용 JS 5개 · 유틸 스크립트 3개(`scripts/`) · 프로덕션 스모크 30항목

---

## 0. 지금 하던 일 (WIP)

이번 세션(2026-08-11)에 **제품 방향을 바꿨다.**

### 왜 바꿨나
여행 가이드로는 여기어때·트립닷컴 같은 OTA와 경쟁이 성립하지 않는다. 그들의 본질은
재고·가격·결제이고 우리는 예약을 못 한다. 목적지 가이드 13곳도 냉정히 보면
AI로 일괄 생성한 일반 정보라 네이버 블로그·유튜브를 이길 근거가 없고,
구글의 대량 생성 콘텐츠(scaled content abuse) 정책 표적이기도 하다.

**그래서 OTA가 답해주지 않는 두 가지로 축을 옮겼다.**
① "다 합쳐서 얼마 드나" — 스카이스캐너는 항공만, 아고다는 숙소만 답한다.
② "언제 뭘 준비하나" — 준비 항목 나열은 많지만 시점을 알려주는 곳이 없다.

### 이번 세션 작업
1. **`/estimate` 총예산 견적기 신규** — 지역×스타일 프리셋 + 실시간(MRT) 반영, 단가 전부 사용자 조정 가능.
2. **`/prepare` 출국 준비 타임라인 신규** — 출발일 기준 6단계를 실제 날짜로 배치, "지금 할 것" 표시, 21항목 체크 저장.
3. **`affiliates.js` 제휴 레지스트리 신규** — 파트너 8곳/카테고리 7종 단일 관리, 발급값 없으면 일반 링크로 동작.
4. **주차요금 사실오류 수정** — 단기 1일 `28,800원` → 공식 **24,000원**. 수치에 출처·확인일을 남기는 `.src-note` 규약 도입.
5. 하단 탭 재구성(`홈·예산 견적·출국 준비·투어·티켓·공항`), sitemap·스모크 배선.

### ⚠️ 미해결 — 다음 채팅이 먼저 볼 것
1. **제휴 발급값이 하나도 없다.** `affiliates.js`의 `aff:{}`가 전부 빈 객체라
   지금 나가는 링크는 **수수료가 붙지 않는 일반 링크**다. 각 파트너스 가입·승인이 선행돼야
   수익 모델이 검증된다. 코드로는 더 할 게 없다.
2. **목적지 가이드 13곳 처리 방침 미정.** 삭제할지, 사람이 검증해 살릴지 사용자 결정 대기.
   현재는 그대로 두었고 sitemap에도 남아 있다.
3. **Google Search Console 소유권 인증** — 기존 대기 항목 그대로.
4. **도메인 연결 — 코드 쪽은 준비 완료, 계정 쪽만 남았다.**

   ### 왜 필요한가
   - **애드센스**: `*.vercel.app`은 루트에 `ads.txt`를 둘 수 없어 승인이 사실상 안 난다.
   - **제휴 심사**: 트립닷컴 외 파트너(클룩·KKday) 신청 시에도 자체 도메인이 유리하다.
   - **숙소 도시 ID 확보와 함께 지금 수익에 가장 크게 걸리는 두 병목 중 하나다.**

   ### 절차 (① ② 는 계정 작업이라 코드로 불가)
   1. 도메인 구입 (연 1~2만원)
   2. Vercel 대시보드 → 프로젝트 → Settings → Domains 에 추가 → 레지스트라에 DNS 등록
   3. **`node scripts/set-domain.mjs <새도메인>`** ← canonical·og:url·og:image·JSON-LD·
      sitemap·robots·README 등 **29개 파일 115곳**을 한 번에 교체하고 `site.config.json`도 갱신한다.
      먼저 `--dry`로 미리보기 가능. ⚠️ 손으로 고치지 말 것 — canonical 하나만 빠뜨려도
      검색엔진에 중복 콘텐츠로 잡힌다.
   4. push → 배포 → `node scripts/smoke_test.mjs https://<새도메인>`
   5. Search Console에 새 도메인 등록 + sitemap 재제출

   ### 애드센스는 도메인 뒤에 두 가지가 더 필요하다
   - **`ads.txt`** — 애드센스 게시자 ID(`pub-...`)를 받은 뒤 루트에 생성.
   - **CSP 수정** — 현재 `vercel.json`의 `script-src`에 googlesyndication 계열이 없어
     **애드센스 스크립트가 통째로 차단된다.** 붙이는 시점에 최소 범위로 열 것.
     (미리 열어두면 얻는 것 없이 CSP만 넓어지므로 그때 하는 게 맞다)

---

## 1. 프로젝트 목적

한국 여행자용 **여행 통합 가이드 + 인천공항 실시간 대시보드 + 여행상품 메타서치** 정적 웹앱(PWA).

**최근 방향성**: 판매용이 아닌 **포트폴리오 + 제휴 수익화** 자산으로 정리 (README 포트폴리오화, 제휴 설정 지점 마련, 법적 페이지·애널리틱스 완비). 완성도 자체평가 ≈88/100.

---

## 2. 현재 구현된 기능

| 라우트 | 기능 |
|--------|------|
| `/` (index.html) | 환율 바+계산기, 항공/숙소/국내 검색 위젯, TourAPI 국내검색(+주차·카페 필터·상세모달), 목적지 카드 |
| **`/estimate`** 🆕 | **여행 총예산 견적기** — 목적지·일정·인원·스타일 → 항공·숙소·식비·현지교통·관광·쇼핑·예비비 합산. 총액/1인당/1일당 + 비중 바. 단가는 전부 인라인 수정 가능(수정 시 '실시간' 배지 해제). 항공·숙소는 `/api/mrt`로 실시간 시세 반영(조회시각 표기). `#d=&o=&b=&a=&c=&r=&s=` 링크 공유, `tripguide_estimates`에 저장 |
| **`/prepare`** 🆕 | **출국 준비 타임라인** — 출발일 입력 → D-30·D-14·D-7·D-3·D-1·당일 6단계를 실제 날짜로 배치하고 "지금 할 것" 강조. 21개 항목 체크(`tripguide_prepare_done`)·진행률 바. 보험·환전은 제휴 없이 정보만(사유 명시) |
| `/airport` | 인천공항 8탭: 진출입·주차·셔틀철도·출입국장·항공편·시설 + ⭐내 편명(카운트다운·게이트변경알림·ICS저장·자동완성) + 🛫출국준비(6단계 트래커·34항목 체크리스트·SVG 평면도·라운지9·편의9·수하물/면세/금지) + Ctrl+K 통합검색·딥링크(`#tab=`)·다크모드·한/영 |
| `/tours` | 메타서치 4탭 — 마이리얼트립 라이브(투어/숙소/국내·국제항공) + 클룩·KKday·부킹·아고다 비교 딥링크 + 검색히스토리·항공편정렬·날짜별최저가캘린더 + `?city=` 자동검색. **투어·티켓/숙소 결과 = 카드 그리드(이미지·평점·가격·뱃지·예약링크) + 5개씩 페이지네이션** |
| `/guide` | 이용가이드 (8섹션·사이드바 TOC 스크롤스파이·모바일 드로어) |
| **목적지 가이드 13곳** | `/osaka` `/fukuoka` `/tokyo` `/kyoto` `/sapporo`(일본), `/bangkok` `/danang` `/bali` `/singapore`(동남아), `/jeju` `/busan` `/gangneung`(국내), `/paris`(유럽). **전부 동일 구조**: 여행 유형 3종(1인·친구·가족, `type-select-bar`+`switchType`)별 일정탭·예산·숙소 + 항공권(국내는 KTX/국내선) 표 + 현지팁 7 + Open-Meteo 날씨 위젯 |
| `/mytrip` | "내 여행" 허브 — localStorage 집계 + base64 URL/QR 내보내기·가져오기 (`robots noindex`) |
| `/privacy` `/terms` | 법적 페이지 (제휴·수익화 심사용) |
| `/404.html` | 커스텀 404 |
| 공통 | PWA 설치(좌하단 버튼, iOS 안내시트), SW 오프라인, OG이미지, JSON-LD, **AI 크롤러 차단**(robots.txt + `X-Robots-Tag`) |

---

## 3. 수정한 주요 파일

🆕 = 이번(최근) 세션 신규

| 경로 | 역할 |
|------|------|
| `index.html` | 메인 페이지 |
| `airport.html` 🆕 | 인천공항 대시보드 (단일 파일, CSS/JS 인라인). 🆕 "공항 가는 길"에 **서울역 도심공항터미널** 카드 |
| `tours.html` 🆕 | 메타서치 (파트너 레지스트리 `PARTNERS`, 제휴설정 `MRT_AFFILIATE`). 🆕 결과 카드 렌더러 `parseWidgetCards`/`itemCard`/`renderItemsPage`(페이지네이션) |
| `guide.html` | 이용가이드 |
| `osaka.html` | 목적지 가이드 **정본 템플릿**(700줄, 3유형 구조) — 나머지 12곳이 이 구조를 복제 |
| `fukuoka.html` `tokyo.html` 🆕 | 라이트판 → **오사카식 완전판 전환**(3유형) |
| `kyoto/bangkok/danang/bali/singapore/jeju/busan/gangneung/paris/sapporo.html` 🆕 | 목적지 가이드 신규 10개(osaka 구조 복제). 국내(jeju/busan/gangneung)는 KTX/국내선, hero-stat 국내형 |
| `mytrip.html` 🆕 | "내 여행" 허브 — localStorage 집계 + base64 URL/QR 내보내기·가져오기 (`robots noindex`) |
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
| `scripts/smoke_test.mjs` 🆕 | 프로덕션 25페이지+2API(총 27) 자동점검 — 27/27 통과 |
| `sitemap.xml` 🆕 | SEO (목적지 13곳 전부 등록) |
| `robots.txt` 🆕 | SEO + **AI 크롤러 20종 차단** |
| `vercel.json` 🆕 | cleanUrls + 보안헤더 + `X-Robots-Tag: noai, noimageai`(전역) |

---

## 4. 남은 작업

### 🔴 사용자 직접 액션 (코드로 불가 — 대시보드/가입 필요)
1. **Vercel 환경변수 등록** `TOUR_API_KEY`·`ICN_API_KEY` — *안 한 이유: 대시보드 로그인 필요.* 등록 후 `api/*.js`의 `FALLBACK_KEY` 제거 권장 (절차: `API_SECURITY.md`)
2. **data.go.kr 정식 활용신청** — *안 한 이유: 본인 계정 신청 필요.* 일 1만→10만 건
3. **제휴 발급값 입력** — *안 한 이유: 파트너스 가입 필요.* `tours.html`의 `MRT_AFFILIATE.value`, `PARTNERS[].aff`
4. **GA4 측정 ID** — *안 한 이유: GA 계정 필요.* `analytics.js`의 `GA4_ID`
5. **Google Search Console 소유권 인증** — *진행 중: 사용자가 콘솔 가입 완료, 인증 코드(`content="..."` 또는 `googleXXXX.html` 파일명) 전달 대기.* 받으면 `index.html`에 meta 태그 삽입 → 인증 → `sitemap.xml` 제출(이미 배포됨) → 핵심 3페이지 색인 요청

### ✅ 기능 갭 감사 결과 (2026-07-07, feature-gap-finder) — **7종 전부 구현 완료**
> 스모크 테스트 17/17 통과. 전부 localStorage + 프론트 수정으로 구현(스키마 변경 없음).

| # | 항목 | 구현 내용 |
|---|------|-----------|
| 1 | ✅ 알림 문구 정직화 + ICS 강화 | "탭 열려있을 때만" 명시 + `.fav-notice` 안내 박스, ICS 알람 2개(출발편: 공항출발 3h전 + 게이트이동 1h전) |
| 2 | ✅ 재시도 버튼 3곳 | 환율(`loadExchangeRates` 재호출)·국내여행(`_fetchDomesticPage`)·MRT(`_lastRun` 재실행) + `.retry-btn`/`.tt-retry` |
| 3 | ✅ 관광지·맛집 찜 | `tripguide_saved_places`, 카드 하트 + 모달 저장, index `#savedSection`. `toggleSavePlace`/`_renderSavedPlaces` |
| 4 | ✅ 목적지 날씨 | osaka/fukuoka/tokyo 히어로에 Open-Meteo(프록시 경유) 현재 날씨, WMO 이모지 맵 |
| 5 | ✅ 검색위젯·계산기 상태 유지 | `tripguide_prefs` — 도착지·인원·금액·통화 복원(`restorePrefs`). 날짜는 제외 |
| 6 | ✅ 커스텀 체크리스트 + 안정적 키 | 키 `d{그룹}_{항목}`(텍스트 무관), `icn_checklist_custom` 개인 항목 추가/삭제 |
| 7 | ✅ 내 여행 허브 + URL/QR | **`/mytrip` 신규** — 집계 대시보드 + base64 URL 직렬화(링크복사/QR 지연로드) + `#data=` 가져오기 |

> localStorage 키 전체: `tripguide_saved_places`, `tripguide_prefs`, `icn_fav_flights`, `icn_fav_snapshot`, `icn_checklist`, `icn_checklist_custom`, `icn_depart_step`, `tt_search_history`, `icn-theme`, `icn-lang`. mytrip 내보내기는 이 중 7개를 번들.

### 🟡 코드 개선 (선택)
- ~~목적지 가이드 추가~~ — **완료**(2026-08-04): 13곳 전부 오사카식 완전판.
- 각 목적지·tours 페이지 **푸터 지역 링크 통일** — *안 한 이유: 현재 일부 푸터가 `tours.html?city=`로 연결(기능 정상). 신규 가이드 페이지로 통일하면 더 일관되나 12+파일 편집 필요, 우선순위 낮음.* (사용자에게 후속 제안한 상태)
- Vercel KV 캐싱 — *안 한 이유: 트래픽 5K+ PV/일 도달 전에는 Edge Cache로 충분*
- airport.html 데이터 외부화 — *안 한 이유: gzip 45KB로 실전송 문제없음 확인, 분리 리스크 > 이득*

### 🟢 아이디어
- 메인 인기 투어 위젯, SEO 블로그 콘텐츠

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
node scripts/smoke_test.mjs         # 25페이지 + 2API — 27개 전부 ✅ 여야 정상
                                    # (배포 ~40초 후 실행. CDN 엣지 캐시로 첫 조회가 구버전일 수 있어 ?_cb= 캐시버스터로 재확인)

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
| 마이리얼트립 MCP | **불필요** | stateless — initialize/세션 없이 tools/call 직행. 응답이 **위젯 UI JSON 또는 `copy_text` 마크다운**으로 형태 가변. **투어/숙소는 `data.widget.children[]`(ListViewItem 트리) → `parseWidgetCards`가 Image/Text(value)/Badge/onClickAction 워크로 이미지·제목·평점·가격·URL 추출** (검색당 최대 10개, `copy_text`로 폴백). 항공편은 `data.result.items[]`. flightsFareCalendar는 **실시간 아님 고지 의무** |
| open.er-api.com | 불필요 | 24시간 갱신. 간헐 다운 → 폴백 메시지 |
| Open-Meteo | 불필요 | proxy의 `_url` 경유(CORS) |

---

### 🔒 보안 조치 이력 (2026-08-05, `e7c510a`)

| 취약점 | 위험 | 조치 | 실측 |
|--------|------|------|------|
| **SSRF** — `api/proxy.js`의 `_url`이 임의 URL 프록시 | 공개 오픈프록시 악용·대역폭 도용·내부주소 탐색 | 호스트 허용목록(open-meteo 2곳)+https 강제 | 외부·메타데이터 403, 정상 200 |
| **경로 탈출** — `path` 무검증 | data.go.kr 내 타 엔드포인트 임의 호출 | 정규식 `^[A-Za-z0-9_]+/[A-Za-z0-9_]+$` | `../../evil` 400, 실사용 15개 전부 통과 |
| **저장형 XSS** — `main.js`에 `esc()` 부재 | 악성 `#data=` 링크 → localStorage 오염 → 홈에서 코드실행 | `esc`/`safeUrl`/`safeText` 17곳 적용, 인라인 onclick→dataset | 공격 페이로드 12종 전부 차단 |
| **무검증 import** — `/mytrip` `#data=` | 임의 localStorage 주입 | 허용키·타입·200KB·JSON파싱 검증 | — |
| **보안헤더 부재** | 클릭재킹·스크립트 유출 경로 | CSP·Permissions-Policy·HSTS | 헤더 7종 응답 확인 |

> ⚠️ CSP의 `script-src`에 `'unsafe-inline'`이 남아 있다. 인라인 스크립트가 전 페이지에 퍼진
> 무빌드 정적 사이트라 nonce를 쓸 수 없기 때문이다(구조적). 외부 도메인 로드는 차단되므로
> 유출 경로는 막히지만, 인라인 XSS에 대한 CSP 방어는 기대할 수 없다 → **출력 이스케이프가 1차 방어선**.

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
- **`api/proxy.js`의 `URL_ALLOWLIST`·`PATH_RE` 완화 금지** — 없애면 즉시 공개 오픈프록시(SSRF)로 되돌아간다.
  목적지 페이지 추가 시 Open-Meteo만 쓰므로 허용목록 수정 불필요.
- **`main.js`의 `esc`/`safeUrl`/`safeText` 우회 금지** — 새 렌더 코드에서 외부·localStorage 값을
  innerHTML에 넣을 때는 반드시 통과시킬 것. localStorage는 `/mytrip` 가져오기로 외부 주입이 가능해 신뢰 불가.
- **`onclick="fn('${값}')"` 패턴 재도입 금지** — JS 문자열 주입 벡터. `data-*` + `this.dataset` 사용.

## 10. ❌ 보류 / 구조적 한계 (재시도 방지)

- **클룩·KKday·부킹·아고다 라이브 검색 결과 표시 불가** — 공개 검색 API/MCP 없음. 클룩은 서버측 접근 403(봇차단) 실측. → **제휴 딥링크 핸드오프**로 확정.
- **아고다 텍스트 검색 딥링크 불안정** — `?textToSearch=`가 cityId 없으면 홈으로 리다이렉트됨(실측). 제휴 cid 추적은 유효하므로 유지하되, 정확 랜딩은 어필리에이트 링크빌더 필요.
- **KKday 서버측 검증 불가** — 이 환경에서 URLError(차단). 표준 URL 패턴(`/ko/product/productlist?keyword=`) 사용 중, 브라우저 동작은 미확인.
- ~~마이리얼트립 위젯 JSON 풀 카드 렌더 보류~~ — **2026-08-04 구현함**(`6e1e213`): `parseWidgetCards`가 위젯 트리를 워크해 이미지·제목·평점·가격·뱃지·예약URL을 카드로 렌더(페이지네이션 5개씩). 단 **위젯 트리는 MRT 자사 렌더러용이라 스키마 변경 시 깨질 수 있음** → 파싱 실패 시 `copy_text` 텍스트로 자동 폴백하도록 방어. 검색당 카드는 **최대 10개**로 고정(perPage 올려도 10 고정, 실측).
- **진짜 백그라운드 푸시 알림(Web Push) 불가** — Web Push는 푸시 서버(백엔드)+구독 저장(DB)이 필요한데 이 프로젝트는 백엔드·DB 없음(구조적). 게이트 변경 알림은 **탭이 열려 있을 때만**(`setInterval` 폴링) 동작. `sw.js`에 push 핸들러 없음. → 잠긴 폰에도 도달하는 유일한 경로는 **ICS 캘린더 알림**(`downloadFavIcs`). §4 감사 1번에서 문구 정직화 예정.
- **iOS 자동 설치 프롬프트 불가** — Safari가 `beforeinstallprompt` 미지원. 안내 시트로 대체(구조적 한계).
- **기기 간 상태 동기화 불가(자동)** — 로그인·DB 없어 localStorage가 기기 로컬 한정. URL/QR 직렬화로 수동 이동만 가능(§4 감사 7번).
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
├─ osaka.html            # 목적지 가이드 정본 템플릿(나머지 12곳이 복제)
├─ {fukuoka,tokyo,kyoto,sapporo}.html          # 일본 (오사카식 3유형)
├─ {bangkok,danang,bali,singapore}.html        # 동남아
├─ {jeju,busan,gangneung}.html                 # 국내 (KTX/국내선)
├─ paris.html            # 유럽
├─ mytrip.html           # 내 여행 허브 (localStorage 집계 · noindex)
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
