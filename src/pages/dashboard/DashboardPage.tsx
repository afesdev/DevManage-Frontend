import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, CalendarClock, FolderKanban, LayoutDashboard, ListTodo } from 'lucide-react';
import { authService } from '../../services/auth.service';
import { tableroService } from '../../services/tablero.service';
import { useAuthStore } from '../../store/auth.store';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import { Separator } from '../../components/ui/separator';
import { Bar, BarChart, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useState } from 'react';

export function DashboardPage() {
  const token = useAuthStore((s) => s.token);
  const proyectoActivoId = useAuthStore((s) => s.proyectoActivoId);
  const navigate = useNavigate();
  const [rangoDashboard, setRangoDashboard] = useState<'7d' | '30d' | 'todo'>('30d');

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
  const columnas = useQuery({
    queryKey: ['dashboard-columnas', proyectoActivoId, token],
    queryFn: () => tableroService.obtenerColumnas(proyectoActivoId as string, token as string),
    enabled: Boolean(token && proyectoActivoId),
  });
  const tareas = useQuery({
    queryKey: ['dashboard-tareas', proyectoActivoId, token],
    queryFn: () => tableroService.obtenerTareas(proyectoActivoId as string, token as string),
    enabled: Boolean(token && proyectoActivoId),
  });

  const totalProyectos = proyectos.data?.length ?? 0;
  const proyectosActivos =
    proyectos.data?.filter((proyecto) => proyecto.estado === 'activo').length ?? 0;
  const proyectosArchivados =
    proyectos.data?.filter((proyecto) => proyecto.estado === 'archivado').length ?? 0;
  const proyectosPausados =
    proyectos.data?.filter((proyecto) => proyecto.estado === 'pausado').length ?? 0;
  const proyectoActivo = (proyectos.data ?? []).find((p) => p.proyecto_id === proyectoActivoId);
  const columnasFinales = (columnas.data ?? []).filter((c) => c.es_estado_final).map((c) => c.columna_id);
  const tareasEnRango = useMemo(() => {
    const todas = tareas.data ?? [];
    if (rangoDashboard === 'todo') return todas;
    const dias = rangoDashboard === '7d' ? 7 : 30;
    const limite = Date.now() - dias * 24 * 60 * 60 * 1000;
    return todas.filter((t) => {
      const ref = new Date(t.actualizado_en || t.creado_en).getTime();
      return Number.isFinite(ref) && ref >= limite;
    });
  }, [tareas.data, rangoDashboard]);
  const totalTareas = tareasEnRango.length;
  const tareasCompletadas =
    tareasEnRango.filter((t) => columnasFinales.includes(t.columna_id) || Boolean(t.completado_en)).length;
  const tareasPendientes = Math.max(totalTareas - tareasCompletadas, 0);
  const tareasCriticas = tareasEnRango.filter((t) => t.prioridad === 'critica').length;
  const hoy = new Date();
  const tareasVencidas = tareasEnRango.filter((t) => {
    if (!t.fecha_limite) return false;
    if (columnasFinales.includes(t.columna_id) || t.completado_en) return false;
    return new Date(t.fecha_limite) < hoy;
  }).length;
  const proximosVencimientos = useMemo(
    () =>
      [...tareasEnRango]
        .filter((t) => Boolean(t.fecha_limite) && !columnasFinales.includes(t.columna_id) && !t.completado_en)
        .sort((a, b) => new Date(a.fecha_limite as string).getTime() - new Date(b.fecha_limite as string).getTime())
        .slice(0, 5),
    [tareasEnRango, columnasFinales],
  );
  const tareasPorPrioridad = useMemo(() => {
    const base = [
      { key: 'critica', label: 'Crítica', total: 0, color: '#dc2626' },
      { key: 'alta', label: 'Alta', total: 0, color: '#f97316' },
      { key: 'media', label: 'Media', total: 0, color: '#f59e0b' },
      { key: 'baja', label: 'Baja', total: 0, color: '#16a34a' },
    ];
    for (const t of tareasEnRango) {
      const item = base.find((i) => i.key === t.prioridad);
      if (item) item.total += 1;
    }
    return base;
  }, [tareasEnRango]);
  const tareasPorTipo = useMemo(() => {
    const base = [
      { key: 'tarea', label: 'Tarea', total: 0, color: '#6366f1' },
      { key: 'subtarea', label: 'Subtarea', total: 0, color: '#0ea5e9' },
      { key: 'error', label: 'Error', total: 0, color: '#ef4444' },
    ];
    for (const t of tareasEnRango) {
      const item = base.find((i) => i.key === t.tipo);
      if (item) item.total += 1;
    }
    return base.filter((i) => i.total > 0);
  }, [tareasEnRango]);

  const saludo = useMemo(() => {
    if (!perfil.data?.nombre_visible) {
      return 'Bienvenido';
    }
    return `Hola, ${perfil.data.nombre_visible}`;
  }, [perfil.data?.nombre_visible]);

  return (
    <div className="space-y-5">
      <div>
        <p className="text-sm text-stone-500">{perfil.isLoading ? 'Cargando perfil...' : saludo}</p>
        <h1 className="flex items-center gap-2 text-2xl font-semibold text-stone-900">
          <LayoutDashboard size={20} className="text-purple-600" />
          Dashboard
        </h1>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Button
            onClick={() =>
              navigate(proyectoActivoId ? `/tablero/${proyectoActivoId}` : '/proyectos')
            }
          >
            {proyectoActivoId ? 'Ir al tablero activo' : 'Elegir proyecto para comenzar'}
            <ArrowRight size={16} />
          </Button>
          <Badge variant="outline">
            GitHub {perfil.data?.github_conectado ? 'conectado' : 'no conectado'}
          </Badge>
          {proyectoActivo ? <Badge>{proyectoActivo.nombre}</Badge> : null}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
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
        <Card>
          <CardHeader>
            <CardDescription>Pausados</CardDescription>
            <CardTitle className="mt-2 text-3xl text-stone-700">{proyectosPausados}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-4">
          <div>
            <CardTitle>Resumen del proyecto activo</CardTitle>
            <CardDescription>
              {proyectoActivo ? proyectoActivo.nombre : 'Selecciona un proyecto para ver sus métricas'}
            </CardDescription>
          </div>
          {proyectoActivo ? (
            <Button size="sm" variant="outline" onClick={() => navigate(`/tablero/${proyectoActivo.proyecto_id}`)}>
              <FolderKanban size={14} />
              Abrir tablero
            </Button>
          ) : null}
        </CardHeader>
        <CardContent>
          {!proyectoActivo ? (
            <p className="rounded-xl border border-dashed border-stone-300 bg-stone-50 px-4 py-5 text-sm text-stone-500">
              No hay proyecto activo seleccionado. Ve a proyectos y elige uno para ver su resumen.
            </p>
          ) : (
            <>
              <div className="grid gap-3 md:grid-cols-4">
                <div className="rounded-xl border border-stone-200 p-3">
                  <p className="text-xs text-stone-500">Tareas totales</p>
                  <p className="mt-1 text-2xl font-semibold text-stone-900">{totalTareas}</p>
                </div>
                <div className="rounded-xl border border-stone-200 p-3">
                  <p className="text-xs text-stone-500">Pendientes</p>
                  <p className="mt-1 text-2xl font-semibold text-sky-700">{tareasPendientes}</p>
                </div>
                <div className="rounded-xl border border-stone-200 p-3">
                  <p className="text-xs text-stone-500">Completadas</p>
                  <p className="mt-1 text-2xl font-semibold text-emerald-700">{tareasCompletadas}</p>
                </div>
                <div className="rounded-xl border border-stone-200 p-3">
                  <p className="text-xs text-stone-500">Vencidas / Críticas</p>
                  <p className="mt-1 text-2xl font-semibold text-red-700">
                    {tareasVencidas} / {tareasCriticas}
                  </p>
                </div>
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <p className="text-xs text-stone-500">Rango:</p>
                <Button
                  size="sm"
                  variant={rangoDashboard === '7d' ? 'default' : 'outline'}
                  className="h-7 px-2.5 text-[11px]"
                  onClick={() => setRangoDashboard('7d')}
                >
                  7 días
                </Button>
                <Button
                  size="sm"
                  variant={rangoDashboard === '30d' ? 'default' : 'outline'}
                  className="h-7 px-2.5 text-[11px]"
                  onClick={() => setRangoDashboard('30d')}
                >
                  30 días
                </Button>
                <Button
                  size="sm"
                  variant={rangoDashboard === 'todo' ? 'default' : 'outline'}
                  className="h-7 px-2.5 text-[11px]"
                  onClick={() => setRangoDashboard('todo')}
                >
                  Todo
                </Button>
              </div>
              <Separator className="my-4" />
              <div className="grid gap-3 md:grid-cols-2">
                <div className="rounded-xl border border-stone-200 p-3">
                  <p className="mb-2 text-xs font-medium text-stone-500">Distribución por prioridad</p>
                  <div className="h-[210px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={tareasPorPrioridad}>
                        <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                        <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                        <Tooltip />
                        <Bar dataKey="total" radius={[6, 6, 0, 0]}>
                          {tareasPorPrioridad.map((entry) => (
                            <Cell key={entry.key} fill={entry.color} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
                <div className="rounded-xl border border-stone-200 p-3">
                  <p className="mb-2 text-xs font-medium text-stone-500">Distribución por tipo</p>
                  <div className="h-[210px]">
                    {tareasPorTipo.length === 0 ? (
                      <p className="px-2 py-6 text-sm text-stone-500">Sin datos de tipos aún.</p>
                    ) : (
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie data={tareasPorTipo} dataKey="total" nameKey="label" innerRadius={45} outerRadius={78}>
                            {tareasPorTipo.map((entry) => (
                              <Cell key={entry.key} fill={entry.color} />
                            ))}
                          </Pie>
                          <Tooltip />
                        </PieChart>
                      </ResponsiveContainer>
                    )}
                  </div>
                  <div className="mt-1 flex flex-wrap gap-2">
                    {tareasPorTipo.map((item) => (
                      <span key={item.key} className="inline-flex items-center gap-1 text-xs text-stone-600">
                        <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                        {item.label}: {item.total}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
              <Separator className="my-4" />
              <div className="space-y-2">
                <p className="flex items-center gap-2 text-sm font-medium text-stone-700">
                  <CalendarClock size={14} className="text-stone-500" />
                  Próximos vencimientos
                </p>
                {tareas.isLoading ? (
                  <p className="text-sm text-stone-500">Cargando tareas...</p>
                ) : proximosVencimientos.length === 0 ? (
                  <p className="text-sm text-stone-500">No hay vencimientos próximos.</p>
                ) : (
                  <div className="space-y-2">
                    {proximosVencimientos.map((tarea) => (
                      <div key={tarea.tarea_id} className="flex items-center justify-between rounded-lg border border-stone-200 px-3 py-2">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-stone-800">{tarea.titulo}</p>
                          <p className="text-xs text-stone-500">{tarea.tipo} · {tarea.prioridad}</p>
                        </div>
                        <Badge variant="outline">{new Date(tarea.fecha_limite as string).toLocaleDateString('es')}</Badge>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </CardContent>
      </Card>

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
                <div className="mt-3">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => navigate(`/tablero/${proyecto.proyecto_id}`)}
                  >
                    <ListTodo size={14} />
                    Ver tablero
                  </Button>
                </div>
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
