// POST /portfolio/trade
// Add a buy or sell trade to a portfolio.
// Protected — requires valid Cognito JWT.

import { PutCommand, GetCommand } from '@aws-sdk/lib-dynamodb';
import { ddb, TABLE_NAME, response } from '../../lib/db';
import { parseBody, isValidDate, isValidTicker, internalError } from '../../lib/validate';
import { randomUUID } from 'crypto';

export const handler = async (event: any) => {
  try {
    const userId = event.requestContext?.authorizer?.jwt?.claims?.sub;
    if (!userId) return response(401, { error: 'Unauthorized' });

    const parsed = parseBody(event);
    if (!parsed.ok) return parsed.res;
    const { portfolioId, ticker, type, date, quantity, pricePerShare, brokerage = 0 } = parsed.body;

    if (!portfolioId || !ticker || !type || !date || !quantity || !pricePerShare) {
      return response(400, { error: 'Required: portfolioId, ticker, type, date, quantity, pricePerShare' });
    }

    if (!['buy', 'sell'].includes(type)) {
      return response(400, { error: 'type must be "buy" or "sell"' });
    }

    const upperTicker = String(ticker).toUpperCase();
    if (!isValidTicker(upperTicker)) {
      return response(400, { error: 'ticker must be 1–10 alphanumeric characters' });
    }

    if (!isValidDate(String(date))) {
      return response(400, { error: 'date must be YYYY-MM-DD format' });
    }

    if (Number(quantity) <= 0 || Number(pricePerShare) <= 0) {
      return response(400, { error: 'quantity and pricePerShare must be positive' });
    }

    // Verify the portfolio belongs to this user — prevents adding trades to
    // another user's portfolio by guessing a portfolioId.
    const portfolioItem = await ddb.send(new GetCommand({
      TableName: TABLE_NAME,
      Key: { PK: `USER#${userId}`, SK: `PORTFOLIO#${portfolioId}` },
    }));
    if (!portfolioItem.Item) {
      return response(404, { error: 'Portfolio not found' });
    }

    const tradeId = randomUUID();

    await ddb.send(new PutCommand({
      TableName: TABLE_NAME,
      Item: {
        PK: `USER#${userId}`,
        SK: `TRADE#${portfolioId}#${tradeId}`,
        tradeId,
        portfolioId,
        userId,
        ticker: upperTicker,
        type,
        date,
        quantity: Number(quantity),
        pricePerShare: Number(pricePerShare),
        brokerage: Number(brokerage),
        createdAt: new Date().toISOString(),
      },
      ConditionExpression: 'attribute_not_exists(SK)',
    }));

    return response(201, { tradeId, message: 'Trade added successfully' });
  } catch (err) {
    return internalError(err);
  }
};
