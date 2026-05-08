# WellMed — Database Schema

PostgreSQL recommended. Field-level encryption (e.g., pgcrypto or app-layer libsodium) on flagged columns.

## `patients`
```
id                  UUID PK
created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
first_name          TEXT NOT NULL
last_name           TEXT NOT NULL
id_or_passport      TEXT NOT NULL  -- ENCRYPTED
phone               TEXT NOT NULL
email               TEXT NOT NULL  -- ENCRYPTED at rest, indexed via deterministic encryption or hash for lookup
emergency_name      TEXT NOT NULL
emergency_phone     TEXT NOT NULL
date_of_birth       DATE            -- derived from SA ID where applicable
gender              TEXT            -- self-identified, optional
marketing_opt_in    BOOL DEFAULT FALSE
popia_consent_at    TIMESTAMPTZ NOT NULL
notes_for_doctor    TEXT
UNIQUE (email)
```

## `medical_aid`
One-to-one with `patients`.
```
patient_id          UUID PK FK -> patients.id
provider            TEXT
member_number       TEXT  -- ENCRYPTED
main_member         TEXT
dependent_code      TEXT
```

## `intake`
History snapshot per booking — patients may update over time.
```
id                  UUID PK
patient_id          UUID FK -> patients.id
booking_id          UUID FK -> bookings.id NULL
existing_conditions TEXT  -- ENCRYPTED
allergies           TEXT  -- ENCRYPTED
current_meds        TEXT  -- ENCRYPTED
reason_for_visit    TEXT
notes               TEXT  -- ENCRYPTED
captured_at         TIMESTAMPTZ NOT NULL DEFAULT now()
```

## `bookings`
```
id                  UUID PK
short_id            TEXT UNIQUE NOT NULL  -- e.g. "WM-1042" for human reference
patient_id          UUID FK -> patients.id
service             TEXT NOT NULL CHECK (service IN ('gp-practice','iv-therapy','ozone-therapy','red-light-therapy','weight-loss','yoga-breathwork'))
slot_start          TIMESTAMPTZ NOT NULL
slot_end            TIMESTAMPTZ NOT NULL
status              TEXT NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending','confirmed','completed','noshow','cancelled'))
source              TEXT NOT NULL DEFAULT 'online'
                    CHECK (source IN ('online','phone','walkin'))
google_event_id     TEXT
created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
confirmation_sent_at TIMESTAMPTZ
reminder_sent_at    TIMESTAMPTZ
cancelled_at        TIMESTAMPTZ
cancel_reason       TEXT
INDEX (slot_start)
INDEX (status, slot_start)
INDEX (patient_id)
```

## `service_config`
Tunable per-service rules (so the doctor can change durations without code changes).
```
service             TEXT PK
duration_minutes    INT NOT NULL
buffer_minutes      INT NOT NULL DEFAULT 0
business_hours      JSONB NOT NULL  -- { "mon": ["08:00","17:00"], "sat": ["09:00","13:00"], "sun": null }
max_per_day         INT
```

## `contact_messages`
```
id                  UUID PK
created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
name                TEXT NOT NULL
email               TEXT NOT NULL
phone               TEXT
topic               TEXT
message             TEXT NOT NULL
ip_address          INET
handled_at          TIMESTAMPTZ
```

## `admin_users`
```
id                  UUID PK
email               TEXT UNIQUE NOT NULL
password_hash       TEXT NOT NULL  -- argon2id
role                TEXT NOT NULL CHECK (role IN ('doctor','admin','reception'))
mfa_secret          TEXT
last_login_at       TIMESTAMPTZ
disabled_at         TIMESTAMPTZ
```

## `audit_log`
Required for HPCSA/POPIA traceability of any access to patient records.
```
id                  BIGSERIAL PK
at                  TIMESTAMPTZ NOT NULL DEFAULT now()
actor_user_id       UUID REFERENCES admin_users(id)
actor_ip            INET
action              TEXT NOT NULL  -- 'view_patient', 'update_booking', etc.
target_table        TEXT
target_id           TEXT
diff                JSONB
INDEX (at), INDEX (target_table, target_id)
```

## Notes

- All encrypted fields use a single envelope-encryption key managed in AWS KMS.
- A nightly job rolls aggregate metrics into a `daily_stats` table to keep the admin dashboard fast.
- Soft delete is preferred over hard delete for patient-linked records — set `cancelled_at` instead of removing rows.
