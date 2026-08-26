import Link from "next/link";
import { notFound } from "next/navigation";
import { getCompany360, getCompanyReferredBy } from "@/lib/admin/companies";
import { getPortalMembershipsForCompany } from "@/lib/admin/portal";
import {
  getAssignmentsForCompany,
  listActiveTeamMembers,
  listClientContacts,
} from "@/lib/admin/staff-assignments";
import { getInvoicesForCompany } from "@/lib/admin/invoices";
import { getMeetingsForCompany } from "@/lib/admin/meetings";
import { getSurveyResponsesForCompany } from "@/lib/admin/surveys";
import { getBoardBySlug, listBoardManageOptions } from "@/lib/boards/data";
import { listDocumentsForCompanies } from "@/lib/client-documents";
import { getCompanyHubTeam, getLiveCardItemIds } from "@/lib/admin/company-hub";
import { listProgramSummaries, type ProgramSummary, type ProgramStatus } from "@/lib/hub/program";
import { getTokenUsageForCompanies, type TokenUsage } from "@/lib/hub/tokens";
import { BACKLOG_SELECT, ROADMAP_GROUPS_SELECT, type BacklogItem, type RoadmapGroup } from "@/lib/client-backlog";
import { getAdminUser } from "@/lib/admin-auth";
import { PageHead } from "@/components/admin/PageHead";
import { Badge, type BadgeTone } from "@/components/admin/Badge";
import { Tabs, type TabDef } from "@/components/admin/Tabs";
import { MetricCard } from "@/components/admin/MetricCard";
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
import { setMeetingPublished, setMeetingProgram } from "@/app/admin/(dashboard)/revenue/meetings/actions";
import { companyOs } from "@/lib/supabase";
import { firstParam, mergeQuery, type SearchParamsObj } from "@/lib/admin/url";
import { CompanyDetailsCard } from "../CompanyDetailsCard";
import { CompanyDangerZone } from "../CompanyDangerZone";

export const dynamic = "force-dynamic";

const CLIENT_STAGES = new Set(["customer", "evangelist"]);

const PROGRAM_STATUS_TONE: Record<ProgramStatus, BadgeTone> = {
  draft: "neutral",
  active: "ok",
  complete: "info",
};

function Empty({ text }: { text: string }) {
  return <div className="admin-empty">{text}</div>;
}

