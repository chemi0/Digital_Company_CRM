import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, test, vi } from "vitest";
import type {
  AuthSession,
  CompanyDetail,
  CompanyOwner,
  CompanySummary,
  ContactDetail,
  ContactSummary,
  DealDetail,
  DealSummary,
  ActivitySummary,
  TaskSummary,
  TeamMember,
  InvitationSummary,
} from "@agency-crm/shared";
import App from "./App";
import { AuthProvider } from "@/lib/auth-context";

type Store = {
  companies: CompanySummary[];
  contacts: ContactSummary[];
  deals: DealSummary[];
  activities: ActivitySummary[];
  tasks: TaskSummary[];
  team: TeamMember[];
  inactiveTeam: TeamMember[];
  invitations: InvitationSummary[];
  auditEvents: Array<{
    id: string;
    action: string;
    subjectType: string | null;
    subjectId: string | null;
    metadata: Record<string, unknown> | null;
    createdAt: string;
    actor: { id: string; firstName: string; lastName: string; email: string } | null;
  }>;
  authSession: AuthSession | null;
  allowRefresh: boolean;
};

const organizationSlug = "atlas-digital";

const demoSession: AuthSession = {
  id: "user-1",
  email: "owner@atlas-digital.test",
  firstName: "Atlas",
  lastName: "Owner",
  lastLoginAt: new Date().toISOString(),
  sessionId: "session-1",
  organization: {
    id: "org-1",
    slug: organizationSlug,
    name: "Atlas Digital",
  },
  membership: {
    id: "membership-1",
    role: "admin",
  },
};

const ownerOptions: CompanyOwner[] = [
  {
    id: "membership-1",
    role: "admin",
    user: {
      id: "user-1",
      firstName: "Atlas",
      lastName: "Owner",
      email: "owner@atlas-digital.test",
    },
  },
  {
    id: "membership-manager",
    role: "manager",
    user: {
      id: "user-manager",
      firstName: "Maya",
      lastName: "Manager",
      email: "manager@atlas-digital.test",
    },
  },
  {
    id: "membership-sales",
    role: "sales_rep",
    user: {
      id: "user-sales",
      firstName: "Sam",
      lastName: "Sales",
      email: "sales@atlas-digital.test",
    },
  },
];

function createStore(overrides?: Partial<Store>): Store {
  return {
    companies: [
      {
        id: "company-1",
        organizationId: "org-1",
        ownerMembershipId: "membership-1",
        name: "Acme Studio",
        status: "lead",
        website: "https://acme.example",
        industry: "Design",
        phone: "+381 11 555 0101",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        contactCount: 1,
        owner: ownerOptions[0],
      },
    ],
    contacts: [
      {
        id: "contact-1",
        organizationId: "org-1",
        companyId: "company-1",
        firstName: "Ana",
        lastName: "Markovic",
        email: "ana@acme.example",
        phone: "+381 64 555 0101",
        jobTitle: "Marketing Lead",
        isPrimary: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        company: {
          id: "company-1",
          name: "Acme Studio",
        },
      },
    ],
    deals: [
      {
        id: "deal-1",
        organizationId: "org-1",
        companyId: "company-1",
        primaryContactId: "contact-1",
        ownerMembershipId: "membership-1",
        title: "Website support retainer",
        stage: "proposal_sent",
        amountCents: 180000,
        currency: "EUR",
        source: "Referral",
        expectedCloseDate: "2026-08-15T00:00:00.000Z",
        description: "Monthly website support.",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        owner: ownerOptions[0],
        company: { id: "company-1", name: "Acme Studio" },
        primaryContact: {
          id: "contact-1",
          firstName: "Ana",
          lastName: "Markovic",
          email: "ana@acme.example",
        },
      },
    ],
    activities: [
      {
        id: "activity-1", organizationId: "org-1", companyId: "company-1", contactId: "contact-1", dealId: "deal-1",
        type: "call", subject: "Discovery call completed", body: "Discussed the delivery timeline.", occurredAt: "2026-07-17T10:00:00.000Z",
        createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), author: ownerOptions[0],
        company: { id: "company-1", name: "Acme Studio" }, contact: { id: "contact-1", firstName: "Ana", lastName: "Markovic" }, deal: { id: "deal-1", title: "Website support retainer" },
      },
    ],
    tasks: [
      {
        id: "task-1", organizationId: "org-1", companyId: "company-1", contactId: "contact-1", dealId: "deal-1",
        assigneeMembershipId: "membership-1", createdByMembershipId: "membership-manager", title: "Send proposal recap", description: "Confirm the monthly delivery plan.", priority: "high", dueAt: "2026-07-22T00:00:00.000Z", completedAt: null,
        createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), assignee: ownerOptions[0], createdBy: ownerOptions[1],
        company: { id: "company-1", name: "Acme Studio" }, contact: { id: "contact-1", firstName: "Ana", lastName: "Markovic" }, deal: { id: "deal-1", title: "Website support retainer" },
      },
    ],
    team: ownerOptions.map((owner) => ({
      id: owner.id,
      role: owner.role,
      createdAt: new Date().toISOString(),
      archivedAt: null,
      requiresReactivationInvitation: false,
      user: { ...owner.user, isActive: true, lastLoginAt: new Date().toISOString() },
    })),
    inactiveTeam: [],
    invitations: [],
    auditEvents: [
      {
        id: "audit-1",
        action: "auth.password_changed",
        subjectType: "user",
        subjectId: "user-1",
        metadata: null,
        createdAt: new Date().toISOString(),
        actor: { id: "user-1", firstName: "Atlas", lastName: "Owner", email: "owner@atlas-digital.test" },
      },
    ],
    authSession: null,
    allowRefresh: false,
    ...overrides,
  };
}

