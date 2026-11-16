/* 내 여행 상세(trip.html) — 비상·분실 연락처·현지 정보, 항공사 온라인 체크인 카드, 여행 일기
 * trip.html 을 줄이려고 나눴다(2026-11-16). 전역 trip·T·esc·rcGet·rcPut·shrinkImage·flightNo 등은 trip.html·trip-air.js 것을 쓴다.
 * 일정·공항 탭 첫 그리기(checkinCard·journalCard)에 쓰여 본문 스크립트보다 먼저, defer 없이(서비스워커 셸에도).
 */
/* ═══ 🆘 비상·분실 연락처 / 🔌 현지 정보 (local-info.js, 2026-10-23 공식 확인) ═══ */
function tel(n){ return '<a class="tel" href="tel:'+esc(String(n).replace(/[^\d+]/g,''))+'">'+esc(n)+'</a>'; }
function cityMission(li){ var c=String(trip.city||''); for(var k in li.mission) if(c.indexOf(k)>-1) return li.mission[k]; var ks=Object.keys(li.mission); return ks.length?li.mission[ks[0]]:null; }
function openSOS(){
  var li=LOCAL_INFO[ccOf()], M=LOCAL_INFO_META; if(!li) return;
  var ms=cityMission(li);
  openSheet('<h3>🆘 비상·분실 연락처</h3>'
    +'<div class="sos-call"><b>영사안전콜센터 (24시간)</b>'+tel(M.call)+'<small>사건·사고·분실 무엇이든 · 국제전화 요금 — 무료전화 앱·카카오톡 상담도 있어요</small></div>'
    +'<div class="sech">현지 긴급번호</div>'+li.sos.map(function(x){ return '<div class="sos-r"><span>'+esc(x[0])+'</span>'+tel(x[1])+'</div>'; }).join('')
    +(li.sosNote?'<p class="ps-p">⚠️ '+esc(li.sosNote)+'</p>':'')
    +(ms?'<div class="sech">'+esc(ms[0])+'</div><div class="sos-r"><span>대표</span>'+tel(ms[1])+'</div>'+(ms[2]?'<div class="sos-r"><span>근무시간 외 긴급</span>'+tel(ms[2])+'</div>':'<p class="ps-p">근무시간 외에는 영사안전콜센터로 연결돼요</p>'):'')
    +'<div class="sech">여권을 잃어버렸다면</div><ol class="sos-ol">'+M.passport.map(function(x){ return '<li>'+esc(x)+'</li>'; }).join('')+'</ol>'
    +'<p class="ps-p">카드 분실은 카드 앱·카드 뒷면 번호로 바로 정지하세요 · 출처: 외교부 해외안전여행·각 공관 홈페이지 ('+esc(M.checked)+' 확인)</p>');
}
function openLocalInfo(){
  var li=LOCAL_INFO[ccOf()]; if(!li) return;
  openSheet('<h3>🔌 '+esc(trip.city)+' 현지 정보</h3>'
    +'<div class="li-r"><b>🔌 콘센트</b><span>'+esc(li.plug)+' · '+esc(li.volt)+'<br><em class="'+(li.adapter?'need':'ok')+'">'+(li.adapter?'멀티어댑터가 필요해요':'한국 플러그가 꽂히는 곳이 많지만 어댑터를 챙기면 안전해요')+'</em></span></div>'
    +'<div class="li-r"><b>💁 팁</b><span>'+esc(li.tip)+'</span></div>'
    +'<div class="li-r"><b>🚰 수돗물</b><span>'+esc(li.water)+'</span></div>'
    +'<p class="ps-p">콘센트: IEC World Plugs 기준(현지 콘센트는 섞여 있을 수 있어요) · 팁·수돗물은 일반적인 안내예요</p>'
    +(li.adapter&&!(trip.checklist||[]).some(function(c){ return /어댑터/.test(c.text); })?'<button class="save" onclick="T.addChecklistItem(tid,{group:\'전자기기\',text:\'멀티어댑터 ('+esc(li.plug.split(' ')[0])+')\',when:\'D-7\',done:false});reget();closeSheet();toast(\'준비물에 담았어요\')">+ 멀티어댑터 준비물에 담기</button>':''));
}

