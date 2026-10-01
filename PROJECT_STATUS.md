# 트래블코스트 (TravelCost) — PROJECT STATUS

> **마지막 업데이트**: 2026-09-08 · 이번 세션 요약: **UI 전면 개편(하단탭·선아이콘·사업자정보) + 목적지 10곳 추가(23곳) + 수익화 배선·누수 3건 회수 + 지역필터 버그 수정 + 보안 4건**
> **프로젝트 경로**: `C:\Users\GB\Documents\travel-guide`
> **GitHub**: `cslis07/travel-guide` (Public) · 기본=현재 브랜치 **`master`** (main 아님)
> **배포**: https://travelcost.co.kr · **Vercel**(cslis07) · `master` push = 자동 프로덕션 · **자체 도메인 연결 완료**(구 `travel-guide-cslis07.vercel.app`)
> **외부 서비스**: 없음(백엔드·DB 없음). Supabase/Firebase 미사용. localStorage만. 제휴 자동화는 **별도 프로젝트 posteady-clone `/deals`** 담당(여기 아님)
> **규모**: HTML 33개(**목적지 가이드 23곳** + 도구/법적 10개) · Edge Function 3개(`api/`) · 공용 JS 9개 · 프로덕션 스모크 **40항목(40/40)**

---

## 0. 지금 하던 일 (WIP)

**깨끗한 상태** — `git status` 미커밋 0, 미푸시 0(`origin/master`와 동기), stash 없음. 최종 커밋 `a89086b`. 스모크 40/40. SW 캐시 `travelcost-v12`.

**이번 세션 한 일**(자세히는 `CHANGELOG.md` 2026-09-07/08):
- UI v2: 하단 탭바(`nav.js`)·선아이콘(`icons.js`)·사업자정보 푸터(`bizfooter.js`)·Pretendard·디자인토큰 개편
- 목적지 10곳 추가(어르신 중국 4 + 트렌드 6) → 23곳, 전부 `noindex,follow`, 🇨🇳중국 필터
- 수익화: `affiliates.js` 기후엔진·토스 준비물 8종·홈/견적/공항/prepare 배선, **제휴 누수 3건 회수**(홈위젯 트립닷컴 미추적·목적지 숙소 아고다행·공항 수익화 0)
- 지역·시군구 필터 버그 수정(TourAPI 실코드로 재생성), 보안 4건(SSRF·XSS·import·헤더)

**다음 채팅이 가장 먼저 할 것**: 코드 급한 것 없음. **사용자 입력 대기가 병목**(아래) — 값이 오면 바로 배선.

**사용자가 직접 해야 할 일**(코드로 불가):
1. **신규 10곳 트립닷컴 숙소 city ID** — 장가계·계림·상하이·백두산·타이베이·홍콩·나트랑·세부·오키나와·코타키나발루. 링크생성기 '호텔 페이지'에서 도시 선택 → URL `city=` 숫자 → `affiliates.js` `TRIPCOM_CITY`에 추가하면 10곳 숙소도 5% 켜짐. (현재 13곳만 ID 보유)
2. **"정말 누를" 상품 6종 쉐어링크** — eSIM·멀티어댑터·수하물저울·압축팩·목베개·방수팩. 오면 문제→해결 카드로 배선(빈 카드는 안 만듦).
3. **Airalo eSIM 제휴 가입**(~15%, 트래픽 하한 없음) → ref 주면 배선.
4. **GA4 측정 ID** — `analytics.js` `GA4_ID`(현재 빈 값=측정 불가). 클릭 이벤트 트래킹까지 붙일 준비 됨.
5. **Google Search Console 소유권 인증** — 코드(`content="..."`) 주면 index 삽입 → sitemap 제출.
6. **Vercel 환경변수** `TOUR_API_KEY`·`ICN_API_KEY`(현재 폴백키로 동작, 공개레포 노출 상태). 재발급→등록→폴백 제거 순.

---

## 1. 프로젝트 목적

"**다 합쳐서 얼마 드나(`/estimate`)**"와 "**언제 뭘 준비하나(`/prepare`)**"에 답하는 한국 여행자용 도구 + 인천공항 실시간 + 제휴 수익화. 백엔드·DB 없는 정적 PWA.

