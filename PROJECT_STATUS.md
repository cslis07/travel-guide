# 트래블코스트 (TravelCost) — PROJECT STATUS

> **마지막 업데이트**: 2026-10-19 · 이번 세션 요약: **(상태문서 최신화)** — 10/08~10/12 작업 반영: `/tours` 숙소 검색에 **플랫폼별 1박 가격비교 + 숙박 총액**(트립닷컴·부킹·아고다 등, 같은 호텔 매칭, Xotelo 출처) 신설. Edge Function 2개(`hotelidx`·`hotelprice`) 추가. *직전 세션은 Trip 중심 리디자인.*
> **프로젝트 경로**: `C:\Users\GB\Documents\travel-guide`
> **GitHub**: `cslis07/travel-guide` (Public) · 기본=현재 브랜치 **`master`** (main 아님)
> **배포**: https://travelcost.co.kr · **Vercel**(cslis07) · `master` push = 자동 프로덕션 · 자체 도메인 연결 완료
> **외부 서비스**: 없음(백엔드·DB 없음). localStorage만. 제휴 자동화는 별도 프로젝트 posteady-clone `/deals` 담당
> **규모**: HTML 35개(목적지 가이드 23 + 도구/법적/Trip 12) · Edge Function **5개**(`api/`: tour·proxy·mrt·hotelidx·hotelprice) · 공용 JS 11개 · SW 캐시 **v25**

---

## 0. 지금 하던 일 (WIP)

**사실상 깨끗** — `git status` 미커밋은 `project-state.json`(Control Center 자동 상태파일, **요청 없이 커밋 금지**) + 이 세션에서 저장 중인 `PROJECT_STATUS.md` 2개뿐. 미푸시 0(`origin/master` 동기), stash 없음. **최종 커밋 `7e14740`**. SW `travelcost-v25`.

**최근 세션 한 일 — 숙소 플랫폼별 가격비교**(2026-10-08~10-12, `CHANGELOG.md` 참조, 커밋 `cc99edb`~`7e14740` 6개, 전부 배포됨):
- `/tours` 숙소 검색 결과 카드 아래에 **같은 호텔의 플랫폼별 1박 가격**(트립닷컴·부킹·아고다·클룩·Vio·익스피디아 + 마이리얼트립)을 낮은 순 표시, 최저가 배지. **2박 이상이면 숙박 총액(1박×박수)** 함께 표기.
- **출처 = Xotelo**(트립어드바이저 제휴 요금, 무료·무인증, `data.xotelo.com/api/rates`). 현지통화→원화 환산.
- **같은 호텔 매칭**: MRT 상세 좌표 + 로마자 유사도. 오매칭 차단(지명·체인명 제외 비교), 미지원 숙소는 **구글 호텔 비교 링크** 폴백. MRT 429 대응 CDN 캐시(매칭 30일·색인 7일).
- 신규 Edge Function `api/hotelidx.js`·`api/hotelprice.js`. 지원 도시 33곳. `scripts/smoke_test.mjs` 42항목.

**직전 세션 — Trip 중심 리디자인**(2026-09~10): `trips.js`(TripStore)·`trips.html`·`trip.html`(5탭)·`trip-attach.js` 신설. 일정·예산·예약·준비물·공항 전 항목 CRUD + 실시간 환율/날씨 + 그룹정산/공유 + ICS/CSV + 한글 웹폰트 제거.

**다음 채팅이 가장 먼저 할 것**: 코드 급한 것 없음(검증·배포 완료). 사용자 입력 대기가 병목(아래).

