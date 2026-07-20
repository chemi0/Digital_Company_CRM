# Agency CRM Functionality Guide

## Project purpose

Agency CRM is a full-stack customer relationship management application for a service business or sales team. It centralizes customer information, deal progress, team access, follow-up work, and operational history in one secure workspace.

The application is built as a modular monolith: one deployable application with clearly separated CRM areas, rather than multiple services that would add unnecessary complexity at this stage.

## Technology stack

- Frontend: React, TypeScript, Vite, React Router, TanStack Query, Tailwind CSS, and shadcn/ui-inspired components.
- Backend: Node.js, Express, TypeScript, Zod validation, bcrypt password hashing, JWT authentication, and Prisma.
- Database: PostgreSQL.
- Email: development console delivery, SMTP providers such as Gmail, or Resend.
- Repository structure: npm workspaces for the web app, API, and shared TypeScript types.

## Authentication and sessions

### Sign in

Users sign in with an email address and password. The API verifies that the user account is active and that the user has an active organization membership before creating a session.

Authentication uses two HttpOnly cookies:

- A short-lived JWT access token authorizes normal API requests.
- A longer-lived refresh token restores access when the access token expires.

Refresh tokens are not stored in plain text. The API stores a hash of each refresh token in the `AuthSession` database table, allowing sessions to be revoked immediately.

### Logout and session revocation

Logging out revokes the server-side refresh session and clears both cookies. Protected API routes also verify that the session is still active in the database, so logout, member deactivation, and password changes take effect immediately rather than waiting for an access token to expire.

### Password recovery

The login screen includes a password recovery flow:

1. A user requests a reset link with their work email.
2. The API returns the same generic response whether or not the email exists, preventing account enumeration.
3. A secure one-time reset token is generated, hashed before storage, and expires after one hour.
4. Resetting a password invalidates every active session for that user.

### Change password

Authenticated users can change their password from **Account settings**. They must provide their current password and choose a new password with at least 12 characters.

Changing a password keeps the current browser session active but revokes all other sessions for that user. This is useful if a user believes a different device may be signed in.

## Security controls

- Passwords are hashed with bcrypt and are never stored in plain text.
- Authentication secrets and database credentials are loaded from environment variables.
- Access and refresh JWTs are stored in HttpOnly cookies rather than browser local storage.
- Sensitive authentication routes are rate-limited to reduce brute-force attacks.
- The API uses Helmet security headers and disables the `X-Powered-By` header.
- JSON request bodies are size-limited.
- State-changing browser requests are checked against the configured frontend origin to reduce cross-site request risks.
- Zod validates incoming request payloads before database operations run.
- All CRM routes are organization-scoped. A user cannot access another organization's URL by changing a route parameter.

## Organizations, users, and roles

Every CRM record belongs to an organization. Users may have memberships in organizations, and the role belongs to the membership rather than directly to the user account.

### Admin

Admins have organization-wide CRM visibility and can:

- Manage team roles.
- Invite admins, managers, and sales reps.
- Deactivate and reactivate team members.
- Send reactivation invitations when required.
- View the organization audit log.

### Manager

Managers have organization-wide CRM visibility and can:

- View companies, contacts, deals, activities, and work across the organization.
- Invite sales reps.
- Assign company owners, deal owners, and task assignees from active team members.

Managers cannot manage administrator access or view the audit log.

### Sales rep

Sales reps work only with records they own or are assigned:

- Companies are limited to companies they own.
- Contacts, deals, activities, and tasks follow the company ownership rules.
- Sales reps cannot assign records to other users, change ownership to another user, or manage the team.
- Their dashboard is limited to their personal pipeline and assigned work.

## Team and invitation management

### Invitations

Leadership users can invite teammates by email. An invitation includes a signed-up account flow and expires after seven days.

The system sends invitations through the configured email provider. For local development this can be a console preview, SMTP such as Gmail, or Resend.

### Invitation acceptance

New teammates create their first name, last name, and password through the invitation link. The invitation can only be accepted once.

### Member deactivation and reactivation

Admins can deactivate a member without deleting their history. Deactivation archives the membership and revokes active sessions.

The reactivation policy has two paths:

- Recently deactivated members can be reactivated directly by an admin.
- Members inactive longer than the configured reactivation window must confirm access again through a reactivation email.

The local reactivation window can be adjusted with `MEMBER_REACTIVATION_WINDOW_MINUTES`. The production intention is a longer retention window, such as one year.

