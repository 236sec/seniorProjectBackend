import json
import os
import sys
from datetime import datetime
import indicators as ind
import coingecko as cg

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA_DIR = os.path.join(BASE_DIR, 'data')
DEFAULT_PRICE_FILE = 'bitcoin.json'
DEFAULT_RSI_FILE = 'bitcoin-rsi.json'


def _build_output_path(file_name: str) -> str:
    return file_name if os.path.isabs(file_name) else os.path.join(DATA_DIR, file_name)


def _atomic_write(payload: dict, output_file: str):
    """Write JSON payload atomically to avoid partially written files."""
    output_path = _build_output_path(output_file)
    os.makedirs(os.path.dirname(output_path), exist_ok=True)

    temp_file = output_path + '.tmp'
    with open(temp_file, 'w') as f:
        json.dump(payload, f, indent=4)

    os.replace(temp_file, output_path)
    print(f"Wrote {output_path}")


def save_price_history(df, output_file: str = DEFAULT_PRICE_FILE):
    records = (
        df[['date', 'price']]
        .assign(date=lambda x: x['date'].dt.strftime('%Y-%m-%d'))
        .to_dict(orient='records')
    )

    payload = {
        "last_updated": datetime.now().isoformat(),
        "data": records
    }

    _atomic_write(payload, output_file)


def save_indicator(df, column: str, output_file: str):
    if column not in df.columns:
        raise ValueError(f"Column '{column}' not found in DataFrame")

    records = (
        df.dropna(subset=[column])
        [['date', column]]
        .rename(columns={column: 'value'})
        .assign(date=lambda x: x['date'].dt.strftime('%Y-%m-%d'))
        .to_dict(orient='records')
    )

    payload = {
        "last_updated": datetime.now().isoformat(),
        "data": records
    }

    _atomic_write(payload, output_file)

if __name__ == "__main__":
    # You can pass the coin_id from NestJS: spawn('python', ['script.py', 'ethereum'])
    target_coin = sys.argv[1] if len(sys.argv) > 1 else 'bitcoin'
    price_file = f"{target_coin}.json"
    rsi_file = f"{target_coin}-rsi.json"
    sma_window = 20
    ema_span = 20
    sma_file = f"{target_coin}-sma{sma_window}.json"
    ema_file = f"{target_coin}-ema{ema_span}.json"
    
    print(f"Starting analysis for {target_coin}...")
    btc_data = cg.get_coingecko_market_chart(target_coin)
    btc_data['rsi'] = ind.calculate_rsi(btc_data, price_col='price')['rsi']
    btc_data['sma20'] = ind.calculate_sma(btc_data, window=sma_window, price_col='price')
    btc_data['ema20'] = ind.calculate_ema(btc_data, span=ema_span, price_col='price')
    

    save_price_history(btc_data, price_file)
    save_indicator(btc_data, 'rsi', rsi_file)
    save_indicator(btc_data, 'sma20', sma_file)
    save_indicator(btc_data, 'ema20', ema_file)