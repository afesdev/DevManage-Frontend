import { api } from './api';

export interface RepositorioGithubResumen {
  repositorio_id: string;
  proyecto_id: string;
  nombre_completo_github: string;
  id_github: number;
  rama_principal: string;
  esta_activo: boolean;
  sincronizado_en: string | null;
  creado_en: string;
}

export interface RepositorioGithubPublico {
  id_github: number;
  nombre_completo_github: string;
  rama_principal: string;
  descripcion: string | null;
  html_url: string;
}

export interface RepositorioGithubUsuario extends RepositorioGithubPublico {
  privado: boolean;
  actualizado_en: string;
  vinculado_en_devmanage: boolean;
  repositorio_devmanage_id: string | null;
}

export interface RamaGithubResumen {
  rama_id: string;
  repositorio_id: string;
  nombre: string;
  sha_cabeza: string;
  esta_activa: boolean;
  ultimo_push_en: string | null;
}

export interface SolicitudIntegracionResumen {
  solicitud_id: string;
  repositorio_id: string;
  numero_github: number;
  titulo: string;
  estado: 'abierta' | 'cerrada' | 'integrada';
  rama_origen: string;
  rama_destino: string;
  usuario_github_autor: string | null;
  abierta_en: string;
  integrada_en: string | null;
  cerrada_en: string | null;
}

export interface ArchivoPullRequestGithub {
  nombre_archivo: string;
  estado: string;
  adiciones: number;
  eliminaciones: number;
  cambios: number;
  patch: string | null;
  es_binario: boolean;
}

export interface EstadoDespliegueRepositorio {
  rama_desarrollo: { nombre: string; sha: string | null; ultimo_push_en: string | null };
  rama_main_prueba: { nombre: string; sha: string | null; ultimo_push_en: string | null };
  rama_main: { nombre: string; sha: string | null; ultimo_push_en: string | null };
  prs_abiertas: { a_desarrollo: number; a_main_prueba: number; a_main: number };
}

export interface VinculoTareaGithubResumen {
  tarea_id: string;
  titulo: string;
  solicitud_numero: number | null;
  rama: string | null;
}

export interface CommitGithubResumen {
  sha: string;
  mensaje: string;
  usuario_github_autor: string | null;
  nombre_autor: string | null;
  confirmado_en: string;
  rama: string | null;
}

export interface TrazabilidadTareaEvento {
  tipo: 'rama_creada' | 'commit' | 'pr_desarrollo' | 'pr_main_prueba' | 'pr_main' | 'pr_otra';
  ocurrido_en: string;
  rama: string | null;
  sha: string | null;
  pr_numero: number | null;
  titulo: string;
  estado_pr: string | null;
  rama_destino: string | null;
}

export interface EventoProduccionResumen {
  pr_numero: number;
  titulo: string;
  rama_origen: string;
  rama_destino: string;
  merge_commit_sha: string | null;
  integrada_en: string | null;
  usuario_github_autor: string | null;
}

export interface VincularRepositorioPayload {
  proyecto_id: string;
  nombre_completo_github: string;
  id_github: number;
  rama_principal?: string;
}

