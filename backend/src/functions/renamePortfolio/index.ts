// PUT /portfolio/{portfolioId}
// Rename an existing portfolio.
// ConditionExpression ensures users can only rename their own portfolios —
// the condition fails (404) if the item doesn't exist or belongs to another user.

import { UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { ddb, TABLE_NAME, response } from '../../lib/db';
import { parseBody, internalError } from '../../lib/validate';

export const handler = async (event: any) => {
  try {
    const userId = event.requestContext?.authorizer?.jwt?.claims?.sub;
    if (!userId) return response(401, { error: 'Unauthorized' });

    const portfolioId = event.pathParameters?.portfolioId;
    if (!portfolioId) return response(400, { error: 'portfolioId path parameter required' });

    const parsed = parseBody(event);
    if (!parsed.ok) return parsed.res;
    const { name } = parsed.body;

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return response(400, { error: 'Required: name (non-empty string)' });
    }
    if (name.trim().length > 64) {
      return response(400, { error: 'name must be 64 characters or fewer' });
    }

    await ddb.send(new UpdateCommand({
      TableName: TABLE_NAME,
      Key: {
        PK: `USER#${userId}`,
        SK: `PORTFOLIO#${portfolioId}`,
      },
      // attribute_exists(SK) ensures the item belongs to this user —
      // a different user's portfolio would be under a different PK and not found here
      ConditionExpression: 'attribute_exists(SK)',
      UpdateExpression: 'SET #n = :name, updatedAt = :updatedAt',
      ExpressionAttributeNames: { '#n': 'name' },
      ExpressionAttributeValues: {
        ':name': name.trim(),
        ':updatedAt': new Date().toISOString(),
      },
    }));

    return response(200, { portfolioId, name: name.trim() });
  } catch (err: any) {
    if (err.name === 'ConditionalCheckFailedException') {
      return response(404, { error: 'Portfolio not found' });
    }
    return internalError(err);
  }
};
