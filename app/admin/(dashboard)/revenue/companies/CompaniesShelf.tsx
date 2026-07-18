"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type MouseEvent,
  type ReactNode,
} from "react";
import { DetailDrawer } from "@/components/admin/DetailDrawer";
import { Badge, statusTone } from "@/components/admin/Badge";
import { formatCents, formatDate, humanize } from "@/lib/admin/format";
import type { Company360 } from "@/lib/admin/companies";
import { CompanyEditForm } from "./CompanyEditForm";
import { getCompanyShelf } from "./actions";
import { activateAffiliate, deactivateAffiliate } from "../affiliates/actions";

// Client-owned shelf for the companies list. One drawer lives at the provider
// level; rows only push the selected company into context. Related data
// (contacts, deals) is fetched lazily on open via a server action — never
// preloaded per row, and never passed through DataTable's server-rendered
// getRowPreview (interactive content there renders with dead clicks).

export type CompanyRow = {
  id: string;
  name: string | null;
  domain: string | null;
  industry: string | null;
  industry_normalized: string | null;
  size_band: string | null;
  country: string | null;
  website: string | null;
  priority: string | null;
  archived_at: string | null;
  created_at: string;
};

const ShelfContext = createContext<{ open: (row: CompanyRow) => void } | null>(null);

export function CompaniesShelfProvider({ children }: { children: ReactNode }) {
  const [selected, setSelected] = useState<CompanyRow | null>(null);
  const open = useCallback((row: CompanyRow) => setSelected(row), []);

  return (
    <ShelfContext.Provider value={{ open }}>
      {children}
      <DetailDrawer
        open={!!selected}
        onClose={() => setSelected(null)}
        eyebrow="Company"
        title={selected?.name || "(no name)"}
      >
        {selected && <CompanyShelfBody row={selected} />}
      </DetailDrawer>
    </ShelfContext.Provider>
  );
}

export function CompanyShelfRow({ row, children }: { row: CompanyRow; children: ReactNode }) {
  const ctx = useContext(ShelfContext);

  // The row itself carries role="button", so exclude it from the interactive-
  // element guard — closest() matches the element AND its ancestors, and a
  // guard that can match the row swallows every click (dead shelf).
  function hitsInnerInteractive(e: { target: EventTarget; currentTarget: HTMLTableRowElement }) {
    const hit = (e.target as HTMLElement).closest("a,button,input,select,label,[role=button]");
    return !!hit && hit !== e.currentTarget;
  }

  function onClick(e: MouseEvent<HTMLTableRowElement>) {
    if (hitsInnerInteractive(e)) return;
    ctx?.open(row);
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLTableRowElement>) {
    if (e.key === "Enter" || e.key === " ") {
      if (hitsInnerInteractive(e)) return;
      e.preventDefault();
      ctx?.open(row);
    }
  }

  return (
    <tr className="is-clickable" onClick={onClick} onKeyDown={onKeyDown} tabIndex={0} role="button" aria-haspopup="dialog">
      {children}
    </tr>
  );
}

// Per-contact affiliate control inside the company shelf. Activating mints (or
// reactivates) their referral code and pre-authorizes portal access; the
// invite email stays held until sent explicitly from the Affiliates shelf.
function AffiliateToggle({
  person,
  onChanged,
}: {
  person: Company360["people"][number];
  onChanged: () => void;
}) {
  const [pending, start] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  function run(fn: () => Promise<{ ok: boolean; error?: string }>) {
    setErr(null);
    start(true);
    void (async () => {
      const r = await fn();
      if (!r.ok) setErr(r.error ?? "Failed.");
      else onChanged();
      start(false);
    })();
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 3 }}>
      {person.affiliateActive ? (
        <>
          <Badge tone="ok">Affiliate{person.affiliateCode ? ` · ${person.affiliateCode}` : ""}</Badge>
          <button type="button" className="admin-btn admin-btn--sm" disabled={pending} onClick={() => run(() => deactivateAffiliate(person.id))}>
            Deactivate
          </button>
        </>
      ) : (
        <button type="button" className="admin-btn admin-btn--sm" disabled={pending} onClick={() => run(() => activateAffiliate(person.id))}>
          Make affiliate
        </button>
      )}
      {err && <span className="admin-cell-muted" style={{ color: "var(--admin-err-ink)", fontSize: 12 }}>{err}</span>}
    </div>
  );
}

