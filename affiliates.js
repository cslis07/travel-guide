/* ═══════════════════════════════════════════════════════════
   트래블코스트 — 제휴(어필리에이트) 공용 레지스트리

   설계 근거
   · 여행 업계는 "링크 제휴는 열려 있고 가격 API는 닫혀 있다".
     그래서 라이브 가격은 마이리얼트립 MCP 한 곳뿐이고,
     나머지는 검색어를 각 플랫폼으로 넘기는 딥링크로 처리한다.
     이 파일은 그 딥링크에 추적 파라미터를 붙이는 단일 지점이다.
   · 발급값(aff)이 비어 있으면 추적 없는 일반 링크로 조용히 동작한다.
     → 파트너스 승인 전에도 사이트는 정상 작동하고, 승인 후엔 이 파일만 고치면 된다.
   · 카테고리별로 "붙일 수 있는가"가 다르다. monetizable 플래그로 구분한다.
     법적으로 개인이 수수료를 받기 어려운 영역(보험·환전)은 정보 제공만 한다.

   ⚠️ 수익 고지 의무
   공정거래위원회 「추천·보증 등에 관한 표시·광고 심사지침」상
   대가를 받는 링크는 경제적 이해관계를 명시해야 한다.
   AFF.disclosure() 를 제휴 링크가 있는 모든 페이지에 노출할 것.
   ═══════════════════════════════════════════════════════════ */
