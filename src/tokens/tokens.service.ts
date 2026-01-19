import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { CoingeckoService } from 'src/coingecko/coingecko.service';
import {
  CoinDetailData,
  CoingeckoListCoinsWithPlatformsResponse,
} from 'src/coingecko/interfaces/coingecko-api.interface';
import {
  TokenContract,
  TokenContractDocument,
} from './schema/token-contract.schema';
import {
  DailyPrice,
  TokenHistoricalPrice,
  TokenHistoricalPriceDocument,
} from './schema/token-historical-price.schema';
import {
  TokenUpdateLog,
  TokenUpdateLogDocument,
} from './schema/token-update-log.schema';
import { Token, TokenDocument } from './schema/token.schema';

// Populated type for TokenContract with tokenId populated
export interface PopulatedTokenContract extends Omit<TokenContract, 'tokenId'> {
  _id: Types.ObjectId;
  tokenId: Token;
  createdAt?: Date;
  updatedAt?: Date;
}

@Injectable()
export class TokensService {
  private readonly logger = new Logger(TokensService.name);
  private readonly MIN_UPDATE_INTERVAL_MS = 10 * 60 * 1000;

  constructor(
    @InjectModel(Token.name) private tokenModel: Model<TokenDocument>,
    @InjectModel(TokenUpdateLog.name)
    private tokenUpdateLogModel: Model<TokenUpdateLogDocument>,
    @InjectModel(TokenContract.name)
    private tokenContractModel: Model<TokenContractDocument>,
    @InjectModel(TokenHistoricalPrice.name)
    private tokenHistoricalPriceModel: Model<TokenHistoricalPriceDocument>,
    private readonly coingeckoService: CoingeckoService,
  ) {}

