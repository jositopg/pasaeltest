# ⚡ GUÍA RÁPIDA - 30 MINUTOS HASTA DEPLOY

## 🎯 OBJETIVO
Tener tu app live y accesible desde cualquier dispositivo en 30 minutos.

---

## ✅ CHECKLIST

### PASO 1: Supabase (10 min)
- [ ] Crear cuenta en supabase.com
- [ ] Crear proyecto "pasaeltest"
- [ ] Copiar Project URL y anon key
- [ ] Ejecutar supabase-schema.sql en SQL Editor
- [ ] Verificar 6 tablas creadas

### PASO 2: Local (5 min)
- [ ] Descargar/clonar proyecto
- [ ] `npm install`
- [ ] Copiar `.env.example` → `.env`
- [ ] Completar variables en `.env`
- [ ] `npm run dev`
- [ ] Probar registro en http://localhost:3000

### PASO 3: GitHub (5 min)
- [ ] Crear repo en github.com/new
- [ ] `git init`
- [ ] `git add .`
- [ ] `git commit -m "Initial commit"`
- [ ] `git remote add origin ...`
- [ ] `git push -u origin main`

### PASO 4: Vercel (10 min)
- [ ] Crear cuenta en vercel.com
- [ ] Import proyecto desde GitHub
- [ ] Añadir 3 variables de entorno
- [ ] Deploy
- [ ] ✅ ¡App live!

---

## 📝 VALORES QUE NECESITAS

Prepara estos valores antes de empezar:

```
✅ Supabase URL: https://xxxxx.supabase.co
✅ Supabase anon key: eyJhbGci...
✅ Anthropic API key: sk-ant-api03-...
```

---

## 🚨 SI ALGO FALLA

**Error en Supabase:**
→ Verifica que el SQL se ejecutó completo (sin errores)

**Error en local:**
→ Revisa `.env` (copiar exacto desde Supabase)

**Error en Vercel:**
→ Verifica variables de entorno (3 completas)

---

## 🎉 RESULTADO

Al terminar tendrás:
- ✅ URL pública: https://tu-app.vercel.app
- ✅ Base de datos real
- ✅ Auth funcionando
- ✅ Accesible desde móvil/tablet/desktop
- ✅ Deploy automático (git push = actualización)

**Tiempo total:** 30 minutos
**Coste:** $0 inicial (solo pagas IA cuando uses)

---

¿Listo? Sigue README.md paso a paso.
