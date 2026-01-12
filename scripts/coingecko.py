import sys
import requests
import pandas as pd
from datetime import datetime

def get_coingecko_market_chart(coin_id='bitcoin', days=365):
    """Fetch historical price data from CoinGecko"""
    try:
        url = f"https://api.coingecko.com/api/v3/coins/{coin_id}/market_chart"
        params = {'vs_currency': 'usd', 'days': days, 'interval': 'daily'}
        
        response = requests.get(url, params=params, timeout=10)
        response.raise_for_status() # Trigger error for 4xx/5xx responses
        data = response.json()
        
        prices = data['prices']
        volumes = data['total_volumes']
        
        df_prices = pd.DataFrame(prices, columns=['timestamp', 'price'])
        df_volumes = pd.DataFrame(volumes, columns=['timestamp', 'volume'])
        
        # Merge on timestamp
        df = pd.merge(df_prices, df_volumes, on='timestamp')
        df['date'] = pd.to_datetime(df['timestamp'], unit='ms')
        return df
    except Exception as e:
        # NestJS will capture this in the .stderr.on('data') listener
        print(f"Error fetching data: {e}", file=sys.stderr)
        sys.exit(1)

def get_coingecko_ohlc(coin_id='bitcoin', days=365):
    """Fetch OHLC data from CoinGecko"""
    try:
        url = f"https://api.coingecko.com/api/v3/coins/{coin_id}/ohlc"
        params = {'vs_currency': 'usd', 'days': days}
        
        response = requests.get(url, params=params, timeout=10)
        response.raise_for_status()
        data = response.json()
        
        df = pd.DataFrame(data, columns=['timestamp', 'open', 'high', 'low', 'close'])
        df['date'] = pd.to_datetime(df['timestamp'], unit='ms')
        return df
    except Exception as e:
        print(f"Error fetching OHLC data: {e}", file=sys.stderr)
        sys.exit(1)