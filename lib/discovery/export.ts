// Client-side export for the consultant review page — "Export to Excel" and
// "Copy for report" from the original discovery_form.html prototype, ported
// to read from the question_id-keyed rows this app stores (rather than the
// prototype's section/topic/index-derived qid). Runs entirely in the browser
// since DiscoveryReview already holds the full engagement in props; no server
// round trip needed, and both actions only ever render on the admin-only
// /admin/discovery/[id] page — never on the client-facing /discovery/[token] page.

import { DISCOVERY_SECTIONS } from "./questions";
import type { EngagementOverview, TeamMember } from "./data";

export type ExportResponseRow = { question_id: string; options: string[]; text: string | null };
export type ExportFindingRow = {
  question_id: string;
  status: string;
  priority: string;
  owner: string | null;
  target_date: string | null;
  notes: string | null;
};
export type ExportEvidenceRow = { name: string; status: string };

export type ExportData = {
  clientName: string;
  overview: EngagementOverview;
  teamMembers: TeamMember[];
  responses: ExportResponseRow[];
  findings: ExportFindingRow[];
  evidence: ExportEvidenceRow[];
};

const FINDING_STATUS_LABEL: Record<string, string> = { open: "Open", in_progress: "In Progress", resolved: "Resolved" };
const PRIORITY_LABEL: Record<string, string> = { high: "High", medium: "Medium", low: "Low" };
const EVIDENCE_STATUS_LABEL: Record<string, string> = {
  not_requested: "Not requested",
  requested: "Requested",
  received: "Received",
  not_applicable: "Not applicable",
};

export function fillTemplate(text: string, systems: EngagementOverview["systems"]): string {
  return text
    .split("{payrollSystem}").join(systems.payroll?.trim() || "the client's payroll system")
    .split("{taSystem}").join(systems.ta?.trim() || "the client's time and attendance system")
    .split("{hrisSystem}").join(systems.hris?.trim() || "the client's HRIS")
    .split("{financeSystem}").join(systems.finance?.trim() || "the client's finance system");
}

type FlaggedFinding = {
  section: string;
  topic: string;
  question: string;
  answer: string;
  selected: string;
  finding: ExportFindingRow;
};

function flaggedFindings(overview: EngagementOverview, responseMap: Record<string, ExportResponseRow>, findingMap: Record<string, ExportFindingRow>): FlaggedFinding[] {
  const out: FlaggedFinding[] = [];
  DISCOVERY_SECTIONS.forEach((section) => {
    section.topics.forEach((topic) => {
      topic.questions.forEach((q) => {
        const finding = findingMap[q.id];
        if (!finding) return;
        const r = responseMap[q.id];
        out.push({
          section: section.section,
          topic: topic.topic,
          question: fillTemplate(q.text, overview.systems),
          answer: (r?.text ?? "").trim(),
          selected: r?.options?.length ? r.options.join(", ") : "",
          finding,
        });
      });
    });
  });
  return out;
}

// Plain-text export ----------------------------------------------------------

