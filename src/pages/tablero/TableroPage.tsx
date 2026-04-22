import { useEffect, useMemo, useState, type Dispatch, type SetStateAction } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useParams } from 'react-router-dom';
import {
  DndContext,
  PointerSensor,
  closestCorners,
  useDroppable,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import type { DragEndEvent } from '@dnd-kit/core';
import { SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  AlertCircle,
  Bookmark,
  Calendar,
  CheckCircle2,
  Filter,
  GripVertical,
  Hash,
  Layers,
  LoaderCircle,
  MessageSquare,
  Plus,
  Search,
  SquareKanban,
  Trash2,
  X,
} from 'lucide-react';
import { tableroService } from '@/services/tablero.service';
import type {
  ActualizarTareaPayload,
  ColumnaTablero,
  ComentarioTareaResumen,
  EpicaResumen,
  EtiquetaResumen,
  MiembroProyectoResumen,
  TareaActividadResumen,
  TareaEtiquetaResumen,
  TareaTablero,
} from '@/services/tablero.service';
import { useAuthStore } from '@/store/auth.store';
import { useToastStore } from '@/store/toast.store';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { EditorDocumentoBlockNote } from '@/components/documentos/EditorDocumentoBlockNote';

// ─── Config visual ────────────────────────────────────────────────────────────

const PRIORIDAD: Record<
  string,
  { label: string; border: string; chip: string; dot: string }
> = {
  critica: {
    label: 'Crítica',
    border: 'border-l-red-500',
    chip: 'bg-red-50 text-red-700 ring-1 ring-red-200',
    dot: 'bg-red-500',
  },
  alta: {
    label: 'Alta',
    border: 'border-l-orange-400',
    chip: 'bg-orange-50 text-orange-700 ring-1 ring-orange-200',
    dot: 'bg-orange-400',
  },
  media: {
    label: 'Media',
    border: 'border-l-amber-400',
    chip: 'bg-amber-50 text-amber-700 ring-1 ring-amber-200',
    dot: 'bg-amber-400',
  },
  baja: {
    label: 'Baja',
    border: 'border-l-emerald-500',
    chip: 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200',
    dot: 'bg-emerald-500',
  },
};

const TIPO: Record<string, { label: string; chip: string }> = {
  tarea: { label: 'Tarea', chip: 'bg-sky-50 text-sky-700 ring-1 ring-sky-200' },
  subtarea: { label: 'Subtarea', chip: 'bg-violet-50 text-violet-700 ring-1 ring-violet-200' },
  error: { label: 'Error', chip: 'bg-red-50 text-red-700 ring-1 ring-red-200' },
};

// ─── Tipos ────────────────────────────────────────────────────────────────────

type FormNuevaTareaState = {
  titulo: string;
  descripcion: string;
  prioridad: 'critica' | 'alta' | 'media' | 'baja';
  tipo: 'tarea' | 'subtarea' | 'error';
  fecha_limite: string;
  epica_id: string;
  tarea_padre_id: string;
  responsable_id: string;
};

function estadoInicialNuevaTarea(): FormNuevaTareaState {
  return {
    titulo: '',
    descripcion: '',
    prioridad: 'media',
    tipo: 'tarea',
    fecha_limite: '',
    epica_id: '',
    tarea_padre_id: '',
    responsable_id: '',
  };
}

function tareaToForm(t: TareaTablero): FormNuevaTareaState {
  let fechaLimite = '';
  if (t.fecha_limite) {
    fechaLimite = t.fecha_limite.includes('T')
      ? t.fecha_limite.slice(0, 10)
      : t.fecha_limite.slice(0, 10);
  }
  return {
    titulo: t.titulo,
    descripcion: t.descripcion ?? '',
    prioridad: t.prioridad,
    tipo: t.tipo,
    fecha_limite: fechaLimite,
    epica_id: t.epica_id ?? '',
    tarea_padre_id: t.tarea_padre_id ?? '',
    responsable_id: t.responsable_id ?? '',
  };
}

function construirPayloadEdicion(
  form: FormNuevaTareaState,
  columnaId: string,
  tareaBase: TareaTablero,
): ActualizarTareaPayload {
  const payload: ActualizarTareaPayload = {
    titulo: form.titulo.trim(),
    descripcion: form.descripcion,
    tipo: form.tipo,
    prioridad: form.prioridad,
    fecha_limite: form.fecha_limite.trim(),
    epica_id: form.epica_id.trim(),
    tarea_padre_id: form.tarea_padre_id.trim(),
    responsable_id: form.responsable_id.trim(),
  };
  if (columnaId !== tareaBase.columna_id) {
    payload.columna_id = columnaId;
  }
  return payload;
}

// ─── Reordenamiento optimista ─────────────────────────────────────────────────

function reordenarTareasKanban(
  tareasActuales: TareaTablero[],
  args: { tareaId: string; columnaOrigenId: string; columnaDestinoId: string; overId: string },
): TareaTablero[] {
  const tareaMovida = tareasActuales.find((t) => t.tarea_id === args.tareaId);
  if (!tareaMovida) return tareasActuales;

  const restantes = tareasActuales.filter((t) => t.tarea_id !== args.tareaId);
  const origen = restantes
    .filter((t) => t.columna_id === args.columnaOrigenId)
    .sort((a, b) => a.posicion - b.posicion);
  const destinoBase = restantes
    .filter((t) => t.columna_id === args.columnaDestinoId)
    .sort((a, b) => a.posicion - b.posicion);

  let indiceDestino = destinoBase.length;
  if (!args.overId.startsWith('col:')) {
    const indiceSobreTarea = destinoBase.findIndex((t) => t.tarea_id === args.overId);
    if (indiceSobreTarea >= 0) indiceDestino = indiceSobreTarea;
  }

  const tareaActualizada: TareaTablero = { ...tareaMovida, columna_id: args.columnaDestinoId };
  const destinoConInsert = [...destinoBase];
  destinoConInsert.splice(indiceDestino, 0, tareaActualizada);

  const origenNormalizado = origen.map((t, i) => ({ ...t, posicion: i }));
  const destinoNormalizado = destinoConInsert.map((t, i) => ({ ...t, posicion: i }));

  return restantes.map((t) => {
    if (t.columna_id === args.columnaOrigenId)
      return origenNormalizado.find((item) => item.tarea_id === t.tarea_id) ?? t;
    if (t.columna_id === args.columnaDestinoId)
      return destinoNormalizado.find((item) => item.tarea_id === t.tarea_id) ?? t;
    return t;
  });
}

// ─── Helpers visuales ────────────────────────────────────────────────────────

const PALETA_AVATAR: { bg: string; text: string }[] = [
  { bg: 'bg-purple-100', text: 'text-purple-700' },
  { bg: 'bg-emerald-100', text: 'text-emerald-700' },
  { bg: 'bg-blue-100', text: 'text-blue-700' },
  { bg: 'bg-amber-100', text: 'text-amber-700' },
  { bg: 'bg-rose-100', text: 'text-rose-700' },
  { bg: 'bg-sky-100', text: 'text-sky-700' },
  { bg: 'bg-violet-100', text: 'text-violet-700' },
  { bg: 'bg-teal-100', text: 'text-teal-700' },
];

function colorAvatar(seed: string): { bg: string; text: string } {
  if (!seed) return PALETA_AVATAR[0];
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) | 0;
  return PALETA_AVATAR[Math.abs(hash) % PALETA_AVATAR.length];
}

const PALETA_EPICA = [
  'bg-indigo-50 text-indigo-700 ring-1 ring-indigo-200',
  'bg-pink-50 text-pink-700 ring-1 ring-pink-200',
  'bg-cyan-50 text-cyan-700 ring-1 ring-cyan-200',
  'bg-lime-50 text-lime-700 ring-1 ring-lime-200',
  'bg-fuchsia-50 text-fuchsia-700 ring-1 ring-fuchsia-200',
  'bg-orange-50 text-orange-700 ring-1 ring-orange-200',
];

function colorEpica(epicaId: string): string {
  let hash = 0;
  for (let i = 0; i < epicaId.length; i++) hash = (hash * 31 + epicaId.charCodeAt(i)) | 0;
  return PALETA_EPICA[Math.abs(hash) % PALETA_EPICA.length];
}

// Días hasta la fecha (negativo = vencida)
function diasHasta(fechaIso: string): number {
  const ymd = fechaIso.includes('T') ? fechaIso.slice(0, 10) : fechaIso.slice(0, 10);
  const [y, m, d] = ymd.split('-').map((n) => parseInt(n, 10));
  if (!y || !m || !d) return Infinity;
  const fecha = new Date(y, m - 1, d);
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  return Math.floor((fecha.getTime() - hoy.getTime()) / 86400000);
}

// ─── Chip helper ─────────────────────────────────────────────────────────────

function Chip({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-md px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide',
        className,
      )}
    >
      {children}
    </span>
  );
}

// ─── Card de tarea ────────────────────────────────────────────────────────────

function textoFechaLimiteTarjeta(fecha: string): string {
  const ymd = fecha.includes('T') ? fecha.slice(0, 10) : fecha.slice(0, 10);
  const [y, m, d] = ymd.split('-').map((n) => parseInt(n, 10));
  if (!y || !m || !d) return ymd;
  return new Date(y, m - 1, d).toLocaleDateString('es', {
    day: 'numeric',
    month: 'short',
  });
}

function textoTiempoRestante(diasRestantes: number, esFinal?: boolean): string {
  if (esFinal) return 'Completada';
  if (diasRestantes === 0) return 'Vence hoy';
  if (diasRestantes < 0) {
    const dias = Math.abs(diasRestantes);
    return `${dias} día${dias === 1 ? '' : 's'} de retraso`;
  }
  return `Faltan ${diasRestantes} día${diasRestantes === 1 ? '' : 's'}`;
}

function etiquetaActividad(tipo: string): string {
  switch (tipo) {
    case 'tarea_creada':
      return 'Tarea creada';
    case 'columna_cambiada':
      return 'Cambio de columna';
    case 'titulo_cambiado':
      return 'Título actualizado';
    case 'descripcion_cambiada':
      return 'Descripción actualizada';
    case 'prioridad_cambiada':
      return 'Prioridad actualizada';
    case 'responsable_cambiado':
      return 'Responsable actualizado';
    case 'etiqueta_agregada':
      return 'Etiqueta agregada';
    case 'etiqueta_removida':
      return 'Etiqueta removida';
    case 'comentario_agregado':
      return 'Comentario agregado';
    case 'comentario_editado':
      return 'Comentario editado';
    case 'comentario_eliminado':
      return 'Comentario eliminado';
    case 'commit_detectado':
      return 'Commit detectado';
    default:
      return tipo.replaceAll('_', ' ');
  }
}
void etiquetaActividad;

function obtenerSubDesdeToken(token: string | null): string | null {
  if (!token) return null;
  try {
    const parts = token.split('.');
    if (parts.length < 2) return null;
    const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const payload = JSON.parse(atob(base64));
    return typeof payload?.sub === 'string' ? payload.sub : null;
  } catch {
    return null;
  }
}
void obtenerSubDesdeToken;

