# Agency CRM

A full-stack customer relationship management application for digital agencies and sales teams. Agency CRM brings company records, contacts, sales opportunities, activities, tasks, and team administration into one organization-scoped workspace.

The project is structured as an npm monorepo with a React frontend, an Express REST API, shared TypeScript contracts, and PostgreSQL persistence through Prisma.

## Features

- Company and contact management with organization-scoped records
- Sales pipeline with deal stages, values, owners, expected close dates, and won/lost outcomes
- Activities for calls, emails, meetings, notes, and status changes
- Assignable tasks with priorities, due dates, completion tracking, and record links
- Admin, manager, and sales representative roles
- Ownership-based access rules for sales representatives
- Team invitations, role changes, deactivation, and controlled reactivation
- Dashboard reporting for pipeline value, deal stages, tasks, and recent activity
- Organization-wide search across CRM records
- Paginated audit history for sensitive and business actions
- Server-side pagination, filtering, and CSV export endpoints for core CRM records
- Responsive authenticated React interface

## Security

- Short-lived JWT access tokens stored in HttpOnly cookies
- Rotating refresh tokens backed by hashed server-side session records
- Password hashing with bcrypt
- Password reset and authenticated password-change flows
- Role-based and ownership-based authorization
- Organization isolation on protected API routes
- Trusted-origin checks, CORS restrictions, Helmet security headers, and request rate limiting
- Invitation and password-reset tokens stored as hashes
- Session revocation on logout, password reset, password change, or account deactivation
- Audit logging for security-sensitive and important business actions

## Technology Stack

| Area | Technologies |
| --- | --- |
| Frontend | React 19, TypeScript, Vite, React Router, TanStack Query |
| Backend | Node.js, Express 5, TypeScript, REST APIs |
| Database | PostgreSQL, Prisma ORM |
| Authentication | JWT, HttpOnly cookies, bcrypt, server-side refresh sessions |
| Email | Console provider, SMTP/Nodemailer, or Resend |
| Testing | Vitest, Testing Library, Supertest |

## Architecture

```text
agency-crm/
|-- apps/
|   |-- api/                 Express API, Prisma schema, migrations, and tests
|   `-- web/                 React application and frontend tests
|-- packages/
|   `-- shared/              Shared frontend-safe TypeScript contracts
|-- package.json             Workspace scripts and dependency orchestration
`-- README.md
```

The application is a modular monolith. Business areas are separated into route modules and supporting services while sharing one deployable API and one PostgreSQL database. This keeps the project straightforward to develop and deploy without sacrificing clear domain boundaries.

Every CRM request is authenticated and resolved within the user's active organization membership. Authorization rules are enforced by the API rather than relying on hidden frontend controls.

## Getting Started

### Prerequisites

- Node.js 24.14.0
- npm 11 or later
- PostgreSQL

### 1. Install dependencies

From the repository root:

```bash
npm install
```

### 2. Configure the API

Create `apps/api/.env` from the included example:

```powershell
Copy-Item apps/api/.env.example apps/api/.env
```

Update at least these values:

```env
DATABASE_URL="postgresql://postgres:your-password@localhost:5432/agency_crm?schema=public"
CLIENT_URL="http://localhost:5173"
JWT_ACCESS_SECRET="replace-with-a-random-secret-at-least-32-characters-long"
JWT_REFRESH_SECRET="replace-with-a-different-random-secret-at-least-32-characters-long"
EMAIL_PROVIDER="console"
```

`EMAIL_PROVIDER=console` prints invitation and password-reset links in the API terminal during local development. SMTP and Resend configuration options are documented in `apps/api/.env.example`.

### 3. Prepare the database

Create a PostgreSQL database named `agency_crm`, then run:

```bash
npm run prisma:generate --workspace @agency-crm/api
npm run db:migrate --workspace @agency-crm/api
npm run db:seed --workspace @agency-crm/api
```

The seed creates the Atlas Digital demo organization and example CRM data.

### 4. Start the application

Run the API:

```bash
npm run dev:api
```

In a second terminal, run the frontend:

```bash
npm run dev:web
```

Open [http://localhost:5173](http://localhost:5173). The API runs at [http://localhost:4000](http://localhost:4000).

## Demo Accounts

| Role | Email | Password |
| --- | --- | --- |
| Admin | `owner@atlas-digital.test` | `AtlasAdmin123!` |
| Manager | `manager@atlas-digital.test` | `AtlasManager123!` |
| Sales representative | `sales@atlas-digital.test` | `AtlasSales123!` |

These credentials are development seed data only and must not be used in production.

## Email Delivery

The API supports three delivery modes:

- `console` for local development without an external mail service
- `smtp` for providers such as Gmail using an app password
- `resend` for production-oriented transactional delivery

Invitation and password-recovery links use `CLIENT_URL`, so deployed environments must set it to the public frontend URL.

## Available Scripts

Run these from the repository root:

| Command | Purpose |
| --- | --- |
| `npm run dev:api` | Start the API in watch mode |
| `npm run dev:web` | Start the Vite development server |
| `npm run build` | Build all workspaces |
| `npm run test` | Run all workspace tests |
| `npm run lint` | Lint workspaces that define a lint script |

Useful API workspace commands:

| Command | Purpose |
| --- | --- |
| `npm run prisma:generate --workspace @agency-crm/api` | Generate Prisma Client |
| `npm run db:migrate --workspace @agency-crm/api` | Apply development migrations |
| `npm run db:seed --workspace @agency-crm/api` | Load demo data |
| `npm run db:studio --workspace @agency-crm/api` | Open Prisma Studio |

## Testing

```bash
npm test
npm run lint
npm run build
```

The API test suite covers authentication, session refresh and revocation, organization boundaries, ownership rules, CRUD operations, team lifecycle behavior, search, dashboards, and audit logging. Frontend tests cover protected routing and key authenticated workflows.

