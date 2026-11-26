export type UserRole = 'citizen' | 'admin' | 'worker';

export type GarbageCategory =
  | 'Overflowing Dustbin'
  | 'Garbage on Road'
  | 'Garbage Near Park'
  | 'Garbage on Empty Plot'
  | 'Other';

export type ReportStatus = 'Pending' | 'Assigned' | 'In Progress' | 'Resolved' | 'Rejected';
export type WorkerTaskStatus = 'Accepted' | 'On the Way' | 'In Progress' | 'Completed';
export type ReportPriority = 'Low' | 'Medium' | 'High' | 'Critical';
export type WorkerAvailability = 'available' | 'busy' | 'off_duty';

export const GARBAGE_CATEGORIES: GarbageCategory[] = [
  'Overflowing Dustbin',
  'Garbage on Road',
  'Garbage Near Park',
  'Garbage on Empty Plot',
  'Other',
];

export const REPORT_STATUSES: ReportStatus[] = [
  'Pending',
  'Assigned',
  'In Progress',
  'Resolved',
  'Rejected',
];

export const WORKER_TASK_STATUSES: WorkerTaskStatus[] = [
  'Accepted',
  'On the Way',
  'In Progress',
  'Completed',
];

export const REPORT_PRIORITIES: ReportPriority[] = ['Low', 'Medium', 'High', 'Critical'];

export const CITY_WARDS: string[] = [
  'Central Ward',
  'East Residential Ward',
  'Green Park Ward',
  'Market Square Ward',
  'West Sector Ward',
  'North Civic Zone',
];

export interface User {
  id: number;
  name: string;
  email: string;
  phone: string;
  role: UserRole;
  zone: string;
  availability: WorkerAvailability;
  createdAt: string;
}

export interface ReportLocation {
  latitude: number;
  longitude: number;
  address: string;
  ward: string;
}

export interface ReportItem {
  id: number;
  reportId: string;
  userId: number;
  citizen: {
    name: string;
    email: string;
    phone: string;
  };
  category: GarbageCategory;
  description: string;
  image: string | null;
  location: ReportLocation;
  status: ReportStatus;
  workerStatus: WorkerTaskStatus | null;
  priority: ReportPriority;
  assignedWorker: {
    id: number;
    name: string;
    phone: string;
    zone: string;
  } | null;
  adminNotes: string;
  completionImage: string | null;
  completionNotes: string;
  createdAt: string;
  updatedAt: string;
  resolvedAt: string | null;
}

export interface PublicTrackedReport {
  reportId: string;
  category: GarbageCategory;
  description: string;
  image: string | null;
  location: ReportLocation;
  status: ReportStatus;
  workerStatus: WorkerTaskStatus | null;
  priority: ReportPriority;
  assignedWorkerName: string | null;
  adminNotes: string;
  completionImage: string | null;
  completionNotes: string;
  createdAt: string;
  updatedAt: string;
  resolvedAt: string | null;
}

export interface PublicMapPin {
  report_id: string;
  category: GarbageCategory;
  status: ReportStatus;
  priority: ReportPriority;
  latitude: number;
  longitude: number;
  address: string;
  ward: string;
  created_at: string;
}

export interface WorkerRecord {
  id: number;
  name: string;
  email: string;
  phone: string;
  zone: string;
  availability: WorkerAvailability;
  createdAt: string;
  hasCredentials: number;
  activeTasks: number;
  completedTasks: number;
  totalTasks: number;
}

export interface CitizenRecord {
  id: number;
  name: string;
  email: string;
  phone: string;
  zone: string;
  createdAt: string;
  totalReports: number;
  resolvedReports: number;
}

export interface DashboardStats {
  summary: {
    totalReports: number;
    pendingReports: number;
    assignedReports: number;
    inProgressReports: number;
    resolvedReports: number;
    rejectedReports: number;
    awaitingVerification: number;
    totalWorkers: number;
    availableWorkers: number;
    totalCitizens: number;
    resolutionRate: number;
  };
  byCategory: Array<{ category: string; count: number }>;
  byLocation: Array<{ location: string; total: number; resolved: number; active: number }>;
  byPriority: Array<{ priority: string; count: number }>;
  dailyTrend: Array<{ day: string; submitted: number; resolved: number }>;
}

export interface PublicStats {
  totalReports: number;
  resolvedReports: number;
  activeOperations: number;
  totalWorkers: number;
  wardsCovered: number;
  resolutionRate: number;
}

export interface NotificationItem {
  id: number;
  reportId: string | null;
  message: string;
  type: 'info' | 'success' | 'warning' | 'alert';
  read: number;
  createdAt: string;
}
