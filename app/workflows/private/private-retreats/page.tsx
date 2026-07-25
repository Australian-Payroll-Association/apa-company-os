import type { Metadata } from 'next'
import Link from 'next/link'
import { WorkflowHero, FlowRail, StepCards } from '../../ui'

export const metadata: Metadata = {
  title: 'Private Retreats Training Guide | Edge8',
  description: 'Internal training guide for hosting a private retreat guest end to end.',
  robots: { index: false, follow: false },
}

export default function PrivateRetreatsTrainingPage() {
  return (
    <main>
      <WorkflowHero
        category="Operations · Internal"
        title="Private Retreats Training Guide"
        tldr="How to host a private retreat guest on the ground: from wheels-down at the airport to their last free afternoon. The retreats workflow covers the business layer: sales, the retreat record, and the P&L. This guide covers execution: transport, check-in, the agenda, the staff, and the hospitality judgment calls. Quan is the retreat lead. You own execution."
        meta={[
          { label: 'Audience', value: 'Retreat ops' },
          { label: 'Lead', value: 'Quan' },
          { label: 'Execution', value: 'You' },
        ]}
      />

      {/* Ground rules */}
      <section className="section" style={{ paddingBottom: 48 }}>
        <div className="container">
          <span className="section-label">Never bend these</span>
          <h2 className="section-title" style={{ fontSize: 34 }}>
            The five ground rules
          </h2>
          <div className="wf-problems">
            <div className="wf-problem">
              <svg viewBox="0 0 24 24" fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <line x1="4.9" y1="4.9" x2="19.1" y2="19.1" />
              </svg>
              <strong>The guest is never left guessing.</strong> Every handoff has a named owner: who picks them up, who
              meets them at Lumiere, who they sit with in the morning. If you cannot name the owner, the handoff is not
              planned.
            </div>
            <div className="wf-problem">
              <svg viewBox="0 0 24 24" fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <line x1="4.9" y1="4.9" x2="19.1" y2="19.1" />
              </svg>
              <strong>VIP arrival is not optional.</strong> The VIP airport service is arranged before the guest is in
              the air, never improvised after they land.
            </div>
            <div className="wf-problem">
              <svg viewBox="0 0 24 24" fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <line x1="4.9" y1="4.9" x2="19.1" y2="19.1" />
              </svg>
              <strong>The access pack is ready before arrival.</strong> Keys, door combination, and room number are
              confirmed and in the host&apos;s hands before the guest reaches Lumiere. A guest standing in a lobby while
              someone hunts for a key is a failed check-in.
            </div>
            <div className="wf-problem">
              <svg viewBox="0 0 24 24" fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <line x1="4.9" y1="4.9" x2="19.1" y2="19.1" />
              </svg>
              <strong>Every agenda block has a booked room.</strong> The agenda runs in morning and afternoon blocks,
              and every block maps to a venue that is actually booked: a Lumiere meeting room or a co-working center. No
              block is &quot;we&apos;ll figure it out that morning.&quot;
            </div>
            <div className="wf-problem">
              <svg viewBox="0 0 24 24" fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <line x1="4.9" y1="4.9" x2="19.1" y2="19.1" />
              </svg>
              <strong>Staff know their hours before day one.</strong> Engineers, driver, and maid each get their
              schedule before the retreat starts. Nobody finds out day-of that they were supposed to be somewhere.
            </div>
          </div>
        </div>
      </section>

      {/* Mental model */}
      <section className="section" style={{ paddingTop: 24, paddingBottom: 48 }}>
        <div className="container">
          <span className="section-label">The mental model</span>
          <h2 className="section-title" style={{ fontSize: 34 }}>
            Two clocks: arrival day, then the daily rhythm
          </h2>
          <div className="wf-problems">
            <div className="wf-problem wf-problem-ok">
              <svg viewBox="0 0 24 24" fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 6L9 17l-5-5" />
              </svg>
              <strong>Arrival day runs once.</strong> Airport pickup and Lumiere check-in are a single choreographed
              sequence. Get it right and the guest starts the retreat relaxed and impressed.
            </div>
            <div className="wf-problem wf-problem-ok">
              <svg viewBox="0 0 24 24" fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 6L9 17l-5-5" />
              </svg>
              <strong>The daily rhythm repeats.</strong> Morning block, lunch, afternoon block, evening. Rooms, staff,
              and meals hang off those blocks. Plan the blocks and the rest follows.
            </div>
            <div className="wf-problem wf-problem-warn">
              <svg viewBox="0 0 24 24" fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 9v4" />
                <path d="M12 17h.01" />
                <path d="M10.3 3.9L1.8 18a2 2 0 001.7 3h17a2 2 0 001.7-3L13.7 3.9a2 2 0 00-3.4 0z" />
              </svg>
              <strong>The trap is assuming someone else has it.</strong> Quan leads the retreat, but he is new. You own
              execution: confirm the driver knows the pickup time, the engineers know their blocks, and the maid knows
              her window. Verify, don&apos;t assume.
            </div>
          </div>
          <div className="wf-loop-note">
            <svg viewBox="0 0 24 24" fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <path d="M12 16v-4" />
              <path d="M12 8h.01" />
            </svg>
            <span>
              This guide covers four workflows: <strong>airport arrival</strong>, <strong>Lumiere check-in</strong>,{' '}
              <strong>agenda and room booking</strong>, and <strong>staff scheduling</strong>, plus the hospitality
              judgment calls around meals and free time. The business side lives in the{' '}
              <Link href="/workflows/infinite-leverage-retreats">retreats workflow</Link>.
            </span>
          </div>
        </div>
      </section>

      {/* Workflow 1: Airport arrival */}
      <section className="section" style={{ background: 'var(--tint)', padding: '72px 0' }}>
        <div className="container">
          <span className="section-label" style={{ background: 'var(--white)' }}>
            Workflow 1
          </span>
          <h2 className="section-title" style={{ fontSize: 34 }}>
            Airport arrival
          </h2>
          <p className="section-sub" style={{ marginTop: 12 }}>
            From wheels-down to the car. The guest should walk out of the plane and feel handled: fast-tracked through
            the airport, met by name, and driven straight to Lumiere.
          </p>
          <FlowRail
            steps={[
              { num: '01', title: 'Confirm flight details', cadence: 'Before travel', actor: 'human', actorLabel: 'You' },
              { num: '02', title: 'Book VIP arrival service', cadence: 'Before travel', actor: 'human', actorLabel: 'You' },
              { num: '03', title: 'Brief the driver', cadence: 'Day before', actor: 'human', actorLabel: 'You' },
              { num: '04', title: 'Pickup at the airport', cadence: 'Wheels-down', actor: 'human', actorLabel: 'Driver' },
              { num: '05', title: 'Transport to Lumiere', cadence: 'Arrival day', actor: 'human', actorLabel: 'Driver' },
            ]}
          />
          <StepCards
            steps={[
              {
                num: '01',
                title: 'Confirm flight details',
                actor: 'human',
                actorLabel: 'You',
                body: (
                  <p>
                    Get the airline, flight number, and landing time from the guest before they travel. Recheck the
                    arrival time the day they fly: delays change the driver and VIP timings, and both need to move with
                    the flight.
                  </p>
                ),
              },
              {
                num: '02',
                title: 'Book the VIP arrival service',
                actor: 'human',
                actorLabel: 'You',
                body: (
                  <p>
                    Every private retreat guest gets the VIP airport service: fast-track through immigration, escort
                    through the terminal, out to the car. Book it against the confirmed flight and reconfirm the day
                    before landing. This is a ground rule, not a nice-to-have.
                  </p>
                ),
              },
              {
                num: '03',
                title: 'Brief the driver',
                actor: 'human',
                actorLabel: 'You',
                body: (
                  <p>
                    The driver gets the flight number, landing time, guest name, and destination the day before. Confirm
                    he acknowledges. On arrival day, he tracks the flight and is at the pickup point before the guest
                    clears the terminal.
                  </p>
                ),
              },
              {
                num: '04',
                title: 'Pickup and transport to Lumiere',
                actor: 'human',
                actorLabel: 'Driver',
                body: (
                  <p>
                    The VIP escort delivers the guest to the driver, and the driver takes them straight to Lumiere. While
                    they are on the road, message the host so check-in is standing ready when the car pulls up.
                  </p>
                ),
              },
            ]}
          />
        </div>
      </section>

      {/* Workflow 2: Lumiere check-in */}
      <section className="section">
        <div className="container">
          <span className="section-label">Workflow 2</span>
          <h2 className="section-title" style={{ fontSize: 34 }}>
            Lumiere check-in
          </h2>
          <p className="section-sub" style={{ marginTop: 12 }}>
            The guest needs three things to live at Lumiere: their keys, the door combination, and their room number.
            They also need to know where they are going, which is why somebody hosts the arrival in person. Historically
            Dave does the pickup; Quan is taking this over as retreat lead.
          </p>
          <StepCards
            steps={[
              {
                num: '01',
                title: 'Prepare the access pack',
                actor: 'human',
                actorLabel: 'You',
                body: (
                  <p>
                    Before the guest lands, confirm three things are in hand: the physical keys, the door combination,
                    and the room number. If any of the three is missing, check-in is not ready. Fix it before the car
                    arrives, not after.
                  </p>
                ),
              },
              {
                num: '02',
                title: 'Host meets the guest',
                actor: 'human',
                actorLabel: 'Host',
                body: (
                  <p>
                    A named host is at Lumiere when the car pulls up. The host is decided before arrival day: usually
                    Dave, increasingly Quan. The guest should never arrive at the building and have to work out where to
                    go on their own.
                  </p>
                ),
              },
              {
                num: '03',
                title: 'Walk them in and orient them',
                actor: 'human',
                actorLabel: 'Host',
                body: (
                  <p>
                    The host walks the guest to their room, hands over keys and the door combination, and shows them the
                    basics: how to get in and out of the building, where the retreat happens in the morning, and how to
                    reach us if they need anything. End by confirming the time and place they will be collected for the
                    first session.
                  </p>
                ),
              },
            ]}
          />
        </div>
      </section>

      {/* Workflow 3: Agenda + room booking */}
      <section className="section" style={{ background: 'var(--tint)', padding: '72px 0' }}>
        <div className="container">
          <span className="section-label" style={{ background: 'var(--white)' }}>
            Workflow 3
          </span>
          <h2 className="section-title" style={{ fontSize: 34 }}>
            Agenda and room booking
          </h2>
          <p className="section-sub" style={{ marginTop: 12 }}>
            The retreat runs in blocks: every morning is a block, every afternoon is a block. Rooms, staff, and meals all
            hang off the block plan, so this is the workflow that has to be super clear in your mind. Sometimes we book
            in Lumiere, sometimes a co-working center. Know which, for every block, before the retreat starts.
          </p>
          <StepCards
            steps={[
              {
                num: '01',
                title: 'Draft the agenda in blocks',
                actor: 'human',
                actorLabel: 'Quan + You',
                body: (
                  <p>
                    Build the trip agenda day by day, split into morning and afternoon blocks. Each block states what is
                    happening and who needs to be in the room. This is the single document the rest of the retreat hangs
                    off.
                  </p>
                ),
              },
              {
                num: '02',
                title: 'Map every block to a venue',
                actor: 'human',
                actorLabel: 'You',
                body: (
                  <p>
                    For each block, decide the venue: a Lumiere meeting room or a co-working center. The test is simple:
                    can you say, for every block of every day, exactly which room it happens in? If not, the mapping is
                    not done.
                  </p>
                ),
              },
              {
                num: '03',
                title: 'Book the rooms',
                actor: 'human',
                actorLabel: 'You',
                body: (
                  <p>
                    Make the actual bookings from the venue map: Lumiere meeting rooms reserved, co-working day passes or
                    rooms confirmed. Do this before day one. A block without a booked room is an unplanned block.
                  </p>
                ),
              },
              {
                num: '04',
                title: 'Share the agenda',
                actor: 'human',
                actorLabel: 'You',
                body: (
                  <p>
                    The guest gets the agenda for the trip so they always know what is next. The staff get it too,
                    because their schedules in the next workflow are derived from it.
                  </p>
                ),
              },
            ]}
          />
          <div className="wf-loop-note">
            <svg viewBox="0 0 24 24" fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <path d="M12 16v-4" />
              <path d="M12 8h.01" />
            </svg>
            <span>
              <strong>The block test:</strong> for any day of the retreat, you should be able to answer &quot;where is
              the morning block, where is the afternoon block, and who is in each&quot; without looking anything up.
            </span>
          </div>
        </div>
      </section>

      {/* Workflow 4: Staffing */}
      <section className="section">
        <div className="container">
          <span className="section-label">Workflow 4</span>
          <h2 className="section-title" style={{ fontSize: 34 }}>
            Staff scheduling
          </h2>
          <p className="section-sub" style={{ marginTop: 12 }}>
            Everyone who touches the retreat needs to be very clear on when they are working. Quan runs the retreat, but
            he is new: he is in charge of the retreat, and you are in charge of execution. That means you make sure the
            engineers are there to work, the driver knows when to drive, and the maid knows when to clean.
          </p>
          <div className="wf-table-wrap">
            <table className="wf-table">
              <thead>
                <tr>
                  <th>Role</th>
                  <th>When they work</th>
                  <th>What you confirm</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>Quan</td>
                  <td>Whole retreat</td>
                  <td>
                    Retreat lead: owns the guest relationship and the room. He is new, so back him up rather than assume
                    he has everything covered.
                  </td>
                </tr>
                <tr>
                  <td>You</td>
                  <td>Whole retreat</td>
                  <td>
                    Execution owner: every schedule below is confirmed with the person on it, before the retreat and
                    again day-of.
                  </td>
                </tr>
                <tr>
                  <td>Engineers</td>
                  <td>Working blocks per the agenda</td>
                  <td>
                    Each engineer knows which morning and afternoon blocks they are in, and at which venue. They are
                    there to work, not on standby.
                  </td>
                </tr>
                <tr>
                  <td>Driver</td>
                  <td>Airport runs + daily transfers</td>
                  <td>
                    Knows every drive: airport pickup and drop-off, plus transfers between Lumiere and the co-working
                    center on the days the venue map calls for them.
                  </td>
                </tr>
                <tr>
                  <td>Maid</td>
                  <td>Cleaning windows</td>
                  <td>
                    Cleans while rooms are empty, which means her window comes from the agenda: when the guest is in a
                    session, not when they might walk back in.
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          <div className="wf-loop-note">
            <svg viewBox="0 0 24 24" fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <path d="M12 16v-4" />
              <path d="M12 8h.01" />
            </svg>
            <span>
              <strong>The staffing test:</strong> every person on this table can tell you their own schedule. If they
              can&apos;t, the schedule exists only in your head, and that does not count.
            </span>
          </div>
        </div>
      </section>

      {/* Meals + free time */}
      <section className="section" style={{ background: 'var(--tint)', padding: '72px 0' }}>
        <div className="container">
          <span className="section-label" style={{ background: 'var(--white)' }}>
            The hospitality calls
          </span>
          <h2 className="section-title" style={{ fontSize: 34 }}>
            Meals and free time
          </h2>
          <p className="section-sub" style={{ marginTop: 12 }}>
            This is the judgment zone. There is no fixed script for meals and downtime, but there are defaults, and they
            scale with how long the guest is staying.
          </p>
          <div className="wf-info-grid">
            <div className="wf-info-card" style={{ background: 'var(--white)' }}>
              <h3>Lunch</h3>
              <ul>
                <li>Default: lunch together with the team</li>
                <li>
                  At least once, make it a bigger lunch that doubles as time off: a longer break where the guest can go
                  to the spa or just breathe
                </li>
                <li>Decide which day gets the long lunch when you build the agenda, not on the day</li>
              </ul>
            </div>
            <div className="wf-info-card wf-info-card-mint" style={{ background: 'var(--white)' }}>
              <h3>Dinner and free time</h3>
              <ul>
                <li>Dinner is optional, not assumed. Plan which nights are hosted and which are free</li>
                <li>How much free time depends on how long they are staying: longer stay, more unscheduled time</li>
                <li>
                  We do not need to be with the guest every part of the day. Deliberate free time is hospitality, not
                  neglect
                </li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Getting started + escalation */}
      <section className="section">
        <div className="container">
          <span className="section-label">Getting started</span>
          <h2 className="section-title" style={{ fontSize: 34 }}>
            Before each retreat, and when to escalate
          </h2>
          <div className="wf-info-grid">
            <div className="wf-info-card">
              <h3>Pre-retreat checklist</h3>
              <ul>
                <li>Flight details confirmed and VIP arrival booked</li>
                <li>Driver briefed: airport run plus all daily transfers</li>
                <li>Access pack ready: keys, door combination, room number</li>
                <li>Host for arrival named and confirmed</li>
                <li>Agenda drafted in blocks, every block mapped to a venue, every room booked</li>
                <li>Engineers, driver, and maid each confirmed their own schedule</li>
                <li>Long-lunch day and hosted dinners decided</li>
              </ul>
            </div>
            <div className="wf-info-card wf-info-card-mint">
              <h3>Escalate to Dave when</h3>
              <ul>
                <li>The guest&apos;s flight changes and the VIP service or driver cannot move with it</li>
                <li>No Lumiere room or co-working space is available for a block</li>
                <li>A staffing gap appears that you cannot fill: an engineer, the driver, or the maid drops out</li>
                <li>Anything about the guest&apos;s stay feels off and Quan is unsure how to handle it</li>
              </ul>
            </div>
          </div>
          <div className="wf-detail-foot">
            <Link href="/workflows/infinite-leverage-retreats" className="wf-back">
              ← The retreats workflow: sales, record, and P&L
            </Link>
            <Link href="/workflows/private/accounting-training" className="wf-back">
              Accounting training guide →
            </Link>
          </div>
        </div>
      </section>
    </main>
  )
}
