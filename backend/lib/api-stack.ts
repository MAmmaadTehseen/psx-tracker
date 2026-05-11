import * as cdk from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as lambdaNode from 'aws-cdk-lib/aws-lambda-nodejs';
import * as apigateway from 'aws-cdk-lib/aws-apigatewayv2';
import * as integrations from 'aws-cdk-lib/aws-apigatewayv2-integrations';
import * as authorizers from 'aws-cdk-lib/aws-apigatewayv2-authorizers';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as logs from 'aws-cdk-lib/aws-logs';
import { Construct } from 'constructs';
import * as path from 'path';

interface ApiStackProps extends cdk.StackProps {
  table: dynamodb.Table;
  userPool: cognito.UserPool;
  userPoolClient: cognito.UserPoolClient;  // needed for JWT audience
  uploadsBucket: s3.Bucket;
}

export class ApiStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: ApiStackProps) {
    super(scope, id, props);

    const { table, userPool, userPoolClient, uploadsBucket } = props;

    // Create explicit log groups instead of using the deprecated logRetention option.
    // This does the same thing — sets a 7-day retention — but using the current API.
    // Each Lambda gets its own log group named /aws/lambda/<functionName>.
    const makeLogGroup = (fnName: string) =>
      new logs.LogGroup(this, `${fnName}Logs`, {
        logGroupName: `/aws/lambda/psx-${fnName}`,
        retention: logs.RetentionDays.ONE_WEEK,
        removalPolicy: cdk.RemovalPolicy.DESTROY,
      });

    // --- Shared Lambda config ---
    const defaultLambdaProps: Partial<lambdaNode.NodejsFunctionProps> = {
      runtime: lambda.Runtime.NODEJS_20_X,
      timeout: cdk.Duration.seconds(10),
      memorySize: 256,
      environment: {
        TABLE_NAME: table.tableName,
        NODE_OPTIONS: '--enable-source-maps',
      },
      bundling: {
        minify: true,
        sourceMap: true,
      },
    };

    // --- Lambda functions ---
    const listStocksFn = new lambdaNode.NodejsFunction(this, 'ListStocksFn', {
      ...defaultLambdaProps,
      entry: path.join(__dirname, '../src/functions/listStocks/index.ts'),
      functionName: 'psx-list-stocks',
      logGroup: makeLogGroup('list-stocks'),
    });

    const getStockFn = new lambdaNode.NodejsFunction(this, 'GetStockFn', {
      ...defaultLambdaProps,
      entry: path.join(__dirname, '../src/functions/getStock/index.ts'),
      functionName: 'psx-get-stock',
      logGroup: makeLogGroup('get-stock'),
    });

    const getPortfolioFn = new lambdaNode.NodejsFunction(this, 'GetPortfolioFn', {
      ...defaultLambdaProps,
      entry: path.join(__dirname, '../src/functions/getPortfolio/index.ts'),
      functionName: 'psx-get-portfolio',
      logGroup: makeLogGroup('get-portfolio'),
    });

    const addTradeFn = new lambdaNode.NodejsFunction(this, 'AddTradeFn', {
      ...defaultLambdaProps,
      entry: path.join(__dirname, '../src/functions/addTrade/index.ts'),
      functionName: 'psx-add-trade',
      logGroup: makeLogGroup('add-trade'),
    });

    const deleteTradeFn = new lambdaNode.NodejsFunction(this, 'DeleteTradeFn', {
      ...defaultLambdaProps,
      entry: path.join(__dirname, '../src/functions/deleteTrade/index.ts'),
      functionName: 'psx-delete-trade',
      logGroup: makeLogGroup('delete-trade'),
    });

    const createPortfolioFn = new lambdaNode.NodejsFunction(this, 'CreatePortfolioFn', {
      ...defaultLambdaProps,
      entry: path.join(__dirname, '../src/functions/createPortfolio/index.ts'),
      functionName: 'psx-create-portfolio',
      logGroup: makeLogGroup('create-portfolio'),
    });

    const deletePortfolioFn = new lambdaNode.NodejsFunction(this, 'DeletePortfolioFn', {
      ...defaultLambdaProps,
      entry: path.join(__dirname, '../src/functions/deletePortfolio/index.ts'),
      functionName: 'psx-delete-portfolio',
      logGroup: makeLogGroup('delete-portfolio'),
    });

