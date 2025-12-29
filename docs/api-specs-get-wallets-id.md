# Wallet API Specs

## Get Wallet by ID

### Endpoint

`GET /wallets/:id`

### Description

Retrieves detailed information about a specific wallet, including its associated blockchain wallets and token balances. The response includes fully populated nested objects for blockchain wallets, token contracts, and token details.

### Path Parameters

| Parameter | Type     | Required | Description                                      |
| --------- | -------- | -------- | ------------------------------------------------ |
| `id`      | ObjectId | Yes      | The unique identifier of the wallet to retrieve. |

### Response

Returns a JSON object with two top-level properties:

- `wallet`: The wallet object containing:
  - `blockchainWalletId`: Array of associated blockchain wallets with address, chains, and tokens arrays
  - `manualTokens`: Array of manually added token balances
    - `tokenId`: String reference to the token ID (not populated)
    - `balance`: Hex string representing the token balance
  - `portfolioPerformance`: Array of performance metrics for each token
    - `tokenId`: String reference to the token ID
    - `totalInvestedAmount`: Total amount invested in USD
    - `totalBalance`: Hex string representing the total balance
    - `totalCashflowUsd`: Total cashflow in USD
- `tokens`: Object mapping token IDs to their full details (id, name, symbol, image)

### Example Response

```json
{
  "wallet": {
    "_id": "694cea2b62472cb319056372",
    "userId": "69270c413879682de513e6a8",
    "name": "My Main Portfolio 1",
    "description": "Primary crypto portfolio with DeFi and trading addresses",
    "blockchainWalletId": [
      {
        "_id": "694cea3862472cb319056377",
        "address": "0x4508e47900a14e66d190ea4c2b3a8c8054710a63",
        "chains": ["ethereum", "eth-sepolia"],
        "tokens": [],
        "createdAt": "2025-12-25T07:39:36.550Z",
        "updatedAt": "2025-12-25T07:39:36.550Z"
      }
    ],
    "manualTokens": [
      {
        "tokenId": "69354fab9ad82c7d4c50b02c",
        "balance": "0x55de6a779bbac0000"
      },
      {
        "tokenId": "69354fab9ad82c7d4c50c750",
        "balance": "0x318a8db3f835454"
      }
    ],
    "portfolioPerformance": [
      {
        "tokenId": "69354fab9ad82c7d4c50b02c",
        "totalInvestedAmount": 5508,
        "totalBalance": "0x55de6a779bbac0000",
        "totalCashflowUsd": 5673
      },
      {
        "tokenId": "69354fab9ad82c7d4c50c750",
        "totalInvestedAmount": 8000,
        "totalBalance": "0x318a8db3f835454",
        "totalCashflowUsd": 8000
      }
    ],
    "createdAt": "2025-12-25T07:39:23.787Z",
    "updatedAt": "2025-12-29T09:43:49.466Z",
    "__v": 7
  },
  "tokens": {
    "69354fab9ad82c7d4c50b02c": {
      "_id": "69354fab9ad82c7d4c50b02c",
      "id": "01111010011110000110001001110100-token",
      "name": "01111010011110000110001001110100",
      "symbol": "01111010011110000110001001110100",
      "image": {
        "thumb": "https://coin-images.coingecko.com/coins/images/68126/thumb/QsRnEyrQ_400x400.jpg?1760513386",
        "small": "https://coin-images.coingecko.com/coins/images/68126/small/QsRnEyrQ_400x400.jpg?1760513386",
        "large": "https://coin-images.coingecko.com/coins/images/68126/large/QsRnEyrQ_400x400.jpg?1760513386",
        "_id": "69392a2e1dabd665ae5ec884"
      }
    },
    "69354fab9ad82c7d4c50c750": {
      "_id": "69354fab9ad82c7d4c50c750",
      "id": "ethereum",
      "name": "Ethereum",
      "symbol": "eth",
      "image": {
        "thumb": "https://coin-images.coingecko.com/coins/images/279/large/ethereum.png?1696501628",
        "small": "https://coin-images.coingecko.com/coins/images/279/large/ethereum.png?1696501628",
        "large": "https://coin-images.coingecko.com/coins/images/279/large/ethereum.png?1696501628",
        "_id": "693f9679cd011622ce9b988d"
      }
    }
  }
}
```
