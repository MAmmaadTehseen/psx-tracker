// GET /stocks
// Returns all stock metadata (tickers, names, sectors).
// Public endpoint — no auth required.

import { ScanCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';
import { ddb, TABLE_NAME, response } from '../../lib/db';

export const handler = async (event: any) => {
  const sector = event.queryStringParameters?.sector;

  if (sector) {
    // If ?sector=CEMENT, query the sector-index GSI we defined in database-stack.ts
    // This shows why we added that GSI — without it we'd have to scan the whole table
    const result = await ddb.send(new QueryCommand({
      TableName: TABLE_NAME,
      IndexName: 'sector-index',
      KeyConditionExpression: 'sector = :sector AND begins_with(SK, :prefix)',
      ExpressionAttributeValues: {
        ':sector': sector,
        ':prefix': 'METADATA',
      },
    }));
    return response(200, { stocks: result.Items ?? [] });
  }

  // No filter: scan all METADATA items
  // Scan reads every item in the table — use sparingly on large tables,
  // but fine here because we have ~500 stocks which is tiny for DynamoDB
  const result = await ddb.send(new ScanCommand({
    TableName: TABLE_NAME,
    FilterExpression: 'SK = :sk',
    ExpressionAttributeValues: { ':sk': 'METADATA' },
  }));

  return response(200, { stocks: result.Items ?? [] });
};
