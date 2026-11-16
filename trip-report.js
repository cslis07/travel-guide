/* 내 여행 상세(trip.html) — 여행 결산 리포트·견적 대비·공유 이미지 카드·날짜별 막대·여행 계획 한 장(출력)
 * trip.html 이 198KB 까지 커져 나눴다(2026-11-16). 전역 trip·T·won·esc·openSheet 등은 trip.html 본문 스크립트 것을 쓴다.
 * 첫 그리기에서 reportBtn() 을 부르므로 본문 스크립트보다 먼저, defer 없이 불러온다. */
/* ═══ ① 여행 결산 리포트 + 공유용 이미지 카드(1080×1350 PNG) ═══ */
function reportBtn(){
  if(!(trip.expenses||[]).length) return '';
  var ended=T.daysBetween(todayISO(),trip.end)<0;
  return '<button class="report-btn'+(ended?' hot':'')+'" onclick="openReport()">📊 '+(ended?'여행 결산 보기':'지금까지 결산 보기')+' <small>총 '+won(T.spent(trip))+' · 이미지 카드</small></button>';
}
function reportData(){
  var ex=trip.expenses||[], total=T.spent(trip), days=T.tripLength(trip), ppl=Math.max(1,(trip.members||[]).length);
  var big=ex.slice().sort(function(a,b){return (b.krw||0)-(a.krw||0);})[0];
  var byDay=T.dayTotals(trip);   // 여러 날 몫(숙박 등)은 그날들에 나눠서
  var top=Object.keys(byDay).sort(function(a,b){return byDay[b]-byDay[a];})[0];
  return { total:total, days:days, ppl:ppl, perDay:Math.round(total/days), perPerson:Math.round(total/ppl), count:ex.length,
    cats:T.byCategory(trip), big:big, topDay:top?{d:top,amt:byDay[top]}:null, budget:T.budgetTotal(trip), setl:T.settlements(trip),
    pv:T.planVsActual?T.planVsActual(trip):null };
}
/* 견적 대비 실제 — 경비 계산기에서 담은 여행만(budget.plan). 더 쓴 건 빨강, 덜 쓴 건 초록 */
function planVsHtml(){
  var v=T.planVsActual&&T.planVsActual(trip); if(!v) return '';
  var sg=function(d){ return d>0?'<em class="pv-up">+'+won(d)+'</em>':d<0?'<em class="pv-dn">−'+won(-d)+'</em>':'<em>같음</em>'; };
  var md=v.at&&/^\d{4}-\d{2}-\d{2}$/.test(v.at)?T.fmtMD(v.at)+' ':'';
  return '<div class="sech" style="margin-top:14px">견적 대비 실제</div>'
    +'<div class="pv"><div class="pv-r pv-h"><span>항목</span><span>견적</span><span>실제</span><span>차이</span></div>'
    +v.rows.map(function(r){ return '<div class="pv-r"><span>'+esc(r.label)+'</span><span>'+won(r.plan)+'</span><span>'+won(r.actual)+'</span><span>'+sg(r.diff)+'</span></div>'; }).join('')
    +'<div class="pv-r pv-t"><span>합계</span><span>'+won(v.plan)+'</span><span>'+won(v.actual)+'</span><span>'+sg(v.diff)+'</span></div></div>'
    +'<p class="pv-note">'+esc(md)+'경비 계산 견적과 비교 · 견적 합계엔 예비비 포함 · 항공·숙소를 미리 결제하고 지출에 안 적었다면 실제가 적게 나와요</p>';
}
function openReport(){
  var r=reportData();
  var cats=r.cats.slice(0,5).map(function(x){ var pct=r.total?Math.round(x.amt/r.total*100):0;
    return '<div class="rp-cat"><span>'+x.cat.emoji+' '+x.cat.label+'</span><i><b style="width:'+pct+'%;background:'+x.cat.color+'"></b></i><em>'+won(x.amt)+' · '+pct+'%</em></div>'; }).join('');
  var bud = r.budget ? '<div class="rp-line">예산 '+won(r.budget)+' 중 <b>'+Math.round(r.total/r.budget*100)+'%</b> 사용 — '+(r.total<=r.budget?won(r.budget-r.total)+' 남김 👏':won(r.total-r.budget)+' 초과')+'</div>' : '';
  openSheet('<h3>'+esc(trip.city)+' 여행 결산</h3>'
    +'<div class="rp-total"><small>총 지출 · '+r.days+'일 · '+r.ppl+'명</small><b>'+won(r.total)+'</b></div>'
    +'<div class="rp-grid"><div><small>하루 평균</small><b>'+won(r.perDay)+'</b></div><div><small>1인당</small><b>'+won(r.perPerson)+'</b></div><div><small>지출</small><b>'+r.count+'건</b></div></div>'
    +bud
    +planVsHtml()
    +'<div class="sech" style="margin-top:14px">어디에 썼나</div>'+cats
    +(r.big?'<div class="rp-line">💸 가장 큰 지출 <b>'+esc(r.big.memo||T.catByKey(r.big.category).label)+' '+won(r.big.krw)+'</b></div>':'')
    +(r.topDay?'<div class="rp-line">📅 가장 많이 쓴 날 <b>'+esc(dayLabel(r.topDay.d))+' '+won(r.topDay.amt)+'</b></div>':'')
    +(r.ppl>1?'<div class="rp-line">🤝 정산 '+(r.setl.length?'<b>'+r.setl.length+'건 남음</b>':'<b>완료</b>')+'</div>':'')
    +dailyBars()
    +journalList()
    +'<img id="rp-img" alt="결산 이미지 카드" class="rp-img">'
    +'<button class="save" onclick="shareReport()">🖼 이미지 카드 저장·공유</button>');
  var c=drawReportCard(r); if(c) document.getElementById('rp-img').src=c.toDataURL('image/png');
  fillJournal();
  loadRpPhoto(function(){ var im=document.getElementById('rp-img'), c2=drawReportCard(reportData()); if(im&&c2) im.src=c2.toDataURL('image/png'); });
}
var COVC={osaka:['#f97316','#e5484d'],blue:['#1B4FD8','#0ea5e9'],purple:['#7c3aed','#1B4FD8'],green:['#039855','#22c55e'],pink:['#db2777','#f97316']};
function drawReportCard(r){
  var c=document.createElement('canvas'); c.width=1080; c.height=1350;
  var g=c.getContext('2d'); if(!g) return null;
  var F='"Pretendard","Apple SD Gothic Neo","Malgun Gothic","Noto Sans KR",sans-serif';
  var col=COVC[trip.cover]||COVC.blue, bg=g.createLinearGradient(0,0,1080,1350); bg.addColorStop(0,col[0]); bg.addColorStop(1,col[1]);
  g.fillStyle=bg; g.fillRect(0,0,1080,1350);
  if(_rpPhoto&&_rpPhoto.city===trip.city){   // 도시 사진(위키미디어는 CORS 허용 → 캔버스 저장 가능) + 어둡게
    var im=_rpPhoto.img, sc=Math.max(1080/im.width,1350/im.height), w=im.width*sc, h=im.height*sc;
    try{ g.drawImage(im,(1080-w)/2,(1350-h)/2,w,h); }catch(e){}
    var ov=g.createLinearGradient(0,0,0,1350); ov.addColorStop(0,'rgba(0,0,0,.55)'); ov.addColorStop(.35,'rgba(0,0,0,.25)'); ov.addColorStop(1,'rgba(0,0,0,.6)');
    g.fillStyle=ov; g.fillRect(0,0,1080,1350);
  }
  g.fillStyle='rgba(255,255,255,.85)'; g.font='700 34px '+F; g.fillText('트래블코스트 · 여행 결산',72,110);
  g.fillStyle='#fff'; g.font='800 104px '+F; g.fillText(trip.city.slice(0,10),72,235);
  g.font='600 36px '+F; g.fillText(trip.start.replace(/-/g,'.')+' – '+T.fmtMD(trip.end)+' · '+r.days+'일 · '+r.ppl+'명',72,300);
  // 흰 패널
  var x=48,y=360,w=984,h=920,rad=40; g.fillStyle='#fff'; g.beginPath();
  g.moveTo(x+rad,y); g.arcTo(x+w,y,x+w,y+h,rad); g.arcTo(x+w,y+h,x,y+h,rad); g.arcTo(x,y+h,x,y,rad); g.arcTo(x,y,x+w,y,rad); g.closePath(); g.fill();
  g.fillStyle='#667085'; g.font='700 34px '+F; g.fillText('총 지출',100,440);
  g.fillStyle='#101828'; g.font='800 112px '+F; g.fillText(won(r.total),96,560);
  var st=[['하루 평균',won(r.perDay)],['1인당',won(r.perPerson)],['지출',r.count+'건']];
  st.forEach(function(s,i){ var sx=100+i*305; g.fillStyle='#667085'; g.font='600 30px '+F; g.fillText(s[0],sx,640); g.fillStyle='#101828'; g.font='800 44px '+F; g.fillText(s[1],sx,695); });
  var yy=760;
  if(r.budget){ g.fillStyle='#344054'; g.font='600 32px '+F; g.fillText('예산 '+won(r.budget)+' 중 '+Math.round(r.total/r.budget*100)+'% 사용',100,yy); yy+=60; }
  if(r.pv){   // 견적으로 담은 여행이면 견적 대비 한 줄(2026-11-16)
    var dv=r.pv.diff; g.font='700 32px '+F;
    g.fillStyle=dv>0?'#D92D20':dv<0?'#039855':'#344054';
    g.fillText(dv>0?'견적보다 '+won(dv)+' 더 썼어요':dv<0?'견적보다 '+won(-dv)+' 덜 썼어요 👏':'견적과 똑같이 썼어요',100,yy); yy+=60;
  }
  g.fillStyle='#101828'; g.font='800 36px '+F; g.fillText('어디에 썼나',100,yy+10); yy+=50;
  r.cats.slice(0,4).forEach(function(xc){
    var pct=r.total?xc.amt/r.total:0;
    g.fillStyle='#344054'; g.font='700 32px '+F; g.fillText(xc.cat.label,100,yy+34);
    g.fillStyle='#F2F4F7'; g.fillRect(260,yy+10,520,30); g.fillStyle=xc.cat.color; g.fillRect(260,yy+10,Math.max(8,520*pct),30);
    g.fillStyle='#475467'; g.font='700 30px '+F; g.textAlign='right'; g.fillText(won(xc.amt),980,yy+36); g.textAlign='left';
    yy+=62;
  });
  if(r.big){ g.fillStyle='#344054'; g.font='600 30px '+F; g.fillText('💸 가장 큰 지출 · '+String(r.big.memo||T.catByKey(r.big.category).label).slice(0,14)+' '+won(r.big.krw),100,Math.min(yy+30,1240)); }
  g.fillStyle='rgba(255,255,255,.92)'; g.font='700 32px '+F; g.fillText('travelcost.co.kr',72,1325);
  return c;
}
function shareReport(){
  var c=drawReportCard(reportData()); if(!c){ alert('이 브라우저에선 이미지를 만들 수 없어요.'); return; }
  var name=(trip.city||'여행')+'-결산.png';
  c.toBlob(function(blob){
    try{
      var file=new File([blob],name,{type:'image/png'});
      if(navigator.canShare&&navigator.canShare({files:[file]})){ navigator.share({files:[file],title:trip.city+' 여행 결산'}).catch(function(){}); return; }
    }catch(e){}
    var a=document.createElement('a'); a.href=c.toDataURL('image/png'); a.download=name; document.body.appendChild(a); a.click(); setTimeout(function(){ document.body.removeChild(a); },100);
    toast('결산 이미지를 저장했어요');
  },'image/png');
}

