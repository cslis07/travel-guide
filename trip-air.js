/* 내 여행 상세(trip.html) — 공항 가는 시간 역산·인천공항 실시간(내 편명)·가장 빠른 출국장·혼잡 예측·귀국 모드
 * trip.html 을 줄이려고 나눴다(2026-11-16). 전역 trip·T·pad·esc·reget·renderPane 등은 trip.html 본문 스크립트 것을 쓴다.
 * 공항 탭·일정 탭 첫 그리기에서 쓰므로 본문 스크립트보다 먼저, defer 없이 불러온다(서비스워커 셸에도 넣어 오프라인).
 */
/* ═══ ⑥ 공항 가는 시간 역산 — 국제선 2시간 30분 전·국내선 1시간 전 도착 + 집→공항 이동시간 ═══ */
var DOM_AP=/^(GMP|CJU|PUS|TAE|CJJ|KWJ|RSU|USN|MWX|YNY|KUV|WJU|HIN|KPO)$/i;
function hm(min){ min=((min%1440)+1440)%1440; return pad(Math.floor(min/60))+':'+pad(min%60); }
function leaveCard(extra, crowdNote){
  var f=trip.flight, m=f&&/^(\d{1,2}):(\d{2})/.exec(f.dep||''); if(!m) return '';
  var dep=(+m[1])*60+(+m[2]), domestic=DOM_AP.test(f.from||'')&&DOM_AP.test(f.to||'');
  var buf=(domestic?60:150)+(extra||0), mv=trip.airportMins||60, arrive=dep-buf, leave=arrive-mv;
  var dayNote=leave<0?' (전날)':'';
  var opts=[30,60,90,120].map(function(v){ return '<span class="seg'+(v===mv?' on':'')+'" onclick="setAirportMins('+v+')">'+(v<60?v+'분':Math.floor(v/60)+'시간'+(v%60?' '+(v%60)+'분':''))+'</span>'; }).join('');
  return '<div class="leave" id="leaveBox"><div class="lv-h">🚗 집에서 <b>'+hm(leave)+dayNote+'</b>에 나가세요</div>'
    +'<div class="lv-chain"><span>'+hm(leave)+' 출발</span>→<span>'+hm(arrive)+' 공항 도착</span>→<span>'+hm(dep)+' 비행기</span></div>'
    +(crowdNote?'<div class="lv-crowd'+(extra?' up':'')+'">'+crowdNote+'</div>':'')
    +'<div class="lv-sub">'+(domestic?'국내선 1시간':'국제선 2시간 30분')+(extra?' + 혼잡 '+extra+'분':'')+' 전 공항 도착 기준 · 집→공항</div><div class="segrow" style="margin:6px 0 0">'+opts+'</div>'
    +'<div class="lv-note" id="leaveNote">출국장이 혼잡하면 20분 더 일찍 나가세요</div></div>';
}
function setAirportMins(v){ trip.airportMins=v; T.upsert(trip); reget(); renderPane(); }

