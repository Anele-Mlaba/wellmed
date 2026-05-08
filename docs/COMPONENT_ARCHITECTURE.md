# WellMed — Component Architecture & Folder Structure

## Folder structure

```
wellmed/
├── index.html                       # Homepage
├── assets/
│   ├── design/
│   │   ├── wellmed-palette-code.txt # Coolors palette export
│   │   └── wellmed-palette.png      # Visual palette reference
│   ├── icons/                       # Favicon variants (TBD)
│   └── images/
│       ├── logo.svg                 # Brand logo
│       ├── placeholder-doctor.svg   # Stand-in until real photos arrive
│       ├── hero-1.svg, hero-2.svg, hero-3.svg
│       └── gallery-pattern.svg
├── css/
│   ├── tokens.css                   # Design tokens — colours, type scale, spacing, motion
│   ├── base.css                     # Reset, base typography, container, utilities
│   └── components.css               # All component classes (nav, cards, hero, forms, …)
├── js/
│   ├── config.js                    # Brand info, services list, API endpoints
│   ├── icons.js                     # Inline SVG icon set
│   ├── layout.js                    # Header / footer / FAB injector + reveal-on-scroll
│   ├── home.js                      # Homepage carousel + counter animations
│   ├── booking.js                   # Multi-step booking flow logic
│   └── admin.js                     # Admin dashboard data + filters + charts
├── pages/
│   ├── about.html
│   ├── art-of-living.html
│   ├── reviews.html
│   ├── contact.html
│   ├── book-appointment.html        # The booking flow (4 steps + confirmation)
│   ├── services/
│   │   ├── gp-practice.html
│   │   ├── iv-therapy.html
│   │   ├── ozone-therapy.html
│   │   ├── red-light-therapy.html
│   │   ├── weight-loss.html
│   │   └── yoga-breathwork.html
│   └── admin/
│       └── dashboard.html
└── docs/
    ├── BACKEND_API_CONTRACT.md
    ├── DATABASE_SCHEMA.md
    ├── BOOKING_ARCHITECTURE.md
    ├── DEPLOYMENT.md
    ├── SECURITY.md
    ├── SEO.md
    ├── COMPONENT_ARCHITECTURE.md   ← you are here
    ├── RESPONSIVE_STRATEGY.md
    └── ROADMAP.md
```

## Component model

Vanilla HTML + small JS injectors. Every page declares `<div id="site-header"></div>` and `<div id="site-footer"></div>` placeholders; `js/layout.js` populates them from a single nav-config so navigation is consistent everywhere.

### Reusable CSS components

| Class | Purpose |
|-------|---------|
| `.btn-wm` + modifiers (`--primary`, `--accent`, `--ghost`, `--light`, `--lg`, `--sm`) | Buttons |
| `.card-wm`, `.card-service` | Cards |
| `.testimonial`, `.stars` | Reviews |
| `.stat`, `.stat__num`, `.stat__label` | Animated stat blocks |
| `.pill`, `.pill--apricot`, `.pill--cream` | Tag chips |
| `.form-wm` (scope) + `.field`, `.error`, `.help` | Form scaffolding |
| `.checkbox-wm` | Soft checkbox |
| `.nav-wm` + dropdown, mobile drawer | Navigation |
| `.footer-wm` | Footer |
| `.book-fab` | Floating "Book Appointment" CTA |
| `.hero` + `.hero__slide`, `.hero__dot` | Homepage carousel |
| `.page-hero` | Interior-page hero band |
| `.section`, `.section--cream`, `.section--bg`, `.section--olive` | Section variants |
| `.faq-item` (uses native `<details>`) | Accordion FAQ |
| `.gallery` | 6-up asymmetric gallery |
| `.stepper`, `.step`, `.slot`, `.service-tile` | Booking flow controls |
| `.admin-shell`, `.admin-sidebar`, `.admin-main`, `.kpi`, `.table-wm`, `.status-pill` | Admin dashboard |

### Design tokens

All colours, type sizes, spacings, shadows and motion durations are CSS custom properties declared in `css/tokens.css`. Change one token, propagate everywhere.

### State / data layer

- `WM` global namespace (set in `js/config.js`):
  - `WM.brand` — practice metadata
  - `WM.services` — single source of truth for service slugs/titles/icons (used by nav, booking, footer, admin)
  - `WM.api` — endpoint base + paths (env-swap here)
  - `WM.icons` — inline SVG set
- No client-side framework; pages render server-of-truth-free, then JS injects nav/footer/FAB and binds page-specific behaviour.

## Why no framework

- Hosted on S3 — wants pure static.
- The interactivity surface is small (carousel, stepper, dashboard filters). Framework overhead ≫ feature need.
- Every page is independently cacheable, every render is < 16ms, no hydration cost.

## Adding a new service later

1. Append to `WM.services` in `js/config.js`.
2. Add a slug-named SVG icon in `js/icons.js` (or reuse an existing one).
3. Duplicate any `pages/services/*.html` and edit content.
4. Backend `service_config` row → defines duration, hours, max/day. No front-end change required.

The nav, footer, services grid on the homepage, and booking-flow service tiles all read from `WM.services` and update automatically.
