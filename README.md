# RUPSA NEXT

A modern payment and education-services experience connecting private schools,
parents and regulated financial institutions. This prototype includes a parent
finance dashboard, school-fee balances, transaction history, responsible
financing promotion and an interactive payment flow.

## Run locally

Install dependencies and start the development server:

```bash
npm install
npm run dev
```

Open the local URL printed by Next.js. To use the project preview port:

```bash
npm run dev -- --hostname 0.0.0.0 --port 43127
```

## Stack

- Next.js and React
- TypeScript
- Tailwind CSS
- shadcn/ui primitives
- Lucide icons

The payment actions are demonstrative and use local UI state; no live payment
processor or customer data is connected.