function KanbanTareaCard({
  tarea,
  onVerDetalle,
  epica,
  responsable,
  etiquetas,
  esFinal,
}: {
  tarea: TareaTablero;
  onVerDetalle: (tarea: TareaTablero) => void;
  epica?: EpicaResumen | null;
  responsable?: MiembroProyectoResumen | null;
  etiquetas?: EtiquetaResumen[];
  esFinal?: boolean;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: tarea.tarea_id });

  const prioridad = PRIORIDAD[tarea.prioridad] ?? PRIORIDAD.media;
  const tipo = TIPO[tarea.tipo] ?? TIPO.tarea;
  const descripcionLimpia = tarea.descripcion?.trim() ?? '';
  const descripcionResumen = descripcionLimpia
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/\*\*|__|\*|_|~~/g, '')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/!\[([^\]]*)\]\([^)]+\)/g, '$1')
    .replace(/^\s*[-*+]\s+/gm, '')
    .replace(/^\s*\d+\.\s+/gm, '')
    .replace(/\n+/g, ' ')
    .trim();

  const style = { transform: CSS.Transform.toString(transform), transition };

  // Estado de fecha: vencida / hoy / próxima / normal
  const diasRestantes = tarea.fecha_limite ? diasHasta(tarea.fecha_limite) : null;
  const fechaVencida = diasRestantes !== null && diasRestantes < 0 && !esFinal;
  const fechaHoy = diasRestantes === 0;
  const fechaProxima = diasRestantes !== null && diasRestantes > 0 && diasRestantes <= 3;

  // Avatar del responsable
  const nombreResponsable = responsable?.nombre_visible || responsable?.correo || '';
  const coloresAvatar = colorAvatar(responsable?.usuario_id ?? '');

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        'group relative rounded-xl border border-stone-200 border-l-[4px] bg-white p-4 shadow-sm transition-all',
        prioridad.border,
        esFinal && 'bg-emerald-50/10 opacity-80',
        isDragging ? 'z-50 opacity-60 rotate-2 shadow-xl ring-2 ring-purple-300' : 'hover:border-stone-300 hover:shadow-md active:scale-[0.98]',
      )}
    >
      {/* Drag handle */}
      <button
        ref={setActivatorNodeRef}
        type="button"
        className="absolute right-2 top-2.5 cursor-grab text-stone-300 opacity-0 transition-opacity group-hover:opacity-100 active:cursor-grabbing"
        title="Arrastrar"
        {...attributes}
        {...listeners}
      >
        <GripVertical size={14} />
      </button>

      {/* Chip épica (top) */}
      {epica && (
        <div className="mb-1.5 flex items-center gap-1 pr-5">
          <span
            className={cn(
              'inline-flex max-w-full items-center gap-1 truncate rounded px-1.5 py-0.5 text-[10px] font-semibold',
              colorEpica(epica.epica_id),
            )}
            title={epica.titulo}
          >
            <Bookmark size={9} className="shrink-0" />
            <span className="truncate">{epica.titulo}</span>
          </span>
        </div>
      )}

      {/* Título y vista previa de descripción */}
      <button
        type="button"
        className="mb-0 w-full pr-5 text-left"
        onClick={() => onVerDetalle(tarea)}
      >
        <p
          className={cn(
            'line-clamp-2 break-words text-[14px] font-bold leading-tight tracking-tight transition-colors group-hover:text-purple-800',
            esFinal ? 'text-stone-600 line-through decoration-stone-300 decoration-1' : 'text-stone-800',
          )}
        >
          {tarea.titulo}
        </p>
        {descripcionResumen ? (
          <p
            className="mt-1.5 line-clamp-2 break-words text-[12px] leading-relaxed text-stone-500"
            title={descripcionResumen.length > 160 ? descripcionResumen : undefined}
          >
            {descripcionResumen}
          </p>
        ) : null}
      </button>

      {/* Etiquetas */}
      {etiquetas && etiquetas.length > 0 ? (
        <div className="mt-2 flex flex-wrap gap-1">
          {etiquetas.slice(0, 3).map((etq) => (
            <span
              key={etq.etiqueta_id}
              className="inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-semibold text-white"
              style={{ backgroundColor: etq.color }}
              title={etq.nombre}
            >
              {etq.nombre}
            </span>
          ))}
          {etiquetas.length > 3 ? (
            <span className="inline-flex items-center rounded bg-stone-100 px-1.5 py-0.5 text-[10px] font-semibold text-stone-500">
              +{etiquetas.length - 3}
            </span>
          ) : null}
        </div>
      ) : null}

      {/* Metadatos */}
      <div className="mt-2.5 flex flex-wrap items-center gap-1.5 border-t border-stone-100 pt-2">
        <Chip className={tipo.chip}>{tipo.label}</Chip>
        <Chip className={prioridad.chip}>
          <span className={cn('mr-1 inline-block h-1.5 w-1.5 rounded-full', prioridad.dot)} />
          {prioridad.label}
        </Chip>

        <span className="ml-auto flex items-center gap-1.5">
          {tarea.fecha_limite ? (
            <span
              className={cn(
                'inline-flex flex-col items-end rounded-md px-1.5 py-0.5 text-[10px] font-medium tabular-nums ring-1',
                fechaVencida
                  ? 'bg-red-50 text-red-700 ring-red-200'
                  : fechaHoy
                    ? 'bg-amber-50 text-amber-700 ring-amber-200'
                    : fechaProxima
                      ? 'bg-orange-50 text-orange-600 ring-orange-100'
                      : 'bg-stone-50 text-stone-500 ring-stone-100',
              )}
              title={`Fecha límite: ${tarea.fecha_limite}`}
            >
              <span className="inline-flex items-center gap-1">
                <Calendar size={10} className="shrink-0 opacity-70" />
                {textoFechaLimiteTarjeta(tarea.fecha_limite)}
              </span>
              {diasRestantes !== null ? (
                <span className="text-[9px] opacity-85">
                  {textoTiempoRestante(diasRestantes, esFinal)}
                </span>
              ) : null}
            </span>
          ) : null}

          {/* Avatar responsable */}
          {responsable ? (
            <span
              className={cn(
                'flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold',
                coloresAvatar.bg,
                coloresAvatar.text,
              )}
              title={nombreResponsable}
            >
              {nombreResponsable[0]?.toUpperCase() ?? '?'}
            </span>
          ) : null}
        </span>
      </div>
    </div>
  );
}

// ─── Columna Kanban ───────────────────────────────────────────────────────────

const COLUMN_ACCENT = [
  'bg-sky-500',
  'bg-violet-500',
  'bg-amber-500',
  'bg-rose-500',
  'bg-teal-500',
  'bg-indigo-500',
];

function KanbanColumna({
  columnaId,
  titulo,
  tareas,
  totalSinFiltrar,
  index,
  esFinal,
  epicasPorId,
  miembrosPorId,
  etiquetasPorTarea,
  onAbrirNuevaTarea,
  onVerDetalle,
}: {
  columnaId: string;
  titulo: string;
  tareas: TareaTablero[];
  totalSinFiltrar: number;
  index: number;
  esFinal?: boolean;
  epicasPorId: Map<string, EpicaResumen>;
  miembrosPorId: Map<string, MiembroProyectoResumen>;
  etiquetasPorTarea: Map<string, EtiquetaResumen[]>;
  onAbrirNuevaTarea: (columnaId: string) => void;
  onVerDetalle: (tarea: TareaTablero) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: `col:${columnaId}` });
  const accentColor = esFinal ? 'bg-emerald-500' : (COLUMN_ACCENT[index % COLUMN_ACCENT.length] ?? 'bg-purple-500');
  const totalCriticas = tareas.filter((t) => t.prioridad === 'critica').length;
  const ocultasPorFiltro = totalSinFiltrar - tareas.length;

  return (
    <div
      className={cn(
        'flex w-[310px] shrink-0 flex-col self-stretch rounded-2xl border bg-stone-50/50 shadow-sm transition-all',
        'min-h-[480px]',
        isOver ? 'border-purple-300 bg-purple-100/40 shadow-md ring-2 ring-purple-100' : 'border-stone-200',
      )}
    >
      {/* Accent bar */}
      <div className={cn('h-1.5 w-full shrink-0 rounded-t-2xl opacity-80', accentColor)} />

      {/* Header */}
      <div className="sticky top-0 z-10 flex shrink-0 items-center justify-between gap-2 border-b border-stone-200/50 bg-stone-50/90 px-4 py-3 backdrop-blur-md rounded-t-2xl">
        <div className="flex min-w-0 items-center gap-2">
          {esFinal ? (
            <CheckCircle2 size={13} className="shrink-0 text-emerald-500" />
          ) : (
            <span className={cn('h-2 w-2 shrink-0 rounded-full', accentColor)} />
          )}
          <h3
            className={cn(
              'truncate text-[13px] font-semibold tracking-tight',
              esFinal ? 'text-emerald-700' : 'text-stone-700',
            )}
          >
            {titulo}
          </h3>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          {totalCriticas > 0 ? (
            <span
              title={`${totalCriticas} tarea${totalCriticas > 1 ? 's' : ''} crítica${totalCriticas > 1 ? 's' : ''}`}
              className="inline-flex items-center gap-0.5 rounded-full bg-red-100 px-1.5 py-0.5 text-[10px] font-bold text-red-600"
            >
              <AlertCircle size={9} />
              {totalCriticas}
            </span>
          ) : null}
          <span className="flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-white px-1.5 text-[11px] font-semibold text-stone-600 ring-1 ring-stone-200">
            {tareas.length}
          </span>
        </div>
      </div>

      {/* Task list — grows with content, no internal scroll cap */}
      <div
        ref={setNodeRef}
        className={cn(
          'flex-1 px-2 pb-2 transition-colors',
          isOver && 'bg-purple-50/40',
        )}
      >
        <SortableContext items={tareas.map((t) => t.tarea_id)} strategy={verticalListSortingStrategy}>
          <div className="space-y-3 pt-3">
            {tareas.map((tarea) => (
              <KanbanTareaCard
                key={tarea.tarea_id}
                tarea={tarea}
                onVerDetalle={onVerDetalle}
                epica={tarea.epica_id ? epicasPorId.get(tarea.epica_id) : null}
                responsable={tarea.responsable_id ? miembrosPorId.get(tarea.responsable_id) : null}
                etiquetas={etiquetasPorTarea.get(tarea.tarea_id) ?? []}
                esFinal={esFinal}
              />
            ))}
            {tareas.length === 0 ? (
              <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-stone-300 px-3 py-8 text-center">
                <Layers size={18} className="mb-1.5 text-stone-300" />
                <p className="text-[11px] text-stone-400">
                  {ocultasPorFiltro > 0 ? `${ocultasPorFiltro} tarea${ocultasPorFiltro !== 1 ? 's' : ''} oculta por filtros` : 'Sin tareas'}
                </p>
              </div>
            ) : ocultasPorFiltro > 0 ? (
              <p className="pt-1 text-center text-[10px] italic text-stone-400">
                +{ocultasPorFiltro} oculta{ocultasPorFiltro !== 1 ? 's' : ''} por filtros
              </p>
            ) : null}
          </div>
        </SortableContext>
      </div>

      {/* Add task */}
      <div className="shrink-0 p-3">
        <button
          type="button"
          onClick={() => onAbrirNuevaTarea(columnaId)}
          className="flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-stone-200 py-3 text-[13px] font-bold text-stone-400 transition-all hover:border-purple-300 hover:bg-white hover:text-purple-700 hover:shadow-sm active:scale-95"
        >
          <Plus size={13} />
          Nueva tarea
        </button>
      </div>
    </div>
  );
}

// ─── Helpers de UI ───────────────────────────────────────────────────────────

function FieldLabel({ children }: { children: React.ReactNode }) {
  return <label className="block text-[11px] font-semibold uppercase tracking-wide text-stone-400">{children}</label>;
}

function CampoDescripcionMarkdown({
  value,
  onChange,
  disabled,
  placeholder,
}: {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  placeholder: string;
}) {
  return (
    <div className="space-y-1.5">
      <div
        className={cn(
          'rounded-lg border border-stone-200 bg-white overflow-hidden',
          disabled && 'opacity-70',
        )}
      >
        <div className="min-h-[180px] max-h-[500px] overflow-y-auto [&_.bn-editor]:min-h-[180px] [&_.bn-editor]:px-4 [&_.bn-editor]:py-3">
          <EditorDocumentoBlockNote
            initialMarkdown={value}
            onMarkdownChange={onChange}
            editable={!disabled}
          />
        </div>
      </div>
      <p className="text-[11px] text-stone-400">
        Usa <kbd className="rounded bg-stone-100 px-1 font-mono text-[10px] text-stone-600">/</kbd>
        {' '}para encabezados, listas, código, tablas{placeholder ? ` · ${placeholder}` : ''}
      </p>
    </div>
  );
}

function BloqueDescripcionTrello({
  value,
  onChange,
  disabled,
  editando,
  onToggleEditar,
}: {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  editando: boolean;
  onToggleEditar: (v: boolean) => void;
}) {
  const vacio = !value?.trim();
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <MessageSquare size={14} className="text-stone-400" />
          <h3 className="text-[13px] font-semibold text-stone-700">Descripción</h3>
        </div>
        {!disabled && (
          <button
            type="button"
            className={cn(
              'rounded-md px-2.5 py-1 text-[11px] font-semibold transition-all',
              editando
                ? 'bg-purple-600 text-white shadow-sm ring-1 ring-purple-700/20'
                : 'text-purple-600 hover:bg-purple-50',
            )}
            onClick={() => onToggleEditar(!editando)}
          >
            {editando ? 'Finalizar edición' : vacio ? 'Añadir descripción' : 'Editar'}
          </button>
        )}
      </div>

      <div
        className={cn(
          'overflow-hidden rounded-xl border bg-white transition-all',
          editando ? 'border-purple-200 shadow-inner' : 'border-stone-200',
        )}
      >
        <div className={cn('px-3 py-3', editando ? 'min-h-[360px]' : 'min-h-[180px]')}>
          {vacio && !editando ? (
            <button
              onClick={() => onToggleEditar(true)}
              className="flex w-full flex-col items-center justify-center py-12 text-stone-300 transition-colors hover:text-purple-400"
            >
              <Plus size={32} strokeWidth={1.5} />
              <span className="mt-2 px-6 text-center text-[13px] font-medium">
                Haz clic para añadir detalles técnicos, criterios de aceptación o documentación...
              </span>
            </button>
          ) : (
            <EditorDocumentoBlockNote
              initialMarkdown={value}
              onMarkdownChange={onChange}
              editable={editando && !disabled}
            />
          )}
        </div>
      </div>

      <p className="text-[11px] text-stone-400">
        Usa <kbd className="rounded bg-stone-100 px-1 font-mono text-[10px] text-stone-600">/</kbd>{' '}
        para insertar títulos, listas, tablas, código y más
        {!editando ? ' (activa "Editar" para usar atajos)' : ''}.
      </p>
    </div>
  );
}
void BloqueDescripcionTrello;

