import { zodResolver } from "@hookform/resolvers/zod";
import type { CompanyFormValues, CompanyOwner, CompanyStatus } from "@agency-crm/shared";
import type { ReactNode } from "react";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Button } from "@/components/ui/button";

const companyFormSchema = z.object({
  name: z.string().trim().min(1, "Company name is required"),
  status: z.enum(["lead", "active_client", "inactive"]),
  website: z
    .string()
    .trim()
    .refine((value) => value.length === 0 || z.url().safeParse(value).success, "Enter a valid website"),
  industry: z.string().trim(),
  phone: z.string().trim(),
  ownerMembershipId: z.string(),
});

type CompanyFormState = z.infer<typeof companyFormSchema>;

type CompanyInitialValues = {
  name?: string;
  status?: CompanyStatus;
  website?: string | null;
  industry?: string | null;
  phone?: string | null;
  ownerMembershipId?: string;
};

type CompanyFormProps = {
  initialValues?: CompanyInitialValues;
  owners?: CompanyOwner[];
  canAssignOwner?: boolean;
  submitLabel: string;
  onSubmit: (values: CompanyFormValues) => Promise<void> | void;
};

const statusOptions: Array<{ value: CompanyStatus; label: string }> = [
  { value: "lead", label: "Lead" },
  { value: "active_client", label: "Active client" },
  { value: "inactive", label: "Inactive" },
];

function toFormDefaults(initialValues?: CompanyInitialValues): CompanyFormState {
  return {
    name: initialValues?.name ?? "",
    status: initialValues?.status ?? "lead",
    website: initialValues?.website ?? "",
    industry: initialValues?.industry ?? "",
    phone: initialValues?.phone ?? "",
    ownerMembershipId: initialValues?.ownerMembershipId ?? "",
  };
}

function sanitizeCompanyValues(values: CompanyFormState): CompanyFormValues {
  return {
    name: values.name.trim(),
    status: values.status,
    website: values.website.trim() || undefined,
    industry: values.industry.trim() || undefined,
    phone: values.phone.trim() || undefined,
    ownerMembershipId: values.ownerMembershipId || undefined,
  };
}

export function CompanyForm({
  initialValues,
  owners = [],
  canAssignOwner = false,
  submitLabel,
  onSubmit,
}: CompanyFormProps) {
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<CompanyFormState>({
    resolver: zodResolver(companyFormSchema),
    defaultValues: toFormDefaults(initialValues),
  });

  useEffect(() => {
    reset(toFormDefaults(initialValues));
  }, [initialValues, reset]);

  return (
    <form className="grid gap-4" onSubmit={handleSubmit((values) => onSubmit(sanitizeCompanyValues(values)))}>
      <FormField label="Company name" error={errors.name?.message}>
        <input className="input-field" placeholder="Acme Studio" {...register("name")} />
      </FormField>

      <FormField label="Status" error={errors.status?.message}>
        <select className="input-field" {...register("status")}>
          {statusOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </FormField>

      <div className="grid gap-4 md:grid-cols-2">
        <FormField label="Website" error={errors.website?.message}>
          <input className="input-field" placeholder="https://example.com" {...register("website")} />
        </FormField>

        <FormField label="Industry" error={errors.industry?.message}>
          <input className="input-field" placeholder="Creative Services" {...register("industry")} />
        </FormField>
      </div>

      <FormField label="Phone" error={errors.phone?.message}>
        <input className="input-field" placeholder="+381 11 555 0101" {...register("phone")} />
      </FormField>

      {canAssignOwner ? (
        <FormField label="Account owner" error={errors.ownerMembershipId?.message}>
          <select className="input-field" {...register("ownerMembershipId")}>
            <option value="">Assign to me</option>
            {owners.map((owner) => (
              <option key={owner.id} value={owner.id}>
                {owner.user.firstName} {owner.user.lastName} ({formatRole(owner.role)})
              </option>
            ))}
          </select>
        </FormField>
      ) : null}

      <Button type="submit" size="lg" className="justify-center" disabled={isSubmitting}>
        {submitLabel}
      </Button>
    </form>
  );
}

function formatRole(role: CompanyOwner["role"]) {
  switch (role) {
    case "admin":
      return "Admin";
    case "manager":
      return "Manager";
    case "sales_rep":
      return "Sales rep";
  }
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
