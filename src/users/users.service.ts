import { ConflictException, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { CreateUserDto } from './dto/create-user.dto';
import { LoginUserDto } from './dto/login-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { User, UserDocument } from './schemas/user.schema';

@Injectable()
export class UsersService {
  constructor(@InjectModel(User.name) private userModel: Model<UserDocument>) {}

  async create(createUserDto: CreateUserDto) {
    const existingUser = await this.userModel.exists({
      email: createUserDto.email,
      provider: createUserDto.provider,
    });
    if (existingUser) {
      throw new ConflictException(
        'User with this email and provider already exists',
      );
    }
    const createdUser = new this.userModel(createUserDto);
    return createdUser.save();
  }

  async findOne(id: Types.ObjectId): Promise<User | null> {
    return this.userModel.findById(id).populate('wallets').exec();
  }

  async findOneWithWallets(id: Types.ObjectId): Promise<User | null> {
    return this.userModel.findById(id).populate('wallets').exec();
  }

  findAll() {
    return this.userModel.find().exec();
  }

  update(id: Types.ObjectId, updateUserDto: UpdateUserDto) {
    return this.userModel.findByIdAndUpdate(id, updateUserDto).exec();
  }

  remove(id: Types.ObjectId) {
    return this.userModel.findByIdAndDelete(id).exec();
  }

  async login(loginUserDto: LoginUserDto) {
    const existingUser = await this.userModel.exists({
      email: loginUserDto.email,
      provider: loginUserDto.provider,
    });
    if (existingUser) {
      return existingUser;
    }
    const createdUser = new this.userModel(loginUserDto);
    return createdUser.save();
  }

  async addWalletToUser(userId: Types.ObjectId, walletId: Types.ObjectId) {
    return this.userModel
      .findByIdAndUpdate(
        userId,
        { $push: { wallets: walletId } },
        { new: true },
      )
      .exec();
  }
}
