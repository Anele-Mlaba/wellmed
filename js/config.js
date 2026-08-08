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
    google: "https://maps.app.goo.gl/abfBM6jzEtEuQZQy5",
    googleProfile: "https://share.google/x9kKYi7qBIPuJtIW0"
  }
};

WM.services = [
  { slug: "gp-practice",           title: "GP Practice",            tagline: "Trusted family medicine",    icon: "stethoscope" },
  // IV therapy books on its own page (drip menu + concurrent chairs)
  { slug: "iv-therapy",            title: "IV Therapy",             tagline: "Replenish & restore",        icon: "drop", bookPage: "book-iv-therapy.html" },
  { slug: "ozone-therapy",         title: "Ozone Therapy",          tagline: "Cellular wellness",          icon: "spark" },
  { slug: "red-light-therapy",     title: "Red Light Therapy",      tagline: "Recover & glow",             icon: "sun" },
  { slug: "weight-loss",           title: "Medical Weight Loss",    tagline: "Sustainable transformation", icon: "scale" },
  { slug: "yoga-breathwork",       title: "Yoga",                   tagline: "Tue & Fri evening classes",  icon: "lotus" },
  { slug: "gut-biome-test",        title: "Gut Biome Test",         tagline: "Know your microbiome",       icon: "leaf",  page: "pages/services/tests-gut-health.html" },
  { slug: "functional-blood-test", title: "Functional Blood Tests", tagline: "In-depth blood analysis",    icon: "flask", page: "pages/services/tests-gut-health.html" }
];

/* Which pricing-catalog category a bookable service draws its options from.
   itemId set → the price is fixed for that service (no option picker). */
WM.pricingMap = {
  "iv-therapy":            { category: "iv-therapy" },
  "ozone-therapy":         { category: "ozone-therapy" },
  "red-light-therapy":     { category: "red-light-therapy" },
  "yoga-breathwork":       { category: "yoga-breathwork" },
  "gut-biome-test":        { category: "tests", itemId: "gut-biome-test" },
  "functional-blood-test": { category: "tests", itemId: "functional-blood-test" }
};

/* Appointment length per service — used for the calendar invite in the
   confirmation email (mirrors the backend ServiceConfig durations). */
WM.serviceDurations = {
  "gp-practice": 30,
  "iv-therapy": 60,
  "ozone-therapy": 20,
  "red-light-therapy": 20,
  "weight-loss": 45,
  "yoga-breathwork": 60,
  "gut-biome-test": 30,
  "functional-blood-test": 30
};

/* Backend API — deployed on AWS (eu-west-1). Contract: /docs/BACKEND_BUILD_PROMPT.md.
   The booking form still falls back to local-queue if the network call fails,
   and availability falls back to synthesised slots per the contract. */
WM.api = {
  baseUrl: "https://u9j667n1bb.execute-api.eu-west-1.amazonaws.com",
  endpoints: {
    availableSlots: "/prod/api/availability",
    submitBooking:  "/prod/api/bookings",
    submitContact:  "/prod/api/contact",
    pricing:        "/prod/api/pricing",
    authRegister:   "/prod/api/auth/register",
    authLogin:      "/prod/api/auth/login",
    me:             "/prod/api/me",
    adminLogin:     "/prod/api/admin/login",
    listBookings:   "/prod/api/admin/bookings",
    getBooking:     "/prod/api/admin/bookings/:id",
    updateBooking:  "/prod/api/admin/bookings/:id",
    adminPricing:   "/prod/api/admin/pricing",
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

/* Shared notification microservice (cavetools-notification-service). Sends the
   booking confirmation email + calendar invite via Zoho Mail — this is the
   sole confirmation email for wellmed bookings. */
WM.notificationApi = {
  url: "https://a4usuvkkb6.execute-api.eu-west-1.amazonaws.com/Prod/notifications/send"
};
