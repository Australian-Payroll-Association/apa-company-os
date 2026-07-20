import Link from "next/link";
import Image from "next/image";
import type { PostMeta } from "@/lib/postData";

// The "Start here" panel: a new hire's first-use surface on the /team home,
// rendered only while employment_stage is 'pre_boarding' or 'probation' (see
// TeamHome). Four blocks, in order: the required core teaching, the newest blog
// posts, the role-based tool kit, and the AIOlabz / AI Officer certification.
// All reading opens in a new tab so the workspace stays put.

const CERT_URL = "https://www.ai-officer.com/certification";
const AIOLABZ_URL = "https://aiolabz.com";

// Every role gets the baseline; a role adds a few more (from the onboarding
// deck's tool slide). Buckets: Engineers (incl. QA), Revenue, Operations.
const BASELINE: string[] = [
  "Lark",
  "Claude + Claude Code",
  "GitHub",
  "Vercel",
  "Supabase",
  "Perplexity",
  "AIOlabz",
];

type Bucket = { key: string; label: string; tools: string[] };
const BUCKETS: Bucket[] = [
  { key: "engineering", label: "Engineering (incl. QA)", tools: ["Llama Index"] },
  { key: "revenue", label: "Revenue", tools: ["HubSpot", "Ubersuggest", "Canva"] },
  { key: "operations", label: "Operations", tools: ["QuickBooks", "Thoughtflow", "Canva"] },
];

// Best-effort bucket from the hire's title/department. Conservative on purpose:
// it only highlights on a clear signal and otherwise returns null, so a fuzzy
// match never mislabels someone — every bucket is shown regardless.
export function bucketForRole(position: string | null, department: string | null): string | null {
  const s = `${position ?? ""} ${department ?? ""}`.toLowerCase();
  if (/\b(engineer|engineering|developer|qa|sdet|devops|ml|mobile|backend|frontend|full[- ]?stack)\b/.test(s))
    return "engineering";
  if (/\b(marketing|sales|revenue|growth|content|seo|social|video|brand|demand|bdr|sdr)\b/.test(s))
    return "revenue";
  if (/\b(ops|operations|finance|bookkeep|account(?:ing|ant)|admin|people|hr|design|consult|delivery|product manager|project manager)\b/.test(s))
    return "operations";
  return null;
}

function Chips({ tools }: { tools: string[] }) {
  return (
    <div className="ts-chips">
      {tools.map((t) => (
        <span key={t} className="ts-chip">
          {t}
        </span>
      ))}
    </div>
  );
}

type Props = {
  coreTeaching: PostMeta;
  recentPosts: PostMeta[];
  roleBucket: string | null;
};

export function StartHerePanel({ coreTeaching, recentPosts, roleBucket }: Props) {
  return (
    <section className="team-start" aria-label="Start here">
      <div className="team-start-head">
        <span className="team-start-badge" aria-hidden>
          ✦
        </span>
        <div>
          <h2 className="team-start-title">Start here</h2>
          <p className="team-start-sub">A few things to get into while you settle in.</p>
        </div>
      </div>

      {/* Required reading */}
      <Link
        href={`/post/${coreTeaching.slug}`}
        target="_blank"
        rel="noopener noreferrer"
        className="ts-featured"
      >
        <span className="ts-featured-media">
          <Image
            src={coreTeaching.image}
            alt={coreTeaching.title}
            width={224}
            height={126}
            className="ts-featured-img"
          />
        </span>
        <span className="ts-featured-body">
          <span className="ts-kicker">Required reading</span>
          <span className="ts-featured-heading">{coreTeaching.title}</span>
          <span className="ts-featured-excerpt">{coreTeaching.excerpt}</span>
          <span className="ts-more">Read the core teaching · {coreTeaching.readTime} →</span>
        </span>
      </Link>

      {/* Recent posts */}
      <div className="team-hub-heading">Fresh from the blog</div>
      <div className="ts-posts">
        {recentPosts.map((p) => (
          <Link
            key={p.slug}
            href={`/post/${p.slug}`}
            target="_blank"
            rel="noopener noreferrer"
            className="ts-post"
          >
            <Image src={p.image} alt={p.title} width={72} height={72} className="ts-post-thumb" />
            <span className="ts-post-body">
              <span className="ts-post-heading">{p.title}</span>
              <span className="ts-post-meta">
                {p.category} · {p.readTime}
              </span>
            </span>
          </Link>
        ))}
      </div>

      {/* Role-based tool kit */}
      <div className="team-hub-heading">Your tool kit</div>
      <div className="ts-tools">
        <div className="ts-tools-baseline">
          <span className="ts-cap">Everyone, from day one</span>
          <Chips tools={BASELINE} />
        </div>
        <div className="ts-tools-roles">
          {BUCKETS.map((b) => (
            <div key={b.key} className={"ts-role" + (roleBucket === b.key ? " mine" : "")}>
              <div className="ts-role-head">
                {b.label}
                {roleBucket === b.key && <span className="ts-yours">Your role</span>}
              </div>
              <Chips tools={b.tools} />
            </div>
          ))}
        </div>
        <p className="ts-note">
          Everyone learns GitHub, Vercel, and Supabase, not just engineers. Claude Code is for every
          role.
        </p>
      </div>

      {/* Certification */}
      <div className="ts-cta">
        <div className="ts-cta-body">
          <span className="ts-kicker light">Get certified</span>
          <span className="ts-cta-heading">
            Join AIOlabz and start your AI Officer certification
          </span>
          <ol className="ts-cta-steps">
            <li>
              Sign up at <b>aiolabz.com</b> using your <b>@edge8.ai</b> company email.
            </li>
            <li>
              Complete the <b>AI Officer Generative AI</b> certification during your probation.
            </li>
            <li>
              Then take <b>Agentic AI</b> by your third month.
            </li>
          </ol>
        </div>
        <div className="ts-cta-actions">
          <a className="ts-btn" href={CERT_URL} target="_blank" rel="noopener noreferrer">
            Start the certification →
          </a>
          <a
            className="ts-btn ghost"
            href={AIOLABZ_URL}
            target="_blank"
            rel="noopener noreferrer"
          >
            Join AIOlabz
          </a>
        </div>
      </div>
    </section>
  );
}
