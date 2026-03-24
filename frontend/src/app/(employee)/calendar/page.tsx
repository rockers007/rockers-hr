'use client';

import { useEffect, useState, useMemo, useCallback } from 'react';
import { api } from '@/lib/api';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { PageLoader } from '@/components/ui/spinner';
import { EmptyState } from '@/components/ui/empty-state';
import type { LeaveRequest, LeaveStatus } from '@/lib/types';
import {
  format,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  getDay,
  addMonths,
  subMonths,
  isSameMonth,
  isToday,
  parseISO,
} from 'date-fns';

const VISIBLE_STATUSES: LeaveStatus[] = ['APPROVED', 'PENDING_L1', 'PENDING_L2'];
const WEEKDAY_HEADERS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

function getLeavesForDay(day: Date, leaves: LeaveRequest[]): LeaveRequest[] {
  const dayStr = format(day, 'yyyy-MM-dd');
  return leaves.filter((lr) => {
    if (!VISIBLE_STATUSES.includes(lr.status)) return false;
    return dayStr >= lr.start_date && dayStr <= lr.end_date;
  });
}

export default function CalendarPage() {
  const [currentMonth, setCurrentMonth] = useState(() => startOfMonth(new Date()));
  const [leaves, setLeaves] = useState<LeaveRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const year = currentMonth.getFullYear();

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(false);

    api
      .get<LeaveRequest[]>(`/leave/requests?year=${year}&limit=100`)
      .then((data) => {
        if (!cancelled) setLeaves(data);
      })
      .catch(() => {
        if (!cancelled) setError(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [year]);

  const handlePrev = useCallback(() => setCurrentMonth((m) => subMonths(m, 1)), []);
  const handleNext = useCallback(() => setCurrentMonth((m) => addMonths(m, 1)), []);

  // Build calendar grid days including leading/trailing days to fill the week rows
  const calendarDays = useMemo(() => {
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(currentMonth);
    const daysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd });

    // getDay returns 0=Sun, we want Mon=0, so adjust
    const startDow = (getDay(monthStart) + 6) % 7; // 0=Mon ... 6=Sun

    // Leading days from previous month
    const leading: (Date | null)[] = Array.from({ length: startDow }, () => null);

    // Trailing days to fill last row
    const totalCells = leading.length + daysInMonth.length;
    const trailingCount = totalCells % 7 === 0 ? 0 : 7 - (totalCells % 7);
    const trailing: (Date | null)[] = Array.from({ length: trailingCount }, () => null);

    return [...leading, ...daysInMonth, ...trailing];
  }, [currentMonth]);

  // Unique leave types for legend (only visible statuses)
  const legendTypes = useMemo(() => {
    const seen = new Map<string, { label: string; color: string }>();
    for (const lr of leaves) {
      if (VISIBLE_STATUSES.includes(lr.status) && !seen.has(lr.leave_type.id)) {
        seen.set(lr.leave_type.id, { label: lr.leave_type.label, color: lr.leave_type.color });
      }
    }
    return Array.from(seen.values());
  }, [leaves]);

  if (loading) return <PageLoader />;

  if (error) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold text-text-primary">My Calendar</h1>
        <EmptyState
          title="Failed to load calendar"
          description="Could not fetch your leave data. Please try again."
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-text-primary">My Calendar</h1>

      <Card>
        {/* Month navigation */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <Button variant="ghost" size="sm" onClick={handlePrev}>
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </Button>

          <h2 className="text-lg font-semibold text-text-primary">
            {format(currentMonth, 'MMMM yyyy')}
          </h2>

          <Button variant="ghost" size="sm" onClick={handleNext}>
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </Button>
        </div>

        {/* Weekday headers */}
        <div className="grid grid-cols-7 border-b border-border">
          {WEEKDAY_HEADERS.map((day) => (
            <div
              key={day}
              className="py-2 text-center text-xs font-medium text-text-secondary uppercase"
            >
              {day}
            </div>
          ))}
        </div>

        {/* Calendar grid */}
        <div className="grid grid-cols-7">
          {calendarDays.map((day, idx) => {
            if (!day) {
              return (
                <div
                  key={`empty-${idx}`}
                  className="min-h-[72px] border-b border-r border-border bg-neutral-bg/50"
                />
              );
            }

            const inMonth = isSameMonth(day, currentMonth);
            const today = isToday(day);
            const dayLeaves = getLeavesForDay(day, leaves);

            return (
              <div
                key={day.toISOString()}
                className={`min-h-[72px] border-b border-r border-border p-1.5 transition-colors ${
                  !inMonth ? 'bg-neutral-bg/50' : 'bg-card-bg'
                } ${today ? 'ring-2 ring-inset ring-blue-500' : ''}`}
              >
                <span
                  className={`text-xs font-medium ${
                    !inMonth
                      ? 'text-text-secondary/40'
                      : today
                        ? 'text-blue-600 font-bold'
                        : 'text-text-primary'
                  }`}
                >
                  {format(day, 'd')}
                </span>

                {/* Leave dots */}
                {dayLeaves.length > 0 && (
                  <div className="mt-1 flex flex-wrap gap-1">
                    {dayLeaves.map((lr) => (
                      <span
                        key={lr.id}
                        className="inline-block h-2.5 w-2.5 rounded-full"
                        style={{ backgroundColor: lr.leave_type.color }}
                        title={`${lr.leave_type.label} (${lr.status.replace('_', ' ')})`}
                      />
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </Card>

      {/* Legend */}
      {legendTypes.length > 0 && (
        <Card>
          <div className="px-4 py-3">
            <h3 className="text-sm font-medium text-text-primary mb-2">Leave Types</h3>
            <div className="flex flex-wrap gap-4">
              {legendTypes.map((lt) => (
                <div key={lt.label} className="flex items-center gap-2">
                  <span
                    className="inline-block h-3 w-3 rounded-full"
                    style={{ backgroundColor: lt.color }}
                  />
                  <span className="text-sm text-text-secondary">{lt.label}</span>
                </div>
              ))}
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}
