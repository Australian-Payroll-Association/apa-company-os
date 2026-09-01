"use client";

import { useRef, useState } from "react";
import { Tabs, type TabDef } from "@/components/admin/Tabs";
import { DISCOVERY_SECTIONS, type DiscoveryQuestion } from "@/lib/discovery/questions";
import type { EngagementOverview, TeamMember } from "@/lib/discovery/data";
import { buildExcelWorkbookXml, buildReportText, excelFilename, fillTemplate } from "@/lib/discovery/export";
import { saveFinding, deleteFinding, addEvidenceItem, updateEvidenceItem, deleteEvidenceItem, type FindingInput } from "./actions";
// Reuses the client survey's own CSS module so the read-only review looks
// like the same product the client filled in (chip-style options, topic
// cards, brand palette) rather than a generic admin-dashboard list. Only the
// display classes are used here — save/submit/nav styles from that module
// go unused. See app/discovery/[token]/discovery.module.css.
import surveyStyles from "@/app/discovery/[token]/discovery.module.css";

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

export function DiscoveryReview({
  engagementId, clientName, overview, teamMembers, responses, findings, evidence,
}: {
  engagementId: string;
  clientName: string;
  overview: EngagementOverview;
  teamMembers: TeamMember[];
  responses: ResponseRow[];
  findings: FindingRow[];
  evidence: EvidenceRow[];
}) {
  const responseMap: Record<string, ResponseRow> = {};
  responses.forEach((r) => { responseMap[r.question_id] = r; });

  const flaggedCount = findings.length;
  const exportData = { clientName, overview, teamMembers, responses, findings, evidence };

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
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10, flexWrap: "wrap", gap: 8 }}>
        <p className="admin-hint" style={{ margin: 0 }}>
          {flaggedCount > 0 ? `${flaggedCount} finding${flaggedCount === 1 ? "" : "s"} flagged so far.` : ""}
        </p>
        <ExportButtons data={exportData} />
      </div>
      <Tabs tabs={tabs} />
    </div>
  );
}

function ExportButtons({ data }: { data: Parameters<typeof buildReportText>[0] }) {
  const [copyState, setCopyState] = useState<"idle" | "copied" | "error">("idle");

  function handleExportExcel() {
    const xml = buildExcelWorkbookXml(data);
    const blob = new Blob([xml], { type: "application/vnd.ms-excel" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = excelFilename(data.clientName);
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  async function handleCopyForReport() {
    try {
      await navigator.clipboard.writeText(buildReportText(data));
      setCopyState("copied");
    } catch {
      setCopyState("error");
    }
    setTimeout(() => setCopyState("idle"), 2200);
  }

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      {copyState === "copied" && <span className="admin-hint">Copied — paste into Claude to draft the report</span>}
      {copyState === "error" && <span className="admin-hint">Couldn't copy — try again</span>}
      <button type="button" className="admin-btn admin-btn--sm" onClick={handleExportExcel}>
        Export to Excel
      </button>
      <button type="button" className="admin-btn admin-btn--sm admin-btn--primary" onClick={handleCopyForReport}>
        Copy for report
      </button>
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
    <div className={surveyStyles.page} style={{ minHeight: 0, background: "transparent", fontFamily: "var(--font-body)" }}>
      <div className={surveyStyles.topicBlock}>
        <h2>Overview &amp; Systems</h2>
        <p><strong>Payroll:</strong> {overview.systems.payroll || "—"} &nbsp; <strong>T&amp;A:</strong> {overview.systems.ta || "—"} &nbsp; <strong>HRIS:</strong> {overview.systems.hris || "—"} &nbsp; <strong>Finance:</strong> {overview.systems.finance || "—"}</p>
        {overview.entities.filter((e) => e.name.trim()).map((e, i) => (
          <p key={i} className={surveyStyles.subhead} style={{ margin: "4px 0 0" }}>{e.name} — {e.employees || "?"} employees, {e.payCycle || "pay cycle not set"}, {e.awards || "no award/agreement noted"}</p>
        ))}
      </div>

      {DISCOVERY_SECTIONS.map((section) => (
        <div key={section.section}>
          <div className="admin-section-label" style={{ margin: "20px 2px 8px" }}>{section.section}</div>
          {section.topics.map((topic) => (
            <div className={surveyStyles.topicBlock} key={topic.topic}>
              <h2>{topic.topic}</h2>
              {topic.questions.map((q) => (
                <QuestionReviewRow
                  key={q.id}
                  engagementId={engagementId}
                  question={q}
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
        <div className={surveyStyles.topicBlock}>
          <h2>Team Members</h2>
          {teamMembers.filter((m) => m.name.trim()).map((m, i) => (
            <p key={i}>{m.name} — {m.position || "position not set"}, {m.yearsAtOrg || "?"} yrs at org, {m.yearsPayroll || "?"} yrs payroll experience{m.qualifications ? `, ${m.qualifications}` : ""}</p>
          ))}
        </div>
      )}
    </div>
  );
}

function QuestionReviewRow({
  engagementId, question, questionText, response, finding,
}: {
  engagementId: string;
  question: DiscoveryQuestion;
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
  const questionId = question.id;

  function scheduleSave(next: Partial<FindingInput>) {
    clearTimeout(timer.current);
    const merged: FindingInput = {
      status: next.status ?? status, priority: next.priority ?? priority,
      owner: next.owner ?? owner, targetDate: next.targetDate ?? targetDate, notes: next.notes ?? notes,
    };
    timer.current = setTimeout(() => { saveFinding(engagementId, questionId, merged); }, 500);
  }

  const selectedOptions = response?.options ?? [];
  const detailText = (response?.text ?? "").trim();
  const notAnswered = selectedOptions.length === 0 && !detailText;

  return (
    <div className={surveyStyles.qRow}>
      <p className={surveyStyles.qText}>{questionText}</p>
      {question.options && (
        <div className={`${surveyStyles.optionsRow} ${selectedOptions.length ? surveyStyles.filled : ""}`}>
          {question.options.map((opt) => (
            <span key={opt} className={`${surveyStyles.optionChip} ${selectedOptions.includes(opt) ? surveyStyles.checked : ""}`}>
              <input
                type={question.mode === "multi" ? "checkbox" : "radio"}
                checked={selectedOptions.includes(opt)}
                disabled
                readOnly
              />
              <span>{opt}</span>
            </span>
          ))}
        </div>
      )}
      {detailText && <p className={surveyStyles.extraLabel}>{question.options ? "Detail" : "Answer"}</p>}
      {detailText ? (
        <div className={`${surveyStyles.textarea} ${surveyStyles.filled}`} style={{ whiteSpace: "pre-wrap" }}>{detailText}</div>
      ) : notAnswered ? (
        <p className="admin-cell-muted" style={{ fontSize: 12.5, margin: "2px 0 0" }}>Not answered</p>
      ) : null}

      <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, cursor: "pointer", marginTop: 10 }}>
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
        <div className="admin-card" style={{ marginTop: 8, background: "var(--admin-tint, #f6f7f9)", borderLeft: "3px solid var(--teal)" }}>
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