  async updateDatabaseFromCoingecko(
    startPage: number = 1,
    endPage?: number,
    perPage: number = 250,
  ) {
    try {
      if (startPage === 1) {
        const lastUpdate = await this.tokenUpdateLogModel
          .findOne({ syncType: 'coingecko_sync' })
          .sort({ lastUpdatedAt: -1 })
          .exec();

        if (lastUpdate) {
          const timeSinceLastUpdate =
            Date.now() - lastUpdate.lastUpdatedAt.getTime();
          const minutesSinceLastUpdate = Math.floor(
            timeSinceLastUpdate / 1000 / 60,
          );

          if (timeSinceLastUpdate < this.MIN_UPDATE_INTERVAL_MS) {
            const remainingMinutes = Math.ceil(
              (this.MIN_UPDATE_INTERVAL_MS - timeSinceLastUpdate) / 1000 / 60,
            );

            this.logger.warn(
              `Update skipped: Last update was ${minutesSinceLastUpdate} minutes ago. Please wait ${remainingMinutes} more minutes.`,
            );

            return {
              success: false,
              message: `Update too frequent. Last update was ${minutesSinceLastUpdate} minutes ago. Please wait ${remainingMinutes} more minutes before updating again.`,
              lastUpdatedAt: lastUpdate.lastUpdatedAt,
              nextUpdateAllowedAt: new Date(
                lastUpdate.lastUpdatedAt.getTime() +
                  this.MIN_UPDATE_INTERVAL_MS,
              ),
            };
          }
        }
      }

      const allCoins: Array<{
        id: string;
        symbol: string;
        name: string;
        image: string;
      }> = [];
      let page = startPage;
      const maxPage = endPage || startPage + 4;
      let hasMore = true;

      while (hasMore && page <= maxPage) {
        try {
          this.logger.log(
            `Fetching page ${page} (${perPage} items per page)...`,
          );

          const coins = await this.coingeckoService.getCoinsMarkets(
            page,
            perPage,
          );

          if (coins.length === 0) {
            this.logger.log(`No more coins found at page ${page}`);
            hasMore = false;
          } else {
            allCoins.push(...coins);
            this.logger.log(
              `Fetched ${coins.length} coins from page ${page}. Total: ${allCoins.length}`,
            );

            page++;

            // Add delay between requests to avoid rate limiting
            if (hasMore && page <= maxPage) {
              await new Promise((resolve) => setTimeout(resolve, 2000));
            } else {
              hasMore = false;
            }
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
              `Rate limit hit at page ${page}. Stopping market data fetch. Got ${allCoins.length} coins so far.`,
            );
          } else {
            this.logger.error(
              `Error fetching page ${page}: ${error instanceof Error ? error.message : String(error)}`,
            );
          }
          hasMore = false;
        }
      }

      if (allCoins.length === 0) {
        return {
          success: false,
          message: 'No coins fetched from CoinGecko',
          startPage,
          endPage: page - 1,
        };
      }

      await new Promise((resolve) => setTimeout(resolve, 5000));

      let coinsWithPlatforms: CoingeckoListCoinsWithPlatformsResponse = [];

      try {
        coinsWithPlatforms =
          await this.coingeckoService.listCoinsWithPlatforms();
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
            'Rate limit hit when fetching platform data. Skipping contract address sync for this update.',
          );
        } else {
          this.logger.error(
            `Error fetching platform data: ${error instanceof Error ? error.message : String(error)}`,
          );
        }
        coinsWithPlatforms = [];
      }

      // Use bulkWrite for efficient upsert operations
      const bulkOps = allCoins.map((coin) => ({
        updateOne: {
          filter: { id: coin.id },
          update: {
            $set: {
              id: coin.id,
              symbol: coin.symbol,
              name: coin.name,
              image: {
                thumb: coin.image,
                small: coin.image,
                large: coin.image,
              },
            },
          },
          upsert: true,
        },
      }));

      const result = await this.tokenModel.bulkWrite(bulkOps);

      // Process contract addresses
      const contractOps: Array<{
        updateOne: {
          filter: { chainId: string; contractAddress: string };
          update: {
            $set: {
              tokenId: any;
              coinGeckoId: string;
              chainId: string;
              contractAddress: string;
              symbol: string;
              name: string;
            };
          };
          upsert: boolean;
        };
      }> = [];

      for (const coin of coinsWithPlatforms) {
        if (coin.platforms && Object.keys(coin.platforms).length > 0) {
          // Get the token document to link contracts
          const tokenDoc = await this.tokenModel.findOne({ id: coin.id });

          if (tokenDoc) {
            for (const [chainId, contractAddress] of Object.entries(
              coin.platforms,
            )) {
              if (contractAddress && typeof contractAddress === 'string') {
                contractOps.push({
                  updateOne: {
                    filter: {
                      chainId: chainId,
                      contractAddress: contractAddress.toLowerCase(),
                    },
                    update: {
                      $set: {
                        tokenId: tokenDoc._id,
                        coinGeckoId: coin.id,
                        chainId: chainId,
                        contractAddress: contractAddress.toLowerCase(),
                        symbol: coin.symbol,
                        name: coin.name,
                      },
                    },
                    upsert: true,
                  },
                });
              }
            }
          }
        }
      }

      let contractResult = { upsertedCount: 0, modifiedCount: 0 };
      if (contractOps.length > 0) {
        contractResult = await this.tokenContractModel.bulkWrite(contractOps);
      }

      // Log this update
      const now = new Date();
      await this.tokenUpdateLogModel.create({
        syncType: 'coingecko_sync',
        lastUpdatedAt: now,
        totalCoins: allCoins.length,
        inserted: result.upsertedCount,
        updated: result.modifiedCount,
        totalContracts: contractOps.length,
        contractsInserted: contractResult.upsertedCount,
        contractsUpdated: contractResult.modifiedCount,
      });

      const actualEndPage = page - 1;
      const nextPage = actualEndPage + 1;

      return {
        success: true,
        totalCoins: allCoins.length,
        inserted: result.upsertedCount,
        updated: result.modifiedCount,
        totalContracts: contractOps.length,
        contractsInserted: contractResult.upsertedCount,
        contractsUpdated: contractResult.modifiedCount,
        message: 'Token database updated successfully',
        updatedAt: now,
        pagination: {
          startPage,
          endPage: actualEndPage,
          nextPage,
          perPage,
          coinsPerPage: Math.ceil(
            allCoins.length / (actualEndPage - startPage + 1),
          ),
        },
      };
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);

      this.logger.error(`Error updating token database: ${errorMessage}`);

      return {
        success: false,
        error: errorMessage,
        message: 'Failed to update token database',
      };
    }
  }

  async findAll(page: number = 1, limit: number = 10, search?: string) {
    const skip = (page - 1) * limit;

    // Build search filter if search term is provided
    const filter = search
      ? {
          $or: [
            { name: { $regex: `^${search}`, $options: 'i' } },
            { symbol: { $regex: `^${search}`, $options: 'i' } },
          ],
        }
      : {};

    // Execute query with pagination
    const [tokens, total] = await Promise.all([
      this.tokenModel
        .find(filter)
        .skip(skip)
        .limit(limit)
        .select('-__v')
        .lean()
        .exec(),
      this.tokenModel.countDocuments(filter),
    ]);

    const totalPages = Math.ceil(total / limit);

    return {
      data: tokens,
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
      },
    };
  }

  findOne(id: Types.ObjectId) {
    return this.tokenModel.findOne({ _id: id }).exec();
  }

  findOneByCoinGeckoId(coinGeckoId: string) {
    return this.tokenModel.findOne({ id: coinGeckoId }).exec();
  }

  fineToken(tokenId: Types.ObjectId, coingeckoId: string) {
    if (tokenId) {
      return this.findOne(tokenId);
    }
    if (coingeckoId) {
      return this.findOneByCoinGeckoId(coingeckoId);
    }
    throw new BadRequestException(
      'Either tokenId or coingeckoId must be provided',
    );
  }

  async findByContractAddress(
    chainId: string,
    contractAddress: string,
  ): Promise<PopulatedTokenContract | null> {
    const contract = (await this.tokenContractModel
      .findOne({
        chainId: chainId.toLowerCase(),
        contractAddress: contractAddress.toLowerCase(),
      })
      .populate('tokenId')
      .lean()
      .exec()) as PopulatedTokenContract | null;

    return contract;
  }

  async getTokenContracts(tokenId: string) {
    const token = await this.tokenModel.findOne({ id: tokenId }).exec();

    if (!token) {
      return [];
    }

    return this.tokenContractModel.find({ tokenId: token._id }).exec();
  }

  /**
   * Generate token contracts from existing tokens in MongoDB
   * Fetches platform/contract data from CoinGecko for tokens that don't have contracts
   * @param batchSize - Number of tokens to process per batch (default: 50)
   * @param startIndex - Starting index for processing tokens (default: 0)
   * @param endIndex - Ending index for processing tokens (optional)
   */
  async generateTokenContracts(
    batchSize: number = 50,
    startIndex: number = 0,
    endIndex?: number,
  ) {
    try {
      this.logger.log('Starting token contract generation...');

      // Get all tokens from database
      const totalTokens = await this.tokenModel.countDocuments();
      const actualEndIndex = endIndex || totalTokens;

      this.logger.log(
        `Total tokens in database: ${totalTokens}. Processing from index ${startIndex} to ${actualEndIndex}`,
      );

      // Get tokens in the specified range
      const tokens = await this.tokenModel
        .find()
        .skip(startIndex)
        .limit(actualEndIndex - startIndex)
        .select('_id id symbol name')
        .lean()
        .exec();

      this.logger.log(`Fetched ${tokens.length} tokens to process`);

      let totalContractsAdded = 0;
      let totalContractsUpdated = 0;
      let processedTokens = 0;
      let skippedTokens = 0;
      let errorCount = 0;

      // Process tokens in batches
      for (let i = 0; i < tokens.length; i += batchSize) {
        const batch = tokens.slice(i, i + batchSize);
        this.logger.log(
          `Processing batch ${Math.floor(i / batchSize) + 1} of ${Math.ceil(tokens.length / batchSize)} (${batch.length} tokens)`,
        );

        for (const token of batch) {
          try {
            // Check if token already has contracts
            const existingContracts = await this.tokenContractModel
              .countDocuments({ tokenId: token._id })
              .exec();

            if (existingContracts > 0) {
              this.logger.debug(
                `Token ${token.id} already has ${existingContracts} contracts, skipping`,
              );
              skippedTokens++;
              continue;
            }

            // Fetch coin details with platforms from CoinGecko
            this.logger.debug(`Fetching platform data for ${token.id}...`);

            const coinsWithPlatforms =
              await this.coingeckoService.listCoinsWithPlatforms();
            const coinData = coinsWithPlatforms.find((c) => c.id === token.id);

            if (!coinData || !coinData.platforms) {
              this.logger.debug(`No platform data found for token ${token.id}`);
              processedTokens++;
              continue;
            }

            // Create contract entries for each platform
            const contractOps: Array<{
              updateOne: {
                filter: { chainId: string; contractAddress: string };
                update: {
                  $set: {
                    tokenId: any;
                    coinGeckoId: string;
                    chainId: string;
                    contractAddress: string;
                    symbol: string;
                    name: string;
                  };
                };
                upsert: boolean;
              };
            }> = [];

            let contractsForToken = 0;

            for (const [chainId, contractAddress] of Object.entries(
              coinData.platforms,
            )) {
              if (contractAddress && typeof contractAddress === 'string') {
                contractOps.push({
                  updateOne: {
                    filter: {
                      chainId: chainId,
                      contractAddress: contractAddress.toLowerCase(),
                    },
                    update: {
                      $set: {
                        tokenId: token._id,
                        coinGeckoId: token.id as string,
                        chainId: chainId,
                        contractAddress: contractAddress.toLowerCase(),
                        symbol: token.symbol,
                        name: token.name,
                      },
                    },
                    upsert: true,
                  },
                });
                contractsForToken++;
              }
            }

            if (contractOps.length > 0) {
              const result =
                await this.tokenContractModel.bulkWrite(contractOps);
              totalContractsAdded += result.upsertedCount;
              totalContractsUpdated += result.modifiedCount;

              this.logger.debug(
                `Added ${contractsForToken} contracts for token ${token.id}`,
              );
            }

            processedTokens++;

            // Add delay to respect rate limits
            await new Promise((resolve) => setTimeout(resolve, 100));
          } catch (error: unknown) {
            errorCount++;
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
                `Rate limit hit while processing token ${token.id}. Stopping batch.`,
              );
              // Stop processing this batch on rate limit
              break;
            } else {
              this.logger.error(
                `Error processing token ${token.id}: ${error instanceof Error ? error.message : String(error)}`,
              );
            }
          }
        }

        // Add delay between batches
        if (i + batchSize < tokens.length) {
          this.logger.log('Waiting 2 seconds before next batch...');
          await new Promise((resolve) => setTimeout(resolve, 2000));
        }
      }

      const summary = {
        success: true,
        message: 'Token contract generation completed',
        totalTokensInRange: tokens.length,
        processedTokens,
        skippedTokens,
        errorCount,
        totalContractsAdded,
        totalContractsUpdated,
        range: {
          startIndex,
          endIndex: actualEndIndex,
          nextStartIndex: actualEndIndex,
        },
      };

      this.logger.log(
        `Contract generation summary: ${JSON.stringify(summary)}`,
      );

      return summary;
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);

      this.logger.error(`Error generating token contracts: ${errorMessage}`);

      return {
        success: false,
        error: errorMessage,
        message: 'Failed to generate token contracts',
      };
    }
  }

  /**
   * Update images for existing tokens in MongoDB
   * Fetches latest image data from CoinGecko by individual coin ID
   * Rate limit: 30 requests per minute (2000ms delay between requests)
   * @param batchSize - Number of tokens to process per batch (default: 30)
   * @param startIndex - Starting index for processing tokens (default: 0)
   * @param endIndex - Ending index for processing tokens (optional)
   */
  async updateTokenImages(
    batchSize: number = 30,
    startIndex: number = 0,
    endIndex?: number,
  ) {
    try {
      this.logger.log('Starting token image update...');

      // Rate limit: 30 requests/min = 1 request every 2 seconds
      const RATE_LIMIT_DELAY_MS = 2000;

      // Get all tokens from database
      const totalTokens = await this.tokenModel.countDocuments();
      const actualEndIndex = endIndex || totalTokens;

      this.logger.log(
        `Total tokens in database: ${totalTokens}. Processing from index ${startIndex} to ${actualEndIndex}`,
      );
      this.logger.log(
        `Rate limit: 30 requests/min (${RATE_LIMIT_DELAY_MS}ms delay between requests)`,
      );

      // Get tokens in the specified range
      const tokens = await this.tokenModel
        .find()
        .skip(startIndex)
        .limit(actualEndIndex - startIndex)
        .select('_id id symbol name image')
        .lean()
        .exec();

      this.logger.log(`Fetched ${tokens.length} tokens to process`);

      let updated = 0;
      let alreadyHasImage = 0;
      let errors = 0;

      // Process tokens in batches
      for (let i = 0; i < tokens.length; i += batchSize) {
        const batch = tokens.slice(i, i + batchSize);
        this.logger.log(
          `Processing batch ${Math.floor(i / batchSize) + 1} of ${Math.ceil(tokens.length / batchSize)} (${batch.length} tokens)`,
        );

        for (const token of batch) {
          try {
            // Check if token already has image
            if (
              token.image &&
              token.image.thumb &&
              token.image.small &&
              token.image.large
            ) {
              alreadyHasImage++;
              this.logger.debug(
                `Token ${token.id} already has images, skipping`,
              );
              continue;
            }

            // Fetch coin details from CoinGecko
            this.logger.debug(`Fetching image data for ${token.id}...`);

            const coinData: CoinDetailData =
              await this.coingeckoService.getCoinById(token.id as string);

            if (!coinData?.image) {
              this.logger.debug(`No image data found for token ${token.id}`);
              errors++;
              continue;
            }

            // Update token with image data
            await this.tokenModel.updateOne(
              { id: token.id },
              {
                $set: {
                  image: coinData.image,
                },
              },
            );

            updated++;
            this.logger.debug(`Updated image for token ${token.id}`);

            // Respect rate limit: 30 requests/min = 1 request every 2 seconds
            await new Promise((resolve) => setTimeout(resolve, 10000));
          } catch (error: unknown) {
            errors++;
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
                `Rate limit hit while processing token ${token.id}. Stopping batch.`,
              );
              // Stop processing this batch on rate limit
              break;
            } else {
              this.logger.error(
                `Error processing token ${token.id}: ${error instanceof Error ? error.message : String(error)}`,
              );
            }
          }
        }

        // Add delay between batches (optional, already have per-request delay)
        if (i + batchSize < tokens.length) {
          this.logger.log(
            `Waiting ${RATE_LIMIT_DELAY_MS}ms before next batch...`,
          );
          await new Promise((resolve) => setTimeout(resolve, 20000));
        }
      }

      const summary = {
        success: true,
        message: 'Token image update completed',
        totalTokensInRange: tokens.length,
        updated,
        alreadyHasImage,
        errors,
        range: {
          startIndex,
          endIndex: actualEndIndex,
          nextStartIndex: actualEndIndex,
        },
      };

      this.logger.log(`Image update summary: ${JSON.stringify(summary)}`);

      return summary;
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);

      this.logger.error(`Error updating token images: ${errorMessage}`);

      return {
        success: false,
        error: errorMessage,
        message: 'Failed to update token images',
      };
    }
  }

  async handleTokenImageUpdate() {
    try {
      this.logger.log('Starting scheduled token image update...');

      const result = await this.updateTokenImages(50, 0);

      if (result.success) {
        this.logger.log(
          `Token image update completed successfully. Updated: ${'updated' in result ? result.updated : 0}, Already had images: ${'alreadyHasImage' in result ? result.alreadyHasImage : 0}, Errors: ${'errors' in result ? result.errors : 0}`,
        );
      } else {
        this.logger.error(`Token image update failed: ${result.message}`);
      }
    } catch (error) {
      this.logger.error(
        `Error in token image update: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * Update a single token's image in the database
   * @param tokenId - The CoinGecko ID of the token
   * @param image - The image object with thumb, small, and large URLs
   */
  async updateTokenImage(
    tokenId: string,
    image: { thumb: string; small: string; large: string },
  ) {
    return this.tokenModel
      .updateOne(
        { id: tokenId },
        {
          $set: {
            image: image,
          },
        },
      )
      .exec();
  }

  /**
   * Add native token contract addresses for blockchain platforms
   * Fetches asset platforms from CoinGecko and creates TokenContract records for native coins
   * For native tokens, uses a special address format since they don't have actual contract addresses
   */
  async addAddressToNativeToken() {
    try {
      this.logger.log('Starting native token address addition...');

      // Fetch asset platforms list from CoinGecko
      const platforms = await this.coingeckoService.getAssetPlatformsList();

      this.logger.log(`Fetched ${platforms.length} asset platforms`);

      let added = 0;
      const updated = 0;
      let skipped = 0;
      let errors = 0;

      for (const platform of platforms) {
        try {
          // Skip platforms without native coin ID
          if (!platform.native_coin_id) {
            this.logger.debug(
              `Platform ${platform.id} has no native coin ID, skipping`,
            );
            skipped++;
            continue;
          }

          // Find the token in our database by CoinGecko ID
          const token = await this.tokenModel
            .findOne({ id: platform.native_coin_id })
            .exec();

          if (!token) {
            this.logger.warn(
              `Native coin ${platform.native_coin_id} not found in database for platform ${platform.id}`,
            );
            errors++;
            continue;
          }

          // For native tokens, use a special contract address format
          // Common convention is to use '0x0000000000000000000000000000000000000000' (zero address)
          // or '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee' (Ethereum native token convention)
          const nativeContractAddress =
            '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee';

          // Check if contract already exists
          const existingContract = await this.tokenContractModel
            .findOne({
              chainId: platform.id,
              contractAddress: nativeContractAddress,
            })
            .exec();

          if (existingContract) {
            this.logger.debug(
              `Native token contract already exists for ${platform.id}, skipping`,
            );
            skipped++;
            continue;
          }

          // Create the native token contract record
          await this.tokenContractModel.create({
            tokenId: token._id,
            coinGeckoId: platform.native_coin_id,
            chainId: platform.id,
            contractAddress: nativeContractAddress,
            symbol: token.symbol,
            name: token.name,
          });

          this.logger.log(
            `Added native token contract for ${platform.name} (${platform.id}): ${platform.native_coin_id}`,
          );
          added++;

          // Add delay to respect rate limits
          await new Promise((resolve) => setTimeout(resolve, 100));
        } catch (error: unknown) {
          errors++;
          this.logger.error(
            `Error processing platform ${platform.id}: ${error instanceof Error ? error.message : String(error)}`,
          );
        }
      }

      const summary = {
        success: true,
        message: 'Native token address addition completed',
        totalPlatforms: platforms.length,
        added,
        updated,
        skipped,
        errors,
      };

      this.logger.log(
        `Native token address addition summary: ${JSON.stringify(summary)}`,
      );

      return summary;
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);

      this.logger.error(`Error adding native token addresses: ${errorMessage}`);

      return {
        success: false,
        error: errorMessage,
        message: 'Failed to add native token addresses',
      };
    }
  }

  remove(id: Types.ObjectId) {
    return this.tokenModel.findOneAndDelete({ _id: id }).exec();
  }

  async addTokenById(coinGeckoId: string) {
    try {
      const coinData: CoinDetailData =
        await this.coingeckoService.getCoinById(coinGeckoId);
      return this.tokenModel.updateOne(
        { id: coinData.id },
        {
          $set: {
            id: coinData.id,
            symbol: coinData.symbol,
            name: coinData.name,
            image: coinData.image,
          },
        },
        { upsert: true },
      );
    } catch (error) {
      this.logger.error(
        `Error adding token ${coinGeckoId}: ${error instanceof Error ? error.message : String(error)}`,
      );
      return null;
    }
  }

  /**
   * Get historical prices for a token (fetches from cache or CoinGecko)
   * @param coinGeckoId - CoinGecko coin ID
   * @param days - Number of days of history to retrieve (max 365)
   */
  async getHistoricalPrices(coinGeckoId: string, days: number) {
    let token = await this.tokenModel.findOne({ id: coinGeckoId }).exec();
    if (!token) {
      const addedToken = await this.addTokenById(coinGeckoId);
      if (!addedToken) {
        return new NotFoundException(`Token ${coinGeckoId} not found`);
      }
      token = await this.tokenModel.findOne({ id: coinGeckoId }).exec();
    }

    if (!token) {
      return new NotFoundException(`Token ${coinGeckoId} not found`);
    }

    const savedHistoricalPrices = await this.tokenHistoricalPriceModel
      .findOne({ tokenId: token._id })
      .exec();

    let priceData: DailyPrice[] = [];

    if (savedHistoricalPrices) {
      const lastUpdatedTime = savedHistoricalPrices.newestDataPoint;
      const now = new Date();
      const timeDiff = now.getTime() - lastUpdatedTime.getTime();
      const oneDayMs = 24 * 60 * 60 * 1000;

      // If data is less than 1 day old, return cached data
      if (timeDiff < oneDayMs) {
        priceData = savedHistoricalPrices.dailyPrices;
      } else {
        // Data is stale, update it
        await this.updateHistoricalPrices(token._id, coinGeckoId);

        // Fetch updated data
        const updated = await this.tokenHistoricalPriceModel
          .findOne({ tokenId: token._id })
          .exec();
        priceData = updated?.dailyPrices || [];
      }
    } else {
      // No cached data, fetch and store initial historical data
      await this.updateHistoricalPrices(token._id, coinGeckoId, days);

      const newData = await this.tokenHistoricalPriceModel
        .findOne({ tokenId: token._id })
        .exec();
      priceData = newData?.dailyPrices || [];
    }

    // Calculate available time ranges based on data length
    const totalDays = priceData.length;
    const availableRanges = {
      '1d': totalDays >= 1,
      '7d': totalDays >= 7,
      '1m': totalDays >= 30,
      '3m': totalDays >= 90,
      '1y': totalDays >= 364,
    };

    // Fetch current price data and add to prices array
    let currentPrice: number | undefined;
    try {
      const currentPriceData = await this.coingeckoService.getCurrentPrice([
        coinGeckoId,
      ]);
      if (currentPriceData[coinGeckoId]) {
        const volume_24h = currentPriceData[coinGeckoId].usd_24h_vol || 0;
        const market_cap = currentPriceData[coinGeckoId].usd_market_cap || 0;
        const last_updated = currentPriceData[coinGeckoId].last_updated_at;
        if (volume_24h && market_cap && last_updated) {
          currentPrice = currentPriceData[coinGeckoId].usd;
          const lastUpdatedDate = new Date(last_updated * 1000);
          const latestPrice: DailyPrice = {
            date: lastUpdatedDate,
            price: currentPrice,
            volume_24h: volume_24h || 0,
            market_cap: market_cap || 0,
          };

          priceData = [...priceData, latestPrice];
        }
      }
    } catch (error) {
      this.logger.error(
        `Error fetching current price for ${coinGeckoId}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }

    return {
      prices: priceData.slice(-days),
      totalAvailableDays: currentPrice ? totalDays + 1 : totalDays,
      availableRanges,
      oldestDataPoint: priceData[0]?.date,
      newestDataPoint: priceData[priceData.length - 1]?.date,
    };
  }

  /**
   * Update historical prices for a token with 365-day rolling window
   * @param tokenId - MongoDB ObjectId of the token
   * @param coinGeckoId - CoinGecko coin ID
   * @param initialDays - Number of days to fetch initially (default 365)
   */
  async updateHistoricalPrices(
    tokenId: Types.ObjectId,
    coinGeckoId: string,
    initialDays: number = 365,
  ) {
    const MAX_DAYS = 365;
    if (initialDays > MAX_DAYS) {
      initialDays = MAX_DAYS;
    }

    try {
      // Check if historical data already exists
      const existingData = await this.tokenHistoricalPriceModel
        .findOne({ tokenId })
        .exec();

      if (!existingData) {
        // No existing data - fetch full 365 days and create new document
        const historicalData =
          await this.coingeckoService.getHistoricalMarketData(
            coinGeckoId,
            initialDays,
            'daily',
            '2',
          );

        // Transform CoinGecko data to our schema format
        const dailyPrices = historicalData.prices
          .map((priceData, index) => ({
            date: new Date(priceData[0]),
            price: priceData[1],
            volume_24h: historicalData.total_volumes[index]?.[1] || 0,
            market_cap: historicalData.market_caps[index]?.[1] || 0,
          }))
          .slice(-MAX_DAYS)
          .slice(0, -1);

        if (!dailyPrices || dailyPrices.length === 0) {
          throw new Error(`No historical price data found for ${coinGeckoId}`);
        }

        // Create new document
        await this.tokenHistoricalPriceModel.create({
          tokenId,
          dailyPrices: dailyPrices,
          oldestDataPoint: dailyPrices[0]?.date,
          newestDataPoint: dailyPrices[dailyPrices.length - 1]?.date,
        });
      } else {
        // Existing data - fetch only new days since last update
        const lastDate = existingData.newestDataPoint;
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const lastDateNormalized = new Date(lastDate);
        lastDateNormalized.setHours(0, 0, 0, 0);

        // Check if we need to fetch new data
        if (lastDateNormalized.getTime() >= today.getTime()) {
          return;
        }

        const historicalData =
          await this.coingeckoService.getHistoricalMarketData(
            coinGeckoId,
            initialDays,
            'daily',
            '2',
          );

        // Transform new data
        const newDailyPrices = historicalData.prices.map(
          (priceData, index) => ({
            date: new Date(priceData[0]),
            price: priceData[1],
            volume_24h: historicalData.total_volumes[index]?.[1] || 0,
            market_cap: historicalData.market_caps[index]?.[1] || 0,
          }),
        );

        if (newDailyPrices.length === 0) {
          return;
        }

        // Merge with existing data
        const allPrices = [...existingData.dailyPrices, ...newDailyPrices];

        // Sort by date
        allPrices.sort((a, b) => a.date.getTime() - b.date.getTime());

        // Remove duplicates (same date)
        const uniquePrices = allPrices.filter(
          (price, index, self) =>
            index ===
            self.findIndex(
              (p) => p.date.toDateString() === price.date.toDateString(),
            ),
        );

        // Keep only last 365 days (rolling window)
        const limitedPrices = uniquePrices.slice(-MAX_DAYS);

        // Update document
        existingData.dailyPrices = limitedPrices;
        existingData.oldestDataPoint = limitedPrices[0]?.date;
        existingData.newestDataPoint =
          limitedPrices[limitedPrices.length - 1]?.date;

        await existingData.save();
      }
    } catch (error: unknown) {
      this.logger.error(
        `Error updating historical prices for ${coinGeckoId}: ${error instanceof Error ? error.message : String(error)}`,
      );
      throw error;
    }
  }

  /**
   * Batch update historical prices for multiple tokens
   * @param coinGeckoIds - Array of CoinGecko coin IDs to update
   * @param delayMs - Delay between requests in milliseconds (default 1000)
   */
  async batchUpdateHistoricalPrices(
    coinGeckoIds: string[],
    delayMs: number = 1000,
  ) {
    const results = {
      success: 0,
      failed: 0,
      errors: [] as string[],
    };

    for (const coinGeckoId of coinGeckoIds) {
      try {
        const token = await this.tokenModel.findOne({ id: coinGeckoId }).exec();
        if (!token) {
          results.failed++;
          results.errors.push(`Token ${coinGeckoId} not found`);
          continue;
        }

        await this.updateHistoricalPrices(token._id, coinGeckoId);
        results.success++;

        // Delay to respect rate limits
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      } catch (error) {
        results.failed++;
        results.errors.push(
          `${coinGeckoId}: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }

    return results;
  }
}
