// DELETE /portfolio/trade/:tradeId
// Remove a trade from a portfolio.
// Protected — requires valid Cognito JWT.

import { DeleteCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';
import { ddb, TABLE_NAME, response } from '../../lib/db';

export const handler = async (event: any) => {
  const userId = event.requestContext?.authorizer?.jwt?.claims?.sub;
  if (!userId) return response(401, { error: 'Unauthorized' });

  const tradeId = event.pathParameters?.tradeId;
  const portfolioId = event.queryStringParameters?.portfolioId;

  if (!tradeId || !portfolioId) {
    return response(400, { error: 'tradeId (path) and portfolioId (query) are required' });
  }

  // Delete is by PK + SK. We verify the userId in the PK so users
  // can only delete their own trades — not anyone else's.
  await ddb.send(new DeleteCommand({
    TableName: TABLE_NAME,
    Key: {
      PK: `USER#${userId}`,
      SK: `TRADE#${portfolioId}#${tradeId}`,
    },
    // Only delete if the item exists (prevents silent no-ops from typos)
    ConditionExpression: 'attribute_exists(PK)',
  }));

  return response(200, { message: 'Trade deleted' });
};
