# WellMed — Suggested Timeline & Phases

A pragmatic delivery plan for getting from current state (front-end complete, backend specced) to live.

## Phase 0 — Done ✅

What's already built in this repo:

- Full design system + 12-page front-end
  - Home, About, 6 service pages, Art of Living, Reviews, Contact
  - Multi-step Book Appointment flow with intake & medical aid
  - Admin dashboard with mock data and live filtering
- Shared nav/footer/floating-CTA components, mobile-friendly
- Hero carousel, scroll reveals, marquee, soft animations throughout
- Responsive, accessible, framework-free
- Architecture & API docs (this `docs/` directory)

## Phase 1 — Pre-launch polish (Week 1)

Goal: site looks production-ready with real content.

- [ ] Replace placeholder doctor SVG with **3–5 professional photos** of Dr Moodley (~30 min photoshoot ideal).
- [ ] Replace gallery placeholders with interior photos of practice + studio.
- [ ] Final copy review with Dr Moodley — pass over every page.
- [ ] Update phone, address, email, hours in `js/config.js` with the real values.
- [ ] Generate `sitemap.xml` and `robots.txt`.
- [ ] Add canonical URLs to every page.
- [ ] Drop GA4 + Search Console verification snippets.
- [ ] Run Lighthouse → fix anything below 95.

**Deliverable:** the static site, ready to host on S3.

## Phase 2 — Backend MVP (Weeks 2–3)

Goal: real bookings flow into a real database and real Google Calendar.

- [ ] Implement endpoints per `BACKEND_API_CONTRACT.md`:
  - `GET /availability`
  - `POST /bookings`
  - `POST /contact`
- [ ] Postgres schema per `DATABASE_SCHEMA.md`, with field-level encryption.
- [ ] Google Calendar service-account integration per `BOOKING_ARCHITECTURE.md`.
- [ ] Transactional emails (confirmation + reminder) via Postmark/SES.
- [ ] CloudFormation / Terraform for one-shot provisioning.
- [ ] Staging environment + smoke tests.

**Deliverable:** patients can book; Dr Moodley sees the event in her Google Calendar; patient receives an invite + email.

## Phase 3 — Admin & operations (Week 4)

Goal: Dr Moodley can run the practice from the dashboard.

- [ ] Auth (JWT + MFA) for `/admin`.
- [ ] Admin endpoints per contract: list, view, reschedule, status update, stats.
- [ ] Wire `pages/admin/dashboard.html` to real endpoints (currently uses mock data).
- [ ] Reschedule modal + cancel flow → updates Google Calendar + emails patient.
- [ ] CSV export.
- [ ] Operational runbook (`docs/RUNBOOK.md`).

**Deliverable:** practice operations migrate to the dashboard.

## Phase 4 — Launch (Week 5)

- [ ] Final POPIA review with Information Officer (privacy notice published).
- [ ] HSTS preload submission.
- [ ] Set up Google Business Profile and link to site.
- [ ] Soft launch to existing patients (email announcement + booking link).
- [ ] Public launch + targeted local SEO push.

## Phase 5 — Post-launch (Months 2–3)

Things to iterate once the v1 is live and we have real signal:

- Patient self-service reschedule/cancel via signed link in confirmation email.
- Blog (`/blog/`) — see `SEO.md` for content plan.
- Per-service `MedicalProcedure` JSON-LD.
- Review-request automation (1-tap Google review email 24h after appointment).
- Analytics dashboard improvements (cohort retention, lifetime value, channel attribution).
- Soft service worker for offline-tolerant marketing pages (NOT booking).

## Phase 6 — Future (only when signal warrants)

Explicitly **not** v1 (per brief):
- Medical aid live eligibility / switching integration.
- Payment gateway.
- Patient portal with records access.
- Multi-practitioner support.

## Risk register (top 3)

1. **Google Calendar quota / rate-limits** — mitigated by service account + retries; still: monitor.
2. **POPIA non-compliance** — mitigated by `SECURITY.md` posture; still: external review before launch.
3. **No-show rate too high** — mitigated by reminder email + (v2) reschedule link; track from day one.
