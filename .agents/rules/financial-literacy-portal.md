# Financial Literacy Portal workspace rule

Apply this rule for all work in this repository.

- Read `ANTIGRAVITY_HANDOFF.md` before making a material change.
- This repository has two independently runnable applications: `client/` (React/Vite) and `server/` (Express/MongoDB). Preserve their API contract and update both sides when a feature crosses the boundary.
- Treat the current uncommitted changes as valuable in-progress work. Never use destructive Git commands or discard unrelated changes.
- Never read, display, commit, or hard-code secrets from `.env`. Use only `.env.example` for configuration guidance.
- All user-specific API data must be protected by the JWT middleware and queried/modified with the authenticated user ID. Validate body data on the server.
- Keep monetary values numeric. Format Indian currency in the UI; do not store display-formatted currency strings.
- AI recommendations must use only supplied user data, remain non-judgmental, and retain the local fallback if the external provider is unavailable.
- After a frontend change, run `npm run build` from `client` when feasible. After backend changes, at minimum perform a targeted syntax/startup or endpoint check when configuration permits.
- Prefer small, scoped changes. Explain any change to environment variables, database schema, authentication, or the public API.
