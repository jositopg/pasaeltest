import React, { useState, useEffect } from 'react';
import { GRADIENT_BG } from '../../utils/constants';

function OnboardingScreen({ user, onComplete }) {
  const [step, setStep] = useState(0);
  const [config, setConfig] = useState({
    numThemes: 90,
    penaltySystem: 'classic',
    notifications: false,
    darkMode: false
  });

  // Si es invitado, configuración por defecto y saltar al final
  useEffect(() => {
    if (user.isGuest) {
      setStep(2); // Ir al último paso
    }
  }, [user.isGuest]);

  const steps = user.isGuest ? [
    {
      title: '¡Bienvenido! 👋',
      description: 'Estás en modo prueba',
      icon: '🎉'
    },
    {
      title: 'Configuración',
      description: 'Setup rápido',
      icon: '📚'
    },
    {
      title: '¡Modo Demo Activado! 🚀',
      description: 'Explora todas las funciones libremente',
      icon: '✨'
    }
  ] : [
    {
      title: '¡Bienvenido a PasaElTest! 👋',
      description: `Hola ${user.name}, vamos a configurar tu espacio de estudio personalizado`,
      icon: '🎉'
    },
    {
      title: 'Configura tu examen',
      description: 'Cuéntanos más sobre tu proceso de estudio',
      icon: '📚'
    },
    {
      title: '¡Todo listo! 🚀',
      description: 'Comienza a estudiar de forma inteligente',
      icon: '✨'
    }
  ];

  const handleComplete = async () => {
    const profile = {
      name: user.name,
      examName: user.oposicion,
      numThemes: config.numThemes,
      penaltySystem: config.penaltySystem,
      darkMode: config.darkMode,
      notifications: config.notifications
    };

    // Actualizar el usuario para marcar onboarding como completado
    if (!user.isGuest && user.isFirstLogin) {
      const updatedUser = { ...user, isFirstLogin: false };
      // Actualizar en el estado (no necesitamos storage aquí)
      // Supabase ya tiene el usuario registrado
      onComplete(profile, updatedUser);
    } else {
      onComplete(profile);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 flex items-center justify-center p-4">
      <div className="w-full max-w-2xl">
        <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-8 shadow-2xl">
          {/* Progress bar */}
          <div className="mb-8">
            <div className="flex justify-between mb-2">
              {steps.map((_, idx) => (
                <div
                  key={idx}
                  className={`h-2 flex-1 rounded-full mx-1 transition-all ${
                    idx <= step ? 'bg-blue-500' : 'bg-white/10'
                  }`}
                />
              ))}
            </div>
            <p className="text-gray-400 text-sm text-center">
              Paso {step + 1} de {steps.length}
            </p>
          </div>

          {/* Content */}
          <div className="text-center mb-8">
            <div className="text-6xl mb-4">{steps[step].icon}</div>
            <h2 className="text-3xl font-bold text-white mb-2">{steps[step].title}</h2>
            <p className="text-gray-400">{steps[step].description}</p>
          </div>

          {/* Guest warning */}
          {user.isGuest && step === 2 && (
            <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-4 mb-6">
              <p className="text-yellow-400 text-sm text-center mb-3">
                <strong>⚠️ Modo Invitado Activo</strong>
              </p>
              <p className="text-yellow-300 text-xs text-center mb-3">
                Tus datos NO se guardarán al cerrar la app. Para guardar tu progreso, crea una cuenta gratis.
              </p>
              <p className="text-gray-400 text-xs text-center">
                Puedes registrarte en cualquier momento desde Configuración
              </p>
            </div>
          )}

          {/* Step content */}
          {step === 1 && !user.isGuest && (
            <div className="space-y-4 mb-8">
              <div>
                <label className="block text-gray-300 text-sm mb-2">Número de temas</label>
                <input
                  type="number"
                  min="1"
                  max="200"
                  value={config.numThemes}
                  onChange={(e) => setConfig({...config, numThemes: parseInt(e.target.value)})}
                  className="w-full bg-white/5 text-white rounded-xl px-4 py-3 border border-white/10"
                  placeholder="Ej: 90"
                />
              </div>
              
              <div>
                <label className="block text-gray-300 text-sm mb-2">Sistema de penalización</label>
                <select
                  value={config.penaltySystem}
                  onChange={(e) => setConfig({...config, penaltySystem: e.target.value})}
                  className="w-full bg-white/5 text-white rounded-xl px-4 py-3 border border-white/10"
                >
                  <option value="classic">Clásico (3 incorrectas = -1)</option>
                  <option value="strict">Estricto (2 incorrectas = -1)</option>
                  <option value="permissive">Permisivo (4 incorrectas = -1)</option>
                  <option value="none">Sin penalización</option>
                </select>
              </div>

              <div className="flex items-center justify-between bg-white/5 rounded-xl p-4">
                <span className="text-gray-300">Modo oscuro</span>
                <button
                  onClick={() => setConfig({...config, darkMode: !config.darkMode})}
                  className={`relative w-12 h-6 rounded-full transition-colors ${
                    config.darkMode ? 'bg-blue-500' : 'bg-white/20'
                  }`}
                >
                  <div className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform ${
                    config.darkMode ? 'translate-x-6' : ''
                  }`} />
                </button>
              </div>
            </div>
          )}

          {/* Buttons */}
          <div className="flex gap-3">
            {step > 0 && !user.isGuest && (
              <button
                onClick={() => setStep(step - 1)}
                className="flex-1 bg-white/5 text-white py-3 rounded-xl hover:bg-white/10 transition-colors"
              >
                Atrás
              </button>
            )}
            <button
              onClick={() => {
                if (step < steps.length - 1) {
                  setStep(step + 1);
                } else {
                  handleComplete();
                }
              }}
              className="flex-1 bg-gradient-to-r from-blue-500 to-purple-500 text-white font-bold py-3 rounded-xl hover:from-blue-600 hover:to-purple-600 transition-all"
            >
              {step === steps.length - 1 ? '¡Comenzar!' : 'Siguiente'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}


export default OnboardingScreen;
