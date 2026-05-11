// DELETE /portfolio/{portfolioId}
// Delete a portfolio and all its trades.
// Protected — requires valid Cognito JWT.
//
// Why delete trades too: leaving orphaned TRADE# items for a deleted portfolio
// wastes RCUs on every portfolio list scan and leaks user data.

import { QueryCommand, DeleteCommand, BatchWriteCommand } from '@aws-sdk/lib-dynamodb';
import { ddb, TABLE_NAME, response } from '../../lib/db';
import { internalError } from '../../lib/validate';

export const handler = async (event: any) => {
  try {
    const userId = event.requestContext?.authorizer?.jwt?.claims?.sub;
    if (!userId) return response(401, { error: 'Unauthorized' });

    const portfolioId = event.pathParameters?.portfolioId;
    if (!portfolioId) return response(400, { error: 'portfolioId path parameter required' });

    const pk = `USER#${userId}`;

    // Delete the portfolio item — idempotent: no error if already gone
    await ddb.send(new DeleteCommand({
      TableName: TABLE_NAME,
      Key: { PK: pk, SK: `PORTFOLIO#${portfolioId}` },
    }));

    // Query all trade keys for this portfolio
    const tradesResult = await ddb.send(new QueryCommand({
      TableName: TABLE_NAME,
      KeyConditionExpression: 'PK = :pk AND begins_with(SK, :prefix)',
      ExpressionAttributeValues: {
        ':pk': pk,
        ':prefix': `TRADE#${portfolioId}#`,
      },
      ProjectionExpression: 'PK, SK',
    }));

    const trades = tradesResult.Items ?? [];

    if (trades.length > 0) {
      await batchDeleteWithRetry(trades as { PK: string; SK: string }[]);
    }

    return response(200, { deleted: true, tradesRemoved: trades.length });
  } catch (err) {
    return internalError(err);
  }
};

// BatchWrite max 25 items per call. DynamoDB can return UnprocessedItems under
// heavy load — we retry up to 3 times with exponential backoff.
async function batchDeleteWithRetry(keys: { PK: string; SK: string }[]) {
  let remaining = keys;
  let attempt = 0;

  while (remaining.length > 0 && attempt < 3) {
    const chunks: { PK: string; SK: string }[][] = [];
    for (let i = 0; i < remaining.length; i += 25) {
      chunks.push(remaining.slice(i, i + 25));
    }

    const results = await Promise.all(
      chunks.map(chunk =>
        ddb.send(new BatchWriteCommand({
          RequestItems: {
            [TABLE_NAME]: chunk.map(item => ({
              DeleteRequest: { Key: { PK: item.PK, SK: item.SK } },
            })),
          },
        }))
      )
    );

    // Collect any items DynamoDB couldn't process this round
    remaining = results.flatMap(r =>
      (r.UnprocessedItems?.[TABLE_NAME] ?? []).map((req: any) => req.DeleteRequest.Key)
    );

    if (remaining.length > 0) {
      attempt++;
      // Exponential backoff: 200ms, 400ms, 800ms
      await new Promise(resolve => setTimeout(resolve, 200 * Math.pow(2, attempt - 1)));
    }
  }
}
