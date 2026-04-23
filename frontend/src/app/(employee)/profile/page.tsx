'use client';

import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { useSearchParams } from 'next/navigation';
import { useAuthStore } from '@/lib/auth-store';
import { api, ApiError } from '@/lib/api';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { PageLoader } from '@/components/ui/spinner';
import { MasterDataProvider, useMasterData } from '@/lib/master-data';
import { getInitials } from '@/lib/utils';
import type { MasterRecord } from '@/lib/types';

interface ProfileData {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  dob: string | null;
  gender: { id: string; label: string } | null;
  qualification: { id: string; label: string } | null;
  department: { id: string; label: string } | null;
  join_date: string | null;
  emp_number: string | null;
  designation: string | null;
  marital_status_id: string | null;
  current_address: string | null;
  permanent_address: string | null;
  emergency_phone: string | null;
  pf_uan_no: string | null;
  esic_no: string | null;
  bank_name: string | null;
  bank_account_no: string | null;
  bank_ifsc: string | null;
  photo_s3_key: string | null;
  photo_url: string | null;
}

interface FamilyMember {
  id: string;
  name: string;
  relation: string;
  occupation: string | null;
  dob: string | null;
  contact_no: string | null;
}

interface UserDoc {
  id: string;
  document_type_id: string;
  document_type_label?: string | null;
  label: string | null;
  s3_key: string;
  file_size_bytes: number | null;
  mime_type: string | null;
  uploaded_at: string;
}

function ProfileInner() {
  const { data: master } = useMasterData();
  const searchParams = useSearchParams();
  const welcome = searchParams.get('welcome') === '1';
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [family, setFamily] = useState<FamilyMember[]>([]);
  const [docs, setDocs] = useState<UserDoc[]>([]);
  const [maritalStatuses, setMaritalStatuses] = useState<MasterRecord[]>([]);
  const [docTypes, setDocTypes] = useState<MasterRecord[]>([]);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [me, fam, d, maritals, docTypesRes] = await Promise.all([
        api.get<ProfileData>('/users/me'),
        api.get<FamilyMember[]>('/users/me/family').catch(() => []),
        api.get<UserDoc[]>('/users/me/documents').catch(() => []),
        api.get<MasterRecord[]>('/master/marital_statuses').catch(() => []),
        api.get<MasterRecord[]>('/master/document_types').catch(() => []),
      ]);
      setProfile(me);
      setFamily(fam);
      setDocs(d);
      setMaritalStatuses(maritals);
      setDocTypes(docTypesRes);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (loading || !profile) return <PageLoader />;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-text-primary">My Profile</h1>
        <p className="mt-1 text-sm text-text-secondary">
          Keep your contact details, family info, documents and bank details up to date.
          Employee Number and Email are managed by HR and shown read-only.
        </p>
      </div>

      {welcome && (
        <div className="rounded-lg border border-[#bae6fd] bg-[#f0f9ff] px-4 py-3 text-sm text-[#0c4a6e]">
          <strong>Welcome aboard!</strong> Your account is now active. Please take a
          minute to fill in the remaining details below — address, emergency
          contact, statutory IDs, family members, documents and bank details —
          so HR has everything on record.
        </div>
      )}

      {error && (
        <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}
      {success && (
        <div className="rounded-lg bg-green-50 px-4 py-3 text-sm text-green-800">
          {success}
        </div>
      )}

      {/* Header */}
      <Card className="flex flex-col items-center gap-4 sm:flex-row sm:items-start">
        <PhotoUploader
          profile={profile}
          setProfile={setProfile}
          setError={setError}
          setSuccess={setSuccess}
        />
        <div className="text-center sm:text-left">
          <h2 className="text-xl font-semibold text-text-primary">{profile.name}</h2>
          <p className="text-sm text-text-secondary">{profile.email}</p>
          <div className="mt-1 flex flex-wrap gap-2 text-xs text-text-secondary">
            {profile.emp_number && (
              <span className="rounded bg-gray-100 px-2 py-0.5 font-mono">
                {profile.emp_number}
              </span>
            )}
            {profile.designation && <span>· {profile.designation}</span>}
          </div>
        </div>
      </Card>

      <PersonalSection
        profile={profile}
        setProfile={setProfile}
        maritalStatuses={maritalStatuses}
        genders={master.genders}
        qualifications={master.qualifications}
        departments={master.departments}
        saving={saving}
        setSaving={setSaving}
        setError={setError}
        setSuccess={setSuccess}
      />

      <BankSection
        profile={profile}
        setProfile={setProfile}
        saving={saving}
        setSaving={setSaving}
        setError={setError}
        setSuccess={setSuccess}
      />

      <FamilySection
        family={family}
        setFamily={setFamily}
        setError={setError}
        setSuccess={setSuccess}
      />

      <DocumentsSection
        docs={docs}
        setDocs={setDocs}
        docTypes={docTypes}
        setError={setError}
        setSuccess={setSuccess}
      />

      <ChangePasswordSection
        setError={setError}
        setSuccess={setSuccess}
      />
    </div>
  );
}

