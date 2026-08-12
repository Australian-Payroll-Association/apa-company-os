import Link from "next/link";
import { notFound } from "next/navigation";
import { requireTeamMember } from "@/lib/team-auth";
import { getClientRoadmapForActor, getClientDocumentsForActor } from "@/lib/team/clients";
import { ClientDocumentsList } from "./ClientDocumentsList";
import { PageHead } from "@/components/admin/PageHead";
import { BotText } from "@/components/assistant/BotText";
import {
  BACKLOG_GROUPS,
  GROUP_META,
  PRIORITY_LABEL,
  effectivePriority,
  tokenLabel,
  type BacklogItem,
  type BacklogPriority,
} from "@/lib/client-backlog";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Client Roadmap",
};

const STYLES = `
.tcr { --pri-now:#287BE8; --pri-next:#0b8f63; --pri-later:#4a505a; --pri-park:#b06508; max-width: 940px; }
.tcr .tcr-group { margin-bottom: 22px; }
.tcr .tcr-group-head { display:flex; align-items:center; gap:10px; flex-wrap:wrap; margin:0 0 4px; }
.tcr .tcr-step { font-size:11px; font-weight:700; text-transform:uppercase; letter-spacing:.04em; padding:3px 9px; border-radius:99px; background:rgba(40,123,232,.1); color:#287BE8; }
.tcr .tcr-group-title { font-weight:700; font-size:15px; }
.tcr .tcr-group-intro { color:#797c82; font-size:13px; margin:2px 0 12px; }
.tcr .tcr-item { border:1px solid var(--admin-border,#E6E6E6); border-radius:12px; padding:13px 15px; margin-bottom:9px; background:#fff; }
.tcr .tcr-item-top { display:flex; gap:9px; align-items:flex-start; flex-wrap:wrap; }
.tcr .tcr-ref { flex:none; font-size:12px; font-weight:700; color:#287BE8; background:rgba(40,123,232,.1); border-radius:6px; padding:3px 7px; }
.tcr .tcr-title { font-weight:650; font-size:14px; flex:1 1 220px; }
.tcr .tcr-pri { flex:none; font-size:12px; font-weight:700; padding:4px 11px; border-radius:99px; }
.tcr .tcr-pri.now { background:var(--pri-now); color:#fff; }
.tcr .tcr-pri.next { background:rgba(11,143,99,.15); color:var(--pri-next); }
.tcr .tcr-pri.later { background:#f2f4f7; color:var(--pri-later); }
.tcr .tcr-pri.park { background:#fff4e5; color:var(--pri-park); }
.tcr .tcr-body { font-size:13px; margin-top:8px; color:#333; }
.tcr .tcr-body .k { color:#797c82; font-weight:600; }
.tcr .tcr-chips { display:flex; gap:6px; flex-wrap:wrap; margin-top:8px; align-items:center; }
.tcr .tcr-chip { font-size:11px; font-weight:600; color:#797c82; border:1px solid #EAEEF2; border-radius:99px; padding:2px 9px; }
.tcr .tcr-chip.tok { color:#287BE8; border-color:rgba(40,123,232,.15); background:rgba(40,123,232,.08); }
.tcr .tcr-chip.client { color:#0b8f63; border-color:rgba(11,143,99,.25); background:rgba(11,143,99,.1); }
`;

function priClass(p: BacklogPriority): string {
  return p;
}

export default async function TeamClientRoadmapPage({ params }: { params: { companyId: string } }) {
  const actor = await requireTeamMember();
  const [roadmap, documents] = await Promise.all([
    getClientRoadmapForActor(actor, params.companyId),
    getClientDocumentsForActor(actor, params.companyId),
  ]);
  if (!roadmap) notFound();

  const { company, overview, items } = roadmap;

  function renderItem(it: BacklogItem) {
    const eff = effectivePriority(it);
    const tok = tokenLabel(it.token_low, it.token_high);
    return (
      <div key={it.id} className="tcr-item">
        <div className="tcr-item-top">
          {it.ref && <span className="tcr-ref">{it.ref}</span>}
          <span className="tcr-title">{it.title}</span>
          <span className={`tcr-pri ${priClass(eff)}`}>{PRIORITY_LABEL[eff]}</span>
        </div>
        <div className="tcr-body">
          {it.who && <div><span className="k">Who: </span>{it.who}</div>}
          {it.today_state && <div><span className="k">Today: </span>{it.today_state}</div>}
          {it.build_desc && <div><span className="k">What we&apos;d build: </span>{it.build_desc}</div>}
          <div className="tcr-chips">
            {(it.needs ?? []).map((n) => <span key={n} className="tcr-chip">{n}</span>)}
            {tok && <span className="tcr-chip tok">est. {tok} Human Tokens</span>}
            {it.source === "client" && <span className="tcr-chip client">client proposed</span>}
            {it.client_priority && it.client_priority !== it.edge8_priority && (
              <span className="tcr-chip client">client set: {PRIORITY_LABEL[it.client_priority]}</span>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="tcr">
      <style dangerouslySetInnerHTML={{ __html: STYLES }} />
      <PageHead
        eyebrow={<Link href="/team/clients">← My Clients</Link>}
        title={`${company.name} · Roadmap`}
        sub={`${items.length} item${items.length === 1 ? "" : "s"}${company.roleTitle ? ` · you: ${company.roleTitle}` : ""}`}
      />

      {overview && (
        <section className="admin-card admin-section-card" style={{ marginBottom: 18 }}>
          <h2 className="admin-card-title" style={{ marginBottom: 8 }}>Overview</h2>
          <div style={{ fontSize: 14, lineHeight: 1.65 }}>
            <BotText text={overview} />
          </div>
        </section>
      )}

      {items.length === 0 ? (
        <div className="admin-card admin-section-card" style={{ padding: 22 }}>
          <p className="admin-page-sub" style={{ margin: 0 }}>No roadmap items yet for this client.</p>
        </div>
      ) : (
        BACKLOG_GROUPS.map((g) => {
          const groupItems = items.filter((i) => i.group_key === g);
          if (groupItems.length === 0) return null;
          const meta = GROUP_META[g];
          return (
            <div key={g} className="tcr-group">
              <div className="tcr-group-head">
                <span className="tcr-step">{meta.step}</span>
                <span className="tcr-group-title">{meta.title}</span>
              </div>
              <div className="tcr-group-intro">{meta.intro}</div>
              {groupItems.map(renderItem)}
            </div>
          );
        })
      )}

      {(documents ?? []).length > 0 && (
        <section className="admin-card admin-section-card" style={{ marginTop: 18 }}>
          <h2 className="admin-card-title" style={{ marginBottom: 10 }}>Documents</h2>
          <ClientDocumentsList documents={documents ?? []} />
        </section>
      )}
    </div>
  );
}
