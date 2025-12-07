export interface ListCoinData {
  id: string;
  symbol: string;
  name: string;
}

export type CoingeckoListCoinsResponse = ListCoinData[];

export interface CoinMarketData {
  id: string;
  symbol: string;
  name: string;
  image: string;
}

export type CoingeckoMarketsResponse = CoinMarketData[];
