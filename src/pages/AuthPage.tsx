import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Moon, ShieldCheck, Sun, Truck, User } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { useToast } from '../context/ToastContext';
import { CITY_WARDS, type UserRole } from '../types';

export function AuthPage() {
  const [searchParams] = useSearchParams();
  const initialRole = (searchParams.get('role') as UserRole) || 'citizen';
  const initialMode = searchParams.get('mode') === 'register' ? 'register' : 'login';

  const { user, adminClaimed, envPasscodeConfigured, statusLoading, login, register, bootstrapAdmin } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const { notify } = useToast();
  const navigate = useNavigate();

  const [role, setRole] = useState<UserRole>(
    ['citizen', 'admin', 'worker'].includes(initialRole) ? initialRole : 'citizen'
  );
  const [mode, setMode] = useState<'login' | 'register'>(
    initialRole === 'citizen' ? initialMode : 'login'
  );

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [zone, setZone] = useState(CITY_WARDS[0]);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (user) {
      if (user.role === 'admin') navigate('/admin', { replace: true });
      else if (user.role === 'worker') navigate('/worker', { replace: true });
      else navigate('/citizen', { replace: true });
    }
  }, [user, navigate]);

  const showAdminBootstrap = role === 'admin' && !statusLoading && !adminClaimed && !envPasscodeConfigured;

  const handleRoleSwitch = (nextRole: UserRole) => {
    setRole(nextRole);
    setError('');
    if (nextRole !== 'citizen') {
      setMode('login');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);

    try {
      if (showAdminBootstrap) {
        const admin = await bootstrapAdmin({ name, email, password, phone });
        notify(`Welcome, ${admin.name}. Municipal Admin account initialized.`, 'success');
        navigate('/admin', { replace: true });
        return;
      }

      if (role === 'citizen' && mode === 'register') {
        const created = await register({ name, email, password, phone, zone });
        notify(`Account created. Welcome, ${created.name}.`, 'success');
        navigate('/citizen', { replace: true });
        return;
      }

      const signedIn = await login(email, password, role);
      notify(`Signed in as ${signedIn.name}.`, 'success');
      if (signedIn.role === 'admin') navigate('/admin', { replace: true });
      else if (signedIn.role === 'worker') navigate('/worker', { replace: true });
      else navigate('/citizen', { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Authentication failed.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col">
      <header className="border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950">
        <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-4 sm:px-6">
          <Link
            to="/"
            className="inline-flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Back to CivicClean</span>
          </Link>
          <button
            type="button"
            onClick={toggleTheme}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-800 px-3 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-900 transition-colors"
          >
            {theme === 'dark' ? <Sun className="h-3.5 w-3.5" /> : <Moon className="h-3.5 w-3.5" />}
            <span>{theme === 'dark' ? 'Light' : 'Dark'}</span>
          </button>
        </div>
      </header>

      <main className="flex-1 flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-md rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 sm:p-8 shadow-sm">
          <div className="mb-6">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
              {showAdminBootstrap
                ? 'Initialize Admin Account'
                : role === 'citizen' && mode === 'register'
                ? 'Citizen Registration'
                : 'Portal Sign In'}
            </h1>
            <p className="mt-1.5 text-sm text-slate-600 dark:text-slate-400">
              {showAdminBootstrap
                ? 'Set up the primary Municipal Administrator account to manage complaints, workers, and analytics.'
                : 'Select your role to access the Smart City Waste Management platform.'}
            </p>
          </div>

          {/* Role selector segmented control */}
          <div className="grid grid-cols-3 gap-1 rounded-lg bg-slate-100 dark:bg-slate-950 p-1 mb-6">
            {(
              [
                { id: 'citizen', label: 'Citizen', icon: User },
                { id: 'admin', label: 'Admin', icon: ShieldCheck },
                { id: 'worker', label: 'Worker', icon: Truck },
              ] as const
            ).map((tab) => {
              const Icon = tab.icon;
              const active = role === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => handleRoleSwitch(tab.id)}
                  className={`flex items-center justify-center gap-1.5 rounded-md px-3 py-2 text-xs font-semibold transition-colors whitespace-nowrap ${
                    active
                      ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                  }`}
                >
                  <Icon className="h-3.5 w-3.5" />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>

          {role === 'citizen' && (
            <div className="mb-5 flex items-center gap-4 border-b border-slate-200 dark:border-slate-800 pb-3 text-sm">
              <button
                type="button"
                onClick={() => {
                  setMode('login');
                  setError('');
                }}
                className={`font-semibold pb-1 border-b-2 transition-colors ${
                  mode === 'login'
                    ? 'border-emerald-700 text-emerald-700 dark:border-emerald-400 dark:text-emerald-400'
                    : 'border-transparent text-slate-500 hover:text-slate-800 dark:text-slate-400'
                }`}
              >
                Sign In
              </button>
              <button
                type="button"
                onClick={() => {
                  setMode('register');
                  setError('');
                }}
                className={`font-semibold pb-1 border-b-2 transition-colors ${
                  mode === 'register'
                    ? 'border-emerald-700 text-emerald-700 dark:border-emerald-400 dark:text-emerald-400'
                    : 'border-transparent text-slate-500 hover:text-slate-800 dark:text-slate-400'
                }`}
              >
                Create Account
              </button>
            </div>
          )}

          {showAdminBootstrap && (
            <div className="mb-5 rounded-lg border border-emerald-200 dark:border-emerald-900/60 bg-emerald-50/70 dark:bg-emerald-950/30 p-3.5 text-xs leading-relaxed text-emerald-900 dark:text-emerald-200">
              <strong>First-Run Setup:</strong> No administrator account exists yet. Create your municipal admin login below; this setup form automatically locks once claimed.
            </div>
          )}

          {role === 'worker' && (
            <div className="mb-5 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 p-3.5 text-xs leading-relaxed text-slate-600 dark:text-slate-400">
              Sanitation field worker accounts and passwords are created by the Municipal Administrator inside the <strong>Admin Console → Workers</strong> panel.
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {(showAdminBootstrap || (role === 'citizen' && mode === 'register')) && (
              <div>
                <label htmlFor="auth-name" className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  Full Name
                </label>
                <input
                  id="auth-name"
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Enter full name"
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3.5 py-2.5 text-sm text-slate-900 dark:text-slate-100 focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-600/20"
                />
              </div>
            )}

            <div>
              <label htmlFor="auth-email" className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Email Address
              </label>
              <input
                id="auth-email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@example.com"
                className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3.5 py-2.5 text-sm text-slate-900 dark:text-slate-100 focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-600/20"
              />
            </div>

            {(showAdminBootstrap || (role === 'citizen' && mode === 'register')) && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label htmlFor="auth-phone" className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                    Phone Number
                  </label>
                  <input
                    id="auth-phone"
                    type="tel"
                    required={!showAdminBootstrap}
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+91 98100 00000"
                    className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3.5 py-2.5 text-sm text-slate-900 dark:text-slate-100 focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-600/20"
                  />
                </div>
                {role === 'citizen' && (
                  <div>
                    <label htmlFor="auth-zone" className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                      City Ward
                    </label>
                    <select
                      id="auth-zone"
                      value={zone}
                      onChange={(e) => setZone(e.target.value)}
                      className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2.5 text-sm text-slate-900 dark:text-slate-100 focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-600/20"
                    >
                      {CITY_WARDS.map((w) => (
                        <option key={w} value={w}>
                          {w}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
            )}

            <div>
              <label htmlFor="auth-password" className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                {showAdminBootstrap ? 'Create Admin Password (min 8 chars)' : 'Password'}
              </label>
              <input
                id="auth-password"
                type="password"
                required
                minLength={showAdminBootstrap ? 8 : 6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3.5 py-2.5 text-sm text-slate-900 dark:text-slate-100 focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-600/20"
              />
            </div>

            {error && (
              <p className="rounded-lg border border-red-200 dark:border-red-900/60 bg-red-50 dark:bg-red-950/40 px-3.5 py-2.5 text-xs text-red-700 dark:text-red-300" role="alert">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="w-full rounded-lg bg-emerald-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-800 dark:bg-emerald-600 dark:hover:bg-emerald-500 disabled:opacity-60 transition-colors"
            >
              {submitting
                ? 'Please wait...'
                : showAdminBootstrap
                ? 'Claim Admin Account'
                : role === 'citizen' && mode === 'register'
                ? 'Create Citizen Account'
                : `Sign In as ${role.charAt(0).toUpperCase() + role.slice(1)}`}
            </button>
          </form>
        </div>
      </main>
    </div>
  );
}
