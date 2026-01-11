import { HttpService } from '@nestjs/axios';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';
import { normalizeTo18Decimals } from 'src/common/utils/bigint-string.util';
import {
  AlchemyApiResponse,
  AlchemyRequestBody,
  AllTransactionsServiceResponse,
  CHAINS,
  SupportedChain,
  TokenBalancesResponse,
  TransactionServiceResponse,
  Transfer,
  TransferCategory,
} from './interfaces/alchemy-api.interface';

@Injectable()
export class AlchemysService {
  private readonly logger = new Logger(AlchemysService.name);
  private readonly apiKey: string | undefined;

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {
    this.apiKey = this.configService.get<string>('ALCHEMY_API_KEY');

    if (!this.apiKey) {
      this.logger.warn('ALCHEMY_API_KEY not configured');
    }
  }

  /**
   * Get the Alchemy base URL for a specific chain
   * @param chain - Blockchain network identifier
   * @returns Alchemy API base URL for the chain
   */
  private getChainBaseUrl(chain: string): string {
    const chainUrls: Record<string, string> = {
      // Ethereum networks
      'eth-mainnet': 'https://eth-mainnet.g.alchemy.com/v2',
      'eth-sepolia': 'https://eth-sepolia.g.alchemy.com/v2',
      'eth-holesky': 'https://eth-holesky.g.alchemy.com/v2',

      // Polygon networks
      'polygon-mainnet': 'https://polygon-mainnet.g.alchemy.com/v2',
      'polygon-amoy': 'https://polygon-amoy.g.alchemy.com/v2',

      // Arbitrum networks
      'arb-mainnet': 'https://arb-mainnet.g.alchemy.com/v2',
      'arb-sepolia': 'https://arb-sepolia.g.alchemy.com/v2',

      // Optimism networks
      'opt-mainnet': 'https://opt-mainnet.g.alchemy.com/v2',
      'opt-sepolia': 'https://opt-sepolia.g.alchemy.com/v2',

      // Base networks
      'base-mainnet': 'https://base-mainnet.g.alchemy.com/v2',
      'base-sepolia': 'https://base-sepolia.g.alchemy.com/v2',

      // Avalanche networks
      'avax-mainnet': 'https://avax-mainnet.g.alchemy.com/v2',
      'avax-fuji': 'https://avax-fuji.g.alchemy.com/v2',
    };

    const baseUrl = chainUrls[chain];
    if (!baseUrl) {
      throw new Error(
        `Unsupported chain: ${chain}. Supported chains: ${Object.keys(chainUrls).join(', ')}`,
      );
    }

    return baseUrl;
  }

  /**
   * Get list of supported blockchain networks
   * @returns Array of supported chain identifiers
   */
  getSupportedChains(): readonly SupportedChain[] {
    return CHAINS;
  }

