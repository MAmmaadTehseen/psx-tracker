import * as cdk from 'aws-cdk-lib';
import * as cloudwatch from 'aws-cdk-lib/aws-cloudwatch';
import * as cloudwatchActions from 'aws-cdk-lib/aws-cloudwatch-actions';
import * as sns from 'aws-cdk-lib/aws-sns';
import * as snsSubscriptions from 'aws-cdk-lib/aws-sns-subscriptions';
import { Construct } from 'constructs';

interface MonitoringStackProps extends cdk.StackProps {
  alertEmail: string;
}

export class MonitoringStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: MonitoringStackProps) {
    super(scope, id, props);

    // SNS Topic = a notification channel.
    // Alarms publish to this topic; subscribers (like your email) receive the notification.
    const alertTopic = new sns.Topic(this, 'AlertTopic', {
      topicName: 'psx-tracker-alerts',
      displayName: 'PSX Tracker Alerts',
    });

    // Subscribe your email — you'll get an email to confirm the subscription after deploy
    alertTopic.addSubscription(
      new snsSubscriptions.EmailSubscription(props.alertEmail)
    );

    // Billing alarm — fires when estimated AWS charges exceed $1.
    // IMPORTANT: Billing metrics are only available in us-east-1.
    // This is the most important alarm to set up as a learner.
    const billingAlarm = new cloudwatch.Alarm(this, 'BillingAlarm', {
      alarmName: 'psx-tracker-billing-1usd',
      alarmDescription: 'PSX Tracker AWS costs have exceeded $1 USD',
      metric: new cloudwatch.Metric({
        namespace: 'AWS/Billing',
        metricName: 'EstimatedCharges',
        dimensionsMap: { Currency: 'USD' },
        // Billing metrics update every 6 hours
        period: cdk.Duration.hours(6),
        statistic: 'Maximum',
      }),
      threshold: 1,
      evaluationPeriods: 1,
      comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
    });

    billingAlarm.addAlarmAction(new cloudwatchActions.SnsAction(alertTopic));

    new cdk.CfnOutput(this, 'AlertTopicArn', { value: alertTopic.topicArn });
  }
}
