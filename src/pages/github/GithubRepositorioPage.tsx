import { useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useParams } from 'react-router-dom';
import {
  ArrowRight,
  ChevronDown,
  ExternalLink,
  FileDiff,
  GitBranch,
  GitCommitHorizontal,
  GitMerge,
  GitPullRequest,
  GitPullRequestClosed,
  Link2,
  LoaderCircle,
  RefreshCw,
  Rocket,
  Search,
  Shield,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { githubService } from '@/services/github.service';
import type { SolicitudIntegracionResumen, TrazabilidadTareaEvento } from '@/services/github.service';
import { useAuthStore } from '@/store/auth.store';
import { useToastStore } from '@/store/toast.store';
import { cn } from '@/lib/utils';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fechaCorta(iso?: string | null): string {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleDateString('es', { day: '2-digit', month: 'short', year: 'numeric' });
  } catch {
    return iso;
  }
}

function fechaRelativa(iso?: string | null): string {
  if (!iso) return '—';
  try {
    const diff = Date.now() - new Date(iso).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return `hace ${mins}m`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `hace ${hrs}h`;
    const days = Math.floor(hrs / 24);
    if (days < 30) return `hace ${days}d`;
    return fechaCorta(iso);
  } catch {
    return iso ?? '—';
  }
}

function inferirPersonaDesdeRama(nombreRama: string): string | null {
  if (!nombreRama) return null;
  const sinPrefijo = nombreRama.includes('/') ? nombreRama.split('/').slice(1).join('/') : nombreRama;
  const candidato = sinPrefijo.split('-')[0]?.trim();
  if (!candidato || candidato.length < 3) return null;
  if (/^(feature|hotfix|fix|bugfix|chore|release|main|desarrollo|dev)$/i.test(candidato)) return null;
  return candidato;
}

function ramaPrefix(nombre: string): string {
  return nombre.includes('/') ? nombre.split('/')[0] : '';
}

// Genera color determinístico para avatares según string (author/branch)
function colorAvatar(seed: string): { bg: string; text: string } {
  const paletas = [
    { bg: 'bg-purple-100', text: 'text-purple-700' },
    { bg: 'bg-emerald-100', text: 'text-emerald-700' },
    { bg: 'bg-blue-100', text: 'text-blue-700' },
    { bg: 'bg-amber-100', text: 'text-amber-700' },
    { bg: 'bg-rose-100', text: 'text-rose-700' },
    { bg: 'bg-sky-100', text: 'text-sky-700' },
    { bg: 'bg-violet-100', text: 'text-violet-700' },
    { bg: 'bg-teal-100', text: 'text-teal-700' },
  ];
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) | 0;
  return paletas[Math.abs(hash) % paletas.length];
}

// Etiqueta de día para agrupar commits (Hoy / Ayer / fecha larga)
function etiquetaDia(iso: string): string {
  const d = new Date(iso);
  const hoy = new Date();
  const ayer = new Date(); ayer.setDate(hoy.getDate() - 1);
  const esMismo = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
  if (esMismo(d, hoy)) return 'Hoy';
  if (esMismo(d, ayer)) return 'Ayer';
  return d.toLocaleDateString('es', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' });
}

// ─── Config visual ────────────────────────────────────────────────────────────

const PR_ESTADO: Record<
  string,
  { label: string; chip: string; border: string; icon: React.ComponentType<{ size?: number; className?: string }> }
> = {
  abierta: {
    label: 'Abierta',
    chip: 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200',
    border: 'border-l-emerald-400',
    icon: GitPullRequest,
  },
  integrada: {
    label: 'Integrada',
    chip: 'bg-violet-50 text-violet-700 ring-1 ring-violet-200',
    border: 'border-l-violet-400',
    icon: GitMerge,
  },
  cerrada: {
    label: 'Cerrada',
    chip: 'bg-stone-100 text-stone-500 ring-1 ring-stone-200',
    border: 'border-l-stone-300',
    icon: GitPullRequestClosed,
  },
};

const ARCHIVO_ESTADO: Record<string, { label: string; bg: string; text: string }> = {
  added:    { label: '+',   bg: 'bg-emerald-50', text: 'text-emerald-700' },
  modified: { label: '~',   bg: 'bg-amber-50',   text: 'text-amber-700'   },
  removed:  { label: '−',   bg: 'bg-red-50',     text: 'text-red-600'     },
  renamed:  { label: 'ren', bg: 'bg-blue-50',    text: 'text-blue-700'    },
  copied:   { label: 'cp',  bg: 'bg-sky-50',     text: 'text-sky-700'     },
};

const RAMA_PREFIX_COLOR: Record<string, string> = {
  feature: 'bg-blue-50 text-blue-700',
  hotfix:  'bg-red-50 text-red-700',
  fix:     'bg-orange-50 text-orange-700',
  bugfix:  'bg-orange-50 text-orange-700',
  chore:   'bg-stone-100 text-stone-600',
  release: 'bg-purple-50 text-purple-700',
};

// ─── Sub-componentes ──────────────────────────────────────────────────────────

function Chip({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <span className={cn('inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide', className)}>
      {children}
    </span>
  );
}

function TabBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'relative px-4 py-2.5 text-[13px] font-medium transition-colors',
        active
          ? 'text-purple-700 after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:rounded-full after:bg-purple-600'
          : 'text-stone-500 hover:text-stone-800',
      )}
    >
      {children}
    </button>
  );
}

function PrRow({ pr, selected, onClick }: { pr: SolicitudIntegracionResumen; selected: boolean; onClick: () => void }) {
  const config = PR_ESTADO[pr.estado] ?? PR_ESTADO.cerrada;
  const Icon = config.icon;

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex w-full items-start gap-0 border-b border-stone-100 text-left transition-colors last:border-b-0',
        selected ? 'bg-purple-50' : 'hover:bg-stone-50/70',
      )}
    >
      {/* Colored left border */}
      <span className={cn('w-1 shrink-0 self-stretch rounded-l-none', selected ? 'bg-purple-400' : config.border.replace('border-l-', 'bg-'))} />
      <div className="flex min-w-0 flex-1 items-start gap-3 px-4 py-3">
        <Icon
          size={14}
          className={cn(
            'mt-0.5 shrink-0',
            pr.estado === 'abierta' ? 'text-emerald-500' : pr.estado === 'integrada' ? 'text-violet-500' : 'text-stone-400',
          )}
        />
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <p className={cn('min-w-0 flex-1 break-words text-[13px] font-medium leading-snug', selected ? 'text-purple-800' : 'text-stone-800')}>
              <span className="mr-1.5 font-mono text-[11px] text-stone-400">#{pr.numero_github}</span>
              {pr.titulo}
            </p>
            <Chip className={cn('mt-0.5 shrink-0', config.chip)}>{config.label}</Chip>
          </div>
          <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-stone-400">
            <span className="font-mono">{pr.rama_origen}</span>
            <ArrowRight size={10} className="text-stone-300" />
            <span className="font-mono">{pr.rama_destino}</span>
            {pr.usuario_github_autor && (
              <>
                <span className="text-stone-300">·</span>
                <span className="flex items-center gap-1">
                  <span className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-stone-200 text-[9px] font-bold text-stone-600">
                    {pr.usuario_github_autor[0]?.toUpperCase()}
                  </span>
                  {pr.usuario_github_autor}
                </span>
              </>
            )}
            <span className="text-stone-300">·</span>
            <span>{fechaRelativa(pr.abierta_en)}</span>
          </div>
        </div>
      </div>
    </button>
  );
}

