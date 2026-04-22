import axios from 'axios';
import { useAuthStore } from '@/store/auth.store';

const baseURL = import.meta.env.VITE_API_URL ?? 'http://localhost:3000';

export const api = axios.create({
  baseURL,
  headers: {
    'Content-Type': 'application/json',
  },
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error?.response?.status;
    const requestUrl = String(error?.config?.url ?? '');
    const esValidacionSesion = requestUrl.includes('/auth/me');

    if (status === 401 && esValidacionSesion) {
      useAuthStore.getState().setToken(null);
      if (window.location.pathname !== '/auth') {
        window.location.href = '/auth';
      }
    }
    return Promise.reject(error);
  },
);
