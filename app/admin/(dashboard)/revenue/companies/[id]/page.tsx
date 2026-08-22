import Link from "next/link";
import { notFound } from "next/navigation";
import { getCompany360, getCompanyReferredBy } from "@/lib/admin/companies";
import { getPortalMembershipsForCompany } from "@/lib/admin/portal";
import { getAssignmentsForCompany, listActiveTeamMembers } from "@/lib/admin/staff-assignments";
import { getInvoicesForCompany } from "@/lib/admin/invoices";
import { getMeetingsForCompany } from "@/lib/admin/meetings";
import { getSurveyResponsesForCompany } from "@/lib/admin/surveys";
import { getBoardBySlug, listBoardManageOptions } from "@/lib/boards/data";
import { listDocumentsForCompanies } from "@/lib/client-documents";
import { getCompanyHubTeam, getCompanyBoardSlug, getLiveCardItemIds } from "@/lib/admin/company-hub";
import { BACKLOG_SELECT, ROADMAP_GROUPS_SELECT, type BacklogItem, type RoadmapGroup } from "@/lib/client-backlog";
import { getAdminUser } from "@/lib/admin-auth";
import { PageHead } from "@/components/admin/PageHead";
import { Badge } from "@/components/admin/Badge";
import { Tabs, type TabDef } from "@/components/admin/Tabs";
import { formatCents, formatDate, humanize } from "@/lib/admin/format";
import { PortalMemberControls } from "@/components/admin/PortalMemberControls";
import { CrmCommandBar } from "@/components/admin/CrmCommandBar";
import { AssignedStaffCard } from "@/components/admin/AssignedStaffCard";
import { CompanyDocuments, type ProgramOption } from "@/components/admin/CompanyDocuments";
import { MeetingsPanel } from "@/components/hub/MeetingsPanel";
import { InvoicesPanel } from "@/components/hub/InvoicesPanel";
import { HubTeamPanel } from "@/components/hub/HubTeamPanel";
import { BoardView } from "@/app/admin/(dashboard)/boards/[slug]/BoardView";
import { BacklogAdminEditor } from "@/app/admin/(dashboard)/edges/client-roadmaps/BacklogAdminEditor";
import { OverviewEditor } from "@/app/admin/(dashboard)/edges/client-roadmaps/OverviewEditor";
import { setMeetingPublished } from "@/app/admin/(dashboard)/revenue/meetings/actions";
import { companyOs } from "@/lib/supabase";
import { firstParam, mergeQuery, type SearchParamsObj } from "@/lib/admin/url";
import { CompanyDetailsCard } from "../CompanyDetailsCard";
import { CompanyDangerZone } from "../CompanyDangerZone";

export const dynamic = "force-dynamic";

const CLIENT_STAGES = new Set(["customer", "evangelist"]);

function Empty({ text }: { text: string }) {
  return <div className="admin-empty">{text}</div>;
}

