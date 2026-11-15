import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

import { api, setSignedOutHandler, type UserRead } from '@/lib/api';

type AuthState = {
  /** 'loading' until the stored session has been checked on startup. */
  status: 'loading' | 'signedOut' | 'signedIn';
  user: UserRead | null;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthState | null>(null);

/**
 * Session state for the whole app. The root layout reads `status` to decide between the
 * sign-in screen and the app, so signing in or out moves the user automatically.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserRead | null>(null);
  const [status, setStatus] = useState<AuthState['status']>('loading');

  useEffect(() => {
    let active = true;
    // The API layer calls this when the session can no longer be renewed (refresh token expired or revoked).
    setSignedOutHandler(() => {
      setUser(null);
      setStatus('signedOut');
    });
    api.restoreSession().then((restored) => {
      if (!active) return;
      setUser(restored);
      setStatus(restored ? 'signedIn' : 'signedOut');
    });
    return () => {
      active = false;
      setSignedOutHandler(null);
    };
  }, []);

  const value: AuthState = {
    status,
    user,
    async signIn(email, password) {
      setUser(await api.signIn({ email, password }));
      setStatus('signedIn');
    },
    async signUp(email, password) {
      setUser(await api.signUp({ email, password }));
      setStatus('signedIn');
    },
    async signOut() {
      await api.signOut();
      setUser(null);
      setStatus('signedOut');
    },
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
