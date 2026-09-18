import { useCallback, useEffect, useState } from 'react';

export interface UserProfile {
  name: string;
  role: string;
  email: string;
  phone: string;
  location: string;
  organization: string;
}

export const DEFAULT_PROFILE: UserProfile = {
  name: 'Alex Dev',
  role: 'Operations Lead',
  email: 'alex.dev@company.com',
  phone: '+91 98765 43210',
  location: 'Pune, India',
  organization: 'Main Ledger #04',
};

const STORAGE_KEY = 'user-profile';
export const PROFILE_UPDATED_EVENT = 'profile-updated';

export function loadProfile(): UserProfile {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return { ...DEFAULT_PROFILE, ...JSON.parse(raw) };
  } catch {}
  return { ...DEFAULT_PROFILE };
}

export function saveProfile(profile: UserProfile) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(profile));
  } catch {}
  window.dispatchEvent(new CustomEvent(PROFILE_UPDATED_EVENT, { detail: profile }));
}

export function profileInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'OP';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function useProfile(): UserProfile {
  const [profile, setProfile] = useState<UserProfile>(loadProfile);

  useEffect(() => {
    const onUpdate = (e: Event) => {
      setProfile((e as CustomEvent<UserProfile>).detail ?? loadProfile());
    };
    const onStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY) setProfile(loadProfile());
    };
    window.addEventListener(PROFILE_UPDATED_EVENT, onUpdate);
    window.addEventListener('storage', onStorage);
    return () => {
      window.removeEventListener(PROFILE_UPDATED_EVENT, onUpdate);
      window.removeEventListener('storage', onStorage);
    };
  }, []);

  return profile;
}

export function useProfileSaver() {
  return useCallback((patch: Partial<UserProfile>) => {
    saveProfile({ ...loadProfile(), ...patch });
  }, []);
}
