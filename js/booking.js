/* WellMed — Multi-step booking flow (shared by two pages)
   Standard mode (book-appointment.html): 1 service + price option · 2 slot · 3 details · 4 consent · 5 confirmation
   IV mode (book-iv-therapy.html, set window.WM_BOOKING_MODE = "iv"):
                                          1 drip menu · 2 slot · 3 details · 4 consent · 5 confirmation
   Prices come from the admin-maintained catalog (js/pricing.js); the backend
   re-resolves prices server-side, so only ids are submitted. */
(function () {
  const MODE = window.WM_BOOKING_MODE || "standard";

  const state = {
    step: 1,
    service: MODE === "iv" ? "iv-therapy" : null,
    date: null,
    slot: null,
    personal: {},
    consent: false,
    pricing: null,        // { itemId, extras: [ids] } | null
    catalog: null
  };

  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => document.querySelectorAll(sel);
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, c => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" }[c]));

  async function ensureCatalog() {
    if (state.catalog) return state.catalog;
    try {
      state.catalog = await WM.pricing.load();
    } catch (e) {
      state.catalog = null; // degrade: booking proceeds without a price selection
    }
    return state.catalog;
  }

  /* Current selection resolved against the catalog, for display only. */
  function pricingInfo() {
    if (!state.pricing || !state.catalog) return null;
    const item = WM.pricing.item(state.catalog, state.pricing.itemId);
    if (!item || item.price == null) return null;
    const extras = (item.extras || []).filter(x => state.pricing.extras.includes(x.id));
    return {
      name: item.name,
      base: Number(item.price),
      extras,
      total: Number(item.price) + extras.reduce((sum, x) => sum + Number(x.price || 0), 0)
    };
  }

  /* -------- Step 1 (standard): service select + price option -------- */
  function renderServices() {
    const wrap = $("#serviceTiles");
    wrap.innerHTML = WM.services.map(s => `
      <div class="col-md-6">
        <button type="button" class="service-tile" data-slug="${s.slug}" aria-pressed="false">
          <div class="service-tile__icon">${WM.icons[s.icon] || ""}</div>
          <div>
            <h4>${s.title}</h4>
            <p>${s.tagline}</p>
          </div>
        </button>
      </div>
    `).join("");

    wrap.querySelectorAll(".service-tile").forEach(tile => {
      tile.addEventListener("click", () => {
        const svc = WM.services.find(s => s.slug === tile.dataset.slug);
        if (svc && svc.bookPage) { location.href = svc.bookPage; return; } // IV has its own flow
        wrap.querySelectorAll(".service-tile").forEach(t => { t.classList.remove("is-selected"); t.setAttribute("aria-pressed","false"); });
        tile.classList.add("is-selected");
        tile.setAttribute("aria-pressed","true");
        state.service = tile.dataset.slug;
        renderPriceOptions();
      });
    });

    // Pre-select if URL has ?service=
    const params = new URLSearchParams(location.search);
    const pre = params.get("service");
    if (pre) {
      const tile = wrap.querySelector(`[data-slug="${pre}"]`);
      if (tile) tile.click();
    }
  }

  /* Options for the selected service (packages / sessions / fixed test price). */
  async function renderPriceOptions() {
    const box = $("#priceOptions");
    if (!box) { $("#nextBtn1").disabled = !state.service; return; }
    state.pricing = null;
    const map = WM.pricingMap[state.service];
    if (!map) { // e.g. GP, weight loss — no price selection
      box.innerHTML = "";
      $("#nextBtn1").disabled = false;
      return;
    }

    box.innerHTML = `<p class="muted" style="margin: 1.5rem 0 0;">Loading options…</p>`;
    $("#nextBtn1").disabled = true;
    const catalog = await ensureCatalog();
    if (!catalog) { // pricing API down — let the booking continue without it
      box.innerHTML = "";
      $("#nextBtn1").disabled = false;
      return;
    }

    const cat = WM.pricing.category(catalog, map.category);
    const items = ((cat && cat.items) || []).filter(i => i.price != null);
    if (!items.length) { box.innerHTML = ""; $("#nextBtn1").disabled = false; return; }

    if (map.itemId) { // fixed-price service (tests) — auto-selected
      const item = items.find(i => i.id === map.itemId);
      if (!item) { box.innerHTML = ""; $("#nextBtn1").disabled = false; return; }
      state.pricing = { itemId: item.id, extras: [] };
      box.innerHTML = `
        <div class="booking-total" style="margin-top: 1.5rem;">
          <span>${esc(item.name)}</span><span>${WM.pricing.fmt(item.price)}</span>
        </div>`;
      $("#nextBtn1").disabled = false;
      return;
    }

    box.innerHTML = `
      <p style="font-size: var(--fs-xs); letter-spacing: 0.18em; text-transform: uppercase; color: var(--color-olive); margin: 1.75rem 0 0.75rem;">Choose an option</p>
      <div class="d-grid gap-2">
        ${items.map(i => `
          <button type="button" class="price-option" data-item="${esc(i.id)}" aria-pressed="false">
            <div><h4>${esc(i.name)}</h4>${i.description ? `<p>${esc(i.description)}</p>` : ""}</div>
            <span class="price-option__price">${WM.pricing.fmt(i.price)}</span>
          </button>
        `).join("")}
      </div>`;
    bindOptionButtons(box, items);
  }

  function bindOptionButtons(box, items) {
    box.querySelectorAll(".price-option").forEach(btn => {
      btn.addEventListener("click", () => {
        box.querySelectorAll(".price-option").forEach(b => { b.classList.remove("is-selected"); b.setAttribute("aria-pressed","false"); });
        btn.classList.add("is-selected");
        btn.setAttribute("aria-pressed","true");
        state.pricing = { itemId: btn.dataset.item, extras: [] };
        box.querySelectorAll(".price-option__extras").forEach(x => {
          x.hidden = x.dataset.extrasFor !== btn.dataset.item;
          if (x.hidden) x.querySelectorAll("input:checked").forEach(c => { c.checked = false; });
        });
        updateExtrasFromChecks(box);
        $("#nextBtn1").disabled = false;
      });
    });
    box.querySelectorAll(".price-option__extras input[type=checkbox]").forEach(chk => {
      chk.addEventListener("change", () => updateExtrasFromChecks(box));
    });
  }

  function updateExtrasFromChecks(box) {
    if (!state.pricing) return;
    const block = box.querySelector(`.price-option__extras[data-extras-for="${state.pricing.itemId}"]`);
    state.pricing.extras = block
      ? [...block.querySelectorAll("input:checked")].map(c => c.dataset.extra)
      : [];
    const info = pricingInfo();
    const totalEl = $("#dripTotal");
    if (totalEl && info) totalEl.innerHTML = `<span>${esc(info.name)}${info.extras.length ? " + extras" : ""}</span><span>${WM.pricing.fmt(info.total)}</span>`;
  }

  /* -------- Step 1 (IV mode): drip menu -------- */
  async function renderDripMenu() {
    const box = $("#dripMenu");
    box.innerHTML = `<p class="muted">Loading our drip menu…</p>`;
    const catalog = await ensureCatalog();
    const cat = catalog && WM.pricing.category(catalog, "iv-therapy");
    const items = ((cat && cat.items) || []).filter(i => i.price != null);
    if (!items.length) {
      box.innerHTML = `<p class="muted">We couldn't load the drip menu right now. You can continue and choose your drip at the practice, or call ${WM.brand.phone}.</p>`;
      $("#nextBtn1").disabled = false;
      return;
    }

    box.innerHTML = `
      <div class="d-grid gap-2">
        ${items.map(i => `
          <div>
            <button type="button" class="price-option" data-item="${esc(i.id)}" aria-pressed="false">
              <div><h4>${esc(i.name)}</h4>${i.description ? `<p>${esc(i.description)}</p>` : ""}</div>
              <span class="price-option__price">${WM.pricing.fmt(i.price)}</span>
            </button>
            ${(i.extras || []).length ? `
              <div class="price-option__extras" data-extras-for="${esc(i.id)}" hidden>
                ${i.extras.map(x => `
                  <label class="checkbox-wm" style="margin: 0;">
                    <input type="checkbox" data-extra="${esc(x.id)}" />
                    <span>Add ${esc(x.name)} (+${WM.pricing.fmt(x.price)})</span>
                  </label>
                `).join("")}
              </div>` : ""}
          </div>
        `).join("")}
      </div>
      <div class="booking-total" id="dripTotal" style="margin-top: 1.25rem;" hidden></div>`;

    bindOptionButtons(box, items);
    // reveal + populate the running total once a drip is picked
    box.querySelectorAll(".price-option").forEach(btn => btn.addEventListener("click", () => {
      $("#dripTotal").hidden = false;
      updateExtrasFromChecks(box);
    }));
  }

  /* -------- Step 2: Date + slot -------- */
  function renderDate() {
    const today = new Date();
    const max = new Date(today.getTime() + 60*24*60*60*1000); // 60 days
    const fmt = (d) => {
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, "0");
      const day = String(d.getDate()).padStart(2, "0");
      return `${y}-${m}-${day}`;
    };
    const input = $("#bookDate");
    input.min = fmt(today);
    input.max = fmt(max);
    input.value = fmt(today);
    input.addEventListener("change", () => loadSlots(input.value));
  }

  async function loadSlots(date) {
    if (!state.service) return;
    state.date = date;
    state.slot = null;
    $("#nextBtn2").disabled = true;
    const grid = $("#slotGrid");
    grid.innerHTML = `<div class="muted" style="grid-column: 1/-1; text-align: center; padding: 2rem;">Loading available times…</div>`;

    let slots = [];
    try {
      const url = WM.api.url(WM.api.endpoints.availableSlots) +
        `?service=${encodeURIComponent(state.service)}&date=${encodeURIComponent(date)}`;
      const r = await fetch(url);
      if (!r.ok) throw new Error("availability " + r.status);
      slots = await r.json();
    } catch (e) {
      grid.innerHTML = `<div class="muted" style="grid-column: 1/-1; text-align: center; padding: 2rem;">We couldn't load times right now. Please try again in a moment or call the practice.</div>`;
      return;
    }

    const now = Date.now();
    slots = slots.filter(s => new Date(s.start).getTime() > now);

    if (!slots.length) {
      const yogaHint = state.service === "yoga-breathwork"
        ? " Yoga classes run on Tuesdays 17:30 and Fridays 17:00."
        : "";
      grid.innerHTML = `<div class="muted" style="grid-column: 1/-1; text-align: center; padding: 2rem;">No availability on this day. Try another date.${yogaHint}</div>`;
      return;
    }

    grid.innerHTML = slots.map(s => {
      const available = s.available === true;
      return `<button type="button" class="slot${available ? "" : " is-disabled"}" data-slot="${s.start}" ${available ? "" : "disabled aria-disabled=\"true\""}>${s.label}</button>`;
    }).join("");
    grid.querySelectorAll(".slot:not([disabled])").forEach(btn => {
      btn.addEventListener("click", () => {
        grid.querySelectorAll(".slot").forEach(b => b.classList.remove("is-selected"));
        btn.classList.add("is-selected");
        state.slot = btn.dataset.slot;
        $("#nextBtn2").disabled = false;
      });
    });
  }

  /* -------- Step 3: Your details (+ profile login/autofill) -------- */
  function renderAuthPanel() {
    const panel = $("#authPanel");
    if (!panel || !window.WMAuth) return;
    const session = WMAuth.getSession();

    if (session) {
      const m = session.member;
      panel.className = "auth-panel auth-panel--active";
      panel.innerHTML = `
        Booking as <strong>${esc(m.firstName)} ${esc(m.lastName)}</strong> (${esc(m.email)}) — your saved details are filled in below.
        <a href="#" id="authSignOut" style="margin-left: 0.5rem;">Not you? Sign out</a>`;
      panel.querySelector("#authSignOut").addEventListener("click", (e) => {
        e.preventDefault();
        WMAuth.logout(false);
        renderAuthPanel();
      });
      prefillFromMember(m);
      return;
    }

    panel.className = "auth-panel";
    panel.innerHTML = `
      <strong>Booked with us before?</strong> Log in and we'll fill in your details automatically.
      <div class="row g-2" style="margin-top: 0.75rem;">
        <div class="col-md-5"><div class="field" style="margin:0;"><input type="email" id="authEmail" placeholder="Email" autocomplete="email" /></div></div>
        <div class="col-md-4"><div class="field" style="margin:0;"><input type="password" id="authPassword" placeholder="Password" autocomplete="current-password" /></div></div>
        <div class="col-md-3"><button type="button" class="btn-wm btn-wm--primary btn-wm--sm" id="authLoginBtn" style="width: 100%;">Log in</button></div>
      </div>
      <div id="authError" style="color: var(--color-danger); margin-top: 0.5rem;" hidden></div>
      <p class="muted" style="margin: 0.75rem 0 0;">First visit? Book as usual — you can create your profile at the end.</p>`;

    panel.querySelector("#authLoginBtn").addEventListener("click", async () => {
      const btn = panel.querySelector("#authLoginBtn");
      const errEl = panel.querySelector("#authError");
      errEl.hidden = true;
      btn.disabled = true;
      btn.textContent = "Logging in…";
      try {
        await WMAuth.login({ email: $("#authEmail").value, password: $("#authPassword").value });
        renderAuthPanel();
      } catch (err) {
        btn.disabled = false;
        btn.textContent = "Log in";
        errEl.textContent = err.message;
        errEl.hidden = false;
      }
    });
  }

  function prefillFromMember(m) {
    const setIfEmpty = (id, value) => {
      const el = document.getElementById(id);
      if (el && !el.value && value) el.value = value;
    };
    setIfEmpty("fName", m.firstName);
    setIfEmpty("lName", m.lastName);
    setIfEmpty("dob", m.dob);
    setIfEmpty("tel", m.phone);
    setIfEmpty("email", m.email);
    const ma = m.medicalAid || {};
    setIfEmpty("maProvider", ma.provider);
    setIfEmpty("maNumber", ma.memberNumber);
    setIfEmpty("maMember", ma.mainMember);
    setIfEmpty("maDependent", ma.dependentCode);
  }

  function bindPersonal() {
    ["fName","lName","dob","tel","email","maProvider","maNumber","maMember","maDependent"].forEach(id => {
      const el = document.getElementById(id);
      if (!el) return;
      el.addEventListener("input", () => el.closest(".field")?.classList.remove("has-error"));
    });
    const dobEl = document.getElementById("dob");
    if (dobEl) dobEl.max = new Date().toISOString().slice(0, 10);
  }

  function validatePersonal() {
    const required = ["fName","lName","dob","tel","email"];
    let ok = true;
    required.forEach(id => {
      const el = document.getElementById(id);
      const valid = el.checkValidity() && el.value.trim().length > 0;
      el.closest(".field")?.classList.toggle("has-error", !valid);
      if (!valid) ok = false;
    });
    if (ok) {
      state.personal = {
        firstName: fName.value.trim(),
        lastName: lName.value.trim(),
        dob: dob.value,
        phone: tel.value.trim(),
        email: email.value.trim(),
        medicalAid: {
          provider: maProvider.value.trim() || null,
          memberNumber: maNumber.value.trim() || null,
          mainMember: maMember.value.trim() || null,
          dependentCode: maDependent.value.trim() || null
        }
      };
    }
    return ok;
  }

  /* -------- Step 4: Consent -------- */
  function validateConsent() {
    const consentEl = document.getElementById("consent");
    const valid = consentEl.checked;
    consentEl.closest(".checkbox-wm")?.classList.toggle("has-error", !valid);
    state.consent = valid;
    return valid;
  }

  /* -------- Booking confirmation email -------- */
  async function sendNotificationEmail(email, name, message, event) {
    try {
      const r = await fetch(WM.notificationApi.url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          appName: "wellmed",
          notificationType: "booking_confirmation",
          recipientType: "customer",
          data: { email, name, companyName: WM.brand.name, message, event }
        })
      });
      if (!r.ok) throw new Error("notification_failed " + r.status);
    } catch (e) {
      // Best-effort: the booking itself already succeeded, so a failed
      // confirmation email shouldn't block the user or look like a failed booking.
      console.error("Failed to send booking confirmation email to " + email, e);
    }
  }

  async function sendBookingConfirmationEmail(serviceTitle, startDate) {
    const duration = WM.serviceDurations[state.service] || 30;
    const endDate = new Date(startDate.getTime() + duration * 60000);
    const patientName = `${state.personal.firstName} ${state.personal.lastName}`.trim();
    const info = pricingInfo();
    const priceText = info ? ` (${info.name} — ${WM.pricing.fmt(info.total)}, payable at the practice)` : "";
    const event = {
      title: `${serviceTitle}${info ? " · " + info.name : ""} — ${WM.brand.name}`,
      location: WM.brand.address,
      startTime: startDate.toISOString(),
      endTime: endDate.toISOString()
    };
    await Promise.all([
      sendNotificationEmail(
        state.personal.email,
        patientName,
        `Hi ${state.personal.firstName}, your ${serviceTitle} appointment${priceText} with ${WM.brand.doctor} is confirmed. We look forward to seeing you at ${WM.brand.address}.`,
        event
      ),
      sendNotificationEmail(
        WM.brand.email,
        WM.brand.doctor,
        `New booking: ${patientName} has booked a ${serviceTitle} appointment${priceText} on ${startDate.toLocaleString("en-ZA")}.`,
        event
      )
    ]);
  }

  /* -------- Submit -------- */
  async function submitBooking() {
    const payload = {
      service: state.service,
      requestedSlot: state.slot,
      personal: state.personal,
      pricing: state.pricing,
      consent: state.consent,
      submittedAt: new Date().toISOString()
    };

    const idemKey = (crypto && crypto.randomUUID) ? crypto.randomUUID() : String(Date.now()) + Math.random();
    const r = await fetch(WM.api.url(WM.api.endpoints.submitBooking), {
      method: "POST",
      headers: { "Content-Type": "application/json", "Idempotency-Key": idemKey },
      body: JSON.stringify(payload)
    });

    if (!r.ok) {
      const err = await r.json().catch(() => ({}));
      if (err.error === "slot_unavailable") throw new Error("That slot was just taken. Please pick another time.");
      if (err.error === "validation")       throw new Error("Some details are invalid. Please review the form.");
      if (err.error === "rate_limited")     throw new Error("Too many attempts. Please wait a moment and try again.");
      throw new Error(err.error || "submit_failed");
    }

    state.result = await r.json();

    // Show confirmation
    const svc = WM.services.find(s => s.slug === state.service)?.title || state.service;
    const dt = new Date(state.slot);
    const fmtDate = dt.toLocaleDateString("en-ZA", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
    const fmtTime = dt.toLocaleTimeString("en-ZA", { hour: "2-digit", minute: "2-digit", hour12: false });

    await sendBookingConfirmationEmail(svc, dt);

    const info = pricingInfo();
    document.getElementById("confSummary").innerHTML = `
      <div style="font-size: var(--fs-xs); letter-spacing: 0.18em; text-transform: uppercase; color: var(--color-olive); margin-bottom: 0.5rem;">Your appointment</div>
      <h3 style="margin: 0 0 0.5rem;">${esc(svc)}${info ? ` · ${esc(info.name)}` : ""}</h3>
      <p style="margin: 0; color: var(--color-ink);">${fmtDate} at ${fmtTime}</p>
      ${info ? `
        <hr style="border: 0; border-top: 1px solid var(--color-line-soft); margin: 0.9rem 0;" />
        ${info.extras.map(x => `<p style="margin: 0; font-size: var(--fs-sm);">+ ${esc(x.name)} — ${WM.pricing.fmt(x.price)}</p>`).join("")}
        <p style="margin: 0.35rem 0 0; font-weight: 600; color: var(--color-olive-deep);">Total: ${WM.pricing.fmt(info.total)} <span style="font-weight: 400; color: var(--color-ink-soft);">(payable at the practice)</span></p>
      ` : ""}
    `;
    document.getElementById("confName").textContent = state.personal.firstName;
    document.getElementById("confEmail").textContent = state.personal.email;
    renderProfileOffer();
  }

  /* -------- Step 5: offer to save a profile (first-time visitors) -------- */
  function renderProfileOffer() {
    const box = document.getElementById("profileOffer");
    if (!box || !window.WMAuth) return;
    if (WMAuth.isAuthenticated()) { box.innerHTML = ""; return; }

    box.innerHTML = `
      <div class="auth-panel" style="max-width: 460px; margin: 2rem auto 0; text-align: left;">
        <h4 style="margin: 0 0 0.35rem; font-size: var(--fs-md); font-family: var(--font-sans);">Save your details for next time</h4>
        <p class="muted" style="margin: 0 0 0.9rem;">Create a password and your next booking takes seconds — no forms to refill.</p>
        <div class="field"><input type="password" id="profPassword" placeholder="Choose a password (min 8 characters)" autocomplete="new-password" minlength="8" /></div>
        <div class="field"><input type="password" id="profPassword2" placeholder="Confirm password" autocomplete="new-password" minlength="8" /></div>
        <button type="button" class="btn-wm btn-wm--primary btn-wm--sm" id="profCreateBtn">Create my profile</button>
        <div id="profError" style="color: var(--color-danger); margin-top: 0.5rem;" hidden></div>
      </div>`;

    box.querySelector("#profCreateBtn").addEventListener("click", async () => {
      const errEl = box.querySelector("#profError");
      const pw = box.querySelector("#profPassword").value;
      const pw2 = box.querySelector("#profPassword2").value;
      errEl.hidden = true;
      if (pw.length < 8) { errEl.textContent = "Password must be at least 8 characters."; errEl.hidden = false; return; }
      if (pw !== pw2)    { errEl.textContent = "Passwords don't match."; errEl.hidden = false; return; }
      const btn = box.querySelector("#profCreateBtn");
      btn.disabled = true;
      btn.textContent = "Creating…";
      try {
        await WMAuth.register({ ...state.personal, password: pw, medicalAid: state.personal.medicalAid });
        box.innerHTML = `<div class="auth-panel auth-panel--active" style="max-width: 460px; margin: 2rem auto 0;">Profile created — you're signed in. Next time, just log in and book.</div>`;
      } catch (err) {
        btn.disabled = false;
        btn.textContent = "Create my profile";
        errEl.textContent = err.message;
        errEl.hidden = false;
      }
    });
  }

  /* -------- Step navigation -------- */
  function goTo(n) {
    state.step = n;
    $$(".booking-step").forEach((el, i) => el.style.display = (i+1 === n) ? "block" : "none");
    $$(".step").forEach((el, i) => {
      el.classList.toggle("is-active", i+1 === n);
      el.classList.toggle("is-done", i+1 < n);
    });
    if (n === 3) renderAuthPanel();
    const anchor = document.getElementById("bookingTop");
    if (anchor) window.scrollTo({ top: anchor.offsetTop - 80, behavior: "smooth" });
  }

  function bindNav() {
    $("#nextBtn1").addEventListener("click", () => {
      if (!state.service) return;
      goTo(2);
      loadSlots($("#bookDate").value);
    });
    $("#prevBtn2").addEventListener("click", () => goTo(1));
    $("#nextBtn2").addEventListener("click", () => { if (state.slot) goTo(3); });
    $("#prevBtn3").addEventListener("click", () => goTo(2));
    $("#nextBtn3").addEventListener("click", () => { if (validatePersonal()) goTo(4); });
    $("#prevBtn4").addEventListener("click", () => goTo(3));
    $("#submitBtn").addEventListener("click", async () => {
      if (!validateConsent()) return;
      const btn = document.getElementById("submitBtn");
      btn.disabled = true;
      btn.textContent = "Submitting…";
      try {
        await submitBooking();
        goTo(5);
      } catch (e) {
        btn.disabled = false;
        btn.textContent = "Confirm Appointment →";
        alert(e && e.message ? e.message : "Something went wrong. Please try again or call the practice.");
      }
    });
  }

  document.addEventListener("DOMContentLoaded", () => {
    if (MODE === "iv") {
      renderDripMenu();
      $("#nextBtn1").disabled = true;
    } else {
      renderServices();
    }
    renderDate();
    bindPersonal();
    bindNav();
  });
})();
