/* 챙길 물건 체크리스트 — 출국 준비(/prepare) 한 곳에서 관리 (2026-10-23, /airport에서 이동)
   - 다가오는(또는 여행 중인) 여행이 있으면: 그 여행 '준비물'(TripStore)을 그대로 보여 주고 체크도 그 여행에 저장
     (출국 준비 타임라인이 넣은 항목 src:'prep'은 타임라인에 이미 보이므로 여기선 뺌)
   - 여행이 없으면: 기본 34항목 + 나만의 준비물 — 예전 /airport 체크리스트와 같은 저장 키(icn_checklist·icn_checklist_custom)라 체크 상태가 이어짐
   사용: PackList.mount(요소, function(done,total){…}) */
(function () {
  'use strict';
  var GROUPS = [
    { title: '📄 필수 서류', items: ['여권 (유효기간 6개월 이상)', '항공권 / 모바일 탑승권', '호텔·숙소 예약 확인서', '여행자 보험', '국제운전면허증 (필요시)', '비자 (필요한 국가)', '여권 사본 (분실 대비)'] },
    { title: '💳 결제·통화', items: ['신용카드 (해외 결제 가능)', '현지 통화 환전', '비상금 USD', '해외 결제 차단 해제 확인'] },
    { title: '📱 전자기기', items: ['휴대폰 + 충전기', '보조배터리 (100Wh 이하)', '멀티어댑터 / 변환플러그', '이어폰', '카메라 + 메모리카드', '노트북 (필요시)', '유심 / eSIM / 포켓와이파이'] },
    { title: '👕 의류·세면', items: ['속옷 / 양말 (일수만큼)', '잠옷 / 편한옷', '운동화 / 슬리퍼', '겉옷 / 우산', '칫솔·치약·세면도구 (100ml 이하)', '수건'] },
    { title: '💊 위생·약품', items: ['상비약 (감기약·진통제·소화제·지사제)', '처방약 + 처방전 영문', '마스크', '손소독제 (100ml 이하)', '밴드·연고'] },
    { title: '🎒 기타', items: ['여행용 캐리어 (위탁용)', '기내용 가방', '지퍼백 (액체류 정리)', '간식 / 컵라면', '여행 일정표 / 가이드북'] }
  ];
  var K_STATE = 'icn_checklist', K_CUSTOM = 'icn_checklist_custom';
  var host = null, onProg = null;

  function esc(v) { return String(v == null ? '' : v).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function load(k, d) { try { var v = JSON.parse(localStorage.getItem(k) || 'null'); return v == null ? d : v; } catch (e) { return d; } }
  function save(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
  function uid() { return 'a' + Math.random().toString(36).slice(2, 9); }
  function todayISO() { var d = new Date(), p = function (n) { return (n < 10 ? '0' : '') + n; }; return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()); }
  function nearTrip() {
    var T = window.TripStore; if (!T) return null;
    var t = todayISO();
    return T.all().filter(function (x) { return x.end >= t; }).sort(function (a, b) { return a.start < b.start ? -1 : 1; })[0] || null;
  }
  function item(id, text, done, extra) {
    return '<div class="pk-item' + (done ? ' done' : '') + '" role="checkbox" aria-checked="' + (done ? 'true' : 'false') + '" tabindex="0" data-id="' + esc(id) + '">'
      + '<span class="pk-box">' + (done ? '✓' : '') + '</span><span class="pk-t">' + esc(text) + (extra || '') + '</span></div>';
  }
  function addRow(ph) {
    return '<div class="pk-add"><input class="pk-in" id="pkNew" placeholder="' + esc(ph) + '" aria-label="준비물 추가"><button type="button" class="pk-addbtn" data-act="add">추가</button></div>';
  }

  function render() {
    if (!host) return;
    var tr = nearTrip(), html = '', done = 0, total = 0;
    if (tr) {
      var T = window.TripStore, cl = (tr.checklist || []).filter(function (c) { return c.src !== 'prep'; });
      var groups = {}, order = [];
      cl.forEach(function (c) { var g = c.group || '기타'; if (!groups[g]) { groups[g] = []; order.push(g); } groups[g].push(c); });
      html += '<div class="pk-trip">🧳 <b>' + esc(tr.city) + ' 여행(' + esc(T.ddayText(tr)) + ') 준비물</b>과 같은 목록이에요 — 체크하면 내 여행에도 반영돼요. <a href="/trip?id=' + encodeURIComponent(tr.id) + '&tab=pack">내 여행에서 열기 ›</a></div>';
      order.forEach(function (g) {
        html += '<div class="pk-g"><div class="pk-gt">' + esc(g) + '</div>' + groups[g].map(function (c) { total++; if (c.done) done++; return item('t:' + c.id, c.text, c.done, c.when ? ' <small>' + esc(c.when) + '</small>' : ''); }).join('') + '</div>';
      });
      if (!cl.length) html += '<div class="pk-empty">아직 챙길 물건이 없어요.</div>';
      var missing = 0; GROUPS.forEach(function (g) { g.items.forEach(function (it) { if (!(tr.checklist || []).some(function (c) { return c.text === it; })) missing++; }); });
      if (missing) html += '<button type="button" class="pk-import" data-act="import">✚ 기본 준비물 목록에서 없는 ' + missing + '개 추가</button>';
      html += addRow('예: 멀미약, 아이 여권 — 이 여행 준비물에 추가');
    } else {
      var st = load(K_STATE, {}), custom = load(K_CUSTOM, []);
      GROUPS.forEach(function (g, gi) {
        html += '<div class="pk-g"><div class="pk-gt">' + esc(g.title) + '</div>' + g.items.map(function (it, ii) { var k = 'd' + gi + '_' + ii; total++; if (st[k]) done++; return item('d:' + k, it, !!st[k]); }).join('') + '</div>';
      });
      html += '<div class="pk-g"><div class="pk-gt">➕ 나만의 준비물</div>' + custom.map(function (c) { total++; if (st[c.id]) done++; return item('d:' + c.id, c.text, !!st[c.id], ' <button type="button" class="pk-del" data-act="del" data-cid="' + esc(c.id) + '" aria-label="삭제">✕</button>'); }).join('') + addRow('예: 멀미약, 아이 여권, 우산…') + '</div>';
      html += '<div class="pk-note">여행을 만들면 이 목록이 그 여행의 준비물과 하나로 이어져요. <a href="/trips">내 여행 만들기 ›</a> · <button type="button" class="pk-link" data-act="reset">체크 초기화</button></div>';
    }
    host.innerHTML = html;
    if (onProg) onProg(done, total);
  }

  function toggle(id) {
    var tr = nearTrip();
    if (id.indexOf('t:') === 0 && tr) { window.TripStore.toggleChecklist(tr.id, id.slice(2)); }
    else if (id.indexOf('d:') === 0) { var st = load(K_STATE, {}), k = id.slice(2); st[k] = !st[k]; save(K_STATE, st); }
    render();
  }
  function act(a, el) {
    var tr = nearTrip(), T = window.TripStore;
    if (a === 'import' && tr) {
      var t = T.get(tr.id), st = load(K_STATE, {});
      t.checklist = t.checklist || [];
      GROUPS.forEach(function (g, gi) { g.items.forEach(function (it, ii) {
        if (!t.checklist.some(function (c) { return c.text === it; })) t.checklist.push({ id: uid(), group: g.title.replace(/^\S+\s/, ''), text: it, when: '', done: !!st['d' + gi + '_' + ii] });
      }); });
      load(K_CUSTOM, []).forEach(function (c) { if (!t.checklist.some(function (x) { return x.text === c.text; })) t.checklist.push({ id: uid(), group: '나만의 준비물', text: c.text, when: '', done: !!st[c.id] }); });
      T.upsert(t);
    } else if (a === 'add') {
      var inp = document.getElementById('pkNew'), txt = (inp && inp.value || '').trim().slice(0, 80);
      if (!txt) { if (inp) inp.focus(); return; }
      if (tr) { var t2 = T.get(tr.id); t2.checklist = t2.checklist || []; t2.checklist.push({ id: uid(), group: '나만의 준비물', text: txt, when: '', done: false }); T.upsert(t2); }
      else { var cu = load(K_CUSTOM, []); cu.push({ id: 'c' + Date.now() + Math.floor(Math.random() * 1000), text: txt }); save(K_CUSTOM, cu); }
    } else if (a === 'del') {
      var cid = el.getAttribute('data-cid');
      save(K_CUSTOM, load(K_CUSTOM, []).filter(function (x) { return x.id !== cid; }));
      var s2 = load(K_STATE, {}); delete s2[cid]; save(K_STATE, s2);
    } else if (a === 'reset') {
      if (!confirm('체크 상태를 모두 초기화할까요? (추가한 항목은 유지됩니다)')) return;
      save(K_STATE, {});
    }
    render();
  }

  function mount(el, progress) {
    host = el; onProg = progress || null;
    el.addEventListener('click', function (e) {
      var b = e.target.closest('[data-act]'); if (b) { e.stopPropagation(); act(b.getAttribute('data-act'), b); return; }
      var it = e.target.closest('.pk-item'); if (it) toggle(it.getAttribute('data-id'));
    });
    el.addEventListener('keydown', function (e) {
      if (e.target.id === 'pkNew' && e.key === 'Enter') { act('add'); return; }
      var it = e.target.closest && e.target.closest('.pk-item');
      if (it && (e.key === ' ' || e.key === 'Enter')) { e.preventDefault(); toggle(it.getAttribute('data-id')); }
    });
    render();
  }

  window.PackList = { GROUPS: GROUPS, nearTrip: nearTrip, mount: mount, render: render };
})();
