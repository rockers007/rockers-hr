'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { api, ApiError } from '@/lib/api';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { PageLoader } from '@/components/ui/spinner';
import { useToast } from '@/components/ui/toast';

const TABLE_LABELS: Record<string, string> = {
  qualifications: 'Qualifications',
  genders: 'Genders',
  role_types: 'Role Types',
  leave_types: 'Leave Types',
  leave_durations: 'Leave Durations',
  departments: 'Departments',
  file_types: 'File Types',
  notification_templates: 'Notification Templates',
  sla_config: 'SLA Configuration',
  public_holidays: 'Public Holidays',
  admin_roles: 'Admin Roles',
};

// Schema per table: defines columns, their types, and which are required for creation
const TABLE_SCHEMAS: Record<string, { key: string; type: 'text' | 'number' | 'boolean' | 'date'; required?: boolean }[]> = {
  qualifications: [
    { key: 'label', type: 'text', required: true },
    { key: 'sort_order', type: 'number' },
    { key: 'is_active', type: 'boolean' },
  ],
  genders: [
    { key: 'label', type: 'text', required: true },
    { key: 'sort_order', type: 'number' },
    { key: 'is_active', type: 'boolean' },
  ],
  role_types: [
    { key: 'label', type: 'text', required: true },
    { key: 'system_key', type: 'text', required: true },
    { key: 'sort_order', type: 'number' },
    { key: 'is_active', type: 'boolean' },
  ],
  leave_types: [
    { key: 'label', type: 'text', required: true },
    { key: 'annual_days', type: 'number', required: true },
    { key: 'probation_allowed', type: 'boolean' },
    { key: 'doc_required', type: 'boolean' },
    { key: 'doc_threshold_days', type: 'number' },
    { key: 'carry_over', type: 'number' },
    { key: 'color', type: 'text' },
    { key: 'sort_order', type: 'number' },
    { key: 'is_active', type: 'boolean' },
    { key: 'notes', type: 'text' },
  ],
  leave_durations: [
    { key: 'label', type: 'text', required: true },
    { key: 'day_value', type: 'number', required: true },
    { key: 'sort_order', type: 'number' },
    { key: 'is_active', type: 'boolean' },
  ],
  departments: [
    { key: 'label', type: 'text', required: true },
    { key: 'code', type: 'text', required: true },
    { key: 'sort_order', type: 'number' },
    { key: 'is_active', type: 'boolean' },
  ],
  file_types: [
    { key: 'mime_type', type: 'text', required: true },
    { key: 'extension', type: 'text', required: true },
    { key: 'max_size_mb', type: 'number', required: true },
    { key: 'context', type: 'text', required: true },
    { key: 'is_active', type: 'boolean' },
  ],
  notification_templates: [
    { key: 'event_key', type: 'text', required: true },
    { key: 'subject_template', type: 'text' },
    { key: 'body_template', type: 'text', required: true },
    { key: 'channel', type: 'text', required: true },
    { key: 'is_active', type: 'boolean' },
  ],
  sla_config: [
    { key: 'config_key', type: 'text', required: true },
    { key: 'config_value', type: 'text', required: true },
    { key: 'description', type: 'text' },
  ],
  public_holidays: [
    { key: 'label', type: 'text', required: true },
    { key: 'date', type: 'date', required: true },
    { key: 'year', type: 'number', required: true },
    { key: 'is_optional', type: 'boolean' },
    { key: 'is_active', type: 'boolean' },
  ],
  admin_roles: [
    { key: 'name', type: 'text', required: true },
    { key: 'permissions', type: 'text', required: true },
  ],
};

// Columns that are auto-generated and should not be editable
const HIDDEN_COLS = ['id', 'created_by', 'updated_by', 'created_at', 'updated_at', 'createdByAdmin'];

// Columns excluded from the "Add new" form (auto-set by DB)
const AUTO_COLS = [...HIDDEN_COLS, 'is_active'];

function inferType(key: string, sample: any): 'boolean' | 'number' | 'date' | 'text' {
  if (typeof sample === 'boolean') return 'boolean';
  if (typeof sample === 'number') return 'number';
  if (key === 'date' || key.endsWith('_date')) return 'date';
  if (['sort_order', 'annual_days', 'max_size_mb', 'year', 'doc_threshold_days', 'carry_over'].includes(key)) return 'number';
  if (['is_active', 'is_optional', 'probation_allowed', 'doc_required'].includes(key)) return 'boolean';
  if (['day_value'].includes(key)) return 'number';
  return 'text';
}

