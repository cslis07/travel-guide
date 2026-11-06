/* 트래블코스트 — 입국 면세 한도 (내 여행 › 예산 탭 카드 · 귀국 카드 한 줄 · 물건별 시트)
 *
 * 쇼핑(shop) 지출을 1명당으로 나눠 미화로 바꾼 뒤 한도와 견준다. 메모로 술·향수·담배를 알아보고 따로 센다.
 * 물건별 분류는 사용자가 시트에서 고칠 수 있다(trip.duty.kinds[지출 id] = gen|alc|perf|tob|out).
 *
 * 기준: 관세법 시행규칙 제48조(2026-07-31 시행) — 1명 미화 800달러, 술 2L·400달러, 향수 100mL, 궐련 200개비(한 종류).
 *       관세법 제96조②(자진신고 시 관세 30%, 20만 원까지 경감) · 제241조⑤(신고 안 하면 세액 40% 가산세).
 *       2026-11-03 국가법령정보센터 현행 조문으로 확인. 규정이 바뀌면 LIMITS 만 고친다.
 *
 * 계산부(DutyFree.calc)는 화면 없이 돌아가 scripts/duty_test.mjs 가 검증한다.
 * 화면부는 trip.html 전역에 기댄다: trip, tid, T, esc, won, openSheet, renderShell, reget, setTab, toast
 */
