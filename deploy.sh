#!/bin/bash
# Script de build y despliegue para producción
# Uso: ./deploy.sh "mensaje del commit (opcional)"

set -e

COMMIT_MSG=${1:-"build: actualización de producción"}

echo "▶ Construyendo para producción..."
npm run build:prod

echo "▶ Verificando output..."
if [ ! -d "dist/species-front-angular/browser" ]; then
  echo "✗ Error: no se generó dist/species-front-angular/browser"
  exit 1
fi

echo "▶ Preparando commit..."
git add dist/

if git diff --cached --quiet; then
  echo "ℹ Sin cambios en dist/, no se crea commit."
else
  git commit -m "$COMMIT_MSG"
  echo "▶ Pusheando a origin..."
  git push
  echo "✓ Despliegue completado."
fi
