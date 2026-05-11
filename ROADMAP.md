# PSX Tracker — Feature Roadmap

> Goal: The best Pakistan Stock Exchange app in the world.
> Work from this file — pick any item, implement it, move it to Implemented.

---

## Legend

- `[FE]` Frontend only
- `[BE]` Backend only
- `[FE+BE]` Both
- `⚡` Quick win (< 1 day)
- `🔥` High impact / user-visible

---

## Implemented

- [x] `[FE+BE]` User registration, email verification, sign-in, sign-out (Cognito)
- [x] `[FE+BE]` JWT auth — API Gateway validates all protected routes
- [x] `[BE]` PSX price scraper — runs every 5 min during market hours
- [x] `[BE]` Dividend scraper — runs at EOD, scrapes PSX payout announcements
- [x] `[BE]` Index scraper — KSE-100, KSE-30, KMI-30 live values
- [x] `[BE]` DynamoDB single-table design with sector GSI
- [x] `[BE]` Lambda functions: listStocks, getStock, getDividends, getPortfolio, addTrade, deleteTrade, createPortfolio, deletePortfolio, getUploadUrl
- [x] `[FE+BE]` Multiple portfolios per user
- [x] `[FE+BE]` Buy/sell trades with FIFO average cost calculation
- [x] `[FE+BE]` Unrealized & realized gain/loss per holding
- [x] `[FE+BE]` Dividend history per stock
- [x] `[FE+BE]` Yield on cost, annual income estimate (Dividends tab)
- [x] `[FE]` Market tab — top 10 gainers & losers
- [x] `[FE]` Search tab — full-text search + sector filter
- [x] `[FE]` Stock detail page — price card, fundamentals, dividend history
- [x] `[FE]` Line + candlestick charts with 1W/1M/3M/6M/1Y ranges (Victory Native)
- [x] `[FE]` Dark theme design system with sentiment color coding
- [x] `[FE]` Market open/close status banner with live indicator
- [x] `[BE]` CloudWatch logging (7-day retention), billing alarm at $1

---

## In Progress / Broken (Fix These First)

- [x] `[FE+BE]` ⚡ 🔥 **Index cards show "updating…" forever** — added `GET /indices` Lambda + fixed IndexCard to fetch real KSE-100/KSE-30/KMI-30 data
- [x] `[FE]` ⚡ 🔥 **No trade entry UI** — added `add-trade` modal screen with buy/sell toggle, ticker, date, qty, price, brokerage + live summary
- [x] `[FE]` ⚡ **No create portfolio UI** — added create portfolio modal + FAB button on Portfolio tab
- [x] `[FE]` ⚡ **Forgot password screens missing** — added `forgot-password.tsx`, `reset-password.tsx`, and "Forgot password?" link on login screen
- [x] `[BE]` ⚡ **Stock fundamentals not scraped** — scraper now captures name/sector always + PE/EPS/bookValue if PSX API provides them; METADATA written every run so stock detail never 404s
- [x] `[BE]` **Backend hardening** — shared validate.ts util, global try-catch on all Lambdas, addTrade ownership check, deleteTrade 404 on ConditionalCheckFailed, deletePortfolio UnprocessedItems retry, getStock NaN-safe days param, listStocks projection + pagination
- [x] `[FE+BE]` 🔥 **CSV trade import** — processTradesCsv Lambda reads S3 file, validates rows, bulk-inserts; POST /portfolio/import + api.importTradesCsv() in frontend client
- [x] `[BE]` 🔥 **Historical index data** — scraper now writes INDEX#{name} PRICE#{date} items each run; enables KSE-100 chart over time

---

## Quick Wins (High Value, Low Effort)

