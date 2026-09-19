# ChainBounty Backend

[![CI](https://github.com/chainbounty/chainbounty-backend/actions/workflows/ci.yml/badge.svg)](https://github.com/chainbounty/chainbounty-backend/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

Decentralized bounty board backend for open source projects. Integrates with GitHub issues and Stellar/Soroban smart contracts.

## Features

- 🎯 **Bounty Management** - Create, claim, submit, and approve bounties
- 🔗 **GitHub Integration** - Sync bounties with GitHub issues via webhooks
- ⛓️ **Stellar/Soroban** - On-chain escrow and payment tracking
- 🔐 **Stellar Authentication** - Keypair-based JWT authentication
- 📊 **Contributor Leaderboard** - Track reputation and earnings
- 🔔 **Notifications** - Webhook delivery for bounty events
- ⚖️ **Dispute Resolution** - Handle bounty disputes
- 💰 **Platform Fees** - Automatic fee tracking and treasury management

## Tech Stack

- **Node.js + TypeScript** - Runtime and language
- **Express** - HTTP server
- **Prisma** - Database ORM
- **PostgreSQL** - Primary database
- **Stellar SDK** - Blockchain integration
- **JWT** - Authentication tokens
- **Jest + Supertest** - Testing

## Prerequisites

- Node.js 18+
- Docker and Docker Compose (for local development)
- PostgreSQL 15+ (or use Docker)

## Getting Started

### 1. Clone and Install

```bash
cd chainbounty-backend
npm install
```

### 2. Start PostgreSQL with Docker

```bash
docker-compose up -d postgres
```

This starts:
- PostgreSQL on port `5432` (development)
- PostgreSQL on port `5433` (testing)
- Adminer on port `8080` (database UI)

### 3. Configure Environment

```bash
cp .env.example .env
```

Edit `.env` with your configuration. For local dev with Docker, the default DATABASE_URL works:

```env
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/chainbounty?schema=public"
```

### 4. Run Migrations

```bash
npx prisma migrate dev
```

This creates all database tables.

### 5. Start the Server

```bash
npm run dev
```

Server runs on `http://localhost:3000`

Health check: `http://localhost:3000/health`

## API Documentation

Once running, API docs are available at:

```
http://localhost:3000/api-docs
```

### Core Endpoints

- `POST /api/v1/auth/challenge` - Get auth challenge
- `POST /api/v1/auth/verify` - Verify signature and get JWT
- `GET /api/v1/bounties` - List bounties (with filters)
- `POST /api/v1/bounties` - Create bounty
- `GET /api/v1/bounties/:id` - Get bounty details
- `POST /api/v1/bounties/:id/claim` - Claim a bounty
- `POST /api/v1/bounties/:id/submit` - Submit work
- `POST /api/v1/bounties/:id/approve` - Approve submission
- `POST /api/v1/bounties/:id/reject` - Reject submission
- `GET /api/v1/contributors/leaderboard` - Top contributors
- `GET /api/v1/treasury/stats` - Platform fee stats
- `POST /webhooks/github` - GitHub webhook receiver



## API Authentication Flow

ChainBounty implements challenge-response authentication using Stellar ed25519 keypairs and JSON Web Tokens (JWT). Contributor accounts require no passwords; identity and permissions are cryptographically proved through keypair signature verification.

### Challenge-Response Workflow

```
Client Application                                       ChainBounty Backend
        |                                                         |
        | 1. POST /api/v1/auth/challenge { stellarAddress }       |
        |-------------------------------------------------------->|
        |                                                         |
        | 2. Returns unique 64-char hex nonce                     |
        |<--------------------------------------------------------|
        |                                                         |
        | [Sign nonce with Stellar ed25519 Secret Key]            |
        |                                                         |
        | 3. POST /api/v1/auth/verify { stellarAddress, signature}|
        |-------------------------------------------------------->|
        |                                                         |
        | 4. Validates ed25519 signature & returns JWT token      |
        |<--------------------------------------------------------|
        |                                                         |
        | 5. Authenticated request with Bearer <JWT> header       |
        |-------------------------------------------------------->|
```

### 1. Request an Authentication Challenge

Submit your public Stellar address to receive a single-use cryptographic challenge nonce:

**Request (curl):**
```bash
curl -X POST http://localhost:3000/api/v1/auth/challenge \
  -H "Content-Type: application/json" \
  -d '{"stellarAddress": "GBRPYHIL2CI3FNQ4BXLFMNDLFJUNPU2HY3ZMFTO272FYO7J4H2YIMTC5"}'
```

**Request (JavaScript / TypeScript):**
```javascript
const response = await fetch('http://localhost:3000/api/v1/auth/challenge', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    stellarAddress: 'GBRPYHIL2CI3FNQ4BXLFMNDLFJUNPU2HY3ZMFTO272FYO7J4H2YIMTC5'
  })
});
const { data } = await response.json();
console.log('Received Nonce:', data.nonce);
```

**Expected Response (`200 OK`):**
```json
{
  "data": {
    "nonce": "9a1b2c3d4e5f60718293a4b5c6d7e8f901a2b3c4d5e6f708192a3b4c5d6e7f80",
    "message": "Sign this message to authenticate: 9a1b2c3d4e5f60718293a4b5c6d7e8f901a2b3c4d5e6f708192a3b4c5d6e7f80"
  }
}
```

### 2. Sign Nonce & Verify Challenge

Sign the challenge message using your Stellar secret key (`@stellar/stellar-sdk` Keypair) and submit the base64 signature:

**Signing Nonce with Stellar SDK:**
```typescript
import { Keypair } from '@stellar/stellar-sdk';

const keypair = Keypair.fromSecret('SCZANGBA5YHTNYVVV4C3U252E2B6P6IRKD4DHAISYCGWOBD6TXDYCH35');
const messageBuffer = Buffer.from(nonce, 'utf-8');
const signature = keypair.sign(messageBuffer).toString('base64');
```

**Verification Request (curl):**
```bash
curl -X POST http://localhost:3000/api/v1/auth/verify \
  -H "Content-Type: application/json" \
  -d '{
    "stellarAddress": "GBRPYHIL2CI3FNQ4BXLFMNDLFJUNPU2HY3ZMFTO272FYO7J4H2YIMTC5",
    "signature": "MEUCIQDxvB8Y1g4i9jZ...=="
  }'
```

**Expected Response (`200 OK`):**
```json
{
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "contributor": {
      "id": "cm1abcdef000001...",
      "stellarAddress": "GBRPYHIL2CI3FNQ4BXLFMNDLFJUNPU2HY3ZMFTO272FYO7J4H2YIMTC5",
      "githubUsername": "stellar-builder",
      "displayName": "Stellar Contributor",
      "avatarUrl": "https://avatars.githubusercontent.com/u/123456"
    }
  }
}
```

### 3. Authenticated Endpoints & Required Headers

Protected API endpoints enforce JWT validation via the standard HTTP `Authorization` header:

| Header | Format | Description |
| :--- | :--- | :--- |
| `Authorization` | `Bearer <JWT_TOKEN>` | Bearer token obtained from `/api/v1/auth/verify` |
| `Content-Type` | `application/json` | Mandatory on all `POST`, `PUT`, and `PATCH` requests |

**Example: Authenticated Bounty Work Submission:**
```bash
curl -X POST http://localhost:3000/api/v1/bounties/bounty_id_here/submit \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." \
  -d '{
    "pullRequestUrl": "https://github.com/org/repo/pull/42",
    "notes": "Completed implementation with 100% test coverage"
  }'
```

## Testing

### Run All Tests

```bash
npm test
```

### Run Tests in Watch Mode

```bash
npm run test:watch
```

### Generate Coverage Report

```bash
npm run test:coverage
```

**Note:** Integration tests require a running PostgreSQL database. Unit tests (labelSync, auth, platformFee) run without database dependencies.

## Database Management

### Prisma Studio (GUI)

```bash
npm run db:studio
```

Opens Prisma Studio at `http://localhost:5555`

### Create Migration

```bash
npx prisma migrate dev --name your_migration_name
```

### Reset Database

```bash
npx prisma migrate reset
```

## Docker Commands

### Start all services

```bash
docker-compose up -d
```

### Stop all services

```bash
docker-compose down
```

### View logs

```bash
docker-compose logs -f postgres
```

### Access Adminer (Database UI)

Open `http://localhost:8080`

- System: PostgreSQL
- Server: postgres
- Username: postgres
- Password: postgres
- Database: chainbounty

## GitHub Webhook Setup

1. Go to your repo settings → Webhooks → Add webhook
2. Payload URL: `https://your-domain.com/webhooks/github`
3. Content type: `application/json`
4. Secret: Set same value as `GITHUB_WEBHOOK_SECRET` in `.env`
5. Events: Select "Issues"

## Stellar Integration

The indexer polls Horizon for contract events. Configure:

```env
STELLAR_HORIZON_URL="https://horizon-testnet.stellar.org"
SOROBAN_CONTRACT_ADDRESS="your-contract-address"
INDEXER_POLL_INTERVAL_MS=15000
```

## Project Structure

```
chainbounty-backend/
├── prisma/
│   ├── migrations/            # Database migrations
│   └── schema.prisma          # Database schema
├── src/
│   ├── controllers/           # Request handlers
│   ├── lib/                   # Business logic
│   ├── middleware/            # Express middleware
│   ├── routes/                # API routes
│   ├── types/                 # TypeScript types
│   ├── validators/            # Request validation
│   ├── app.ts                 # Express app setup
│   └── index.ts               # Server entry point
├── tests/                     # Integration & unit tests
├── docker-compose.yml         # Local dev environment
└── package.json
```

## Scripts

- `npm run dev` - Start dev server with hot reload
- `npm run build` - Compile TypeScript
- `npm start` - Run production build
- `npm test` - Run tests
- `npm run lint` - Lint code
- `npm run format` - Format code with Prettier

## Documentation

- [Environment Variables](./ENVIRONMENT.md) - Complete environment configuration guide
- [Contributing Guide](./CONTRIBUTING.md) - How to contribute to the project
- [API Documentation](http://localhost:3000/api-docs) - Interactive API docs (when server is running)

## Support

- 📖 [Documentation](./README.md)
- 🐛 [Report Issues](https://github.com/chainbounty/chainbounty-backend/issues)
- 💬 [Discussions](https://github.com/chainbounty/chainbounty-backend/discussions)

## License

MIT