    const renamePortfolioFn = new lambdaNode.NodejsFunction(this, 'RenamePortfolioFn', {
      ...defaultLambdaProps,
      entry: path.join(__dirname, '../src/functions/renamePortfolio/index.ts'),
      functionName: 'psx-rename-portfolio',
      logGroup: makeLogGroup('rename-portfolio'),
    });

    const getDividendsFn = new lambdaNode.NodejsFunction(this, 'GetDividendsFn', {
      ...defaultLambdaProps,
      entry: path.join(__dirname, '../src/functions/getDividends/index.ts'),
      functionName: 'psx-get-dividends',
      logGroup: makeLogGroup('get-dividends'),
    });

    const watchlistFn = new lambdaNode.NodejsFunction(this, 'WatchlistFn', {
      ...defaultLambdaProps,
      entry: path.join(__dirname, '../src/functions/watchlist/index.ts'),
      functionName: 'psx-watchlist',
      logGroup: makeLogGroup('watchlist'),
    });

    const getIndicesFn = new lambdaNode.NodejsFunction(this, 'GetIndicesFn', {
      ...defaultLambdaProps,
      entry: path.join(__dirname, '../src/functions/getIndices/index.ts'),
      functionName: 'psx-get-indices',
      logGroup: makeLogGroup('get-indices'),
    });

    const getIndicesHistoryFn = new lambdaNode.NodejsFunction(this, 'GetIndicesHistoryFn', {
      ...defaultLambdaProps,
      entry: path.join(__dirname, '../src/functions/getIndicesHistory/index.ts'),
      functionName: 'psx-get-indices-history',
      logGroup: makeLogGroup('get-indices-history'),
    });

    const getUploadUrlFn = new lambdaNode.NodejsFunction(this, 'GetUploadUrlFn', {
      ...defaultLambdaProps,
      entry: path.join(__dirname, '../src/functions/getUploadUrl/index.ts'),
      functionName: 'psx-get-upload-url',
      logGroup: makeLogGroup('get-upload-url'),
      environment: {
        TABLE_NAME: table.tableName,
        UPLOADS_BUCKET: uploadsBucket.bucketName,
        NODE_OPTIONS: '--enable-source-maps',
      },
    });

    const processTradesCsvFn = new lambdaNode.NodejsFunction(this, 'ProcessTradesCsvFn', {
      ...defaultLambdaProps,
      entry: path.join(__dirname, '../src/functions/processTradesCsv/index.ts'),
      functionName: 'psx-process-trades-csv',
      logGroup: makeLogGroup('process-trades-csv'),
      timeout: cdk.Duration.seconds(30),  // CSV parsing + batch writes can take longer
      environment: {
        TABLE_NAME: table.tableName,
        UPLOADS_BUCKET: uploadsBucket.bucketName,
        NODE_OPTIONS: '--enable-source-maps',
      },
    });

    // --- IAM Permissions ---
    table.grantReadWriteData(watchlistFn);
    table.grantReadData(getIndicesFn);
    table.grantReadData(getIndicesHistoryFn);
    table.grantReadData(listStocksFn);
    table.grantReadData(getStockFn);
    table.grantReadData(getPortfolioFn);
    table.grantReadData(getDividendsFn);
    table.grantReadWriteData(addTradeFn);
    table.grantReadWriteData(deleteTradeFn);
    table.grantReadWriteData(createPortfolioFn);
    table.grantReadWriteData(deletePortfolioFn);
    table.grantReadWriteData(renamePortfolioFn);
    uploadsBucket.grantPut(getUploadUrlFn);
    uploadsBucket.grantRead(processTradesCsvFn);
    table.grantReadWriteData(processTradesCsvFn);

    // --- API Gateway (HTTP API) ---
    const api = new apigateway.HttpApi(this, 'PsxHttpApi', {
      apiName: 'psx-tracker-api',
      description: 'PSX Tracker backend API',
      corsPreflight: {
        allowOrigins: ['*'],
        allowMethods: [
          apigateway.CorsHttpMethod.GET,
          apigateway.CorsHttpMethod.POST,
          apigateway.CorsHttpMethod.PUT,
          apigateway.CorsHttpMethod.DELETE,
          apigateway.CorsHttpMethod.OPTIONS,
        ],
        allowHeaders: ['Content-Type', 'Authorization'],
      },
    });