  /**
   * Get all transactions for a wallet address using Alchemy API from start to latest block
   * @param address - Wallet address (format depends on chain)
   * @param chain - Blockchain network (default: eth-mainnet)
   * @param pageKey - Optional pagination key for retrieving more results
   * @returns Promise with transaction data
   */
  async getTransactionsByAddress(
    address: string,
    chain: SupportedChain = 'eth-mainnet',
    pageKey?: string,
  ): Promise<TransactionServiceResponse> {
    try {
      // Validate configuration
      if (!this.apiKey) {
        throw new Error(
          'Alchemy API not configured. Please set ALCHEMY_API_KEY',
        );
      }

      // Validate address format (basic validation - could be enhanced per chain)
      if (!address || address.length < 10) {
        throw new Error(`Invalid wallet address: ${address}`);
      }

      this.logger.debug(
        `Fetching transactions for address: ${address} on chain: ${chain}`,
      );

      // Get base URL for the specified chain and construct full API URL
      const baseUrl = this.getChainBaseUrl(chain);
      const url = `${baseUrl}/${this.apiKey}`;

      // We need to make two separate requests:
      // 1. Transactions FROM the address (outgoing)
      // 2. Transactions TO the address (incoming)

      const allTransfers: Transfer[] = [];

      // First, get outgoing transactions (FROM address)
      const outgoingRequestBody: AlchemyRequestBody = {
        jsonrpc: '2.0',
        method: 'alchemy_getAssetTransfers',
        params: [
          {
            fromBlock: '0x0', // Start from the first block (genesis block)
            toBlock: 'latest', // Get transactions up to the latest block
            fromAddress: address, // Get transactions FROM this address
            category: [
              'external', // ETH transfers
              'internal', // Internal ETH transfers (important for Uniswap)
              'erc20', // ERC-20 token transfers
              'erc721', // NFT transfers
              'erc1155', // Multi-token transfers
              'specialnft', // Special NFT transfers
            ] as TransferCategory[],
            withMetadata: true, // Include additional metadata
            excludeZeroValue: false, // Include zero-value transfers
            maxCount: '0x1f4', // 500 results per request (hex for 500)
            ...(pageKey && { pageKey }), // Include pageKey if provided for pagination
          },
        ],
        id: 1,
      };

      // Second, get incoming transactions (TO address)
      const incomingRequestBody: AlchemyRequestBody = {
        jsonrpc: '2.0',
        method: 'alchemy_getAssetTransfers',
        params: [
          {
            fromBlock: '0x0', // Start from the first block (genesis block)
            toBlock: 'latest', // Get transactions up to the latest block
            toAddress: address, // Get transactions TO this address
            category: [
              'external', // ETH transfers
              'internal', // Internal ETH transfers (important for Uniswap)
              'erc20', // ERC-20 token transfers
              'erc721', // NFT transfers
              'erc1155', // Multi-token transfers
              'specialnft', // Special NFT transfers
            ] as TransferCategory[],
            withMetadata: true, // Include additional metadata
            excludeZeroValue: false, // Include zero-value transfers
            maxCount: '0x1f4', // 500 results per request (hex for 500)
          },
        ],
        id: 2,
      };

      // Make API request for outgoing transactions
      const outgoingOptions = {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        data: JSON.stringify(outgoingRequestBody),
      };

      this.logger.debug(`Fetching outgoing transactions for ${address}...`);
      const outgoingResponse = await firstValueFrom(
        this.httpService.request({ url, ...outgoingOptions }),
      );

      const outgoingData = outgoingResponse.data as AlchemyApiResponse;

      // Check for API errors in outgoing response
      if (outgoingData?.error) {
        throw new Error(
          `Alchemy API Error (outgoing): ${outgoingData.error.message}`,
        );
      }

      const outgoingTransfers = outgoingData?.result?.transfers || [];
      allTransfers.push(...outgoingTransfers);
      const combinedPageKey = outgoingData?.result?.pageKey;

      this.logger.debug(
        `Found ${outgoingTransfers.length} outgoing transactions`,
      );

      // Make API request for incoming transactions
      const incomingOptions = {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        data: JSON.stringify(incomingRequestBody),
      };

      this.logger.debug(`Fetching incoming transactions for ${address}...`);
      const incomingResponse = await firstValueFrom(
        this.httpService.request({ url, ...incomingOptions }),
      );

      const incomingData = incomingResponse.data as AlchemyApiResponse;

      // Check for API errors in incoming response
      if (incomingData?.error) {
        throw new Error(
          `Alchemy API Error (incoming): ${incomingData.error.message}`,
        );
      }

      const incomingTransfers = incomingData?.result?.transfers || [];
      allTransfers.push(...incomingTransfers);

      this.logger.debug(
        `Found ${incomingTransfers.length} incoming transactions`,
      );

      // Sort all transfers by block number (newest first)
      const sortedTransfers = allTransfers.sort((a, b) => {
        const blockA = parseInt(a.blockNum || '0', 16);
        const blockB = parseInt(b.blockNum || '0', 16);
        return blockB - blockA;
      });

      this.logger.debug(
        `Total combined response: ${sortedTransfers.length} transactions for ${address} on ${chain}`,
      );

      this.logger.log(
        `Found ${sortedTransfers.length} total transactions for address ${address} on ${chain} (${outgoingTransfers.length} outgoing, ${incomingTransfers.length} incoming)`,
      );

      return {
        success: true,
        address,
        chain,
        transactionCount: sortedTransfers.length,
        outgoingCount: outgoingTransfers.length,
        incomingCount: incomingTransfers.length,
        transactions: sortedTransfers,
        pageKey: combinedPageKey,
        hasMore: !!combinedPageKey,
      };
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);

      this.logger.error(
        `Error fetching transactions for address ${address} on chain ${chain}:`,
        errorMessage,
      );

      return {
        success: false,
        address,
        chain,
        error: errorMessage,
        transactionCount: 0,
        transactions: [],
      };
    }
  }

  /**
   * Get ALL transactions for a wallet address by automatically handling pagination
   * This method will fetch all available transactions from start to latest block
   * @param address - Wallet address (format depends on chain)
   * @param chain - Blockchain network (default: eth-mainnet)
   * @param maxPages - Maximum number of pages to fetch (default: 10, 0 = unlimited)
   * @returns Promise with all transaction data
   */
  async getAllTransactionsByAddress(
    address: string,
    chain: SupportedChain = 'eth-mainnet',
    maxPages: number = 10,
  ): Promise<AllTransactionsServiceResponse> {
    const allTransactions: Transfer[] = [];
    let pageKey: string | undefined;
    let pageCount = 0;
    const maxPagesToFetch = maxPages === 0 ? Number.MAX_SAFE_INTEGER : maxPages;

    try {
      this.logger.debug(
        `Fetching ALL transactions for address: ${address} on chain: ${chain} (max pages: ${maxPages === 0 ? 'unlimited' : maxPages})`,
      );

      do {
        pageCount++;

        if (pageCount > maxPagesToFetch) {
          this.logger.warn(
            `Reached maximum pages limit (${maxPages}) for address: ${address}`,
          );
          break;
        }

        this.logger.debug(
          `Fetching page ${pageCount} for address: ${address}${pageKey ? ` with pageKey: ${pageKey}` : ''}`,
        );

        const result = await this.getTransactionsByAddress(
          address,
          chain,
          pageKey,
        );

        if (!result.success) {
          throw new Error(result.error);
        }

        allTransactions.push(...result.transactions);
        pageKey = result.pageKey;

        this.logger.debug(
          `Page ${pageCount}: Found ${result.transactions.length} transactions. Total so far: ${allTransactions.length}`,
        );

        // Small delay to be respectful to the API
        if (pageKey) {
          await new Promise((resolve) => setTimeout(resolve, 100));
        }
      } while (pageKey);

      this.logger.log(
        `Completed fetching ALL transactions for address ${address} on ${chain}. Total: ${allTransactions.length} transactions across ${pageCount} pages`,
      );

      return {
        success: true,
        address,
        chain,
        totalTransactions: allTransactions.length,
        totalPages: pageCount,
        transactions: allTransactions,
      };
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);

      this.logger.error(
        `Error fetching all transactions for address ${address} on chain ${chain}:`,
        errorMessage,
      );

      return {
        success: false,
        address,
        chain,
        error: errorMessage,
        totalTransactions: allTransactions.length,
        totalPages: pageCount,
        transactions: allTransactions,
      };
    }
  }

  /**
   * Convert raw token balance to human-readable format using decimals
   */
  formatTokenBalance(rawBalance: string, decimals: number): string {
    if (!rawBalance || rawBalance === '0') return '0';

    const balance = BigInt(rawBalance);
    const divisor = BigInt(10 ** decimals);
    const integerPart = balance / divisor;
    const remainder = balance % divisor;

    if (remainder === BigInt(0)) {
      return integerPart.toString();
    }

    const fractionalPart = remainder.toString().padStart(decimals, '0');
    return `${integerPart}.${fractionalPart}`;
  }

  /**
   * Get ERC-20 token balances for a wallet address using Alchemy Portfolio API
   * @param chains - Array of blockchain network identifiers
   * @param address - Wallet address
   * @returns Token balances with metadata
   */
  async getTokenBalances(chains: string[], address: string) {
    try {
      // Validate configuration
      if (!this.apiKey) {
        throw new Error(
          'Alchemy API not configured. Please set ALCHEMY_API_KEY',
        );
      }

      // Validate chains
      const invalidChains = chains.filter(
        (chain) => !CHAINS.includes(chain as SupportedChain),
      );
      if (invalidChains.length > 0) {
        throw new Error(
          `Unsupported chains: ${invalidChains.join(', ')}. Supported chains: ${CHAINS.join(', ')}`,
        );
      }

      // Validate address format
      if (!address || address.length < 10) {
        throw new Error(`Invalid wallet address: ${address}`);
      }

      // Use Portfolio API to get all token balances in one call
      const url = `https://api.g.alchemy.com/data/v1/${this.apiKey}/assets/tokens/by-address`;

      const requestBody = {
        addresses: [{ address, networks: chains }],
        withMetadata: true,
        withPrices: true,
        includeNativeTokens: true,
        includeErc20Tokens: true,
      };

      const response = await firstValueFrom(
        this.httpService.post<TokenBalancesResponse>(url, requestBody),
      );

      if (!response.data || !response.data.data || !response.data.data.tokens) {
        return {
          address,
          chains,
          nativeBalances: [],
          tokenBalances: [],
        };
      }

      // Group native tokens by network (has null tokenAddress)
      const nativeBalances = response.data.data.tokens
        .filter((token) => token.tokenAddress === null)
        .filter((token) => {
          // Exclude zero balances
          if (!token.tokenBalance || token.tokenBalance === '0') return false;
          if (token.tokenBalance.startsWith('0x')) {
            const normalized = token.tokenBalance.replace(/^0x0+/, '') || '0';
            if (normalized === '0') return false;
          }
          return true;
        })
        .map((token) => ({
          network: token.network,
          balance: this.formatTokenBalance(token.tokenBalance, 18),
          rawBalance: token.tokenBalance,
        }));

      // Map ERC-20 tokens to our format (exclude native token and zero balances)
      const tokenBalances = response.data.data.tokens
        .filter((token) => {
          // Exclude native token
          if (token.tokenAddress === null) return false;

          // Exclude zero balances (handles both "0" and "0x000...000" formats)
          if (!token.tokenBalance || token.tokenBalance === '0') return false;
          if (token.tokenBalance.startsWith('0x')) {
            const normalized = token.tokenBalance.replace(/^0x0+/, '') || '0';
            if (normalized === '0') return false;
          }

          return true;
        })
        .map((token) => {
          // Safely extract metadata with defaults
          const metadata = token.tokenMetadata;
          const decimals: number =
            metadata && typeof metadata.decimals === 'number'
              ? metadata.decimals
              : 18;
          const symbol: string =
            metadata && typeof metadata.symbol === 'string'
              ? metadata.symbol
              : 'UNKNOWN';
          const name: string =
            metadata && typeof metadata.name === 'string'
              ? metadata.name
              : 'Unknown Token';
          const logo: string | null =
            metadata && typeof metadata.logo === 'string'
              ? metadata.logo
              : null;

          return {
            contractAddress: token.tokenAddress as string,
            symbol,
            name,
            balance: this.formatTokenBalance(token.tokenBalance, decimals),
            rawBalance: normalizeTo18Decimals(token.tokenBalance, decimals),
            decimals: 18,
            logo,
            network: token.network,
          };
        });

      this.logger.debug(
        `Found ${nativeBalances.length} native balances and ${tokenBalances.length} non-zero ERC-20 token balances for ${address}`,
      );

      return {
        address,
        chains,
        nativeBalances,
        tokenBalances,
      };
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);

      this.logger.error(
        `Error fetching token balances from Alchemy: ${errorMessage}`,
      );
      throw error;
    }
  }
}