**방향 전환 이력**: (2026-08-11) OTA(여기어때·트립닷컴)와 가이드로 경쟁 불가 → 예산견적·출국준비 축으로 이동. (2026-09) 수익화는 **여행 맥락에 맞는 상품을 맞는 순간에** 노출(딜 자동화 아님 — 그건 posteady-clone).

---

## 2. 현재 구현된 기능

| 라우트 | 기능 | 상태 |
|--------|------|------|
| `/` | 환율바·계산기, 항공/숙소/국내 검색위젯(딥링크), TourAPI 국내검색(주차·카페 필터·상세모달), 목적지 카드 23곳(🇨🇳중국 필터 포함), **여행 필수템 수익화 섹션** | ✅ |
| `/estimate` | 총예산 견적기(항공·숙소는 MRT 실시간, 단가 인라인 수정), 날짜별 최저가, 범위 표시, **목적지 맞춤 준비물 블록** | ✅ |
| `/prepare` | 출국 준비 타임라인(D-30~당일, "지금 할 것"), 항목 체크 저장, **상단 전체 준비물 + 항목별 인라인(충전→충전기)** | ✅ |
| `/airport` | 인천공항 8탭(혼잡도·주차·셔틀·출입국·항공편·시설·내편명·출국준비), 도심공항터미널 카드, **출국준비 탭에 픽업·렌터카(5%)+준비물** | ✅ |
| `/tours` | 메타서치 4탭(MRT 라이브 카드+페이지네이션) + 트립닷컴·클룩·KKday·와그·부킹·아고다 비교 | ✅ |
| `/guide` `/mytrip` `/privacy` `/terms` `/404` | 이용가이드 / 내여행 허브(noindex) / 법적 / 커스텀404 | ✅ |
| 목적지 가이드 **23곳** | 전부 오사카식 3유형(1인·친구·가족)+날씨. **전부 `noindex,follow`**(AI생성물 색인 제외, 제휴 링크는 작동) | ✅ |
| 공통 | 하단 탭바(모바일)·PWA 설치·SW 오프라인·사업자정보 푸터·AI크롤러 차단·CSP | ✅ |

> "이상해 보이지만 정상": 목적지 23곳이 검색에 안 잡히는 것은 **의도**(noindex). 색인 대상은 `/`·`/estimate`·`/prepare`·`/airport`·`/tours`·`/guide` 6곳.

---

## 3. 수정한 주요 파일 (이번 세션 🆕/🔧)

| 경로 | 역할 |
|------|------|
| `affiliates.js` 🆕 | **제휴 단일 레지스트리**. PARTNERS(트립닷컴 발급값 有·나머지 빈값), CATEGORIES(요율/rank), TRIPCOM_CITY(도시ID), TRAVEL_GOODS(토스 준비물 8), 기후엔진(`climateOf`/`goodsForTrip`), `goodsHtml`/`goodsFor`/`track`/`ctas`/`disclosure` |
| `nav.js` 🆕 | 모바일 하단 탭바(홈·여행지·투어·내여행·공항), CSS 자체포함 |
| `icons.js` 🆕 | Lucide 스타일 인라인 SVG 51종(`data-icon` 자동치환) |
| `bizfooter.js` 🆕 | 전 페이지 사업자정보 법정표기(상호 피부담앙·대표·등록번호·주소, **생년월일 제외**) |
| `destaff.js` 🆕 | 목적지 숙소 섹션에 트립닷컴(5%) 추적 CTA 주입, city ID 없으면 미생성 |
| `main.js` 🔧 | 홈 위젯 트립닷컴 추적 부착(`_tcTrack`/`_tcHotel`), 지역필터 `AREA_MAP`/`SIGUNGU_MAP` 실코드화 + `populateAreaOptions`, `esc`/`safeUrl`/`safeText` |
| `style.css` 🔧 | 디자인 v2 토큰(그레이 10단계·radius 16·2겹 그림자), `.cat-tag.china` |
| `sw.js` 🔧 | 캐시 `travelcost-v12`, SHELL에 공용 JS 추가 |
| `tours.html` 🔧 | 결과 카드 렌더러(`parseWidgetCards`), MRT 추적 `AFF.track` 통일 |
| `estimate/prepare/airport/index.html` 🔧 | 준비물·픽업·렌터카 수익화 블록 |
| 목적지 23곳 | osaka=정본 템플릿. 신규 10곳(zhangjiajie·guilin·shanghai·changbaishan·taipei·hongkong·nhatrang·cebu·okinawa·kotakinabalu) |
| `api/proxy.js` 🔧 | SSRF 방어(호스트 허용목록+path 정규식), `api/tour.js` areaCode2 허용 |
| `vercel.json` 🔧 | CSP·Permissions-Policy·HSTS·X-Robots-Tag |

