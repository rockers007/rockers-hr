'use client';

import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { api, ApiError } from '@/lib/api';
import { useAuthStore } from '@/lib/auth-store';
import type { User } from '@/lib/types';

function LoginInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { isAuthenticated, isLoading, fetchUser, setUser } = useAuthStore();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  // Pre-fill email when the user clicks the invite link
  useEffect(() => {
    const hintedEmail = searchParams.get('email');
    if (hintedEmail) setEmail(hintedEmail);
  }, [searchParams]);

  useEffect(() => {
    fetchUser();
  }, [fetchUser]);

  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      // Three possible destinations after a login flips isAuthenticated true:
      //   - /complete-profile  : fresh invite (is_active=false, first_login_required=true)
      //   - /reset-password    : admin-triggered reset (is_active=true,  first_login_required=true)
      //   - /dashboard         : everyone else
      // Source of truth is the JWT we just stored; this effect runs after
      // submit() and would otherwise race the redirect, sending new users
      // to /dashboard even when they're not done activating.
      const token =
        typeof window !== 'undefined' ? localStorage.getItem('token') : null;
      let firstLoginRequired = false;
      let isActive = true;
      if (token) {
        try {
          const part = token.split('.')[1];
          const payload = JSON.parse(
            atob(part.replace(/-/g, '+').replace(/_/g, '/')),
          );
          firstLoginRequired = payload?.first_login_required === true;
          isActive = payload?.is_active !== false;
        } catch {
          /* ignore parse errors, fall through to /dashboard */
        }
      }
      const dest = !firstLoginRequired
        ? '/dashboard'
        : isActive
          ? '/reset-password'
          : '/complete-profile';
      router.replace(dest);
    }
  }, [isLoading, isAuthenticated, router]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      const result = await api.post<{
        token: string;
        user: User & { first_login_required?: boolean; is_active?: boolean };
        first_login_required: boolean;
      }>('/auth/login/email', { email: email.trim(), password });

      localStorage.setItem('token', result.token);
      setUser(result.user);

      // Same three-way branch as the effect above. is_active comes off
      // result.user when present; default true so we err towards
      // /reset-password rather than the fuller /complete-profile form.
      if (result.first_login_required) {
        const userActive = result.user?.is_active !== false;
        router.replace(userActive ? '/reset-password' : '/complete-profile');
      } else {
        router.replace('/dashboard');
      }
    } catch (e) {
      const err = e as ApiError;
      if (err.code === 'ACCOUNT_INACTIVE') {
        setError('Your account is inactive. Please contact HR.');
      } else if (err.code === 'ACCOUNT_LOCKED') {
        // Backend includes the minutes-remaining message verbatim.
        setError(err.message);
      } else if (err.code === 'INVALID_CREDENTIALS') {
        // Backend message includes the remaining-attempts hint.
        setError(err.message || 'Invalid email or password.');
      } else {
        setError('Invalid email or password.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-neutral-bg px-4">
      <div className="w-full max-w-md rounded-xl border border-border bg-card-bg p-8 shadow-sm">
        <img
          src="/images/logo-2x.png"
          alt="Rockers Technologies"
          className="mx-auto mb-6"
          style={{ width: '220px', height: 'auto' }}
        />
        <h1 className="text-center text-xl font-bold text-text-primary">
          HR Management System
        </h1>
        <p className="mt-1 text-center text-sm text-text-secondary">
          Sign in with your email and password
        </p>

        <form onSubmit={submit} className="mt-6 space-y-4">
          <div>
            <label
              htmlFor="login-email"
              className="block text-sm font-medium text-text-primary"
            >
              Email
            </label>
            <input
              id="login-email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1 w-full rounded-lg border border-border bg-white px-3 py-2 text-sm text-text-primary focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              placeholder="you@example.com"
            />
          </div>
          <div>
            <label
              htmlFor="login-password"
              className="block text-sm font-medium text-text-primary"
            >
              Password
            </label>
            <input
              id="login-password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1 w-full rounded-lg border border-border bg-white px-3 py-2 text-sm text-text-primary focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              placeholder="••••••••"
            />
            <p className="mt-1 text-xs text-text-secondary">
              First-time login? Use the password sent to your email — you&apos;ll be
              prompted to set a new one after logging in.
            </p>
          </div>

          {error && (
            <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={submitting || !email || !password}
            className="w-full rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-blue-900 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting ? 'Signing in…' : 'Sign In'}
          </button>
        </form>

        {/*
          Legacy Google-registered login has been hidden per v2.0 admin-invite
          flow. Keep the markup commented so we can restore it if legacy users
          still need a fallback in future.

          <div className="mt-6 border-t border-border pt-4 text-center">
            <p className="mb-2 text-xs text-text-secondary">
              Legacy Google-registered users only:
            </p>
            <a
              href="/api/v1/auth/google"
              className="inline-flex items-center gap-2 text-sm font-medium text-accent hover:underline"
            >
              <svg className="h-4 w-4" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" />
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
              </svg>
              Continue with Google
            </a>
          </div>
        */}
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-neutral-bg">
          <div className="text-sm text-text-secondary">Loading…</div>
        </div>
      }
    >
      <LoginInner />
    </Suspense>
  );
}