export default function ProfilePage() {
  return (
    <MasterDataProvider>
      <ProfileInner />
    </MasterDataProvider>
  );
}

// =========================================================================
// Change Password — employee self-service
// =========================================================================

function ChangePasswordSection({
  setError,
  setSuccess,
}: {
  setError: (s: string) => void;
  setSuccess: (s: string) => void;
}) {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [saving, setSaving] = useState(false);
  const [localError, setLocalError] = useState('');

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLocalError('');

    if (!currentPassword) {
      setLocalError('Current password is required.');
      return;
    }
    if (newPassword.length < 8) {
      setLocalError('New password must be at least 8 characters.');
      return;
    }
    if (!/[A-Za-z]/.test(newPassword) || !/\d/.test(newPassword)) {
      setLocalError('New password must include a letter and a digit.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setLocalError('New password and confirmation do not match.');
      return;
    }
    if (newPassword === currentPassword) {
      setLocalError('New password must differ from the current password.');
      return;
    }

    setSaving(true);
    try {
      await api.post('/auth/change-password', {
        current_password: currentPassword,
        new_password: newPassword,
        confirm_password: confirmPassword,
      });
      setSuccess('Password updated successfully.');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err) {
      const msg =
        err instanceof ApiError
          ? err.message
          : 'Failed to change password.';
      setLocalError(msg);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <h2 className="text-lg font-semibold text-text-primary">Change Password</h2>
      <p className="mt-1 text-sm text-text-secondary">
        Use a new password you haven't used here before. Minimum 8 characters
        with at least one letter and one digit.
      </p>

      {localError && (
        <div className="mt-3 rounded-lg bg-red-50 px-4 py-2 text-sm text-red-700">
          {localError}
        </div>
      )}

      <form onSubmit={submit} className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div>
          <label className="mb-1 block text-sm font-medium text-text-primary">
            Current Password
          </label>
          <input
            type="password"
            autoComplete="current-password"
            className={inputCls}
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-text-primary">
            New Password
          </label>
          <input
            type="password"
            autoComplete="new-password"
            className={inputCls}
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-text-primary">
            Confirm New Password
          </label>
          <input
            type="password"
            autoComplete="new-password"
            className={inputCls}
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
          />
        </div>
        <div className="sm:col-span-3 flex">
          <Button
            type="submit"
            variant="primary"
            isLoading={saving}
            disabled={
              saving ||
              !currentPassword ||
              !newPassword ||
              !confirmPassword
            }
          >
            Update Password
          </Button>
        </div>
      </form>
    </Card>
  );
}

// =========================================================================
// Profile photo uploader (header avatar)
// =========================================================================

function PhotoUploader({
  profile,
  setProfile,
  setError,
  setSuccess,
}: {
  profile: ProfileData;
  setProfile: (p: ProfileData) => void;
  setError: (s: string) => void;
  setSuccess: (s: string) => void;
}) {
  const [uploading, setUploading] = useState(false);

  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    // Reset input immediately so selecting the same file twice still fires
    e.target.value = '';
    if (!file) return;

    setError('');
    setSuccess('');

    if (!/^image\/(jpe?g|png)$/i.test(file.type)) {
      setError('Photo must be a JPG or PNG image.');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError('Photo must be 5MB or less.');
      return;
    }

    setUploading(true);
    try {
      const pre = await api.post<{ upload_url: string; s3_key: string }>(
        '/uploads/presigned',
        {
          mime_type: file.type,
          file_size_bytes: file.size,
          context: 'profile_photo',
        },
      );
      const putRes = await fetch(pre.upload_url, {
        method: 'PUT',
        headers: { 'Content-Type': file.type },
        body: file,
      });
      if (!putRes.ok) throw new Error('S3 upload failed');

      const updated = await api.patch<ProfileData>('/users/me', {
        photo_s3_key: pre.s3_key,
      });
      setProfile(updated);
      setSuccess('Profile photo updated.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Photo upload failed');
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="flex flex-col items-center gap-2">
      {profile.photo_url ? (
        <img
          src={profile.photo_url}
          alt={profile.name}
          className="h-24 w-24 rounded-full object-cover shadow-sm"
        />
      ) : (
        <div className="flex h-24 w-24 items-center justify-center rounded-full bg-accent text-2xl font-bold text-white">
          {getInitials(profile.name)}
        </div>
      )}
      <label className="inline-flex cursor-pointer items-center gap-1 text-xs font-medium text-accent hover:underline">
        <input
          type="file"
          accept="image/jpeg,image/jpg,image/png"
          className="hidden"
          onChange={onPick}
          disabled={uploading}
        />
        {uploading
          ? 'Uploading…'
          : profile.photo_url
            ? 'Change photo'
            : 'Upload photo'}
      </label>
    </div>
  );
}

// =========================================================================
// Personal info + address + statutory numbers
// =========================================================================

function PersonalSection({
  profile,
  setProfile,
  maritalStatuses,
  genders,
  qualifications,
  departments,
  saving,
  setSaving,
  setError,
  setSuccess,
}: {
  profile: ProfileData;
  setProfile: (p: ProfileData) => void;
  maritalStatuses: MasterRecord[];
  genders: MasterRecord[];
  qualifications: MasterRecord[];
  departments: MasterRecord[];
  saving: boolean;
  setSaving: (v: boolean) => void;
  setError: (e: string) => void;
  setSuccess: (s: string) => void;
}) {
  const [form, setForm] = useState({
    phone: profile.phone ?? '',
    dob: profile.dob ?? '',
    gender_id: profile.gender?.id ?? '',
    qualification_id: profile.qualification?.id ?? '',
    department_id: profile.department?.id ?? '',
    marital_status_id: profile.marital_status_id ?? '',
    current_address: profile.current_address ?? '',
    permanent_address: profile.permanent_address ?? '',
    emergency_phone: profile.emergency_phone ?? '',
    pf_uan_no: profile.pf_uan_no ?? '',
    esic_no: profile.esic_no ?? '',
  });

  const set = <K extends keyof typeof form>(k: K, v: string) =>
    setForm((f) => ({ ...f, [k]: v }));

  async function save(e: FormEvent) {
    e.preventDefault();
    setError('');
    setSuccess('');
    setSaving(true);
    try {
      await api.patch('/users/me', {
        phone: form.phone || null,
        dob: form.dob || null,
        gender_id: form.gender_id || null,
        qualification_id: form.qualification_id || null,
        department_id: form.department_id || null,
        marital_status_id: form.marital_status_id || null,
        current_address: form.current_address || null,
        permanent_address: form.permanent_address || null,
        emergency_phone: form.emergency_phone || null,
        pf_uan_no: form.pf_uan_no || null,
        esic_no: form.esic_no || null,
      });
      // Refresh from /users/me for consistent joined data
      const refreshed = await api.get<ProfileData>('/users/me');
      setProfile(refreshed);
      setSuccess('Profile saved.');
    } catch (err) {
      setError((err as ApiError).message || 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <h2 className="text-lg font-semibold text-text-primary">Personal & Contact</h2>
      <form onSubmit={save} className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
        <ReadOnly label="Employee Number" value={profile.emp_number ?? '—'} />
        <ReadOnly label="Email" value={profile.email} />

        <Field label="Phone">
          <input
            type="tel"
            value={form.phone}
            onChange={(e) => set('phone', e.target.value)}
            className={inputCls}
          />
        </Field>
        <Field label="Emergency / Other Contact">
          <input
            type="tel"
            value={form.emergency_phone}
            onChange={(e) => set('emergency_phone', e.target.value)}
            className={inputCls}
            placeholder="Alternate contact for emergencies"
          />
        </Field>

        <Field label="Date of Birth">
          <input
            type="date"
            value={form.dob}
            onChange={(e) => set('dob', e.target.value)}
            className={inputCls}
          />
        </Field>
        <Field label="Gender">
          <select
            value={form.gender_id}
            onChange={(e) => set('gender_id', e.target.value)}
            className={inputCls}
          >
            <option value="">Select…</option>
            {genders.map((g) => (
              <option key={g.id} value={g.id}>
                {g.label}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Marital Status">
          <select
            value={form.marital_status_id}
            onChange={(e) => set('marital_status_id', e.target.value)}
            className={inputCls}
          >
            <option value="">Select…</option>
            {maritalStatuses.map((m) => (
              <option key={m.id} value={m.id}>
                {m.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Qualification">
          <select
            value={form.qualification_id}
            onChange={(e) => set('qualification_id', e.target.value)}
            className={inputCls}
          >
            <option value="">Select…</option>
            {qualifications.map((q) => (
              <option key={q.id} value={q.id}>
                {q.label}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Department">
          <select
            value={form.department_id}
            onChange={(e) => set('department_id', e.target.value)}
            className={inputCls}
          >
            <option value="">Select…</option>
            {departments.map((d) => (
              <option key={d.id} value={d.id}>
                {d.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="PF UAN No">
          <input
            type="text"
            value={form.pf_uan_no}
            onChange={(e) => set('pf_uan_no', e.target.value)}
            className={inputCls}
            placeholder="12-digit UAN"
          />
        </Field>

        <Field label="ESIC Insurance No" span>
          <input
            type="text"
            value={form.esic_no}
            onChange={(e) => set('esic_no', e.target.value)}
            className={inputCls}
          />
        </Field>

        <Field label="Current Address" span>
          <textarea
            rows={3}
            value={form.current_address}
            onChange={(e) => set('current_address', e.target.value)}
            className={inputCls}
          />
        </Field>
        <Field label="Permanent Address" span>
          <textarea
            rows={3}
            value={form.permanent_address}
            onChange={(e) => set('permanent_address', e.target.value)}
            className={inputCls}
          />
        </Field>

        <div className="sm:col-span-2 flex justify-end">
          <Button type="submit" isLoading={saving} disabled={saving}>
            Save Personal Details
          </Button>
        </div>
      </form>
    </Card>
  );
}

// =========================================================================
// Bank details (employee may also use the bank-change workflow for approval)
// =========================================================================

function BankSection({
  profile,
  setProfile,
  saving,
  setSaving,
  setError,
  setSuccess,
}: {
  profile: ProfileData;
  setProfile: (p: ProfileData) => void;
  saving: boolean;
  setSaving: (v: boolean) => void;
  setError: (e: string) => void;
  setSuccess: (s: string) => void;
}) {
  const [form, setForm] = useState({
    bank_name: profile.bank_name ?? '',
    bank_account_no: profile.bank_account_no ?? '',
    bank_ifsc: profile.bank_ifsc ?? '',
  });

  async function save(e: FormEvent) {
    e.preventDefault();
    setError('');
    setSuccess('');
    if (form.bank_ifsc && !/^[A-Z]{4}0[A-Z0-9]{6}$/.test(form.bank_ifsc)) {
      setError('IFSC must match the format ABCD0123456.');
      return;
    }
    if (form.bank_account_no && !/^\d{9,18}$/.test(form.bank_account_no)) {
      setError('Bank account number must be 9–18 digits.');
      return;
    }
    setSaving(true);
    try {
      await api.patch('/users/me', {
        bank_name: form.bank_name || null,
        bank_account_no: form.bank_account_no || null,
        bank_ifsc: form.bank_ifsc.toUpperCase() || null,
      });
      const refreshed = await api.get<ProfileData>('/users/me');
      setProfile(refreshed);
      setSuccess('Bank details saved.');
    } catch (err) {
      setError((err as ApiError).message || 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <h2 className="text-lg font-semibold text-text-primary">Bank Details</h2>
      <form onSubmit={save} className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Field label="Bank Name">
          <input
            value={form.bank_name}
            onChange={(e) =>
              setForm((f) => ({ ...f, bank_name: e.target.value }))
            }
            className={inputCls}
            placeholder="HDFC Bank"
          />
        </Field>
        <Field label="Account Number (9–18 digits)">
          <input
            inputMode="numeric"
            value={form.bank_account_no}
            onChange={(e) =>
              setForm((f) => ({ ...f, bank_account_no: e.target.value }))
            }
            className={`${inputCls} font-mono`}
          />
        </Field>
        <Field label="IFSC (ABCD0123456)">
          <input
            value={form.bank_ifsc}
            onChange={(e) =>
              setForm((f) => ({
                ...f,
                bank_ifsc: e.target.value.toUpperCase(),
              }))
            }
            className={`${inputCls} font-mono uppercase`}
          />
        </Field>
        <div className="sm:col-span-3 flex justify-end">
          <Button type="submit" isLoading={saving} disabled={saving}>
            Save Bank Details
          </Button>
        </div>
      </form>
    </Card>
  );
}

// =========================================================================
// Family members — CRUD
// =========================================================================

const EMPTY_MEMBER = {
  name: '',
  relation: '',
  occupation: '',
  dob: '',
  contact_no: '',
};

function FamilySection({
  family,
  setFamily,
  setError,
  setSuccess,
}: {
  family: FamilyMember[];
  setFamily: (f: FamilyMember[]) => void;
  setError: (e: string) => void;
  setSuccess: (s: string) => void;
}) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState({ ...EMPTY_MEMBER });
  const [submitting, setSubmitting] = useState(false);

  function startAdd() {
    setDraft({ ...EMPTY_MEMBER });
    setEditingId('new');
  }
  function startEdit(m: FamilyMember) {
    setDraft({
      name: m.name,
      relation: m.relation,
      occupation: m.occupation ?? '',
      dob: m.dob ?? '',
      contact_no: m.contact_no ?? '',
    });
    setEditingId(m.id);
  }
  function cancel() {
    setEditingId(null);
    setDraft({ ...EMPTY_MEMBER });
  }

  async function save(e: FormEvent) {
    e.preventDefault();
    setError('');
    setSuccess('');
    if (!draft.name.trim() || !draft.relation.trim()) {
      setError('Name and relation are required.');
      return;
    }
    setSubmitting(true);
    try {
      if (editingId === 'new') {
        const row = await api.post<FamilyMember>('/users/me/family', draft);
        setFamily([...family, row]);
        setSuccess('Family member added.');
      } else if (editingId) {
        const row = await api.patch<FamilyMember>(
          `/users/me/family/${editingId}`,
          draft,
        );
        setFamily(family.map((f) => (f.id === row.id ? row : f)));
        setSuccess('Family member updated.');
      }
      cancel();
    } catch (err) {
      setError((err as ApiError).message || 'Save failed');
    } finally {
      setSubmitting(false);
    }
  }

  async function remove(id: string) {
    if (!confirm('Remove this family member?')) return;
    try {
      await api.delete(`/users/me/family/${id}`);
      setFamily(family.filter((f) => f.id !== id));
    } catch (err) {
      setError((err as ApiError).message || 'Delete failed');
    }
  }

  return (
    <Card>
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-text-primary">Family Details</h2>
        {editingId === null && (
          <Button size="sm" onClick={startAdd}>
            Add Member
          </Button>
        )}
      </div>

      {editingId !== null && (
        <form onSubmit={save} className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-3 rounded-lg bg-neutral-bg p-4">
          <Field label="Name *">
            <input
              required
              value={draft.name}
              onChange={(e) => setDraft({ ...draft, name: e.target.value })}
              className={inputCls}
            />
          </Field>
          <Field label="Relation *">
            <input
              required
              value={draft.relation}
              onChange={(e) => setDraft({ ...draft, relation: e.target.value })}
              className={inputCls}
              placeholder="Spouse / Father / Mother / …"
            />
          </Field>
          <Field label="Occupation">
            <input
              value={draft.occupation}
              onChange={(e) =>
                setDraft({ ...draft, occupation: e.target.value })
              }
              className={inputCls}
            />
          </Field>
          <Field label="Date of Birth">
            <input
              type="date"
              value={draft.dob}
              onChange={(e) => setDraft({ ...draft, dob: e.target.value })}
              className={inputCls}
            />
          </Field>
          <Field label="Contact No.">
            <input
              type="tel"
              value={draft.contact_no}
              onChange={(e) =>
                setDraft({ ...draft, contact_no: e.target.value })
              }
              className={inputCls}
            />
          </Field>
          <div className="sm:col-span-3 flex justify-end gap-2">
            <Button
              type="button"
              variant="secondary"
              disabled={submitting}
              onClick={cancel}
            >
              Cancel
            </Button>
            <Button type="submit" isLoading={submitting} disabled={submitting}>
              {editingId === 'new' ? 'Add' : 'Save'}
            </Button>
          </div>
        </form>
      )}

      <div className="mt-4 overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-left text-xs font-semibold uppercase tracking-wider text-text-secondary">
            <tr>
              <th className="px-3 py-2">Name</th>
              <th className="px-3 py-2">Relation</th>
              <th className="px-3 py-2">Occupation</th>
              <th className="px-3 py-2">DOB</th>
              <th className="px-3 py-2">Contact</th>
              <th className="px-3 py-2 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {family.length === 0 ? (
              <tr>
                <td
                  colSpan={6}
                  className="px-3 py-4 text-center text-text-secondary"
                >
                  No family members added yet.
                </td>
              </tr>
            ) : (
              family.map((m) => (
                <tr key={m.id}>
                  <td className="px-3 py-2">{m.name}</td>
                  <td className="px-3 py-2">{m.relation}</td>
                  <td className="px-3 py-2 text-text-secondary">
                    {m.occupation ?? '—'}
                  </td>
                  <td className="px-3 py-2 text-text-secondary">
                    {m.dob ?? '—'}
                  </td>
                  <td className="px-3 py-2 text-text-secondary">
                    {m.contact_no ?? '—'}
                  </td>
                  <td className="px-3 py-2 text-right space-x-2">
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => startEdit(m)}
                    >
                      Edit
                    </Button>
                    <Button
                      size="sm"
                      variant="danger"
                      onClick={() => remove(m.id)}
                    >
                      Delete
                    </Button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

// =========================================================================
// Documents — upload + list + delete
// =========================================================================

function DocumentsSection({
  docs,
  setDocs,
  docTypes,
  setError,
  setSuccess,
}: {
  docs: UserDoc[];
  setDocs: (d: UserDoc[]) => void;
  docTypes: MasterRecord[];
  setError: (e: string) => void;
  setSuccess: (s: string) => void;
}) {
  const [docTypeId, setDocTypeId] = useState('');
  const [label, setLabel] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  async function upload(e: FormEvent) {
    e.preventDefault();
    setError('');
    setSuccess('');
    if (!docTypeId) {
      setError('Please choose a document type.');
      return;
    }
    if (!file) {
      setError('Please select a file.');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setError('File must be 10MB or less.');
      return;
    }

    setUploading(true);
    try {
      const pre = await api.post<{ upload_url: string; s3_key: string }>(
        '/uploads/presigned',
        {
          mime_type: file.type || 'application/octet-stream',
          file_size_bytes: file.size,
          context: 'user_document',
        },
      );
      const putRes = await fetch(pre.upload_url, {
        method: 'PUT',
        headers: { 'Content-Type': file.type || 'application/octet-stream' },
        body: file,
      });
      if (!putRes.ok) throw new Error('S3 upload failed');
      const row = await api.post<UserDoc>('/users/me/documents', {
        document_type_id: docTypeId,
        s3_key: pre.s3_key,
        label: label.trim() || null,
        file_size_bytes: file.size,
        mime_type: file.type,
      });
      setDocs([row, ...docs]);
      setSuccess('Document uploaded.');
      setDocTypeId('');
      setLabel('');
      setFile(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setUploading(false);
    }
  }

  async function remove(id: string) {
    if (!confirm('Remove this document?')) return;
    try {
      await api.delete(`/users/me/documents/${id}`);
      setDocs(docs.filter((d) => d.id !== id));
    } catch (err) {
      setError((err as ApiError).message || 'Delete failed');
    }
  }

  return (
    <Card>
      <h2 className="text-lg font-semibold text-text-primary">Documents</h2>
      <p className="mt-1 text-xs text-text-secondary">
        Upload Aadhaar, PAN, or other identity / verification documents. Max 10MB per file (PDF, JPG, PNG).
      </p>

      <form
        onSubmit={upload}
        className="mt-4 grid grid-cols-1 sm:grid-cols-4 gap-3 rounded-lg bg-neutral-bg p-4"
      >
        <Field label="Document Type *">
          <select
            value={docTypeId}
            onChange={(e) => setDocTypeId(e.target.value)}
            className={inputCls}
          >
            <option value="">Select…</option>
            {docTypes.map((t) => (
              <option key={t.id} value={t.id}>
                {t.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Label (optional)">
          <input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            className={inputCls}
            placeholder="e.g. Aadhaar front side"
          />
        </Field>
        <Field label="File *">
          <input
            type="file"
            accept=".pdf,.jpg,.jpeg,.png"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          />
        </Field>
        <div className="flex items-end">
          <Button
            type="submit"
            isLoading={uploading}
            disabled={uploading}
            className="w-full"
          >
            Upload
          </Button>
        </div>
      </form>

      <div className="mt-4 overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-left text-xs font-semibold uppercase tracking-wider text-text-secondary">
            <tr>
              <th className="px-3 py-2">Type</th>
              <th className="px-3 py-2">Label</th>
              <th className="px-3 py-2">Uploaded</th>
              <th className="px-3 py-2 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {docs.length === 0 ? (
              <tr>
                <td
                  colSpan={4}
                  className="px-3 py-4 text-center text-text-secondary"
                >
                  No documents uploaded yet.
                </td>
              </tr>
            ) : (
              docs.map((d) => (
                <tr key={d.id}>
                  <td className="px-3 py-2 font-medium">
                    {d.document_type_label ?? '—'}
                  </td>
                  <td className="px-3 py-2 text-text-secondary">
                    {d.label ?? '—'}
                  </td>
                  <td className="px-3 py-2 text-text-secondary">
                    {new Date(d.uploaded_at).toLocaleDateString('en-IN')}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <Button size="sm" variant="danger" onClick={() => remove(d.id)}>
                      Remove
                    </Button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

// =========================================================================
// Tiny shared UI helpers
// =========================================================================

const inputCls =
  'mt-1 w-full rounded-lg border border-border bg-white px-3 py-2 text-sm text-text-primary focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent';

function Field({
  label,
  span,
  children,
}: {
  label: string;
  span?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className={`block ${span ? 'sm:col-span-2' : ''}`}>
      <span className="block text-xs font-semibold uppercase tracking-wider text-text-secondary">
        {label}
      </span>
      {children}
    </label>
  );
}

function ReadOnly({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-neutral-bg px-3 py-2">
      <div className="text-xs font-semibold uppercase tracking-wider text-text-secondary">
        {label}
      </div>
      <div className="mt-1 text-sm text-text-primary">{value}</div>
    </div>
  );
}
