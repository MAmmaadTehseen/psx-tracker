// GET /stocks/:ticker/dividends
// Returns dividend history for a stock.
// Public endpoint — no auth required.

import { QueryCommand } from '@aws-sdk/lib-dynamodb';
import { ddb, TABLE_NAME, response } from '../../lib/db';
import { isValidTicker, internalError } from '../../lib/validate';

export const handler = async (event: any) => {
  try {
    const ticker = event.pathParameters?.ticker?.toUpperCase();
    if (!ticker || !isValidTicker(ticker)) {
      return response(400, { error: 'Invalid ticker' });
    }

    const result = await ddb.send(new QueryCommand({
      TableName: TABLE_NAME,
      KeyConditionExpression: 'PK = :pk AND begins_with(SK, :prefix)',
      ExpressionAttributeValues: {
        ':pk': `STOCK#${ticker}`,
        ':prefix': 'DIV#',
      },
      ScanIndexForward: false,  // newest dividends first
    }));

    const dividends = (result.Items ?? []).map(i => ({
      exDate: i.SK.replace('DIV#', ''),
      announceDate: i.announceDate,
      payDate: i.payDate,
      amount: i.amount,
      type: i.type,
    }));

    return response(200, { ticker, dividends });
  } catch (err) {
    return internalError(err);
  }
};