// ─── Página principal ─────────────────────────────────────────────────────────

export function GithubRepositorioPage() {
  const { repositorioId } = useParams<{ repositorioId: string }>();
  const token = useAuthStore((s) => s.token);
  const pushToast = useToastStore((s) => s.pushToast);
  const proyectoActivoId = useAuthStore((s) => s.proyectoActivoId);

  const [prSeleccionado, setPrSeleccionado] = useState<number | null>(null);
  const [filtroEstado, setFiltroEstado] = useState<'todos' | 'abierta' | 'integrada' | 'cerrada'>('todos');
  const [desdeFecha, setDesdeFecha] = useState('');
  const [hastaFecha, setHastaFecha] = useState('');
  const [buscarArchivo, setBuscarArchivo] = useState('');
  const [archivosExpandidos, setArchivosExpandidos] = useState<Set<string>>(new Set());
  const [buscarPr, setBuscarPr] = useState('');
  const [filtroPersona, setFiltroPersona] = useState('todas');
  const [tabActiva, setTabActiva] = useState<'prs' | 'ramas' | 'commits' | 'vinculos' | 'produccion'>('prs');
  const [mensajeSync, setMensajeSync] = useState<string | null>(null);
  const [buscarCommit, setBuscarCommit] = useState('');
  const [tareaTimelineId, setTareaTimelineId] = useState<string | null>(null);
  const [prodDesdeFecha, setProdDesdeFecha] = useState('');
  const [prodHastaFecha, setProdHastaFecha] = useState('');
  const [prodPersona, setProdPersona] = useState('todas');
  const intentoAutoSync = useRef(false);
  const queryClient = useQueryClient();

  const repos = useQuery({
    queryKey: ['github-repositorios', proyectoActivoId, token],
    queryFn: () => githubService.obtenerRepositoriosPorProyecto(proyectoActivoId as string, token as string),
    enabled: Boolean(proyectoActivoId && token),
  });
  const repo = (repos.data ?? []).find((r) => r.repositorio_id === repositorioId);

  const ramas = useQuery({
    queryKey: ['github-ramas', repositorioId, token],
    queryFn: () => githubService.obtenerRamas(repositorioId as string, token as string),
    enabled: Boolean(repositorioId && token),
    refetchInterval: 30000,
  });

  const prs = useQuery({
    queryKey: ['github-solicitudes', repositorioId, token],
    queryFn: () => githubService.obtenerSolicitudesIntegracion(repositorioId as string, token as string),
    enabled: Boolean(repositorioId && token),
    refetchInterval: 30000,
  });

  const estadoDespliegue = useQuery({
    queryKey: ['github-estado-despliegue', repositorioId, token],
    queryFn: () => githubService.obtenerEstadoDespliegue(repositorioId as string, token as string),
    enabled: Boolean(repositorioId && token),
    refetchInterval: 30000,
  });

  const vinculosTareas = useQuery({
    queryKey: ['github-vinculos-tareas', repositorioId, token],
    queryFn: () => githubService.obtenerVinculosTareas(repositorioId as string, token as string),
    enabled: Boolean(repositorioId && token),
    refetchInterval: 30000,
  });

  const archivosPr = useQuery({
    queryKey: ['github-pr-archivos', repositorioId, prSeleccionado, token],
    queryFn: () => githubService.obtenerArchivosPullRequest(repositorioId as string, prSeleccionado as number, token as string),
    enabled: Boolean(repositorioId && token && prSeleccionado),
  });

  const commitsPr = useQuery({
    queryKey: ['github-pr-commits', repositorioId, prSeleccionado, token],
    queryFn: () =>
      githubService.obtenerCommitsPullRequest(repositorioId as string, prSeleccionado as number, token as string),
    enabled: Boolean(repositorioId && token && prSeleccionado),
  });

  const commitsRepo = useQuery({
    queryKey: ['github-repo-commits', repositorioId, token, buscarCommit],
    queryFn: () =>
      githubService.obtenerCommitsRepositorio(repositorioId as string, token as string, {
        q: buscarCommit.trim() || undefined,
        limit: 300,
      }),
    enabled: Boolean(repositorioId && token),
    refetchInterval: 30000,
  });

  const eventosProduccion = useQuery({
    queryKey: ['github-eventos-produccion', repositorioId, token],
    queryFn: () => githubService.obtenerEventosProduccion(repositorioId as string, token as string),
    enabled: Boolean(repositorioId && token),
    refetchInterval: 30000,
  });

  const trazabilidadTarea = useQuery({
    queryKey: ['github-trazabilidad-tarea', repositorioId, tareaTimelineId, token],
    queryFn: () =>
      githubService.obtenerTrazabilidadTarea(repositorioId as string, tareaTimelineId as string, token as string),
    enabled: Boolean(repositorioId && token && tareaTimelineId),
  });

  const personasProduccion = useMemo(() => {
    const set = new Set<string>();
    for (const e of eventosProduccion.data ?? []) {
      if (e.usuario_github_autor?.trim()) set.add(e.usuario_github_autor.trim());
    }
    return [...set].sort((a, b) => a.localeCompare(b, 'es', { sensitivity: 'base' }));
  }, [eventosProduccion.data]);

  const eventosProduccionFiltrados = useMemo(
    () =>
      (eventosProduccion.data ?? [])
        .filter((e) =>
          prodPersona === 'todas'
            ? true
            : (e.usuario_github_autor ?? '').toLowerCase() === prodPersona.toLowerCase(),
        )
        .filter((e) => {
          if (!e.integrada_en) return false;
          const fecha = new Date(e.integrada_en);
          if (prodDesdeFecha && fecha < new Date(`${prodDesdeFecha}T00:00:00`)) return false;
          if (prodHastaFecha && fecha > new Date(`${prodHastaFecha}T23:59:59`)) return false;
          return true;
        }),
    [eventosProduccion.data, prodPersona, prodDesdeFecha, prodHastaFecha],
  );

  useEffect(() => {
    if (archivosPr.data && archivosPr.data.length > 0) {
      setArchivosExpandidos(new Set([archivosPr.data[0].nombre_archivo]));
    }
  }, [archivosPr.data]);

  // Refresca en paralelo todas las queries del repo (feedback inmediato)
  const refrescarTodo = () => {
    const keys = [
      ['github-ramas', repositorioId, token],
      ['github-solicitudes', repositorioId, token],
      ['github-estado-despliegue', repositorioId, token],
      ['github-vinculos-tareas', repositorioId, token],
      ['github-repo-commits', repositorioId, token],
      ['github-eventos-produccion', repositorioId, token],
    ];
    return Promise.all(keys.map((k) => queryClient.refetchQueries({ queryKey: k, exact: false })));
  };

  const syncRepositorio = useMutation({
    mutationFn: () => githubService.sincronizarRepositorio(repositorioId as string, token as string),
    onSuccess: (data) => {
      setMensajeSync(`Sync OK · ${data.ramas} ramas · ${data.prs} PRs`);
      pushToast({ type: 'ok', message: 'Repositorio sincronizado correctamente.' });
      // Refetch paralelo de todas las queries para reflejar cambios de inmediato
      void refrescarTodo();
    },
    onError: () => {
      setMensajeSync('No se pudo sincronizar. Reintenta manualmente.');
      pushToast({ type: 'error', message: 'No se pudo sincronizar el repositorio.' });
    },
  });

  // Auto-limpia el mensaje de sync a los 4 segundos
  useEffect(() => {
    if (!mensajeSync) return;
    const t = setTimeout(() => setMensajeSync(null), 4000);
    return () => clearTimeout(t);
  }, [mensajeSync]);

  const ramaMain = repo ? (ramas.data ?? []).find((r) => r.nombre === repo.rama_principal) : undefined;
  const sinDatosIniciales = !ramas.isLoading && !prs.isLoading && !ramaMain && (prs.data?.length ?? 0) === 0;

  useEffect(() => {
    if (!repo || !token) return;
    if (intentoAutoSync.current) return;
    if (!sinDatosIniciales) return;
    intentoAutoSync.current = true;
    syncRepositorio.mutate();
  }, [repo, token, sinDatosIniciales]);

  useEffect(() => {
    if (!repo || !token) return;
    const interval = setInterval(() => {
      if (!syncRepositorio.isPending) {
        syncRepositorio.mutate();
      }
    }, 120000);
    return () => clearInterval(interval);
  }, [repo, token, syncRepositorio.isPending]);

  const ramasOrdenadas = useMemo(
    () => [...(ramas.data ?? [])].sort((a, b) => {
      if (a.nombre === repo?.rama_principal) return -1;
      if (b.nombre === repo?.rama_principal) return 1;
      return new Date(b.ultimo_push_en ?? 0).getTime() - new Date(a.ultimo_push_en ?? 0).getTime();
    }),
    [ramas.data, repo?.rama_principal],
  );

  const personasDisponibles = useMemo(() => {
    const set = new Set<string>();
    for (const p of prs.data ?? []) if (p.usuario_github_autor?.trim()) set.add(p.usuario_github_autor.trim());
    for (const r of ramas.data ?? []) { const p = inferirPersonaDesdeRama(r.nombre); if (p) set.add(p); }
    return [...set].sort((a, b) => a.localeCompare(b, 'es', { sensitivity: 'base' }));
  }, [prs.data, ramas.data]);

  const prsFiltradas = useMemo(
    () =>
      (prs.data ?? [])
        .filter((p) => filtroEstado === 'todos' || p.estado === filtroEstado)
        .filter((p) =>
          filtroPersona === 'todas' ||
          (p.usuario_github_autor ?? '').toLowerCase() === filtroPersona.toLowerCase() ||
          inferirPersonaDesdeRama(p.rama_origen)?.toLowerCase() === filtroPersona.toLowerCase(),
        )
        .filter((p) => {
          const abierta = new Date(p.abierta_en);
          if (desdeFecha && abierta < new Date(`${desdeFecha}T00:00:00`)) return false;
          if (hastaFecha && abierta > new Date(`${hastaFecha}T23:59:59`)) return false;
          return true;
        })
        .filter((p) => {
          const q = buscarPr.trim().toLowerCase();
          return !q || p.titulo.toLowerCase().includes(q) || String(p.numero_github).includes(q) || (p.usuario_github_autor ?? '').toLowerCase().includes(q);
        })
        .sort((a, b) => new Date(b.abierta_en).getTime() - new Date(a.abierta_en).getTime()),
    [prs.data, filtroEstado, filtroPersona, desdeFecha, hastaFecha, buscarPr],
  );

  const ramasFiltradas = useMemo(
    () => filtroPersona === 'todas' ? ramasOrdenadas : ramasOrdenadas.filter((r) => inferirPersonaDesdeRama(r.nombre)?.toLowerCase() === filtroPersona.toLowerCase()),
    [ramasOrdenadas, filtroPersona],
  );

  // Agrupar commits por día para un timeline legible
  const commitsAgrupados = useMemo(() => {
    const lista = commitsRepo.data ?? [];
    type Commit = (typeof lista)[number];
    const map = new Map<string, Commit[]>();
    for (const c of lista) {
      const clave = etiquetaDia(c.confirmado_en);
      const arr = map.get(clave) ?? [];
      arr.push(c);
      map.set(clave, arr);
    }
    return [...map.entries()].map(([dia, items]) => ({ dia, items }));
  }, [commitsRepo.data]);

  const estadisticasCommits = useMemo(() => {
    const autores = new Set<string>();
    for (const c of commitsRepo.data ?? []) {
      const a = c.usuario_github_autor ?? c.nombre_autor;
      if (a) autores.add(a);
    }
    return { total: commitsRepo.data?.length ?? 0, autores: autores.size };
  }, [commitsRepo.data]);

  const archivosFiltrados = useMemo(() => {
    const q = buscarArchivo.trim().toLowerCase();
    return q ? (archivosPr.data ?? []).filter((a) => a.nombre_archivo.toLowerCase().includes(q)) : (archivosPr.data ?? []);
  }, [archivosPr.data, buscarArchivo]);

  function renderPatch(patch: string | null) {
    if (!patch) return (
      <div className="flex items-center justify-center py-4 text-[11px] text-stone-400">
        Archivo binario o diff no disponible.
      </div>
    );

    type DiffRow = { tipo: 'hdr' | 'add' | 'del' | 'ctx'; content: string; oldNum: number | null; newNum: number | null };
    const rows: DiffRow[] = [];
    let oldLine = 0, newLine = 0;

    for (const linea of patch.split('\n')) {
      if (linea.startsWith('@@')) {
        const m = linea.match(/@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/);
        if (m) { oldLine = parseInt(m[1]) - 1; newLine = parseInt(m[2]) - 1; }
        rows.push({ tipo: 'hdr', content: linea, oldNum: null, newNum: null });
      } else if (linea.startsWith('+') && !linea.startsWith('+++')) {
        rows.push({ tipo: 'add', content: linea.slice(1), oldNum: null, newNum: ++newLine });
      } else if (linea.startsWith('-') && !linea.startsWith('---')) {
        rows.push({ tipo: 'del', content: linea.slice(1), oldNum: ++oldLine, newNum: null });
      } else {
        oldLine++; newLine++;
        rows.push({ tipo: 'ctx', content: linea.startsWith(' ') ? linea.slice(1) : linea, oldNum: oldLine, newNum: newLine });
      }
    }

    return (
      <div className="overflow-auto rounded-md border border-stone-200 bg-[#fafafa] font-mono text-[11px]">
        {rows.map((row, idx) =>
          row.tipo === 'hdr' ? (
            <div key={idx} className="select-none bg-blue-50/80 px-3 py-0.5 text-[10px] text-blue-500/80">{row.content}</div>
          ) : (
            <div key={idx} className={cn('flex min-w-0', row.tipo === 'add' && 'bg-emerald-50', row.tipo === 'del' && 'bg-red-50', row.tipo === 'ctx' && 'bg-white')}>
              <div className="flex w-14 shrink-0 select-none border-r border-stone-100 text-right text-[10px] text-stone-300">
                <span className="w-7 py-0.5 pr-1">{row.oldNum ?? ''}</span>
                <span className="w-7 border-l border-stone-100 py-0.5 pr-1">{row.newNum ?? ''}</span>
              </div>
              <span className={cn('w-4 shrink-0 select-none py-0.5 text-center font-bold', row.tipo === 'add' && 'text-emerald-600', row.tipo === 'del' && 'text-red-400', row.tipo === 'ctx' && 'text-stone-300')}>
                {row.tipo === 'add' ? '+' : row.tipo === 'del' ? '-' : ' '}
              </span>
              <span className={cn('flex-1 whitespace-pre-wrap break-all py-0.5 pl-1 pr-3 leading-relaxed', row.tipo === 'add' && 'text-emerald-800', row.tipo === 'del' && 'text-red-700', row.tipo === 'ctx' && 'text-stone-600')}>
                {row.content || ' '}
              </span>
            </div>
          ),
        )}
      </div>
    );
  }

  const prSeleccionadoData = (prs.data ?? []).find((p) => p.numero_github === prSeleccionado);
  const cntAbiertos = (prs.data ?? []).filter((p) => p.estado === 'abierta').length;
  const cntIntegrados = (prs.data ?? []).filter((p) => p.estado === 'integrada').length;
  const totalAdiciones = (archivosPr.data ?? []).reduce((s, a) => s + a.adiciones, 0);
  const totalEliminaciones = (archivosPr.data ?? []).reduce((s, a) => s + a.eliminaciones, 0);
  const etiquetaEvento = (e: TrazabilidadTareaEvento): string => {
    if (e.tipo === 'rama_creada') return 'Rama detectada';
    if (e.tipo === 'commit') return 'Commit';
    if (e.tipo === 'pr_desarrollo') return 'PR a desarrollo';
    if (e.tipo === 'pr_main_prueba') return 'PR a main prueba';
    if (e.tipo === 'pr_main') return 'PR a producción';
    return 'PR';
  };

  // ── Not found ──────────────────────────────────────────────────────────────
  if (!repos.isLoading && !repo) {
    return (
      <div className="space-y-3 p-4">
        <p className="text-sm text-stone-600">Repositorio no encontrado en el proyecto activo.</p>
        <Link to="/github" className="text-sm text-purple-700 hover:underline">← Volver a GitHub</Link>
      </div>
    );
  }
  if (!repo) {
    return <div className="flex items-center justify-center p-8"><LoaderCircle size={20} className="animate-spin text-stone-300" /></div>;
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="flex min-h-full flex-col gap-3">

      {/* ── HEADER ── */}
      <div className="shrink-0 rounded-xl border border-stone-200 bg-white px-5 py-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          {/* Left: identity */}
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-stone-900 shadow-sm">
              <GitBranch size={17} className="text-white" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="font-mono text-[15px] font-bold text-stone-900">{repo.nombre_completo_github}</h1>
                {repo.esta_activo && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-700 ring-1 ring-emerald-200">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                    Activo
                  </span>
                )}
              </div>
              <p className="mt-0.5 text-[12px] text-stone-400">
                Rama principal: <span className="font-mono font-medium text-stone-600">{repo.rama_principal}</span>
                {repo.sincronizado_en && <span className="ml-2 text-stone-400">· sincronizado {fechaRelativa(repo.sincronizado_en)}</span>}
              </p>
            </div>
          </div>
          {/* Right: actions */}
          <div className="flex items-center gap-2">
            {/* Indicador de auto-sync activo */}
            <span
              className="flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-medium text-emerald-700 ring-1 ring-emerald-100"
              title="Auto-sincronización activa cada 2 minutos"
            >
              <span className="relative flex h-1.5 w-1.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500" />
              </span>
              Auto-sync
            </span>
            {mensajeSync && (
              <span
                className={cn(
                  'rounded-full px-3 py-1 text-[11px] font-medium transition-opacity',
                  syncRepositorio.isError
                    ? 'bg-red-50 text-red-600 ring-1 ring-red-200'
                    : 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100',
                )}
              >
                {mensajeSync}
              </span>
            )}
            <Button
              variant="outline"
              size="sm"
              disabled={syncRepositorio.isPending}
              onClick={() => syncRepositorio.mutate()}
              className={cn(syncRepositorio.isPending && 'border-purple-200 text-purple-700')}
            >
              <RefreshCw size={13} className={cn(syncRepositorio.isPending && 'animate-spin')} />
              {syncRepositorio.isPending ? 'Sincronizando…' : 'Sincronizar'}
            </Button>
            <a href={`https://github.com/${repo.nombre_completo_github}`} target="_blank" rel="noreferrer">
              <Button variant="outline" size="sm"><ExternalLink size={13} />Ver en GitHub</Button>
            </a>
          </div>
        </div>

        {/* Inline metrics strip */}
        <div className="mt-4 flex flex-wrap gap-5 border-t border-stone-100 pt-3">
          <div className="flex items-center gap-1.5 text-[12px]">
            <GitBranch size={13} className="text-stone-400" />
            <span className="font-semibold text-stone-700">{ramas.isLoading ? '…' : (ramas.data?.length ?? 0)}</span>
            <span className="text-stone-400">ramas</span>
          </div>
          <div className="flex items-center gap-1.5 text-[12px]">
            <GitPullRequest size={13} className={cntAbiertos > 0 ? 'text-emerald-500' : 'text-stone-400'} />
            <span className={cn('font-semibold', cntAbiertos > 0 ? 'text-emerald-700' : 'text-stone-700')}>{prs.isLoading ? '…' : cntAbiertos}</span>
            <span className="text-stone-400">PRs abiertos</span>
          </div>
          <div className="flex items-center gap-1.5 text-[12px]">
            <GitMerge size={13} className="text-violet-400" />
            <span className="font-semibold text-violet-700">{prs.isLoading ? '…' : cntIntegrados}</span>
            <span className="text-stone-400">integrados</span>
          </div>
          {ramaMain && (
            <div className="flex items-center gap-1.5 text-[12px]">
              <span className="h-1.5 w-1.5 rounded-full bg-stone-400" />
              <span className="font-mono font-semibold text-stone-700">{ramaMain.sha_cabeza.slice(0, 7)}</span>
              <span className="text-stone-400">· {fechaRelativa(ramaMain.ultimo_push_en)}</span>
            </div>
          )}
        </div>
      </div>

      {/* ── PIPELINE ── */}
      <div className="shrink-0 grid grid-cols-3 gap-2">
        {/* Desarrollo */}
        <div className="flex items-center gap-2 rounded-xl border border-stone-200 bg-white px-4 py-3">
          <div className="flex-1">
            <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-widest text-stone-400">
              <span className="h-1.5 w-1.5 rounded-full bg-stone-400" />
              Desarrollo
            </p>
            <p className="mt-1 font-mono text-[13px] font-bold text-stone-700">
              {(estadoDespliegue.data?.rama_desarrollo.sha ?? '—').slice(0, 8)}
            </p>
            <p className="mt-0.5 text-[11px] text-stone-400">
              {estadoDespliegue.data?.prs_abiertas.a_desarrollo ?? 0} PRs pendientes
            </p>
          </div>
          <ArrowRight size={14} className="shrink-0 text-stone-300" />
        </div>
        {/* Main prueba */}
        <div className="flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50/40 px-4 py-3">
          <div className="flex-1">
            <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-widest text-amber-500">
              <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
              Main prueba
            </p>
            <p className="mt-1 font-mono text-[13px] font-bold text-amber-800">
              {(estadoDespliegue.data?.rama_main_prueba.sha ?? '—').slice(0, 8)}
            </p>
            <p className="mt-0.5 text-[11px] text-amber-500">
              {estadoDespliegue.data?.prs_abiertas.a_main_prueba ?? 0} PRs pendientes
            </p>
          </div>
          <ArrowRight size={14} className="shrink-0 text-amber-300" />
        </div>
        {/* Producción */}
        <div className="rounded-xl border border-emerald-200 bg-emerald-50/40 px-4 py-3">
          <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-widest text-emerald-600">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
            Producción (main)
          </p>
          <p className="mt-1 font-mono text-[13px] font-bold text-emerald-800">
            {(estadoDespliegue.data?.rama_main.sha ?? ramaMain?.sha_cabeza ?? '—').slice(0, 8)}
          </p>
          <p className="mt-0.5 text-[11px] text-emerald-600">
            {estadoDespliegue.data?.prs_abiertas.a_main ?? 0} PRs pendientes
          </p>
        </div>
      </div>

      {/* ── TABS + CONTENT ── */}
      <div className="flex flex-1 flex-col rounded-xl border border-stone-200 bg-white">

        {/* Tab bar */}
        <div className="flex shrink-0 items-center border-b border-stone-200 px-2">
          <TabBtn active={tabActiva === 'prs'} onClick={() => setTabActiva('prs')}>
            <span className="flex items-center gap-1.5">
              <GitPullRequest size={13} />
              Pull Requests
              {prs.data && (
                <span className="rounded-full bg-stone-100 px-1.5 py-0.5 text-[10px] font-bold text-stone-600">{prs.data.length}</span>
              )}
            </span>
          </TabBtn>
          <TabBtn active={tabActiva === 'ramas'} onClick={() => setTabActiva('ramas')}>
            <span className="flex items-center gap-1.5">
              <GitBranch size={13} />
              Ramas
              {ramas.data && (
                <span className="rounded-full bg-stone-100 px-1.5 py-0.5 text-[10px] font-bold text-stone-600">{ramas.data.length}</span>
              )}
            </span>
          </TabBtn>
          <TabBtn active={tabActiva === 'vinculos'} onClick={() => setTabActiva('vinculos')}>
            <span className="flex items-center gap-1.5">
              <Link2 size={13} />
              Tareas vinculadas
              {vinculosTareas.data && (
                <span className="rounded-full bg-stone-100 px-1.5 py-0.5 text-[10px] font-bold text-stone-600">{vinculosTareas.data.length}</span>
              )}
            </span>
          </TabBtn>
          <TabBtn active={tabActiva === 'commits'} onClick={() => setTabActiva('commits')}>
            <span className="flex items-center gap-1.5">
              <GitCommitHorizontal size={13} />
              Commits
              {commitsRepo.data && (
                <span className="rounded-full bg-stone-100 px-1.5 py-0.5 text-[10px] font-bold text-stone-600">{commitsRepo.data.length}</span>
              )}
            </span>
          </TabBtn>
          <TabBtn active={tabActiva === 'produccion'} onClick={() => setTabActiva('produccion')}>
            <span className="flex items-center gap-1.5">
              <Rocket size={13} />
              Producción
              {eventosProduccion.data && (
                <span className="rounded-full bg-stone-100 px-1.5 py-0.5 text-[10px] font-bold text-stone-600">{eventosProduccion.data.length}</span>
              )}
            </span>
          </TabBtn>
          {/* Person filter */}
          <div className="ml-auto mr-2">
            <select
              value={filtroPersona}
              onChange={(e) => setFiltroPersona(e.target.value)}
              className="h-7 rounded-lg border border-stone-200 bg-white px-2 text-[12px] text-stone-600 outline-none focus:ring-2 focus:ring-purple-200"
            >
              <option value="todas">Todas las personas</option>
              {personasDisponibles.map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
        </div>

        {/* ── Tab: PRs ── */}
        {tabActiva === 'prs' && (
          <div className="flex flex-1">
            {/* List */}
            <div className="flex min-w-0 flex-1 flex-col">
              {/* Filter bar */}
              <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-stone-100 bg-stone-50/50 px-4 py-2">
                <div className="relative min-w-[160px] flex-1">
                  <Search size={11} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-stone-400" />
                  <input
                    type="text"
                    value={buscarPr}
                    onChange={(e) => setBuscarPr(e.target.value)}
                    placeholder="Buscar por título, #, autor…"
                    className="h-7 w-full rounded-lg border border-stone-200 bg-white pl-7 pr-3 text-[12px] outline-none focus:ring-2 focus:ring-purple-200"
                  />
                </div>
                <select
                  value={filtroEstado}
                  onChange={(e) => setFiltroEstado(e.target.value as typeof filtroEstado)}
                  className="h-7 rounded-lg border border-stone-200 bg-white px-2 text-[12px] outline-none focus:ring-2 focus:ring-purple-200"
                >
                  <option value="todos">Todos</option>
                  <option value="abierta">Abiertas</option>
                  <option value="integrada">Integradas</option>
                  <option value="cerrada">Cerradas</option>
                </select>
                <input type="date" value={desdeFecha} onChange={(e) => setDesdeFecha(e.target.value)} title="Desde" className="h-7 rounded-lg border border-stone-200 bg-white px-2 text-[12px] outline-none focus:ring-2 focus:ring-purple-200" />
                <input type="date" value={hastaFecha} onChange={(e) => setHastaFecha(e.target.value)} title="Hasta" className="h-7 rounded-lg border border-stone-200 bg-white px-2 text-[12px] outline-none focus:ring-2 focus:ring-purple-200" />
                <span className="text-[11px] text-stone-400">{prsFiltradas.length} resultado{prsFiltradas.length !== 1 ? 's' : ''}</span>
              </div>
              {/* PR rows */}
              <div className="flex-1">
                {prs.isLoading ? (
                  <div className="flex items-center justify-center py-12"><LoaderCircle size={18} className="animate-spin text-stone-300" /></div>
                ) : prsFiltradas.length === 0 ? (
                  <div className="flex flex-col items-center justify-center gap-2 py-12">
                    <GitPullRequest size={24} className="text-stone-200" />
                    <p className="text-sm text-stone-400">No hay Pull Requests que coincidan.</p>
                  </div>
                ) : (
                  prsFiltradas.map((pr) => (
                    <PrRow
                      key={pr.solicitud_id}
                      pr={pr}
                      selected={prSeleccionado === pr.numero_github}
                      onClick={() => {
                        setPrSeleccionado(prSeleccionado === pr.numero_github ? null : pr.numero_github);
                        setBuscarArchivo('');
                        setArchivosExpandidos(new Set());
                      }}
                    />
                  ))
                )}
              </div>
            </div>

            {/* PR detail panel */}
            <div
              className="shrink-0 overflow-hidden border-l border-stone-200 transition-[width] duration-300 ease-in-out"
              style={{ width: prSeleccionado ? '660px' : '0px' }}
            >
              <div className="flex w-[660px] flex-col">
                {prSeleccionadoData && (
                  <>
                    {/* Panel header */}
                    <div className="shrink-0 border-b border-stone-100 px-5 py-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="rounded bg-stone-100 px-1.5 py-0.5 font-mono text-[11px] font-bold text-stone-500">
                              #{prSeleccionadoData.numero_github}
                            </span>
                            <Chip className={PR_ESTADO[prSeleccionadoData.estado]?.chip ?? ''}>
                              {PR_ESTADO[prSeleccionadoData.estado]?.label ?? prSeleccionadoData.estado}
                            </Chip>
                          </div>
                          <p className="mt-2 break-words text-[14px] font-semibold leading-snug text-stone-900">
                            {prSeleccionadoData.titulo}
                          </p>
                          <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-stone-400">
                            <span className="font-mono">{prSeleccionadoData.rama_origen}</span>
                            <ArrowRight size={11} className="text-stone-300" />
                            <span className="font-mono">{prSeleccionadoData.rama_destino}</span>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => setPrSeleccionado(null)}
                          className="shrink-0 rounded-md p-1 text-stone-400 transition hover:bg-stone-100 hover:text-stone-700"
                        >
                          <X size={14} />
                        </button>
                      </div>
                    </div>

                    {/* Metadata + diff stats */}
                    <div className="shrink-0 border-b border-stone-100 bg-stone-50/60 px-5 py-2.5">
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-stone-500">
                        {prSeleccionadoData.usuario_github_autor && (
                          <span className="flex items-center gap-1">
                            <span className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-purple-100 text-[9px] font-bold text-purple-700">
                              {prSeleccionadoData.usuario_github_autor[0]?.toUpperCase()}
                            </span>
                            <strong className="text-stone-700">{prSeleccionadoData.usuario_github_autor}</strong>
                          </span>
                        )}
                        <span>Abierto <strong className="text-stone-700">{fechaCorta(prSeleccionadoData.abierta_en)}</strong></span>
                        {prSeleccionadoData.integrada_en && (
                          <span>Integrado <strong className="text-stone-700">{fechaCorta(prSeleccionadoData.integrada_en)}</strong></span>
                        )}
                        {prSeleccionadoData.cerrada_en && !prSeleccionadoData.integrada_en && (
                          <span>Cerrado <strong className="text-stone-700">{fechaCorta(prSeleccionadoData.cerrada_en)}</strong></span>
                        )}
                        {archivosPr.data && (
                          <>
                            <span className="text-stone-300">·</span>
                            <span><strong className="text-stone-700">{archivosPr.data.length}</strong> archivos</span>
                            <span className="font-medium text-emerald-600">+{totalAdiciones}</span>
                            <span className="font-medium text-red-500">−{totalEliminaciones}</span>
                          </>
                        )}
                        {commitsPr.data && (
                          <span><strong className="text-stone-700">{commitsPr.data.length}</strong> commits en PR</span>
                        )}
                      </div>
                    </div>

                    {/* Files toolbar */}
                    <div className="flex shrink-0 items-center justify-between gap-2 border-b border-stone-100 px-5 py-2">
                      <div className="flex items-center gap-1.5 text-[12px] font-medium text-stone-600">
                        <FileDiff size={13} />
                        Archivos cambiados
                        {archivosPr.data && (
                          <span className="rounded-full bg-stone-100 px-1.5 text-[10px] font-bold text-stone-500">{archivosPr.data.length}</span>
                        )}
                      </div>
                      <div className="relative">
                        <Search size={11} className="absolute left-2 top-1/2 -translate-y-1/2 text-stone-400" />
                        <input
                          type="text"
                          value={buscarArchivo}
                          onChange={(e) => setBuscarArchivo(e.target.value)}
                          placeholder="Filtrar archivos…"
                          className="h-6 w-40 rounded-md border border-stone-200 bg-stone-50 pl-6 pr-2 text-[11px] outline-none focus:ring-1 focus:ring-purple-200"
                        />
                      </div>
                    </div>

                    {/* Files list */}
                    <div className="flex-1">
                      {archivosPr.isLoading ? (
                        <div className="flex items-center justify-center py-8"><LoaderCircle size={16} className="animate-spin text-stone-300" /></div>
                      ) : archivosFiltrados.length === 0 ? (
                        <div className="flex flex-col items-center justify-center gap-2 py-8">
                          <FileDiff size={20} className="text-stone-200" />
                          <p className="text-[12px] text-stone-400">Sin archivos.</p>
                        </div>
                      ) : (
                        <div className="divide-y divide-stone-100">
                          {archivosFiltrados.map((a) => {
                            const expandido = archivosExpandidos.has(a.nombre_archivo);
                            const est = ARCHIVO_ESTADO[a.estado] ?? { label: a.estado.slice(0, 3), bg: 'bg-stone-50', text: 'text-stone-500' };
                            return (
                              <div key={a.nombre_archivo} className="px-4 py-2.5">
                                <button
                                  type="button"
                                  onClick={() => setArchivosExpandidos((prev) => {
                                    const next = new Set(prev);
                                    if (next.has(a.nombre_archivo)) next.delete(a.nombre_archivo);
                                    else next.add(a.nombre_archivo);
                                    return next;
                                  })}
                                  className="flex w-full items-start gap-2.5 text-left"
                                >
                                  <ChevronDown size={13} className={cn('mt-0.5 shrink-0 text-stone-400 transition-transform duration-150', !expandido && '-rotate-90')} />
                                  <span className={cn('shrink-0 rounded px-1.5 py-0.5 text-[10px] font-bold uppercase', est.bg, est.text)}>{est.label}</span>
                                  <p className="flex-1 break-all font-mono text-[11px] leading-relaxed text-stone-700">{a.nombre_archivo}</p>
                                  <div className="flex shrink-0 items-center gap-2 text-[10px] font-semibold">
                                    <span className="text-emerald-600">+{a.adiciones}</span>
                                    <span className="text-red-500">−{a.eliminaciones}</span>
                                  </div>
                                </button>
                                {expandido && <div className="mt-2">{renderPatch(a.patch)}</div>}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ── Tab: Commits ── */}
        {tabActiva === 'commits' && (
          <div className="flex-1">
            {/* Barra sticky: búsqueda + métricas */}
            <div className="sticky top-0 z-10 flex flex-wrap items-center gap-3 border-b border-stone-100 bg-white/95 px-4 py-2.5 backdrop-blur">
              <div className="relative min-w-[220px] flex-1">
                <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-stone-400" />
                <input
                  type="text"
                  value={buscarCommit}
                  onChange={(e) => setBuscarCommit(e.target.value)}
                  placeholder="Buscar por SHA, mensaje o autor…"
                  className="h-8 w-full rounded-lg border border-stone-200 bg-stone-50 pl-7 pr-3 text-[12px] outline-none transition focus:border-purple-300 focus:bg-white focus:ring-2 focus:ring-purple-200"
                />
              </div>
              <div className="flex items-center gap-4 text-[11px]">
                <span className="flex items-center gap-1.5">
                  <GitCommitHorizontal size={12} className="text-stone-400" />
                  <span className="font-semibold text-stone-700">{estadisticasCommits.total}</span>
                  <span className="text-stone-400">commits</span>
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="inline-flex h-3 w-3 items-center justify-center rounded-full bg-purple-100 text-[7px] font-bold text-purple-700">●</span>
                  <span className="font-semibold text-stone-700">{estadisticasCommits.autores}</span>
                  <span className="text-stone-400">autores</span>
                </span>
                {commitsRepo.isFetching && !commitsRepo.isLoading && (
                  <LoaderCircle size={12} className="animate-spin text-purple-400" />
                )}
              </div>
            </div>

            {commitsRepo.isLoading ? (
              <div className="flex items-center justify-center py-12"><LoaderCircle size={18} className="animate-spin text-stone-300" /></div>
            ) : (commitsRepo.data?.length ?? 0) === 0 ? (
              <div className="flex flex-col items-center justify-center gap-2 py-16">
                <GitCommitHorizontal size={28} className="text-stone-200" />
                <p className="text-sm text-stone-500">No hay commits para los filtros aplicados.</p>
                {buscarCommit && (
                  <button
                    type="button"
                    onClick={() => setBuscarCommit('')}
                    className="text-[12px] text-purple-600 hover:underline"
                  >
                    Limpiar búsqueda
                  </button>
                )}
              </div>
            ) : (
              <div className="px-5 py-4">
                {commitsAgrupados.map((grupo) => (
                  <div key={grupo.dia} className="mb-6 last:mb-0">
                    {/* Cabecera de día */}
                    <div className="mb-2 flex items-center gap-3">
                      <p className="text-[10px] font-semibold uppercase tracking-widest text-stone-400">
                        {grupo.dia}
                      </p>
                      <div className="h-px flex-1 bg-stone-100" />
                      <span className="text-[10px] text-stone-400">
                        {grupo.items.length} commit{grupo.items.length !== 1 ? 's' : ''}
                      </span>
                    </div>

                    {/* Timeline de commits del día */}
                    <div className="relative space-y-0 pl-5">
                      {/* Línea vertical del timeline */}
                      <span className="absolute bottom-2 left-[7px] top-2 w-px bg-stone-200" />

                      {grupo.items.map((c) => {
                        const autor = c.usuario_github_autor ?? c.nombre_autor ?? '?';
                        const colores = colorAvatar(autor);
                        const lineas = c.mensaje.split('\n');
                        const titulo = lineas[0];
                        const cuerpo = lineas.slice(1).join('\n').trim();
                        const prefixRama = c.rama ? ramaPrefix(c.rama) : '';
                        const colorRama = RAMA_PREFIX_COLOR[prefixRama] ?? 'bg-stone-100 text-stone-600';

                        return (
                          <div key={c.sha} className="group relative py-2">
                            {/* Punto del timeline */}
                            <span className="absolute -left-[18px] top-3.5 flex h-3.5 w-3.5 items-center justify-center rounded-full border-2 border-white bg-stone-300 ring-1 ring-stone-200 transition group-hover:bg-purple-500 group-hover:ring-purple-200" />

                            <div className="flex items-start gap-3 rounded-lg border border-transparent px-3 py-2 transition hover:border-stone-200 hover:bg-stone-50/60">
                              {/* Avatar autor */}
                              <div
                                className={cn(
                                  'flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[11px] font-bold',
                                  colores.bg,
                                  colores.text,
                                )}
                                title={autor}
                              >
                                {autor[0]?.toUpperCase()}
                              </div>

                              <div className="min-w-0 flex-1">
                                {/* Título del commit */}
                                <p className="break-words text-[13px] font-medium leading-snug text-stone-800">
                                  {titulo}
                                </p>

                                {/* Cuerpo opcional (si el mensaje tiene más líneas) */}
                                {cuerpo && (
                                  <p className="mt-1 whitespace-pre-wrap break-words text-[11.5px] leading-relaxed text-stone-500">
                                    {cuerpo}
                                  </p>
                                )}

                                {/* Meta: sha + rama + autor + tiempo */}
                                <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px]">
                                  <span className="rounded bg-stone-100 px-1.5 py-0.5 font-mono font-semibold text-stone-600 transition group-hover:bg-purple-100 group-hover:text-purple-700">
                                    {c.sha.slice(0, 7)}
                                  </span>
                                  <span className="font-medium text-stone-600">{autor}</span>
                                  {c.rama && (
                                    <span className="flex items-center gap-1 text-stone-400">
                                      <GitBranch size={10} />
                                      {prefixRama && (
                                        <span className={cn('rounded px-1 py-0.5 text-[9px] font-semibold uppercase', colorRama)}>
                                          {prefixRama}
                                        </span>
                                      )}
                                      <span className="break-all font-mono">
                                        {c.rama.includes('/') ? c.rama.split('/').slice(1).join('/') : c.rama}
                                      </span>
                                    </span>
                                  )}
                                  <span className="text-stone-300">·</span>
                                  <span className="text-stone-400">{fechaRelativa(c.confirmado_en)}</span>
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── Tab: Ramas ── */}
        {tabActiva === 'ramas' && (
          <div className="flex-1">
            {ramas.isLoading ? (
              <div className="flex items-center justify-center py-12"><LoaderCircle size={18} className="animate-spin text-stone-300" /></div>
            ) : ramasFiltradas.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-2 py-12">
                <GitBranch size={24} className="text-stone-200" />
                <p className="text-sm text-stone-400">Sin ramas sincronizadas.</p>
                <Button variant="outline" size="sm" onClick={() => syncRepositorio.mutate()} disabled={syncRepositorio.isPending}>
                  <RefreshCw size={13} />Sincronizar ahora
                </Button>
              </div>
            ) : (
              <table className="w-full text-[13px]">
                <thead>
                  <tr className="sticky top-0 z-10 border-b border-stone-200 bg-stone-50">
                    <th className="px-5 py-2.5 text-left text-[10px] font-semibold uppercase tracking-widest text-stone-400">Rama</th>
                    <th className="px-4 py-2.5 text-left text-[10px] font-semibold uppercase tracking-widest text-stone-400">Tipo</th>
                    <th className="px-4 py-2.5 text-left text-[10px] font-semibold uppercase tracking-widest text-stone-400">SHA</th>
                    <th className="px-4 py-2.5 text-left text-[10px] font-semibold uppercase tracking-widest text-stone-400">Último push</th>
                    <th className="px-4 py-2.5 text-left text-[10px] font-semibold uppercase tracking-widest text-stone-400">Estado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {ramasFiltradas.map((rama) => {
                    const esMain = rama.nombre === repo.rama_principal;
                    const prefix = ramaPrefix(rama.nombre);
                    const prefixColor = RAMA_PREFIX_COLOR[prefix] ?? 'bg-stone-100 text-stone-500';
                    return (
                      <tr key={rama.rama_id} className={cn('transition-colors hover:bg-stone-50/70', esMain && 'bg-emerald-50/30')}>
                        <td className="px-5 py-3">
                          <div className="flex items-center gap-2">
                            <GitBranch size={13} className={esMain ? 'text-emerald-500' : 'text-stone-400'} />
                            <span className={cn('break-all font-mono text-[12px] font-medium', esMain ? 'text-emerald-800' : 'text-stone-700')}>
                              {rama.nombre}
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          {prefix ? (
                            <span className={cn('rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase', prefixColor)}>{prefix}</span>
                          ) : <span className="text-stone-300">—</span>}
                        </td>
                        <td className="px-4 py-3">
                          <span className="font-mono text-[11px] text-stone-400">{rama.sha_cabeza.slice(0, 7)}</span>
                        </td>
                        <td className="px-4 py-3 text-[12px] text-stone-500">{fechaRelativa(rama.ultimo_push_en)}</td>
                        <td className="px-4 py-3">
                          {esMain ? (
                            <Chip className="bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200"><Shield size={9} />Principal</Chip>
                          ) : rama.esta_activa ? (
                            <Chip className="bg-blue-50 text-blue-600">Activa</Chip>
                          ) : (
                            <Chip className="bg-stone-50 text-stone-400">Inactiva</Chip>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        )}

        {/* ── Tab: Vínculos ── */}
        {tabActiva === 'vinculos' && (
          <div className="grid flex-1 grid-cols-2 divide-x divide-stone-100">
            <div>
            {vinculosTareas.isLoading ? (
              <div className="flex items-center justify-center py-12"><LoaderCircle size={18} className="animate-spin text-stone-300" /></div>
            ) : (vinculosTareas.data?.length ?? 0) === 0 ? (
              <div className="flex flex-col items-center justify-center gap-2 py-12">
                <Link2 size={22} className="text-stone-200" />
                <p className="text-sm text-stone-400">Aún no hay vínculos automáticos detectados.</p>
                <p className="text-[12px] text-stone-400">Incluye el ID de tarea (ej: dm-abc12345) en el título, rama o descripción del PR.</p>
              </div>
            ) : (
              <table className="w-full text-[13px]">
                <thead>
                  <tr className="sticky top-0 border-b border-stone-200 bg-stone-50">
                    <th className="px-5 py-2.5 text-left text-[10px] font-semibold uppercase tracking-widest text-stone-400">Tarea</th>
                    <th className="px-4 py-2.5 text-left text-[10px] font-semibold uppercase tracking-widest text-stone-400">PR</th>
                    <th className="px-4 py-2.5 text-left text-[10px] font-semibold uppercase tracking-widest text-stone-400">Rama</th>
                  </tr>
                </thead>
                <tbody>
                  {(vinculosTareas.data ?? []).map((v) => (
                    <tr
                      key={`${v.tarea_id}-${v.solicitud_numero ?? ''}-${v.rama ?? ''}`}
                      className={cn(
                        'cursor-pointer border-b border-stone-100 hover:bg-stone-50 last:border-0',
                        tareaTimelineId === v.tarea_id && 'bg-purple-50/60',
                      )}
                      onClick={() => setTareaTimelineId(v.tarea_id)}
                    >
                      <td className="px-5 py-3">
                        <p className="font-mono text-[11px] text-stone-400">{v.tarea_id.slice(0, 8)}</p>
                        <p className="text-[12px] font-medium text-stone-700">{v.titulo}</p>
                      </td>
                      <td className="px-4 py-3">
                        {v.solicitud_numero ? (
                          <span className="font-mono text-[12px] font-semibold text-stone-700">#{v.solicitud_numero}</span>
                        ) : <span className="text-stone-300">—</span>}
                      </td>
                      <td className="px-4 py-3">
                        {v.rama ? (
                          <span className="break-all font-mono text-[11px] text-stone-600">{v.rama}</span>
                        ) : <span className="text-stone-300">—</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            </div>
            <div>
              <div className="sticky top-0 border-b border-stone-100 bg-stone-50/70 px-4 py-2 text-[12px] font-semibold text-stone-700">
                Timeline tarea ↔ PR ↔ commit
              </div>
              {!tareaTimelineId ? (
                <p className="p-4 text-[12px] text-stone-500">Selecciona una tarea vinculada para ver su trazabilidad completa.</p>
              ) : trazabilidadTarea.isLoading ? (
                <div className="flex items-center justify-center py-10"><LoaderCircle size={16} className="animate-spin text-stone-300" /></div>
              ) : (trazabilidadTarea.data?.length ?? 0) === 0 ? (
                <p className="p-4 text-[12px] text-stone-500">Sin eventos de trazabilidad para esta tarea.</p>
              ) : (
                <div className="space-y-2 p-3">
                  {(trazabilidadTarea.data ?? []).map((e, idx) => (
                    <div key={`${e.tipo}-${e.ocurrido_en}-${idx}`} className="rounded-lg border border-stone-200 bg-white px-3 py-2">
                      <p className="text-[11px] font-semibold text-stone-700">{etiquetaEvento(e)}</p>
                      <p className="text-[11px] text-stone-500">{fechaCorta(e.ocurrido_en)} · {fechaRelativa(e.ocurrido_en)}</p>
                      <p className="mt-1 text-[12px] text-stone-700">{e.titulo}</p>
                      <p className="mt-1 break-all font-mono text-[10px] text-stone-500">
                        {e.pr_numero ? `PR #${e.pr_numero}` : ''}
                        {e.sha ? ` SHA ${e.sha.slice(0, 8)}` : ''}
                        {e.rama ? ` · ${e.rama}` : ''}
                        {e.rama_destino ? ` → ${e.rama_destino}` : ''}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── Tab: Producción ── */}
        {tabActiva === 'produccion' && (
          <div className="flex-1">
            <div className="sticky top-0 z-10 flex flex-wrap items-center gap-2 border-b border-stone-100 bg-stone-50/70 px-4 py-2">
              <select
                value={prodPersona}
                onChange={(e) => setProdPersona(e.target.value)}
                className="h-7 rounded-lg border border-stone-200 bg-white px-2 text-[12px] text-stone-600 outline-none focus:ring-2 focus:ring-purple-200"
              >
                <option value="todas">Todas las personas</option>
                {personasProduccion.map((p) => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
              <input
                type="date"
                value={prodDesdeFecha}
                onChange={(e) => setProdDesdeFecha(e.target.value)}
                title="Desde"
                className="h-7 rounded-lg border border-stone-200 bg-white px-2 text-[12px] outline-none focus:ring-2 focus:ring-purple-200"
              />
              <input
                type="date"
                value={prodHastaFecha}
                onChange={(e) => setProdHastaFecha(e.target.value)}
                title="Hasta"
                className="h-7 rounded-lg border border-stone-200 bg-white px-2 text-[12px] outline-none focus:ring-2 focus:ring-purple-200"
              />
              <span className="text-[11px] text-stone-400">
                {eventosProduccionFiltrados.length} resultado{eventosProduccionFiltrados.length !== 1 ? 's' : ''}
              </span>
            </div>
            {eventosProduccion.isLoading ? (
              <div className="flex items-center justify-center py-12"><LoaderCircle size={18} className="animate-spin text-stone-300" /></div>
            ) : eventosProduccionFiltrados.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-2 py-12">
                <Rocket size={24} className="text-stone-200" />
                <p className="text-sm text-stone-400">No hay despliegues para los filtros aplicados.</p>
              </div>
            ) : (
              <table className="w-full text-[13px]">
                <thead>
                  <tr className="sticky top-0 border-b border-stone-200 bg-stone-50">
                    <th className="px-5 py-2.5 text-left text-[10px] font-semibold uppercase tracking-widest text-stone-400">Fecha</th>
                    <th className="px-4 py-2.5 text-left text-[10px] font-semibold uppercase tracking-widest text-stone-400">PR</th>
                    <th className="px-4 py-2.5 text-left text-[10px] font-semibold uppercase tracking-widest text-stone-400">Origen</th>
                    <th className="px-4 py-2.5 text-left text-[10px] font-semibold uppercase tracking-widest text-stone-400">Commit prod</th>
                  </tr>
                </thead>
                <tbody>
                  {eventosProduccionFiltrados.map((e) => (
                    <tr key={e.pr_numero} className="border-b border-stone-100 hover:bg-stone-50 last:border-0">
                      <td className="px-5 py-3 text-[12px] text-stone-600">{fechaCorta(e.integrada_en)}</td>
                      <td className="px-4 py-3">
                        <p className="font-mono text-[11px] text-stone-500">#{e.pr_numero}</p>
                        <p className="text-[12px] text-stone-700">{e.titulo}</p>
                        {e.usuario_github_autor && (
                          <p className="text-[11px] text-stone-500">por {e.usuario_github_autor}</p>
                        )}
                      </td>
                      <td className="px-4 py-3 font-mono text-[11px] text-stone-500">{e.rama_origen} → {e.rama_destino}</td>
                      <td className="px-4 py-3 font-mono text-[11px] text-stone-600">{e.merge_commit_sha ? e.merge_commit_sha.slice(0, 12) : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
