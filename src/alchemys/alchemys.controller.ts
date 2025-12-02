import { Controller, Get, Param, Query } from '@nestjs/common';
import { AlchemysService } from './alchemys.service';
import type {
  AllTransactionsServiceResponse,
  SupportedChain,
  TransactionServiceResponse,
} from './interfaces/alchemy-api.interface';

@Controller('alchemys')
export class AlchemysController {
  constructor(private readonly alchemysService: AlchemysService) {}

  @Get('chains')
  getSupportedChains(): {
    success: boolean;
    chains: readonly SupportedChain[];
  } {
    return {
      success: true,
      chains: this.alchemysService.getSupportedChains(),
    };
  }

  @Get('transactions/:address/all')
  async getAllTransactionsByAddress(
    @Param('address') address: string,
    @Query('chain') chain?: SupportedChain,
    @Query('maxPages') maxPages?: string,
  ): Promise<AllTransactionsServiceResponse> {
    const maxPagesNumber = maxPages ? parseInt(maxPages, 10) : 10;
    return this.alchemysService.getAllTransactionsByAddress(
      address,
      chain,
      maxPagesNumber,
    );
  }

  @Get('transactions/:address')
  async getTransactionsByAddress(
    @Param('address') address: string,
    @Query('chain') chain?: SupportedChain,
    @Query('pageKey') pageKey?: string,
  ): Promise<TransactionServiceResponse> {
    return this.alchemysService.getTransactionsByAddress(
      address,
      chain,
      pageKey,
    );
  }
}
