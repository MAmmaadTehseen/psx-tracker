// Thin wrapper around the AWS DynamoDB Document Client.
// The Document Client handles marshalling/unmarshalling — converting between
// JavaScript objects and DynamoDB's internal AttributeValue format.
// Without it you'd write: { name: { S: "ENGRO" } } instead of { name: "ENGRO" }

import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';

const client = new DynamoDBClient({});

// translateConfig controls how types are converted:
// marshallOptions.removeUndefinedValues = true removes undefined fields
// so DynamoDB doesn't complain about null attributes
export const ddb = DynamoDBDocumentClient.from(client, {
  marshallOptions: { removeUndefinedValues: true },
});

export const TABLE_NAME = process.env.TABLE_NAME!;

// Helper to build a consistent API response with CORS headers
export function response(statusCode: number, body: unknown) {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
    body: JSON.stringify(body),
  };
}
