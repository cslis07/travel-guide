/* 예약 확인 메일·문자 붙여넣기 → 항공편·숙소·예약번호 뽑기 (폰 안에서만, 외부 전송 없음)
   parseBooking(text, {year}) → { flights:[{no,date,dep,arr,from,to}], hotels:[{name,checkin,checkout}], refs:[code] }
   항공사·예약사이트마다 형식이 제각각이라 '확실한 것만' 뽑고, 못 찾은 칸은 비워 둔다(사용자가 미리보기에서 확인). */
(function (root) {
  'use strict';
  var AIRLINES = 'KE|OZ|7C|LJ|TW|BX|RS|ZE|YP|RF|JL|NH|MM|GK|BC|7G|IT|CI|BR|JX|CX|UO|HX|TG|FD|SL|WE|VZ|VJ|VN|QH|SQ|TR|PR|5J|Z2|MH|AK|D7|OD|AF|KL|LH|MU|CZ|CA|HO|FM|9C|SC|ZH|QR|EK|EY|TK|UA|DL|AA';
  var IATA = ('ICN GMP PUS CJU TAE CJJ KWJ RSU USN MWX KIX ITM NRT HND FUK CTS OKA NGO KMJ KOJ HIJ SDJ TPE TSA KHH RMQ HKG MFM PVG SHA PEK PKX CAN SZX DYG KWL YNJ TAO DLC ' +
    'BKK DMK HKT CNX USM DAD CXR SGN HAN PQC DPS CGK SUB SIN MNL CEB CRK BKI KUL PEN LGK CDG ORY NCE LHR FRA FCO BCN ' +
    'LAX JFK SFO SEA HNL GUM SPN').split(' ');
  var KO_AP = { '인천': 'ICN', '김포': 'GMP', '김해': 'PUS', '부산': 'PUS', '제주': 'CJU', '간사이': 'KIX', '나리타': 'NRT', '하네다': 'HND', '후쿠오카': 'FUK',
    '신치토세': 'CTS', '삿포로': 'CTS', '나하': 'OKA', '오키나와': 'OKA', '타오위안': 'TPE', '송산': 'TSA', '홍콩': 'HKG', '푸동': 'PVG', '수완나품': 'BKK', '돈므앙': 'DMK',
    '방콕': 'BKK', '다낭': 'DAD', '나트랑': 'CXR', '깜라인': 'CXR', '발리': 'DPS', '덴파사르': 'DPS', '싱가포르': 'SIN', '창이': 'SIN', '막탄': 'CEB', '세부': 'CEB',
    '코타키나발루': 'BKI', '샤를드골': 'CDG', '장자제': 'DYG', '장가계': 'DYG', '구이린': 'KWL', '계림': 'KWL', '옌지': 'YNJ', '연길': 'YNJ' };
  var MON = { JAN: 1, FEB: 2, MAR: 3, APR: 4, MAY: 5, JUN: 6, JUL: 7, AUG: 8, SEP: 9, OCT: 10, NOV: 11, DEC: 12 };
  var p2 = function (n) { return (n < 10 ? '0' : '') + n; };

  function mk(y, m, d) { y = +y; m = +m; d = +d; if (y < 100) y += 2000; if (!(m >= 1 && m <= 12 && d >= 1 && d <= 31 && y >= 2020 && y <= 2100)) return ''; return y + '-' + p2(m) + '-' + p2(d); }
  /* 텍스트 속 날짜들을 위치와 함께 */
  function dates(t, yHint) {
    var out = [], m, re;
    var add = function (i, v) { if (v) out.push({ i: i, v: v }); };
    re = /(\d{4})\s*[.\-\/년]\s*(\d{1,2})\s*[.\-\/월]\s*(\d{1,2})\s*일?/g; while ((m = re.exec(t))) add(m.index, mk(m[1], m[2], m[3]));
    re = /(?:^|[^\d.])(\d{1,2})\s*월\s*(\d{1,2})\s*일/g; while ((m = re.exec(t))) add(m.index, mk(yHint, m[1], m[2]));
    re = /\b(\d{1,2})\s?(JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC)[A-Z]*\.?\s?(\d{4}|\d{2})?\b/gi; while ((m = re.exec(t))) add(m.index, mk(m[3] || yHint, MON[m[2].toUpperCase()], m[1]));
    re = /\b(JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC)[a-z]*\.?\s+(\d{1,2}),?\s+(\d{4})\b/gi; while ((m = re.exec(t))) add(m.index, mk(m[3], MON[m[1].toUpperCase()], m[2]));
    if (!out.length) { re = /(?:^|[^\d\/.])(\d{1,2})\/(\d{1,2})(?![\d\/])/g; while ((m = re.exec(t))) add(m.index, mk(yHint, m[1], m[2])); }   // 문자 속 '11/14'(월/일) — 다른 날짜가 없을 때만
    var seen = {}; return out.filter(function (x) { var k = x.i + x.v; if (seen[k]) return false; seen[k] = 1; return true; }).sort(function (a, b) { return a.i - b.i; });
  }
  function times(t) { var out = [], m, re = /(?:^|[^\d])([01]?\d|2[0-3])\s*[:시]\s*([0-5]\d)(?!\d)/g; while ((m = re.exec(t))) out.push(p2(+m[1]) + ':' + m[2]); return out; }
  function airports(t) {
    var out = [], m, re = new RegExp('\\b(' + IATA.join('|') + ')\\b', 'g');
    while ((m = re.exec(t))) out.push({ i: m.index, v: m[1] });
    if (out.length < 2) for (var k in KO_AP) {   // '제주항공'·'에어부산'처럼 항공사 이름 속 지명은 공항이 아님
      for (var i = t.indexOf(k); i > -1; i = t.indexOf(k, i + 1)) {
        if (t.substr(i + k.length, 2) === '항공' || t.substr(Math.max(0, i - 2), 2) === '에어') continue;
        out.push({ i: i, v: KO_AP[k] }); break;
      }
    }
    out.sort(function (a, b) { return a.i - b.i; });
    var r = []; out.forEach(function (x) { if (!r.length || r[r.length - 1] !== x.v) r.push(x.v); }); return r;
  }
  function after(t, labelRe, yHint) {   // 라벨 바로 뒤(60자 안) 첫 날짜
    var m = labelRe.exec(t); if (!m) return '';
    var d = dates(t.slice(m.index, m.index + 80), yHint); return d.length ? d[0].v : '';
  }

  function parseBooking(text, opt) {
    var t = String(text || '').replace(/\r/g, ''), yHint = (opt && opt.year) || new Date().getFullYear();
    var res = { flights: [], hotels: [], refs: [] };
    // 예약번호
    var rre = /(예약\s*번호|예약\s*코드|확인\s*번호|확정\s*번호|발권\s*번호|Booking\s*(?:ID|No\.?|number|reference|code)|Confirmation\s*(?:number|code|No\.?|#)|Reservation\s*(?:number|code|No\.?)|PNR|Itinerary\s*(?:number|#|No\.?))\s*[:#：]?\s*([A-Z0-9][A-Z0-9.\-]{4,19})/gi, m;
    while ((m = rre.exec(t))) { var c = m[2].toUpperCase().replace(/[.\-]+$/, '');   // Booking.com '4471.229.018'처럼 점 포함
      if (res.refs.indexOf(c) < 0 && /\d|^[A-Z]{6}$/.test(c)) res.refs.push(c); }
    // 항공편: 편명마다 다음 편명 전까지를 한 구간으로
    var fre = new RegExp('\\b(' + AIRLINES + ')\\s?-?(\\d{2,4})\\b', 'g'), hits = [];
    while ((m = fre.exec(t))) { var no = m[1] + m[2]; if (!hits.some(function (h) { return h.no === no; })) hits.push({ no: no, i: m.index }); }
    var allD = dates(t, yHint);
    // 구간 = 편명이 있는 줄의 처음부터 다음 편명이 있는 줄 전까지(앞 구간의 공항·날짜가 섞이지 않게)
    var lineStart = function (i) { return t.lastIndexOf('\n', i - 1) + 1; };
    hits.forEach(function (h, k) {
      var st = lineStart(h.i), end = k + 1 < hits.length ? lineStart(hits[k + 1].i) : Math.min(t.length, h.i + 400);
      if (end <= st) end = k + 1 < hits.length ? hits[k + 1].i : t.length;   // 두 편명이 한 줄에 있을 때
      var seg = t.slice(st, end), aps = airports(seg), tm = times(seg), ds = dates(seg, yHint);
      var prev = allD.filter(function (d) { return d.i < st; }).pop();   // 줄에 날짜가 없으면 바로 앞에 나온 날짜(여정 머리글)
      res.flights.push({ no: h.no, date: ds.length ? ds[0].v : (prev ? prev.v : ''), from: aps[0] || '', to: aps[1] || '', dep: tm[0] || '', arr: tm[1] || '' });
    });
    // 숙소: 체크인/아웃 날짜 + 이름
    var ci = after(t, /(체크인|입실|Check[\s-]?in)/i, yHint), co = after(t, /(체크아웃|퇴실|Check[\s-]?out)/i, yHint);
    var nm = '', nre = /(?:숙소\s*명|호텔\s*명|숙소|호텔|Hotel(?:\s*name)?|Property(?:\s*name)?|Accommodation)\s*[:：]\s*([^\n]{2,60})/i.exec(t);
    if (nre) nm = nre[1].trim();
    else { var line = t.split('\n').map(function (s) { return s.trim(); }).filter(function (s) { return s.length >= 4 && s.length <= 60 && /(Hotel|호텔|Resort|리조트|Inn\b|Hostel|호스텔|료칸|Ryokan|Residence|레지던스|Suites)/i.test(s) && !/(예약|확인|안내|Booking|confirmation)/i.test(s); })[0]; if (line) nm = line; }
    if (ci || co || nm) res.hotels.push({ name: nm, checkin: ci, checkout: co });
    return res;
  }
  root.parseBooking = parseBooking;
  if (typeof module !== 'undefined') module.exports = parseBooking;
})(typeof window !== 'undefined' ? window : globalThis);
