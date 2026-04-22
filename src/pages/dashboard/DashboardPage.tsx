import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, LayoutDashboard } from 'lucide-react';
import { authService } from '../../services/auth.service';
import { tableroService } from '../../services/tablero.service';
import { useAuthStore } from '../../store/auth.store';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import { Separator } from '../../components/ui/separator';

export function DashboardPage() {
  const token = useAuthStore((s) => s.token);
  const proyectoActivoId = useAuthStore((s) => s.proyectoActivoId);
  const navigate = useNavigate();

  const perfil = useQuery({
    queryKey: ['perfil', token],
    queryFn: () => authService.me(token as string),
    enabled: Boolean(token),
  });

  const proyectos = useQuery({
    queryKey: ['proyectos', token],
    queryFn: () => tableroService.obtenerProyectos(token as string),
    enabled: Boolean(token),
  });

  const totalProyectos = proyectos.data?.length ?? 0;
  const proyectosActivos =
    proyectos.data?.filter((proyecto) => proyecto.estado === 'activo').length ?? 0;
  const proyectosArchivados =
    proyectos.data?.filter((proyecto) => proyecto.estado === 'archivado').length ?? 0;

  const saludo = useMemo(() => {
    if (!perfil.data?.nombre_visible) {
      return 'Bienvenido';
    }
    return `Hola, ${perfil.data.nombre_visible}`;
  }, [perfil.data?.nombre_visible]);

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm text-stone-500">{perfil.isLoading ? 'Cargando perfil...' : saludo}</p>
        <h1 className="flex items-center gap-2 text-2xl font-semibold">
          <LayoutDashboard size={20} className="text-purple-600" />
          Dashboard
        </h1>
        <div className="mt-3">
          <Button
            onClick={() =>
              navigate(proyectoActivoId ? `/tablero/${proyectoActivoId}` : '/proyectos')
            }
          >
            {proyectoActivoId ? 'Ir al tablero activo' : 'Elegir proyecto para comenzar'}
            <ArrowRight size={16} />
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardDescription>Total proyectos</CardDescription>
            <CardTitle className="mt-2 text-3xl">{totalProyectos}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>Activos</CardDescription>
            <CardTitle className="mt-2 text-3xl text-teal-700">{proyectosActivos}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>Archivados</CardDescription>
            <CardTitle className="mt-2 text-3xl text-amber-700">{proyectosArchivados}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-4">
          <div>
            <CardTitle>Mis proyectos</CardTitle>
            <CardDescription>Listado de proyectos visibles en tu cuenta</CardDescription>
          </div>
          {proyectos.isLoading ? <Badge>Cargando...</Badge> : <Badge>{totalProyectos} resultados</Badge>}
        </CardHeader>
        <CardContent>
          <Separator className="mb-4" />
          <div className="space-y-3">
            {(proyectos.data ?? []).map((proyecto) => (
              <div
                key={proyecto.proyecto_id}
                className="rounded-xl border border-stone-200 px-4 py-3 transition hover:border-purple-300 hover:bg-purple-50/40"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-medium">{proyecto.nombre}</p>
                  <Badge>{proyecto.estado}</Badge>
                </div>
                <p className="mt-1 text-sm text-stone-500">Rol: {proyecto.rol}</p>
                {proyecto.descripcion ? (
                  <p className="mt-1 text-sm text-stone-600">{proyecto.descripcion}</p>
                ) : null}
              </div>
            ))}
            {!proyectos.isLoading && totalProyectos === 0 ? (
              <p className="rounded-xl border border-dashed border-stone-300 bg-stone-50 px-4 py-5 text-sm text-stone-500">
                Aun no tienes proyectos vinculados.
              </p>
            ) : null}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
