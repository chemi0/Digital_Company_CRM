import { zodResolver } from "@hookform/resolvers/zod";
import type { LoginCredentials } from "@agency-crm/shared";
import type { ReactNode } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Button } from "@/components/ui/button";

const loginFormSchema = z.object({
  email: z.email("Enter a valid email address"),
  password: z.string().min(1, "Password is required"),
});

type LoginFormState = z.infer<typeof loginFormSchema>;

type LoginFormProps = {
  initialValues?: LoginCredentials;
  errorMessage?: string | null;
  isSubmitting?: boolean;
  onSubmit: (values: LoginCredentials) => Promise<void> | void;
};

function toFormDefaults(initialValues?: LoginCredentials): LoginFormState {
  return {
    email: initialValues?.email ?? "",
    password: initialValues?.password ?? "",
  };
}

export function LoginForm({ initialValues, errorMessage, isSubmitting, onSubmit }: LoginFormProps) {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormState>({
    resolver: zodResolver(loginFormSchema),
    defaultValues: toFormDefaults(initialValues),
  });

  return (
    <form className="grid gap-4" onSubmit={handleSubmit((values) => onSubmit(values))}>
      <FormField label="Email" error={errors.email?.message}>
        <input className="input-field" autoComplete="email" placeholder="owner@atlas-digital.test" {...register("email")} />
      </FormField>

      <FormField label="Password" error={errors.password?.message}>
        <input
          className="input-field"
          type="password"
          autoComplete="current-password"
          placeholder="Enter your password"
          {...register("password")}
        />
      </FormField>

      {errorMessage ? (
        <p className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">
          {errorMessage}
        </p>
      ) : null}

      <Button type="submit" size="lg" className="justify-center" disabled={isSubmitting}>
        Sign in
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
