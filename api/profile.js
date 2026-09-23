import { cors, rejectMethod, loadProfile, sendError } from './lib/yahoo.js';

export default async function handler(req, res) {
  cors(res);
  if (rejectMethod(req, res)) return;
  const ticker = req.query?.ticker;
  if (!ticker) {
    return res.status(400).json({
      error: 'Missing ticker parameter',
      example: '/api/profile?ticker=9988.HK',
    });
  }
  try {
    const profile = await loadProfile(ticker);
    return res.status(200).json({ success: true, ...profile });
  } catch (error) {
    return sendError(res, error);
  }
}
