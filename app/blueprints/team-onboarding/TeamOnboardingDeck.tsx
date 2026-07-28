'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

const TOTAL = 19

export default function TeamOnboardingDeck({ fontClassName = '' }: { fontClassName?: string }) {
  const [current, setCurrent] = useState(0)
  const [hintFaded, setHintFaded] = useState(false)
  const hashInitialized = useRef(false)

  const go = useCallback((n: number) => {
    setCurrent(() => Math.max(0, Math.min(TOTAL - 1, n)))
  }, [])
  const next = useCallback(() => setCurrent((c) => Math.min(TOTAL - 1, c + 1)), [])
  const prev = useCallback(() => setCurrent((c) => Math.max(0, c - 1)), [])

  // Keyboard navigation
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === 'PageDown') {
        e.preventDefault()
        next()
      } else if (e.key === 'ArrowLeft' || e.key === 'PageUp') {
        e.preventDefault()
        prev()
      } else if (e.key === ' ') {
        e.preventDefault()
        next()
      } else if (e.key === 'Home') {
        e.preventDefault()
        go(0)
      } else if (e.key === 'End') {
        e.preventDefault()
        go(TOTAL - 1)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [next, prev, go])

  // Touch swipe
  useEffect(() => {
    let touchStart: number | null = null
    const onStart = (e: TouchEvent) => {
      touchStart = e.touches[0].clientX
    }
    const onEnd = (e: TouchEvent) => {
      if (touchStart === null) return
      const dx = e.changedTouches[0].clientX - touchStart
      if (Math.abs(dx) > 50) {
        if (dx < 0) next()
        else prev()
      }
      touchStart = null
    }
    window.addEventListener('touchstart', onStart, { passive: true })
    window.addEventListener('touchend', onEnd, { passive: true })
    return () => {
      window.removeEventListener('touchstart', onStart)
      window.removeEventListener('touchend', onEnd)
    }
  }, [next, prev])

  // On mount: lock page scroll, jump to hash slide, fade the hint
  useEffect(() => {
    const prevBody = document.body.style.overflow
    const prevHtml = document.documentElement.style.overflow
    document.body.style.overflow = 'hidden'
    document.documentElement.style.overflow = 'hidden'

    const h = parseInt(window.location.hash.slice(1), 10)
    if (!Number.isNaN(h) && h >= 1 && h <= TOTAL) setCurrent(h - 1)

    const t = window.setTimeout(() => setHintFaded(true), 100)
    return () => {
      document.body.style.overflow = prevBody
      document.documentElement.style.overflow = prevHtml
      window.clearTimeout(t)
    }
  }, [])

  // Keep the URL hash in sync (skip the first render so a no-hash visit stays clean)
  useEffect(() => {
    if (!hashInitialized.current) {
      hashInitialized.current = true
      return
    }
    const h = '#' + (current + 1)
    if (window.location.hash !== h) window.history.replaceState(null, '', h)
  }, [current])

  const handleDeckClick = useCallback(
    (e: React.MouseEvent) => {
      if ((e.target as HTMLElement).closest('button, a, input')) return
      if (e.clientX < window.innerWidth * 0.3) prev()
      else next()
    },
    [next, prev]
  )

  const slideClass = (i: number) =>
    'slide ' + (i === current ? 'active' : i < current ? 'before' : 'after')

  return (
    <div className={['deckRoot', fontClassName].filter(Boolean).join(' ')}>
      <div className="progress">
        <div className="progress-fill" style={{ width: `${((current + 1) / TOTAL) * 100}%` }} />
      </div>

      <div className="brand">
        Edge8 AI<span className="dot">·</span>Team Onboarding
      </div>

      <div className={'hint' + (hintFaded ? ' fade' : '')}>
        <kbd>←</kbd> <kbd>→</kbd> or click to navigate
      </div>

      <div className="deck" onClick={handleDeckClick}>
        {/* 1. Cover */}
        <section className={slideClass(0)}>
          <div className="blob b1" />
          <div className="blob b2" />
          <div className="slide-inner cover">
            <div className="eyebrow">Team Onboarding</div>
            <h1 className="title">Edge8 AI</h1>
            <div className="divider center" />
            <p className="tagline">Be Tech-Forward</p>
          </div>
        </section>

        {/* 2. The Company */}
        <section className={slideClass(1)}>
          <div className="slide-inner">
            <div className="label">The Company</div>
            <h2 className="heading">Built for the AI era</h2>
            <p className="intro">
              18+ years of experience with Vietnam talent, SaaS product development, and doing
              business in Vietnam.
            </p>
            <div className="stats-row">
              <div className="stat">
                <div className="stat-num">2024</div>
                <div className="stat-lbl">Year founded</div>
              </div>
              <div className="stat">
                <div className="stat-num">18+</div>
                <div className="stat-lbl">Years experience</div>
              </div>
              <div className="stat">
                <div className="stat-num">14</div>
                <div className="stat-lbl">Active clients</div>
              </div>
            </div>
          </div>
        </section>

        {/* 3. Mission */}
        <section className={slideClass(2)}>
          <div className="slide-inner">
            <div className="label">Mission</div>
            <h2 className="heading">Two outcomes, one mission</h2>
            <div className="mission-rows">
              <div className="mission-row">
                <span className="mission-tag">Edge8</span>
                <p className="mission-text">
                  Help 100 organizations implement <strong>AI Programs</strong>.
                </p>
              </div>
              <div className="mission-row">
                <span className="mission-tag">AIO</span>
                <p className="mission-text">
                  Train <strong>1 million AI Officers</strong> so they can lead{' '}
                  <strong>AI Programs</strong>.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* 4. Values */}
        <section className={slideClass(3)}>
          <div className="slide-inner">
            <div className="label">Values</div>
            <h2 className="heading">How we work</h2>
            <div className="values-grid">
              <div className="value">
                <h4>Leverage Intelligence</h4>
                <p>Use AI to think smarter, work faster, and raise the quality of everything you do.</p>
              </div>
              <div className="value alt">
                <h4>Deliver Impact</h4>
                <p>
                  Ship meaningful progress weekly that moves clients, products, and the business
                  forward.
                </p>
              </div>
              <div className="value">
                <h4>Communicate Transparently</h4>
                <p>
                  Work in the open. Share progress, questions, decisions, and blockers so teams move
                  faster together.
                </p>
              </div>
              <div className="value alt">
                <h4>Act With Ownership</h4>
                <p>
                  Take responsibility, proactively solve problems, and follow through until the
                  result is achieved.
                </p>
              </div>
              <div className="value">
                <h4>Learn and Share</h4>
                <p>
                  Grow every week and make your learning visible to strengthen the team and the AIO
                  community.
                </p>
              </div>
              <div className="value alt">
                <h4>Have Fun Building</h4>
                <p>
                  Bring energy, curiosity, and play into the work. Enjoy experimenting,
                  collaborating, and creating.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* 5. The Team */}
        <section className={slideClass(4)}>
          <div className="slide-inner">
            <div className="label">The Team</div>
            <h2 className="heading">Who you&apos;ll work with</h2>
            <div className="team-stats">
              <div className="team-stat">
                <div className="ts-num">26</div>
                <div className="ts-lbl">Team members</div>
              </div>
              <div className="team-stat">
                <div className="ts-num">6</div>
                <div className="ts-lbl">Partners &amp; Advisors</div>
              </div>
            </div>
            <div className="team-grid">
              <div>
                <div className="team-block">
                  <h5>Operations</h5>
                  <ul>
                    <li>
                      <span className="name">Dave Hajdu</span> : Founder
                    </li>
                    <li>
                      <span className="name">Mai Dang</span> : Associate Ops Director
                    </li>
                    <li>
                      <span className="name">My Pham</span> : Bookkeeper &amp; Admin
                    </li>
                  </ul>
                </div>
                <div className="team-block">
                  <h5>Unlock Venture Capital</h5>
                  <ul>
                    <li>
                      <span className="name">Hieu Nguyen</span> : AI Engineer
                    </li>
                  </ul>
                </div>
                <div className="team-block">
                  <h5>On Target</h5>
                  <ul>
                    <li>
                      <span className="name">Minh Vu</span> : Principal Engineer
                    </li>
                    <li>
                      <span className="name">Binh Tran</span> : Senior QA Engineer
                    </li>
                    <li>
                      <span className="name">Tan Le</span> : Senior QA Engineer
                    </li>
                    <li>
                      <span className="name">Harry Le</span> : Senior QA Engineer
                    </li>
                    <li>
                      <span className="name">Tam Nguyen</span> : Mobile Engineer
                    </li>
                    <li>
                      <span className="name">Duc Nguyen</span> : Senior Engineer
                    </li>
                    <li>
                      <span className="name">Thanh Tran</span> : Senior Engineer
                    </li>
                    <li>
                      <span className="name">Loi Nguyen</span> : Senior Engineer
                    </li>
                  </ul>
                </div>
              </div>

              <div>
                <div className="team-block">
                  <h5>Wareease</h5>
                  <ul>
                    <li>
                      <span className="name">Quan Le</span> : Senior Developer
                    </li>
                  </ul>
                </div>
                <div className="team-block">
                  <h5>Entrepreneur Organization</h5>
                  <ul>
                    <li>
                      <span className="name">Ha Nguyen</span> : CRM + Project Mgmt
                    </li>
                    <li>
                      <span className="name">Thanh Nguyen</span> : HubSpot Specialist
                    </li>
                    <li>
                      <span className="name">Khoi Le</span> : Fullstack Engineer
                    </li>
                    <li>
                      <span className="name">Quang Van</span> : C# Engineer
                    </li>
                  </ul>
                </div>
                <div className="team-block">
                  <h5>DOXA Talent</h5>
                  <ul>
                    <li>
                      <span className="name">Ngoc Le</span> : AI Engineer
                    </li>
                  </ul>
                </div>
                <div className="team-block">
                  <h5>Infinite Leverage + AIOLabz</h5>
                  <ul>
                    <li>
                      <span className="name">Quan</span> : Business Consultant
                    </li>
                    <li>
                      <span className="name">Lan Anh</span> : Design
                    </li>
                    <li>
                      <span className="name">Ginny Vo</span> : Design
                    </li>
                    <li>
                      <span className="name">Trac Nguyen</span> : AI Engineer
                    </li>
                    <li>
                      <span className="name">Khoa Doan</span> : AI Engineer
                    </li>
                    <li>
                      <span className="name">Ethan Truong</span> : Video Producer
                    </li>
                    <li>
                      <span className="name">Viet Ha</span> : UX Designer &amp; Developer
                    </li>
                    <li>
                      <span className="name">Van Anh</span> : AI Engineer
                    </li>
                  </ul>
                </div>
              </div>

              <div>
                <div className="team-block">
                  <h5>LLC Members &amp; Advisors</h5>
                  <ul>
                    <li>
                      <span className="name">David Niu</span> : Member
                    </li>
                    <li>
                      <span className="name">Jeff Hu</span> : Member + Client
                    </li>
                    <li>
                      <span className="name">Eric Enriquez</span> : Member + Sales
                    </li>
                    <li>
                      <span className="name">Bin Yu</span> : Member
                    </li>
                    <li>
                      <span className="name">David Nilssen</span> : Partner, AIO
                    </li>
                    <li>
                      <span className="name">Dr. Brooks C. Holtom</span> : Partner, AIO
                    </li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* 6. 2026 Theme */}
        <section className={slideClass(5)}>
          <div className="slide-inner">
            <div className="label mint">2026 Theme</div>
            <h2 className="heading">
              A Year of <span className="accent">Intentional Outcomes</span>
            </h2>
            <div className="divider" />
            <p className="intro">
              Our ambition is to 4x our size through the development of three business lines.
            </p>
            <ul className="theme-list">
              <li>Global Talent</li>
              <li>AI Programs + Labs</li>
              <li>AI Officer Institute</li>
            </ul>
          </div>
        </section>

        {/* 7. Growth Strategy */}
        <section className={slideClass(6)}>
          <div className="slide-inner">
            <div className="label">Growth Strategy</div>
            <h2 className="heading">What 4x looks like</h2>
            <p className="intro">The concrete targets behind our 2026 ambition.</p>
            <div className="growth-grid">
              <div className="growth-card">
                <div className="growth-lead">1,000</div>
                <div className="growth-label">Keynote attendees</div>
              </div>
              <div className="growth-card mint">
                <div className="growth-lead">500</div>
                <div className="growth-label">Trained AI Officers</div>
              </div>
              <div className="growth-card magenta">
                <div className="growth-lead text">Georgetown</div>
                <div className="growth-label">University affiliation</div>
              </div>
              <div className="growth-card mint">
                <div className="growth-lead">15</div>
                <div className="growth-label">On Target team</div>
              </div>
              <div className="growth-card orange">
                <div className="growth-lead">20</div>
                <div className="growth-label">Entrepreneur Organization</div>
              </div>
              <div className="growth-card">
                <div className="growth-lead">3+</div>
                <div className="growth-label">Books published</div>
              </div>
            </div>
          </div>
        </section>

        {/* 8. Big header: What we expect from you */}
        <section className={slideClass(7)}>
          <div className="slide-inner big-header">
            <div className="eyebrow">Part 1</div>
            <h2>What we expect from you</h2>
            <div className="divider center" />
          </div>
        </section>

        {/* 9. North Star */}
        <section className={slideClass(8)}>
          <div className="slide-inner">
            <div className="label">North Star</div>
            <p className="northstar-quote">
              <span className="quote-mark">&quot;</span>I will become an industry-leading expert in
              orchestrating AI resources for my role. I will reach higher levels of quality, fast.
              <span className="quote-mark">&quot;</span>
            </p>
          </div>
        </section>

        {/* 10. Expectations */}
        <section className={slideClass(9)}>
          <div className="slide-inner">
            <div className="label">Expectations</div>
            <h2 className="heading">How to show up</h2>
            <div className="expect-grid">
              <div className="expect-item">Be proactive, assertive, confident</div>
              <div className="expect-item">Use data, always</div>
              <div className="expect-item">
                Think deeply about the business and seek to learn every aspect of it
              </div>
              <div className="expect-item">Write perfect English, using ChatGPT</div>
              <div className="expect-item">Over-communicate, ask questions, chat frequently</div>
              <div className="expect-item">Be detail-oriented</div>
              <div className="expect-item">Take detailed notes, use notetakers</div>
              <div className="expect-item">Smile and have fun</div>
              <div className="expect-item">
                Don&apos;t be afraid to make mistakes. Fail fast, learn fast
              </div>
            </div>
          </div>
        </section>

        {/* 11. Key to Success */}
        <section className={slideClass(10)}>
          <div className="slide-inner">
            <div className="label">Key to Success</div>
            <h2 className="heading">Five habits that compound</h2>
            <div className="success-grid">
              <div className="success-card">
                <div className="success-head">Plan Well</div>
                <div className="success-body">Detailed organization of your time and tasks</div>
              </div>
              <div className="success-card">
                <div className="success-head">Communicate Often</div>
                <div className="success-body">
                  Be proactive, ask questions, check in regularly, document well
                </div>
              </div>
              <div className="success-card">
                <div className="success-head">Be Nice</div>
                <div className="success-body">Words matter, especially in a remote environment</div>
              </div>
              <div className="success-card">
                <div className="success-head">Measure, Iterate, Measure</div>
                <div className="success-body">Prioritize and solve problems accordingly</div>
              </div>
              <div className="success-card">
                <div className="success-head">Reflect</div>
                <div className="success-body">
                  Don&apos;t worry about failing. Spend time reflecting and document learning
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* 12. TE Company Tools */}
        <section className={slideClass(11)}>
          <div className="slide-inner">
            <div className="label">TE Company Tools</div>
            <h2 className="heading">The stack you&apos;ll use</h2>
            <div className="stack-layout">
              <div className="tools-grid">
                <div className="tool-chip">
                  <span className="num">01</span> Lark
                </div>
                <div className="tool-chip">
                  <span className="num">02</span> Llama Index
                </div>
                <div className="tool-chip">
                  <span className="num">03</span> Quickbooks
                </div>
                <div className="tool-chip">
                  <span className="num">04</span> Perplexity.ai
                </div>
                <div className="tool-chip">
                  <span className="num">05</span> Ubersuggest
                </div>
                <div className="tool-chip">
                  <span className="num">06</span> Canva
                </div>
                <div className="tool-chip">
                  <span className="num">07</span> HubSpot
                </div>
                <div className="tool-chip">
                  <span className="num">08</span> Thoughtflow
                </div>
                <div className="tool-chip">
                  <span className="num">09</span> AIOlabz.com
                </div>
              </div>
              <div className="power-stack">
                <h4>The Super Power Stack</h4>
                <ul className="power-list">
                  <li>Claude</li>
                  <li>GitHub</li>
                  <li>Vercel</li>
                  <li>Supabase</li>
                </ul>
              </div>
            </div>
          </div>
        </section>

        {/* 13. Sample Personal Objectives */}
        <section className={slideClass(12)}>
          <div className="slide-inner">
            <div className="label">Sample Personal Objectives</div>
            <h2 className="heading">What good goals look like</h2>
            <div className="obj-grid">
              <div className="obj-card">
                <h4>Increase my AI knowledge</h4>
                <ol>
                  <li>Publish 1 learning per month to the team wiki</li>
                  <li>Create one automated process for my role</li>
                </ol>
              </div>
              <div className="obj-card">
                <h4>Drive customer value</h4>
                <ol>
                  <li>NPS score &gt; 50 for the product I work on</li>
                  <li>Three automations published to the community</li>
                </ol>
              </div>
              <div className="obj-card">
                <h4>Contribute to hyper-growth</h4>
                <ol>
                  <li>My client team expands by 25%</li>
                  <li>My product generates 50,000 users by year end</li>
                </ol>
              </div>
            </div>
          </div>
        </section>

        {/* 14. Daily Check-in */}
        <section className={slideClass(13)}>
          <div className="slide-inner">
            <div className="label">Daily Rhythm</div>
            <h2 className="heading">Daily check-in</h2>
            <p className="intro">
              Every day in our channel, post the most important things you need to accomplish today.
            </p>
            <ul className="step-list">
              <li className="step-row">
                <div className="step-num">01</div>
                <div className="step-body">
                  <h4>Be specific</h4>
                  <p>
                    Name the deliverable. Not &quot;work on the deck&quot;, but &quot;ship the v2
                    outline by 3pm&quot;.
                  </p>
                </div>
              </li>
              <li className="step-row">
                <div className="step-num">02</div>
                <div className="step-body">
                  <h4>Be clear</h4>
                  <p>
                    Anyone reading should know what done looks like, without follow-up questions.
                  </p>
                </div>
              </li>
              <li className="step-row">
                <div className="step-num">03</div>
                <div className="step-body">
                  <h4>Flag blockers</h4>
                  <p>If something is blocking you, name it and say what kind of help you need.</p>
                </div>
              </li>
            </ul>
          </div>
        </section>

        {/* 15. One-on-Ones */}
        <section className={slideClass(14)}>
          <div className="slide-inner">
            <div className="label">Cadence · Every 2 weeks</div>
            <h2 className="heading">One-on-ones are yours</h2>
            <p className="intro">
              1:1s happen every two weeks and exist for the employee. It&apos;s on you to make them
              happen and make them count.
            </p>
            <ul className="step-list">
              <li className="step-row">
                <div className="step-num">01</div>
                <div className="step-body">
                  <h4>Make sure they happen</h4>
                  <p>
                    Hold the recurring slot every two weeks. Show up. Reschedule if it slips.
                    Don&apos;t wait to be invited.
                  </p>
                </div>
              </li>
              <li className="step-row">
                <div className="step-num">02</div>
                <div className="step-body">
                  <h4>Record and store</h4>
                  <p>Take the recording every time and save it to your folder for reference.</p>
                </div>
              </li>
              <li className="step-row">
                <div className="step-num">03</div>
                <div className="step-body">
                  <h4>Maintain your 1:1 doc</h4>
                  <p>
                    Keep your goals and success criteria up to date. This is your record of what
                    you&apos;re working toward.
                  </p>
                </div>
              </li>
            </ul>
            <p className="reward-line">
              <span className="accent-mint">This is how people get rewarded.</span>
            </p>
          </div>
        </section>

        {/* 16. Big header: What to expect from me */}
        <section className={slideClass(15)}>
          <div className="slide-inner big-header">
            <div className="eyebrow">Part 2</div>
            <h2>What to expect from me</h2>
            <div className="divider center" />
          </div>
        </section>

        {/* 17. Working with Dave */}
        <section className={slideClass(16)}>
          <div className="slide-inner">
            <div className="label">From Dave</div>
            <h2 className="heading">Working with Dave</h2>
            <div className="dave-grid">
              <div className="dave-item">
                I work at all hours. It does not mean you have to respond outside of business hours.
              </div>
              <div className="dave-item">
                I&apos;m becoming laser-focused on delivering value. You should too.
              </div>
              <div className="dave-item">I prefer short, concise communication.</div>
              <div className="dave-item">
                I often respond from mobile. Don&apos;t feel offended if my answers are short.
              </div>
              <div className="dave-item">
                I like when people help me get more organized. Naturally, I&apos;m not an organized
                person.
              </div>
              <div className="dave-item">I love constructive feedback. Don&apos;t be shy.</div>
              <div className="dave-item">
                I get excited about hard problems and solving them with technology, specifically AI.
              </div>
              <div className="dave-item">
                I&apos;m on the Global Tech Committee for EO, which has 20,000 million-dollar
                businesses worldwide.
              </div>
              <div className="dave-item bold">
                I love proactive people who work smart and hard.
              </div>
              <div className="dave-item">I can&apos;t eat onions.</div>
            </div>
          </div>
        </section>

        {/* 18. Dave's Time */}
        <section className={slideClass(17)}>
          <div className="slide-inner">
            <div className="label">Dave&apos;s Time</div>
            <h2 className="heading">How my week splits</h2>
            <div className="pie-layout">
              <div className="pie-wrap">
                <div className="pie-ring" />
                <div className="pie" />
              </div>
              <ul className="pie-legend">
                <li>
                  <span className="legend-dot" style={{ background: 'var(--blue)' }} />
                  <span className="legend-name">Learn + AIO Labz + Teach</span>
                  <span className="legend-pct">30%</span>
                </li>
                <li>
                  <span className="legend-dot" style={{ background: 'var(--magenta)' }} />
                  <span className="legend-name">People</span>
                  <span className="legend-pct">20%</span>
                </li>
                <li>
                  <span className="legend-dot" style={{ background: 'var(--mint)' }} />
                  <span className="legend-name">Infinite Leverage Retreat</span>
                  <span className="legend-pct">20%</span>
                </li>
                <li>
                  <span className="legend-dot" style={{ background: 'var(--orange)' }} />
                  <span className="legend-name">EO</span>
                  <span className="legend-pct">20%</span>
                </li>
                <li>
                  <span className="legend-dot" style={{ background: 'rgba(255,255,255,0.4)' }} />
                  <span className="legend-name">Health</span>
                  <span className="legend-pct">10%</span>
                </li>
              </ul>
            </div>
          </div>
        </section>

        {/* 19. AI Research / Closing */}
        <section className={slideClass(18)}>
          <div className="blob b1" />
          <div className="blob b2" />
          <div className="slide-inner closing">
            <h2>AI Research</h2>
            <div className="divider center" />
            <div className="lines">
              <p>Join the AI Officer community.</p>
              <p>Learn &amp; share.</p>
              <p className="mint-line">It&apos;s your job.</p>
            </div>
          </div>
        </section>
      </div>

      <div className="deck-nav">
        <button className="nav-btn" onClick={prev} disabled={current === 0} aria-label="Previous slide">
          ←
        </button>
        <div className="counter">
          <span className="current">{current + 1}</span> / <span className="total">{TOTAL}</span>
        </div>
        <button
          className="nav-btn"
          onClick={next}
          disabled={current === TOTAL - 1}
          aria-label="Next slide"
        >
          →
        </button>
      </div>
    </div>
  )
}
