import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  CompanyFormValues,
  CompanySummary,
  ContactCompany,
  ContactFormValues,
  ContactSummary,
} from "@agency-crm/shared";
import type { ReactNode } from "react";
import {
  Building2,
  Globe,
  Mail,
  Phone,
  Sparkles,
  UserRoundCheck,
  Users,
} from "lucide-react";
import { Navigate, Link, Route, Routes, useNavigate, useParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { CompanyForm } from "@/components/company-form";
import { ContactForm } from "@/components/contact-form";
import { CrmShell, SectionCard } from "@/components/crm-shell";
import {
  archiveContact,
  createCompany,
  createContact,
  getCompany,
  getContact,
  listCompanies,
  listContacts,
  updateCompany,
  updateContact,
} from "@/lib/crm-api";
import { cn } from "@/lib/utils";

const queryKeys = {
  companies: ["companies"] as const,
  company: (companyId: string) => ["company", companyId] as const,
  contacts: ["contacts"] as const,
  contact: (contactId: string) => ["contact", contactId] as const,
};

function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/companies" replace />} />
      <Route path="/companies" element={<CompaniesPage />} />
      <Route path="/companies/:companyId" element={<CompanyDetailPage />} />
      <Route path="/contacts" element={<ContactsPage />} />
      <Route path="/contacts/:contactId" element={<ContactDetailPage />} />
    </Routes>
  );
}

function CompaniesPage() {
  const queryClient = useQueryClient();
  const companiesQuery = useQuery({
    queryKey: queryKeys.companies,
    queryFn: listCompanies,
  });

  const createCompanyMutation = useMutation({
    mutationFn: (values: CompanyFormValues) => createCompany(values),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.companies });
    },
  });

  return (
    <CrmShell title="Companies" eyebrow="Accounts">
      <div className="grid gap-6 xl:grid-cols-[1.45fr_0.95fr]">
        <SectionCard title="Company list" description="Browse the companies currently tracked in the CRM.">
          <DataState
            isLoading={companiesQuery.isLoading}
            error={companiesQuery.error}
            empty={!companiesQuery.data?.length}
            emptyLabel="No companies yet"
          >
            <div className="grid gap-3">
              {companiesQuery.data?.map((company) => (
                <CompanyRow key={company.id} company={company} />
              ))}
            </div>
          </DataState>
        </SectionCard>

        <SectionCard title="Add company" description="Create a company.">
          <CompanyForm
            submitLabel="Create company"
            onSubmit={async (values) => {
              await createCompanyMutation.mutateAsync(values);
            }}
          />
        </SectionCard>
      </div>
    </CrmShell>
  );
}

function CompanyDetailPage() {
  const queryClient = useQueryClient();
  const companyId = useParams().companyId ?? "";
  const companyQuery = useQuery({
    queryKey: queryKeys.company(companyId),
    queryFn: () => getCompany(companyId),
    enabled: companyId.length > 0,
  });

  const updateCompanyMutation = useMutation({
    mutationFn: (values: CompanyFormValues) => updateCompany(companyId, values),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.company(companyId) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.companies }),
      ]);
    },
  });

  const company = companyQuery.data;

  return (
    <CrmShell
      title={company?.name ?? "Company details"}
      eyebrow="Company profile"
      backTo="/companies"
      backLabel="Back to companies"
    >
      <DataState
        isLoading={companyQuery.isLoading}
        error={companyQuery.error}
        empty={!company}
        emptyLabel="Company not found"
      >
        {company ? (
          <div className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
            <SectionCard title="Overview" description="A quick snapshot of the account from the API.">
              <dl className="grid gap-4 md:grid-cols-2">
                <Metric label="Status" value={formatStatus(company.status)} icon={<Sparkles className="size-4" />} />
                <Metric label="Industry" value={company.industry ?? "Not set"} icon={<Building2 className="size-4" />} />
                <Metric label="Website" value={company.website ?? "Not set"} icon={<Globe className="size-4" />} />
                <Metric label="Phone" value={company.phone ?? "Not set"} icon={<Phone className="size-4" />} />
              </dl>

              <div className="mt-6 space-y-3">
                <h4 className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">Contacts</h4>
                <div className="grid gap-3">
                  {company.contacts.length ? (
                    company.contacts.map((contact) => (
                      <Link
                        key={contact.id}
                        to={`/contacts/${contact.id}`}
                        className="flex items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm transition hover:border-slate-300 hover:bg-white"
                      >
                        <div>
                          <p className="font-semibold text-slate-900">
                            {contact.firstName} {contact.lastName}
                          </p>
                          <p className="text-slate-500">{contact.email ?? contact.jobTitle ?? "No extra details yet"}</p>
                        </div>
                        {contact.isPrimary ? (
                          <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700">
                            Primary
                          </span>
                        ) : null}
                      </Link>
                    ))
                  ) : (
                    <p className="rounded-2xl border border-dashed border-slate-200 px-4 py-5 text-sm text-slate-500">
                      No contacts are linked to this company yet.
                    </p>
                  )}
                </div>
              </div>
            </SectionCard>

            <SectionCard title="Edit company" description="Update the company using the current PATCH endpoint.">
              <CompanyForm
                initialValues={company}
                submitLabel="Save company"
                onSubmit={async (values) => {
                  await updateCompanyMutation.mutateAsync(values);
                }}
              />
            </SectionCard>
          </div>
        ) : null}
      </DataState>
    </CrmShell>
  );
}

