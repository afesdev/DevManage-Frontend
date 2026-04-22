import { api } from './api';
import type {
  CredencialesLogin,
  CredencialesRegistro,
  RespuestaToken,
  UsuarioPerfil,
} from '../types/auth';

export const authService = {
  async login(data: CredencialesLogin): Promise<RespuestaToken> {
    const response = await api.post<RespuestaToken>('/auth/login', data);
    return response.data;
  },
  async register(data: CredencialesRegistro): Promise<RespuestaToken> {
    const response = await api.post<RespuestaToken>('/auth/register', data);
    return response.data;
  },
  async me(token: string): Promise<UsuarioPerfil> {
    const response = await api.get<UsuarioPerfil>('/auth/me', {
      headers: { Authorization: `Bearer ${token}` },
    });
    return response.data;
  },

  async urlAutorizacionGithub(token: string): Promise<{ url: string }> {
    const response = await api.get<{ url: string }>('/auth/github/authorize', {
      headers: { Authorization: `Bearer ${token}` },
    });
    return response.data;
  },

  async desconectarGithub(token: string): Promise<void> {
    await api.delete('/auth/github', {
      headers: { Authorization: `Bearer ${token}` },
    });
  },
};
