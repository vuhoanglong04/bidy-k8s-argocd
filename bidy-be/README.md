# Bidy Auction Platform - Backend

A TypeScript/Express backend API for the Bidy online auction platform, featuring real-time bidding, user management, and comprehensive auction lifecycle management. Backed by PostgreSQL (via TypeORM).

## Features

### Core Functionality
- **User Authentication & Management** - JWT-based authentication with role-based access control
- **Auction Management** - Full auction lifecycle from creation to completion
- **Real-time Bidding** - Socket.IO-based real-time bidding with automatic bid validation
- **Support Chat System** - Integrated customer support with admin dashboard
- **Notification System** - Real-time notifications for bids and auction status changes
- **Order & Review Management** - Post-auction order handling and reviews
- **File Upload** - Cloudflare R2 (S3-compatible) storage with private-bucket presigned URLs
- **API Docs** - Swagger/OpenAPI available at `/api-docs`

### Planned
- **Live Chat System with Live Stats** - Real-time chat with live viewer/engagement stats (not implemented yet)

## Project Structure

```
src/
├── app.ts                  # Express app configuration: middleware and routes
├── server.ts               # Runtime entrypoint: HTTP server, Socket.IO, DB startup
├── config/                 # Environment/AWS/database/swagger configuration
├── common/                 # Globally reusable building blocks (constants, exceptions, utils, scripts)
├── database/
│   ├── data-source.ts      # TypeORM DataSource
│   ├── migrations/
│   └── seeds/
├── middlewares/            # Shared Express middleware: auth, error handling, security
├── modules/                # All business features live here
│   ├── admin/
│   ├── auction/
│   ├── auth/
│   ├── category/
│   ├── chat/
│   ├── common/
│   ├── cron/
│   ├── file/
│   ├── notification/
│   ├── order/
│   ├── product/
│   ├── review/
│   ├── support-chat/
│   └── user/
│       (each module: *.controller.ts, *.service.ts, *.route.ts, *.entity.ts, *.repository.ts, dtos/)
├── schedulers/              # Background cron jobs
├── routes/                  # Top-level route aggregator (src/routes/index.ts)
├── tests/                   # Runnable checks (src/tests/run-checks.ts)
└── types/                   # Shared cross-module types/interfaces
```

## Setup

### Prerequisites
- Node.js 18+
- PostgreSQL 14+
- Redis — required at startup, not optional: refresh tokens, email-verification and
  password-reset tokens live in Redis, so authentication does not work without it
- Cloudflare R2 bucket (file uploads)
- SePay account (bank-transfer top-ups)
- A Gmail account with an App Password (transactional email)

### 1. Clone and install

```bash
git clone <repository-url> bidy-be
cd bidy-be
npm install
cp .env.example .env
```

### 2. PostgreSQL

Create the database, then point `.env` at it:

```bash
createdb bidy_db     # or: psql -U postgres -c "CREATE DATABASE bidy_db;"
```

```bash
POSTGRES_HOST=localhost
POSTGRES_PORT=5432
POSTGRES_USER=postgres
POSTGRES_PASSWORD=postgres
POSTGRES_DB=bidy_db
```

Then create the schema and load reference data:

```bash
npm run migrate    # apply all migrations
npm run seed       # categories and other reference rows
```

### 3. Redis

```bash
docker run -d --name bidy-redis -p 6379:6379 redis:7-alpine
```

```bash
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=          # leave empty for a local instance
```

### 4. JWT secrets

Two **different** secrets are required — the app refuses to boot without both
(`src/modules/auth/auth.service.ts` validates them with Joi at import time). Generate
them rather than inventing strings:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"   # run twice
```

```bash
JWT_SECRET=<first value>
JWT_REFRESH_SECRET=<second value>
# Optional, these have defaults:
JWT_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d
```

### 5. Cloudflare R2 credentials

In the Cloudflare dashboard:

1. **R2** → **Create bucket**. Keep it **private** — do not enable a public
   development URL or a custom domain. Every read is served through a short-lived
   presigned URL (`src/config/r2.config.ts`), so public access would only widen
   exposure without being used.
2. **R2** → **Manage R2 API Tokens** → **Create API token**.
   - Permission: **Object Read & Write**
   - Scope it to the bucket you just created
3. Copy the **Access Key ID** and **Secret Access Key** shown once at creation.
4. The endpoint is on the bucket's settings page as **S3 API**, in the form
   `https://<account_id>.r2.cloudflarestorage.com`. Pass the account-level endpoint
   *without* the bucket name appended.

```bash
ACCESS_KEY_ID=<access key id>
SECRET_ACCESS_KEY=<secret access key>
BUCKET_NAME=<bucket name>
R2_ENDPOINT=https://<account_id>.r2.cloudflarestorage.com
```

### 6. SePay (bank-transfer top-ups)

Top-ups work by giving each user a transfer code; SePay watches the linked bank
account and calls the backend when a matching transfer arrives.

