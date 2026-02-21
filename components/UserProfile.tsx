//components/UserProfile.tsx
'use client';

import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useMemo,
  type ReactNode,
} from 'react';
import { useUserKey } from '@/components/useUserKey.client';

type UserProfileContextValue = {
  name: string;
  email: string;
  avatarUrl: string | null;
  setName: (name: string) => void;
  setEmail: (email: string) => void;
  setAvatarUrl: (url: string | null) => void;
  saveProfile: () => void;
  clearProfile: () => void;
};

const UserProfileContext = createContext<UserProfileContextValue | undefined>(
  undefined
);

const STORAGE_KEY = 'expatise-user-profile';

export function UserProfileProvider({ children }: { children: ReactNode }) {
  const [name, setName] = useState('@Expatise');
  const [email, setEmail] = useState('user@expatise.com');
  const [avatarUrl, setAvatarUrlState] = useState<string | null>(null);
const userKey = useUserKey();
const storageKey = useMemo(() => `${STORAGE_KEY}:${userKey || 'guest'}`, [userKey]);

const hydrate = useCallback(() => {
  if (typeof window === 'undefined') return;

  // reset defaults first so switching accounts doesn't "leak" prior user
  setName('@Expatise');
  setEmail('user@expatise.com');
  setAvatarUrlState(null);

  const raw = window.localStorage.getItem(storageKey);
  if (!raw) return;

  try {
    const parsed = JSON.parse(raw) as {
      name?: string;
      email?: string;
      avatarUrl?: string | null;
    };

    if (parsed.name) setName(parsed.name);
    if (parsed.email) setEmail(parsed.email);
    if ('avatarUrl' in parsed) setAvatarUrlState(parsed.avatarUrl ?? null);
  } catch {
    // ignore bad JSON
  }
}, [storageKey]);
  // load from localStorage on first client render
useEffect(() => {
  hydrate();
}, [hydrate]);

useEffect(() => {
  const onSessionChanged = () => hydrate();
  window.addEventListener('expatise:session-changed', onSessionChanged);
  return () => window.removeEventListener('expatise:session-changed', onSessionChanged);
}, [hydrate]);



  const setAvatarUrl = (url: string | null) => {
    setAvatarUrlState(url);
  };

  const saveProfile = () => {
    if (typeof window === 'undefined') return;
    const payload = JSON.stringify({ name, email, avatarUrl });
    window.localStorage.setItem(storageKey, payload);
  };

  const clearProfile = () => {
    if (typeof window === 'undefined') return;
    window.localStorage.removeItem(storageKey);
    setName('@Expatise');
    setEmail('user@expatise.com');
    setAvatarUrlState(null);
  };


  const value: UserProfileContextValue = {
    name,
    email,
    avatarUrl,
    setName,
    setEmail,
    setAvatarUrl,
    saveProfile,
    clearProfile
  };

  return (
    <UserProfileContext.Provider value={value}>
      {children}
    </UserProfileContext.Provider>
  );
}

export function useUserProfile() {
  const ctx = useContext(UserProfileContext);
  if (!ctx) {
    throw new Error('useUserProfile must be used inside <UserProfileProvider>');
  }
  return ctx;
}
