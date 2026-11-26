import express from 'express';
import {
  bootstrapAdmin,
  getAuthStatus,
  getMe,
  login,
  registerCitizen,
  updateProfile,
} from '../controllers/authController.ts';
import {
  assignWorker,
  createReport,
  deleteReport,
  getPublicMapReports,
  getReportById,
  getReports,
  trackPublicReport,
  updateReport,
  updateReportStatus,
  workerUpdateTask,
} from '../controllers/reportController.ts';
import {
  createWorker,
  deleteWorker,
  getCitizens,
  getWorkers,
  updateMyAvailability,
  updateWorker,
} from '../controllers/workerController.ts';
import {
  getDashboardStats,
  getNotifications,
  getPublicStats,
  markAllNotificationsRead,
  markNotificationRead,
  submitContactMessage,
} from '../controllers/dashboardController.ts';
import { authenticate, authorize } from '../middleware/auth.ts';
import { uploadImage } from '../middleware/upload.ts';

const router = express.Router();

// Public routes
router.get('/public/stats', getPublicStats);
router.get('/public/map', getPublicMapReports);
router.get('/public/track/:reportId', trackPublicReport);
router.post('/public/contact', submitContactMessage);

// Auth routes
router.get('/auth/status', getAuthStatus);
router.post('/auth/bootstrap-admin', bootstrapAdmin);
router.post('/auth/register', registerCitizen);
router.post('/auth/login', login);
router.get('/auth/me', authenticate, getMe);
router.put('/auth/profile', authenticate, updateProfile);

// Reports routes
router.post('/reports', authenticate, authorize('citizen', 'admin'), uploadImage.single('image'), createReport);
router.get('/reports', authenticate, getReports);
router.get('/reports/:id', authenticate, getReportById);
router.put('/reports/:id', authenticate, authorize('admin'), updateReport);
router.delete('/reports/:id', authenticate, authorize('admin'), deleteReport);
router.put('/reports/:id/assign', authenticate, authorize('admin'), assignWorker);
router.put('/reports/:id/status', authenticate, authorize('admin'), updateReportStatus);
router.put(
  '/reports/:id/worker-update',
  authenticate,
  authorize('worker', 'admin'),
  uploadImage.single('completionImage'),
  workerUpdateTask
);

// Workers & Citizens routes
router.get('/workers', authenticate, authorize('admin'), getWorkers);
router.post('/workers', authenticate, authorize('admin'), createWorker);
router.put('/workers/me/availability', authenticate, authorize('worker'), updateMyAvailability);
router.put('/workers/:id', authenticate, authorize('admin'), updateWorker);
router.delete('/workers/:id', authenticate, authorize('admin'), deleteWorker);
router.get('/citizens', authenticate, authorize('admin'), getCitizens);

// Dashboard analytics & Notifications
router.get('/dashboard/stats', authenticate, authorize('admin'), getDashboardStats);
router.get('/notifications', authenticate, getNotifications);
router.put('/notifications/read-all', authenticate, markAllNotificationsRead);
router.put('/notifications/:id/read', authenticate, markNotificationRead);

export default router;
