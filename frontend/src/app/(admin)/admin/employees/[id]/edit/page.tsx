'use client';

import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { api, ApiError } from '@/lib/api';
import { Card, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { PageLoader } from '@/components/ui/spinner';
import { useToast } from '@/components/ui/toast';
import { useMasterData } from '@/lib/master-data';
import { formatDate, maxDobDate, validateDob } from '@/lib/utils';
import { useAutoRefresh } from '@/lib/use-auto-refresh';
import type { MasterRecord } from '@/lib/types';

interface FamilyMember {
  id: string;
  name: string;
  relation: string;
  occupation: string | null;
  dob: string | null;
  contact_no: string | null;
}

interface EmployeeDoc {
  id: string;
  document_type_id: string;
  document_type_label?: string | null;
  s3_key: string;
  uploaded_at: string;
  mime_type: string | null;
}

interface EmployeeData {
  id: string;
  name: string;
  email: string;
  phone: string;
  department: { id: string; label: string } | null;
  manager: { id: string; name: string } | null;
  is_manager: boolean;
  qualification: { id: string; label: string } | null;
  gender: { id: string; label: string } | null;
  role_type: { id: string; label: string } | null;
  join_date: string | null;
  confirmation_date: string | null;
  resignation_date: string | null;
  last_working_day: string | null;
  employment_status: string;
  // Payroll fields
  emp_number: string | null;
  designation: string | null;
  designation_id: string | null;
  gross: string;
  incentive: string;
  pf_applicable: boolean;
  dob: string | null;
  // Bank
  bank_name: string | null;
  bank_account_no: string | null;
  bank_ifsc: string | null;
  // Extended profile
  marital_status_id: string | null;
  current_address: string | null;
  permanent_address: string | null;
  emergency_phone: string | null;
  pf_uan_no: string | null;
  esic_no: string | null;
  updated_at: string;
}

interface ManagerOption {
  id: string;
  name: string;
}

export default function EditEmployeePage() {
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const { data: masterData } = useMasterData();
  const id = params.id as string;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [managers, setManagers] = useState<ManagerOption[]>([]);

  // Form state
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [departmentId, setDepartmentId] = useState('');
  const [managerId, setManagerId] = useState('');
  const [isManager, setIsManager] = useState(false);
  const [qualificationId, setQualificationId] = useState('');
  const [genderId, setGenderId] = useState('');
  const [joinDate, setJoinDate] = useState('');
  const [confirmationDate, setConfirmationDate] = useState('');
  const [resignationDate, setResignationDate] = useState('');
  const [lastWorkingDay, setLastWorkingDay] = useState('');
  const [employmentStatus, setEmploymentStatus] = useState('active');

  // Payroll form state
  const [empNumber, setEmpNumber] = useState('');
  const [designationId, setDesignationId] = useState('');
  const [designations, setDesignations] = useState<
    Array<{ id: string; label: string; department_id: string }>
  >([]);
  const [gross, setGross] = useState('');
  const [incentive, setIncentive] = useState('');
  const [pfApplicable, setPfApplicable] = useState(true);
  const [dob, setDob] = useState('');

  // Bank state
  const [bankName, setBankName] = useState('');
  const [bankAccountNo, setBankAccountNo] = useState('');
  const [bankIfsc, setBankIfsc] = useState('');

  // Extended profile state
  const [maritalStatusId, setMaritalStatusId] = useState('');
  const [currentAddress, setCurrentAddress] = useState('');
  const [permanentAddress, setPermanentAddress] = useState('');
  const [emergencyPhone, setEmergencyPhone] = useState('');
  const [pfUanNo, setPfUanNo] = useState('');
  const [esicNo, setEsicNo] = useState('');
  const [maritalStatuses, setMaritalStatuses] = useState<
    Array<{ id: string; label: string }>
  >([]);
  const [statutory, setStatutory] = useState<{
    pf_cap_amount: string;
    pf_fixed_at_cap: string;
    pf_rate_below_cap: string;
  } | null>(null);

  // Tracks the updated_at of the snapshot currently populating the form
  // and the most recent updated_at observed by the silent auto-refresh
  // poll. When they diverge we show a "Reload latest" banner so the admin
  // decides whether to pull fresh data — we never silently overwrite an
  // in-progress edit.
  const [loadedUpdatedAt, setLoadedUpdatedAt] = useState<string | null>(null);
  const [remoteUpdatedAt, setRemoteUpdatedAt] = useState<string | null>(null);

  const applyEmployee = useCallback((emp: EmployeeData) => {
    setName(emp.name || '');
    setPhone(emp.phone || '');
    setDepartmentId(emp.department?.id || '');
    setManagerId(emp.manager?.id || '');
    setIsManager(emp.is_manager || false);
    setQualificationId(emp.qualification?.id || '');
    setGenderId(emp.gender?.id || '');
    setJoinDate(emp.join_date ? emp.join_date.split('T')[0] : '');
    setConfirmationDate(emp.confirmation_date ? emp.confirmation_date.split('T')[0] : '');
    setResignationDate(emp.resignation_date ? emp.resignation_date.split('T')[0] : '');
    setLastWorkingDay(emp.last_working_day ? emp.last_working_day.split('T')[0] : '');
    setEmploymentStatus(emp.employment_status || 'active');
    setEmpNumber(emp.emp_number ?? '');
    setDesignationId(emp.designation_id ?? '');
    setGross(emp.gross ?? '');
    setIncentive(emp.incentive ?? '');
    setPfApplicable(emp.pf_applicable ?? true);
    setDob(emp.dob ? emp.dob.split('T')[0] : '');
    setBankName(emp.bank_name ?? '');
    setBankAccountNo(emp.bank_account_no ?? '');
    setBankIfsc(emp.bank_ifsc ?? '');
    // Extended profile fields
    setMaritalStatusId(emp.marital_status_id ?? '');
    setCurrentAddress(emp.current_address ?? '');
    setPermanentAddress(emp.permanent_address ?? '');
    setEmergencyPhone(emp.emergency_phone ?? '');
    setPfUanNo(emp.pf_uan_no ?? '');
    setEsicNo(emp.esic_no ?? '');
    setLoadedUpdatedAt(emp.updated_at);
    setRemoteUpdatedAt(emp.updated_at);
  }, []);

  const reloadLatest = useCallback(async () => {
    try {
      const emp = await api.get<EmployeeData>(`/admin/users/${id}`);
      applyEmployee(emp);
    } catch {
      // keep current form state on failure
    }
  }, [id, applyEmployee]);

  useEffect(() => {
    async function load() {
      try {
        setLoading(true);
        const [emp, mgrs] = await Promise.all([
          api.get<EmployeeData>(`/admin/users/${id}`),
          api.get<ManagerOption[]>('/admin/users/managers').catch(() => []),
        ]);
        applyEmployee(emp);
        setManagers(Array.isArray(mgrs) ? mgrs : []);

        // Fetch marital statuses for the dropdown (ignore failures — the field
        // simply becomes empty if the master table endpoint is unreachable)
        api
          .get<Array<{ id: string; label: string }>>('/master/marital_statuses')
          .then((list) => setMaritalStatuses(Array.isArray(list) ? list : []))
          .catch(() => setMaritalStatuses([]));

        // Fetch statutory config for live CTC preview (ignore failures — the
        // preview silently hides if the endpoint isn't reachable)
        api
          .get<{ pf_cap_amount: string; pf_fixed_at_cap: string; pf_rate_below_cap: string }>(
            '/payroll/master/statutory',
          )
          .then((s) => setStatutory(s))
          .catch(() => setStatutory(null));
      } catch {
        setError('Failed to load employee data.');
      } finally {
        setLoading(false);
      }
    }
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  // Silent auto-poll: fetches the employee every 30s (and on tab focus)
  // just to read the server-side updated_at. We deliberately do NOT
  // overwrite the form state — the admin might be mid-edit. When the
  // server timestamp is newer than what we loaded, the banner below
  // appears so the admin can explicitly pull the new values.
  useAutoRefresh(async () => {
    try {
      const emp = await api.get<EmployeeData>(`/admin/users/${id}`);
      if (emp?.updated_at) setRemoteUpdatedAt(emp.updated_at);
    } catch {
      /* ignore transient errors */
    }
  });

  const hasNewerData =
    !!loadedUpdatedAt &&
    !!remoteUpdatedAt &&
    new Date(remoteUpdatedAt).getTime() > new Date(loadedUpdatedAt).getTime();

  // Fetch designations scoped to the currently-selected department.
  // Runs on first load (once department is populated) AND whenever the
  // admin changes the department dropdown so the designation dropdown
  // always reflects the right list. If the employee's existing
  // designation_id doesn't belong to the new department, we clear it so
  // the form never saves a mismatched value.
  //
  // Race-guard: when the admin changes department twice quickly, the
  // first fetch may resolve AFTER the second. We bump `cancelled` on
  // every effect cleanup so a late response cannot overwrite the result
  // of a newer one. (api.get doesn't take an AbortSignal yet so a
  // boolean flag is the practical guard here.)
  useEffect(() => {
    if (!departmentId) {
      setDesignations([]);
      return;
    }
    let cancelled = false;
    api
      .get<
        Array<{ id: string; label: string; department_id: string }>
      >(`/master/designations?department_id=${departmentId}`)
      .then((list) => {
        if (cancelled) return;
        const arr = Array.isArray(list) ? list : [];
        setDesignations(arr);
        // Keep current selection only if it belongs to the new department.
        if (designationId && !arr.some((d) => d.id === designationId)) {
          setDesignationId('');
        }
      })
      .catch(() => {
        if (!cancelled) setDesignations([]);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [departmentId]);

  const handleSave = async () => {
    const dobErr = validateDob(dob);
    if (dobErr) {
      setError(dobErr);
      toast(dobErr, 'error');
      return;
    }
    try {
      setSaving(true);
      setError('');

      const updates: Record<string, any> = {
        name: name.trim(),
        phone: phone.trim(),
        department_id: departmentId || null,
        manager_id: managerId || null,
        is_manager: isManager,
        qualification_id: qualificationId || null,
        gender_id: genderId || null,
        join_date: joinDate || null,
        confirmation_date: confirmationDate || null,
        resignation_date: resignationDate || null,
        last_working_day: lastWorkingDay || null,
        employment_status: employmentStatus,
        // Payroll fields
        emp_number: empNumber.trim() || null,
        designation_id: designationId || null,
        gross: gross === '' ? 0 : Number(gross),
        incentive: incentive === '' ? 0 : Number(incentive),
        pf_applicable: pfApplicable,
        dob: dob || null,
        // Bank details
        bank_name: bankName.trim() || null,
        bank_account_no: bankAccountNo.trim() || null,
        bank_ifsc: bankIfsc.trim().toUpperCase() || null,
        // Extended profile
        marital_status_id: maritalStatusId || null,
        current_address: currentAddress.trim() || null,
        permanent_address: permanentAddress.trim() || null,
        emergency_phone: emergencyPhone.trim() || null,
        pf_uan_no: pfUanNo.trim() || null,
        esic_no: esicNo.trim() || null,
      };

      await api.patch(`/admin/users/${id}`, updates);
      toast('Employee profile updated successfully', 'success');
      router.push(`/admin/employees/${id}`);
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Failed to update employee';
      setError(message);
      toast(message, 'error');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <PageLoader />;

  return (
    <div>
      <Link
        href={`/admin/employees/${id}`}
        className="inline-flex items-center gap-1 text-sm text-text-secondary hover:text-accent transition-colors mb-6"
      >
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
        </svg>
        Back to Employee
      </Link>

      <Card>
        <CardTitle>Edit Employee Profile</CardTitle>

        {hasNewerData && (
          <div className="mt-4 flex items-center justify-between gap-3 rounded-lg border border-[#fde68a] bg-[#fffbeb] px-4 py-2 text-sm text-[#92400e]">
            <span>
              The employee has updated their profile since you opened this
              page. Your form fields are unchanged for now. Click{' '}
              <strong>Reload latest</strong> to replace them with the new
              values from the server — any unsaved edits in this form will
              be discarded.
            </span>
            <Button
              size="sm"
              variant="secondary"
              onClick={reloadLatest}
              disabled={saving}
            >
              Reload latest
            </Button>
          </div>
        )}

        {error && (
          <div className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <div className="mt-6 grid grid-cols-1 gap-5 sm:grid-cols-2">
          {/* Name */}
          <div>
            <label className="mb-1 block text-sm font-medium text-text-primary">Full Name</label>
            <input
              type="text"
              className="w-full rounded-lg border border-border bg-neutral-bg px-3 py-2 text-sm text-text-primary focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          {/* Phone */}
          <div>
            <label className="mb-1 block text-sm font-medium text-text-primary">Phone</label>
            <input
              type="text"
              className="w-full rounded-lg border border-border bg-neutral-bg px-3 py-2 text-sm text-text-primary focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
          </div>

          {/* Department */}
          <div>
            <label className="mb-1 block text-sm font-medium text-text-primary">Department</label>
            <select
              className="w-full rounded-lg border border-border bg-neutral-bg px-3 py-2 text-sm text-text-primary focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              value={departmentId}
              onChange={(e) => setDepartmentId(e.target.value)}
            >
              <option value="">Select department</option>
              {masterData.departments.map((d) => (
                <option key={d.id} value={d.id}>{d.label}</option>
              ))}
            </select>
          </div>

          {/* Manager */}
          <div>
            <label className="mb-1 block text-sm font-medium text-text-primary">Manager</label>
            <select
              className="w-full rounded-lg border border-border bg-neutral-bg px-3 py-2 text-sm text-text-primary focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              value={managerId}
              onChange={(e) => setManagerId(e.target.value)}
            >
              <option value="">No manager</option>
              {managers.map((m) => (
                <option key={m.id} value={m.id}>{m.name}</option>
              ))}
            </select>
          </div>

          {/* Gender */}
          <div>
            <label className="mb-1 block text-sm font-medium text-text-primary">Gender</label>
            <select
              className="w-full rounded-lg border border-border bg-neutral-bg px-3 py-2 text-sm text-text-primary focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              value={genderId}
              onChange={(e) => setGenderId(e.target.value)}
            >
              <option value="">Select gender</option>
              {masterData.genders.map((g) => (
                <option key={g.id} value={g.id}>{g.label}</option>
              ))}
            </select>
          </div>

          {/* Qualification */}
          <div>
            <label className="mb-1 block text-sm font-medium text-text-primary">Qualification</label>
            <select
              className="w-full rounded-lg border border-border bg-neutral-bg px-3 py-2 text-sm text-text-primary focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              value={qualificationId}
              onChange={(e) => setQualificationId(e.target.value)}
            >
              <option value="">Select qualification</option>
              {masterData.qualifications.map((q) => (
                <option key={q.id} value={q.id}>{q.label}</option>
              ))}
            </select>
          </div>

          {/* Join Date */}
          <div>
            <label className="mb-1 block text-sm font-medium text-text-primary">Joining Date</label>
            <input
              type="date"
              className="w-full rounded-lg border border-border bg-neutral-bg px-3 py-2 text-sm text-text-primary focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              value={joinDate}
              onChange={(e) => setJoinDate(e.target.value)}
            />
          </div>

          {/* Confirmation Date (Probation End) */}
          <div>
            <label className="mb-1 block text-sm font-medium text-text-primary">
              Probation Confirmation Date
            </label>
            <input
              type="date"
              className="w-full rounded-lg border border-border bg-neutral-bg px-3 py-2 text-sm text-text-primary focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              value={confirmationDate}
              onChange={(e) => setConfirmationDate(e.target.value)}
            />
            <p className="mt-1 text-xs text-text-secondary">
              Default is 3 months from joining date. Extend if probation is longer.
            </p>
          </div>

          {/* Is Manager checkbox */}
          <div className="sm:col-span-2">
            <label className="inline-flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-border text-primary focus:ring-primary"
                checked={isManager}
                onChange={(e) => setIsManager(e.target.checked)}
              />
              <span className="text-sm font-medium text-text-primary">
                This employee is a Manager
              </span>
              <span className="text-xs text-text-secondary">(will appear in manager dropdown for other employees)</span>
            </label>
          </div>

          {/* Payroll Section */}
          <div className="sm:col-span-2 border-t border-border pt-5 mt-2">
            <h3 className="text-sm font-semibold text-text-primary mb-4">
              Payroll
              <span className="ml-2 text-xs font-normal text-text-secondary">
                · Required fields for payroll processing; employees without Gross will be skipped in runs.
              </span>
            </h3>
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
              {/* Emp Number */}
              <div>
                <label className="mb-1 block text-sm font-medium text-text-primary">
                  Employee Number{' '}
                  <span className="text-xs font-normal text-text-secondary">(optional)</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g. RT-DEV-153"
                  className="w-full rounded-lg border border-border bg-neutral-bg px-3 py-2 text-sm text-text-primary focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                  value={empNumber}
                  onChange={(e) => setEmpNumber(e.target.value)}
                />
              </div>

              {/* Designation — sourced from master_designations filtered
                  by the currently-selected department. Admin manages the
                  per-department list from the master-data panel. */}
              <div>
                <label className="mb-1 block text-sm font-medium text-text-primary">
                  Designation
                </label>
                <select
                  className="w-full rounded-lg border border-border bg-neutral-bg px-3 py-2 text-sm text-text-primary focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-60"
                  value={designationId}
                  onChange={(e) => setDesignationId(e.target.value)}
                  disabled={!departmentId}
                >
                  <option value="">
                    {departmentId
                      ? designations.length
                        ? 'Select designation…'
                        : 'No designations configured for this department'
                      : 'Select a department first'}
                  </option>
                  {designations.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* DOB */}
              <div>
                <label className="mb-1 block text-sm font-medium text-text-primary">
                  Date of Birth{' '}
                  <span className="text-xs font-normal text-text-secondary">(payslip PDF password = DDMM)</span>
                </label>
                <input
                  type="date"
                  max={maxDobDate()}
                  className="w-full rounded-lg border border-border bg-neutral-bg px-3 py-2 text-sm text-text-primary focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                  value={dob}
                  onChange={(e) => setDob(e.target.value)}
                />
              </div>

              {/* Gross Salary */}
              <div>
                <label className="mb-1 block text-sm font-medium text-text-primary">
                  Gross Salary (Monthly, ₹)
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0"
                  className="w-full rounded-lg border border-border bg-neutral-bg px-3 py-2 text-sm text-text-primary focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                  value={gross}
                  onChange={(e) => setGross(e.target.value)}
                />
              </div>

              {/* Incentive */}
              <div>
                <label className="mb-1 block text-sm font-medium text-text-primary">
                  Incentive / Fix Variable (Monthly, ₹)
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0"
                  className="w-full rounded-lg border border-border bg-neutral-bg px-3 py-2 text-sm text-text-primary focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                  value={incentive}
                  onChange={(e) => setIncentive(e.target.value)}
                />
              </div>

              {/* PF Applicable */}
              <div>
                <label className="mb-1 block text-sm font-medium text-text-primary">
                  PF Applicable
                </label>
                <label className="mt-2 inline-flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded border-border text-primary focus:ring-primary"
                    checked={pfApplicable}
                    onChange={(e) => setPfApplicable(e.target.checked)}
                  />
                  <span className="text-sm text-text-primary">
                    Deduct Employee PF + include Employer PF in CTC
                  </span>
                </label>
              </div>

              {/* Monthly CTC preview */}
              <div className="sm:col-span-3 rounded-lg bg-[#f0f9ff] px-4 py-3 border border-[#bae6fd]">
                <CtcPreview
                  userId={id}
                  gross={gross}
                  incentive={incentive}
                  pfApplicable={pfApplicable}
                  statutory={statutory}
                />
              </div>
            </div>
          </div>

          {/* Bank Details Section */}
          <div className="sm:col-span-2 border-t border-border pt-5 mt-2">
            <h3 className="text-sm font-semibold text-text-primary mb-4">
              Bank Details
              <span className="ml-2 text-xs font-normal text-text-secondary">
                · Used by the payroll bank transfer file. Employees can also submit change requests via self-service — once approved, these fields update automatically.
              </span>
            </h3>
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
              <div>
                <label className="mb-1 block text-sm font-medium text-text-primary">
                  Bank Name
                </label>
                <input
                  type="text"
                  placeholder="e.g. HDFC Bank"
                  className="w-full rounded-lg border border-border bg-neutral-bg px-3 py-2 text-sm text-text-primary focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                  value={bankName}
                  onChange={(e) => setBankName(e.target.value)}
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-text-primary">
                  Account Number{' '}
                  <span className="text-xs font-normal text-text-secondary">(9–18 digits)</span>
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  pattern="\d{9,18}"
                  placeholder="e.g. 12830100028299"
                  className="w-full rounded-lg border border-border bg-neutral-bg px-3 py-2 text-sm font-mono text-text-primary focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                  value={bankAccountNo}
                  onChange={(e) => setBankAccountNo(e.target.value)}
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-text-primary">
                  IFSC Code{' '}
                  <span className="text-xs font-normal text-text-secondary">(ABCD0123456)</span>
                </label>
                <input
                  type="text"
                  pattern="^[A-Z]{4}0[A-Z0-9]{6}$"
                  placeholder="e.g. HDFC0001234"
                  className="w-full rounded-lg border border-border bg-neutral-bg px-3 py-2 text-sm font-mono uppercase text-text-primary focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                  value={bankIfsc}
                  onChange={(e) => setBankIfsc(e.target.value.toUpperCase())}
                />
              </div>
            </div>
          </div>

          {/* Personal / Extended Profile Section */}
          <div className="sm:col-span-2 border-t border-border pt-5 mt-2">
            <h3 className="text-sm font-semibold text-text-primary mb-4">
              Personal Details
              <span className="ml-2 text-xs font-normal text-text-secondary">
                · Employees can also edit these fields from their own profile page.
              </span>
            </h3>
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
              {/* Marital Status */}
              <div>
                <label className="mb-1 block text-sm font-medium text-text-primary">
                  Marital Status
                </label>
                <select
                  className="w-full rounded-lg border border-border bg-neutral-bg px-3 py-2 text-sm text-text-primary focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                  value={maritalStatusId}
                  onChange={(e) => setMaritalStatusId(e.target.value)}
                >
                  <option value="">Select marital status</option>
                  {maritalStatuses.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Emergency Phone */}
              <div>
                <label className="mb-1 block text-sm font-medium text-text-primary">
                  Emergency Contact Phone
                </label>
                <input
                  type="text"
                  placeholder="e.g. +91 98765 43210"
                  className="w-full rounded-lg border border-border bg-neutral-bg px-3 py-2 text-sm text-text-primary focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                  value={emergencyPhone}
                  onChange={(e) => setEmergencyPhone(e.target.value)}
                />
              </div>

              {/* PF UAN No */}
              <div>
                <label className="mb-1 block text-sm font-medium text-text-primary">
                  PF UAN Number
                </label>
                <input
                  type="text"
                  placeholder="12-digit UAN"
                  className="w-full rounded-lg border border-border bg-neutral-bg px-3 py-2 text-sm font-mono text-text-primary focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                  value={pfUanNo}
                  onChange={(e) => setPfUanNo(e.target.value)}
                />
              </div>

              {/* ESIC No */}
              <div>
                <label className="mb-1 block text-sm font-medium text-text-primary">
                  ESIC Insurance Number
                </label>
                <input
                  type="text"
                  placeholder="ESIC IP number"
                  className="w-full rounded-lg border border-border bg-neutral-bg px-3 py-2 text-sm font-mono text-text-primary focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                  value={esicNo}
                  onChange={(e) => setEsicNo(e.target.value)}
                />
              </div>

              {/* Current Address */}
              <div className="sm:col-span-3">
                <label className="mb-1 block text-sm font-medium text-text-primary">
                  Current Address
                </label>
                <textarea
                  rows={3}
                  placeholder="House / flat, street, area, city, state, pincode"
                  className="w-full rounded-lg border border-border bg-neutral-bg px-3 py-2 text-sm text-text-primary focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                  value={currentAddress}
                  onChange={(e) => setCurrentAddress(e.target.value)}
                />
              </div>

              {/* Permanent Address */}
              <div className="sm:col-span-3">
                <label className="mb-1 block text-sm font-medium text-text-primary">
                  Permanent Address
                </label>
                <textarea
                  rows={3}
                  placeholder="House / flat, street, area, city, state, pincode"
                  className="w-full rounded-lg border border-border bg-neutral-bg px-3 py-2 text-sm text-text-primary focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                  value={permanentAddress}
                  onChange={(e) => setPermanentAddress(e.target.value)}
                />
              </div>
            </div>
          </div>

          {/* Separation / Resignation Section */}
          <div className="sm:col-span-2 border-t border-border pt-5 mt-2">
            <h3 className="text-sm font-semibold text-text-primary mb-4">Separation Details</h3>
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
              {/* Employment Status */}
              <div>
                <label className="mb-1 block text-sm font-medium text-text-primary">Employment Status</label>
                <select
                  className="w-full rounded-lg border border-border bg-neutral-bg px-3 py-2 text-sm text-text-primary focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                  value={employmentStatus}
                  onChange={(e) => setEmploymentStatus(e.target.value)}
                >
                  <option value="active">Active</option>
                  <option value="resigned">Resigned</option>
                  <option value="terminated">Terminated</option>
                  <option value="absconded">Absconded</option>
                </select>
              </div>

              {/* Resignation Date */}
              <div>
                <label className="mb-1 block text-sm font-medium text-text-primary">Resignation Date</label>
                <input
                  type="date"
                  className="w-full rounded-lg border border-border bg-neutral-bg px-3 py-2 text-sm text-text-primary focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                  value={resignationDate}
                  onChange={(e) => setResignationDate(e.target.value)}
                />
              </div>

              {/* Last Working Day */}
              <div>
                <label className="mb-1 block text-sm font-medium text-text-primary">Last Working Day</label>
                <input
                  type="date"
                  className="w-full rounded-lg border border-border bg-neutral-bg px-3 py-2 text-sm text-text-primary focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                  value={lastWorkingDay}
                  onChange={(e) => setLastWorkingDay(e.target.value)}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="mt-8 flex items-center gap-3 border-t border-border pt-6">
          <Button
            variant="primary"
            isLoading={saving}
            disabled={saving || !name.trim()}
            onClick={handleSave}
          >
            Save Changes
          </Button>
          <Link href={`/admin/employees/${id}`}>
            <Button variant="secondary" disabled={saving}>Cancel</Button>
          </Link>
        </div>
      </Card>

      {/* Sections mirroring the employee /profile page so HR has the same
          editing surface. Both are scoped to /admin/users/:userId so they
          respect the existing admin permission guards. */}
      <div className="mt-6">
        <AdminFamilySection userId={id} />
      </div>
      <div className="mt-6">
        <AdminDocumentsSection userId={id} />
      </div>
    </div>
  );
}

// =========================================================================
// Admin — Family members CRUD mirroring employee-side FamilySection
// =========================================================================

function AdminFamilySection({ userId }: { userId: string }) {
  const [rows, setRows] = useState<FamilyMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [relations, setRelations] = useState<MasterRecord[]>([]);
  const [draft, setDraft] = useState<{
    name: string;
    relation: string;
    occupation: string;
    dob: string;
    contact_no: string;
  }>({ name: '', relation: '', occupation: '', dob: '', contact_no: '' });
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);

  const load = useCallback(
    async (opts?: { silent?: boolean }) => {
      if (!opts?.silent) setLoading(true);
      try {
        const data = await api.get<FamilyMember[]>(
          `/admin/users/${userId}/family`,
        );
        setRows(data);
      } catch (err) {
        if (!opts?.silent) setError((err as ApiError).message || 'Failed to load family');
      } finally {
        if (!opts?.silent) setLoading(false);
      }
    },
    [userId],
  );

  useEffect(() => {
    load();
    // Master relations are fetched once — don't re-poll on auto-refresh.
    api
      .get<MasterRecord[]>('/master/relations')
      .then(setRelations)
      .catch(() => setRelations([]));
  }, [load]);

  // Pause silent polling while the admin is filling the inline add/edit
  // form so we don't refresh `rows` in the background — the form itself
  // is still safe (it's in `draft`, not bound to rows), but the list
  // jumping around mid-edit is distracting.
  useAutoRefresh(() => load({ silent: true }), { enabled: !showForm });

  function resetForm() {
    setDraft({ name: '', relation: '', occupation: '', dob: '', contact_no: '' });
    setEditingId(null);
    setShowForm(false);
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setSuccess('');
    if (!draft.name.trim() || !draft.relation.trim()) {
      setError('Name and Relation are required.');
      return;
    }
    setSaving(true);
    const payload = {
      name: draft.name.trim(),
      relation: draft.relation.trim(),
      occupation: draft.occupation.trim() || null,
      dob: draft.dob || null,
      contact_no: draft.contact_no.trim() || null,
    };
    try {
      if (editingId) {
        await api.patch(
          `/admin/users/${userId}/family/${editingId}`,
          payload,
        );
        setSuccess('Family member updated.');
      } else {
        await api.post(`/admin/users/${userId}/family`, payload);
        setSuccess('Family member added.');
      }
      resetForm();
      await load();
    } catch (err) {
      setError((err as ApiError).message || 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  async function startEdit(row: FamilyMember) {
    setEditingId(row.id);
    setDraft({
      name: row.name,
      relation: row.relation,
      occupation: row.occupation ?? '',
      dob: row.dob ?? '',
      contact_no: row.contact_no ?? '',
    });
    setShowForm(true);
  }

  async function remove(id: string) {
    if (!confirm('Remove this family member?')) return;
    try {
      await api.delete(`/admin/users/${userId}/family/${id}`);
      setRows(rows.filter((r) => r.id !== id));
    } catch (err) {
      setError((err as ApiError).message || 'Delete failed');
    }
  }

  return (
    <Card>
      <div className="flex items-center justify-between">
        <CardTitle>Family Members</CardTitle>
        {!showForm && (
          <Button size="sm" onClick={() => setShowForm(true)}>
            Add Member
          </Button>
        )}
      </div>

      {error && (
        <div className="mt-3 rounded-lg bg-red-50 px-4 py-2 text-sm text-red-700">
          {error}
        </div>
      )}
      {success && (
        <div className="mt-3 rounded-lg bg-green-50 px-4 py-2 text-sm text-green-800">
          {success}
        </div>
      )}

      {showForm && (
        <form
          onSubmit={submit}
          className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3 rounded-lg bg-neutral-bg p-4"
        >
          <input
            placeholder="Name *"
            value={draft.name}
            onChange={(e) => setDraft({ ...draft, name: e.target.value })}
            className="rounded-lg border border-border bg-white px-3 py-2 text-sm"
          />
          <select
            value={draft.relation}
            onChange={(e) => setDraft({ ...draft, relation: e.target.value })}
            className="rounded-lg border border-border bg-white px-3 py-2 text-sm"
          >
            <option value="">Select relation… *</option>
            {/*
              Surface the saved value if a label was deactivated after this
              row was created — admin can still re-save the row without
              losing the historical relation.
            */}
            {draft.relation &&
              !relations.some((r) => r.label === draft.relation) && (
                <option value={draft.relation}>{draft.relation}</option>
              )}
            {relations.map((r) => (
              <option key={r.id} value={r.label}>
                {r.label}
              </option>
            ))}
          </select>
          <input
            placeholder="Occupation"
            value={draft.occupation}
            onChange={(e) => setDraft({ ...draft, occupation: e.target.value })}
            className="rounded-lg border border-border bg-white px-3 py-2 text-sm"
          />
          <input
            type="date"
            max={maxDobDate()}
            value={draft.dob}
            onChange={(e) => setDraft({ ...draft, dob: e.target.value })}
            className="rounded-lg border border-border bg-white px-3 py-2 text-sm"
          />
          <input
            placeholder="Contact number"
            value={draft.contact_no}
            onChange={(e) => setDraft({ ...draft, contact_no: e.target.value })}
            className="rounded-lg border border-border bg-white px-3 py-2 text-sm sm:col-span-2"
          />
          <div className="sm:col-span-2 flex gap-2">
            <Button type="submit" isLoading={saving} disabled={saving}>
              {editingId ? 'Save Changes' : 'Add'}
            </Button>
            <Button
              type="button"
              variant="secondary"
              disabled={saving}
              onClick={resetForm}
            >
              Cancel
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
            {loading ? (
              <tr>
                <td colSpan={6} className="px-3 py-4 text-text-secondary">
                  Loading…
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-3 py-4 text-center text-text-secondary">
                  No family members recorded.
                </td>
              </tr>
            ) : (
              rows.map((r) => (
                <tr key={r.id}>
                  <td className="px-3 py-2 font-medium">{r.name}</td>
                  <td className="px-3 py-2 text-text-secondary">{r.relation}</td>
                  <td className="px-3 py-2 text-text-secondary">{r.occupation ?? '—'}</td>
                  <td className="px-3 py-2 text-text-secondary">
                    {r.dob ? formatDate(r.dob) : '—'}
                  </td>
                  <td className="px-3 py-2 text-text-secondary">{r.contact_no ?? '—'}</td>
                  <td className="px-3 py-2 text-right space-x-2">
                    <Button size="sm" variant="secondary" onClick={() => startEdit(r)}>
                      Edit
                    </Button>
                    <Button size="sm" variant="danger" onClick={() => remove(r.id)}>
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
// Admin — Documents upload/view/delete mirroring employee-side DocumentsSection
// =========================================================================

function AdminDocumentsSection({ userId }: { userId: string }) {
  const [docs, setDocs] = useState<EmployeeDoc[]>([]);
  const [docTypes, setDocTypes] = useState<MasterRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [docTypeId, setDocTypeId] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  const loadDocs = useCallback(
    async (opts?: { silent?: boolean }) => {
      try {
        const d = await api.get<EmployeeDoc[]>(
          `/admin/users/${userId}/documents`,
        );
        setDocs(d);
      } catch (err) {
        if (!opts?.silent) setError((err as ApiError).message || 'Failed to load documents');
      }
    },
    [userId],
  );

  useEffect(() => {
    (async () => {
      try {
        const t = await api.get<MasterRecord[]>('/master/document_types');
        setDocTypes(t);
      } catch {
        /* ignore — form still usable, just without type dropdown */
      }
      await loadDocs();
      setLoading(false);
    })();
  }, [userId, loadDocs]);

  // Silent poll — refresh the doc list when the employee uploads or
  // removes something, without interrupting the admin's current upload
  // form state (file picker + doc type selection live in local state).
  useAutoRefresh(() => loadDocs({ silent: true }));

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
    const isPdf =
      file.type === 'application/pdf' || /\.pdf$/i.test(file.name || '');
    if (!isPdf) {
      setError('Only PDF files are allowed for documents.');
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
          mime_type: 'application/pdf',
          file_size_bytes: file.size,
          context: 'user_document',
        },
      );
      const putRes = await fetch(pre.upload_url, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/pdf' },
        body: file,
      });
      if (!putRes.ok) throw new Error('S3 upload failed');
      const row = await api.post<EmployeeDoc>(
        `/admin/users/${userId}/documents`,
        {
          document_type_id: docTypeId,
          s3_key: pre.s3_key,
          label: null,
          file_size_bytes: file.size,
          mime_type: 'application/pdf',
        },
      );
      setDocs([row, ...docs]);
      setSuccess('Document uploaded.');
      setDocTypeId('');
      setFile(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setUploading(false);
    }
  }

  async function view(id: string) {
    setError('');
    try {
      const res = await api.get<{ url: string }>(
        `/admin/users/${userId}/documents/${id}/view-url`,
      );
      window.open(res.url, '_blank', 'noopener,noreferrer');
    } catch (err) {
      setError((err as ApiError).message || 'Could not open document');
    }
  }

  async function remove(id: string) {
    if (!confirm('Remove this document?')) return;
    try {
      await api.delete(`/admin/users/${userId}/documents/${id}`);
      setDocs(docs.filter((d) => d.id !== id));
    } catch (err) {
      setError((err as ApiError).message || 'Delete failed');
    }
  }

  return (
    <Card>
      <CardTitle>Documents</CardTitle>
      <p className="mt-1 text-xs text-text-secondary">
        Aadhaar, PAN, or other identity documents. PDF only · Max 10MB per file.
      </p>

      {error && (
        <div className="mt-3 rounded-lg bg-red-50 px-4 py-2 text-sm text-red-700">
          {error}
        </div>
      )}
      {success && (
        <div className="mt-3 rounded-lg bg-green-50 px-4 py-2 text-sm text-green-800">
          {success}
        </div>
      )}

      <form
        onSubmit={upload}
        className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-3 rounded-lg bg-neutral-bg p-4"
      >
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-text-secondary">
            Document Type *
          </label>
          <select
            value={docTypeId}
            onChange={(e) => setDocTypeId(e.target.value)}
            className="mt-1 w-full rounded-lg border border-border bg-white px-3 py-2 text-sm"
          >
            <option value="">Select…</option>
            {docTypes.map((t) => (
              <option key={t.id} value={t.id}>
                {t.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-text-secondary">
            PDF File *
          </label>
          <input
            type="file"
            accept="application/pdf,.pdf"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            className="mt-1 w-full text-sm"
          />
        </div>
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
              <th className="px-3 py-2">Document</th>
              <th className="px-3 py-2">Uploaded</th>
              <th className="px-3 py-2 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {loading ? (
              <tr>
                <td colSpan={3} className="px-3 py-4 text-text-secondary">
                  Loading…
                </td>
              </tr>
            ) : docs.length === 0 ? (
              <tr>
                <td
                  colSpan={3}
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
                    {formatDate(d.uploaded_at)}
                  </td>
                  <td className="px-3 py-2 text-right space-x-2">
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => view(d.id)}
                    >
                      View
                    </Button>
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

/**
 * Live-computed Monthly CTC display. CTC = Gross + Employer PF + Incentive
 * (PAYROLL_CALCULATION_ENGINE.md §4.7 / D5). Employer PF uses the conditional
 * rule from D4: basic >= 15,000 → 1,800 else round(basic * 0.12). Basic is
 * assumed 50% of Gross (the BASIC component default in payroll_salary_components).
 */
function CtcPreview({
  userId,
  gross,
  incentive,
  pfApplicable,
  statutory,
}: {
  userId: string;
  gross: string;
  incentive: string;
  pfApplicable: boolean;
  statutory: {
    pf_cap_amount: string;
    pf_fixed_at_cap: string;
    pf_rate_below_cap: string;
  } | null;
}) {
  const grossN = Number(gross) || 0;
  const incentiveN = Number(incentive) || 0;

  const cap = Number(statutory?.pf_cap_amount) || 15000;
  const fixedCap = Number(statutory?.pf_fixed_at_cap) || 1800;
  const rate = Number(statutory?.pf_rate_below_cap) || 0.12;

  const basic = grossN * 0.5;
  const employerPf =
    !pfApplicable || grossN === 0
      ? 0
      : basic >= cap
      ? fixedCap
      : Math.round(basic * rate);

  const monthlyCtc = grossN + employerPf + incentiveN;
  const annualCtc = monthlyCtc * 12;

  const fmt = (n: number) =>
    new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 2,
    }).format(n);

  return (
    <div className="text-sm">
      <div className="flex items-center justify-between">
        <span className="font-semibold text-text-primary">Monthly CTC</span>
        <span className="font-semibold text-text-primary">{fmt(monthlyCtc)}</span>
      </div>
      <div className="mt-1 flex items-center justify-between text-xs text-text-secondary">
        <span>Annual CTC (×12)</span>
        <span>{fmt(annualCtc)}</span>
      </div>
      <div className="mt-2 text-xs text-text-secondary">
        = Gross {fmt(grossN)} + Employer PF {fmt(employerPf)} + Incentive {fmt(incentiveN)}
        {!pfApplicable && <span className="ml-2 italic">(PF exempt)</span>}
      </div>
      <p className="mt-2 text-xs text-text-secondary">
        CTC is computed from Gross + statutory employer PF + Incentive. For
        detailed per-component setup (TDS, loan, salary deduction), open the{' '}
        <Link
          href={`/admin/payroll/employees/${userId}/salary`}
          className="underline text-accent"
        >
          full salary configuration page
        </Link>
        .
      </p>
    </div>
  );
}