export const githubService = {
  async resolverRepositorio(fullName: string, token: string): Promise<RepositorioGithubPublico> {
    const response = await api.get<RepositorioGithubPublico>('/github/repos/resolver', {
      params: { q: fullName },
      headers: { Authorization: `Bearer ${token}` },
    });
    return response.data;
  },

  async obtenerMisRepositorios(
    token: string,
    proyectoId?: string,
  ): Promise<RepositorioGithubUsuario[]> {
    const response = await api.get<RepositorioGithubUsuario[]>('/github/repos/mios', {
      params: proyectoId ? { proyecto_id: proyectoId } : undefined,
      headers: { Authorization: `Bearer ${token}` },
    });
    return response.data;
  },

  async vincularRepositorio(payload: VincularRepositorioPayload, token: string): Promise<RepositorioGithubResumen> {
    const response = await api.post<RepositorioGithubResumen>('/github/repositorios', payload, {
      headers: { Authorization: `Bearer ${token}` },
    });
    return response.data;
  },

  async obtenerRepositoriosPorProyecto(
    proyectoId: string,
    token: string,
  ): Promise<RepositorioGithubResumen[]> {
    const response = await api.get<RepositorioGithubResumen[]>(
      `/github/proyectos/${proyectoId}/repositorios`,
      { headers: { Authorization: `Bearer ${token}` } },
    );
    return response.data;
  },

  async obtenerRamas(repositorioId: string, token: string): Promise<RamaGithubResumen[]> {
    const response = await api.get<RamaGithubResumen[]>(
      `/github/repositorios/${repositorioId}/ramas`,
      { headers: { Authorization: `Bearer ${token}` } },
    );
    return response.data;
  },

  async obtenerSolicitudesIntegracion(
    repositorioId: string,
    token: string,
  ): Promise<SolicitudIntegracionResumen[]> {
    const response = await api.get<SolicitudIntegracionResumen[]>(
      `/github/repositorios/${repositorioId}/solicitudes-integracion`,
      { headers: { Authorization: `Bearer ${token}` } },
    );
    return response.data;
  },

  async sincronizarRepositorio(
    repositorioId: string,
    token: string,
  ): Promise<{ estado: string; ramas: number; prs: number }> {
    const response = await api.post<{ estado: string; ramas: number; prs: number }>(
      `/github/repositorios/${repositorioId}/sincronizar`,
      {},
      { headers: { Authorization: `Bearer ${token}` } },
    );
    return response.data;
  },

  async obtenerArchivosPullRequest(
    repositorioId: string,
    numeroPullRequest: number,
    token: string,
  ): Promise<ArchivoPullRequestGithub[]> {
    const response = await api.get<ArchivoPullRequestGithub[]>(
      `/github/repositorios/${repositorioId}/solicitudes-integracion/${numeroPullRequest}/archivos`,
      { headers: { Authorization: `Bearer ${token}` } },
    );
    return response.data;
  },

  async obtenerCommitsRepositorio(
    repositorioId: string,
    token: string,
    params?: { rama?: string; q?: string; limit?: number },
  ): Promise<CommitGithubResumen[]> {
    const response = await api.get<CommitGithubResumen[]>(
      `/github/repositorios/${repositorioId}/commits`,
      { params, headers: { Authorization: `Bearer ${token}` } },
    );
    return response.data;
  },

  async obtenerCommitsPullRequest(
    repositorioId: string,
    numeroPullRequest: number,
    token: string,
  ): Promise<CommitGithubResumen[]> {
    const response = await api.get<CommitGithubResumen[]>(
      `/github/repositorios/${repositorioId}/solicitudes-integracion/${numeroPullRequest}/commits`,
      { headers: { Authorization: `Bearer ${token}` } },
    );
    return response.data;
  },

  async obtenerEstadoDespliegue(
    repositorioId: string,
    token: string,
  ): Promise<EstadoDespliegueRepositorio> {
    const response = await api.get<EstadoDespliegueRepositorio>(
      `/github/repositorios/${repositorioId}/estado-despliegue`,
      { headers: { Authorization: `Bearer ${token}` } },
    );
    return response.data;
  },

  async obtenerVinculosTareas(
    repositorioId: string,
    token: string,
  ): Promise<VinculoTareaGithubResumen[]> {
    const response = await api.get<VinculoTareaGithubResumen[]>(
      `/github/repositorios/${repositorioId}/vinculos-tareas`,
      { headers: { Authorization: `Bearer ${token}` } },
    );
    return response.data;
  },

  async obtenerTrazabilidadTarea(
    repositorioId: string,
    tareaId: string,
    token: string,
  ): Promise<TrazabilidadTareaEvento[]> {
    const response = await api.get<TrazabilidadTareaEvento[]>(
      `/github/repositorios/${repositorioId}/tareas/${tareaId}/trazabilidad`,
      { headers: { Authorization: `Bearer ${token}` } },
    );
    return response.data;
  },

  async obtenerEventosProduccion(
    repositorioId: string,
    token: string,
  ): Promise<EventoProduccionResumen[]> {
    const response = await api.get<EventoProduccionResumen[]>(
      `/github/repositorios/${repositorioId}/eventos-produccion`,
      { headers: { Authorization: `Bearer ${token}` } },
    );
    return response.data;
  },
};
