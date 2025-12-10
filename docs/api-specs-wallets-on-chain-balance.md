# Wallet On-Chain Balance API

## Endpoint

`GET /wallets/on-chain/balance`

## Description

Retrieves on-chain token balances for a specific wallet address on one or more blockchain networks. This endpoint fetches ERC-20 token balances using Alchemy's Portfolio API and enriches the data with metadata from the internal token database. Supports querying multiple chains simultaneously.

## Query Parameters

| Parameter | Type   | Required | Description                                                                                                               |
| --------- | ------ | -------- | ------------------------------------------------------------------------------------------------------------------------- |
| `address` | string | Yes      | Wallet address to query (Ethereum-compatible address format: 0x...)                                                       |
| `chain`   | string | Yes      | Blockchain network identifier(s) - comma-separated for multiple chains (e.g., "eth-sepolia" or "eth-sepolia,opt-mainnet") |

## Supported Chains

The following blockchain networks are supported:

### Ethereum Networks

- `eth-mainnet` - Ethereum Mainnet
- `eth-sepolia` - Ethereum Sepolia Testnet
- `eth-holesky` - Ethereum Holesky Testnet

### Polygon Networks

- `polygon-mainnet` - Polygon Mainnet
- `polygon-amoy` - Polygon Amoy Testnet

### Arbitrum Networks

- `arb-mainnet` - Arbitrum One Mainnet
- `arb-sepolia` - Arbitrum Sepolia Testnet

### Optimism Networks

- `opt-mainnet` - Optimism Mainnet
- `opt-sepolia` - Optimism Sepolia Testnet

### Base Networks

- `base-mainnet` - Base Mainnet
- `base-sepolia` - Base Sepolia Testnet

### Avalanche Networks

- `avax-mainnet` - Avalanche C-Chain Mainnet
- `avax-fuji` - Avalanche Fuji Testnet

### Other Networks

- `blast-mainnet` - Blast Mainnet
- `zksync-mainnet` - zkSync Era Mainnet

## Response Format

```json
{
  "address": "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb",
  "chain": ["eth-sepolia", "opt-mainnet"],
  "nativeBalances": [
    {
      "network": "eth-sepolia",
      "balance": "0.055778460292928789"
    },
    {
      "network": "opt-mainnet",
      "balance": "0.002717608986384289"
    }
  ],
  "balances": [
    {
      "contractAddress": "0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984",
      "balance": "1234.56789",
      "balanceFormatted": "1234.56789",
      "symbol": "UNI",
      "name": "Uniswap",
      "logo": "https://...",
      "decimals": 18,
      "network": "eth-sepolia",
      "token": {
        "id": "uniswap",
        "symbol": "UNI",
        "name": "Uniswap",
        "image": "https://..."
      }
    }
  ],
  "totalTokens": 1,
  "tokensWithMetadata": 1
}
```

## Response Fields

| Field                | Type     | Description                                                  |
| -------------------- | -------- | ------------------------------------------------------------ |
| `address`            | string   | The wallet address that was queried                          |
| `chain`              | string[] | Array of blockchain networks that were queried               |
| `nativeBalances`     | array    | Array of native token balances (ETH, MATIC, etc.) by network |
| `balances`           | array    | Array of ERC-20 token balance objects                        |
| `totalTokens`        | number   | Total number of ERC-20 tokens with non-zero balances         |
| `tokensWithMetadata` | number   | Number of tokens that have metadata in the internal database |

### Native Balance Object Fields

| Field     | Type   | Description                                      |
| --------- | ------ | ------------------------------------------------ |
| `network` | string | Network identifier where the native token exists |
| `balance` | string | Human-readable formatted native token balance    |

### ERC-20 Token Balance Object Fields

| Field              | Type         | Description                                                     |
| ------------------ | ------------ | --------------------------------------------------------------- |
| `contractAddress`  | string       | Token's smart contract address                                  |
| `balance`          | string       | Human-readable formatted balance (e.g., "1234.56789")           |
| `balanceFormatted` | string       | Same as balance (formatted with decimals applied)               |
| `symbol`           | string       | Token symbol (e.g., "UNI", "USDC")                              |
| `name`             | string       | Token full name (e.g., "Uniswap", "USD Coin")                   |
| `logo`             | string\|null | URL to token logo image                                         |
| `decimals`         | number\|null | Number of decimal places for the token                          |
| `network`          | string       | Network identifier where the token exists                       |
| `token`            | object\|null | Additional token metadata from internal database (if available) |

### Token Metadata Object (when available)

| Field    | Type   | Description                              |
| -------- | ------ | ---------------------------------------- |
| `id`     | string | Internal token identifier (CoinGecko ID) |
| `symbol` | string | Token symbol from database               |
| `name`   | string | Token name from database                 |
| `image`  | string | Token image URL from database            |

## Example Requests

### Get Ethereum Sepolia balances

```bash
GET /wallets/on-chain/balance?address=0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb&chain=eth-sepolia
```

### Get Optimism Mainnet balances

```bash
GET /wallets/on-chain/balance?address=0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb&chain=opt-mainnet
```

### Get balances across multiple chains

```bash
GET /wallets/on-chain/balance?address=0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb&chain=eth-sepolia,opt-mainnet,polygon-mainnet
```

### Get Polygon Mainnet balances

```bash
GET /wallets/on-chain/balance?address=0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb&chain=polygon-mainnet
```

## Features

1. **Zero-balance filtering**: Only returns tokens with non-zero balances
2. **Formatted balances**: Balances are automatically formatted using token decimals (e.g., raw value `1234567890000000000` with 18 decimals becomes `1.23456789`)
3. **Metadata enrichment**: Attempts to enrich token data with metadata from internal database
4. **Multi-chain support**: Works across 13+ different blockchain networks
5. **Native & ERC-20 tokens**: Returns both native tokens (ETH, MATIC, etc.) and ERC-20 tokens

## Implementation Details

- Uses Alchemy's Portfolio API for fetching token balances
- Automatically filters out zero-balance tokens (handles both `"0"` and `"0x000..."` formats)
- Converts raw token balances using proper decimal places
- Enriches data with CoinGecko token metadata when available
- Returns formatted human-readable balances

## Error Handling

The endpoint will return errors in the following cases:

- Invalid or missing `address` parameter
- Invalid or unsupported `chain` parameter
- Alchemy API errors (rate limits, network issues)
- Database connection errors

## Rate Limits

This endpoint is subject to:

- Alchemy API rate limits (varies by plan)
- Internal database query limits

## Use Cases

1. **Portfolio tracking**: Display user's token holdings across different chains
2. **Wallet analytics**: Analyze token distribution and diversity
3. **Balance monitoring**: Track real-time token balances
4. **Multi-chain aggregation**: Combine balances from multiple networks
5. **Token discovery**: Find all tokens held by an address
