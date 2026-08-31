# Payroll 360 Report Engine

**Australian Payroll Association · Project detail · [Master plan](building-on-company-os.md)**

Turn a client's survey of their own payroll environment into a structured, house-style compliance report **draft**, so consultants review and sharpen instead of writing every report from a blank page.

- **Day-one user:** consultants
- **The one action:** client answers, consultant gets a draft
- **Size:** medium (cleanest fit)
- **Builds on:** `company_os` (surveys, documents)

> One of three projects in the [Building on company_os](building-on-company-os.md) master plan.

---

## 1. The problem

A finished Payroll 360 report runs to fifteen or more pages with a fixed twelve-part structure and a strict house style: a first-person-plural voice, a Context, Observations, Recommendations rhythm in every sub-section, cited sources, and calibrated confidence language. Producing that is skilled work, but most of the hours go into transcribing, formatting and re-structuring, not into judgement. That is the bottleneck.

- **Every report starts from nothing.** The workshop captures a rich discussion, but turning it into structured observations and recommendations is manual and slow.
- **Consultant time goes into typing, not analysis.** Days of drafting pull senior people away from the analysis clients actually value.
- **Reports drift.** Structure, tone and depth vary by whoever wrote them. The house style lives in people's heads, not in the process.

---

## 2. Three inputs, we only collect one

| Input layer | What it is | Today |
|---|---|---|
| Workshop discussion | Process, who does what, and controls: the narrative sections. | Well covered |
| Data & evidence pack | The extracts we analyse: employee lists, pay-calculation reports, code lists, contracts, leave data. Every dollar figure and ID comes from here. | Gathered ad hoc |
| Payroll Knowledge Assessment | The 35-question, six-competency test that produces the People-section scores and benchmark. | Not collected |

**The finding:** feed the drafter all three layers and it can build a complete report. Feed it the workshop only and it drafts the narrative cleanly, then inserts clearly-marked placeholders wherever a data table or score is needed, which double as the evidence checklist. Either way, the consultant reviews a draft; they never start from a blank page.

---

## 3. How it works

1. **Client answers the survey.** The client completes a plain-language survey of their payroll environment and the knowledge assessment. The data-and-evidence pack is requested alongside it.
2. **Consultant reviews the answers.** Sets status, priority and owner, and ticks off the evidence received. Judgement stays with the expert.
3. **Claude drafts the report.** The reviewed answers become a proper Context, Observations, Recommendations draft in APA house style: structured, cited, calibrated.
4. **Consultant sharpens and signs off.** Fixes figures, adds insight, removes placeholders, then it goes to the client.

---

## 4. On company_os

The survey engine is the intake tool already. The client, the engagement, the evidence pack and the AI drafting are all existing tables.

**Existing tables it uses:** `surveys`, `survey_fields`, `survey_responses`, `survey_answers`, `companies`, `people`, `person_companies`, `deals`, `service_lines`, `documents`, `assistant_conversations`

**Why this is the cleanest fit:** the 35-question Knowledge Assessment is just a scored survey. The environment survey is just a survey. Both already have a home: typed fields, per-field config, one row per answer.

**New tables to add**

- `report`: company_id → companies, deal_id → deals, environment_response_id → survey_responses, assessment_response_id → survey_responses, status (draft|review|sent), house_style_version, created_by.
- `report_section`: report_id → report, position, kind (context|observation|recommendation), body_html, source_refs (jsonb), is_placeholder (bool). A section that still needs a data extract flags itself, so placeholders double as the evidence checklist.
- assessment scores: response_id → survey_responses, competency, raw_score, benchmark (or fold onto `survey_responses.metadata`).

**Core data to pull in**
- The client as a `companies` row, with the primary contact through `people` and `person_companies`.
- The engagement as a `deals` row on the consulting `service_line`.
- Both intake layers as `surveys` (the environment survey and the 35-question assessment), with each field's competency and its client-or-consultant view held in `survey_fields.config`.
- The data-and-evidence pack as `documents` attached to the report.
- The twelve-part house style and section template, seeded once as a config the drafter reads.

**Views & permissions**
- `report_coverage` view: sections against required inputs, showing what is still a placeholder.
- assessment profile: scores by competency against the benchmark.
- Permissions: reports are internal (consultant and admin). The client only ever touches their own survey through the existing survey path.

**Where the value lives:** house-style fidelity and citations. The draft must cite its sources, so store where each figure came from on the documents and answers. The AI cites, it never invents.

---

## 5. The build

The pipeline already runs end to end as a prototype (intake tool, coverage map, a drafted report). Turning it into practice is four steps.

1. **Run one live engagement.** Pick a real Payroll 360 client, collect all three layers with the tool, and draft the report end to end.
2. **Finalise the data-request list.** Lock the extracts the report needs into a single checklist issued at the start of the engagement.
3. **Fold in the knowledge assessment.** Wire the 35-question test into the intake so the People-section scores flow straight through.
4. **Measure the saving.** Compare consultant hours on the piloted report against a hand-built one. That number is the business case.

**What good looks like**
- Turnaround drops from days of drafting to hours of review.
- Senior time moves to judgement, not transcribing and formatting.
- Every report is consistent by design, because the house style lives in the process.
- Inputs are complete up front, with placeholders flagging anything still outstanding.

---

## 6. To settle

- **[Data] Assessment rubric.** The six-competency scoring and the benchmark for the Knowledge Assessment must be agreed before scores print on a client report.
- **[Data] The data-request list.** Lock the exact extracts the report needs into one checklist, so drafting never stalls waiting on inputs nobody formally asked for.

---

*See also: [Beryl ROI Calculator](project-beryl-roi.md) · [Unified Project System](project-unified-pm.md) · [Master plan](building-on-company-os.md)*
