// Central config — replace these values after running `cdk deploy`
// cdk deploy prints these as stack outputs in your terminal

export const CONFIG = {
  // From PsxApi stack output "ApiUrl"
  API_URL: process.env.EXPO_PUBLIC_API_URL || 'https://YOUR_API_ID.execute-api.us-east-1.amazonaws.com',

  // From PsxAuth stack outputs
  COGNITO_USER_POOL_ID: process.env.EXPO_PUBLIC_COGNITO_USER_POOL_ID || 'us-east-1_XXXXXXXXX',
  COGNITO_CLIENT_ID: process.env.EXPO_PUBLIC_COGNITO_CLIENT_ID || 'XXXXXXXXXXXXXXXXXXXXXXXXXX',
  COGNITO_REGION: process.env.EXPO_PUBLIC_COGNITO_REGION || 'us-east-1',
};
