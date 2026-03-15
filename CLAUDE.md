# PasaElTest — Guía para Claude

App de estudio con preguntas tipo test generadas por IA, SRS (spaced repetition), exámenes con penalización y gestión de contenido por tema.

## Stack

| Capa | Tecnología |
|------|-----------|
| Frontend | React 18 + Vite, Tailwind CSS (dark mode por defecto) |
| Backend | Supabase (auth + DB con RLS) |
| IA | Gemini 2.5 Flash vía `/api/generate-gemini` (Vercel serverless) |
| Deploy | Vercel — rama `main` → producción automática |
| PWA | Workbox + Service Worker |

**Repo:** https://github.com/jositopg/pasaeltest

---

## Archivos clave

```
src/App.jsx                          Raíz: routing por screen, useAuth, useUserData, useToast, useGenerationQueue
src/hooks/useAuth.js                 Auth state — currentUser { id, email, name, role, createdAt, subscription }
src/hooks/useUserData.js             themes[], tests[], activeTestId, profile, examHistory, updateTheme(theme)
src/hooks/useGenerationQueue.js      Generación IA en background (survives navigation) — generateThemeInline, handleGenerateAll
src/hooks/useThemeModal.js           Estado completo de ThemeDetailModal — docs, preguntas, generación, preview
src/hooks/useDocumentManager.js      Gestión de documentos (PDF, URL, texto) — sin IA
src/hooks/useExamLifecycle.js        Lifecycle del examen (start, answer, finish, timer)
src/supabaseClient.js                authHelpers + dbHelpers con todas las funciones de DB
src/utils/constants.js               DEBUG, MAX_CHARS=100000, QUESTIONS_PER_BATCH=25, normalizeDifficulty()
src/utils/optimizedPrompts.js        Todos los prompts: OPTIMIZED_QUESTION_PROMPT, COMBINED_AUTO_AND_QUESTIONS_PROMPT, etc.
src/utils/geminiHelpers.js           parseCombinedResponse(), buildContent(), parseQuestionsResponse(), deduplicateQuestions()
src/utils/documentAnalyzer.js        analyzeDocument(), determineQuestionTypes()
src/utils/questionImporter.js        parseExcelQuestions(), parsePDFQuestions(), extractPDFText()
api/generate-gemini.js               Serverless: llama Gemini, caché SHA256 en ai_cache
api/scrape-url.js                    Serverless: fetch HTML estático, extrae texto limpio (max 80k)
api/_roleHelper.js                   ROLE_LEVEL: { user:0, academy:1, org_admin:1, super_admin:2 }
```

---

## Pantallas y navegación

```
AuthScreen → OnboardingScreen (1ª vez) → HomeScreen
                                              │
          ┌───────────────┬─────────────┬────┴────────┬──────────────┐
     ThemesScreen    ExamConfig/    ReviewScreen   StatsScreen   SettingsScreen
     └─ThemeDetail   ExamScreen     (SRS)
       ├─DocumentSection (PDF/URL/texto)
       ├─QuestionGeneratorPanel (⚡ IA)
       ├─ManualQuestionForm
       ├─QuestionList
       └─QuestionPreviewOverlay
```

**HomeScreen** tiene dos vistas: `StudentView` y `AcademyView` (según `currentUser.role`).

---

## Supabase — Schema

| Tabla | Campos clave |
|-------|-------------|
| `users` | id, email, name, oposicion, subscription, role |
| `tests` | id, user_id, name, invite_slug, cloned_from |
| `themes` | id, user_id, test_id (FK→tests), number, name |
| `documents` | id, theme_id, type, content, processed_content, search_results (jsonb) |
| `questions` | id, theme_id, text, options (jsonb), correct_answer, difficulty, explanation, stability, srs_difficulty, next_review, attempts, errors_count |
| `exam_history` | id, user_id, config (jsonb), score (jsonb) |
| `ai_cache` | prompt_hash (unique), response (jsonb), model, used_count |

**Constraints críticos:**
- `questions.difficulty` solo acepta: `'facil'`, `'media'`, `'dificil'` (sin tildes, lowercase). Siempre usar `normalizeDifficulty()` antes de insertar.
- No hay `unique_theme_number` — fue eliminado para soportar múltiples tests.

---

## Flujo de datos

```
useAuth ──── currentUser { id, email, name, role, createdAt, subscription }
               createdAt SIEMPRE incluido (checkSession + onAuthStateChange)

useUserData ─┬── tests[] + activeTestId
             ├── themes[] (del test activo)
             ├── profile { penaltySystem, ... }
             └── examHistory[]

updateTheme(theme):
  1. Actualización optimista inmediata en React state
  2. Sync a Supabase: upsert theme, insert/delete questions por diff UUID, insert/delete documents
  3. isRealId(id) → UUID regex — detecta IDs temporales vs reales de Supabase
  4. Rollback automático si falla Supabase
```

---

## Flujo de generación IA

