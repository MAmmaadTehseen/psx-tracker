"""
One-time historical data seeder.

Run this ONCE after deploying to load historical PSX data into DynamoDB.
Uses psx-data-reader library (pip install psx) to download historical prices
and stock metadata from PSX's public website.

Usage:
  pip install psx boto3
  TABLE_NAME=psx-tracker AWS_REGION=us-east-1 python seed_historical.py

The script is idempotent — running it twice won't create duplicates.
"""

import os
import sys
import time
import logging
from decimal import Decimal
from datetime import datetime, timedelta

import boto3

logging.basicConfig(level=logging.INFO, format='%(asctime)s %(levelname)s %(message)s')
logger = logging.getLogger()

TABLE_NAME = os.environ.get('TABLE_NAME', 'psx-tracker')
AWS_REGION = os.environ.get('AWS_REGION', 'us-east-1')

dynamodb = boto3.resource('dynamodb', region_name=AWS_REGION)
table = dynamodb.Table(TABLE_NAME)

# PSX sector mapping — used to populate metadata
SECTORS = {
    'ENGRO': 'Fertilizer',
    'LUCK': 'Cement',
    'HUBC': 'Power Generation',
    'MCB': 'Banks',
    'HBL': 'Banks',
    'UBL': 'Banks',
    'PSO': 'Oil & Gas',
    'OGDC': 'Oil & Gas Exploration',
    'PPL': 'Oil & Gas Exploration',
    'MARI': 'Oil & Gas Exploration',
    'SYS': 'Technology',
    'TRG': 'Technology',
    'NESTLE': 'Food & Personal Care',
    'UNILEVER': 'Food & Personal Care',
    'ICI': 'Chemicals',
}


def seed_with_psx_library():
    """Use the psx Python library to fetch historical data."""
    try:
        import psx
    except ImportError:
        logger.error('Run: pip install psx')
        sys.exit(1)

    tickers = list(SECTORS.keys())
    end = datetime.today()
    start = end - timedelta(days=365 * 3)  # 3 years of history

    logger.info(f'Seeding {len(tickers)} stocks from {start.date()} to {end.date()}')

    for ticker in tickers:
        logger.info(f'Fetching {ticker}...')
        try:
            # psx.stocks() returns a pandas DataFrame with OHLCV data
            df = psx.stocks(ticker, start=start, end=end)
            if df is None or df.empty:
                logger.warning(f'No data for {ticker}')
                continue

            rows = df.reset_index().to_dict('records')
            write_price_batch(ticker, rows)
            logger.info(f'{ticker}: {len(rows)} rows written')

            # Write metadata
            write_metadata(ticker)

            # PSX rate-limits scrapers — be polite
            time.sleep(1)

        except Exception as e:
            logger.error(f'Failed for {ticker}: {e}')
            continue

    logger.info('Seed complete!')


def write_price_batch(ticker, rows):
    with table.batch_writer() as batch:
        for row in rows:
            date_str = (
                row.get('Date') or row.get('date') or
                row.get('index', '')
            )
            if hasattr(date_str, 'strftime'):
                date_str = date_str.strftime('%Y-%m-%d')
            else:
                date_str = str(date_str)[:10]

            close = float(row.get('Close', row.get('close', 0)) or 0)
            if close <= 0:
                continue

            prev_close = float(row.get('LDCP', row.get('ldcp', close)) or close)
            change = round(close - prev_close, 2)
            change_pct = round((change / prev_close * 100) if prev_close else 0, 2)

            batch.put_item(Item={
                'PK': f'STOCK#{ticker}',
                'SK': f'PRICE#{date_str}',
                'open': Decimal(str(float(row.get('Open', row.get('open', close)) or close))),
                'high': Decimal(str(float(row.get('High', row.get('high', close)) or close))),
                'low': Decimal(str(float(row.get('Low', row.get('low', close)) or close))),
                'close': Decimal(str(close)),
                'volume': int(row.get('Volume', row.get('volume', 0)) or 0),
                'change': Decimal(str(change)),
                'changePct': Decimal(str(change_pct)),
                'ldcp': Decimal(str(prev_close)),
                'seeded': True,
            })


def write_metadata(ticker):
    table.put_item(Item={
        'PK': f'STOCK#{ticker}',
        'SK': 'METADATA',
        'ticker': ticker,
        'sector': SECTORS.get(ticker, 'Other'),
        'name': ticker,  # will be updated by scraper with full name
    })


if __name__ == '__main__':
    seed_with_psx_library()
