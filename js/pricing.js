/* WellMed — price catalog client (GET /api/pricing, admin-maintained)
   Load order: config.js → pricing.js → page script. */
(function () {
  let catalogPromise = null;

  async function load() {
    if (!catalogPromise) {
      catalogPromise = fetch(WM.api.url(WM.api.endpoints.pricing))
        .then(r => {
          if (!r.ok) throw new Error("pricing " + r.status);
          return r.json();
        })
        .catch(err => {
          catalogPromise = null; // allow a retry on the next call
          throw err;
        });
    }
    return catalogPromise;
  }

  function category(catalog, id) {
    return (catalog.categories || []).find(c => c.id === id) || null;
  }

  function item(catalog, itemId) {
    for (const c of catalog.categories || []) {
      const found = (c.items || []).find(i => i.id === itemId);
      if (found) return found;
    }
    return null;
  }

  function fmt(n) {
    return "R" + Number(n).toLocaleString("en-ZA");
  }

  /* Price list section used on the service pages. Falls back to a phone
     prompt when the catalog can't be fetched. */
  async function renderCategory(el, categoryId, opts) {
    opts = opts || {};
    let catalog;
    try {
      catalog = await load();
    } catch (e) {
      el.innerHTML = `<p class="muted">Please call ${WM.brand.phone} for our latest prices.</p>`;
      return;
    }
    const cat = category(catalog, categoryId);
    if (!cat || !(cat.items || []).length) {
      el.innerHTML = `<p class="muted">Please call ${WM.brand.phone} for our latest prices.</p>`;
      return;
    }

    const schedule = (cat.schedule || []).length
      ? `<p class="price-list__schedule">${WM.icons.clock} ${cat.schedule.map(s => `${s.day} ${s.time}`).join(" · ")}</p>`
      : "";

    el.innerHTML = `
      ${schedule}
      <div class="price-list">
        ${cat.items.map(i => `
          <div class="price-row">
            <div class="price-row__info">
              <h4>${i.name}</h4>
              ${i.description ? `<p>${i.description}</p>` : ""}
              ${(i.extras || []).map(x => `<p class="price-row__extra">+ ${x.name} — ${fmt(x.price)}</p>`).join("")}
            </div>
            <div class="price-row__price">${i.price != null ? fmt(i.price) : (i.priceNote || "On request")}</div>
          </div>
        `).join("")}
      </div>
      ${opts.bookHref ? `<a href="${opts.bookHref}" class="btn-wm btn-wm--primary" style="margin-top: 1.5rem;">${opts.bookLabel || "Book now"}</a>` : ""}
    `;
  }

  WM.pricing = { load, category, item, fmt, renderCategory };
})();
