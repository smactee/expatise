import { beforeEach } from "vitest";

// Hermetic isolation: every test starts with an empty localStorage.
// jsdom provides window.localStorage; clearing it here prevents one test's
// attempt records / usage-cap state / time logs from leaking into the next.
beforeEach(() => {
  window.localStorage.clear();
});
