import React, { useState, useEffect } from 'react';
import Icons from '../common/Icons';
import { GRADIENT_BG } from '../../utils/constants';
import { useTheme } from '../../context/ThemeContext';

const ADMIN_EMAIL = import.meta.env.VITE_ADMIN_EMAIL || '';

function SettingsScreen({ onNavigate, onToggleDark, profile: profileProp, onUpdateProfile, user }) {
  const { darkMode } = useTheme();
  const dm = darkMode;
  const [profile, setProfile] = useState({
    name: '',
    examName: '',
    numThemes: 90,
    penaltyRatio: 3,
  });
  const [notifications, setNotifications] = useState(false);
  const [saved, setSaved] = useState(false);

  // Cargar perfil desde props
  useEffect(() => {
    if (profileProp) {
      // Compatibilidad con el campo antiguo penaltySystem (string → número)
      const legacyMap = { none: 0, each2: 2, classic: 3, each4: 4, each1: 1 };
      const penaltyRatio = profileProp.penaltyRatio !== undefined
        ? profileProp.penaltyRatio
        : (legacyMap[profileProp.penaltySystem] ?? 3);
      setProfile(prev => ({ ...prev, ...profileProp, penaltyRatio }));
      setNotifications(profileProp.notifications || false);
    }
  }, [profileProp]);

  const handleSave = async () => {
    const updatedProfile = { ...profile, darkMode: dm, notifications };
    if (onUpdateProfile) onUpdateProfile(updatedProfile);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const inputClass = `w-full rounded-xl px-4 py-3 text-sm outline-none transition-all
    ${dm
      ? 'bg-[#1E293B] border border-[#334155] text-slate-100 focus:border-blue-500'
      : 'bg-[#F8FAFF] border border-slate-200 text-slate-800 focus:border-blue-500'
    }`;

  const cardClass = `rounded-2xl p-5 space-y-4
    ${dm ? 'bg-[#0F172A] border border-[#1E293B]' : 'bg-white border border-slate-100 shadow-sm'}`;

  const labelClass = `text-xs font-semibold uppercase tracking-wide mb-1.5 block
    ${dm ? 'text-slate-400' : 'text-slate-500'}`;

  return (
    <div className={`min-h-full ${dm ? 'bg-[#080C14]' : 'bg-[#F0F4FF]'} transition-colors duration-300`}
      style={{ paddingBottom: '100px' }}>

      {/* HEADER */}
      <div className={`sticky top-0 z-10 px-4 pt-12 pb-4 ${dm ? 'bg-[#080C14]' : 'bg-[#F0F4FF]'}`}>
        <div className="flex items-center gap-3 max-w-lg mx-auto">
          <button
            onClick={() => onNavigate('home')}
            className={`w-10 h-10 rounded-2xl flex items-center justify-center transition-all
              ${dm ? 'bg-[#1E293B] text-slate-300' : 'bg-white text-slate-600 shadow-sm'}`}
          >
            <Icons.ChevronLeft />
          </button>
          <div>
            <h1 className={`font-bold text-xl ${dm ? 'text-slate-100' : 'text-slate-800'}`}
              style={{ fontFamily: 'Sora, system-ui' }}>
              Ajustes
            </h1>
          </div>
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
              onChange={(e) => setProfile({...profile, name: e.target.value})}
              className={inputClass} />
          </div>

          <div>
            <label className={labelClass}>Tipo de examen</label>
            <input type="text" value={profile.examName || ''} placeholder="Ej: Guardia Civil, Administrativo..."
              onChange={(e) => setProfile({...profile, examName: e.target.value})}
              className={inputClass} />
          </div>

          <div>
            <label className={labelClass}>Número de temas</label>
            <input type="number" min="1" value={profile.numThemes || 90}
              onChange={(e) => {
                const v = parseInt(e.target.value);
                if (v >= 1) setProfile({...profile, numThemes: v});
              }}
              className={inputClass} />
          </div>

          <div>
            <label className={labelClass}>Penalización por errores</label>
            <div className={`flex items-center justify-between p-3 rounded-xl mb-3
              ${dm ? 'bg-[#1E293B]' : 'bg-slate-50'}`}>
              <div>
                <p className={`text-sm font-semibold ${dm ? 'text-slate-200' : 'text-slate-700'}`}>Sin penalización</p>
                <p className={`text-xs ${dm ? 'text-slate-500' : 'text-slate-400'}`}>Los errores no restan puntos</p>
              </div>
              <button
                onClick={() => setProfile({...profile, penaltyRatio: profile.penaltyRatio === 0 ? 3 : 0})}
                className={`relative w-12 h-6 rounded-full transition-all duration-300
                  ${profile.penaltyRatio === 0 ? 'bg-blue-500' : dm ? 'bg-slate-700' : 'bg-slate-300'}`}>
                <div className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform duration-300
                  ${profile.penaltyRatio === 0 ? 'translate-x-6' : ''}`} />
              </button>
            </div>
            {profile.penaltyRatio !== 0 && (
              <div>
                <label className={`text-xs ${dm ? 'text-slate-400' : 'text-slate-500'} mb-1.5 block`}>
                  Errores para quitar 1 acierto
                </label>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => { const v = (profile.penaltyRatio || 3) - 1; if (v >= 1) setProfile({...profile, penaltyRatio: v}); }}
                    className={`w-10 h-10 rounded-xl font-bold text-lg flex items-center justify-center ${dm ? 'bg-white/10 text-white hover:bg-white/20' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}
                  >−</button>
                  <div className={`flex-1 text-center rounded-xl px-4 py-3 font-bold text-xl ${dm ? 'bg-[#1E293B] text-white' : 'bg-slate-50 text-slate-800 border border-slate-200'}`}>
                    {profile.penaltyRatio || 3}
                  </div>
                  <button
                    onClick={() => setProfile({...profile, penaltyRatio: (profile.penaltyRatio || 3) + 1})}
                    className={`w-10 h-10 rounded-xl font-bold text-lg flex items-center justify-center ${dm ? 'bg-white/10 text-white hover:bg-white/20' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}
                  >+</button>
                </div>
                <p className={`text-xs mt-2 text-center ${dm ? 'text-slate-500' : 'text-slate-400'}`}>
                  {profile.penaltyRatio || 3} {(profile.penaltyRatio || 3) === 1 ? 'error' : 'errores'} quitan 1 acierto
                </p>
              </div>
            )}
          </div>
        </div>

        {/* APARIENCIA */}
        <div className={cardClass}>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-lg">🎨</span>
            <h2 className={`font-bold text-base ${dm ? 'text-slate-200' : 'text-slate-700'}`}
              style={{ fontFamily: 'Sora, system-ui' }}>Apariencia</h2>
          </div>

          <div className={`flex items-center justify-between p-3 rounded-xl
            ${dm ? 'bg-[#1E293B]' : 'bg-slate-50'}`}>
            <div>
              <p className={`text-sm font-semibold ${dm ? 'text-slate-200' : 'text-slate-700'}`}>Modo oscuro</p>
              <p className={`text-xs ${dm ? 'text-slate-500' : 'text-slate-400'}`}>Reduce la fatiga visual</p>
            </div>
            <button onClick={onToggleDark}
              className={`relative w-12 h-6 rounded-full transition-all duration-300
                ${dm ? 'bg-blue-500' : 'bg-slate-300'}`}>
              <div className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform duration-300
                ${dm ? 'translate-x-6' : ''}`} />
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
            ${dm ? 'bg-[#1E293B]' : 'bg-slate-50'}`}>
            <div>
              <p className={`text-sm font-semibold ${dm ? 'text-slate-200' : 'text-slate-700'}`}>Recordatorio diario</p>
              <p className={`text-xs ${dm ? 'text-slate-500' : 'text-slate-400'}`}>Recordatorio a las 20:00h</p>
            </div>
            <button onClick={() => setNotifications(!notifications)}
              className={`relative w-12 h-6 rounded-full transition-all duration-300
                ${notifications ? 'bg-green-500' : dm ? 'bg-slate-700' : 'bg-slate-300'}`}>
              <div className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform duration-300
                ${notifications ? 'translate-x-6' : ''}`} />
            </button>
          </div>
        </div>

        {/* ADMIN (solo visible para el administrador) */}
        {ADMIN_EMAIL && user?.email?.toLowerCase() === ADMIN_EMAIL.toLowerCase() && (
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

// ============================================================================
// BOTTOM NAV
// ============================================================================


export default SettingsScreen;
