import pandas as pd


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

def calculate_macd(df, fast=12, slow=26, signal=9):
    """
    MACD (Moving Average Convergence Divergence)
    Returns: DataFrame with 'macd_line', 'signal_line', and 'histogram'.
    """
    # 1. Calculate Fast and Slow EMAs
    ema_fast = df['close'].ewm(span=fast, adjust=False).mean()
    ema_slow = df['close'].ewm(span=slow, adjust=False).mean()
    
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