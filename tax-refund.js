/* 트래블코스트 — 택스리펀(여행지에서 낸 부가세·소비세 돌려받기) (내 여행 › 예산 탭 카드 · 지출 입력 창 한 줄)
 *
 * 쇼핑(shop) 지출을 '같은 가게(메모가 같으면 같은 가게로 봄)·같은 날'로 묶어 나라별 최소 금액과 견준다.
 * 영수증 한 장 기준인 나라(필리핀·인도네시아)는 지출 하나씩 본다. 인도네시아는 여행 전체 합계 기준도 있다.
 *
 * 나라별 기준 — 2026-11-05 각국 공식 자료로 확인(src). 바뀌면 RULES 만 고친다.
 *   일본 ¥5,000(세금 빼고, 2026-11-01부터 리펀드 방식) · 중국 200위안 · 대만 NT$2,000 · 태국 2,000바트 · 베트남 2,000,000동
 *   인도네시아 영수증마다 부가세 Rp50,000·합계 Rp500,000 · 싱가포르 S$100 · 필리핀 영수증 한 장 ₱3,000 · 프랑스 €100.01
 *   홍콩(판매세 없음)·말레이시아(관광객 환급 제도 없음)는 none
 *
 * 계산부(TaxRefund.calc)는 화면 없이 돌아가 scripts/taxrefund_test.mjs 가 검증한다.
 * 화면부는 trip.html 전역에 기댄다: trip, T, esc, won, exState
 */