**사용자가 직접 해야 할 일**(코드로 불가):
1. **신규 10곳 트립닷컴 숙소 city ID** — 장가계·계림·상하이·백두산·타이베이·홍콩·나트랑·세부·오키나와·코타키나발루 → `affiliates.js` `TRIPCOM_CITY`. (현재 13곳 보유)
2. **상품 6종 쉐어링크**(eSIM·멀티어댑터·수하물저울·압축팩·목베개·방수팩) → 문제→해결 카드 배선.
3. **Airalo eSIM 제휴 가입**(~15%) → ref 주면 배선.
4. **Google Search Console 소유권 인증** 코드 → sitemap 제출.
5. **Vercel 환경변수** `TOUR_API_KEY`·`ICN_API_KEY`(현재 공개레포 폴백키 동작) 재발급→등록→폴백 제거.
   - ~~GA4 측정 ID~~ — **제외 결정**(방문추적 안 넣기로, 메모리 `feedback_no_visit_analytics`). `analytics.js`는 두되 `GA4_ID` 빈 값 유지.

---

## 1. 프로젝트 목적

한국 여행자용 도구 + 인천공항 실시간 + 제휴 수익화. **백엔드·DB 없는 정적 PWA**.

**방향 전환 이력**:
- (2026-08-11) OTA·가이드로 경쟁 불가 → `/estimate`(얼마 드나)·`/prepare`(언제 뭘)로 축 이동.
- (2026-09~10) **Trip 중심 리디자인** — "도구 나열"에서 **"하나의 여행(Trip) 안에 일정·예산·예약·준비물·공항을 묶는"** 구조로 전환. Wanderlog(일정·지도)+TravelSpend(예산·정산)+인천공항+(실시간) 통합. 기존 도구는 Trip의 엔진으로 흡수(estimate→예산, prepare→준비물, 가이드→도시).

---

## 2. 현재 구현된 기능

### Trip 중심 (이번 세션 신설)
| 라우트 | 기능 | 상태 |
|--------|------|------|
| `/trips` | 내 여행 목록(카드: D-day·예산 사용률·인원), 예정/지난 필터, 새 여행 생성, **여행 삭제(🗑)**, 공유링크(`?t=`) 가져오기, 구 mytrip 데이터 이관 배너 | ✅실측 |
| `/trip?id=` | 여행 허브 = 커버+요약 3지표 + 하위탭 5개. 커버에 공유 버튼 | ✅실측 |
| ─ 일정 | 일차 타임라인(블록), ▲▼ 순서이동, 항목 수정/삭제, **날짜별 날씨**(기온·강수), 장소 지도링크, **하루 동선 지도**(구글지도 경유지), **.ics 내보내기** | ✅실측 |
| ─ 예산 | 도넛(사용률), **일일 가용액=(총예산−누적)÷남은일수**, 카테고리 바+**한도/초과 배지**, 지출 추가/수정/삭제(통화·카테고리·결제·**낸사람/나눔대상 인원선택**), **그룹 정산**(순채무 최소전송)+**정산 내역 공유(단톡 텍스트)**, **지출 CSV 내보내기** | ✅실측 |
| ─ 예약 | 항공/숙소/투어 카드 추가/수정/삭제, 상태(확정/예정), 투어 최저가 비교 연결 | ✅실측 |
| ─ 준비물 | **추천 목록(24항목 4그룹)에서 골라 담기** + 직접 추가, 체크 토글, 항목 수정/삭제 | ✅실측 |
| ─ 공항 | 내 항공편 카드 + **인천공항 실시간 출국장 혼잡도**(터미널별 대기 인원·분), /airport·/prepare 연결 | ✅실측 |

