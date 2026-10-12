/* First Then Board — outbound click signal for the guide pages
   (printable/, first-then-next/, autism/, toddlers/, first-then-vs-visual-schedule/).
   Same TelemetryDeck code and the same ANALYTICS_KEYS allow-list as index.html; keep both in sync.
   Signals (fixed values only):
   - "appstore-click" {target, position}: a link with data-out is tapped.
   - "printable-download" {file, paper}: a PDF download button on /printable/ is tapped.
   - "guide-to-board" {position, target}: a button that opens the board is tapped
     (position = the folder name of the guide page, target = board | board-3).
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
  position: /^[a-z0-9-]{1,40}$/,   // fixed UI positions we set in code (also a guide page's folder name)
  target:   /^[a-z0-9-]{1,24}$/,   // fixed link ids we set in code
  mode:     /^(2|3)$/,
  source:   /^(icon|photo|text|camera|library)$/,
  scope:    /^(one|all|blank)$/,
  template: /^(Morning|Bedtime|School|Meals)$/,   // fixed template names only
  days:       /^(1|2-3|4-7|8\+)$/,   // rough group of days of use, never the exact number
  standalone: /^(yes|no)$/,          // opened from the Home Screen icon or not
  boards:     /^(1|2-5|6\+)$/,       // rough count
  photos:     /^(0|1-5|6\+)$/,       // rough count
  action:     /^(shown|closed|new|open)$/,
  file:       /^(blank-2|blank-3|labels)$/,
  paper:      /^(a4|letter)$/,
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

// Which PDF: "/printables/first-then-next-blank-a4.pdf" -> { file: "blank-3", paper: "a4" }.
function pdfParams(href) {
  const m = /^\/printables\/first-then-(blank|next-blank|labels)-(a4|letter)\.pdf$/.exec(href);
  return m ? { file: m[1] === "blank" ? "blank-2" : m[1] === "next-blank" ? "blank-3" : "labels", paper: m[2] } : null;
}
document.addEventListener("click", e => {
  const a = e.target.closest && e.target.closest("a");
  if (!a) return;
  const href = a.getAttribute("href") || "";
  // outbound links (fixed ids only)
  if (a.dataset && a.dataset.out) { track("appstore-click", { target: a.dataset.out, position: a.dataset.pos }); return; }
  const pdf = pdfParams(href);
  if (pdf) { track("printable-download", pdf); return; }
  // the big buttons that open the board (not the logo, the breadcrumb or the footer link)
  if (a.classList && a.classList.contains("btn") && (href === "/" || href === "/#mode=3")) {
    track("guide-to-board", { position: tdPage(), target: href === "/" ? "board" : "board-3" });
  }
});
})();
