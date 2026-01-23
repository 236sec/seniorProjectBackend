import { registerAs } from '@nestjs/config';

export default registerAs('rpc', () => {
  const infuraKey = process.env.INFURA_API_KEY;

  // Helper to build URL or return undefined
  const getInfuraUrl = (network: string) =>
    infuraKey ? `https://${network}.infura.io/v3/${infuraKey}` : undefined;
  return {
    eth: process.env.RPC_ETH || getInfuraUrl('mainnet'),
    bnb: process.env.RPC_BNB || getInfuraUrl('bsc-mainnet'),
    base: process.env.RPC_BASE || getInfuraUrl('base-mainnet'),
  };
});
