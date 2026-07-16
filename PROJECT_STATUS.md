# 트립가이드 (TripGuide) — PROJECT STATUS

> 마지막 업데이트: 2026-07-07
> 배포 URL: https://travel-guide-cslis07.vercel.app
> GitHub: https://github.com/cslis07/travel-guide (Public, `master` 브랜치)

---

## 1. 프로젝트 목적

한국 여행자를 위한 **여행 통합 가이드 + 메타서치** 정적 웹 앱.

- 국내/해외 여행지 정보 + 실시간 관광 데이터(한국관광공사 TourAPI)
- **인천공항 실시간 정보** (혼잡도·주차·항공편·출국 준비 등 8개 탭)
- **투어·티켓·숙소·항공권 메타서치** (마이리얼트립 라이브 + 클룩·KKday·부킹·아고다 비교)
- 실시간 환율 + 계산기
- 빌드 단계 없는 순수 HTML/CSS/JS, Vercel 정적 + Edge Function 배포
- **수익화 지향**: 제휴(어필리에이트) 링크 설정 지점 마련

---

## 2. 현재 구현된 기능

### 메인 페이지 (`index.html`)

| 기능 | 설명 |
|------|------|
| 환율 바 | USD/JPY/EUR/VND/THB → KRW 실시간 (open.er-api.com) |
| 환율 계산기 | 금액 입력 → 6개 통화 즉시 변환 |
| 히어로 검색 위젯 | 항공권/숙소/국내여행 3탭 |
| 국내여행 검색 | TourAPI 지역·구군·업종·키워드 + 주차/카페 필터 + 상세 모달 |
| 인천공항 배너 | `/airport` 실시간 페이지로 이동 |
| 목적지 카드 | 9개 여행지 (일부 페이지는 미생성 — 남은 작업 참조) |
| nav | 여행지 / 🎟 투어·티켓 / 📖 이용가이드 / ✈ 인천공항 |

### 인천공항 실시간 (`airport.html`) — 8개 탭

| 탭 | 설명 |
|----|------|
| 진출입 현황 | 출발/도착편 실시간 |
| 주차장 현황 | T1·T2 주차면 + T1 구역별 |
| 셔틀·철도 | 공항버스/AREX/택시 시간표 |
| 출·입국장 | 터미널별 혼잡도 |
| 항공편 현황 | 출발/도착/수하물/운항마감 + 편명 검색 |
| 시설정보 | 상업시설·항공사 |
| ⭐ 내 편명 | 즐겨찾기 + **출발 카운트다운** + **게이트 변경 알림**(60초 자동갱신, OS Notification) + **ICS 캘린더 저장** + 편명 자동완성 |
| 🛫 출국 준비 | 6단계 진행 트래커 + 34항목 체크리스트 + 공항 가는 길 + **T1/T2 평면도(SVG)** + 라운지 9곳 + 공항 편의 9종 + 수하물/면세/반입금지 |

부가: **통합 검색(Ctrl+K)**, 공유 + URL 딥링크(`#tab=fav`), 다크모드(시스템 감지), 한/영 토글, **PWA**(홈 화면 추가, Service Worker 오프라인 캐싱), 모바일 최적화(44px 터치·헤더 압축·safe-area).

### 투어·티켓·숙소·항공 메타서치 (`tours.html`)

| 탭 | 라이브 | 비교 딥링크 |
|----|--------|------------|
| 🎟 투어·티켓 | 마이리얼트립 (searchTnas) | 클룩·KKday |
| 🏨 숙소 | 마이리얼트립 (searchStays) | 클룩·부킹닷컴·아고다 |
| 🛫 국내항공 | 마이리얼트립 (searchDomesticFlights) | — |
| 🌏 국제항공 | 마이리얼트립 (searchInternationalFlights) | — |

부가: **검색 히스토리**(최근 8건), **항공편 정렬**(가격/출발/소요), **날짜별 최저가 캘린더**(flightsFareCalendar), 항공사 코드→한글명 20종, 날짜 검증, XSS 방어, 중복요청 방지, 모바일 자동스크롤, aria-live, `?city=` 딥링크 자동검색, 제휴 링크 설정.

### 이용가이드 (`guide.html`)
- 8개 섹션 + 사이드바 TOC(스크롤 스파이) + 모바일 드로어 FAB
- 업데이트 내역(changelog), 색상 코드 섹션, 반응형

