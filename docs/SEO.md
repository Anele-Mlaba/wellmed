# WellMed — SEO Strategy

## 1. Goals

Rank for high-intent local queries in Durban / Umhlanga:
- "GP Umhlanga" / "doctor Umhlanga"
- "IV therapy Umhlanga / Durban"
- "ozone therapy Durban"
- "red light therapy Umhlanga"
- "medical weight loss Durban"
- "yoga classes Umhlanga"
- branded: "Dr Moodley", "WellMed Wellness"

## 2. Technical SEO (already implemented)

- Semantic HTML, one `<h1>` per page, sensible heading hierarchy.
- Meta `title` and `description` on every page, hand-tuned per service.
- Open Graph tags on the homepage (extend to all pages in v1.1).
- `LocalBusiness` + `MedicalClinic` JSON-LD on the homepage.
- Mobile-first, responsive, fast (no JS framework, ~30KB CSS, ~10KB JS).
- Pages have stable, descriptive URLs (`/pages/services/iv-therapy.html`).

**Add before launch:**
- `sitemap.xml` (auto-generate via deploy script).
- `robots.txt` (allow all except `/pages/admin/*`).
- Per-service `MedicalProcedure` JSON-LD.
- Canonical URLs on every page (`<link rel="canonical">`).
- Image alt text on every decorative SVG (currently fine; double-check after photos are swapped in).
- 301 strategy for any future URL changes.

## 3. On-page SEO

Each service page is optimised for one primary keyword + 2–3 supporting:

| Page | Primary | Supporting |
|------|---------|------------|
| GP Practice | "GP Umhlanga" | "family doctor Durban", "private GP Umhlanga" |
| IV Therapy | "IV therapy Umhlanga" | "vitamin drip Durban", "IV vitamin therapy" |
| Ozone Therapy | "ozone therapy Durban" | "medical ozone Umhlanga" |
| Red Light Therapy | "red light therapy Umhlanga" | "photobiomodulation Durban" |
| Weight Loss | "medical weight loss Durban" | "GLP-1 Umhlanga", "weight loss doctor" |
| Yoga · Breathwork | "yoga Umhlanga" | "breathwork Durban", "meditation classes" |

Ensure each page has:
- Primary keyword in `<title>`, `<h1>`, first paragraph.
- ≥3 internal links to related services.
- ≥800 words of original copy (already met).
- FAQ section using `Question`/`Answer` JSON-LD (recommended add).

## 4. Local SEO (highest leverage)

- **Google Business Profile**: claim, complete every field, add photos weekly.
- Get on Bing Places, Apple Maps, and HelloPeter.
- Build NAP (Name/Address/Phone) consistency across:
  - Doctor finder directories (Discovery, Bonitas, MediClinic listings).
  - Local Durban directories.
  - Yoga / wellness directories for the studio side.
- Earn local backlinks from Umhlanga lifestyle blogs, mom-blog directories, school newsletters.

## 5. Content / blog (v1.1)

A modest blog accelerates rankings dramatically. Suggested cadence: **2 posts / month**, each ~1,200 words, focused on:
- Patient-question content ("What does an IV vitamin drip actually do?")
- Local-flavour content ("A Durban doctor's guide to surviving load shedding without losing your sleep")
- Seasonal content (immune season, exam stress, summer hydration)

Add a `/blog/` directory with index + per-post pages using the same shared layout.

## 6. Reviews

Google reviews are the single most powerful local-SEO lever. The current site:
- Surfaces a Reviews page.
- Shows review snippets on the homepage.

**Add to ops playbook:**
- Send every completed-appointment patient a one-tap "leave a review" link 24h after their visit (transactional email).
- Aim for 5+ reviews/month after launch.

## 7. Performance budget (Core Web Vitals)

Targets (mobile, 3G fast):
- LCP < 2.0s
- CLS < 0.05
- INP < 150ms

Already on track due to the static, framework-free build. Watch list:
- Don't add a heavy chart library to the admin dashboard (use the lightweight CSS bars used now).
- Optimise hero images when real photos arrive (WebP, ≤120KB each, `loading="lazy"` below the fold).
- Self-host critical Google Fonts subsets in v1.1 to remove the third-party render-blocking request.

## 8. Tracking

- GA4 with anonymised IP + DPA in place.
- Event taxonomy:
  - `view_service_page`
  - `start_booking`
  - `complete_booking_step_1..4`
  - `submit_booking`
  - `submit_contact`
- Search Console verified at launch.
