# PSX Tracker — Getting Started

## What's been built

```
psx-tracker/
├── frontend/        Expo app (web + iOS + Android)
│   ├── app/         Screens: Market, Search, Portfolio, Dividends, Stock detail, Auth
│   └── lib/         API client, Cognito auth, Zustand store
│
└── backend/         AWS CDK project
    ├── lib/         5 CDK stacks (Database, Auth, Storage, API, Scheduler)
    └── src/
        ├── functions/  Lambda handlers (Node.js + Python)
        └── scripts/    Historical data seeder
```

---

## Step 1: AWS Account Setup

1. Create a free AWS account at aws.amazon.com
2. Go to **CloudWatch** → Alarms → Create a billing alarm at $1 (before doing anything else!)
3. Go to **IAM** → Users → Create user → Attach `AdministratorAccess` policy → Create access keys
4. Install AWS CLI: https://docs.aws.amazon.com/cli/latest/userguide/install-cliv2.html
5. Configure: `aws configure` → paste your access key, secret key, region (us-east-1)

---

## Step 2: Deploy the Backend

```bash
cd backend

# Install dependencies
npm install

# Bootstrap CDK (first time only — creates an S3 bucket for CDK assets)
# This teaches you about CDK bootstrapping
npx cdk bootstrap

# Deploy all 5 stacks
npx cdk deploy --all
```

CDK will print outputs like:
```
PsxApi.ApiUrl = https://abc123.execute-api.us-east-1.amazonaws.com
PsxAuth.UserPoolId = us-east-1_AbCdEf
PsxAuth.UserPoolClientId = 1abc2def3ghi4jkl5mno6pqr
```

Copy these — you need them for the frontend.

---

## Step 3: Load Historical Data

```bash
cd backend
pip install psx boto3
TABLE_NAME=psx-tracker AWS_REGION=us-east-1 python scripts/seed_historical.py
```

This loads 3 years of price history for major PSX stocks into DynamoDB.

---

## Step 4: Configure the Frontend

```bash
cd frontend
cp .env.local.example .env.local
```

Edit `.env.local` with the values from Step 2's CDK output.

---

## Step 5: Run the App

```bash
cd frontend
npm start
```

- Press `w` to open in browser (web)
- Scan the QR code with **Expo Go** app to run on your phone
- Press `a` to run on Android emulator (if you have Android Studio)

---

## Step 6: Build Android APK (optional)

```bash
npm install -g eas-cli
eas login  # create account at expo.dev
cd frontend
eas build:configure
eas build --platform android --profile preview
```

EAS builds the APK in the cloud and gives you a download link. Install on any Android device.

---

## Key AWS Console Pages to Explore

After deploying, explore these in the AWS Console to see what CDK created:

| Service | What to look at |
|---|---|
| CloudFormation | Your 5 stacks and all the resources in each |
| DynamoDB | psx-tracker table, items after scraper runs |
| Lambda | All 7 functions, logs, invocations graph |
| API Gateway | Routes, JWT authorizer |
| Cognito | User Pool, test sign-up manually |
| EventBridge | Scraper cron rules |
| CloudWatch | Lambda logs, billing alarm |
| S3 | psx-tracker-uploads bucket |
| IAM | Lambda execution roles and policies |

---

## How to Watch the Scraper Work

After deploying, manually invoke the scraper:

```bash
aws lambda invoke \
  --function-name psx-scraper \
  --payload '{"test": true}' \
  response.json

cat response.json
```

Then check DynamoDB for new `STOCK#*` items.

---

## What You're Learning

Each part of this project teaches a core AWS concept:

1. **CDK** → Infrastructure as Code, CloudFormation
2. **IAM** → Least-privilege, roles, policies  
3. **DynamoDB** → NoSQL, single-table design, GSI, batch writes
4. **Lambda** → Serverless functions, cold starts, env vars
5. **API Gateway** → HTTP routing, JWT auth, CORS
6. **Cognito** → User auth, JWT tokens, auth flows
7. **EventBridge** → Cron scheduling, event-driven architecture
8. **S3** → Object storage, pre-signed URLs, lifecycle
9. **CloudWatch** → Logging, alarms, metrics
10. **GitHub Actions** → CI/CD, secrets management
