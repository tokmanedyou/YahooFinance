import YahooFinance from 'yahoo-finance2';

const yahooFinance = new YahooFinance({
  suppressNotices: ['yahooSurvey'],
});

const TICKER = /^[A-Za-z0-9.^=-]{1,24}$/;

const TYPE_RU = {
  EQUITY: 'Акции',
  ETF: 'ETF',
  MUTUALFUND: 'Фонд',
  INDEX: 'Индекс',
  CURRENCY: 'Валюта',
  CRYPTOCURRENCY: 'Крипто',
};

const COUNTRY_RU = {
  'United States': 'США',
  China: 'Китай',
  'Hong Kong': 'Гонконг',
  Norway: 'Норвегия',
  Canada: 'Канада',
  Mexico: 'Мексика',
  Brazil: 'Бразилия',
  Sweden: 'Швеция',
  Ukraine: 'Украина',
};

// Yahoo names differ from the sheet's GICS labels. Unmapped stays null.
const SECTOR_SHEET = {
  Energy: 'Energy',
  'Basic Materials': 'Materials',
  Industrials: 'Industrials',
  'Consumer Cyclical': 'Consumer Discretionary',
  'Consumer Defensive': 'Consumer Staples',
  Healthcare: 'Health Care',
  'Financial Services': 'Financials',
  Technology: 'Information Technology',
  'Communication Services': 'Communication Services',
  Utilities: 'Utilities',
  'Real Estate': 'Real Estate',
};

export function cors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Content-Type', 'application/json');
}

export function rejectMethod(req, res) {
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return true;
  }
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' });
    return true;
  }
  return false;
}

export function readTicker(raw) {
  const ticker = String(raw || '').trim();
  if (!ticker || !TICKER.test(ticker)) return null;
  return ticker.toUpperCase();
}

function dayKey(d) {
  return d.toISOString().slice(0, 10);
}

export async function searchQuotes(query) {
  const q = String(query || '').trim();
  if (q.length < 1 || q.length > 80) {
    const err = new Error('Query must be 1–80 characters');
    err.status = 400;
    throw err;
  }
  const data = await yahooFinance.search(q);
  const seen = new Set();
  const quotes = [];
  for (const row of data.quotes || []) {
    if (!row.symbol || seen.has(row.symbol)) continue;
    seen.add(row.symbol);
    const type = row.quoteType || row.typeDisp || null;
    quotes.push({
      symbol: row.symbol,
      name: row.shortname || row.longname || null,
      type,
      type_ru: TYPE_RU[type] || null,
      exchange: row.exchDisp || row.exchange || null,
    });
  }
  return quotes;
}

export async function loadProfile(ticker) {
  const symbol = readTicker(ticker);
  if (!symbol) {
    const err = new Error('Invalid ticker');
    err.status = 400;
    throw err;
  }
  const q = await yahooFinance.quoteSummary(symbol, {
    modules: ['assetProfile', 'price', 'summaryProfile'],
  });
  if (!q?.price) {
    const err = new Error(`Ticker ${symbol} not found`);
    err.status = 404;
    throw err;
  }
  const sector = q.assetProfile?.sector || q.summaryProfile?.sector || null;
  const country = q.assetProfile?.country || q.summaryProfile?.country || null;
  const type = q.price.quoteType || null;
  return {
    symbol: q.price.symbol || symbol,
    name: q.price.longName || q.price.shortName || null,
    sector,
    sector_sheet: sector ? (SECTOR_SHEET[sector] || null) : null,
    industry: q.assetProfile?.industry || q.summaryProfile?.industry || null,
    country,
    country_ru: country ? (COUNTRY_RU[country] || null) : null,
    type,
    type_ru: TYPE_RU[type] || null,
    exchange: q.price.exchangeName || q.price.exchange || null,
    currency: q.price.currency || null,
  };
}

export async function closeOnDate(ticker, dateStr) {
  const symbol = readTicker(ticker);
  if (!symbol) {
    const err = new Error('Invalid ticker');
    err.status = 400;
    throw err;
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(dateStr || ''))) {
    const err = new Error('date must be YYYY-MM-DD');
    err.status = 400;
    throw err;
  }
  const target = new Date(`${dateStr}T00:00:00Z`);
  if (Number.isNaN(target.getTime())) {
    const err = new Error('Invalid date');
    err.status = 400;
    throw err;
  }
  const start = new Date(target);
  start.setUTCDate(start.getUTCDate() - 10);
  const end = new Date(target);
  end.setUTCDate(end.getUTCDate() + 1);
  const chart = await yahooFinance.chart(symbol, {
    period1: start,
    period2: end,
    interval: '1d',
  });
  const rows = (chart.quotes || [])
    .filter((r) => r.date && r.close != null)
    .map((r) => ({ date: dayKey(new Date(r.date)), close: r.close }))
    .filter((r) => r.date <= dateStr)
    .sort((a, b) => (a.date < b.date ? 1 : -1));
  if (!rows.length) {
    const err = new Error(`No close for ${symbol} on or before ${dateStr}`);
    err.status = 404;
    throw err;
  }
  const hit = rows[0];
  return {
    symbol,
    requested: dateStr,
    date: hit.date,
    close: hit.close,
    fallback: hit.date !== dateStr,
  };
}

export function sendError(res, error) {
  const status = error.status || 500;
  res.status(status).json({
    error: status === 500 ? 'Failed to fetch data' : error.message,
    details: status === 500 ? error.message : undefined,
  });
}
