#!/usr/bin/env python3
"""
Seed DynamoDB with PSX market data.

Why: the scraper only runs Mon-Fri 04:15-10:30 UTC. This script lets you
populate the table on demand — either just today's snapshot (fast) or a full
historical backfill so candlestick charts have data.

Usage:
  pip install psx boto3 requests

  # Current prices + indices only (~30 seconds)
  TABLE_NAME=psx-tracker AWS_REGION=us-east-1 python seed.py --current-only

  # Last 30 days for specific tickers (good for dev testing)
  TABLE_NAME=psx-tracker AWS_REGION=us-east-1 python seed.py --days 30 --tickers ENGRO,LUCK,MCB

  # Full 90-day backfill for all ~500 stocks (~20 min, respects free-tier 25 WCU/s)
  TABLE_NAME=psx-tracker AWS_REGION=us-east-1 python seed.py --days 90
"""

import os
import sys
import time
import logging
import argparse
from datetime import date, timedelta, datetime, timezone
from decimal import Decimal, InvalidOperation

import boto3
import requests

logging.basicConfig(level=logging.INFO, format='%(asctime)s %(levelname)s %(message)s')
logger = logging.getLogger(__name__)

TABLE_NAME = os.environ.get('TABLE_NAME', 'psx-tracker')
REGION = os.environ.get('AWS_REGION', 'us-east-1')

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

# Free tier: 25 WCU provisioned. BatchWriteItem costs 1 WCU per item.
# 25 items/batch = 25 WCU/batch. 1 batch/second = 25 WCU/s (right at the cap).
BATCH_SIZE = 25
BATCH_SLEEP = 1.0  # seconds between batches; increase if you see ThrottlingException


def to_decimal(value) -> Decimal:
    try:
        return Decimal(str(round(float(value or 0), 4)))
    except (InvalidOperation, TypeError, ValueError):
        return Decimal('0')


def batch_write(table, items: list, label: str = ''):
    """Write items to DynamoDB in rate-limited batches of 25."""
    if not items:
        return
    if label:
        logger.info(f'Writing {len(items)} {label}...')
    for i in range(0, len(items), BATCH_SIZE):
        chunk = items[i:i + BATCH_SIZE]
        with table.batch_writer() as writer:
            for item in chunk:
                writer.put_item(Item=item)
        time.sleep(BATCH_SLEEP)


def _parse_num(text, default=0.0):
    try:
        return float(str(text).replace(',', '').replace('%', '').strip() or default)
    except (ValueError, AttributeError):
        return default


def seed_current(table):
    """
    Write today's stock prices, metadata, and index values.
    Uses the market-watch HTML table (PSX removed the /data/equities JSON endpoint)
    and timeseries/eod for indices. Works outside market hours — PSX returns
    last-known prices.
    """
    from bs4 import BeautifulSoup

    today = datetime.now(timezone.utc).strftime('%Y-%m-%d')
    now = datetime.now(timezone.utc).isoformat()

    # --- Stock prices + metadata via market-watch HTML ---
    logger.info('Fetching market-watch from dps.psx.com.pk...')
    resp = requests.get(f'{PSX_BASE}/market-watch', headers=HEADERS, timeout=30)
    resp.raise_for_status()

    soup = BeautifulSoup(resp.text, 'lxml')
    table_el = soup.find('table')
    if not table_el:
        raise RuntimeError('market-watch: no table found')

    rows = table_el.find_all('tr')
    header_cells = rows[0].find_all(['th', 'td'])
    col = {cell.get_text(strip=True).upper(): i for i, cell in enumerate(header_cells)}
    # normalise aliases
    for alias, canon in [('CHANGE (%)', 'CHANGE(%)'), ('CHG%', 'CHANGE(%)')]:
        if alias in col and 'CHANGE(%)' not in col:
            col['CHANGE(%)'] = col[alias]

    def cell_val(cells, name, default=''):
        idx = col.get(name)
        return cells[idx].get_text(strip=True) if idx is not None and idx < len(cells) else default

    price_items, meta_items = [], []
    for row in rows[1:]:
        cells = row.find_all('td')
        if len(cells) < 4:
            continue
        ticker = cells[col.get('SYMBOL', 0)].get_text(strip=True).upper()
        close = _parse_num(cell_val(cells, 'CURRENT'))
        if not ticker or close <= 0:
            continue

        price_items.append({
            'PK': f'STOCK#{ticker}', 'SK': f'PRICE#{today}',
            'open':      to_decimal(cell_val(cells, 'OPEN')),
            'high':      to_decimal(cell_val(cells, 'HIGH')),
            'low':       to_decimal(cell_val(cells, 'LOW')),
            'close':     to_decimal(close),
            'volume':    int(_parse_num(cell_val(cells, 'VOLUME'))),
            'change':    to_decimal(cell_val(cells, 'CHANGE')),
            'changePct': to_decimal(cell_val(cells, 'CHANGE(%)')),
            'ldcp':      to_decimal(cell_val(cells, 'LDCP')),
            'updatedAt': now,
        })
        meta_items.append({
            'PK': f'STOCK#{ticker}', 'SK': 'METADATA',
            'ticker': ticker,
            'name': ticker,   # market-watch has no full company name
            'sector': cell_val(cells, 'SECTOR'),
            'updatedAt': now,
        })

    batch_write(table, price_items, 'stock price items')
    batch_write(table, meta_items, 'stock metadata items')

    # --- Indices via timeseries/eod ---
    logger.info('Fetching index values...')
    index_map = {'KSE100': 'KSE_100', 'KSE30': 'KSE_30', 'KMI30': 'KMI_30'}
    index_items = []
    for psx_sym, our_name in index_map.items():
        resp = requests.get(f'{PSX_BASE}/timeseries/eod/{psx_sym}', headers=HEADERS, timeout=15)
        if not resp.ok:
            logger.warning(f'Index {psx_sym} returned {resp.status_code}')
            continue
        data = resp.json().get('data', [])
        if not data:
            continue
        latest = data[0]   # [timestamp, open, volume, close]
        value = float(latest[3])
        volume = int(latest[2])
        if len(data) >= 2:
            prev = float(data[1][3])
            change = value - prev
            change_pct = (change / prev * 100) if prev else 0.0
        else:
            change, change_pct = 0.0, 0.0
        if value <= 0:
            continue
        base = {
            'value': to_decimal(value), 'change': to_decimal(change),
            'changePct': to_decimal(change_pct), 'volume': volume,
            'updatedAt': now,
        }
        index_items.append({'PK': f'INDEX#{our_name}', 'SK': 'LATEST', **base})
        index_items.append({'PK': f'INDEX#{our_name}', 'SK': f'PRICE#{today}', **base})

    batch_write(table, index_items, 'index items')
    logger.info('Current data seeded.')


