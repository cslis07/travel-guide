/* ═══════════════════════════════════════════════════════════
   트래블코스트 — 여행 대시보드  (/dashboard)

   데이터: 전부 window.TripStore(localStorage 'tc_trips_v1') — 여행 상세(/trip)와 같은 원본이라
   여기서 체크한 준비물은 상세 화면에도 그대로 보인다(다른 탭은 storage 이벤트로 즉시 갱신).

   정직성 원칙(사용자 데이터처럼 보이는 가짜 값 금지)
   ─ 예상 여행비 도넛: ① 경비 계산에서 담은 항목별 예상액(budget.plan) → ② 여행에서 정한 항목별 한도
     (budget.catLimits) → ③ 둘 다 없으면 '총예산 대비 실제 지출'만. 임의 비율은 그리지 않는다.
   ─ 공항 실시간: 인천공항 출발편을 기존 프록시(/api/proxy)로 조회해 '찾았을 때만' 실시간이라 표시.
     못 찾거나 실패하면 저장된 정보라고 분명히 밝히고, 게이트·운항 상태는 비워 둔다.

   순수 계산 함수는 window.TCDashCore 로 내보내 scripts/dashboard_test.mjs 가 브라우저 없이 검증한다.
   ═══════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  var SELECT_KEY = 'tc_dashboard_trip';
  // 운항정보 API terminalId — P01=T1 · P02=탑승동 · P03=T2 (2026-11-02 실데이터 확인, airport.html 과 같은 표기)
  var TERM = { P01: 'T1', P02: '탑승동', P03: 'T2' };
  var AIRPORT = { ICN: '인천', GMP: '김포', PUS: '부산', CJU: '제주', KIX: '오사카 간사이', ITM: '오사카 이타미', NRT: '도쿄 나리타', HND: '도쿄 하네다',
    FUK: '후쿠오카', CTS: '삿포로', OKA: '오키나와', TPE: '타이베이', TSA: '타이베이 쑹산', HKG: '홍콩', PVG: '상하이 푸둥', SHA: '상하이 훙차오',
    BKK: '방콕', DMK: '방콕 돈므앙', DAD: '다낭', CXR: '나트랑', DPS: '발리', SIN: '싱가포르', CEB: '세부', BKI: '코타키나발루', CDG: '파리',
    KWL: '구이린', DYG: '장자제', NBS: '창바이산', UKB: '고베', NGO: '나고야' };

  /* ── 작은 도구 ── */
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function won(n) { return Math.round(Number(n) || 0).toLocaleString('ko-KR') + '원'; }
  function manwon(n) {   // 1,240,000 → '124만원' (도넛 가운데처럼 좁은 곳)
    n = Math.round(Number(n) || 0);
    if (Math.abs(n) < 10000) return n.toLocaleString('ko-KR') + '원';
    var m = n / 10000;
    return (m >= 100 ? Math.round(m) : Math.round(m * 10) / 10).toLocaleString('ko-KR') + '만원';
  }
  function ic(name, size) { return typeof window.icon === 'function' ? window.icon(name, size || 18) : ''; }
  function normNo(s) { return String(s || '').toUpperCase().replace(/[\s-]+/g, ''); }
  // 운항정보 시각은 'HHmm'(오늘 운항표라 날짜 없음) — 'YYYYMMDDHHmm'도 함께 받는다
  function hhmm(raw) { var d = String(raw || '').replace(/\D/g, ''); return d.length >= 12 ? d.slice(8, 10) + ':' + d.slice(10, 12) : d.length === 4 ? d.slice(0, 2) + ':' + d.slice(2) : ''; }
  function parseISO(s) { var p = String(s || '').split('-'); return new Date(+p[0], (+p[1] || 1) - 1, +p[2] || 1); }
  var DOW = ['일', '월', '화', '수', '목', '금', '토'];
  function mdDate(s) { var d = parseISO(s); return (d.getMonth() + 1) + '월 ' + d.getDate() + '일(' + DOW[d.getDay()] + ')'; }
  function dotDate(s, withYear) { var d = parseISO(s); return (withYear ? d.getFullYear() + '. ' : '') + (d.getMonth() + 1) + '. ' + d.getDate() + ' (' + DOW[d.getDay()] + ')'; }

  /* ═════════ 순수 계산 (테스트 대상) ═════════ */

  /* 기본으로 보여줄 여행: 마지막으로 본 여행 → 진행 중·다가오는 여행 중 가장 가까운 것 → 가장 최근 지난 여행 */
  function sortTrips(trips, today) {
    var up = trips.filter(function (t) { return (t.end || '') >= today; }).sort(function (a, b) { return String(a.start || '').localeCompare(String(b.start || '')); });
    var past = trips.filter(function (t) { return (t.end || '') < today; }).sort(function (a, b) { return String(b.start || '').localeCompare(String(a.start || '')); });
    return up.concat(past);
  }
  function pickDefault(trips, today, savedId) {
    var saved = savedId && trips.filter(function (t) { return t.id === savedId; })[0];
    return saved || sortTrips(trips, today)[0] || null;
  }

  var STAY_TYPES = ['hotel', 'stay', 'lodging'];
  function resvState(t, types) {
    var rs = (t.reservations || []).filter(function (r) { return r && types.indexOf(r.type) > -1; });
    if (rs.some(function (r) { return r.status === 'confirmed'; })) return 'confirmed';
    if (rs.length) return 'planned';
    return 'none';
  }

  /* 여행 준비 진행률 = 항공권·숙소·일정·준비물 4가지의 평균 (각 0~1) */
  function readiness(t) {
    var flight = resvState(t, ['flight']);
    var hasFlightNo = !!(t.flight && t.flight.no);
    var stay = resvState(t, STAY_TYPES);
    var len = (t.start && t.end) ? Math.max(1, Math.round((parseISO(t.end) - parseISO(t.start)) / 86400000) + 1) : 0;
    var days = (t.days || []).slice(0, len || 0);
    var planned = days.filter(function (d) { return d && d.items && d.items.length; }).length;
    var list = Array.isArray(t.checklist) ? t.checklist : [];
    var done = list.filter(function (c) { return c && c.done; }).length;
    var fScore = flight === 'confirmed' ? 1 : (flight === 'planned' || hasFlightNo) ? 0.5 : 0;
    var sScore = stay === 'confirmed' ? 1 : stay === 'planned' ? 0.5 : 0;
    var pScore = len ? planned / len : 0;
    var cScore = list.length ? done / list.length : 0;
    return {
      pct: Math.round((fScore + sScore + pScore + cScore) / 4 * 100),
      flight: flight, hasFlightNo: hasFlightNo, stay: stay,
      planDays: planned, totalDays: len, done: done, total: list.length
    };
  }

  /* 예상 여행비 모델 — 무엇을 그릴지와 그 근거(source)를 함께 돌려준다 */
  function budgetModel(t, cats) {
    var b = t.budget || {};
    var total = Math.max(0, Number(b.total) || 0);
    var spent = Math.max(0, (t.expenses || []).reduce(function (s, e) { return s + (Number(e && e.krw) || 0); }, 0));
    var rows = [], source = 'none';
    if (b.plan && Array.isArray(b.plan.items)) {
      rows = b.plan.items.filter(function (x) { return x && Number(x.amt) > 0; })
        .map(function (x) { return { key: x.key, label: x.label || x.key, color: x.color || '#98A2B3', amt: Number(x.amt) }; });
      if (rows.length) source = 'plan';
    }
    if (!rows.length && b.catLimits) {
      rows = (cats || []).map(function (c) { return { key: c.key, label: c.label, color: c.color, amt: Number(b.catLimits[c.key]) || 0 }; })
        .filter(function (x) { return x.amt > 0; });
      if (rows.length) source = 'limits';
    }
    if (!rows.length && !total && spent > 0) {   // 예산 없이 지출만 있는 여행: 실제 지출 구성
      var m = {};
      (t.expenses || []).forEach(function (e) { if (e) m[e.category] = (m[e.category] || 0) + (Number(e.krw) || 0); });
      rows = (cats || []).map(function (c) { return { key: c.key, label: c.label, color: c.color, amt: m[c.key] || 0 }; }).filter(function (x) { return x.amt > 0; });
      if (rows.length) source = 'actual';
    }
    rows.sort(function (a, b2) { return b2.amt - a.amt; });
    if (rows.length > 5) {
      var rest = rows.splice(4);
      rows.push({ key: 'rest', label: '그 밖의 항목', color: '#98A2B3', amt: rest.reduce(function (s, x) { return s + x.amt; }, 0) });
    }
    var sum = rows.reduce(function (s, x) { return s + x.amt; }, 0);
    if (source === 'limits' && total > sum) rows.push({ key: 'free', label: '항목 미배정', color: '#CBD5E1', amt: total - sum, muted: true });
    if (source === 'none') {   // 항목 내역이 없으면 총예산 대비 사용 현황만
      if (total > 0) {
        var used = Math.min(spent, total);
        rows = [{ key: 'spent', label: '실제 지출', color: spent > total ? '#D92D20' : '#0F8A6E', amt: used },
                { key: 'left', label: '남은 예산', color: '#BFD3F6', amt: Math.max(0, total - spent), muted: true }].filter(function (x) { return x.amt > 0 || x.key === 'spent'; });
        source = 'usage';
      }
    }
    var base = rows.reduce(function (s, x) { return s + x.amt; }, 0);
    rows.forEach(function (x) { x.pct = base ? Math.round(x.amt / base * 100) : 0; });
    return { total: total, spent: spent, left: total - spent, rows: rows, base: base, source: source,
      planAt: (b.plan && b.plan.at) || '', spentPct: total ? Math.round(spent / total * 100) : 0 };
  }

  /* 대시보드에 띄울 항공편: 이 여행의 가는 편 → 오는 편 → 인천공항 '내 편명'(출발) */
  function storedFlight(t, favs) {
    if (t && t.flight && t.flight.no) return { no: t.flight.no, airline: t.flight.airline || '', from: t.flight.from || '', to: t.flight.to || '',
      dep: t.flight.dep || '', arr: t.flight.arr || '', date: t.flight.date || '', terminal: t.flight.terminal || '', origin: 'trip' };
    if (t && t.flightBack && t.flightBack.no) { var fb = t.flightBack;
      return { no: fb.no, airline: fb.airline || '', from: fb.from || '', to: fb.to || '', dep: fb.dep || '', arr: fb.arr || '', date: fb.date || '', terminal: fb.terminal || '', origin: 'trip' }; }
    var f = (Array.isArray(favs) ? favs : []).filter(function (x) { return x && x.flightId && x.dir !== 'arr'; })[0];
    return f ? { no: f.flightId, airline: '', from: 'ICN', to: '', dep: '', arr: '', date: '', terminal: '', origin: 'fav' } : null;
  }

  /* 실시간 조회를 할지 — 인천 출발편이고, 날짜가 없거나 '오늘'일 때만.
     인천공항 운항표는 오늘 운항분만(시각 HHmm, 날짜 없음) 주므로, 내일 편을 매일 같은 편명의
     오늘 운항분과 섞으면 남의 탑승구·상태를 보여 주게 된다 → 내일·지난 날짜는 조회하지 않는다. */
  function liveEligibility(f, today) {
    if (!f || !normNo(f.no)) return 'none';
    if (f.from && normNo(f.from) !== 'ICN') return 'notIcn';
    if (f.date && f.date !== today) return 'notToday';
    return 'ok';
  }
  function liveItems(data) {
    var b = data && data.response && data.response.body, v = b && b.items;
    if (!v) return [];
    var items = Array.isArray(v) ? v : v.item;
    return Array.isArray(items) ? items : items ? [items] : [];
  }
  function matchLive(items, f) {
    var no = normNo(f.no), day = String(f.date || '').replace(/-/g, '');
    var hits = items.filter(function (x) { return normNo(x.flightId || x.flightNum) === no; });
    if (day) hits = hits.filter(function (x) { var raw = String(x.scheduleDateTime || '').replace(/\D/g, ''); return raw.length < 8 || raw.slice(0, 8) === day; });
    return hits[0] || null;
  }
  function remarkClass(r) {
    r = String(r || '');
    if (/결항|취소|회항/.test(r)) return 'is-bad';
    if (/지연|변경/.test(r)) return 'is-delay';
    if (/출발|탑승|오픈|마감/.test(r)) return 'is-ok';
    return '';
  }

  window.TCDashCore = { sortTrips: sortTrips, pickDefault: pickDefault, readiness: readiness, budgetModel: budgetModel,
    storedFlight: storedFlight, liveEligibility: liveEligibility, liveItems: liveItems, matchLive: matchLive, manwon: manwon, remarkClass: remarkClass };

  /* ═════════ 화면 ═════════ */
  function init() {
    var T = window.TripStore;
    var $ = function (id) { return document.getElementById(id); };
    if (!$('db-trip')) return;
    if (!T) {
      ['db-trip', 'db-budget', 'db-air'].forEach(function (id) { $(id).removeAttribute('aria-busy'); $(id).innerHTML = '<p class="db-error" role="alert">여행 데이터를 읽는 모듈을 불러오지 못했어요. 새로고침해 주세요.</p>'; });
      return;
    }
    var selected = null, airSeq = 0, airState = null, lastAirFetch = 0;

    function today() { return T.iso(); }
    function href(t, tab) { return '/trip?id=' + encodeURIComponent(t.id) + (tab ? '&tab=' + tab : ''); }
    function announce(msg) { var el = $('db-live'); if (el) { el.textContent = ''; setTimeout(function () { el.textContent = msg; }, 30); } }
    function safe(id, fn) {
      var el = $(id);
      try { fn(el); } catch (e) {
        console.error('[dashboard]', id, e);
        el.innerHTML = '<p class="db-error" role="alert">이 카드를 표시하는 중 문제가 생겼어요. 새로고침해 주세요.</p>';
      }
      el.removeAttribute('aria-busy');
    }
    function empty(icon, title, text, btns) {
      return '<div class="db-empty"><span class="db-empty-ic" aria-hidden="true">' + ic(icon, 28) + '</span><strong>' + esc(title) + '</strong><p>' + esc(text) + '</p>' +
        btns.map(function (b) { return '<a class="db-btn ' + (b[2] || 'db-btn-primary') + '" href="' + esc(b[1]) + '">' + esc(b[0]) + '</a>'; }).join('') + '</div>';
    }
    function pill(kind, text) { return '<span class="db-pill db-pill-' + kind + '">' + esc(text) + '</span>'; }

    /* ── 히어로 사진 ── */
    function heroPhoto(t) {
      var art = $('db-hero-art'); if (!art) return;
      var url = T.cityPhoto((t && t.city) || '오사카') || T.cityPhoto('오사카');
      var old = art.querySelector('img');
      if (old && old.getAttribute('data-src500') === url) return;
      if (old) old.remove();
      if (!url) return;
      var img = document.createElement('img');
      img.alt = ''; img.decoding = 'async'; img.referrerPolicy = 'no-referrer'; img.setAttribute('data-src500', url);
      img.onerror = function () { if (img.currentSrc && img.currentSrc !== url) { img.removeAttribute('srcset'); img.src = url; } else img.remove(); };   // 고해상도가 없으면 500px로
      // 폰(표시 폭 약 220px)은 500px, 넓은 화면은 960px — 폰에서도 960px(273KB)를 받던 것(2026-11-06 실측)
      img.srcset = url + ' 500w, ' + url.replace('/500px-', '/960px-') + ' 960w';
      img.sizes = '(max-width:700px) 166px, 567px';
      img.src = url;
      art.insertBefore(img, art.firstChild);
    }

    /* ── ① 내 여행 ── */
    function renderTrip(t) {
      $('db-trip-more').href = t ? href(t) : '/trips';
      safe('db-trip', function (el) {
        if (!t) {
          el.innerHTML = empty('briefcase', '아직 등록된 여행이 없어요', '여행을 만들면 준비 진행률, 예약 상태, 남은 준비물이 여기에 모여요.',
            [['첫 여행 만들기', '/trips?new=1'], ['여행지 둘러보기', '/destinations', 'db-btn-outline']]);
          return;
        }
        var r = readiness(t);
        var photo = T.cityPhoto(t.city);
        var dd = t.start ? T.ddayText(t) : '날짜 미정';
        var ddCls = dd === '완료' ? ' is-done' : (dd === 'D-DAY' || dd === '여행 중') ? ' is-now' : '';
        var nights = r.totalDays ? (r.totalDays - 1) + '박 ' + r.totalDays + '일' : '';
        var ppl = (t.members || []).length || 1;
        var date = (t.start && t.end) ? dotDate(t.start, true) + ' – ' + dotDate(t.end) : '여행 날짜를 정해 주세요';
        var h = '<div class="db-trip-top">' +
          (photo ? '<img class="db-cover" src="' + esc(photo) + '" alt="' + esc(t.city) + ' 풍경" width="104" height="104" loading="lazy" decoding="async" referrerpolicy="no-referrer">'
                 : '<span class="db-cover" aria-hidden="true"></span>') +
          '<div class="db-trip-meta"><h4 class="db-trip-city">' + esc(t.city || '나의 여행') + '</h4><span class="db-dday' + ddCls + '">' + esc(dd) + '</span>' +
          '<p class="db-trip-date">' + esc(date) + (nights ? '<br>' + nights + ' · ' + ppl + '명' : '') + '</p></div></div>';

        h += '<div class="db-progress-head"><span>여행 준비 진행률</span><strong>' + r.pct + '%</strong></div>' +
          '<div class="db-progress" role="progressbar" aria-label="여행 준비 진행률" aria-valuemin="0" aria-valuemax="100" aria-valuenow="' + r.pct + '" aria-valuetext="' + r.pct + '퍼센트"><span style="width:' + r.pct + '%"></span></div>';

        var fl = r.flight === 'confirmed' ? pill('ok', '예약 완료') : r.flight === 'planned' ? pill('warn', '예약 예정') : r.hasFlightNo ? pill('info', '편명 저장') : pill('none', '미등록');
        var st = r.stay === 'confirmed' ? pill('ok', '예약 완료') : r.stay === 'planned' ? pill('warn', '예약 예정') : pill('none', '미등록');
        var pl = !r.totalDays ? pill('none', '날짜 미정') : r.planDays >= r.totalDays ? pill('ok', r.totalDays + '/' + r.totalDays + '일 작성') : r.planDays ? pill('info', r.planDays + '/' + r.totalDays + '일 작성') : pill('none', '미작성');
        var ck = !r.total ? pill('none', '항목 없음') : r.done >= r.total ? pill('ok', '모두 완료') : pill('warn', r.done + '/' + r.total + ' 완료');
        function row(icon, label, p, tab) {
          return '<li><a href="' + href(t, tab) + '"><span class="db-st-ico" aria-hidden="true">' + ic(icon, 17) + '</span><span class="db-st-label">' + label + '</span>' + p + '<span class="db-chev" aria-hidden="true">›</span></a></li>';
        }
        h += '<ul class="db-status" aria-label="준비 현황">' + row('plane', '항공권 예약', fl, 'resv') + row('bed', '숙소 예약', st, 'resv') +
          row('calendar', '여행 일정', pl, 'plan') + row('list-checks', '출국 준비 체크리스트', ck, 'pack') + '</ul>';

        var todo = (t.checklist || []).filter(function (c) { return c && !c.done; }).slice(0, 3);
        if (todo.length) {
          h += '<div class="db-todo"><p class="db-todo-title" id="db-todo-t">남은 준비물 · 눌러서 완료</p><div role="group" aria-labelledby="db-todo-t">' + todo.map(function (c) {
            return '<label class="db-check"><input type="checkbox" data-cid="' + esc(c.id) + '"><span>' + esc(c.text || '준비 항목') + '</span></label>';
          }).join('') + '</div></div>';
        } else if (r.total) {
          h += '<p class="db-note">준비물을 모두 챙겼어요. 출국 당일엔 여권과 항공권만 다시 확인하세요.</p>';
        }
        h += '<div class="db-card-cta"><a class="db-btn db-btn-outline" href="' + href(t, 'pack') + '">준비물 관리</a><a class="db-btn db-btn-primary" href="' + href(t) + '">여행 상세 보기</a></div>';
        el.innerHTML = h;
      });
    }

    /* ── ② 예상 여행비 ── */
    function donutSvg(m) {
      var R = 70, C = 2 * Math.PI * R, off = 0, gap = m.rows.length > 1 ? 1.5 : 0;
      var segs = m.base ? m.rows.map(function (x) {
        var len = x.amt / m.base * C, seg = '';
        if (len > 0.5) seg = '<circle cx="84" cy="84" r="' + R + '" stroke="' + esc(x.color) + '" stroke-dasharray="' + Math.max(0.01, len - gap).toFixed(2) + ' ' + C.toFixed(2) + '" stroke-dashoffset="' + (-off).toFixed(2) + '"></circle>';
        off += len; return seg;
      }).join('') : '';
      return '<svg viewBox="0 0 168 168" aria-hidden="true" focusable="false"><circle class="db-donut-track" cx="84" cy="84" r="' + R + '"></circle>' + segs + '</svg>';
    }
    function renderBudget(t) {
      $('db-budget-more').href = t ? href(t, 'budget') : '/estimate';
      safe('db-budget', function (el) {
        if (!t) {
          el.innerHTML = empty('coins', '예산을 한눈에 관리하세요', '경비 계산으로 예상 여행비를 뽑아 여행에 담으면 항공·숙소·식비별로 나눠 보여 드려요.',
            [['여행비 미리 계산하기', '/estimate']]);
          return;
        }
        var m = budgetModel(t, T.CATS);
        var days = (t.start && t.end) ? T.tripLength(t) : 0;
        var ppl = (t.members || []).length || 1;
        var sub = esc(t.city || '내 여행') + ' · ' + (days ? (days - 1) + '박 ' + days + '일' : '기간 미정') + ' · ' + ppl + '명';
        if (!m.total && !m.spent) {
          el.innerHTML = '<div class="db-total"><p class="db-total-label">총 예상 여행비</p><strong>—</strong><p>' + sub + '</p></div>' +
            empty('pie-chart', '아직 예산이 없어요', '경비 계산에서 이 여행 예산을 담거나, 여행 상세에서 총예산을 직접 입력해 주세요.',
              [['경비 계산으로 예산 잡기', '/estimate'], ['직접 예산 입력', href(t, 'budget'), 'db-btn-outline']]);
          return;
        }
        var center = m.source === 'usage' ? '<span>예산 사용</span><b>' + m.spentPct + '%</b><small>' + manwon(m.total) + ' 중</small>'
          : m.source === 'actual' ? '<span>실제 지출</span><b>' + manwon(m.spent) + '</b><small>예산 미설정</small>'
          : '<span>총 예산</span><b>' + manwon(Math.max(m.total, m.base)) + '</b><small>' + (m.source === 'plan' ? '경비 계산 기준' : '항목별 한도') + '</small>';
        var label = (m.source === 'plan' ? '경비 계산 기준 항목별 예상액' : m.source === 'limits' ? '항목별 예산 한도' : m.source === 'actual' ? '카테고리별 실제 지출' : '총예산 대비 지출') + ': ' +
          m.rows.map(function (x) { return x.label + ' ' + won(x.amt) + ' ' + x.pct + '%'; }).join(', ');
        var h = '<div class="db-total"><p class="db-total-label">' + (m.total ? '총 예상 여행비' : '지금까지 쓴 돈') + '</p><strong>' + Math.round(m.total || m.spent).toLocaleString('ko-KR') + '<small>원</small></strong><p>' + sub + '</p></div>';
        h += '<div class="db-viz"><div class="db-donut" role="img" aria-label="' + esc(label) + '">' + donutSvg(m) + '<div class="db-donut-c">' + center + '</div></div>' +
          '<ul class="db-legend">' + m.rows.map(function (x) {
            return '<li><i style="background:' + esc(x.color) + '" aria-hidden="true"></i><span class="db-lg-name">' + esc(x.label) + '</span><b>' + x.pct + '%</b><small>' + won(x.amt) + '</small></li>';
          }).join('') + '</ul></div>';
        var note = m.source === 'plan' ? '경비 계산' + (m.planAt ? '(' + esc(m.planAt.replace(/-/g, '.')) + ')' : '') + '에서 담은 <b>예상액</b>이에요. 실제 지출과는 아래에서 비교하세요.'
          : m.source === 'limits' ? '여행 예산 탭에서 정한 <b>항목별 한도</b>예요.'
          : m.source === 'actual' ? '총예산이 없어 <b>실제 지출</b>을 카테고리별로 보여 드려요. 예상 비중이 아니에요.'
          : '항목별 예상액이 없어 <b>총예산 대비 지출</b>만 보여 드려요. 경비 계산에서 담으면 항공·숙소·식비별로 나눠 보여요.';
        h += '<p class="db-note">' + note + '</p>';
        if (m.total) {
          var over = m.left < 0;
          h += '<div class="db-money"><div><small>실제 지출</small><b>' + won(m.spent) + '</b><div class="db-spentbar" aria-hidden="true"><span style="width:' + Math.min(100, m.spentPct) + '%"></span></div></div>' +
            '<div class="' + (over ? 'db-over' : 'db-left') + '"><small>' + (over ? '예산 초과' : '남은 예산') + '</small><b>' + won(Math.abs(m.left)) + '</b><small>' + (over ? '예산의 ' + m.spentPct + '% 사용' : '예산의 ' + (100 - Math.min(100, m.spentPct)) + '% 남음') + '</small></div></div>';
        }
        h += '<div class="db-card-cta"><a class="db-btn db-btn-outline" href="/estimate">경비 계산</a><a class="db-btn db-btn-primary" href="' + href(t, 'budget') + '">예산·지출 관리</a></div>';
        el.innerHTML = h;
      });
    }

    /* ── ③ 공항 실시간 ── */
    function favFlights() { try { var v = JSON.parse(localStorage.getItem('icn_fav_flights') || '[]'); return Array.isArray(v) ? v : []; } catch (e) { return []; } }
    function flightCard(f, s) {
      var live = s.live;
      var airline = (live && live.airline) || f.airline || '';
      var fromCode = normNo(f.from) || 'ICN';
      var toCode = normNo(f.to) || (live && normNo(live.airportCode)) || '';
      var toCity = AIRPORT[toCode] || (live && live.airport) || (toCode ? '' : '도착지 미입력');
      var sched = live ? hhmm(live.scheduleDateTime) : f.dep;
      var est = live ? hhmm(live.estimatedDateTime) : '';
      var depTime = sched ? (est && est !== sched ? '<s>' + esc(sched) + '</s><em>' + esc(est) + '</em>' : esc(sched)) : '--:--';
      var terminal = live ? (TERM[live.terminalId] || live.terminalId || '') : (String(f.terminal || '').match(/T\s?[12]|탑승동/i) || [''])[0].replace(/\s/g, '').toUpperCase();
      var gate = live && live.gatenumber ? live.gatenumber : '';
      var remark = live ? (live.remark || '예정') : '';
      var tag = s.state === 'live' ? pill('ok', '● 실시간 ' + s.at) : s.state === 'loading' ? pill('info', '조회 중…') : s.state === 'error' ? pill('bad', '조회 실패')
        : s.state === 'missing' ? pill('warn', '운항 목록에 없음') : pill('none', '저장된 정보');
      var src = s.state === 'live' ? '인천국제공항공사 데이터를 ' + s.at + '에 조회했어요. 공항 사정으로 바뀔 수 있어요.'
        : s.state === 'loading' ? '인천공항 실시간 정보를 확인하고 있어요.'
        : s.state === 'error' ? '실시간 정보를 불러오지 못했어요. 아래는 저장된 정보예요.'
        : s.state === 'missing' ? '오늘 인천공항 출발 목록에서 이 편명을 찾지 못했어요. 편명과 날짜를 확인해 주세요.'
        : s.state === 'notToday' ? mdDate(f.date) + ' 출발 당일에 탑승구·운항 상태를 실시간으로 보여 드려요. 지금은 저장된 정보예요.'
        : s.state === 'notIcn' ? '인천공항 출발편만 실시간으로 조회돼요. 저장된 정보만 보여 드려요.'
        : '저장된 정보예요.';
      var canRetry = s.state === 'live' || s.state === 'error' || s.state === 'missing';
      var h = '<div class="db-flight">' +
        '<div class="db-fl-top"><div class="db-fl-id"><span class="db-fl-badge" aria-hidden="true">' + ic('plane', 18) + '</span><span><b>' + esc(normNo(f.no)) + '</b><small>' + esc(airline || (f.origin === 'fav' ? '인천공항 내 편명' : '항공사 미입력')) + '</small></span></div>' + tag + '</div>' +
        '<div class="db-route"><div><div class="db-code">' + esc(fromCode) + '</div><div class="db-city">' + esc(AIRPORT[fromCode] || '') + '</div><div class="db-time"><span class="db-sr">출발 </span>' + depTime + '</div></div>' +
        '<div class="db-route-mid" aria-hidden="true">' + ic('plane', 16) + '</div>' +
        '<div><div class="db-code">' + esc(toCode || '—') + '</div><div class="db-city">' + esc(toCity) + '</div><div class="db-time"><span class="db-sr">도착 </span>' + esc(f.arr || '--:--') + '</div></div></div>' +
        (f.date ? '<p class="db-fl-date">' + esc(dotDate(f.date, true)) + ' 출발' + (live ? '' : ' · 저장된 시각') + '</p>' : '') +
        '<div class="db-fl-grid">' +
          '<div><small>터미널</small><strong' + (terminal ? '' : ' class="is-pending"') + '>' + esc(terminal || '확인 전') + '</strong></div>' +
          '<div><small>탑승구</small><strong' + (gate ? '' : ' class="is-pending"') + '>' + esc(gate || (live ? '미배정' : '당일 공개')) + '</strong></div>' +
          '<div><small>운항 상태</small><strong class="' + (live ? remarkClass(remark) : 'is-pending') + '">' + esc(live ? remark : '실시간 미확인') + '</strong></div>' +
        '</div></div>' +
        '<div class="db-src"><p>' + src + '</p>' + (canRetry ? '<button type="button" class="db-refresh" id="db-air-retry" aria-label="실시간 정보 다시 조회">' + ic('refresh', 16) + '<span>새로고침</span></button>' : '') + '</div>' +
        '<div class="db-card-cta"><a class="db-btn db-btn-primary" href="/airport#tab=fav">인천공항 실시간 화면 ↗</a></div>';
      return h;
    }
    function renderAir(t, force) {
      var f = storedFlight(t, favFlights());
      safe('db-air', function (el) {
        if (!f) {
          el.innerHTML = empty('plane', '저장한 항공편이 없어요', '여행에 항공편을 넣거나 인천공항 화면에서 편명을 즐겨찾기하면 탑승구·운항 상태를 여기서 확인해요.',
            [['인천공항에서 편명 찾기', '/airport#tab=fav'], t ? ['여행에 항공편 넣기', href(t, 'air'), 'db-btn-outline'] : ['내 여행 보기', '/trips', 'db-btn-outline']]);
          return;
        }
        var elig = liveEligibility(f, today());
        if (elig !== 'ok') { el.innerHTML = flightCard(f, { state: elig }); return; }
        // 같은 편명을 1분 안에 다시 조회하지 않음(탭 전환마다 API 호출 방지)
        if (!force && airState && airState.no === normNo(f.no) && airState.date === f.date && Date.now() - lastAirFetch < 60000) {
          el.innerHTML = flightCard(f, airState); bindRetry(t); return;
        }
        var seq = ++airSeq;
        el.innerHTML = flightCard(f, { state: 'loading' });
        var ctrl = typeof AbortController === 'function' ? new AbortController() : null;
        var timer = setTimeout(function () { if (ctrl) ctrl.abort(); }, 8000);
        lastAirFetch = Date.now();
        fetch('/api/proxy?path=' + encodeURIComponent('StatusOfPassengerFlightsOdp/getPassengerDeparturesOdp') + '&numOfRows=500', ctrl ? { signal: ctrl.signal } : {})
          .then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
          .then(function (data) {
            if (seq !== airSeq) return;
            var hit = matchLive(liveItems(data), f);
            var at = new Date().toTimeString().slice(0, 5);
            airState = hit ? { state: 'live', live: hit, at: at } : { state: 'missing' };
            airState.no = normNo(f.no); airState.date = f.date;
            $('db-air').innerHTML = flightCard(f, airState); bindRetry(t);
            if (hit) announce(normNo(f.no) + ' 실시간 정보: ' + (hit.remark || '예정') + (hit.gatenumber ? ', 탑승구 ' + hit.gatenumber : ''));
          })
          .catch(function () {
            if (seq !== airSeq) return;
            airState = { state: 'error', no: normNo(f.no), date: f.date };
            $('db-air').innerHTML = flightCard(f, airState); bindRetry(t);
          })
          .then(function () { clearTimeout(timer); });
      });
    }
    function bindRetry(t) {
      var b = $('db-air-retry');
      if (b) b.addEventListener('click', function () { b.setAttribute('aria-busy', 'true'); renderAir(t, true); });
    }

    /* ── 인기 여행지 ── */
    function renderDest() {
      var list = [['오사카', '먹방과 도톤보리의 밤', '/osaka'], ['도쿄', '도시 여행의 모든 것', '/tokyo'], ['다낭', '바다와 리조트 휴양', '/danang'], ['제주', '가까운 섬, 푸른 바다', '/jeju']];
      $('db-dest').innerHTML = list.map(function (d) {
        var p = T.cityPhoto(d[0]);
        return '<a class="db-dest-card" href="' + d[2] + '">' + (p ? '<img src="' + esc(p) + '" alt="" loading="lazy" decoding="async" referrerpolicy="no-referrer">' : '') +
          '<span><strong>' + esc(d[0]) + '</strong><small>' + esc(d[1]) + '</small></span><span class="db-dest-go" aria-hidden="true">↗</span></a>';
      }).join('');
    }

    /* ── 여행 선택 ── */
    function fillSelect(trips) {
      var sel = $('db-trip-select');
      if (!trips.length) { sel.innerHTML = '<option value="">등록된 여행 없음</option>'; sel.disabled = true; return; }
      var tdy = today();
      sel.innerHTML = sortTrips(trips, tdy).map(function (t) {
        var when = t.start ? (t.end < tdy ? '지난 여행' : T.ddayText(t)) : '날짜 미정';
        return '<option value="' + esc(t.id) + '">' + esc(t.city || '여행') + ' · ' + esc(when) + '</option>';
      }).join('');
      sel.disabled = false;
      sel.value = selected ? selected.id : '';
    }
    function renderAll(forceAir) {
      heroPhoto(selected);
      renderTrip(selected);
      renderBudget(selected);
      renderAir(selected, forceAir);
    }
    function refresh(forceAir) {
      var trips = T.all().filter(function (t) { return t && t.id; });
      var saved = ''; try { saved = localStorage.getItem(SELECT_KEY) || ''; } catch (e) {}
      var keep = selected && trips.filter(function (t) { return t.id === selected.id; })[0];
      selected = keep || pickDefault(trips, today(), saved);
      fillSelect(trips);
      renderAll(forceAir);
    }

    $('db-trip-select').addEventListener('change', function (e) {
      selected = T.get(e.target.value) || null;
      try { if (selected) localStorage.setItem(SELECT_KEY, selected.id); } catch (er) {}
      airState = null;
      renderAll(false);
      if (selected) announce((selected.city || '여행') + ' 여행을 보고 있어요');
    });
    $('db-trip').addEventListener('change', function (e) {
      var cid = e.target && e.target.getAttribute('data-cid');
      if (!cid || !selected) return;
      var item = (selected.checklist || []).filter(function (c) { return c.id === cid; })[0];
      T.toggleChecklist(selected.id, cid);
      selected = T.get(selected.id);
      renderTrip(selected);
      if (item) announce('‘' + item.text + '’ 완료로 표시했어요');
      var first = $('db-trip').querySelector('.db-check input');
      if (first) first.focus();
    });
    window.addEventListener('storage', function (e) { if (!e.key || e.key === T.KEY || e.key === 'icn_fav_flights') refresh(false); });
    document.addEventListener('visibilitychange', function () { if (!document.hidden) refresh(false); });

    renderDest();
    refresh(false);
  }

  if (typeof document !== 'undefined' && document.addEventListener) {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
    else init();
  }
})();