/* ═══ #8 결산: 날짜별 지출 막대 + 카드용 도시 사진 ═══ */
function dailyBars(){
  var days=(trip.days||[]).map(function(d){ return {d:d.date,v:daySum(d.date)}; }), mx=Math.max.apply(null,days.map(function(x){ return x.v; }));
  if(!mx) return '';
  var tgt=dayTarget();
  return '<div class="sech" style="margin-top:14px">날짜별 지출</div><div class="dbars">'+days.map(function(x,i){
    var h=Math.max(4,Math.round(x.v/mx*100));
    return '<div class="db"><em>'+(x.v?Math.round(x.v/1000)+'k':'')+'</em><i style="height:'+h+'%'+(tgt&&x.v>tgt?';background:var(--danger)':'')+'"></i><small>'+(i+1)+'일</small></div>'; }).join('')+'</div>'
    +(tgt?'<div style="font-size:11px;color:var(--gray-500);margin-top:4px">빨간 막대 = 하루 목표('+won(tgt)+') 초과</div>':'');
}
var _rpPhoto=null;
function loadRpPhoto(cb){
  var src=T.cityPhoto?T.cityPhoto(trip.city):''; if(!src) return;
  if(_rpPhoto&&_rpPhoto.city===trip.city){ cb(); return; }
  var im=new Image(); im.crossOrigin='anonymous'; im.referrerPolicy='no-referrer';
  im.onload=function(){ _rpPhoto={city:trip.city,img:im}; cb(); };
  im.src=src.replace(/\/\d+px-/,'/960px-');   // 카드용으로 조금 크게(960은 위키미디어 표준 크기)
}

