import Link from "next/link";
import { notFound } from "next/navigation";
import { getCompany360, getCompanyReferredBy } from "@/lib/admin/companies";
import { getPortalMembershipsForCompany } from "@/lib/admin/portal";
import { getAssignmentsForCompany, listActiveTeamMembers } from "@/lib/admin/staff-assignments";
import { getInvoicesForCompany, getQboCustomerIds } from "@/lib/admin/invoices";
import { PageHead } from "@/components/admin/PageHead";
import { MetricCard } from "@/components/admin/MetricCard";
import { Badge, statusTone } from "@/components/admin/Badge";
import { Tabs, type TabDef } from "@/components/admin/Tabs";
import { formatCents, formatDate, humanize } from "@/lib/admin/format";
import { PortalMemberControls } from "@/components/admin/PortalMemberControls";
import { ViewAsClientButton } from "@/components/admin/ViewAsClientButton";
import { AssignedStaffCard } from "@/components/admin/AssignedStaffCard";
import { InvoicesTab } from "@/components/admin/InvoicesTab";
import { CompanyEditForm } from "../CompanyEditForm";
import { CompanyDangerZone } from "../CompanyDangerZone";

export const dynamic = "force-dynamic";

function Empty({ text }: { text: string }) {
  return <div className="admin-empty">{text}</div>;
}

