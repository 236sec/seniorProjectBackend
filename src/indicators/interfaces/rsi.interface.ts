export interface RSIDataPoint {
  date: string;
  price: number;
  rsi: number;
}

export interface RSIResponse {
  last_updated: string;
  data: RSIDataPoint[];
}
