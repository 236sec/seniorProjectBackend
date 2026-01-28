import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { Types } from 'mongoose';
import { CreateBankWalletDto } from 'src/banks-wallets/dto/create-bank-wallet.dto';
import { ParseObjectIdPipe } from 'src/common/pipes/parse-object-id.pipe';
import { TransactionsService } from 'src/transactions/transactions.service';
import { AddBlockchainWalletDto } from './dto/add-blockchain-wallet.dto';
import { CreateWalletDto } from './dto/create-wallet.dto';
import { UpdateWalletDto } from './dto/update-wallet.dto';
import { WalletsService } from './wallets.service';

@Controller('wallets')
export class WalletsController {
  constructor(
    private readonly walletsService: WalletsService,
    private readonly transactionsService: TransactionsService,
  ) {}

  @Post()
  create(
    @Query('userId', ParseObjectIdPipe) userId: Types.ObjectId,
    @Body() createWalletDto: CreateWalletDto,
  ) {
    return this.walletsService.create(userId, createWalletDto);
  }

  @Get()
  findAll() {
    return this.walletsService.findAll();
  }

  @Get('user/:userId')
  findByUserId(@Param('userId', ParseObjectIdPipe) userId: Types.ObjectId) {
    return this.walletsService.findByUserId(userId);
  }

  @Get('on-chain/balance')
  getOnChainBalance(
    @Query('address') address: string,
    @Query('chain') chain: string,
  ) {
    // Parse comma-separated chains into array
    const chains = chain.split(',').map((c) => c.trim());
    return this.walletsService.getOnChainBalanceByAddress(address, chains);
  }

  @Get(':walletId/blockchainWallets/address/:address/diff')
  getDiffBalanceByAddress(
    @Param('walletId', ParseObjectIdPipe) walletId: Types.ObjectId,
    @Param('address') address: string,
  ) {
    return this.walletsService.getDifferentBalanceInBlockchainWalletsByAddress(
      walletId,
      address,
    );
  }

  @Get('blockchainWallets/:blockchainWalletId/diff')
  getDiffBalanceBlockchainWallet(
    @Param('blockchainWalletId', ParseObjectIdPipe)
    blockchainWalletId: Types.ObjectId,
  ) {
    return this.walletsService.getDifferentBalanceInBlockchainWallets(
      blockchainWalletId,
    );
  }

  @Get('bankWallets/:bankWalletId/diff')
  getDiffBalanceBankWallet(
    @Param('bankWalletId', ParseObjectIdPipe)
    bankWalletId: Types.ObjectId,
  ) {
    return this.walletsService.getDifferentBalanceInBankWallets(bankWalletId);
  }

  @Post('bankWallets')
  addBankWallet(@Body() dto: CreateBankWalletDto) {
    return this.walletsService.addBankWalletToWallet(
      dto.walletId,
      dto.apiKey,
      dto.apiSecret,
    );
  }

  @Post('blockchainWallets')
  addBlockchainWallet(@Body() dto: AddBlockchainWalletDto) {
    const walletId = new Types.ObjectId(dto.walletId);
    return this.walletsService.addBlockchainWalletToWallet(
      walletId,
      dto.address,
      dto.chains,
    );
  }

  @Get(':id')
  findOne(@Param('id', ParseObjectIdPipe) id: Types.ObjectId) {
    return this.walletsService.findOne(id);
  }

  @Patch(':id')
  update(
    @Param('id', ParseObjectIdPipe) id: Types.ObjectId,
    @Body() updateWalletDto: UpdateWalletDto,
  ) {
    return this.walletsService.update(id, updateWalletDto);
  }

  @Delete(':id')
  remove(@Param('id', ParseObjectIdPipe) id: Types.ObjectId) {
    return this.walletsService.remove(id);
  }

  @Get('transactions/:walletId')
  getTransactions(
    @Param('walletId', ParseObjectIdPipe) walletId: Types.ObjectId,
    @Query('limit') limit?: number,
    @Query('offset') offset?: number,
  ) {
    return this.transactionsService.findByWalletWithPagination(
      walletId,
      limit,
      offset,
    );
  }
}
