import "@testing-library/jest-dom/vitest";

import { setCurrentTenant } from "@/tenant/current";

// jsdom denies localStorage on opaque origins, and Node's built-in Web
// Storage can shadow the jsdom global — either leaves
// `localStorage` undefined/throwing in tests. Probe it and fall back to an
// in-memory Storage so tenant/theme tests always have a working store.
function ensureLocalStorage() {
  try {
    const ls = globalThis.localStorage;
    ls?.setItem("__probe__", "1");
    ls?.removeItem("__probe__");
    if (ls) return;
  } catch {
    // fall through to the polyfill
  }
  const store = new Map<string, string>();
  const storage: Storage = {
    get length() {
      return store.size;
    },
    clear: () => store.clear(),
    getItem: (key) => (store.has(key) ? store.get(key)! : null),
    setItem: (key, value) => void store.set(key, String(value)),
    removeItem: (key) => void store.delete(key),
    key: (index) => [...store.keys()][index] ?? null,
  };
  Object.defineProperty(globalThis, "localStorage", {
    value: storage,
    configurable: true,
    writable: true,
  });
}

ensureLocalStorage();

// API helpers resolve the active tenant from this module-level holder (the
// TenantProvider keeps it in sync in the app; most page tests render pages
// without it). Default to the fixture tenant used across the test suite.
setCurrentTenant("acme");
