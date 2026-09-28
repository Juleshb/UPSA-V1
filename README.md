# RUPSA NEXT

School payments, financing and guarantee platform for RUPSA member schools in Rwanda.

```
rupsa-pay-1/
├── web/          React site and API sandbox
├── mobile/       React Native app for parents and guardians
└── api/          Node.js + Express + Prisma Web API
```

## Web

```bash
cd web
npm install
npm run dev
```

The site proxies `/api` and `/health` to the API on port 4000. Open the developer console at `/developers`.

## API

```bash
cd api
cp .env.example .env
npm install
npx prisma migrate dev
npm run db:seed
npm run dev
```

The API listens on `http://localhost:4000`. Seeded accounts and route notes are in `api/README.md`.

```
api/src/
├── config/       environment
├── middleware/   auth, idempotency, errors
├── routes/       HTTP v1 wiring
├── services/     school, ledger, payment, loan, guarantee
├── utils/        IDs, money, events, Prisma
└── types/
```

## Parent app

React Native (Expo) app for the parent and guardian role. It signs in against the API and shows only students linked to that guardian.

```bash
cd mobile
npm install
npx expo start
```

The sandbox parent is `parent@example.rw` / `ChangeMe123!`. The API must be running on port 4000. On a phone, Expo uses your computer’s LAN address for the API. Override it with `EXPO_PUBLIC_API_URL` when that address is wrong.

From the repo root:

```bash
npm run dev:web
npm run dev:api
npm run dev:mobile
```
