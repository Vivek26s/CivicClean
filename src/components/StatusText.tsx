import {
  CheckCircle2,
  Clock,
  Truck,
  UserCheck,
  XCircle,
  AlertTriangle,
} from 'lucide-react';
import type { ReportPriority, ReportStatus, WorkerAvailability, WorkerTaskStatus } from '../types';

export function StatusIndicator({ status }: { status: ReportStatus | WorkerTaskStatus | string }) {
  switch (status) {
    case 'Pending':
      return (
        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-700 dark:text-amber-400 whitespace-nowrap">
          <Clock className="h-3.5 w-3.5 shrink-0" />
          <span>Pending</span>
        </span>
      );
    case 'Assigned':
    case 'Accepted':
      return (
        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-sky-700 dark:text-sky-400 whitespace-nowrap">
          <UserCheck className="h-3.5 w-3.5 shrink-0" />
          <span>{status}</span>
        </span>
      );
    case 'In Progress':
    case 'On the Way':
      return (
        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-indigo-700 dark:text-indigo-400 whitespace-nowrap">
          <Truck className="h-3.5 w-3.5 shrink-0" />
          <span>{status}</span>
        </span>
      );
    case 'Resolved':
    case 'Completed':
      return (
        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700 dark:text-emerald-400 whitespace-nowrap">
          <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
          <span>{status}</span>
        </span>
      );
    case 'Rejected':
      return (
        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-red-700 dark:text-red-400 whitespace-nowrap">
          <XCircle className="h-3.5 w-3.5 shrink-0" />
          <span>Rejected</span>
        </span>
      );
    default:
      return (
        <span className="text-xs font-medium text-slate-600 dark:text-slate-400 whitespace-nowrap">
          {status}
        </span>
      );
  }
}

export function PriorityText({ priority }: { priority: ReportPriority }) {
  const styles: Record<ReportPriority, string> = {
    Low: 'text-slate-600 dark:text-slate-400',
    Medium: 'text-sky-700 dark:text-sky-400',
    High: 'text-amber-700 dark:text-amber-400',
    Critical: 'text-red-700 dark:text-red-400 font-semibold',
  };
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-medium whitespace-nowrap ${styles[priority]}`}>
      {priority === 'Critical' && <AlertTriangle className="h-3.5 w-3.5 shrink-0" />}
      <span>{priority}</span>
    </span>
  );
}

export function AvailabilityText({ availability }: { availability: WorkerAvailability }) {
  if (availability === 'available') {
    return <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-400">Available</span>;
  }
  if (availability === 'busy') {
    return <span className="text-xs font-semibold text-amber-700 dark:text-amber-400">On Assignment</span>;
  }
  return <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Off Duty</span>;
}

export function formatDateTime(value: string | null | undefined): string {
  if (!value) return '—';
  const normalized = value.includes('T') ? value : `${value.replace(' ', 'T')}Z`;
  const d = new Date(normalized);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}
