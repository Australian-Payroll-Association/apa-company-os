# Report Writer — Project Handover

## Context for Claude Code

This project supports a **360 Payroll Review** service run by an Australian payroll advisory association. The near-term deliverable is a **client discovery tool**: a self-contained HTML form that captures the information needed to produce a payroll compliance/governance review report.

The current build is a single file, `discovery_form.html`, with **no backend and no dependencies** (fonts load from Google Fonts; everything else is inline HTML/CSS/vanilla JS). It uses an in-page `window.storage` API for draft save/load — note this is specific to the environment it was built in and will need replacing (e.g. `localStorage`) if hosted elsewhere.

### What the form already does
- **Overview tab first** — captures the client's systems (payroll, T&A, HRIS, finance) and one row per employing entity (name, employee count, pay cycle, awards/agreements).
- **100 discovery questions** across four tabs that mirror the report's structure: Payroll Processes & Systems, Governance & Controls, Compliance with Legislation, and People.
- **System-aware questions** — five questions reference the systems named on the Overview tab (e.g. "Which of these does {payrollSystem} calculate automatically?") and update live as those fields are filled in. Placeholders fall back to generic wording when blank.
- **Question types** — single-select and multi-select options (rendered as tappable chips) plus free-text, with free-text-only for questions that can't be reduced to options.
- **Progress bar** in the header showing overall completion (%) across the Overview tab and all questions, plus per-section counts in the sidebar.
- **Export** — a "Copy responses for report" button produces a structured plain-text block (Overview + every question with its selected options and free text) for drafting the report.

### The bigger picture
The form is step one of a "Report Writer" workflow: client completes the questionnaire and supplies documents → those inputs generate a first-draft report in the association's standard structure and tone (current practice summarised, observations and recommendations drafted per section) → the consultant reviews, refines, and validates the draft against sampled client data.

### Design constraints
- **Brand colours:** navy `#485F88`, dark `#29394D`, teal `#467D79`, greys `#808897` / `#A0ADC0`.
- **Fonts:** Montserrat (headings), Open Sans (body).
- Australian English spelling throughout; neutral, factual tone.
- Plain-language questions — this is client-facing, not internal jargon.

### Likely next steps (confirm priority)
- Host the form somewhere clients can reach it (replace `window.storage` with `localStorage` or a real backend).
- Add save-and-resume across sessions / multiple clients.
- Wire the export into the report-drafting step rather than manual copy-paste.
- Optionally split the form into maintainable modules (question data separated from render logic).

---

## Project Plan

### 1. Define the Problem
Every 360 Payroll Review is currently built from scratch. Consultants spend significant time structuring each report, working out which client information is needed, identifying compliance gaps, and drafting observations and recommendations before the higher-value analysis begins. Because the work restarts each engagement, effort doesn't compound, output can vary between consultants, and time that should go into sampling and validating client data instead goes into assembling the document.

The goal is to streamline report production so a consistent first draft can be generated from structured client inputs, freeing consultants to focus on data sampling, verification, and judgement — the parts of the review that genuinely require their expertise.

### 2. Discover the Data
The review depends on two inputs from the client: answers to a structured discovery questionnaire, and a set of their payroll documents (policies, procedures, system configuration, pay data, industrial instruments).

To make this repeatable, a standardised discovery questionnaire has been built covering the four report areas, mapped directly to the structure of the 360 Review report. It opens with an overview section capturing the client's systems and entities, which then sharpens the questions that follow. Questions are framed in plain language with guided options where practical, so clients can complete them directly or through a discovery workshop. This produces clean, consistent inputs in a known structure, rather than free-form information that varies client to client.

### 3. Design the Workflow
The workflow moves from client input to draft report in defined steps: the client completes the questionnaire and provides their documents; those inputs generate a first-draft report following the standard structure and tone, with current practice summarised and key observations and recommendations drafted per section; the consultant then reviews, refines, and validates the draft against sampled client data before it goes to the client.

The first build focuses on proving one section end-to-end — from questionnaire inputs through to a draft that reads like the existing reports — before extending the same pattern across all sections.
