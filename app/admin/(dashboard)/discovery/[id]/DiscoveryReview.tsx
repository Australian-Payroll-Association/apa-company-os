"use client";

import { useRef, useState } from "react";
import { Tabs, type TabDef } from "@/components/admin/Tabs";
import { DISCOVERY_SECTIONS } from "@/lib/discovery/questions";
import type { EngagementOverview, TeamMember } from "@/lib/discovery/data";
import { saveFinding, deleteFinding, addEvidenceItem, updateEvidenceItem, deleteEvidenceItem, type FindingInput } from "./actions";

type ResponseRow = { question_id: string; options: string[]; text: string | null };
type FindingRow = { id: string; question_id: string; status: string; priority: string; owner: string | null; target_date: string | null; notes: string | null };
type EvidenceRow = { id: string; name: string; status: string };

const EVIDENCE_STATUSES = [
  { value: "not_requested", label: "Not requested" },
  { value: "requested", label: "Requested" },
  { value: "received", label: "Received" },
  { value: "not_applicable", label: "Not applicable" },
];
const FINDING_STATUSES = ["open", "in_progress", "resolved"];
const FINDING_STATUS_LABEL: Record<string, string> = { open: "Open", in_progress: "In Progress", resolved: "Resolved" };
const FINDING_PRIORITIES = ["high", "medium", "low"];
const PRIORITY_LABEL: Record<string, string> = { high: "High", medium: "Medium", low: "Low" };

function fillTemplate(text: string, systems: EngagementOverview["systems"]): string {
  return text
    .split("{payrollSystem}").join(systems.payroll?.trim() || "the client's payroll system")
    .split("{taSystem}").join(systems.ta?.trim() || "the client's time and attendance system")
    .split("{hrisSystem}").join(systems.hris?.trim() || "the client's HRIS")
    .split("{financeSystem}").join(systems.finance?.trim() || "the client's finance system");
}

export function DiscoveryReview({
  engagementId, overview, teamMembers, responses, findings, evidence,
}: {
  engagementId: string;
  overview: EngagementOverview;
  teamMembers: TeamMember[];
  responses: ResponseRow[];
  findings: FindingRow[];
  evidence: EvidenceRow[];
}) {
  const responseMap: Record<string, ResponseRow> = {};
  responses.forEach((r) => { responseMap[r.question_id] = r; });

  const flaggedCount = findings.length;

  const tabs: TabDef[] = [
    {
      key: "review",
      label: "Review",
      content: (
        <ReviewTab engagementId={engagementId} overview={overview} teamMembers={teamMembers} responseMap={responseMap} findings={findings} />
      ),
    },
    {
      key: "evidence",
      label: "Evidence Pack",
      count: evidence.length,
      content: <EvidencePanel engagementId={engagementId} evidence={evidence} />,
    },
  ];

  return (
    <div>
      {flaggedCount > 0 && (
        <p className="admin-hint" style={{ marginBottom: 10 }}>{flaggedCount} finding{flaggedCount === 1 ? "" : "s"} flagged so far.</p>
      )}
      <Tabs tabs={tabs} />
    </div>
  );
}

function ReviewTab({
  engagementId, overview, teamMembers, responseMap, findings,
}: {
  engagementId: string;
  overview: EngagementOverview;
  teamMembers: TeamMember[];
  responseMap: Record<string, ResponseRow>;
  findings: FindingRow[];
}) {
  const findingMap: Record<string, FindingRow> = {};
  findings.forEach((f) => { findingMap[f.question_id] = f; });

  return (
    <div>
      <div className="admin-card" style={{ marginBottom: 14 }}>
        <div className="admin-section-label">Overview &amp; Systems</div>
        <p><strong>Payroll:</strong> {overview.systems.payroll || "—"} &nbsp; <strong>T&amp;A:</strong> {overview.systems.ta || "—"} &nbsp; <strong>HRIS:</strong> {overview.systems.hris || "—"} &nbsp; <strong>Finance:</strong> {overview.systems.finance || "—"}</p>
        {overview.entities.filter((e) => e.name.trim()).map((e, i) => (
          <p key={i} className="admin-cell-muted">{e.name} — {e.employees || "?"} employees, {e.payCycle || "pay cycle not set"}, {e.awards || "no award/agreement noted"}</p>
        ))}
      </div>

      {DISCOVERY_SECTIONS.map((section) => (
        <div className="admin-card" key={section.section} style={{ marginBottom: 14 }}>
          <div className="admin-section-label">{section.section}</div>
          {section.topics.map((topic) => (
            <div key={topic.topic} style={{ marginTop: 10 }}>
              <h3 style={{ fontSize: 13, margin: "0 0 8px" }}>{topic.topic}</h3>
              {topic.questions.map((q) => (
                <QuestionReviewRow
                  key={q.id}
                  engagementId={engagementId}
                  questionId={q.id}
                  questionText={fillTemplate(q.text, overview.systems)}
                  response={responseMap[q.id]}
                  finding={findingMap[q.id]}
                />
              ))}
            </div>
          ))}
        </div>
      ))}

      {teamMembers.some((m) => m.name.trim()) && (
        <div className="admin-card">
          <div className="admin-section-label">Team Members</div>
          {teamMembers.filter((m) => m.name.trim()).map((m, i) => (
            <p key={i}>{m.name} — {m.position || "position not set"}, {m.yearsAtOrg || "?"} yrs at org, {m.yearsPayroll || "?"} yrs payroll experience{m.qualifications ? `, ${m.qualifications}` : ""}</p>
          ))}
        </div>
      )}
    </div>
  );
}

