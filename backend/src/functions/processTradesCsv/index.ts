// POST /portfolio/import
// Reads a previously-uploaded CSV from S3 and bulk-inserts trades into DynamoDB.
//
// Flow:
//   1. Client calls GET /upload-url to get a pre-signed S3 PUT URL
//   2. Client uploads the CSV file directly to S3
//   3. Client calls POST /portfolio/import with { portfolioId, key }
//   4. This Lambda reads the file from S3, parses it, validates rows, writes trades
//
// CSV format (header row required):
//   ticker,type,date,quantity,pricePerShare,brokerage
//   ENGRO,buy,2025-01-15,100,285.50,150
//   LUCK,sell,2025-03-10,50,480.00,75
//
// Protected — requires valid Cognito JWT.

import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import { BatchWriteCommand, GetCommand } from '@aws-sdk/lib-dynamodb';
import { ddb, TABLE_NAME, response } from '../../lib/db';
import { parseBody, isValidDate, isValidTicker, internalError } from '../../lib/validate';
import { randomUUID } from 'crypto';

const s3 = new S3Client({});
const BUCKET = process.env.UPLOADS_BUCKET!;
const MAX_ROWS = 500;

export const handler = async (event: any) => {
  try {
    const userId = event.requestContext?.authorizer?.jwt?.claims?.sub;
    if (!userId) return response(401, { error: 'Unauthorized' });

    const parsed = parseBody(event);
    if (!parsed.ok) return parsed.res;
    const { portfolioId, key } = parsed.body;

    if (!portfolioId || !key) {
      return response(400, { error: 'Required: portfolioId, key' });
    }

    // Verify portfolio ownership — prevents importing into someone else's portfolio
    const portfolioItem = await ddb.send(new GetCommand({
      TableName: TABLE_NAME,
      Key: { PK: `USER#${userId}`, SK: `PORTFOLIO#${portfolioId}` },
    }));
    if (!portfolioItem.Item) {
      return response(404, { error: 'Portfolio not found' });
    }

    // The key must be under the user's own S3 prefix — prevents reading other users' files
    const expectedPrefix = `uploads/${userId}/`;
    if (!key.startsWith(expectedPrefix)) {
      return response(403, { error: 'Access denied to this file' });
    }

    // Fetch the CSV from S3
    const s3Obj = await s3.send(new GetObjectCommand({ Bucket: BUCKET, Key: key }));
    const csvText = await streamToString(s3Obj.Body as any);

    const { trades, errors } = parseCsv(csvText, portfolioId, userId);

    if (trades.length === 0) {
      return response(400, { error: 'No valid rows found', errors });
    }

    // Batch-write in chunks of 25 (DynamoDB limit)
    const chunks: any[][] = [];
    for (let i = 0; i < trades.length; i += 25) {
      chunks.push(trades.slice(i, i + 25));
    }

    await Promise.all(
      chunks.map(chunk =>
        ddb.send(new BatchWriteCommand({
          RequestItems: {
            [TABLE_NAME]: chunk.map(item => ({ PutRequest: { Item: item } })),
          },
        }))
      )
    );

    return response(200, {
      imported: trades.length,
      skipped: errors.length,
      errors,
    });
  } catch (err) {
    return internalError(err);
  }
};

function parseCsv(
  csv: string,
  portfolioId: string,
  userId: string
): { trades: any[]; errors: { row: number; reason: string }[] } {
  const lines = csv.split('\n').map(l => l.trim()).filter(Boolean);
  if (lines.length < 2) return { trades: [], errors: [{ row: 0, reason: 'File has no data rows' }] };

  // Normalize header to lowercase for case-insensitive matching
  const header = lines[0].toLowerCase().split(',').map(h => h.trim());
  const col = (name: string) => header.indexOf(name);

  const required = ['ticker', 'type', 'date', 'quantity', 'pricepershare'];
  const missing = required.filter(r => col(r) === -1);
  if (missing.length > 0) {
    return { trades: [], errors: [{ row: 0, reason: `Missing columns: ${missing.join(', ')}` }] };
  }

  const trades: any[] = [];
  const errors: { row: number; reason: string }[] = [];

  for (let i = 1; i < Math.min(lines.length, MAX_ROWS + 1); i++) {
    const cells = lines[i].split(',').map(c => c.trim());
    const get = (name: string) => cells[col(name)] ?? '';

    const ticker = get('ticker').toUpperCase();
    const type = get('type').toLowerCase();
    const date = get('date');
    const quantity = parseFloat(get('quantity'));
    const pricePerShare = parseFloat(get('pricepershare'));
    const brokerage = parseFloat(get('brokerage') || '0');

    if (!isValidTicker(ticker)) {
      errors.push({ row: i, reason: `Invalid ticker: ${ticker}` });
      continue;
    }
    if (!['buy', 'sell'].includes(type)) {
      errors.push({ row: i, reason: `type must be buy or sell, got: ${type}` });
      continue;
    }
    if (!isValidDate(date)) {
      errors.push({ row: i, reason: `Invalid date: ${date} (expected YYYY-MM-DD)` });
      continue;
    }
    if (isNaN(quantity) || quantity <= 0) {
      errors.push({ row: i, reason: `Invalid quantity: ${get('quantity')}` });
      continue;
    }
    if (isNaN(pricePerShare) || pricePerShare <= 0) {
      errors.push({ row: i, reason: `Invalid pricePerShare: ${get('pricepershare')}` });
      continue;
    }

    const tradeId = randomUUID();
    trades.push({
      PK: `USER#${userId}`,
      SK: `TRADE#${portfolioId}#${tradeId}`,
      tradeId,
      portfolioId,
      userId,
      ticker,
      type,
      date,
      quantity,
      pricePerShare,
      brokerage: isNaN(brokerage) ? 0 : brokerage,
      createdAt: new Date().toISOString(),
    });
  }

  return { trades, errors };
}

async function streamToString(stream: NodeJS.ReadableStream): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of stream) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks).toString('utf-8');
}
