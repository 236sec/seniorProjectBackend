## Create Transaction Batch

### Endpoint

`POST /transactions/batch`

### Description

Creates multiple transaction records in a single request. This endpoint is optimized for bulk operations and currently **only supports `SYNCED` transactions** (automatically detected from blockchain). It performs the same validations and balance updates as the single creation endpoint but for multiple items.

### Request Body

The request body should be a JSON object with the following fields:

| Field      | Type     | Required | Description                                        |
| ---------- | -------- | -------- | -------------------------------------------------- |
| `walletId` | ObjectId | Yes      | The ID of the wallet these transactions belong to. |
| `items`    | Array    | Yes      | An array of transaction objects (see below).       |

#### Transaction Object (Item)

| Field                | Type     | Required | Description                                                               |
| -------------------- | -------- | -------- | ------------------------------------------------------------------------- |
| `type`               | Enum     | Yes      | The type of transaction. **Must be `SYNCED`**.                            |
| `blockchainWalletId` | ObjectId | Yes      | The ID of the blockchain wallet. Must belong to the specified `walletId`. |
| `tokenContractId`    | ObjectId | Yes      | The ID of the token contract involved in the transaction.                 |
| `event_type`         | Enum     | Optional | The type of event. Values: `SWAP`, `DEPOSIT`, `WITHDRAWAL`.               |
| `quantity`           | String   | Optional | The amount of tokens involved (must be a hex string, e.g., "0x1a").       |
| `from`               | String   | Optional | The sender address.                                                       |
| `to`                 | String   | Optional | The recipient address.                                                    |
| `price_usd`          | Number   | Optional | The price of the token in USD at the time of the transaction.             |
| `cashflow_usd`       | Number   | Optional | The total value of the transaction in USD.                                |
| `timestamp`          | Date     | Yes      | The date and time of the transaction (ISO 8601 format).                   |

### Behavior

- **Validation**:
  - Checks if the `walletId` exists.
  - Iterates through each item in the `items` array.
  - **Enforces `type` to be `SYNCED`**. If any item is not `SYNCED`, the request fails.
  - Verifies that the `blockchainWalletId` is associated with the `walletId`.
  - Verifies that the `tokenContractId` exists.
- **Balance Updates**:
  - Updates the balance in the specified `blockchainWallet` using `tokenContractId` for `DEPOSIT` and `WITHDRAWAL` events.
  - Throws an error if `WITHDRAWAL` amount exceeds the current balance or if the token is not found in the wallet.
- **Atomicity**: The operation processes items sequentially. If an error occurs during processing an item (e.g., validation failure), the process stops and throws an error. Partial success is not supported (standard REST behavior, though database transactions are not explicitly mentioned in the service logic provided).

### Example Request

```json
{
  "walletId": "60d5ecb8b487343568912345",
  "items": [
    {
      "type": "SYNCED",
      "blockchainWalletId": "60d5ecb8b4873435689abcde",
      "tokenContractId": "60d5ecb8b4873435689fghij",
      "event_type": "DEPOSIT",
      "quantity": "0xde0b6b3a7640000",
      "timestamp": "2023-10-27T10:00:00.000Z"
    },
    {
      "type": "SYNCED",
      "blockchainWalletId": "60d5ecb8b4873435689abcde",
      "tokenContractId": "60d5ecb8b4873435689klmno",
      "event_type": "WITHDRAWAL",
      "quantity": "0x16345785d8a0000",
      "timestamp": "2023-10-27T11:00:00.000Z"
    }
  ]
}
```

### Response

Returns an array of the created transaction objects.

```json
[
  {
    "_id": "60d5ecb8b4873435689zzzzz",
    "walletId": "60d5ecb8b487343568912345",
    "type": "SYNCED",
    "event_type": "DEPOSIT",
    "quantity": "0xde0b6b3a7640000",
    "timestamp": "2023-10-27T10:00:00.000Z",
    ...
  },
  {
    "_id": "60d5ecb8b4873435689yyyyy",
    "walletId": "60d5ecb8b487343568912345",
    "type": "SYNCED",
    "event_type": "WITHDRAWAL",
    "quantity": "0x16345785d8a0000",
    "timestamp": "2023-10-27T11:00:00.000Z",
    ...
  }
]
```
