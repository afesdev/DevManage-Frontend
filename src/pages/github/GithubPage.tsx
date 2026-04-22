import { useMemo, useState, useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import {
  AlertCircle,
  CheckCircle2,
  ChevronDown,
  ExternalLink,
  FolderGit2,
  GitBranch,
  Link2,
  LoaderCircle,
  Lock,
  LogOut,
  Plus,
  RefreshCw,
  Search,
  Unlock,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { authService } from '@/services/auth.service';
import {
  githubService,
  type RepositorioGithubPublico,
  type RepositorioGithubUsuario,
} from '@/services/github.service';
import { tableroService } from '@/services/tablero.service';
import { useAuthStore } from '@/store/auth.store';
import { cn } from '@/lib/utils';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function mensajeErrorApi(error: unknown): string {
  if (axios.isAxiosError(error)) {
    const d = error.response?.data;
    if (d && typeof d === 'object' && 'message' in d) {
      const m = (d as { message: unknown }).message;
      if (Array.isArray(m)) return m.join(' ');
      if (typeof m === 'string') return m;
    }
    if (error.response?.status === 404)
      return 'No encontrado o sin acceso. Conecta tu cuenta de GitHub o pide acceso al repo.';
  }
  return 'No se pudo completar la acción.';
}

function fechaRelativa(iso: string | null): string {
  if (!iso) return '—';
  try {
    const diff = Date.now() - new Date(iso).getTime();
    const days = Math.floor(diff / 86400000);
    if (days === 0) return 'hoy';
    if (days === 1) return 'ayer';
    if (days < 30) return `hace ${days}d`;
    return new Date(iso).toLocaleDateString('es', { day: '2-digit', month: 'short' });
  } catch {
    return iso;
  }
}

// ─── Sub-componentes ──────────────────────────────────────────────────────────

function Chip({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide',
        className,
      )}
    >
      {children}
    </span>
  );
}

