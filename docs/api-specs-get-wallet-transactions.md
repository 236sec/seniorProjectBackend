# Wallet Transactions API Specification

## Endpoint: Get Wallet Transactions with Pagination

### HTTP Method & URL

```
GET /wallets/transactions/:walletId
```

### Description

Retrieves a paginated list of transactions for a specific wallet. Supports offset-based pagination and returns transactions sorted by timestamp in descending order (newest first).

---

## Request Parameters

### Path Parameters

| Parameter  | Type     | Required | Description                    |
| ---------- | -------- | -------- | ------------------------------ |
| `walletId` | ObjectId | Yes      | MongoDB ObjectId of the wallet |

### Query Parameters

| Parameter | Type    | Required | Default | Description                                   |
| --------- | ------- | -------- | ------- | --------------------------------------------- |
| `limit`   | integer | No       | 10      | Number of transactions per page (must be > 0) |
| `offset`  | integer | No       | 0       | Number of transactions to skip (must be ≥ 0)  |

### Query Parameter Validation

- `walletId`: Must be a valid MongoDB ObjectId (24 hex characters)
- `limit`: Must be a positive integer greater than 0
- `offset`: Must be a non-negative integer (0 or greater)

---

## Response Format

### Success Response (200 OK)

```json
{
  "data": [
    {
      "_id": "string",
      "walletId": "string",
      "tokenId": {
        "_id": "string",
        "id": "string",
        "symbol": "string",
        "name": "string",
        "image": {
          "thumb": "string",
          "small": "string",
          "large": "string"
        }
      },
      "tokenContractId": "string",
      "blockchainWalletId": "string",
      "type": "string",
      "event_type": "string",
      "quantity": "string",
      "timestamp": "string",
      "txHash": "string",
      "note": "string"
    }
  ],
  "pagination": {
    "page": "number",
    "limit": "number",
    "offset": "number",
    "total": "number",
    "totalPages": "number",
    "hasNextPage": "boolean",
    "hasPrevPage": "boolean"
  }
}
```

### Response Fields

#### Data Object (Array of Transactions)

| Field                | Type   | Description                                           |
| -------------------- | ------ | ----------------------------------------------------- |
| `_id`                | string | MongoDB document ID                                   |
| `walletId`           | string | ID of the wallet this transaction belongs to          |
| `tokenId`            | object | Populated token object (for MANUAL transactions)      |
| `tokenContractId`    | string | ID of the token contract (for SYNCED transactions)    |
| `blockchainWalletId` | string | ID of the blockchain wallet (for SYNCED transactions) |
| `type`               | string | Transaction type: "SYNCED" or "MANUAL"                |
| `event_type`         | string | Event type: "DEPOSIT" or "WITHDRAWAL"                 |
| `quantity`           | string | Transaction amount (hex string format)                |
| `timestamp`          | string | ISO 8601 timestamp of the transaction                 |
| `txHash`             | string | Blockchain transaction hash (optional)                |
| `note`               | string | User-provided note (optional)                         |

#### Token Object (Populated)

| Field         | Type   | Description                        |
| ------------- | ------ | ---------------------------------- |
| `_id`         | string | MongoDB document ID                |
| `id`          | string | Token identifier (e.g., "bitcoin") |
| `symbol`      | string | Token symbol (e.g., "btc")         |
| `name`        | string | Full token name (e.g., "Bitcoin")  |
| `image`       | object | Token image URLs (optional)        |
| `image.thumb` | string | Thumbnail image URL                |
| `image.small` | string | Small image URL                    |
| `image.large` | string | Large image URL                    |

#### Pagination Object

| Field         | Type    | Description                                        |
| ------------- | ------- | -------------------------------------------------- |
| `page`        | number  | Current page number (calculated from offset)       |
| `limit`       | number  | Number of items per page                           |
| `offset`      | number  | Number of items skipped                            |
| `total`       | number  | Total number of transactions for this wallet       |
| `totalPages`  | number  | Total number of pages available                    |
| `hasNextPage` | boolean | True if there are more pages after the current one |
| `hasPrevPage` | boolean | True if there are pages before the current one     |