function QuestionReviewRow({
  engagementId, questionId, questionText, response, finding,
}: {
  engagementId: string;
  questionId: string;
  questionText: string;
  response: ResponseRow | undefined;
  finding: FindingRow | undefined;
}) {
  const [flagged, setFlagged] = useState(!!finding);
  const [status, setStatus] = useState(finding?.status ?? "open");
  const [priority, setPriority] = useState(finding?.priority ?? "medium");
  const [owner, setOwner] = useState(finding?.owner ?? "");
  const [targetDate, setTargetDate] = useState(finding?.target_date ?? "");
  const [notes, setNotes] = useState(finding?.notes ?? "");
  const timer = useRef<ReturnType<typeof setTimeout>>();

  function scheduleSave(next: Partial<FindingInput>) {
    clearTimeout(timer.current);
    const merged: FindingInput = {
      status: next.status ?? status, priority: next.priority ?? priority,
      owner: next.owner ?? owner, targetDate: next.targetDate ?? targetDate, notes: next.notes ?? notes,
    };
    timer.current = setTimeout(() => { saveFinding(engagementId, questionId, merged); }, 500);
  }

  const answered = response && (response.options.length > 0 || (response.text ?? "").trim().length > 0);

  return (
    <div style={{ padding: "10px 0", borderBottom: "1px solid var(--admin-line, #e2e5ea)" }}>
      <p style={{ fontSize: 13, fontWeight: 600, margin: "0 0 6px" }}>{questionText}</p>
      {answered ? (
        <p style={{ fontSize: 13, margin: "0 0 6px" }}>
          {response!.options.length > 0 && <span>Selected: {response!.options.join(", ")}. </span>}
          {response!.text}
        </p>
      ) : (
        <p className="admin-cell-muted" style={{ fontSize: 13, margin: "0 0 6px" }}>Not answered</p>
      )}
      <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, cursor: "pointer" }}>
        <input
          type="checkbox"
          checked={flagged}
          onChange={(e) => {
            setFlagged(e.target.checked);
            if (e.target.checked) scheduleSave({});
            else deleteFinding(engagementId, questionId);
          }}
        />
        Flag as a finding
      </label>
      {flagged && (
        <div className="admin-card" style={{ marginTop: 8, background: "var(--admin-tint, #f6f7f9)" }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10 }}>
            <div className="admin-field">
              <label className="admin-label">Status</label>
              <select className="admin-select" value={status} onChange={(e) => { setStatus(e.target.value); scheduleSave({ status: e.target.value }); }}>
                {FINDING_STATUSES.map((s) => <option key={s} value={s}>{FINDING_STATUS_LABEL[s]}</option>)}
              </select>
            </div>
            <div className="admin-field">
              <label className="admin-label">Priority</label>
              <select className="admin-select" value={priority} onChange={(e) => { setPriority(e.target.value); scheduleSave({ priority: e.target.value }); }}>
                {FINDING_PRIORITIES.map((p) => <option key={p} value={p}>{PRIORITY_LABEL[p]}</option>)}
              </select>
            </div>
            <div className="admin-field">
              <label className="admin-label">Owner</label>
              <input className="admin-input" type="text" value={owner} onChange={(e) => { setOwner(e.target.value); scheduleSave({ owner: e.target.value }); }} placeholder="e.g. Payroll Manager" />
            </div>
            <div className="admin-field">
              <label className="admin-label">Target Date</label>
              <input className="admin-input" type="date" value={targetDate} onChange={(e) => { setTargetDate(e.target.value); scheduleSave({ targetDate: e.target.value }); }} />
            </div>
          </div>
          <div className="admin-field" style={{ marginTop: 10 }}>
            <label className="admin-label">Notes (observation / recommendation)</label>
            <textarea className="admin-textarea" value={notes} onChange={(e) => { setNotes(e.target.value); scheduleSave({ notes: e.target.value }); }} placeholder="What did you find, and what should the client do about it?" />
          </div>
        </div>
      )}
    </div>
  );
}

function EvidencePanel({ engagementId, evidence }: { engagementId: string; evidence: EvidenceRow[] }) {
  const [newName, setNewName] = useState("");
  const [adding, setAdding] = useState(false);

  async function handleAdd() {
    if (!newName.trim()) return;
    setAdding(true);
    await addEvidenceItem(engagementId, newName);
    setNewName("");
    setAdding(false);
  }

  return (
    <div className="admin-card">
      <p className="admin-hint" style={{ marginTop: 0 }}>
        Track the extracts requested from the client alongside the workshop discussion.
      </p>
      {evidence.map((item) => (
        <div key={item.id} style={{ display: "flex", gap: 10, alignItems: "center", padding: "8px 0", borderBottom: "1px solid var(--admin-line, #e2e5ea)" }}>
          <input
            className="admin-input"
            style={{ flex: 1 }}
            type="text"
            defaultValue={item.name}
            onBlur={(e) => { if (e.target.value.trim() && e.target.value !== item.name) updateEvidenceItem(item.id, engagementId, { name: e.target.value.trim() }); }}
          />
          <select
            className="admin-select"
            style={{ width: 180 }}
            defaultValue={item.status}
            onChange={(e) => updateEvidenceItem(item.id, engagementId, { status: e.target.value })}
          >
            {EVIDENCE_STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
          <button type="button" className="admin-btn admin-btn--sm admin-btn--danger" onClick={() => deleteEvidenceItem(item.id, engagementId)}>
            Remove
          </button>
        </div>
      ))}
      <div style={{ display: "flex", gap: 10, marginTop: 12 }}>
        <input
          className="admin-input"
          style={{ flex: 1 }}
          type="text"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder="e.g. Sample employment contracts"
        />
        <button type="button" className="admin-btn" disabled={adding} onClick={handleAdd}>+ Add item</button>
      </div>
    </div>
  );
}
