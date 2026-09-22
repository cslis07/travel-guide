/* ═══════════════════════════════════════════════════════════
   트래블코스트 — "여행에 담기" 공유 모듈  (window.TripAttach)

   estimate(예산)·prepare(준비물)·목적지 가이드(도시/일정) 등 어느 페이지에서든
   "이 결과를 내 여행에 담기"를 호출하면, 기존 여행 선택 또는 새 여행 생성 후
   페이로드를 적용하고 그 여행 허브(/trip?id=)로 이동한다. TripStore 의존.

   payload = {
     label,                      // 시트 제목
     city,                       // 새 여행 기본 도시명
     budget,                     // (선택) 총예산 원
     checklist:[{group,text,when}],   // (선택) 준비물
     itinerary:[{time,type,title,memo}], // (선택) 1일차에 담을 일정
     start, end, people          // (선택) 새 여행 기본값
   }
   ═══════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  if (!window.TripStore) { console.warn('[TripAttach] TripStore 필요'); }

  var CSS = [
    '.ta-wrap{position:fixed;inset:0;background:rgba(16,24,40,.5);display:none;align-items:flex-end;justify-content:center;z-index:2000}',
    '.ta-wrap.on{display:flex}',
    '.ta{background:#fff;width:100%;max-width:640px;border-radius:22px 22px 0 0;padding:16px 18px 26px;max-height:90vh;overflow-y:auto;animation:taUp .25s cubic-bezier(.2,.9,.3,1)}',
    '@keyframes taUp{from{transform:translateY(100%)}to{transform:none}}',
    '.ta-grip{width:38px;height:4px;background:#E4E7EC;border-radius:999px;margin:0 auto 12px}',
    '.ta h3{font-size:17px;font-weight:800;margin-bottom:4px;color:#101828}',
    '.ta .sub{font-size:12.5px;color:#667085;margin-bottom:12px}',
    '.ta-trip{display:flex;align-items:center;gap:11px;padding:12px;border:1px solid #E4E7EC;border-radius:13px;margin-bottom:8px;cursor:pointer;background:#fff}',
    '.ta-trip:active{background:#F9FAFB}',
    '.ta-trip .dot{width:38px;height:38px;border-radius:10px;flex:0 0 auto;display:grid;place-items:center;color:#fff;font-weight:800;font-size:15px}',
    '.ta-trip .nm{font-size:14px;font-weight:700;color:#101828}',
    '.ta-trip .mt{font-size:11.5px;color:#98A2B3}',
    '.ta-trip .go{margin-left:auto;color:#1B4FD8;font-weight:800}',
    '.ta-div{font-size:11.5px;font-weight:800;color:#98A2B3;letter-spacing:.02em;margin:14px 2px 8px;text-transform:uppercase}',
    '.ta-lbl{display:block;font-size:12px;font-weight:700;color:#475467;margin:9px 0 5px}',
    '.ta-in{width:100%;padding:11px 12px;border:1px solid #E4E7EC;border-radius:11px;font-size:14px;font-family:inherit;background:#F9FAFB}',
    '.ta-row{display:flex;gap:9px}.ta-row>div{flex:1}',
    '.ta-cov{display:flex;gap:8px;margin-top:4px}',
    '.ta-cov i{width:32px;height:32px;border-radius:9px;cursor:pointer;border:2px solid transparent}',
    '.ta-cov i.on{border-color:#101828;transform:scale(1.08)}',
    '.cov-osaka{background:linear-gradient(135deg,#f97316,#e5484d)}.cov-blue{background:linear-gradient(135deg,#1B4FD8,#0ea5e9)}',
    '.cov-purple{background:linear-gradient(135deg,#7c3aed,#1B4FD8)}.cov-green{background:linear-gradient(135deg,#039855,#22c55e)}.cov-pink{background:linear-gradient(135deg,#db2777,#f97316)}',
    '.ta-save{width:100%;padding:14px;border:none;border-radius:13px;background:#1B4FD8;color:#fff;font-size:15px;font-weight:800;cursor:pointer;margin-top:14px}'
  ].join('');

  var wrap, curPayload, curCover = 'osaka';

  function ensureDom() {
    if (wrap) return;
    var st = document.createElement('style'); st.textContent = CSS; document.head.appendChild(st);
    wrap = document.createElement('div'); wrap.className = 'ta-wrap';
    wrap.innerHTML = '<div class="ta" id="ta-body"></div>';
    document.body.appendChild(wrap);
    wrap.addEventListener('click', function (e) { if (e.target === wrap) close(); });
  }
  function close() { if (wrap) wrap.classList.remove('on'); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }

  function summaryLine(p) {
    var bits = [];
    if (p.budget) bits.push('예산 ₩' + p.budget.toLocaleString('ko-KR'));
    if (p.checklist && p.checklist.length) bits.push('준비물 ' + p.checklist.length + '개');
    if (p.itinerary && p.itinerary.length) bits.push('일정 ' + p.itinerary.length + '개');
    if (p.reservations && p.reservations.length) bits.push('예약 ' + p.reservations.length + '개');
    if (p.flight) bits.push('항공편');
    return bits.join(' · ') || '이 여행에 담기';
  }

  function open(payload) {
    ensureDom();
    curPayload = payload || {};
    curCover = payload.cover || 'osaka';
    var T = window.TripStore;
    var trips = T ? T.all().filter(function (t) {
      return T.daysBetween(new Date().toISOString().slice(0, 10), t.end) >= 0;
    }) : [];
    var listHtml = trips.map(function (t) {
      var m = (t.members && t.members[0] && t.members[0].color) || '#1B4FD8';
      return '<div class="ta-trip" data-id="' + t.id + '"><div class="dot cov-' + esc(t.cover) + '">' + esc(t.city.slice(0, 1)) + '</div>'
        + '<div><div class="nm">' + esc(t.city) + '</div><div class="mt">' + T.fmtMD(t.start) + '–' + T.fmtMD(t.end) + ' · ' + T.ddayText(t) + '</div></div>'
        + '<span class="go">담기 →</span></div>';
    }).join('');

    var d1 = payload.start || new Date(Date.now() + 30 * 864e5).toISOString().slice(0, 10);
    var d2 = payload.end || new Date(Date.now() + 33 * 864e5).toISOString().slice(0, 10);
    var covers = ['osaka', 'blue', 'purple', 'green', 'pink'];

    document.getElementById('ta-body').innerHTML =
      '<div class="ta-grip"></div>'
      + '<h3>' + esc(payload.label || '여행에 담기') + '</h3>'
      + '<div class="sub">' + esc(summaryLine(payload)) + '</div>'
      + (listHtml ? '<div class="ta-div">기존 여행에 담기</div>' + listHtml : '')
      + '<div class="ta-div">새 여행 만들기</div>'
      + '<label class="ta-lbl">도시</label><input class="ta-in" id="ta-city" value="' + esc(payload.city || '') + '" placeholder="예: 오사카">'
      + '<div class="ta-row"><div><label class="ta-lbl">출발일</label><input class="ta-in" id="ta-start" type="date" value="' + d1 + '"></div>'
      + '<div><label class="ta-lbl">도착일</label><input class="ta-in" id="ta-end" type="date" value="' + d2 + '"></div></div>'
      + '<label class="ta-lbl">커버 색</label><div class="ta-cov" id="ta-cov">'
      + covers.map(function (c) { return '<i class="cov-' + c + (c === curCover ? ' on' : '') + '" data-c="' + c + '"></i>'; }).join('')
      + '</div>'
      + '<button class="ta-save" id="ta-make">새 여행 만들고 담기</button>';

    // 핸들러
    Array.prototype.forEach.call(document.querySelectorAll('.ta-trip'), function (el) {
      el.addEventListener('click', function () { applyTo(el.getAttribute('data-id')); });
    });
    document.getElementById('ta-cov').addEventListener('click', function (e) {
      var i = e.target.closest('i'); if (!i) return;
      this.querySelectorAll('i').forEach(function (x) { x.classList.remove('on'); });
      i.classList.add('on'); curCover = i.getAttribute('data-c');
    });
    document.getElementById('ta-make').addEventListener('click', makeNew);
    wrap.classList.add('on');
  }

  function applyPayload(t, p) {
    if (p.budget != null && p.budget > 0) t.budget = { total: p.budget, currency: 'KRW' };
    if (p.checklist && p.checklist.length) {
      t.checklist = t.checklist || [];
      var have = {}; t.checklist.forEach(function (c) { have[c.text] = 1; });
      p.checklist.forEach(function (c) {
        if (!have[c.text]) t.checklist.push({ id: 'a' + Math.random().toString(36).slice(2, 8), group: c.group || '기타', text: c.text, when: c.when || '', done: !!c.done });
      });
    }
    if (p.itinerary && p.itinerary.length) {
      window.TripStore.ensureDays(t);
      t.days[0].items = t.days[0].items || [];
      p.itinerary.forEach(function (it) { t.days[0].items.push({ id: 'i' + Math.random().toString(36).slice(2, 8), time: it.time || '', type: it.type || 'sight', title: it.title, memo: it.memo || '' }); });
    }
    if (p.reservations && p.reservations.length) {
      t.reservations = t.reservations || [];
      p.reservations.forEach(function (r) { t.reservations.push({ id: 'r' + Math.random().toString(36).slice(2, 8), type: r.type || 'etc', title: r.title, detail: r.detail || '', status: r.status || 'planned', when: r.when || '' }); });
    }
    if (p.flight && !t.flight) { t.flight = p.flight; }
    return t;
  }

  function applyTo(id) {
    var T = window.TripStore, t = T.get(id); if (!t) return;
    applyPayload(t, curPayload); T.upsert(t);
    location.href = '/trip?id=' + id;
  }

  function makeNew() {
    var T = window.TripStore;
    var city = (document.getElementById('ta-city').value || '').trim() || (curPayload.city || '새 여행');
    var start = document.getElementById('ta-start').value, end = document.getElementById('ta-end').value;
    if (!start || !end || new Date(end) < new Date(start)) { alert('날짜를 확인해 주세요.'); return; }
    var t = T.create({ city: city, cover: curCover, start: start, end: end, budgetTotal: curPayload.budget || 0 });
    applyPayload(t, curPayload); T.upsert(t);
    location.href = '/trip?id=' + t.id;
  }

  window.TripAttach = { open: open, close: close };
})();
