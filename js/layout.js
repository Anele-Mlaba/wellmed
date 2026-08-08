/* WellMed — shared header, footer, floating CTA injector + scroll/reveal logic */
(function () {
  // Compute path prefix so the same nav works from /, /pages/, /pages/services/
  const depth = (location.pathname.match(/\/pages\//) ? (location.pathname.match(/\/pages\/services\//) ? 2 : 1) : 0);
  const ROOT = depth === 0 ? "" : depth === 1 ? "../" : "../../";

  const url = (p) => ROOT + p;

  const NAV_ITEMS = [
    { label: "Home", href: url("index.html") },
    { label: "About", href: url("pages/about.html") },
    {
      label: "Services",
      href: "#",
      children: [
        { label: "GP Practice",         href: url("pages/services/gp-practice.html") },
        { label: "IV Therapy",          href: url("pages/services/iv-therapy.html") },
        { label: "Ozone Therapy",       href: url("pages/services/ozone-therapy.html") },
        { label: "Red Light Therapy",   href: url("pages/services/red-light-therapy.html") },
        { label: "Medical Weight Loss", href: url("pages/services/weight-loss.html") },
        { label: "Yoga · Breathwork",   href: url("pages/services/yoga-breathwork.html") },
        { label: "Tests & Gut Health",  href: url("pages/services/tests-gut-health.html") }
      ]
    },
    // { label: "Art of Living", href: url("pages/art-of-living.html") },
    { label: "Contact", href: url("pages/contact.html") }
  ];

  /* Patient session (auth.js is optional on a page — degrade gracefully) */
  function authLink() {
    if (!window.WMAuth) return null;
    const session = WMAuth.getSession();
    return session
      ? { label: (session.member.firstName || "My Account"), href: url("pages/account.html"), cls: "nav-auth" }
      : { label: "Sign In", href: url("pages/login.html"), cls: "nav-auth" };
  }

  function buildDesktopMenu() {
    return NAV_ITEMS.map(item => {
      if (item.children) {
        const sub = item.children.map(c => `<li><a href="${c.href}">${c.label}</a></li>`).join("");
        return `<li class="has-dropdown"><a href="${item.href}">${item.label}</a><ul class="nav-wm__dropdown">${sub}</ul></li>`;
      }
      return `<li><a href="${item.href}" data-nav="${item.label.toLowerCase()}">${item.label}</a></li>`;
    }).join("");
  }

  function buildMobileMenu() {
    let html = `<ul>`;
    NAV_ITEMS.forEach(item => {
      if (item.children) {
        html += `<li><div class="group-title">${item.label}</div></li>`;
        item.children.forEach(c => { html += `<li><a href="${c.href}">${c.label}</a></li>`; });
      } else {
        html += `<li><a href="${item.href}">${item.label}</a></li>`;
      }
    });
    const auth = authLink();
    if (auth) html += `<li><a href="${auth.href}">${auth.label}</a></li>`;
    html += `<li><a href="${url("pages/book-appointment.html")}" class="btn-wm btn-wm--primary" style="margin-top: 1rem; display:inline-flex;">Book Appointment</a></li>`;
    html += `</ul>`;
    return html;
  }

  function injectHeader() {
    const target = document.getElementById("site-header");
    if (!target) return;
    target.innerHTML = `
      <nav class="nav-wm" id="navWm">
        <div class="container-wm nav-wm__inner">
          <a class="nav-wm__logo" href="${url("index.html")}" aria-label="WellMed home">
            <img src="${url("assets/images/logo.svg")}" alt="WellMed logo" />
            <span class="nav-wm__brand">WellMed</span>
          </a>
          <ul class="nav-wm__menu d-lg-flex" role="menubar">${buildDesktopMenu()}</ul>
          <div class="nav-wm__cta">
            ${(() => { const a = authLink(); return a ? `<a href="${a.href}" class="btn-wm btn-wm--ghost btn-wm--sm d-none d-lg-inline-flex">${WM.icons.user} <span class="d-none d-xl-inline">${a.label}</span></a>` : ""; })()}
            <a href="tel:${WM.brand.phone.replace(/\s/g,'')}" class="btn-wm btn-wm--ghost btn-wm--sm">${WM.icons.phone} <span class="d-none d-xl-inline">${WM.brand.phone}</span></a>
            <a href="${url("pages/book-appointment.html")}" class="btn-wm btn-wm--primary btn-wm--sm">Book Appointment</a>
            <button class="nav-wm__burger" id="navBurger" aria-label="Open menu" aria-expanded="false">
              <span></span><span></span><span></span>
            </button>
          </div>
        </div>
      </nav>
      <div class="nav-wm__mobile" id="navMobile">${buildMobileMenu()}</div>
    `;

    // Scroll behaviour
    const nav = document.getElementById("navWm");
    const onScroll = () => nav.classList.toggle("is-scrolled", window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });

    // Publish actual nav height so the mobile drawer can sit flush below it
    const setNavHeight = () => {
      document.documentElement.style.setProperty("--nav-h", nav.offsetHeight + "px");
    };
    setNavHeight();
    window.addEventListener("resize", setNavHeight);
    window.addEventListener("load", setNavHeight);
    // Recalculate once images (logo) settle — fonts/images can change row height
    if (window.ResizeObserver) {
      new ResizeObserver(setNavHeight).observe(nav);
    }

    // Mobile menu toggle
    const burger = document.getElementById("navBurger");
    const mobile = document.getElementById("navMobile");
    burger?.addEventListener("click", () => {
      setNavHeight();
      const open = burger.classList.toggle("is-open");
      mobile.classList.toggle("is-open", open);
      burger.setAttribute("aria-expanded", String(open));
      document.body.style.overflow = open ? "hidden" : "";
    });
    // Close drawer when a link is tapped
    mobile?.querySelectorAll("a").forEach(a => a.addEventListener("click", () => {
      burger.classList.remove("is-open");
      mobile.classList.remove("is-open");
      burger.setAttribute("aria-expanded", "false");
      document.body.style.overflow = "";
    }));

    // Highlight active link
    const path = location.pathname.split("/").pop().replace(".html", "") || "index";
    document.querySelectorAll(".nav-wm__menu a, .nav-wm__mobile a").forEach(a => {
      const href = a.getAttribute("href") || "";
      if (href.includes(path) && path !== "index") a.classList.add("is-active");
      if (path === "index" && href.endsWith("index.html")) a.classList.add("is-active");
    });
  }

  function injectFooter() {
    const target = document.getElementById("site-footer");
    if (!target) return;
    const serviceLinks = WM.services.map(s =>
      `<a href="${url(s.page || 'pages/services/' + s.slug + '.html')}">${s.title}</a>`
    ).join("");

    target.innerHTML = `
      <footer class="footer-wm">
        <div class="container-wm">
          <div class="row g-5">
            <div class="col-lg-4 col-md-6">
              <div class="footer-wm__brand">WellMed</div>
              <p style="color: rgba(255, 253, 208, 0.75); max-width: 38ch;">
                A holistic medical practice in Umhlanga where modern GP care meets ancient healing traditions 
                under the gentle, expert hands of ${WM.brand.doctor}.
              </p>
              <div style="display:flex; gap: 0.75rem; margin-top: 1.25rem;">
                <a href="${WM.brand.social.instagram}" aria-label="Instagram" style="opacity: 0.8;">Instagram</a>
                <a href="${WM.brand.social.google}" aria-label="Google Maps" style="opacity: 0.8;">Google Maps</a>
                <a href="${WM.brand.social.googleProfile}" aria-label="Google Profile" style="opacity: 0.8;">Google Profile</a>
              </div>
            </div>
            <div class="col-lg-2 col-md-6 col-6">
              <h5>Practice</h5>
              <a href="${url('pages/about.html')}">About WellMed</a>
              <!-- <a href="${url('pages/art-of-living.html')}">Art of Living</a> -->
              <a href="${url('pages/reviews.html')}">Reviews</a>
              <a href="${url('pages/contact.html')}">Contact</a>
              <a href="${url('pages/book-appointment.html')}">Book Appointment</a>
            </div>
            <div class="col-lg-3 col-md-6 col-6">
              <h5>Services</h5>
              ${serviceLinks}
            </div>
            <div class="col-lg-3 col-md-6">
              <h5>Visit Us</h5>
              <p style="color: rgba(255, 253, 208, 0.75);">${WM.brand.address}</p>
              <p style="color: rgba(255, 253, 208, 0.75);">
                ${WM.brand.hours.map(h => `<span style="display:flex; justify-content:space-between; gap:1rem;"><span>${h.day}</span><span>${h.hours}</span></span>`).join("")}
              </p>
              <a href="tel:${WM.brand.phone.replace(/\s/g,'')}">${WM.brand.phone}</a>
              <a href="mailto:${WM.brand.email}">${WM.brand.email}</a>
            </div>
          </div>
          <div class="footer-wm__bottom">
            <span>© ${new Date().getFullYear()} WellMed. All rights reserved.</span>
            <span>HPCSA Registered · POPIA compliant</span>
          </div>
        </div>
      </footer>
    `;
  }

  function injectFab() {
    const target = document.getElementById("site-fab");
    if (!target) return;
    if (location.pathname.includes("book-appointment") || location.pathname.includes("admin")) return;
    target.innerHTML = `
      <a href="${url('pages/book-appointment.html')}" class="btn-wm btn-wm--accent btn-wm--lg book-fab">
        ${WM.icons.calendar} Book Appointment
      </a>
    `;
  }

  function setupReveal() {
    if (!("IntersectionObserver" in window)) {
      document.querySelectorAll(".reveal").forEach(el => el.classList.add("is-visible"));
      return;
    }
    const io = new IntersectionObserver((entries) => {
      entries.forEach(e => {
        if (e.isIntersecting) {
          e.target.classList.add("is-visible");
          io.unobserve(e.target);
        }
      });
    }, { threshold: 0.12 });
    document.querySelectorAll(".reveal").forEach(el => io.observe(el));
  }

  document.addEventListener("DOMContentLoaded", () => {
    injectHeader();
    injectFooter();
    injectFab();
    setupReveal();
  });

  WM.url = url;
})();
