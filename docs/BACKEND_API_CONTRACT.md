# WellMed — Backend API Contract

> This document is the single source of truth for the contract between the **WellMed front-end (this repo, hosted on S3)** and **the backend service to be built**. Hand this whole file to the backend engineer / Claude session that will implement the API.

## 1. Scope

The backend must support:

1. The patient-facing **booking flow** (`pages/book-appointment.html`)
2. The contact form (`pages/contact.html`)
3. The **admin dashboard** (`pages/admin/dashboard.html`) for Dr Moodley
4. **Google Calendar** integration (practice calendar + patient calendar invites)
5. **Transactional email** (confirmation + reminder)
6. Secure storage of patient intake & medical-aid information

**Explicitly out of scope (for now):**
- Payment gateway integration
- Medical-aid switching / live eligibility checks
- Patient self-service portal beyond booking

## 2. Tech assumptions

- HTTPS only. CORS open to the production S3/CloudFront origin only.
- JSON request/response.
- ISO-8601 UTC timestamps for all dates.
- All times displayed to patients are in `Africa/Johannesburg` (UTC+2). Backend stores UTC, returns UTC, front-end converts.
- Auth: admin endpoints require `Authorization: Bearer <jwt>`. Patient endpoints are unauthenticated but rate-limited.

## 3. Base URL

```
Production:  https://api.wellmed.co.za
Staging:     https://api-staging.wellmed.co.za
```

The front-end reads the base URL from `WM.api.baseUrl` in `js/config.js` — change it per environment.

## 4. Endpoints

### 4.1 `GET /api/availability`

Return bookable slots for a given service and date.

**Query:**
- `service` (string, required) — one of `gp-practice`, `iv-therapy`, `ozone-therapy`, `red-light-therapy`, `weight-loss`, `yoga-breathwork`
- `date` (string, required) — `YYYY-MM-DD`

**Response 200:**
```json
[
  { "start": "2026-05-09T07:00:00Z", "label": "09:00", "available": true },
  { "start": "2026-05-09T07:30:00Z", "label": "09:30", "available": false }
]
```

The front-end already gracefully falls back to synthesised slots when this endpoint is unreachable, so deploying it is non-blocking.

### 4.2 `POST /api/bookings`

Submit a new booking + intake. Triggers Google Calendar creation, transactional confirmation email, and DB insert.

**Request body** (matches `state` object built by `js/booking.js`):
```json
{
  "service": "iv-therapy",
  "requestedSlot": "2026-05-09T07:30:00Z",
  "personal": {
    "firstName": "Nadia",
    "lastName": "Pillay",
    "idOrPassport": "8501010000080",
    "phone": "+27821234567",
    "email": "nadia@example.co.za",
    "emergencyContact": { "name": "John Pillay", "phone": "+27827654321" },
    "medicalAid": {
      "provider": "Discovery",
      "memberNumber": "1234567890",
      "mainMember": "Nadia Pillay",
      "dependentCode": "00"
    }
  },
  "medical": {
    "existingConditions": "Hypothyroidism",
    "allergies": "Penicillin",
    "currentMeds": "Eltroxin 100mcg daily",
    "reasonForVisit": "Energy IV before a busy work week",
    "notes": "",
    "marketingOptIn": true
  },
  "consent": true,
  "submittedAt": "2026-05-08T12:00:00Z"
}
```

**Validation (server-side, mandatory):**
- `service` ∈ allowed slugs
- `requestedSlot` is a future ISO timestamp on a working day
- `personal.firstName`, `personal.lastName`, `personal.idOrPassport`, `personal.phone`, `personal.email` non-empty
- `personal.email` is a valid email
- `personal.emergencyContact.name` and `.phone` non-empty
- `consent === true` (required)

**Response 201:**
```json
{
  "id": "WM-1042",
  "status": "confirmed",
  "calendarEventId": "abc123def456",
  "patientCalendarInviteSent": true,
  "confirmationEmailSent": true
}
```

**Errors:**
- `400` `{ "error": "validation", "fields": ["personal.email"] }`
- `409` `{ "error": "slot_unavailable" }` — slot was taken between availability fetch and submit
- `429` `{ "error": "rate_limited" }`

### 4.3 `POST /api/contact`