/* ═══ 🛫 항공사 온라인 체크인 — 편명 앞 두 글자로 항공사, 열리는 시각(출발 시각 기준) + 캘린더 알림 ═══ */
function ckInfo(f){ var no=f&&flightNo(f.no); if(!no) return null; var m=/^([A-Z0-9]{2})/.exec(no), c=window.LOCAL_INFO_META&&LOCAL_INFO_META.checkin[m[1]]; return c?{code:m[1],name:c[0],h:c[1],url:c[2],note:c[3]}:null; }
function ckOpenAt(f,h){ var m=/^(\d{1,2}):(\d{2})/.exec(f.dep||''); if(!m||!h) return null; var d=new Date(f.date+'T'+pad(+m[1])+':'+m[2]+':00'); d.setHours(d.getHours()-h); return d; }
function checkinCard(){
  var f=trip.flight, c=ckInfo(f); if(!c) return '';
  var at=ckOpenAt(f,c.h), when=c.h?(at?(at.getMonth()+1)+'/'+at.getDate()+' '+pad(at.getHours())+':'+pad(at.getMinutes())+'부터 열려요 (출발 '+(c.h>=48&&c.h%24===0?(c.h/24)+'일':c.h+'시간')+' 전)':'출발 '+c.h+'시간 전부터 열려요'):'';
  return '<div class="ckin"><div class="ck-h">🛫 '+esc(c.name)+' 온라인 체크인</div>'
    +'<div class="ck-w">'+(when?'<b>'+esc(when)+'</b>':'')+(c.note?'<small>'+esc(c.note)+'</small>':'')+'</div>'
    +'<div class="ck-a"><a href="'+esc(c.url)+'" target="_blank" rel="noopener">체크인 페이지 ↗</a>'+(at&&at>new Date()?'<button onclick="ckIcs()">📅 열릴 때 알림</button>':'')+'</div>'
    +'<small class="ck-src">항공사 안내 기준 · 노선·공항에 따라 다르거나 바뀔 수 있어요</small></div>';
}
function ckIcs(){
  var f=trip.flight, c=ckInfo(f), at=c&&ckOpenAt(f,c.h); if(!at) return;
  var z=function(d){ return d.getUTCFullYear()+pad(d.getUTCMonth()+1)+pad(d.getUTCDate())+'T'+pad(d.getUTCHours())+pad(d.getUTCMinutes())+'00Z'; }, e=new Date(at.getTime()+30*6e4);
  var L=['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//트래블코스트//Trip//KR','BEGIN:VEVENT','UID:tc-ck-'+trip.id+'@travelcost.co.kr','DTSTAMP:'+z(new Date()),'DTSTART:'+z(at),'DTEND:'+z(e),
    'SUMMARY:'+icsEsc('🛫 '+f.no+' 온라인 체크인 열림'),'DESCRIPTION:'+icsEsc(c.name+' 체크인 '+c.url),'BEGIN:VALARM','ACTION:DISPLAY','DESCRIPTION:'+icsEsc(f.no+' 체크인'),'TRIGGER:PT0M','END:VALARM','END:VEVENT','END:VCALENDAR'];
  var a=document.createElement('a'); a.href=URL.createObjectURL(new Blob([L.join('\r\n')],{type:'text/calendar;charset=utf-8'})); a.download=f.no+'-체크인.ics'; document.body.appendChild(a); a.click(); setTimeout(function(){ URL.revokeObjectURL(a.href); a.remove(); },60000);
}