function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify({ data }), {
    status,
    headers: {
      "Content-Type": "application/json",
    },
  });
}

function errorResponse(error: string, status: number) {
  return new Response(JSON.stringify({ error }), {
    status,
    headers: {
      "Content-Type": "application/json",
    },
  });
}

function toCompanyDetail(store: Store, companyId: string): CompanyDetail | null {
  const company = store.companies.find((item) => item.id === companyId);

  if (!company) {
    return null;
  }

  return {
    ...company,
    contacts: store.contacts
      .filter((contact) => contact.companyId === company.id)
      .map((contact) => ({
        id: contact.id,
        organizationId: contact.organizationId,
        companyId: contact.companyId,
        firstName: contact.firstName,
        lastName: contact.lastName,
        email: contact.email,
        phone: contact.phone,
        jobTitle: contact.jobTitle,
        isPrimary: contact.isPrimary,
        createdAt: contact.createdAt,
        updatedAt: contact.updatedAt,
      })),
  };
}

function toContactDetail(store: Store, contactId: string): ContactDetail | null {
  const contact = store.contacts.find((item) => item.id === contactId);

  if (!contact) {
    return null;
  }

  return contact;
}

function toDealDetail(store: Store, dealId: string): DealDetail | null {
  return store.deals.find((item) => item.id === dealId) ?? null;
}

