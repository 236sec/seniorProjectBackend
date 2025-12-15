export interface ListCoinData {
  id: string;
  symbol: string;
  name: string;
}

export type CoingeckoListCoinsResponse = ListCoinData[];

export interface ListCoinWithPlatformsData {
  id: string;
  symbol: string;
  name: string;
  platforms: Record<string, string>; // chainId -> contract address
}

export type CoingeckoListCoinsWithPlatformsResponse =
  ListCoinWithPlatformsData[];

export interface CoinMarketData {
  id: string;
  symbol: string;
  name: string;
  image: string;
}

export type CoingeckoMarketsResponse = CoinMarketData[];

export interface CoinDetailData {
  id: string;
  symbol: string;
  name: string;
  image: {
    thumb: string;
    small: string;
    large: string;
  };
}

export type AssetPlatformsListResponse = AssetPlatformsListData[];

export interface AssetPlatformsListData {
  id: string;
  chain_identifier: number | null;
  name: string;
  short_name: string;
  native_coin_id: string;
  image: {
    thumb: string;
    small: string;
    large: string;
  };
}
