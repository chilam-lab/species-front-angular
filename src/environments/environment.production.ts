export const environment = {
  production: true,
  apiBaseUrl: 'https://species.conabio.gob.mx',
  // Mismo patrón que usa la v1 (species-front): el reverse proxy expone el
  // microservicio de auth_backend bajo /api/auth. Confirmar con infra al
  // desplegar la v2 si el path cambia.
  authBaseUrl: 'https://species.conabio.gob.mx/api/auth'
};
