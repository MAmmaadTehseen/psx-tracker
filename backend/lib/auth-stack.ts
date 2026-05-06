import * as cdk from 'aws-cdk-lib';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import { Construct } from 'constructs';

export class AuthStack extends cdk.Stack {
  public readonly userPool: cognito.UserPool;
  public readonly userPoolClient: cognito.UserPoolClient;

  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // Cognito User Pool = your user database + auth system.
    // It stores users, handles password hashing, issues JWTs, sends verification emails.
    // You never touch passwords directly — Cognito does it all.
    this.userPool = new cognito.UserPool(this, 'PsxUserPool', {
      userPoolName: 'psx-tracker-users',
      selfSignUpEnabled: true,         // users can register themselves
      signInAliases: { email: true },  // login with email (not username)
      autoVerify: { email: true },     // send verification email on sign-up
      passwordPolicy: {
        minLength: 8,
        requireLowercase: true,
        requireUppercase: false,
        requireDigits: true,
        requireSymbols: false,
      },
      accountRecovery: cognito.AccountRecovery.EMAIL_ONLY,
      // Keep user pool on stack deletion (don't delete all user accounts!)
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });

    // User Pool Client = the credentials the Expo app uses to call Cognito.
    // Each app (mobile, web, backend) gets its own client.
    // Auth flows:
    //   USER_PASSWORD_AUTH = simple email+password (easiest to implement)
    //   USER_SRP_AUTH = Secure Remote Password (more secure, but more complex)
    this.userPoolClient = this.userPool.addClient('ExpoAppClient', {
      userPoolClientName: 'expo-app',
      authFlows: {
        userPassword: true,   // allows direct email+password sign-in
        userSrp: true,        // allows SRP (preferred in production)
      },
      // No client secret for public apps (mobile/web apps can't keep secrets)
      generateSecret: false,
      // Token validity — how long before the user must log in again
      accessTokenValidity: cdk.Duration.hours(1),
      idTokenValidity: cdk.Duration.hours(1),
      refreshTokenValidity: cdk.Duration.days(30),
    });

    // Output IDs — your Expo app needs these to connect to Cognito
    new cdk.CfnOutput(this, 'UserPoolId', { value: this.userPool.userPoolId });
    new cdk.CfnOutput(this, 'UserPoolClientId', { value: this.userPoolClient.userPoolClientId });
    new cdk.CfnOutput(this, 'UserPoolArn', { value: this.userPool.userPoolArn });
  }
}
