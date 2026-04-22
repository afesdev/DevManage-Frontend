import { api } from './api';
import type { ProyectoResumen } from '../types/auth';

export interface ColumnaTablero {
  columna_id: string;
  proyecto_id: string;
  nombre: string;
  posicion: number;
  color: string | null;
  es_estado_final: boolean;
}

export interface EpicaResumen {
  epica_id: string;
  titulo: string;
  estado: string;
}

export interface CrearEpicaPayload {
  titulo: string;
  descripcion?: string;
  estado?: 'abierta' | 'en_progreso' | 'terminada' | 'cancelada';
}

export interface MiembroProyectoResumen {
  usuario_id: string;
  nombre_visible: string;
  correo: string;
  rol: string;
}

export interface EtiquetaResumen {
  etiqueta_id: string;
  proyecto_id: string;
  nombre: string;
  color: string;
}

export interface TareaEtiquetaResumen {
  tarea_id: string;
  etiqueta_id: string;
}

export interface ComentarioTareaResumen {
  comentario_id: string;
  tarea_id: string;
  autor_id: string;
  autor_nombre: string;
  contenido: string;
  creado_en: string;
  editado_en: string | null;
}

export interface TareaActividadResumen {
  actividad_id: string;
  tarea_id: string;
  actor_id: string;
  actor_nombre: string;
  tipo_accion: string;
  valor_anterior: string | null;
  valor_nuevo: string | null;
  ocurrido_en: string;
}

export interface TareaTablero {
  tarea_id: string;
  proyecto_id: string;
  epica_id: string | null;
  tarea_padre_id: string | null;
  columna_id: string;
  titulo: string;
  descripcion: string | null;
  tipo: 'tarea' | 'subtarea' | 'error';
  prioridad: 'critica' | 'alta' | 'media' | 'baja';
  posicion: number;
  responsable_id: string | null;
  creado_por: string;
  fecha_limite: string | null;
  creado_en: string;
  actualizado_en: string;
  completado_en: string | null;
}

export interface CrearTareaPayload {
  proyecto_id: string;
  columna_id: string;
  titulo: string;
  descripcion?: string;
  tipo?: 'tarea' | 'subtarea' | 'error';
  prioridad?: 'critica' | 'alta' | 'media' | 'baja';
  epica_id?: string;
  tarea_padre_id?: string;
  responsable_id?: string;
  fecha_limite?: string;
}

export interface ActualizarTareaPayload {
  titulo?: string;
  descripcion?: string;
  tipo?: 'tarea' | 'subtarea' | 'error';
  prioridad?: 'critica' | 'alta' | 'media' | 'baja';
  fecha_limite?: string;
  epica_id?: string;
  tarea_padre_id?: string;
  responsable_id?: string;
  columna_id?: string;
}