### 기존 도구 (유지)
| 라우트 | 기능 | 상태 |
|--------|------|------|
| `/` | 환율바·계산기, 검색위젯(딥링크), TourAPI 국내검색, 목적지 카드 23곳, 필수템 수익화, **🧳 내 여행 배너** | ✅ |
| `/estimate` | 총예산 견적기(MRT 실시간·국내 육로·명절/성수기 할증), **"이 예산으로 내 여행 만들기"** | ✅ |
| `/prepare` | 출국 준비 타임라인, **"이 준비물을 내 여행에 담기"** | ✅ |
| `/airport` | 인천공항 8탭, 도심공항터미널, 픽업·렌터카(5%) | ✅ |
| `/tours` | 메타서치 4탭(MRT 라이브+페이지네이션). 숙소 탭에 **플랫폼별 1박 가격비교 + 숙박 총액**(같은 호텔 매칭, 최저가 배지, Xotelo 출처). 미지원 숙소는 구글 호텔 비교 링크 | ✅실측 |
| `/guide` `/mytrip` `/privacy` `/terms` `/404` | 가이드 / (구)내여행 허브 / 법적 / 404 | ✅ |
| 목적지 가이드 **23곳** | 3유형+날씨, 전부 `noindex,follow`, **"이 도시로 여행 만들기" 버튼** | ✅ |
| 공통 | 하단 탭바(홈·**내 여행**·여행지·예산 견적·출국 준비), PWA·SW·사업자정보·AI크롤러 차단·CSP, **기기 기본 폰트** | ✅ |

> "이상해 보이지만 정상": ① 목적지 23곳이 검색에 안 잡히는 것은 의도(noindex). ② 여행 예보가 안 뜨면 **여행 날짜가 예보권(약 16일) 밖**이라 정상. ③ `/trips` 첫 방문 시 **오사카 데모 여행 1건 자동 생성**(seedIfEmpty, 구조 체험용). ④ 구 `/mytrip`(export/import 유틸)은 보존 — 헤더 "내 여행"은 이제 `/trips`로 감.

---

## 3. 수정한 주요 파일

### 최근 세션 신규 🆕 (숙소 가격비교, 10/08~10/12)
| 경로 | 역할 |
|------|------|
| `api/hotelidx.js` 🆕 | Xotelo **도시 호텔 색인** Edge Function. MRT 호텔명↔Xotelo 호텔키 매칭용 도시 목록(7일 CDN 캐시). 없으면 주변 하위 지역(구)으로 재탐색 |
| `api/hotelprice.js` 🆕 | Xotelo **플랫폼별 요금** Edge Function(`data.xotelo.com/api/rates`). 좌표+로마자 유사도로 같은 호텔 매칭(30m·0.30 또는 200m·0.55), 지명·체인명 제외 비교로 오매칭 차단. 현지통화→원화. 매칭 30일 캐시 |
| `tours.html` 🔧 | 숙소 결과 전체에 플랫폼별 가격 자동표시(위에서부터 순차 로드, MRT 429 회피) + **숙박 총액(2박↑)** + 미지원 숙소 구글 호텔 비교 링크 |

### 직전 세션 신규 🆕 (Trip 리디자인)
| 경로 | 역할 |
|------|------|
| `trips.js` | **여행 데이터 모델 `window.TripStore`**. localStorage `tc_trips_v1`. CRUD(여행·일정·지출·예약·준비물), 일일가용액·그룹정산(`balances`/`settlements`), 다통화(`RATES`+실시간 `refreshRates` open.er-api 6h캐시), **한글도시 좌표맵 `CITY_GEO`**(가이드23+국내7), `moveDayItem`·`setCatLimit`·update/remove 전 엔티티, `seedIfEmpty`(오사카 데모) |
| `trips.html` | 내 여행 목록·새 여행 생성·여행 삭제·공유링크 가져오기·레거시 이관 배너 |
| `trip.html` | 여행 허브(5탭). 날씨·동선지도·ICS·CSV·정산공유·전 항목 시트. 인라인 SVG 스프라이트 |
| `trip-attach.js` | "여행에 담기" 공유 모듈(기존 선택/새 여행 생성 후 예산·준비물·일정·예약·항공편 적용) |
| `nav.js`·`api/proxy.js`·`index.html`·전 HTML·`sw.js` | 하단탭 "내 여행" 승격 / open-meteo geocoding 허용 / 홈 배너 / 웹폰트 제거 / 캐시 v12→v25 |

