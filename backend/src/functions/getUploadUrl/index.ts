// GET /upload-url?filename=trades.csv
// Returns a pre-signed S3 URL the Expo app uses to upload a CSV directly to S3.
// Pre-signed URLs are temporary credentials embedded in a URL — the app uploads
// directly to S3 without going through Lambda. This is the correct AWS pattern
// for file uploads: Lambda just issues the permission, doesn't handle the bytes.

import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { response } from '../../lib/db';
import { randomUUID } from 'crypto';

const s3 = new S3Client({});
const BUCKET = process.env.UPLOADS_BUCKET!;

export const handler = async (event: any) => {
  const userId = event.requestContext?.authorizer?.jwt?.claims?.sub;
  if (!userId) return response(401, { error: 'Unauthorized' });

  const filename = event.queryStringParameters?.filename ?? 'upload.csv';
  const ext = filename.split('.').pop()?.toLowerCase();

  const allowedExtensions = ['csv', 'png', 'jpg', 'jpeg'];
  if (!ext || !allowedExtensions.includes(ext)) {
    return response(400, { error: 'Only CSV and image files are allowed' });
  }

  // Store files under the user's ID to keep them separated
  const key = `uploads/${userId}/${randomUUID()}.${ext}`;

  // Generate a pre-signed URL valid for 5 minutes
  // After 5 minutes the URL expires and the app must request a new one
  const command = new PutObjectCommand({
    Bucket: BUCKET,
    Key: key,
    ContentType: ext === 'csv' ? 'text/csv' : `image/${ext}`,
  });

  const uploadUrl = await getSignedUrl(s3, command, { expiresIn: 300 });

  return response(200, {
    uploadUrl,    // PUT this URL with the file as the body
    key,          // pass this key back when telling the backend to process the file
  });
};
