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

  findOne(id: Types.ObjectId) {
    return this.walletModel
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
      .exec();
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
      .findOne({ address })
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

  async getOnChainBalanceByAddress(address: string, chain: string[]) {
    const balancesData = await this.alchemysService.getTokenBalances(
      chain,
      address,
    );
    this.logger.debug(
      `Fetched balances for address ${address} on chains ${chain.join(', ')}`,
    );
    this.logger.debug(`Balances data: ${JSON.stringify(balancesData)}`);

    // Enrich with token metadata from our database
    const enrichedBalances = await Promise.all(
      balancesData.tokenBalances.map(async (balance) => {
        // Map the network to CoinGecko chain ID
        const coinGeckoChainId =
          CHAIN_MAPPING[balance.network] || balance.network;

        // Find token by contract address
        const token = await this.tokensService.findByContractAddress(
          coinGeckoChainId,
          balance.contractAddress,
        );

        // If token exists but has no image, fetch it from CoinGecko and update database
        if (
          token &&
          (!token.image?.thumb || !token.image?.small || !token.image?.large)
        ) {
          try {
            this.logger.debug(
              `Token ${token.id} missing image, fetching from CoinGecko...`,
            );

            const coinData = await this.coingeckoService.getCoinById(
              token.id as string,
            );

            if (coinData?.image) {
              // Update token in database with new image
              await this.tokensService.updateTokenImage(
                token.id as string,
                coinData.image,
              );

              // Update the token object for the response
              token.image = coinData.image;

              this.logger.debug(
                `Updated image for token ${token.id} in database`,
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
                `Rate limit hit while fetching image for token ${token.id}. Continuing with existing data...`,
              );
            } else {
              this.logger.error(
                `Error fetching image for token ${token.id}: ${error instanceof Error ? error.message : String(error)}`,
              );
            }
          }
        }

        return {
          contractAddress: balance.contractAddress,
          balance: balance.rawBalance, // Already formatted by the service
          balanceFormatted: balance.balance,
          symbol: balance.symbol,
          name: balance.name,
          logo: balance.logo,
          decimals: balance.decimals,
          network: coinGeckoChainId,
          token: token
            ? {
                id: token.id as string,
                symbol: token.symbol,
                name: token.name,
                image: token.image,
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
        const token = await this.tokensService.findByContractAddress(
          coinGeckoChainId,
          NATIVE_CONTRACT_ADDRESS,
        );

        // If token exists but has no image, fetch it from CoinGecko and update database
        if (
          token &&
          (!token.image?.thumb || !token.image?.small || !token.image?.large)
        ) {
          try {
            this.logger.debug(
              `Native token ${token.id} missing image, fetching from CoinGecko...`,
            );

            const coinData = await this.coingeckoService.getCoinById(
              token.id as string,
            );

            if (coinData?.image) {
              await this.tokensService.updateTokenImage(
                token.id as string,
                coinData.image,
              );

              token.image = coinData.image;

              this.logger.debug(
                `Updated image for native token ${token.id} in database`,
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
                `Rate limit hit while fetching image for native token ${token.id}. Continuing with existing data...`,
              );
            } else {
              this.logger.error(
                `Error fetching image for native token ${token.id}: ${error instanceof Error ? error.message : String(error)}`,
              );
            }
          }
        }

        return {
          contractAddress: NATIVE_CONTRACT_ADDRESS,
          balance: native.rawBalance,
          balanceFormatted: native.balance,
          symbol: token?.symbol ?? null,
          name: token?.name ?? null,
          logo: token?.image?.thumb ?? null,
          decimals: null,
          network: coinGeckoChainId,
          token: token
            ? {
                id: token.id as string,
                symbol: token.symbol,
                name: token.name,
                image: token.image,
              }
            : null,
        };
      }),
    );

    return {
      address,
      chain,
      nativeBalances: enrichedNativeBalances,
      balances: enrichedBalances,
      totalTokens: enrichedBalances.length,
      tokensWithMetadata: enrichedBalances.filter((b) => b.token !== null)
        .length,
    };
  }
}