(코어 파일 `affiliates.js`·`destaff.js`·`icons.js`·`bizfooter.js`·`main.js`·`style.css` 역할은 변동 없음 — 필요 시 git log 참조)

---

## 4. 남은 작업

### 🔴 사용자 입력 대기 (§0 참조)
트립닷컴 신규 10곳 city ID · 상품 6종 링크 · Airalo 가입 · Search Console 인증 · Vercel 환경변수

### 🟡 코드 개선 (선택)
- `scripts/smoke_test.mjs`(**42항목**)에 **Trip 페이지(/trips·/trip) 추가** — 현재 인-리포 스모크는 구 도구+숙소가격 위주, Trip 검증은 세션 jsdom 스모크(scratch, 비영속)로만 했음. *후순위: 핵심 로직은 jsdom 16/16·회귀 12/12·360px CDP로 검증됨.*
- **문제→해결 카드**("📵 데이터 먹통?→eSIM") — *대기: 상품 링크 6종.*
- **애드센스** — *선결: ads.txt + CSP script-src에 googlesyndication.*
- `/airport` 실시간을 공항탭에 **그래프까지** 임베드 — *현재는 혼잡도 요약+링크.*

---

## 5. 실행 명령어

```bash
npx vercel dev                 # 전체(Edge Function 포함). npx serve는 /api 404(정상)
node --check *.js api/*.js     # JS 문법 (trips·trip-attach 포함 11개 + api 3개)
git push origin master         # = 자동 프로덕션 배포(~40초)
node scripts/smoke_test.mjs    # 42항목 프로덕션 스모크(구 도구+숙소가격). ?_cb= 캐시버스터로 재확인
```
- **SW·공용 JS 수정 시 `sw.js` 캐시명 버전 범프 필수**(현재 v25). 안 하면 cache-first 정적자산이 구버전 서빙 → "함수 undefined"·기능 미반영.
- **HTML은 network-first**라 범프 없이도 즉시 반영. JS(trips.js 등) 변경 시에만 범프 필요.
- Trip 로직 검증은 **jsdom 스모크**(세션 scratch에 `smoke*.js` 작성·`npm i jsdom`)로 했으며 영속 저장 안 됨. 재개 시 필요하면 재작성.

---

## 6. 배포·환경

- **계정**: git push는 **cslis07 전용**(403 시 cmdkey 자격증명 삭제 + `gh auth switch`).
- **환경변수 표**

| 키 | 용도 | 설정된 곳 | 상태 |
|----|------|-----------|------|
| `TOUR_API_KEY` | 한국관광공사 | Vercel(권장) | 미등록 — 폴백키 동작(공개레포 노출) |
| `ICN_API_KEY` | 인천공항 | Vercel(권장) | 미등록 — 폴백키 동작 |
| `GA4_ID` | 애널리틱스 | `analytics.js` 상수 | 빈 값 유지(방문추적 안 넣기로 결정) |
| 트립닷컴 발급값 | 제휴 추적 | `affiliates.js` | 설정됨(공개 URL 노출값, 비밀 아님) |

- **git에 없고 로컬에만 있는 필수 파일**: 없음(정적 사이트).
- **Edge Function**: `runtime:'edge'` — Node 내장모듈 불가, Web Fetch만.

---

## 7. 무인 실행되는 것

**없음** — GitHub Actions·cron·웹훅·스케줄 태스크 전무. 세션 없이 도는 건 Vercel 정적 서빙·CDN 캐시뿐.

---

## 8. 최근 발생한 에러와 해결 (누적)

