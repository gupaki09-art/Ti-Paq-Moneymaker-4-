// Independent daily close recorder. Requires no phone or browser session.
const fs=require('node:fs');
const path=require('node:path');
const zone='America/New_York';
const now=new Date();
const parts=Object.fromEntries(new Intl.DateTimeFormat('en-US',{timeZone:zone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23',weekday:'short'}).formatToParts(now).map(p=>[p.type,p.value]));
if(parts.hour!=='16'||parts.minute!=='35'||['Sat','Sun'].includes(parts.weekday)){console.log('Not the 16:35 NY archive window; skip');process.exit(0)}
const day=`${parts.year}-${parts.month}-${parts.day}`;
const symbols={sp500:'%5EGSPC',tsx:'%5EGSPTSE'};
async function quote(symbol){
 const url=`https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=5m&range=5d&includePrePost=false`;
 const res=await fetch(url,{headers:{'User-Agent':'Mozilla/5.0','Accept':'application/json'}});
 if(!res.ok)throw Error('Market data HTTP '+res.status);
 const result=(await res.json()).chart?.result?.[0];
 const meta=result?.meta;
 const ts=Number(meta?.regularMarketTime);
 if(!ts)throw Error('Missing market timestamp');
 const quoteDay=new Intl.DateTimeFormat('en-CA',{timeZone:zone,year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(ts*1000));
 if(quoteDay!==day)throw Error('Stale quote for '+symbol+': '+quoteDay);
 const price=Number(meta.regularMarketPrice),prev=Number(meta.chartPreviousClose??meta.previousClose);
 if(!Number.isFinite(price)||!Number.isFinite(prev)||prev<=0)throw Error('Invalid price');
 return {pct:(price/prev-1)*100,price,marketTime:ts};
}
(async()=>{
 const [sp,tsx]=await Promise.all([quote(symbols.sp500),quote(symbols.tsx)]);
 const estimated=Math.round(1049.29333074*sp.pct+1035.87642009*tsx.pct);
 const file=path.join(__dirname,'../data/final-closes.json');
 const archive=JSON.parse(fs.readFileSync(file,'utf8'));
 if(archive[day]){console.log('Already archived: '+day);return}
 archive[day]={estimated,sp:sp.pct,tsx:tsx.pct,source:'Yahoo Finance close snapshot at 16:35 NY',recordedAt:now.toISOString(),kind:'server-reconstructed-close'};
 fs.writeFileSync(file,JSON.stringify(archive,null,2)+'\n');
 console.log('Archived '+day+' estimated '+estimated);
})().catch(e=>{console.error(e);process.exitCode=1});
