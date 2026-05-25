/* WellMed — Admin dashboard
   Wired to /api/admin/* (see BACKEND_API_CONTRACT.md).
   Shows a login overlay when no JWT is present or the token is rejected.
*/
(function () {
  let bookings = [];
  const $ = (s) => document.querySelector(s);

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
      alert(`${action.toUpperCase()} ${id}\n\n(Backend wiring per BACKEND_API_CONTRACT.md — PATCH /api/admin/bookings/:id)`);
    }));
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

    const logout = document.getElementById("wmLogout");
    if (logout) logout.addEventListener("click", (e) => {
      e.preventDefault();
      sessionStorage.removeItem("wm_admin_token");
      location.reload();
    });

    load();
  });
})();
