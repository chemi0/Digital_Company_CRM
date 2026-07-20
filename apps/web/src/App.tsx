import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  CompanyFormValues,
  CompanySummary,
  ContactCompany,
  ContactFormValues,
  ContactSummary,
  DealFormValues,
  DealSummary,
  ActivityFormValues,
  ActivitySummary,
  TaskFormValues,
  TaskSummary,
  InvitationFormValues,
  TeamMember,
  InvitationSummary,
  LoginCredentials,
  PasswordResetRequestValues,
  PasswordResetValues,
} from "@agency-crm/shared";
import type { ReactNode } from "react";
import { useState } from "react";
import {
  Building2,
  CalendarDays,
  Check,
  CheckSquare,
  CircleDollarSign,
  Globe,
  Mail,
  Phone,
  ShieldCheck,
  Sparkles,
  UserRoundCheck,
  Users,
} from "lucide-react";
import { Link, Navigate, Outlet, Route, Routes, useLocation, useNavigate, useParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { CompanyForm } from "@/components/company-form";
import { ContactForm } from "@/components/contact-form";
import { DealForm } from "@/components/deal-form";
import { ActivityForm } from "@/components/activity-form";
import { TaskForm } from "@/components/task-form";
import { CrmShell, SectionCard } from "@/components/crm-shell";
import { LoginForm } from "@/components/login-form";
import { ApiError } from "@/lib/api-client";
import { useAuth } from "@/lib/auth-context";
import { requestPasswordReset, resetPassword } from "@/lib/auth-api";
import {
  archiveContact,
  archiveDeal,
  archiveTask,
  createActivity,
  createTask,
  createCompany,
  createContact,
  createDeal,
  getCompany,
  getContact,
  getDeal,
  listCompanies,
  listContacts,
  listDeals,
  listActivities,
  listTasks,
  listTeamMembers,
  updateCompany,
  updateContact,
  updateDeal,
  updateTask,
  acceptInvitation,
  createInvitation,
  deactivateTeamMember,
  getInvitationPreview,
  listInvitations,
  listInactiveTeamMembers,
  listTeamMembersForManagement,
  reactivateTeamMember,
  revokeInvitation,
  sendReactivationInvitation,
  updateTeamMemberRole,
} from "@/lib/crm-api";
import { cn } from "@/lib/utils";

const queryKeys = {
  companies: ["companies"] as const,
  company: (companyId: string) => ["company", companyId] as const,
  contacts: ["contacts"] as const,
  contact: (contactId: string) => ["contact", contactId] as const,
  deals: ["deals"] as const,
  deal: (dealId: string) => ["deal", dealId] as const,
  activities: ["activities"] as const,
  tasks: ["tasks"] as const,
  companyActivities: (companyId: string) => ["activities", "company", companyId] as const,
  companyTasks: (companyId: string) => ["tasks", "company", companyId] as const,
  dealActivities: (dealId: string) => ["activities", "deal", dealId] as const,
  dealTasks: (dealId: string) => ["tasks", "deal", dealId] as const,
  teamMembers: ["team-members"] as const,
  team: ["team"] as const,
  invitations: ["invitations"] as const,
  inactiveTeam: ["inactive-team"] as const,
};

const demoCredentials: LoginCredentials | undefined = import.meta.env.DEV
  ? {
      email: "owner@atlas-digital.test",
      password: "AtlasAdmin123!",
    }
  : undefined;

function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      <Route path="/reset-password" element={<ResetPasswordPage />} />
      <Route path="/accept-invitation" element={<AcceptInvitationPage />} />
      <Route element={<ProtectedRoute />}>
        <Route path="/" element={<Navigate to="/companies" replace />} />
        <Route path="/companies" element={<CompaniesPage />} />
        <Route path="/companies/:companyId" element={<CompanyDetailPage />} />
        <Route path="/contacts" element={<ContactsPage />} />
        <Route path="/contacts/:contactId" element={<ContactDetailPage />} />
        <Route path="/deals" element={<DealsPage />} />
        <Route path="/deals/:dealId" element={<DealDetailPage />} />
        <Route path="/work" element={<WorkPage />} />
        <Route path="/team" element={<TeamPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { isAuthenticated, isLoading, isLoggingIn, login } = useAuth();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const nextPath = typeof (location.state as { from?: string } | null)?.from === "string"
    ? (location.state as { from: string }).from
    : "/companies";

  if (isLoading) {
    return <FullPageState title="Checking your session" description="Restoring your CRM access from secure cookies." />;
  }

  if (isAuthenticated) {
    return <Navigate to={nextPath} replace />;
  }

  async function handleSubmit(values: LoginCredentials) {
    setErrorMessage(null);

    try {
      await login(values);
      navigate(nextPath, { replace: true });
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        setErrorMessage("The email or password is incorrect.");
        return;
      }

      setErrorMessage(error instanceof Error ? error.message : "Unable to sign in right now.");
    }
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(255,255,255,0.95),_rgba(250,247,242,1)_45%,_rgba(243,238,229,1)_100%)] px-4 py-10 text-slate-900">
      <div className="mx-auto grid min-h-[calc(100vh-5rem)] w-full max-w-6xl items-center gap-8 lg:grid-cols-[1.1fr_0.9fr]">
        <section className="rounded-[32px] border border-white/70 bg-white/85 p-6 shadow-[0_24px_80px_-48px_rgba(15,23,42,0.45)] backdrop-blur md:p-8">
          <div className="inline-flex items-center gap-3 rounded-full border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-semibold text-slate-600">
            <ShieldCheck className="size-4" />
            Secure team access
          </div>
          <h1 className="mt-6 text-4xl font-semibold tracking-tight text-slate-950">Sign in to Atlas Digital</h1>
          <p className="mt-4 max-w-xl text-base leading-7 text-slate-600">
            Access the live CRM workspace for companies and contacts. This phase uses the seeded admin account and
            secure cookie-based sessions backed by the API.
          </p>

          <div className="mt-8 grid gap-4 md:grid-cols-2">
            <FeatureCard title="Protected API routes" description="Every company and contact request now requires an authenticated session." />
            <FeatureCard title="Refresh-backed sessions" description="Short-lived access tokens are refreshed through a tracked server-side session." />
            <FeatureCard title="Single-org workspace" description="The current app restores your Atlas Digital organization context after login." />
            <FeatureCard title="Ready for Phase B2" description="This auth foundation sets us up for role-based rules and ownership checks next." />
          </div>
        </section>

        <section className="rounded-[32px] border border-white/70 bg-white/90 p-6 shadow-[0_24px_80px_-48px_rgba(15,23,42,0.5)] backdrop-blur md:p-8">
          <h2 className="text-2xl font-semibold text-slate-950">Welcome back</h2>
          <p className="mt-2 text-sm text-slate-500">Use the demo admin credentials below while we keep building the full CRM.</p>

          {import.meta.env.DEV && demoCredentials ? (
            <div className="mt-5 rounded-[24px] border border-sky-200 bg-sky-50 px-5 py-4 text-sm text-sky-900">
              <p className="font-semibold">Local demo credentials</p>
              <p className="mt-2">Email: {demoCredentials.email}</p>
              <p>Password: {demoCredentials.password}</p>
            </div>
          ) : null}

          <div className="mt-6">
            <LoginForm
              initialValues={demoCredentials}
              errorMessage={errorMessage}
              isSubmitting={isLoggingIn}
              onSubmit={handleSubmit}
            />
          </div>
          <Link to="/forgot-password" className="mt-4 inline-flex text-sm font-semibold text-slate-700 underline-offset-4 hover:underline">Forgot your password?</Link>
        </section>
      </div>
    </div>
  );
}

