# 🚀 PasaElTest - Asistente de Oposiciones con IA

Aplicación web profesional para preparar oposiciones con generación inteligente de preguntas mediante IA.

## 📋 Stack Tecnológico

- **Frontend**: React 18 + Vite
- **Styling**: Tailwind CSS
- **Backend**: Supabase (Auth + PostgreSQL + Storage)
- **IA**: Anthropic Claude API
- **Deploy**: Vercel

---

## 🛠️ Setup Completo (Paso a Paso)

### 1️⃣ CREAR PROYECTO EN SUPABASE

#### A. Crear Cuenta
1. Ve a [https://supabase.com](https://supabase.com)
2. Click en "Start your project"
3. Regístrate con GitHub o email

#### B. Crear Proyecto
1. Click "New Project"
2. Nombre: **pasaeltest** (o el que prefieras)
3. Database Password: **Guarda esta contraseña** (importante!)
4. Region: **Central EU (Frankfurt)** (más cercana a España)
5. Click "Create new project"
6. Espera 2-3 minutos mientras se crea

#### C. Obtener Credenciales
1. En el sidebar, click "Settings" → "API"
2. **Copia estos valores** (los necesitarás luego):
   - Project URL: `https://xxxxx.supabase.co`
   - `anon` `public` key: `eyJhbGciOiJIUzI1NiIsInR...`

---

### 2️⃣ CONFIGURAR BASE DE DATOS

#### A. Crear Tablas
1. En Supabase, sidebar → "SQL Editor"
2. Click "New query"
3. **Copia TODO el contenido** de `supabase-schema.sql`
4. Pégalo en el editor
5. Click "Run" (botón verde abajo derecha)
6. Deberías ver: ✅ "Success. No rows returned"

#### B. Verificar Tablas Creadas
1. Sidebar → "Table Editor"
2. Deberías ver estas tablas:
   - `users`
   - `themes`
   - `documents`
   - `questions`
   - `exam_history`
   - `public_content`

---

### 3️⃣ CONFIGURAR PROYECTO LOCAL

#### A. Instalar Node.js
- Versión requerida: **Node 18+**
- Descarga: [https://nodejs.org](https://nodejs.org)
- Verifica instalación:
  ```bash
  node --version  # Debe mostrar v18.x.x o superior
  npm --version
  ```

#### B. Clonar/Descargar Proyecto
```bash
# Si tienes Git:
cd /ruta/donde/quieras/el/proyecto
git clone [tu-repo-url]
cd pasaeltest

# O simplemente descomprime el ZIP en una carpeta
```

#### C. Instalar Dependencias
```bash
npm install
```
Esto tardará 1-2 minutos.

#### D. Configurar Variables de Entorno
1. Copia el archivo de ejemplo:
   ```bash
   cp .env.example .env
   ```

2. Abre `.env` y completa con tus valores:
   ```
   VITE_SUPABASE_URL=https://xxxxx.supabase.co
   VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR...
   VITE_ANTHROPIC_API_KEY=sk-ant-api03-...
   VITE_DEBUG_MODE=false
   ```

3. **¿Dónde consigo la API Key de Anthropic?**
   - Ve a [https://console.anthropic.com](https://console.anthropic.com)
   - Crea cuenta o inicia sesión
   - Sidebar → "API Keys"
   - Click "Create Key"
   - Copia la clave que empieza con `sk-ant-api03-...`

---

### 4️⃣ PROBAR LOCALMENTE

```bash
# Iniciar servidor de desarrollo
npm run dev
```

Deberías ver:
```
VITE v5.x.x  ready in 500 ms

➜  Local:   http://localhost:3000/
➜  Network: use --host to expose
```

Abre http://localhost:3000 en tu navegador.

**Prueba:**
1. Debería aparecer pantalla de login
2. Click "Registrarse"
3. Completa formulario y registra
4. Deberías entrar a la app ✅

**Si hay error:**
- Revisa que las credenciales en `.env` sean correctas
- Verifica que las tablas estén creadas en Supabase
- Mira la consola del navegador (F12) para ver errores

---

### 5️⃣ DEPLOY A PRODUCCIÓN (VERCEL)

#### A. Preparar Código con Git

1. Inicializar repositorio:
   ```bash
   git init
   git add .
   git commit -m "Initial commit - PasaElTest production ready"
   ```

2. Crear repositorio en GitHub:
   - Ve a [https://github.com/new](https://github.com/new)
   - Nombre: `pasaeltest`
   - Público o Privado (tu elección)
   - NO marcar "Initialize with README"
   - Click "Create repository"

3. Conectar y subir:
   ```bash
   git remote add origin https://github.com/tu-usuario/pasaeltest.git
   git branch -M main
   git push -u origin main
   ```

#### B. Deploy en Vercel

1. Crear cuenta en [https://vercel.com](https://vercel.com)
   - Usa "Continue with GitHub"

2. Import proyecto:
   - Click "New Project"
   - Selecciona el repo `pasaeltest`
   - Click "Import"

3. Configurar variables de entorno:
   - En "Environment Variables" añade:
     ```
     VITE_SUPABASE_URL = https://xxxxx.supabase.co
     VITE_SUPABASE_ANON_KEY = eyJhbGciOiJIUzI1NiIsInR...
     VITE_ANTHROPIC_API_KEY = sk-ant-api03-...
     ```
   - Click "Add" después de cada una

4. Deploy:
   - Click "Deploy"
   - Espera 1-2 minutos ⏳
   - ¡Listo! 🎉

**Tu app estará en:**
```
https://pasaeltest.vercel.app
```
(o el nombre que hayas elegido)

---

### 6️⃣ ACTUALIZACIONES AUTOMÁTICAS

Ahora, cada vez que hagas cambios:

```bash
# 1. Edita los archivos que quieras
# 2. Commit los cambios
git add .
git commit -m "Descripción de tus cambios"

# 3. Push a GitHub
git push

# 4. Vercel auto-detecta y despliega
# ⏳ Espera ~1 minuto
# ✅ ¡Cambios live!
```

**El proceso es automático:**
```
TÚ → Git push → GitHub → Vercel detecta → Build → Deploy
                         (automático en ~1min)
```

---

## 📱 Funcionalidades PWA

La app funciona como aplicación nativa:

**En móvil:**
1. Abre la app en Chrome/Safari
2. Menú → "Añadir a pantalla de inicio"
3. Ahora tienes un icono como app nativa
4. Funciona offline
5. Recibe notificaciones

---

## 🔧 Comandos Útiles

```bash
# Desarrollo local
npm run dev          # Servidor en http://localhost:3000

# Build para producción
npm run build        # Genera carpeta /dist

# Preview del build
npm run preview      # Prueba el build localmente

# Linting
npm run lint         # Revisa errores de código
```

---

## 📊 Estructura del Proyecto

```
pasaeltest/
├── public/
│   ├── manifest.json        # PWA config
│   └── icon-*.png          # Iconos de la app
├── src/
│   ├── App.jsx             # Componente principal
│   ├── main.jsx            # Entry point
│   ├── index.css           # Estilos globales
│   └── supabaseClient.js   # Configuración Supabase
├── .env.example            # Template de variables
├── .gitignore
├── index.html
├── package.json
├── vite.config.js
├── tailwind.config.js
└── supabase-schema.sql     # Schema de la BD
```

---

## 🐛 Troubleshooting

### Error: "Invalid API key"
- Verifica que `VITE_ANTHROPIC_API_KEY` en `.env` sea correcta
- Asegúrate de que empiece con `sk-ant-api03-`

### Error: "Failed to fetch"
- Verifica credenciales de Supabase
- Asegúrate de que `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY` sean correctas
- Verifica que las tablas existan en Supabase

### Build falla en Vercel
- Revisa los logs en Vercel
- Verifica que las variables de entorno estén configuradas
- Asegúrate de que no haya errores de sintaxis

### La app no guarda datos
- Verifica en Supabase → "Table Editor" → "users"
- Si ves tu usuario, la autenticación funciona
- Revisa la consola del navegador (F12) para errores

---

## 📈 Monitoreo y Analytics

### Ver usuarios en Supabase
1. Sidebar → "Authentication" → "Users"
2. Aquí ves todos los usuarios registrados

### Ver datos
1. Sidebar → "Table Editor"
2. Click en cada tabla para ver contenido

### Logs de errores
1. Sidebar → "Logs"
2. Filtra por errores

---

## 💰 Costes Esperados

### Plan Gratuito (hasta crecer)
- Vercel: **$0/mes** (100GB bandwidth)
- Supabase: **$0/mes** (500MB DB, 50k usuarios)
- Anthropic API: **~$50/mes** (depende del uso)
- **TOTAL: ~$50/mes**

### Cuando escales (1000+ usuarios)
- Vercel Pro: **$20/mes**
- Supabase Pro: **$25/mes**
- Anthropic API: **~$150/mes**
- **TOTAL: ~$195/mes**

---

## 📞 Soporte

Si tienes problemas:

1. Revisa esta documentación
2. Verifica logs en Vercel (si está deployado)
3. Verifica logs en Supabase
4. Revisa consola del navegador (F12)

---

## 🎉 ¡Listo!

Tu app está ahora en producción. Puedes compartir la URL con cualquiera y funcionará desde cualquier dispositivo.

**URL de tu app:** https://pasaeltest.vercel.app (o la tuya)

**Próximos pasos:**
- Personalizar iconos en `/public`
- Ajustar meta tags en `index.html`
- Añadir Google Analytics (opcional)
- Configurar dominio personalizado (opcional)

¡Éxito! 🚀
