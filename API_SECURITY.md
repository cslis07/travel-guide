# API 보안·캐싱 가이드

> 트래픽이 늘기 전에 반드시 마무리해야 할 인프라 보강 항목 모음

## ✅ 완료된 작업 (이 PR)

| # | 항목 | 변경 |
|---|------|------|
| 1 | `api/tour.js` Edge Function 추가 | TourAPI 키를 서버에서 주입, 브라우저 노출 X |
| 2 | `main.js` TourAPI 호출 전부 전환 | 모든 검색/상세/주차/위치 호출이 `/api/tour` 경유 |
| 3 | Edge Cache 헤더 추가 | `s-maxage=300` (5분) — 같은 검색을 100명이 해도 실제 API는 ~1회 |
| 4 | `sw-apikey-row` 입력 UI 제거 | 사용자가 키를 다룰 필요 없음 |
| 5 | 에러 메시지 친절하게 | 키 안내 → "잠시 후 다시 시도해주세요" |

---

## 🔑 직접 해야 할 작업 (Vercel 대시보드)

### Step 1 — TourAPI 키를 환경변수로 등록 (가장 중요)

1. https://vercel.com/dashboard → `travel-guide` 프로젝트
2. **Settings → Environment Variables**
3. 추가:
   - **Name**: `TOUR_API_KEY`
   - **Value**: 공공데이터포털에서 **새로 발급한** 키(Decoding 값)
     (예전 키는 공개 저장소에 올라간 적이 있어 재발급 대상 — 옛 키를 그대로 넣지 말 것)
   - **Environments**: Production / Preview / Development 모두 체크
4. **Save** → Vercel이 자동 재배포

> `TOUR_API_KEY`가 등록되지 않아도 폴백 키가 동작하지만, 노출 위험이 남으므로 **반드시 등록 후 main.js에서 폴백 키 제거** 권장.

### Step 2 — Edge Function 동작 확인

배포 후 브라우저 콘솔에서:
```js
fetch('/api/tour?path=areaBasedList2&areaCode=39&numOfRows=3')
  .then(r => r.json()).then(console.log)
```

`response.body.items.item` 배열이 보이면 성공.

응답 헤더에 `X-Tour-Cache-TTL: 300`, `Cache-Control: s-maxage=300...` 확인.

---

## 🚀 Step 3 — data.go.kr 정식 활용신청 (한도 10배 ↑)

현재 키는 "샘플 일반 인증키"라서 **일 1만 건 제한**.
정식 활용신청을 하면 **일 10만 건**까지 자동 승인됩니다.

1. https://www.data.go.kr/data/15101578/openapi.do — TourAPI 4.0 페이지
2. 로그인 → **활용신청** 버튼
3. 양식 작성:
   - **활용목적**: "여행 정보 통합 가이드 웹사이트 (트래블코스트) — 사용자가 국내 관광지·맛집·숙박을 통합 검색"
   - **시스템 유형**: 웹사이트
   - **사용 트래픽**: 일 10만건
   - **상세 기능**: 지역·키워드 검색, 상세 정보, 이미지, 주변 시설 위치 검색
4. 일반적으로 **즉시 자동 승인** (활용신청 → My Page → 인증키 확인)
5. 발급된 새 키를 위 Step 1의 `TOUR_API_KEY` 값으로 교체

---

## 💎 Step 4 — Vercel KV 캐싱 (선택, 트래픽 10K PV/일 이후)

Edge Cache(`s-maxage`)만으로도 인기 검색은 5분 단위 캐싱이 됩니다. KV는 그 위에 **명시적 영속 캐싱**을 더하는 용도.

### KV 만들기
1. Vercel 대시보드 → **Storage → Create Database → KV**
2. 프로젝트 연결 → 환경변수 자동 생성:
   - `KV_URL`
   - `KV_REST_API_URL`
   - `KV_REST_API_TOKEN`
   - `KV_REST_API_READ_ONLY_TOKEN`

### `api/tour.js`에 KV 연동 추가

```js
import { kv } from '@vercel/kv';

// fetch 직전에 캐시 조회
const cacheKey = `tour:${path}:${params.toString()}`;
const cached = await kv.get(cacheKey).catch(() => null);
if (cached) return new Response(JSON.stringify(cached), { ... });

// fetch 후
const json = JSON.parse(text);
await kv.set(cacheKey, json, { ex: ttl }).catch(() => {});
```

> 무료 티어: 30,000 명령/월. Edge Cache 이후의 캐시 미스만 KV가 받아내므로 사실상 무료로 충분.

### `package.json`에 의존성 추가
```json
{
  "dependencies": {
    "@vercel/kv": "^2.0.0"
  }
}
```

---

## 🛡️ Step 5 — 인천공항 API 키도 환경변수로

