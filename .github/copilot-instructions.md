# Project Overview

This project is a Hybrid Blockchain/Web2 Backend built with **NestJS**, **MongoDB** (Mongoose), and **Python** data processing scripts.
It serves as a backend for a Crypto Dashboard, providing wallet tracking, price indicators, and notifications.

# Architectural Patterns

## 1. Hybrid Data Flow (The "Sidecar" Pattern)

- **Concept**: Heavy data analysis (calculating RSI, MACD, etc.) is offloaded to Python scripts, which output results to the file system. The NestJS app serves this read-only data.
- **Data Exchange**: The `data/` directory acts as the database for indicators.
  - **Writer**: `scripts/*.py` (Python/Pandas) generates JSON files (e.g., `bitcoin-rsi.json`).
  - **Reader**: `src/indicators/indicators.service.ts` reads these files to serve API requests.
- **Constraint**: Do not attempt to calculate complex technical indicators in TypeScript/Node.js. Refer to the Python scripts for that logic.

## 2. Multi-Chain Support

- **Enum-Driven**: All chain logic MUST use the `SupportedPRC` enum (`src/blockchain/enum/supported-prc.enum`).
- **RPC Management**: Do not instantiate `ethers.JsonRpcProvider` directly in components. Inject `BlockchainService` and use `getProvider(chain)`.
- **Ethers.js**: The project uses `ethers` v6. Ensure code snippets are compatible (e.g., `ethers.JsonRpcProvider` vs v5 `ethers.providers.JsonRpcProvider`).

## 3. Database & Schemas

- **ODM**: Mongoose with `@nestjs/mongoose`.
- **Pattern**: Services inject models via `@InjectModel(Name.name)`.
- **Global Config**: Mongoose is configured with a custom logger in `app.module.ts` for debugging queries.

# Critical Workflows

## Development

- **Start Node App**: `npm run start:dev`
- **Run Python Scripts**: Scripts in `scripts/` are standalone. They populate the `data/` folder.
  - Example: `python3 scripts/main.py` updates indicator data.

## Testing

- **Unit Tests**: `npm run test` (Jest, `*.spec.ts` files adjacent to source).
- **Unit Test Coverage**: `npm run test:cov` (aim for 100% branch coverage).
- **E2E Tests**: `npm run test:e2e` (located in `test/`).

# Coding Conventions

## TypeScript / NestJS

- **Configuration**: Use `@nestjs/config`. Access env vars via `ConfigService`, never `process.env`.
- **Error Handling**: Use standard NestJS Exceptions (`InternalServerErrorException`, `NotFoundException`).
- **Logging**: Use `Logger` from `@nestjs/common` instead of `console.log`.

## Python Scripts

- **Atomic Writes**: When updating JSON files in `data/`, use the `_atomic_write` pattern (write to `.tmp` then rename) to prevent race conditions with the Node.js reader.
- **Structure**: Logic is split into `main.py` (orchestrator), `indicators.py` (math), and `coingecko.py` (fetching).

# Key Files

- `src/blockchain/blockchain.service.ts`: Central hub for EVM interaction.
- `src/indicators/indicators.service.ts`: Reader for the Python-generated stats.
- `scripts/main.py`: Entry point for data processing pipeline.
