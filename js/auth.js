/* WellMed — patient account/session module (mirrors lifestyle-club's VWApi
   customer-auth pattern, with expiry handling from its admin variant).
   Load order: config.js → auth.js → layout.js → page script. */
window.WMAuth = (function () {
  const SESSION_KEY = "wm:patient:session";

  function getSession() {
    try {
      const s = JSON.parse(localStorage.getItem(SESSION_KEY) || "null");
      if (!s || !s.token || !s.member) { localStorage.removeItem(SESSION_KEY); return null; }
      if (s.expiresAt && Date.now() >= s.expiresAt) { localStorage.removeItem(SESSION_KEY); return null; }
      return s;
    } catch (e) {
      localStorage.removeItem(SESSION_KEY);
      return null;
    }
  }

  function setSession(session) {
    localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  }

  function clearSession() {
    localStorage.removeItem(SESSION_KEY);
  }

  function isAuthenticated() {
    return !!getSession();
  }

  async function apiFetch(endpoint, method, body) {
    const session = getSession();
    let res;
    try {
      res = await fetch(WM.api.url(endpoint), {
        method: method,
        headers: {
          "Content-Type": "application/json",
          ...(session ? { "Authorization": "Bearer " + session.token } : {})
        },
        body: body === undefined ? undefined : JSON.stringify(body)
      });
    } catch (e) {
      throw new Error("We couldn't reach the server. Check your connection and try again.");
    }
    let data = null;
    try { data = await res.json(); } catch (e) { /* non-JSON body */ }
    if (res.status === 401 && session) {
      clearSession(); // token expired or revoked — drop the stale session
    }
    if (!res.ok) {
      const code = data && (data.error || data.message);
      throw new Error(friendlyError(code));
    }
    return data;
  }

  function friendlyError(code) {
    switch (code) {
      case "invalid_credentials":      return "That email and password don't match our records.";
      case "email_already_registered": return "That email already has a profile. Try logging in instead.";
      case "validation":               return "Some details look invalid. Please review the form.";
      default:                         return "Something went wrong. Please try again.";
    }
  }

  function storeAuthResponse(data) {
    if (!data || !data.token || !data.member) throw new Error("Invalid response from server. Please try again.");
    setSession({
      member: data.member,
      token: data.token,
      expiresAt: data.expiresIn ? Date.now() + data.expiresIn * 1000 : null
    });
    return getSession();
  }

  /* POST /api/auth/register — profile carries the booking-flow fields so
     future bookings autofill. */
  async function register({ firstName, lastName, dob, phone, email, password, medicalAid }) {
    const data = await apiFetch(WM.api.endpoints.authRegister, "POST", {
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      dob: dob,
      phone: phone.trim(),
      email: email.trim(),
      password: password,
      medicalAid: medicalAid || null
    });
    return storeAuthResponse(data);
  }

  /* POST /api/auth/login */
  async function login({ email, password }) {
    const data = await apiFetch(WM.api.endpoints.authLogin, "POST", { email: email.trim(), password });
    return storeAuthResponse(data);
  }

  function logout(redirect) {
    clearSession();
    if (redirect !== false) location.href = WM.url ? WM.url("pages/login.html") : "login.html";
  }

  /* GET /api/me — refresh the cached member profile */
  async function me() {
    const data = await apiFetch(WM.api.endpoints.me, "GET");
    const session = getSession();
    if (session && data && data.member) {
      session.member = data.member;
      setSession(session);
    }
    return data && data.member;
  }

  /* PUT /api/me */
  async function updateProfile(changes) {
    const data = await apiFetch(WM.api.endpoints.me, "PUT", changes);
    const session = getSession();
    if (session && data && data.member) {
      session.member = data.member;
      setSession(session);
    }
    return data && data.member;
  }

  return { getSession, setSession, clearSession, isAuthenticated, register, login, logout, me, updateProfile };
})();
