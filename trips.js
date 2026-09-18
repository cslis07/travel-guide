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

  /* 정적 환율(100단위는 JPY만; 1단위 기준으로 통일) — 홈 위젯이 실시간이라
     여기선 입력 보조용 근사치. 사용자가 지출 입력 시 KRW를 확정 저장한다. */
  var RATES = { KRW: 1, JPY: 9.2, USD: 1339, EUR: 1558, VND: 0.0518, THB: 39, CNY: 188, TWD: 42, HKD: 171, SGD: 995 };
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

  function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }
  function load() { try { return JSON.parse(localStorage.getItem(KEY) || '[]'); } catch (e) { return []; } }
  function save(list) { try { localStorage.setItem(KEY, JSON.stringify(list)); } catch (e) {} }

  /* ── 날짜 유틸 ── */
  function parseD(s) { var p = (s || '').split('-'); return new Date(+p[0], (+p[1] || 1) - 1, +p[2] || 1); }
  function fmtMD(s) { var d = parseD(s); return (d.getMonth() + 1) + '.' + d.getDate(); }
  function dow(s) { return ['일','월','화','수','목','금','토'][parseD(s).getDay()]; }
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
    return Math.max(1, daysBetween(now.toISOString().slice(0, 10), t.end) + 1);
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

  /* ── 일정: 시작~종료로 일차 배열 보장 ── */
  function ensureDays(t) {
    var len = tripLength(t); t.days = t.days || [];
    for (var i = 0; i < len; i++) {
      var date = new Date(parseD(t.start).getTime() + i * 86400000).toISOString().slice(0, 10);
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
  function addReservation(id, r) { var t = get(id); if (!t) return; r.id = uid(); t.reservations = t.reservations || []; t.reservations.push(r); upsert(t); return t; }
  function addChecklistItem(id, c) { var t = get(id); if (!t) return; c.id = uid(); c.done = false; t.checklist = t.checklist || []; t.checklist.push(c); upsert(t); return t; }
  function toggleChecklist(id, cid) {
    var t = get(id); if (!t) return; (t.checklist || []).forEach(function (c) { if (c.id === cid) c.done = !c.done; }); upsert(t); return t;
  }
  function addDayItem(id, dayIdx, item) {
    var t = get(id); if (!t) return; ensureDays(t); item.id = uid();
    (t.days[dayIdx].items = t.days[dayIdx].items || []).push(item); upsert(t); return t;
  }

  /* ── 데모 시드(비어 있을 때 1회) — 오사카 예시로 구조를 보여줌 ── */
  function seedIfEmpty() {
    if (load().length) return;
    var start = new Date(today().getTime() + 24 * 86400000).toISOString().slice(0, 10);
    var end = new Date(today().getTime() + 27 * 86400000).toISOString().slice(0, 10);
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

  window.TripStore = {
    KEY: KEY, RATES: RATES, CATS: CATS, MEMBER_COLORS: MEMBER_COLORS,
    all: all, get: get, create: create, upsert: upsert, remove: remove,
    addExpense: addExpense, addReservation: addReservation,
    addChecklistItem: addChecklistItem, toggleChecklist: toggleChecklist, addDayItem: addDayItem,
    ensureDays: ensureDays, seedIfEmpty: seedIfEmpty,
    // 계산
    spent: spent, budgetTotal: budgetTotal, spentPct: spentPct,
    dailyAllowance: dailyAllowance, remainingDays: remainingDays, byCategory: byCategory,
    settlements: settlements, toKRW: toKRW,
    // 날짜
    fmtMD: fmtMD, dow: dow, tripLength: tripLength, ddayText: ddayText, daysBetween: daysBetween,
    catByKey: function (k) { return CATS.filter(function (c) { return c.key === k; })[0] || CATS[6]; }
  };
})();
