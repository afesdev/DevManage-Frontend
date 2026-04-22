import { Navigate, Route, Routes } from 'react-router-dom';
import { AppLayout } from './components/layout/AppLayout';
import { ProtectedRoute } from './components/routing/ProtectedRoute';
import { AuthPage } from './pages/auth/AuthPage';
import { DocumentosPage } from './pages/documentos/DocumentosPage';
import { DashboardPage } from './pages/dashboard/DashboardPage';
import { GithubPage } from './pages/github/GithubPage';
import { GithubRepositorioPage } from './pages/github/GithubRepositorioPage';
import { ProyectosPage } from './pages/proyectos/ProyectosPage';
import { TableroPage } from './pages/tablero/TableroPage';
import { Toaster } from './components/ui/toaster';

function App() {
  return (
    <>
      <Routes>
        <Route path="/auth" element={<AuthPage />} />
        <Route element={<ProtectedRoute />}>
          <Route element={<AppLayout />}>
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/tablero" element={<Navigate to="/proyectos" replace />} />
            <Route path="/tablero/:proyectoId" element={<TableroPage />} />
            <Route path="/proyectos" element={<ProyectosPage />} />
            <Route path="/documentos" element={<DocumentosPage />} />
            <Route path="/github" element={<GithubPage />} />
            <Route
              path="/github/repositorios/:repositorioId"
              element={<GithubRepositorioPage />}
            />
          </Route>
        </Route>
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
      <Toaster />
    </>
  );
}

export default App;
