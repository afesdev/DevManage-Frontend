import { create } from 'zustand';

interface AuthState {
  token: string | null;
  proyectoActivoId: string | null;
  setToken: (token: string | null) => void;
  setProyectoActivo: (proyectoId: string | null) => void;
}

const TOKEN_KEY = 'devmanage_token';
const PROYECTO_ACTIVO_KEY = 'devmanage_proyecto_activo';

const tokenInicial = localStorage.getItem(TOKEN_KEY);
const proyectoActivoInicial = localStorage.getItem(PROYECTO_ACTIVO_KEY);

export const useAuthStore = create<AuthState>((set) => ({
  token: tokenInicial,
  proyectoActivoId: proyectoActivoInicial,
  setToken: (token) => {
    if (token) {
      localStorage.setItem(TOKEN_KEY, token);
    } else {
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(PROYECTO_ACTIVO_KEY);
    }
    set({ token, ...(token ? {} : { proyectoActivoId: null }) });
  },
  setProyectoActivo: (proyectoId) => {
    if (proyectoId) {
      localStorage.setItem(PROYECTO_ACTIVO_KEY, proyectoId);
    } else {
      localStorage.removeItem(PROYECTO_ACTIVO_KEY);
    }
    set({ proyectoActivoId: proyectoId });
  },
}));
