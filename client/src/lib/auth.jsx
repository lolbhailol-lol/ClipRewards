import { createContext, useCallback, useContext, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api, tokenStore } from './api';
import { firebaseSignOut } from './firebase';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const qc = useQueryClient();
  const hasToken = Boolean(tokenStore.get());

  const me = useQuery({
    queryKey: ['me'],
    queryFn: () => api('/auth/me'),
    enabled: hasToken,
    retry: false,
    staleTime: 60_000,
  });

  // A rejected token means the session is over.
  if (me.error?.status === 401) tokenStore.clear();

  const signIn = useCallback(
    ({ token, user, brand = null }) => {
      tokenStore.set(token);
      // Full /me payload comes back with the sign-in, so nothing needs refetching.
      qc.setQueryData(['me'], { user, brand });
    },
    [qc]
  );

  const signOut = useCallback(async () => {
    tokenStore.clear();
    qc.clear();
    await firebaseSignOut();
    window.location.assign('/');
  }, [qc]);

  const value = useMemo(
    () => ({
      user: me.data?.user ?? null,
      brand: me.data?.brand ?? null,
      loading: hasToken && me.isPending,
      refresh: () => qc.invalidateQueries({ queryKey: ['me'] }),
      setMe: (data) => qc.setQueryData(['me'], (old) => ({ ...old, ...data })),
      signIn,
      signOut,
    }),
    [me.data, me.isPending, hasToken, qc, signIn, signOut]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);

const NEXT_KEY = 'cr_next';

/** Remember where to return after sign-in/onboarding (e.g. the campaign they tapped). */
export function rememberNext(path) {
  try {
    sessionStorage.setItem(NEXT_KEY, path);
  } catch {
    /* ignore */
  }
}

/** Read and clear the remembered path. Only in-app paths are returned. */
export function takeNext() {
  try {
    const next = sessionStorage.getItem(NEXT_KEY);
    sessionStorage.removeItem(NEXT_KEY);
    return next && next.startsWith('/') && !next.startsWith('//') && !next.startsWith('/\\') ? next : null;
  } catch {
    return null;
  }
}

/** Where a signed-in user should land next. */
export function homeFor(user) {
  if (!user) return '/login';
  if (!user.role) return '/welcome';
  if (!user.onboarded) return `/onboarding/${user.role}`;
  if (user.role === 'creator') return '/app';
  if (user.role === 'brand') return '/brand';
  return '/admin';
}