function CompanyShelfBody({ row }: { row: CompanyRow }) {
  const router = useRouter();
  const [data, setData] = useState<Company360 | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const r = await getCompanyShelf(row.id);
    setData(r);
    setLoading(false);
  }, [row.id]);

  useEffect(() => {
    setEditing(false);
    void load();
  }, [load]);

  const company = data?.company;

  return (
    <div className="admin-shelf-sections">
      <section>
        <div className="admin-shelf-heading">Contacts</div>
        {loading ? (
          <div className="admin-cell-muted">Loading…</div>
        ) : !data || data.people.length === 0 ? (
          <div className="admin-cell-muted">No linked contacts.</div>
        ) : (
          <div className="admin-list">
            {data.people.map((p) => (
              <div className="admin-list-row" key={p.id}>
                <div className="admin-list-main">
                  <div className="admin-list-title">
                    <Link href={`/admin/contacts/${p.id}`}>{p.full_name || p.email}</Link>
                  </div>
                  {p.full_name && <div className="admin-list-sub">{p.email}</div>}
                </div>
                <div className="admin-list-aside">
                  <AffiliateToggle person={p} onChanged={() => void load()} />
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section>
        <div className="admin-shelf-heading">Deals</div>
        {loading ? (
          <div className="admin-cell-muted">Loading…</div>
        ) : !data || data.deals.length === 0 ? (
          <div className="admin-cell-muted">No deals.</div>
        ) : (
          <div className="admin-list">
            {data.deals.map((d) => (
              <div className="admin-list-row" key={d.id}>
                <div className="admin-list-main">
                  <div className="admin-list-title">{d.title || "Untitled deal"}</div>
                  <div className="admin-list-sub">{formatDate(d.created_at)}</div>
                </div>
                <div className="admin-list-aside">
                  <Badge tone={statusTone(d.status)}>{humanize(d.status) || "Open"}</Badge>
                  {(d.amount_usd_cents ?? d.amount_cents) != null && (
                    <span className="admin-cell-mono">
                      {formatCents(d.amount_usd_cents ?? d.amount_cents, d.amount_usd_cents != null ? "usd" : d.currency ?? "usd")}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section>
        <div className="admin-shelf-heading">
          Company details
          {company && !editing && (
            <button type="button" className="admin-btn admin-btn--primary admin-btn--sm" onClick={() => setEditing(true)}>
              Edit details
            </button>
          )}
        </div>
        {editing && company ? (
          <CompanyEditForm
            company={company}
            onSaved={() => {
              setEditing(false);
              void load();
              router.refresh();
            }}
          />
        ) : (
          <dl className="admin-kv">
            <dt>Industry</dt>
            <dd>{(company?.industry_normalized ?? row.industry_normalized) || "—"}</dd>
            <dt>Size</dt>
            <dd>{(company?.size_band ?? row.size_band) || "—"}</dd>
            <dt>Lifecycle</dt>
            <dd>{company ? humanize(company.lifecycle_stage) : "—"}</dd>
            <dt>Country</dt>
            <dd>{(company?.country ?? row.country) || "—"}</dd>
            <dt>Website</dt>
            <dd>{(company?.website ?? row.website) || "—"}</dd>
            <dt>Priority</dt>
            <dd>{row.priority ? <Badge>{humanize(row.priority)}</Badge> : "—"}</dd>
          </dl>
        )}
      </section>

      {row.archived_at && <Badge tone="neutral">Archived</Badge>}

      <div>
        <Link href={`/admin/revenue/companies/${row.id}`} className="admin-btn admin-btn--primary">
          Open full profile
        </Link>
      </div>
    </div>
  );
}
