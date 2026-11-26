import React, { useCallback, useEffect, useState } from 'react';
import {
  Camera,
  CheckCircle2,
  ClipboardCheck,
  Compass,
  Map as MapIcon,
  MapPin,
  Navigation,
  Truck,
  X,
} from 'lucide-react';
import { DashboardLayout, type NavItem } from '../layouts/DashboardLayout';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { api } from '../services/api';
import type { ReportItem, WorkerAvailability, WorkerTaskStatus } from '../types';
import { CityMap, haversineDistanceKm } from '../components/CityMap';
import { SafeImage } from '../components/SafeImage';
import { PriorityText, StatusIndicator, formatDateTime } from '../components/StatusText';
import { ReportDetailModal } from '../components/ReportDetailModal';

export function WorkerDashboard() {
  const { user } = useAuth();
  const { notify } = useToast();

  const [activeTab, setActiveTab] = useState('today');
  const [tasks, setTasks] = useState<ReportItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [availability, setAvailability] = useState<WorkerAvailability>(
    user?.availability || 'available'
  );
  const [workerGps, setWorkerGps] = useState<{ lat: number; lng: number } | null>(null);
  const [routeTask, setRouteTask] = useState<ReportItem | null>(null);
  const [detailTask, setDetailTask] = useState<ReportItem | null>(null);

  // Completion modal state
  const [completingTask, setCompletingTask] = useState<ReportItem | null>(null);
  const [completionNotes, setCompletionNotes] = useState('');
  const [proofFile, setProofFile] = useState<File | null>(null);
  const [proofPreview, setProofPreview] = useState<string | null>(null);
  const [updatingId, setUpdatingId] = useState<number | null>(null);

  const loadTasks = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.getReports();
      setTasks(res.reports);
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Failed to load assigned tasks.', 'error');
    } finally {
      setLoading(false);
    }
  }, [notify]);

  useEffect(() => {
    loadTasks();
  }, [loadTasks]);

  useEffect(() => {
    return () => {
      if (proofPreview) URL.revokeObjectURL(proofPreview);
    };
  }, [proofPreview]);

  const detectWorkerLocation = () => {
    if (!navigator.geolocation) {
      notify('Browser geolocation unavailable.', 'error');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setWorkerGps({
          lat: Number(pos.coords.latitude.toFixed(6)),
          lng: Number(pos.coords.longitude.toFixed(6)),
        });
        notify('Live field GPS location updated.', 'success');
      },
      () => {
        notify('Enable location permission to calculate live distance to tasks.', 'info');
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const handleAvailabilityChange = async (next: WorkerAvailability) => {
    try {
      await api.updateMyAvailability(next);
      setAvailability(next);
      notify(`Duty status updated to ${next.replace('_', ' ')}.`, 'success');
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Could not update status.', 'error');
    }
  };

  const handleQuickStageUpdate = async (task: ReportItem, nextStatus: WorkerTaskStatus) => {
    setUpdatingId(task.id);
    try {
      const formData = new FormData();
      formData.append('workerStatus', nextStatus);
      const res = await api.workerUpdateTask(task.id, formData);
      setTasks((prev) => prev.map((t) => (t.id === task.id ? res.report : t)));
      notify(`Task ${task.reportId} updated to "${nextStatus}".`, 'success');
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Update failed.', 'error');
    } finally {
      setUpdatingId(null);
    }
  };

  const handleProofFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null;
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      notify('Proof image must be under 5MB.', 'error');
      return;
    }
    if (proofPreview) URL.revokeObjectURL(proofPreview);
    setProofFile(file);
    setProofPreview(URL.createObjectURL(file));
  };

  const handleCompleteSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!completingTask) return;
    setUpdatingId(completingTask.id);
    try {
      const formData = new FormData();
      formData.append('workerStatus', 'Completed');
      formData.append('completionNotes', completionNotes);
      if (proofFile) {
        formData.append('completionImage', proofFile);
      }

      const res = await api.workerUpdateTask(completingTask.id, formData);
      setTasks((prev) => prev.map((t) => (t.id === completingTask.id ? res.report : t)));
      notify(`Completion proof uploaded for ${completingTask.reportId}. Sent for Admin verification.`, 'success');
      setCompletingTask(null);
      setCompletionNotes('');
      setProofFile(null);
      if (proofPreview) {
        URL.revokeObjectURL(proofPreview);
        setProofPreview(null);
      }
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Failed to submit completion proof.', 'error');
    } finally {
      setUpdatingId(null);
    }
  };

  const activeTasks = tasks.filter(
    (t) => t.status !== 'Resolved' && t.status !== 'Rejected' && t.workerStatus !== 'Completed'
  );
  const completedTasks = tasks.filter(
    (t) => t.status === 'Resolved' || t.workerStatus === 'Completed'
  );

  const navItems: NavItem[] = [
    { id: 'today', label: "Today's Tasks", icon: Truck, count: activeTasks.length },
    { id: 'completed', label: 'Completed History', icon: ClipboardCheck, count: completedTasks.length },
    { id: 'map', label: 'Route Map', icon: MapIcon },
  ];

  return (
    <DashboardLayout
      portalName="Field Worker App"
      activeTab={activeTab}
      onSelectTab={setActiveTab}
      navItems={navItems}
      headerAction={
        <div className="flex items-center gap-2">
          <select
            aria-label="Duty availability"
            value={availability}
            onChange={(e) => handleAvailabilityChange(e.target.value as WorkerAvailability)}
            className="rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-2.5 py-1.5 text-xs font-semibold text-slate-800 dark:text-slate-100"
          >
            <option value="available">Available</option>
            <option value="busy">On Assignment</option>
            <option value="off_duty">Off Duty</option>
          </select>
          <button
            type="button"
            onClick={detectWorkerLocation}
            className="hidden sm:inline-flex items-center gap-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-1.5 text-xs font-semibold text-slate-800 dark:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-800 whitespace-nowrap"
          >
            <Compass className="h-3.5 w-3.5 text-emerald-700 dark:text-emerald-400" />
            <span>{workerGps ? 'GPS Active' : 'Locate Me'}</span>
          </button>
        </div>
      }
    >
      {/* TODAY'S TASKS */}
      {activeTab === 'today' && (
        <div className="space-y-6">
          <div className="grid grid-cols-3 gap-4">
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
              <p className="text-xs text-slate-500 dark:text-slate-400">Active Assigned</p>
              <p className="mt-1 text-2xl font-bold font-mono tabular-nums text-slate-900 dark:text-white">
                {activeTasks.length}
              </p>
            </div>
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
              <p className="text-xs text-slate-500 dark:text-slate-400">Completed</p>
              <p className="mt-1 text-2xl font-bold font-mono tabular-nums text-emerald-700 dark:text-emerald-400">
                {completedTasks.length}
              </p>
            </div>
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
              <p className="text-xs text-slate-500 dark:text-slate-400">Assigned Zone</p>
              <p className="mt-1 truncate text-sm font-bold text-slate-900 dark:text-white">
                {user?.zone || 'Central Ward'}
              </p>
            </div>
          </div>

          {loading ? (
            <div className="space-y-4">
              {[1, 2].map((n) => (
                <div key={n} className="h-44 rounded-xl bg-slate-200/70 dark:bg-slate-900 animate-pulse" />
              ))}
            </div>
          ) : activeTasks.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 p-12 text-center">
              <CheckCircle2 className="mx-auto h-8 w-8 text-emerald-600 dark:text-emerald-400" />
              <p className="mt-3 text-base font-bold text-slate-900 dark:text-white">
                No pending tasks assigned right now
              </p>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto">
                When the Municipal Administrator assigns a garbage complaint to your account, it will appear here immediately with GPS directions.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {activeTasks.map((task) => {
                const distKm = workerGps
                  ? haversineDistanceKm(
                      workerGps.lat,
                      workerGps.lng,
                      task.location.latitude,
                      task.location.longitude
                    )
                  : null;
                const directionsHref = workerGps
                  ? `https://www.openstreetmap.org/directions?engine=fossgis_osrm_car&route=${workerGps.lat}%2C${workerGps.lng}%3B${task.location.latitude}%2C${task.location.longitude}`
                  : `https://www.openstreetmap.org/directions?to=${task.location.latitude},${task.location.longitude}`;

                return (
                  <div
                    key={task.id}
                    className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-4"
                  >
                    <div className="flex flex-col md:flex-row gap-5">
                      <SafeImage
                        src={task.image}
                        alt={`Garbage issue at ${task.location.address}`}
                        className="h-44 md:h-36 md:w-52 w-full rounded-lg border border-slate-200 dark:border-slate-800 object-cover shrink-0"
                        fallbackLabel="No site photo"
                      />

                      <div className="flex-1 min-w-0 space-y-2.5">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                            <span className="font-mono font-bold text-slate-900 dark:text-white">
                              {task.reportId}
                            </span>
                            <span aria-hidden="true">·</span>
                            <StatusIndicator status={task.workerStatus || task.status} />
                            <span aria-hidden="true">·</span>
                            <PriorityText priority={task.priority} />
                          </div>
                          {distKm !== null && (
                            <span className="text-xs font-mono font-semibold text-emerald-700 dark:text-emerald-400 tabular-nums">
                              {distKm.toFixed(1)} km away
                            </span>
                          )}
                        </div>

                        <h2 className="text-base font-bold text-slate-900 dark:text-white">
                          {task.category}
                        </h2>

                        <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                          {task.description}
                        </p>

                        <div className="flex items-start gap-2 text-xs text-slate-600 dark:text-slate-400">
                          <MapPin className="h-4 w-4 shrink-0 text-emerald-700 dark:text-emerald-400 mt-0.5" />
                          <span>
                            <strong className="text-slate-800 dark:text-slate-200">
                              {task.location.address}
                            </strong>{' '}
                            ({task.location.ward}) ·{' '}
                            <span className="font-mono tabular-nums">
                              {task.location.latitude.toFixed(4)}, {task.location.longitude.toFixed(4)}
                            </span>
                          </span>
                        </div>

                        {task.adminNotes && (
                          <p className="text-xs text-slate-500 dark:text-slate-400">
                            <strong className="text-slate-700 dark:text-slate-300">Supervisor Note:</strong>{' '}
                            {task.adminNotes}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Action Bar */}
                    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 dark:border-slate-800 pt-4">
                      <div className="flex flex-wrap items-center gap-2">
                        {(['Accepted', 'On the Way', 'In Progress'] as const).map((stage) => {
                          const isCurrent = task.workerStatus === stage;
                          return (
                            <button
                              key={stage}
                              type="button"
                              disabled={updatingId === task.id || isCurrent}
                              onClick={() => handleQuickStageUpdate(task, stage)}
                              className={`rounded-lg px-3 py-2 text-xs font-semibold transition-colors whitespace-nowrap ${
                                isCurrent
                                  ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900'
                                  : 'border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800'
                              }`}
                            >
                              {stage}
                            </button>
                          );
                        })}

                        <button
                          type="button"
                          onClick={() => {
                            setCompletingTask(task);
                            setCompletionNotes(task.completionNotes || '');
                          }}
                          className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-700 px-3.5 py-2 text-xs font-semibold text-white hover:bg-emerald-800 dark:bg-emerald-600 dark:hover:bg-emerald-500 transition-colors whitespace-nowrap"
                        >
                          <Camera className="h-3.5 w-3.5" />
                          <span>Complete &amp; Upload Proof</span>
                        </button>
                      </div>

                      <div className="flex items-center gap-3">
                        <button
                          type="button"
                          onClick={() => setRouteTask(routeTask?.id === task.id ? null : task)}
                          className="text-xs font-semibold text-slate-700 dark:text-slate-300 hover:text-emerald-700 dark:hover:text-emerald-400 whitespace-nowrap"
                        >
                          {routeTask?.id === task.id ? 'Hide Map' : 'Show Site Map'}
                        </button>
                        <a
                          href={directionsHref}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 hover:underline dark:text-emerald-400 whitespace-nowrap"
                        >
                          <Navigation className="h-3.5 w-3.5" />
                          <span>Directions</span>
                        </a>
                      </div>
                    </div>

                    {routeTask?.id === task.id && (
                      <div className="pt-2">
                        <CityMap
                          mode="route"
                          heightClass="h-64"
                          routeOrigin={workerGps}
                          routeDestination={{
                            lat: task.location.latitude,
                            lng: task.location.longitude,
                            label: `${task.reportId} — ${task.location.address}`,
                          }}
                        />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* COMPLETED HISTORY */}
      {activeTab === 'completed' && (
        <div className="space-y-4">
          {completedTasks.length === 0 ? (
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-10 text-center text-sm text-slate-500 dark:text-slate-400">
              No completed tasks recorded yet.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {completedTasks.map((task) => (
                <div
                  key={task.id}
                  className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-3"
                >
                  <div className="flex items-center justify-between gap-2 text-xs">
                    <span className="font-mono font-bold text-slate-900 dark:text-white">
                      {task.reportId}
                    </span>
                    <StatusIndicator status={task.status === 'Resolved' ? 'Resolved' : 'Completed'} />
                  </div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                    {task.category} — {task.location.address}
                  </h3>
                  <div className="grid grid-cols-2 gap-2">
                    <SafeImage
                      src={task.image}
                      alt="Before cleanup"
                      className="h-28 w-full rounded-lg border border-slate-200 dark:border-slate-800 object-cover"
                      fallbackLabel="Before"
                    />
                    <SafeImage
                      src={task.completionImage}
                      alt="After cleanup proof"
                      className="h-28 w-full rounded-lg border border-slate-200 dark:border-slate-800 object-cover"
                      fallbackLabel="After Proof"
                    />
                  </div>
                  {task.completionNotes && (
                    <p className="text-xs text-slate-600 dark:text-slate-400">
                      {task.completionNotes}
                    </p>
                  )}
                  <div className="flex items-center justify-between pt-1 text-[11px] text-slate-500 dark:text-slate-400 tabular-nums">
                    <span>Updated {formatDateTime(task.updatedAt)}</span>
                    <button
                      type="button"
                      onClick={() => setDetailTask(task)}
                      className="font-semibold text-emerald-700 hover:underline dark:text-emerald-400"
                    >
                      View Full Details
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ROUTE MAP TAB */}
      {activeTab === 'map' && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white">
                Assigned Field Locations
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Click any marker to inspect site address, description, and GPS coordinates.
              </p>
            </div>
            <button
              type="button"
              onClick={detectWorkerLocation}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3.5 py-2 text-xs font-semibold text-slate-800 dark:text-slate-100"
            >
              <Compass className="h-4 w-4 text-emerald-700 dark:text-emerald-400" />
              <span>Update My GPS</span>
            </button>
          </div>
          <CityMap
            mode="markers"
            heightClass="h-[480px]"
            markers={tasks.map((t) => ({
              id: t.id,
              reportId: t.reportId,
              category: t.category,
              status: t.status,
              address: t.location.address,
              latitude: t.location.latitude,
              longitude: t.location.longitude,
            }))}
            onMarkerSelect={(m) => {
              const found = tasks.find((item) => item.id === m.id);
              if (found) setDetailTask(found);
            }}
          />
        </div>
      )}

      {/* COMPLETE TASK & UPLOAD PROOF MODAL */}
      {completingTask && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-lg rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 px-6 py-4">
              <div>
                <p className="text-xs font-mono font-semibold text-emerald-700 dark:text-emerald-400">
                  {completingTask.reportId}
                </p>
                <h2 className="text-base font-bold text-slate-900 dark:text-white">
                  Upload Cleanup Proof &amp; Mark Completed
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setCompletingTask(null)}
                className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
                aria-label="Close modal"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleCompleteSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  After-Cleanup Proof Photo
                </label>
                <label className="flex cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 p-5 text-center hover:border-emerald-600 transition-colors">
                  <Camera className="h-6 w-6 text-slate-400" />
                  <span className="mt-2 text-xs font-semibold text-slate-700 dark:text-slate-300">
                    {proofFile ? proofFile.name : 'Select or capture cleaned area photo'}
                  </span>
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    onChange={handleProofFileChange}
                    className="sr-only"
                  />
                </label>
                {proofPreview && (
                  <img
                    src={proofPreview}
                    alt="Cleanup proof preview"
                    className="mt-3 h-40 w-full rounded-lg border border-slate-200 dark:border-slate-800 object-cover"
                  />
                )}
              </div>

              <div>
                <label htmlFor="worker-notes" className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  Completion Notes
                </label>
                <textarea
                  id="worker-notes"
                  rows={3}
                  required
                  value={completionNotes}
                  onChange={(e) => setCompletionNotes(e.target.value)}
                  placeholder="Describe work performed (e.g., emptied dustbin, cleared curb waste, swept sidewalk)..."
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3.5 py-2.5 text-sm text-slate-900 dark:text-slate-100 focus:border-emerald-600 focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setCompletingTask(null)}
                  className="rounded-lg border border-slate-300 dark:border-slate-700 px-4 py-2 text-xs font-semibold text-slate-700 dark:text-slate-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={updatingId === completingTask.id}
                  className="rounded-lg bg-emerald-700 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-800 disabled:opacity-60"
                >
                  {updatingId === completingTask.id ? 'Uploading...' : 'Submit Completion'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <ReportDetailModal report={detailTask} onClose={() => setDetailTask(null)} />
    </DashboardLayout>
  );
}
