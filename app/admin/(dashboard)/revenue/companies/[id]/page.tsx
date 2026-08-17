import Link from "next/link";
import { notFound } from "next/navigation";
import { getCompany360, getCompanyReferredBy } from "@/lib/admin/companies";
import { getPortalMembershipsForCompany } from "@/lib/admin/portal";
import { getAssignmentsForCompany, listActiveTeamMembers } from "@/lib/admin/staff-assignments";
import { getInvoicesForCompany, getQboCustomerIds } from "@/lib/admin/invoices";
import { getMeetingsForCompany } from "@/lib/admin/meetings";
import { PageHead } from "@/components/admin/PageHead";
import { MetricCard } from "@/components/admin/MetricCard";
import { Badge, statusTone } from "@/components/admin/Badge";
import { Tabs, type TabDef } from "@/components/admin/Tabs";
import { formatCents, formatDate, humanize } from "@/lib/admin/format";
import { PortalMemberControls } from "@/components/admin/PortalMemberControls";
import { CrmCommandBar } from "@/components/admin/CrmCommandBar";
import { AssignedStaffCard } from "@/components/admin/AssignedStaffCard";
import { InvoicesTab } from "@/components/admin/InvoicesTab";
import { MeetingsTable } from "@/components/admin/MeetingsTable";
import { CompanyDocuments, type ProgramOption } from "@/components/admin/CompanyDocuments";
import { listDocumentsForCompanies } from "@/lib/client-documents";
import { companyOs } from "@/lib/supabase";
import { CompanyDetailsCard } from "../CompanyDetailsCard";
import { CompanyDangerZone } from "../CompanyDangerZone";

export const dynamic = "force-dynamic";

function Empty({ text }: { text: string }) {
  return <div className="admin-empty">{text}</div>;
}

export default async function CompanyDetailPage({ params }: { params: { id: string } }) {
  const data = await getCompany360(params.id);
  if (!data) notFound();

  const { company, deals, people, affiliate: companyAffiliate } = data;
  const name = company.name || "(no name)";
  const [portalMemberships, assignments, assignableTeamMembers, invoices, qboCustomerIds, referredBy, meetings, documents, programRows] =
    await Promise.all([
      getPortalMembershipsForCompany(company.id),
      getAssignmentsForCompany(company.id),
      listActiveTeamMembers(),
      getInvoicesForCompany(company.id),
      getQboCustomerIds(company.id),
      getCompanyReferredBy(company.id),
      getMeetingsForCompany(company.id),
      listDocumentsForCompanies([company.id]),
      companyOs.from("ai_programs").select("id, name").eq("company_id", company.id).order("created_at", { ascending: false }),
    ]);
  const programOptions = ((programRows.data ?? []) as ProgramOption[]);
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
  const showAffiliateCard = !!companyAffiliate?.active || affiliateContacts.length > 0;

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
                      role={membership?.role}
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
    {
      key: "documents",
      label: "Documents",
      count: documents.length,
      content: (
        <CompanyDocuments companyId={company.id} documents={documents} programs={programOptions} />
      ),
    },
    {
      key: "meetings",
      label: "Meeting Notes",
      count: meetings.length,
      content: (
        <div>
          <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 12 }}>
            <Link
              className="admin-btn admin-btn--primary"
              href={`/admin/revenue/meetings/new?company=${company.id}`}
            >
              Add meeting
            </Link>
          </div>
          <MeetingsTable meetings={meetings} />
        </div>
      ),
    },
  ];

  return (
    <div>
      <PageHead
        eyebrow={<Link href="/admin/revenue/companies">← Companies</Link>}
        title={name}
        sub={company.website_url || undefined}
        action={
          <div style={{ display: "flex", flexDirection: "column", gap: 8, alignItems: "flex-end" }}>
            <span style={{ display: "inline-flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
              {company.archived_at && <Badge tone="neutral">Archived</Badge>}
              {company.priority && <Badge>{humanize(company.priority)}</Badge>}
            </span>
            <CrmCommandBar
              kind="company"
              id={company.id}
              name={name}
              archived={!!company.archived_at}
              assumeCompanyId={company.id}
              affiliate={{ active: !!companyAffiliate?.active, code: companyAffiliate?.code ?? null }}
            />
          </div>
        }
      />

      <div className="mp-kpi-grid" style={{ marginBottom: 16 }}>
        <MetricCard label="Stage" value={humanize(company.lifecycle_stage) || "—"} sub={`Added ${formatDate(company.created_at)}`} />
        <MetricCard label="Deals" value={deals.length} sub={dealValueCents ? `${formatCents(dealValueCents, "usd")} total` : "no value yet"} />
        <MetricCard label="Open pipeline" value={openValueCents ? formatCents(openValueCents, "usd") : "—"} sub={lastActivity ? `last deal ${formatDate(lastActivity)}` : "no deals"} />
        <MetricCard label="People" value={people.length} sub={`${activeMemberCount} with portal`} />
        <MetricCard label="Invoices" value={invoices.length} sub={invoices.length ? "in QuickBooks" : "none synced"} />
        {companyAffiliate?.active && (
          <MetricCard
            label="Commissions"
            value={formatCents(companyAffiliate.realizedCents, "usd")}
            sub={companyAffiliate.unpaidCents > 0 ? `${formatCents(companyAffiliate.unpaidCents, "usd")} unpaid` : "as an affiliate"}
          />
        )}
      </div>

      <div className="admin-360 admin-360--wide">
        <div>
          <CompanyDetailsCard
            company={{
              id: company.id,
              name: company.name,
              website_url: company.website_url,
              industry_normalized: company.industry_normalized,
              size_band: company.size_band,
              country: company.country,
              priority: company.priority,
              notes: company.notes,
              created_at: company.created_at,
            }}
            referredBy={referredBy}
          />

          {showAffiliateCard && (
            <div className="admin-card admin-section-card">
              <h2 className="admin-card-title">Referral &amp; affiliates</h2>
              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                {companyAffiliate?.active && (
                  <div>
                    <div className="admin-cell-muted" style={{ fontSize: 12, marginBottom: 4 }}>This company is an affiliate</div>
                    <div style={{ display: "inline-flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                      {companyAffiliate.code && <Badge tone="ok">{companyAffiliate.code}</Badge>}
                      <span className="admin-cell-strong">{formatCents(companyAffiliate.realizedCents, "usd")} earned</span>
                      {companyAffiliate.unpaidCents > 0 && (
                        <span className="admin-cell-muted">· {formatCents(companyAffiliate.unpaidCents, "usd")} unpaid</span>
                      )}
                      {companyAffiliate.pendingCount > 0 && <Badge tone="warn">{companyAffiliate.pendingCount} pending choice</Badge>}
                    </div>
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
            </div>
          )}

          <AssignedStaffCard
            companyId={company.id}
            assignments={assignments}
            teamMembers={assignableTeamMembers}
          />

          <div className="admin-card admin-section-card">
            <CompanyDangerZone companyId={company.id} companyName={name} />
          </div>
        </div>

        <div className="admin-card admin-section-card">
          <Tabs tabs={tabs} />
        </div>
      </div>
    </div>
  );
}
