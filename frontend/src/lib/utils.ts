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

/**
 * Date-of-birth rule: must be strictly in the past (never today, never future).
 * Returns an ISO yyyy-MM-dd string for yesterday in the local timezone,
 * suitable for the `max` attribute of an HTML <input type="date">.
 */
export function maxDobDate(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/**
 * Validate a yyyy-MM-dd date-of-birth string on the frontend before submit.
 * Returns null when valid, or a human-readable error message when not.
 */
export function validateDob(value: string | null | undefined): string | null {
  if (!value) return null; // empty is allowed where DOB is optional
  const chosen = new Date(value + 'T00:00:00');
  if (Number.isNaN(chosen.getTime())) return 'Invalid date.';
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  if (chosen.getTime() >= today.getTime()) {
    return 'Date of birth must be in the past.';
  }
  return null;
}
