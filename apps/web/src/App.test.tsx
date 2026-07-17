import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, test, vi } from "vitest";
import type { AuthSession, CompanyDetail, CompanyOwner, CompanySummary, ContactDetail, ContactSummary } from "@agency-crm/shared";
import App from "./App";
import { AuthProvider } from "@/lib/auth-context";

type Store = {
  companies: CompanySummary[];
  contacts: ContactSummary[];
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

  test("logs in and lands on the protected companies screen", async () => {
    const user = userEvent.setup();
    renderApp("/login");

    await user.clear(await screen.findByLabelText("Email"));
    await user.type(screen.getByLabelText("Email"), "owner@atlas-digital.test");
    await user.clear(screen.getByLabelText("Password"));
    await user.type(screen.getByLabelText("Password"), "AtlasAdmin123!");
    await user.click(screen.getByRole("button", { name: "Sign in" }));

    expect(await screen.findByRole("heading", { name: "Companies" })).toBeInTheDocument();
    expect(await screen.findByText("Acme Studio")).toBeInTheDocument();
  });

  test("shows authenticated user info in the CRM shell", async () => {
    installApiMock(createStore({ authSession: demoSession }));
    renderApp("/companies");

    expect(await screen.findByRole("heading", { name: "Companies" })).toBeInTheDocument();
    expect(screen.getByText("Atlas Owner")).toBeInTheDocument();
    expect(screen.getByText("Admin")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Log out" })).toBeInTheDocument();
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