/* ═══ 📔 여행 일기 — 일차마다 한 줄 + 사진 1장(사진은 영수증처럼 이 폰 IndexedDB, 키 j:여행id:날짜) ═══ */
function jKey(d){ return 'j:'+trip.id+':'+d; }
function journalCard(){
  var day=(trip.days||[])[curDay]; if(!day) return '';
  var has=day.note||day.jPhoto;
  return '<div class="jr"><div class="jr-h">📔 '+(curDay+1)+'일차 기록<button onclick="openJournal()">'+(has?'고치기':'쓰기')+'</button></div>'
    +(has?(day.jPhoto?'<img class="jr-ph" data-j="'+esc(jKey(day.date))+'" alt="'+(curDay+1)+'일차 사진">':'')+(day.note?'<p>'+esc(day.note)+'</p>':''):'<p class="jr-empty">오늘 기억하고 싶은 한 줄과 사진 한 장을 남겨 보세요</p>')+'</div>';
}
function fillJournal(){ [].forEach.call(document.querySelectorAll('img[data-j]'),function(im){ rcGet(im.getAttribute('data-j'),function(d){ if(d) im.src=d; else im.remove(); }); }); }
var jState=null;
function openJournal(){
  var day=(trip.days||[])[curDay]; if(!day) return; jState={data:null,remove:false};
  openSheet('<h3>📔 '+(curDay+1)+'일차 기록 · '+T.fmtMD(day.date)+'</h3>'
    +'<textarea class="in" id="jrText" rows="4" maxlength="500" placeholder="예: 도톤보리 야경이 생각보다 훨씬 예뻤다">'+esc(day.note||'')+'</textarea>'
    +'<div class="rc-row" style="margin-top:10px"><img id="jr-prev" class="rc-prev" alt="사진" hidden><label class="rc-pick">📷 '+(day.jPhoto?'다른 사진':'사진 추가')+'<input type="file" accept="image/*" hidden onchange="pickJournal(this)"></label>'
    +'<button type="button" class="rc-del" id="jr-del" hidden onclick="dropJournal()">사진 빼기</button></div>'
    +'<button class="save" onclick="saveJournal()">저장</button>');
  if(day.jPhoto) rcGet(jKey(day.date),function(d){ if(d){ var im=document.getElementById('jr-prev'); im.src=d; im.hidden=false; document.getElementById('jr-del').hidden=false; } });
}
function pickJournal(inp){ var f=inp.files&&inp.files[0]; if(!f) return; shrinkImage(f,function(d){ if(!d) return; jState={data:d,remove:false}; var im=document.getElementById('jr-prev'); im.src=d; im.hidden=false; document.getElementById('jr-del').hidden=false; }); }
function dropJournal(){ jState={data:null,remove:true}; document.getElementById('jr-prev').hidden=true; document.getElementById('jr-del').hidden=true; }
function saveJournal(){
  var di=curDay, t=T.get(tid), d=t.days[di]; if(!d) return;   // 사진 저장은 비동기 — 그사이 다른 날로 넘겨도 이 날을 고치도록 di 고정
  d.note=(document.getElementById('jrText').value||'').trim().slice(0,500);
  var key=jKey(d.date);
  if(jState.data){ d.jPhoto=true; rcPut(key,jState.data,function(ok){ if(!ok){ var t2=T.get(tid); if(t2&&t2.days[di]){ t2.days[di].jPhoto=false; T.upsert(t2); } toast('사진을 저장하지 못했어요'); } reget(); renderShell(); }); }
  else if(jState.remove){ d.jPhoto=false; rcDel(key); }
  T.upsert(t); reget(); closeSheet(); renderShell();
}
function journalList(){
  var ds=(trip.days||[]).map(function(d,i){ return {d:d,i:i}; }).filter(function(x){ return x.d.note||x.d.jPhoto; });
  if(!ds.length) return '';
  return '<div class="sech" style="margin-top:14px">📔 여행 기록</div>'+ds.map(function(x){
    return '<div class="jr-l">'+(x.d.jPhoto?'<img data-j="'+esc(jKey(x.d.date))+'" alt="">':'')+'<div><b>'+(x.i+1)+'일차 · '+T.fmtMD(x.d.date)+'</b><p>'+esc(x.d.note||'')+'</p></div></div>'; }).join('');
}
