/*
  TelemetryDeck Web SDK 1.1.0 (pageview) — local copy for first-then.app.
  Served from this site, not from a CDN. Original file:
  https://cdn.telemetrydeck.com/websdk/telemetrydeck.min.js (copied 2026-10-11),
  the same Web SDK the tag on kidstimer.app, visual-schedule.app,
  keepquiet.app and token-board.app loads.

  ONE change from the original: "url" and "referrer" are sent WITHOUT the
  query string and the hash (the original sends location.href and
  document.referrer as they are). Everything else is the same request.

  Sends one POST per page load: { appID, url, referrer, telemetryClientVersion,
  locale }. Stores nothing: no cookies, no localStorage, no sessionStorage,
  no IndexedDB.
*/
(function () {
  "use strict";
  const script = document.currentScript;
  const appID = script.dataset.appId;
  const forceTest = script.dataset.isTestMode === "true";
  const api = script.dataset.api ?? "https://nom.telemetrydeck.com/v2/w/";
  const { language: locale } = navigator;
  const { location: loc = {} } = globalThis;

  if (!appID) throw new Error('TelemetryDeck: "data-app-id" missing');

  // scheme + host + path only; "" when there is no (valid) URL
  function noQuery(href) {
    try {
      const u = new URL(href);
      return u.protocol + "//" + u.host + u.pathname;
    } catch (e) { return ""; }
  }

  const body = {
    appID: appID,
    url: noQuery(loc.href),
    referrer: noQuery(document.referrer),
    telemetryClientVersion: "WebSDK 1.1.0",
    locale: locale,
  };
  if (forceTest || /^localhost$|^127(\.\d+){0,2}\.\d+$|^\[::1?]$/.test(loc.hostname) || loc.protocol === "file:") {
    body.isTestMode = true;
  }
  fetch(api, {
    method: "POST",
    mode: "cors",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }).catch(function () { /* offline or blocked: the page works the same */ });
})();
