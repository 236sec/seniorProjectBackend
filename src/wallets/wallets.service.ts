import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { AlchemysService } from 'src/alchemys/alchemys.service';
import { CoingeckoService } from 'src/coingecko/coingecko.service';
import { TokensService } from 'src/tokens/tokens.service';
import { UsersService } from '../users/users.service';
import { CreateWalletDto } from './dto/create-wallet.dto';
import { Wallet, WalletDocument } from './schemas/wallet.schema';

@Injectable()
export class WalletsService {
  private readonly logger = new Logger(WalletsService.name);

  constructor(
    @InjectModel(Wallet.name) private walletModel: Model<WalletDocument>,
    private readonly usersService: UsersService,
    private readonly alchemysService: AlchemysService,
    private readonly tokensService: TokensService,
    private readonly coingeckoService: CoingeckoService,
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
    return this.walletModel.findById(id).exec();
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

  async getOnChainBalanceByAddress(address: string, chain: string[]) {
    // Fetch token balances from Alchemy
    const balancesData = await this.alchemysService.getTokenBalances(
      chain,
      address,
    );
    this.logger.debug(
      `Fetched balances for address ${address} on chains ${chain.join(', ')}`,
    );
    this.logger.debug(`Balances data: ${JSON.stringify(balancesData)}`);

    // Map chain ID from wallet to CoinGecko platform ID
    const chainMapping: Record<string, string> = {
      'eth-mainnet': 'ethereum',
      'polygon-mainnet': 'polygon-pos',
      'arb-mainnet': 'arbitrum-one',
      'base-mainnet': 'base',
      'opt-mainnet': 'optimistic-ethereum',
      'blast-mainnet': 'blast',
      'zksync-mainnet': 'zksync',
    };

    // Enrich with token metadata from our database
    const enrichedBalances = await Promise.all(
      balancesData.tokenBalances.map(async (balance) => {
        // Map the network to CoinGecko chain ID
        const coinGeckoChainId =
          chainMapping[balance.network] || balance.network;

        // Find token by contract address
        const token = await this.tokensService.findByContractAddress(
          coinGeckoChainId,
          balance.contractAddress,
        );

        // If token exists but has no image, fetch it from CoinGecko and update database
        if (
          token &&
          (!token.image ||
            !token.image.thumb ||
            !token.image.small ||
            !token.image.large)
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
          balance: balance.balance, // Already formatted by the service
          balanceFormatted: balance.balance,
          symbol: balance.symbol,
          name: balance.name,
          logo: balance.logo,
          decimals: balance.decimals,
          network: balance.network,
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
      nativeBalances: balancesData.nativeBalances,
      balances: enrichedBalances,
      totalTokens: enrichedBalances.length,
      tokensWithMetadata: enrichedBalances.filter((b) => b.token !== null)
        .length,
    };
  }
}