    // --- JWT Authorizer ---
    // jwtIssuer: the Cognito endpoint that issued the token (used to verify the signature)
    // jwtAudience: the Client ID — ensures the token was issued FOR this specific app
    // API Gateway validates both on every protected request. Your Lambda never sees invalid tokens.
    const jwtAuthorizer = new authorizers.HttpJwtAuthorizer(
      'CognitoAuthorizer',
      `https://cognito-idp.${this.region}.amazonaws.com/${userPool.userPoolId}`,
      {
        jwtAudience: [userPoolClient.userPoolClientId],
        identitySource: ['$request.header.Authorization'],
      }
    );

    // --- Routes ---
    // Public (no auth)
    api.addRoutes({
      path: '/indices',
      methods: [apigateway.HttpMethod.GET],
      integration: new integrations.HttpLambdaIntegration('GetIndices', getIndicesFn),
    });

    api.addRoutes({
      path: '/indices/history',
      methods: [apigateway.HttpMethod.GET],
      integration: new integrations.HttpLambdaIntegration('GetIndicesHistory', getIndicesHistoryFn),
    });

    api.addRoutes({
      path: '/stocks',
      methods: [apigateway.HttpMethod.GET],
      integration: new integrations.HttpLambdaIntegration('ListStocks', listStocksFn),
    });

    api.addRoutes({
      path: '/stocks/{ticker}',
      methods: [apigateway.HttpMethod.GET],
      integration: new integrations.HttpLambdaIntegration('GetStock', getStockFn),
    });

    api.addRoutes({
      path: '/stocks/{ticker}/dividends',
      methods: [apigateway.HttpMethod.GET],
      integration: new integrations.HttpLambdaIntegration('GetDividends', getDividendsFn),
    });

    // Protected (require valid Cognito JWT in Authorization header)
    api.addRoutes({
      path: '/portfolio',
      methods: [apigateway.HttpMethod.GET],
      integration: new integrations.HttpLambdaIntegration('GetPortfolio', getPortfolioFn),
      authorizer: jwtAuthorizer,
    });

    api.addRoutes({
      path: '/portfolio',
      methods: [apigateway.HttpMethod.POST],
      integration: new integrations.HttpLambdaIntegration('CreatePortfolio', createPortfolioFn),
      authorizer: jwtAuthorizer,
    });

    api.addRoutes({
      path: '/portfolio/{portfolioId}',
      methods: [apigateway.HttpMethod.DELETE],
      integration: new integrations.HttpLambdaIntegration('DeletePortfolio', deletePortfolioFn),
      authorizer: jwtAuthorizer,
    });

    api.addRoutes({
      path: '/portfolio/{portfolioId}',
      methods: [apigateway.HttpMethod.PUT],
      integration: new integrations.HttpLambdaIntegration('RenamePortfolio', renamePortfolioFn),
      authorizer: jwtAuthorizer,
    });

    api.addRoutes({
      path: '/portfolio/trade',
      methods: [apigateway.HttpMethod.POST],
      integration: new integrations.HttpLambdaIntegration('AddTrade', addTradeFn),
      authorizer: jwtAuthorizer,
    });

    api.addRoutes({
      path: '/portfolio/trade/{tradeId}',
      methods: [apigateway.HttpMethod.DELETE],
      integration: new integrations.HttpLambdaIntegration('DeleteTrade', deleteTradeFn),
      authorizer: jwtAuthorizer,
    });

    api.addRoutes({
      path: '/upload-url',
      methods: [apigateway.HttpMethod.GET],
      integration: new integrations.HttpLambdaIntegration('GetUploadUrl', getUploadUrlFn),
      authorizer: jwtAuthorizer,
    });

    api.addRoutes({
      path: '/portfolio/import',
      methods: [apigateway.HttpMethod.POST],
      integration: new integrations.HttpLambdaIntegration('ProcessTradesCsv', processTradesCsvFn),
      authorizer: jwtAuthorizer,
    });

    api.addRoutes({
      path: '/watchlist',
      methods: [apigateway.HttpMethod.GET, apigateway.HttpMethod.POST],
      integration: new integrations.HttpLambdaIntegration('Watchlist', watchlistFn),
      authorizer: jwtAuthorizer,
    });

    api.addRoutes({
      path: '/watchlist/{ticker}',
      methods: [apigateway.HttpMethod.DELETE],
      integration: new integrations.HttpLambdaIntegration('WatchlistDelete', watchlistFn),
      authorizer: jwtAuthorizer,
    });

    new cdk.CfnOutput(this, 'ApiUrl', { value: api.url ?? '' });
  }
}
