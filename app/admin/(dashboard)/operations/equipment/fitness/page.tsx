import Link from "next/link";
import { PageHead } from "@/components/admin/PageHead";
import { MetricCard } from "@/components/admin/MetricCard";
import { Badge, type BadgeTone } from "@/components/admin/Badge";
import {
  loadFleetFitness,
  formatGb,
  RAM_FLOOR_GB,
  SSD_FLOOR_GB,
  RAM_PREFERRED_GB,
  type FitnessGrade,
  type GradedMachine,
} from "@/lib/admin/fleet-fitness";
import {
  loadChecksByEquipment,
  conditionLabel,
  currentCheckCycle,
  type EquipmentCheckRow,
} from "@/lib/admin/equipment-check";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Fleet fitness",
  description: "Grades the laptops our engineers use against the hardware policy.",
};

const GRADE_TONE: Record<FitnessGrade, BadgeTone> = {
  pass: "ok",
  watch: "warn",
  fail: "err",
  data_gap: "neutral",
};

const GRADE_LABEL: Record<FitnessGrade, string> = {
  pass: "Pass",
  watch: "Watch",
  fail: "Fail",
  data_gap: "Data gap",
};

function GradeBadge({ grade }: { grade: FitnessGrade }) {
  return <Badge tone={GRADE_TONE[grade]}>{GRADE_LABEL[grade]}</Badge>;
}

function specText(m: GradedMachine): string {
  return `${formatGb(m.ramGb)} / ${formatGb(m.ssdGb)}`;
}

// The holder's own last read on the machine, if they filed one this cycle.
function SelfReportCell({ check }: { check: EquipmentCheckRow | undefined }) {
  if (!check) return <span style={{ color: "var(--admin-muted)" }}>Not reported</span>;
  const tone: BadgeTone = check.holding_back ? "err" : check.condition === "poor" ? "warn" : "ok";
  const flags = [
    check.holding_back ? "holds them back" : null,
    check.needs_upgrade ? "wants upgrade" : null,
  ].filter(Boolean);
  return (
    <span>
      <Badge tone={tone}>{conditionLabel(check.condition).split(",")[0]}</Badge>
      {flags.length > 0 && (
        <span style={{ color: "var(--admin-muted)", marginLeft: 6 }}>{flags.join(", ")}</span>
      )}
    </span>
  );
}

