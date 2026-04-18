'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { api, ApiError } from '@/lib/api';
import { Card, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { PageLoader } from '@/components/ui/spinner';
import { useToast } from '@/components/ui/toast';
import { useMasterData } from '@/lib/master-data';

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
  gross: string;
  incentive: string;
  pf_applicable: boolean;
  dob: string | null;
  // Bank
  bank_name: string | null;
  bank_account_no: string | null;
  bank_ifsc: string | null;
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
  const [designation, setDesignation] = useState('');
  const [gross, setGross] = useState('');
  const [incentive, setIncentive] = useState('');
  const [pfApplicable, setPfApplicable] = useState(true);
  const [dob, setDob] = useState('');

  // Bank state
  const [bankName, setBankName] = useState('');
  const [bankAccountNo, setBankAccountNo] = useState('');
  const [bankIfsc, setBankIfsc] = useState('');
  const [statutory, setStatutory] = useState<{
    pf_cap_amount: string;
    pf_fixed_at_cap: string;
    pf_rate_below_cap: string;
  } | null>(null);

  useEffect(() => {
    async function load() {
      try {
        setLoading(true);
        const [emp, mgrs] = await Promise.all([
          api.get<EmployeeData>(`/admin/users/${id}`),
          api.get<ManagerOption[]>('/admin/users/managers').catch(() => []),
        ]);

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
        setDesignation(emp.designation ?? '');
        setGross(emp.gross ?? '');
        setIncentive(emp.incentive ?? '');
        setPfApplicable(emp.pf_applicable ?? true);
        setDob(emp.dob ? emp.dob.split('T')[0] : '');
        setBankName(emp.bank_name ?? '');
        setBankAccountNo(emp.bank_account_no ?? '');
        setBankIfsc(emp.bank_ifsc ?? '');
        setManagers(Array.isArray(mgrs) ? mgrs : []);

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
  }, [id]);

  const handleSave = async () => {
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
        designation: designation.trim() || null,
        gross: gross === '' ? 0 : Number(gross),
        incentive: incentive === '' ? 0 : Number(incentive),
        pf_applicable: pfApplicable,
        dob: dob || null,
        // Bank details
        bank_name: bankName.trim() || null,
        bank_account_no: bankAccountNo.trim() || null,
        bank_ifsc: bankIfsc.trim().toUpperCase() || null,
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

              {/* Designation */}
              <div>
                <label className="mb-1 block text-sm font-medium text-text-primary">
                  Designation
                </label>
                <input
                  type="text"
                  placeholder="e.g. Full Stack Developer"
                  className="w-full rounded-lg border border-border bg-neutral-bg px-3 py-2 text-sm text-text-primary focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                  value={designation}
                  onChange={(e) => setDesignation(e.target.value)}
                />
              </div>

              {/* DOB */}
              <div>
                <label className="mb-1 block text-sm font-medium text-text-primary">
                  Date of Birth{' '}
                  <span className="text-xs font-normal text-text-secondary">(payslip PDF password = DDMM)</span>
                </label>
                <input
                  type="date"
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
    </div>
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
