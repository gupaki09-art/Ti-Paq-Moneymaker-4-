const SYMBOLS={sp500:'^GSPC',tsx:'^GSPTSE'};
const MAX_INTRADAY_PCT=20;
function marketCalendar(date,market){
 const [y,m,d]=date.split('-').map(Number);
 const wd=new Date(Date.UTC(y,m-1,d)).getUTCDay();
 const nth=(month,weekday,n)=>1+(weekday-new Date(Date.UTC(y,month-1,1)).getUTCDay()+7)%7+7*(n-1);
 const last=(month,weekday)=>{const x=new Date(Date.UTC(y,month,0));return x.getUTCDate()-(x.getUTCDay()-weekday+7)%7};
 const is=(month,day)=>m===month&&d===day;
 const observed=(month,day)=>{const w=new Date(Date.UTC(y,month-1,day)).getUTCDay();const x=new Date(Date.UTC(y,month-1,day+(w===6?-1:w===0?1:0)));return is(x.getUTCMonth()+1,x.getUTCDate())};
 const a=y%19,b=Math.floor(y/100),cc=y%100,dd=Math.floor(b/4),e=b%4,f=Math.floor((b+8)/25),g=Math.floor((b-f+1)/3),h=(19*a+b-dd-g+15)%30,i=Math.floor(cc/4),k=cc%4,l=(32+2*e+2*i-h-k+7)%7,mm=Math.floor((a+11*h+22*l)/451),em=Math.floor((h+l-7*mm+114)/31),ed=(h+l-7*mm+114)%31+1;
 const gf=new Date(Date.UTC(y,em-1,ed-2));
 let holiday=is(gf.getUTCMonth()+1,gf.getUTCDate())||observed(1,1)||observed(12,25);
 if(market==='tsx')holiday ||=is(2,nth(2,1,3))||is(5,25-(new Date(Date.UTC(y,4,25)).getUTCDay()+6)%7)||observed(7,1)||is(8,nth(8,1,1))||is(9,nth(9,1,1))||is(10,nth(10,1,2))||observed(12,26);
 else holiday ||=is(1,nth(1,1,3))||is(2,nth(2,1,3))||is(5,last(5,1))||observed(6,19)||observed(7,4)||is(9,nth(9,1,1))||is(11,nth(11,4,4));
 return {open:wd!==0&&wd!==6&&!holiday,reason:holiday?'Jour férié boursier':wd===0||wd===6?'Fin de semaine':null};
}

async function getMarket(symbol){
 const url='https://query1.finance.yahoo.com/v8/finance/chart/'+encodeURIComponent(symbol)+'?interval=5m&range=1d&includePrePost=false';
 const response=await fetch(url,{headers:{'User-Agent':'Mozilla/5.0',Accept:'application/json'},cache:'no-store'});
 if(!response.ok)throw new Error(`Yahoo Finance HTTP ${response.status} pour ${symbol}`);
 const payload=await response.json(),result=payload?.chart?.result?.[0],meta=result?.meta;
 if(!meta)throw new Error(`Réponse Yahoo Finance invalide pour ${symbol}`);
 const price=Number(meta.regularMarketPrice),previousClose=Number(meta.chartPreviousClose??meta.previousClose);
 if(!Number.isFinite(price)||!Number.isFinite(previousClose)||previousClose===0)throw new Error(`Données de marché incomplètes pour ${symbol}`);
 const timestamps=result.timestamp||[],closes=result.indicators?.quote?.[0]?.close||[];
 const bars=[];
 for(let i=0;i<timestamps.length;i++){
  const close=Number(closes[i]);
  if(!Number.isFinite(close)||close<=0)continue;
  const pct=((close-previousClose)/previousClose)*100;
  // Ignore les barres manifestement corrompues afin qu'un seul point aberrant
  // ne détruise pas l'échelle du graphique intrajournalier.
  if(!Number.isFinite(pct)||Math.abs(pct)>MAX_INTRADAY_PCT)continue;
  bars.push({ts:timestamps[i],price:close,pct});
 }
 const pct=((price-previousClose)/previousClose)*100;
 if(!Number.isFinite(pct)||Math.abs(pct)>MAX_INTRADAY_PCT)throw new Error(`Variation de marché aberrante pour ${symbol}`);
 return{symbol,price,previousClose,pct,marketTime:meta.regularMarketTime??null,currency:meta.currency??null,bars};
}
module.exports=async function handler(req,res){
 res.setHeader('Cache-Control','no-store, max-age=0');
 if(req.method!=='GET'){res.setHeader('Allow','GET');return res.status(405).json({ok:false,error:'Méthode non permise.'});}
 try{
  const date=new Intl.DateTimeFormat('en-CA',{timeZone:'America/New_York',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
  const calendar={sp500:marketCalendar(date,'sp500'),tsx:marketCalendar(date,'tsx')};
  const [spResult,tsxResult]=await Promise.allSettled([getMarket(SYMBOLS.sp500),getMarket(SYMBOLS.tsx)]);
  if(calendar.sp500.open&&spResult.status==='rejected')throw spResult.reason;
  if(calendar.tsx.open&&tsxResult.status==='rejected')throw tsxResult.reason;
  const sp500=spResult.status==='fulfilled'?spResult.value:{price:null,pct:0,bars:[]};
  const tsx=tsxResult.status==='fulfilled'?tsxResult.value:{price:null,pct:0,bars:[]};
  const tsxByTs=new Map(tsx.bars.map(b=>[b.ts,b]));
  const history5m=(calendar.sp500.open?sp500.bars:tsx.bars).map(b=>{
   const sp=calendar.sp500.open?b.pct:0;
   const tsxPct=calendar.tsx.open?(calendar.sp500.open?tsxByTs.get(b.ts)?.pct:b.pct):0;
   return Number.isFinite(tsxPct)?{ts:b.ts,sp,tsx:tsxPct}:null;
  }).filter(Boolean);
  delete sp500.bars;delete tsx.bars;
  return res.status(200).json({ok:true,calendar,marketDate:date,sp500,tsx,history5m,fetchedAt:new Date().toISOString(),source:'Yahoo Finance via Vercel'});
 }catch(error){return res.status(502).json({ok:false,error:error instanceof Error?error.message:'Erreur inconnue.'});}
};
