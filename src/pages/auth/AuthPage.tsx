import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { CircleUserRound, KeyRound, Mail, Sparkles } from 'lucide-react';
import { authService } from '../../services/auth.service';
import { useAuthStore } from '../../store/auth.store';
import { useToastStore } from '../../store/toast.store';
import { Button } from '../../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import { Input } from '../../components/ui/input';
import { Separator } from '../../components/ui/separator';
import type { CredencialesLogin, CredencialesRegistro } from '../../types/auth';

type Modo = 'login' | 'registro';

export function AuthPage() {
  const [modo, setModo] = useState<Modo>('login');
  const [correo, setCorreo] = useState('');
  const [nombreVisible, setNombreVisible] = useState('');
  const [contrasena, setContrasena] = useState('');
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
    onError: () => {
      pushToast({ type: 'error', message: 'No se pudo autenticar. Verifica tus datos.' });
    },
  });

  return (
    <main className="relative min-h-screen overflow-hidden bg-stone-100">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_10%_20%,rgba(83,74,183,0.16),transparent_35%),radial-gradient(circle_at_85%_15%,rgba(29,158,117,0.15),transparent_30%)]" />

      <section className="relative z-10 mx-auto flex min-h-screen w-full max-w-6xl items-center justify-center p-6">
        <div className="grid w-full overflow-hidden rounded-3xl border border-stone-200 bg-white shadow-2xl lg:grid-cols-2">
          <aside className="hidden bg-gradient-to-br from-purple-700 via-purple-600 to-indigo-600 p-8 text-white lg:block">
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

          <Card className="rounded-none border-0 shadow-none">
            <CardHeader className="p-6 sm:p-10 sm:pb-4">
              <div className="mb-2 flex items-center justify-between">
                <CardDescription className="text-xs uppercase tracking-[0.2em] text-stone-400">
                  Acceso seguro
                </CardDescription>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setModo(modo === 'login' ? 'registro' : 'login')}
                >
                  {modo === 'login' ? 'Registrarme' : 'Ya tengo cuenta'}
                </Button>
              </div>
              <CardTitle className="text-2xl text-stone-900">
                {modo === 'login' ? 'Iniciar sesión' : 'Crear cuenta'}
              </CardTitle>
            </CardHeader>

            <CardContent className="space-y-4 p-6 sm:px-10 sm:pb-10">
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
                      className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-stone-400"
                    />
                    <Input
                      value={correo}
                      onChange={(e) => setCorreo(e.target.value)}
                      type="email"
                      required
                      className="pl-9"
                      placeholder="tu@correo.com"
                    />
                  </div>
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
                      className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-stone-400"
                    />
                    <Input
                      value={contrasena}
                      onChange={(e) => setContrasena(e.target.value)}
                      type="password"
                      minLength={8}
                      required
                      className="pl-9"
                      placeholder="Minimo 8 caracteres"
                    />
                  </div>
                </label>

                <Button type="submit" disabled={mutation.isPending} className="w-full">
                  {mutation.isPending
                    ? 'Procesando...'
                    : modo === 'login'
                      ? 'Iniciar sesión'
                      : 'Crear cuenta'}
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      </section>
    </main>
  );
}
