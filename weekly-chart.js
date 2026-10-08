(()=>{
  const sel=document.getElementById('weekSelect');
  const total=document.getElementById('weekTotal');
  if(!sel||!total||typeof weeklyArchive==='undefined') return;

  // Points de calibration corrigés pour les séances du 28 au 30 septembre 2026.
  // 28 sept. : estimation à 16 h -2 218 $; rendement réel -1 500 $.
  // 29 sept. : estimation à 16 h -254 $; rendement réel -277 $.
  // 30 sept. : estimation à 16 h -1 479 $; rendement réel -1 177 $.
  // 1 oct. : estimation à 16 h -412 $; rendement réel -712 $.
  const currentKey='2026-09-28';
  if(!weeklyArchive[currentKey]){
    weeklyArchive[currentKey]={
      label:'Semaine du 28 septembre au 2 octobre 2026',
      note:'Semaine courante — les rendements sont compilés indépendamment.',
      days:[['Lun. 28',-2218,-1500],['Mar. 29',-254,-277],['Mer. 30',-1479,-1177],['Jeu. 1',-412,-712],['Ven. 2','—',null]]
    };
  }else{
    weeklyArchive[currentKey].days[0]=['Lun. 28',-2218,-1500];
    weeklyArchive[currentKey].days[1]=['Mar. 29',-254,-277];
    weeklyArchive[currentKey].days[2]=['Mer. 30',-1479,-1177];
    weeklyArchive[currentKey].days[3]=['Jeu. 1',-412,-712];
  }

  // Semaine du 5 au 9 octobre 2026 : données confirmées du lundi et du mardi.
  // Ces valeurs sont persistées dans le code afin qu'elles restent visibles après un redémarrage.
  const octoberKey='2026-10-05';
  if(!weeklyArchive[octoberKey]){
    weeklyArchive[octoberKey]={
      label:'Semaine du 5 octobre 2026 au 9 octobre 2026',
      note:'Semaine courante — les rendements seront compilés indépendamment.',
      days:[['Lundi',389,460],['Mardi',1052,750],['Mercredi',-3781,-1700],['Jeudi','—',null],['Vendredi','—',null]]
    };
  }else{
    weeklyArchive[octoberKey].days[0]=['Lundi',389,460];
    weeklyArchive[octoberKey].days[1]=['Mardi',1052,750];
    weeklyArchive[octoberKey].days[2]=['Mercredi',-3781,-1700];
  }

  // Rafraîchit le sélecteur et le tableau afin que les données injectées ci-dessus soient visibles immédiatement.
  if(typeof setupWeeks==='function') setupWeeks();
  // Les points atypiques restent visibles, sans modifier les coefficients du modèle.
  const excludedFromCalibration=new Set(['2026-10-06','2026-10-07']);
  const anomalyThreshold={minDollars:500,minRelative:0.50,window:5,minCount:3};
  function calibrationWatch(){
    const observations=Object.entries(weeklyArchive).flatMap(([key,week])=>(week.days||[]).map((d,i)=>{
      const date=new Date(key+'T12:00:00');date.setDate(date.getDate()+i);
      return {date:date.toISOString().slice(0,10),estimated:d[1],actual:d[2]};
    })).filter(d=>Number.isFinite(d.estimated)&&Number.isFinite(d.actual)).sort((a,b)=>a.date.localeCompare(b.date));
    const last=observations.slice(-anomalyThreshold.window);
    const unusual=last.filter(d=>Math.abs(d.estimated-d.actual)>=anomalyThreshold.minDollars&&Math.abs(d.estimated-d.actual)/Math.max(Math.abs(d.actual),1)>=anomalyThreshold.minRelative);
    return {unusual:unusual.length,observed:last.length,review:last.length>=anomalyThreshold.window&&unusual.length>=anomalyThreshold.minCount};
  }
  const marketObservations={
    '2026-09-21':{sp:'+1,49 %',tsx:'+0,57 %'},
    '2026-09-22':{sp:'~0,00 %',tsx:'+0,91 %'},
    '2026-09-23':{sp:'−0,75 %',tsx:'−1,61 %'},
    '2026-09-24':{sp:'−0,02 %',tsx:'−0,13 %'}
  };
  function renderCalibration(){
    const body=document.getElementById('calibrationRows');
    if(!body)return;
    const rows=[];
    Object.entries(weeklyArchive).forEach(([weekKey,week])=>{
      const monday=new Date(weekKey+'T12:00:00');
      (week.days||[]).forEach((day,index)=>{
        const date=new Date(monday);date.setDate(monday.getDate()+index);
        const key=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Toronto',year:'numeric',month:'2-digit',day:'2-digit'}).format(date);
        const estimate=typeof day[1]==='number'?day[1]:null;
        const actual=typeof day[2]==='number'?day[2]:null;
        if(estimate===null&&actual===null)return;
        rows.push({key,label:date.toLocaleDateString('fr-CA',{timeZone:'America/Toronto',day:'numeric',month:'short'}),estimate,actual});
      });
    });
    rows.sort((a,b)=>a.key.localeCompare(b.key));
    const sum=rows.reduce((total,row)=>total+(row.actual??0),0);
    body.innerHTML=rows.map(row=>{
      const market=marketObservations[row.key]||{};
      return '<tr><td>'+row.label+'</td><td>'+ (market.sp||'—') +'</td><td>'+ (market.tsx||'—') +'</td><td>'+ (row.estimate===null?'—':cad(row.estimate)) +'</td><td>'+ (row.actual===null?'—':cad(row.actual)) +'</td></tr>';
    }).join('')+'<tr><td><b>Cumul réel</b></td><td>—</td><td>—</td><td>—</td><td><b>'+cad(sum)+'</b></td></tr>';
  }


  const style=document.createElement('style');
  style.textContent='.weeklyChartTitle{margin-top:22px}.weeklyLegend{display:flex;gap:18px;flex-wrap:wrap;margin:8px 0 4px}.weeklyLegend span:before{content:"●";margin-right:6px}.weeklyLegend .est:before{color:#66aaff}.weeklyLegend .real:before{color:#59d68d}.weeklyChartWrap{height:310px;position:relative;margin-top:8px}.weeklyChartWrap canvas{width:100%;height:100%}.weeklyChartNote{margin-top:4px}.calibrationDelta{margin-top:12px;padding:10px;background:#10161c;border-radius:9px}';
  document.head.appendChild(style);

  const host=document.createElement('div');
  const watch=calibrationWatch();
  host.innerHTML='<h3 class="weeklyChartTitle">Graphique hebdomadaire — estimé vs réel</h3><div class="weeklyLegend"><span class="est">Rendement estimé à 16 h</span><span class="real">Rendement réel</span></div><div class="weeklyChartWrap"><canvas id="weeklyChart"></canvas></div><p class="weeklyChartNote"><small id="weeklyChartInfo"></small></p><p class="calibrationDelta"><small><b>Calibration surveillée :</b> 6 octobre (+1 052 $ / +750 $, écart 302 $) et 7 octobre (−3 781 $ / −1 700 $, écart −2 081 $) conservés dans les bilans mais exclus provisoirement des ajustements. Coefficients inchangés. <b>Détection de persistance :</b> au moins 3 journées avec un écart ≥ 500 $ et ≥ 50 % du réel parmi les 5 dernières séances comparables déclenchent une recommandation de réévaluation, jamais une modification automatique. État : '+(watch.review?'RÉÉVALUATION RECOMMANDÉE':'surveillance ('+watch.unusual+'/'+watch.observed+' anomalies sur les séances comparables récentes)')+'.</small></p>';
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
  renderCalibration();
  requestAnimationFrame(drawWeekly);
  window.addEventListener('resize',drawWeekly);
})();