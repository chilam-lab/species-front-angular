export interface AuthUser {
  userid: number;
  name: string;
  email: string;
  fecha_registro?: string;
  procedencia?: string;
}

export interface LoginPayload {
  email: string;
  password: string;
  aviso: boolean;
}

export interface RegisterPayload {
  nombre: string;
  email: string;
  procedencia: string;
  password: string;
  aviso: boolean;
}

export interface ChangePasswordPayload {
  email: string;
  oldpassword: string;
  newpassword: string;
}

export interface UpdateProfilePayload {
  name: string;
  procedencia: string;
}

/** Forma cruda de la respuesta de auth_backend: siempre trae `status` (0 = ok, 1 = error). */
export interface AuthApiResponse<T = unknown> {
  status: 0 | 1;
  message: string | { message: string }[];
  session?: T;
  sessionid?: string;
}