function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [requested, setRequested] = useState(false);
  const mutation = useMutation({ mutationFn: requestPasswordReset, onSuccess: () => setRequested(true) });
  if (requested) return <FullPageState title="Check your email" description="If that account exists, we sent a secure password-reset link." action={<Button asChild><Link to="/login">Back to sign in</Link></Button>} />;
  return <PublicAuthCard title="Reset your password" description="Enter your work email and we will send a one-hour reset link."><form className="grid gap-4" onSubmit={(event) => { event.preventDefault(); mutation.mutate({ email } satisfies PasswordResetRequestValues); }}><label className="grid gap-2 text-sm font-medium text-slate-700"><span>Work email</span><input className="input-field" type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} required /></label>{mutation.error ? <p className="text-sm font-medium text-rose-600">{mutation.error.message}</p> : null}<Button type="submit" size="lg" disabled={mutation.isPending}>Send reset link</Button></form><Link to="/login" className="mt-5 inline-flex text-sm font-semibold text-slate-700 underline-offset-4 hover:underline">Back to sign in</Link></PublicAuthCard>;
}

function ResetPasswordPage() {
  const token = new URLSearchParams(useLocation().search).get("token") ?? "";
  const [password, setPassword] = useState("");
  const [reset, setReset] = useState(false);
  const mutation = useMutation({ mutationFn: resetPassword, onSuccess: () => setReset(true) });
  if (reset) return <FullPageState title="Password updated" description="Your active sessions were signed out for security. Sign in with your new password." action={<Button asChild><Link to="/login">Sign in</Link></Button>} />;
  return <PublicAuthCard title="Choose a new password" description="Use at least 12 characters. This link expires after one hour.">{!token ? <p className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">This password reset link is missing its token.</p> : <form className="grid gap-4" onSubmit={(event) => { event.preventDefault(); mutation.mutate({ token, password } satisfies PasswordResetValues); }}><label className="grid gap-2 text-sm font-medium text-slate-700"><span>New password</span><input className="input-field" type="password" autoComplete="new-password" minLength={12} value={password} onChange={(event) => setPassword(event.target.value)} required /></label>{mutation.error ? <p className="text-sm font-medium text-rose-600">{mutation.error.message}</p> : null}<Button type="submit" size="lg" disabled={mutation.isPending}>Update password</Button></form>}</PublicAuthCard>;
}

function PublicAuthCard({ title, description, children }: { title: string; description: string; children: ReactNode }) {
  return <div className="flex min-h-screen items-center justify-center bg-[radial-gradient(circle_at_top_left,_rgba(255,255,255,0.95),_rgba(250,247,242,1)_45%,_rgba(243,238,229,1)_100%)] px-4 py-10"><section className="w-full max-w-xl rounded-[32px] border border-white/70 bg-white/90 p-6 shadow-[0_24px_80px_-48px_rgba(15,23,42,0.5)] backdrop-blur md:p-8"><p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">Agency CRM</p><h1 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950">{title}</h1><p className="mt-3 text-sm leading-6 text-slate-600">{description}</p><div className="mt-6">{children}</div></section></div>;
}

function ProtectedRoute() {
  const location = useLocation();
  const { error, isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return <FullPageState title="Loading workspace" description="Checking your authenticated CRM session." />;
  }

  if (error) {
    return <FullPageState title="Unable to load session" description={error.message} />;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: `${location.pathname}${location.search}` }} />;
  }

  return <Outlet />;
}

