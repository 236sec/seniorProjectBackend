# Tokens List API Specification

## Endpoint: List Tokens with Pagination

### HTTP Method & URL

```
GET /tokens
```

### Description

Retrieves a paginated list of cryptocurrency tokens from the database. Supports filtering via search and pagination controls.

---

## Request Parameters

### Query Parameters

| Parameter | Type    | Required | Default | Description                                  |
| --------- | ------- | -------- | ------- | -------------------------------------------- |
| `page`    | integer | No       | 1       | The page number to retrieve (must be ≥ 1)    |
| `limit`   | integer | No       | 10      | Number of tokens per page (must be ≥ 1)      |
| `search`  | string  | No       | -       | Search term to filter tokens by name, symbol |

### Query Parameter Validation

- `page`: Must be an integer greater than or equal to 1
- `limit`: Must be an integer greater than or equal to 1
- `search`: Optional string for partial matching

---

## Response Format

### Success Response (200 OK)

```json
{
  "data": [
    {
      "_id": "string",
      "id": "string",
      "symbol": "string",
      "name": "string",
      "image": {
        "thumb": "string",
        "small": "string",
        "large": "string"
      }
    }
  ],
  "pagination": {
    "page": "number",
    "limit": "number",
    "total": "number",
    "totalPages": "number",
    "hasNextPage": "boolean",
    "hasPrevPage": "boolean"
  }
}
```

### Response Fields

#### Data Object (Array of Tokens)

| Field         | Type   | Description                               |
| ------------- | ------ | ----------------------------------------- |
| `_id`         | string | MongoDB document ID                       |
| `id`          | string | Unique token identifier (e.g., "bitcoin") |
| `symbol`      | string | Token symbol (e.g., "btc")                |
| `name`        | string | Full token name (e.g., "Bitcoin")         |
| `image`       | object | Token image URLs (optional)               |
| `image.thumb` | string | Thumbnail image URL (optional)            |
| `image.small` | string | Small image URL (optional)                |
| `image.large` | string | Large image URL (optional)                |

#### Pagination Object

| Field         | Type    | Description                                        |
| ------------- | ------- | -------------------------------------------------- |
| `page`        | number  | Current page number                                |
| `limit`       | number  | Number of items per page                           |
| `total`       | number  | Total number of tokens matching the query          |
| `totalPages`  | number  | Total number of pages available                    |
| `hasNextPage` | boolean | True if there are more pages after the current one |
| `hasPrevPage` | boolean | True if there are pages before the current one     |

---

## Example Requests

### Example 1: Basic Request (Default Pagination)

```bash
GET /tokens
```

**Response:**

```json
{
  "data": [
    {
      "_id": "674a1b2c3d4e5f6g7h8i9j0k",
      "id": "bitcoin",
      "symbol": "btc",
      "name": "Bitcoin",
      "image": {
        "thumb": "https://assets.coingecko.com/coins/images/1/thumb/bitcoin.png",
        "small": "https://assets.coingecko.com/coins/images/1/small/bitcoin.png",
        "large": "https://assets.coingecko.com/coins/images/1/large/bitcoin.png"
      }
    },
    {
      "_id": "674a1b2c3d4e5f6g7h8i9j1l",
      "id": "ethereum",
      "symbol": "eth",
      "name": "Ethereum",
      "image": {
        "thumb": "https://assets.coingecko.com/coins/images/279/thumb/ethereum.png",
        "small": "https://assets.coingecko.com/coins/images/279/small/ethereum.png",
        "large": "https://assets.coingecko.com/coins/images/279/large/ethereum.png"
      }
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 10,
    "total": 2,
    "totalPages": 1,
    "hasNextPage": false,
    "hasPrevPage": false
  }
}
```

### Example 2: Custom Pagination

```bash
GET /tokens?page=2&limit=5
```

**Response:**

```json
{
  "data": [
    {
      "_id": "674a1b2c3d4e5f6g7h8i9j5p",
      "id": "cardano",
      "symbol": "ada",
      "name": "Cardano",
      "image": {
        "thumb": "https://assets.coingecko.com/coins/images/975/thumb/cardano.png",
        "small": "https://assets.coingecko.com/coins/images/975/small/cardano.png",
        "large": "https://assets.coingecko.com/coins/images/975/large/cardano.png"
      }
    },
    {
      "_id": "674a1b2c3d4e5f6g7h8i9j6q",
      "id": "solana",
      "symbol": "sol",
      "name": "Solana",
      "image": {
        "thumb": "https://assets.coingecko.com/coins/images/4128/thumb/solana.png",
        "small": "https://assets.coingecko.com/coins/images/4128/small/solana.png",
        "large": "https://assets.coingecko.com/coins/images/4128/large/solana.png"
      }
    }
  ],
  "pagination": {
    "page": 2,
    "limit": 5,
    "total": 25,
    "totalPages": 5,
    "hasNextPage": true,
    "hasPrevPage": true
  }
}
```