---

## Example Requests

### Example 1: Basic Request (Default Pagination)

```bash
GET /wallets/transactions/674a1b2c3d4e5f6g7h8i9j0k
```

**Response:**

```json
{
  "data": [
    {
      "_id": "674a2c3d4e5f6g7h8i9j0k1l",
      "walletId": "674a1b2c3d4e5f6g7h8i9j0k",
      "tokenId": {
        "_id": "674a3d4e5f6g7h8i9j0k1l2m",
        "id": "bitcoin",
        "symbol": "btc",
        "name": "Bitcoin",
        "image": {
          "thumb": "https://assets.coingecko.com/coins/images/1/thumb/bitcoin.png",
          "small": "https://assets.coingecko.com/coins/images/1/small/bitcoin.png",
          "large": "https://assets.coingecko.com/coins/images/1/large/bitcoin.png"
        }
      },
      "type": "MANUAL",
      "event_type": "DEPOSIT",
      "quantity": "0x8ac7230489e80000",
      "timestamp": "2025-12-28T10:30:00.000Z",
      "note": "Initial deposit"
    },
    {
      "_id": "674a2c3d4e5f6g7h8i9j0k2n",
      "walletId": "674a1b2c3d4e5f6g7h8i9j0k",
      "tokenContractId": "674a4e5f6g7h8i9j0k1l2m3n",
      "blockchainWalletId": "674a5f6g7h8i9j0k1l2m3n4o",
      "type": "SYNCED",
      "event_type": "WITHDRAWAL",
      "quantity": "0x2386f26fc10000",
      "timestamp": "2025-12-27T15:45:00.000Z",
      "txHash": "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 10,
    "offset": 0,
    "total": 2,
    "totalPages": 1,
    "hasNextPage": false,
    "hasPrevPage": false
  }
}
```

### Example 2: Custom Pagination with Limit

```bash
GET /wallets/transactions/674a1b2c3d4e5f6g7h8i9j0k?limit=5&offset=0
```

**Response:**

```json
{
  "data": [
    {
      "_id": "674a2c3d4e5f6g7h8i9j0k1l",
      "walletId": "674a1b2c3d4e5f6g7h8i9j0k",
      "tokenId": {
        "_id": "674a3d4e5f6g7h8i9j0k1l2m",
        "id": "ethereum",
        "symbol": "eth",
        "name": "Ethereum"
      },
      "type": "MANUAL",
      "event_type": "DEPOSIT",
      "quantity": "0x1bc16d674ec80000",
      "timestamp": "2025-12-28T12:00:00.000Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 5,
    "offset": 0,
    "total": 25,
    "totalPages": 5,
    "hasNextPage": true,
    "hasPrevPage": false
  }
}
```

### Example 3: Pagination with Offset

```bash
GET /wallets/transactions/674a1b2c3d4e5f6g7h8i9j0k?limit=10&offset=10
```

**Response:**

```json
{
  "data": [
    {
      "_id": "674a2c3d4e5f6g7h8i9j0k3p",
      "walletId": "674a1b2c3d4e5f6g7h8i9j0k",
      "tokenId": {
        "_id": "674a3d4e5f6g7h8i9j0k1l2m",
        "id": "cardano",
        "symbol": "ada",
        "name": "Cardano"
      },
      "type": "MANUAL",
      "event_type": "WITHDRAWAL",
      "quantity": "0xde0b6b3a7640000",
      "timestamp": "2025-12-26T09:15:00.000Z",
      "note": "Sent to exchange"
    }
  ],
  "pagination": {
    "page": 2,
    "limit": 10,
    "offset": 10,
    "total": 35,
    "totalPages": 4,
    "hasNextPage": true,
    "hasPrevPage": true
  }
}
```

