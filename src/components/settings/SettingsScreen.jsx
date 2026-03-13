import React, { useState, useEffect, useRef } from 'react';
import Icons from '../common/Icons';
import { useTheme } from '../../context/ThemeContext';

function SettingsScreen({ onNavigate, onToggleDark, profile: profileProp, onUpdateProfile, user, onExportData, onImportData, isClonedTest }) {
  const { dm, cx } = useTheme();
  const fileInputRef = useRef(null);

  const [profile, setProfile] = useState({
    name: '',
    examName: '',
    notifications: false,
    dailyGoal: 20,
  });
  const [saved, setSaved] = useState(false);
  const [importStatus, setImportStatus] = useState(null); // null | 'loading' | { ok, message }
  const [notifPermission, setNotifPermission] = useState(() => {
    try { return Notification.permission; } catch { return 'denied'; }
  });

  // Cargar perfil desde props
  useEffect(() => {
    if (profileProp) {
      setProfile(prev => ({
        ...prev,
        ...profileProp,
        notifications: profileProp.notifications || false,
        dailyGoal: profileProp.dailyGoal ?? 20,
      }));
    }
  }, [profileProp]);

  const handleSave = async () => {
    const updatedProfile = { ...profile, darkMode: dm };
    if (onUpdateProfile) onUpdateProfile(updatedProfile);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleToggleNotifications = async () => {
    if (!profile.notifications) {
      // Activar — pedir permiso
      try {
        const permission = await Notification.requestPermission();
        setNotifPermission(permission);
        if (permission === 'granted') {
          setProfile(p => ({ ...p, notifications: true }));
        }
        // Si denegado: no activar, el usuario verá el mensaje de estado
      } catch {
        setProfile(p => ({ ...p, notifications: !p.notifications }));
      }
    } else {
      setProfile(p => ({ ...p, notifications: false }));
    }
  };

  const handleExport = () => {
    if (onExportData) onExportData();
  };

  const handleImportFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';

    setImportStatus('loading');
    try {
      if (onImportData) {
        const result = await onImportData(file);
        setImportStatus({ ok: true, message: `✅ ${result.importedQuestions} preguntas importadas en ${result.importedThemes} temas` });
      }
    } catch (err) {
      setImportStatus({ ok: false, message: `❌ Error: ${err.message}` });
    }
    setTimeout(() => setImportStatus(null), 5000);
  };

  const inputClass = `w-full rounded-xl px-4 py-3 text-sm outline-none transition-all ${cx.input}`;

  const cardClass = `rounded-2xl p-5 space-y-4
    ${cx.cardAlt}`;

  const labelClass = `text-xs font-semibold uppercase tracking-wide mb-1.5 block
    ${dm ? 'text-slate-400' : 'text-slate-500'}`;

  const toggleBase = `relative w-12 h-6 rounded-full transition-all duration-300`;
  const toggleKnob = `absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform duration-300`;

  return (
    <div className={`min-h-full ${cx.screen} transition-colors duration-300`}
      style={{ paddingBottom: 'var(--pb-screen)' }}>

      {/* HEADER */}
      <div className={`sticky top-0 z-10 px-4 pb-4 ${cx.screen}`} style={{ paddingTop: 'var(--pt-header)' }}>
        <div className="flex items-center gap-3 max-w-lg mx-auto">
          <button
            onClick={() => onNavigate('home')}
            className={`w-10 h-10 rounded-2xl flex items-center justify-center transition-all
              ${dm ? 'bg-[#1E293B] text-slate-300' : 'bg-white text-slate-600 shadow-sm'}`}
          >
            <Icons.ChevronLeft />
          </button>
          <h1 className={`font-bold text-xl ${dm ? 'text-slate-100' : 'text-slate-800'}`}
            style={{ fontFamily: 'Sora, system-ui' }}>
            Ajustes
          </h1>
        </div>
      </div>

      <div className="px-4 max-w-lg mx-auto space-y-4">

        {/* PERFIL */}
        <div className={cardClass}>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-lg">👤</span>
            <h2 className={`font-bold text-base ${dm ? 'text-slate-200' : 'text-slate-700'}`}
              style={{ fontFamily: 'Sora, system-ui' }}>Perfil</h2>
          </div>

          <div>
            <label className={labelClass}>Nombre</label>
            <input type="text" value={profile.name || ''} placeholder="Tu nombre"
              onChange={(e) => setProfile({ ...profile, name: e.target.value })}
              className={inputClass} />
          </div>

        </div>

        {/* OBJETIVOS — solo para estudiantes */}
        {user?.role !== 'academy' && <div className={cardClass}>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-lg">🎯</span>
            <h2 className={`font-bold text-base ${dm ? 'text-slate-200' : 'text-slate-700'}`}
              style={{ fontFamily: 'Sora, system-ui' }}>Objetivo diario</h2>
          </div>
          <p className={`text-xs ${dm ? 'text-slate-500' : 'text-slate-400'} -mt-2`}>
            Preguntas que quieres responder cada día
          </p>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setProfile(p => ({ ...p, dailyGoal: Math.max(5, (p.dailyGoal || 20) - 5) }))}
              className={`w-10 h-10 rounded-xl font-bold text-lg flex items-center justify-center ${dm ? 'bg-white/10 text-white hover:bg-white/20' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}
            >−</button>
            <div className={`flex-1 text-center rounded-xl px-4 py-3 font-bold text-xl ${dm ? 'bg-[#1E293B] text-white' : 'bg-slate-50 text-slate-800 border border-slate-200'}`}>
              {profile.dailyGoal || 20}
            </div>
            <button
              onClick={() => setProfile(p => ({ ...p, dailyGoal: (p.dailyGoal || 20) + 5 }))}
              className={`w-10 h-10 rounded-xl font-bold text-lg flex items-center justify-center ${dm ? 'bg-white/10 text-white hover:bg-white/20' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}
            >+</button>
          </div>
          <div className="flex gap-2 flex-wrap">
            {[10, 20, 30, 50].map(n => (
              <button
                key={n}
                onClick={() => setProfile(p => ({ ...p, dailyGoal: n }))}
                className={`flex-1 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  (profile.dailyGoal || 20) === n
                    ? 'bg-blue-500 text-white'
                    : dm ? 'bg-white/5 text-gray-400 hover:bg-white/10' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                }`}
              >{n}</button>
            ))}
          </div>
        </div>}

        {/* APARIENCIA */}
        <div className={cardClass}>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-lg">🎨</span>
            <h2 className={`font-bold text-base ${dm ? 'text-slate-200' : 'text-slate-700'}`}
              style={{ fontFamily: 'Sora, system-ui' }}>Apariencia</h2>
          </div>

          <div className={`flex items-center justify-between p-3 rounded-xl
            ${cx.inner}`}>
            <div>
              <p className={`text-sm font-semibold ${dm ? 'text-slate-200' : 'text-slate-700'}`}>Modo oscuro</p>
              <p className={`text-xs ${dm ? 'text-slate-500' : 'text-slate-400'}`}>Reduce la fatiga visual</p>
            </div>
            <button onClick={onToggleDark}
              className={`${toggleBase} ${dm ? 'bg-blue-500' : 'bg-slate-300'}`}>
              <div className={`${toggleKnob} ${dm ? 'translate-x-6' : ''}`} />
            </button>
          </div>
        </div>

        {/* NOTIFICACIONES */}
        <div className={cardClass}>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-lg">🔔</span>
            <h2 className={`font-bold text-base ${dm ? 'text-slate-200' : 'text-slate-700'}`}
              style={{ fontFamily: 'Sora, system-ui' }}>Notificaciones</h2>
          </div>

          <div className={`flex items-center justify-between p-3 rounded-xl
            ${cx.inner}`}>
            <div>
              <p className={`text-sm font-semibold ${dm ? 'text-slate-200' : 'text-slate-700'}`}>Recordatorio de repaso</p>
              <p className={`text-xs ${dm ? 'text-slate-500' : 'text-slate-400'}`}>
                Aviso cuando abres la app y tienes pendientes
              </p>
            </div>
            <button onClick={handleToggleNotifications}
              className={`${toggleBase} ${profile.notifications && notifPermission === 'granted' ? 'bg-green-500' : dm ? 'bg-slate-700' : 'bg-slate-300'}`}>
              <div className={`${toggleKnob} ${profile.notifications && notifPermission === 'granted' ? 'translate-x-6' : ''}`} />
            </button>
          </div>

          {notifPermission === 'denied' && (
            <p className={`text-xs px-3 ${dm ? 'text-red-400' : 'text-red-500'}`}>
              ⚠️ Notificaciones bloqueadas en el navegador. Actívalas desde Configuración del sitio.
            </p>
          )}
          {notifPermission === 'default' && !profile.notifications && (
            <p className={`text-xs px-3 ${dm ? 'text-slate-500' : 'text-slate-400'}`}>
              Al activarlas el navegador pedirá permiso.
            </p>
          )}
        </div>

        {/* EXPORTAR / IMPORTAR */}
        <div className={cardClass}>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-lg">📦</span>
            <h2 className={`font-bold text-base ${dm ? 'text-slate-200' : 'text-slate-700'}`}
              style={{ fontFamily: 'Sora, system-ui' }}>Datos</h2>
          </div>
          <p className={`text-xs -mt-2 ${dm ? 'text-slate-500' : 'text-slate-400'}`}>
            Exporta tus preguntas a Excel para editarlas o hacer copia de seguridad.
          </p>

          {isClonedTest ? (
            <div className={`rounded-xl p-3 text-sm ${dm ? 'bg-amber-500/10 border border-amber-500/30 text-amber-300' : 'bg-amber-50 border border-amber-200 text-amber-700'}`}>
              🔒 Este es un plan compartido. Solo puedes exportar e importar preguntas en planes que hayas creado tú.
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              <button
                onClick={handleExport}
                className={`w-full py-3 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 transition-all ${
                  dm
                    ? 'bg-blue-500/15 border border-blue-500/30 text-blue-300 hover:bg-blue-500/25'
                    : 'bg-blue-50 border border-blue-200 text-blue-700 hover:bg-blue-100'
                }`}
              >
                ⬇️ Exportar preguntas (Excel)
              </button>

              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls"
                className="hidden"
                onChange={handleImportFile}
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={importStatus === 'loading'}
                className={`w-full py-3 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 transition-all ${
                  dm
                    ? 'bg-green-500/15 border border-green-500/30 text-green-300 hover:bg-green-500/25'
                    : 'bg-green-50 border border-green-200 text-green-700 hover:bg-green-100'
                } disabled:opacity-50`}
              >
                {importStatus === 'loading' ? '⏳ Importando...' : '⬆️ Importar desde Excel'}
              </button>

              {importStatus && importStatus !== 'loading' && (
                <p className={`text-sm text-center font-medium ${importStatus.ok ? 'text-green-500' : 'text-red-500'}`}>
                  {importStatus.message}
                </p>
              )}

              <p className={`text-xs text-center ${dm ? 'text-slate-600' : 'text-slate-400'}`}>
                El archivo Excel se puede abrir y editar en Excel o Google Sheets.
              </p>
            </div>
          )}
        </div>

        {/* ADMIN (solo visible para el administrador) */}
        {(user?.role === 'org_admin' || user?.role === 'super_admin') && (
          <button
            onClick={() => onNavigate('admin')}
            className={`w-full py-3 rounded-2xl text-sm font-semibold flex items-center justify-center gap-2 transition-all
              ${dm ? 'bg-white/5 text-gray-400 border border-white/10 hover:bg-white/10' : 'bg-slate-100 text-slate-600 border border-slate-200 hover:bg-slate-200'}`}
          >
            🛡️ Panel de administración
          </button>
        )}

        {/* GUARDAR */}
        <button onClick={handleSave}
          className="w-full py-4 rounded-2xl text-white font-bold text-sm transition-all active:scale-[0.98]"
          style={{
            background: saved
              ? '#10B981'
              : 'linear-gradient(135deg, #2563EB, #7C3AED)',
            boxShadow: '0 4px 20px rgba(37,99,235,0.3)',
            fontFamily: 'Sora, system-ui'
          }}>
          {saved ? '✅ ¡Guardado!' : '💾 Guardar cambios'}
        </button>

      </div>
    </div>
  );
}

export default SettingsScreen;
