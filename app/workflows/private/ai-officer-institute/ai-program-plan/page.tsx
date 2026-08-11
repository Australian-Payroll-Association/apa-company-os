import type { Metadata } from 'next'
import Link from 'next/link'
import PrivateGate from '../../PrivateGate'

export const metadata: Metadata = {
  title: 'Video, Micro Sessions and Coaching | AI Officer Institute | Edge8',
  description:
    'Program design brief for the AI Officer Institute: video, micro-sessions, and coaching, how they are tagged, and how learners earn credit toward a certification.',
  robots: { index: false, follow: false },
}

const TRACKS = ['Leadership', 'AI Engineering', 'AI Officer']
const OFFICES: { name: string; cls: string }[] = [
  { name: 'Revenue', cls: 'wf-cat-revenue' },
  { name: 'Talent', cls: 'wf-cat-talent' },
  { name: 'Operations', cls: 'wf-cat-operations' },
  { name: 'Innovation', cls: 'wf-cat-innovation' },
]

export default function AiProgramPlanPage() {
  return (
    <PrivateGate>
      <main>
        <style>{`
          .app-section { margin-top: 56px; }
          .app-section:first-of-type { margin-top: 0; }
          .app-kicker {
            font-size: 12px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase;
            color: var(--blue); margin-bottom: 10px;
          }
          .app-h2 {
            font-family: var(--font-display); font-size: 26px; font-weight: 600;
            color: var(--dark); margin-bottom: 14px; line-height: 1.25;
          }
          .app-lead { font-size: 16px; line-height: 1.7; color: var(--body-text); max-width: 760px; }
          .app-chips { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 16px; }
          .app-tracks { display: flex; flex-wrap: wrap; gap: 10px; margin-top: 18px; }
          .app-track {
            font-size: 14px; font-weight: 600; color: var(--dark); background: var(--tint);
            border: 1px solid var(--card-border); border-radius: 40px; padding: 8px 18px;
          }
          .app-cards { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 20px; margin-top: 24px; }
          .app-card {
            background: var(--white); border: 1px solid var(--card-border); border-radius: 14px;
            padding: 24px;
          }
          .app-card h3 { font-size: 17px; font-weight: 700; color: var(--dark); margin-bottom: 8px; }
          .app-card p { font-size: 14px; line-height: 1.6; color: var(--body-text); }
          .app-list { list-style: none; display: flex; flex-direction: column; gap: 12px; margin-top: 18px; }
          .app-list li { position: relative; padding-left: 22px; font-size: 15px; line-height: 1.6; color: var(--body-text); }
          .app-list li::before {
            content: ''; position: absolute; left: 0; top: 9px; width: 8px; height: 8px;
            border-radius: 50%; background: var(--blue);
          }
          .app-list li strong { color: var(--dark); }
          .app-callout {
            margin-top: 22px; background: var(--tint); border-left: 3px solid var(--blue);
            border-radius: 10px; padding: 18px 22px; font-size: 15px; line-height: 1.65; color: var(--body-text);
          }
          .app-axis-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 24px; margin-top: 24px; }
          @media (max-width: 720px) { .app-axis-grid { grid-template-columns: 1fr; } }
        `}</style>

        <section className="wf-hero">
          <div className="container">
            <div className="wf-hero-inner">
              <div className="wf-breadcrumb">
                <Link href="/workflows">Workflows</Link>
                <span>/</span>
                <Link href="/workflows/private">Private</Link>
                <span>/</span>
                <Link href="/workflows/private/ai-officer-institute">AI Officer Institute</Link>
                <span>/</span>
                <span>Video, Micro Sessions and Coaching</span>
              </div>
              <h1 className="section-title">Video, Micro Sessions and Coaching</h1>
              <p className="wf-hero-sub">
                The program design brief for the AI Officer Institute: how video, micro-sessions,
                and coaching fit together, how they are tagged, and how learners earn credit toward
                a certification.
              </p>
            </div>
          </div>
        </section>

        <section className="section">
          <div className="container" style={{ maxWidth: 900 }}>
            {/* Overview */}
            <div className="app-section">
              <div className="app-kicker">Overview</div>
              <h2 className="app-h2">One program, three certification tracks</h2>
              <p className="app-lead">
                The AI Officer Institute certifies people through structured learning. Every learner
                works toward one certification track at a time, earning credit by completing the
                challenge attached to each session. There are three tracks:
              </p>
              <div className="app-tracks">
                {TRACKS.map((t) => (
                  <span key={t} className="app-track">{t}</span>
                ))}
              </div>
            </div>

            {/* Video */}
            <div className="app-section">
              <div className="app-kicker">Video</div>
              <h2 className="app-h2">The video library and how it earns credit</h2>
              <p className="app-lead">
                Video is the front door to the program. Learners watch, and their watch time turns
                into progress. Here is how the video layer is shaping up:
              </p>
              <ul className="app-list">
                <li>
                  <strong>General library of full-length videos.</strong> The complete sessions,
                  browsable in one place.
                </li>
                <li>
                  <strong>Shorts, catalogued not browsed.</strong> Sections of the full-length videos
                  are cut into shorts and catalogued against the slides and sections they map to. We
                  display them in context, but there is no browsable shorts library, people won&rsquo;t
                  browse shorts initially.
                </li>
                <li>
                  <strong>Videos link out.</strong> Each video connects to its Mission Overview, Core
                  Missions, Micro Sessions, and Blogs.
                </li>
                <li>
                  <strong>Watch time counts.</strong> We can log the time learners spend on videos and
                  give them credit toward their progress.
                </li>
              </ul>
              <div className="app-callout">
                <strong>David Hajdu (Dave).</strong> Book a 1-1 anytime:{' '}
                <a
                  href="https://talentedgeai.larksuite.com/scheduler/94b8c9566fee29f1"
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ color: 'var(--blue)', fontWeight: 600 }}
                >
                  scheduler link
                </a>
                . Let&rsquo;s talk today about how to approach it. I can share what I&rsquo;m
                thinking.
              </div>
            </div>

            {/* Session types */}
            <div className="app-section">
              <div className="app-kicker">Session types</div>
              <h2 className="app-h2">Standard sessions, micro-sessions, and coaching</h2>
              <div className="app-cards">
                <div className="app-card">
                  <h3>Standard session</h3>
                  <p>The existing full-length session. The baseline unit of the curriculum.</p>
                </div>
                <div className="app-card">
                  <h3>Micro-session</h3>
                  <p>
                    A small elective: one video, one textbook, and one small challenge. The screens
                    and flow are identical to a standard session, just smaller.
                  </p>
                </div>
                <div className="app-card">
                  <h3>Coaching (Open Coaching)</h3>
                  <p>
                    A live, community coaching session where learners bring a real AI challenge and
                    get coached. Recorded and archived so others can learn from it.
                  </p>
                </div>
              </div>
            </div>

            {/* Micro-sessions detail */}
            <div className="app-section">
              <div className="app-kicker">Micro-sessions</div>
              <h2 className="app-h2">Electives that count toward your certification</h2>
              <p className="app-lead">
                Micro-sessions are the electives of the program. They are exactly like a normal
                session, only small.
              </p>
              <ul className="app-list">
                <li>
                  <strong>Content:</strong> a video, a textbook, and a small challenge.
                </li>
                <li>
                  <strong>Identical UI:</strong> the micro-session screens are the same as a standard
                  session, so learners already know the flow.
                </li>
                <li>
                  <strong>Live option:</strong> the micro-session screen shows the upcoming live
                  session. A learner can sign up, receive a Zoom link, and join, building a community
                  of people learning the same topic.
                </li>
                <li>
                  <strong>Earning credit:</strong> credit works exactly like a standard session, the
                  learner completes the challenge in the AI buddy and submits it.
                </li>
              </ul>
              <div className="app-callout">
                <strong>Credit rule.</strong> A learner can apply any micro-session to the
                certification they are <em>currently</em> working on, like taking an elective in
                college (a Leadership class can count toward an AI Officer certification). It applies
                to the current certification <strong>once</strong>, the same micro-session cannot be
                applied a second time later. This is marked in the database.
              </div>
            </div>

            {/* Tag taxonomy */}
            <div className="app-section">
              <div className="app-kicker">Tags</div>
              <h2 className="app-h2">Two independent tag axes</h2>
              <p className="app-lead">
                Every micro-session carries two tags on two independent axes: which office it is
                about, and which discipline (certification) it most applies to.
              </p>
              <div className="app-axis-grid">
                <div className="app-card">
                  <h3>Office</h3>
                  <p>What area of the business the session is about.</p>
                  <div className="app-chips">
                    {OFFICES.map((o) => (
                      <span key={o.name} className={`wf-cat ${o.cls}`}>{o.name}</span>
                    ))}
                  </div>
                </div>
                <div className="app-card">
                  <h3>Discipline</h3>
                  <p>Which certification the session is most applicable to.</p>
                  <div className="app-tracks" style={{ marginTop: 12 }}>
                    {TRACKS.map((t) => (
                      <span key={t} className="app-track">{t}</span>
                    ))}
                  </div>
                </div>
              </div>
              <div className="app-callout">
                More tag types will be added later as the catalog grows, for example tool tags such
                as Claude or ChatGPT.
              </div>
            </div>

            {/* Coaching detail */}
            <div className="app-section">
              <div className="app-kicker">Coaching</div>
              <h2 className="app-h2">Open Coaching: bring a challenge, get coached</h2>
              <p className="app-lead">
                Open Coaching mirrors the coaching prototype at{' '}
                <a
                  href="https://www.caiocoach.com/coaching"
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ color: 'var(--blue)', fontWeight: 600 }}
                >
                  caiocoach.com/coaching
                </a>{' '}
                (our own site, where the prototype was built), brought into the AI Officer Institute.
                Like micro-sessions, coaching has an Upcoming view and an Archive.
              </p>
              <ul className="app-list">
                <li>
                  <strong>Cadence:</strong> every Thursday at 11:00 AM GMT+7. A second time for the US
                  will likely be added later.
                </li>
                <li>
                  <strong>Sign up and submit:</strong> anyone can sign up. Learners submit an AI
                  challenge they are having and get coached on it that day.
                </li>
                <li>
                  <strong>Open to all:</strong> attendees can listen in and ask questions.
                </li>
                <li>
                  <strong>Recorded and published:</strong> each session is recorded and automatically
                  published to the archive so others can learn from it.
                </li>
              </ul>
              <div className="app-callout">
                <strong>Reference.</strong> The working prototype lives at{' '}
                <a
                  href="https://www.caiocoach.com/coaching"
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ color: 'var(--blue)', fontWeight: 600 }}
                >
                  caiocoach.com/coaching
                </a>
                , our own site. It is the model for the Upcoming and Archive flows being brought into
                the AI Officer Institute.
              </div>
            </div>

            {/* Scope note */}
            <div className="app-section">
              <div className="app-callout" style={{ borderLeftColor: 'var(--wf-amber, #E89B28)' }}>
                <strong>Scope note.</strong> This page is the design brief. The micro-session and
                coaching interfaces are partially built and are being finished separately, the UI
                work is a distinct effort from this document.
              </div>
            </div>
          </div>
        </section>
      </main>
    </PrivateGate>
  )
}
