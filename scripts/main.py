import json
import os
import sys
import pandas as pd
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


def save_multi_column_indicator(df, columns: list[str], output_file: str):
    missing = [c for c in columns if c not in df.columns]
    if missing:
        raise ValueError(f"Columns {missing} not found in DataFrame")

    records = (
        df.dropna(subset=columns)
        [['date'] + columns]
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
    
    # 1. Market Chart File Paths
    price_file = f"{target_coin}.json"
    rsi_file = f"{target_coin}-rsi.json"
    sma_window = 20
    ema_span = 20
    sma_file = f"{target_coin}-sma{sma_window}.json"
    ema_file = f"{target_coin}-ema{ema_span}.json"
    macd_file = f"{target_coin}-macd.json"
    obv_file = f"{target_coin}-obv.json"
    
    # New Indicators
    zscore_file = f"{target_coin}-zscore.json"
    volatility_file = f"{target_coin}-volatility.json"
    coppock_file = f"{target_coin}-coppock.json"
    hma_file = f"{target_coin}-hma.json"
    kalman_file = f"{target_coin}-kalman.json"
    
    # Keeping Bollinger (Close-Only) from previous set as requested to modify/keep
    bollinger_file = f"{target_coin}-bollinger.json"
    
    print(f"Starting analysis for {target_coin}...")
    
    # --- Process Market Chart Data ---
    btc_data = cg.get_coingecko_market_chart(target_coin)
    
    # Basic
    btc_data['rsi'] = ind.calculate_rsi(btc_data, price_col='price')['rsi']
    btc_data['sma20'] = ind.calculate_sma(btc_data, window=sma_window, price_col='price')
    btc_data['ema20'] = ind.calculate_ema(btc_data, span=ema_span, price_col='price')
    
    # OBV
    if 'volume' in btc_data.columns:
        btc_data = ind.calculate_obv(btc_data, price_col='price', vol_col='volume')
        save_indicator(btc_data, 'obv', obv_file)
    
    # MACD
    macd_df = ind.calculate_macd(btc_data, price_col='price')
    btc_data = pd.concat([btc_data, macd_df], axis=1)

    # Bollinger Bands (Close-Only)
    # Using the daily 'price' as close.
    btc_data = ind.calculate_bollinger_bands(btc_data, price_col='price')

    # Z-Score
    btc_data = ind.calculate_z_score(btc_data, price_col='price')
    
    # Historical Volatility
    btc_data = ind.calculate_historical_volatility(btc_data, price_col='price')
    
    # Coppock Curve
    btc_data = ind.calculate_coppock_curve(btc_data, price_col='price')
    
    # Hull Moving Average
    btc_data = ind.calculate_hma(btc_data, price_col='price')
    
    # Kalman Filter
    btc_data = ind.calculate_kalman_filter(btc_data, price_col='price')

    # --- Save Indicators ---
    save_price_history(btc_data, price_file)
    save_indicator(btc_data, 'rsi', rsi_file)
    save_indicator(btc_data, 'sma20', sma_file)
    save_indicator(btc_data, 'ema20', ema_file)
    save_multi_column_indicator(btc_data, ['macd_line', 'signal_line', 'macd_hist'], macd_file)
    
    # Bollinger Bands (3 lines)
    save_multi_column_indicator(btc_data, ['bb_upper', 'bb_middle', 'bb_lower'], bollinger_file)
    
    # New Single Value Indicators
    save_indicator(btc_data, 'z_score', zscore_file)
    save_indicator(btc_data, 'historical_volatility', volatility_file)
    save_indicator(btc_data, 'coppock', coppock_file)
    save_indicator(btc_data, 'hma', hma_file)
    save_indicator(btc_data, 'kalman', kalman_file)
    
    print(f"Calculated and saved all indicators for {target_coin}.")
    
    # Removed OHLC block as requested (Ichimoku, ATR, CHOP, SuperTrend, Keltner)