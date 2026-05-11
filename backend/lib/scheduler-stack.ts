import * as cdk from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as events from 'aws-cdk-lib/aws-events';
import * as targets from 'aws-cdk-lib/aws-events-targets';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as logs from 'aws-cdk-lib/aws-logs';
import { Construct } from 'constructs';
import * as path from 'path';

interface SchedulerStackProps extends cdk.StackProps {
  table: dynamodb.Table;
}

export class SchedulerStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: SchedulerStackProps) {
    super(scope, id, props);

    const { table } = props;

    // The scraper is a Python Lambda — Python is great for web scraping
    // (requests + BeautifulSoup are the standard libraries).
    //
    // We package the dependencies with the Lambda using a Lambda Layer,
    // or by including them in the deployment package via a requirements.txt.
    const scraperFn = new lambda.Function(this, 'ScraperFn', {
      functionName: 'psx-scraper',
      runtime: lambda.Runtime.PYTHON_3_12,
      handler: 'scraper.handler',
      code: lambda.Code.fromAsset(path.join(__dirname, '../src/functions/scraper'), {
        // Bundle Python dependencies declared in requirements.txt into the ZIP
        bundling: {
          image: lambda.Runtime.PYTHON_3_12.bundlingImage,
          command: [
            'bash', '-c',
            'pip install -r requirements.txt -t /asset-output && cp -r . /asset-output',
          ],
        },
      }),
      timeout: cdk.Duration.seconds(60),  // scraping can be slow
      memorySize: 256,
      environment: {
        TABLE_NAME: table.tableName,
      },
      logRetention: logs.RetentionDays.ONE_WEEK,
    });

    // Grant the scraper Lambda write access to DynamoDB.
    // CDK creates an IAM policy with exactly these actions and attaches it to the Lambda role:
    //   dynamodb:PutItem, dynamodb:UpdateItem, dynamodb:BatchWriteItem
    table.grantWriteData(scraperFn);

    // EventBridge rule — fires the scraper Lambda on a cron schedule.
    // PSX market hours: 09:15 – 15:30 PKT = 04:15 – 10:30 UTC
    // Cron syntax: minute hour day month weekday year
    new events.Rule(this, 'ScraperDuringMarketHours', {
      ruleName: 'psx-scraper-market-hours',
      description: 'Run PSX scraper every 5 min during market hours (Mon-Fri)',
      schedule: events.Schedule.cron({
        minute: '*/5',
        hour: '4-10',
        weekDay: 'MON-FRI',
        month: '*',
        year: '*',
      }),
      targets: [new targets.LambdaFunction(scraperFn, {
        // Retry up to 2 times if the Lambda fails
        retryAttempts: 2,
      })],
    });

    // Separate rule for end-of-day scrape at market close (10:35 UTC = 15:35 PKT).
    // We pass { "runType": "eod" } in the event so the Lambda knows this is the
    // EOD run without having to guess from the clock (which was fragile — the
    // 5-min rule also runs at 10:25 UTC, inside the same clock hour).
    new events.Rule(this, 'ScraperEndOfDay', {
      ruleName: 'psx-scraper-eod',
      description: 'Run PSX scraper at market close for final EOD snapshot + dividends',
      schedule: events.Schedule.cron({
        minute: '35',
        hour: '10',
        weekDay: 'MON-FRI',
        month: '*',
        year: '*',
      }),
      targets: [new targets.LambdaFunction(scraperFn, {
        retryAttempts: 3,
        event: events.RuleTargetInput.fromObject({ runType: 'eod' }),
      })],
    });

    new cdk.CfnOutput(this, 'ScraperFunctionName', { value: scraperFn.functionName });
  }
}
