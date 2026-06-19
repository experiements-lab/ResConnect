# ResConnect — Onboarding Guide

ResConnect connects Stellenbosch University students with off-campus housing
landlords. There are three roles: **Student**, **Landlord**, and **Admin**.
This guide walks through what's actually built, in the order a new user
would experience it: Student journey → Landlord journey → Admin.

## Auth, in one paragraph

Real authentication is **Supabase Auth** (email/password). On signup/login,
the role (`student` or `landlord`) and basic profile fields are stored in
the Supabase JWT's `user_metadata` — there's no separate `role` column in
our own database. The backend verifies every request's JWT against
Supabase's JWKS endpoint (`backend/app/core/auth.py`). Note: there's a
`kratos.py` file in the codebase referencing Ory Kratos — that's dead code
left over from an earlier design, not the real auth path. Ignore it.

Admin access is **not** a real user account — it's a single shared secret
key (`SECRET_KEY` env var) entered once and stored in the browser session.
There's no admin role in Supabase, no admin route guard in the router; the
`/admin` page itself prompts for the key and the backend checks an
`X-Admin-Key` header on every admin endpoint.

---

## 1. Student Journey

**Signup** (`/auth/register`)
- Must use a `@sun.ac.za` email — enforced both client- and server-side.
- After Supabase account creation, the profile (name, student number,
  faculty, year of study, NSFAS eligibility) is synced to our backend.
- Student then uploads a registration document (proof of enrollment) from
  their dashboard.

**Verification gate**
- A student can **browse freely** before verification, but cannot send an
  enquiry or chat with a landlord until an admin verifies their uploaded
  document. This is enforced server-side (not just a disabled button) —
  the enquiry-creation endpoint rejects unverified students outright.

**What a student can do**
| Action | Where |
|---|---|
| Browse/filter listings (price, room type, distance to campus, NSFAS, SU-accredited, amenities) | `/listings` |
| View a property + room details | `/listings/:id` |
| Send an enquiry on a room (once verified) | `/listings/:id` |
| Track enquiries, chat with landlord per enquiry, view profile/doc status | `/student/dashboard` |

**Notifications a student receives**
- Account verified / rejected
- Enquiry accepted / declined / cancelled by landlord
- Viewing arranged
- New chat message from landlord

---

## 2. Landlord Journey

**Signup** (`/auth/register`)
- No email domain restriction.
- Profile synced to backend after Supabase signup (name, phone).
- Landlord can immediately start creating property listings — **no
  verification needed to start listing**.

**Verification gate (different from students!)**
- Verification doesn't block *creating* listings, it blocks **public
  visibility**. An unverified landlord's properties simply won't appear in
  the student-facing `/listings` feed until an admin verifies the landlord
  (optionally with an ownership document and/or SU-accreditation flag).

**What a landlord can do**
| Action | Where |
|---|---|
| Create/edit a property (address, description, location) | `/landlord/property/new` + dashboard |
| Add rooms to a property (type, price, NSFAS-accepted, availability count) | dashboard |
| Upload property photos | dashboard |
| Manage incoming enquiries — accept, decline, arrange a viewing, cancel | `/landlord/dashboard` |
| Chat with the enquiring student per enquiry thread | `/landlord/dashboard` |

**Notifications a landlord receives**
- New enquiry received
- New chat message from student
- Account verified / rejected (their own verification status)

---

## 3. Admin

**Access**: `/admin`, gated by the shared secret key (see Auth section
above). There is no per-admin identity — every action is logged as a
generic `"admin"` actor.

**What's in the panel today**
| Tab | What it does |
|---|---|
| **Stats** | Counts: students/landlords by verification status, total properties (+ active), total rooms (+ available), total enquiries |
| **Students** | List, search by name/email/student number, filter by status, paginated; view uploaded document; verify or reject (with a reason shown to the student) |
| **Landlords** | Same as Students, for landlord accounts |
| **Audit Log** | Every verify/reject action — actor, action, who it was done to, reason (for rejections), timestamp; paginated |

Verifying/rejecting a student or landlord immediately fires a notification
to that user (see notification lists above).

**Not in the admin panel** (known gaps, in case it comes up):
- No moderation of property listings themselves (can't deactivate/edit a
  landlord's listing from admin).
- `scam_reports` exists as a DB table but has no model or admin UI — scam
  reports currently go nowhere visible.

---

## Cross-cutting notes

- **Notifications** are in-app only — a bell icon in the navbar, polled
  every 10 seconds. No email or push notifications exist yet.
- **Chat** only exists inline within an enquiry thread — there's no
  standalone messages/inbox page.
- **No notification preferences/settings page** — notifications can't be
  muted or configured per type.

## Demo tip for today

For a landlord-facing demo: show the listing creation flow
(`/landlord/property/new` → add a room → upload photos), then an incoming
enquiry on `/landlord/dashboard` with accept/decline/arrange-viewing, and
the chat thread. If you want to show the full loop, have a verified
student account ready to send that enquiry from `/listings/:id` first.
