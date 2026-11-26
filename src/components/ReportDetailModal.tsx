import { X, MapPin, Navigation, User, Phone, FileText, CheckCircle2 } from 'lucide-react';
import type { PublicTrackedReport, ReportItem } from '../types';
import { CityMap } from './CityMap';
import { SafeImage } from './SafeImage';
import { PriorityText, StatusIndicator, formatDateTime } from './StatusText';

interface ReportDetailModalProps {
  report: ReportItem | PublicTrackedReport | null;
  onClose: () => void;
}

const STEPS = ['Pending', 'Assigned', 'In Progress', 'Resolved'] as const;

function getStepIndex(status: string): number {
  if (status === 'Pending') return 0;
  if (status === 'Assigned') return 1;
  if (status === 'In Progress') return 2;
  if (status === 'Resolved') return 3;
  return -1;
}

export function ReportDetailModal({ report, onClose }: ReportDetailModalProps) {
  if (!report) return null;

  const isFullReport = 'citizen' in report;
  const activeStep = getStepIndex(report.status);
  const workerName = isFullReport
    ? report.assignedWorker?.name
    : report.assignedWorkerName;
  const osmDirectionsUrl = `https://www.openstreetmap.org/directions?to=${report.location.latitude},${report.location.longitude}`;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs"
      role="dialog"
      aria-modal="true"
      aria-labelledby="report-detail-title"
    >
      <div className="flex max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xl">
        <div className="flex items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 px-6 py-4">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500 dark:text-slate-400">
              <span className="font-mono font-semibold text-slate-900 dark:text-slate-100">
                {report.reportId}
              </span>
              <span aria-hidden="true">·</span>
              <StatusIndicator status={report.status} />
              <span aria-hidden="true">·</span>
              <PriorityText priority={report.priority} />
            </div>
            <h2
              id="report-detail-title"
              className="mt-1 truncate text-lg font-bold text-slate-900 dark:text-slate-100"
            >
              {report.category}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100 transition-colors"
            aria-label="Close details"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Workflow progress bar */}
          {report.status !== 'Rejected' ? (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 border-b border-slate-200 dark:border-slate-800 pb-5">
              {STEPS.map((step, index) => {
                const done = activeStep >= index;
                return (
                  <div key={step} className="space-y-1.5">
                    <div
                      className={`h-1.5 w-full rounded-full ${
                        done
                          ? 'bg-emerald-600 dark:bg-emerald-500'
                          : 'bg-slate-200 dark:bg-slate-800'
                      }`}
                    />
                    <div className="flex items-center justify-between text-xs">
                      <span
                        className={
                          done
                            ? 'font-semibold text-slate-900 dark:text-slate-100'
                            : 'text-slate-400 dark:text-slate-500'
                        }
                      >
                        0{index + 1}. {step}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="rounded-lg border border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-950/30 p-4 text-sm text-red-800 dark:text-red-300">
              This complaint was closed as <strong>Rejected</strong>. See municipal administrator notes below for details.
            </div>
          )}

          {/* Description & Location */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div>
                <h3 className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                  Problem Description
                </h3>
                <p className="mt-1.5 text-sm leading-relaxed text-slate-700 dark:text-slate-300">
                  {report.description}
                </p>
              </div>

              <div className="space-y-2 border-t border-slate-200 dark:border-slate-800 pt-4 text-sm">
                <div className="flex items-start gap-2.5 text-slate-700 dark:text-slate-300">
                  <MapPin className="h-4 w-4 shrink-0 text-emerald-700 dark:text-emerald-400 mt-0.5" />
                  <div>
                    <p className="font-medium text-slate-900 dark:text-slate-100">
                      {report.location.address}
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 font-mono tabular-nums mt-0.5">
                      {report.location.ward} · {report.location.latitude.toFixed(5)},{' '}
                      {report.location.longitude.toFixed(5)}
                    </p>
                  </div>
                </div>

                {workerName && (
                  <div className="flex items-center gap-2.5 text-slate-700 dark:text-slate-300">
                    <User className="h-4 w-4 shrink-0 text-slate-400" />
                    <span>
                      Assigned Crew: <strong className="text-slate-900 dark:text-slate-100">{workerName}</strong>
                      {report.workerStatus ? ` (${report.workerStatus})` : ''}
                    </span>
                  </div>
                )}

                {isFullReport && (
                  <div className="flex items-center gap-2.5 text-slate-700 dark:text-slate-300">
                    <Phone className="h-4 w-4 shrink-0 text-slate-400" />
                    <span>
                      Reported by <strong className="text-slate-900 dark:text-slate-100">{report.citizen.name}</strong> ({report.citizen.phone})
                    </span>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-3 pt-2 text-xs text-slate-500 dark:text-slate-400 tabular-nums">
                  <div>
                    <span className="block font-medium text-slate-700 dark:text-slate-300">Submitted</span>
                    {formatDateTime(report.createdAt)}
                  </div>
                  <div>
                    <span className="block font-medium text-slate-700 dark:text-slate-300">Last Updated</span>
                    {formatDateTime(report.updatedAt)}
                  </div>
                </div>
              </div>

              {report.adminNotes && (
                <div className="border-t border-slate-200 dark:border-slate-800 pt-4">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 dark:text-slate-400">
                    <FileText className="h-3.5 w-3.5" />
                    <span>Municipal Admin Notes</span>
                  </div>
                  <p className="mt-1 text-sm text-slate-700 dark:text-slate-300">{report.adminNotes}</p>
                </div>
              )}

              {report.completionNotes && (
                <div className="border-t border-slate-200 dark:border-slate-800 pt-4">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-700 dark:text-emerald-400">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    <span>Field Completion Notes</span>
                  </div>
                  <p className="mt-1 text-sm text-slate-700 dark:text-slate-300">{report.completionNotes}</p>
                </div>
              )}
            </div>

            <div className="space-y-3">
              <CityMap
                mode="route"
                heightClass="h-60"
                routeDestination={{
                  lat: report.location.latitude,
                  lng: report.location.longitude,
                  label: `${report.reportId} — ${report.location.address}`,
                }}
              />
              <a
                href={osmDirectionsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 text-xs font-semibold text-emerald-700 hover:text-emerald-800 dark:text-emerald-400 dark:hover:text-emerald-300"
              >
                <Navigation className="h-3.5 w-3.5" />
                <span>Open GPS Directions in OpenStreetMap</span>
              </a>
            </div>
          </div>

          {/* Evidence Photos (Before & After Proof) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 border-t border-slate-200 dark:border-slate-800 pt-5">
            <div>
              <p className="mb-2 text-xs font-semibold text-slate-600 dark:text-slate-400">
                Citizen Reported Photo
              </p>
              <SafeImage
                src={report.image}
                alt={`Reported garbage issue for ${report.reportId}`}
                className="h-52 w-full rounded-lg border border-slate-200 dark:border-slate-800 object-cover"
                fallbackLabel="No complaint photo uploaded"
              />
            </div>
            <div>
              <p className="mb-2 text-xs font-semibold text-slate-600 dark:text-slate-400">
                After-Cleanup Verification Photo
              </p>
              <SafeImage
                src={report.completionImage}
                alt={`Cleanup verification proof for ${report.reportId}`}
                className="h-52 w-full rounded-lg border border-slate-200 dark:border-slate-800 object-cover"
                fallbackLabel="Awaiting cleanup verification photo"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