### 목적지 가이드 (`osaka.html`)
- 1인/친구/가족 유형별 일정·예산·숙소 + 환율 바 + 🎟 투어 검색 CTA(`tours.html?city=오사카`)

---

## 3. 수정한 주요 파일

### 프론트엔드
| 파일 | 내용 |
|------|------|
| `index.html` | 환율 바·계산기, 검색 위젯, 인천공항 배너, nav |
| `airport.html` | 인천공항 8탭 전체 (단일 파일, 인라인 CSS/JS) |
| `tours.html` | 메타서치 4탭 + 파트너 레지스트리 + 히스토리·정렬·캘린더 |
| `guide.html` | 이용가이드 (단일 파일) |
| `osaka.html` | 오사카 목적지 가이드 |
| `main.js` | 메인 페이지 로직 — 환율/계산기, TourAPI(프록시 경유), 상세 모달 |
| `style.css` | 공용 스타일 (`:root` 토큰: --primary #1B4FD8, --accent #F97316) |
| `sw.js` | PWA 서비스 워커 (HTML 네트워크 우선, 정적 캐시 우선) |
| `manifest.webmanifest` | PWA 매니페스트 |

### 백엔드 (Vercel Edge Functions)
| 파일 | 역할 |
|------|------|
| `api/tour.js` | 한국관광공사 TourAPI 프록시 (키 숨김 + 엔드포인트별 캐시 TTL) |
| `api/proxy.js` | 인천공항 공공데이터 프록시 (B551177) + 외부 URL(_url) 프록시 |
| `api/mrt.js` | 마이리얼트립 MCP 프록시 (stateless JSON-RPC tools/call) |

### 문서
| 파일 | 내용 |
|------|------|
| `README.md` | 로컬 개발(vercel dev) · 환경변수 · 배포 안내 |
| `API_SECURITY.md` | 키 환경변수화 · 활용신청 · KV 캐싱 운영 가이드 |
| `PROJECT_STATUS.md` | (이 문서) |

### `vercel.json`
- `cleanUrls: true`, `trailingSlash: false` (`.html` 없이 접근)

---

## 4. 남은 작업

### 🔴 사용자 직접 액션 (배포 안전·수익화)
1. **환경변수 등록** (Vercel Dashboard → Settings → Environment Variables)
   - `TOUR_API_KEY` (한국관광공사), `ICN_API_KEY` (인천공항) — 현재 폴백 키 하드코딩 상태. 등록 후 폴백 제거 권장. 절차: `API_SECURITY.md`
2. **data.go.kr 정식 활용신청** — 현재 일 1만 건 제한 → 신청 시 일 10만 건
3. **제휴(어필리에이트) 발급값 입력**
   - `tours.html`의 `MRT_AFFILIATE.value` (마이리얼트립 파트너스)
   - `PARTNERS[].aff` (클룩 aid, KKday cid, 부킹 aid, 아고다 cid)

### 🟡 기능 개선
- **목적지 가이드 확장**: 현재 오사카·후쿠오카·도쿄 3곳 완성. 나머지(교토·방콕·다낭·발리·싱가포르·제주·부산·강릉)는 `tours.html?city=` 실시간 검색으로 우회 중 → 원하면 가이드 페이지 추가 제작
- **Vercel KV 캐싱**: 트래픽 5K+ PV/일 도달 시 `api/tour.js`에 KV 추가 (가이드: `API_SECURITY.md`)
- **GA4 활성화**: `analytics.js`의 `GA4_ID`에 측정 ID 입력 시 방문·전환 수집 시작
- airport.html 경량화(gzip 후 45KB로 실사용 무리 없음, 필요 시 데이터 외부화)

### 🟢 아이디어
- 메인 페이지에 인기 투어 위젯
- 관심 상품 저장(찜)
- SEO용 블로그 콘텐츠 (수익화 논의에서 제안됨)

### ✅ 완료된 완성도 보강 (2026-07-07)
- 깨진 목적지 링크 21개 제거, SEO 메타(OG·JSON-LD·sitemap·robots·canonical) 완비
- OG 이미지·favicon 생성, PWA 설치 지원(PNG 아이콘·shortcuts)
- 법적 페이지(privacy·terms), 애널리틱스 로더, 전역 에러 핸들러
- Chart.js 지연 로딩(모바일 미로드), 스모크 테스트(`scripts/smoke_test.mjs`)

---

## 5. 실행 명령어

```bash
# ⚠️ API(TourAPI·인천공항·마이리얼트립)를 쓰려면 vercel dev 필수
#    Edge Function은 Vercel 런타임에서만 실행 → npx serve는 /api/* 404
npx vercel dev              # http://localhost:3000  (API 포함 전체)

# 정적 UI만 빠르게 (API 없이)
npx serve -l 3333 .         # http://localhost:3333  (검색 기능은 404)

# 배포
git push origin master      # → Vercel 자동 프로덕션 배포
npx vercel --prod           # 수동 배포

# 프로덕션 스모크 테스트 (핵심 14페이지 + 2 API 자동 점검)
node scripts/smoke_test.mjs

# 아이콘·OG 이미지 재생성 (Pillow 필요)
py scripts/make_icons.py    # PWA 아이콘 PNG
py scripts/make_og.py       # OG 소셜 이미지

# (있다면) .claude/launch.json 에 두 설정 등록됨:
#   travel-guide-api (vercel dev, 3000) / travel-guide (serve, 3333)
```

> GitHub `master` push 시 Vercel이 자동 빌드·배포합니다.

---

## 6. 배포 관련 주의사항

| 항목 | 내용 |
|------|------|
| 자동 배포 | GitHub `master` push → Vercel 자동 프로덕션 |
| **로컬 API 테스트** | `npx serve`는 `/api/*` 404 → **반드시 `vercel dev`** 사용 |
| Edge Function | `api/*.js`는 `export const config = { runtime: 'edge' }` — Node 내장모듈 불가, Web Fetch만 |
| cleanUrls | `.html` 없이 접근 (`/tours` = `tours.html`). `redirects` 추가 금지(과거 루프 발생) |
| 키 노출 | Public 레포이므로 폴백 키가 코드에 남음 → 환경변수 등록 후 폴백 제거 권장 |
| 커밋 메시지 한글 | PowerShell 히어독은 내부 따옴표(`"`)에서 파싱 깨짐 → **Bash로 single-quote 메시지** 커밋 권장 |
| 마이리얼트립 MCP | stateless·인증 불필요 → `api/mrt.js` 환경변수 없음 |
| 제휴 정책 | 상업적 사용 시 각 플랫폼(마이리얼트립·클룩·아고다 등) 약관 확인 |

---

## 7. 최근 발생한 에러와 해결 방법

### tours.html 항공편 탭이 항상 "검색 결과 없음"
- **원인**: `summarize()`가 `products`/`stays`만 탐색. 항공편 응답은 `result.items[]` 구조라 매칭 실패
- **해결**: 전용 `renderFlights()` 신설 — `data.result.items`에서 항공사·시간·소요·가격·예약URL·최저가배지 추출해 카드 렌더

### 검색어 XSS/HTML 깨짐
- **원인**: 사용자 검색어를 CTA 텍스트·URL에 이스케이프 없이 삽입 (`"`, `<` 입력 시 깨짐)
- **해결**: `esc()` 함수로 모든 사용자 입력 이스케이프

### guide.html에 존재하지 않는 기능이 문서화됨
- **원인**: 과거 8기능 커밋(`1593d8e`)이 revert되며 즐겨찾기/검색히스토리/내주변/날씨가 사라졌는데 가이드엔 남음
- **해결**: 실제 코드와 대조해 해당 설명 제거, 실존 기능(카페 카테고리·상세정보)으로 교체

### 환율 계산기가 메인에서 사라짐
- **원인**: 위 revert 때 함께 삭제됨
- **해결**: HTML(fxCalcBar) + JS(calcFx, _fxRates) + CSS 복원

### 로컬 `npx serve`에서 국내여행 검색 404
- **원인**: `/api/tour` Edge Function은 Vercel 런타임 전용. 정적 서버는 실행 못 함
- **해결**: 코드 버그 아님. 로컬은 `vercel dev` 사용. README에 명시

### 마이리얼트립 응답이 위젯 UI JSON
- **원인**: MCP 응답이 마이리얼트립 자체 위젯 렌더용 트리 또는 `copy_text`(마크다운 요약) 형태
- **해결**: 프록시가 `copy_text` 우선 반환, 없으면 `products`/`stays`/`result` 구조 요약

### 커밋 메시지 한글 파싱 깨짐 (PowerShell)
- **원인**: PowerShell 히어독(`@' '@`) 내부에 `"..."` 따옴표가 있으면 pathspec 오류
- **해결**: Bash에서 single-quote 멀티라인 메시지로 커밋

---

## 8. API 구조

### 8.1 한국관광공사 TourAPI — `api/tour.js`
```
브라우저 → /api/tour?path=areaBasedList2&areaCode=39&...
        → Edge Function (TOUR_API_KEY 주입, 캐시)
        → https://apis.data.go.kr/B551011/KorService2/<path>
```
| 항목 | 값 |
|------|-----|
| Base | `https://apis.data.go.kr/B551011/KorService2` |
| 허용 엔드포인트 | areaBasedList2, searchKeyword2, locationBasedList2, detailCommon2, detailIntro2, detailImage2 |
| 캐시 TTL | 검색 5분 / 위치 3분 / 상세 30분~1시간 |
| 키 | `process.env.TOUR_API_KEY` 우선, 폴백 상수 |
| 헤더 | `Cache-Control: s-maxage`, `Access-Control-Expose-Headers` |

### 8.2 인천공항 공공데이터 — `api/proxy.js`
```
브라우저 → /api/proxy?path=<path>&...   (인천공항 API)
        → /api/proxy?_url=<full-url>    (Open-Meteo 등 외부)
        → Edge Function (ICN_API_KEY 주입)
```
| 항목 | 값 |
|------|-----|
| Base | `https://apis.data.go.kr/B551177` |
| 키 | `process.env.ICN_API_KEY` 우선, 폴백 |
| 캐시 | `s-maxage=30` |

### 8.3 마이리얼트립 MCP — `api/mrt.js`
```
브라우저 → POST /api/mrt  { tool, arguments }
        → Edge Function (JSON-RPC tools/call 전달, 인증 불필요)
        → https://mcp-servers.myrealtrip.com/mcp  (stateless)
        ← content[0].text (copy_text 마크다운 or 구조화 JSON)
```
| 항목 | 값 |
|------|-----|
| 엔드포인트 | `https://mcp-servers.myrealtrip.com/mcp` |
| 프로토콜 | JSON-RPC 2.0 `tools/call` — initialize/세션 불필요 |
| 허용 도구 | getCurrentTime, searchDomesticFlights, searchInternationalFlights, flightsFareCalendar, getPromotionAirlines, searchStays, getStayDetail, getCategoryList, searchTnas, getTnaDetail, getTnaOptions |
| 응답 파싱 | JSON 또는 SSE(`data:`) 양쪽 처리 → `{ok, tool, copyText, text, data}` |
| 캐시 | `s-maxage=60` |

**데이터 구조 참고**
- `searchStays` / `searchTnas`: `copy_text`(마크다운) + `widget` UI 또는 `{products/stays}`
- `searchDomesticFlights` / `searchInternationalFlights`: `data.result.items[]` = `{airline, outbound{departTime,arriveTime,durationMinutes,flightNumber}, price.total, reservationUrl, isCheapest}`
- `flightsFareCalendar`: `data.result.{cheapest, items[]}` = `{departureDate, returnDate, airline, totalPrice}` (⚠️ 실시간 아님)

### 8.4 제휴 딥링크 (라이브 API 없음)
| 플랫폼 | 검색 URL | 제휴 파라미터 |
|--------|----------|--------------|
| 클룩 | `klook.com/ko/search/?query=` | aid, aff_adid |
| KKday | `kkday.com/ko/product/productlist?keyword=` | cid |
| 부킹닷컴 | `booking.com/searchresults.ko.html?ss=` | aid |
| 아고다 | `agoda.com/ko-kr/search?textToSearch=` | cid |

### 8.5 환율 API (`main.js` loadExchangeRates)
| 항목 | 값 |
|------|-----|
| API | `https://open.er-api.com/v6/latest/USD` |
| 인증 | 불필요 |
| 갱신 | 24시간 |
| 통화 | USD/JPY/EUR/VND/THB → KRW (+ 계산기 6통화) |

### 8.6 날씨/대기질 (인천공항)
| 항목 | 값 |
|------|-----|
| API | Open-Meteo (`api/proxy.js`의 `_url` 프록시 경유) |
| 인증 | 불필요 |
