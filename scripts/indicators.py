import pandas as pd
import numpy as np


def calculate_rsi(df, window: int = 14, price_col: str = "close"):
    """Calculate Relative Strength Index (RSI) and append it to the DataFrame.

    Uses Wilder's smoothing on gains and losses over the provided window.
    Returns the same DataFrame instance with a new ``rsi`` column.
    """
    if price_col not in df.columns:
        raise ValueError(f"Column '{price_col}' not found in DataFrame")

    prices = df[price_col]
    deltas = prices.diff()

    # Positive and negative changes
    gains = deltas.clip(lower=0)
    losses = -deltas.clip(upper=0)

    # Wilder's smoothing: exponential weighted mean with alpha = 1/window
    avg_gain = gains.ewm(alpha=1 / window, adjust=False).mean()
    avg_loss = losses.ewm(alpha=1 / window, adjust=False).mean()

    rs = avg_gain / avg_loss
    rsi = 100 - (100 / (1 + rs))

    df['rsi'] = rsi
    return df

def calculate_sma(df, window=20, price_col: str = "close"):
    """Simple Moving Average (SMA) over ``price_col``."""
    if price_col not in df.columns:
        raise ValueError(f"Column '{price_col}' not found in DataFrame")
    return df[price_col].rolling(window=window).mean()

def calculate_ema(df, span=20, price_col: str = "close"):
    """Exponential Moving Average (EMA) over ``price_col``."""
    if price_col not in df.columns:
        raise ValueError(f"Column '{price_col}' not found in DataFrame")
    return df[price_col].ewm(span=span, adjust=False).mean()

def calculate_macd(df, fast=12, slow=26, signal=9, price_col: str = "close"):
    """
    MACD (Moving Average Convergence Divergence)
    Returns: DataFrame with 'macd_line', 'signal_line', and 'histogram'.
    """
    if price_col not in df.columns:
        raise ValueError(f"Column '{price_col}' not found in DataFrame")

    # 1. Calculate Fast and Slow EMAs
    ema_fast = df[price_col].ewm(span=fast, adjust=False).mean()
    ema_slow = df[price_col].ewm(span=slow, adjust=False).mean()
    
    # 2. MACD Line = Fast EMA - Slow EMA
    macd_line = ema_fast - ema_slow
    
    # 3. Signal Line = EMA of the MACD Line
    signal_line = macd_line.ewm(span=signal, adjust=False).mean()
    
    # 4. Histogram = MACD Line - Signal Line
    histogram = macd_line - signal_line
    
    return pd.DataFrame({
        'macd_line': macd_line,
        'signal_line': signal_line,
        'macd_hist': histogram
    })

def calculate_ichimoku(df):
    """
    Ichimoku Cloud
    Standard Settings: 9 (Conversion), 26 (Base), 52 (Leading B), 26 (Lagging).
    """
    # Helper to calculate midpoint of High/Low over a window
    def get_period_high_low_avg(window):
        period_high = df['high'].rolling(window=window).max()
        period_low = df['low'].rolling(window=window).min()
        return (period_high + period_low) / 2

    # 1. Tenkan-sen (Conversion Line): (9-period High + 9-period Low) / 2
    tenkan_sen = get_period_high_low_avg(9)

    # 2. Kijun-sen (Base Line): (26-period High + 26-period Low) / 2
    kijun_sen = get_period_high_low_avg(26)

    # 3. Senkou Span A (Leading Span A): (Tenkan + Kijun) / 2
    # Important: Shifted FORWARD by 26 periods
    senkou_span_a = ((tenkan_sen + kijun_sen) / 2).shift(26)

    # 4. Senkou Span B (Leading Span B): (52-period High + 52-period Low) / 2
    # Important: Shifted FORWARD by 26 periods
    senkou_span_b = get_period_high_low_avg(52).shift(26)

    # 5. Chikou Span (Lagging Span): Close shifted BACKWARDS by 26 periods
    chikou_span = df['close'].shift(-26)

    return pd.DataFrame({
        'ichimoku_tenkan': tenkan_sen,
        'ichimoku_kijun': kijun_sen,
        'ichimoku_span_a': senkou_span_a,
        'ichimoku_span_b': senkou_span_b,
        'ichimoku_chikou': chikou_span
    })

