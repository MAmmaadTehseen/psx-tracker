#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { DatabaseStack } from '../lib/database-stack';
import { AuthStack } from '../lib/auth-stack';
import { StorageStack } from '../lib/storage-stack';
import { ApiStack } from '../lib/api-stack';
import { SchedulerStack } from '../lib/scheduler-stack';
import { MonitoringStack } from '../lib/monitoring-stack';

const app = new cdk.App();

const env = {
  account: process.env.CDK_DEFAULT_ACCOUNT,
  region: process.env.CDK_DEFAULT_REGION ?? 'us-east-1',
};

// Each stack is a separate CloudFormation stack — you can deploy them independently.
// Stacks share resources by passing outputs between them as constructor props.

const db = new DatabaseStack(app, 'PsxDatabase', { env });
const auth = new AuthStack(app, 'PsxAuth', { env });
const storage = new StorageStack(app, 'PsxStorage', { env });

new ApiStack(app, 'PsxApi', {
  env,
  table: db.table,
  userPool: auth.userPool,
  userPoolClient: auth.userPoolClient,
  uploadsBucket: storage.uploadsBucket,
});

new SchedulerStack(app, 'PsxScheduler', {
  env,
  table: db.table,
});

new MonitoringStack(app, 'PsxMonitoring', {
  env,
  alertEmail: process.env.ALERT_EMAIL ?? 'ammadtehseenkhan@gmail.com',
});
