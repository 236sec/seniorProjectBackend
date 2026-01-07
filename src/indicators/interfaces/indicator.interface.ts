export interface DataPoint {
  date: string;
  value: number;
}

export interface IndicatorResponse {
  last_updated: string;
  data: DataPoint[];
}
