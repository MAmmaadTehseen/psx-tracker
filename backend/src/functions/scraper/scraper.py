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


def _parse_num(text, default=0.0):
    """Strip commas, %, spaces and convert to float."""
    try:
        return float(text.replace(',', '').replace('%', '').strip() or default)
    except (ValueError, AttributeError):
        return default


def scrape_prices():
    """
    Fetch current prices for all PSX-listed equities via the market-watch page.
    PSX removed the /data/equities JSON endpoint; the market-watch HTML table
    is the only reliable source for a full snapshot of all tickers at once.
    """
    try:
        resp = requests.get(
            f'{PSX_BASE}/market-watch',
            headers=HEADERS,
            timeout=30,
        )
        resp.raise_for_status()

        soup = BeautifulSoup(resp.text, 'lxml')
        table = soup.find('table')
        if not table:
            logger.error('market-watch: no table found in response')
            return []

        rows = table.find_all('tr')
        if not rows:
            return []

        # Build column-name → index map from the header row.
        # Column names vary slightly; normalise to uppercase with no trailing spaces.
        header_cells = rows[0].find_all(['th', 'td'])
        col = {cell.get_text(strip=True).upper(): i for i, cell in enumerate(header_cells)}

        # Expected columns: SYMBOL SECTOR LDCP OPEN HIGH LOW CURRENT CHANGE CHANGE(%) VOLUME
        # Map flexible aliases → canonical names
        aliases = {
            'CHANGE (%)': 'CHANGE(%)',
            'CHANGE(%)': 'CHANGE(%)',
            'CHG%': 'CHANGE(%)',
            'CURRENT': 'CURRENT',
        }
        for alias, canonical in aliases.items():
            if alias in col and canonical not in col:
                col[canonical] = col[alias]

        def cell_text(cells, name, default=''):
            idx = col.get(name)
            if idx is None or idx >= len(cells):
                return default
            return cells[idx].get_text(strip=True)

        prices = []
        for row in rows[1:]:
            cells = row.find_all('td')
            if len(cells) < 4:
                continue
            try:
                # Ticker may be wrapped in an <a> tag: <a href="/company/KEL">KEL</a>
                ticker_cell = cells[col.get('SYMBOL', 0)]
                ticker = ticker_cell.get_text(strip=True).upper()
                if not ticker:
                    continue

                close = _parse_num(cell_text(cells, 'CURRENT'))
                if close <= 0:
                    continue

                prices.append({
                    'ticker': ticker,
                    'name': ticker,   # market-watch has no company name; use ticker
                    'sector': cell_text(cells, 'SECTOR'),
                    'open':      _parse_num(cell_text(cells, 'OPEN')),
                    'high':      _parse_num(cell_text(cells, 'HIGH')),
                    'low':       _parse_num(cell_text(cells, 'LOW')),
                    'close':     close,
                    'volume':    int(_parse_num(cell_text(cells, 'VOLUME'))),
                    'change':    _parse_num(cell_text(cells, 'CHANGE')),
                    'changePct': _parse_num(cell_text(cells, 'CHANGE(%)')),
                    'ldcp':      _parse_num(cell_text(cells, 'LDCP')),
                    'pe': 0, 'eps': 0, 'bookValue': 0,
                })
            except (ValueError, TypeError, IndexError) as e:
                logger.warning(f'Skipping malformed market-watch row: {e}')

        return prices

    except requests.RequestException as e:
        logger.error(f'Failed to fetch market-watch: {e}')
        return []


# PSX timeseries symbol → our DynamoDB index name
_INDEX_MAP = {
    'KSE100': 'KSE_100',
    'KSE30':  'KSE_30',
    'KMI30':  'KMI_30',
}


def scrape_indices():
    """
    Fetch KSE-100, KSE-30, KMI-30 from the timeseries/eod endpoint.
    PSX removed /data/index_snapshot; the timeseries API is the current source.
    Each row is [timestamp, open, volume, close]. Change is calculated as
    close - previous_close using the two most recent rows.
    """
    indices = []
    for psx_sym, our_name in _INDEX_MAP.items():
        try:
            resp = requests.get(
                f'{PSX_BASE}/timeseries/eod/{psx_sym}',
                headers=HEADERS,
                timeout=15,
            )
            resp.raise_for_status()
            data = resp.json().get('data', [])
            if not data:
                continue

            # data[0] = most recent row: [timestamp, open, volume, close]
            latest = data[0]
            value = float(latest[3])
            volume = int(latest[2])

            # Day-over-day change requires a previous close
            if len(data) >= 2:
                prev_close = float(data[1][3])
                change = value - prev_close
                change_pct = (change / prev_close * 100) if prev_close else 0.0
            else:
                change, change_pct = 0.0, 0.0

            if value > 0:
                indices.append({
                    'name': our_name,
                    'value': value,
                    'change': change,
                    'changePct': change_pct,
                    'volume': volume,
                })

        except requests.RequestException as e:
            logger.error(f'Failed to fetch index {psx_sym}: {e}')

    return indices


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


