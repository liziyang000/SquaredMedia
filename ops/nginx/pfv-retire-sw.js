self.addEventListener("install", function (event) {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", function (event) {
  event.waitUntil(
    self.clients.claim().then(function () {
      return self.registration.unregister();
    }),
  );
});
