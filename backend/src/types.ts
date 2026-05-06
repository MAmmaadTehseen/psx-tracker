// Shared TypeScript types used across all Lambda functions

export interface StockMetadata {
  ticker: string;
  name: string;
  sector: string;
  marketCap?: number;
  pe?: number;
  eps?: number;
  bookValue?: number;
  roe?: number;
  roa?: number;
}

export interface StockPrice {
  ticker: string;
  date: string;       // ISO date string YYYY-MM-DD
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  change: number;     // absolute change from previous close
  changePct: number;  // percentage change
}

export interface Dividend {
  ticker: string;
  announceDate: string;
  exDate: string;
  payDate: string;
  amount: number;     // PKR per share
  type: 'cash' | 'bonus' | 'right';
}

export interface Portfolio {
  portfolioId: string;
  userId: string;
  name: string;
  createdAt: string;
}

export interface Trade {
  tradeId: string;
  portfolioId: string;
  userId: string;
  ticker: string;
  type: 'buy' | 'sell';
  date: string;        // YYYY-MM-DD
  quantity: number;
  pricePerShare: number;
  brokerage: number;   // commission fee in PKR
  createdAt: string;
}

// What the Lambda receives from API Gateway
export interface LambdaEvent {
  pathParameters?: Record<string, string>;
  queryStringParameters?: Record<string, string>;
  body?: string;
  requestContext: {
    authorizer?: {
      jwt?: {
        claims: {
          sub: string;  // Cognito user ID
          email: string;
        };
      };
    };
  };
}

// Standard response shape all Lambdas return
export interface ApiResponse {
  statusCode: number;
  headers: Record<string, string>;
  body: string;
}