function CompaniesPage() {
  const queryClient = useQueryClient();
  const { session } = useAuth();
  const canAssignOwner = session?.membership.role !== "sales_rep";
  const companiesQuery = useQuery({
    queryKey: queryKeys.companies,
    queryFn: listCompanies,
  });
  const teamMembersQuery = useQuery({
    queryKey: queryKeys.teamMembers,
    queryFn: listTeamMembers,
    enabled: canAssignOwner,
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
            canAssignOwner={canAssignOwner}
            owners={teamMembersQuery.data}
            initialValues={
              canAssignOwner && session
                ? { ownerMembershipId: session.membership.id }
                : undefined
            }
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
  const { session } = useAuth();
  const canAssignOwner = session?.membership.role !== "sales_rep";
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
  const teamMembersQuery = useQuery({
    queryKey: queryKeys.teamMembers,
    queryFn: listTeamMembers,
    enabled: canAssignOwner,
  });

  const company = companyQuery.data;
  const companyActivitiesQuery = useQuery({
    queryKey: queryKeys.companyActivities(companyId),
    queryFn: () => listActivities({ companyId }),
    enabled: companyId.length > 0,
  });
  const companyTasksQuery = useQuery({
    queryKey: queryKeys.companyTasks(companyId),
    queryFn: () => listTasks({ companyId, scope: "all", status: "open" }),
    enabled: companyId.length > 0,
  });

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
                <Metric
                  label="Account owner"
                  value={`${company.owner.user.firstName} ${company.owner.user.lastName}`}
                  icon={<UserRoundCheck className="size-4" />}
                />
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
              <WorkSnapshot activities={companyActivitiesQuery.data ?? []} tasks={companyTasksQuery.data ?? []} />
            </SectionCard>

            <SectionCard title="Edit company" description="Update the company using the current PATCH endpoint.">
              <CompanyForm
                initialValues={company}
                canAssignOwner={canAssignOwner}
                owners={teamMembersQuery.data}
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

function DealsPage() {
  const queryClient = useQueryClient();
  const { session } = useAuth();
  const canAssignOwner = session?.membership.role !== "sales_rep";
  const dealsQuery = useQuery({ queryKey: queryKeys.deals, queryFn: listDeals });
  const companiesQuery = useQuery({ queryKey: queryKeys.companies, queryFn: listCompanies });
  const contactsQuery = useQuery({ queryKey: queryKeys.contacts, queryFn: listContacts });
  const teamMembersQuery = useQuery({
    queryKey: queryKeys.teamMembers,
    queryFn: listTeamMembers,
    enabled: canAssignOwner,
  });
  const createDealMutation = useMutation({
    mutationFn: (values: DealFormValues) => createDeal(values),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.deals });
    },
  });

  const companyOptions = (companiesQuery.data ?? []).map<ContactCompany>((company) => ({
    id: company.id,
    name: company.name,
  }));

  return (
    <CrmShell
      title="Deals"
      eyebrow="Revenue pipeline"
      actions={
        <div className="hidden rounded-full border border-amber-200 bg-amber-50 px-4 py-2 text-sm font-medium text-amber-800 md:inline-flex">
          <CircleDollarSign className="mr-2 size-4" />
          Live pipeline value
        </div>
      }
    >
      <div className="grid gap-6 xl:grid-cols-[1.45fr_0.95fr]">
        <SectionCard title="Pipeline" description="Active commercial opportunities available to your role.">
          <DataState
            isLoading={dealsQuery.isLoading}
            error={dealsQuery.error}
            empty={!dealsQuery.data?.length}
            emptyLabel="No active deals yet"
          >
            <div className="grid gap-3">
              {dealsQuery.data?.map((deal) => <DealRow key={deal.id} deal={deal} />)}
            </div>
          </DataState>
        </SectionCard>

        <SectionCard title="Add deal" description="Create a revenue opportunity for a company you can access.">
          <DealForm
            companies={companyOptions}
            contacts={contactsQuery.data ?? []}
            owners={teamMembersQuery.data}
            canAssignOwner={canAssignOwner}
            submitLabel="Create deal"
            onSubmit={async (values) => {
              await createDealMutation.mutateAsync(values);
            }}
          />
        </SectionCard>
      </div>
    </CrmShell>
  );
}

