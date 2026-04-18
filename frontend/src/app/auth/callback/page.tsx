'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuthStore } from '@/lib/auth-store';
import { Spinner } from '@/components/ui/spinner';

function CallbackHandler() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { fetchUser } = useAuthStore();
  const [error, setError] = useState('');

  useEffect(() => {
    const status = searchParams.get('status');
    const token = searchParams.get('token');
    const errorMsg = searchParams.get('error');

    console.log('[auth/callback] status:', status, 'token:', token ? 'present' : 'missing', 'error:', errorMsg);

    if (errorMsg) {
      setError(errorMsg);
      return;
    }

    // Store the JWT token for API requests
    if (token) {
      localStorage.setItem('token', token);
    }

    if (status === 'registration_required') {
      router.replace('/register');
      return;
    }

    if (status === 'pending_activation') {
      router.replace('/register/pending');
      return;
    }

    if (!token) {
      setError('No authentication token received. Please try again.');
      return;
    }

    console.log('[auth/callback] Fetching user...');
    fetchUser().then(() => {
      console.log('[auth/callback] User fetched, redirecting to dashboard');
      router.replace('/dashboard');
    }).catch((err) => {
      console.error('[auth/callback] fetchUser failed:', err);
      setError('Authentication failed. Please try again.');
    });
  }, [searchParams, router, fetchUser]);

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-neutral-bg">
        <div className="w-full max-w-md rounded-xl border border-border bg-card-bg p-8 shadow-sm text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-[#fee2e2]">
            <svg className="h-8 w-8 text-[#991b1b]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
            </svg>
          </div>
          <h1 className="text-xl font-bold text-text-primary">Authentication Error</h1>
          <p className="mt-3 text-sm text-text-secondary">{error}</p>
          <a
            href="/login"
            className="mt-6 inline-block text-sm font-medium text-accent hover:underline"
          >
            Back to Login
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-neutral-bg">
      <div className="flex flex-col items-center gap-4">
        <Spinner size="lg" />
        <p className="text-sm text-text-secondary">Signing you in...</p>
      </div>
    </div>
  );
}

export default function AuthCallbackPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-neutral-bg">
          <Spinner size="lg" />
        </div>
      }
    >
      <CallbackHandler />
    </Suspense>
  );
}
