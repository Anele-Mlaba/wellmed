# WellMed — Deployment Architecture

## Front-end (this repo)

**Target: AWS S3 + CloudFront + Route 53.**

- **S3 bucket** `wellmed-site-prod`, *private*, served only via CloudFront (Origin Access Control).
- **CloudFront** distribution with the production cert from ACM (us-east-1).
  - Default behaviour: cache HTML 0s (force fresh), cache `/css/*`, `/js/*`, `/assets/*` for 1 year with content hashes.
  - HTTP → HTTPS redirect.
  - HTTP/2 + HTTP/3.
  - Compress objects automatically.
- **Route 53** A/AAAA records for `wellmed.co.za` and `www.wellmed.co.za` → CloudFront alias.
- **Security headers** via CloudFront response headers policy:
  - HSTS (preload, 2y)
  - CSP (`default-src 'self'; img-src 'self' data: https://maps.googleapis.com; script-src 'self' https://cdn.jsdelivr.net 'unsafe-inline'; style-src 'self' https://fonts.googleapis.com https://cdn.jsdelivr.net 'unsafe-inline'; font-src https://fonts.gstatic.com; connect-src 'self' https://api.wellmed.co.za`)
  - `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy: camera=(), microphone=(), geolocation=()`.

### Deploy pipeline (GitHub Actions, suggested)

```yaml
on:
  push:
    branches: [main]
jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: aws s3 sync . s3://wellmed-site-prod --delete --exclude ".git/*" --exclude "docs/*"
      - run: aws cloudfront create-invalidation --distribution-id $CF_DIST --paths "/*"
```

No build step. The site ships as it is.

## Backend (separate repo / service)

**Recommended: AWS-native serverless or containerised.**

### Option A — AWS Lambda + API Gateway (recommended for low traffic)
- API Gateway HTTP API, custom domain `api.wellmed.co.za`.
- Lambda functions per route (Node 20 or Python 3.12).
- RDS Postgres `db.t4g.small` in private subnets, single-AZ for v1.
- Secrets Manager for Google service-account JSON, DB password, JWT secret.
- EventBridge schedule (every 30 min) → reminder Lambda.
- CloudWatch Logs with 30-day retention; PII redaction filter.

### Option B — ECS Fargate (if a single Node app is preferred)
- One service, ALB in front, RDS in private subnet. Same Secrets/Eventbridge wiring.

### Database

- RDS Postgres 16, encrypted at rest, automated backups 7 days.
- Snapshot before any schema migration.

### Email

- Postmark (recommended for deliverability + free for transactional volumes), or AWS SES if domain is already verified.
- DKIM + SPF + DMARC on `wellmed.co.za` from day one.

## Environments

| Env       | Front-end                          | Backend                          |
|-----------|------------------------------------|----------------------------------|
| Local     | open `index.html`, or `python -m http.server` | `npm run dev` against local Postgres |
| Staging   | `staging.wellmed.co.za` (separate S3 + CF) | `api-staging.wellmed.co.za` |
| Production| `wellmed.co.za`                    | `api.wellmed.co.za`              |

## Observability

- CloudWatch dashboards: API latency, 4xx/5xx rate, booking volume.
- Sentry on both front and back (front-end error reporting via CDN script).
- Synthetic check (UptimeRobot or CloudWatch Synthetics) hitting `/api/availability?service=gp-practice&date=<tomorrow>` every 5 min.

## DR / RTO

- RDS daily snapshot + 7-day PITR.
- S3 site is versioned; rollback = re-sync previous commit.
- Documented runbook in `/docs/RUNBOOK.md` (TBD).