| 증상 | 원인 | 해결 | 날짜 |
|------|------|------|------|
| 숙소 가격비교 20~30% 누락 | 호텔 목록 `best_value` 정렬이 페이지 사이 순서 흔들림 | `popularity` 정렬로 고유 색인 고정, 색인 캐시 v=2 무효화 | 2026-10-08 |
| 숙소 오매칭("호텔 위드"→Toyoko Inn) | 지명이 유사도에 끼어듦 | 그 도시 호텔명 흔한 단어(지명·체인명) 제외 비교, 근거리 30→40m, 매칭캐시 v=3 | 2026-10-08 |
| 일본 숙소 정답 놓침(롯폰기↔Roppongi) | 촉음 받침 로마자 변환 누락 | 촉음 보정+양방향 비교, 매칭캐시 v=4 | 2026-10-08 |
| 날씨 예보가 안 뜸(한글 도시) | Open-Meteo 지오코딩이 **한글 도시명 미지원**(영문만) | `CITY_GEO` 한글→좌표 내장 매핑(가이드23+국내7), 미등록은 영문 지오코딩 폴백 | 2026-10-06 |
| 헤드리스 Chrome innerWidth 500 고정 | 헤드리스 **최소 창폭 500px** | `Emulation.setDeviceMetricsOverride`로 360 강제(CDP) | 2026-10-06 |
| 확장 resize_window가 뷰포트 미반영 | 확장 창 리사이즈가 innerWidth 안 바꿈 | 360 실측은 헤드리스 CDP로 | 2026-10-06 |
| 지출 환율 부정확 | 정적 환율표 노후 | 네이버 기준 최신화 후 **실시간(open.er-api) 자동 갱신**(6h캐시·폴백) | 2026-09-30 |
| 양평군→화성시 결과 | AREA/SIGUNGU 손수작성이 TourAPI 실코드와 어긋남 | areaCode2 실코드 재생성 | 2026-08-20 |
| 준비물 블록 안 보임 | SW 캐시명 미범프 | 캐시 범프 | 2026-09-07 |
| 검색어 `"`·`<` 화면깨짐 | 이스케이프 누락 | `esc()` 전면 | 2026-08-05 |
| PowerShell 한글 커밋 pathspec 오류 | 히어독 파싱 깨짐 | Bash single-quote / `git commit -F` | — |

---

## 9. API 구조

### 내부 (Vercel Edge Functions)
| 라우트 | 역할·화이트리스트 |
|--------|------|
| `/api/tour?path=` | TourAPI 프록시. path 정규식 검증. areaBasedList2·searchKeyword2·locationBasedList2·detail*·areaCode2 |
| `/api/proxy?path=` or `?_url=` | 인천공항 + 외부. `_url`은 **Open-Meteo 3호스트만**(api·air-quality·**geocoding**) 허용(SSRF 방어) |
| `/api/mrt` | 마이리얼트립 MCP. 도구 11종 화이트리스트 |
| `/api/hotelidx?city=` | Xotelo 도시 호텔 색인(매칭용). 7일 CDN 캐시. 없으면 하위 지역 재탐색 |
| `/api/hotelprice?…` | Xotelo 플랫폼별 요금. 좌표+로마자 유사도 매칭(오매칭 차단), 현지통화→원화, 30일 캐시 |

### 외부 의존
- **Xotelo**(`data.xotelo.com/api/rates`, 숙소 플랫폼별 요금): **무료·무인증**. 트립어드바이저 제휴 요금. MRT 429 대응 위해 `hotelidx`/`hotelprice`가 CDN 장기 캐시. 확인 안 되면 가격을 지어내지 않고 안내만 표시.
- **한국관광공사 KorService2** / **인천공항 B551177**: 각 일 1만 건. ICN T2 출국장 혼잡도는 `statusOfDepartureCongestion`(게이트별 waitTime분·waitLength명, body.items 배열).
- **마이리얼트립 MCP**: 무인증. `parseWidgetCards`.
- **트립닷컴 제휴**: 숙소 숫자 city ID 필수. Allianceid/SID/trip_sub3 자동부착.
- **open.er-api.com**(환율): 무인증. `/v6/latest/KRW`→RATES 역산(원/외화 1단위). **CSP connect-src에 등록됨**(브라우저 직접 fetch).
- **Open-Meteo**(날씨): `/api/proxy?_url=` 경유. forecast는 start_date/end_date 약 16일 이내만. geocoding은 한글 미지원→`CITY_GEO`.
- **토스쇼핑 쉐어링크**: 리다이렉트 단축링크 임베드.