function DealDetailPage() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { session } = useAuth();
  const canAssignOwner = session?.membership.role !== "sales_rep";
  const dealId = useParams().dealId ?? "";
  const dealQuery = useQuery({
    queryKey: queryKeys.deal(dealId),
    queryFn: () => getDeal(dealId),
    enabled: dealId.length > 0,
  });
  const companiesQuery = useQuery({ queryKey: queryKeys.companies, queryFn: listCompanies });
  const contactsQuery = useQuery({ queryKey: queryKeys.contacts, queryFn: listContacts });
  const teamMembersQuery = useQuery({
    queryKey: queryKeys.teamMembers,
    queryFn: listTeamMembers,
    enabled: canAssignOwner,
  });
  const updateDealMutation = useMutation({
    mutationFn: (values: DealFormValues) => updateDeal(dealId, values),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.deal(dealId) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.deals }),
      ]);
    },
  });
  const archiveDealMutation = useMutation({
    mutationFn: () => archiveDeal(dealId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.deals });
      navigate("/deals");
    },
  });

  const deal = dealQuery.data;
  const dealActivitiesQuery = useQuery({
    queryKey: queryKeys.dealActivities(dealId),
    queryFn: () => listActivities({ dealId }),
    enabled: dealId.length > 0,
  });
  const dealTasksQuery = useQuery({
    queryKey: queryKeys.dealTasks(dealId),
    queryFn: () => listTasks({ dealId, scope: "all", status: "open" }),
    enabled: dealId.length > 0,
  });
  const companyOptions = (companiesQuery.data ?? []).map<ContactCompany>((company) => ({
    id: company.id,
    name: company.name,
  }));

  return (
    <CrmShell
      title={deal?.title ?? "Deal details"}
      eyebrow="Revenue opportunity"
      backTo="/deals"
      backLabel="Back to deals"
      actions={
        deal ? (
          <Button
            variant="destructive"
            size="lg"
            onClick={() => archiveDealMutation.mutate()}
            disabled={archiveDealMutation.isPending}
          >
            Archive deal
          </Button>
        ) : null
      }
    >
      <DataState
        isLoading={dealQuery.isLoading}
        error={dealQuery.error}
        empty={!deal}
        emptyLabel="Deal not found"
      >
        {deal ? (
          <div className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
            <SectionCard title="Opportunity snapshot" description="Current deal context returned by the protected API.">
              <dl className="grid gap-4 md:grid-cols-2">
                <Metric label="Stage" value={formatDealStage(deal.stage)} icon={<CircleDollarSign className="size-4" />} />
                <Metric label="Value" value={formatMoney(deal.amountCents, deal.currency)} icon={<CircleDollarSign className="size-4" />} />
                <Metric label="Company" value={deal.company.name} icon={<Building2 className="size-4" />} />
                <Metric
                  label="Primary contact"
                  value={deal.primaryContact ? `${deal.primaryContact.firstName} ${deal.primaryContact.lastName}` : "Not set"}
                  icon={<UserRoundCheck className="size-4" />}
                />
                <Metric
                  label="Expected close"
                  value={deal.expectedCloseDate ? formatDate(deal.expectedCloseDate) : "Not set"}
                  icon={<CalendarDays className="size-4" />}
                />
                <Metric
                  label="Deal owner"
                  value={`${deal.owner.user.firstName} ${deal.owner.user.lastName}`}
                  icon={<UserRoundCheck className="size-4" />}
                />
              </dl>
              {deal.source || deal.description ? (
                <div className="mt-6 rounded-3xl border border-slate-200 bg-slate-50 p-4">
                  {deal.source ? <p className="text-sm font-medium text-slate-600">Source: {deal.source}</p> : null}
                  {deal.description ? <p className="mt-2 text-sm leading-6 text-slate-600">{deal.description}</p> : null}
                </div>
              ) : null}
              <WorkSnapshot activities={dealActivitiesQuery.data ?? []} tasks={dealTasksQuery.data ?? []} />
            </SectionCard>

            <SectionCard title="Edit deal" description="Move the opportunity forward or adjust its commercial context.">
              <DealForm
                companies={companyOptions}
                contacts={contactsQuery.data ?? []}
                owners={teamMembersQuery.data}
                canAssignOwner={canAssignOwner}
                initialValues={deal}
                submitLabel="Save deal"
                onSubmit={async (values) => {
                  await updateDealMutation.mutateAsync(values);
                }}
              />
            </SectionCard>
          </div>
        ) : null}
      </DataState>
    </CrmShell>
  );
}

