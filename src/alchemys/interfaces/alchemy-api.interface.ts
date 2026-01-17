/**
 * Type definitions for Alchemy API responses
 */

export interface RawContract {
  value: string;
  address: string | null;
  decimal: string;
}

export interface ERC1155Metadata {
  tokenId: string;
  value: string;
}

export interface Transfer {
  blockNum: string;
  uniqueId: string;
  hash: string;
  from: string;
  to: string;
  value: number;
  erc721TokenId: string | null;
  erc1155Metadata: ERC1155Metadata[] | null;
  tokenId: string | null;
  asset: string;
  category:
    | 'external'
    | 'internal'
    | 'erc20'
    | 'erc721'
    | 'erc1155'
    | 'specialnft';
  rawContract: RawContract;
  metadata: Record<string, unknown> | null;
}

export interface AlchemyTransfersResult {
  transfers: Transfer[];
  pageKey?: string;
}

export interface AlchemyApiResponse {
  jsonrpc: '2.0';
  id: number;
  result?: AlchemyTransfersResult;
  error?: {
    code: number;
    message: string;
  };
}

export interface TokenBalance {
  contractAddress: string;
  tokenBalance: string;
}

export interface AlchemyTokenMetadata {
  decimals: number;
  logo: string | null;
  name: string;
  symbol: string;
}

export interface AlchemyTokenPrice {
  currency: string;
  value: string;
  lastUpdatedAt: string;
}

export interface AlchemyTokenBalance {
  address: string;
  network: string;
  tokenAddress: string | null;
  tokenBalance: string;
  tokenMetadata: AlchemyTokenMetadata | undefined;
  tokenPrices: AlchemyTokenPrice[] | undefined;
  error: string | undefined;
}

export interface TokenBalancesResult {
  address: string;
  tokenBalances: TokenBalance[];
}

export interface AlchemyTokenBalancesData {
  tokens: AlchemyTokenBalance[];
  pageKey?: string;
}

export interface TokenBalancesResponse {
  data: AlchemyTokenBalancesData;
}

export interface AlchemyTransferRequest {
  fromBlock?: string;
  toBlock?: string;
  fromAddress?: string;
  toAddress?: string;
  contractAddresses?: string[];
  category: Array<
    'external' | 'internal' | 'erc20' | 'erc721' | 'erc1155' | 'specialnft'
  >;
  withMetadata?: boolean;
  excludeZeroValue?: boolean;
  maxCount?: string;
  pageKey?: string;
  order?: 'asc' | 'desc';
}

export interface AlchemyRequestBody {
  jsonrpc: '2.0';
  method: 'alchemy_getAssetTransfers';
  params: [AlchemyTransferRequest];
  id: number;
}

export interface TransactionServiceResponse {
  success: boolean;
  address: string;
  chain: string;
  transactionCount: number;
  outgoingCount?: number;
  incomingCount?: number;
  transactions: Transfer[];
  pageKey?: string;
  hasMore?: boolean;
  error?: string;
}

export interface AllTransactionsServiceResponse {
  success: boolean;
  address: string;
  chain: string;
  totalTransactions: number;
  totalPages: number;
  transactions: Transfer[];
  error?: string;
}

export const CHAINS = [
  'eth-mainnet',
  'eth-sepolia',
  'eth-holesky',
  'polygon-mainnet',
  'polygon-amoy',
  'arb-mainnet',
  'arb-sepolia',
  'opt-mainnet',
  'opt-sepolia',
  'base-mainnet',
  'base-sepolia',
  'avax-mainnet',
  'avax-fuji',
  'zksync-mainnet',
  'worldchain-mainnet',
  'berachain-mainnet',
  'linea-mainnet',
  'ink-mainnet',
] as const;

export type SupportedChain = (typeof CHAINS)[number];

export type TransferCategory =
  | 'external'
  | 'internal'
  | 'erc20'
  | 'erc721'
  | 'erc1155'
  | 'specialnft';
