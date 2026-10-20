import { Routes, Route } from 'react-router-dom';
import { ProtectedRoute } from './ProtectedRoute';
import { BottomNav } from '../components/BottomNav';
import LoginPage from '../pages/LoginPage';
import RegisterPage from '../pages/RegisterPage';
import HomePage from '../pages/HomePage';
import MapPage from '../pages/MapPage';
import RecordPage from '../pages/RecordPage';
import ActivitiesPage from '../pages/ActivitiesPage';
import ProfilePage from '../pages/ProfilePage';

function AuthenticatedLayout({ children }: { children: React.ReactNode }) {
  return (
    <ProtectedRoute>
      <div className="pb-16">{children}</div>
      <BottomNav />
    </ProtectedRoute>
  );
}

export function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route path="/" element={<AuthenticatedLayout><HomePage /></AuthenticatedLayout>} />
      <Route path="/map" element={<AuthenticatedLayout><MapPage /></AuthenticatedLayout>} />
      <Route path="/record" element={<AuthenticatedLayout><RecordPage /></AuthenticatedLayout>} />
      <Route
        path="/activities"
        element={<AuthenticatedLayout><ActivitiesPage /></AuthenticatedLayout>}
      />
      <Route path="/profile" element={<AuthenticatedLayout><ProfilePage /></AuthenticatedLayout>} />
    </Routes>
  );
}