function WorkPage() {
  const queryClient = useQueryClient();
  const { session } = useAuth();
  const canAssignOwner = session?.membership.role !== "sales_rep";
  const tasksQuery = useQuery({ queryKey: queryKeys.tasks, queryFn: () => listTasks({ scope: "mine", status: "open" }) });
  const activitiesQuery = useQuery({ queryKey: queryKeys.activities, queryFn: () => listActivities() });
  const companiesQuery = useQuery({ queryKey: queryKeys.companies, queryFn: listCompanies });
  const contactsQuery = useQuery({ queryKey: queryKeys.contacts, queryFn: listContacts });
  const dealsQuery = useQuery({ queryKey: queryKeys.deals, queryFn: listDeals });
  const teamMembersQuery = useQuery({ queryKey: queryKeys.teamMembers, queryFn: listTeamMembers, enabled: canAssignOwner });
  const completeTaskMutation = useMutation({
    mutationFn: (taskId: string) => updateTask(taskId, { completed: true }),
    onSuccess: async () => { await queryClient.invalidateQueries({ queryKey: queryKeys.tasks }); },
  });
  const archiveTaskMutation = useMutation({
    mutationFn: (taskId: string) => archiveTask(taskId),
    onSuccess: async () => { await queryClient.invalidateQueries({ queryKey: queryKeys.tasks }); },
  });
  const createTaskMutation = useMutation({
    mutationFn: (values: TaskFormValues) => createTask(values),
    onSuccess: async () => { await queryClient.invalidateQueries({ queryKey: queryKeys.tasks }); },
  });
  const createActivityMutation = useMutation({
    mutationFn: (values: ActivityFormValues) => createActivity(values),
    onSuccess: async () => { await queryClient.invalidateQueries({ queryKey: queryKeys.activities }); },
  });
  const companyOptions = (companiesQuery.data ?? []).map<ContactCompany>((company) => ({ id: company.id, name: company.name }));

  return (
    <CrmShell title="My work" eyebrow="Follow-through" actions={<div className="hidden rounded-full border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-medium text-emerald-800 md:inline-flex"><CheckSquare className="mr-2 size-4" />Focus on the next action</div>}>
      <div className="grid gap-6 xl:grid-cols-[1.35fr_0.95fr]">
        <SectionCard title="Open tasks" description="Your active follow-ups, ordered by due date.">
          <DataState isLoading={tasksQuery.isLoading} error={tasksQuery.error} empty={!tasksQuery.data?.length} emptyLabel="No open tasks assigned to you">
            <div className="grid gap-3">{tasksQuery.data?.map((task) => <TaskRow key={task.id} task={task} onComplete={() => completeTaskMutation.mutate(task.id)} onArchive={() => archiveTaskMutation.mutate(task.id)} />)}</div>
          </DataState>
        </SectionCard>
        <SectionCard title="Add follow-up" description="Turn account context into a clear, assigned next step.">
          <TaskForm companies={companyOptions} contacts={contactsQuery.data ?? []} deals={dealsQuery.data ?? []} owners={teamMembersQuery.data} canAssignOwner={canAssignOwner} submitLabel="Create task" onSubmit={async (values) => { await createTaskMutation.mutateAsync(values); }} />
        </SectionCard>
      </div>
      <div className="grid gap-6 xl:grid-cols-[1.35fr_0.95fr]">
        <SectionCard title="Recent activity" description="The latest customer interactions your role can access.">
          <DataState isLoading={activitiesQuery.isLoading} error={activitiesQuery.error} empty={!activitiesQuery.data?.length} emptyLabel="No activity has been logged yet">
            <div className="grid gap-3">{activitiesQuery.data?.map((activity) => <ActivityRow key={activity.id} activity={activity} />)}</div>
          </DataState>
        </SectionCard>
        <SectionCard title="Log activity" description="Capture a call, email, meeting, or internal note while the context is fresh.">
          <ActivityForm companies={companyOptions} contacts={contactsQuery.data ?? []} deals={dealsQuery.data ?? []} submitLabel="Log activity" onSubmit={async (values) => { await createActivityMutation.mutateAsync(values); }} />
        </SectionCard>
      </div>
    </CrmShell>
  );
}

function TeamPage() {
  const queryClient = useQueryClient();
  const { session } = useAuth();
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<InvitationFormValues["role"]>("sales_rep");
  const isAdmin = session?.membership.role === "admin";
  const teamQuery = useQuery({ queryKey: queryKeys.team, queryFn: listTeamMembersForManagement, enabled: Boolean(session && session.membership.role !== "sales_rep") });
  const inactiveTeamQuery = useQuery({ queryKey: queryKeys.inactiveTeam, queryFn: listInactiveTeamMembers, enabled: Boolean(isAdmin) });
  const invitationsQuery = useQuery({ queryKey: queryKeys.invitations, queryFn: listInvitations, enabled: Boolean(session && session.membership.role !== "sales_rep") });
  const inviteMutation = useMutation({
    mutationFn: (values: InvitationFormValues) => createInvitation(values),
    onSuccess: async () => { setEmail(""); await queryClient.invalidateQueries({ queryKey: queryKeys.invitations }); },
  });
  const revokeMutation = useMutation({ mutationFn: revokeInvitation, onSuccess: async () => { await queryClient.invalidateQueries({ queryKey: queryKeys.invitations }); } });
  const roleMutation = useMutation({ mutationFn: ({ membershipId, nextRole }: { membershipId: string; nextRole: InvitationFormValues["role"] }) => updateTeamMemberRole(membershipId, nextRole), onSuccess: async () => { await queryClient.invalidateQueries({ queryKey: queryKeys.team }); } });
  const refreshTeam = async () => { await Promise.all([queryClient.invalidateQueries({ queryKey: queryKeys.team }), queryClient.invalidateQueries({ queryKey: queryKeys.inactiveTeam }), queryClient.invalidateQueries({ queryKey: queryKeys.invitations })]); };
  const deactivateMutation = useMutation({ mutationFn: deactivateTeamMember, onSuccess: refreshTeam });
  const reactivateMutation = useMutation({ mutationFn: reactivateTeamMember, onSuccess: refreshTeam });
  const reactivationInvitationMutation = useMutation({ mutationFn: sendReactivationInvitation, onSuccess: refreshTeam });
  const lifecycleError = reactivateMutation.error ?? reactivationInvitationMutation.error;

  if (session?.membership.role === "sales_rep") return <Navigate to="/companies" replace />;

  return <CrmShell title="Team" eyebrow="Access management">
    <div className="grid gap-6 xl:grid-cols-[1.35fr_0.95fr]">
      <SectionCard title="Active members" description="Roles control who can access organization-wide records and manage the team.">
        <DataState isLoading={teamQuery.isLoading} error={teamQuery.error} empty={!teamQuery.data?.length} emptyLabel="No active members">
          <div className="grid gap-3">{teamQuery.data?.map((member) => <TeamMemberRow key={member.id} member={member} canManage={isAdmin && member.id !== session?.membership.id} onRoleChange={(nextRole) => roleMutation.mutate({ membershipId: member.id, nextRole })} onDeactivate={() => deactivateMutation.mutate(member.id)} />)}</div>
        </DataState>
      </SectionCard>
      <SectionCard title="Invite teammate" description={isAdmin ? "Invite an admin, manager, or sales rep. The link expires after seven days." : "Managers may invite sales reps. The link expires after seven days."}>
        <form className="grid gap-4" onSubmit={(event) => { event.preventDefault(); inviteMutation.mutate({ email, role }); }}>
          <label className="grid gap-2 text-sm font-medium text-slate-700"><span>Work email</span><input className="input-field" type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="teammate@company.com" required /></label>
          <label className="grid gap-2 text-sm font-medium text-slate-700"><span>Role</span><select className="input-field" value={role} onChange={(event) => setRole(event.target.value as InvitationFormValues["role"])}><option value="sales_rep">Sales rep</option>{isAdmin ? <><option value="manager">Manager</option><option value="admin">Admin</option></> : null}</select></label>
          {inviteMutation.error ? <p className="text-sm font-medium text-rose-600">{inviteMutation.error.message}</p> : null}
          <Button type="submit" size="lg" className="justify-center" disabled={inviteMutation.isPending}>Send invitation</Button>
        </form>
      </SectionCard>
    </div>
    {isAdmin ? <SectionCard title="Inactive members" description="Recently deactivated members can be restored directly. Older accounts require email confirmation before access is restored.">
      <DataState isLoading={inactiveTeamQuery.isLoading} error={inactiveTeamQuery.error} empty={!inactiveTeamQuery.data?.length} emptyLabel="No inactive members">
        <div className="grid gap-3">{inactiveTeamQuery.data?.map((member) => <InactiveMemberRow key={member.id} member={member} onReactivate={() => reactivateMutation.mutate(member.id)} onSendInvitation={() => reactivationInvitationMutation.mutate(member.id)} isPending={reactivateMutation.isPending || reactivationInvitationMutation.isPending} />)}</div>
      </DataState>
      {lifecycleError ? <p className="mt-4 text-sm font-medium text-rose-600">{lifecycleError.message}</p> : null}
    </SectionCard> : null}
    <SectionCard title="Invitations" description="Pending invites can be revoked at any time; sending another invite revokes the previous one.">
      <DataState isLoading={invitationsQuery.isLoading} error={invitationsQuery.error} empty={!invitationsQuery.data?.length} emptyLabel="No invitations yet">
        <div className="grid gap-3">{invitationsQuery.data?.map((invitation) => <InvitationRow key={invitation.id} invitation={invitation} canRevoke={invitation.status === "pending"} onRevoke={() => revokeMutation.mutate(invitation.id)} />)}</div>
      </DataState>
    </SectionCard>
  </CrmShell>;
}