def calculate_obv(df, price_col='price', vol_col='volume'):
    """On-Balance Volume (OBV)"""
    if price_col not in df.columns or vol_col not in df.columns:
        raise ValueError(f"Columns {price_col}, {vol_col} required for OBV")
    
    # 1. diff
    d = df[price_col].diff()
    
    # 2. apply sign and multiply by volume
    obv_change = pd.Series(0.0, index=df.index)
    obv_change[d > 0] = df[vol_col]
    obv_change[d < 0] = -df[vol_col]
    
    df['obv'] = obv_change.cumsum()
    return df

def calculate_atr(df, window=14):
    """Average True Range (ATR)"""
    high = df['high']
    low = df['low']
    close = df['close']
    
    previous_close = close.shift(1)
    
    tr1 = high - low
    tr2 = (high - previous_close).abs()
    tr3 = (low - previous_close).abs()
    
    tr = pd.concat([tr1, tr2, tr3], axis=1).max(axis=1)
    
    df['atr'] = tr.ewm(alpha=1/window, adjust=False).mean()
    return df

def calculate_chop(df, window=14):
    """Choppiness Index (CHOP)"""
    high = df['high']
    low = df['low']
    close = df['close']
    
    previous_close = close.shift(1)
    tr1 = high - low
    tr2 = (high - previous_close).abs()
    tr3 = (low - previous_close).abs()
    tr = pd.concat([tr1, tr2, tr3], axis=1).max(axis=1)
    
    sum_tr = tr.rolling(window=window).sum()
    max_h = high.rolling(window=window).max()
    min_l = low.rolling(window=window).min()
    
    range_hl = max_h - min_l
    # avoid div/0
    range_hl.replace(0, np.nan, inplace=True)
    
    chop = 100 * np.log10(sum_tr / range_hl) / np.log10(window)
    df['chop'] = chop
    return df

def calculate_bollinger_bands(df, window=20, num_std=2, price_col='close'):
    """Bollinger Bands"""
    sma = df[price_col].rolling(window=window).mean()
    std = df[price_col].rolling(window=window).std()
    
    df['bb_middle'] = sma
    df['bb_upper'] = sma + (std * num_std)
    df['bb_lower'] = sma - (std * num_std)
    return df

def calculate_supertrend(df, period=10, multiplier=3):
    """SuperTrend"""
    high = df['high']
    low = df['low']
    close = df['close']
    
    previous_close = close.shift(1)
    tr1 = high - low
    tr2 = (high - previous_close).abs()
    tr3 = (low - previous_close).abs()
    tr = pd.concat([tr1, tr2, tr3], axis=1).max(axis=1)
    atr = tr.ewm(alpha=1/period, adjust=False).mean()
    
    hl2 = (high + low) / 2
    basic_upper = hl2 + (multiplier * atr)
    basic_lower = hl2 - (multiplier * atr)
    
    final_upper = np.zeros(len(df))
    final_lower = np.zeros(len(df))
    supertrend = np.zeros(len(df))
    trend = np.zeros(len(df)) # 1 up, -1 down
    
    close_val = close.values
    bu_val = basic_upper.values
    bl_val = basic_lower.values
    
    for i in range(1, len(df)):
        # Final Upper
        if (bu_val[i] < final_upper[i-1]) or (close_val[i-1] > final_upper[i-1]):
            final_upper[i] = bu_val[i]
        else:
            final_upper[i] = final_upper[i-1]
            
        # Final Lower
        if (bl_val[i] > final_lower[i-1]) or (close_val[i-1] < final_lower[i-1]):
            final_lower[i] = bl_val[i]
        else:
            final_lower[i] = final_lower[i-1]
            
        # Trend
        if trend[i-1] == 0:
             trend[i-1] = 1 # assume up initially
             
        if trend[i-1] == 1:
            if close_val[i] < final_lower[i]:
                trend[i] = -1
            else:
                trend[i] = 1
        else:
            if close_val[i] > final_upper[i]:
                trend[i] = 1
            else:
                trend[i] = -1
                
        if trend[i] == 1:
            supertrend[i] = final_lower[i]
        else:
            supertrend[i] = final_upper[i]
            
    df['supertrend'] = supertrend
    df['supertrend_trend'] = trend
    return df

