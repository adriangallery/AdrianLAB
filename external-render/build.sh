#!/bin/bash
# Script de build para Railway
# Elimina el package-lock.json del proyecto raíz si existe
# y usa npm install en lugar de npm ci

if [ -f "../package-lock.json" ]; then
  echo "⚠️  Eliminando package-lock.json del proyecto raíz para evitar conflictos"
  rm -f ../package-lock.json
fi

echo "📦 Instalando dependencias con npm install..."
npm install

echo "✅ Build completado"

