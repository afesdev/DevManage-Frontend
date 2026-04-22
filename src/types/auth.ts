export interface CredencialesLogin {
  correo: string;
  contrasena: string;
}

export interface CredencialesRegistro extends CredencialesLogin {
  nombre_visible: string;
}

export interface RespuestaToken {
  access_token: string;
}

export interface UsuarioPerfil {
  sub: string;
  correo: string;
  nombre_visible: string;
  /** Login de GitHub si el usuario conectó OAuth */
  usuario_github?: string | null;
  /** True si hay token de GitHub guardado (OAuth) */
  github_conectado?: boolean;
}

export interface ProyectoResumen {
  proyecto_id: string;
  equipo_id: string;
  nombre: string;
  slug: string;
  descripcion: string | null;
  estado: 'activo' | 'archivado' | 'pausado';
  rol: 'propietario' | 'lider' | 'miembro' | 'espectador';
  actualizado_en: string;
}

export interface CrearProyectoPayload {
  nombre: string;
  descripcion?: string;
}

export interface ActualizarProyectoPayload {
  nombre?: string;
  descripcion?: string;
}