(function (global) {
  'use strict';

  /* ── 파트너 레지스트리 ────────────────────────────────────
     aff: 파트너스 가입 후 발급받는 추적 파라미터. 빈 객체면 일반 링크.
     signup: 제휴 신청 경로(가입 시 조건·수수료율 직접 확인 필요).
     types: 이 파트너가 커버하는 카테고리.
     ───────────────────────────────────────────────────────── */
  /* ⚠️ 트립닷컴 숙소는 `keyword=`가 통하지 않는다.
     `hotels/list?keyword=제주`는 200을 주지만 본문이 "검색 결과가 없음"이다(실측).
     반드시 도시 ID가 필요하다 — `city=737` 은 제주 호텔 123건이 정상 표출된다.
     ID는 트립닷컴 제휴 링크 생성기('호텔 페이지')에서 도시를 고르면 URL에 찍혀 나온다.
     같은 ID가 투어(`things-to-do/list?searchkey=`)에도 그대로 쓰인다.
     ⛔ 모르는 도시는 추측하지 말고 링크를 생략한다 — 엉뚱한 도시 호텔을 보여주느니 없는 게 낫다. */
  var TRIPCOM_CITY = {
    '제주': 737,
    '오사카': 219,
    '도쿄': 228,
    '후쿠오카': 248,
    '방콕': 359,
    '다낭': 1356,
    '부산': 253,
    '교토': 734,
    '삿포로': 641,
    '발리': 723,
    '싱가포르': 73,
    '파리': 192,
    '강릉': 61325   // 생성기 라벨은 "강릉시"지만 앱 dest().label은 "강릉" → 키를 맞춤
    // 목적지 가이드 13곳 전부 확보(2026-08-11).
    // 확보법: 링크생성기 '호텔 페이지'에서 도시 선택 → URL의 city= 숫자.
    //         같은 숫자가 투어(things-to-do/list?searchkey=)에도 그대로 쓰인다.
    //         각 city ID는 hotels/list 페이지 <title>로 도시명 일치 검증 완료.
  };

  /* 날짜 포맷 헬퍼 — 항공 딥링크가 요구하는 형태가 제각각이다 */
  function ymd(s) { return String(s || '').slice(0, 10); }          // 2026-09-10
  function yymmdd(s) { return ymd(s).replace(/-/g, '').slice(2); }  // 260910

  /* ⚠️ 여기 URL은 전부 실제 응답으로 확인한 것만 넣는다(2026-08-11 확인).
     추정으로 넣으면 조용히 404가 나간다 — 실제로 트립닷컴을 `searchresult/?keyword=`로
     넣었다가 404였고, 올바른 경로는 `things-to-do/list` / `hotels/list` 였다.
     403이 뜨는 곳(클룩·KKday)은 데이터센터 IP 차단이지 잘못된 주소가 아니다. */
  var PARTNERS = [
    {
      key: 'myrealtrip', label: '마이리얼트립', color: '#0BB8B4', bg: '#E6F8F7',
      base: 'https://www.myrealtrip.com/search', qkey: 'q',
      /* 항공은 제외 — 항공편 카드마다 이미 마이리얼트립 예약 링크가 붙고,
         비교 목록에 넣으면 검색어 없는 빈 링크가 나간다 */
      types: ['tna', 'stay'],
      signup: 'https://www.myrealtrip.com/partners',
      aff: {} /* 예: {utm_source:'...'} — 발급값으로 교체 */
    },
    {
      key: 'klook', label: '클룩', color: '#e8384f', bg: '#FFF0F3',
      base: 'https://www.klook.com/ko/search/', qkey: 'query',
      types: ['tna', 'stay'],
      signup: 'https://www.klook.com/ko/affiliate/',
      aff: {} /* {aid, aff_adid} */
    },
    {
      key: 'kkday', label: 'KKday', color: '#ff5b00', bg: '#FFF1E8',
      base: 'https://www.kkday.com/ko/product/productlist', qkey: 'keyword',
      types: ['tna'],
      signup: 'https://www.kkday.com/ko/affiliate',
      aff: {} /* {cid} */
    },
    {
      key: 'waug', label: '와그', color: '#7B4DFF', bg: '#F0ECFF',
      base: 'https://www.waug.com/search/', qkey: 'q',
      types: ['tna'],
      signup: 'https://www.waug.com/',
      aff: {}
    },
    {
      key: 'booking', label: '부킹닷컴', color: '#003580', bg: '#EAF0FF',
      base: 'https://www.booking.com/searchresults.ko.html', qkey: 'ss',
      types: ['stay', 'car'],
      signup: 'https://www.booking.com/affiliate-program/v2/index.html',
      aff: {} /* {aid} */
    },
    {
      key: 'agoda', label: '아고다', color: '#c1272d', bg: '#FDECEA',
      base: 'https://www.agoda.com/ko-kr/search', qkey: 'textToSearch',
      types: ['stay'],
      signup: 'https://partners.agoda.com/',
      aff: {} /* {cid} */
    },
    {
      key: 'tripcom', label: '트립닷컴', color: '#2577E3', bg: '#E9F2FF',
      types: ['tna', 'stay', 'flight', 'car', 'transfer'],
      signup: 'https://kr.trip.com/partners/',
      /* 2026-08-11 승인. 딥링크 생성기가 원본 URL을 보존하고 파라미터만 덧붙이는 방식이라
         고정값 3개를 여기 두면 동적으로 만드는 모든 링크가 자동으로 추적된다.
         제휴 ID는 어차피 아웃바운드 URL에 노출되는 값이라 비밀이 아니다(공개 리포 무관). */
      subKey: 'trip_sub1',
      urls: {
        tna:  { build: function (c) {
          /* 도시 ID가 있으면 searchkey= (그 도시 투어만 정확히), 없으면 keyword= 폴백.
             둘 다 실동작 확인됨(오사카 searchkey=219 / keyword=오사카). */
          var id = TRIPCOM_CITY[c && c.city];
          return id
            ? 'https://kr.trip.com/things-to-do/list?searchkey=' + id + '&searchtype=1'
            : 'https://kr.trip.com/things-to-do/list?keyword=' + encodeURIComponent((c && c.city) || '');
        } },
        stay: { build: function (c) {
          var id = TRIPCOM_CITY[c && c.city];
          if (!id) return null;          // ID를 모르면 링크를 만들지 않는다
          return 'https://kr.trip.com/hotels/list?city=' + id +
            '&optionId=' + id + '&optionType=City&optionName=' + encodeURIComponent(c.city);
        } },
        /* 렌터카·공항픽업은 둘 다 5% — 항공(0.5%)의 10배다.
           도시 파라미터 없이도 목적지 선택 UI가 있는 랜딩으로 보낸다. */
        car:      { base: 'https://kr.trip.com/carhire/' },
        transfer: { base: 'https://kr.trip.com/airport-transfers/' },
        flight: { build: function (c) {
          var rt = !!ymd(c.back);   // 오는 날이 없으면 편도로 넘겨야 한다
          return 'https://kr.trip.com/flights/showfarefirst?dcity=' +
            encodeURIComponent(String(c.origin || 'ICN').toLowerCase()) +
            '&acity=' + encodeURIComponent(String(c.dest || '').toLowerCase()) +
            '&ddate=' + ymd(c.out) +
            (rt ? '&rdate=' + ymd(c.back) : '') +
            '&triptype=' + (rt ? 'rt' : 'ow');
        } }
      },
      aff: { Allianceid: '9989477', SID: '328159469', trip_sub3: 'D19193218' }
    },
    {
      key: 'skyscanner', label: '스카이스캐너', color: '#0770E3', bg: '#E7F1FE',
      types: ['flight'],
      signup: 'https://www.partners.skyscanner.net/',
      urls: {
        flight: { build: function (c) {
          return 'https://www.skyscanner.co.kr/transport/flights/' +
            String(c.origin || 'icn').toLowerCase() + '/' +
            String(c.dest || '').toLowerCase() + '/' +
            yymmdd(c.out) + '/' + (c.back ? yymmdd(c.back) + '/' : '');
        } }
      },
      aff: {}
    },
    {
      key: 'airalo', label: 'Airalo', color: '#F4364C', bg: '#FFEFF1',
      base: 'https://www.airalo.com/ko', qkey: null,
      types: ['esim'],
      signup: 'https://www.airalo.com/affiliate-program',
      aff: {} /* {ref} */
    },
    {
      key: 'ubigi', label: 'Ubigi', color: '#00A3AD', bg: '#E4F7F8',
      base: 'https://cellulardata.ubigi.com/ko/', qkey: null,
      types: ['esim'],
      signup: 'https://cellulardata.ubigi.com/ko/affiliate/',
      aff: {}
    }
  ];

  /* ── 카테고리 정의 ────────────────────────────────────────
     monetizable:false = 개인이 수수료를 받기 어려운 영역.
       · insurance : 보험업법상 '모집' 규제. 보험대리점 등록 없이
                     수수료를 받는 구조는 위험 → 정보 제공만 한다.
       · fx        : 환전은 은행·인가 업자 영역. 제휴 링크 대상 아님.
     이 두 카테고리는 CTA를 만들지 않고 공식 사이트 안내만 노출한다.
     ───────────────────────────────────────────────────────── */
  /* 💰 트립닷컴 수수료율 (2026-08-11 커미션 플랜 기준)
     이 숫자가 화면 배치 순서를 결정한다. 클릭 한 번의 값어치가 10배까지 차이난다.
       숙소 5%(200건↑ 6%, 1000건↑ 7%) · 렌터카 5% · 공항픽업 5% · 호텔바우처 5% · 크루즈 5%
       액티비티(기타) 4% · 항공+호텔 2~2.5% · 기차 2% · 명소&공연 1.5%
       국제선 항공 0.5%(300건↑ 0.8%)
     ⚠️ 항공은 유효금액에서 **세금이 빠진다**. 실측: 오사카 왕복 226,900원의 내역이
        base 69,000 / tax 143,900 / tasf 10,000 → 수수료 기준액은 7만원대다.
        즉 항공은 수수료가 사실상 없다고 보고 "유입 도구"로만 쓴다.
     ⚠️ 어린이 항공권·할인코드·바우처·트립코인·보험 등 교차판매는 계산에서 제외된다. */
  var CATEGORIES = {
    stay:      { label: '숙소',        monetizable: true, rate: 5,   rank: 1 },
    car:       { label: '렌터카',      monetizable: true, rate: 5,   rank: 2 },
    transfer:  { label: '공항픽업',    monetizable: true, rate: 5,   rank: 3 },
    tna:       { label: '투어·티켓',   monetizable: true, rate: 4,   rank: 4 },
    pkg:       { label: '항공+숙소',   monetizable: true, rate: 2,   rank: 5 },
    flight:    { label: '항공',        monetizable: true, rate: 0.5, rank: 6 },
    esim:      { label: 'eSIM·데이터', monetizable: true },
    insurance: { label: '여행자보험',  monetizable: false,
                 why: '보험업법상 모집 규제 대상이라 제휴 수수료 구조를 붙이지 않습니다.' },
    fx:        { label: '환전',        monetizable: false,
                 why: '환전은 인가받은 금융기관 영역이라 제휴 대상이 아닙니다.' }
  };

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  /* 파트너 검색 URL 생성.
     타입별 전용 경로(urls[type])가 있으면 그것을 쓰고, 없으면 공용 base를 쓴다.
     항공처럼 검색어가 아니라 출발지·도착지·날짜가 필요한 경우는 build(ctx)로 만든다. */
  /* 클릭이 어느 페이지에서 났는지 식별하는 값.
     페이지마다 따로 지정하게 하면 언젠가 빠뜨리므로 경로에서 자동으로 만든다.
     예: /estimate + stay → "estimate-stay", /tours + flight → "tours-flight" */
  function subId(type) {
    var page = 'home';
    try {
      var last = String(location.pathname).replace(/\/+$/, '').replace(/\.html$/, '').split('/').pop();
      if (last) page = last;
    } catch (e) { /* location 접근 불가 환경 */ }
    return type ? page + '-' + type : page;
  }

  function url(p, query, type, ctx) {
    var spec = (p.urls && type && p.urls[type]) || { base: p.base, qkey: p.qkey };
    var raw;
    if (typeof spec.build === 'function') {
      /* 검색어를 도시명으로도 쓸 수 있게 보정한다(숙소는 city, 항공은 dest가 필요).
         정보가 모자라면 build 쪽에서 null을 돌려주고, 그러면 링크를 만들지 않는다. */
      var c = { city: (ctx && ctx.city) || query || '', sub: ctx && ctx.sub };
      if (ctx) { for (var ck in ctx) { if (c[ck] === undefined) c[ck] = ctx[ck]; } }
      raw = spec.build(c);
      if (!raw) return null;
    } else {
      raw = spec.base;
    }
    if (!raw) return null;
    var u;
    try { u = new URL(raw); } catch (e) { return raw; }
    if (!spec.build && spec.qkey && query) u.searchParams.set(spec.qkey, query);
    var aff = p.aff || {};
    for (var k in aff) { if (aff[k]) u.searchParams.set(k, aff[k]); }
    /* 추적 파라미터가 실제로 설정된 파트너에만 sub id를 붙인다 */
    if (p.subKey && Object.keys(aff).length) {
      u.searchParams.set(p.subKey, (ctx && ctx.sub) || subId(type));
    }
    return u.toString();
  }

  function byType(type) {
    return PARTNERS.filter(function (p) { return p.types.indexOf(type) > -1; });
  }

  /* 수수료 발생 가능 링크가 하나라도 있는지 — 고지 문구 노출 판단용 */
  function hasPaidLinks() {
    return PARTNERS.some(function (p) {
      return p.aff && Object.keys(p.aff).some(function (k) { return !!p.aff[k]; });
    });
  }

  /* 제휴 링크 버튼 묶음 HTML */
  function ctas(type, query, opts) {
    var cat = CATEGORIES[type];
    if (cat && cat.monetizable === false) return '';
    var o = opts || {};
    var list = byType(type);
    if (!list.length) return '';
    return list.map(function (p) {
      var href = url(p, query, type, o.ctx);
      if (!href) return '';                    // 만들 수 없는 링크는 내보내지 않는다
      var label = o.verb
        ? esc(p.label) + '에서 ' + esc(o.verb)
        : (query ? esc(p.label) + '에서 "' + esc(query) + '" 보기' : esc(p.label) + ' 바로가기');
      return '<a class="aff-cta" style="background:' + p.bg + ';color:' + p.color + '"' +
        ' href="' + esc(href) + '" target="_blank" rel="nofollow sponsored noopener"' +
        ' data-aff="' + esc(p.key) + '">' + label + ' ↗</a>';
    }).join('');
  }

  /* ── 여행 준비물(실물 상품) — 토스쇼핑 쉐어링크 ───────────────
     쉐어링크는 추적이 링크 자체에 박힌 리다이렉트 단축링크(toss.im/_m/…)라
     파라미터 부착이 아니라 고정 링크를 그대로 임베드한다.
     상품별 링크라 검색형이 아닌 큐레이션 목록으로 노출한다.
     노출 위치: /prepare (출국 준비) — 여행 맥락과 100% 일치.
     ⚠️ 상품이 단종/품절되면 링크가 죽으므로 주기적으로 점검할 것. */
  var TRAVEL_GOODS = {
    provider: '토스쇼핑',
    coupon: '토스쇼핑 첫 구매 시 이 링크로 3,000원 추가 할인',
    /* for = 이 상품을 노출할 /prepare 체크리스트 항목 id (맥락 일치 배치).
       charge = D-1 "기기 충전 + 보조배터리", pack = D-3 "짐 싸기" */
    items: [
      { ico: '🔌', name: '팬택 30W C타입 초고속 충전기 + 60W 케이블', url: 'https://toss.im/_m/B0HHYJcs', for: 'charge' },
      { ico: '🔌', name: '아이엠듀 20W PD 고속충전기 (2개입)',        url: 'https://toss.im/_m/1AxwKeut', for: 'charge' },
      { ico: '🎧', name: '아크로 인팟 무선 스테레오 이어폰',          url: 'https://toss.im/_m/jr4QSOHj', for: 'pack' },
      { ico: '🤳', name: '아크로 스마트폰 360° 셀카봉',               url: 'https://toss.im/_m/5zEvxndd', for: 'pack' },
      { ico: '🎗️', name: '루카 폰 목걸이 넥스트랩 (분실방지)',        url: 'https://toss.im/_m/15nLqudC', for: 'pack' },
      { ico: '🎗️', name: '루카 폰 손목 스트랩',                       url: 'https://toss.im/_m/h5JZP9td', for: 'pack' },
      { ico: '📱', name: '아이엠듀 맥세이프 스마트톡',                url: 'https://toss.im/_m/tsNEnIWA', for: 'pack' },
      { ico: '📱', name: '루카 맥세이프 그립 스마트톡',              url: 'https://toss.im/_m/5BS5efts', for: 'pack' }
    ]
  };

  /* 특정 체크리스트 항목(todoId) 아래에 붙일 추천 준비물 인라인 HTML.
     매핑된 상품이 없으면 '' 반환 → 항목에 아무것도 안 붙는다. */
  function goodsFor(todoId) {
    var list = TRAVEL_GOODS.items.filter(function (it) { return it.for === todoId; });
    if (!list.length) return '';
    var rows = list.map(function (it) {
      return '<a class="tg-item" href="' + esc(it.url) + '"' +
        ' target="_blank" rel="nofollow sponsored noopener">' +
        '<span class="tg-ico">' + it.ico + '</span>' +
        '<span class="tg-nm">' + esc(it.name) + '</span>' +
        '<span class="tg-go">보기 →</span></a>';
    }).join('');
    return '<div class="tg-inline">' +
      '<div class="tg-inline-lbl">🛒 추천 준비물 <span>· ' + esc(TRAVEL_GOODS.coupon) + '</span></div>' +
      rows + '</div>';
  }

  /* 이미 존재하는 URL(예: 마이리얼트립 라이브 검색이 돌려준 상품 URL)에
     해당 파트너의 추적값을 덧붙인다. 발급값(aff)이 없으면 URL을 그대로 돌려준다.
     → 추적을 파트너별 한 곳(PARTNERS[].aff)에서만 관리하기 위한 단일 진입점.
     ⚠️ 파트너가 "링크 생성기 전용"(임의 파라미터 부착 불가) 방식이면 이 함수로는
        추적이 안 될 수 있다. 실제 생성 링크의 파라미터를 확인해 aff 에 넣어야 한다. */
  function track(key, rawUrl) {
    if (!rawUrl) return rawUrl;
    var p = null;
    for (var i = 0; i < PARTNERS.length; i++) { if (PARTNERS[i].key === key) { p = PARTNERS[i]; break; } }
    if (!p || !p.aff || !Object.keys(p.aff).length) return rawUrl;   // 발급값 없으면 그대로
    var u;
    try { u = new URL(rawUrl); } catch (e) { return rawUrl; }
    for (var k in p.aff) { if (p.aff[k]) u.searchParams.set(k, p.aff[k]); }
    if (p.subKey) u.searchParams.set(p.subKey, subId(null));
    return u.toString();
  }

  /* 공정위 표시 지침 대응 고지 문구.
     발급값이 하나도 없으면(=수수료 미발생) 문구를 바꿔 정직하게 표시한다. */
  function disclosure() {
    return hasPaidLinks()
      ? '이 페이지의 예약 링크 중 일부는 제휴 링크로, 이를 통해 예약이 이루어지면 ' +
        '트래블코스트가 일정액의 수수료를 받을 수 있습니다. 이용자가 추가로 부담하는 비용은 없습니다.'
      : '현재 이 페이지의 링크는 제휴 수수료가 발생하지 않는 일반 링크입니다.';
  }

  function disclosureHtml() {
    return '<p class="aff-disclosure">' + esc(disclosure()) + '</p>';
  }

  /* 공용 스타일 — style.css를 안 쓰는 단일 파일 페이지에서도 동작하도록 자체 주입 */
  var CSS = [
    '.aff-cta{display:inline-flex;align-items:center;gap:6px;padding:10px 14px;border-radius:999px;',
    '  font-size:.82rem;font-weight:700;text-decoration:none;margin:4px 6px 4px 0;',
    '  transition:transform .12s ease,box-shadow .12s ease}',
    '.aff-cta:hover{transform:translateY(-1px);box-shadow:0 4px 14px rgba(16,24,40,.13)}',
    '.tg-inline{margin-top:10px;padding:10px 12px;background:#FFF8F1;border:1px solid #FCE4CC;border-radius:10px}',
    '.tg-inline-lbl{font-size:.72rem;font-weight:800;color:#B45309;margin-bottom:7px}',
    '.tg-inline-lbl span{font-weight:600;color:#C2792B}',
    '.tg-item{display:flex;align-items:center;gap:8px;padding:7px 6px;text-decoration:none;border-top:1px solid #F7E4CE}',
    '.tg-item:first-of-type{border-top:0}',
    '.tg-ico{font-size:17px;line-height:1;flex-shrink:0}',
    '.tg-nm{flex:1;min-width:0;font-size:.8rem;font-weight:600;color:#344054;line-height:1.35}',
    '.tg-go{font-size:.75rem;font-weight:800;color:#2577E3;white-space:nowrap}',
    '.tg-item:hover .tg-nm{color:#101828}',
    '@media(prefers-color-scheme:dark){.tg-inline{background:rgba(234,102,0,.08);border-color:rgba(234,102,0,.25)}.tg-nm{color:#CDD5DF}}',
    '.aff-disclosure{font-size:.7rem;line-height:1.55;color:#667085;margin-top:14px;',
    '  padding:10px 12px;background:#F9FAFB;border:1px solid #E4E7EC;border-radius:10px}',
    '@media(prefers-color-scheme:dark){',
    '  .aff-disclosure{background:rgba(255,255,255,.04);border-color:rgba(255,255,255,.1);color:#98A2B3}',
    '}'
  ].join('');

  function injectCss() {
    if (document.getElementById('aff-css')) return;
    var s = document.createElement('style');
    s.id = 'aff-css';
    s.textContent = CSS;
    document.head.appendChild(s);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', injectCss);
  } else {
    injectCss();
  }

  global.AFF = {
    PARTNERS: PARTNERS,
    CATEGORIES: CATEGORIES,
    url: url,
    byType: byType,
    ctas: ctas,
    track: track,
    goodsFor: goodsFor,
    hasPaidLinks: hasPaidLinks,
    disclosure: disclosure,
    disclosureHtml: disclosureHtml
  };
})(window);
