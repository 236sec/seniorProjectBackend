export interface ListCoinData {
  id: string;
  symbol: string;
  name: string;
}

export type CoingeckoListCoinsResponse = ListCoinData[];
