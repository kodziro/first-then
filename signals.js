/* First Then Board — outbound click signal for the guide pages
   (printable/, first-then-next/, autism/, toddlers/, first-then-vs-visual-schedule/, and since v1.6.1
   first-then-chart/, classroom/, speech-therapy/).
   Same TelemetryDeck code and the same ANALYTICS_KEYS allow-list as index.html; keep both in sync.
   Signals (fixed values only):
   - "appstore-click" {target, position}: a link with data-out is tapped.
   - "printable-download" {file, paper}: a PDF download button on /printable/ is tapped.
   - "guide-to-board" {position, target}: a button that opens the board is tapped
     (position = the folder name of the guide page, target = board | board-3).
   Every signal also carries os (device group), v (site version) and unlocked (yes|no: extras unlocked today,
   read from the board's localStorage date "ft-tried"). Known bots send nothing.
   Cookieless: clientUser is a random value per page load, never stored. This file saves nothing in the browser.
   If the SDK does not load (offline, blocked), nothing is sent and the page works the same.
   DO NOT UPDATE telemetrydeck-sdk.js without re-checking: the _post override below copies
   2.0.4 internals (instance.target, _post). */
(function () {
"use strict";
const TD_APP_ID = "B4DED0BE-CBC2-4D31-934C-26CB40726237";
const TD_SDK_URL = "/telemetrydeck-sdk.js";
const TD_TEST_MODE = /^localhost$|^127(\.\d+){0,2}\.\d+$|^\[::1?]$/.test(location.hostname) || location.protocol === "file:";
// Common fields on every signal (fixed values only): device group, site version, extras unlocked today.
const TD_UA = navigator.userAgent || "";
const TD_OS = (/iPad|iPhone|iPod/.test(TD_UA) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)) ? "ios"
  : /Android/.test(TD_UA) ? "android" : /Mac/.test(TD_UA) ? "mac" : /Windows/.test(TD_UA) ? "windows" : "other";
const TD_VERSION = ((document.querySelector('meta[name="version"]') || {}).content || "").replace(/[^0-9.]/g, "").slice(0, 12);
// Known bots and automated browsers load the page too: they send no signal (same check as keepquiet.app).
const TD_BOT = (() => {
  try { if (navigator.webdriver === true) return true; } catch (e) {}
  return /bot\b|crawl|spider|headless|lighthouse|inspectiontool|webindexer|PTST\//i.test(TD_UA) && !/cubot/i.test(TD_UA);
})();
let td = null;
let tdWaiting = TD_BOT ? null : [];   // signals fired before the SDK is ready (max 20); null = send nothing
// Extras unlocked for today on the board page? (If LOCKS_ON in index.html is set to false, return false here too.) Read only: the date the board keeps in localStorage "ft-tried".
function freeDayActive() {
  try {
    const u = (JSON.parse(localStorage.getItem("ft-tried") || "null") || {}).until;
    const d = new Date();
    const today = d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
    return typeof u === "string" && /^\d{4}-\d{2}-\d{2}$/.test(u) && today <= u;
  } catch (e) { return false; }
}

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
      os: TD_OS,
      v: TD_VERSION,
      unlocked: freeDayActive() ? "yes" : "no",
    })).catch(() => {});
  } catch (e) {}
}
try {
  if (!TD_BOT) import(TD_SDK_URL).then(mod => {
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
  // v1.6.0 "free for today" funnel (same signal names as token-board.app)
  item:       /^(photo|icon|mode3|board|template|print|card)$/,   // which locked extra
  from:       /^(editor|menu|boards|print|card)$/,                // where the tap happened
  via:        /^(scroll|menu)$/,                                   // how the pricing section was reached
  how:        /^(button|close)$/,                                  // how the offer dialog was left
  nth:        /^(1|2|3\+)$/,                                       // which free day in this browser
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