function fmtHours(n: number): string {
  return n.toLocaleString(undefined, { maximumFractionDigits: 1 });
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

  // Context-aware back-link: reflect where the user came from (Client Hubs,
  // Clients, or the Companies list) rather than always "Companies".
  const from = firstParam(searchParams.from);
  const back =
    from === "client-hubs"
      ? { href: "/admin/client-hubs", label: "← Client Hubs" }
      : from === "clients"
        ? { href: "/admin/revenue/clients", label: "← Clients" }
        : { href: "/admin/revenue/companies", label: "← Companies" };

  const dealValueCents = deals.reduce((s, d) => s + (d.amount_usd_cents ?? d.amount_cents ?? 0), 0);
  const affiliateContacts = people.filter((p) => p.affiliateActive);
  const showAffiliateCard = !!companyAffiliate?.active || affiliateContacts.length > 0;

  // ── Internal tabs ────────────────────────────────────────────────
  async function internalTabs(): Promise<TabDef[]> {
    const [portalMemberships, assignments, assignableTeamMembers, clientContacts, referredBy, surveys] =
      await Promise.all([
      getPortalMembershipsForCompany(company.id),
      getAssignmentsForCompany(company.id),
      listActiveTeamMembers(),
      listClientContacts(company.id),
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
          <AssignedStaffCard
            companyId={company.id}
            assignments={assignments}
            teamMembers={assignableTeamMembers}
            clientContacts={clientContacts}
          />
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

  // ── Client Hub tabs + top band data ──────────────────────────────
  // The hub home is organized by AI Program: a company-grain Human Tokens
  // strip, the program card grid, then the company-wide tabs. When programs
  // exist, the Work Board / Roadmap / Documents / Meetings tabs show ONLY
  // untagged (ai_program_id null) rows, so nothing is presented twice; tagged
  // rows live in their program view. When no programs exist, the tabs behave
  // exactly as before.
  async function hubData(): Promise<{ tabs: TabDef[]; programs: ProgramSummary[]; usage: TokenUsage }> {
    const [programSummaries, usage, boardRowsRes] = await Promise.all([
      listProgramSummaries(company.id),
      getTokenUsageForCompanies([company.id]),
      companyOs
        .from("boards")
        .select("id, slug, ai_program_id")
        .eq("client_company_id", company.id)
        .eq("status", "active")
        .is("archived_at", null)
        .order("sort_order", { ascending: true }),
    ]);
    const hasPrograms = programSummaries.length > 0;
    const hubBoards = (boardRowsRes.data ?? []) as Array<{ id: string; slug: string; ai_program_id: string | null }>;
    const untaggedBoards = hubBoards.filter((b) => !b.ai_program_id);
    // First active board (same "first active" convention as before); with
    // programs present, first active UNTAGGED board (program boards render in
    // their program view instead).
    const boardSlug = (hasPrograms ? untaggedBoards[0] : hubBoards[0])?.slug ?? null;

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

    const allItems = (itemRows.data ?? []) as unknown as BacklogItem[];
    const allGroups = (groupRows.data ?? []) as unknown as RoadmapGroup[];
    // Company-wide slices: untagged rows only once programs exist.
    const roadmapItems = hasPrograms ? allItems.filter((i) => !i.ai_program_id) : allItems;
    const usedKeys = new Set(roadmapItems.map((i) => i.group_key));
    const roadmapGroups = hasPrograms
      ? allGroups.filter((g) => g.ai_program_id === null || usedKeys.has(g.key))
      : allGroups;
    const hubMeetings = hasPrograms ? meetings.filter((m) => !m.aiProgramId) : meetings;
    const hubDocuments = hasPrograms ? documents.filter((d) => !d.programId) : documents;
    // Both tabs drop together only when NOTHING company-wide remains: every
    // board and every roadmap item is program-tagged (zero data loss of
    // access; each tagged row is reachable in its program view).
    const dropCompanyWideTabs = hasPrograms && untaggedBoards.length === 0 && allItems.every((i) => !!i.ai_program_id);
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

    const companyWideTabs: TabDef[] = dropCompanyWideTabs
      ? []
      : [
          {
            key: "board",
            label: hasPrograms ? "Work Board (company-wide)" : "Work Board",
            content: boardDetail ? (
              <BoardView detail={boardDetail} canManage teamOptions={boardOptions.team} clientOptions={boardOptions.clients} programOptions={boardOptions.programs} viewerPersonId={viewerPersonId} />
            ) : (
              <section className="admin-card admin-section-card">
                <Empty
                  text={
                    hasPrograms
                      ? "No company-wide work board. Program boards live in their AI Program view."
                      : "This client has no active work board yet. Create one from Work Boards."
                  }
                />
              </section>
            ),
          },
          {
            key: "roadmap",
            label: hasPrograms ? "Roadmap (company-wide)" : "Roadmap",
            count: roadmapItems.length,
            content: (
              <>
                <OverviewEditor companyId={company.id} initialBody={overviewBody} />
                <BacklogAdminEditor
                  companyId={company.id}
                  groups={roadmapGroups}
                  items={roadmapItems}
                  programs={hasPrograms ? programOptions : undefined}
                  showArchived={false}
                  liveCardItemIds={liveCardItemIds}
                />
              </>
            ),
          },
        ];

    const tabs: TabDef[] = [
      ...companyWideTabs,
      {
        key: "documents",
        label: "Documents",
        count: hubDocuments.length,
        content: (
          <section className="admin-card admin-section-card">
            <CompanyDocuments companyId={company.id} documents={hubDocuments} programs={programOptions} />
          </section>
        ),
      },
      {
        key: "meetings",
        label: "Meetings",
        count: hubMeetings.length,
        content: (
          <section className="admin-card admin-section-card">
            <MeetingsPanel meetings={hubMeetings} publishAction={setMeetingPublished} programAction={setMeetingProgram} programOptions={programOptions} />
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

    return { tabs, programs: programSummaries, usage };
  }

  const hub = view === "hub" ? await hubData() : null;
  const tabs = hub ? hub.tabs : await internalTabs();

  return (
    <div>
      <PageHead
        eyebrow={<Link href={back.href}>{back.label}</Link>}
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

      {hub && (
        <>
          <div className="hub-band-head">
            <h2 className="admin-card-title">Human Tokens</h2>
            <span className="admin-cell-muted" style={{ fontSize: 12 }}>Company credit pool, shared by all AI Programs</span>
          </div>
          <div className="mp-kpi-grid" style={{ marginBottom: 20 }}>
            <MetricCard label="Bought" value={hub.usage.boughtTokens.toLocaleString()} sub="Purchased + allocated tokens" />
            <MetricCard label="Delivered" value={fmtHours(hub.usage.deliveredHours)} sub="Hours of tracked work" />
            <MetricCard label="Balance" value={hub.usage.balanceTokens.toLocaleString()} sub="Bought minus delivered" />
            <MetricCard label="Planned" value={hub.usage.plannedTokens.toLocaleString()} sub="Roadmap high estimates" />
            <MetricCard
              label="AI leverage"
              value={hub.usage.leverage != null ? `${fmtHours(hub.usage.leverage)}x` : "n/a"}
              sub="AI tokens per delivered hour"
            />
          </div>

          <div className="hub-band-head">
            <h2 className="admin-card-title">AI Programs</h2>
          </div>
          <div className="mp-kpi-grid hub-programs-grid">
            {hub.programs.length === 0 ? (
              <div className="admin-card admin-section-card hub-program-card hub-program-card--new">
                <span className="admin-cell-strong" style={{ fontSize: 15 }}>New AI Program</span>
                <span className="admin-cell-muted" style={{ fontSize: 12 }}>Created from the client portal or by Edge8</span>
              </div>
            ) : (
              hub.programs.map((p) => {
                const pct = p.roadmapTotal > 0 ? Math.round((p.roadmapDone / p.roadmapTotal) * 100) : 0;
                return (
                  <Link
                    key={p.id}
                    href={`/admin/revenue/companies/${company.id}/programs/${p.id}`}
                    className="admin-card admin-section-card is-clickable hub-program-card"
                  >
                    <div className="hub-program-head">
                      <span className="admin-cell-strong" style={{ fontSize: 15 }}>{p.name}</span>
                      <Badge tone={PROGRAM_STATUS_TONE[p.status]}>{p.status}</Badge>
                    </div>
                    <div className="admin-cell-muted admin-cell-mono" style={{ marginTop: 4, minHeight: 18, fontSize: 12, overflowWrap: "anywhere" }}>
                      {p.githubRepo ?? "No repo connected"}
                    </div>
                    <div style={{ marginTop: 14 }}>
                      <div className="admin-cell-muted hub-program-progressrow">
                        <span>
                          {p.roadmapTotal === 0
                            ? "No roadmap items yet"
                            : `Roadmap ${p.roadmapDone}/${p.roadmapTotal} done`}
                        </span>
                        {p.roadmapTotal > 0 && <span>{pct}%</span>}
                      </div>
                      <div className="board-progress">
                        <div className="board-progress-fill" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                    <div className="admin-cell-muted" style={{ marginTop: 12, fontSize: 12 }}>
                      {p.repoId
                        ? `${fmtHours(p.deliveredHours)} hrs delivered · ${p.prsMergedLast7d} PR${p.prsMergedLast7d === 1 ? "" : "s"} merged 7d · `
                        : ""}
                      {p.boardCount} {p.boardCount === 1 ? "board" : "boards"}
                    </div>
                  </Link>
                );
              })
            )}
          </div>
        </>
      )}

      <div className="admin-card admin-section-card">
        <Tabs tabs={tabs} />
      </div>
    </div>
  );
}
