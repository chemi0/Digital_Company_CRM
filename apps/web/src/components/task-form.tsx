import { zodResolver } from "@hookform/resolvers/zod";
import type { CompanyOwner, ContactCompany, ContactSummary, DealSummary, TaskFormValues, TaskPriority } from "@agency-crm/shared";
import type { ReactNode } from "react";
import { useEffect } from "react";
import { useForm, useWatch } from "react-hook-form";
import { z } from "zod";
import { Button } from "@/components/ui/button";

const taskSchema = z.object({
  companyId: z.string().min(1, "Company is required"),
  contactId: z.string(),
  dealId: z.string(),
  assigneeMembershipId: z.string(),
  title: z.string().trim().min(1, "Task title is required").max(160),
  description: z.string().trim().max(4_000),
  priority: z.enum(["low", "medium", "high"]),
  dueAt: z.string(),
});

type TaskState = z.infer<typeof taskSchema>;
type TaskFormProps = {
  companies: ContactCompany[];
  contacts: ContactSummary[];
  deals: DealSummary[];
  owners?: CompanyOwner[];
  canAssignOwner?: boolean;
  submitLabel: string;
  onSubmit: (values: TaskFormValues) => Promise<void> | void;
};

export function TaskForm({ companies, contacts, deals, owners = [], canAssignOwner = false, submitLabel, onSubmit }: TaskFormProps) {
  const { control, register, handleSubmit, setValue, formState: { errors, isSubmitting } } = useForm<TaskState>({
    resolver: zodResolver(taskSchema),
    defaultValues: { companyId: "", contactId: "", dealId: "", assigneeMembershipId: "", title: "", description: "", priority: "medium", dueAt: "" },
  });
  const companyId = useWatch({ control, name: "companyId" });
  const contactId = useWatch({ control, name: "contactId" });
  const dealId = useWatch({ control, name: "dealId" });
  const companyContacts = contacts.filter((contact) => contact.companyId === companyId);
  const companyDeals = deals.filter((deal) => deal.companyId === companyId);

  useEffect(() => {
    if (contactId && !companyContacts.some((contact) => contact.id === contactId)) setValue("contactId", "");
    if (dealId && !companyDeals.some((deal) => deal.id === dealId)) setValue("dealId", "");
  }, [companyContacts, companyDeals, contactId, dealId, setValue]);

  return (
    <form className="grid gap-4" onSubmit={handleSubmit((values) => onSubmit({
      companyId: values.companyId, contactId: values.contactId || null, dealId: values.dealId || null,
      assigneeMembershipId: values.assigneeMembershipId || undefined, title: values.title.trim(),
      description: values.description.trim() || null, priority: values.priority, dueAt: values.dueAt || null,
    }))}>
      <Field label="Task" error={errors.title?.message}><input className="input-field" placeholder="Send proposal recap" {...register("title")} /></Field>
      <div className="grid gap-4 md:grid-cols-2">
        <Field label="Company" error={errors.companyId?.message}><select className="input-field" {...register("companyId")}><option value="">Select a company</option>{companies.map((company) => <option key={company.id} value={company.id}>{company.name}</option>)}</select></Field>
        <Field label="Due date"><input className="input-field" type="date" {...register("dueAt")} /></Field>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <Field label="Contact"><select className="input-field" {...register("contactId")}><option value="">No contact</option>{companyContacts.map((contact) => <option key={contact.id} value={contact.id}>{contact.firstName} {contact.lastName}</option>)}</select></Field>
        <Field label="Deal"><select className="input-field" {...register("dealId")}><option value="">No deal</option>{companyDeals.map((deal) => <option key={deal.id} value={deal.id}>{deal.title}</option>)}</select></Field>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <Field label="Priority"><select className="input-field" {...register("priority")}>{(["low", "medium", "high"] as TaskPriority[]).map((priority) => <option key={priority} value={priority}>{priority[0].toUpperCase() + priority.slice(1)}</option>)}</select></Field>
        {canAssignOwner ? <Field label="Assignee"><select className="input-field" {...register("assigneeMembershipId")}><option value="">Assign to me</option>{owners.map((owner) => <option key={owner.id} value={owner.id}>{owner.user.firstName} {owner.user.lastName}</option>)}</select></Field> : null}
      </div>
      <Field label="Details" error={errors.description?.message}><textarea className="input-field min-h-24 resize-y" placeholder="What does the next step need?" {...register("description")} /></Field>
      <Button type="submit" size="lg" className="justify-center" disabled={isSubmitting}>{submitLabel}</Button>
    </form>
  );
}

function Field({ children, error, label }: { children: ReactNode; error?: string; label: string }) {
  return <label className="grid gap-2 text-sm font-medium text-slate-700"><span>{label}</span>{children}{error ? <span className="text-xs font-medium text-rose-600">{error}</span> : null}</label>;
}
