# WellMed — Booking System Architecture & Google Calendar Flow

## High-level diagram

```
                       ┌───────────────────────┐
                       │  S3 + CloudFront      │
                       │  static SPA (vanilla) │
                       └──────────┬────────────┘
                                  │ HTTPS / JSON
                                  ▼
                       ┌───────────────────────┐
                       │  API Gateway / ALB    │
                       └──────────┬────────────┘
                                  ▼
                       ┌───────────────────────┐
                       │  Backend service      │
                       │  (Node.js / Python)   │
                       └─┬────────┬────────┬───┘
                         │        │        │
                         ▼        ▼        ▼
                 ┌─────────┐ ┌────────┐ ┌──────────────┐
                 │ Postgres│ │  KMS   │ │ Google APIs  │
                 │ (RDS)   │ │ (keys) │ │  (Calendar)  │
                 └─────────┘ └────────┘ └──────────────┘
                                              │
                                              ▼
                                    ┌──────────────────────┐
                                    │ Postmark / SES       │
                                    │ (transactional mail) │
                                    └──────────────────────┘
```

## End-to-end booking flow

1. **Patient lands on `/pages/book-appointment.html`** (deep-linked from any service page with `?service=...`).
2. **Step 1 — Service**: state stored in JS only.
3. **Step 2 — Slot**: front-end calls `GET /api/availability?service=...&date=...`.
   - If unreachable, `js/booking.js` synthesises plausible slots so UX never breaks during dev/staging.
4. **Step 3 — Personal + medical aid**: validated client-side.
5. **Step 4 — Intake + consent**: consent checkboxes are blocking.
6. **Submit**: front-end `POST /api/bookings`.
7. **Backend** (atomic transaction):
   - Validate payload + slot still free (`SELECT FOR UPDATE` on bookings overlapping `slot_start`).
   - Insert `patients` (or update if email exists).
   - Insert `medical_aid` (upsert).
   - Insert `intake`.
   - Insert `bookings` with status `pending`.
   - Call **Google Calendar** `events.insert` with patient email as `attendee` and `sendUpdates=all`.
   - On success, set `status='confirmed'`, persist `google_event_id`.
   - Enqueue `booking_confirmation` email (decoupled — fail-soft if mail provider hiccups).
   - Return `{ id, status, calendarEventId }`.
8. **Patient receives**:
   - Branded confirmation email
   - Google Calendar invite (auto-accepted by gmail clients)
9. **Reminder job** runs every 30 min and sends `booking_reminder` to anyone 24h ahead.

## Google Calendar — service account approach

**Why service account, not OAuth?**
Patients don't need to grant access — the practice owns the authoritative calendar. The patient simply receives a calendar invite by email like any normal meeting.

**Setup (one-off):**
1. GCP project → enable **Google Calendar API**.
2. Create **service account** → download JSON credentials → store in AWS Secrets Manager.
3. In Google Workspace admin: domain-wide delegation **not required** for this pattern.
4. Create the **practice calendar** (e.g., `bookings@wellmed.co.za`).
5. Share the calendar with the service account's email, granting **Make changes to events**.

**Per-booking call:**
```js
const event = {
  summary: `WellMed · ${serviceTitle} · ${patient.firstName} ${patient.lastName}`,
  description: renderEventDescription(intake), // sanitised, no medical-aid number
  start: { dateTime: slotStartIso, timeZone: 'Africa/Johannesburg' },
  end:   { dateTime: slotEndIso,   timeZone: 'Africa/Johannesburg' },
  attendees: [{ email: patient.email, displayName: `${patient.firstName} ${patient.lastName}` }],
  reminders: { useDefault: false, overrides: [{ method: 'email', minutes: 24*60 }, { method: 'popup', minutes: 60 }] },
};
const resp = await calendar.events.insert({
  calendarId: PRACTICE_CALENDAR_ID,
  resource: event,
  sendUpdates: 'all',
});
```

**Reschedule / cancel:**
- `events.patch({ calendarId, eventId: booking.google_event_id, resource: { start, end }, sendUpdates: 'all' })`
- `events.delete({ calendarId, eventId, sendUpdates: 'all' })`

**Failure isolation:** if the calendar call fails, the booking row stays `pending` and a retry job picks it up. The patient is never told "confirmed" until the calendar event is created.

## Slot availability — single source of truth

Availability is computed at request time from:

- `service_config.business_hours` (calendar of opening hours)
- Existing `bookings` rows where `status IN ('pending','confirmed')`
- `service_config.duration_minutes` + `buffer_minutes`

This avoids two-system divergence between Google Calendar and the database. The calendar is the **patient-facing record**; the database is the **availability authority**.

(If Dr Moodley adds a personal block directly in Google Calendar, a sync worker can mirror those into a `manual_blocks` table — but this is a v1.5 feature, not blocking.)

## Idempotency

`POST /api/bookings` accepts an optional `Idempotency-Key` header. The backend records the key + response for 24h so a double-click never creates two bookings.

## Cancellations and rescheduling (patient-facing)

Email confirmation contains `https://wellmed.co.za/manage/{shortId}?token=<hmac>` — a signed link the patient can use to cancel or reschedule without an account. Out of scope for v1 if timeline is tight.
