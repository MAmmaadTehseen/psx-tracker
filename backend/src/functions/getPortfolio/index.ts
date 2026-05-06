// GET /portfolio?portfolioId=xyz
// Returns all trades for the authenticated user's portfolio,
// calculates P&L against current prices.
// Protected — requires valid Cognito JWT.

import { QueryCommand, GetCommand } from '@aws-sdk/lib-dynamodb';
import { ddb, TABLE_NAME, response } from '../../lib/db';

export const handler = async (event: any) => {
  // The userId comes from the Cognito JWT, not from the request body.
  // API Gateway validates the JWT and passes the claims to the Lambda.
  // This prevents users from accessing each other's portfolios.
  const userId = event.requestContext?.authorizer?.jwt?.claims?.sub;
  if (!userId) return response(401, { error: 'Unauthorized' });

  const portfolioId = event.queryStringParameters?.portfolioId;

  // Get all portfolios for this user if no specific one requested
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

  // Get all trades for the specified portfolio
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

  // Get current prices for all unique tickers in this portfolio
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

  // Calculate holdings: group trades by ticker, compute avg cost + P&L
  const holdings = calculateHoldings(trades, currentPrices);

  return response(200, { portfolioId, holdings, trades });
};

function calculateHoldings(trades: any[], currentPrices: Record<string, number>) {
  const byTicker: Record<string, any> = {};

  // Process trades in chronological order for correct avg cost calculation
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
      // Sell: use average cost to calculate realized gain
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
