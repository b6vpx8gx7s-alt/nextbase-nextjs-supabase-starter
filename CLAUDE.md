# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Monorepo structure

Turborepo with three apps:

- `apps/web` — Nutrition plans SaaS (Next.js, port 3000)
- `apps/fisioterapia` — Physiotherapy management tool (Next.js, port 3001)
- `apps/database` — Supabase migrations only; no runnable app

Both `web` and `fisioterapia` share the **same Supabase project** as the `reservaya` app (RODA booking platform at `/Users/andresorellanotrujillo/reservaya`). That means tables from RODA (e.g., `customers`, `businesses`, `profiles`) are directly accessible from either app without cross-API calls.

## Commands

```bash
# Root — run all apps in dev
pnpm dev

# Individual apps
pnpm --filter fisioterapia dev     # port 3001
pnpm --filter web dev              # port 3000

# Typecheck / lint
pnpm --filter fisioterapia typecheck
pnpm --filter fisioterapia lint    # uses oxlint

# Supabase — apply migrations (from apps/database/)
cd apps/database && supabase db push

# Regenerate Supabase types (from apps/fisioterapia/)
pnpm --filter fisioterapia generate:types
```

## Fisioterapia app architecture

**Route layout** (`src/app/`):
- `(auth)/login` — auth gate
- `(app)/dashboard` — stats landing
- `(app)/pacientes` — patient list; `[id]` detail; `new` — multi-step wizard
- `api/fisio/*` — all API routes

**API pattern** (`src/app/api/fisio/`):
- Every route imports from `_helpers.ts` via `getClientAndContext()` to obtain the authenticated `UserContext` (`userId`, `businessId`, `role`).
- Mutations use `createFisioAdminClient()` (service-role, bypasses RLS) **after** identity is validated with `getClientAndContext()`. Never use the admin client without that check.
- All rows are scoped by `business_id` — filter manually when using the admin client since RLS is bypassed.

**Database tables introduced by this app** (migrations in `apps/database/supabase/migrations/`):
- `physio_clients` — patients, scoped to `business_id`
- `pathologies`, `pain_map` — patient clinical data
- `physio_routines`, `physio_routine_exercises` — AI-generated or manual routines
- `exercises`, `exercise_zones`, `exercise_restrictions`, `zone_aliases` — exercise catalogue
- `measurement_types`, `patient_measurements`, `physio_goals` — clinical history

**Cross-database references** (same Supabase project, from RODA):
- `businesses(id)` — every table references this as tenant key
- `customers(id)` — RODA clients; `physio_clients.roda_customer_id` links a patient to a RODA customer
- `profiles` — used by `getClientAndContext()` to resolve `business_id` from `auth.uid()`

## Migration conventions

Migration files live in `apps/database/supabase/migrations/` and are named `YYYYMMDDHHMMSS_description.sql`. After creating a migration, run `supabase db push` from `apps/database/`. To regenerate TypeScript types after schema changes, run `generate:types` from `apps/fisioterapia/`.

## NewClientForm wizard

`src/components/fisio/NewClientForm.tsx` is a multi-step client component. Steps are typed as a union (`type Step = ...`) and the current step drives what renders. The progress bar and navigation buttons are derived from the `steps` array index. Adding a new step means: (1) add the literal to the `Step` union, (2) add it to the `steps` array, (3) render the step's UI in the JSX block, (4) handle any pre-validation in the "Siguiente" onClick.
