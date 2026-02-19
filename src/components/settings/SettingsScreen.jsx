import React, { useState, useEffect } from 'react';
import Icons from '../common/Icons';
import { GRADIENT_BG } from '../../utils/constants';

function SettingsScreen({ onNavigate, darkMode, onToggleDark }) {
  const dm = darkMode;
  const [profile, setProfile] = useState({
    name: '',
    examName: '',
    numThemes: 90,
    penaltySystem: 'classic'
  });
  const [notifications, setNotifications] = useState(false);
  const [saved, setSaved] = useState(false);

  // Cargar perfil sin bloquear - NO usa loading state
  useEffect(() => {
    (async () => {
      try {
        const p = await storage.get('user-profile');
        if (p) {
          setProfile(p);
          setNotifications(p.notifications || false);
        }
      } catch (e) {
        // En modo demo, storage puede fallar - continuar con defaults
        console.log('Settings: usando valores por defecto');
      }
    })();
  }, []);

  const handleSave = async () => {
    try {
      const updatedProfile = { ...profile, darkMode: dm, notifications };
      await storage.set('user-profile', updatedProfile);
    } catch (e) {
      console.log('Settings: no se pudo guardar en storage');
    }
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
            <label className={labelClass}>Oposición</label>
            <input type="text" value={profile.examName || ''} placeholder="Ej: Guardia Civil, Administrativo..."
              onChange={(e) => setProfile({...profile, examName: e.target.value})}
              className={inputClass} />
          </div>

          <div>
            <label className={labelClass}>Número de temas</label>
            <input type="number" min="1" max="200" value={profile.numThemes || 90}
              onChange={(e) => {
                const v = parseInt(e.target.value);
                if (v >= 1 && v <= 200) setProfile({...profile, numThemes: v});
              }}
              className={inputClass} />
          </div>

          <div>
            <label className={labelClass}>Sistema de penalización</label>
            <select value={profile.penaltySystem || 'classic'}
              onChange={(e) => setProfile({...profile, penaltySystem: e.target.value})}
              className={inputClass}>
              <option value="classic" className="bg-slate-800 text-white">Clásico: 3 incorrectas = -1</option>
              <option value="each2" className="bg-slate-800 text-white">Estricto: 2 incorrectas = -1</option>
              <option value="each4" className="bg-slate-800 text-white">Permisivo: 4 incorrectas = -1</option>
              <option value="none" className="bg-slate-800 text-white">Sin penalización</option>
            </select>
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

        {/* INFO */}
        <div className={cardClass}>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-lg">💡</span>
            <h2 className={`font-bold text-base ${dm ? 'text-slate-200' : 'text-slate-700'}`}
              style={{ fontFamily: 'Sora, system-ui' }}>Sobre PasaElTest</h2>
          </div>
          <div className="space-y-2">
            {[
              ['Versión', '2.3 Redesign'],
              ['Generación', 'Análisis inteligente Fase 2'],
              ['Almacenamiento', 'Nube (Supabase)'],
              ['IA', 'Gemini 2.0 Flash'],
            ].map(([k, v]) => (
              <div key={k} className="flex justify-between items-center">
                <span className={`text-xs ${dm ? 'text-slate-500' : 'text-slate-400'}`}>{k}</span>
                <span className={`text-xs font-semibold ${dm ? 'text-slate-300' : 'text-slate-600'}`}>{v}</span>
              </div>
            ))}
          </div>
        </div>

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
