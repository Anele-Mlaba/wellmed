/* WellMed — global config (single source of truth for nav, services, contact) */
window.WM = window.WM || {};

WM.brand = {
  name: "WellMed",
  tagline: "GP & Holistic Healing",
  doctor: "Dr Moodley",
  phone: "+27 74 915 2513",
  whatsapp: "+27 74 915 2513",
  email: "k.moodley@wellmed.org.za",
  address: "4 Lagoon Dr, Umhlanga, uMhlanga, 4320, South Africa",
  hours: [
    { day: "Mon – Fri", hours: "08:00 – 17:00" },
    { day: "Saturday",  hours: "09:00 – 14:00" },
    { day: "Sunday",    hours: "09:00 – 12:30" }
  ],
  social: {
    instagram: "#",
    facebook: "#",
    google: "#"
  }
};

WM.services = [
  { slug: "gp-practice",      title: "GP Practice",         tagline: "Trusted family medicine",   icon: "stethoscope" },
  { slug: "iv-therapy",       title: "IV Therapy",          tagline: "Replenish & restore",       icon: "drop" },
  { slug: "ozone-therapy",    title: "Ozone Therapy",       tagline: "Cellular wellness",         icon: "spark" },
  { slug: "red-light-therapy",title: "Red Light Therapy",   tagline: "Recover & glow",            icon: "sun" },
  { slug: "weight-loss",      title: "Medical Weight Loss", tagline: "Sustainable transformation",icon: "scale" },
  { slug: "yoga",  title: "Yoga",   tagline: "Move, breathe, restore",    icon: "leaf" }
];

/* Backend API contract — defined in /docs/BACKEND_API_CONTRACT.md.
   Until the backend exists, the booking form posts to this stub URL and
   gracefully falls back to a "queued" success state. */
WM.api = {
  baseUrl: "/api",
  endpoints: {
    availableSlots: "/api/availability",
    submitBooking:  "/api/bookings",
    listBookings:   "/api/admin/bookings",
    updateBooking:  "/api/admin/bookings/:id",
    stats:          "/api/admin/stats"
  }
};
