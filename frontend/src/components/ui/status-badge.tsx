import { clsx } from 'clsx';
import type { LeaveStatus } from '@/lib/types';

const statusStyles: Record<LeaveStatus, { bg: string; text: string; label: string }> = {
  PENDING_L1: { bg: 'bg-[#fef3c7]', text: 'text-[#92400e]', label: 'Pending L1' },
  PENDING_L2: { bg: 'bg-[#dbeafe]', text: 'text-[#1e40af]', label: 'Pending L2' },
  APPROVED:   { bg: 'bg-[#d1fae5]', text: 'text-[#065f46]', label: 'Approved' },
  DECLINED:   { bg: 'bg-[#fee2e2]', text: 'text-[#991b1b]', label: 'Declined' },
  ESCALATED:  { bg: 'bg-[#ede9fe]', text: 'text-[#5b21b6]', label: 'Escalated' },
  CANCELLED:  { bg: 'bg-[#f1f5f9]', text: 'text-[#475569]', label: 'Cancelled' },
};

export function StatusBadge({
  status,
  className,
}: {
  status: LeaveStatus;
  className?: string;
}) {
  const style = statusStyles[status];
  return (
    <span
      className={clsx(
        'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium',
        style.bg,
        style.text,
        className,
      )}
    >
      {style.label}
    </span>
  );
}
