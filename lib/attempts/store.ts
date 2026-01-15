// lib/attempts/store.ts
import { LocalAttemptStore } from "./localAttemptStore";

// One singleton store instance used across UI.
// Later you can swap to DbAttemptStore without touching UI code.
export const attemptStore = new LocalAttemptStore();
