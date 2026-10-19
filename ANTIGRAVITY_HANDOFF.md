# Financial Literacy Portal — Antigravity Handoff

## Product

This is a full-stack personal-finance and financial-literacy portal aimed at Indian users. A signed-in user can record income and expenses, see their financial position, manage savings goals, receive data-grounded guidance, learn from recommended financial-literacy content, and use advanced Smart Finance tools.

## Technology and structure

| Area | Technology | Location |
| --- | --- | --- |
| Web client | React 19, Vite, React Router, Axios, Recharts, Framer Motion, Lucide | `client/` |
| API | Node.js, Express 5 | `server/` |
| Data | MongoDB with Mongoose | `server/models/` |
| Authentication | bcrypt password hashes and 24-hour JWT bearer tokens | `server/controllers/authController.js` |
| AI | Groq via the OpenAI-compatible SDK, with local fallbacks | `server/controllers/aiController.js` |

The frontend is a separate Vite application and calls the Express API using `VITE_API_URL` (default: `http://localhost:5000`). The backend accepts browser origins configured in `CLIENT_URL`.

## Implemented user features

- Registration, login, protected routes, profile editing, and browser-geolocation city detection.
- Transaction CRUD for income and expenses, typed categories, dates, voice-entry flag, and income/expense/balance summary.
- Dashboard charts and financial-health indicators.
- Goals with target, deadline, progress updates, completion, and automatic progress when an expense is entered in the `Savings` category.
- Financial-literacy hub: a starter library plus personalized lessons driven by detected spending patterns.
- AI assistant with friendly, serious, and playful modes. It sends only the supplied account data to Groq and falls back to local rules if the key/service is unavailable.
- Local text/voice command parsing, e.g. an expense sentence into a transaction draft.
- Location-adjusted spending benchmark and a financial dashboard, both calculated locally.
- Smart Finance: what-if scenarios, recurring-expense detection and preference flags, monthly summary, seven-day challenges, and shared-expense splitting.

## Important API groups

All routes except registration/login and `/api/health` require `Authorization: Bearer <token>`.

- `/api/auth` — register, login, profile, profile update, location detection
- `/api/transactions` — CRUD and `/summary`
- `/api/ai` — insights, financial dashboard, chat, voice parsing, benchmark
- `/api/literacy` — all content and personalized recommendations
- `/api/goals` — goal CRUD/progress
- `/api/smart-finance` — scenarios, recurring items, monthly summary, challenges
- `/api/expense-splits` — create and list shared expenses

## Current work state

The working tree deliberately contains substantial uncommitted feature work. It includes the Smart Finance pages/routes/models/services, shared expense splitting, client API configuration, environment examples, expanded transaction editing, profile location support, improved validation/CORS/authentication, and revised local AI/insight logic. Preserve these changes; do not reset or discard them.

The client production build passed on 2026-09-16. The build warns that the main JavaScript bundle is about 807 kB uncompressed; code splitting is a worthwhile future optimization. There is no automated test suite yet.

## Local setup

1. Copy `server/.env.example` to `server/.env` and provide `MONGO_URI`, `JWT_SECRET`, and (optionally) `GROQ_API_KEY`.
2. Copy `client/.env.example` to `client/.env`; use the backend origin without `/api` for `VITE_API_URL`.
3. In separate terminals:

```powershell
cd server; npm install; npm run dev
cd client; npm install; npm run dev
```

Use `npm run build` in `client/` before deployment. Do not commit either `.env` file or API keys. The existing `.gitignore` protects them.

## Suggested next work

1. Add API and component tests, especially authorization/ownership, transaction validation, goal progress, and financial calculations.
2. Address the Vite bundle-size warning with route-level lazy loading or chart/component splitting.
3. Create a deployment configuration: host the API with persistent `MONGO_URI`, set `CLIENT_URL` to the deployed client URL, and set `VITE_API_URL` at client build time.
4. Add rate limiting, security headers, and production-grade request logging before public launch.
5. Review database indexes and pagination once users have many transactions.

## First instruction for an Antigravity agent

```text
Read ANTIGRAVITY_HANDOFF.md and .agents/rules/financial-literacy-portal.md before editing. This is a React/Vite client plus Express/MongoDB API. Keep the current uncommitted work intact, never expose or modify .env secrets, and inspect the relevant client and server flow before implementing changes. Run the smallest relevant verification after each change.
```
