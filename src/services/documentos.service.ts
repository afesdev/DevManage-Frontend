import { api } from './api';

export interface PaginaDocumentoResumen {
  pagina_id: string;
  proyecto_id: string;
  pagina_padre_id: string | null;
  titulo: string;
  slug: string;
  posicion: number;
  actualizado_en: string;
}

export interface PaginaDocumentoDetalle extends PaginaDocumentoResumen {
  contenido_md: string | null;
  creado_por: string;
  editado_por: string;
  creado_en: string;
}

export interface CrearPaginaPayload {
  proyecto_id: string;
  pagina_padre_id?: string;
  titulo: string;
  slug: string;
  contenido_md?: string;
}

export interface ActualizarPaginaPayload {
  titulo?: string;
  slug?: string;
  contenido_md?: string;
}

export const documentosService = {
  async listarPaginas(proyectoId: string, token: string): Promise<PaginaDocumentoResumen[]> {
    const res = await api.get<PaginaDocumentoResumen[]>(
      `/documentos/proyectos/${proyectoId}/paginas`,
      { headers: { Authorization: `Bearer ${token}` } },
    );
    return res.data;
  },

  async obtenerPagina(paginaId: string, token: string): Promise<PaginaDocumentoDetalle> {
    const res = await api.get<PaginaDocumentoDetalle>(`/documentos/paginas/${paginaId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    return res.data;
  },

  async crearPagina(payload: CrearPaginaPayload, token: string): Promise<PaginaDocumentoDetalle> {
    const res = await api.post<PaginaDocumentoDetalle>('/documentos/paginas', payload, {
      headers: { Authorization: `Bearer ${token}` },
    });
    return res.data;
  },

  async actualizarPagina(
    paginaId: string,
    payload: ActualizarPaginaPayload,
    token: string,
  ): Promise<PaginaDocumentoDetalle> {
    const res = await api.patch<PaginaDocumentoDetalle>(`/documentos/paginas/${paginaId}`, payload, {
      headers: { Authorization: `Bearer ${token}` },
    });
    return res.data;
  },

  async vincularConTarea(paginaId: string, tareaId: string, token: string): Promise<{ mensaje: string }> {
    const res = await api.post<{ mensaje: string }>(
      `/documentos/paginas/${paginaId}/vinculos-tareas`,
      { tarea_id: tareaId },
      { headers: { Authorization: `Bearer ${token}` } },
    );
    return res.data;
  },
};