def get_all_tickers() -> list[str]:
    """Get all PSX ticker symbols from the market-watch page.
    PSX removed /data/equities; market-watch is the only full-snapshot source.
    """
    from bs4 import BeautifulSoup
    resp = requests.get(f'{PSX_BASE}/market-watch', headers=HEADERS, timeout=30)
    resp.raise_for_status()
    soup = BeautifulSoup(resp.text, 'lxml')
    table_el = soup.find('table')
    if not table_el:
        raise RuntimeError('market-watch: no table found — cannot discover tickers')
    rows = table_el.find_all('tr')
    if not rows:
        return []
    header_cells = rows[0].find_all(['th', 'td'])
    col = {cell.get_text(strip=True).upper(): i for i, cell in enumerate(header_cells)}
    sym_idx = col.get('SYMBOL', 0)
    tickers = []
    for row in rows[1:]:
        cells = row.find_all('td')
        if len(cells) > sym_idx:
            t = cells[sym_idx].get_text(strip=True).upper()
            if t:
                tickers.append(t)
    logger.info(f'Found {len(tickers)} tickers from market-watch')
    return tickers


def seed_historical(table, tickers: list[str], days: int):
    """
    Backfill OHLCV prices using the `psx` Python library.
    Writes STOCK#{ticker} PRICE#{date} items for each day in range.
    """
    try:
        from psx import stocks as psx_stocks
    except ImportError:
        logger.error('psx library not installed. Run: pip install psx')
        logger.error('Skipping historical backfill.')
        return

    end = date.today()
    start = end - timedelta(days=days)
    logger.info(f'Backfilling {days} days ({start} → {end}) for {len(tickers)} tickers')

    est_minutes = (len(tickers) * days / BATCH_SIZE * BATCH_SLEEP) / 60
    logger.info(f'Estimated time: ~{est_minutes:.0f} min (tip: use --tickers for a subset)')

    total = 0
    errors = 0
    now = datetime.now(timezone.utc).isoformat()

    for i, ticker in enumerate(tickers):
        try:
            df = psx_stocks(ticker, start=start, end=end)
            if df is None or df.empty:
                continue

            items = []
            for idx_date, row in df.iterrows():
                price_date = (
                    idx_date.strftime('%Y-%m-%d')
                    if hasattr(idx_date, 'strftime')
                    else str(idx_date)[:10]
                )
                items.append({
                    'PK': f'STOCK#{ticker}',
                    'SK': f'PRICE#{price_date}',
                    'open': to_decimal(row.get('Open', 0)),
                    'high': to_decimal(row.get('High', 0)),
                    'low': to_decimal(row.get('Low', 0)),
                    'close': to_decimal(row.get('Close', 0)),
                    'volume': int(row.get('Volume', 0) or 0),
                    'change': Decimal('0'),
                    'changePct': Decimal('0'),
                    'ldcp': Decimal('0'),
                    'updatedAt': now,
                })

            batch_write(table, items)
            total += len(items)

        except Exception as e:
            errors += 1
            logger.warning(f'{ticker}: {e}')

        if (i + 1) % 25 == 0:
            logger.info(f'Progress: {i+1}/{len(tickers)} tickers | {total} items written | {errors} errors')

    logger.info(f'Historical seed done. {total} items written, {errors} ticker errors.')


def main():
    parser = argparse.ArgumentParser(description='Seed psx-tracker DynamoDB with market data')
    parser.add_argument('--days', type=int, default=90,
                        help='Days of historical data to backfill (default: 90)')
    parser.add_argument('--tickers', type=str, default=None,
                        help='Comma-separated tickers (default: all PSX stocks)')
    parser.add_argument('--current-only', action='store_true',
                        help="Seed today's snapshot only, skip historical backfill")
    args = parser.parse_args()

    dynamodb = boto3.resource('dynamodb', region_name=REGION)
    table = dynamodb.Table(TABLE_NAME)

    logger.info(f'Table: {TABLE_NAME} | Region: {REGION}')

    seed_current(table)

    if args.current_only:
        return

    tickers = (
        [t.strip().upper() for t in args.tickers.split(',')]
        if args.tickers
        else get_all_tickers()
    )
    seed_historical(table, tickers, args.days)


if __name__ == '__main__':
    main()