---

## 4. 남은 작업

### 🔴 사용자 입력 대기 (코드로 불가) — §0 참조
트립닷컴 신규 10곳 city ID · 준비물 6종 링크 · Airalo 가입 · GA4 ID · Search Console 인증 · Vercel 환경변수

### 🟡 코드 개선 (선택)
- **문제→해결 카드**("📵 데이터 먹통?→eSIM") — *대기: 링크 6종 오면.*
- **애드센스** — *선결: `ads.txt`(pub-ID 발급 후) + CSP `script-src`에 googlesyndication 추가(그때 최소범위로).* 도메인은 이미 연결됨.
- Vercel KV 캐싱 — *트래픽 5K+ PV/일 전엔 Edge Cache로 충분.*

---

## 5. 실행 명령어

```bash
npx vercel dev              # 전체 기능(Edge Function 포함). npx serve는 /api 404(정상)
# 커밋 전 검증
node --check api/*.js *.js  # JS 문법 (main·sw·analytics·pwa-install·icons·nav·bizfooter·affiliates·destaff)
git push origin master      # = 자동 프로덕션 배포(~40초)
# 재개 직후 스모크(살아있는지 1개로 확인)
node scripts/smoke_test.mjs # 40항목 전부 ✅ 여야 정상. 배포 직후엔 ?_cb= 캐시버스터로 재확인
```
- **SW·공용 JS 수정 시 `sw.js` 캐시명 버전 범프 필수**(안 하면 구캐시 서빙 → "함수 undefined" 유령버그·수익화 미노출). 이번 세션 v9~v12로 여러 번 올림.

---

## 6. 배포·환경

- **계정**: git push는 **cslis07 전용**(403 시 cmdkey 자격증명 2개 삭제 + `gh auth switch` → 재시도, 전역 정책)
- **환경변수 표**

| 키 | 용도 | 설정된 곳 | 상태 |
|----|------|-----------|------|
| `TOUR_API_KEY` | 한국관광공사 | Vercel(권장) | 미등록 — 폴백키 동작(공개레포 노출) |
| `ICN_API_KEY` | 인천공항 | Vercel(권장) | 미등록 — 폴백키 동작 |
| `GA4_ID` | 애널리틱스 | `analytics.js` 상수 | 빈 값=의도적 미로드 |
| 트립닷컴 발급값 | 제휴 추적 | `affiliates.js` `tripcom.aff` | **설정됨**(Allianceid/SID/trip_sub3, 공개 URL 노출값이라 비밀 아님) |

- **git에 있음(로컬 전용 없음)** — .env·키스토어 불필요(정적 사이트, 키는 Vercel/코드폴백).
- **Edge Function**: `runtime:'edge'` — Node 내장모듈 불가, Web Fetch만.

---

## 7. 무인 실행되는 것

**없음** — GitHub Actions·cron·웹훅·스케줄 태스크 전무. 세션 없이 도는 것은 Vercel 정적 서빙과 CDN 캐시뿐. (제휴 자동발행은 별도 프로젝트 posteady-clone)

---

## 8. 최근 발생한 에러와 해결 (누적)

| 증상 | 원인 | 해결 | 날짜 |
|------|------|------|------|
| 양평군 선택→화성시 결과 | `AREA_MAP`/`SIGUNGU_MAP` 손수작성이 TourAPI 실코드(가나다순)와 전부 어긋남 | areaCode2로 실코드 받아 재생성, select 하드코딩 제거→`populateAreaOptions` | 2026-08-20 |
| 여행 준비물 블록 안 보임 | affiliates.js 고치고 SW 캐시명 미범프→구버전(goodsHtml 없는) 서빙 | 캐시 버전 범프 | 2026-09-07 |
| tours 항공편 "결과 없음" | `summarize()`가 products/stays만 탐색 | 전용 `renderFlights()` | — |
| 검색어 `"`·`<` 화면깨짐 | 이스케이프 없이 삽입 | `esc()` 전면 | 2026-08-05 |
| 프리뷰 함수 전부 undefined | 구버전 SW가 옛 HTML 캐시 | SW 캐시명 범프 | — |
| PowerShell 한글 커밋 pathspec 오류 | 히어독 `"..."` 파싱 깨짐 | Bash single-quote 커밋 | — |