export function buildReportText(data: ExportData): string {
  const responseMap: Record<string, ExportResponseRow> = {};
  data.responses.forEach((r) => { responseMap[r.question_id] = r; });
  const findingMap: Record<string, ExportFindingRow> = {};
  data.findings.forEach((f) => { findingMap[f.question_id] = f; });

  let out = `360 PAYROLL REVIEW — DISCOVERY RESPONSES\n\n`;
  out += `Client: ${data.clientName || "[Not provided]"}\n\n`;
  out += `## Overview & Systems\n\n`;
  out += `Payroll System: ${data.overview.systems.payroll || "[Not provided]"}\n`;
  out += `Time & Attendance System: ${data.overview.systems.ta || "[Not provided]"}\n`;
  out += `HRIS: ${data.overview.systems.hris || "[Not provided]"}\n`;
  out += `Finance System: ${data.overview.systems.finance || "[Not provided]"}\n\n`;
  out += `Entities:\n`;
  data.overview.entities.forEach((e, i) => {
    out += `  ${i + 1}. ${e.name || "[Unnamed entity]"} — ${e.employees || "[?]"} employees, ${e.payCycle || "[pay cycle not set]"} pay cycle, Awards/Agreements: ${e.awards || "[not provided]"}\n`;
  });
  out += `\n`;

  DISCOVERY_SECTIONS.forEach((section) => {
    out += `## ${section.section}\n\n`;
    section.topics.forEach((topic) => {
      out += `### ${topic.topic}\n`;
      topic.questions.forEach((q) => {
        const r = responseMap[q.id];
        out += `Q: ${fillTemplate(q.text, data.overview.systems)}\n`;
        if (q.options) out += `Selected: ${r?.options?.length ? r.options.join(", ") : "[None selected]"}\n`;
        out += `${q.options ? "Detail" : "A"}: ${(r?.text ?? "").trim() || "[Not answered]"}\n\n`;
      });
    });
  });

  if (data.teamMembers.some((m) => m.name.trim())) {
    out += `## Team Members\n\n`;
    data.teamMembers.filter((m) => m.name.trim()).forEach((m, i) => {
      out += `  ${i + 1}. ${m.name} — ${m.position || "[position not set]"}, ${m.yearsAtOrg || "?"} yrs at org, ${m.yearsPayroll || "?"} yrs payroll experience, Qualifications: ${m.qualifications || "[not provided]"}\n`;
    });
    out += `\n`;
  }

  const flagged = flaggedFindings(data.overview, responseMap, findingMap);
  out += `## Consultant Findings\n\n`;
  if (!flagged.length) out += `No findings flagged yet.\n\n`;
  flagged.forEach((f, i) => {
    out += `${i + 1}. [${f.section} — ${f.topic}] ${f.question}\n`;
    out += `   Client answer: ${f.selected ? `Selected: ${f.selected}. ` : ""}${f.answer || "[Not answered]"}\n`;
    out += `   Status: ${FINDING_STATUS_LABEL[f.finding.status] ?? f.finding.status} | Priority: ${PRIORITY_LABEL[f.finding.priority] ?? f.finding.priority} | Owner: ${f.finding.owner || "[not set]"} | Target date: ${f.finding.target_date || "[not set]"}\n`;
    out += `   Notes: ${f.finding.notes || "[none]"}\n\n`;
  });

  out += `## Data & Evidence Pack\n\n`;
  if (!data.evidence.length) out += `No evidence items tracked yet.\n`;
  data.evidence.forEach((item) => {
    out += `  - ${item.name || "[Unnamed item]"}: ${EVIDENCE_STATUS_LABEL[item.status] ?? item.status}\n`;
  });

  return out;
}

// Excel export — hand-built SpreadsheetML (Excel 2003 XML), same approach as
// the discovery_form.html prototype. Excel opens it natively with no library.
// Output shape matches the association's existing "Discovery Capture Sheet":
// one row per question, Sub-Topic / Discovery Question / Response, one tab
// per report section, plus Findings and Evidence Pack tabs.

