import { format, parseISO } from 'date-fns';

export function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '-';
  return format(parseISO(dateStr), 'MMM d, yyyy');
}

export function formatDateRange(start: string | null | undefined, end: string | null | undefined): string {
  if (!start || !end) return '-';
  const startStr = typeof start === 'string' ? start : String(start);
  const endStr = typeof end === 'string' ? end : String(end);
  const s = parseISO(startStr);
  const e = parseISO(endStr);
  if (isNaN(s.getTime()) || isNaN(e.getTime())) return '-';
  if (startStr === endStr) return format(s, 'MMM d, yyyy');
  if (s.getMonth() === e.getMonth() && s.getFullYear() === e.getFullYear()) {
    return `${format(s, 'MMM d')}–${format(e, 'd, yyyy')}`;
  }
  return `${format(s, 'MMM d')} – ${format(e, 'MMM d, yyyy')}`;
}

export function getInitials(name: string): string {
  return name
    .split(' ')
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();
}
