"""
PSX Data Scraper Lambda

Scrapes dps.psx.com.pk (PSX's public data portal) for:
  - Current stock prices (all tickers)
  - Index values (KSE-100, KSE-30, KMI-30)
  - Dividend payouts

Runs every 5 minutes during market hours via EventBridge cron.
Writes results to DynamoDB.

Why Python? requests + BeautifulSoup are the standard Python tools
for web scraping and are much simpler than Node.js alternatives.
"""

import json
import os
import time
import logging
from datetime import datetime, timezone
from decimal import Decimal

import boto3
import requests
from bs4 import BeautifulSoup
from boto3.dynamodb.conditions import Key

logger = logging.getLogger()
logger.setLevel(logging.INFO)

TABLE_NAME = os.environ['TABLE_NAME']

# Use boto3 resource (higher-level than client) for DynamoDB
# DynamoDB resource handles Decimal conversion automatically
dynamodb = boto3.resource('dynamodb')
table = dynamodb.Table(TABLE_NAME)

# PSX data portal base URL
PSX_BASE = 'https://dps.psx.com.pk'

HEADERS = {
    'User-Agent': (
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) '
        'AppleWebKit/537.36 (KHTML, like Gecko) '
        'Chrome/124.0.0.0 Safari/537.36'
    ),
    'Accept': 'application/json, text/html',
    'Referer': 'https://dps.psx.com.pk/',
}


def handler(event, context):
    """Lambda entry point — called by EventBridge on schedule."""
    logger.info('PSX scraper started')
    today = datetime.now(timezone.utc).strftime('%Y-%m-%d')

    try:
        prices = scrape_prices()
        if prices:
            write_prices(prices, today)
            logger.info(f'Wrote {len(prices)} stock prices')

            # Write METADATA on every run — fixes 404 on stock detail and keeps
            # name/sector/fundamentals current. Batch write is cheap (<1 WCU per item).
            write_fundamentals(prices)
            logger.info(f'Wrote {len(prices)} stock metadata items')

        indices = scrape_indices()
        if indices:
            write_indices(indices, today)
            logger.info(f'Wrote {len(indices)} index values')

        # Only scrape dividends on the EOD run.
        # The EOD EventBridge rule passes {"runType": "eod"} in its event input,
        # which is more reliable than checking the clock (the 5-min rule also
        # fires at 10:25 UTC, inside the same hour as EOD).
        if event.get('runType') == 'eod':
            dividends = scrape_dividends()
            if dividends:
                write_dividends(dividends)
                logger.info(f'Wrote {len(dividends)} dividend records')

    except Exception as e:
        logger.error(f'Scraper failed: {e}', exc_info=True)
        raise

    return {'statusCode': 200, 'body': 'Scrape complete'}


def scrape_prices():
    """
    Fetch current prices for all PSX-listed equities.
    The PSX data portal exposes a JSON endpoint used by their own website.
    We use the same endpoint — it's public and returns structured data.
    """
    try:
        # PSX data portal uses a JSON API internally
        resp = requests.get(
            f'{PSX_BASE}/data/equities',
            headers=HEADERS,
            timeout=30,
        )
        resp.raise_for_status()
        data = resp.json()

        prices = []
        for item in data.get('data', []):
            try:
                prices.append({
                    'ticker': item.get('symbol', '').upper(),
                    'name': item.get('name', '') or item.get('company_name', ''),
                    'sector': item.get('sector', '') or item.get('sector_name', ''),
                    'open': float(item.get('open', 0) or 0),
                    'high': float(item.get('high', 0) or 0),
                    'low': float(item.get('low', 0) or 0),
                    'close': float(item.get('current', 0) or 0),
                    'volume': int(item.get('volume', 0) or 0),
                    'change': float(item.get('change', 0) or 0),
                    'changePct': float(item.get('change_p', 0) or 0),
                    'ldcp': float(item.get('ldcp', 0) or 0),
                    # PSX API may include these; default to 0 if absent
                    'pe': float(item.get('pe', 0) or item.get('pe_ratio', 0) or 0),
                    'eps': float(item.get('eps', 0) or 0),
                    'bookValue': float(item.get('bv', 0) or item.get('book_value', 0) or 0),
                })
            except (ValueError, TypeError) as e:
                logger.warning(f"Skipping malformed item {item.get('symbol')}: {e}")

        return [p for p in prices if p['ticker'] and p['close'] > 0]

    except requests.RequestException as e:
        logger.error(f'Failed to fetch prices: {e}')
        return []


def scrape_indices():
    """Fetch KSE-100, KSE-30, KMI-30 index values."""
    try:
        resp = requests.get(
            f'{PSX_BASE}/data/index_snapshot',
            headers=HEADERS,
            timeout=15,
        )
        resp.raise_for_status()
        data = resp.json()

        indices = []
        for item in data.get('data', []):
            indices.append({
                'name': item.get('index_name', '').replace(' ', '_').replace('-', '_').upper(),
                'value': float(item.get('current', 0) or 0),
                'change': float(item.get('change', 0) or 0),
                'changePct': float(item.get('change_p', 0) or 0),
                'volume': int(item.get('volume', 0) or 0),
            })

        return [i for i in indices if i['value'] > 0]

    except requests.RequestException as e:
        logger.error(f'Failed to fetch indices: {e}')
        return []


