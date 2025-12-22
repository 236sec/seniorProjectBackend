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

Returns a JSON object representing the wallet with the following populated fields:

- `blockchainWalletId`: Array of associated blockchain wallets.
  - `tokens`: Array of token balances within the blockchain wallet.
    - `tokenContractId`: The token contract details.
      - `tokenId`: The full token details (symbol, name, image, etc.).
- `manualTokens`: Array of manually added token balances.
  - `tokenContractId`: The token contract details.
    - `tokenId`: The full token details.

### Example Response

```json
{
  "_id": "692fdc6ec0560f978714bd02",
  "userId": "69270c413879682de513e6a8",
  "name": "My Main Portfolio",
  "description": "Primary crypto portfolio with DeFi and trading addresses",
  "createdAt": "2025-12-03T06:45:02.165Z",
  "updatedAt": "2025-12-22T05:05:59.360Z",
  "__v": 1,
  "blockchainWalletId": [
    {
      "_id": "693fbc361dc3e77088703e0b",
      "address": "0x12A1423B97E2cB34186B751cA543E79dCfd3374A",
      "chains": ["optimistic-ethereum"],
      "tokens": [
        {
          "tokenContractId": {
            "_id": "693f9673cd011622ce9b97a9",
            "tokenId": {
              "_id": "69354fab9ad82c7d4c50f628",
              "id": "weth",
              "__v": 0,
              "createdAt": "2025-12-07T09:58:02.519Z",
              "name": "WETH",
              "symbol": "weth",
              "updatedAt": "2025-12-15T05:02:49.939Z",
              "image": {
                "thumb": "https://coin-images.coingecko.com/coins/images/2518/large/weth.png?1696503332",
                "small": "https://coin-images.coingecko.com/coins/images/2518/large/weth.png?1696503332",
                "large": "https://coin-images.coingecko.com/coins/images/2518/large/weth.png?1696503332",
                "_id": "693f9679cd011622ce9b98a2"
              }
            },
            "coinGeckoId": "weth",
            "chainId": "zircuit",
            "contractAddress": "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee",
            "symbol": "weth",
            "name": "WETH",
            "createdAt": "2025-12-15T05:02:43.934Z",
            "updatedAt": "2025-12-15T05:02:43.934Z",
            "__v": 0
          },
          "balance": "0x000000000000000000000000000000000000000000000000018c546d9fc1aa2a"
        }
      ],
      "createdAt": "2025-12-15T07:43:50.420Z",
      "updatedAt": "2025-12-22T05:16:18.185Z",
      "__v": 6
    }
  ],
  "manualTokens": [
    {
      "tokenContractId": {
        "_id": "693f9673cd011622ce9b97a9",
        "tokenId": {
          "_id": "69354fab9ad82c7d4c50f628",
          "id": "weth",
          "__v": 0,
          "createdAt": "2025-12-07T09:58:02.519Z",
          "name": "WETH",
          "symbol": "weth",
          "updatedAt": "2025-12-15T05:02:49.939Z",
          "image": {
            "thumb": "https://coin-images.coingecko.com/coins/images/2518/large/weth.png?1696503332",
            "small": "https://coin-images.coingecko.com/coins/images/2518/large/weth.png?1696503332",
            "large": "https://coin-images.coingecko.com/coins/images/2518/large/weth.png?1696503332",
            "_id": "693f9679cd011622ce9b98a2"
          }
        },
        "coinGeckoId": "weth",
        "chainId": "zircuit",
        "contractAddress": "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee",
        "symbol": "weth",
        "name": "WETH",
        "createdAt": "2025-12-15T05:02:43.934Z",
        "updatedAt": "2025-12-15T05:02:43.934Z",
        "__v": 0
      },
      "balance": "0x000000000000000000000000000000000000000000000000018c546d9fc1aa2a"
    }
  ]
}
```
