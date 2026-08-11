import type { Metadata } from 'next'
import PrivateGate from '../../PrivateGate'
import { WorkflowHero, FlowRail, StepCards } from '../../../ui'

export const metadata: Metadata = {
  title: 'Equipment Register: 5Ds Brief | Edge8',
  description:
    'Problem, data, workflow, ROI, and the deployment and training plan for tracking company equipment in the Company OS.',
  robots: { index: false, follow: false },
}

const STATS: { v: string; l: string }[] = [
  { v: '25', l: 'Items on the register' },
  { v: '$35.8k', l: '914,033,401 VND of hardware' },
  { v: '4', l: 'Handovers that overwrote their predecessor' },
  { v: '0', l: 'Serial numbers recorded anywhere' },
]

const HANDOVERS = [
  ['Le Thi Tu Anh (Jerry)', 'Nguyen Trung Loi'],
  ['Nguyen Duy Khanh Chieu', 'Pham Tieu My'],
  ['Le Nguyen Minh Khoa', 'Nguyen Dang Trac'],
  ['Nguyen Thanh Luan', 'Ly Doan Van Anh'],
]

const TYPES = [
  'laptop', 'desktop', 'monitor', 'keyboard', 'mouse', 'phone',
  'tablet', 'headset', 'dock', 'printer', 'accessory', 'other',
]

const STATUSES = ['in_use', 'in_stock', 'in_repair', 'lost', 'retired', 'sold']

const COLUMNS: [string, string, string][] = [
  ['asset_tag', 'text unique', 'Human code, EQ-0001, assigned on insert.'],
  ['type', 'text not null', 'Default other. Full list below.'],
  ['name', 'text not null', '"Macbook Pro 14 M3", "Monitor 27 inch Dell".'],
  ['brand, model', 'text', 'Apple, Lenovo, Dell, Samsung, ASUS. "P1 Gen 6", "E2725H".'],
  ['serial_number', 'text', 'Not in the spreadsheet. Added blank, filled at the first audit.'],
  ['processor, ram, storage, screen_size', 'text, numeric', 'Nullable. Empty for a mouse or a cable.'],
  ['purchase_date, model_year', 'date, int', 'The Purchase Date and Year columns.'],
  ['vendor_id', 'uuid fk', 'Purchase location, into company_os.vendors.'],
  ['vendor_name_raw', 'text', 'Fallback so an unmatched supplier name is kept, not dropped.'],
  ['invoice_ref', 'text', 'Column exists in the sheet, empty on all 25 rows.'],
  ['cost_vnd, cost_usd', 'numeric', 'VND on 23 of 25 rows, USD on 9.'],
  ['status', 'text not null', 'Default in_stock. Full list below.'],
  ['condition', 'text', 'new, good, fair, damaged.'],
  ['current_holder_id', 'uuid fk', 'Into company_os.people. Mirrors the open assignment.'],
  ['archived_at, archived_by', 'timestamptz, text', 'Soft delete, same as vendors.'],
]

const SOURCES: [string, string][] = [
  [
    'Tools & Assets Tracking.xlsx, "Assets & Equipment" tab',
    '25 equipment rows for the backfill. The process being replaced',
  ],
  [
    'company_os.people',
    'Holders. Every assignment points here. Nicknames in the sheet (Jerry, Ginny, Harry, Ann) stripped before matching',
  ],
  [
    'company_os.vendors',
    'Purchase location. FPT, CellphoneS, Phuong Tin, DiDongViet and T&T Center are already in the directory',
  ],
  ['company_os.audit_log', 'Field level edit history, so no third history table is needed'],
  ['Entered each use', 'New purchases, handovers, returns, repairs, serial numbers'],
  [
    'Not a source: the "Accounts" tab',
    'Holds plaintext passwords. Excluded on purpose, see Out of scope',
  ],
]

const MEASURES: [string, string, string][] = [
  ['Items with a verified status', '22 of 25, three contradict themselves', '25 of 25'],
  ['Serial numbers recorded', '0', '25'],
  ['Custody changes kept as dated history', 'Overwritten', '100%, append only'],
  ['Time to answer "who has this laptop"', 'Walk the office', 'One search'],
  ['Departures that close their assignments', 'No process', 'Every one'],
  ['Avoided loss', 'Unknown exposure', 'About $1,560 per machine not lost'],
]

