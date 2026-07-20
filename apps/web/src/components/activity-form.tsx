import { zodResolver } from "@hookform/resolvers/zod";
import type { ActivityFormValues, ActivityType, ContactCompany, ContactSummary, DealSummary } from "@agency-crm/shared";
import type { ReactNode } from "react";
import { useEffect } from "react";
import { useForm, useWatch } from "react-hook-form";
import { z } from "zod";
import { Button } from "@/components/ui/button";

const activitySchema = z.object({
  companyId: z.string().min(1, "Company is required"), contactId: z.string(), dealId: z.string(),
  type: z.enum(["call", "email", "meeting", "note"]), subject: z.string().trim().min(1, "Subject is required").max(160), body: z.string().trim().max(4_000),
});
type ActivityState = z.infer<typeof activitySchema>;
type ActivityFormProps = { companies: ContactCompany[]; contacts: ContactSummary[]; deals: DealSummary[]; submitLabel: string; onSubmit: (values: ActivityFormValues) => Promise<void> | void };

export function ActivityForm({ companies, contacts, deals, submitLabel, onSubmit }: ActivityFormProps) {
  const { control, register, handleSubmit, setValue, formState: { errors, isSubmitting } } = useForm<ActivityState>({ resolver: zodResolver(activitySchema), defaultValues: { companyId: "", contactId: "", dealId: "", type: "note", subject: "", body: "" } });
  const companyId = useWatch({ control, name: "companyId" });
  const contactId = useWatch({ control, name: "contactId" });
  const dealId = useWatch({ control, name: "dealId" });
  const companyContacts = contacts.filter((contact) => contact.companyId === companyId);
  const companyDeals = deals.filter((deal) => deal.companyId === companyId);
  useEffect(() => { if (contactId && !companyContacts.some((contact) => contact.id === contactId)) setValue("contactId", ""); if (dealId && !companyDeals.some((deal) => deal.id === dealId)) setValue("dealId", ""); }, [companyContacts, companyDeals, contactId, dealId, setValue]);

  return <form className="grid gap-4" onSubmit={handleSubmit((values) => onSubmit({ companyId: values.companyId, contactId: values.contactId || null, dealId: values.dealId || null, type: values.type as ActivityType, subject: values.subject.trim(), body: values.body.trim() || null }))}>
    <div className="grid gap-4 md:grid-cols-2"><Field label="Activity type"><select className="input-field" {...register("type")}><option value="note">Note</option><option value="call">Call</option><option value="email">Email</option><option value="meeting">Meeting</option></select></Field><Field label="Subject" error={errors.subject?.message}><input className="input-field" placeholder="Discovery call completed" {...register("subject")} /></Field></div>
    <div className="grid gap-4 md:grid-cols-2"><Field label="Company" error={errors.companyId?.message}><select className="input-field" {...register("companyId")}><option value="">Select a company</option>{companies.map((company) => <option key={company.id} value={company.id}>{company.name}</option>)}</select></Field><Field label="Contact"><select className="input-field" {...register("contactId")}><option value="">No contact</option>{companyContacts.map((contact) => <option key={contact.id} value={contact.id}>{contact.firstName} {contact.lastName}</option>)}</select></Field></div>
    <Field label="Deal"><select className="input-field" {...register("dealId")}><option value="">No deal</option>{companyDeals.map((deal) => <option key={deal.id} value={deal.id}>{deal.title}</option>)}</select></Field>
    <Field label="Details" error={errors.body?.message}><textarea className="input-field min-h-24 resize-y" placeholder="Capture the important context for your team." {...register("body")} /></Field>
    <Button type="submit" size="lg" className="justify-center" disabled={isSubmitting}>{submitLabel}</Button>
  </form>;
}

function Field({ children, error, label }: { children: ReactNode; error?: string; label: string }) { return <label className="grid gap-2 text-sm font-medium text-slate-700"><span>{label}</span>{children}{error ? <span className="text-xs font-medium text-rose-600">{error}</span> : null}</label>; }
