# Token Historical Prices API Specification

## Endpoint: Get Token Historical Prices

### HTTP Method & URL

```
GET /tokens/:id/historical-prices
```

### Description

Retrieves historical price data, volume, and market cap for a specific cryptocurrency token over a specified number of days.

---

## Request Parameters

### Path Parameters

| Parameter | Type   | Required | Description                                          |
| --------- | ------ | -------- | ---------------------------------------------------- |
| `id`      | string | Yes      | The unique identifier of the token (e.g., `bitcoin`) |

### Query Parameters

| Parameter | Type    | Required | Default | Description                                           |
| --------- | ------- | -------- | ------- | ----------------------------------------------------- |
| `days`    | integer | Yes      | -       | Number of days of historical data to retrieve (1-365) |

### Parameter Validation

- `id`: Must be a valid token ID string
- `days`: Must be an integer between 1 and 365

---

## Response Format

### Success Response (200 OK)

```json
{
  "prices": [
    {
      "date": "2025-12-01T00:00:00.000Z",
      "price": 90406.28,
      "volume_24h": 40334819409.843475,
      "market_cap": 1807818977105.3909
    }
    // ... more data points
  ],
  "totalAvailableDays": 365,
  "availableRanges": {
    "1d": true,
    "7d": true,
    "1m": true,
    "3m": true,
    "1y": true
  },
  "oldestDataPoint": "2024-12-31T00:00:00.000Z",
  "newestDataPoint": "2025-12-29T17:07:44.000Z"
}
```

### Response Fields

- `prices`: Array of historical data points
  - `date`: ISO 8601 timestamp of the data point
  - `price`: Price of the token at that time
  - `volume_24h`: 24-hour trading volume
  - `market_cap`: Market capitalization
- `totalAvailableDays`: Total number of days available in the dataset
- `availableRanges`: Boolean flags indicating if data is available for common time ranges
- `oldestDataPoint`: Timestamp of the oldest available data point
- `newestDataPoint`: Timestamp of the newest available data point

### Error Responses

#### 400 Bad Request

Occurs if validation fails (e.g., invalid `days` parameter).

```json
{
  "message": [
    "days must not be greater than 365",
    "days must not be less than 1",
    "days must be an integer number"
  ],
  "error": "Bad Request",
  "statusCode": 400
}
```

#### 404 Not Found

Occurs if the token ID is not found.

```json
{
  "statusCode": 404,
  "message": "Token not found",
  "error": "Not Found"
}
```