const SELECT_REF_PANEL =
  'h-8 w-full max-w-full min-w-0 rounded-lg border border-stone-200 bg-white px-2 text-[13px] outline-none focus-visible:ring-2 focus-visible:ring-purple-300 disabled:opacity-50';

function BloqueSelectorEpica({
  epicaId,
  onEpicaChange,
  epicasLista,
  epicasLoading,
  bloqueado,
  nuevaEpicaUi,
  setNuevaEpicaUi,
  setErrorCrearEpica,
  crearEpicaPending,
  onSubmitNuevaEpica,
  errorCrearEpica,
}: {
  epicaId: string;
  onEpicaChange: (id: string) => void;
  epicasLista: EpicaResumen[] | undefined;
  epicasLoading: boolean;
  bloqueado?: boolean;
  nuevaEpicaUi: { abierto: boolean; titulo: string };
  setNuevaEpicaUi: Dispatch<SetStateAction<{ abierto: boolean; titulo: string }>>;
  setErrorCrearEpica: (msg: string | null) => void;
  crearEpicaPending: boolean;
  onSubmitNuevaEpica: () => void;
  errorCrearEpica: string | null;
}) {
  const desactivado = Boolean(bloqueado);
  return (
    <div className="space-y-1">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <FieldLabel>Épica</FieldLabel>
        <button
          type="button"
          onClick={() => {
            setNuevaEpicaUi((p) => ({ ...p, abierto: !p.abierto }));
            setErrorCrearEpica(null);
          }}
          disabled={desactivado}
          className="text-[11px] font-medium text-purple-600 hover:text-purple-800 disabled:opacity-40"
        >
          {nuevaEpicaUi.abierto ? 'Cerrar' : 'Nueva épica'}
        </button>
      </div>
      {nuevaEpicaUi.abierto ? (
        <div className="flex flex-col gap-2 rounded-lg border border-stone-200 bg-stone-50/80 p-2">
          <Input
            value={nuevaEpicaUi.titulo}
            onChange={(e) => setNuevaEpicaUi((p) => ({ ...p, titulo: e.target.value }))}
            placeholder="Título de la épica"
            className="text-[13px]"
            disabled={crearEpicaPending || desactivado}
          />
          <Button
            type="button"
            size="sm"
            className="w-full"
            disabled={desactivado || crearEpicaPending || !nuevaEpicaUi.titulo.trim()}
            onClick={onSubmitNuevaEpica}
          >
            {crearEpicaPending ? (
              <span className="inline-flex items-center gap-1.5">
                <LoaderCircle size={12} className="animate-spin" />
                Creando…
              </span>
            ) : (
              'Crear épica'
            )}
          </Button>
          {errorCrearEpica ? (
            <p className="text-[11px] text-red-600">{errorCrearEpica}</p>
          ) : null}
        </div>
      ) : null}
      <select
        value={epicaId}
        onChange={(e) => onEpicaChange(e.target.value)}
        className={SELECT_REF_PANEL}
        disabled={epicasLoading || desactivado}
      >
        <option value="">Sin épica</option>
        {epicaId.trim() &&
        !(epicasLista ?? []).some((e) => e.epica_id === epicaId.trim()) ? (
          <option value={epicaId}>Épica guardada ({epicaId.slice(0, 8)}…)</option>
        ) : null}
        {(epicasLista ?? []).map((e) => (
          <option key={e.epica_id} value={e.epica_id}>
            {e.titulo}
          </option>
        ))}
      </select>
    </div>
  );
}

// ─── Page principal ───────────────────────────────────────────────────────────

