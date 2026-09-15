#!/usr/bin/env python3
"""Copy Payroll IQ storage objects into the APA Company OS project.

    python3 scripts/db/copy-storage.py [--dry-run]

Objects do not move with a database dump - they are copied one at a time through
the Storage API, so this is separate from the schema and row migration.

Bucket NAMES are kept identical on both sides, which is why stored paths need no
rewriting: the database rows that reference them (blueprints.storage_path,
modules.poster_url, the archive columns) carry paths relative to the bucket.

Service keys are read from the Management API using the CLI's own access token,
so no key is ever written to disk or passed on a command line.
"""
import json, os, re, sys, time, urllib.request, urllib.error

SRC, DST = "vgwampgffykiuzsoyevn", "nubxrrzwcbhgpvvmbioh"
BUCKETS = ["blueprints", "e2-module-archives", "module-posters"]
DRY = "--dry-run" in sys.argv


def mgmt_token() -> str:
    for p in ("~/Edge8/payroll-training-au/.env.local", "~/Edge8/apa-company-os/.env.local"):
        p = os.path.expanduser(p)
        if os.path.exists(p):
            for line in open(p):
                m = re.match(r"\s*SUPABASE_ACCESS_TOKEN\s*=\s*\"?([^\"\s]+)", line)
                if m:
                    return m.group(1)
    raise SystemExit("no SUPABASE_ACCESS_TOKEN found")


def service_key(tok: str, ref: str) -> str:
    r = urllib.request.Request(f"https://api.supabase.com/v1/projects/{ref}/api-keys",
                               headers={"Authorization": "Bearer " + tok})
    for k in json.load(urllib.request.urlopen(r)):
        if k.get("name") == "service_role":
            return k["api_key"]
    raise SystemExit(f"no service_role key for {ref}")


def api(ref, key, path, method="GET", body=None, raw=False, content_type=None):
    data = body if isinstance(body, bytes) else (json.dumps(body).encode() if body else None)
    h = {"Authorization": "Bearer " + key, "apikey": key}
    if isinstance(body, bytes):
        # Every bucket here restricts allowed_mime_types, and urllib defaults an
        # unlabelled body to application/x-www-form-urlencoded - which every one
        # of them rejects with 415. The type must be carried from the source
        # object's metadata, not guessed from the extension.
        h["Content-Type"] = content_type or "application/octet-stream"
    elif body is not None:
        h["Content-Type"] = "application/json"
    url = f"https://{ref}.supabase.co/storage/v1{path}"
    # The gateway returns 504 on larger objects and occasionally on a listing.
    # Retry with backoff rather than losing a whole run to one slow transfer.
    last = None
    for attempt in range(5):
        try:
            req = urllib.request.Request(url, data=data, method=method, headers=h)
            resp = urllib.request.urlopen(req, timeout=180)
            return resp.read() if raw else json.loads(resp.read() or b"{}")
        except urllib.error.HTTPError as e:
            if e.code not in (429, 500, 502, 503, 504):
                raise
            last = e
        except (urllib.error.URLError, TimeoutError) as e:
            last = e
        time.sleep(2 ** attempt)
    raise last


def walk(ref, key, bucket, prefix=""):
    """Storage list is one level at a time; recurse so nested paths are included."""
    out = []
    offset = 0
    while True:
        page = api(ref, key, f"/object/list/{bucket}", "POST",
                   {"prefix": prefix, "limit": 100, "offset": offset})
        if not page:
            break
        for o in page:
            name = f"{prefix}{o['name']}"
            if o.get("id") is None:          # a folder
                out += walk(ref, key, bucket, name + "/")
            else:
                meta = o.get("metadata") or {}
                out.append((name, meta.get("size", 0), meta.get("mimetype")))
        if len(page) < 100:
            break
        offset += 100
    return out


def main() -> int:
    tok = mgmt_token()
    src_key, dst_key = service_key(tok, SRC), service_key(tok, DST)
    total = copied = skipped = failed = 0

    for bucket in BUCKETS:
        try:
            src_objs = walk(SRC, src_key, bucket)
        except Exception as e:
            print(f"\n{bucket}: LIST FAILED {e}", flush=True)
            failed += 1
            continue
        have = {n for n, _, _ in walk(DST, dst_key, bucket)}
        print(f"\n{bucket}: {len(src_objs)} source objects, {len(have)} already present")
        for name, size, mime in src_objs:
            total += 1
            if name in have:
                skipped += 1
                continue
            if DRY:
                print(f"  would copy {name} ({size} bytes)")
                continue
            try:
                blob = api(SRC, src_key, f"/object/{bucket}/{name}", raw=True)
                api(DST, dst_key, f"/object/{bucket}/{name}", "POST", blob,
                    content_type=mime)
                copied += 1
                if copied % 25 == 0:
                    print(f"  ... {copied} copied", flush=True)
            except Exception as e:
                failed += 1
                detail = e.read()[:120].decode(errors="replace") if hasattr(e, "read") else str(e)[:120]
                print(f"  FAIL {name}: {detail}", flush=True)

    print(f"\ntotal={total} copied={copied} already_present={skipped} failed={failed}")
    return 1 if failed else 0


if __name__ == "__main__":
    raise SystemExit(main())
