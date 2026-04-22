import { api } from './api';
import type {
  ActualizarProyectoPayload,
  CrearProyectoPayload,
  ProyectoResumen,
} from '@/types/auth';

export const nucleoService = {
  async obtenerUsuariosActivos(
    token: string,
  ): Promise<Array<{ usuario_id: string; correo: string; nombre_visible: string }>> {
    const response = await api.get('/nucleo/usuarios', {
      headers: { Authorization: `Bearer ${token}` },
    });
    return response.data;
  },
  async crearProyecto(
    payload: CrearProyectoPayload,
    token: string,
  ): Promise<ProyectoResumen> {
    const response = await api.post<ProyectoResumen>('/nucleo/proyectos', payload, {
      headers: { Authorization: `Bearer ${token}` },
    });
    return response.data;
  },
  async actualizarProyecto(
    proyectoId: string,
    payload: ActualizarProyectoPayload,
    token: string,
  ): Promise<ProyectoResumen> {
    const response = await api.patch<ProyectoResumen>(`/nucleo/proyectos/${proyectoId}`, payload, {
      headers: { Authorization: `Bearer ${token}` },
    });
    return response.data;
  },
  async eliminarProyecto(proyectoId: string, token: string): Promise<{ mensaje: string }> {
    const response = await api.delete<{ mensaje: string }>(`/nucleo/proyectos/${proyectoId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    return response.data;
  },
  async obtenerMiembrosEquipo(
    proyectoId: string,
    token: string,
  ): Promise<
    Array<{
      equipo_id: string;
      usuario_id: string;
      nombre_visible: string;
      correo: string;
      rol: 'propietario' | 'administrador' | 'miembro';
      unido_en: string;
    }>
  > {
    const response = await api.get(`/nucleo/proyectos/${proyectoId}/equipo/miembros`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    return response.data;
  },
  async invitarMiembroEquipo(
    proyectoId: string,
    payload: { usuario_id?: string; correo?: string; rol?: 'administrador' | 'miembro' },
    token: string,
  ): Promise<{ mensaje: string }> {
    const response = await api.post(`/nucleo/proyectos/${proyectoId}/equipo/miembros`, payload, {
      headers: { Authorization: `Bearer ${token}` },
    });
    return response.data;
  },
  async actualizarMiembroEquipo(
    proyectoId: string,
    miembroUsuarioId: string,
    payload: { rol: 'administrador' | 'miembro' },
    token: string,
  ): Promise<{ mensaje: string }> {
    const response = await api.patch(
      `/nucleo/proyectos/${proyectoId}/equipo/miembros/${miembroUsuarioId}`,
      payload,
      { headers: { Authorization: `Bearer ${token}` } },
    );
    return response.data;
  },
  async removerMiembroEquipo(
    proyectoId: string,
    miembroUsuarioId: string,
    token: string,
  ): Promise<{ mensaje: string }> {
    const response = await api.delete(
      `/nucleo/proyectos/${proyectoId}/equipo/miembros/${miembroUsuarioId}`,
      { headers: { Authorization: `Bearer ${token}` } },
    );
    return response.data;
  },
  async sincronizarEquipoAProyectos(
    proyectoId: string,
    token: string,
  ): Promise<{ mensaje: string }> {
    const response = await api.patch(
      `/nucleo/proyectos/${proyectoId}/equipo/sincronizar`,
      {},
      { headers: { Authorization: `Bearer ${token}` } },
    );
    return response.data;
  },
};
