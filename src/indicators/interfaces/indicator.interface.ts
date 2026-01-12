export interface DataPoint {
  date: string;
  value: number;
}

export interface IndicatorResponse {
  last_updated: string;
  data: DataPoint[];
}

export enum IndicatorType {
  RSI = 'rsi',
  EMA20 = 'ema20',
  SMA20 = 'sma20',
  MACD = 'macd',
  Z_SCORE = 'z_score',
  HISTORICAL_VOLATILITY = 'historical_volatility',
  COPPOCK = 'coppock',
  HMA = 'hma',
  KALMAN = 'kalman',
  OBV = 'obv',
  BOLLINGER = 'bollinger',
}