function installApiMock(store: Store) {
  globalThis.fetch = vi.fn(async (input, init) => {
    const url = new URL(typeof input === "string" ? input : input.toString(), "http://localhost");
    const method = init?.method?.toUpperCase() ?? "GET";
    const body = init?.body ? JSON.parse(String(init.body)) : null;
    const path = url.pathname;

    if (path === "/api/auth/me" && method === "GET") {
      if (!store.authSession) {
        return errorResponse("Authentication required", 401);
      }

      return jsonResponse(store.authSession);
    }

    if (path === "/api/auth/invitation-preview" && method === "GET") {
      return jsonResponse({ mode: "reactivation", organizationName: "Atlas Digital" });
    }

    if (path === "/api/auth/login" && method === "POST") {
      if (body.email === "owner@atlas-digital.test" && body.password === "AtlasAdmin123!") {
        store.authSession = {
          ...demoSession,
          sessionId: `session-${Date.now()}`,
        };
        return jsonResponse(store.authSession);
      }

      return errorResponse("Invalid email or password", 401);
    }

    if (path === "/api/auth/forgot-password" && method === "POST") {
      return jsonResponse({ requested: true });
    }

    if (path === "/api/auth/reset-password" && method === "POST") {
      return jsonResponse({ passwordReset: true });
    }

    if (path === "/api/auth/change-password" && method === "POST") {
      return jsonResponse({ passwordChanged: true });
    }

    if (path === "/api/auth/refresh" && method === "POST") {
      if (!store.allowRefresh) {
        return errorResponse("Refresh token required", 401);
      }

      store.authSession = {
        ...demoSession,
        sessionId: `session-${Date.now()}`,
      };

      return jsonResponse(store.authSession);
    }

    if (path === "/api/auth/logout" && method === "POST") {
      store.authSession = null;
      store.allowRefresh = false;
      return jsonResponse({ loggedOut: true });
    }

    if (!store.authSession) {
      return errorResponse("Authentication required", 401);
    }

    if (path === `/api/organizations/${organizationSlug}/search` && method === "GET") {
      const query = (url.searchParams.get("q") ?? "").toLowerCase();
      return jsonResponse({
        companies: store.companies
          .filter((company) => company.name.toLowerCase().includes(query))
          .map((company) => ({ id: company.id, name: company.name, status: company.status })),
        contacts: store.contacts
          .filter((contact) => `${contact.firstName} ${contact.lastName} ${contact.email ?? ""}`.toLowerCase().includes(query))
          .map((contact) => ({ id: contact.id, firstName: contact.firstName, lastName: contact.lastName, email: contact.email, company: contact.company })),
        deals: store.deals
          .filter((deal) => `${deal.title} ${deal.source ?? ""}`.toLowerCase().includes(query))
          .map((deal) => ({ id: deal.id, title: deal.title, stage: deal.stage, company: deal.company })),
      });
    }

    if (path === `/api/organizations/${organizationSlug}/companies` && method === "GET") {
      const companies = store.companies.map((company) => ({
        ...company,
        contactCount: store.contacts.filter((contact) => contact.companyId === company.id).length,
      }));

      return jsonResponse(companies);
    }

    if (path === `/api/organizations/${organizationSlug}/memberships` && method === "GET") {
      if (store.authSession.membership.role === "sales_rep") {
        return errorResponse("Leadership access required", 403);
      }

      return jsonResponse(ownerOptions);
    }

    if (path === `/api/organizations/${organizationSlug}/contacts` && method === "GET") {
      return jsonResponse(store.contacts);
    }

    if (path === `/api/organizations/${organizationSlug}/deals` && method === "GET") {
      return jsonResponse(store.deals);
    }

    if (path === `/api/organizations/${organizationSlug}/activities` && method === "GET") {
      return jsonResponse(store.activities);
    }

    if (path === `/api/organizations/${organizationSlug}/tasks` && method === "GET") {
      return jsonResponse(store.tasks.filter((task) => task.completedAt === null));
    }

    if (path === `/api/organizations/${organizationSlug}/team` && method === "GET") {
      return jsonResponse(store.team);
    }

    if (path === `/api/organizations/${organizationSlug}/team/inactive` && method === "GET") {
      return jsonResponse(store.inactiveTeam);
    }

    if (path === `/api/organizations/${organizationSlug}/invitations` && method === "GET") {
      return jsonResponse(store.invitations);
    }

    if (path === `/api/organizations/${organizationSlug}/audit-log` && method === "GET") {
      const page = Number(url.searchParams.get("page") ?? "1");
      const pageSize = 10;
      return new Response(JSON.stringify({
        data: store.auditEvents.slice((page - 1) * pageSize, page * pageSize),
        pagination: {
          page,
          pageSize,
          totalItems: store.auditEvents.length,
          totalPages: Math.max(1, Math.ceil(store.auditEvents.length / pageSize)),
        },
      }), { headers: { "Content-Type": "application/json" } });
    }

    if (path === `/api/organizations/${organizationSlug}/dashboard` && method === "GET") {
      return jsonResponse({
        scope: "organization",
        metrics: { pipelineValueCents: 180000, wonValueCents: 0, activeClients: 1, leads: 1, overdueTasks: 0, dueSoonTasks: 1 },
        dealStages: [{ stage: "proposal_sent", count: 1, valueCents: 180000 }],
        upcomingTasks: store.tasks.map((task) => ({ id: task.id, title: task.title, priority: task.priority, dueAt: task.dueAt, company: task.company })),
        recentActivities: store.activities.map((activity) => ({ id: activity.id, type: activity.type, subject: activity.subject, occurredAt: activity.occurredAt, company: activity.company })),
      });
    }

    if (path === `/api/organizations/${organizationSlug}/companies` && method === "POST") {
      const owner = ownerOptions.find((option) => option.id === (body.ownerMembershipId ?? store.authSession?.membership.id));

      if (!owner) {
        return errorResponse("Invalid owner", 400);
      }

      const company: CompanySummary = {
        id: `company-${store.companies.length + 1}`,
        organizationId: "org-1",
        ownerMembershipId: owner.id,
        name: body.name,
        status: body.status,
        website: body.website ?? null,
        industry: body.industry ?? null,
        phone: body.phone ?? null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        contactCount: 0,
        owner,
      };

      store.companies.push(company);
      return jsonResponse(company, 201);
    }

    if (path === `/api/organizations/${organizationSlug}/contacts` && method === "POST") {
      const company = store.companies.find((item) => item.id === body.companyId);

      if (!company) {
        return errorResponse("Not found", 404);
      }

      const contact: ContactSummary = {
        id: `contact-${store.contacts.length + 1}`,
        organizationId: "org-1",
        companyId: company.id,
        firstName: body.firstName,
        lastName: body.lastName,
        email: body.email ?? null,
        phone: body.phone ?? null,
        jobTitle: body.jobTitle ?? null,
        isPrimary: Boolean(body.isPrimary),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        company: {
          id: company.id,
          name: company.name,
        },
      };

      store.contacts.push(contact);
      return jsonResponse(contact, 201);
    }

    if (path === `/api/organizations/${organizationSlug}/deals` && method === "POST") {
      const company = store.companies.find((item) => item.id === body.companyId);
      const contact = store.contacts.find((item) => item.id === body.primaryContactId && item.companyId === body.companyId);
      const owner = ownerOptions.find((option) => option.id === (body.ownerMembershipId ?? company?.ownerMembershipId));

      if (!company || !owner) {
        return errorResponse("Not found", 404);
      }

      const deal: DealSummary = {
        id: `deal-${store.deals.length + 1}`,
        organizationId: "org-1",
        companyId: company.id,
        primaryContactId: contact?.id ?? null,
        ownerMembershipId: owner.id,
        title: body.title,
        stage: body.stage,
        amountCents: body.amountCents,
        currency: body.currency,
        source: body.source ?? null,
        expectedCloseDate: body.expectedCloseDate ? `${body.expectedCloseDate}T00:00:00.000Z` : null,
        description: body.description ?? null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        owner,
        company: { id: company.id, name: company.name },
        primaryContact: contact
          ? { id: contact.id, firstName: contact.firstName, lastName: contact.lastName, email: contact.email }
          : null,
      };

      store.deals.push(deal);
      return jsonResponse(deal, 201);
    }

    if (path === `/api/organizations/${organizationSlug}/activities` && method === "POST") {
      const company = store.companies.find((item) => item.id === body.companyId);
      const contact = store.contacts.find((item) => item.id === body.contactId);
      const deal = store.deals.find((item) => item.id === body.dealId);
      if (!company) return errorResponse("Not found", 404);
      const activity: ActivitySummary = {
        id: `activity-${store.activities.length + 1}`, organizationId: "org-1", companyId: company.id, contactId: contact?.id ?? null, dealId: deal?.id ?? null,
        type: body.type, subject: body.subject, body: body.body ?? null, occurredAt: new Date().toISOString(), createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
        author: ownerOptions.find((owner) => owner.id === store.authSession?.membership.id) ?? ownerOptions[0], company: { id: company.id, name: company.name },
        contact: contact ? { id: contact.id, firstName: contact.firstName, lastName: contact.lastName } : null, deal: deal ? { id: deal.id, title: deal.title } : null,
      };
      store.activities.unshift(activity);
      return jsonResponse(activity, 201);
    }

    if (path === `/api/organizations/${organizationSlug}/tasks` && method === "POST") {
      const company = store.companies.find((item) => item.id === body.companyId);
      const contact = store.contacts.find((item) => item.id === body.contactId);
      const deal = store.deals.find((item) => item.id === body.dealId);
      const assignee = ownerOptions.find((owner) => owner.id === (body.assigneeMembershipId ?? store.authSession?.membership.id));
      if (!company || !assignee) return errorResponse("Not found", 404);
      const task: TaskSummary = {
        id: `task-${store.tasks.length + 1}`, organizationId: "org-1", companyId: company.id, contactId: contact?.id ?? null, dealId: deal?.id ?? null,
        assigneeMembershipId: assignee.id, createdByMembershipId: store.authSession?.membership.id ?? "membership-1", title: body.title, description: body.description ?? null, priority: body.priority,
        dueAt: body.dueAt ? `${body.dueAt}T00:00:00.000Z` : null, completedAt: null, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
        assignee, createdBy: ownerOptions.find((owner) => owner.id === store.authSession?.membership.id) ?? ownerOptions[0], company: { id: company.id, name: company.name },
        contact: contact ? { id: contact.id, firstName: contact.firstName, lastName: contact.lastName } : null, deal: deal ? { id: deal.id, title: deal.title } : null,
      };
      store.tasks.push(task);
      return jsonResponse(task, 201);
    }

    const companyMatch = path.match(new RegExp(`/api/organizations/${organizationSlug}/companies/([^/]+)$`));

    if (companyMatch && method === "GET") {
      const company = toCompanyDetail(store, companyMatch[1]);
      return company ? jsonResponse(company) : errorResponse("Not found", 404);
    }

    if (companyMatch && method === "PATCH") {
      const company = store.companies.find((item) => item.id === companyMatch[1]);

      if (!company) {
        return errorResponse("Not found", 404);
      }

      Object.assign(company, {
        ownerMembershipId: body.ownerMembershipId ?? company.ownerMembershipId,
        name: body.name ?? company.name,
        status: body.status ?? company.status,
        website: body.website ?? company.website,
        industry: body.industry ?? company.industry,
        phone: body.phone ?? company.phone,
        updatedAt: new Date().toISOString(),
      });

      if (body.ownerMembershipId) {
        company.owner = ownerOptions.find((option) => option.id === body.ownerMembershipId) ?? company.owner;
      }

      return jsonResponse(company);
    }

    const contactMatch = path.match(new RegExp(`/api/organizations/${organizationSlug}/contacts/([^/]+)$`));

    if (contactMatch && method === "GET") {
      const contact = toContactDetail(store, contactMatch[1]);
      return contact ? jsonResponse(contact) : errorResponse("Not found", 404);
    }

    if (contactMatch && method === "PATCH") {
      const contact = store.contacts.find((item) => item.id === contactMatch[1]);
      const company = store.companies.find((item) => item.id === (body.companyId ?? contact?.companyId));

      if (!contact || !company) {
        return errorResponse("Not found", 404);
      }

      Object.assign(contact, {
        companyId: body.companyId ?? contact.companyId,
        firstName: body.firstName ?? contact.firstName,
        lastName: body.lastName ?? contact.lastName,
        email: body.email ?? contact.email,
        phone: body.phone ?? contact.phone,
        jobTitle: body.jobTitle ?? contact.jobTitle,
        isPrimary: body.isPrimary ?? contact.isPrimary,
        updatedAt: new Date().toISOString(),
        company: {
          id: company.id,
          name: company.name,
        },
      });

      return jsonResponse(contact);
    }

    if (contactMatch && method === "DELETE") {
      store.contacts = store.contacts.filter((item) => item.id !== contactMatch[1]);
      return jsonResponse({ id: contactMatch[1], archived: true });
    }

    const dealMatch = path.match(new RegExp(`/api/organizations/${organizationSlug}/deals/([^/]+)$`));

    if (dealMatch && method === "GET") {
      const deal = toDealDetail(store, dealMatch[1]);
      return deal ? jsonResponse(deal) : errorResponse("Not found", 404);
    }

    if (dealMatch && method === "PATCH") {
      const deal = store.deals.find((item) => item.id === dealMatch[1]);
      const company = store.companies.find((item) => item.id === (body.companyId ?? deal?.companyId));
      const contact = store.contacts.find((item) => item.id === (body.primaryContactId ?? deal?.primaryContactId));
      const owner = ownerOptions.find((option) => option.id === (body.ownerMembershipId ?? deal?.ownerMembershipId));

      if (!deal || !company || !owner) {
        return errorResponse("Not found", 404);
      }

      Object.assign(deal, {
        companyId: company.id,
        primaryContactId: body.primaryContactId === null ? null : contact?.id ?? deal.primaryContactId,
        ownerMembershipId: owner.id,
        title: body.title ?? deal.title,
        stage: body.stage ?? deal.stage,
        amountCents: body.amountCents ?? deal.amountCents,
        currency: body.currency ?? deal.currency,
        source: body.source ?? deal.source,
        expectedCloseDate: body.expectedCloseDate === null ? null : body.expectedCloseDate ?? deal.expectedCloseDate,
        description: body.description ?? deal.description,
        updatedAt: new Date().toISOString(),
        owner,
        company: { id: company.id, name: company.name },
        primaryContact: contact
          ? { id: contact.id, firstName: contact.firstName, lastName: contact.lastName, email: contact.email }
          : null,
      });

      return jsonResponse(deal);
    }

    if (dealMatch && method === "DELETE") {
      store.deals = store.deals.filter((item) => item.id !== dealMatch[1]);
      return jsonResponse({ id: dealMatch[1], archived: true });
    }

    const taskMatch = path.match(new RegExp(`/api/organizations/${organizationSlug}/tasks/([^/]+)$`));
    if (taskMatch && method === "PATCH") {
      const task = store.tasks.find((item) => item.id === taskMatch[1]);
      if (!task) return errorResponse("Not found", 404);
      task.completedAt = body.completed ? new Date().toISOString() : task.completedAt;
      return jsonResponse(task);
    }
    if (taskMatch && method === "DELETE") {
      store.tasks = store.tasks.filter((item) => item.id !== taskMatch[1]);
      return jsonResponse({ id: taskMatch[1], archived: true });
    }

    throw new Error(`Unhandled request: ${method} ${path}`);
  }) as typeof fetch;
}

