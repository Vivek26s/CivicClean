import React from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import { ToastProvider } from './context/ToastContext';
import { HomePage } from './pages/HomePage';
import { AuthPage } from './pages/AuthPage';
import { CitizenDashboard } from './pages/CitizenDashboard';
import { AdminDashboard } from './pages/AdminDashboard';
import { WorkerDashboard } from './pages/WorkerDashboard';
import type { UserRole } from './types';

function ProtectedRoute({
  allowedRole,
  children,
}: {
  allowedRole: UserRole;
  children: React.ReactNode;
}) {
  const { user } = useAuth();
  if (!user) {
    return <Navigate to={`/auth?role=${allowedRole}`} replace />;
  }
  if (user.role !== allowedRole) {
    return <Navigate to={`/${user.role}`} replace />;
  }
  return <>{children}</>;
}

export default function App() {
  return (
    <ThemeProvider>
      <ToastProvider>
        <AuthProvider>
          <BrowserRouter>
            <Routes>
              <Route path="/" element={<HomePage />} />
              <Route path="/auth" element={<AuthPage />} />
              <Route
                path="/citizen"
                element={
                  <ProtectedRoute allowedRole="citizen">
                    <CitizenDashboard />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/admin"
                element={
                  <ProtectedRoute allowedRole="admin">
                    <AdminDashboard />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/worker"
                element={
                  <ProtectedRoute allowedRole="worker">
                    <WorkerDashboard />
                  </ProtectedRoute>
                }
              />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </BrowserRouter>
        </AuthProvider>
      </ToastProvider>
    </ThemeProvider>
  );
}