function ContactsPage() {
  const queryClient = useQueryClient();
  const contactsQuery = useQuery({
    queryKey: queryKeys.contacts,
    queryFn: listContacts,
  });
  const companiesQuery = useQuery({
    queryKey: queryKeys.companies,
    queryFn: listCompanies,
  });

  const createContactMutation = useMutation({
    mutationFn: (values: ContactFormValues) => createContact(values),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.contacts }),
        queryClient.invalidateQueries({ queryKey: queryKeys.companies }),
      ]);
    },
  });

  const companyOptions = (companiesQuery.data ?? []).map<ContactCompany>((company) => ({
    id: company.id,
    name: company.name,
  }));

  return (
    <CrmShell
      title="Contacts"
      eyebrow="People"
      actions={
        <div className="hidden rounded-full border border-sky-200 bg-sky-50 px-4 py-2 text-sm font-medium text-sky-700 md:inline-flex">
          <Users className="mr-2 size-4" />
          Linked to live companies
        </div>
      }
    >
      <div className="grid gap-6 xl:grid-cols-[1.45fr_0.95fr]">
        <SectionCard title="Contact list" description="People linked to existing companies in the current backend.">
          <DataState
            isLoading={contactsQuery.isLoading}
            error={contactsQuery.error}
            empty={!contactsQuery.data?.length}
            emptyLabel="No contacts yet"
          >
            <div className="grid gap-3">
              {contactsQuery.data?.map((contact) => (
                <ContactRow key={contact.id} contact={contact} />
              ))}
            </div>
          </DataState>
        </SectionCard>

        <SectionCard title="Add contact" description="Create a contact with one of the companies already in the CRM.">
          <ContactForm
            companies={companyOptions}
            submitLabel="Create contact"
            onSubmit={async (values) => {
              await createContactMutation.mutateAsync(values);
            }}
          />
        </SectionCard>
      </div>
    </CrmShell>
  );
}

function ContactDetailPage() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const contactId = useParams().contactId ?? "";

  const contactQuery = useQuery({
    queryKey: queryKeys.contact(contactId),
    queryFn: () => getContact(contactId),
    enabled: contactId.length > 0,
  });
  const companiesQuery = useQuery({
    queryKey: queryKeys.companies,
    queryFn: listCompanies,
  });

  const updateContactMutation = useMutation({
    mutationFn: (values: ContactFormValues) => updateContact(contactId, values),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.contact(contactId) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.contacts }),
        queryClient.invalidateQueries({ queryKey: queryKeys.companies }),
      ]);
    },
  });

  const archiveContactMutation = useMutation({
    mutationFn: () => archiveContact(contactId),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.contacts }),
        queryClient.invalidateQueries({ queryKey: queryKeys.companies }),
      ]);
      navigate("/contacts");
    },
  });

  const contact = contactQuery.data;
  const companyOptions = (companiesQuery.data ?? []).map<ContactCompany>((company) => ({
    id: company.id,
    name: company.name,
  }));

  return (
    <CrmShell
      title={contact ? `${contact.firstName} ${contact.lastName}` : "Contact details"}
      eyebrow="Relationship profile"
      backTo="/contacts"
      backLabel="Back to contacts"
      actions={
        contact ? (
          <Button
            variant="destructive"
            size="lg"
            onClick={() => archiveContactMutation.mutate()}
            disabled={archiveContactMutation.isPending}
          >
            Archive contact
          </Button>
        ) : null
      }
    >
      <DataState
        isLoading={contactQuery.isLoading}
        error={contactQuery.error}
        empty={!contact}
        emptyLabel="Contact not found"
      >
        {contact ? (
          <div className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
            <SectionCard title="Overview" description="Current contact information returned by the backend.">
              <dl className="grid gap-4 md:grid-cols-2">
                <Metric label="Company" value={contact.company.name} icon={<Building2 className="size-4" />} />
                <Metric label="Email" value={contact.email ?? "Not set"} icon={<Mail className="size-4" />} />
                <Metric label="Phone" value={contact.phone ?? "Not set"} icon={<Phone className="size-4" />} />
                <Metric
                  label="Primary contact"
                  value={contact.isPrimary ? "Yes" : "No"}
                  icon={<UserRoundCheck className="size-4" />}
                />
              </dl>
            </SectionCard>

            <SectionCard title="Edit contact" description="Update or archive the contact using the current backend.">
              <ContactForm
                companies={companyOptions}
                initialValues={contact}
                submitLabel="Save contact"
                onSubmit={async (values) => {
                  await updateContactMutation.mutateAsync(values);
                }}
              />
            </SectionCard>
          </div>
        ) : null}
      </DataState>
    </CrmShell>
  );
}

