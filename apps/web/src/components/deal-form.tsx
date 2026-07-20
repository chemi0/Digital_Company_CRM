import { zodResolver } from "@hookform/resolvers/zod";
import type {
  CompanyOwner,
  ContactCompany,
  ContactSummary,
  DealFormValues,
  DealStage,
} from "@agency-crm/shared";
import type { ReactNode } from "react";
import { useEffect } from "react";
import { useForm, useWatch } from "react-hook-form";
import { z } from "zod";
import { Button } from "@/components/ui/button";

const dealFormSchema = z.object({
  companyId: z.string().trim().min(1, "Company is required"),
  primaryContactId: z.string(),
  ownerMembershipId: z.string(),
  title: z.string().trim().min(1, "Deal title is required").max(160),
  stage: z.enum(["new_lead", "contacted", "qualified", "proposal_sent", "won", "lost"]),
  amount: z
    .string()
    .trim()
    .regex(/^\d+(?:\.\d{1,2})?$/, "Enter an amount with up to two decimal places")
    .refine((value) => toAmountCents(value) <= 2_147_483_647, "Amount is too large"),
  currency: z.string().regex(/^[A-Z]{3}$/, "Choose a currency"),
  source: z.string().trim().max(80),
  expectedCloseDate: z.string(),
  description: z.string().trim().max(4_000),
});

type DealFormState = z.infer<typeof dealFormSchema>;

type DealInitialValues = {
  companyId?: string;
  primaryContactId?: string | null;
  ownerMembershipId?: string;
  title?: string;
  stage?: DealStage;
  amountCents?: number;
  currency?: string;
  source?: string | null;
  expectedCloseDate?: string | Date | null;
  description?: string | null;
};

type DealFormProps = {
  companies: ContactCompany[];
  contacts: ContactSummary[];
  owners?: CompanyOwner[];
  canAssignOwner?: boolean;
  initialValues?: DealInitialValues;
  submitLabel: string;
  onSubmit: (values: DealFormValues) => Promise<void> | void;
};

const stageOptions: Array<{ value: DealStage; label: string }> = [
  { value: "new_lead", label: "New lead" },
  { value: "contacted", label: "Contacted" },
  { value: "qualified", label: "Qualified" },
  { value: "proposal_sent", label: "Proposal sent" },
  { value: "won", label: "Won" },
  { value: "lost", label: "Lost" },
];

function toFormDefaults(initialValues?: DealInitialValues): DealFormState {
  return {
    companyId: initialValues?.companyId ?? "",
    primaryContactId: initialValues?.primaryContactId ?? "",
    ownerMembershipId: initialValues?.ownerMembershipId ?? "",
    title: initialValues?.title ?? "",
    stage: initialValues?.stage ?? "new_lead",
    amount: formatAmountInput(initialValues?.amountCents ?? 0),
    currency: initialValues?.currency ?? "EUR",
    source: initialValues?.source ?? "",
    expectedCloseDate: toDateInputValue(initialValues?.expectedCloseDate),
    description: initialValues?.description ?? "",
  };
}

function sanitizeDealValues(values: DealFormState): DealFormValues {
  return {
    companyId: values.companyId,
    primaryContactId: values.primaryContactId || null,
    ownerMembershipId: values.ownerMembershipId || undefined,
    title: values.title.trim(),
    stage: values.stage,
    amountCents: toAmountCents(values.amount),
    currency: values.currency,
    source: values.source.trim() || null,
    expectedCloseDate: values.expectedCloseDate || null,
    description: values.description.trim() || null,
  };
}

// Convert decimal text directly so business amounts never pass through floating-point arithmetic.
function toAmountCents(value: string) {
  const [whole = "0", fraction = ""] = value.trim().split(".");
  return Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
}

function formatAmountInput(amountCents: number) {
  return (amountCents / 100).toFixed(2);
}

function toDateInputValue(value: string | Date | null | undefined) {
  if (!value) {
    return "";
  }

  return new Date(value).toISOString().slice(0, 10);
}