/* ═══ 🖨 여행 계획 한 장 — 일정·항공·예약·숙소 주소(현지어)·비상 연락처. 인쇄 창에서 'PDF로 저장'도 됨 ═══ */
function printTrip(){
  var cc=ccOf(), li=cc&&window.LOCAL_INFO&&LOCAL_INFO[cc], M=window.LOCAL_INFO_META||{}, P=window.PHRASES;
  var dot=function(d){ return esc(String(d||'').replace(/-/g,'.')); },   /* 출력물 날짜도 이스케이프 */ f=trip.flight, b=trip.flightBack, st=stayResv();
  var mem=(trip.members||[]).map(function(m){ return m.name; }).join('·');
  var tx=st&&P&&P.TAXI&&(P.TAXI[cc]||(tzOf()==='Asia/Seoul'?null:P.TAXI.en));
  var h='<div class="pt-h"><h1>'+esc(trip.city)+' 여행</h1><p>'+dot(trip.start)+' – '+dot(trip.end)+' · '+T.tripLength(trip)+'일'+(mem?' · '+esc(mem):'')+'</p></div>';
  if((f&&(f.no||f.dep))||(b&&(b.no||b.arr))){
    h+='<h2>✈ 항공</h2><table>';
    if(f&&(f.no||f.dep)) h+='<tr><th>가는 편</th><td>'+dot(trip.start)+' '+esc(f.no||'')+' '+esc(f.from||'ICN')+' '+esc(f.dep||'')+' → '+esc(f.to||'')+' '+esc(f.arr||'')+'</td></tr>';
    if(b&&(b.no||b.arr)) h+='<tr><th>오는 편</th><td>'+dot(b.date)+' '+esc(b.no||'')+' '+esc(b.from||'')+' '+esc(b.dep||'')+' → ICN '+esc(b.arr||'')+'</td></tr>';
    h+='</table>';
  }
  if(st) h+='<h2>🏨 숙소 주소</h2><div class="pt-addr">'+(tx?'<small>'+esc(tx[0])+'</small>':'')+'<b>'+esc(st.addr)+'</b><span>'+esc(st.title)+'</span></div>';
  var rs=(trip.reservations||[]).filter(function(r){ return r.type!=='flight'||!f; });
  if(rs.length){
    h+='<h2>🎫 예약</h2><table>'+rs.map(function(r){ return '<tr><th>'+esc(r.title)+(r.status==='planned'?' <i>(예정)</i>':'')+'</th><td>'+[r.detail?esc(r.detail):'',r.addr?'📍 '+esc(r.addr):'',r.cancelBy&&r.cancelBy>=todayISO()?'⏰ 무료 취소 '+dot(r.cancelBy)+'까지':''].filter(Boolean).join('<br>')+'</td></tr>'; }).join('')+'</table>';
  }
  var days=(trip.days||[]).filter(function(d){ return (d.items||[]).length; });
  if(days.length){
    h+='<h2>🗓 일정</h2><table class="pt-days">'+days.map(function(d){
      var i=(trip.days||[]).indexOf(d);
      return '<tr><th>'+(i+1)+'일차<br><small>'+T.fmtMD(d.date)+' '+T.dow(d.date)+'</small></th><td>'+(d.items||[]).map(function(it){ return '<div>'+(it.time?'<b>'+esc(it.time)+'</b> ':'')+(it.when?'<small>('+esc(it.when)+')</small> ':'')+esc(it.title)+(it.addr?' <small>📍 '+esc(it.addr)+'</small>':'')+(it.memo?' <small>— '+esc(it.memo)+'</small>':'')+'</div>'; }).join('')+'</td></tr>';
    }).join('')+'</table>';
  }
  if(M.call||(li&&li.sos)){
    h+='<h2>🆘 비상 연락처</h2><table>'+(M.call?'<tr><th>영사안전콜센터 (24시간)</th><td>'+esc(M.call)+'</td></tr>':'')
      +((li&&li.sos)||[]).map(function(x){ return '<tr><th>'+esc(x[0])+'</th><td>'+esc(x[1])+'</td></tr>'; }).join('')+'</table>';
  }
  h+='<p class="pt-f">트래블코스트(travelcost.co.kr)에서 만든 여행 계획 · '+dot(todayISO())+' 출력 · 예약 내용은 예약처 확인 메일이 기준이에요</p>';
  var box=document.getElementById('printBox'); if(!box){ box=document.createElement('div'); box.id='printBox'; document.body.appendChild(box); }
  box.innerHTML=h; document.body.classList.add('printing');
  var done=function(){ document.body.classList.remove('printing'); window.removeEventListener('afterprint',done); };
  window.addEventListener('afterprint',done);
  try{ window.print(); }catch(e){ done(); toast('이 기기는 인쇄를 지원하지 않아요'); }
}