- [x] `[FE]` ⚡ **Ticker badges are sentiment-colored** — green for up, red for down on Market/Search/Portfolio tabs
- [x] `[FE]` ⚡ **Sort controls on Portfolio holdings** — sort by Value / Gain% / A–Z
- [x] `[FE]` ⚡ **Sign out button** — bottom of Portfolio tab with confirmation dialog
- [x] `[FE]` ⚡ **Number formatting utility** — `fmt.ts`: K/M/B suffixes for volume, PKR with commas
- [x] `[FE+BE]` 🔥 **Watchlist** — Lambda (GET/POST/DELETE /watchlist), heart icon on Stock Detail
- [x] `[FE]` 🔥 **Volume + OHLC on Stock Detail** — Open/High/Low/Volume in price card
- [x] `[FE]` ⚡ 🔥 **Delete portfolio confirmation dialog** — long-press pill → Alert with destructive confirm
- [x] `[FE+BE]` ⚡ 🔥 **Rename portfolio** — renamePortfolio Lambda + PUT /portfolio/{id} + rename modal
- [x] `[FE]` ⚡ **Swipe-to-delete trade** — ReanimatedSwipeable rows in Recent Trades section, swipe left to delete
- [x] `[FE]` ⚡ **Tab Two → Watchlist tab** — wire up watched tickers list with live prices
- [x] `[FE]` ⚡ **Pull-to-refresh on all tabs** — already on Market tab, add to Portfolio/Dividends
- [x] `[FE]` ⚡ **Last updated timestamp** — "Updated X min ago" in market banner, auto-refreshes every 30s
- [x] `[BE]` ⚡ **Scraper: add LDCP** — already saved to DynamoDB in write_prices (ldcp field)
- [x] `[FE+BE]` ⚡ **Realized gains summary** — surfaced in portfolio summary card in green/red

---

## Core Features (High Impact, Medium Effort)

### Portfolio & Trading

- [x] `[FE]` 🔥 **Add Trade modal** — implemented (add-trade.tsx with buy/sell toggle, ticker, date, qty, price, brokerage)
- [x] `[FE+BE]` 🔥 **CSV trade import** — processTradesCsv Lambda + POST /portfolio/import + frontend api.importTradesCsv()
- [x] `[FE+BE]` 🔥 **Watchlist** — Lambda + GET/POST/DELETE /watchlist + dedicated Watchlist tab (two.tsx)
- [ ] `[FE]` 🔥 **Portfolio performance chart** — line chart of total portfolio value over time (requires storing daily snapshots or calculating from trade history + price history)
- [x] `[FE]` **Holdings breakdown pie chart** — allocation % by ticker (donut chart using react-native-svg, top 7 + Others)
- [ ] `[FE+BE]` **Cost basis report** — realized gains grouped by tax year, export as CSV

### Market Data

- [ ] `[BE]` 🔥 **Scrape stock fundamentals** — P/E, EPS, Book Value, market cap from PSX or financial data source; store in METADATA item
- [ ] `[BE]` 🔥 **Historical index data** — store INDEX# with date SK (not just LATEST) so we can chart KSE-100 over time
- [x] `[FE+BE]` 🔥 **Index chart on Market tab** — KSE-100/KSE-30/KMI-30 sparklines via new getIndicesHistory Lambda (GET /indices/history)
- [x] `[FE]` **Sector heatmap** — color-coded tiles by avg % change today, computed from existing stocks query
- [ ] `[FE]` **Top gainers/losers toggles** — switch between today's gainers, volume leaders, 52-week highs
- [ ] `[FE+BE]` **Stock comparison** — overlay two tickers on the same chart

### Auth & Account

- [x] `[FE]` 🔥 **Forgot password flow** — forgot-password.tsx + reset-password.tsx screens implemented
- [ ] `[FE]` **Change password screen** — authenticated user can change password
- [ ] `[FE+BE]` **Delete account** — GDPR-style, deletes Cognito user + all DynamoDB data

---

## Engagement & Notifications

- [ ] `[FE+BE]` 🔥 **Price alerts** — user sets target price for a stock; Lambda checks on each scraper run and triggers SNS push
- [ ] `[FE+BE]` **Dividend announcement alerts** — notify when a stock in your portfolio announces a dividend
- [ ] `[FE+BE]` **Push notifications** — Expo push tokens stored in DynamoDB; SNS sends to Expo push API
- [ ] `[FE]` **Daily market summary** — push notification at 15:30 PKT with portfolio P&L for the day
- [ ] `[FE]` **Earnings calendar** — upcoming announcements, result dates for held stocks

---

## Analytics & Insights