function coerceValue(key: string, value: string, type: string): any {
  if (value === '' || value === undefined) return null;
  // `value` is always a string here (HTML <input> and <select> both
  // produce string values). The previous `|| value === true` branch
  // was unreachable — TS 5.x correctly flags string-vs-boolean
  // equality as a definite-mismatch error. Removed.
  if (type === 'boolean') return value === 'true';
  if (type === 'number') return Number(value);
  return value;
}

export default function MasterTablePage() {
  const params = useParams();
  const table = params.table as string;
  const { toast } = useToast();

  const [records, setRecords] = useState<Record<string, any>[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Record<string, any>>({});
  const [addingNew, setAddingNew] = useState(false);
  const [newForm, setNewForm] = useState<Record<string, any>>({});

  const fetchRecords = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.get<Record<string, any>[]>(`/master/${table}/all`);
      setRecords(Array.isArray(data) ? data : []);
    } catch {
      setRecords([]);
    } finally {
      setLoading(false);
    }
  }, [table]);

  useEffect(() => {
    fetchRecords();
  }, [fetchRecords]);

  const schema = TABLE_SCHEMAS[table] ?? [];

  // Display columns: from data if available, otherwise from schema
  const displayColumns = records.length > 0
    ? Object.keys(records[0]).filter((k) => !HIDDEN_COLS.includes(k))
    : schema.map((s) => s.key);

  // Columns for the "Add new" form: from schema, excluding auto-set fields
  const addColumns = schema.filter((s) => !['is_active'].includes(s.key));

  const sampleRecord = records[0] ?? {};

  function getColType(col: string): 'boolean' | 'number' | 'date' | 'text' {
    const s = schema.find((s) => s.key === col);
    if (s) return s.type;
    return inferType(col, sampleRecord[col]);
  }

  async function handleSave(id: string) {
    try {
      const body: Record<string, any> = {};
      for (const [key, value] of Object.entries(editForm)) {
        body[key] = coerceValue(key, value, getColType(key));
      }
      await api.patch(`/master/${table}/${id}`, body);
      toast('Record updated', 'success');
      setEditingId(null);
      fetchRecords();
    } catch (err) {
      toast(err instanceof ApiError ? err.message : 'Update failed', 'error');
    }
  }

  async function handleCreate() {
    // Validate required fields
    const missing = addColumns.filter((s) => s.required && !newForm[s.key]?.toString().trim());
    if (missing.length > 0) {
      toast(`Required: ${missing.map((s) => s.key.replace(/_/g, ' ')).join(', ')}`, 'error');
      return;
    }

    try {
      const body: Record<string, any> = {};
      for (const s of addColumns) {
        const val = newForm[s.key];
        if (val !== undefined && val !== '') {
          body[s.key] = coerceValue(s.key, val, s.type);
        }
      }
      await api.post(`/master/${table}`, body);
      toast('Record created', 'success');
      setAddingNew(false);
      setNewForm({});
      fetchRecords();
    } catch (err) {
      toast(err instanceof ApiError ? err.message : 'Create failed', 'error');
    }
  }

  async function handleToggleActive(id: string, currentlyActive: boolean) {
    try {
      if (currentlyActive) {
        await api.delete(`/master/${table}/${id}`);
      } else {
        await api.patch(`/master/${table}/${id}`, { is_active: true });
      }
      toast(currentlyActive ? 'Record deactivated' : 'Record activated', 'success');
      fetchRecords();
    } catch (err) {
      toast(err instanceof ApiError ? err.message : 'Action failed', 'error');
    }
  }

  function formatValue(value: any): string {
    if (value === null || value === undefined) return '-';
    if (typeof value === 'boolean') return value ? 'Yes' : 'No';
    if (Array.isArray(value)) return value.length + ' items';
    if (typeof value === 'object') return JSON.stringify(value);
    return String(value);
  }

  function renderInput(col: string, value: any, onChange: (val: string) => void) {
    const type = getColType(col);
    if (type === 'boolean') {
      return (
        <select
          value={String(value ?? '')}
          onChange={(e) => onChange(e.target.value)}
          className="w-full rounded border border-border px-2 py-1 text-sm"
        >
          <option value="">--</option>
          <option value="true">Yes</option>
          <option value="false">No</option>
        </select>
      );
    }
    if (type === 'number') {
      return (
        <input
          type="number"
          value={value ?? ''}
          onChange={(e) => onChange(e.target.value)}
          placeholder={col}
          className="w-full rounded border border-border px-2 py-1 text-sm"
        />
      );
    }
    if (type === 'date') {
      return (
        <input
          type="date"
          value={value ?? ''}
          onChange={(e) => onChange(e.target.value)}
          className="w-full rounded border border-border px-2 py-1 text-sm"
        />
      );
    }
    return (
      <input
        type="text"
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value)}
        placeholder={col}
        className="w-full rounded border border-border px-2 py-1 text-sm"
      />
    );
  }

  return (
    <div>
      <div className="flex items-center gap-2 mb-1">
        <Link href="/admin/master" className="text-sm text-text-secondary hover:text-accent">
          Master Data
        </Link>
        <span className="text-text-secondary text-sm">/</span>
        <span className="text-sm font-medium text-text-primary">{TABLE_LABELS[table] ?? table}</span>
      </div>
      <div className="flex items-center justify-between mt-4 mb-6">
        <h1 className="text-2xl font-bold text-text-primary">{TABLE_LABELS[table] ?? table}</h1>
        <Button onClick={() => { setAddingNew(true); setNewForm({}); }}>
          Add Record
        </Button>
      </div>

      {loading ? (
        <PageLoader />
      ) : (
        <Card className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-neutral-bg/50">
                {(addingNew && records.length === 0 ? addColumns.map((s) => s.key) : displayColumns).map((col) => (
                  <th key={col} className="px-4 py-3 text-left font-medium text-text-secondary whitespace-nowrap capitalize">
                    {col.replace(/_/g, ' ')}
                  </th>
                ))}
                <th className="px-4 py-3 text-right font-medium text-text-secondary">Actions</th>
              </tr>
            </thead>
            <tbody>
              {addingNew && (
                <tr className="border-b border-border bg-blue-50/30">
                  {addColumns.map((s) => (
                    <td key={s.key} className="px-4 py-2">
                      {renderInput(s.key, newForm[s.key], (val) => setNewForm((p) => ({ ...p, [s.key]: val })))}
                    </td>
                  ))}
                  {/* Fill remaining display columns if records exist */}
                  {records.length > 0 && displayColumns.length > addColumns.length &&
                    Array.from({ length: displayColumns.length - addColumns.length }).map((_, i) => (
                      <td key={`pad-${i}`} className="px-4 py-2">
                        <span className="text-xs text-text-secondary italic">auto</span>
                      </td>
                    ))
                  }
                  <td className="px-4 py-2 text-right whitespace-nowrap">
                    <Button size="sm" onClick={handleCreate}>Save</Button>
                    <button className="ml-2 text-xs text-text-secondary hover:text-text-primary" onClick={() => setAddingNew(false)}>Cancel</button>
                  </td>
                </tr>
              )}
              {records.length === 0 && !addingNew && (
                <tr>
                  <td colSpan={displayColumns.length + 1}>
                    <EmptyState title="No records" description="Click 'Add Record' to create the first entry." />
                  </td>
                </tr>
              )}
              {records.map((rec) => (
                <tr key={rec.id} className="border-b border-border hover:bg-neutral-bg/30">
                  {displayColumns.map((col) => (
                    <td key={col} className="px-4 py-3 text-text-primary max-w-[250px] truncate">
                      {editingId === rec.id ? (
                        renderInput(col, editForm[col] ?? rec[col], (val) => setEditForm((p) => ({ ...p, [col]: val })))
                      ) : getColType(col) === 'boolean' ? (
                        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${rec[col] ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                          {rec[col] ? 'Yes' : 'No'}
                        </span>
                      ) : (
                        formatValue(rec[col])
                      )}
                    </td>
                  ))}
                  <td className="px-4 py-3 text-right whitespace-nowrap">
                    {editingId === rec.id ? (
                      <>
                        <Button size="sm" onClick={() => handleSave(rec.id)}>Save</Button>
                        <button className="ml-2 text-xs text-text-secondary hover:text-text-primary" onClick={() => setEditingId(null)}>Cancel</button>
                      </>
                    ) : (
                      <>
                        <button
                          className="text-xs text-accent hover:underline"
                          onClick={() => { setEditingId(rec.id); setEditForm({}); }}
                        >
                          Edit
                        </button>
                        {rec.is_active !== undefined && (
                          <button
                            className={`ml-3 text-xs ${rec.is_active ? 'text-red-600 hover:underline' : 'text-green-600 hover:underline'}`}
                            onClick={() => handleToggleActive(rec.id, rec.is_active)}
                          >
                            {rec.is_active ? 'Deactivate' : 'Activate'}
                          </button>
                        )}
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}