On [sepay.vn](https://sepay.vn):

1. Register, then **link the bank account** that will receive transfers (SePay
   supports MBBank, VietinBank, ACB, BIDV, OCB, VPBank among others). Verification
   is required before webhooks fire.
2. Go to **Tích hợp webhooks** → **Thêm webhook** and register:

   ```
   POST https://<your-public-domain>/api/v1/orders/webhook/sepay
   ```

   Local development needs a tunnel, since SePay must reach the URL from outside:

   ```bash
   ngrok http 8000
   # then register https://<subdomain>.ngrok-free.app/api/v1/orders/webhook/sepay
   ```
3. Choose **one** authentication method on that webhook and put the matching value in
   `.env`. The backend checks the HMAC signature first and only falls back to the API
   key when no secret is set (`src/middlewares/sepay-auth.middleware.ts`):
   - **HMAC-SHA256** (preferred) → `SEPAY_WEBHOOK_SECRET`. SePay must send
     `X-Sepay-Signature` and `X-Sepay-Timestamp`; requests older than 5 minutes are
     rejected as replays.
   - **API Key** → `SEPAY_API_KEY`, sent as `Authorization: Apikey <key>`.
4. Fill in the receiving account so the app can render transfer instructions and QR
   codes:

```bash
SEPAY_BANK_NAME=MBBank
SEPAY_ACCOUNT_NUMBER=<receiving account number>
SEPAY_ACCOUNT_NAME=<account holder name, uppercase, no accents>
SEPAY_PAYMENT_PREFIX=BIDY          # prefix of the per-user transfer code
SEPAY_WEBHOOK_SECRET=<hmac secret>
SEPAY_API_KEY=<api key>
```

> If neither `SEPAY_WEBHOOK_SECRET` nor `SEPAY_API_KEY` is set, the webhook accepts
> **unauthenticated** requests and only logs a warning. That is a convenience for
> local work — never deploy that way, or anyone who finds the URL can credit wallets.

Test the flow without a real bank transfer:

```bash
npm run sepay:simulate
```

### 7. Email

`MAIL_PASSWORD` is a Gmail **App Password**, not the account password. Enable 2-Step
Verification, then create one under Google Account → Security → App passwords.

```bash
MAIL_FROM=your_email@gmail.com
MAIL_PASSWORD=<16-character app password>
```

### 8. URLs and wallet

```bash
PORT=8000
CLIENT_URL=http://localhost:3000       # used in verification/reset links
ALLOWED_ORIGINS=http://localhost:3000  # comma-separated CORS allowlist
PLATFORM_WALLET_ID=1                   # platform wallet row that collects fees
```

### 9. Run

```bash
npm run dev                  # watch mode
npm run build && npm start   # production
npm test                     # runnable checks
```

Verify the server is up at `http://localhost:8000/api-docs`.

## API

All routes are mounted under `/api/v1` (see `src/routes/index.ts`):

- `/api/v1/auth` - Authentication
- `/api/v1/users` - User management
- `/api/v1/categories`, `/api/v1/admin/categories` - Categories
- `/api/v1/admin/users`, `/api/v1/admin/overview`, `/api/v1/admin/support` - Admin
- `/api/v1/auctions` - Auction lifecycle & bidding
- `/api/v1/orders` - Orders
- `/api/v1/notifications` - Notifications
- `/api/v1/chat`, `/api/v1/support-chat` - Chat & support chat
- `/api/v1/reviews` - Reviews
- `/api/v1/files` - File uploads (presigned URLs)
- `/api/v1/time` - Server time
- `/api/v1` - Products

Full interactive documentation: `GET /api-docs` (Swagger UI, generated from JSDoc annotations in each route file).

## Database Migrations

```bash
npm run migrate           # Run pending migrations
npm run migrate:status    # Show migration status
npm run migrate:rollback  # Revert last migration
npm run seed              # Run database seeds
```

## Development

```bash
npm run lint       # Lint src
npm run lint:fix    # Lint and autofix
npm test            # Run checks (src/tests/run-checks.ts)
```

### Conventions
- Follow the existing module structure (`controller` → `service` → `repository`/`entity`, with DTOs in `dtos/`).
- `AuthService` is the reference implementation for module conventions when in doubt.
- Every route/DTO must include a Swagger JSDoc block or it will not appear in `/api-docs`.
- This repo is indexed by [GitNexus](.claude/skills/gitnexus) for code intelligence (impact analysis, call graphs, execution flows) — see `CLAUDE.md`.

## Architecture Notes

### Real-time (Socket.IO)
Real-time bidding, chat, and notifications are delivered over Socket.IO, initialized in `src/server.ts`.

### Security
- Rate limiting (Redis-backed) on all endpoints
- `helmet`-based security headers
- CORS configuration
- JWT token validation
- Input validation via `class-validator` DTOs

---

**Technology Stack**: Node.js, TypeScript, Express, PostgreSQL (TypeORM), Redis, Socket.IO, Cloudflare R2, JWT
