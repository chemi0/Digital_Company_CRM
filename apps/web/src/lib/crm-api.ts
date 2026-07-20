import type {
  CompanyDetail,
  CompanyFormValues,
  CompanyOwner,
  CompanySummary,
  ContactDetail,
  ContactFormValues,
  ContactSummary,
  DealDetail,
  DealFormValues,
  DealSummary,
  ActivityFormValues,
  ActivitySummary,
  TaskFormValues,
  TaskSummary,
  TaskUpdateValues,
} from "@agency-crm/shared";
import { requestJson } from "@/lib/api-client";
const organizationSlug = "atlas-digital";

function buildOrgPath(path: string) {
  return `/api/organizations/${organizationSlug}${path}`;
}

export function listCompanies() {
  return requestJson<CompanySummary[]>(buildOrgPath("/companies"));
}

export function listTeamMembers() {
  return requestJson<CompanyOwner[]>(buildOrgPath("/memberships"));
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

export function listDeals() {
  return requestJson<DealSummary[]>(buildOrgPath("/deals"));
}

export function getDeal(dealId: string) {
  return requestJson<DealDetail>(buildOrgPath(`/deals/${dealId}`));
}

export function createDeal(values: DealFormValues) {
  return requestJson<DealSummary>(buildOrgPath("/deals"), {
    method: "POST",
    body: JSON.stringify(values),
  });
}

export function updateDeal(dealId: string, values: DealFormValues) {
  return requestJson<DealSummary>(buildOrgPath(`/deals/${dealId}`), {
    method: "PATCH",
    body: JSON.stringify(values),
  });
}

export function archiveDeal(dealId: string) {
  return requestJson<{ id: string; archived: boolean }>(buildOrgPath(`/deals/${dealId}`), {
    method: "DELETE",
  });
}

type WorkFilters = {
  companyId?: string;
  dealId?: string;
  scope?: "mine" | "all";
  status?: "open" | "completed";
};

function buildQueryPath(path: string, filters?: WorkFilters) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(filters ?? {})) {
    if (value) params.set(key, value);
  }
  const query = params.toString();
  return buildOrgPath(`${path}${query ? `?${query}` : ""}`);
}

export function listActivities(filters?: Pick<WorkFilters, "companyId" | "dealId">) {
  return requestJson<ActivitySummary[]>(buildQueryPath("/activities", filters));
}

export function createActivity(values: ActivityFormValues) {
  return requestJson<ActivitySummary>(buildOrgPath("/activities"), {
    method: "POST",
    body: JSON.stringify(values),
  });
}

export function listTasks(filters?: WorkFilters) {
  return requestJson<TaskSummary[]>(buildQueryPath("/tasks", filters));
}

export function createTask(values: TaskFormValues) {
  return requestJson<TaskSummary>(buildOrgPath("/tasks"), {
    method: "POST",
    body: JSON.stringify(values),
  });
}

export function updateTask(taskId: string, values: TaskUpdateValues) {
  return requestJson<TaskSummary>(buildOrgPath(`/tasks/${taskId}`), {
    method: "PATCH",
    body: JSON.stringify(values),
  });
}

export function archiveTask(taskId: string) {
  return requestJson<{ id: string; archived: boolean }>(buildOrgPath(`/tasks/${taskId}`), {
    method: "DELETE",
  });
}
