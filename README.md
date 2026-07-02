# ✈ 트립가이드 (Travel Guide)

국내·해외 여행 + 인천공항 실시간 정보를 통합한 정적 웹 앱.

- **배포**: https://travel-guide-cslis07.vercel.app
- **인천공항**: https://travel-guide-cslis07.vercel.app/airport
- **이용가이드**: https://travel-guide-cslis07.vercel.app/guide.html

---

## 🗂 구조

```
index.html        메인 (환율·계산기·검색 위젯·목적지 카드)
airport.html      인천공항 실시간 (8개 탭)
guide.html        이용가이드
osaka.html …      목적지 가이드 (오사카·후쿠오카·도쿄·제주·부산·강릉)
main.js           메인 페이지 로직 (TourAPI·환율)
style.css         공용 스타일
api/tour.js       TourAPI 프록시 Edge Function
api/proxy.js      인천공항 공공데이터 프록시 Edge Function
sw.js             PWA 서비스 워커
manifest.webmanifest
```

---

## 💻 로컬 개발

### ⚠️ 중요: API를 쓰려면 `vercel dev` 필요

국내여행 검색·인천공항 데이터는 `api/*.js` **Edge Function**을 통해 동작합니다.
Edge Function은 **Vercel 런타임에서만** 실행되므로, 정적 서버(`npx serve`)로는 `/api/*`가 404가 납니다.

| 명령 | API 동작 | 용도 |
|------|:-------:|------|
| `npx vercel dev` (포트 3000) | ✅ | **API 포함 전체 기능 테스트** |
| `npx serve -l 3333 .` (포트 3333) | ❌ (404) | 정적 UI/CSS만 빠르게 확인 |

```bash
# 전체 기능 (API 포함) — 권장
npx vercel dev
# → http://localhost:3000

# 정적 UI만 (API 없이 빠른 미리보기)
npx serve -l 3333 .
# → http://localhost:3333  (국내여행 검색·인천공항 데이터는 404)
```

> `vercel dev` 최초 실행 시 프로젝트 링크(로그인)를 물어봅니다. 로컬에서 API 키를 쓰려면 아래 환경변수를 `.env.local` 또는 `vercel env`로 설정하세요.

---

## 🔑 환경변수

| 변수 | 용도 | 필수 |
|------|------|:---:|
| `TOUR_API_KEY` | 한국관광공사 TourAPI 키 | 권장 (미설정 시 폴백 키) |
| `ICN_API_KEY` | 인천공항 공공데이터 키 | 권장 (미설정 시 폴백 키) |

- Vercel Dashboard → Settings → Environment Variables 에 등록
- 자세한 절차·활용신청·KV 캐싱은 [`API_SECURITY.md`](API_SECURITY.md) 참조

---

## 🚀 배포

```bash
git push origin master   # → Vercel 자동 프로덕션 배포
```

- GitHub `master` push 시 Vercel이 자동 빌드·배포
- `cleanUrls` 활성화 → `.html` 없이 접근 가능 (`/airport` = `airport.html`)

---

## 🧩 데이터 출처

- 한국관광공사 TourAPI (`KorService2`)
- 인천공항공사 공공데이터 (`B551177`)
- Open-Meteo (날씨·대기질)
- open.er-api.com (환율)
