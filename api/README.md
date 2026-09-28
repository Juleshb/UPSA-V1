# RUPSA NEXT API

Node.js + Express + PostgreSQL + Prisma Web API for the RUPSA NEXT PAYMENT platform. It follows the uploaded architecture: a modular, API-first orchestration layer for schools, ledgers, payments, credit and guarantees.

```
api/src/
├── config/        env and secrets
├── middleware/    auth, RBAC, idempotency, request IDs
├── routes/        HTTP v1 endpoints
├── services/      business rules
├── utils/         IDs, money, events, Prisma
├── types/
├── app.ts
└── index.ts
```

The invoice/ledger is the record of what is owed. The payment service records how money arrived. Licensed banks, MFIs and PSPs remain responsible for regulated lending and fund movement.

## Architecture

```
Parent / school finance / admin
        │
   /api/v1  (gateway: auth, RBAC, throttling, idempotency, audit)
        │
PAY forms → orchestration (route, switch, retry, status)
        │
Approved rails: Bank · PSP · Mobile money · Card
        │
Settlement & reconciliation → school ledger → receipt
        │
Event bus: PAYMENT.INITIATED · SUCCESS · FAILED · REFUNDED · SETTLEMENT.COMPLETED
        │
EAC extension: Rwanda (RSwitch) ↔ Tanzania (TIPS) pilot
```

Reference codes: PAY-01 request, PAY-02 instruction, PAY-03 confirmation, PAY-04 receipt, PAY-05 reconciliation, PAY-06 refund, PAY-07 reversal, PAY-08 settlement, PAY-16 EAC payment.

API version 1 is mounted at both `/api/v1` and `/v1`.

## Prerequisites

- Node.js 20+
- Docker (for local PostgreSQL) or an existing Postgres 16 database

## Setup

```bash
cd api
cp .env.example .env
docker compose up -d
npm install
npx prisma migrate dev --name init
npm run db:seed
npm run dev
```

The API listens on `http://localhost:4000`.

## Seeded accounts

| Role | Email | Password |
| --- | --- | --- |
| System administrator | `admin@rupsanext.rw` | `ChangeMe123!` |
| School finance officer | `finance@example.rw` | `ChangeMe123!` |
| Bank credit officer | `credit@bank.rw` | `ChangeMe123!` |
| Parent | `parent@example.rw` | `ChangeMe123!` |

Seeded identifiers match the architecture paper: `RUPSA-SCH-000123`, `RUPSA-STD-000123`, `FI-001`.

## Auth

```bash
curl -s http://localhost:4000/api/v1/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"admin@rupsanext.rw","password":"ChangeMe123!"}'
```

Send on subsequent requests:

```
Authorization: Bearer <access-token>
X-Client-ID: <client-id>
X-Request-ID: <request-id>
X-Correlation-ID: <correlation-id>
Idempotency-Key: <uuid>   # required for payments, disbursements, repayments, guarantees, webhooks
```

## Core v1 routes

| Domain | Methods |
| --- | --- |
| `/auth` | register, login, refresh, me |
| `/family` | guardian home: linked students, invoices, payments, receipts |
| `/schools` | create, list, get, patch, financial profile |
| `/guardians` | create, list, get |
| `/students` | create, list, get, financial summary |
| `/invoices` | create, list, get |
| `/payments` | initiate, list, get |
| `/webhooks/payment` | PSP / bank payment events |
| `/settlements` | create, list |
| `/reconciliation` | list |
| `/consents` | create, list, withdraw |
| `/loan-applications` | create, list, assessment, FI decision |
| `/loans` | get, balance, disbursement, repayment |
| `/guarantees` | request, list + facility exposure, decision, claim |
| `/notifications` | queue, list |
| `/reports/overview` | collections, credit book, guarantee exposure |

## Payment webhook

```bash
curl -s http://localhost:4000/api/v1/webhooks/payment \
  -H 'Content-Type: application/json' \
  -H 'Idempotency-Key: 6d7b2c1e-7f40-4e8e-a5d1-123456789abc' \
  -d '{
    "event":"PAYMENT.SUCCESS",
    "eventId":"EVT-000123",
    "paymentId":"RUPSA-PAY-000790",
    "invoiceId":"RUPSA-INV-000457",
    "amount":100000,
    "currency":"RWF",
    "transactionReference":"BANK-REF-123456",
    "timestamp":"2026-09-21T10:30:00Z"
  }'
```

In production the handler also requires `X-Webhook-Signature` (HMAC-SHA256 of the JSON body using `WEBHOOK_SECRET`) and rejects timestamps outside a 15-minute replay window.
