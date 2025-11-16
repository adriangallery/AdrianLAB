#!/bin/bash
# Script de build para Railway
# Elimina el package-lock.json del proyecto raíz si existe
# y usa npm install en lugar de npm ci

set -e

echo "🔍 Buscando package-lock.json del proyecto raíz..."

# Buscar en el directorio padre y eliminar si existe
if [ -f "../package-lock.json" ]; then
  echo "⚠️  Eliminando package-lock.json del proyecto raíz para evitar conflictos"
  rm -f ../package-lock.json
fi

# También buscar en el directorio actual por si Railway lo copió aquí
if [ -f "package-lock.json" ] && [ ! -f "package.json" ]; then
  echo "⚠️  Eliminando package-lock.json huérfano"
  rm -f package-lock.json
fi

echo "📦 Instalando dependencias con npm install..."
npm install --no-package-lock=false

echo "✅ Build completado"

