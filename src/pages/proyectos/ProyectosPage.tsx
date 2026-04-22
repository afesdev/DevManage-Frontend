import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  CheckCircle2,
  Crown,
  Eye,
  FolderKanban,
  LayoutGrid,
  Pencil,
  PlusCircle,
  RefreshCw,
  Search,
  Sparkles,
  Star,
  Trash2,
  UserCog,
  UserPlus,
  Users,
  X,
} from 'lucide-react';
import { nucleoService } from '@/services/nucleo.service';
import { tableroService } from '@/services/tablero.service';
import { useAuthStore } from '@/store/auth.store';
import { useToastStore } from '@/store/toast.store';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import type { ProyectoResumen } from '@/types/auth';

// ── Paleta de colores por proyecto ─────────────────────────────────────
const PALETA_PROYECTO = [
  { bg: 'bg-purple-100', text: 'text-purple-700', ring: 'ring-purple-200', soft: 'bg-purple-50' },
  { bg: 'bg-sky-100', text: 'text-sky-700', ring: 'ring-sky-200', soft: 'bg-sky-50' },
  { bg: 'bg-emerald-100', text: 'text-emerald-700', ring: 'ring-emerald-200', soft: 'bg-emerald-50' },
  { bg: 'bg-amber-100', text: 'text-amber-700', ring: 'ring-amber-200', soft: 'bg-amber-50' },
  { bg: 'bg-rose-100', text: 'text-rose-700', ring: 'ring-rose-200', soft: 'bg-rose-50' },
  { bg: 'bg-indigo-100', text: 'text-indigo-700', ring: 'ring-indigo-200', soft: 'bg-indigo-50' },
  { bg: 'bg-teal-100', text: 'text-teal-700', ring: 'ring-teal-200', soft: 'bg-teal-50' },
  { bg: 'bg-pink-100', text: 'text-pink-700', ring: 'ring-pink-200', soft: 'bg-pink-50' },
];

function colorProyecto(seed: string) {
  let h = 0;
  for (let i = 0; i < seed.length; i += 1) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return PALETA_PROYECTO[h % PALETA_PROYECTO.length];
}

function iniciales(nombre: string) {
  const partes = nombre.trim().split(/\s+/).filter(Boolean);
  if (partes.length === 0) return '··';
  if (partes.length === 1) return partes[0].slice(0, 2).toUpperCase();
  return (partes[0][0] + partes[1][0]).toUpperCase();
}

