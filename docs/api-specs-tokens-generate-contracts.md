# Token Contract Generation API

## Endpoint

`GET /tokens/generate-contracts`

## Description

Generates token contract records by fetching platform/contract address data from CoinGecko for tokens that exist in the database but don't have associated contract addresses yet. This endpoint processes tokens in batches to respect API rate limits and allows incremental processing across multiple calls.

## Query Parameters

| Parameter    | Type   | Required | Default | Description                                      |
| ------------ | ------ | -------- | ------- | ------------------------------------------------ |
| `batchSize`  | number | No       | 50      | Number of tokens to process per batch            |
| `startIndex` | number | No       | 0       | Starting index in the token collection           |
| `endIndex`   | number | No       | total   | Ending index in the token collection (exclusive) |

## Use Cases

1. **Initial contract generation**: After importing tokens via `db-update`, generate their contract addresses
2. **Fill missing contracts**: Process tokens that failed during initial generation
3. **Incremental processing**: Process large datasets in chunks to avoid rate limits
4. **Recovery**: Continue from where a previous run stopped due to rate limiting

## Response Format

### Success Response

```json
{
  "success": true,
  "message": "Token contract generation completed",
  "totalTokensInRange": 100,
  "processedTokens": 95,
  "skippedTokens": 5,
  "errorCount": 0,
  "totalContractsAdded": 450,
  "totalContractsUpdated": 20,
  "range": {
    "startIndex": 0,
    "endIndex": 100,
    "nextStartIndex": 100
  }
}
```

### Error Response

```json
{
  "success": false,
  "error": "Error message details",
  "message": "Failed to generate token contracts"
}
```

## Response Fields

| Field                   | Type    | Description                                       |
| ----------------------- | ------- | ------------------------------------------------- |
| `success`               | boolean | Whether the operation completed successfully      |
| `message`               | string  | Human-readable status message                     |
| `totalTokensInRange`    | number  | Total number of tokens in the specified range     |
| `processedTokens`       | number  | Number of tokens successfully processed           |
| `skippedTokens`         | number  | Number of tokens skipped (already have contracts) |
| `errorCount`            | number  | Number of errors encountered during processing    |
| `totalContractsAdded`   | number  | Total number of new contract records created      |
| `totalContractsUpdated` | number  | Total number of existing contract records updated |
| `range`                 | object  | Information about the processing range            |

### Range Object Fields

| Field            | Type   | Description                               |
| ---------------- | ------ | ----------------------------------------- |
| `startIndex`     | number | The starting index used for this run      |
| `endIndex`       | number | The ending index used for this run        |
| `nextStartIndex` | number | Suggested starting index for the next run |

## Example Requests

### Process first 50 tokens (default batch)

```bash
GET /tokens/generate-contracts
```

### Process with custom batch size

```bash
GET /tokens/generate-contracts?batchSize=100
```

### Process specific range

```bash
GET /tokens/generate-contracts?startIndex=0&endIndex=500
```

### Continue from previous run

```bash
# After receiving response with nextStartIndex: 500
GET /tokens/generate-contracts?startIndex=500&endIndex=1000
```

### Process in small batches to avoid rate limits

```bash
GET /tokens/generate-contracts?batchSize=25&startIndex=0&endIndex=100
```

## Processing Logic

1. **Skip check**: For each token, checks if it already has contract records
2. **Data fetch**: Fetches platform/contract data from CoinGecko API
3. **Contract creation**: Creates contract records for all platforms where the token exists
4. **Rate limiting**:
   - 100ms delay between individual tokens
   - 2 second delay between batches
   - Stops gracefully on 429 (rate limit) errors

## Workflow for Large Datasets

### Strategy 1: Process in chunks

```bash
# Process first 500 tokens
GET /tokens/generate-contracts?startIndex=0&endIndex=500

# Process next 500 tokens
GET /tokens/generate-contracts?startIndex=500&endIndex=1000

# Continue...
GET /tokens/generate-contracts?startIndex=1000&endIndex=1500
```

### Strategy 2: Small batches for rate limit control

```bash
# Process 100 tokens with batch size of 25
GET /tokens/generate-contracts?batchSize=25&startIndex=0&endIndex=100

# Then continue
GET /tokens/generate-contracts?batchSize=25&startIndex=100&endIndex=200
```

## Contract Data Structure

For each token, the function creates contract records with:

| Field             | Description                                  |
| ----------------- | -------------------------------------------- |
| `tokenId`         | Reference to the token document in MongoDB   |
| `coinGeckoId`     | CoinGecko ID of the token                    |
| `chainId`         | Platform/chain identifier (e.g., "ethereum") |
| `contractAddress` | Token's contract address on that chain       |
| `symbol`          | Token symbol                                 |
| `name`            | Token name                                   |

## Supported Chains/Platforms

The function stores contract addresses for all platforms supported by CoinGecko, including:

- `ethereum` - Ethereum Mainnet
- `polygon-pos` - Polygon
- `arbitrum-one` - Arbitrum One
- `optimistic-ethereum` - Optimism
- `base` - Base
- `binance-smart-chain` - BSC
- `avalanche` - Avalanche C-Chain
- And 100+ more platforms

## Performance Considerations

1. **Rate Limits**: CoinGecko free tier has rate limits. The function automatically stops on 429 errors
2. **Processing Time**:
   - ~100ms per token (with delays)
   - ~50 tokens = ~5 seconds
   - ~500 tokens = ~50 seconds
3. **Database Operations**: Uses `bulkWrite` for efficient upsert operations

## Error Handling

The function handles several scenarios:

1. **Rate Limit (429)**: Stops processing current batch gracefully, returns partial results
2. **Missing Platform Data**: Logs debug message, continues to next token
3. **Token Already Has Contracts**: Skips token, increments `skippedTokens` counter
4. **Network Errors**: Logs error, increments `errorCount`, continues processing
5. **Database Errors**: Returns error response

## Best Practices

1. **Start small**: Test with a small range first (e.g., 0-50)
2. **Monitor logs**: Check server logs for detailed processing information
3. **Use range parameters**: Process in chunks to avoid timeout issues
4. **Track progress**: Use `nextStartIndex` from response to continue
5. **Run after db-update**: Generate contracts after importing new tokens
6. **Handle rate limits**: If you hit 429, wait a few minutes and continue from `nextStartIndex`

## Integration with Other Endpoints

### Typical Workflow

1. **Import tokens**:

   ```bash
   GET /tokens/db-update?startPage=1&endPage=5
   ```

2. **Generate contracts**:

   ```bash
   GET /tokens/generate-contracts?startIndex=0&endIndex=1250
   ```

3. **Query by contract**:
   ```bash
   # Can now use findByContractAddress in wallets service
   ```

## Monitoring Progress

Check the logs for detailed information:

- `Starting token contract generation...`
- `Processing batch X of Y (Z tokens)`
- `Added N contracts for token {id}`
- `Contract generation summary: {...}`

## Limitations

1. **CoinGecko API**: Requires valid API key and respects rate limits
2. **Existing Contracts**: Skips tokens that already have contracts (won't update)
3. **Platform Data Availability**: Some tokens may not have platform/contract data in CoinGecko
4. **Processing Time**: Large datasets require multiple API calls spread over time
