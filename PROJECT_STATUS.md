# 트립가이드 (TripGuide) — PROJECT STATUS

> 마지막 업데이트: 2026-06-24  
> 배포 URL: https://travel-guide-cslis07.vercel.app  
> GitHub: https://github.com/cslis07/travel-guide (Public)

---

## 1. 프로젝트 목적

한국 여행자를 위한 정적 여행 가이드 사이트.
- 국내/해외 여행지 정보 제공
- 한국관광공사 TourAPI를 통해 실시간 국내 관광 정보 검색
- 실시간 환율 정보 (USD/JPY/EUR/VND/THB → KRW)
- 빌드 단계 없는 순수 HTML/CSS/JS, Vercel 정적 배포

---

## 2. 현재 구현된 기능

### 메인 페이지 (index.html)

| 기능 | 설명 |
|------|------|
| 히어로 검색 | 여행지 키워드 검색, 카테고리 필터 |
| 환율 바 | USD/JPY/EUR/VND/THB 실시간 환율 (open.er-api.com) |
| 목적지 카드 | 필터링(국내/아시아/유럽 등) |
| 퀵북 바 | 항공·호텔·투어 외부 링크 모음 |

### 국내여행 검색 (TourAPI)

| 기능 | 설명 |
|------|------|
| 위젯 검색 | 시/도, 구/군, 업종, 키워드 입력 후 검색 |
| 필터 바 | 검색 결과 화면 상단에 sticky로 표시, 실시간 재검색 |
| 지역 필터 | 17개 시/도 + 각 구/군 연동 (SIGUNGU_MAP) |
| 업종 필터 | 관광지/문화시설/축제·행사/레포츠/숙박/음식점/카페 |
| 카페 카테고리 | contentTypeId=39 + cat3=A05020700(카페/전통찻집) 조합 |
| 키워드 검색 | 400ms 디바운스, searchKeyword2 엔드포인트 사용 |
| 주차 필터 | detailIntro2 배치 호출(Promise.all)로 주차 여부 판별 |
| 더 보기 | 20개씩 페이지네이션, 전체 개수 표시 |
| 깨진 이미지 | onerror 핸들러 → 카테고리 아이콘 + 장소명으로 대체 |

### 오사카 페이지 (osaka.html)
- 1인/친구/가족 여행 유형별 일정·예산·숙소 안내
- 환율 바 포함

### 공항 페이지 (airport.html)
- 공항 이용 가이드

---

## 3. 수정한 주요 파일

### `main.js`

| 항목 | 내용 |
|------|------|
| `loadExchangeRates()` | open.er-api.com/v6/latest/USD 호출, 5개 통화 KRW 환산 |
| `CTYPE_MAP` / `CTYPE_ICON` | 카페 포함 7개 업종 코드 매핑 |
| `SPECIAL_CTYPE` | 특수 카테고리 (cat3 오버라이드 패턴) |
| `SIGUNGU_MAP` | 전국 17개 시/도 + 구/군 코드 전체 |
| `_dom` 상태 객체 | areaCode, sigunguCode, contentTypeId, keyword, pageNo, numOfRows, totalCount, loaded |
| `_parkingCache` / `_parkingActive` | 주차 필터 상태 |
| `updateSigunguOptions()` | 시/도 선택 시 구/군 드롭다운 동적 생성 |
| `_fetchDomesticPage()` | SPECIAL_CTYPE 분기, keyword/area 엔드포인트 분기 |
| `_batchFetchParking()` | detailIntro2 배치 호출 (Promise.all) |
| `loadMoreDomestic()` | 더 보기 버튼 핸들러 |
| `_updateDomMoreBtn()` | 더 보기 버튼 표시/숨김 + inline style 초기화 |

**TourAPI 키 위치:** `main.js` line ~242 — `_TOUR_KEY` 상수에 하드코딩  
⚠️ 레포가 PUBLIC이므로 키가 외부에 노출됨. 현재 사용자 동의 하에 유지.

