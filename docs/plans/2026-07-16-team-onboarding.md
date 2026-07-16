# Team Portal Onboarding — Plan & Walkthrough

Date: 2026-07-16
Owner: Dave
Scope: getting every Edge8 team member signed in and productive on the /team workspace (www.edge8.ai/team).

## Goal

Every active team member can sign in to the Edge8 Workspace, request time off, keep their profile current, find teammates, and submit AI workflow ideas — within their first 15 minutes. The home page also shows them where the workspace is going (handbook, insurance, 1-1s, pulse, feedback, announcements), so expectations are set on day one.

## How access works (30-second model)

- Sign-in is passwordless. Employees get a magic link by email — there is no password to create or forget.
- Accounts are minted only by an admin invite. The login form never creates users, so nobody can self-register.
- Identity is matched on the Supabase auth user id, never on email. Eligible employment statuses: `active`, `on_leave`, `notice`, `pre_start` (new hires can onboard before day one). Candidates, terminated, and alumni are denied.
- Auth email (invites, sign-in links) sends via Resend SMTP, so links arrive reliably and are not rate-capped.

## Phase 1 — Admin prep (before you invite anyone)

Do this once per person in **Admin → Talent → People → Team** (`/admin/talent/team`):

1. **Person record exists** with the correct work email. The email on file is where the invite lands — double-check it.
2. **Team member record** is linked to the person with:
   - status `active` (or `pre_start` for a new hire)
   - department and position title set (these show on their home page)
   - manager linked (drives the Manager card, and later 1-1s and approvals)
   - start date set
3. Spot-check the **Directory** view — whatever is wrong there is what the whole team will see.

## Phase 2 — Invite

1. Open the team member in `/admin/talent/team`.
2. Click **Invite to portal**. This mints (or links) their auth account and emails a magic-link invite. Nothing sends without this explicit click.
3. If the link expires before they use it: **Resend invite** from the same page.
4. Verify: the member's row shows portal access enabled, and the action is recorded in the audit log (`portal_invite`).

Recommended rollout: invite yourself first, then 1–2 friendly testers (e.g. Mai, Ginny), then the rest of the team in one batch with the announcement message below.

## Phase 3 — Employee walkthrough (share this, or run it live)

> **Welcome to the Edge8 Workspace** — your one place for time off, your profile, the team directory, and AI ideas.
>
> 1. **Check your email** for "You've been invited" from Edge8 and open the link on the device you'll normally use.
> 2. You land on your **Home** page: your next time off, department, and manager, plus every workspace tool — live ones are clickable, the rest are marked "Soon."
> 3. **My Profile** — first stop. Confirm your details and add your emergency contact.
> 4. **Time Off** — this is where you request leave from now on. Submit a request; your manager approves it in the same system.
> 5. **Directory** — everyone at Edge8, who they report to, and how to reach them.
> 6. **Ideas** — got a workflow AI should own? Submit it and get a product plan back in seconds. This is how we build the company OS — your ideas become features.
> 7. Next time, sign in at **www.edge8.ai/team/login** — enter your work email and click the link we send. No password, ever.

First-week checklist per employee:
- [ ] Signed in via invite link
- [ ] Profile confirmed + emergency contact added
- [ ] One time-off request submitted (even a placeholder they cancel — proves the flow)
- [ ] One idea submitted

## Phase 4 — What ships next (visible as "Soon" on their home page)

| Item | What it is | Depends on |
|---|---|---|
| Company Announcements | One feed for company news | Content source + simple posts table |
| HR Handbook | Policies and ways of working | Content written; render as portal pages |
| Health Insurance | Coverage summary + how to claim | Provider docs per country (VN/US) |
| 1-1 Schedule | Biweekly manager 1-1s, prepped and tracked | Manager rollout; pairs with 1-1 coach workflow |
| Pulse Survey | Quick recurring sentiment check | Reuse existing surveys tables (additive only) |
| Feedback | Give/request feedback any time | Design pass on visibility rules |
| Approvals / Team calendar / My reports | Manager tools in the sidebar | Time-off approvals wiring first |

Sequencing suggestion: Announcements → Approvals (managers) → HR Handbook → Pulse Survey → 1-1 Schedule → Health Insurance → Feedback. Announcements first because it gives everyone a reason to return weekly.

## Troubleshooting

- **"Link invalid or expired"** — links are single-use and time-limited. Resend from the login page (if already invited) or **Resend invite** from admin.
- **No invite email** — check the email on the person record, then spam folder. Auth email sends via Resend; check the Resend dashboard for delivery.
- **Signed in but bounced to login** — their team member status isn't portal-eligible (must be `active`, `on_leave`, `notice`, or `pre_start`).
- **Admin can't see "Team" in the switcher** — the admin also needs a linked, active team member record; the switcher shows "n/a" otherwise.
