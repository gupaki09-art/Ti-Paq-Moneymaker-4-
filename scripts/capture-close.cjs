const fs=require('node:fs');
const url=process.env.MARKETS_URL||'https://ti-paq-moneymaker-4-gupaki09-7967.vercel.app/api/markets';
const now=new Date();
const parts=Object.fromEntries(new Intl.DateTimeFormat('en-CA',{timeZone:'America/Toronto',year:'numeric',month:'2-digit',day:'2-digit',weekday:'short',hour:'2-digit',minute:'2-digit',hour12:false}).formatToParts(now).map(p=>[p.type,p.value]));
const date=parts.year+'-'+parts.month+'-'+parts.day;
const minutes=Number(parts.hour)*60+Number(parts.minute);
if(['Sat','Sun'].includes(parts.weekday)||minutes<980||minutes>1100){console.log('Outside closing capture window',date,parts.hour,parts.minute);process.exit(0)}
const modelMatch=fs.readFileSync('index.html','utf8').match(/\bSPK=(\d+(?:\.\d+)?),TSK=(\d+(?:\.\d+)?)/);
if(!modelMatch)throw Error('Main calibration coefficients unavailable: refusing to archive');
const SPK=Number(modelMatch[1]),TSK=Number(modelMatch[2]);
const file='data/final-closes.json';
const saved=fs.existsSync(file)?JSON.parse(fs.readFileSync(file,'utf8')):{};
if(saved[date]){console.log('Already recorded',date);process.exit(0)}
(async()=>{
 const response=await fetch(url,{headers:{'cache-control':'no-cache'}});
 if(!response.ok)throw Error('Market endpoint HTTP '+response.status);
 const data=await response.json();
 if(!data.ok||![data.sp500?.pct,data.tsx?.pct].every(Number.isFinite))throw Error('Missing validated index data');
 const spOpen=data.calendar?.sp500?.open!==false,tsxOpen=data.calendar?.tsx?.open!==false;
 if(!spOpen&&!tsxOpen){console.log('Both markets closed');return}
 const sp=spOpen?data.sp500.pct:0,tsx=tsxOpen?data.tsx.pct:0;
 const amount=Math.round(sp*SPK+tsx*TSK);
 saved[date]={estimated:amount,sp,tsx,spOpen,tsxOpen,capturedAt:now.toISOString(),source:data.source||'Vercel',model:'SPK='+SPK+';TSK='+TSK,status:'post-close-snapshot'};
 fs.mkdirSync('data',{recursive:true});fs.writeFileSync(file,JSON.stringify(saved,null,2)+'\n');
 console.log('Saved',date,amount);
})().catch(e=>{console.error(e);process.exitCode=1});
