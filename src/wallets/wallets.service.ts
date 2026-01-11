import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { AlchemysService } from 'src/alchemys/alchemys.service';
import {
  BlockchainWallet,
  BlockchainWalletDocument,
} from 'src/blockchain-wallets/schema/blockchain-wallet.schema';
import { CoingeckoService } from 'src/coingecko/coingecko.service';
import { CHAIN_MAPPING } from 'src/common/constants/chain-mapping.constant';
import { TokensService } from 'src/tokens/tokens.service';
import { TransactionsService } from 'src/transactions/transactions.service';
import { UsersService } from '../users/users.service';
import { CreateWalletDto } from './dto/create-wallet.dto';
import {
  NormalizedBlockchainToken,
  NormalizedBlockchainWallet,
  NormalizedManualToken,
  NormalizedPortfolioPerformance,
  NormalizedWallet,
  PopulatedBlockchainWallet,
  PopulatedToken,
  PopulatedWallet,
  TokenInfo,
  WalletWithTokens,
} from './interface/get-wallet.dto';
import { PortfolioPerformance } from './schemas/portfolio-performance.schema';
import { Wallet, WalletDocument } from './schemas/wallet.schema';

@Injectable()
export class WalletsService {
  private readonly logger = new Logger(WalletsService.name);

  constructor(
    @InjectModel(Wallet.name)
    private readonly walletModel: Model<WalletDocument>,
    @InjectModel(BlockchainWallet.name)
    private readonly blockchainWalletModel: Model<BlockchainWalletDocument>,
    private readonly usersService: UsersService,
    private readonly alchemysService: AlchemysService,
    private readonly tokensService: TokensService,
    private readonly coingeckoService: CoingeckoService,
    private readonly transactionsService: TransactionsService,
  ) {}

  async create(userId: Types.ObjectId, createWalletDto: CreateWalletDto) {
    const userWithWallets = await this.usersService.findOneWithWallets(userId);
    if (!userWithWallets) {
      throw new NotFoundException('User does not exist');
    }

    const populatedWallets = userWithWallets.wallets as unknown as Wallet[];
    const existingWalletNames =
      populatedWallets?.map((wallet) => wallet.name) || [];
    if (existingWalletNames.includes(createWalletDto.name)) {
      throw new ConflictException(
        'Wallet with this name already exists for this user',
      );
    }

    const walletData = {
      ...createWalletDto,
      userId: userId,
    };

    const createdWallet = new this.walletModel(walletData);
    const savedWallet = await createdWallet.save();

    await this.usersService.addWalletToUser(userId, savedWallet._id);

    return savedWallet;
  }

  findAll() {
    return this.walletModel.find().exec();
  }

