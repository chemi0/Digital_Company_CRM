# Work Activities and Tasks Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver a role-aware Work module for activity history and follow-up tasks linked to CRM companies, contacts, and deals.

**Architecture:** Add `Activity` and `Task` Prisma models with organization, company, optional contact/deal, and membership relationships. Create a dedicated protected API router with role-aware scope helpers, then expose typed API helpers and a responsive React Work page using existing shell, query, and form conventions.

**Tech Stack:** PostgreSQL, Prisma, Express, Zod, Vitest, React, React Hook Form, TanStack Query, Tailwind CSS.

---

### Task 1: Persistence and Shared Contracts

**Files:**
- Modify: `apps/api/prisma/schema.prisma`
- Create: `apps/api/prisma/migrations/<timestamp>_add_work_activities_tasks/migration.sql`
- Modify: `apps/api/prisma/seed.ts`
- Modify: `packages/shared/src/index.ts`

- [ ] Add activity/task enums and models with foreign keys, archive fields, and indexes for organization, company, deal, assignee, due date, and completion.
- [ ] Generate and inspect the migration with `npm run db:migrate --workspace @agency-crm/api -- --name add_work_activities_tasks`.
- [ ] Add deterministic activity/task seed records for the demo accounts.
- [ ] Add frontend-safe shared unions and response/form types.

### Task 2: Secured Work API (TDD)

**Files:**
- Create: `apps/api/src/work-api.test.ts`
- Create: `apps/api/src/routes/work-routes.ts`
- Modify: `apps/api/src/app.ts`

- [ ] Write failing integration tests for role-filtered lists, activity creation, task creation, completion, leadership reassignment, cross-company link rejection, and archive behavior.
- [ ] Run `npm test --workspace @agency-crm/api -- src/work-api.test.ts` and confirm route-missing failures.
- [ ] Implement protected `activities` and `tasks` CRUD/action endpoints with server-side organization and ownership checks.
- [ ] Re-run targeted tests until green.

### Task 3: Work Interface (TDD)

**Files:**
- Create: `apps/web/src/components/activity-form.tsx`
- Create: `apps/web/src/components/task-form.tsx`
- Modify: `apps/web/src/lib/crm-api.ts`
- Modify: `apps/web/src/components/crm-shell.tsx`
- Modify: `apps/web/src/App.tsx`
- Modify: `apps/web/src/App.test.tsx`

- [ ] Add failing frontend tests for the Work page, task creation/completion, and activity creation.
- [ ] Add typed API helpers and forms with client-side validation.
- [ ] Add `/work` route, activity feed, assigned-task list, and only context-valid company/contact/deal selectors.
- [ ] Add compact related-work sections to company and deal detail pages.
- [ ] Re-run `npm test --workspace @agency-crm/web` until green.

### Task 4: Verification

**Files:**
- Verify only

- [ ] Run `npx prisma validate --schema apps/api/prisma/schema.prisma`.
- [ ] Run `npm run db:seed --workspace @agency-crm/api`.
- [ ] Run the full backend and frontend test suites.
- [ ] Run `npm run build`.
- [ ] Manually verify admin, manager, and sales-rep scopes in the local app.