export default async function CompanyDetailPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: SearchParamsObj;
}) {
  const data = await getCompany360(params.id);
  if (!data) notFound();

  const { company, deals, people, affiliate: companyAffiliate } = data;
  const name = company.name || "(no name)";
  const isClient = CLIENT_STAGES.has((company.lifecycle_stage || "").toLowerCase());

  const viewParam = firstParam(searchParams.view);
  const view = viewParam === "hub" ? "hub" : viewParam === "internal" ? "internal" : isClient ? "hub" : "internal";

  const dealValueCents = deals.reduce((s, d) => s + (d.amount_usd_cents ?? d.amount_cents ?? 0), 0);
  const affiliateContacts = people.filter((p) => p.affiliateActive);
  const showAffiliateCard = !!companyAffiliate?.active || affiliateContacts.length > 0;

  // ── Internal tabs ────────────────────────────────────────────────
  async function internalTabs(): Promise<TabDef[]> {
    const [portalMemberships, assignments, assignableTeamMembers, referredBy, surveys] = await Promise.all([
      getPortalMembershipsForCompany(company.id),
      getAssignmentsForCompany(company.id),
      listActiveTeamMembers(),
      getCompanyReferredBy(company.id),
      getSurveyResponsesForCompany(company.id),
    ]);
    const activeMemberCount = [...portalMemberships.values()].filter((m) => m.status === "active").length;

    return [
      {
        key: "details",
        label: "Details",
        content: (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
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
            <div className="admin-card admin-section-card">
              <CompanyDangerZone companyId={company.id} companyName={name} />
            </div>
          </div>
        ),
      },
      {
        key: "people",
        label: "People & access",
        count: activeMemberCount,
        content:
          people.length === 0 ? (
            <Empty text="No linked people yet. Link a contact from the CRM to invite them to the portal." />
          ) : (
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
          ),
      },
      {
        key: "staffing",
        label: "Staffing",
        count: assignments.length,
        content: (
          <AssignedStaffCard companyId={company.id} assignments={assignments} teamMembers={assignableTeamMembers} />
        ),
      },
      {
        key: "surveys",
        label: "Surveys",
        count: surveys.length,
        content:
          surveys.length === 0 ? (
            <Empty text="No survey responses from this company's people yet." />
          ) : (
            <div className="admin-list">
              {surveys.map((s) => (
                <div className="admin-list-row" key={s.id}>
                  <div className="admin-list-main">
                    <div className="admin-list-title">{s.surveyName}</div>
                    <div className="admin-list-sub">{s.respondentName}</div>
                  </div>
                  <div className="admin-list-aside">
                    <Badge tone="neutral">{formatDate(s.submittedAt)}</Badge>
                  </div>
                </div>
              ))}
            </div>
          ),
      },
    ];
  }

  // ── Client Hub tabs ──────────────────────────────────────────────
  async function hubTabs(): Promise<TabDef[]> {
    const boardSlug = await getCompanyBoardSlug(company.id);
    const [boardDetail, boardOptions, admin, itemRows, groupRows, overviewRow, meetings, invoices, team, documents, programRows] =
      await Promise.all([
        boardSlug ? getBoardBySlug(boardSlug) : Promise.resolve(null),
        listBoardManageOptions(),
        getAdminUser(),
        companyOs.from("client_backlog_items").select(BACKLOG_SELECT).eq("company_id", company.id).is("archived_at", null).order("sort_order", { ascending: true }),
        companyOs.from("client_roadmap_groups").select(ROADMAP_GROUPS_SELECT).eq("company_id", company.id).is("archived_at", null).order("sort_order", { ascending: true }),
        companyOs.from("client_roadmap_overview").select("body").eq("company_id", company.id).maybeSingle(),
        getMeetingsForCompany(company.id),
        getInvoicesForCompany(company.id),
        getCompanyHubTeam(company.id),
        listDocumentsForCompanies([company.id]),
        companyOs.from("ai_programs").select("id, name").eq("company_id", company.id).order("created_at", { ascending: false }),
      ]);

    const roadmapItems = (itemRows.data ?? []) as unknown as BacklogItem[];
    const roadmapGroups = (groupRows.data ?? []) as unknown as RoadmapGroup[];
    const overviewBody = (overviewRow.data as { body: string } | null)?.body ?? "";
    const liveCardItemIds = await getLiveCardItemIds(roadmapItems.map((i) => i.id));

    // The admin's own person row, so cards freshly assigned to them wear "New".
    let viewerPersonId: string | null = null;
    if (admin) {
      const { data: viewer } = await companyOs.from("people").select("id").eq("email", admin.email).is("archived_at", null).limit(1).maybeSingle();
      viewerPersonId = (viewer as { id: string } | null)?.id ?? null;
    }

    const programOptions = (programRows.data ?? []) as ProgramOption[];
    const hubInvoices = invoices.map((r) => ({
      id: r.id,
      docNumber: r.doc_number,
      txnDate: r.txn_date,
      dueDate: r.due_date,
      currency: r.currency,
      amountCents: r.amount_cents,
      balanceCents: r.balance_cents,
      status: r.status,
    }));

    return [
      {
        key: "board",
        label: "Work Board",
        content: boardDetail ? (
          <BoardView detail={boardDetail} canManage teamOptions={boardOptions.team} clientOptions={boardOptions.clients} viewerPersonId={viewerPersonId} />
        ) : (
          <section className="admin-card admin-section-card">
            <Empty text="This client has no active work board yet. Create one from Work Boards." />
          </section>
        ),
      },
      {
        key: "roadmap",
        label: "Roadmap",
        count: roadmapItems.length,
        content: (
          <>
            <OverviewEditor companyId={company.id} initialBody={overviewBody} />
            <BacklogAdminEditor companyId={company.id} groups={roadmapGroups} items={roadmapItems} showArchived={false} liveCardItemIds={liveCardItemIds} />
          </>
        ),
      },
      {
        key: "documents",
        label: "Documents",
        count: documents.length,
        content: (
          <section className="admin-card admin-section-card">
            <CompanyDocuments companyId={company.id} documents={documents} programs={programOptions} />
          </section>
        ),
      },
      {
        key: "meetings",
        label: "Meetings",
        count: meetings.length,
        content: (
          <section className="admin-card admin-section-card">
            <MeetingsPanel meetings={meetings} publishAction={setMeetingPublished} />
          </section>
        ),
      },
      {
        key: "invoices",
        label: "Invoices",
        count: hubInvoices.length,
        content: (
          <section className="admin-card admin-section-card">
            <InvoicesPanel invoices={hubInvoices} />
          </section>
        ),
      },
      { key: "team", label: "Team", content: <HubTeamPanel team={team} /> },
    ];
  }

  const tabs = view === "hub" ? await hubTabs() : await internalTabs();

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
              {isClient ? <Badge tone="ok">Client</Badge> : company.lifecycle_stage && <Badge tone="neutral">{humanize(company.lifecycle_stage)}</Badge>}
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

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap", marginBottom: 16 }}>
        {isClient ? (
          <div className="admin-viewtoggle">
            <Link href={`/admin/revenue/companies/${company.id}${mergeQuery(searchParams, { view: "internal" })}`} className={view === "internal" ? "is-active" : ""}>
              Internal
            </Link>
            <Link href={`/admin/revenue/companies/${company.id}${mergeQuery(searchParams, { view: "hub" })}`} className={view === "hub" ? "is-active" : ""}>
              Client Hub
            </Link>
          </div>
        ) : (
          <span className="admin-cell-muted" style={{ fontSize: 13 }}>Internal record</span>
        )}
        <span className="admin-cell-muted" style={{ fontSize: 13 }}>
          {deals.length} {deals.length === 1 ? "deal" : "deals"}
          {dealValueCents ? ` · ${formatCents(dealValueCents, "usd")} total` : ""} ·{" "}
          <Link href={`/admin/revenue/deals?company=${company.id}`}>Open in CRM →</Link>
        </span>
      </div>

      <div className="admin-card admin-section-card">
        <Tabs tabs={tabs} />
      </div>
    </div>
  );
}
