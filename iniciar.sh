#!/bin/bash

echo "============================================"
echo "  PASAELTEST - Iniciando aplicación"
echo "============================================"
echo ""

# Verificar si Node.js está instalado
if ! command -v node &> /dev/null; then
    echo "❌ ERROR: Node.js no está instalado"
    echo "Descarga Node.js de: https://nodejs.org"
    exit 1
fi

# Verificar si existe node_modules
if [ ! -d "node_modules" ]; then
    echo "📦 Instalando dependencias por primera vez..."
    echo "Esto puede tardar 2-3 minutos..."
    echo ""
    npm install
    if [ $? -ne 0 ]; then
        echo ""
        echo "❌ ERROR: Falló la instalación de dependencias"
        exit 1
    fi
fi

# Verificar si existe .env
if [ ! -f ".env" ]; then
    echo ""
    echo "❌ ERROR: No se encuentra el archivo .env"
    echo ""
    echo "Por favor:"
    echo "1. Copia .env.example a .env"
    echo "2. Edita .env y pega tus credenciales"
    echo ""
    exit 1
fi

echo ""
echo "🚀 Iniciando servidor de desarrollo..."
echo ""
echo "La aplicación se abrirá en: http://localhost:3000"
echo ""
echo "Para DETENER el servidor presiona: Ctrl+C"
echo "============================================"
echo ""

npm run dev
