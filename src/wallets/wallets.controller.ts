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
import { ParseObjectIdPipe } from 'src/common/pipes/parse-object-id.pipe';
import { CreateWalletDto } from './dto/create-wallet.dto';
import { UpdateWalletDto } from './dto/update-wallet.dto';
import { WalletsService } from './wallets.service';

@Controller('wallets')
export class WalletsController {
  constructor(private readonly walletsService: WalletsService) {}

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

  @Get(':id')
  findOne(@Param('id', ParseObjectIdPipe) id: Types.ObjectId) {
    return this.walletsService.findOne(id);
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
}
