'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { api, ApiError } from '@/lib/api';
import { useAuthStore } from '@/lib/auth-store';
import { Button } from '@/components/ui/button';
import type { User } from '@/lib/types';

/**
 * /reset-password — for already-activated employees whose password was
 * reset by an admin. Distinct from /complete-profile (used for fresh
 * invites where the user also has to fill the rest of the profile).
 *
 * The user reaches this page after:
 *   1. Admin clicks "Reset Password" on the employees list.
 *   2. Backend generates a temp password, sets first_login_required=true,
 *      emails the credentials.
 *   3. User logs in with the temp password.
 *   4. Login page sees `is_active && first_login_required` and redirects
 *      here instead of /complete-profile.
 *
 * The form only asks for the new password + confirmation. The current
 * (temp) password isn't needed because possession of a valid JWT —
 * obtained by logging in with the temp password moments ago — is already
 * proof of possession.
 */
export default function ResetPasswordPage() {
  const router = useRouter();
  const { setUser } = useAuthStore();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const token =
      typeof window !== 'undefined' ? localStorage.getItem('token') : null;
    if (!token) {
      router.replace('/login');
      return;
    }
    try {
      const part = token.split('.')[1];
      const payload = JSON.parse(
        atob(part.replace(/-/g, '+').replace(/_/g, '/')),
      );
      // Sanity guard: this page is only meaningful when the JWT has
      // first_login_required=true. If a normal user lands here we send
      // them on. Users who haven't activated yet should be on
      // /complete-profile instead.
      if (!payload.first_login_required) {
        router.replace('/dashboard');
        return;
      }
      if (payload.is_active === false) {
        router.replace('/complete-profile');
        return;
      }
      setEmail(payload.email ?? '');
      setName(payload.name ?? '');
    } catch {
      router.replace('/login');
    }
  }, [router]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError('');

    if (newPassword.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    if (!/[A-Za-z]/.test(newPassword) || !/\d/.test(newPassword)) {
      setError('Password must include at least one letter and one digit.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setSubmitting(true);
    try {
      const result = await api.post<{
        token: string;
        user: User;
        changed_at: string;
      }>('/auth/finish-password-reset', {
        new_password: newPassword,
        confirm_password: confirmPassword,
      });
      // Backend bumps tokens_valid_from on this call, so we must swap
      // the stored token immediately or the next request will 401.
      localStorage.setItem('token', result.token);
      setUser(result.user);
      router.replace('/dashboard');
    } catch (e) {
      const err = e as ApiError;
      setError(err.message || 'Could not reset password. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-neutral-bg px-4">
      <div className="w-full max-w-md rounded-xl border border-border bg-card-bg p-8 shadow-sm">
        <h1 className="text-xl font-bold text-text-primary">
          Set a new password
        </h1>
        <p className="mt-2 text-sm text-text-secondary">
          {name ? `Hi ${name}, your` : 'Your'} HR admin has reset your password.
          Choose a new one to finish the reset. You&apos;ll be signed in
          immediately afterwards.
        </p>
        {email && (
          <p className="mt-2 text-xs text-text-secondary">
            Signed in as <span className="font-medium">{email}</span>.
          </p>
        )}

        {error && (
          <div className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </div>
        )}

        <form onSubmit={submit} className="mt-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-text-primary">
              New Password *
            </label>
            <input
              type="password"
              required
              minLength={8}
              autoComplete="new-password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="mt-1 w-full rounded-lg border border-border bg-white px-3 py-2 text-sm"
            />
            <p className="mt-1 text-xs text-text-secondary">
              At least 8 characters, with one letter and one digit. Must
              differ from the temporary password from the email.
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-text-primary">
              Confirm New Password *
            </label>
            <input
              type="password"
              required
              minLength={8}
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="mt-1 w-full rounded-lg border border-border bg-white px-3 py-2 text-sm"
            />
          </div>

          <Button
            type="submit"
            variant="primary"
            isLoading={submitting}
            disabled={submitting || !newPassword || !confirmPassword}
            className="w-full"
          >
            {submitting ? 'Saving…' : 'Set new password'}
          </Button>
        </form>
      </div>
    </div>
  );
}
