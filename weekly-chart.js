(()=>{
  const sel=document.getElementById('weekSelect');
  const total=document.getElementById('weekTotal');
  if(!sel||!total||typeof weeklyArchive==='undefined') return;

  // Points de calibration corrigés pour les séances du 28 au 30 septembre 2026.
  // 28 sept. : estimation à 16 h -2 218 $; rendement réel -1 500 $.
  // 29 sept. : estimation à 16 h -254 $; rendement réel -277 $.
  // 30 sept. : estimation à 16 h -1 479 $; rendement réel -1 177 $.
  const currentKey='2026-09-28';
  if(!weeklyArchive[currentKey]){
    weeklyArchive[currentKey]={
      label:'Semaine du 28 septembre au 2 octobre 2026',
      note:'Semaine courante — les rendements sont compilés indépendamment.',
      days:[['Lun. 28',-2218,-1500],['Mar. 29',-254,-277],['Mer. 30',-1479,-1177],['Jeu. 1','—',null],['Ven. 2','—',null]]
    };
  }else{
    weeklyArchive[currentKey].days[0]=['Lun. 28',-2218,-1500];
    weeklyArchive[currentKey].days[1]=['Mar. 29',-254,-277];
    weeklyArchive[currentKey].days[2]=['Mer. 30',-1479,-1177];
  }

  // Rafraîchit le sélecteur et le tableau afin que les données injectées ci-dessus soient visibles immédiatement.
  if(typeof setupWeeks==='function') setupWeeks();

  const style=document.createElement('style');
  style.textContent='.weeklyChartTitle{margin-top:22px}.weeklyLegend{display:flex;gap:18px;flex-wrap:wrap;margin:8px 0 4px}.weeklyLegend span:before{content:"●";margin-right:6px}.weeklyLegend .est:before{color:#66aaff}.weeklyLegend .real:before{color:#59d68d}.weeklyChartWrap{height:310px;position:relative;margin-top:8px}.weeklyChartWrap canvas{width:100%;height:100%}.weeklyChartNote{margin-top:4px}.calibrationDelta{margin-top:12px;padding:10px;background:#10161c;border-radius:9px}';
  document.head.appendChild(style);

  const host=document.createElement('div');
  host.innerHTML='<h3 class="weeklyChartTitle">Graphique hebdomadaire — estimé vs réel</h3><div class="weeklyLegend"><span class="est">Rendement estimé à 16 h</span><span class="real">Rendement réel</span></div><div class="weeklyChartWrap"><canvas id="weeklyChart"></canvas></div><p class="weeklyChartNote"><small id="weeklyChartInfo"></small></p><p class="calibrationDelta"><small><b>Calibration du 30 septembre :</b> estimation −1 479 $ / réel −1 177 $ — perte estimée 302 $ trop élevée.</small></p>';
  total.closest('p').after(host);

  function drawWeekly(){
    const w=weeklyArchive[sel.value];
    const c=document.getElementById('weeklyChart');
    if(!w||!c)return;
    const r=c.getBoundingClientRect(),dpr=devicePixelRatio||1;
    if(!r.width)return;
    c.width=r.width*dpr;c.height=r.height*dpr;
    const x=c.getContext('2d');x.setTransform(dpr,0,0,dpr,0,0);
    const W=r.width,H=r.height,L=62,R=16,T=18,B=42,pw=W-L-R,ph=H-T-B;
    const vals=w.days.flatMap(d=>[d[1],d[2]]).filter(Number.isFinite).concat([0]);
    const mn=Math.min(...vals),mx=Math.max(...vals),pad=Math.max(250,(mx-mn)*.15),lo=mn-pad,hi=mx+pad,yr=hi-lo||1;
    x.clearRect(0,0,W,H);x.font='12px system-ui';x.fillStyle='#9da9b5';x.strokeStyle='#303a45';x.lineWidth=1;
    for(let i=0;i<=4;i++){const y=T+ph*i/4,v=hi-yr*i/4;x.beginPath();x.moveTo(L,y);x.lineTo(W-R,y);x.stroke();x.fillText(Math.round(v)+' $',3,y+4)}
    const xp=i=>L+pw*(i/(w.days.length-1||1));
    w.days.forEach((d,i)=>x.fillText(d[0],xp(i)-18,H-13));
    function series(idx,color){let active=false;x.strokeStyle=color;x.lineWidth=2.5;x.beginPath();w.days.forEach((d,i)=>{const v=d[idx];if(!Number.isFinite(v)){active=false;return}const px=xp(i),py=T+(hi-v)/yr*ph;if(!active){x.moveTo(px,py);active=true}else x.lineTo(px,py)});x.stroke();w.days.forEach((d,i)=>{const v=d[idx];if(!Number.isFinite(v))return;const px=xp(i),py=T+(hi-v)/yr*ph;x.beginPath();x.arc(px,py,4,0,Math.PI*2);x.fillStyle=color;x.fill()})}
    series(1,'#66aaff');series(2,'#59d68d');
    const est=w.days.filter(d=>Number.isFinite(d[1])).length,real=w.days.filter(d=>Number.isFinite(d[2])).length;
    document.getElementById('weeklyChartInfo').textContent=real+' rendement(s) réel(s) et '+est+' estimation(s) de clôture disponibles. Les données manquantes ne sont pas reconstruites artificiellement.';
  }

  const baseRender=renderWeek;
  window.renderWeek=function(){baseRender();requestAnimationFrame(drawWeekly)};
  sel.onchange=window.renderWeek;
  requestAnimationFrame(drawWeekly);
  window.addEventListener('resize',drawWeekly);
})();