### Example 3: Search Query

```bash
GET /tokens?search=bitcoin
```

**Response:**

```json
{
  "data": [
    {
      "_id": "674a1b2c3d4e5f6g7h8i9j0k",
      "id": "bitcoin",
      "symbol": "btc",
      "name": "Bitcoin",
      "image": {
        "thumb": "https://assets.coingecko.com/coins/images/1/thumb/bitcoin.png",
        "small": "https://assets.coingecko.com/coins/images/1/small/bitcoin.png",
        "large": "https://assets.coingecko.com/coins/images/1/large/bitcoin.png"
      }
    },
    {
      "_id": "674a1b2c3d4e5f6g7h8i9j7r",
      "id": "bitcoin-cash",
      "symbol": "bch",
      "name": "Bitcoin Cash",
      "image": {
        "thumb": "https://assets.coingecko.com/coins/images/780/thumb/bitcoin-cash.png",
        "small": "https://assets.coingecko.com/coins/images/780/small/bitcoin-cash.png",
        "large": "https://assets.coingecko.com/coins/images/780/large/bitcoin-cash.png"
      }
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 10,
    "total": 2,
    "totalPages": 1,
    "hasNextPage": false,
    "hasPrevPage": false
  }
}
```

### Example 4: Combined Parameters

```bash
GET /tokens?page=1&limit=20&search=eth
```

**Response:**

```json
{
  "data": [
    {
      "_id": "674a1b2c3d4e5f6g7h8i9j1l",
      "id": "ethereum",
      "symbol": "eth",
      "name": "Ethereum",
      "image": {
        "thumb": "https://assets.coingecko.com/coins/images/279/thumb/ethereum.png",
        "small": "https://assets.coingecko.com/coins/images/279/small/ethereum.png",
        "large": "https://assets.coingecko.com/coins/images/279/large/ethereum.png"
      }
    },
    {
      "_id": "674a1b2c3d4e5f6g7h8i9j8s",
      "id": "ethereum-classic",
      "symbol": "etc",
      "name": "Ethereum Classic",
      "image": {
        "thumb": "https://assets.coingecko.com/coins/images/453/thumb/ethereum-classic.png",
        "small": "https://assets.coingecko.com/coins/images/453/small/ethereum-classic.png",
        "large": "https://assets.coingecko.com/coins/images/453/large/ethereum-classic.png"
      }
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 2,
    "totalPages": 1,
    "hasNextPage": false,
    "hasPrevPage": false
  }
}
```

### Example 5: Empty Results

```bash
GET /tokens?search=nonexistenttoken
```

**Response:**

```json
{
  "data": [],
  "pagination": {
    "page": 1,
    "limit": 10,
    "total": 0,
    "totalPages": 0,
    "hasNextPage": false,
    "hasPrevPage": false
  }
}
```

---

## Search Behavior

The search parameter performs a case-insensitive "starts with" match against two fields:

- **Symbol**: The token's symbol (e.g., "btc")
- **Name**: The full token name (e.g., "Bitcoin")

Search uses MongoDB regex with `^` anchor and case-insensitive flag (`$regex: ^{search}` with `$options: 'i'`).

**Examples:**

- `search=bit` matches "Bitcoin", "Bitshares" (names starting with "bit")
- `search=BTC` matches tokens with symbol or name starting with "btc"
- `search=Eth` matches "Ethereum", "Ethereum Classic" (names starting with "eth")
- `search=card` matches "Cardano" (name starts with "card"), but NOT "discount-card"

---

## Pagination Logic

### Calculation

- **Skip**: `(page - 1) × limit`
- **Total Pages**: `Math.ceil(total / limit)`
- **Has Next Page**: `page < totalPages`
- **Has Previous Page**: `page > 1`

### Edge Cases

- **Page beyond available pages**: Returns empty `data` array but maintains pagination metadata
- **Limit larger than total**: Returns all matching tokens in single page
- **Page 0 or negative**: Validation error (minimum page = 1)
- **Limit 0 or negative**: Validation error (minimum limit = 1)

---

## Error Responses

### 400 Bad Request - Invalid Parameters

```json
{
  "statusCode": 400,
  "message": ["page must not be less than 1", "page must be an integer number"],
  "error": "Bad Request"
}
```

**Common Validation Errors:**

- Page must be an integer ≥ 1
- Limit must be an integer ≥ 1
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
- **Validation**: class-validator, class-transformer

### Performance Considerations

- Database query uses `.lean()` for better performance (returns plain JavaScript objects)
- Parallel execution of data fetch and count query using `Promise.all()`
- Index recommendations: Create indexes on `id`, `symbol`, and `name` fields for optimal search performance

### DTOs Used

**QueryTokensDto:**

