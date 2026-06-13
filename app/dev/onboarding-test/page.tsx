'use client';

// TEMPORARY dev-only verification route — intentionally NOT linked in nav.
// Mounts the full location-onboarding flow and logs the completion payload.
// Delete the whole app/dev/onboarding-test/ folder when done.

import LocationOnboarding, { type OnboardingResult } from '@/components/LocationOnboarding.client';

export default function OnboardingTestPage() {
  return (
    <LocationOnboarding
      onComplete={(result: OnboardingResult) => {
        // eslint-disable-next-line no-console
        console.log('[onboarding-test] result', JSON.stringify(result, null, 2));
      }}
    />
  );
}