const PHASES: [string, string, string][] = [
  ['1', 'Migration: both tables, indexes, service_role grants', 'SQL smoke test, grants confirmed'],
  ['2', 'Data layer and server actions for assign and return', 'tsc. Assign twice leaves exactly one open row'],
  ['3', 'List page, new form, row shelf with history timeline, sidebar entry', 'tsc + next build'],
  ['4', 'Backfill: 25 items, 29 assignment rows, name resolution report', 'Counts match, four prior holders present'],
  ['5', 'Physical audit: walk the office, confirm status, record serials', '25 of 25 verified, spreadsheet read only'],
  ['6', 'Offboarding includes closing open assignments', 'First departure after go-live closes cleanly'],
]

const ROLES: [string, string][] = [
  ['Register owner (Operations)', 'Adds every purchase, runs the quarterly audit, owns data quality'],
  ['Whoever hands the device over', 'Records the Assign on the day, not later'],
  ['Offboarding', 'Closes open assignments before the last working day'],
  ['Everyone', 'Reports a lost, broken or swapped device to the register owner'],
]

const DONE = [
  'Any admin can create, assign, return and change status, and every custody change writes a dated row.',
  'Assigning an already assigned item closes the previous period automatically. Two open rows for one item are impossible.',
  'All 25 spreadsheet rows exist, with the four prior holders present as closed periods.',
  'Every unmatched person and vendor name has been reported and resolved, not silently dropped.',
  'All 25 items have a verified status and a serial number.',
  'Offboarding includes closing open assignments.',
  'tsc --noEmit and next build pass, PR reviewed and merged by Dave.',
  'The spreadsheet tab is read only and the team knows the app is the record.',
]

const statCard: React.CSSProperties = { textAlign: 'left' }
const statValue: React.CSSProperties = { fontSize: 32, fontWeight: 600, color: 'var(--dark)', lineHeight: 1.1 }
const statLabel: React.CSSProperties = { fontSize: 14, color: 'var(--body-text)', marginTop: 8 }
const chipWrap: React.CSSProperties = { display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 16 }

