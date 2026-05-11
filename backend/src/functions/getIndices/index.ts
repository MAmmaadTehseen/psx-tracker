// GET /indices
// Returns live values for KSE-100, KSE-30, KMI-30.
// Public endpoint — no auth required.

import { BatchGetCommand } from '@aws-sdk/lib-dynamodb';
import { ddb, TABLE_NAME, response } from '../../lib/db';
import { internalError } from '../../lib/validate';

const INDEX_NAMES = ['KSE_100', 'KSE_30', 'KMI_30'];

export const handler = async () => {
  try {
    const result = await ddb.send(new BatchGetCommand({
      RequestItems: {
        [TABLE_NAME]: {
          Keys: INDEX_NAMES.map(name => ({ PK: `INDEX#${name}`, SK: 'LATEST' })),
        },
      },
    }));

    const items = result.Responses?.[TABLE_NAME] ?? [];

    const indices = INDEX_NAMES.map(name => {
      const item = items.find((i: any) => i.PK === `INDEX#${name}`);
      return {
        name,
        value: item ? Number(item.value) : null,
        change: item ? Number(item.change) : null,
        changePct: item ? Number(item.changePct) : null,
        updatedAt: item?.updatedAt ?? null,
      };
    });

    return response(200, { indices });
  } catch (err) {
    return internalError(err);
  }
};