export const tableroService = {
  async obtenerProyectos(token: string): Promise<ProyectoResumen[]> {
    const response = await api.get<ProyectoResumen[]>('/tablero/proyectos', {
      headers: { Authorization: `Bearer ${token}` },
    });
    return response.data;
  },
  async obtenerColumnas(proyectoId: string, token: string): Promise<ColumnaTablero[]> {
    const response = await api.get<ColumnaTablero[]>(`/tablero/proyectos/${proyectoId}/columnas`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    return response.data;
  },
  async obtenerTareas(proyectoId: string, token: string): Promise<TareaTablero[]> {
    const response = await api.get<TareaTablero[]>(`/tablero/proyectos/${proyectoId}/tareas`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    return response.data;
  },
  async obtenerEpicas(proyectoId: string, token: string): Promise<EpicaResumen[]> {
    const response = await api.get<EpicaResumen[]>(`/tablero/proyectos/${proyectoId}/epicas`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    return response.data;
  },
  async crearEpica(
    proyectoId: string,
    payload: CrearEpicaPayload,
    token: string,
  ): Promise<EpicaResumen> {
    const response = await api.post<EpicaResumen>(
      `/tablero/proyectos/${proyectoId}/epicas`,
      payload,
      { headers: { Authorization: `Bearer ${token}` } },
    );
    return response.data;
  },
  async obtenerMiembrosProyecto(proyectoId: string, token: string): Promise<MiembroProyectoResumen[]> {
    const response = await api.get<MiembroProyectoResumen[]>(
      `/tablero/proyectos/${proyectoId}/miembros`,
      { headers: { Authorization: `Bearer ${token}` } },
    );
    return response.data;
  },
  async obtenerEtiquetas(proyectoId: string, token: string): Promise<EtiquetaResumen[]> {
    const response = await api.get<EtiquetaResumen[]>(
      `/tablero/proyectos/${proyectoId}/etiquetas`,
      { headers: { Authorization: `Bearer ${token}` } },
    );
    return response.data;
  },
  async crearEtiqueta(
    proyectoId: string,
    payload: { nombre: string; color?: string },
    token: string,
  ): Promise<EtiquetaResumen> {
    const response = await api.post<EtiquetaResumen>(
      `/tablero/proyectos/${proyectoId}/etiquetas`,
      payload,
      { headers: { Authorization: `Bearer ${token}` } },
    );
    return response.data;
  },
  async actualizarEtiqueta(
    proyectoId: string,
    etiquetaId: string,
    payload: { nombre?: string; color?: string },
    token: string,
  ): Promise<EtiquetaResumen> {
    const response = await api.patch<EtiquetaResumen>(
      `/tablero/proyectos/${proyectoId}/etiquetas/${etiquetaId}`,
      payload,
      { headers: { Authorization: `Bearer ${token}` } },
    );
    return response.data;
  },
  async eliminarEtiqueta(
    proyectoId: string,
    etiquetaId: string,
    token: string,
  ): Promise<{ mensaje: string }> {
    const response = await api.delete<{ mensaje: string }>(
      `/tablero/proyectos/${proyectoId}/etiquetas/${etiquetaId}`,
      { headers: { Authorization: `Bearer ${token}` } },
    );
    return response.data;
  },
  async obtenerEtiquetasPorTarea(
    proyectoId: string,
    token: string,
  ): Promise<TareaEtiquetaResumen[]> {
    const response = await api.get<TareaEtiquetaResumen[]>(
      `/tablero/proyectos/${proyectoId}/tareas-etiquetas`,
      { headers: { Authorization: `Bearer ${token}` } },
    );
    return response.data;
  },
  async asignarEtiquetaATarea(
    tareaId: string,
    etiquetaId: string,
    token: string,
  ): Promise<{ mensaje: string }> {
    const response = await api.post<{ mensaje: string }>(
      `/tablero/tareas/${tareaId}/etiquetas`,
      { etiqueta_id: etiquetaId },
      { headers: { Authorization: `Bearer ${token}` } },
    );
    return response.data;
  },
  async quitarEtiquetaDeTarea(
    tareaId: string,
    etiquetaId: string,
    token: string,
  ): Promise<{ mensaje: string }> {
    const response = await api.delete<{ mensaje: string }>(
      `/tablero/tareas/${tareaId}/etiquetas/${etiquetaId}`,
      { headers: { Authorization: `Bearer ${token}` } },
    );
    return response.data;
  },
  async obtenerComentariosPorTarea(
    tareaId: string,
    token: string,
  ): Promise<ComentarioTareaResumen[]> {
    const response = await api.get<ComentarioTareaResumen[]>(
      `/tablero/tareas/${tareaId}/comentarios`,
      { headers: { Authorization: `Bearer ${token}` } },
    );
    return response.data;
  },
  async crearComentarioEnTarea(
    tareaId: string,
    payload: { contenido: string },
    token: string,
  ): Promise<ComentarioTareaResumen> {
    const response = await api.post<ComentarioTareaResumen>(
      `/tablero/tareas/${tareaId}/comentarios`,
      payload,
      { headers: { Authorization: `Bearer ${token}` } },
    );
    return response.data;
  },
  async actualizarComentarioDeTarea(
    tareaId: string,
    comentarioId: string,
    payload: { contenido: string },
    token: string,
  ): Promise<ComentarioTareaResumen> {
    const response = await api.patch<ComentarioTareaResumen>(
      `/tablero/tareas/${tareaId}/comentarios/${comentarioId}`,
      payload,
      { headers: { Authorization: `Bearer ${token}` } },
    );
    return response.data;
  },
  async eliminarComentarioDeTarea(
    tareaId: string,
    comentarioId: string,
    token: string,
  ): Promise<{ mensaje: string }> {
    const response = await api.delete<{ mensaje: string }>(
      `/tablero/tareas/${tareaId}/comentarios/${comentarioId}`,
      { headers: { Authorization: `Bearer ${token}` } },
    );
    return response.data;
  },
  async obtenerActividadPorTarea(tareaId: string, token: string): Promise<TareaActividadResumen[]> {
    const response = await api.get<TareaActividadResumen[]>(`/tablero/tareas/${tareaId}/actividad`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    return response.data;
  },
  async moverTarea(
    tareaId: string,
    nuevaColumnaId: string,
    token: string,
  ): Promise<{ mensaje: string }> {
    const response = await api.patch<{ mensaje: string }>(
      `/tablero/tareas/${tareaId}/mover`,
      { nueva_columna_id: nuevaColumnaId },
      { headers: { Authorization: `Bearer ${token}` } },
    );
    return response.data;
  },
  async reordenarTarea(
    tareaId: string,
    payload: { columna_id: string; posicion: number },
    token: string,
  ): Promise<{ mensaje: string }> {
    const response = await api.patch<{ mensaje: string }>(
      `/tablero/tareas/${tareaId}/reordenar`,
      payload,
      { headers: { Authorization: `Bearer ${token}` } },
    );
    return response.data;
  },
  async crearTarea(payload: CrearTareaPayload, token: string): Promise<TareaTablero> {
    const response = await api.post<TareaTablero>('/tablero/tareas', payload, {
      headers: { Authorization: `Bearer ${token}` },
    });
    return response.data;
  },
  async actualizarTarea(
    tareaId: string,
    payload: ActualizarTareaPayload,
    token: string,
  ): Promise<TareaTablero> {
    const response = await api.patch<TareaTablero>(`/tablero/tareas/${tareaId}`, payload, {
      headers: { Authorization: `Bearer ${token}` },
    });
    return response.data;
  },
  async eliminarTarea(tareaId: string, token: string): Promise<{ mensaje: string }> {
    const response = await api.delete<{ mensaje: string }>(`/tablero/tareas/${tareaId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    return response.data;
  },
};
