'use client';

import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';

type UserProfileContextValue = {
  name: string;
  email: string;
  avatarUrl: string | null;
  setName: (name: string) => void;
  setEmail: (email: string) => void;
  setAvatarUrl: (url: string | null) => void;
};

const UserProfileContext = createContext<UserProfileContextValue | undefined>(
  undefined
);

const STORAGE_KEY = 'expatise-user-profile';

export function UserProfileProvider({ children }: { children: ReactNode }) {
  const [name, setName] = useState('@Expatise');
  const [email, setEmail] = useState('user@expatise.com');
  const [avatarUrl, setAvatarUrlState] = useState<string | null>(null);

  // load from localStorage on first client render
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return;

    try {
      const parsed = JSON.parse(raw) as {
        name?: string;
        email?: string;
        avatarUrl?: string | null;
      };

      if (parsed.name) setName(parsed.name);
      if (parsed.email) setEmail(parsed.email);
      if (parsed.avatarUrl) setAvatarUrlState(parsed.avatarUrl);
    } catch {
      // ignore bad JSON
    }
  }, []);

  // save to localStorage whenever something changes
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const payload = JSON.stringify({ name, email, avatarUrl });
    window.localStorage.setItem(STORAGE_KEY, payload);
  }, [name, email, avatarUrl]);

  const setAvatarUrl = (url: string | null) => {
    setAvatarUrlState(url);
  };

  const value: UserProfileContextValue = {
    name,
    email,
    avatarUrl,
    setName,
    setEmail,
    setAvatarUrl,
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