export function TableroPage() {
  const { proyectoId } = useParams<{ proyectoId: string }>();
  const token = useAuthStore((s) => s.token);
  const setProyectoActivo = useAuthStore((s) => s.setProyectoActivo);
  const pushToast = useToastStore((s) => s.pushToast);
  const usuarioActualId = useMemo(() => obtenerSubDesdeToken(token), [token]);
  const queryClient = useQueryClient();
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  const [columnaCrearId, setColumnaCrearId] = useState<string | null>(null);
  const [errorCrearTarea, setErrorCrearTarea] = useState<string | null>(null);
  const [formNuevaTarea, setFormNuevaTarea] = useState<FormNuevaTareaState>(estadoInicialNuevaTarea());
  const [tareaDetalle, setTareaDetalle] = useState<TareaTablero | null>(null);
  const [formEdicion, setFormEdicion] = useState<FormNuevaTareaState | null>(null);
  const [columnaEdicionId, setColumnaEdicionId] = useState<string | null>(null);
  const [errorEdicion, setErrorEdicion] = useState<string | null>(null);
  const [confirmarEliminar, setConfirmarEliminar] = useState(false);
  const [panelActivo, setPanelActivo] = useState<'crear' | 'detalle' | null>(null);
  const [nuevaEpicaUi, setNuevaEpicaUi] = useState({ abierto: false, titulo: '' });
  const [errorCrearEpica, setErrorCrearEpica] = useState<string | null>(null);
  const [nuevaEtiquetaUi, setNuevaEtiquetaUi] = useState({ nombre: '', color: '#7c3aed' });
  const [edicionEtiquetaUi, setEdicionEtiquetaUi] = useState<{
    etiqueta_id: string | null;
    nombre: string;
    color: string;
  }>({ etiqueta_id: null, nombre: '', color: '#7c3aed' });
  const [errorEtiqueta, setErrorEtiqueta] = useState<string | null>(null);
  const [nuevoComentario, setNuevoComentario] = useState('');
  const [errorComentario, setErrorComentario] = useState<string | null>(null);
  const [comentarioEditando, setComentarioEditando] = useState<ComentarioTareaResumen | null>(null);
  const [contenidoComentarioEdicion, setContenidoComentarioEdicion] = useState('');
  void usuarioActualId;
  void errorEdicion;
  void errorEtiqueta;
  void errorComentario;
  void comentarioEditando;
  void contenidoComentarioEdicion;

  // Filtros del tablero
  const [buscarTexto, setBuscarTexto] = useState('');
  const [filtroPrioridad, setFiltroPrioridad] = useState<'todas' | 'critica' | 'alta' | 'media' | 'baja'>('todas');
  const [filtroTipo, setFiltroTipo] = useState<'todos' | 'tarea' | 'subtarea' | 'error'>('todos');
  const [filtroEpica, setFiltroEpica] = useState<string>('todas');
  const [filtroResponsable, setFiltroResponsable] = useState<string>('todos');
  const [soloVencidas, setSoloVencidas] = useState(false);
  const [vistaTablero, setVistaTablero] = useState<'kanban' | 'timeline' | 'lista' | 'matriz'>(
    'kanban',
  );

  useEffect(() => {
    if (proyectoId) setProyectoActivo(proyectoId);
  }, [proyectoId, setProyectoActivo]);

  useEffect(() => {
    const key = `tablero-vista:${proyectoId ?? 'global'}`;
    const guardada = localStorage.getItem(key);
    if (guardada === 'kanban' || guardada === 'timeline' || guardada === 'lista' || guardada === 'matriz') {
      setVistaTablero(guardada);
    }
  }, [proyectoId]);

  useEffect(() => {
    const key = `tablero-vista:${proyectoId ?? 'global'}`;
    localStorage.setItem(key, vistaTablero);
  }, [proyectoId, vistaTablero]);

  useEffect(() => {
    setNuevaEpicaUi({ abierto: false, titulo: '' });
    setErrorCrearEpica(null);
  }, [panelActivo]);

  const columnas = useQuery({
    queryKey: ['tablero-columnas', proyectoId, token],
    queryFn: () => tableroService.obtenerColumnas(proyectoId as string, token as string),
    enabled: Boolean(proyectoId && token),
  });

  const tareas = useQuery({
    queryKey: ['tablero-tareas', proyectoId, token],
    queryFn: () => tableroService.obtenerTareas(proyectoId as string, token as string),
    enabled: Boolean(proyectoId && token),
  });

  const epicas = useQuery({
    queryKey: ['tablero-epicas', proyectoId, token],
    queryFn: () => tableroService.obtenerEpicas(proyectoId as string, token as string),
    enabled: Boolean(proyectoId && token),
  });

  const miembrosProyecto = useQuery({
    queryKey: ['tablero-miembros', proyectoId, token],
    queryFn: () => tableroService.obtenerMiembrosProyecto(proyectoId as string, token as string),
    enabled: Boolean(proyectoId && token),
  });

  const etiquetas = useQuery({
    queryKey: ['tablero-etiquetas', proyectoId, token],
    queryFn: () => tableroService.obtenerEtiquetas(proyectoId as string, token as string),
    enabled: Boolean(proyectoId && token),
  });

  const tareasEtiquetas = useQuery({
    queryKey: ['tablero-tareas-etiquetas', proyectoId, token],
    queryFn: () => tableroService.obtenerEtiquetasPorTarea(proyectoId as string, token as string),
    enabled: Boolean(proyectoId && token),
  });

  const comentariosTarea = useQuery({
    queryKey: ['tablero-comentarios-tarea', tareaDetalle?.tarea_id, token],
    queryFn: () =>
      tableroService.obtenerComentariosPorTarea(tareaDetalle?.tarea_id as string, token as string),
    enabled: Boolean(tareaDetalle?.tarea_id && token && panelActivo === 'detalle'),
  });

  const actividadTarea = useQuery({
    queryKey: ['tablero-actividad-tarea', tareaDetalle?.tarea_id, token],
    queryFn: () =>
      tableroService.obtenerActividadPorTarea(tareaDetalle?.tarea_id as string, token as string),
    enabled: Boolean(tareaDetalle?.tarea_id && token && panelActivo === 'detalle'),
  });

  const crearEpica = useMutation({
    mutationFn: (args: { titulo: string; destino: 'crear' | 'detalle' }) =>
      tableroService.crearEpica(
        proyectoId as string,
        { titulo: args.titulo.trim() },
        token as string,
      ),
    onSuccess: (data, variables) => {
      setErrorCrearEpica(null);
      setNuevaEpicaUi({ abierto: false, titulo: '' });
      queryClient.invalidateQueries({ queryKey: ['tablero-epicas', proyectoId, token] });
      if (variables.destino === 'crear') {
        setFormNuevaTarea((prev) => ({ ...prev, epica_id: data.epica_id }));
      } else {
        setFormEdicion((prev) => (prev ? { ...prev, epica_id: data.epica_id } : prev));
      }
    },
    onError: () => {
      setErrorCrearEpica('No se pudo crear la épica.');
      pushToast({ type: 'error', message: 'No se pudo crear la épica.' });
    },
  });

  const crearEtiqueta = useMutation({
    mutationFn: () =>
      tableroService.crearEtiqueta(
        proyectoId as string,
        {
          nombre: nuevaEtiquetaUi.nombre.trim(),
          color: nuevaEtiquetaUi.color,
        },
        token as string,
      ),
    onSuccess: () => {
      setErrorEtiqueta(null);
      setNuevaEtiquetaUi({ nombre: '', color: '#7c3aed' });
      queryClient.invalidateQueries({ queryKey: ['tablero-etiquetas', proyectoId, token] });
      pushToast({ type: 'ok', message: 'Etiqueta creada correctamente.' });
    },
    onError: () => {
      setErrorEtiqueta('No se pudo crear la etiqueta.');
      pushToast({ type: 'error', message: 'No se pudo crear la etiqueta.' });
    },
  });

  const asignarEtiqueta = useMutation({
    mutationFn: (args: { tareaId: string; etiquetaId: string }) =>
      tableroService.asignarEtiquetaATarea(args.tareaId, args.etiquetaId, token as string),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tablero-tareas-etiquetas', proyectoId, token] });
    },
  });

  const quitarEtiqueta = useMutation({
    mutationFn: (args: { tareaId: string; etiquetaId: string }) =>
      tableroService.quitarEtiquetaDeTarea(args.tareaId, args.etiquetaId, token as string),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tablero-tareas-etiquetas', proyectoId, token] });
    },
  });

  const actualizarEtiqueta = useMutation({
    mutationFn: () =>
      tableroService.actualizarEtiqueta(
        proyectoId as string,
        edicionEtiquetaUi.etiqueta_id as string,
        {
          nombre: edicionEtiquetaUi.nombre.trim() || undefined,
          color: edicionEtiquetaUi.color,
        },
        token as string,
      ),
    onSuccess: () => {
      setErrorEtiqueta(null);
      setEdicionEtiquetaUi({ etiqueta_id: null, nombre: '', color: '#7c3aed' });
      queryClient.invalidateQueries({ queryKey: ['tablero-etiquetas', proyectoId, token] });
      pushToast({ type: 'ok', message: 'Etiqueta actualizada correctamente.' });
    },
    onError: () => {
      setErrorEtiqueta('No se pudo actualizar la etiqueta.');
      pushToast({ type: 'error', message: 'No se pudo actualizar la etiqueta.' });
    },
  });

  const eliminarEtiqueta = useMutation({
    mutationFn: (etiquetaId: string) =>
      tableroService.eliminarEtiqueta(proyectoId as string, etiquetaId, token as string),
    onSuccess: () => {
      setErrorEtiqueta(null);
      if (edicionEtiquetaUi.etiqueta_id) {
        setEdicionEtiquetaUi({ etiqueta_id: null, nombre: '', color: '#7c3aed' });
      }
      queryClient.invalidateQueries({ queryKey: ['tablero-etiquetas', proyectoId, token] });
      queryClient.invalidateQueries({ queryKey: ['tablero-tareas-etiquetas', proyectoId, token] });
      pushToast({ type: 'ok', message: 'Etiqueta eliminada correctamente.' });
    },
    onError: () => {
      setErrorEtiqueta('No se pudo eliminar la etiqueta.');
      pushToast({ type: 'error', message: 'No se pudo eliminar la etiqueta.' });
    },
  });

  const crearComentario = useMutation({
    mutationFn: (tareaId: string) =>
      tableroService.crearComentarioEnTarea(
        tareaId,
        { contenido: nuevoComentario.trim() },
        token as string,
      ),
    onSuccess: () => {
      setErrorComentario(null);
      setNuevoComentario('');
      queryClient.invalidateQueries({
        queryKey: ['tablero-comentarios-tarea', tareaDetalle?.tarea_id, token],
      });
      queryClient.invalidateQueries({
        queryKey: ['tablero-actividad-tarea', tareaDetalle?.tarea_id, token],
      });
      pushToast({ type: 'ok', message: 'Comentario agregado correctamente.' });
    },
    onError: () => {
      setErrorComentario('No se pudo crear el comentario.');
      pushToast({ type: 'error', message: 'No se pudo crear el comentario.' });
    },
  });

  const actualizarComentario = useMutation({
    mutationFn: (args: { tareaId: string; comentarioId: string; contenido: string }) =>
      tableroService.actualizarComentarioDeTarea(
        args.tareaId,
        args.comentarioId,
        { contenido: args.contenido },
        token as string,
      ),
    onSuccess: () => {
      setErrorComentario(null);
      setComentarioEditando(null);
      setContenidoComentarioEdicion('');
      queryClient.invalidateQueries({
        queryKey: ['tablero-comentarios-tarea', tareaDetalle?.tarea_id, token],
      });
      queryClient.invalidateQueries({
        queryKey: ['tablero-actividad-tarea', tareaDetalle?.tarea_id, token],
      });
      pushToast({ type: 'ok', message: 'Comentario actualizado correctamente.' });
    },
    onError: () => {
      setErrorComentario('No se pudo actualizar el comentario.');
      pushToast({ type: 'error', message: 'No se pudo actualizar el comentario.' });
    },
  });

  const eliminarComentario = useMutation({
    mutationFn: (args: { tareaId: string; comentarioId: string }) =>
      tableroService.eliminarComentarioDeTarea(args.tareaId, args.comentarioId, token as string),
    onSuccess: () => {
      setErrorComentario(null);
      queryClient.invalidateQueries({
        queryKey: ['tablero-comentarios-tarea', tareaDetalle?.tarea_id, token],
      });
      queryClient.invalidateQueries({
        queryKey: ['tablero-actividad-tarea', tareaDetalle?.tarea_id, token],
      });
      pushToast({ type: 'ok', message: 'Comentario eliminado correctamente.' });
    },
    onError: () => {
      setErrorComentario('No se pudo eliminar el comentario.');
      pushToast({ type: 'error', message: 'No se pudo eliminar el comentario.' });
    },
  });
  void crearEtiqueta;
  void actualizarEtiqueta;
  void eliminarEtiqueta;
  void actualizarComentario;
  void eliminarComentario;

  const reordenarTarea = useMutation({
    mutationFn: (args: { tareaId: string; columnaDestinoId: string; posicionDestino: number }) =>
      tableroService.reordenarTarea(
        args.tareaId,
        { columna_id: args.columnaDestinoId, posicion: args.posicionDestino },
        token as string,
      ),
    onMutate: async (args) => {
      const queryKey = ['tablero-tareas', proyectoId, token] as const;
      await queryClient.cancelQueries({ queryKey });
      const anteriores = queryClient.getQueryData<TareaTablero[]>(queryKey) ?? [];
      queryClient.setQueryData<TareaTablero[]>(queryKey, (actuales = []) => {
        const tarea = actuales.find((t) => t.tarea_id === args.tareaId);
        if (!tarea) return actuales;
        return reordenarTareasKanban(actuales, {
          tareaId: args.tareaId,
          columnaOrigenId: tarea.columna_id,
          columnaDestinoId: args.columnaDestinoId,
          overId: `col:${args.columnaDestinoId}`,
        });
      });
      return { anteriores, queryKey };
    },
    onError: (_error, _args, context) => {
      if (context?.anteriores) queryClient.setQueryData(context.queryKey, context.anteriores);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['tablero-tareas', proyectoId, token] });
    },
  });

  const crearTarea = useMutation({
    mutationFn: (args: {
      columnaId: string;
      valores: FormNuevaTareaState;
      posicion: number;
      columnasPorId: Map<string, ColumnaTablero>;
    }) =>
      tableroService.crearTarea(
        {
          proyecto_id: proyectoId as string,
          columna_id: args.columnaId,
          titulo: args.valores.titulo.trim(),
          descripcion: args.valores.descripcion.trim() || undefined,
          prioridad: args.valores.prioridad,
          tipo: args.valores.tipo,
          fecha_limite: args.valores.fecha_limite || undefined,
          epica_id: args.valores.epica_id || undefined,
          tarea_padre_id: args.valores.tarea_padre_id || undefined,
          responsable_id: args.valores.responsable_id || undefined,
        },
        token as string,
      ),
    onMutate: async (args) => {
      const queryKey = ['tablero-tareas', proyectoId, token] as const;
      await queryClient.cancelQueries({ queryKey });
      const anteriores = queryClient.getQueryData<TareaTablero[]>(queryKey) ?? [];
      const tareaTemporal: TareaTablero = {
        tarea_id: `temp-${Date.now()}`,
        proyecto_id: proyectoId as string,
        epica_id: null,
        tarea_padre_id: null,
        columna_id: args.columnaId,
        titulo: args.valores.titulo.trim(),
        descripcion: args.valores.descripcion.trim() || null,
        tipo: args.valores.tipo,
        prioridad: args.valores.prioridad,
        posicion: args.posicion,
        responsable_id: null,
        creado_por: 'yo',
        fecha_limite: args.valores.fecha_limite || null,
        creado_en: new Date().toISOString(),
        actualizado_en: new Date().toISOString(),
        completado_en: args.columnasPorId.get(args.columnaId)?.es_estado_final
          ? new Date().toISOString()
          : null,
      };
      queryClient.setQueryData<TareaTablero[]>(queryKey, (actuales = []) => [
        ...actuales,
        tareaTemporal,
      ]);
      return { anteriores, queryKey };
    },
    onError: (_error, _args, context) => {
      if (context?.anteriores) queryClient.setQueryData(context.queryKey, context.anteriores);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['tablero-tareas', proyectoId, token] });
    },
  });

  const actualizarTarea = useMutation({
    mutationFn: (args: { tareaId: string; payload: ActualizarTareaPayload }) =>
      tableroService.actualizarTarea(args.tareaId, args.payload, token as string),
    onSuccess: (data) => {
      setTareaDetalle(data);
      setFormEdicion(tareaToForm(data));
      setColumnaEdicionId(data.columna_id);
      setErrorEdicion(null);
      queryClient.invalidateQueries({ queryKey: ['tablero-tareas', proyectoId, token] });
      pushToast({ type: 'ok', message: 'Tarea actualizada correctamente.' });
    },
    onError: () => {
      setErrorEdicion('No se pudo guardar los cambios.');
      pushToast({ type: 'error', message: 'No se pudo actualizar la tarea.' });
    },
  });

  const eliminarTarea = useMutation({
    mutationFn: (tareaId: string) => tableroService.eliminarTarea(tareaId, token as string),
    onSuccess: () => {
      setConfirmarEliminar(false);
      setPanelActivo(null);
      setTareaDetalle(null);
      setFormEdicion(null);
      setColumnaEdicionId(null);
      setErrorEdicion(null);
      queryClient.invalidateQueries({ queryKey: ['tablero-tareas', proyectoId, token] });
      pushToast({ type: 'ok', message: 'Tarea eliminada correctamente.' });
    },
    onError: () => {
      setErrorEdicion('No se pudo eliminar la tarea.');
      pushToast({ type: 'error', message: 'No se pudo eliminar la tarea.' });
    },
  });

  useEffect(() => {
    if (panelActivo === 'detalle' && tareaDetalle) {
      setFormEdicion(tareaToForm(tareaDetalle));
      setColumnaEdicionId(tareaDetalle.columna_id);
      setErrorEdicion(null);
      setConfirmarEliminar(false);
      setNuevoComentario('');
      setErrorComentario(null);
      setComentarioEditando(null);
      setContenidoComentarioEdicion('');
    }
  }, [panelActivo, tareaDetalle?.tarea_id]);

  function obtenerColumnaDestino(overId: string): string | null {
    if (overId.startsWith('col:')) return overId.replace('col:', '');
    return (tareas.data ?? []).find((t) => t.tarea_id === overId)?.columna_id ?? null;
  }

  function manejarDragEnd(event: DragEndEvent) {
    const activeId = String(event.active.id);
    const overId = event.over ? String(event.over.id) : null;
    if (!overId) return;

    const tareaActiva = (tareas.data ?? []).find((t) => t.tarea_id === activeId);
    if (!tareaActiva) return;

    const columnaDestinoId = obtenerColumnaDestino(overId);
    if (!columnaDestinoId) return;

    const tareasDestinoSinActiva = (tareasPorColumna.get(columnaDestinoId) ?? []).filter(
      (t) => t.tarea_id !== tareaActiva.tarea_id,
    );
    const posicionDestino = overId.startsWith('col:')
      ? tareasDestinoSinActiva.length
      : (() => {
          const indice = tareasDestinoSinActiva.findIndex((t) => t.tarea_id === overId);
          return indice >= 0 ? indice : tareasDestinoSinActiva.length;
        })();

    reordenarTarea.mutate({ tareaId: tareaActiva.tarea_id, columnaDestinoId, posicionDestino });
  }

  const tareasPorColumna = useMemo(() => {
    const mapa = new Map<string, TareaTablero[]>();
    for (const columna of columnas.data ?? []) mapa.set(columna.columna_id, []);
    for (const tarea of tareas.data ?? []) {
      const existentes = mapa.get(tarea.columna_id) ?? [];
      existentes.push(tarea);
      mapa.set(tarea.columna_id, existentes);
    }
    for (const [columnaId, listado] of mapa.entries()) {
      mapa.set(
        columnaId,
        [...listado].sort((a, b) =>
          a.posicion === b.posicion
            ? a.tarea_id.localeCompare(b.tarea_id)
            : a.posicion - b.posicion,
        ),
      );
    }
    return mapa;
  }, [columnas.data, tareas.data]);

  const columnasPorId = useMemo(
    () => new Map((columnas.data ?? []).map((col) => [col.columna_id, col])),
    [columnas.data],
  );

  const epicasPorId = useMemo(
    () => new Map((epicas.data ?? []).map((e) => [e.epica_id, e])),
    [epicas.data],
  );

  const miembrosPorId = useMemo(
    () => new Map((miembrosProyecto.data ?? []).map((m) => [m.usuario_id, m])),
    [miembrosProyecto.data],
  );

  const etiquetasLista = useMemo<EtiquetaResumen[]>(
    () => (Array.isArray(etiquetas.data) ? etiquetas.data : []),
    [etiquetas.data],
  );

  const tareasEtiquetasLista = useMemo<TareaEtiquetaResumen[]>(
    () => (Array.isArray(tareasEtiquetas.data) ? tareasEtiquetas.data : []),
    [tareasEtiquetas.data],
  );

  const comentariosLista = useMemo<ComentarioTareaResumen[]>(
    () => (Array.isArray(comentariosTarea.data) ? comentariosTarea.data : []),
    [comentariosTarea.data],
  );

  const actividadLista = useMemo<TareaActividadResumen[]>(
    () => (Array.isArray(actividadTarea.data) ? actividadTarea.data : []),
    [actividadTarea.data],
  );
  void actividadLista;

  const etiquetasPorId = useMemo(
    () => new Map(etiquetasLista.map((e) => [e.etiqueta_id, e])),
    [etiquetasLista],
  );

  const etiquetasPorTarea = useMemo(() => {
    const mapa = new Map<string, EtiquetaResumen[]>();
    for (const te of tareasEtiquetasLista) {
      const etq = etiquetasPorId.get(te.etiqueta_id);
      if (!etq) continue;
      const actual = mapa.get(te.tarea_id) ?? [];
      actual.push(etq);
      mapa.set(te.tarea_id, actual);
    }
    return mapa;
  }, [tareasEtiquetasLista, etiquetasPorId]);

  // Filtros aplicados sobre las tareas visibles (no muta tareasPorColumna para no romper drag)
  const tareaPasaFiltros = (t: TareaTablero): boolean => {
    if (filtroPrioridad !== 'todas' && t.prioridad !== filtroPrioridad) return false;
    if (filtroTipo !== 'todos' && t.tipo !== filtroTipo) return false;
    if (filtroEpica !== 'todas') {
      if (filtroEpica === 'ninguna' ? t.epica_id : t.epica_id !== filtroEpica) return false;
    }
    if (filtroResponsable !== 'todos') {
      if (filtroResponsable === 'ninguno' ? t.responsable_id : t.responsable_id !== filtroResponsable) return false;
    }
    if (soloVencidas) {
      if (!t.fecha_limite) return false;
      const esFinal = columnasPorId.get(t.columna_id)?.es_estado_final;
      if (esFinal) return false;
      if (diasHasta(t.fecha_limite) >= 0) return false;
    }
    const q = buscarTexto.trim().toLowerCase();
    if (q) {
      const hay =
        t.titulo.toLowerCase().includes(q) ||
        (t.descripcion ?? '').toLowerCase().includes(q) ||
        t.tarea_id.toLowerCase().includes(q);
      if (!hay) return false;
    }
    return true;
  };

  const hayFiltrosActivos =
    buscarTexto.trim() !== '' ||
    filtroPrioridad !== 'todas' ||
    filtroTipo !== 'todos' ||
    filtroEpica !== 'todas' ||
    filtroResponsable !== 'todos' ||
    soloVencidas;

  const limpiarFiltros = () => {
    setBuscarTexto('');
    setFiltroPrioridad('todas');
    setFiltroTipo('todos');
    setFiltroEpica('todas');
    setFiltroResponsable('todos');
    setSoloVencidas(false);
  };

  const tareasParaElegirPadre = useMemo(
    () =>
      [...(tareas.data ?? [])]
        .filter((t) => !t.tarea_id.startsWith('temp-'))
        .sort((a, b) => a.titulo.localeCompare(b.titulo, 'es', { sensitivity: 'base' })),
    [tareas.data],
  );

  const tareasPadreEdicion = useMemo(() => {
    const id = tareaDetalle?.tarea_id;
    if (!id) return tareasParaElegirPadre;
    return tareasParaElegirPadre.filter((t) => t.tarea_id !== id);
  }, [tareasParaElegirPadre, tareaDetalle?.tarea_id]);

  function manejarCrearTarea(args: { columnaId: string; valores: FormNuevaTareaState }) {
    if (!proyectoId || !token) return;
    const posicion = (tareasPorColumna.get(args.columnaId)?.length ?? 0) + 1;
    crearTarea.mutate({ ...args, posicion, columnasPorId });
  }

  function abrirNuevaTarea(columnaId: string) {
    setColumnaCrearId(columnaId);
    setErrorCrearTarea(null);
    setFormNuevaTarea(estadoInicialNuevaTarea());
    setPanelActivo('crear');
  }

  function cerrarPanel() {
    setPanelActivo(null);
    setTareaDetalle(null);
    setFormEdicion(null);
    setColumnaEdicionId(null);
    setErrorEdicion(null);
    setConfirmarEliminar(false);
    setColumnaCrearId(null);
    setErrorCrearTarea(null);
    setNuevaEpicaUi({ abierto: false, titulo: '' });
    setErrorCrearEpica(null);
  }

  const isLoading = columnas.isLoading || tareas.isLoading;
  const totalTareas = tareas.data?.length ?? 0;
  const totalColumnas = columnas.data?.length ?? 0;

  // ── Select labels para el form
  const columnaCrearNombre = columnaCrearId
    ? (columnasPorId.get(columnaCrearId)?.nombre ?? '')
    : '';

  const totalCriticasTablero = (tareas.data ?? []).filter((t) => t.prioridad === 'critica').length;
  const tareasFiltradasGlobal = (tareas.data ?? []).filter(tareaPasaFiltros);
  const totalVencidas = (tareas.data ?? []).filter((t) => {
    if (!t.fecha_limite) return false;
    if (columnasPorId.get(t.columna_id)?.es_estado_final) return false;
    return diasHasta(t.fecha_limite) < 0;
  }).length;

  return (
    <div className="flex min-h-full flex-col gap-3">
      {/* ── HEADER ── */}
      <div className="shrink-0 rounded-xl border border-stone-200 bg-white px-5 py-3.5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-purple-600 shadow-sm">
              <SquareKanban size={17} className="text-white" />
            </div>
            <div>
              <h1 className="text-[15px] font-bold text-stone-900">Tablero Kanban</h1>
              <p className="mt-0.5 text-[12px] text-stone-400">
                Organiza las tareas del proyecto arrastrándolas entre columnas.
              </p>
            </div>
          </div>

          {/* Métricas + status */}
          <div className="flex flex-wrap items-center gap-4 text-[12px]">
            <div className="inline-flex items-center overflow-hidden rounded-lg border border-stone-200 bg-white">
              {([
                ['kanban', 'Kanban'],
                ['timeline', 'Timeline'],
                ['lista', 'Lista'],
                ['matriz', 'Matriz'],
              ] as const).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setVistaTablero(id)}
                  className={cn(
                    'px-2.5 py-1 text-[11px] font-medium transition',
                    vistaTablero === id
                      ? 'bg-purple-600 text-white'
                      : 'text-stone-600 hover:bg-stone-100',
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
            <span className="flex items-center gap-1.5">
              <Layers size={13} className="text-stone-400" />
              <span className="font-semibold text-stone-700">{totalColumnas}</span>
              <span className="text-stone-400">columna{totalColumnas !== 1 ? 's' : ''}</span>
            </span>
            <span className="flex items-center gap-1.5">
              <SquareKanban size={13} className="text-stone-400" />
              <span className="font-semibold text-stone-700">{totalTareas}</span>
              <span className="text-stone-400">tarea{totalTareas !== 1 ? 's' : ''}</span>
            </span>
            {totalCriticasTablero > 0 && (
              <span className="flex items-center gap-1.5 text-red-600">
                <AlertCircle size={13} />
                <span className="font-semibold">{totalCriticasTablero}</span>
                <span className="text-red-500/70">crítica{totalCriticasTablero !== 1 ? 's' : ''}</span>
              </span>
            )}
            {totalVencidas > 0 && (
              <button
                type="button"
                onClick={() => setSoloVencidas((v) => !v)}
                className={cn(
                  'flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-medium transition',
                  soloVencidas
                    ? 'bg-red-100 text-red-700 ring-1 ring-red-200'
                    : 'text-orange-600 hover:bg-orange-50',
                )}
                title="Filtrar solo tareas vencidas"
              >
                <Calendar size={12} />
                {totalVencidas} vencida{totalVencidas !== 1 ? 's' : ''}
              </button>
            )}
            {(reordenarTarea.isPending || crearTarea.isPending || actualizarTarea.isPending) && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-purple-50 px-2.5 py-1 text-[11px] text-purple-700 ring-1 ring-purple-100">
                <LoaderCircle size={11} className="animate-spin" />
                Sincronizando…
              </span>
            )}
            {isLoading && (
              <span className="inline-flex items-center gap-1.5 text-[11px] text-stone-400">
                <LoaderCircle size={11} className="animate-spin" />
                Cargando…
              </span>
            )}
          </div>
        </div>
      </div>

      {/* ── FILTROS ── */}
      <div className="flex shrink-0 flex-wrap items-center gap-2 rounded-xl border border-stone-200 bg-white px-3 py-2">
        <div className="flex items-center gap-1.5 text-[11px] font-semibold text-stone-500">
          <Filter size={12} />
          <span className="hidden sm:inline">Filtros</span>
        </div>
        <div className="relative min-w-[200px] flex-1">
          <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-stone-400" />
          <input
            type="text"
            value={buscarTexto}
            onChange={(e) => setBuscarTexto(e.target.value)}
            placeholder="Buscar por título, descripción o ID…"
            className="h-8 w-full rounded-lg border border-stone-200 bg-stone-50 pl-7 pr-3 text-[12px] outline-none transition focus:border-purple-300 focus:bg-white focus:ring-2 focus:ring-purple-200"
          />
        </div>
        <select
          value={filtroPrioridad}
          onChange={(e) => setFiltroPrioridad(e.target.value as typeof filtroPrioridad)}
          className="h-8 rounded-lg border border-stone-200 bg-white px-2 text-[12px] outline-none focus:ring-2 focus:ring-purple-200"
          title="Prioridad"
        >
          <option value="todas">Todas prioridades</option>
          <option value="critica">Crítica</option>
          <option value="alta">Alta</option>
          <option value="media">Media</option>
          <option value="baja">Baja</option>
        </select>
        <select
          value={filtroTipo}
          onChange={(e) => setFiltroTipo(e.target.value as typeof filtroTipo)}
          className="h-8 rounded-lg border border-stone-200 bg-white px-2 text-[12px] outline-none focus:ring-2 focus:ring-purple-200"
          title="Tipo"
        >
          <option value="todos">Todos los tipos</option>
          <option value="tarea">Tarea</option>
          <option value="subtarea">Subtarea</option>
          <option value="error">Error</option>
        </select>
        <select
          value={filtroEpica}
          onChange={(e) => setFiltroEpica(e.target.value)}
          className="h-8 rounded-lg border border-stone-200 bg-white px-2 text-[12px] outline-none focus:ring-2 focus:ring-purple-200"
          title="Épica"
        >
          <option value="todas">Todas las épicas</option>
          <option value="ninguna">Sin épica</option>
          {(epicas.data ?? []).map((e) => (
            <option key={e.epica_id} value={e.epica_id}>{e.titulo}</option>
          ))}
        </select>
        <select
          value={filtroResponsable}
          onChange={(e) => setFiltroResponsable(e.target.value)}
          className="h-8 rounded-lg border border-stone-200 bg-white px-2 text-[12px] outline-none focus:ring-2 focus:ring-purple-200"
          title="Responsable"
        >
          <option value="todos">Todos los responsables</option>
          <option value="ninguno">Sin asignar</option>
          {(miembrosProyecto.data ?? []).map((m) => (
            <option key={m.usuario_id} value={m.usuario_id}>{m.nombre_visible || m.correo}</option>
          ))}
        </select>
        {hayFiltrosActivos && (
          <button
            type="button"
            onClick={limpiarFiltros}
            className="inline-flex h-8 items-center gap-1 rounded-lg border border-stone-200 bg-white px-2.5 text-[11px] font-medium text-stone-600 transition hover:border-purple-200 hover:bg-purple-50 hover:text-purple-700"
          >
            <X size={11} />
            Limpiar
          </button>
        )}
      </div>

      {/* Board + panel — contenedor compartido */}
      <div className="flex overflow-hidden rounded-xl border border-stone-200 shadow-sm">
        {/* Kanban area — siempre flex-1, cede espacio al panel */}
        <div className="flex min-w-0 flex-1 overflow-x-auto bg-stone-50/70">
          {vistaTablero === 'kanban' ? (
            <DndContext
              sensors={sensors}
              collisionDetection={closestCorners}
              onDragEnd={manejarDragEnd}
            >
              <div className="flex items-stretch gap-3 px-4 py-3">
                {(columnas.data ?? []).map((columna, index) => {
                  const tareasColumna = tareasPorColumna.get(columna.columna_id) ?? [];
                  const tareasFiltradas = tareasColumna.filter(tareaPasaFiltros);
                  return (
                    <KanbanColumna
                      key={columna.columna_id}
                      columnaId={columna.columna_id}
                      titulo={columna.nombre}
                      tareas={tareasFiltradas}
                      totalSinFiltrar={tareasColumna.length}
                      index={index}
                      esFinal={columna.es_estado_final}
                      epicasPorId={epicasPorId}
                      miembrosPorId={miembrosPorId}
                      etiquetasPorTarea={etiquetasPorTarea}
                      onAbrirNuevaTarea={abrirNuevaTarea}
                      onVerDetalle={(tarea) => {
                        setTareaDetalle(tarea);
                        setFormEdicion(tareaToForm(tarea));
                        setColumnaEdicionId(tarea.columna_id);
                        setErrorEdicion(null);
                        setConfirmarEliminar(false);
                        setPanelActivo('detalle');
                      }}
                    />
                  );
                })}
              </div>
            </DndContext>
          ) : vistaTablero === 'lista' ? (
            <div className="w-full overflow-auto p-3">
              <table className="w-full min-w-[800px] border-separate border-spacing-y-1.5 text-[12px]">
                <thead>
                  <tr className="text-left text-[10px] uppercase tracking-widest text-stone-400">
                    <th className="px-4 py-2 font-bold">Título de la tarea</th>
                    <th className="px-4 py-2 font-bold">Estado</th>
                    <th className="px-4 py-2 font-bold text-center">Prioridad</th>
                    <th className="px-4 py-2 font-bold">Responsable</th>
                    <th className="px-4 py-2 font-bold text-right">Vencimiento</th>
                  </tr>
                </thead>
                <tbody>
                  {tareasFiltradasGlobal.map((t) => {
                    const responsable = t.responsable_id ? miembrosPorId.get(t.responsable_id) : null;
                    const nombreResp = responsable?.nombre_visible || responsable?.correo || 'Sin asignar';
                    const coloresAvatar = colorAvatar(t.responsable_id ?? nombreResp);
                    const col = columnasPorId.get(t.columna_id);
                    const diasRestantes = t.fecha_limite ? diasHasta(t.fecha_limite) : null;
                    const fechaVencida = diasRestantes !== null && diasRestantes < 0 && !col?.es_estado_final;
                    const fechaProxima = diasRestantes !== null && diasRestantes >= 0 && diasRestantes <= 3 && !col?.es_estado_final;

                    return (
                      <tr
                        key={t.tarea_id}
                        className="group cursor-pointer transition-all"
                        onClick={() => {
                          setTareaDetalle(t);
                          setFormEdicion(tareaToForm(t));
                          setColumnaEdicionId(t.columna_id);
                          setErrorEdicion(null);
                          setConfirmarEliminar(false);
                          setPanelActivo('detalle');
                        }}
                      >
                        {/* Título */}
                        <td className="rounded-l-xl border-y border-l border-stone-200 bg-white px-4 py-3 shadow-sm group-hover:border-purple-200 group-hover:bg-purple-50/30">
                          <div className="flex flex-col gap-0.5">
                            <span className={cn(
                              "text-[13px] font-semibold text-stone-800 transition-colors group-hover:text-purple-700",
                              col?.es_estado_final && "text-stone-400 line-through"
                            )}>
                              {t.titulo}
                            </span>
                            <span className="text-[10px] text-stone-400 uppercase font-medium">
                              {TIPO[t.tipo]?.label} · {t.tarea_id.slice(0, 8)}
                            </span>
                          </div>
                        </td>

                        {/* Estado */}
                        <td className="border-y border-stone-200 bg-white px-4 py-3 shadow-sm group-hover:border-purple-200 group-hover:bg-purple-50/30">
                          <div className="flex items-center gap-2">
                            <span className={cn(
                              "h-2 w-2 rounded-full",
                              col?.es_estado_final ? "bg-emerald-500" : "bg-purple-500"
                            )} />
                            <span className="font-medium text-stone-600">{col?.nombre}</span>
                          </div>
                        </td>

                        {/* Prioridad */}
                        <td className="border-y border-stone-200 bg-white px-4 py-3 text-center shadow-sm group-hover:border-purple-200 group-hover:bg-purple-50/30">
                          <Chip className={PRIORIDAD[t.prioridad]?.chip}>
                            {PRIORIDAD[t.prioridad]?.label}
                          </Chip>
                        </td>

                        {/* Responsable */}
                        <td className="border-y border-stone-200 bg-white px-4 py-3 shadow-sm group-hover:border-purple-200 group-hover:bg-purple-50/30">
                          <div className="flex items-center gap-2">
                            <div className={cn(
                              "flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-bold",
                              coloresAvatar.bg,
                              coloresAvatar.text
                            )}>
                              {nombreResp[0].toUpperCase()}
                            </div>
                            <span className="text-stone-600">{nombreResp}</span>
                          </div>
                        </td>

                        {/* Vencimiento */}
                        <td className="rounded-r-xl border-y border-r border-stone-200 bg-white px-4 py-3 text-right shadow-sm group-hover:border-purple-200 group-hover:bg-purple-50/30">
                          {t.fecha_limite ? (
                            <span className={cn(
                              "inline-flex items-center gap-1 font-medium",
                              fechaVencida ? "text-red-600" : fechaProxima ? "text-orange-600" : "text-stone-500"
                            )}>
                              <Calendar size={12} className="opacity-70" />
                              {textoFechaLimiteTarjeta(t.fecha_limite)}
                            </span>
                          ) : (
                            <span className="text-stone-300">—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : vistaTablero === 'timeline' ? (
            <div className="w-full overflow-auto p-3">
              <div className="mx-auto max-w-4xl space-y-8 py-4">
                {Object.entries(
                  tareasFiltradasGlobal.reduce<Record<string, TareaTablero[]>>((acc, t) => {
                    const resp = t.responsable_id ? miembrosPorId.get(t.responsable_id) : null;
                    const nombre = resp?.nombre_visible || resp?.correo || 'Sin asignar';
                    (acc[nombre] ||= []).push(t);
                    return acc;
                  }, {}),
                ).map(([persona, items]) => (
                  <div key={persona} className="relative">
                    {/* Encabezado del Responsable */}
                    <div className="mb-6 flex items-center gap-3">
                      <div className={cn(
                        "flex h-8 w-8 items-center justify-center rounded-full text-[12px] font-bold shadow-sm ring-2 ring-white",
                        colorAvatar(items[0]?.responsable_id ?? persona).bg,
                        colorAvatar(items[0]?.responsable_id ?? persona).text
                      )}>
                        {persona[0].toUpperCase()}
                      </div>
                      <div>
                        <h3 className="text-[14px] font-bold text-stone-800">{persona}</h3>
                        <p className="text-[11px] text-stone-400">{items.length} tarea{items.length !== 1 ? 's' : ''} asignada{items.length !== 1 ? 's' : ''}</p>
                      </div>
                    </div>

                    {/* Contenedor de la línea vertical */}
                    <div className="relative ml-4 border-l-2 border-stone-200 pl-8 space-y-6">
                      {items
                        .slice()
                        .sort((a, b) => (a.fecha_limite ?? '9999').localeCompare(b.fecha_limite ?? '9999'))
                        .map((t) => {
                          const col = columnasPorId.get(t.columna_id);
                          const esFinalTarea = Boolean(col?.es_estado_final);
                          const diasRestantesTimeline = t.fecha_limite ? diasHasta(t.fecha_limite) : null;
                          const fechaVencidaTimeline =
                            diasRestantesTimeline !== null && diasRestantesTimeline < 0 && !esFinalTarea;
                          const fechaHoyTimeline = diasRestantesTimeline === 0 && !esFinalTarea;
                          const fechaProximaTimeline =
                            diasRestantesTimeline !== null &&
                            diasRestantesTimeline > 0 &&
                            diasRestantesTimeline <= 3 &&
                            !esFinalTarea;
                          const descripcionTimeline = (t.descripcion ?? '').trim();
                          const descripcionTimelineResumen = descripcionTimeline
                            .replace(/```[\s\S]*?```/g, ' ')
                            .replace(/`([^`]+)`/g, '$1')
                            .replace(/^#{1,6}\s+/gm, '')
                            .replace(/\*\*|__|\*|_|~~/g, '')
                            .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
                            .replace(/!\[([^\]]*)\]\([^)]+\)/g, '$1')
                            .replace(/\n+/g, ' ')
                            .trim();
                          const etiquetasTimeline = etiquetasPorTarea.get(t.tarea_id) ?? [];

                          return (
                            <div key={t.tarea_id} className="relative group">
                            {/* Punto en la línea */}
                            <div className={cn(
                              "absolute -left-[41px] top-4 h-4 w-4 rounded-full border-4 border-white shadow-sm ring-1 ring-stone-200 transition-transform group-hover:scale-125",
                              esFinalTarea ? "bg-emerald-500" : "bg-purple-500"
                            )} />

                            {/* Tarjeta de Tarea */}
                            <button
                              type="button"
                              className="flex w-full flex-col gap-2 rounded-xl border border-stone-200 bg-white p-4 text-left shadow-sm transition-all hover:border-purple-300 hover:shadow-md active:scale-[0.99]"
                              onClick={() => {
                                setTareaDetalle(t);
                                setFormEdicion(tareaToForm(t));
                                setColumnaEdicionId(t.columna_id);
                                setPanelActivo('detalle');
                              }}
                            >
                              <div className="flex items-start justify-between gap-4">
                                <div className="min-w-0 flex-1">
                                  <span className={cn(
                                    "text-[13px] font-semibold leading-tight break-words text-stone-800 transition-colors group-hover:text-purple-700",
                                    esFinalTarea && "text-stone-400 line-through"
                                  )}>
                                    {t.titulo}
                                  </span>
                                </div>
                                <Chip className={PRIORIDAD[t.prioridad]?.chip}>
                                  {PRIORIDAD[t.prioridad]?.label}
                                </Chip>
                              </div>

                              {descripcionTimelineResumen ? (
                                <p className="line-clamp-2 text-[11px] text-stone-500">
                                  {descripcionTimelineResumen}
                                </p>
                              ) : null}

                              <div className="flex items-center gap-3 text-[11px] text-stone-400">
                                <span
                                  className={cn(
                                    "inline-flex items-center gap-1 rounded px-1.5 py-0.5",
                                    fechaVencidaTimeline
                                      ? 'bg-red-50 text-red-700'
                                      : fechaHoyTimeline
                                        ? 'bg-amber-50 text-amber-700'
                                        : fechaProximaTimeline
                                          ? 'bg-orange-50 text-orange-700'
                                          : 'bg-stone-50 text-stone-500',
                                  )}
                                >
                                  <Calendar size={12} />
                                  {t.fecha_limite ? textoFechaLimiteTarjeta(t.fecha_limite) : 'Sin fecha'}
                                </span>
                                {diasRestantesTimeline !== null ? (
                                  <>
                                    <span className="h-1 w-1 rounded-full bg-stone-300" />
                                    <span className="text-[10px] font-medium">
                                      {textoTiempoRestante(diasRestantesTimeline, esFinalTarea)}
                                    </span>
                                  </>
                                ) : null}
                                <span className="h-1 w-1 rounded-full bg-stone-300" />
                                <span>{col?.nombre}</span>
                              </div>

                              <div className="flex flex-wrap items-center gap-1.5">
                                <Chip className={TIPO[t.tipo]?.chip}>{TIPO[t.tipo]?.label}</Chip>
                                {etiquetasTimeline.slice(0, 2).map((etq) => (
                                  <span
                                    key={etq.etiqueta_id}
                                    className="inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-semibold text-white"
                                    style={{ backgroundColor: etq.color }}
                                  >
                                    {etq.nombre}
                                  </span>
                                ))}
                                {etiquetasTimeline.length > 2 ? (
                                  <span className="text-[10px] text-stone-400">
                                    +{etiquetasTimeline.length - 2}
                                  </span>
                                ) : null}
                              </div>
                            </button>
                          </div>
                          );
                        })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="w-full overflow-auto p-4">
              <div className="inline-block min-w-full align-middle">
                <table className="min-w-full border-separate border-spacing-0">
                  <thead>
                    <tr>
                      <th className="sticky left-0 z-20 border-b border-stone-200 bg-stone-50/90 px-4 py-3 text-left text-[10px] font-bold uppercase tracking-widest text-stone-500 backdrop-blur">
                        Épica / Iniciativa
                      </th>
                      {(columnas.data ?? []).map((c) => (
                        <th 
                          key={c.columna_id} 
                          className="border-b border-stone-200 bg-stone-50/90 px-4 py-3 text-center text-[10px] font-bold uppercase tracking-widest text-stone-500 backdrop-blur"
                        >
                          {c.nombre}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-100 bg-white">
                    {[...new Set(tareasFiltradasGlobal.map((t) => t.epica_id ?? 'sin-epica'))]
                      .sort((a, b) => {
                        if (a === 'sin-epica') return 1;
                        if (b === 'sin-epica') return -1;
                        return (epicasPorId.get(a)?.titulo || '').localeCompare(epicasPorId.get(b)?.titulo || '');
                      })
                      .map((eid) => {
                        const epica = epicasPorId.get(eid);
                        const nombreEpica = eid === 'sin-epica' ? 'Sin épica' : (epica?.titulo ?? 'Épica');
                        
                        return (
                          <tr key={eid} className="group hover:bg-stone-50/50">
                            <td className="sticky left-0 z-10 border-r border-stone-100 bg-white px-4 py-4 group-hover:bg-stone-50">
                              <div className="flex items-center gap-2">
                                <div className={cn(
                                  "flex h-6 w-6 shrink-0 items-center justify-center rounded-md",
                                  eid === 'sin-epica' ? "bg-stone-100 text-stone-400" : colorEpica(eid)
                                )}>
                                  <Bookmark size={12} />
                                </div>
                                <span className={cn(
                                  "text-[13px] font-semibold truncate max-w-[200px]",
                                  eid === 'sin-epica' ? "italic text-stone-400" : "text-stone-800"
                                )}>
                                  {nombreEpica}
                                </span>
                              </div>
                            </td>
                            {(columnas.data ?? []).map((c) => {
                              const tareasCelda = tareasFiltradasGlobal.filter(
                                (t) => (t.epica_id ?? 'sin-epica') === eid && t.columna_id === c.columna_id
                              );
                              const count = tareasCelda.length;
                              const hasCritica = tareasCelda.some(t => t.prioridad === 'critica');
                              
                              return (
                                <td key={c.columna_id} className="px-2 py-4 text-center">
                                  {count > 0 ? (
                                    <div className="relative inline-flex items-center justify-center">
                                      <div className={cn(
                                        "flex h-8 w-12 items-center justify-center rounded-lg border text-[13px] font-bold transition-all shadow-sm",
                                        c.es_estado_final 
                                          ? "border-emerald-100 bg-emerald-50 text-emerald-700" 
                                          : "border-purple-100 bg-purple-50 text-purple-700",
                                        hasCritica && "ring-2 ring-red-200 border-red-200"
                                      )}>
                                        {count}
                                      </div>
                                      {hasCritica && (
                                        <span className="absolute -right-1 -top-1 flex h-3 w-3">
                                          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75"></span>
                                          <span className="relative inline-flex h-3 w-3 rounded-full bg-red-500"></span>
                                        </span>
                                      )}
                                    </div>
                                  ) : (
                                    <span className="text-stone-200">—</span>
                                  )}
                                </td>
                              );
                            })}
                          </tr>
                        );
                      })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {isLoading && (
            <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
              <LoaderCircle size={20} className="animate-spin text-stone-300" />
            </div>
          )}
        </div>

        {/* Panel deslizante — ancho 0 cuando cerrado, anima al abrirse */}
        <div
          className="sticky top-0 shrink-0 self-start overflow-hidden border-l border-stone-200 bg-white transition-[width] duration-300 ease-in-out"
          style={{
            width: panelActivo === 'crear' ? 'min(450px, 100vw)' : '0',
            maxHeight: 'calc(100vh - 2rem)',
            height: panelActivo === 'crear' ? 'calc(100vh - 2rem)' : '0',
          }}
        >
          {/* El panel lateral ahora solo se usa para la creación de tareas */}
          <div className="flex h-full w-full min-w-0 max-w-[450px] flex-col">
            {/* ══ CREAR TAREA ══════════════════════════════════════════════ */}
            {panelActivo === 'crear' && columnaCrearId ? (
              <div className="flex h-full flex-col">
                <div className="flex shrink-0 items-center justify-between border-b border-stone-100 px-5 py-3.5">
                  <div>
                    <p className="text-[13px] font-semibold text-stone-800">Nueva tarea</p>
                    {columnaCrearNombre && (
                      <p className="text-[11px] text-stone-400">en columna: {columnaCrearNombre}</p>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={cerrarPanel}
                    className="rounded-md p-1 text-stone-400 transition hover:bg-stone-100 hover:text-stone-700"
                  >
                    <X size={15} />
                  </button>
                </div>

                <form
                  className="flex flex-1 min-h-0 flex-col"
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (!formNuevaTarea.titulo.trim()) {
                      setErrorCrearTarea('El título es obligatorio.');
                      return;
                    }
                    setErrorCrearTarea(null);
                    manejarCrearTarea({ columnaId: columnaCrearId, valores: formNuevaTarea });
                    cerrarPanel();
                  }}
                >
                  <div className="flex-1 min-h-0 space-y-3 overflow-y-auto px-5 py-4">
                    <div className="space-y-1">
                      <FieldLabel>Título *</FieldLabel>
                      <Input
                        value={formNuevaTarea.titulo}
                        onChange={(e) =>
                          setFormNuevaTarea((prev) => ({ ...prev, titulo: e.target.value }))
                        }
                        maxLength={300}
                        placeholder="Ej: Implementar login con refresh token"
                        className="text-[13px]"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <FieldLabel>Tipo</FieldLabel>
                        <select
                          value={formNuevaTarea.tipo}
                          onChange={(e) =>
                            setFormNuevaTarea((prev) => ({
                              ...prev,
                              tipo: e.target.value as FormNuevaTareaState['tipo'],
                            }))
                          }
                          className="h-8 w-full rounded-lg border border-stone-200 bg-white px-2 text-[13px] outline-none focus-visible:ring-2 focus-visible:ring-purple-300"
                        >
                          <option value="tarea">Tarea</option>
                          <option value="subtarea">Subtarea</option>
                          <option value="error">Error</option>
                        </select>
                      </div>
                      <div className="space-y-1">
                        <FieldLabel>Prioridad</FieldLabel>
                        <select
                          value={formNuevaTarea.prioridad}
                          onChange={(e) =>
                            setFormNuevaTarea((prev) => ({
                              ...prev,
                              prioridad: e.target.value as FormNuevaTareaState['prioridad'],
                            }))
                          }
                          className="h-8 w-full rounded-lg border border-stone-200 bg-white px-2 text-[13px] outline-none focus-visible:ring-2 focus-visible:ring-purple-300"
                        >
                          <option value="critica">Crítica</option>
                          <option value="alta">Alta</option>
                          <option value="media">Media</option>
                          <option value="baja">Baja</option>
                        </select>
                      </div>
                    </div>

                    <div className="space-y-1">
                      <FieldLabel>Fecha límite</FieldLabel>
                      <Input
                        type="date"
                        value={formNuevaTarea.fecha_limite}
                        onChange={(e) =>
                          setFormNuevaTarea((prev) => ({ ...prev, fecha_limite: e.target.value }))
                        }
                        className="text-[13px]"
                      />
                    </div>

                    <div className="space-y-1">
                      <FieldLabel>Descripción</FieldLabel>
                      <CampoDescripcionMarkdown
                        value={formNuevaTarea.descripcion}
                        onChange={(value) =>
                          setFormNuevaTarea((prev) => ({ ...prev, descripcion: value }))
                        }
                        placeholder="Contexto, criterios de aceptación, notas técnicas..."
                        disabled={false}
                      />
                    </div>

                    <details className="group">
                      <summary className="cursor-pointer select-none text-[11px] font-semibold uppercase tracking-wide text-stone-400 group-open:mb-2">
                        Campos opcionales
                      </summary>
                      <div className="space-y-2">
                        <BloqueSelectorEpica
                          epicaId={formNuevaTarea.epica_id}
                          onEpicaChange={(id) =>
                            setFormNuevaTarea((prev) => ({ ...prev, epica_id: id }))
                          }
                          epicasLista={epicas.data}
                          epicasLoading={epicas.isLoading}
                          nuevaEpicaUi={nuevaEpicaUi}
                          setNuevaEpicaUi={setNuevaEpicaUi}
                          setErrorCrearEpica={setErrorCrearEpica}
                          crearEpicaPending={crearEpica.isPending}
                          onSubmitNuevaEpica={() =>
                            crearEpica.mutate({
                              titulo: nuevaEpicaUi.titulo,
                              destino: 'crear',
                            })
                          }
                          errorCrearEpica={errorCrearEpica}
                        />
                        <div className="space-y-1">
                          <FieldLabel>Tarea padre</FieldLabel>
                          <select
                            value={formNuevaTarea.tarea_padre_id}
                            onChange={(e) =>
                              setFormNuevaTarea((prev) => ({
                                ...prev,
                                tarea_padre_id: e.target.value,
                              }))
                            }
                            className={SELECT_REF_PANEL}
                          >
                            <option value="">Ninguna</option>
                            {formNuevaTarea.tarea_padre_id.trim() &&
                            !tareasParaElegirPadre.some(
                              (t) => t.tarea_id === formNuevaTarea.tarea_padre_id.trim(),
                            ) ? (
                              <option value={formNuevaTarea.tarea_padre_id}>
                                Tarea guardada ({formNuevaTarea.tarea_padre_id.slice(0, 8)}…)
                              </option>
                            ) : null}
                            {tareasParaElegirPadre.map((t) => (
                              <option key={t.tarea_id} value={t.tarea_id}>
                                {t.titulo}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div className="space-y-1">
                          <FieldLabel>Responsable</FieldLabel>
                          <select
                            value={formNuevaTarea.responsable_id}
                            onChange={(e) =>
                              setFormNuevaTarea((prev) => ({
                                ...prev,
                                responsable_id: e.target.value,
                              }))
                            }
                            className={SELECT_REF_PANEL}
                            disabled={miembrosProyecto.isLoading}
                          >
                            <option value="">Sin asignar</option>
                            {formNuevaTarea.responsable_id.trim() &&
                            !(miembrosProyecto.data ?? []).some(
                              (m) => m.usuario_id === formNuevaTarea.responsable_id.trim(),
                            ) ? (
                              <option value={formNuevaTarea.responsable_id}>
                                Usuario guardado ({formNuevaTarea.responsable_id.slice(0, 8)}…)
                              </option>
                            ) : null}
                            {(miembrosProyecto.data ?? []).map((m) => (
                              <option key={m.usuario_id} value={m.usuario_id}>
                                {m.nombre_visible || m.correo}
                              </option>
                            ))}
                          </select>
                        </div>

                      </div>
                    </details>

                    {errorCrearTarea && (
                      <p className="flex items-center gap-1.5 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[12px] text-red-600">
                        <AlertCircle size={13} />
                        {errorCrearTarea}
                      </p>
                    )}
                  </div>

                  <div className="flex shrink-0 gap-2 border-t border-stone-100 px-5 py-3">
                    <Button type="button" variant="outline" size="sm" onClick={cerrarPanel} className="flex-1">
                      Cancelar
                    </Button>
                    <Button type="submit" size="sm" disabled={crearTarea.isPending} className="flex-1">
                      {crearTarea.isPending ? (
                        <span className="inline-flex items-center gap-1.5">
                          <LoaderCircle size={12} className="animate-spin" />
                          Creando...
                        </span>
                      ) : (
                        'Crear tarea'
                      )}
                    </Button>
                  </div>
                </form>
              </div>
            ) : null}
          </div>
        </div>
      </div>

      {/* ══ MODAL DE DETALLE DE TAREA ══════════════════════════════════════════════ */}
      {panelActivo === 'detalle' && tareaDetalle && formEdicion && columnaEdicionId && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/30 p-4 backdrop-blur-[2px] animate-in fade-in duration-150"
          onClick={cerrarPanel}
        >
          <div
            className="relative flex h-full max-h-[88vh] w-full max-w-5xl flex-col overflow-hidden rounded-xl bg-white shadow-xl animate-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Barra superior: ID + cerrar */}
            <div className="flex shrink-0 items-center justify-between border-b border-stone-100 px-6 py-2.5">
              <button
                onClick={() => navigator.clipboard.writeText(tareaDetalle.tarea_id)}
                title="Copiar ID"
                className="font-mono text-[11px] text-stone-400 hover:text-purple-500 transition-colors"
              >
                #{tareaDetalle.tarea_id.slice(0, 8)}
              </button>
              <button
                type="button"
                onClick={cerrarPanel}
                className="rounded p-1.5 text-stone-400 transition hover:bg-stone-100 hover:text-stone-600"
              >
                <X size={16} />
              </button>
            </div>

            {/* Título editable */}
            <div className="shrink-0 border-b border-stone-100 px-8 py-4">
              <textarea
                value={formEdicion.titulo}
                onChange={(e) => setFormEdicion(p => p ? {...p, titulo: e.target.value} : p)}
                rows={1}
                className="w-full resize-none border-none bg-transparent p-0 text-[20px] font-semibold text-stone-900 outline-none focus:ring-0 leading-snug placeholder:text-stone-300"
                disabled={tareaDetalle.tarea_id.startsWith('temp-')}
                placeholder="Título de la tarea..."
              />
            </div>

            {/* Cuerpo (Dos Columnas) */}
            <div className="flex flex-1 overflow-hidden">
              {/* Columna izquierda: contenido */}
              <div className="flex-1 overflow-y-auto px-8 py-6 space-y-7">
                {tareaDetalle.tarea_id.startsWith('temp-') && (
                  <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-2.5 text-[12px] text-amber-700 flex items-center gap-2">
                    <LoaderCircle size={14} className="animate-spin" />
                    Sincronizando con el servidor...
                  </div>
                )}

                {/* Descripción */}
                <div>
                  <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-stone-400">Descripción</p>
                  <CampoDescripcionMarkdown
                    key={`detalle-desc-${tareaDetalle.tarea_id}-${tareaDetalle.actualizado_en}`}
                    value={formEdicion.descripcion}
                    onChange={(value) =>
                      setFormEdicion((prev) => (prev ? { ...prev, descripcion: value } : prev))
                    }
                    placeholder="Contexto, criterios de aceptación, notas técnicas..."
                    disabled={false}
                  />
                </div>

                {/* Comentarios */}
                <div className="space-y-4 pt-5 border-t border-stone-100">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-stone-400">Comentarios</p>
                  <div className="rounded-lg border border-stone-200 bg-stone-50/50 p-3">
                    <textarea
                      value={nuevoComentario}
                      onChange={(e) => setNuevoComentario(e.target.value)}
                      placeholder="Escribe un comentario..."
                      rows={2}
                      className="w-full resize-none border-0 bg-transparent text-[13px] text-stone-700 outline-none placeholder:text-stone-400"
                    />
                    <div className="mt-2 flex justify-end">
                      <Button
                        type="button"
                        size="sm"
                        className="h-7 px-4 text-[12px] bg-purple-600 hover:bg-purple-700"
                        disabled={!nuevoComentario.trim() || crearComentario.isPending}
                        onClick={() => crearComentario.mutate(tareaDetalle.tarea_id)}
                      >
                        {crearComentario.isPending ? <LoaderCircle size={12} className="animate-spin mr-1.5" /> : null}
                        Enviar
                      </Button>
                    </div>
                  </div>

                  <div className="space-y-3">
                    {comentariosLista.map((c) => (
                      <div key={c.comentario_id} className="flex gap-3">
                        <div className={cn("h-7 w-7 shrink-0 rounded-full flex items-center justify-center text-[12px] font-bold", colorAvatar(c.autor_id).bg, colorAvatar(c.autor_id).text)}>
                          {c.autor_nombre[0].toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-baseline gap-2 mb-0.5">
                            <span className="text-[12px] font-semibold text-stone-800">{c.autor_nombre}</span>
                            <span className="text-[10px] text-stone-400">{new Date(c.creado_en).toLocaleString()}</span>
                          </div>
                          <p className="text-[13px] leading-relaxed text-stone-600 whitespace-pre-wrap">{c.contenido}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Columna derecha: propiedades */}
              <div className="w-[230px] shrink-0 overflow-y-auto border-l border-stone-100 px-4 py-5 space-y-6">
                {/* Propiedades */}
                <div className="space-y-0.5">
                  <p className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-stone-400">Propiedades</p>
                  <div className="divide-y divide-stone-100">
                    <div className="flex items-center justify-between py-2">
                      <span className="flex items-center gap-1.5 text-[11px] text-stone-500"><Layers size={10} /> Estado</span>
                      <select
                        value={columnaEdicionId}
                        onChange={(e) => setColumnaEdicionId(e.target.value)}
                        className="bg-transparent text-[11px] font-medium text-stone-700 outline-none border-none p-0 focus:ring-0 text-right cursor-pointer max-w-[110px] truncate"
                      >
                        {(columnas.data ?? []).map((col) => (
                          <option key={col.columna_id} value={col.columna_id}>{col.nombre}</option>
                        ))}
                      </select>
                    </div>
                    <div className="flex items-center justify-between py-2">
                      <span className="flex items-center gap-1.5 text-[11px] text-stone-500"><AlertCircle size={10} /> Prioridad</span>
                      <select
                        value={formEdicion.prioridad}
                        onChange={(e) => setFormEdicion(p => p ? {...p, prioridad: e.target.value as any} : p)}
                        className="bg-transparent text-[11px] font-medium text-stone-700 outline-none border-none p-0 focus:ring-0 text-right cursor-pointer"
                      >
                        <option value="critica">Crítica</option>
                        <option value="alta">Alta</option>
                        <option value="media">Media</option>
                        <option value="baja">Baja</option>
                      </select>
                    </div>
                    <div className="flex items-center justify-between py-2">
                      <span className="flex items-center gap-1.5 text-[11px] text-stone-500"><Hash size={10} /> Tipo</span>
                      <select
                        value={formEdicion.tipo}
                        onChange={(e) => setFormEdicion(p => p ? {...p, tipo: e.target.value as any} : p)}
                        className="bg-transparent text-[11px] font-medium text-stone-700 outline-none border-none p-0 focus:ring-0 text-right cursor-pointer"
                      >
                        <option value="tarea">Tarea</option>
                        <option value="subtarea">Subtarea</option>
                        <option value="error">Error</option>
                      </select>
                    </div>
                    <div className="flex items-center justify-between py-2">
                      <span className="flex items-center gap-1.5 text-[11px] text-stone-500"><Calendar size={10} /> Vence</span>
                      <input
                        type="date"
                        value={formEdicion.fecha_limite}
                        onChange={(e) => setFormEdicion(p => p ? {...p, fecha_limite: e.target.value} : p)}
                        className="bg-transparent text-[11px] font-medium text-stone-700 outline-none border-none p-0 focus:ring-0 text-right cursor-pointer"
                      />
                    </div>
                  </div>
                </div>

                {/* Asignación */}
                <div className="space-y-2">
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-stone-400">Asignación</p>
                  <div className="divide-y divide-stone-100">
                    <div className="py-2">
                      <p className="text-[10px] text-stone-400 mb-1">Responsable</p>
                      <select
                        value={formEdicion.responsable_id}
                        onChange={(e) => setFormEdicion(p => p ? {...p, responsable_id: e.target.value} : p)}
                        className="w-full bg-transparent text-[11px] font-medium text-stone-700 outline-none p-0 border-none focus:ring-0"
                      >
                        <option value="">Sin asignar</option>
                        {(miembrosProyecto.data ?? []).map((m) => (
                          <option key={m.usuario_id} value={m.usuario_id}>{m.nombre_visible || m.correo}</option>
                        ))}
                      </select>
                    </div>
                    <div className="py-2">
                      <p className="text-[10px] text-stone-400 mb-1">Tarea padre</p>
                      <select
                        value={formEdicion.tarea_padre_id}
                        onChange={(e) => setFormEdicion(p => p ? {...p, tarea_padre_id: e.target.value} : p)}
                        className="w-full bg-transparent text-[11px] font-medium text-stone-700 outline-none p-0 border-none focus:ring-0"
                      >
                        <option value="">Ninguna</option>
                        {tareasPadreEdicion.map((t) => (
                          <option key={t.tarea_id} value={t.tarea_id}>{t.titulo}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <BloqueSelectorEpica
                    epicaId={formEdicion.epica_id}
                    onEpicaChange={(id) => setFormEdicion(p => p ? {...p, epica_id: id} : p)}
                    epicasLista={epicas.data}
                    epicasLoading={epicas.isLoading}
                    nuevaEpicaUi={nuevaEpicaUi}
                    setNuevaEpicaUi={setNuevaEpicaUi}
                    setErrorCrearEpica={setErrorCrearEpica}
                    crearEpicaPending={crearEpica.isPending}
                    onSubmitNuevaEpica={() => crearEpica.mutate({ titulo: nuevaEpicaUi.titulo, destino: 'detalle' })}
                    errorCrearEpica={errorCrearEpica}
                  />
                </div>

                {/* Etiquetas */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-[10px] font-semibold uppercase tracking-widest text-stone-400">Etiquetas</p>
                    <select
                      className="text-[10px] font-medium text-purple-600 bg-transparent outline-none cursor-pointer"
                      onChange={(e) => e.target.value && asignarEtiqueta.mutate({ tareaId: tareaDetalle.tarea_id, etiquetaId: e.target.value })}
                      value=""
                    >
                      <option value="">+ añadir</option>
                      {etiquetasLista.filter(etq => !(etiquetasPorTarea.get(tareaDetalle.tarea_id) ?? []).some(t => t.etiqueta_id === etq.etiqueta_id)).map(etq => (
                        <option key={etq.etiqueta_id} value={etq.etiqueta_id}>{etq.nombre}</option>
                      ))}
                    </select>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {(etiquetasPorTarea.get(tareaDetalle.tarea_id) ?? []).map((etq) => (
                      <span key={etq.etiqueta_id} className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-medium text-white" style={{ backgroundColor: etq.color }}>
                        {etq.nombre}
                        <button onClick={() => quitarEtiqueta.mutate({ tareaId: tareaDetalle.tarea_id, etiquetaId: etq.etiqueta_id })} className="hover:opacity-70">
                          <X size={9} />
                        </button>
                      </span>
                    ))}
                    {(etiquetasPorTarea.get(tareaDetalle.tarea_id) ?? []).length === 0 && (
                      <span className="text-[11px] text-stone-300">—</span>
                    )}
                  </div>
                </div>

                {/* Metadatos */}
                <div className="pt-4 border-t border-stone-100 space-y-1">
                  <div className="flex justify-between text-[10px] text-stone-400">
                    <span>Creado por</span>
                    <span className="text-stone-500">{miembrosPorId.get(tareaDetalle.creado_por)?.nombre_visible || 'Sistema'}</span>
                  </div>
                  <div className="flex justify-between text-[10px] text-stone-400">
                    <span>Creado</span>
                    <span className="text-stone-500">{new Date(tareaDetalle.creado_en).toLocaleDateString()}</span>
                  </div>
                  <div className="flex justify-between text-[10px] text-stone-400">
                    <span>Actualizado</span>
                    <span className="text-stone-500">{new Date(tareaDetalle.actualizado_en).toLocaleDateString()}</span>
                  </div>
                </div>

                {/* Acciones */}
                <div className="pt-2">
                  {confirmarEliminar ? (
                    <div className="space-y-2 p-3 rounded-lg bg-red-50 border border-red-100">
                      <p className="text-[11px] font-semibold text-red-600 text-center">¿Eliminar tarea?</p>
                      <div className="flex gap-2">
                        <Button size="sm" variant="destructive" className="flex-1 h-7 text-[11px]" onClick={() => eliminarTarea.mutate(tareaDetalle.tarea_id)}>Eliminar</Button>
                        <Button size="sm" variant="outline" className="flex-1 h-7 text-[11px]" onClick={() => setConfirmarEliminar(false)}>Cancelar</Button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col gap-2">
                      <Button
                        className="w-full h-9 bg-purple-600 hover:bg-purple-700 text-[13px] font-semibold"
                        disabled={actualizarTarea.isPending}
                        onClick={() => {
                          if (!formEdicion.titulo.trim()) return setErrorEdicion('Título requerido');
                          actualizarTarea.mutate({ tareaId: tareaDetalle.tarea_id, payload: construirPayloadEdicion(formEdicion, columnaEdicionId, tareaDetalle) });
                        }}
                      >
                        {actualizarTarea.isPending ? <LoaderCircle size={14} className="animate-spin mr-1.5" /> : null}
                        Guardar cambios
                      </Button>
                      <Button
                        variant="ghost"
                        className="w-full h-8 text-[12px] text-red-400 hover:bg-red-50 hover:text-red-500"
                        onClick={() => setConfirmarEliminar(true)}
                      >
                        <Trash2 size={13} className="mr-1.5" />
                        Eliminar tarea
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
