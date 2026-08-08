/* WellMed — Admin dashboard
   Wired to /api/admin/* (see docs/BACKEND_BUILD_PROMPT.md).
   Shows a login overlay when no JWT is present or the token is rejected.
*/
(function () {
  let bookings = [];
  let pricingCatalog = null;   // { categories, updatedAt } from GET /api/pricing
  let pricingLoaded = false;   // fetched at least once (Pricing tab lazy-loads)
  const $ = (s) => document.querySelector(s);

  // Escape user-supplied strings before dropping them into HTML/attributes.
  const esc = (v) => String(v == null ? "" : v)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

  // R1 234 — integer rand with thin-space thousands.
  const fmtRand = (n) => (typeof n === "number" && isFinite(n))
    ? "R" + Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ")
    : "—";

  const patientNameOf = (b) => {
    if (typeof b.patient === "string" && b.patient) return b.patient;
    const p = (b.patient && typeof b.patient === "object") ? b.patient : (b.personal || {});
    return [p.firstName, p.lastName].filter(Boolean).join(" ") || "—";
  };

  async function load() {
    if (!sessionStorage.getItem("wm_admin_token")) {
      showLogin();
      return;
    }
    try {
      const r = await fetch(WM.api.url(WM.api.endpoints.listBookings), { headers: WM.api.authHeaders() });
      if (r.status === 401 || r.status === 403) {
        sessionStorage.removeItem("wm_admin_token");
        showLogin();
        return;
      }
      if (!r.ok) throw new Error("listBookings " + r.status);
      bookings = await r.json();
    } catch (e) {
      alert("Couldn't load bookings: " + (e.message || e));
      bookings = [];
    }
    render();
  }

  function showLogin() {
    if (document.getElementById("wmLoginOverlay")) return;
    const overlay = document.createElement("div");
    overlay.id = "wmLoginOverlay";
    overlay.style.cssText = "position:fixed; inset:0; background:rgba(15,23,18,0.85); display:grid; place-items:center; z-index:9999;";
    overlay.innerHTML = `
      <form id="wmLoginForm" class="form-wm" style="background:var(--color-cream); padding:2rem 2.25rem; border-radius:var(--radius-md); width:min(360px, 92vw); box-shadow:0 12px 40px rgba(0,0,0,0.35);">
        <h3 style="margin:0 0 0.25rem;">Admin sign in</h3>
        <p class="muted" style="font-size: var(--fs-sm); margin: 0 0 1.25rem;">Restricted area · Dr Moodley</p>
        <div class="field"><label for="wmLoginEmail">Email</label><input id="wmLoginEmail" type="email" required autocomplete="username" /></div>
        <div class="field"><label for="wmLoginPassword">Password</label><input id="wmLoginPassword" type="password" required autocomplete="current-password" /></div>
        <div id="wmLoginError" style="display:none; color: var(--color-warn); font-size: var(--fs-sm); margin-bottom: 0.75rem;"></div>
        <button type="submit" class="btn-wm btn-wm--primary" style="width:100%;">Sign in</button>
      </form>
    `;
    document.body.appendChild(overlay);
    document.getElementById("wmLoginForm").addEventListener("submit", async (e) => {
      e.preventDefault();
      const email = document.getElementById("wmLoginEmail").value.trim();
      const password = document.getElementById("wmLoginPassword").value;
      const errEl = document.getElementById("wmLoginError");
      const btn = e.target.querySelector("button[type='submit']");
      errEl.style.display = "none";
      btn.disabled = true; btn.textContent = "Signing in…";
      try {
        const r = await fetch(WM.api.url(WM.api.endpoints.adminLogin), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, password })
        });
        if (!r.ok) throw new Error(r.status === 401 ? "Invalid email or password." : "Sign-in failed (" + r.status + ").");
        const data = await r.json();
        if (!data.token) throw new Error("Sign-in succeeded but no token returned.");
        sessionStorage.setItem("wm_admin_token", data.token);
        overlay.remove();
        load();
      } catch (err) {
        errEl.textContent = err.message || "Sign-in failed.";
        errEl.style.display = "block";
        btn.disabled = false; btn.textContent = "Sign in";
      }
    });
  }

  function render() {
    renderKpis();
    renderTable();
    renderServiceMix();
    renderDemographics();
    renderIv();
  }

  /* ---------- View tabs (Appointments / IV Therapy / Pricing) ---------- */

  function initTabs() {
    const setView = (view) => {
      document.querySelectorAll(".admin-view").forEach(v => { v.hidden = v.dataset.view !== view; });
      document.querySelectorAll(".admin-tab[data-view]").forEach(t => t.classList.toggle("is-active", t.dataset.view === view));
      document.querySelectorAll(".admin-sidebar nav a[data-view]").forEach(a => a.classList.toggle("is-active", a.dataset.view === view));
      if (view === "pricing" && !pricingLoaded) loadPricing();
    };
    document.querySelectorAll(".admin-tab[data-view], .admin-sidebar nav a[data-view]").forEach(el => {
      el.addEventListener("click", (e) => { e.preventDefault(); setView(el.dataset.view); });
    });
  }

  function renderKpis() {
    const total = bookings.length;
    const noshow = bookings.filter(b => b.status === "noshow").length;
    const completed = bookings.filter(b => b.status === "completed").length;
    const upcoming = bookings.filter(b => ["confirmed","pending"].includes(b.status)).length;
    const noShowRate = total ? (noshow / total * 100).toFixed(1) : "0.0";

    $("#kpiTotal").textContent = total;
    $("#kpiUpcoming").textContent = upcoming;
    $("#kpiCompleted").textContent = completed;
    $("#kpiNoShow").textContent = noShowRate + "%";
  }

  function renderTable() {
    const filterStatus = $("#fStatus").value;
    const filterService = $("#fService").value;
    const filterDate = $("#fDate").value;

    const filtered = bookings.filter(b => {
      if (filterStatus && b.status !== filterStatus) return false;
      if (filterService && b.service !== filterService) return false;
      if (filterDate && !b.slot.startsWith(filterDate)) return false;
      return true;
    });

    const titleOf = (s) => WM.services.find(x => x.slug === s)?.title || s;
    const fmt = (iso) => {
      const d = new Date(iso);
      return d.toLocaleDateString("en-ZA", { day: "2-digit", month: "short" }) + " · " + d.toLocaleTimeString("en-ZA", { hour: "2-digit", minute: "2-digit", hour12: false });
    };

    const tbody = $("#bookingsBody");
    if (!filtered.length) {
      tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; color: var(--color-muted); padding: 2rem;">No bookings match those filters.</td></tr>`;
      return;
    }
    tbody.innerHTML = filtered.map(b => `
      <tr>
        <td><strong>${b.patient}</strong><br/><span class="muted" style="font-size: var(--fs-xs);">${b.id}</span></td>
        <td>${titleOf(b.service)}</td>
        <td>${fmt(b.slot)}</td>
        <td><span class="status-pill status-pill--${b.status}">${b.status}</span></td>
        <td>${b.medicalAid}</td>
        <td>
          <button class="btn-wm btn-wm--ghost btn-wm--sm" data-action="view" data-id="${b.id}">View</button>
          <button class="btn-wm btn-wm--ghost btn-wm--sm" data-action="reschedule" data-id="${b.id}">Reschedule</button>
        </td>
      </tr>
    `).join("");

    tbody.querySelectorAll("button").forEach(btn => btn.addEventListener("click", () => {
      const action = btn.dataset.action;
      const id = btn.dataset.id;
      if (action === "view") openBookingModal(id);
      else if (action === "reschedule") {
        const b = bookings.find(x => (x.id || x.shortId) === id);
        if (b) rescheduleBooking(b);
      }
    }));
  }

  /* ---------- IV Therapy view (drips run concurrently in multiple chairs) ---------- */

  function renderIv() {
    if (!$("#ivBody")) return;
    renderIvKpis();
    renderIvTable();
  }

  function renderIvKpis() {
    const iv = bookings.filter(b => b.service === "iv-therapy");
    const now = new Date();
    const dayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const dayEnd = dayStart + 24 * 60 * 60 * 1000;
    const slotMs = (b) => new Date(b.slot || b.slotStart).getTime();

    const today = iv.filter(b => {
      const t = slotMs(b);
      return t >= dayStart && t < dayEnd && b.status !== "cancelled";
    }).length;
    const upcoming = iv.filter(b => slotMs(b) > now.getTime() && ["pending", "confirmed"].includes(b.status)).length;
    const completed = iv.filter(b => b.status === "completed");
    const revenue = completed.reduce((sum, b) =>
      sum + ((b.pricing && typeof b.pricing.total === "number") ? b.pricing.total : 0), 0);

    $("#kpiIvToday").textContent = today;
    $("#kpiIvUpcoming").textContent = upcoming;
    $("#kpiIvCompleted").textContent = completed.length;
    $("#kpiIvRevenue").textContent = fmtRand(revenue);
  }

  function renderIvTable() {
    const range = $("#ivRange").value;
    const now = new Date();
    const dayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const dayEnd = dayStart + 24 * 60 * 60 * 1000;
    const weekEnd = dayStart + 7 * 24 * 60 * 60 * 1000;
    const slotMs = (b) => new Date(b.slot || b.slotStart).getTime();

    const rows = bookings
      .filter(b => b.service === "iv-therapy")
      .filter(b => {
        const t = slotMs(b);
        if (range === "today") return t >= dayStart && t < dayEnd;
        if (range === "week") return t >= dayStart && t < weekEnd;
        if (range === "upcoming") return t > now.getTime();
        return true;
      })
      .sort((a, b) => slotMs(a) - slotMs(b));

    const fmt = (iso) => {
      if (!iso) return "—";
      const d = new Date(iso);
      return d.toLocaleDateString("en-ZA", { day: "2-digit", month: "short" }) + " · " + d.toLocaleTimeString("en-ZA", { hour: "2-digit", minute: "2-digit", hour12: false });
    };

    const tbody = $("#ivBody");
    if (!rows.length) {
      tbody.innerHTML = `<tr><td colspan="7" style="text-align:center; color: var(--color-muted); padding: 2rem;">No IV therapy bookings in this range.</td></tr>`;
      return;
    }
    tbody.innerHTML = rows.map(b => {
      const pr = (b.pricing && typeof b.pricing === "object") ? b.pricing : null;
      const extras = (pr && Array.isArray(pr.extras) && pr.extras.length)
        ? pr.extras.map(x => esc(x.name)).join(", ") : "—";
      const id = b.id || b.shortId;
      return `
      <tr data-id="${esc(id)}" style="cursor:pointer;">
        <td><span class="muted" style="font-size: var(--fs-xs);">${esc(b.shortId || id)}</span></td>
        <td><strong>${esc(patientNameOf(b))}</strong></td>
        <td>${pr && pr.itemName ? esc(pr.itemName) : "—"}</td>
        <td>${extras}</td>
        <td>${pr && typeof pr.total === "number" ? fmtRand(pr.total) : "—"}</td>
        <td>${fmt(b.slot || b.slotStart)}</td>
        <td><span class="status-pill status-pill--${esc(b.status)}">${esc(b.status)}</span></td>
      </tr>`;
    }).join("");

    tbody.querySelectorAll("tr[data-id]").forEach(tr =>
      tr.addEventListener("click", () => openBookingModal(tr.dataset.id)));
  }

  async function openBookingModal(id) {
    const existing = document.getElementById("wmBookingModal");
    if (existing) existing.remove();

    const overlay = document.createElement("div");
    overlay.id = "wmBookingModal";
    overlay.className = "wm-modal";
    overlay.innerHTML = `
      <div class="wm-modal__panel">
        <div class="wm-modal__loading">Loading booking…</div>
      </div>`;
    overlay.addEventListener("click", (e) => { if (e.target === overlay) overlay.remove(); });
    document.body.appendChild(overlay);

    let booking;
    try {
      const r = await fetch(WM.api.url(WM.api.endpoints.getBooking, { id }), { headers: WM.api.authHeaders() });
      if (r.status === 401 || r.status === 403) {
        overlay.remove();
        sessionStorage.removeItem("wm_admin_token");
        showLogin();
        return;
      }
      if (!r.ok) throw new Error("getBooking " + r.status);
      booking = await r.json();
    } catch (e) {
      overlay.querySelector(".wm-modal__panel").innerHTML = `
        <div class="wm-modal__header"><h3>Couldn't load booking</h3><button class="wm-modal__close" type="button">×</button></div>
        <div class="wm-modal__body"><p class="muted">${e.message || e}</p></div>`;
      overlay.querySelector(".wm-modal__close").addEventListener("click", () => overlay.remove());
      return;
    }

    renderBookingModal(overlay, booking);
  }

  function renderBookingModal(overlay, booking) {
    const titleOf = (s) => WM.services.find(x => x.slug === s)?.title || s;
    const slotFmt = (iso) => {
      if (!iso) return "—";
      const d = new Date(iso);
      return d.toLocaleDateString("en-ZA", { weekday: "long", day: "numeric", month: "long", year: "numeric" })
        + " · " + d.toLocaleTimeString("en-ZA", { hour: "2-digit", minute: "2-digit", hour12: false });
    };

    const asObj = (v) => (v && typeof v === "object" && !Array.isArray(v)) ? v : {};
    const asStr = (v) => (typeof v === "string" ? v : "");

    // Detail responses sometimes nest the patient as an object; list responses send a name string.
    const patientObj = asObj(booking.patient) || {};
    const p = { ...asObj(booking.personal), ...patientObj };
    const m = { ...asObj(booking.medical), ...asObj(booking.intake) };
    const ec = asObj(p.emergencyContact);
    const ma = asObj(p.medicalAid);

    const patientName =
      asStr(booking.patient) ||
      [p.firstName, p.lastName].filter(Boolean).join(" ") ||
      "—";
    const medicalAidLabel =
      ma.provider ? `${ma.provider}${ma.memberNumber ? " · " + ma.memberNumber : ""}` :
      asStr(booking.medicalAid) || "";
    const shortId = booking.shortId || booking.id || "—";

    const row = (label, value) => value
      ? `<div class="wm-modal__row"><dt>${label}</dt><dd>${value}</dd></div>` : "";

    // Selected drip / option + total, when the booking carries a pricing snapshot.
    const pr = asObj(booking.pricing);
    const pricingBlock = (pr.itemName || pr.total != null) ? `
      <div class="price-option__extras" style="margin-top: 1.25rem;">
        <p class="muted" style="font-size: var(--fs-xs); letter-spacing: 0.14em; text-transform: uppercase; margin: 0 0 0.5rem;">${booking.service === "iv-therapy" ? "Selected drip" : "Selected option"}</p>
        <div class="d-flex justify-content-between" style="gap: 1rem;">
          <span>${esc(pr.itemName || "—")}</span>
          <strong>${typeof pr.basePrice === "number" ? fmtRand(pr.basePrice) : ""}</strong>
        </div>
        ${(Array.isArray(pr.extras) ? pr.extras : []).map(x => `
          <div class="d-flex justify-content-between" style="gap: 1rem; font-size: var(--fs-sm); color: var(--color-ink-soft);">
            <span>+ ${esc(x.name)}</span>
            <span>${typeof x.price === "number" ? fmtRand(x.price) : ""}</span>
          </div>`).join("")}
        <div class="d-flex justify-content-between" style="gap: 1rem; border-top: 1px solid var(--color-line-soft); margin-top: 0.5rem; padding-top: 0.5rem;">
          <span>Total</span>
          <strong>${typeof pr.total === "number" ? fmtRand(pr.total) : "—"}</strong>
        </div>
      </div>` : "";

    const status = booking.status || "pending";
    const isTerminal = ["completed", "noshow", "cancelled"].includes(status);
    const actions = isTerminal ? "" : `
      <div class="wm-modal__actions">
        <button class="btn-wm btn-wm--ghost btn-wm--sm" data-status="completed">Mark Completed</button>
        <button class="btn-wm btn-wm--ghost btn-wm--sm" data-status="noshow">Mark No-show</button>
        <button class="btn-wm btn-wm--ghost btn-wm--sm" data-status="cancelled">Cancel Booking</button>
        <button class="btn-wm btn-wm--primary btn-wm--sm" data-action="reschedule">Reschedule</button>
      </div>`;

    overlay.querySelector(".wm-modal__panel").innerHTML = `
      <div class="wm-modal__header">
        <div>
          <span class="eyebrow">${shortId}</span>
          <h3 style="margin: 0.25rem 0 0;">${patientName}</h3>
        </div>
        <button class="wm-modal__close" type="button" aria-label="Close">×</button>
      </div>
      <div class="wm-modal__body">
        <dl class="wm-modal__grid">
          ${row("Service", titleOf(booking.service))}
          ${row("Slot", slotFmt(booking.slot || booking.slotStart))}
          ${row("Status", `<span class="status-pill status-pill--${status}">${status}</span>`)}
          ${row("Source", booking.source)}
          ${row("Email", p.email)}
          ${row("Phone", p.phone)}
          ${row("Date of birth", p.dob)}
          ${row("SA ID / Passport", p.idOrPassport)}
          ${row("Emergency contact", ec.name ? `${ec.name} · ${ec.phone || "—"}` : null)}
          ${row("Medical aid", medicalAidLabel)}
          ${row("Reason for visit", m.reasonForVisit)}
          ${row("Existing conditions", m.existingConditions)}
          ${row("Allergies", m.allergies)}
          ${row("Current meds", m.currentMeds)}
          ${row("Notes", m.notes)}
        </dl>
        ${pricingBlock}
        ${actions}
      </div>`;

    overlay.querySelector(".wm-modal__close").addEventListener("click", () => overlay.remove());
    overlay.querySelectorAll("[data-status]").forEach(btn => {
      btn.addEventListener("click", () => patchBooking(booking.id || booking.shortId, { status: btn.dataset.status }, overlay));
    });
    const rsch = overlay.querySelector('[data-action="reschedule"]');
    if (rsch) rsch.addEventListener("click", () => {
      overlay.remove();
      rescheduleBooking(booking);
    });
  }

  async function rescheduleBooking(booking) {
    const service = booking.service;
    const id = booking.id || booking.shortId;
    if (!service || !id) { alert("Missing booking service or id."); return; }
    const titleOf = (s) => WM.services.find(x => x.slug === s)?.title || s;

    const overlay = document.createElement("div");
    overlay.className = "wm-modal";
    overlay.id = "wmRescheduleModal";
    overlay.innerHTML = `
      <div class="wm-modal__panel">
        <div class="wm-modal__header">
          <div>
            <span class="eyebrow">Reschedule · ${id}</span>
            <h3 style="margin: 0.25rem 0 0;">${titleOf(service)}</h3>
          </div>
          <button class="wm-modal__close" type="button" aria-label="Close">×</button>
        </div>
        <div class="wm-modal__body">
          <div class="form-wm">
            <div class="field" style="margin-bottom: 1rem;">
              <label for="rschDate">New date</label>
              <input id="rschDate" type="date" />
            </div>
            <p class="muted" style="font-size: var(--fs-xs); letter-spacing: 0.14em; text-transform: uppercase; margin: 0 0 0.75rem;">Available times</p>
            <div id="rschSlotGrid" class="slot-grid"></div>
          </div>
          <div class="wm-modal__actions" style="justify-content: space-between; align-items: center;">
            <label style="display:flex; align-items:center; gap:0.5rem; font-size: var(--fs-sm); margin: 0;">
              <input type="checkbox" id="rschNotify" checked /> Notify patient
            </label>
            <button id="rschConfirm" class="btn-wm btn-wm--primary btn-wm--sm" disabled>Confirm reschedule</button>
          </div>
        </div>
      </div>`;
    overlay.addEventListener("click", (e) => { if (e.target === overlay) overlay.remove(); });
    document.body.appendChild(overlay);
    overlay.querySelector(".wm-modal__close").addEventListener("click", () => overlay.remove());

    const today = new Date();
    const max = new Date(today.getTime() + 60*24*60*60*1000);
    const fmt = (d) => {
      const y = d.getFullYear();
      const mo = String(d.getMonth() + 1).padStart(2, "0");
      const da = String(d.getDate()).padStart(2, "0");
      return `${y}-${mo}-${da}`;
    };
    const dateInput = overlay.querySelector("#rschDate");
    dateInput.min = fmt(today);
    dateInput.max = fmt(max);
    dateInput.value = fmt(today);

    const grid = overlay.querySelector("#rschSlotGrid");
    const confirmBtn = overlay.querySelector("#rschConfirm");
    let selectedSlot = null;

    async function loadSlots(date) {
      selectedSlot = null;
      confirmBtn.disabled = true;
      grid.innerHTML = `<div class="muted" style="grid-column: 1/-1; text-align: center; padding: 1.5rem;">Loading available times…</div>`;
      let slots = [];
      try {
        const url = WM.api.url(WM.api.endpoints.availableSlots) +
          `?service=${encodeURIComponent(service)}&date=${encodeURIComponent(date)}`;
        const r = await fetch(url);
        if (!r.ok) throw new Error("availability " + r.status);
        slots = await r.json();
      } catch (_) {
        grid.innerHTML = `<div class="muted" style="grid-column: 1/-1; text-align: center; padding: 1.5rem;">We couldn't load times right now. Try again in a moment.</div>`;
        return;
      }
      const now = Date.now();
      slots = slots.filter(s => new Date(s.start).getTime() > now);
      if (!slots.length) {
        grid.innerHTML = `<div class="muted" style="grid-column: 1/-1; text-align: center; padding: 1.5rem;">No availability on this day. Try another date.</div>`;
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
          selectedSlot = btn.dataset.slot;
          confirmBtn.disabled = false;
        });
      });
    }

    dateInput.addEventListener("change", () => loadSlots(dateInput.value));
    loadSlots(dateInput.value);

    confirmBtn.addEventListener("click", async () => {
      if (!selectedSlot) return;
      const notify = overlay.querySelector("#rschNotify").checked;
      confirmBtn.disabled = true;
      confirmBtn.textContent = "Saving…";
      await patchBooking(id, { newSlot: selectedSlot, notifyPatient: notify }, overlay);
    });
  }

  async function patchBooking(id, body, overlay) {
    try {
      const r = await fetch(WM.api.url(WM.api.endpoints.updateBooking, { id }), {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...WM.api.authHeaders() },
        body: JSON.stringify(body)
      });
      if (r.status === 401 || r.status === 403) {
        sessionStorage.removeItem("wm_admin_token");
        if (overlay) overlay.remove();
        showLogin();
        return;
      }
      if (!r.ok) {
        const err = await r.json().catch(() => ({}));
        throw new Error(err.error || ("updateBooking " + r.status));
      }
      if (overlay) overlay.remove();
      await load();
    } catch (e) {
      alert("Couldn't update booking: " + (e.message || e));
    }
  }

  /* ---------- Pricing editor (whole-catalog PUT to /api/admin/pricing) ---------- */

  function setPricingStatus(msg, kind) {
    const el = $("#pricingStatus");
    if (!el) return;
    el.textContent = msg || "";
    el.style.color = kind === "error" ? "var(--color-warn)" : "var(--color-olive-deep)";
  }

  async function loadPricing() {
    const box = $("#pricingEditor");
    if (!box) return;
    box.innerHTML = `<p class="muted" style="padding: 1rem 0;">Loading price catalog…</p>`;
    setPricingStatus("");
    try {
      const r = await fetch(WM.api.url(WM.api.endpoints.pricing));
      if (!r.ok) throw new Error("pricing " + r.status);
      pricingCatalog = await r.json();
      pricingLoaded = true;
      renderPricingEditor();
    } catch (e) {
      box.innerHTML = `<p class="muted" style="padding: 1rem 0;">Couldn't load pricing: ${esc(e.message || e)}</p>`;
    }
  }

  function renderPricingEditor() {
    const box = $("#pricingEditor");
    const cats = (pricingCatalog && pricingCatalog.categories) || [];
    if (!cats.length) {
      box.innerHTML = `<p class="muted" style="padding: 1rem 0;">No pricing categories found.</p>`;
      return;
    }

    const inputCss = "width:100%; padding:0.35rem 0.5rem; border:1px solid var(--color-line-soft); border-radius: var(--radius-sm, 6px); font-size: var(--fs-sm); background: var(--color-white, #fff);";

    const scheduleHtml = (cat) => {
      if (!Array.isArray(cat.schedule) || !cat.schedule.length) return "";
      return `
        <div style="margin-bottom: 1rem;">
          <p class="muted" style="font-size: var(--fs-xs); letter-spacing: 0.14em; text-transform: uppercase; margin: 0 0 0.5rem;">Class schedule</p>
          ${cat.schedule.map((s, i) => `
            <div class="d-flex gap-2" style="margin-bottom: 0.5rem;" data-sched="${i}">
              <input type="text" data-field="day" value="${esc(s.day)}" placeholder="Day" aria-label="Schedule day" style="${inputCss} max-width: 220px;" />
              <input type="text" data-field="time" value="${esc(s.time)}" placeholder="Time" aria-label="Schedule time" style="${inputCss} max-width: 220px;" />
            </div>`).join("")}
        </div>`;
    };

    const extraHtml = (x) => `
      <div class="d-flex align-items-center gap-2" style="margin: 0.5rem 0 0 1.25rem;" data-extra="${esc(x.id)}">
        <span class="muted" style="font-size: var(--fs-xs); flex-shrink: 0;">+ ${esc(x.id)}</span>
        <input type="text" data-field="extraName" value="${esc(x.name)}" aria-label="Extra name" style="${inputCss}" />
        <input type="number" data-field="extraPrice" value="${typeof x.price === "number" ? x.price : ""}" min="0" step="1" aria-label="Extra price in rand" />
      </div>`;

    const itemHtml = (item) => `
      <div class="price-row" data-item="${esc(item.id)}">
        <div class="price-row__info" style="flex: 1;">
          <span class="muted" style="font-size: var(--fs-xs); display: block; margin-bottom: 0.35rem;">${esc(item.id)}</span>
          <input type="text" data-field="name" value="${esc(item.name)}" aria-label="Item name" style="${inputCss} font-weight: 600; margin-bottom: 0.4rem;" />
          <input type="text" data-field="description" value="${esc(item.description || "")}" placeholder="Description (optional)" aria-label="Item description" style="${inputCss} margin-bottom: 0.4rem;" />
          <input type="text" data-field="priceNote" value="${esc(item.priceNote || "")}" placeholder="Price note — shown when price is empty, e.g. On request" aria-label="Price note" style="${inputCss}" />
          ${(item.extras || []).map(extraHtml).join("")}
        </div>
        <div class="price-row__price">
          <label class="muted" style="font-size: var(--fs-xs); font-weight: 400; display: block; margin-bottom: 0.25rem;">Price (R)</label>
          <input type="number" data-field="price" value="${typeof item.price === "number" ? item.price : ""}" min="0" step="1" placeholder="—" aria-label="Item price in rand" />
        </div>
      </div>`;

    $("#pricingEditor").innerHTML = cats.map(cat => `
      <div class="kpi" style="padding: var(--space-6); margin-bottom: 1.5rem;" data-cat-card="${esc(cat.id)}">
        <div class="d-flex justify-content-between align-items-center" style="margin-bottom: 1rem;">
          <div class="kpi__label">${esc(cat.title)}</div>
          <span class="muted" style="font-size: var(--fs-xs);">${esc(cat.id)}</span>
        </div>
        ${scheduleHtml(cat)}
        <div class="price-list">
          ${(cat.items || []).map(itemHtml).join("")}
        </div>
      </div>`).join("");
  }

  // Read the inputs back into the exact catalog shape the PUT expects.
  function collectPricing() {
    const root = $("#pricingEditor");
    const strOrNull = (v) => { const t = (v || "").trim(); return t || null; };
    const intOrNull = (v) => {
      const t = (v || "").trim();
      if (t === "") return null;
      const n = parseInt(t, 10);
      return Number.isFinite(n) ? n : null;
    };

    return ((pricingCatalog && pricingCatalog.categories) || []).map(cat => {
      const catEl = root.querySelector(`[data-cat-card="${cat.id}"]`);
      const out = { id: cat.id, title: cat.title };
      if (Array.isArray(cat.schedule)) {
        out.schedule = cat.schedule.map((s, i) => {
          const el = catEl.querySelector(`[data-sched="${i}"]`);
          return {
            day: (el.querySelector('input[data-field="day"]').value || "").trim(),
            time: (el.querySelector('input[data-field="time"]').value || "").trim()
          };
        });
      }
      out.items = (cat.items || []).map(item => {
        const rowEl = catEl.querySelector(`.price-row[data-item="${item.id}"]`);
        const val = (f) => rowEl.querySelector(`input[data-field="${f}"]`).value;
        return {
          id: item.id,
          name: val("name").trim() || item.name,
          price: intOrNull(val("price")),
          priceNote: strOrNull(val("priceNote")),
          description: strOrNull(val("description")),
          extras: (item.extras || []).map(x => {
            const xEl = rowEl.querySelector(`[data-extra="${x.id}"]`);
            const price = intOrNull(xEl.querySelector('input[data-field="extraPrice"]').value);
            return {
              id: x.id,
              name: xEl.querySelector('input[data-field="extraName"]').value.trim() || x.name,
              price: price == null ? x.price : price
            };
          })
        };
      });
      return out;
    });
  }

  async function savePricing() {
    const btn = $("#pricingSave");
    if (!pricingLoaded || !pricingCatalog) { setPricingStatus("Load the catalog first.", "error"); return; }
    const categories = collectPricing();
    btn.disabled = true;
    btn.textContent = "Saving…";
    setPricingStatus("");
    try {
      const r = await fetch(WM.api.url(WM.api.endpoints.adminPricing), {
        method: "PUT",
        headers: { "Content-Type": "application/json", ...WM.api.authHeaders() },
        body: JSON.stringify({ categories })
      });
      if (r.status === 401 || r.status === 403) {
        sessionStorage.removeItem("wm_admin_token");
        showLogin();
        return;
      }
      if (!r.ok) {
        const err = await r.json().catch(() => ({}));
        throw new Error(err.error || ("adminPricing " + r.status));
      }
      const data = await r.json();
      pricingCatalog = { categories: data.categories || categories, updatedAt: data.updatedAt };
      renderPricingEditor();
      const when = data.updatedAt
        ? new Date(data.updatedAt).toLocaleString("en-ZA", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", hour12: false })
        : "just now";
      setPricingStatus("Prices saved · updated " + when, "success");
    } catch (e) {
      setPricingStatus("Couldn't save prices: " + (e.message || e), "error");
    } finally {
      btn.disabled = false;
      btn.textContent = "Save prices";
    }
  }

  function renderServiceMix() {
    const counts = {};
    WM.services.forEach(s => counts[s.slug] = 0);
    bookings.forEach(b => { if (counts[b.service] != null) counts[b.service]++; });
    const max = Math.max(...Object.values(counts), 1);
    $("#serviceMix").innerHTML = WM.services.map(s => {
      const n = counts[s.slug];
      const pct = (n / max * 100).toFixed(0);
      return `
        <div class="d-flex align-items-center gap-3" style="margin-bottom: 0.85rem;">
          <span style="min-width: 140px; font-size: var(--fs-sm);">${s.title}</span>
          <div style="flex: 1; height: 8px; background: var(--color-line-soft); border-radius: var(--radius-pill); overflow: hidden;">
            <div style="width: ${pct}%; height: 100%; background: linear-gradient(90deg, var(--color-olive), var(--color-olive-soft)); border-radius: var(--radius-pill);"></div>
          </div>
          <span class="muted" style="min-width: 32px; text-align: right; font-size: var(--fs-sm);">${n}</span>
        </div>
      `;
    }).join("");
  }

  function renderDemographics() {
    const ages = {};
    const genders = { F: 0, M: 0, Other: 0 };
    bookings.forEach(b => {
      ages[b.ageBand] = (ages[b.ageBand] || 0) + 1;
      genders[b.gender] = (genders[b.gender] || 0) + 1;
    });
    const ageRows = Object.entries(ages).sort().map(([band, n]) => `
      <tr><td>${band}</td><td style="text-align:right;">${n}</td></tr>
    `).join("");
    $("#ageTable").innerHTML = ageRows;

    const total = bookings.length || 1;
    $("#genderMix").innerHTML = `
      <div class="d-flex gap-2" style="margin-bottom: 1rem;">
        <div style="flex: ${genders.F}; min-width: 24px; height: 36px; background: var(--color-olive); border-radius: var(--radius-sm) 0 0 var(--radius-sm); display:grid; place-items:center; color: var(--color-cream); font-size: var(--fs-xs);">F · ${(genders.F/total*100).toFixed(0)}%</div>
        <div style="flex: ${genders.M}; min-width: 24px; height: 36px; background: var(--color-apricot); display:grid; place-items:center; color: var(--color-white); font-size: var(--fs-xs);">M · ${(genders.M/total*100).toFixed(0)}%</div>
        ${genders.Other ? `<div style="flex: ${genders.Other}; min-width: 24px; height: 36px; background: var(--color-tea); border-radius: 0 var(--radius-sm) var(--radius-sm) 0; display:grid; place-items:center; color: var(--color-olive-deep); font-size: var(--fs-xs);">Other</div>`:''}
      </div>
    `;
  }

  document.addEventListener("DOMContentLoaded", () => {
    // Populate service filter
    const sel = $("#fService");
    WM.services.forEach(s => sel.insertAdjacentHTML("beforeend", `<option value="${s.slug}">${s.title}</option>`));

    ["fStatus","fService","fDate"].forEach(id => $("#" + id).addEventListener("change", renderTable));
    $("#fClear").addEventListener("click", () => {
      $("#fStatus").value = ""; $("#fService").value = ""; $("#fDate").value = "";
      renderTable();
    });

    initTabs();
    const ivRange = $("#ivRange");
    if (ivRange) ivRange.addEventListener("change", renderIvTable);
    const pricingReload = $("#pricingReload");
    if (pricingReload) pricingReload.addEventListener("click", loadPricing);
    const pricingSave = $("#pricingSave");
    if (pricingSave) pricingSave.addEventListener("click", savePricing);

    const logout = document.getElementById("wmLogout");
    if (logout) logout.addEventListener("click", (e) => {
      e.preventDefault();
      sessionStorage.removeItem("wm_admin_token");
      location.reload();
    });

    load();
  });
})();
