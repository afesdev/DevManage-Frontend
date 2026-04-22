import { useCallback, useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Check,
  ChevronRight,
  CircleDot,
  FileText,
  LoaderCircle,
  Plus,
  Save,
  Search,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { EditorDocumentoBlockNote } from '@/components/documentos/EditorDocumentoBlockNote';
import { documentosService } from '@/services/documentos.service';
import { useAuthStore } from '@/store/auth.store';
import { useToastStore } from '@/store/toast.store';
import { cn } from '@/lib/utils';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function slugify(titulo: string): string {
  return titulo
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

function fechaRelativa(iso?: string | null): string {
  if (!iso) return '—';
  try {
    const diff = Date.now() - new Date(iso).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'ahora';
    if (mins < 60) return `hace ${mins}m`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `hace ${hrs}h`;
    const days = Math.floor(hrs / 24);
    if (days < 30) return `hace ${days}d`;
    return new Date(iso).toLocaleDateString('es', { day: '2-digit', month: 'short', year: 'numeric' });
  } catch {
    return iso ?? '—';
  }
}

function fechaCompleta(iso?: string | null): string {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString('es', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

// ─── Página ───────────────────────────────────────────────────────────────────

export function DocumentosPage() {
  const token = useAuthStore((s) => s.token);
  const proyectoId = useAuthStore((s) => s.proyectoActivoId);
  const pushToast = useToastStore((s) => s.pushToast);
  const queryClient = useQueryClient();

  const [seleccionId, setSeleccionId] = useState<string | null>(null);
  const [nuevaUi, setNuevaUi] = useState({ abierto: false, titulo: '', slug: '' });
  const [tituloEdicion, setTituloEdicion] = useState('');
  const [slugEdicion, setSlugEdicion] = useState('');
  const [markdownLocal, setMarkdownLocal] = useState('');
  const [markdownInicial, setMarkdownInicial] = useState('');
  const [buscarPagina, setBuscarPagina] = useState('');
  const [mensajeGuardado, setMensajeGuardado] = useState<string | null>(null);

  const listado = useQuery({
    queryKey: ['documentos-paginas', proyectoId, token],
    queryFn: () => documentosService.listarPaginas(proyectoId as string, token as string),
    enabled: Boolean(proyectoId && token),
  });

  const detalle = useQuery({
    queryKey: ['documento-pagina', seleccionId, token],
    queryFn: () => documentosService.obtenerPagina(seleccionId as string, token as string),
    enabled: Boolean(proyectoId && token && seleccionId),
  });

  const syncLocalDesdeServidor = useCallback(() => {
    const p = detalle.data;
    if (!p) return;
    setTituloEdicion(p.titulo);
    setSlugEdicion(p.slug);
    setMarkdownLocal(p.contenido_md ?? '');
    setMarkdownInicial(p.contenido_md ?? '');
  }, [detalle.data]);

  useEffect(() => {
    syncLocalDesdeServidor();
  }, [syncLocalDesdeServidor]);

  // Dirty state: detectar si hay cambios sin guardar
  const hayCambios = useMemo(() => {
    if (!detalle.data) return false;
    return (
      tituloEdicion.trim() !== detalle.data.titulo ||
      slugEdicion.trim() !== detalle.data.slug ||
      markdownLocal !== markdownInicial
    );
  }, [detalle.data, tituloEdicion, slugEdicion, markdownLocal, markdownInicial]);

  const guardar = useMutation({
    mutationFn: () =>
      documentosService.actualizarPagina(
        seleccionId as string,
        {
          titulo: tituloEdicion.trim() || undefined,
          slug: slugEdicion.trim() || undefined,
          contenido_md: markdownLocal,
        },
        token as string,
      ),
    onSuccess: () => {
      setMensajeGuardado('Guardado');
      setMarkdownInicial(markdownLocal);
      pushToast({ type: 'ok', message: 'Documento guardado correctamente.' });
      void queryClient.invalidateQueries({ queryKey: ['documentos-paginas', proyectoId, token] });
      void queryClient.invalidateQueries({ queryKey: ['documento-pagina', seleccionId, token] });
    },
    onError: () => {
      setMensajeGuardado('Error al guardar');
      pushToast({ type: 'error', message: 'No se pudo guardar el documento.' });
    },
  });

  // Auto-dismiss del mensaje de guardado
  useEffect(() => {
    if (!mensajeGuardado) return;
    const t = setTimeout(() => setMensajeGuardado(null), 2500);
    return () => clearTimeout(t);
  }, [mensajeGuardado]);

  // Atajo Ctrl/Cmd + S
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        if (seleccionId && hayCambios && !guardar.isPending) {
          e.preventDefault();
          guardar.mutate();
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [seleccionId, hayCambios, guardar]);

  const crear = useMutation({
    mutationFn: () =>
      documentosService.crearPagina(
        {
          proyecto_id: proyectoId as string,
          titulo: nuevaUi.titulo.trim(),
          slug: (nuevaUi.slug.trim() || slugify(nuevaUi.titulo)).slice(0, 200),
          contenido_md: '# ' + nuevaUi.titulo.trim() + '\n\n',
        },
        token as string,
      ),
    onSuccess: (data) => {
      setNuevaUi({ abierto: false, titulo: '', slug: '' });
      pushToast({ type: 'ok', message: 'Página creada correctamente.' });
      void queryClient.invalidateQueries({ queryKey: ['documentos-paginas', proyectoId, token] });
      setSeleccionId(data.pagina_id);
    },
    onError: () => {
      pushToast({ type: 'error', message: 'No se pudo crear la página.' });
    },
  });

  const editorKey = useMemo(() => {
    if (!detalle.data) return 'loading';
    return `${detalle.data.pagina_id}-${detalle.data.actualizado_en}`;
  }, [detalle.data]);

  const paginasFiltradas = useMemo(() => {
    const lista = listado.data ?? [];
    const q = buscarPagina.trim().toLowerCase();
    if (!q) return lista;
    return lista.filter((p) => p.titulo.toLowerCase().includes(q) || p.slug.toLowerCase().includes(q));
  }, [listado.data, buscarPagina]);

  // ── Sin proyecto ──
  if (!proyectoId) {
    return (
      <div className="flex h-full items-center justify-center p-8">
        <div className="max-w-md rounded-xl border border-amber-200 bg-amber-50 px-5 py-4 text-center">
          <FileText size={28} className="mx-auto text-amber-500" />
          <p className="mt-2 text-sm font-medium text-amber-900">Selecciona un proyecto</p>
          <p className="mt-1 text-[12px] text-amber-700">
            Elige un proyecto en la barra superior para ver y editar su documentación.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col gap-3">
      {/* ── HEADER ── */}
      <div className="shrink-0 rounded-xl border border-stone-200 bg-white px-5 py-3.5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-purple-600 shadow-sm">
              <FileText size={17} className="text-white" />
            </div>
            <div>
              <h1 className="text-[15px] font-bold text-stone-900">Documentos</h1>
              <p className="mt-0.5 text-[12px] text-stone-400">
                Wiki del proyecto — editor por bloques al estilo Notion, contenido en Markdown.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-4 text-[12px]">
            <span className="flex items-center gap-1.5">
              <FileText size={13} className="text-stone-400" />
              <span className="font-semibold text-stone-700">{listado.data?.length ?? 0}</span>
              <span className="text-stone-400">páginas</span>
            </span>
            {listado.isFetching && <LoaderCircle size={12} className="animate-spin text-purple-400" />}
          </div>
        </div>
      </div>

      {/* ── CONTENIDO ── */}
      <div className="flex min-h-0 flex-1 gap-3">
        {/* ── Lista de páginas ── */}
        <aside className="flex w-64 shrink-0 flex-col overflow-hidden rounded-xl border border-stone-200 bg-white">
          <div className="shrink-0 space-y-2 border-b border-stone-100 p-3">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[10px] font-semibold uppercase tracking-widest text-stone-400">Páginas</span>
              <Button
                type="button"
                size="sm"
                variant={nuevaUi.abierto ? 'default' : 'outline'}
                className="h-7 gap-1 px-2 text-[11px]"
                onClick={() => setNuevaUi({ abierto: !nuevaUi.abierto, titulo: '', slug: '' })}
              >
                {nuevaUi.abierto ? <X size={12} /> : <Plus size={12} />}
                {nuevaUi.abierto ? 'Cancelar' : 'Nueva'}
              </Button>
            </div>
            {/* Buscar */}
            <div className="relative">
              <Search size={11} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-stone-400" />
              <input
                type="text"
                value={buscarPagina}
                onChange={(e) => setBuscarPagina(e.target.value)}
                placeholder="Buscar página…"
                className="h-7 w-full rounded-lg border border-stone-200 bg-stone-50 pl-7 pr-3 text-[12px] outline-none transition focus:border-purple-300 focus:bg-white focus:ring-2 focus:ring-purple-200"
              />
            </div>
          </div>

          {/* Form inline para crear */}
          {nuevaUi.abierto && (
            <div className="shrink-0 space-y-1.5 border-b border-stone-100 bg-purple-50/40 p-3">
              <Input
                placeholder="Título de la página"
                value={nuevaUi.titulo}
                onChange={(e) => setNuevaUi((p) => ({ ...p, titulo: e.target.value }))}
                className="h-8 text-[12px]"
                autoFocus
              />
              <Input
                placeholder="slug-opcional"
                value={nuevaUi.slug}
                onChange={(e) => setNuevaUi((p) => ({ ...p, slug: e.target.value }))}
                className="h-8 font-mono text-[11px]"
              />
              {nuevaUi.titulo && (
                <p className="truncate px-1 text-[10px] text-stone-400">
                  URL: <span className="font-mono text-stone-500">{nuevaUi.slug.trim() || slugify(nuevaUi.titulo)}</span>
                </p>
              )}
              <Button
                type="button"
                size="sm"
                className="h-8 w-full gap-1.5 text-[12px]"
                disabled={!nuevaUi.titulo.trim() || crear.isPending}
                onClick={() => crear.mutate()}
              >
                {crear.isPending ? <LoaderCircle size={12} className="animate-spin" /> : <Plus size={12} />}
                Crear página
              </Button>
            </div>
          )}

          {/* Lista scroll */}
          <div className="min-h-0 flex-1 overflow-y-auto p-1.5">
            {listado.isLoading ? (
              <div className="flex justify-center py-6">
                <LoaderCircle className="animate-spin text-stone-300" size={18} />
              </div>
            ) : (listado.data?.length ?? 0) === 0 ? (
              <div className="flex flex-col items-center justify-center gap-2 py-10 px-3">
                <FileText size={24} className="text-stone-200" />
                <p className="text-center text-[12px] text-stone-400">Sin páginas aún.</p>
                <p className="text-center text-[11px] text-stone-400">Crea la primera para empezar.</p>
              </div>
            ) : paginasFiltradas.length === 0 ? (
              <p className="px-3 py-6 text-center text-[12px] text-stone-400">
                Ninguna página coincide con "{buscarPagina}".
              </p>
            ) : (
              paginasFiltradas.map((p) => {
                const activo = seleccionId === p.pagina_id;
                return (
                  <button
                    key={p.pagina_id}
                    type="button"
                    onClick={() => setSeleccionId(p.pagina_id)}
                    className={cn(
                      'group flex w-full items-start gap-2 rounded-lg px-2 py-1.5 text-left transition-colors',
                      activo ? 'bg-purple-50' : 'hover:bg-stone-100',
                    )}
                  >
                    <FileText
                      size={13}
                      className={cn(
                        'mt-0.5 shrink-0 transition-colors',
                        activo ? 'text-purple-600' : 'text-stone-400 group-hover:text-stone-500',
                      )}
                    />
                    <div className="min-w-0 flex-1">
                      <p
                        className={cn(
                          'truncate text-[13px] leading-tight',
                          activo ? 'font-semibold text-purple-900' : 'font-medium text-stone-700',
                        )}
                      >
                        {p.titulo}
                      </p>
                      <p className="mt-0.5 truncate text-[10px] text-stone-400">
                        {fechaRelativa(p.actualizado_en)}
                      </p>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </aside>

        {/* ── Editor ── */}
        <main className="flex min-w-0 flex-1 flex-col overflow-hidden rounded-xl border border-stone-200 bg-white">
          {!seleccionId ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-3 p-8">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-stone-50">
                <FileText size={28} className="text-stone-300" />
              </div>
              <p className="text-sm font-medium text-stone-500">Elige una página</p>
              <p className="max-w-sm text-center text-[12px] text-stone-400">
                Selecciona una página de la izquierda para ver y editar su contenido, o crea una nueva.
              </p>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="mt-1 gap-1.5"
                onClick={() => setNuevaUi({ abierto: true, titulo: '', slug: '' })}
              >
                <Plus size={13} />
                Nueva página
              </Button>
            </div>
          ) : detalle.isLoading ? (
            <div className="flex flex-1 items-center justify-center">
              <LoaderCircle className="animate-spin text-stone-300" size={22} />
            </div>
          ) : detalle.data ? (
            <>
              {/* Barra breadcrumb + estado */}
              <div className="flex shrink-0 items-center justify-between gap-3 border-b border-stone-100 bg-stone-50/50 px-5 py-2">
                <div className="flex min-w-0 items-center gap-1.5 text-[11px] text-stone-500">
                  <FileText size={11} className="shrink-0 text-stone-400" />
                  <span>Documentos</span>
                  <ChevronRight size={11} className="shrink-0 text-stone-300" />
                  <span className="truncate font-medium text-stone-700">{tituloEdicion || detalle.data.titulo}</span>
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  {/* Estado dirty / guardado */}
                  {guardar.isPending ? (
                    <span className="flex items-center gap-1 text-[11px] text-stone-500">
                      <LoaderCircle size={11} className="animate-spin" />
                      Guardando…
                    </span>
                  ) : mensajeGuardado ? (
                    <span
                      className={cn(
                        'flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium',
                        guardar.isError
                          ? 'bg-red-50 text-red-600 ring-1 ring-red-200'
                          : 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100',
                      )}
                    >
                      <Check size={11} />
                      {mensajeGuardado}
                    </span>
                  ) : hayCambios ? (
                    <span className="flex items-center gap-1 text-[11px] text-amber-600">
                      <CircleDot size={11} />
                      Sin guardar
                    </span>
                  ) : (
                    <span className="text-[11px] text-stone-400">
                      Actualizado {fechaRelativa(detalle.data.actualizado_en)}
                    </span>
                  )}
                  <Button
                    type="button"
                    size="sm"
                    disabled={guardar.isPending || !hayCambios}
                    onClick={() => guardar.mutate()}
                    className="h-7 gap-1.5 text-[12px]"
                    title="Guardar (Ctrl+S)"
                  >
                    {guardar.isPending ? <LoaderCircle size={12} className="animate-spin" /> : <Save size={12} />}
                    Guardar
                  </Button>
                </div>
              </div>

              {/* Zona de escritura: título + editor, scroll conjunto y sin bordes */}
              <div
                className="min-h-0 flex-1 overflow-y-auto"
                style={{ scrollPaddingBottom: '360px', scrollPaddingTop: '80px' }}
              >
                {/* Título como input grande estilo Notion */}
                <div className="mx-auto w-full max-w-[860px] px-6 pt-8 pb-2">
                  <input
                    type="text"
                    value={tituloEdicion}
                    onChange={(e) => setTituloEdicion(e.target.value)}
                    placeholder="Título de la página"
                    className="w-full border-none bg-transparent p-0 text-[32px] font-bold leading-tight text-stone-900 outline-none placeholder:text-stone-300"
                  />
                  <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-stone-400">
                    <div className="flex items-center gap-1">
                      <span className="text-stone-400">/</span>
                      <input
                        type="text"
                        value={slugEdicion}
                        onChange={(e) => setSlugEdicion(e.target.value)}
                        placeholder="slug"
                        className="border-none bg-transparent p-0 font-mono text-[11px] text-stone-500 outline-none placeholder:text-stone-300"
                      />
                    </div>
                    <span className="text-stone-300">·</span>
                    <span title={fechaCompleta(detalle.data.creado_en)}>
                      Creado {fechaRelativa(detalle.data.creado_en)}
                    </span>
                    <span className="text-stone-300">·</span>
                    <span title={fechaCompleta(detalle.data.actualizado_en)}>
                      Editado {fechaRelativa(detalle.data.actualizado_en)}
                    </span>
                  </div>
                </div>

                {/* Editor sin bordes, con espacio extra al final para que el menú `/` tenga aire */}
                <div className="min-h-[60vh] px-2 pb-[50vh]">
                  <EditorDocumentoBlockNote
                    key={editorKey}
                    initialMarkdown={detalle.data.contenido_md ?? ''}
                    onMarkdownChange={setMarkdownLocal}
                  />
                </div>
              </div>
            </>
          ) : null}
        </main>
      </div>
    </div>
  );
}
