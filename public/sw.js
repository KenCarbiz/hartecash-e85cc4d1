/* eslint-disable no-restricted-globals */
// Autocurb service worker — handles PWA web-push notifications for staff.
//
// Scope: /  (registered at root so notifications work on every page).
// We keep this file intentionally small — no offline shell / no asset
// precaching. Caching and offline support live in the Vite PWA plugin
// if/when we enable it. This worker is ONLY for push delivery.

self.addEventListener("install", (event) => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("push", (event) => {
  if (!event.data) return;
  let payload;
  try {
    payload = event.data.json();
  } catch {
    payload = { title: "Autocurb", body: event.data.text() };
  }

  const title = payload.title || "Autocurb";
  const options = {
    body: payload.body || "",
    icon: payload.icon || "/favicon.ico",
    badge: payload.badge || "/favicon.ico",
    tag: payload.tag || undefined, // coalesces duplicate notifications
    renotify: !!payload.renotify,
    requireInteraction: !!payload.require_interaction,
    data: {
      url: payload.url || "/admin",
      trigger_key: payload.trigger_key || null,
      submission_id: payload.submission_id || null,
    },
    actions: payload.actions || [],
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const { url } = event.notification.data || {};
  const target = url || "/admin";

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientsArr) => {
      // If a tab is already open on the target URL, focus it. Otherwise
      // focus the most recent admin tab and navigate it. Otherwise open.
      const sameUrl = clientsArr.find((c) => c.url.endsWith(target));
      if (sameUrl) return sameUrl.focus();
      const adminTab = clientsArr.find((c) => c.url.includes("/admin"));
      if (adminTab) {
        adminTab.focus();
        return adminTab.navigate(target);
      }
      return self.clients.openWindow(target);
    })
  );
});
