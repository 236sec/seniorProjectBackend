import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { CoingeckoService } from 'src/coingecko/coingecko.service';
import {
  TokenUpdateLog,
  TokenUpdateLogDocument,
} from './schema/token-update-log.schema';
import { Token, TokenDocument } from './schema/token.schema';

@Injectable()
export class TokensService {
  private readonly logger = new Logger(TokensService.name);
  private readonly MIN_UPDATE_INTERVAL_MS = 10 * 60 * 1000; // 10 minutes in milliseconds

  constructor(
    @InjectModel(Token.name) private tokenModel: Model<TokenDocument>,
    @InjectModel(TokenUpdateLog.name)
    private tokenUpdateLogModel: Model<TokenUpdateLogDocument>,
    private readonly coingeckoService: CoingeckoService,
  ) {}

  async updateDatabaseFromCoingecko() {
    try {
      // Check last update time
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
              lastUpdate.lastUpdatedAt.getTime() + this.MIN_UPDATE_INTERVAL_MS,
            ),
          };
        }
      }

      this.logger.log('Starting token database update from CoinGecko...');

      // Fetch coins with images from CoinGecko markets endpoint
      const allCoins: Array<{
        id: string;
        symbol: string;
        name: string;
        image: string;
      }> = [];
      let page = 1;
      const perPage = 250;
      let hasMore = true;

      // Fetch multiple pages to get more coins with images
      while (hasMore && allCoins.length < 5000) {
        try {
          const coins = await this.coingeckoService.getCoinsMarkets(
            page,
            perPage,
          );

          if (coins.length === 0) {
            hasMore = false;
          } else {
            allCoins.push(...coins);
            this.logger.log(
              `Fetched page ${page} with ${coins.length} coins. Total: ${allCoins.length}`,
            );
            page++;

            // Add delay to avoid rate limiting
            if (hasMore && coins.length === perPage) {
              await new Promise((resolve) => setTimeout(resolve, 1000));
            } else {
              hasMore = false;
            }
          }
        } catch (error) {
          this.logger.error(`Error fetching page ${page}: ${error}`);
          hasMore = false;
        }
      }

      this.logger.log(
        `Fetched ${allCoins.length} coins with images from CoinGecko`,
      );

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

      // Log this update
      const now = new Date();
      await this.tokenUpdateLogModel.create({
        syncType: 'coingecko_sync',
        lastUpdatedAt: now,
        totalCoins: allCoins.length,
        inserted: result.upsertedCount,
        updated: result.modifiedCount,
      });

      this.logger.log(
        `Database update completed: ${result.upsertedCount} inserted, ${result.modifiedCount} updated`,
      );

      return {
        success: true,
        totalCoins: allCoins.length,
        inserted: result.upsertedCount,
        updated: result.modifiedCount,
        message: 'Token database updated successfully',
        updatedAt: now,
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

  remove(id: string) {
    return this.tokenModel.findOneAndDelete({ id }).exec();
  }
}