def scrape_dividends():
    """
    Scrape dividend payout announcements from dps.psx.com.pk/payouts.
    This page is HTML, so we parse it with BeautifulSoup.
    """
    try:
        resp = requests.get(f'{PSX_BASE}/payouts', headers=HEADERS, timeout=30)
        resp.raise_for_status()

        soup = BeautifulSoup(resp.text, 'lxml')
        # Find the payouts table — inspect the page in browser DevTools to find the selector
        table_el = soup.find('table', {'class': 'tbl'}) or soup.find('table')
        if not table_el:
            logger.warning('Dividends table not found on payouts page')
            return []

        dividends = []
        rows = table_el.find_all('tr')[1:]  # skip header row
        for row in rows:
            cols = [td.get_text(strip=True) for td in row.find_all('td')]
            if len(cols) < 5:
                continue
            try:
                dividends.append({
                    'ticker': cols[0].upper(),
                    'announceDate': cols[1],
                    'exDate': cols[2],
                    'payDate': cols[3],
                    'amount': float(cols[4].replace(',', '') or 0),
                    'type': detect_dividend_type(cols),
                })
            except (ValueError, IndexError):
                continue

        return [d for d in dividends if d['ticker'] and d['amount'] > 0]

    except requests.RequestException as e:
        logger.error(f'Failed to fetch dividends: {e}')
        return []


def detect_dividend_type(cols):
    text = ' '.join(cols).lower()
    if 'bonus' in text:
        return 'bonus'
    if 'right' in text:
        return 'right'
    return 'cash'


def write_prices(prices, date):
    """Batch-write price items to DynamoDB."""
    # DynamoDB batch_writer handles chunking into batches of 25 (the API limit)
    with table.batch_writer() as batch:
        for p in prices:
            batch.put_item(Item={
                'PK': f"STOCK#{p['ticker']}",
                'SK': f"PRICE#{date}",
                'open': Decimal(str(p['open'])),
                'high': Decimal(str(p['high'])),
                'low': Decimal(str(p['low'])),
                'close': Decimal(str(p['close'])),
                'volume': p['volume'],
                'change': Decimal(str(p['change'])),
                'changePct': Decimal(str(p['changePct'])),
                'ldcp': Decimal(str(p['ldcp'])),
                'updatedAt': datetime.now(timezone.utc).isoformat(),
            })


def write_fundamentals(prices):
    """
    Write STOCK#<ticker> METADATA items to DynamoDB.

    Runs on every scraper invocation so the stock detail page never 404s.
    PE/EPS/bookValue are included if the PSX equities API returns them; they
    stay 0 otherwise — at minimum, name and sector are always populated.
    """
    with table.batch_writer() as batch:
        for p in prices:
            if not p['ticker']:
                continue
            item = {
                'PK': f"STOCK#{p['ticker']}",
                'SK': 'METADATA',
                'ticker': p['ticker'],
                'name': p['name'],
                'sector': p['sector'],
                'updatedAt': datetime.now(timezone.utc).isoformat(),
            }
            # Only write numeric fundamentals if non-zero — avoids overwriting
            # real data with zeros if the API drops a field temporarily.
            if p['pe']:
                item['pe'] = Decimal(str(round(p['pe'], 2)))
            if p['eps']:
                item['eps'] = Decimal(str(round(p['eps'], 2)))
            if p['bookValue']:
                item['bookValue'] = Decimal(str(round(p['bookValue'], 2)))
            batch.put_item(Item=item)


def write_indices(indices, date):
    """
    Write index values to DynamoDB in two forms:
      - SK=LATEST:      overwritten every scraper run — used by the live index cards
      - SK=PRICE#{date}: one item per day — used for historical index charts

    Why both? LATEST gives us O(1) read for the live display. PRICE#{date} lets us
    query 'give me all index values from the last 30 days' with a range key query.
    """
    with table.batch_writer() as batch:
        for idx in indices:
            item_base = {
                'value': Decimal(str(idx['value'])),
                'change': Decimal(str(idx['change'])),
                'changePct': Decimal(str(idx['changePct'])),
                'volume': idx['volume'],
                'updatedAt': datetime.now(timezone.utc).isoformat(),
            }
            # Overwrite the live snapshot
            batch.put_item(Item={
                'PK': f"INDEX#{idx['name']}",
                'SK': 'LATEST',
                **item_base,
            })
            # Write the daily historical snapshot (idempotent: last write of the day wins)
            batch.put_item(Item={
                'PK': f"INDEX#{idx['name']}",
                'SK': f"PRICE#{date}",
                **item_base,
            })


def write_dividends(dividends):
    """Write dividend records to DynamoDB (use exDate as part of SK)."""
    with table.batch_writer() as batch:
        for d in dividends:
            ex_date = d.get('exDate', 'UNKNOWN').replace('/', '-')
            batch.put_item(Item={
                'PK': f"STOCK#{d['ticker']}",
                'SK': f"DIV#{ex_date}",
                'announceDate': d.get('announceDate', ''),
                'payDate': d.get('payDate', ''),
                'amount': Decimal(str(d['amount'])),
                'type': d['type'],
            })


