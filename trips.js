/* ═══════════════════════════════════════════════════════════
   트래블코스트 — 여행(Trip) 데이터 모델  (window.TripStore)

   리디자인 핵심: 여행이 최상위 컨테이너. 일정·예산·예약·준비물·공항이
   전부 하나의 여행 객체에 종속된다(Wanderlog 구조 + TravelSpend 예산).

   저장: localStorage 'tc_trips_v1' (여행 배열).  서버·의존성 0.
   ─ 예산 계산: 일일 가용액 = (총예산 − 누적지출) ÷ 남은 일수  (TravelSpend)
   ─ 다통화: KRW 환산(정적 환율표, 필요시 override)
   ─ 그룹 정산: paidBy/paidFor 로 멤버 간 순채무 계산 (TravelSpend)
   ═══════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  var KEY = 'tc_trips_v1';

  /* 원/외화 1단위 환율 — 입력 보조용 근사치. 지출 저장 시 KRW로 확정 저장하므로
     이후 환율이 변해도 기록값은 유지된다. JPY/USD/EUR/VND/THB/CNY는 2026-09-30 네이버 기준,
     TWD/HKD/SGD/IDR/PHP/MYR는 근사치(USD 교차환율). 실시간 환율이 오면 덮어쓴다. */
  var RATES = { KRW: 1, JPY: 8.663, USD: 1358.7, EUR: 1538.46, VND: 0.0523, THB: 40.49, CNY: 202.55, TWD: 42, HKD: 171, SGD: 995, IDR: 0.0833, PHP: 23.8, MYR: 323 };
  var CURS = ['KRW', 'JPY', 'USD', 'EUR', 'CNY', 'TWD', 'HKD', 'THB', 'VND', 'IDR', 'SGD', 'PHP', 'MYR'];
  var FX = { ts: 0, live: false };   // 실시간 환율 상태

  /* 실시간 환율 로드 — open.er-api.com(무료·무키, CSP 허용). 6시간 캐시(localStorage),
     실패 시 위 정적값 유지. RATES[cur] = 원/외화 1단위. */
  function applyRates(r) { for (var k in r) { if (r[k] > 0) RATES[k] = r[k]; } }
  function refreshRates(cb) {
    var cached; try { cached = JSON.parse(localStorage.getItem('tc_fx') || 'null'); } catch (e) {}
    var now = Date.now();
    if (cached && cached.rates && (now - cached.ts) < 6 * 3600 * 1000) {
      applyRates(cached.rates); FX = { ts: cached.ts, live: true }; if (cb) cb(true); return;
    }
    if (typeof fetch !== 'function') { if (cb) cb(false); return; }
    fetch('https://open.er-api.com/v6/latest/KRW')
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (d) {
        if (!d || d.result !== 'success' || !d.rates) { if (cb) cb(false); return; }
        var out = { KRW: 1 };
        CURS.forEach(function (c) {
          if (d.rates[c] > 0) out[c] = Math.round((1 / d.rates[c]) * 10000) / 10000;
        });
        applyRates(out);
        FX = { ts: (d.time_last_update_unix ? d.time_last_update_unix * 1000 : now), live: true };
        try { localStorage.setItem('tc_fx', JSON.stringify({ ts: now, rates: out })); } catch (e) {}
        if (cb) cb(true);
      })
      .catch(function () { if (cb) cb(false); });
  }
  function fxState() { return FX; }
  var CATS = [
    { key: 'food',    label: '식비',  emoji: '🍜', color: '#F97316' },
    { key: 'transit', label: '교통',  emoji: '🚃', color: '#1B4FD8' },
    { key: 'stay',    label: '숙박',  emoji: '🏨', color: '#039855' },
    { key: 'shop',    label: '쇼핑',  emoji: '🛍️', color: '#DB2777' },
    { key: 'sight',   label: '관광',  emoji: '🎟️', color: '#7C3AED' },
    { key: 'cafe',    label: '카페',  emoji: '☕', color: '#B45309' },
    { key: 'etc',     label: '기타',  emoji: '💳', color: '#667085' }
  ];
  var MEMBER_COLORS = ['#F97316', '#1B4FD8', '#7C3AED', '#039855', '#DB2777', '#0EA5E9'];

  /* 한글 도시명 → 좌표 (Open-Meteo 지오코딩이 한글명을 못 찾아 직접 매핑).
     가이드 23곳 + 국내 7곳 + 별칭. 없으면 날씨는 조용히 생략. */
  var CITY_GEO = {
    '오사카': [34.6937, 135.5023], '후쿠오카': [33.5904, 130.4017], '도쿄': [35.6762, 139.6503],
    '교토': [35.0116, 135.7681], '삿포로': [43.0618, 141.3545], '오키나와': [26.212, 127.679],
    '장가계': [29.117, 110.479], '계림': [25.274, 110.290], '상하이': [31.230, 121.474],
    '백두산': [42.008, 128.057], '타이베이': [25.033, 121.565], '홍콩': [22.319, 114.169],
    '방콕': [13.7563, 100.5018], '다낭': [16.0544, 108.2022], '발리': [-8.4095, 115.1889],
    '싱가포르': [1.3521, 103.8198], '나트랑': [12.238, 109.196], '세부': [10.317, 123.891],
    '코타키나발루': [5.980, 116.073], '제주': [33.4996, 126.5312], '제주도': [33.4996, 126.5312],
    '부산': [35.1796, 129.0756], '강릉': [37.7519, 128.8761], '파리': [48.8566, 2.3522],
    '속초': [38.2070, 128.5918], '양양': [38.0754, 128.6190], '삼척': [37.4499, 129.1655],
    '춘천': [37.8813, 127.7300], '포천': [37.8949, 127.2003], '대전': [36.3504, 127.3845],
    '태안': [36.7456, 126.2980], '서울': [37.5665, 126.9780], '인천': [37.4563, 126.7052],
    // 가이드 표기(2026-10 개편)와 맞춤 — 가이드에서 만든 여행이 날씨를 못 받던 문제
    '장자제': [29.117, 110.479], '구이린': [25.274, 110.290], '창바이산': [42.008, 128.057], '나하': [26.212, 127.679]
  };

  /* ── 도시별 시간대(IANA) — 현지 시각·시차 표시용. 없으면 날씨 응답(timezone=auto)에서 배운 값(tc_tz_도시) ── */
  var CITY_TZ = {
    '오사카': 'Asia/Tokyo', '후쿠오카': 'Asia/Tokyo', '도쿄': 'Asia/Tokyo', '교토': 'Asia/Tokyo', '삿포로': 'Asia/Tokyo', '오키나와': 'Asia/Tokyo', '나하': 'Asia/Tokyo',
    '장가계': 'Asia/Shanghai', '장자제': 'Asia/Shanghai', '계림': 'Asia/Shanghai', '구이린': 'Asia/Shanghai', '상하이': 'Asia/Shanghai', '백두산': 'Asia/Shanghai', '창바이산': 'Asia/Shanghai',
    '타이베이': 'Asia/Taipei', '홍콩': 'Asia/Hong_Kong', '방콕': 'Asia/Bangkok', '다낭': 'Asia/Ho_Chi_Minh', '나트랑': 'Asia/Ho_Chi_Minh',
    '발리': 'Asia/Makassar', '싱가포르': 'Asia/Singapore', '세부': 'Asia/Manila', '코타키나발루': 'Asia/Kuching', '파리': 'Europe/Paris'
  };
  /* 도시 → 나라 코드(입국 준비·현지어·비상 연락·현지 정보 공용) */
  var CITY_CC = { '오사카':'jp','후쿠오카':'jp','도쿄':'jp','교토':'jp','삿포로':'jp','오키나와':'jp','나하':'jp','타이베이':'tw','홍콩':'hk',
    '상하이':'cn','장가계':'cn','장자제':'cn','계림':'cn','구이린':'cn','백두산':'cn','창바이산':'cn','방콕':'th','다낭':'vn','나트랑':'vn',
    '발리':'id','싱가포르':'sg','세부':'ph','코타키나발루':'my','파리':'fr' };
  function countryOf(city) { city = String(city || ''); for (var k in CITY_CC) if (city.indexOf(k) > -1) return CITY_CC[k]; return ''; }
  /* 나라 → 현지 통화(국내·모르는 도시는 KRW) */
  var CC_CUR = { jp: 'JPY', tw: 'TWD', hk: 'HKD', cn: 'CNY', th: 'THB', vn: 'VND', id: 'IDR', sg: 'SGD', ph: 'PHP', my: 'MYR', fr: 'EUR' };
  function curOf(city) { return CC_CUR[countryOf(city)] || 'KRW'; }
  function cityTz(name) {
    var c = (name || '').trim(), k = c.replace(/\s*(여행|시|특별시|광역시|도)$/, '').trim();
    if (CITY_TZ[c]) return CITY_TZ[c];
    if (CITY_TZ[k]) return CITY_TZ[k];
    for (var key in CITY_TZ) { if (c.indexOf(key) > -1) return CITY_TZ[key]; }
    if (CITY_GEO[c] || CITY_GEO[k]) return 'Asia/Seoul';   // 국내 도시
    try { return localStorage.getItem('tc_tz_' + c) || ''; } catch (e) { return ''; }
  }
  function cityGeo(name) {
    var c = (name || '').trim(); if (CITY_GEO[c]) return { lat: CITY_GEO[c][0], lon: CITY_GEO[c][1] };
    // 접미어 제거 후 재시도 (예: '오사카 여행')
    var k = c.replace(/\s*(여행|시|특별시|광역시|도)$/,'').trim();
    if (CITY_GEO[k]) return { lat: CITY_GEO[k][0], lon: CITY_GEO[k][1] };
    return null;
  }

  function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }
  /* 저장값이 깨졌으면 [] 로 시작하되, 원문은 덮어쓰기 전에 따로 보관(나중에 복구 가능) */
  function load() {
    var raw = null;
    try { raw = localStorage.getItem(KEY); var v = JSON.parse(raw || '[]'); return Array.isArray(v) ? v : []; }
    catch (e) {
      try { if (raw && localStorage.getItem(KEY + '_bad') !== raw) localStorage.setItem(KEY + '_bad', raw); } catch (e2) {}
      return [];
    }
  }
  /* 저장 실패(대개 용량 초과)는 조용히 넘기지 않고 화면에 알린다 */
  var lastWarn = 0;
  function warnSave() {
    var now = Date.now(); if (now - lastWarn < 8000 || !document.body) return; lastWarn = now;
    var el = document.createElement('div');
    el.setAttribute('role', 'alert');
    el.style.cssText = 'position:fixed;left:16px;right:16px;bottom:88px;z-index:9999;max-width:480px;margin:0 auto;background:#B42318;color:#fff;padding:12px 14px;border-radius:12px;font-size:14px;line-height:1.45;box-shadow:0 6px 20px rgba(0,0,0,.25)';
    el.textContent = '저장 공간이 꽉 차서 방금 바꾼 내용이 저장되지 않았어요. 내 여행에서 백업을 받은 뒤 지난 여행을 지워 공간을 비워 주세요.';
    document.body.appendChild(el);
    setTimeout(function () { if (el.parentNode) el.parentNode.removeChild(el); }, 7000);
  }
  function save(list) {
    try { localStorage.setItem(KEY, JSON.stringify(list)); return true; }
    catch (e) { warnSave(); return false; }
  }

  /* ── 날짜 유틸 ── */
  function parseD(s) { var p = (s || '').split('-'); return new Date(+p[0], (+p[1] || 1) - 1, +p[2] || 1); }
  function fmtMD(s) { var d = parseD(s); return (d.getMonth() + 1) + '.' + d.getDate(); }
  function dow(s) { return ['일','월','화','수','목','금','토'][parseD(s).getDay()]; }
  /* 로컬 날짜 'YYYY-MM-DD' — toISOString()은 UTC라 한국(UTC+9) 자정~오전 9시엔 하루 전 날짜가 됨(일차 날짜가 하루씩 밀리던 원인) */
  function iso(d) { d = d || new Date(); return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2); }
  function daysBetween(a, b) { return Math.round((parseD(b) - parseD(a)) / 86400000); }
  function tripLength(t) { return Math.max(1, daysBetween(t.start, t.end) + 1); }
  function today() { var d = new Date(); return new Date(d.getFullYear(), d.getMonth(), d.getDate()); }
  function ddayText(t) {
    var d = Math.round((parseD(t.start) - today()) / 86400000);
    if (d > 0) return 'D-' + d;
    if (d === 0) return 'D-DAY';
    var end = Math.round((parseD(t.end) - today()) / 86400000);
    return end >= 0 ? '여행 중' : '완료';
  }

  /* 오늘 이후 남은 일수(여행 중이면 오늘~종료, 시작 전이면 전체 길이) */
  function remainingDays(t) {
    var now = today(), s = parseD(t.start), e = parseD(t.end);
    if (now < s) return tripLength(t);
    if (now > e) return 0;
    return Math.max(1, daysBetween(iso(now), t.end) + 1);
  }

  /* ── 예산 계산 ── */
  function spent(t) { return (t.expenses || []).reduce(function (s, e) { return s + (e.krw || 0); }, 0); }
  function budgetTotal(t) { return (t.budget && t.budget.total) || 0; }
  function spentPct(t) { var tot = budgetTotal(t); return tot ? Math.min(100, Math.round(spent(t) / tot * 100)) : 0; }
  function dailyAllowance(t) {
    var rem = remainingDays(t); if (!rem) return 0;
    return Math.max(0, Math.round((budgetTotal(t) - spent(t)) / rem));
  }
  function byCategory(t) {
    var m = {};
    (t.expenses || []).forEach(function (e) { m[e.category] = (m[e.category] || 0) + (e.krw || 0); });
    return CATS.map(function (c) { return { cat: c, amt: m[c.key] || 0 }; }).filter(function (x) { return x.amt > 0; })
      .sort(function (a, b) { return b.amt - a.amt; });
  }
  function toKRW(amount, cur) { return Math.round(amount * (RATES[cur] || 1)); }

  /* ── 여권 만료일 — 만료일만, 이 기기에만(여권 번호는 받지 않음). 귀국일 기준 6개월 미만이면 경고 ── */
  var PP_KEY = 'tc_passport_exp';
  function passportExp() { try { return localStorage.getItem(PP_KEY) || ''; } catch (e) { return ''; } }
  function setPassportExp(d) { try { if (d) localStorage.setItem(PP_KEY, d); else localStorage.removeItem(PP_KEY); } catch (e) {} }
  function passportCheck(t) {
    var exp = passportExp(); if (!t || !t.end || cityTz(t.city) === 'Asia/Seoul') return null;   // 국내 여행은 여권 불필요
    if (!/^\d{4}-\d{2}-\d{2}$/.test(exp)) return { level: 'none', text: '여권 만료일을 넣으면 6개월 규칙을 확인해 드려요' };
    var e = new Date(exp + 'T00:00:00'), back = new Date(t.end + 'T00:00:00'), six = new Date(back), dot = exp.replace(/-/g, '.');
    six.setMonth(six.getMonth() + 6);
    if (e < back) return { level: 'bad', text: '여권이 ' + dot + '에 만료돼 이 여행에 쓸 수 없어요 — 재발급하세요', short: '여권이 여행 전·중에 만료돼요 — 재발급' };
    if (e < six) {
      var m = Math.floor((e - back) / (30.44 * 864e5));
      return { level: 'warn', text: '여권이 귀국 후 ' + (m ? m + '개월 뒤' : '한 달 안에') + ' 만료(' + dot + ') — 6개월 미만이면 입국을 거절하는 나라가 있어요', short: '여권 유효기간 6개월 미만' };
    }
    return { level: 'ok', text: '여권 유효기간 충분해요 (' + dot + '까지)' };
  }

  /* ── 남은 외화 — 귀국할 때 지갑에 남은 돈을 통화별로 적어 두고, 같은 통화 여행에서 꺼내 쓰기 ── */
  var LO_KEY = 'tc_leftover';
  function leftovers() { try { return JSON.parse(localStorage.getItem(LO_KEY) || '{}') || {}; } catch (e) { return {}; } }
  function setLeftover(cur, amt, src) {
    var m = leftovers();
    if (amt > 0) m[cur] = { amt: amt, from: (src && src.city) || '', tid: (src && src.id) || '', at: iso(new Date()) }; else delete m[cur];
    try { localStorage.setItem(LO_KEY, JSON.stringify(m)); } catch (e) {}
  }

  /* ── 그룹 정산: 순채무 최소 전송 계산 ── */
  function settlements(t) {
    var members = (t.members || []).map(function (m) { return m.name; });
    if (members.length < 2) return [];
    var bal = {}; members.forEach(function (n) { bal[n] = 0; });
    (t.expenses || []).forEach(function (e) {
      var payer = e.paidBy, fors = (e.paidFor && e.paidFor.length) ? e.paidFor : members;
      if (bal[payer] == null) return;
      var share = e.krw / fors.length;
      bal[payer] += e.krw;
      fors.forEach(function (f) { if (bal[f] != null) bal[f] -= share; });
    });
    var cred = [], debt = [];
    Object.keys(bal).forEach(function (n) {
      var v = Math.round(bal[n]);
      if (v > 0) cred.push({ n: n, v: v }); else if (v < 0) debt.push({ n: n, v: -v });
    });
    cred.sort(function (a, b) { return b.v - a.v; }); debt.sort(function (a, b) { return b.v - a.v; });
    var res = [], i = 0, j = 0;
    while (i < debt.length && j < cred.length) {
      var pay = Math.min(debt[i].v, cred[j].v);
      if (pay > 500) res.push({ from: debt[i].n, to: cred[j].n, amt: Math.round(pay) });
      debt[i].v -= pay; cred[j].v -= pay;
      if (debt[i].v <= 500) i++; if (cred[j].v <= 500) j++;
    }
    return res;
  }

  /* 개인별 정산: 낸 돈(paid)·부담(share)·차액(net) */
  function balances(t) {
    var members = (t.members || []).map(function (m) { return m.name; });
    var paid = {}, share = {};
    members.forEach(function (n) { paid[n] = 0; share[n] = 0; });
    (t.expenses || []).forEach(function (e) {
      var fors = (e.paidFor && e.paidFor.length) ? e.paidFor : members;
      if (paid[e.paidBy] != null) paid[e.paidBy] += (e.krw || 0);
      var per = (e.krw || 0) / fors.length;
      fors.forEach(function (f) { if (share[f] != null) share[f] += per; });
    });
    return members.map(function (n) { return { name: n, paid: Math.round(paid[n]), share: Math.round(share[n]), net: Math.round(paid[n] - share[n]) }; });
  }

  /* ── 일정: 시작~종료로 일차 배열 보장 ── */
  function ensureDays(t) {
    var len = tripLength(t); t.days = t.days || [];
    for (var i = 0; i < len; i++) {
      var sd = parseD(t.start); sd.setDate(sd.getDate() + i); var date = iso(sd);
      if (!t.days[i]) t.days[i] = { date: date, items: [] };
      else t.days[i].date = date;
    }
    t.days.length = len;
    return t.days;
  }

  /* ── CRUD ── */
  function all() { return load(); }
  function get(id) { return load().filter(function (t) { return t.id === id; })[0] || null; }
  function upsert(t) {
    var list = load(), i = list.map(function (x) { return x.id; }).indexOf(t.id);
    if (i > -1) list[i] = t; else list.push(t);
    save(list); return t;
  }
  function remove(id) { save(load().filter(function (t) { return t.id !== id; })); }

  function create(data) {
    var t = {
      id: uid(),
      city: data.city || '새 여행',
      cover: data.cover || 'blue',
      start: data.start, end: data.end,
      members: data.members || [{ name: '나', color: MEMBER_COLORS[0] }],
      budget: { total: data.budgetTotal || 0, currency: 'KRW' },
      days: [], places: [], expenses: [], reservations: [], checklist: [],
      flight: data.flight || null,
      created: Date.now()
    };
    ensureDays(t); upsert(t); return t;
  }

  function addExpense(id, e) {
    var t = get(id); if (!t) return;
    e.id = uid(); e.krw = e.krw != null ? e.krw : toKRW(e.amount, e.currency || 'KRW');
    t.expenses = t.expenses || []; t.expenses.unshift(e); upsert(t); return t;
  }
  function updateExpense(id, eid, patch) {
    var t = get(id); if (!t) return; (t.expenses || []).forEach(function (e) { if (e.id === eid) { for (var k in patch) e[k] = patch[k]; } }); upsert(t); return t;
  }
  function removeExpense(id, eid) {
    var t = get(id); if (!t) return; t.expenses = (t.expenses || []).filter(function (e) { return e.id !== eid; }); upsert(t); return t;
  }
  function addReservation(id, r) { var t = get(id); if (!t) return; r.id = uid(); t.reservations = t.reservations || []; t.reservations.push(r); upsert(t); return t; }
  function updateReservation(id, rid, patch) {
    var t = get(id); if (!t) return; (t.reservations || []).forEach(function (r) { if (r.id === rid) { for (var k in patch) r[k] = patch[k]; } }); upsert(t); return t;
  }
  function removeReservation(id, rid) {
    var t = get(id); if (!t) return; t.reservations = (t.reservations || []).filter(function (r) { return r.id !== rid; }); upsert(t); return t;
  }
  function addChecklistItem(id, c) { var t = get(id); if (!t) return; c.id = uid(); c.done = false; t.checklist = t.checklist || []; t.checklist.push(c); upsert(t); return t; }
  function updateChecklistItem(id, cid, patch) {
    var t = get(id); if (!t) return; (t.checklist || []).forEach(function (c) { if (c.id === cid) { for (var k in patch) c[k] = patch[k]; } }); upsert(t); return t;
  }
  function removeChecklistItem(id, cid) {
    var t = get(id); if (!t) return; t.checklist = (t.checklist || []).filter(function (c) { return c.id !== cid; }); upsert(t); return t;
  }
  function toggleChecklist(id, cid) {
    var t = get(id); if (!t) return; (t.checklist || []).forEach(function (c) { if (c.id === cid) c.done = !c.done; }); upsert(t); return t;
  }
  function addDayItem(id, dayIdx, item) {
    var t = get(id); if (!t) return; ensureDays(t); item.id = uid();
    (t.days[dayIdx].items = t.days[dayIdx].items || []).push(item); upsert(t); return t;
  }
  function updateDayItem(id, dayIdx, itemId, patch) {
    var t = get(id); if (!t) return; ensureDays(t);
    (t.days[dayIdx].items || []).forEach(function (it) { if (it.id === itemId) { for (var k in patch) it[k] = patch[k]; } });
    upsert(t); return t;
  }
  function removeDayItem(id, dayIdx, itemId) {
    var t = get(id); if (!t) return; ensureDays(t);
    t.days[dayIdx].items = (t.days[dayIdx].items || []).filter(function (it) { return it.id !== itemId; });
    upsert(t); return t;
  }
  function moveDayItem(id, dayIdx, itemId, dir) {
    var t = get(id); if (!t) return; ensureDays(t);
    var arr = t.days[dayIdx].items || [], i = arr.map(function (x) { return x.id; }).indexOf(itemId), j = i + dir;
    if (i < 0 || j < 0 || j >= arr.length) return t;
    var tmp = arr[i]; arr[i] = arr[j]; arr[j] = tmp; upsert(t); return t;
  }
  function setCatLimit(id, catKey, amount) {
    var t = get(id); if (!t) return; t.budget = t.budget || { total: 0, currency: 'KRW' };
    t.budget.catLimits = t.budget.catLimits || {};
    if (amount > 0) t.budget.catLimits[catKey] = amount; else delete t.budget.catLimits[catKey];
    upsert(t); return t;
  }

  /* ── 데모 시드(비어 있을 때 1회) — 오사카 예시로 구조를 보여줌 ── */
  function seedIfEmpty() {
    if (load().length) return;
    var start = iso(new Date(today().getTime() + 24 * 86400000));
    var end = iso(new Date(today().getTime() + 27 * 86400000));
    var t = create({ city: '오사카', cover: 'osaka', start: start, end: end,
      members: [{ name: '나', color: '#F97316' }, { name: '민수', color: '#1B4FD8' }],
      budgetTotal: 1240000,
      flight: { no: 'KE723', airline: '대한항공', from: 'ICN', to: 'KIX', dep: '08:05', arr: '10:35', date: start, terminal: 'T2 · 244' } });
    t.expenses = [
      { id: uid(), date: start, amount: 2000, currency: 'JPY', krw: 18400, category: 'food', method: 'card', paidBy: '나', paidFor: ['나'], memo: '이치란 라멘' },
      { id: uid(), date: start, amount: 3000, currency: 'JPY', krw: 27600, category: 'transit', method: 'card', paidBy: '민수', paidFor: ['나', '민수'], memo: 'ICOCA 충전' },
      { id: uid(), date: start, amount: 4457, currency: 'JPY', krw: 41000, category: 'shop', method: 'cash', paidBy: '나', paidFor: ['나'], memo: '돈키호테' },
      { id: uid(), date: start, amount: 12174, currency: 'JPY', krw: 112000, category: 'stay', method: 'card', paidBy: '나', paidFor: ['나', '민수'], memo: '호텔 1박' }
    ];
    t.reservations = [
      { id: uid(), type: 'flight', title: '대한항공 KE723', detail: '인천(ICN) 08:05 → 간사이(KIX) 10:35 · 2인', status: 'confirmed', when: start },
      { id: uid(), type: 'hotel', title: '남바 오리엔탈 호텔', detail: '3박 · ₩336,000 · trip.com', status: 'confirmed', when: start },
      { id: uid(), type: 'tour', title: '유니버설 스튜디오 재팬', detail: '1일권 2매 · 최저가 비교 중', status: 'planned', when: '' }
    ];
    t.checklist = [
      { id: uid(), group: '서류', text: '여권 (6개월 이상)', when: 'D-30', done: true },
      { id: uid(), group: '서류', text: 'Visit Japan Web 등록', when: 'D-3', done: true },
      { id: uid(), group: '서류', text: '여행자보험 가입', when: 'D-2', done: false },
      { id: uid(), group: '짐', text: '멀티어댑터·보조배터리', when: '', done: true },
      { id: uid(), group: '짐', text: 'eSIM 또는 포켓와이파이', when: 'D-1', done: false },
      { id: uid(), group: '짐', text: '상비약·우산', when: '', done: false }
    ];
    ensureDays(t);
    t.days[0].items = [
      { id: uid(), time: '10:35', type: 'flight', title: '간사이 국제공항 (KIX)', memo: '난카이 라피트 → 난바 (약 40분)' },
      { id: uid(), time: '13:00', type: 'sight', title: '도톤보리', memo: '글리코 사인 · 다코야키 · 리버크루즈' },
      { id: uid(), time: '18:00', type: 'lodging', title: '남바 오리엔탈 호텔', memo: '체크인 · ₩112,000/박' }
    ];
    upsert(t);
  }

  /* ── 도시 커버 사진: 가이드 첫 구역 사진(Wikimedia 500px, 홈 썸네일과 동일·200 검증) ── */
  var CITY_PHOTO = {
    "오사카": 'https://upload.wikimedia.org/wikipedia/commons/thumb/f/f4/Osaka_Dotonbori_Ebisu_Bridge.jpg/500px-Osaka_Dotonbori_Ebisu_Bridge.jpg',
    "후쿠오카": 'https://upload.wikimedia.org/wikipedia/commons/thumb/e/e6/JR_Hakata_City_2011_Jan.jpg/500px-JR_Hakata_City_2011_Jan.jpg',
    "도쿄": 'https://upload.wikimedia.org/wikipedia/commons/thumb/9/96/Tokyo_Metropolitan_Government_Building_2024.jpg/500px-Tokyo_Metropolitan_Government_Building_2024.jpg',
    "교토": 'https://upload.wikimedia.org/wikipedia/commons/thumb/3/3c/Kiyomizu.jpg/500px-Kiyomizu.jpg',
    "삿포로": 'https://upload.wikimedia.org/wikipedia/commons/thumb/0/0d/Hokkaido_Sapporo_Odori_Park.jpg/500px-Hokkaido_Sapporo_Odori_Park.jpg',
    "오키나와": 'https://upload.wikimedia.org/wikipedia/commons/thumb/5/56/Naha_Okinawa_Japan_Shuri-Castle-01.jpg/500px-Naha_Okinawa_Japan_Shuri-Castle-01.jpg',
    "상하이": 'https://upload.wikimedia.org/wikipedia/commons/thumb/5/5a/The_Bund_2.jpg/500px-The_Bund_2.jpg',
    "타이베이": 'https://upload.wikimedia.org/wikipedia/commons/thumb/b/bc/Taipei_Skyline_20220708.jpg/500px-Taipei_Skyline_20220708.jpg',
    "홍콩": 'https://upload.wikimedia.org/wikipedia/commons/thumb/7/7d/High_West_and_Victoria_Peak_from_Victoria_Gap_%28crop1%29.jpg/500px-High_West_and_Victoria_Peak_from_Victoria_Gap_%28crop1%29.jpg',
    "구이린": 'https://upload.wikimedia.org/wikipedia/commons/thumb/c/cf/Guilin_2006_19-03.jpg/500px-Guilin_2006_19-03.jpg',
    "장자제": 'https://upload.wikimedia.org/wikipedia/commons/thumb/7/77/1_tianzishan_wulingyuan_zhangjiajie_2012.jpg/500px-1_tianzishan_wulingyuan_zhangjiajie_2012.jpg',
    "창바이산": 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/a9/%E4%BB%8E%E9%95%BF%E7%99%BD%E5%B1%B1%E8%A5%BF%E5%9D%A1%E7%9C%8B%E5%A4%A9%E6%B1%A0-2017-08-24_1.jpg/500px-%E4%BB%8E%E9%95%BF%E7%99%BD%E5%B1%B1%E8%A5%BF%E5%9D%A1%E7%9C%8B%E5%A4%A9%E6%B1%A0-2017-08-24_1.jpg',
    "방콕": 'https://upload.wikimedia.org/wikipedia/commons/thumb/c/c7/0005574_-_Wat_Phra_Kaew_006.jpg/500px-0005574_-_Wat_Phra_Kaew_006.jpg',
    "다낭": 'https://upload.wikimedia.org/wikipedia/commons/thumb/c/c0/My_Khe_Beach%2C_Da_Nang%2C_Vietnam.jpg/500px-My_Khe_Beach%2C_Da_Nang%2C_Vietnam.jpg',
    "발리": 'https://upload.wikimedia.org/wikipedia/commons/thumb/8/8a/Rice_terraces%2C_Bali.jpg/500px-Rice_terraces%2C_Bali.jpg',
    "싱가포르": 'https://upload.wikimedia.org/wikipedia/commons/thumb/c/c7/Marina_Bay_Sands_%28I%29.jpg/500px-Marina_Bay_Sands_%28I%29.jpg',
    "나트랑": 'https://upload.wikimedia.org/wikipedia/commons/thumb/9/9c/Nha_Trang_%2C_Vietnam_-_panoramio_%2835%29.jpg/500px-Nha_Trang_%2C_Vietnam_-_panoramio_%2835%29.jpg',
    "세부": 'https://upload.wikimedia.org/wikipedia/commons/thumb/1/17/Magellan%27s_Cross_2024-07-05.jpg/500px-Magellan%27s_Cross_2024-07-05.jpg',
    "코타키나발루": 'https://upload.wikimedia.org/wikipedia/commons/thumb/9/9b/Panoramic_view_of_Kota_Kinabalu_City.jpg/500px-Panoramic_view_of_Kota_Kinabalu_City.jpg',
    "제주": 'https://upload.wikimedia.org/wikipedia/commons/thumb/6/61/Seongsan_Ilchulbong_from_the_air.jpg/500px-Seongsan_Ilchulbong_from_the_air.jpg',
    "부산": 'https://upload.wikimedia.org/wikipedia/commons/thumb/e/ea/Haeundae_Beach_May_2024.jpg/500px-Haeundae_Beach_May_2024.jpg',
    "강릉": 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/a9/%EA%B2%BD%ED%8F%AC%ED%95%B4%EB%B3%80.jpg/500px-%EA%B2%BD%ED%8F%AC%ED%95%B4%EB%B3%80.jpg',
    "파리": 'https://upload.wikimedia.org/wikipedia/commons/thumb/8/85/Tour_Eiffel_Wikimedia_Commons_%28cropped%29.jpg/500px-Tour_Eiffel_Wikimedia_Commons_%28cropped%29.jpg'
  };
  /* 위키미디어 썸네일 주소 → 커먼즈 파일 페이지(작가·라이선스 확인용 출처 링크) */
  function photoSource(url) {
    var m = /\/commons\/(?:thumb\/)?[0-9a-f]\/[0-9a-f]{2}\/([^\/?#]+)/.exec(url || '');
    return m ? 'https://commons.wikimedia.org/wiki/File:' + m[1] : '';
  }
  function cityPhoto(city) {
    city = String(city || '');
    if (CITY_PHOTO[city]) return CITY_PHOTO[city];
    for (var k in CITY_PHOTO) { if (city.indexOf(k) > -1) return CITY_PHOTO[k]; }   // '오사카 가족여행' 같은 이름도
    return '';
  }

  window.TripStore = {
    KEY: KEY, RATES: RATES, CATS: CATS, MEMBER_COLORS: MEMBER_COLORS,
    all: all, get: get, create: create, upsert: upsert, remove: remove,
    addExpense: addExpense, updateExpense: updateExpense, removeExpense: removeExpense,
    addReservation: addReservation, updateReservation: updateReservation, removeReservation: removeReservation,
    addChecklistItem: addChecklistItem, updateChecklistItem: updateChecklistItem, removeChecklistItem: removeChecklistItem,
    toggleChecklist: toggleChecklist,
    addDayItem: addDayItem, updateDayItem: updateDayItem, removeDayItem: removeDayItem,
    moveDayItem: moveDayItem, setCatLimit: setCatLimit,
    ensureDays: ensureDays, seedIfEmpty: seedIfEmpty,
    // 계산
    spent: spent, budgetTotal: budgetTotal, spentPct: spentPct,
    dailyAllowance: dailyAllowance, remainingDays: remainingDays, byCategory: byCategory,
    settlements: settlements, balances: balances, toKRW: toKRW,
    passportExp: passportExp, setPassportExp: setPassportExp, passportCheck: passportCheck,
    leftovers: leftovers, setLeftover: setLeftover,
    refreshRates: refreshRates, fxState: fxState, cityGeo: cityGeo, cityPhoto: cityPhoto, photoSource: photoSource, cityTz: cityTz, countryOf: countryOf, curOf: curOf, CURS: CURS,
    // 날짜
    fmtMD: fmtMD, iso: iso, dow: dow, tripLength: tripLength, ddayText: ddayText, daysBetween: daysBetween,
    catByKey: function (k) { return CATS.filter(function (c) { return c.key === k; })[0] || CATS[6]; }
  };
})();
