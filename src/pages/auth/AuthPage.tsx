import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { isAxiosError } from 'axios';
import { useNavigate } from 'react-router-dom';
import { CircleUserRound, Eye, EyeOff, KeyRound, Loader2, Mail, Sparkles } from 'lucide-react';
import { authService } from '../../services/auth.service';
import { useAuthStore } from '../../store/auth.store';
import { useToastStore } from '../../store/toast.store';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Separator } from '../../components/ui/separator';
import type { CredencialesLogin, CredencialesRegistro } from '../../types/auth';

type Modo = 'login' | 'registro';

export function AuthPage() {
  const [modo, setModo] = useState<Modo>('login');
  const [correo, setCorreo] = useState('');
  const [nombreVisible, setNombreVisible] = useState('');
  const [contrasena, setContrasena] = useState('');
  const [mostrarContrasena, setMostrarContrasena] = useState(false);
  const setToken = useAuthStore((s) => s.setToken);
  const setProyectoActivo = useAuthStore((s) => s.setProyectoActivo);
  const pushToast = useToastStore((s) => s.pushToast);
  const navigate = useNavigate();

  const mutation = useMutation({
    mutationFn: async () => {
      if (modo === 'login') {
        const body: CredencialesLogin = { correo, contrasena };
        return authService.login(body);
      }
      const body: CredencialesRegistro = { correo, contrasena, nombre_visible: nombreVisible };
      return authService.register(body);
    },
    onSuccess: (data) => {
      setToken(data.access_token);
      setProyectoActivo(null);
      pushToast({
        type: 'ok',
        message: modo === 'login' ? 'Sesión iniciada correctamente.' : 'Cuenta creada correctamente.',
      });
      navigate('/proyectos');
    },
    onError: (error) => {
      if (isAxiosError(error) && error.response?.status === 409 && modo === 'registro') {
        pushToast({ type: 'error', message: 'Ese correo ya está registrado. Inicia sesión o usa otro correo.' });
        return;
      }
      pushToast({ type: 'error', message: 'No se pudo autenticar. Verifica tus datos.' });
    },
  });

  return (
    <main className="relative min-h-screen overflow-hidden bg-stone-100">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_10%_20%,rgba(83,74,183,0.16),transparent_35%),radial-gradient(circle_at_85%_15%,rgba(29,158,117,0.15),transparent_30%)]" />

      <section className="relative z-10 min-h-screen w-full">
        <div className="grid min-h-screen w-full bg-white md:grid-cols-2">
          <aside className="order-2 flex min-h-[44vh] flex-col justify-center bg-gradient-to-br from-purple-700 via-purple-600 to-indigo-600 p-8 text-white md:order-1 md:min-h-full md:p-10">
            <p className="text-xs uppercase tracking-[0.24em] text-white/70">DevManage</p>
            <h1 className="mt-4 text-3xl font-semibold leading-tight">
              Administra todo tu ciclo de desarrollo en una sola plataforma.
            </h1>
            <p className="mt-4 text-sm text-white/80">
              Tablero Kanban, wiki técnica y bridge con GitHub en tiempo real.
            </p>
            <div className="mt-10 space-y-3 text-sm text-white/90">
              <p className="flex items-center gap-2">
                <Sparkles size={14} /> Tareas y épicas con contexto real
              </p>
              <p className="flex items-center gap-2">
                <Sparkles size={14} /> Documentación vinculada al trabajo
              </p>
              <p className="flex items-center gap-2">
                <Sparkles size={14} /> Actividad GitHub integrada por proyecto
              </p>
            </div>
          </aside>

          <div className="order-1 flex min-h-[56vh] flex-col justify-center bg-white md:order-2 md:min-h-full">
            <div className="p-6 sm:p-10 sm:pb-4">
              <div className="mb-2 flex items-center justify-between">
                <p className="text-xs uppercase tracking-[0.2em] text-stone-400">
                  Acceso seguro
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setModo(modo === 'login' ? 'registro' : 'login')}
                >
                  {modo === 'login' ? 'Registrarme' : 'Ya tengo cuenta'}
                </Button>
              </div>
              <h2 className="text-2xl font-semibold text-stone-900">
                {modo === 'login' ? 'Iniciar sesión' : 'Crear cuenta'}
              </h2>
            </div>

            <div className="space-y-4 p-6 sm:px-10 sm:pb-10">
              <Separator />

              <form
                className="space-y-4"
                onSubmit={(e) => {
                  e.preventDefault();
                  mutation.mutate();
                }}
              >
                <label className="block text-sm font-medium text-stone-700">
                  Correo
                  <div className="relative mt-1">
                    <Mail
                      size={16}
                      className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-stone-500"
                    />
                    <Input
                      value={correo}
                      onChange={(e) => setCorreo(e.target.value)}
                      type="email"
                      required
                      autoComplete="email"
                      spellCheck={false}
                      className="h-11 border-stone-300 pl-10 text-[15px] placeholder:text-stone-400 focus-visible:border-purple-500 focus-visible:ring-[3px] focus-visible:ring-purple-200/70"
                      placeholder="tu@correo.com"
                    />
                  </div>
                  <p className="mt-1 text-xs font-normal text-stone-500">
                    Usa el correo con el que creaste tu cuenta.
                  </p>
                </label>

                {modo === 'registro' ? (
                  <label className="block text-sm font-medium text-stone-700">
                    Nombre visible
                    <div className="relative mt-1">
                      <CircleUserRound
                        size={16}
                        className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-stone-400"
                      />
                      <Input
                        value={nombreVisible}
                        onChange={(e) => setNombreVisible(e.target.value)}
                        minLength={3}
                        required
                        className="pl-9"
                        placeholder="Tu nombre en el sistema"
                      />
                    </div>
                  </label>
                ) : null}

                <label className="block text-sm font-medium text-stone-700">
                  Contraseña
                  <div className="relative mt-1">
                    <KeyRound
                      size={16}
                      className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-stone-500"
                    />
                    <Input
                      value={contrasena}
                      onChange={(e) => setContrasena(e.target.value)}
                      type={mostrarContrasena ? 'text' : 'password'}
                      minLength={8}
                      required
                      autoComplete={modo === 'login' ? 'current-password' : 'new-password'}
                      className="h-11 border-stone-300 pl-10 pr-12 text-[15px] placeholder:text-stone-400 focus-visible:border-purple-500 focus-visible:ring-[3px] focus-visible:ring-purple-200/70"
                      placeholder="Minimo 8 caracteres"
                    />
                    <button
                      type="button"
                      onClick={() => setMostrarContrasena((valor) => !valor)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-500 transition-colors hover:text-stone-700"
                      aria-label={mostrarContrasena ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                    >
                      {mostrarContrasena ? <EyeOff size={17} /> : <Eye size={17} />}
                    </button>
                  </div>
                  <p className="mt-1 text-xs font-normal text-stone-500">
                    Debe tener al menos 8 caracteres.
                  </p>
                </label>

                <Button
                  type="submit"
                  disabled={mutation.isPending}
                  className="h-11 w-full bg-gradient-to-r from-purple-600 to-indigo-600 text-sm font-semibold text-white shadow-lg shadow-indigo-200 transition-all duration-200 hover:from-purple-700 hover:to-indigo-700 hover:shadow-indigo-300 disabled:cursor-not-allowed disabled:opacity-90"
                >
                  {mutation.isPending ? (
                    <span className="inline-flex items-center gap-2">
                      <Loader2 size={16} className="animate-spin" />
                      Procesando...
                    </span>
                  ) : modo === 'login' ? (
                    'Iniciar sesión'
                  ) : (
                    'Crear cuenta'
                  )}
                </Button>
              </form>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