function renderApp(initialEntry: string) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
      mutations: {
        retry: false,
      },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <MemoryRouter initialEntries={[initialEntry]}>
          <App />
        </MemoryRouter>
      </AuthProvider>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  installApiMock(createStore());
});

describe("agency CRM authentication", () => {
  test("redirects unauthenticated users to the login page", async () => {
    renderApp("/companies");

    expect(await screen.findByRole("heading", { name: "Sign in to Atlas Digital" })).toBeInTheDocument();
    expect(screen.getByLabelText("Email")).toHaveValue("owner@atlas-digital.test");
  });

  test("logs in and lands on the protected dashboard", async () => {
    const user = userEvent.setup();
    renderApp("/login");

    await user.clear(await screen.findByLabelText("Email"));
    await user.type(screen.getByLabelText("Email"), "owner@atlas-digital.test");
    await user.clear(screen.getByLabelText("Password"));
    await user.type(screen.getByLabelText("Password"), "AtlasAdmin123!");
    await user.click(screen.getByRole("button", { name: "Sign in" }));

    expect(await screen.findByRole("heading", { name: "Workspace overview" })).toBeInTheDocument();
    expect(await screen.findByText(/Open pipeline/i)).toBeInTheDocument();
  });

  test("shows authenticated user info in the CRM shell", async () => {
    installApiMock(createStore({ authSession: demoSession }));
    renderApp("/companies");

    expect(await screen.findByRole("heading", { name: "Companies" })).toBeInTheDocument();
    expect(screen.getByText("Atlas Owner")).toBeInTheDocument();
    expect(screen.getByText("Admin")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Log out" })).toBeInTheDocument();
  });

  test("shows a role-aware dashboard at the authenticated home route", async () => {
    installApiMock(createStore({ authSession: demoSession }));
    renderApp("/");

    expect(await screen.findByRole("heading", { name: "Workspace overview" })).toBeInTheDocument();
    expect(await screen.findByText(/Open pipeline/i)).toBeInTheDocument();
    expect(screen.getByText("Send proposal recap")).toBeInTheDocument();
  });

  test("searches the CRM and links to a matching record", async () => {
    installApiMock(createStore({ authSession: demoSession }));
    const user = userEvent.setup();
    renderApp("/");

    await screen.findByRole("heading", { name: "Workspace overview" });
    await user.click(screen.getByRole("button", { name: "Search CRM" }));
    await user.type(screen.getByLabelText("Search companies, contacts, and deals"), "Acme");

    await waitFor(() => {
      expect(screen.getByRole("dialog")).toHaveTextContent("Acme Studio");
    });
  });

  test("renders the password recovery request screen", async () => {
    renderApp("/forgot-password");

    expect(await screen.findByRole("heading", { name: "Reset your password" })).toBeInTheDocument();
  });

  test("lets leadership assign a company owner", async () => {
    const managerSession: AuthSession = {
      ...demoSession,
      id: "user-manager",
      email: "manager@atlas-digital.test",
      firstName: "Maya",
      lastName: "Manager",
      membership: {
        id: "membership-manager",
        role: "manager",
      },
    };

    installApiMock(createStore({ authSession: managerSession }));
    renderApp("/companies");

    await screen.findByLabelText("Account owner");
    await waitFor(() => {
      expect(screen.getByRole("combobox", { name: "Account owner" })).toHaveValue("membership-manager");
    });
    expect(screen.getByText("Atlas Owner")).toBeInTheDocument();
  });

  test("does not expose owner assignment to sales reps", async () => {
    const salesSession: AuthSession = {
      ...demoSession,
      id: "user-sales",
      email: "sales@atlas-digital.test",
      firstName: "Sam",
      lastName: "Sales",
      membership: {
        id: "membership-sales",
        role: "sales_rep",
      },
    };
    const salesStore = createStore({ authSession: salesSession });
    salesStore.companies[0].ownerMembershipId = "membership-sales";
    salesStore.companies[0].owner = ownerOptions[2];

    installApiMock(salesStore);
    renderApp("/companies");

    await screen.findByRole("heading", { name: "Companies" });
    expect(screen.queryByLabelText("Account owner")).not.toBeInTheDocument();
  });

  test("renders the pipeline and creates a deal", async () => {
    installApiMock(createStore({ authSession: demoSession }));
    const user = userEvent.setup();
    renderApp("/deals");

    expect(await screen.findByRole("heading", { name: "Deals" })).toBeInTheDocument();
    expect(await screen.findByText("Website support retainer")).toBeInTheDocument();

    await user.type(screen.getByLabelText("Deal title"), "Discovery workshop");
    await user.selectOptions(screen.getByLabelText("Company"), "company-1");
    await user.selectOptions(screen.getByLabelText("Primary contact"), "contact-1");
    await user.clear(screen.getByLabelText("Amount"));
    await user.type(screen.getByLabelText("Amount"), "2500.00");
    await user.click(screen.getByRole("button", { name: "Create deal" }));

    expect(await screen.findByText("Discovery workshop")).toBeInTheDocument();
  });

  test("archives a deal from its detail screen", async () => {
    installApiMock(createStore({ authSession: demoSession }));
    const user = userEvent.setup();
    renderApp("/deals/deal-1");

    expect(await screen.findByRole("heading", { name: "Website support retainer" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Archive deal" }));

    expect(await screen.findByRole("heading", { name: "Deals" })).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.queryByText("Website support retainer")).not.toBeInTheDocument();
    });
  });

  test("renders the authenticated work area", async () => {
    installApiMock(createStore({ authSession: demoSession }));
    const user = userEvent.setup();
    renderApp("/work");

    expect(await screen.findByRole("heading", { name: "My work" })).toBeInTheDocument();
    expect(await screen.findByText("Send proposal recap")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Complete" }));
    await waitFor(() => expect(screen.queryByText("Send proposal recap")).not.toBeInTheDocument());
  });

  test("logs customer activity from the work area", async () => {
    installApiMock(createStore({ authSession: demoSession }));
    const user = userEvent.setup();
    renderApp("/work");

    await screen.findByRole("heading", { name: "My work" });
    await user.selectOptions(screen.getByLabelText("Activity type"), "meeting");
    await user.type(screen.getByLabelText("Subject"), "Kickoff confirmed");
    await user.selectOptions(screen.getAllByLabelText("Company")[1], "company-1");
    await user.click(screen.getByRole("button", { name: "Log activity" }));

    expect(await screen.findByText("Kickoff confirmed")).toBeInTheDocument();
  });

  test("creates a follow-up task from the work area", async () => {
    installApiMock(createStore({ authSession: demoSession }));
    const user = userEvent.setup();
    renderApp("/work");

    await screen.findByRole("heading", { name: "My work" });
    await user.type(screen.getByLabelText("Task"), "Book proposal review");
    await user.selectOptions(screen.getAllByLabelText("Company")[0], "company-1");
    await user.click(screen.getByRole("button", { name: "Create task" }));

    expect(await screen.findByText("Book proposal review")).toBeInTheDocument();
  });

  test("renders the leadership team-management area", async () => {
    installApiMock(createStore({ authSession: demoSession }));
    renderApp("/team");

    expect(await screen.findByRole("heading", { name: "Team" })).toBeInTheDocument();
  });

  test("shows the inactive-member lifecycle area to an admin", async () => {
    installApiMock(createStore({ authSession: demoSession }));
    renderApp("/team");

    expect(await screen.findByText("Inactive members")).toBeInTheDocument();
  });

  test("lets an authenticated user change their password from account settings", async () => {
    installApiMock(createStore({ authSession: demoSession }));
    const user = userEvent.setup();
    renderApp("/settings");

    expect(await screen.findByRole("heading", { name: "Account settings" })).toBeInTheDocument();
    await user.type(screen.getByLabelText("Current password"), "AtlasAdmin123!");
    await user.type(screen.getByLabelText("New password"), "ChangedPassword123!");
    await user.click(screen.getByRole("button", { name: "Update password" }));

    expect(await screen.findByText("Password updated. Other signed-in sessions have been revoked.")).toBeInTheDocument();
  });

  test("shows the admin audit trail", async () => {
    const auditEvents = Array.from({ length: 11 }, (_, index) => ({
      id: `audit-${index + 1}`,
      action: index === 10 ? "auth.login" : "auth.password_changed",
      subjectType: "user",
      subjectId: "user-1",
      metadata: null,
      createdAt: new Date().toISOString(),
      actor: { id: "user-1", firstName: "Atlas", lastName: "Owner", email: "owner@atlas-digital.test" },
    }));
    installApiMock(createStore({ authSession: demoSession, auditEvents }));
    const user = userEvent.setup();
    renderApp("/audit-log");

    expect(await screen.findByRole("heading", { name: "Audit log" })).toBeInTheDocument();
    expect((await screen.findAllByText("Password changed")).length).toBeGreaterThan(0);
    expect(screen.getByText("Page 1 of 2")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Next page" }));
    expect(await screen.findByText("Page 2 of 2")).toBeInTheDocument();
    expect((await screen.findAllByText("Signed in")).length).toBeGreaterThan(1);
  });

  test("shows a returning member a reactivation confirmation instead of account setup", async () => {
    installApiMock(createStore());
    renderApp("/accept-invitation?token=reactivation-token-that-is-long-enough-for-validation");

    expect(await screen.findByRole("heading", { name: "Reactivate your access" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Reactivate access" })).toBeInTheDocument();
    expect(screen.queryByLabelText("Create password")).not.toBeInTheDocument();
  });

  test("logs out and returns to the login screen", async () => {
    installApiMock(createStore({ authSession: demoSession }));
    const user = userEvent.setup();

    renderApp("/companies");

    await screen.findByRole("heading", { name: "Companies" });
    await user.click(screen.getByRole("button", { name: "Log out" }));

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Sign in to Atlas Digital" })).toBeInTheDocument();
    });
  });
});