function GradeTable({
  machines,
  checks,
}: {
  machines: GradedMachine[];
  checks: Map<string, EquipmentCheckRow>;
}) {
  return (
    <div className="admin-table-wrap">
      <div className="admin-table-scroll">
        <table className="admin-table">
          <thead>
            <tr>
              <th>Tag</th>
              <th>Holder</th>
              <th>Title</th>
              <th>Spec</th>
              <th>Year</th>
              <th>Grade</th>
              <th>Reason</th>
              <th>Self-report</th>
            </tr>
          </thead>
          <tbody>
            {machines.map((m) => (
              <tr key={m.id}>
                <td>{m.asset_tag}</td>
                <td>{m.holderName ?? "—"}</td>
                <td>{m.title ?? "—"}</td>
                <td>{specText(m)}</td>
                <td>{m.modelYear ?? "—"}</td>
                <td>
                  <GradeBadge grade={m.grade} />
                </td>
                <td>{m.reason}</td>
                <td>
                  <SelfReportCell check={checks.get(m.id)} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default async function FleetFitnessPage() {
  const cycle = currentCheckCycle();
  const [fit, checks] = await Promise.all([loadFleetFitness(), loadChecksByEquipment(cycle)]);

  // Engineer Macs whose holder said the machine holds them back this cycle.
  const flaggedByHolder = fit.macEngineers.filter((m) => checks.get(m.id)?.holding_back).length;

  return (
    <>
      <PageHead
        eyebrow="Operations · Equipment"
        title="Fleet fitness"
        sub={`Engineer laptops graded against the hardware floor (${RAM_FLOOR_GB} GB RAM / ${formatGb(
          SSD_FLOOR_GB,
        )}, preferred ${RAM_PREFERRED_GB} GB / 1 TB). Macs first.`}
        action={
          <Link href="/admin/operations/equipment" className="admin-btn">
            Back to register
          </Link>
        }
      />

      <div className="admin-summary-grid" style={{ marginBottom: 18 }}>
        <MetricCard label="Macs below floor" value={fit.counts.macFail} sub="Engineer laptops that fail" />
        <MetricCard label="At the floor" value={fit.counts.macWatch} sub="Watch, plan ahead" />
        <MetricCard label="Meets the floor" value={fit.counts.macPass} sub="Pass" />
        <MetricCard label="Under-spec buys" value={fit.purchaseGuard.length} sub="Bought below floor, last 90 days" />
        <MetricCard label="Flagged by holder" value={flaggedByHolder} sub={`Say it holds them back (${cycle})`} />
      </div>

      <section className="admin-section-card" style={{ marginBottom: 18 }}>
        <div className="admin-section-label">Upgrade priority</div>
        {fit.upgradeList.length === 0 ? (
          <p className="admin-page-sub">No engineer Macs are below the floor.</p>
        ) : (
          <>
            <p className="admin-page-sub" style={{ marginBottom: 12 }}>
              Worst first. Current failures are RAM-bound; disks are adequate. AI Engineers are the priority group.
            </p>
            <ol style={{ margin: 0, paddingLeft: 20 }}>
              {fit.upgradeList.map((m) => (
                <li key={m.id} style={{ marginBottom: 6 }}>
                  <strong>
                    {m.asset_tag} — {m.holderName ?? "Unassigned"}
                  </strong>{" "}
                  ({m.title ?? "Engineer"}): {specText(m)}.
                  {m.title && /ai/i.test(m.title) ? " AI Engineer." : ""}
                </li>
              ))}
            </ol>
          </>
        )}
      </section>

      <section className="admin-section-card" style={{ marginBottom: 18 }}>
        <div className="admin-section-label">Engineer Macs</div>
        <GradeTable machines={fit.macEngineers} checks={checks} />
      </section>

      <section className="admin-section-card" style={{ marginBottom: 18 }}>
        <div className="admin-section-label">Redistribution</div>
        {fit.redistribution.length === 0 ? (
          <p className="admin-page-sub">No capable spare in stock.</p>
        ) : (
          <ul style={{ margin: 0, paddingLeft: 20 }}>
            {fit.redistribution.map((m) => (
              <li key={m.id} style={{ marginBottom: 6 }}>
                <strong>{m.asset_tag}</strong> in stock: {m.brand ?? "Unknown"} {specText(m)}.{" "}
                {m.isMac
                  ? "Mac, a direct swap for a failing engineer Mac."
                  : "Windows, so it cannot replace a Mac. Recommend a Mac buy instead."}
              </li>
            ))}
          </ul>
        )}
      </section>

      {fit.purchaseGuard.length > 0 && (
        <section className="admin-section-card" style={{ marginBottom: 18 }}>
          <div className="admin-section-label">Purchase guard</div>
          <p className="admin-page-sub" style={{ marginBottom: 12 }}>
            Bought below the floor in the last 90 days and assigned to an engineer.
          </p>
          <ul style={{ margin: 0, paddingLeft: 20 }}>
            {fit.purchaseGuard.map((m) => (
              <li key={m.id} style={{ marginBottom: 6 }}>
                <strong>
                  {m.asset_tag} — {m.holderName ?? "Unassigned"}
                </strong>
                : {m.brand ?? "Unknown"} {specText(m)}, purchased {m.purchaseDate?.slice(0, 10)}.
              </li>
            ))}
          </ul>
        </section>
      )}

      {fit.dataGaps.length > 0 && (
        <section className="admin-section-card" style={{ marginBottom: 18 }}>
          <div className="admin-section-label">Data gaps</div>
          <ul style={{ margin: 0, paddingLeft: 20 }}>
            {fit.dataGaps.map((m) => (
              <li key={m.id} style={{ marginBottom: 6 }}>
                <strong>{m.asset_tag}</strong> ({m.holderName ?? "in stock"}): {m.reason}.{" "}
                <Link href={`/admin/operations/equipment`}>Fix in register</Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="admin-section-card" style={{ marginBottom: 18 }}>
        <div className="admin-section-label">Appendix · Other engineer laptops</div>
        {fit.otherEngineers.length === 0 ? (
          <p className="admin-page-sub">None.</p>
        ) : (
          <GradeTable machines={fit.otherEngineers} checks={checks} />
        )}
      </section>

      <section className="admin-section-card">
        <div className="admin-section-label">Appendix · Out of scope (not graded)</div>
        {fit.outOfScope.length === 0 ? (
          <p className="admin-page-sub">None.</p>
        ) : (
          <ul style={{ margin: 0, paddingLeft: 20 }}>
            {fit.outOfScope.map((m) => (
              <li key={m.id} style={{ marginBottom: 4 }}>
                {m.asset_tag}: {m.holderName ?? "Unassigned"} — {m.title ?? "no title"} ({m.brand ?? "?"}{" "}
                {specText(m)})
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
