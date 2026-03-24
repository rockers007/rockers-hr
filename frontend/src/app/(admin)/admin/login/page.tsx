'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { api, ApiError } from '@/lib/api';
import { useAuthStore } from '@/lib/auth-store';
import { Button } from '@/components/ui/button';
import type { AdminUser } from '@/lib/types';

export default function AdminLoginPage() {
  const router = useRouter();
  const { setAdminUser } = useAuthStore();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');

    if (!email.trim() || !password) {
      setError('Please enter email and password.');
      return;
    }

    setSubmitting(true);
    try {
      const result = await api.post<{ token: string; user: AdminUser }>('/admin/auth/login', {
        email: email.trim(),
        password,
      });
      localStorage.setItem('token', result.token);
      setAdminUser(result.user);
      router.replace('/admin/overview');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Login failed. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-neutral-bg">
      <div className="w-full max-w-md rounded-xl border border-border bg-card-bg p-8 shadow-sm">
        <div className="text-center mb-8">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-xl bg-primary text-white text-2xl font-bold">
            R
          </div>
          <h1 className="text-2xl font-bold text-text-primary">Admin Login</h1>
          <p className="mt-2 text-sm text-text-secondary">Rockers HR Administration</p>
        </div>

        {error && (
          <div className="mb-6 rounded-lg bg-[#fee2e2] px-4 py-3 text-sm text-[#991b1b]">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-text-primary mb-1">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="admin@rockershr.com"
              autoComplete="email"
              className="w-full rounded-lg border border-border px-3 py-2.5 text-sm focus:border-accent focus:ring-1 focus:ring-accent outline-none"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-text-primary mb-1">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter your password"
              autoComplete="current-password"
              className="w-full rounded-lg border border-border px-3 py-2.5 text-sm focus:border-accent focus:ring-1 focus:ring-accent outline-none"
            />
          </div>

          <Button type="submit" size="lg" isLoading={submitting} className="w-full">
            Sign In
          </Button>
        </form>

        <div className="mt-6 pt-6 border-t border-border text-center">
          <a
            href="/login"
            className="text-sm text-text-secondary hover:text-accent transition-colors"
          >
            Employee Login
          </a>
        </div>
      </div>
    </div>
  );
}