### Example 4: Empty Results

```bash
GET /wallets/transactions/674a1b2c3d4e5f6g7h8i9j0k
```

**Response (No transactions):**

```json
{
  "data": [],
  "pagination": {
    "page": 1,
    "limit": 10,
    "offset": 0,
    "total": 0,
    "totalPages": 0,
    "hasNextPage": false,
    "hasPrevPage": false
  }
}
```

### Example 5: Offset Beyond Available Data

```bash
GET /wallets/transactions/674a1b2c3d4e5f6g7h8i9j0k?limit=10&offset=100
```

**Response:**

```json
{
  "data": [],
  "pagination": {
    "page": 11,
    "limit": 10,
    "offset": 100,
    "total": 25,
    "totalPages": 3,
    "hasNextPage": false,
    "hasPrevPage": true
  }
}
```

---

## Transaction Types

### SYNCED Transactions

Transactions that are synchronized from blockchain data:

- Include `tokenContractId`, `blockchainWalletId`, and `txHash`
- Represent on-chain activity
- Quantity stored as hex string (wei/smallest unit)
- Update blockchain wallet balances

### MANUAL Transactions

User-entered transactions for tracking purposes:

- Include `tokenId` (populated with full token object)
- May include optional `note` field
- Quantity stored as hex string
- Update wallet's manual token balances

---

## Pagination Logic

### Calculation

- **Page Number**: `Math.floor(offset / limit) + 1`
- **Skip**: `offset`
- **Total Pages**: `Math.ceil(total / limit)`
- **Has Next Page**: `offset + limit < total`
- **Has Previous Page**: `offset > 0`

### Edge Cases

- **Offset beyond available data**: Returns empty `data` array but maintains pagination metadata
- **Limit larger than total**: Returns all matching transactions in single page
- **Offset 0**: Equivalent to first page
- **Negative offset**: Validation error (minimum offset = 0)
- **Zero or negative limit**: Defaults to 10

---

## Sorting

Transactions are always sorted by `timestamp` in **descending order** (newest first). This ensures:

- Most recent activity appears first
- Consistent ordering across paginated requests
- Predictable results when using offset-based pagination

---

## Error Responses

### 400 Bad Request - Invalid Wallet ID

```json
{
  "statusCode": 400,
  "message": "Validation failed (ObjectId is expected)",
  "error": "Bad Request"
}
```

**Occurs when:**

- `walletId` is not a valid MongoDB ObjectId
- `walletId` has incorrect format

### 400 Bad Request - Invalid Query Parameters

```json
{
  "statusCode": 400,
  "message": [
    "limit must be a positive number",
    "offset must not be less than 0"
  ],
  "error": "Bad Request"
}
```

**Common Validation Errors:**

- Limit must be a positive integer
- Offset must be a non-negative integer
- Invalid query parameter types

### 500 Internal Server Error

```json
{
  "statusCode": 500,
  "message": "Internal server error"
}
```

---

## Implementation Notes

### Technology Stack

- **Framework**: NestJS
- **Database**: MongoDB (via Mongoose)
- **Validation**: ParseObjectIdPipe for path parameters

### Performance Considerations

- Parallel execution of data fetch and count query using `Promise.all()`
- Database query uses `.populate('tokenId')` to include full token details
- Index recommendations:
  - Create compound index on `walletId` and `timestamp` for optimal query performance
  - Example: `{ walletId: 1, timestamp: -1 }`

### Service Method Signature

```typescript
async findByWalletWithPagination(
  walletId: Types.ObjectId,
  limit?: number,
  offset?: number,
): Promise<{
  data: Transaction[];
  pagination: {
    page: number;
    limit: number;
    offset: number;
    total: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPrevPage: boolean;
  };
}>
```

---

## OpenAPI/Swagger Annotations

To add Swagger documentation to the controller, use these decorators:

