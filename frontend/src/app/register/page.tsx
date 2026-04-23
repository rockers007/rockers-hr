'use client';

import { useState, useEffect, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { api, ApiError } from '@/lib/api';
import { useMasterData, MasterDataProvider } from '@/lib/master-data';
import { Button } from '@/components/ui/button';
import { maxDobDate, validateDob } from '@/lib/utils';
import type { MasterRecord } from '@/lib/types';

function RegistrationForm() {
  const router = useRouter();
  const { data: master, isLoading: masterLoading } = useMasterData();

  const [form, setForm] = useState({
    name: '',
    phone: '',
    dob: '',
    qualification_id: '',
    qualification_specify: '',
    gender_id: '',
    role_type_id: '',
    department_id: '',
    extra_info: '',
  });
  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  // Get email from the temp JWT (set during OAuth callback)
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
      if (payload.email) {
        setEmail(payload.email);
      } else {
        router.replace('/login');
      }
    } catch {
      router.replace('/login');
    }
  }, [router]);

  const selectedQualification = master.qualifications.find((q) => q.id === form.qualification_id);
  const showSpecify = selectedQualification?.label?.toLowerCase() === 'other';

  function update(field: string, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');

    if (!form.name.trim() || !form.phone.trim() || !form.dob || !form.qualification_id || !form.gender_id || !form.role_type_id) {
      setError('Please fill in all required fields.');
      return;
    }

    if (!/^(\+?\d{10,15})$/.test(form.phone.replace(/\s/g, ''))) {
      setError('Please enter a valid phone number (10+ digits).');
      return;
    }

    const dobErr = validateDob(form.dob);
    if (dobErr) {
      setError(dobErr);
      return;
    }
    const dobDate = new Date(form.dob);
    const age = (Date.now() - dobDate.getTime()) / (365.25 * 24 * 60 * 60 * 1000);
    if (age < 18) {
      setError('You must be at least 18 years old.');
      return;
    }

    setSubmitting(true);
    try {
      await api.post('/users/register', {
        name: form.name.trim(),
        phone: form.phone.trim(),
        dob: form.dob,
        qualification_id: form.qualification_id,
        gender_id: form.gender_id,
        role_type_id: form.role_type_id,
        department_id: form.department_id || null,
        extra_info: form.extra_info.trim() || null,
      });
      router.push('/register/pending');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Registration failed. Please try again.');
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
        <h1 className="text-2xl font-bold text-text-primary">Complete Your Profile</h1>
        <p className="mt-2 text-sm text-text-secondary">
          Fill in your details to complete registration. Fields marked with * are required.
        </p>

        {error && (
          <div className="mt-4 rounded-lg bg-[#fee2e2] px-4 py-3 text-sm text-[#991b1b]">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-6 space-y-5">
          {/* Gmail (read-only) */}
          <div>
            <label className="block text-sm font-medium text-text-primary mb-1">Gmail Address</label>
            <input
              type="email"
              value={email}
              disabled
              className="w-full rounded-lg border border-border bg-gray-50 px-3 py-2.5 text-sm text-text-secondary"
            />
          </div>

          {/* Full Name */}
          <div>
            <label className="block text-sm font-medium text-text-primary mb-1">Full Name *</label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => update('name', e.target.value)}
              placeholder="Enter your full name"
              className="w-full rounded-lg border border-border px-3 py-2.5 text-sm focus:border-accent focus:ring-1 focus:ring-accent outline-none"
            />
          </div>

          {/* Phone */}
          <div>
            <label className="block text-sm font-medium text-text-primary mb-1">Phone Number *</label>
            <input
              type="tel"
              value={form.phone}
              onChange={(e) => update('phone', e.target.value)}
              placeholder="9876543210"
              className="w-full rounded-lg border border-border px-3 py-2.5 text-sm focus:border-accent focus:ring-1 focus:ring-accent outline-none"
            />
          </div>

          {/* DOB */}
          <div>
            <label className="block text-sm font-medium text-text-primary mb-1">Date of Birth *</label>
            <input
              type="date"
              value={form.dob}
              max={maxDobDate()}
              onChange={(e) => update('dob', e.target.value)}
              className="w-full rounded-lg border border-border px-3 py-2.5 text-sm focus:border-accent focus:ring-1 focus:ring-accent outline-none"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            {/* Qualification */}
            <div>
              <label className="block text-sm font-medium text-text-primary mb-1">Highest Degree *</label>
              <SelectField
                options={master.qualifications}
                value={form.qualification_id}
                onChange={(v) => update('qualification_id', v)}
                placeholder="Select degree"
              />
            </div>

            {/* Gender */}
            <div>
              <label className="block text-sm font-medium text-text-primary mb-1">Gender *</label>
              <SelectField
                options={master.genders}
                value={form.gender_id}
                onChange={(v) => update('gender_id', v)}
                placeholder="Select gender"
              />
            </div>

            {/* Role Type */}
            <div>
              <label className="block text-sm font-medium text-text-primary mb-1">Role Type *</label>
              <SelectField
                options={master.role_types}
                value={form.role_type_id}
                onChange={(v) => update('role_type_id', v)}
                placeholder="Select role"
              />
            </div>

            {/* Department */}
            <div>
              <label className="block text-sm font-medium text-text-primary mb-1">Department</label>
              <SelectField
                options={master.departments}
                value={form.department_id}
                onChange={(v) => update('department_id', v)}
                placeholder="Select department"
              />
            </div>
          </div>

          {/* Qualification specify */}
          {showSpecify && (
            <div>
              <label className="block text-sm font-medium text-text-primary mb-1">Specify Degree *</label>
              <input
                type="text"
                value={form.qualification_specify}
                onChange={(e) => update('qualification_specify', e.target.value)}
                placeholder="Enter your degree"
                className="w-full rounded-lg border border-border px-3 py-2.5 text-sm focus:border-accent focus:ring-1 focus:ring-accent outline-none"
              />
            </div>
          )}

          {/* Extra Info */}
          <div>
            <label className="block text-sm font-medium text-text-primary mb-1">Additional Information</label>
            <textarea
              value={form.extra_info}
              onChange={(e) => update('extra_info', e.target.value)}
              rows={3}
              placeholder="Any additional info you'd like to share"
              className="w-full rounded-lg border border-border px-3 py-2.5 text-sm focus:border-accent focus:ring-1 focus:ring-accent outline-none resize-none"
            />
          </div>

          <Button type="submit" size="lg" isLoading={submitting} className="w-full">
            Submit Profile
          </Button>
        </form>
      </div>
    </div>
  );
}

function SelectField({
  options,
  value,
  onChange,
  placeholder,
}: {
  options: MasterRecord[];
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full rounded-lg border border-border px-3 py-2.5 text-sm focus:border-accent focus:ring-1 focus:ring-accent outline-none bg-white"
    >
      <option value="">{placeholder}</option>
      {options.map((opt) => (
        <option key={opt.id} value={opt.id}>
          {opt.label}
        </option>
      ))}
    </select>
  );
}

export default function RegisterPage() {
  return (
    <MasterDataProvider>
      <RegistrationForm />
    </MasterDataProvider>
  );
}