## Companies and contacts

### Companies

The Companies area supports:

- Creating companies with name, lifecycle status, website, industry, phone number, and owner.
- Editing company information and ownership.
- Preventing duplicate company names within the same organization.
- Viewing related contacts, work, and deal context from the company detail page.

Company statuses are:

- Lead
- Active client
- Inactive

### Contacts

Contacts must always belong to a company. The Contacts area supports:

- Creating and editing contacts.
- Capturing name, email, phone, job title, and primary-contact status.
- Viewing the linked company.
- Archiving contacts instead of permanently deleting them.

## Sales pipeline and deals

The Deals area manages revenue opportunities. Each deal belongs to a company and has an owner. A deal can optionally reference a primary contact.

Deal fields include:

- Title
- Pipeline stage
- Amount in cents
- Currency
- Lead source
- Expected close date
- Description
- Company, contact, and owner

Pipeline stages are:

- New lead
- Contacted
- Qualified
- Proposal sent
- Won
- Lost

Deals can be created, edited, and archived. Ownership rules ensure sales reps only work with their own deals while leadership can view the full pipeline.

## Activities and tasks

### Activities

Activities record customer interactions and internal CRM history. Supported activity types are:

- Call
- Email
- Meeting
- Note

An activity can be linked to a company and optionally to a contact and deal. It records the author, subject, optional body, and the time the activity occurred.

### Tasks

Tasks turn follow-up work into trackable actions. A task can be linked to a company and optionally to a contact and deal.

Task features include:

- Priority: low, medium, or high.
- Optional due date.
- Assignee and creator tracking.
- Open and completed status.
- Completion directly from the Work area.
- Archiving when a task is no longer relevant.

The **Work** area shows open tasks, recent activity, and forms for logging activities or creating follow-ups.

## Dashboard and reporting

The authenticated home route is a role-aware CRM dashboard.

### Organization dashboard

Admins and managers see organization-wide:

- Open pipeline value.
- Won revenue.
- Active client and lead counts.
- Overdue and due-soon task counts.
- Deal stages with opportunity counts and values.
- Upcoming open tasks.
- Recent customer activity.

### Personal dashboard

Sales reps see the same dashboard structure, but it is restricted to their owned companies, deals, activities, and assigned work.

## Audit log

Admins can view a paginated organization audit log. It records security and business actions without exposing sensitive data.

Recorded event categories include:

- Sign in, password changes, and password resets.
- Invitations sent, revoked, and accepted.
- Member role changes, deactivation, reactivation, and reactivation confirmation.
- Company, contact, deal, activity, and task creation, updates, and archival.

The audit log shows 10 events per page with Previous and Next controls. The application has no endpoint to edit or delete audit events. Passwords, reset tokens, and activity/note body text are never recorded in audit metadata.

## Data lifecycle rules

The application distinguishes business lifecycle from data retention:

- A company can be inactive without being archived.
- Contacts, deals, tasks, memberships, and other appropriate records use an `archivedAt` timestamp for soft archival.
- Archived records are normally hidden from active CRM lists but preserved for history and auditability.

## Main application routes

| Route | Purpose |
| --- | --- |
| `/` | Role-aware dashboard |
| `/companies` | Company list and creation |
| `/companies/:companyId` | Company detail and editing |
| `/contacts` | Contact list and creation |
| `/contacts/:contactId` | Contact detail, editing, and archival |
| `/deals` | Pipeline list and deal creation |
| `/deals/:dealId` | Deal detail, editing, and archival |
| `/work` | Open tasks, activity history, and follow-up tools |
| `/team` | Team and invitation management for leadership |
| `/audit-log` | Admin-only paginated audit history |
| `/settings` | Authenticated account security settings |
| `/login` | Sign in |
| `/forgot-password` | Password reset request |
| `/reset-password` | Password reset completion |
| `/accept-invitation` | Invitation and reactivation acceptance |

## Current production considerations

The CRM is designed with production-oriented patterns, but these items should be completed before a real public deployment:

- Deploy the frontend, API, and managed PostgreSQL database with production environment variables.
- Set secure cookie options and the final production frontend URL.
- Use a real transactional email provider and verified sender domain.
- Add monitoring, backups, error reporting, and database access controls.
- Add an organization base-currency setting and currency conversion strategy before supporting mixed-currency reporting. The current dashboard reports values in EUR, which matches the existing deal default.
- Add global search, richer filters, exports, and configurable reporting as future CRM enhancements.