---

## 10. 결정 기록 (코드 역추적 불가)

- **Trip = localStorage 단일 모델(`TripStore`)**: 백엔드 없이 여행 전체를 `tc_trips_v1` 한 키에. 공유는 base64 URL(`/trips?t=`)로 전달→받는 쪽 복제.
- **협업은 "링크 공유"가 한계**: 실시간 공동편집은 로그인+DB 필요 → 구조상 불가(§12).
- **실시간 환율은 open.er-api**: 네이버 FX는 CORS·CSP로 브라우저 직접 호출 불가. open.er-api가 매매기준율과 사실상 동일(실측 1 JPY=8.6, 1 USD=1353).
- **한글 웹폰트 제거**: 기기 기본 폰트로 폴백(로딩 속도, 메모리 `feedback_device_korean_font_no_webfont`). 라틴/모노는 유지.
- **방문추적(GA4) 안 넣음**: 결정됨(메모리 `feedback_no_visit_analytics`). analytics.js는 두되 미로드.
- **목적지 23곳 noindex**: AI 일괄생성물(scaled content abuse 회피), 삭제 대신 noindex,follow(제휴 링크는 살림).
- **제휴 추적 단일 출처 `affiliates.js`**: 페이지가 자체 목록 두면 트립닷컴 빠지는 사고 발생했음.
- **트립닷컴 우선**: 유일 승인·숙소 5% 최고요율. 항공은 0.5%(유입도구).
- **CSP `unsafe-inline` 유지**: 무빌드 정적이라 nonce 불가. 출력 이스케이프가 1차 방어선.

### 🔒 보안 조치 이력 (2026-08-05 `e7c510a`, 09 보강)
SSRF(_url 허용목록+https) · 경로탈출(path 정규식) · 저장형 XSS(esc/safeUrl/safeText) · 무검증 import(/mytrip·공유링크 검증) · 보안헤더(CSP·Permissions-Policy·HSTS).

---

## 11. ⛔ 하지 말 것 (누적)

- **`project-state.json`은 요청 없이 커밋 금지**(Control Center 자동 상태파일).
- **`sw.js` 수정 시 캐시명 버전 범프 필수**(현재 v25) — 안 하면 trips.js 등 구버전 서빙.
- **`api/proxy.js` `URL_ALLOWLIST`·`PATH_RE` 완화 금지** — 오픈프록시(SSRF) 복귀. (open-meteo 3호스트가 전부)
- **`main.js` `esc`/`safeUrl`/`safeText` 우회·`onclick="fn('${값}')"` 재도입 금지** — localStorage는 공유링크/import로 외부주입 가능.
- **`api/*.js` `FALLBACK_KEY` 환경변수 등록 전 제거 금지** — 즉시 검색 사망.
- **`api/hotelidx`·`hotelprice`의 CDN 캐시 TTL(색인 7일·매칭 30일) 단축 금지** — MRT 429(호출제한) 재발. 매칭 캐시 버전(v=4)은 알고리즘 바꿀 때만 올릴 것.
- **`vercel.json`에 `redirects` 추가 금지** — cleanUrls 충돌 리다이렉트 루프(과거 장애).
- **목적지 23곳 sitemap 추가 금지**(noindex 모순). robots Disallow도 금지(크롤러가 noindex 메타를 못 읽음).
- **`analytics.js` `GA4_ID=''`·웹폰트 없음은 버그 아님**(의도).
- **`npx serve`로 API 테스트 금지** — `vercel dev` 사용. **force push 금지**(Public 포트폴리오).
- **PowerShell 히어독 한글 커밋 금지** — Bash single-quote / `git commit -F`.

