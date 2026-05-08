# WellMed — Security & POPIA Considerations

WellMed handles **special personal information** under POPIA (health data) and operates under HPCSA confidentiality obligations. This is the security posture for v1.

## 1. Data classification

| Class | Examples | Handling |
|-------|----------|----------|
| Public | Marketing copy, service descriptions | OK to cache/CDN |
| Internal | Booking IDs, slot times | OK to log (without patient identifier) |
| Confidential | Patient name, email, phone, ID number | TLS only, encrypted at rest, access-logged |
| Sensitive (special) | Medical history, conditions, allergies, medication, medical-aid number | Field-level encryption, audit-logged, role-restricted |

## 2. Front-end (this repo)

- **No patient data is persisted client-side** beyond the in-memory booking state and the local `localStorage` *queue* used as a network-failure fallback. The queue is a temporary buffer only and should be cleared after successful submission. *(TODO: implement clear-on-success in `js/booking.js` once the backend is live.)*
- All forms `POST` to HTTPS only. CSP forbids inline event handlers (using `'unsafe-inline'` only for styles is a v1 trade-off; will tighten to nonces in v1.5).
- Service worker / offline cache deliberately **not** implemented for v1, to avoid stale form caching.
- `<meta name="robots" content="noindex">` on `/admin/*`.

## 3. Transport

- HTTPS everywhere, HSTS with preload.
- TLS 1.2+ only (TLS 1.3 preferred). Modern cipher suites.
- HTTP redirected at CloudFront edge.

## 4. Authentication & authorization

- Patient endpoints (`/api/availability`, `/api/bookings`, `/api/contact`): unauthenticated, **rate-limited** and **bot-protected** (reCAPTCHA v3 + honeypot).
- Admin endpoints (`/api/admin/*`): JWT bearer token, 15-min access + 7-day refresh. **MFA mandatory** for the doctor/admin role (TOTP).
- Roles: `doctor`, `admin`, `reception`. Reception cannot view full intake; only patient name, slot, status.
- Session inactivity timeout: 20 minutes for admin dashboard.

## 5. Storage

- RDS encrypted with KMS-managed key.
- Field-level encryption (envelope, KMS data key) on:
  - `patients.id_or_passport`
  - `patients.email` (deterministic for unique lookup)
  - `medical_aid.member_number`
  - `intake.existing_conditions`, `intake.allergies`, `intake.current_meds`, `intake.notes`
- S3 buckets (front-end + uploads): SSE-S3 minimum, SSE-KMS for any future patient uploads.
- DB backups encrypted; access logged.

## 6. Logging & audit

- Application logs **must redact**: email, phone, ID, medical-aid number, free-text intake.
- Every admin read of patient data writes an `audit_log` row (actor, action, target, timestamp, IP, diff).
- CloudTrail on the AWS account; logs to a separate immutable bucket.

## 7. POPIA-specific obligations

- **Lawful basis**: written consent (the consent + POPIA checkboxes in the booking flow). Stored with timestamp on `patients.popia_consent_at`.
- **Purpose limitation**: data may be used only for clinical care, appointment management, and patient communication. Marketing requires the separate `marketing_opt_in` checkbox.
- **Right to access / correction / deletion**: a documented manual process for v1 (email `info@wellmed.co.za`); a self-service portal is v2.
- **Information Officer**: must be registered with the Information Regulator (the practice owner / Dr Moodley by default).
- **Data subject participation**: patients are informed at booking, in the privacy notice, of what is collected and why.
- **Cross-border**: keep all data within `af-south-1` (Cape Town) AWS region. No third-party processors outside SA without an adequacy decision or contractual safeguards. (Postmark / Google APIs are operated under SCCs — document this in the privacy notice.)

## 8. HPCSA notes

- Records retention: minimum **6 years** after last consultation (or until age 21 for minors, whichever is later). Implement a `do not delete before` constraint.
- Confidentiality: record-access on a strict need-to-know basis, audit-logged.
- Patient identity verification at first visit must be done in-person; the digital form captures intent only.

## 9. Incident response

- Suspected breach → immediate Information Regulator + affected-data-subject notification within 72h (POPIA s22).
- Documented runbook owners: practice owner + technical lead.
- Quarterly tabletop exercise.

## 10. Ongoing

- Dependency scanning on backend (Snyk / Dependabot).
- Quarterly access review (who has admin? still need it?).
- Annual penetration test once patient volume justifies (estimate: 12 months post-launch).
- All third-party SaaS (Google, Postmark, Sentry) listed in a public sub-processor register.
