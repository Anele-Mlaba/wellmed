/* WellMed — Multi-step booking flow
   Steps: 1 service · 2 slot · 3 personal + medical aid · 4 medical + consent · 5 confirmation
*/
(function () {
  const state = {
    step: 1,
    service: null,
    date: null,
    slot: null,
    personal: {},
    medical: {},
    consent: false
  };

  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => document.querySelectorAll(sel);

  /* -------- Step 1: Service select -------- */
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
        wrap.querySelectorAll(".service-tile").forEach(t => { t.classList.remove("is-selected"); t.setAttribute("aria-pressed","false"); });
        tile.classList.add("is-selected");
        tile.setAttribute("aria-pressed","true");
        state.service = tile.dataset.slug;
        $("#nextBtn1").disabled = false;
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
      grid.innerHTML = `<div class="muted" style="grid-column: 1/-1; text-align: center; padding: 2rem;">No availability on this day. Try another date.</div>`;
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

  /* -------- Step 3: Personal + Medical Aid -------- */
  function bindPersonal() {
    const ids = ["fName","lName","idNum","tel","email","emergencyName","emergencyTel","maProvider","maNumber","maMember","maDependent"];
    ids.forEach(id => {
      const el = document.getElementById(id);
      if (!el) return;
      el.addEventListener("input", () => el.closest(".field")?.classList.remove("has-error"));
    });
  }

  function validatePersonal() {
    const required = ["fName","lName","idNum","tel","email","emergencyName","emergencyTel"];
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
        idOrPassport: idNum.value.trim(),
        phone: tel.value.trim(),
        email: email.value.trim(),
        emergencyContact: { name: emergencyName.value.trim(), phone: emergencyTel.value.trim() },
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

  /* -------- Step 4: Medical history + consent -------- */
  function validateMedical() {
    const consentEl = document.getElementById("consent");
    const popiaEl = document.getElementById("popia");
    let ok = true;
    [consentEl, popiaEl].forEach(el => {
      const valid = el.checked;
      el.closest(".checkbox-wm")?.classList.toggle("has-error", !valid);
      if (!valid) ok = false;
    });
    if (ok) {
      state.medical = {
        existingConditions: document.getElementById("conditions").value.trim(),
        allergies: document.getElementById("allergies").value.trim(),
        currentMeds: document.getElementById("meds").value.trim(),
        reasonForVisit: document.getElementById("reason").value.trim(),
        notes: document.getElementById("notes").value.trim(),
        marketingOptIn: document.getElementById("marketing").checked
      };
      state.consent = true;
    }
    return ok;
  }

  /* -------- Booking confirmation email -------- */
  // The availability API doesn't expose per-service appointment length, so we
  // assume the standard slot length used to generate booking slots.
  const APPOINTMENT_DURATION_MINUTES = 30;

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
    const endDate = new Date(startDate.getTime() + APPOINTMENT_DURATION_MINUTES * 60000);
    const patientName = `${state.personal.firstName} ${state.personal.lastName}`.trim();
    const event = {
      title: `${serviceTitle} — ${WM.brand.name}`,
      location: WM.brand.address,
      startTime: startDate.toISOString(),
      endTime: endDate.toISOString()
    };
    await Promise.all([
      sendNotificationEmail(
        state.personal.email,
        patientName,
        `Hi ${state.personal.firstName}, your ${serviceTitle} appointment with ${WM.brand.doctor} is confirmed. We look forward to seeing you at ${WM.brand.address}.`,
        event
      ),
      sendNotificationEmail(
        WM.brand.email,
        WM.brand.doctor,
        `New booking: ${patientName} has booked a ${serviceTitle} appointment on ${startDate.toLocaleString("en-ZA")}.`,
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
      medical: state.medical,
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

    document.getElementById("confSummary").innerHTML = `
      <div style="font-size: var(--fs-xs); letter-spacing: 0.18em; text-transform: uppercase; color: var(--color-olive); margin-bottom: 0.5rem;">Your appointment</div>
      <h3 style="margin: 0 0 0.5rem;">${svc}</h3>
      <p style="margin: 0; color: var(--color-ink);">${fmtDate} at ${fmtTime}</p>
    `;
    document.getElementById("confName").textContent = state.personal.firstName;
    document.getElementById("confEmail").textContent = state.personal.email;
  }

  /* -------- Step navigation -------- */
  function goTo(n) {
    state.step = n;
    $$(".booking-step").forEach((el, i) => el.style.display = (i+1 === n) ? "block" : "none");
    $$(".step").forEach((el, i) => {
      el.classList.toggle("is-active", i+1 === n);
      el.classList.toggle("is-done", i+1 < n);
    });
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
      if (!validateMedical()) return;
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
    renderServices();
    renderDate();
    bindPersonal();
    bindNav();
  });
})();