## 12. ❌ 보류 / 구조적 한계 (재시도 방지)

- **실시간 공동편집(협업) 불가** — 로그인·DB 없음. 현재는 **여행 공유링크(`?t=`)로 복제본 전달**만. *재시도 트리거: 백엔드(Supabase 등) 도입 결정 시.*
- **Web Push 알림 불가** — 백엔드 없음. **ICS 캘린더**가 알림 대체 경로.
- **기기 간 자동 동기화 불가** — 공유링크/QR 수동 이동만.
- **쿠팡 파트너스 API** — ⏸ 누적 판매 **15만원** 달성 시 개방. 그전 수동 링크.
- **토스 쉐어링크 Open API** — 승인+출발지 IP 등록 필요(미등록 403). 현재 수동 8개. 자동화는 posteady-clone.
- **클룩·KKday·부킹·아고다 라이브 결과 불가** — 공개 검색 API 없음(403). 딥링크로 확정.
- **iOS 자동 설치 프롬프트 불가** · **T2 출국장 혼잡도 공공데이터 미제공**.

## 13. 용어

- **TripStore** = `trips.js`의 `window.TripStore`(여행 모델). **Trip 허브** = `/trip?id=`. **TripAttach** = `trip-attach.js`(여행에 담기 시트). **CITY_GEO** = 한글도시→좌표맵. **일일가용액** = (총예산−누적)÷남은일수. **balances/settlements** = 개인별 낸돈·부담 / 순채무 최소전송. **AFF** = `affiliates.js` 제휴 레지스트리. **피부담앙** = 사업자 상호(대표 이상민).

## 14. 디렉토리 구조

```
travel-guide/
├─ index.html airport.html tours.html estimate.html prepare.html guide.html mytrip.html
├─ trips.html trip.html                    # 🆕 내 여행 목록 / 여행 허브
├─ privacy.html terms.html 404.html
├─ osaka.html …(목적지 23곳, osaka=정본, 전부 noindex, "도시로 여행 만들기" 버튼)
├─ trips.js                                # 🆕 TripStore 모델(localStorage)
├─ trip-attach.js                          # 🆕 여행에 담기 모듈
├─ main.js style.css sw.js                 # 코어
├─ affiliates.js destaff.js                # 제휴
├─ icons.js nav.js bizfooter.js            # UI 공용(하단탭에 내 여행)
├─ analytics.js pwa-install.js             # (GA4 미로드)·앱설치
├─ api/{tour,proxy,mrt,hotelidx,hotelprice}.js  # Edge Functions(hotelidx·hotelprice=Xotelo 숙소가격)
├─ icons/ scripts/smoke_test.mjs           # 아이콘·프로덕션 스모크(42, 구 도구+숙소가격)
├─ sitemap.xml robots.txt vercel.json manifest.webmanifest
├─ CHANGELOG.md API_SECURITY.md README.md
```

## 15. 다음 세션 시작 문구

"travel-guide의 PROJECT_STATUS.md 읽고 §0 확인해줘. 최근 작업은 /tours 숙소 플랫폼별 가격비교+숙박총액(Xotelo, api/hotelidx·hotelprice) 완료·배포(최종커밋 7e14740, SW v25). 그전은 Trip 중심 리디자인. 미커밋은 project-state.json(커밋 금지)뿐. 코드 급한 건 없고, 사용자가 트립닷컴 신규 10곳 city ID / 상품 6종 링크 / Airalo·Search Console·Vercel 환경변수 중 무엇을 주는지에 따라 §0 '사용자 액션'대로 배선. Trip 로직은 trips.js(TripStore) 단일 출처, 숙소 매칭은 api/hotelprice.js(좌표+로마자 유사도), JS 수정 시 SW 캐시 범프 필수."
