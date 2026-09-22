import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, catchError, map, of, tap, throwError } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  AuthApiResponse,
  AuthUser,
  ChangePasswordPayload,
  LoginPayload,
  RegisterPayload,
  UpdateProfilePayload,
} from './auth.models';

const SESSION_ID_KEY = 'species_sessionid';
const USER_KEY = 'species_user';

/**
 * auth_backend no usa JWT: login crea una sesión de servidor (express-session
 * + Postgres) y regresa su `sessionid` como si fuera un token manual. No hay
 * cookie automática cross-origin (CORS sin `credentials: true`), así que el
 * sessionid viaja explícito en el body de cada llamada que lo necesite
 * (isAuth, closeSesion). Ver auth_backend/app/code/src/controllers/auth.js.
 */
@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly baseUrl = environment.authBaseUrl;

  private readonly currentUserSubject = new BehaviorSubject<AuthUser | null>(this.readStoredUser());
  readonly currentUser$ = this.currentUserSubject.asObservable();

  constructor(private http: HttpClient) {
    // Restauración optimista desde localStorage al arrancar la app; se
    // confirma en segundo plano contra el backend por si la sesión ya expiró.
    if (this.currentUserSubject.value) {
      this.checkSession().subscribe();
    }
  }

  get isLoggedIn(): boolean {
    return this.currentUserSubject.value !== null;
  }

  get currentUser(): AuthUser | null {
    return this.currentUserSubject.value;
  }

  /** Sessionid guardado tras el login, o null si no hay sesión activa. Lo
   *  necesitan otros servicios (ej. analysis-history, mis-datos) para
   *  autenticarse contra middleware_datasources. */
  get sessionIdOrNull(): string | null {
    return localStorage.getItem(SESSION_ID_KEY);
  }

  login(payload: LoginPayload): Observable<AuthUser> {
    const body = {
      ...payload,
      // Requerido por auth_backend (login falla sin esto); apuntamos a su
      // propio endpoint stub /auth/myCallback ya que no necesitamos mirroring
      // de sesión del lado servidor para la v2.
      callback: `${this.baseUrl}/myCallback`,
    };

    return this.http.post<AuthApiResponse<{ user: AuthUser }>>(`${this.baseUrl}/login`, body).pipe(
      map((res) => this.assertOk(res)),
      tap((res) => this.persistSession(res.sessionid!, res.session!.user)),
      map((res) => res.session!.user),
      catchError((err) => throwError(() => this.toErrorMessage(err)))
    );
  }

  register(payload: RegisterPayload): Observable<void> {
    return this.http.post<AuthApiResponse>(`${this.baseUrl}/register`, payload).pipe(
      map((res) => { this.assertOk(res); }),
      catchError((err) => throwError(() => this.toErrorMessage(err)))
    );
  }

  /** Valida el sessionid guardado contra el backend; limpia el estado local si ya no es válido. */
  checkSession(): Observable<boolean> {
    const sessionid = this.sessionIdOrNull;
    if (!sessionid) {
      this.clearSession();
      return of(false);
    }

    return this.http.post<AuthApiResponse>(`${this.baseUrl}/isAuth`, { sessionid }).pipe(
      map((res) => res.status === 0),
      tap((valid) => { if (!valid) this.clearSession(); }),
      catchError(() => {
        this.clearSession();
        return of(false);
      })
    );
  }

  /** Edita nombre/procedencia del usuario autenticado. Email no es editable
   *  (es la clave de búsqueda en auth_backend). Actualiza el usuario en
   *  memoria y en localStorage con la respuesta del backend. */
  updateProfile(payload: UpdateProfilePayload): Observable<AuthUser> {
    const body = { ...payload, sessionid: this.sessionIdOrNull };

    return this.http.put<AuthApiResponse<{ user: AuthUser }> & { user?: AuthUser }>(`${this.baseUrl}/updateProfile`, body).pipe(
      map((res) => this.assertOk(res)),
      map((res) => (res as any).user as AuthUser),
      tap((user) => {
        localStorage.setItem(USER_KEY, JSON.stringify(user));
        this.currentUserSubject.next(user);
      }),
      catchError((err) => throwError(() => this.toErrorMessage(err)))
    );
  }

  changePassword(payload: ChangePasswordPayload): Observable<void> {
    return this.http.post<AuthApiResponse>(`${this.baseUrl}/changePassword`, payload).pipe(
      map((res) => { this.assertOk(res); }),
      catchError((err) => throwError(() => this.toErrorMessage(err)))
    );
  }

  recoverPassword(email: string): Observable<void> {
    const baseurl = window.location.origin;
    return this.http.post<AuthApiResponse>(`${this.baseUrl}/recoverPassword`, { email, baseurl }).pipe(
      map((res) => { this.assertOk(res); }),
      catchError((err) => throwError(() => this.toErrorMessage(err)))
    );
  }

  logout(): Observable<void> {
    const sessionid = this.sessionIdOrNull;
    this.clearSession();
    if (!sessionid) return of(void 0);

    return this.http.post<AuthApiResponse>(`${this.baseUrl}/closeSesion`, { sessionid }).pipe(
      map(() => void 0),
      catchError(() => of(void 0)) // logout siempre limpia el estado local aunque el backend falle
    );
  }

  private persistSession(sessionid: string, user: AuthUser): void {
    localStorage.setItem(SESSION_ID_KEY, sessionid);
    localStorage.setItem(USER_KEY, JSON.stringify(user));
    this.currentUserSubject.next(user);
  }

  private clearSession(): void {
    localStorage.removeItem(SESSION_ID_KEY);
    localStorage.removeItem(USER_KEY);
    this.currentUserSubject.next(null);
  }

  private readStoredUser(): AuthUser | null {
    try {
      const raw = localStorage.getItem(USER_KEY);
      return raw ? (JSON.parse(raw) as AuthUser) : null;
    } catch {
      return null;
    }
  }

  /** auth_backend responde 200 en muchos casos de error (status:1 en vez de 4xx); normaliza aquí. */
  private assertOk<T>(res: AuthApiResponse<T>): AuthApiResponse<T> {
    if (res.status !== 0) {
      throw res;
    }
    return res;
  }

  private toErrorMessage(err: unknown): string {
    const body = (err as { error?: AuthApiResponse })?.error ?? (err as AuthApiResponse);
    const msg = body?.message;
    if (Array.isArray(msg)) return msg.map((m) => m.message).join(', ');
    if (typeof msg === 'string') return msg;
    return 'Error de autenticación. Intenta de nuevo.';
  }
}