Contact form submission (non-clinical).

**Request:**
```json
{
  "name": "Nadia",
  "email": "nadia@example.co.za",
  "phone": "+27821234567",
  "topic": "General enquiry",
  "message": "Do you have evening yoga classes?",
  "ts": "2026-05-08T12:00:00Z"
}
```
**Response 200:** `{ "ok": true }`

### 4.4 `GET /api/admin/bookings` (auth required)

**Query (all optional):**
- `status` — `confirmed | pending | completed | noshow`
- `service` — slug
- `from`, `to` — `YYYY-MM-DD` range
- `q` — free-text search across patient name and id

**Response 200:**
```json
[
  {
    "id": "WM-1042",
    "patient": "Nadia Pillay",
    "service": "iv-therapy",
    "slot": "2026-05-09T07:30:00Z",
    "status": "confirmed",
    "source": "online",
    "ageBand": "35-44",
    "gender": "F",
    "medicalAid": "Discovery"
  }
]
```

`ageBand` is computed from `idOrPassport` server-side and stored as a band only (not raw DOB) on the listing endpoint to limit PII exposure to the dashboard.

### 4.5 `GET /api/admin/bookings/:id` (auth required)

Returns the **full** booking record, including intake fields (only fetched when the doctor opens a single record).

### 4.6 `PATCH /api/admin/bookings/:id` (auth required)

Reschedule, cancel, or update status.
**Body:**
```json
{ "status": "completed" }
```
or
```json
{ "newSlot": "2026-05-12T08:00:00Z", "notifyPatient": true }
```

When `newSlot` is provided, the backend must update the Google Calendar event and re-send the patient's calendar invite.

### 4.7 `GET /api/admin/stats` (auth required)

**Query:** `from`, `to` (defaults to last 30 days)
**Response:**
```json
{
  "totals": { "bookings": 142, "completed": 118, "noshow": 9, "pending": 3, "upcoming": 12 },
  "byService": [{ "service": "gp-practice", "count": 56 }, ...],
  "demographics": {
    "ageBands": { "0-17": 4, "18-24": 12, "25-34": 38, "35-44": 41, "45-54": 27, "55+": 20 },
    "gender": { "F": 92, "M": 47, "Other": 3 }
  }
}
```

## 5. Google Calendar integration

**Service account approach** (preferred — least friction for the patient):

1. Create a GCP project, enable Google Calendar API, create a service account.
2. Share the **practice calendar** with the service account email (Editor permission).
3. On `POST /api/bookings`:
   - Backend uses service-account credentials to `events.insert` into the practice calendar.
   - Set `attendees: [{ email: patient.email }]` with `sendUpdates: "all"` so Google sends the patient a calendar invite directly.
   - `summary` = `WellMed · {Service Title} · {Patient}`
   - `description` = templated, includes intake summary (no medical-aid number)
4. Persist `calendarEventId` on the booking row.
5. On reschedule: `events.patch` with new `start`/`end`.
6. On cancel: `events.delete`.

**Reminder emails:** schedule a job (e.g., AWS EventBridge or simple cron) that runs every 30 minutes and sends a reminder email for any booking starting 24h ahead and `reminderSentAt IS NULL`.

## 6. Email (transactional)

Use Postmark, SES, or Resend. Two templates:

- `booking_confirmation` — sent immediately after `POST /api/bookings`
- `booking_reminder` — sent ~24h before slot

Both include the booking ID, slot in SAST, doctor name, address, "add to calendar" link, reschedule URL.

## 7. Security & PII

- All endpoints require HTTPS (HSTS preload).
- DB encryption at rest (AES-256). Field-level encryption on `idOrPassport`, `medicalAid.memberNumber`, intake free-text fields.
- Logs must redact email, phone, ID, and medical-aid numbers.
- Admin auth: short-lived JWT (15min) + refresh, with role `doctor` or `admin`.
- Rate limit `POST /api/bookings` to 5/min/IP.
- Honeypot field + reCAPTCHA v3 on booking and contact submissions.
- See `SECURITY.md` for the full POPIA posture.

## 8. Webhooks (future, not blocking)

- `booking.confirmed`, `booking.cancelled`, `booking.completed` — for future integrations (e.g. EHR sync, marketing automation). Not required for v1.
