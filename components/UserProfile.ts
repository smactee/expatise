'use client';

export type UserProfile = {
  name: string;
  username: string;
  email: string;
  avatarUrl: string;
};

// For now this is just dummy data.
// Later we'll replace this with data from localStorage / API / etc.
const DEFAULT_PROFILE: UserProfile = {
  name: 'Expat Expertise',
  username: '@Expatise',
  email: 'user@expatise.com',
  avatarUrl: '/images/profile/profile-placeholder.png',
};

export function useUserProfile(): UserProfile {
  // Right now we just return the default.
  // If you want, we can later add useState + useEffect here to
  // read from localStorage and make it truly dynamic.
  return DEFAULT_PROFILE;
}
