import * as cdk from 'aws-cdk-lib';
import * as s3 from 'aws-cdk-lib/aws-s3';
import { Construct } from 'constructs';

export class StorageStack extends cdk.Stack {
  public readonly uploadsBucket: s3.Bucket;

  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // S3 Bucket for user-uploaded files: CSV trade exports and broker screenshots.
    // Files are private — users get a pre-signed URL to upload directly from the app.
    // A pre-signed URL is a temporary URL with embedded credentials — the app uploads
    // directly to S3 without going through your Lambda (faster, cheaper).
    this.uploadsBucket = new s3.Bucket(this, 'Uploads', {
      bucketName: `psx-tracker-uploads-${this.account}`,

      // Block all public access — files are only accessible via pre-signed URLs
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,

      // CORS config lets the Expo web app upload files from the browser
      cors: [
        {
          allowedOrigins: ['*'],
          allowedMethods: [s3.HttpMethods.PUT, s3.HttpMethods.GET],
          allowedHeaders: ['*'],
          maxAge: 3000,
        },
      ],

      // Automatically delete uploaded files after 30 days to stay within free tier
      lifecycleRules: [
        {
          id: 'delete-old-uploads',
          expiration: cdk.Duration.days(30),
        },
      ],

      // Encrypt all stored files at rest (free, just good practice)
      encryption: s3.BucketEncryption.S3_MANAGED,

      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });

    new cdk.CfnOutput(this, 'UploadsBucketName', { value: this.uploadsBucket.bucketName });
  }
}
