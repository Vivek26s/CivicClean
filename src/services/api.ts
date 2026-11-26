import type {
  CitizenRecord,
  DashboardStats,
  NotificationItem,
  PublicMapPin,
  PublicStats,
  PublicTrackedReport,
  ReportItem,
  ReportPriority,
  ReportStatus,
  User,
  UserRole,
  WorkerAvailability,
  WorkerRecord,
  WorkerTaskStatus,
} from '../types';

// Keep JWT token strictly in JS memory (never localStorage or sessionStorage)
let inMemoryToken: string | null = null;

export function setAuthToken(token: string | null): void {
  inMemoryToken = token;
}

export function getAuthToken(): string | null {
  return inMemoryToken;
}

async function request<T>(url: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers || {});
  if (inMemoryToken) {
    headers.set('Authorization', `Bearer ${inMemoryToken}`);
  }
  if (!(options.body instanceof FormData) && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  const response = await fetch(url, {
    ...options,
    headers,
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error || `Request failed (${response.status})`);
  }
  return data as T;
}

export const api = {
  // Public
  getPublicStats: () => request<PublicStats>('/api/public/stats'),
  getPublicMap: () => request<{ reports: PublicMapPin[] }>('/api/public/map'),
  trackReport: (reportId: string) =>
    request<{ report: PublicTrackedReport }>(`/api/public/track/${encodeURIComponent(reportId.trim())}`),
  submitContact: (payload: { name: string; email: string; subject: string; message: string }) =>
    request<{ message: string }>('/api/public/contact', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  // Auth
  getAuthStatus: () => request<{ adminClaimed: boolean; envPasscodeConfigured: boolean }>('/api/auth/status'),
  bootstrapAdmin: (payload: { name: string; email: string; password: string; phone?: string }) =>
    request<{ token: string; user: User; message: string }>('/api/auth/bootstrap-admin', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  register: (payload: { name: string; email: string; password: string; phone: string; zone?: string }) =>
    request<{ token: string; user: User; message: string }>('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  login: (payload: { email: string; password: string; role?: UserRole }) =>
    request<{ token: string; user: User }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  getMe: () => request<{ user: User }>('/api/auth/me'),
  updateProfile: (payload: { name: string; phone: string; zone: string }) =>
    request<{ user: User; message: string }>('/api/auth/profile', {
      method: 'PUT',
      body: JSON.stringify(payload),
    }),

  // Reports
  getReports: (filters?: {
    status?: string;
    category?: string;
    priority?: string;
    search?: string;
    dateFrom?: string;
    dateTo?: string;
  }) => {
    const params = new URLSearchParams();
    if (filters?.status && filters.status !== 'All') params.set('status', filters.status);
    if (filters?.category && filters.category !== 'All') params.set('category', filters.category);
    if (filters?.priority && filters.priority !== 'All') params.set('priority', filters.priority);
    if (filters?.search) params.set('search', filters.search);
    if (filters?.dateFrom) params.set('dateFrom', filters.dateFrom);
    if (filters?.dateTo) params.set('dateTo', filters.dateTo);
    const qs = params.toString();
    return request<{ reports: ReportItem[] }>(`/api/reports${qs ? `?${qs}` : ''}`);
  },
  getReportById: (id: number | string) => request<{ report: ReportItem }>(`/api/reports/${encodeURIComponent(String(id))}`),
  createReport: (formData: FormData) =>
    request<{ report: ReportItem; message: string }>('/api/reports', {
      method: 'POST',
      body: formData,
    }),
  updateReport: (
    id: number,
    payload: { status?: ReportStatus; priority?: ReportPriority; adminNotes?: string; ward?: string }
  ) =>
    request<{ report: ReportItem; message: string }>(`/api/reports/${id}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    }),
  assignWorker: (
    id: number,
    payload: { workerId: number; priority?: ReportPriority; adminNotes?: string }
  ) =>
    request<{ report: ReportItem; message: string }>(`/api/reports/${id}/assign`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    }),
  updateReportStatus: (id: number, payload: { status: ReportStatus; adminNotes?: string }) =>
    request<{ report: ReportItem; message: string }>(`/api/reports/${id}/status`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    }),
  workerUpdateTask: (id: number, formData: FormData) =>
    request<{ report: ReportItem; message: string }>(`/api/reports/${id}/worker-update`, {
      method: 'PUT',
      body: formData,
    }),
  deleteReport: (id: number) =>
    request<{ message: string }>(`/api/reports/${id}`, {
      method: 'DELETE',
    }),

  // Workers & Citizens
  getWorkers: () => request<{ workers: WorkerRecord[] }>('/api/workers'),
  createWorker: (payload: {
    name: string;
    email: string;
    password: string;
    phone: string;
    zone: string;
    availability?: WorkerAvailability;
  }) =>
    request<{ worker: WorkerRecord; message: string }>('/api/workers', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  updateWorker: (
    id: number,
    payload: {
      name?: string;
      phone?: string;
      zone?: string;
      availability?: WorkerAvailability;
      password?: string;
    }
  ) =>
    request<{ worker: WorkerRecord; message: string }>(`/api/workers/${id}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    }),
  deleteWorker: (id: number) =>
    request<{ message: string }>(`/api/workers/${id}`, {
      method: 'DELETE',
    }),
  updateMyAvailability: (availability: WorkerAvailability) =>
    request<{ message: string; availability: WorkerAvailability }>('/api/workers/me/availability', {
      method: 'PUT',
      body: JSON.stringify({ availability }),
    }),
  getCitizens: () => request<{ citizens: CitizenRecord[] }>('/api/citizens'),

  // Analytics & Notifications
  getDashboardStats: () => request<DashboardStats>('/api/dashboard/stats'),
  getNotifications: () => request<{ notifications: NotificationItem[] }>('/api/notifications'),
  markNotificationRead: (id: number) =>
    request<{ message: string }>(`/api/notifications/${id}/read`, { method: 'PUT' }),
  markAllNotificationsRead: () =>
    request<{ message: string }>('/api/notifications/read-all', { method: 'PUT' }),
};

export type { WorkerTaskStatus };