export function DealForm({
  companies,
  contacts,
  owners = [],
  canAssignOwner = false,
  initialValues,
  submitLabel,
  onSubmit,
}: DealFormProps) {
  const {
    control,
    register,
    handleSubmit,
    reset,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<DealFormState>({
    resolver: zodResolver(dealFormSchema),
    defaultValues: toFormDefaults(initialValues),
  });
  const selectedCompanyId = useWatch({ control, name: "companyId" });
  const selectedPrimaryContactId = useWatch({ control, name: "primaryContactId" });
  const availableContacts = contacts.filter((contact) => contact.companyId === selectedCompanyId);

  useEffect(() => {
    reset(toFormDefaults(initialValues));
  }, [initialValues, reset]);

  useEffect(() => {
    if (selectedPrimaryContactId && !availableContacts.some((contact) => contact.id === selectedPrimaryContactId)) {
      setValue("primaryContactId", "");
    }
  }, [availableContacts, selectedPrimaryContactId, setValue]);

  return (
    <form className="grid gap-4" onSubmit={handleSubmit((values) => onSubmit(sanitizeDealValues(values)))}>
      <FormField label="Deal title" error={errors.title?.message}>
        <input className="input-field" placeholder="Website support retainer" {...register("title")} />
      </FormField>

      <div className="grid gap-4 md:grid-cols-2">
        <FormField label="Company" error={errors.companyId?.message}>
          <select className="input-field" {...register("companyId")}>
            <option value="">Select a company</option>
            {companies.map((company) => (
              <option key={company.id} value={company.id}>{company.name}</option>
            ))}
          </select>
        </FormField>

        <FormField label="Primary contact" error={errors.primaryContactId?.message}>
          <select className="input-field" {...register("primaryContactId")}>
            <option value="">No primary contact</option>
            {availableContacts.map((contact) => (
              <option key={contact.id} value={contact.id}>
                {contact.firstName} {contact.lastName}
              </option>
            ))}
          </select>
        </FormField>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <FormField label="Stage" error={errors.stage?.message}>
          <select className="input-field" {...register("stage")}>
            {stageOptions.map((stage) => <option key={stage.value} value={stage.value}>{stage.label}</option>)}
          </select>
        </FormField>

        <FormField label="Amount" error={errors.amount?.message}>
          <input className="input-field" inputMode="decimal" placeholder="1800.00" {...register("amount")} />
        </FormField>

        <FormField label="Currency" error={errors.currency?.message}>
          <select className="input-field" {...register("currency")}>
            <option value="EUR">EUR</option>
            <option value="USD">USD</option>
            <option value="GBP">GBP</option>
          </select>
        </FormField>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <FormField label="Source" error={errors.source?.message}>
          <input className="input-field" placeholder="Referral, inbound, event..." {...register("source")} />
        </FormField>

        <FormField label="Expected close" error={errors.expectedCloseDate?.message}>
          <input className="input-field" type="date" {...register("expectedCloseDate")} />
        </FormField>
      </div>

      {canAssignOwner ? (
        <FormField label="Deal owner" error={errors.ownerMembershipId?.message}>
          <select className="input-field" {...register("ownerMembershipId")}>
            <option value="">Company owner (automatic)</option>
            {owners.map((owner) => (
              <option key={owner.id} value={owner.id}>
                {owner.user.firstName} {owner.user.lastName} ({formatRole(owner.role)})
              </option>
            ))}
          </select>
        </FormField>
      ) : null}

      <FormField label="Notes" error={errors.description?.message}>
        <textarea className="input-field min-h-28 resize-y" placeholder="Context for the account team..." {...register("description")} />
      </FormField>

      <Button type="submit" size="lg" className="justify-center" disabled={isSubmitting}>{submitLabel}</Button>
    </form>
  );
}

function formatRole(role: CompanyOwner["role"]) {
  return role === "sales_rep" ? "Sales rep" : role === "manager" ? "Manager" : "Admin";
}

function FormField({ children, error, label }: { children: ReactNode; error?: string; label: string }) {
  return (
    <label className="grid gap-2 text-sm font-medium text-slate-700">
      <span>{label}</span>
      {children}
      {error ? <span className="text-xs font-medium text-rose-600">{error}</span> : null}
    </label>
  );
}
