// Proof-of-concept: discovery answers -> drafted section (drafted-section.json,
// stands in for the future LLM drafting step) -> a Word doc matching the
// Perenti report's actual template: cover, disclaimer, contents, per-topic
// findings (generic explainer -> client-specific findings -> "Summary of
// Findings"), and a consolidated Key Action Items table at the end.
const fs = require('fs');
const {
  Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType,
  Table, TableRow, TableCell, WidthType, BorderStyle, ShadingType,
  TableOfContents, PageBreak, VerticalAlign,
} = require('docx');

const NAVY = '485F88';
const DARK = '29394D';
const TEAL = '467D79';
const GREY = '808897';
const LINE = 'E2E5EA';

const client = JSON.parse(fs.readFileSync('sample-discovery-export.json', 'utf8'));
const draft = JSON.parse(fs.readFileSync('drafted-section.json', 'utf8'));

const ALL_BORDERS = {
  top: { style: BorderStyle.SINGLE, size: 4, color: LINE }, bottom: { style: BorderStyle.SINGLE, size: 4, color: LINE },
  left: { style: BorderStyle.SINGLE, size: 4, color: LINE }, right: { style: BorderStyle.SINGLE, size: 4, color: LINE },
  insideHorizontal: { style: BorderStyle.SINGLE, size: 4, color: LINE }, insideVertical: { style: BorderStyle.SINGLE, size: 4, color: LINE },
};

function body(text, opts = {}) {
  return new Paragraph({
    spacing: { after: 200 },
    children: [new TextRun({ text, font: 'Calibri', size: 22, color: opts.color || DARK, bold: !!opts.bold, italics: !!opts.italics })],
  });
}
function bullet(text) {
  return new Paragraph({
    bullet: { level: 0 },
    spacing: { after: 100 },
    children: [new TextRun({ text, font: 'Calibri', size: 22, color: DARK })],
  });
}
function h1(text) {
  return new Paragraph({ heading: HeadingLevel.HEADING_1, spacing: { before: 400, after: 200 }, children: [new TextRun({ text, color: NAVY })] });
}
function h2(text) {
  return new Paragraph({ heading: HeadingLevel.HEADING_2, spacing: { before: 300, after: 150 }, children: [new TextRun({ text, color: DARK })] });
}
function h3(text) {
  return new Paragraph({ heading: HeadingLevel.HEADING_3, spacing: { before: 200, after: 100 }, children: [new TextRun({ text, color: TEAL })] });
}
function cell(text, opts = {}) {
  return new TableCell({
    width: { size: opts.width || 20, type: WidthType.PERCENTAGE },
    shading: opts.header ? { type: ShadingType.CLEAR, fill: NAVY } : undefined,
    verticalAlign: VerticalAlign.CENTER,
    margins: { top: 80, bottom: 80, left: 100, right: 100 },
    children: [new Paragraph({
      children: [new TextRun({ text, bold: !!opts.header, color: opts.header ? 'FFFFFF' : DARK, font: 'Calibri', size: 19 })],
    })],
  });
}

