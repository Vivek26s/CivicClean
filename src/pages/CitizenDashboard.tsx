import React, { useCallback, useEffect, useState } from 'react';
import {
  Camera,
  CheckCircle2,
  ClipboardList,
  Compass,
  Copy,
  LayoutDashboard,
  MapPin,
  PlusCircle,
  Search,
  User,
} from 'lucide-react';
import { DashboardLayout, type NavItem } from '../layouts/DashboardLayout';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { api } from '../services/api';
import {
  CITY_WARDS,
  GARBAGE_CATEGORIES,
  REPORT_STATUSES,
  type GarbageCategory,
  type ReportItem,
} from '../types';
import { CityMap } from '../components/CityMap';
import { ReportDetailModal } from '../components/ReportDetailModal';
import { SafeImage } from '../components/SafeImage';
import { PriorityText, StatusIndicator, formatDateTime } from '../components/StatusText';

export function CitizenDashboard() {
  const { user, updateProfile } = useAuth();
  const { notify } = useToast();

  const [activeTab, setActiveTab] = useState('overview');
  const [reports, setReports] = useState<ReportItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedReport, setSelectedReport] = useState<ReportItem | null>(null);

  // History filter state
  const [statusFilter, setStatusFilter] = useState('All');
  const [searchTerm, setSearchTerm] = useState('');

  // Report Garbage Form state
  const [category, setCategory] = useState<GarbageCategory>('Overflowing Dustbin');
  const [description, setDescription] = useState('');
  const [address, setAddress] = useState('');
  const [ward, setWard] = useState(user?.zone || CITY_WARDS[0]);
  const [coords, setCoords] = useState<{ lat: number; lng: number }>({
    lat: 28.6229,
    lng: 77.2195,
  });
  const [gpsStatus, setGpsStatus] = useState<string>('');
  const [detectingGps, setDetectingGps] = useState(false);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submittedReceipt, setSubmittedReceipt] = useState<ReportItem | null>(null);

  // Profile state
  const [profileName, setProfileName] = useState(user?.name || '');
  const [profilePhone, setProfilePhone] = useState(user?.phone || '');
  const [profileZone, setProfileZone] = useState(user?.zone || CITY_WARDS[0]);
  const [savingProfile, setSavingProfile] = useState(false);

  const loadReports = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.getReports();
      setReports(res.reports);
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Failed to load complaints.', 'error');
    } finally {
      setLoading(false);
    }
  }, [notify]);

  useEffect(() => {
    loadReports();
  }, [loadReports]);

  useEffect(() => {
    return () => {
      if (photoPreview) URL.revokeObjectURL(photoPreview);
    };
  }, [photoPreview]);

  const handleDetectGPS = () => {
    if (!navigator.geolocation) {
      setGpsStatus('Geolocation is not supported by your browser. Click the map to place a pin manually.');
      return;
    }
    setDetectingGps(true);
    setGpsStatus('Acquiring GPS coordinates...');
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const lat = Number(position.coords.latitude.toFixed(6));
        const lng = Number(position.coords.longitude.toFixed(6));
        setCoords({ lat, lng });
        setDetectingGps(false);
        setGpsStatus(`GPS locked (±${Math.round(position.coords.accuracy)}m accuracy).`);
        if (!address.trim()) {
          setAddress(`GPS Pin (${lat.toFixed(4)}, ${lng.toFixed(4)})`);
        }
        notify('Current GPS location detected.', 'success');
      },
      () => {
        setDetectingGps(false);
        setGpsStatus('Could not access GPS permission. Click directly on the map to choose the exact location.');
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null;
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      notify('Image must be smaller than 5MB.', 'error');
      return;
    }
    if (photoPreview) URL.revokeObjectURL(photoPreview);
    setPhotoFile(file);
    setPhotoPreview(URL.createObjectURL(file));
  };

  const handleSubmitReport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!address.trim()) {
      notify('Please enter a street address or landmark.', 'error');
      return;
    }
    setSubmitting(true);
    try {
      const formData = new FormData();
      formData.append('category', category);
      formData.append('description', description);
      formData.append('latitude', String(coords.lat));
      formData.append('longitude', String(coords.lng));
      formData.append('address', address);
      formData.append('ward', ward);
      if (photoFile) {
        formData.append('image', photoFile);
      }

      const res = await api.createReport(formData);
      setSubmittedReceipt(res.report);
      setDescription('');
      setAddress('');
      setPhotoFile(null);
      if (photoPreview) {
        URL.revokeObjectURL(photoPreview);
        setPhotoPreview(null);
      }
      notify(`Complaint ${res.report.reportId} submitted successfully.`, 'success');
      loadReports();
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Could not submit report.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingProfile(true);
    try {
      await updateProfile({ name: profileName, phone: profilePhone, zone: profileZone });
      notify('Profile updated.', 'success');
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Failed to update profile.', 'error');
    } finally {
      setSavingProfile(false);
    }
  };

  const copyCode = async (code: string) => {
    try {
      await navigator.clipboard.writeText(code);
      notify(`Copied ${code} to clipboard.`, 'info');
    } catch {
      notify(`Complaint ID: ${code}`, 'info');
    }
  };

  const counts = {
    total: reports.length,
    pending: reports.filter((r) => r.status === 'Pending' || r.status === 'Assigned').length,
    inProgress: reports.filter((r) => r.status === 'In Progress').length,
    resolved: reports.filter((r) => r.status === 'Resolved').length,
  };

  const filteredReports = reports.filter((r) => {
    const matchesStatus = statusFilter === 'All' || r.status === statusFilter;
    const q = searchTerm.trim().toLowerCase();
    const matchesSearch =
      !q ||
      r.reportId.toLowerCase().includes(q) ||
      r.category.toLowerCase().includes(q) ||
      r.location.address.toLowerCase().includes(q) ||
      r.description.toLowerCase().includes(q);
    return matchesStatus && matchesSearch;
  });

  const navItems: NavItem[] = [
    { id: 'overview', label: 'Overview', icon: LayoutDashboard },
    { id: 'report', label: 'Report Garbage', icon: PlusCircle },
    { id: 'history', label: 'My Complaints', icon: ClipboardList, count: reports.length },
    { id: 'profile', label: 'Profile', icon: User },
  ];

  return (
    <DashboardLayout
      portalName="Citizen Portal"
      activeTab={activeTab}
      onSelectTab={setActiveTab}
      navItems={navItems}
      headerAction={
        activeTab !== 'report' ? (
          <button
            type="button"
            onClick={() => {
              setSubmittedReceipt(null);
              setActiveTab('report');
            }}
            className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-700 px-3.5 py-2 text-xs font-semibold text-white hover:bg-emerald-800 dark:bg-emerald-600 dark:hover:bg-emerald-500 transition-colors whitespace-nowrap"
          >
            <PlusCircle className="h-3.5 w-3.5" />
            <span>New Report</span>
          </button>
        ) : undefined
      }
    >
      {/* OVERVIEW TAB */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { label: 'Total Submitted', value: counts.total, tone: 'text-slate-900 dark:text-white' },
              { label: 'Pending / Assigned', value: counts.pending, tone: 'text-amber-700 dark:text-amber-400' },
              { label: 'In Progress', value: counts.inProgress, tone: 'text-indigo-700 dark:text-indigo-400' },
              { label: 'Resolved', value: counts.resolved, tone: 'text-emerald-700 dark:text-emerald-400' },
            ].map((kpi) => (
              <div
                key={kpi.label}
                className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5"
              >
                <p className="text-xs font-medium text-slate-500 dark:text-slate-400">{kpi.label}</p>
                <p className={`mt-2 text-3xl font-bold font-mono tabular-nums ${kpi.tone}`}>
                  {kpi.value}
                </p>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-7 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden">
              <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 px-5 py-4">
                <h2 className="text-sm font-bold text-slate-900 dark:text-white">Recent Submissions</h2>
                <button
                  type="button"
                  onClick={() => setActiveTab('history')}
                  className="text-xs font-semibold text-emerald-700 hover:underline dark:text-emerald-400"
                >
                  View all
                </button>
              </div>
              {loading ? (
                <div className="p-6 space-y-3">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="h-12 rounded-lg bg-slate-100 dark:bg-slate-800 animate-pulse" />
                  ))}
                </div>
              ) : reports.length === 0 ? (
                <div className="p-10 text-center space-y-3">
                  <MapPin className="mx-auto h-7 w-7 text-slate-400" />
                  <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                    You have not submitted any garbage reports yet
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Report overflowing bins, roadside litter, or park waste with GPS coordinates and a photo.
                  </p>
                  <button
                    type="button"
                    onClick={() => setActiveTab('report')}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-700 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-800"
                  >
                    <PlusCircle className="h-3.5 w-3.5" />
                    <span>Submit Your First Report</span>
                  </button>
                </div>
              ) : (
                <div className="divide-y divide-slate-100 dark:divide-slate-800">
                  {reports.slice(0, 5).map((r) => (
                    <button
                      key={r.id}
                      type="button"
                      onClick={() => setSelectedReport(r)}
                      className="flex w-full items-center justify-between gap-4 px-5 py-3.5 text-left hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                          <span className="font-mono font-semibold text-slate-900 dark:text-slate-100">
                            {r.reportId}
                          </span>
                          <span aria-hidden="true">·</span>
                          <span>{r.category}</span>
                        </div>
                        <p className="mt-0.5 truncate text-sm text-slate-700 dark:text-slate-300">
                          {r.location.address}
                        </p>
                      </div>
                      <div className="shrink-0 text-right">
                        <StatusIndicator status={r.status} />
                        <p className="mt-0.5 text-[11px] text-slate-400 tabular-nums">
                          {formatDateTime(r.createdAt)}
                        </p>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="lg:col-span-5 space-y-3">
              <h2 className="text-sm font-bold text-slate-900 dark:text-white">
                My Reported Locations
              </h2>
              <CityMap
                mode="markers"
                heightClass="h-80"
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
                  if (found) setSelectedReport(found);
                }}
              />
            </div>
          </div>
        </div>
      )}

      {/* REPORT GARBAGE TAB */}
      {activeTab === 'report' && (
        <div className="space-y-6">
          {submittedReceipt && (
            <div className="rounded-xl border border-emerald-200 dark:border-emerald-900/60 bg-emerald-50 dark:bg-emerald-950/30 p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-start gap-3">
                <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-700 dark:text-emerald-400 mt-0.5" />
                <div>
                  <p className="text-sm font-bold text-emerald-950 dark:text-emerald-100">
                    Complaint Registered Successfully
                  </p>
                  <p className="mt-0.5 text-xs text-emerald-800 dark:text-emerald-300">
                    Unique Complaint ID:{' '}
                    <span className="font-mono font-bold">{submittedReceipt.reportId}</span> — You can track it anytime from My Complaints or the public tracker.
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => copyCode(submittedReceipt.reportId)}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-300 dark:border-emerald-800 bg-white dark:bg-slate-900 px-3 py-1.5 text-xs font-semibold text-emerald-800 dark:text-emerald-300 hover:bg-emerald-100/50"
                >
                  <Copy className="h-3.5 w-3.5" />
                  <span>Copy ID</span>
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedReport(submittedReceipt)}
                  className="rounded-lg bg-emerald-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-800"
                >
                  Inspect Report
                </button>
              </div>
            </div>
          )}

          <form onSubmit={handleSubmitReport} className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Left column: Problem details & Photo */}
            <div className="lg:col-span-6 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 space-y-5">
              <div>
                <h2 className="text-base font-bold text-slate-900 dark:text-white">
                  1. Complaint Details
                </h2>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  Provide accurate details and a clear photograph so municipal crews arrive prepared.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="report-category" className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                    Garbage Category
                  </label>
                  <select
                    id="report-category"
                    value={category}
                    onChange={(e) => setCategory(e.target.value as GarbageCategory)}
                    className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2.5 text-sm text-slate-900 dark:text-slate-100 focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-600/20"
                  >
                    {GARBAGE_CATEGORIES.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label htmlFor="report-ward" className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                    Municipal Ward
                  </label>
                  <select
                    id="report-ward"
                    value={ward}
                    onChange={(e) => setWard(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2.5 text-sm text-slate-900 dark:text-slate-100 focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-600/20"
                  >
                    {CITY_WARDS.map((w) => (
                      <option key={w} value={w}>
                        {w}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label htmlFor="report-address" className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  Street Address / Nearby Landmark
                </label>
                <input
                  id="report-address"
                  type="text"
                  required
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="e.g., Beside City Library Gate 2, Main Avenue"
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3.5 py-2.5 text-sm text-slate-900 dark:text-slate-100 focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-600/20"
                />
              </div>

              <div>
                <label htmlFor="report-desc" className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  Problem Description
                </label>
                <textarea
                  id="report-desc"
                  rows={4}
                  required
                  minLength={10}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Describe the volume of waste, hazards, or access instructions for sanitation vehicles..."
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3.5 py-2.5 text-sm text-slate-900 dark:text-slate-100 focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-600/20"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  Upload Garbage / Issue Photo (JPG, PNG, WebP · Max 5MB)
                </label>
                <label className="flex cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 p-5 text-center hover:border-emerald-600 transition-colors">
                  <Camera className="h-6 w-6 text-slate-400" />
                  <span className="mt-2 text-xs font-semibold text-slate-700 dark:text-slate-300">
                    {photoFile ? photoFile.name : 'Click to choose or capture photo'}
                  </span>
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    onChange={handleFileChange}
                    className="sr-only"
                  />
                </label>
                {photoPreview && (
                  <img
                    src={photoPreview}
                    alt="Selected garbage complaint preview"
                    className="mt-3 h-40 w-full rounded-lg border border-slate-200 dark:border-slate-800 object-cover"
                  />
                )}
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full rounded-lg bg-emerald-700 px-5 py-3 text-sm font-semibold text-white hover:bg-emerald-800 dark:bg-emerald-600 dark:hover:bg-emerald-500 disabled:opacity-60 transition-colors"
              >
                {submitting ? 'Submitting Complaint...' : 'Submit Garbage Complaint'}
              </button>
            </div>

            {/* Right column: GPS & Interactive OpenStreetMap Pin Picker */}
            <div className="lg:col-span-6 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-base font-bold text-slate-900 dark:text-white">
                    2. Pin Exact GPS Location
                  </h2>
                  <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                    Auto-detect your location or click/drag the pin directly on the map.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleDetectGPS}
                  disabled={detectingGps}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3.5 py-2 text-xs font-semibold text-slate-800 dark:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors whitespace-nowrap"
                >
                  <Compass className="h-4 w-4 text-emerald-700 dark:text-emerald-400" />
                  <span>{detectingGps ? 'Detecting...' : 'Detect My GPS'}</span>
                </button>
              </div>

              {gpsStatus && (
                <p className="text-xs text-slate-600 dark:text-slate-400">{gpsStatus}</p>
              )}

              <CityMap
                mode="picker"
                heightClass="h-[360px]"
                selectedPosition={coords}
                onSelectPosition={(lat, lng) => setCoords({ lat, lng })}
              />

              <div className="grid grid-cols-2 gap-3 pt-1">
                <div>
                  <label htmlFor="coord-lat" className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">
                    Latitude
                  </label>
                  <input
                    id="coord-lat"
                    type="number"
                    step="0.000001"
                    value={coords.lat}
                    onChange={(e) => setCoords((prev) => ({ ...prev, lat: Number(e.target.value) }))}
                    className="w-full rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-xs font-mono tabular-nums text-slate-900 dark:text-slate-100"
                  />
                </div>
                <div>
                  <label htmlFor="coord-lng" className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">
                    Longitude
                  </label>
                  <input
                    id="coord-lng"
                    type="number"
                    step="0.000001"
                    value={coords.lng}
                    onChange={(e) => setCoords((prev) => ({ ...prev, lng: Number(e.target.value) }))}
                    className="w-full rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-xs font-mono tabular-nums text-slate-900 dark:text-slate-100"
                  />
                </div>
              </div>
            </div>
          </form>
        </div>
      )}

      {/* COMPLAINT HISTORY TAB */}
      {activeTab === 'history' && (
        <div className="space-y-5">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-1 rounded-lg bg-slate-200/70 dark:bg-slate-900 p-1">
              {['All', ...REPORT_STATUSES].map((st) => (
                <button
                  key={st}
                  type="button"
                  onClick={() => setStatusFilter(st)}
                  className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-colors whitespace-nowrap ${
                    statusFilter === st
                      ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                  }`}
                >
                  {st}
                </button>
              ))}
            </div>

            <div className="relative w-full md:w-72">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search ID, category, or address..."
                className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 pl-9 pr-3 py-2 text-xs text-slate-900 dark:text-slate-100 focus:border-emerald-600 focus:outline-none"
              />
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-x-auto">
            {filteredReports.length === 0 ? (
              <div className="p-10 text-center text-sm text-slate-500 dark:text-slate-400">
                No complaints match the current filter.
              </div>
            ) : (
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800 text-xs text-slate-500 dark:text-slate-400">
                    <th className="py-3 px-4 font-semibold">Report ID</th>
                    <th className="py-3 px-4 font-semibold">Issue</th>
                    <th className="py-3 px-4 font-semibold">Location</th>
                    <th className="py-3 px-4 font-semibold">Status</th>
                    <th className="py-3 px-4 font-semibold">Priority</th>
                    <th className="py-3 px-4 font-semibold">Submitted</th>
                    <th className="py-3 px-4 font-semibold text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {filteredReports.map((r) => (
                    <tr
                      key={r.id}
                      className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors"
                    >
                      <td className="py-3 px-4 font-mono text-xs font-semibold text-slate-900 dark:text-white whitespace-nowrap">
                        {r.reportId}
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
                            <p className="font-medium text-slate-900 dark:text-slate-100 whitespace-nowrap">
                              {r.category}
                            </p>
                            <p className="max-w-xs truncate text-xs text-slate-500 dark:text-slate-400">
                              {r.description}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-xs text-slate-600 dark:text-slate-300 max-w-[200px] truncate">
                        {r.location.address}
                      </td>
                      <td className="py-3 px-4">
                        <StatusIndicator status={r.status} />
                      </td>
                      <td className="py-3 px-4">
                        <PriorityText priority={r.priority} />
                      </td>
                      <td className="py-3 px-4 text-xs text-slate-500 dark:text-slate-400 tabular-nums whitespace-nowrap">
                        {formatDateTime(r.createdAt)}
                      </td>
                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => setSelectedReport(r)}
                          className="text-xs font-semibold text-emerald-700 hover:underline dark:text-emerald-400"
                        >
                          Details &amp; Map
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* PROFILE TAB */}
      {activeTab === 'profile' && (
        <div className="max-w-xl rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 sm:p-8">
          <h2 className="text-base font-bold text-slate-900 dark:text-white">
            Citizen Account Profile
          </h2>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            Update your contact details and default municipal ward used for new reports.
          </p>

          <form onSubmit={handleSaveProfile} className="mt-6 space-y-4">
            <div>
              <label htmlFor="prof-email" className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Email Address (Read-only)
              </label>
              <input
                id="prof-email"
                type="email"
                disabled
                value={user?.email || ''}
                className="w-full rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-950 px-3.5 py-2.5 text-sm text-slate-500"
              />
            </div>

            <div>
              <label htmlFor="prof-name" className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Full Name
              </label>
              <input
                id="prof-name"
                type="text"
                required
                value={profileName}
                onChange={(e) => setProfileName(e.target.value)}
                className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3.5 py-2.5 text-sm text-slate-900 dark:text-slate-100 focus:border-emerald-600 focus:outline-none"
              />
            </div>

            <div>
              <label htmlFor="prof-phone" className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Phone Number
              </label>
              <input
                id="prof-phone"
                type="tel"
                required
                value={profilePhone}
                onChange={(e) => setProfilePhone(e.target.value)}
                className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3.5 py-2.5 text-sm text-slate-900 dark:text-slate-100 focus:border-emerald-600 focus:outline-none"
              />
            </div>

            <div>
              <label htmlFor="prof-zone" className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Default Ward / Zone
              </label>
              <select
                id="prof-zone"
                value={profileZone}
                onChange={(e) => setProfileZone(e.target.value)}
                className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2.5 text-sm text-slate-900 dark:text-slate-100 focus:border-emerald-600 focus:outline-none"
              >
                {CITY_WARDS.map((w) => (
                  <option key={w} value={w}>
                    {w}
                  </option>
                ))}
              </select>
            </div>

            <button
              type="submit"
              disabled={savingProfile}
              className="rounded-lg bg-emerald-700 px-5 py-2.5 text-sm font-semibold text-white hover:bg-emerald-800 dark:bg-emerald-600 dark:hover:bg-emerald-500 disabled:opacity-60 transition-colors"
            >
              {savingProfile ? 'Saving...' : 'Save Changes'}
            </button>
          </form>
        </div>
      )}

      <ReportDetailModal report={selectedReport} onClose={() => setSelectedReport(null)} />
    </DashboardLayout>
  );
}
