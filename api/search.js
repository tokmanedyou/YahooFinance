import { cors, rejectMethod, searchQuotes, sendError } from './lib/yahoo.js';

export default async function handler(req, res) {
  cors(res);
  if (rejectMethod(req, res)) return;
  const q = req.query?.q;
  if (!q) {
    return res.status(400).json({
      error: 'Missing q parameter',
      example: '/api/search?q=Alibaba',
    });
  }
  try {
    const quotes = await searchQuotes(q);
    return res.status(200).json({ success: true, query: String(q).trim(), quotes });
  } catch (error) {
    return sendError(res, error);
  }
}
