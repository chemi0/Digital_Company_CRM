import { useQuery } from "@tanstack/react-query";
import { Building2, Handshake, Search, Users, X } from "lucide-react";
import { type ReactNode, useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { searchCrm } from "@/lib/crm-api";

export function GlobalSearch() {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const trimmedQuery = query.trim();
  const searchQuery = useQuery({
    queryKey: ["crm-search", trimmedQuery],
    queryFn: () => searchCrm(trimmedQuery),
    enabled: isOpen && trimmedQuery.length >= 2,
  });
  const results = searchQuery.data;
  const resultCount = (results?.companies.length ?? 0) + (results?.contacts.length ?? 0) + (results?.deals.length ?? 0);

  return (
    <>
      <Button type="button" variant="outline" className="mt-5 w-full justify-start text-slate-600" onClick={() => setIsOpen(true)}>
        <Search className="size-4" />
        Search CRM
      </Button>

      {isOpen ? (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-slate-950/35 px-4 pt-16 backdrop-blur-sm md:pt-24" role="presentation">
          <section role="dialog" aria-modal="true" aria-labelledby="crm-search-title" className="w-full max-w-2xl rounded-[28px] border border-white/70 bg-white p-5 shadow-2xl md:p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Find records</p>
                <h2 id="crm-search-title" className="mt-1 text-xl font-semibold text-slate-950">Search CRM</h2>
              </div>
              <Button type="button" size="icon" variant="ghost" aria-label="Close search" onClick={() => setIsOpen(false)}>
                <X className="size-4" />
              </Button>
            </div>

            <label className="mt-5 block text-sm font-medium text-slate-700" htmlFor="crm-global-search">Search companies, contacts, and deals</label>
            <div className="relative mt-2">
              <Search className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
              <input id="crm-global-search" autoFocus className="input-field pl-11" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Start with at least two characters" />
            </div>

            <div className="mt-5 max-h-[55vh] space-y-5 overflow-y-auto pr-1">
              {trimmedQuery.length < 2 ? <EmptySearchState>Enter at least two characters to search your accessible CRM records.</EmptySearchState> : null}
              {searchQuery.isLoading ? <EmptySearchState>Searching your workspace...</EmptySearchState> : null}
              {searchQuery.isError ? <p className="rounded-2xl bg-rose-50 px-4 py-5 text-sm text-rose-700">Search could not be completed. Please try again.</p> : null}
              {results && resultCount === 0 ? <EmptySearchState>No accessible records match "{trimmedQuery}".</EmptySearchState> : null}
              {results?.companies.length ? <SearchGroup icon={<Building2 className="size-4" />} title="Companies">{results.companies.map((company) => <SearchResult key={company.id} to={`/companies/${company.id}`} title={company.name} detail={company.status.replace("_", " ")} onNavigate={() => setIsOpen(false)} />)}</SearchGroup> : null}
              {results?.contacts.length ? <SearchGroup icon={<Users className="size-4" />} title="Contacts">{results.contacts.map((contact) => <SearchResult key={contact.id} to={`/contacts/${contact.id}`} title={`${contact.firstName} ${contact.lastName}`} detail={`${contact.company.name}${contact.email ? ` - ${contact.email}` : ""}`} onNavigate={() => setIsOpen(false)} />)}</SearchGroup> : null}
              {results?.deals.length ? <SearchGroup icon={<Handshake className="size-4" />} title="Deals">{results.deals.map((deal) => <SearchResult key={deal.id} to={`/deals/${deal.id}`} title={deal.title} detail={`${deal.company.name} - ${deal.stage.replace("_", " ")}`} onNavigate={() => setIsOpen(false)} />)}</SearchGroup> : null}
            </div>
          </section>
        </div>
      ) : null}
    </>
  );
}

function EmptySearchState({ children }: { children: ReactNode }) {
  return <p className="rounded-2xl bg-slate-50 px-4 py-5 text-sm text-slate-500">{children}</p>;
}

function SearchGroup({ title, icon, children }: { title: string; icon: ReactNode; children: ReactNode }) {
  return <section><h3 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">{icon}{title}</h3><div className="mt-2 grid gap-2">{children}</div></section>;
}

function SearchResult({ to, title, detail, onNavigate }: { to: string; title: string; detail: string; onNavigate: () => void }) {
  return <Link to={to} onClick={onNavigate} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 transition hover:border-slate-300 hover:bg-white"><p className="font-semibold text-slate-900">{title}</p><p className="mt-1 text-sm capitalize text-slate-500">{detail}</p></Link>;
}