(function () {
  'use strict';

  var CHECKED = '2026-11-05';
  var RULES = {
    jp: { cur: 'JPY', min: 5000, taxIn: 1.1, unit: '같은 가게·같은 날 합계(세금 빼고)',
      how: '2026년 11월부터는 계산할 때 세금까지 내고, 출국할 때 세관 확인을 받은 뒤 돌려받아요. 산 날 가게에 여권을 보여 주고, 산 날부터 90일 안에 가지고 나가야 해요.',
      src: ['일본 국세청', 'https://www.nta.go.jp/publication/pamph/shohi/menzei/201805/0523.htm'] },
    cn: { cur: 'CNY', min: 200, unit: '같은 가게·같은 날 합계',
      how: '\'退税商店(Tax Refund)\' 가게에서 여권을 보여 주고 환급 신청서·영수증을 받아 출국 공항 환급 창구에서 돌려받아요. 그 자리에서 바로 돌려주는 가게도 있어요. 쓰지 않은 채로 가지고 나가야 해요.',
      src: ['중국 국가세무총국', 'https://www.chinatax.gov.cn/eng/c101269/c5240123/content.html'] },
    tw: { cur: 'TWD', min: 2000, unit: '같은 가게·같은 날 합계(세금 포함)',
      how: '退稅 표시 가게에서 여권을 보여 주세요. 같은 날 같은 가게 NT$48,000까지는 가게에서 바로 소액 환급, 넘으면 출국 공항에서 받아요. 산 날부터 90일 안에 가지고 나가야 해요.',
      src: ['대만 재정부', 'https://law-out.mof.gov.tw/LawContent.aspx?id=FL026299'] },
    th: { cur: 'THB', min: 2000, unit: '같은 가게·같은 날 합계(VAT 포함)',
      how: '\'VAT REFUND FOR TOURISTS\' 가게에서 여권을 보여 주고 P.P.10 서류와 영수증 원본을 받으세요. 60일 안에 가지고 나가야 하고, 합계 20,000바트가 넘으면 체크인 전에 세관 확인을 받아요.',
      src: ['태국 국세청', 'https://vrtweb.rd.go.th/81.html'] },
    vn: { cur: 'VND', min: 2000000, unit: '같은 가게·같은 날 합계',
      how: '환급 가맹점에서 여권을 보여 주고 환급용 영수증을 받으세요. 출국 60일 안에 산 것만 되고, 부가세의 85%를 돌려받아요(15%는 수수료). 출국 공항 환급 창구에서 받아요.',
      src: ['베트남 재정부 통지 84/2026', 'https://thuvienphapluat.vn/van-ban/Thue-Phi-Le-Phi/Thong-tu-84-2026-TT-BTC-hoan-thue-gia-tri-gia-tang-hang-hoa-nguoi-nuoc-ngoai-mang-theo-khi-xuat-canh-713478.aspx'] },
    id: { cur: 'IDR', perReceipt: true, min: 505000, tripMin: 5050000, unit: '영수증마다 부가세 Rp50,000(물건값 약 Rp505,000) 이상, 합계 부가세 Rp500,000(약 Rp5,050,000) 이상',
      how: '\'VAT Refund for Tourists\' 가게에서 여권을 보여 주고 특별 세금계산서를 받으세요. 출국 1개월 안에 산 물건만 되고, 출국 공항 환급 창구에서 돌려받아요.',
      src: ['인도네시아 국세청(DJP)', 'https://pajak.go.id/en/node/62549'] },
    sg: { cur: 'SGD', min: 100, unit: '같은 가게 합계(GST 포함, 같은 날 영수증 3장까지)',
      how: '환급(eTRS) 가맹점에서 여권을 보여 주고 등록하세요. 창이 공항 eTRS 키오스크에서 신청해요 — 부치는 짐에 넣을 물건은 체크인 전에.',
      src: ['싱가포르 세관', 'https://www.customs.gov.sg/at-customs/departing-singapore/tourist-refund-scheme/'] },
    ph: { cur: 'PHP', perReceipt: true, min: 3000, unit: '영수증 한 장',
      how: '인증받은 가맹점에서만 돼요. 사기 전에 여권과 eTravel 등록을 보여 주고, 산 날부터 60일 안에 직접 가지고 나가야 해요.',
      src: ['필리핀 재무부', 'https://www.dof.gov.ph/ph-is-now-vat-free-for-foreign-tourists/'] },
    fr: { cur: 'EUR', min: 100.01, unit: '같은 가게 합계(세금 포함, 3일 안 구매까지)',
      how: '\'Tax Free·Détaxe\' 가게에서 여권을 보여 주고 전자 서류를 받으세요. 마지막으로 EU를 떠나는 공항의 PABLO 단말기에서 서류를 확인받아야 돌려받아요.',
      src: ['프랑스 관세청', 'https://www.douane.gouv.fr/en/fiche/tax-exemption-france-tourists-pablo'] },
    hk: { none: '홍콩은 판매세(부가세)가 없어서 돌려받을 세금이 없어요.' },
    my: { none: '말레이시아는 지금 관광객 세금 환급 제도가 없어요.' }
  };

  function ruleOf(t) { var cc = window.TripStore ? TripStore.countryOf(t && t.city) : ''; return cc && RULES[cc] ? { cc: cc, r: RULES[cc] } : null; }
  /* 지출 → 현지 통화 금액. 현지 통화로 적었으면 그대로, 아니면 원화를 환율로 되돌린다 */
  function localAmt(e, cur, rates) {
    if (e.currency === cur) return +e.amount || 0;
    var r = rates && rates[cur]; return r > 0 ? (e.krw || 0) / r : 0;
  }
  function storeKey(memo) { return String(memo || '').trim().toLowerCase().replace(/\s+/g, ''); }
  function judged(sum, r) { return r.taxIn ? sum / r.taxIn : sum; }   // 일본은 세금 뺀 금액으로 판단

  /* 여행 → { cc, rule, groups:[{date, store, memo, amt, ids, ok}], ok:[...], tripOk } — 기준 없는 나라는 null */
  function calc(t, rates) {
    var ru = ruleOf(t); if (!ru) return null;
    var r = ru.r;
    if (r.none) return { cc: ru.cc, rule: r, groups: [], ok: [], tripOk: false };
    var map = {}, groups = [];
    (t.expenses || []).forEach(function (e) {
      if (e.category !== 'shop') return;
      var amt = localAmt(e, r.cur, rates), sk = storeKey(e.memo);
      var key = r.perReceipt || !sk ? 'id:' + e.id : (e.date || '') + '|' + sk;   // 메모가 없으면 같은 가게인지 모르니 따로
      var g = map[key];
      if (!g) { g = map[key] = { date: e.date || '', store: sk, memo: e.memo || '쇼핑', amt: 0, ids: [] }; groups.push(g); }
      g.amt += amt; g.ids.push(e.id);
    });
    groups.forEach(function (g) { g.amt = Math.round(g.amt * 100) / 100; g.ok = judged(g.amt, r) >= r.min; });
    var ok = groups.filter(function (g) { return g.ok; });
    var okSum = ok.reduce(function (s, g) { return s + g.amt; }, 0);
    return { cc: ru.cc, rule: r, groups: groups, ok: ok, tripOk: ok.length > 0 && (!r.tripMin || okSum >= r.tripMin), okSum: Math.round(okSum) };
  }
  /* 지출 입력 창: 이 금액 하나로 기준을 넘는가 */
  function hits(t, amount, cur, rates) {
    var ru = ruleOf(t); if (!ru || ru.r.none) return null;
    var r = ru.r, v = cur === r.cur ? amount : (rates && rates[cur] && rates[r.cur] ? amount * rates[cur] / rates[r.cur] : 0);
    return { rule: r, ok: judged(v, r) >= r.min };
  }

  window.TaxRefund = { RULES: RULES, CHECKED: CHECKED, calc: calc, hits: hits, ruleOf: ruleOf };

  /* ═══ 화면 (trip.html 전용) ═══ */
  if (typeof document === 'undefined') return;

  var SYM = { JPY: '¥', CNY: '¥', TWD: 'NT$', THB: '฿', VND: '₫', IDR: 'Rp', SGD: 'S$', PHP: '₱', EUR: '€' };
  function money(n, cur) {
    var s = SYM[cur] || '', d = cur === 'SGD' || cur === 'EUR' ? 2 : 0;
    var v = (Math.round(n * Math.pow(10, d)) / Math.pow(10, d)).toLocaleString('en-US', { maximumFractionDigits: d });
    return cur === 'VND' ? v + s : s + v;
  }
  function minText(r) { return money(r.min, r.cur); }

  /* 예산 탭 카드 — 쇼핑 지출이 있는 해외 여행에만 */
  window.trCard = function () {
    if (!trip) return '';
    var d = calc(trip, T.RATES); if (!d) return '';
    var r = d.rule;
    if (r.none) return d.groups.length || (trip.expenses || []).some(function (e) { return e.category === 'shop'; }) ? '<div class="trc none"><div class="tr-t">🧾 택스리펀</div><p class="tr-m">' + r.none + '</p></div>' : '';
    if (!d.groups.length) return '';
    var head = d.ok.length
      ? (d.tripOk ? '돌려받을 수 있는 쇼핑 <b>' + d.ok.length + '건</b>' : '영수증은 ' + d.ok.length + '건 맞지만, 합계가 아직 기준(' + money(r.tripMin, r.cur) + ')에 못 미쳐요')
      : '아직 기준을 넘은 쇼핑이 없어요';
    var list = d.ok.map(function (g) {
      return '<li><span>' + esc(T.fmtMD(g.date)) + ' · ' + esc(g.memo) + (g.ids.length > 1 ? ' (' + g.ids.length + '건 합산)' : '') + '</span><b>' + money(g.amt, r.cur) + '</b></li>';
    }).join('');
    return '<div class="trc' + (d.tripOk ? ' ok' : '') + '">'
      + '<div class="tr-t">🧾 택스리펀<span>' + esc(r.unit) + ' ' + minText(r) + ' 이상</span></div>'
      + '<p class="tr-m">' + head + '</p>'
      + (list ? '<ul class="tr-l">' + list + '</ul>' : '')
      + '<p class="tr-h">' + esc(r.how) + '</p>'
      + '<small class="tr-s">메모가 같은 쇼핑을 같은 가게로 보고 합쳤어요. 환급 표시가 있는 가게에서 산 것만 돼요. 수수료를 빼고 돌려줘서 실제 받는 돈은 세금보다 적어요. 기준 <a href="' + r.src[1] + '" target="_blank" rel="noopener">' + esc(r.src[0]) + '</a> · ' + CHECKED.replace(/-/g, '.') + ' 확인</small>'
      + '</div>';
  };

  /* 지출 입력 창 — 쇼핑을 고르면 기준 안내, 넘으면 여권 챙기라고 */
  window.trHint = function () {
    var el = document.getElementById('ex-tr'); if (!el || !trip || typeof exState === 'undefined') return;
    if (exState.cat !== 'shop') { el.innerHTML = ''; return; }
    var a = document.getElementById('ex-amt'), v = parseFloat(a && a.value) || 0;
    var h = hits(trip, v, exState.cur, T.RATES); if (!h) { el.innerHTML = ''; return; }
    el.className = 'ex-tr' + (h.ok ? ' ok' : '');
    el.innerHTML = h.ok
      ? '🧾 택스리펀 받을 수 있는 금액이에요 — 환급 표시 가게라면 계산할 때 <b>여권</b>을 보여 주세요'
      : '🧾 ' + esc(h.rule.unit) + ' ' + minText(h.rule) + ' 이상이면 택스리펀';
  };
})();