- [ ] `[FE]` 🔥 **Portfolio dashboard** — total value over time chart, total invested vs current value, XIRR (time-weighted return)
- [ ] `[FE]` **Annual dividend income projection** — based on holdings + dividend history, how much will you earn this year
- [ ] `[FE]` **Dividend calendar** — month-by-month view of expected dividend payments from your holdings
- [ ] `[FE+BE]` **Portfolio vs KSE-100 benchmark** — overlay your portfolio growth against the index
- [ ] `[FE]` **Stock correlation matrix** — which stocks in your portfolio move together
- [ ] `[FE]` **Sector allocation vs market** — are you overweight CEMENT?
- [ ] `[FE+BE]` **Tax year report** — capital gains realized this year, grouped by holding period (short/long)

---

## Discovery & Research

- [ ] `[FE+BE]` 🔥 **Stock screener** — filter by sector, P/E range, dividend yield, 52-week performance
- [ ] `[FE+BE]` **Dividend yield leaderboard** — top 20 highest-yielding stocks on PSX
- [ ] `[FE+BE]` **Relative strength ranking** — which stocks are outperforming the index over 1M/3M/6M
- [ ] `[FE+BE]` **52-week high/low tracker** — stocks near 52-week highs and lows
- [ ] `[BE]` **Scrape company announcements** — PSX publishes financial results; parse and store them
- [ ] `[FE+BE]` **News feed per stock** — link scraped announcements to stock detail page

---

## UX & Polish

- [x] `[FE]` 🔥 **Skeleton loading states** — shimmer placeholders on Market, Portfolio, Dividends, Search tabs (Animated pulse)
- [ ] `[FE]` **Haptic feedback** — vibrate on trade add/delete, pull-to-refresh
- [ ] `[FE]` **Empty state illustrations** — custom art for empty portfolio, no search results, etc.
- [ ] `[FE]` **Onboarding flow** — 3-screen intro for new users explaining what the app does
- [ ] `[FE]` **Number formatting** — PKR currency formatting, commas in large numbers, K/M/B abbreviations for volume
- [ ] `[FE]` **Sort controls on holdings list** — sort by value, gain%, ticker name
- [ ] `[FE]` **Dark/light theme toggle** — currently dark-only
- [ ] `[FE]` **App icon + splash screen** — custom branded assets for production
- [ ] `[FE]` **iPad / tablet layout** — two-column layout on wide screens

---

## Infrastructure & Backend

- [ ] `[BE]` **DynamoDB TTL on old price data** — keep last 3 years, expire older items automatically
- [ ] `[BE]` **Scraper circuit breaker** — if PSX site changes structure, alert via SNS instead of silent failure
- [ ] `[BE]` **API rate limiting** — API Gateway usage plan to prevent abuse
- [ ] `[BE]` **CloudFront CDN** — cache stock list/metadata at edge (15 min TTL) to reduce DynamoDB reads
- [ ] `[BE]` **Lambda cold start optimization** — bundle splitting, smaller zips for frequently-called functions
- [ ] `[BE]` **Structured logging** — JSON log format for all Lambdas so CloudWatch Insights queries work
- [ ] `[BE]` **GitHub Actions CI/CD** — auto-deploy CDK on push to main, run tests
- [ ] `[BE]` **Integration tests** — test Lambda handlers against real DynamoDB local (Docker)
- [ ] `[BE]` **Backup strategy** — DynamoDB point-in-time recovery enabled

---

## Blocked

- [ ] `[FE+BE]` **Real-time price streaming** — blocked on: PSX doesn't provide a WebSocket feed; would need to run scraper faster (every 30s) and use API Gateway WebSocket or SSE — cost risk on free tier
- [ ] `[FE+BE]` **Fractional share support** — blocked on: PSX doesn't support fractional shares; not applicable
- [ ] `[BE]` **Options/derivatives tracking** — blocked on: PSX futures data not publicly available in machine-readable form
- [ ] `[FE+BE]` **Broker API integration** — blocked on: no PSX broker provides a public API yet; manual trade entry is the only option
- [ ] `[FE]` **iOS App Store release** — blocked on: Apple Developer account ($99/year) + EAS build setup

---

## Dropped / Won't Do

- ~~Amplify, SAM, or any CDK wrapper~~ — rule from day one, raw CDK only
- ~~PAY_PER_REQUEST DynamoDB~~ — locked to provisioned 25 RCU/WCU for free tier
