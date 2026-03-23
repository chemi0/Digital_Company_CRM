import { BriefcaseBusiness, Building2, ChevronLeft, Menu, Users } from "lucide-react";
import type { PropsWithChildren, ReactNode } from "react";
import { NavLink } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type CrmShellProps = PropsWithChildren<{
  title: string;
  eyebrow: string;
  backTo?: string;
  backLabel?: string;
  actions?: ReactNode;
}>;

const navItems = [
  {
    to: "/companies",
    label: "Companies",
    icon: Building2,
  },
  {
    to: "/contacts",
    label: "Contacts",
    icon: Users,
  },
];

export function CrmShell({ title, eyebrow, backTo, backLabel, actions, children }: CrmShellProps) {
  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(255,255,255,0.95),_rgba(250,247,242,1)_45%,_rgba(243,238,229,1)_100%)] text-slate-900">
      <div className="mx-auto flex min-h-screen w-full max-w-[1600px] flex-col md:flex-row">
        <aside className="border-b border-black/5 bg-white/80 px-4 py-4 backdrop-blur md:min-h-screen md:w-72 md:border-r md:border-b-0 md:px-5 md:py-6">
          <div className="mb-8 flex items-center gap-3">
            <div className="flex size-11 items-center justify-center rounded-2xl bg-slate-900 text-white shadow-sm">
              <BriefcaseBusiness className="size-5" />
            </div>
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.24em] text-slate-500">
                Agency CRM
              </p>
              <h1 className="text-lg font-semibold text-slate-900">Atlas Digital</h1>
            </div>
          </div>

          <nav className="grid gap-2">
            {navItems.map(({ to, label, icon: Icon }) => (
              <NavLink
                key={to}
                to={to}
                className={({ isActive }) =>
                  cn(
                    "flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-medium transition-colors",
                    isActive
                      ? "bg-slate-900 text-white shadow-sm"
                      : "text-slate-600 hover:bg-white hover:text-slate-900",
                  )
                }
              >
                <Icon className="size-4" />
                <span>{label}</span>
              </NavLink>
            ))}
          </nav>
        </aside>

        <main className="flex-1 px-4 py-5 md:px-8 md:py-8">
          <header className="mb-6 rounded-[28px] border border-white/70 bg-white/80 px-5 py-5 shadow-[0_24px_80px_-48px_rgba(15,23,42,0.6)] backdrop-blur md:px-7">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div className="space-y-2">
                <div className="flex flex-wrap items-center gap-3">
                  {backTo ? (
                    <Button asChild variant="outline" size="sm">
                      <NavLink to={backTo}>
                        <ChevronLeft className="size-4" />
                        {backLabel ?? "Back"}
                      </NavLink>
                    </Button>
                  ) : (
                    <div className="inline-flex items-center gap-2 rounded-full border border-black/5 bg-slate-100 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                      <Menu className="size-3.5" />
                      Workspace
                    </div>
                  )}
                  <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">
                    {eyebrow}
                  </p>
                </div>
                <h2 className="text-3xl font-semibold tracking-tight text-slate-950">{title}</h2>
              </div>
              {actions ? <div className="flex items-center gap-3">{actions}</div> : null}
            </div>
          </header>

          <div className="grid gap-6">{children}</div>
        </main>
      </div>
    </div>
  );
}

export function SectionCard({
  title,
  description,
  children,
}: PropsWithChildren<{ title: string; description?: string }>) {
  return (
    <section className="rounded-[28px] border border-white/70 bg-white/85 p-5 shadow-[0_24px_80px_-48px_rgba(15,23,42,0.45)] backdrop-blur">
      <header className="mb-5 space-y-1">
        <h3 className="text-lg font-semibold text-slate-950">{title}</h3>
        {description ? <p className="text-sm text-slate-500">{description}</p> : null}
      </header>
      {children}
    </section>
  );
}