```typescript
import {
  ApiTags,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
} from '@nestjs/swagger';

@ApiTags('wallets')
@Controller('wallets')
export class WalletsController {
  @Get('transactions/:walletId')
  @ApiOperation({
    summary: 'Get wallet transactions with pagination',
    description:
      'Retrieves a paginated list of transactions for a specific wallet, sorted by timestamp (newest first)',
  })
  @ApiParam({
    name: 'walletId',
    type: String,
    description: 'MongoDB ObjectId of the wallet',
    example: '674a1b2c3d4e5f6g7h8i9j0k',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: 'Number of transactions per page (default: 10)',
    example: 10,
  })
  @ApiQuery({
    name: 'offset',
    required: false,
    type: Number,
    description: 'Number of transactions to skip (default: 0)',
    example: 0,
  })
  @ApiResponse({
    status: 200,
    description: 'Successfully retrieved paginated transactions',
    schema: {
      example: {
        data: [
          {
            _id: '674a2c3d4e5f6g7h8i9j0k1l',
            walletId: '674a1b2c3d4e5f6g7h8i9j0k',
            tokenId: {
              _id: '674a3d4e5f6g7h8i9j0k1l2m',
              id: 'bitcoin',
              symbol: 'btc',
              name: 'Bitcoin',
            },
            type: 'MANUAL',
            event_type: 'DEPOSIT',
            quantity: '0x8ac7230489e80000',
            timestamp: '2025-12-28T10:30:00.000Z',
          },
        ],
        pagination: {
          page: 1,
          limit: 10,
          offset: 0,
          total: 25,
          totalPages: 3,
          hasNextPage: true,
          hasPrevPage: false,
        },
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Bad Request - Invalid wallet ID or query parameters',
  })
  getTransactions(
    @Param('walletId', ParseObjectIdPipe) walletId: Types.ObjectId,
    @Query('limit') limit?: number,
    @Query('offset') offset?: number,
  ) {
    return this.transactionsService.findByWalletWithPagination(
      walletId,
      limit,
      offset,
    );
  }
}
```

---

## Testing Examples

### cURL Examples

```bash
# Basic request
curl -X GET "http://localhost:3000/wallets/transactions/674a1b2c3d4e5f6g7h8i9j0k"

# With pagination
curl -X GET "http://localhost:3000/wallets/transactions/674a1b2c3d4e5f6g7h8i9j0k?limit=20&offset=0"

# Second page
curl -X GET "http://localhost:3000/wallets/transactions/674a1b2c3d4e5f6g7h8i9j0k?limit=20&offset=20"
```

### JavaScript/TypeScript Example

```typescript
async function getWalletTransactions(walletId: string, limit = 10, offset = 0) {
  const params = new URLSearchParams({
    limit: limit.toString(),
    offset: offset.toString(),
  });

  const response = await fetch(
    `http://localhost:3000/wallets/transactions/${walletId}?${params}`,
  );
  const result = await response.json();
  return result;
}

// Usage
const result = await getWalletTransactions('674a1b2c3d4e5f6g7h8i9j0k', 10, 0);
console.log(result.data); // Array of transactions
console.log(result.pagination); // Pagination metadata
```

### Python Example

```python
import requests

def get_wallet_transactions(wallet_id, limit=10, offset=0):
    params = {
        'limit': limit,
        'offset': offset
    }

    url = f'http://localhost:3000/wallets/transactions/{wallet_id}'
    response = requests.get(url, params=params)
    return response.json()

# Usage
result = get_wallet_transactions('674a1b2c3d4e5f6g7h8i9j0k', limit=10, offset=0)
print(result['data'])
print(result['pagination'])
```

### React Hook Example

```typescript
import { useState, useEffect } from 'react';

interface Transaction {
  _id: string;
  walletId: string;
  tokenId?: {
    id: string;
    symbol: string;
    name: string;
  };
  type: 'SYNCED' | 'MANUAL';
  event_type: 'DEPOSIT' | 'WITHDRAWAL';
  quantity: string;
  timestamp: string;
  note?: string;
}

