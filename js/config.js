/* WellMed — global config (single source of truth for nav, services, contact) */
window.WM = window.WM || {};

WM.brand = {
  name: "WellMed",
  tagline: "GP & Holistic Healing",
  doctor: "Dr Moodley",
  phone: "+27 74 915 2513",
  whatsapp: "+27 74 915 2513",
  email: "drmoodley17@gmail.com",
  address: "4 Lagoon Dr, Umhlanga, uMhlanga, 4320, South Africa",
  hours: [
    { day: "Mon – Fri", hours: "08:00 – 17:00" },
    { day: "Saturday",  hours: "09:00 – 14:00" },
    { day: "Sunday",    hours: "09:00 – 12:30" }
  ],
  social: {
    instagram: "https://www.instagram.com/dr_k_moodley/",
    facebook: "#",
    google: "https://maps.app.goo.gl/abfBM6jzEtEuQZQy5"
  }
};

WM.services = [
  { slug: "gp-practice",      title: "GP Practice",         tagline: "Trusted family medicine",   icon: "stethoscope" },
  { slug: "iv-therapy",       title: "IV Therapy",          tagline: "Replenish & restore",       icon: "drop" },
  { slug: "ozone-therapy",    title: "Ozone Therapy",       tagline: "Cellular wellness",         icon: "spark" },
  { slug: "red-light-therapy",title: "Red Light Therapy",   tagline: "Recover & glow",            icon: "sun" },
  { slug: "weight-loss",      title: "Medical Weight Loss", tagline: "Sustainable transformation",icon: "scale" }
];

/* Backend API — deployed on AWS (eu-west-1). Contract: /docs/BACKEND_BUILD_PROMPT.md.
   The booking form still falls back to local-queue if the network call fails,
   and availability falls back to synthesised slots per the contract. */
WM.api = {
  baseUrl: "https://u9j667n1bb.execute-api.eu-west-1.amazonaws.com",
  endpoints: {
    availableSlots: "/prod/api/availability",
    submitBooking:  "/prod/api/bookings",
    submitContact:  "/prod/api/contact",
    adminLogin:     "/prod/api/admin/login",
    listBookings:   "/prod/api/admin/bookings",
    getBooking:     "/prod/api/admin/bookings/:id",
    updateBooking:  "/prod/api/admin/bookings/:id",
    stats:          "/prod/api/admin/stats"
  },
  url(endpoint, params) {
    let path = endpoint;
    if (params) Object.entries(params).forEach(([k, v]) => { path = path.replace(":" + k, encodeURIComponent(v)); });
    return this.baseUrl + path;
  },
  authHeaders() {
    const token = sessionStorage.getItem("wm_admin_token");
    return token ? { "Authorization": "Bearer " + token } : {};
  }
};
