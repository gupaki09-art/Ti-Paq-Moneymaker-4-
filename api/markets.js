const SYMBOLS={sp500:'^GSPC',tsx:'^GSPTSE'};
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
 for(let i=0;i<timestamps.length;i++){const close=Number(closes[i]);if(Number.isFinite(close))bars.push({ts:timestamps[i],price:close,pct:((close-previousClose)/previousClose)*100});}
 return{symbol,price,previousClose,pct:((price-previousClose)/previousClose)*100,marketTime:meta.regularMarketTime??null,currency:meta.currency??null,bars};
}
module.exports=async function handler(req,res){
 res.setHeader('Cache-Control','no-store, max-age=0');
 if(req.method!=='GET'){res.setHeader('Allow','GET');return res.status(405).json({ok:false,error:'Méthode non permise.'});}
 try{
  const[sp500,tsx]=await Promise.all([getMarket(SYMBOLS.sp500),getMarket(SYMBOLS.tsx)]);
  const tsxByTs=new Map(tsx.bars.map(b=>[b.ts,b]));
  const history5m=sp500.bars.map(s=>{const t=tsxByTs.get(s.ts);return t?{ts:s.ts,sp:s.pct,tsx:t.pct}:null}).filter(Boolean);
  delete sp500.bars;delete tsx.bars;
  return res.status(200).json({ok:true,sp500,tsx,history5m,fetchedAt:new Date().toISOString(),source:'Yahoo Finance via Vercel'});
 }catch(error){return res.status(502).json({ok:false,error:error instanceof Error?error.message:'Erreur inconnue.'});}
};