  async findOne(id: Types.ObjectId): Promise<WalletWithTokens | null> {
    const wallet = await this.walletModel
      .findById(id)
      .populate({
        path: 'blockchainWalletId',
        populate: {
          path: 'tokens.tokenContractId',
          populate: {
            path: 'tokenId',
          },
        },
      })
      .populate('manualTokens.tokenId')
      .lean()
      .exec();

    if (!wallet) {
      return null;
    }

    // Normalize the response: extract tokens and replace with IDs
    const tokensMap = new Map<string, TokenInfo>();
    const walletObj = wallet as PopulatedWallet;

    // Collect all unique token IDs for price fetching
    const tokenIdsForPrice = new Set<string>();

    // Extract tokens from manualTokens and create normalized array
    const normalizedManualTokens: NormalizedManualToken[] = [];
    if (walletObj.manualTokens && Array.isArray(walletObj.manualTokens)) {
      walletObj.manualTokens.forEach((item) => {
        if (
          typeof item.tokenId === 'object' &&
          '_id' in item.tokenId &&
          'symbol' in item.tokenId &&
          'name' in item.tokenId
        ) {
          // Populated token
          const token = item.tokenId;
          const tokenId = token._id.toString();
          if (token.id) {
            tokenIdsForPrice.add(token.id);
          }
          tokensMap.set(tokenId, this.toTokenInfo(token));
          normalizedManualTokens.push({
            tokenId: tokenId,
            balance: item.balance,
          });
        } else {
          // Not populated, just ObjectId
          normalizedManualTokens.push({
            tokenId: item.tokenId.toString(),
            balance: item.balance,
          });
        }
      });
    }

    // Extract tokens from portfolioPerformance and create normalized array
    const normalizedPortfolioPerformance: NormalizedPortfolioPerformance[] = [];
    if (
      walletObj.portfolioPerformance &&
      Array.isArray(walletObj.portfolioPerformance)
    ) {
      walletObj.portfolioPerformance.forEach((item: PortfolioPerformance) => {
        normalizedPortfolioPerformance.push({
          tokenId: item.tokenId.toString(),
          totalInvestedAmount: item.totalInvestedAmount,
          totalBalance: item.totalBalance,
          totalCashflowUsd: item.totalCashflowUsd,
          costBasis: item.costBasis,
          averageUnitCost: item.averageUnitCost,
        });
      });
    }

    // Extract tokens from blockchainWalletId.tokens if populated
    const normalizedBlockchainWallets: NormalizedBlockchainWallet[] = [];
    if (walletObj.blockchainWalletId) {
      const blockchainWallets = Array.isArray(walletObj.blockchainWalletId)
        ? walletObj.blockchainWalletId
        : [walletObj.blockchainWalletId];

      blockchainWallets.forEach((bw) => {
        // Check if it's populated (not just an ObjectId)
        if (typeof bw === 'object' && 'address' in bw) {
          const normalizedTokens: NormalizedBlockchainToken[] = [];

          if (bw.tokens && Array.isArray(bw.tokens)) {
            bw.tokens.forEach((token) => {
              if (
                token.tokenContractId &&
                typeof token.tokenContractId === 'object' &&
                'tokenId' in token.tokenContractId
              ) {
                const populatedContract = token.tokenContractId;
                const populatedToken = populatedContract.tokenId;
                const tokenId = populatedToken._id.toString();
                if (populatedToken.id) {
                  tokenIdsForPrice.add(populatedToken.id);
                }
                tokensMap.set(tokenId, this.toTokenInfo(populatedToken));

                // Normalize to match manual token format while preserving tokenContractId
                normalizedTokens.push({
                  tokenId: tokenId,
                  balance: token.balance,
                  tokenContractId: {
                    _id: populatedContract._id?.toString(),
                    chainId: populatedContract.chainId,
                    contractAddress: populatedContract.contractAddress,
                    coinGeckoId: populatedContract.coinGeckoId,
                    name: populatedContract.name,
                    symbol: populatedContract.symbol,
                    tokenId: tokenId,
                  },
                });
              } else {
                // Not populated, just keep as is
                const rawTokenContractId =
                  token.tokenContractId as unknown as Types.ObjectId;
                normalizedTokens.push({
                  tokenId: rawTokenContractId.toString(),
                  balance: token.balance,
                  tokenContractId: {
                    _id: rawTokenContractId.toString(),
                  },
                });
              }
            });
          }

          normalizedBlockchainWallets.push({
            _id: bw._id,
            address: bw.address,
            chains: bw.chains,
            tokens: normalizedTokens,
            createdAt: bw.createdAt,
            updatedAt: bw.updatedAt,
          });
        }
      });
    }

    // Fetch current prices for all tokens
    let priceData: {
      [coinId: string]: { usd: number; usd_24h_change: number };
    } = {};
    if (tokenIdsForPrice.size > 0) {
      try {
        priceData = await this.coingeckoService.getCurrentPrice(
          Array.from(tokenIdsForPrice),
        );
      } catch (error) {
        this.logger.error(
          `Error fetching prices: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }

    tokensMap.forEach((tokenInfo) => {
      if (tokenInfo.id && priceData[tokenInfo.id]) {
        tokenInfo.currentPrice = priceData[tokenInfo.id].usd;
        tokenInfo.priceChange24h = priceData[tokenInfo.id].usd_24h_change;
      }
    });

    // Build normalized wallet object
    const normalizedWallet: NormalizedWallet = {
      _id: walletObj._id,
      userId: walletObj.userId,
      name: walletObj.name,
      description: walletObj.description,
      blockchainWalletId: normalizedBlockchainWallets,
      manualTokens: normalizedManualTokens,
      portfolioPerformance: normalizedPortfolioPerformance,
      createdAt: walletObj.createdAt || new Date(),
      updatedAt: walletObj.updatedAt || new Date(),
      __v: walletObj.__v,
    };

    // Convert tokens map to object
    const tokens: Record<string, TokenInfo> = Object.fromEntries(tokensMap);

    return {
      wallet: normalizedWallet,
      tokens,
    };
  }

  findByUserId(userId: Types.ObjectId) {
    return this.walletModel.find({ userId }).exec();
  }

  remove(id: Types.ObjectId) {
    return this.walletModel.findByIdAndDelete(id).exec();
  }

  update(id: Types.ObjectId, updateWalletDto: Partial<Wallet>) {
    return this.walletModel
      .findByIdAndUpdate(id, updateWalletDto, { new: true })
      .exec();
  }

  async addBlockchainWalletToWallet(
    walletId: Types.ObjectId,
    address: string,
    chains: string[],
  ) {
    const wallet = await this.walletModel.findById(walletId).exec();
    if (!wallet) {
      throw new NotFoundException('Wallet does not exist');
    }

    let blockchainWallet = await this.blockchainWalletModel
      .findOne({ walletId, address })
      .exec();

    if (!blockchainWallet) {
      blockchainWallet = new this.blockchainWalletModel({
        address,
        chains: Array.from(new Set(chains)),
        tokens: [],
      });
      await blockchainWallet.save();
    } else {
      const mergedChains = Array.from(
        new Set([...(blockchainWallet.chains || []), ...chains]),
      );
      blockchainWallet.chains = mergedChains;
      await blockchainWallet.save();
    }

    await this.walletModel
      .findByIdAndUpdate(
        walletId,
        { $addToSet: { blockchainWalletId: blockchainWallet._id } },
        { new: true },
      )
      .exec();

    return blockchainWallet;
  }

  async getDifferentBalanceInBlockchainWallets(
    blockchainWalletId: Types.ObjectId,
  ) {
    // Populate blockchain wallet with token contract and token details
    const blockchainWallet = (await this.blockchainWalletModel
      .findById(blockchainWalletId)
      .populate({
        path: 'tokens.tokenContractId',
        populate: {
          path: 'tokenId',
        },
      })
      .exec()) as PopulatedBlockchainWallet | null;

    if (!blockchainWallet) {
      throw new NotFoundException('Blockchain wallet does not exist');
    }

    // Get on-chain balances (ERC-20 + native) enriched with metadata
    const onChainBalances = await this.getOnChainBalanceByAddress(
      blockchainWallet.address,
      blockchainWallet.chains,
    );

    const NATIVE_CONTRACT_ADDRESS =
      '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee';

    type BalanceEntry = {
      tokenContractId?: Types.ObjectId;
      chainId: string;
      contractAddress: string;
      balance: bigint;
      decimals: number | null;
      symbol?: string | null;
      name?: string | null;
      tokenInfo?: TokenInfo;
    };

    // Build on-chain map
    const onChainMap = new Map<string, BalanceEntry>();
    for (const b of onChainBalances.balances ?? []) {
      const chainId = b.network;
      const contract = (b.contractAddress || '').toLowerCase();
      if (!chainId || !contract) continue;
      const raw = String(b.balance ?? '0');
      const tokenInfo = b.token
        ? {
            _id: '', // On-chain data doesn't have MongoDB _id
            id: b.token.id,
            symbol: b.token.symbol,
            name: b.token.name,
            image: b.token.image,
          }
        : undefined;
      onChainMap.set(`${chainId}:${contract}`, {
        tokenContractId: b.tokenContractId,
        chainId,
        contractAddress: contract,
        balance: BigInt(raw),
        decimals: typeof b.decimals === 'number' ? b.decimals : null,
        symbol: b.symbol ?? null,
        name: b.name ?? null,
        tokenInfo,
      });
    }
    for (const n of onChainBalances.nativeBalances ?? []) {
      const chainId = n.network;
      const raw = String(n.balance ?? '0');
      const tokenInfo = n.token
        ? {
            _id: '', // On-chain data doesn't have MongoDB _id
            id: n.token.id,
            symbol: n.token.symbol,
            name: n.token.name,
            image: n.token.image,
          }
        : undefined;
      onChainMap.set(`${chainId}:${NATIVE_CONTRACT_ADDRESS}`, {
        chainId,
        contractAddress: NATIVE_CONTRACT_ADDRESS,
        balance: BigInt(raw),
        decimals: null,
        symbol: n.symbol ?? null,
        name: n.name ?? null,
        tokenInfo,
      });
    }

    // Build stored map from DB
    const storedMap = new Map<string, BalanceEntry>();
    for (const t of blockchainWallet.tokens ?? []) {
      const tc = t.tokenContractId as unknown as {
        chainId: string;
        contractAddress: string;
        symbol?: string;
        name?: string;
        tokenId?: PopulatedToken | Types.ObjectId;
      };
      if (!tc || typeof tc !== 'object') continue;
      const chainId = tc.chainId;
      const contract = (tc.contractAddress || '').toLowerCase();
      if (!chainId || !contract) continue;
      const rawStored = String(t.balance ?? '0');
      const tokenInfo =
        tc.tokenId && typeof tc.tokenId === 'object'
          ? this.toTokenInfo(tc.tokenId as PopulatedToken)
          : undefined;
      storedMap.set(`${chainId}:${contract}`, {
        chainId,
        tokenContractId: t.tokenContractId._id,
        contractAddress: contract,
        balance: BigInt(rawStored),
        decimals: null,
        symbol: tc.symbol ?? undefined,
        name: tc.name ?? undefined,
        tokenInfo,
      });
    }

    // Compute differences; include only non-zero diffs and new tokens with non-zero balance
    const allKeys = new Set<string>([
      ...onChainMap.keys(),
      ...storedMap.keys(),
    ]);

    const differences = [] as Array<{
      tokenContractId?: Types.ObjectId;
      contractAddress: string;
      balance: string;
      balanceFormatted: string;
      walletBalance: string;
      walletBalanceFormatted: string;
      symbol: string | null;
      name: string | null;
      logo: string | null;
      decimals: number | null;
      network: string;
      token: {
        id: string;
        symbol: string;
        name: string;
        image: TokenInfo['image'];
      };
    }>;

    for (const key of allKeys) {
      const oc = onChainMap.get(key);
      const st = storedMap.get(key);
      const network = oc?.chainId ?? st?.chainId ?? '';
      const contractAddress = oc?.contractAddress ?? st?.contractAddress ?? '';
      const onChainBal = oc?.balance ?? 0n;
      const walletBal = st?.balance ?? 0n;
      const diff = onChainBal - walletBal;
      if (diff === 0n) continue;

      // Use token info from either stored or on-chain data
      const tokenInfo = st?.tokenInfo ?? oc?.tokenInfo;
      // Filter out entries without token metadata
      if (!tokenInfo) continue;

      // Format balance similar to getOnChainBalanceByAddress
      const decimals = oc?.decimals ?? 18;
      const balanceFormatted =
        decimals !== null
          ? (Number(onChainBal) / Math.pow(10, decimals)).toString()
          : onChainBal.toString();
      const walletBalanceFormatted =
        decimals !== null
          ? (Number(walletBal) / Math.pow(10, decimals)).toString()
          : walletBal.toString();

      differences.push({
        tokenContractId: oc?.tokenContractId,
        contractAddress,
        balance: '0x' + onChainBal.toString(16).padStart(64, '0'),
        balanceFormatted,
        walletBalance: '0x' + walletBal.toString(16).padStart(64, '0'),
        walletBalanceFormatted,
        symbol: tokenInfo.symbol ?? null,
        name: tokenInfo.name ?? null,
        logo: tokenInfo.image?.thumb ?? null,
        decimals: oc?.decimals ?? null,
        network,
        token: {
          id: tokenInfo.id,
          symbol: tokenInfo.symbol ?? '',
          name: tokenInfo.name ?? '',
          image: tokenInfo.image,
        },
      });
    }

    return {
      address: blockchainWallet.address,
      chains: blockchainWallet.chains,
      totalTokens: differences.length,
      tokensWithDifferences: differences.length,
      differences,
    };
  }

  async getOnChainBalanceByAddress(address: string, chain: string[]) {
    const balancesData = await this.alchemysService.getTokenBalances(
      chain,
      address,
    );

    // Enrich with token metadata from our database
    const enrichedBalances = await Promise.all(
      balancesData.tokenBalances.map(async (balance) => {
        // Map the network to CoinGecko chain ID
        const coinGeckoChainId =
          CHAIN_MAPPING[balance.network] || balance.network;

        // Find token by contract address
        const tokenContract = await this.tokensService.findByContractAddress(
          coinGeckoChainId,
          balance.contractAddress,
        );

        // If token exists but has no image, fetch it from CoinGecko and update database
        if (
          tokenContract &&
          tokenContract.tokenId &&
          (!tokenContract.tokenId.image?.thumb ||
            !tokenContract.tokenId.image?.small ||
            !tokenContract.tokenId.image?.large)
        ) {
          try {
            this.logger.debug(
              `Token ${tokenContract.tokenId.id} missing image, fetching from CoinGecko...`,
            );

            const coinData = await this.coingeckoService.getCoinById(
              tokenContract.tokenId.id,
            );

            if (coinData?.image) {
              // Update token in database with new image
              await this.tokensService.updateTokenImage(
                tokenContract.tokenId.id,
                coinData.image,
              );

              // Update the token object for the response
              tokenContract.tokenId.image = coinData.image;

              this.logger.debug(
                `Updated image for token ${tokenContract.tokenId.id} in database`,
              );
            }
          } catch (error: unknown) {
            const errorResponse =
              error &&
              typeof error === 'object' &&
              'response' in error &&
              typeof error.response === 'object' &&
              error.response &&
              'status' in error.response
                ? (error.response as { status: number })
                : null;

            if (errorResponse?.status === 429) {
              this.logger.warn(
                `Rate limit hit while fetching image for token ${tokenContract.tokenId.id}. Continuing with existing data...`,
              );
            } else {
              this.logger.error(
                `Error fetching image for token ${tokenContract.tokenId.id}: ${error instanceof Error ? error.message : String(error)}`,
              );
            }
          }
        }

        return {
          tokenContractId: tokenContract?._id,
          contractAddress: balance.contractAddress,
          balance: balance.rawBalance,
          balanceFormatted: balance.balance,
          symbol: balance.symbol,
          name: balance.name,
          logo: balance.logo,
          decimals: balance.decimals,
          network: coinGeckoChainId,
          token: tokenContract
            ? {
                id: tokenContract.tokenId.id,
                symbol: tokenContract.tokenId.symbol,
                name: tokenContract.tokenId.name,
                image: tokenContract.tokenId.image,
              }
            : null,
        };
      }),
    );

    // Also enrich native token balances (no real contract address)
    const NATIVE_CONTRACT_ADDRESS =
      '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee';
    const enrichedNativeBalances = await Promise.all(
      balancesData.nativeBalances.map(async (native) => {
        const coinGeckoChainId =
          CHAIN_MAPPING[native.network] || native.network;

        // Find native token via special native address mapping
        const tokenContract = await this.tokensService.findByContractAddress(
          coinGeckoChainId,
          NATIVE_CONTRACT_ADDRESS,
        );

        // If token exists but has no image, fetch it from CoinGecko and update database
        if (
          tokenContract &&
          tokenContract.tokenId &&
          (!tokenContract.tokenId.image?.thumb ||
            !tokenContract.tokenId.image?.small ||
            !tokenContract.tokenId.image?.large)
        ) {
          try {
            this.logger.debug(
              `Native token ${tokenContract.tokenId.id} missing image, fetching from CoinGecko...`,
            );

            const coinData = await this.coingeckoService.getCoinById(
              tokenContract.tokenId.id,
            );

            if (coinData?.image) {
              await this.tokensService.updateTokenImage(
                tokenContract.tokenId.id,
                coinData.image,
              );

              tokenContract.tokenId.image = coinData.image;
              this.logger.debug(
                `Updated image for native token ${tokenContract.tokenId.id} in database`,
              );
            }
          } catch (error: unknown) {
            const errorResponse =
              error &&
              typeof error === 'object' &&
              'response' in error &&
              typeof error.response === 'object' &&
              error.response &&
              'status' in error.response
                ? (error.response as { status: number })
                : null;

            if (errorResponse?.status === 429) {
              this.logger.warn(
                `Rate limit hit while fetching image for native token ${tokenContract.tokenId.id}. Continuing with existing data...`,
              );
            } else {
              this.logger.error(
                `Error fetching image for native token ${tokenContract.tokenId.id}: ${error instanceof Error ? error.message : String(error)}`,
              );
            }
          }
        }

        return {
          tokenContractId: tokenContract?._id,
          contractAddress: NATIVE_CONTRACT_ADDRESS,
          balance: native.rawBalance,
          balanceFormatted: native.balance,
          symbol: tokenContract?.symbol ?? null,
          name: tokenContract?.tokenId.name ?? null,
          logo: tokenContract?.tokenId.image?.thumb ?? null,
          decimals: null,
          network: coinGeckoChainId,
          token: tokenContract
            ? {
                id: tokenContract.tokenId.id,
                symbol: tokenContract.tokenId.symbol,
                name: tokenContract.tokenId.name,
                image: tokenContract.tokenId.image,
              }
            : null,
        };
      }),
    );

    // Filter out any entries that don't have token metadata
    const filteredBalances = enrichedBalances.filter((b) => b.token !== null);
    const filteredNativeBalances = enrichedNativeBalances.filter(
      (b) => b.token !== null,
    );

    return {
      address,
      chain,
      nativeBalances: filteredNativeBalances,
      balances: filteredBalances,
      totalTokens: filteredBalances.length,
      tokensWithMetadata: filteredBalances.length,
    };
  }

  // Helper to convert PopulatedToken to TokenInfo
  toTokenInfo(token: PopulatedToken): TokenInfo {
    return {
      _id: token._id.toString(),
      id: token.id || '',
      name: token.name,
      symbol: token.symbol,
      image: token.image,
    };
  }
}