function CompanyRow({ company }: { company: CompanySummary }) {
  return (
    <Link
      to={`/companies/${company.id}`}
      className="group grid gap-3 rounded-[26px] border border-slate-200 bg-slate-50 px-4 py-4 transition hover:border-slate-300 hover:bg-white md:grid-cols-[1.3fr_0.7fr_0.6fr_auto]"
    >
      <div className="space-y-1">
        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-2xl bg-slate-900 text-white">
            <Building2 className="size-4" />
          </div>
          <div>
            <p className="font-semibold text-slate-950">{company.name}</p>
            <p className="text-sm text-slate-500">{company.website ?? "Website not set"}</p>
          </div>
        </div>
      </div>
      <div className="space-y-1">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Industry</p>
        <p className="text-sm text-slate-700">{company.industry ?? "Not set"}</p>
      </div>
      <div className="space-y-1">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Phone</p>
        <p className="text-sm text-slate-700">{company.phone ?? "Not set"}</p>
      </div>
      <div className="flex flex-col items-start gap-2 md:items-end">
        <StatusPill status={company.status} />
        <span className="text-sm font-medium text-slate-600">{formatContactCount(company.contactCount)}</span>
      </div>
    </Link>
  );
}

function ContactRow({ contact }: { contact: ContactSummary }) {
  return (
    <Link
      to={`/contacts/${contact.id}`}
      className="group grid gap-3 rounded-[26px] border border-slate-200 bg-slate-50 px-4 py-4 transition hover:border-slate-300 hover:bg-white md:grid-cols-[1.2fr_0.9fr_0.8fr_auto]"
    >
      <div className="space-y-1">
        <p className="font-semibold text-slate-950">
          {contact.firstName} {contact.lastName}
        </p>
        <p className="text-sm text-slate-500">{contact.email ?? "No email yet"}</p>
      </div>
      <div className="space-y-1">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Company</p>
        <p className="text-sm text-slate-700">{contact.company.name}</p>
      </div>
      <div className="space-y-1">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Role</p>
        <p className="text-sm text-slate-700">{contact.jobTitle ?? "Not set"}</p>
      </div>
      <div className="flex flex-col items-start gap-2 md:items-end">
        {contact.isPrimary ? (
          <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700">
            Primary
          </span>
        ) : (
          <span className="rounded-full bg-slate-200 px-3 py-1 text-xs font-semibold text-slate-600">
            Contact
          </span>
        )}
        <p className="text-sm text-slate-500">{contact.phone ?? "No phone"}</p>
      </div>
    </Link>
  );
}

function StatusPill({ status }: { status: CompanySummary["status"] }) {
  return (
    <span
      className={cn(
        "rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em]",
        status === "lead" && "bg-amber-100 text-amber-800",
        status === "active_client" && "bg-emerald-100 text-emerald-700",
        status === "inactive" && "bg-slate-200 text-slate-600",
      )}
    >
      {formatStatus(status)}
    </span>
  );
}

function Metric({ label, value, icon }: { label: string; value: string; icon: ReactNode }) {
  return (
    <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
      <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-white px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500 shadow-sm">
        {icon}
        {label}
      </div>
      <p className="text-base font-semibold text-slate-900">{value}</p>
    </div>
  );
}

function DataState({
  children,
  empty,
  emptyLabel,
  error,
  isLoading,
}: {
  children: ReactNode;
  empty: boolean;
  emptyLabel: string;
  error: Error | null;
  isLoading: boolean;
}) {
  if (isLoading) {
    return <p className="rounded-2xl border border-dashed border-slate-200 px-4 py-5 text-sm text-slate-500">Loading…</p>;
  }

  if (error) {
    return <p className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-5 text-sm text-rose-700">{error.message}</p>;
  }

  if (empty) {
    return <p className="rounded-2xl border border-dashed border-slate-200 px-4 py-5 text-sm text-slate-500">{emptyLabel}</p>;
  }

  return <>{children}</>;
}

function formatStatus(status: CompanySummary["status"]) {
  switch (status) {
    case "lead":
      return "Lead";
    case "active_client":
      return "Active client";
    case "inactive":
      return "Inactive";
  }
}

function formatContactCount(contactCount: number) {
  return `${contactCount} contact${contactCount === 1 ? "" : "s"}`;
}

export default App;
