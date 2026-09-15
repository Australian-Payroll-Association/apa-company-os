#!/usr/bin/env python3
"""Point Payroll IQ's Vercel production env at the APA Company OS project.

    python3 scripts/db/flip-payroll-iq-env.py            # dry run, changes nothing
    python3 scripts/db/flip-payroll-iq-env.py --apply    # writes, then redeploys

THE CUTOVER. Run it only when all three hold:
  1. PR #550 (payroll-iq) is MERGED. A redeploy builds `main`; if the env moves
     while main still has unbound clients, the app points at the new project and
     queries `public`, which is empty by design. A dead site, not a degraded one.
  2. The downtime email has gone out.
  3. The drift check reads zero - the copy is a point-in-time snapshot with no
     refresh, so any write to payroll-iq since it was taken is a row the new
     database does not have. The script re-checks this itself and refuses if the
     totals differ.

Keys are read from the Supabase Management API at run time and written straight
to Vercel; no secret is printed or stored. Reverting is this script with
OLD_PROJECT and NEW_PROJECT swapped - the source database is untouched.
"""
import json, os, re, subprocess, sys, urllib.error, urllib.request

NEW_PROJECT = "nubxrrzwcbhgpvvmbioh"
OLD_PROJECT = "vgwampgffykiuzsoyevn"
VERCEL_PROJECT_ID = "prj_rr9UC43sNdDZpSNjr5pfX8zpw6Yd"   # payroll-training-au
VERCEL_TEAM_SLUG = "infiniteleverage-2"
APPLY = "--apply" in sys.argv


def env_value(key: str) -> str:
    for path in ("~/Edge8/payroll-training-au/.env.local", "~/Edge8/apa-company-os/.env.local"):
        path = os.path.expanduser(path)
        if not os.path.exists(path):
            continue
        for line in open(path):
            m = re.match(rf"\s*{key}\s*=\s*\"?([^\"\s]+)", line)
            if m:
                return m.group(1)
    raise SystemExit(f"{key} not found in any .env.local")


def sb(path, tok):
    r = urllib.request.Request("https://api.supabase.com" + path,
                               headers={"Authorization": "Bearer " + tok})
    return json.load(urllib.request.urlopen(r))


def vc(path, tok, method="GET", body=None):
    data = json.dumps(body).encode() if body else None
    h = {"Authorization": "Bearer " + tok}
    if body:
        h["Content-Type"] = "application/json"
    r = urllib.request.Request("https://api.vercel.com" + path, data=data, method=method, headers=h)
    return json.load(urllib.request.urlopen(r))


def drift_ok(sb_tok) -> bool:
    """Both databases must hold the same number of rows. A snapshot that has
    fallen behind loses whatever was written since, silently and permanently."""
    q = ("select sum(cnt) as t from (select (xpath('/row/c/text()', query_to_xml("
         "format('select count(*) c from %s.%%I',table_name),false,true,'')))[1]::text::int cnt "
         "from information_schema.tables where table_schema='%s' and table_type='BASE TABLE') x;")
    out = {}
    for label, ref, schema in (("target", NEW_PROJECT, "payroll_iq"), ("source", OLD_PROJECT, "public")):
        r = urllib.request.Request(
            f"https://api.supabase.com/v1/projects/{ref}/database/query",
            data=json.dumps({"query": q % (schema, schema)}).encode(), method="POST",
            headers={"Authorization": "Bearer " + sb_tok, "Content-Type": "application/json"})
        out[label] = json.load(urllib.request.urlopen(r))[0]["t"]
    print(f"  drift check: source={out['source']} target={out['target']}")
    return out["source"] == out["target"]


def main() -> int:
    sb_tok = env_value("SUPABASE_ACCESS_TOKEN")
    vc_tok = json.load(open(os.path.expanduser(
        "~/Library/Application Support/com.vercel.cli/auth.json")))["token"]
    team = [t for t in vc("/v2/teams?limit=100", vc_tok)["teams"]
            if (t.get("slug") or "") == VERCEL_TEAM_SLUG][0]["id"]

    if not drift_ok(sb_tok):
        print("REFUSING: the source has been written to since the copy.\n"
              "Re-run the data migration before flipping, or rows will be lost.")
        return 1

    keys = {k["name"]: k["api_key"] for k in
            sb(f"/v1/projects/{NEW_PROJECT}/api-keys", sb_tok)}
    wanted = {
        "NEXT_PUBLIC_SUPABASE_URL": f"https://{NEW_PROJECT}.supabase.co",
        "NEXT_PUBLIC_SUPABASE_ANON_KEY": keys["anon"],
        "SUPABASE_SERVICE_ROLE_KEY": keys["service_role"],
    }

    envs = vc(f"/v10/projects/{VERCEL_PROJECT_ID}/env?teamId={team}", vc_tok)["envs"]
    for key, value in wanted.items():
        # The API returns the scope as `target` (list) on this version and
        # `targets` on others; read both rather than depend on either.
        def scopes(e):
            t = e.get("targets") or e.get("target") or []
            return [t] if isinstance(t, str) else t
        rows = [e for e in envs if e["key"] == key and "production" in scopes(e)]
        if not rows:
            print(f"  {key}: no production entry — SKIPPED")
            continue
        env_id = rows[0]["id"]
        shown = value if key.endswith("URL") else f"<{len(value)} chars>"
        if not APPLY:
            print(f"  would set {key} -> {shown}")
            continue
        vc(f"/v10/projects/{VERCEL_PROJECT_ID}/env/{env_id}?teamId={team}",
           vc_tok, "PATCH", {"value": value})
        print(f"  set {key} -> {shown}")

    if not APPLY:
        print("\nDry run. Re-run with --apply to write and redeploy.")
        return 0

    print("\nRedeploying production so the new env is picked up...")
    subprocess.run(["vercel", "redeploy", "--scope", VERCEL_TEAM_SLUG,
                    "payroll-training-au", "--yes"], check=False)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
