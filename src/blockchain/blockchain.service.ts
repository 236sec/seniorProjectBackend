import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ethers } from 'ethers';
import { MappingSupportedRPCToCoingeckoChain } from 'src/common/constants/chain-mapping.constant';
import { normalizeTo18Decimals } from 'src/common/utils/bigint-string.util';
import { TokensService } from 'src/tokens/tokens.service';
import { SupportedPRC } from './enum/supported-prc.enum';

interface MulticallResult {
  success: boolean;
  returnData: string;
}

@Injectable()
export class BlockchainService {
  private providers: Map<SupportedPRC, ethers.JsonRpcProvider>;
  private readonly logger: Logger;
  private readonly MULTICALL_ADDRESS =
    '0xcA11bde05977b3631167028862bE2a173976CA11';

  constructor(
    private readonly configService: ConfigService,
    private readonly tokensService: TokensService,
  ) {
    this.logger = new Logger(BlockchainService.name);
    this.providers = new Map<SupportedPRC, ethers.JsonRpcProvider>();

    Object.values(SupportedPRC).forEach((chain) => {
      const rpcUrl = this.configService.get<string>(`rpc.${chain}`);
      if (rpcUrl) {
        this.providers.set(chain, new ethers.JsonRpcProvider(rpcUrl));
      }
    });
  }

  async onModuleInit() {
    for (const [chain, provider] of this.providers.entries()) {
      try {
        await provider.getBlockNumber();
        this.logger.log(`Connected to ${chain} RPC successfully.`);
      } catch (error) {
        this.logger.error(
          `Failed to connect to ${chain} RPC:`,
          error instanceof Error ? error.stack : String(error),
        );
      }
    }
    // await this.updateDecimalsBatch([
    //   SupportedPRC.ETH,
    //   SupportedPRC.BNB,
    //   SupportedPRC.BASE,
    // ]);
    // const result = await this.getBalanceBatch(
    //   '0x055A3B37957bfbD3345bED9968e7E8Dd56d67066',
    //   [SupportedPRC.BNB],
    // );
    // console.log('Balance batch result:', result);
  }

  getProvider(chain: SupportedPRC): ethers.JsonRpcProvider {
    const provider = this.providers.get(chain);
    if (!provider) {
      throw new Error(`Provider for chain ${chain} not configured`);
    }
    return provider;
  }

  async updateDecimals(chains: SupportedPRC[]) {
    for (const chain of chains) {
      const tokenContracts = await this.tokensService.findTokenContractByChain(
        MappingSupportedRPCToCoingeckoChain[chain],
      );
      for (const tokenContract of tokenContracts) {
        if (tokenContract.decimals === undefined) {
          try {
            const provider = this.getProvider(chain);
            const erc20Interface = new ethers.Interface([
              'function decimals() external view returns (uint8)',
            ]);
            const contract = new ethers.Contract(
              tokenContract.contractAddress,
              erc20Interface,
              provider,
            );
            const decimals = (await contract.decimals()) as number;
            tokenContract.decimals = decimals;
            await tokenContract.save();
            this.logger.log(
              `Updated decimals for ${tokenContract.contractAddress} on ${chain}: ${decimals}`,
            );
          } catch (error) {
            this.logger.error(
              `Failed to fetch decimals for ${tokenContract.contractAddress} on ${chain}:`,
              error instanceof Error ? error.stack : String(error),
            );
          }
        }
      }
    }
  }

  async updateDecimalsBatch(chains: SupportedPRC[]) {
    const BATCH_SIZE = 100;

    for (const chain of chains) {
      try {
        const provider = this.getProvider(chain);
        const tokenContracts =
          await this.tokensService.findTokenContractByChain(
            MappingSupportedRPCToCoingeckoChain[chain],
          );

        // Filter tokens that need decimal update
        // Exclude native token placeholder and tokens that already have decimals
        const tokensToUpdate = tokenContracts.filter(
          (t) =>
            t.decimals === undefined &&
            t.contractAddress.toLowerCase() !==
              '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',
        );

        if (tokensToUpdate.length === 0) {
          this.logger.log(`No tokens requiring decimal update on ${chain}`);
          continue;
        }

        this.logger.log(
          `Updating decimals for ${tokensToUpdate.length} tokens on ${chain} using batch call...`,
        );

        const multicallContract = new ethers.Contract(
          this.MULTICALL_ADDRESS,
          [
            'function aggregate3(tuple(address target, bool allowFailure, bytes callData)[] calls) payable returns (tuple(bool success, bytes returnData)[] returnData)',
          ],
          provider,
        );

        const erc20Interface = new ethers.Interface([
          'function decimals() external view returns (uint8)',
        ]);

        // Process in batches to respect RPC limits
        for (let i = 0; i < tokensToUpdate.length; i += BATCH_SIZE) {
          const batch = tokensToUpdate.slice(i, i + BATCH_SIZE);

          const calls = batch.map((token) => ({
            target: token.contractAddress,
            allowFailure: true,
            callData: erc20Interface.encodeFunctionData('decimals', []),
          }));

          try {
            // Perform static call to get results without transaction
            const results = (await multicallContract.aggregate3.staticCall(
              calls,
            )) as MulticallResult[];

            const savePromises: Promise<any>[] = [];

            results.forEach((result, index) => {
              if (result.success) {
                try {
                  const [decimals] = erc20Interface.decodeFunctionResult(
                    'decimals',
                    result.returnData,
                  );
                  const token = batch[index];
                  token.decimals = Number(decimals);
                  savePromises.push(token.save());
                } catch (e) {
                  void e;
                  this.logger.warn(
                    `Failed to decode decimals for ${batch[index].contractAddress} on ${chain}`,
                  );
                }
              }
            });

            await Promise.all(savePromises);
            this.logger.log(
              `Updated batch of ${savePromises.length} tokens on ${chain}`,
            );
          } catch (error) {
            this.logger.error(
              `Failed to execute decimal batch on ${chain}:`,
              error instanceof Error ? error.stack : String(error),
            );
          }
        }
      } catch (error) {
        this.logger.error(
          `Failed to process chain ${chain}:`,
          error instanceof Error ? error.stack : String(error),
        );
      }
    }
  }

