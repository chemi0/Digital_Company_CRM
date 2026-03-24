export type UserRole = "admin" | "manager" | "sales_rep";

export type CompanyStatus = "lead" | "active_client" | "inactive";

export type AuthOrganization = {
  id: string;
  slug: string;
  name: string;
};

export type AuthMembership = {
  id: string;
  role: UserRole;
};

export type AuthSession = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  lastLoginAt: string | Date | null;
  sessionId: string;
  organization: AuthOrganization;
  membership: AuthMembership;
};

export type LoginCredentials = {
  email: string;
  password: string;
};

export type CompanySummary = {
  id: string;
  organizationId: string;
  name: string;
  status: CompanyStatus;
  website: string | null;
  industry: string | null;
  phone: string | null;
  createdAt: string | Date;
  updatedAt: string | Date;
  contactCount: number;
};

export type CompanyContact = {
  id: string;
  organizationId: string;
  companyId: string;
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string | null;
  jobTitle: string | null;
  isPrimary: boolean;
  createdAt: string | Date;
  updatedAt: string | Date;
};

export type CompanyDetail = Omit<CompanySummary, "contactCount"> & {
  contacts: CompanyContact[];
};

export type ContactCompany = {
  id: string;
  name: string;
};

export type ContactSummary = {
  id: string;
  organizationId: string;
  companyId: string;
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string | null;
  jobTitle: string | null;
  isPrimary: boolean;
  createdAt: string | Date;
  updatedAt: string | Date;
  company: ContactCompany;
};

export type ContactDetail = ContactSummary;

export type CompanyFormValues = {
  name: string;
  status: CompanyStatus;
  website?: string;
  industry?: string;
  phone?: string;
};

export type ContactFormValues = {
  companyId: string;
  firstName: string;
  lastName: string;
  email?: string;
  phone?: string;
  jobTitle?: string;
  isPrimary: boolean;
};

export type DealStage =
  | "new_lead"
  | "contacted"
  | "qualified"
  | "proposal_sent"
  | "won"
  | "lost";