// --- Cover page ----------------------------------------------------------
const coverChildren = [
  new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 2000, after: 100 },
    children: [new TextRun({ text: `PREPARED FOR: ${client.client.toUpperCase()}`, bold: true, color: GREY, font: 'Calibri', size: 22 })] }),
  new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 1200 },
    children: [new TextRun({ text: 'PAYROLL REVIEW', bold: true, color: NAVY, font: 'Calibri', size: 56 })] }),
  new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 80 },
    children: [new TextRun({ text: 'Prepared by: Australian Payroll Association', color: GREY, font: 'Calibri', size: 22 })] }),
  new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 80 },
    children: [new TextRun({ text: `Review period: ${client.reviewPeriod}`, color: GREY, font: 'Calibri', size: 22 })] }),
  new Paragraph({ alignment: AlignmentType.CENTER,
    children: [new TextRun({ text: `Report date: ${client.reportDate}`, color: GREY, font: 'Calibri', size: 22 })] }),
  new Paragraph({ children: [new PageBreak()] }),

  h2('Disclaimer and Limitation of Liability'),
  body('This report is prepared by Australian Payroll Association Pty Ltd ("APA") for the benefit of the client to whom it is addressed ("the Client"). The report is solely for use by the Client and is not intended to be used or relied upon by anyone else. The report has been prepared for the purpose set out in the proposal between APA and the Client.'),
  body('The information in this report is current as at the date of the report and may not reflect events or circumstances occurring after that date. APA’s assessment is based on information and materials provided by the Client, which APA assumes to be true, complete and not misleading.'),
  body('APA’s work does not constitute an assurance, audit or legal engagement, and does not extend to obligations not specifically detailed in the proposal between APA and the Client.'),
  new Paragraph({ children: [new PageBreak()] }),

  h1('Contents'),
  new TableOfContents('Contents', { hyperlink: true, headingStyleRange: '1-3' }),
  new Paragraph({ children: [new PageBreak()] }),
];

// --- Section body (proof-of-concept: Governance and Controls only) -------
const sectionChildren = [h1(draft.sectionTitle), body(draft.sectionIntro)];

draft.topics.forEach((t) => {
  sectionChildren.push(h2(t.heading));
  t.genericParagraphs.forEach((p) => sectionChildren.push(body(p)));
  t.findingGroups.forEach((g) => {
    if (g.label) sectionChildren.push(h3(g.label));
    if (g.intro) sectionChildren.push(body(g.intro));
    g.bullets.forEach((b) => sectionChildren.push(bullet(b)));
  });
  if (t.summaryOfFindings) {
    sectionChildren.push(body('Summary of Findings', { bold: true }));
    sectionChildren.push(body(t.summaryOfFindings));
  }
});

// --- Key Action Items (consolidated, report-level section) ---------------
const kaiChildren = [
  h1('Key Action Items'),
  new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: ALL_BORDERS,
    rows: [
      new TableRow({ children: [cell('High', { header: true, width: 33 }), cell('Medium (1-3 Months)', { header: true, width: 33 }), cell('Low (3-12 Months)', { header: true, width: 34 })] }),
      new TableRow({ children: [
        cell('Urgent remedial action required for issues related to non-compliance with legislation, risk of regulatory fines, or high potential for fraud or over/underpayments to employees.', { width: 33 }),
        cell('Action required in the short term to address lower-level compliance issues and add robustness to processes with potential for fraud or error.', { width: 33 }),
        cell('Action required in the medium term — improvements to processes and systems to increase efficiency and reduce risk.', { width: 34 }),
      ] }),
    ],
  }),
  new Paragraph({ spacing: { before: 300, after: 150 }, children: [] }),
  new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: ALL_BORDERS,
    rows: [
      new TableRow({ children: [
        cell('Payroll Category', { header: true, width: 15 }), cell('Name of Process', { header: true, width: 15 }),
        cell('Control (weakness)', { header: true, width: 30 }), cell('Recommendation', { header: true, width: 30 }),
        cell('Risk Rating', { header: true, width: 10 }),
      ] }),
      ...draft.keyActionItems.map((k) => new TableRow({ children: [
        cell(k.category, { width: 15 }), cell(k.process, { width: 15 }), cell(k.weakness, { width: 30 }),
        cell(k.recommendation, { width: 30 }), cell(k.riskRating, { width: 10 }),
      ] })),
    ],
  }),
];

const doc = new Document({
  sections: [{
    properties: { page: { size: { width: 11906, height: 16838 } } }, // A4
    children: [...coverChildren, ...sectionChildren, ...kaiChildren],
  }],
  styles: {
    default: { document: { run: { font: 'Calibri', size: 22, color: DARK } } },
  },
});

Packer.toBuffer(doc).then((buf) => {
  fs.writeFileSync('Meridian Logistics - Payroll 360 Draft Report.docx', buf);
  console.log('written');
});
