# Project Roadmap

This file tracks future work, review findings, and technical debt for the Pakaja Dashboard.

Use this file as the single roadmap for future updates:
- Add new findings under the right priority bucket.
- Keep each item as a checkbox.
- Mark the checkbox when the work is complete.
- Preserve core functionality while improving security, reliability, performance, and maintainability.

## Priority Guide

- `P0`: Critical production or security risk
- `P1`: High-impact operational or access-control issue
- `P2`: Maintainability, performance, or reliability improvement
- `P3`: UX, accessibility, or documentation polish

## Active Roadmap

### P0 Critical

- [ ] Move authentication off the client and validate access codes server-side. The app currently loads the full `users` dataset before login and checks codes in the browser, which is too risky for a public Coolify deployment.
- [ ] Remove the offline seeded-admin fallback from production auth paths. A broken Supabase configuration should not degrade into an `admin` login path.
- [ ] Protect the Express helper endpoints with authentication and tighter CORS. The Gemini and Bunny helper routes should not be callable anonymously from the public internet.

### P1 High

- [ ] Remove Coolify API tokens from browser-managed settings. Deployment credentials should not be stored in client state or localStorage, and Coolify actions should move behind a trusted server-side path.
- [ ] Fix ledger route authorization so role checks are actually enforced. `ProtectedRoute` should support role-based access if routes depend on it.
- [ ] Reduce the amount of data loaded during app bootstrap and revisit the single large realtime subscription strategy. Orders, customers, attendance, ledger, and related domains should not all be eagerly loaded forever as the dataset grows.

### P2 Medium

- [ ] Break up `StoreContext` into smaller domain-focused providers, hooks, or services. Inventory, orders, attendance, ledger, settings, and customer logic should not all live in one giant provider.
- [ ] Stop `Layout` from causing app-wide rerenders every second for sync status updates. Keep the live status indicator lightweight and isolated from the rest of the shell.
- [ ] Add route-level code splitting and reduce the main bundle size. The current app loads every major page eagerly and the production bundle is already large.
- [ ] Add a real quality gate for future updates: `typecheck`, tests, and CI checks. Also fix the current TypeScript issues so the repo has a reliable baseline.
- [ ] Database Aggregation Migration (The "Infinite Scale" Fix). Carried forward from the original roadmap entry. Priority: `P2`. Date created: `2026-02-27`. Previous status: `Technical Debt`. Previous target date: `2027-06-01`. Transition from client-side transaction calculations to Supabase SQL Views or Edge Functions. This is required before the `transactions` table exceeds `20,000-30,000` records to prevent `localStorage` limits and browser performance degradation. Implementation will involve creating SQL-based aggregate views for stock levels and dashboards.

### P3 Low

- [ ] Sync important screen state with the URL where it improves daily operations. Dashboard filters, Orders views, and other stateful screens should be easier to refresh, bookmark, and share.
- [ ] Improve accessibility on login, navigation, modal controls, and other icon-heavy UI areas. Focus especially on labels, icon-button names, and other keyboard/screen-reader basics.
- [ ] Refresh README and deployment documentation so it matches the current stack, environment variables, charting library, and production setup on Coolify.

## Completed

No roadmap items completed yet.
