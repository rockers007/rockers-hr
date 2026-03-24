'use client';

import Link from 'next/link';
import { Card } from '@/components/ui/card';

const MASTER_TABLES = [
  { key: 'qualifications', label: 'Qualifications', description: 'Degree/education dropdown options' },
  { key: 'genders', label: 'Genders', description: 'Gender dropdown options' },
  { key: 'role_types', label: 'Role Types', description: 'Employee role types (Employee, Manager)' },
  { key: 'leave_types', label: 'Leave Types', description: 'All leave categories with day allocations' },
  { key: 'leave_durations', label: 'Leave Durations', description: 'Full Day / Half Day options' },
  { key: 'departments', label: 'Departments', description: 'Company departments' },
  { key: 'file_types', label: 'File Types', description: 'Allowed upload file types and size limits' },
  { key: 'notification_templates', label: 'Notification Templates', description: 'Email and in-app notification content' },
  { key: 'sla_config', label: 'SLA Configuration', description: 'SLA windows, business hours, probation settings' },
  { key: 'public_holidays', label: 'Public Holidays', description: 'Holiday calendar for working day calculation' },
  { key: 'admin_roles', label: 'Admin Roles', description: 'Admin panel RBAC permission matrix' },
];

export default function MasterDataHubPage() {
  return (
    <div>
      <h1 className="text-2xl font-bold text-text-primary">Master Data</h1>
      <p className="mt-2 text-sm text-text-secondary">
        Manage all configuration tables. Changes take effect immediately across the platform.
      </p>

      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {MASTER_TABLES.map((table) => (
          <Link key={table.key} href={`/admin/master/${table.key}`}>
            <Card className="h-full p-5 hover:border-accent transition-colors cursor-pointer">
              <h3 className="font-semibold text-text-primary">{table.label}</h3>
              <p className="mt-1 text-xs text-text-secondary">{table.description}</p>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