function TabBtn({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
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

function Banner({
  tipo,
  children,
  onClose,
}: {
  tipo: 'ok' | 'err';
  children: React.ReactNode;
  onClose: () => void;
}) {
  return (
    <div
      className={cn(
        'flex items-start gap-2 rounded-xl border px-4 py-3 text-[13px]',
        tipo === 'ok'
          ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
          : 'border-red-200 bg-red-50 text-red-800',
      )}
    >
      {tipo === 'ok' ? (
        <CheckCircle2 size={15} className="mt-0.5 shrink-0 text-emerald-600" />
      ) : (
        <AlertCircle size={15} className="mt-0.5 shrink-0 text-red-500" />
      )}
      <p className="flex-1">{children}</p>
      <button
        type="button"
        onClick={onClose}
        className="shrink-0 text-current opacity-50 hover:opacity-100"
      >
        ×
      </button>
    </div>
  );
}

// ─── Página ────────────────────────────────────────────────────────────────────

export function GithubPage() {
  const token = useAuthStore((s) => s.token);
  const proyectoActivoId = useAuthStore((s) => s.proyectoActivoId);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();

  const [slugRepo, setSlugRepo] = useState('');
  const [resuelto, setResuelto] = useState<RepositorioGithubPublico | null>(null);
  const [errorResolver, setErrorResolver] = useState<string | null>(null);
  const [errorVincular, setErrorVincular] = useState<string | null>(null);
  const [tabVincular, setTabVincular] = useState<'mis-repos' | 'buscar'>('mis-repos');
  const [webhookAbierto, setWebhookAbierto] = useState(false);
  const [buscarMisRepos, setBuscarMisRepos] = useState('');
  const [mensaje, setMensaje] = useState<{ tipo: 'ok' | 'err'; texto: string } | null>(null);

  // ── OAuth callback ────────────────────────────────────────────────────────
  useEffect(() => {
    const ok = searchParams.get('github');
    const err = searchParams.get('github_error');
    if (!ok && !err) return;
    if (ok === 'conectado')
      setMensaje({ tipo: 'ok', texto: 'Cuenta de GitHub conectada. Ya puedes buscar repos privados.' });
    if (err === '1')
      setMensaje({ tipo: 'err', texto: 'No se pudo conectar GitHub. Revisa la config del servidor.' });
    const limpio = new URLSearchParams(searchParams);
    limpio.delete('github');
    limpio.delete('github_error');
    setSearchParams(limpio, { replace: true });
    void queryClient.invalidateQueries({ queryKey: ['perfil', token] });
    void queryClient.invalidateQueries({ queryKey: ['perfil-layout', token] });
  }, [searchParams]);

  // ── Queries ───────────────────────────────────────────────────────────────
  const perfil = useQuery({
    queryKey: ['perfil', token],
    queryFn: () => authService.me(token as string),
    enabled: Boolean(token),
  });

  const proyectos = useQuery({
    queryKey: ['github-proyectos', token],
    queryFn: () => tableroService.obtenerProyectos(token as string),
    enabled: Boolean(token),
  });

  const proyectoNombre = useMemo(
    () => (proyectos.data ?? []).find((p) => p.proyecto_id === proyectoActivoId)?.nombre,
    [proyectos.data, proyectoActivoId],
  );

  const repositorios = useQuery({
    queryKey: ['github-repositorios', proyectoActivoId, token],
    queryFn: () =>
      githubService.obtenerRepositoriosPorProyecto(proyectoActivoId as string, token as string),
    enabled: Boolean(proyectoActivoId && token),
  });

  const misRepos = useQuery({
    queryKey: ['github-mis-repos', proyectoActivoId, token],
    queryFn: () => githubService.obtenerMisRepositorios(token as string, proyectoActivoId ?? undefined),
    enabled: Boolean(token && perfil.data?.github_conectado),
  });

  // ── Mutations ─────────────────────────────────────────────────────────────
  const iniciarOAuth = useMutation({
    mutationFn: () => authService.urlAutorizacionGithub(token as string),
    onSuccess: (data) => { window.location.href = data.url; },
    onError: (e) => setMensaje({ tipo: 'err', texto: mensajeErrorApi(e) }),
  });

  const desconectarGithub = useMutation({
    mutationFn: () => authService.desconectarGithub(token as string),
    onSuccess: () => {
      setMensaje({ tipo: 'ok', texto: 'GitHub desvinculado de tu cuenta.' });
      void queryClient.invalidateQueries({ queryKey: ['perfil', token] });
      void queryClient.invalidateQueries({ queryKey: ['perfil-layout', token] });
    },
  });

  const resolverRepo = useMutation({
    mutationFn: () => githubService.resolverRepositorio(slugRepo, token as string),
    onSuccess: (data) => { setResuelto(data); setErrorResolver(null); },
    onError: (e) => { setResuelto(null); setErrorResolver(mensajeErrorApi(e)); },
  });

  const vincularRepo = useMutation({
    mutationFn: (repo: RepositorioGithubPublico | RepositorioGithubUsuario) => {
      if (!proyectoActivoId) throw new Error('Sin proyecto activo');
      return githubService.vincularRepositorio(
        { proyecto_id: proyectoActivoId, nombre_completo_github: repo.nombre_completo_github, id_github: repo.id_github, rama_principal: repo.rama_principal },
        token as string,
      );
    },
    onSuccess: (data) => {
      setErrorVincular(null);
      setSlugRepo('');
      setResuelto(null);
      setMensaje({ tipo: 'ok', texto: 'Repositorio vinculado correctamente.' });
      void queryClient.invalidateQueries({ queryKey: ['github-repositorios', proyectoActivoId, token] });
      void queryClient.invalidateQueries({ queryKey: ['github-mis-repos', proyectoActivoId, token] });
      navigate(`/github/repositorios/${data.repositorio_id}`);
    },
    onError: (e) => setErrorVincular(mensajeErrorApi(e)),
  });

  // ── Derived ───────────────────────────────────────────────────────────────
  const misReposFiltrados = useMemo(() => {
    const q = buscarMisRepos.trim().toLowerCase();
    if (!q) return misRepos.data ?? [];
    return (misRepos.data ?? []).filter((r) =>
      r.nombre_completo_github.toLowerCase().includes(q),
    );
  }, [misRepos.data, buscarMisRepos]);

  const githubConectado = perfil.data?.github_conectado ?? false;

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col gap-5">
      {/* Header */}
      <div className="flex shrink-0 items-start justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-semibold text-stone-800">
            <FolderGit2 size={20} className="text-stone-700" />
            GitHub
          </h1>
          <p className="mt-0.5 text-[13px] text-stone-400">
            Conecta tu cuenta, vincula repositorios al proyecto y gestiona ramas y PRs.
          </p>
        </div>
      </div>

      {/* Feedback banner */}
      {mensaje && (
        <Banner tipo={mensaje.tipo} onClose={() => setMensaje(null)}>
          {mensaje.texto}
        </Banner>
      )}

      {/* Connection card */}
      <div className="rounded-xl border border-stone-200 bg-white shadow-sm">
        <div className="flex items-center justify-between gap-4 px-5 py-4">
          <div className="flex items-center gap-3">
            <div
              className={cn(
                'flex h-9 w-9 items-center justify-center rounded-full',
                githubConectado ? 'bg-stone-900' : 'bg-stone-100',
              )}
            >
              <FolderGit2 size={16} className={githubConectado ? 'text-white' : 'text-stone-400'} />
            </div>
            <div>
              <p className="text-[13px] font-semibold text-stone-800">
                {githubConectado
                  ? `Conectado como @${perfil.data?.usuario_github ?? '—'}`
                  : 'Cuenta de GitHub no conectada'}
              </p>
              <p className="text-[11px] text-stone-400">
                {githubConectado
                  ? 'Puedes acceder a repos privados y vincularlos al proyecto.'
                  : 'Conecta para listar repos privados. Los públicos siempre se pueden vincular por slug.'}
              </p>
            </div>
          </div>
          {githubConectado ? (
            <div className="flex shrink-0 items-center gap-2">
              <Chip className="bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                Conectado
              </Chip>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={desconectarGithub.isPending}
                onClick={() => desconectarGithub.mutate()}
              >
                {desconectarGithub.isPending ? (
                  <LoaderCircle size={13} className="animate-spin" />
                ) : (
                  <LogOut size={13} />
                )}
                Desconectar
              </Button>
            </div>
          ) : (
            <Button
              type="button"
              size="sm"
              disabled={!token || iniciarOAuth.isPending}
              onClick={() => iniciarOAuth.mutate()}
            >
              {iniciarOAuth.isPending ? (
                <LoaderCircle size={13} className="animate-spin" />
              ) : (
                <FolderGit2 size={13} />
              )}
              Conectar con GitHub
            </Button>
          )}
        </div>

        {/* Active project bar */}
        <div className="flex items-center justify-between border-t border-stone-100 bg-stone-50/60 px-5 py-2.5">
          <div className="flex items-center gap-2 text-[12px]">
            <span className="text-stone-400">Proyecto activo:</span>
            {proyectoActivoId ? (
              <span className="font-medium text-stone-700">{proyectoNombre ?? proyectoActivoId}</span>
            ) : (
              <span className="text-amber-600">Sin proyecto seleccionado</span>
            )}
          </div>
          {!proyectoActivoId && (
            <button
              type="button"
              onClick={() => navigate('/proyectos')}
              className="text-[11px] font-medium text-purple-600 hover:underline"
            >
              Seleccionar proyecto →
            </button>
          )}
        </div>
      </div>

      {/* Main grid */}
      <div className="grid gap-5 lg:grid-cols-[1fr_400px]">

        {/* ── Repos vinculados ───────────────────────────────────────── */}
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <h2 className="text-[13px] font-semibold text-stone-700">
              Repositorios vinculados
              {repositorios.data && (
                <span className="ml-2 rounded-full bg-stone-100 px-1.5 py-0.5 text-[10px] font-bold text-stone-500">
                  {repositorios.data.length}
                </span>
              )}
            </h2>
            {proyectoActivoId && (
              <button
                type="button"
                onClick={() => void queryClient.invalidateQueries({ queryKey: ['github-repositorios', proyectoActivoId, token] })}
                className="inline-flex items-center gap-1 text-[11px] text-stone-400 hover:text-stone-700"
              >
                <RefreshCw size={11} />
                Refrescar
              </button>
            )}
          </div>

          {!proyectoActivoId ? (
            <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-stone-200 py-10">
              <AlertCircle size={20} className="text-amber-400" />
              <p className="text-[13px] text-stone-500">Selecciona un proyecto para ver sus repos.</p>
            </div>
          ) : repositorios.isLoading ? (
            <div className="flex items-center justify-center py-10">
              <LoaderCircle size={18} className="animate-spin text-stone-300" />
            </div>
          ) : (repositorios.data?.length ?? 0) === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-stone-200 py-10">
              <GitBranch size={22} className="text-stone-200" />
              <p className="text-[13px] text-stone-400">No hay repositorios vinculados aún.</p>
              <p className="text-[11px] text-stone-400">Usa el panel de la derecha para añadir uno.</p>
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {(repositorios.data ?? []).map((repo) => (
                <Link
                  key={repo.repositorio_id}
                  to={`/github/repositorios/${repo.repositorio_id}`}
                  className="group flex flex-col gap-2 rounded-xl border border-stone-200 bg-white p-4 shadow-sm transition hover:border-purple-300 hover:shadow-md"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-stone-900">
                        <GitBranch size={12} className="text-white" />
                      </div>
                      <p className="truncate font-mono text-[13px] font-semibold text-stone-800 group-hover:text-purple-700">
                        {repo.nombre_completo_github}
                      </p>
                    </div>
                    <ExternalLink size={13} className="mt-0.5 shrink-0 text-stone-300 group-hover:text-purple-400" />
                  </div>

                  <div className="flex flex-wrap items-center gap-1.5">
                    <Chip className="bg-stone-100 text-stone-600">
                      <GitBranch size={9} />
                      {repo.rama_principal}
                    </Chip>
                    {repo.esta_activo && (
                      <Chip className="bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200">
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                        Activo
                      </Chip>
                    )}
                  </div>

                  <p className="text-[11px] text-stone-400">
                    {repo.sincronizado_en
                      ? `Sincronizado ${fechaRelativa(repo.sincronizado_en)}`
                      : 'Sin sincronizar'}
                    {' · '}
                    <span className="text-purple-600 group-hover:underline">Ver panel →</span>
                  </p>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* ── Vincular nuevo repo ────────────────────────────────────── */}
        <div className="flex flex-col overflow-hidden rounded-xl border border-stone-200 bg-white shadow-sm">
          <div className="flex shrink-0 items-center gap-1.5 border-b border-stone-200 px-2">
            <TabBtn active={tabVincular === 'mis-repos'} onClick={() => setTabVincular('mis-repos')}>
              <span className="flex items-center gap-1.5">
                <FolderGit2 size={13} />
                Mis repos
              </span>
            </TabBtn>
            <TabBtn active={tabVincular === 'buscar'} onClick={() => setTabVincular('buscar')}>
              <span className="flex items-center gap-1.5">
                <Search size={13} />
                Buscar por slug
              </span>
            </TabBtn>
          </div>

          {/* ── Tab: Mis repos ───────────────────────────────────────── */}
          {tabVincular === 'mis-repos' && (
            <div className="flex flex-1 flex-col">
              {!githubConectado ? (
                <div className="flex flex-1 flex-col items-center justify-center gap-3 px-5 py-10 text-center">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-stone-100">
                    <FolderGit2 size={18} className="text-stone-400" />
                  </div>
                  <p className="text-[13px] text-stone-500">
                    Conecta tu cuenta de GitHub para listar tus repositorios.
                  </p>
                  <Button type="button" size="sm" onClick={() => iniciarOAuth.mutate()} disabled={iniciarOAuth.isPending}>
                    {iniciarOAuth.isPending ? <LoaderCircle size={13} className="animate-spin" /> : <FolderGit2 size={13} />}
                    Conectar GitHub
                  </Button>
                </div>
              ) : (
                <>
                  <div className="shrink-0 border-b border-stone-100 px-4 py-2.5">
                    <div className="relative">
                      <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-stone-400" />
                      <input
                        type="text"
                        value={buscarMisRepos}
                        onChange={(e) => setBuscarMisRepos(e.target.value)}
                        placeholder="Filtrar repositorios…"
                        className="h-7 w-full rounded-lg border border-stone-200 bg-stone-50 pl-7 pr-3 text-[12px] outline-none focus:ring-2 focus:ring-purple-200"
                      />
                    </div>
                  </div>
                  <div className="flex-1 overflow-y-auto">
                    {misRepos.isLoading ? (
                      <div className="flex items-center justify-center py-8">
                        <LoaderCircle size={16} className="animate-spin text-stone-300" />
                      </div>
                    ) : misReposFiltrados.length === 0 ? (
                      <div className="flex flex-col items-center justify-center gap-1.5 py-8">
                        <FolderGit2 size={20} className="text-stone-200" />
                        <p className="text-[12px] text-stone-400">Sin resultados.</p>
                      </div>
                    ) : (
                      <div className="divide-y divide-stone-100">
                        {misReposFiltrados.map((repo) => (
                          <div key={repo.id_github} className="flex items-start gap-3 px-4 py-3">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-1.5">
                                {repo.privado ? (
                                  <Lock size={10} className="shrink-0 text-stone-400" />
                                ) : (
                                  <Unlock size={10} className="shrink-0 text-stone-300" />
                                )}
                                <p className="truncate font-mono text-[12px] font-semibold text-stone-800">
                                  {repo.nombre_completo_github}
                                </p>
                              </div>
                              {repo.descripcion && (
                                <p className="mt-0.5 line-clamp-1 text-[11px] text-stone-400">
                                  {repo.descripcion}
                                </p>
                              )}
                              <p className="mt-0.5 text-[10px] text-stone-400">
                                {repo.rama_principal} · act. {fechaRelativa(repo.actualizado_en)}
                              </p>
                            </div>
                            <div className="shrink-0">
                              {repo.vinculado_en_devmanage ? (
                                <Link
                                  to={`/github/repositorios/${repo.repositorio_devmanage_id}`}
                                  className="inline-flex items-center gap-1 rounded-md bg-emerald-50 px-2 py-1 text-[10px] font-semibold text-emerald-700 ring-1 ring-emerald-200 hover:bg-emerald-100"
                                >
                                  <CheckCircle2 size={10} />
                                  Vinculado
                                </Link>
                              ) : (
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="outline"
                                  disabled={!proyectoActivoId || vincularRepo.isPending}
                                  onClick={() => vincularRepo.mutate(repo)}
                                  className="h-7 px-2 text-[11px]"
                                >
                                  <Plus size={11} />
                                  Vincular
                                </Button>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          )}

          {/* ── Tab: Buscar por slug ─────────────────────────────────── */}
          {tabVincular === 'buscar' && (
            <div className="flex flex-col gap-4 px-5 py-5">
              <div>
                <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-widest text-stone-400">
                  Formato: propietario/nombre
                </p>
                <div className="flex gap-2">
                  <Input
                    placeholder="ej. facebook/react"
                    value={slugRepo}
                    onChange={(e) => { setSlugRepo(e.target.value); setErrorResolver(null); }}
                    disabled={!proyectoActivoId || resolverRepo.isPending}
                    className="font-mono text-[13px]"
                    onKeyDown={(e) => { if (e.key === 'Enter' && slugRepo.trim()) resolverRepo.mutate(); }}
                  />
                  <Button
                    type="button"
                    variant="secondary"
                    disabled={!proyectoActivoId || !slugRepo.trim() || resolverRepo.isPending}
                    onClick={() => resolverRepo.mutate()}
                    className="shrink-0"
                  >
                    {resolverRepo.isPending ? (
                      <LoaderCircle size={13} className="animate-spin" />
                    ) : (
                      <Search size={13} />
                    )}
                    Buscar
                  </Button>
                </div>
                <p className="mt-1.5 text-[11px] text-stone-400">
                  Los repos <strong>públicos</strong> funcionan sin conectar.{' '}
                  Los <strong>privados</strong> requieren tu cuenta GitHub conectada.
                </p>
              </div>

              {errorResolver && (
                <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-[12px] text-red-700">
                  <AlertCircle size={13} className="mt-0.5 shrink-0" />
                  {errorResolver}
                </div>
              )}

              {resuelto && (
                <div className="rounded-xl border border-stone-200 bg-stone-50 p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-mono text-[14px] font-semibold text-stone-800">
                        {resuelto.nombre_completo_github}
                      </p>
                      <p className="mt-0.5 text-[11px] text-stone-500">
                        ID {resuelto.id_github} · rama por defecto{' '}
                        <span className="font-medium text-stone-700">{resuelto.rama_principal}</span>
                      </p>
                      {resuelto.descripcion && (
                        <p className="mt-2 text-[12px] leading-relaxed text-stone-600">
                          {resuelto.descripcion}
                        </p>
                      )}
                    </div>
                    <a
                      href={resuelto.html_url}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex shrink-0 items-center gap-1 text-[11px] font-medium text-purple-600 hover:underline"
                    >
                      <ExternalLink size={11} />
                      GitHub
                    </a>
                  </div>
                  <div className="mt-3 flex items-center justify-between gap-2">
                    {errorVincular && (
                      <p className="text-[12px] text-red-600">{errorVincular}</p>
                    )}
                    <Button
                      type="button"
                      size="sm"
                      className="ml-auto"
                      disabled={vincularRepo.isPending}
                      onClick={() => vincularRepo.mutate(resuelto)}
                    >
                      {vincularRepo.isPending ? (
                        <LoaderCircle size={12} className="animate-spin" />
                      ) : (
                        <Link2 size={12} />
                      )}
                      {vincularRepo.isPending ? 'Vinculando…' : 'Vincular al proyecto'}
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Webhook info colapsable */}
          <div className="shrink-0 border-t border-stone-100">
            <button
              type="button"
              onClick={() => setWebhookAbierto((v) => !v)}
              className="flex w-full items-center justify-between px-5 py-3 text-[12px] font-medium text-stone-500 hover:bg-stone-50"
            >
              <span className="flex items-center gap-1.5">
                <RefreshCw size={12} />
                Configurar webhook en GitHub
              </span>
              <ChevronDown
                size={13}
                className={cn('transition-transform', webhookAbierto ? 'rotate-180' : '')}
              />
            </button>
            {webhookAbierto && (
              <div className="border-t border-stone-100 bg-stone-50/60 px-5 py-3 text-[12px] text-stone-500 space-y-2">
                <p>
                  <span className="font-medium text-stone-700">Payload URL:</span>{' '}
                  <code className="rounded bg-stone-100 px-1.5 py-0.5 text-[11px]">
                    {import.meta.env.VITE_API_URL ?? 'http://localhost:3000'}/github/webhook
                  </code>
                </p>
                <p>
                  <span className="font-medium text-stone-700">Eventos:</span>{' '}
                  <code className="text-[11px]">push</code>,{' '}
                  <code className="text-[11px]">pull_request</code>
                </p>
                <p>
                  Secreto: variable <code className="text-[11px]">GITHUB_WEBHOOK_SECRET</code> en el servidor.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