/* ═══ 공항 실시간 연결 — 편명으로 인천공항 운항정보(오늘±1일 범위)에서 상태·탑승구·카운터·터미널 ═══ */
var TERM_LBL={P01:'T1',P02:'탑승동',P03:'T2'};   // 운항정보 API 기준(P03=T2). 혼잡도 API의 P02(=T2)와 다름
function flightNo(v){ v=String(v||'').toUpperCase().replace(/\s+/g,''); return /^[A-Z0-9]{2,8}$/.test(v)?v:''; }   // '내 편명'·onclick에 들어가므로 영숫자만
function liveWindow(date){ var d=T.daysBetween(todayISO(),date); return d>=-1&&d<=1; }
function liveHint(f){
  if(!flightNo(f.no)) return '편명을 넣으면 실시간 상태·탑승구가 보여요';
  return liveWindow(f.date)?'⏳ 실시간 운항 정보 확인 중…':'실시간 상태·탑승구는 출발 하루 전부터 보여요';
}
function flightDir(f){ return /^ICN$/i.test(f.from||'')?'dep':/^ICN$/i.test(f.to||'')?'arr':''; }
function hhmm(v){ v=String(v||''); var m=/(\d{2})(\d{2})$/.exec(v); return m?m[1]+':'+m[2]:''; }
var _odp={};
function odp(dir){
  if(!_odp[dir]) _odp[dir]=fetch('/api/proxy?path='+encodeURIComponent('StatusOfPassengerFlightsOdp/getPassenger'+(dir==='dep'?'Departures':'Arrivals')+'Odp')+'&numOfRows=500')
    .then(function(r){ return r.ok?r.json():null; }).then(function(d){ return itemsOf(d); }).catch(function(){ _odp[dir]=null; return []; });
  return _odp[dir];
}
function findFlight(list,no){ return list.filter(function(x){ return String(x.flightId||'').toUpperCase()===no || String(x.masterflightid||'').toUpperCase()===no; })[0]||null; }
function liveHtml(x,dir){
  var sch=hhmm(x.scheduleDateTime), est=hhmm(x.estimatedDateTime), rmk=String(x.remark||''), bad=/결항|취소|cancel/i.test(rmk), late=est&&est!==sch&&!bad;
  var bits=[];
  bits.push('<b class="lst'+(bad?' bad':late?' late':'')+'">'+esc(rmk||'예정')+'</b>');
  bits.push('예정 '+esc(sch)+(late?' → <b>'+esc(est)+'</b>':''));
  if(x.terminalId) bits.push(esc(TERM_LBL[x.terminalId]||x.terminalId));
  if(dir==='dep'){ if(x.chkinrange) bits.push('체크인 '+esc(x.chkinrange)); if(x.gatenumber) bits.push('탑승구 <b>'+esc(x.gatenumber)+'</b>'); }
  else { if(x.carousel) bits.push('수하물 벨트 <b>'+esc(x.carousel)+'</b>'); if(x.exitnumber) bits.push('출구 '+esc(x.exitnumber)); }
  return bits.join(' · ');
}
function loadFlightLive(){
  [['flight','fltLive'],['flightBack','backLive']].forEach(function(k){
    var f=trip[k[0]], box=document.getElementById(k[1]), no=f&&flightNo(f.no), dir=f&&flightDir(f);
    if(!box||!no||!dir||!liveWindow(f.date)) return;
    odp(dir).then(function(list){
      var x=findFlight(list||[],no);
      if(!x){ box.innerHTML='오늘 인천공항 운항표에서 '+esc(no)+'편을 찾지 못했어요(편명·날짜 확인)'; return; }
      box.innerHTML=(f.date!==todayISO()?'<small class="lv-today">오늘 같은 편 기준</small> ':'')+liveHtml(x,dir);   // 운항표엔 날짜가 없어 오늘 운항분과 맞춰 봄
      var term=TERM_LBL[x.terminalId];   // 터미널을 알게 되면 저장 → 혼잡도·출국장 안내가 그 터미널 기준으로
      if(k[0]==='flight'&&term&&f.terminal!==term){ trip.flight.terminal=term; T.upsert(trip); loadAirCong(); loadCrowd(); }
      if(k[0]==='flightBack') loadEntryInfo(no);
    });
  });
}
/* 내 여행 항공편을 /airport '내 편명'(icn_fav_flights)에 자동 등록 → 거기서 지연·게이트 변경 알림 */
function syncFavs(){
  var favs; try{ favs=JSON.parse(localStorage.getItem('icn_fav_flights')||'[]'); }catch(e){ favs=[]; }
  if(!Array.isArray(favs)) favs=[];
  var n0=favs.length;
  [trip.flight,trip.flightBack].forEach(function(f){
    var no=f&&flightNo(f.no), dir=f&&flightDir(f); if(!no||!dir) return;
    if(!favs.some(function(x){ return x.flightId===no&&x.dir===dir; })) favs.push({flightId:no,dir:dir,added:Date.now(),trip:trip.id});
  });
  if(favs.length!==n0) try{ localStorage.setItem('icn_fav_flights',JSON.stringify(favs)); }catch(e){}
}

/* ═══ 지금 가장 빠른 출국장 — 운영시간 밖(닫힌) 출국장은 빼고 대기시간 → 대기인원 순 ═══ */
function gateOpen(g){
  var m=/(\d{1,2}):(\d{2})\s*~\s*(\d{1,2}):(\d{2})/.exec(g.operatingTime||''); if(!m) return true;
  var d=new Date(), now=d.getHours()*60+d.getMinutes(), a=(+m[1])*60+(+m[2]), b=(+m[3])*60+(+m[4]);
  return a<=b ? (now>=a&&now<=b) : (now>=a||now<=b);
}
function gateName(g){ var m=/DG(\d+)_([EW])/.exec(g.gateId||''); return m?m[1]+'번 출국장 '+(m[2]==='E'?'동편':'서편'):(g.gateId||'출국장'); }
function bestGates(list){
  var open=list.filter(function(g){ return /DG\d+_[EW]/.test(g.gateId||'')&&gateOpen(g); });
  var by=function(a,b){ return (+a.waitTime||0)-(+b.waitTime||0) || (+a.waitLength||0)-(+b.waitLength||0); };
  open.sort(by);
  return { best:open[0]||null, worst:open[open.length-1]||null, n:open.length };
}
function renderBestGate(list,termLbl){
  var box=document.getElementById('bestGate'); if(!box) return;
  var r=bestGates(list); if(!r.best){ box.innerHTML=''; return; }
  var bw=+r.best.waitTime||0, ww=r.worst?(+r.worst.waitTime||0):bw;
  box.innerHTML='<div class="bestgate"><span class="bg-ic">🚶</span><div><b>'+esc(termLbl)+' 지금은 '+esc(gateName(r.best))+'이 가장 빨라요</b>'
    +'<small>대기 약 '+bw+'분 · '+(+r.best.waitLength||0)+'명'+(r.worst&&ww>bw?' — 가장 붐비는 '+esc(gateName(r.worst))+'은 약 '+ww+'분':'')+' · 운영 중 '+r.n+'곳 기준</small></div></div>';
}