`api/proxy.js`에 현재 인천공항 키도 하드코딩되어 있습니다.

```js
// 변경 전
const KEY = '(하드코딩 키)';

// 변경 후
const KEY = process.env.ICN_API_KEY || '(폴백 키)';
```

환경변수 `ICN_API_KEY` 도 같은 방식으로 등록 + GitHub Public이라 폴백 키는 결국 노출이라 **활용신청 후 새 키 발급 → 폴백 키 제거** 권장.

---

## 🔐 2026-10-25 보강 — 키 상태 확인·호출 보호

- **키 상태 확인**: `/api/proxy`·`/api/tour` 응답 헤더 `X-Key-State`
  - `env-new` = 새 키가 환경변수로 등록됨(정상) · `env-old` = 환경변수는 있으나 공개됐던 옛 키 그대로 · `fallback` = 환경변수 없음
  - 키 값은 내보내지 않음(옛 키 sha256 앞 16자와만 비교, `api/_guard.js`)
  - 확인: `curl -sI "https://travelcost.co.kr/api/proxy?path=passgrAnncmt/getPassgrAnncmt&numOfRows=1" | grep -i x-key-state`
- **남의 사이트 차단**: 브라우저 `Origin`이 travelcost.co.kr·*.vercel.app·로컬이 아니면 403 (`api/_guard.js` `foreignOrigin`)
- **호출 제한**: IP당 1분 120회(proxy·tour), 60회(mrt) 넘으면 429. CDN 캐시 적중은 함수까지 안 오므로 세지 않음
- **키 교체 순서**: ① 공공데이터포털 마이페이지 → 인증키 재발급 ② Vercel → Settings → Environment Variables에 `ICN_API_KEY`·`TOUR_API_KEY` 등록(Production·Preview) ③ Redeploy ④ 위 헤더가 `env-new`인지 확인 ⑤ `api/proxy.js`·`api/tour.js`의 폴백 키 줄 삭제
- **2026-10-26**: Vercel Production에 `ICN_API_KEY`·`TOUR_API_KEY` 등록, 코드의 폴백 키 삭제(`b3301c7`). 현재 `X-Key-State: env-old`(등록값이 공개됐던 예전 키) → 재발급 후 `npx vercel env rm` + `npx vercel env add`로 새 값 교체, 재배포

## 📈 호출량 상한(쿼터) 계산

| 함수 | CDN 캐시 | 같은 요청의 상류 호출 최대 |
|---|---|---|
| `/api/proxy` 인천공항 실시간 | 30초(+60초 재검증) | 요청 종류당 하루 ≤ 2,880회 |
| `/api/proxy` Open-Meteo | 30초 | 도시·종류당 하루 ≤ 2,880회 (Open-Meteo 무료 1만/일) |
| `/api/tour` TourAPI | 3분~24시간 | 검색어·지역당 하루 ≤ 480회 |
| `/api/hotelidx`·`hotelprice` | 엔드포인트별 s-maxage | — |

- **실호출 계측**: CDN 캐시를 지나 공공 API까지 간 호출은 함수 로그에 `{"upstream":"proxy","api":…,"status":…}` 한 줄씩 남음 → Vercel 대시보드 Logs에서 `upstream` 검색으로 하루 호출 수 확인
- 인천공항 화면 첫 로드 = API 5회, 가이드 1회, 홈·투어 0회(2026-10-25 실측).
- 공공데이터포털 개발계정 기본 한도는 API마다 다름(보통 1일 1만 회) — 키 재발급 때 마이페이지에서 실제 한도를 확인해 이 표에 적을 것.

## 📊 트래픽 단계별 점검 체크리스트

| 트래픽 단계 | 점검 항목 |
|-----------|----------|
| 일 ~1,000 PV | Step 1만 해도 안전 |
| 일 ~5,000 PV | Step 3 (활용신청) 추가 권장 |
| 일 ~30,000 PV | Step 4 (KV 캐싱) 활성화 |
| 일 ~100,000 PV | Vercel Pro $20/월 전환, KV 사용량 모니터 |
| 일 ~300,000 PV | 자체 백엔드 캐시(Redis) + Cloudflare 검토 |

---

## 🧪 빠른 검증 명령 (배포 후)

```bash
# Edge 캐싱 헤더 확인
curl -I "https://travelcost.co.kr/api/tour?path=areaBasedList2&areaCode=39&numOfRows=1"

# 응답 본문 확인
curl "https://travelcost.co.kr/api/tour?path=areaBasedList2&areaCode=39&numOfRows=1" | jq

# 같은 URL 두 번째 호출이 Edge Cache에서 오는지 (X-Vercel-Cache: HIT)
curl -I "https://travelcost.co.kr/api/tour?path=areaBasedList2&areaCode=39&numOfRows=1"
```
