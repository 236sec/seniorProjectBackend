# Token Database Update API

## Endpoint

`GET /tokens/db-update`

## Description

Updates the local token database by fetching data from CoinGecko API. This endpoint supports paginated updates, allowing you to continue fetching data across multiple API calls to avoid rate limits and manage large datasets incrementally.

## Query Parameters

| Parameter   | Type   | Required | Default       | Description                                                       |
| ----------- | ------ | -------- | ------------- | ----------------------------------------------------------------- |
| `startPage` | number | No       | 1             | Starting page number for fetching coins from CoinGecko            |
| `endPage`   | number | No       | startPage + 4 | Ending page number (inclusive). If not specified, fetches 5 pages |
| `perPage`   | number | No       | 250           | Number of coins to fetch per page (max 250 for CoinGecko API)     |

## Rate Limiting

- **Time-based limiting**: When starting from page 1, the endpoint enforces a 10-minute cooldown between full updates to prevent excessive API usage
- **Continuation updates**: When starting from page > 1, the time check is bypassed, allowing you to continue incremental updates
- **CoinGecko rate limits**: 2-second delay between page requests to respect CoinGecko's rate limits

## Response Format

### Success Response

```json
{
  "success": true,
  "totalCoins": 1250,
  "inserted": 150,
  "updated": 1100,
  "totalContracts": 3500,
  "contractsInserted": 500,
  "contractsUpdated": 3000,
  "message": "Token database updated successfully",
  "updatedAt": "2025-12-10T10:30:00.000Z",
  "pagination": {
    "startPage": 1,
    "endPage": 5,
    "nextPage": 6,
    "perPage": 250,
    "coinsPerPage": 250
  }
}
```

### Rate Limited Response (within 10-minute window)

```json
{
  "success": false,
  "message": "Update too frequent. Last update was 5 minutes ago. Please wait 5 more minutes before updating again.",
  "lastUpdatedAt": "2025-12-10T10:25:00.000Z",
  "nextUpdateAllowedAt": "2025-12-10T10:35:00.000Z"
}
```

### No Data Response

```json
{
  "success": false,
  "message": "No coins fetched from CoinGecko",
  "startPage": 100,
  "endPage": 99
}
```

### Error Response

```json
{
  "success": false,
  "error": "Error message details",
  "message": "Failed to update token database"
}
```

## Response Fields

| Field               | Type    | Description                                   |
| ------------------- | ------- | --------------------------------------------- |
| `success`           | boolean | Whether the update was successful             |
| `totalCoins`        | number  | Total number of coins fetched and processed   |
| `inserted`          | number  | Number of new token records inserted          |
| `updated`           | number  | Number of existing token records updated      |
| `totalContracts`    | number  | Total number of contract addresses processed  |
| `contractsInserted` | number  | Number of new contract addresses inserted     |
| `contractsUpdated`  | number  | Number of existing contract addresses updated |
| `message`           | string  | Human-readable status message                 |
| `updatedAt`         | string  | ISO timestamp of when the update completed    |
| `pagination`        | object  | Pagination information for continuing updates |

### Pagination Object Fields

| Field          | Type   | Description                                 |
| -------------- | ------ | ------------------------------------------- |
| `startPage`    | number | The page number where this update started   |
| `endPage`      | number | The page number where this update ended     |
| `nextPage`     | number | Suggested next page number for continuation |
| `perPage`      | number | Number of items requested per page          |
| `coinsPerPage` | number | Average number of coins fetched per page    |

## Example Requests

### Initial update (default - fetches 5 pages)

```bash
GET /tokens/db-update
```

### Initial update with custom range

```bash
GET /tokens/db-update?startPage=1&endPage=10
```

### Continue from page 6 (bypasses rate limit check)

```bash
GET /tokens/db-update?startPage=6&endPage=10
```

### Fetch specific page range with custom perPage

```bash
GET /tokens/db-update?startPage=20&endPage=25&perPage=100
```

### Continue to next batch after receiving pagination info

```bash
# After receiving response with nextPage: 11
GET /tokens/db-update?startPage=11&endPage=15
```

## Usage Workflow

### Incremental Update Strategy

1. **Start initial update**:

   ```bash
   GET /tokens/db-update?startPage=1&endPage=5
   ```

   Response includes: `"nextPage": 6`

2. **Continue with next batch**:

   ```bash
   GET /tokens/db-update?startPage=6&endPage=10
   ```

   Response includes: `"nextPage": 11`

3. **Repeat until all data is fetched**:

   ```bash
   GET /tokens/db-update?startPage=11&endPage=15
   ```

4. **Stop when no more data**:
   When `totalCoins` becomes 0 or significantly less than expected, you've reached the end

### Best Practices

1. **Respect rate limits**: Use continuation updates (startPage > 1) to bypass the 10-minute cooldown
2. **Monitor pagination**: Use the `nextPage` value from responses to continue seamlessly
3. **Handle errors gracefully**: Implement retry logic for 429 rate limit errors
4. **Track progress**: Log `startPage`, `endPage`, and `totalCoins` for each batch
5. **Adjust batch size**: Use smaller `endPage` ranges if hitting rate limits frequently

## Data Fetched

The endpoint fetches and stores:

1. **Token Metadata**:
   - CoinGecko ID
   - Symbol
   - Name
   - Image URLs (thumb, small, large)

2. **Contract Addresses**:
   - Chain ID (platform identifier)
   - Contract address
   - Links to token metadata
   - Symbol and name for quick reference

## Platform/Chain IDs

Contract addresses are stored with platform identifiers such as:

- `ethereum` - Ethereum Mainnet
- `polygon-pos` - Polygon
- `arbitrum-one` - Arbitrum
- `optimistic-ethereum` - Optimism
- `base` - Base
- And many more supported by CoinGecko

## Implementation Notes

- Uses MongoDB `bulkWrite` for efficient upsert operations
- Maintains update logs in `TokenUpdateLog` collection
- Automatically skips empty pages
- Adds 5-second delay before fetching contract/platform data
- Adds 2-second delay between market data pages
- Continues gracefully if platform data fetch fails (429 rate limit)

## Error Handling

The endpoint handles several error scenarios:

1. **Rate Limit (429)**: Logs warning and stops gracefully, returning partial results
2. **Network Errors**: Logs error and returns failure response with error details
3. **No Data**: Returns success=false with appropriate message
4. **Database Errors**: Returns failure response with error message

## Monitoring

Check the `TokenUpdateLog` collection for historical update information:

- Sync type: `coingecko_sync`
- Last updated timestamp
- Coins and contracts processed
- Insert/update counts
