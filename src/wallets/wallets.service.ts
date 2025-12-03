import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { UsersService } from '../users/users.service';
import { CreateWalletDto } from './dto/create-wallet.dto';
import { Wallet, WalletDocument } from './schemas/wallet.schema';

@Injectable()
export class WalletsService {
  constructor(
    @InjectModel(Wallet.name) private walletModel: Model<WalletDocument>,
    private readonly usersService: UsersService,
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
}
