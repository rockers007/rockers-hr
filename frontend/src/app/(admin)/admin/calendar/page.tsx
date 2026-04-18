'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '@/lib/api';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { PageLoader } from '@/components/ui/spinner';

/* ─── Types ─── */
interface CalendarEvent {
  id: string;
  title: string;
  start: string;
  end: string;
  color: string;
  employee: { id: string; name: string };
  leave_type: { id: string; label: string; color: string };
  duration_type: string;
  working_days: number;
}

/* ─── Helpers ─── */
const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function pad(n: number) {
  return n.toString().padStart(2, '0');
}

function toDateStr(y: number, m: number, d: number) {
  return `${y}-${pad(m + 1)}-${pad(d)}`;
}

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfWeek(year: number, month: number) {
  return new Date(year, month, 1).getDay();
}

function formatShortDate(dateStr: string) {
  const d = new Date(dateStr);
  return `${MONTHS[d.getMonth()]?.slice(0, 3)} ${d.getDate()}`;
}

export default function AdminCalendarPage() {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentDate, setCurrentDate] = useState(() => new Date());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const fetchEvents = useCallback(async () => {
    try {
      setLoading(true);
      const from = `${year}-${pad(month + 1)}-01`;
      const lastDay = getDaysInMonth(year, month);
      const to = `${year}-${pad(month + 1)}-${pad(lastDay)}`;
      const res = await api.get<{ data: CalendarEvent[] }>(`/calendar?from=${from}&to=${to}`);
      const data = Array.isArray(res) ? res : (res as any)?.data ?? [];
      setEvents(data);
    } catch {
      setEvents([]);
    } finally {
      setLoading(false);
    }
  }, [year, month]);

  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  /* Build a map: dateStr → events[] */
  const eventMap = useMemo(() => {
    const map: Record<string, CalendarEvent[]> = {};
    for (const ev of events) {
      const startDate = new Date(ev.start);
      const endDate = new Date(ev.end);
      const cur = new Date(startDate);
      while (cur <= endDate) {
        const key = cur.toISOString().slice(0, 10);
        if (!map[key]) map[key] = [];
        map[key].push(ev);
        cur.setDate(cur.getDate() + 1);
      }
    }
    return map;
  }, [events]);

  /* Navigation */
  const goToPrev = () => {
    setCurrentDate(new Date(year, month - 1, 1));
    setSelectedDate(null);
  };
  const goToNext = () => {
    setCurrentDate(new Date(year, month + 1, 1));
    setSelectedDate(null);
  };
  const goToToday = () => {
    setCurrentDate(new Date());
    setSelectedDate(null);
  };

  /* Calendar grid */
  const daysInMonth = getDaysInMonth(year, month);
  const firstDow = getFirstDayOfWeek(year, month);
  const todayStr = new Date().toISOString().slice(0, 10);

  const cells: { date: string; day: number; isCurrentMonth: boolean }[] = [];
  // Prev month fill
  const prevMonthDays = getDaysInMonth(year, month - 1);
  for (let i = firstDow - 1; i >= 0; i--) {
    const d = prevMonthDays - i;
    const m = month === 0 ? 11 : month - 1;
    const y = month === 0 ? year - 1 : year;
    cells.push({ date: toDateStr(y, m, d), day: d, isCurrentMonth: false });
  }
  // Current month
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push({ date: toDateStr(year, month, d), day: d, isCurrentMonth: true });
  }
  // Next month fill
  const remaining = 7 - (cells.length % 7);
  if (remaining < 7) {
    for (let d = 1; d <= remaining; d++) {
      const m = month === 11 ? 0 : month + 1;
      const y = month === 11 ? year + 1 : year;
      cells.push({ date: toDateStr(y, m, d), day: d, isCurrentMonth: false });
    }
  }

  const selectedEvents = selectedDate ? (eventMap[selectedDate] ?? []) : [];

  if (loading) return <PageLoader />;

  return (
    <div>
      <h1 className="text-2xl font-bold text-text-primary mb-6">Team Calendar</h1>

      <div className="grid grid-cols-1 xl:grid-cols-[1fr_320px] gap-6">
        {/* Calendar Grid */}
        <Card>
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-semibold text-text-primary">
              {MONTHS[month]} {year}
            </h2>
            <div className="flex items-center gap-2">
              <Button variant="secondary" size="sm" onClick={goToPrev}>
                ←
              </Button>
              <Button variant="secondary" size="sm" onClick={goToToday}>
                Today
              </Button>
              <Button variant="secondary" size="sm" onClick={goToNext}>
                →
              </Button>
            </div>
          </div>

          {/* Day headers */}
          <div className="grid grid-cols-7 gap-px mb-1">
            {DAYS.map((d) => (
              <div key={d} className="py-2 text-center text-xs font-semibold text-text-secondary uppercase tracking-wider">
                {d}
              </div>
            ))}
          </div>

          {/* Day cells */}
          <div className="grid grid-cols-7 gap-px bg-border rounded-lg overflow-hidden">
            {cells.map((cell) => {
              const dayEvents = eventMap[cell.date] ?? [];
              const isToday = cell.date === todayStr;
              const isSelected = cell.date === selectedDate;

              return (
                <button
                  key={cell.date}
                  onClick={() => setSelectedDate(cell.date === selectedDate ? null : cell.date)}
                  className={`
                    relative min-h-[80px] p-1.5 text-left transition-colors bg-white hover:bg-primary/5
                    ${!cell.isCurrentMonth ? 'opacity-40' : ''}
                    ${isSelected ? 'ring-2 ring-primary ring-inset' : ''}
                  `}
                >
                  <span
                    className={`
                      inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-medium
                      ${isToday ? 'bg-primary text-white' : 'text-text-primary'}
                    `}
                  >
                    {cell.day}
                  </span>

                  {/* Event dots / pills */}
                  <div className="mt-0.5 space-y-0.5">
                    {dayEvents.slice(0, 3).map((ev) => (
                      <div
                        key={ev.id}
                        className="truncate rounded px-1 py-0.5 text-[10px] font-medium text-white leading-tight"
                        style={{ backgroundColor: ev.color || '#6366f1' }}
                        title={ev.title}
                      >
                        {ev.employee.name}
                      </div>
                    ))}
                    {dayEvents.length > 3 && (
                      <div className="text-[10px] text-text-secondary font-medium pl-1">
                        +{dayEvents.length - 3} more
                      </div>
                    )}
                  </div>
                </button>
              );
            })}
          </div>

          {/* Legend */}
          <div className="mt-4 flex flex-wrap gap-3">
            {Array.from(new Map(events.map((e) => [e.leave_type.id, e.leave_type]))).map(
              ([, lt]) => (
                <div key={lt.id} className="flex items-center gap-1.5 text-xs text-text-secondary">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: lt.color }} />
                  {lt.label}
                </div>
              ),
            )}
          </div>
        </Card>

        {/* Sidebar: selected date detail */}
        <div className="space-y-4">
          <Card>
            <h3 className="text-sm font-semibold text-text-primary mb-3">
              {selectedDate
                ? `${formatShortDate(selectedDate)} — ${selectedEvents.length} leave${selectedEvents.length !== 1 ? 's' : ''}`
                : 'Select a date to view details'}
            </h3>

            {!selectedDate && (
              <p className="text-xs text-text-secondary">Click on a date in the calendar to see leave details for that day.</p>
            )}

            {selectedDate && selectedEvents.length === 0 && (
              <p className="text-xs text-text-secondary">No approved leaves on this date.</p>
            )}

            <div className="space-y-3 mt-2">
              {selectedEvents.map((ev) => (
                <div key={ev.id} className="flex items-start gap-2.5 rounded-lg border border-border p-3">
                  <span className="mt-0.5 h-3 w-3 rounded-full shrink-0" style={{ backgroundColor: ev.color || '#6366f1' }} />
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-text-primary truncate">{ev.employee.name}</p>
                    <p className="text-xs text-text-secondary">
                      {ev.leave_type.label} · {ev.duration_type} · {ev.working_days} day{ev.working_days !== 1 ? 's' : ''}
                    </p>
                    <p className="text-xs text-text-secondary mt-0.5">
                      {formatShortDate(ev.start)} — {formatShortDate(ev.end)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </Card>

          {/* Summary stats */}
          <Card>
            <h3 className="text-sm font-semibold text-text-primary mb-3">
              {MONTHS[month]} Summary
            </h3>
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-text-secondary">Total leaves</span>
                <span className="font-medium text-text-primary">{events.length}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-text-secondary">Employees on leave</span>
                <span className="font-medium text-text-primary">
                  {new Set(events.map((e) => e.employee.id)).size}
                </span>
              </div>
              {/* Breakdown by type */}
              {Array.from(
                events.reduce((acc, ev) => {
                  const key = ev.leave_type.label;
                  acc.set(key, { count: (acc.get(key)?.count ?? 0) + 1, color: ev.leave_type.color });
                  return acc;
                }, new Map<string, { count: number; color: string }>()),
              ).map(([label, { count, color }]) => (
                <div key={label} className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-1.5 text-text-secondary">
                    <span className="h-2 w-2 rounded-full" style={{ backgroundColor: color }} />
                    {label}
                  </span>
                  <span className="font-medium text-text-primary">{count}</span>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
