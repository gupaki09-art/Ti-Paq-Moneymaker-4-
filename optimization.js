(()=>{
'use strict';
const BASE_A=440.81167345,BASE_B=2161.51845819, PREFIX='tipaq-experiment-v1-';
const dateQC=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'America/Toronto',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
const money=n=>Number.isFinite(n)?new Intl.NumberFormat('fr-CA',{style:'currency',currency:'CAD',maximumFractionDigits:0,signDisplay:'always'}).format(n):'—';
const safeRead=k=>{try{return JSON.parse(localStorage.getItem(k)||'null')}catch{return null}};
const records=()=>{const out=[];for(let i=0;i<localStorage.length;i++){const k=localStorage.key(i);if(k&&k.startsWith(PREFIX)){const r=safeRead(k);if(r&&/^\d{4}-\d\d-\d\d$/.test(r.date))out.push(r)}}return out.sort((a,b)=>a.date.localeCompare(b.date))};
const valid=r=>Number.isFinite(r.sp)&&Number.isFinite(r.tsx)&&Number.isFinite(r.actual);
const fitted=(data,lambda=0.15)=>{
  if(data.length<8)return null;
  // Center/scale columns to keep ridge penalty meaningful across differently scaled inputs.
  const mean=y=>y.reduce((s,v)=>s+v,0)/y.length;
  const xs=data.map(r=>r.sp),ts=data.map(r=>r.tsx),ys=data.map(r=>r.actual);
  const ms=mean(xs),mt=mean(ts),my=mean(ys);
  const sd=a=>Math.sqrt(Math.max(1e-12,mean(a.map(v=>(v-mean(a))**2))));
  const ss=sd(xs),st=sd(ts),sy=sd(ys);
  const X=xs.map(v=>(v-ms)/ss),T=ts.map(v=>(v-mt)/st),Y=ys.map(v=>(v-my)/sy);
  const n=data.length;
  const xx=X.reduce((s,v)=>s+v*v,0)+lambda*n,tt=T.reduce((s,v)=>s+v*v,0)+lambda*n;
  const xt=X.reduce((s,v,i)=>s+v*T[i],0),xy=X.reduce((s,v,i)=>s+v*Y[i],0),ty=T.reduce((s,v,i)=>s+v*Y[i],0);
  const det=xx*tt-xt*xt;if(det<=1e-10)return null;
  const a=(xy*tt-ty*xt)/det*sy/ss,b=(ty*xx-xy*xt)/det*sy/st;
  const intercept=my-a*ms-b*mt;
  return {a,b,intercept,n,lambda};
};
const estimate=(m,sp,tsx)=>m.intercept+m.a*sp+m.b*tsx;
function saveClose(detail){
 const date=detail.date||dateQC(),key=PREFIX+date;
 if(localStorage.getItem(key))return; // Lock prediction once made; no retrospective rewriting.
 const training=records().filter(r=>r.date<date&&valid(r));
 const model=fitted(training);
 const row={date,sp:detail.sp,tsx:detail.tsx,baseline:BASE_A*detail.sp+BASE_B*detail.tsx,experimental:model?estimate(model,detail.sp,detail.tsx):null,trainingCount:training.length,coefficients:model,actual:null,recordedAt:new Date().toISOString()};
 localStorage.setItem(key,JSON.stringify(row));render();
}
function syncActuals(){
 if(typeof weeklyArchive==='undefined')return;
 const map={};
 Object.entries(weeklyArchive).forEach(([key,week])=>(week.days||[]).forEach((d,i)=>{
  const dt=new Date(key+'T12:00:00');dt.setDate(dt.getDate()+i);
  const date=dt.toISOString().slice(0,10);if(Number.isFinite(d[2]))map[date]=d[2];
 }));
 records().forEach(r=>{if(Number.isFinite(map[r.date])&&r.actual!==map[r.date]){r.actual=map[r.date];localStorage.setItem(PREFIX+r.date,JSON.stringify(r))}});
}
function render(){
 syncActuals();const data=records(),ready=data.filter(r=>Number.isFinite(r.actual)&&Number.isFinite(r.experimental)&&Number.isFinite(r.baseline));
 const avg=field=>ready.length?ready.reduce((s,r)=>s+Math.abs(r[field]-r.actual),0)/ready.length:null;
 const current=fitted(data.filter(valid));
 const status=document.getElementById('optStatus'),table=document.getElementById('optRows');
 if(!status||!table)return;
 const count=data.filter(valid).length;
 status.textContent=current?'Modèle expérimental prêt : '+count+' observations locales avec variations de clôture et rendement réel.':'Apprentissage en attente : '+count+'/8 observations complètes. Les données historiques approximatives ne sont pas utilisées pour entraîner le modèle.';
 document.getElementById('optCoefficients').textContent=current?'Estimation = '+current.intercept.toFixed(2)+' + '+current.a.toFixed(2)+' × Δ S&P (%) + '+current.b.toFixed(2)+' × Δ TSX (%)':'Coefficients expérimentaux non calculés.';
 document.getElementById('optMetrics').textContent=ready.length?'Comparaison prospective sur '+ready.length+' séance(s) : erreur absolue moyenne actuelle '+money(avg('baseline'))+' ; expérimentale '+money(avg('experimental'))+'.':'Aucune comparaison prospective disponible pour le moment.';
 table.innerHTML=data.slice().reverse().map(r=>'<tr><td>'+r.date+'</td><td>'+money(r.baseline)+'</td><td>'+money(r.experimental)+'</td><td>'+money(r.actual)+'</td><td>'+(r.experimental===null?'Apprentissage':'Prévision figée')+'</td></tr>').join('')||'<tr><td colspan="5">Aucune clôture enregistrée sur cet appareil.</td></tr>';
}
const nav=document.createElement('div');nav.className='card';nav.style.cssText='display:flex;gap:8px;flex-wrap:wrap';
nav.innerHTML='<button id="tabMain" type="button">Tableau de bord</button><button id="tabOpt" type="button">Optimisation expérimentale</button>';
const main=document.getElementById('app');main.insertBefore(nav,main.children[2]);
const panel=document.createElement('section');panel.id='optPanel';panel.className='card hidden';
panel.innerHTML='<h2>Optimisation expérimentale — comparaison indépendante</h2><p class="muted">Régression ridge (moindres carrés régularisés). Entraînement exclusivement sur les journées passées ayant une observation locale complète. Minimum : 8 séances. Une estimation est figée à la clôture, avant la saisie du réel.</p><p id="optStatus"></p><p class="formula" id="optCoefficients"></p><p id="optMetrics"></p><div style="overflow-x:auto"><table><thead><tr><th>Date</th><th>Actuel</th><th>Expérimental</th><th>Réel</th><th>État</th></tr></thead><tbody id="optRows"></tbody></table></div><p class="muted"><small>Les données sont conservées dans le stockage local de ce navigateur. Ne pas effacer les données du site. Les pourcentages historiques reconstitués ne sont pas assimilés aux mesures originales à 16 h 20. Aucun coefficient du modèle principal n’est modifié.</small></p>';
main.appendChild(panel);
const sections=[...main.children].filter(el=>el!==nav&&el!==panel&&el.tagName!=='H1'&&!(el.tagName==='P'&&el.classList.contains('muted')));
function show(opt){sections.forEach(el=>el.classList.toggle('hidden',opt));panel.classList.toggle('hidden',!opt);if(!opt&&typeof drawChart==='function')requestAnimationFrame(drawChart);if(opt)render()}
document.getElementById('tabMain').onclick=()=>show(false);
document.getElementById('tabOpt').onclick=()=>show(true);
window.addEventListener('tipaq-final-market-close',e=>saveClose(e.detail));
render();
})();