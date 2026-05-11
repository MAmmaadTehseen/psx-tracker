import { QueryCommand } from '@aws-sdk/lib-dynamodb';
import { ddb, TABLE_NAME, response } from '../../lib/db';
import { internalError } from '../../lib/validate';

const INDEX_NAMES = ['KSE_100', 'KSE_30', 'KMI_30'];

export const handler = async (event: any) => {
  try {
    const days = Math.min(parseInt(event.queryStringParameters?.days ?? '30', 10) || 30, 365);

    const start = new Date();
    start.setDate(start.getDate() - days);
    const startStr = start.toISOString().slice(0, 10);

    const results = await Promise.all(
      INDEX_NAMES.map(name =>
        ddb.send(new QueryCommand({
          TableName: TABLE_NAME,
          KeyConditionExpression: 'PK = :pk AND SK BETWEEN :start AND :end',
          ExpressionAttributeValues: {
            ':pk': `INDEX#${name}`,
            ':start': `PRICE#${startStr}`,
            ':end': 'PRICE#9999',
          },
          ScanIndexForward: false,
          Limit: days,
        }))
      )
    );

    const history: Record<string, { date: string; value: number; changePct: number }[]> = {};
    INDEX_NAMES.forEach((name, i) => {
      history[name] = (results[i].Items ?? []).map(item => ({
        date: (item.SK as string).replace('PRICE#', ''),
        value: Number(item.value),
        changePct: Number(item.changePct),
      }));
    });

    return response(200, { history });
  } catch (err) {
    return internalError(err);
  }
};