### `index.html`
- 환율 바 HTML (`#fxBar`) 추가
- 국내여행 위젯: 구/군 선택(`#sw-sigungu`), 키워드 입력(`#sw-keyword`) 추가
- 필터 바 (`#domFilterBar`) 추가 — dfArea/dfSigungu/dfCtype/dfKeyword/dfParkingBtn
- 더 보기 버튼 래퍼 (`#domesticMoreWrap`) 추가
- 업종 select에 `☕ 카페` 옵션 추가 (sw-ctype, dfCtype 양쪽)

### `osaka.html`
- 환율 바 HTML 추가

### `style.css`
- PC 환율 바: padding 7px, 폰트 13px, 배경 #EEF2FF, 테두리 #C7D2FE
- 모바일(640px) 환율 바: padding 축소, `fx-pair` 숨김
- 모바일 퀵북: flex 가로 스크롤, 아이콘+레이블 세로 배치
- `.dom-filterbar`: sticky top:61px, z-index 50
- `.dom-thumb--empty`: 카테고리 아이콘+이름 레이아웃
- `.dom-more-wrap`, `.dom-more-btn`, `.dom-count`
- `.dom-fb-parking-btn` (토글 active 상태 포함)

### `vercel.json`
- `redirects` 배열 전체 제거 (cleanUrls와의 충돌 해소)
- 현재: `cleanUrls`, `trailingSlash`, `headers`만 유지

---

## 4. 남은 작업

### 미완성 목적지 페이지 (현재 준비중/404)
- 해외: 후쿠오카, 도쿄, 교토, 방콕, 다낭, 발리, 싱가포르
- 국내: 제주도, 부산, 강릉

### 개선 가능 항목
- TourAPI 키를 환경변수 또는 서버리스 프록시로 보호 (현재 하드코딩 노출)
- 더 보기 후 필터 변경 시 스크롤 위치 유지
- 오사카 외 해외 페이지에도 TourAPI 연동 고려

---

## 5. 실행 명령어

```bash
# 개발 서버 (로컬)
cd C:\Users\GB\Documents\travel-guide
npx serve .           # 또는 VS Code Live Server

# Vercel 배포 — 프리뷰
npx vercel

# Vercel 배포 — 프로덕션
npx vercel --prod

# SSO 보호 비활성화 (다른 기기에서 로그인 없이 접근)
npx vercel project protection disable travel-guide --sso

# Git 커밋 & 푸시 (자동 배포 트리거)
git add -A && git commit -m "메시지" && git push origin main
```

> Vercel은 GitHub main 브랜치 push 시 자동으로 프로덕션 배포됩니다.

---

## 6. 배포 관련 주의사항

| 항목 | 내용 |
|------|------|
| 자동 배포 | GitHub main push → Vercel 자동 프로덕션 배포 |
| cleanUrls | `.html` 확장자 없이 URL 접근 가능 (`/osaka` = `osaka.html`) |
| redirects 금지 | `vercel.json`에 `redirects` 추가 시 cleanUrls와 충돌 → 리다이렉트 루프 발생 |
| SSO 보호 | Vercel은 private 레포 연결 시 SSO를 자동 활성화. 비활성화 명령어는 위 참조 |
| GitHub Public | 레포가 공개이므로 TourAPI 키 노출됨 (현재 동의 하에 유지) |
| CORS | TourAPI는 브라우저 직접 호출 허용 (프록시 불필요) |

---

## 7. 발생했던 에러와 해결 방법

### ERR_TOO_MANY_REDIRECTS
- **원인:** `vercel.json`에 `cleanUrls: true`와 `redirects` 규칙이 동시 적용돼 루프 발생
- **해결:** `redirects` 배열 전체 삭제. `cleanUrls`가 `.html` 처리를 자동으로 담당함

### 다른 기기에서 "로그인 필요" 오류
- **원인:** GitHub 레포를 private → public으로 변경하는 과정에서 Vercel SSO 자동 활성화
- **해결:** `npx vercel project protection disable travel-guide --sso`