/* ═══ 내 비행기 시간대 혼잡 예측 — 인천공항 시간대별 예상 출국 승객(오늘·내일)으로 도착 시각 앞당기기 ═══ */
function loadCrowd(){
  var f=trip.flight, m=f&&/^(\d{1,2}):(\d{2})/.exec(f.dep||''), box=document.getElementById('leaveBox');
  if(!box||!m||flightDir(f)!=='dep') return;
  var dd=T.daysBetween(todayISO(),f.date); if(dd<0||dd>1) return;   // 예보는 오늘·내일만 제공
  fetch('/api/proxy?path='+encodeURIComponent('passgrAnncmt/getPassgrAnncmt')+'&selectdate='+dd+'&numOfRows=30')
    .then(function(r){ return r.ok?r.json():null; }).then(function(d){
      var t2=/2/.test(f.terminal||''), rows=itemsOf(d).filter(function(x){ return /^\d{2}_\d{2}$/.test(x.atime||''); });
      if(!rows.length) return;
      var val=function(x){ return parseFloat(t2?x.t2dgsum2:x.t1dgsum1)||0; };
      var peak=Math.max.apply(null,rows.map(val)); if(!peak) return;
      var dep=(+m[1])*60+(+m[2]), h=Math.floor(Math.max(0,dep-150)/60);   // 보안검색을 지날 시간대(도착 직후 1시간)
      var at=rows.filter(function(x){ return +x.atime.slice(0,2)===h; })[0]; if(!at) return;
      var ratio=val(at)/peak, extra=ratio>=0.8?30:ratio>=0.6?15:0;
      var note=(t2?'T2':'T1')+' '+at.atime.replace('_',':00~')+':00 예상 출국 '+Math.round(val(at)).toLocaleString('ko-KR')+'명 — '
        +(extra?'붐비는 시간대라 <b>'+extra+'분 더 일찍</b> 잡았어요':'붐비지 않는 시간대예요');
      var nb=document.getElementById('leaveBox'); if(nb) nb.outerHTML=leaveCard(extra,note);
    }).catch(function(){});
}

/* ═══ 귀국 모드 — 돌아오는 편 도착 정보(수하물 벨트·출구·입국장)와 집 가는 길 ═══ */
function backCard(home){
  var b=trip.flightBack; if(!b) return '';
  return '<div class="backcard'+(home?' home':'')+'">'
    +(home?'<div class="bc-badge">🏠 귀국 모드</div>':'')
    +'<div class="bc-top"><b>🛬 '+esc(b.no||'귀국편')+'</b><span>'+T.fmtMD(b.date)+' '+T.dow(b.date)+'</span></div>'
    +'<div class="bc-route">'+esc(b.from||'')+' → '+esc(b.to||'ICN')+(b.arr?' · '+esc(b.arr)+' 도착 예정':'')+'</div>'
    +'<div class="bc-live" id="backLive">'+liveHint(b)+'</div>'
    +'<div id="entryInfo"></div>'
    +dutyLine()
    +'<div class="bc-links"><a href="/airport#tab=transport">🚆 집 가는 공항철도·버스</a><a href="/airport#tab=parking">🅿 주차 요금·자리</a></div></div>';
}
function loadEntryInfo(no){
  var box=document.getElementById('entryInfo'); if(!box) return;
  fetch('/api/proxy?path='+encodeURIComponent('StatusOfArrivals/getArrivalsCongestion')+'&numOfRows=300')
    .then(function(r){ return r.ok?r.json():null; }).then(function(d){
      var x=itemsOf(d).filter(function(i){ return String(i.flightid||'').toUpperCase()===no; })[0]; if(!x) return;
      box.innerHTML='<div class="bc-entry">🛂 '+esc(x.terno||'')+' 입국장 <b>'+esc(x.entrygate||'-')+'</b> · 같은 편 입국 예상 내국인 '+Math.round(+x.korean||0)+'명 · 외국인 '+Math.round(+x.foreigner||0)+'명</div>';
    }).catch(function(){});
}
