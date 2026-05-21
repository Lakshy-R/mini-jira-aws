import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';

import LandingPage   from '../pages/LandingPage';
import LoginPage     from '../pages/LoginPage';
import DashboardPage from '../pages/DashboardPage';
import ProjectsPage  from '../pages/ProjectsPage';
import AppLayout     from '../components/layout/AppLayout';
import { useAuthStore } from '../store/auth.store';

function ProtectedRoute({ children }) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return <AppLayout>{children}</AppLayout>;
}

export default function AppRouter() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Public */}
        <Route path="/"      element={<LandingPage />} />
        <Route path="/login" element={<LoginPage />} />

        {/* Protected */}
        <Route path="/dashboard" element={<ProtectedRoute><DashboardPage /></ProtectedRoute>} />
        <Route path="/projects"  element={<ProtectedRoute><ProjectsPage /></ProtectedRoute>} />

        {/* Fallback */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
