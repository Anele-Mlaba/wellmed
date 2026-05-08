# WellMed — Responsive Design Strategy

## Approach: mobile-first, content-led

Every layout is designed for the smallest screen first; larger screens get progressively richer composition. Bootstrap 5's grid handles structure; bespoke CSS handles all the bespoke spacing, hero layouts and soft-edge details.

## Breakpoints (Bootstrap 5 defaults — kept intentionally)

| Token | Min width | Used for |
|-------|-----------|----------|
| `xs` (default) | 0 | Phones, single-column |
| `sm` | 576px | Larger phones |
| `md` | 768px | Tablets, where two-up cards begin |
| `lg` | 992px | Small laptops, full nav becomes visible |
| `xl` | 1200px | Large laptops |
| `xxl` | 1400px | Wide desktop, generous whitespace |

The `--container-max` is `1280px`; container padding scales with viewport via `clamp(1rem, 4vw, 2.5rem)`.

## Type scale

All headings use `clamp()` so they breathe:
```css
--fs-xxxl: clamp(2.75rem, 1.8rem + 4vw, 5rem);   /* 44px → 80px */
--fs-xxl:  clamp(2rem,    1.4rem + 2.5vw, 3.5rem);
--fs-xl:   clamp(1.6rem,  1.2rem + 1.6vw, 2.4rem);
--fs-lg:   clamp(1.25rem, 1rem   + 0.8vw, 1.6rem);
```

This gives a continuous, fluid scale instead of breakpoint hops, which keeps the wellness-y feel.

## Layout patterns

| Pattern | Behaviour |
|---------|-----------|
| **Service grid** (homepage) | 1col → 2col @ md → 3col @ lg |
| **Hero** | Full-bleed image; text width capped at 18ch for headline, 52ch for lead |
| **Doctor block** | Stacks below 992px; portrait first on mobile, alternates sides on desktop |
| **Gallery** | Asymmetric 12-col grid above 768px; 6-col uniform on mobile |
| **Nav** | Full horizontal menu @ ≥992px; hamburger drawer below |
| **Booking** | Single column always; the stepper wraps gracefully on small screens |
| **Admin dashboard** | 240px sidebar + main @ ≥768px; sidebar collapses to top bar below |

## Touch ergonomics

- All buttons ≥ 44px tall (Apple HIG).
- Booking slot tiles ≥ 44px, with 12px gaps to avoid mis-taps.
- Floating CTA shrinks padding on small screens.
- No hover-only affordances — every dropdown/disclosure is also keyboard- and touch-accessible (`<details>` elements, `:focus-within` on nav dropdowns).

## Imagery

- Hero illustrations are SVG → resolution-independent, ≤8KB each.
- When real photographs replace placeholders:
  - Provide WebP first, JPG fallback.
  - Use `srcset` with 2–3 widths and `sizes`.
  - Lazy-load anything below the fold (`loading="lazy"`).
  - Target ≤120KB for hero, ≤60KB for thumbnails.

## Reduced motion

All animations are wrapped by:
```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after { animation-duration: 0.01ms !important; transition-duration: 0.01ms !important; }
}
```

Defined once in `tokens.css`, applies everywhere.

## Test matrix (pre-launch)

- iPhone SE (375 wide) — smallest realistic device.
- iPhone 14 (390).
- Android Pixel (412).
- iPad portrait (768) and landscape (1024).
- 13" laptop (1366).
- 24" desktop (1920).
- Print (one-page basics — primarily for the contact page).

## Accessibility notes (responsive ↔ a11y intersection)

- Text never sized smaller than 0.8125rem.
- Focus ring respected at all breakpoints (`:focus-visible`).
- Mobile menu locks body scroll while open and is dismissible by Esc.
- Forms: every input has a `<label>`; errors are announced via `[aria-live="polite"]` regions (TODO: wire in `js/booking.js` v1.1).
