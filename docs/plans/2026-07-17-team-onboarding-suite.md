# Team Onboarding Suite — Development Plan

Date: 2026-07-17
Branch: `feat/team-onboarding-suite`
Context: the data foundation (people_sensitive, probation fields, Airtable import) shipped in PR #268 + DB import. This plan builds the features on top so the team can be onboarded.

## 1. Profile photos (avatar upload)
- `lib/avatars.ts` — `setPersonAvatar(personId, file)`: validate (jpg/png/webp ≤5 MB) → upload to the public `avatars` bucket → set `people.avatar_url` → best-effort delete of the person's old photos. Authorization is the caller's job.
- `components/team/AvatarUpload.tsx` (client) — current photo or initials, file picker, uploads via a server action passed in. Reused by team + admin.
- Team: `saveOwnAvatar` action → `requireTeamMember()` → `setPersonAvatar(actor.personId, …)`.
- Admin: `adminSetPersonAvatar(personId, …)` → `requireAdmin()` → `setPersonAvatar` + `recordAudit`.

## 2. Profile page redesign (`/team/profile`)
- Extend `getOwnProfile` to return `avatar_url` + metadata (hometown, education, hobbies, personal_email, birthday).
- New layout: avatar header + upload; equal-height, top-aligned cards. **Hide employee #.** Add an "About" card (hometown, education, hobbies chips, birthday). Contact form keeps preferred name / phone / emergency contact.

## 3. Admin restricted-PII section (`/admin/talent/team/[id]`)
- `lib/admin/people-sensitive.ts` — `getPeopleSensitive` / `upsertPeopleSensitive` (audited).
- `components/admin/SensitiveDetails.tsx` — reveal-to-view + edit form.
- `saveSensitiveDetails(personId, formData)` → `requireAdmin()` → upsert + `recordAudit`. Never exposed to /team.

## 4. Onboarding walkthrough
- `components/team/OnboardingWalkthrough.tsx` — a one-time guided overlay shown on `/team` when `people.metadata.onboarding_completed_at` is null: Welcome → Add your photo → Confirm your details → How time off works → Meet the team → Share an idea.
- `completeOnboarding()` action stamps `metadata.onboarding_completed_at`. A "Replay tour" link re-opens it.

## 5. Probation-review workflow
- `/admin/talent/probation` — list of probationers with `probation_ends_on` + days remaining; ≤14 days flagged "Review due". Nav entry under Talent.
- `app/api/cron/probation-reviews/route.ts` — daily; when `probation_ends_on = today + 14`, email the manager + founder and ping ops. Fires once per person (exact-day match = no dedupe state needed).
- Register cron in `vercel.json` (`0 7 * * *`).

## 6. Data: avatars + ID-card images
- Test whether the Airtable CDN links still resolve; re-host selfies → `avatars` bucket, ID images → private `id-documents` bucket. Google-Drive links flagged for manual upload.

## Verification
Per repo rule: no dev server. Each feature verified with `tsc --noEmit` + `next build`. Shipped as one PR with per-feature commits.
