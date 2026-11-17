/* ═══════════════════════════════════════════════════════════
   트래블코스트 — 내 여행 일정 길게 눌러 끌어 옮기기  (trip.html 전용)

   - 일정 카드를 0.35초 누르고 있으면 들려서 위아래로 끌 수 있다 → 놓은 자리로 순서 변경
   - 끌어서 위쪽 날짜 칩(1일차·2일차…)에 놓으면 그 날로 옮긴다(시간이 있으면 그 날 시간 순 자리)
   - 누르는 중에 손가락이 먼저 움직이면 화면 스크롤로 보고 끌기를 시작하지 않는다
   - 버튼·링크(▲▼·✎·지도·길찾기)를 누른 건 끌기가 아니다. ▲▼ 버튼은 그대로 둔다(키보드·보조기기)
   trip.html 의 전역 T·tid·trip·curDay·reget·renderShell·toast 를 쓴다(인라인 스크립트가 먼저 정의).
   ═══════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  var HOLD_MS = 350, SLOP = 8, EDGE = 72;
  var press = null;   // { x, y, el, timer, pid }
  var drag = null;    // { el, id, day, startY, line, overChip, overIdx, raf, lastX, lastY }

  function items() { return Array.prototype.slice.call(document.querySelectorAll('#pane .tl-item[data-id]')); }
  function chips() { return Array.prototype.slice.call(document.querySelectorAll('#pane .daychip')); }

  function cancelPress() {
    if (press) { clearTimeout(press.timer); press = null; }
  }

  document.addEventListener('pointerdown', function (e) {
    if (drag || (e.pointerType === 'mouse' && e.button !== 0)) return;
    var el = e.target.closest && e.target.closest('#pane .tl-item[data-id]');
    if (!el || e.target.closest('button,a,input,select,textarea')) return;
    if (items().length < 2 && chips().length < 2) return;   // 옮길 곳이 없음
    cancelPress();
    press = { x: e.clientX, y: e.clientY, el: el, pid: e.pointerId };
    el.classList.add('tl-press');
    press.timer = setTimeout(function () { if (press) startDrag(press, press.x, press.y); }, HOLD_MS);
  });

  document.addEventListener('pointermove', function (e) {
    if (press && e.pointerId === press.pid) {
      if (Math.abs(e.clientX - press.x) > SLOP || Math.abs(e.clientY - press.y) > SLOP) {
        press.el.classList.remove('tl-press'); cancelPress();   // 스크롤하려는 손짓
      }
      return;
    }
    if (drag && e.pointerId === drag.pid) { e.preventDefault(); moveDrag(e.clientX, e.clientY); }
  }, { passive: false });

  // 끄는 동안에는 화면이 같이 스크롤되지 않게(첫 touchmove 를 막아야 브라우저가 끌기를 빼앗지 않는다)
  document.addEventListener('touchmove', function (e) { if (drag) e.preventDefault(); }, { passive: false });
  // 길게 누를 때 뜨는 메뉴(복사·공유)·글자 선택 막기
  document.addEventListener('contextmenu', function (e) { if (press || drag) e.preventDefault(); });

  function endPointer(e) {
    if (press && e.pointerId === press.pid) { press.el.classList.remove('tl-press'); cancelPress(); }
    if (drag && e.pointerId === drag.pid) finishDrag(e.type !== 'pointercancel');
  }
  document.addEventListener('pointerup', endPointer);
  document.addEventListener('pointercancel', endPointer);
  document.addEventListener('keydown', function (e) { if (drag && e.key === 'Escape') finishDrag(false); });

  function startDrag(p, x, y) {
    var el = p.el, id = el.getAttribute('data-id');
    cancelPress();
    if (!document.body.contains(el)) return;
    el.classList.remove('tl-press');
    var line = document.createElement('div'); line.className = 'tl-drop';
    drag = { el: el, id: id, day: +el.getAttribute('data-day'), pid: p.pid, startY: y, line: line,
             overChip: -1, overIdx: -1, lastX: x, lastY: y, raf: 0 };
    el.classList.add('tl-dragging');
    document.body.classList.add('tl-dragmode');
    try { if (navigator.vibrate) navigator.vibrate(15); } catch (er) {}
    var seen = '1';
    try { seen = localStorage.getItem('tc_drag_tip'); localStorage.setItem('tc_drag_tip', '1'); } catch (er) {}
    if (!seen && typeof toast === 'function') toast('위아래로 끌어 순서를, 위 날짜 칩에 놓아 날짜를 바꿔요');
    moveDrag(x, y);
    autoScroll();
  }

  function moveDrag(x, y) {
    if (!drag) return;
    drag.lastX = x; drag.lastY = y;
    drag.el.style.transform = 'translateY(' + (y - drag.startY) + 'px)';
    // 1) 날짜 칩 위인가
    var over = -1;
    chips().forEach(function (c, i) {
      var r = c.getBoundingClientRect();
      var on = x >= r.left && x <= r.right && y >= r.top - 6 && y <= r.bottom + 6 && i !== drag.day;
      c.classList.toggle('tl-chipover', on);
      if (on) over = i;
    });
    drag.overChip = over;
    // 2) 같은 날 어느 자리인가(끄는 카드 자신은 빼고, 각 카드의 가운데 높이와 비교)
    var list = items().filter(function (n) { return n !== drag.el; });
    var idx = list.length;
    for (var i = 0; i < list.length; i++) {
      var r = list[i].getBoundingClientRect();
      if (y < r.top + r.height / 2) { idx = i; break; }
    }
    drag.overIdx = over > -1 ? -1 : idx;
    if (over > -1) { if (drag.line.parentNode) drag.line.parentNode.removeChild(drag.line); return; }
    var ref = list[idx] || null;
    var parent = drag.el.parentNode;
    if (ref) parent.insertBefore(drag.line, ref);
    else if (list.length) parent.insertBefore(drag.line, list[list.length - 1].nextSibling);
  }

  // 화면 위·아래 가장자리에 손가락이 오면 천천히 스크롤(날짜 칩이 위로 사라졌을 때도 닿게)
  // 날짜 칩 줄의 좌우 끝이면 칩 줄을 가로로 스크롤
  function autoScroll() {
    if (!drag) return;
    var y = drag.lastY, x = drag.lastX, h = window.innerHeight, dy = 0;
    if (y < EDGE) dy = -Math.ceil((EDGE - y) / 6);
    else if (y > h - EDGE) dy = Math.ceil((y - (h - EDGE)) / 6);
    if (dy) {
      var before = window.scrollY;
      window.scrollBy(0, dy);
      var moved = window.scrollY - before;
      if (moved) { drag.startY -= moved; moveDrag(x, y); }
    }
    var row = document.querySelector('#pane .daychips');
    if (row) {
      var r = row.getBoundingClientRect();
      if (y >= r.top && y <= r.bottom) {
        if (x < r.left + 36) row.scrollLeft -= 8;
        else if (x > r.right - 36) row.scrollLeft += 8;
      }
    }
    drag.raf = requestAnimationFrame(autoScroll);
  }

  function finishDrag(apply) {
    var d = drag; drag = null;
    if (!d) return;
    cancelAnimationFrame(d.raf);
    document.body.classList.remove('tl-dragmode');
    chips().forEach(function (c) { c.classList.remove('tl-chipover'); });
    if (d.line.parentNode) d.line.parentNode.removeChild(d.line);
    d.el.classList.remove('tl-dragging'); d.el.style.transform = '';
    if (!apply || !window.T || !T.moveDayItemTo) return;
    if (d.overChip > -1) {
      T.moveDayItemTo(tid, d.day, d.id, d.overChip);
      reget(); curDay = d.overChip; renderShell();
      if (typeof toast === 'function') toast((d.overChip + 1) + '일차로 옮겼어요');
      return;
    }
    if (d.overIdx < 0) return;
    var before = items().map(function (n) { return n.getAttribute('data-id'); });
    var from = before.indexOf(d.id);
    if (from < 0 || d.overIdx === from) return;   // 제자리
    T.moveDayItemTo(tid, d.day, d.id, d.day, d.overIdx);
    reget(); renderShell();
  }
})();
