import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";

const listeners = new Map();
const calls = [];
runInNewContext(readFileSync(new URL("../ops/nginx/pfv-retire-sw.js", import.meta.url), "utf8"), {
  self: {
    addEventListener: (name, handler) => listeners.set(name, handler),
    skipWaiting: async () => calls.push("skipWaiting"),
    clients: { claim: async () => calls.push("claim") },
    registration: { unregister: async () => calls.push("unregister") },
  },
});

const pending = [];
listeners.get("install")({ waitUntil: (promise) => pending.push(promise) });
await Promise.all(pending);
assert.deepEqual(calls, ["skipWaiting"]);

pending.length = 0;
listeners.get("activate")({ waitUntil: (promise) => pending.push(promise) });
await Promise.all(pending);
assert.deepEqual(calls, ["skipWaiting", "claim", "unregister"]);
assert.equal(listeners.has("fetch"), false, "retired workers must leave navigation to the browser");
console.log("Legacy PWA retirement tests passed.");
