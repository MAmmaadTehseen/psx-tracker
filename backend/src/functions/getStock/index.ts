// GET /stocks/:ticker
// Returns stock metadata + recent price history.
// Public endpoint — no auth required.

import { QueryCommand } from '@aws-sdk/lib-dynamodb';
import { ddb, TABLE_NAME, response } from '../../lib/db';
import { parseDays, isValidTicker, internalError } from '../../lib/validate';

export const handler = async (event: any) => {
  try {
    const ticker = event.pathParameters?.ticker?.toUpperCase();
    if (!ticker || !isValidTicker(ticker)) {
      return response(400, { error: 'Invalid ticker' });
    }

    // parseDays guards against NaN, negative values, and absurdly large numbers
    const limit = parseDays(event.queryStringParameters?.days, 30, 365);

    const result = await ddb.send(new QueryCommand({
      TableName: TABLE_NAME,
      KeyConditionExpression: 'PK = :pk',
      ExpressionAttributeValues: { ':pk': `STOCK#${ticker}` },
      ScanIndexForward: false,
      Limit: limit + 10,  // +10 for metadata + dividend items mixed in
    }));

    const items = result.Items ?? [];
    const metadata = items.find(i => i.SK === 'METADATA');
    const prices = items
      .filter(i => i.SK.startsWith('PRICE#'))
      .slice(0, limit)
      .map(i => ({
        date: i.SK.replace('PRICE#', ''),
        open: i.open,
        high: i.high,
        low: i.low,
        close: i.close,
        volume: i.volume,
        change: i.change,
        changePct: i.changePct,
      }));

    if (!metadata) return response(404, { error: `Stock ${ticker} not found` });

    return response(200, { stock: metadata, prices });
  } catch (err) {
    return internalError(err);
  }
};
