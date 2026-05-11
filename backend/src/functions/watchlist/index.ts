// GET    /watchlist            → list user's watched tickers
// POST   /watchlist            → { ticker } add to watchlist
// DELETE /watchlist/{ticker}   → remove from watchlist
// All routes are JWT-protected — userId comes from API Gateway claims.

import { QueryCommand, PutCommand, DeleteCommand } from '@aws-sdk/lib-dynamodb';
import { ddb, TABLE_NAME, response } from '../../lib/db';
import { parseBody, isValidTicker, internalError } from '../../lib/validate';

export const handler = async (event: any) => {
  try {
    const userId = event.requestContext?.authorizer?.jwt?.claims?.sub;
    if (!userId) return response(401, { error: 'Unauthorized' });

    const method = event.requestContext?.http?.method ?? event.httpMethod;

    if (method === 'GET') {
      const result = await ddb.send(new QueryCommand({
        TableName: TABLE_NAME,
        KeyConditionExpression: 'PK = :pk AND begins_with(SK, :prefix)',
        ExpressionAttributeValues: {
          ':pk': `USER#${userId}`,
          ':prefix': 'WATCH#',
        },
      }));
      const tickers = (result.Items ?? []).map((i) => i.SK.replace('WATCH#', ''));
      return response(200, { tickers });
    }

    if (method === 'POST') {
      const parsed = parseBody(event);
      if (!parsed.ok) return parsed.res;
      const ticker = parsed.body.ticker?.toString().trim().toUpperCase();
      if (!ticker || !isValidTicker(ticker)) {
        return response(400, { error: 'ticker must be 1–10 alphanumeric characters' });
      }

      await ddb.send(new PutCommand({
        TableName: TABLE_NAME,
        Item: {
          PK: `USER#${userId}`,
          SK: `WATCH#${ticker}`,
          ticker,
          addedAt: new Date().toISOString(),
        },
      }));
      return response(200, { ticker, watching: true });
    }

    if (method === 'DELETE') {
      const ticker = event.pathParameters?.ticker?.toUpperCase();
      if (!ticker || !isValidTicker(ticker)) {
        return response(400, { error: 'ticker must be 1–10 alphanumeric characters' });
      }

      await ddb.send(new DeleteCommand({
        TableName: TABLE_NAME,
        Key: { PK: `USER#${userId}`, SK: `WATCH#${ticker}` },
      }));
      return response(200, { ticker, watching: false });
    }

    return response(405, { error: 'Method not allowed' });
  } catch (err) {
    return internalError(err);
  }
};
