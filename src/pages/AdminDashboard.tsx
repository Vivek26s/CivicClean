import React, { useCallback, useEffect, useState } from 'react';
import {
  BarChart3,
  CheckCircle2,
  ClipboardList,
  Edit3,
  LayoutDashboard,
  Map as MapIcon,
  Plus,
  Search,
  Trash2,
  Truck,
  UserCheck,
  Users,
  X,
} from 'lucide-react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { DashboardLayout, type NavItem } from '../layouts/DashboardLayout';
import { useToast } from '../context/ToastContext';
import { api } from '../services/api';
import {
  CITY_WARDS,
  GARBAGE_CATEGORIES,
  REPORT_PRIORITIES,
  REPORT_STATUSES,
  type CitizenRecord,
  type DashboardStats,
  type ReportItem,
  type ReportPriority,
  type ReportStatus,
  type WorkerAvailability,
  type WorkerRecord,
} from '../types';
import { CityMap } from '../components/CityMap';
import { ReportDetailModal } from '../components/ReportDetailModal';
import { SafeImage } from '../components/SafeImage';
import {
  AvailabilityText,
  PriorityText,
  StatusIndicator,
  formatDateTime,
} from '../components/StatusText';

const PIE_COLORS = ['#d97706', '#0284c7', '#4f46e5', '#059669', '#dc2626'];

