import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ArrowRight,
  CheckCircle2,
  MapPin,
  Moon,
  Search,
  Send,
  ShieldCheck,
  Sun,
  Truck,
  Users,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { useToast } from '../context/ToastContext';
import { api } from '../services/api';
import type { PublicMapPin, PublicStats, PublicTrackedReport } from '../types';
import { CityMap } from '../components/CityMap';
import { SafeImage } from '../components/SafeImage';
import { ReportDetailModal } from '../components/ReportDetailModal';
import { StatusIndicator, formatDateTime } from '../components/StatusText';

const HERO_IMAGE = '/src/assets/images/hero_smart_city_sanitation_1795665107118.jpg';
const SAMPLE_IDS = ['SMC-2026-1042', 'SMC-2026-1041', 'SMC-2026-1036', 'SMC-2026-1032'];

export function HomePage() {
  const { user } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const { notify } = useToast();
  const navigate = useNavigate();

  const [stats, setStats] = useState<PublicStats | null>(null);
  const [mapPins, setMapPins] = useState<PublicMapPin[]>([]);
  const [trackQuery, setTrackQuery] = useState('');
  const [trackLoading, setTrackLoading] = useState(false);
  const [trackedReport, setTrackedReport] = useState<PublicTrackedReport | null>(null);
  const [trackError, setTrackError] = useState('');
  const [modalReport, setModalReport] = useState<PublicTrackedReport | null>(null);

  const [contactForm, setContactForm] = useState({
    name: '',
    email: '',
    subject: '',
    message: '',
  });
  const [contactSubmitting, setContactSubmitting] = useState(false);
  const [contactSuccess, setContactSuccess] = useState('');

  useEffect(() => {
    api.getPublicStats().then(setStats).catch(() => {});
    api.getPublicMap().then((res) => setMapPins(res.reports)).catch(() => {});
  }, []);

  const handlePrimaryPortalAction = () => {
    if (!user) {
      navigate('/auth?role=citizen&mode=register');
      return;
    }
    if (user.role === 'admin') navigate('/admin');
    else if (user.role === 'worker') navigate('/worker');
    else navigate('/citizen');
  };

  const performTrackLookup = async (idToLookup: string) => {
    const clean = idToLookup.trim().toUpperCase();
    if (!clean) {
      setTrackError('Please enter a Complaint ID to look up.');
      return;
    }
    setTrackQuery(clean);
    setTrackError('');
    setTrackLoading(true);
    try {
      const res = await api.trackReport(clean);
      setTrackedReport(res.report);
    } catch (err) {
      setTrackedReport(null);
      setTrackError(err instanceof Error ? err.message : 'Complaint not found.');
    } finally {
      setTrackLoading(false);
    }
  };

  const handleTrackSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    performTrackLookup(trackQuery);
  };

  const handleContactSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setContactSubmitting(true);
    setContactSuccess('');
    try {
      const res = await api.submitContact(contactForm);
      setContactSuccess(res.message);
      setContactForm({ name: '', email: '', subject: '', message: '' });
      notify('Message received by Municipal Support.', 'success');
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Could not send message.', 'error');
    } finally {
      setContactSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100">
      {/* Strict 3-zone Top Bar Contract */}
      <header className="sticky top-0 z-40 border-b border-slate-200 dark:border-slate-800 bg-white/95 dark:bg-slate-950/95 backdrop-blur-xs">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-8 px-4 sm:px-6 lg:px-8">
          <Link
            to="/"
            className="text-lg font-bold tracking-tight text-slate-900 dark:text-white whitespace-nowrap shrink-0"
          >
            CivicClean
          </Link>

          <nav
            aria-label="Primary navigation"
            className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-600 dark:text-slate-300"
          >
            <a
              href="#how-it-works"
              className="hover:text-slate-900 dark:hover:text-white transition-colors whitespace-nowrap shrink-0"
            >
              How It Works
            </a>
            <a
              href="#track"
              className="hover:text-slate-900 dark:hover:text-white transition-colors whitespace-nowrap shrink-0"
            >
              Track Complaint
            </a>
            <a
              href="#live-map"
              className="hover:text-slate-900 dark:hover:text-white transition-colors whitespace-nowrap shrink-0"
            >
              Live Map
            </a>
            <a
              href="#operations"
              className="hover:text-slate-900 dark:hover:text-white transition-colors whitespace-nowrap shrink-0"
            >
              Operations
            </a>
            <a
              href="#contact"
              className="hover:text-slate-900 dark:hover:text-white transition-colors whitespace-nowrap shrink-0"
            >
              Contact
            </a>
          </nav>

          <div className="shrink-0">
            <button
              type="button"
              onClick={handlePrimaryPortalAction}
              className="rounded-lg bg-emerald-700 px-4 py-2 text-xs sm:text-sm font-semibold text-white hover:bg-emerald-800 dark:bg-emerald-600 dark:hover:bg-emerald-500 transition-colors whitespace-nowrap shrink-0"
            >
              {user ? 'Open Dashboard' : 'Report Garbage'}
            </button>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-12 lg:py-20">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-stretch">
            <div className="lg:col-span-6 flex flex-col justify-between space-y-8">
              <div className="space-y-5">
                <p className="text-xs font-medium text-emerald-700 dark:text-emerald-400">
                  Smart City Municipal Sanitation Platform · GPS Dispatch &amp; Verification
                </p>
                <h1
                  className="font-bold tracking-tight text-slate-900 dark:text-white text-balance leading-[1.1]"
                  style={{ fontSize: 'clamp(2.25rem, 4vw, 3.5rem)' }}
                >
                  Cleaner Cities. Smarter Waste Management.
                </h1>
                <p className="max-w-xl text-base leading-relaxed text-slate-600 dark:text-slate-300">
                  Report garbage problems, track cleaning operations, and help build a cleaner and smarter city. Every citizen report captures exact GPS coordinates and photo evidence for fast field resolution.
                </p>

                <div className="flex flex-wrap items-center gap-3 pt-2">
                  <button
                    type="button"
                    onClick={handlePrimaryPortalAction}
                    className="inline-flex items-center gap-2 rounded-lg bg-emerald-700 px-5 py-3 text-sm font-semibold text-white hover:bg-emerald-800 dark:bg-emerald-600 dark:hover:bg-emerald-500 transition-colors whitespace-nowrap"
                  >
                    <span>Report Garbage</span>
                    <ArrowRight className="h-4 w-4" />
                  </button>
                  <a
                    href="#track"
                    className="inline-flex items-center gap-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-5 py-3 text-sm font-semibold text-slate-800 dark:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors whitespace-nowrap"
                  >
                    <Search className="h-4 w-4" />
                    <span>Track Complaint</span>
                  </a>
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-4 border-t border-slate-200 dark:border-slate-800 pt-5 text-xs text-slate-600 dark:text-slate-400">
                <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                  <span className="font-medium text-slate-800 dark:text-slate-200">Portal Access:</span>
                  <Link
                    to="/auth?role=citizen"
                    className="hover:text-emerald-700 dark:hover:text-emerald-400 underline underline-offset-4"
                  >
                    Citizen Sign In
                  </Link>
                  <Link
                    to="/auth?role=admin"
                    className="hover:text-emerald-700 dark:hover:text-emerald-400 underline underline-offset-4"
                  >
                    Admin Console
                  </Link>
                  <Link
                    to="/auth?role=worker"
                    className="hover:text-emerald-700 dark:hover:text-emerald-400 underline underline-offset-4"
                  >
                    Worker Portal
                  </Link>
                </div>

                <button
                  type="button"
                  onClick={toggleTheme}
                  className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-700 dark:text-slate-300 hover:text-emerald-700 dark:hover:text-emerald-400 transition-colors whitespace-nowrap"
                >
                  {theme === 'dark' ? <Sun className="h-3.5 w-3.5" /> : <Moon className="h-3.5 w-3.5" />}
                  <span>{theme === 'dark' ? 'Light Theme' : 'Dark Theme'}</span>
                </button>
              </div>
            </div>

            <div className="lg:col-span-6">
              <div className="h-full min-h-[280px] overflow-hidden rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-900">
                <SafeImage
                  src={HERO_IMAGE}
                  alt="Modern sunlit smart city avenue with clean sensor-equipped waste bins and electric municipal street sweeper"
                  className="h-full w-full object-cover"
                  fallbackLabel="Smart City Municipal Sanitation Avenue"
                />
              </div>
            </div>
          </div>

          {/* Full-width 4-Column Live Municipal Statistics Strip */}
          <div className="mt-12 grid grid-cols-2 lg:grid-cols-4 gap-6 border-t border-slate-200 dark:border-slate-800 pt-8">
            <div>
              <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                Total City Reports Logged
              </p>
              <p className="mt-1.5 text-3xl font-bold tracking-tight text-slate-900 dark:text-white font-mono tabular-nums">
                {stats ? stats.totalReports : '—'}
              </p>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                Across {stats?.wardsCovered ?? 5} active municipal wards
              </p>
            </div>
            <div>
              <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                Verified Cleaned &amp; Resolved
              </p>
              <p className="mt-1.5 text-3xl font-bold tracking-tight text-emerald-700 dark:text-emerald-400 font-mono tabular-nums">
                {stats ? stats.resolvedReports : '—'}
              </p>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                With before-and-after photo proof
              </p>
            </div>
            <div>
              <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                Active Cleaning Operations
              </p>
              <p className="mt-1.5 text-3xl font-bold tracking-tight text-slate-900 dark:text-white font-mono tabular-nums">
                {stats ? stats.activeOperations : '—'}
              </p>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                {stats?.totalWorkers ?? 4} sanitation field personnel registered
              </p>
            </div>
            <div>
              <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                Municipal Resolution Rate
              </p>
              <p className="mt-1.5 text-3xl font-bold tracking-tight text-slate-900 dark:text-white font-mono tabular-nums">
                {stats ? `${stats.resolutionRate}%` : '—'}
              </p>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                Calculated live from verified closures
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section id="how-it-works" className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-16 lg:py-20">
        <div className="max-w-2xl">
          <p className="text-xs font-semibold text-emerald-700 dark:text-emerald-400">
            End-to-End Civic Workflow
          </p>
          <h2 className="mt-2 text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 dark:text-white text-balance">
            How location-based garbage resolution works
          </h2>
          <p className="mt-3 text-sm sm:text-base text-slate-600 dark:text-slate-400">
            Every complaint moves transparently from citizen reporting to field crew verification without manual phone follow-ups.
          </p>
        </div>

        <div className="mt-10 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[
            {
              step: '01. Report with GPS & Photo',
              body: 'Citizens pin the exact location automatically via browser GPS or manually on OpenStreetMap, select the waste category, and upload an issue photo.',
            },
            {
              step: '02. Admin Triage & Dispatch',
              body: 'Municipal administrators review incoming complaints on the city map, set priority levels, and assign the nearest available sanitation worker.',
            },
            {
              step: '03. Field Cleanup & Proof',
              body: 'Assigned workers view today’s tasks on mobile, navigate straight to the GPS coordinates, clean the site, and upload a completion photo.',
            },
            {
              step: '04. Verified Resolution',
              body: 'Supervisors verify the after-cleanup image and close the ticket as Resolved. Citizens receive real-time status notifications and full history.',
            },
          ].map((item) => (
            <div
              key={item.step}
              className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 flex flex-col justify-between"
            >
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  {item.step}
                </h3>
                <p className="mt-2.5 text-sm leading-relaxed text-slate-600 dark:text-slate-400">
                  {item.body}
                </p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Track Complaints Section */}
      <section
        id="track"
        className="border-y border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/50 py-16 lg:py-20"
      >
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-start">
            <div className="lg:col-span-5 space-y-4">
              <p className="text-xs font-semibold text-emerald-700 dark:text-emerald-400">
                Public Complaint Lookup
              </p>
              <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 dark:text-white text-balance">
                Track any complaint in real time
              </h2>
              <p className="text-sm leading-relaxed text-slate-600 dark:text-slate-400">
                Enter your unique Complaint ID to inspect current dispatch status, assigned sanitation crew, GPS coordinates, and before-and-after verification photos.
              </p>

              <form onSubmit={handleTrackSubmit} className="pt-2 space-y-3">
                <label htmlFor="track-id-input" className="sr-only">
                  Complaint ID
                </label>
                <div className="flex flex-col sm:flex-row gap-2">
                  <input
                    id="track-id-input"
                    type="text"
                    value={trackQuery}
                    onChange={(e) => setTrackQuery(e.target.value)}
                    placeholder="Enter Complaint ID (e.g. SMC-2026-1042)"
                    className="flex-1 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3.5 py-2.5 text-sm font-mono text-slate-900 dark:text-slate-100 placeholder:font-sans placeholder:text-slate-400 focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-600/20"
                  />
                  <button
                    type="submit"
                    disabled={trackLoading}
                    className="inline-flex items-center justify-center gap-2 rounded-lg bg-slate-900 dark:bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-slate-800 dark:hover:bg-emerald-500 disabled:opacity-60 transition-colors whitespace-nowrap"
                  >
                    <Search className="h-4 w-4" />
                    <span>{trackLoading ? 'Searching...' : 'Track'}</span>
                  </button>
                </div>

                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500 dark:text-slate-400">
                  <span>Try live sample IDs:</span>
                  {SAMPLE_IDS.map((code) => (
                    <button
                      key={code}
                      type="button"
                      onClick={() => performTrackLookup(code)}
                      className="font-mono font-medium text-emerald-700 hover:underline dark:text-emerald-400"
                    >
                      {code}
                    </button>
                  ))}
                </div>
              </form>

              {trackError && (
                <p className="text-sm text-red-600 dark:text-red-400" role="alert">
                  {trackError}
                </p>
              )}
            </div>

            <div className="lg:col-span-7">
              {trackedReport ? (
                <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 p-6 space-y-5">
                  <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-4">
                    <div>
                      <div className="flex items-center gap-2.5 text-xs text-slate-500 dark:text-slate-400">
                        <span className="font-mono font-semibold text-slate-900 dark:text-white">
                          {trackedReport.reportId}
                        </span>
                        <span aria-hidden="true">·</span>
                        <StatusIndicator status={trackedReport.status} />
                        <span aria-hidden="true">·</span>
                        <span>{trackedReport.priority} Priority</span>
                      </div>
                      <h3 className="mt-1.5 text-lg font-bold text-slate-900 dark:text-white">
                        {trackedReport.category}
                      </h3>
                      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                        {trackedReport.location.address} ({trackedReport.location.ward})
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setModalReport(trackedReport)}
                      className="rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3.5 py-2 text-xs font-semibold text-slate-800 dark:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors whitespace-nowrap"
                    >
                      View Map &amp; Photos
                    </button>
                  </div>

                  <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
                    {trackedReport.description}
                  </p>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 border-t border-slate-200 dark:border-slate-800 pt-4 text-xs">
                    <div>
                      <span className="block text-slate-500 dark:text-slate-400">Assigned Worker</span>
                      <span className="mt-0.5 block font-semibold text-slate-900 dark:text-slate-100">
                        {trackedReport.assignedWorkerName || 'Awaiting Dispatch'}
                      </span>
                    </div>
                    <div>
                      <span className="block text-slate-500 dark:text-slate-400">Field Crew Stage</span>
                      <span className="mt-0.5 block font-semibold text-slate-900 dark:text-slate-100">
                        {trackedReport.workerStatus || 'Pending Dispatch'}
                      </span>
                    </div>
                    <div>
                      <span className="block text-slate-500 dark:text-slate-400">Last Updated</span>
                      <span className="mt-0.5 block font-semibold text-slate-900 dark:text-slate-100 tabular-nums">
                        {formatDateTime(trackedReport.updatedAt)}
                      </span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="rounded-xl border border-dashed border-slate-300 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-950/60 p-8 text-center">
                  <MapPin className="mx-auto h-7 w-7 text-slate-400" />
                  <p className="mt-3 text-sm font-semibold text-slate-800 dark:text-slate-200">
                    No complaint selected yet
                  </p>
                  <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto">
                    Click one of the sample Complaint IDs on the left or type your own generated report ID to inspect its live progress and cleanup verification photos.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Smart Location Tracking — Live Map */}
      <section id="live-map" className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-16 lg:py-20">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-6">
          <div>
            <p className="text-xs font-semibold text-emerald-700 dark:text-emerald-400">
              Smart Location Tracking
            </p>
            <h2 className="mt-1.5 text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
              Live city sanitation operations map
            </h2>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md">
            Powered by Leaflet &amp; OpenStreetMap. Click any status-coded marker to view complaint details and ward location.
          </p>
        </div>

        <CityMap
          mode="markers"
          heightClass="h-[420px]"
          markers={mapPins.map((pin) => ({
            id: pin.report_id,
            reportId: pin.report_id,
            category: pin.category,
            status: pin.status,
            priority: pin.priority,
            address: pin.address,
            ward: pin.ward,
            latitude: pin.latitude,
            longitude: pin.longitude,
          }))}
          onMarkerSelect={(marker) => performTrackLookup(marker.reportId)}
        />
      </section>

      {/* Asymmetric Role Capabilities Grid (Report Garbage, Worker Management, Admin Monitoring) */}
      <section
        id="operations"
        className="border-y border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/50 py-16 lg:py-20"
      >
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="max-w-2xl">
            <p className="text-xs font-semibold text-emerald-700 dark:text-emerald-400">
              Three Purpose-Built Portals
            </p>
            <h2 className="mt-2 text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 dark:text-white text-balance">
              Dedicated workspaces for Citizens, Administrators, and Field Workers
            </h2>
          </div>

          <div className="mt-10 grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 p-7 flex flex-col justify-between gap-6">
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-400 text-sm font-semibold">
                  <ShieldCheck className="h-4 w-4" />
                  <span>Admin Monitoring &amp; Dispatch</span>
                </div>
                <h3 className="text-xl font-bold text-slate-900 dark:text-white">
                  City-wide oversight, priority dispatch, and performance analytics
                </h3>
                <p className="text-sm leading-relaxed text-slate-600 dark:text-slate-400 max-w-2xl">
                  Filter every garbage complaint by status, category, or date range. Inspect citizen photos and GPS pins on an interactive city map, assign workers by zone, verify after-cleanup proof images, manage citizen and worker directories, and monitor ward-level charts.
                </p>
              </div>
              <div>
                <Link
                  to="/auth?role=admin"
                  className="inline-flex items-center gap-2 text-sm font-semibold text-emerald-700 hover:text-emerald-800 dark:text-emerald-400"
                >
                  <span>Open Admin Console</span>
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 p-7 flex flex-col justify-between gap-6">
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-400 text-sm font-semibold">
                  <Users className="h-4 w-4" />
                  <span>Report Garbage (Citizen)</span>
                </div>
                <h3 className="text-xl font-bold text-slate-900 dark:text-white">
                  GPS-tagged reporting in under a minute
                </h3>
                <p className="text-sm leading-relaxed text-slate-600 dark:text-slate-400">
                  Auto-detect current location or place a map pin manually, upload an issue photo, receive a unique complaint ID, and follow real-time status notifications until resolved.
                </p>
              </div>
              <div>
                <Link
                  to="/auth?role=citizen&mode=register"
                  className="inline-flex items-center gap-2 text-sm font-semibold text-emerald-700 hover:text-emerald-800 dark:text-emerald-400"
                >
                  <span>Create Citizen Account</span>
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            </div>

            <div className="lg:col-span-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 p-7 flex flex-col md:flex-row md:items-center justify-between gap-6">
              <div className="space-y-2 max-w-2xl">
                <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-400 text-sm font-semibold">
                  <Truck className="h-4 w-4" />
                  <span>Worker Management &amp; Mobile Field App</span>
                </div>
                <h3 className="text-xl font-bold text-slate-900 dark:text-white">
                  Mobile-friendly Today’s Tasks, route directions, and completion proof
                </h3>
                <p className="text-sm leading-relaxed text-slate-600 dark:text-slate-400">
                  Sanitation workers view assigned sites on a map, calculate live distance and open turn-by-turn directions, advance task stages (Accepted → On the Way → In Progress → Completed), and attach cleanup verification photos.
                </p>
              </div>
              <Link
                to="/auth?role=worker"
                className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-5 py-2.5 text-sm font-semibold text-slate-900 dark:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0"
              >
                <span>Worker Sign In</span>
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Contact Section */}
      <section id="contact" className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-16 lg:py-20">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
          <div className="lg:col-span-5 space-y-4">
            <p className="text-xs font-semibold text-emerald-700 dark:text-emerald-400">
              Municipal Sanitation Desk
            </p>
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
              Need assistance or bulk waste pickup?
            </h2>
            <p className="text-sm leading-relaxed text-slate-600 dark:text-slate-400">
              Contact the Smart City Waste Management operations desk for community drives, ward bin requests, or civic portal inquiries.
            </p>
            <div className="pt-2 space-y-2 text-sm text-slate-700 dark:text-slate-300">
              <p>
                <span className="font-semibold text-slate-900 dark:text-white">Control Room Helpline:</span>{' '}
                <span className="font-mono">1800-11-2400</span>
              </p>
              <p>
                <span className="font-semibold text-slate-900 dark:text-white">Municipal Office:</span>{' '}
                Civic Center, Sanitation Wing, Block B
              </p>
              <p>
                <span className="font-semibold text-slate-900 dark:text-white">Dispatch Hours:</span>{' '}
                Mon–Sun, 06:00 – 22:00
              </p>
            </div>
          </div>

          <div className="lg:col-span-7">
            <form
              onSubmit={handleContactSubmit}
              className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 sm:p-8 space-y-4"
            >
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="contact-name" className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                    Full Name
                  </label>
                  <input
                    id="contact-name"
                    type="text"
                    required
                    value={contactForm.name}
                    onChange={(e) => setContactForm({ ...contactForm, name: e.target.value })}
                    className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3.5 py-2.5 text-sm text-slate-900 dark:text-slate-100 focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-600/20"
                  />
                </div>
                <div>
                  <label htmlFor="contact-email" className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                    Email Address
                  </label>
                  <input
                    id="contact-email"
                    type="email"
                    required
                    value={contactForm.email}
                    onChange={(e) => setContactForm({ ...contactForm, email: e.target.value })}
                    className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3.5 py-2.5 text-sm text-slate-900 dark:text-slate-100 focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-600/20"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="contact-subject" className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  Subject
                </label>
                <input
                  id="contact-subject"
                  type="text"
                  required
                  value={contactForm.subject}
                  onChange={(e) => setContactForm({ ...contactForm, subject: e.target.value })}
                  placeholder="e.g., Request additional recycling bin for Sector 4 Park"
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3.5 py-2.5 text-sm text-slate-900 dark:text-slate-100 focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-600/20"
                />
              </div>

              <div>
                <label htmlFor="contact-message" className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  Message
                </label>
                <textarea
                  id="contact-message"
                  rows={4}
                  required
                  value={contactForm.message}
                  onChange={(e) => setContactForm({ ...contactForm, message: e.target.value })}
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3.5 py-2.5 text-sm text-slate-900 dark:text-slate-100 focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-600/20"
                />
              </div>

              {contactSuccess && (
                <div className="flex items-center gap-2 text-sm text-emerald-700 dark:text-emerald-400">
                  <CheckCircle2 className="h-4 w-4 shrink-0" />
                  <span>{contactSuccess}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={contactSubmitting}
                className="inline-flex items-center gap-2 rounded-lg bg-emerald-700 px-5 py-2.5 text-sm font-semibold text-white hover:bg-emerald-800 dark:bg-emerald-600 dark:hover:bg-emerald-500 disabled:opacity-60 transition-colors"
              >
                <Send className="h-4 w-4" />
                <span>{contactSubmitting ? 'Sending...' : 'Send Inquiry'}</span>
              </button>
            </form>
          </div>
        </div>
      </section>

      {/* Quiet Footer */}
      <footer className="border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500 dark:text-slate-400">
          <div className="flex items-center gap-3">
            <span className="font-bold text-slate-900 dark:text-white text-sm">CivicClean</span>
            <span aria-hidden="true">·</span>
            <span>Location-Based Garbage Management System for Smart City</span>
          </div>
          <div className="flex flex-wrap items-center gap-5">
            <Link to="/auth?role=citizen" className="hover:text-slate-900 dark:hover:text-white">
              Citizen Portal
            </Link>
            <Link to="/auth?role=admin" className="hover:text-slate-900 dark:hover:text-white">
              Admin Console
            </Link>
            <Link to="/auth?role=worker" className="hover:text-slate-900 dark:hover:text-white">
              Worker App
            </Link>
            <button
              type="button"
              onClick={toggleTheme}
              className="hover:text-slate-900 dark:hover:text-white"
            >
              {theme === 'dark' ? 'Switch to Light' : 'Switch to Dark'}
            </button>
          </div>
        </div>
      </footer>

      <ReportDetailModal report={modalReport} onClose={() => setModalReport(null)} />
    </div>
  );
}
