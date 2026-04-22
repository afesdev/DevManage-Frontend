import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuthStore } from '@/store/auth.store';

export function ProtectedRoute() {
  const token = useAuthStore((s) => s.token);
  const location = useLocation();

  if (!token) {
    return <Navigate to="/auth" replace state={{ from: location }} />;
  }

  return <Outlet />;
}