### Caso sin material propio (tema nuevo)
`generateQuestionsFromDocuments()` (docs vacíos) →
1. Llama `COMBINED_AUTO_AND_QUESTIONS_PROMPT(theme.name)` — 1 llamada, devuelve material + preguntas
2. `parseCombinedResponse(text)` extrae bloques `MATERIAL_START/END` y `QUESTIONS_START/END`
3. Guarda material como documento en el tema
4. Si preguntas parseadas → `QuestionPreviewOverlay` para revisar y confirmar
5. Si falla el parse → fallback: segunda llamada `callGenerationAPI` con el material como contexto

### Caso con material propio (PDF/URL/texto)
`generateQuestionsFromDocuments()` (docs con contenido) →
1. `buildDocumentContents(docs)` — concatena hasta MAX_CHARS=100k
2. `analyzeDocument()` → si ≥2 secciones críticas/altas → `OPTIMIZED_PHASE2_PROMPT`, sino → `OPTIMIZED_QUESTION_PROMPT`
3. Llama API → parsea JSON → `normalizeDifficulty` → deduplica → `QuestionPreviewOverlay`

### Generación en background (ThemesScreen — ⚡ por tema o "Generar todo")
`useGenerationQueue` en `App.jsx` → `generateThemeInline(theme)`:
- Si tiene docs → `generateQuestionsInline` (preguntas solo)
- Si no tiene docs → `generateCombinedInline` (material + preguntas, guarda directamente sin preview)

### Tab Material (ThemeDetailModal)
Solo para material propio: PDF, texto pegado, URL. **Sin IA**. La IA va exclusivamente por el botón ⚡ en el tab Preguntas.

---

## Gemini API

- **Modelo:** `gemini-2.5-flash` vía `https://generativelanguage.googleapis.com/v1beta/`
- **Clave:** `GEMINI_API_KEY` en Vercel env vars (no tocar)
- **Free tier:** 250 req/día, 10 req/min
- `maxTokens: 8000` para prompts normales, `12000` para prompts combinados
- `callType: 'repo'` + `useCache: false` en llamadas combinadas (evita cachear)
- La caché SHA256 en tabla `ai_cache` reduce llamadas repetidas al mismo prompt

---

## Roles y permisos

```js
// api/_roleHelper.js
const ROLE_LEVEL = { user: 0, academy: 1, org_admin: 1, super_admin: 2 };
// OJO: usar ?? (nullish coalescing), NO || (falsy 0 bug)
if ((ROLE_LEVEL[role] ?? 0) < (ROLE_LEVEL[minRole] ?? 1)) → forbidden
```

- `role === 'academy'` → AcademyView en HomeScreen, acceso a AcademyStudentsScreen, manage-plans API
- `role === 'super_admin'` → AdminScreen

---

## Múltiples tests

Cada usuario puede tener N tests. Cada test tiene sus propios temas independientes.
- `activeTestId` → el test activo en ThemesScreen
- Al primer login de usuario existente sin `test_id` → migración automática
- `createTest(name)`, `switchTest(id)`, `renameTest(id, name)`, `deleteTest(id)` en useUserData

---

## Patrones y convenciones

- **Optimistic updates:** UI se actualiza antes de confirmación de Supabase — siempre
- **normalizeDifficulty():** llamar SIEMPRE antes de guardar dificultad de preguntas
- **isRealId(id):** usar para distinguir UUIDs reales de IDs temporales (`"1-ai-123"`)
- **Dark mode:** todas las clases de color vía objeto `cx` del `ThemeContext` (`cx.heading`, `cx.muted`, etc.) o directamente con `dm` boolean
- **showToast(msg, type):** tipos: `'success'`, `'error'`, `'warning'`, `'info'`
- **Sin error boundaries por pantalla** (todavía) — solo ErrorBoundary global en App
- **Sin TypeScript** — codebase 100% JS/JSX

---

## Cosas que NO hacer

- ❌ No usar `||` para comparar ROLE_LEVEL — usar `??` (falsy 0 bug)
- ❌ No insertar `difficulty` con tildes (`'fácil'`, `'difícil'`) — viola constraint de DB
- ❌ No añadir opciones "Buscar con IA" en el tab Material — la IA va solo en tab Preguntas
- ❌ No generar material sin generar preguntas — el flujo combinado es obligatorio
- ❌ No omitir `createdAt` en el objeto `currentUser` — múltiples componentes lo usan
- ❌ No hacer `git push --force` ni saltar hooks de commit
- ❌ No crear archivos de documentación (README, etc.) salvo que se pida explícitamente

---

## Preferencias de trabajo

- Ejecutar cambios directamente sin pedir permiso — autonomía total en este proyecto
- Siempre `git add → commit → push origin main` tras cada cambio
- Escala objetivo: 10–50 usuarios (fase inicial) — priorizar calidad sobre optimización prematura
- Respuestas cortas y directas — el usuario lee el diff, no hace falta resumir qué se hizo
