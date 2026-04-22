'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { api, ApiError } from '@/lib/api';
import { useMasterData, MasterDataProvider } from '@/lib/master-data';
import { useAuthStore } from '@/lib/auth-store';
import { Button } from '@/components/ui/button';
import type { User } from '@/lib/types';

function CompleteProfileForm() {
  const router = useRouter();
  const { data: master, isLoading: masterLoading } = useMasterData();
  const { setUser } = useAuthStore();

  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [form, setForm] = useState({
    phone: '',
    dob: '',
    gender_id: '',
    qualification_id: '',
    department_id: '',
    join_date: new Date().toISOString().slice(0, 10),
    new_password: '',
    confirm_password: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      router.replace('/login');
      return;
    }
    try {
      const base64Url = token.split('.')[1];
      const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
      const payload = JSON.parse(atob(base64));
      if (!payload.email) {
        router.replace('/login');
        return;
      }
      setEmail(payload.email);
      setName(payload.name ?? '');
      // If the token says activation isn't needed, route to dashboard
      if (payload.first_login_required === false && payload.is_active) {
        router.replace('/dashboard');
      }
    } catch {
      router.replace('/login');
    }
  }, [router]);

  function update(field: keyof typeof form, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');

    // Client-side validation
    if (
      !form.phone.trim() ||
      !form.dob ||
      !form.gender_id ||
      !form.qualification_id ||
      !form.department_id ||
      !form.join_date
    ) {
      setError('Please fill in all required fields.');
      return;
    }
    if (!/^(\+?\d{10,15})$/.test(form.phone.replace(/\s/g, ''))) {
      setError('Please enter a valid phone number (10+ digits).');
      return;
    }
    if (form.new_password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    if (
      !/[A-Za-z]/.test(form.new_password) ||
      !/\d/.test(form.new_password)
    ) {
      setError('Password must include at least one letter and one digit.');
      return;
    }
    if (form.new_password !== form.confirm_password) {
      setError('Passwords do not match.');
      return;
    }

    setSubmitting(true);
    try {
      const result = await api.post<{
        token: string;
        user: User & { first_login_required: boolean };
      }>('/auth/activate-account', {
        phone: form.phone.trim(),
        dob: form.dob,
        gender_id: form.gender_id,
        qualification_id: form.qualification_id,
        department_id: form.department_id,
        join_date: form.join_date,
        new_password: form.new_password,
        confirm_password: form.confirm_password,
      });
      localStorage.setItem('token', result.token);
      setUser(result.user);
      // Land on /profile so the employee can fill in the remaining optional
      // fields (marital status, addresses, emergency contact, statutory IDs,
      // family, documents, bank details) before navigating elsewhere.
      router.replace('/profile?welcome=1');
    } catch (e) {
      const err = e as ApiError;
      setError(err.message || 'Activation failed. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  if (masterLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-neutral-bg">
        <div className="animate-spin h-8 w-8 border-4 border-accent border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-neutral-bg p-4">
      <div className="w-full max-w-2xl rounded-xl border border-border bg-card-bg p-8 shadow-sm">
        <h1 className="text-2xl font-bold text-text-primary">
          Complete Your Profile
        </h1>
        <p className="mt-2 text-sm text-text-secondary">
          Welcome {name ? name : 'aboard'}! Fill in your details and set a new
          password. Signed in as <span className="font-medium">{email}</span>.
        </p>

        {error && (
          <div className="mt-4 rounded-lg bg-[#fee2e2] px-4 py-3 text-sm text-[#991b1b]">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-text-primary">
                Phone *
              </label>
              <input
                type="tel"
                required
                value={form.phone}
                onChange={(e) => update('phone', e.target.value)}
                className="mt-1 w-full rounded-lg border border-border bg-white px-3 py-2 text-sm"
                placeholder="+91 98765 43210"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-text-primary">
                Date of Birth *
              </label>
              <input
                type="date"
                required
                value={form.dob}
                onChange={(e) => update('dob', e.target.value)}
                className="mt-1 w-full rounded-lg border border-border bg-white px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-text-primary">
                Gender *
              </label>
              <select
                required
                value={form.gender_id}
                onChange={(e) => update('gender_id', e.target.value)}
                className="mt-1 w-full rounded-lg border border-border bg-white px-3 py-2 text-sm"
              >
                <option value="">Select…</option>
                {master.genders.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-text-primary">
                Qualification *
              </label>
              <select
                required
                value={form.qualification_id}
                onChange={(e) => update('qualification_id', e.target.value)}
                className="mt-1 w-full rounded-lg border border-border bg-white px-3 py-2 text-sm"
              >
                <option value="">Select…</option>
                {master.qualifications.map((q) => (
                  <option key={q.id} value={q.id}>
                    {q.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-text-primary">
                Department *
              </label>
              <select
                required
                value={form.department_id}
                onChange={(e) => update('department_id', e.target.value)}
                className="mt-1 w-full rounded-lg border border-border bg-white px-3 py-2 text-sm"
              >
                <option value="">Select…</option>
                {master.departments.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-text-primary">
                Joining Date *
              </label>
              <input
                type="date"
                required
                value={form.join_date}
                onChange={(e) => update('join_date', e.target.value)}
                className="mt-1 w-full rounded-lg border border-border bg-white px-3 py-2 text-sm"
              />
            </div>
          </div>

          <div className="pt-4 border-t border-border">
            <h2 className="text-sm font-semibold text-text-primary">
              Set a new password
            </h2>
            <p className="mt-1 text-xs text-text-secondary">
              Min 8 characters, must include at least one letter and one digit.
              Must differ from the invite password.
            </p>
            <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-text-primary">
                  New Password *
                </label>
                <input
                  type="password"
                  required
                  minLength={8}
                  value={form.new_password}
                  onChange={(e) => update('new_password', e.target.value)}
                  className="mt-1 w-full rounded-lg border border-border bg-white px-3 py-2 text-sm"
                  autoComplete="new-password"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-text-primary">
                  Confirm Password *
                </label>
                <input
                  type="password"
                  required
                  minLength={8}
                  value={form.confirm_password}
                  onChange={(e) => update('confirm_password', e.target.value)}
                  className="mt-1 w-full rounded-lg border border-border bg-white px-3 py-2 text-sm"
                  autoComplete="new-password"
                />
              </div>
            </div>
          </div>

          <div className="pt-2">
            <Button
              type="submit"
              variant="primary"
              isLoading={submitting}
              disabled={submitting}
              className="w-full"
            >
              {submitting ? 'Activating…' : 'Complete & Continue'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function CompleteProfilePage() {
  return (
    <MasterDataProvider>
      <CompleteProfileForm />
    </MasterDataProvider>
  );
}
