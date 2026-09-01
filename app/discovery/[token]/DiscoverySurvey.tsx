"use client";

import { useMemo, useRef, useState } from "react";
import { DISCOVERY_SECTIONS, type DiscoveryQuestion } from "@/lib/discovery/questions";
import { saveOverview, saveResponse, saveTeamMembers, submitEngagement } from "./actions";
import type { EngagementOverview, ResponseValue, TeamMember } from "@/lib/discovery/data";
import styles from "./discovery.module.css";

const PAY_CYCLES = ["", "Weekly", "Fortnightly", "Monthly"];
const LOCKED_STATUSES = new Set(["submitted", "under_review", "report_drafted", "completed"]);

function blankTeamMember(): TeamMember {
  return { name: "", position: "", yearsAtOrg: "", yearsPayroll: "", qualifications: "" };
}

function isAnswered(r: ResponseValue | undefined): boolean {
  if (!r) return false;
  return r.options.length > 0 || r.text.trim().length > 0;
}

export function DiscoverySurvey(props: {
  token: string;
  clientName: string;
  initialStatus: string;
  initialOverview: EngagementOverview;
  initialTeamMembers: TeamMember[];
  initialResponses: Record<string, ResponseValue>;
}) {
  const { token } = props;
  const locked = LOCKED_STATUSES.has(props.initialStatus);

  const [overview, setOverview] = useState<EngagementOverview>(props.initialOverview);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>(
    props.initialTeamMembers.length ? props.initialTeamMembers : [blankTeamMember()],
  );
  const [responses, setResponses] = useState<Record<string, ResponseValue>>(props.initialResponses);
  const [activeTab, setActiveTab] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(locked);
  const [saveNote, setSaveNote] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const timers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  function debounced(key: string, fn: () => void, delay = 600) {
    clearTimeout(timers.current[key]);
    timers.current[key] = setTimeout(fn, delay);
  }
  function flashSaved() {
    setSaveNote("Saved");
    setTimeout(() => setSaveNote(null), 1500);
  }

  const tabCount = DISCOVERY_SECTIONS.length + 1;

  function fillTemplate(text: string): string {
    return text
      .split("{payrollSystem}").join(overview.systems.payroll.trim() || "your payroll system")
      .split("{taSystem}").join(overview.systems.ta.trim() || "your time and attendance system")
      .split("{hrisSystem}").join(overview.systems.hris.trim() || "your HRIS")
      .split("{financeSystem}").join(overview.systems.finance.trim() || "your finance system");
  }

  const overviewTotal = 4 + overview.entities.length * 4;
  const overviewAnswered = useMemo(() => {
    let c = 0;
    Object.values(overview.systems).forEach((v) => { if (v.trim()) c++; });
    overview.entities.forEach((e) => Object.values(e).forEach((v) => { if (v.trim()) c++; }));
    return c;
  }, [overview]);

  const teamTotal = teamMembers.length * 5;
  const teamAnswered = useMemo(() => {
    let c = 0;
    teamMembers.forEach((m) => Object.values(m).forEach((v) => { if (v.trim()) c++; }));
    return c;
  }, [teamMembers]);

  function sectionCounts(si: number) {
    const s = DISCOVERY_SECTIONS[si];
    let count = 0, tot = 0;
    s.topics.forEach((t) => t.questions.forEach((q) => {
      tot++;
      if (isAnswered(responses[q.id])) count++;
    }));
    if (s.section === "People") { count += teamAnswered; tot += teamTotal; }
    return { count, tot };
  }

  const { totalAll, answeredAll } = useMemo(() => {
    let tot = overviewTotal;
    let ans = overviewAnswered;
    DISCOVERY_SECTIONS.forEach((s, si) => {
      const { count, tot: t } = sectionCounts(si);
      tot += t;
      ans += count;
    });
    return { totalAll: tot, answeredAll: ans };
  }, [responses, overview, teamMembers]);
  const pct = totalAll > 0 ? Math.round((answeredAll / totalAll) * 100) : 0;

  function updateOverview(next: EngagementOverview) {
    setOverview(next);
    debounced("overview", async () => {
      const r = await saveOverview(token, next);
      if (!r.ok) setError(r.error); else flashSaved();
    });
  }
  function updateTeamMembers(next: TeamMember[]) {
    setTeamMembers(next);
    debounced("team", async () => {
      const r = await saveTeamMembers(token, next);
      if (!r.ok) setError(r.error); else flashSaved();
    });
  }
  function updateResponse(id: string, next: ResponseValue) {
    setResponses((prev) => ({ ...prev, [id]: next }));
    debounced(`q-${id}`, async () => {
      const r = await saveResponse(token, id, next.options, next.text);
      if (!r.ok) setError(r.error); else flashSaved();
    });
  }

  async function handleSubmit() {
    if (!confirm("Submit your responses? Your consultant will be notified, and you won't be able to make further changes.")) return;
    setSubmitting(true);
    setError(null);
    const r = await submitEngagement(token);
    setSubmitting(false);
    if (!r.ok) { setError(r.error); return; }
    setSubmitted(true);
  }

  if (submitted) {
    return (
      <div className={styles.page}>
        <div className={styles.shell}>
          <p className={styles.eyebrow}>Australian Payroll Association</p>
          <h1 className={styles.h1}>360 Payroll Review — Discovery</h1>
          <div className={`${styles.notice} ${styles.noticeOk}`}>
            <strong>Thanks — your responses have been submitted.</strong>
            <p style={{ margin: "10px 0 0" }}>
              Your consultant has been notified and will be in touch. If anything changes before your review begins,
              contact your consultant directly rather than using this form.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <div className={styles.shell}>
        <p className={styles.eyebrow}>Australian Payroll Association</p>
        <h1 className={styles.h1}>360 Payroll Review — Discovery</h1>
        <p className={styles.intro}>
          Start with the Overview tab — the systems and entities you enter there sharpen the questions in every
          later section. For questions with options, pick the closest fit and add detail if you need to.
        </p>
        <div className={styles.headerProgress}>
          <div className={styles.headerProgressTop}>
            <span className={styles.headerProgressLabel}>{answeredAll} of {totalAll} fields completed</span>
            <span className={styles.headerProgressPct}>{pct}%</span>
          </div>
          <div className={styles.headerProgressTrack}>
            <div className={styles.headerProgressFill} style={{ width: `${pct}%` }} />
          </div>
        </div>

        <div className={styles.layout}>
          <nav className={styles.sections}>
            <button className={activeTab === 0 ? styles.active : ""} onClick={() => setActiveTab(0)}>
              Overview &amp; Demographics
              <span className={styles.count}>{overviewAnswered} / {overviewTotal} completed</span>
            </button>
            {DISCOVERY_SECTIONS.map((s, si) => {
              const { count, tot } = sectionCounts(si);
              return (
                <button key={s.section} className={activeTab === si + 1 ? styles.active : ""} onClick={() => setActiveTab(si + 1)}>
                  {s.section}
                  <span className={styles.count}>{count} / {tot} answered</span>
                </button>
              );
            })}
          </nav>

          <div>
            {activeTab === 0 && (
              <OverviewPanel overview={overview} onChange={updateOverview} />
            )}
            {DISCOVERY_SECTIONS.map((s, si) => activeTab === si + 1 && (
              <SectionPanel
                key={s.section}
                section={s}
                responses={responses}
                fillTemplate={fillTemplate}
                onChange={updateResponse}
              >
                {s.section === "People" && (
                  <TeamMembersBlock teamMembers={teamMembers} onChange={updateTeamMembers} />
                )}
              </SectionPanel>
            ))}

            {error && <div className={styles.notice} style={{ borderColor: "#c0554a", marginBottom: 16 }}>{error}</div>}

            <div className={styles.footerBar}>
              <div className={styles.footerStatus}>
                <strong>{answeredAll} of {totalAll}</strong> fields completed
                {saveNote && <span className={styles.saveStatus}> · {saveNote}</span>}
              </div>
              <div>
                {activeTab > 0 && (
                  <button className={`${styles.btn} ${styles.btnNav}`} onClick={() => setActiveTab((t) => t - 1)}>Back</button>
                )}
                {activeTab < tabCount - 1 && (
                  <button className={`${styles.btn} ${styles.btnNav}`} onClick={() => setActiveTab((t) => t + 1)}>Next section</button>
                )}
                {activeTab === tabCount - 1 && (
                  <button className={`${styles.btn} ${styles.btnPrimary}`} onClick={handleSubmit} disabled={submitting}>
                    {submitting ? "Submitting…" : "Submit responses"}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function OverviewPanel({ overview, onChange }: { overview: EngagementOverview; onChange: (o: EngagementOverview) => void }) {
  const systemFields: [keyof EngagementOverview["systems"], string, string][] = [
    ["payroll", "Payroll System", "e.g. Micropay, Attache, MYOB"],
    ["ta", "Time & Attendance System", "e.g. Humanforce, Factory Track"],
    ["hris", "HRIS", "e.g. Sage People, Employment Hero"],
    ["finance", "Finance System (optional)", "e.g. Xero, NetSuite"],
  ];
  return (
    <>
      <div className={styles.topicBlock}>
        <h2>Systems in Use</h2>
        <p className={styles.subhead}>These feed directly into the Overview &amp; Systems questions on the next tab — fill these in first.</p>
        <div className={styles.systemsGrid}>
          {systemFields.map(([key, label, hint]) => (
            <div className={styles.fieldGroup} key={key}>
              <label className={styles.fieldLabel}>{label}</label>
              <input
                className={styles.textInput}
                type="text"
                placeholder={hint}
                value={overview.systems[key]}
                onChange={(e) => onChange({ ...overview, systems: { ...overview.systems, [key]: e.target.value } })}
              />
            </div>
          ))}
        </div>
      </div>
      <div className={styles.topicBlock}>
        <h2>Entities &amp; Demographics</h2>
        <p className={styles.subhead}>Add one row per employing entity or business unit.</p>
        {overview.entities.map((ent, i) => (
          <div className={styles.entityRow} key={i}>
            <div className={styles.fieldGroup}>
              <label className={styles.fieldLabel}>Entity Name</label>
              <input className={styles.textInput} type="text" value={ent.name}
                onChange={(e) => { const next = [...overview.entities]; next[i] = { ...ent, name: e.target.value }; onChange({ ...overview, entities: next }); }} />
            </div>
            <div className={styles.fieldGroup}>
              <label className={styles.fieldLabel}>Employees</label>
              <input className={styles.textInput} type="text" value={ent.employees}
                onChange={(e) => { const next = [...overview.entities]; next[i] = { ...ent, employees: e.target.value }; onChange({ ...overview, entities: next }); }} />
            </div>
            <div className={styles.fieldGroup}>
              <label className={styles.fieldLabel}>Pay Cycle</label>
              <select className={styles.select} value={ent.payCycle}
                onChange={(e) => { const next = [...overview.entities]; next[i] = { ...ent, payCycle: e.target.value }; onChange({ ...overview, entities: next }); }}>
                {PAY_CYCLES.map((c) => <option key={c} value={c}>{c || "Select..."}</option>)}
              </select>
            </div>
            <div className={styles.fieldGroup}>
              <label className={styles.fieldLabel}>Awards / Agreements</label>
              <input className={styles.textInput} type="text" value={ent.awards}
                onChange={(e) => { const next = [...overview.entities]; next[i] = { ...ent, awards: e.target.value }; onChange({ ...overview, entities: next }); }} />
            </div>
            {overview.entities.length > 1 && (
              <button className={styles.removeBtn} onClick={() => onChange({ ...overview, entities: overview.entities.filter((_, idx) => idx !== i) })}>Remove</button>
            )}
          </div>
        ))}
        <button className={styles.addBtn} onClick={() => onChange({ ...overview, entities: [...overview.entities, { name: "", employees: "", payCycle: "", awards: "" }] })}>
          + Add another entity
        </button>
      </div>
    </>
  );
}

function SectionPanel({
  section, responses, fillTemplate, onChange, children,
}: {
  section: (typeof DISCOVERY_SECTIONS)[number];
  responses: Record<string, ResponseValue>;
  fillTemplate: (t: string) => string;
  onChange: (id: string, next: ResponseValue) => void;
  children?: React.ReactNode;
}) {
  return (
    <>
      {section.topics.map((t) => (
        <div className={styles.topicBlock} key={t.topic}>
          <h2>{t.topic}</h2>
          {t.questions.map((q) => (
            <QuestionRow key={q.id} question={q} value={responses[q.id]} fillTemplate={fillTemplate}
              onChange={(next) => onChange(q.id, next)} />
          ))}
        </div>
      ))}
      {children}
    </>
  );
}

function QuestionRow({
  question, value, fillTemplate, onChange,
}: {
  question: DiscoveryQuestion;
  value: ResponseValue | undefined;
  fillTemplate: (t: string) => string;
  onChange: (next: ResponseValue) => void;
}) {
  const resp = value ?? { options: [], text: "" };
  const isOther = resp.options.includes("Other");

  function toggleOption(opt: string) {
    let nextOptions: string[];
    if (question.mode === "multi") {
      nextOptions = resp.options.includes(opt) ? resp.options.filter((o) => o !== opt) : [...resp.options, opt];
    } else {
      nextOptions = [opt];
    }
    onChange({ ...resp, options: nextOptions });
  }

  return (
    <div className={styles.qRow}>
      <p className={styles.qText}>{fillTemplate(question.text)}</p>
      {question.options && (
        <div className={`${styles.optionsRow} ${resp.options.length ? styles.filled : ""}`}>
          {question.options.map((opt) => (
            <label key={opt} className={`${styles.optionChip} ${resp.options.includes(opt) ? styles.checked : ""}`}>
              <input
                type={question.mode === "multi" ? "checkbox" : "radio"}
                name={question.id}
                checked={resp.options.includes(opt)}
                onChange={() => toggleOption(opt)}
              />
              <span>{opt}</span>
            </label>
          ))}
        </div>
      )}
      {question.options && (
        <p className={styles.extraLabel}>{isOther ? "Please specify" : (question.extra || "Add any detail")}</p>
      )}
      <textarea
        className={`${styles.textarea} ${resp.text.trim() ? styles.filled : ""}`}
        placeholder="Your answer..."
        value={resp.text}
        onChange={(e) => onChange({ ...resp, text: e.target.value })}
      />
    </div>
  );
}

function TeamMembersBlock({ teamMembers, onChange }: { teamMembers: TeamMember[]; onChange: (next: TeamMember[]) => void }) {
  const FIELDS: [keyof TeamMember, string][] = [
    ["name", "Name"], ["position", "Position"], ["yearsAtOrg", "Years at Organisation"],
    ["yearsPayroll", "Total Years Payroll Experience"], ["qualifications", "Qualifications / Training"],
  ];
  return (
    <div className={styles.topicBlock}>
      <h2>Team Members</h2>
      <p className={styles.subhead}>Add one row per payroll team member.</p>
      {teamMembers.map((m, i) => (
        <div className={styles.teamRow} key={i}>
          {FIELDS.map(([key, label]) => (
            <div className={styles.fieldGroup} key={key}>
              <label className={styles.fieldLabel}>{label}</label>
              <input className={styles.textInput} type="text" value={m[key]}
                onChange={(e) => { const next = [...teamMembers]; next[i] = { ...m, [key]: e.target.value }; onChange(next); }} />
            </div>
          ))}
          {teamMembers.length > 1 && (
            <button className={styles.removeBtn} onClick={() => onChange(teamMembers.filter((_, idx) => idx !== i))}>Remove</button>
          )}
        </div>
      ))}
      <button className={styles.addBtn} onClick={() => onChange([...teamMembers, blankTeamMember()])}>+ Add another team member</button>
    </div>
  );
}
