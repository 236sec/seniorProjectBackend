## Create Transaction

### Endpoint

`POST /transactions`

### Description

Creates a new transaction record. This endpoint handles both `SYNCED` (automatically detected from blockchain) and `MANUAL` (user-entered) transactions. Creating a transaction also updates the corresponding token balances in the wallet (either in `blockchainWalletId` for synced transactions or `manualTokens` for manual transactions).

### Request Body

The request body should be a JSON object with the following fields:

| Field                | Type     | Required | Description                                                                                                |
| -------------------- | -------- | -------- | ---------------------------------------------------------------------------------------------------------- |
| `walletId`           | ObjectId | Yes      | The ID of the wallet this transaction belongs to.                                                          |
| `type`               | Enum     | Yes      | The type of transaction. Values: `MANUAL`, `SYNCED`.                                                       |
| `blockchainWalletId` | ObjectId | Optional | The ID of the blockchain wallet (required if `type` is `SYNCED`). Must belong to the specified `walletId`. |
| `tokenContractId`    | ObjectId | Optional | The ID of the token contract involved in the transaction.                                                  |
| `event_type`         | Enum     | Optional | The type of event. Values: `SWAP`, `DEPOSIT`, `WITHDRAWAL`.                                                |
| `quantity`           | String   | Optional | The amount of tokens involved (in raw hex or string format).                                               |
| `from`               | String   | Optional | The sender address.                                                                                        |
| `to`                 | String   | Optional | The recipient address.                                                                                     |
| `price_usd`          | Number   | Optional | The price of the token in USD at the time of the transaction.                                              |
| `cashflow_usd`       | Number   | Optional | The total value of the transaction in USD.                                                                 |

### Behavior

- **Validation**: Checks if the `walletId` and `tokenContractId` exist.
- **Synced Transactions**:
  - Requires `blockchainWalletId`.
  - Verifies that the `blockchainWalletId` is associated with the `walletId`.
  - Updates the balance in the specified `blockchainWallet`.
- **Manual Transactions**:
  - Updates the balance in the `manualTokens` array of the `wallet`.

### Example Request (Manual Deposit)

```json
{
  "walletId": "60d5ecb8b487343568912345",
  "type": "MANUAL",
  "event_type": "DEPOSIT",
  "tokenContractId": "60d5ecb8b4873435689fghij",
  "quantity": "0xde0b6b3a7640000", // 1 ETH in wei (hex)
  "price_usd": 3000,
  "cashflow_usd": 3000
}
```

### Example Request (Synced Withdrawal)

```json
{
  "walletId": "60d5ecb8b487343568912345",
  "blockchainWalletId": "60d5ecb8b4873435689abcde",
  "type": "SYNCED",
  "event_type": "WITHDRAWAL",
  "tokenContractId": "60d5ecb8b4873435689fghij",
  "quantity": "0xde0b6b3a7640000",
  "from": "0x123...",
  "to": "0x456..."
}
```

### Response

Returns the created transaction object.

```json
{
  "_id": "60d5ecb8b4873435689zzzzz",
  "walletId": "60d5ecb8b487343568912345",
  "type": "MANUAL",
  "event_type": "DEPOSIT",
  "quantity": "0xde0b6b3a7640000",
  "createdAt": "2023-10-27T10:00:00.000Z",
  "updatedAt": "2023-10-27T10:00:00.000Z"
}
```
