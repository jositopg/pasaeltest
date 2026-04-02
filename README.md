# PasaElTest

App de estudio con preguntas tipo test generadas por IA. Crea planes de estudio, sube tus apuntes y practica hasta aprobar.

---

## Características

- **Generación de preguntas con IA** — sube PDFs, pega texto o añade URLs y Gemini crea preguntas de test automáticamente
- **Repaso inteligente (SRS)** — algoritmo de repetición espaciada que prioriza lo que más fallas
- **Modo examen** — tests configurables con o sin penalización por respuesta incorrecta
- **Múltiples planes** — cada usuario puede tener N planes de estudio independientes
- **Modo academia** — las academias crean planes y los comparten con sus alumnos mediante un enlace
- **Import masivo** — importa preguntas desde Excel o PDF
- **PWA** — funciona como app nativa en móvil (iOS y Android)
- **Dark mode** — por defecto oscuro

## Stack

| Capa | Tecnología |
|------|-----------|
| Frontend | React 18 + Vite |
| Estilos | Tailwind CSS |
| Backend | Supabase (auth + PostgreSQL + RLS) |
| IA | Gemini 2.5 Flash vía Vercel serverless |
| Deploy | Vercel |
| PWA | Vite PWA + Workbox |

---

## Setup local

### 1. Clonar y dependencias

```bash
git clone https://github.com/jositopg/pasaeltest.git
cd pasaeltest
npm install
```

### 2. Configurar variables de entorno

```bash
cp .env.example .env
```

Edita `.env` con tus credenciales:

```
VITE_SUPABASE_URL=https://tu-proyecto.supabase.co
VITE_SUPABASE_ANON_KEY=tu-clave-anon-publica
GEMINI_API_KEY=tu-clave-gemini
SUPABASE_SERVICE_ROLE_KEY=tu-service-role-key   # solo para APIs serverless
```

### 3. Crear la base de datos

En Supabase → SQL Editor, ejecuta el contenido de `supabase-schema.sql`.

### 4. Arrancar

```bash
npm run dev
```

Abre [http://localhost:3000](http://localhost:3000).

---

## Deploy en Vercel

1. Conecta el repo en [vercel.com](https://vercel.com)
2. Añade las variables de entorno (las mismas del `.env` más `GEMINI_API_KEY`)
3. Vercel despliega automáticamente en cada push a `main`

Las funciones serverless en `/api` se despliegan como Vercel Functions.

---

## Estructura

```
src/
├── components/
│   ├── academy/        AcademyStudentsScreen
│   ├── admin/          AdminScreen (super_admin)
│   ├── auth/           AuthScreen, OnboardingScreen, UserProfileModal
│   ├── common/         Icons, Modal, Toast, Skeleton, ErrorBoundary
│   ├── exam/           ExamConfigScreen, ExamScreen
│   ├── exams/          ExamsScreen (gestión de planes)
│   ├── home/           HomeScreen, GlobalSearch
│   ├── layout/         AppScreens (router), BottomNav
│   ├── plans/          JoinPlanScreen
│   ├── review/         ReviewScreen (SRS)
│   ├── settings/       SettingsScreen
│   ├── stats/          StatsScreen, HeatmapScreen
│   └── themes/         ThemesScreen, ThemeDetailModal, QuestionGeneratorPanel...
├── hooks/              useAuth, useUserData, useGenerationQueue, useExamLifecycle...
├── utils/              optimizedPrompts, geminiHelpers, srs, documentAnalyzer...
└── supabaseClient.js   authHelpers + dbHelpers

api/
├── generate-gemini.js  Proxy Gemini con caché SHA256
├── scrape-url.js       Scraping de URLs (texto limpio)
├── manage-plans.js     Publicar/listar planes (org_admin)
├── clone-plan.js       Clonar plan de academia a alumno
└── ...
```

---

## Roles

| Rol | Descripción |
|-----|------------|
| `user` / `student` | Estudiante — hace tests, repasa, crea sus propios planes |
| `academy` | Academia o profesor — crea planes y los comparte con alumnos |
| `super_admin` | Administrador global — acceso a AdminScreen |

---

## Contribuir

Pull requests bienvenidos. Para cambios grandes, abre un issue primero.

```bash
git checkout -b mi-feature
# haz tus cambios
git commit -m "feat: descripción"
git push origin mi-feature
# abre PR
```
