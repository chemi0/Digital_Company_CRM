import type {
  CompanyDetail,
  CompanyFormValues,
  CompanySummary,
  ContactDetail,
  ContactFormValues,
  ContactSummary,
} from "@agency-crm/shared";

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:4000";
const organizationSlug = "atlas-digital";

function buildApiPath(path: string) {
  return `${apiBaseUrl}/api/organizations/${organizationSlug}${path}`;
}

async function apiRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(buildApiPath(path), {
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
    ...init,
  });

  const payload = (await response.json()) as { data?: T; error?: string };

  if (!response.ok || payload.data === undefined) {
    throw new Error(payload.error ?? "Request failed");
  }

  return payload.data;
}

export function listCompanies() {
  return apiRequest<CompanySummary[]>("/companies");
}

export function getCompany(companyId: string) {
  return apiRequest<CompanyDetail>(`/companies/${companyId}`);
}

export function createCompany(values: CompanyFormValues) {
  return apiRequest<CompanySummary>("/companies", {
    method: "POST",
    body: JSON.stringify(values),
  });
}

export function updateCompany(companyId: string, values: CompanyFormValues) {
  return apiRequest<CompanySummary>(`/companies/${companyId}`, {
    method: "PATCH",
    body: JSON.stringify(values),
  });
}

export function listContacts() {
  return apiRequest<ContactSummary[]>("/contacts");
}

export function getContact(contactId: string) {
  return apiRequest<ContactDetail>(`/contacts/${contactId}`);
}

export function createContact(values: ContactFormValues) {
  return apiRequest<ContactSummary>("/contacts", {
    method: "POST",
    body: JSON.stringify(values),
  });
}

export function updateContact(contactId: string, values: ContactFormValues) {
  return apiRequest<ContactSummary>(`/contacts/${contactId}`, {
    method: "PATCH",
    body: JSON.stringify(values),
  });
}

export function archiveContact(contactId: string) {
  return apiRequest<{ id: string; archived: boolean }>(`/contacts/${contactId}`, {
    method: "DELETE",
  });
}
