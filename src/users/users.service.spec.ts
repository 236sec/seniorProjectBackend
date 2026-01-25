/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */

import { ConflictException } from '@nestjs/common';
import { getModelToken } from '@nestjs/mongoose';
import { Test, TestingModule } from '@nestjs/testing';
import { Types } from 'mongoose';
import { User } from './schemas/user.schema';
import { UsersService } from './users.service';

describe('UsersService', () => {
  let service: UsersService;
  let model: any;

  const mockUser = {
    _id: new Types.ObjectId('640c49a785237c0012345678'),
    email: 'test@example.com',
    provider: 'google',
    firstName: 'Test',
    lastName: 'User',
    wallets: [],
    save: jest.fn(),
  };

  const mockExec = jest.fn();
  const mockPopulate = jest.fn().mockReturnValue({ exec: mockExec });

  // A helper to create chainable query mocks
  const mockQueryWithPopulate = {
    populate: mockPopulate,
    exec: mockExec,
  };

  class MockUserModel {
    constructor(public data: any) {
      Object.assign(this, data);
    }

    save = jest.fn().mockResolvedValue(mockUser);

    static exists = jest.fn();
    static find = jest.fn();
    static findById = jest.fn();
    static findByIdAndUpdate = jest.fn();
    static findByIdAndDelete = jest.fn();
  }

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        {
          provide: getModelToken(User.name),
          useValue: MockUserModel,
        },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
    model = module.get(getModelToken(User.name));
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('should create a new user if not exists', async () => {
      const dto = {
        email: 'test@example.com',
        provider: 'google',
        firstName: 'Test',
        lastName: 'User',
      };

      model.exists.mockResolvedValue(null);

      const result = await service.create(dto);

      expect(model.exists).toHaveBeenCalledWith({
        email: dto.email,
        provider: dto.provider,
      });
      expect(result).toEqual(mockUser);
    });

    it('should throw ConflictException if user exists', async () => {
      const dto = {
        email: 'test@example.com',
        provider: 'google',
      };

      model.exists.mockResolvedValue({ _id: mockUser._id });

      await expect(service.create(dto as any)).rejects.toThrow(
        ConflictException,
      );
    });
  });

  describe('findOne', () => {
    it('should find user by id and populate wallets', async () => {
      const id = mockUser._id;
      model.findById.mockReturnValue(mockQueryWithPopulate);
      mockExec.mockResolvedValue(mockUser);

      const result = await service.findOne(id);

      expect(model.findById).toHaveBeenCalledWith(id);
      expect(mockPopulate).toHaveBeenCalledWith('wallets');
      expect(mockExec).toHaveBeenCalled();
      expect(result).toEqual(mockUser);
    });
  });

  describe('findOneWithWallets', () => {
    it('should find user and populate wallets', async () => {
      const id = mockUser._id;
      model.findById.mockReturnValue(mockQueryWithPopulate);
      mockExec.mockResolvedValue(mockUser);

      const result = await service.findOneWithWallets(id);

      expect(model.findById).toHaveBeenCalledWith(id);
      expect(mockPopulate).toHaveBeenCalledWith('wallets');
      expect(result).toEqual(mockUser);
    });
  });

  describe('findAll', () => {
    it('should return all users', async () => {
      model.find.mockReturnValue({
        exec: jest.fn().mockResolvedValue([mockUser]),
      });

      const result = await service.findAll();

      expect(model.find).toHaveBeenCalled();
      expect(result).toEqual([mockUser]);
    });
  });

  describe('update', () => {
    it('should update user', async () => {
      const id = mockUser._id;
      const updateDto = { firstName: 'Updated', lastName: 'User' };

      model.findByIdAndUpdate.mockReturnValue({
        exec: jest.fn().mockResolvedValue({ ...mockUser, ...updateDto }),
      });

      const result = await service.update(id, updateDto);

      expect(model.findByIdAndUpdate).toHaveBeenCalledWith(id, updateDto);
      expect(result).toEqual({ ...mockUser, ...updateDto });
    });
  });

  describe('remove', () => {
    it('should remove user', async () => {
      const id = mockUser._id;
      model.findByIdAndDelete.mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockUser),
      });

      const result = await service.remove(id);

      expect(model.findByIdAndDelete).toHaveBeenCalledWith(id);
      expect(result).toEqual(mockUser);
    });
  });

  describe('login', () => {
    it('should return existing user if found', async () => {
      const dto = {
        email: 'test@example.com',
        provider: 'google',
        firstName: 'Test',
        lastName: 'User',
      };

      const foundId = { _id: mockUser._id };
      model.exists.mockResolvedValue(foundId);

      const result = await service.login(dto);

      expect(model.exists).toHaveBeenCalledWith({
        email: dto.email,
        provider: dto.provider,
      });
      expect(result).toEqual(foundId);
    });

    it('should create new user if not found', async () => {
      const dto = {
        email: 'new@example.com',
        provider: 'google',
        firstName: 'New',
        lastName: 'User',
      };

      model.exists.mockResolvedValue(null);

      const result = await service.login(dto);

      expect(model.exists).toHaveBeenCalled();
      expect(result).toEqual(mockUser);
    });
  });

  describe('addWalletToUser', () => {
    it('should add wallet to user', async () => {
      const userId = mockUser._id;
      const walletId = new Types.ObjectId();
      const updatedUser = { ...mockUser, wallets: [walletId] };

      model.findByIdAndUpdate.mockReturnValue({
        exec: jest.fn().mockResolvedValue(updatedUser),
      });

      const result = await service.addWalletToUser(userId, walletId);

      expect(model.findByIdAndUpdate).toHaveBeenCalledWith(
        userId,
        { $push: { wallets: walletId } },
        { new: true },
      );
      expect(result).toEqual(updatedUser);
    });
  });

  describe('removeWalletFromUser', () => {
    it('should remove wallet from user', async () => {
      const userId = mockUser._id;
      const walletId = new Types.ObjectId();

      model.findByIdAndUpdate.mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockUser),
      });

      const result = await service.removeWalletFromUser(userId, walletId);

      expect(model.findByIdAndUpdate).toHaveBeenCalledWith(
        userId,
        { $pull: { wallets: walletId } },
        { new: true },
      );
      expect(result).toEqual(mockUser);
    });
  });
});