```typescript
class QueryTokensDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number = 10;

  @IsOptional()
  @IsString()
  search?: string;
}
```

---

## OpenAPI/Swagger Annotations

To add Swagger documentation to the controller, use these decorators:

```typescript
import { ApiTags, ApiOperation, ApiQuery, ApiResponse } from '@nestjs/swagger';

@ApiTags('tokens')
@Controller('tokens')
export class TokensController {
  @Get()
  @ApiOperation({
    summary: 'List tokens with pagination',
    description:
      'Retrieves a paginated list of cryptocurrency tokens with optional search filtering',
  })
  @ApiQuery({
    name: 'page',
    required: false,
    type: Number,
    description: 'Page number (default: 1)',
    example: 1,
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: 'Items per page (default: 10)',
    example: 10,
  })
  @ApiQuery({
    name: 'search',
    required: false,
    type: String,
    description: 'Search term for filtering by name, symbol, or id',
    example: 'bitcoin',
  })
  @ApiResponse({
    status: 200,
    description: 'Successfully retrieved paginated tokens',
    schema: {
      example: {
        data: [
          {
            _id: '674a1b2c3d4e5f6g7h8i9j0k',
            id: 'bitcoin',
            symbol: 'btc',
            name: 'Bitcoin',
            image: {
              thumb:
                'https://assets.coingecko.com/coins/images/1/thumb/bitcoin.png',
              small:
                'https://assets.coingecko.com/coins/images/1/small/bitcoin.png',
              large:
                'https://assets.coingecko.com/coins/images/1/large/bitcoin.png',
            },
          },
        ],
        pagination: {
          page: 1,
          limit: 10,
          total: 1,
          totalPages: 1,
          hasNextPage: false,
          hasPrevPage: false,
        },
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Bad Request - Invalid query parameters',
  })
  findAll(@Query() query: QueryTokensDto) {
    return this.tokensService.findAll(query.page, query.limit, query.search);
  }
}
```

---

## Testing Examples

### cURL Examples

```bash
# Basic request
curl -X GET "http://localhost:3000/tokens"

# With pagination
curl -X GET "http://localhost:3000/tokens?page=2&limit=5"

# With search
curl -X GET "http://localhost:3000/tokens?search=bitcoin"

# All parameters
curl -X GET "http://localhost:3000/tokens?page=1&limit=20&search=eth"
```

### JavaScript/TypeScript Example

```typescript
async function getTokens(page = 1, limit = 10, search = '') {
  const params = new URLSearchParams({
    page: page.toString(),
    limit: limit.toString(),
    ...(search && { search }),
  });

  const response = await fetch(`http://localhost:3000/tokens?${params}`);
  const data = await response.json();
  return data;
}

// Usage
const tokens = await getTokens(1, 10, 'bitcoin');
console.log(tokens.data);
console.log(tokens.pagination);
```

### Python Example

```python
import requests

def get_tokens(page=1, limit=10, search=None):
    params = {
        'page': page,
        'limit': limit
    }
    if search:
        params['search'] = search

    response = requests.get('http://localhost:3000/tokens', params=params)
    return response.json()

# Usage
tokens = get_tokens(page=1, limit=10, search='bitcoin')
print(tokens['data'])
print(tokens['pagination'])
```

---

## AI Prompting Examples

### Example Prompt 1: Generate API Client

```
Create a TypeScript API client for the tokens list endpoint with the following specification:
- Endpoint: GET /tokens
- Query parameters: page (number, optional, default 1), limit (number, optional, default 10), search (string, optional)
- Response includes data array and pagination object with fields: page, limit, total, totalPages, hasNextPage, hasPrevPage
- Each token has: _id, id, symbol, name
- Include error handling and type definitions
```

### Example Prompt 2: Generate Test Cases

```
Write Jest test cases for a GET /tokens endpoint that:
- Accepts optional query params: page, limit, search
- Returns paginated response with data array and pagination metadata
- Search performs case-insensitive partial matching on id, symbol, and name fields
- Includes hasNextPage and hasPrevPage boolean flags
- Test cases should cover: default params, custom pagination, search, empty results, edge cases
```

### Example Prompt 3: Generate Frontend Component

```
Create a React component that displays a paginated list of cryptocurrency tokens using this API:
- Endpoint: GET /tokens?page={page}&limit={limit}&search={search}
- Response format: { data: Array<{id, symbol, name}>, pagination: {page, limit, total, totalPages, hasNextPage, hasPrevPage} }
- Include search input, pagination controls, and loading states
- Use the hasNextPage/hasPrevPage flags to enable/disable navigation buttons
```

---

## Changelog

| Version | Date       | Changes                                         |
| ------- | ---------- | ----------------------------------------------- |
| 1.1.0   | 2025-12-07 | Added image field with thumb, small, large URLs |
| 1.0.0   | 2025-12-07 | Initial API specification document created      |
