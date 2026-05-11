// GET /stocks
// Returns all stock metadata (tickers, names, sectors).
// Supports ?sector=CEMENT for filtered results.
// Supports ?page=2 pagination for the full scan (100 stocks per page).
// Public endpoint — no auth required.

import { ScanCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';
import { ddb, TABLE_NAME, response } from '../../lib/db';
import { internalError } from '../../lib/validate';

// Only return the fields the UI actually needs — reduces payload size and RCU cost
const PROJECTION = 'ticker, #n, sector, close, changePct, marketCap, pe';

export const handler = async (event: any) => {
  try {
    const { sector, nextToken } = event.queryStringParameters ?? {};

    if (sector) {
      const result = await ddb.send(new QueryCommand({
        TableName: TABLE_NAME,
        IndexName: 'sector-index',
        KeyConditionExpression: 'sector = :sector AND begins_with(SK, :prefix)',
        ExpressionAttributeValues: {
          ':sector': sector,
          ':prefix': 'METADATA',
        },
        ProjectionExpression: PROJECTION,
        ExpressionAttributeNames: { '#n': 'name' },  // 'name' is a DynamoDB reserved word
      }));
      return response(200, { stocks: result.Items ?? [] });
    }

    // Full scan with pagination. Each page returns up to 200 stocks.
    // The client passes nextToken (a base64-encoded LastEvaluatedKey) to get the next page.
    // For ~500 PSX stocks this is at most 3 pages — well within free tier.
    const exclusiveStartKey = nextToken
      ? JSON.parse(Buffer.from(nextToken, 'base64').toString('utf-8'))
      : undefined;

    const result = await ddb.send(new ScanCommand({
      TableName: TABLE_NAME,
      FilterExpression: 'SK = :sk',
      ExpressionAttributeValues: { ':sk': 'METADATA' },
      ProjectionExpression: PROJECTION,
      ExpressionAttributeNames: { '#n': 'name' },
      Limit: 500,  // reads 500 items from the table per page (not the same as 500 results after filter)
      ExclusiveStartKey: exclusiveStartKey,
    }));

    const responseBody: Record<string, unknown> = { stocks: result.Items ?? [] };
    if (result.LastEvaluatedKey) {
      responseBody.nextToken = Buffer.from(
        JSON.stringify(result.LastEvaluatedKey)
      ).toString('base64');
    }

    return response(200, responseBody);
  } catch (err) {
    return internalError(err);
  }
};
