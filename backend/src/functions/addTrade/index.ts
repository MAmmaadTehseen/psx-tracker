// POST /portfolio/trade
// Add a buy or sell trade to a portfolio.
// Protected — requires valid Cognito JWT.

import { PutCommand, GetCommand } from '@aws-sdk/lib-dynamodb';
import { ddb, TABLE_NAME, response } from '../../lib/db';
import { randomUUID } from 'crypto';

export const handler = async (event: any) => {
  const userId = event.requestContext?.authorizer?.jwt?.claims?.sub;
  if (!userId) return response(401, { error: 'Unauthorized' });

  let body: any;
  try {
    body = JSON.parse(event.body ?? '{}');
  } catch {
    return response(400, { error: 'Invalid JSON body' });
  }

  const { portfolioId, ticker, type, date, quantity, pricePerShare, brokerage = 0 } = body;

  if (!portfolioId || !ticker || !type || !date || !quantity || !pricePerShare) {
    return response(400, {
      error: 'Required: portfolioId, ticker, type, date, quantity, pricePerShare',
    });
  }

  if (!['buy', 'sell'].includes(type)) {
    return response(400, { error: 'type must be "buy" or "sell"' });
  }

  if (quantity <= 0 || pricePerShare <= 0) {
    return response(400, { error: 'quantity and pricePerShare must be positive' });
  }

  const tradeId = randomUUID();

  // Store the trade in DynamoDB.
  // PK = USER#<userId> groups all data for this user together.
  // SK = TRADE#<portfolioId>#<tradeId> makes trades sortable by portfolio.
  await ddb.send(new PutCommand({
    TableName: TABLE_NAME,
    Item: {
      PK: `USER#${userId}`,
      SK: `TRADE#${portfolioId}#${tradeId}`,
      tradeId,
      portfolioId,
      userId,
      ticker: ticker.toUpperCase(),
      type,
      date,
      quantity: Number(quantity),
      pricePerShare: Number(pricePerShare),
      brokerage: Number(brokerage),
      createdAt: new Date().toISOString(),
    },
    // Prevent duplicate writes (idempotency)
    ConditionExpression: 'attribute_not_exists(PK)',
  }));

  return response(201, { tradeId, message: 'Trade added successfully' });
};
