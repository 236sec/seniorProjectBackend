import requests
import pandas as pd
import json
import os
import sys
from datetime import datetime

# 1. HANDLE DIRECTORY PATHS
# When NestJS triggers this, 'cwd' (current working directory) might be different.
# We force the script to find the project root.
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA_DIR = os.path.join(BASE_DIR, 'data')
OUTPUT_FILE = os.path.join(DATA_DIR, 'metrics.json')

def get_coingecko_data(coin_id='bitcoin', days=365):
    """Fetch historical price data from CoinGecko"""
    try:
        url = f"https://api.coingecko.com/api/v3/coins/{coin_id}/market_chart"
        params = {'vs_currency': 'usd', 'days': days, 'interval': 'daily'}
        
        response = requests.get(url, params=params, timeout=10)
        response.raise_for_status() # Trigger error for 4xx/5xx responses
        data = response.json()
        
        prices = data['prices']
        df = pd.DataFrame(prices, columns=['timestamp', 'price'])
        df['date'] = pd.to_datetime(df['timestamp'], unit='ms')
        return df
    except Exception as e:
        # NestJS will capture this in the .stderr.on('data') listener
        print(f"Error fetching data: {e}", file=sys.stderr)
        sys.exit(1)

def calculate_rsi(df, period=14):
    """Calculate Relative Strength Index (RSI)"""
    delta = df['price'].diff()
    gain = (delta.where(delta > 0, 0)).rolling(window=period).mean()
    loss = (-delta.where(delta < 0, 0)).rolling(window=period).mean()
    
    rs = gain / loss
    df['rsi'] = 100 - (100 / (1 + rs))
    return df

def save_metrics(df, output_file=OUTPUT_FILE):
    """Saves data to a shared volume for NestJS to read"""
    try:
        # Ensure the data directory exists
        if not os.path.exists(DATA_DIR):
            os.makedirs(DATA_DIR)

        result_df = df.dropna(subset=['rsi'])
        data_to_save = result_df[['date', 'price', 'rsi']].to_dict(orient='records')
        
        for record in data_to_save:
            record['date'] = record['date'].strftime('%Y-%m-%d')

        # Atomic write: save to a temp file then rename to prevent NestJS 
        # from reading a half-written file.
        output_path_file = os.path.join(DATA_DIR, output_file)
        temp_file = output_path_file + '.tmp'
        with open(temp_file, 'w') as f:
            json.dump({
                "last_updated": datetime.now().isoformat(),
                "data": data_to_save
            }, f, indent=4)
        
        os.replace(temp_file, output_path_file)
        print(f"Metrics successfully updated at {output_path_file}")
        
    except Exception as e:
        print(f"Error saving file: {e}", file=sys.stderr)
        sys.exit(1)

if __name__ == "__main__":
    # You can pass the coin_id from NestJS: spawn('python', ['script.py', 'ethereum'])
    target_coin = sys.argv[1] if len(sys.argv) > 1 else 'bitcoin'
    
    print(f"Starting analysis for {target_coin}...")
    btc_data = get_coingecko_data(target_coin)
    btc_data = calculate_rsi(btc_data)
    save_metrics(btc_data, 'bitcoin.json')