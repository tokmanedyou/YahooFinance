import { cors, rejectMethod, closeOnDate, sendError } from './lib/yahoo.js';

export default async function handler(req, res) {
  cors(res);
  if (rejectMethod(req, res)) return;
  const { ticker, date } = req.query || {};
  if (!ticker || !date) {
    return res.status(400).json({
      error: 'Missing ticker or date',
      example: '/api/history?ticker=HKDUSD=X&date=2025-03-10',
    });
  }
  try {
    const row = await closeOnDate(ticker, date);
    return res.status(200).json({ success: true, ...row });
  } catch (error) {
    return sendError(res, error);
  }
}