interface Pagination {
  page: number;
  limit: number;
  offset: number;
  total: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
}

function useWalletTransactions(walletId: string, limit = 10, offset = 0) {
  const [data, setData] = useState<Transaction[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const fetchTransactions = async () => {
      try {
        setLoading(true);
        const params = new URLSearchParams({
          limit: limit.toString(),
          offset: offset.toString(),
        });

        const response = await fetch(
          `http://localhost:3000/wallets/transactions/${walletId}?${params}`
        );

        if (!response.ok) {
          throw new Error('Failed to fetch transactions');
        }

        const result = await response.json();
        setData(result.data);
        setPagination(result.pagination);
      } catch (err) {
        setError(err as Error);
      } finally {
        setLoading(false);
      }
    };

    fetchTransactions();
  }, [walletId, limit, offset]);

  return { data, pagination, loading, error };
}

// Usage in component
function WalletTransactions({ walletId }: { walletId: string }) {
  const [offset, setOffset] = useState(0);
  const limit = 10;

  const { data, pagination, loading, error } = useWalletTransactions(
    walletId,
    limit,
    offset
  );

  if (loading) return <div>Loading...</div>;
  if (error) return <div>Error: {error.message}</div>;

  return (
    <div>
      <h2>Transactions</h2>
      <ul>
        {data.map((tx) => (
          <li key={tx._id}>
            {tx.tokenId?.symbol} - {tx.event_type} - {tx.quantity}
          </li>
        ))}
      </ul>

      <div>
        <button
          disabled={!pagination?.hasPrevPage}
          onClick={() => setOffset(Math.max(0, offset - limit))}
        >
          Previous
        </button>
        <span>
          Page {pagination?.page} of {pagination?.totalPages}
        </span>
        <button
          disabled={!pagination?.hasNextPage}
          onClick={() => setOffset(offset + limit)}
        >
          Next
        </button>
      </div>
    </div>
  );
}
```

---

## AI Prompting Examples

### Example Prompt 1: Generate API Client

```
Create a TypeScript API client for the wallet transactions endpoint with the following specification:
- Endpoint: GET /wallets/transactions/:walletId
- Path parameter: walletId (MongoDB ObjectId string)
- Query parameters: limit (number, optional, default 10), offset (number, optional, default 0)
- Response includes data array of transactions and pagination object with: page, limit, offset, total, totalPages, hasNextPage, hasPrevPage
- Each transaction has: _id, walletId, tokenId (populated object), type, event_type, quantity, timestamp
- Include error handling, retry logic, and TypeScript type definitions
```

### Example Prompt 2: Generate Test Cases

```
Write Jest test cases for GET /wallets/transactions/:walletId endpoint that:
- Accepts path parameter walletId and optional query params: limit, offset
- Returns paginated response with data array and pagination metadata
- Data is sorted by timestamp descending (newest first)
- Includes offset-based pagination with page calculation
- Test cases should cover: default params, custom pagination, offset navigation, empty results, invalid wallet ID, edge cases
```

### Example Prompt 3: Generate Frontend Component

```
Create a React component with TypeScript that displays paginated wallet transactions using this API:
- Endpoint: GET /wallets/transactions/:walletId?limit={limit}&offset={offset}
- Response: { data: Transaction[], pagination: {page, limit, offset, total, totalPages, hasNextPage, hasPrevPage} }
- Transaction fields: tokenId.symbol, event_type (DEPOSIT/WITHDRAWAL), quantity (hex string), timestamp
- Include pagination controls using hasNextPage/hasPrevPage flags
- Add loading states, error handling, and transaction type badges
- Format hex quantity as decimal and show timestamps in human-readable format
```

---

## Changelog

| Version | Date       | Changes                                    |
| ------- | ---------- | ------------------------------------------ |
| 1.0.0   | 2025-12-28 | Initial API specification document created |