export function AdminDashboard() {
  const { notify } = useToast();

  const [activeTab, setActiveTab] = useState('overview');
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [reports, setReports] = useState<ReportItem[]>([]);
  const [workers, setWorkers] = useState<WorkerRecord[]>([]);
  const [citizens, setCitizens] = useState<CitizenRecord[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [statusFilter, setStatusFilter] = useState('All');
  const [categoryFilter, setCategoryFilter] = useState('All');
  const [priorityFilter, setPriorityFilter] = useState('All');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [mapStatusFilter, setMapStatusFilter] = useState('All');

  // Inspect / Manage Report Modal
  const [inspectReport, setInspectReport] = useState<ReportItem | null>(null);
  const [manageReport, setManageReport] = useState<ReportItem | null>(null);
  const [assignWorkerId, setAssignWorkerId] = useState<string>('');
  const [manageStatus, setManageStatus] = useState<ReportStatus>('Pending');
  const [managePriority, setManagePriority] = useState<ReportPriority>('Medium');
  const [manageNotes, setManageNotes] = useState('');
  const [savingReport, setSavingReport] = useState(false);
  const [confirmDeleteReportId, setConfirmDeleteReportId] = useState<number | null>(null);

  // Worker Modal (Add / Edit)
  const [workerModalOpen, setWorkerModalOpen] = useState(false);
  const [editingWorker, setEditingWorker] = useState<WorkerRecord | null>(null);
  const [workerForm, setWorkerForm] = useState({
    name: '',
    email: '',
    phone: '',
    zone: CITY_WARDS[0],
    availability: 'available' as WorkerAvailability,
    password: '',
  });
  const [savingWorker, setSavingWorker] = useState(false);
  const [confirmDeleteWorkerId, setConfirmDeleteWorkerId] = useState<number | null>(null);
  const [viewingWorkerTasks, setViewingWorkerTasks] = useState<WorkerRecord | null>(null);

  const loadAllData = useCallback(async () => {
    setLoading(true);
    try {
      const [statsRes, reportsRes, workersRes, citizensRes] = await Promise.all([
        api.getDashboardStats(),
        api.getReports(),
        api.getWorkers(),
        api.getCitizens(),
      ]);
      setStats(statsRes);
      setReports(reportsRes.reports);
      setWorkers(workersRes.workers);
      setCitizens(citizensRes.citizens);
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Failed to load admin console data.', 'error');
    } finally {
      setLoading(false);
    }
  }, [notify]);

  useEffect(() => {
    loadAllData();
  }, [loadAllData]);

  const openManageModal = (report: ReportItem) => {
    setManageReport(report);
    setAssignWorkerId(report.assignedWorker ? String(report.assignedWorker.id) : '');
    setManageStatus(report.status);
    setManagePriority(report.priority);
    setManageNotes(report.adminNotes || '');
    setConfirmDeleteReportId(null);
  };

  const handleSaveReportChanges = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!manageReport) return;
    setSavingReport(true);
    try {
      const selectedWorkerNum = assignWorkerId ? Number(assignWorkerId) : null;
      const workerChanged =
        selectedWorkerNum && selectedWorkerNum !== manageReport.assignedWorker?.id;

      if (workerChanged) {
        await api.assignWorker(manageReport.id, {
          workerId: selectedWorkerNum,
          priority: managePriority,
          adminNotes: manageNotes,
        });
        if (manageStatus !== 'Assigned' && manageStatus !== manageReport.status) {
          await api.updateReportStatus(manageReport.id, {
            status: manageStatus,
            adminNotes: manageNotes,
          });
        }
      } else {
        await api.updateReport(manageReport.id, {
          status: manageStatus,
          priority: managePriority,
          adminNotes: manageNotes,
        });
      }

      notify(`Complaint ${manageReport.reportId} updated.`, 'success');
      setManageReport(null);
      loadAllData();
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Failed to update complaint.', 'error');
    } finally {
      setSavingReport(false);
    }
  };

  const handleVerifyResolve = async (report: ReportItem) => {
    setSavingReport(true);
    try {
      await api.updateReportStatus(report.id, {
        status: 'Resolved',
        adminNotes:
          manageNotes.trim() ||
          report.adminNotes ||
          'Cleanup verified via completion proof photo and marked Resolved.',
      });
      notify(`Complaint ${report.reportId} verified and marked Resolved.`, 'success');
      setManageReport(null);
      loadAllData();
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Could not verify resolution.', 'error');
    } finally {
      setSavingReport(false);
    }
  };

  const handleDeleteReport = async (id: number) => {
    try {
      await api.deleteReport(id);
      notify('Complaint deleted.', 'info');
      setManageReport(null);
      setConfirmDeleteReportId(null);
      loadAllData();
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Failed to delete complaint.', 'error');
    }
  };

  const openAddWorkerModal = () => {
    setEditingWorker(null);
    setWorkerForm({
      name: '',
      email: '',
      phone: '',
      zone: CITY_WARDS[0],
      availability: 'available',
      password: '',
    });
    setWorkerModalOpen(true);
  };

  const openEditWorkerModal = (worker: WorkerRecord) => {
    setEditingWorker(worker);
    setWorkerForm({
      name: worker.name,
      email: worker.email,
      phone: worker.phone,
      zone: worker.zone,
      availability: worker.availability,
      password: '',
    });
    setWorkerModalOpen(true);
  };

  const handleSaveWorker = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingWorker(true);
    try {
      if (editingWorker) {
        await api.updateWorker(editingWorker.id, {
          name: workerForm.name,
          phone: workerForm.phone,
          zone: workerForm.zone,
          availability: workerForm.availability,
          ...(workerForm.password.trim() ? { password: workerForm.password.trim() } : {}),
        });
        notify(`Updated worker ${workerForm.name}.`, 'success');
      } else {
        await api.createWorker({
          name: workerForm.name,
          email: workerForm.email,
          phone: workerForm.phone,
          zone: workerForm.zone,
          availability: workerForm.availability,
          password: workerForm.password,
        });
        notify(`Worker ${workerForm.name} created and ready to sign in.`, 'success');
      }
      setWorkerModalOpen(false);
      loadAllData();
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Failed to save worker.', 'error');
    } finally {
      setSavingWorker(false);
    }
  };

  const handleDeleteWorker = async (id: number) => {
    try {
      await api.deleteWorker(id);
      notify('Worker removed.', 'info');
      setConfirmDeleteWorkerId(null);
      loadAllData();
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Could not remove worker.', 'error');
    }
  };

  const filteredReports = reports.filter((r) => {
    if (statusFilter !== 'All' && r.status !== statusFilter) return false;
    if (categoryFilter !== 'All' && r.category !== categoryFilter) return false;
    if (priorityFilter !== 'All' && r.priority !== priorityFilter) return false;
    if (dateFrom) {
      const createdDay = r.createdAt.slice(0, 10);
      if (createdDay < dateFrom) return false;
    }
    if (dateTo) {
      const createdDay = r.createdAt.slice(0, 10);
      if (createdDay > dateTo) return false;
    }
    const q = searchTerm.trim().toLowerCase();
    if (q) {
      const hit =
        r.reportId.toLowerCase().includes(q) ||
        r.category.toLowerCase().includes(q) ||
        r.location.address.toLowerCase().includes(q) ||
        r.location.ward.toLowerCase().includes(q) ||
        r.citizen.name.toLowerCase().includes(q) ||
        (r.assignedWorker?.name || '').toLowerCase().includes(q);
      if (!hit) return false;
    }
    return true;
  });

  const mapFilteredReports = reports.filter(
    (r) => mapStatusFilter === 'All' || r.status === mapStatusFilter
  );

  const statusPieData = stats
    ? [
        { name: 'Pending', value: stats.summary.pendingReports },
        { name: 'Assigned', value: stats.summary.assignedReports },
        { name: 'In Progress', value: stats.summary.inProgressReports },
        { name: 'Resolved', value: stats.summary.resolvedReports },
        { name: 'Rejected', value: stats.summary.rejectedReports },
      ].filter((d) => d.value > 0)
    : [];

  const navItems: NavItem[] = [
    { id: 'overview', label: 'Overview', icon: LayoutDashboard },
    { id: 'reports', label: 'Complaints', icon: ClipboardList, count: stats?.summary.pendingReports },
    { id: 'map', label: 'City Map', icon: MapIcon },
    { id: 'workers', label: 'Workers', icon: Truck, count: workers.length },
    { id: 'citizens', label: 'Citizens', icon: Users, count: citizens.length },
    { id: 'analytics', label: 'Analytics', icon: BarChart3 },
  ];

  return (
    <DashboardLayout
      portalName="Municipal Admin Console"
      activeTab={activeTab}
      onSelectTab={setActiveTab}
      navItems={navItems}
      headerAction={
        <button
          type="button"
          onClick={openAddWorkerModal}
          className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-700 px-3.5 py-2 text-xs font-semibold text-white hover:bg-emerald-800 dark:bg-emerald-600 dark:hover:bg-emerald-500 transition-colors whitespace-nowrap"
        >
          <Plus className="h-3.5 w-3.5" />
          <span>Add Worker</span>
        </button>
      }
    >
      {/* OVERVIEW TAB */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {/* 8 Executive KPI Metrics */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: 'Total Reports', value: stats?.summary.totalReports ?? 0, tone: 'text-slate-900 dark:text-white' },
              { label: 'Pending Triage', value: stats?.summary.pendingReports ?? 0, tone: 'text-amber-700 dark:text-amber-400' },
              { label: 'Assigned to Crew', value: stats?.summary.assignedReports ?? 0, tone: 'text-sky-700 dark:text-sky-400' },
              { label: 'In Progress', value: stats?.summary.inProgressReports ?? 0, tone: 'text-indigo-700 dark:text-indigo-400' },
              { label: 'Verified Resolved', value: stats?.summary.resolvedReports ?? 0, tone: 'text-emerald-700 dark:text-emerald-400' },
              { label: 'Rejected', value: stats?.summary.rejectedReports ?? 0, tone: 'text-red-700 dark:text-red-400' },
              { label: 'Total Workers', value: stats?.summary.totalWorkers ?? 0, tone: 'text-slate-900 dark:text-white' },
              { label: 'Awaiting Sign-Off', value: stats?.summary.awaitingVerification ?? 0, tone: 'text-emerald-700 dark:text-emerald-400' },
            ].map((kpi) => (
              <div
                key={kpi.label}
                className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4"
              >
                <p className="text-xs font-medium text-slate-500 dark:text-slate-400">{kpi.label}</p>
                <p className={`mt-1.5 text-2xl sm:text-3xl font-bold font-mono tabular-nums ${kpi.tone}`}>
                  {loading ? '—' : kpi.value}
                </p>
              </div>
            ))}
          </div>

          {/* Interactive City Map + Recent Reports */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-7 space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-bold text-slate-900 dark:text-white">
                  Active City Waste Map
                </h2>
                <button
                  type="button"
                  onClick={() => setActiveTab('map')}
                  className="text-xs font-semibold text-emerald-700 hover:underline dark:text-emerald-400"
                >
                  Expand Map
                </button>
              </div>
              <CityMap
                mode="markers"
                heightClass="h-[360px]"
                markers={reports.map((r) => ({
                  id: r.id,
                  reportId: r.reportId,
                  category: r.category,
                  status: r.status,
                  address: r.location.address,
                  latitude: r.location.latitude,
                  longitude: r.location.longitude,
                }))}
                onMarkerSelect={(m) => {
                  const found = reports.find((item) => item.id === m.id);
                  if (found) openManageModal(found);
                }}
              />
            </div>

            <div className="lg:col-span-5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden flex flex-col">
              <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 px-5 py-3.5">
                <h2 className="text-sm font-bold text-slate-900 dark:text-white">
                  Recent Complaints
                </h2>
                <button
                  type="button"
                  onClick={() => setActiveTab('reports')}
                  className="text-xs font-semibold text-emerald-700 hover:underline dark:text-emerald-400"
                >
                  Manage All
                </button>
              </div>
              <div className="divide-y divide-slate-100 dark:divide-slate-800 flex-1 overflow-y-auto max-h-[360px]">
                {reports.slice(0, 6).map((r) => (
                  <div
                    key={r.id}
                    className="flex items-center justify-between gap-3 px-5 py-3 hover:bg-slate-50 dark:hover:bg-slate-800/40"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 text-xs">
                        <span className="font-mono font-semibold text-slate-900 dark:text-white">
                          {r.reportId}
                        </span>
                        <span aria-hidden="true" className="text-slate-400">·</span>
                        <PriorityText priority={r.priority} />
                      </div>
                      <p className="mt-0.5 truncate text-xs font-medium text-slate-700 dark:text-slate-300">
                        {r.category} — {r.location.address}
                      </p>
                      <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">
                        {r.assignedWorker ? `Assigned: ${r.assignedWorker.name}` : 'Unassigned'}
                        {r.workerStatus === 'Completed' && r.status !== 'Resolved'
                          ? ' · Proof Ready for Verification'
                          : ''}
                      </p>
                    </div>
                    <div className="shrink-0 flex flex-col items-end gap-1">
                      <StatusIndicator status={r.status} />
                      <button
                        type="button"
                        onClick={() => openManageModal(r)}
                        className="text-xs font-semibold text-emerald-700 hover:underline dark:text-emerald-400"
                      >
                        Manage
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* COMPLAINTS MANAGEMENT TAB */}
      {activeTab === 'reports' && (
        <div className="space-y-5">
          {/* Filter Bar */}
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3">
            <div className="relative lg:col-span-2">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search ID, address, ward, citizen, worker..."
                className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 pl-9 pr-3 py-2 text-xs text-slate-900 dark:text-slate-100 focus:border-emerald-600 focus:outline-none"
              />
            </div>

            <select
              aria-label="Filter by status"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-xs text-slate-800 dark:text-slate-100"
            >
              <option value="All">All Statuses</option>
              {REPORT_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>

            <select
              aria-label="Filter by category"
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-xs text-slate-800 dark:text-slate-100"
            >
              <option value="All">All Categories</option>
              {GARBAGE_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>

            <select
              aria-label="Filter by priority"
              value={priorityFilter}
              onChange={(e) => setPriorityFilter(e.target.value)}
              className="rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-xs text-slate-800 dark:text-slate-100"
            >
              <option value="All">All Priorities</option>
              {REPORT_PRIORITIES.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>

            <div className="flex items-center gap-1.5">
              <input
                type="date"
                aria-label="From date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-2 py-2 text-xs text-slate-800 dark:text-slate-100"
              />
              <input
                type="date"
                aria-label="To date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-2 py-2 text-xs text-slate-800 dark:text-slate-100"
              />
            </div>
          </div>

          {/* Complaints Table */}
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 text-xs text-slate-500 dark:text-slate-400">
                  <th className="py-3 px-4 font-semibold">Report ID</th>
                  <th className="py-3 px-4 font-semibold">Category &amp; Citizen</th>
                  <th className="py-3 px-4 font-semibold">Location / Ward</th>
                  <th className="py-3 px-4 font-semibold">Worker</th>
                  <th className="py-3 px-4 font-semibold">Priority</th>
                  <th className="py-3 px-4 font-semibold">Status</th>
                  <th className="py-3 px-4 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {filteredReports.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-10 text-center text-sm text-slate-500 dark:text-slate-400">
                      No complaints match your filter criteria.
                    </td>
                  </tr>
                ) : (
                  filteredReports.map((r) => (
                    <tr key={r.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                      <td className="py-3 px-4 font-mono text-xs font-semibold text-slate-900 dark:text-white whitespace-nowrap">
                        {r.reportId}
                        <span className="block font-sans font-normal text-[11px] text-slate-400 tabular-nums">
                          {formatDateTime(r.createdAt)}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-3">
                          <SafeImage
                            src={r.image}
                            alt={r.category}
                            className="h-9 w-12 rounded border border-slate-200 dark:border-slate-800 object-cover shrink-0"
                            fallbackLabel=""
                          />
                          <div className="min-w-0">
                            <p className="text-xs font-semibold text-slate-900 dark:text-white whitespace-nowrap">
                              {r.category}
                            </p>
                            <p className="text-xs text-slate-500 dark:text-slate-400 truncate max-w-[180px]">
                              {r.citizen.name}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-xs text-slate-600 dark:text-slate-300 max-w-[200px]">
                        <p className="truncate font-medium text-slate-800 dark:text-slate-200">
                          {r.location.address}
                        </p>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400">
                          {r.location.ward}
                        </p>
                      </td>
                      <td className="py-3 px-4 text-xs whitespace-nowrap">
                        {r.assignedWorker ? (
                          <div>
                            <p className="font-medium text-slate-800 dark:text-slate-200">
                              {r.assignedWorker.name}
                            </p>
                            {r.workerStatus && (
                              <p className="text-[11px] text-emerald-700 dark:text-emerald-400">
                                Crew: {r.workerStatus}
                              </p>
                            )}
                          </div>
                        ) : (
                          <span className="text-slate-400">Unassigned</span>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        <PriorityText priority={r.priority} />
                      </td>
                      <td className="py-3 px-4">
                        <StatusIndicator status={r.status} />
                      </td>
                      <td className="py-3 px-4 text-right whitespace-nowrap space-x-3">
                        <button
                          type="button"
                          onClick={() => setInspectReport(r)}
                          className="text-xs font-medium text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
                        >
                          Inspect
                        </button>
                        <button
                          type="button"
                          onClick={() => openManageModal(r)}
                          className="text-xs font-semibold text-emerald-700 hover:underline dark:text-emerald-400"
                        >
                          Assign / Update
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* CITY OPERATIONS MAP TAB */}
      {activeTab === 'map' && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-1 rounded-lg bg-slate-200/70 dark:bg-slate-900 p-1">
              {['All', ...REPORT_STATUSES].map((st) => (
                <button
                  key={st}
                  type="button"
                  onClick={() => setMapStatusFilter(st)}
                  className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-colors whitespace-nowrap ${
                    mapStatusFilter === st
                      ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                  }`}
                >
                  {st}
                </button>
              ))}
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 font-mono tabular-nums">
              Showing {mapFilteredReports.length} of {reports.length} locations
            </p>
          </div>

          <CityMap
            mode="markers"
            heightClass="h-[540px]"
            markers={mapFilteredReports.map((r) => ({
              id: r.id,
              reportId: r.reportId,
              category: r.category,
              status: r.status,
              address: r.location.address,
              latitude: r.location.latitude,
              longitude: r.location.longitude,
            }))}
            onMarkerSelect={(m) => {
              const found = reports.find((item) => item.id === m.id);
              if (found) openManageModal(found);
            }}
          />
        </div>
      )}

      {/* WORKERS MANAGEMENT TAB */}
      {activeTab === 'workers' && (
        <div className="space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Manage municipal sanitation workers, set login credentials, track availability, and audit assigned tasks.
            </p>
            <button
              type="button"
              onClick={openAddWorkerModal}
              className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-700 px-3.5 py-2 text-xs font-semibold text-white hover:bg-emerald-800"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>Add Sanitation Worker</span>
            </button>
          </div>

          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 text-xs text-slate-500 dark:text-slate-400">
                  <th className="py-3 px-4 font-semibold">Worker</th>
                  <th className="py-3 px-4 font-semibold">Zone</th>
                  <th className="py-3 px-4 font-semibold">Phone</th>
                  <th className="py-3 px-4 font-semibold">Availability</th>
                  <th className="py-3 px-4 font-semibold text-right">Active</th>
                  <th className="py-3 px-4 font-semibold text-right">Resolved</th>
                  <th className="py-3 px-4 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {workers.map((w) => (
                  <tr key={w.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                    <td className="py-3 px-4">
                      <p className="text-xs font-semibold text-slate-900 dark:text-white">{w.name}</p>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400">
                        {w.email}
                        {!w.hasCredentials ? ' · Password not set' : ''}
                      </p>
                    </td>
                    <td className="py-3 px-4 text-xs text-slate-600 dark:text-slate-300">{w.zone}</td>
                    <td className="py-3 px-4 text-xs font-mono text-slate-600 dark:text-slate-300 whitespace-nowrap">
                      {w.phone}
                    </td>
                    <td className="py-3 px-4">
                      <AvailabilityText availability={w.availability} />
                    </td>
                    <td className="py-3 px-4 text-right font-mono text-xs font-semibold tabular-nums text-slate-900 dark:text-white">
                      {w.activeTasks}
                    </td>
                    <td className="py-3 px-4 text-right font-mono text-xs font-semibold tabular-nums text-emerald-700 dark:text-emerald-400">
                      {w.completedTasks}
                    </td>
                    <td className="py-3 px-4 text-right whitespace-nowrap space-x-3">
                      <button
                        type="button"
                        onClick={() => setViewingWorkerTasks(w)}
                        className="text-xs font-medium text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
                      >
                        Tasks
                      </button>
                      <button
                        type="button"
                        onClick={() => openEditWorkerModal(w)}
                        className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 hover:underline dark:text-emerald-400"
                      >
                        <Edit3 className="h-3 w-3" />
                        <span>Edit</span>
                      </button>
                      {confirmDeleteWorkerId === w.id ? (
                        <button
                          type="button"
                          onClick={() => handleDeleteWorker(w.id)}
                          className="text-xs font-bold text-red-600 hover:underline"
                        >
                          Confirm Remove
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteWorkerId(w.id)}
                          className="text-xs font-medium text-red-600 hover:underline dark:text-red-400"
                        >
                          Remove
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {viewingWorkerTasks && (
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  Assigned Tasks — {viewingWorkerTasks.name}
                </h3>
                <button
                  type="button"
                  onClick={() => setViewingWorkerTasks(null)}
                  className="text-xs text-slate-500 hover:text-slate-900 dark:hover:text-white"
                >
                  Close
                </button>
              </div>
              {reports.filter((r) => r.assignedWorker?.id === viewingWorkerTasks.id).length === 0 ? (
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  No tasks currently assigned to {viewingWorkerTasks.name}.
                </p>
              ) : (
                <div className="divide-y divide-slate-100 dark:divide-slate-800">
                  {reports
                    .filter((r) => r.assignedWorker?.id === viewingWorkerTasks.id)
                    .map((task) => (
                      <div key={task.id} className="flex items-center justify-between py-2.5 text-xs">
                        <div>
                          <span className="font-mono font-semibold text-slate-900 dark:text-white">
                            {task.reportId}
                          </span>{' '}
                          · {task.category} — {task.location.address}
                        </div>
                        <div className="flex items-center gap-3">
                          <StatusIndicator status={task.status} />
                          <button
                            type="button"
                            onClick={() => openManageModal(task)}
                            className="font-semibold text-emerald-700 hover:underline dark:text-emerald-400"
                          >
                            Manage
                          </button>
                        </div>
                      </div>
                    ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* CITIZENS DIRECTORY TAB */}
      {activeTab === 'citizens' && (
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 text-xs text-slate-500 dark:text-slate-400">
                <th className="py-3 px-4 font-semibold">Citizen Name</th>
                <th className="py-3 px-4 font-semibold">Email</th>
                <th className="py-3 px-4 font-semibold">Phone</th>
                <th className="py-3 px-4 font-semibold">Ward / Zone</th>
                <th className="py-3 px-4 font-semibold text-right">Submitted</th>
                <th className="py-3 px-4 font-semibold text-right">Resolved</th>
                <th className="py-3 px-4 font-semibold text-right">Joined</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {citizens.map((c) => (
                <tr key={c.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                  <td className="py-3 px-4 text-xs font-semibold text-slate-900 dark:text-white">
                    {c.name}
                  </td>
                  <td className="py-3 px-4 text-xs text-slate-600 dark:text-slate-300">{c.email}</td>
                  <td className="py-3 px-4 text-xs font-mono text-slate-600 dark:text-slate-300">
                    {c.phone}
                  </td>
                  <td className="py-3 px-4 text-xs text-slate-600 dark:text-slate-300">{c.zone}</td>
                  <td className="py-3 px-4 text-right font-mono text-xs font-semibold tabular-nums text-slate-900 dark:text-white">
                    {c.totalReports}
                  </td>
                  <td className="py-3 px-4 text-right font-mono text-xs font-semibold tabular-nums text-emerald-700 dark:text-emerald-400">
                    {c.resolvedReports}
                  </td>
                  <td className="py-3 px-4 text-right text-xs text-slate-500 dark:text-slate-400 tabular-nums whitespace-nowrap">
                    {formatDateTime(c.createdAt)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ANALYTICS TAB */}
      {activeTab === 'analytics' && stats && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5">
            <h2 className="text-sm font-bold text-slate-900 dark:text-white mb-4">
              Reports by Garbage Category
            </h2>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={stats.byCategory} margin={{ top: 8, right: 16, left: -16, bottom: 24 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#94a3b8" opacity={0.2} />
                  <XAxis dataKey="category" tick={{ fontSize: 11 }} angle={-15} textAnchor="end" interval={0} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Bar dataKey="count" name="Complaints" fill="#047857" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5">
            <h2 className="text-sm font-bold text-slate-900 dark:text-white mb-4">
              Reports by Status Distribution
            </h2>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={statusPieData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius={56}
                    outerRadius={92}
                    paddingAngle={3}
                  >
                    {statusPieData.map((entry, idx) => (
                      <Cell key={entry.name} fill={PIE_COLORS[idx % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend wrapperStyle={{ fontSize: '12px' }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5">
            <h2 className="text-sm font-bold text-slate-900 dark:text-white mb-4">
              Complaints by Municipal Ward (Active vs Resolved)
            </h2>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={stats.byLocation} margin={{ top: 8, right: 16, left: -16, bottom: 24 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#94a3b8" opacity={0.2} />
                  <XAxis dataKey="location" tick={{ fontSize: 11 }} angle={-15} textAnchor="end" interval={0} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Legend wrapperStyle={{ fontSize: '12px' }} />
                  <Bar dataKey="active" name="Active" fill="#d97706" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="resolved" name="Resolved" fill="#059669" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5">
            <h2 className="text-sm font-bold text-slate-900 dark:text-white mb-4">
              Daily Complaint Intake vs Resolution Trend
            </h2>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={stats.dailyTrend} margin={{ top: 8, right: 16, left: -16, bottom: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#94a3b8" opacity={0.2} />
                  <XAxis dataKey="day" tick={{ fontSize: 11 }} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Legend wrapperStyle={{ fontSize: '12px' }} />
                  <Area
                    type="monotone"
                    dataKey="submitted"
                    name="Submitted"
                    stroke="#0284c7"
                    fill="#0284c7"
                    fillOpacity={0.18}
                  />
                  <Area
                    type="monotone"
                    dataKey="resolved"
                    name="Resolved"
                    stroke="#059669"
                    fill="#059669"
                    fillOpacity={0.25}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}

      {/* ADMIN MANAGE / ASSIGN REPORT MODAL */}
      {manageReport && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs"
          role="dialog"
          aria-modal="true"
        >
          <div className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 px-6 py-4">
              <div>
                <p className="font-mono text-xs font-semibold text-emerald-700 dark:text-emerald-400">
                  {manageReport.reportId}
                </p>
                <h2 className="text-base font-bold text-slate-900 dark:text-white">
                  Manage &amp; Dispatch — {manageReport.category}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setManageReport(null)}
                className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
                aria-label="Close modal"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSaveReportChanges} className="flex-1 overflow-y-auto p-6 space-y-5">
              {/* Before / After Preview */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1.5">
                    Reported Photo
                  </p>
                  <SafeImage
                    src={manageReport.image}
                    alt="Citizen complaint photo"
                    className="h-36 w-full rounded-lg border border-slate-200 dark:border-slate-800 object-cover"
                    fallbackLabel="No photo"
                  />
                </div>
                <div>
                  <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1.5">
                    Worker Completion Proof
                  </p>
                  <SafeImage
                    src={manageReport.completionImage}
                    alt="After cleanup proof"
                    className="h-36 w-full rounded-lg border border-slate-200 dark:border-slate-800 object-cover"
                    fallbackLabel="Not uploaded yet"
                  />
                </div>
              </div>

              {manageReport.workerStatus === 'Completed' && manageReport.status !== 'Resolved' && (
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-lg border border-emerald-200 dark:border-emerald-900/60 bg-emerald-50 dark:bg-emerald-950/30 p-4">
                  <div className="text-xs text-emerald-900 dark:text-emerald-200">
                    <p className="font-bold">Field Crew Marked Task Completed</p>
                    <p className="mt-0.5">
                      {manageReport.completionNotes || 'Review the verification photo above and confirm resolution.'}
                    </p>
                  </div>
                  <button
                    type="button"
                    disabled={savingReport}
                    onClick={() => handleVerifyResolve(manageReport)}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-700 px-3.5 py-2 text-xs font-semibold text-white hover:bg-emerald-800 whitespace-nowrap shrink-0"
                  >
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    <span>Verify &amp; Mark Resolved</span>
                  </button>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label htmlFor="m-worker" className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                    Assign Sanitation Worker
                  </label>
                  <select
                    id="m-worker"
                    value={assignWorkerId}
                    onChange={(e) => {
                      setAssignWorkerId(e.target.value);
                      if (e.target.value && manageStatus === 'Pending') {
                        setManageStatus('Assigned');
                      }
                    }}
                    className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-xs text-slate-900 dark:text-slate-100"
                  >
                    <option value="">Unassigned</option>
                    {workers.map((w) => (
                      <option key={w.id} value={w.id}>
                        {w.name} ({w.zone})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label htmlFor="m-status" className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                    Complaint Status
                  </label>
                  <select
                    id="m-status"
                    value={manageStatus}
                    onChange={(e) => setManageStatus(e.target.value as ReportStatus)}
                    className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-xs text-slate-900 dark:text-slate-100"
                  >
                    {REPORT_STATUSES.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label htmlFor="m-priority" className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                    Priority Level
                  </label>
                  <select
                    id="m-priority"
                    value={managePriority}
                    onChange={(e) => setManagePriority(e.target.value as ReportPriority)}
                    className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-xs text-slate-900 dark:text-slate-100"
                  >
                    {REPORT_PRIORITIES.map((p) => (
                      <option key={p} value={p}>
                        {p}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label htmlFor="m-notes" className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  Admin Dispatch / Verification Notes
                </label>
                <textarea
                  id="m-notes"
                  rows={3}
                  value={manageNotes}
                  onChange={(e) => setManageNotes(e.target.value)}
                  placeholder="Instructions for assigned worker or closure verification comments..."
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3.5 py-2 text-sm text-slate-900 dark:text-slate-100 focus:border-emerald-600 focus:outline-none"
                />
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 dark:border-slate-800 pt-4">
                <div>
                  {confirmDeleteReportId === manageReport.id ? (
                    <button
                      type="button"
                      onClick={() => handleDeleteReport(manageReport.id)}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-red-600 px-3 py-2 text-xs font-semibold text-white hover:bg-red-700"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      <span>Confirm Permanent Delete</span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setConfirmDeleteReportId(manageReport.id)}
                      className="inline-flex items-center gap-1.5 text-xs font-semibold text-red-600 hover:underline dark:text-red-400"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      <span>Delete Report</span>
                    </button>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setManageReport(null)}
                    className="rounded-lg border border-slate-300 dark:border-slate-700 px-4 py-2 text-xs font-semibold text-slate-700 dark:text-slate-300"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={savingReport}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-700 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-800 disabled:opacity-60"
                  >
                    <UserCheck className="h-3.5 w-3.5" />
                    <span>{savingReport ? 'Saving...' : 'Save Dispatch Changes'}</span>
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ADD / EDIT WORKER MODAL */}
      {workerModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-md rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 px-6 py-4">
              <h2 className="text-base font-bold text-slate-900 dark:text-white">
                {editingWorker ? `Edit Worker — ${editingWorker.name}` : 'Add Sanitation Worker'}
              </h2>
              <button
                type="button"
                onClick={() => setWorkerModalOpen(false)}
                className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
                aria-label="Close modal"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSaveWorker} className="p-6 space-y-4">
              <div>
                <label htmlFor="w-name" className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Full Name
                </label>
                <input
                  id="w-name"
                  type="text"
                  required
                  value={workerForm.name}
                  onChange={(e) => setWorkerForm({ ...workerForm, name: e.target.value })}
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3.5 py-2 text-sm text-slate-900 dark:text-slate-100"
                />
              </div>

              {!editingWorker && (
                <div>
                  <label htmlFor="w-email" className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Work Email
                  </label>
                  <input
                    id="w-email"
                    type="email"
                    required
                    value={workerForm.email}
                    onChange={(e) => setWorkerForm({ ...workerForm, email: e.target.value })}
                    className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3.5 py-2 text-sm text-slate-900 dark:text-slate-100"
                  />
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="w-phone" className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Phone
                  </label>
                  <input
                    id="w-phone"
                    type="tel"
                    required
                    value={workerForm.phone}
                    onChange={(e) => setWorkerForm({ ...workerForm, phone: e.target.value })}
                    className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm text-slate-900 dark:text-slate-100"
                  />
                </div>
                <div>
                  <label htmlFor="w-avail" className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Availability
                  </label>
                  <select
                    id="w-avail"
                    value={workerForm.availability}
                    onChange={(e) =>
                      setWorkerForm({ ...workerForm, availability: e.target.value as WorkerAvailability })
                    }
                    className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm text-slate-900 dark:text-slate-100"
                  >
                    <option value="available">Available</option>
                    <option value="busy">On Assignment</option>
                    <option value="off_duty">Off Duty</option>
                  </select>
                </div>
              </div>

              <div>
                <label htmlFor="w-zone" className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Assigned Ward / Zone
                </label>
                <select
                  id="w-zone"
                  value={workerForm.zone}
                  onChange={(e) => setWorkerForm({ ...workerForm, zone: e.target.value })}
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm text-slate-900 dark:text-slate-100"
                >
                  {CITY_WARDS.map((w) => (
                    <option key={w} value={w}>
                      {w}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="w-pass" className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  {editingWorker
                    ? 'Set / Reset Login Password (leave blank to keep current)'
                    : 'Login Password (min 6 chars)'}
                </label>
                <input
                  id="w-pass"
                  type="password"
                  required={!editingWorker}
                  minLength={6}
                  value={workerForm.password}
                  onChange={(e) => setWorkerForm({ ...workerForm, password: e.target.value })}
                  placeholder="••••••••"
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3.5 py-2 text-sm text-slate-900 dark:text-slate-100"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setWorkerModalOpen(false)}
                  className="rounded-lg border border-slate-300 dark:border-slate-700 px-4 py-2 text-xs font-semibold text-slate-700 dark:text-slate-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingWorker}
                  className="rounded-lg bg-emerald-700 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-800 disabled:opacity-60"
                >
                  {savingWorker ? 'Saving...' : editingWorker ? 'Save Worker' : 'Create Worker'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <ReportDetailModal report={inspectReport} onClose={() => setInspectReport(null)} />
    </DashboardLayout>
  );
}
