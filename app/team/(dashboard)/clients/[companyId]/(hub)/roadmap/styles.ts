// The .tcr scoped styles for the team roadmap rendering (group heads, item
// cards, priority pills), shared by the company-wide Roadmap tab and the AI
// Program view's Roadmap tab so both render identically.

export const ROADMAP_STYLES = `
.tcr { --pri-now:#465778; --pri-next:#0b8f63; --pri-later:#4a505a; --pri-park:#b06508; max-width: 880px; }
.tcr .tcr-group { margin-bottom: 22px; }
.tcr .tcr-group-head { display:flex; align-items:center; gap:10px; flex-wrap:wrap; margin:0 0 4px; }
.tcr .tcr-step { font-size:11px; font-weight:700; text-transform:uppercase; letter-spacing:.04em; padding:3px 9px; border-radius:99px; background:rgba(70,87,120,.1); color:#465778; }
.tcr .tcr-group-title { font-weight:700; font-size:15px; }
.tcr .tcr-group-intro { color:#797c82; font-size:13px; margin:2px 0 12px; }
.tcr .tcr-item { border:1px solid var(--admin-border,#E6E6E6); border-radius:12px; padding:13px 15px; margin-bottom:9px; background:#fff; }
.tcr .tcr-item-top { display:flex; gap:9px; align-items:flex-start; flex-wrap:wrap; }
.tcr .tcr-ref { flex:none; font-size:12px; font-weight:700; color:#465778; background:rgba(70,87,120,.1); border-radius:6px; padding:3px 7px; }
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
.tcr .tcr-chip.tok { color:#465778; border-color:rgba(70,87,120,.15); background:rgba(70,87,120,.08); }
.tcr .tcr-chip.client { color:#0b8f63; border-color:rgba(11,143,99,.25); background:rgba(11,143,99,.1); }
`;
