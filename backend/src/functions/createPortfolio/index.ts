// POST /portfolio
// Create a new portfolio for the authenticated user.
// Protected — requires valid Cognito JWT.

import { PutCommand } from '@aws-sdk/lib-dynamodb';
import { ddb, TABLE_NAME, response } from '../../lib/db';
import { parseBody, internalError } from '../../lib/validate';
import { randomUUID } from 'crypto';

export const handler = async (event: any) => {
  try {
    const userId = event.requestContext?.authorizer?.jwt?.claims?.sub;
    if (!userId) return response(401, { error: 'Unauthorized' });

    const parsed = parseBody(event);
    if (!parsed.ok) return parsed.res;
    const { name } = parsed.body;

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return response(400, { error: 'Required: name (non-empty string)' });
    }

    if (name.trim().length > 64) {
      return response(400, { error: 'name must be 64 characters or fewer' });
    }

    const portfolioId = randomUUID();

    await ddb.send(new PutCommand({
      TableName: TABLE_NAME,
      Item: {
        PK: `USER#${userId}`,
        SK: `PORTFOLIO#${portfolioId}`,
        portfolioId,
        userId,
        name: name.trim(),
        createdAt: new Date().toISOString(),
      },
      ConditionExpression: 'attribute_not_exists(SK)',
    }));

    return response(201, { portfolioId, name: name.trim() });
  } catch (err) {
    return internalError(err);
  }
};
