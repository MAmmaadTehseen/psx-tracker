# PSX Tracker — Claude Project Memory

PSX Tracker is a web + mobile app (Expo PWA + React Native) for tracking Pakistan Stock Exchange portfolios and market data. Built as an AWS learning project — every service is wired explicitly with raw CDK, no abstractions.

---

## Non-Negotiable Rules

- **Never suggest Amplify, AWS SAM, or any framework that wraps CDK/IAM.** The goal is to learn every service from scratch.
- **Always use raw AWS CDK (TypeScript)** for all infrastructure.
- **Always explain WHY** — why this IAM policy, why this DynamoDB key design, why this Lambda boundary. The user is learning AWS, not just building an app.
- **Least-privilege IAM always** — each Lambda gets only the permissions it needs, no wildcards.

---

## Stack

| Layer | Service | Why |
|---|---|---|
| Frontend | Expo (React Native) | One codebase → web PWA + iOS + Android |
| Routing | Expo Router | File-based navigation, like Next.js pages/ |
| Charts | Victory Native | Candlestick + line charts, works on web and mobile |
| State | Zustand | Auth tokens + active portfolio selection |
| API calls | TanStack Query | Caching, loading/error states, cache invalidation |
| Auth client | amazon-cognito-identity-js | Raw Cognito SDK — NOT Amplify |
| Infrastructure | AWS CDK (TypeScript) | Compiles to CloudFormation; every resource explicit |
| Auth backend | Amazon Cognito | User pool + JWT tokens; API Gateway validates every request |
| API | API Gateway HTTP API | Routes HTTP → Lambda; JWT authorizer blocks unauthenticated calls |
| Compute | AWS Lambda (Node 20) | One function per endpoint; pay-per-call |
| Scraper | AWS Lambda (Python 3.12) | Scrapes dps.psx.com.pk; Python for requests + BeautifulSoup |
| Scheduler | Amazon EventBridge | Cron: every 5 min Mon–Fri 04:15–10:30 UTC (= PSX market hours PKT) |
| Database | Amazon DynamoDB | Single-table design; provisioned 25 RCU/WCU (free tier cap) |
| Storage | Amazon S3 | CSV/screenshot uploads; pre-signed PUT URLs from Lambda |
| Logs | Amazon CloudWatch | 7-day retention on all Lambda log groups |
| Alerts | CloudWatch + SNS | Billing alarm at $1 → email ammadtehseenkhan@gmail.com |

---

## CDK Stack Architecture

```
bin/app.ts
  ├── DatabaseStack   → exports: table (DynamoDB)
  ├── AuthStack       → exports: userPool, userPoolClient (Cognito)
  ├── StorageStack    → exports: uploadsBucket (S3)
  ├── ApiStack        ← receives: table, userPool, userPoolClient, uploadsBucket
  ├── SchedulerStack  ← receives: table
  └── MonitoringStack ← receives: alertEmail
```

Cross-stack values are passed as constructor props. CDK resolves them as CloudFormation exports/imports automatically.

---

## DynamoDB Table Design (single-table)

Table name: `psx-tracker` — one table, all entity types.

| PK | SK | Entity |
|---|---|---|
| `STOCK#ENGRO` | `METADATA` | Company info, fundamentals |
| `STOCK#ENGRO` | `PRICE#2026-05-06` | OHLC price + volume |
| `STOCK#ENGRO` | `DIV#2026-03-15` | Dividend amount + yield |
| `USER#<sub>` | `PORTFOLIO#<id>` | Portfolio name |
| `USER#<sub>` | `TRADE#<id>` | Buy/sell transaction |
| `INDEX#KSE100` | `LATEST` | Live index value |

GSI `sector-index` on `sector` attribute — for sector heatmap queries.

`sub` = Cognito user ID injected by API Gateway JWT authorizer into `event.requestContext.authorizer.jwt.claims.sub`. User cannot spoof this.

---

## Key File Map

| What you want to change | File(s) to touch |
|---|---|
| Add a new API endpoint | `backend/lib/api-stack.ts` (new Lambda + route) + `backend/src/functions/<name>/index.ts` |
| Change DynamoDB table schema | `backend/lib/database-stack.ts` |
| Change auth settings | `backend/lib/auth-stack.ts` |
| Change S3 bucket config | `backend/lib/storage-stack.ts` |
| Change scraper schedule | `backend/lib/scheduler-stack.ts` |
| Change billing alarm | `backend/lib/monitoring-stack.ts` |
| Add a new screen | `frontend/app/<path>.tsx` |
| Add an API call | `frontend/lib/api.ts` |
| Change auth flow | `frontend/lib/auth.ts` |
| Change global state | `frontend/lib/store.ts` |
| Scraper logic | `backend/src/functions/scraper/scraper.py` |

---

## Environment

Frontend reads from `.env.local` (gitignored — see `.env.local.example`):
```
EXPO_PUBLIC_API_URL=https://<id>.execute-api.us-east-1.amazonaws.com
EXPO_PUBLIC_COGNITO_USER_POOL_ID=us-east-1_XXXXXXX
EXPO_PUBLIC_COGNITO_CLIENT_ID=<client-id>
EXPO_PUBLIC_REGION=us-east-1
```

Values come from CDK stack outputs after `cdk deploy --all`.

---

## Common Commands

```bash
# Deploy all stacks
cd backend && npx cdk deploy --all

# Deploy one stack
npx cdk deploy PsxApi

# Run frontend (web)
cd frontend && npm start

# Seed historical data (one-time)
cd backend && python src/scripts/seed_historical.py

# Show CDK diff before deploying
npx cdk diff
```

---

## Auth Flow (how it actually works)

1. User signs in via `frontend/lib/auth.ts` → `amazon-cognito-identity-js` → Cognito returns `accessToken`, `idToken`, `refreshToken`
2. Frontend stores tokens in Zustand (`lib/store.ts`)
3. API calls send `Authorization: <accessToken>` header
4. API Gateway JWT authorizer validates token signature against Cognito's JWKS endpoint
5. If valid: Lambda runs, gets `userId` from `event.requestContext.authorizer.jwt.claims.sub`
6. If invalid: API Gateway returns 401 before Lambda ever runs

`jwtAudience` = Cognito Client ID (ensures token was issued for this specific app).
`jwtIssuer` = `https://cognito-idp.<region>.amazonaws.com/<userPoolId>`.

---

## Free Tier Targets

| Service | Free limit | Expected monthly usage |
|---|---|---|
| Lambda | 1M calls (forever) | ~2,000 |
| API Gateway | 1M calls (12 months) | ~50,000 |
| DynamoDB | 25 GB, 25 RCU/WCU (forever) | < 1 GB |
| Cognito | 50K MAU (forever) | < 100 |
| EventBridge | 1M events (forever) | ~1,600 |
| S3 | 5 GB (12 months) | < 500 MB |
| CloudWatch | 5 GB logs (forever) | < 100 MB |

DynamoDB is set to `PROVISIONED` mode at exactly 25 RCU/25 WCU — this locks to free tier. `PAY_PER_REQUEST` could exceed free tier under load.
