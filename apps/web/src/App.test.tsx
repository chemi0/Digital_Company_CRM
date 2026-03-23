import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, test, vi } from "vitest";
import App from "./App";

type CompanyStatus = "lead" | "active_client" | "inactive";

type Company = {
  id: string;
  organizationId: string;
  name: string;
  status: CompanyStatus;
  website: string | null;
  industry: string | null;
  phone: string | null;
  contactCount: number;
  contacts?: Contact[];
};

type Contact = {
  id: string;
  organizationId: string;
  companyId: string;
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string | null;
  jobTitle: string | null;
  isPrimary: boolean;
  company?: {
    id: string;
    name: string;
  };
};

type Store = {
  companies: Company[];
  contacts: Contact[];
};

const organizationSlug = "atlas-digital";

function createStore(): Store {
  return {
    companies: [
      {
        id: "company-1",
        organizationId: "org-1",
        name: "Acme Studio",
        status: "lead",
        website: "https://acme.example",
        industry: "Design",
        phone: "+381 11 555 0101",
        contactCount: 1,
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
        company: {
          id: "company-1",
          name: "Acme Studio",
        },
      },
    ],
  };
}

function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify({ data }), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function installApiMock(store: Store) {
  globalThis.fetch = vi.fn(async (input, init) => {
    const url = new URL(typeof input === "string" ? input : input.toString(), "http://localhost");
    const method = init?.method?.toUpperCase() ?? "GET";
    const body = init?.body ? JSON.parse(String(init.body)) : null;
    const path = url.pathname;

    if (path === `/api/organizations/${organizationSlug}/companies` && method === "GET") {
      const companies = store.companies.map((company) => ({
        ...company,
        contactCount: store.contacts.filter((contact) => contact.companyId === company.id).length,
      }));

      return jsonResponse(companies);
    }

    if (path === `/api/organizations/${organizationSlug}/contacts` && method === "GET") {
      const contacts = store.contacts
        .filter((contact) => !("archivedAt" in contact))
        .map((contact) => ({
          ...contact,
          company: contact.company ?? {
            id: contact.companyId,
            name: store.companies.find((company) => company.id === contact.companyId)?.name ?? "Unknown",
          },
        }));

      return jsonResponse(contacts);
    }

    if (path === `/api/organizations/${organizationSlug}/companies` && method === "POST") {
      const company: Company = {
        id: `company-${store.companies.length + 1}`,
        organizationId: "org-1",
        name: body.name,
        status: body.status,
        website: body.website ?? null,
        industry: body.industry ?? null,
        phone: body.phone ?? null,
        contactCount: 0,
      };

      store.companies.push(company);
      return jsonResponse(company, 201);
    }

    if (path === `/api/organizations/${organizationSlug}/contacts` && method === "POST") {
      const company = store.companies.find((item) => item.id === body.companyId);
      const contact: Contact = {
        id: `contact-${store.contacts.length + 1}`,
        organizationId: "org-1",
        companyId: body.companyId,
        firstName: body.firstName,
        lastName: body.lastName,
        email: body.email ?? null,
        phone: body.phone ?? null,
        jobTitle: body.jobTitle ?? null,
        isPrimary: Boolean(body.isPrimary),
        company: company ? { id: company.id, name: company.name } : undefined,
      };

      store.contacts.push(contact);
      return jsonResponse(contact, 201);
    }

    const companyMatch = path.match(new RegExp(`/api/organizations/${organizationSlug}/companies/([^/]+)$`));

    if (companyMatch && method === "GET") {
      const company = store.companies.find((item) => item.id === companyMatch[1]);

      if (!company) {
        return new Response(JSON.stringify({ error: "Not found" }), { status: 404 });
      }

      return jsonResponse({
        ...company,
        contacts: store.contacts.filter((contact) => contact.companyId === company.id),
      });
    }

    if (companyMatch && method === "PATCH") {
      const company = store.companies.find((item) => item.id === companyMatch[1]);

      if (!company) {
        return new Response(JSON.stringify({ error: "Not found" }), { status: 404 });
      }

      Object.assign(company, {
        name: body.name ?? company.name,
        status: body.status ?? company.status,
        website: body.website ?? company.website,
        industry: body.industry ?? company.industry,
        phone: body.phone ?? company.phone,
      });

      return jsonResponse(company);
    }

    const contactMatch = path.match(new RegExp(`/api/organizations/${organizationSlug}/contacts/([^/]+)$`));

    if (contactMatch && method === "GET") {
      const contact = store.contacts.find((item) => item.id === contactMatch[1]);

      if (!contact) {
        return new Response(JSON.stringify({ error: "Not found" }), { status: 404 });
      }

      return jsonResponse({
        ...contact,
        company: contact.company ?? {
          id: contact.companyId,
          name: store.companies.find((company) => company.id === contact.companyId)?.name ?? "Unknown",
        },
      });
    }

    if (contactMatch && method === "PATCH") {
      const contact = store.contacts.find((item) => item.id === contactMatch[1]);
      const company = store.companies.find((item) => item.id === (body.companyId ?? contact?.companyId));

      if (!contact || !company) {
        return new Response(JSON.stringify({ error: "Not found" }), { status: 404 });
      }

      Object.assign(contact, {
        companyId: body.companyId ?? contact.companyId,
        firstName: body.firstName ?? contact.firstName,
        lastName: body.lastName ?? contact.lastName,
        email: body.email ?? contact.email,
        phone: body.phone ?? contact.phone,
        jobTitle: body.jobTitle ?? contact.jobTitle,
        isPrimary: body.isPrimary ?? contact.isPrimary,
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
      <MemoryRouter initialEntries={[initialEntry]}>
        <App />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  installApiMock(createStore());
});

describe("agency CRM frontend", () => {
  test("redirects the root route to the companies page", async () => {
    renderApp("/");

    expect(await screen.findByRole("heading", { name: "Companies" })).toBeInTheDocument();
  });

  test("renders companies from the backend API", async () => {
    renderApp("/companies");

    expect(await screen.findByText("Acme Studio")).toBeInTheDocument();
    expect(screen.getByText("Design")).toBeInTheDocument();
    expect(screen.getByText("1 contact")).toBeInTheDocument();
  });

  test("renders contacts from the backend API", async () => {
    renderApp("/contacts");

    expect(await screen.findByText("Ana Markovic")).toBeInTheDocument();
    expect(screen.getAllByText("Acme Studio").length).toBeGreaterThan(0);
    expect(screen.getByText("Marketing Lead")).toBeInTheDocument();
  });

  test("creates a new company from the companies page", async () => {
    const user = userEvent.setup();
    renderApp("/companies");

    await user.type(screen.getByLabelText("Company name"), "Bright Layer");
    await user.selectOptions(screen.getByLabelText("Status"), "active_client");
    await user.type(screen.getByLabelText("Website"), "https://bright-layer.example");
    await user.click(screen.getByRole("button", { name: "Create company" }));

    expect(await screen.findByText("Bright Layer")).toBeInTheDocument();
  });

  test("updates an existing company from the company detail page", async () => {
    const user = userEvent.setup();
    renderApp("/companies/company-1");

    const industryInput = await screen.findByLabelText("Industry");
    await user.clear(industryInput);
    await user.type(industryInput, "Creative Services");
    await user.click(screen.getByRole("button", { name: "Save company" }));

    await waitFor(() => {
      expect(screen.getByDisplayValue("Creative Services")).toBeInTheDocument();
    });
  });

  test("creates and updates a contact from the contacts flows", async () => {
    const user = userEvent.setup();
    renderApp("/contacts");

    await user.type(screen.getByLabelText("First name"), "Luka");
    await user.type(screen.getByLabelText("Last name"), "Petrovic");
    await user.type(screen.getByLabelText("Email"), "luka@example.com");
    await user.type(screen.getByLabelText("Job title"), "Growth Lead");
    await user.selectOptions(screen.getByLabelText("Company"), "company-1");
    await user.click(screen.getByRole("button", { name: "Create contact" }));

    expect(await screen.findByText("Luka Petrovic")).toBeInTheDocument();
  });

  test("updates and archives a contact from the contact detail page", async () => {
    const user = userEvent.setup();
    renderApp("/contacts/contact-1");

    const jobTitleInput = await screen.findByLabelText("Job title");
    await user.clear(jobTitleInput);
    await user.type(jobTitleInput, "Head of QA");
    await user.click(screen.getByRole("button", { name: "Save contact" }));

    await waitFor(() => {
      expect(screen.getByDisplayValue("Head of QA")).toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: "Archive contact" }));

    expect(await screen.findByRole("heading", { name: "Contacts" })).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.queryByText("Ana Markovic")).not.toBeInTheDocument();
    });
  });
});
