import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import {
  BlockchainWallet,
  BlockchainWalletSchema,
} from 'src/blockchain-wallets/schema/blockchain-wallet.schema';
import {
  TokenContract,
  TokenContractSchema,
} from 'src/tokens/schema/token-contract.schema';
import { Token, TokenSchema } from 'src/tokens/schema/token.schema';
import { Wallet, WalletSchema } from 'src/wallets/schemas/wallet.schema';
import { Transaction, TransactionSchema } from './schema/transaction.schema';
import { TransactionsController } from './transactions.controller';
import { TransactionsService } from './transactions.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Transaction.name, schema: TransactionSchema },
      { name: TokenContract.name, schema: TokenContractSchema },
      { name: BlockchainWallet.name, schema: BlockchainWalletSchema },
      { name: Wallet.name, schema: WalletSchema },
      { name: Token.name, schema: TokenSchema },
    ]),
  ],
  controllers: [TransactionsController],
  providers: [TransactionsService],
})
export class TransactionsModule {}
