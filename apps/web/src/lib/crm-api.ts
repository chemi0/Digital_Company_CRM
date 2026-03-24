import type {
  CompanyDetail,
  CompanyFormValues,
  CompanySummary,
  ContactDetail,
  ContactFormValues,
  ContactSummary,
} from "@agency-crm/shared";
import { requestJson } from "@/lib/api-client";
const organizationSlug = "atlas-digital";

function buildOrgPath(path: string) {
  return `/api/organizations/${organizationSlug}${path}`;
}

export function listCompanies() {
  return requestJson<CompanySummary[]>(buildOrgPath("/companies"));
}

export function getCompany(companyId: string) {
  return requestJson<CompanyDetail>(buildOrgPath(`/companies/${companyId}`));
}

export function createCompany(values: CompanyFormValues) {
  return requestJson<CompanySummary>(buildOrgPath("/companies"), {
    method: "POST",
    body: JSON.stringify(values),
  });
}

export function updateCompany(companyId: string, values: CompanyFormValues) {
  return requestJson<CompanySummary>(buildOrgPath(`/companies/${companyId}`), {
    method: "PATCH",
    body: JSON.stringify(values),
  });
}

export function listContacts() {
  return requestJson<ContactSummary[]>(buildOrgPath("/contacts"));
}

export function getContact(contactId: string) {
  return requestJson<ContactDetail>(buildOrgPath(`/contacts/${contactId}`));
}

export function createContact(values: ContactFormValues) {
  return requestJson<ContactSummary>(buildOrgPath("/contacts"), {
    method: "POST",
    body: JSON.stringify(values),
  });
}

export function updateContact(contactId: string, values: ContactFormValues) {
  return requestJson<ContactSummary>(buildOrgPath(`/contacts/${contactId}`), {
    method: "PATCH",
    body: JSON.stringify(values),
  });
}

export function archiveContact(contactId: string) {
  return requestJson<{ id: string; archived: boolean }>(buildOrgPath(`/contacts/${contactId}`), {
    method: "DELETE",
  });
}
