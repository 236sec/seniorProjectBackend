import { AlchemyChain } from 'src/alchemys/interfaces/alchemy-chain.enum';
import { SupportedPRC } from 'src/blockchain/enum/supported-prc.enum';
import { CoingeckoChain } from 'src/coingecko/interfaces/coingecko-chain.enum';

/**
 * Maps Alchemy chain identifiers to CoinGecko platform IDs (only supported set).
 * Uses enum values for both sides to avoid string typos.
 */
export const CHAIN_MAPPING: Record<string, CoingeckoChain> = {
  [AlchemyChain.ETHEREUM_MAINNET]: CoingeckoChain.ETHEREUM,
  [AlchemyChain.POLYGON_POS_MAINNET]: CoingeckoChain.POLYGON,
  [AlchemyChain.MATIC_MAINNET]: CoingeckoChain.POLYGON,
  [AlchemyChain.ARBITRUM_MAINNET]: CoingeckoChain.ARBITRUM,
  [AlchemyChain.BASE_MAINNET]: CoingeckoChain.BASE,
  [AlchemyChain.OP_MAINNET]: CoingeckoChain.OPTIMISM,
  [AlchemyChain.ZKSYNC_MAINNET]: CoingeckoChain.ZKSYNC,
  [AlchemyChain.WORLD_CHAIN_MAINNET]: CoingeckoChain.WORLDCHAIN,
  [AlchemyChain.BERACHAIN_MAINNET]: CoingeckoChain.BERACHAIN,
  [AlchemyChain.LINEA_MAINNET]: CoingeckoChain.LINEA,
  [AlchemyChain.INK_MAINNET]: CoingeckoChain.INK,
};

export const MappingSupportedRPCToCoingeckoChain: Record<
  SupportedPRC,
  CoingeckoChain
> = {
  // [SupportedPRC.ETH]: CoingeckoChain.ETHEREUM,
  [SupportedPRC.BNB]: CoingeckoChain.BINANCE_SMART_CHAIN,
  // [SupportedPRC.BASE]: CoingeckoChain.BASE,
};
