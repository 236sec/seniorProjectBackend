import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { CoingeckoService } from 'src/coingecko/coingecko.service';
import { CoingeckoListCoinsWithPlatformsResponse } from 'src/coingecko/interfaces/coingecko-api.interface';
import {
  TokenContract,
  TokenContractDocument,
} from './schema/token-contract.schema';
import {
  TokenUpdateLog,
  TokenUpdateLogDocument,
} from './schema/token-update-log.schema';
import { Token, TokenDocument } from './schema/token.schema';

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

  findOne(id: string) {
    return this.tokenModel.findOne({ id }).exec();
  }

  async findByContractAddress(chainId: string, contractAddress: string) {
    const contract = await this.tokenContractModel
      .findOne({
        chainId: chainId.toLowerCase(),
        contractAddress: contractAddress.toLowerCase(),
      })
      .exec();

    if (!contract) {
      return null;
    }

    return this.tokenModel.findById(contract.tokenId).exec();
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

  remove(id: string) {
    return this.tokenModel.findOneAndDelete({ id }).exec();
  }
}
