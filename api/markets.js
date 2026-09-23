const SYMBOLS = {
  sp500: '^GSPC',
  tsx: '^GSPTSE',
};

async function getMarket(symbol) {
  const url =
    'https://query1.finance.yahoo.com/v8/finance/chart/' +
    encodeURIComponent(symbol) +
    '?interval=1m&range=1d&includePrePost=false';

  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0',
      Accept: 'application/json',
    },
    cache: 'no-store',
  });

  if (!response.ok) {
    throw new Error(`Yahoo Finance HTTP ${response.status} pour ${symbol}`);
  }

  const payload = await response.json();
  const result = payload?.chart?.result?.[0];
  const meta = result?.meta;

  if (!meta) {
    throw new Error(`Réponse Yahoo Finance invalide pour ${symbol}`);
  }

  const price = Number(meta.regularMarketPrice);
  const previousClose = Number(meta.chartPreviousClose ?? meta.previousClose);

  if (!Number.isFinite(price) || !Number.isFinite(previousClose) || previousClose === 0) {
    throw new Error(`Données de marché incomplètes pour ${symbol}`);
  }

  return {
    symbol,
    price,
    previousClose,
    pct: ((price - previousClose) / previousClose) * 100,
    marketTime: meta.regularMarketTime ?? null,
    currency: meta.currency ?? null,
  };
}

module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store, max-age=0');

  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ ok: false, error: 'Méthode non permise.' });
  }

  try {
    const [sp500, tsx] = await Promise.all([
      getMarket(SYMBOLS.sp500),
      getMarket(SYMBOLS.tsx),
    ]);

    return res.status(200).json({
      ok: true,
      sp500,
      tsx,
      fetchedAt: new Date().toISOString(),
      source: 'Yahoo Finance via Vercel',
    });
  } catch (error) {
    return res.status(502).json({
      ok: false,
      error: error instanceof Error ? error.message : 'Erreur inconnue.',
    });
  }
};