function xmlEscape(s: string | null | undefined): string {
  return String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
function xlCell(text: string | null | undefined, styleId?: string): string {
  return `<Cell${styleId ? ` ss:StyleID="${styleId}"` : ""}><Data ss:Type="String">${xmlEscape(text)}</Data></Cell>`;
}
function xlRow(cells: string[]): string {
  return `<Row>${cells.join("")}</Row>`;
}
function xlSheetName(name: string): string {
  return name.replace(/[:\\/?*[\]]/g, "-").slice(0, 31);
}

const XL_STYLES = `
<Styles>
  <Style ss:ID="sTitle"><Font ss:FontName="Montserrat" ss:Size="16" ss:Bold="1" ss:Color="#485F88"/></Style>
  <Style ss:ID="sSub"><Font ss:FontName="Open Sans" ss:Size="10" ss:Color="#808897"/></Style>
  <Style ss:ID="sHeader"><Font ss:FontName="Montserrat" ss:Size="11" ss:Bold="1" ss:Color="#FFFFFF"/><Interior ss:Color="#485F88" ss:Pattern="Solid"/><Alignment ss:Vertical="Center" ss:WrapText="1"/><Borders><Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#29394D"/></Borders></Style>
  <Style ss:ID="sLabel"><Font ss:FontName="Open Sans" ss:Size="10" ss:Bold="1" ss:Color="#29394D"/><Interior ss:Color="#F6F7F9" ss:Pattern="Solid"/><Alignment Vertical="Top" ss:WrapText="1"/></Style>
  <Style ss:ID="sSubTopic"><Font ss:FontName="Montserrat" ss:Size="10" ss:Bold="1" ss:Color="#467D79"/><Alignment Vertical="Top" ss:WrapText="1"/><Borders><Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E2E5EA"/></Borders></Style>
  <Style ss:ID="sBody"><Font ss:FontName="Open Sans" ss:Size="10" ss:Color="#29394D"/><Alignment ss:Vertical="Top" ss:WrapText="1"/><Borders><Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E2E5EA"/></Borders></Style>
  <Style ss:ID="sResponse"><Font ss:FontName="Open Sans" ss:Size="10" ss:Color="#29394D"/><Alignment ss:Vertical="Top" ss:WrapText="1"/><Interior ss:Color="#FCFCFD" ss:Pattern="Solid"/><Borders><Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E2E5EA"/></Borders></Style>
</Styles>`;

function responseText(r: ExportResponseRow | undefined, hasOptions: boolean): string {
  if (!hasOptions) return (r?.text ?? "").trim();
  const opts = r?.options?.length ? r.options.join(", ") : "";
  const detail = (r?.text ?? "").trim();
  if (opts && detail) return `Selected: ${opts}\nDetail: ${detail}`;
  if (opts) return `Selected: ${opts}`;
  return detail;
}

function buildOverviewSheetXml(data: ExportData): string {
  const rows: string[] = [];
  rows.push(xlRow([xlCell("360 Payroll Review — Discovery Overview", "sTitle")]));
  rows.push(xlRow([xlCell(data.clientName || "Untitled review", "sSub")]));
  rows.push(xlRow([]));
  rows.push(xlRow([xlCell("Systems in Use", "sHeader"), xlCell("", "sHeader")]));
  ([
    ["Payroll System", data.overview.systems.payroll],
    ["Time & Attendance System", data.overview.systems.ta],
    ["HRIS", data.overview.systems.hris],
    ["Finance System", data.overview.systems.finance],
  ] as const).forEach(([label, val]) => rows.push(xlRow([xlCell(label, "sLabel"), xlCell(val, "sBody")])));
  rows.push(xlRow([]));
  rows.push(xlRow([xlCell("Entity Name", "sHeader"), xlCell("Employees", "sHeader"), xlCell("Pay Cycle", "sHeader"), xlCell("Awards / Agreements", "sHeader")]));
  data.overview.entities.forEach((e) => rows.push(xlRow([xlCell(e.name, "sBody"), xlCell(e.employees, "sBody"), xlCell(e.payCycle, "sBody"), xlCell(e.awards, "sBody")])));
  return `<Worksheet ss:Name="Overview"><Table>
    <Column ss:Width="180"/><Column ss:Width="140"/><Column ss:Width="140"/><Column ss:Width="220"/>
    ${rows.join("")}
  </Table></Worksheet>`;
}

function buildSectionSheetXml(section: (typeof DISCOVERY_SECTIONS)[number], responseMap: Record<string, ExportResponseRow>): string {
  const rows: string[] = [];
  rows.push(xlRow([xlCell("Sub-Topic", "sHeader"), xlCell("Discovery Question", "sHeader"), xlCell("Response", "sHeader")]));
  section.topics.forEach((topic) => {
    topic.questions.forEach((q) => {
      rows.push(xlRow([xlCell(topic.topic, "sSubTopic"), xlCell(q.text, "sBody"), xlCell(responseText(responseMap[q.id], !!q.options), "sResponse")]));
    });
  });
  return `<Worksheet ss:Name="${xmlEscape(xlSheetName(section.section))}"><Table>
    <Column ss:Width="150"/><Column ss:Width="320"/><Column ss:Width="320"/>
    ${rows.join("")}
  </Table></Worksheet>`;
}

function buildTeamMembersSheetXml(teamMembers: TeamMember[]): string {
  const rows: string[] = [];
  rows.push(xlRow(["Name", "Position", "Years at Organisation", "Total Years Payroll Experience", "Qualifications / Training"].map((h) => xlCell(h, "sHeader"))));
  teamMembers.filter((m) => m.name.trim()).forEach((m) => {
    rows.push(xlRow([xlCell(m.name, "sBody"), xlCell(m.position, "sBody"), xlCell(m.yearsAtOrg, "sBody"), xlCell(m.yearsPayroll, "sBody"), xlCell(m.qualifications, "sResponse")]));
  });
  return `<Worksheet ss:Name="Team Members"><Table>
    <Column ss:Width="150"/><Column ss:Width="150"/><Column ss:Width="130"/><Column ss:Width="130"/><Column ss:Width="220"/>
    ${rows.join("")}
  </Table></Worksheet>`;
}

function buildFindingsSheetXml(data: ExportData, responseMap: Record<string, ExportResponseRow>, findingMap: Record<string, ExportFindingRow>): string {
  const rows: string[] = [];
  rows.push(xlRow(["Section", "Topic", "Question", "Client Answer", "Status", "Priority", "Owner", "Target Date", "Consultant Notes"].map((h) => xlCell(h, "sHeader"))));
  flaggedFindings(data.overview, responseMap, findingMap).forEach((f) => {
    rows.push(xlRow([
      xlCell(f.section, "sSubTopic"), xlCell(f.topic, "sBody"), xlCell(f.question, "sBody"),
      xlCell(f.selected ? `Selected: ${f.selected}. ${f.answer}` : f.answer, "sBody"),
      xlCell(FINDING_STATUS_LABEL[f.finding.status] ?? f.finding.status, "sBody"),
      xlCell(PRIORITY_LABEL[f.finding.priority] ?? f.finding.priority, "sBody"),
      xlCell(f.finding.owner, "sBody"), xlCell(f.finding.target_date, "sBody"), xlCell(f.finding.notes, "sResponse"),
    ]));
  });
  return `<Worksheet ss:Name="Findings"><Table>
    <Column ss:Width="130"/><Column ss:Width="130"/><Column ss:Width="260"/><Column ss:Width="220"/>
    <Column ss:Width="90"/><Column ss:Width="80"/><Column ss:Width="120"/><Column ss:Width="90"/><Column ss:Width="260"/>
    ${rows.join("")}
  </Table></Worksheet>`;
}

function buildEvidencePackSheetXml(evidence: ExportEvidenceRow[]): string {
  const rows: string[] = [];
  rows.push(xlRow(["Item", "Status"].map((h) => xlCell(h, "sHeader"))));
  evidence.forEach((item) => {
    rows.push(xlRow([xlCell(item.name, "sBody"), xlCell(EVIDENCE_STATUS_LABEL[item.status] ?? item.status, "sBody")]));
  });
  return `<Worksheet ss:Name="Evidence Pack"><Table>
    <Column ss:Width="320"/><Column ss:Width="140"/>
    ${rows.join("")}
  </Table></Worksheet>`;
}

export function buildExcelWorkbookXml(data: ExportData): string {
  const responseMap: Record<string, ExportResponseRow> = {};
  data.responses.forEach((r) => { responseMap[r.question_id] = r; });
  const findingMap: Record<string, ExportFindingRow> = {};
  data.findings.forEach((f) => { findingMap[f.question_id] = f; });

  const sheets = [
    buildOverviewSheetXml(data),
    ...DISCOVERY_SECTIONS.map((section) => buildSectionSheetXml(section, responseMap)),
    buildTeamMembersSheetXml(data.teamMembers),
    buildFindingsSheetXml(data, responseMap, findingMap),
    buildEvidencePackSheetXml(data.evidence),
  ].join("");

  return `<?xml version="1.0"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:o="urn:schemas-microsoft-com:office:office"
 xmlns:x="urn:schemas-microsoft-com:office:excel"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
 ${XL_STYLES}
 ${sheets}
</Workbook>`;
}

export function excelFilename(clientName: string): string {
  return `Discovery Capture - ${(clientName || "Untitled review").replace(/[\\/:*?"<>|]/g, "-")}.xls`;
}
