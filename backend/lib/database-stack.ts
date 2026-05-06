import * as cdk from 'aws-cdk-lib';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import { Construct } from 'constructs';

export class DatabaseStack extends cdk.Stack {
  // Expose table so other stacks can pass it to Lambda functions
  public readonly table: dynamodb.Table;

  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // Single-table design: one DynamoDB table holds all entity types.
    // PK (partition key) + SK (sort key) lets us store stocks, prices,
    // dividends, users, portfolios, and trades all in one table.
    //
    // Example items:
    //   PK=STOCK#ENGRO  SK=METADATA       → company info
    //   PK=STOCK#ENGRO  SK=PRICE#2026-05-06 → daily price
    //   PK=USER#abc     SK=PORTFOLIO#xyz   → portfolio
    //   PK=USER#abc     SK=TRADE#xyz       → a buy/sell trade
    this.table = new dynamodb.Table(this, 'PsxTable', {
      tableName: 'psx-tracker',
      partitionKey: { name: 'PK', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'SK', type: dynamodb.AttributeType.STRING },

      // PROVISIONED mode locks you to 25 RCU / 25 WCU which is the free tier limit.
      // PAY_PER_REQUEST would scale automatically but can exceed free tier.
      billingMode: dynamodb.BillingMode.PROVISIONED,
      readCapacity: 25,
      writeCapacity: 25,

      // Protect production data from accidental stack deletions
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });

    // Global Secondary Index so we can query "all stocks in a sector"
    // Without a GSI, DynamoDB can only query by PK — no searching by other fields.
    this.table.addGlobalSecondaryIndex({
      indexName: 'sector-index',
      partitionKey: { name: 'sector', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'SK', type: dynamodb.AttributeType.STRING },
      readCapacity: 5,
      writeCapacity: 5,
      projectionType: dynamodb.ProjectionType.ALL,
    });

    // Output the table name and ARN — visible in CloudFormation console after deploy
    new cdk.CfnOutput(this, 'TableName', { value: this.table.tableName });
    new cdk.CfnOutput(this, 'TableArn', { value: this.table.tableArn });
  }
}