export default function EquipmentRegisterPlanPage() {
  return (
    <PrivateGate>
      <main>
        <WorkflowHero
          category="Operations · 5Ds Brief"
          title="The equipment register"
          tldr="The company owns 25 tracked items worth about $35,800, and the only record of who holds them is a spreadsheet tab that contradicts itself. This puts the register in the Company OS, where custody is dated history instead of an overwritten cell."
          meta={[
            { label: 'Owner', value: 'Dave (sponsor)' },
            { label: 'Outcome', value: 'Cheaper Operations' },
            { label: 'Home', value: '/admin/operations/equipment' },
            { label: 'State', value: 'Built, phases 1 to 4' },
          ]}
        />

        {/* 01 DEFINE */}
        <section className="section" style={{ paddingBottom: 48 }}>
          <div className="container">
            <span className="section-label">01 · Define the problem</span>
            <h2 className="section-title section-title--sm">
              Custody is overwritten, not recorded
            </h2>

            <div className="wf-info-grid" style={{ marginTop: 28, display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 20 }}>
              {STATS.map((s) => (
                <div key={s.l} className="wf-info-card" style={statCard}>
                  <div style={statValue}>{s.v}</div>
                  <div style={statLabel}>{s.l}</div>
                </div>
              ))}
            </div>

            <p className="section-sub" style={{ marginTop: 32 }}>
              A handover is recorded by overwriting the &quot;Assigned To&quot; cell and pushing the
              previous holder into an unlabelled column to the right. Four handovers have already
              happened that way. The next one overwrites the one before it, so custody history is one
              edit from gone.
            </p>

            <div style={chipWrap}>
              {HANDOVERS.map(([from, to]) => (
                <span key={from} className="wf-meta-chip">
                  {from} <strong>&rarr; {to}</strong>
                </span>
              ))}
            </div>

            <span className="section-label" style={{ marginTop: 48 }}>
              The status column has already drifted
            </span>
            <div className="wf-problems" style={{ marginTop: 20 }}>
              <div className="wf-problem wf-problem-warn">
                <strong>Status mixes a tick mark with the words &quot;Currently in use&quot;</strong>,
                and the real status often sits in the unlabelled column beside it.
              </div>
              <div className="wf-problem wf-problem-warn">
                <strong>Seven items are marked in stock, two with no return date</strong> (Harry&apos;s
                Thinkpad P1, Khang&apos;s Macbook M3 Pro). Nothing says when they came back or who
                verified it.
              </div>
              <div className="wf-problem wf-problem-warn">
                <strong>One item has a return date identical to its handover date</strong> and a
                status of &quot;Currently in use&quot;.
              </div>
              <div className="wf-problem wf-problem-warn">
                <strong>Two items have no recorded cost at all.</strong>
              </div>
            </div>

            <div className="wf-info-grid" style={{ marginTop: 32 }}>
              <div className="wf-info-card wf-info-card-mint">
                <h3>Problem statement</h3>
                <ul>
                  <li>
                    There is no system of record for company equipment. Custody is overwritten
                    instead of logged, status is unverifiable, and no process returns hardware when
                    someone leaves.
                  </li>
                  <li>
                    The register belongs in the admin app, on the existing Operations module, with
                    custody as dated history rather than a cell.
                  </li>
                  <li>
                    <strong>Four Outcomes tag: Cheaper Operations.</strong> The return is hardware not
                    lost and admin time not spent reconstructing who has what.
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </section>

        {/* 02 DATA */}
        <section className="section" style={{ paddingBottom: 48 }}>
          <div className="container">
            <span className="section-label">02 · Data</span>
            <h2 className="section-title section-title--sm">
              What the register is built from
            </h2>

            <div className="wf-table-wrap" style={{ marginTop: 24 }}>
              <table className="wf-table">
                <thead>
                  <tr>
                    <th>Source</th>
                    <th>Role</th>
                  </tr>
                </thead>
                <tbody>
                  {SOURCES.map(([src, role]) => (
                    <tr key={src}>
                      <td>
                        <strong>{src}</strong>
                      </td>
                      <td>{role}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="wf-info-grid" style={{ marginTop: 28 }}>
              <div className="wf-info-card">
                <h3>What the sheet does not have</h3>
                <ul>
                  <li>
                    <strong>Serial numbers:</strong> nowhere in the file. The column gets added and
                    filled during the physical audit.
                  </li>
                  <li>
                    <strong>Invoice references:</strong> the column exists and is empty on all 25 rows.
                  </li>
                  <li>
                    <strong>Cost:</strong> VND on 23 of 25 rows, USD on only 9.
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </section>

        {/* 03 DESIGN */}
        <section className="section" style={{ paddingBottom: 48 }}>
          <div className="container">
            <span className="section-label">03 · Design the workflow</span>
            <h2 className="section-title section-title--sm">
              One open assignment per item
            </h2>

            <div style={{ marginTop: 28 }}>
              <FlowRail
                steps={[
                  { num: '1', title: 'Purchase logged, lands in stock', cadence: 'On arrival', actor: 'human' },
                  { num: '2', title: 'Assign to a person, status in use', cadence: 'Same day', actor: 'human' },
                  { num: '3', title: 'Return with date and condition', cadence: 'On handback', actor: 'human' },
                  { num: '4', title: 'Reassign, history keeps both holders', cadence: 'As needed', actor: 'system' },
                  { num: '5', title: 'Retire, sell or write off', cadence: 'End of life', actor: 'human' },
                ]}
                repeatNote="Assign and Return loop for the life of the device. Every pass adds a row, none overwrite."
              />
            </div>

            <div className="wf-info-grid" style={{ marginTop: 32 }}>
              <div className="wf-info-card wf-info-card-mint">
                <h3>The rule that makes it work</h3>
                <ul>
                  <li>
                    The row with <strong>returned_at null</strong> is the current holder, and
                    equipment.current_holder_id mirrors it.
                  </li>
                  <li>
                    Assigning to a new person closes the open row and opens a new one, so the previous
                    holder is preserved instead of overwritten.
                  </li>
                  <li>That single rule is the entire failure of the spreadsheet, fixed.</li>
                </ul>
              </div>
            </div>

            <span className="section-label" style={{ marginTop: 48 }}>
              Two tables in company_os
            </span>
            <p className="section-sub" style={{ marginTop: 12 }}>
              Nothing equipment shaped exists today: the schema was checked, there is no equipment,
              assets or devices table. Both follow the company_os.vendors conventions: archived_at and
              archived_by rather than hard deletes, RLS enabled, and explicit service_role grants (new
              tables are invisible to the app without them).
            </p>

            <div className="wf-info-grid" style={{ marginTop: 20, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
              <div className="wf-info-card">
                <h3>company_os.equipment</h3>
                <ul>
                  <li>One row per physical item.</li>
                  <li>Type, live status, specs, purchase record, cost.</li>
                  <li>current_holder_id mirrors the open assignment, so the list filters and sorts without a join.</li>
                </ul>
              </div>
              <div className="wf-info-card">
                <h3>company_os.equipment_assignments</h3>
                <ul>
                  <li>One row per custody period.</li>
                  <li>equipment_id, person_id, assigned_at, returned_at, condition_out, condition_in, note, created_by.</li>
                  <li>The count only grows. It never overwrites.</li>
                </ul>
              </div>
            </div>

            <div className="wf-table-wrap" style={{ marginTop: 28 }}>
              <table className="wf-table">
                <thead>
                  <tr>
                    <th>Column</th>
                    <th>Type</th>
                    <th>Notes</th>
                  </tr>
                </thead>
                <tbody>
                  {COLUMNS.map(([col, type, note]) => (
                    <tr key={col}>
                      <td>
                        <strong>{col}</strong>
                      </td>
                      <td>{type}</td>
                      <td>{note}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <span className="section-label" style={{ marginTop: 40 }}>
              Type
            </span>
            <div style={chipWrap}>
              {TYPES.map((t) => (
                <span key={t} className="wf-tag">
                  {t}
                </span>
              ))}
            </div>

            <span className="section-label" style={{ marginTop: 32 }}>
              Status
            </span>
            <div style={chipWrap}>
              {STATUSES.map((s) => (
                <span key={s} className="wf-tag wf-tag-pass">
                  {s}
                </span>
              ))}
            </div>
            <p className="section-sub" style={{ marginTop: 16 }}>
              The spreadsheet only carries &quot;Currently in use&quot; and &quot;In stock&quot;. The
              other four states exist so an item can leave circulation without being deleted. Cost is
              visible to all admins: it is not sensitive and does not follow the wage and PII gate.
            </p>

            <span className="section-label" style={{ marginTop: 48 }}>
              Admin UI
            </span>
            <p className="section-sub" style={{ marginTop: 12 }}>
              Mirrors the Vendors module, the current standard for an Operations list.
            </p>
            <div className="wf-info-grid" style={{ marginTop: 20, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
              <div className="wf-info-card">
                <h3>List and create</h3>
                <ul>
                  <li>/admin/operations/equipment: search, sort, pagination, archived toggle, filters on Type and Status.</li>
                  <li>Columns: Item, Type, Assigned to, Status, Purchase date, Cost.</li>
                  <li>Sidebar under Operations, Workplace, next to Vendors and Gallery.</li>
                </ul>
              </div>
              <div className="wf-info-card">
                <h3>Row shelf</h3>
                <ul>
                  <li>Edit every field, plus Assign and Return.</li>
                  <li>Assignment history renders as a timeline.</li>
                  <li>One client owned table, never passed through getRowPreview.</li>
                </ul>
              </div>
            </div>
          </div>
        </section>

        {/* 04 DETERMINE */}
        <section className="section" style={{ paddingBottom: 48 }}>
          <div className="container">
            <span className="section-label">04 · Determine the ROI</span>
            <h2 className="section-title section-title--sm">
              The return is hardware, not hours
            </h2>
            <p className="section-sub" style={{ marginTop: 12 }}>
              $35,800 of hardware on the register, average item 39.7M VND (about $1,560). Seven items
              are claimed to be in stock and two of those have no return date, so the true in-stock
              count is unverified. There is no offboarding check, so an unreturned laptop is
              discovered late or not at all. One unreturned laptop costs about $1,560, which is more
              than this build.
            </p>

            <div className="wf-info-grid" style={{ marginTop: 24 }}>
              <div className="wf-info-card wf-info-card-mint">
                <h3>FAST goal</h3>
                <ul>
                  <li>
                    Within 30 days of go-live, all 25 items have a status verified against the
                    physical device and a serial number recorded, and no employee exits without their
                    open assignments closed.
                  </li>
                </ul>
              </div>
            </div>

            <div className="wf-table-wrap" style={{ marginTop: 28 }}>
              <table className="wf-table">
                <thead>
                  <tr>
                    <th>Measure</th>
                    <th>Today</th>
                    <th>Target</th>
                  </tr>
                </thead>
                <tbody>
                  {MEASURES.map(([m, today, target]) => (
                    <tr key={m}>
                      <td>
                        <strong>{m}</strong>
                      </td>
                      <td>{today}</td>
                      <td>{target}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        {/* 05 DEPLOY */}
        <section className="section" style={{ paddingBottom: 48 }}>
          <div className="container">
            <span className="section-label">05 · Deploy and train</span>
            <h2 className="section-title section-title--sm">
              Six phases, then the spreadsheet closes
            </h2>
            <p className="section-sub" style={{ marginTop: 12 }}>
              One branch, one PR, Dave merges. Verification is tsc and next build, never a dev server.
              First action within 7 days of approval: apply the phase 1 migration and open the PR. The
              spreadsheet stops being edited the day phase 5 completes.
            </p>

            <div className="wf-table-wrap" style={{ marginTop: 24 }}>
              <table className="wf-table">
                <thead>
                  <tr>
                    <th>Phase</th>
                    <th>Work</th>
                    <th>Verification</th>
                  </tr>
                </thead>
                <tbody>
                  {PHASES.map(([n, work, check]) => (
                    <tr key={n}>
                      <td>
                        <strong>{n}</strong>
                      </td>
                      <td>{work}</td>
                      <td>{check}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <span className="section-label" style={{ marginTop: 48 }}>
              Training guide
            </span>
            <p className="section-sub" style={{ marginTop: 12 }}>
              Ships as docs/operations/equipment-register-runbook.md and a training page in this
              library, matching the Private Retreats and Accounting training guides.
            </p>

            <div className="wf-table-wrap" style={{ marginTop: 24 }}>
              <table className="wf-table">
                <thead>
                  <tr>
                    <th>Role</th>
                    <th>Responsibility</th>
                  </tr>
                </thead>
                <tbody>
                  {ROLES.map(([role, resp]) => (
                    <tr key={role}>
                      <td>
                        <strong>{role}</strong>
                      </td>
                      <td>{resp}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <span className="section-label" style={{ marginTop: 40 }}>
              The four things anyone needs to know
            </span>
            <div style={{ marginTop: 20 }}>
              <StepCards
                steps={[
                  {
                    num: '1',
                    title: 'A new device arrives',
                    actor: 'human',
                    body: (
                      <p>
                        New equipment, fill in type, name, brand, model, serial number, purchase date,
                        vendor and cost. It lands as in stock.
                      </p>
                    ),
                  },
                  {
                    num: '2',
                    title: 'Handing it to someone',
                    actor: 'human',
                    body: (
                      <p>
                        Open the item, Assign, pick the person and the handover date. Status goes to in
                        use. Do this the day it happens, so the date is real.
                      </p>
                    ),
                  },
                  {
                    num: '3',
                    title: 'Getting it back',
                    actor: 'human',
                    body: (
                      <p>
                        Open the item, Return, set the date and the condition it came back in. Status
                        goes to in stock and it is ready to hand out again.{' '}
                        <strong>Never edit the holder field to fix a handover</strong>, always Assign
                        or Return, otherwise the history is wrong in exactly the way the spreadsheet is
                        wrong today.
                      </p>
                    ),
                  },
                  {
                    num: '4',
                    title: 'It is broken, lost or finished',
                    actor: 'human',
                    body: (
                      <p>
                        Change the status to in repair, lost, retired or sold. Retired and sold items
                        are archived, not deleted, so the purchase record survives.
                      </p>
                    ),
                  },
                ]}
              />
            </div>

            <div className="wf-info-grid" style={{ marginTop: 32 }}>
              <div className="wf-info-card">
                <h3>Rollout sequence</h3>
                <ul>
                  <li>The register owner is trained first and enters the backlog during the phase 5 audit.</li>
                  <li>The team is told once, in writing, that the spreadsheet is closed and equipment questions go through the app.</li>
                  <li>A quarterly audit keeps the register honest.</li>
                </ul>
              </div>
            </div>

            <span className="section-label" style={{ marginTop: 48 }}>
              Definition of done
            </span>
            <div className="wf-problems" style={{ marginTop: 20 }}>
              {DONE.map((d) => (
                <div key={d} className="wf-problem wf-problem-ok">
                  {d}
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Verification and scope */}
        <section className="section">
          <div className="container">
            <span className="section-label">Verification, scope and open items</span>
            <h2 className="section-title section-title--sm">
              What is not in this build
            </h2>

            <div className="wf-info-grid" style={{ marginTop: 24, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
              <div className="wf-info-card">
                <h3>Verification</h3>
                <ul>
                  <li>No dev server. Type check and production build.</li>
                  <li>Read back query confirming 25 equipment rows, 29 assignment rows, four closed periods.</li>
                  <li>PR with CI green, then checked on production.</li>
                </ul>
              </div>
              <div className="wf-info-card">
                <h3>Out of scope</h3>
                <ul>
                  <li>
                    <strong>The Tools &amp; Subscriptions tab.</strong> 17 people against 18 SaaS
                    tools, who holds a seat and who pays. company_os.subscriptions already exists as
                    an empty scaffold. The obvious next brief.
                  </li>
                      <li>Depreciation and refresh cycles. Age is derivable from purchase_date once the data is clean.</li>
                  <li>Automatic offboarding enforcement. Phase 6 is a checklist step, not a system block.</li>
                </ul>
              </div>
            </div>

            <div className="wf-problems" style={{ marginTop: 32 }}>
              <div className="wf-problem wf-problem-warn">
                <strong>The Accounts tab holds plaintext passwords</strong> for QuickBooks and TripIt.
                These are not going into the database and should not stay in a spreadsheet. They
                belong in a password manager, and the credentials that have been sitting in a shared
                file should be rotated.
              </div>
              <div className="wf-problem wf-problem-warn">
                <strong>Register owner not yet named.</strong> The runbook needs one.
              </div>
              <div className="wf-problem wf-problem-warn">
                <strong>Three assignees may not exist in company_os.people:</strong> Le Minh Tan, Do
                Minh Tam, Tran Thi Hong Phuong. They look like leavers. Every unresolved name is
                reported back, and those items land with no holder until Dave says who they map to.
              </div>
              <div className="wf-problem wf-problem-warn">
                <strong>Two items have no recorded cost:</strong> a Thinkpad E14 Gen 6 and a Macbook
                M3 Pro.
              </div>
            </div>

            <span className="section-label" style={{ marginTop: 48 }}>
              Build status, 5 August 2026
            </span>
            <div className="wf-problems" style={{ marginTop: 20 }}>
              <div className="wf-problem wf-problem-ok">
                <strong>Phases 1 to 4 are shipped.</strong> Both tables, the two custody RPCs, the
                admin module, and the backfill of all 25 items. Verified: 27 custody periods, 17
                open periods matching 17 items in use, holder equal to the open period on every row,
                and 914,033,401 VND on the register, reconciling to the spreadsheet exactly.
              </div>
              <div className="wf-problem wf-problem-warn">
                <strong>Only one name failed to resolve, not three.</strong> Le Minh Tan, Do Minh Tam
                and Tran Thi Hong Phuong all exist in company_os.people after all. The unresolved
                ones are <strong>Le Dinh Ngoc</strong> and <strong>Nguyen Duy Khanh Chieu</strong>,
                both noted on the records rather than guessed.
              </div>
              <div className="wf-problem wf-problem-warn">
                <strong>Vendors are not linked.</strong> The vendor directory holds cars, tours and
                venues; none of the electronics retailers are in it. Suppliers are kept verbatim in
                vendor_name_raw rather than inventing vendor rows as an import side effect.
              </div>
              <div className="wf-problem wf-problem-warn">
                <strong>My Equipment shipped on /team.</strong> Employees see the kit assigned to
                them and can raise a request; open requests surface on the admin equipment page with
                approve and decline. Fulfilment stays manual on purpose.
              </div>
              <div className="wf-problem wf-problem-warn">
                <strong>Still to do:</strong> phase 5 (physical audit, serial numbers, resolve the
                two names) and phase 6 (offboarding closes open assignments).
              </div>
            </div>
            <p className="section-sub" style={{ marginTop: 24 }}>
              The same brief in markdown lives at docs/plans/2026-08-05-equipment-tracking.md.
            </p>
          </div>
        </section>
      </main>
    </PrivateGate>
  )
}
