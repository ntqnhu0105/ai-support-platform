import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { ApiError } from './api';
import { useAuth } from './auth';

/** For pages that need a signed-in user: visitors without a session go to the login page. */
export function useRequireSession() {
  const router = useRouter();
  const auth = useAuth();
  const { status } = auth.state;

  useEffect(() => {
    if (status === 'anonymous') router.replace('/login');
  }, [status, router]);

  return auth;
}

/** If the API says the session is over (401 after a renewal attempt), sign out and go to login. */
export function useRedirectWhenSessionExpires(error: unknown): void {
  const router = useRouter();
  const { logout } = useAuth();
  const expired = error instanceof ApiError && error.status === 401;

  useEffect(() => {
    if (!expired) return;
    void logout().then(() => router.replace('/login'));
  }, [expired, logout, router]);
}