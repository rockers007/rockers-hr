'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { api, type ApiResponse } from '@/lib/api';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { PageLoader } from '@/components/ui/spinner';
import { useMasterData } from '@/lib/master-data';
import { getInitials, formatDate } from '@/lib/utils';
import type { MasterRecord } from '@/lib/types';

interface EmployeeRow {
  id: string;
  name: string;
  gmail: string;
  photo_url: string | null;
  department: { id: string; label: string } | null;
  roleType: { label: string } | null;
  is_active: boolean;
  join_date: string;
}


export default function EmployeesPage() {
  const { data: master, isLoading: masterLoading } = useMasterData();

  const [employees, setEmployees] = useState<EmployeeRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [departmentId, setDepartmentId] = useState('');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const limit = 20;

  const fetchEmployees = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: String(limit),
      });
      if (search.trim()) params.set('search', search.trim());
      if (departmentId) params.set('department_id', departmentId);

      const res = await api.getWithMeta<EmployeeRow[]>(`/admin/users?${params}`);
      setEmployees(res.data ?? []);
      setTotal(res.meta?.total ?? 0);
    } catch {
      setEmployees([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [page, search, departmentId]);

  useEffect(() => {
    fetchEmployees();
  }, [fetchEmployees]);

  // Reset to page 1 when filters change
  useEffect(() => {
    setPage(1);
  }, [search, departmentId]);

  const totalPages = Math.max(1, Math.ceil(total / limit));

  if (masterLoading) return <PageLoader />;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">Employees</h1>
          <p className="mt-1 text-sm text-text-secondary">
            {total} employee{total !== 1 ? 's' : ''} total
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 mb-6 flex-wrap">
        <div className="relative flex-1 max-w-sm">
          <svg
            className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-secondary"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
          <input
            type="text"
            placeholder="Search by name or email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-lg border border-border pl-10 pr-3 py-2.5 text-sm focus:border-accent focus:ring-1 focus:ring-accent outline-none"
          />
        </div>
        <select
          value={departmentId}
          onChange={(e) => setDepartmentId(e.target.value)}
          className="rounded-lg border border-border px-3 py-2.5 text-sm bg-white"
        >
          <option value="">All Departments</option>
          {master.departments.map((d: MasterRecord) => (
            <option key={d.id} value={d.id}>
              {d.label}
            </option>
          ))}
        </select>
      </div>

      {/* Content */}
      {loading ? (
        <PageLoader />
      ) : employees.length === 0 ? (
        <Card>
          <EmptyState
            title="No employees found"
            description={
              search || departmentId
                ? 'Try adjusting your search or filters.'
                : 'No employees have been registered yet.'
            }
          />
        </Card>
      ) : (
        <>
          {/* Table */}
          <Card className="overflow-hidden p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-neutral-bg">
                    <th className="px-6 py-3 text-left font-medium text-text-secondary">
                      Employee
                    </th>
                    <th className="px-6 py-3 text-left font-medium text-text-secondary">
                      Department
                    </th>
                    <th className="px-6 py-3 text-left font-medium text-text-secondary">
                      Role
                    </th>
                    <th className="px-6 py-3 text-left font-medium text-text-secondary">
                      Join Date
                    </th>
                    <th className="px-6 py-3 text-left font-medium text-text-secondary">
                      Status
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {employees.map((emp) => (
                    <tr
                      key={emp.id}
                      className="hover:bg-neutral-bg/50 transition-colors cursor-pointer"
                    >
                      <td className="px-6 py-4">
                        <Link
                          href={`/admin/employees/${emp.id}`}
                          className="flex items-center gap-3"
                        >
                          {emp.photo_url ? (
                            <img
                              src={emp.photo_url}
                              alt={emp.name}
                              className="h-9 w-9 rounded-full object-cover"
                            />
                          ) : (
                            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-accent/10 text-accent text-xs font-semibold">
                              {getInitials(emp.name)}
                            </div>
                          )}
                          <div>
                            <p className="font-medium text-text-primary">
                              {emp.name}
                            </p>
                            <p className="text-xs text-text-secondary">
                              {emp.gmail}
                            </p>
                          </div>
                        </Link>
                      </td>
                      <td className="px-6 py-4 text-text-primary">
                        {emp.department?.label ?? '-'}
                      </td>
                      <td className="px-6 py-4 text-text-primary capitalize">
                        {emp.roleType?.label ?? '-'}
                      </td>
                      <td className="px-6 py-4 text-text-secondary">
                        {formatDate(emp.join_date)}
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                            emp.is_active
                              ? 'bg-[#d1fae5] text-[#065f46]'
                              : 'bg-[#f1f5f9] text-[#475569]'
                          }`}
                        >
                          {emp.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="mt-4 flex items-center justify-between">
              <p className="text-sm text-text-secondary">
                Showing {(page - 1) * limit + 1}–
                {Math.min(page * limit, total)} of {total}
              </p>
              <div className="flex items-center gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => p - 1)}
                >
                  Previous
                </Button>
                {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                  let pageNum: number;
                  if (totalPages <= 5) {
                    pageNum = i + 1;
                  } else if (page <= 3) {
                    pageNum = i + 1;
                  } else if (page >= totalPages - 2) {
                    pageNum = totalPages - 4 + i;
                  } else {
                    pageNum = page - 2 + i;
                  }
                  return (
                    <button
                      key={pageNum}
                      onClick={() => setPage(pageNum)}
                      className={`h-8 w-8 rounded-lg text-sm font-medium transition-colors ${
                        page === pageNum
                          ? 'bg-accent text-white'
                          : 'text-text-secondary hover:bg-gray-100'
                      }`}
                    >
                      {pageNum}
                    </button>
                  );
                })}
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => p + 1)}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
