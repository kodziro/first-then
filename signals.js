/* First Then Board — outbound click signal for the guide pages
   (printable/, first-then-next/, autism/, toddlers/, first-then-vs-visual-schedule/).
   Same TelemetryDeck code and the same ANALYTICS_KEYS allow-list as index.html; keep both in sync.
   Sends one signal only: "appstore-click" {target, position}, when a link with data-out is tapped.
   Cookieless: clientUser is a random value per page load, never stored. Nothing is saved in the browser.
   If the SDK does not load (offline, blocked), nothing is sent and the page works the same.
   DO NOT UPDATE telemetrydeck-sdk.js without re-checking: the _post override below copies
   2.0.4 internals (instance.target, _post). */
(function () {
"use strict";
const TD_APP_ID = "B4DED0BE-CBC2-4D31-934C-26CB40726237";
const TD_SDK_URL = "/telemetrydeck-sdk.js";
const TD_TEST_MODE = /^localhost$|^127(\.\d+){0,2}\.\d+$|^\[::1?]$/.test(location.hostname) || location.protocol === "file:";
let td = null;
let tdWaiting = [];                // signals fired before the SDK is ready (max 20)

function tdRandomId() {
  try { if (crypto && crypto.randomUUID) return crypto.randomUUID(); } catch (e) {}
  return String(Date.now()) + "-" + Math.random().toString(36).slice(2);
}
function tdReferrerHost() {
  try { return document.referrer ? new URL(document.referrer).hostname : ""; } catch (e) { return ""; }
}
// utm_source if present, else the host of an external referrer, else "none".
// Only a plain host-like value passes; anything else becomes "other".
function tdSource() {
  let utm = "";
  try { utm = new URLSearchParams(location.search).get("utm_source") || ""; } catch (e) {}
  if (utm) { utm = utm.toLowerCase(); return /^[a-z0-9._-]{1,60}$/.test(utm) ? utm : "other"; }
  const host = tdReferrerHost();
  return host && host !== location.hostname ? host : "none";
}
// The folder name of the guide page ("/printable/" -> "printable"); "home" for "/".
function tdPage() {
  const name = location.pathname.replace(/\/index\.html$/, "/").replace(/\/$/, "").replace(/^.*\//, "").replace(/\.html$/, "");
  return name || "home";
}
function tdSend(signal, safe) {
  try {
    td.signal(signal, Object.assign({}, safe, {
      page: tdPage(),
      source: tdSource(),
      path: location.pathname,
      referrer: tdReferrerHost() || "none",
    })).catch(() => {});
  } catch (e) {}
}
try {
  import(TD_SDK_URL).then(mod => {
    const instance = new mod.default({ appID: TD_APP_ID, clientUser: tdRandomId(), testMode: TD_TEST_MODE });
    // Same request as the SDK's own _post (pinned 2.0.4), plus keepalive so
    // the browser finishes the POST even while it follows an outbound link.
    instance._post = body => fetch(instance.target, {
      method: "POST",
      mode: "cors",
      keepalive: true,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    td = instance;
    tdWaiting.forEach(w => tdSend(w[0], w[1]));
    tdWaiting = [];
  }).catch(() => { tdWaiting = null; /* SDK unavailable: no signals */ });
} catch (e) { tdWaiting = null; }

const ANALYTICS_KEYS = {           // only these keys, only these values (same list as index.html)
  position: /^[a-z0-9-]{1,24}$/,   // fixed UI positions we set in code
  target:   /^[a-z0-9-]{1,24}$/,   // fixed link ids we set in code
  mode:     /^(2|3)$/,
  source:   /^(icon|photo|text|camera|library)$/,
  scope:    /^(one|all|blank)$/,
  template: /^(Morning|Bedtime|School|Meals)$/,   // fixed template names only
};
function track(signal, params = {}) {
  const safe = {};
  for (const k of Object.keys(params)) {
    const re = ANALYTICS_KEYS[k];
    const v = String(params[k]);
    if (re && re.test(v)) safe[k] = v;
  }
  // TELEMETRYDECK: only `safe` (allow-listed) goes out.
  if (td) tdSend(signal, safe);
  else if (tdWaiting && tdWaiting.length < 20) tdWaiting.push([signal, safe]);
  if (location.hostname === "localhost") console.debug("[track]", signal, safe);
}

// outbound links (fixed ids only)
document.addEventListener("click", e => {
  const a = e.target.closest && e.target.closest("a[data-out]");
  if (a) track("appstore-click", { target: a.dataset.out, position: a.dataset.pos });
});
})();
