// GET /portfolio?portfolioId=xyz
// Returns all trades for the authenticated user's portfolio,
// calculates P&L against current prices.
// Protected — requires valid Cognito JWT.

import { QueryCommand, GetCommand } from '@aws-sdk/lib-dynamodb';
import { ddb, TABLE_NAME, response } from '../../lib/db';
import { internalError } from '../../lib/validate';

export const handler = async (event: any) => {
  try {
    const userId = event.requestContext?.authorizer?.jwt?.claims?.sub;
    if (!userId) return response(401, { error: 'Unauthorized' });

    const portfolioId = event.queryStringParameters?.portfolioId;

    if (!portfolioId) {
      const result = await ddb.send(new QueryCommand({
        TableName: TABLE_NAME,
        KeyConditionExpression: 'PK = :pk AND begins_with(SK, :prefix)',
        ExpressionAttributeValues: {
          ':pk': `USER#${userId}`,
          ':prefix': 'PORTFOLIO#',
        },
      }));
      return response(200, { portfolios: result.Items ?? [] });
    }

    // Verify portfolio ownership before fetching trades
    const portfolioItem = await ddb.send(new GetCommand({
      TableName: TABLE_NAME,
      Key: { PK: `USER#${userId}`, SK: `PORTFOLIO#${portfolioId}` },
    }));
    if (!portfolioItem.Item) {
      return response(404, { error: 'Portfolio not found' });
    }

    const tradesResult = await ddb.send(new QueryCommand({
      TableName: TABLE_NAME,
      KeyConditionExpression: 'PK = :pk AND begins_with(SK, :prefix)',
      ExpressionAttributeValues: {
        ':pk': `USER#${userId}`,
        ':prefix': `TRADE#${portfolioId}#`,
      },
      ScanIndexForward: false,
    }));

    const trades = tradesResult.Items ?? [];

    const tickers = [...new Set(trades.map((t: any) => t.ticker))];
    const pricePromises = tickers.map(ticker =>
      ddb.send(new QueryCommand({
        TableName: TABLE_NAME,
        KeyConditionExpression: 'PK = :pk AND begins_with(SK, :prefix)',
        ExpressionAttributeValues: {
          ':pk': `STOCK#${ticker}`,
          ':prefix': 'PRICE#',
        },
        ScanIndexForward: false,
        Limit: 1,
      }))
    );

    const priceResults = await Promise.all(pricePromises);
    const currentPrices: Record<string, number> = {};
    tickers.forEach((ticker, i) => {
      const items = priceResults[i].Items ?? [];
      if (items.length > 0) currentPrices[ticker] = items[0].close;
    });

    const holdings = calculateHoldings(trades, currentPrices);

    return response(200, { portfolioId, holdings, trades });
  } catch (err) {
    return internalError(err);
  }
};

function calculateHoldings(trades: any[], currentPrices: Record<string, number>) {
  const byTicker: Record<string, any> = {};

  const sorted = [...trades].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
  );

  for (const trade of sorted) {
    if (!byTicker[trade.ticker]) {
      byTicker[trade.ticker] = { qty: 0, totalCost: 0, realizedGain: 0 };
    }
    const h = byTicker[trade.ticker];

    if (trade.type === 'buy') {
      const cost = trade.quantity * trade.pricePerShare + trade.brokerage;
      h.totalCost += cost;
      h.qty += trade.quantity;
    } else {
      const avgCost = h.qty > 0 ? h.totalCost / h.qty : 0;
      h.realizedGain += (trade.pricePerShare - avgCost) * trade.quantity - trade.brokerage;
      h.totalCost -= avgCost * trade.quantity;
      h.qty -= trade.quantity;
    }
  }

  return Object.entries(byTicker)
    .filter(([, h]) => (h as any).qty > 0)
    .map(([ticker, h]: [string, any]) => {
      const currentPrice = currentPrices[ticker] ?? 0;
      const avgCost = h.qty > 0 ? h.totalCost / h.qty : 0;
      const currentValue = currentPrice * h.qty;
      const unrealizedGain = currentValue - h.totalCost;
      return {
        ticker,
        qty: h.qty,
        avgCostPerShare: Math.round(avgCost * 100) / 100,
        totalCost: Math.round(h.totalCost * 100) / 100,
        currentPrice,
        currentValue: Math.round(currentValue * 100) / 100,
        unrealizedGain: Math.round(unrealizedGain * 100) / 100,
        unrealizedGainPct: h.totalCost > 0
          ? Math.round((unrealizedGain / h.totalCost) * 10000) / 100
          : 0,
        realizedGain: Math.round(h.realizedGain * 100) / 100,
      };
    });
}
