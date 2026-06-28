// Notify the app that the Supabase auth session changed so listeners
// (UserProfile, useAuthStatus) can re-read it. Guarded because dispatchEvent
// is unavailable during SSR / non-browser contexts.
export function notifySessionChanged(): void {
  try {
    window.dispatchEvent(new Event('expatise:session-changed'));
  } catch {}
}
