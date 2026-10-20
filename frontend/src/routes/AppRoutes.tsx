import { Routes, Route } from 'react-router-dom';
import { ProtectedRoute } from './ProtectedRoute';
import { BottomNav } from '../components/BottomNav';

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
      <Route path="/login" element={<div>Login</div>} />
      <Route path="/register" element={<div>Registo</div>} />
      <Route
        path="/"
        element={<AuthenticatedLayout><div>Início</div></AuthenticatedLayout>}
      />
      <Route
        path="/map"
        element={<AuthenticatedLayout><div>Mapa</div></AuthenticatedLayout>}
      />
      <Route
        path="/record"
        element={<AuthenticatedLayout><div>Registar</div></AuthenticatedLayout>}
      />
      <Route
        path="/activities"
        element={<AuthenticatedLayout><div>Actividades</div></AuthenticatedLayout>}
      />
      <Route
        path="/profile"
        element={<AuthenticatedLayout><div>Perfil</div></AuthenticatedLayout>}
      />
    </Routes>
  );
}
