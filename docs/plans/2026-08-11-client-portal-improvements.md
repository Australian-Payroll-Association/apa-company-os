# Client Portal Improvements: Documents, Roles, Client-Managed Users, Simple AI Propose

Date: 2026-08-11
Source: Sean's (Bstore Pty Ltd) feedback on the roadmap sync call, plus Dave's review.
Verified against origin/main and the live company_os database on 2026-08-11.

## What we found (context for every PR below)

- The 8 documents uploaded on 2026-08-10 are safe: files in the private `program-documents`
  storage bucket, rows in `company_os.program_documents`, all correctly scoped to Bstore.
  The only screen in the product that shows them is the client portal at
  Programs → Initial Roadmap Development → Documents. No admin or team surface exists.
- The roadmap page already lets clients propose items (title, note, priority, per group),
  and the admin roadmap editor already has a review panel with an accept button.
- `company_os.portal_members` already supports many users per company and carries a `role`
  column that no code reads today. Every portal member currently has full power.
- A working invite engine exists (`lib/admin/portal-invite.ts`): creates the auth user,
  links `people.auth_user_id`, sends a scanner-proof Resend email. Admin-only today.

Ship order matters: PR 2 (roles) must land before PR 3 (client-managed users), because
invites become a client-facing power and only client admins may hold it.

---

## PR 1: `claude/portal-documents-surfaces` (same day)