---

## 9. API 구조

### 내부 (Vercel Edge Functions)
| 라우트 | 방식 | 역할·화이트리스트 | 캐시 |
|--------|------|------|------|
| `/api/tour?path=<ep>` | GET | TourAPI 프록시. path 정규식 검증. areaBasedList2·searchKeyword2·locationBasedList2·detail*·**areaCode2**(24h) | 5분~1시간 |
| `/api/proxy?path=` or `?_url=` | GET | 인천공항 + 외부(**Open-Meteo 2호스트만 허용**, SSRF 방어) | 30초 |
| `/api/mrt` | POST | 마이리얼트립 MCP `tools/call`. 도구 11종 화이트리스트 | 60초 |

### 외부 의존
- **한국관광공사 KorService2**: 일 1만 건(활용신청 시 10만). item 단건이면 비배열→배열화됨.
- **인천공항 B551177**: 일 1만. T2 출국장 혼잡도 미제공.
- **마이리얼트립 MCP**: 무인증. 투어/숙소는 `data.widget.children[]`→`parseWidgetCards`(최대 10개, copy_text 폴백). 항공은 `data.result.items[]`. fareCalendar는 실시간 아님(고지).
- **트립닷컴 제휴**: 숙소는 **숫자 city ID 필수**(이름=빈결과 함정, `%2F` 날짜 본문반영 실측). 링크에 Allianceid/SID/trip_sub3 자동부착.
- **토스쇼핑 쉐어링크**: 추적이 박힌 리다이렉트 단축링크(`toss.im/_m/…`), 고정링크 임베드. Open API 규격은 메모리 `reference_toss_sharelink_api.md`.
- open.er-api.com(환율)·Open-Meteo(날씨): 무인증.

---

## 10. 결정 기록 (코드에서 역추적 불가)

- **목적지 23곳 전부 noindex**: 출처 없는 AI 일괄 생성물이라 애드센스·검색(scaled content abuse) 감점 → 삭제 대신 noindex,follow(제휴 링크는 살림). 색인 대상은 실데이터 도구 6곳.
- **제휴 추적 단일 출처**: `affiliates.js` 한 곳에서만. 페이지·main.js가 자체 목록 두면 트립닷컴 빠지는 사고 발생했음 → `AFF.track`/`AFF.url`로 통일.
- **트립닷컴 우선**: 유일 승인 파트너 + 숙소 5%(최고 요율). 아고다/부킹은 미승인(수수료 0)이라 목적지 숙소 CTA 맨 앞에 트립닷컴 주입.
- **항공은 유입도구**: 0.5% + 세금제외라 사실상 수수료 없음. 배치는 수수료율 순(숙소>렌터카>픽업>투어>항공).
- **사업자**: 개인사업자 피부담앙(일반과세자, 335-21-02118). 세금계산서 발행(YES) 권장, 쿠팡/토스도 같은 사업자로 통일 방향.
- **CSP `unsafe-inline` 유지**: 무빌드 정적 사이트라 nonce 불가(구조적). 출력 이스케이프가 1차 방어선.

### 🔒 보안 조치 이력 (2026-08-05 `e7c510a`, 09 보강)
SSRF(_url 허용목록+https) · 경로탈출(path 정규식) · 저장형 XSS(esc/safeUrl/safeText 17곳+onclick→dataset) · 무검증 import(/mytrip 검증) · 보안헤더(CSP·Permissions-Policy·HSTS). 공격 페이로드 실측 차단.

---

## 11. ⛔ 하지 말 것 (누적)

