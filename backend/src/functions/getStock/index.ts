// GET /stocks/:ticker
// Returns stock metadata + recent price history.
// Public endpoint — no auth required.

import { QueryCommand } from '@aws-sdk/lib-dynamodb';
import { ddb, TABLE_NAME, response } from '../../lib/db';

export const handler = async (event: any) => {
  const ticker = event.pathParameters?.ticker?.toUpperCase();
  if (!ticker) return response(400, { error: 'ticker is required' });

  const days = parseInt(event.queryStringParameters?.days ?? '30');
  const limit = Math.min(days, 365);  // cap at 1 year per request

  // Query all items for this stock (metadata + prices + dividends)
  // A single Query by PK is extremely cheap and fast in DynamoDB
  const result = await ddb.send(new QueryCommand({
    TableName: TABLE_NAME,
    KeyConditionExpression: 'PK = :pk',
    ExpressionAttributeValues: { ':pk': `STOCK#${ticker}` },
    // ScanIndexForward: false = newest first (DESC sort by SK)
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
};