### "더 보기" 버튼 필터링 후 사라지는 버그
- **원인:** `_updateDomMoreBtn()`이 모든 아이템 로드 완료 시 `style.display = 'none'`(inline)으로 숨김. 이후 새 검색은 CSS class로만 초기화해서 inline style이 우선 적용되어 버튼이 안 보임
- **해결:**
  1. `_updateDomMoreBtn()` 내에서 아이템 남아있을 때 `moreBtn.style.display = ''` 명시적 초기화
  2. `searchDomestic()`, `onDomFilterChange()` 시작 시 `domesticMoreBtn.style.display = ''` 리셋

### TourAPI 결과 12개만 로드
- **원인:** 초기 `numOfRows: 12` 설정
- **해결:** `numOfRows: 20` + pageNo 기반 페이지네이션 구현

### style.css Edit 실패 ("string not found")
- **원인:** Edit 도구에 전달한 문자열이 실제 파일 내용과 미세하게 불일치
- **해결:** Grep으로 실제 문자열 확인 후 정확히 일치하는 범위를 사용

---

## 8. TourAPI 구조

### 기본 정보

| 항목 | 값 |
|------|-----|
| Base URL | `https://apis.data.go.kr/B551011/KorService2` |
| 공통 필수 파라미터 | `serviceKey`, `MobileOS=ETC`, `MobileApp=TripGuide`, `_type=json` |
| 키 위치 | `main.js` `_TOUR_KEY` 상수 (line ~242) |
| 키 방식 | Decoded 키 사용 (URL 인코딩 전 원문) |

### 주요 엔드포인트

| 엔드포인트 | 용도 | 주요 파라미터 |
|-----------|------|-------------|
| `areaBasedList2` | 지역 기반 목록 조회 | `areaCode`, `sigunguCode`, `contentTypeId`, `cat3`, `pageNo`, `numOfRows` |
| `searchKeyword2` | 키워드 검색 | `keyword`, `areaCode`, `contentTypeId`, `pageNo`, `numOfRows` |
| `detailCommon2` | 상세 공통 정보 | `contentId`, `contentTypeId`, `defaultYN=Y`, `overviewYN=Y` |
| `detailIntro2` | 업종별 상세 정보 | `contentId`, `contentTypeId` — 주차 여부 포함 |
| `detailImage2` | 상세 이미지 목록 | `contentId`, `imageYN=Y` |
| `locationBasedList2` | 위치 기반 조회 | `mapX`, `mapY`, `radius` |

### 카테고리 코드

| contentTypeId | 업종 | SPECIAL_CTYPE |
|--------------|------|--------------|
| 12 | 관광지 | — |
| 14 | 문화시설 | — |
| 15 | 축제·행사 | — |
| 28 | 레포츠 | — |
| 32 | 숙박 | — |
| 39 | 음식점 | — |
| cafe (가상 키) | 카페 | contentTypeId=39, cat3=A05020700 |

### 페이지네이션 응답 구조

```json
{
  "response": {
    "body": {
      "items": { "item": [...] },
      "totalCount": 150,
      "numOfRows": 20,
      "pageNo": 1
    }
  }
}
```

> `totalCount`는 전체 결과 수. `_dom.loaded`와 비교해 "더 보기" 버튼 표시 여부 결정.

### 주차 필터 구현 방식

TourAPI 목록 엔드포인트는 주차 정보를 미제공 → `detailIntro2`를 개별 호출해야 함.

```javascript
// 현재 화면 카드 전체에 대해 배치 호출
const results = await Promise.all(
  items.map(item => fetch(detailIntro2Url(item.contentid, item.contenttypeid)))
);
// parkingLodging / parkingFacility / parking 필드 확인
```

> 주차 필터 활성화 시 현재 페이지 카드 수만큼 API 호출 발생 (네트워크 비용 주의).

---

## 환율 API

| 항목 | 값 |
|------|-----|
| API | `https://open.er-api.com/v6/latest/USD` |
| 인증 | 불필요 (무료 플랜) |
| 갱신 주기 | 24시간 |
| 지원 통화 | USD, JPY, EUR, VND, THB → KRW 환산 |
| 위치 | `main.js` `loadExchangeRates()` 함수 |
