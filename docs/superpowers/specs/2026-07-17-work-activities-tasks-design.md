# Work Activities and Tasks Design

## Goal

Add a secure CRM work-management slice so teams can record customer interactions and track the follow-up work required to move a company or deal forward.

## Scope

The module contains two organization-scoped resources:

- `Activity`: an interaction record with a type (`call`, `email`, `meeting`, or `note`), subject, optional body, author membership, and occurrence timestamp.
- `Task`: an actionable follow-up with a title, optional description, assignee, creator, priority, due date, completion timestamp, and archive timestamp.

Each record requires a company and may optionally link to a contact and a deal. The API validates that optional records belong to the selected company and organization.

## Access Control

- All routes require an authenticated organization membership.
- Admins and managers can view organization work and reassign tasks.
- Sales reps can only access work tied to companies they own, and can only create tasks assigned to themselves.
- Unauthorized records return `404` to prevent cross-owner data disclosure.
- All incoming fields are validated, and dates are normalized to UTC before persistence.

## User Experience

The existing CRM shell gains a `Work` item. Its page shows an assigned-task list, open/complete state, due date, linked company, and task creation form. It also exposes a recent activity feed and an activity form. Company and deal detail pages show a concise related-work panel and link to the Work area for full management.

The UI uses the project’s existing responsive card layout, typography, controls, and neutral visual language. It introduces no placeholder screens or future-only navigation.

## Non-Goals

- Notifications and reminders
- Recurring tasks
- File uploads
- Email/calendar synchronization
- Activity editing, to preserve accurate interaction history