(function () {
  'use strict';

  var LIMITS = {
    gen: 800, alcUsd: 400, alcL: 2, perfMl: 100, cig: 200,
    basis: '관세법 시행규칙 제48조', checked: '2026-11-03'
  };
  var KINDS = [
    { key: 'gen',  label: '일반 물품' },
    { key: 'alc',  label: '술' },
    { key: 'perf', label: '향수' },
    { key: 'tob',  label: '담배' },
    { key: 'out',  label: '현지에서 씀(빼기)' }
  ];
  var RX = {
    alc: /술|위스키|와인|사케|소주|맥주|보드카|데킬라|럼주|브랜디|코냑|꼬냑|샴페인|리큐르|고량주|백주|마오타이|우메슈|매실주|whisk|wine|sake|vodka|tequila|cognac|champagne|liquor|bourbon/i,
    perf: /향수|퍼퓸|코롱|perfume|parfum|cologne|\bed[pt]\b/i,
    tob: /담배|궐련|시가|아이코스|릴하이브리드|cigar|iqos/i
  };

  function guessKind(memo) {
    memo = String(memo || '');
    if (RX.tob.test(memo)) return 'tob';
    if (RX.perf.test(memo)) return 'perf';
    if (RX.alc.test(memo)) return 'alc';
    return 'gen';
  }
  function kindOf(t, e) {
    var k = t && t.duty && t.duty.kinds && t.duty.kinds[e.id];
    return k || guessKind(e.memo);
  }
  function usdOf(e, usdRate) {
    if (e.currency === 'USD' && e.amount > 0) return e.amount;
    return usdRate > 0 ? (e.krw || 0) / usdRate : 0;
  }
  function round2(n) { return Math.round(n * 100) / 100; }

  /* 여행 → 사람별 { gen, alc, perf, tob, out(미화) } + 물건 목록. 나눠 낸 쇼핑은 paidFor 인원수로 똑같이 나눈다 */
  function calc(t, usdRate) {
    var members = (t.members || []).map(function (m) { return m.name; });
    if (!members.length) members = ['나'];
    var by = {};
    members.forEach(function (n) { by[n] = { name: n, gen: 0, alc: 0, perf: 0, tob: 0, out: 0 }; });
    var items = [];
    (t.expenses || []).forEach(function (e) {
      if (e.category !== 'shop') return;
      var usd = usdOf(e, usdRate), kind = kindOf(t, e);
      var who = (e.paidFor && e.paidFor.length ? e.paidFor : [e.paidBy || members[0]]).filter(Boolean);
      if (!who.length) who = [members[0]];
      // 금액·비율로 나눈 쇼핑이면 그 비율대로(e.split — 정산과 같은 기준), 아니면 똑같이
      var sv = e.split && (e.split.mode === 'amt' || e.split.mode === 'ratio') && e.split.v, wt = {}, wsum = 0;
      if (sv) who.forEach(function (n) { var x = +sv[n]; wt[n] = isFinite(x) && x > 0 ? x : 0; wsum += wt[n]; });
      who.forEach(function (n) {
        if (!by[n]) by[n] = { name: n, gen: 0, alc: 0, perf: 0, tob: 0, out: 0 };
        by[n][kind] += wsum > 0 ? usd * wt[n] / wsum : usd / who.length;
      });
      items.push({ id: e.id, date: e.date, memo: e.memo || '', usd: round2(usd), krw: e.krw || 0, kind: kind, who: who, guessed: !(t.duty && t.duty.kinds && t.duty.kinds[e.id]) });
    });
    var people = Object.keys(by).map(function (n) {
      var p = by[n];
      ['gen', 'alc', 'perf', 'tob', 'out'].forEach(function (k) { p[k] = round2(p[k]); });
      p.left = round2(LIMITS.gen - p.gen);
      p.status = p.gen > LIMITS.gen ? 'over' : p.gen >= LIMITS.gen * 0.8 ? 'warn' : 'ok';
      p.alcOver = p.alc > LIMITS.alcUsd;
      return p;
    });
    var me = by['나'] ? '나' : members[0];
    people.sort(function (a, b) { return (b.name === me) - (a.name === me) || b.gen - a.gen; });
    return { people: people, me: people[0], items: items, limits: LIMITS };
  }

  /* 해외 여행인가 — 아는 도시는 시간대로, 모르는 도시는 원화 아닌 지출이 있으면 해외로 본다 */
  function isAbroad(t) {
    var tz = window.TripStore ? TripStore.cityTz(t.city) : '';
    if (tz) return tz !== 'Asia/Seoul';
    return (t.expenses || []).some(function (e) { return e.currency && e.currency !== 'KRW'; });
  }

  window.DutyFree = { LIMITS: LIMITS, KINDS: KINDS, guessKind: guessKind, calc: calc, isAbroad: isAbroad };

  /* ═══ 화면 (trip.html 전용) ═══ */
  if (typeof document === 'undefined') return;

  function usd(n) { return '$' + Math.round(n).toLocaleString('en-US'); }
  function krwOf(n) { return won(Math.round(n * (T.RATES.USD || 0) / 1000) * 1000); }
  function data() {
    if (!trip || !isAbroad(trip)) return null;
    var d = calc(trip, T.RATES.USD);
    return d.items.length ? d : null;
  }
  function msg(p) {
    if (p.status === 'over') return '<b>' + usd(-p.left) + ' 넘었어요</b> — 입국할 때 세관 신고 대상이에요. 자진신고하면 관세의 30%(20만 원까지)를 덜어 주고, 신고하지 않았다가 걸리면 세금의 40%가 가산세로 붙어요.';
    if (p.status === 'warn') return '거의 다 찼어요 — <b>' + usd(p.left) + '</b>(약 ' + krwOf(p.left) + ') 남았어요';
    return '한도까지 <b>' + usd(p.left) + '</b>(약 ' + krwOf(p.left) + ') 남았어요';
  }
  function extras(p) {
    var r = [];
    if (p.alc > 0) r.push('<div class="df-x' + (p.alcOver ? ' bad' : '') + '">🍶 술 ' + usd(p.alc) + ' / ' + usd(LIMITS.alcUsd) + ' 따로 · 합쳐서 ' + LIMITS.alcL + 'L 이하인지 확인' + (p.alcOver ? ' — 넘었어요' : '') + '</div>');
    if (p.perf > 0) r.push('<div class="df-x">🧴 향수는 ' + LIMITS.perfMl + 'mL까지 따로 면세 — 용량 확인</div>');
    if (p.tob > 0) r.push('<div class="df-x">🚬 담배는 궐련 ' + LIMITS.cig + '개비(한 종류)까지 따로 면세</div>');
    return r.join('');
  }

  /* 예산 탭 카드 */
  window.dutyCard = function () {
    var d = data(); if (!d) return '';
    var p = d.me, pct = Math.min(100, Math.round(p.gen / LIMITS.gen * 100));
    var others = d.people.slice(1).filter(function (x) { return x.gen + x.alc + x.perf + x.tob > 0; });
    return '<div class="dfc ' + p.status + '">'
      + '<div class="df-t">🛃 입국 면세 한도<span>1명당 ' + usd(LIMITS.gen) + ' · ' + (d.people.length > 1 ? esc(p.name) + ' 기준' : '쇼핑 지출로 계산') + '</span></div>'
      + '<div class="df-amt"><b>' + usd(p.gen) + '</b> / ' + usd(LIMITS.gen) + '<span>약 ' + krwOf(p.gen) + '</span></div>'
      + '<div class="df-bar" role="progressbar" aria-label="면세 한도 사용" aria-valuemin="0" aria-valuemax="100" aria-valuenow="' + pct + '"><i style="width:' + pct + '%"></i></div>'
      + '<p class="df-m">' + msg(p) + '</p>' + extras(p)
      + (others.length ? '<div class="df-ppl">' + others.map(function (x) {
          return '<span class="' + x.status + '">' + esc(x.name) + ' ' + usd(x.gen) + (x.status === 'over' ? ' 넘음' : x.status === 'warn' ? ' 거의' : '') + '</span>';
        }).join('') + '</div>' : '')
      + '<button class="seg df-btn" onclick="openDutySheet()">물건별로 보기·분류 고치기</button>'
      + '<small class="df-s">오늘 환율로 계산한 대략치예요(세관은 관세청 고시 환율). 출국 때 면세점에서 산 것도 쇼핑 지출로 넣으면 함께 계산돼요. 가족이라도 한도는 1명씩이에요. 기준 ' + LIMITS.basis + ' · ' + LIMITS.checked.replace(/-/g, '.') + ' 확인</small>'
      + '</div>';
  };

  /* 귀국 카드 한 줄 */
  window.dutyLine = function () {
    var d = data(); if (!d) return '';
    var p = d.me;
    var txt = p.status === 'over' ? '면세 한도 ' + usd(-p.left) + ' 넘음 — 세관 자진신고 대상' : p.status === 'warn' ? '면세 한도 거의 참 — ' + usd(p.left) + ' 남음' : '면세 한도 ' + usd(p.gen) + ' / ' + usd(LIMITS.gen) + ' — 신고 안 해도 돼요';
    return '<button class="df-line ' + p.status + '" onclick="setTab(\'budget\')">🛃 ' + txt + (p.alcOver ? ' · 술 한도 넘음' : '') + ' ›</button>';
  };

  window.openDutySheet = function () {
    var d = calc(trip, T.RATES.USD);
    var rows = d.items.length ? d.items.map(function (it) {
      return '<div class="df-row"><div class="df-rm"><b>' + esc(it.memo || '쇼핑') + '</b><small>' + esc(T.fmtMD(it.date)) + ' · ' + usd(it.usd) + ' (' + won(it.krw) + ')' + (it.who.length > 1 ? ' · ' + it.who.length + '명이 나눔' : it.who[0] !== d.me.name ? ' · ' + esc(it.who[0]) + ' 몫' : '') + '</small></div>'
        + '<select class="in df-sel" aria-label="' + esc((it.memo || '쇼핑') + ' 분류') + '" onchange="setDutyKind(\'' + esc(it.id) + '\',this.value)">'
        + KINDS.map(function (k) { return '<option value="' + k.key + '"' + (k.key === it.kind ? ' selected' : '') + '>' + k.label + '</option>'; }).join('')
        + '</select></div>';
    }).join('') : '<p class="ps-p">쇼핑으로 기록한 지출이 없어요.</p>';
    openSheet('<h3>🛃 면세 한도 — 물건별</h3>'
      + '<p class="ps-p">메모로 술·향수·담배를 알아봐서 따로 셌어요. 틀렸으면 고쳐 주세요. 현지에서 먹거나 쓰고 온 것은 \'빼기\'로 두면 한도 계산에서 빠져요.</p>'
      + rows
      + '<p class="ps-p" style="margin-top:12px">1명당 ' + usd(LIMITS.gen) + '(술·향수·담배는 따로: 술 ' + LIMITS.alcL + 'L·' + usd(LIMITS.alcUsd) + ', 향수 ' + LIMITS.perfMl + 'mL, 궐련 ' + LIMITS.cig + '개비). 19세 미만은 술·담배가 면세되지 않아요. '
      + '자세한 기준은 <a href="https://www.customs.go.kr/" target="_blank" rel="noopener">관세청</a>에서 확인하세요.</p>');
  };

  window.setDutyKind = function (id, kind) {
    var t = T.get(tid); if (!t) return;
    t.duty = t.duty || {}; t.duty.kinds = t.duty.kinds || {};
    t.duty.kinds[id] = kind;
    T.upsert(t); reget(); renderShell();
    toast('분류를 바꿨어요');
  };
})();
