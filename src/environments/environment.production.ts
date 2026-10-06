export const environment = {
  production: true,
  apiBaseUrl: 'https://species.conabio.gob.mx',
  // El reverse proxy expone auth_backend bajo /api/auth, y auth_backend monta
  // sus rutas en /auth (app.use('/auth', authRouter)) -- de ahí el doble
  // /auth. Verificado 2026-10-06: /api/auth/login -> 404, /api/auth/auth/login
  // -> respuesta real del servicio.
  authBaseUrl: 'https://species.conabio.gob.mx/api/auth/auth'
};
