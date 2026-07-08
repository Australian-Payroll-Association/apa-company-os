import Link from "next/link";
import { notFound } from "next/navigation";
import { getPerson360 } from "@/lib/admin/contacts";
import { PageHead } from "@/components/admin/PageHead";
import { Badge, statusTone } from "@/components/admin/Badge";
import { Tabs, type TabDef } from "@/components/admin/Tabs";
import { PersonEditForm } from "./PersonEditForm";
import { PersonDangerZone } from "./PersonDangerZone";
import { PromoteButton } from "./PromoteButton";
import { formatCents, formatDate, humanize, timeAgo } from "@/lib/admin/format";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Contact",
  description: "Full relationship history and activity for one contact.",
};

function Empty({ text }: { text: string }) {
  return <div className="admin-empty">{text}</div>;
}

export default async function ContactDetailPage({ params }: { params: { id: string } }) {
  const data = await getPerson360(params.id);
  if (!data) notFound();

  const { person, lead, inquiries, deals, orders, bookings, applications, documents, surveyResponses, interactions, meetings, transitions, companies } = data;
  const isCustomer = deals.some((d) => d.status === "won");
  const primaryCompany = companies.find((c) => c.is_primary) ?? companies[0] ?? null;
  const name = person.full_name || person.preferred_name || person.email;
  const location = [person.city, person.state_province, person.country].filter(Boolean).join(", ");

  // One merged activity stream: interactions, meetings, and lifecycle
  // transitions, newest first. This is the relationship history in one place.
  type ActivityItem = { key: string; at: string; title: string; sub: string; badge?: string };
  const activity: ActivityItem[] = [
    ...interactions.map((i) => ({
      key: `i-${i.id}`,
      at: i.occurred_at ?? i.created_at,
      title: i.subject || humanize(i.kind) || "Interaction",
      sub: i.body ? (i.body.length > 140 ? `${i.body.slice(0, 140)}…` : i.body) : humanize(i.kind),
      badge: humanize(i.kind ?? "note"),
    })),
    ...meetings.map((m) => ({
      key: `m-${m.id}`,
      at: m.started_at ?? "",
      title: m.title || "Meeting",
      sub: [humanize(m.meeting_type), m.source ? `via ${m.source}` : null].filter(Boolean).join(" · "),
      badge: "Meeting",
    })),
    ...transitions.map((t) => ({
      key: `t-${t.id}`,
      at: t.occurred_at,
      title: `Lifecycle: ${humanize(t.from_stage ?? "—")} → ${humanize(t.to_stage ?? "—")}`,
      sub: [
        t.from_status || t.to_status
          ? `${humanize(t.from_status ?? "—")} → ${humanize(t.to_status ?? "—")}`
          : null,
        t.reason ? humanize(t.reason) : null,
        t.note,
      ]
        .filter(Boolean)
        .join(" · "),
      badge: "Stage change",
    })),
  ]
    .filter((a) => a.at)
    .sort((a, b) => b.at.localeCompare(a.at));

  const tabs: TabDef[] = [
    {
      key: "activity",
      label: "Activity",
      count: activity.length,
      content: activity.length === 0 ? (
        <Empty text="No activity yet." />
      ) : (
        <div className="admin-list">
          {activity.map((a) => (
            <div className="admin-list-row" key={a.key}>
              <div className="admin-list-main">
                <div className="admin-list-title">{a.title}</div>
                <div className="admin-list-sub">{a.sub || "—"}</div>
              </div>
              <div className="admin-list-aside">
                {a.badge && <Badge>{a.badge}</Badge>}
                <span className="admin-cell-muted">{timeAgo(a.at)}</span>
              </div>
            </div>
          ))}
        </div>
      ),
    },
    {
      key: "inquiries",
      label: "Inquiries",
      count: inquiries.length,
      content: inquiries.length === 0 ? (
        <Empty text="No inquiries." />
      ) : (
        <div className="admin-list">
          {inquiries.map((iq) => (
            <div className="admin-list-row" key={iq.id}>
              <div className="admin-list-main">
                <div className="admin-list-title">{iq.subject || humanize(iq.type)}</div>
                <div className="admin-list-sub">
                  {humanize(iq.type)} · {iq.source || "—"} · {timeAgo(iq.created_at)}
                </div>
              </div>
              <div className="admin-list-aside">
                <Badge tone={statusTone(iq.status)}>{humanize(iq.status)}</Badge>
              </div>
            </div>
          ))}
        </div>
      ),
    },
    {
      key: "deals",
      label: "Deals",
      count: deals.length,
      content: deals.length === 0 ? (
        <Empty text="No deals." />
      ) : (
        <div className="admin-list">
          {deals.map((d) => (
            <div className="admin-list-row" key={d.id}>
              <div className="admin-list-main">
                <div className="admin-list-title">{d.title || "Untitled deal"}</div>
                <div className="admin-list-sub">{timeAgo(d.created_at)}</div>
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
      key: "orders",
      label: "Orders",
      count: orders.length,
      content: orders.length === 0 ? (
        <Empty text="No orders." />
      ) : (
        <div className="admin-list">
          {orders.map((o) => (
            <div className="admin-list-row" key={o.id}>
              <div className="admin-list-main">
                <div className="admin-list-title">{formatCents(o.amount_usd_cents, "usd")}</div>
                <div className="admin-list-sub">
                  {humanize(o.payment_method)} · {formatDate(o.created_at)}
                </div>
              </div>
              <div className="admin-list-aside">
                <Badge tone={statusTone(o.status)}>{humanize(o.status)}</Badge>
              </div>
            </div>
          ))}
        </div>
      ),
    },
    {
      key: "bookings",
      label: "AIO Pad",
      count: bookings.length,
      content: bookings.length === 0 ? (
        <Empty text="No bookings." />
      ) : (
        <div className="admin-list">
          {bookings.map((b) => (
            <div className="admin-list-row" key={b.id}>
              <div className="admin-list-main">
                <div className="admin-list-title">{humanize(b.kind)}</div>
                <div className="admin-list-sub">
                  {formatDate(b.start_date)} → {formatDate(b.end_date)}
                  {b.party_size ? ` · party of ${b.party_size}` : ""}
                </div>
              </div>
              <div className="admin-list-aside">
                <strong className="admin-cell-mono">{formatCents(b.amount_usd_cents, "usd")}</strong>
                <Badge tone={statusTone(b.status)}>{humanize(b.status)}</Badge>
              </div>
            </div>
          ))}
        </div>
      ),
    },
    {
      key: "recruiting",
      label: "Recruiting",
      count: applications.length,
      content: applications.length === 0 && !person.headline && !person.do_not_hire ? (
        <Empty text="No applications." />
      ) : (
        <div>
          {(person.headline || person.do_not_hire) && (
            <div className="admin-list-row">
              <div className="admin-list-main">
                <div className="admin-list-title">{person.headline || person.current_title || "Applicant"}</div>
                <div className="admin-list-sub">
                  {person.linkedin_url ? (
                    <a href={person.linkedin_url} target="_blank" rel="noreferrer">
                      LinkedIn
                    </a>
                  ) : (
                    "—"
                  )}
                </div>
              </div>
              {person.do_not_hire && (
                <div className="admin-list-aside">
                  <Badge tone="err">Do not hire</Badge>
                </div>
              )}
            </div>
          )}
          {applications.length === 0 ? (
            <Empty text="No applications." />
          ) : (
            <div className="admin-list" style={{ marginTop: 8 }}>
              {applications.map((a) => (
                <div className="admin-list-row" key={a.id}>
                  <div className="admin-list-main">
                    <div className="admin-list-title">{a.job_title || "Application"}</div>
                    <div className="admin-list-sub">
                      Applied {formatDate(a.applied_at ?? a.created_at)}
                      {a.rating ? ` · ★ ${a.rating}` : ""}
                      {a.resume_document_id ? (
                        <>
                          {" · "}
                          <a href={`/admin/talent/resume/${a.resume_document_id}`} target="_blank" rel="noreferrer">
                            Resume ↗
                          </a>
                        </>
                      ) : null}
                    </div>
                  </div>
                  <div className="admin-list-aside">
                    <Badge tone={statusTone(a.status)}>{humanize(a.status)}</Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ),
    },
    {
      key: "documents",
      label: "Documents",
      count: documents.length,
      content: documents.length === 0 ? (
        <Empty text="No documents." />
      ) : (
        <div className="admin-list">
          {documents.map((doc) => (
            <div className="admin-list-row" key={doc.id}>
              <div className="admin-list-main">
                <div className="admin-list-title">{doc.title || "Document"}</div>
                <div className="admin-list-sub">
                  {doc.mime_type || "—"} · {formatDate(doc.created_at)}
                </div>
              </div>
            </div>
          ))}
        </div>
      ),
    },
    {
      key: "surveys",
      label: "Surveys",
      count: surveyResponses.length,
      content: surveyResponses.length === 0 ? (
        <Empty text="No survey responses." />
      ) : (
        <div className="admin-list">
          {surveyResponses.map((s) => (
            <div className="admin-list-row" key={s.id}>
              <div className="admin-list-main">
                <div className="admin-list-title">Survey response</div>
                <div className="admin-list-sub">{formatDate(s.submitted_at ?? s.created_at)}</div>
              </div>
            </div>
          ))}
        </div>
      ),
    },
  ];

  return (
    <>
      <PageHead
        eyebrow={<Link href="/admin/contacts">← Contacts</Link>}
        title={name}
        sub={person.email}
        action={
          <span style={{ display: "inline-flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
            {person.archived_at && <Badge tone="neutral">Archived</Badge>}
            {person.do_not_contact && <Badge tone="err">Do not contact</Badge>}
            {person.is_team_member && <Badge tone="info">Team</Badge>}
            {isCustomer && <Badge tone="ok">Customer</Badge>}
            {!isCustomer && lead && (
              <Badge tone="info">Lead · {humanize(lead.status)}</Badge>
            )}
            {person.persona && <Badge>{humanize(person.persona)}</Badge>}
            {!person.do_not_contact &&
              !person.is_team_member &&
              !isCustomer &&
              (!lead || ["unqualified", "nurture"].includes(lead.status)) && (
                <PromoteButton personId={person.id} />
              )}
          </span>
        }
      />

      <div className="admin-360">
        <div>
          <div className="admin-card admin-section-card">
            <PersonEditForm person={person} />
          </div>
          <div className="admin-card admin-section-card">
            <dl className="admin-kv">
              <dt>Email</dt>
              <dd>{person.email}</dd>
              <dt>Company</dt>
              <dd>
                {primaryCompany ? (
                  <Link href={`/admin/revenue/companies/${primaryCompany.company_id}`}>
                    {primaryCompany.name || "—"}
                  </Link>
                ) : (
                  "—"
                )}
                {primaryCompany?.title ? ` · ${primaryCompany.title}` : ""}
              </dd>
              <dt>Location</dt>
              <dd>{location || "—"}</dd>
              <dt>Timezone</dt>
              <dd>{person.timezone || "—"}</dd>
              <dt>Source</dt>
              <dd>{person.source || "—"}</dd>
              <dt>Added</dt>
              <dd>{formatDate(person.created_at)}</dd>
            </dl>
          </div>
          <div className="admin-card admin-section-card">
            <PersonDangerZone
              personId={person.id}
              personName={name}
              archived={!!person.archived_at}
            />
          </div>
        </div>

        <div className="admin-card admin-section-card">
          <Tabs tabs={tabs} />
        </div>
      </div>
    </>
  );
}
