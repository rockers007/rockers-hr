'use client';

import Link from 'next/link';
import { Card, CardTitle } from '@/components/ui/card';

const REPORT_LINKS = [
  {
    title: 'Monthly Report',
    description: 'Leave days by type, approval rates, and SLA compliance for a given month.',
    href: '/admin/reports/monthly',
    icon: '📊',
  },
  {
    title: 'Yearly Report',
    description: 'Annual trends, monthly breakdown, and per-employee summary for the year.',
    href: '/admin/reports/yearly',
    icon: '📈',
  },
  {
    title: 'Leave Balance Report',
    description: 'Employees with remaining unused leave balance — compensation eligibility.',
    href: '/admin/reports/high-usage',
    icon: '📋',
  },
];

export default function ReportsPage() {
  return (
    <div>
      <h1 className="text-2xl font-bold text-text-primary mb-6">Reports</h1>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {REPORT_LINKS.map((report) => (
          <Link key={report.href} href={report.href} className="block group">
            <Card className="h-full transition-shadow hover:shadow-md">
              <div className="flex items-start gap-3">
                <span className="text-2xl">{report.icon}</span>
                <div>
                  <CardTitle className="group-hover:text-primary transition-colors">
                    {report.title}
                  </CardTitle>
                  <p className="mt-1 text-sm text-text-secondary">{report.description}</p>
                </div>
              </div>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
