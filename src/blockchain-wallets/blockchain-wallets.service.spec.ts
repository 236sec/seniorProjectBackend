/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/unbound-method */

import { NotFoundException } from '@nestjs/common';
import { getModelToken } from '@nestjs/mongoose';
import { Test, TestingModule } from '@nestjs/testing';
import { Model, Types } from 'mongoose';
import { BlockchainWalletsService } from './blockchain-wallets.service';
import { UpdateBlockchainWalletDto } from './dto/update-blockchain-wallet.dto';
import { BlockchainWallet } from './schema/blockchain-wallet.schema';

describe('BlockchainWalletsService', () => {
  let service: BlockchainWalletsService;
  let model: Model<BlockchainWallet>;

  const mockBlockchainWalletModel = {
    findById: jest.fn(),
    findByIdAndUpdate: jest.fn(),
  };

  const mockId = new Types.ObjectId();

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BlockchainWalletsService,
        {
          provide: getModelToken(BlockchainWallet.name),
          useValue: mockBlockchainWalletModel,
        },
      ],
    }).compile();

    service = module.get<BlockchainWalletsService>(BlockchainWalletsService);
    model = module.get<Model<BlockchainWallet>>(
      getModelToken(BlockchainWallet.name),
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('update', () => {
    const updateDto: UpdateBlockchainWalletDto = {
      chains: ['ETH', 'BSC'],
      address: '0x123',
    };

    it('should throw NotFoundException if wallet is not found', async () => {
      jest.spyOn(model, 'findById').mockResolvedValue(null);

      await expect(service.update(mockId, updateDto)).rejects.toThrow(
        NotFoundException,
      );
      expect(model.findById).toHaveBeenCalledWith(mockId);
    });

    it('should update wallet and merge chains correctly', async () => {
      const existingWallet = {
        chains: ['ETH', 'MATIC'],
      };

      jest.spyOn(model, 'findById').mockResolvedValue(existingWallet as any);
      jest.spyOn(model, 'findByIdAndUpdate').mockResolvedValue(null);

      const result = await service.update(mockId, updateDto);

      expect(model.findById).toHaveBeenCalledWith(mockId);
      expect(model.findByIdAndUpdate).toHaveBeenCalledWith(
        mockId,
        expect.objectContaining({
          ...updateDto,
          chains: expect.arrayContaining(['ETH', 'MATIC', 'BSC']),
        }),
      );
      // Ensure no duplicates
      const callArgs = (model.findByIdAndUpdate as jest.Mock).mock.calls[0][1];
      expect(callArgs.chains).toHaveLength(3);
      expect(result).toEqual({ _id: mockId });
    });

    it('should update wallet without changing chains if unexpected chains provided', async () => {
      const updateDtoNoChains: UpdateBlockchainWalletDto = {
        address: '0xNewAddress',
      };
      const existingWallet = {
        chains: ['ETH'],
      };

      jest.spyOn(model, 'findById').mockResolvedValue(existingWallet as any);

      await service.update(mockId, updateDtoNoChains);

      expect(model.findByIdAndUpdate).toHaveBeenCalledWith(
        mockId,
        expect.objectContaining({
          ...updateDtoNoChains,
          chains: ['ETH'],
        }),
      );
    });

    it('should handle existing wallet with no chains (null or undefined)', async () => {
      const existingWallet = {
        chains: null,
      };
      jest.spyOn(model, 'findById').mockResolvedValue(existingWallet as any);

      const updateDtoWithChains: UpdateBlockchainWalletDto = {
        chains: ['SOL'],
      };

      await service.update(mockId, updateDtoWithChains);

      expect(model.findByIdAndUpdate).toHaveBeenCalledWith(
        mockId,
        expect.objectContaining({
          chains: ['SOL'],
        }),
      );
    });

    it('should handle existing wallet with no chains and no new chains provided', async () => {
      const existingWallet = { chains: null };
      jest.spyOn(model, 'findById').mockResolvedValue(existingWallet as any);

      const updateDtoNoChains: UpdateBlockchainWalletDto = {
        address: '0xNewAddress',
      };

      await service.update(mockId, updateDtoNoChains);

      expect(model.findByIdAndUpdate).toHaveBeenCalledWith(
        mockId,
        expect.objectContaining({
          chains: null,
        }),
      );
    });
  });
});