- **`vercel.json`에 `redirects` 추가 금지** — cleanUrls와 충돌해 리다이렉트 루프(과거 실장애).
- **`api/proxy.js` `URL_ALLOWLIST`·`PATH_RE` 완화 금지** — 없애면 공개 오픈프록시(SSRF) 복귀.
- **`main.js` `esc`/`safeUrl`/`safeText` 우회 금지** · **`onclick="fn('${값}')"` 재도입 금지** — localStorage는 /mytrip import로 외부주입 가능해 신뢰 불가.
- **`api/*.js` `FALLBACK_KEY` 환경변수 등록 전 제거 금지** — 즉시 검색 사망.
- **`sw.js` 수정 시 캐시명 버전 범프 필수** — 안 하면 수익화·기능 미반영 유령버그.
- **`analytics.js` `GA4_ID=''`은 버그 아님** — 미설정 시 미로드가 의도.
- **`npx serve`로 API 테스트 금지** — Edge Function은 Vercel 전용. `vercel dev` 사용.
- **히스토리 rewrite(force push) 금지** — Public 포트폴리오 레포.
- **목적지 23곳을 sitemap에 추가 금지** — noindex와 모순(URL만 색인되는 최악). robots.txt로 Disallow도 금지(크롤러가 noindex 메타를 못 읽음).
- **PowerShell 히어독 한글 커밋 금지** — Bash single-quote 사용.

## 12. ❌ 보류 / 구조적 한계 (재시도 방지)

- **클룩·KKday·부킹·아고다 라이브 결과 불가** — 공개 검색 API 없음(클룩 서버측 403 실측). 제휴 딥링크로 확정.
- **쿠팡 파트너스 API** — ⏸ **누적 판매 15만원 달성 시** 개방(딥링크 API). 그전엔 수동 링크만. **재시도 트리거: 15만원**.
- **토스 쉐어링크 Open API** — 승인 후 IP 등록 필요(미등록 시 403). 현재 수동 8개 링크. 자동화는 posteady-clone에서.
- **Web Push 알림 불가** — 백엔드·DB 없음(구조적). ICS 캘린더 알림이 유일 경로.
- **기기 간 상태 동기화(자동) 불가** — 로그인·DB 없음. URL/QR 수동 이동만.
- **iOS 자동 설치 프롬프트 불가** — Safari 미지원, 안내 시트로 대체.
- **T2 출국장 혼잡도** — 공공데이터 미제공.
- ~~마이리얼트립 위젯 풀 카드 렌더~~ — 2026-08-04 구현(`parseWidgetCards`, copy_text 폴백, 최대 10개).

## 13. 용어

- **AFF** = `affiliates.js`의 `window.AFF` 레지스트리. **goodsForTrip** = 목적지 기후 맞춤 준비물. **goodsFor(todoId)** = 체크리스트 항목별 인라인 상품. **destaff** = 목적지 숙소에 트립닷컴 CTA 주입 스크립트. **TRIPCOM_CITY** = 트립닷컴 숙소 도시ID 표. **피부담앙** = 사업자 상호(대표 이상민).

## 14. 디렉토리 구조

```
travel-guide/
├─ index.html airport.html tours.html estimate.html prepare.html guide.html mytrip.html
├─ privacy.html terms.html 404.html
├─ osaka.html …(목적지 23곳, osaka=정본 템플릿, 전부 noindex)
├─ main.js style.css sw.js                # 코어
├─ affiliates.js destaff.js               # 제휴(단일 레지스트리 + 목적지 주입)
├─ icons.js nav.js bizfooter.js           # UI 공용(아이콘·하단탭·사업자정보)
├─ analytics.js pwa-install.js            # GA4 로더·앱설치
├─ api/{tour,proxy,mrt}.js                # Edge Functions(키 은닉)
├─ icons/ scripts/                        # 아이콘·OG·smoke_test
├─ sitemap.xml robots.txt vercel.json manifest.webmanifest
├─ CHANGELOG.md API_SECURITY.md README.md
```

## 15. 다음 세션 시작 문구

"travel-guide의 PROJECT_STATUS.md 읽고 §0 확인해줘. 깨끗한 상태이고 코드 급한 건 없음 — 사용자가 트립닷컴 신규 10곳 city ID / 준비물 6종 쉐어링크 / GA4 ID 중 무엇을 주는지에 따라 §0 '사용자 액션'대로 배선하면 된다. 값이 없으면 §4 코드개선(문제→해결 카드)은 링크 대기 상태."
