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


def seed_current(table):
    """
    Write today's stock prices, metadata, and index values.
    Same data the scraper writes on every run — works outside market hours too
    (PSX returns last-known prices).
    """
    today = datetime.now(timezone.utc).strftime('%Y-%m-%d')
    now = datetime.now(timezone.utc).isoformat()

    # Stock prices + metadata
    logger.info('Fetching current equities from dps.psx.com.pk...')
    resp = requests.get(f'{PSX_BASE}/data/equities', headers=HEADERS, timeout=30)
    resp.raise_for_status()

    price_items = []
    meta_items = []
    for item in resp.json().get('data', []):
        ticker = item.get('symbol', '').upper()
        close = float(item.get('current', 0) or 0)
        if not ticker or close <= 0:
            continue

        price_items.append({
            'PK': f'STOCK#{ticker}',
            'SK': f'PRICE#{today}',
            'open': to_decimal(item.get('open', 0)),
            'high': to_decimal(item.get('high', 0)),
            'low': to_decimal(item.get('low', 0)),
            'close': to_decimal(close),
            'volume': int(item.get('volume', 0) or 0),
            'change': to_decimal(item.get('change', 0)),
            'changePct': to_decimal(item.get('change_p', 0)),
            'ldcp': to_decimal(item.get('ldcp', 0)),
            'updatedAt': now,
        })

        meta = {
            'PK': f'STOCK#{ticker}',
            'SK': 'METADATA',
            'ticker': ticker,
            'name': item.get('name', '') or item.get('company_name', ''),
            'sector': item.get('sector', '') or item.get('sector_name', ''),
            'updatedAt': now,
        }
        pe = float(item.get('pe', 0) or 0)
        eps = float(item.get('eps', 0) or 0)
        bv = float(item.get('bv', 0) or item.get('book_value', 0) or 0)
        if pe:
            meta['pe'] = to_decimal(pe)
        if eps:
            meta['eps'] = to_decimal(eps)
        if bv:
            meta['bookValue'] = to_decimal(bv)
        meta_items.append(meta)

    batch_write(table, price_items, 'stock price items')
    batch_write(table, meta_items, 'stock metadata items')

    # Indices
    logger.info('Fetching index snapshot...')
    resp = requests.get(f'{PSX_BASE}/data/index_snapshot', headers=HEADERS, timeout=15)
    resp.raise_for_status()

    index_items = []
    for item in resp.json().get('data', []):
        # Normalise: "KSE 100" → "KSE_100", "KSE-100" → "KSE_100"
        name = item.get('index_name', '').replace(' ', '_').replace('-', '_').upper()
        value = float(item.get('current', 0) or 0)
        if not name or value <= 0:
            continue
        base = {
            'value': to_decimal(value),
            'change': to_decimal(item.get('change', 0)),
            'changePct': to_decimal(item.get('change_p', 0)),
            'volume': int(item.get('volume', 0) or 0),
            'updatedAt': now,
        }
        index_items.append({'PK': f'INDEX#{name}', 'SK': 'LATEST', **base})
        index_items.append({'PK': f'INDEX#{name}', 'SK': f'PRICE#{today}', **base})

    batch_write(table, index_items, 'index items')
    logger.info('Current data seeded.')


def get_all_tickers() -> list[str]:
    resp = requests.get(f'{PSX_BASE}/data/equities', headers=HEADERS, timeout=30)
    resp.raise_for_status()
    tickers = [
        item.get('symbol', '').upper()
        for item in resp.json().get('data', [])
        if item.get('symbol')
    ]
    logger.info(f'Found {len(tickers)} tickers')
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