def calculate_keltner_channels(df, window=20, multiplier=2):
    """Keltner Channels"""
    # 1. EMA
    ema = df['close'].ewm(span=window, adjust=False).mean()
    
    # 2. ATR (using same window)
    high = df['high']
    low = df['low']
    close = df['close']
    previous_close = close.shift(1)
    tr = pd.concat([high - low, (high - previous_close).abs(), (low - previous_close).abs()], axis=1).max(axis=1)
    atr = tr.ewm(alpha=1/window, adjust=False).mean()
    
    df['keltner_middle'] = ema
    df['keltner_upper'] = ema + (multiplier * atr)
    df['keltner_lower'] = ema - (multiplier * atr)
    return df

def calculate_z_score(df, window=20, price_col='price'):
    """Z-Score (Standard Score)"""
    if price_col not in df.columns:
        raise ValueError(f"Column '{price_col}' not found")
        
    mean = df[price_col].rolling(window=window).mean()
    std = df[price_col].rolling(window=window).std()
    
    # Avoid division by zero
    std.replace(0, np.nan, inplace=True)
    
    df['z_score'] = (df[price_col] - mean) / std
    return df

def calculate_historical_volatility(df, window=30, price_col='price'):
    """Historical Volatility (Annualized)"""
    if price_col not in df.columns:
        raise ValueError(f"Column '{price_col}' not found")
        
    # Log returns: ln(Pt / Pt-1)
    log_returns = np.log(df[price_col] / df[price_col].shift(1))
    
    # Rolling Std Dev of log returns
    vol = log_returns.rolling(window=window).std()
    
    # Annualize (crypto markets trade 365 days)
    # Volatility is usually expressed as an annualized percentage
    df['historical_volatility'] = vol * np.sqrt(365) * 100
    return df

def calculate_coppock_curve(df, wma_period=10, roc1_period=14, roc2_period=11, price_col='price'):
    """Coppock Curve"""
    if price_col not in df.columns:
        raise ValueError(f"Column '{price_col}' not found")

    def wma(series, period):
        weights = np.arange(1, period + 1)
        return series.rolling(period).apply(lambda x: np.dot(x, weights) / weights.sum(), raw=True)

    # ROC = (Price(t) - Price(t-n)) / Price(t-n) * 100
    roc1 = df[price_col].diff(roc1_period) / df[price_col].shift(roc1_period) * 100
    roc2 = df[price_col].diff(roc2_period) / df[price_col].shift(roc2_period) * 100
    
    bs = roc1 + roc2
    df['coppock'] = wma(bs, wma_period)
    return df

def calculate_hma(df, window=14, price_col='price'):
    """Hull Moving Average (HMA)"""
    if price_col not in df.columns:
        raise ValueError(f"Column '{price_col}' not found")
        
    def wma(series, period):
        weights = np.arange(1, period + 1)
        return series.rolling(period).apply(lambda x: np.dot(x, weights) / weights.sum(), raw=True)

    # HMA = WMA( 2*WMA(n/2) - WMA(n) , sqrt(n) )
    
    half_length = int(window / 2)
    sqrt_length = int(np.sqrt(window))
    
    wma_half = wma(df[price_col], half_length)
    wma_full = wma(df[price_col], window)
    
    raw_hma = 2 * wma_half - wma_full
    df['hma'] = wma(raw_hma, sqrt_length)
    return df

def calculate_kalman_filter(df, price_col='price', process_variance=1e-5, measurement_variance=1e-3):
    """Simple 1D Kalman Filter (Smoother)"""
    if price_col not in df.columns:
        raise ValueError(f"Column '{price_col}' not found")
        
    prices = df[price_col].values
    n = len(prices)
    
    xhat = np.zeros(n) # A posteriori estimate of x
    P = np.zeros(n)    # A posteriori error estimate
    
    # Initialization
    xhat[0] = prices[0]
    P[0] = 1.0
    
    # System uncertainty (Q) and Measurement uncertainty (R)
    Q = process_variance
    R = measurement_variance
    
    for k in range(1, n):
        # Time Update (Prediction)
        xhat_minus = xhat[k-1]
        P_minus = P[k-1] + Q
        
        # Measurement Update (Correction)
        # Kalman Gain
        K = P_minus / (P_minus + R)
        
        xhat[k] = xhat_minus + K * (prices[k] - xhat_minus)
        P[k] = (1 - K) * P_minus
        
    df['kalman'] = xhat
    return df