function fechaRelativa(iso: string) {
  const ahora = Date.now();
  const fecha = new Date(iso).getTime();
  const diffMs = ahora - fecha;
  const min = Math.floor(diffMs / 60_000);
  if (min < 1) return 'hace un momento';
  if (min < 60) return `hace ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `hace ${h} h`;
  const d = Math.floor(h / 24);
  if (d < 7) return `hace ${d} d`;
  const sem = Math.floor(d / 7);
  if (sem < 5) return `hace ${sem} sem`;
  const mes = Math.floor(d / 30);
  if (mes < 12) return `hace ${mes} mes${mes === 1 ? '' : 'es'}`;
  const año = Math.floor(d / 365);
  return `hace ${año} año${año === 1 ? '' : 's'}`;
}

const ESTADO_STYLE: Record<ProyectoResumen['estado'], { label: string; chip: string; dot: string }> = {
  activo: { label: 'Activo', chip: 'bg-emerald-50 text-emerald-700 border-emerald-200', dot: 'bg-emerald-500' },
  pausado: { label: 'Pausado', chip: 'bg-amber-50 text-amber-700 border-amber-200', dot: 'bg-amber-500' },
  archivado: { label: 'Archivado', chip: 'bg-stone-100 text-stone-600 border-stone-200', dot: 'bg-stone-400' },
};

const ROL_STYLE: Record<
  ProyectoResumen['rol'],
  { label: string; chip: string; Icon: React.ComponentType<{ size?: number; className?: string }> }
> = {
  propietario: { label: 'Propietario', chip: 'bg-purple-50 text-purple-700 border-purple-200', Icon: Crown },
  lider: { label: 'Líder', chip: 'bg-sky-50 text-sky-700 border-sky-200', Icon: Star },
  miembro: { label: 'Miembro', chip: 'bg-stone-50 text-stone-700 border-stone-200', Icon: UserCog },
  espectador: { label: 'Espectador', chip: 'bg-stone-50 text-stone-500 border-stone-200', Icon: Eye },
};

type FiltroEstado = 'todos' | ProyectoResumen['estado'];
type FiltroRol = 'todos' | ProyectoResumen['rol'];

export function ProyectosPage() {
  const token = useAuthStore((s) => s.token);
  const proyectoActivoId = useAuthStore((s) => s.proyectoActivoId);
  const setProyectoActivo = useAuthStore((s) => s.setProyectoActivo);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const pushToast = useToastStore((s) => s.pushToast);

  const [crearAbierto, setCrearAbierto] = useState(false);
  const [nombre, setNombre] = useState('');
  const [descripcion, setDescripcion] = useState('');

  const [editandoProyectoId, setEditandoProyectoId] = useState<string | null>(null);
  const [nombreEditar, setNombreEditar] = useState('');
  const [descripcionEditar, setDescripcionEditar] = useState('');

  const [proyectoAEliminar, setProyectoAEliminar] = useState<{
    proyecto_id: string;
    nombre: string;
  } | null>(null);

  const [buscarTexto, setBuscarTexto] = useState('');
  const [filtroEstado, setFiltroEstado] = useState<FiltroEstado>('todos');
  const [filtroRol, setFiltroRol] = useState<FiltroRol>('todos');
  const [usuarioInvitarId, setUsuarioInvitarId] = useState('');
  const [buscarUsuarioInvitar, setBuscarUsuarioInvitar] = useState('');
  const [rolInvitar, setRolInvitar] = useState<'administrador' | 'miembro'>('miembro');
  const [confirmacionMiembro, setConfirmacionMiembro] = useState<{
    tipo: 'rol' | 'remover';
    usuario_id: string;
    nombre: string;
    rol?: 'administrador' | 'miembro';
  } | null>(null);

  const proyectos = useQuery({
    queryKey: ['proyectos-page', token],
    queryFn: () => tableroService.obtenerProyectos(token as string),
    enabled: Boolean(token),
  });

  const lista = proyectos.data ?? [];

  const metricas = useMemo(() => {
    const total = lista.length;
    const activos = lista.filter((p) => p.estado === 'activo').length;
    const pausados = lista.filter((p) => p.estado === 'pausado').length;
    const archivados = lista.filter((p) => p.estado === 'archivado').length;
    const propios = lista.filter((p) => p.rol === 'propietario').length;
    return { total, activos, pausados, archivados, propios };
  }, [lista]);

  const proyectosFiltrados = useMemo(() => {
    const texto = buscarTexto.trim().toLowerCase();
    return lista
      .filter((p) => {
        if (filtroEstado !== 'todos' && p.estado !== filtroEstado) return false;
        if (filtroRol !== 'todos' && p.rol !== filtroRol) return false;
        if (!texto) return true;
        return (
          p.nombre.toLowerCase().includes(texto) ||
          (p.descripcion ?? '').toLowerCase().includes(texto) ||
          p.slug.toLowerCase().includes(texto)
        );
      })
      .sort((a, b) => {
        // activo primero
        if (a.proyecto_id === proyectoActivoId && b.proyecto_id !== proyectoActivoId) return -1;
        if (b.proyecto_id === proyectoActivoId && a.proyecto_id !== proyectoActivoId) return 1;
        // luego por actualizado_en desc
        return new Date(b.actualizado_en).getTime() - new Date(a.actualizado_en).getTime();
      });
  }, [lista, buscarTexto, filtroEstado, filtroRol, proyectoActivoId]);

  const proyectoGestionEquipo = useMemo(
    () =>
      lista.find((p) => p.proyecto_id === proyectoActivoId) ??
      lista.find((p) => p.rol === 'propietario') ??
      lista[0] ??
      null,
    [lista, proyectoActivoId],
  );

  const puedeGestionarEquipo = Boolean(
    proyectoGestionEquipo &&
      (proyectoGestionEquipo.rol === 'propietario' || proyectoGestionEquipo.rol === 'lider'),
  );

  const miembrosEquipo = useQuery({
    queryKey: ['equipo-miembros', proyectoGestionEquipo?.proyecto_id, token],
    queryFn: () =>
      nucleoService.obtenerMiembrosEquipo(proyectoGestionEquipo?.proyecto_id as string, token as string),
    enabled: Boolean(token && proyectoGestionEquipo?.proyecto_id && puedeGestionarEquipo),
  });

  const usuariosActivos = useQuery({
    queryKey: ['usuarios-activos', token],
    queryFn: () => nucleoService.obtenerUsuariosActivos(token as string),
    enabled: Boolean(token),
  });

  const hayFiltrosActivos =
    buscarTexto.trim() !== '' || filtroEstado !== 'todos' || filtroRol !== 'todos';

  const opcionesUsuariosInvitar = useMemo(() => {
    const q = buscarUsuarioInvitar.trim().toLowerCase();
    return (usuariosActivos.data ?? [])
      .filter((u) => !(miembrosEquipo.data ?? []).some((m) => m.usuario_id === u.usuario_id))
      .filter((u) => {
        if (!q) return true;
        return (
          u.nombre_visible.toLowerCase().includes(q) ||
          u.correo.toLowerCase().includes(q)
        );
      })
      .sort((a, b) => a.nombre_visible.localeCompare(b.nombre_visible));
  }, [buscarUsuarioInvitar, usuariosActivos.data, miembrosEquipo.data]);

  const limpiarFiltros = () => {
    setBuscarTexto('');
    setFiltroEstado('todos');
    setFiltroRol('todos');
  };

  const crearProyecto = useMutation({
    mutationFn: () =>
      nucleoService.crearProyecto(
        {
          nombre,
          descripcion: descripcion || undefined,
        },
        token as string,
      ),
    onSuccess: async (proyecto) => {
      setNombre('');
      setDescripcion('');
      setCrearAbierto(false);
      setProyectoActivo(proyecto.proyecto_id);
      pushToast({ type: 'ok', message: 'Proyecto creado correctamente.' });
      await queryClient.invalidateQueries({ queryKey: ['proyectos-page', token] });
      navigate(`/tablero/${proyecto.proyecto_id}`);
    },
    onError: () => {
      pushToast({ type: 'error', message: 'No se pudo crear el proyecto.' });
    },
  });

  const editarProyecto = useMutation({
    mutationFn: (args: { proyectoId: string; nombre: string; descripcion: string }) =>
      nucleoService.actualizarProyecto(
        args.proyectoId,
        {
          nombre: args.nombre,
          descripcion: args.descripcion || '',
        },
        token as string,
      ),
    onSuccess: async () => {
      setEditandoProyectoId(null);
      setNombreEditar('');
      setDescripcionEditar('');
      pushToast({ type: 'ok', message: 'Proyecto actualizado correctamente.' });
      await queryClient.invalidateQueries({ queryKey: ['proyectos-page', token] });
    },
    onError: () => {
      pushToast({ type: 'error', message: 'No se pudo actualizar el proyecto.' });
    },
  });

  const eliminarProyecto = useMutation({
    mutationFn: (proyectoId: string) => nucleoService.eliminarProyecto(proyectoId, token as string),
    onSuccess: async (_data, proyectoId) => {
      if (proyectoActivoId === proyectoId) {
        setProyectoActivo(null);
      }
      setProyectoAEliminar(null);
      pushToast({ type: 'ok', message: 'Proyecto eliminado correctamente.' });
      await queryClient.invalidateQueries({ queryKey: ['proyectos-page', token] });
    },
    onError: () => {
      pushToast({ type: 'error', message: 'No se pudo eliminar el proyecto.' });
    },
  });

  const invitarMiembro = useMutation({
    mutationFn: () =>
      nucleoService.invitarMiembroEquipo(
        proyectoGestionEquipo?.proyecto_id as string,
        { usuario_id: usuarioInvitarId, rol: rolInvitar },
        token as string,
      ),
    onSuccess: async () => {
      setUsuarioInvitarId('');
      setBuscarUsuarioInvitar('');
      setRolInvitar('miembro');
      pushToast({ type: 'ok', message: 'Miembro agregado correctamente.' });
      await queryClient.invalidateQueries({
        queryKey: ['equipo-miembros', proyectoGestionEquipo?.proyecto_id, token],
      });
      await queryClient.invalidateQueries({ queryKey: ['proyectos-page', token] });
    },
    onError: () => {
      pushToast({ type: 'error', message: 'No se pudo agregar el miembro.' });
    },
  });

  const actualizarRolMiembro = useMutation({
    mutationFn: (args: { usuarioId: string; rol: 'administrador' | 'miembro' }) =>
      nucleoService.actualizarMiembroEquipo(
        proyectoGestionEquipo?.proyecto_id as string,
        args.usuarioId,
        { rol: args.rol },
        token as string,
      ),
    onSuccess: async () => {
      pushToast({ type: 'ok', message: 'Rol actualizado correctamente.' });
      await queryClient.invalidateQueries({
        queryKey: ['equipo-miembros', proyectoGestionEquipo?.proyecto_id, token],
      });
    },
    onError: () => {
      pushToast({ type: 'error', message: 'No se pudo actualizar el rol.' });
    },
  });

  const removerMiembro = useMutation({
    mutationFn: (usuarioId: string) =>
      nucleoService.removerMiembroEquipo(
        proyectoGestionEquipo?.proyecto_id as string,
        usuarioId,
        token as string,
      ),
    onSuccess: async () => {
      pushToast({ type: 'ok', message: 'Miembro removido correctamente.' });
      await queryClient.invalidateQueries({
        queryKey: ['equipo-miembros', proyectoGestionEquipo?.proyecto_id, token],
      });
      await queryClient.invalidateQueries({ queryKey: ['proyectos-page', token] });
    },
    onError: () => {
      pushToast({ type: 'error', message: 'No se pudo remover el miembro.' });
    },
  });

  const sincronizarEquipo = useMutation({
    mutationFn: () =>
      nucleoService.sincronizarEquipoAProyectos(
        proyectoGestionEquipo?.proyecto_id as string,
        token as string,
      ),
    onSuccess: async () => {
      pushToast({ type: 'ok', message: 'Sincronización completada correctamente.' });
      await queryClient.invalidateQueries({
        queryKey: ['equipo-miembros', proyectoGestionEquipo?.proyecto_id, token],
      });
      await queryClient.invalidateQueries({ queryKey: ['proyectos-page', token] });
    },
    onError: () => {
      pushToast({ type: 'error', message: 'No se pudo sincronizar equipo y proyectos.' });
    },
  });

  return (
    <div className="flex min-h-full flex-col gap-5">
      {/* ── Header card ─────────────────────────────────────────────── */}
      <div className="overflow-hidden rounded-2xl border border-stone-200 bg-gradient-to-br from-purple-50 via-white to-white">
        <div className="flex flex-wrap items-start justify-between gap-4 px-5 py-4">
          <div className="flex items-start gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-purple-600 text-white shadow-sm ring-1 ring-purple-700/10">
              <FolderKanban size={20} />
            </div>
            <div className="min-w-0">
              <h1 className="text-[20px] font-semibold tracking-tight text-stone-900">Proyectos</h1>
              <p className="mt-0.5 text-[13px] text-stone-500">
                Gestiona tus proyectos, roles y estado actual.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="hidden items-center gap-3 rounded-xl border border-stone-200 bg-white/80 px-3 py-1.5 text-[11px] md:flex">
              <MetricaInline label="Total" value={metricas.total} />
              <span className="h-4 w-px bg-stone-200" />
              <MetricaInline label="Activos" value={metricas.activos} accent="text-emerald-600" />
              <span className="h-4 w-px bg-stone-200" />
              <MetricaInline label="Propios" value={metricas.propios} accent="text-purple-600" />
            </div>
            <Button
              onClick={() => setCrearAbierto((v) => !v)}
              className="gap-1.5 bg-purple-600 text-white hover:bg-purple-700"
            >
              {crearAbierto ? <X size={15} /> : <PlusCircle size={15} />}
              {crearAbierto ? 'Cerrar' : 'Nuevo proyecto'}
            </Button>
          </div>
        </div>

        {/* Formulario de creación embebido */}
        {crearAbierto && (
          <div className="border-t border-stone-200 bg-white/60 px-5 py-4">
            <div className="flex items-center gap-2 text-[12px] font-semibold uppercase tracking-widest text-stone-500">
              <Sparkles size={13} className="text-purple-500" />
              Nuevo proyecto
            </div>
            <div className="mt-3 grid gap-3 md:grid-cols-2">
              <Input
                placeholder="Nombre del proyecto"
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                autoFocus
              />
              <Input
                placeholder="Descripción (opcional)"
                value={descripcion}
                onChange={(e) => setDescripcion(e.target.value)}
              />
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <Button
                onClick={() => {
                  if (!nombre.trim()) {
                    pushToast({ type: 'error', message: 'El nombre del proyecto es obligatorio.' });
                    return;
                  }
                  crearProyecto.mutate();
                }}
                disabled={crearProyecto.isPending}
                className="bg-purple-600 text-white hover:bg-purple-700"
              >
                {crearProyecto.isPending ? 'Creando…' : 'Crear y abrir tablero'}
              </Button>
              <Button
                variant="ghost"
                onClick={() => {
                  setCrearAbierto(false);
                }}
              >
                Cancelar
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* ── Barra de filtros ─────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-stone-200 bg-white px-3 py-2">
        <div className="relative min-w-[220px] flex-1">
          <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-stone-400" />
          <input
            type="text"
            value={buscarTexto}
            onChange={(e) => setBuscarTexto(e.target.value)}
            placeholder="Buscar por nombre, descripción o slug…"
            className="h-8 w-full rounded-lg border border-stone-200 bg-stone-50 pl-7 pr-3 text-[12px] outline-none transition focus:border-purple-300 focus:bg-white focus:ring-2 focus:ring-purple-200"
          />
        </div>

        <select
          value={filtroEstado}
          onChange={(e) => setFiltroEstado(e.target.value as FiltroEstado)}
          className="h-8 rounded-lg border border-stone-200 bg-white px-2 text-[12px] text-stone-700 outline-none focus:ring-2 focus:ring-purple-200"
        >
          <option value="todos">Todos los estados</option>
          <option value="activo">Activos</option>
          <option value="pausado">Pausados</option>
          <option value="archivado">Archivados</option>
        </select>

        <select
          value={filtroRol}
          onChange={(e) => setFiltroRol(e.target.value as FiltroRol)}
          className="h-8 rounded-lg border border-stone-200 bg-white px-2 text-[12px] text-stone-700 outline-none focus:ring-2 focus:ring-purple-200"
        >
          <option value="todos">Todos los roles</option>
          <option value="propietario">Propietario</option>
          <option value="lider">Líder</option>
          <option value="miembro">Miembro</option>
          <option value="espectador">Espectador</option>
        </select>

        {hayFiltrosActivos && (
          <button
            type="button"
            onClick={limpiarFiltros}
            className="flex h-8 items-center gap-1 rounded-lg border border-stone-200 bg-white px-2.5 text-[12px] text-stone-600 transition hover:bg-stone-50"
          >
            <X size={12} />
            Limpiar
          </button>
        )}

        <div className="ml-auto flex items-center gap-1 text-[11px] text-stone-500">
          <LayoutGrid size={12} />
          {proyectosFiltrados.length} de {metricas.total}
        </div>
      </div>

      {proyectoGestionEquipo ? (
        <div className="rounded-2xl border border-stone-200 bg-white p-4">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-purple-100 text-purple-700">
                <Users size={16} />
              </div>
              <div>
                <p className="text-[14px] font-semibold text-stone-900">Equipo del proyecto</p>
                <p className="text-[11px] text-stone-500">
                  {proyectoGestionEquipo.nombre} · sincronización automática equipo - proyectos
                </p>
              </div>
            </div>
            <Button
              size="sm"
              variant="outline"
              className="gap-1"
              onClick={() => sincronizarEquipo.mutate()}
              disabled={!puedeGestionarEquipo || sincronizarEquipo.isPending}
            >
              <RefreshCw size={12} className={cn(sincronizarEquipo.isPending && 'animate-spin')} />
              Sincronizar
            </Button>
          </div>

          {puedeGestionarEquipo ? (
            <div className="grid gap-2 md:grid-cols-[1fr_auto_auto]">
              <div className="space-y-1">
                <Input
                  value={buscarUsuarioInvitar}
                  onChange={(e) => setBuscarUsuarioInvitar(e.target.value)}
                  placeholder="Buscar usuario por nombre o correo..."
                />
                <select
                  value={usuarioInvitarId}
                  onChange={(e) => setUsuarioInvitarId(e.target.value)}
                  className="h-10 w-full rounded-md border border-stone-200 bg-white px-3 text-[13px] text-stone-700 outline-none focus:ring-2 focus:ring-purple-200"
                >
                  <option value="">
                    {usuariosActivos.isLoading ? 'Cargando usuarios...' : 'Seleccionar usuario…'}
                  </option>
                  {opcionesUsuariosInvitar.map((u) => (
                    <option key={u.usuario_id} value={u.usuario_id}>
                      {u.nombre_visible} ({u.correo})
                    </option>
                  ))}
                </select>
              </div>
              <select
                value={rolInvitar}
                onChange={(e) => setRolInvitar(e.target.value as 'administrador' | 'miembro')}
                className="h-10 rounded-md border border-stone-200 bg-white px-3 text-[13px] text-stone-700 outline-none focus:ring-2 focus:ring-purple-200"
              >
                <option value="miembro">Miembro</option>
                <option value="administrador">Administrador</option>
              </select>
              <Button
                className="gap-1 bg-purple-600 text-white hover:bg-purple-700"
                disabled={!usuarioInvitarId || invitarMiembro.isPending}
                onClick={() => invitarMiembro.mutate()}
              >
                <UserPlus size={14} />
                Agregar
              </Button>
            </div>
          ) : (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[12px] text-amber-700">
              Solo propietario o líder del proyecto puede administrar miembros del equipo.
            </div>
          )}
          <div className="mt-3 space-y-2">
            {(miembrosEquipo.data ?? []).map((m) => (
              <div
                key={m.usuario_id}
                className="flex flex-wrap items-center gap-2 rounded-lg border border-stone-200 px-3 py-2"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] font-medium text-stone-800">{m.nombre_visible}</p>
                  <p className="truncate text-[11px] text-stone-500">{m.correo}</p>
                </div>
                <select
                  value={m.rol}
                  disabled={
                    !puedeGestionarEquipo || m.rol === 'propietario' || actualizarRolMiembro.isPending
                  }
                  onChange={(e) =>
                    setConfirmacionMiembro({
                      tipo: 'rol',
                      usuario_id: m.usuario_id,
                      nombre: m.nombre_visible || m.correo,
                      rol: e.target.value as 'administrador' | 'miembro',
                    })
                  }
                  className="h-8 rounded-md border border-stone-200 bg-white px-2 text-[12px]"
                >
                  <option value="propietario">Propietario</option>
                  <option value="administrador">Administrador</option>
                  <option value="miembro">Miembro</option>
                </select>
                <button
                  type="button"
                  disabled={
                    !puedeGestionarEquipo || m.rol === 'propietario' || removerMiembro.isPending
                  }
                  onClick={() =>
                    setConfirmacionMiembro({
                      tipo: 'remover',
                      usuario_id: m.usuario_id,
                      nombre: m.nombre_visible || m.correo,
                    })
                  }
                  className="flex h-8 w-8 items-center justify-center rounded-md border border-stone-200 text-stone-500 transition hover:border-red-200 hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
                  title="Remover miembro"
                >
                  <Trash2 size={13} />
                </button>
              </div>
            ))}
            {miembrosEquipo.isLoading ? (
              <p className="text-[12px] text-stone-400">Cargando miembros del equipo...</p>
            ) : (miembrosEquipo.data ?? []).length === 0 ? (
              <p className="text-[12px] text-stone-400">No hay miembros en el equipo.</p>
            ) : null}
          </div>
        </div>
      ) : null}

      {/* ── Lista / grid de proyectos ────────────────────────────────── */}
      {proyectos.isLoading ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-40 animate-pulse rounded-2xl border border-stone-200 bg-stone-50" />
          ))}
        </div>
      ) : proyectosFiltrados.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-stone-300 bg-white px-6 py-14 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-stone-100 text-stone-400">
            <FolderKanban size={22} />
          </div>
          {lista.length === 0 ? (
            <>
              <p className="text-[14px] font-semibold text-stone-700">Aún no tienes proyectos</p>
              <p className="max-w-md text-[12.5px] text-stone-500">
                Crea tu primer proyecto para empezar a gestionar tareas, equipo y repositorios.
              </p>
              <Button
                onClick={() => setCrearAbierto(true)}
                className="mt-2 gap-1.5 bg-purple-600 text-white hover:bg-purple-700"
              >
                <PlusCircle size={15} />
                Crear mi primer proyecto
              </Button>
            </>
          ) : (
            <>
              <p className="text-[14px] font-semibold text-stone-700">Sin coincidencias</p>
              <p className="max-w-md text-[12.5px] text-stone-500">
                Ajusta la búsqueda o los filtros para ver más proyectos.
              </p>
              <Button variant="outline" onClick={limpiarFiltros} className="mt-1">
                <X size={13} />
                Limpiar filtros
              </Button>
            </>
          )}
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {proyectosFiltrados.map((proyecto) => {
            const color = colorProyecto(proyecto.proyecto_id);
            const estado = ESTADO_STYLE[proyecto.estado];
            const rol = ROL_STYLE[proyecto.rol];
            const RolIcon = rol.Icon;
            const esActivo = proyectoActivoId === proyecto.proyecto_id;
            const estaEditando = editandoProyectoId === proyecto.proyecto_id;
            const puedeEditar = proyecto.rol === 'propietario';

            return (
              <div
                key={proyecto.proyecto_id}
                className={cn(
                  'group relative flex flex-col gap-3 rounded-2xl border bg-white p-4 transition hover:shadow-sm',
                  esActivo
                    ? 'border-purple-300 ring-2 ring-purple-100'
                    : 'border-stone-200 hover:border-stone-300',
                )}
              >
                {/* Badge "Activo" flotante */}
                {esActivo && (
                  <div className="absolute -top-2 right-3 flex items-center gap-1 rounded-full border border-purple-200 bg-white px-2 py-0.5 text-[10px] font-semibold text-purple-700 shadow-sm">
                    <CheckCircle2 size={11} className="text-purple-600" />
                    Activo
                  </div>
                )}

                {estaEditando ? (
                  <div className="space-y-2">
                    <Input
                      value={nombreEditar}
                      onChange={(e) => setNombreEditar(e.target.value)}
                      placeholder="Nombre del proyecto"
                      autoFocus
                    />
                    <Input
                      value={descripcionEditar}
                      onChange={(e) => setDescripcionEditar(e.target.value)}
                      placeholder="Descripción"
                    />
                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        onClick={() => {
                          if (!nombreEditar.trim()) {
                            pushToast({ type: 'error', message: 'El nombre no puede estar vacío.' });
                            return;
                          }
                          editarProyecto.mutate({
                            proyectoId: proyecto.proyecto_id,
                            nombre: nombreEditar.trim(),
                            descripcion: descripcionEditar.trim(),
                          });
                        }}
                        disabled={editarProyecto.isPending}
                        className="bg-purple-600 text-white hover:bg-purple-700"
                      >
                        {editarProyecto.isPending ? 'Guardando…' : 'Guardar'}
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          setEditandoProyectoId(null);
                        }}
                      >
                        Cancelar
                      </Button>
                    </div>
                  </div>
                ) : (
                  <>
                    {/* Cabecera: avatar + nombre */}
                    <div className="flex items-start gap-3">
                      <div
                        className={cn(
                          'flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-[13px] font-bold ring-1',
                          color.bg,
                          color.text,
                          color.ring,
                        )}
                      >
                        {iniciales(proyecto.nombre)}
                      </div>
                      <div className="min-w-0 flex-1">
                        <button
                          type="button"
                          onClick={() => {
                            setProyectoActivo(proyecto.proyecto_id);
                            navigate(`/tablero/${proyecto.proyecto_id}`);
                          }}
                          className="block w-full truncate text-left text-[14px] font-semibold text-stone-900 transition hover:text-purple-700"
                          title={proyecto.nombre}
                        >
                          {proyecto.nombre}
                        </button>
                        <p className="truncate font-mono text-[10.5px] text-stone-400">{proyecto.slug}</p>
                      </div>
                    </div>

                    {/* Descripción */}
                    <p className="line-clamp-2 min-h-[2.5em] text-[12.5px] leading-snug text-stone-600">
                      {proyecto.descripcion?.trim() || (
                        <span className="italic text-stone-400">Sin descripción.</span>
                      )}
                    </p>

                    {/* Chips */}
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span
                        className={cn(
                          'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10.5px] font-medium',
                          estado.chip,
                        )}
                      >
                        <span className={cn('h-1.5 w-1.5 rounded-full', estado.dot)} />
                        {estado.label}
                      </span>
                      <span
                        className={cn(
                          'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10.5px] font-medium',
                          rol.chip,
                        )}
                      >
                        <RolIcon size={10} />
                        {rol.label}
                      </span>
                      <span className="ml-auto text-[10.5px] text-stone-400">
                        {fechaRelativa(proyecto.actualizado_en)}
                      </span>
                    </div>

                    {/* Acciones */}
                    <div className="mt-auto flex items-center gap-1.5 border-t border-stone-100 pt-3">
                      <Button
                        size="sm"
                        onClick={() => {
                          setProyectoActivo(proyecto.proyecto_id);
                          navigate(`/tablero/${proyecto.proyecto_id}`);
                        }}
                        className="flex-1 gap-1 bg-purple-600 text-white hover:bg-purple-700"
                      >
                        <LayoutGrid size={13} />
                        Abrir tablero
                      </Button>
                      {puedeEditar && (
                        <>
                          <button
                            type="button"
                            onClick={() => {
                              setEditandoProyectoId(proyecto.proyecto_id);
                              setNombreEditar(proyecto.nombre);
                              setDescripcionEditar(proyecto.descripcion ?? '');
                            }}
                            className="flex h-8 w-8 items-center justify-center rounded-md border border-stone-200 text-stone-500 transition hover:border-stone-300 hover:bg-stone-50 hover:text-stone-700"
                            title="Editar"
                          >
                            <Pencil size={13} />
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setProyectoAEliminar({
                                proyecto_id: proyecto.proyecto_id,
                                nombre: proyecto.nombre,
                              });
                            }}
                            disabled={eliminarProyecto.isPending}
                            className="flex h-8 w-8 items-center justify-center rounded-md border border-stone-200 text-stone-500 transition hover:border-red-200 hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
                            title="Eliminar"
                          >
                            <Trash2 size={13} />
                          </button>
                        </>
                      )}
                    </div>
                  </>
                )}
              </div>
            );
          })}
        </div>
      )}

      {confirmacionMiembro ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4 backdrop-blur-sm"
          onClick={() => setConfirmacionMiembro(null)}
        >
          <div
            className="w-full max-w-md rounded-2xl border border-stone-200 bg-white p-5 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-[16px] font-semibold text-stone-900">
              {confirmacionMiembro.tipo === 'remover'
                ? 'Confirmar remoción'
                : 'Confirmar cambio de rol'}
            </h3>
            <p className="mt-2 text-[13px] text-stone-600">
              {confirmacionMiembro.tipo === 'remover'
                ? `¿Deseas remover a "${confirmacionMiembro.nombre}" del equipo y proyectos asociados?`
                : `¿Deseas cambiar el rol de "${confirmacionMiembro.nombre}" a "${confirmacionMiembro.rol}"?`}
            </p>
            <div className="mt-5 flex items-center justify-end gap-2">
              <Button variant="outline" onClick={() => setConfirmacionMiembro(null)}>
                Cancelar
              </Button>
              <Button
                variant={confirmacionMiembro.tipo === 'remover' ? 'destructive' : 'default'}
                onClick={() => {
                  if (confirmacionMiembro.tipo === 'remover') {
                    removerMiembro.mutate(confirmacionMiembro.usuario_id);
                  } else if (confirmacionMiembro.rol) {
                    actualizarRolMiembro.mutate({
                      usuarioId: confirmacionMiembro.usuario_id,
                      rol: confirmacionMiembro.rol,
                    });
                  }
                  setConfirmacionMiembro(null);
                }}
              >
                Confirmar
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      {/* ── Modal de eliminación ─────────────────────────────────────── */}
      {proyectoAEliminar ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4 backdrop-blur-sm"
          onClick={() => !eliminarProyecto.isPending && setProyectoAEliminar(null)}
        >
          <div
            className="w-full max-w-md rounded-2xl border border-stone-200 bg-white p-5 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-red-100 text-red-600">
                <Trash2 size={18} />
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="text-[16px] font-semibold text-stone-900">Eliminar proyecto</h3>
                <p className="mt-1 text-[13px] text-stone-600">
                  Se eliminará el proyecto{' '}
                  <span className="font-semibold text-stone-900">"{proyectoAEliminar.nombre}"</span>{' '}
                  junto con su tablero, tareas y datos vinculados.
                </p>
                <p className="mt-2 rounded-md border border-red-200 bg-red-50 px-2.5 py-1.5 text-[11.5px] font-medium text-red-700">
                  Esta acción no se puede deshacer.
                </p>
              </div>
            </div>
            <div className="mt-5 flex items-center justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => setProyectoAEliminar(null)}
                disabled={eliminarProyecto.isPending}
              >
                Cancelar
              </Button>
              <Button
                variant="destructive"
                disabled={eliminarProyecto.isPending}
                onClick={() => eliminarProyecto.mutate(proyectoAEliminar.proyecto_id)}
              >
                {eliminarProyecto.isPending ? 'Eliminando…' : 'Sí, eliminar'}
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function MetricaInline({
  label,
  value,
  accent = 'text-stone-800',
}: {
  label: string;
  value: number;
  accent?: string;
}) {
  return (
    <div className="flex items-baseline gap-1.5">
      <span className={cn('text-[13px] font-bold leading-none', accent)}>{value}</span>
      <span className="text-[10.5px] uppercase tracking-wider text-stone-500">{label}</span>
    </div>
  );
}