function AcceptInvitationPage() {
  const location = useLocation();
  const token = new URLSearchParams(location.search).get("token") ?? "";
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [password, setPassword] = useState("");
  const [accepted, setAccepted] = useState(false);
  const previewQuery = useQuery({ queryKey: ["invitation-preview", token], queryFn: () => getInvitationPreview(token), enabled: Boolean(token) });
  const isReactivation = previewQuery.data?.mode === "reactivation";
  const acceptMutation = useMutation({ mutationFn: acceptInvitation, onSuccess: () => setAccepted(true) });

  if (accepted) return <FullPageState title={isReactivation ? "Access reactivated" : "Invitation accepted"} description={isReactivation ? "Your CRM access has been restored. You can now sign in." : "Your account is ready. You can now sign in with the password you created."} action={<Button asChild><Link to="/login">Sign in</Link></Button>} />;
  if (token && previewQuery.isLoading) return <FullPageState title="Checking invitation" description="Validating your secure invitation link." />;
  return <div className="flex min-h-screen items-center justify-center bg-[radial-gradient(circle_at_top_left,_rgba(255,255,255,0.95),_rgba(250,247,242,1)_45%,_rgba(243,238,229,1)_100%)] px-4 py-10"><section className="w-full max-w-xl rounded-[32px] border border-white/70 bg-white/90 p-6 shadow-[0_24px_80px_-48px_rgba(15,23,42,0.5)] backdrop-blur md:p-8"><p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">Agency CRM</p><h1 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950">{isReactivation ? "Reactivate your access" : "Join your team"}</h1><p className="mt-3 text-sm leading-6 text-slate-600">{isReactivation ? `Confirm that you want to restore your access to ${previewQuery.data?.organizationName ?? "this workspace"}.` : "Set up your account to accept the secure organization invitation."}</p>{!token ? <p className="mt-6 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">This invitation link is missing its token.</p> : previewQuery.error ? <p className="mt-6 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{previewQuery.error.message}</p> : <form className="mt-6 grid gap-4" onSubmit={(event) => { event.preventDefault(); acceptMutation.mutate(isReactivation ? { token } : { token, firstName, lastName, password }); }}>{!isReactivation ? <><div className="grid gap-4 md:grid-cols-2"><label className="grid gap-2 text-sm font-medium text-slate-700"><span>First name</span><input className="input-field" value={firstName} onChange={(event) => setFirstName(event.target.value)} required /></label><label className="grid gap-2 text-sm font-medium text-slate-700"><span>Last name</span><input className="input-field" value={lastName} onChange={(event) => setLastName(event.target.value)} required /></label></div><label className="grid gap-2 text-sm font-medium text-slate-700"><span>Create password</span><input className="input-field" type="password" minLength={12} value={password} onChange={(event) => setPassword(event.target.value)} required /></label></> : null}{acceptMutation.error ? <p className="text-sm font-medium text-rose-600">{acceptMutation.error.message}</p> : null}<Button type="submit" size="lg" disabled={acceptMutation.isPending}>{isReactivation ? "Reactivate access" : "Accept invitation"}</Button></form>}</section></div>;
}

function TeamMemberRow({ member, canManage, onRoleChange, onDeactivate }: { member: TeamMember; canManage: boolean; onRoleChange: (role: InvitationFormValues["role"]) => void; onDeactivate: () => void }) {
  return <div className="grid gap-3 rounded-[26px] border border-slate-200 bg-slate-50 px-4 py-4 md:grid-cols-[1fr_auto]"><div><p className="font-semibold text-slate-950">{member.user.firstName} {member.user.lastName}</p><p className="text-sm text-slate-500">{member.user.email}</p><p className="mt-2 text-xs font-medium uppercase tracking-[0.16em] text-slate-400">Last login: {member.user.lastLoginAt ? formatDate(member.user.lastLoginAt) : "Never"}</p></div><div className="flex flex-wrap items-center gap-2">{canManage ? <select className="input-field w-32" aria-label={`${member.user.firstName} role`} value={member.role} onChange={(event) => onRoleChange(event.target.value as InvitationFormValues["role"])}><option value="admin">Admin</option><option value="manager">Manager</option><option value="sales_rep">Sales rep</option></select> : <span className="rounded-full bg-slate-200 px-3 py-2 text-xs font-semibold uppercase tracking-[0.16em] text-slate-600">{formatUserRole(member.role)}</span>}{canManage ? <Button type="button" variant="destructive" size="sm" onClick={onDeactivate}>Deactivate</Button> : null}</div></div>;
}

function InactiveMemberRow({ member, onReactivate, onSendInvitation, isPending }: { member: TeamMember; onReactivate: () => void; onSendInvitation: () => void; isPending: boolean }) {
  return <div className="grid gap-3 rounded-[26px] border border-amber-200 bg-amber-50/70 px-4 py-4 md:grid-cols-[1fr_auto]"><div><p className="font-semibold text-slate-950">{member.user.firstName} {member.user.lastName}</p><p className="text-sm text-slate-500">{member.user.email}</p><p className="mt-2 text-xs font-medium uppercase tracking-[0.16em] text-amber-700">Deactivated {member.archivedAt ? formatDate(member.archivedAt) : "recently"}</p></div><div className="flex items-center"><Button type="button" variant="outline" size="sm" disabled={isPending} onClick={member.requiresReactivationInvitation ? onSendInvitation : onReactivate}>{member.requiresReactivationInvitation ? "Send reactivation email" : "Reactivate"}</Button></div></div>;
}

function InvitationRow({ invitation, canRevoke, onRevoke }: { invitation: InvitationSummary; canRevoke: boolean; onRevoke: () => void }) {
  return <div className="flex flex-wrap items-center justify-between gap-3 rounded-[26px] border border-slate-200 bg-slate-50 px-4 py-4"><div><p className="font-semibold text-slate-950">{invitation.email}</p><p className="mt-1 text-sm text-slate-500">{formatUserRole(invitation.role)} · invited by {invitation.invitedBy}</p><p className="mt-2 text-xs font-medium uppercase tracking-[0.16em] text-slate-400">{invitation.status} · expires {formatDate(invitation.expiresAt)}</p></div>{canRevoke ? <Button type="button" variant="outline" size="sm" onClick={onRevoke}>Revoke</Button> : null}</div>;
}

function WorkSnapshot({ activities, tasks }: { activities: ActivitySummary[]; tasks: TaskSummary[] }) {
  return <div className="mt-6 rounded-3xl border border-slate-200 bg-slate-50 p-4"><div className="flex items-center justify-between gap-3"><div><p className="text-sm font-semibold text-slate-900">Related work</p><p className="mt-1 text-sm text-slate-500">{tasks.length} open task{tasks.length === 1 ? "" : "s"} · {activities.length} activity record{activities.length === 1 ? "" : "s"}</p></div><Button asChild variant="outline" size="sm"><Link to="/work">Open work</Link></Button></div>{tasks[0] ? <p className="mt-4 rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600">Next: <span className="font-semibold text-slate-900">{tasks[0].title}</span></p> : null}{activities[0] ? <p className="mt-2 text-sm text-slate-500">Latest activity: {activities[0].subject}</p> : null}</div>;
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
        <span className="text-sm font-medium text-slate-600">
          {company.owner.user.firstName} {company.owner.user.lastName}
        </span>
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

function DealRow({ deal }: { deal: DealSummary }) {
  return (
    <Link
      to={`/deals/${deal.id}`}
      className="group grid gap-3 rounded-[26px] border border-slate-200 bg-slate-50 px-4 py-4 transition hover:border-slate-300 hover:bg-white md:grid-cols-[1.15fr_0.7fr_0.75fr_auto]"
    >
      <div className="space-y-1">
        <p className="font-semibold text-slate-950">{deal.title}</p>
        <p className="text-sm text-slate-500">{deal.company.name}</p>
      </div>
      <div className="space-y-1">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Value</p>
        <p className="text-sm font-semibold text-slate-800">{formatMoney(deal.amountCents, deal.currency)}</p>
      </div>
      <div className="space-y-1">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Owner</p>
        <p className="text-sm text-slate-700">{deal.owner.user.firstName} {deal.owner.user.lastName}</p>
      </div>
      <div className="flex flex-col items-start gap-2 md:items-end">
        <DealStagePill stage={deal.stage} />
        <p className="text-sm text-slate-500">{deal.expectedCloseDate ? formatDate(deal.expectedCloseDate) : "No close date"}</p>
      </div>
    </Link>
  );
}

function TaskRow({ task, onComplete, onArchive }: { task: TaskSummary; onComplete: () => void; onArchive: () => void }) {
  return <div className="grid gap-3 rounded-[26px] border border-slate-200 bg-slate-50 px-4 py-4 md:grid-cols-[1fr_auto]">
    <div className="space-y-1"><div className="flex flex-wrap items-center gap-2"><p className="font-semibold text-slate-950">{task.title}</p><PriorityPill priority={task.priority} /></div><p className="text-sm text-slate-600">{task.company.name}{task.deal ? ` · ${task.deal.title}` : ""}</p>{task.description ? <p className="text-sm text-slate-500">{task.description}</p> : null}<p className="text-xs font-medium uppercase tracking-[0.16em] text-slate-400">{task.dueAt ? `Due ${formatDate(task.dueAt)}` : "No due date"}</p></div>
    <div className="flex items-start gap-2"><Button type="button" variant="outline" size="sm" onClick={onComplete}><Check className="size-4" />Complete</Button><Button type="button" variant="ghost" size="sm" onClick={onArchive}>Archive</Button></div>
  </div>;
}

function ActivityRow({ activity }: { activity: ActivitySummary }) {
  return <div className="rounded-[26px] border border-slate-200 bg-slate-50 px-4 py-4"><div className="flex flex-wrap items-center justify-between gap-3"><div><p className="font-semibold text-slate-950">{activity.subject}</p><p className="mt-1 text-sm text-slate-600">{formatActivityType(activity.type)} · {activity.company.name}{activity.contact ? ` · ${activity.contact.firstName} ${activity.contact.lastName}` : ""}</p></div><p className="text-xs font-medium uppercase tracking-[0.16em] text-slate-400">{formatDate(activity.occurredAt)}</p></div>{activity.body ? <p className="mt-3 text-sm leading-6 text-slate-500">{activity.body}</p> : null}<p className="mt-3 text-xs font-medium text-slate-400">Logged by {activity.author.user.firstName} {activity.author.user.lastName}</p></div>;
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

function DealStagePill({ stage }: { stage: DealSummary["stage"] }) {
  return (
    <span
      className={cn(
        "rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em]",
        stage === "new_lead" && "bg-slate-200 text-slate-700",
        stage === "contacted" && "bg-sky-100 text-sky-700",
        stage === "qualified" && "bg-violet-100 text-violet-700",
        stage === "proposal_sent" && "bg-amber-100 text-amber-800",
        stage === "won" && "bg-emerald-100 text-emerald-700",
        stage === "lost" && "bg-rose-100 text-rose-700",
      )}
    >
      {formatDealStage(stage)}
    </span>
  );
}

function PriorityPill({ priority }: { priority: TaskSummary["priority"] }) {
  return <span className={cn("rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em]", priority === "high" && "bg-rose-100 text-rose-700", priority === "medium" && "bg-amber-100 text-amber-800", priority === "low" && "bg-slate-200 text-slate-600")}>{priority}</span>;
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
    return <p className="rounded-2xl border border-dashed border-slate-200 px-4 py-5 text-sm text-slate-500">Loading...</p>;
  }

  if (error) {
    return <p className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-5 text-sm text-rose-700">{error.message}</p>;
  }

  if (empty) {
    return <p className="rounded-2xl border border-dashed border-slate-200 px-4 py-5 text-sm text-slate-500">{emptyLabel}</p>;
  }

  return <>{children}</>;
}

function FeatureCard({ title, description }: { title: string; description: string }) {
  return (
    <div className="rounded-[24px] border border-slate-200 bg-slate-50 p-4">
      <p className="font-semibold text-slate-900">{title}</p>
      <p className="mt-2 text-sm leading-6 text-slate-600">{description}</p>
    </div>
  );
}

function FullPageState({ title, description, action }: { title: string; description: string; action?: ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[radial-gradient(circle_at_top_left,_rgba(255,255,255,0.95),_rgba(250,247,242,1)_45%,_rgba(243,238,229,1)_100%)] px-4">
      <div className="w-full max-w-xl rounded-[32px] border border-white/70 bg-white/90 p-8 text-center shadow-[0_24px_80px_-48px_rgba(15,23,42,0.5)] backdrop-blur">
        <div className="mx-auto mb-5 flex size-12 items-center justify-center rounded-2xl bg-slate-900 text-white">
          <ShieldCheck className="size-5" />
        </div>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-950">{title}</h1>
        <p className="mt-3 text-sm leading-6 text-slate-600">{description}</p>
        {action ? <div className="mt-6">{action}</div> : null}
      </div>
    </div>
  );
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

function formatDealStage(stage: DealSummary["stage"]) {
  switch (stage) {
    case "new_lead":
      return "New lead";
    case "contacted":
      return "Contacted";
    case "qualified":
      return "Qualified";
    case "proposal_sent":
      return "Proposal sent";
    case "won":
      return "Won";
    case "lost":
      return "Lost";
  }
}

function formatMoney(amountCents: number, currency: string) {
  return new Intl.NumberFormat("en-IE", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
  }).format(amountCents / 100);
}

function formatDate(value: string | Date) {
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

function formatActivityType(type: ActivitySummary["type"]) {
  return type[0].toUpperCase() + type.slice(1);
}

function formatUserRole(role: InvitationFormValues["role"]) {
  if (role === "sales_rep") return "Sales rep";
  return role === "manager" ? "Manager" : "Admin";
}

export default App;