  async getNativeBalance(chain: SupportedPRC, address: string) {
    const provider = this.getProvider(chain);
    const balance = await provider.getBalance(address);
    return {
      contractAddress: '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',
      balance: ethers.formatEther(balance),
      rawBalance: normalizeTo18Decimals('0x' + balance.toString(16), 18),
      decimals: 18,
      network: MappingSupportedRPCToCoingeckoChain[chain],
    };
  }

  async getBalanceBatch(walletAddress: string, chains: SupportedPRC[]) {
    const BATCH_SIZE = 30;
    const multicallAbi = [
      'function aggregate3(tuple(address target, bool allowFailure, bytes callData)[] calls) payable returns (tuple(bool success, bytes returnData)[] returnData)',
    ];
    const erc20Interface = new ethers.Interface([
      'function balanceOf(address account) external view returns (uint256)',
    ]);

    const allBalances: Array<{
      contractAddress: string;
      balance: string;
      rawBalance: string;
      decimals: number;
      network: string;
    }> = [];

    try {
      for (const chain of chains) {
        const provider = this.getProvider(chain);
        const multicallContract = new ethers.Contract(
          this.MULTICALL_ADDRESS,
          multicallAbi,
          provider,
        );
        const tokenAddresses =
          await this.tokensService.findTokenContractByChain(
            MappingSupportedRPCToCoingeckoChain[chain],
          );

        this.logger.log(
          `Fetching balances for ${tokenAddresses.length} tokens on ${chain}...`,
        );

        const tokenBalances: Array<{
          contractAddress: string;
          balance: string;
          rawBalance: string;
          decimals: number;
          network: string;
        }> = [];

        const nativeBalance = await this.getNativeBalance(chain, walletAddress);
        if (BigInt(nativeBalance.rawBalance) > 0n) {
          tokenBalances.push(nativeBalance);
        }

        // Prepare all batches first
        const batches: (typeof tokenAddresses)[] = [];
        for (let i = 0; i < tokenAddresses.length; i += BATCH_SIZE) {
          batches.push(tokenAddresses.slice(i, i + BATCH_SIZE));
        }

        // Process batches in parallel groups to avoid overwhelming RPC
        const CONCURRENT_BATCHES = 3; // Process 3 batches at a time
        for (let i = 0; i < batches.length; i += CONCURRENT_BATCHES) {
          const batchGroup = batches.slice(i, i + CONCURRENT_BATCHES);

          const batchPromises = batchGroup.map((batch) => {
            const calls = batch.map((tokenAddr) => ({
              target: tokenAddr.contractAddress,
              allowFailure: true,
              callData: erc20Interface.encodeFunctionData('balanceOf', [
                walletAddress,
              ]),
            }));

            return multicallContract.aggregate3
              .staticCall(calls)
              .then((results: MulticallResult[]) => {
                const batchBalances: typeof tokenBalances = [];
                results.forEach((result, index) => {
                  if (result.success) {
                    const token = batch[index];

                    // Skip if decimals not available
                    if (token.decimals === undefined) {
                      return;
                    }

                    const rawBalance = erc20Interface.decodeFunctionResult(
                      'balanceOf',
                      result.returnData,
                    )[0] as bigint;

                    if (rawBalance > 0n) {
                      const formattedBalance = ethers.formatUnits(
                        rawBalance,
                        token.decimals,
                      );
                      // Convert BigInt to hex string with '0x' prefix
                      const rawBalanceHex = '0x' + rawBalance.toString(16);
                      batchBalances.push({
                        contractAddress: token.contractAddress,
                        balance: formattedBalance,
                        rawBalance: normalizeTo18Decimals(
                          rawBalanceHex,
                          token.decimals,
                        ),
                        decimals: 18,
                        network: MappingSupportedRPCToCoingeckoChain[chain],
                      });
                    }
                  }
                });
                return batchBalances;
              })
              .catch((error) => {
                this.logger.error(
                  `Failed to execute balance batch on ${chain}:`,
                  error instanceof Error
                    ? error.stack?.slice(0, 100) +
                        '...' +
                        error.stack?.slice(-100)
                    : String(error).slice(0, 100),
                );
                return [];
              });
          });

          // Wait for current group to complete before starting next group
          const groupResults = await Promise.all(batchPromises);
          groupResults.forEach((batchBalances) => {
            tokenBalances.push(...batchBalances);
          });
        }

        // Add chain balances to overall result
        allBalances.push(...tokenBalances);

        // Log summary only
        this.logger.log(
          `Found ${tokenBalances.length} tokens with non-zero balance on ${chain}`,
        );
      }

      return allBalances;
    } catch (err) {
      this.logger.error(
        'Multicall failed:',
        err instanceof Error ? err.stack : String(err),
      );
      throw err;
    }
  }

  async getBalance(chain: SupportedPRC, address: string): Promise<string> {
    const provider = this.getProvider(chain);
    const balance = await provider.getBalance(address);
    return ethers.formatEther(balance);
  }
}
