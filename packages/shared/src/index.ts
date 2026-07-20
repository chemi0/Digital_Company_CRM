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

export type CompanyOwner = {
  id: string;
  role: UserRole;
  user: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
  };
};

export type CompanySummary = {
  id: string;
  organizationId: string;
  ownerMembershipId: string;
  name: string;
  status: CompanyStatus;
  website: string | null;
  industry: string | null;
  phone: string | null;
  createdAt: string | Date;
  updatedAt: string | Date;
  contactCount: number;
  owner: CompanyOwner;
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
  ownerMembershipId?: string;
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

export type DealCompany = {
  id: string;
  name: string;
};

export type DealPrimaryContact = {
  id: string;
  firstName: string;
  lastName: string;
  email: string | null;
};

export type DealSummary = {
  id: string;
  organizationId: string;
  companyId: string;
  primaryContactId: string | null;
  ownerMembershipId: string;
  title: string;
  stage: DealStage;
  amountCents: number;
  currency: string;
  source: string | null;
  expectedCloseDate: string | Date | null;
  description: string | null;
  createdAt: string | Date;
  updatedAt: string | Date;
  owner: CompanyOwner;
  company: DealCompany;
  primaryContact: DealPrimaryContact | null;
};

export type DealDetail = DealSummary;

export type DealFormValues = {
  companyId: string;
  primaryContactId?: string | null;
  ownerMembershipId?: string;
  title: string;
  stage: DealStage;
  amountCents: number;
  currency: string;
  source?: string | null;
  expectedCloseDate?: string | null;
  description?: string | null;
};

export type ActivityType = "call" | "email" | "meeting" | "note";

export type TaskPriority = "low" | "medium" | "high";

export type WorkContact = {
  id: string;
  firstName: string;
  lastName: string;
};

export type WorkDeal = {
  id: string;
  title: string;
};

export type ActivitySummary = {
  id: string;
  organizationId: string;
  companyId: string;
  contactId: string | null;
  dealId: string | null;
  type: ActivityType;
  subject: string;
  body: string | null;
  occurredAt: string | Date;
  createdAt: string | Date;
  updatedAt: string | Date;
  author: CompanyOwner;
  company: ContactCompany;
  contact: WorkContact | null;
  deal: WorkDeal | null;
};

export type TaskSummary = {
  id: string;
  organizationId: string;
  companyId: string;
  contactId: string | null;
  dealId: string | null;
  assigneeMembershipId: string;
  createdByMembershipId: string;
  title: string;
  description: string | null;
  priority: TaskPriority;
  dueAt: string | Date | null;
  completedAt: string | Date | null;
  createdAt: string | Date;
  updatedAt: string | Date;
  assignee: CompanyOwner;
  createdBy: CompanyOwner;
  company: ContactCompany;
  contact: WorkContact | null;
  deal: WorkDeal | null;
};

export type ActivityFormValues = {
  companyId: string;
  contactId?: string | null;
  dealId?: string | null;
  type: ActivityType;
  subject: string;
  body?: string | null;
  occurredAt?: string;
};

export type TaskFormValues = {
  companyId: string;
  contactId?: string | null;
  dealId?: string | null;
  assigneeMembershipId?: string;
  title: string;
  description?: string | null;
  priority: TaskPriority;
  dueAt?: string | null;
};

export type TaskUpdateValues = Partial<TaskFormValues> & {
  completed?: boolean;
};

export type TeamMember = {
  id: string;
  role: UserRole;
  createdAt: string | Date;
  archivedAt: string | Date | null;
  requiresReactivationInvitation: boolean;
  user: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    isActive: boolean;
    lastLoginAt: string | Date | null;
  };
};

export type InvitationStatus = "pending" | "accepted" | "revoked" | "expired";

export type InvitationSummary = {
  id: string;
  email: string;
  role: UserRole;
  expiresAt: string | Date;
  createdAt: string | Date;
  status: InvitationStatus;
  invitedBy: string;
};

export type InvitationFormValues = {
  email: string;
  role: UserRole;
};

export type InvitationAcceptanceValues = {
  token: string;
  firstName?: string;
  lastName?: string;
  password?: string;
};

export type InvitationPreview = {
  mode: "new_account" | "reactivation";
  organizationName: string;
};