export default async function CompanyDetailPage({ params }: { params: { id: string } }) {
  const data = await getCompany360(params.id);
  if (!data) notFound();

  const { company, deals, people } = data;
  const name = company.name || "(no name)";
  const [portalMemberships, assignments, assignableTeamMembers, invoices, qboCustomerIds, referredBy] =
    await Promise.all([
      getPortalMembershipsForCompany(company.id),
      getAssignmentsForCompany(company.id),
      listActiveTeamMembers(),
      getInvoicesForCompany(company.id),
      getQboCustomerIds(company.id),
      getCompanyReferredBy(company.id),
    ]);
  const activeMemberCount = [...portalMemberships.values()].filter(
    (m) => m.status === "active",
  ).length;

  // At-a-glance figures for the summary strip.
  const OPEN = new Set(["open", "new_lead", "contacted", "discovery", "proposal"]);
  const dealValueCents = deals.reduce((s, d) => s + (d.amount_usd_cents ?? d.amount_cents ?? 0), 0);
  const openValueCents = deals.reduce(
    (s, d) => s + (OPEN.has((d.status || "").toLowerCase()) ? d.amount_usd_cents ?? d.amount_cents ?? 0 : 0),
    0,
  );
  const lastActivity = deals.reduce<string | null>(
    (latest, d) => (!latest || d.created_at > latest ? d.created_at : latest),
    null,
  );
  const affiliateContacts = people.filter((p) => p.affiliateActive);
  const hasReferralContext = referredBy.length > 0 || affiliateContacts.length > 0;

  const tabs: TabDef[] = [
    {
      key: "deals",
      label: "Deals",
      count: deals.length,
      content:
        deals.length === 0 ? (
          <Empty text="No deals." />
        ) : (
          <div className="admin-list">
            {deals.map((d) => (
              <div className="admin-list-row" key={d.id}>
                <div className="admin-list-main">
                  <div className="admin-list-title">{d.title || "Untitled deal"}</div>
                  <div className="admin-list-sub">{formatDate(d.created_at)}</div>
                </div>
                <div className="admin-list-aside">
                  <strong className="admin-cell-mono">{formatCents(d.amount_usd_cents, "usd")}</strong>

                  <Badge tone={statusTone(d.status)}>{humanize(d.status)}</Badge>
                </div>
              </div>
            ))}
          </div>
        ),
    },
    {
      key: "people",
      label: "People",
      count: people.length,
      content:
        people.length === 0 ? (
          <Empty text="No linked people." />
        ) : (
          <div className="admin-list">
            {people.map((p) => (
              <div className="admin-list-row" key={p.id}>
                <div className="admin-list-main">
                  <div className="admin-list-title">
                    <Link href={`/admin/contacts/${p.id}`}>{p.full_name || p.email}</Link>
                  </div>
                  <div className="admin-list-sub">{p.email}</div>
                </div>
              </div>
            ))}
          </div>
        ),
    },
    {
      key: "portal",
      label: "Portal",
      count: activeMemberCount,
      content:
        people.length === 0 ? (
          <Empty text="Link a contact on the People tab first, then invite them here." />
        ) : (
          <div>
            <div style={{ marginBottom: 12 }}>
              <ViewAsClientButton companyId={company.id} />
            </div>
            <div className="admin-list">
            {people.map((p) => {
              const membership = portalMemberships.get(p.id);
              return (
                <div className="admin-list-row" key={p.id}>
                  <div className="admin-list-main">
                    <div className="admin-list-title">
                      <Link href={`/admin/contacts/${p.id}`}>{p.full_name || p.email}</Link>
                    </div>
                    <div className="admin-list-sub">{p.email}</div>
                  </div>
                  <div className="admin-list-aside">
                    <PortalMemberControls
                      personId={p.id}
                      companyId={company.id}
                      active={membership?.status === "active"}
                    />
                  </div>
                </div>
              );
            })}
            </div>
          </div>
        ),
    },
    {
      key: "invoices",
      label: "Invoices",
      count: invoices.length,
      content: (
        <InvoicesTab companyId={company.id} invoices={invoices} qboCustomerIds={qboCustomerIds} />
      ),
    },
  ];

  return (
    <>
      <PageHead
        eyebrow={<Link href="/admin/revenue/companies">← Companies</Link>}
        title={name}
        sub={company.domain || company.website || undefined}
        action={
          <span style={{ display: "inline-flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
            {company.archived_at && <Badge tone="neutral">Archived</Badge>}
            {company.priority && <Badge>{humanize(company.priority)}</Badge>}
          </span>
        }
      />

      <div className="mp-kpi-grid" style={{ marginBottom: 16 }}>
        <MetricCard label="Stage" value={humanize(company.lifecycle_stage) || "—"} sub={`Added ${formatDate(company.created_at)}`} />
        <MetricCard label="Deals" value={deals.length} sub={dealValueCents ? `${formatCents(dealValueCents, "usd")} total` : "no value yet"} />
        <MetricCard label="Open pipeline" value={openValueCents ? formatCents(openValueCents, "usd") : "—"} sub={lastActivity ? `last deal ${formatDate(lastActivity)}` : "no deals"} />
        <MetricCard label="People" value={people.length} sub={`${activeMemberCount} with portal`} />
        <MetricCard label="Invoices" value={invoices.length} sub={invoices.length ? "in QuickBooks" : "none synced"} />
      </div>

      <div className="admin-card admin-section-card" style={{ marginBottom: 16 }}>
        <div className="admin-shelf-heading" style={{ marginBottom: 8 }}>Referral &amp; affiliates</div>
        {hasReferralContext ? (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 24 }}>
            {referredBy.length > 0 && (
              <div>
                <div className="admin-cell-muted" style={{ fontSize: 12, marginBottom: 2 }}>Referred by</div>
                <div className="admin-cell-strong">{referredBy.join(", ")}</div>
              </div>
            )}
            {affiliateContacts.length > 0 && (
              <div>
                <div className="admin-cell-muted" style={{ fontSize: 12, marginBottom: 4 }}>Affiliate contacts</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                  {affiliateContacts.map((p) => (
                    <Link key={p.id} href={`/admin/contacts/${p.id}`} style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                      {p.full_name || p.email}
                      {p.affiliateCode && <Badge tone="ok">{p.affiliateCode}</Badge>}
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="admin-cell-muted">
            No referral link. Any contact here can be made an affiliate from the{" "}
            <Link href="/admin/revenue/affiliates">Affiliates</Link> page or the company shelf.
          </div>
        )}
      </div>

      <div className="admin-360">
        <div>
          <div className="admin-card admin-section-card">
            <CompanyEditForm
              company={{
                id: company.id,
                name: company.name,
                domain: company.domain,
                industry: company.industry,
                size_band: company.size_band,
                country: company.country,
                website: company.website,
                priority: company.priority,
                notes: company.notes,
              }}
              showNotes
            />
          </div>
          <AssignedStaffCard
            companyId={company.id}
            assignments={assignments}
            teamMembers={assignableTeamMembers}
          />

          <div className="admin-card admin-section-card">
            <CompanyDangerZone companyId={company.id} companyName={name} archived={!!company.archived_at} />
          </div>
        </div>

        <div className="admin-card admin-section-card">
          <Tabs tabs={tabs} />
        </div>
      </div>
    </>
  );
}
