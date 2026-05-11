// DELETE /portfolio/trade/:tradeId
// Remove a trade from a portfolio.
// Protected — requires valid Cognito JWT.

import { DeleteCommand } from '@aws-sdk/lib-dynamodb';
import { ddb, TABLE_NAME, response } from '../../lib/db';
import { internalError } from '../../lib/validate';

export const handler = async (event: any) => {
  try {
    const userId = event.requestContext?.authorizer?.jwt?.claims?.sub;
    if (!userId) return response(401, { error: 'Unauthorized' });

    const tradeId = event.pathParameters?.tradeId;
    const portfolioId = event.queryStringParameters?.portfolioId;

    if (!tradeId || !portfolioId) {
      return response(400, { error: 'tradeId (path) and portfolioId (query) are required' });
    }

    await ddb.send(new DeleteCommand({
      TableName: TABLE_NAME,
      Key: {
        PK: `USER#${userId}`,
        SK: `TRADE#${portfolioId}#${tradeId}`,
      },
      // Only delete if the item actually exists — returns 404 instead of silent no-op
      ConditionExpression: 'attribute_exists(PK)',
    }));

    return response(200, { message: 'Trade deleted' });
  } catch (err: any) {
    // ConditionalCheckFailedException means the trade doesn't exist (or belongs to another user)
    if (err?.name === 'ConditionalCheckFailedException') {
      return response(404, { error: 'Trade not found' });
    }
    return internalError(err);
  }
};
