import { requireTeamMember } from "@/lib/team-auth";
import { getMyEquipment, getMyEquipmentRequests, getSubmittedCheckIds } from "@/lib/team/equipment";
import { PageHead } from "@/components/admin/PageHead";
import { Badge, type BadgeTone } from "@/components/admin/Badge";
import { DeviceArt } from "@/components/team/DeviceArt";
import { formatDate, humanize } from "@/lib/admin/format";
import { specSummary, statusLabel } from "@/app/admin/(dashboard)/operations/equipment/equipment-shared";
import { CHECK_TYPES, currentCheckCycle } from "@/lib/admin/equipment-check";
import { RequestEquipmentForm } from "./RequestEquipmentForm";
import { EquipmentCheckForm } from "./EquipmentCheckForm";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "My Equipment",
  description: "The company equipment you are holding, and how to ask for more.",
};

function requestTone(status: string): BadgeTone {
  switch (status) {
    case "approved":
    case "fulfilled":
      return "ok";
    case "declined":
      return "err";
    default:
      return "warn";
  }
}

export default async function MyEquipmentPage() {
  const actor = await requireTeamMember();
  const cycle = currentCheckCycle();
  const [items, requests, submittedCheckIds] = await Promise.all([
    getMyEquipment(actor),
    getMyEquipmentRequests(actor),
    getSubmittedCheckIds(actor, cycle),
  ]);

  const open = requests.filter((r) => r.status === "pending");

  // Machines this person holds that still owe a check this cycle.
  const checkItems = items.filter((it) => CHECK_TYPES.includes(it.type));
  const owedChecks = checkItems.filter((it) => !submittedCheckIds.has(it.id));

  return (
    <>
      <PageHead
        eyebrow="My Equipment"
        title="What you're holding"
        sub={
          items.length === 0
            ? "Nothing is assigned to you right now."
            : `${items.length} ${items.length === 1 ? "item" : "items"} assigned to you` +
              (open.length ? ` · ${open.length} request${open.length === 1 ? "" : "s"} open` : "")
        }
      />

      {items.length > 0 && (
        <div className="team-eq-grid">
          {items.map((it) => {
            const specs = specSummary(it);
            return (
              <article key={it.id} className="team-eq-card">
                <div className="team-eq-media">
                  {it.image_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={it.image_url} alt="" className="team-eq-photo" />
                  ) : (
                    <DeviceArt type={it.type} />
                  )}
                  <span className="team-eq-tag">{it.asset_tag}</span>
                </div>
                <div className="team-eq-body">
                  <h3 className="team-eq-name">{it.name}</h3>
                  {specs && <p className="team-eq-specs">{specs}</p>}
                  <dl className="team-eq-meta">
                    {it.brand && (
                      <>
                        <dt>Brand</dt>
                        <dd>{[it.brand, it.model].filter(Boolean).join(" ")}</dd>
                      </>
                    )}
                    <dt>Serial</dt>
                    <dd>{it.serial_number ?? "Not recorded"}</dd>
                    {it.condition && (
                      <>
                        <dt>Condition</dt>
                        <dd>{humanize(it.condition)}</dd>
                      </>
                    )}
                  </dl>
                  <div className="team-eq-foot">
                    <Badge tone={it.status === "in_repair" ? "warn" : "ok"}>{statusLabel(it.status)}</Badge>
                    <span className="team-eq-type">{humanize(it.type)}</span>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {items.length === 0 && (
        <div className="admin-card admin-section-card team-eq-empty">
          <DeviceArt type="other" />
          <p>
            Nothing is assigned to you yet. If you are holding something that isn&apos;t listed here,
            tell Operations so the register matches reality.
          </p>
        </div>
      )}

      {checkItems.length > 0 && (
        <section className="admin-card admin-section-card team-eq-check">
          <h2 className="team-eq-heading">Twice-a-year equipment check</h2>
          {owedChecks.length === 0 ? (
            <p className="team-eq-lede">
              All done for this cycle. Thanks. We&apos;ll ask again next half-year.
            </p>
          ) : (
            <>
              <p className="team-eq-lede">
                A quick pulse on your kit so Operations knows what to fix or replace. Ten seconds each.
              </p>
              <div className="team-eq-check-list">
                {owedChecks.map((it) => (
                  <EquipmentCheckForm key={it.id} equipmentId={it.id} assetTag={it.asset_tag} name={it.name} />
                ))}
              </div>
            </>
          )}
        </section>
      )}

      <div className="team-eq-columns">
        <section className="admin-card admin-section-card">
          <h2 className="team-eq-heading">Need something?</h2>
          <p className="team-eq-lede">
            Ask here rather than in a chat thread, so the request doesn&apos;t get lost and whoever
            orders it can see what is already on the shelf.
          </p>
          <RequestEquipmentForm />
        </section>

        <section className="admin-card admin-section-card">
          <h2 className="team-eq-heading">Your requests</h2>
          {requests.length === 0 ? (
            <p className="team-eq-lede">You haven&apos;t asked for anything yet.</p>
          ) : (
            <ul className="team-eq-requests">
              {requests.map((r) => (
                <li key={r.id}>
                  <div className="team-eq-req-top">
                    <span className="team-eq-req-type">{humanize(r.type)}</span>
                    <Badge tone={requestTone(r.status)}>{humanize(r.status)}</Badge>
                  </div>
                  {r.reason && <p className="team-eq-req-reason">{r.reason}</p>}
                  <p className="team-eq-req-date">
                    Asked {formatDate(r.created_at)}
                    {r.needed_by && ` · needed by ${formatDate(r.needed_by)}`}
                  </p>
                  {r.decision_note && <p className="team-eq-req-note">{r.decision_note}</p>}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </>
  );
}