**What it does.** Documents now belong to the client company, with tagging to an
AI Program optional (Dave's call, 2026-08-11). `company_os.program_documents` gains a
required company link, its program link becomes optional, and the 8 existing Bstore
rows keep their program tag. Deleting a program no longer deletes its documents; they
just lose the tag. All three surfaces read the same rows. Every list shows: document
title, uploaded date, uploaded by, and a Download button (5-minute signed URL,
existing pattern).

Delete rule (Dave's call, 2026-08-11): on the client portal, you can delete only what
you yourself uploaded. Edge8 admin can delete anything. Team is read-only.

- **Client portal**: new "Documents" item in the sidebar → `/portal/documents`, listing
  every company document (program tag shown as a label when present), with upload
  directly on the page (company-level, no program required). Delete on own uploads
  only. The existing program-detail Documents section stays: its uploads keep tagging
  the program, and it gains the same delete-own button.
- **Admin**: a Documents panel on the company detail page
  (Revenue → Companies → [company]), with upload (optional program dropdown) and
  delete on any document. Admin uploads record the admin's email as uploaded by, so
  we never need Assume mode to add files.
- **Team portal**: a read-only Documents panel on the existing client page
  (`/team/clients/[companyId]`), scoped exactly like the roadmap there: only companies
  the team member holds an active `staff_assignments` row for. No delete, no upload.

"Uploaded by" shows the person's name when the email resolves to a `company_os.people`
row, otherwise the email itself.

**What you'll see.** The 8 Bstore files visible in admin without Assume; Sean sees a
Documents nav item on login; assigned Edge8 staff see the same files on the Bstore
client page in the team portal.

**Done when.** All three surfaces list the 8 existing Bstore documents with correct
title, date, and uploader; download works on each; delete works on client and admin and
actually removes the file from storage; team portal has no delete or upload controls.

---

## PR 2: `claude/portal-member-roles` (next)

**What it does.** Gives `company_os.portal_members.role` three enforced values and
migrates existing data. All enforcement is server-side in the portal actions and data
helpers, with the sidebar and buttons hidden to match.

Roles:
- **admin**: everything. Invoices and billing, user management (PR 3), roadmap
  reordering and priorities, request approval, document upload and delete.
- **contributor**: the "add-to-roadmap" tier. Sees the roadmap and may propose items
  and upload documents, but cannot reorder, cannot set priorities, cannot delete
  documents, no Invoices, no user management.
- **viewer**: read-only everywhere. No writes of any kind.

Migration (in `supabase/migrations/`, applied through CI as usual): existing client
rows with role `member` become `admin` (Sean and every current primary contact keep
full power). Affiliate rows (`role = 'affiliate'`, no company) are untouched and keep
working exactly as today.

Enforcement map, named explicitly so QA can walk it:
- Roadmap (`/portal/roadmap`): reorder, set priority, and edit notes become admin-only.
  Propose stays open to admin and contributor. Viewer gets a read-only page.
- Invoices (`/portal/invoices` and the sidebar item): admin-only, on top of the
  existing "has invoices" entitlement.
- Documents (PR 1 surfaces): upload admin and contributor; delete stays uploader-only
  (your own uploads), viewer read-only.
- Requests: creating requests admin and contributor; approving or declining an
  estimate (the DecisionPanel) admin-only.
- Programs (`/portal/programs/add`, both paths): admin and contributor.
- The role rides on `PortalActor` per membership, so a person who is admin at one
  company and viewer at another gets the right powers at each.

Admin side: the Portal tab on the company detail page gets a role picker per member,
so Dave can set roles from admin at any time.

**What you'll see.** A contributor test account that can propose a roadmap item but
physically cannot drag-reorder, has no priority pills, and has no Invoices nav item.

**Done when.** Three test accounts (one per role) each see exactly the powers in the
map above, verified against the live Bstore roadmap; existing single-user clients
notice no change at all.

---

## PR 3: `claude/portal-client-user-management` (next day)

**What it does.** Lets a client admin manage their own company's users. New "Users"
page in the portal sidebar, visible to role admin only.

- Lists the company's portal members: name, email, role, status
  (invited / active / revoked), using the existing status derivation.
- **Invite**: name + email + role picker (admin, contributor, viewer). Creates the
  `company_os.people` row and `person_companies` link when the person is new, then
  runs the same invite engine the admin UI uses (auth user via invite link, branded
  Resend email to `/portal/verify`). Guards: a client admin can only ever invite into
  their own company, never an email that belongs to an Edge8 admin or an active team
  member (same refusals the engine already enforces), and every invite is audit-logged
  with who invited whom.
- **Revoke** and **change role**: same page, admin-only, audit-logged. Revoking a
  person's last active membership bans the auth user, matching the existing admin
  revoke behavior.

**What you'll see.** Sean invites his financial controller as admin and a team member
as contributor; both get the email, sign in, and land with the right powers, with no
Edge8 involvement.

**Done when.** The full invite → email → first sign-in → correct role loop works for a
fresh email address; a contributor cannot see the Users page at all; revoke locks the
account out.

---

## PR 4: `claude/roadmap-propose-ai-assist` (1 to 2 days)

**What it does.** A light AI assist inside the existing propose-an-item form on the
roadmap page. Deliberately not the full 5Ds program-plan chat.

- Next to the manual fields, a "Help me write this" option opens a compact exchange:
  two or three short questions (what's the problem, who deals with it, what does today
  look like). The answers draft the item: title, note, suggested group and priority,
  filled into the same form fields for the client to edit and then "Send to Edge8" as
  a normal proposal. Nothing is submitted by the AI itself.
- Same server pattern as the existing portal plan chat (streaming route gated by the
  portal actor, model from the `CHATBOT_MODEL` env var), with a new small prompt.
  No new tables; proposals land exactly as they do today
  (`client_backlog_items`, source client, status proposed).
- No admin work needed: the roadmap editor's proposed-items review panel and accept
  button already exist.

**What you'll see.** Sean types "our returns process is chaos", answers two questions,
and gets a well-formed roadmap item pre-filled for review; it arrives in Dave's admin
review panel like any other client proposal.

**Done when.** A proposal drafted through the assist is indistinguishable in the
database from a hand-typed one, respects PR 2 roles (admin and contributor only), and
the manual form still works unchanged without touching the AI.

---

## Standing rules for all four PRs

- Worktree off `origin/main`, stage files by name, PR, merge on green CI, then verify
  with `curl` against `https://www.edge8.ai/...` and post the live URL.
- Every write goes through the existing actor-scoped helpers (`portalRead`,
  `assertInScope`, `ownedProgram` patterns); no new query may trust a client-supplied
  company or item id.
- New env vars (none expected) would go into `.env.local` in the same commit.
