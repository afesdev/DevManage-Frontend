import { useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronsUpDown,
  Code2,
  FolderKanban,
  GitBranch,
  LayoutDashboard,
  LogOut,
  Menu,
  NotebookText,
  SquareKanban,
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { authService } from '@/services/auth.service';
import { githubService } from '@/services/github.service';
import { tableroService } from '@/services/tablero.service';
import { useAuthStore } from '@/store/auth.store';
import { Button } from '@/components/ui/button';
import {
  DropdownMenuCheckboxItem,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { cn } from '@/lib/utils';

const navItems = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/tablero', label: 'Tablero', icon: SquareKanban },
  { to: '/proyectos', label: 'Proyectos', icon: FolderKanban },
  { to: '/documentos', label: 'Documentos', icon: NotebookText },
  { to: '/github', label: 'GitHub', icon: GitBranch },
];

function getInitials(name?: string) {
  if (!name) return 'U';
  return name
    .split(' ')
    .slice(0, 2)
    .map((n) => n[0])
    .join('')
    .toUpperCase();
}

export function AppLayout() {
  const [sidebarExpandido, setSidebarExpandido] = useState(true);
  const [githubMenuAbierto, setGithubMenuAbierto] = useState(true);
  const token = useAuthStore((s) => s.token);
  const proyectoActivoId = useAuthStore((s) => s.proyectoActivoId);
  const setToken = useAuthStore((s) => s.setToken);
  const setProyectoActivo = useAuthStore((s) => s.setProyectoActivo);
  const navigate = useNavigate();
  const location = useLocation();

  const perfil = useQuery({
    queryKey: ['perfil-layout', token],
    queryFn: () => authService.me(token as string),
    enabled: Boolean(token),
  });

  const proyectos = useQuery({
    queryKey: ['layout-proyectos', token],
    queryFn: () => tableroService.obtenerProyectos(token as string),
    enabled: Boolean(token),
  });

  const reposGithub = useQuery({
    queryKey: ['layout-github-repos', proyectoActivoId, token],
    queryFn: () =>
      githubService.obtenerRepositoriosPorProyecto(proyectoActivoId as string, token as string),
    enabled: Boolean(proyectoActivoId && token),
  });

  const proyectoActivo = (proyectos.data ?? []).find(
    (proyecto) => proyecto.proyecto_id === proyectoActivoId,
  );

  function cerrarSesion() {
    setToken(null);
    navigate('/auth');
  }

  const NavContent = ({ compacto = false }: { compacto?: boolean }) => (
    <nav className="flex-1 space-y-0.5 overflow-y-auto px-3">
      {navItems.map((item) => {
        const Icon = item.icon;
        const to =
          item.to === '/tablero'
            ? proyectoActivoId
              ? `/tablero/${proyectoActivoId}`
              : '/proyectos'
            : item.to;

        if (item.to === '/github' && !compacto) {
          const githubActivo = location.pathname.startsWith('/github');
          return (
            <div key={item.to}>
              <div className="flex items-center gap-1">
                <NavLink
                  to={to}
                  className={cn(
                    'group flex min-w-0 flex-1 items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-150',
                    githubActivo
                      ? 'bg-purple-50 text-purple-700'
                      : 'text-stone-600 hover:bg-stone-100 hover:text-stone-900',
                  )}
                >
                  <Icon
                    size={16}
                    className={cn(
                      'shrink-0',
                      githubActivo
                        ? 'text-purple-600'
                        : 'text-stone-400 group-hover:text-stone-600',
                    )}
                  />
                  <span>{item.label}</span>
                </NavLink>
                <button
                  type="button"
                  onClick={() => setGithubMenuAbierto((v) => !v)}
                  className="rounded-md p-1.5 text-stone-400 transition hover:bg-stone-100 hover:text-stone-600"
                >
                  <ChevronDown
                    size={12}
                    className={cn('transition-transform duration-200', githubMenuAbierto ? 'rotate-0' : '-rotate-90')}
                  />
                </button>
              </div>
              {githubMenuAbierto && (
                <div className="relative ml-6 mt-0.5 space-y-0.5 pb-1">
                  {/* vertical tree line */}
                  <span className="absolute left-0 top-0 h-full w-px bg-stone-200" />
                  {(reposGithub.data ?? []).slice(0, 12).map((repo) => {
                    const activoRepo = location.pathname === `/github/repositorios/${repo.repositorio_id}`;
                    return (
                      <NavLink
                        key={repo.repositorio_id}
                        to={`/github/repositorios/${repo.repositorio_id}`}
                        className={cn(
                          'relative ml-3 flex items-center truncate rounded-md px-2 py-1.5 text-[11.5px] font-medium transition-colors',
                          activoRepo
                            ? 'bg-purple-50 text-purple-700'
                            : 'text-stone-500 hover:bg-stone-100 hover:text-stone-800',
                        )}
                        title={repo.nombre_completo_github}
                      >
                        {activoRepo && (
                          <span className="absolute -left-3 top-1/2 h-px w-3 bg-purple-300" />
                        )}
                        <span className="truncate">{repo.nombre_completo_github}</span>
                      </NavLink>
                    );
                  })}
                  {(reposGithub.data?.length ?? 0) === 0 && (
                    <p className="ml-3 px-2 py-1 text-[11px] text-stone-400 italic">Sin repos vinculados</p>
                  )}
                </div>
              )}
            </div>
          );
        }

        return (
          <NavLink
            key={item.to}
            to={to}
            title={compacto ? item.label : undefined}
            className={({ isActive }) =>
              cn(
                'group flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-150',
                isActive
                  ? 'bg-purple-50 text-purple-700'
                  : 'text-stone-600 hover:bg-stone-100 hover:text-stone-900',
                compacto && 'justify-center px-0',
              )
            }
          >
            {({ isActive }) => (
              <>
                <Icon
                  size={16}
                  className={cn(
                    'shrink-0',
                    isActive ? 'text-purple-600' : 'text-stone-400 group-hover:text-stone-600',
                  )}
                />
                {!compacto && <span>{item.label}</span>}
              </>
            )}
          </NavLink>
        );
      })}
    </nav>
  );

  const UserSection = ({ compacto = false }: { compacto?: boolean }) => {
    const nombre = perfil.data?.nombre_visible;
    const email = perfil.data?.correo;
    const initials = getInitials(nombre);

    return (
      <div className={cn('px-3', compacto && 'flex justify-center px-2')}>
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <button
                title={compacto ? (nombre ?? 'Usuario') : undefined}
                className={cn(
                  'flex w-full cursor-pointer items-center gap-2.5 rounded-lg p-2 text-left transition hover:bg-stone-100',
                  compacto && 'w-auto justify-center',
                )}
              />
            }
          >
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-purple-600 text-[11px] font-bold text-white shadow-sm">
              {initials}
            </span>
            {!compacto && (
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13px] font-semibold text-stone-800">
                  {nombre ?? 'Usuario'}
                </span>
                {email && (
                  <span className="block truncate text-[11px] text-stone-400">{email}</span>
                )}
              </span>
            )}
          </DropdownMenuTrigger>
          <DropdownMenuContent align={compacto ? 'center' : 'end'} side="top" className="w-48">
            <DropdownMenuItem onClick={() => navigate('/dashboard')}>
              <LayoutDashboard size={14} />
              Dashboard
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem variant="destructive" onClick={cerrarSesion}>
              <LogOut size={14} />
              Cerrar sesión
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    );
  };

  return (
    <main className="h-screen overflow-hidden bg-stone-100 text-stone-900">
      <div className="flex h-full">
        {/* Desktop sidebar */}
        <aside
          className={cn(
            'relative hidden flex-col border-r border-stone-200 bg-white transition-all duration-300 ease-in-out md:flex',
            sidebarExpandido ? 'w-[220px]' : 'w-[56px]',
          )}
        >
          {/* Logo */}
          <div
            className={cn(
              'flex h-14 shrink-0 items-center gap-2.5 border-b border-stone-100',
              sidebarExpandido ? 'px-4' : 'justify-center px-0',
            )}
          >
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-purple-600 shadow-sm">
              <Code2 size={14} className="text-white" />
            </div>
            {sidebarExpandido && (
              <span className="text-[15px] font-bold tracking-tight text-stone-900">
                DevManage
              </span>
            )}
          </div>

          {/* Nav */}
          <div className="flex flex-1 flex-col overflow-hidden py-3">
            <NavContent compacto={!sidebarExpandido} />
          </div>

          {/* User */}
          <div className="shrink-0 border-t border-stone-100 py-3">
            <UserSection compacto={!sidebarExpandido} />
          </div>

          {/* Floating toggle on the divider line */}
          <button
            onClick={() => setSidebarExpandido((prev) => !prev)}
            title={sidebarExpandido ? 'Contraer' : 'Expandir'}
            className="absolute -right-3 top-1/2 z-20 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-full border border-stone-200 bg-white text-stone-400 shadow-sm transition hover:border-purple-300 hover:text-purple-600"
          >
            <ChevronLeft
              size={13}
              className={cn('transition-transform duration-300', !sidebarExpandido && 'rotate-180')}
            />
          </button>
        </aside>

        <section className="flex min-w-0 min-h-0 flex-1 flex-col overflow-hidden">
          {/* Header */}
          <header className="flex h-14 shrink-0 items-center border-b border-stone-200 bg-white px-4 md:px-5">
            <div className="flex w-full items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                {/* Mobile menu */}
                <Sheet>
                  <SheetTrigger render={<Button variant="outline" size="icon" className="md:hidden" />}>
                    <Menu size={16} />
                  </SheetTrigger>
                  <SheetContent side="left" className="w-64 p-0">
                    <SheetHeader className="h-14 justify-center border-b border-stone-100 px-4">
                      <div className="flex items-center gap-2">
                        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-purple-600">
                          <Code2 size={14} className="text-white" />
                        </div>
                        <SheetTitle className="text-[15px] font-semibold tracking-tight text-stone-800">
                          DevManage
                        </SheetTitle>
                      </div>
                    </SheetHeader>
                    <div className="py-4">
                      <NavContent />
                    </div>
                  </SheetContent>
                </Sheet>

                {/* Page title */}
                <span className="hidden text-[14px] font-semibold text-stone-800 md:block">
                  {navItems.find((n) => location.pathname.startsWith(n.to))?.label ?? 'DevManage'}
                </span>

                {/* Divider */}
                <span className="hidden h-4 w-px bg-stone-200 md:block" />

                {/* Project selector */}
                <DropdownMenu>
                  <DropdownMenuTrigger
                    render={
                      <button className="hidden sm:flex items-center gap-1.5 rounded-md border border-stone-200 bg-stone-50 px-2.5 py-1.5 text-[12px] font-medium text-stone-600 transition hover:border-stone-300 hover:bg-stone-100">
                        <FolderKanban size={13} className="shrink-0 text-purple-500" />
                        <span className="max-w-36 truncate">
                          {proyectoActivo?.nombre ?? 'Sin proyecto'}
                        </span>
                        <ChevronsUpDown size={11} className="shrink-0 text-stone-400" />
                      </button>
                    }
                  />
                  <DropdownMenuContent align="start" className="w-72">
                    <DropdownMenuGroup>
                      <DropdownMenuLabel>Proyecto activo</DropdownMenuLabel>
                      <DropdownMenuSeparator />
                      {(proyectos.data ?? []).map((proyecto) => (
                        <DropdownMenuCheckboxItem
                          key={proyecto.proyecto_id}
                          checked={proyecto.proyecto_id === proyectoActivoId}
                          onCheckedChange={() => {
                            setProyectoActivo(proyecto.proyecto_id);
                            navigate(`/tablero/${proyecto.proyecto_id}`);
                          }}
                        >
                          <span className="mr-1 inline-flex w-4 justify-center">
                            {proyecto.proyecto_id === proyectoActivoId ? (
                              <Check size={13} />
                            ) : null}
                          </span>
                          <span className="truncate">{proyecto.nombre}</span>
                        </DropdownMenuCheckboxItem>
                      ))}
                      {(proyectos.data?.length ?? 0) === 0 ? (
                        <DropdownMenuItem disabled>No tienes proyectos</DropdownMenuItem>
                      ) : null}
                    </DropdownMenuGroup>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => navigate('/proyectos')}>
                      Administrar proyectos
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>

              {/* Right: user */}
              <div className="flex items-center gap-2.5">
                {!perfil.isLoading && (
                  <span className="hidden text-[13px] text-stone-500 sm:block">
                    {perfil.data?.nombre_visible ?? 'usuario'}
                  </span>
                )}
                <DropdownMenu>
                  <DropdownMenuTrigger
                    render={
                      <button className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-purple-600 text-[11px] font-bold text-white transition hover:bg-purple-700" />
                    }
                  >
                    {getInitials(perfil.data?.nombre_visible)}
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-44">
                    <DropdownMenuItem onClick={() => navigate('/dashboard')}>
                      <LayoutDashboard size={14} />
                      Dashboard
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem variant="destructive" onClick={cerrarSesion}>
                      <LogOut size={14} />
                      Cerrar sesión
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          </header>

          <div className="flex-1 min-h-0 overflow-auto p-4 md:p-6">
            <Outlet />
          </div>
        </section>
      </div>
    </main>
  );
}
