/* WellMed — Admin dashboard
   Wired to GET /api/admin/bookings (see BACKEND_API_CONTRACT.md).
   Falls back to mock data so the dashboard is fully testable pre-backend.
*/
(function () {
  const FALLBACK_BOOKINGS = [
    { id: "WM-1042", patient: "Nadia Pillay",     service: "iv-therapy",       slot: "2026-05-09T09:30:00", status: "confirmed",  source: "online",  ageBand: "35-44", gender: "F", medicalAid: "Discovery" },
    { id: "WM-1041", patient: "Thandi Mokoena",   service: "gp-practice",      slot: "2026-05-09T10:00:00", status: "confirmed",  source: "online",  ageBand: "25-34", gender: "F", medicalAid: "Bonitas" },
    { id: "WM-1040", patient: "Rashid Khan",      service: "ozone-therapy",    slot: "2026-05-09T11:00:00", status: "pending",    source: "phone",   ageBand: "45-54", gender: "M", medicalAid: "—" },
    { id: "WM-1039", patient: "Priya Singh",      service: "gp-practice",      slot: "2026-05-09T13:30:00", status: "confirmed",  source: "online",  ageBand: "35-44", gender: "F", medicalAid: "Momentum" },
    { id: "WM-1038", patient: "Lerato Ndlovu",    service: "iv-therapy",       slot: "2026-05-08T15:00:00", status: "completed",  source: "online",  ageBand: "25-34", gender: "F", medicalAid: "—" },
    { id: "WM-1037", patient: "Anika Reddy",      service: "weight-loss",      slot: "2026-05-08T14:00:00", status: "completed",  source: "online",  ageBand: "35-44", gender: "F", medicalAid: "Discovery" },
    { id: "WM-1036", patient: "Dean v. d. Merwe", service: "red-light-therapy",slot: "2026-05-07T16:30:00", status: "noshow",     source: "online",  ageBand: "55+",   gender: "M", medicalAid: "Profmed" },
    { id: "WM-1035", patient: "Sarah Jacobs",     service: "yoga-breathwork",  slot: "2026-05-07T18:30:00", status: "completed",  source: "online",  ageBand: "35-44", gender: "F", medicalAid: "—" },
    { id: "WM-1034", patient: "Michelle Botha",   service: "gp-practice",      slot: "2026-05-07T09:00:00", status: "completed",  source: "phone",   ageBand: "55+",   gender: "F", medicalAid: "Discovery" },
    { id: "WM-1033", patient: "Kabelo Mthembu",   service: "ozone-therapy",    slot: "2026-05-06T10:30:00", status: "completed",  source: "online",  ageBand: "45-54", gender: "M", medicalAid: "Bonitas" },
    { id: "WM-1032", patient: "Zanele Mkhize",    service: "iv-therapy",       slot: "2026-05-06T13:00:00", status: "noshow",     source: "online",  ageBand: "25-34", gender: "F", medicalAid: "—" },
    { id: "WM-1031", patient: "Hassan Patel",     service: "weight-loss",      slot: "2026-05-05T11:30:00", status: "completed",  source: "online",  ageBand: "35-44", gender: "M", medicalAid: "Discovery" }
  ];

  let bookings = [];
  const $ = (s) => document.querySelector(s);

  async function load() {
    try {
      // const r = await fetch(WM.api.endpoints.listBookings, { headers: { "Authorization": "Bearer …" } });
      // bookings = await r.json();
      throw new Error("backend not deployed");
    } catch (_) {
      bookings = FALLBACK_BOOKINGS;
    }
    render();
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

    load();
  });
})();
