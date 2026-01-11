import { Types } from 'mongoose';
import {
  BlockchainWallet,
  TokenBalance,
} from 'src/blockchain-wallets/schema/blockchain-wallet.schema';
import { TokenContract } from 'src/tokens/schema/token-contract.schema';
import { Token } from 'src/tokens/schema/token.schema';
import { ManualTokenBalance, Wallet } from '../schemas/wallet.schema';

export interface NormalizedManualToken {
  tokenId: string;
  balance: string;
}

export interface NormalizedPortfolioPerformance {
  tokenId: string;
  totalInvestedAmount: number;
  totalBalance: string;
  totalCashflowUsd: number;
  costBasis: number;
  averageUnitCost: number;
}

export interface NormalizedBlockchainToken {
  tokenId: string;
  balance: string;
  tokenContractId: {
    _id: string;
    chainId?: string;
    contractAddress?: string;
    coinGeckoId?: string;
    name?: string;
    symbol?: string;
    tokenId?: string;
    [key: string]: any;
  };
}

export interface NormalizedBlockchainWallet {
  _id: Types.ObjectId;
  address: string;
  chains: string[];
  tokens: NormalizedBlockchainToken[];
  createdAt: Date;
  updatedAt: Date;
}

export interface NormalizedWallet {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  name: string;
  description: string;
  blockchainWalletId: NormalizedBlockchainWallet[];
  manualTokens: NormalizedManualToken[];
  portfolioPerformance: NormalizedPortfolioPerformance[];
  createdAt: Date;
  updatedAt: Date;
  __v?: number;
}

export interface TokenInfo {
  _id: string;
  id: string;
  name?: string;
  symbol?: string;
  image?: {
    thumb?: string;
    small?: string;
    large?: string;
  };
  currentPrice?: number;
  priceChange24h?: number;
  [key: string]: any;
}

export interface WalletWithTokens {
  wallet: NormalizedWallet;
  tokens: Record<string, TokenInfo>;
}

// Type for Token with _id (populated)
export type PopulatedToken = Token & { _id: Types.ObjectId };

// Type for TokenContract with populated tokenId
export type PopulatedTokenContract = Omit<TokenContract, 'tokenId'> & {
  _id: Types.ObjectId;
  tokenId: PopulatedToken;
  contractAddress: string;
  chainId: string;
};

// Type for TokenBalance with populated tokenContractId
export type PopulatedTokenBalance = Omit<TokenBalance, 'tokenContractId'> & {
  tokenContractId: PopulatedTokenContract;
};

// Type for BlockchainWallet with populated tokens
export type PopulatedBlockchainWallet = Omit<BlockchainWallet, 'tokens'> & {
  _id: Types.ObjectId;
  tokens: PopulatedTokenBalance[];
  createdAt: Date;
  updatedAt: Date;
};

// Type for ManualTokenBalance with populated tokenId
export type PopulatedManualTokenBalance = Omit<
  ManualTokenBalance,
  'tokenId'
> & {
  tokenId: PopulatedToken;
};

// Type for Wallet with all populated fields
export type PopulatedWallet = Omit<
  Wallet,
  'blockchainWalletId' | 'manualTokens'
> & {
  _id: Types.ObjectId;
  blockchainWalletId:
    | Types.ObjectId[]
    | (Types.ObjectId | PopulatedBlockchainWallet)[];
  manualTokens: (PopulatedManualTokenBalance | ManualTokenBalance)[];
  createdAt?: Date;
  updatedAt?: Date;
  __v?: number;
};
