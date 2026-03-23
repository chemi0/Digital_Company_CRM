import { zodResolver } from "@hookform/resolvers/zod";
import type { ContactCompany, ContactFormValues } from "@agency-crm/shared";
import type { ReactNode } from "react";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Button } from "@/components/ui/button";

const contactFormSchema = z.object({
  companyId: z.string().trim().min(1, "Company is required"),
  firstName: z.string().trim().min(1, "First name is required"),
  lastName: z.string().trim().min(1, "Last name is required"),
  email: z
    .string()
    .trim()
    .refine((value) => value.length === 0 || z.email().safeParse(value).success, "Enter a valid email"),
  phone: z.string().trim(),
  jobTitle: z.string().trim(),
  isPrimary: z.boolean(),
});

type ContactFormState = z.infer<typeof contactFormSchema>;

type ContactInitialValues = {
  companyId?: string;
  firstName?: string;
  lastName?: string;
  email?: string | null;
  phone?: string | null;
  jobTitle?: string | null;
  isPrimary?: boolean;
};

type ContactFormProps = {
  companies: ContactCompany[];
  initialValues?: ContactInitialValues;
  submitLabel: string;
  onSubmit: (values: ContactFormValues) => Promise<void> | void;
};

function toFormDefaults(initialValues?: ContactInitialValues): ContactFormState {
  return {
    companyId: initialValues?.companyId ?? "",
    firstName: initialValues?.firstName ?? "",
    lastName: initialValues?.lastName ?? "",
    email: initialValues?.email ?? "",
    phone: initialValues?.phone ?? "",
    jobTitle: initialValues?.jobTitle ?? "",
    isPrimary: initialValues?.isPrimary ?? false,
  };
}

function sanitizeContactValues(values: ContactFormState): ContactFormValues {
  return {
    companyId: values.companyId,
    firstName: values.firstName.trim(),
    lastName: values.lastName.trim(),
    email: values.email.trim() || undefined,
    phone: values.phone.trim() || undefined,
    jobTitle: values.jobTitle.trim() || undefined,
    isPrimary: values.isPrimary,
  };
}

export function ContactForm({ companies, initialValues, submitLabel, onSubmit }: ContactFormProps) {
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<ContactFormState>({
    resolver: zodResolver(contactFormSchema),
    defaultValues: toFormDefaults(initialValues),
  });

  useEffect(() => {
    reset(toFormDefaults(initialValues));
  }, [initialValues, reset]);

  return (
    <form className="grid gap-4" onSubmit={handleSubmit((values) => onSubmit(sanitizeContactValues(values)))}>
      <div className="grid gap-4 md:grid-cols-2">
        <FormField label="First name" error={errors.firstName?.message}>
          <input className="input-field" placeholder="Ana" {...register("firstName")} />
        </FormField>

        <FormField label="Last name" error={errors.lastName?.message}>
          <input className="input-field" placeholder="Markovic" {...register("lastName")} />
        </FormField>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <FormField label="Email" error={errors.email?.message}>
          <input className="input-field" placeholder="ana@example.com" {...register("email")} />
        </FormField>

        <FormField label="Phone" error={errors.phone?.message}>
          <input className="input-field" placeholder="+381 64 555 0101" {...register("phone")} />
        </FormField>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <FormField label="Job title" error={errors.jobTitle?.message}>
          <input className="input-field" placeholder="Marketing Lead" {...register("jobTitle")} />
        </FormField>

        <FormField label="Company" error={errors.companyId?.message}>
          <select className="input-field" {...register("companyId")}>
            <option value="">Select a company</option>
            {companies.map((company) => (
              <option key={company.id} value={company.id}>
                {company.name}
              </option>
            ))}
          </select>
        </FormField>
      </div>

      <label className="inline-flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-700">
        <input type="checkbox" className="size-4 rounded border-slate-300" {...register("isPrimary")} />
        Primary contact
      </label>

      <Button type="submit" size="lg" className="justify-center" disabled={isSubmitting}>
        {submitLabel}
      </Button>
    </form>
  );
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
